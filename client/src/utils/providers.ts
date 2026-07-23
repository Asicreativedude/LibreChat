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

/**
 * "Newest first" ordering for an auto-fetched provider model list. The client only
 * receives id strings (no release dates), so recency is inferred from the version
 * tokens in the id: date/snapshot tokens are stripped (they'd pollute the compare),
 * then the remaining numeric version tokens are compared descending. Ties keep the
 * fetched order (stable). Heuristic — gets the current families on top (5.x > 4.x >
 * 3.x) which is the point; exact tail order among legacy ids isn't guaranteed.
 * ponytail: version-token heuristic; swap for a date source if the API ever exposes one.
 */
function versionKey(id: string): number[] {
  const s = id
    .replace(/\b20\d{6}\b/g, ' ') // yyyymmdd  e.g. 20250805
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ') // yyyy-mm-dd e.g. 2024-04-09
    .replace(/-\d{4}\b/g, ' '); // -0125 / -1106 / -2024 snapshots + years
  return (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export function sortModelsByRecency(models: string[]): string[] {
  return models
    .map((id, i) => ({ id, i, k: versionKey(id) }))
    .sort((a, b) => {
      const n = Math.max(a.k.length, b.k.length);
      for (let j = 0; j < n; j++) {
        const x = a.k[j] ?? -1;
        const y = b.k[j] ?? -1;
        if (x !== y) {
          return y - x; // descending → newest first
        }
      }
      return a.i - b.i; // stable → preserve fetched order for ties
    })
    .map((o) => o.id);
}

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
