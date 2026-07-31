# GongBoo Bible Android beta

This is a Capacitor Android shell for the live Supabase Bible app.

- Live app: `https://biblegongboo.github.io/bible/supabase/app/`
- App identifier: `org.gongboo.bible`
- Design: the app loads the live web application so quiz, content, map, and UI
  changes can be deployed from the web project without rebuilding the APK.

## One-time workstation setup

1. Install Android Studio with the Android SDK and an emulator or a physical-device driver.
2. Install JDK 21 (Android Studio's embedded JDK is suitable).
3. From this directory run `npm install` and `npx cap add android`.

## Daily beta build

```powershell
npm run android:sync
npm run android:open
```

Android Studio can run the app on a connected Android phone. For a locally
installable beta APK, use `Build > Build APK(s)` in Android Studio.

The final Play Store build will add a signed release key, store listing assets,
privacy-policy link, and Android verification before publishing.
