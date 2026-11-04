# GitHub Pages relay setup

The GitHub Pages frontend uses a Google Apps Script web app as a small server-side relay. The browser talks to the relay iframe; Apps Script forwards the request to the Cloudflare Worker, which remains the only application API and writes to Cloudflare D1.

This keeps the customer and manager browsers from calling the Cloudflare Worker domain directly. GitHub Pages itself is static and cannot execute server-side code, so a relay is required.

## One-time setup

1. Open [Google Apps Script](https://script.google.com/) and create a blank project named **Salon Booking Relay**.
2. Replace the default script with the contents of [`relay/Code.gs`](../relay/Code.gs).
3. Add an HTML file named **Bridge** and paste [`relay/Bridge.html`](../relay/Bridge.html).
4. In the Apps Script editor, select and run **`authorizeRelay`** once. Approve the Google authorization prompt. The function only checks the Worker health endpoint.
5. Choose **Deploy → New deployment → Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**, then deploy and copy the web-app URL ending in `/exec`.
7. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and create:
   - Name: `SALON_RELAY_URL`
   - Value: the Apps Script web-app `/exec` URL.
8. Re-run the **Deploy preview to GitHub Pages** workflow.

The URL is a public endpoint, not a credential. Do not put passwords, Worker secrets or API tokens in GitHub variables.

## How it works

- GitHub Pages hosts the complete public site and manager interface.
- A hidden Apps Script iframe receives API messages from the page.
- Apps Script calls the fixed Cloudflare Worker URL server-to-server.
- The Worker validates requests, performs scheduling logic and reads/writes D1.
- Admin session cookies are retained in the Apps Script cache and keyed by a random browser relay-session identifier. The browser never receives or stores the Worker cookie.
- The Apps Script cache expires after six hours; the manager may need to sign in again after that period.

## Important boundaries

- Apps Script is an additional Google dependency. This design avoids direct browser-to-Cloudflare traffic, but does not guarantee that every ISP/network in Iran will always reach Google Apps Script.
- The first deployment must be authorized and published by the project owner; this repository cannot deploy into a Google account that has not been connected.
- The GitHub Pages site remains demo-only until the `SALON_RELAY_URL` repository variable is set and a new Pages build is deployed.
- This relay is intended for the low-volume salon workload, not high-throughput production traffic.
