"use client";

/**
 * CompanyForm — /company 입력 폼 + 결과 (클라이언트 영역)
 *
 * 히어로·안내 글은 page.tsx(서버 컴포넌트)가 렌더한다. 여기에는 상태가 필요한 것만 둔다.
 * 결과 바로 아래에 page.tsx의 확정 전 확인 안내(CompanyCheckNotice)가 이어지므로
 * 결과 블록 안에는 상세 면책을 다시 두지 않고 목록 위 한 줄 요약만 둔다.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";
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
import { COMPANY_FALLBACK_OPTIONS } from "./options";

const MAX_KEYWORDS = 3;
const MAX_KEYWORD_LENGTH = 20; // 백엔드 검증과 같은 값 (CompanyNamesController)

/**
 * 입력칸의 말을 키워드 목록에 합친다 — 3개 상한·중복 제거.
 * 예시 placeholder가 "결, 정성, 바다"라 쉼표로 한 번에 치는 사람이 있어 쉼표로도 나눈다.
 */
function mergeKeywords(current: string[], draft: string): string[] {
  const next = [...current];
  for (const raw of draft.split(/[,，、]/)) {
    const k = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!k || next.includes(k)) continue;
    if (next.length >= MAX_KEYWORDS) break;
    next.push(k);
  }
  return next;
}

export function CompanyForm() {
  const [options, setOptions] =
    useState<CompanyNamingOptions>(COMPANY_FALLBACK_OPTIONS);

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
    setKeywords(mergeKeywords(keywords, keywordDraft));
    setKeywordDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 입력칸에 쳐 두고 '추가'를 누르지 않은 채 제출해도 버리지 않는다 —
    // 버리면 키워드도 안 들어가고 안내(keywordNotices)도 비어 '무시당했다'가 된다
    const sentKeywords = mergeKeywords(keywords, keywordDraft);
    if (keywordDraft.trim()) {
      setKeywords(sentKeywords);
      setKeywordDraft("");
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await companyNames({
        industry,
        keywords: sentKeywords,
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
                이름에 넣고 싶은 글자{" "}
                <span className="font-normal text-muted-foreground">
                  (선택, 최대 3개 · 1~2음절 우리말이 가장 잘 어울려요)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="keyword"
                  placeholder="예: 결, 정성, 바다"
                  value={keywordDraft}
                  maxLength={MAX_KEYWORD_LENGTH}
                  disabled={keywords.length >= MAX_KEYWORDS}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // 한글 조합 중 Enter는 조합 확정용 — 여기서 칩을 만들면 마지막 음절('성')이
                    // 입력칸에 남아 제출 때 두 번째 키워드로 합쳐진다. 확정 뒤 Enter에서 추가한다.
                    if (e.nativeEvent.isComposing) return;
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
                  disabled={
                    keywords.length >= MAX_KEYWORDS || !keywordDraft.trim()
                  }
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
        <section className="mb-8">
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

          {/* 확인 안내 한 줄 요약 — 상세는 목록 바로 아래 CompanyCheckNotice(page.tsx).
              목록이 12~30장이라 맨 아래에만 두면 대부분 못 보고 지나간다 */}
          <p className="mb-4 flex gap-2 rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-text-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-teal" />
            <span>
              추천은 등록 가능 여부를 판단하지 않아요. 확정 전에 상표와 상호
              등기를 따로 확인하시고, 카드 아래 링크로 같은 이름이 있는지
              먼저 찾아보세요.
            </span>
          </p>

          <CompanyResultList candidates={result.candidates} />
        </section>
      )}

      {result && result.totalCount === 0 && (
        <div className="mb-8 rounded-2xl border p-10 text-center">
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
    </>
  );
}

export default CompanyForm;
