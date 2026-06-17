namespace NameForm.Application.Engines.Data;

/// <summary>
/// 연대별 유행 이름 데이터베이스
/// 각 이름의 유행 시기(출생연도 범위)를 기록하여 세대 불일치를 감지
/// </summary>
public static class GenerationNameData
{
    /// <summary>
    /// 각 연대별 유행 이름 (peakStart~peakEnd는 해당 이름이 유행한 출생연도 범위)
    /// </summary>
    public static readonly List<GenerationNameEntry> Entries = new()
    {
        // ===== 1945~1960s 세대 (대법원 60년 통계 기반) =====
        // 여성: '자' 접미 전성기, 일본식 작명 잔재
        new("춘자", 1945, 1960, "female"), new("순자", 1950, 1965, "female"),
        new("옥순", 1950, 1965, "female"), new("영희", 1950, 1969, "female"),
        new("정숙", 1955, 1970, "female"), new("영자", 1955, 1970, "female"),
        new("말순", 1945, 1960, "female"), new("복순", 1945, 1960, "female"),
        new("순옥", 1950, 1965, "female"), new("명자", 1950, 1965, "female"),
        new("경자", 1950, 1965, "female"), new("정자", 1945, 1965, "female"),
        new("영숙", 1950, 1970, "female"), new("옥자", 1945, 1960, "female"),
        new("분자", 1945, 1960, "female"), new("금순", 1945, 1960, "female"),
        new("귀순", 1945, 1960, "female"),
        // 남성: '수', '철', '호' 계열
        new("철수", 1950, 1969, "male"), new("영수", 1950, 1969, "male"),
        new("동수", 1950, 1965, "male"), new("영호", 1955, 1970, "male"),
        new("상철", 1955, 1970, "male"), new("영철", 1950, 1965, "male"),
        new("병수", 1950, 1965, "male"), new("길수", 1945, 1960, "male"),
        new("만수", 1945, 1960, "male"), new("정수", 1950, 1965, "male"),
        new("영식", 1950, 1965, "male"), new("영길", 1945, 1960, "male"),
        new("상수", 1945, 1960, "male"), new("기수", 1950, 1965, "male"),

        // ===== 1970s~80s 세대 (대법원 통계: 남 정훈/성호, 여 은주/미숙) =====
        // 여성: '은', '미', '현' 계열
        new("은정", 1975, 1990, "female"), new("미영", 1970, 1985, "female"),
        new("현주", 1975, 1990, "female"), new("수진", 1978, 1995, "female"),
        new("미선", 1970, 1985, "female"), new("은주", 1975, 1988, "female"),
        new("현정", 1975, 1988, "female"), new("미정", 1970, 1985, "female"),
        new("미숙", 1970, 1982, "female"), new("영미", 1970, 1985, "female"),
        new("은숙", 1970, 1985, "female"), new("정미", 1970, 1985, "female"),
        new("경희", 1970, 1985, "female"), new("미라", 1975, 1988, "female"),
        new("은경", 1975, 1990, "female"), new("혜영", 1975, 1990, "female"),
        new("은미", 1970, 1985, "female"), new("미경", 1970, 1985, "female"),
        new("현숙", 1970, 1982, "female"), new("정희", 1970, 1985, "female"),
        // 남성: '훈', '호', '성' 계열
        new("성호", 1975, 1990, "male"), new("민수", 1978, 1995, "male"),
        new("정훈", 1975, 1990, "male"), new("상훈", 1975, 1990, "male"),
        new("영진", 1975, 1990, "male"), new("성민", 1978, 1992, "male"),
        new("재호", 1975, 1990, "male"), new("태훈", 1975, 1990, "male"),
        new("종훈", 1975, 1988, "male"), new("동현", 1978, 1992, "male"),
        new("성진", 1975, 1990, "male"), new("재혁", 1978, 1992, "male"),
        new("민호", 1978, 1995, "male"), new("상민", 1975, 1990, "male"),
        new("진호", 1975, 1990, "male"), new("승호", 1978, 1992, "male"),
        new("재민", 1978, 1995, "male"), new("동훈", 1975, 1990, "male"),

        // ===== 1990s~2000s 세대 (대법원: 남 지훈, 여 유진/민지) =====
        // 남성: '훈', '현', '준' 전환기
        new("지훈", 1990, 2005, "male"), new("현우", 1990, 2008, "male"),
        new("동현", 1990, 2005, "male"), new("성민", 1990, 2005, "male"),
        new("준혁", 1995, 2008, "male"), new("승현", 1995, 2008, "male"),
        new("태현", 1995, 2008, "male"), new("준호", 1990, 2005, "male"),
        new("영재", 1990, 2005, "male"), new("현준", 1995, 2010, "male"),
        new("민성", 2000, 2012, "male"), new("승민", 2000, 2012, "male"),
        // 여성: '지', '유' 계열 전성기
        new("민지", 1990, 2005, "female"), new("유진", 1990, 2008, "female"),
        new("수빈", 1995, 2010, "female"), new("혜진", 1990, 2005, "female"),
        new("보라", 1990, 2005, "female"), new("예진", 1995, 2008, "female"),
        new("지영", 1990, 2005, "female"), new("소영", 1990, 2005, "female"),
        new("지은", 1990, 2005, "female"), new("지혜", 1985, 2000, "female"),
        new("지현", 1990, 2005, "female"), new("수정", 1990, 2005, "female"),

        // ===== 2008~2015 과도기 (네임차트 2010/2015 통계) =====
        // 남성
        new("민준", 2008, 2022, "male"), new("서준", 2010, 2022, "male"),
        new("예준", 2010, 2022, "male"), new("준서", 2008, 2018, "male"),
        new("준우", 2008, 2020, "male"), new("선우", 2010, 2020, "male"),
        new("우진", 2008, 2020, "male"),
        // 여성
        new("서윤", 2010, 2025, "female"), new("서연", 2008, 2020, "female"),
        new("하윤", 2010, 2025, "female"), new("윤서", 2010, 2025, "female"),
        new("민서", 2008, 2018, "female"), new("수현", 2008, 2018, "female"),
        new("지원", 2008, 2015, "female"), new("서현", 2008, 2015, "female"),
        new("지윤", 2008, 2018, "female"), new("채원", 2010, 2022, "female"),
        new("다은", 2008, 2022, "female"), new("은서", 2008, 2018, "female"),

        // ===== 2015~2022 세대 (네임차트 2015/2020 통계) =====
        // 남성
        new("시우", 2010, 2025, "male"), new("하준", 2010, 2025, "male"),
        new("도윤", 2012, 2025, "male"), new("주원", 2008, 2020, "male"),
        new("지호", 2010, 2022, "male"), new("건우", 2010, 2022, "male"),
        new("도현", 2010, 2020, "male"), new("서진", 2010, 2022, "male"),
        new("연우", 2010, 2025, "male"), new("은우", 2018, 2025, "male"),
        new("유준", 2015, 2022, "male"), new("수호", 2015, 2022, "male"),
        new("다온", 2018, 2025, "male"),
        // 여성
        new("지우", 2008, 2022, "female"), new("하은", 2010, 2025, "female"),
        new("지유", 2010, 2022, "female"), new("유주", 2008, 2018, "female"),
        new("하린", 2010, 2025, "female"), new("수아", 2010, 2025, "female"),
        new("지아", 2010, 2025, "female"), new("아린", 2015, 2025, "female"),
        new("아윤", 2018, 2025, "female"), new("소율", 2012, 2020, "female"),
        new("소윤", 2012, 2020, "female"), new("예린", 2010, 2020, "female"),
        new("시윤", 2015, 2022, "female"), new("나은", 2015, 2022, "female"),
        new("예나", 2015, 2022, "female"), new("유나", 2010, 2022, "female"),
        new("지율", 2015, 2022, "female"),

        // ===== 2020~2025 세대 (네임차트 2024, 대법원 2025 통계) =====
        // 남성
        new("이준", 2018, 2030, "male"), new("하율", 2020, 2030, "male"),
        new("이안", 2020, 2030, "male"), new("태오", 2022, 2030, "male"),
        new("로운", 2018, 2028, "male"),
        // 여성
        new("이서", 2020, 2030, "female"), new("서아", 2018, 2030, "female"),
        new("시아", 2020, 2030, "female"), new("지안", 2018, 2030, "female"),
        new("나윤", 2020, 2030, "female"), new("이현", 2022, 2030, "female"),

        // ===== 성별 공통 (여러 시대 걸쳐 사용) =====
        new("지우", 2008, 2025, "male"),  // 남자 지우도 있음
        new("서우", 2018, 2025, "male"),
        new("우주", 2018, 2025, "male"),
        new("지후", 2010, 2022, "male"),
        new("시현", 2010, 2022, "male"),
        new("시후", 2010, 2020, "male"),
        new("윤우", 2018, 2025, "male"),
        new("아인", 2018, 2025, "female"),
        new("이서", 2020, 2030, "male"),  // 남자 이서도 급증
        new("서율", 2015, 2022, "female"),
        new("예원", 2010, 2020, "female"),
        new("예은", 2008, 2018, "female"),
        new("시은", 2012, 2020, "female"),
        new("하율", 2015, 2025, "female"), // 여자 하율도 있음
    };

