# Expense Tracker

Add expenses by hand or from a receipt screenshot (AI reads it, you confirm), view month-by-month metrics,
set a monthly limit with Gmail alerts, and download an Excel file with one sheet per month.

## Deploy (Vercel)
1. Import this folder as a Vercel project (no build step).
2. Add environment variables:
   - `GMAIL_USER` – your Gmail address
   - `GMAIL_APP_PASSWORD` – Google Account > Security > 2-Step Verification > App passwords
   - `ALERT_EMAIL` – optional, where alerts go (defaults to GMAIL_USER)
   - `ANTHROPIC_API_KEY` – for receipt reading
   - `APP_PASSCODE` – recommended, so strangers cannot use your email/API key; enter the same value in Settings
3. Deploy, open the URL, go to Settings, set your limit and tap "Send test email".

Data lives in the browser (IndexedDB) on each device. Use the Excel download or JSON backup to keep copies.

## Install on your phone (PWA)
- **iPhone:** open the deployed URL in Safari, tap Share, then "Add to Home Screen".
- **Android:** open it in Chrome, tap the install prompt, or menu (⋮) then "Install app". Settings also has an Install button.
- The app shell works offline; receipt reading and Gmail alerts need a connection.

## Files
- `index.html` app, `manifest.webmanifest` + `sw.js` PWA, `icons/` app icons, `api/` serverless functions.
