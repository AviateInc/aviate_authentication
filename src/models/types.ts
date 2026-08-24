export interface Tenant {
    id: string;
    name: string;
    subdomain: string;
    agency_code?: string;
    config: Record<string, any>;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface User {
    id: string;
    tenant_id: string;
    email: string;
    password_hash: string;
    first_name?: string;
    last_name?: string;
    role: 'buyer' | 'admin' | 'super_admin';
    is_active: boolean;
    last_login?: Date;
    created_at: Date;
    updated_at: Date;
}

export interface AuthRequest {
    email: string;
    password: string;
    tenantId: string;
}

export interface RegisterRequest extends AuthRequest {
    firstName?: string;
    lastName?: string;
    role?: 'buyer' | 'admin';    
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role: string;
        tenantId: string;
    };
}

export interface JWTPayload { 
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    iat: number;
    exp: number;
}