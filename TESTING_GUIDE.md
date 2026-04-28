# Guía de Testing — TON618 Music (Lavalink)

## Pre-requisitos

1. **Node.js 18+** instalado
2. **Java 17+** para Lavalink
3. **MongoDB** accesible (para `premiumResolver.js`)
4. Variables de entorno configuradas en `.env`

## Variables de entorno requeridas

```env
# Bot Discord
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id_aqui

# Lavalink PRO (alta calidad)
LAVALINK_PRO_HOST=localhost
LAVALINK_PRO_PORT=80
LAVALINK_PRO_PASSWORD=youshallnotpass
LAVALINK_PRO_SECURE=false

# Lavalink FREE (calidad estándar)
LAVALINK_FREE_HOST=localhost
LAVALINK_FREE_PORT=2334
LAVALINK_FREE_PASSWORD=youshallnotpass
LAVALINK_FREE_SECURE=false

# Límites (opcional, tienen defaults)
MUSIC_FREE_MAX_QUEUE=10
MUSIC_FREE_MAX_VOLUME=80
MUSIC_FREE_MAX_DURATION_SECONDS=300
MUSIC_PRO_MAX_QUEUE=200
MUSIC_PRO_MAX_VOLUME=100
MUSIC_PRO_MAX_DURATION_SECONDS=21600

# MongoDB (para resolver tier premium)
MONGO_URI=mongodb://localhost:27017/ton618

# Supabase fallback (opcional)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_key
BOT_API_KEY=tu_api_key

# URL para upgrades
PRO_UPGRADE_URL=https://ton618.app/pricing
OWNER_ID=tu_discord_user_id
```

## 1. Iniciar Lavalink

### Nodo FREE (puerto 2334)
```bash
cd lavalink
# Copiar config FREE
java -jar Lavalink.jar -Dconfig.location=application-free.yml
```

### Nodo PRO (puerto 80)
```bash
cd lavalink
# Copiar config PRO (application.yml)
java -jar Lavalink.jar -Dconfig.location=application.yml
```

> **Nota:** Si corres ambos en la misma máquina, necesitas 2 terminales. En Square Cloud se despliegan como apps separadas.

## 2. Instalar dependencias del módulo música

```bash
cd ton618-music
npm install
```

## 3. Probar tier FREE

1. Asegúrate de que el servidor Discord **NO tenga** PRO activo (borra de MongoDB si es necesario)
2. Inicia el módulo música:
   ```bash
   npm start
   ```
3. En Discord, invita el bot a un canal de voz
4. Prueba estos comandos:

| Comando | Resultado esperado FREE |
|---------|------------------------|
| `/play` `query: never gonna give you up` | Reproduce en 128kbps, cola max 10 |
| `/play` `query: https://open.spotify.com/...` | Bloqueado — mensaje PRO only |
| `/volume` `nivel: 90` | Bloqueado — max 80 en FREE |
| `/filter` | Bloqueado — PRO only |
| `/shuffle` | Bloqueado — PRO only |
| `/loop` `modo: queue` | Bloqueado — PRO only |
| `/skip` `cantidad: 5` | Bloqueado — solo 1 en FREE |

## 4. Probar tier PRO

1. Inserta el guild en MongoDB como PRO:
   ```javascript
   db.premium_cache.insertOne({
     guild_id: "ID_DE_TU_SERVIDOR",
     tier: "pro",
     activated_at: new Date(),
     source: "test"
   })
   ```

2. Reinicia el bot para limpiar caché (o espera TTL)
3. Prueba los mismos comandos — ahora deberían permitir:
   - Volumen hasta 100
   - Playlists de Spotify/YouTube
   - Filtros de audio (bassboost, nightcore, vaporwave)
   - Shuffle de cola
   - Loop de cola completa
   - Skip múltiple (hasta 10)
   - Cola de hasta 200 pistas

## 5. Comandos de verificación

| Comando | Uso |
|---------|-----|
| `/musicstatus` | Muestra estado de nodos Lavalink (solo owner) |
| `/queue` | Muestra la cola con paginación |
| `/nowplaying` | Muestra pista actual y progreso |

## 6. Troubleshooting

### "No pude conectarme al canal de voz. ¿El servidor Lavalink está activo?"
- Verifica que Lavalink esté corriendo: `curl http://localhost:2334`
- Revisa que los puertos en `.env` coincidan con los de `application.yml`

### "No hay ningún player activo en este servidor"
- Usa `/play` primero para crear un player
- Verifica que el bot tenga permisos de voz

### Comandos de música no aparecen en Discord
- El bot principal (`ton618-bot`) **NO integra** el módulo de música todavía
- Se necesita agregar al `index.js` del bot principal:
  ```js
  const { MusicManager } = require("../ton618-music/src/music/MusicManager");
  const { musicInteractionHandler } = require("../ton618-music/src/handlers/musicInteractionHandler");
  ```

## 7. Integración con bot principal

Para que los comandos de música funcionen dentro del bot principal, agrega al `index.js` de `ton618-bot`:

```js
// Después de crear el cliente Discord
const { MusicManager } = require("../ton618-music/src/music/MusicManager");
const { musicInteractionHandler } = require("../ton618-music/src/handlers/musicInteractionHandler");

client.on("ready", () => {
  client.musicManager = new MusicManager(client);
});

client.on("interactionCreate", musicInteractionHandler);

// Reenviar eventos de voz al MusicManager
client.on("raw", (data) => {
  if (["VOICE_SERVER_UPDATE", "VOICE_STATE_UPDATE"].includes(data.t)) {
    if (client.musicManager?.kazagumo?.shoukaku) {
      client.musicManager.kazagumo.shoukaku.updateVoiceData(data);
    }
  }
});
```

## 8. Estructura de archivos clave

```
ton618-music/
├── index.js                          # Entry point del módulo música
├── src/
│   ├── music/
│   │   └── MusicManager.js           # Core del player (Shoukaku + Kazagumo)
│   ├── commands/
│   │   ├── play.js                   # Reproducir (con tier gating)
│   │   ├── volume.js                 # Volumen (max 80 FREE / 100 PRO)
│   │   ├── filter.js                 # Filtros EQ (PRO only)
│   │   ├── shuffle.js                # Mezclar cola (PRO only)
│   │   ├── loop.js                   # Loop pista/cola (cola = PRO)
│   │   ├── skip.js                   # Saltar (multi = PRO)
│   │   ├── queue.js                  # Ver cola
│   │   ├── nowplaying.js             # Pista actual
│   │   ├── stop.js                   # Detener y desconectar
│   │   ├── pause.js                  # Pausar/reanudar
│   │   └── musicstatus.js            # Estado nodos (owner)
│   ├── handlers/
│   │   └── musicInteractionHandler.js # Router de comandos
│   ├── utils/
│   │   ├── premiumResolver.js        # Resuelve tier desde MongoDB/Supabase
│   │   └── musicEmbeds.js           # Embeds de respuesta
│   └── config/
│       └── lavalinkConfig.js        # TIER_LIMITS y nodos
└── lavalink/
    ├── Lavalink.jar                 # Servidor Lavalink
    ├── application.yml              # Config PRO (puerto 80, 320kbps)
    ├── application-free.yml         # Config FREE (puerto 2334, 128kbps)
    ├── squarecloud.app              # Deploy PRO en Square Cloud
    └── squarecloud-free.app         # Deploy FREE en Square Cloud
```
