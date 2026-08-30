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

    /// <summary>
    /// 톤이 밀어넣는 서명 축의 가중치.
    /// 업종 4순위(0.6)와 나란히 서되 1·2순위(1.0/0.85)는 절대 못 이기는 값이다 —
    /// 업종 변별력을 지키는 상한이므로 함부로 올리지 말 것.
    /// </summary>
    private const double SignatureAxisWeight = 0.55;

    /// <summary>서명 축이 이미 업종 축일 때 대신 얹는 가산</summary>
    private const double SignatureAxisBoost = 0.20;

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

        var axisWeights = ResolveAxisWeights(profile, toneProfile, cleanKeywords);
        var keywordHanja = KeywordHanjaChars(cleanKeywords);

        // 활용형에서 잘라낸 어근. 안내에 "'정성'만 따서 썼어요"라고 말하면서 결과에
        // 정성이 든 이름이 하나도 없으면 아무 말 안 한 것보다 나쁘다 — 약속을 지킨다.
        var clippedRoots = cleanKeywords
            .Select(k => new { Original = k, Root = ClipKeywordRoot(k) })
            .Where(x => x.Root != null && x.Root != x.Original)
            .Select(x => x.Root!)
            .ToHashSet(StringComparer.Ordinal);
        // ThenBy(Ordinal) 필수 — 서명 축 주입값(0.55)과 키워드 감쇠 후 값들이 근접해
        // 비교가 Dictionary 열거 순서에 노출된다. 축 귀속이 흔들리면 설명 문장까지 달라진다.
        var axisKeys = axisWeights
            .OrderByDescending(kv => kv.Value)
            .ThenBy(kv => kv.Key, StringComparer.Ordinal)
            .Select(kv => kv.Key)
            .ToList();

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
            Score(c, profile, toneProfile, axisWeights, cleanKeywords, clippedRoots, keywordHanja, axisA, axisB);
            BuildNarrative(c, profile, axisA, axisB);
            scored.Add(c);
        }

        // 키워드를 반영했다고 안내할 거라면 목록에 실제로 있어야 한다.
        // 점수만 올려서는 상위 12칸 경쟁에 밀릴 수 있으므로 한 자리를 미리 잡아둔다.
        var keywordMarks = cleanKeywords.Concat(clippedRoots).Distinct(StringComparer.Ordinal).ToList();
        var top = SelectDiverse(scored, toneProfile, count, keywordMarks);

        return Task.FromResult(new CompanyNamingResult
        {
            Industry = industryKey,
            IndustryLabel = profile.Label,
            IndustrySuffixes = profile.Suffixes.ToList(),
            KeywordNotices = BuildKeywordNotices(profile, cleanKeywords, top, styleKey, syllables),
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
    private static List<CompanyNameCandidate> SelectDiverse(
        List<CompanyNameCandidate> pool,
        CompanyNamingData.ToneProfile tone,
        int count,
        List<string> keywordMarks)
    {
        // 톤별 결 쿼터 — 12칸의 구성비 자체를 톤이 정한다.
        // 축 주입만으로는 재료가 갈려도 '클래식'과 '프리미엄'처럼 둘 다 한자를 좋아하는
        // 톤 쌍은 구성이 같아 결과가 다시 붙는다. 구성비가 다르면 목록이 눈에 띄게 달라진다.
        var quota = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < CompanyNamingData.StyleOrder.Length; i++)
        {
            var share = i < tone.StyleQuota.Length ? tone.StyleQuota[i] : 0.33;
            // 0으로 떨어져 축이 통째로 사라지지 않도록 최소 1칸은 남긴다
            quota[CompanyNamingData.StyleOrder[i]] = Math.Max(1, (int)Math.Round(count * share));
        }

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

        // styleCapMode: 0 = 톤 쿼터, 1 = 쿼터를 넉넉히 푼 값, 2 = 제한 없음
        int StyleCap(string style, int mode) => mode switch
        {
            0 => quota.GetValueOrDefault(style, count),
            1 => quota.GetValueOrDefault(style, count) + 2,
            _ => int.MaxValue,
        };

        void Sweep(int headCap, int tailCap, int styleCapMode, int styleHeadCap, int partSetCap)
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
                if (styles.GetValueOrDefault(c.Style) >= StyleCap(c.Style, styleCapMode)) continue;
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

        // 키워드가 실제로 남은 후보를 먼저 한 자리씩 앉힌다 (키워드당 1개, 전체의 1/4까지)
        if (keywordMarks.Count > 0 && count >= 4)
        {
            int reserved = 0;
            int reserveCap = Math.Max(1, count / 4);
            foreach (var mark in keywordMarks)
            {
                if (reserved >= reserveCap) break;
                var hit = ordered.FirstOrDefault(
                    c => !taken.Contains(c.Name) && c.Name.Contains(mark, StringComparison.Ordinal));
                if (hit == null) continue;

                picked.Add(hit);
                taken.Add(hit.Name);
                heads[hit.Name[0]] = heads.GetValueOrDefault(hit.Name[0]) + 1;
                tails[hit.Name[^1]] = tails.GetValueOrDefault(hit.Name[^1]) + 1;
                styles[hit.Style] = styles.GetValueOrDefault(hit.Style) + 1;
                styleHeads[(hit.Style, hit.Name[0])] = styleHeads.GetValueOrDefault((hit.Style, hit.Name[0])) + 1;
                partSets[PartSetKey(hit)] = partSets.GetValueOrDefault(PartSetKey(hit)) + 1;
                reserved++;
            }
        }

        Sweep(2, 2, 0, 1, 1);
        Sweep(3, 3, 1, 2, 1);
        Sweep(int.MaxValue, int.MaxValue, 2, int.MaxValue, int.MaxValue);

        return picked
            .OrderByDescending(c => c.TotalScore)
            .ThenBy(c => c.Name.Length)
            .ThenBy(c => c.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>활용 어미 — 사용자는 "정성스러운"처럼 꾸미는 말로 넣는다</summary>
    private static readonly string[] KeywordSuffixes =
        { "스러운", "스런", "로운", "러운", "하는", "다운", "한", "함", "움", "임", "기", "의" };

    /// <summary>
    /// 키워드를 이름에 넣을 수 있는 어근으로 다듬는다.
    ///
    /// 예전에는 1~2음절 한글만 재료가 됐다. "정성스러운"을 넣으면 이름에 흔적도 안 남아
    /// 입력이 무시된 것처럼 보였다. 활용 어미를 벗겨 1~2음절 어근을 뽑아낸다.
    /// 정성스러운→정성 / 따뜻함→따뜻 / 새로움→새로 / 다정한→다정
    ///
    /// 절단한 조각은 원형이 아니므로 리터럴 보너스(ScoreIndustryFit)를 주지 않는다 —
    /// "요청한 말이 그대로 남았다"고 볼 수 없기 때문이다.
    /// </summary>
    private static string? ClipKeywordRoot(string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword)) return null;
        if (!keyword.All(IsHangulSyllable)) return null;
        if (keyword.Length is 1 or 2) return keyword;

        var root = keyword;
        foreach (var suffix in KeywordSuffixes)
        {
            if (!root.EndsWith(suffix, StringComparison.Ordinal)) continue;
            var stem = root[..^suffix.Length];
            if (stem.Length is 1 or 2) { root = stem; break; }
        }

        if (root.Length > 2) root = root[..2];
        return root;
    }

    /// <summary>
    /// 키워드 음절과 같은 독음을 가진 한자들.
    ///
    /// '지혜'를 넣으면 {지, 혜} → 智·慧·惠 를 찾아, 그 글자가 든 검수쌍을 위로 올린다.
    /// 조합을 만들지 않고 126쌍 안에서 고르기만 하므로 '구속(久續)' 류 동음 사고가 날 수 없다.
    /// </summary>
    private static HashSet<string> KeywordHanjaChars(List<string> keywords)
    {
        var syllables = keywords
            .Where(k => k.All(IsHangulSyllable))
            .SelectMany(k => k.Select(ch => ch.ToString()))
            .ToHashSet(StringComparer.Ordinal);

        if (syllables.Count == 0) return new HashSet<string>(StringComparer.Ordinal);

        return CompanyNamingData.HanjaIndex
            .Where(kv => syllables.Contains(kv.Value.Seed.Reading)
                      || syllables.Contains(NamingPrinciples.ApplyDueum(kv.Value.Seed.Reading)))
            .Select(kv => kv.Key)
            .ToHashSet(StringComparer.Ordinal);
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
        CompanyNamingData.ToneProfile tone,
        List<string> keywords)
    {
        var weights = new Dictionary<string, double>();

        for (int i = 0; i < profile.AxisKeys.Count; i++)
        {
            var w = i < AxisRankWeights.Length ? AxisRankWeights[i] : 0.5;
            weights[profile.AxisKeys[i]] = w;
        }

        // 톤 서명 축 주입 — 업종이 안 고른 축을 재료 풀에 들여온다.
        // 가점만으로는 톤이 업종의 4개 축에 갇혀 결과가 안 갈린다(실측 100% 동일 사례 다수).
        var injected = tone.SignatureAxes.FirstOrDefault(a => !weights.ContainsKey(a));
        if (injected != null)
            weights[injected] = SignatureAxisWeight;
        else if (tone.SignatureAxes.Count > 0)
            weights[tone.SignatureAxes[0]] =
                Math.Min(1.0, weights[tone.SignatureAxes[0]] + SignatureAxisBoost);

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
    /// <summary>
    /// 키워드 안내는 반드시 **최종 목록을 보고 나서** 말한다.
    ///
    /// 원래는 절단 안내("'정성'만 따서 썼어요")를 선택 결과와 무관하게 냈는데,
    /// 결=한자·글자 수=2 같은 조건에서는 어근이 들어갈 경로가 아예 없어서
    /// 말과 결과가 어긋났다 — 목록에 정성이 0개인데 썼다고 말하는 상태.
    /// 약속은 확인한 것만 한다.
    /// </summary>
    private static List<string> BuildKeywordNotices(
        CompanyNamingData.IndustryProfile profile,
        List<string> keywords,
        List<CompanyNameCandidate> top,
        string styleKey,
        int syllables)
    {
        var notices = new List<string>();

        foreach (var kw in keywords)
        {
            var generic = profile.GenericWords.FirstOrDefault(
                w => kw.Contains(w, StringComparison.Ordinal) || w.Contains(kw, StringComparison.Ordinal));
            if (generic != null)
            {
                notices.Add($"'{kw}'{KoreanUtils.EunNeun(kw)} {profile.Label} 일반어예요. 상호에 그대로 넣으면 상표 등록이 어렵고 " +
                            "검색에서도 같은 업종 상호에 묻히기 때문에, 뜻은 살리되 표기는 다르게 풀었어요.");
                continue;
            }

            var cliche = CompanyNamingData.ClicheParts.FirstOrDefault(
                w => kw.Contains(w, StringComparison.Ordinal));
            if (cliche != null)
            {
                notices.Add($"'{kw}'에 든 '{cliche}'{KoreanUtils.EunNeun(cliche)} 상호에 매우 흔히 쓰이는 말이라 기억에 남기 어려워요. " +
                            "다른 후보를 우선해 보여드렸어요.");
                continue;
            }

            var root = ClipKeywordRoot(kw);
            if (root == null)
            {
                // 한글이 아니거나 조각이 부적격 — 못 넣었다는 사실만 정직하게 말한다.
                notices.Add($"'{kw}'{KoreanUtils.EunNeun(kw)} 이름에 글자로 넣지 못했어요. " +
                            "1~2음절 우리말이 가장 잘 들어갑니다.");
                continue;
            }

            // 글자가 실제로 목록에 남았는가
            bool literal = top.Any(c => c.Name.Contains(root, StringComparison.Ordinal));
            if (literal)
            {
                if (root != kw)
                    notices.Add($"'{kw}'{KoreanUtils.EunNeun(kw)} 그대로 넣기엔 길어 '{root}'만 따서 썼어요.");
                continue; // 원형 그대로 들어갔으면 말할 게 없다
            }

            // 글자로는 못 남았지만 같은 뜻의 한자로 담겼는가 ('지혜' → 智·慧·惠)
            var kwHanja = KeywordHanjaChars(new List<string> { kw });
            bool viaHanja = kwHanja.Count > 0 && top.Any(c => c.Hanja != null
                && c.Hanja.Any(ch => kwHanja.Contains(ch.ToString())));
            if (viaHanja)
            {
                notices.Add($"'{kw}'{KoreanUtils.EunNeun(kw)} 같은 뜻의 한자로 담았어요.");
                continue;
            }

            // 진짜로 못 넣었다 — 조건을 좁혀서 못 넣은 거면 푸는 법을 알려준다
            bool constrained = styleKey != "all" || syllables != 0;
            notices.Add(constrained
                ? $"'{kw}'{KoreanUtils.EunNeun(kw)} 지금 고른 결·글자 수에서는 이름에 넣지 못했어요. " +
                  "결을 '전체', 글자 수를 '무관'으로 바꾸면 들어갈 수 있어요."
                : $"'{kw}'{KoreanUtils.EunNeun(kw)} 이번 결과에는 넣지 못했어요.");
        }

        return notices;
    }

    /// <summary>키워드가 축의 어휘·라벨과 겹치는지</summary>
    private static bool AxisMatchesKeyword(CompanyNamingData.MeaningAxis axis, string keyword)
    {
        if (axis.Label.Contains(keyword, StringComparison.Ordinal)) return true;
        if (axis.Hanja.Any(h => h.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        // '淸' 또는 '청' 한 글자로도 축이 잡히게 한다
        if (axis.Hanja.Any(h => h.Char == keyword || h.Reading == keyword)) return true;
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
            .Select(k => ClipKeywordRoot(k))
            .Where(k => k != null)
            .Select(k => k!)
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
        HashSet<string> clippedRoots,
        HashSet<string> keywordHanja,
        string axisA,
        string axisB)
    {
        c.Scores = new CompanyScoreBreakdown
        {
            Memorability = ScoreMemorability(c.Name, tone.Shape),
            Pronunciation = ScorePronunciation(c.Name, tone.Shape),
            Distinctiveness = ScoreDistinctiveness(c, profile),
            IndustryFit = ScoreIndustryFit(c, tone, axisWeights, keywords, clippedRoots, keywordHanja, axisA, axisB),
        };

        c.TotalScore = c.Scores.Memorability
                     + c.Scores.Pronunciation
                     + c.Scores.Distinctiveness
                     + c.Scores.IndustryFit;
    }

    /// <summary>
    /// 기억성 0~30 — 짧고, 소리가 자연스럽고, 고른 톤의 취향에 맞을수록 높다.
    ///
    /// 마지막 6점(소리결)이 톤에 따라 달라진다. 이게 없으면 상위 4개 축이 같은 두 톤은
    /// 같은 재료에서 같은 이름을 골라 결과가 다시 붙는다(실측: travel의 modern/playful).
    /// </summary>
    private static int ScoreMemorability(string name, CompanyNamingData.ToneShape shape)
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

        // 소리결 — 톤의 취향 (품질 판정이 아니라 취향이다)
        score += ScoreToneShape(name, shape);

        return Math.Clamp((int)Math.Round(score), 0, 30);
    }

    /// <summary>양성모음 — 밝고 열린 소리</summary>
    private static readonly HashSet<string> BrightVowels =
        new(StringComparer.Ordinal) { "ㅏ", "ㅑ", "ㅗ", "ㅛ", "ㅐ", "ㅒ", "ㅘ", "ㅚ" };

    /// <summary>파열·파찰 초성 — 톡 튀는 소리</summary>
    private static readonly HashSet<string> PlosiveInitials =
        new(StringComparer.Ordinal)
        { "ㄱ", "ㄲ", "ㅋ", "ㄷ", "ㄸ", "ㅌ", "ㅂ", "ㅃ", "ㅍ", "ㅈ", "ㅉ", "ㅊ" };

    /// <summary>
    /// 톤의 소리 취향 점수 0~6.
    ///
    /// 방향 벡터가 +면 그 성질이 많을수록, -면 적을수록 점수를 준다.
    /// 최대 6점은 의도적으로 작다 — 연속 경음 감점(6)과 식별력 감점(12)을 못 이겨야
    /// 톤을 반영한답시고 나쁜 이름이 올라오는 일이 없다.
    /// </summary>
    private static double ScoreToneShape(string name, CompanyNamingData.ToneShape shape)
    {
        if (name.Length == 0) return 0;

        int finals = 0, bright = 0, plosive = 0;
        foreach (var ch in name)
        {
            var (initial, vowel, final) = KoreanUtils.Decompose(ch);
            if (!string.IsNullOrEmpty(final)) finals++;
            if (BrightVowels.Contains(vowel)) bright++;
            if (PlosiveInitials.Contains(initial)) plosive++;
        }

        double n = name.Length;
        double lenFit = 1.0 - Math.Min(1.0, Math.Abs(name.Length - shape.IdealLength) / 2.0);

        // w >= 0 이면 x가 클수록, w < 0 이면 x가 작을수록 점수를 준다. 결과는 [0, |w|]
        static double Term(double w, double x) => w >= 0 ? w * x : -w * (1 - x);

        return lenFit * 2.0
             + Term(shape.Final, 1.0 - finals / n) * 1.6
             + Term(shape.Bright, bright / n) * 1.6
             + Term(shape.Plosive, plosive / n) * 0.8;
    }

    /// <summary>발음 0~25 — 인접 음절 쌍의 보편 원리 평가를 평균낸다</summary>
    private static int ScorePronunciation(string name, CompanyNamingData.ToneShape shape)
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

        // 두운은 톤에 따라 장점이기도 하다 — 경쾌한 상호는 같은 소리로 시작하면 착 붙는다.
        // EvalInitialDiversity가 이미 깎은 만큼을 톤별로 일부 되돌리는 항이다.
        if (name.Length >= 2)
        {
            var (i1, _, _) = KoreanUtils.Decompose(name[0]);
            var (i2, _, _) = KoreanUtils.Decompose(name[1]);
            if (i1 == i2 && i1 != "ㅇ" && !string.IsNullOrEmpty(i1))
                score += shape.Alliteration * 2.0;
        }

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
        HashSet<string> clippedRoots,
        HashSet<string> keywordHanja,
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
        if (keywords.Any(k => c.Name.Contains(k, StringComparison.Ordinal)))
        {
            score += 4;
        }
        else if (clippedRoots.Any(r => c.Name.Contains(r, StringComparison.Ordinal)))
        {
            // 원형이 아니라 잘라낸 어근 — 리터럴(+4)보다는 약하게, 하지만 목록에는 올라와야 한다
            score += 2;
        }
        else if (keywordHanja.Count > 0 && c.Hanja != null
                 && c.Hanja.Any(ch => keywordHanja.Contains(ch.ToString())))
        {
            // 리터럴로는 못 남았지만 뜻이 같은 한자가 들어간 경우 ('지혜' → 智·慧·惠)
            score += 3;
        }

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
