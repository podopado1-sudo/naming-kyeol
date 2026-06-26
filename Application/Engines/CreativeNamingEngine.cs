using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 창의적 작명 엔진
/// 성씨의 한자 뜻을 활용해 성+이름이 하나의 문장/구절이 되는 이름을 생성한다.
/// 패턴: (1) 성씨 음절 활용, (2) 성씨 뜻 확장, (3) 성씨+이름 = 단어
/// </summary>
public class CreativeNamingEngine : ICreativeNamingEngine
{
    /// <summary>금칙어</summary>
    private static readonly HashSet<string> ForbiddenWords = new()
    {
        "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병", "똥", "개"
    };

    /// <summary>부정적 발음 패턴</summary>
    private static readonly HashSet<string> NegativePatterns = new()
    {
        "씨발", "시발", "개새", "좆", "꺼져", "닥쳐", "미친", "지랄"
    };

    /// <summary>
    /// 성씨별 의미 사전: 성씨 → (한자, 핵심뜻, 연상 키워드들)
    /// </summary>
    private static readonly Dictionary<string, SurnameMeaning> SurnameMeanings = new()
    {
        // ── 주요 성씨 (상위 빈도) ──
        ["김"] = new("金", "금, 쇠, 귀하다", new[] { "금빛", "귀한", "빛나는", "찬란한" }),
        ["이"] = new("李", "오얏, 자두", new[] { "열매", "달콤한", "풍요로운", "자연의" }),
        ["박"] = new("朴", "순박하다", new[] { "순수한", "소박한", "꾸밈없는", "맑은" }),
        ["최"] = new("崔", "높다", new[] { "높은", "우뚝한", "드높은", "빼어난" }),
        ["정"] = new("鄭", "나라이름, 바르다", new[] { "바른", "정직한", "곧은", "올곧은" }),
        ["강"] = new("姜", "강하다, 강물", new[] { "힘찬", "흐르는", "강한", "도도한" }),
        ["신"] = new("申", "새롭다, 신비", new[] { "새로운", "신비로운", "기묘한", "놀라운" }),
        ["장"] = new("張", "펴다", new[] { "펼치는", "넓은", "활짝", "시원한" }),
        ["한"] = new("韓", "한나라, 크다", new[] { "큰", "위대한", "넓은", "드넓은" }),
        ["오"] = new("吳", "크다", new[] { "넓은", "큰", "너른", "탁트인" }),
        ["서"] = new("徐", "천천히", new[] { "여유로운", "느긋한", "고요한", "평화로운" }),
        ["윤"] = new("尹", "다스리다", new[] { "이끄는", "다스리는", "밝은", "빛나는" }),
        ["조"] = new("趙", "달리다", new[] { "빠른", "활발한", "날렵한", "씩씩한" }),
        ["임"] = new("林", "수풀", new[] { "숲", "푸른", "울창한", "생명의" }),
        ["유"] = new("劉", "흐르다, 성씨", new[] { "흐르는", "유연한", "자유로운", "넉넉한" }),
        ["송"] = new("宋", "나라이름, 소나무", new[] { "소나무", "굳센", "푸른", "곧은" }),
        ["황"] = new("黃", "누르다, 노랗다", new[] { "황금빛", "빛나는", "따뜻한", "찬란한" }),
        ["안"] = new("安", "편안하다", new[] { "편안한", "온화한", "평화로운", "포근한" }),
        ["권"] = new("權", "권세", new[] { "힘있는", "당당한", "기운찬", "위엄있는" }),
        ["홍"] = new("洪", "큰 물, 넓다", new[] { "넓은", "큰", "풍성한", "넘치는" }),
        ["문"] = new("文", "글, 무늬", new[] { "아름다운", "문채나는", "빛나는", "우아한" }),
        ["양"] = new("梁", "들보", new[] { "든든한", "지탱하는", "굳건한", "받치는" }),
        ["배"] = new("裴", "크다", new[] { "큰", "넓은", "넉넉한", "당당한" }),
        ["백"] = new("白", "하얗다", new[] { "깨끗한", "맑은", "순백의", "밝은" }),
        ["남"] = new("南", "남쪽", new[] { "따뜻한", "밝은", "양지바른", "향기로운" }),
        ["전"] = new("全", "온전하다", new[] { "완전한", "온전한", "빈틈없는", "가득한" }),
        ["심"] = new("沈", "깊다", new[] { "깊은", "그윽한", "오묘한", "심오한" }),
        ["하"] = new("河", "물, 강", new[] { "흐르는", "넓은", "맑은", "시원한" }),
        ["노"] = new("盧", "그릇, 화로", new[] { "담는", "넉넉한", "그릇큰", "너그러운" }),
        ["곽"] = new("郭", "성곽", new[] { "지키는", "든든한", "굳건한", "호위하는" }),
        ["성"] = new("成", "이루다", new[] { "이루는", "완성하는", "성취하는", "달성하는" }),
        ["차"] = new("車", "수레", new[] { "나아가는", "달리는", "앞서는", "힘찬" }),
        ["주"] = new("朱", "붉다", new[] { "붉은", "열정적인", "따뜻한", "정열의" }),
        ["우"] = new("禹", "우임금", new[] { "다스리는", "지혜로운", "슬기로운", "영명한" }),
        ["구"] = new("具", "갖추다", new[] { "갖춘", "구비된", "완벽한", "빈틈없는" }),
        ["민"] = new("閔", "근심하다/백성", new[] { "백성의", "사람을위한", "섬기는", "나누는" }),
        ["허"] = new("許", "허락하다", new[] { "베푸는", "너그러운", "관대한", "포용하는" }),
        ["류"] = new("柳", "버드나무", new[] { "유연한", "부드러운", "흔들리지않는", "푸른" }),
        ["나"] = new("羅", "비단, 벌이다", new[] { "펼치는", "고운", "화려한", "아름다운" }),
        ["진"] = new("陳", "진열하다", new[] { "펼치는", "보여주는", "드러내는", "빛나는" }),
        ["지"] = new("池", "연못", new[] { "고요한", "맑은", "깊은", "잔잔한" }),
        ["엄"] = new("嚴", "엄하다", new[] { "위엄있는", "당당한", "엄정한", "품격있는" }),
        ["고"] = new("高", "높다", new[] { "높은", "고상한", "기품있는", "드높은" }),
        ["탁"] = new("卓", "뛰어나다", new[] { "뛰어난", "탁월한", "빼어난", "출중한" }),

        // ── 추가 성씨 (110개+, 중복 없음) ──
        ["감"] = new("甘", "달다", new[] { "달콤한", "감미로운", "향긋한", "부드러운", "은은한" }),
        ["경"] = new("慶", "경사", new[] { "경사스러운", "축복의", "복된", "기쁜", "길한" }),
        ["계"] = new("桂", "계수나무", new[] { "향기로운", "고귀한", "달빛의", "맑은" }),
        ["공"] = new("孔", "구멍, 크다", new[] { "깊은", "넓은", "통하는", "열린", "크나큰" }),
        ["금"] = new("琴", "거문고", new[] { "음악의", "고운소리", "울림있는", "조화로운", "아름다운" }),
        ["기"] = new("奇", "기이하다", new[] { "특별한", "기묘한", "남다른", "독특한", "신비로운" }),
        ["길"] = new("吉", "길하다", new[] { "길한", "복된", "상서로운", "밝은", "좋은" }),
        ["도"] = new("都", "도읍", new[] { "도읍의", "중심의", "모이는", "번화한", "화려한" }),
        ["두"] = new("杜", "막다, 두견화", new[] { "지키는", "굳건한", "꽃피우는", "의지굳은" }),
        ["마"] = new("馬", "말", new[] { "달리는", "씩씩한", "힘찬", "자유로운", "용맹한" }),
        ["모"] = new("毛", "터럭", new[] { "섬세한", "부드러운", "가벼운", "나풀거리는" }),
        ["목"] = new("睦", "화목하다", new[] { "화목한", "다정한", "어울리는", "평화로운", "온화한" }),
        ["반"] = new("潘", "물가", new[] { "물가의", "맑은", "잔잔한", "반짝이는" }),
        ["방"] = new("方", "방향, 모나다", new[] { "바른", "곧은", "올곧은", "방향잡는", "단정한" }),
        ["봉"] = new("奉", "받들다", new[] { "받드는", "공경하는", "높이는", "섬기는", "존경받는" }),
        ["비"] = new("丕", "크다", new[] { "큰", "거대한", "웅장한", "넓은" }),
        ["사"] = new("謝", "감사하다", new[] { "감사하는", "고마운", "은혜로운", "보답하는" }),
        ["선"] = new("宣", "베풀다", new[] { "베푸는", "알리는", "밝히는", "선포하는", "빛나는" }),
        ["설"] = new("薛", "쑥", new[] { "향기로운", "들녘의", "자연의", "소박한" }),
        ["소"] = new("蘇", "깨어나다", new[] { "깨어나는", "소생하는", "살아나는", "새로운", "싱그러운" }),
        ["손"] = new("孫", "손자", new[] { "이어지는", "계승하는", "젊은", "미래의" }),
        ["순"] = new("荀", "풀이름", new[] { "푸른", "자연의", "향기로운", "수수한" }),
        ["승"] = new("承", "잇다", new[] { "이어가는", "받드는", "계승하는", "이어받는" }),
        ["시"] = new("施", "베풀다", new[] { "베푸는", "나누는", "주는", "넉넉한" }),
        ["어"] = new("魚", "물고기", new[] { "물속의", "자유로운", "헤엄치는", "생동하는", "맑은물의" }),
        ["여"] = new("呂", "등뼈", new[] { "곧은", "반듯한", "중심의", "바른", "든든한" }),
        ["연"] = new("延", "늘이다", new[] { "이어지는", "끝없는", "멀리뻗는", "영원한", "길게흐르는" }),
        ["염"] = new("廉", "청렴하다", new[] { "깨끗한", "맑은", "청렴한", "올곧은", "결백한" }),
        ["옥"] = new("玉", "구슬", new[] { "구슬같은", "빛나는", "맑은", "아름다운", "귀한" }),
        ["왕"] = new("王", "임금", new[] { "으뜸의", "당당한", "위엄있는", "고귀한", "기품있는" }),
        ["용"] = new("龍", "용", new[] { "기운찬", "하늘의", "용맹한", "위엄있는", "승천하는" }),
        ["원"] = new("元", "으뜸", new[] { "으뜸의", "첫째의", "시작의", "근본의", "빼어난" }),
        ["위"] = new("魏", "높다", new[] { "높은", "우뚝한", "위풍당당한", "드높은" }),
        ["육"] = new("陸", "뭍", new[] { "넓은땅의", "든든한", "단단한", "굳건한" }),
        ["인"] = new("印", "도장", new[] { "새기는", "분명한", "확실한", "뚜렷한" }),
        ["제"] = new("諸", "모든", new[] { "두루갖춘", "넓은", "포괄하는", "모두의" }),
        ["천"] = new("千", "천", new[] { "수많은", "넘치는", "풍요로운", "끝없는", "가득한" }),
        ["초"] = new("楚", "나라이름, 깨끗하다", new[] { "깨끗한", "맑은", "청초한", "기품있는" }),
        ["추"] = new("秋", "가을", new[] { "가을의", "풍요로운", "결실의", "맑은", "고요한" }),
        ["편"] = new("片", "조각", new[] { "하나의", "소중한", "귀한", "특별한" }),
        ["표"] = new("表", "겉, 드러내다", new[] { "드러내는", "빛나는", "표현하는", "분명한" }),
        ["현"] = new("玄", "검다, 그윽하다", new[] { "그윽한", "깊은", "오묘한", "신비로운", "검푸른" }),
        ["호"] = new("扈", "호위하다", new[] { "지키는", "보호하는", "든든한", "호위하는" }),
        ["화"] = new("花", "꽃", new[] { "꽃피는", "아름다운", "화사한", "빛나는", "고운" }),
        ["가"] = new("賈", "장사, 풍요", new[] { "풍요로운", "넉넉한", "풍성한", "부유한" }),
        ["갈"] = new("葛", "칡", new[] { "끈기있는", "질긴", "생명력있는", "이어지는" }),
        ["견"] = new("甄", "그릇만들다", new[] { "빚어내는", "만들어가는", "다듬는", "가꾸는" }),
        ["곡"] = new("曲", "굽다", new[] { "유연한", "변화무쌍한", "흐르는", "율동적인" }),
        ["관"] = new("管", "관악기", new[] { "맑은소리", "울리는", "통하는", "소통하는" }),
        ["국"] = new("鞠", "국화", new[] { "고결한", "향기로운", "절개있는", "늦가을의" }),
        ["근"] = new("斤", "도끼", new[] { "결단력있는", "날카로운", "확실한", "거침없는" }),
        ["단"] = new("段", "구분", new[] { "분명한", "단정한", "올곧은", "반듯한" }),
        ["담"] = new("譚", "이야기", new[] { "이야기하는", "풍부한", "깊은", "재미있는" }),
        ["당"] = new("唐", "당나라", new[] { "찬란한", "웅장한", "넓은", "위풍당당한" }),
        ["대"] = new("大", "크다", new[] { "큰", "넓은", "위대한", "거대한" }),
        ["돈"] = new("頓", "갑자기", new[] { "단번에", "결단력있는", "빠른", "과감한" }),
        ["동"] = new("董", "다스리다", new[] { "이끄는", "바로잡는", "다스리는", "영명한" }),
        ["등"] = new("鄧", "나라이름", new[] { "너그러운", "넓은", "편안한", "포근한" }),
        ["랑"] = new("浪", "물결", new[] { "물결치는", "자유로운", "시원한", "활달한" }),
        ["뢰"] = new("雷", "우레", new[] { "웅장한", "힘찬", "우렁찬", "울리는" }),
        ["매"] = new("梅", "매화", new[] { "맑은향의", "이른봄의", "꿋꿋한", "고결한" }),
        ["맹"] = new("孟", "맏이", new[] { "첫째의", "앞서는", "이끄는", "큰" }),
        ["명"] = new("明", "밝다", new[] { "밝은", "환한", "빛나는", "맑은", "명랑한" }),
        ["무"] = new("武", "무예", new[] { "씩씩한", "용맹한", "힘찬", "굳센" }),
        ["묵"] = new("墨", "먹", new[] { "깊은", "그윽한", "문채나는", "짙은" }),
        ["미"] = new("米", "쌀", new[] { "풍요로운", "알찬", "가득한", "넉넉한" }),
        ["범"] = new("范", "법, 모범", new[] { "모범이되는", "본보기의", "올바른", "바른" }),
        ["변"] = new("卞", "밝다", new[] { "밝은", "분별하는", "분명한", "뚜렷한" }),
        ["복"] = new("卜", "점치다", new[] { "예지력있는", "밝은", "통찰하는", "깊은" }),
        ["빈"] = new("賓", "손님", new[] { "귀한", "환대하는", "빛나는", "존귀한" }),
        ["빙"] = new("氷", "얼음", new[] { "맑은", "투명한", "깨끗한", "빛나는" }),
        ["상"] = new("尚", "숭상하다", new[] { "높이는", "존경하는", "드높은", "품격있는" }),
        ["석"] = new("石", "돌", new[] { "단단한", "굳건한", "변함없는", "곧은" }),
        ["섭"] = new("葉", "잎", new[] { "푸른", "새잎의", "싱그러운", "자라나는" }),
        ["수"] = new("水", "물", new[] { "맑은", "흐르는", "시원한", "깨끗한" }),
        ["식"] = new("植", "심다", new[] { "자라나는", "심어가는", "뿌리깊은", "번성하는" }),
        ["아"] = new("阿", "언덕", new[] { "높은곳의", "포근한", "감싸는", "넓은" }),
        ["예"] = new("芮", "풀", new[] { "부드러운", "싱그러운", "젊은", "푸른" }),
        ["운"] = new("雲", "구름", new[] { "자유로운", "떠다니는", "높은", "부드러운" }),
        ["은"] = new("殷", "은나라, 많다", new[] { "풍성한", "넉넉한", "많은", "가득한" }),
        ["음"] = new("陰", "그늘", new[] { "그윽한", "고요한", "깊은", "차분한" }),
        ["점"] = new("占", "점치다", new[] { "예지력있는", "밝은", "통찰하는", "내다보는" }),
        ["좌"] = new("左", "왼쪽", new[] { "보좌하는", "돕는", "함께하는", "이끄는" }),
        ["채"] = new("蔡", "나라이름", new[] { "빛깔있는", "화사한", "다채로운", "고운" }),
        ["태"] = new("太", "크다", new[] { "큰", "넓은", "위대한", "으뜸의" }),
        ["팽"] = new("彭", "북소리", new[] { "울리는", "힘찬", "웅장한", "우렁찬" }),
        ["풍"] = new("馮", "달리다", new[] { "힘찬", "씩씩한", "빠른", "용감한" }),
        ["학"] = new("郝", "넓다", new[] { "넓은", "학문의", "탐구하는", "배움의" }),
        ["함"] = new("咸", "다, 모두", new[] { "모두의", "함께하는", "두루갖춘", "포용하는" }),
        ["해"] = new("海", "바다", new[] { "넓은", "깊은", "바다의", "끝없는" }),
        ["형"] = new("邢", "나라이름", new[] { "정돈된", "질서있는", "반듯한", "바른" }),
        ["피"] = new("皮", "가죽", new[] { "감싸는", "보호하는", "따뜻한", "부드러운" }),
        ["필"] = new("畢", "마치다", new[] { "완성하는", "이루는", "마무리하는", "온전한" }),
        ["판"] = new("判", "판단하다", new[] { "분명한", "결단력있는", "밝은", "확실한" }),
        ["부"] = new("夫", "지아비", new[] { "당당한", "듬직한", "든든한", "씩씩한" }),

        // ── 복성 ──
        ["남궁"] = new("南宮", "남쪽 궁", new[] { "따뜻한", "기품있는", "높은", "밝은", "남향의", "양지바른" }),
        ["사공"] = new("司空", "하늘을 맡다", new[] { "하늘의", "맑은", "높은", "넓은", "탁트인", "광활한" }),
        ["제갈"] = new("諸葛", "모든 칡", new[] { "지혜로운", "두루갖춘", "슬기로운", "영명한", "총명한", "끈기있는" }),
        ["황보"] = new("皇甫", "임금의 보좌", new[] { "높은", "기품있는", "보좌하는", "위엄있는", "고귀한", "당당한" }),
        ["선우"] = new("鮮于", "밝고 크다", new[] { "밝은", "큰", "빛나는", "환한", "선명한", "또렷한" }),
        ["독고"] = new("獨孤", "홀로 외롭다", new[] { "독보적인", "유일한", "특별한", "남다른", "당당한", "고결한" }),
        ["동방"] = new("東方", "동쪽", new[] { "해뜨는", "새벽의", "밝은", "시작의" }),
        ["소봉"] = new("小峯", "작은 봉우리", new[] { "단아한", "빼어난", "높은", "솟은" }),
    };

