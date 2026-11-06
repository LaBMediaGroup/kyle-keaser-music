// The booking email Kyle receives. Table layout + inline styles so it holds up in Gmail, Apple Mail and Outlook.
// Colours match the site: ink #0b0a08, sun #DED63D, paper #f2eedf, muted #9e9885.

const INK = '#0b0a08', INK2 = '#15130f', INK3 = '#1c1914', SUN = '#DED63D', PAPER = '#f2eedf', MUTED = '#9e9885', LINE = '#2b2822';
const SERIF = `'Instrument Serif',Georgia,'Times New Roman',serif`;
const SANS = `'Bricolage Grotesque',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// '2026-12-12' → 'Saturday, December 12, 2026' (read as a calendar date, so no time-zone shift)
export function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function renderEmail({ name, email, date, venue, msg }, { site = 'https://sweetbabemusic.com' } = {}) {
  const first = (name || '').trim().split(/\s+/)[0] || 'them';
  const when = prettyDate(date);
  const subject = `Booking request: ${when || 'date open'}${venue ? ' · ' + venue : ''} (${name})`;
  const replySubject = encodeURIComponent(`Re: Sweet Babe booking${when ? ', ' + when : ''}`);
  const replyHref = `mailto:${encodeURIComponent(email)}?subject=${replySubject}`;
  const note = esc(msg || '').replace(/\r?\n/g, '<br>');

  const row = (label, value) => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px dashed ${LINE};font:600 11px/1.3 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${MUTED};width:96px;vertical-align:top">${label}</td>
            <td style="padding:12px 0;border-bottom:1px dashed ${LINE};font:400 16px/1.4 ${SANS};color:${PAPER};vertical-align:top">${value}</td>
          </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root{color-scheme:dark}
  a{color:${SUN}}
  @media (max-width:520px){ .pad{padding-left:22px!important;padding-right:22px!important} .when{font-size:34px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:${INK};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(name)} wants to book Sweet Babe${when ? ' for ' + esc(when) : ''}${venue ? ' at ' + esc(venue) : ''}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK}">
  <tr><td align="center" style="padding:28px 12px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

      <!-- kicker -->
      <tr><td align="center" style="padding:0 0 22px;font:600 11px/1 ${SANS};letter-spacing:.28em;text-transform:uppercase;color:${MUTED}">
        Sweet Babe &nbsp;<span style="color:${SUN}">&#9679;</span>&nbsp; Booking request
      </td></tr>

      <!-- the card -->
      <tr><td style="background:${INK2};border:1px solid ${LINE};border-radius:22px;overflow:hidden">

        <!-- the record: logo as the label -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:36px 20px 6px;background:${INK2};background-image:radial-gradient(70% 90% at 50% 0%,rgba(222,214,61,.16),rgba(21,19,15,0) 70%)">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:150px;height:150px;border-radius:50%;background:#0d0c0a;background-image:repeating-radial-gradient(circle,#0d0c0a 0 1.6px,#1a1813 1.6px 3.2px);box-shadow:0 18px 40px rgba(0,0,0,.6);text-align:center;vertical-align:middle">
                <img src="${site}/assets/logo.jpg" width="74" height="74" alt="Sweet Babe" style="display:inline-block;width:74px;height:74px;border-radius:50%;border:4px solid #0a0907;outline:1px solid rgba(222,214,61,.35)">
              </td>
            </tr></table>
          </td></tr>
        </table>

        <!-- the headline -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="pad" align="center" style="padding:22px 40px 6px">
            <div style="font:600 12px/1 ${SANS};letter-spacing:.2em;text-transform:uppercase;color:${SUN}">${when ? 'Wants the date' : 'Date still open'}</div>
            <div class="when" style="margin-top:12px;font:italic 400 40px/1.08 ${SERIF};color:${PAPER}">${esc(when || 'Ask them when')}</div>
            ${venue ? `<div style="margin-top:10px;font:400 18px/1.35 ${SANS};color:${SUN}">${esc(venue)}</div>` : ''}
            <div style="margin-top:18px;font:400 16px/1.5 ${SANS};color:${MUTED}">from <b style="color:${PAPER};font-weight:600">${esc(name)}</b></div>
          </td></tr>
        </table>

        <!-- liner-notes details -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="pad" style="padding:22px 40px 4px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px dashed ${LINE}">
              ${row('Name', esc(name))}
              ${row('Email', `<a href="mailto:${esc(email)}" style="color:${SUN};text-decoration:none">${esc(email)}</a>`)}
              ${row('Date', esc(when || 'Not picked yet'))}
              ${row('Where', esc(venue || 'Not said yet'))}
            </table>
          </td></tr>
        </table>

        <!-- their message -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="pad" style="padding:22px 40px 6px">
            <div style="font:600 11px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:10px">The event</div>
            <div style="background:${INK3};border-left:3px solid ${SUN};border-radius:4px 12px 12px 4px;padding:16px 18px;font:400 16px/1.55 ${SANS};color:${PAPER}">${note || `<span style="color:${MUTED};font-style:italic">They didn't add any details.</span>`}</div>
          </td></tr>
        </table>

        <!-- reply -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:28px 24px 36px">
            <a href="${replyHref}" style="display:inline-block;background:${SUN};color:${INK};font:800 16px/1 ${SANS};text-decoration:none;padding:17px 30px;border-radius:999px">Reply to ${esc(first)} &rarr;</a>
            <div style="margin-top:14px;font:400 13px/1.5 ${SANS};color:${MUTED}">Or just hit reply. It goes straight to ${esc(first)}.</div>
          </td></tr>
        </table>

      </td></tr>

      <!-- footer -->
      <tr><td align="center" style="padding:22px 20px 0;font:400 12px/1.6 ${SANS};color:${MUTED}">
        Sent from the booking form at <a href="${site}" style="color:${MUTED}">sweetbabemusic.com</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `New booking request for Sweet Babe`,
    ``,
    `Name:  ${name}`,
    `Email: ${email}`,
    `Date:  ${when || 'Not picked yet'}`,
    `Where: ${venue || 'Not said yet'}`,
    ``,
    `The event:`,
    msg || '(no details)',
    ``,
    `Reply to this email to write back to ${first}.`,
    `Sent from the booking form at sweetbabemusic.com`,
  ].join('\n');

  return { subject, html, text };
}
