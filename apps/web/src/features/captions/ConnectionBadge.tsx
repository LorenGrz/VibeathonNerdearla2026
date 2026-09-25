import type { SessionStatus } from '@subs/domain';
import { Badge, type BadgeTone } from '@/components/Badge';
import type { ConnectionStatus } from './useCaptions';

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
};

const CONNECTION_TONE: Record<ConnectionStatus, BadgeTone> = {
  connecting: 'warning',
  connected: 'live',
  disconnected: 'error',
};

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
  sessionStatus: SessionStatus | null;
}

export function ConnectionBadge({ status, sessionStatus }: ConnectionBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={CONNECTION_TONE[status]}>{CONNECTION_LABEL[status]}</Badge>
      {sessionStatus ? (
        <Badge tone={sessionStatus === 'live' ? 'live' : 'neutral'}>{sessionStatus}</Badge>
      ) : null}
    </div>
  );
}
