using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines;

/// <summary>
/// 영어+한자 이중 이름 생성 엔진
/// 영어 이름의 한국어 음역 → 각 음절에 한자 매핑 → 의미 있는 조합 선별
/// </summary>
public class DualNameEngine : IDualNameEngine
{
    private static readonly HashSet<string> ForbiddenWords = new()
    {
        "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병"
    };

    public async Task<List<DualNameCandidate>> GenerateDualNamesAsync(
        string lastName,
        string? preferredEnglishName,
        DateTime birthDate,
        string gender,
        string tone)
    {
        var candidates = new List<DualNameCandidate>();

        if (!string.IsNullOrEmpty(preferredEnglishName))
        {
            // 특정 영어 이름 지정
            var mappings = EnglishKoreanNameMap.FindByEnglishName(preferredEnglishName);
            foreach (var mapping in mappings)
            {
                foreach (var koreanName in mapping.Korean)
                {
                    var candidate = CreateCandidate(koreanName, mapping.English);
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
                    var candidate = CreateCandidate(phonetic, preferredEnglishName);
                    if (candidate != null)
                        candidates.Add(candidate);
                }
            }
        }
        else
        {
            // 성별 기반으로 잘 맞는 이중 이름 추천
            var mappings = EnglishKoreanNameMap.GetByGender(gender);
            foreach (var mapping in mappings)
            {
                foreach (var koreanName in mapping.Korean)
                {
                    // 이름 길이 필터 (성+이름이 3~4음절)
                    var totalLength = lastName.Length + koreanName.Length;
                    if (totalLength < 3 || totalLength > 5) continue;

                    var candidate = CreateCandidate(koreanName, mapping.English);
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
    /// 한국어 음역에서 한자 매핑을 찾아 DualNameCandidate 생성
    /// </summary>
    private DualNameCandidate? CreateCandidate(string koreanName, string englishName)
    {
        if (string.IsNullOrEmpty(koreanName) || koreanName.Length < 2)
            return null;

        // 금칙어 체크
        if (ForbiddenWords.Any(f => koreanName.Contains(f)))
            return null;

        // 한글만 포함 확인
        if (!koreanName.All(c => c >= 0xAC00 && c <= 0xD7A3))
            return null;

        var hanjaChars = new List<string>();
        var meaningParts = new List<string>();

        foreach (var syllable in koreanName)
        {
            var reading = syllable.ToString();
            var hanjaList = HanjaData.FindByReading(reading);

            if (hanjaList.Any())
            {
                // 의미가 가장 좋은 한자 선택 (카테고리 우선)
                var bestHanja = hanjaList
                    .OrderByDescending(h =>
                        (h.Category == "덕목" ? 3 : 0) +
                        (h.Category == "자연" ? 2 : 0) +
                        (h.Category == "개념" ? 1 : 0) +
                        (!string.IsNullOrEmpty(h.Meaning) ? 1 : 0))
                    .First();

                hanjaChars.Add(bestHanja.Character);
                meaningParts.Add($"{bestHanja.Meaning ?? bestHanja.Character}");
            }
            else
            {
                // 한자 매핑 없는 음절 → 이 이름은 한자 이중 이름으로 부적합
                return null;
            }
        }

        // 모든 음절에 한자 매핑이 있어야 유효한 이중 이름
        if (hanjaChars.Count != koreanName.Length)
            return null;

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
