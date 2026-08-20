import { createClient, RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (!redisClient) {
        redisClient = createClient({
            url: `redis://${ process.env.REDIS_HOST || 'localhost' }:${ process.env.REDIS_PORT || '6379' }`,
            password: process.env.REDIS_PASSWORD || undefined,
            database: parseInt(process.env.REDIS_DB || '0'),
        });

        redisClient.on('error', (err) => {
            console.error('Redis error: ', err);
        });

        redisClient.on('connect', () => {
            console.log('Redis connected.')
        });

        await redisClient.connect();
    }

    return redisClient;
};

// Session management with Redis
export class SessionManager {
    private static instance: SessionManager;
    private client: RedisClientType | null = null;

    private constructor() {}

    static async getInstance(): Promise<SessionManager> {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
            SessionManager.instance.client = await getRedisClient();
        }

        return SessionManager.instance;
    }

    async createSession(userid: string, token: string, expiresIn: number = 7 * 24 * 60 * 60): Promise<void> {
        if (!this.client) throw new Error('Redis client not initialized.');

        const key = `session: ${ userid }`;
        await this.client.setEx(key, expiresIn, token);

        // Also store reverse mapping for token lookup
        const tokenKey = `token:${ token }`;
        await this.client.setEx(tokenKey, expiresIn, userid);
    }

    async getSession(userId: string): Promise<string | null> {
        if (!this.client) throw new Error('Redis client not initialized.');
        return await this.client.get(`session:${ userId }`);
    }

    async validateToken(token: string): Promise<string | null> {
        if (!this.client) throw new Error('Redis client not initialized.');
        return await this.client.get(`token:${ token }`);
    }

    async invalidateSession(userId: string): Promise<void> {
        if (!this.client) throw new Error('Redis client not initialized.');
        const token = await this.client.get(`session:${ userId }`);

        if (token) {
            await this.client.del(`token:${ token }`);
        }

        await this.client.del(`session:${userId}`);
    }
    
    async invalidateAllSessions(userId: string): Promise<void> {
        if (!this.client) throw new Error('Redis client not initialized.');
        
        // Pattern: session:* for user
        const keys = await this.client.keys(`session:${ userId }:*`);
        
        if (keys.length > 0) {
            await this.client.del(keys);
        }

        // We also handle the main session key
        await this.invalidateSession(userId);
    }

    // Rate limiting
    async incrementalRateLimi(key: string, windowSeconds: number = 60): Promise<number> {
        if (!this.client) throw new Error('Redis client not initialized.');
        const count = await this.client.get(`ratelimit:${ key }`);
        return count ? parseInt(count) : 0;
    }
}

export default getRedisClient;