    // 빠른 조회를 위한 Dictionary (이름 → 엔트리 리스트, 동명이인 대비)
    private static readonly Dictionary<string, List<GenerationNameEntry>> _entryMap;

    static GenerationNameData()
    {
        _entryMap = new Dictionary<string, List<GenerationNameEntry>>();
        foreach (var entry in Entries)
        {
            if (!_entryMap.ContainsKey(entry.Name))
                _entryMap[entry.Name] = new List<GenerationNameEntry>();
            _entryMap[entry.Name].Add(entry);
        }
    }

    /// <summary>
    /// 시대 무관 이름 (어떤 세대가 써도 자연스러운 이름)
    /// 특정 시대에 유행하지 않고 꾸준히 사용되어 온 이름
    /// </summary>
    public static readonly HashSet<string> TimelessNames = new()
    {
        // 남녀 공통 — 특정 세대에 치우치지 않고 꾸준히 사용된 이름
        "정하", "재현", "태호", "성현", "정민", "정호", "동훈",
        "진우", "태민", "재민", "종현", "현수", "상우", "재영",
        "경민", "대현", "용준", "원석", "창민",
        // 여성
        "예진", "소연", "현아", "은지", "수영", "혜원", "나영",
        "선영", "경아", "유정", "연주", "정은", "선희", "인영",
        // 남성
        "영준", "태영", "기현", "상현", "준영", "창수", "광호",
        "병철", "형준", "윤호",
    };

