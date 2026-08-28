using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 상호(회사명·가게명·브랜드명) 작명 엔진.
///
/// 인명 엔진과 파이프라인을 공유하지 않는다. 성씨가 없어 연음 평가가 성립하지 않고,
/// 사업자에게 실질적인 축(기억성·발음·식별력·업종적합)이 미학/조화와 다르기 때문이다.
///
/// 생성 축 3종:
///   hanja       한자 2자 조합 → 한글 독음 (두음법칙 적용)
///   pure-korean 순우리말 어근 + 어근/어미 합성
///   english     라틴 어근 + 접미 조어 → 한글 음차
///
/// 세 축 모두 의미 축(CompanyNamingData.Axes)에서 재료를 꺼내므로
/// 업종·키워드가 곧 의미 축 선택으로 환원된다.
/// </summary>
public class CompanyNamingEngine : ICompanyNamingEngine
{
    /// <summary>업종이 지정한 축 순서에 따른 기본 가중치</summary>
    private static readonly double[] AxisRankWeights = { 1.0, 0.85, 0.7, 0.6 };

    /// <summary>키워드가 축에 맞았을 때 얹는 가중치</summary>
    private const double KeywordAxisBoost = 0.55;

    /// <summary>키워드가 있을 때, 걸리지 않은 축을 물리는 비율</summary>
    private const double NonMatchedAxisDamping = 0.75;

    public Task<CompanyNamingResult> GenerateAsync(
        string industry,
        IReadOnlyList<string> keywords,
        string tone,
        string style,
        int syllables,
        int count)
    {
        count = Math.Clamp(count, 1, 50);
        var industryKey = CompanyNamingData.IsValidIndustry(industry) ? industry : "retail";
        var toneKey = CompanyNamingData.IsValidTone(tone) ? tone : "modern";
        var styleKey = style?.ToLowerInvariant() switch
        {
            "hanja" or "pure-korean" or "english" => style!.ToLowerInvariant(),
            _ => "all",
        };

        var profile = CompanyNamingData.Industries[industryKey];
        var toneProfile = CompanyNamingData.Tones[toneKey];
        var cleanKeywords = (keywords ?? Array.Empty<string>())
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => k.Trim())
            .Take(3)
            .ToList();

        var axisWeights = ResolveAxisWeights(profile, cleanKeywords);
        var axisKeys = axisWeights.OrderByDescending(kv => kv.Value).Select(kv => kv.Key).ToList();

        var raw = new List<CompanyNameCandidate>();
        var meta = new Dictionary<CompanyNameCandidate, (string axisA, string axisB)>();

        if (styleKey is "all" or "hanja")
            GenerateHanja(axisKeys, raw, meta);
        if (styleKey is "all" or "pure-korean")
            GenerateKorean(axisKeys, cleanKeywords, raw, meta);
        if (styleKey is "all" or "english")
            GenerateEnglish(axisKeys, raw, meta);

        // 이름 기준 중복 제거 — 같은 표기가 여러 경로로 나올 수 있다
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var scored = new List<CompanyNameCandidate>();

        foreach (var c in raw)
        {
            if (!IsUsableName(c.Name)) continue;
            if (syllables is >= 2 and <= 4 && c.Name.Length != syllables) continue;
            if (!seen.Add(c.Name)) continue;

            var (axisA, axisB) = meta[c];
            Score(c, profile, toneProfile, axisWeights, cleanKeywords, axisA, axisB);
            BuildNarrative(c, profile, axisA, axisB);
            scored.Add(c);
        }

        var top = SelectDiverse(scored, count);

