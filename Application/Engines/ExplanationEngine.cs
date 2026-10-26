using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines;

/// <summary>
/// 이름 리포트 설명 생성 엔진.
///
/// AI 대화형 작명의 "서사적 설명"과 반대로, 측정 가능한 수치와 근거만 제시한다.
/// 모든 출력은 [점수/지표] — [근거] 형식을 따른다.
/// </summary>
public class ExplanationEngine : IExplanationEngine
{
    // ═══════════════════════════════════════════════════════════════
    // 공개 메서드 (인터페이스 호환)
    // ═══════════════════════════════════════════════════════════════

    public async Task<List<string>> GenerateReasonsAsync(
        string name, int aestheticScore, int harmonyScore,
        IReadOnlyList<HanjaInfo?>? selectedHanja = null)
    {
        var reasons = new List<string>();

        // harmonyScore는 이 종합 줄에만 쓰인다 — 조화 미산정 경로는 AlignOverallReason으로 이 줄을 다시 쓴다.
        reasons.Add(OverallReason(BlendOverall(aestheticScore, harmonyScore), aestheticScore, harmonyScore));

        var pronEvidence = BuildPronunciationEvidence(name, null);
        if (!string.IsNullOrEmpty(pronEvidence))
            reasons.Add($"발음 {aestheticScore}점 — {pronEvidence}");

        // 음령오행 (상생/상극/동일)
        var ohaeng = BuildOhaengEvidence(name);
        if (!string.IsNullOrEmpty(ohaeng))
            reasons.Add(ohaeng);

        // 한자 뜻 — 점수(Harmony)가 실제로 배정한 한자로 표시(일관). 없으면 정제 폴백.
        // 폴백 글자는 음절별 1순위 후보일 뿐 이 이름의 한자가 아니다 — 하나라도 섞이면 '한자 예'로 적어
        // 단정하지 않는다(옛 /analysis·쌍둥이는 배정 한자를 넘기지 않아 '하늘 → 荷+乻'이 '한자 뜻'으로 나갔다 — 2026-10-26 결정 ③부터
        // 쌍둥이와 출생일 있는 /analysis 는 점수가 쓴 배정 한자를 넘긴다. 출생일 없는 /analysis 만 '한자 예').
        var resolved = ResolveMeaningHanja(name, selectedHanja);
        var meaning = FormatMeaningEvidence(resolved.Reps);
        if (!string.IsNullOrEmpty(meaning))
            reasons.Add(resolved.UsedFallback ? $"한자 예 — {meaning}" : $"한자 뜻 — {meaning}");

        return await Task.FromResult(reasons.Take(5).ToList());
    }

    public async Task<ExplanationResult> GenerateDetailedReasonsAsync(
        string name, string? lastName,
        int aestheticScore, int harmonyScore, int rarityScore,
        string gender, string tone)
        => await GenerateDetailedReasonsAsync(name, lastName, aestheticScore, harmonyScore, rarityScore, gender, tone, null);

