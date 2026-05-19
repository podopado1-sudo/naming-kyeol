using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 3글자 이름 추천 엔진 구현
/// 순우리말 모프 조합 + 한자 3글자 + 혼합 방식 지원
/// </summary>
public class ThreeSyllableEngine : IThreeSyllableEngine
{
    // ── 순우리말 앞 조각 (prefix, 2음절) ──
    private static readonly List<MorphemeEntry> _prefixes = new()
    {
        new("여울", "여울물, 물이 흐르는 곳", "female", "soft"),
        new("다소", "다소곳하다, 조용하고 얌전한", "female", "soft"),
        new("미나", "미나리, 들판의 식물", "female", "soft"),
        new("하늘", "하늘, 천공", "neutral", "neutral"),
        new("바다", "바다, 넓은 바다", "neutral", "strong"),
        new("가을", "가을, 풍요로운 계절", "female", "soft"),
        new("새벽", "새벽, 여명", "neutral", "strong"),
        new("나래", "날개, 비상", "neutral", "neutral"),
        new("아라", "바다(고어), 아름다운 바다", "female", "soft"),
        new("다온", "좋은 일이 다 온다", "neutral", "soft"),
        new("가온", "가운데, 중심", "neutral", "neutral"),
        new("하루", "하루, 소중한 하루", "neutral", "neutral"),
        new("이슬", "이슬, 맑은 물방울", "female", "soft"),
        new("보라", "보라색, 고귀한 빛깔", "female", "soft"),
        new("누리", "세상, 온 세상", "neutral", "neutral"),
        new("채운", "채우다, 가득 채우다", "neutral", "strong"),
        new("한울", "큰 울타리, 하늘(고어)", "male", "strong"),
        new("노을", "노을, 저녁놀", "female", "soft"),
        new("마루", "꼭대기, 산마루", "male", "strong"),
        new("나린", "내리다, 하늘에서 내리는", "female", "soft"),
        new("다솜", "사랑(고어)", "female", "soft"),
        new("라온", "즐거운(고어)", "neutral", "soft"),
        new("바람", "바람, 자유로운 바람", "male", "strong"),
        new("소담", "생김새가 탐스러운", "female", "soft"),
        new("푸른", "푸르다, 청량한", "neutral", "strong"),
        new("별빛", "별의 빛", "female", "soft"),
        new("미르", "용(고어)", "male", "strong"),
        new("온누", "온 세상(고어)", "neutral", "neutral"),
        new("찬솔", "찬란한 소나무", "male", "strong"),
        new("다울", "다스리다, 다스림", "male", "strong"),
    };

    // ── 순우리말 뒤 조각 (suffix, 1음절) ──
    private static readonly List<MorphemeEntry> _suffixes = new()
    {
        new("결", "결, 순수한 결", "neutral", "soft"),
        new("미", "아름답다", "female", "soft"),
        new("수", "수, 맑은 물", "neutral", "neutral"),
        new("빛", "빛, 밝은 빛", "neutral", "strong"),
        new("솔", "소나무, 곧은 나무", "neutral", "strong"),
        new("별", "별, 반짝이는 별", "female", "soft"),
        new("꽃", "꽃, 아름다운 꽃", "female", "soft"),
        new("님", "님, 존경하는 분", "neutral", "neutral"),
        new("비", "비, 촉촉한 비", "female", "soft"),
        new("달", "달, 밝은 달빛", "female", "soft"),
        new("봄", "봄, 시작의 계절", "female", "soft"),
        new("강", "강, 큰 강물", "male", "strong"),
        new("샘", "샘, 맑은 샘물", "neutral", "neutral"),
        new("울", "울타리, 울림", "neutral", "neutral"),
        new("힘", "힘, 강인한 힘", "male", "strong"),
    };

    // 금칙어
    private static readonly HashSet<string> _forbiddenWords = new()
    {
        "바보", "멍청", "못난", "나쁜", "악마", "흉측", "죽음", "병신", "고생", "불행",
        "개나", "씨발", "지랄", "미친"
    };

    // 생활어 충돌
    private static readonly HashSet<string> _collisionWords = new()
    {
        "사과", "바나나", "자동차", "의자", "책상", "침대", "신발", "가방"
    };

    // ── 큐레이션된 3글자 이름 DB ──
    // data/three-syllable-curated.json에서 로드. 하드코딩 제거 (2026-04, B-2 후속 옵션 B Step 1)
    private static IReadOnlyList<CuratedThreeSyllableEntry> _curatedNames
        => ThreeSyllableCuratedLoader.Entries;

