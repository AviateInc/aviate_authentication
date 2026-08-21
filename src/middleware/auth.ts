import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { JWTPayload } from "../models/types";

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Authorization header required.' });

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format.' });
        
        const token = parts[1];
        const decoded = await AuthService.validateToken(token);
        if (!decoded) return res.status(401).json({ error: 'Invalid or expired token.' });

        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error: ', error);
        res.status(500).json({ error: 'Authorization failed.' });
    }
};

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required.' }); 
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
        next();
    }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const parts = authHeader?.split(' ') ?? [];

        if (parts.length === 2 && parts[0] === 'Bearer') {
            const decoded = await AuthService.validateToken(parts[1]);
            if (decoded) req.user = decoded;
        }

        next();
    } catch (error) {
        next();
    }
};
