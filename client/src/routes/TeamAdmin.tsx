/**
 * Open Brain fork edit (open-brain #218) — the embedded team-admin pane.
 * Mirrors Onboarding.tsx: POST `/api/ob/handoff` with the Shell's Bearer JWT so
 * LibreChat mints the `ob_admin_session` cookie (admins only — the handoff gates
 * on ACCESS_ADMIN), then iframe the team-admin app served same-origin under
 * `/admin`. Single login, no sign-in screen inside the frame.
 */
import { useEffect, useState } from 'react';
import { Spinner } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';

export default function TeamAdmin() {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    fetch('/api/ob/handoff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (active) {
          setStatus(res.ok ? 'ready' : 'error');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center" role="alert">
        <span className="text-text-primary">{localize('com_ui_error_connection')}</span>
      </div>
    );
  }

  if (status !== 'ready') {
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
      src="/admin"
      title={localize('com_nav_team_management')}
      className="h-full w-full border-0"
    />
  );
}
