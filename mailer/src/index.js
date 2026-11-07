// Booking mailer for sweetbabemusic.com. The form POSTs JSON here; this sends Kyle a styled email via Resend.
// Also serves /plays, the footer's visit count (KV binding STATS).
// Secrets: RESEND_API_KEY, BOOKING_TO (who gets the bookings), and optional BCC_EMAIL for a hidden copy (wrangler secret put …). Vars in wrangler.jsonc.
import { renderEmail } from './email.js';

const MAX = { name: 120, email: 200, date: 10, venue: 160, msg: 4000 };
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

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin, env);
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: h });

    // the visit counter for the footer ("This record's been spun N times"): GET reads it, POST adds one.
    // No cookies, no IPs, nothing about the visitor is stored: just one number in KV (binding STATS).
    if (new URL(req.url).pathname === '/plays') {
      if (!allowed) return json({ ok: false }, 403, h);
      if (!env.STATS) return json({ ok: false }, 503, h);
      let n = parseInt(await env.STATS.get('plays') || '0', 10) || 0;
      if (req.method === 'POST') { n += 1; await env.STATS.put('plays', String(n)); }
      return json({ ok: true, plays: n }, 200, { ...h, 'Cache-Control': 'no-store' });
    }

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
    if (d.company) return json({ ok: true }, 200, h);

    const f = {};
    for (const k of Object.keys(MAX)) f[k] = String(d[k] ?? '').trim().slice(0, MAX[k]);
    if (!f.name) return json({ ok: false, error: 'Add your name.' }, 422, h);
    if (!EMAIL_RE.test(f.email)) return json({ ok: false, error: 'That email doesn\'t look right.' }, 422, h);
    if (f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) f.date = '';

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
