# Deployment Guide – Rentals Platform

This guide explains how to deploy the entire stack (Angular SSR frontend, .NET API, PostgreSQL) on a Linux VPS using Docker Compose and Nginx.

---

## Prerequisites

| Resource | Minimum |
|----------|---------|
| RAM | 4 GB |
| CPU | 2 vCPU |
| Disk | 20 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Software | Docker Engine + Docker Compose plugin |

Recommended providers: **Hetzner Cloud CX22** (~€5/mo), **DigitalOcean Droplet**, **Linode**, **Vultr**, **AWS Lightsail**.

---

## Step 1 – Initial Server Setup

SSH into your VPS as root (or a sudo user), then run:

```bash
# Update OS packages
apt update && apt upgrade -y

# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# (Recommended) Create a non-root deploy user
adduser deploy
usermod -aG docker deploy

# Open required firewall ports
ufw allow 22     # SSH
ufw allow 80     # HTTP
ufw allow 443    # HTTPS
ufw enable
```

---

## Step 2 – Clone the Repository

```bash
git clone https://github.com/elfadaly88/appartment-rental.git
cd appartment-rental
```

---

## Step 3 – Configure Environment Variables

All secrets are loaded from a `.env` file that is **never** committed to Git.

```bash
cp .env.example .env
nano .env   # or use your preferred editor
```

Fill in **all** required values in `.env`:

| Variable | Where to get it |
|---|---|
| `POSTGRES_PASSWORD` | Choose a strong password |
| `JWT_SECRET_KEY` | Run: `openssl rand -base64 64` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | [Facebook Developers](https://developers.facebook.com/) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Run: `npx web-push generate-vapid-keys` |
| `PAYMOB_*` | [Paymob Dashboard](https://accept.paymob.com/) |
| `CLOUDINARY_*` | [Cloudinary Console](https://cloudinary.com/console) |
| `MAPBOX_ACCESS_TOKEN` | [Mapbox Account](https://account.mapbox.com/) |
| `PUBLIC_API_URL` | `http://YOUR_VPS_IP/api` (update after getting a domain) |
| `PUBLIC_HUB_URL` | `http://YOUR_VPS_IP/hubs/notifications` |

---

## Step 4 – Configure Nginx

Edit `nginx/conf.d/default.conf` and replace `YOUR_DOMAIN_OR_IP` with your actual VPS IP address or domain name:

```bash
nano nginx/conf.d/default.conf
```

For an IP-only setup (no domain), you can simplify to a single `server` block and proxy `/api` to the backend:

```nginx
server {
    listen 80;
    server_name _;   # match any

    location /api/ {
        proxy_pass http://backend-api:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /hubs/ {
        proxy_pass http://backend-api:8080/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://frontend-pwa:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Step 5 – Build and Start the Stack

```bash
docker compose up -d --build
```

This will:
1. Pull the PostgreSQL image
2. Build the .NET 10 API image
3. Build the Angular SSR image
4. Start Nginx as a reverse proxy
5. Wire everything together via Docker networking

Check that all containers are running:

```bash
docker compose ps
```

Access the app:

| Service | URL |
|---|---|
| Frontend | `http://YOUR_VPS_IP` |
| API | `http://YOUR_VPS_IP/api` |

---

## Step 6 (Optional) – Enable HTTPS with Certbot

> Requires a domain name pointing to your VPS.

```bash
# Install Certbot on the host (NOT inside Docker)
apt install certbot -y

# Stop Nginx container temporarily so Certbot can bind port 80
docker compose stop nginx

# Issue certificates
certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Copy certificates into the nginx/ssl directory
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem  nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem     nginx/ssl/privkey.pem
cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/api_fullchain.pem
cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem   nginx/ssl/api_privkey.pem
```

Uncomment the HTTPS server blocks in `nginx/conf.d/default.conf`, then update your `.env`:

```
PUBLIC_API_URL=https://api.yourdomain.com/api
PUBLIC_HUB_URL=https://api.yourdomain.com/hubs/notifications
PAYMOB_CHECKOUT_RETURN_URL=https://yourdomain.com/checkout/callback
```

Restart the stack:

```bash
docker compose up -d --build
```

Set up automatic certificate renewal:

```bash
# Test renewal
certbot renew --dry-run

# Add a cron job (runs twice daily)
# Replace /home/deploy/appartment-rental with the actual clone path
DEPLOY_DIR=/home/deploy/appartment-rental   # adjust if deploying as root: /root/appartment-rental
(crontab -l 2>/dev/null; echo "0 3,15 * * * certbot renew --quiet && docker compose -f ${DEPLOY_DIR}/docker-compose.yml restart nginx") | crontab -
```

---

## Useful Commands

```bash
# View running containers
docker compose ps

# Follow logs for a specific service
docker compose logs -f backend-api
docker compose logs -f frontend-pwa
docker compose logs -f nginx

# Restart a single service
docker compose restart backend-api

# Stop and remove all containers (data persisted in volumes)
docker compose down

# Stop and remove containers + delete all data volumes
docker compose down -v

# Rebuild and restart after code changes
docker compose up -d --build

# Open a shell inside the API container
docker exec -it rentals-backend-api bash

# Open a psql shell
docker exec -it rentals-postgres psql -U rentals_user -d rentalsdb
```

---

## Environment Variable Reference

See [`.env.example`](.env.example) for the full list of variables with descriptions.
