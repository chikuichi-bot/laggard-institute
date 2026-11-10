<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:agent-workflow -->
# Always build before finishing

After code changes are complete (and before the final summary / PR update), always run a build:

- `mishiranu-app`: `cd mishiranu-app && npm run build`
- `mishiranu-ios`: on macOS run an Xcode build (`xcodebuild -project mishiranu-ios/MishiranuEki.xcodeproj -scheme MishiranuEki -destination 'generic/platform=iOS' build`). On Linux cloud VMs, Xcode is unavailable — still run the web build if app files changed, and note that the iOS build must be verified in Xcode on a Mac.

Do not declare the task done if the required build failed; fix or report the failure.
<!-- END:agent-workflow -->
