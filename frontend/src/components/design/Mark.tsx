/**
 * Naming.kyeol Mark — 브랜드 로고 (하이브리드)
 *
 * 구성: 한지색 둥근 사각형 프레임 + 붓요정 머리 PNG
 *  - 프레임: 옛 추상 로고의 안정감 / 로고 구조감 계승
 *  - 마스코트: Claude스러움 탈피 / 사이트 전체와 정체성 통일
 *
 * `/brush-sprite-head.png` 는 favicon용 head-only crop과 동일.
 */
import Image from "next/image";

export function Mark({ size = 36 }: { size?: number }) {
  // 프레임 안 마스코트는 살짝 작게 (시각적 여백)
  const innerSize = Math.round(size * 0.86);
  // 프레임 둥근 모서리 — 사이즈에 비례 (size 36 → r 9, size 56 → r 14)
  const radius = Math.round(size * 0.25);

  return (
    <div
      role="img"
      aria-label="이름의 결 로고 — 붓요정"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: "var(--color-surface-2)",
        borderRadius: radius,
        border: "1px solid var(--color-ink-qing)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Image
        src="/brush-sprite-head.png"
        alt=""
        width={innerSize}
        height={innerSize}
        priority
        style={{
          display: "block",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

export default Mark;
