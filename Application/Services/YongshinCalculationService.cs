using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 용신 계산 서비스 — 억부법(抑扶法) + 조후법(調候法) 병행
///
/// 억부법: 일간의 강약을 점수로 계산 → 신강이면 억제, 신약이면 보강
/// 조후법: 출생 월지(月支)의 기후 균형에 따라 필요 오행 결정
/// 최종 용신: 강약 정도가 강할수록 억부 우선, 중화에 가까울수록 조후 우선
/// </summary>
public class YongshinCalculationService : IYongshinCalculationService
{
    // ── 오행 순환 (상생 방향) ─────────────────────────────────────
    // 木→火→土→金→水→木
    // 인덱스: 木=0, 火=1, 土=2, 金=3, 水=4
    private static readonly string[] ElementCycle = ["木", "火", "土", "金", "水"];

    // ── 조후법 테이블 (월지 → 조후 용신) ─────────────────────────
    // 기준: 월지의 계절 기운에 대한 기후 균형 오행
    private static readonly Dictionary<string, string> JohuTable = new()
    {
        ["子"] = "火",  // 동지월 — 극한(極寒), 丙火로 온난
        ["丑"] = "火",  // 소한월 — 한토(寒土), 丙火로 해동
        ["寅"] = "火",  // 입춘월 — 초봄 한기 잔존, 丙火 온난
        ["卯"] = "火",  // 경칩월 — 木旺, 丙火로 설기 균형
        ["辰"] = "木",  // 청명월 — 습토(濕土), 甲木으로 소토
        ["巳"] = "水",  // 입하월 — 火旺 시작, 壬癸水로 제화
        ["午"] = "水",  // 하지월 — 극열(極熱), 壬水 최우선
        ["未"] = "水",  // 소서월 — 조열(燥熱), 壬癸水로 윤택
        ["申"] = "水",  // 입추월 — 金旺, 壬水로 설기
        ["酉"] = "火",  // 백로월 — 金旺極, 丁火로 제금
        ["戌"] = "火",  // 한로월 — 조토(燥土), 丙火로 온난
        ["亥"] = "火",  // 입동월 — 수한(水寒), 丙火로 온난
    };

    // ── 오행 한국어 매핑 ──────────────────────────────────────────
    private static readonly Dictionary<string, string> ElementKorean = new()
    {
        ["木"] = "목(木)", ["火"] = "화(火)", ["土"] = "토(土)",
        ["金"] = "금(金)", ["水"] = "수(水)",
    };

    // ── 십신 명칭 ─────────────────────────────────────────────────
    private static readonly Dictionary<string, string> ShinshinNames = new()
    {
        ["인성"] = "인성(印星)", ["비겁"] = "비겁(比劫)",
        ["식상"] = "식상(食傷)", ["재성"] = "재성(財星)", ["관살"] = "관살(官殺)",
    };

    public YongshinResult Calculate(SajuChart chart)
    {
        // 일간 오행
        var dayMasterChar = chart.DayMaster;          // 예: "乙"
        var dayMasterElem = GetStemElement(dayMasterChar); // 예: "木"

        // ① 억부법 강약 점수
        int strengthScore = CalculateStrengthScore(chart, dayMasterElem);

        // ② 강약 판정
        var strength = strengthScore > 3
            ? DayMasterStrength.Strong
            : strengthScore < -3
                ? DayMasterStrength.Weak
                : DayMasterStrength.Balanced;

        // ③ 억부 용신
        string eokbuYongshin = GetEokbuYongshin(dayMasterElem, strength);

        // ④ 조후 용신
        string? johuYongshin = JohuTable.TryGetValue(chart.MonthPillar.BranchChar, out var johu)
            ? johu
            : null;

        // ⑤ 최종 용신 결정
        // 강약이 클수록 억부 우선, 중화에 가까울수록 조후 우선
        string primaryYongshin = DeterminePrimary(
            strength, strengthScore, eokbuYongshin, johuYongshin);

        // ⑥ 희신 / 기신
        int primaryIdx = Array.IndexOf(ElementCycle, primaryYongshin);
        string heeshin = ElementCycle[(primaryIdx + 4) % 5]; // 용신을 생조하는 오행
        string gishin  = ElementCycle[(primaryIdx + 3) % 5]; // 용신을 극하는 오행

        // ⑦ 설명 문자열
        var (strengthDesc, yongshinReason) = BuildDescriptions(
            dayMasterChar, dayMasterElem, strength, strengthScore,
            eokbuYongshin, johuYongshin, primaryYongshin,
            chart.MonthPillar.BranchChar, chart.MonthPillar.BranchName);

        return new YongshinResult
        {
            Strength            = strength,
            StrengthScore       = strengthScore,
            EokbuYongshin       = eokbuYongshin,
            JohuYongshin        = johuYongshin,
            PrimaryYongshin     = primaryYongshin,
            Heeshin             = heeshin,
            Gishin              = gishin,
            StrengthDescription = strengthDesc,
            YongshinReason      = yongshinReason,
        };
    }