    // 이하 기존 하드코딩 리스트는 데이터 파일로 이전됨. 참조용 주석만 보존.
    /*
        // ── 순우리말 3글자 (여성/부드러움) ──
        new("여울결", "여울물이 흐르는 맑은 결", "pure-korean", "female", "soft", 85),
        new("다소미", "다소곳하고 아름다운 사람", "pure-korean", "female", "soft", 83),
        new("이슬빛", "맑은 이슬의 빛", "pure-korean", "female", "soft", 82),
        new("노을빛", "저녁 노을의 빛", "pure-korean", "female", "soft", 84),
        new("봄나래", "봄날의 날개", "pure-korean", "female", "soft", 83),
        new("봄이슬", "봄날의 맑은 이슬", "pure-korean", "female", "soft", 81),
        new("이슬별", "이슬처럼 맑은 별", "pure-korean", "female", "soft", 82),
        new("별빛꽃", "별빛처럼 피어난 꽃", "pure-korean", "female", "soft", 80),
        new("가을별", "가을밤의 별", "pure-korean", "female", "soft", 83),
        new("노을결", "노을빛 고운 결", "pure-korean", "female", "soft", 82),
        new("나린별", "하늘에서 내려온 별", "pure-korean", "female", "soft", 81),
        new("보람빛", "보람찬 빛", "pure-korean", "female", "soft", 80),
        new("다솜빛", "사랑의 빛", "pure-korean", "female", "soft", 82),
        new("소담빛", "탐스러운 빛", "pure-korean", "female", "soft", 81),
        new("아라별", "바다(고어)의 별", "pure-korean", "female", "soft", 83),
        new("나래빛", "날개의 빛", "pure-korean", "female", "soft", 80),
        new("보라빛", "고귀한 보라색 빛", "pure-korean", "female", "soft", 81),
        new("라온별", "즐거운 별", "pure-korean", "female", "soft", 80),
        new("별빛결", "별빛의 고운 결", "pure-korean", "female", "soft", 82),
        new("물빛결", "맑은 물빛의 결", "pure-korean", "female", "soft", 80),

        // ── 순우리말 3글자 (중성/중립) ──
        new("가온빛", "가운데의 빛, 중심이 되는 빛", "pure-korean", "neutral", "neutral", 85),
        new("하늘빛", "하늘의 푸른 빛", "pure-korean", "neutral", "neutral", 86),
        new("가람빛", "강(가람)의 빛", "pure-korean", "neutral", "neutral", 82),
        new("나루빛", "나루터의 빛", "pure-korean", "neutral", "neutral", 80),
        new("누리빛", "온 세상의 빛", "pure-korean", "neutral", "neutral", 83),
        new("해오름", "해가 떠오르다", "pure-korean", "neutral", "neutral", 85),
        new("비나리", "빌다, 축복하다", "pure-korean", "neutral", "neutral", 82),
        new("다온결", "좋은 일이 다 오는 결", "pure-korean", "neutral", "neutral", 83),
        new("가온결", "가운데의 결, 중심의 결", "pure-korean", "neutral", "neutral", 84),
        new("한결빛", "한결같은 빛", "pure-korean", "neutral", "neutral", 82),
        new("하루빛", "소중한 하루의 빛", "pure-korean", "neutral", "neutral", 81),
        new("라온빛", "즐거운 빛", "pure-korean", "neutral", "neutral", 80),

        // ── 순우리말 3글자 (남성/강인함) ──
        new("한울빛", "큰 하늘의 빛", "pure-korean", "male", "strong", 84),
        new("바다솔", "바다의 소나무", "pure-korean", "male", "strong", 83),
        new("솔바람", "소나무 사이 바람", "pure-korean", "male", "strong", 85),
        new("마루빛", "꼭대기의 빛", "pure-korean", "male", "strong", 82),
        new("세찬빛", "세차고 힘찬 빛", "pure-korean", "male", "strong", 83),
        new("한빛솔", "큰 빛의 소나무", "pure-korean", "male", "strong", 81),
        new("미르빛", "용의 빛", "pure-korean", "male", "strong", 82),
        new("새벽별", "새벽의 별", "pure-korean", "neutral", "strong", 84),
        new("달빛솔", "달빛 아래 소나무", "pure-korean", "neutral", "neutral", 83),
        new("별빛솔", "별빛 아래 소나무", "pure-korean", "neutral", "neutral", 82),
        new("솔빛결", "소나무빛의 결", "pure-korean", "neutral", "neutral", 81),
        new("하늘솔", "하늘의 소나무", "pure-korean", "neutral", "strong", 83),
        new("바다별", "바다의 별", "pure-korean", "neutral", "strong", 82),
        new("풀빛결", "풀빛의 결", "pure-korean", "neutral", "soft", 79),
        new("하늘결", "하늘의 결", "pure-korean", "neutral", "soft", 83),
        new("달빛결", "달빛의 결", "pure-korean", "neutral", "soft", 82),
        new("가을빛", "가을의 빛", "pure-korean", "neutral", "soft", 83),
        new("봄빛솔", "봄빛의 소나무", "pure-korean", "neutral", "neutral", 80),
        new("가을솔", "가을의 소나무", "pure-korean", "neutral", "neutral", 80),
        new("나래솔", "날개의 소나무", "pure-korean", "neutral", "neutral", 81),

        // ── 한자 기반 3글자 (여성/부드러움) ──
        new("서연빈", "고운 연꽃의 빛", "hanja", "female", "soft", 84),
        new("하연주", "하늘 연꽃의 구슬", "hanja", "female", "soft", 83),
        new("지연서", "연못 연꽃의 서리", "hanja", "female", "soft", 82),
        new("예원빈", "예쁜 동산의 빛", "hanja", "female", "soft", 83),
        new("채연서", "빛깔 연꽃의 서광", "hanja", "female", "soft", 82),
        new("다인서", "많은 인연의 서광", "hanja", "female", "soft", 81),
        new("하윤서", "하늘 빛남의 서광", "hanja", "female", "soft", 84),
        new("예서윤", "예쁘고 빛나는 윤기", "hanja", "female", "soft", 83),
        new("수빈아", "맑은 빛의 아이", "hanja", "female", "soft", 82),
        new("소윤빈", "맑은 윤기의 빛", "hanja", "female", "soft", 81),
        new("나윤서", "나아가는 윤기 서광", "hanja", "female", "soft", 80),
        new("채윤서", "화사한 윤기 서광", "hanja", "female", "soft", 82),

        // ── 한자 기반 3글자 (남성/강인함) ──
        new("도현우", "도를 깨달은 현명한 씩씩함", "hanja", "male", "strong", 84),
        new("민서준", "영민한 서광의 준수함", "hanja", "male", "strong", 83),
        new("서현우", "서린 현명한 씩씩함", "hanja", "male", "strong", 82),
        new("민준서", "영민하고 준수한 서광", "hanja", "male", "strong", 83),
        new("도윤서", "도를 닦고 빛나는 서광", "hanja", "male", "strong", 82),
        new("지호연", "지혜와 호연지기의 인연", "hanja", "male", "strong", 81),
        new("현우진", "현명하고 씩씩한 진취력", "hanja", "male", "strong", 83),
        new("도준혁", "도를 닦은 준수한 혁신", "hanja", "male", "strong", 82),
        new("서준호", "서린 준수한 호연지기", "hanja", "male", "strong", 81),
        new("민호준", "영민한 호연지기 준수함", "hanja", "male", "strong", 80),

        // ── 한자 기반 3글자 (중성) ──
        new("민지혜", "영민한 지혜", "hanja", "neutral", "neutral", 83),
        new("하연서", "하늘 연꽃 서광", "hanja", "neutral", "neutral", 82),
        new("도하윤", "도를 닦은 하늘 윤기", "hanja", "neutral", "neutral", 81),
        new("서윤하", "서린 윤기 하늘", "hanja", "neutral", "neutral", 82),
        new("시우연", "시작하는 비의 인연", "hanja", "neutral", "neutral", 80),
        new("윤서하", "빛나는 서광 하늘", "hanja", "neutral", "neutral", 81),

        // ── 혼합형 3글자 ──
        new("하늘빈", "하늘의 빛(빈)", "mixed", "neutral", "soft", 82),
        new("별빛윤", "별빛의 윤기", "mixed", "neutral", "soft", 81),
        new("솔빛준", "소나무빛의 준수함", "mixed", "male", "strong", 80),
        new("가온서", "가운데의 서광", "mixed", "neutral", "neutral", 82),
        new("나래윤", "날개의 빛남", "mixed", "neutral", "soft", 81),
        new("다솜서", "사랑의 서광", "mixed", "female", "soft", 80),
        new("마루준", "꼭대기의 준수함", "mixed", "male", "strong", 81),
        new("이슬윤", "이슬의 윤기", "mixed", "female", "soft", 82),
        new("누리서", "세상의 서광", "mixed", "neutral", "neutral", 80),
        new("바람준", "바람의 준수함", "mixed", "male", "strong", 80),
    };
    */

