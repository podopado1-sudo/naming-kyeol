using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 가족의 서사 추출 유틸리티 — 부모 기반 작명의 '부모 이름 뜻 잇기'(의미 융합)와 '부모 공통 글자 잇기'(세대 연결) 재료.
/// 2026-10-28 개편: 음운 유전 서사는 조합 함수가 빈 껍데기라 한 건도 내지 않아 지웠다. 의미 융합은 음절마다 한자 한 자만 정하고
/// (HanjaSelector.Select — 보이는 한자와 같은 선택기) 이을 때는 한자의 대표 독음이 아니라 부모 이름 음절을 쓴다(옛 코드는 h.Reading 이라
/// 연→련·김→금·예→례 같은 본음 음절이 이름에 들어갔다). 세대 연결은 사전 앞 10자·'현대/전통적' 시대 문구 대신
/// 부모 공통 글자 + 실명 짝 글자(RealNamePartners)다.
/// </summary>
public static class FamilyNarrativeExtractor
{
    /// <summary>
    /// 의미 융합 서사 — 부모 이름 음절마다 한자 한 자(HanjaSelector.Select, 요청 성별·용신)를 정하고 그 독음의 훈(GlossForReading)만 쓴다.
    /// 부모 엔진은 요청 출생일·시각의 용신(1순위 용신·희신·기신)을 넘겨 /evaluate 배정(ScoringService.AssignedHanja)과 같은 글자를 고른다
    /// (Select 는 음절마다 따로 고르므로 이름 '민서'의 배정 = '민'·'서' 각각의 배정). 용신이 없으면(null) 출생일 없는 선택과 같다.
    /// 추천 조합(<see cref="FamilyNarrative.Combinations"/>)은 아버지 음절 하나 + 어머니 음절 하나(양쪽 순서)로, 두 글자의 카테고리가
    /// 어울릴 때만(같은 카테고리, 또는 자연 + 덕목). 같은 음절을 두 번 쓴 조합(민민)은 뺀다.
    /// </summary>
    public static FamilyNarrative ExtractMeaningFusionNarrative(
        string? fatherName,
        string? motherName,
        string gender = "none",
        string? yongshinPrimary = null,
        string? yongshinHee = null,
        string? yongshinGi = null)
    {
        var narrative = new FamilyNarrative
        {
            Type = "의미융합",
            CoreValues = new List<string>(),
            SuggestedThemes = new List<string>(),
            NarrativeDescription = string.Empty
        };

        if (string.IsNullOrEmpty(fatherName) && string.IsNullOrEmpty(motherName))
        {
            return narrative;
        }

        var yongshin = (yongshinPrimary, yongshinHee, yongshinGi);
        var fatherPicks = PickPerSyllable(fatherName, gender, fromFather: true, yongshin);
        var motherPicks = PickPerSyllable(motherName, gender, fromFather: false, yongshin);
        var allPicks = fatherPicks.Concat(motherPicks).ToList();

        // 가족의 핵심 가치관 — 훈 문자열 단위로 겹치지 않게(옛 Distinct 는 참조 비교라 같은 뜻이 되풀이됐다)
        var natureThemes = allPicks.Where(m => m.Category == "자연").Select(m => m.Gloss).Distinct().ToList();
        var virtueThemes = allPicks.Where(m => m.Category == "덕목").Select(m => m.Gloss).Distinct().ToList();
        var conceptThemes = allPicks.Where(m => m.Category == "개념").Select(m => m.Gloss).Distinct().ToList();

        narrative.CoreValues.AddRange(virtueThemes.Take(3).Concat(conceptThemes.Take(2)).Distinct());

        if (virtueThemes.Any() && natureThemes.Any())
        {
            narrative.SuggestedThemes.Add($"{virtueThemes.First()}과 {natureThemes.First()}의 조화");
            narrative.NarrativeDescription = $"부모님의 '{virtueThemes.First()}' 정신과 '{natureThemes.First()}'의 아름다움이 조화를 이루는 이름";
        }
        else if (fatherPicks.Any() && motherPicks.Any())
        {
            var fatherTheme = fatherPicks.First().Gloss;
            var motherTheme = motherPicks.First().Gloss;
            narrative.SuggestedThemes.Add($"{fatherTheme}과 {motherTheme}의 결합");
            narrative.NarrativeDescription = $"아버지의 '{fatherTheme}'{KoreanUtils.GwaWa(KoreanUtils.JosaBase(fatherTheme))} 어머니의 '{motherTheme}'{KoreanUtils.IGa(KoreanUtils.JosaBase(motherTheme))} 만나 새로운 의미를 만들어내는 이름";
        }

        narrative.Combinations = GenerateMeaningBasedCombinations(fatherPicks, motherPicks);
        narrative.RecommendedHanja = narrative.Combinations.Select(c => c.Name).ToList();

        return narrative;
    }

