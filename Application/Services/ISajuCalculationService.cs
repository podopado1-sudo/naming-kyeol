using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

public interface ISajuCalculationService
{
    /// <summary>
    /// 생년월일(+시간)으로 사주 원국 계산
    /// </summary>
    SajuChart CalculateChart(DateTime birthDate, TimeSpan? birthTime = null, string? birthplaceCode = null);
}
