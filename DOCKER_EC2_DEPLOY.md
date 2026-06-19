# Docker EC2 Deployment

This setup runs the full app on one EC2 server with Docker Compose:

- `frontend`: Nginx serving the React build on port `80`
- `api`: Node/Express backend on the private Docker network
- `postgres`: PostgreSQL with a persistent Docker volume
- `uploads_data`: persistent resume uploads

## 1. EC2 Setup

Open inbound ports in the EC2 security group:

- `22` for SSH
- `80` for the web app

Install Docker and Compose plugin:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Configure Environment

Clone the repo and create the production env file:

```bash
git clone <repo-url>
cd RecruitLeadGen
cp .env.prod.example .env
```

Edit `.env`:

- Set `APP_URL` and `FRONTEND_URL` to your domain or EC2 public IP.
- Set strong `POSTGRES_PASSWORD`, `JWT_ASSESSMENT_SECRET`, and `JWT_ADMIN_SECRET`.
- Fill SMTP, Supabase, Google OAuth, and OpenAI values as required.
- Keep `VITE_API_URL=/api` for same-server deployment.

Important: if `POSTGRES_PASSWORD` is changed, update `DATABASE_URL` with the same password.

## 3. Build And Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f frontend
```

The app should be available at:

```text
http://YOUR_EC2_PUBLIC_IP
```

Backend health check:

```bash
curl http://YOUR_EC2_PUBLIC_IP/api/health
```

## 4. Update Deployment

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

The backend runs Prisma migrations automatically on container start.

## 5. Persistent Data

Docker volumes:

- `postgres_data`: database data
- `uploads_data`: uploaded resumes

Do not delete these volumes unless you want to wipe production data.

## 6. Useful Commands

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

## 7. HTTPS

For production HTTPS, put this EC2 instance behind:

- AWS Application Load Balancer with ACM certificate, or
- Cloudflare proxy, or
- Nginx/Certbot on host.

When HTTPS is enabled, update `.env`:

```env
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```
