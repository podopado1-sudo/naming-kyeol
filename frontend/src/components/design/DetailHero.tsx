/**
 * DetailHero — 이름 + 한자 + 4개 점수 타일
 * Source: NameForm_design/src/DetailHero.jsx (Claude Design 산출물)
 *
 * Props (camelCase):
 *   fullName, aestheticScore, harmonyScore?, rarityScore, finalScore,
 *   hanjaCharacters: string,  // 한자 조합 (성씨 제외)
 *   hanjaMeanings: string,    // 의미 조합 텍스트
 */
import { ScoreTile } from "./DetailPrimitives";

export interface DetailHeroData {
  fullName: string;
  aestheticScore: number;
  harmonyScore: number | null;
  rarityScore: number;
  finalScore: number;
  hanjaCharacters: string;
  hanjaMeanings: string;
}

// 480px 이하: 점수 타일 4열 → 2×2 (/evaluate eval-score-grid 와 같은 규칙 — 타일은 늘 넷이라 마지막 줄을 늘이지 않는다).
// ⚠️ 2026-11-27 전에는 repeat(4, 1fr) 이 내용 최소 폭(338px)보다 줄지 않아 360px 기기에서 '종합' 타일이 화면 밖으로 12px 나가고
// 페이지 전체가 옆으로 밀렸다(analysis-score-grid-overflow). 결과 화면 좌우 여백 16px 은 쓰는 쪽(/analysis analysis-result)이 정한다
const HERO_CSS = `
  @media (max-width: 480px) {
    .detail-score-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }
`;

export function DetailHero({ data }: { data: DetailHeroData }) {
  const {
    fullName,
    aestheticScore,
    harmonyScore,
    rarityScore,
    finalScore,
    hanjaCharacters,
    hanjaMeanings,
  } = data;

  return (
    <div style={{ paddingTop: 32, paddingBottom: 8 }}>
      <h1
        style={{
          fontSize: 40,
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "var(--color-text)",
        }}
      >
        {fullName}
      </h1>
      {hanjaCharacters && (
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--color-navy)",
            letterSpacing: "0.1em",
            marginTop: 10,
          }}
        >
          {hanjaCharacters}
        </div>
      )}
      {hanjaMeanings && (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            margin: "14px 0 0",
            maxWidth: 560,
          }}
        >
          {hanjaMeanings}
        </p>
      )}

      <style>{HERO_CSS}</style>
      <div
        className="detail-score-grid"
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <ScoreTile value={aestheticScore} label="미학" variant="high" />
        {harmonyScore != null ? (
          <ScoreTile value={harmonyScore} label="조화" variant="mid" />
        ) : (
          <ScoreTile label="조화" placeholder />
        )}
        <ScoreTile value={rarityScore} label="유니크" variant="mid" />
        <ScoreTile value={finalScore} label="종합" variant="primary" big />
      </div>
    </div>
  );
}

export default DetailHero;
