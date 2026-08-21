import express from "express";
import { authController } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routers
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.post('/refresh', authMiddleware, authController.refresh);
router.post('/change-password', authMiddleware,authController.changePassword);
router.get('/me', authMiddleware, authController.me);

export default router;