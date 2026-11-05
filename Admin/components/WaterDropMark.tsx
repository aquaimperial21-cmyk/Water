// ImperialAqua brand mark — crown + water drop (matches the customer app's
// WaterDrop.tsx). Pure SVG, scales by `size` prop.

export function WaterDropMark({
  size = 32,
  tone = 'accent',
}: {
  size?: number;
  tone?: 'accent' | 'white' | 'ink';
}) {
  const fill =
    tone === 'white' ? '#FFFFFF' : tone === 'ink' ? '#151D28' : '#23BAFB';
  const glow = tone === 'white' ? 'rgba(255,255,255,0.85)' : '#66D9FF';
  const crown = tone === 'white' ? '#FFFFFF' : '#2A74F4';

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="ia-drop-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={glow} />
          <stop offset="1" stopColor={fill} />
        </linearGradient>
        <linearGradient id="ia-crown-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={crown} />
          <stop offset="1" stopColor={fill} />
        </linearGradient>
      </defs>
      {/* Crown */}
      <path
        d="M9 9 L13.5 13 L17 6.5 L20 11.5 L23 6.5 L26.5 13 L31 9 L29.5 15 L10.5 15 Z"
        fill="url(#ia-crown-grad)"
      />
      <circle cx="9" cy="9" r="1.4" fill={crown} />
      <circle cx="20" cy="6.5" r="1.6" fill={crown} />
      <circle cx="31" cy="9" r="1.4" fill={crown} />
      {/* Drop */}
      <path
        d="M20 16 c0 0 9 9 9 16 a9 9 0 1 1 -18 0 c0 -7 9 -16 9 -16 z"
        fill="url(#ia-drop-grad)"
      />
      {/* Highlight */}
      <ellipse cx="16.5" cy="29" rx="2.2" ry="3" fill="white" opacity="0.55" />
    </svg>
  );
}
