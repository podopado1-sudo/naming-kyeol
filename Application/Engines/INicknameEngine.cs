namespace NameForm.Application.Engines;

/// <summary>
/// 별명 생성 엔진 (선택 기능)
/// 재미용 별명 생성
/// </summary>
public interface INicknameEngine
{
    Task<List<string>> GenerateNicknamesAsync(string lastName, List<string> names);
}
