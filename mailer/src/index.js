// Booking mailer for sweetbabemusic.com. The form POSTs JSON here; this sends Kyle a styled email via Resend.
// Also serves /plays, the footer's visit count (KV binding STATS).
// And /follow, the "Catch him live" list: one KV entry per email (key fan:<email>), so Kyle can write when a date goes up.
//   See the list:  npx wrangler kv key list --binding STATS --prefix fan: --remote
// Show alerts: POST /announce (bearer ANNOUNCE_SECRET) mails one public show to every fan:; GET /unfollow?e=&t= is the signed unsubscribe link (UNSUBSCRIBE_SECRET).
// Secrets: RESEND_API_KEY, ANNOUNCE_SECRET, UNSUBSCRIBE_SECRET, BOOKING_TO (who gets the bookings), and optional BCC_EMAIL for a hidden copy (wrangler secret put …). Vars in wrangler.jsonc.
import { renderEmail, renderShowAlert } from './email.js';

const MAX = { name: 120, email: 200, kind: 40, lineup: 40, date: 10, time: 5, venue: 160, msg: 4000 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

function cors(origin, env) {
  const ok = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : env.ALLOWED_ORIGINS.split(',')[0].trim(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });


// ── show alerts ──
const enc = new TextEncoder();
async function sign(email, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('unfollow:' + email)));
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}
const same = (a, b) => { // constant-time string compare
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const unfollowUrl = async (origin, email, secret) => `${origin}/unfollow?e=${encodeURIComponent(email)}&t=${await sign(email, secret)}`;
const page = (title, msg) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0b0a08;color:#f2eedf;font:400 17px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px">
<div><div style="font:600 11px/1 sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#9e9885">Sweet Babe <span style="color:#DED63D">&#9679;</span></div>
<h1 style="font:italic 400 40px/1.1 Georgia,serif;margin:22px 0 10px">${title}</h1><p style="color:#9e9885;margin:0 0 24px">${msg}</p>
<a href="https://sweetbabemusic.com" style="color:#DED63D">sweetbabemusic.com</a></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

async function unfollow(req, env, url) {
  const e = (url.searchParams.get('e') || '').trim().toLowerCase(), t = url.searchParams.get('t') || '';
  if (!env.UNSUBSCRIBE_SECRET || !env.STATS) return page('Not available', 'This link isn\'t working right now.');
  if (!EMAIL_RE.test(e) || !same(await sign(e, env.UNSUBSCRIBE_SECRET), t)) return page('That link doesn\'t look right', 'Try the unsubscribe link in the email again.');
  await env.STATS.delete('fan:' + e);
  return page('You\'re off the list', 'No more show alerts. If that was a mistake, you can sign up again on the site.');
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const isoToday = () => new Date().toISOString().slice(0, 10);

async function announce(req, env, url) {
  const auth = req.headers.get('Authorization') || '';
  if (!env.ANNOUNCE_SECRET || !same(auth, 'Bearer ' + env.ANNOUNCE_SECRET)) return json({ ok: false, error: 'unauthorized' }, 401, {});
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405, {});
  if (!env.STATS || !env.UNSUBSCRIBE_SECRET) return json({ ok: false, error: 'not configured' }, 503, {});
  let d; try { d = await req.json(); } catch { return json({ ok: false, error: 'bad request' }, 400, {}); }
  const sh = d.show || {};
  if (sh.public !== true) return json({ ok: false, error: 'This show is not marked public, so it will not be announced.' }, 422, {});
  const show = {
    date: String(sh.date ?? '').trim(), time: String(sh.time ?? '').trim().slice(0, 20), venue: String(sh.venue ?? '').trim().slice(0, 160),
    city: String(sh.city ?? '').trim().slice(0, 80), act: sh.act === 'solo' || sh.act === 'band' ? sh.act : '', map: String(sh.map ?? '').trim().slice(0, 240),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(show.date) || !show.venue) return json({ ok: false, error: 'A show needs a date (YYYY-MM-DD) and a venue.' }, 422, {});
  if (show.date < isoToday()) return json({ ok: false, error: 'That show has already passed.' }, 422, {});

  const key = `sent:${show.date}:${slug(show.venue)}`;
  const already = await env.STATS.get(key);
  if (already && d.dryRun !== true) return json({ ok: false, error: 'Already announced.', sent: JSON.parse(already) }, 409, {});

  const emails = [];
  let cursor;
  do {
    const r = await env.STATS.list({ prefix: 'fan:', cursor });
    for (const k of r.keys) emails.push(k.name.slice(4));
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);

  const origin = url.origin;
  const sample = renderShowAlert(show, { site: env.SITE_URL, unsubscribeUrl: await unfollowUrl(origin, 'sample@example.com', env.UNSUBSCRIBE_SECRET) });
  if (d.dryRun === true) return json({ ok: true, dryRun: true, recipients: emails.length, alreadyAnnounced: !!already, subject: sample.subject, html: sample.html, text: sample.text }, 200, {});
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'no RESEND_API_KEY' }, 503, {});
  if (!emails.length) return json({ ok: true, recipients: 0, sent: 0 }, 200, {});

  // claim the show first, so a second call (or a retry) can never mail the list twice
  await env.STATS.put(key, JSON.stringify({ at: new Date().toISOString(), status: 'sending', recipients: emails.length }));
  let sent = 0; const failed = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const batch = await Promise.all(chunk.map(async to => {
      const unsub = await unfollowUrl(origin, to, env.UNSUBSCRIBE_SECRET);
      const m = renderShowAlert(show, { site: env.SITE_URL, unsubscribeUrl: unsub });
      return { from: env.FROM_EMAIL, to: [to], subject: m.subject, html: m.html, text: m.text,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }, tags: [{ name: 'source', value: 'show_alert' }] };
    }));
    const res = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(batch) });
    if (res.ok) sent += chunk.length; else { console.log('resend batch error', res.status, await res.text()); failed.push(...chunk); }
  }
  // nothing went out at all (bad key, Resend down): release the claim so the show can be announced again
  if (!sent) { await env.STATS.delete(key); return json({ ok: false, recipients: emails.length, sent: 0, failed: failed.length }, 502, {}); }
  await env.STATS.put(key, JSON.stringify({ at: new Date().toISOString(), status: failed.length ? 'partial' : 'done', recipients: emails.length, sent, failed: failed.length }));
  return json({ ok: failed.length === 0, recipients: emails.length, sent, failed: failed.length }, failed.length ? 502 : 200, {});
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin, env);
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: h });

    // the visit counter for the footer ("This record's been spun N times"): GET reads it, POST adds one.
    // No cookies, no IPs, nothing about the visitor is stored: just one number in KV (binding STATS).
    const path = new URL(req.url).pathname;
    if (path === '/plays') {
      if (!allowed) return json({ ok: false }, 403, h);
      if (!env.STATS) return json({ ok: false }, 503, h);
      let n = parseInt(await env.STATS.get('plays') || '0', 10) || 0;
      if (req.method === 'POST') { n += 1; await env.STATS.put('plays', String(n)); }
      return json({ ok: true, plays: n }, 200, { ...h, 'Cache-Control': 'no-store' });
    }

    const url = new URL(req.url);
    if (path === '/unfollow' && (req.method === 'GET' || req.method === 'POST')) return unfollow(req, env, url);   // GET from the link, POST from a mail app's one-click unsubscribe
    if (path === '/announce') return announce(req, env, url);   // protected by the bearer secret, not by origin

    if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405, h);
    if (!allowed) return json({ ok: false, error: 'origin' }, 403, h);

    if (env.LIMIT) {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMIT.limit({ key: ip });
      if (!success) return json({ ok: false, error: 'Too many requests. Try again in a minute.' }, 429, h);
    }

    let d;
    try { d = await req.json(); } catch { return json({ ok: false, error: 'bad request' }, 400, h); }

    // honeypot: people never see this field, bots fill it. Pretend it worked.
    if (d.company) return json({ ok: true, saved: true }, 200, h);

    // show alerts: keep the email and the day it was left. Nothing else about the visitor is stored.
    if (path === '/follow') {
      if (!env.STATS) return json({ ok: false }, 503, h);
      const email = String(d.email ?? '').trim().toLowerCase().slice(0, MAX.email);
      if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'That email doesn\'t look right.' }, 422, h);
      await env.STATS.put('fan:' + email, JSON.stringify({ at: new Date().toISOString().slice(0, 10) }));
      return json({ ok: true, saved: true }, 200, h);
    }

    const f = {};
    for (const k of Object.keys(MAX)) f[k] = String(d[k] ?? '').trim().slice(0, MAX[k]);
    if (!f.name) return json({ ok: false, error: 'Add your name.' }, 422, h);
    if (!EMAIL_RE.test(f.email)) return json({ ok: false, error: 'That email doesn\'t look right.' }, 422, h);
    if (f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) f.date = '';
    if (f.time && !/^\d{2}:\d{2}$/.test(f.time)) f.time = '';

    const { subject, html, text } = renderEmail(f, { site: env.SITE_URL });
    if (env.DRY_RUN === '1') { console.log('DRY_RUN', subject); return json({ ok: true, dry: true }, 200, h); }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.BOOKING_TO || env.TO_EMAIL],
        // optional hidden copy (secret BCC_EMAIL, comma-separated), kept out of this public repo
        ...(env.BCC_EMAIL ? { bcc: env.BCC_EMAIL.split(',').map(s => s.trim()).filter(Boolean) } : {}),
        reply_to: f.email,
        subject, html, text,
        tags: [{ name: 'source', value: 'booking_form' }],
      }),
    });
    if (!res.ok) {
      console.log('resend error', res.status, await res.text());
      return json({ ok: false, error: 'send failed' }, 502, h);
    }
    return json({ ok: true }, 200, h);
  },
};
