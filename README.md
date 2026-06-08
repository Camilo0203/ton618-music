# ton618-music

> ⚠️ **DEPRECATED — Este repositorio ha sido migrado a [`ton618-bot`](https://github.com/Camilo0203/ton618-bot)**
>
> Todo el código de música ahora vive en `ton618-bot/src/music/` como módulo integrado.
> Este repo se conserva **solo como referencia histórica** y ya no se mantiene.
>
> **Si vienes a desplegar música: NO uses este repo. Ve directo a `ton618-bot`.**

---

## 📦 Dónde está ahora

| Antes | Ahora |
|-------|-------|
| `ton618-music/src/commands/*.js` | `ton618-bot/src/commands/public/music/*.js` |
| `ton618-music/src/handlers/music*.js` | `ton618-bot/src/handlers/music/*.js` |
| `ton618-music/src/services/*.js` | `ton618-bot/src/music/services/*.js` |
| `ton618-music/src/utils/*.js` | `ton618-bot/src/music/utils/*.js` |
| `ton618-music/src/music/MusicManager.js` | `ton618-bot/src/music/MusicManager.js` |
| `ton618-music/src/config/lavalinkConfig.js` | `ton618-bot/src/music/config/lavalinkConfig.js` |
| `ton618-music/src/locales/{en,es}.js` | `ton618-bot/src/locales/modules/{en,es}/music.js` |

## 🚀 Cómo usar la música ahora

1. Clona [`ton618-bot`](https://github.com/Camilo0203/ton618-bot) (ya lo tienes en tu VPS)
2. Configura las vars `LAVALINK_*` en el `.env` del bot (o reusa las de este repo)
3. `npm ci && npm run deploy:compact && npm start`
4. Lavalink sigue corriendo en PM2 como app separada (no se toca)

## 🔄 Si necesitas migrar código viejo

Si tenías un script o fix en este repo, búscalo aquí como referencia y luego:
- Si es una mejora de funcionalidad → intégralo en `ton618-bot/src/music/`
- Si es un fix de config → actualiza `ton618-bot/src/music/config/lavalinkConfig.js`
- Si es una nueva traducción → añádela a `ton618-bot/src/locales/modules/{en,es}/music.js`

## 📜 Historial

- 2025-Q1: Repo creado con toda la lógica de música separada
- 2025-Q4: **Migrado a `ton618-bot`** para consolidar el monolito y simplificar el deploy

## Licencia

MIT (igual que `ton618-bot`).
