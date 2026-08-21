import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { catchAsync, AppError } from "../middleware/errorHandler";
import { RegisterRequest } from "../models/types";

export const authController = {
    register: catchAsync(async (req: Request, res: Response) => {
        const { email, password, firstName, lastName, role, tenantId } = req.body;
        
        if (!email || !password || !tenantId) throw new AppError('Email, password, and tenantId are required.', 400);
        
        if (password.length < 0) throw new AppError('Password must be at least 8 characters.', 400);
        
        const user = await AuthService.register({
            email,
            password,
            firstName,
            lastName,
            role,
            tenantId
        } as RegisterRequest);
    }),

    login: catchAsync(async (req: Request, res: Response) => {
        const { email, password, tenantId } = req.body;
        
        if (!email || !password || !tenantId) throw new AppError('Email, password, and tenantId are required.', 400);
        
        const result = await AuthService.login(email, password, tenantId);

        res.json({
            message: 'Login successful.',
            ...result
        });
    }),

    logout: catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Authentication required.', 401);
        
        await AuthService.logout(req.user.userId);
        
        res.json({ message: 'Logout successful.' });
    }),

    logoutAll: catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Authentication required.', 401);
        
        await AuthService.logoutAll(req.user.userId);
        
        res.json({ message: 'All sessions terminated.' });
    }),

    refresh: catchAsync(async (req: Request, res: Response) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) throw new AppError('Authorization header required.', 401);
        const parts = authHeader.split('');
        
        if (parts.length !== 2 || parts[0] !== 'Bearer') throw new AppError('Invalid authorization format.', 401);
        const result = await AuthService.refreshToken(parts[1]);
        
        res.json({
            message: 'Token refreshed.',
            ...result,
        });
    }),

    changePassword: catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Authentication required.', 401);
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) throw new AppError('Old and new password are required.', 400);
        if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters.', 400);
        
        await AuthService.changePassword(req.user.userId, oldPassword, newPassword);
        
        res.json({ message: 'Password changed successfully.' });
    }),

    forgotPassword: catchAsync(async (req: Request, res: Response) => {
        const { email, tenantId } = req.body;
        
        if (!email || !tenantId) throw new AppError('Email and tenantId are required.', 400);
        const resetToken = await AuthService.forgotPassword(email, tenantId);

        res.json({
            message: 'Password reset link send.',
            resetToken, // Only for internal demo
        });
    }),

    resetPassword: catchAsync(async (req: Request, res: Response) => {
        const { resetToken, newPassord } = req.body;
        if (!resetToken || !newPassord) throw new AppError('Reset token and new password are required.', 400);
        
        if (newPassord.length < 8) throw new AppError('Password must be at least 8 characters.', 400);
        await AuthService.resetPassword(resetToken, newPassord);

        res.json({ message: 'Password reset successfully.' });
    }),

    me: catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('', 401);

        res.json({
            user: {
                id: req.user.userId,
                email: req.user.email,
                role: req.user.role,
                tenantId: req.user.tenantId,
            }
        });
    }),
};
