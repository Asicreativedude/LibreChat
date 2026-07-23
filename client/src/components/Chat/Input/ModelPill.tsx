import React, { useMemo, useState, useCallback } from 'react';
import * as Ariakit from '@ariakit/react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { TooltipAnchor, DropdownPopup } from '@librechat/client';
import { isAgentsEndpoint } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import type { MenuItemProps } from '~/common';
import { useChatContext, useAgentsMapContext } from '~/Providers';
import { useLocalize, useGetAgentsConfig } from '~/hooks';
import { cn, providerLabel } from '~/utils';

/**
 * Operator "O" model-pick (#182), variant C composer pill.
 *
 * Renders inline-start in the composer toolbar for the agents endpoint only. The
 * popover lists provider families read from `endpoints.agents.allowedProviders`
 * (the single source of truth — never a hardcoded pair) and, per family, its
 * models. A pick writes `{provider, model}` onto the conversation, which the
 * agents seam (#177) reads off `model_parameters` to route the next turn.
 */

interface ProviderModelsProps extends React.HTMLAttributes<HTMLDivElement> {
  provider: string;
  models: string[];
  selectedProvider?: string | null;
  selectedModel?: string | null;
  onModelSelect: (provider: string, model: string) => void;
}

const ProviderModels = React.forwardRef<HTMLDivElement, ProviderModelsProps>(
  ({ provider, models, selectedProvider, selectedModel, onModelSelect, ...props }, ref) => {
    const localize = useLocalize();
    const menuStore = Ariakit.useMenuStore({
      focusLoop: true,
      showTimeout: 100,
      placement: 'right',
    });

    return (
      <div ref={ref}>
        <Ariakit.MenuProvider store={menuStore}>
          <Ariakit.MenuItem
            {...props}
            hideOnClick={false}
            render={
              <Ariakit.MenuButton
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  menuStore.toggle();
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg p-2 hover:bg-surface-hover"
              />
            }
          >
            <span className="truncate">{providerLabel(provider)}</span>
            <ChevronRight className="h-3 w-3 flex-shrink-0 rtl:rotate-180" aria-hidden="true" />
          </Ariakit.MenuItem>

          <Ariakit.Menu
            portal={true}
            unmountOnHide={true}
            aria-label={providerLabel(provider)}
            className={cn(
              'animate-popover-left z-40 ms-3 flex min-w-[220px] max-w-[320px] flex-col rounded-xl',
              'border border-border-light bg-presentation p-1.5 shadow-lg',
            )}
          >
            <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {models.length === 0 ? (
                <div className="px-3 py-2 text-sm text-text-secondary">
                  {localize('com_ui_no_models')}
                </div>
              ) : (
                models.map((model) => {
                  const active = selectedProvider === provider && selectedModel === model;
                  return (
                    <Ariakit.MenuItem
                      key={model}
                      hideOnClick={true}
                      onClick={() => onModelSelect(provider, model)}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg p-2 text-sm hover:bg-surface-hover"
                    >
                      <span className="truncate">{model}</span>
                      {active && <Check className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                    </Ariakit.MenuItem>
                  );
                })
              )}
            </div>
          </Ariakit.Menu>
        </Ariakit.MenuProvider>
      </div>
    );
  },
);

ProviderModels.displayName = 'ProviderModels';

function ModelPill() {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);
  const { conversation, setConversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const { agentsConfig } = useGetAgentsConfig();
  const { data: modelsConfig } = useGetModelsQuery();

  const allowedProviders = useMemo(
    () => (agentsConfig?.allowedProviders ?? []).map((provider) => String(provider)),
    [agentsConfig?.allowedProviders],
  );

  const agent =
    conversation?.agent_id != null && conversation.agent_id !== ''
      ? agentsMap?.[conversation.agent_id]
      : undefined;

  /** The conversation's chosen pair, else the agent's pinned pair (display only). */
  const selectedProvider = conversation?.provider ?? agent?.provider ?? null;
  const selectedModel = conversation?.model ?? agent?.model ?? null;

  const handleSelect = useCallback(
    (provider: string, model: string) => {
      setConversation((prev) => (prev ? { ...prev, provider, model } : prev));
      setIsOpen(false);
    },
    [setConversation],
  );

  if (!isAgentsEndpoint(conversation?.endpoint) || allowedProviders.length === 0) {
    return null;
  }

  const items: MenuItemProps[] = allowedProviders.map((provider) => ({
    id: `model-pick-${provider}`,
    hideOnClick: false,
    render: (props) => (
      <ProviderModels
        {...props}
        provider={provider}
        models={modelsConfig?.[provider] ?? []}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onModelSelect={handleSelect}
      />
    ),
  }));

  const trigger = (
    <TooltipAnchor
      description={localize('com_ui_model_pick')}
      render={
        <Ariakit.MenuButton
          aria-label={localize('com_ui_model_pick')}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-full border border-border-medium px-3 text-sm',
            'text-text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            isOpen && 'bg-surface-hover',
          )}
        >
          <span className="max-w-[9rem] truncate">
            {selectedModel ?? localize('com_ui_model')}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        </Ariakit.MenuButton>
      }
    />
  );

  return (
    <DropdownPopup
      menuId="model-pick-menu"
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      modal={true}
      unmountOnHide={true}
      trigger={trigger}
      items={items}
      itemClassName="flex w-full cursor-pointer rounded-lg items-center justify-between hover:bg-surface-hover gap-2"
    />
  );
}

export default React.memo(ModelPill);
