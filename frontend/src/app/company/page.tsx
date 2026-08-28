"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { companyNames, companyOptions } from "@/lib/api";
import type { CompanyNamingOptions, CompanyNamingResponse } from "@/lib/types";
import { CompanyResultList } from "@/components/design/CompanyResult";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// 백엔드 GET /company-names/options 를 못 받아왔을 때의 대비값.
// 옵션 요청 실패가 곧 기능 불가가 되지 않도록 최소 셋을 들고 있는다.
const FALLBACK_OPTIONS: CompanyNamingOptions = {
  industries: [
    { key: "cafe", label: "카페 · 디저트" },
    { key: "food", label: "음식점 · 외식" },
    { key: "bakery", label: "베이커리 · 제과" },
    { key: "beauty", label: "뷰티 · 미용" },
    { key: "fashion", label: "패션 · 의류" },
    { key: "it", label: "IT · 소프트웨어" },
    { key: "edu", label: "교육 · 학원" },
    { key: "health", label: "병원 · 의원" },
    { key: "wellness", label: "운동 · 필라테스" },
    { key: "retail", label: "소매 · 편집숍" },
    { key: "interior", label: "인테리어 · 건축" },
    { key: "consulting", label: "컨설팅 · 전문서비스" },
    { key: "culture", label: "문화 · 공방" },
    { key: "pet", label: "반려동물" },
    { key: "travel", label: "여행 · 숙박" },
    { key: "agri", label: "농수산 · 식품제조" },
    { key: "finance", label: "금융 · 투자" },
    { key: "law", label: "법률 · 세무" },
  ],
  tones: [
    { key: "modern", label: "모던" },
    { key: "classic", label: "클래식" },
    { key: "warm", label: "따뜻함" },
    { key: "premium", label: "프리미엄" },
    { key: "playful", label: "경쾌함" },
  ],
  styles: [
    { key: "all", label: "전체" },
    { key: "hanja", label: "한자 조합" },
    { key: "pure-korean", label: "순우리말" },
    { key: "english", label: "영문 조어" },
  ],
};

