using System.Text.RegularExpressions;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 부모 기반 작명 엔진 — 부모 이름·성씨·키워드에서 2음절 이름(성 제외)을 만든다(2026-10-28 개편).
/// 방식(코드 → 사용자 라벨·계승 꼴은 <see cref="ParentNamingModels"/>):
///  family-meaning   아버지 이름 글자 하나 + 어머니 이름 글자 하나, 음절마다 한자 한 자의 훈으로 뜻을 푼다
///  parent-initials  아버지 이름 첫 글자 + 어머니 이름 첫 글자
///  parent-syllables 서로 다른 부모의 글자 한 자씩, 또는 한 부모 이름 안의 두 글자(순서 바꾸기·고르기 — NameReversalEngine)
///  shared-syllable  두 부모 이름에 함께 있는 글자 + 실명 짝 글자
///  mother-initial   어머니 이름 첫 글자 + 실명 짝 글자(어머니 이름이 없을 때만 father-initial — 아버지 이름 첫 글자)
///  mother-surname   어머니 성 + 실명 짝 글자
///  mother-sound     실명 짝 글자 + 어머니 성(두음 변주가 있으면 변주 꼴)
///  keyword-meaning  키워드 뜻과 훈의 낱말이 맞는 한자 독음(+ 실명 짝 글자), keyword-sound 는 키워드 소리 그대로
///  surname-meaning  아이 성씨와 이어 읽히는 글자·성씨 대표 한자의 뜻 — 부모 이름·키워드가 모두 없을 때(API 전용, 웹 폼은 하나를 필수로 받는다),
///                   그리고 아래 예비 경로를 다 거쳐도 5개 미만일 때
/// '한 글자'는 실명 통계(RealNamePartners — 출생신고 2008~2019, 20명 이상)에서 고른다. 옛 원천은 사전 삽입 순서 앞 5·10·15자였다.
/// 모든 후보는 공통 품질 거르기(<see cref="QualityRejectReason(string,string,IReadOnlyCollection{string},IReadOnlyCollection{string})"/>)를 지난다.
/// 성별을 고른 요청에서 반대 성별로 뚜렷이 기우는 실명(NamingPrinciples.GenderLeanLabel — 남아 + '은지'·'수민')은 본 목록에 넣지 않고
/// 마지막 예비 목록으로만 둔다(2026-10-28 검증 — 부모 글자 조합·키워드 이름이 성별을 보지 않아 남아 요청 배너의 68% 가 여자 이름이었다).
/// 결과가 5개 미만이면 예비 경로를 차례로 붙인다: ① 부모 이름 모든 글자 + 실명 짝 글자(앞·뒤 두 자리) ② 실명 통계에 없는 부모 글자 조합
/// ⑤ 키워드가 있으면 키워드 뜻 한자·어간 음절 + 짝 글자를 더 넓게, 그다음 성별 검사 없이 ③ 성씨 뜻 잇기 ④ 반대 성별로 기우는 실명. 옛 엔진(조사 bin)은 같은 입력에 15~42개를 냈고, 이 경로가 없을 때는 0개가 나왔다
/// (키워드 '봄'·'숲'·'햇님', 아버지 '병철'만, '철' + 딸, 어머니 '숙' + 아들).
/// </summary>
public class ParentBasedNamingEngine : IParentBasedNamingEngine
{
    private readonly INamePoolEngine _namePoolEngine;
    private readonly INameReversalEngine _nameReversalEngine;
    // family-meaning 의 음절 한자를 /evaluate 배정과 같게 고르려고 요청 출생일·시각의 용신을 계산한다(DualNameEngine 과 같은 방식).
    // 없으면(단위 테스트의 2인자 생성) 용신 없이 고른다 — DI 는 둘 다 등록돼 있어 늘 주입한다
    private readonly ISajuCalculationService? _sajuCalculationService;
    private readonly IYongshinCalculationService? _yongshinCalculationService;

    // 방식별 상한 — 라운드 로빈 전체 상한 50 안에서 한 방식이 몰리지 않게
    private const int MaxTotal = 50;
    private const int CapFamilyMeaning = 8;
    private const int CapParentSyllables = 10;
    private const int CapPartnerMethod = 8;
    private const int CapKeyword = 15;
    private const int CapSurname = 15;
    // 결과가 이보다 적으면 실명 통계에 없는(20명 미만) 부모 글자 조합도 뒤에 붙인다
    private const int MinResults = 5;

    public ParentBasedNamingEngine(
        INamePoolEngine namePoolEngine,
        INameReversalEngine nameReversalEngine,
        ISajuCalculationService? sajuCalculationService = null,
        IYongshinCalculationService? yongshinCalculationService = null)
    {
        _namePoolEngine = namePoolEngine;
        _nameReversalEngine = nameReversalEngine;
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = yongshinCalculationService;
    }

    /// <summary>
    /// 요청 하나에 한 번 — HarmonyEngine.CalculateScoreWithBreakdownAsync 의 용신 계산과 같다(1순위 용신·희신·기신, 서비스가 없거나 실패하면 모두 null).
    /// </summary>
    private (string? Primary, string? Hee, string? Gi) CalculateYongshin(DateTime birthDate, TimeSpan? birthTime)
    {
        if (_sajuCalculationService == null || _yongshinCalculationService == null) return (null, null, null);
        try
        {
            var chart = _sajuCalculationService.CalculateChart(birthDate, birthTime);
            var y = _yongshinCalculationService.Calculate(chart);
            return (y.PrimaryYongshin, y.Heeshin, y.Gishin);
        }
        catch
        {
            return (null, null, null);
        }
    }

    // ===== 성씨 의미 사전 — surname-meaning 의 뜻 낱말(성씨 대표 한자의 훈과 낱말이 맞는 것만 쓴다) =====
    private static readonly Dictionary<string, List<string>> SurnameMeaningDictionary = new()
    {
        { "김", new List<string> { "금", "귀하다", "쇠", "금빛" } },
        { "이", new List<string> { "오얏", "자두", "열매", "이슬" } },
        { "박", new List<string> { "순박하다", "소박한", "박달나무", "나무" } }, // 朴 '나무 껍질 박' — 나무(2026-10-28: 사전 낱말이 대표 한자 훈과 하나도 맞지 않아 0개였다)
        { "최", new List<string> { "높다", "으뜸", "최고" } },
        { "정", new List<string> { "바르다", "정의", "고요하다" } },
        { "강", new List<string> { "강하다", "강물", "굳세다" } },
        { "조", new List<string> { "비추다", "아침", "고요" } },
        { "윤", new List<string> { "윤택하다", "빛나다", "고르다" } },
        { "장", new List<string> { "기르다", "길다", "크다" } },
        { "임", new List<string> { "수풀", "숲", "우거지다" } },
        { "한", new List<string> { "크다", "한가하다", "나라" } },
        { "오", new List<string> { "깨닫다", "오르다", "다섯" } },
        { "서", new List<string> { "상서롭다", "서쪽", "글" } },
        { "신", new List<string> { "새롭다", "신비", "믿다" } },
        { "권", new List<string> { "권하다", "힘", "바르다" } },
        { "황", new List<string> { "누르다", "빛나다", "임금" } },
        { "안", new List<string> { "편안하다", "안정", "편히" } },
        { "송", new List<string> { "소나무", "늘푸른", "굳세다" } },
        { "류", new List<string> { "버드나무", "부드럽다", "흐르다" } },
        { "유", new List<string> { "버드나무", "부드럽다", "넉넉하다" } },
        { "홍", new List<string> { "붉다", "넓다", "크다" } },
        { "전", new List<string> { "온전하다", "밭", "펼치다" } },
        { "고", new List<string> { "높다", "고귀하다", "크다" } },
        { "문", new List<string> { "글", "무늬", "문화" } },
        { "양", new List<string> { "버드나무", "빛나다", "바다" } },
        { "손", new List<string> { "자손", "겸손", "이어가다" } },
        { "배", new List<string> { "짝", "절하다", "나누다" } },
        { "백", new List<string> { "밝다", "하얗다", "맑다" } },
        { "하", new List<string> { "강물", "흐르다", "여름", "아래" } },
        { "남", new List<string> { "따뜻하다", "남쪽", "봄" } },
        { "심", new List<string> { "심다", "깊다", "마음" } },
        { "노", new List<string> { "힘쓰다", "노력", "밝다" } },
        { "천", new List<string> { "하늘", "샘", "천리" } },
        { "민", new List<string> { "백성", "민첩하다", "슬기롭다" } },
        { "진", new List<string> { "참되다", "진실", "나아가다" } },
        // 복성 — 대표 한자 두 글자의 훈 가운데 이름 뜻으로 쓸 낱말만(于 '어조사'·孤 '외로울'·空 '빌'·諸 '모두'는 두지 않는다). 옛 코드는 대표 한자가 한 글자일 때만
        // 성씨 뜻을 찾아 복성 아이는 성씨 뜻 잇기가 0개였다 — 예비 경로 ③이 복성에서도 돌게
        { "남궁", new List<string> { "집" } },
        { "황보", new List<string> { "클" } },
        { "선우", new List<string> { "곱다" } },
    };

    // ===== 성씨+이름=단어 패턴 DB — surname-meaning: 성씨와 이어 읽으면 낱말이 되는 이름 첫 글자 =====
    private static readonly List<(string Surname, string GivenName, string CombinedWord, string Meaning)> SurnameWordPatterns = new()
    {
        // 자연/풍경
        ("이", "슬", "이슬", "아침 이슬"),
        ("하", "늘", "하늘", "하늘"),
        ("강", "산", "강산", "강과 산, 국토"),
        ("강", "물", "강물", "흐르는 강물"),
        ("하", "람", "하람", "하늘의 바람"),
        ("이", "솔", "이솔", "소나무 이름"),
        ("송", "이", "송이", "꽃송이"),
        ("한", "별", "한별", "큰 별"),
        ("한", "울", "한울", "큰 울타리, 하늘"),
        ("강", "별", "강별", "강가의 별"),
        ("노", "을", "노을", "저녁노을"),
        ("이", "른", "이른", "이른 아침"),
        ("백", "합", "백합", "백합꽃"),
        ("남", "산", "남산", "남쪽 산"),
        ("천", "리", "천리", "먼 길, 천리길"),

        // 의미/가치
        ("신", "비", "신비", "신비로움"),
        ("신", "뢰", "신뢰", "믿음"),
        ("고", "운", "고운", "고운 마음"),
        ("고", "을", "고을", "마을, 고장"),
        ("문", "화", "문화", "문명과 문화"),
        ("안", "녕", "안녕", "편안한 안녕"),
        ("정", "성", "정성", "정성스러운 마음"),
        ("정", "의", "정의", "올바름"),
        ("유", "리", "유리", "맑은 유리"),
        ("배", "움", "배움", "배움의 길"),
        ("손", "길", "손길", "따뜻한 손길"),
        ("심", "은", "심은", "심어놓은, 씨앗"),
        ("민", "들", "민들", "민들레"),

        // 음운 유희
        ("이", "사", "이사", "새 출발"),
        ("강", "하", "강하", "강하다"),
        ("홍", "익", "홍익", "넓게 이롭다"),
        ("서", "울", "서울", "서울"),
        ("서", "연", "서연", "상서로운 인연"),
        ("서", "하", "서하", "상서로운 여름"),
        ("한", "솔", "한솔", "큰 소나무"),
        ("한", "나", "한나", "하나, 유일"),
        ("한", "빛", "한빛", "큰 빛"),
        ("오", "름", "오름", "올라가는 것"),
        ("오", "솔", "오솔", "오솔길"),
        ("백", "설", "백설", "흰 눈"),
        ("전", "설", "전설", "이야기"),

        // 감성/서정
        ("이", "랑", "이랑", "밭이랑, 물결"),
        ("이", "봄", "이봄", "봄이 오다"),
        ("하", "윤", "하윤", "여름의 윤택함"),
        ("하", "은", "하은", "여름의 은혜"),
        ("하", "진", "하진", "여름의 참됨"),
        ("강", "솔", "강솔", "강한 소나무"),
        ("신", "해", "신해", "새로운 바다"),
        ("유", "하", "유하", "넉넉한 여름"),
        ("유", "나", "유나", "넉넉한 나"),
        ("임", "하", "임하", "숲의 여름"),
        ("조", "은", "조은", "좋은"),
        ("진", "솔", "진솔", "진심과 소나무"),
        ("진", "서", "진서", "참된 글"),
        ("남", "이", "남이", "따뜻한 이"),
        ("송", "하", "송하", "소나무 아래"),
    };

