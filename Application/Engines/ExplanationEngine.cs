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
        int overall = (int)Math.Round(aestheticScore * 0.7 + harmonyScore * 0.3);

        reasons.Add($"종합 {overall}점 — 미학 {aestheticScore} · 조화 {harmonyScore}");

        var pronEvidence = BuildPronunciationEvidence(name, null);
        if (!string.IsNullOrEmpty(pronEvidence))
            reasons.Add($"발음 {aestheticScore}점 — {pronEvidence}");

        // 음령오행 (상생/상극/동일)
        var ohaeng = BuildOhaengEvidence(name);
        if (!string.IsNullOrEmpty(ohaeng))
            reasons.Add(ohaeng);

        // 한자 뜻 — 점수(Harmony)가 실제로 배정한 한자로 표시(일관). 없으면 정제 폴백.
        var meaning = BuildMeaningEvidence(name, selectedHanja);
        if (!string.IsNullOrEmpty(meaning))
            reasons.Add($"한자 뜻 — {meaning}");

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
        int overall = (int)Math.Round(aestheticScore * 0.7 + harmonyScore * 0.3);
        var toneLabel = NormalizeTone(tone);

        var result = new ExplanationResult
        {
            Summary = BuildSummary(overall, aestheticScore, harmonyScore, toneLabel),
            Strengths = BuildStrengths(name, lastName, aestheticScore, harmonyScore, rarityScore, generationFit),
            Cautions = BuildCautions(name, lastName, aestheticScore, rarityScore, generationFit),
            PronunciationNote = BuildPronunciationNote(name, lastName, aestheticScore),
            // 한자 뜻 — 점수(Harmony)가 실제 배정한 한자로 표시(추천 카드와 일관). 없으면 정제 폴백.
            MeaningNote = BuildMeaningEvidence(name, selectedHanja),
            ToneReason = BuildToneReason(name, toneLabel)
        };

        if (string.IsNullOrEmpty(result.MeaningNote))
            result.MeaningNote = "한자 매칭 없음 — 순우리말 또는 미등록 발음";

        return await Task.FromResult(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // Summary — 점수 한 줄 진단
    // ═══════════════════════════════════════════════════════════════

    private static string BuildSummary(int overall, int aesthetic, int harmony, string tone)
    {
        var toneNote = tone switch
        {
            "soft"   => " · 부드러운 톤",
            "strong" => " · 강한 톤",
            _        => ""
        };
        return $"종합 {overall}점 — 미학 {aesthetic} · 조화 {harmony}{toneNote}";
    }

    // ═══════════════════════════════════════════════════════════════
    // Strengths — 측정 가능한 근거만
    // ═══════════════════════════════════════════════════════════════

    private static List<string> BuildStrengths(
        string name, string? lastName,
        int aestheticScore, int harmonyScore, int rarityScore,
        GenerationFitResult? generationFit)
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

        // 한자 의미 (자연/덕목 등)
        var meaning = BuildMeaningEvidence(name);
        if (!string.IsNullOrEmpty(meaning) && meaning.Contains("+"))
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
                strengths.Add($"종합 {(int)(aestheticScore * 0.7 + harmonyScore * 0.3)}점 — 기본기 갖춤");
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

    /// <summary>한자 Meaning의 다중 훈음('준걸 준, 순임금 순', '임금 주/주인 주') 중 첫 훈음만. (창의 2-a와 동일)</summary>
    private static string CleanGloss(string meaning)
    {
        if (string.IsNullOrWhiteSpace(meaning)) return "";
        return meaning.Split(',', '/', ';', '·')[0].Trim();
    }

    private static string BuildMeaningEvidence(string name, IReadOnlyList<HanjaInfo?>? preselected = null)
    {
        if (string.IsNullOrEmpty(name)) return string.Empty;

        var hanjaParts = new List<string>();
        var categories = new List<string>();

        for (int i = 0; i < name.Length; i++)
        {
            HanjaInfo? rep;
            // 점수(HarmonyEngine)가 실제로 배정한 한자가 있으면 그걸로 표시 — 점수=표시 일관.
            if (preselected != null && i < preselected.Count
                && preselected[i] is { } pre && !string.IsNullOrEmpty(pre.Meaning))
            {
                rep = pre;
            }
            else
            {
                // 폴백: 창의 2-a와 동일 정제(불용한자 배제 + 인명 빈출 우선).
                var cands = HanjaData.FindByReading(name[i].ToString())
                    .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning))
                    .ToList();
                var common = cands.Where(h => HanjaData.IsCommonNameHanja(h.Character)).ToList();
                rep = (common.Count > 0 ? common : cands).FirstOrDefault();
            }
            if (rep != null)
            {
                hanjaParts.Add($"{rep.Character}({rep.Reading}, {CleanGloss(rep.Meaning)})");
                if (!string.IsNullOrEmpty(rep.Category)) categories.Add(rep.Category);
            }
        }

        if (hanjaParts.Count == 0) return string.Empty;

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