    /// <summary>
    /// 성씨+이름 = 단어가 되는 패턴 사전
    /// </summary>
    private static readonly Dictionary<string, List<WordPatternEntry>> WordPatterns = BuildWordPatterns();

    /// <summary>
    /// 성씨 뜻 확장 이름 후보
    /// </summary>
    private static readonly Dictionary<string, List<MeaningExpansionEntry>> MeaningExpansions = BuildMeaningExpansions();

    /// <summary>
    /// 성씨 음절 활용 이름 후보 (성씨 발음이 단어의 시작이 되는 패턴)
    /// </summary>
    private static readonly Dictionary<string, List<PhoneticPatternEntry>> PhoneticPatterns = BuildPhoneticPatterns();

    /// <summary>이름다움 게이트 — 2음절 후보가 이 값 미만이면 단어형으로 보고 제외.</summary>
    private const double NameLikenessGate = 0.40;

    /// <summary>성씨 고유(특화) 후보 가산 — 범용 풀보다 앞세워 성씨별 동질화를 완화.</summary>
    private const double SurnameTailoredBonus = 12.0;

    // 끝음절 톤 분류 — 요청 톤(soft/strong)에 맞는 끝음절을 가산해 톤별 결과를 분화.
    private static readonly HashSet<string> SoftLastSyllables = new()
    { "슬","온","아","하","별","솔","빛","누","리","람","봄","솜","늘","유","린","담","래","나","미","연","화","영","은","희","이","서","유","나" };
    private static readonly HashSet<string> StrongLastSyllables = new()
    { "찬","혁","준","율","든","결","원","단","안","윤","호","석","철","강","광","욱","국","범","건","훈" };

