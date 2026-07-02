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
 * produces — `base64url(email).HMAC_sha256(payload, SESSION_SECRET)` — so holding
 * the shared SESSION_SECRET is the whole handoff, no new crypto.
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
  const payload = Buffer.from(email, 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  res.cookie('ob_session', `${payload}.${mac}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 1000 * 60 * 60 * 8,
  });
  return res.status(204).end();
});

module.exports = router;