    // ── 억부법 강약 점수 계산 ─────────────────────────────────────
    // 월지 weight=3, 일지 weight=2, 나머지 각 1
    // 일간 자신(DayPillar 천간)은 제외
    private static int CalculateStrengthScore(SajuChart chart, string dayElem)
    {
        int score = 0;

        var pillars = new List<(SajuPillar Pillar, bool IsDay)>
        {
            (chart.YearPillar,  false),
            (chart.MonthPillar, false),
            (chart.DayPillar,   true),   // 일간 천간은 제외, 일지는 포함
        };
        if (chart.HourPillar != null)
            pillars.Add((chart.HourPillar, false));

        foreach (var (pillar, isDay) in pillars)
        {
            // 천간 (일간 자신은 제외)
            if (!isDay)
            {
                var stemElem = GetStemElement(pillar.StemChar);
                score += ClassifyElement(dayElem, stemElem) * 1;
            }

            // 지지 (weight: 월지=3, 일지=2, 나머지=1)
            var branchElem = GetBranchElement(pillar.BranchChar);
            int w = pillar == chart.MonthPillar ? 3
                  : pillar == chart.DayPillar   ? 2
                  : 1;
            score += ClassifyElement(dayElem, branchElem) * w;
        }

        return score;
    }

    // ── 십신 분류: +1(생조) / -1(극설) ───────────────────────────
    // 일간 X 기준:
    //   인성(생아): X 바로 앞 오행 (idx+4)%5  → +1
    //   비겁(동류): X 자신                     → +1
    //   식상(아생): (idx+1)%5                  → -1
    //   재성(아극): (idx+2)%5                  → -1
    //   관살(극아): (idx+3)%5                  → -1
    private static int ClassifyElement(string dayElem, string otherElem)
    {
        if (otherElem == dayElem) return +1; // 비겁

        int dayIdx = Array.IndexOf(ElementCycle, dayElem);
        if (ElementCycle[(dayIdx + 4) % 5] == otherElem) return +1; // 인성
        if (ElementCycle[(dayIdx + 1) % 5] == otherElem) return -1; // 식상
        if (ElementCycle[(dayIdx + 2) % 5] == otherElem) return -1; // 재성
        if (ElementCycle[(dayIdx + 3) % 5] == otherElem) return -1; // 관살

        return 0; // 이론상 도달 불가
    }

    // ── 억부 용신 오행 결정 ───────────────────────────────────────
    private static string GetEokbuYongshin(string dayElem, DayMasterStrength strength)
    {
        int idx = Array.IndexOf(ElementCycle, dayElem);
        return strength switch
        {
            DayMasterStrength.Strong   => ElementCycle[(idx + 3) % 5], // 관살(克我)
            DayMasterStrength.Weak     => ElementCycle[(idx + 4) % 5], // 인성(生我)
            DayMasterStrength.Balanced => ElementCycle[(idx + 4) % 5], // 인성(보조)
            _ => dayElem
        };
    }

