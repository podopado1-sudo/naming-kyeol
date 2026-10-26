using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// /name 정적 페이지(frontend/src/data/name-seo.json) 한 이름의 성별·한자 조합·'페이지에 보이는 한자'를 정하는 단일 경로.
/// dump-name-combos(조합)·dump-name-flags(조합 유무)·dump-name-scores(미학 성별 판정)와 회귀 테스트
/// (OpsVerificationRegressionTests.NameSeo_AestheticScores_MatchEngine)가 모두 이 함수를 불러, 점수가 판정한 한자와
/// 페이지 1순위 조합이 갈라질 수 없다(2026-10-26 결정 ③ — 성별 판정은 사용자가 보는 한자로).
/// build_name_seo_data.py 는 name-combos.json 의 순서를 그대로 싣고, 페이지(ComboCard)는 combos[0] 을 맨 앞에 그린다.
/// </summary>
public static class NameSeoHanja
{
    /// <summary>페이지가 보이는 조합 수(1순위 + 3).</summary>
    public const int ComboCount = 4;

    /// <summary>
    /// 페이지 성별 판정(조합 선택·미학 성별 판정용) — 남녀 비율을 각각 버림한 정수 퍼센트(m·100/t, f·100/t)가 60 이상이면 그 성별, 아니면 none
    /// (출생신고 통계 m·f). ⚠️ 프론트 name-seo.ts genderSplit(페이지 성별 배지·남녀 막대·메타 설명)과 같은 계산이 아니다 — 프론트는 남자 비율을
    /// 반올림(Math.round)하고 여자 = 100 − 남자로 정해, 경계 이름 10명(서우 54위 남 40.29% → 페이지 '여자 60%'·여자 이름, 지빈·희율·명빈·기은·민효·
    /// 가엘·정유·영연·로다)은 페이지가 남자/여자 이름인데 조합·점수는 none 으로 계산된다(옛 Program.cs 부터 이어진 차이, 2026-10-26 확인).
    /// 반올림으로 맞추면 명빈·정유·영연·로다의 1순위 조합이 바뀌고 새 조합쌍 10개의 조합 뜻이 필요해 '알려진 이슈'로 남겼다(CLAUDE.md).
    /// </summary>
    public static string Gender(int male, int female)
    {
        int total = male + female;
        return total > 0 && male * 100 / total >= 60 ? "male"
             : total > 0 && female * 100 / total >= 60 ? "female" : "none";
    }

    /// <summary>
    /// 페이지 한자 조합(<see cref="HanjaSelector.SelectCombos"/> 상위 <see cref="ComboCount"/>개). 2음절·서로 다른 음절 이름만 —
    /// 3음절·첩음(하하)·1음절 이름은 조합이 없다.
    /// </summary>
    public static List<(string First, string Second)> Combos(string name, string gender)
        => !string.IsNullOrEmpty(name) && name.Length == 2 && name[0] != name[1]
            ? HanjaSelector.SelectCombos(name, gender, ComboCount)
            : new List<(string First, string Second)>();

    /// <summary>
    /// 페이지에 보이는 이 이름의 한자 — 1순위 조합(<see cref="Combos"/>[0])을 음절 순서로. 조합이 없는 이름(3음절·첩음·외래 fx·
    /// 조합 0)은 페이지에 그 이름의 한자가 없어 전 음절 null 이다(음절별 '한자 전체 보기' 링크는 독음 목록이라 이 이름의 한자가 아니다).
    /// </summary>
    public static List<HanjaData.HanjaInfo?> DisplayedHanja(string name, string gender)
    {
        var combos = Combos(name, gender);
        if (combos.Count == 0)
            return Enumerable.Repeat<HanjaData.HanjaInfo?>(null, name?.Length ?? 0).ToList();
        return new List<HanjaData.HanjaInfo?>
        {
            HanjaData.FindByCharacter(combos[0].First),
            HanjaData.FindByCharacter(combos[0].Second),
        };
    }
}
