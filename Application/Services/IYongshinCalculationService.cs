using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 용신 계산 서비스 인터페이스
/// 억부법(抑扶法) + 조후법(調候法) 병행
/// </summary>
public interface IYongshinCalculationService
{
    /// <summary>
    /// 사주 원국으로 용신 계산
    /// </summary>
    YongshinResult Calculate(SajuChart chart);
}
