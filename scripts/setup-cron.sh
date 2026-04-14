#!/bin/bash
set -e

echo "=== Setting up cron job for Paper Bear scraper ==="

# Create log directory
mkdir -p /var/log/paper-bear
chmod 755 /var/log/paper-bear

# Ensure the scrape wrapper is executable
chmod +x /opt/paper-bear/scripts/scrape-cron.sh

# Add cron job (runs every 6 hours at :05 past the hour)
(crontab -l 2>/dev/null || echo "") | grep -iv "paper.bear\|api/scrape\|scrape-cron" > /tmp/crontab.tmp
echo "# Paper Bear: Scrape events nightly at 11pm Vancouver time" >> /tmp/crontab.tmp
echo "0 23 * * * /opt/paper-bear/scripts/scrape-cron.sh >> /var/log/paper-bear/scrape.log 2>&1" >> /tmp/crontab.tmp
crontab /tmp/crontab.tmp
rm /tmp/crontab.tmp

echo "=== Cron job installed ==="
echo "Schedule: Nightly at 11:00 PM Vancouver time"
echo "View logs: tail -f /var/log/paper-bear/scrape.log"
echo ""
echo "Verify with: crontab -l"
