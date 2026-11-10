# Go Saudi — Google Play test distribution runbook

Last reviewed: 2026-11-10. App: Go Saudi (`com.aasaa.gosaudi`), version `0.2.2`, Android `versionCode 4`.

## Goal

Test Go Saudi on HONOR / Android phones without asking people to install unverified APK files from WhatsApp. Use **Google Play Console** for distribution, never claim that an unsigned, test-signed or unreviewed build is official.

The current Go Saudi build is **prelaunch**: B2B/B2C/Services/Manpower/Travel category browsing, 109 subcategories, bilingual UI, and a Saudi phone account screen. Real OTP needs a separate approved Saudi HTTPS backend and Twilio Verify; orders and payments are disabled. Never misrepresent these capabilities in Play Store descriptions, privacy answers or screenshots.

## Two different testing methods — do not confuse them

### A. Google Play Internal App Sharing (test build)

Automated CI workflow:
`.github/workflows/go-saudi-play-internal-sharing.yml`

This workflow generates `Go-Saudi-Internal-Sharing-TEST-ONLY.aab`, verifies it has a valid AAB manifest, JS bundle, jar signature, and SHA-256 checksum, and uploads a short-lived GitHub artifact.

- The output is **TEST signed** with the generated Gradle debug/test certificate (not the owner-controlled persistent Google Play upload key).
- It is **not** suitable for the regular Google Play internal, closed or production tracks.
- It may be uploaded to **Play Console > Internal app sharing**, which accepts test artifacts and re-signs uploaded packages with a test-sharing certificate. Google Play developer access and eligibility are required.
- The Play Console owner must upload the AAB there, choose who may open the link, copy the newly generated tester URL, and send **that** URL. This CI job does not upload it, create a link or enroll users.
- On some phones testers may have to enable internal app sharing in the Google Play Store app first. On HONOR phones that do not have Google Play Services, Play-based testing may be unavailable.
- For a device already containing a WhatsApp-installed test APK, installing a version with a different signing key may require uninstalling the old app first. Uninstall may erase local app data.
- Internal App Sharing test packages should never be represented as Play Store production-approved apps.

Official Google Play overview: https://google.play/business/internalappsharing/
Help: https://support.google.com/googleplay/android-developer/answer/9844679

### B. Regular Google Play Internal Testing (release-signing)

GitHub Actions workflow:
`.github/workflows/go-saudi-play-release-eas.yml`

The workflow is **manually triggered**, runs mobile safety tests, requires a valid owner Expo project ID `expo.extra.eas.projectId` and `EXPO_TOKEN` GitHub Actions secret, and calls `eas build --platform android --profile production --non-interactive --wait`.

- Build uses **permanent owner-managed EAS remote Android signing credentials**. Before the first non-interactive build, the owner must link Expo project and set up the signing key via Expo.
- The existing `eas.json` already specifies Android `app-bundle`, remote credentials, internal submission track and draft release status.
- This build prepares a correctly signed bundle in Expo; it does **not** automatically submit to Google Play and never creates a public rollout.
- The owner must have a Google Play Developer account, create or select the `com.aasaa.gosaudi` app, enroll in Play App Signing, complete required app content/data safety/privacy details, and upload the EAS AAB under **Testing > Internal testing**.
- Testers must be granted access and use the Play opt-in/install link. Review and eligibility requirements still apply.
- For future automated **draft** submission, securely connect a Google Play Android Publisher service-account credential to Expo EAS Submit. Do not commit JSON keys or paste them into chat.
- If the existing Play app is registered under a different package, owner, upload certificate or signing lineage, reconcile those before attempting to upload.

EAS docs: https://docs.expo.dev/tutorial/eas/android-production-build/
Android Submit: https://docs.expo.dev/submit/android/
Android signing: https://developer.android.com/studio/publish/upload-bundle

## Google Play draft listing (copy only after confirming details)

App name: **Go Saudi**
Category: Shopping
Default language: Arabic; English supported.
Draft short description: Discover Saudi marketplace categories and explore local shopping services.
Draft full description:
Go Saudi helps users explore marketplace categories for Saudi Arabia in Arabic or English. Browse B2B wholesale, B2C shopping, local services, manpower and travel categories in one organized mobile experience. This is an early testing release: checkout, live orders, regulated services and payments are not currently available. Customer SMS sign-in becomes available only after account verification and an approved secure backend are activated.

Before any Play submission, **verify or provide**, do not invent: developer's legal business name and address, support email, website, working publicly accessible privacy policy URL, data safety declarations and deletion-request pathway, Saudi legal/hosting review, verified app screenshots from the current build, content rating, country distribution and tester list.

Suggested draft internal test notes:
- Test Arabic/English switching, category browsing and search
- Verify GS launcher icon and navigation on different Android/HONOR screen sizes
- Test locked account state without configured Saudi OTP server
- Confirm no checkout, payments or real orders are available
- Submit screenshots of cut-off labels, overlapping cards and display/RTL defects

## Blockers and non-negotiable safeguards

1. No Google Play Console connection/account ownership or EAS Expo project credentials were verified in this conversation. The workflows are preparation, **not Play publication**.
2. The default testing builds set `EXPO_PUBLIC_SAUDI_API_URL=""`; OTP stays unavailable. Never substitute a fake SMS code to make a build look ready.
3. Do not merge Go Saudi's isolated database or secrets with the existing Go Bharat app.
4. Do not change Play Store signing/upload keys between releases without using the owner's approved key rotation process.
5. Do not assume official Play distribution suppresses HONOR security warnings on all devices; independently test the Play delivery path on the specific phone.
