#!/bin/bash
set -e

echo "=== Setting up cron job for Paper Bear scraper ==="

# Create log directory
mkdir -p /var/log/paper-bear
chmod 755 /var/log/paper-bear

# Add cron job (runs every 6 hours at :05 past the hour)
(crontab -l 2>/dev/null || echo "") | grep -v "paper-bear-scrape" > /tmp/crontab.tmp
echo "# Paper Bear: Scrape events every 6 hours" >> /tmp/crontab.tmp
echo "5 */6 * * * curl -s -X POST http://localhost:4321/api/scrape >> /var/log/paper-bear/scrape.log 2>&1" >> /tmp/crontab.tmp
crontab /tmp/crontab.tmp
rm /tmp/crontab.tmp

echo "=== Cron job installed ==="
echo "Schedule: Every 6 hours (00:05, 06:05, 12:05, 18:05)"
echo "View logs: tail -f /var/log/paper-bear/scrape.log"
echo ""
echo "Verify with: crontab -l"
