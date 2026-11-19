using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

// 2026-11 한자 입력(/evaluate 음절별 한자 고르기) — docs/plan-hanja-input-2026-11.md §4.
// 음절별 정적 후보 파일, /evaluate 응답의 hanjaSummary, /hanja/resolve 가 글자 사실을 같은 꼴(HanjaFact)로 싣는다.

/// <summary>
/// 한자 한 글자의 사실 — 화면이 그대로 그리는 값만(점수·길흉 판정 없음). 만드는 곳은 HanjaFactMapper 하나다.
/// </summary>
public class HanjaFactDto
{
    /// <summary>글자 — 늘 통합 한자(호환 한자·이체 선택자로 들어와도 사전의 통합 꼴)</summary>
    public string Character { get; set; } = "";
    /// <summary>그 음절로 읽는 훈 한 조각('상서 서', '오얏 리(이)'). 맞는 조각이 없으면 첫 훈, 뜻이 없으면 빈 문자열</summary>
    public string Gloss { get; set; } = "";
    /// <summary>부수 기준 자원오행 木·火·土·金·水 — 미상이면 빈 문자열</summary>
    public string FiveElement { get; set; } = "";
    /// <summary>자원오행 등급 R=확정 · V=이견 있음 · X=예외 적용 · U=미상</summary>
    public string ResourceGrade { get; set; } = "U";
    /// <summary>V 등급의 이유(V 가 아니면 빈 목록)</summary>
    public List<string> VReasons { get; set; } = new();
    /// <summary>총획수(유니코드 kTotalStrokes — 작명소의 원획과 다를 수 있다)</summary>
    public int StrokeCount { get; set; }
    /// <summary>음양 陽·陰 — 획수 홀짝(홀수 陽)</summary>
    public string YinYang { get; set; } = "";
    /// <summary>먼저 보여 드리는 글자 — 사이트가 이름 글자로 꼽아 둔 목록에 있고 약자가 아닌 글자(사용 통계가 아니다). 성씨 글자에는 늘 false</summary>
    public bool Common { get; set; }
    /// <summary>이름에 피하는 글자(불용) — 계산은 하되 화면이 표시한다. 성씨 글자에는 늘 false</summary>
    public bool Forbidden { get; set; }
    /// <summary>사전에 뜻 풀이가 있는가</summary>
    public bool HasMeaning { get; set; }
    /// <summary>CJK 기본 영역(U+4E00~9FFF)인가 — 거짓이면 기기에 따라 글자가 안 보일 수 있다('확장 한자')</summary>
    public bool Basic { get; set; }
}

/// <summary>
/// /evaluate 응답의 '이 이름의 한자' — 성씨·음절마다 계산에 쓴 한자와 그 출처(고름·자동·없음), 용신·부족 오행 역할.
/// 한자를 지정하지 않은 요청에도 실린다(<see cref="UserHanja"/> false). 이름이나 성씨가 한글 음절만이 아니면 응답에서 이 필드가 null 이다.
/// </summary>
public class HanjaSummaryDto
{
    /// <summary>사용자가 한자를 정한 요청인가(이름 칸을 고르거나 비웠거나, 성씨 한자를 골랐다)</summary>
    public bool UserHanja { get; set; }
    /// <summary>서버가 받아들인 이름 한자의 정규 꼴 — 칸마다 통합 한자 / *(자동) / -(한자 없이 한글로). 지정이 없으면 빈 문자열. 그대로 다시 보내면 같은 응답이 온다</summary>
    public string NameHanja { get; set; } = "";
    /// <summary>서버가 받아들인 성씨 한자의 정규 꼴 — 지정이 없으면(대표 한자와 같은 글자 포함) 빈 문자열</summary>
    public string LastNameHanja { get; set; } = "";
    public SurnameHanjaDto Surname { get; set; } = new();
    public List<SyllableHanjaDto> Syllables { get; set; } = new();
    /// <summary>출생일로 정해지는 오행 쪽 사정 — 출생일이 없으면 null</summary>
    public ElementFitDto? ElementFit { get; set; }
}

