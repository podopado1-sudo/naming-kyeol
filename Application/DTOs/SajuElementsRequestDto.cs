using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

/// <summary>
/// POST /api/v1/saju/elements — 부족한 오행 찾기(/ohaeng) 요청(2026-11 설계 docs/plan-ohaeng-2026-11.md §2-1).
/// 이름·성별은 받지 않는다. 속성 이름·문구는 <see cref="NameAnalysisRequestDto"/> 와 같게 둔다.
/// 형식·범위(1900-01-01 ~ 오늘 KST, HH:mm, 17개 시·도 코드)는 컨트롤러가 엄격하게 다시 본다.
/// 입력값은 DB·서버 로그에 남기지 않는다(개인정보처리방침 — SajuControllerLoggingTests).
/// </summary>
public class SajuElementsRequestDto
{
    /// <summary>양력 생년월일 (YYYY-MM-DD, 필수)</summary>
    [Required(ErrorMessage = "생년월일은 필수입니다."), StringLength(10, ErrorMessage = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm 또는 HH:mm:ss, 선택 — 비우면 시주를 빼고 여섯 글자)</summary>
    [StringLength(8, ErrorMessage = "출생 시각은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    /// <summary>출생지 코드 (선택, 비우면 서울 — BirthplaceData 17개 시·도 코드)</summary>
    [StringLength(20, ErrorMessage = "출생지 코드는 20자 이내여야 합니다.")]
    public string? BirthplaceCode { get; set; }
}
