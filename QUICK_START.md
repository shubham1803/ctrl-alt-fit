# 🚀 Quick Start Guide

## Get Your App Running in 5 Minutes!

### Step 1: Get the Code on GitHub

```bash
# Navigate to your project folder
cd meal-tracker-app

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Meal Tracker App"

# Create a new repository on GitHub.com
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Get Your Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to "API Keys" section
4. Click "Create Key"
5. Copy your API key (starts with `sk-ant-`)

### Step 3: Deploy to Render (FREE!)

1. **Sign up on Render**
   - Go to https://render.com
   - Click "Get Started" 
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Click "Connect GitHub" and authorize Render
   - Select your `meal-tracker-app` repository
   
3. **Configure the Service**
   - **Name**: `meal-tracker` (or any name you want)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` ✅

4. **Add Environment Variable**
   - Scroll to "Environment Variables"
   - Click "Add Environment Variable"
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: (paste your API key from Step 2)

5. **Deploy!**
   - Click "Create Web Service"
   - Wait 2-3 minutes while Render builds and deploys
   - Your app will be live at: `https://meal-tracker-XXXX.onrender.com`

### Step 4: Test Your App!

1. Open the URL Render gives you
2. Click "Upload Photo"
3. Select a food image
4. Watch the AI analyze it! 🎉

## Auto-Deploy Setup

Now whenever you push to GitHub, Render will automatically redeploy:

```bash
# Make changes to your code
git add .
git commit -m "Updated feature X"
git push

# Render automatically deploys! 🚀
```

## Troubleshooting

**Build Failed?**
- Check that `package.json` is in the root directory
- Verify all files were pushed to GitHub

**API Not Working?**
- Verify your `ANTHROPIC_API_KEY` is set in Render dashboard
- Check it doesn't have extra spaces

**App Sleeping?**
- Free tier apps sleep after 15 min of inactivity
- First request takes ~30 seconds to wake up
- Subsequent requests are fast!

## What's Next?

- Share your app URL with friends
- Track your meals throughout the day
- Monitor your nutrition goals
- Add custom features!

Need help? Open an issue on GitHub! 💪
