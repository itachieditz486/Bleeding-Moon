# Building the Bleeding Moon APK with GitHub Actions (no Android Studio needed)

> **Honesty note.** The workflow in `.github/workflows/android-apk.yml` has **never been run** - it could not be, because the build environment I worked in had no access to the npm registry or the Android SDK servers, and GitHub Actions is not reachable from it. What *was* verified: the workflow YAML parses; the web game boots from the exact `www/` folder the workflow produces; the patch script edits a mock Capacitor project correctly; the generated `MainActivity.java` compiles against stub classes. The first real run may still need a fix. If it fails, open the failed run, copy the red error lines, and send them to me.
> The APK it produces is a **debug** APK (signed with the debug key, not for Play Store upload).

## What you need
* A free GitHub account. Nothing else. (No Node, Java, or Android Studio on your PC.)

## Steps
1. **Create a repository.** github.com -> **New repository** -> name it e.g. `bleeding-moon` -> **Public or Private** is fine -> *do not* tick "Add a README" -> **Create repository**.
2. **Unzip `Bleeding-Moon-Android.zip` on your computer.** Open the unzipped folder (`dark-fantasy-game`). Inside you should see `index.html`, `package.json`, `capacitor.config.json`, `src`, `assets`, and a **hidden** folder `.github`.
   * Windows: File Explorer -> View -> Show -> *Hidden items*. macOS: press `Cmd+Shift+.` in Finder.
3. **Upload the folder's *contents* (not the folder itself) to the repository.**
   * On the empty repository page click **uploading an existing file**.
   * Select everything inside the folder - including `.github` - and drag it in. The path `.github/workflows/android-apk.yml` must end up at the repository root.
   * If the browser upload skips the hidden `.github` folder: click **Add file -> Create new file**, type `.github/workflows/android-apk.yml` as the file name (typing the slashes creates the folders), paste the content of that file from the ZIP, and commit.
   * Commit message anything -> **Commit changes** (to the `main` branch).
   * Tip: GitHub's web upload accepts up to 100 files at a time. The project has about 100 files, right at that limit - if GitHub complains, upload in two batches (e.g. first `src`, `assets`, `icons`; then the rest) or use GitHub Desktop / `git push` if you have it.
4. **Watch the build.** Open the **Actions** tab. A run called **Build Android debug APK** starts automatically after the commit (if not: click the workflow on the left -> **Run workflow**). It takes roughly 5-10 minutes the first time.
   * Green check = success. **Red cross = the build failed** (the workflow never reports success if the APK is missing).
5. **Download the APK.** Click the finished run -> scroll to **Artifacts** at the bottom -> **Bleeding-Moon-debug-apk** (a ZIP containing `app-debug.apk`).
6. **Install on your phone.** Unzip, copy `app-debug.apk` to the phone (USB, Drive, etc.), open it, and allow "Install unknown apps" for the app you opened it from when Android asks. If Play Protect warns about an unknown developer, that is expected for debug builds.

## Optional but recommended: pin the dependency versions
The first run has no `package-lock.json` (it could not be generated offline), so it runs `npm install` and resolves `@capacitor/*` to the newest 6.1.x release. The run also uploads the generated lock file as a second artifact, **package-lock**. Download it and add it to the repository root; later runs then use `npm ci` and are reproducible.

## What the build does (so you can check it)
1. installs Node 20, JDK 17, the Android SDK
2. `npm install` (Capacitor 6.1.x)
3. checks required files exist and that the single-file bundler works
4. `node tools/prepare_www.mjs` -> copies the game (55 files, ~1.9 MB) into `www/`
5. `npx cap add android` -> generates the Android project
6. `python3 tools/patch_android.py` -> landscape lock, fullscreen/immersive, display-cutout mode, keep-screen-on, game icon
7. `npx cap sync android` -> `./gradlew assembleDebug` -> checks `app-debug.apk` exists -> uploads it

## Changing things
* **App name / package id:** edit `capacitor.config.json` (`appName`, `appId`, e.g. `com.yourname.bleedingmoon`) before the first run.
* **Version:** `package.json` is the web version; the Android `versionName` is Capacitor's default (1.0) - change it in `android/app/build.gradle` if you build locally.
* **Releasing to Google Play** needs a signed release build (keystore + `assembleRelease`/`bundleRelease`) - not set up here.

## Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| No workflow appears in the Actions tab | `.github/workflows/android-apk.yml` is not at the repository root (step 3) |
| "npm error 404 @capacitor/..." | Typo in `package.json` or a temporary npm outage - re-run |
| `Could not find or load main class org.gradle...` / JDK errors | Capacitor 6 needs JDK 17 - already configured; do not change `java-version` |
| `SDK location not found` | the `setup-android` step failed - re-run the job |
| APK installs but shows a blank screen | tell me; the web game itself was verified in desktop Chromium only |
| No sound until you touch the screen | expected: Android blocks audio until the first tap |
