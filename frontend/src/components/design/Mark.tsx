/**
 * Naming.kyeol Mark — 브랜드 로고 (인라인 SVG)
 * Source: NameForm_design/src/Mark.jsx (Claude Design 산출물)
 */
export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 56"
      width={size}
      height={size}
      role="img"
      aria-label="Naming.kyeol mark"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`nk-gr-${size}`} x1="0" x2="1">
          <stop offset="0" stopColor="#1E3A5F" />
          <stop offset="1" stopColor="#2E7D7A" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="56"
        height="56"
        rx="14"
        fill="#FAF7F2"
        stroke="#1E3A5F"
        strokeWidth="1.5"
      />
      <path
        d="M8 20 Q18 12 28 20 T48 20"
        fill="none"
        stroke={`url(#nk-gr-${size})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 30 Q18 22 28 30 T48 30"
        fill="none"
        stroke="#1E3A5F"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".85"
      />
      <path
        d="M8 40 Q18 32 28 40 T48 40"
        fill="none"
        stroke="#C9A96E"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Mark;
