import { pool } from "../config/database";
import { Tenant } from "../models/types";

export class TenantService {
    static async createTenant(
        name: string,
        subdomain: string,
        agencyCode?: string,
        config: Record<string, any> = {}
    ): Promise<Tenant> {
        const client = await pool.connect();

        try {
            // Check if subdomain exists
            const existing = await client.query(`
                SELECT id FROM public.tenants WHERE subdomain = $1
                `,
                [subdomain]
            );

            if (existing.rows.length > 0) throw new Error('Subdomain already taken.');

            const result = await client.query(`
                INSERT INTO public.tenants (name, subdomain, agency_code, config)
                VALUES ($1, $2, $3, $4) RETURNING *
                `, 
                [name, subdomain, agencyCode || null, config]
            );

            const tenant = result.rows[0];

            // Create tenant schema
            await client.query(`CREATE SCHEMA IF NOT EXISTS "${ subdomain }"`);

            // Create tenant audit table
            await client.query(`
                CREATE TABLE IF NOT EXISTS "${ subdomain }".audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    details JSONB,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            return tenant;
        } finally {
            client.release();
        }
    }

    static async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
        const client = await pool.connect();

        try {
            const result = await client.query(`
                SELECT * FROM public.tenants WHERE subdomain = $1 AND is_active = true
            `, [subdomain]);

            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    static async getTenantById(id: string): Promise<Tenant[]> {
        const result = await pool.query(`
            SELECT * FROM public.tenants WHERE id = $1 AND is_active = true
            `, 
            [id]
        );
        return result.rows;
    }

    static async getAllTenants(): Promise<Tenant[]> {
        const result = await pool.query(`SELECT * FROM public.tenants ORDER BY created_at DESC`);
        return result.rows;
    }

    static async updateTenant(
        id: string,
        updates: Partial<Pick<Tenant, 'name' | 'agency_code' | 'config' | 'is_active'>>
    ): Promise<Tenant> {
        const client = await pool.connect();

        try {
                const fields: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                if (updates.name !== undefined) {
                    fields.push(`name = $${paramIndex++}`);
                    values.push(updates.name);
                }

                if (updates.agency_code !== undefined) {
                    fields.push(`agency_code = $${paramIndex++}`)
                    values.push(updates.agency_code);
                }

                if (updates.config !== undefined) {
                    fields.push(`config = $${paramIndex++}`);
                    values.push(updates.config);
                }

                if (updates.is_active !== undefined) {
                    fields.push(`is_active = $${paramIndex++}`);
                    values.push(updates.is_active);
                }

                if (fields.length === 0) throw new Error('No fields to update.');

                fields.push(`updated_at = CURRENT_TIMESTAMP`);
                values.push(id);

                const query = `
                    UPDATE public.tenants
                    SET ${ fields.join(', ') }
                    WHERE id = $${ paramIndex }
                    RETURNING *
                `;
                    
                const result = await client. query(query, values);

                if (result.rows.length === 0) throw new Error('Tenant not found.');
                return result.rows[0];
        } finally {
            client.release();
        }
    }
}
