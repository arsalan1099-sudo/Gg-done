# Go Saudi privacy notice — Android Alpha 0.2.2 (build 4)

**Draft for operator review, 22 November 2026.** This notice covers the Android marketplace preview operated by AASAA Pvt Ltd.

## Browsing and saved items

You can explore Saudi shopping and service categories. The app uses local storage for shopping selections such as saved items and cart contents. Clearing Go Saudi’s app storage in Android settings removes this local information. The preview does not process orders or payments or provide a wallet or reward points.

## Optional features that depend on the service

When a Saudi service is configured, the app can request catalogue information over HTTPS. Where phone sign-in is enabled, requesting a verification code sends the mobile number and consent to the Saudi service. Verification sends the number and code. On successful sign-in, the app stores a session token in secure storage on the device. Signing out removes the local session token.

Where seller enquiries are enabled, the form asks for a business name, Saudi mobile number, city, business category and permission to contact the seller about onboarding. A completed submission sends these details to the Saudi service. Selecting a city in this form is manual. Build 4 does not request Android precise or approximate location permission.

## Advertising

The preview does not display ads or use the Android advertising ID.

## Contact and deletion

Proposed operator contact for questions and requests to delete any server-side information: aasaa.pvt.ltd@gmail.com. Clearing app storage affects local information. Do not include a verification code or password in a request.

## Information to confirm before publication

Confirm the release binary’s configured API origin and enabled services, the provider that receives live SMS requests (if any), any hosting or SDK logs and identifiers, what is retained and for how long, deletion handling including backups, and the monitored privacy contact. Resolve the conditional sections for the actual release and remove this review section before using the public URL in Play Console.