    /// <summary>
    /// 세대 연결 서사 — 두 부모 이름에 함께 있는 글자(공통 음절)에 실명 짝 글자(RealNamePartners, 요청 성별·톤)를 앞·뒤로 붙인다.
    /// 공통 글자가 없으면 빈 서사. 시대·세대 추정 문구('현대/현대적/전통적')는 근거가 없어 쓰지 않는다.
    /// <paramref name="accept"/> 는 호출자의 품질 거르기(부모 엔진 공통 거르기), <paramref name="perSyllable"/> 는 공통 글자 하나·자리 하나당 짝 수.
    /// </summary>
    public static FamilyNarrative ExtractGenerationalBridgeNarrative(
        string? fatherName,
        string? motherName,
        string gender = "none",
        string tone = "neutral",
        Func<string, bool>? accept = null,
        int perSyllable = 4,
        Func<string, HanjaData.HanjaInfo?>? visibleHanja = null)
    {
        var narrative = new FamilyNarrative
        {
            Type = "세대연결",
            CoreValues = new List<string>(),
            SuggestedThemes = new List<string>(),
            NarrativeDescription = string.Empty
        };

        var shared = SharedSyllables(fatherName, motherName);
        if (shared.Count == 0)
        {
            return narrative;
        }

        narrative.CoreValues.AddRange(shared);
        var quoted = string.Join("·", shared.Select(s => $"'{s}'"));
        narrative.SuggestedThemes.Add($"부모 공통 글자 {quoted}");
        narrative.NarrativeDescription = $"아버지와 어머니 이름에 함께 있는 {quoted}{KoreanUtils.EulReul(shared[^1])} 잇는 이름";

        foreach (var s in shared)
        {
            var front = RealNamePartners.Find(s, anchorFirst: true, gender, tone, perSyllable, accept, visibleHanja);
            var back = RealNamePartners.Find(s, anchorFirst: false, gender, tone, perSyllable, accept, visibleHanja);
            // 앞·뒤 자리를 번갈아 — 한쪽 자리 이름만 몰리지 않게
            for (int i = 0; i < Math.Max(front.Count, back.Count); i++)
            {
                if (i < front.Count) AddBridge(s, front[i]);
                if (i < back.Count) AddBridge(s, back[i]);
            }
        }
        narrative.RecommendedHanja = narrative.Bridges.Select(b => b.Name).ToList();

        return narrative;

        void AddBridge(string sharedSyllable, RealNamePartners.Partner p)
        {
            if (narrative.Bridges.Any(b => b.Name == p.Name)) return;
            narrative.Bridges.Add(new BridgeCombination(p.Name, sharedSyllable, p.Syllable, p.Hanja.Character, p.Gloss));
        }
    }

    /// <summary>두 부모 이름(성 제외)에 함께 있는 한글 음절 — 아버지 이름 순서, 겹치지 않게.</summary>
    public static List<string> SharedSyllables(string? fatherName, string? motherName)
    {
        if (string.IsNullOrEmpty(fatherName) || string.IsNullOrEmpty(motherName)) return new List<string>();
        return fatherName.Where(IsHangulSyllable).Distinct()
            .Where(c => motherName.Contains(c))
            .Select(c => c.ToString())
            .ToList();
    }

    #region Helper Methods

    private static bool IsHangulSyllable(char c) => c >= 0xAC00 && c <= 0xD7A3;

