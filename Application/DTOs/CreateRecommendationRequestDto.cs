using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class CreateRecommendationRequestDto
{
    /// <summary>성 (예: "허", "김", "이")</summary>
    [Required, StringLength(2, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>출생일 (YYYY-MM-DD 형식)</summary>
    [StringLength(10)]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>
    /// 출생 시각 (HH:mm 형식, 선택). 사주 시주(時柱) 계산에 사용.
    /// 미입력 시 시주 생략 (3주 분석).
    /// </summary>
    [StringLength(8)]
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [StringLength(10)]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [StringLength(10)]
    public string Tone { get; set; } = "neutral";

    /// <summary>아버지 성씨 (예: "문")</summary>
    [StringLength(2)] public string? FatherSurname { get; set; }

    /// <summary>아버지 이름 (예: "소")</summary>
    [StringLength(20)] public string? FatherName { get; set; }

    /// <summary>어머니 성씨 (예: "이")</summary>
    [StringLength(2)] public string? MotherSurname { get; set; }

    /// <summary>어머니 이름 (예: "고은")</summary>
    [StringLength(20)] public string? MotherName { get; set; }

    /// <summary>스토리/가치관 키워드 (신해솜 모델용, 예: "신의 손", "예술적 재능")</summary>
    [StringLength(50)] public string? StoryKeyword { get; set; }

    /// <summary>선호 영어 이름 (이중 이름 생성용, 예: "Philip", "Sophia")</summary>
    [StringLength(30)] public string? PreferredEnglishName { get; set; }

    /// <summary>
    /// 용신 기반 선호 오행 (木/火/土/金/水).
    /// 설정 시 해당 오행 한자가 포함된 이름에 보너스 점수 부여.
    /// </summary>
    [StringLength(1)] public string? PreferredFiveElement { get; set; }

    /// <summary>
    /// 의미 선호 키워드 (예: ["지혜", "용기", "맑음"]). 최대 10개.
    /// 한자의 Meaning/CategoryTags와 매칭되는 후보에 가산점 부여.
    /// </summary>
    [MaxLength(10)] public List<string>? PreferredMeanings { get; set; }
}
