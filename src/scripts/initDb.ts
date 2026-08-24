import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbName = process.env.POSTGRES_DB || 'aviate-db';

async function initDatabase() {
    const adminPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || 'securepassword',
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
        password: process.env.POSTGRES_PASSWORD || 'securepassword',
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
    } catch (error) {
        
    }
}