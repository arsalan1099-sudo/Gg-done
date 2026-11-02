# Go Saudi Android testing APK

This is a prelaunch UI testing build, not a finished marketplace or store release.

## Build

Run `.github/workflows/go-saudi-apk.yml` on `go-saudi`. It generates the Expo native project and builds `assembleRelease` for ARM64 with the generated development signing key. JavaScript is embedded, so Metro and Expo Go are not needed. No EAS account, production upload key or Go Bharat signing credentials are used.

The workflow verifies the APK signature and package `com.aasaa.gosaudi`, then uploads `Go-Saudi-Testing-APK` containing the APK, manifest summary, certificate summary and SHA-256 checksum. Artifact availability requires a successful workflow. Do not treat a queued build as an available APK.

## Device acceptance checklist

Real-device execution is not yet verified. On an ARM64 Android phone:

1. Download and install Go-Saudi-Testing.apk. If prompted, allow installation from the downloading app temporarily, then turn that setting back off.
2. Launch with mobile data/Wi-Fi off: the Arabic prelaunch screen should render without Expo Go.
3. Switch Arabic/English and verify text, scrolling, city/category selection and keyboard layout.
4. Confirm a clear prelaunch notice. Purchases and payments must remain unavailable.
5. With the Saudi API URL blank, seller submission must remain unavailable and must not report a saved enquiry.
6. Reopen the app and check for crashes. No camera, contacts, microphone or location permission prompt should appear.
7. Opening `gosaudi://payment` or an inherited customer/vendor route must not expose the Go Bharat commerce screens.

Report phone model, Android version, steps and screenshots for failures. Use fictitious data during testing. The test signing key is unsuitable for production. A later production-signed app may require uninstalling this test build.

## Remaining production work

No deployed Saudi backend was found in the connected Render workspace during this pass. Live registration needs a separately deployed Saudi backend/database and appropriate configuration. The native app currently contains only the prelaunch screen; the web vendor draft portal is not a complete native vendor panel. Public catalogue, buyer accounts, orders, Saudi payment integration, refunds, fulfilment and full native seller flows remain to be implemented and tested. Store signing, store records and review/submission are also pending.

Local checks on 2 November 2026: Saudi mobile config gate passed; 17 Saudi unit tests passed; server compilation passed; Android Hermes JavaScript export passed. CI run 41489175593 passed the repository's wider Saudi verification workflow. These checks do not establish on-device correctness or production readiness.
