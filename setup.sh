#!/bin/bash

# FindAnyMail Server Setup Script for Hetzner (Ubuntu 24.04)
# Run this as root on your VPS

set -e

echo "🚀 Starting detailed server setup..."

# 1. Update System & Install Basics
echo "📦 Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw

# 2. Install Node.js 20
echo "🟢 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install PM2
echo "pm2 Installing PM2 Process Manager..."
npm install -g pm2

# 4. Configure Firewall
echo "🔥 Configuring Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 25/tcp
ufw --force enable

# 5. Create App User & Directory
echo "👤 Creating app user..."
# Only create if doesn't exist
if ! id "findanymail" &>/dev/null; then
    adduser --disabled-password --gecos "" findanymail
    usermod -aG sudo findanymail
fi

# 6. Prepare Directory
mkdir -p /home/findanymail/app
chown -R findanymail:findanymail /home/findanymail/app

echo "✅ Server dependencies installed!"
echo "---------------------------------------------------"
echo "NEXT STEPS:"
echo "1. Switch to user:  su - findanymail"
echo "2. Clone your repo: git clone <YOUR_GITHUB_URL> app"
echo "3. Setup .env:      cp app/.env.example app/.env.local && nano app/.env.local"
echo "4. Install & Start: cd app && npm install && npm run build && pm2 start npm --name 'findanymail' -- start"
echo "5. Setup Domain:    Run 'certbot --nginx -d yourdomain.com' (once app is running)"
echo "---------------------------------------------------"
