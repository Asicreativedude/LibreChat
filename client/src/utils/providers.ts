import type { TModelsConfig } from 'librechat-data-provider';

/**
 * Operator "O" model-pick (#182) provider display metadata. The provider *list*
 * is sourced from `endpoints.agents.allowedProviders`; these tables only prettify
 * and tint whatever ids come through, falling back for any unlisted provider — so
 * they never hardcode which providers exist. Shared by the composer pill and the
 * per-message model tag so a provider is styled in one place.
 */

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openAI: 'OpenAI',
};

const PROVIDER_TINTS: Record<string, string> = {
  anthropic: 'border-[#d97757]/40 bg-[#d97757]/10 text-[#d97757]',
  openAI: 'border-[#10a37f]/40 bg-[#10a37f]/10 text-[#10a37f]',
};

export const NEUTRAL_TINT = 'border-border-medium bg-surface-tertiary text-text-secondary';

export const providerLabel = (provider: string): string => PROVIDER_LABELS[provider] ?? provider;

export const providerTint = (provider?: string): string =>
  provider != null ? (PROVIDER_TINTS[provider] ?? NEUTRAL_TINT) : NEUTRAL_TINT;

/** Reverse-lookup the provider that serves a model, using the same list the picker reads. */
export function providerForModel(
  model: string,
  modelsConfig?: TModelsConfig,
): string | undefined {
  if (!modelsConfig) {
    return undefined;
  }
  for (const [provider, models] of Object.entries(modelsConfig)) {
    if (models.includes(model)) {
      return provider;
    }
  }
  return undefined;
}
