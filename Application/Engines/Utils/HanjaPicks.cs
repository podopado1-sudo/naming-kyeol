using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines.Utils;

/// <summary>이름 한 칸의 한자 지정 — 자동(서버가 고른다) · 한자 없음(사용자가 한글로 둔다) · 고름(사용자가 고른 한자).</summary>
public enum HanjaPickKind { Auto, None, Picked }

/// <summary>이름 음절 하나의 지정. <see cref="Hanja"/> 는 <see cref="HanjaPickKind.Picked"/> 일 때만 있다(사전의 통합 한자 항목).</summary>
public readonly record struct HanjaPick(HanjaPickKind Kind, HanjaInfo? Hanja)
{
    public static readonly HanjaPick Auto = new(HanjaPickKind.Auto, null);
    public static readonly HanjaPick None = new(HanjaPickKind.None, null);
    public static HanjaPick Of(HanjaInfo hanja) => new(HanjaPickKind.Picked, hanja);
}

/// <summary>
/// /evaluate 에서 사용자가 정한 한자(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §7-1). 입력 문자열을 읽고 검증하는 일은
/// <see cref="HanjaInput.Resolve"/> 가 끝내고, 엔진에는 문자열이 아니라 이 목록을 넘긴다(Rune 처리가 입력 한 곳에서 끝난다).
/// '지정 없음'은 이 객체가 아니라 null 이다 — 엔진·서비스의 선택 인자 <c>picks == null</c> 이면 예전 분기를 그대로 탄다.
/// 원칙: 자동 배정을 지금과 똑같이 먼저 구하고(<see cref="HanjaSelector"/>), 사용자가 정한 칸만 덮어쓴다(<see cref="ApplyTo"/>).
/// </summary>
/// <param name="Name">이름 음절과 같은 길이</param>
/// <param name="Surname">성씨를 지정했을 때만 — 전 음절('*' 자리는 대표 한자·추정 글자로 채운 것, 채울 글자가 없으면 그 자리 null). 지정이 없으면 null</param>
public sealed record HanjaPicks(IReadOnlyList<HanjaPick> Name, IReadOnlyList<HanjaInfo?>? Surname)
{
    /// <summary>자동 배정 목록에 사용자 지정을 덮어쓴다 — 고름 → 그 글자, 한자 없음 → null, 자동 → auto[i](범위 밖이면 null). 길이는 <see cref="Name"/> 과 같다.</summary>
    public List<HanjaInfo?> ApplyTo(IReadOnlyList<HanjaInfo?> auto)
    {
        var result = new List<HanjaInfo?>(Name.Count);
        for (int i = 0; i < Name.Count; i++)
        {
            result.Add(Name[i].Kind switch
            {
                HanjaPickKind.Picked => Name[i].Hanja,
                HanjaPickKind.None => null,
                _ => i < auto.Count ? auto[i] : null,
            });
        }
        return result;
    }

    /// <summary>사용자가 '한자 없이 한글로' 비운 칸이 있는가.</summary>
    public bool AnyNone => Name.Any(p => p.Kind == HanjaPickKind.None);

    /// <summary>사용자가 한자를 고른 이름 칸이 있는가.</summary>
    public bool AnyPicked => Name.Any(p => p.Kind == HanjaPickKind.Picked);

    /// <summary>이름 한자의 정규 꼴 — 칸마다 통합 한자 / <c>*</c>(자동) / <c>-</c>(한자 없음). 전부 자동이면 빈 문자열.</summary>
    public string NameText => Name.All(p => p.Kind == HanjaPickKind.Auto)
        ? string.Empty
        : string.Concat(Name.Select(p => p.Kind switch
        {
            HanjaPickKind.Picked => p.Hanja!.Character,
            HanjaPickKind.None => HanjaInput.NoneMark.ToString(),
            _ => HanjaInput.AutoMark.ToString(),
        }));

    /// <summary>성씨 한자의 정규 꼴 — 지정이 없으면 빈 문자열. 채울 글자가 없던 자리는 <c>*</c>.</summary>
    public string SurnameText => Surname == null
        ? string.Empty
        : string.Concat(Surname.Select(h => h?.Character ?? HanjaInput.AutoMark.ToString()));
}
