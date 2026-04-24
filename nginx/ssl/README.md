# SSL Certificates Directory

Place your SSL certificate files here when enabling HTTPS.

## With Certbot (recommended)

After Certbot issues the certificates, copy them into this directory:

```bash
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem     nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem        nginx/ssl/privkey.pem
cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem  nginx/ssl/api_fullchain.pem
cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem    nginx/ssl/api_privkey.pem
```

Then uncomment the HTTPS server blocks in `nginx/conf.d/default.conf` and rebuild:

```bash
docker compose up -d --build nginx
```

> **Note:** These files are excluded from version control (see `.gitignore`).
