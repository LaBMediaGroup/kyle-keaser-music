# Sweet Babe · Kyle Keaser

Booking site for Sweet Babe, Kyle Keaser's live acoustic act (Metro Detroit). One page, no build step: `index.html` + `assets/`.

- **Booking email:** `BOOKING_EMAIL` at the bottom of the script (and the plain link by the Send button).
- **Record player:** set `AUDIO.song` to a file Kyle has approved, in `assets/audio/`. Left empty, the play button stays hidden.
- **Credits:** style, set length and PA rows are commented out in the liner notes until Kyle answers.
- **Shows / clips:** `SHOWS` and `VIDEOS` in the script. Only clips Kyle has approved.
- **What's the occasion? cards:** the wording for bars, weddings, parties and company events is in `ROOMS` in the script (`bar`, `wed`, `party`, `corp`). Keep it to what Kyle has said he does.
- **Booking form:** quick taps for the occasion and solo or band, plus date, start time and place. The mailer puts all of it in Kyle's email.
- **Flyer:** after a request is sent (with a date), the thank-you shows a flyer drawn in the browser from what they typed (`FLYER` in the script). Four looks, made from Kyle's own photos.
- **Show alerts ("Catch him live"):** `FOLLOW` in the script switches it on or off. Emails are kept by the mailer. See the list with `npx wrangler kv key list --binding STATS --prefix fan: --remote` (run in `mailer/`).
- **Shows list:** each `SHOWS` entry needs `public: true` to appear anywhere (the "Upcoming shows" list, liner notes, "Next show" pill). No flag means private, so weddings and parties never show. Optional `act: 'solo'` or `'band'`; `room` (a key of `ROOMS`) adds a Map link.
- **Link-preview picture:** `assets/share.jpg`, made from `tools/share-card.html`.

## Show alerts

Emails the "Catch him live" list when a show goes up. Needs the mailer deployed (`cd mailer && npx wrangler deploy`) and two secrets set once: `npx wrangler secret put ANNOUNCE_SECRET` and `npx wrangler secret put UNSUBSCRIBE_SECRET` (any long random strings; `RESEND_API_KEY` is already used for bookings).

1. **Add the show** to `SHOWS` in `index.html` and set `public: true`. Only add dates Kyle has confirmed. Push, so the site lists it.
2. **Dry run** (sends nothing; shows the recipient count and the email):
   ```
   curl -X POST https://<mailer-url>/announce -H "Authorization: Bearer $ANNOUNCE_SECRET" \
     -d '{"dryRun":true,"show":{"public":true,"date":"2026-12-12","time":"8:30 pm","venue":"Venue","city":"Town","act":"band","map":"street address, town, MI"}}'
   ```
3. **Announce**: the same command without `"dryRun":true`. It mails every `fan:` address, each with its own unsubscribe link, and records `sent:<date>:<venue>` so the same show can't be announced twice (a repeat returns "Already announced"). A show without `"public":true`, or one already past, is refused. If every send fails (bad key), nothing is recorded and you can retry.

Unsubscribe links (`/unfollow?e=…&t=…`) are signed, delete that address and show a short confirmation. See the email: `mailer/preview/show-alert.html` (a fake sample show).

Hosted with GitHub Pages from `main` / root at https://sweetbabemusic.com (`CNAME`).