    /// <summary>
    /// 세대 적합도 분석
    /// </summary>
    /// <param name="name">이름 (성 제외)</param>
    /// <param name="birthYear">출생연도</param>
    /// <returns>세대 적합도 결과</returns>
    public static GenerationFitResult AnalyzeGenerationFit(string name, int birthYear)
    {
        // 1. 시대무관이면 바로 "매우 좋음" 반환
        if (TimelessNames.Contains(name))
        {
            return new GenerationFitResult
            {
                FitLevel = "timeless",
                YearGap = 0,
                PeakDecade = null,
                Description = "어떤 세대가 사용해도 자연스러운 이름입니다"
            };
        }

        // 2. 수동 DB(옛 세대)에서 이름 찾기
        if (!_entryMap.TryGetValue(name, out var entries) || entries.Count == 0)
        {
            // 2b. 하이브리드 — 수동 DB에 없으면 2008~2019 실명 인기도로 '현대 유행' 판정.
            //     옛 세대는 수동 DB, 현대 유행은 실명 데이터(NameGenderData)로 보강.
            return AnalyzeModernEraFit(name, birthYear);
        }

        // 가장 가까운 유행 시기를 찾기 (동명이인 중)
        int minGap = int.MaxValue;
        GenerationNameEntry? bestMatch = null;
        bool withinRange = false;

        foreach (var entry in entries)
        {
            if (birthYear >= entry.PeakStart && birthYear <= entry.PeakEnd)
            {
                // 범위 안에 있음
                withinRange = true;
                minGap = 0;
                bestMatch = entry;
                break;
            }

            int gap;
            if (birthYear < entry.PeakStart)
                gap = entry.PeakStart - birthYear;
            else
                gap = birthYear - entry.PeakEnd;

            if (gap < minGap)
            {
                minGap = gap;
                bestMatch = entry;
            }
        }

        if (bestMatch == null)
        {
            return new GenerationFitResult
            {
                FitLevel = "unknown",
                YearGap = 0,
                PeakDecade = null,
                Description = ""
            };
        }

        string peakDecade = GetDecadeLabel(bestMatch.PeakStart, bestMatch.PeakEnd);

        // 3. birthYear가 peakStart~peakEnd 범위에 있으면 "자연스러움"
        if (withinRange)
        {
            return new GenerationFitResult
            {
                FitLevel = "perfect",
                YearGap = 0,
                PeakDecade = peakDecade,
                Description = $"{peakDecade} 유행 이름으로, 출생연도와 잘 맞습니다"
            };
        }

        // 4. 범위를 벗어나면 거리에 따라 불일치 정도 계산
        if (minGap <= 10)
        {
            // 10년 이내: 약한 불일치
            return new GenerationFitResult
            {
                FitLevel = "mild_mismatch",
                YearGap = minGap,
                PeakDecade = peakDecade,
                Description = $"{peakDecade} 유행 이름으로, 약간의 세대 차이가 있습니다"
            };
        }
        else
        {
            // 20년 이상: 강한 불일치 ("개명한 티")
            return new GenerationFitResult
            {
                FitLevel = "strong_mismatch",
                YearGap = minGap,
                PeakDecade = peakDecade,
                Description = $"{peakDecade} 유행 이름으로, {birthYear}년생이 사용 시 개명한 인상을 줄 수 있습니다"
            };
        }
    }

