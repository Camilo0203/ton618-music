# Configuración Spotify para Lavalink

## Opción 1: Spotify Gratis (sin credenciales)
- Funciona para búsqueda y reproducción básica
- Limitaciones: 30 segundos de preview, sin playlists completas
- **No requiere configuración adicional**

## Opción 2: Spotify Premium (recomendado)
- Reproducción completa de tracks y playlists
- Requiere cuenta Spotify Premium

### Pasos para obtener credenciales:

1. **Ir a Spotify Developer Dashboard**
   - [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   - Inicia sesión con tu cuenta Spotify

2. **Crear una App**
   - Click en "Create App"
   - Nombre: "Lavalink ton618"
   - Descripción: "Music bot for Discord"
   - Redirect URI: `http://localhost:8888/callback`
   - Click "Create"

3. **Obtener credenciales**
   - Copia "Client ID"
   - Click "Settings" → "Client Secret" → "View Client Secret"
   - Copia "Client Secret"

4. **Configurar en Lavalink**
   Agrega en `lavalink.service` o como variables de entorno:
   ```bash
   export SPOTIFY_CLIENT_ID="tu-client-id"
   export SPOTIFY_CLIENT_SECRET="tu-client-secret"
   ```

5. **Reiniciar Lavalink**
   ```bash
   sudo systemctl restart lavalink
   ```

## Verificación
Reproduce un track de Spotify en tu bot:
```
/play spotify:track:4iV5W9uYEdYUVa79Axb7Rh
```

Si funciona, verás el track completo en el nowplaying.
