interface ConnectionStatusProps {
  connected: boolean;
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span aria-hidden className={`h-2 w-2 rounded-full ${connected ? 'bg-teal' : 'bg-brand'}`} />
      <span className={connected ? 'text-teal' : 'text-brand-soft'}>
        {connected ? 'Conectado a la API' : 'Desconectado de la API'}
      </span>
    </p>
  );
}
