/**
 * BrushDivider — 손그림 붓 자국 섹션 구분선
 * 수묵화 톤의 핵심 장식: 직선 hr 대신 두 가닥 곡선으로 자연스러운 붓 자국 느낌.
 *
 * 사용: 섹션 사이에 <BrushDivider /> 또는 <BrushDivider width={280} />
 */
export function BrushDivider({
  width = 220,
  className,
}: {
  width?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "8px 0",
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 220 24"
        width={width}
        height={Math.round((width / 220) * 24)}
        style={{ display: "block", opacity: 0.6 }}
      >
        {/* 굵은 메인 붓자국 */}
        <path
          d="M 4 14 Q 30 6, 60 12 T 120 13 Q 160 10, 200 16 L 216 14"
          stroke="var(--color-ink-nong)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* 가는 보조 자국 — 한지에 살짝 번진 느낌 */}
        <path
          d="M 8 16 Q 40 11, 80 15 T 160 13"
          stroke="var(--color-ink-nong)"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

export default BrushDivider;
