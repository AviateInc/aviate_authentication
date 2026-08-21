import { Request, Response } from "express";
import { TenantService } from "../services/tenantService";
import { catchAsync, AppError } from "../middleware/errorHandler";

export const tenantController = {
    createTenant: catchAsync(async (req: Response, res: Response) => {
        const { name, subdomain, agencyCode, config } = req.body;

        if (!name || !subdomain) throw new AppError('Name and subdomain are required.', 400);

        // Validate subdomain (alphanumberic and hyphens only)
        if (!/^[a-z0-9-]+$/.test(subdomain)) throw new AppError('Subdomain can only contain lower case letters, numbers, and hyphens.', 400);

        const tenant = await TenantService.createTenant(name, subdomain, agencyCode, config);

        res.status(201).json({
            message: 'Tenant created successfully.',
            tenant,
        });
    }),

    getAllTenants: catchAsync(async (req: Request, res: Response) => {
        const tenants = await TenantService.getAllTenants();
        res.json(tenants);
    }),

    getTenantById: catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const tenant = await TenantService.getTenantById(id);

        if (!tenant) throw new AppError('Tenant not found.', 404);

        res.json(tenant);
    }),

    getTenantBySubdomain: catchAsync(async (req: Request, res: Response) => {
        const { subdomain } = req.params;
        const tenant = await TenantService.getTenantBySubdomain(subdomain);

        if (!tenant) throw new AppError('Tenant not found.', 404);
        res.json(tenant);
    }),

    updateTenant: catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params; 
        const { name, agencyCode, config, isActive } = req.body;
        const tenant = await TenantService.updateTenant(id, {
            name,
            agency_code: agencyCode,
            config,
            is_active: isActive,
        });

        res.json({
            message: 'Tenant updated successfully.',
            tenant,
        });
    }),

    validateSubdomain: catchAsync(async (req: Request, res: Response) => {
        const { subdomain } = req.query;
        if (!subdomain) throw new AppError('Subdomain query parameter is required.', 400);

        res.json({
            available: !existing,
            subdomain,
        });
    }),
}
