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
        // NFC는 여기서 한 번만 한다 — 한글 IME로 두음 독음을 변환하면 호환 한자(림 → U+F9F4 林)가 들어오는데,
        // 축 씨앗·검수쌍·한자 사전은 통합 한자(U+6797)로 적혀 있다. 매칭만 NFC로 맞추면 판정·조사는 원문 글자를 봐서
        // 독음을 못 찾고 "'林'는"이 됐다(2026-10-21 검토 BCF-3). 판정·조사·매칭·안내가 모두 같은 글자를 보게 한다.
        var cleanKeywords = (keywords ?? Array.Empty<string>())
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => ToNfc(k.Trim()))
            .Take(3)
            .ToList();

        // 한자와 한글이 섞인 키워드('淸빛')는 글자 갈래마다 나눠 따로 판정하고 따로 쓴다(淸 → 한자 재료, 빛 → 한글 재료).
        // 통째로 한자 키워드로 다루면 한글 부분이 재료로도 안내로도 다뤄지지 않고 말없이 버려졌다(BCF-2).
        var keywordParts = cleanKeywords.SelectMany(SplitKeyword).ToList();

        // 업종 일반어·클리셰·금칙어 키워드는 안내 대상일 뿐 재료가 아니다.
        // 안내문이 "이름에는 쓰지 않았어요"라고 말하는 이상, 어근 삽입·한자 매칭·
        // 축 가중치·예약 슬롯 어느 경로로도 정말로 쓰이면 안 된다 — 실측에서
        // '카페' 키워드에 예약 슬롯이 '카페담'을 앉혀 안내와 정면 모순이 났었다.
        //
        // 한자 키워드(林)의 독음(임)은 거절 판정(일반어·클리셰·금칙어)에만 쓰고, 재료로는 글자 그대로 쓴다.
        // 독음을 재료로 쓰면 두음법칙으로 '림'이 '임'이 되어 稔(임)·거둠(거둬들임) 축으로 쏠리고,
        // 순우리말 리터럴 경로로 들어가 '임담'이 '순우리말' 카드로 나왔다(2026-10-21 검토).
        var acceptedParts = keywordParts.Where(p => !IsRefusedPart(p, profile)).ToList();
        var materialKeywords = acceptedParts
            .Where(p => !p.HanjaTyped)
            .Select(p => p.Text)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var hanjaKeywordChars = HanCharsOf(acceptedParts.Where(p => p.HanjaTyped).Select(p => p.Text));

        var axisWeights = ResolveAxisWeights(profile, toneProfile, materialKeywords, hanjaKeywordChars);
        var keywordHanja = KeywordHanjaChars(materialKeywords);
        keywordHanja.UnionWith(hanjaKeywordChars);

        // 활용형에서 잘라낸 어근. 안내에 "'정성'만 따서 썼어요"라고 말하면서 결과에
        // 정성이 든 이름이 하나도 없으면 아무 말 안 한 것보다 나쁘다 — 약속을 지킨다.
        var clippedRoots = materialKeywords
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
        var keywordHeadOf = new Dictionary<CompanyNameCandidate, string>();

        if (styleKey is "all" or "hanja")
            GenerateHanja(axisKeys, raw, meta);
        if (styleKey is "all" or "pure-korean")
            GenerateKorean(axisKeys, materialKeywords, raw, meta, keywordHeadOf);
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
            Score(c, profile, toneProfile, axisWeights, materialKeywords, clippedRoots, keywordHanja, axisA, axisB);
            BuildNarrative(c, profile, axisA, axisB, keywordHeadOf.GetValueOrDefault(c));
            scored.Add(c);
        }

        // 키워드를 반영했다고 안내할 거라면 목록에 실제로 있어야 한다.
        // 점수만 올려서는 상위 12칸 경쟁에 밀릴 수 있으므로 한 자리를 미리 잡아둔다.
        // 한글 키워드는 표기에, 한자 키워드는 한자 표기에 그 글자가 든 후보를 앉힌다.
        var keywordMarks = materialKeywords.Concat(clippedRoots)
            .Distinct(StringComparer.Ordinal)
            .Select(mark => (Func<CompanyNameCandidate, bool>)(c => c.Name.Contains(mark, StringComparison.Ordinal)))
            .Concat(hanjaKeywordChars.Select(ch =>
                (Func<CompanyNameCandidate, bool>)(c => c.Hanja != null && c.Hanja.Contains(ch, StringComparison.Ordinal))))
            .ToList();
        var top = SelectDiverse(scored, toneProfile, count, keywordMarks);

        return Task.FromResult(new CompanyNamingResult
        {
            Industry = industryKey,
            IndustryLabel = profile.Label,
            IndustrySuffixes = profile.Suffixes.ToList(),
            KeywordNotices = BuildKeywordNotices(profile, cleanKeywords, keywordParts, top, meta, styleKey, syllables),
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
        List<Func<CompanyNameCandidate, bool>> keywordMarks)
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
                var hit = ordered.FirstOrDefault(c => !taken.Contains(c.Name) && mark(c));
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

    /// <summary>
    /// 이름 재료로 받지 않는 키워드 — BuildKeywordNotices의 거절 분기와 같은 기준.
    /// 여기서 걸리는 키워드는 안내문이 "이름에는 쓰지 않았어요"라고 말하므로,
    /// 생성·가점·예약 어느 경로에도 들어가면 안 된다.
    /// </summary>
    private static bool IsRefusedKeyword(
        string keyword, CompanyNamingData.IndustryProfile profile, bool hanjaTyped = false, bool skipForbidden = false)
    {
        if (GenericWordIn(keyword, profile, hanjaTyped) != null)
            return true;
        if (CompanyNamingData.ClicheParts.Any(w => keyword.Contains(w, StringComparison.Ordinal)))
            return true;
        if (!skipForbidden && ForbiddenPartOf(keyword) != null)
            return true;
        return false;
    }

    /// <summary>키워드 조각의 거절 판정 — 판정은 독음으로, 축 씨앗 한자는 독음 금칙어를 보지 않는다(SkipsReadingForbidden)</summary>
    private static bool IsRefusedPart(KeywordPart part, CompanyNamingData.IndustryProfile profile) =>
        IsRefusedKeyword(NormalizeKeyword(part.Text), profile, part.HanjaTyped, SkipsReadingForbidden(part));

    /// <summary>
    /// 한자로 친 조각의 글자가 모두 축 씨앗(HanjaIndex)이면 독음 금칙어 판정을 건너뛴다.
    ///
    /// 和(화, 어울림)·開(개, 엶)는 축 씨앗인데 독음이 공용 금칙어 '화'·'개'에 걸려 "'開'는 소리 '개'가 부정적으로
    /// 읽힐 수 있어"로 통째로 거절됐고, 프로덕션에서 움직이던 축(START·WARMTH)이 멈췄다(2026-10-21 검토 BCF-1).
    /// 한자 키워드는 글자 그대로만 쓰이므로(축 씨앗·검수쌍 매칭) 독음이 이름에 들어갈 경로가 없고,
    /// 그 소리가 든 표기는 IsUsableName이 어차피 거른다. 범위는 축 씨앗으로 좁힌다 — 씨앗이 아닌 한자는
    /// 효과가 없으니 거절 판정을 그대로 둔다. 일반어·클리셰 판정은 그대로 한다(美容 → 미용).
    /// </summary>
    private static bool SkipsReadingForbidden(KeywordPart part)
    {
        if (!part.HanjaTyped) return false;
        return HanCharsOf(new[] { part.Text }).All(CompanyNamingData.HanjaIndex.ContainsKey);
    }

    /// <summary>
    /// 키워드 한 조각 — 판정·재료·안내의 단위. 한자와 한글(또는 다른 글자)이 섞인 키워드('淸빛')는 글자 갈래마다
    /// 조각으로 나눈다(淸 / 빛). Origin은 나누기 전의 원래 키워드다(나누지 않았으면 null) — 안내가
    /// "'淸빛'의 '빛'은 …"처럼 사용자가 친 말을 가리키게 한다.
    /// </summary>
    private readonly record struct KeywordPart(string Text, string? Origin)
    {
        public bool HanjaTyped => Text.Any(IsHanChar);

        /// <summary>안내문에서 이 조각을 가리키는 말 (따옴표 포함)</summary>
        public string Label => Origin == null ? $"'{Text}'" : $"'{Origin}'의 '{Text}'";
    }

    /// <summary>
    /// 키워드를 한자 갈래·그 밖 갈래의 연속 구간으로 나눈다 ('淸빛' → 淸, 빛 / '美容실' → 美容, 실).
    /// 한쪽 갈래뿐이면(공백 제외) 나누지 않고 그대로 한 조각이다.
    /// </summary>
    private static IEnumerable<KeywordPart> SplitKeyword(string keyword)
    {
        bool hasHan = keyword.Any(IsHanChar);
        bool hasOther = keyword.Any(ch => !IsHanChar(ch) && !char.IsWhiteSpace(ch));
        if (!hasHan || !hasOther)
        {
            yield return new KeywordPart(keyword, null);
            yield break;
        }

        int start = 0;
        for (int i = 1; i <= keyword.Length; i++)
        {
            if (i < keyword.Length && IsHanChar(keyword[i]) == IsHanChar(keyword[start])) continue;
            var text = keyword[start..i].Trim();
            if (text.Length > 0) yield return new KeywordPart(text, keyword);
            start = i;
        }
    }

    /// <summary>NFC 정규화 — 짝 없는 서로게이트처럼 정규화할 수 없는 문자열은 원문 그대로 둔다(예외로 500이 나지 않게)</summary>
    private static string ToNfc(string s)
    {
        try { return s.Normalize(System.Text.NormalizationForm.FormC); }
        catch (ArgumentException) { return s; }
    }

    /// <summary>
    /// 키워드와 겹치는 업종 일반어 (없으면 null). 한글 키워드는 양방향(커피·'카'⊂카페)으로 본다.
    /// 한자 키워드는 독음이 일반어를 통째로 품을 때만 본다(美容→미용) — 독음 한 음절이 일반어 안에
    /// 들었다고 일반어로 몰면 '美'(미)가 "뷰티 · 미용 일반어예요"가 됐다(2026-10-21 검토).
    /// </summary>
    private static string? GenericWordIn(string keyword, CompanyNamingData.IndustryProfile profile, bool hanjaTyped)
    {
        return profile.GenericWords.FirstOrDefault(w =>
            keyword.Contains(w, StringComparison.Ordinal)
            || (!hanjaTyped && w.Contains(keyword, StringComparison.Ordinal)));
    }

    /// <summary>
    /// 키워드 어근에 든 금칙어 (없으면 null).
    ///
    /// 금칙어는 부분일치로 걸러지고 '화'·'피'·'개' 같은 한 음절도 들어 있어서, '화사한'·'조화'·
    /// '피어나는'으로 만든 후보는 구조적으로 전부 IsUsableName에서 떨어진다. 생성해 보고
    /// 사라진 뒤에 "이번 결과에는 넣지 못했어요"라고 말하면 같은 입력을 몇 번 다시 눌러도
    /// 같은 말만 듣는다(결과가 결정적이다) — 생성 전에 판정해 이유를 말한다.
    /// 공용 금칙어 목록은 인명 엔진과 같이 쓰므로 여기서는 읽기만 한다.
    /// </summary>
    private static string? ForbiddenPartOf(string keyword)
    {
        var root = ClipKeywordRoot(keyword);
        if (root == null) return null;

        // 여러 개가 걸리면 가장 긴 것을 말한다 — HashSet 열거 순서에 안내 문구가 흔들리지 않게
        return ForbiddenWordData.ForbiddenWords
            .Where(w => root.Contains(w, StringComparison.Ordinal))
            .OrderByDescending(w => w.Length)
            .ThenBy(w => w, StringComparer.Ordinal)
            .FirstOrDefault();
    }

    /// <summary>
    /// 금칙어에 걸린 키워드 대신 넣어 볼 말 2개 — 업종 축 순서대로 순우리말 어근을 훑어,
    /// 어미를 붙였을 때 실제로 이름이 되는 것(소리 변화·금칙어·일반명사에 안 걸리는 조합이
    /// 하나라도 있는 것)만 고른다. 권한 말을 넣었는데 또 "넣지 못했어요"가 나오면 안 된다.
    ///
    /// 고른 글자 수도 지킨다 — 4음절을 골랐는데 1음절 '빛'을 권하면 빛+어미는 3음절을 못 넘어
    /// 같은 응답 안에서 "'빛'은 … 넣지 못했어요"가 나왔다(2026-10-21 검토). 사용자가 이미 넣은
    /// 말(과 그 말에 든 어근)은 다시 권하지 않는다. 결(한자·영문)은 호출하는 쪽이 문구로 처리한다 —
    /// 그 결에는 한글 어근이 들어갈 경로가 없어서, 권하려면 결을 '전체'로 두라고 함께 말해야 한다.
    /// </summary>
    private static List<string> SuggestKeywordAlternatives(
        CompanyNamingData.IndustryProfile profile,
        int syllables,
        IReadOnlyCollection<string> alreadyTyped)
    {
        bool lengthFixed = syllables is >= 2 and <= 4;
        return profile.AxisKeys
            .SelectMany(key => CompanyNamingData.Axes[key].Korean)
            .Select(root => root.Text)
            .Where(text => text.Length <= 2 && !IsRefusedKeyword(text, profile))
            .Where(text => !alreadyTyped.Any(typed => typed.Contains(text, StringComparison.Ordinal)))
            .Where(text => CompanyNamingData.KoreanTailRoots.Any(t =>
                t.Root.Text != text
                && !ShiftsAtRootTailJoin(text[^1], t.Root.Text[0])
                && (!lengthFixed || text.Length + t.Root.Text.Length == syllables)
                && IsUsableName(text + t.Root.Text)
                && !CompanyNamingData.BareCommonNouns.Contains(text + t.Root.Text)))
            .Distinct(StringComparer.Ordinal)
            .Take(2)
            .ToList();
    }

    /// <summary>
    /// 한자 키워드의 독음 (淸 → 청, 林 → 임). 한글과 섞여 있어도 한자만 바꾼다.
    /// 독음을 모르는 한자나 한글·한자가 아닌 글자가 있으면 원문 그대로 둔다.
    ///
    /// **판정·안내 전용이다** — 일반어·클리셰·금칙어 판정과 안내 조사('淸은')에만 쓴다.
    /// 재료(축 매칭·한자 가점·리터럴 어근)로는 한자 글자 그대로 쓴다(HanCharsOf). 독음을 재료로
    /// 쓰면 林이 두음법칙으로 '임'이 되어 稔(임)이 든 결실 축으로 쏠리고, '임담'이 순우리말
    /// 카드로 나왔다(2026-10-21 검토).
    /// </summary>
    private static string NormalizeKeyword(string keyword)
    {
        if (!keyword.Any(IsHanChar)) return keyword;

        var sb = new System.Text.StringBuilder(keyword.Length);
        for (int i = 0; i < keyword.Length; i++)
        {
            var ch = keyword[i];
            if (IsHangulSyllable(ch)) { sb.Append(ch); continue; }

            var reading = HanjaReading(ch.ToString());
            if (reading == null) return keyword;

            // 키워드 어근은 상호 앞자리에 서므로 첫머리에만 두음법칙을 건다 (林 림 → 임)
            sb.Append(i == 0 ? NamingPrinciples.ApplyDueum(reading) : reading);
        }
        return sb.ToString();
    }

    /// <summary>
    /// 한자 한 글자의 독음 — 상호 검수 사전(HanjaIndex)을 먼저 보고, 없으면 인명 사전의 대표 독음.
    /// 한글 한 음절이 아니면 모르는 것으로 본다.
    /// </summary>
    private static string? HanjaReading(string ch)
    {
        if (CompanyNamingData.HanjaIndex.TryGetValue(ch, out var seed))
            return seed.Seed.Reading;

        var reading = HanjaData.FindByCharacter(ch)?.Reading;
        return reading is { Length: 1 } && IsHangulSyllable(reading[0]) ? reading : null;
    }

    /// <summary>
    /// 키워드들에 든 한자 글자 (입력 순서, 중복 제거). 호환 한자는 NFC로 통합 한자에 맞춘다 —
    /// 축 데이터(CompanyNamingData)는 통합 한자로 적혀 있어 h.Char 비교가 어긋나지 않게.
    /// </summary>
    private static List<string> HanCharsOf(IEnumerable<string> keywords)
    {
        return keywords
            .SelectMany(k => k.Where(IsHanChar))
            .Select(ch => ch.ToString().Normalize(System.Text.NormalizationForm.FormC))
            .Distinct(StringComparer.Ordinal)
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
    /// 한글 키워드 음절과 같은 독음을 가진 한자들 — **소리 매칭**이다, 뜻은 보지 않는다.
    ///
    /// '지혜'를 넣으면 {지, 혜} → 智(슬기)·惠(베풂)를 찾아, 그 글자가 든 검수쌍을 위로 올린다.
    /// 惠는 소리만 같고 뜻은 다르다. 慧는 축 씨앗에는 있지만 검수쌍에 없어 결과에 나오지 않는다.
    /// 조합을 만들지 않고 검수쌍(HanjaPairs) 안에서 고르기만 하므로 '구속(久續)' 류 동음 사고가 날 수 없다.
    /// 한자로 친 키워드는 이 함수를 거치지 않고 그 글자 자체만 쓴다(HanCharsOf).
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
        List<string> keywords,
        List<string> hanjaKeywordChars)
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
        foreach (var axis in CompanyNamingData.Axes.Values)
        {
            if (keywords.Any(kw => AxisMatchesKeyword(axis, kw))) matched.Add(axis.Key);
            // 한자 키워드는 그 글자가 축 씨앗에 있을 때만 잡는다 — 독음으로 넓히면 林(림→임)이 稔(임)을 끌어온다
            else if (axis.Hanja.Any(h => hanjaKeywordChars.Contains(h.Char))) matched.Add(axis.Key);
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
        List<KeywordPart> parts,
        List<CompanyNameCandidate> top,
        IReadOnlyDictionary<CompanyNameCandidate, (string axisA, string axisB)> meta,
        string styleKey,
        int syllables)
    {
        var notices = new List<string>();
        bool suggested = false; // 대안 제안은 한 번만 — 금칙어 키워드가 여럿이면 같은 문장이 되풀이된다

        // 대안으로 다시 권하지 않을 말 — 사용자가 친 그대로(나눈 조각 포함), 독음, 잘라낸 어근
        var alreadyTyped = keywords.Concat(parts.Select(p => p.Text))
            .SelectMany(k => new[] { k, NormalizeKeyword(k), ClipKeywordRoot(NormalizeKeyword(k)) })
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(s => s!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        // 이 조건에서 키워드가 들어갈 수 없을 때 붙이는 '푸는 법' — **실제로 막은 조건만** 말한다.
        // 고정 문구("결을 '전체', 글자 수를 '무관'으로")는 이미 무관인 글자 수·이미 전체인 결까지 바꾸라고 했다
        // (2026-10-21 검토 BCF-5). 한자 키워드는 한자 조합 결로도 들어가고(검수쌍은 늘 2음절이라) 2글자에서도 들어간다 —
        // 그 글자의 축이 키워드로 선택되므로 막은 조건만 풀면 예약 슬롯이 그 글자가 든 쌍을 앉힌다.
        string NotIncluded(string topic, bool hanjaTyped)
        {
            bool styleBlocks = hanjaTyped ? styleKey is "pure-korean" or "english" : styleKey != "all";
            bool lengthBlocks = hanjaTyped ? syllables is 3 or 4 : syllables != 0;
            if (!styleBlocks && !lengthBlocks) return $"{topic} 이름에 넣지 못했어요.";

            var blocked = styleBlocks && lengthBlocks ? "결·글자 수" : styleBlocks ? "결" : "글자 수";
            var fixes = new List<string>();
            if (styleBlocks) fixes.Add(hanjaTyped ? "결을 '전체'나 '한자 조합'으로" : "결을 '전체'로");
            if (lengthBlocks) fixes.Add(hanjaTyped ? "글자 수를 '무관'이나 '2글자'로" : "글자 수를 '무관'으로");
            return $"{topic} 지금 고른 {blocked}에서는 이름에 넣지 못했어요. {string.Join(", ", fixes)} 바꾸면 들어갈 수 있어요.";
        }

        foreach (var part in parts)
        {
            // 판정은 독음으로 바꾼 말로, 안내는 사용자가 친 그대로 한다.
            // 조사도 독음 기준이다 ('淸는' 방지 — 淸 → 청 → '淸은')
            // 섞인 키워드에서 나눈 조각이면 원래 키워드를 함께 가리킨다 ("'淸빛'의 '빛'은")
            var kw = part.Text;
            var label = part.Label;
            var norm = NormalizeKeyword(kw);
            var topic = $"{label}{KoreanUtils.EunNeun(norm)}";
            bool hanjaTyped = part.HanjaTyped;
            var thisWord = part.Origin == null ? "이 키워드" : "이 부분"; // 나눈 조각이면 그 조각만 뺐다
            var thisWordTopic = part.Origin == null ? "이 키워드는" : "이 부분은";

            var generic = GenericWordIn(norm, profile, hanjaTyped);
            if (generic != null)
            {
                notices.Add($"{topic} {profile.Label} 일반어예요. 상호에 그대로 넣으면 상표 등록이 어렵고 " +
                            "검색에서도 같은 업종 상호에 묻히기 때문에 이름에는 쓰지 않았어요.");
                continue;
            }

            var cliche = CompanyNamingData.ClicheParts.FirstOrDefault(
                w => norm.Contains(w, StringComparison.Ordinal));
            if (cliche != null)
            {
                notices.Add($"{label}에 든 '{cliche}'{KoreanUtils.EunNeun(cliche)} 상호에 매우 흔히 쓰이는 말이라 " +
                            "기억에 남기 어려워 이름에는 쓰지 않았어요.");
                continue;
            }

            // 금칙어는 생성 전에 이미 재료에서 뺐다 — 결과를 볼 필요 없이 규칙을 그대로 말한다.
            // "이번 결과에는"이라고 하면 다시 눌러 보게 되는데, 같은 입력은 늘 같은 결과다.
            // 이유는 중립적으로 말한다 — 목록에는 '흙'·'모기'처럼 두 뜻이 아니라 그 자체로 든 말도 있어
            // "다른 뜻으로도 읽혀"는 틀린 설명이었다. 부분일치면 키워드 '전체'가 빠졌다는 것도 밝힌다
            // ("'조화'에 든 '화'는 …"은 '조'는 썼다는 뜻으로 읽혔다, 2026-10-21 검토).
            // 축 씨앗 한자(和·開)는 독음 금칙어로 거절하지 않았다(SkipsReadingForbidden) — 안내도 같은 판정을 따른다
            var forbidden = SkipsReadingForbidden(part) ? null : ForbiddenPartOf(norm);
            if (forbidden != null)
            {
                string refusal;
                if (hanjaTyped)
                    refusal = forbidden == norm
                        ? $"{topic} 소리 '{norm}'{KoreanUtils.IGa(norm)} 부정적으로 읽힐 수 있어 {thisWordTopic} 쓰지 않았어요."
                        : $"{topic} 소리 '{norm}'에 부정적으로 읽힐 수 있는 '{forbidden}'{KoreanUtils.IGa(forbidden)} 들어 있어 {thisWordTopic} 쓰지 않았어요.";
                else
                    refusal = forbidden == norm
                        ? $"{topic} 부정적으로 읽힐 수 있는 말이라 {thisWordTopic} 쓰지 않았어요."
                        : $"{label}에는 부정적으로 읽힐 수 있는 '{forbidden}'{KoreanUtils.IGa(forbidden)} 들어 있어 {thisWord} 전체를 쓰지 않았어요.";

                var alternatives = suggested
                    ? new List<string>()
                    : SuggestKeywordAlternatives(profile, syllables, alreadyTyped);
                var suggestion = "";
                if (alternatives.Count > 0)
                {
                    // 한자·영문 결에는 한글 어근이 들어갈 경로가 없다 — 권하려면 결부터 풀어야 참이다
                    var condition = styleKey is "hanja" or "english" ? "결을 '전체'로 두고 " : "";
                    suggestion = $" {condition}{string.Join("·", alternatives.Select(a => $"'{a}'"))}처럼 " +
                                 $"{profile.Label} 업종에 어울리는 다른 말을 넣어 보세요.";
                }
                suggested |= alternatives.Count > 0;
                notices.Add(refusal + suggestion);
                continue;
            }

            if (hanjaTyped)
            {
                // 한자로 친 키워드는 그 글자 그대로 한자 표기에 들어갔을 때만 반영된 것이다 (淸 → 淸智).
                // 독음 '청'으로 만든 순우리말 후보는 만들지 않는다 — 林이 '임담(순우리말)'이 되던 것.
                var chars = HanCharsOf(new[] { kw });
                if (top.Any(c => c.Hanja != null && chars.Any(ch => c.Hanja.Contains(ch, StringComparison.Ordinal))))
                    continue; // 그대로 들어갔으면 침묵 — 한글 리터럴과 같은 규칙

                bool inPairs = chars.Any(ch => CompanyNamingData.HanjaPairs.Any(p => p.Head == ch || p.Tail == ch));
                if (!inPairs)
                {
                    // 검수쌍에 없어도 축 씨앗이면 그 글자의 축은 키워드로 선택됐다(ResolveAxisWeights, 光·和·開).
                    // 결과가 그 축 쪽으로 움직였는데 "넣지 못했어요"만 말하면 반쪽 설명이다 — 그 축의 이름이
                    // 최종 목록에 실제로 있을 때만 그렇다고 말한다(확인한 것만 말한다).
                    var axisLabels = CompanyNamingData.Axes.Values
                        .Where(a => a.Hanja.Any(h => chars.Contains(h.Char)))
                        .Where(a => top.Any(c => meta.TryGetValue(c, out var ax) && (ax.axisA == a.Key || ax.axisB == a.Key)))
                        .Select(a => $"'{a.Label}'")
                        .ToList();
                    notices.Add(axisLabels.Count > 0
                        ? $"{topic} 검수한 상호 한자쌍에 없는 글자라 이름에 글자로 넣지는 못했어요. " +
                          $"대신 이 글자가 속한 {string.Join("·", axisLabels)} 결의 이름을 함께 골랐어요."
                        : $"{topic} 검수한 상호 한자쌍에 없는 글자라 이름에 넣지 못했어요. " +
                          "1~2음절 우리말이 가장 잘 들어갑니다.");
                }
                else
                    notices.Add(NotIncluded(topic, hanjaTyped: true));
                continue;
            }

            var root = ClipKeywordRoot(norm);
            if (root == null)
            {
                // 한글·한자가 아닌 키워드(영문 등)도 말하기 전에 최종 목록을 본다
                bool present = top.Any(c => c.Name.Contains(kw, StringComparison.Ordinal));
                if (present) continue; // 그대로 들어갔으면 침묵 — 한글 리터럴과 같은 규칙

                notices.Add($"{topic} 이름에 글자로 넣지 못했어요. " +
                            "1~2음절 우리말이 가장 잘 들어갑니다.");
                continue;
            }

            // 글자가 실제로 목록에 남았는가
            bool literal = top.Any(c => c.Name.Contains(root, StringComparison.Ordinal));
            if (literal)
            {
                if (root != norm)
                    notices.Add($"{topic} 그대로 넣기엔 길어 '{root}'만 따서 썼어요.");
                continue; // 원형 그대로 들어갔으면 말할 게 없다
            }

            // 글자로는 못 남았지만 소리가 같은 한자로 담겼는가 ('지혜' → 智·惠 — 뜻이 아니라 소리 매칭이다)
            var kwHanja = KeywordHanjaChars(new List<string> { norm });
            bool viaHanja = kwHanja.Count > 0 && top.Any(c => c.Hanja != null
                && c.Hanja.Any(ch => kwHanja.Contains(ch.ToString())));
            if (viaHanja)
            {
                notices.Add($"{topic} 같은 소리의 한자로 담았어요.");
                continue;
            }

            // 결·글자 수와 무관하게 이 어근은 어느 어미와도 쓴 대로 읽히지 않는다 (삶·앎 — 겹받침).
            // 조건 탓으로 돌려 "바꾸면 들어갈 수 있어요"라고 하면 거짓 약속이 된다 — 이유를 말한다.
            if (JoinsNoTail(root))
            {
                var subject = root == norm ? topic : $"{label}에서 딴 '{root}'{KoreanUtils.EunNeun(root)}";
                var (_, _, rootFinal) = KoreanUtils.Decompose(root[^1]);
                notices.Add(DoubleFinals.Contains(rootFinal)
                    ? $"{subject} 받침이 둘이라 어떤 말과 이어도 쓴 대로 읽히지 않아 이름에 넣지 않았어요."
                    : $"{subject} 뒤에 이을 말과 만나면 소리가 바뀌어 쓴 대로 읽히지 않아 이름에 넣지 않았어요.");
                continue;
            }

            // 진짜로 못 넣었다 — 조건을 좁혀서 못 넣은 거면 막은 조건만 골라 푸는 법을 알려준다
            notices.Add(NotIncluded(topic, hanjaTyped: false));
        }

        return notices;
    }

    /// <summary>
    /// 한글 키워드가 축의 어휘·라벨과 겹치는지. (한자 키워드는 ResolveAxisWeights가 글자 일치로만 본다)
    ///
    /// 라틴 어근의 뜻풀이는 **완전일치**로만 본다. 부분일치였을 때는 WISDOM의 mente "마음" 때문에
    /// 카페 키워드 '마음'이 12개 중 7개를 '슬기 · 앎' 축으로 뒤집었고(2026-10-21 감사), 그렇다고
    /// 통째로 빼자 '꽃'(flor)·'바다'(mare)·'산'(monte)·'기술'(tecna)처럼 뜻풀이로만 축에 닿던
    /// 흔한 키워드가 축을 못 움직였다(2026-10-21 검토). mente의 뜻풀이는 '생각하는 힘'으로 바꿨다.
    /// </summary>
    private static bool AxisMatchesKeyword(CompanyNamingData.MeaningAxis axis, string keyword)
    {
        if (axis.Label.Contains(keyword, StringComparison.Ordinal)) return true;
        if (axis.Hanja.Any(h => h.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        // '청' 한 글자로도 淸의 축이 잡히게 한다 (한글로 친 독음)
        if (axis.Hanja.Any(h => h.Reading == keyword)) return true;
        if (axis.Korean.Any(k => k.Text.Contains(keyword, StringComparison.Ordinal)
                              || k.Meaning.Contains(keyword, StringComparison.Ordinal))) return true;
        if (axis.Latin.Any(l => l.Meaning == keyword)) return true;
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
        Dictionary<CompanyNameCandidate, (string, string)> meta,
        Dictionary<CompanyNameCandidate, string> keywordHeadOf)
    {
        foreach (var keyA in axisKeys)
        {
            foreach (var a in CompanyNamingData.Axes[keyA].Korean)
            foreach (var (b, keyB) in CompanyNamingData.KoreanTailRoots)
            {
                if (a.Text == b.Text) continue;
                if (ShiftsAtRootTailJoin(a.Text[^1], b.Text[0])) continue;

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

        // 사용자 키워드 어근은 축 루프 밖에서 따로 만든다 — 요청한 말이 상호에
        // 실제로 남는 편이 설득력이 있다. 다만 어근을 축 루프 안에서 만들면
        // 그 축의 뜻 문장·서사가 어근에 임의 귀속된다(실측: '정성채'가
        // "고요히 뿌리내린 곳"을 주장 — '정성'은 고요 축과 무관). 어근 후보의
        // 축 귀속과 뜻은 확인 가능한 뒷자리 어미의 축으로만 말한다.
        var seenKeywordNames = new HashSet<string>(StringComparer.Ordinal);
        foreach (var kw in keywords)
        {
            var root = ClipKeywordRoot(kw);
            if (root == null) continue;

            foreach (var (b, keyB) in CompanyNamingData.KoreanTailRoots)
            {
                if (root == b.Text) continue;
                if (ShiftsAtRootTailJoin(root[^1], b.Text[0])) continue; // '결' → 결누리[결루리], '볕' → 볕우리[벼두리] 방지

                var name = root + b.Text;
                if (name.Length is < 2 or > 4) continue;
                if (!seenKeywordNames.Add(name)) continue;

                var candidate = new CompanyNameCandidate
                {
                    Name = name,
                    Style = "pure-korean",
                    StyleLabel = "순우리말",
                    Parts = new()
                    {
                        new CompanyNamePart { Symbol = root, Reading = root, Meaning = "담고 싶은 말" },
                        new CompanyNamePart { Symbol = b.Text, Reading = b.Text, Meaning = b.Meaning },
                    },
                    Meaning = $"'{root}'{KoreanUtils.IGa(root)} {CompanyNamingData.AxisTailPhrase.GetValueOrDefault(keyB, "머무는 곳")}",
                    Romanization = RomanizationUtils.ToRoman(name),
                };
                sink.Add(candidate);
                meta[candidate] = (keyB, keyB);
                keywordHeadOf[candidate] = root;
            }
        }
    }

    /// <summary>
    /// 대표음이 ㄱ·ㄷ·ㅂ으로 나는 받침 — ㅅ·ㅆ·ㅈ·ㅊ·ㅌ·ㅎ은 [ㄷ], ㅋ·ㄲ은 [ㄱ], ㅍ은 [ㅂ]으로 소리 난다.
    /// 뒤에 ㄴ·ㅁ이 오면 비음화가 예외 없이 일어난다 (볕누리→[변누리], 첫마루→[천마루]).
    /// </summary>
    private static readonly HashSet<string> ObstruentFinals = new(StringComparer.Ordinal)
    {
        "ㄱ", "ㄲ", "ㅋ", "ㄷ", "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅌ", "ㅎ", "ㅂ", "ㅍ",
    };

    /// <summary>겹받침 — 자음 앞에선 하나만 소리 나고(앎채→[암채]) 모음 앞에선 뒤 자음이 넘어간다(앎온→[알몬])</summary>
    private static readonly HashSet<string> DoubleFinals = new(StringComparer.Ordinal)
    {
        "ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ",
    };

    /// <summary>
    /// 앞 음절 받침과 뒤 음절 초성이 만나는 자리에서 쓴 글자와 다른 소리가 나는지.
    ///
    /// 상호는 전화·입소문으로 듣고 받아적어 검색하는 이름이다. [변누리]를 들은 손님은
    /// '볕누리'를 복원하지 못한다 — 한자쌍의 '받침+ㄹ 금지'(HanjaPairs_NoLiquidNasalShift)와
    /// 같은 원칙을 순우리말 결합 경계에도 적용한다(2026-10-21 감사: 볕누리·결누리·앎채가 상위권).
    ///   비음화  ㄱ·ㄷ·ㅂ 계열 받침 + ㄴ·ㅁ   볕누리→[변누리]  곁마루→[견마루]
    ///   유음화  ㄹ + ㄴ / ㄴ + ㄹ             결누리→[결루리]  온림→[올림]
    ///   ㄹ 비음화  ㄹ 외 받침 + ㄹ            담림→[담님]
    ///   겹받침  어느 소리 앞이든              앎채→[암채]
    /// 이 함수는 받침이 모음 앞에서 넘어가는 연음을 보지 않는다. 연음이 표기를 바꾸는지는
    /// 경계가 어근+어미(실질 형태소끼리)인지 어근 안(접미사)인지에 달려서, 이름 전체를 훑는
    /// HasSoundShift가 쓰기에는 맞지 않는다 — 어근+어미 경계는 ShiftsAtRootTailJoin이 따로 본다.
    /// </summary>
    private static bool ShiftsAtJoin(char front, char back)
    {
        var (_, _, final) = KoreanUtils.Decompose(front);
        if (string.IsNullOrEmpty(final)) return false;
        var (initial, _, _) = KoreanUtils.Decompose(back);

        if (DoubleFinals.Contains(final)) return true;
        if (ObstruentFinals.Contains(final) && (initial == "ㄴ" || initial == "ㅁ")) return true;
        if (final == "ㄹ" && initial == "ㄴ") return true;
        if (initial == "ㄹ" && final != "ㄹ") return true;
        return false;
    }

    /// <summary>
    /// 모음 앞에서 대표음으로 바뀐 뒤 넘어가는 받침 — ㅅ·ㅆ·ㅈ·ㅊ·ㅌ·ㅎ은 [ㄷ], ㅋ·ㄲ은 [ㄱ], ㅍ은 [ㅂ]
    /// (ㅎ은 탈락). 받침이 원래 ㄱ·ㄷ·ㅂ이면 대표음이 그 자신이라 표기가 바뀌지 않는다(이삭온→[이사곤]).
    /// </summary>
    private static readonly HashSet<string> NeutralizedBeforeVowelFinals = new(StringComparer.Ordinal)
    {
        "ㅅ", "ㅆ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "ㄲ",
    };

    /// <summary>ㄴ첨가 모음 — 받침 뒤 실질 형태소가 이·야·여·요·유로 시작하면 ㄴ이 덧난다 (표준발음법 제29항)</summary>
    private static readonly HashSet<string> NInsertionVowels = new(StringComparer.Ordinal)
    {
        "ㅣ", "ㅑ", "ㅕ", "ㅛ", "ㅠ",
    };

    /// <summary>
    /// 순우리말 어근 + 어미가 만나는 자리(실질 형태소끼리의 경계)에서 쓴 글자와 다른 소리가 나는지.
    /// 생성기(GenerateKorean 두 경로)와 대안 제안(SuggestKeywordAlternatives)만 쓴다. 검수·테스트용으로 공개한다.
    ///
    /// ShiftsAtJoin의 네 규칙에 연음 경계 둘을 더한다:
    ///   대표음 연음  ㅅ·ㅆ·ㅈ·ㅊ·ㅋ·ㅌ·ㅍ·ㅎ·ㄲ 받침 + ㅇ   볕우리→[벼두리]  숲온→[수본]  (제15항)
    ///   ㄴ첨가       받침 + 이·야·여·요·유                  잎이음→[임니음]             (제29항)
    /// 이름 전체를 훑는 HasSoundShift에는 넣지 않는다 — 어근 안의 연음은 접미사 연음이라 표기대로
    /// 넘어간다(맺음→[매즘]). ㄱ·ㄷ·ㅂ·ㄴ·ㄹ·ㅁ·ㅇ 받침의 단순 연음(이삭온·새김우리→[새기무리])은 그대로 둔다.
    /// 지금 ㅇ으로 시작하는 어미는 온·우리뿐이지만, ㅇ 전부를 막는 단순한 규칙이 어미를 늘려도 안전하다.
    /// </summary>
    public static bool ShiftsAtRootTailJoin(char front, char back)
    {
        if (ShiftsAtJoin(front, back)) return true;

        var (_, _, final) = KoreanUtils.Decompose(front);
        if (string.IsNullOrEmpty(final)) return false;
        var (initial, vowel, _) = KoreanUtils.Decompose(back);
        if (initial != "ㅇ") return false;

        if (NeutralizedBeforeVowelFinals.Contains(final)) return true;
        if (NInsertionVowels.Contains(vowel)) return true;
        return false;
    }

    /// <summary>어근이 어느 어미와도 쓴 대로 이어지지 않는지 (삶·앎 — 겹받침이면 모든 어미가 막힌다)</summary>
    private static bool JoinsNoTail(string root) =>
        CompanyNamingData.KoreanTailRoots.All(t =>
            t.Root.Text == root || ShiftsAtRootTailJoin(root[^1], t.Root.Text[0]));

    /// <summary>
    /// 이름 안 어느 음절 경계에서든 소리가 표기와 갈라지는지 (어근 자체의 소리 포함 — 넉넉→[넝넉]).
    /// 연음 규칙(ShiftsAtRootTailJoin)은 쓰지 않는다 — 쓰면 어근 안의 정상 연음(맺음→[매즘])까지 소리 변화로 잡는다.
    /// </summary>
    private static bool HasSoundShift(string name)
    {
        for (int i = 0; i < name.Length - 1; i++)
            if (ShiftsAtJoin(name[i], name[i + 1])) return true;
        return false;
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

    /// <summary>
    /// 두 축을 "{앞축 부사구} {뒷축 명사구}" 로 잇는다.
    /// 같은 축이면 전용 문장을 먼저 본다 — 영문 LIGHT 후보(루멘·솔라…)가 전부
    /// "빛처럼 빛나는 곳"이 되던 것을 막는다.
    /// </summary>
    private static string ComposeMeaning(string axisA, string axisB)
    {
        if (axisA == axisB && CompanyNamingData.AxisSamePhrase.TryGetValue(axisA, out var same))
            return same;

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
            // 리터럴로는 못 남았지만 소리가 같은 한자(한글 키워드) 또는 친 그 한자(한자 키워드)가 든 경우
            // ('지혜' → 智·惠, '林' → 芽林)
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
        string axisB,
        string? keywordRoot)
    {
        // --- 추천 이유 ---
        // 조사는 괄호 앞 말의 소리로 고른다 — 고정하면 '溫(따뜻함)를'·'채(집채)을'·'-on를'처럼
        // 고유 후보 절반이 틀렸다(2026-10-21 감사 51%). 한자는 독음, 영문 어미는 한글 음차 기준.
        var tail = c.Parts[1];
        var composition = keywordRoot != null
            ? $"담고 싶은 말 '{keywordRoot}'{KoreanUtils.EulReul(keywordRoot)} 앞에 그대로 두고 {tail.Symbol}({tail.Meaning}){KoreanUtils.EulReul(tail.Symbol)} 이었어요."
            : c.Style switch
        {
            "hanja" => $"{c.Parts[0].Symbol}({c.Parts[0].Meaning}) + {tail.Symbol}({tail.Meaning}){KoreanUtils.EulReul(tail.Reading)} 붙여 만든 상호예요.",
            "pure-korean" => $"{c.Parts[0].Symbol}({c.Parts[0].Meaning}) + {tail.Symbol}({tail.Meaning}){KoreanUtils.EulReul(tail.Symbol)} 이은 순우리말 합성어예요.",
            _ => $"라틴 어근 {c.Parts[0].Symbol}({c.Parts[0].Meaning})에 어미 {tail.Symbol}{KoreanUtils.EulReul(RomanizationUtils.ToHangul(tail.Symbol))} 붙인 조어예요.",
        };
        c.Reasons.Add(composition);

        int finals = KoreanUtils.CountFinalConsonants(c.Name);
        // 쓴 글자와 소리가 갈라지는 이름에 '듣고 따라 부르기 좋다'고 말하면 거짓이다.
        // 결합 경계는 생성 단계(ShiftsAtRootTailJoin)가 걸렀고, 여기 걸리는 건 어근 자체의 소리(넉넉→[넝넉]) 정도다.
        bool shifted = HasSoundShift(c.Name);
        var soundNote = c.Name.Length switch
        {
            2 when finals <= 1 && !shifted => "2음절에 받침이 적어 한 번에 듣고 따라 부르기 좋아요.",
            2 => "2음절이라 짧게 붙지만 받침이 있어 소리가 다소 묵직해요.",
            3 when finals <= 1 && !shifted => "3음절이면서 받침이 적어 리듬이 살아 있어요.",
            3 => "3음절 구성이라 간판과 도메인에 무리 없이 들어가요.",
            _ => "4음절이라 정식 상호로 쓰되 줄여 부르는 별칭을 함께 생각해두면 좋아요.",
        };
        c.Reasons.Add(soundNote);

        var axisLabelA = CompanyNamingData.Axes[axisA].Label;
        var axisLabelB = CompanyNamingData.Axes[axisB].Label;
        // "업종의"(소유격)라고 쓰면 안 된다 — 축은 톤이 주입했거나 한자쌍 파트너로
        // 편승한 것일 수 있어, 그 결이 업종의 것이라는 단언이 된다(실측: IT/classic의
        // 구봉이 "IT 업종의 '오램'·'터' 결"을 주장 — 둘 다 IT 축이 아님).
        // 이름이 그 결을 담았다는 것만 말한다. 처소격 "업종에서"는 선택 맥락이라 참.
        if (keywordRoot != null)
            c.Reasons.Add($"'{axisLabelB}' 결로 마무리해 {profile.Label} 업종에 어울리게 골랐어요.");
        else
            c.Reasons.Add(axisA == axisB
                ? $"{profile.Label} 업종에서 '{axisLabelA}' 결을 곧게 밀고 나가는 이름이에요."
                : $"'{axisLabelA}'{KoreanUtils.GwaWa(axisLabelA)} '{axisLabelB}' 결을 함께 담은 이름이에요.");

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
        // 의원·법률사무소처럼 주식회사로 열 수 없는 업종은 법인 예시 대신 업종 접미를 하나 더 쓴다
        var corporate = profile.CorporateForm;
        foreach (var suffix in profile.Suffixes.Take(corporate != null ? 2 : 3))
            c.UsageExamples.Add($"{c.Name} {suffix}");
        if (corporate != null)
            c.UsageExamples.Add($"{corporate} {c.Name}");
    }

    // ============================================================
    // 필터
    // ============================================================

    /// <summary>상호로 내보낼 수 있는 표기인지 — 한글 음절만, 금칙어 없음, 차단 표기 아님</summary>
    private static bool IsUsableName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        if (!name.All(IsHangulSyllable)) return false;
        if (ForbiddenWordData.ContainsForbiddenWord(name)) return false;
        if (CompanyNamingData.BlockedNames.Contains(name)) return false;
        return true;
    }

    private static bool IsHangulSyllable(char ch) => ch >= 0xAC00 && ch <= 0xD7A3;

    /// <summary>CJK 통합 한자 (기본·확장 A·호환) — 키워드 독음 변환 대상 판정용</summary>
    private static bool IsHanChar(char ch) =>
        ch is >= '\u4E00' and <= '\u9FFF' or >= '\u3400' and <= '\u4DBF' or >= '\uF900' and <= '\uFAFF'; // 이스케이프 필수 — 호환 豈(U+F900) 글자는 NFC 정규화로 U+8C48이 된다

    // ============================================================
    // 검수용 전수 목록
    // ============================================================

    /// <summary>
    /// 업종·톤·키워드와 무관하게 세 생성기가 낼 수 있는 표기 전부 (필터 통과분, 결·표기 중복 제거).
    /// 점수·서사는 붙이지 않는다. 데이터 계약(결합 경계 소리 변화·차단 표기)을 테스트가 전수로
    /// 기계 검사하고, 사람이 차단 목록(BlockedNames)을 채울 덤프를 뽑는 용도다 — 추천 경로에서는 쓰지 않는다.
    /// </summary>
    public static IReadOnlyList<CompanyNameCandidate> EnumerateAllCandidates()
    {
        var axisKeys = CompanyNamingData.Axes.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();
        var raw = new List<CompanyNameCandidate>();
        var meta = new Dictionary<CompanyNameCandidate, (string, string)>();

        GenerateHanja(axisKeys, raw, meta);
        GenerateKorean(axisKeys, new List<string>(), raw, meta, new Dictionary<CompanyNameCandidate, string>());
        GenerateEnglish(axisKeys, raw, meta);

        var seen = new HashSet<string>(StringComparer.Ordinal);
        return raw
            .Where(c => IsUsableName(c.Name) && seen.Add(c.Style + ":" + c.Name))
            .ToList();
    }
}
