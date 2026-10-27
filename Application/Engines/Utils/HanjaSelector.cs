using NameForm.Application.Engines.Data;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 이름 음절별 대표 한자를 "한 번 제대로" 선택하는 단일 진실의 원천.
/// 점수(자원오행)·표시(뜻)·저장이 모두 같은 한자를 쓰도록 결정적으로 동작한다.
/// (기존엔 NamePool/Harmony/Explanation이 각자 따로 한자를 뽑아 불일치했음)
///
/// 선택 우선순위 — 이 층은 "정해진 발음 이름에 어떤 한자를 배정하느냐"이지,
/// 어떤 이름이 1등이냐(미학 우선 랭킹)가 아니므로 용신을 강하게 써도 철학에 어긋나지 않는다:
///   0) 불용을 빼고 나면 쓸 글자가 없는 음절(괵·몰·훙·에·죄 등)은 null — 호출부는 '한자 없음'으로 다룬다(<see cref="NoHanjaNoteFor"/>)
///   1) 불용한자(부정 의미) 배제 + 한글 뜻 보유 + 약한 한자(weak)는 동음 비약자 대안이 하나라도 있으면 후보에서 뺌
///      (성별·용신 가점과 무관 — 대안이 없을 때만 남는다, 2026-10-26 B6)
///      + CJK 기본 영역 글자가 있으면 확장 영역 글자는 뺌(OrderForDisplay 2순위와 같은 규칙, 2026-10-26 보완)
///   2) 인명 빈출 한자 우선(雨·塞·羅 등 비이름 글자 회피)
///   3) 용신/희신 오행과 한자 오행 일치를 '주된' 기준으로 가산, 기신은 회피
///   4) 성별 선호 일치 + 인명 관련도(타이브레이크)
/// </summary>
public static class HanjaSelector
{
    /// <summary>
    /// 이 글자가 '이름용으로 약한 한자'인지 — 동음의 더 나은 대안이 있으면 양보해야 하는 글자.
    /// 세트는 HanjaData.WeakGivenNameHanjaSet(359자, 2026-07-02 전수 스캔 확정)로 이관 —
    /// 기존 호출부(CreativeNamingEngine 등) 호환을 위한 위임 심.
    /// </summary>
    public static bool IsWeakGivenNameHanja(string character) => HanjaData.IsWeakGivenNameHanja(character);

    /// <summary>오행 상생: key가 생(生)하는 오행.</summary>
    private static readonly Dictionary<string, string> ElementGenerates = new()
    {
        { "木", "火" }, { "火", "土" }, { "土", "金" }, { "金", "水" }, { "水", "木" }
    };

