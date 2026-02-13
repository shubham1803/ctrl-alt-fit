# 🍽️ Meal Tracker App - Vercel Edition

An AI-powered meal tracking application that uses your phone's camera to scan meals and calculates macros (calories, protein, carbs, fat, fiber) with step tracking.

## ✨ Features

- 📸 **Camera Scanning** - Snap photos of meals with your phone
- 🤖 **AI Analysis** - Claude AI identifies food and calculates nutrition
- 📊 **Macro Tracking** - Calories, protein, carbs, fat, fiber
- 👟 **Step Counter** - Daily step tracking (mobile only)
- 💾 **Auto-Save** - Meals saved in browser localStorage
- 🚀 **Serverless** - No server to manage, scales automatically

## 🚀 Deploy to Vercel (5 Minutes!)

### Step 1: Get Your API Key
1. Go to https://console.anthropic.com/
2. Sign up/login and navigate to "API Keys"
3. Create a new key (starts with `sk-ant-`)
4. Copy it somewhere safe

### Step 2: Push to GitHub
```bash
cd meal-tracker-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/meal-tracker-app.git
git push -u origin main
```

### Step 3: Deploy to Vercel
1. **Sign up at [vercel.com](https://vercel.com)** with your GitHub account
2. **Click "Add New Project"**
3. **Import your GitHub repository** (meal-tracker-app)
4. **Configure Project:**
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: Leave empty
   - Output Directory: `public`
5. **Add Environment Variable:**
   - Click "Environment Variables"
   - Key: `ANTHROPIC_API_KEY`
   - Value: (paste your API key from Step 1)
6. **Click "Deploy"** 🎉

Your app will be live at: `https://meal-tracker-app-xxx.vercel.app`

### Step 4: Test on Mobile!
- Open the Vercel URL on your phone
- Grant camera permissions
- Scan a meal and watch the AI analyze it!

## 🔄 Auto-Deploy Setup

Already configured! Every time you push to GitHub:
```bash
git add .
git commit -m "Added new feature"
git push
```
Vercel automatically rebuilds and deploys in ~30 seconds! ⚡

## 📁 Project Structure

```
meal-tracker-app/
├── api/
│   ├── analyze-meal.js    # Serverless function for AI analysis
│   └── health.js          # Health check endpoint
├── public/
│   └── index.html         # Frontend React app
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🛠️ Local Development

```bash
# Install Vercel CLI
npm install -g vercel

# Install dependencies
npm install

# Create .env.local file
echo "ANTHROPIC_API_KEY=your_key_here" > .env.local

# Run locally
vercel dev
```

Open http://localhost:3000

## 🌐 API Endpoints

### `GET /api/health`
Health check
```json
{
  "status": "ok",
  "message": "Meal Tracker API is running on Vercel"
}
```

### `POST /api/analyze-meal`
Analyze meal image

**Request:**
```json
{
  "imageData": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "name": "Grilled Chicken Salad",
  "items": ["grilled chicken", "lettuce", "tomatoes"],
  "calories": 350,
  "protein": 42,
  "carbs": 18,
  "fat": 12,
  "fiber": 6
}
```

## 💰 Cost Breakdown

**Hosting:** FREE (Vercel's free tier includes):
- Unlimited deployments
- Automatic HTTPS
- 100GB bandwidth/month
- Serverless functions

**AI API:** Pay-as-you-go
- ~$0.003 per image analysis
- First $5 free credit (varies)
- Typical user: ~$0.10-0.50/month

**Total:** Essentially FREE for personal use! 🎉

## 📱 How to Use

1. **Open the app** on your phone
2. **Scan or upload** a meal photo
3. **AI analyzes** the food and calculates macros
4. **Track your day** - view daily nutrition totals
5. **Enable step counter** (optional, mobile only)

## 🐛 Troubleshooting

**"ANTHROPIC_API_KEY not configured" error?**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add `ANTHROPIC_API_KEY` with your API key
- Redeploy (Deployments → ⋯ → Redeploy)

**Camera not working?**
- Grant camera permissions in your browser
- Use "Upload Photo" on desktop

**Step counter not working?**
- Only works on mobile devices with accelerometers
- Tap "Enable Step Counter" and grant permissions

**Changes not showing after git push?**
- Check Vercel dashboard for deployment status
- May take 30-60 seconds to go live
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

## 🔐 Security Notes

- API key is securely stored in Vercel environment variables
- Never exposed to the client/browser
- Serverless functions run server-side
- HTTPS enabled by default

## 🎨 Customization Ideas

- Add daily calorie goals
- Create meal history charts
- Export nutrition data to CSV
- Add barcode scanning
- Integrate with fitness apps
- Add recipe suggestions

## 📄 License

MIT License - Use freely!

## 🤝 Contributing

Pull requests welcome! Open an issue first for major changes.

## 💬 Support

Having issues? Check:
1. Vercel deployment logs
2. Browser console for errors
3. GitHub issues in this repo

---

Built with ❤️ using Claude AI, React, and Vercel
