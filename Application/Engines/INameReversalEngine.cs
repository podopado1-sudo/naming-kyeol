namespace NameForm.Application.Engines;

/// <summary>
/// 이름 뒤집기/변형 엔진 인터페이스
/// </summary>
public interface INameReversalEngine
{
    /// <summary>
    /// 이름의 다양한 변형(반전, 재조합, 음절교환) 생성
    /// </summary>
    Task<List<NameVariant>> GenerateVariantsAsync(string name);
}

/// <summary>
/// 이름 변형 결과
/// </summary>
public class NameVariant
{
    /// <summary>변형된 이름</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>변형 유형: "반전", "재조합", "음절교환"</summary>
    public string VariationType { get; set; } = string.Empty;

    /// <summary>변형 방식 설명</summary>
    public string Description { get; set; } = string.Empty;
}
