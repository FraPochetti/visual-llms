#!/bin/bash

# Script to install and configure nginx for Visual Neurons
# Run with sudo: sudo bash scripts/setup-nginx.sh

set -e

echo "==================================="
echo "Visual Neurons - Nginx Setup"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Install nginx
echo "Step 1: Installing nginx..."
apt update
apt install -y nginx

echo "✓ Nginx installed"
echo ""

# Copy nginx configuration
echo "Step 2: Configuring nginx..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cp "$SCRIPT_DIR/nginx-config.conf" /etc/nginx/sites-available/visualneurons

echo "✓ Configuration file copied"
echo ""

# Enable the site
echo "Step 3: Enabling site..."
ln -sf /etc/nginx/sites-available/visualneurons /etc/nginx/sites-enabled/visualneurons

# Remove default nginx site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    echo "✓ Removed default nginx site"
fi

echo "✓ Site enabled"
echo ""

# Test nginx configuration
echo "Step 4: Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Configuration is valid"
    echo ""
else
    echo "✗ Configuration has errors"
    exit 1
fi

# Restart nginx
echo "Step 5: Restarting nginx..."
systemctl restart nginx
systemctl enable nginx

echo "✓ Nginx restarted and enabled"
echo ""

echo "==================================="
echo "Nginx setup complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Make sure your DNS (Route53) points visualneurons.com to this server's IP"
echo "2. Wait a few minutes for DNS to propagate"
echo "3. Run: sudo bash scripts/setup-ssl.sh"
echo ""