    // ===== 키워드 → 뜻 낱말 (훈의 낱말과 맞춘다 — 부분 일치 아님) =====
    // 웹 폼 안내('예: 사랑, 희망, 빛')와 흔한 입력(바다·하늘)은 훈에 실제로 나오는 꼴로 둔다(희망 → 바랄, 빛 → 빛날·밝을).
    // 키는 키워드 낱말과 같을 때만 쓴다(KeywordTokens — 옛 keyword.Contains 는 '겸손' 안의 '손'을 찾아 手·賓 '손'을 끌어왔다).
    // 숲·햇님은 훈에 그 꼴이 없어(林 '수풀 림'·旭 '아침 해 욱') 후보가 0개였다. 행복·기쁨·평화는 같은 뜻의 훈 낱말(복·기쁠·편안할)로 —
    // 훈에 '행복'·'평화'가 없어 키워드 음절 소리('행' + 자 = 행자)로만 채웠다
    private static readonly Dictionary<string, List<string>> KeywordMeaningMap = new()
    {
        { "신", new List<string> { "신", "신성", "신비" } },
        { "손", new List<string> { "손", "재능", "기술" } },
        // 예술 — 옛 '아름답다'는 玟 '아름다운 돌'·瑤·琪 '아름다운 옥'을 '예술의 뜻'이라 적었다(2차 검증). 藝 '재주 예'의 뜻 '재주'로
        { "예술", new List<string> { "예술", "재주" } },
        { "지혜", new List<string> { "지혜", "슬기", "지식", "명석" } },
        { "용기", new List<string> { "용기", "용맹", "굳세다" } },
        { "사랑", new List<string> { "사랑", "인자", "자비" } },
        { "희망", new List<string> { "희망", "바라다", "소망" } },
        { "빛", new List<string> { "빛", "빛나다", "밝다" } },
        { "바다", new List<string> { "바다" } },
        { "하늘", new List<string> { "하늘" } },
        { "숲", new List<string> { "숲", "수풀" } },
        { "햇님", new List<string> { "해", "햇빛" } },
        { "행복", new List<string> { "행복", "복", "기쁘다" } },
        { "기쁨", new List<string> { "기쁨", "기쁘다" } },
        { "평화", new List<string> { "평화", "편안하다" } },
        { "평안", new List<string> { "평안", "편안하다" } },
        // 흔한 키워드인데 뜻 한자가 이름 짝을 거의 못 찾던 것(2차 검증 키워드 40종 × 성 17 × 성별 3: 0개 8실행·5개 미만 57실행 —
        // 봄 春 '춘'·꿈 夢 '몽'은 짝 실명이 적고 꽃 榮·花 는 Female 이라 남아 풀에서 빠졌다, 축복은 훈에 맞는 낱말이 없었다).
        // 그 키워드의 뜻으로 읽히는 이름 훈 낱말을 더한다: 봄 → 따뜻할(溫·暖)·싹(芽), 꽃 → 꽃부리(英), 꿈 → 바랄(希·望), 축복 → 복(福·祉·祥·禧)
        { "봄", new List<string> { "봄", "따뜻하다", "싹" } },
        { "꽃", new List<string> { "꽃", "꽃부리" } },
        { "꿈", new List<string> { "꿈", "바라다" } },
        { "축복", new List<string> { "축복", "복" } },
    };

    // ===== 뜻 갈래 — 낱말이 같아도 뜻이 다른 훈(동음이의) =====
    // 낱말 일치만으로는 '신의 손'이 履 '신 리'(신발)·賓 '손 빈'(손님)을, '달'이 懸 '달 현'(매달다)·注 '주 달 주'·甘 '달 감'(달다)을 골라
    // '키워드 … 의 뜻을 담은'이라는 거짓 설명이 나왔다(검증 P14 첫 카드 63/63). 아래 낱말은 검수한 글자로만 잇는다(키워드 낱말·뜻 표 낱말·
    // 관용구 뜻 낱말·성씨 대표 한자 훈 낱말 공통). 키워드·뜻 표·관용구에 나오는 낱말과 성씨 대표 한자 훈 낱말을 낱말마다 덤프해 사람이 고른 표다
    // (인명 빈출·Core 글자만 — 낯선 글자는 어차피 쓰지 않는다). 빈 배열 = 그 낱말로는 잇지 않는다.
    private static readonly Dictionary<string, string[]> SenseHanja = new()
    {
        ["신"] = new[] { "神" },          // 履 '신 리'·屨·靴·鞋 = 신발
        ["손"] = new[] { "手" },          // 賓 '손 빈'·客 '손 객' = 손님
        ["달"] = new[] { "月", "皎" },    // 懸 '달 현'(매달다)·注 '주 달 주'(주를 달다)·甘 '달 감'(달다)
        ["비"] = new[] { "雨", "霽" },    // 彗 '비 혜' = 빗자루
        ["돌"] = new[] { "石", "玟" },    // 廻 '돌 회'·巡·循·旋·還·般 = 돌다, 晬·朞·稘 = 돌(첫 생일)
        ["눈"] = new[] { "雪" },          // 目 '눈 목'·眼 '눈 안' = 눈알
        ["해"] = new[] { "旭", "昶" },    // 年 '해 년'·歲 '해 세' = 나이·해마다
        ["강"] = new[] { "江" },          // 強·强 '강할 강'(명사 활용형 규칙이 '강할'을 맞춘다)
        ["섬"] = new[] { "島", "嶼" },    // 石 '섬 석'은 곡식 되 단위 — 성씨 석(石)이 島 '섬 도'를 끌어왔다
        ["말"] = new[] { "馬" },          // 斗 '말 두'(되)·詞 '말 사'(말씀)·勿 '말 물'(하지 말라) — 성씨 마(馬)
        ["풀"] = new[] { "草", "蔡" },    // 釋 '풀 석'·解 '풀 해'(풀다) — 성씨 채(蔡)
        ["공"] = new[] { "球", "鞠" },    // 功 '공 공'·勳 '공 훈'(공로) — 성씨 국(鞠 '공 국' = 공차기 공)
        ["모"] = new[] { "方" },          // 苗 '모 묘'(볏모) — 성씨 방(方 '모 방' = 모서리)
        ["누르다"] = new[] { "黃" },      // 抑 '누를 억'(내리누르다) — 성씨 황(黃 '누를 황' = 누런빛)
        ["누를"] = new[] { "黃" },
        ["다"] = new[] { "皆", "咸" },    // 極 '다할 극'(명사 활용형 규칙) — 성씨 함(咸 '다 함' = 모두)
        ["짤"] = Array.Empty<string>(),   // 搾 '짤 착'(짜내다)·織 '짤 직'(베 짜다) — 咸 '짤 함'(소금기)과 다르다
        ["쌀"] = new[] { "米" },          // 包 '쌀 포'(싸다) — 성씨 미(米)
        ["점"] = new[] { "卜" },          // 點 '점 점'(점 찍다) — 성씨 복(卜 '점 복' = 점치다)
        ["의지"] = Array.Empty<string>(), // 依·奇 '의지할'(기대다) — 관용구 '지조와 절개'의 뜻 '의지'(뜻)와 다르다
        ["광대"] = Array.Empty<string>(), // 倡 '광대 창'(어릿광대) — 관용구 '푸른 하늘'의 뜻 '광대'(넓고 큼)와 다르다
    };

    // 낱말은 맞지만 그 낱말이 다른 뜻·드문 독음으로 쓰인 글자 — 이 글자만 뺀다
    private static readonly Dictionary<string, string[]> SenseExcluded = new()
    {
        ["가을"] = new[] { "省" },        // '가을 사냥 선'
        ["노래"] = new[] { "誇" },        // '노래할 구'(드문 독음 — 첫 훈 '자랑할 과')
        ["덕"] = new[] { "得" },          // '덕 덕'(德 통가 — 첫 훈 '얻을 득')
        ["빛"] = new[] { "色", "橫" },    // 色 '빛 색' = 빛깔, 橫 '빛 광'(드문 독음 — 첫 훈 '가로 횡')
        ["밝다"] = new[] { "洞", "聰" },  // 洞 '밝을 통'(드문 독음 — 첫 훈 '골 동'), 聰 '귀 밝을 총'(귀가 밝다 — 빛과 다른 뜻)
        ["산"] = new[] { "嵌" },          // '산 모양 잠'(드문 독음 — 첫 훈 '산골짜기 감')
        ["아침"] = new[] { "調" },        // '아침 주'(드문 독음 — 첫 훈 '고를 조')
        ["옥"] = new[] { "王" },          // '옥 옥'(드문 독음 — 첫 훈 '임금 왕')
        ["온화"] = new[] { "籍" },        // '온화할 자'(드문 독음 — 첫 훈 '문서 적')
        ["흐르는"] = new[] { "涉" },      // '피 흐르는 모양 첩'
        ["물"] = new[] { "咬", "活", "湯" }, // 咬 '물 교'(깨물다), 活 '물 콸콸 흐를 괄'·湯 '물 세차게 흐를 상'(드문 독음)
        ["나무"] = new[] { "南", "朴" },  // 南 '나무 나'(南無 — 음차), 朴 '나무 껍질 박'
        ["깨끗"] = new[] { "洗" },        // '깨끗할 선'(드문 독음 — 첫 훈 '씻을 세')
        ["이을"] = new[] { "而" },        // '말 이을 이'(접속 허사)
        ["싹"] = new[] { "茗" },          // '차 싹 명'(찻잎 — 봄의 '싹'과 다른 뜻)
    };

    // 실명 통계에 20명 이상 있지만 생활 낱말로 읽히는 이름(서민 21명 — 민수/서연의 둘째 카드였다, 격자 378건). 공용 생활어 목록
    // (ForbiddenWordData)은 다른 엔진과 함께 쓰므로 부모 엔진(과 standard 합류) 거르기에만 둔다. 하루·누리·아름·하늘·사랑처럼 이름으로 흔히 쓰는 순우리말 낱말은 두지 않는다.
    // 2차 검증 뒤 더한 것(격자·키워드·현실 출력 이름 덤프를 사람이 검수 — 괄호는 실명 수): 병·흩어짐·풀림으로 읽히는 이환 罹患(469)·이산 離散(260)·이완 弛緩(153),
    // 한자어 명사 진리(155)·경리(47 — 박 + 경리 = 소설가 이름)·현직(31)·시월(20)·성경(338)·경성(46)·찬양(234)·동해(449)·서해(64)·대양(52)·소중(89)·희소 稀少(42 — 한소희
    // 어머니 + 딸의 첫 카드)·천하 天下(21)·해지 解止(42)와 소망형 추상명사 은총(788)·환희(2,221)·신비(414)·영광(971)·영웅(796)
    private static readonly HashSet<string> WordLikeRealNames = new()
    {
        "서민", "우리", "승리", "하라", "총명", "지양", "양자", "태풍", "복음", "세상", "용기", "성실", "행운", "행복", "보석", "예술", "단풍", "장군",
        "이환", "이산", "이완", "진리", "경리", "현직", "시월", "성경", "경성", "찬양", "동해", "서해", "대양", "소중", "희소", "천하", "해지",
        "은총", "환희", "신비", "영광", "영웅",
    };

    // 훈 조각 "연꽃 련(연)" → 훈 '연꽃', 독음 '련', 두음 꼴 '연'
    private static readonly Regex GlossSegment = new(@"^(?<hun>.*\S)\s+(?<r>[가-힣])(?:\((?<alt>[가-힣])\))?$", RegexOptions.Compiled);

