import type { CaptionDto } from '@subs/domain';

export interface CaptionsState {
  finals: CaptionDto[];
  partial: CaptionDto | null;
}

export type CaptionsAction =
  | { type: 'history'; captions: CaptionDto[] }
  | { type: 'caption'; caption: CaptionDto }
  | { type: 'reset' };

export const initialCaptionsState: CaptionsState = { finals: [], partial: null };

function sortByStart(captions: CaptionDto[]): CaptionDto[] {
  return [...captions].sort((a, b) => a.startMs - b.startMs);
}

function dedupeById(captions: CaptionDto[]): CaptionDto[] {
  const byId = new Map(captions.map((caption) => [caption.id, caption]));
  return Array.from(byId.values());
}

function upsertFinal(finals: CaptionDto[], caption: CaptionDto): CaptionDto[] {
  const withoutDuplicate = finals.filter((existing) => existing.id !== caption.id);
  return sortByStart([...withoutDuplicate, caption]);
}

export function captionsReducer(state: CaptionsState, action: CaptionsAction): CaptionsState {
  switch (action.type) {
    case 'reset':
      return initialCaptionsState;
    case 'history': {
      const finals = sortByStart(dedupeById(action.captions.filter((caption) => caption.isFinal)));
      return { finals, partial: null };
    }
    case 'caption': {
      if (!action.caption.isFinal) {
        return { ...state, partial: action.caption };
      }
      return { finals: upsertFinal(state.finals, action.caption), partial: null };
    }
    default:
      return state;
  }
}
