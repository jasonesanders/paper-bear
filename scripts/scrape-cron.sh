#!/bin/bash
# Paper Bear scrape trigger — run by cron on the LXC host.
#
# Reads SCRAPE_SECRET from the project .env file so the host cron environment
# doesn't need it as a shell variable.  Uses GET (the correct HTTP method for
# /api/scrape) and passes the required X-Scrape-Token header.

set -e

ENV_FILE="/opt/paper-bear/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found" >&2
    exit 1
fi

SCRAPE_SECRET=$(grep -E '^SCRAPE_SECRET=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$SCRAPE_SECRET" ]; then
    echo "ERROR: SCRAPE_SECRET not set in $ENV_FILE" >&2
    exit 1
fi

curl -s -H "X-Scrape-Token: ${SCRAPE_SECRET}" http://localhost:4321/api/scrape