    public async Task<List<ParentBasedNameCandidate>> GenerateCandidatesAsync(
        string lastName,
        string? fatherSurname,
        string? fatherName,
        string? motherSurname,
        string? motherName,
        string? storyKeyword,
        DateTime birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null)
    {
        var ctx = new Ctx(lastName, fatherSurname, fatherName, motherSurname, motherName, storyKeyword, gender, tone);
        // family-meaning 만 쓴다 — 부모 이름 음절 한자를 /evaluate(같은 이름·출생일·시각·성별) 배정과 같은 글자로
        if (ctx.HasBothNames) ctx.Yongshin = CalculateYongshin(birthDate, birthTime);

        // 생성 순서 = 같은 이름의 선점 순서(먼저 만든 방식이 그 이름을 갖는다). parent-initials 는 늘 교차 조합 하나와 같은 이름이라
        // 다른 방식보다 먼저 만들어야 남는다.
        var initials = ctx.HasBothNames ? ParentInitials(ctx) : new();
        var meaning = ctx.HasBothNames ? FamilyMeaning(ctx) : new();
        var syllables = ctx.FatherName != null || ctx.MotherName != null ? await ParentSyllablesAsync(ctx) : new();
        var shared = ctx.HasBothNames ? SharedSyllable(ctx) : new();
        var initialPlus = ctx.MotherName != null ? InitialPlusPartner(ctx, fromMother: true)
            : ctx.FatherName != null ? InitialPlusPartner(ctx, fromMother: false) : new();
        var motherSurnameFirst = ctx.MotherSurname != null ? MotherSurnameFirst(ctx) : new();
        var motherSound = ctx.MotherSurname != null ? MotherSoundLast(ctx) : new();
        var keyword = ctx.Keyword != null ? KeywordMeaning(ctx) : new();
        // 성씨 자동은 부모 이름·키워드가 모두 없을 때만 — 있으면 입력과 무관한 후보가 섞였다(부모 이름을 준 실행 출력의 16.8%, /search 부모 탭 첫 카드 57%).
        // 있어도 아래 예비 경로를 다 거쳐 5개 미만이면 뒤에 붙인다
        var surnameFirst = ctx.FatherName == null && ctx.MotherName == null && ctx.Keyword == null;
        var surname = surnameFirst ? SurnameMeaning(ctx) : new();

        // 라운드 로빈 순서 = '첫 번째 후보'(화면 배너) 우선순위. 부모 이름 글자에서 나온 실명 후보가 맨 앞에 오게 부모 이름 글자 방식을 앞에 두고,
        // 어머니 성씨 방식은 뒤로 — 옛 순서는 윤고은 모델(어머니 성 + 어머니 이름 = 어머니 전체 이름)이 어머니 성·이름을 준 실행의 첫 자리를 100% 차지했다.
        var queues = new List<Queue<ParentBasedNameCandidate>>
        {
            new(meaning), new(initials), new(syllables), new(shared), new(initialPlus),
            new(motherSurnameFirst), new(motherSound), new(keyword), new(surname),
        };
        var result = new List<ParentBasedNameCandidate>();
        while (result.Count < MaxTotal && queues.Any(q => q.Count > 0))
        {
            foreach (var q in queues)
            {
                if (q.Count > 0 && result.Count < MaxTotal)
                    result.Add(q.Dequeue());
            }
        }

        // 뒤로 보내기(안정 정렬 — 나머지 순서는 그대로): 유행 이름(AestheticEngine.IsTrendyName — 미학 −5 목록)은 배너뿐 아니라 목록에서도 뒤로
        // (부모 첫 글자 잇기가 라운드 로빈 둘째 자리라 민수/서연 → '민서'가 상위 10에 늘 들었다 — 2차 검증 상위 10의 유행 이름 2.3%, 민서 253건),
        // 그 뒤에 아이 성을 되풀이하는 이름 — 끝 음절 = 외자 성(유 + 진유 = '유진유'), 첫 음절 = 성의 두음 꼴(이 + 리윤 = '이리윤', 임 + 림X)
        result = result
            .OrderBy(c => ctx.EchoesSurname(c.Name) ? 2 : AestheticEngine.IsTrendyName(c.Name) ? 1 : 0)
            .ToList();

        // 배너 자리('첫 번째 후보'): 부모 이름 글자에서 나온 실명 가운데 가장 자연스러운 이름 — 두 글자 모두 부모 이름에서 온 방식
        // (family-meaning·parent-initials·parent-syllables)을 먼저, 그다음 부모 글자 + 실명 짝 글자 방식. 같은 묶음 안에서는 유행 이름 뒤,
        // 실명 빈도 높은 순. 라운드 로빈 맨 앞(뜻 잇기)의 첫 후보가 실명 하한(20명)을 겨우 넘는 낱말(서민 21명)일 때가 있어 빈도로 고른다.
        // 반대 성별로 기우는 이름은 이미 본 목록에 없다(예비 목록). 그런 후보가 없으면(키워드만 준 입력 등) 라운드 로빈 순서 그대로.
        var banner = result
            .Select((c, i) => (c, i))
            .Where(x => ParentNamingModels.IsParentLetterModel(x.c.NamingModel) && RealNamePartners.IsRealName(x.c.Name))
            .OrderBy(x => ctx.EchoesSurname(x.c.Name) ? 1 : 0)
            .ThenBy(x => x.c.NamingModel is ParentNamingModels.FamilyMeaning or ParentNamingModels.ParentInitials or ParentNamingModels.ParentSyllables ? 0 : 1)
            .ThenBy(x => AestheticEngine.IsTrendyName(x.c.Name) ? 1 : 0)
            .ThenByDescending(x => NameGenderData.NameCounts(x.c.Name) is { } v ? v.m + v.f : 0)
            .ThenBy(x => x.i)
            .Select(x => (int?)x.i)
            .FirstOrDefault();
        if (banner is > 0)
        {
            var top = result[banner.Value];
            result.RemoveAt(banner.Value);
            result.Insert(0, top);
        }

        // 후보가 너무 적으면(한쪽 부모 외자 이름·짝 실명이 없는 키워드 등) 예비 경로를 차례로 — 공통 거르기는 모두 지난다
        if (result.Count < MinResults) FillReserves(ctx, result, surnameFirst);

        return result;
    }

    /// <summary>
    /// 예비 경로(결과가 <see cref="MinResults"/> 미만일 때만, 앞 단계로 채워지면 멈춘다):
    ///  ① 부모 이름의 모든 글자(첫 글자만이 아니라 — 아버지 '병철'의 '병'은 부정 음절이라 첫 글자 방식이 0개였다) + 실명 짝 글자, 앞·뒤 두 자리
    ///  ② 실명 통계에 없는(20명 미만) 부모 글자 조합(반대 성별로 읽히는 조각은 ④로)
    ///  ⑤ 키워드가 있으면 — 키워드 뜻 한자 음절 모두 + 실명 짝 글자를 앞·뒤 두 자리에서 더 넓게(본 경로는 앞 6음절·자리마다 2개), 그래도 모자라면
    ///    같은 찾기를 성별 검사 없이(성별 안내) — 키워드와 무관한 성씨 뜻보다 먼저(2차 검증: 키워드만 준 김 + 여아 + '봄'·'꿈'·'축복'의 유일한 카드가
    ///    성씨 뜻 '부용'이었고, '봄' 실행 94/2,040 의 첫 카드가 성씨 뜻 잇기였다)
    ///  ③ 성씨 뜻 잇기(본 경로에서 돌지 않았을 때)
    ///  ④ 성별 검사만 완화 — 반대 성별로 기우는 부모 글자 조합과, ①을 성별 검사 없이 다시 찾은 이름(성씨 뜻으로도 모자랄 때의 마지막 자리)
    /// </summary>
    private void FillReserves(Ctx ctx, List<ParentBasedNameCandidate> result, bool surnameRan)
    {
        if (result.Count < MinResults) Append(result, ExtraParentPartners(ctx));
        if (result.Count < MinResults) Append(result, ctx.Fallback);
        if (ctx.Keyword != null)
        {
            if (result.Count < MinResults) Append(result, ExtraKeywordPartners(ctx, relaxGender: false));
            if (result.Count < MinResults)
                Append(result, ctx.OppositeGender.Where(c => IsKeywordModel(c.NamingModel))
                    .Concat(ExtraKeywordPartners(ctx, relaxGender: true)).Select(c => WithGenderNote(ctx, c)), MinResults);
        }
        if (result.Count < MinResults && !surnameRan) Append(result, SurnameMeaning(ctx));
        // ④는 설명 끝에 성별 안내(standard 탭 GenderNote 와 같은 말 — '주로 남자 이름')를 붙인다. 아버지 '철'만 + 딸처럼 부모 글자가 든 실명이 모두
        // 반대 성별이고 성씨 뜻도 모자랄 때만 온다
        if (result.Count < MinResults)
            Append(result, ctx.OppositeGender.Where(c => !IsKeywordModel(c.NamingModel)).Concat(RelaxedParentPartners(ctx)).Select(c => WithGenderNote(ctx, c)), MinResults);

        // 반대 성별 단계(성별 안내를 붙인 이름)는 5개를 채울 만큼만 — 같은 성별 단계는 상한까지 붙인다
        static void Append(List<ParentBasedNameCandidate> result, IEnumerable<ParentBasedNameCandidate> more, int limit = MaxTotal)
        {
            foreach (var c in more)
            {
                if (result.Count >= limit) break;
                if (result.All(r => r.Name != c.Name)) result.Add(c);
            }
        }
    }

    private static bool IsKeywordModel(string code) => code is ParentNamingModels.KeywordMeaning or ParentNamingModels.KeywordSound;

    /// <summary>
    /// 예비 경로 ⑤ — 키워드 뜻 한자 음절(KeywordMeaning 이 찾은 것 모두) + 실명 짝 글자, 앞 자리·뒤 자리(본음 꼴 먼저) 자리마다 6개까지,
    /// 그다음 키워드 어간 음절 소리 + 짝 글자(본 경로 5단계와 같은 설명). <paramref name="relaxGender"/> = 성별 검사 없이(RealNamePartners relaxGender —
    /// 호출자가 성별 안내를 붙인다, 성별 '무관' 요청은 이미 검사가 없어 빈 목록). 공통 거르기·선점은 그대로.
    /// </summary>
    private static List<ParentBasedNameCandidate> ExtraKeywordPartners(Ctx ctx, bool relaxGender)
    {
        var list = new List<ParentBasedNameCandidate>();
        if (ctx.Keyword == null || (relaxGender && ctx.Gender == "none")) return list;
        var kw = ctx.Keyword;
        const int perSide = 6;
        foreach (var a in ctx.KeywordMatches)
        {
            var lead = $"키워드 '{kw}'의 뜻 '{a.Gloss}'{KoreanUtils.EulReul(KoreanUtils.JosaBase(a.Gloss))} 담은";
            var sides = new List<(string Anchor, bool First)> { (a.Syllable, true), (a.Back, false) };
            if (a.Back != a.Syllable) sides.Add((a.Syllable, false));
            foreach (var (anchor, first) in sides)
            foreach (var p in RealNamePartners.Find(anchor, first, ctx.Gender, ctx.Tone, perSide, ctx.Accept, ctx.Visible, relaxGender))
            {
                if (list.Any(x => x.Name == p.Name)) continue;
                list.Add(Make(ParentNamingModels.KeywordMeaning, p.Name, first
                    ? $"{lead} '{anchor}'에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"
                    : $"{lead} '{anchor}'{KoreanUtils.EulReul(anchor)} 끝 글자로 두고 앞에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 둔 이름"));
            }
        }
        // 뜻 한자 음절 다음에 키워드 어간 음절 소리 — 뜻 한자가 짝 실명을 못 찾는 키워드('산' → 岳 '큰 산 악' 하나뿐)도 키워드에서 채운다
        {
            foreach (var syl in KeywordStems(KeywordTokens(kw)).SelectMany(t => t.Select(c => c.ToString())).Distinct())
            foreach (var first in new[] { true, false })
            foreach (var p in RealNamePartners.Find(syl, first, ctx.Gender, ctx.Tone, perSide, ctx.Accept, ctx.Visible, relaxGender))
            {
                if (list.Any(x => x.Name == p.Name)) continue;
                list.Add(Make(ParentNamingModels.KeywordSound, p.Name, $"키워드 '{kw}'의 '{syl}' 소리에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"));
            }
        }
        return list;
    }

