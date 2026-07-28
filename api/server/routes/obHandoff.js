const express = require('express');
const { createHmac } = require('node:crypto');
const { requireJwtAuth } = require('~/server/middleware');

/**
 * Open Brain fork edit (ADR 0016) — the Shell→Dashboard identity handoff.
 *
 * The embedded Dashboard is served same-origin under `/app` and is NOT proxied
 * through LibreChat, so the Shell can't inject a request header onto the iframe's
 * subrequests. Instead the Shell mints the Dashboard's own session cookie: the
 * `ob_session` value is exactly the construct the Dashboard's `signSession`
 * produces — `base64url(JSON({email, expiresAt})).HMAC_sha256(payload,
 * SESSION_SECRET)` — so holding the shared SESSION_SECRET is the whole handoff,
 * no new crypto. The lifetime is signed INTO the payload (open-brain #219), not
 * just a cookie attribute: the Dashboard's verify rejects an elapsed `expiresAt`,
 * so a captured cookie value stops working when it expires, not merely when the
 * browser drops it.
 *
 * The `/onboarding` client route POSTs here (with the Bearer JWT) before showing
 * the iframe; the Set-Cookie lands on the shared origin (Path=/), and the
 * Dashboard BFF's cookie path reads it as the verified Shell user. A forged
 * cookie can't pass the Dashboard's HMAC verify without SESSION_SECRET.
 */
const router = express.Router();

router.post('/', requireJwtAuth, (req, res) => {
  const secret = process.env.SESSION_SECRET;
  const email = req.user?.email;
  if (!secret || secret.length < 16 || !email) {
    return res.status(503).json({ message: 'handoff unavailable' });
  }
  // 8h — must match the Dashboard's SESSION_TTL_MS; a shorter/longer mint here
  // just moves the wall the Dashboard's verify enforces.
  const ttlMs = 1000 * 60 * 60 * 8;
  const payload = Buffer.from(
    JSON.stringify({ email, expiresAt: Date.now() + ttlMs }),
    'utf8',
  ).toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  res.cookie('ob_session', `${payload}.${mac}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlMs,
  });
  return res.status(204).end();
});

module.exports = router;
