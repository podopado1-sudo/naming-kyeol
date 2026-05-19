using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

/// <summary>
/// 이름 분석/검증 서비스 인터페이스
/// </summary>
public interface INameAnalysisService
{
    /// <summary>
    /// 사용자가 입력한 이름을 분석하여 점수, 한자, 강약점을 반환
    /// </summary>
    Task<NameAnalysisResponseDto> AnalyzeNameAsync(NameAnalysisRequestDto request);
}
