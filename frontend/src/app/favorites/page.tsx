"use client";

import { Heart, X } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { removeFavorite, useFavorites } from "@/lib/favorites";

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
                key={`${f.fullName}|${f.birthDate ?? ""}|${f.savedAt}`}
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
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {typeof f.finalScore === "number" && (
                      <>
                        종합 {f.finalScore}
                        {typeof f.aestheticScore === "number" &&
                          ` · 미학 ${f.aestheticScore}`}
                        {typeof f.harmonyScore === "number" &&
                          ` · 조화 ${f.harmonyScore}`}
                      </>
                    )}
                    {f.birthDate && (
                      <span style={{ marginLeft: 8 }}>· {f.birthDate}</span>
                    )}
                  </div>
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
                  onClick={() => removeFavorite(f.fullName, f.birthDate)}
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

function buildEvaluateUrl(f: { lastName: string; name: string; birthDate?: string; birthTime?: string; gender?: string; tone?: string }) {
  const params = new URLSearchParams();
  if (f.lastName) params.set("lastName", f.lastName);
  if (f.name) params.set("name", f.name);
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
