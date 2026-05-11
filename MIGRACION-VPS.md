# Guia de Migracion a VPS - TON618

## Requisitos
- VPS con Ubuntu 22.04/24.04 (Contabo, Hetzner, OVH)
- 2 vCPU, 4GB RAM minimo (para bot + Lavalink + web)
- Dominio ton618bot.xyz

## 1. Comprar VPS
Recomendado: **Contabo VPS S** (~$5/mes) o **Hetzner CX21** (~$6/mes)

## 2. Conectar por SSH
```bash
ssh root@<IP-de-tu-VPS>
```

## 3. Instalar dependencias
```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Java 17 (requerido por Lavalink)
apt install -y openjdk-17-jre-headless

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2 y Git
npm install -g pm2
apt install -y git curl ufw

# Verificar versiones
java -version    # Debe ser 17+
node -v          # Debe ser 20+
```

## 4. Clonar repositorios
```bash
mkdir -p /opt/ton618 && cd /opt/ton618

# Bot principal
git clone https://github.com/Camilo0203/ton618-bot.git

# Bot de musica
git clone https://github.com/Camilo0203/ton618-music.git

# Web dashboard
git clone https://github.com/Camilo0203/ton618-web.git
```

## 5. Configurar Lavalink (en la VPS)
```bash
cd /opt/ton618/ton618-music/lavalink

# Descargar Lavalink.jar (si no esta en el repo)
wget https://github.com/lavalink-devs/Lavalink/releases/download/4.2.2/Lavalink.jar

# Usar config para VPS
cp application-vps.yml application.yml

# Iniciar Lavalink con PM2
pm2 start --name="lavalink" java -- -jar Lavalink.jar
```

## 6. Configurar .env del bot de musica
```bash
cd /opt/ton618/ton618-music
cp .env.example .env
nano .env
```

Variables clave:
```
LAVALINK_PRO_HOST=localhost
LAVALINK_PRO_PORT=2333
LAVALINK_PRO_PASSWORD=youshallnotpass
LAVALINK_PRO_SECURE=false

LAVALINK_FREE_HOST=localhost
LAVALINK_FREE_PORT=2333
LAVALINK_FREE_PASSWORD=youshallnotpass
LAVALINK_FREE_SECURE=false
```

## 7. Configurar .env del bot principal
```bash
cd /opt/ton618/ton618-bot
cp .env.example .env
nano .env
```

## 8. Configurar .env del web dashboard
```bash
cd /opt/ton618/ton618-web
cp .env.example .env
nano .env
```

## 9. Instalar dependencias e iniciar
```bash
# Bot de musica
cd /opt/ton618/ton618-music
npm install
pm2 start --name="ton618-music" npm -- start

# Bot principal
cd /opt/ton618/ton618-bot
npm install
pm2 start --name="ton618-bot" npm -- start

# Web dashboard
cd /opt/ton618/ton618-web
npm install
npm run build
pm2 start --name="ton618-web" npx -- serve -s dist -l 3000
```

## 10. Configurar firewall
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 2333/tcp    # Lavalink (solo si bot esta en otra maquina)
ufw allow 3000/tcp    # Web dashboard (o usa reverse proxy)
ufw enable
```

## 11. Configurar DNS
En tu proveedor de dominio (Cloudflare recomendado):
- `ton618bot.xyz` → A → IP de tu VPS
- `www.ton618bot.xyz` → CNAME → ton618bot.xyz
- `lavalink.ton618bot.xyz` → A → IP de tu VPS (opcional)

## 12. SSL con Caddy (recomendado)
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Crear `/etc/caddy/Caddyfile`:
```
ton618bot.xyz {
    reverse_proxy localhost:3000
}
```

```bash
systemctl reload caddy
```

## 13. Guardar configuracion PM2
```bash
pm2 save
pm2 startup systemd
```

## 14. Monitoreo
```bash
pm2 status          # Ver estado de todos los procesos
pm2 logs            # Ver logs en tiempo real
pm2 logs lavalink   # Ver logs de Lavalink
pm2 restart <name>  # Reiniciar un proceso
```

## Ventajas de la VPS vs Square Cloud
- YouTube funciona SIN plugins adicionales (IP limpia)
- No hay limites de apps
- Mas barato a largo plazo
- Control total del servidor
- SSL gratuito con Caddy
- Todo en una sola maquina

## Notas
- El Lavalink corre en la misma VPS, localhost:2333
- El bot y el web dashboard tambien en la misma VPS
- PM2 maneja auto-restart si algo falla
- Backups: configurar automaticos en Contabo/Hetzner
