using NameForm.Application.Engines.Data;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines;

/// <summary>
/// 추천 이유 생성 엔진
/// 기본 3줄 설명 + 구조화된 상세 설명 제공
/// </summary>
public interface IExplanationEngine
{
    /// <summary>
    /// 기본 추천 이유 3줄 생성 (하위 호환)
    /// </summary>
    Task<List<string>> GenerateReasonsAsync(
        string name,
        int aestheticScore,
        int harmonyScore,
        IReadOnlyList<HanjaInfo?>? selectedHanja = null);

    /// <summary>
    /// 구조화된 상세 추천 이유 생성
    /// </summary>
    Task<ExplanationResult> GenerateDetailedReasonsAsync(
        string name,
        string? lastName,
        int aestheticScore,
        int harmonyScore,
        int rarityScore,
        string gender,
        string tone);

    /// <summary>
    /// 구조화된 상세 추천 이유 생성 (세대 적합도 포함)
    /// </summary>
    /// <param name="selectedHanja">점수(Harmony)가 실제 배정한 한자 — 전달 시 MeaningNote가
    /// 그 한자로 표시되어 추천 카드와 평가 페이지가 일관된다. 미전달 시 정제 폴백.</param>
    /// <param name="hanjaFallback">배정 한자가 없거나 뜻이 빈 음절을 그 음절의 표시 1순위 글자('한자 예')로 메울지. 사용자가 한자를 정한
    /// /evaluate 요청(2026-11 한자 입력)은 false — 고르지 않은 글자가 의미 메모·강점 줄에 나오지 않게 한다. 기본값 true 는 예전 동작.</param>
    Task<ExplanationResult> GenerateDetailedReasonsAsync(
        string name,
        string? lastName,
        int aestheticScore,
        int harmonyScore,
        int rarityScore,
        string gender,
        string tone,
        GenerationFitResult? generationFit,
        IReadOnlyList<HanjaInfo?>? selectedHanja = null,
        bool hanjaFallback = true);
}

/// <summary>
/// 구조화된 추천 이유 결과
/// </summary>
public class ExplanationResult
{
    /// <summary>한줄 요약</summary>
    public string Summary { get; set; } = string.Empty;

    /// <summary>강점 2~4개</summary>
    public List<string> Strengths { get; set; } = new();

    /// <summary>주의점 0~2개</summary>
    public List<string> Cautions { get; set; } = new();

    /// <summary>톤 관련 설명</summary>
    public string ToneReason { get; set; } = string.Empty;

    /// <summary>발음 특징</summary>
    public string PronunciationNote { get; set; } = string.Empty;

    /// <summary>의미 특징</summary>
    public string MeaningNote { get; set; } = string.Empty;
}
