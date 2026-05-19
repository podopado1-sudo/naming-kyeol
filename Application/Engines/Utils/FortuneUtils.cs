namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 사주/운세 계산 유틸리티
/// </summary>
public static class FortuneUtils
{
    /// <summary>
    /// 간지 계산 (간단한 버전)
    /// </summary>
    public static (string heavenlyStem, string earthlyBranch) GetGanZhi(DateTime birthDate)
    {
        // 간지 계산 (간단한 버전, 실제로는 더 정교한 계산 필요)
        int year = birthDate.Year;
        int month = birthDate.Month;
        int day = birthDate.Day;

        // 간지 배열
        string[] heavenlyStems = { "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸" };
        string[] earthlyBranches = { "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥" };

        // 간단한 계산 (실제로는 정확한 사주 계산 필요)
        int stemIndex = (year - 4) % 10;
        int branchIndex = (year - 4) % 12;

        return (heavenlyStems[stemIndex], earthlyBranches[branchIndex]);
    }

    /// <summary>
    /// 오행 계산 (간지 기반)
    /// </summary>
    public static Dictionary<string, int> CalculateFiveElements(DateTime birthDate)
    {
        var (heavenlyStem, earthlyBranch) = GetGanZhi(birthDate);

        // 간지별 오행 매핑 (간단한 버전)
        var fiveElements = new Dictionary<string, int>
        {
            { "木", 0 },
            { "火", 0 },
            { "土", 0 },
            { "金", 0 },
            { "水", 0 }
        };

        // 간지별 오행 (실제로는 정확한 매핑 필요)
        var stemElements = new Dictionary<string, string>
        {
            { "甲", "木" }, { "乙", "木" },
            { "丙", "火" }, { "丁", "火" },
            { "戊", "土" }, { "己", "土" },
            { "庚", "金" }, { "辛", "金" },
            { "壬", "水" }, { "癸", "水" }
        };

        var branchElements = new Dictionary<string, string>
        {
            { "寅", "木" }, { "卯", "木" },
            { "巳", "火" }, { "午", "火" },
            { "辰", "土" }, { "戌", "土" }, { "丑", "土" }, { "未", "土" },
            { "申", "金" }, { "酉", "金" },
            { "亥", "水" }, { "子", "水" }
        };

        if (stemElements.TryGetValue(heavenlyStem, out var stemElement))
        {
            fiveElements[stemElement]++;
        }

        if (branchElements.TryGetValue(earthlyBranch, out var branchElement))
        {
            fiveElements[branchElement]++;
        }

        return fiveElements;
    }

    /// <summary>
    /// 부족한 오행 찾기
    /// </summary>
    public static List<string> FindLackingElements(DateTime birthDate)
    {
        var elements = CalculateFiveElements(birthDate);
        var average = elements.Values.Average();
        
        return elements
            .Where(e => e.Value < average)
            .Select(e => e.Key)
            .ToList();
    }

    /// <summary>
    /// 과다한 오행 찾기
    /// </summary>
    public static List<string> FindExcessiveElements(DateTime birthDate)
    {
        var elements = CalculateFiveElements(birthDate);
        var average = elements.Values.Average();
        
        return elements
            .Where(e => e.Value > average * 1.5)
            .Select(e => e.Key)
            .ToList();
    }

    /// <summary>
    /// 자원오행 (획수 기반) 평가
    /// </summary>
    public static int EvaluateStrokeCount(int stroke1, int stroke2)
    {
        // 좋은 획수 조합 (예: 5-12-13, 8-15-16)
        // 불길한 획수 조합 (예: 4-14-19, 9-19-28)
        
        int total = stroke1 + stroke2;
        
        // 불길한 획수
        int[] badStrokes = { 4, 9, 14, 19, 22, 28, 34, 40, 44, 54 };
        if (badStrokes.Contains(total))
        {
            return 30; // 감점
        }

        // 좋은 획수 범위
        if (total >= 5 && total <= 15)
        {
            return 100;
        }
        if (total >= 16 && total <= 25)
        {
            return 80;
        }
        if (total >= 26 && total <= 35)
        {
            return 60;
        }

        return 40;
    }

    /// <summary>
    /// 음양 균형 평가
    /// </summary>
    public static int EvaluateYinYangBalance(int yinCount, int yangCount)
    {
        int total = yinCount + yangCount;
        if (total == 0) return 50;

        double yinRatio = (double)yinCount / total;
        double yangRatio = (double)yangCount / total;

        // 균형 잡힌 경우 (40:60 ~ 60:40)
        if (yinRatio >= 0.4 && yinRatio <= 0.6)
        {
            return 100;
        }

        // 약간 치우친 경우
        if (yinRatio >= 0.3 && yinRatio <= 0.7)
        {
            return 80;
        }

        // 많이 치우친 경우
        return 50;
    }
}