    public async Task<List<ThreeSyllableCandidate>> GenerateCandidatesAsync(
        string lastName,
        string gender,
        string tone,
        string nameType,
        int count)
    {
        // count 범위 보정
        count = Math.Clamp(count, 1, 50);

        var candidates = new List<ThreeSyllableCandidate>();
        var seen = new HashSet<string>();

        // 1단계: 큐레이션 DB에서 조건 맞는 이름 우선 선택
        var curatedCandidates = GetCuratedCandidates(lastName, gender, tone, nameType);
        foreach (var c in curatedCandidates)
        {
            if (!seen.Contains(c.Name))
            {
                seen.Add(c.Name);
                candidates.Add(c);
            }
        }

        // 2단계: 부족하면 기존 모프 조합으로 보충
        if (candidates.Count < count)
        {
            List<ThreeSyllableCandidate> morphCandidates;
            switch (nameType.ToLower())
            {
                case "pure-korean":
                    morphCandidates = GeneratePureKoreanCandidates(lastName, gender, tone);
                    break;
                case "hanja":
                    morphCandidates = GenerateHanjaCandidates(lastName, gender, tone);
                    break;
                case "mixed":
                    morphCandidates = GenerateMixedCandidates(lastName, gender, tone);
                    break;
                default:
                    morphCandidates = GeneratePureKoreanCandidates(lastName, gender, tone);
                    break;
            }

            foreach (var c in morphCandidates)
            {
                if (!seen.Contains(c.Name))
                {
                    seen.Add(c.Name);
                    candidates.Add(c);
                }
            }
        }

        // 금칙어/부정적 발음 필터링
        candidates = candidates
            .Where(c => !ContainsForbiddenWord(c.Name))
            .Where(c => !ContainsCollisionWord(c.Name))
            .ToList();

        // 음운 하드필터 (2026-04-21 옵션 C Phase 2):
        // 존재 불가 이름(박가/밥보/맛다류 동일자음 중복)만 배제.
        // 경음화/비음화/격음화 등 자연 변동은 통과.
        candidates = candidates
            .Where(c => !KoreanUtils.IsPhonologicallyBlocked(c.FullName))
            .ToList();

        // 형태소 부정연상 하드필터 (2026-04-21 옵션 C Phase 3):
        // "허하X", "박하X", "안돼X" 등 성+이름이 명백한 부정 의미 단어를 형성하면 배제.
        // 기존 AestheticEngine이 감점 처리하던 걸 ThreeSyllableEngine도 사전 필터로 공유.
        // DetectNegativePatterns가 "성명조합_부정연상:" 접두사로 반환하는 결과만 차단 대상.
        candidates = candidates
            .Where(c => !HasSurnameNameNegativeAssociation(c.FullName))
            .ToList();

        // gender/tone 보너스를 발음 점수에 가산하여 정렬
        var normalizedGender = (gender ?? "none").ToLower();
        var normalizedTone = (tone ?? "neutral").ToLower();
        foreach (var c in candidates)
        {
            c.PronunciationScore += CalculateGenderToneBonus(
                c.GenderTag, c.ToneTag, normalizedGender, normalizedTone);
            c.PronunciationScore = Math.Min(c.PronunciationScore, 100);
        }

        // 발음 점수 내림차순 정렬 후 상위 count개 선택
        var top = candidates
            .OrderByDescending(c => c.PronunciationScore)
            .Take(count)
            .ToList();

        // 음운 특성 노트 부착 (감점 없음, Explanation 용도):
        // 상위 후보에만 생성해서 불필요한 연산 절감.
        foreach (var c in top)
        {
            c.PhonologyNotes = KoreanUtils.DescribePhonology(c.FullName);
        }

        return await Task.FromResult(top);
    }