    /// <summary>예비 경로 ④의 둘째 몫 — ①과 같은 짝 찾기를 성별 검사 없이(RealNamePartners relaxGender). 공통 거르기·선점은 그대로.</summary>
    private static List<ParentBasedNameCandidate> RelaxedParentPartners(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        if (ctx.Gender == "none") return list; // 성별 검사가 없던 요청 — ①과 같다
        foreach (var (given, father) in new[] { (ctx.FatherName, true), (ctx.MotherName, false) })
        {
            if (given == null) continue;
            for (int i = 0; i < given.Length; i++)
            {
                if (given.IndexOf(given[i]) != i) continue;
                var s = given[i].ToString();
                var code = i == 0
                    ? (father ? ParentNamingModels.FatherInitial : ParentNamingModels.MotherInitial)
                    : (father ? ParentNamingModels.FatherSyllable : ParentNamingModels.MotherSyllable);
                var where = i == 0 ? $"{Role(father)} 이름 첫 글자 '{s}'" : $"{Role(father)} 이름의 '{s}'";
                foreach (var anchorFirst in new[] { true, false })
                foreach (var p in RealNamePartners.Find(s, anchorFirst, ctx.Gender, ctx.Tone, 4, ctx.Accept, ctx.Visible, relaxGender: true))
                {
                    if (list.Any(x => x.Name == p.Name)) continue;
                    list.Add(Make(code, p.Name, anchorFirst
                        ? $"{where}에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"
                        : $"{where}{KoreanUtils.EulReul(s)} 끝 글자로 두고 앞에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 둔 이름"));
                }
            }
        }
        return list;
    }

    /// <summary>반대 성별로 기우는 이름이면 설명 끝에 성별 안내('주로 남자 이름' — NamingPrinciples.GenderLeanLabel)</summary>
    private static ParentBasedNameCandidate WithGenderNote(Ctx ctx, ParentBasedNameCandidate c)
    {
        var note = NamingPrinciples.GenderLeanLabel(c.Name, ctx.Gender);
        if (note != null && !c.Description.EndsWith(note)) c.Description = $"{c.Description} · {note}";
        return c;
    }

    /// <summary>예비 경로 ① — 부모 이름의 모든 글자 + 실명 짝 글자(앞·뒤). 첫 글자는 father-/mother-initial, 그 밖 글자는 father-/mother-syllable.</summary>
    private static List<ParentBasedNameCandidate> ExtraParentPartners(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        foreach (var (given, father) in new[] { (ctx.FatherName, true), (ctx.MotherName, false) })
        {
            if (given == null) continue;
            for (int i = 0; i < given.Length; i++)
            {
                if (given.IndexOf(given[i]) != i) continue; // 같은 이름 안에 되풀이된 글자
                var s = given[i].ToString();
                var code = i == 0
                    ? (father ? ParentNamingModels.FatherInitial : ParentNamingModels.MotherInitial)
                    : (father ? ParentNamingModels.FatherSyllable : ParentNamingModels.MotherSyllable);
                var where = i == 0 ? $"{Role(father)} 이름 첫 글자 '{s}'" : $"{Role(father)} 이름의 '{s}'";
                AddAnchorPartners(ctx, list, MaxTotal, s, perSide: 4, code,
                    (p, anchorFirst, _) => anchorFirst
                        ? $"{where}에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"
                        : $"{where}{KoreanUtils.EulReul(s)} 끝 글자로 두고 앞에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 둔 이름");
            }
        }
        return list;
    }

    // ═══════════════════════════════════════════════════════════════
    // 공통 품질 거르기 (옛 IsValidName — 자체 8단어 + 2~4음절 허용 — 대체)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 부모 기반 후보의 공통 품질 거르기 — 통과하면 null, 아니면 이유 코드. RecommendationService 가 부모 후보를 standard 랭킹에 합칠 때도 쓴다.
    ///  - 정확히 2음절 한글(옛 2~4음절 허용이 '김김춘리'·'김연서수민' 같은 3~4음절 이름을 냈다)
    ///  - 이름 첫 글자 ≠ 아이 성의 어느 음절(복성은 두 음절 모두 — 남궁 + 궁X·남X, 제갈 + 제X: 2차 검증 '제갈제윤'·'선우선영'·'남궁남윤' 26건),
    ///    같은 음절 반복 금지(민민·박박)
    ///  - 부모 이름·부모 전체 이름과 같으면 금지(아이 전체 이름 = 부모 전체 이름 포함)
    ///  - 공용 ForbiddenWordData 3종: 금칙어(이름 안, 그리고 성과 이름 경계에 걸친 것 — 천 + 민X = 천민; 성 글자 안에만 있는 금칙어는 성 탓이라 보지 않는다),
    ///    생활어 충돌, 부정 동음 이름, 그리고 이 엔진만의 낱말 이름 표(실명이어도 생활 낱말로 읽히는 서민·승리·우리 — WordLikeRealNames)
    ///  - 끝 음절이 '자'인 이름(영자·경자·순자·명자 — 옛 세대 '-자(子)' 여자 이름 꼴, 정자는 精子 동음. '사랑'의 慈 '사랑 자'가 짝 글자 둘째 자리로
    ///    상위 10에 올렸다 — '세대 중립' 원칙)
    ///  - AestheticEngine 부정 음절 감점 > 0, 성+이름 부정 패턴 감점이 성 하나만의 감점보다 크면 금지(허씨 같은 성 자체의 동음 감점은 이름 탓이 아니다)
    ///  - 음절마다 이름에 쓸 수 있는 한자가 있어야 한다(HanjaSelector.HasUsableHanja)
    /// </summary>
    public static string? QualityRejectReason(
        string name, string lastName,
        IReadOnlyCollection<string> parentGivenNames, IReadOnlyCollection<string> parentFullNames)
        => QualityRejectReason(name, lastName, parentGivenNames, parentFullNames, HanjaSelector.HasUsableHanja);

    private static string? QualityRejectReason(
        string name, string lastName,
        IReadOnlyCollection<string> parentGivenNames, IReadOnlyCollection<string> parentFullNames,
        Func<string, bool> hasUsableHanja)
    {
        if (string.IsNullOrEmpty(name) || name.Length != 2) return "length";
        if (!name.All(IsHangulSyllable)) return "hangul";
        var surname = lastName ?? string.Empty;
        if (surname.Length > 0 && surname.Contains(name[0])) return "child-surname";
        if (name[0] == name[1]) return "repeat";
        if (parentGivenNames.Contains(name) || parentFullNames.Contains(name) || parentFullNames.Contains(surname + name)) return "parent-name";
        if (ForbiddenWordData.ContainsForbiddenWord(name) || ForbiddenAcrossSurname(surname, name)) return "forbidden";
        if (ForbiddenWordData.IsCollisionWithCommonWord(name)) return "common-word";
        if (WordLikeRealNames.Contains(name)) return "word-name";
        if (name[1] == '자') return "old-generation";
        if (ForbiddenWordData.IsNegativeHomophoneName(name)) return "negative-homophone";
        if (AestheticEngine.NegativeSyllablePenalty(name) > 0) return "negative-syllable";
        if (surname.Length > 0 && AestheticEngine.FullNamePatternPenalty(surname + name) > AestheticEngine.FullNamePatternPenalty(surname))
            return "negative-full-name";
        if (!hasUsableHanja(name[..1]) || !hasUsableHanja(name[1..])) return "no-hanja";
        return null;
    }

    /// <summary>성과 이름의 경계에 걸친 금칙어(천 + 민수 = '천민')가 있는지 — 성 글자 안에만 있는 것은 세지 않는다.</summary>
    private static bool ForbiddenAcrossSurname(string surname, string name)
    {
        if (surname.Length == 0) return false;
        var full = surname + name;
        foreach (var word in ForbiddenWordData.ForbiddenWords)
        {
            if (word.Length < 2) continue; // 한 글자 금칙어는 경계에 걸칠 수 없다(이름 안 검사가 맡는다)
            for (int i = full.IndexOf(word, StringComparison.Ordinal); i >= 0; i = full.IndexOf(word, i + 1, StringComparison.Ordinal))
            {
                if (i < surname.Length && i + word.Length > surname.Length) return true;
            }
        }
        return false;
    }

    private static bool IsHangulSyllable(char c) => c >= 0xAC00 && c <= 0xD7A3;

    /// <summary>
    /// 음절의 두음 꼴 짝(초성 ㄹ ↔ ㅇ·ㄴ) — 이 ↔ 리, 임 ↔ 림, 유 ↔ 류, 여 ↔ 려(ㅣ·ㅑ·ㅕ·ㅖ·ㅛ·ㅠ 앞 ㄹ ↔ ㅇ), 노 ↔ 로, 나 ↔ 라(그 밖 모음 앞 ㄹ ↔ ㄴ),
    /// 녀 → 여. 짝이 없으면 null. 아이 성 메아리(이 + 리윤) 판정에만 쓴다.
    /// </summary>
    private static char? DueumCounterpart(char syllable)
    {
        if (!IsHangulSyllable(syllable)) return null;
        int code = syllable - 0xAC00;
        int lead = code / (21 * 28), vowel = code / 28 % 21, tail = code % 28;
        bool iotized = vowel is 2 or 6 or 7 or 12 or 17 or 20; // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
        const int N = 2, R = 5, Ieung = 11;
        int? to = lead switch
        {
            Ieung when iotized => R,
            R => iotized ? Ieung : N,
            N => iotized ? Ieung : R,
            _ => null,
        };
        return to is { } t ? (char)(0xAC00 + (t * 21 + vowel) * 28 + tail) : null;
    }

    // ═══════════════════════════════════════════════════════════════
    // 부모 이름 글자 방식
    // ═══════════════════════════════════════════════════════════════

    /// <summary>parent-initials — 아버지 이름 첫 글자 + 어머니 이름 첫 글자.</summary>
    private List<ParentBasedNameCandidate> ParentInitials(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        var f = ctx.FatherName![..1];
        var m = ctx.MotherName![..1];
        CollectParentLetter(ctx, list, Make(ParentNamingModels.ParentInitials, f + m,
            $"아버지 이름 첫 글자 '{f}'{KoreanUtils.GwaWa(f)} 어머니 이름 첫 글자 '{m}'{KoreanUtils.EulReul(m)} 이은 이름"));
        return TakeParentLetters(ctx, list, 1);
    }

    /// <summary>
    /// family-meaning — 부모 이름 음절마다 한자 한 자를 정해 그 독음의 훈(GlossForReading)으로 푼다. 이름은 부모 이름 음절 그대로 잇는다
    /// (옛 코드는 한자의 대표 독음 h.Reading 을 이어 민수/연주 → 민련, 예준/여름 → 아녀·례녀 같은 본음 음절이 들어갔다).
    /// 한자 = 요청 출생일·시각의 용신으로 고른 HanjaSelector.Select(/evaluate 의 ScoringService.AssignedHanja 와 같은 함수·같은 인자) —
    /// 카드 Hanja·배너 주석이 '이 이름 평가하기' 링크의 /evaluate 와 같은 글자다(2026-10-28 2차 검증: 용신 없이 고르던 때 격자 상위 10의 Hanja 카드 80% 가 달랐다).
    /// 설명은 '부모 이름 음절을 그 음절 한자의 훈으로 풀었다'는 구조라 배정 한자의 훈으로 다시 써도 참이다.
    /// </summary>
    private List<ParentBasedNameCandidate> FamilyMeaning(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        var narrative = FamilyNarrativeExtractor.ExtractMeaningFusionNarrative(ctx.FatherName, ctx.MotherName, ctx.Gender,
            ctx.Yongshin.Primary, ctx.Yongshin.Hee, ctx.Yongshin.Gi);
        foreach (var combo in narrative.Combinations)
        {
            var a = combo.First;
            var b = combo.Second;
            var desc = $"{Role(a.FromFather)} 이름의 '{a.Syllable}'{KoreanUtils.EulReul(a.Syllable)} '{a.Gloss}', "
                     + $"{Role(b.FromFather)} 이름의 '{b.Syllable}'{KoreanUtils.EulReul(b.Syllable)} '{b.Gloss}'{KoreanUtils.EuroRo(KoreanUtils.JosaBase(b.Gloss))} 풀어 두 뜻을 함께 담은 이름";
            var c = Make(ParentNamingModels.FamilyMeaning, combo.Name, desc);
            c.Hanja = a.Character + b.Character;
            CollectParentLetter(ctx, list, c);
        }
        return TakeParentLetters(ctx, list, CapFamilyMeaning);
    }

