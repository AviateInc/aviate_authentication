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

    };
    
    static async logout(userId: string): Promise<void> {};

    static async logoutAll(userId: string): Promise<void> {};

    static async validateToken(token: string): Promise<JWTPayload | null> {};

    static async refreshToken(oldToken: string): Promise<AuthResponse> {};

    static async forgotPassword(email: string): Promise<string> {};

    static async resetPassword(email: string): Promise<string> {};
}
