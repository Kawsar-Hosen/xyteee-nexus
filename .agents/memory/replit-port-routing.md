---
name: Replit port routing
description: Only the webview workflow port is publicly reachable via browser; other ports return a placeholder page.
---

In Replit, the workflow with `outputType = "webview"` is the one whose port is publicly accessible via the browser proxy URL. Other workflows with `outputType = "console"` are NOT reachable from the browser even if `[[ports]]` mapping exists in `.replit`.

**Why:** The public `*.pike.replit.dev` URL only routes traffic to the webview workflow's port. The `[[ports]]` section alone is insufficient to expose a second port to the browser.

**How to apply:** When a backend runs on a different port (e.g. 8000) than the public webview port (5000), run a reverse proxy on the webview port that forwards API calls internally. Frontend must use relative URLs (`/api/...`) not absolute backend URLs.