    /// <summary>
    /// 큐레이션 DB에서 조건에 맞는 이름을 선택하여 ThreeSyllableCandidate로 변환
    /// </summary>
    private List<ThreeSyllableCandidate> GetCuratedCandidates(
        string lastName, string gender, string tone, string nameType)
    {
        var normalizedType = nameType.ToLower();
        var results = new List<ThreeSyllableCandidate>();

        var filtered = _curatedNames.Where(c =>
        {
            // 이름 타입 필터 (default -> pure-korean)
            var targetType = normalizedType;
            if (targetType != "pure-korean" && targetType != "hanja" && targetType != "mixed")
                targetType = "pure-korean";

            if (c.NameType != targetType) return false;

            // 성별 필터
            if (gender == "male" && c.Gender == "female") return false;
            if (gender == "female" && c.Gender == "male") return false;

            // 톤 필터
            if (tone == "soft" && c.Tone == "strong") return false;
            if (tone == "strong" && c.Tone == "soft") return false;

            // 3글자인지 확인
            if (c.Name.Length != 3) return false;

            return true;
        });

        foreach (var curated in filtered)
        {
            var fullName = lastName + curated.Name;
            var pronScore = EvaluateFourSyllablePronunciation(lastName, curated.Name);

            if (pronScore < 30) continue; // 발음이 어색하면 제외

            // 큐레이션 이름은 가산 적용 — 발음 평가가 주, 큐레이션 보너스가 보조
            // (Math.Max로 강제 끌어올리면 변별력 잃어 점수가 한 곳에 몰림)
            var curatedBonus = Math.Max(0, (curated.BaseScore - 70) * 0.4);
            var adjustedScore = pronScore + curatedBonus;

            // 큐레이션 이름의 Components: prefix(2글자) + suffix(1글자) 또는 한자 3글자 형태
            var components = BuildCuratedComponents(curated);

            results.Add(new ThreeSyllableCandidate
            {
                Name = curated.Name,
                FullName = fullName,
                Meaning = curated.Meaning,
                NameType = curated.NameType,
                Components = components,
                PronunciationScore = adjustedScore,
                GenderTag = curated.Gender,
                ToneTag = curated.Tone
            });
        }

        return results;
    }

    /// <summary>
    /// 큐레이션 이름의 Components 생성
    /// hanja 타입: 1글자씩 3개 / pure-korean, mixed: prefix(2) + suffix(1)
    /// </summary>
    private static List<string> BuildCuratedComponents(CuratedThreeSyllableEntry curated)
    {
        if (curated.NameType == "hanja")
        {
            // 한자 3글자: 각 글자를 독립 요소로
            return new List<string>
            {
                curated.Name[0].ToString(),
                curated.Name[1].ToString(),
                curated.Name[2].ToString()
            };
        }

        // pure-korean / mixed: prefix(2) + suffix(1)
        return new List<string>
        {
            curated.Name[..2],
            curated.Name[2..],
        };
    }

    /// <summary>
    /// 순우리말 모프 폴백 감점 (Step 3, 2026-04-21).
    /// 기계적 prefix+suffix 조합("허다소결")이 큐레이션(BaseScore~80)을 이기지 못하도록
    /// 발음 점수에서 차감. 단, 발음 자체가 매우 좋은 조합은 감점 후에도 충분히 경쟁력 유지.
    /// </summary>
    private const double PureKoreanFallbackPenalty = 15.0;

    /// <summary>
    /// 혼합형 폴백 감점 — 순수 조합이라 신뢰도가 낮아 pure-korean과 유사하게 감점.
    /// </summary>
    private const double MixedFallbackPenalty = 12.0;

