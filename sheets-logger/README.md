# Backlog spreadsheet setup

Every ticket copied on the form's final step is also logged to a Google Sheet, so it can be
managed as a backlog. This only needs setting up once.

## 1. Create the spreadsheet

1. Create a new Google Sheet (in your own Drive) — e.g. "UX Design Request Backlog".
2. Rename the first tab to `Tickets`.
3. Add this header row:

   ```
   Timestamp | Title | Priority | Requested By | Deadline | Sign-Off Owner | Brands | Platforms | Pages/Touchpoints | Description | Problem | Outcome | Success Measure | UX Approach | Status
   ```

## 2. Add the Apps Script

1. In the sheet, go to **Extensions → Apps Script**.
2. Delete the default code and paste in the contents of [Code.gs](Code.gs).
3. Save (the project name doesn't matter).

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. You'll be asked to authorize the script — this is expected since it's your own script. Click through
   the "Google hasn't verified this app" warning (Advanced → Go to [project name] (unsafe)) — it's safe,
   it's your own code running under your own account.
6. Copy the **Web app URL** (ends in `/exec`).

## 4. Wire it up

Send the Web app URL to whoever maintains the Worker (`worker/index.js`) — it gets set as a Cloudflare
Worker secret (`SHEETS_WEBHOOK_URL`), never committed to this repo or shipped to the browser:

```sh
cd worker
npx wrangler secret put SHEETS_WEBHOOK_URL
```

## Rotating / changing the sheet

If you ever move to a new spreadsheet, repeat steps 2–3 on the new sheet and update the
`SHEETS_WEBHOOK_URL` secret with the new deployment URL (same command as above).