    public async Task<ExplanationResult> GenerateDetailedReasonsAsync(
        string name, string? lastName,
        int aestheticScore, int harmonyScore, int rarityScore,
        string gender, string tone,
        GenerationFitResult? generationFit,
        IReadOnlyList<HanjaInfo?>? selectedHanja = null)
    {
        int overall = BlendOverall(aestheticScore, harmonyScore);
        var toneLabel = NormalizeTone(tone);

        var result = new ExplanationResult
        {
            Summary = BuildSummary(overall, aestheticScore, harmonyScore, toneLabel),
            // 강점의 한자 뜻도 MeaningNote와 같은 배정 한자로 — 한 화면에서 書+蓮 / 瑞+硏처럼 갈리던 것(EV-3).
            Strengths = BuildStrengths(name, lastName, aestheticScore, harmonyScore, rarityScore, generationFit, selectedHanja, overall),
            Cautions = BuildCautions(name, lastName, aestheticScore, rarityScore, generationFit),
            PronunciationNote = BuildPronunciationNote(name, lastName, aestheticScore),
            // 한자 뜻 — 점수(Harmony)가 실제 배정한 한자로 표시(추천 카드와 일관). 없으면 정제 폴백.
            MeaningNote = BuildMeaningEvidence(name, selectedHanja),
            ToneReason = BuildToneReason(name, toneLabel)
        };

        // 표시할 한자가 한 글자도 없을 때 — 사전 독음은 있는데 글자가 모두 불용(괵·몰·훙 등 — 2026-10-26 불용 10차)이면 '순우리말'이 아니다
        if (string.IsNullOrEmpty(result.MeaningNote))
            result.MeaningNote = name.Any(c => HanjaData.FindByReading(c.ToString()).Any())
                ? NoUsableHanjaMeaningNote
                : "한자 매칭 없음 — 순우리말 또는 미등록 발음";

        return await Task.FromResult(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // Summary — 점수 한 줄 진단
    // ═══════════════════════════════════════════════════════════════

    /// <summary>의미 메모 — 이름의 어느 음절에도 쓸 만한 한자가 없고, 그중 사전 독음이 있는 음절이 있을 때(글자가 모두 불용)</summary>
    public const string NoUsableHanjaMeaningNote = "이름에 쓸 만한 인명용 한자 없음 — 한글로 두기를 권해요";

    /// <summary>'기본기 갖춤' 강점 줄의 꼬리 — <see cref="AlignOverall"/>가 이 줄의 종합 점수를 다시 쓴다.</summary>
    private const string BasicsTail = "점 — 기본기 갖춤";

    /// <summary>
    /// 미학·조화 가중 종합 — ScoringService.EvaluateAsync(출생일 있음)와 같은 식(Math.Round, 0~100).
    /// 버림((int) 캐스트)을 섞으면 FinalScore 75인데 강점은 '종합 74점'이 됐다.
    /// </summary>
    private static int BlendOverall(int aesthetic, int harmony)
        => Math.Clamp((int)Math.Round(aesthetic * 0.7 + harmony * 0.3), 0, 100);

    private static string BuildSummary(int overall, int aesthetic, int harmony, string tone, bool harmonyProvided = true)
    {
        var toneNote = tone switch
        {
            "soft"   => " · 부드러운 톤",
            "strong" => " · 강한 톤",
            _        => ""
        };
        // 출생일이 없으면 조화는 0점이 아니라 '산정하지 않음' — "조화 0"은 낮은 점수로 읽힌다.
        return harmonyProvided
            ? $"종합 {overall}점 — 미학 {aesthetic} · 조화 {harmony}{toneNote}"
            : $"종합 {overall}점 — 미학 {aesthetic} (조화 미산정){toneNote}";
    }

    /// <summary>추천 이유 첫 줄 — 조화를 산정하지 않았으면(null) 수치 대신 '(조화 미산정)'.</summary>
    public static string OverallReason(int finalScore, int aestheticScore, int? harmonyScore)
        => harmonyScore is int harmony
            ? $"종합 {finalScore}점 — 미학 {aestheticScore} · 조화 {harmony}"
            : $"종합 {finalScore}점 — 미학 {aestheticScore} (조화 미산정)";

    /// <summary>
    /// <see cref="GenerateReasonsAsync"/> 결과의 종합 줄을 FinalScore로 맞춘다 — /name-analysis용(AlignOverall과 같은 후처리).
    /// 분석 경로는 출생일이 없으면 조화를 산정하지 않는데, 전엔 호출부가 50으로 메워 히어로 '종합 75'(=미학) 옆에
    /// '종합 68점 — 미학 75 · 조화 50'이 떴다(2026-10 BT-4). 점수는 바꾸지 않는다(표시만).
    /// </summary>
    public static void AlignOverallReason(List<string> reasons, int finalScore, int aestheticScore, int? harmonyScore)
    {
        if (reasons.Count > 0 && reasons[0].StartsWith("종합 "))
            reasons[0] = OverallReason(finalScore, aestheticScore, harmonyScore);
    }

    /// <summary>
    /// 종합 점수 줄(Summary·'기본기 갖춤' 강점)을 ScoringService의 FinalScore로 맞춘다 — /evaluate 전용.
    /// 위 생성 경로는 출생일 유무를 몰라 미학·조화를 늘 0.7/0.3으로 섞는데, 출생일이 없으면 FinalScore는
    /// 미학 100%다. 그대로 두면 "종합 48점 — 미학 68 · 조화 0" 알약과 "종합 68" 타일이 한 화면에 함께 떴다.
    /// 출생일이 없으면 조화를 '미산정'으로 적는다. 점수 자체는 바꾸지 않는다(표시만).
    /// </summary>
    public static void AlignOverall(
        ExplanationResult result, int finalScore, int aestheticScore, int harmonyScore,
        bool harmonyProvided, string tone)
    {
        result.Summary = BuildSummary(finalScore, aestheticScore, harmonyScore, NormalizeTone(tone), harmonyProvided);
        for (int i = 0; i < result.Strengths.Count; i++)
        {
            if (result.Strengths[i].StartsWith("종합 ") && result.Strengths[i].EndsWith(BasicsTail))
                result.Strengths[i] = $"종합 {finalScore}{BasicsTail}";
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Strengths — 측정 가능한 근거만
    // ═══════════════════════════════════════════════════════════════

    private static List<string> BuildStrengths(
        string name, string? lastName,
        int aestheticScore, int harmonyScore, int rarityScore,
        GenerationFitResult? generationFit,
        IReadOnlyList<HanjaInfo?>? selectedHanja, int overall)
    {
        var strengths = new List<string>();

        // 발음 점수
        if (aestheticScore >= 80)
        {
            var pronEvidence = BuildPronunciationEvidence(name, lastName);
            strengths.Add(!string.IsNullOrEmpty(pronEvidence)
                ? $"발음 {aestheticScore}점 — {pronEvidence}"
                : $"발음 {aestheticScore}점 — 상위 구간");
        }

        // 음령오행 상생
        var ohaeng = BuildOhaengEvidence(name);
        if (!string.IsNullOrEmpty(ohaeng) && (ohaeng.Contains("상생") || ohaeng.Contains("동일")))
            strengths.Add(ohaeng);

        // 성씨 연음
        if (!string.IsNullOrEmpty(lastName) && name.Length > 0)
        {
            var flow = NamingPrinciples.EvalSurnameFlow(lastName, name);
            if (flow >= 0.85)
            {
                int flowPts = (int)Math.Round(flow * 25);
                var (init, _, _) = KoreanUtils.Decompose(name[0]);
                var (_, _, lastFinal) = KoreanUtils.Decompose(lastName[^1]);
                var detail = string.IsNullOrEmpty(lastFinal)
                    ? "성씨 받침 없음 → 자연 연결"
                    : $"성씨 받침 + 이름 초성 '{init}' → 부드러운 연결";
                strengths.Add($"성씨 연음 {flowPts}/25 — {detail}");
            }
        }

        // 한자 의미 (자연/덕목 등) — MeaningNote와 같은 배정 한자 (없으면 같은 정제 폴백).
        // '강점'으로 올리는 건 모든 음절 한자가 인명 빈출(CommonNameHanja)이고 약한 글자(weak)가 아닐 때만 —
        // 배정이 菻(쑥 림)·雌(암컷 자)처럼 이름 뜻으로 약한 글자를 고르면 그 줄은 MeaningNote에만 남긴다(BT-6).
        // 긍정 조건이라 weak 세트에 아직 없는 글자(雌)도 막는다. 점수·MeaningNote는 그대로(표시만).
        var resolved = ResolveMeaningHanja(name, selectedHanja);
        var meaning = FormatMeaningEvidence(resolved.Reps);
        bool strongMeaning = resolved.Reps.Count == name.Length
            && resolved.Reps.All(r => HanjaData.IsCommonNameHanja(r.Hanja.Character) && !HanjaData.IsWeakGivenNameHanja(r.Hanja.Character));
        if (strongMeaning && meaning.Contains("+"))
            strengths.Add(meaning);

        // 세대 중립
        if (generationFit?.FitLevel == "timeless")
            strengths.Add("세대 중립 — 모든 연대에서 자연스러움");

        // 희귀도
        if (rarityScore >= 70)
            strengths.Add($"독창성 {rarityScore}점 — 흔치 않은 조합");
        else if (rarityScore >= 50)
            strengths.Add($"독창성 {rarityScore}점 — 적정 희소성");

        // 받침 패턴 (2글자 한정)
        if (name.Length == 2)
        {
            bool b1 = KoreanUtils.HasFinalConsonant(name[0]);
            bool b2 = KoreanUtils.HasFinalConsonant(name[1]);
            if ((b1, b2) == (false, true))
                strengths.Add("리듬 — 받침 패턴 무+유 (최적)");
            else if ((b1, b2) == (true, false))
                strengths.Add("리듬 — 받침 패턴 유+무 (안정)");
        }

        // 최소 2개 보장 (점수만 표시)
        if (strengths.Count < 2)
        {
            if (harmonyScore >= 70 && !strengths.Any(s => s.Contains("조화")))
                strengths.Add($"조화 {harmonyScore}점 — 사주·오행 균형");
            if (strengths.Count < 2)
                strengths.Add($"종합 {overall}{BasicsTail}");
        }

        return strengths.Take(4).ToList();
    }

    // ═══════════════════════════════════════════════════════════════
    // Cautions — 데이터 기반 경고
    // ═══════════════════════════════════════════════════════════════

    private static List<string> BuildCautions(
        string name, string? lastName, int aestheticScore, int rarityScore,
        GenerationFitResult? generationFit)
    {
        var cautions = new List<string>();

        // 성씨+이름 부정 연상
        if (!string.IsNullOrEmpty(lastName))
        {
            var fullName = lastName + name;
            var negPatterns = MorphemeAnalyzer.DetectNegativePatterns(fullName);
            foreach (var pattern in negPatterns)
            {
                if (pattern.StartsWith("성명조합_부정연상:"))
                {
                    var word = pattern.Replace("성명조합_부정연상:", "");
                    cautions.Add($"부정 연상 — 성씨+이름 → '{word}'");
                }
            }
        }

        // 세대 감각 (출생 세대와 또래 감각 차이)
        if (generationFit?.FitLevel == "strong_mismatch")
            cautions.Add($"세대 감각 — {generationFit.Description}");
        else if (generationFit?.FitLevel == "mild_mismatch")
            cautions.Add($"세대 감각 — {generationFit.Description}");

        // 흔한 이름
        if (rarityScore < 20)
            cautions.Add($"독창성 {rarityScore}점 — 2020년대 인기 이름");
        else if (rarityScore < 30)
            cautions.Add($"독창성 {rarityScore}점 — 사용 빈도 높음");

        // 발음 약함
        if (aestheticScore < 60)
            cautions.Add($"발음 {aestheticScore}점 — 조합 어색 가능, 실제 발음 권장");

        // 음령오행 상극
        var ohaeng = BuildOhaengEvidence(name);
        if (!string.IsNullOrEmpty(ohaeng) && ohaeng.Contains("상극"))
            cautions.Add(ohaeng);

        // 된소리
        var doubledInitials = new HashSet<string> { "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ" };
        int doubledCount = name.Count(c =>
        {
            var (init, _, _) = KoreanUtils.Decompose(c);
            return doubledInitials.Contains(init);
        });
        if (doubledCount > 0)
            cautions.Add($"된소리 {doubledCount}개 — 부드러운 인상과 거리");

        // 강한 파열음 연속
        if (KoreanUtils.HasConsecutiveStrongPlosives(name))
            cautions.Add("파열음 연속 — 발음 거침");

        // 동일 자음 반복
        if (KoreanUtils.HasSameConsonantRepetition(name))
            cautions.Add("동일 자음 반복 — 발음 단조");

        // 4음절 이상
        if (name.Length >= 4)
            cautions.Add($"음절 {name.Length}개 — 줄여 부를 가능성");

        return cautions.Take(2).ToList();
    }

    // ═══════════════════════════════════════════════════════════════
    // PronunciationNote — 발음 측정 지표
    // ═══════════════════════════════════════════════════════════════

    private static string BuildPronunciationNote(string name, string? lastName, int aestheticScore)
    {
        var evidence = BuildPronunciationEvidence(name, lastName);
        return string.IsNullOrEmpty(evidence)
            ? $"발음 {aestheticScore}점"
            : $"발음 {aestheticScore}점 / {evidence}";
    }

    /// <summary>받침 수·자음 성격·성씨 연결을 측정값으로 반환.</summary>
    private static string BuildPronunciationEvidence(string name, string? lastName)
    {
        if (string.IsNullOrEmpty(name)) return string.Empty;

        var parts = new List<string>();

        // 받침 수
        int finalCount = KoreanUtils.CountFinalConsonants(name);
        parts.Add($"받침 {finalCount}개");

        // 자음 성격 비율
        var doubledInitials = new HashSet<string> { "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ" };
        var aspiratedInitials = new HashSet<string> { "ㅊ", "ㅋ", "ㅌ", "ㅍ" };
        int hard = 0;
        foreach (char c in name)
        {
            var (init, _, _) = KoreanUtils.Decompose(c);
            if (doubledInitials.Contains(init) || aspiratedInitials.Contains(init)) hard++;
        }
        if (hard == 0) parts.Add("부드러운 자음 100%");
        else parts.Add($"강한 자음 {hard}/{name.Length}");

        // 성씨 연결
        if (!string.IsNullOrEmpty(lastName))
        {
            double flow = NamingPrinciples.EvalSurnameFlow(lastName, name);
            if (flow >= 0.85) parts.Add("성씨 연결 자연");
            else if (flow < 0.55) parts.Add("성씨 연결 딱딱");
        }

        return string.Join(" / ", parts);
    }

    // ═══════════════════════════════════════════════════════════════
    // MeaningEvidence — 한자 정보 + 카테고리 조합
    // ═══════════════════════════════════════════════════════════════

    private static string BuildMeaningEvidence(string name, IReadOnlyList<HanjaInfo?>? preselected = null)
        => FormatMeaningEvidence(ResolveMeaningHanja(name, preselected).Reps);

    /// <summary>
    /// 음절별 표시 한자 — 점수(HarmonyEngine)가 배정한 한자가 있으면 그것, 없으면 폴백(음절별 표시 후보 1순위).
    /// 각 항목은 그 한자가 놓인 이름 음절과 함께 돌려준다 — 훈·괄호 독음을 그 음절로 고르기 위해서다
    /// (한자 없는 음절이 빠져 인덱스로는 맞출 수 없다).
    /// UsedFallback: 표시 한자 중 하나라도 폴백이면 true — 그 줄은 이 이름의 한자가 아니라 '예'다.
    /// 한자가 없는 음절은 Reps에서 빠진다(Reps.Count &lt; name.Length).
    /// </summary>
    private static (List<(HanjaInfo Hanja, string Syllable)> Reps, bool UsedFallback) ResolveMeaningHanja(
        string name, IReadOnlyList<HanjaInfo?>? preselected)
    {
        var reps = new List<(HanjaInfo Hanja, string Syllable)>();
        bool usedFallback = false;
        if (string.IsNullOrEmpty(name)) return (reps, usedFallback);

        for (int i = 0; i < name.Length; i++)
        {
            var syllable = name[i].ToString();

            // 점수(HarmonyEngine)가 실제로 배정한 한자가 있으면 그걸로 표시 — 점수=표시 일관.
            if (preselected != null && i < preselected.Count
                && preselected[i] is { } pre && !string.IsNullOrEmpty(pre.Meaning))
            {
                reps.Add((pre, syllable));
                continue;
            }

            // 폴백: 표시 후보 정렬(HanjaSelector.OrderForDisplay — 불용·뜻 없는 글자 제외, 빈출·비약자 우선)의 1순위.
            // /name-analysis 후보 카드(AnalyzeHanja — 출생일 없는 경로)와 같은 정렬이라 '한자 예' 줄이 큰 카드와 같은 글자를 든다(2026-10-26 B8 — API-3).
            var rep = HanjaSelector.OrderForDisplay(HanjaData.FindByReading(syllable)).FirstOrDefault();
            if (rep != null)
            {
                reps.Add((rep, syllable));
                usedFallback = true;
            }
        }

        return (reps, usedFallback);
    }

    private static string FormatMeaningEvidence(List<(HanjaInfo Hanja, string Syllable)> reps)
    {
        if (reps.Count == 0) return string.Empty;

        var hanjaParts = new List<string>();
        var categories = new List<string>();
        foreach (var (rep, syllable) in reps)
        {
            // 괄호 안 독음·훈은 이름 음절 기준 — 대표 독음(rep.Reading)·첫 훈으로 쓰면 지훈의 煇가 '煇(훈, 빛날 휘)'로 나갔다
            // (2026-10-26 B7 — API-2). 훈 선택은 /name 카드·dump-combo-glosses 와 같은 HanjaData.GlossForReading.
            hanjaParts.Add($"{rep.Character}({syllable}, {HanjaData.GlossForReading(rep.Meaning, syllable)})");
            if (!string.IsNullOrEmpty(rep.Category)) categories.Add(rep.Category);
        }

        var hanjaText = string.Join(" + ", hanjaParts);

        // 카테고리 조합 명시
        if (categories.Count >= 2 && categories.Distinct().Count() >= 2)
        {
            var cats = string.Join(" + ", categories.Distinct());
            return $"{hanjaText} — {cats} 카테고리 조합";
        }

        return hanjaText;
    }

    // ═══════════════════════════════════════════════════════════════
    // OhaengEvidence — 음령오행 상생/상극
    // ═══════════════════════════════════════════════════════════════

    private static readonly Dictionary<string, string> ShengNext = new()
    {
        ["木"] = "火", ["火"] = "土", ["土"] = "金", ["金"] = "水", ["水"] = "木"
    };

    private static string BuildOhaengEvidence(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length < 2) return string.Empty;

        var e1 = KoreanUtils.GetEumryeongFiveElement(name[0]);
        var e2 = KoreanUtils.GetEumryeongFiveElement(name[1]);
        if (string.IsNullOrEmpty(e1) || string.IsNullOrEmpty(e2)) return string.Empty;

        var (i1, _, _) = KoreanUtils.Decompose(name[0]);
        var (i2, _, _) = KoreanUtils.Decompose(name[1]);

        if (ShengNext.TryGetValue(e1, out var next) && next == e2)
            return $"음령오행 상생 — {e1}({i1}) → {e2}({i2}) 정방향";
        if (ShengNext.TryGetValue(e2, out var prev) && prev == e1)
            return $"음령오행 상생 — {e2}({i2}) → {e1}({i1}) 역방향";
        if (e1 == e2)
            return $"음령오행 동일 — {e1}({i1}/{i2}) 안정";

        var ke = new Dictionary<string, string>
            { ["木"] = "土", ["土"] = "水", ["水"] = "火", ["火"] = "金", ["金"] = "木" };
        if (ke.TryGetValue(e1, out var t1) && t1 == e2)
            return $"음령오행 상극 — {e1}({i1}) ✕ {e2}({i2})";
        if (ke.TryGetValue(e2, out var t2) && t2 == e1)
            return $"음령오행 상극 — {e2}({i2}) ✕ {e1}({i1})";

        return string.Empty;
    }

    // ═══════════════════════════════════════════════════════════════
    // ToneReason — 톤 적합도 측정
    // ═══════════════════════════════════════════════════════════════

    private static string BuildToneReason(string name, string tone)
    {
        if (string.IsNullOrEmpty(name)) return string.Empty;

        int finalCount = KoreanUtils.CountFinalConsonants(name);
        var doubled = new HashSet<string> { "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ" };
        int doubledCount = name.Count(c =>
        {
            var (init, _, _) = KoreanUtils.Decompose(c);
            return doubled.Contains(init);
        });

        return tone switch
        {
            "soft" => doubledCount == 0
                ? $"Soft 톤 적합 — 받침 {finalCount}개, 된소리 없음"
                : $"Soft 톤 부적합 — 된소리 {doubledCount}개",
            "strong" => doubledCount > 0 || finalCount >= name.Length
                ? $"Strong 톤 적합 — 받침 {finalCount}/{name.Length}, 된소리 {doubledCount}개"
                : $"Strong 톤 보통 — 받침 {finalCount}/{name.Length}",
            _ => $"Neutral 톤 — 받침 {finalCount}/{name.Length}, 된소리 {doubledCount}개"
        };
    }

    private static string NormalizeTone(string? tone)
    {
        var t = (tone ?? "").ToLower();
        return t == "soft" || t == "strong" ? t : "neutral";
    }
}
