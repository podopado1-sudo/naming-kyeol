using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class SmartRecommendationRequestDto
{
    [Required, StringLength(2, MinimumLength = 1, ErrorMessage = "성씨는 1~2자여야 합니다.")]
    public string LastName { get; set; } = string.Empty;

    [StringLength(10, ErrorMessage = "BirthDate는 YYYY-MM-DD 형식이어야 합니다.")]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>
    /// 출생 시각 (HH:mm 형식, 선택). 사주 시주(時柱) 계산에 사용.
    /// </summary>
    [StringLength(8, ErrorMessage = "BirthTime은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    [StringLength(10)] public string Gender { get; set; } = "none";
    [StringLength(10)] public string Tone { get; set; } = "neutral";

    // 부모 정보 (선택)
    [StringLength(2)] public string? FatherSurname { get; set; }
    [StringLength(20)] public string? FatherName { get; set; }
    [StringLength(2)] public string? MotherSurname { get; set; }
    [StringLength(20)] public string? MotherName { get; set; }
    [StringLength(50)] public string? StoryKeyword { get; set; }

    // 영어 이름 (선택)
    [StringLength(30)] public string? PreferredEnglishName { get; set; }

    // 필수 글자 (선택)
    [StringLength(1, ErrorMessage = "RequiredChar는 한 글자여야 합니다.")]
    public string? RequiredChar { get; set; }

    [StringLength(10)]
    public string? RequiredCharPosition { get; set; } // "first"/"last"/"any"

    /// <summary>
    /// 항렬자 (한자 1글자, 선택). 형제자매 공유 한자.
    /// 지정 시 RequiredChar는 자동 도출되고, 해당 한자만 고정.
    /// </summary>
    [StringLength(1, ErrorMessage = "RequiredHanja는 한자 한 글자여야 합니다.")]
    public string? RequiredHanja { get; set; }

    // 옵션
    public bool IsTwin { get; set; } = false;
    public bool IncludeThreeSyllable { get; set; } = true;
    public bool IncludePureKorean { get; set; } = true;
    public bool IncludeCreative { get; set; } = true;

    /// <summary>
    /// 용신 기반 선호 오행 (木/火/土/金/水).
    /// 설정 시 해당 오행 한자가 포함된 이름에 보너스 점수 부여.
    /// </summary>
    [StringLength(1)]
    public string? PreferredFiveElement { get; set; }

    /// <summary>
    /// 의미 선호 키워드 (예: ["지혜", "용기", "맑음"]).
    /// 한자의 Meaning/CategoryTags와 매칭되는 후보에 가산점 부여.
    /// 각 키워드는 30자 이내, 전체 10개 이하.
    /// </summary>
    [MaxLength(10, ErrorMessage = "PreferredMeanings는 최대 10개입니다.")]
    public List<string>? PreferredMeanings { get; set; }
}
