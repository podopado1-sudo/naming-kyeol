namespace NameForm.Application.DTOs;

/// <summary>
/// POST /api/v1/saju/elements 응답 — 부족한 오행 찾기(/ohaeng, 2026-11 설계 docs/plan-ohaeng-2026-11.md §2-2).
/// 원국·용신(<see cref="Saju"/>)은 /name-analysis 와 같은 계산·같은 매퍼(SajuDtoMapper)이고, 더하는 것은 글자 수·동률 최다 오행·오행별 한자 예뿐이다.
/// </summary>
public class SajuElementsResponseDto
{
    /// <summary>사주 원국 + 용신 — /name-analysis 의 Saju 와 같은 모양. 이름이 없어 Yongshin.NameFitsYongshin 은 늘 null</summary>
    public SajuChartDto Saju { get; set; } = null!;

    /// <summary>센 글자 수 — 시주가 있으면 8, 없으면 6</summary>
    public int CharacterCount { get; set; }

    /// <summary>출생 시각을 받았는지</summary>
    public bool HasBirthTime { get; set; }

    /// <summary>출생지를 비워 서울 기준으로 둔 경우 true</summary>
    public bool BirthplaceDefaulted { get; set; }

    /// <summary>오행 개수 최댓값과 같은 오행 전부(木火土金水 순). Saju.StrongestElement 는 동률이면 첫 하나뿐이라 화면은 이 목록을 쓴다</summary>
    public List<string> StrongestElements { get; set; } = new();

    /// <summary>오행별 한자 예 묶음 — 용신 → 희신 → 없는 오행(木火土金水 순, 이미 나온 오행은 Roles 에 합침). 최대 5묶음, 같은 오행 두 번 없음</summary>
    public List<ElementHanjaGroupDto> ElementHanja { get; set; } = new();
}

/// <summary>오행 하나의 한자 예 묶음</summary>
public class ElementHanjaGroupDto
{
    /// <summary>오행 (木/火/土/金/水)</summary>
    public string Element { get; set; } = string.Empty;

    /// <summary>역할 코드 — "yongshin"(용신) · "heeshin"(희신) · "missing"(원국에 없는 오행). 화면이 한국어로 바꾼다</summary>
    public List<string> Roles { get; set; } = new();

    /// <summary>없는 오행이 기신(용신을 극하는 오행)일 때 true — 이때 <see cref="Hanja"/> 는 빈 배열(설계 D2 권고: 조화 점수가 기신 한자를 감점하므로 권하지 않는다)</summary>
    public bool IsGishin { get; set; }

    /// <summary>그 오행을 부수 기준 자원오행으로 가진 인명 빈출 한자 예(최대 12자 — ElementHanjaPicker)</summary>
    public List<ElementHanjaDto> Hanja { get; set; } = new();
}

/// <summary>한자 예 한 글자</summary>
public class ElementHanjaDto
{
    /// <summary>한자 (예: "明")</summary>
    public string Character { get; set; } = string.Empty;

    /// <summary>대표 독음(HanjaInfo.Reading) — <see cref="Gloss"/> 를 고른 독음</summary>
    public string Reading { get; set; } = string.Empty;

    /// <summary>대표 독음 + 대체 독음 중 한글 한 음절(李 리·이) — 화면이 독음마다 /hanja/{독음} 링크</summary>
    public List<string> Readings { get; set; } = new();

    /// <summary>그 독음의 훈 한 조각(HanjaData.GlossForReading — 예: "밝을 명", "오얏 리(이)")</summary>
    public string Gloss { get; set; } = string.Empty;

    /// <summary>자원오행 등급 — "R"(확정) 또는 "X"(예외 적용). V·U 는 싣지 않는다</summary>
    public string ResourceGrade { get; set; } = string.Empty;
}