    // 현대(2008+) 유행 판정 임계 — 대법원 2008~2019 실명 등록 합계가 이 이상이면
    // '뚜렷한 현대 유행 이름'으로 본다 (NameGenderData 기반).
    private const int ModernEraStart = 2008;
    private const long ModernPopularThreshold = 5000;

    /// <summary>
    /// 수동 DB에 없는 이름의 현대(2008+) 유행 여부를 실명 빈도로 판정 (하이브리드).
    /// 현대 출생자에겐 적합, 옛 출생자(개명 등)에겐 '개명한 티' 불일치로 본다.
    /// </summary>
    private static GenerationFitResult AnalyzeModernEraFit(string name, int birthYear)
    {
        var counts = NameGenderData.NameCounts(name, minTotal: ModernPopularThreshold);
        if (counts == null)
        {
            // 현대 유행으로 보기엔 표본 부족 → 판단 보류
            return new GenerationFitResult
            {
                FitLevel = "unknown", YearGap = 0, PeakDecade = null, Description = ""
            };
        }

        // 현대(2008+) 출생 → 현대 유행 이름과 자연스럽게 맞음 (신생아 작명은 감점 없음)
        if (birthYear >= ModernEraStart)
        {
            return new GenerationFitResult
            {
                FitLevel = "perfect", YearGap = 0, PeakDecade = "2010년대",
                Description = "2010년대 이후 인기 이름으로, 출생연도와 잘 맞습니다"
            };
        }

        // 옛 출생자가 현대 유행 이름 → 세대 불일치
        int gap = ModernEraStart - birthYear;
        if (gap <= 10)
        {
            return new GenerationFitResult
            {
                FitLevel = "mild_mismatch", YearGap = gap, PeakDecade = "2010년대",
                Description = "2010년대 이후 인기 이름으로, 약간의 세대 차이가 있습니다"
            };
        }
        return new GenerationFitResult
        {
            FitLevel = "strong_mismatch", YearGap = gap, PeakDecade = "2010년대",
            Description = $"2010년대 이후 인기 이름으로, {birthYear}년생이 사용 시 개명한 인상을 줄 수 있습니다"
        };
    }

    /// <summary>
    /// 유행 시기를 연대 레이블로 변환
    /// </summary>
    private static string GetDecadeLabel(int peakStart, int peakEnd)
    {
        int midpoint = (peakStart + peakEnd) / 2;
        int decade = (midpoint / 10) * 10;
        return $"{decade}년대";
    }
}

/// <summary>
/// 연대별 유행 이름 엔트리
/// </summary>
public class GenerationNameEntry
{
    public string Name { get; set; }
    public int PeakStart { get; set; }  // 유행 시작 출생연도
    public int PeakEnd { get; set; }    // 유행 끝 출생연도
    public string Gender { get; set; }

    public GenerationNameEntry(string name, int peakStart, int peakEnd, string gender)
    {
        Name = name;
        PeakStart = peakStart;
        PeakEnd = peakEnd;
        Gender = gender;
    }
}

/// <summary>
/// 세대 적합도 분석 결과
/// </summary>
public class GenerationFitResult
{
    /// <summary>
    /// 적합도: "perfect", "good", "mild_mismatch", "strong_mismatch", "timeless", "unknown"
    /// </summary>
    public string FitLevel { get; set; } = "unknown";

    /// <summary>유행 범위와의 거리 (년)</summary>
    public int YearGap { get; set; }

    /// <summary>유행 연대 레이블 (예: "2010년대")</summary>
    public string? PeakDecade { get; set; }

    /// <summary>설명 문장</summary>
    public string Description { get; set; } = "";
}
