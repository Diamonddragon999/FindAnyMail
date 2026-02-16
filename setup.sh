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

# 6. Prepare Directory & Clone App
echo "📂 Setting up app directory..."
mkdir -p /home/findanymail/app
chown -R findanymail:findanymail /home/findanymail

# Switch to user and install app
su - findanymail -c "
    echo '⬇️ Cloning repository...'
    git clone https://github.com/Diamonddragon999/FindAnyMail.git ~/app
    
    cd ~/app
    echo '📦 Installing dependencies...'
    npm install
    
    echo '⚙️ Setting up environment...'
    cp .env.example .env.local
    # Initialize with a random secret
    sed -i \"s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$(openssl rand -base64 32 | sed 's/[&/\]/\\&/g')/\" .env.local
    
    echo '🏗️ Building Next.js app...'
    npm run build
    
    echo '🚀 Starting app with PM2...'
    pm2 start npm --name 'findanymail' -- start
    pm2 save
"

# 7. Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/findanymail <<EOF
server {
    listen 80;
    server_name _;  # Accepts any domain/IP for now

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/findanymail /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# 8. Setup PM2 Startup (needs root)
echo "🔄 Configuring PM2 to start on boot..."
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u findanymail --hp /home/findanymail
systemctl start pm2-findanymail

echo "✅ Deployment Complete!"
echo "---------------------------------------------------"
echo "👉 NEXT STEPS:"
echo "1. Edit your .env.local file to add your API keys:"
echo "   nano /home/findanymail/app/.env.local"
echo "2. Restart the app after editing:"
echo "   pm2 restart findanymail"
echo "3. Setup configured domain (once DNS points here):"
echo "   certbot --nginx -d yourdomain.com"
echo "---------------------------------------------------"
