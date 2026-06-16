import React from 'react';
import { useRecoilValue } from 'recoil';
import { TooltipAnchor } from '@librechat/client';
import { MessageCircleDashed } from 'lucide-react';
import { useRecoilState, useRecoilCallback } from 'recoil';
import { isForcedTemporaryRetention } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

export function TemporaryChat() {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const [isTemporary, setIsTemporary] = useRecoilState(store.isTemporary);
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));

  const isEnforced = isForcedTemporaryRetention(startupConfig?.interface?.retentionMode);

  const handleBadgeToggle = useRecoilCallback(
    () => () => {
      if (isEnforced) {
        return;
      }
      setIsTemporary(!isTemporary);
    },
    [isTemporary, isEnforced],
  );

  if (
    (Array.isArray(conversation?.messages) && conversation.messages.length >= 1) ||
    isSubmitting
  ) {
    return null;
  }

  const isActive = isEnforced || isTemporary;
  const label = isEnforced ? localize('com_ui_temporary_enforced') : localize('com_ui_temporary');

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <TooltipAnchor
        description={label}
        render={
          <button
            onClick={handleBadgeToggle}
            aria-label={label}
            aria-pressed={isActive}
            aria-disabled={isEnforced}
            className={cn(
              'inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light text-text-primary transition-all ease-in-out',
              isActive
                ? 'bg-surface-active'
                : 'bg-presentation shadow-sm hover:bg-surface-active-alt',
              isEnforced && 'cursor-not-allowed',
            )}
          >
            <MessageCircleDashed className="icon-md" aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}
