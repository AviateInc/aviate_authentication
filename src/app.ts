import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import { initializeDatabase } from "./config/database";
import { getRedisClient } from "./config/redis";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { tenantMiddleware } from "./middleware/tenant";

import authRoutes from "./routes/authRoutes";
import tenantRoutes from "./routes/tenantRoutes";
import { timeStamp } from "node:console";
import { RedisClient } from "redis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/v1/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cors 
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-tenant-subdomain'],
}));

// Logging
app.use((req, res, next) => {
    console.log(`${req.method} ${ req.path } - ${ req.ip }`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'aviate-auth-backend',
        version: '1.0.0',
    });
});

// Public routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);

// Protected routes
app.use('/api/v1/protected', tenantMiddleware, (req, res) => {
    res.json({
        message: 'Protected route accessed',
        tenantId: req.tenantId,
        tenantSchema: req.tenantSchema,
    });
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize and start
async function startServer() {
    try {
        // Initialize DB 
        await initializeDatabase();
        console.log('Database ready...');

        // Initialize Redis
        await getRedisClient();
        console.log('Redis ready...');

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port: ${ PORT }`);
            console.log(`Environment: ${ process.env.NODE_ENV || 'development' }`)
            console.log(`API: http://localhost:${ PORT }/api`);
            console.log(`API: http://localhost:${ PORT }/health`);
        });
    } catch (error) {
        console.error('Failed to start server: ', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGINT received, shutting down...');
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('SIGINT received, shutting down...');
    process.exit(1);
});

startServer();

export default app;
