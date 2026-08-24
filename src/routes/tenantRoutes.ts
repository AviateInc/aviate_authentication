import express from "express";
import { tenantController } from "../controllers/tenantController";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = express.Router();

// Public routes 
router.post('/', tenantController.createTenant);
router.get('/subdomain/:subdomain', tenantController.getTenantBySubdomain);
router.get('/validate', tenantController.validateSubdomain);

//  Protected routes
router.get('/', authMiddleware, requireRole(['super_admin']), tenantController.getAllTenants);
router.get('/:id', authMiddleware, tenantController.getTenantById);
router.put('/:id', authMiddleware, requireRole(['super_admin']), tenantController.updateTenant);

export default router;