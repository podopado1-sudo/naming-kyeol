using Microsoft.AspNetCore.Mvc;
using NameForm.Application.DTOs;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Api.Controllers;

/// <summary>
/// 한자 한 글자의 판정 — /evaluate 의 음절별 한자 칸에 직접 치거나 붙여 넣은 글자가 그 칸에 들어갈 수 있는지,
/// 안 되면 왜인지(독음 불일치 · 이 사이트 사전에 없음 · 한자가 아님)를 알려 준다(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §4-5).
/// 판정 규칙은 평가(/recommendations/evaluate)의 입력 검증과 같은 <see cref="HanjaInput"/> 하나다.
///
/// · RecommendationsController 에 두지 않는 까닭: 그 컨트롤러는 통째로 "expensive" 속도 제한(IP당 분 20회)이라 글자를 확인할 때마다 평가 한도를 깎는다.
///   여기는 전역 제한(분 60회)만 받는다 — 사전 조회 한 번이라 가볍다.
/// · 넣은 글자·음절은 서버 로그와 사용 통계에 남기지 않는다(로그 템플릿에 입력값 없음, 통계 기록 없음). 500 응답에 예외 문구를 싣지 않는다.
/// · 생성자 의존성은 로거뿐이다(정적 사전·정적 판정 함수만 쓴다).
/// </summary>
[ApiController]
[Route("api/v1/hanja")]
public class HanjaController : ControllerBase
{
    /// <summary>글자 칸 길이 — 한 글자 + 이체 선택자·서로게이트 쌍 여유. 요청 DTO 의 StringLength 와 같은 값</summary>
    public const int MaxTextLength = 8;

    private readonly ILogger<HanjaController> _logger;

    public HanjaController(ILogger<HanjaController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// 글자 한 자 판정. 판정 결과(ok · reading_mismatch · not_in_dictionary · not_hanja)는 모두 200 이다 — 조회이지 오류가 아니다.
    /// 400 은 본문이 비었거나 길이·음절 제한에 걸렸을 때만.
    /// </summary>
    [HttpPost("resolve")]
    public ActionResult<HanjaResolveResponseDto> Resolve([FromBody] HanjaResolveRequestDto request)
    {
        try
        {
            // 입력 검증 — 문구는 한국어로 시작하고 입력값을 넣지 않는다
            if (request == null || string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > MaxTextLength)
                return BadRequest(new { error = "한자 한 글자를 넣어 주세요." });

            char? syllable = null;
            if (!string.IsNullOrEmpty(request.Syllable))
            {
                // 한글 음절(가~힣) 한 글자만 — 낱자모·두 글자·공백은 받지 않는다
                if (request.Syllable.Length != 1 || !HanjaInput.IsHangulSyllables(request.Syllable))
                    return BadRequest(new { error = "음절은 한글 한 글자로 넣어 주세요." });
                syllable = request.Syllable[0];
            }

            return Ok(HanjaFactMapper.ToResolveResponse(Judge(request.Text, syllable), syllable));
        }
        catch (Exception ex)
        {
            // 예외 문구에는 넣은 글자가 섞일 수 있어 로그에 싣지 않는다 — 종류와 난 자리만 남긴다
            _logger.LogError("한자 확인 중 오류 발생: {ErrorType}\n{StackTrace}", ex.GetType().FullName, ex.StackTrace);
            return StatusCode(500, new { error = "한자 확인 중 오류가 발생했습니다." });
        }
    }

    /// <summary>판정 함수 — 테스트가 실패 경로(500)를 확인할 수 있게 갈아 끼울 자리로 둔다.</summary>
    protected virtual HanjaJudgement Judge(string text, char? syllable) => HanjaInput.Judge(text, syllable);
}
