namespace NameForm.Domain.Models.Saju;

/// <summary>
/// 사주 기둥 하나 (년/월/일/시주)
/// </summary>
public record SajuPillar(
    string StemChar,       // 천간 한자 (甲/乙/丙...)
    string StemName,       // 천간 이름 (갑/을/병...)
    string BranchChar,     // 지지 한자 (子/丑/寅...)
    string BranchName,     // 지지 이름 (자/축/인...)
    string FiveElement,    // 오행 (木/火/土/金/水)
    string YinYang         // 음양 (陽/陰)
)
{
    public override string ToString() => $"{StemChar}{BranchChar}";
}