    /// <summary>
    /// 순우리말 3글자 생성: prefix(2음절) + suffix(1음절)
    /// 큐레이션 DB에 없는 조합은 기계적 폴백이므로 <see cref="PureKoreanFallbackPenalty"/> 감점.
    /// </summary>
    private List<ThreeSyllableCandidate> GeneratePureKoreanCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<ThreeSyllableCandidate>();
        var seen = new HashSet<string>();

        var filteredPrefixes = FilterMorphemes(_prefixes, gender, tone);
        var filteredSuffixes = FilterMorphemes(_suffixes, gender, tone);

        foreach (var prefix in filteredPrefixes)
        {
            foreach (var suffix in filteredSuffixes)
            {
                var name = prefix.Text + suffix.Text;
                if (name.Length != 3) continue;
                if (seen.Contains(name)) continue;
                seen.Add(name);

                var fullName = lastName + name;
                var pronScore = EvaluateFourSyllablePronunciation(lastName, name);

                if (pronScore < 30) continue; // 발음이 너무 어색하면 제외

                // 폴백 감점 적용 — 큐레이션보다 아래로 내림
                var adjustedScore = Math.Max(pronScore - PureKoreanFallbackPenalty, 25.0);

                results.Add(new ThreeSyllableCandidate
                {
                    Name = name,
                    FullName = fullName,
                    Meaning = $"{prefix.Meaning} + {suffix.Meaning}",
                    NameType = "pure-korean",
                    Components = new List<string> { prefix.Text, suffix.Text },
                    PronunciationScore = adjustedScore,
                    GenderTag = ResolveCombinedGender(prefix.Gender, suffix.Gender),
                    ToneTag = ResolveCombinedTone(prefix.Tone, suffix.Tone)
                });
            }
        }

