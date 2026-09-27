interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = '', size = 32 }: LogoIconProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="nerd-grad" x1="4" y1="8" x2="36" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E02832" />
            <stop offset="50%" stopColor="#FFBA00" />
            <stop offset="100%" stopColor="#00ACA8" />
          </linearGradient>
          <filter id="glow-red" x="0" y="0" width="40" height="40" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle Badge Frame */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill="#0D0D0E"
          stroke="url(#nerd-grad)"
          strokeWidth="1.75"
          className="shadow-sm"
        />

        {/* Audio Waveform (Left to Center) */}
        <path
          d="M7 20 H9 L11 13 L13 27 L15 15 L17 25 L19 18 L21 21 H22"
          stroke="url(#nerd-grad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Closed Caption Subtitle Frame / Brackets */}
        <path
          d="M24 14 H32 C33.1 14 34 14.9 34 16 V24 C34 25.1 33.1 26 32 26 H24"
          stroke="#00ACA8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* CC Symbol inside */}
        <text
          x="25.5"
          y="22.5"
          fill="#FFBA00"
          fontSize="7"
          fontFamily="monospace, sans-serif"
          fontWeight="900"
          letterSpacing="-0.5"
        >
          CC
        </text>

        {/* Live Broadcast Dot with Glow */}
        <circle cx="33" cy="8" r="2.8" fill="#FF323C" filter="url(#glow-red)" />
      </svg>
      {/* CSS Pulse Ring on the beacon dot */}
      <span
        className="absolute top-[3px] right-[3px] h-2 w-2 rounded-full bg-brand animate-ping opacity-75 pointer-events-none"
        style={{ transform: 'translate(25%, -25%)' }}
      />
    </div>
  );
}
