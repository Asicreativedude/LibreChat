import { RegenerateIcon } from '@librechat/client';
import type { TGenButtonProps } from '~/common';
import { useLocalize } from '~/hooks';
import Button from './Button';

export default function Regenerate({ onClick }: TGenButtonProps) {
  const localize = useLocalize();

  return (
    <Button onClick={onClick}>
      <RegenerateIcon className="h-3 w-3 flex-shrink-0 text-text-secondary" />
      {localize('com_ui_regenerate')}
    </Button>
  );
}
