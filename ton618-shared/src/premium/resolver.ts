import type { MongoClient } from 'mongodb';
import type { GuildTier } from '../types/premium.js';

export type { GuildTier };

export interface PremiumResolverOptions {
  mongoUri?: string;
  dbName?: string;
  supabaseUrl?: string;
  botApiKey?: string;
  cacheTtlMinutes?: number;
  logger?: {
    info?: (msg: string, meta?: Record<string, unknown>) => void;
    warn?: (msg: string, meta?: Record<string, unknown>) => void;
    error?: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

let _mongoClient: MongoClient | null = null;

async function getMongoClient(uri: string): Promise<MongoClient> {
  if (_mongoClient) return _mongoClient;
  const { MongoClient } = await import('mongodb');
  _mongoClient = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 3000,
  });
  await _mongoClient.connect();
  return _mongoClient;
}

/**
 * Resuelve el tier de un guild: "pro" | "free"
 * Estrategia: MongoDB cache → Supabase API → fallback "free"
 */
export async function resolveGuildTier(
  guildId: string,
  options: PremiumResolverOptions = {},
): Promise<GuildTier> {
  if (!guildId) return 'free';

  const {
    mongoUri,
    dbName = 'ton618_bot',
    supabaseUrl,
    botApiKey,
    logger,
  } = options;

  // 1. Consultar MongoDB cache
  if (mongoUri) {
    try {
      const client = await getMongoClient(mongoUri);
      const db = client.db(dbName);
      const doc = await db.collection('premium_cache').findOne({
        guild_id: guildId,
        app_cache_expires_at: { $gt: new Date() },
      });
      if (doc) {
        logger?.info?.(`[premium] Cache hit for guild ${guildId}`);
        return doc.has_premium === true ? 'pro' : 'free';
      }
    } catch (err) {
      logger?.error?.(`[premium] Mongo cache error: ${(err as Error).message}`, { guildId });
    }
  }

  // 2. Fallback a Supabase Edge Function
  if (supabaseUrl && botApiKey) {
    try {
      const url = new URL(`${supabaseUrl}/functions/v1/billing-guild-status/${guildId}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url.toString(), {
        headers: {
          'X-Bot-Api-Key': botApiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { has_premium?: boolean };
      return data.has_premium === true ? 'pro' : 'free';
    } catch (err) {
      logger?.error?.(`[premium] Supabase API error: ${(err as Error).message}`, { guildId });
    }
  }

  return 'free';
}

/** Cierra la conexión MongoDB singleton si está abierta */
export function closePremiumResolver(): void {
  if (_mongoClient) {
    _mongoClient.close().catch(() => {});
    _mongoClient = null;
  }
}
