# Deployment Plan

## Prerequisites
- VPS (Ubuntu 22.04+, 4GB RAM minimum)
- Docker & Docker Compose installed
- Domain with DNS pointing to VPS
- SMTP credentials (or Resend API key)

## Environment Variables

See `.env.example` at project root.

## Deployment Steps

### 1. Clone & Configure
```bash
git clone <repo> /opt/hurix-talent
cd /opt/hurix-talent
cp .env.example .env
# Edit .env with production values
```

### 2. Build Sandbox Images
```bash
./scripts/build-sandbox-images.sh
```

### 3. Start Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Run Migrations & Seed
```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

### 5. SSL with Certbot
```bash
certbot --nginx -d assessment.hurixdigital.com
```

## Services (Docker Compose)

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy |
| frontend | 3000 (internal) | React static |
| api | 4000 (internal) | Express API |
| postgres | 5432 (internal) | Database |

## Nginx Configuration
- `/` → frontend
- `/api` → api:4000
- SSL termination at Nginx
- Gzip compression enabled

## Backup Strategy
- **Database:** Daily `pg_dump` via cron → `/backups/`
- **Resumes:** Sync `uploads/` to S3 (future) or rsync to backup server
- **Retention:** 30 days daily, 12 monthly

## Logging Strategy
- API: Winston JSON logs → stdout → Docker logs
- Nginx: access + error logs
- Log rotation via Docker log driver (`max-size: 10m, max-file: 3`)

## Monitoring Strategy
- Health checks: `/health`, `/ready` polled every 30s
- Uptime monitoring (UptimeRobot / Pingdom)
- Disk space alerts on VPS
- Future: Prometheus + Grafana, Sentry for errors

## Production Checklist
- [ ] Strong JWT_SECRET and ADMIN_JWT_SECRET
- [ ] Change default admin password
- [ ] SMTP configured and tested
- [ ] SSL certificate active
- [ ] Firewall: only 80, 443 open
- [ ] Database backups scheduled
- [ ] Sandbox images built
