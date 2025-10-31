#!/bin/bash

# Script to install SSL certificate with Let's Encrypt
# Run with sudo: sudo bash scripts/setup-ssl.sh

set -e

echo "==================================="
echo "Visual Neurons - SSL Setup"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "Error: Nginx is not running"
    echo "Run: sudo systemctl start nginx"
    exit 1
fi

# Install certbot
echo "Step 1: Installing certbot..."
apt update
apt install -y certbot python3-certbot-nginx

echo "✓ Certbot installed"
echo ""

# Get SSL certificate
echo "Step 2: Obtaining SSL certificate..."
echo ""
echo "IMPORTANT: Make sure visualneurons.com points to this server's IP!"
echo "You can check with: dig visualneurons.com"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled. Run this script again when DNS is ready."
    exit 0
fi

# Run certbot
certbot --nginx -d visualneurons.com -d www.visualneurons.com

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSL certificate obtained and configured!"
    echo ""
    echo "Testing automatic renewal..."
    certbot renew --dry-run
    
    if [ $? -eq 0 ]; then
        echo "✓ Auto-renewal is configured correctly"
    else
        echo "⚠ Auto-renewal test failed. Check certbot logs."
    fi
else
    echo ""
    echo "✗ Failed to obtain SSL certificate"
    echo "Common issues:"
    echo "  - DNS not pointing to this server"
    echo "  - Port 80 not open in security group"
    echo "  - Nginx not running"
    exit 1
fi

echo ""
echo "==================================="
echo "SSL setup complete!"
echo "==================================="
echo ""
echo "Your site is now available at:"
echo "  https://visualneurons.com"
echo ""
echo "Certificates will auto-renew via cron."
echo ""

