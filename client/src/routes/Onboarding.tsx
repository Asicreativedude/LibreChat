/**
 * Open Brain fork edit (ADR 0016) — the embedded Dashboard pane.
 * Additive/quarantined: one route that iframes the config Dashboard served
 * same-origin under `/app` (single-origin proxy). No code coupling — the seam
 * is the iframe URL + the BFF's signed-handoff identity, not imports.
 *
 * Identity handoff: before the iframe loads, POST `/api/ob/handoff` with the
 * Shell's Bearer JWT so LibreChat mints the Dashboard's `ob_session` cookie for
 * the logged-in user (shared SESSION_SECRET). The Dashboard then reads that
 * cookie as the verified actor — the single-login handoff, no login in the frame.
 */
import { useEffect, useState } from 'react';
import { Spinner } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';

export default function Onboarding() {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    fetch('/api/ob/handoff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).finally(() => {
      if (active) {
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

  // Never render an empty pane: until the handoff settles — or forever, if `token` is
  // falsy and the effect early-returns (open-brain #214) — show a spinner, not a void.
  if (!ready) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        aria-live="polite"
        role="status"
      >
        <Spinner className="text-text-primary" />
        <span className="sr-only">{localize('com_ui_loading')}</span>
      </div>
    );
  }

  return (
    <iframe
      src="/app/clients"
      title={localize('com_ui_onboarding')}
      className="h-full w-full border-0"
    />
  );
}