    /// <summary>
    /// parent-syllables — 한 부모 이름 안의 2음절 변형(NameReversalEngine — 수지 → 지수, 3음절 이름의 두 글자 고르기)과
    /// 서로 다른 부모의 글자 한 자씩(양쪽 순서). 두 이름을 이어 붙인 문자열의 반전·교환(4음절 — 민수서연 → 연서수민)은 만들지 않는다.
    /// NameReversalEngine 은 /name-analysis 도 쓰므로 고치지 않고 여기서 2음절·공통 거르기로 고른다.
    /// </summary>
    private async Task<List<ParentBasedNameCandidate>> ParentSyllablesAsync(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        foreach (var (given, fromFather) in new[] { (ctx.FatherName, true), (ctx.MotherName, false) })
        {
            if (given == null || given.Length < 2) continue;
            var variants = await _nameReversalEngine.GenerateVariantsAsync(given);
            foreach (var v in variants.Where(v => v.Name.Length == 2))
            {
                var desc = given.Length == 2 && v.Name == new string(given.Reverse().ToArray())
                    ? $"{Role(fromFather)} 이름 '{given}'의 두 글자 순서를 바꾼 이름"
                    : $"{Role(fromFather)} 이름 '{given}'의 '{v.Name[0]}'{KoreanUtils.GwaWa(v.Name[..1])} '{v.Name[1]}'{KoreanUtils.EulReul(v.Name[1..])} 이은 이름";
                CollectParentLetter(ctx, list, Make(ParentNamingModels.ParentSyllables, v.Name, desc));
            }
        }

        if (ctx.HasBothNames)
        {
            foreach (var a in ctx.FatherName!.Distinct())
            foreach (var b in ctx.MotherName!.Distinct())
            {
                if (a == b) continue;
                CollectParentLetter(ctx, list, Make(ParentNamingModels.ParentSyllables, $"{a}{b}",
                    $"아버지 이름의 '{a}'{KoreanUtils.GwaWa(a.ToString())} 어머니 이름의 '{b}'{KoreanUtils.EulReul(b.ToString())} 이은 이름"));
                CollectParentLetter(ctx, list, Make(ParentNamingModels.ParentSyllables, $"{b}{a}",
                    $"어머니 이름의 '{b}'{KoreanUtils.GwaWa(b.ToString())} 아버지 이름의 '{a}'{KoreanUtils.EulReul(a.ToString())} 이은 이름"));
            }
        }
        return TakeParentLetters(ctx, list, CapParentSyllables);
    }

    /// <summary>
    /// shared-syllable — 두 부모 이름에 함께 있는 글자 + 실명 짝 글자(옛 세대연결: 공통 글자 + 사전 앞 10자, '세대를 넘나드는' 일반 조합).
    /// 짝 글자 방식의 설명은 짝 글자의 훈을 인용하지 않는다 — 짝 글자는 뜻이 아니라 실명에서 고른 소리라, 훈('여러 루(누)'·'거느릴 솔'·'바꿀 태' —
    /// 격자 인용의 12.4%)을 뜻처럼 내세웠고, 그 훈은 출생일을 넣은 /evaluate 배정 한자의 훈과 55% 달랐다(2026-10-28 검증).
    /// </summary>
    private static List<ParentBasedNameCandidate> SharedSyllable(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        var narrative = FamilyNarrativeExtractor.ExtractGenerationalBridgeNarrative(
            ctx.FatherName, ctx.MotherName, ctx.Gender, ctx.Tone, ctx.Accept, perSyllable: CapPartnerMethod / 2, ctx.Visible);
        foreach (var b in narrative.Bridges)
        {
            AddPartner(ctx, list, CapPartnerMethod, Make(ParentNamingModels.SharedSyllable, b.Name,
                $"아버지와 어머니 이름에 함께 있는 '{b.Shared}'에 '{b.Partner}'{KoreanUtils.EulReul(b.Partner)} 더한 이름"));
        }
        return list;
    }

    /// <summary>
    /// mother-initial — 어머니 이름 첫 글자 + 실명 짝 글자(옛 복합(b): 아버지 성 + 어머니 이름 첫 글자 + 사전 앞 5자 — 이름 칸에 아버지 성이 들어가 3~4음절).
    /// 어머니 이름이 없고 아버지 이름만 있으면 같은 꼴을 아버지 이름 첫 글자로(father-initial) — 한쪽 부모만 준 입력의 후보가 1개뿐이던 것.
    /// </summary>
    private static List<ParentBasedNameCandidate> InitialPlusPartner(Ctx ctx, bool fromMother)
    {
        var list = new List<ParentBasedNameCandidate>();
        var given = fromMother ? ctx.MotherName! : ctx.FatherName!;
        var anchor = given[..1];
        var code = fromMother ? ParentNamingModels.MotherInitial : ParentNamingModels.FatherInitial;
        foreach (var p in RealNamePartners.Find(anchor, anchorFirst: true, ctx.Gender, ctx.Tone, CapPartnerMethod, ctx.Accept, ctx.Visible))
        {
            AddPartner(ctx, list, CapPartnerMethod, Make(code, p.Name,
                $"{Role(!fromMother)} 이름 첫 글자 '{anchor}'에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"));
        }
        return list;
    }

    // ═══════════════════════════════════════════════════════════════
    // 어머니 성씨 방식 — 어머니 성이 복성이거나 아이 성과 같으면 건너뛴다(성이 이름 칸에 들어가는 방식)
    // ═══════════════════════════════════════════════════════════════

    private static bool MotherSurnameUsable(Ctx ctx)
        => ctx.MotherSurname is { Length: 1 } ms && ms != ctx.LastName && !(ctx.LastName.Length > 0 && ms[0] == ctx.LastName[^1]);

    /// <summary>mother-surname — 어머니 성 + 실명 짝 글자(옛 윤고은 둘째 꼴: 어머니 성 + 사전 앞 10자. 첫 꼴 '어머니 성 + 어머니 이름'은 어머니 전체 이름이라 지웠다).</summary>
    private static List<ParentBasedNameCandidate> MotherSurnameFirst(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        if (!MotherSurnameUsable(ctx)) return list;
        var ms = ctx.MotherSurname!;
        foreach (var p in RealNamePartners.Find(ms, anchorFirst: true, ctx.Gender, ctx.Tone, CapPartnerMethod, ctx.Accept, ctx.Visible))
        {
            AddPartner(ctx, list, CapPartnerMethod, Make(ParentNamingModels.MotherSurname, p.Name,
                $"어머니 성씨 '{ms}'{KoreanUtils.EulReul(ms)} 첫 글자로 잇고 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"));
        }
        return list;
    }

    /// <summary>
    /// mother-sound — 실명 짝 글자 + 어머니 성의 끝 글자 꼴(두음 변주가 있으면 변주: 이 → 리). 옛 문소리: 아버지 성 + 사전 앞 15자 + 변주 —
    /// 이름 칸에 아버지 성이 들어가 '김김춘리'가 됐고, 변주가 없는 성(김·윤·박)에도 '변주'라고 적었다.
    /// </summary>
    private static List<ParentBasedNameCandidate> MotherSoundLast(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        if (!MotherSurnameUsable(ctx)) return list;
        var ms = ctx.MotherSurname!;
        var tail = PhoneticVariationUtils.ApplySurnameVariant(ms);
        var varied = PhoneticVariationUtils.HasVariant(ms);
        foreach (var p in RealNamePartners.Find(tail, anchorFirst: false, ctx.Gender, ctx.Tone, CapPartnerMethod, ctx.Accept, ctx.Visible))
        {
            var lead = $"'{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)}";
            var desc = varied
                ? $"어머니 성씨 '{ms}'{KoreanUtils.EulReul(ms)} 끝 글자 '{tail}'{KoreanUtils.EuroRo(tail)} 바꿔 잇고 앞에 {lead} 둔 이름"
                : $"어머니 성씨 '{ms}'{KoreanUtils.EulReul(ms)} 그대로 끝 글자로 잇고 앞에 {lead} 둔 이름";
            AddPartner(ctx, list, CapPartnerMethod, Make(ParentNamingModels.MotherSound, p.Name, desc));
        }
        return list;
    }

    // ═══════════════════════════════════════════════════════════════
    // 키워드·성씨 뜻 방식
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// keyword-meaning / keyword-sound — 뜻 매칭은 훈의 낱말 일치(옛 부분 일치는 '사랑'의 첫 카드가 嬖 '사랑할 폐' + 寵 → '폐총'이었다)와
    /// 뜻 갈래 표(<see cref="SenseHanja"/>·<see cref="SenseExcluded"/> — '신의 손'의 履 '신 리'·賓 '손 빈', '달'의 懸·注·甘 같은 동음이의 훈).
    /// 1) 키워드 뜻 한자 두 자(실명일 때), 2) 관용구 뜻 한자 두 자(실명일 때), 3) 키워드 뜻 한자 한 자 + 실명 짝 글자,
    /// 4) 키워드 소리 그대로(2음절 실명일 때 — 뜻 방식 뒤에 둔다: 앞에 두면 '김행복'·'김보석'·'김태양'이 첫 카드였다. 자리는 남겨 둔다),
    /// 5) 그래도 5개 미만이면 키워드 어간 음절 소리 + 실명 짝 글자(명사형 어미 '음'·'함'·'름'을 뗀 앞 음절 — '밝음'의 '음'으로 '예음',
    /// '따뜻함'의 '함'으로 '다함'을 만들지 않는다).
    /// 1)·2)를 실명으로 한정하는 것은 낱말 목록에 없는 낱말·조각(총기·기총·총낭·오만)이 공통 거르기를 지나서다.
    /// </summary>
    private List<ParentBasedNameCandidate> KeywordMeaning(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        var kw = ctx.Keyword!;
        var tokens = KeywordTokens(kw);
        var words = ExtractMeaningsFromKeyword(kw);
        var pool = GetFilteredHanja(ctx.Gender, ctx.Tone);
        var matched = MatchHanjaByWords(pool, words);
        ctx.KeywordMatches = matched;

        // 4)의 키워드 소리 그대로 — 낱말 안의 이웃한 두 음절(조사 뗀 낱말: '신의 손' → 신·손 — 낱말을 건너 '신의'·'의손'을 만들지 않는다).
        // 뜻 방식이 상한을 다 채워 소리 이름이 빠지지 않게 그만큼 자리를 남긴다(반대 성별로 기우는 이름은 예비 목록으로 가니 세지 않는다)
        var soundNames = new List<string>();
        foreach (var token in tokens)
        {
            for (int i = 0; i + 1 < token.Length; i++)
            {
                var name = token.Substring(i, 2);
                if (RealNamePartners.IsRealName(name) && !soundNames.Contains(name)) soundNames.Add(name);
            }
        }
        var reserved = soundNames.Count(n => ctx.Accept(n) && !ctx.LeansOpposite(n));
        var meaningCap = Math.Max(CapKeyword - reserved, CapKeyword / 2);

        // 1) 키워드 뜻 한자 두 자 — 둘째 글자는 본음 꼴 먼저(林 → 림), 실명이 아니면 첫 자리 꼴
        foreach (var a in matched)
        foreach (var b in matched)
        {
            if (a.Hanja.Character == b.Hanja.Character || !a.ShowHanja || !b.ShowHanja) continue;
            var second = SecondForm(a.Syllable, b);
            if (second == null) continue;
            var name = a.Syllable + second;
            var c = Make(ParentNamingModels.KeywordMeaning, name,
                $"키워드 '{kw}'의 뜻을 담은 '{a.Syllable}'({a.Gloss}){KoreanUtils.GwaWa(a.Syllable)} '{second}'({b.Gloss}){KoreanUtils.EulReul(second)} 이은 이름");
            c.Hanja = a.Hanja.Character + b.Hanja.Character;
            AddPartner(ctx, list, meaningCap, c);
        }

        // 2) 관용구 — 낱말 단위로 고른다(로더의 FindByKeyword 는 한 글자 키워드 부분 일치라 '알수없는키워드'의 '수'가 '맑은 물'을 끌어왔다):
        //    키워드 낱말이 관용구의 낱말(조사 '의' 뗌)이거나 관용구 뜻 낱말과 같을 때만
        var idioms = IdiomKeywordLoader.GetEntries()
            .Where(e => tokens.Overlaps(KeywordTokens(e.Idiom)) || e.Meanings.Any(tokens.Contains))
            .Take(5);
        foreach (var entry in idioms)
        {
            var idiomHanja = MatchHanjaByWords(pool, entry.Meanings);
            foreach (var a in idiomHanja.Take(4))
            foreach (var b in idiomHanja.Take(4))
            {
                if (a.Hanja.Character == b.Hanja.Character || a.Word == b.Word || !a.ShowHanja || !b.ShowHanja) continue;
                var second = SecondForm(a.Syllable, b);
                if (second == null) continue;
                var name = a.Syllable + second;
                var c = Make(ParentNamingModels.KeywordMeaning, name,
                    $"키워드 '{kw}'{KoreanUtils.GwaWa(kw)} 이어지는 관용구 '{entry.Idiom}'에서 뜻을 딴 '{a.Syllable}'({a.Gloss}){KoreanUtils.GwaWa(a.Syllable)} '{second}'({b.Gloss}){KoreanUtils.EulReul(second)} 이은 이름");
                c.Hanja = a.Hanja.Character + b.Hanja.Character;
                AddPartner(ctx, list, meaningCap, c);
            }
        }

        // 3) 키워드 뜻 한자 한 자 + 실명 짝 글자 — 짝 글자는 소리만 인용하고 후보 Hanja 는 비운다(짝 글자 한자는 풀이하지 않는다)
        foreach (var a in matched.Take(6))
        {
            var lead = $"키워드 '{kw}'의 뜻 '{a.Gloss}'{KoreanUtils.EulReul(KoreanUtils.JosaBase(a.Gloss))} 담은";
            AddAnchorPartners(ctx, list, meaningCap, a.Syllable, perSide: 2, ParentNamingModels.KeywordMeaning,
                (p, anchorFirst, used) => anchorFirst
                    ? $"{lead} '{used}'에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"
                    : $"{lead} '{used}'{KoreanUtils.EulReul(used)} 끝 글자로 두고 앞에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 둔 이름",
                backAnchor: a.Back);
        }

        // 4) 키워드 소리 그대로
        foreach (var name in soundNames)
            AddPartner(ctx, list, CapKeyword, Make(ParentNamingModels.KeywordSound, name, $"키워드 '{kw}'의 소리 '{name}'{KoreanUtils.EulReul(name)} 그대로 이름으로 삼은 이름"));

        // 5) 키워드 어간 음절 소리 + 실명 짝 글자 — 뜻이 맞는 한자를 찾지 못한 키워드(알수없는키워드)도 5개 이상
        if (list.Count < MinResults)
        {
            var syl = KeywordStems(tokens).SelectMany(t => t.Select(c => c.ToString())).Distinct().ToList();
            foreach (var s in syl)
                AddAnchorPartners(ctx, list, CapKeyword, s, perSide: 3, ParentNamingModels.KeywordSound,
                    (p, _, _) => $"키워드 '{kw}'의 '{s}' 소리에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름");
        }
        return list;
    }