        return results;
    }

    /// <summary>
    /// 한자 3글자 생성: Core Dataset(Core_v1) 티어 기반 결정론적 조합.
    /// 2026-04 B-2 후속 옵션 B Step 2 — 랜덤 샘플링 제거, NamePoolEngine과 같은 패턴.
    /// Tier1: Core_v1 × Core_v1 × Core_v1 (검수 완료)
    /// Tier2: Core × Tier2(대법원+CJK Basic) 폴백
    /// </summary>
    private List<ThreeSyllableCandidate> GenerateHanjaCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<ThreeSyllableCandidate>();
        var seen = new HashSet<string>();

        // 1음절 Reading 한자만 (3한자=3음절 이름)
        var allHanja = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1)
            .ToList();

        // 성별/톤 필터
        allHanja = FilterHanjaByGenderTone(allHanja, gender, tone);

        // ── Tier 1: Core Dataset v1 (검수 완료) ─────────────────────────
        var coreHanja = allHanja.Where(h => h.Source == "Core_v1").ToList();
        var natureCore  = SortByQuality(coreHanja.Where(h => h.Category == "자연").ToList());
        var virtueCore  = SortByQuality(coreHanja.Where(h => h.Category == "덕목").ToList());
        var conceptCore = SortByQuality(coreHanja.Where(h => h.Category == "개념").ToList());
        var otherCore   = SortByQuality(coreHanja.Where(h =>
            h.Category == "기타" || string.IsNullOrEmpty(h.Category)).ToList());

        // ── Tier 2: 대법원 등재 + CJK Basic + 뜻 있음 (Core 외 보충) ─────
        var tier2 = allHanja.Where(h =>
            h.Source != "Core_v1" &&
            h.IsGovernmentListed &&
            HanjaData.IsInCjkBasicRange(h.Character) &&
            !string.IsNullOrEmpty(h.Meaning)).ToList();

        var natureTier2  = SortByQuality(tier2.Where(h => h.Category == "자연").ToList());
        var virtueTier2  = SortByQuality(tier2.Where(h => h.Category == "덕목").ToList());
        var conceptTier2 = SortByQuality(tier2.Where(h => h.Category == "개념").ToList());

        // ── 1순위: Core × Core × Core 조합 ───────────────────────────────
        GenerateThreeHanjaCombos(natureCore,  virtueCore,  conceptCore, lastName, results, seen, maxPerList: 10);
        GenerateThreeHanjaCombos(virtueCore,  conceptCore, natureCore,  lastName, results, seen, maxPerList: 10);
        GenerateThreeHanjaCombos(conceptCore, natureCore,  virtueCore,  lastName, results, seen, maxPerList: 10);
        GenerateThreeHanjaCombos(natureCore,  natureCore,  virtueCore,  lastName, results, seen, maxPerList: 8);
        GenerateThreeHanjaCombos(virtueCore,  virtueCore,  conceptCore, lastName, results, seen, maxPerList: 8);

        // Core "기타"도 검수 완료자이므로 허용 (NamePoolEngine과 동일 정책)
        if (results.Count < 80)
        {
            GenerateThreeHanjaCombos(natureCore, virtueCore,  otherCore, lastName, results, seen, maxPerList: 8);
            GenerateThreeHanjaCombos(natureCore, otherCore,   virtueCore, lastName, results, seen, maxPerList: 6);
        }

        // ── 2순위: Core × Tier2 (Core 풀이 모자랄 때 보충) ───────────────
        if (results.Count < 50)
        {
            GenerateThreeHanjaCombos(natureCore, virtueCore, conceptTier2, lastName, results, seen, maxPerList: 6);
            GenerateThreeHanjaCombos(virtueCore, natureCore, virtueTier2,  lastName, results, seen, maxPerList: 6);
            GenerateThreeHanjaCombos(natureCore, virtueTier2, conceptCore, lastName, results, seen, maxPerList: 6);
        }

        // ── 3순위: Tier2 × Tier2 × Tier2 폴백 (매우 드물게 발동) ────────
        if (results.Count < 20)
        {
            GenerateThreeHanjaCombos(natureTier2, virtueTier2, conceptTier2, lastName, results, seen, maxPerList: 6);
        }

        return results;
    }

    /// <summary>
    /// 3한자 조합 생성 헬퍼. 품질 순 리스트에서 상위 maxPerList개씩 전수 조합.
    /// 같은 한자 중복 배제, 발음 점수 30 미만 제외, seen HashSet으로 중복 방지.
    /// </summary>
    private void GenerateThreeHanjaCombos(
        List<HanjaData.HanjaInfo> list1,
        List<HanjaData.HanjaInfo> list2,
        List<HanjaData.HanjaInfo> list3,
        string lastName,
        List<ThreeSyllableCandidate> results,
        HashSet<string> seen,
        int maxPerList)
    {
        if (list1.Count == 0 || list2.Count == 0 || list3.Count == 0) return;

        foreach (var h1 in list1.Take(maxPerList))
        {
            foreach (var h2 in list2.Take(maxPerList))
            {
                if (h1 == h2) continue;

                foreach (var h3 in list3.Take(maxPerList))
                {
                    if (h3 == h1 || h3 == h2) continue;

                    var name = h1.Reading + h2.Reading + h3.Reading;
                    if (name.Length != 3) continue;
                    if (seen.Contains(name)) continue;
                    seen.Add(name);

                    var pronScore = EvaluateFourSyllablePronunciation(lastName, name);
                    if (pronScore < 30) continue;

                    results.Add(new ThreeSyllableCandidate
                    {
                        Name = name,
                        FullName = lastName + name,
                        Meaning = BuildHanjaMeaning(h1, h2, h3),
                        NameType = "hanja",
                        Components = new List<string>
                        {
                            $"{h1.Character}({h1.Reading})",
                            $"{h2.Character}({h2.Reading})",
                            $"{h3.Character}({h3.Reading})"
                        },
                        PronunciationScore = pronScore,
                        GenderTag = ResolveHanjaGender(h1, h2, h3),
                        ToneTag = ResolveHanjaTone(h1, h2, h3)
                    });
                }
            }
        }
    }

    /// <summary>
    /// 한자 목록을 관련성 점수 내림차순 + Character Ordinal(동점시) 정렬.
    /// NamePoolEngine의 SortByQuality와 동일 로직. Core_v1/S등급 가점 자동 반영.
    /// </summary>
    private static List<HanjaData.HanjaInfo> SortByQuality(List<HanjaData.HanjaInfo> list)
    {
        return list
            .Where(h => !string.IsNullOrEmpty(h.Reading))
            .OrderByDescending(HanjaData.CalculateRelevanceScore)
            .ThenBy(h => h.Character, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// 혼합형: 순우리말 prefix + 한자 suffix 또는 한자 prefix + 순우리말 suffix.
    /// Step 3 (2026-04-21): 결정론화 — OrderBy(Guid.NewGuid()) + Random 제거,
    /// SortByQuality 기반 상위 N개 한자로 전수 조합. 폴백 감점 <see cref="MixedFallbackPenalty"/> 적용.
    /// </summary>
    private List<ThreeSyllableCandidate> GenerateMixedCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<ThreeSyllableCandidate>();
        var seen = new HashSet<string>();

        var filteredPrefixes = FilterMorphemes(_prefixes, gender, tone);
        var filteredSuffixes = FilterMorphemes(_suffixes, gender, tone);

        var hanjaList = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1)
            .ToList();
        hanjaList = FilterHanjaByGenderTone(hanjaList, gender, tone);

        // 결정론적 정렬: Core_v1/S등급/대법원 가점 순, 동점은 Character Ordinal
        var meaningfulHanja = SortByQuality(
            hanjaList.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList())
            .Take(60)
            .ToList();

        // 패턴 1: 순우리말 prefix(2) + 한자 suffix(1)
        foreach (var prefix in filteredPrefixes)
        {
            foreach (var hanja in meaningfulHanja)
            {
                var name = prefix.Text + hanja.Reading;
                if (name.Length != 3) continue;
                if (seen.Contains(name)) continue;
                seen.Add(name);

                var fullName = lastName + name;
                var pronScore = EvaluateFourSyllablePronunciation(lastName, name);
                if (pronScore < 30) continue;

                var adjustedScore = Math.Max(pronScore - MixedFallbackPenalty, 28.0);

                results.Add(new ThreeSyllableCandidate
                {
                    Name = name,
                    FullName = fullName,
                    Meaning = $"{prefix.Meaning} + {hanja.Meaning ?? hanja.Reading}",
                    NameType = "mixed",
                    Components = new List<string> { prefix.Text, $"{hanja.Character}({hanja.Reading})" },
                    PronunciationScore = adjustedScore,
                    GenderTag = prefix.Gender,
                    ToneTag = prefix.Tone
                });
            }
        }

        // 패턴 2: 한자 2글자 prefix + 순우리말 suffix(1) — 결정론적 상위 조합
        // 상위 품질 한자만 쓰도록 Take(20) × Take(20)으로 제한 (최대 400 조합 × suffix)
        var topHanjaForPrefix = meaningfulHanja.Take(20).ToList();
        foreach (var h1 in topHanjaForPrefix)
        {
            foreach (var h2 in topHanjaForPrefix)
            {
                if (h1 == h2) continue;

                var hanjaPrefix = h1.Reading + h2.Reading;
                if (hanjaPrefix.Length != 2) continue;

                foreach (var suffix in filteredSuffixes)
                {
                    var name = hanjaPrefix + suffix.Text;
                    if (name.Length != 3) continue;
                    if (seen.Contains(name)) continue;
                    seen.Add(name);

                    var fullName = lastName + name;
                    var pronScore = EvaluateFourSyllablePronunciation(lastName, name);
                    if (pronScore < 30) continue;

                    var adjustedScore = Math.Max(pronScore - MixedFallbackPenalty, 28.0);

                    results.Add(new ThreeSyllableCandidate
                    {
                        Name = name,
                        FullName = fullName,
                        Meaning = $"{h1.Meaning ?? h1.Reading} + {h2.Meaning ?? h2.Reading} + {suffix.Meaning}",
                        NameType = "mixed",
                        Components = new List<string>
                        {
                            $"{h1.Character}({h1.Reading})",
                            $"{h2.Character}({h2.Reading})",
                            suffix.Text
                        },
                        PronunciationScore = adjustedScore,
                        GenderTag = suffix.Gender,
                        ToneTag = suffix.Tone
                    });

                    if (results.Count >= 300) return results;
                }
            }
        }

        return results;
    }

    /// <summary>
    /// 4음절(성+이름3) 발음 조화 평가
    /// 보편 작명 원리(NamingPrinciples) + 3글자 특화(받침 개수, 파열음 연속) 결합.
    /// </summary>
    private double EvaluateFourSyllablePronunciation(string lastName, string name)
    {
        if (string.IsNullOrEmpty(lastName) || name.Length < 3) return 60.0;

        var fullName = lastName + name;
        double score = 0;

        // 보편 원리 — 성씨 연음 (0~25)
        score += NamingPrinciples.EvalSurnameFlow(lastName, name) * 25;

        // 보편 원리 — 이름 첫-둘째 글자 페어 (0~12)
        var r1 = name[0].ToString();
        var r2 = name[1].ToString();
        var r3 = name[2].ToString();
        score += NamingPrinciples.EvalRhythm(r1, r2) * 12;

        // 보편 원리 — 초성 다양성: 3 페어 평균 (0~12)
        double initDiv = (
            NamingPrinciples.EvalInitialDiversity(r1, r2)
            + NamingPrinciples.EvalInitialDiversity(r2, r3)
            + NamingPrinciples.EvalInitialDiversity(r1, r3)
        ) / 3.0;
        score += initDiv * 12;

        // 보편 원리 — 음령오행 상생: 첫-둘째 글자 (0~8)
        score += NamingPrinciples.EvalOhaengSynergy(r1, r2) * 8;

        // 3글자 특화 — 받침 개수 (4음절 중 받침 2개 이하가 이상적, 최대 +8)
        var finalCount = KoreanUtils.CountFinalConsonants(fullName);
        if (finalCount <= 1) score += 8;
        else if (finalCount == 2) score += 4;
        else if (finalCount >= 3) score -= (finalCount - 2) * 5;

        // 3글자 특화 — 강한 파열음 연속 패널티
        if (KoreanUtils.HasConsecutiveStrongPlosives(fullName)) score -= 10;

        // 동일 자음 반복 패널티
        if (KoreanUtils.HasSameConsonantRepetition(fullName)) score -= 8;

        score += 15; // 기본 보정 (이전 25 → 15로 축소)

        return Math.Max(0, Math.Min(100, score));
    }

    /// <summary>
    /// 성별/톤 기준으로 모프 조각 필터링
    /// </summary>
    private List<MorphemeEntry> FilterMorphemes(
        List<MorphemeEntry> morphemes, string gender, string tone)
    {
        return morphemes.Where(m =>
        {
            // 성별 필터
            if (gender == "male" && m.Gender == "female") return false;
            if (gender == "female" && m.Gender == "male") return false;

            // 톤 필터
            if (tone == "soft" && m.Tone == "strong") return false;
            if (tone == "strong" && m.Tone == "soft") return false;

            return true;
        }).ToList();
    }

    /// <summary>
    /// 한자 성별/톤 필터링
    /// </summary>
    private List<HanjaData.HanjaInfo> FilterHanjaByGenderTone(
        List<HanjaData.HanjaInfo> hanjaList, string gender, string tone)
    {
        return hanjaList.Where(h =>
        {
            if (gender == "male" && h.GenderPref == HanjaData.GenderPreference.Female) return false;
            if (gender == "female" && h.GenderPref == HanjaData.GenderPreference.Male) return false;
            if (tone == "soft" && h.TonePref == HanjaData.TonePreference.Strong) return false;
            if (tone == "strong" && h.TonePref == HanjaData.TonePreference.Soft) return false;
            return true;
        }).ToList();
    }

    /// <summary>
    /// 한자 3글자 의미 조합
    /// </summary>
    private string BuildHanjaMeaning(
        HanjaData.HanjaInfo h1,
        HanjaData.HanjaInfo h2,
        HanjaData.HanjaInfo h3)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(h1.Meaning)) parts.Add($"{h1.Character}({h1.Meaning})");
        else parts.Add($"{h1.Character}({h1.Reading})");

        if (!string.IsNullOrEmpty(h2.Meaning)) parts.Add($"{h2.Character}({h2.Meaning})");
        else parts.Add($"{h2.Character}({h2.Reading})");

        if (!string.IsNullOrEmpty(h3.Meaning)) parts.Add($"{h3.Character}({h3.Meaning})");
        else parts.Add($"{h3.Character}({h3.Reading})");

        return string.Join(" + ", parts);
    }

    /// <summary>
    /// prefix와 suffix의 성별 태그를 합산하여 최종 성별 결정
    /// 둘 다 neutral이면 neutral, 하나라도 specific이면 그 값 사용
    /// </summary>
    private static string ResolveCombinedGender(string g1, string g2)
    {
        if (g1 != "neutral") return g1;
        return g2;
    }

    /// <summary>
    /// prefix와 suffix의 톤 태그를 합산하여 최종 톤 결정
    /// </summary>
    private static string ResolveCombinedTone(string t1, string t2)
    {
        if (t1 != "neutral") return t1;
        return t2;
    }

    /// <summary>
    /// 한자 3글자의 GenderPref를 종합하여 gender 태그 결정
    /// </summary>
    private static string ResolveHanjaGender(
        HanjaData.HanjaInfo h1, HanjaData.HanjaInfo h2, HanjaData.HanjaInfo h3)
    {
        int maleCount = 0, femaleCount = 0;
        foreach (var h in new[] { h1, h2, h3 })
        {
            if (h.GenderPref == HanjaData.GenderPreference.Male) maleCount++;
            else if (h.GenderPref == HanjaData.GenderPreference.Female) femaleCount++;
        }
        if (maleCount > femaleCount) return "male";
        if (femaleCount > maleCount) return "female";
        return "neutral";
    }

    /// <summary>
    /// 한자 3글자의 TonePref를 종합하여 tone 태그 결정
    /// </summary>
    private static string ResolveHanjaTone(
        HanjaData.HanjaInfo h1, HanjaData.HanjaInfo h2, HanjaData.HanjaInfo h3)
    {
        int softCount = 0, strongCount = 0;
        foreach (var h in new[] { h1, h2, h3 })
        {
            if (h.TonePref == HanjaData.TonePreference.Soft) softCount++;
            else if (h.TonePref == HanjaData.TonePreference.Strong) strongCount++;
        }
        if (softCount > strongCount) return "soft";
        if (strongCount > softCount) return "strong";
        return "neutral";
    }

    /// <summary>
    /// gender/tone 정확 매칭 시 보너스 점수 부여 (neutral 제외)
    /// </summary>
    private static double CalculateGenderToneBonus(
        string entryGender, string entryTone,
        string requestedGender, string requestedTone)
    {
        double bonus = 0;

        // gender 정확 매칭 보너스
        if (requestedGender != "none" && entryGender == requestedGender)
            bonus += 7;

        // tone 정확 매칭 보너스
        if (requestedTone != "neutral" && entryTone == requestedTone)
            bonus += 5;

        return bonus;
    }

    /// <summary>
    /// 금칙어 포함 체크
    /// </summary>
    private bool ContainsForbiddenWord(string name)
    {
        foreach (var word in _forbiddenWords)
        {
            if (name.Contains(word)) return true;
        }
        return false;
    }

    /// <summary>
    /// 생활어 충돌 체크
    /// </summary>
    private bool ContainsCollisionWord(string name)
    {
        foreach (var word in _collisionWords)
        {
            if (name.Contains(word) || word.Contains(name)) return true;
        }
        return false;
    }

    /// <summary>
    /// 성+이름이 명백한 부정 의미 단어를 형성하는지 체크.
    /// MorphemeAnalyzer.DetectNegativePatterns의 "성명조합_부정연상:" 결과만 필터링 대상.
    /// 나머지(동사/형용사_형태, 부정적_형태소_조합)는 AestheticEngine 감점으로 위임.
    /// 2026-04-21 옵션 C Phase 3.
    /// </summary>
    private static bool HasSurnameNameNegativeAssociation(string fullName)
    {
        if (string.IsNullOrEmpty(fullName)) return false;

        var patterns = MorphemeAnalyzer.DetectNegativePatterns(fullName);
        foreach (var p in patterns)
        {
            if (p.StartsWith("성명조합_부정연상:"))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// 순우리말 모프 조각 데이터 클래스
    /// </summary>
    private class MorphemeEntry
    {
        public string Text { get; }
        public string Meaning { get; }
        public string Gender { get; } // male, female, neutral
        public string Tone { get; }   // soft, strong, neutral

        public MorphemeEntry(string text, string meaning, string gender, string tone)
        {
            Text = text;
            Meaning = meaning;
            Gender = gender;
            Tone = tone;
        }
    }

    // CuratedThreeSyllableName 내부 클래스는 삭제됨.
    // 이제 Data.CuratedThreeSyllableEntry (three-syllable-curated.json 로더)를 사용.
}
