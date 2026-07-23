import React, { useMemo } from 'react';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { cn, providerForModel, providerTint } from '~/utils';

/**
 * Operator "O" per-message model tag (#182). Reads the already-stamped
 * `message.model` and renders a small provider-tinted tag by the sender name.
 * The provider is resolved by reverse-lookup against the same models list the
 * picker uses, so nothing is hardcoded beyond the display tints.
 */

interface ModelTagProps {
  model?: string | null;
}

function ModelTag({ model }: ModelTagProps) {
  const { data: modelsConfig } = useGetModelsQuery();

  const tint = useMemo(() => {
    if (model == null || model === '') {
      return '';
    }
    return providerTint(providerForModel(model, modelsConfig));
  }, [model, modelsConfig]);

  if (model == null || model === '') {
    return null;
  }

  return (
    <span
      title={model}
      className={cn(
        'ms-2 inline-flex max-w-[10rem] items-center truncate rounded-full border px-2 py-0.5 align-middle text-xs font-medium',
        tint,
      )}
    >
      {model}
    </span>
  );
}

export default React.memo(ModelTag);