    /// <summary>
    /// 이름 음절마다 한자 한 자 — HanjaSelector.Select(음절, 성별, 용신)가 고른 글자가 이름에 쓸 수 있는 글자(불용 아님 + 뜻 있음)일 때만.
    /// 사전 글자 전부(옛 UsableByReading 전체)를 보지 않으므로 한 음절의 여러 뜻이 서사에 섞이지 않는다.
    /// </summary>
    private static List<SyllablePick> PickPerSyllable(string? name, string gender, bool fromFather,
        (string? Primary, string? Hee, string? Gi) yongshin)
    {
        var picks = new List<SyllablePick>();
        if (string.IsNullOrEmpty(name)) return picks;

        foreach (var c in name.Where(IsHangulSyllable).Distinct())
        {
            var syllable = c.ToString();
            var h = HanjaSelector.Select(syllable, gender, yongshin.Primary, yongshin.Hee, yongshin.Gi).FirstOrDefault();
            if (h == null || !HanjaSelector.IsUsableNameHanja(h)) continue;
            picks.Add(new SyllablePick(syllable, h.Character, HanjaData.GlossForReading(h.Meaning, syllable), h.Category, fromFather));
        }

        return picks;
    }

    private static List<MeaningCombination> GenerateMeaningBasedCombinations(
        List<SyllablePick> fatherPicks,
        List<SyllablePick> motherPicks)
    {
        var combinations = new List<MeaningCombination>();

        foreach (var f in fatherPicks)
        {
            foreach (var m in motherPicks)
            {
                if (f.Syllable == m.Syllable) continue; // 같은 음절 반복(민민) 금지
                if (!IsHarmoniousMeaning(f.Category, m.Category)) continue;
                Add(new MeaningCombination(f.Syllable + m.Syllable, f, m));
                Add(new MeaningCombination(m.Syllable + f.Syllable, m, f));
            }
        }

        return combinations;

        void Add(MeaningCombination c)
        {
            if (combinations.All(x => x.Name != c.Name)) combinations.Add(c);
        }
    }

    private static bool IsHarmoniousMeaning(string? c1, string? c2)
    {
        if (string.IsNullOrEmpty(c1) || string.IsNullOrEmpty(c2)) return false;

        // 자연 + 자연, 덕목 + 덕목, 개념 + 개념 조합이 조화로움
        if (c1 == c2)
            return true;

        // 자연 + 덕목 조합도 조화로움
        return (c1 == "자연" && c2 == "덕목") || (c1 == "덕목" && c2 == "자연");
    }

    #endregion

    #region Data Classes

    public class FamilyNarrative
    {
        public string Type { get; set; } = string.Empty;
        public List<string> CoreValues { get; set; } = new();
        public List<string> SuggestedThemes { get; set; } = new();
        public string NarrativeDescription { get; set; } = string.Empty;
        /// <summary>추천 이름(2음절) — 의미 융합은 Combinations, 세대 연결은 Bridges 의 이름 순서 그대로</summary>
        public List<string> RecommendedHanja { get; set; } = new();
        /// <summary>의미 융합 조합 — 음절마다 고른 한자·훈</summary>
        public List<MeaningCombination> Combinations { get; set; } = new();
        /// <summary>세대 연결 조합 — 공통 글자 + 실명 짝 글자</summary>
        public List<BridgeCombination> Bridges { get; set; } = new();
    }

    /// <summary>부모 이름 음절 하나와 그 음절에 정한 한자 한 자(훈은 그 독음의 것).</summary>
    public sealed record SyllablePick(string Syllable, string Character, string Gloss, string? Category, bool FromFather);

    /// <summary>의미 융합 이름 하나 — First 가 이름 첫 음절.</summary>
    public sealed record MeaningCombination(string Name, SyllablePick First, SyllablePick Second);

    /// <summary>세대 연결 이름 하나 — 공통 글자와 실명 짝 글자(보이는 한자·훈).</summary>
    public sealed record BridgeCombination(string Name, string Shared, string Partner, string PartnerHanja, string PartnerGloss);

    #endregion
}
