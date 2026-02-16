#!/bin/bash
set -e

# Configuration
APP_DIR="/home/findanymail/app"
USER="findanymail"

echo "🚀 Starting Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (or use sudo)"
  exit 1
fi

# Execute deployment steps as the application user
sudo -u $USER bash <<EOF
set -e
cd $APP_DIR

echo "📥 Pulling latest code from GitHub..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building Next.js application..."
npm run build

echo "🔄 Restarting Service..."
pm2 restart findanymail

echo "✅ Deployment Successful!"
EOF
