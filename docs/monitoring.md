# Monitoring Paper Bear

This guide covers monitoring, health checks, and troubleshooting for the Paper Bear production deployment.

## System Overview

Paper Bear runs in a **hybrid architecture**:
- **GitHub Pages:** Static site rebuilt daily at midnight Vancouver time
- **Homelab LXC:** Docker container running scraper service
- **Turso Cloud:** Shared libSQL database

## GitHub Pages Monitoring

### Check deployment status

View workflow runs:  
https://github.com/jasonesanders/paper-bear/actions

Workflow: **"Deploy to GitHub Pages"**  
Schedule: Daily at 8:00 AM UTC (midnight Vancouver time)

### Manual rebuild

1. Go to [Actions tab](https://github.com/jasonesanders/paper-bear/actions)
2. Select "Deploy to GitHub Pages"
3. Click "Run workflow" → "Run workflow"

### Verify site is live

```bash
curl -I https://jasonesanders.github.io/paper-bear/
```

Expected: `HTTP/2 200`

### Check if CSS loads

```bash
curl -I https://jasonesanders.github.io/paper-bear/_astro/index.*.css
```

Expected: `HTTP/2 200`

## Homelab Scraper Monitoring

### Health check

From any machine with Tailscale access:
```bash
curl http://100.113.50.67:4321/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "paper-bear-scraper",
  "timestamp": "2026-02-19T05:00:00.000Z"
}
```

### Check Docker container status

```bash
ssh root@100.113.50.67 "docker ps"
```

Look for:
- Container `paper-bear-scraper` is running
- Status shows `Up X minutes (healthy)`
- Port `0.0.0.0:4321->4321/tcp` is bound

### View scraper logs

Real-time logs:
```bash
ssh root@100.113.50.67 "docker-compose -f /opt/paper-bear/docker-compose.yml logs -f"
```

Recent logs (last 50 lines):
```bash
ssh root@100.113.50.67 "docker-compose -f /opt/paper-bear/docker-compose.yml logs --tail=50"
```

### View cron scrape logs

```bash
ssh root@100.113.50.67 "tail -50 /var/log/paper-bear/scrape.log"
```

### Check cron schedule

```bash
ssh root@100.113.50.67 "crontab -l"
```

Expected:
```
# Paper Bear: Scrape events every 6 hours
5 */6 * * * curl -s -X POST http://localhost:4321/api/scrape >> /var/log/paper-bear/scrape.log 2>&1
```

Next run times: 00:05, 06:05, 12:05, 18:05 (server local time)

## Turso Database Monitoring

### Connect to database

```bash
turso db shell paper-bear-prod
```

### Check event count

```sql
SELECT COUNT(*) as total_events FROM Event;
```

Expected: 150-200 events (varies by season)

### Events by venue

```sql
SELECT 
  v.name,
  COUNT(e.id) as event_count,
  MAX(e.createdAt) as latest_event
FROM Venue v
LEFT JOIN Event e ON v.id = e.venueId
WHERE v.enabled = 1
GROUP BY v.id
ORDER BY event_count DESC;
```

Expected output:
```
NAME                 EVENT COUNT  LATEST EVENT
Fox Cabaret          60           2026-02-19T04:30:00
Rickshaw Theatre     55           2026-02-19T04:30:00
Rio Theatre          45           2026-02-19T04:30:00
```

### Recent scrapes

```sql
SELECT 
  v.name,
  sl.timestamp,
  sl.status,
  sl.itemsFound,
  sl.durationMs
FROM ScrapeLog sl
JOIN Venue v ON sl.venueId = v.id
ORDER BY sl.timestamp DESC
LIMIT 10;
```

### Failed scrapes (last 24 hours)

```sql
SELECT 
  v.name,
  sl.timestamp,
  sl.errorMessage
FROM ScrapeLog sl
JOIN Venue v ON sl.venueId = v.id
WHERE sl.status = 'error'
  AND sl.timestamp > datetime('now', '-1 day')
ORDER BY sl.timestamp DESC;
```

### Active venues

```sql
SELECT id, name, enabled, lastScrapedAt 
FROM Venue 
WHERE enabled = 1 
ORDER BY name;
```

## Troubleshooting

### GitHub Pages not updating

**Symptoms:** Site shows old events, workflow succeeded but no visible changes

**Diagnosis:**
1. Check workflow logs for build errors
2. Verify Turso secrets are set correctly in GitHub
3. Check if database has recent events

**Fix:**
```bash
# Verify Turso credentials locally
export ASTRO_DB_REMOTE_URL="libsql://..."
export ASTRO_DB_APP_TOKEN="..."
npm run astro db push -- --remote

# If push succeeds, trigger manual rebuild
# Go to GitHub Actions → Run workflow
```

### Scraper container not running

**Symptoms:** `docker ps` shows no container or unhealthy status

**Diagnosis:**
```bash
ssh root@100.113.50.67 "docker-compose -f /opt/paper-bear/docker-compose.yml logs"
```

**Common issues:**
- Missing `.env.local` → Create with Turso credentials
- Port 4321 in use → Kill conflicting process or change port
- Out of memory → Increase container RAM to 2GB
- Playwright installation failed → Rebuild image

**Fix:**
```bash
ssh root@100.113.50.67 "cd /opt/paper-bear && docker-compose down && docker-compose up -d"
```

### No new events being scraped

**Symptoms:** Database event count not increasing, scrape logs show 0 items found

**Diagnosis:**
1. Check ScrapeLog for errors:
   ```sql
   SELECT * FROM ScrapeLog 
   WHERE status = 'error' 
   ORDER BY timestamp DESC 
   LIMIT 5;
   ```

2. Test scraper manually:
   ```bash
   ssh root@100.113.50.67 "curl -X POST http://localhost:4321/api/scrape"
   ```

3. Check venue websites are accessible:
   - https://rickshawtheatre.com/shows/
   - https://riotheatretickets.ca/events/
   - https://foxcabaret.com/calendar/

**Common issues:**
- Venue changed HTML structure → Scraper needs update
- Venue website is down → Wait and retry
- Network timeout → Check internet connectivity
- Playwright browser crash → Check RAM usage

**Fix:**
If HTML structure changed, update scraper in `src/lib/venues/<venue>.ts` and redeploy.

### Cron job not running

**Symptoms:** No entries in `/var/log/paper-bear/scrape.log`, or timestamps are old

**Diagnosis:**
```bash
ssh root@100.113.50.67 "crontab -l"
ssh root@100.113.50.67 "systemctl status cron"
ssh root@100.113.50.67 "grep CRON /var/log/syslog | tail -20"
```

**Fix:**
```bash
ssh root@100.113.50.67 "cd /opt/paper-bear && bash scripts/setup-cron.sh"
```

### High memory usage

**Symptoms:** Container becomes slow or crashes, OOM errors in logs

**Diagnosis:**
```bash
ssh root@100.113.50.67 "docker stats paper-bear-scraper"
```

**Fix:**
1. Increase container RAM limit in `docker-compose.yml`:
   ```yaml
   mem_limit: 4g  # Increase from 2g
   ```

2. Restart container:
   ```bash
   ssh root@100.113.50.67 "cd /opt/paper-bear && docker-compose down && docker-compose up -d"
   ```

### Database connection errors

**Symptoms:** Scraper logs show "ECONNREFUSED" or "unauthorized" errors

**Diagnosis:**
```bash
ssh root@100.113.50.67 "cat /opt/paper-bear/.env.local"
```

**Fix:**
Verify Turso credentials are correct:
```bash
# Test connection from local machine
turso db shell paper-bear-prod "SELECT COUNT(*) FROM Venue;"
```

If credentials are wrong, regenerate token:
```bash
turso db tokens create paper-bear-prod -e none
```

Update `.env.local` on homelab and restart container.

## Alerts & Notifications

**Recommended monitoring setup:**

### UptimeRobot or Healthchecks.io

Monitor these endpoints:
- `https://jasonesanders.github.io/paper-bear/` (every 5 minutes)
- `http://100.113.50.67:4321/api/health` (every 5 minutes, via Tailscale)

Alert on:
- HTTP status != 200
- Response time > 5 seconds
- 3+ consecutive failures

### GitHub Actions

Enable notifications for workflow failures:
1. Go to repository Settings → Notifications
2. Enable "Actions" notifications
3. Choose email or Slack webhook

### Turso Dashboard

Monitor database usage:
1. Visit https://turso.tech/app
2. Check read/write metrics
3. Set up alerts for:
   - Read quota > 400 GB/month
   - Write quota > 1 GB/month
   - High error rates

## Performance Metrics

### Typical values

| Metric | Expected Value |
|--------|----------------|
| GitHub Pages load time | < 1 second |
| Scraper health check | < 100ms |
| Single venue scrape | 5-15 seconds |
| Full scrape (3 venues) | 20-45 seconds |
| Database query time | < 50ms |
| Docker container RAM | 500-800 MB |
| Docker container CPU | < 10% (idle), 50-80% (scraping) |

### When to investigate

- GitHub Pages load time > 3 seconds → Check CDN/GitHub status
- Scraper response time > 500ms → Check container CPU/RAM
- Full scrape > 2 minutes → Check network or venue website issues
- Container RAM > 1.5 GB → Memory leak, restart container

## Regular Maintenance

### Daily
- ✅ Automated (no action needed):
  - GitHub Actions rebuilds site at midnight
  - Cron runs scraper every 6 hours

### Weekly
- Check scrape logs for errors: `tail -100 /var/log/paper-bear/scrape.log`
- Verify event counts are reasonable (50-70 events per venue)

### Monthly
- Review GitHub Actions usage (check quota)
- Review Turso database usage (check quota)
- Update dependencies: `npm update` and rebuild
- Check disk space on LXC: `df -h`

### Quarterly
- Update Playwright to latest version
- Review and remove old events: `DELETE FROM Event WHERE date < datetime('now', '-3 months');`
- Backup database: `turso db shell paper-bear-prod .dump > backup.sql`

## Emergency Contacts

- **GitHub Actions issues:** Check [GitHub Status](https://www.githubstatus.com/)
- **Turso issues:** Check [Turso Status](https://turso.tech/status)
- **Homelab issues:** Physical access required or Tailscale support