export default function CompanyPage() {
  const [options, setOptions] =
    useState<CompanyNamingOptions>(FALLBACK_OPTIONS);

  const [industry, setIndustry] = useState("cafe");
  const [tone, setTone] = useState("modern");
  const [style, setStyle] = useState("all");
  const [syllables, setSyllables] = useState("0");
  const [count, setCount] = useState("12");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");

  const [result, setResult] = useState<CompanyNamingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 업종 목록은 백엔드 데이터가 진실의 원천이다 — 어긋나면 400이 난다
  useEffect(() => {
    let alive = true;
    companyOptions()
      .then((o) => {
        if (alive && o.industries?.length) setOptions(o);
      })
      .catch(() => {
        /* 대비값 유지 */
      });
    return () => {
      alive = false;
    };
  }, []);

  function addKeyword() {
    const k = keywordDraft.trim();
    if (!k || keywords.length >= 3 || keywords.includes(k)) {
      setKeywordDraft("");
      return;
    }
    setKeywords([...keywords, k.slice(0, 20)]);
    setKeywordDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await companyNames({
        industry,
        keywords,
        tone,
        style,
        syllables: parseInt(syllables, 10),
        count: parseInt(count, 10),
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  const industryLabel =
    options.industries.find((i) => i.key === industry)?.label ?? industry;

  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <header className="mb-10 space-y-3 text-center">
          <p className="eyebrow">COMPANY · 상호</p>
          <h1 className="text-3xl font-medium leading-snug tracking-tight text-navy md:text-4xl">
            오래 불릴 이름의 결
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            회사명 · 가게명 · 브랜드명을 업종에 맞춰 지어드려요. 업종 일반어를
            피해 상표와 검색에서 자기 자리를 만드는 이름을 고릅니다.
          </p>
        </header>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-navy">어떤 일을 하시나요?</CardTitle>
            <CardDescription>
              업종만 고르셔도 됩니다. 나머지는 취향에 맞게 조정하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>업종</Label>
                <Select
                  value={industry}
                  onValueChange={(v) => setIndustry(v ?? "cafe")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.industries.map((i) => (
                      <SelectItem key={i.key} value={i.key}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>톤</Label>
                <Select value={tone} onValueChange={(v) => setTone(v ?? "modern")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.tones.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>이름의 결</Label>
                <Select value={style} onValueChange={(v) => setStyle(v ?? "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.styles.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>글자 수</Label>
                <Select
                  value={syllables}
                  onValueChange={(v) => setSyllables(v ?? "0")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">무관</SelectItem>
                    <SelectItem value="2">2글자</SelectItem>
                    <SelectItem value="3">3글자</SelectItem>
                    <SelectItem value="4">4글자</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>추천 개수</Label>
                <Select value={count} onValueChange={(v) => setCount(v ?? "12")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12개</SelectItem>
                    <SelectItem value="20">20개</SelectItem>
                    <SelectItem value="30">30개</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="keyword">
                  담고 싶은 말{" "}
                  <span className="font-normal text-muted-foreground">
                    (선택, 최대 3개 · 1~2음절 우리말이 이름에 가장 잘 남아요)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="keyword"
                    placeholder="예: 정성, 고요, 물"
                    value={keywordDraft}
                    maxLength={20}
                    disabled={keywords.length >= 3}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addKeyword}
                    disabled={keywords.length >= 3 || !keywordDraft.trim()}
                  >
                    추가
                  </Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {keywords.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setKeywords(keywords.filter((x) => x !== k))
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs text-teal"
                      >
                        {k}
                        <X className="size-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {loading ? "상호 짓는 중..." : "상호 추천받기"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-warm/50 p-4 text-sm text-amber-warm">
            {error}
          </div>
        )}

        {result && result.totalCount > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium text-navy">
                {industryLabel} 상호 {result.totalCount}개
              </h2>
              <p className="text-xs text-muted-foreground">
                점수 = 기억성 30 + 발음 25 + 식별력 25 + 업종적합 20
              </p>
            </div>

            {/* 넣은 키워드를 왜 그대로 안 썼는지 — 식별력이 이 기능의 핵심이라 결과 위에 둔다 */}
            {result.keywordNotices?.length > 0 && (
              <div
                className="mb-4 space-y-2 rounded-xl p-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-amber-warm) 8%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-amber-warm) 35%, transparent)",
                }}
              >
                {result.keywordNotices.map((n, i) => (
                  <div
                    key={i}
                    className="flex gap-2 text-xs leading-relaxed"
                    style={{ color: "var(--color-amber-warm)" }}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            )}

            <CompanyResultList candidates={result.candidates} />

            {/* 엔진은 동음 충돌을 구조적으로 줄일 뿐 등록 가능성을 보장하지 않는다 */}
            <p className="mt-8 rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-muted-foreground">
              마음에 드는 이름을 정하셨다면, <strong>확정 전에 상표 등록
              가능성과 상호 등기 중복을 반드시 따로 확인하세요.</strong>{" "}
              특허정보넷 키프리스(kipris.or.kr)에서 상표를, 인터넷등기소에서
              같은 관할의 동일 상호를 조회할 수 있습니다. 이 추천은 발음과
              식별력을 기준으로 고른 것이지 등록 가능 여부를 판단한 것이
              아닙니다.
            </p>
          </section>
        )}

        {result && result.totalCount === 0 && (
          <div className="rounded-2xl border p-10 text-center">
            <p className="eyebrow mb-3">RESULT · EMPTY</p>
            <h2 className="mb-3 text-2xl font-medium text-navy">
              조건에 맞는 상호를 찾지 못했어요
            </h2>
            <p className="text-sm text-muted-foreground">
              글자 수를 &lsquo;무관&rsquo;으로 두거나 이름의 결을
              &lsquo;전체&rsquo;로 바꿔보세요
            </p>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
