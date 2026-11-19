using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

/// <summary>
/// 이름 평가 서비스 — 기존 엔진들의 breakdown을 통합하여 단일 결과로 반환
/// </summary>
public interface INameEvaluationService
{
    /// <summary>
    /// 이름을 종합 평가하여 미학/조화/희귀도 breakdown + 한자 후보 + 설명을 반환
    /// </summary>
    /// <param name="picks">사용자가 정한 이름·성씨 한자(2026-11 한자 입력 — HanjaInput.Resolve 의 결과). null 이면 지정 없음:
    /// 예전과 같은 경로·같은 점수·같은 문장이다.</param>
    Task<NameEvaluationResultDto> EvaluateNameAsync(
        string name, string lastName, DateTime? birthDate, string gender, string tone,
        TimeSpan? birthTime = null,
        NameForm.Application.Engines.Utils.HanjaPicks? picks = null);
}
