namespace NameForm.Application.Engines.Data;

/// <summary>
/// 사주 천간/지지 기초 데이터
/// </summary>
public static class SajuData
{
    // ── 천간 (天干) 10개 ──────────────────────────────────────────
    // 순서: 갑/을/병/정/무/기/경/신/임/계
    public record StemInfo(string Char, string Name, string FiveElement, string YinYang);

    public static readonly StemInfo[] Stems =
    [
        new("甲", "갑", "木", "陽"),
        new("乙", "을", "木", "陰"),
        new("丙", "병", "火", "陽"),
        new("丁", "정", "火", "陰"),
        new("戊", "무", "土", "陽"),
        new("己", "기", "土", "陰"),
        new("庚", "경", "金", "陽"),
        new("辛", "신", "金", "陰"),
        new("壬", "임", "水", "陽"),
        new("癸", "계", "水", "陰"),
    ];

    // ── 지지 (地支) 12개 ──────────────────────────────────────────
    // 순서: 자/축/인/묘/진/사/오/미/신/유/술/해
    public record BranchInfo(string Char, string Name, string FiveElement, string YinYang, int MonthIndex);

    public static readonly BranchInfo[] Branches =
    [
        new("子", "자", "水", "陽", 11),  // 자월 = 음력 11월
        new("丑", "축", "土", "陰", 12),
        new("寅", "인", "木", "陽",  1),  // 인월 = 음력 1월 (입춘 기준)
        new("卯", "묘", "木", "陰",  2),
        new("辰", "진", "土", "陽",  3),
        new("巳", "사", "火", "陰",  4),
        new("午", "오", "火", "陽",  5),
        new("未", "미", "土", "陰",  6),
        new("申", "신", "金", "陽",  7),
        new("酉", "유", "金", "陰",  8),
        new("戌", "술", "土", "陽",  9),
        new("亥", "해", "水", "陰", 10),
    ];

    // ── 60갑자 순서 (년주/일주 계산용) ───────────────────────────
    // 인덱스 0 = 甲子, 1 = 乙丑, ..., 59 = 癸亥
    public static (int StemIdx, int BranchIdx) GetStemBranch(int cycle60Index)
    {
        var idx = ((cycle60Index % 60) + 60) % 60;
        return (idx % 10, idx % 12);
    }

    // ── 오호둔년법 (五虎遁年法): 년간 → 1월(인월) 천간 ───────────
    // 甲己년 → 인월 시작 천간 = 丙(2)
    // 乙庚년 → 戊(4)
    // 丙辛년 → 庚(6)
    // 丁壬년 → 壬(8)
    // 戊癸년 → 甲(0)
    private static readonly int[] MonthStemBase = [2, 4, 6, 8, 0];
    // 년간 인덱스(0~9) → 인월 천간 인덱스
    public static int GetMonthStemBase(int yearStemIdx) =>
        MonthStemBase[yearStemIdx % 5];

    // ── 오자둔일법 (五子遁日法): 일간 → 자시(23~01) 천간 ─────────
    // 甲己일 → 자시 천간 = 甲(0)
    // 乙庚일 → 丙(2)
    // 丙辛일 → 戊(4)
    // 丁壬일 → 庚(6)
    // 戊癸일 → 壬(8)
    private static readonly int[] HourStemBase = [0, 2, 4, 6, 8];
    public static int GetHourStemBase(int dayStemIdx) =>
        HourStemBase[dayStemIdx % 5];

    // ── 시지 인덱스 (시간 → 지지) ────────────────────────────────
    // 자시: 23:00~01:00, 축시: 01:00~03:00, ...
    public static int GetHourBranchIndex(TimeSpan time)
    {
        var h = time.Hours;
        // 자시: 23~01 → 0, 축시: 01~03 → 1, ...
        return h == 23 ? 0 : (h + 1) / 2;
    }

    // ── 오행 한글 이름 ────────────────────────────────────────────
    public static readonly Dictionary<string, string> FiveElementKorean = new()
    {
        ["木"] = "목(木)",
        ["火"] = "화(火)",
        ["土"] = "토(土)",
        ["金"] = "금(金)",
        ["水"] = "수(水)",
    };
}
