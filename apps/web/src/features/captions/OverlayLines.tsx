import type { CaptionDto } from '@subs/domain';

export interface OverlayLinesProps {
  lines: CaptionDto[];
  maxLines: number;
}

/** Pure rendering of the last `maxLines` caption lines, largest/newest at the bottom. */
export function OverlayLines({ lines, maxLines }: OverlayLinesProps) {
  const visible = lines.slice(-Math.max(maxLines, 1));

  return (
    <div className="flex flex-col justify-end gap-2">
      {visible.map((line) => (
        <p
          key={line.id}
          className={`font-sans text-4xl leading-tight font-medium text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:text-5xl ${
            line.isFinal ? '' : 'text-white/70 italic'
          }`}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}
