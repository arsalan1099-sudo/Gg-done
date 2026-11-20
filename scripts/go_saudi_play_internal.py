#!/usr/bin/env python3
"""Upload an owner-signed Go Saudi AAB to a DRAFT internal testing release.

Prerequisites:
- The app must already have its FIRST app bundle uploaded in Play Console.
- Google Play Developer API enabled, and a service account invited in
  Play Console with access to the Go Saudi app and release permission.
- The input bundle must be signed with the Play Console registered upload key.
- Credentials must come only from a CI secret, not Git source or command line.

This script never releases to production and never rolls out to users.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from zipfile import ZipFile


PACKAGE = "com.aasaa.gosaudi"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("aab", type=Path)
    parser.add_argument("--submit-draft", action="store_true",
                        help="Commit a Play INTERNAL-track DRAFT edit; default is local validation only")
    args = parser.parse_args()
    bundle = args.aab.resolve()
    if not bundle.is_file() or bundle.suffix.lower() != ".aab":
        parser.error("Input must be an existing .aab file")

    with ZipFile(bundle) as archive:
        if archive.testzip() is not None:
            parser.error("Android App Bundle contains corrupted files")
        if "base/manifest/AndroidManifest.xml" not in archive.namelist():
            parser.error("Missing base/manifest/AndroidManifest.xml")

    sha256 = hashlib.sha256(bundle.read_bytes()).hexdigest()
    print("Bundle:", bundle.name)
    print("Size:", bundle.stat().st_size, "bytes")
    print("SHA256:", sha256)
    print("Target package:", PACKAGE)
    print("Target track: internal, release status: draft")

    if not args.submit_draft:
        print("Preflight only. No Google Play API calls were made.")
        return

    raw = os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "")
    if not raw.strip():
        parser.error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret is required")
    try:
        account_data = json.loads(raw)
        if account_data.get("type") != "service_account":
            raise ValueError("Not a service account JSON object")
    except (ValueError, json.JSONDecodeError) as exc:
        parser.error("Invalid service account configuration: " + str(exc))

    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    credentials = service_account.Credentials.from_service_account_info(
        account_data, scopes=[SCOPE])
    service = build("androidpublisher", "v3", credentials=credentials,
                    cache_discovery=False)
    edit = service.edits().insert(packageName=PACKAGE, body={}).execute()
    edit_id = edit["id"]
    print("Created Google Play edit. Uploading signed bundle...")

    media = MediaFileUpload(str(bundle), mimetype="application/octet-stream",
                            resumable=True, chunksize=8 * 1024 * 1024)
    request = service.edits().bundles().upload(
        packageName=PACKAGE, editId=edit_id, media_body=media)
    result = None
    while result is None:
        progress, result = request.next_chunk(num_retries=3)
        if progress is not None:
            print("Upload progress:", round(progress.progress() * 100), "%")
    version_code = result["versionCode"]
    print("Google Play accepted bundle version code:", version_code)

    # Commit a draft in INTERNAL ONLY. Never submit to production automatically.
    release = {
        "name": "Go Saudi v0.2.2 - Internal Test",
        "versionCodes": [str(version_code)],
        "status": "draft",
        "releaseNotes": [{
            "language": "en-US",
            "text": "Prelaunch test. Payments, orders and Saudi SMS sign-in are disabled."
        }]
    }
    service.edits().tracks().update(
        packageName=PACKAGE, editId=edit_id, track="internal",
        body={"track": "internal", "releases": [release]}
    ).execute()
    service.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
    print("SUCCESS: Google Play edit committed as INTERNAL TESTING DRAFT only.")
    print("Verify the draft in Google Play Console; it is NOT a public launch.")


if __name__ == "__main__":
    main()
