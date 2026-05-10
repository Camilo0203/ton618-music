# @ton618/shared

Código compartido entre los servicios de TON618: bot de Discord, dashboard web y módulo de música.

## Instalación

```bash
npm install ../ton618-shared
```

O publicado a npm/GitHub Packages:
```bash
npm install @ton618/shared
```

## Build

```bash
cd ton618-shared
npm install
npm run build
```

Esto genera:
- `dist/esm/` — módulos ES para la web y para `import` en Node ≥20
- `dist/cjs/` — CommonJS para `require` en ton618-bot y ton618-music
- `dist/types/` — declaraciones TypeScript

## Uso

### Node (CommonJS)

```js
const { resolveGuildTier, TIER_LIMITS, createStructuredLogger } = require('@ton618/shared');

const tier = await resolveGuildTier(guildId, {
  mongoUri: process.env.MONGO_URI,
  supabaseUrl: process.env.SUPABASE_URL,
  botApiKey: process.env.BOT_API_KEY,
  logger: createStructuredLogger({ pretty: true }),
});

console.log(TIER_LIMITS[tier]);
```

### Node / Web (ESM)

```ts
import { resolveGuildTier, TIER_LIMITS, type GuildTier } from '@ton618/shared';

const tier: GuildTier = await resolveGuildTier(guildId, { ... });
```

### Subpaths

```ts
import { resolveGuildTier } from '@ton618/shared/premium';
import { TIER_LIMITS, MONGO_COLLECTIONS } from '@ton618/shared/constants';
import { createStructuredLogger } from '@ton618/shared/logger';
import type { PremiumStatus, GuildDashboardSnapshot } from '@ton618/shared/types';
```

## Qué contiene

| Módulo | Descripción |
|--------|-------------|
| `premium/resolver` | `resolveGuildTier()` — resolución de tier con cache MongoDB + fallback Supabase |
| `constants/tiers` | `TIER_LIMITS` PRO/FREE para Lavalink y lógica de negocio |
| `constants/mongo` | Nombres centralizados de colecciones MongoDB |
| `logger/structured` | Logger portable con modo JSON (producción) y pretty (desarrollo) |
| `types/*` | Tipos TypeScript compartidos entre bot, web y música |

## Integración en tus proyectos

### ton618-music

Reemplazar `src/utils/premiumResolver.js` y `src/config/lavalinkConfig.js` por imports de `@ton618/shared`.

### ton618-bot

El `PremiumService` puede delegar la resolución de tier a `resolveGuildTier()` cuando no necesita el circuit breaker interno (ej. comandos no críticos). El logger estructurado del bot puede ser reemplazado por `createStructuredLogger` para uniformidad.

### ton618-web

Importar tipos (`GuildDashboardSnapshot`, `BillingEntitlement`) para evitar duplicación de interfaces entre `dashboard/types.ts` y el backend.

## Nota sobre Square Cloud

Este paquete debe instalarse localmente (`file:../ton618-shared`) o publicarse a un registry privado. **No uses monorepo/workspace con Square Cloud** porque cada app despliega el repo completo.
