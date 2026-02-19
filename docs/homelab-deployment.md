# Homelab Deployment Guide

This guide covers deploying the Paper Bear scraper service to a Proxmox LXC container with Docker.

## Prerequisites

- Proxmox VE server
- Ubuntu 22.04+ LXC container
- Tailscale network access (optional but recommended)
- Turso database credentials from production database

## Initial Setup

### 1. Create LXC Container

In Proxmox web UI or CLI:
- **Template:** Ubuntu 22.04
- **Disk:** 12 GB minimum (Docker images are large)
- **RAM:** 2 GB
- **CPU:** 2 cores
- **Network:** Bridge to your network

Start container:
```bash
pct start <container-id>
```

### 2. Install Docker

SSH into container and run:
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Verify Docker is running:
```bash
docker --version
docker ps
```

### 3. Set up deployment directory

```bash
mkdir -p /opt/paper-bear
cd /opt/paper-bear
```

### 4. Clone repository

```bash
git clone https://github.com/jasonesanders/paper-bear.git .
```

Or deploy from local machine:
```bash
# From your dev machine
cd /path/to/paper-bear
rsync -avz --exclude node_modules --exclude .git . root@<container-ip>:/opt/paper-bear/
```

### 5. Create environment file

Create `/opt/paper-bear/.env.local`:
```bash
ASTRO_DB_REMOTE_URL=libsql://paper-bear-prod-[your-org].turso.io
ASTRO_DB_APP_TOKEN=[your-token]
NODE_ENV=production
```

**Important:** Keep `.env.local` secure - it contains production credentials.

### 6. Build and start Docker container

```bash
cd /opt/paper-bear
docker-compose up -d --build
```

Build takes ~5-10 minutes (Playwright installation is large).

Watch build progress:
```bash
docker-compose logs -f
```

### 7. Verify deployment

Check container health:
```bash
docker ps
```

Expected output:
```
CONTAINER ID   IMAGE                  STATUS                 PORTS
fd7ad0d87a35   paper-bear-scraper    Up 5 minutes (healthy) 0.0.0.0:4321->4321/tcp
```

Test health endpoint:
```bash
curl http://localhost:4321/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "paper-bear-scraper",
  "timestamp": "2026-02-19T05:00:00.000Z"
}
```

### 8. Set up cron job for automated scraping

```bash
cd /opt/paper-bear
bash scripts/setup-cron.sh
```

Verify cron is installed:
```bash
crontab -l
```

Expected:
```
# Paper Bear: Scrape events every 6 hours
5 */6 * * * curl -s -X POST http://localhost:4321/api/scrape >> /var/log/paper-bear/scrape.log 2>&1
```

## Testing

### Manual scrape test

Trigger a scrape manually:
```bash
curl -X POST http://localhost:4321/api/scrape
```

Wait 30-60 seconds for scraping to complete, then check logs:
```bash
tail -50 /var/log/paper-bear/scrape.log
```

### Check database

Connect to Turso from your local machine:
```bash
turso db shell paper-bear-prod "SELECT COUNT(*) FROM Event;"
```

Event count should increase after successful scrape.

## Maintenance

### View Docker logs

Real-time logs:
```bash
docker-compose logs -f
```

Last 100 lines:
```bash
docker-compose logs --tail=100
```

### Restart scraper

```bash
docker-compose restart
```

### Update deployment

Pull latest code and rebuild:
```bash
cd /opt/paper-bear
git pull origin main
docker-compose down
docker-compose up -d --build
```

### View scrape logs

```bash
tail -f /var/log/paper-bear/scrape.log
```

### Check cron execution

View cron service status:
```bash
systemctl status cron
```

Test cron entry manually:
```bash
curl -s -X POST http://localhost:4321/api/scrape >> /var/log/paper-bear/scrape.log 2>&1
```

## Troubleshooting

### Container won't start

Check Docker logs for errors:
```bash
docker-compose logs
```

Common issues:
- **Missing `.env.local`** → Create it with Turso credentials
- **Port 4321 in use** → Change port in `docker-compose.yml`
- **Out of disk space** → Increase LXC disk to 12GB+
- **Out of memory** → Increase RAM to 2GB

### Health check failing

Test manually:
```bash
curl http://localhost:4321/api/health
```

If connection refused:
- Container may still be starting (wait 30s)
- Check if process is running: `docker ps`
- Check server binding: should be `0.0.0.0:4321`

### Scraper not finding events

Check scrape logs in Turso:
```bash
turso db shell paper-bear-prod "SELECT * FROM ScrapeLog WHERE status = 'error' ORDER BY timestamp DESC LIMIT 5;"
```

Common issues:
- Venue website HTML structure changed (scraper needs update)
- Network timeout (check internet connectivity)
- Playwright browser crashed (check RAM usage)

### Cron job not running

Verify cron is active:
```bash
systemctl status cron
crontab -l
```

Check system logs:
```bash
grep CRON /var/log/syslog | tail -20
```

Reinstall cron job:
```bash
cd /opt/paper-bear
bash scripts/setup-cron.sh
```

## Security Notes

1. **`.env.local`** contains production credentials - never commit to git
2. **Scraper API** has no authentication - keep on internal network only
3. **Firewall** - Only expose port 4321 to trusted networks (Tailscale recommended)
4. **Turso token** - Use long-lived token with read/write permissions only

## Upgrading

### Update Astro or dependencies

```bash
cd /opt/paper-bear
npm update
git add package.json package-lock.json
git commit -m "chore: update dependencies"
docker-compose down
docker-compose up -d --build
```

### Expand disk space

If running out of space:
1. In Proxmox UI: Increase LXC disk size
2. In container: Resize filesystem
   ```bash
   df -h
   resize2fs /dev/<device>
   ```

## Monitoring

See [`monitoring.md`](monitoring.md) for health checks, alerts, and troubleshooting procedures.

## Cost

- **LXC Container:** $0 (self-hosted)
- **Electricity:** ~$1-2/month
- **Turso Free Tier:** 500 GB/month reads (sufficient)

**Total:** ~$1-2/month
