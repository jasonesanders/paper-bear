#!/bin/bash
# Manual deployment script for Paper Bear to homelab LXC
# Run this script locally - it will deploy to root@100.113.50.67

set -e

HOMELAB_HOST="root@100.113.50.67"
DEPLOY_PATH="/opt/paper-bear"

echo "================================================"
echo "Paper Bear Homelab Deployment Script"
echo "================================================"
echo

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "ERROR: .env.local not found!"
    echo "Please create .env.local with ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN"
    exit 1
fi

# Test SSH connection
echo "Step 1: Testing SSH connection..."
if ! ssh $HOMELAB_HOST "echo 'SSH connection successful'"; then
    echo "ERROR: Cannot connect to $HOMELAB_HOST"
    echo "Please ensure SSH is configured correctly"
    exit 1
fi
echo "✓ SSH connection OK"
echo

# Check Docker installation
echo "Step 2: Checking Docker installation..."
if ! ssh $HOMELAB_HOST "which docker" >/dev/null 2>&1; then
    echo "Docker not found. Installing Docker..."
    ssh $HOMELAB_HOST "curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker"
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi
echo

# Create deployment directory
echo "Step 3: Creating deployment directory..."
ssh $HOMELAB_HOST "mkdir -p $DEPLOY_PATH"
echo "✓ Directory created: $DEPLOY_PATH"
echo

# Create tarball and deploy
echo "Step 4: Creating deployment tarball..."
git archive --format=tar.gz HEAD > /tmp/paper-bear-deploy.tar.gz
echo "✓ Tarball created"
echo

echo "Step 5: Copying files to homelab..."
scp /tmp/paper-bear-deploy.tar.gz $HOMELAB_HOST:$DEPLOY_PATH/
echo "✓ Files copied"
echo

echo "Step 6: Extracting on homelab..."
ssh $HOMELAB_HOST "cd $DEPLOY_PATH && tar -xzf paper-bear-deploy.tar.gz && rm paper-bear-deploy.tar.gz"
echo "✓ Files extracted"
echo

echo "Step 7: Copying environment variables..."
scp .env.local $HOMELAB_HOST:$DEPLOY_PATH/.env.local
echo "✓ Environment variables copied"
echo

echo "Step 8: Building and starting container (this will take 5-10 minutes)..."
ssh $HOMELAB_HOST "cd $DEPLOY_PATH && docker compose down 2>/dev/null || true && docker compose up -d --build"
echo "✓ Container build started"
echo

echo "Step 9: Waiting for container to be healthy (40 seconds)..."
sleep 45
echo

echo "Step 10: Checking deployment status..."
ssh $HOMELAB_HOST "docker ps | grep paper-bear"
echo

echo "Step 11: Testing health endpoint..."
if ssh $HOMELAB_HOST "curl -f http://localhost:4321/api/health" 2>/dev/null; then
    echo
    echo "================================================"
    echo "✓ DEPLOYMENT SUCCESSFUL!"
    echo "================================================"
    echo "Service is running at http://100.113.50.67:4321"
    echo "Health check: http://100.113.50.67:4321/api/health"
    echo
    echo "Useful commands:"
    echo "  View logs: ssh $HOMELAB_HOST 'cd $DEPLOY_PATH && docker compose logs -f'"
    echo "  Restart:   ssh $HOMELAB_HOST 'cd $DEPLOY_PATH && docker compose restart'"
    echo "  Stop:      ssh $HOMELAB_HOST 'cd $DEPLOY_PATH && docker compose down'"
    echo
else
    echo
    echo "WARNING: Health check failed. Container may still be starting."
    echo "Check logs with: ssh $HOMELAB_HOST 'cd $DEPLOY_PATH && docker compose logs'"
fi

# Cleanup
rm -f /tmp/paper-bear-deploy.tar.gz
