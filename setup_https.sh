#!/bin/bash
set -e

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

DOMAIN=$1

# Prompt for domain if not provided
if [ -z "$DOMAIN" ]; then
    echo "Enter the domain name you want to use (e.g., findanymail.com):"
    read -p "> " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name is required."
    exit 1
fi

echo "🔧 Configuring Nginx for domain: $DOMAIN..."

# Backup config
cp /etc/nginx/sites-available/findanymail /etc/nginx/sites-available/findanymail.bak

# Update server_name in Nginx config
# We look for 'server_name _;' and replace it with 'server_name domain.com;'
if grep -q "server_name _;" /etc/nginx/sites-available/findanymail; then
    sed -i "s/server_name _;/server_name $DOMAIN;/g" /etc/nginx/sites-available/findanymail
else
    # Check if it was already set to something else, or just append it?
    # Safer to just warn if not found, but likely it is there from setup.sh
    echo "⚠️  Could not find 'server_name _;' in config. Please manually check /etc/nginx/sites-available/findanymail"
    echo "Proceeding to Certbot anyway..."
fi

# Test configuration
echo "SEARCHING..."
nginx -t

# Reload Nginx to apply server_name change
systemctl reload nginx

echo "🔒 Requesting SSL Certificate via Certbot..."
echo "You will be asked to enter an email address for renewal notices."
certbot --nginx -d $DOMAIN

echo ""
echo "✅ HTTPS Setup Complete!"
echo "👉 Your app should now be accessible at https://$DOMAIN"
