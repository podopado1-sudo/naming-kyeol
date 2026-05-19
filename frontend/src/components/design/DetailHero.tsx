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

      <div
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