    // ── 최종 용신 결정 ────────────────────────────────────────────
    // |score| >= 5: 억부 강함 → 억부 우선
    // |score| < 5 또는 중화:  조후 우선 (없으면 억부)
    private static string DeterminePrimary(
        DayMasterStrength strength, int score,
        string eokbu, string? johu)
    {
        if (strength == DayMasterStrength.Balanced)
            return johu ?? eokbu;

        if (Math.Abs(score) >= 5)
            return eokbu; // 강한 신강/신약 → 억부 우선

        // 약한 신강/신약 → 조후와 억부 중 하나 선택
        // 조후용신이 있으면 조후, 없으면 억부
        return johu ?? eokbu;
    }

    // ── 설명 문자열 빌드 ──────────────────────────────────────────
    private static (string strengthDesc, string yongshinReason) BuildDescriptions(
        string dayMasterChar, string dayMasterElem,
        DayMasterStrength strength, int score,
        string eokbu, string? johu, string primary,
        string monthBranchChar, string monthBranchName)
    {
        string scoreSign = score >= 0 ? $"+{score}" : $"{score}";
        string strengthLabel = strength switch
        {
            DayMasterStrength.Strong   => "신강(身强)",
            DayMasterStrength.Weak     => "신약(身弱)",
            DayMasterStrength.Balanced => "중화(中和)",
            _ => ""
        };

        string strengthDesc = strength switch
        {
            DayMasterStrength.Strong =>
                $"일간 {dayMasterChar}({ElementKorean[dayMasterElem]})이 사주에서 강하게 자리잡고 있어 {strengthLabel}입니다. " +
                $"생조하는 기운이 강해 일간을 억제하는 오행이 필요합니다. (강약 점수 {scoreSign})",
            DayMasterStrength.Weak =>
                $"일간 {dayMasterChar}({ElementKorean[dayMasterElem]})이 사주에서 힘이 약한 {strengthLabel}입니다. " +
                $"극설하는 기운이 많아 일간을 생조하는 오행이 필요합니다. (강약 점수 {scoreSign})",
            DayMasterStrength.Balanced =>
                $"일간 {dayMasterChar}({ElementKorean[dayMasterElem]})이 생조와 극설이 균형잡힌 {strengthLabel}입니다. " +
                $"계절 기후 조절이 핵심입니다. (강약 점수 {scoreSign})",
            _ => ""
        };

        string johuDesc = johu != null
            ? $" {monthBranchChar}({monthBranchName})월 조후법에서는 {ElementKorean[johu]}{KoreanUtils.IGa(ElementKorean[johu])} 기후 균형에 필요합니다."
            : "";

        string yongshinReason = strength switch
        {
            DayMasterStrength.Strong =>
                $"{strengthLabel}이므로 일간을 억제하는 {ElementKorean[eokbu]}(관살)을 억부 용신으로 취합니다.{johuDesc}" +
                (primary != eokbu ? $" 강약이 약하므로 조후 용신 {ElementKorean[primary]}{KoreanUtils.EulReul(ElementKorean[primary])} 최종 용신으로 채택합니다." : ""),
            DayMasterStrength.Weak =>
                $"{strengthLabel}이므로 일간을 생조하는 {ElementKorean[eokbu]}(인성)을 억부 용신으로 취합니다.{johuDesc}" +
                (primary != eokbu ? $" 조후 용신 {ElementKorean[primary]}{KoreanUtils.EulReul(ElementKorean[primary])} 최종 용신으로 채택합니다." : ""),
            DayMasterStrength.Balanced =>
                $"{strengthLabel}에 가까우므로 조후법을 우선합니다.{johuDesc}" +
                $" 최종 용신: {ElementKorean[primary]}.",
            _ => ""
        };

        return (strengthDesc, yongshinReason);
    }

    // ── 오행 조회 헬퍼 ───────────────────────────────────────────
    private static string GetStemElement(string stemChar)
        => SajuData.Stems.First(s => s.Char == stemChar).FiveElement;

    private static string GetBranchElement(string branchChar)
        => SajuData.Branches.First(b => b.Char == branchChar).FiveElement;
}
