import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbName = process.env.POSTGRES_DB || 'aviate_db';

async function initDatabase() {
    const adminPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || 'superS3cretAv1ateDbPassword',
        database: 'postgres',
    });

    const client = await adminPool.connect();
    try {
        const result = await client.query('SELECT 1 FROM pg_database WHERE datname= $1', 
            [dbName]
        );
        if (result.rows.length === 0) {
            console.log(`Creating database: ${ dbName }`);
            await client.query(`CREATE DATABASE: ${dbName}`);
            console.log(`Database ${ dbName } created.`)
        } else {
            console.log(`Database ${ dbName } already exists.`);
        }

    } catch (error) {
        console.error('Database creation failed: ', error);
    } finally {
        client.release();
        await adminPool.end();
    }

    // Now connect to the actual database
    const pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || 'superS3cretAv1ateDbPassword',
        database: dbName,
    });

    const dbClient = await pool.connect();
    try {
        console.log('Creating tables... ');
        await dbClient.query(`
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
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS public.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL, 
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(50),
                last_name VARCHAR(50),
                role VARCHAR(50) DEFAULT 'buyer',
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, email),
                FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
            )`
        );
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS public.sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                token VARCHAR(500) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
            )`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_tenants_subdomain 
            ON public.tenants(subdomain)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_tenants_active
            ON public.tenants(is_active)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_users_tenant
            ON public.users(tenant_id)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON public.users(email)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_users_active
            ON public.users(is_active)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_session_token
            ON public.session(token)`
        );
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_session_expires
            ON public.session(expires_at)`
        );

        console.log('Tables created successfully.')
    } catch (error) {
        console.error('Table creation failed.', error);
    } finally {
        dbClient.release();
        await pool.end();
    }

    console.log('Database initialization complete!')
}

initDatabase();
