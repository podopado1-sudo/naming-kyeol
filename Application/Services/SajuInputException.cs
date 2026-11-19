namespace NameForm.Application.Services;

/// <summary>
/// /saju/elements 서비스(<see cref="SajuElementsService"/>)가 직접 막는 입력 오류 — 문구는 한국어로 시작하고 입력값을 담지 않는다.
/// <see cref="NameForm.Api.Controllers.SajuController"/> 는 <b>이 타입만</b> 400 + 문구로 돌려준다(2026-11-19 반박 검토 — 설계 docs/plan-ohaeng-2026-11.md §16).
/// 그 밖의 <see cref="ArgumentException"/>(엔진 안의 ArgumentOutOfRange·ArgumentNull·Dictionary 중복 키 등)은 입력 오류가 아니라 계산 오류라
/// 500 + 고정 문구로 보낸다 — 영문 프레임워크 문구('(Parameter 'index')')가 응답에 실리지 않게.
/// ArgumentException 을 물려받아 코드 규칙('ArgumentException → 400')의 뜻(입력 오류 → 400)과 맞는다.
/// </summary>
public sealed class SajuInputException : ArgumentException
{
    public SajuInputException(string message) : base(message) { }
}
