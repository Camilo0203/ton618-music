import type { GuildTier } from '../types/premium.js';

export interface TierLimits {
  maxQueue: number;
  maxVolume: number;
  maxDurationSeconds: number;
  bitrate: number;
  lavalinkNode: string;
  filters: boolean;
  spotifyEnabled: boolean;
  playlistEnabled: boolean;
}

export const TIER_LIMITS: Record<GuildTier, TierLimits> = {
  free: {
    maxQueue: 10,
    maxVolume: 80,
    maxDurationSeconds: 300,
    bitrate: 128_000,
    lavalinkNode: 'free',
    filters: false,
    spotifyEnabled: false,
    playlistEnabled: false,
  },
  pro: {
    maxQueue: 200,
    maxVolume: 100,
    maxDurationSeconds: 21_600,
    bitrate: 320_000,
    lavalinkNode: 'pro',
    filters: true,
    spotifyEnabled: true,
    playlistEnabled: true,
  },
};

/**
 * Devuelve los límites permitiendo sobreescritura desde variables de entorno.
 * En browser (sin process.env) retorna los defaults.
 */
export function getTierLimitsFromEnv(): Record<GuildTier, TierLimits> {
  if (typeof process === 'undefined' || !process.env) {
    return TIER_LIMITS;
  }

  const readEnv = (key: string, fallback: string): number => {
    const val = process.env[key];
    return val !== undefined ? parseInt(val, 10) : parseInt(fallback, 10);
  };

  return {
    free: {
      ...TIER_LIMITS.free,
      maxQueue: readEnv('MUSIC_FREE_MAX_QUEUE', '10'),
      maxVolume: readEnv('MUSIC_FREE_MAX_VOLUME', '80'),
      maxDurationSeconds: readEnv('MUSIC_FREE_MAX_DURATION_SECONDS', '300'),
    },
    pro: {
      ...TIER_LIMITS.pro,
      maxQueue: readEnv('MUSIC_PRO_MAX_QUEUE', '200'),
      maxVolume: readEnv('MUSIC_PRO_MAX_VOLUME', '100'),
      maxDurationSeconds: readEnv('MUSIC_PRO_MAX_DURATION_SECONDS', '21600'),
    },
  };
}
