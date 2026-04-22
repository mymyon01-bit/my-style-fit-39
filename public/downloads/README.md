# Native app builds

Drop the production APK here as `mymyon.apk` and the `/install` page's
"Download for Android" button will serve it directly.

## Build the APK

```bash
npm run build
npx cap sync android
npx cap open android
# In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
# Copy the generated app-release.apk → public/downloads/mymyon.apk
```

iOS cannot be sideloaded — the `/install` page shows TestFlight / App Store
instructions instead.
