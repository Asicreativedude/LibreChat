const express = require('express');
const { createHmac } = require('node:crypto');
const {
  logger,
  DEFAULT_SESSION_EXPIRY,
  SystemCapabilities,
} = require('@librechat/data-schemas');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const { generateToken } = require('~/models');

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

function seal(value, secret) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

router.post('/', requireJwtAuth, async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  const email = req.user?.email;
  if (!secret || secret.length < 16 || !email) {
    return res.status(503).json({ message: 'handoff unavailable' });
  }
  // 8h — must match the Dashboard's SESSION_TTL_MS; a shorter/longer mint here
  // just moves the wall the Dashboard's verify enforces.
  const ttlMs = 1000 * 60 * 60 * 8;
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
  res.cookie('ob_session', seal({ email, expiresAt: Date.now() + ttlMs }, secret), {
    ...cookieOptions,
    maxAge: ttlMs,
  });

  /**
   * Team-admin session (open-brain #218) — same seam, second cookie. The `/team`
   * pane iframes `/admin`, whose session is a sealed `AdminSession` (see
   * apps/team-admin/src/lib/auth/session-codec.ts — that codec is the contract;
   * the shape here must match it). LibreChat keeps owning authz: the admin cookie
   * is minted ONLY for users holding ACCESS_ADMIN — the same capability gating
   * `/api/admin/*` — and the JWT inside is re-verified by the admin API on every
   * call, so the cookie grants nothing the capability didn't. The Shell re-mints
   * on every pane visit, which is why there is no refreshToken (#207).
   */
  let isAdmin = false;
  try {
    isAdmin = await hasCapability(req.user, SystemCapabilities.ACCESS_ADMIN);
  } catch (err) {
    logger.warn(`[ob/handoff] admin capability check failed, skipping: ${err?.message}`);
  }
  if (isAdmin) {
    const sessionExpiry = Number(process.env.SESSION_EXPIRY) || DEFAULT_SESSION_EXPIRY;
    const token = await generateToken(req.user, sessionExpiry);
    const adminSession = {
      token,
      userId: req.user.id ?? String(req.user._id),
      email,
      expiresAt: Date.now() + sessionExpiry,
    };
    res.cookie('ob_admin_session', seal(adminSession, secret), {
      ...cookieOptions,
      maxAge: sessionExpiry,
    });
  }

  return res.status(204).end();
});

module.exports = router;
