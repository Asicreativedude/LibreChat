import { JSX } from 'react/jsx-runtime';

// Open Brain: the studio "O" mark. Replaces OpenAI's GPTIcon flower wherever the
// openAI endpoint icon renders (client/src/hooks/Endpoint/Icons.tsx) so the shell
// never shows another vendor's logo. currentColor so it inherits light/dark like
// the vendor icons it sits beside. The image-slot twin is /assets/o-mark.svg
// (used by the Operator modelSpec iconURL) — same ring proportions, scaled to its tile.
export default function OpenIcon({
  size = 25,
  className = '',
}: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 41 41"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="20.5" cy="20.5" r="15" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}
