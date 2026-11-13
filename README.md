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
- **Link-preview picture:** `assets/share.jpg`, made from `tools/share-card.html`.

Hosted with GitHub Pages from `main` / root at https://sweetbabemusic.com (`CNAME`).
