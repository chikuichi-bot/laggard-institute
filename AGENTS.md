<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:agent-workflow -->
# Always build before finishing — including iPhone

After code changes are complete (and before the final summary / PR update), always build:

1. `mishiranu-app`: `cd mishiranu-app && npm run build`
2. **iPhone**: install/run on a connected iPhone (or Simulator if no device). Prefer the self-hosted Mac worker for `chikuichi-bot/laggard-institute` (e.g. `awashimaMacBook` / `~/Projects/laggard-institute`) when available:
   - `git fetch && git checkout <current-branch> && git pull`
   - `xcodebuild -project mishiranu-ios/MishiranuEki.xcodeproj -scheme MishiranuEki -destination 'id=<IPHONE_UDID>' build` then install/run, or open Xcode and Run to the device
   - If no physical device: `-destination 'platform=iOS Simulator,name=iPhone 16' build`
3. On Linux-only cloud VMs with no Mac worker: still run the web build; report that iPhone install needs the Mac worker / Xcode.

Do not declare the task done if the required build failed; fix or report the failure.
<!-- END:agent-workflow -->
