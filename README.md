# Visual Neurons

A complete creative AI platform with **image and video generation**: **Imagen 4** for high-fidelity images, **Nano Banana**, **Qwen Image Edit Plus**, **SeedEdit 3.0**, and **Seedream 4** for creative editing, and **Veo 3.1** for cinematic video generation with audio. Create, edit, and generate through natural language chat.

**Tech Stack:** Next.js 15 • React 19 • TypeScript • Tailwind CSS • Prisma • SQLite • Replicate API

**Status:** ✅ Fully functional and production-ready with AWS Cognito authentication!

---

## 📖 Table of Contents

1. [Quick Start (Local Development)](#-quick-start-local-development)
2. [Production Deployment](#-production-deployment)
3. [How It Works (Architecture)](#-how-it-works-architecture)
4. [Using the App](#-using-the-app)
5. [Commands Reference](#-commands-reference)
6. [Troubleshooting](#-troubleshooting)
7. [Features & Models](#-features--models)

---

## 🚀 Quick Start (Local Development)

For local development without authentication:

### 1. Add Your Replicate API Key

```bash
# Edit the .env file
nano .env

# Add your key:
REPLICATE_API_KEY=your_actual_key_here

# Save: Ctrl+X, then Y, then Enter
```

Get your API key: https://replicate.com/account/api-tokens

### 2. Start the Server

```bash
npm run dev
```

### 3. Open the App

- **Local:** http://localhost:3000
- **Remote:** http://YOUR_EC2_IP:3000

> ⚠️ Make sure port 3000 is open in your AWS Security Group for remote access

---

## 🔐 Production Deployment

Complete guide to deploy Visual Neurons to **visualneurons.com** with AWS Cognito authentication, nginx, and SSL.

### Prerequisites

Before you start, you'll need:
- ✅ AWS Account with Cognito access
- ✅ EC2 instance running Ubuntu
- ✅ Domain name (e.g., `visualneurons.com`) in Route53
- ✅ AWS CLI configured on EC2
- ✅ EC2 Public IP address

---

### Step 1: AWS Cognito Setup ⚙️

**Create User Pool:**

1. Go to [AWS Console → Cognito → User Pools](https://console.aws.amazon.com/cognito/users/)
2. Click **"Create user pool"**
3. Configure as follows:

   **Authentication providers:**
   - Sign-in options: ✅ **Username only** (uncheck email)

   **Security requirements:**
   - Password policy: Default
   - MFA: **No MFA**

   **Sign-up experience:**
   - ⚠️ **CRITICAL:** Self-registration: **DISABLED**

   **Message delivery:**
   - Skip (not needed)

   **Integrate your app:**
   - User pool name: `visual-neurons-users`
   - App client name: `visual-neurons-web`
   - Client secret: **Don't generate** ⚠️ (IMPORTANT!)
   - Authentication flows: ✅ **ALLOW_USER_PASSWORD_AUTH**, ✅ **ALLOW_REFRESH_TOKEN_AUTH**

4. Click **"Create user pool"**

5. **Copy these values:**
   - User Pool ID: (looks like `us-east-1_XXXXXXXXX`)
   - Region: (e.g., `us-east-1`)
   - App Client ID: (under "App integration" tab)

**Important Note about Client Secret:**
- If you accidentally create an app client WITH a client secret, you'll get errors like `SECRET_HASH was not received`
- Solution: Create a new app client (go to App Integration → Create app client) and select **"Single-page application (SPA)"** type
- This ensures no client secret is generated

---

### Step 2: Configure Environment Variables 📝

```bash
cd /home/ubuntu/visual-llms
cp .env.example .env
nano .env
```

Add your Cognito values from Step 1:

```bash
REPLICATE_API_KEY=your_existing_replicate_key

NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_COGNITO_REGION=us-east-1

# Optional: Enable for persistent video generation
WEBHOOK_BASE_URL=https://visualneurons.com
```

Save and exit (Ctrl+X, Y, Enter)

---

### Step 3: Start the App with Screen 🚀

**Simple Development Setup (Perfect for single-user):**

This runs `npm run dev` in a screen session, giving you:
- ✅ Instant hot reload - no rebuilding needed!
- ✅ All logs in one place - just like running locally
- ✅ See code changes immediately
- ✅ Stays running even when you disconnect

```bash
cd /home/ubuntu/visual-llms

# Start the app in a screen session
screen -dmS visualneurons npm run dev

# Verify it's running
screen -ls
curl http://localhost:3000
```

**That's it!** The app is now running on `localhost:3000`

**Note:** No need to run `npm run build` when you make changes! Just edit your code and refresh the browser.

---

### Step 4: Configure AWS Route53 🌐

1. Go to [Route53 Console](https://console.aws.amazon.com/route53/v2/hostedzones)
2. Find your hosted zone for `visualneurons.com`
3. Create/Update A record:
   - **Record name:** leave blank (for root domain)
   - **Record type:** A
   - **Value:** Your EC2 Public IP
   - **TTL:** 300
4. Click **"Create records"**

**Get your EC2 Public IP:**
```bash
curl -4 ifconfig.me
```

Wait 1-5 minutes for DNS propagation. Test with:
```bash
dig visualneurons.com
```

---

### Step 5: Configure Security Group 🔒

Ensure your EC2 security group allows:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (for Let's Encrypt) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (production traffic) |
| 3000 | TCP | Your IP (optional) | Direct dev access |

**Important:** Port 3000 should either be:
- ❌ Completely closed (most secure - nginx handles everything)
- ✅ Restricted to your IP only (for testing/debugging)
- ❌ **NEVER** open to 0.0.0.0/0 (security risk!)

---

### Step 6: Install Nginx 🌐

```bash
cd /home/ubuntu/visual-llms
sudo bash scripts/setup-nginx.sh
```

This will:
- Install nginx
- Copy configuration
- Enable the site
- Restart nginx

---

### Step 7: Get SSL Certificate 🔐

**Wait for DNS propagation first!** Test with `dig visualneurons.com`

```bash
sudo bash scripts/setup-ssl.sh
```

When prompted:
- Enter your email for renewal notices
- Agree to terms
- Choose whether to redirect HTTP → HTTPS (recommended: Yes)

---

### Step 8: Create Your User 👤

Configure AWS CLI (if not already done):
```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Region (same as your User Pool, e.g., `us-east-1`)

Create your admin user:
```bash
bash scripts/create-cognito-user.sh
```

Enter:
- User Pool ID (from Step 1)
- Your username
- Temporary password

**Note:** The app handles password changes automatically! On first login, you'll be prompted to set a new password directly in the web interface.

---

### Step 9: Test Everything! ✅

1. **Visit your site:** https://visualneurons.com
2. **You should be redirected to `/login`**
3. **Login with your credentials:**
   - Username: (what you created)
   - Password: (temporary password)
   - You'll be prompted to change your password on first login
4. **Test the app:**
   - Generate an image
   - Edit an image
   - View gallery
   - Check usage page
   - Logout and login again

**🎉 Congratulations! You're deployed!**

---

## 🏗️ How It Works (Architecture)

Understanding the complete flow from your browser to your app:

### The Flow

```
Your Browser
    ↓
https://visualneurons.com (port 443)
    ↓
AWS Route53 DNS (resolves domain to your EC2 IP)
    ↓
AWS Security Group (firewall - allows ports 22, 80, 443)
    ↓
Nginx (on EC2, listening on ports 80/443)
  • Handles SSL/TLS certificates (the padlock 🔒)
  • Acts as reverse proxy
  • Forwards requests to localhost:3000
    ↓
Next.js App (on EC2, localhost:3000)
  • Running in screen session
  • npm run dev (hot reload enabled!)
  • AWS Cognito authentication
  • Generates images/videos
    ↓
Response flows back up through Nginx to your browser
```

### Key Points

**Everything runs on the same EC2 instance:**
- ✅ Nginx and Next.js on the same machine
- ✅ `localhost:3000` means "only accessible from this machine"
- ✅ Nginx forwards traffic from port 443 → localhost:3000 internally
- ✅ Users never directly access port 3000

**Why Nginx?**
- Handles HTTPS/SSL certificates
- Protects Node.js from direct internet exposure
- Better security and performance
- Professional production setup

**Why Screen + npm run dev?**
- Simple - just one command to start
- Hot reload - edit code, refresh browser, see changes!
- Full logs - everything in one place
- No build step - instant feedback
- Perfect for single-user/development setups

**Access Methods:**

1. **Production (Everyone):**
   - `https://visualneurons.com` → nginx → localhost:3000

2. **Direct (Your IP only, if port 3000 is open):**
   - `http://YOUR_EC2_IP:3000` → directly to Next.js

3. **From EC2 itself:**
   - `http://localhost:3000` → directly to Next.js
   - Via SSH tunnel: `ssh -L 3000:localhost:3000 ubuntu@YOUR_EC2_IP`

---

## 💡 Development vs Production Modes

### `npm run dev` (What You're Using)

**Characteristics:**
- ✅ Hot reload - changes appear instantly
- ✅ Detailed logs - see everything
- ✅ Source maps - easy debugging
- ✅ Faster development cycle
- ❌ Slower performance
- ❌ Larger memory footprint

**Perfect for:**
- Single-user setups
- Active development
- When you want instant feedback

### `npm run build` + `npm start` (Traditional Production)

**Characteristics:**
- ✅ Optimized performance
- ✅ Smaller memory usage
- ✅ Minified code
- ❌ No hot reload - requires rebuild for changes
- ❌ Silent logs by default
- ❌ Slower iteration

**Perfect for:**
- Multi-user production
- When optimization matters
- When changes are infrequent

### Why We Use Dev Mode for Production

For a **single-user app** where you're the only one using it:
- The performance difference doesn't matter
- Hot reload is incredibly valuable
- No need to rebuild every time you make a change
- Logs are visible and helpful
- Simpler workflow

**You get production-grade security (HTTPS, Cognito, nginx) with development-mode productivity!**

---

## ✨ Using the App

### Create Images

1. Select **"Create"** mode
2. **Choose your model:**
   - **Imagen 4 (Standard)** - Default, highest-quality photorealistic generation
   - **Nano Banana** - Alternative multimodal model
3. Type a prompt: *"A serene mountain landscape at sunset"*
4. Click **Send**
5. Wait for the model to generate the image
6. **Click Save** to add to gallery *(images are not saved automatically!)*

### Edit Images

1. Select **"Edit selected"** mode
2. Upload an image or select from gallery
3. **Pick an editing model** - Click "▶ Change Model" to expand
   - **Nano Banana** (default) - Best all-rounder, maintains likenesses
   - **Qwen Image Edit Plus** - ControlNet-aware, multi-image consistency
   - **SeedEdit 3.0** - Precise adjustments, preserves details
   - **Seedream 4** - High-resolution edits up to 4K
4. Describe the change: *"Make the sky purple and add stars"*
5. Click **Send**
6. **Chain edits**: Keep editing the result!
   - *"Now add a sunset"*
   - *"Make it more vibrant"*

### Generate Videos 🎬

1. Select **"Video"** mode
2. **Choose video generation mode:**
   - **Standard** - Control start/end frames, flexible duration (1-8s)
   - **Reference** - Consistent character/object appearance (1-3 images)
3. Configure settings and select frames from your images
4. Type your video prompt with camera movement and action
5. Click **Send** and wait (progress updates shown)
6. Click **Save** to add to gallery

**Example Video Prompts:**
- *"A calico kitten playing with yarn, morning sunlight, camera slowly zooms in"*
- *"Aerial view of river through forest, camera following water downstream"*

### Gallery & Usage

- **Gallery** - View saved images/videos, filter by type, download, delete
- **Usage** - Track API spending by model and time period

---

## 📋 Commands Reference

### Managing the App with Screen

```bash
# Start the app (in background, stays running when you disconnect)
screen -dmS visualneurons npm run dev

# View logs (attach to the screen session)
screen -r visualneurons
# Press Ctrl+A then D to detach (app keeps running)

# Check if running
screen -ls

# Stop the app
screen -X -S visualneurons quit

# Restart the app
screen -X -S visualneurons quit
screen -dmS visualneurons npm run dev
```

**Viewing Logs:**
```bash
# BEST OPTION - See everything in real-time!
screen -r visualneurons

# You'll see:
# - Every HTTP request
# - Image/video generation progress
# - Compilation status
# - Hot reload notifications
# - Errors and warnings
# - Everything npm run dev normally shows!

# When done watching, press: Ctrl+A then D
```

### Managing Nginx

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/access.log  # All requests
sudo tail -f /var/log/nginx/error.log   # Errors only
```

### SSL Certificate Management

```bash
# Get certificate (first time)
sudo certbot --nginx -d visualneurons.com

# Test renewal
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew --force-renewal
```

### AWS Cognito User Management

```bash
# Create a new user
bash scripts/create-cognito-user.sh

# Check user status
aws cognito-idp admin-get-user \
  --user-pool-id YOUR_POOL_ID \
  --username YOUR_USERNAME

# Set permanent password (if needed)
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_POOL_ID \
  --username YOUR_USERNAME \
  --password "YourNewPassword123!" \
  --permanent
```

### Useful Development Commands

```bash
# Stop the dev server
pkill -f "next dev"

# Start dev server (not in screen)
npm run dev

# View database in browser
npx prisma studio

# Check what's on port 3000
lsof -i :3000

# Get your EC2 public IP
curl -4 ifconfig.me

# Test DNS resolution
dig visualneurons.com

# Check if app is responding
curl http://localhost:3000
```

---

## 🔧 Troubleshooting

### Understanding the Setup

**Your Complete Stack:**

```
Browser → visualneurons.com:443 (HTTPS)
  ↓
Nginx (ports 80/443)
  • Handles SSL
  • Reverse proxy
  ↓
Next.js App (localhost:3000)
  • Runs in screen session
  • npm run dev
  • Hot reload enabled
```

**Everything runs on the same EC2 instance.**

---

### Common Issues & Solutions

#### Login Issues

**Issue: "Incorrect username or password"**
- **Check:** Username is correct (case-sensitive!)
- **First login:** The app will automatically prompt you to change your temporary password
- **Reset password:**
```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_POOL_ID \
  --username YOUR_USERNAME \
  --password "YourNewPassword123!" \
  --permanent
```

**Issue: "User does not exist"**
- **Solution:** Create user with `bash scripts/create-cognito-user.sh`

**Issue: "SECRET_HASH was not received"**
- **Cause:** App client was created WITH a client secret
- **Solution:** Create a new app client as "Single-page application (SPA)" type (no secret)
- Update `.env` with the new Client ID
- Restart the app

---

#### App Not Running

**Issue: 502 Bad Gateway**
- **Check if app is running:**
```bash
screen -ls
```
- **If not running, start it:**
```bash
screen -dmS visualneurons npm run dev
```
- **View logs for errors:**
```bash
screen -r visualneurons
```

**Issue: Port 3000 already in use**
```bash
# Find what's using it
lsof -i :3000

# Kill it
pkill -f "next dev"

# Start again
screen -dmS visualneurons npm run dev
```

---

#### Domain & SSL Issues

**Issue: Can't access via domain**
- **Verify DNS:** `dig visualneurons.com` should show your EC2 IP
- **Check nginx:** `sudo systemctl status nginx`
- **Check security group:** Ports 80 and 443 must be open to 0.0.0.0/0

**Issue: HTTPS not working**
- **Check certificate:** `sudo certbot certificates`
- **Verify ports 80/443 are open** in security group
- **Check nginx config:** `sudo nginx -t`

---

#### Code Changes Not Appearing

**Solution:** You're running in dev mode - just refresh your browser!
- Dev mode automatically detects file changes and reloads
- No rebuild needed
- If changes still don't appear:
  1. Check `screen -r visualneurons` for compilation errors
  2. Try hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

---

#### Viewing Logs

**Application Logs (Best Option):**
```bash
screen -r visualneurons
# See everything: requests, compilation, errors, hot reload
# Press Ctrl+A then D to detach
```

**Nginx Logs:**
```bash
# All HTTP requests
sudo tail -f /var/log/nginx/access.log

# Nginx errors only
sudo tail -f /var/log/nginx/error.log
```

---

### Database & Storage Issues

**Images not displaying:**
```bash
# Fix permissions
sudo chown -R $USER:$USER /var/visualneurons
chmod -R 755 /var/visualneurons
```

**Database issues:**
```bash
# Regenerate Prisma client
npx prisma generate

# View database in browser
npx prisma studio
```

**"API key not valid":**
- Check `.env` has `REPLICATE_API_KEY=your_key` (no quotes)
- Restart server: `screen -X -S visualneurons quit && screen -dmS visualneurons npm run dev`
- Verify key at https://replicate.com/account/api-tokens

---

## 🎨 Features & Models

### What's in This App

**✅ Core Features:**
- Beautiful chat interface with dark mode
- Create/Edit/Video mode toggle
- Auto-scroll to latest content
- Image and video display inline
- Gallery with filtering and multi-select
- Usage & cost tracking dashboard
- Save/download/delete media
- Iterative editing with undo
- Chat persistence (localStorage)

**✅ AI Models:**
- **Imagen 4 Ultra** - Highest-quality image generation (2K resolution)
- **Nano Banana** - Versatile generation + editing
- **Qwen Image Edit Plus** - ControlNet-aware editing
- **SeedEdit 3.0** - Detail-preserving targeted edits
- **Seedream 4** - High-resolution editing up to 4K
- **Veo 3.1** - Cinematic video generation with audio

**✅ Production Features:**
- AWS Cognito authentication (username/password)
- Nginx reverse proxy with SSL/HTTPS
- Screen session management (simple & reliable!)
- Route53 DNS integration
- Secure HTTP-only cookies
- Self-registration disabled (admin-only user creation)

---

### Model Comparison

| Model | Best For | Resolution | Cost (Replicate) |
|-------|----------|------------|------------------|
| **Imagen 4 Ultra** | Photorealistic images | 2K (2048×2048) | ~$0.08/image |
| **Nano Banana** | Creative edits, variations | 1024×1024 | ~$0.05/image |
| **Qwen Image Edit Plus** | ControlNet, multi-image | Configurable | $0.03/image |
| **SeedEdit 3.0** | Precise adjustments | Original size | $0.03/image |
| **Seedream 4** | High-res edits, styles | Up to 4K | $0.03/image |
| **Veo 3.1** | Cinematic videos | 720p/1080p | ~$4.00/8s video |

**Choosing the Right Model:**

- **Imagen 4:** Best quality images, fastest generation
- **Nano Banana:** Great for maintaining likeness in edits
- **Qwen Image Edit Plus:** When you need structural guidance or multi-image consistency
- **SeedEdit 3.0:** Precise changes (lighting, removals) with minimal side effects
- **Seedream 4:** Style transfers and high-resolution creative reworks
- **Veo 3.1:** Professional video with realistic motion and native audio

---

## 💡 Writing Good Prompts

### For Image Generation

Be specific and include details:
- *"A photorealistic portrait of a cat with blue eyes, studio lighting, bokeh background"*
- *"Futuristic city skyline at night, neon lights, cyberpunk style"*
- *"Minimalist product photo, white background, professional lighting"*

### For Image Editing

Be clear and direct:
- *"Change the shirt color to red"*
- *"Make the background a beach sunset"*
- *"Add a smile and brighter lighting"*

Chain edits for best results!

### For Video Generation

Include scene, motion, and camera work:
- *"A serene beach at sunset, waves gently rolling, camera pans left to right"*
- *"Drone shot descending over misty forest, revealing hidden waterfall"*
- *"Close-up of raindrops on window, city lights blurred, melancholic mood"*

---

## 🪝 Webhook-Based Video Generation (Optional)

**Why use webhooks?**

**Without Webhooks (Default):**
- ❌ Must wait on the page
- ❌ If you refresh → video lost, API credits wasted

**With Webhooks (Recommended):**
- ✅ Video processes in background
- ✅ Can refresh, navigate away, or close browser
- ✅ Auto-saved to gallery when complete
- ✅ No wasted credits

**Setup:**

Just set `WEBHOOK_BASE_URL=https://visualneurons.com` in your `.env` and restart!

For local development with ngrok:
1. Install: `npm install -g ngrok`
2. Start: `ngrok http 3000` (in separate terminal)
3. Copy the HTTPS URL
4. Set `WEBHOOK_BASE_URL=https://your-id.ngrok-free.app` in `.env`
5. Restart app

---

## 📁 Project Structure

```
visual-llms/
├── app/
│   ├── api/              # API routes (create, edit, video, gallery, auth)
│   ├── gallery/          # Gallery page
│   ├── login/            # Login page (Cognito)
│   ├── usage/            # Usage dashboard
│   ├── page.tsx          # Main chat interface
│   └── layout.tsx        # Root layout
├── lib/
│   ├── replicate.ts      # Replicate API integration
│   ├── auth.ts           # AWS Cognito server-side auth
│   ├── auth-client.ts    # Cognito client-side auth
│   ├── prisma.ts         # Database client
│   ├── session.ts        # Session management
│   ├── storage.ts        # File operations
│   └── pricing.ts        # Cost calculations
├── scripts/
│   ├── create-cognito-user.sh  # Create Cognito users
│   ├── setup-nginx.sh          # Install & configure nginx
│   ├── setup-ssl.sh            # Get SSL certificate
│   └── nginx-config.conf       # Nginx configuration
├── prisma/
│   └── schema.prisma     # Database schema
├── middleware.ts         # Auth middleware (route protection)
└── /var/visualneurons/   # Data storage
    ├── db.sqlite         # SQLite database
    └── media/            # Image & video files
```

---

## 🔐 Security Features

**Your app includes:**
- ✅ AWS Cognito authentication (enterprise-grade)
- ✅ HTTPS/SSL encryption via Let's Encrypt
- ✅ Nginx reverse proxy (protects Next.js)
- ✅ HTTP-only secure cookies
- ✅ No public sign-up (admin creates all users)
- ✅ Session-based access control
- ✅ Password change flow on first login
- ✅ Port 3000 not publicly accessible

**Future enhancements:**
- PostgreSQL migration
- S3/Cloud storage
- Rate limiting
- WAF (Web Application Firewall)
- Multi-factor authentication (MFA)

---

## 🛠️ Advanced Topics

### SSH Tunnel for Debugging

Access your app's localhost:3000 directly in your browser:

```bash
# From your local machine:
ssh -L 3000:localhost:3000 ubuntu@YOUR_EC2_IP

# Then open: http://localhost:3000
# This bypasses nginx - useful for debugging!
```

### Database Management

```bash
# View database in browser UI
npx prisma studio

# Create new migration
npx prisma migrate dev --name your_migration_name

# Regenerate client after schema changes
npx prisma generate
```

### Backup & Restore

```bash
# Backup database
cp /var/visualneurons/db.sqlite /var/visualneurons/db.sqlite.backup

# Backup media files
tar -czf media-backup.tar.gz /var/visualneurons/media/

# Restore database
cp /var/visualneurons/db.sqlite.backup /var/visualneurons/db.sqlite
```

---

## 📊 API Reference

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/images/create` | POST | Generate image from text |
| `/api/images/edit` | POST | Edit image with instruction |
| `/api/images/save` | POST | Upload user image |
| `/api/images/[id]` | GET | Get image details |
| `/api/images/[id]/save` | POST | Mark image as saved |
| `/api/images/[id]/delete` | DELETE | Delete image |
| `/api/videos/create` | POST | Generate video |
| `/api/gallery` | GET | List saved media |
| `/api/usage` | GET | Get usage statistics |
| `/api/media/[...path]` | GET | Serve media files |
| `/api/auth/login` | POST | Login with Cognito |
| `/api/auth/logout` | POST | Logout |
| `/api/webhooks/replicate` | POST | Webhook for async predictions |
| `/api/predictions/[id]` | GET | Check prediction status |

### Database Schema

```sql
-- Sessions (cookie-based)
sessions {
  id: UUID
  createdAt: DateTime
  lastSeen: DateTime
}

-- Media Assets
media_assets {
  id: UUID
  owner: UUID (session FK)
  kind: "image" | "video"
  provider: String
  path: String
  bytes: Integer
  metadata: JSON
  saved: Boolean
  createdAt: DateTime
}

-- Actions (activity log)
actions {
  id: UUID
  userId: UUID (session FK)
  action: String
  assetId: UUID (media FK)
  detail: JSON
  createdAt: DateTime
}

-- Predictions (webhook-based)
predictions {
  id: UUID
  predictionId: String (Replicate ID)
  owner: UUID (session FK)
  type: "image" | "video"
  status: String
  prompt: String
  metadata: JSON
  assetId: UUID (nullable)
  createdAt: DateTime
}
```

---

## 🎯 Quick Tips

### Best Practices

1. **Save selectively** - Only save images you want to keep (prevents gallery clutter)
2. **Chain edits** - Build up complex changes step by step
3. **Use undo** - Click "← Previous" if you don't like an edit
4. **Try different models** - Each has strengths for different tasks
5. **Watch screen logs** - See what's happening in real-time

### Performance Tips

- **Images:** Imagen 4 is fastest (~5-10s)
- **Edits:** Nano Banana is most reliable
- **Videos:** Use webhooks for long generations (don't wait on page)
- **Storage:** Clean up old media periodically to save disk space

### Cost Management

- **Track usage** - Check the Usage page regularly
- **Imagen 4:** Most expensive but highest quality (~$0.08)
- **Editing models:** Cheaper (~$0.03-0.05)
- **Videos:** Most expensive (~$4.00 for 8s)
- **Save only final versions** - Don't save every iteration

---

## 📚 Resources

### Documentation

- **Replicate API:** https://replicate.com/docs
- **Next.js:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs
- **AWS Cognito:** https://docs.aws.amazon.com/cognito/
- **Nginx:** https://nginx.org/en/docs/

### Models

- **[Imagen 4 Ultra](https://replicate.com/google/imagen-4-ultra)** - Image generation
- **[Nano Banana](https://replicate.com/google/nano-banana)** - Generation + editing
- **[Qwen Image Edit Plus](https://replicate.com/qwen/qwen-image-edit-plus)** - ControlNet editing
- **[SeedEdit 3.0](https://replicate.com/bytedance/seededit-3.0)** - Precise edits
- **[Seedream 4](https://replicate.com/bytedance/seedream-4)** - High-res editing
- **[Veo 3.1](https://replicate.com/google/veo-3.1)** - Video generation

### Pricing

- **Replicate Pricing:** https://replicate.com/pricing
- Costs are based on GPU time used
- Check Usage dashboard for your spending

---

## 🎊 Summary

**Visual Neurons is a complete AI creative platform that's:**

- ✅ **Simple** - Screen + npm run dev, no complex build steps
- ✅ **Powerful** - 6 AI models for images and videos
- ✅ **Secure** - AWS Cognito + nginx + HTTPS
- ✅ **Fast** - Hot reload, instant feedback
- ✅ **Beautiful** - Modern UI with dark mode
- ✅ **Production-ready** - Running on visualneurons.com

**Your setup is optimized for single-user productivity:**
- Edit code → Save → Refresh browser → See changes!
- View logs → `screen -r visualneurons`
- No rebuilding, no complexity, just create! 🎨✨

---

## 📝 What We Built Together

This app includes:

**Core Application:**
- Full Next.js 15 app with App Router
- TypeScript + Tailwind CSS + Prisma ORM
- SQLite database with local file storage
- Beautiful chat interface

**Authentication & Security:**
- AWS Cognito integration (username/password)
- Login page with password change flow
- Middleware for route protection
- HTTP-only secure cookies
- SSL/HTTPS via Let's Encrypt

**Deployment Infrastructure:**
- Nginx reverse proxy configuration
- Automated setup scripts
- Screen session management
- Route53 DNS integration

**Features:**
- Image generation (Imagen 4, Nano Banana)
- Image editing (4 models to choose from)
- Video generation (Veo 3.1 with audio)
- Gallery with media management
- Usage tracking and cost estimates
- Webhook support for async processing

**All running on a single EC2 instance with simple, maintainable architecture!** 🚀

---

Made with ❤️ using Replicate API • Next.js • AWS

**Happy creating!** 🎨🎬✨
