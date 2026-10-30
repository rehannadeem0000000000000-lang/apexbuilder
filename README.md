# ApexBuilder · Cloud APK Forge

Upload an HTML file or ZIP project, configure the Android app (permissions, icon, splash,
protection, signing) and get a **signed APK compiled on a GitHub Actions runner**.
No on-device compilation, ever.

```
┌────────────────   contents API    ┌──────────────────────┐
│ ApexBuilder    │ ────────────────▶ │ farm repo            │
│ (web console / │   config.json     │  projects/<id>/      │
│  Android app)  │   + source        │  capacitor-template/ │
└────────────────┘                    │  scripts/            │
       ▲                              └──────────┬───────────┘
       │  artifact download                      │ workflow_dispatch
       └──────────────┌──────────────────────────▼───────────┐
                      │ build-apk.yml (GitHub Actions)       │
                      │  stage → configure → gradle → sign   │
                      └──────────────────────────────────────┘
```

## Repository layout

| Path | What it is |
| --- | --- |
| `src/` | ApexBuilder **web console** (Next.js): 3-step wizard, project history, live runner logs |
| `android-app/` | Native **Kotlin / Jetpack Compose** client (Step 1–3 UI, GitHub REST client, MediaStore download) |
| `.github/workflows/build-apk.yml` | The **cloud builder** — triggered per project |
| `.github/workflows/build-frontend.yml` | Builds the Android *client* itself so you can download ApexBuilder.apk |
| `scripts/configure_project.py` | Parses `config.json`, rewrites the wrapper (permissions, app links, colors, splash, icon, R8) |
| `capacitor-template/` | Base Capacitor/WebView project the CI modifies |

## Farm setup (5 minutes)

1. Push this repo to a GitHub repository (it *is* the farm repo).
2. Create a personal access token with **Contents: read/write** + **Actions: read**.
3. Generate the release keystore once and store it as repo secrets:
   ```bash
   keytool -genkeypair -v -keystore apex-release.keystore \
     -alias apex -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass apex -keypass apex
   base64 -i apex-release.keystore > apex.key
   ```
   Secrets: `APEX_KEYSTORE_B64` (the base64), `APEX_KEYSTORE_PASS=apex`,
   `APEX_KEY_ALIAS=apex`, `APEX_KEY_PASS=apex`.
   *(Without the secret, builds still succeed — signed with the auto debug keystore.)*
4. Open the web console → **Settings** → paste token + owner + repo. Done.

## Pipeline (build-apk.yml)

1. **Stage sources** — copies `projects/<id>/` (source + config.json) and the template into `work/`.
2. **Prepare signing** — materializes the keystore from secrets (or the client's owner key).
3. **Configure project** — `scripts/configure_project.py`:
   - injects `<uses-permission>` tags exactly as toggled in the client,
   - adds the `android:autoVerify` App Links intent-filter,
   - rewrites `applicationId`, `capacitor.config.json` (remote URL, https scheme for offline cache),
   - generates `strings.xml`, `colors.xml`, splash drawable/MP4, all mipmap densities,
   - writes `proguard-apex.txt` (R8 full mode for Dex2C, repackage/obfuscate for string protection),
   - writes `google-services.json` + applies the GMS plugin when Google Sign-In is on.
4. **Build release** — `./gradlew assembleRelease` (or `bundleRelease` for AAB).
5. **Sign & verify** — apksigner verification + upload as a GitHub artifact.

The client polls `GET /actions/runs/{id}` + `…/jobs`, tails the step logs, then pulls the
artifact and saves it (`/sdcard/Download/` on Android, browser Downloads on web).

## Build the Android client

Hit **Run workflow → Apex Frontend · Build Client APK** (or tag `client-v*`) and download
`ApexBuilder-client-release` from the run's artifacts.
