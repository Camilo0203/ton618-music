# 🎵 ton618-music

Sistema de música de alta calidad para TON618 Bot, basado en **Lavalink + Shoukaku + Kazagumo**.

---

## Arquitectura

```
ton618-music/
├── index.js                        ← Entry point (modo independiente)
├── lavalink/
│   ├── application.yml             ← Config Lavalink PRO (320kbps, todos los filtros)
│   └── application-free.yml        ← Config Lavalink FREE (128kbps, filtros off)
├── src/
│   ├── config/
│   │   └── lavalinkConfig.js       ← Nodos y límites por tier
│   ├── music/
│   │   └── MusicManager.js         ← Core: gestión de players, queue, filtros
│   ├── commands/
│   │   ├── play.js                 ← /play
│   │   ├── skip.js                 ← /skip
│   │   ├── stop.js                 ← /stop
│   │   ├── queue.js                ← /queue
│   │   ├── nowplaying.js           ← /nowplaying
│   │   ├── volume.js               ← /volume
│   │   ├── filter.js               ← /filter [PRO]
│   │   ├── shuffle.js              ← /shuffle [PRO]
│   │   ├── loop.js                 ← /loop
│   │   ├── pause.js                ← /pause
│   │   └── musicstatus.js          ← /musicstatus [Owner]
│   ├── handlers/
│   │   └── musicInteractionHandler.js
│   └── utils/
│       ├── premiumResolver.js      ← Lee tier PRO/FREE desde MongoDB o Supabase
│       └── musicEmbeds.js          ← Embeds con colores por tier
├── scripts/
│   └── deployMusicCommands.js      ← Deploy slash commands
└── tests/
    └── tierLimits.test.js
```

---

## Diferencias PRO vs FREE

| Característica          | FREE          | PRO           |
|------------------------|---------------|---------------|
| Calidad de audio       | 128 kbps      | 320 kbps      |
| Cola máxima            | 10 pistas     | 200 pistas    |
| Duración máx por pista | 5 minutos     | 6 horas       |
| Volumen máximo         | 80%           | 100%          |
| Filtros (EQ, BassBoost)| ❌            | ✅            |
| Spotify                | ❌            | ✅ (con plugin)|
| Playlists completas    | ❌            | ✅            |
| Loop de cola           | ❌            | ✅            |
| Shuffle                | ❌            | ✅            |
| Skip múltiple          | ❌            | ✅ (hasta 10) |

---

## Setup rápido

### 1. Instalar dependencias

```bash
cd ton618-music
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 3. Descargar Lavalink

```bash
mkdir -p lavalink
# Descargar la última versión desde:
# https://github.com/lavalink-devs/Lavalink/releases
curl -L https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar \
     -o lavalink/Lavalink.jar
```

### 4. Iniciar nodos Lavalink

**Nodo PRO** (puerto 2333):
```bash
cd lavalink
java -jar Lavalink.jar
```

**Nodo FREE** (puerto 2334, opcional si usas un solo nodo):
```bash
java -jar Lavalink.jar --spring.config.location=application-free.yml
```

> **Nota:** Si solo tienes un servidor, puedes usar el mismo nodo para ambos tiers apuntando las dos variables de entorno al mismo host:puerto. Los límites de duración y cola se aplican a nivel de código, no del servidor Lavalink.

### 5. Deploying slash commands

```bash
# Global (tarda ~1h)
DISCORD_CLIENT_ID=xxx node scripts/deployMusicCommands.js

# Solo un guild (instantáneo, ideal para testing)
DISCORD_CLIENT_ID=xxx node scripts/deployMusicCommands.js --guild TU_GUILD_ID
```

### 6. Iniciar el módulo

```bash
npm start
```

---

## Integración con ton618-bot (modo integrado)

En lugar de correr como proceso separado, puedes añadir el módulo al bot principal:

```js
// En ton618-bot/index.js, después de que el cliente esté listo:
const { MusicManager } = require('../ton618-music/src/music/MusicManager');
const { musicInteractionHandler } = require('../ton618-music/src/handlers/musicInteractionHandler');

client.musicManager = new MusicManager(client);
client.on('interactionCreate', musicInteractionHandler);
```

---

## Spotify (PRO)

Para habilitar Spotify, rellena `clientId` y `clientSecret` en `lavalink/application.yml`
bajo `plugins.lavasrc.spotify`. Obtén tus credenciales en:
https://developer.spotify.com/dashboard

---

## Variables de entorno necesarias

| Variable                          | Descripción                                      |
|-----------------------------------|--------------------------------------------------|
| `DISCORD_TOKEN`                   | Token del bot                                    |
| `DISCORD_CLIENT_ID`               | ID de la aplicación Discord                      |
| `LAVALINK_PRO_HOST/PORT/PASSWORD` | Nodo PRO                                         |
| `LAVALINK_FREE_HOST/PORT/PASSWORD`| Nodo FREE                                        |
| `MONGO_URI` / `MONGO_DB`          | MongoDB del bot principal (para leer premium)    |
| `SUPABASE_URL` / `BOT_API_KEY`    | Fallback premium via Supabase                    |
| `OWNER_ID`                        | ID del owner para /musicstatus                   |
| `PRO_UPGRADE_URL`                 | URL de upgarde para mensajes PRO                 |
