# Deploy Lavalink a VPS con GitHub Actions

## Configurar Secrets en GitHub

Ve a tu repositorio → Settings → Secrets and variables → Actions → New repository secret

Agrega estos secrets:

### Requeridos
- `VPS_HOST` - IP de tu VPS (ej: 123.45.67.89)
- `VPS_PASSWORD` - Contraseña root de tu VPS
- `PROXY_HOST` - Host del proxy IPRoyal (ej: proxy.iproyal.com)
- `PROXY_PORT` - Puerto del proxy (ej: 12321)
- `PROXY_USER` - Username del proxy IPRoyal
- `PROXY_PASSWORD` - Password del proxy IPRoyal

### Opcionales (Spotify Premium)
- `SPOTIFY_CLIENT_ID` - Client ID de Spotify Developer Dashboard
- `SPOTIFY_CLIENT_SECRET` - Client Secret de Spotify Developer Dashboard

## Trigger del Deploy

El workflow se ejecuta automáticamente cuando:
- Haces push a la rama `main` con cambios en `lavalink/**`
- O manualmente desde Actions tab → "Deploy Lavalink to VPS" → "Run workflow"

## Verificar Deploy

Después del deploy, verifica en la VPS:
```bash
ssh root@tu-vps-ip
systemctl status lavalink
journalctl -u lavalink -f
```

## Conectar desde ton618-music

Actualiza `src/music/MusicManager.js`:
```javascript
nodes: [
  {
    name: 'vps-pro',
    url: 'http://tu-vps-ip:2333',
    auth: 'youshallnotpass',
    secure: false
  }
]
```