    public async Task<List<CreativeNameCandidate>> GenerateCandidatesAsync(
        string lastName, string gender, string tone, int count)
    {
        count = Math.Clamp(count, 1, 50);
        var normalizedGender = (gender ?? "none").ToLower();
        var normalizedTone = (tone ?? "neutral").ToLower();

        var candidates = new List<CreativeNameCandidate>();

        // 패턴 1: 성씨+이름 = 단어 패턴 (가장 창의적)
        candidates.AddRange(GenerateWordPatternCandidates(lastName, normalizedGender, normalizedTone));

        // 패턴 2: 성씨 뜻 확장 패턴
        candidates.AddRange(GenerateMeaningExpansionCandidates(lastName, normalizedGender, normalizedTone));

        // 패턴 3: 성씨 음절 활용 패턴
        candidates.AddRange(GeneratePhoneticPatternCandidates(lastName, normalizedGender, normalizedTone));

        // 패턴 4: 실명 희귀꼬리 (검증된 좋은 이름 + 개성 — 고정 범용 풀 대체)
        candidates.AddRange(GenerateRealNameCandidates(lastName, normalizedGender, normalizedTone));

        // 금칙어/부정 발음/유행 이름 필터링 (세대 중립 철학 — 패턴 사전에
        // 유행 이름이 섞여 들어와도 출력 단계에서 일관되게 차단)
        candidates = candidates
            .Where(c => !ContainsForbiddenWord(c.FullName))
            .Where(c => !NamingPrinciples.IsTrendyName(c.Name))
            .Where(c => !ForbiddenWordData.IsNegativeHomophoneName(c.Name))
            // 이름다움 게이트:
            //   · 2음절 — 이름다움≥0.40 통과(단어형 넓은·솟을·수풀 제거)
            //   · 1음절 — 좋은 외자 화이트리스트(별·솔·윤 등)만 통과,
            //             단어 조각(활·펼·물·산)은 배제
            .Where(c =>
                (c.Name.Length == 2 && NamingPrinciples.EvalNameLikeness(c.Name) >= NameLikenessGate)
                || (c.Name.Length == 1 && NamingPrinciples.IsGoodSingleSyllableName(c.Name)))
            .ToList();

        // 중복 제거 — 같은 이름이 고유/범용 양쪽에 있으면 고유본을 우선 유지
        candidates = candidates
            .GroupBy(c => c.Name)
            .Select(g => g
                .OrderByDescending(c => c.SurnameTailored)
                .ThenByDescending(c => c.CreativityScore)
                .First())
            .ToList();

        // gender/tone 보너스 + 창의성(희소성×이름다움) 보정 + 성씨 고유 가산으로 최종 점수 조정.
        // 고유 가산은 성씨 특화 이름을 범용 풀보다 앞세워 성씨별 동질화를 완화한다.
        foreach (var c in candidates)
        {
            c.CreativityScore += CalculateGenderToneBonus(c.GenderTag, c.ToneTag, normalizedGender, normalizedTone);
            c.CreativityScore += CalculateCreativeQualityAdjustment(c.Name);
            if (c.SurnameTailored) c.CreativityScore += SurnameTailoredBonus;
            // 클램프하지 않음 — 100에서 잘리면 상위 후보가 동점 처리돼 시드 분산이 무력화됨.
            // 표시용 100 클램프는 최종 result 선별 후에 적용한다.
        }

        // 점수순 + 첫음절 다양성 캡(같은 첫음절 최대 2개)으로 count만큼 선별.
        // 캡이 가경·가린·가민·가비 류 군집을 깨 결과를 다양하게 펼친다.
        var result = new List<CreativeNameCandidate>();
        var firstSyllableCount = new Dictionary<char, int>();
        foreach (var c in candidates.OrderByDescending(c => c.CreativityScore))
        {
            if (result.Count >= count) break;
            char firstSyl = c.Name[0];
            firstSyllableCount.TryGetValue(firstSyl, out int n);
            if (n >= 2) continue;
            firstSyllableCount[firstSyl] = n + 1;
            result.Add(c);
        }

        // 표시 점수 재계산 — 정렬용 raw 점수는 jitter(±35)가 섞여 상위권이 전부 100으로
        // 잘려 변별력이 사라졌다. 선별은 raw 점수로 끝났으므로, 표시 점수는 실제 품질
        // 신호(이름다움·성씨발음조화·오행·리듬·성별적합)만으로 다시 매겨 0~100 안에서
        // 의미 있게 분산시킨다. 그 뒤 표시 점수 기준으로 재정렬(내림차순 계약 유지).
        foreach (var c in result)
            c.CreativityScore = CalculateDisplayScore(lastName, c, normalizedGender);
        result = result.OrderByDescending(c => c.CreativityScore).ToList();

        // 실명 풀 후보의 뜻 풀이는 최종 결과에만 적용(전수 한자 조회 비용 회피)
        FillRealNameMeanings(result);

        return await Task.FromResult(result);
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
    /// 창의성 보정 = 희소성 × 이름다움. "흔하지 않으면서(novel) 진짜 이름다운(good)"
    /// 교집합을 상위로 올린다. 2음절만 정밀 평가, 그 외는 0(중립).
    ///   · 이름다움: 게이트(0.40↑)를 통과한 범위에서 추가로 미세 가감.
    ///   · 희소성: 대법원 실명 빈도(NameGenderData). 최상위 인기 이름은 감점,
    ///     희귀하되 실명인 이름은 가점. 실명 set에 없는 신규 조어는 가점(게이트로
    ///     이름다움은 이미 검증됨).
    /// </summary>
    private static double CalculateCreativeQualityAdjustment(string name)
    {
        if (string.IsNullOrEmpty(name)) return 0;

        // 좋은 외자(1음절)는 희소·개성이 강해 창의 가산 — 안 그러면 2음절에 밀려 노출 안 됨
        if (name.Length == 1)
            return NamingPrinciples.IsGoodSingleSyllableName(name) ? 10 : 0;

        if (name.Length != 2) return 0;

        double likeness = NamingPrinciples.EvalNameLikeness(name); // 0.40~1.0
        double likenessAdj = (likeness - 0.7) * 12;                // -3.6 ~ +3.6

        double noveltyAdj;
        var counts = NameGenderData.NameCounts(name);
        if (counts.HasValue)
        {
            long total = counts.Value.m + counts.Value.f;
            noveltyAdj = total >= 20000 ? -12   // 서연·서윤급 최상위 인기 → 비창의
                       : total >= 8000  ? -5    // 하율·다온급 인기
                       : total >= 2500  ? 0     // 윤슬·예솔·단아급 — 양호
                       : total >= 200   ? +5    // 나래·소담·도아급 — 희귀+실명 sweet spot
                       :                  +8;   // 매우 희귀한 실명
        }
        else
        {
            // 실명 set 밖 = 신규 조어. 게이트(이름다움≥0.40) 통과분이라 창의 가산.
            noveltyAdj = likeness >= 0.7 ? +7 : +3;
        }

        return likenessAdj + noveltyAdj;
    }

    /// <summary>
    /// 표시용 창의 점수 = 실제 품질 신호만으로 0~100 환산. 정렬용 raw 점수(jitter 포함)와
    /// 분리해, 상위권이 전부 100으로 잘리는 현상을 없애고 이름별 변별을 보인다.
    ///   · 2음절(성+이름): 이름다움·성씨발음조화·오행·리듬·성별적합 가중 합산.
    ///   · 1음절/그 외: 기존 raw 점수를 0~100으로 클램프(외자·단어형 패턴 보존).
    /// </summary>
    private static double CalculateDisplayScore(
        string lastName, CreativeNameCandidate c, string gender)
    {
        if (c.Name.Length != 2)
            return Math.Round(Math.Clamp(c.CreativityScore, 0, 100), 1);

        var a = c.Name[0].ToString();
        var b = c.Name[1].ToString();

        // 품질 신호 — 선별된 후보는 다 좋은 실명이라 상단에 몰린다(변별 약함).
        // 절대 대역을 다른 엔진(80대~低90대)에 맞춰 천장(클램프)에 무리가 쌓여
        // 전부 같은 값으로 눌리는 것을 막는다 → 작지만 실제인 변동이 드러난다.
        double score = 64.0;
        score += (NamingPrinciples.EvalNameLikeness(c.Name) - 0.55) * 18;    // -2.7 ~ +8.1
        score += NamingPrinciples.EvalSurnameFlow(lastName, c.Name) * 7;     // 0 ~ +7
        score += NamingPrinciples.EvalOhaengSynergy(a, b) * 5;               // 0 ~ +5
        score += NamingPrinciples.EvalRhythm(a, b) * 4;                      // 0 ~ +4
        score += (NamingPrinciples.EvalGenderSyllableFit(a, b, gender) - 1.0) * 12; // 불일치 감점

        // 희소성 — "창의" 점수의 핵심 변별. 대법원 실명 빈도는 이름마다 달라
        // 흔한 인기 이름은 덜 창의적(감점), 희귀하되 실재하는 이름은 더 창의적(가점).
        var counts = NameGenderData.NameCounts(c.Name);
        if (counts.HasValue)
        {
            long total = counts.Value.m + counts.Value.f;
            score += total >= 20000 ? -10   // 서연·서윤급 최상위 인기
                   : total >= 8000  ? -6     // 하율·다온급 인기
                   : total >= 2500  ? -2     // 윤슬·예솔급 — 무난
                   : total >= 500   ? +1     // 나래·소담급 — 희귀+개성
                   : total >= 100   ? +3
                   :                  +5;    // 매우 희귀한 실명
        }
        else
        {
            score += 4;   // 실명 set 밖 신규 조어 — 게이트 통과분이라 개성 가산
        }

        return Math.Round(Math.Clamp(score, 58, 93), 1);
    }

    #region 패턴 1: 성씨+이름 = 단어

    private List<CreativeNameCandidate> GenerateWordPatternCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<CreativeNameCandidate>();

        if (!WordPatterns.TryGetValue(lastName, out var patterns))
            return results;

        foreach (var p in patterns)
        {
            if (!MatchesGender(p.Gender, gender)) continue;
            if (!MatchesTone(p.Tone, tone)) continue;

            results.Add(new CreativeNameCandidate
            {
                Name = p.Name,
                FullName = lastName + p.Name,
                Concept = $"성씨+이름이 '{p.Word}'이라는 단어/구절을 이룸",
                SurnameConnection = $"'{lastName}'{KoreanUtils.EunNeun(lastName)} '{p.Word}'의 첫 음절",
                Meaning = p.Meaning,
                CreativityScore = CalculateWordPatternScore(lastName, p),
                GenderTag = p.Gender,
                ToneTag = p.Tone,
                SurnameTailored = true
            });
        }

        return results;
    }

    private static double CalculateWordPatternScore(string lastName, WordPatternEntry entry)
    {
        // 성씨+이름이 완전한 단어를 이루면 좋은 점수
        double score = 55.0;

        // 발음 조화 — 보편 작명 원리
        if (lastName.Length > 0 && entry.Name.Length > 0)
        {
            score += NamingPrinciples.EvalSurnameFlow(lastName, entry.Name) * 12;
            if (entry.Name.Length >= 2)
            {
                score += NamingPrinciples.EvalOhaengSynergy(
                    entry.Name[0].ToString(), entry.Name[1].ToString()) * 8;
            }
        }

        // 단어가 짧고 자연스러울수록 가산
        if ((lastName + entry.Name).Length <= 3) score += 8;

        // 뜻이 긍정적이면 가산
        if (!string.IsNullOrEmpty(entry.Meaning)) score += 5;

        // 이름 자체가 2음절이면 자연스러움 가산
        if (entry.Name.Length == 2) score += 5;

        return Math.Min(score, 100);
    }

    #endregion

    #region 패턴 2: 성씨 뜻 확장

    private List<CreativeNameCandidate> GenerateMeaningExpansionCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<CreativeNameCandidate>();
        var surnameMeaning = SurnameMeanings.GetValueOrDefault(lastName);

        void AddEntries(IEnumerable<MeaningExpansionEntry> entries, bool fromSurname)
        {
            foreach (var e in entries)
            {
                if (!MatchesGender(e.Gender, gender)) continue;
                if (!MatchesTone(e.Tone, tone)) continue;

                var connection = (fromSurname && surnameMeaning != null)
                    ? $"'{lastName}'({surnameMeaning.Hanja})의 뜻 '{surnameMeaning.CoreMeaning}'에서 연상"
                    : $"성씨 '{lastName}'과 조화로운 이름";

                results.Add(new CreativeNameCandidate
                {
                    Name = e.Name,
                    FullName = lastName + e.Name,
                    Concept = e.Concept,
                    SurnameConnection = connection,
                    Meaning = e.Meaning,
                    CreativityScore = CalculateMeaningExpansionScore(
                        lastName, e, fromSurname ? surnameMeaning : null),
                    GenderTag = e.Gender,
                    ToneTag = e.Tone,
                    SurnameTailored = fromSurname
                });
            }
        }

        // 성씨 특화 의미연상만 고유 레이어로 추가. 범용 풀(과거 GetGenericExpansions)은
        // 패턴 4 '실명 희귀꼬리'로 대체됨 — 고정 목록 반복 대신 검증된 실명에서 다양하게 공급.
        if (MeaningExpansions.TryGetValue(lastName, out var specific))
            AddEntries(specific, fromSurname: true);