    /// <summary>뜻 한자 두 자 이름의 둘째 음절 — 본음 꼴(林 → 림)로 실명이면 그 꼴, 아니면 첫 자리 꼴로 실명이면 그 꼴, 둘 다 아니면 null</summary>
    private static string? SecondForm(string first, WordMatch b)
    {
        foreach (var form in new[] { b.Back, b.Syllable }.Distinct())
        {
            if (form != first && RealNamePartners.IsRealName(first + form)) return form;
        }
        return null;
    }

    /// <summary>
    /// 키워드 낱말의 어간 — 음절 소리 폴백(5단계)에만 쓴다. 명사형 어미 '음'·'함'·'름'으로 끝나는 2음절 이상 낱말은 그 끝 음절을 뗀다
    /// ('밝음' → 밝, '따뜻함' → 따뜻, '푸름' → 푸 — 옛 폴백은 '음'·'함'·'름'을 소리로 인용해 예음·다함·여름을 냈다).
    /// </summary>
    private static IEnumerable<string> KeywordStems(IEnumerable<string> tokens)
    {
        foreach (var t in tokens)
        {
            var stem = t.Length >= 2 && t[^1] is '음' or '함' or '름' ? t[..^1] : t;
            if (stem.Length > 0) yield return stem;
        }
    }

    /// <summary>
    /// surname-meaning — 부모 이름·키워드가 모두 없을 때(API 전용)와 예비 경로 ③. 성씨와 이어 읽으면 낱말이 되는 이름 첫 글자(패턴 DB — 이 + 슬 = 이슬) + 실명 짝 글자,
    /// 그리고 성씨 대표 한자(SurnameData.RepresentativeHanja — 옛 코드는 독음 첫 2자 璞·博·最·催)의 뜻 낱말과 훈이 맞는 한자 + 실명 짝 글자.
    /// 패턴의 글자는 늘 이름 첫 글자라 성과 이어 읽은 낱말('조은')이 전체 이름에 실제로 있다(옛 '은춘'·'춘은'은 '조은'을 인용했지만 이름에 없었다).
    /// </summary>
    private List<ParentBasedNameCandidate> SurnameMeaning(Ctx ctx)
    {
        var list = new List<ParentBasedNameCandidate>();
        var ln = ctx.LastName;
        if (ln.Length == 0) return list;

        foreach (var pattern in SurnameWordPatterns.Where(p => p.Surname == ln))
        {
            foreach (var p in RealNamePartners.Find(pattern.GivenName, anchorFirst: true, ctx.Gender, ctx.Tone, 3, ctx.Accept, ctx.Visible))
            {
                AddPartner(ctx, list, CapSurname, Make(ParentNamingModels.SurnameMeaning, p.Name,
                    $"성씨 '{ln}'{KoreanUtils.GwaWa(ln)} 이어 읽으면 '{pattern.CombinedWord}'({pattern.Meaning}){KoreanUtils.IGa(pattern.CombinedWord)} 되는 '{pattern.GivenName}'에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"));
            }
        }

        SurnameData.RepresentativeHanja.TryGetValue(ln, out var rep);
        // 대표 한자 글자마다(복성은 두 글자 — 南宮)
        var repInfos = (rep ?? string.Empty).Select(ch => HanjaData.FindByCharacter(ch.ToString())).Where(h => h != null).Select(h => h!).ToList();
        if (rep == null || repInfos.Count != rep.Length) repInfos.Clear();
        var words = SurnameMeaningWords(ln, repInfos);
        if (words.Count == 0) return list;
        var surnameLabel = repInfos.Count > 0 ? $"'{ln}'({rep})" : $"'{ln}'";
        var matched = MatchHanjaByWords(GetFilteredHanja(ctx.Gender, ctx.Tone), words)
            .Where(m => repInfos.All(r => m.Hanja.Character != r.Character))
            .ToList();
        foreach (var a in matched.Take(5))
        {
            var lead = $"성씨 {surnameLabel}의 뜻 '{a.Word}'{KoreanUtils.EulReul(a.Word)} 담은";
            AddAnchorPartners(ctx, list, CapSurname, a.Syllable, perSide: 2, ParentNamingModels.SurnameMeaning,
                (p, anchorFirst, used) => anchorFirst
                    ? $"{lead} '{used}'({a.Gloss})에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 더한 이름"
                    : $"{lead} '{used}'({a.Gloss}){KoreanUtils.EulReul(used)} 끝 글자로 두고 앞에 '{p.Syllable}'{KoreanUtils.EulReul(p.Syllable)} 둔 이름",
                backAnchor: a.Back);
        }
        return list;
    }

