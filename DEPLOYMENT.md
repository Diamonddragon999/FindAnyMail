# Simple Deployment Guide (Hetzner CX32)

Follow these exact steps. It will take ~10 minutes.

## Step 1: Request Port 25 Access (Do this FIRST)

1. Log in to [Hetzner Cloud Console](https://console.hetzner.cloud).
2. Go to **Support** → **Create Request**.
3. Select **Limit Request** or **Technical Support**.
4. Paste this exact message:

> Subject: Unblock Port 25 for Email Verification Tool
>
> Hello,
> I am deploying an email verification tool (FindAnyMail) on my server.
> I need outbound port 25 access to verify if email addresses exist by connecting to mail servers.
> I will NOT be sending any emails or marketing. I only perform RCPT TO checks to validate contacts.
> Please unblock port 25 for my new server.
> Thank you.

*Wait for their email approval (usually takes a few hours).*

## Step 2: Create the Server

While waiting for approval, create the server:

1. **Project:** Create new project "EmailFinder"
2. **Location:** Falkenstein or Nuremberg (Germany)
3. **Image:** **Ubuntu 24.04** (Important: select generic Ubuntu, not an "app")
4. **Type:** **Standard** → **CX32** (2 vCPU, 8GB RAM) - good choice!
5. **SSH Key:** Add your computer's SSH key (or create one if you don't have it).
6. **Name:** `findanymail-production`
7. Click **Create & Buy**.

## Step 3: Put Your Code on GitHub

Yes, GitHub is the easiest way to move code.

1. Create a **Private Repository** on GitHub named `findanymail`.
2. On your local computer (in VS Code terminal):
   ```bash
   # Initialize git if not already done
   git init
   git add .
   git commit -m "Initial commit"
   
   # Link to GitHub (replace USERNAME with yours)
   git branch -M main
   git remote add origin https://github.com/USERNAME/findanymail.git
   git push -u origin main
   ```

## Step 4: Configure the Server (The Easy Way)

I made a script (`setup.sh`) to do the hard work.

1. SSH into your new server (you'll get the IP in Hetzner dashboard):
   ```bash
   ssh root@<YOUR_SERVER_IP>
   ```

2. Run these commands to setup everything automatically:
   ```bash
   # Download the setup script from your repo (or copy-paste it)
   # Since code isn't there yet, just copy-paste the contents of setup.sh into a file:
   nano setup.sh
   # (Paste the contents of setup.sh here, then Ctrl+O to save, Ctrl+X to exit)
   
   # Run it
   bash setup.sh
   ```

## Step 5: Install the App

The script told you what to do next. Do this:

1. Switch to the app user:
   ```bash
   su - findanymail
   ```

2. Download your code:
   ```bash
   # You'll need a GitHub token or SSH key here if repo is private
   git clone https://github.com/USERNAME/findanymail.git app
   cd app
   ```

3. Setup your secrets:
   ```bash
   cp .env.example .env.local
   nano .env.local
   # Fill in: NEXTAUTH_SECRET, ADMIN_PASSWORD, API_KEY
   # Ctrl+O to save, Ctrl+X to exit
   ```

4. Build and Start:
   ```bash
   npm install
   npm run build
   pm2 start npm --name "findanymail" -- start
   pm2 save
   ```

5. **Final Step (Domain/SSL):**
   *   Switch back to root: `exit`
   *   Point your domain (e.g., `tool.yourdomain.com`) to the server IP in your DNS.
   *   Run: `certbot --nginx -d tool.yourdomain.com`

**Done!** visit `https://tool.yourdomain.com`