    /// <summary>
    /// 표시용(/name 페이지): 한 발음 이름(2음절)에 흔히 쓰는 한자 '조합' 상위 k개를 오행 조화까지
    /// 반영해 선별. 각 음절 대표 1개만 뽑는 <see cref="Select"/>와 달리, "智宇·志宇·智祐"처럼
    /// 조합 다양성을 보이기 위한 별도 경로다. 결과 한자는 모두 뜻·획수를 가진 표시 가능 글자.
    /// 음절 후보는 Select 와 같은 규칙으로 반대 성별 글자를 뺀다(<see cref="TopComboCandidates"/>, 2026-10-27 O1). 그래서 칸이 비면
    /// 약자·확장 영역 쌍으로 다시 채우지 않고 조합이 k개보다 적은 채로 둔다(아래 약자·확장 영역 단계가 그대로 막는다).
    /// 같은 조합을 꼴만 바꾼 이체자 쌍(始彥·始彦)은 한 칸으로 접는다(<see cref="DistinctGlyphVariants"/>).
    /// </summary>
    public static List<(string First, string Second)> SelectCombos(string name, string gender, int k)
    {
        var result = new List<(string, string)>();
        if (string.IsNullOrEmpty(name) || name.Length != 2) return result;

        var g = ParseGender(gender);
        var first = TopComboCandidates(name[0].ToString(), g, 6);
        var second = TopComboCandidates(name[1].ToString(), g, 6);
        if (first.Count == 0 || second.Count == 0) return result;

        var scored = new List<(string a, string b, double s)>();
        foreach (var a in first)
            foreach (var b in second)
                scored.Add((a.Character, b.Character,
                    ComboBaseScore(a, g) + ComboBaseScore(b, g)
                        + OhaengHarmony(a.FiveElement, b.FiveElement)));

        // 약자 쌍은 빈칸 채우기로 쓰지 않는다 — 약자 없는 조합이 하나라도 있으면 그것만 보인다.
        // (2026-10-07 실측: k칸을 채우려 이안=李眼·태휘=胎輝·새라=鰓羅처럼 대안 있는 음절의 약자가 97명에 노출)
        // 약자 없는 조합이 0개일 때만 약자 쌍을 허용하므로 combos 소실은 없다 — weak는 배제가 아니라 양보.
        var ranked = scored.OrderByDescending(x => x.s).ToList();
        var clean = ranked.Where(x => !IsWeakGivenNameHanja(x.a) && !IsWeakGivenNameHanja(x.b)).ToList();
        var pool = clean.Count > 0 ? clean : ranked;

        // 확장 영역(CJK 기본 U+4E00~9FFF 밖) 글자가 든 쌍도 빈칸 채우기로 쓰지 않는다 — 두 글자 모두 기본 영역인 쌍이 하나라도 있으면 그것만
        // (조합이 k개보다 적어도 된다). 사이트 한자 폰트(next/font Noto Serif KR)의 unicode-range 조각에 확장 A·B 코드포인트가 하나도 없어
        // 㦐·㘔·䭱·𩇣 같은 글자는 기기 폰트에 기대야 그려진다(2026-10-26 빌드 CSS 373 조각 실측 — 확장 A 0/6,592). 옛 결과는 48쌍 +
        // 부정 훈 정리 보완의 니나·라니 4순위 㦐 2쌍이 이렇게 들어왔다. 약자 양보 다음 단계라(Select 와 같은 순서) 기본 영역 쌍이 모두 약자뿐인
        // 이름(한글=翰㔕 — 글 줄은 契 weak·㔕 확장뿐)은 확장 영역 비약자 쌍을 그대로 둔다.
        var basicOnly = pool.Where(x => HanjaData.IsInCjkBasicRange(x.a) && HanjaData.IsInCjkBasicRange(x.b)).ToList();
        if (basicOnly.Count > 0) pool = basicOnly;
        return DistinctGlyphVariants(pool.Select(x => (x.a, x.b)).ToList()).Take(k).ToList();
    }

    /// <summary>
    /// 꼴만 다른 같은 조합을 하나로 접는다 — 두 칸이 음절마다 같은 글자이거나 같은 자형 이체자 묶음(<see cref="HanjaData.GlyphVariantKey"/>)이면
    /// 같은 조합이다(2026-10-27 — 남자 언 이름 1~4순위가 始彥·始彦·施彥·施彦 로 찼다). 대표는 hanja_variants.json 의 정자(standard)로
    /// 이루어진 조합(<see cref="HanjaData.IsGlyphVariantStandard"/> — 한국 표준형 kHangul·KS X 1001 순, 彥/彦 은 KS X 1001 의 彦, 凛/凜 은 凜)이고, 정자 조합이
    /// 후보에 없거나 정자 판정이 동률이면 순위가 앞선 조합이다. 대표는 묶음에서 가장 앞선 조합의 자리에 서고, 빈 칸은 같은 단계(약자·확장 영역
    /// 거르기를 지난) 후보의 다음 조합이 채운다. 입력 순서(순위)를 그대로 따르므로 이체자가 없는 목록은 바뀌지 않는다.
    /// </summary>
    private static List<(string First, string Second)> DistinctGlyphVariants(List<(string First, string Second)> ranked)
    {
        static string KeyOf(string c) => HanjaData.GlyphVariantKey(c) ?? c;
        static bool IsStandardOrPlain(string c) => HanjaData.IsGlyphVariantStandard(c) != false;
        var groups = ranked
            .GroupBy(x => (KeyOf(x.First), KeyOf(x.Second)))   // GroupBy 는 처음 나온 순서를 지킨다
            .Select(g => g.FirstOrDefault(x => IsStandardOrPlain(x.First) && IsStandardOrPlain(x.Second), g.First()));
        return groups.ToList();
    }

