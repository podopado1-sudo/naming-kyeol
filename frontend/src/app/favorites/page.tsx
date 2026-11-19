"use client";

import { Heart, X } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { favoriteKey, removeFavorite, useFavorites, type FavoriteName } from "@/lib/favorites";
import { favoriteHanjaLabel } from "@/lib/hanja-summary-text";
import { splitFullName } from "@/lib/name-split";

export default function FavoritesPage() {
  const items = useFavorites();

  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px 80px",
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--color-teal)",
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        >
          Favorites
        </p>
        <h1
          style={{
            fontSize: "clamp(26px, 5vw, 36px)",
            fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1.3,
            marginBottom: 16,
          }}
        >
          저장한 이름
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-2)",
            lineHeight: 1.7,
            marginBottom: 32,
          }}
        >
          이 목록은 이 브라우저에만 저장됩니다. 회원가입이나 로그인은 필요 없어요.
        </p>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {items.map((f) => (
              <li
                key={`${favoriteKey(f)}|${f.savedAt}`}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-divider)",
                  borderRadius: 10,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: "var(--color-text)",
                      marginBottom: 4,
                    }}
                  >
                    {f.fullName}
                  </div>
                  <SavedHanja f={f} />
                  <SavedMeta f={f} />
                </div>

                {/* 일반 <a>로 풀 페이지 이동 — /evaluate 정적 라우트의 클라이언트
                    라우터 캐시가 이전 ?name=... 을 재사용하는 잔상 버그 우회 */}
                <a
                  href={buildEvaluateUrl(f)}
                  style={{
                    fontSize: 13,
                    color: "var(--color-teal)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  다시 보기 →
                </a>
                <button
                  type="button"
                  onClick={() => removeFavorite(f.fullName, f.birthDate, f.hanja, f.lastHanja)}
                  aria-label="제거"
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-3)",
                    padding: 4,
                    display: "inline-flex",
                  }}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}

/**
 * 찜의 성·이름 — 저장된 값을 믿되 두 경우는 splitFullName으로 다시 나눈다 (감사 EV-6).
 * - 성·이름이 비었거나 합쳐도 fullName이 안 되는 항목
 * - 2026-10-21 이전 평가 화면 저장분: fullName[0]으로 성을 잘라 '남궁민'이 '남'+'궁민'으로 들어갔다.
 *   그때 저장분은 gender가 없으므로, gender 없는 1자 성 항목이 복성으로 읽히면 복성을 따른다
 *   (지금 저장분은 gender를 늘 담고, 입력한 성을 그대로 쓴다)
 */
function nameParts(f: FavoriteName): { lastName: string; name: string } {
  const split = splitFullName(f.fullName);
  if (!f.lastName || !f.name || f.lastName + f.name !== f.fullName) return split;
  const legacyCut =
    f.gender === undefined &&
    f.lastName.length === 1 &&
    split.lastName.length === 2;
  return legacyCut ? split : { lastName: f.lastName, name: f.name };
}

/**
 * 조화 점수를 보일지 — 출생일 없이 평가한 옛 저장분은 API가 준 harmonyScore 0을 그대로 담아
 * '조화 0'으로 보였다(지금 저장분은 출생일이 없으면 harmonyScore를 비운다). 출생일이 없고
 * 0인 항목만 숨긴다: 출생일을 넣고 평가해 실제 조화 점수를 가진 옛 저장분은 그대로 보인다.
 */
function showHarmony(f: FavoriteName): boolean {
  if (typeof f.harmonyScore !== "number") return false;
  return !(!f.birthDate && f.harmonyScore === 0);
}

/**
 * 이름 아래 한 줄 — 점수(종합·미학·조화)와 출생일. '·'와 간격은 둘 다 있을 때만 사이에 넣는다
 * (2026-10-27 — /required-char TopPick 저장분은 출생일만 있고 점수가 없어 '· 2024-03-15'처럼
 * 앞에 점이 매달렸다). 둘 다 없으면 줄을 그리지 않는다.
 */
function SavedMeta({ f }: { f: FavoriteName }) {
  const hasScore = typeof f.finalScore === "number";
  if (!hasScore && !f.birthDate) return null;
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--color-text-3)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {hasScore && (
        <>
          종합 {f.finalScore}
          {typeof f.aestheticScore === "number" &&
            ` · 미학 ${f.aestheticScore}`}
          {showHarmony(f) && ` · 조화 ${f.harmonyScore}`}
        </>
      )}
      {f.birthDate &&
        (hasScore ? (
          <span style={{ marginLeft: 8 }}>· {f.birthDate}</span>
        ) : (
          <span>{f.birthDate}</span>
        ))}
    </div>
  );
}

/**
 * 고른 한자 한 줄 — 같은 이름·같은 생년월일이라도 한자 조합이 다르면 따로 저장되므로(lib/favorites.ts 의 키),
 * 어느 조합인지 줄마다 적는다(2026-11 한자 입력). 저장분에는 고른 칸의 글자만 있다 — 자동 칸은 '음절(자동)',
 * 한자 없이 둔 칸은 '음절(한글)'(lib/hanja-summary-text.ts favoriteHanjaLabel). 한자를 고르지 않은 저장분에는 줄이 없다.
 */
function SavedHanja({ f }: { f: FavoriteName }) {
  const { lastName, name } = nameParts(f);
  const label = favoriteHanjaLabel({ lastName, name, hanja: f.hanja, lastHanja: f.lastHanja });
  if (!label) return null;
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--color-text-2)",
        marginBottom: 4,
        overflowWrap: "anywhere",
      }}
    >
      한자{" "}
      {/* 한자 글자만 사이트 한자 서체로 — 나머지 글(성씨·이름·(자동))은 줄의 서체 그대로 */}
      {label.split(HAN_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-hanja" style={{ fontSize: 15, color: "var(--color-text)" }}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </div>
  );
}

/** 한자가 이어진 토막(통합 한자 — 기본·확장 영역). split 의 홀수 번째 조각이 한자다 */
const HAN_RUN = /([㐀-䶿一-鿿\u{20000}-\u{323af}]+)/u;

function buildEvaluateUrl(f: FavoriteName) {
  const params = new URLSearchParams();
  const { lastName, name } = nameParts(f);
  if (lastName) params.set("lastName", lastName);
  if (name) params.set("name", name);
  // 고른 한자(주소 꼴)가 저장돼 있으면 같은 조합으로 다시 연다 — evaluate-params evaluateHref 와 같은 자리(name 바로 뒤)
  if (f.hanja) params.set("hanja", f.hanja);
  if (f.lastHanja) params.set("lastHanja", f.lastHanja);
  if (f.birthDate) params.set("birthDate", f.birthDate);
  if (f.birthTime) params.set("birthTime", f.birthTime);
  if (f.gender) params.set("gender", f.gender);
  if (f.tone) params.set("tone", f.tone);
  return `/evaluate?${params.toString()}`;
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-divider)",
        borderRadius: 12,
      }}
    >
      <Heart
        size={32}
        strokeWidth={1.5}
        color="var(--color-text-3)"
        style={{ marginBottom: 12 }}
      />
      <div
        style={{
          fontSize: 14,
          color: "var(--color-text-2)",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        아직 저장한 이름이 없어요.
        <br />
        평가 결과 페이지에서 ♥ 버튼을 눌러 저장하세요.
      </div>
      <Link
        href="/search"
        style={{
          fontSize: 13,
          color: "var(--color-teal)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        이름 추천 받으러 가기 →
      </Link>
    </div>
  );
}
