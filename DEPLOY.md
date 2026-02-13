# 🚀 SUPER QUICK DEPLOY GUIDE

## 3 Steps to Get Your App Live!

### ⚡ Step 1: Get API Key (2 min)
1. Visit: https://console.anthropic.com/
2. Sign up → API Keys → Create Key
3. Copy it (starts with `sk-ant-`)

### 📦 Step 2: Push to GitHub (1 min)
```bash
cd meal-tracker-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 🌐 Step 3: Deploy on Vercel (2 min)
1. Go to **vercel.com** → Sign up with GitHub
2. Click **"New Project"**
3. Select your **meal-tracker-app** repo
4. Add Environment Variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (paste your API key)
5. Click **"Deploy"**

**DONE!** 🎉 

Your app is live at: `https://your-app.vercel.app`

## ✅ Test It
- Open the URL on your phone
- Upload a food photo
- Watch AI calculate the macros!

## 🔄 Future Updates
Just push to GitHub - Vercel auto-deploys!
```bash
git add .
git commit -m "Updated X"
git push
```

That's it! 🚀
