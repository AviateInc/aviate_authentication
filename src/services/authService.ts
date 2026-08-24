import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { SessionManager } from "../config/redis";
import { User, JWTPayload, AuthResponse, RegisterRequest } from "../models/types";

export class AuthService {
    private static readonly SALT_ROUNDS = 12;

    static async register(data: RegisterRequest): Promise<User> {
        const { email, password, firstName, lastName, role, tenantId } = data;

        // Check if tenant exists
        const tenantCheck = await pool.query(`
            SELECT id FROM public.tenants WHERE id = $1 AND is_active = true
            `, 
            [tenantId]
        );
        if (tenantCheck.rows.length === 0) throw new Error('User already exists in this tenant.');

        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        const result = await pool.query(`
            INSERT INTO public.users (email, password_hashed, first_name, last_name, role, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, tenant_id, is_active, created_at    
            `,
            [email, hashedPassword, firstName || null, lastName || null, role || 'buyer', tenantId]
        );
        return result.rows[0];
    };

    static async login(email: string, password: string, tenantId: string): Promise<AuthResponse> {
        // Get user with tenant verification
        const result = await pool.query(`
            SELECT u.*, t.subdomain, t.config as tenant_config
            FROM public.users u
            JOIN public.tenants t ON u.tenant_id = t.id
            WHERE u.email = $1 AND u.tenant_id = $2 AND u.is_active = true
            AND t.is_active = true
            `, 
            [email, tenantId]
        );

        if (result.rows.length === 0) throw new Error('Invalid credentials.');
        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hashed);
        if (!isValid) throw new Error('Invalid credentials');

        // Update last login
        await pool.query(`UPDATE public.user SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

        // Generate JWT
        const payload: JWTPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenant_id,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000 + (7 * 24 * 60 * 60))
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'default-secret');

        // Store in Redis
        const sessionManager = await SessionManager.getInstance();
        await sessionManager.createSession(user.id, token);

        // Not sure about this return statement: TODO - test it tomorrow!
        return {
            token,
            user
        };
    };

    static async logout(userId: string): Promise<void> {
        const sessionManager = await SessionManager.getInstance();
        await sessionManager.invalidateSession(userId);
    };

    static async logoutAll(userId: string): Promise<void> {
        const sessionManager = await SessionManager.getInstance();
        await sessionManager.invalidateAllSessions(userId);
    };

    static async validateToken(token: string): Promise<JWTPayload | null> {
        try {
            // Check if token is in Redis (Blacklist check)
            const sessionManager = await SessionManager.getInstance();
            const userId = await sessionManager.validateToken(token);

            if (!userId) return null;

            // Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as JWTPayload;

            // Verify user still exists and is active
            const result = await pool.query(`SELECT id, is_active FROM public.users WHERE id = $1`, 
                [decoded.userId]
            );

            if (result.rows.length === 0 || !result.rows[0].is_active) return null;
            return decoded
        } catch (error) {
            return null;
        }
    };

    static async refreshToken(oldToken: string): Promise<AuthResponse> {
        // Validate old token
        const decoded = await this.validateToken(oldToken);
        if (!decoded) throw new Error('Invalid token');

        // Get user data
        const result = await pool.query(`SELECT * FROM public.users WHERE id = $1 AND is_active = true`, 
            [decoded.userId]
        );

        const user = result.rows[0];

        // Invalidate old session
        const sessionManager = await SessionManager.getInstance();
        await sessionManager.invalidateSession(user.id);

        // Create new token
        const payload: JWTPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenant_id,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        };

        const newToken = jwt.sign(payload, process.env.JWT_SECRET || 'default-secret');
        await sessionManager.createSession(user.id, newToken);

        return {
            token: newToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                tenantId: user.tenant_id,
            },
        };
    };

    static async changePassword(
        userId: string,
        oldPassword: string,
        newPassword: string
    ): Promise<void> {
        // Get user
        const result = await pool.query(`SELECT password_hash FROM public.users WHERE id = $1 AND is_active = true`, 
            [userId]
        );
        if (result.rows.length === 0) throw new Error('User not found.');

        // Verify old password
        const isValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
        if (!isValid) throw new Error('Current password is incorrect.');

        // Hash new password
        const sessionManager = SessionManager.getInstance();
        (await sessionManager).invalidateAllSessions(userId); // TODO: Not sure if this will work correctly - Test it!!!
    }

    static async forgotPassword(email: string, tenantId: string): Promise<string> {
        // Check if user exists
        const result = await pool.query(`
            SELECT id FROM public.users
            WHERE email = $1 AND tenant_id = $2
            AND is_active = true
            `, 
            [email, tenantId]
        );

        if (result.rows.length === 0) return 'If the user exists, a reset link will be sent.';

        // Generate reset token (simplified for demo - Need to expand on this for Prod.)
        const resetToken = jwt.sign(
            { userId: result.rows[0].id, purpose: 'reset' }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '1h' }
        );

        // Store reset token in Redis
        const sessionManager = await SessionManager.getInstance();
        const client = await sessionManager['client'];
        if (client) await client.setEx(`reset: ${ resetToken }`, 3600, result.rows[0].id)

        // TODO: In prod, send email with reset link, for MVP I simply return the token
        return resetToken;
    };

    static async resetPassword(resetToken: string, newPassword: string): Promise<void> {
        // Verify reset token 
        const sessionManager = await SessionManager.getInstance();
        const client = await sessionManager['client'];

        if (!client) throw new Error('Redis unavailable');

        const userId = await client.get(`reset: ${ resetToken }`);
        if (!userId) throw new Error('Invalid or expired reset token.');

        // Verify JWT
        try {
            jwt.verify(resetToken, process.env.JWT_SECRET || 'default-secret');
        } catch (error) {
            throw new Error('Invalid reset token.');
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
        await pool.query(`
            UPDATE public.users 
            SET password_hash = $1, 
            updated_at = CURRENT_TIMESTAMP
            WHERE  id = $2
            `, 
            [hashedPassword, userId]
        );

        //  Delete reset token
        await client.del(`reset: ${ resetToken }`);
        
        // Invalidate all sessions
        await sessionManager.invalidateAllSessions(userId);
    };
}
