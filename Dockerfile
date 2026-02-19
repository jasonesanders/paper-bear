FROM mcr.microsoft.com/playwright:v1.57.0-jammy

# Build arguments for Astro DB
ARG ASTRO_DB_REMOTE_URL
ARG ASTRO_DB_APP_TOKEN

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy application code
COPY . .

# Build the application with environment variables
ENV ASTRO_DB_REMOTE_URL=$ASTRO_DB_REMOTE_URL
ENV ASTRO_DB_APP_TOKEN=$ASTRO_DB_APP_TOKEN
RUN npm run build -- --remote

# Expose port for scraper API
EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4321/api/health || exit 1

# Run the server
CMD ["node", "./dist/server/entry.mjs"]
