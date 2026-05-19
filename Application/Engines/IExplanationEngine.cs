using NameForm.Application.Engines.Data;

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
        int harmonyScore);

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
    Task<ExplanationResult> GenerateDetailedReasonsAsync(
        string name,
        string? lastName,
        int aestheticScore,
        int harmonyScore,
        int rarityScore,
        string gender,
        string tone,
        GenerationFitResult? generationFit);
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
