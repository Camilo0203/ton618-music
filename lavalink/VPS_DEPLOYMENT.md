# Guía de Despliegue Lavalink en VPS con Proxy Residencial

## Requisitos
- VPS con Ubuntu 20.04+ (Contabo/Hetzner recomendado)
- Proxy residencial estático de IPRoyal (~$2-3/mes)
- Java 17+ instalado

## 1. Comprar Proxy IPRoyal
1. Ve a [iproyal.com](https://iproyal.com)
2. Regístrate y compra "Residential Static Proxies"
3. Selecciona:
   - **Cantidad:** 1 IP
   - **Duración:** 1 mes
   - **País:** US o EU (mejor para YouTube)
4. Copia las credenciales:
   - Host (ej: proxy.iproyal.com)
   - Puerto (ej: 12321)
   - Username
   - Password

## 2. Instalar Java en VPS
```bash
sudo apt update
sudo apt install -y openjdk-17-jre-headless
java -version
```

## 3. Crear usuario lavalink
```bash
sudo useradd -r -s /bin/false lavalink
sudo mkdir -p /opt/lavalink
sudo chown lavalink:lavalink /opt/lavalink
```

## 4. Subir archivos a VPS
Sube estos archivos a `/opt/lavalink/`:
- `Lavalink.jar` (descargar de [GitHub Releases](https://github.com/lavalink-devs/Lavalink/releases))
- `application-vps.yml` (renombrar a `application.yml`)
- `lavalink.service`

```bash
# Desde tu local
scp Lavalink.jar root@tu-vps-ip:/opt/lavalink/
scp application-vps.yml root@tu-vps-ip:/opt/lavalink/application.yml
scp lavalink.service root@tu-vps-ip:/etc/systemd/system/
```

## 5. Configurar credenciales del proxy
Edita `/etc/systemd/system/lavalink.service`:
```bash
sudo nano /etc/systemd/system/lavalink.service
```
Reemplaza las variables del proxy con tus credenciales de IPRoyal:
```ini
Environment="PROXY_HOST=tu-proxy-host.iproyal.com"
Environment="PROXY_PORT=tu-puerto"
Environment="PROXY_USER=tu-username"
Environment="PROXY_PASSWORD=tu-password"
```

## 6. Configurar Spotify (opcional)
Para Spotify premium, obtén credenciales en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
1. Crea una app
2. Copia Client ID y Client Secret
3. Agrega en el servicio:
```ini
Environment="SPOTIFY_CLIENT_ID=tu-client-id"
Environment="SPOTIFY_CLIENT_SECRET=tu-client-secret"
```

## 7. Habilitar e iniciar servicio
```bash
sudo systemctl daemon-reload
sudo systemctl enable lavalink
sudo systemctl start lavalink
sudo systemctl status lavalink
```

## 8. Verificar logs
```bash
sudo journalctl -u lavalink -f
```

## 9. Configurar firewall
```bash
sudo ufw allow 2333/tcp
sudo ufw reload
```

## 10. Conectar desde ton618-music
Actualiza `src/music/MusicManager.js` con la IP de tu VPS:
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

## Troubleshooting
- **YouTube bloqueado:** Verifica que el proxy esté activo en logs
- **Spotify sin audio:** Configura SPOTIFY_CLIENT_ID/SECRET
- **Conexión rechazada:** Verifica firewall (puerto 2333)
