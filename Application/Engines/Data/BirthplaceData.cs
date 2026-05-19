namespace NameForm.Application.Engines.Data;

/// <summary>
/// 출생지별 경도 데이터 — 진태양시(眞太陽時) 보정에 사용
/// 한국 표준시(KST) 기준 경선: 135°E
/// 보정분 = (경도 - 135) × 4분  (서울 기준 약 -32분)
/// </summary>
public static class BirthplaceData
{
    public record BirthplaceInfo(string Code, string Name, double Longitude)
    {
        /// <summary>진태양시 보정값 (분 단위, 음수 = 빼기)</summary>
        public double CorrectionMinutes => (Longitude - 135.0) * 4.0;
    }

    // 시/도 단위 대표 경도 (도청/시청 소재지 기준)
    public static readonly BirthplaceInfo[] Birthplaces =
    [
        new("seoul",    "서울",   126.98),  // -32분
        new("busan",    "부산",   129.08),  // -24분
        new("daegu",    "대구",   128.60),  // -26분
        new("incheon",  "인천",   126.70),  // -33분
        new("gwangju",  "광주",   126.85),  // -33분
        new("daejeon",  "대전",   127.39),  // -30분
        new("ulsan",    "울산",   129.31),  // -23분
        new("sejong",   "세종",   127.29),  // -31분
        new("gyeonggi", "경기",   127.01),  // -32분
        new("gangwon",  "강원",   128.10),  // -28분
        new("chungbuk", "충북",   127.49),  // -30분
        new("chungnam", "충남",   126.80),  // -33분
        new("jeonbuk",  "전북",   127.15),  // -31분
        new("jeonnam",  "전남",   126.99),  // -32분
        new("gyeongbuk","경북",   128.73),  // -25분
        new("gyeongnam","경남",   128.21),  // -27분
        new("jeju",     "제주",   126.53),  // -34분
    ];

    public static readonly BirthplaceInfo Default =
        Birthplaces.First(b => b.Code == "seoul");

    public static BirthplaceInfo? Find(string? code) =>
        string.IsNullOrEmpty(code)
            ? Default
            : Birthplaces.FirstOrDefault(b => b.Code == code) ?? Default;
}
