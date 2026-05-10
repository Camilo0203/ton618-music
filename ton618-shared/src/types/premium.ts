export type PremiumTier = 'pro_monthly' | 'pro_yearly' | 'lifetime' | null;

export type GuildTier = 'pro' | 'free';

export interface PremiumStatus {
  has_premium: boolean;
  tier: PremiumTier;
  expires_at: string | null;
  lifetime: boolean;
  owner_user_id?: string;
  /** Origen de la respuesta: cache, api, fallback, etc. */
  source?: string;
  /** Indica si el backend no estuvo disponible */
  unavailable?: boolean;
  /** Código de error si falló la resolución */
  errorCode?: string;
}