        return Task.FromResult(new CompanyNamingResult
        {
            Industry = industryKey,
            IndustryLabel = profile.Label,
            IndustrySuffixes = profile.Suffixes.ToList(),
            KeywordNotices = BuildKeywordNotices(profile, cleanKeywords),
            Candidates = top,
            TotalCount = top.Count,
        });
    }

    // ============================================================
    // 결과 선택 — 점수순으로만 자르면 한쪽으로 쏠린다
    // ============================================================

    /// <summary>
    /// 점수 상위를 그대로 자르면 같은 첫 글자가 목록을 덮는다.
    /// (예: 법률 업종에서 久 조합이 상위를 독식해 "구○"만 8개)
    /// 첫 음절·끝 음절·생성 축에 상한을 두고 훑은 뒤, 모자라면 상한을 풀어 채운다.
    /// </summary>
    private static List<CompanyNameCandidate> SelectDiverse(List<CompanyNameCandidate> pool, int count)
    {
        var ordered = pool
            .OrderByDescending(c => c.TotalScore)
            .ThenBy(c => c.Name.Length)
            .ThenBy(c => c.Name, StringComparer.Ordinal)
            .ToList();

        var picked = new List<CompanyNameCandidate>();
        var taken = new HashSet<string>(StringComparer.Ordinal);
        var heads = new Dictionary<char, int>();
        var tails = new Dictionary<char, int>();
        var styles = new Dictionary<string, int>();

        // 축 안에서의 첫 글자 반복. 전역 상한(2)만으로는 부족하다 — 한자는 배정 슬롯이
        // 2개뿐이라 둘 다 같은 글자로 시작할 수 있다(曙가 앞자리인 쌍이 가장 많아
        // 실제로 '서각/서아', '서직/서탁'처럼 나왔다).
        var styleHeads = new Dictionary<(string Style, char Head), int>();

        // 같은 재료를 순서만 바꾼 쌍 — 智結"지결"과 結智"결지", 마루+채와 채+마루가
        // 한 목록에 나란히 오면 후보를 채우려 애쓰는 것처럼 읽힌다. 1차에서는 하나만 통과시킨다.
        var partSets = new Dictionary<string, int>(StringComparer.Ordinal);

        void Sweep(int headCap, int tailCap, int styleCap, int styleHeadCap, int partSetCap)
        {
            foreach (var c in ordered)
            {
                if (picked.Count >= count) return;
                if (taken.Contains(c.Name)) continue;

                char head = c.Name[0];
                char tail = c.Name[^1];
                var partSet = PartSetKey(c);
                if (heads.GetValueOrDefault(head) >= headCap) continue;
                if (tails.GetValueOrDefault(tail) >= tailCap) continue;
                if (styles.GetValueOrDefault(c.Style) >= styleCap) continue;
                if (styleHeads.GetValueOrDefault((c.Style, head)) >= styleHeadCap) continue;
                if (partSets.GetValueOrDefault(partSet) >= partSetCap) continue;

                picked.Add(c);
                taken.Add(c.Name);
                heads[head] = heads.GetValueOrDefault(head) + 1;
                tails[tail] = tails.GetValueOrDefault(tail) + 1;
                styles[c.Style] = styles.GetValueOrDefault(c.Style) + 1;
                styleHeads[(c.Style, head)] = styleHeads.GetValueOrDefault((c.Style, head)) + 1;
                partSets[partSet] = partSets.GetValueOrDefault(partSet) + 1;
            }
        }

        // 생성 축 상한을 1/3 언저리로 잡아야 '전체'를 고른 사용자가 세 결을 다 본다.
        // 절반으로 두면 점수가 높은 두 축이 목록을 채워 한자 조합이 통째로 밀려난다.
        Sweep(2, 2, Math.Max(2, (int)Math.Ceiling(count / 3.0) + 1), 1, 1);
        Sweep(3, 3, int.MaxValue, 2, 1);
        Sweep(int.MaxValue, int.MaxValue, int.MaxValue, int.MaxValue, int.MaxValue);

        return picked
            .OrderByDescending(c => c.TotalScore)
            .ThenBy(c => c.Name.Length)
            .ThenBy(c => c.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>구성 요소를 순서와 무관하게 식별하는 키 — 뒤집은 쌍을 같은 것으로 본다</summary>
    private static string PartSetKey(CompanyNameCandidate c)
    {
        if (c.Parts.Count < 2) return c.Style + ":" + c.Name;
        var symbols = c.Parts.Select(p => p.Symbol).OrderBy(x => x, StringComparer.Ordinal);
        return c.Style + ":" + string.Join("|", symbols);
    }

    // ============================================================
    // 축 선택
    // ============================================================

    /// <summary>
    /// 업종이 지정한 축에 기본 가중치를 주고, 키워드가 맞는 축에 가산한다.
    /// 키워드가 업종 축 밖의 축에 맞으면 그 축을 새로 끌어들인다.
    /// </summary>
    private static Dictionary<string, double> ResolveAxisWeights(
        CompanyNamingData.IndustryProfile profile,
        List<string> keywords)
    {
        var weights = new Dictionary<string, double>();

        for (int i = 0; i < profile.AxisKeys.Count; i++)
        {
            var w = i < AxisRankWeights.Length ? AxisRankWeights[i] : 0.5;
            weights[profile.AxisKeys[i]] = w;
        }

        var matched = new HashSet<string>(StringComparer.Ordinal);
        foreach (var kw in keywords)
        foreach (var axis in CompanyNamingData.Axes.Values)
        {
            if (AxisMatchesKeyword(axis, kw)) matched.Add(axis.Key);
        }

        if (matched.Count == 0) return weights;

        // 키워드가 걸린 축은 업종 축과 나란히 앞으로 올리고, 걸리지 않은 축은 한 걸음 물린다.
        // 가산만 하면 업종 기본 순서를 못 이겨 키워드를 넣어도 결과가 그대로인 일이 생긴다.
        foreach (var key in weights.Keys.ToList())
        {
            if (!matched.Contains(key)) weights[key] *= NonMatchedAxisDamping;
        }
        foreach (var key in matched)
        {
            weights[key] = Math.Min(1.0, weights.GetValueOrDefault(key, 0.45) + KeywordAxisBoost);
        }

        return weights;
    }

    /// <summary>
    /// 넣은 키워드가 상호에 쓰기 나쁜 말이면 알려준다.
    ///
    /// 사업자는 자기 업종어("커피", "학원")를 넣고 싶어 하는데, 그건 상표법상
    /// 기술적 표장이라 등록이 어렵고 검색에서도 같은 업종 상호에 묻힌다.
    /// 엔진은 그런 후보를 감점으로 이미 밀어냈지만, 밀어냈다는 사실 자체를
    /// 말해주지 않으면 사용자는 자기 입력이 무시됐다고 느낀다.
    /// </summary>
    private static List<string> BuildKeywordNotices(
        CompanyNamingData.IndustryProfile profile,
        List<string> keywords)
    {
        var notices = new List<string>();

        foreach (var kw in keywords)
        {
            var generic = profile.GenericWords.FirstOrDefault(
                w => kw.Contains(w, StringComparison.Ordinal) || w.Contains(kw, StringComparison.Ordinal));
            if (generic != null)
            {
                notices.Add($"'{kw}'는 {profile.Label} 일반어예요. 상호에 그대로 넣으면 상표 등록이 어렵고 " +
                            "검색에서도 같은 업종 상호에 묻히기 때문에, 뜻은 살리되 표기는 다르게 풀었어요.");
                continue;
            }

            var cliche = CompanyNamingData.ClicheParts.FirstOrDefault(
                w => kw.Contains(w, StringComparison.Ordinal));
            if (cliche != null)
            {
                notices.Add($"'{kw}'에 든 '{cliche}'는 상호에 매우 흔히 쓰이는 말이라 기억에 남기 어려워요. " +
                            "다른 후보를 우선해 보여드렸어요.");
            }
        }

        return notices;
    }

    /// <summary>키워드가 축의 어휘·라벨과 겹치는지</summary>
    private static bool AxisMatchesKeyword(CompanyNamingData.MeaningAxis axis, string keyword)
    {
        if (axis.Label.Contains(keyword, StringComparison.Ordinal)) return true;
        if (axis.Hanja.Any(h => h.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        if (axis.Korean.Any(k => k.Text.Contains(keyword, StringComparison.Ordinal)
                              || k.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        if (axis.Latin.Any(l => l.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        return false;
    }

    // ============================================================
    // 생성 — 한자 조합
    // ============================================================

    /// <summary>
    /// 한자 축은 조합하지 않고 검수된 쌍(CompanyNamingData.HanjaPairs)에서 고른다.
    /// 자유 순열은 기존 한자어와의 동음 충돌을 구조적으로 피할 수 없기 때문이다.
    /// 두 축 중 하나라도 선택된 축에 걸리면 후보에 넣고, 관련도는 점수(IndustryFit)가 가른다.
    /// </summary>
    private static void GenerateHanja(
        List<string> axisKeys,
        List<CompanyNameCandidate> sink,
        Dictionary<CompanyNameCandidate, (string, string)> meta)
    {
        var selected = axisKeys.ToHashSet(StringComparer.Ordinal);

        foreach (var (headChar, tailChar) in CompanyNamingData.HanjaPairs)
        {
            if (!CompanyNamingData.HanjaIndex.TryGetValue(headChar, out var head)) continue;
            if (!CompanyNamingData.HanjaIndex.TryGetValue(tailChar, out var tail)) continue;
            if (!selected.Contains(head.AxisKey) && !selected.Contains(tail.AxisKey)) continue;

            // 두음법칙은 첫 글자에만 적용된다 (林 림 → 임)
            var headReading = NamingPrinciples.ApplyDueum(head.Seed.Reading);
            var name = headReading + tail.Seed.Reading;

            var candidate = new CompanyNameCandidate
            {
                Name = name,
                Style = "hanja",
                StyleLabel = "한자 조합",
                Hanja = headChar + tailChar,
                Parts = new()
                {
                    new CompanyNamePart { Symbol = headChar, Reading = headReading, Meaning = head.Seed.Meaning },
                    new CompanyNamePart { Symbol = tailChar, Reading = tail.Seed.Reading, Meaning = tail.Seed.Meaning },
                },
                Meaning = ComposeMeaning(head.AxisKey, tail.AxisKey),
                Romanization = RomanizationUtils.ToRoman(name),
            };
            sink.Add(candidate);
            meta[candidate] = (head.AxisKey, tail.AxisKey);
        }
    }

    // ============================================================
    // 생성 — 순우리말 합성
    // ============================================================

    private static void GenerateKorean(
        List<string> axisKeys,
        List<string> keywords,
        List<CompanyNameCandidate> sink,
        Dictionary<CompanyNameCandidate, (string, string)> meta)
    {
        // 사용자가 넣은 한글 키워드는 그대로 앞자리 어근이 된다 —
        // 요청한 말이 상호에 실제로 남는 편이 설득력이 있다.
        var keywordRoots = keywords
            .Where(k => k.Length is 1 or 2 && k.All(IsHangulSyllable))
            .Select(k => new CompanyNamingData.KoreanRoot(k, k))
            .ToList();

        foreach (var keyA in axisKeys)
        {
            var headRoots = CompanyNamingData.Axes[keyA].Korean.Concat(keywordRoots);

            foreach (var a in headRoots)
            foreach (var (b, keyB) in CompanyNamingData.KoreanTailRoots)
            {
                if (a.Text == b.Text) continue;

                var name = a.Text + b.Text;
                if (name.Length is < 2 or > 4) continue;

                var candidate = new CompanyNameCandidate
                {
                    Name = name,
                    Style = "pure-korean",
                    StyleLabel = "순우리말",
                    Parts = new()
                    {
                        new CompanyNamePart { Symbol = a.Text, Reading = a.Text, Meaning = a.Meaning },
                        new CompanyNamePart { Symbol = b.Text, Reading = b.Text, Meaning = b.Meaning },
                    },
                    Meaning = ComposeMeaning(keyA, keyB),
                    Romanization = RomanizationUtils.ToRoman(name),
                };
                sink.Add(candidate);
                meta[candidate] = (keyA, keyB);
            }
        }
    }

    // ============================================================
    // 생성 — 라틴 어근 조어
    // ============================================================

    private static void GenerateEnglish(
        List<string> axisKeys,
        List<CompanyNameCandidate> sink,
        Dictionary<CompanyNameCandidate, (string, string)> meta)
    {
        foreach (var key in axisKeys)
        {
            var axis = CompanyNamingData.Axes[key];

            foreach (var root in axis.Latin)
            foreach (var suffix in CompanyNamingData.LatinSuffixes)
            {
                var latin = JoinLatin(root.Text, suffix);
                if (latin == null) continue;

                var name = RomanizationUtils.ToHangul(latin);
                if (name.Length is < 2 or > 4) continue;

                var display = char.ToUpperInvariant(latin[0]) + latin[1..];
                var candidate = new CompanyNameCandidate
                {
                    Name = name,
                    Style = "english",
                    StyleLabel = "영문 조어",
                    Parts = new()
                    {
                        new CompanyNamePart { Symbol = root.Text, Reading = name, Meaning = root.Meaning },
                        new CompanyNamePart { Symbol = "-" + suffix, Reading = "", Meaning = "브랜드 어미" },
                    },
                    Meaning = ComposeMeaning(key, key),
                    Romanization = display,
                };
                sink.Add(candidate);
                meta[candidate] = (key, key);
            }
        }
    }

    /// <summary>
    /// 라틴 어근 + 접미 결합.
    /// 모음으로 끝난 어근에 모음 접미가 붙으면 어근의 끝모음을 떨어뜨린다 (sereno + a → serena).
    /// 자음 접미는 모음으로 끝난 어근에만 붙인다 (lum + na 같은 껄끄러운 연결을 피한다).
    /// </summary>
    private static string? JoinLatin(string root, string suffix)
    {
        bool rootEndsVowel = "aeiou".Contains(root[^1]);
        bool suffixStartsVowel = "aeiou".Contains(suffix[0]);

        if (suffixStartsVowel)
            return rootEndsVowel ? root[..^1] + suffix : root + suffix;

        return rootEndsVowel ? root + suffix : null;
    }

    // ============================================================
    // 뜻 문장
    // ============================================================

    /// <summary>두 축을 "{앞축 부사구} {뒷축 명사구}" 로 잇는다</summary>
    private static string ComposeMeaning(string axisA, string axisB)
    {
        var head = CompanyNamingData.AxisHeadPhrase.GetValueOrDefault(axisA, "한결같이");
        var tail = CompanyNamingData.AxisTailPhrase.GetValueOrDefault(axisB, "이어지는 곳");
        return $"{head} {tail}";
    }

    // ============================================================
    // 점수
    // ============================================================

    private static void Score(
        CompanyNameCandidate c,
        CompanyNamingData.IndustryProfile profile,
        CompanyNamingData.ToneProfile tone,
        Dictionary<string, double> axisWeights,
        List<string> keywords,
        string axisA,
        string axisB)
    {
        c.Scores = new CompanyScoreBreakdown
        {
            Memorability = ScoreMemorability(c.Name),
            Pronunciation = ScorePronunciation(c.Name),
            Distinctiveness = ScoreDistinctiveness(c, profile),
            IndustryFit = ScoreIndustryFit(c, tone, axisWeights, keywords, axisA, axisB),
        };

        c.TotalScore = c.Scores.Memorability
                     + c.Scores.Pronunciation
                     + c.Scores.Distinctiveness
                     + c.Scores.IndustryFit;
    }

    /// <summary>기억성 0~30 — 짧고, 받침이 과하지 않고, 소리가 자연스러울수록 높다</summary>
    private static int ScoreMemorability(string name)
    {
        double score = name.Length switch
        {
            2 => 18,
            3 => 17,
            4 => 11,
            _ => 6,
        };

        // 소리 배열의 자연스러움
        score += NamingPrinciples.EvalForeignPhonotactics(name) * 6;

        // 받침 비율 — 적을수록 부르기 쉽고 기억에 남는다
        double finalRatio = (double)KoreanUtils.CountFinalConsonants(name) / name.Length;
        score += (1.0 - finalRatio) * 6;

        return Math.Clamp((int)Math.Round(score), 0, 30);
    }

    /// <summary>발음 0~25 — 인접 음절 쌍의 보편 원리 평가를 평균낸다</summary>
    private static int ScorePronunciation(string name)
    {
        if (name.Length < 2) return 12;

        double sum = 0;
        int pairs = 0;

        for (int i = 0; i < name.Length - 1; i++)
        {
            var r1 = name[i].ToString();
            var r2 = name[i + 1].ToString();

            sum += NamingPrinciples.EvalRhythm(r1, r2) * 0.30
                 + NamingPrinciples.EvalInitialDiversity(r1, r2) * 0.20
                 + NamingPrinciples.EvalConsonantAssimilation(r1, r2) * 0.20
                 + NamingPrinciples.EvalVowelMonotony(r1, r2) * 0.15
                 + NamingPrinciples.EvalAwkwardCombination(r1, r2) * 0.15;
            pairs++;
        }

        double score = (sum / pairs) * 25;

        if (KoreanUtils.HasConsecutiveStrongPlosives(name)) score -= 6;
        if (KoreanUtils.HasSameConsonantRepetition(name)) score -= 4;

        double finalRatio = (double)KoreanUtils.CountFinalConsonants(name) / name.Length;
        if (finalRatio > 0.7) score -= 4;

        return Math.Clamp((int)Math.Round(score), 0, 25);
    }

    /// <summary>
    /// 식별력 0~25 — 상호에서만 중요한 축.
    /// 상표법상 기술적 표장(업종 일반어)은 등록이 어렵고, 검색에서도 경쟁 상호에 묻힌다.
    /// </summary>
    private static int ScoreDistinctiveness(CompanyNameCandidate c, CompanyNamingData.IndustryProfile profile)
    {
        double score = 25;

        if (profile.GenericWords.Any(w => c.Name.Contains(w, StringComparison.Ordinal)))
            score -= 12;

        if (CompanyNamingData.ClicheParts.Any(w => c.Name.Contains(w, StringComparison.Ordinal)))
            score -= 10;

        if (CompanyNamingData.BareCommonNouns.Contains(c.Name))
            score -= 12;

        // 2음절은 부르기 좋지만 동명이 나오기 쉽다 — 3음절 조어에 소폭 가산
        if (c.Name.Length >= 3) score += 2;
        if (c.Name.Length <= 1) score -= 8;

        return Math.Clamp((int)Math.Round(score), 0, 25);
    }

    /// <summary>업종 적합 0~20 — 축 가중치(최대 12) + 톤 일치(최대 8)</summary>
    private static int ScoreIndustryFit(
        CompanyNameCandidate c,
        CompanyNamingData.ToneProfile tone,
        Dictionary<string, double> axisWeights,
        List<string> keywords,
        string axisA,
        string axisB)
    {
        double wA = axisWeights.GetValueOrDefault(axisA, 0.4);
        double wB = axisWeights.GetValueOrDefault(axisB, 0.4);
        double score = (wA + wB) / 2 * 12;

        if (tone.FavoredAxes.Contains(axisA)) score += 2.5;
        if (tone.FavoredAxes.Contains(axisB)) score += 2.5;
        if (tone.FavoredStyles.Contains(c.Style)) score += 3;

        // 사용자가 넣은 말이 상호에 그대로 남았으면 확실히 앞으로 보낸다
        if (keywords.Any(k => c.Name.Contains(k, StringComparison.Ordinal))) score += 4;

        return Math.Clamp((int)Math.Round(score), 0, 20);
    }

    // ============================================================
    // 설명 · 주의사항 · 사용 예시
    // ============================================================

    private static void BuildNarrative(
        CompanyNameCandidate c,
        CompanyNamingData.IndustryProfile profile,
        string axisA,
        string axisB)
    {
        // --- 추천 이유 ---
        var composition = c.Style switch
        {
            "hanja" => $"{c.Parts[0].Symbol}({c.Parts[0].Meaning}) + {c.Parts[1].Symbol}({c.Parts[1].Meaning})를 붙여 만든 상호예요.",
            "pure-korean" => $"{c.Parts[0].Symbol}({c.Parts[0].Meaning}) + {c.Parts[1].Symbol}({c.Parts[1].Meaning})을 이은 순우리말 합성어예요.",
            _ => $"라틴 어근 {c.Parts[0].Symbol}({c.Parts[0].Meaning})에 어미 {c.Parts[1].Symbol}를 붙인 조어예요.",
        };
        c.Reasons.Add(composition);

        int finals = KoreanUtils.CountFinalConsonants(c.Name);
        var soundNote = c.Name.Length switch
        {
            2 when finals <= 1 => "2음절에 받침이 적어 한 번에 듣고 따라 부르기 좋아요.",
            2 => "2음절이라 짧게 붙지만 받침이 있어 소리가 다소 묵직해요.",
            3 when finals <= 1 => "3음절이면서 받침이 적어 리듬이 살아 있어요.",
            3 => "3음절 구성이라 간판과 도메인에 무리 없이 들어가요.",
            _ => "4음절이라 정식 상호로 쓰되 줄여 부르는 별칭을 함께 생각해두면 좋아요.",
        };
        c.Reasons.Add(soundNote);

        var axisLabelA = CompanyNamingData.Axes[axisA].Label;
        var axisLabelB = CompanyNamingData.Axes[axisB].Label;
        c.Reasons.Add(axisA == axisB
            ? $"{profile.Label} 업종에서 '{axisLabelA}' 결을 곧게 밀고 나가는 이름이에요."
            : $"{profile.Label} 업종의 '{axisLabelA}'와 '{axisLabelB}' 결을 함께 담았어요.");

        // --- 주의사항 ---
        var generic = profile.GenericWords.FirstOrDefault(w => c.Name.Contains(w, StringComparison.Ordinal));
        if (generic != null)
            c.Cautions.Add($"'{generic}'은(는) {profile.Label} 일반어예요. 상표 등록이 까다롭고 검색에서도 같은 업종 상호에 묻히기 쉬워요.");

        var cliche = CompanyNamingData.ClicheParts.FirstOrDefault(w => c.Name.Contains(w, StringComparison.Ordinal));
        if (cliche != null)
            c.Cautions.Add($"'{cliche}'은(는) 상호에 매우 흔히 쓰이는 말이라 기억에 남기 어려워요.");

        if (CompanyNamingData.BareCommonNouns.Contains(c.Name))
            c.Cautions.Add("일반명사를 단독으로 쓰면 상표 식별력이 약해요. 뒤에 고유한 말을 붙이는 편이 안전해요.");

        if (KoreanUtils.CountFinalConsonants(c.Name) == c.Name.Length && c.Name.Length >= 3)
            c.Cautions.Add("모든 음절에 받침이 있어 소리가 답답할 수 있어요. 소리 내어 여러 번 불러보세요.");

        // --- 사용 예시 ---
        foreach (var suffix in profile.Suffixes.Take(2))
            c.UsageExamples.Add($"{c.Name} {suffix}");
        c.UsageExamples.Add($"주식회사 {c.Name}");
    }

    // ============================================================
    // 필터
    // ============================================================

    /// <summary>상호로 내보낼 수 있는 표기인지 — 한글 음절만, 금칙어 없음</summary>
    private static bool IsUsableName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        if (!name.All(IsHangulSyllable)) return false;
        if (ForbiddenWordData.ContainsForbiddenWord(name)) return false;
        return true;
    }

    private static bool IsHangulSyllable(char ch) => ch >= 0xAC00 && ch <= 0xD7A3;
}
