# Store Release Checklist (Android + iOS + Web)

## 1) Prerequisites

- Apple Developer account (active)
- Google Play Console account (active)
- Expo account + EAS CLI installed
- Backend deployed on Vercel with env vars:
  - `GEMINI_API_KEY`
  - `RESEND_API_KEY` (if using invite emails)
  - `INVITE_FROM_EMAIL` (if using invite emails)
- App frontend env var:
  - `EXPO_PUBLIC_API_BASE_URL=https://YOUR_API_DOMAIN`
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## 2) One-time project setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Login + initialize EAS:
   ```bash
   npx expo login
   npx eas init
   ```
3. Verify native identifiers in `app.json`:
   - `ios.bundleIdentifier`
   - `android.package`

## 3) Local QA

1. Web run:
   ```bash
   npm run web
   ```
2. Android native run:
   ```bash
   npm run android
   ```
3. iOS native run:
   ```bash
   npm run ios
   ```
4. Validate core flows:
   - Meal scan/upload + AI analysis
   - Step counter enable/disable
   - Groups create/open
   - Leaderboard updates with steps
   - Chat send text/media/sticker
   - Invite by email (`/api/send-group-invite`)
   - Dark/light/system theme visibility

## 4) Build production binaries

```bash
npm run eas:build:android
npm run eas:build:ios
```

## 5) Submit to stores

```bash
npm run eas:submit:android
npm run eas:submit:ios
```

## 6) Required store metadata

- App title: `CTRL-ALT-FIT`
- Short and full descriptions
- Privacy policy URL
- Support URL/email
- Feature graphics/screenshots (phone sizes required by each store)
- App icon and splash (already wired in `assets/`)

## 7) Compliance checks

- Ensure all permission prompts are justified in-app:
  - Camera
  - Photos
  - Microphone
- Confirm user data handling + deletion policy
- Ensure terms/privacy links are accessible in app or store listing

## 8) Web deployment

- Backend/API remains on Vercel (`api/` routes)
- Expo web build command:
  ```bash
  npm run build:web
  ```
- Host exported web build on your preferred static host (or integrate with existing deployment flow)

## 9) Final release gate

- TestFlight + Internal testing passed
- Crash-free smoke tests on at least 2 iOS + 2 Android devices
- Verified production API keys and invite email sender
- Tag release in git and publish