    /// <summary>
    /// 성씨 뜻 낱말 — 대표 한자의 훈 낱말(성·성씨·나라·이름·땅 같은 일반 낱말 제외)과, 성씨 의미 사전 낱말 중 대표 한자의 훈과 맞는 것.
    /// 대표 한자가 없으면 사전 낱말 그대로. 뜻 갈래 표(SenseHanja)에 있는 낱말은 대표 한자가 그 표의 글자일 때만 쓴다 — 아니면 표의 글자와 뜻이 다르다
    /// (賓 '손 빈'의 '손'은 손님이라 표의 手 '손 수'를 끌어오면 안 된다. 石 '돌 석'의 '돌'은 표의 뜻이라 玟 '아름다운 돌'로 잇는다 —
    /// 옛 낱말 일치는 廻 '돌 회'(돌다)를 골라 석회린을 냈다).
    /// </summary>
    private static List<string> SurnameMeaningWords(string lastName, IReadOnlyList<HanjaData.HanjaInfo> repInfos)
    {
        var dict = SurnameMeaningDictionary.TryGetValue(lastName, out var d) ? d : new List<string>();
        if (repInfos.Count == 0) return dict.ToList();
        var segs = repInfos.SelectMany(r => GlossSegments(r.Meaning)).ToList();
        var fromDict = dict.Where(w => segs.Any(s => HunHasWord(s.Hun, w)));
        // 외자 성씨는 대표 한자 훈 가운데 (a) 그 성씨 독음으로 읽는 조각의 (b) 한 낱말 훈도 — 여러 낱말 훈을 낱말로 쪼개면 張 '배 부를'이
        // 배·부를, 牟 '소 우는 소리'가 소·소리가 됐다. 다른 독음 조각(朴 '칠 복')도 뺀다. 복성은 사전 낱말만
        // (대표 한자 훈 낱말을 그대로 쓰면 于 '어조사'·孤 '외로울'·空 '빌'이 뜻이 된다)
        IEnumerable<string> repWords = Enumerable.Empty<string>();
        if (repInfos.Count == 1)
        {
            // 일반 낱말·허사, 그리고 이름 뜻으로 내세우기 어려운 훈(閔 '근심할'·杜 '막을'·曲 '굽을'·孔 '구멍')
            var generic = new HashSet<string> { "성", "성씨", "나라", "이름", "땅", "고을", "어조사", "오히려", "근심할", "막을", "굽을", "구멍" };
            repWords = segs
                .Where(s => s.Reading == lastName || s.Alt == lastName)
                .Select(s => s.Hun.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                .Where(t => t.Length == 1 && !generic.Contains(t[0]))
                .Select(t => t[0]);
        }
        return repWords.Concat(fromDict).Distinct()
            .Where(w => !SenseHanja.TryGetValue(w, out var sense) || repInfos.Any(r => sense.Contains(r.Character)))
            .ToList();
    }

    // ═══════════════════════════════════════════════════════════════
    // 후보 만들기 · 담기
    // ═══════════════════════════════════════════════════════════════

    private static ParentBasedNameCandidate Make(string code, string name, string description) => new()
    {
        Name = name,
        NamingModel = code,
        NamingLabel = ParentNamingModels.LabelFor(code)!,
        NameType = ParentNamingModels.NameTypeFor(code),
        Description = description
    };

    private static string Role(bool father) => father ? "아버지" : "어머니";

    /// <summary>
    /// 부모 이름 글자 조합 모으기 — 실명(20명 이상)이면 후보 목록에, 아니면 결과가 모자랄 때만 쓰는 예비 목록에(공통 거르기는 둘 다 지난다).
    /// 실명으로 한정하는 것은 부모 글자를 이은 조합에도 낱말(연민·서수)·낯선 조각이 섞여서다.
    /// </summary>
    private static void CollectParentLetter(Ctx ctx, List<ParentBasedNameCandidate> list, ParentBasedNameCandidate c)
    {
        if (!ctx.Accept(c.Name)) return;
        if (RealNamePartners.IsRealName(c.Name))
        {
            // 반대 성별로 기우는 실명(남아 + 박지훈/최지은 → '은지' 남 2·여 5,545)은 마지막 예비 목록으로 — 옛 배너·조합 정렬은 성별을 보지 않았다
            if (ctx.LeansOpposite(c.Name)) ctx.AddOpposite(c);
            else if (list.All(x => x.Name != c.Name)) list.Add(c);
        }
        else if (ctx.LeansOpposite(c.Name))
        {
            // 실명이 아니어도 반대 성별로 읽히는 조각(아버지 '광식' + 딸 → '식광' — 2차 검증 첫 카드)은 예비 ②가 아니라 ④로(성별 안내를 붙인다)
            ctx.AddOpposite(c);
        }
        else if (ctx.Fallback.All(f => f.Name != c.Name))
        {
            ctx.Fallback.Add(c);
        }
    }

    /// <summary>
    /// 모은 부모 이름 글자 조합의 순서·상한 — 유행 이름(AestheticEngine.IsTrendyName)은 뒤, 그다음 실명 빈도 높은 순(부모 글자로 정해진 조합 안에서
    /// 가장 자연스러운 이름이 앞 — 맨 앞 방식의 첫 후보가 화면 배너다), 서수 순. 상한 안에 든 이름만 선점한다(밀린 이름은 뒤 방식이 쓸 수 있다).
    /// </summary>
    private static List<ParentBasedNameCandidate> TakeParentLetters(Ctx ctx, List<ParentBasedNameCandidate> collected, int cap)
    {
        var taken = collected
            .OrderBy(c => AestheticEngine.IsTrendyName(c.Name) ? 1 : 0)
            .ThenByDescending(c => NameGenderData.NameCounts(c.Name) is { } v ? v.m + v.f : 0)
            .ThenBy(c => c.Name, StringComparer.Ordinal)
            .Take(cap)
            .ToList();
        foreach (var c in taken) ctx.Seen.Add(c.Name);
        return taken;
    }

    /// <summary>
    /// 실명에서 고른 후보 담기 — 공통 거르기·선점 확인 후 상한까지. 반대 성별로 기우는 이름(키워드 소리·뜻 한자 두 자 — 짝 글자 찾기는
    /// RealNamePartners 가 이미 뺀다)은 마지막 예비 목록으로.
    /// </summary>
    private static void AddPartner(Ctx ctx, List<ParentBasedNameCandidate> list, int cap, ParentBasedNameCandidate c)
    {
        if (list.Count >= cap || !ctx.Accept(c.Name)) return;
        if (ctx.LeansOpposite(c.Name))
        {
            ctx.AddOpposite(c);
            return;
        }
        list.Add(c);
        ctx.Seen.Add(c.Name);
    }

    /// <summary>
    /// 기준 음절 + 실명 짝 글자(앞·뒤 번갈아). 후보 Hanja 는 비운다 — 짝 글자는 실명에서 고른 소리이고 그 한자를 풀이하지 않는다.
    /// <paramref name="describe"/> 의 인자 = 짝, 기준 음절이 앞(true)인지, 실제로 쓴 기준 음절 꼴.
    /// <paramref name="backAnchor"/> = 둘째 자리에 쓸 꼴(두음 꼴 글자의 본음 — 林: 앞 '임', 뒤 '림'). 그 꼴의 실명이 모자라면 앞 꼴로 채운다.
    /// </summary>
    private static void AddAnchorPartners(
        Ctx ctx, List<ParentBasedNameCandidate> list, int cap, string anchor, int perSide, string code,
        Func<RealNamePartners.Partner, bool, string, string> describe, string? backAnchor = null)
    {
        // 한쪽 자리에 실명이 모자라면 다른 쪽이 그만큼 더 채운다(林 '림'은 앞자리 실명이 없고 우림·태림·예림이 뒤에 있다) — 기준 음절 하나에 모두 perSide × 2 까지
        var front = RealNamePartners.Find(anchor, anchorFirst: true, ctx.Gender, ctx.Tone, perSide * 2, ctx.Accept, ctx.Visible);
        var back = RealNamePartners.Find(backAnchor ?? anchor, anchorFirst: false, ctx.Gender, ctx.Tone, perSide * 2, ctx.Accept, ctx.Visible);
        if (backAnchor != null && backAnchor != anchor && back.Count < perSide * 2)
            back.AddRange(RealNamePartners.Find(anchor, anchorFirst: false, ctx.Gender, ctx.Tone, perSide * 2 - back.Count, ctx.Accept, ctx.Visible)
                .Where(p => back.All(b => b.Name != p.Name)));
        int frontTake = Math.Min(front.Count, Math.Max(perSide, perSide * 2 - back.Count));
        int backTake = Math.Min(back.Count, perSide * 2 - frontTake);
        for (int i = 0; i < Math.Max(frontTake, backTake); i++)
        {
            foreach (var (p, anchorFirst) in new[] { (i < frontTake ? front[i] : null, true), (i < backTake ? back[i] : null, false) })
            {
                if (p == null) continue;
                AddPartner(ctx, list, cap, Make(code, p.Name, describe(p, anchorFirst, (anchorFirst ? p.Name[0] : p.Name[1]).ToString())));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 낱말 일치 (훈의 낱말 단위 — 부분 일치 금지: 금 ⊄ 임금·소금·금빛)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>뜻이 맞은 한자 — Syllable = 이름 첫 자리 꼴(두음 꼴이 있으면 두음 꼴: 林 '수풀 림(임)' → 임), Back = 둘째 자리 꼴(본음: 림 — 우림·예림),
    /// Curated = 뜻 갈래 표(SenseHanja)에서 고른 글자</summary>
    private sealed record WordMatch(HanjaData.HanjaInfo Hanja, string Syllable, string Gloss, string Word, string Back, bool Curated = false)
    {
        /// <summary>
        /// 카드 Hanja 로 보일 수 있는지 — 약자(WeakGivenNameHanjaSet — 이름 뜻으로 약한 글자)는 뜻 갈래 표 글자가 아니면 두 자 카드(키워드 뜻 한자 두 자·관용구)에
        /// 쓰지 않는다. 옛 정렬은 약자를 뒤로만 보내 음절에 대안이 없으면 남아 '예술' 카드가 玟烋(烋 약자)·玟球(球 '공 구' 약자)를 보였다(2차 검증 64장).
        /// 그 음절은 한자를 보이지 않는 짝 글자 경로(뜻 한자 한 자 + 실명 짝 글자 — 성씨 뜻 잇기 포함)로만 쓴다
        /// </summary>
        public bool ShowHanja => Curated || !HanjaData.IsWeakGivenNameHanja(Hanja.Character);
    }

    /// <summary>
    /// 풀에서 훈의 낱말이 <paramref name="words"/> 중 하나와 맞는 한자 — 음절은 맞은 훈 조각의 독음(두음 꼴이 있으면 두음 꼴: 蓮 '연꽃 련(연)' → 연),
    /// 그 음절에 쓸 수 있는 글자인지 확인. 음절마다 한 자(빈출 인명 한자 → 비약자 → 관련도 순으로 앞선 것).
    /// 뜻 갈래 표(SenseHanja)의 낱말은 표의 글자만(훈 낱말이 같아도 뜻이 다른 글자 — 履 '신 리'·賓 '손 빈'·懸 '달 현'), SenseExcluded 의 글자는 그 낱말로 맞추지 않는다.
    /// 훈이 '… 이름'인 조각(治 '강 이름 이'·崑 '산 이름 곤'·擇 '사람 이름 …')은 고유 이름 훈이라 뜻으로 맞추지 않는다.
    /// </summary>
    private static List<WordMatch> MatchHanjaByWords(List<HanjaData.HanjaInfo> pool, IReadOnlyCollection<string> words)
    {
        var found = new List<WordMatch>();
        if (words.Count == 0) return found;
        var curated = new HashSet<string>();
        var sensed = words.Where(SenseHanja.ContainsKey).ToList();
        if (sensed.Count > 0)
        {
            var byChar = pool.GroupBy(h => h.Character).ToDictionary(g => g.Key, g => g.First());
            foreach (var w in sensed)
            foreach (var ch in SenseHanja[w])
            {
                if (!byChar.TryGetValue(ch, out var h)) continue; // 요청 성별·톤 풀 밖이거나 쓸 수 없는 글자
                // 그 낱말이 든 훈 조각이 있으면 그 조각(手 '손 수'), 없으면(神 '귀신 신') 그 글자의 독음 조각
                var seg = GlossSegments(h.Meaning).Where(g => ReadsAs(h, g)).OrderByDescending(g => HunHasWord(g.Hun, w)).FirstOrDefault();
                if (seg == null) continue;
                found.Add(new WordMatch(h, ReadsAsFront(h, seg), seg.Text, w, ReadsAsBase(h, seg)));
                curated.Add(h.Character);
            }
        }
        var free = words.Where(w => !SenseHanja.ContainsKey(w)).ToList();
        if (free.Count > 0)
        {
            foreach (var h in pool)
            {
                if (curated.Contains(h.Character)) continue;
                foreach (var seg in GlossSegments(h.Meaning))
                {
                    if (seg.Hun.EndsWith("이름", StringComparison.Ordinal)) continue;
                    var word = free.FirstOrDefault(w => HunHasWord(seg.Hun, w)
                        && !(SenseExcluded.TryGetValue(w, out var ex) && ex.Contains(h.Character)));
                    if (word == null || !ReadsAs(h, seg)) continue;
                    found.Add(new WordMatch(h, ReadsAsFront(h, seg), seg.Text, word, ReadsAsBase(h, seg)));
                    break;
                }
            }
        }
        // 낯선 글자(忯 '사랑할 기'·睋 '바랄 아'·瀛 '바다 영'·獜 '튼튼할 린')가 이름을 만들지 않게 — 인명 빈출(CommonNameHanja)·Core 검수 글자·뜻 갈래 표 글자만.
        // 그런 글자가 없으면 건너뛴다(옛 폴백은 앞선 3자로 메워 '튼튼'의 첫 카드가 獜駉이었다).
        // 약자(WeakGivenNameHanjaSet)는 음절에 대안이 없을 때만 남는다(정렬 뒤) — 그런 글자는 한자를 보이는 두 자 카드에 쓰지 않는다(WordMatch.ShowHanja)
        return found
            .Where(m => curated.Contains(m.Hanja.Character) || m.Hanja.IsCoreData || HanjaData.IsCommonNameHanja(m.Hanja.Character))
            .Select(m => m with { Curated = curated.Contains(m.Hanja.Character) })
            .OrderByDescending(m => HanjaData.IsCommonNameHanja(m.Hanja.Character))
            .ThenBy(m => HanjaData.IsWeakGivenNameHanja(m.Hanja.Character))
            .ThenByDescending(m => HanjaData.CalculateRelevanceScore(m.Hanja))
            .ThenBy(m => m.Hanja.Character, StringComparer.Ordinal)
            .GroupBy(m => m.Syllable)
            .Select(g => g.First())
            .ToList();
    }

    /// <summary>
    /// 훈 조각의 독음이 그 글자의 독음인지 — 두음 꼴 조각('수풀 림(임)')은 본음·두음 꼴 어느 쪽이든 그 글자의 독음이면 된다
    /// (옛 검사는 두음 꼴만 봐서 독음 목록에 '임'이 없는 林이 '숲'에 한 번도 맞지 않았다)
    /// </summary>
    private static bool ReadsAs(HanjaData.HanjaInfo h, GlossPart seg)
        => Reads(h, seg.Reading) || (seg.Alt != null && Reads(h, seg.Alt));

    private static bool Reads(HanjaData.HanjaInfo h, string syllable) => h.Reading == syllable || h.AlternateReadings.Contains(syllable);

    /// <summary>첫 자리 꼴 — 두음 꼴(蓮 '연꽃 련(연)' → 연)이 그 글자의 독음이면 두음 꼴, 아니면 본음(林 — 독음 목록에 '임'이 없어 '림')</summary>
    private static string ReadsAsFront(HanjaData.HanjaInfo h, GlossPart seg)
        => seg.Alt != null && Reads(h, seg.Alt) ? seg.Alt : Reads(h, seg.Reading) ? seg.Reading : seg.Alt ?? seg.Reading;

    /// <summary>둘째 자리 꼴 — 본음이 그 글자의 독음이면 본음(林 → 림 — 우림·예림), 아니면 두음 꼴</summary>
    private static string ReadsAsBase(HanjaData.HanjaInfo h, GlossPart seg)
        => Reads(h, seg.Reading) ? seg.Reading : seg.Alt ?? seg.Reading;

    private sealed record GlossPart(string Hun, string Reading, string? Alt, string Text);

    /// <summary>뜻 문자열을 훈 조각으로 — "사랑 애, 그리워할 애" → (사랑, 애), (그리워할, 애). 독음 꼴이 아닌 조각은 건너뛴다.</summary>
    private static IEnumerable<GlossPart> GlossSegments(string? meaning)
    {
        if (string.IsNullOrWhiteSpace(meaning)) yield break;
        foreach (var raw in meaning.Split(',', '/', ';', '·'))
        {
            var seg = raw.Trim();
            var m = GlossSegment.Match(seg);
            if (!m.Success) continue;
            yield return new GlossPart(m.Groups["hun"].Value, m.Groups["r"].Value, m.Groups["alt"].Success ? m.Groups["alt"].Value : null, seg);
        }
    }

    /// <summary>
    /// 훈(띄어 쓴 낱말들)에 <paramref name="word"/> 가 낱말로 있는지 — 같은 낱말이거나 그 낱말의 활용형(사랑 → 사랑할·사랑하는, 귀하다 → 귀할·귀한,
    /// 높다 → 높을·높은, 빛나다 → 빛날·빛난, 바라다 → 바랄). '금'이 '임금'·'소금'·'금빛'에 맞지 않는다.
    /// </summary>
    private static bool HunHasWord(string hun, string word)
    {
        if (string.IsNullOrEmpty(word)) return false;
        var forms = WordForms(word);
        return hun.Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(forms.Contains);
    }

    // '다'로 끝나지만 용언이 아닌 낱말 — 어간 규칙을 쓰면 바다 → '발'(趾 '발 지')이 맞았다
    private static readonly HashSet<string> NounsEndingInDa = new() { "바다" };

    private static HashSet<string> WordForms(string word)
    {
        var forms = new HashSet<string> { word };
        string stem;
        if (NounsEndingInDa.Contains(word))
        {
            return forms;
        }
        if (word.EndsWith("하다") && word.Length > 2)
        {
            stem = word[..^2];
            foreach (var e in new[] { "할", "한", "하는", "히", "하다" }) forms.Add(stem + e);
            return forms;
        }
        if (word.EndsWith("다") && word.Length > 1)
        {
            stem = word[..^1];
            var last = stem[^1];
            var final = IsHangulSyllable(last) ? (last - 0xAC00) % 28 : -1;
            if (final == 0)
            {
                // 받침 없는 어간: 빛나 → 빛날·빛난, 바라 → 바랄, 굳세 → 굳셀
                forms.Add(stem[..^1] + (char)(last + 8));
                forms.Add(stem[..^1] + (char)(last + 4));
            }
            else if (final == 17)
            {
                // ㅂ 불규칙: 아름답 → 아름다울·아름다운, 새롭 → 새로울
                var open = stem[..^1] + (char)(last - 17);
                forms.Add(open + "울");
                forms.Add(open + "운");
            }
            else
            {
                foreach (var e in new[] { "을", "은" }) forms.Add(stem + e);
            }
            return forms;
        }
        // 명사: 사랑 → 사랑할·사랑하는, 지혜 → 지혜로울, 신비 → 신비로울·신비스러울
        foreach (var e in new[] { "할", "한", "하는", "로울", "로운", "스러울", "스러운" }) forms.Add(word + e);
        return forms;
    }

    /// <summary>
    /// 키워드의 뜻 낱말 — 키워드 낱말(조사 '의'·'처럼' 뗌) + 명사형의 기본형(따뜻함 → 따뜻하다, 밝음 → 밝다, 건강하게 → 건강하다 — 훈 '따뜻할'·'밝을'과 맞는다)
    /// + 키워드 뜻 표(키가 키워드 낱말과 같을 때만 — 옛 keyword.Contains 는 '겸손'에서 '손'을 찾았다).
    /// 표에 없는 키워드에 일반 낱말(아름다움·지혜·용기·사랑)을 채우지 않는다(옛 폴백은 '희망'에 '지혜'·'용기' 한자를 붙이고 설명에는 '희망'에서 뽑았다고 적었다).
    /// </summary>
    private static List<string> ExtractMeaningsFromKeyword(string keyword)
    {
        var tokens = KeywordTokens(keyword);
        var meanings = new List<string>();
        foreach (var t in tokens)
        {
            meanings.Add(t);
            if (t.Length < 2) continue;
            // '음'은 받침 있는 어간만('밝음' → 밝다 — '마음'은 '마다'가 아니다). '-름'(푸름)은 '구름' → 구르다 같은 오독이 커 두지 않는다
            if (t.EndsWith("하게") && t.Length > 2) meanings.Add(t[..^2] + "하다");
            else if (t[^1] == '함') meanings.Add(t[..^1] + "하다");
            else if (t[^1] == '음' && IsHangulSyllable(t[^2]) && (t[^2] - 0xAC00) % 28 != 0) meanings.Add(t[..^1] + "다");
        }
        foreach (var t in tokens)
        {
            if (KeywordMeaningMap.TryGetValue(t, out var v)) meanings.AddRange(v);
        }
        return meanings.Distinct().ToList();
    }

    /// <summary>키워드(또는 관용구)의 한글 낱말 — 띄어쓰기·쉼표로 나누고 끝 조사 '의'·'처럼'을 뗀다('신의 손' → 신·손, '바다처럼' → 바다).</summary>
    private static HashSet<string> KeywordTokens(string text)
    {
        var tokens = new HashSet<string>();
        foreach (var token in text.Split(new[] { ' ', ',', '·', '/' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var t = new string(token.Where(IsHangulSyllable).ToArray());
            if (t.Length > 2 && t.EndsWith("처럼")) t = t[..^2];
            if (t.Length > 1 && t.EndsWith("의")) t = t[..^1];
            if (t.Length > 0) tokens.Add(t);
        }
        return tokens;
    }

    /// <summary>
    /// 성별/톤에 맞는 한자 풀 — 키워드·성씨 뜻 한자를 찾는 범위. 불용(ForbiddenNameHanjaSet)·뜻 없는 글자는 뺀다
    /// (/name·/evaluate 와 같은 술어 HanjaSelector.IsUsableNameHanja, 2026-10-27). 순서는 사전 순서지만 이제 앞부분을 잘라 쓰지 않는다.
    /// </summary>
    private List<HanjaData.HanjaInfo> GetFilteredHanja(string gender, string tone)
    {
        var hanjaList = HanjaData.HanjaDictionary.Values.Where(HanjaSelector.IsUsableNameHanja).ToList();

        // 성별 필터링
        if (gender != "none")
        {
            hanjaList = hanjaList.Where(h =>
            {
                if (gender == "male")
                    return h.GenderPref != HanjaData.GenderPreference.Female;
                if (gender == "female")
                    return h.GenderPref != HanjaData.GenderPreference.Male;
                return true;
            }).ToList();
        }

        // 톤 필터링
        if (tone != "neutral")
        {
            hanjaList = hanjaList.Where(h =>
            {
                if (tone == "soft")
                    return h.TonePref != HanjaData.TonePreference.Strong;
                if (tone == "strong")
                    return h.TonePref != HanjaData.TonePreference.Soft;
                return true;
            }).ToList();
        }

        return hanjaList;
    }

    // ═══════════════════════════════════════════════════════════════
    // 요청 하나의 문맥 — 입력 정규화·공통 거르기·선점·음절 캐시
    // ═══════════════════════════════════════════════════════════════

    private sealed class Ctx
    {
        public string LastName { get; }
        public string? FatherSurname { get; }
        public string? FatherName { get; }
        public string? MotherSurname { get; }
        public string? MotherName { get; }
        public string? Keyword { get; }
        public string Gender { get; }
        public string Tone { get; }
        public bool HasBothNames => FatherName != null && MotherName != null;

        public List<string> ParentGivens { get; } = new();
        public List<string> ParentFulls { get; } = new();
        /// <summary>앞선 방식이 이미 담은 이름(먼저 만든 방식이 이긴다)</summary>
        public HashSet<string> Seen { get; } = new();
        /// <summary>실명 통계에 없는 부모 글자 조합 — 결과가 모자랄 때만(예비 경로 ②)</summary>
        public List<ParentBasedNameCandidate> Fallback { get; } = new();
        /// <summary>요청 성별과 반대로 뚜렷이 기우는 실명 — 결과가 모자랄 때 마지막에만(예비 경로 ④)</summary>
        public List<ParentBasedNameCandidate> OppositeGender { get; } = new();
        /// <summary>요청 출생일·시각의 용신(1순위·희신·기신) — family-meaning 음절 한자를 /evaluate 배정과 같게 고른다. 서비스가 없으면 모두 null</summary>
        public (string? Primary, string? Hee, string? Gi) Yongshin { get; set; }
        /// <summary>키워드 뜻이 맞은 한자(KeywordMeaning 이 채운다) — 예비 경로 ⑤의 키워드 짝 찾기가 다시 쓴다</summary>
        public List<WordMatch> KeywordMatches { get; set; } = new();

        private readonly Dictionary<string, HanjaData.HanjaInfo?> _visible = new();
        private readonly Dictionary<string, bool> _usable = new();

        public Ctx(string lastName, string? fatherSurname, string? fatherName, string? motherSurname, string? motherName,
            string? keyword, string gender, string tone)
        {
            LastName = Clean(lastName) ?? string.Empty;
            // 성 칸이 빈 전체 이름('김민수')을 나누는 것은 옛 /search 꼴 요청을 받는 SmartRecommendationService 몫이다(Utils/ParentNameSplit) —
            // 여기서 나누면 /parent-based 폼에 성 없이 넣은 3음절 이름('한울림')이 '한' + '울림'이 됐다
            (FatherSurname, FatherName) = (Clean(fatherSurname), Clean(fatherName));
            (MotherSurname, MotherName) = (Clean(motherSurname), Clean(motherName));
            Keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
            var g = (gender ?? "none").Trim().ToLowerInvariant();
            Gender = g is "male" or "female" ? g : "none";
            var t = (tone ?? "neutral").Trim().ToLowerInvariant();
            Tone = t is "soft" or "strong" ? t : "neutral";

            foreach (var (s, n, raw) in new[] { (FatherSurname, FatherName, fatherName), (MotherSurname, MotherName, motherName) })
            {
                if (n == null) continue;
                ParentGivens.Add(n);
                if (s != null) ParentFulls.Add(s + n);
                // 성 칸이 비고 이름 칸에 전체 이름('김민수')이 오면(POST /parent-based·POST /recommendations 직접 호출, 폼 안내를 무시한 입력)
                // 생성은 그대로 두고(한울림 보호) 나눈 이름 부분('민수')과 성 + 이름을 거르기 목록에만 더한다 — 2차 검증 엔진 직접 호출 격자 252실행에서
                // 부모 이름과 같은 후보 174건, 아이 전체 이름 = 부모 전체 이름(박 + 지훈) 30건, 첫 카드가 부모 이름인 실행 63개였다.
                // 한울림 → '울림'·'한울림'도 목록에 들지만 거르기에만 쓰니 생성에는 영향이 없다
                if (s == null && (n.Length >= 3 || (raw?.Trim().Any(char.IsWhiteSpace) ?? false)))
                {
                    var (splitSurname, splitName) = ParentNameSplit.SplitIfFullName(null, raw);
                    var given = Clean(splitName);
                    var surname = Clean(splitSurname);
                    if (surname != null && given != null)
                    {
                        if (!ParentGivens.Contains(given)) ParentGivens.Add(given);
                        if (!ParentFulls.Contains(surname + given)) ParentFulls.Add(surname + given);
                    }
                }
            }
        }

        private static string? Clean(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var t = new string(s.Where(c => !char.IsWhiteSpace(c)).ToArray());
            return t.Length == 0 ? null : t;
        }

        /// <summary>공통 품질 거르기 + 선점 확인</summary>
        public bool Accept(string name)
            => !Seen.Contains(name) && QualityRejectReason(name, LastName, ParentGivens, ParentFulls, Usable) == null;

        /// <summary>성별을 고른 요청에서 반대 성별로 뚜렷이 기우는 이름인지(NamingPrinciples.GenderLeanLabel — standard 탭 GenderNote 와 같은 판정)</summary>
        public bool LeansOpposite(string name) => NamingPrinciples.GenderLeanLabel(name, Gender) != null;

        /// <summary>
        /// 이름이 외자 아이 성을 되풀이하는지 — 끝 음절 = 성(유 + 진유 → '유진유'), 또는 첫 음절 = 성의 두음 꼴(이 + 리윤 → '이리윤', 임 + 림X, 유 + 류X,
        /// 노 + 로X — 첫 음절 = 성 그대로는 공통 거르기가 이미 뺀다). 빼지 않고 목록 뒤로만 보낸다(리나·로아처럼 흔한 이름이 있다)
        /// </summary>
        public bool EchoesSurname(string name) => LastName.Length == 1 && name.Length == 2
            && (name[1] == LastName[0] || DueumCounterpart(LastName[0]) is { } alt && name[0] == alt);

        public void AddOpposite(ParentBasedNameCandidate c)
        {
            if (OppositeGender.All(x => x.Name != c.Name)) OppositeGender.Add(c);
        }

        /// <summary>음절의 보이는 한자(HanjaSelector.Select 용신 없음, 요청 성별) — 요청 하나 안에서 캐시</summary>
        public HanjaData.HanjaInfo? Visible(string syllable)
        {
            if (!_visible.TryGetValue(syllable, out var h))
                _visible[syllable] = h = HanjaSelector.Select(syllable, Gender, null, null, null).FirstOrDefault();
            return h;
        }

        private bool Usable(string syllable)
        {
            if (!_usable.TryGetValue(syllable, out var u))
                _usable[syllable] = u = HanjaSelector.HasUsableHanja(syllable);
            return u;
        }
    }
}
