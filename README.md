# Visual Neurons

A complete creative AI platform with **image and video generation**: **Imagen 4** for high-fidelity images, **Nova Canvas** (AWS Bedrock) for natural language editing with optional **Grounded SAM** precision masking, **Claude 4.5 Sonnet** (AWS Bedrock) for intelligent error assistance with vision, **Nano Banana**, **Qwen Image Edit Plus**, **SeedEdit 3.0**, and **Seedream 4** for creative editing, and **Veo 3.1** for cinematic video generation with audio. Create, edit, and generate through natural language chat with intelligent assistance.

**Tech Stack:** Next.js 15 • React 19 • TypeScript • Tailwind CSS • Prisma • SQLite • Replicate API • AWS Bedrock

**Status:** ✅ Fully functional and production-ready with AWS Cognito authentication!

---

## 📖 Table of Contents

1. [Quick Start (Local Development)](#-quick-start-local-development)
2. [Production Deployment](#-production-deployment)
3. [How It Works (Architecture)](#-how-it-works-architecture)
4. [Development vs Production Modes](#-development-vs-production-modes)
5. [Using the App](#-using-the-app)
6. [Commands Reference](#-commands-reference)
7. [Troubleshooting](#-troubleshooting)
8. [Features & Models](#-features--models)
9. [Advanced Topics](#-advanced-topics)
   - SSH Tunneling
   - Database Management
   - Session Management & Data Migration
   - Backup & Restore
10. [API Reference](#-api-reference)
11. [Deployment Journey & Lessons Learned](#-deployment-journey--lessons-learned)

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
- ✨ Proactive prompt improvement with Claude 4.5 Sonnet vision
- Intelligent error assistance with Claude 4.5 Sonnet vision
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
- **Nova Canvas (AWS Bedrock)** - 2K premium image generation + natural language editing + precision masking
- **Grounded SAM** - AI-powered precision mask generation for Nova Canvas
- **Claude 4.5 Sonnet (AWS Bedrock)** - Vision-powered error explanation and prompt assistance
- **Qwen Image Edit Plus** - ControlNet-aware editing
- **SeedEdit 3.0** - Detail-preserving targeted edits
- **Seedream 4** - High-resolution editing up to 4K
- **Veo 3.1** - Cinematic video generation with audio

**✅ Production Features:**
- AWS Cognito authentication (username/password)
- AWS Bedrock integration (Nova Canvas + Claude 4.5 Sonnet)
- ✨ Proactive prompt improvement (Claude vision)
- Intelligent error handling (Claude vision)
- Nginx reverse proxy with SSL/HTTPS
- Screen session management (simple & reliable!)
- Route53 DNS integration
- Secure HTTP-only cookies
- Self-registration disabled (admin-only user creation)

---

### Model Comparison

| Model | Best For | Resolution | Cost |
|-------|----------|------------|------|
| **Imagen 4 Ultra** | Photorealistic images | 2K (2048×2048) | ~$0.08/image (Replicate) |
| **Nano Banana** | Creative edits, variations | 1024×1024 | ~$0.05/image (Replicate) |
| **Nova Canvas** | Natural language editing | 2K (2048×2048) Premium | $0.08/image (AWS Bedrock) |
| **Grounded SAM** | Precision mask generation | Original size | $0.0014/mask (Replicate) |
| **Qwen Image Edit Plus** | ControlNet, multi-image | Configurable | $0.03/image (Replicate) |
| **SeedEdit 3.0** | Precise adjustments | Original size | $0.03/image (Replicate) |
| **Seedream 4** | High-res edits, styles | Up to 4K | $0.03/image (Replicate) |
| **Veo 3.1** | Cinematic videos | 720p/1080p | ~$4.00/8s video (Replicate) |

**Choosing the Right Model:**

- **Imagen 4:** Best quality images, fastest generation
- **Nano Banana:** Great for maintaining likeness in edits
- **Nova Canvas:** Automatic masking via natural language, high-quality 2K premium output (AWS Bedrock)
- **Grounded SAM:** AI-powered precision masking for Nova Canvas when natural language isn't precise enough
- **Claude 4.5 Sonnet:** Proactive prompt improvement + automatic error assistant with vision capabilities
- **Qwen Image Edit Plus:** When you need structural guidance or multi-image consistency
- **SeedEdit 3.0:** Precise changes (lighting, removals) with minimal side effects
- **Seedream 4:** Style transfers and high-resolution creative reworks
- **Veo 3.1:** Professional video with realistic motion and native audio

---

## 💡 Writing Good Prompts

### ✨ Improve Prompt Feature

**Not sure how to write a good prompt?** Click the **✨ Improve Prompt** button!

Claude 4.5 Sonnet will:
- 🔍 **Analyze your prompt** (and see your images in edit/video mode)
- 💡 **Give you concise tips** on how to improve it
- 🎨 **Provide 2 specific examples** of your prompt made significantly better
- ⚡ **Auto-fill the first example** in your input field for easy use

**Example:**
```
You type: "a car"
Click: ✨ Improve Prompt

Claude shows:
Original prompt: "a car"

Tips to improve: Add specific style, lighting, composition, and quality details

2 examples of improved prompt:
1. "A sleek sports car with metallic midnight blue paint, dramatic studio 
    lighting, low three-quarter angle, photorealistic, 8K detail"
2. "A vintage classic car on wet cobblestone street at golden hour, 
    cinematic composition, warm tones, shallow depth of field"

[First example auto-filled in input - ready to send or edit further!]
```

### For Image Generation

Be specific and include details:
- *"A photorealistic portrait of a cat with blue eyes, studio lighting, bokeh background"*
- *"Futuristic city skyline at night, neon lights, cyberpunk style"*
- *"Minimalist product photo, white background, professional lighting"*

💡 **Tip:** Use **✨ Improve Prompt** to turn simple ideas into detailed prompts!

### For Image Editing

Be clear and direct:
- *"Change the shirt color to red"*
- *"Make the background a beach sunset"*
- *"Add a smile and brighter lighting"*

Chain edits for best results!

### For Nova Canvas Editing (Natural Language Masking)

Nova Canvas uses automatic masking - just describe what to change. The app shows these tips automatically when you select Nova Canvas in edit mode.

**✅ Works Well:**
- *"change the sky to sunset"*
- *"remove the bird"*
- *"make the car blue"*
- *"replace the tree with a building"*

**❌ Avoid:**
- ~~*"make it look like sunset"*~~ (too vague, no specific object)
- ~~*"change everything darker"*~~ (no specific area)
- ~~*"make the sky as if it was sunset"*~~ (overly complex phrasing)

**Pattern:** `[action] the [object] [outcome]`

The app will automatically extract the object to edit (e.g., "sky" from "change the sky to sunset") and show you what was detected in the response for transparency.

### 🎯 Precision Mask Generation with Grounded SAM (Nova Canvas Only)

When Nova Canvas's natural language masking isn't precise enough, use **AI-powered mask generation** for pixel-perfect control.

**What It Does:**
- Uses [Grounded SAM](https://replicate.com/schananas/grounded_sam) to segment objects via text prompts
- Generates precise black/white masks compatible with Nova Canvas
- Shows visual preview with red tint overlay (red=preserve, darkened=edit)
- Integrates seamlessly with Nova Canvas editing workflow

---

#### When to Use Precision Masks

**Use Grounded SAM When:**
- ✅ Complex scenes with multiple similar objects
- ✅ Need surgical precision (e.g., only one specific object)
- ✅ Natural language masking gives unexpected results
- ✅ Editing small or intricate areas

**Use Natural Language Masking When:**
- ✅ Simple scenes with clear subject
- ✅ Quick edits without perfect precision
- ✅ Entire object categories (e.g., "all sky")

---

#### How to Use

1. **Switch to Edit mode** and select **Nova Canvas** model
2. **Select your image** for editing
3. **Click "🎯 Generate Precision Mask"** button
4. **Enter what to segment:**
   - Simple prompts: `person`, `shirt`, `car`, `flower`
   - Multiple objects: `person . shirt . face`
5. **Optional:** Add negative prompt to exclude areas (e.g., `background`)
6. **Preview the mask overlay:**
   - Red tint = areas that will be preserved
   - Darkened areas (no red) = areas that will be edited
7. **Click "Use This Mask"** to activate it
8. **Enter your edit instruction** as normal (e.g., "change to blue")
9. **Submit** - Nova Canvas edits only the masked areas!

---

#### Examples

**Simple Object Segmentation:**
```
Image: Sunset landscape with a pink flower
Mask Prompt: "flower"
Result: Only the flower is masked
Edit Instruction: "make it blue"
Result: Blue flower, landscape untouched ✅
```

**With Negative Prompt:**
```
Image: Person wearing a red shirt outdoors
Mask Prompt: "shirt"
Negative Prompt: "background"
Result: Only the shirt is masked, background excluded
Edit Instruction: "make it striped"
Result: Striped shirt, everything else preserved ✅
```

**Multiple Elements:**
```
Image: Portrait photo
Mask Prompt: "person . shirt . face"
Result: Person, their shirt, and face all masked
Edit Instruction: "professional headshot lighting"
Result: Improved lighting on masked areas only ✅
```

---

#### Tips & Best Practices

**Prompting:**
- ✅ **Simple, clear words:** "person", "car", "tree", "sky", "building"
- ✅ **Be specific:** "red car" better than just "car" in multi-car scenes
- ✅ **Use dots for multiple:** "person . shirt . hat"
- ❌ **Avoid vague terms:** ~~"stuff"~~, ~~"thing"~~, ~~"area"~~

**Understanding Behavior:**
- 🔍 **Grounded SAM segments ALL instances** - If you type "person" with 5 people, all 5 are masked
- 🎯 **Masks are temporary** - Cleared when you select a different image (by design)
- 💡 **Check the preview** - Red tint shows what will be preserved

**Cost:**
- 💰 **~$0.0014 per mask** (99¢ generates ~700 masks!)
- 💰 **Much cheaper than wasted Nova Canvas edits** (~$0.08 each)

**Workflow:**
1. Generate mask (preview shows exactly what will be edited)
2. If wrong area: Regenerate with different prompt
3. If correct area: Use mask + edit with Nova Canvas
4. For next image: Generate new mask (old one clears automatically)

---

#### Visual Preview Explained

The mask overlay uses **Photoshop-style visualization**:

```
Background: Semi-transparent red (30% opacity)
Masked areas: Multiply blend mode removes red
Result:
  • Darkened areas (no red tint) = WILL BE EDITED ✏️
  • Red-tinted areas = WILL BE PRESERVED 🔒
```

This makes it crystal clear what Nova Canvas will edit vs. preserve.

---

#### Technical Details

**What Happens Behind the Scenes:**

1. **API Call** - Image + prompt sent to Grounded SAM on Replicate
2. **Segmentation** - AI identifies all instances of the prompt
3. **Mask Generation** - Returns 4 outputs:
   - `annotated_picture_mask.jpg` (visualization with boxes)
   - `neg_annotated_picture_mask.jpg` (negative version)
   - `mask.jpg` (pure mask: white=object, black=background)
   - `inverted_mask.jpg` (inverted: black=object, white=background)
4. **Selection** - App selects `mask.jpg` (the pure mask)
5. **Inversion** - Colors inverted for Nova Canvas compatibility:
   - Grounded SAM: white=object, black=background
   - Nova Canvas: **black=edit, white=preserve**
6. **Storage** - Saved to `/var/visualneurons/media/{sessionId}/mask_*.png`
7. **Preview** - Displayed with red tint overlay
8. **Usage** - Sent to Nova Canvas as `maskImage` parameter (base64)

**Key Files:**
- `lib/segmentation.ts` - Grounded SAM API integration + mask inversion
- `app/api/masks/generate/route.ts` - Mask generation API endpoint
- `components/MaskGenerator.tsx` - UI component for mask generation
- `lib/bedrock.ts` - Nova Canvas integration with `maskImage` parameter

---

#### Troubleshooting

**"No objects matching 'X' were found"**
- ✅ Try a simpler, more general prompt (e.g., "person" instead of "person in red shirt")
- ✅ Check object is clearly visible in the image
- ✅ Try alternative terms (e.g., "automobile" vs "car")

**Mask shows wrong area**
- ✅ Add negative prompt to exclude unwanted areas
- ✅ Be more specific in prompt (e.g., "blue car" if multiple cars)
- ✅ Regenerate with different wording

**Mask segments too many objects**
- 💡 This is normal - Grounded SAM finds ALL instances
- 💡 Future updates will add brush/eraser tools to refine masks
- 💡 For now: Use more specific prompts or negative prompts

**Preview looks weird**
- ✅ Darkened areas (no red) = will be edited ✏️
- ✅ Red-tinted areas = will be preserved 🔒
- ✅ This is correct Photoshop-style visualization!

---

#### Future Enhancements

Planned features for mask refinement (Phase 2):

- 🖌️ **Brush tool** - Add to mask manually
- 🧹 **Eraser tool** - Remove from mask manually
- 📏 **Brush size slider** - Adjust precision
- 🔍 **Zoom controls** - Fine-tune edges
- ↶ **Undo/Redo** - Step through changes

**Current Status:** MVP shipped and working! Refinement tools will be added based on user feedback.

### Intelligent Error Assistance (Claude 4.5 Sonnet Vision)

When errors occur, **Claude 4.5 Sonnet automatically analyzes them** and provides helpful feedback:

**What Claude Does:**
- 🔍 **Sees your image** (for editing errors) and understands what you're trying to do
- 💬 **Explains the error** in friendly, plain language
- ✨ **Suggests a fix** that actually works
- ⚡ **Auto-fills the input** with the corrected prompt for easy retry

**Example Error Flow:**

```
You: "Make the hair blonde"
Image: [Mountain landscape with trees]

Claude sees the image and responds:
"This image shows a mountain landscape with autumn trees and sky. 
There are no people or hair to edit. Did you mean to change the 
tree colors instead?"

💡 Try this instead:
"change the trees to golden yellow"

[Input auto-filled with the suggestion - just click Send!]
```

**No button needed** - Claude automatically helps whenever something goes wrong!

### Proactive Prompt Improvement (Claude 4.5 Sonnet Vision)

Before submitting your prompt, click **✨ Improve Prompt** to get Claude's expert suggestions:

**How It Works:**
- Type your prompt (can be as simple as "a cat" or "remove the dog")
- Click **✨ Improve Prompt** button (appears next to Send)
- Claude analyzes your prompt + any selected images
- Get instant feedback with 2 improved examples
- First example auto-fills in the input field

**Context-Aware by Mode:**
- **Create Mode:** Claude adds style, lighting, composition details
- **Edit Mode:** Claude sees the image and suggests realistic edits
- **Video Mode:** Claude sees frame images and adds camera work, pacing

**Example in Edit Mode:**
```
You type: "make hair blonde"
Image: [Mountain landscape]

Claude responds:
Original prompt: "make hair blonde"

Tips to improve: This image shows a landscape with no people. 
Suggest editing elements actually present in the scene.

2 examples of improved prompt:
1. "change the trees to golden yellow autumn foliage"
2. "transform the sky to warm golden hour lighting"
```

**Saves you from wasted API calls** by catching mistakes before submission!

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
│   ├── api/              # API routes
│   │   ├── images/       # Create, edit, save images
│   │   ├── masks/        # Mask generation (Grounded SAM)
│   │   ├── videos/       # Video generation
│   │   ├── gallery/      # Gallery management
│   │   └── auth/         # Cognito authentication
│   ├── gallery/          # Gallery page
│   ├── login/            # Login page (Cognito)
│   ├── usage/            # Usage dashboard
│   ├── page.tsx          # Main chat interface
│   └── layout.tsx        # Root layout
├── components/
│   ├── MaskGenerator.tsx # Precision mask UI component
│   └── ...               # Other components
├── lib/
│   ├── replicate.ts      # Replicate API integration
│   ├── bedrock.ts        # AWS Bedrock (Nova Canvas + Claude 4.5 Sonnet)
│   ├── segmentation.ts   # Grounded SAM integration + mask inversion
│   ├── auth-server.ts    # AWS Cognito server-side auth
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
    └── media/            # Image, video & mask files
        └── {sessionId}/  # Per-session storage
            ├── image_*.png
            ├── mask_*.png
            └── video_*.mp4
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

### Session Management & Data Migration

**Understanding Sessions:**

The app uses **session-based data isolation** - each session sees only its own media. This is how Prisma partitions data:

```typescript
// Every media asset has an owner (session ID)
model MediaAsset {
  owner String  // Session ID - partitions all data!
  ...
}

// Gallery queries filter by session
const media = await prisma.mediaAsset.findMany({
  where: { 
    owner: currentSessionId,  // Only shows this session's media
    saved: true 
  }
});
```

**When You Might Need Migration:**

If you switch from:
- `localhost:3000` → `visualneurons.com` (different cookies!)
- Old session → New Cognito session
- Development → Production

Your old media will "disappear" (it's still in the database, just tied to the old session).

**How to Find Your Sessions:**

```bash
# Install sqlite3 if not already installed
sudo apt install sqlite3

# View all sessions and their media counts
sqlite3 /var/visualneurons/db.sqlite "
SELECT 
  owner as session_id, 
  COUNT(*) as total_media,
  SUM(CASE WHEN saved=1 THEN 1 ELSE 0 END) as saved_count
FROM media_assets 
GROUP BY owner;
"

# View session details
sqlite3 /var/visualneurons/db.sqlite "
SELECT id, createdAt, lastSeen 
FROM sessions 
ORDER BY createdAt;
"
```

**Migrate Data Between Sessions:**

```bash
# Step 1: Identify your sessions
# Old session (localhost): 7cb4ebb0-e7a2-417d-9cd3-250dfd48e52c
# New session (Cognito): 951aa917-632d-412c-af69-2ac9b5575e80

# Step 2: Migrate media assets
sqlite3 /var/visualneurons/db.sqlite "
UPDATE media_assets 
SET owner = 'NEW_SESSION_ID' 
WHERE owner = 'OLD_SESSION_ID';
"

# Step 3: Migrate action logs
sqlite3 /var/visualneurons/db.sqlite "
UPDATE actions 
SET userId = 'NEW_SESSION_ID' 
WHERE userId = 'OLD_SESSION_ID';
"

# Step 4: Verify migration
sqlite3 /var/visualneurons/db.sqlite "
SELECT owner, COUNT(*) as count 
FROM media_assets 
GROUP BY owner;
"

# Step 5: Refresh your browser - old media appears in gallery!
```

**Real Example (What We Did):**

```bash
# Found two sessions:
# - Old: 7cb4ebb0-e7a2-417d-9cd3-250dfd48e52c (81 media files, 20 saved)
# - New: 951aa917-632d-412c-af69-2ac9b5575e80 (9 media files)

# Migrated old → new:
sqlite3 /var/visualneurons/db.sqlite "
UPDATE media_assets 
SET owner = '951aa917-632d-412c-af69-2ac9b5575e80' 
WHERE owner = '7cb4ebb0-e7a2-417d-9cd3-250dfd48e52c';
"

sqlite3 /var/visualneurons/db.sqlite "
UPDATE actions 
SET userId = '951aa917-632d-412c-af69-2ac9b5575e80' 
WHERE userId = '7cb4ebb0-e7a2-417d-9cd3-250dfd48e52c';
"

# Result: New session now has 90 media files (81 + 9)!
```

**Why This Design?**

Session-based partitioning enables:
- ✅ Multi-user support (each user sees only their media)
- ✅ Privacy by default (no data leakage)
- ✅ Easy scaling (add Cognito users, data stays isolated)
- ✅ Works with both cookie sessions AND authenticated users

**Alternative Approach:**

For true single-user apps, you could modify the code to skip session filtering, but the current design:
- Is more flexible
- Supports future growth
- Migration is a one-time task

---

### Evolution: Cookie-Based to User-Linked Sessions

**The Journey:**

**Phase 1: Cookie-Based Sessions (Original)**
```typescript
// Random UUID stored in cookie
sessionId = random UUID
mediaAssets.owner = sessionId

Problem: Clear cookies → lose access to your media
```

**Phase 2: Cognito Authentication Added**
```typescript
// Two separate systems:
vn_auth_token = Cognito JWT (knows who you are)
vn_session = Random UUID (owns your media)

Problem: Cognito user not linked to session!
```

**Phase 3: User-Linked Sessions (Current)**
```typescript
// Sessions linked to Cognito username
model Session {
  id: UUID
  cognitoUsername: String (unique)  // The key!
}

// Session lookup by username
session = findOrCreate({ cognitoUsername: 'francesco' })
mediaAssets.owner = session.id

Result: Same user → always same session → always same media!
```

**Benefits of User-Linked Sessions:**

1. ✅ **Persistent Identity**
   - Login as "francesco" → Always get your session
   - Clear cookies → Login again → Still your media
   - Different browser → Login → Same media

2. ✅ **True Multi-User Support**
   - Add sister with Cognito user "sister" → She gets her own session
   - Complete data isolation between users
   - Each user sees only their media

3. ✅ **Simpler Code**
   - No cookie management needed
   - No fallback logic required
   - Just: username → session → media

**Migration from Cookie to User-Linked:**

```bash
# Add cognitoUsername field to schema
# Run: npx prisma db push

# Link existing session to Cognito user
sqlite3 /var/visualneurons/db.sqlite "
UPDATE sessions 
SET cognitoUsername = 'francesco' 
WHERE id = 'YOUR_SESSION_ID';
"

# Clean up old cookie-based sessions
sqlite3 /var/visualneurons/db.sqlite "
DELETE FROM sessions WHERE cognitoUsername IS NULL;
"
```

**The Result:**

Before this change, you had multiple orphaned sessions from:
- Development on localhost
- Different browsers
- Cleared cookies

After this change:
- One session per Cognito user
- Persistent across browsers and devices
- Ready for adding more users (each gets their own isolated session)

This design now properly supports the use case: "I want to see MY stuff when I login, and my sister should see HER stuff when she logs in."

---

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
| `/api/masks/generate` | POST | Generate precision mask (Grounded SAM) |
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

1. **Use ✨ Improve Prompt** - Get Claude's expert suggestions before generating
2. **Save selectively** - Only save images you want to keep (prevents gallery clutter)
3. **Chain edits** - Build up complex changes step by step
4. **Use undo** - Click "← Previous" if you don't like an edit
5. **Try different models** - Each has strengths for different tasks
6. **Watch screen logs** - See what's happening in real-time

### Performance Tips

- **Images:** Imagen 4 is fastest (~5-10s), Nova Canvas comparable
- **Edits:** Nano Banana most reliable, Nova Canvas best for natural language instructions
- **Videos:** Use webhooks for long generations (don't wait on page)
- **Storage:** Clean up old media periodically to save disk space

### Cost Management

- **Track usage** - Check the Usage page regularly
- **Imagen 4 & Nova Canvas:** Most expensive but highest quality (~$0.08)
- **Editing models:** Cheaper (~$0.03-0.05)
- **Videos:** Most expensive (~$4.00 for 8s)
- **Save only final versions** - Don't save every iteration

---

## 📚 Resources

### Documentation

- **Replicate API:** https://replicate.com/docs
- **AWS Bedrock:** https://docs.aws.amazon.com/bedrock/
- **Nova Canvas:** https://docs.aws.amazon.com/nova/latest/userguide/
- **Claude (Anthropic):** https://docs.anthropic.com/
- **Next.js:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs
- **AWS Cognito:** https://docs.aws.amazon.com/cognito/
- **Nginx:** https://nginx.org/en/docs/

### Models

- **[Imagen 4 Ultra](https://replicate.com/google/imagen-4-ultra)** - Image generation
- **[Nano Banana](https://replicate.com/google/nano-banana)** - Generation + editing
- **[Nova Canvas](https://aws.amazon.com/bedrock/nova/)** - AWS Bedrock natural language editing
- **[Claude 4.5 Sonnet](https://www.anthropic.com/claude)** - AWS Bedrock vision-powered error assistant
- **[Qwen Image Edit Plus](https://replicate.com/qwen/qwen-image-edit-plus)** - ControlNet editing
- **[SeedEdit 3.0](https://replicate.com/bytedance/seededit-3.0)** - Precise edits
- **[Seedream 4](https://replicate.com/bytedance/seedream-4)** - High-res editing
- **[Veo 3.1](https://replicate.com/google/veo-3.1)** - Video generation

### Pricing

- **Replicate Pricing:** https://replicate.com/pricing
- **AWS Bedrock Pricing:** https://aws.amazon.com/bedrock/pricing/
- Costs are based on GPU time used (Replicate) or per-inference (AWS Bedrock)
- Check Usage dashboard for your spending

---

## 🎊 Summary

**Visual Neurons is a complete AI creative platform that's:**

- ✅ **Simple** - Screen + npm run dev, no complex build steps
- ✅ **Powerful** - 7 AI models for images and videos (Replicate + AWS Bedrock)
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
- Multi-provider AI integration (Replicate + AWS Bedrock)

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
- Image generation (Imagen 4, Nano Banana, Nova Canvas)
- Image editing (5 models: Nova Canvas, Nano Banana, Qwen, SeedEdit, Seedream)
- Natural language masking with Nova Canvas (AWS Bedrock)
- 🎯 **Precision mask generation with Grounded SAM** - AI-powered segmentation for surgical edits
- ✨ Proactive prompt improvement with Claude 4.5 Sonnet vision
- Intelligent error handling with Claude 4.5 Sonnet vision
- Video generation (Veo 3.1 with audio)
- Gallery with media management
- Usage tracking and cost estimates (Replicate + AWS Bedrock)
- Webhook support for async processing

**All running on a single EC2 instance with simple, maintainable architecture!** 🚀

---

## 🎓 Deployment Journey & Lessons Learned

**This section documents the real deployment experience - useful for blog posts and understanding production challenges.**

### The Problem-Solving Journey

**1. Login Issues with Cognito**

**Initial Problem:**
- Login failed with `SECRET_HASH was not received` error
- User in `FORCE_CHANGE_PASSWORD` state couldn't log in

**Root Cause:**
- App Client created with "Traditional web application" type generates a client secret
- JavaScript apps don't use client secrets - caused authentication failure

**Solution:**
- Created new App Client as "Single-page application (SPA)" type
- No client secret generated
- Updated `.env` with new Client ID

**Key Learning:** Choose the right Cognito app client type! SPA for JavaScript apps, Traditional for server-side apps.

---

**2. Password Change Challenge**

**Initial Problem:**
- Users in `FORCE_CHANGE_PASSWORD` status couldn't log in
- App just showed error instead of handling the challenge

**Solution:**
- Enhanced `lib/auth-client.ts` to return password challenge instead of rejecting
- Added password change form to login page
- Implemented `completeNewPassword()` function
- Now handles first-login password changes seamlessly

**Files Changed:**
- `lib/auth-client.ts` - Added `NewPasswordChallenge` type and `completeNewPassword()` function
- `app/login/page.tsx` - Added password change form UI with validation

**Key Learning:** AWS Cognito challenges must be handled in the UI, not just on the backend.

---

**3. Logging in Production**

**Initial Problem:**
- No logs visible when running `npm start` (production mode)
- Difficult to debug issues

**Evolution:**
1. **Tried:** Custom logger writing to `logs/app.log` - worked but added complexity
2. **Tried:** PM2 with enhanced logging - still too quiet
3. **Final Solution:** Use `npm run dev` via screen session

**Why This Works:**
- `npm run dev` outputs everything to stdout
- Screen captures all output in one place
- Hot reload eliminates need for rebuilds
- Perfect for single-user scenarios

**Key Learning:** For single-user deployments, dev mode + screen is simpler than production mode + PM2.

---

**4. Session Data Migration**

**Initial Problem:**
- After switching from localhost to visualneurons.com, gallery was empty
- Old images and videos "disappeared"

**Root Cause:**
- Session-based data isolation in Prisma
- Different domain = different cookie = different session
- Each session only sees its own media (by design)

**Solution:**
```bash
# Found old and new session IDs
sqlite3 /var/visualneurons/db.sqlite "SELECT owner, COUNT(*) FROM media_assets GROUP BY owner;"

# Migrated all data to new session
UPDATE media_assets SET owner = 'NEW_ID' WHERE owner = 'OLD_ID';
UPDATE actions SET userId = 'NEW_ID' WHERE userId = 'OLD_ID';
```

**Key Learning:** Session-based isolation is powerful for multi-user support but requires migration when switching authentication methods.

---

**5. Grounded SAM Mask Generation Integration**

**The Goal:**
Add AI-powered precision masking to Nova Canvas for surgical editing precision.

**The Journey - Three Critical Bugs:**

**Bug #1: Wrong Parameter Names**
```
Error: "cannot reshape tensor of 0 elements"
Symptom: Grounded SAM returned 0 detections even with clearly visible objects
```

**Root Cause:**
- Was using `prompt` and `negative_prompt` parameters
- Replicate API actually expects `mask_prompt` and `negative_mask_prompt`
- Also tried using non-existent `box_threshold` and `text_threshold` parameters

**Solution:**
```typescript
// Before (WRONG):
input: {
  prompt: "flower",
  negative_prompt: "",
  box_threshold: 0.3,
  text_threshold: 0.25
}

// After (CORRECT):
input: {
  mask_prompt: "flower",              // Fixed parameter name
  negative_mask_prompt: "",           // Fixed parameter name
  adjustment_factor: 0                // Correct parameter for erosion/dilation
}
```

**Bug #2: Hardcoded MIME Type**
```
Error: Still getting 0 detections after fixing parameter names
```

**Root Cause:**
- Was hardcoding all images as `data:image/png;base64,...`
- Actual uploaded image was JPEG
- Grounded SAM couldn't decode mismatched format

**Solution:**
```typescript
// Extract actual MIME type from uploaded file
const imageMimeType = imageFile.type || 'image/jpeg';

// Use real MIME type in data URI
image: `data:${mimeType};base64,${imageBase64}`
```

**Bug #3: Showing Annotated Image Instead of Pure Mask**
```
Symptom: Mask preview showed green bounding boxes instead of solid overlay
```

**Root Cause:**
- Grounded SAM returns 4 outputs in array:
  - `annotated_picture_mask.jpg` (visualization with boxes)
  - `neg_annotated_picture_mask.jpg` (negative version)
  - `mask.jpg` (pure black/white mask)
  - `inverted_mask.jpg` (already inverted)
- Was blindly taking first output (the annotated one)

**Solution:**
```typescript
// Smart selection logic
const pureMask = result.output.find((url: string) => 
  url.includes('mask') && !url.includes('annotated')
);
maskUrl = pureMask || result.output[result.output.length - 1];
```

**The Result:**
- ✅ Mask generation working perfectly
- ✅ Correct pure mask selected and inverted
- ✅ Beautiful Photoshop-style red tint preview
- ✅ Seamless integration with Nova Canvas

**Files Created:**
- `lib/segmentation.ts` - Grounded SAM API + mask inversion logic
- `app/api/masks/generate/route.ts` - Mask generation endpoint
- `components/MaskGenerator.tsx` - UI with preview and controls
- Updated `lib/bedrock.ts` - Added `maskImage` parameter support
- Updated `app/api/images/edit/route.ts` - Pass masks to Nova Canvas

**Key Learning:** Always check API documentation for exact parameter names! Generic names like "prompt" vs "mask_prompt" can cause silent failures.

---

### Final Architecture Decisions

**What We Chose:**
- ✅ **Screen + npm run dev** (not PM2 + npm start)
- ✅ **Dev mode in production** (for single-user simplicity)
- ✅ **Nginx reverse proxy** (for HTTPS and security)
- ✅ **Session-based isolation** (keeps multi-user option open)

**Why These Choices Work:**

1. **Screen is simpler than PM2:**
   - One command to start/stop
   - All logs in one place
   - No config files needed
   - Perfect for development workflow

2. **Dev mode gives better DX:**
   - Hot reload = instant feedback
   - Full logs = easy debugging
   - No build step = faster iteration
   - Performance doesn't matter for 1 user

3. **Nginx still crucial:**
   - Handles SSL/HTTPS
   - Professional production setup
   - Protects Node.js from direct exposure
   - Easy to add caching/load balancing later

4. **Session isolation future-proof:**
   - Can add more Cognito users easily
   - Data stays private per user
   - Migration is simple SQL commands
   - Supports scaling when needed

---

### Files Removed During Simplification

As we simplified the setup, we removed:
- ✅ `ecosystem.config.js` - PM2 config (switched to screen)
- ✅ `lib/logger.ts` - Custom logger (use screen logs instead)
- ✅ `logs/pm2-*.log` - PM2 log files (not needed)
- ✅ `logs/app.log` - Custom log file (not needed)
- ✅ Custom logging code from API routes (kept simple console.error for actual errors)

**Result:** Simpler codebase, fewer moving parts, easier maintenance.

---

### Common Gotchas & Solutions

1. **Client Secret Error:** Use SPA app client type, not Traditional
2. **Silent Logs:** Use dev mode or custom logger (we chose dev mode)
3. **Empty Gallery:** Migrate session data with SQL
4. **Port 3000 Security:** Either close it or restrict to your IP only
5. **Hot Reload Not Working:** Make sure you're running `npm run dev`, not `npm start`

---

Made with ❤️ using Replicate API • Next.js • AWS

**Happy creating!** 🎨🎬✨
