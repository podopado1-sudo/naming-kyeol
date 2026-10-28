using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 영어+한자 이중 이름 생성 엔진
/// 영어 이름의 한국어 음역 → 각 음절에 한자 배정 → 모든 음절에 쓸 수 있는 한자가 있는 이름만
///
/// 대표 한자(2026-10-28 안 1a, 사용자 승인): 같은 (이름, 출생일, 출생 시각, 성별)의 /evaluate 와 같은 글자 —
/// 요청의 출생일·출생 시각으로 용신을 한 번 계산하고 음절마다 <see cref="HanjaSelector.Select"/>(1순위 용신·희신·기신)로 고른다.
/// HarmonyEngine 이 SelectedHanja(= ScoringService.AssignedHanja)를 정하는 방식 그대로라 '이 이름 평가하기' 링크의 /evaluate·
/// 같은 응답의 /search standard 탭 카드와 한자가 같다. 사주 계산이 실패하면 HarmonyEngine 처럼 용신 없이 고른다.
/// 옛 규칙은 UsableByReading 을 Category 점수(덕목 3 > 자연 2 > 개념 1)로 다시 정렬해 첫 글자를 골라, weak 양보·빈출·성별·용신을 보지 않았다
/// (weak 글자를 대안이 있는데도 고른 음절 14/45 — 壇·備·赦·彼·何 등, /evaluate 와 다른 한자 1,210/1,272행 — 2026-10-28 조사).
/// </summary>
public class DualNameEngine : IDualNameEngine
{
    private static readonly HashSet<string> ForbiddenWords = new()
    {
        "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병"
    };

    private readonly ISajuCalculationService _sajuCalculationService;
    private readonly IYongshinCalculationService _yongshinCalculationService;

    public DualNameEngine(
        ISajuCalculationService sajuCalculationService,
        IYongshinCalculationService yongshinCalculationService)
    {
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = yongshinCalculationService;
    }

    public async Task<List<DualNameCandidate>> GenerateDualNamesAsync(
        string lastName,
        string? preferredEnglishName,
        DateTime birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null)
    {
        var candidates = new List<DualNameCandidate>();

        // ScoringService 와 같은 정규화 — 'Male'·' female' 같은 입력도 /evaluate 와 같은 성별로 고른다. 'none' 은 none 그대로
        // (링크의 /evaluate 도 성별 무관이면 성별을 빼므로 화면 일치가 우선 — 2026-10-28 결정)
        var normalizedGender = ScoringService.NormalizeGender(gender);
        var yongshin = CalculateYongshin(birthDate, birthTime);

        if (!string.IsNullOrEmpty(preferredEnglishName))
        {
            // 특정 영어 이름 지정
            var mappings = EnglishKoreanNameMap.FindByEnglishName(preferredEnglishName);
            foreach (var mapping in mappings)
            {
                foreach (var koreanName in mapping.Korean)
                {
                    var candidate = CreateCandidate(koreanName, mapping.English, normalizedGender, yongshin);
                    if (candidate != null)
                        candidates.Add(candidate);
                }
            }

            // 매핑에 없으면 직접 음역 시도
            if (candidates.Count == 0)
            {
                var directPhonetics = GenerateDirectPhonetics(preferredEnglishName);
                foreach (var phonetic in directPhonetics)
                {
                    var candidate = CreateCandidate(phonetic, preferredEnglishName, normalizedGender, yongshin);
                    if (candidate != null)
                        candidates.Add(candidate);
                }
            }
        }
        else
        {
            // 성별 기반으로 잘 맞는 이중 이름 추천
            var mappings = EnglishKoreanNameMap.GetByGender(normalizedGender);
            foreach (var mapping in mappings)
            {
                foreach (var koreanName in mapping.Korean)
                {
                    // 이름 길이 필터 (성+이름이 3~4음절)
                    var totalLength = lastName.Length + koreanName.Length;
                    if (totalLength < 3 || totalLength > 5) continue;

                    var candidate = CreateCandidate(koreanName, mapping.English, normalizedGender, yongshin);
                    if (candidate != null)
                    {
                        candidates.Add(candidate);
                        if (candidates.Count >= 20) break;
                    }
                }
                if (candidates.Count >= 20) break;
            }
        }

        return await Task.FromResult(candidates);
    }

