import { Request, Response, NextFunction } from "express";
import { getTenantConnection } from "../config/database";
import { TenantService } from "../services/tenantService";

declare global {
    namespace Express {
        interface Request {
            dbClient?: Awaited<ReturnType<typeof getTenantConnection>>;
            tenantId?: string;
            tenantSchema?: string;
        }
    }
}

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let tenantId = req.headers['x-tenant-id'] as string;
        let subdomain = req.headers['x-tenant-subdomain'] as string;

        // Try to get tenant subdomain if not provided
        if (!tenantId && !subdomain) {
            const host = req.get('host') || '';
            const parts = host.split('.');
            if (parts.length > 1) {
                const possibleSubdomain = parts[0];
                if (possibleSubdomain !== 'www' && possibleSubdomain !== 'api') {
                    subdomain = possibleSubdomain;
                }
            }
        }

        // Release tenant
        let tenant;
        if (tenantId) {
            TenantService.getTenantById(tenantId);
        } else {
            tenant = await TenantService.getTenantBySubdomain(subdomain);
        }

        if (!tenant) {
            return res.status(404).json({ error: "Tenant not found or inactive." });
        }

        // Get tenant database connection
        const dbClient = await getTenantConnection(tenant.id);
        
        // Attach to request
        req.tenantId = tenant.id;
        req.tenantSchema = tenant.subdomain;
        req.dbClient = dbClient;

        // Add cleanup
        res.on('finish', () => {
            if (req.dbClient) { 
                req.dbClient.release();
            }
        });

        next();
    } catch (error) {
        console.error('Tenant middleware error: ', error);
        res.status(500).json({ error: 'Tenant resolution failed.' });
    }
};