namespace NameForm.Application.DTOs;

public class SmartRecommendationResponseDto
{
    public string LastName { get; set; } = string.Empty;
    public bool IsRareSurname { get; set; }
    public int RarityLevel { get; set; }
    public List<NameCategoryDto> Categories { get; set; } = new();
    public int TotalCount { get; set; }

    /// <summary>
    /// 추천 1위 — 전 카테고리 통합 중 최고점 후보.
    /// 탭 UX에서 사용자가 전체 탭을 돌아보지 않아도 핵심 추천을 파악할 수 있도록 노출.
    /// 후보가 하나도 없으면 null.
    /// 2026-04-21 후속 2: 탭 UX.
    /// </summary>
    public TopPickDto? TopPick { get; set; }
}

/// <summary>
/// 추천 1위 후보 DTO — 속한 카테고리 정보 + 후보.
/// </summary>
public class TopPickDto
{
    /// <summary>속한 카테고리 타입 (예: "standard", "pure-korean").</summary>
    public string CategoryType { get; set; } = string.Empty;

    /// <summary>속한 카테고리 라벨 (예: "한자 이름").</summary>
    public string CategoryLabel { get; set; } = string.Empty;

    /// <summary>추천 1위 후보.</summary>
    public SmartNameCandidateDto Candidate { get; set; } = new();
}

public class NameCategoryDto
{
    public string Type { get; set; } = string.Empty;    // "standard", "pure-korean", etc.
    public string Label { get; set; } = string.Empty;    // "한자 이름", "순우리말 이름", etc.
    public string EngineUsed { get; set; } = string.Empty;
    public List<SmartNameCandidateDto> Names { get; set; } = new();
}

public class SmartNameCandidateDto
{
    public string Name { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public double? Score { get; set; }

    /// <summary>미학 점수 (한자 카테고리 한정, 0~100). 없으면 null.</summary>
    public int? AestheticScore { get; set; }

    /// <summary>조화 점수 (한자 카테고리 한정, 0~100). 없으면 null.</summary>
    public int? HarmonyScore { get; set; }

    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// 음운 특성 노트 (감점 없음, Explanation 용도).
    /// 이름의 발음/모음 리듬 특성을 사용자에게 정보로 노출.
    /// 2026-04-21 옵션 C Phase 2.
    /// </summary>
    public List<PhonologyNoteDto> PhonologyNotes { get; set; } = new();
}

/// <summary>
/// 음운 특성 노트 DTO.
/// 하드필터를 통과한 이름에 붙는 정보 노출용 노트 (점수 영향 없음).
/// </summary>
public class PhonologyNoteDto
{
    /// <summary>특성 ID (예: "r_initial_after_final", "same_vowel_three_streak").</summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>특성 이름 (한국어 표시명).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>사용자 노출 메시지 (플레이스홀더 치환된 결과).</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>특성이 탐지된 시작 음절 위치 (0-based).</summary>
    public int Position { get; set; }
}
