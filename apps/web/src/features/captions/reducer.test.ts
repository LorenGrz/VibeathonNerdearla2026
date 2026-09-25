import { describe, expect, it } from 'vitest';
import type { CaptionDto } from '@subs/domain';
import { captionsReducer, initialCaptionsState } from './reducer';

function caption(overrides: Partial<CaptionDto> & Pick<CaptionDto, 'id'>): CaptionDto {
  return {
    sessionId: 'session-1',
    language: 'es',
    text: 'hola',
    startMs: 0,
    endMs: 1000,
    isFinal: true,
    kind: 'original',
    ...overrides,
  };
}

describe('captionsReducer', () => {
  it('keeps the segment as partial until a final with the same id arrives', () => {
    const partial = caption({ id: 'seg-1', isFinal: false, text: 'ho' });
    const afterPartial = captionsReducer(initialCaptionsState, {
      type: 'caption',
      caption: partial,
    });
    expect(afterPartial.partial).toEqual(partial);
    expect(afterPartial.finals).toHaveLength(0);

    const final = caption({ id: 'seg-1', isFinal: true, text: 'hola' });
    const afterFinal = captionsReducer(afterPartial, { type: 'caption', caption: final });
    expect(afterFinal.partial).toBeNull();
    expect(afterFinal.finals).toEqual([final]);
  });

  it('orders finals by startMs regardless of arrival order', () => {
    const second = caption({ id: 'seg-2', startMs: 2000, endMs: 3000, text: 'segundo' });
    const first = caption({ id: 'seg-1', startMs: 0, endMs: 1000, text: 'primero' });

    let state = captionsReducer(initialCaptionsState, { type: 'caption', caption: second });
    state = captionsReducer(state, { type: 'caption', caption: first });

    expect(state.finals.map((c) => c.id)).toEqual(['seg-1', 'seg-2']);
  });

  it('deduplicates finals by id, keeping the latest payload', () => {
    const draft = caption({ id: 'seg-1', text: 'borrador' });
    const corrected = caption({ id: 'seg-1', text: 'texto final' });

    let state = captionsReducer(initialCaptionsState, { type: 'caption', caption: draft });
    state = captionsReducer(state, { type: 'caption', caption: corrected });

    expect(state.finals).toHaveLength(1);
    expect(state.finals[0]?.text).toBe('texto final');
  });

  it('replaces state with deduped, ordered history on join', () => {
    const history = [
      caption({ id: 'seg-2', startMs: 2000, endMs: 3000 }),
      caption({ id: 'seg-1', startMs: 0, endMs: 1000 }),
      caption({ id: 'seg-1', startMs: 0, endMs: 1000 }),
    ];

    const state = captionsReducer(initialCaptionsState, { type: 'history', captions: history });

    expect(state.finals.map((c) => c.id)).toEqual(['seg-1', 'seg-2']);
    expect(state.partial).toBeNull();
  });

  it('resets to the initial state', () => {
    const withData = captionsReducer(initialCaptionsState, {
      type: 'caption',
      caption: caption({ id: 'seg-1' }),
    });

    expect(captionsReducer(withData, { type: 'reset' })).toEqual(initialCaptionsState);
  });
});
