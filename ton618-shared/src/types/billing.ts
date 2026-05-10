import type { PremiumTier } from './premium.js';

export interface BillingEntitlement {
  guild_id: string;
  has_premium: boolean;
  subscription_tier: PremiumTier;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface CheckoutSessionPayload {
  guildId: string;
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
}

export interface CustomerPortalPayload {
  guildId: string;
  returnUrl: string;
}
