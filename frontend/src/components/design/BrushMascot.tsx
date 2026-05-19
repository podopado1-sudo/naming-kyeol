/**
 * Brush-fairy mascot — 붓요정 (peripheral 사용 only: empty/loading/404)
 * Source: NameForm_design/src/BrushMascot.jsx (Claude Design 산출물)
 */
export function BrushMascot({ size = 120 }: { size?: number }) {
  const w = size;
  const h = Math.round(size * 1.5);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 180"
      width={w}
      height={h}
      role="img"
      aria-label="Brush mascot"
    >
      <g
        fill="none"
        stroke="#2E7D7A"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M50 28 Q50 22 60 22 Q70 22 70 28 L70 96 Q70 100 60 100 Q50 100 50 96 Z"
          strokeWidth="2"
        />
        <path d="M54 34 L54 90" strokeWidth="0.7" opacity=".35" />
        <path d="M60 32 L60 92" strokeWidth="0.7" opacity=".25" />
        <path d="M66 34 L66 90" strokeWidth="0.7" opacity=".35" />
        <path d="M50 92 Q60 96 70 92" strokeWidth="1.2" />
        <path d="M50 96 Q60 100 70 96" strokeWidth="1.2" />
        <path d="M48 102 L72 102 L69 110 L51 110 Z" strokeWidth="1.8" />
        <path
          d="M51 110 Q50 126 54 140 Q57 150 60 160"
          strokeWidth="2.6"
        />
        <path d="M57 110 Q57 132 60 160" strokeWidth="2.6" opacity=".7" />
        <path
          d="M63 110 Q64 130 62 144 Q61 152 60 160"
          strokeWidth="2.6"
          opacity=".75"
        />
        <path
          d="M69 110 Q70 124 66 140 Q63 152 60 160"
          strokeWidth="2.6"
          opacity=".6"
        />
        <path
          d="M52 156 Q56 160 60 156 T68 156"
          strokeWidth="1.2"
          opacity=".55"
        />
        <path
          d="M54 162 Q57 165 60 162 T66 162"
          strokeWidth="1"
          opacity=".4"
        />
        <circle cx="55" cy="48" r="1.9" fill="#2E7D7A" stroke="none" />
        <circle cx="65" cy="48" r="1.9" fill="#2E7D7A" stroke="none" />
      </g>
    </svg>
  );
}

export default BrushMascot;