/// <summary>성씨 한자 — 수리(81수리)의 성씨 획수에만 쓰인다.</summary>
public class SurnameHanjaDto
{
    /// <summary>성씨 한글(앞뒤 공백을 뗀 값)</summary>
    public string Hangul { get; set; } = "";
    /// <summary>default = 기본으로 두는 성씨 한자(대표 한자 표) · user = 고른 한자(한 글자라도) · estimated = 표에 없는 성씨라 독음으로 추정</summary>
    public string Source { get; set; } = "";
    /// <summary>수리에 쓴 성씨 획수(복성은 합). 정하지 못하면 0</summary>
    public int Strokes { get; set; }
    /// <summary>성씨 글자마다 한 항목(성씨 글자 수와 같은 길이). 한 글자라도 정하지 못하면 빈 목록. 이름용 표시(forbidden·common)는 늘 false</summary>
    public List<HanjaFactDto> Chars { get; set; } = new();
}

/// <summary>이름 음절 하나의 한자.</summary>
public class SyllableHanjaDto
{
    public string Syllable { get; set; } = "";
    /// <summary>user = 고른 한자 · auto = 자동으로 고른 한자 · none = 사용자가 한자 없이 둠 · unavailable = 자동인데 쓸 수 있는 인명용 한자가 없는 음절</summary>
    public string Source { get; set; } = "";
    /// <summary>이 글자의 자원오행이 맡는 역할 — yongshin · heeshin · gishin · lacking · excessive. 출생일이 없거나 한자가 없으면 빈 목록</summary>
    public List<string> Fills { get; set; } = new();
    /// <summary>계산에 쓴 한자 — none·unavailable 이면 null</summary>
    public HanjaFactDto? Hanja { get; set; }
}

/// <summary>출생일로만 정해지는 오행 쪽 사정(한자와 무관) — 조화 점수가 쓴 값 그대로.</summary>
public class ElementFitDto
{
    /// <summary>용신·희신·기신 오행 — 용신을 구하지 못했으면 세 값이 null</summary>
    public string? Yongshin { get; set; }
    public string? Heeshin { get; set; }
    public string? Gishin { get; set; }
    /// <summary>사주에 부족한 오행(개수가 평균 미만 — '없는 오행'보다 넓다)</summary>
    public List<string> Lacking { get; set; } = new();
    /// <summary>사주에 많은 오행(개수가 평균의 1.5배 초과)</summary>
    public List<string> Excessive { get; set; } = new();
    /// <summary>사주 글자의 오행 개수(출생 시각이 없으면 여섯 글자)</summary>
    public Dictionary<string, int> Counts { get; set; } = new();
}

/// <summary>POST /api/v1/hanja/resolve 요청 — 글자 한 자의 판정.</summary>
public class HanjaResolveRequestDto
{
    /// <summary>한자 한 글자(이체 선택자·서로게이트 쌍 여유로 8자까지). 여러 글자가 오면 정리 뒤 첫 글자만 본다</summary>
    [Required(ErrorMessage = "한자 한 글자를 넣어 주세요.")]
    [StringLength(8, ErrorMessage = "한자 한 글자를 넣어 주세요.")]
    public string Text { get; set; } = "";

    /// <summary>넣으려는 칸의 음절(선택) — 한글 음절 한 글자. 비우면 독음 판정 없이 글자만 찾는다</summary>
    [StringLength(1, ErrorMessage = "음절은 한글 한 글자로 넣어 주세요.")]
    public string? Syllable { get; set; }
}

/// <summary>POST /api/v1/hanja/resolve 응답 — 조회라서 판정 결과는 모두 200 이다.</summary>
public class HanjaResolveResponseDto
{
    /// <summary>ok · reading_mismatch · not_in_dictionary · not_hanja</summary>
    public string Status { get; set; } = "";
    /// <summary>정리·정규화한 글자(통합 한자). 한자가 아니면 null</summary>
    public string? Character { get; set; }
    /// <summary>사전 항목 — 사전에 없으면 null</summary>
    public HanjaFactDto? Hanja { get; set; }
    /// <summary>이 글자를 넣을 수 있는 음절(지정 독음과 그 두음 꼴)</summary>
    public List<string> AcceptedSyllables { get; set; } = new();
    /// <summary>ok 가 아닐 때의 안내 문장</summary>
    public string? Message { get; set; }
    /// <summary>사전에 없는 글자에 권하는, 꼴만 다른 등재 글자(없으면 null)</summary>
    public HanjaFactDto? Suggestion { get; set; }
}