        return results;
    }

    private static double CalculateMeaningExpansionScore(
        string lastName, MeaningExpansionEntry entry, SurnameMeaning? surnameMeaning)
    {
        double score = 40.0;

        // 성씨 의미와 관련이 있으면 가산
        if (surnameMeaning != null) score += 12;

        // 발음 조화 — 보편 작명 원리 활용
        if (lastName.Length > 0 && entry.Name.Length > 0)
        {
            score += NamingPrinciples.EvalSurnameFlow(lastName, entry.Name) * 15;
            if (entry.Name.Length >= 2)
            {
                score += NamingPrinciples.EvalOhaengSynergy(
                    entry.Name[0].ToString(), entry.Name[1].ToString()) * 10;
                score += NamingPrinciples.EvalRhythm(
                    entry.Name[0].ToString(), entry.Name[1].ToString()) * 6;
            }
        }

        if (entry.Name.Length == 2) score += 4;

        return Math.Min(score, 100);
    }

    #endregion

    #region 패턴 4: 실명 희귀꼬리 (데이터 기반 — 검증된 좋음 + 개성)

    /// <summary>
    /// 대법원 실명 빈도의 '희귀꼬리'(흔치 않으나 실제 쓰인 이름)를 창의 후보로 생성한다.
    /// 검증된 좋음(부모가 실제 지은 이름) + 개성(낮은 빈도)을 동시에 충족. 성씨 발음조화/
    /// 성별 적합으로 성씨별 분산. 뜻 풀이는 비용이 커 최종 후보에만 적용하므로 여기선 비워둔다
    /// (GenerateCandidatesAsync에서 채움). 생성물이라 SurnameTailored=false.
    /// </summary>
    private List<CreativeNameCandidate> GenerateRealNameCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<CreativeNameCandidate>();

        foreach (var (name, m, f) in NameGenderData.DistinctiveNames())
        {
            if (name.Length != 2) continue;
            if (name[0] == name[1]) continue;   // 같은 음절 반복(나나·민민) 제외

            // 성별이 강하게 반대면 스킵 (약한 기울기는 메인 파이프라인이 라벨 처리)
            double femaleRatio = (double)f / (m + f);
            if (gender == "male" && femaleRatio > 0.70) continue;
            if (gender == "female" && femaleRatio < 0.30) continue;

            // 이름다움 선차단 (메인 필터에서도 적용되나 비용 절감)
            if (NamingPrinciples.EvalNameLikeness(name) < NameLikenessGate) continue;

            var f0 = name[0].ToString();
            var l0 = name[1].ToString();

            double score = 50.0;
            score += NamingPrinciples.EvalSurnameFlow(lastName, name) * 22;   // 성씨별 분산의 핵심
            score += NamingPrinciples.EvalOhaengSynergy(f0, l0) * 8;
            score += NamingPrinciples.EvalRhythm(f0, l0) * 6;
            score += (NamingPrinciples.EvalGenderSyllableFit(f0, l0, gender) - 1.0) * 30;
            // 톤 분화 — 요청 톤에 맞는 끝음절 가산
            if (tone == "soft") score += SoftLastSyllables.Contains(l0) ? 12 : (StrongLastSyllables.Contains(l0) ? -8 : 0);
            else if (tone == "strong") score += StrongLastSyllables.Contains(l0) ? 12 : (SoftLastSyllables.Contains(l0) ? -8 : 0);
            // 성씨 시드 분산 — EvalSurnameFlow는 받침 유무로만 갈려(2버킷) 성씨 차별화가 약하다.
            // 모든 후보가 검증된 좋은 실명이므로, 성씨별로 다른 부분집합을 결정적으로 회전시켜
            // 동질화를 해소한다(창의 이름엔 유일한 정답이 없음 → 정당). 가중치가 커야 평탄한
            // 점수 덩어리를 흔들어 성씨별 다양성이 확보됨.
            score += SurnameSeededJitter(lastName, name) * 35;

            results.Add(new CreativeNameCandidate
            {
                Name = name,
                FullName = lastName + name,
                Concept = "실제 쓰이는 흔치 않은 이름 (개성 있는 실명)",
                SurnameConnection = $"성씨 '{lastName}'과 발음이 어울리는 실명",
                Meaning = "",   // 최종 후보에만 뜻 풀이 (아래 FillRealNameMeanings)
                CreativityScore = score,   // 정렬용 — 100 클램프는 표시 직전에만(시드 분산 보존)
                GenderTag = femaleRatio > 0.6 ? "female" : femaleRatio < 0.4 ? "male" : "neutral",
                ToneTag = "neutral",
                SurnameTailored = false
            });
        }

        return results;
    }

    /// <summary>
    /// 성씨+이름 안정적 해시 → [0,1). 런 간 동일(문자 코드 기반, GetHashCode 비사용).
    /// 성씨별로 좋은 이름 부분집합을 결정적으로 회전시키는 분산 시드.
    /// </summary>
    private static double SurnameSeededJitter(string lastName, string name)
    {
        unchecked
        {
            int h = 17;
            foreach (char c in lastName) h = h * 31 + c;
            foreach (char c in name) h = h * 31 + c;
            return ((h & 0x7fffffff) % 1000) / 1000.0;
        }
    }

    /// <summary>
    /// 뜻이 비어 있는 후보(실명 풀)에 뜻 풀이를 채운다. 우선순위:
    ///   1) LLM 폴리시(정적 파일 data/creative-name-meanings.json — "라영 → 빛나고 영명한")
    ///   2) 기계적 정제 글로스("맑을 윤 + 슬기 슬")  3) 최종 폴백.
    /// 파일이 없으면(미생성) 2)로 자연 폴백하므로 동작은 그대로 유지된다.
    /// </summary>
    private static void FillRealNameMeanings(IEnumerable<CreativeNameCandidate> finalists)
    {
        foreach (var c in finalists)
        {
            if (!string.IsNullOrEmpty(c.Meaning) || c.Name.Length != 2) continue;
            var polished = CreativeMeaningData.Get(c.Name);
            if (!string.IsNullOrEmpty(polished)) { c.Meaning = polished; continue; }
            var mech = BuildMechanicalMeaning(c.Name);
            c.Meaning = string.IsNullOrEmpty(mech) ? "흔치 않은 개성 있는 이름" : mech;
        }
    }

    /// <summary>
    /// 음절→대표 한자 뜻을 이어붙인 기계적 뜻 풀이("맑을 윤 + 슬기 슬"). LLM 폴리시의
    /// 입력(C# 덤프)과 런타임 폴백 양쪽에서 같은 결과를 쓰도록 공개한다. 2음절만 유효.
    /// </summary>
    public static string BuildMechanicalMeaning(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length != 2) return "";
        var m1 = BestGloss(name[0].ToString());
        var m2 = BestGloss(name[1].ToString());
        return (!string.IsNullOrEmpty(m1) && !string.IsNullOrEmpty(m2)) ? $"{m1} + {m2}"
             : !string.IsNullOrEmpty(m1) ? m1
             : !string.IsNullOrEmpty(m2) ? m2
             : "";
    }

    /// <summary>한자 Meaning의 다중 훈음('임금 주/주인 주', '괼 담, 잠길 침...') 중 첫 훈음만.</summary>
    private static string CleanGloss(string meaning)
    {
        if (string.IsNullOrWhiteSpace(meaning)) return "";
        return meaning.Split(',', '/', ';', '·')[0].Trim();
    }

    /// <summary>음절의 대표 한자 뜻 — 인명 빈출 한자 우선(雨·塞·羅 등 비이름 글자 회피) + 첫 훈음.
    /// 빈출 셋 안에서도 이름용으로 약한 글자(雨 비·友 벗 등, HanjaSelector와 동일 세트)는 뒤로
    /// 밀어 더 나은 동음 대안(우→宇·祐)이 있으면 양보한다.</summary>
    private static string BestGloss(string syl)
    {
        var cands = HanjaData.FindByReading(syl)
            .Where(x => !HanjaData.IsForbiddenNameHanja(x.Character) && !string.IsNullOrEmpty(x.Meaning))
            .ToList();
        var common = cands.Where(x => HanjaData.IsCommonNameHanja(x.Character)).ToList();
        var pool = common.Count > 0 ? common : cands;
        var h = pool
            .OrderByDescending(x => HanjaData.CalculateRelevanceScore(x)
                - (HanjaSelector.IsWeakGivenNameHanja(x.Character) ? 1000 : 0))
            .FirstOrDefault();
        return CleanGloss(h?.Meaning ?? "");
    }

    #endregion

    #region 패턴 3: 성씨 음절 활용

    private List<CreativeNameCandidate> GeneratePhoneticPatternCandidates(
        string lastName, string gender, string tone)
    {
        var results = new List<CreativeNameCandidate>();

        if (!PhoneticPatterns.TryGetValue(lastName, out var patterns))
            return results;

        var surnameMeaning = SurnameMeanings.GetValueOrDefault(lastName);

        foreach (var p in patterns)
        {
            if (!MatchesGender(p.Gender, gender)) continue;
            if (!MatchesTone(p.Tone, tone)) continue;

            results.Add(new CreativeNameCandidate
            {
                Name = p.Name,
                FullName = lastName + p.Name,
                Concept = $"'{lastName}{p.Name}' → \"{p.PhoneticPhrase}\" 연상",
                SurnameConnection = $"성씨 '{lastName}'의 발음이 '{p.PhoneticPhrase}'의 시작",
                Meaning = p.Meaning,
                CreativityScore = CalculatePhoneticPatternScore(p),
                GenderTag = p.Gender,
                ToneTag = p.Tone,
                SurnameTailored = true
            });
        }

        return results;
    }

    private static double CalculatePhoneticPatternScore(PhoneticPatternEntry entry)
    {
        double score = 45.0;

        // 연상이 자연스러울수록 (구절이 짧을수록) 높은 점수
        if (entry.PhoneticPhrase.Length <= 6) score += 18;
        else if (entry.PhoneticPhrase.Length <= 10) score += 10;
        else score += 4;

        // 이름이 2음절이면 가산
        if (entry.Name.Length == 2) score += 4;

        // 보편 작명 원리 — 이름 내 발음 평가
        if (entry.Name.Length >= 2)
        {
            score += NamingPrinciples.EvalOhaengSynergy(
                entry.Name[0].ToString(), entry.Name[1].ToString()) * 8;
            score += NamingPrinciples.EvalRhythm(
                entry.Name[0].ToString(), entry.Name[1].ToString()) * 6;
            score += NamingPrinciples.EvalInitialDiversity(
                entry.Name[0].ToString(), entry.Name[1].ToString()) * 5;
        }

        return Math.Min(score, 100);
    }

    #endregion

    #region 유틸리티

    private static bool MatchesGender(string entryGender, string requestedGender)
    {
        if (requestedGender == "none") return true;
        if (entryGender == "neutral") return true;
        return entryGender == requestedGender;
    }

    private static bool MatchesTone(string entryTone, string requestedTone)
    {
        if (requestedTone == "neutral") return true;
        if (entryTone == "neutral") return true;
        return entryTone == requestedTone;
    }

    private static bool ContainsForbiddenWord(string fullName)
    {
        var lower = fullName.ToLower();
        foreach (var word in ForbiddenWords)
        {
            if (lower.Contains(word)) return true;
        }
        foreach (var pattern in NegativePatterns)
        {
            if (lower.Contains(pattern)) return true;
        }
        return false;
    }

    #endregion

    #region 데이터 빌더

    private static Dictionary<string, List<WordPatternEntry>> BuildWordPatterns()
    {
        return new Dictionary<string, List<WordPatternEntry>>
        {
            // ── 기존 성씨 ──
            ["하"] = new()
            {
                new("늘", "하늘", "끝없이 넓은 하늘", "neutral", "soft"),
                new("람", "하람", "하늘이 내린 사람", "neutral", "neutral"),
                new("린", "하린", "하늘의 보석", "neutral", "soft"),
                new("윤", "하윤", "하늘의 윤기", "female", "soft"),
            },
            ["이"] = new()
            {
                new("슬", "이슬", "맑은 아침 이슬", "female", "soft"),
                new("안", "이안", "편안하고 안온한", "neutral", "soft"),
                new("든", "이든", "에덴동산, 풍요로운 땅", "neutral", "neutral"),
                new("솔", "이솔", "이치에 밝고 소나무같은", "neutral", "neutral"),
            },
            ["강"] = new()
            {
                new("산", "강산", "아름다운 강과 산", "neutral", "strong"),
                new("물", "강물", "도도히 흐르는 물", "neutral", "neutral"),
                new("하늘", "강하늘", "강한 하늘", "neutral", "strong"),
                new("빈", "강빈", "강가의 빛나는", "female", "soft"),
            },
            ["신"] = new()
            {
                new("비", "신비", "신비로운", "neutral", "neutral"),
                new("해", "신해", "새로운 바다", "neutral", "strong"),
                new("율", "신율", "새로운 율동", "neutral", "neutral"),
                new("아", "신아", "새로운 아이/아침", "female", "soft"),
            },
            ["서"] = new()
            {
                new("연", "서연", "서쪽의 연꽃, 고운", "female", "soft"),
                new("준", "서준", "서린 기운, 준수함", "male", "neutral"),
                new("율", "서율", "서울(수도), 율동", "neutral", "neutral"),
                new("윤", "서윤", "서린 윤기", "female", "soft"),
            },
            ["한"] = new()
            {
                new("결", "한결", "한결같은", "neutral", "neutral"),
                new("빛", "한빛", "큰 빛", "neutral", "strong"),
                new("울", "한울", "큰 울타리/세상", "neutral", "strong"),
                new("솔", "한솔", "큰 소나무", "neutral", "neutral"),
            },
            ["백"] = new()
            {
                new("합", "백합", "순결한 백합꽃", "female", "soft"),
                new("산", "백산", "하얀 산", "neutral", "strong"),
                new("설", "백설", "하얀 눈", "female", "soft"),
                new("광", "백광", "밝은 빛", "neutral", "strong"),
            },
            ["남"] = new()
            {
                new("이", "남이", "남다른 사람 (장군)", "neutral", "strong"),
                new("해", "남해", "따뜻한 남쪽 바다", "neutral", "neutral"),
                new("별", "남별", "남쪽 별", "neutral", "soft"),
                new("산", "남산", "남쪽 산", "neutral", "neutral"),
            },
            ["오"] = new()
            {
                new("름", "오름", "오르다, 높은 곳", "neutral", "strong"),
                new("솔", "오솔", "오솔길, 소박한 길", "neutral", "soft"),
                new("늘", "오늘", "오늘을 살다", "neutral", "neutral"),
                new("연", "오연", "오묘한 인연", "female", "soft"),
            },
            ["조"] = new()
            {
                new("은", "조은", "좋은", "neutral", "soft"),
                new("아", "조아", "좋아, 밝은", "female", "soft"),
                new("율", "조율", "조율하다, 조화롭다", "neutral", "neutral"),
                new("해", "조해", "아침 바다", "neutral", "neutral"),
            },
            ["김"] = new()
            {
                new("나래", "김나래", "금빛 날개", "neutral", "soft"),
                new("빛", "김빛", "금빛", "neutral", "neutral"),
                new("결", "김결", "금의 결, 고운 결", "neutral", "soft"),
                new("솔", "김솔", "금빛 소나무", "neutral", "neutral"),
            },
            ["박"] = new()
            {
                new("하", "박하", "박하(민트), 상쾌한", "neutral", "soft"),
                new("달", "박달", "박달나무, 단군 신화", "neutral", "strong"),
                new("새", "박새", "순박한 새", "neutral", "soft"),
                new("솔", "박솔", "순수한 소나무", "neutral", "neutral"),
            },
            ["최"] = new()
            {
                new("고", "최고", "가장 높은, 최고", "neutral", "strong"),
                new("선", "최선", "가장 좋은, 최선", "neutral", "neutral"),
                new("윤", "최윤", "가장 빛나는", "female", "soft"),
                new("한", "최한", "높고 큰", "male", "strong"),
            },
            ["정"] = new()
            {
                new("한", "정한", "바르고 큰", "male", "strong"),
                new("인", "정인", "정이 깊은 사람", "neutral", "soft"),
                new("온", "정온", "바르고 온화한", "neutral", "soft"),
                new("결", "정결", "깨끗하고 바른", "neutral", "neutral"),
            },
            ["유"] = new()
            {
                new("하", "유하", "유유히 흐르는", "neutral", "soft"),
                new("리", "유리", "맑은 유리, 투명한", "female", "soft"),
                new("빈", "유빈", "넉넉하고 빛나는", "female", "soft"),
                new("진", "유진", "유연하고 진실한", "neutral", "neutral"),
            },
            ["송"] = new()
            {
                new("이", "송이", "한 송이 꽃", "female", "soft"),
                new("림", "송림", "소나무 숲", "neutral", "neutral"),
                new("하", "송하", "소나무 아래", "neutral", "soft"),
                new("결", "송결", "소나무의 결", "neutral", "neutral"),
            },
            ["임"] = new()
            {
                new("하", "임하", "숲에 임하다", "neutral", "neutral"),
                new("솔", "임솔", "수풀 속 소나무", "neutral", "neutral"),
                new("결", "임결", "숲의 결", "neutral", "soft"),
                new("채", "임채", "숲의 빛깔", "female", "soft"),
            },
            ["윤"] = new()
            {
                new("슬", "윤슬", "빛나는 물결", "neutral", "soft"),
                new("아", "윤아", "빛나는 아이", "female", "soft"),
                new("서", "윤서", "빛나는 서리/서사", "neutral", "neutral"),
                new("호", "윤호", "빛나고 호쾌한", "male", "strong"),
            },
            ["황"] = new()
            {
                new("금", "황금", "빛나는 금", "neutral", "strong"),
                new("하", "황하", "황하강, 큰 강", "neutral", "strong"),
                new("채", "황채", "황금빛 빛깔", "neutral", "soft"),
                new("린", "황린", "빛나는 보석", "female", "soft"),
            },
            ["안"] = new()
            {
                new("온", "안온", "편안하고 온화한", "neutral", "soft"),
                new("녕", "안녕", "평안함", "neutral", "soft"),
                new("솔", "안솔", "편안한 소나무", "neutral", "neutral"),
                new("빈", "안빈", "편안하고 빛나는", "female", "soft"),
            },
            ["홍"] = new()
            {
                new("익", "홍익", "널리 이롭게 하다", "neutral", "strong"),
                new("빈", "홍빈", "넓고 빛나는", "female", "soft"),
                new("찬", "홍찬", "넓고 찬란한", "male", "strong"),
                new("서", "홍서", "큰 서광", "neutral", "neutral"),
            },
            ["문"] = new()
            {
                new("채", "문채", "아름다운 빛깔", "neutral", "soft"),
                new("빈", "문빈", "빛나는 글", "female", "soft"),
                new("서", "문서", "아름다운 글", "neutral", "neutral"),
                new("호", "문호", "아름다운 호연지기", "male", "strong"),
            },
            ["권"] = new()
            {
                new("혁", "권혁", "힘차게 혁신하는", "male", "strong"),
                new("율", "권율", "권세와 율동(장군)", "neutral", "strong"),
                new("빈", "권빈", "당당하고 빛나는", "female", "soft"),
                new("찬", "권찬", "기운차고 찬란한", "male", "strong"),
            },
            ["심"] = new()
            {
                new("해", "심해", "깊은 바다", "neutral", "strong"),
                new("결", "심결", "깊은 결", "neutral", "soft"),
                new("온", "심온", "깊고 온화한", "neutral", "soft"),
                new("연", "심연", "깊은 연못", "neutral", "neutral"),
            },
            ["성"] = new()
            {
                new("윤", "성윤", "이루고 빛나는", "neutral", "neutral"),
                new("하", "성하", "이루어진 하늘", "neutral", "neutral"),
                new("찬", "성찬", "풍성한 잔치", "neutral", "strong"),
                new("빈", "성빈", "이루고 빛나는", "female", "soft"),
            },
            ["전"] = new()
            {
                new("하", "전하", "온전한 하늘", "neutral", "neutral"),
                new("빈", "전빈", "완전하고 빛나는", "female", "soft"),
                new("율", "전율", "온전한 율동", "neutral", "neutral"),
                new("설", "전설", "전해 내려오는 이야기", "neutral", "strong"),
            },

            // ── 추가 성씨 WordPatterns ──
            ["감"] = new()
            {
                new("빛", "감빛", "달콤한 빛", "neutral", "soft"),
                new("솔", "감솔", "감미로운 소나무", "neutral", "neutral"),
                new("결", "감결", "달콤한 결", "neutral", "soft"),
            },
            ["경"] = new()
            {
                new("하", "경하", "경사스러운 하늘", "neutral", "neutral"),
                new("빈", "경빈", "축복의 빛", "female", "soft"),
                new("윤", "경윤", "경사롭고 빛나는", "neutral", "neutral"),
            },
            ["계"] = new()
            {
                new("율", "계율", "계수나무 율동", "neutral", "neutral"),
                new("빛", "계빛", "달빛의 빛", "neutral", "soft"),
                new("하", "계하", "계절의 하늘", "neutral", "neutral"),
            },
            ["공"] = new()
            {
                new("명", "공명", "울려퍼지는 소리", "neutral", "strong"),
                new("빈", "공빈", "넓고 빛나는", "female", "soft"),
                new("하", "공하", "하늘처럼 넓은", "neutral", "neutral"),
            },
            ["금"] = new()
            {
                new("빛", "금빛", "거문고의 빛", "neutral", "soft"),
                new("솔", "금솔", "거문고와 소나무", "neutral", "neutral"),
                new("하", "금하", "거문고 아래 하늘", "neutral", "soft"),
            },
            ["기"] = new()
            {
                new("연", "기연", "기이한 인연", "female", "soft"),
                new("찬", "기찬", "기특하고 찬란한", "male", "strong"),
                new("하", "기하", "기묘한 하늘", "neutral", "neutral"),
            },
            ["길"] = new()
            {
                new("빈", "길빈", "길한 빛", "female", "soft"),
                new("찬", "길찬", "길하고 찬란한", "male", "strong"),
                new("하", "길하", "길한 하늘", "neutral", "neutral"),
            },
            ["도"] = new()
            {
                new("윤", "도윤", "도읍의 빛남", "neutral", "neutral"),
                new("하", "도하", "도읍의 하늘", "neutral", "neutral"),
                new("빈", "도빈", "도읍의 빛", "female", "soft"),
            },
            ["두"] = new()
            {
                new("빛", "두빛", "두 개의 빛", "neutral", "neutral"),
                new("결", "두결", "굳건한 결", "neutral", "strong"),
                new("하", "두하", "굳건한 하늘", "neutral", "neutral"),
            },
            ["마"] = new()
            {
                new("루", "마루", "꼭대기, 산마루", "neutral", "strong"),
                new("음", "마음", "따뜻한 마음", "neutral", "soft"),
                new("린", "마린", "바다의 말", "neutral", "neutral"),
            },
            ["모"] = new()
            {
                new("은", "모은", "모으다, 겸비하다", "neutral", "neutral"),
                new("든", "모든", "모든 것을 품은", "neutral", "neutral"),
                new("빛", "모빛", "섬세한 빛", "neutral", "soft"),
            },
            ["목"] = new()
            {
                new("하", "목하", "화목한 하늘 아래", "neutral", "soft"),
                new("빈", "목빈", "화목하고 빛나는", "female", "soft"),
                new("련", "목련", "목련꽃", "female", "soft"),
            },
            ["반"] = new()
            {
                new("솔", "반솔", "물가의 소나무", "neutral", "neutral"),
                new("빛", "반빛", "반짝이는 빛", "neutral", "soft"),
                new("하", "반하", "물가의 하늘", "neutral", "soft"),
            },
            ["방"] = new()
            {
                new("울", "방울", "맑은 방울소리", "female", "soft"),
                new("하", "방하", "바른 하늘", "neutral", "neutral"),
                new("빈", "방빈", "바르고 빛나는", "female", "soft"),
            },
            ["봉"] = new()
            {
                new("하", "봉하", "받드는 하늘", "neutral", "neutral"),
                new("빈", "봉빈", "공경하며 빛나는", "female", "soft"),
                new("찬", "봉찬", "받들어 찬란한", "male", "strong"),
            },
            ["선"] = new()
            {
                new("율", "선율", "아름다운 가락", "neutral", "soft"),
                new("하", "선하", "베푸는 하늘", "neutral", "soft"),
                new("빈", "선빈", "밝고 빛나는", "female", "soft"),
            },
            ["설"] = new()
            {
                new("빈", "설빈", "향기로운 빛", "female", "soft"),
                new("하", "설하", "들녘의 하늘", "neutral", "neutral"),
                new("찬", "설찬", "소박하고 찬란한", "male", "strong"),
            },
            ["소"] = new()
            {
                new("율", "소율", "깨어나는 율동", "neutral", "neutral"),
                new("빈", "소빈", "싱그럽고 빛나는", "female", "soft"),
                new("하", "소하", "소생하는 하늘", "neutral", "soft"),
            },
            ["손"] = new()
            {
                new("빈", "손빈", "이어지는 빛", "female", "soft"),
                new("하", "손하", "미래의 하늘", "neutral", "neutral"),
                new("찬", "손찬", "젊고 찬란한", "male", "strong"),
            },
            ["어"] = new()
            {
                new("울", "어울", "어울리다, 조화", "neutral", "soft"),
                new("진", "어진", "어질고 진실한", "neutral", "neutral"),
                new("빈", "어빈", "맑은물의 빛", "female", "soft"),
            },
            ["여"] = new()
            {
                new("울", "여울", "여울물, 맑은 물", "neutral", "soft"),
                new("명", "여명", "새벽, 동이 트다", "neutral", "strong"),
                new("빈", "여빈", "곧고 빛나는", "female", "soft"),
            },
            ["연"] = new()
            {
                new("빛", "연빛", "이어지는 빛", "neutral", "soft"),
                new("하", "연하", "연한 하늘", "neutral", "soft"),
                new("결", "연결", "이어지는 결", "neutral", "neutral"),
            },
            ["옥"] = new()
            {
                new("빛", "옥빛", "구슬빛", "neutral", "soft"),
                new("결", "옥결", "옥같은 결", "neutral", "soft"),
                new("하", "옥하", "옥같은 하늘", "neutral", "soft"),
            },
            ["왕"] = new()
            {
                new("빛", "왕빛", "임금의 빛", "neutral", "strong"),
                new("하", "왕하", "임금의 하늘", "neutral", "strong"),
                new("찬", "왕찬", "으뜸의 찬란함", "male", "strong"),
            },
            ["용"] = new()
            {
                new("하", "용하", "용맹한 하늘", "neutral", "strong"),
                new("빈", "용빈", "용의 빛", "neutral", "strong"),
                new("찬", "용찬", "용맹하고 찬란한", "male", "strong"),
            },
            ["원"] = new()
            {
                new("빛", "원빛", "으뜸의 빛", "neutral", "neutral"),
                new("하", "원하", "으뜸의 하늘", "neutral", "neutral"),
                new("결", "원결", "근본의 결", "neutral", "soft"),
            },
            ["천"] = new()
            {
                new("하", "천하", "온 세상", "neutral", "strong"),
                new("빛", "천빛", "천의 빛", "neutral", "neutral"),
                new("윤", "천윤", "넘치는 빛남", "neutral", "neutral"),
            },
            ["추"] = new()
            {
                new("수", "추수", "가을 수확", "neutral", "neutral"),
                new("빛", "추빛", "가을빛", "neutral", "soft"),
                new("하", "추하", "가을 하늘", "neutral", "soft"),
            },
            ["태"] = new()
            {
                new("양", "태양", "큰 태양", "neutral", "strong"),
                new("하", "태하", "큰 하늘", "neutral", "strong"),
                new("빈", "태빈", "크고 빛나는", "female", "soft"),
            },
            ["채"] = new()
            {
                new("빛", "채빛", "빛깔의 빛", "neutral", "soft"),
                new("윤", "채윤", "화사한 윤기", "female", "soft"),
                new("하", "채하", "화사한 하늘", "neutral", "soft"),
            },
            ["곽"] = new()
            {
                new("빈", "곽빈", "지키며 빛나는", "female", "soft"),
                new("하", "곽하", "성곽의 하늘", "neutral", "neutral"),
                new("찬", "곽찬", "든든하고 찬란한", "male", "strong"),
            },
            ["차"] = new()
            {
                new("빈", "차빈", "나아가며 빛나는", "female", "soft"),
                new("윤", "차윤", "수레바퀴 윤기", "neutral", "neutral"),
                new("하", "차하", "나아가는 하늘", "neutral", "neutral"),
            },
            ["노"] = new()
            {
                new("을", "노을", "저녁 노을", "neutral", "soft"),
                new("빈", "노빈", "넉넉하고 빛나는", "female", "soft"),
                new("하", "노하", "그릇큰 하늘", "neutral", "neutral"),
            },
            ["구"] = new()
            {
                new("름", "구름", "하늘의 구름", "neutral", "soft"),
                new("빈", "구빈", "갖추고 빛나는", "female", "soft"),
                new("하", "구하", "갖추어진 하늘", "neutral", "neutral"),
            },
            ["허"] = new()
            {
                new("윤", "허윤", "너그럽고 빛나는", "neutral", "neutral"),
                new("빈", "허빈", "포용하며 빛나는", "female", "soft"),
                new("찬", "허찬", "관대하고 찬란한", "male", "strong"),
            },
            ["류"] = new()
            {
                new("빈", "류빈", "버드나무 빛", "female", "soft"),
                new("하", "류하", "흐르는 하늘", "neutral", "soft"),
                new("찬", "류찬", "유연하고 찬란한", "male", "strong"),
            },
            ["나"] = new()
            {
                new("래", "나래", "날개, 비상", "neutral", "soft"),
                new("빛", "나빛", "비단빛", "neutral", "soft"),
                new("린", "나린", "비단의 보석", "female", "soft"),
            },
            ["지"] = new()
            {
                new("유", "지유", "연못의 자유", "neutral", "neutral"),
                new("온", "지온", "잔잔한 온기", "neutral", "soft"),
                new("빈", "지빈", "맑고 빛나는", "female", "soft"),
            },
            ["탁"] = new()
            {
                new("빈", "탁빈", "뛰어나고 빛나는", "female", "soft"),
                new("하", "탁하", "탁월한 하늘", "neutral", "strong"),
                new("찬", "탁찬", "빼어나고 찬란한", "male", "strong"),
            },
            ["현"] = new()
            {
                new("빈", "현빈", "그윽하고 빛나는", "male", "neutral"),
                new("하", "현하", "오묘한 하늘", "neutral", "neutral"),
                new("결", "현결", "그윽한 결", "neutral", "soft"),
            },
            ["석"] = new()
            {
                new("빈", "석빈", "단단하고 빛나는", "neutral", "neutral"),
                new("하", "석하", "변함없는 하늘", "neutral", "strong"),
                new("찬", "석찬", "굳건하고 찬란한", "male", "strong"),
            },
            ["염"] = new()
            {
                new("빈", "염빈", "깨끗하고 빛나는", "female", "soft"),
                new("결", "염결", "결백한 결", "neutral", "neutral"),
                new("하", "염하", "청렴한 하늘", "neutral", "neutral"),
            },
            ["매"] = new()
            {
                new("화", "매화", "매화꽃", "female", "soft"),
                new("빈", "매빈", "매화빛 빛남", "female", "soft"),
                new("하", "매하", "이른봄의 하늘", "neutral", "neutral"),
            },
            ["범"] = new()
            {
                new("준", "범준", "모범적이고 준수한", "male", "strong"),
                new("빈", "범빈", "바르고 빛나는", "neutral", "neutral"),
                new("하", "범하", "올바른 하늘", "neutral", "neutral"),
            },
            ["해"] = new()
            {
                new("빛", "해빛", "바다의 빛", "neutral", "strong"),
                new("솔", "해솔", "바다의 소나무", "neutral", "neutral"),
                new("린", "해린", "바다의 보석", "female", "soft"),
            },
            ["함"] = new()
            {
                new("께", "함께", "함께하다", "neutral", "soft"),
                new("빈", "함빈", "모두와 빛나는", "female", "soft"),
                new("찬", "함찬", "포용하며 찬란한", "male", "strong"),
            },
            ["은"] = new()
            {
                new("빛", "은빛", "은빛", "neutral", "soft"),
                new("결", "은결", "은은한 결", "neutral", "soft"),
                new("하", "은하", "은하수", "neutral", "neutral"),
            },
            ["명"] = new()
            {
                new("빛", "명빛", "밝은 빛", "neutral", "neutral"),
                new("하", "명하", "밝은 하늘", "neutral", "neutral"),
                new("찬", "명찬", "밝고 찬란한", "male", "strong"),
            },
        };
    }

    private static Dictionary<string, List<MeaningExpansionEntry>> BuildMeaningExpansions()
    {
        return new Dictionary<string, List<MeaningExpansionEntry>>
        {
            ["김"] = new()
            {
                new("금빛", "금처럼 빛나는", "성씨 金의 금빛 이미지", "neutral", "soft"),
                new("금솔", "금빛 소나무", "金+솔(소나무) 연상", "neutral", "neutral"),
                new("보라", "귀한 보석빛", "금(귀하다)에서 보석 연상", "female", "soft"),
                new("찬", "찬란하다", "金의 찬란함", "male", "strong"),
            },
            ["이"] = new()
            {
                new("열매", "달콤한 열매", "李(자두)에서 열매 연상", "female", "soft"),
                new("풍", "풍요롭다", "李 열매의 풍요 연상", "male", "strong"),
                new("단", "달콤하고 단아한", "자두의 달콤함 연상", "female", "soft"),
                new("수", "열매가 익다", "열매 수확 연상", "male", "neutral"),
            },
            ["박"] = new()
            {
                new("소담", "소박하고 담백한", "朴의 순박함 연상", "female", "soft"),
                new("맑음", "맑고 깨끗한", "순수함 연상", "neutral", "soft"),
                new("담", "담백하고 깨끗한", "소박함의 다른 표현", "neutral", "neutral"),
                new("진솔", "진실하고 솔직한", "순박함에서 진솔 연상", "neutral", "strong"),
            },
            ["최"] = new()
            {
                new("높이", "높이 솟아오른", "崔(높다) 직접 연상", "neutral", "strong"),
                new("솟을", "우뚝 솟은", "높다에서 솟다 연상", "neutral", "strong"),
                new("아름", "드높고 아름다운", "높은 것의 아름다움", "female", "soft"),
                new("한울", "높은 하늘", "높음+하늘 연상", "neutral", "strong"),
            },
            ["강"] = new()
            {
                new("물결", "강물의 물결", "강(江)에서 물결 연상", "neutral", "soft"),
                new("도", "도도하게 흐르는", "강물의 도도함", "neutral", "strong"),
                new("푸름", "강의 푸른 빛", "물의 색깔 연상", "neutral", "soft"),
                new("찬", "힘차고 강한", "强에서 힘찬 연상", "male", "strong"),
            },
            ["신"] = new()
            {
                new("해솜", "신비로운 해의 솜", "신비+해+솜 연상", "neutral", "soft"),
                new("비로", "신비의 길", "신비로운 연상", "neutral", "neutral"),
                new("새롬", "새롭다", "新에서 새로움 연상", "neutral", "neutral"),
                new("라", "새로운 빛", "신라(新羅) 연상", "female", "soft"),
            },
            ["장"] = new()
            {
                new("활", "활짝 펼치다", "張(펴다) 연상", "neutral", "strong"),
                new("펼", "펼쳐진 미래", "펴다에서 펼침 연상", "neutral", "neutral"),
                new("넓은", "넓게 펴진", "張의 넓음", "neutral", "neutral"),
                new("시원", "시원하게 펼치다", "펴다의 시원함", "neutral", "strong"),
            },
            ["임"] = new()
            {
                new("수풀", "울창한 수풀", "林(수풀)에서 직접 연상", "neutral", "neutral"),
                new("숲빛", "숲의 빛깔", "수풀의 빛 연상", "neutral", "soft"),
                new("솔결", "소나무의 결", "숲 속 소나무 연상", "neutral", "soft"),
                new("푸른", "푸르른 숲", "숲의 푸름 연상", "neutral", "soft"),
            },
            ["한"] = new()
            {
                new("가람", "큰 강(가람)", "韓(크다)+가람(강) 연상", "neutral", "neutral"),
                new("누리", "큰 세상", "크다+세상 연상", "neutral", "neutral"),
                new("별", "위대한 별", "크다에서 별 연상", "neutral", "soft"),
                new("찬", "크고 찬란한", "위대함+찬란함", "male", "strong"),
            },
            ["서"] = new()
            {
                new("고을", "여유로운 마을", "徐(천천히)에서 고요함 연상", "neutral", "soft"),
                new("평", "평화롭고 느긋한", "여유에서 평화 연상", "neutral", "soft"),
                new("누리", "여유로운 세상", "느긋한+세상 연상", "neutral", "neutral"),
                new("하", "여유로운 하루", "천천히+하루 연상", "neutral", "soft"),
            },

            // ── 추가 성씨 MeaningExpansions ──
            ["감"] = new()
            {
                new("미소", "달콤한 미소", "甘(달다)에서 달콤함 연상", "female", "soft"),
                new("나래", "달콤한 날개", "감미로움에서 비상 연상", "neutral", "soft"),
                new("온", "따뜻하고 달콤한", "달다에서 온기 연상", "neutral", "soft"),
                new("빛", "감미로운 빛", "甘의 부드러움", "neutral", "soft"),
            },
            ["경"] = new()
            {
                new("빛", "경사스러운 빛", "慶(경사)에서 빛 연상", "neutral", "neutral"),
                new("하늘", "축복의 하늘", "경사+하늘 연상", "neutral", "neutral"),
                new("아름", "기쁨의 아름다움", "경사에서 아름다움 연상", "female", "soft"),
                new("찬", "경사롭고 찬란한", "慶의 찬란함", "male", "strong"),
            },
            ["공"] = new()
            {
                new("누리", "넓은 세상", "孔(크다)에서 세상 연상", "neutral", "neutral"),
                new("빛", "깊은 빛", "깊이에서 빛 연상", "neutral", "neutral"),
                new("찬", "크고 찬란한", "크다에서 찬란함", "male", "strong"),
            },
            ["금"] = new()
            {
                new("소리", "거문고 소리", "琴에서 소리 연상", "neutral", "soft"),
                new("율", "거문고 율동", "악기의 율동 연상", "neutral", "neutral"),
                new("하", "거문고 아래 하늘", "琴+하늘 연상", "neutral", "soft"),
                new("빛", "음악의 빛", "거문고의 울림 연상", "neutral", "soft"),
            },
            ["기"] = new()
            {
                new("빛", "기이한 빛", "奇(기이하다)에서 빛 연상", "neutral", "neutral"),
                new("연", "기묘한 인연", "기이함+인연 연상", "neutral", "soft"),
                new("솔", "특별한 소나무", "남다른+소나무 연상", "neutral", "neutral"),
            },
            ["길"] = new()
            {
                new("빛", "길한 빛", "吉(길하다)에서 빛 연상", "neutral", "neutral"),
                new("온", "길하고 온화한", "길함+온기 연상", "neutral", "soft"),
                new("나래", "복된 날개", "길함에서 비상 연상", "neutral", "soft"),
            },
            ["도"] = new()
            {
                new("빛", "도읍의 빛", "都(도읍)에서 번화함 연상", "neutral", "neutral"),
                new("윤", "중심의 빛남", "도읍+빛남 연상", "neutral", "neutral"),
                new("현", "도읍의 현명함", "중심+지혜 연상", "male", "neutral"),
            },
            ["두"] = new()
            {
                new("빛", "의지의 빛", "杜(막다)에서 굳건함 연상", "neutral", "strong"),
                new("찬", "굳건하고 찬란한", "의지+찬란함 연상", "male", "strong"),
                new("결", "굳건한 결", "막다에서 결의 연상", "neutral", "strong"),
            },
            ["마"] = new()
            {
                new("윤", "달리는 빛", "馬(말)에서 질주 연상", "neutral", "strong"),
                new("빛", "씩씩한 빛", "말의 힘참 연상", "neutral", "strong"),
                new("찬", "용맹한 찬란함", "씩씩함+찬란함", "male", "strong"),
            },
            ["목"] = new()
            {
                new("빛", "화목한 빛", "睦(화목)에서 빛 연상", "neutral", "soft"),
                new("온", "화목하고 온화한", "화목+온기 연상", "neutral", "soft"),
                new("나래", "평화의 날개", "화목에서 비상 연상", "neutral", "soft"),
            },
            ["봉"] = new()
            {
                new("빛", "공경의 빛", "奉(받들다)에서 빛 연상", "neutral", "neutral"),
                new("온", "받드는 온기", "공경+온기 연상", "neutral", "soft"),
                new("찬", "받들어 찬란한", "공경+찬란함", "neutral", "strong"),
            },
            ["선"] = new()
            {
                new("율", "아름다운 선율", "宣(베풀다)+율동 연상", "neutral", "soft"),
                new("빛", "밝히는 빛", "선포+빛 연상", "neutral", "neutral"),
                new("온", "베푸는 온기", "베풀다+온기 연상", "neutral", "soft"),
            },
            ["소"] = new()
            {
                new("빛", "소생의 빛", "蘇(깨어나다)에서 빛 연상", "neutral", "soft"),
                new("봄", "소생하는 봄", "깨어남+봄 연상", "female", "soft"),
                new("하늘", "싱그러운 하늘", "새로움+하늘 연상", "neutral", "neutral"),
            },
            ["손"] = new()
            {
                new("빛", "이어지는 빛", "孫(손자)에서 계승 연상", "neutral", "neutral"),
                new("하늘", "미래의 하늘", "젊은+하늘 연상", "neutral", "neutral"),
                new("찬", "젊고 찬란한", "젊음+찬란함", "male", "strong"),
            },
            ["어"] = new()
            {
                new("빛", "물속의 빛", "魚(물고기)에서 물빛 연상", "neutral", "soft"),
                new("울", "물결의 울림", "물속+울림 연상", "neutral", "neutral"),
                new("나래", "헤엄치는 날개", "자유+비상 연상", "neutral", "soft"),
            },
            ["여"] = new()
            {
                new("빛", "곧은 빛", "呂(등뼈)에서 곧음 연상", "neutral", "neutral"),
                new("울", "울림있는", "등뼈의 중심 연상", "neutral", "neutral"),
                new("찬", "반듯하고 찬란한", "곧음+찬란함", "male", "strong"),
            },
            ["연"] = new()
            {
                new("빛", "이어지는 빛", "延(늘이다)에서 연장 연상", "neutral", "soft"),
                new("하늘", "끝없는 하늘", "영원함+하늘 연상", "neutral", "neutral"),
                new("결", "이어지는 결", "연장+결 연상", "neutral", "soft"),
            },
            ["옥"] = new()
            {
                new("빛", "옥빛", "玉(구슬)에서 빛 연상", "neutral", "soft"),
                new("결", "옥같은 결", "구슬+결 연상", "neutral", "soft"),
                new("소리", "구슬 소리", "옥의 울림 연상", "female", "soft"),
            },
            ["왕"] = new()
            {
                new("빛", "으뜸의 빛", "王(임금)에서 빛 연상", "neutral", "strong"),
                new("찬", "위엄있는 찬란함", "임금+찬란함", "male", "strong"),
                new("하늘", "임금의 하늘", "왕+하늘 연상", "neutral", "strong"),
            },
            ["용"] = new()
            {
                new("빛", "용의 빛", "龍(용)에서 빛 연상", "neutral", "strong"),
                new("하늘", "승천하는 하늘", "용+하늘 연상", "neutral", "strong"),
                new("찬", "기운찬 찬란함", "용맹+찬란함", "male", "strong"),
            },
            ["원"] = new()
            {
                new("빛", "으뜸의 빛", "元(으뜸)에서 빛 연상", "neutral", "neutral"),
                new("하늘", "으뜸의 하늘", "첫째+하늘 연상", "neutral", "neutral"),
                new("결", "시작의 결", "근본+결 연상", "neutral", "soft"),
            },
            ["천"] = new()
            {
                new("빛", "넘치는 빛", "千(천)에서 빛 연상", "neutral", "neutral"),
                new("솔", "수많은 소나무", "풍요+소나무 연상", "neutral", "neutral"),
                new("하늘", "끝없는 하늘", "천+하늘 연상", "neutral", "strong"),
            },
            ["추"] = new()
            {
                new("빛", "가을빛", "秋(가을)에서 빛 연상", "neutral", "soft"),
                new("결", "가을의 결", "결실+결 연상", "neutral", "soft"),
                new("하늘", "가을 하늘", "가을+하늘 연상", "neutral", "soft"),
            },
            ["태"] = new()
            {
                new("빛", "큰 빛", "太(크다)에서 빛 연상", "neutral", "strong"),
                new("찬", "크고 찬란한", "위대함+찬란함", "male", "strong"),
                new("하늘", "크나큰 하늘", "크다+하늘 연상", "neutral", "strong"),
            },
            ["채"] = new()
            {
                new("빛", "다채로운 빛", "蔡에서 빛깔 연상", "neutral", "soft"),
                new("윤", "화사한 윤기", "고운+빛남 연상", "female", "soft"),
                new("하늘", "화사한 하늘", "빛깔+하늘 연상", "neutral", "soft"),
            },
            ["현"] = new()
            {
                new("빛", "그윽한 빛", "玄(검다)에서 깊은빛 연상", "neutral", "neutral"),
                new("결", "오묘한 결", "신비+결 연상", "neutral", "soft"),
                new("찬", "깊고 찬란한", "그윽함+찬란함", "male", "strong"),
            },
            ["석"] = new()
            {
                new("빛", "단단한 빛", "石(돌)에서 빛 연상", "neutral", "strong"),
                new("찬", "굳건한 찬란함", "돌+찬란함", "male", "strong"),
                new("결", "변함없는 결", "돌의 결 연상", "neutral", "neutral"),
            },
            ["염"] = new()
            {
                new("빛", "청렴한 빛", "廉(청렴)에서 빛 연상", "neutral", "neutral"),
                new("결", "맑은 결", "깨끗함+결 연상", "neutral", "soft"),
                new("하늘", "결백한 하늘", "청렴+하늘 연상", "neutral", "neutral"),
            },
            ["범"] = new()
            {
                new("빛", "모범의 빛", "范(모범)에서 빛 연상", "neutral", "neutral"),
                new("찬", "바르고 찬란한", "올바름+찬란함", "male", "strong"),
                new("결", "본보기의 결", "모범+결 연상", "neutral", "neutral"),
            },
            ["해"] = new()
            {
                new("빛", "바다의 빛", "海(바다)에서 빛 연상", "neutral", "strong"),
                new("솔", "바다 소나무", "바다+소나무 연상", "neutral", "neutral"),
                new("결", "바다의 결", "끝없는+결 연상", "neutral", "soft"),
            },
            ["함"] = new()
            {
                new("빛", "함께하는 빛", "咸(모두)에서 빛 연상", "neutral", "soft"),
                new("온", "함께하는 온기", "모두+온기 연상", "neutral", "soft"),
                new("찬", "두루 찬란한", "포용+찬란함", "neutral", "strong"),
            },
            ["은"] = new()
            {
                new("빛", "은빛", "殷(많다)에서 빛 연상", "neutral", "soft"),
                new("결", "풍성한 결", "넉넉함+결 연상", "neutral", "soft"),
                new("하늘", "가득한 하늘", "풍요+하늘 연상", "neutral", "neutral"),
            },
            ["명"] = new()
            {
                new("빛", "밝은 빛", "明(밝다)에서 빛 연상", "neutral", "neutral"),
                new("하늘", "환한 하늘", "밝다+하늘 연상", "neutral", "neutral"),
                new("찬", "밝고 찬란한", "맑음+찬란함", "male", "strong"),
            },
        };
    }

    private static Dictionary<string, List<PhoneticPatternEntry>> BuildPhoneticPatterns()
    {
        return new Dictionary<string, List<PhoneticPatternEntry>>
        {
            ["강"] = new()
            {
                new("하늘", "강한 하늘", "하늘처럼 강인한", "neutral", "strong"),
                new("다움", "강다움", "강인하고 다부진", "neutral", "strong"),
                new("하린", "강하린", "강한 보석", "female", "soft"),
                new("호", "강호", "강과 호수, 넓은 세상", "male", "strong"),
            },
            ["신"] = new()
            {
                new("해솜", "신비로운 해솜", "신비롭고 부드러운", "neutral", "soft"),
                new("나라", "신나라", "신나는 나라", "neutral", "neutral"),
                new("선", "신선", "신선하고 깨끗한", "neutral", "neutral"),
                new("우", "신우", "신비로운 벗", "male", "neutral"),
            },
            ["김"] = new()
            {
                new("하율", "김하율", "금빛 하늘의 율동", "neutral", "soft"),
                new("별", "김별", "금빛 별", "neutral", "soft"),
                new("채", "김채", "금빛 채색", "female", "soft"),
                new("호", "김호", "금빛 호수", "male", "neutral"),
            },
            ["이"] = new()
            {
                new("사랑", "이사랑", "이 세상의 사랑", "neutral", "soft"),
                new("다솜", "이다솜", "이 세상의 사랑(고어)", "neutral", "soft"),
                new("루리", "이루리", "이루어질 꿈", "neutral", "neutral"),
                new("한", "이한", "이치에 밝고 큰", "male", "strong"),
            },
            ["박"] = new()
            {
                new("하", "박하", "박하처럼 상쾌한", "neutral", "soft"),
                new("진", "박진", "박진감 넘치는", "neutral", "strong"),
                new("수", "박수", "갈채, 칭찬받는", "neutral", "neutral"),
                new("해", "박해", "순수한 바다", "neutral", "neutral"),
            },
            ["최"] = new()
            {
                new("선", "최선", "최선을 다하는", "neutral", "neutral"),
                new("고", "최고", "가장 뛰어난", "neutral", "strong"),
                new("연", "최연", "드높고 아름다운", "female", "soft"),
                new("강", "최강", "가장 강한", "male", "strong"),
            },
            ["정"] = new()
            {
                new("다운", "정다운", "정이 가득한", "neutral", "soft"),
                new("겨운", "정겨운", "정겹고 따뜻한", "neutral", "soft"),
                new("우", "정우", "바른 비(雨)", "male", "neutral"),
                new("민", "정민", "바르고 영민한", "neutral", "neutral"),
            },
            ["한"] = new()
            {
                new("가람", "한가람", "큰 강", "neutral", "neutral"),
                new("별", "한별", "큰 별", "neutral", "soft"),
                new("빛", "한빛", "큰 빛", "neutral", "strong"),
                new("마루", "한마루", "큰 꼭대기", "neutral", "strong"),
            },
            ["유"] = new()
            {
                new("나", "유나", "유연하고 아름다운", "female", "soft"),
                new("찬", "유찬", "넉넉하고 찬란한", "male", "strong"),
                new("빈", "유빈", "넉넉하고 빛나는", "female", "soft"),
                new("서", "유서", "유연하고 서린", "neutral", "neutral"),
            },
            ["윤"] = new()
            {
                new("빈", "윤빈", "빛나는 보석", "female", "soft"),
                new("찬", "윤찬", "빛나고 찬란한", "male", "strong"),
                new("하", "윤하", "빛나는 하늘", "neutral", "soft"),
                new("재", "윤재", "빛나는 재능", "male", "neutral"),
            },
            ["조"] = new()
            {
                new("하", "조하", "좋은 하루", "neutral", "soft"),
                new("빛", "조빛", "아침 빛", "neutral", "soft"),
                new("연", "조연", "고요하고 아름다운", "female", "soft"),
                new("현", "조현", "밝게 나타나는", "neutral", "neutral"),
            },
            ["홍"] = new()
            {
                new("빛", "홍빛", "넓은 빛", "neutral", "neutral"),
                new("하", "홍하", "넓은 하늘 아래", "neutral", "neutral"),
                new("연", "홍연", "넓고 아름다운", "female", "soft"),
                new("준", "홍준", "넓고 준수한", "male", "neutral"),
            },
            ["오"] = new()
            {
                new("현", "오현", "크고 현명한", "neutral", "neutral"),
                new("빈", "오빈", "넓고 빛나는", "female", "soft"),
                new("찬", "오찬", "크고 찬란한", "male", "strong"),
                new("하", "오하", "크고 넓은 하늘", "neutral", "soft"),
            },
            ["황"] = new()
            {
                new("빛", "황빛", "황금빛", "neutral", "neutral"),
                new("결", "황결", "황금의 결", "neutral", "soft"),
                new("준", "황준", "빛나고 준수한", "male", "neutral"),
                new("서", "황서", "황금빛 서광", "neutral", "neutral"),
            },
            ["안"] = new()
            {
                new("빈", "안빈", "편안하고 빛나는", "female", "soft"),
                new("서", "안서", "편안한 서사", "neutral", "neutral"),
                new("율", "안율", "편안한 율동", "neutral", "soft"),
                new("준", "안준", "편안하고 준수한", "male", "neutral"),
            },

            // ── 추가 성씨 PhoneticPatterns ──
            ["감"] = new()
            {
                new("미", "감미", "감미롭고 아름다운", "female", "soft"),
                new("사", "감사", "감사하는 마음", "neutral", "soft"),
                new("동", "감동", "감동을 주는", "neutral", "neutral"),
            },
            ["경"] = new()
            {
                new("이", "경이", "경이로운", "neutral", "neutral"),
                new("쾌", "경쾌", "경쾌하고 밝은", "neutral", "strong"),
                new("사", "경사", "경사스러운", "neutral", "soft"),
            },
            ["공"] = new()
            {
                new("명", "공명", "울려퍼지는", "neutral", "strong"),
                new("감", "공감", "함께 느끼는", "neutral", "soft"),
                new("헌", "공헌", "바치고 이바지하는", "male", "strong"),
            },
            ["금"] = new()
            {
                new("빛", "금빛", "금빛 거문고", "neutral", "soft"),
                new("솔", "금솔", "거문고와 소나무", "neutral", "neutral"),
                new("하", "금하", "거문고의 하늘", "neutral", "soft"),
            },
            ["기"] = new()
            {
                new("쁨", "기쁨", "기쁨을 주는", "neutral", "soft"),
                new("연", "기연", "기이한 인연", "female", "soft"),
                new("품", "기품", "기품있는", "neutral", "strong"),
            },
            ["길"] = new()
            {
                new("빛", "길빛", "길한 빛", "neutral", "neutral"),
                new("상", "길상", "길하고 상서로운", "neutral", "neutral"),
                new("윤", "길윤", "복되고 빛나는", "neutral", "neutral"),
            },
            ["도"] = new()
            {
                new("윤", "도윤", "도읍의 빛남", "neutral", "neutral"),
                new("현", "도현", "도읍의 현명함", "male", "neutral"),
                new("빈", "도빈", "도읍의 빛", "female", "soft"),
            },
            ["마"] = new()
            {
                new("음", "마음", "따뜻한 마음", "neutral", "soft"),
                new("루", "마루", "꼭대기, 높은 곳", "neutral", "strong"),
                new("린", "마린", "바다의 말", "neutral", "neutral"),
            },
            ["목"] = new()
            {
                new("련", "목련", "목련꽃처럼 아름다운", "female", "soft"),
                new("하", "목하", "화목한 하늘 아래", "neutral", "soft"),
                new("빈", "목빈", "화목한 빛", "female", "soft"),
            },
            ["봉"] = new()
            {
                new("빛", "봉빛", "받드는 빛", "neutral", "neutral"),
                new("준", "봉준", "받드는 준수함", "male", "strong"),
                new("연", "봉연", "공경하는 인연", "female", "soft"),
            },
            ["선"] = new()
            {
                new("율", "선율", "아름다운 선율", "neutral", "soft"),
                new("물", "선물", "빛나는 선물", "neutral", "soft"),
                new("봉", "선봉", "앞장서는", "male", "strong"),
            },
            ["소"] = new()
            {
                new("율", "소율", "깨어나는 율동", "neutral", "neutral"),
                new("망", "소망", "소생의 소망", "neutral", "soft"),
                new("나무", "소나무", "소나무처럼 곧은", "neutral", "strong"),
            },
            ["손"] = new()
            {
                new("빛", "손빛", "이어지는 빛", "neutral", "neutral"),
                new("하", "손하", "미래의 하늘", "neutral", "neutral"),
                new("찬", "손찬", "젊고 찬란한", "male", "strong"),
            },
            ["어"] = new()
            {
                new("진", "어진", "어질고 착한", "neutral", "soft"),
                new("울림", "어울림", "어울리는 소리", "neutral", "soft"),
                new("윤", "어윤", "물고기의 빛남", "neutral", "neutral"),
            },
            ["여"] = new()
            {
                new("울", "여울", "여울물처럼 맑은", "neutral", "soft"),
                new("명", "여명", "밝은 새벽", "neutral", "strong"),
                new("진", "여진", "곧고 진실한", "neutral", "neutral"),
            },
            ["연"] = new()
            {
                new("하", "연하", "연한 하늘빛", "neutral", "soft"),
                new("결", "연결", "이어지는 인연", "neutral", "neutral"),
                new("빛", "연빛", "영원한 빛", "neutral", "soft"),
            },
            ["옥"] = new()
            {
                new("빛", "옥빛", "구슬처럼 맑은", "neutral", "soft"),
                new("결", "옥결", "옥같은 결", "neutral", "soft"),
                new("윤", "옥윤", "구슬의 빛남", "neutral", "soft"),
            },
            ["왕"] = new()
            {
                new("빛", "왕빛", "으뜸의 빛", "neutral", "strong"),
                new("찬", "왕찬", "위엄있는 찬란함", "male", "strong"),
                new("하", "왕하", "임금의 하늘", "neutral", "strong"),
            },
            ["용"] = new()
            {
                new("기", "용기", "용기있는", "male", "strong"),
                new("감", "용감", "용감하고 씩씩한", "male", "strong"),
                new("빛", "용빛", "용의 빛", "neutral", "strong"),
            },
            ["원"] = new()
            {
                new("빛", "원빛", "으뜸의 빛", "neutral", "neutral"),
                new("하", "원하", "원하는 하늘", "neutral", "neutral"),
                new("서", "원서", "으뜸의 서광", "neutral", "neutral"),
            },
            ["천"] = new()
            {
                new("빛", "천빛", "수많은 빛", "neutral", "neutral"),
                new("하", "천하", "온 세상", "neutral", "strong"),
                new("결", "천결", "끝없는 결", "neutral", "neutral"),
            },
            ["추"] = new()
            {
                new("빛", "추빛", "가을빛", "neutral", "soft"),
                new("수", "추수", "가을 수확", "neutral", "neutral"),
                new("하", "추하", "가을 하늘", "neutral", "soft"),
            },
            ["태"] = new()
            {
                new("양", "태양", "큰 태양처럼", "neutral", "strong"),
                new("빛", "태빛", "크나큰 빛", "neutral", "strong"),
                new("하", "태하", "큰 하늘", "neutral", "strong"),
            },
            ["채"] = new()
            {
                new("빛", "채빛", "다채로운 빛", "neutral", "soft"),
                new("윤", "채윤", "화사한 빛남", "female", "soft"),
                new("림", "채림", "빛깔있는 숲", "neutral", "neutral"),
            },
            ["현"] = new()
            {
                new("빈", "현빈", "그윽한 빛", "male", "neutral"),
                new("우", "현우", "오묘하고 씩씩한", "male", "strong"),
                new("아", "현아", "신비롭고 아름다운", "female", "soft"),
            },
            ["석"] = new()
            {
                new("빈", "석빈", "단단하고 빛나는", "neutral", "neutral"),
                new("준", "석준", "굳건하고 준수한", "male", "strong"),
                new("하", "석하", "변함없는 하늘", "neutral", "strong"),
            },
            ["염"] = new()
            {
                new("빈", "염빈", "깨끗하고 빛나는", "female", "soft"),
                new("결", "염결", "결백한 결", "neutral", "neutral"),
                new("윤", "염윤", "맑고 빛나는", "neutral", "neutral"),
            },
            ["해"] = new()
            {
                new("빛", "해빛", "바다의 빛", "neutral", "strong"),
                new("오름", "해오름", "해가 뜨는", "neutral", "strong"),
                new("솔", "해솔", "바다의 소나무", "neutral", "neutral"),
            },
            ["함"] = new()
            {
                new("께", "함께", "함께하는", "neutral", "soft"),
                new("빛", "함빛", "모두의 빛", "neutral", "soft"),
                new("울", "함울", "모두의 울림", "neutral", "neutral"),
            },
            ["은"] = new()
            {
                new("빛", "은빛", "은빛처럼 밝은", "neutral", "soft"),
                new("하", "은하", "은하수처럼", "neutral", "neutral"),
                new("결", "은결", "은은한 결", "neutral", "soft"),
            },
            ["명"] = new()
            {
                new("빛", "명빛", "밝은 빛", "neutral", "neutral"),
                new("하", "명하", "밝은 하늘", "neutral", "neutral"),
                new("찬", "명찬", "밝고 찬란한", "male", "strong"),
            },
            ["곽"] = new()
            {
                new("빈", "곽빈", "지키며 빛나는", "female", "soft"),
                new("찬", "곽찬", "든든하고 찬란한", "male", "strong"),
                new("하", "곽하", "성곽의 하늘", "neutral", "neutral"),
            },
            ["차"] = new()
            {
                new("빈", "차빈", "나아가며 빛나는", "female", "soft"),
                new("준", "차준", "앞서고 준수한", "male", "strong"),
                new("윤", "차윤", "나아가며 빛남", "neutral", "neutral"),
            },
            ["노"] = new()
            {
                new("을", "노을", "아름다운 노을", "neutral", "soft"),
                new("빈", "노빈", "넉넉하고 빛나는", "female", "soft"),
                new("래", "노래", "아름다운 노래", "neutral", "soft"),
            },
            ["구"] = new()
            {
                new("름", "구름", "하늘의 구름", "neutral", "soft"),
                new("슬", "구슬", "맑은 구슬", "neutral", "soft"),
                new("빈", "구빈", "갖추고 빛나는", "female", "soft"),
            },
            ["허"] = new()
            {
                new("윤", "허윤", "너그럽고 빛나는", "neutral", "neutral"),
                new("빈", "허빈", "포용하며 빛나는", "female", "soft"),
                new("준", "허준", "허락하고 준수한(명의)", "male", "strong"),
            },
            ["류"] = new()
            {
                new("빈", "류빈", "버들빛", "female", "soft"),
                new("찬", "류찬", "유연하고 찬란한", "male", "strong"),
                new("하", "류하", "흐르는 하늘", "neutral", "soft"),
            },
            ["나"] = new()
            {
                new("래", "나래", "날개처럼 비상하는", "neutral", "soft"),
                new("빛", "나빛", "비단빛처럼 고운", "neutral", "soft"),
                new("린", "나린", "하늘에서 내려오는", "female", "soft"),
            },
            ["탁"] = new()
            {
                new("빈", "탁빈", "뛰어나고 빛나는", "female", "soft"),
                new("찬", "탁찬", "탁월하고 찬란한", "male", "strong"),
                new("월", "탁월", "탁월하게 빛나는", "neutral", "strong"),
            },
            ["지"] = new()
            {
                new("유", "지유", "연못의 자유", "neutral", "neutral"),
                new("온", "지온", "잔잔한 온기", "neutral", "soft"),
                new("빈", "지빈", "맑고 빛나는", "female", "soft"),
            },
            ["엄"] = new()
            {
                new("빈", "엄빈", "위엄있고 빛나는", "neutral", "neutral"),
                new("찬", "엄찬", "당당하고 찬란한", "male", "strong"),
                new("격", "엄격", "엄격하고 품격있는", "neutral", "strong"),
            },
            ["고"] = new()
            {
                new("운", "고운", "고운 빛깔", "female", "soft"),
                new("결", "고결", "고결하고 깨끗한", "neutral", "neutral"),
                new("품", "고품", "높은 품격", "neutral", "strong"),
            },
            ["매"] = new()
            {
                new("화", "매화", "이른봄 매화", "female", "soft"),
                new("력", "매력", "매력있는", "neutral", "soft"),
                new("빛", "매빛", "매화빛", "neutral", "soft"),
            },
            ["범"] = new()
            {
                new("준", "범준", "모범적이고 준수한", "male", "strong"),
                new("빛", "범빛", "본보기의 빛", "neutral", "neutral"),
                new("윤", "범윤", "올바르고 빛나는", "neutral", "neutral"),
            },
        };
    }

    #endregion

    #region 내부 모델

    private record SurnameMeaning(string Hanja, string CoreMeaning, string[] Keywords);

    private record WordPatternEntry(string Name, string Word, string Meaning, string Gender, string Tone);

    private record MeaningExpansionEntry(string Name, string Meaning, string Concept, string Gender, string Tone);

    private record PhoneticPatternEntry(string Name, string PhoneticPhrase, string Meaning, string Gender, string Tone);

    #endregion
}