    /// <summary>
    /// 출생일 없는 기본 배정(/evaluate·추천 카드 — 용신이 없는 화면) — 2음절·서로 다른 음절 이름에 조합이 있으면 /name 1순위 조합
    /// (<see cref="NameSeoHanja.Combos"/>[0] — /name 페이지·dump-name-scores 와 같은 경로), 아니면 <see cref="Select"/>(용신 없음).
    /// 2026-10-27 O2 결정(O3 = O1 + O2): 옛 기본 배정 Select 는 같은 성별 +40 이 관련도보다 앞서 /name 과 다른 글자를 골라(지우(여) 智宇 ↔ 智瑀,
    /// 동균 東均 ↔ 東覠) 같은 이름의 두 화면이 다른 한자·노트를 보였다. 출생일이 있으면 조화의 용신 배정(SelectedHanja)을 그대로 쓴다.
    /// 인기 여자 이름의 출생일 없는 /evaluate 점수가 −2~−5 내려가는 것은 사용자가 받아들였다(지우 75→72·지민 78→75).
    /// /name-analysis 출생일 없는 큰 카드(OrderForDisplay)는 이 함수를 쓰지 않는다(성별 채점이 없는 경로 — 따로 결정할 일).
    /// </summary>
    public static List<HanjaInfo?> DefaultAssignment(string name, string gender)
    {
        var combos = NameSeoHanja.Combos(name, gender);
        if (combos.Count > 0)
            return new List<HanjaInfo?> { HanjaData.FindByCharacter(combos[0].First), HanjaData.FindByCharacter(combos[0].Second) };
        return Select(name, gender, null, null, null);
    }

    /// <summary>
    /// 한 음절에 이름에 쓸 만한 한자가 하나도 없을 때(후보 표·배정이 비는 음절) 응답에 싣는 안내 — 사전 독음은 있지만 글자가 모두 불용(괵=馘·몰=沒·
    /// 훙=薨·에=曀恚·죄=罪 등, 2026-10-26 불용 10차).
    /// </summary>
    public const string NoUsableHanjaNote = "이 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요";

    /// <summary>사전에 그 독음 한자가 아예 없는 음절(순우리말·미등록 발음 — 봄·빛·꽃 같은 음절)의 안내.</summary>
    public const string NoHanjaReadingNote = "이 음절은 인명용 한자 독음이 아니어서 한글로만 써요";

    /// <summary>
    /// 음절에 표시·배정할 한자가 없을 때의 안내 문구 — 있으면 null. 판정은 표시 정렬(<see cref="OrderForDisplay"/>: 불용·뜻 없는 글자 제외)과 같아
    /// /evaluate 후보 표·/name-analysis 후보 카드가 0개인 음절에서만 문구가 붙는다. 사전 독음이 아예 없으면 <see cref="NoHanjaReadingNote"/>,
    /// 있지만 모두 불용(또는 뜻 없음)이면 <see cref="NoUsableHanjaNote"/>.
    /// </summary>
    public static string? NoHanjaNoteFor(string syllable)
    {
        var all = HanjaData.FindByReading(syllable).ToList();
        if (all.Count == 0) return NoHanjaReadingNote;
        return OrderForDisplay(all).Any() ? null : NoUsableHanjaNote;
    }

