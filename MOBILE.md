# Native iOS / Android build (Capacitor)

`my'myon` ships as a native app via [Capacitor](https://capacitorjs.com). The
React + Vite web app is wrapped in a native shell so the same codebase runs in
the browser, on iOS, and on Android — all backed by the shared Lovable Cloud
backend.

## One-time setup (on your local machine)

You need a Mac for iOS builds (Xcode) and Android Studio for Android.

1. **Export the project to GitHub** from the Lovable editor (top right → Export to GitHub).
2. **Clone** the repo locally and `cd` into it.
3. Install deps:
   ```bash
   npm install
   ```
4. Add the native platforms (only needs to be done once per platform):
   ```bash
   npx cap add ios
   npx cap add android
   ```
5. Build the web bundle and sync into native projects:
   ```bash
   npm run build
   npx cap sync
   ```

## Running on a device / simulator

```bash
# iOS — opens Xcode
npx cap run ios

# Android — opens Android Studio
npx cap run android
```

During development the app uses **hot reload** from the Lovable preview URL
(configured in `capacitor.config.ts` under `server.url`). You can edit code in
Lovable and the native shell will reload — no rebuild needed.

## Production builds (App Store / Play Store)

Before shipping to stores, **remove the `server.url` block** from
`capacitor.config.ts` so the app loads the bundled `dist/` instead of the
Lovable preview, then:

```bash
npm run build
npx cap sync
npx cap open ios       # archive in Xcode
npx cap open android   # generate signed AAB in Android Studio
```

## After every code change

```bash
git pull               # pull latest from Lovable
npm install            # if deps changed
npm run build
npx cap sync
```

## Native features wired up

| Feature              | Plugin                              | Helper                        |
|----------------------|-------------------------------------|-------------------------------|
| Camera + photo lib   | `@capacitor/camera`                 | `src/lib/native/camera.ts`    |
| Push notifications   | `@capacitor/push-notifications`     | `src/lib/native/push.ts`      |
| Platform detection   | `@capacitor/core`                   | `src/lib/native/platform.ts`  |

All native helpers no-op safely on the web build.

## Push notifications — production checklist

- **iOS**: Apple Push Notifications service (APNs) key uploaded in Apple
  Developer portal; bundle ID `com.mymyon.app` matches the App ID.
- **Android**: Firebase Cloud Messaging project; drop `google-services.json`
  into `android/app/`.
- Create a Lovable Cloud edge function `register-device-token` that stores the
  token + `user_id` so you can target users from the backend.

Read more: <https://lovable.dev/blogs/TODO>