    /// <summary>
    /// 요청 하나에 한 번 — HarmonyEngine.CalculateScoreWithBreakdownAsync 의 용신 계산과 같다(1순위 용신·희신·기신, 실패하면 모두 null).
    /// </summary>
    private (string? Primary, string? Hee, string? Gi) CalculateYongshin(DateTime birthDate, TimeSpan? birthTime)
    {
        try
        {
            var chart = _sajuCalculationService.CalculateChart(birthDate, birthTime);
            var y = _yongshinCalculationService.Calculate(chart);
            return (y.PrimaryYongshin, y.Heeshin, y.Gishin);
        }
        catch
        {
            // 사주·용신 계산 실패 → 용신 없이 인명 빈출/성별 기준으로만 선택(HarmonyEngine 과 같음)
            return (null, null, null);
        }
    }

    /// <summary>
    /// 한국어 음역에서 한자 배정을 찾아 DualNameCandidate 생성
    /// </summary>
    private static DualNameCandidate? CreateCandidate(
        string koreanName, string englishName, string gender,
        (string? Primary, string? Hee, string? Gi) yongshin)
    {
        if (string.IsNullOrEmpty(koreanName) || koreanName.Length < 2)
            return null;

        // 금칙어 체크
        if (ForbiddenWords.Any(f => koreanName.Contains(f)))
            return null;

        // 한글만 포함 확인
        if (!koreanName.All(c => c >= 0xAC00 && c <= 0xD7A3))
            return null;

        // 음절마다 HanjaSelector.Select — /evaluate 배정(ScoringService.AssignedHanja)과 같은 함수·같은 인자.
        // 이름에 쓸 수 있는 글자(IsUsableNameHanja — 불용 아님·뜻 있음)가 없는 음절(에 = 曀·恚 모두 불용, 순우리말·외래 음절 레·클·스 등)이
        // 하나라도 있으면 이 이름은 한자 이중 이름으로 부적합 — 옛 규칙(UsableByReading 이 빈 음절)과 같은 탈락이다:
        // Select 는 그런 음절에 null 이나 뜻 없는 글자(사전에 뜻 있는 글자가 아예 없는 음절)만 낸다.
        var selected = HanjaSelector.Select(koreanName, gender, yongshin.Primary, yongshin.Hee, yongshin.Gi);
        if (selected.Count != koreanName.Length || selected.Any(h => h == null || !HanjaSelector.IsUsableNameHanja(h)))
            return null;

        var hanjaChars = new List<string>(selected.Count);
        var meaningParts = new List<string>(selected.Count);
        for (int i = 0; i < selected.Count; i++)
        {
            var h = selected[i]!;
            hanjaChars.Add(h.Character);
            // 그 음절 독음의 훈 하나만(RecommendationService.BuildCardMeaning·ExplanationEngine 과 같은 규칙) — 옛 값은 Meaning 전체라
            // 다른 독음 훈까지 실렸다(이삭 削 '깎을 삭, 채지 소, 칼집 초'). 결과에 '·'·'+' 가 없어 프런트 parseHanjaMeaning(/[+·]/)이 음절마다 한 칸으로 자른다
            var gloss = HanjaData.GlossForReading(h.Meaning, koreanName[i].ToString());
            meaningParts.Add(gloss.Length > 0 ? gloss : h.Character);
        }

        return new DualNameCandidate
        {
            KoreanName = koreanName,
            EnglishEquivalent = englishName,
            HanjaCharacters = hanjaChars,
            HanjaMeaning = string.Join(" + ", meaningParts)
        };
    }

    /// <summary>
    /// 영어 이름의 직접 음역 시도 (매핑 테이블에 없는 경우)
    /// 간단한 영한 음역 규칙 적용
    /// </summary>
    private List<string> GenerateDirectPhonetics(string englishName)
    {
        // 기본적인 음역 - 실제로는 더 정교한 알고리즘 필요
        // 여기서는 매핑 테이블 외의 이름은 빈 목록 반환
        return new List<string>();
    }
}