    /// <summary>
    /// 이름에 쓸 수 있는 글자인지 — 불용이 아니고 한글 뜻이 있다. 표시 후보(<see cref="OrderForDisplay"/>)·후보 0 판정(<see cref="HasUsableHanja"/>)·
    /// 의미 카테고리·톤 가점(<see cref="UsableByReading"/>)과 보이는 한자 판정(미학 성별 보너스, 추천 랭킹 자원오행 +8·/name-analysis 용신 배지 —
    /// 2026-10-26 결정 ③)이 함께 쓰는 단일 정의. 약자(weak)·확장 영역 글자는 쓸 수 있는 글자다
    /// (대안이 있으면 양보·회피하는 것은 배정·정렬 단계의 일). <see cref="Select"/> 는 뜻 있는 글자가 사전에 전혀 없는 음절에서만 이 밖의 글자
    /// (뜻 없는 비불용 글자)를 배정하는데, 그런 글자는 이 판정이 거짓이라 표시 후보·미학 성별·자원오행 판정이 모두 건너뛴다.
    /// </summary>
    public static bool IsUsableNameHanja(HanjaInfo h)
        => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning);

    /// <summary>
    /// 음절의 사전 글자 중 이름에 쓸 수 있는 글자만(<see cref="IsUsableNameHanja"/>) — 순서는 <see cref="HanjaData.FindByReading"/> 그대로(관련도 순).
    /// 사전 글자 전부를 보던 곳(미학 의미 카테고리·톤 가점, 이중 이름·가족 서사의 대표 글자, DetermineNameType, /evaluate 후보 표)이 불용 글자
    /// (나=懦 Strong, 멸=滅 자연 등)의 톤·카테고리·뜻을 세지 않게 하는 공용 경로(2026-10-26 점수 정책 — 후보가 있는 음절의 불용 글자도 뺀다).
    /// 미학 성별 보너스·추천 랭킹 자원오행 +8 도 처음엔 이 목록 전체('하나라도 있으면')를 봤으나, 같은 날 결정 ③으로 음절마다 보이는(배정) 한자
    /// 한 글자만 본다(AestheticEngine.EvaluateGenderBonus·RankerEngine.AssignedHanjaHasElement).
    /// </summary>
    public static List<HanjaInfo> UsableByReading(string syllable)
        => HanjaData.FindByReading(syllable).Where(IsUsableNameHanja).ToList();

    /// <summary>
    /// 음절에 표시할 한자가 하나라도 있는지 — <see cref="NoHanjaNoteFor"/> 가 null 인 음절(불용·뜻 없는 글자를 뺀 <see cref="OrderForDisplay"/> 가 비지 않음).
    /// 후보 0 음절(괵·몰·퍅·핍·에·죄 등)을 '배정 없음·한글로 두기'로 다루는 판정(2026-10-26 보완).
    /// </summary>
    public static bool HasUsableHanja(string syllable) => HanjaData.FindByReading(syllable).Any(IsUsableNameHanja);

    /// <summary>
    /// 표시용: 한 음절에 "어떤 한자를 보여 줄까" 상위 n개 (<see cref="OrderForDisplay"/> 순서).
    /// RareSurnameEngine의 HanjaOptions처럼 성별·용신 없이 대표 한자 몇 개를 나열하는 곳의 단일 경로 —
    /// 사전을 삽입 순서대로 Take(n)하면 확장 A 영역 글자(㵟·䋛)가 美보다 앞서 나오던 문제의 대체.
    /// </summary>
    public static List<HanjaInfo> TopForDisplay(string syllable, int n)
        => OrderForDisplay(HanjaData.FindByReading(syllable)).Take(n).ToList();

    /// <summary>
    /// 표시 후보 정렬 — 사전 삽입 순서와 무관하게 결정적.
    /// 불용한자·뜻 없는 글자 제외 →
    ///   1) 인명 빈출 셋(약자 제외) 우선 → 2) CJK 기본 영역 우선(확장 영역은 폰트가 못 그리는 일이 잦다)
    ///   → 3) 관련도(약자 −3000) ↓ → 4) Character Ordinal.
    /// 관련도의 '성별 값 있음 +5'(<see cref="HanjaData.GenderLabelRelevanceBonus"/>)는 여기서도 그대로 둔다 — 2026-10-27 표시 정렬에서만 빼 보니
    /// 관련도 동점이 코드포인트 순으로 깨져 이름에 맞는 꽃·옥 훈 글자가 뜻 약한 글자에 밀렸다(연 蓮→然 '그럴'·하 荷→夏·영 榮→映·화 花→和, 비 상위 10에
    /// 剕 '발 벨'·匪 '비적'), 출생일 없는 /name-analysis 큰 카드 첫 글자 HEAD 대비 변화도 1,227 → 1,352명으로 늘어 되돌렸다. 그래서 노 1순위는 璐
    /// (努 '힘쓸'이 고친 성별 표에서 Neutral)이고, 성별 없는 다른 경로(Select·SelectCombos 'none')와 같다 — 남자 노아는 /name·/evaluate(남) 모두 努.
    /// <see cref="TopComboCandidates"/>처럼 빈출 글자만 남기지 않고 '앞세우기'만 한다 —
    /// 빈출이 1개뿐인 음절도 n개를 채우기 위해.
    /// </summary>
    public static IEnumerable<HanjaInfo> OrderForDisplay(IEnumerable<HanjaInfo> candidates)
        => candidates
            .Where(IsUsableNameHanja)
            .OrderByDescending(h => HanjaData.IsCommonNameHanja(h.Character) && !IsWeakGivenNameHanja(h.Character))
            .ThenByDescending(h => HanjaData.IsInCjkBasicRange(h.Character))
            .ThenByDescending(h => ComboBaseScore(h, GenderPreference.Neutral))
            .ThenBy(h => h.Character, StringComparer.Ordinal);

    private static List<HanjaInfo> TopComboCandidates(string syllable, GenderPreference g, int n)
    {
        var cands = HanjaData.FindByReading(syllable)
            .Where(h => IsUsableNameHanja(h) && h.StrokeCount > 0)
            .ToList();
        var common = cands.Where(h => HanjaData.IsCommonNameHanja(h.Character)).ToList();
        var pool = common.Count > 0 ? common : cands;
        pool = ExcludeOppositeGender(pool, g);
        return pool.OrderByDescending(h => ComboBaseScore(h, g)).Take(n).ToList();
    }

    /// <summary>
    /// 조합 후보(빈출 게이트를 지난 음절 후보)에서 반대 성별 글자를 뺀다 — 대안이 있을 때만(2026-10-27 O1). 옛 조합 선택은 반대 성별에
    /// −400 만 줘 Core_v1 가점(+2000)을 이기지 못해, 대안이 있는데도 1순위가 반대 성별 글자였고(남자 규언 規嫣·나형(여) 羅衡·아섬(여) 亞纖)
    /// 같은 페이지 성별 판정이 '맞지 않음'을 냈다. 대안은 <see cref="SelectForSyllable"/> 과 같은 순서로 센다 — 약자 양보·확장 영역 회피가
    /// 성별보다 먼저라, pool 에 비약자(기본 영역) 글자가 있으면 대안도 비약자(기본 영역)여야 한다(약자만 남겨 반대 성별을 빼지 않는다).
    /// 같은 성별 +40·반대 −400(<see cref="ComboBaseScore"/>)은 그대로 둔다 — 대안이 없는 음절(혜 남자 = 惠·慧·蕙 모두 Female)은 지금처럼 −400 순위.
    /// </summary>
    private static List<HanjaInfo> ExcludeOppositeGender(List<HanjaInfo> pool, GenderPreference g)
    {
        if (g == GenderPreference.Neutral) return pool;
        var opposite = g == GenderPreference.Male ? GenderPreference.Female : GenderPreference.Male;
        if (!pool.Any(h => h.GenderPref == opposite)) return pool;
        bool anyNonWeak = pool.Any(h => !IsWeakGivenNameHanja(h.Character));
        bool anyBasic = pool.Any(h => HanjaData.IsInCjkBasicRange(h.Character));
        bool hasAlternative = pool.Any(h => h.GenderPref != opposite
            && (!anyNonWeak || !IsWeakGivenNameHanja(h.Character))
            && (!anyBasic || HanjaData.IsInCjkBasicRange(h.Character)));
        return hasAlternative ? pool.Where(h => h.GenderPref != opposite).ToList() : pool;
    }

    private static double ComboBaseScore(HanjaInfo h, GenderPreference g)
    {
        double s = HanjaData.CalculateRelevanceScore(h);
        // 약한 한자 감점은 Core_v1 가점(+2000)까지 지배해야 함 — 코어셋은 오행 '검수' 커버리지라
        // 불용·약자도 포함되며, 그 신뢰도 점수가 조합 품질 경쟁을 이기면 안 됨 (革=가죽이 赫을 이기던 버그).
        if (IsWeakGivenNameHanja(h.Character)) s -= 3000;
        if (g != GenderPreference.Neutral && h.GenderPref != GenderPreference.Neutral)
            s += h.GenderPref == g ? 40 : -400;                     // 반대 성별 한자 강한 회피
        return s;
    }

    /// <summary>
    /// 두 오행 관계의 '약한' 우선 점수: 상생 +20 / 비화(같음) +8 / 상극 -12.
    /// 의도적으로 작게 — 조합 선택은 한자 품질(관련도)이 지배하고, 오행은 품질이 비슷한
    /// 조합들 사이의 미세 우선일 뿐이다(상생만 남기고 거르지 않음). 실제 오행 관계는
    /// 프론트가 표시 정보로 다시 계산해 보여준다.
    /// </summary>
    private static double OhaengHarmony(string e1, string e2)
    {
        if (string.IsNullOrEmpty(e1) || string.IsNullOrEmpty(e2)) return 0;
        if (ElementGenerates.GetValueOrDefault(e1) == e2 || ElementGenerates.GetValueOrDefault(e2) == e1)
            return 20;
        if (e1 == e2) return 8;
        return -12; // 5행에서 상생·비화가 아니면 상극
    }

    /// <summary>이름 각 음절에 한자 1개씩 선택. yongshin* 인자가 null이면 용신 가산 없이 동작.</summary>
    public static List<HanjaInfo?> Select(
        string name, string gender,
        string? yongshinPrimary, string? yongshinHee, string? yongshinGi)
    {
        var genderPref = ParseGender(gender);
        var result = new List<HanjaInfo?>();
        if (string.IsNullOrEmpty(name)) return result;

        foreach (char c in name)
            result.Add(SelectForSyllable(c.ToString(), genderPref, yongshinPrimary, yongshinHee, yongshinGi));

        return result;
    }

    private static HanjaInfo? SelectForSyllable(
        string syllable, GenderPreference genderPref,
        string? yPrimary, string? yHee, string? yGi)
    {
        var raw = HanjaData.FindByReading(syllable).ToList();
        var all = raw.Where(h => !HanjaData.IsForbiddenNameHanja(h.Character)).ToList();
        if (all.Count == 0) return null;

        // 뜻이 있는 인명 후보 우선. 사전에 뜻 있는 글자가 전혀 없는 음절만 뜻 없는 것이라도(획수 자원오행은 살아 있음).
        // 뜻 있는 글자가 있었는데 모두 불용이면 배정하지 않는다 — 뜻 없는 글자로 메우면 후보 표·의미 메모는 비는데(표시는 뜻 있는 글자만)
        // 점수만 그 글자의 오행·획수로 매겨진다(2026-10-26 불용 10차: 핍=偪·逼 뒤 畐, 뉵=衄 뒤 沑 — 옛 에·죄 처럼 null 로 끝낸다).
        var withMeaning = all.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
        if (withMeaning.Count == 0 && raw.Any(h => !string.IsNullOrEmpty(h.Meaning))) return null;
        var cands = withMeaning.Count > 0 ? withMeaning : all;

        // 이름용으로 약한 한자(友 벗·雨 비·葷 훈채 등)는 동음 비약자 대안이 하나라도 있으면 늘 양보한다 — 대안이 없을 때만 남는다(女 '녀').
        // 점수 감점(옛 −30)이던 때는 성별 일치 +40·용신 +100 이 감점을 이겨, 생년월일 없는 남자 지훈·성훈=葷(훈채)·채민=寨(목책)·
        // 한솔=帥(장수 수)가 배정됐다(2026-10-23 검증 API-1 → 10-26 B6). 점수가 아니라 후보 단계에서 거르므로 아래 빈출 게이트가
        // 약자만 남기는 일도 없다(빈출 비약자 > 비빈출 비약자 > 약자 순 — 빈출 약자만 있는 음절은 비빈출 비약자로 간다).
        var nonWeak = cands.Where(h => !HanjaData.IsWeakGivenNameHanja(h.Character)).ToList();
        if (nonWeak.Count > 0) cands = nonWeak;

        // CJK 기본 영역(U+4E00~9FFF) 글자가 하나라도 남아 있으면 확장 영역 글자는 뺀다 — OrderForDisplay 2순위와 같은 규칙
        // (확장 영역은 폰트가 못 그리는 일이 잦다). 용신 +100 이 관련도(기본 +1000·확장 A +100)보다 앞서는 정렬이라, 빼지 않으면
        // 별(여·용신 金)=䭱·새(남)=㘔·니(土)=㦐·슬(火·木)=𩇣 처럼 확장 글자가 의미 메모·후보 표 맨 앞에 나왔다(2026-10-26 보완).
        // 약자 양보 다음 단계라, 기본 영역 글자가 모두 약자인 음절은 확장 영역 비약자로 간다(약자 회피가 우선).
        var basic = cands.Where(h => HanjaData.IsInCjkBasicRange(h.Character)).ToList();
        if (basic.Count > 0) cands = basic;

        var common = cands.Where(h => HanjaData.IsCommonNameHanja(h.Character)).ToList();
        var pool = common.Count > 0 ? common : cands;

        return pool
            .OrderByDescending(h => ScoreHanja(h, genderPref, yPrimary, yHee, yGi))
            .ThenByDescending(HanjaData.CalculateRelevanceScore)
            .First();
    }

    private static double ScoreHanja(
        HanjaInfo h, GenderPreference genderPref,
        string? yPrimary, string? yHee, string? yGi)
    {
        double s = 0;

        // 성별 적합 = 거의 하드 제약. 여아에 남성 전형 한자(또는 그 반대)는 사실상 배제하고,
        // 용신은 그 '성별 적합 집합 안에서' 최적화한다(실제 작명 관행). gender=none이면 무효.
        if (genderPref != GenderPreference.Neutral && h.GenderPref != GenderPreference.Neutral)
        {
            if (h.GenderPref == genderPref) s += 40;
            else s -= 200;   // 반대 성별 한자 → 대안이 있으면 배제
        }

        var el = h.FiveElement;
        if (!string.IsNullOrEmpty(el))
        {
            // 용신을 '주된' 선택 기준으로 강하게 — 한자 배정 층이라 강해도 이름 랭킹은 안 흔듦.
            if (el == yPrimary) s += 100;
            else if (el == yHee) s += 55;
            else if (el == yGi) s -= 70;
            s += 4; // 오행 정보 보유 소가산 (정보 없는 한자보다 우선)
        }

        // 약한 한자는 여기서 감점하지 않는다 — SelectForSyllable 이 비약자 대안이 있으면 후보에서 먼저 뺀다(2026-10-26 B6).
        // 여기까지 온 약자는 대안이 없는 음절의 약자뿐이라, 그들끼리는 성별·용신으로만 고른다.

        return s;
    }

    private static GenderPreference ParseGender(string? gender) => gender?.ToLowerInvariant() switch
    {
        "male" => GenderPreference.Male,
        "female" => GenderPreference.Female,
        _ => GenderPreference.Neutral
    };
}
