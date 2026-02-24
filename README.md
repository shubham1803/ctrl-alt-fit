# CTRL-ALT-FIT

Cross-platform meal tracker that now runs on:
- iOS (Expo / React Native)
- Android (Expo / React Native)
- Web (React Native Web)

Backend APIs remain in `api/` for Vercel serverless deployment.

## Stack

- Expo + React Native + TypeScript
- React Native Web for website runtime
- Vercel serverless functions for AI meal analysis/invites
- Gemini model via `api/analyze-meal.js`

## Project Structure

```txt
.
├── App.tsx                  # Expo cross-platform app entry
├── src/
│   ├── api.ts               # API client
│   ├── constants.ts         # App constants
│   ├── storage.ts           # AsyncStorage helpers
│   └── types.ts             # Shared types
├── api/
│   ├── analyze-meal.js      # Gemini meal analysis API
│   ├── send-group-invite.js # Group email invite API
│   ├── config.js
│   └── health.js
├── app.json                 # Expo app config
├── eas.json                 # EAS build/submit profiles
└── public/                  # Existing web assets/icons
```

## Environment Variables

Use `.env` (local) or your CI/CD provider env settings:

```bash
GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_API_BASE_URL=https://your-domain.vercel.app
```

Notes:
- `EXPO_PUBLIC_API_BASE_URL` is required for native apps (Android/iOS).
- On web, if hosted with the API on same origin, it can be left empty.

## Run Locally

```bash
npm install
npm run start      # Expo dev server
npm run web        # Open web target
npm run android    # Run Android native project
npm run ios        # Run iOS native project (macOS + Xcode)
```

To run Vercel APIs locally in a separate terminal:

```bash
npm run dev:api
```

## Publish

### Play Store / App Store (EAS)

1. Login and create EAS project:
   ```bash
   npx expo login
   npx eas init
   ```
2. Build production binaries:
   ```bash
   npx eas build --platform android --profile production
   npx eas build --platform ios --profile production
   ```
3. Submit:
   ```bash
   npx eas submit --platform android --profile production
   npx eas submit --platform ios --profile production
   ```

Detailed release checklist:
- `STORE_RELEASE_CHECKLIST.md`

## What Was Migrated

- Core meal logging UI
- Camera/gallery meal scan flow
- Gemini meal analysis API integration
- Daily macro totals
- Native pedometer-based step tracking
- Daily step persistence/reset

## Important Next Steps Before Store Submission

1. Replace placeholder bundle/package IDs in `app.json`.
2. Add production app icons/splash assets.
3. Configure Apple/Google sign-in natively if required.
4. Run device QA on physical iOS/Android phones.
