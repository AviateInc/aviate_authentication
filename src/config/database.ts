import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Main pool
export const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'securepassword',
    database: process.env.POSTGRES_DB || 'aviate-db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log('PostgreSQL connected!')
});

pool.on('error', (err) => {
    console.log('PostgreSQL error: ', err)
});

export async function initializeDatabase() {
    const client = await pool.connect();
    try {
        console.log('Initializing database schema...');

        // Create tenant table
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.tenants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                subdomain VARCHAR(100) UNIQUE NOT NULL,
                agency_code VARCHAR(50),
                config JSONB DEFAULT '{}'::jsonb,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP    
            )`
        );

        // Create indexes for tenants (separate statements)
        await client.query(`
            CREATE INDEX IF NOT EXISTS public.tenant idx_tenants_subdomain 
            ON public.tenants(subdomain)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_tenants_active 
            ON public.tenants(is_active)`
        );
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXIST public.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100), 
                role VARCHAR(50) DEFAULT 'buyer'
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email)
            )`
        );
        // Add foreign key constaint
        await client.query(`
            ALTER TABLE public.users
            ADD CONSTRAINT IF NOT EXISTS fk_users_tenant
            FOREIGN KEY (tenant_id)
            REFERENCES public.tenants(id)
            ON DELETE CASCADE`
        );
        // Create indexes for users
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_tenant
            ON public.users(tenant_id)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON public.users(email)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON public.users(is_active)`
        );
        // Create session table
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                token VARCHAR(500) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );
        // Add foreign key for sessions
        await client.query(`
            ALTER TABLE public.sessions
            ADD CONSTRAINT IF NOT EXISTS fk_sessions_user
            FOREIGN KEY (user_id)
            ON DELETE CASCADE`
        );
        // Create indexes for session
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sessions_token
            ON public.sessions(token)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_session_expires
            ON public.sessions(expires_at)`
        );

        console.log('Database schema initialized successfully.')
    } catch (error) {
        console.error('Database initialization failed: ', error);
        throw error;
    } finally {
        client.release();
    }
};

export async function getTenantConnection(tenantId: string) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT subdomain FROM public.tenants WHERE id = $1 AND is_active = true`,
            [tenantId]
        );
        if (result.rows.length === 0) throw new Error('Tenant not found or inactive.');

        const schemaName = result.rows[0].subdomain;
        // Create tenant schema
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        // Set search path in tenant schema
        await client.query(`SET search_path TO "${schemaName}", public`);
        // Create tenant specific audit log table
        await client.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            action VARCHAR(100) NOT NULL,
            details JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );
        // Create indexes for audit_logs
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_user
            ON "${schemaName}".audit_logs(user_id)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_action
            ON "${schemaName}".audit_logs(action)`
        );
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_created
            ON "${schemaName}".audit_logs(created_at)`
        );

        return client;
    } catch (error) {
        client.release();
        throw error;
    }
}

export default pool;
