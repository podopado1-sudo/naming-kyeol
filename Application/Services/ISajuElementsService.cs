using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

/// <summary>
/// 부족한 오행 찾기(/saju/elements) — 사주 원국의 오행 개수·없는 오행·용신·희신과 오행별 이름 한자 예.
/// 계산은 새로 만들지 않는다: <see cref="ISajuCalculationService"/> → <see cref="IYongshinCalculationService"/> → <see cref="SajuDtoMapper"/>.
/// </summary>
public interface ISajuElementsService
{
    /// <param name="birthDate">양력 생년월일(날짜 부분만 쓴다)</param>
    /// <param name="birthTime">출생 시각 — null 이면 시주를 빼고 여섯 글자</param>
    /// <param name="birthplaceCode">BirthplaceData 시·도 코드 — 비우면 서울. 모르는 코드는 ArgumentException(조용히 서울로 바꾸지 않는다)</param>
    Task<SajuElementsResponseDto> FindAsync(DateTime birthDate, TimeSpan? birthTime, string? birthplaceCode);
}
