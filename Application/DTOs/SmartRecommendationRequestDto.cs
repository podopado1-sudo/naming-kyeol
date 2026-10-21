using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class SmartRecommendationRequestDto
{
    [Required(ErrorMessage = "성씨는 필수입니다."), StringLength(2, MinimumLength = 1, ErrorMessage = "성씨는 1~2자여야 합니다.")]
    public string LastName { get; set; } = string.Empty;

    [StringLength(10, ErrorMessage = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>
    /// 출생 시각 (HH:mm 형식, 선택). 사주 시주(時柱) 계산에 사용.
    /// </summary>
    [StringLength(8, ErrorMessage = "출생 시각은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    [StringLength(10, ErrorMessage = "성별은 'male', 'female', 'none' 중 하나여야 합니다.")] public string Gender { get; set; } = "none";
    [StringLength(10, ErrorMessage = "톤은 'neutral', 'soft', 'strong' 중 하나여야 합니다.")] public string Tone { get; set; } = "neutral";

    // 부모 정보 (선택)
    [StringLength(2, ErrorMessage = "아버지 성씨는 2자 이내여야 합니다.")] public string? FatherSurname { get; set; }
    [StringLength(20, ErrorMessage = "아버지 이름은 20자 이내여야 합니다.")] public string? FatherName { get; set; }
    [StringLength(2, ErrorMessage = "어머니 성씨는 2자 이내여야 합니다.")] public string? MotherSurname { get; set; }
    [StringLength(20, ErrorMessage = "어머니 이름은 20자 이내여야 합니다.")] public string? MotherName { get; set; }
    [StringLength(50, ErrorMessage = "스토리 키워드는 50자 이내여야 합니다.")] public string? StoryKeyword { get; set; }

    // 영어 이름 (선택)
    [StringLength(30, ErrorMessage = "영어 이름은 30자 이내의 영문으로 입력해 주세요.")]
    public string? PreferredEnglishName { get; set; }

    // 필수 글자 (선택)
    [StringLength(1, ErrorMessage = "필수 글자는 한 글자여야 합니다.")]
    public string? RequiredChar { get; set; }

    [StringLength(10, ErrorMessage = "위치는 'first', 'last', 'any' 중 하나여야 합니다.")]
    public string? RequiredCharPosition { get; set; } // "first"/"last"/"any"

    /// <summary>
    /// 항렬자 (한자 1글자, 선택). 형제자매 공유 한자.
    /// 지정 시 RequiredChar는 자동 도출되고, 해당 한자만 고정.
    /// </summary>
    [StringLength(1, ErrorMessage = "항렬자는 한자 한 글자여야 합니다.")]
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
    [StringLength(1, ErrorMessage = "선호 오행은 木·火·土·金·水 중 한 글자여야 합니다.")]
    public string? PreferredFiveElement { get; set; }

    /// <summary>
    /// 의미 선호 키워드 (예: ["지혜", "용기", "맑음"]).
    /// 한자의 Meaning/CategoryTags와 매칭되는 후보에 가산점 부여.
    /// 각 키워드는 30자 이내, 전체 10개 이하.
    /// </summary>
    [MaxLength(10, ErrorMessage = "선호 의미 키워드는 최대 10개입니다.")]
    public List<string>? PreferredMeanings { get; set; }
}
