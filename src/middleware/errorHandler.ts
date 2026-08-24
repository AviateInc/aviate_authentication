import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error', err);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...process.env.NODE_ENV === 'development' && { stack: err.stack },
        });
    }

    // PostgreSQL errors
    if ((err as any).code === '23503') {
        return res.status(400).json({ error: 'Invalid reference.' });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token expired.' });
    }

    // Default 
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error.'
        : err.message,
        ...process.env.NODE_ENV === 'development' && { stack: err.stack },
    });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ error: `Route ${ req.method } ${ req.originalUrl }` });
};

export const catchAsync = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    }
};
