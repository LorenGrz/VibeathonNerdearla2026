import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CaptionDto } from '@subs/domain';
import { OverlayLines } from './OverlayLines';

function caption(id: string, text: string, startMs: number): CaptionDto {
  return {
    id,
    sessionId: 'session-1',
    language: 'es',
    text,
    startMs,
    endMs: startMs + 1000,
    isFinal: true,
    kind: 'original',
  };
}

describe('OverlayLines', () => {
  it('renders only the last N lines', () => {
    const lines = [
      caption('1', 'línea uno', 0),
      caption('2', 'línea dos', 1000),
      caption('3', 'línea tres', 2000),
      caption('4', 'línea cuatro', 3000),
    ];

    render(<OverlayLines lines={lines} maxLines={2} />);

    expect(screen.queryByText('línea uno')).not.toBeInTheDocument();
    expect(screen.queryByText('línea dos')).not.toBeInTheDocument();
    expect(screen.getByText('línea tres')).toBeInTheDocument();
    expect(screen.getByText('línea cuatro')).toBeInTheDocument();
  });

  it('renders every line when there are fewer than maxLines', () => {
    const lines = [caption('1', 'única línea', 0)];

    render(<OverlayLines lines={lines} maxLines={5} />);

    expect(screen.getByText('única línea')).toBeInTheDocument();
  });

  it('shows the trailing partial segment in italics', () => {
    const finalLine = caption('1', 'texto final', 0);
    const partialLine = { ...caption('2', 'texto parcial', 1000), isFinal: false };

    render(<OverlayLines lines={[finalLine, partialLine]} maxLines={2} />);

    expect(screen.getByText('texto parcial')).toHaveClass('italic');
    expect(screen.getByText('texto final')).not.toHaveClass('italic');
  });
});
