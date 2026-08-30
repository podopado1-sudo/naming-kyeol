using System.Text.Json;
using System.Text.Json.Serialization;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines.Data;

    /// <summary>
    /// 한자 데이터 (오행, 음양, 획수, 의미 등)
    /// 통합 JSON 파일(hanja_dictionary_final.json)에서 대량의 인명용 한자 데이터를 로드하고, 기존 하드코딩된 상세 정보와 통합
    /// </summary>
public static class HanjaData
{
    private static volatile Dictionary<string, HanjaInfo>? _loadedDictionary;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 외부 데이터 병합까지 끝났는지. 공개 시점이 _loadedDictionary와 다르다 —
    /// LoadFromFinalJson()은 로더 내부 조회를 위해 사전을 먼저 필드에 꽂아두고
    /// 그 뒤에 외부 데이터를 병합하므로, 사전이 null이 아니라는 것만으로는
    /// 로드 완료를 뜻하지 않는다. 독자는 이 플래그를 봐야 한다.
    /// </summary>
    private static volatile bool _fullyLoaded;

    /// <summary>
    /// 지금 이 스레드가 로딩 중인지. 로더가 중간에 HanjaDictionary를 다시 조회하므로
    /// (LoadCategoryMapping 등) 로딩 스레드만은 부분 로드 상태를 그대로 보게 둔다.
    /// </summary>
    [ThreadStatic] private static bool _loadingOnThisThread;

    /// <summary>
    /// 인명에 자주 쓰이는 한자 목록 (빈도 가점용)
    /// 각 읽기별 상위 인명용 한자를 수집하여 +300 가점 부여
    /// </summary>
    private static readonly HashSet<string> CommonNameHanja = new HashSet<string>
    {
        // 주
        "珠", "柱", "株", "周", "主", "注", "朱",
        // 원
        "源", "元", "園", "遠", "院", "原", "援", "願",
        // 서
        "瑞", "書", "序", "緖", "西", "誓",
        // 윤
        "潤", "倫", "尹", "允", "閏",
        // 민
        "民", "敏", "珉", "旼", "玟",
        // 현
        "賢", "玄", "顯", "炫", "弦",
        // 준
        "俊", "準", "峻", "浚", "駿",
        // 지
        "志", "智", "知", "芝", "紙", "至",
        // 수
        "秀", "壽", "守", "修", "洙", "樹",
        // 하
        "河", "夏", "賀", "荷", "霞",
        // 은
        "恩", "銀", "殷", // 隱은 불용한자(숨을 은)로 제외
        // 진
        "眞", "珍", "振", "鎭", "津",
        // 유
        "有", "柔", "裕", "由", "遊", "維",
        // 도
        "道", "度", "都", "導",
        // 호
        "浩", "昊", "晧", "虎", "豪", "湖", "鎬", "護",
        // 예
        "睿", "藝", "禮", "譽", "叡",
        // 성
        "成", "盛", "星", "聖", "誠",
        // 영
        "英", "永", "榮", "映", "泳", // 零은 불용한자(떨어질 령)로 제외
        // 정
        "正", "靜", "情", "晶", "精", "貞",
        // 태
        "泰", "太", "兌", "胎",
        // 혜
        "惠", "慧", "蕙",
        // 연
        "然", "緣", "蓮", "延", "硏", "煙",
        // 린
        "璘", "琳", "麟", // 燐은 불용한자(도깨비불 린)로 제외
        // 아
        "雅", "亞", "兒", "娥",
        // 이
        "利", "理", "李", "二",
        // 나
        "娜", "那", "羅",
        // 빈
        "彬", "斌", "嬪", "賓",
        // 경
        "敬", "慶", "景", "京", "經", "耕",
        // 석
        "碩", "錫", "石", "席", "昔",
        // 재
        "在", "才", "載", "宰", "材", "財",
        // 상
        "尙", "祥", "相", "翔", "常", "商",
        // 동
        "東", "動", "銅", "棟", "童",
        // 용
        "龍", "勇", "容", "庸", "鎔",
        // 건
        "健", "建", "乾",
        // 우
        "宇", "佑", "雨", "友", "祐", "瑀",
        // 승
        "勝", "承", "昇", "升", "丞",
        // 기
        "基", "器", "氣", "起", "祈", "紀", "奇",
        // 광
        "光", "廣", "鑛", "曠",
        // 창
        "昌", "創", "倉", "蒼", "彰",
        // 문
        "文", "聞", "紋",
        // 중
        "重", "中", "仲",
        // 인
        "仁", "忍", "印", "寅", "引",
        // 선
        "善", "仙", "先", "宣", "鮮", "線",
        // 덕
        "德", "悳",
        // 종
        "鍾", "宗", "鐘", "種",
        // 명
        "明", "命", "銘", "茗",
        // 한
        "翰", "漢", "韓", "寒",
        // 규
        "奎", "圭", "規", "珪",
        // 철
        "哲", "徹", "喆", "鐵",
        // 형
        "亨", "兄", "型", "衡", "炯",
        // 세
        "世", "歲", "勢", "細",
        // 희
        "熙", "希", "喜", "禧", "曦",
        // 근
        "根", "勤", "謹", "近",
        // 봉
        "鳳", "奉", "峯", "逢",
        // 미
        "美", "微", "未",
        // 소
        "素", "昭", "紹", "蘇", "召", "少",
        // 란
        "蘭", "瀾",
        // 경 (이미 위에 포함)
        // 빛/음 관련
        "照", "輝", "耀", "燦",
        // 복
        "福", "馥",
        // 강
        "康", "強", "剛", "江",
        // 국
        "國", "菊",
        // 남
        "南", "男", "楠",
        // 백
        "伯", "白", "百", "栢",
        // 환
        "煥", "桓", "歡", "環", "丸",
        // 학
        "學", "鶴",
        // 충
        "忠", "充",
        // 신
        "信", "新", "申", "慎", "辛", // 神은 불용한자(귀신 신)로 제외
        // 시
        "詩", "時", "始", "施",
        // 림/임
        "林", "臨", "任",
        // 안
        "安", "眼",
        // 음 아름다움 관련
        "瑤", "瑛", "琉", "玲", "瑾", "璇", "琪",
    };
    // [2026-03-26 삭제] _externalDataState (volatile int, 0=미로딩/2=완료)
    // 원래 용도: 외부 데이터(Unihan, 의미, 카테고리) 중복 로딩 방지 플래그
    // 삭제 이유: HanjaData 경합 해결 시 외부 데이터 로딩을 LoadFromFinalJson() 안으로 통합하면서
    //           이 플래그를 읽는 코드가 모두 제거됨 → CS0414 경고 발생 → 필드 삭제

    /// <summary>
    /// 한자 정보
    /// </summary>
    public class HanjaInfo
    {
        public string Character { get; set; } = string.Empty;
        public string Reading { get; set; } = string.Empty; // 한글 발음
        public string Meaning { get; set; } = string.Empty; // 의미
        public string FiveElement { get; set; } = string.Empty; // 오행: 木, 火, 土, 金, 水
        public string YinYang { get; set; } = string.Empty; // 음양: 陰, 陽
        public int StrokeCount { get; set; } // 획수
        public string Category { get; set; } = string.Empty; // 자연, 덕목, 개념 등 (하위 호환성)
        
        // 확장된 카테고리 정보 (새 스키마)
        public string CategoryMajor { get; set; } = string.Empty; // NATURE, VIRTUE, CONCEPT 등
        public string CategoryMinor { get; set; } = string.Empty; // WATER, MORAL, MIND 등
        public List<string> CategoryTags { get; set; } = new List<string>(); // 검색/추천용 키워드
        public List<string> CategoryEvidence { get; set; } = new List<string>(); // 분류 근거
        public double CategoryConfidence { get; set; } = 0.0; // 자동 분류 신뢰도 (0~1)
        
        public GenderPreference GenderPref { get; set; } = GenderPreference.Neutral; // 성별 선호도
        public TonePreference TonePref { get; set; } = TonePreference.Neutral; // 톤 선호도
        public string Unicode { get; set; } = string.Empty; // 유니코드 값
        public string Consonant { get; set; } = string.Empty; // 첫 자음
        public List<string> AlternateReadings { get; set; } = new(); // 대체 발음 (예: "률" → ["율"])
        public bool IsGovernmentListed { get; set; } = false; // 대법원 인명용 한자 목록 포함 여부

        // ── 다층 판정 레이어 (Tiered Resolution) ──────────────────────────
        /// <summary>강희자전 원획법 획수 (표시 획수와 다를 수 있음)</summary>
        public int KangxiStrokes { get; set; }
        /// <summary>오행 판정 신뢰도: S=검수완료, A=규칙기반확인, B=자동추정, D=획수fallback</summary>
        public string ConfidenceGrade { get; set; } = "D";
        /// <summary>오행 판정 근거 (예: "仁=木(동방/생명/인자함)")</summary>
        public string Rationale { get; set; } = string.Empty;
        /// <summary>데이터 출처: Core_v1, Manual, Auto_Radical, Auto_Fallback</summary>
        public string Source { get; set; } = "Auto_Fallback";
    }

    public enum GenderPreference
    {
        Neutral,
        Male,
        Female
    }

    public enum TonePreference
    {
        Neutral,
        Soft,
        Strong
    }

    /// <summary>
    /// 기존 하드코딩된 상세 한자 정보 (오행, 음양, 의미 등 포함)
    /// </summary>
    private static readonly Dictionary<string, HanjaInfo> _detailedHanjaDictionary = new()
    {
        // 자연 계열
        { "春", new HanjaInfo { Character = "春", Reading = "춘", Meaning = "봄", FiveElement = "木", YinYang = "陽", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "秋", new HanjaInfo { Character = "秋", Reading = "추", Meaning = "가을", FiveElement = "金", YinYang = "陰", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "天", new HanjaInfo { Character = "天", Reading = "천", Meaning = "하늘", FiveElement = "火", YinYang = "陽", StrokeCount = 4, Category = "자연", TonePref = TonePreference.Neutral } },
        { "海", new HanjaInfo { Character = "海", Reading = "해", Meaning = "바다", FiveElement = "水", YinYang = "陰", StrokeCount = 10, Category = "자연", TonePref = TonePreference.Strong } },
        { "雲", new HanjaInfo { Character = "雲", Reading = "운", Meaning = "구름", FiveElement = "水", YinYang = "陰", StrokeCount = 12, Category = "자연", TonePref = TonePreference.Soft } },
        { "山", new HanjaInfo { Character = "山", Reading = "산", Meaning = "산", FiveElement = "土", YinYang = "陽", StrokeCount = 3, Category = "자연", TonePref = TonePreference.Strong } },
        { "林", new HanjaInfo { Character = "林", Reading = "림", Meaning = "숲", FiveElement = "木", YinYang = "陽", StrokeCount = 8, Category = "자연", TonePref = TonePreference.Neutral } },
        { "月", new HanjaInfo { Character = "月", Reading = "월", Meaning = "달", FiveElement = "水", YinYang = "陰", StrokeCount = 4, Category = "자연", TonePref = TonePreference.Soft } },
        { "星", new HanjaInfo { Character = "星", Reading = "성", Meaning = "별", FiveElement = "火", YinYang = "陽", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "花", new HanjaInfo { Character = "花", Reading = "화", Meaning = "꽃", FiveElement = "木", YinYang = "陰", StrokeCount = 7, Category = "자연", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },

        // 덕목 계열
        { "和", new HanjaInfo { Character = "和", Reading = "화", Meaning = "화목", FiveElement = "火", YinYang = "陽", StrokeCount = 8, Category = "덕목", TonePref = TonePreference.Soft } },
        { "正", new HanjaInfo { Character = "正", Reading = "정", Meaning = "바름", FiveElement = "金", YinYang = "陽", StrokeCount = 5, Category = "덕목", TonePref = TonePreference.Strong } },
        { "道", new HanjaInfo { Character = "道", Reading = "도", Meaning = "길", FiveElement = "火", YinYang = "陽", StrokeCount = 12, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "均", new HanjaInfo { Character = "均", Reading = "균", Meaning = "고름", FiveElement = "土", YinYang = "陽", StrokeCount = 7, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "明", new HanjaInfo { Character = "明", Reading = "명", Meaning = "밝음", FiveElement = "火", YinYang = "陽", StrokeCount = 8, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "德", new HanjaInfo { Character = "德", Reading = "덕", Meaning = "덕", FiveElement = "火", YinYang = "陽", StrokeCount = 15, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "善", new HanjaInfo { Character = "善", Reading = "선", Meaning = "착함", FiveElement = "金", YinYang = "陽", StrokeCount = 12, Category = "덕목", TonePref = TonePreference.Soft } },
        { "仁", new HanjaInfo { Character = "仁", Reading = "인", Meaning = "어짐", FiveElement = "金", YinYang = "陽", StrokeCount = 4, Category = "덕목", TonePref = TonePreference.Soft } },

        // 개념 계열
        { "永", new HanjaInfo { Character = "永", Reading = "영", Meaning = "길이", FiveElement = "土", YinYang = "陽", StrokeCount = 5, Category = "개념", TonePref = TonePreference.Neutral } },
        { "流", new HanjaInfo { Character = "流", Reading = "류", Meaning = "흐름", FiveElement = "水", YinYang = "陰", StrokeCount = 10, Category = "개념", TonePref = TonePreference.Neutral } },
        { "恒", new HanjaInfo { Character = "恒", Reading = "항", Meaning = "항상", FiveElement = "火", YinYang = "陽", StrokeCount = 9, Category = "개념", TonePref = TonePreference.Neutral } },
        { "光", new HanjaInfo { Character = "光", Reading = "광", Meaning = "빛", FiveElement = "火", YinYang = "陽", StrokeCount = 6, Category = "개념", TonePref = TonePreference.Neutral } },
        { "智", new HanjaInfo { Character = "智", Reading = "지", Meaning = "지혜", FiveElement = "火", YinYang = "陽", StrokeCount = 12, Category = "개념", TonePref = TonePreference.Neutral } },
        { "勇", new HanjaInfo { Character = "勇", Reading = "용", Meaning = "용기", FiveElement = "土", YinYang = "陽", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "信", new HanjaInfo { Character = "信", Reading = "신", Meaning = "믿음", FiveElement = "金", YinYang = "陽", StrokeCount = 9, Category = "개념", TonePref = TonePreference.Neutral } },
        { "誠", new HanjaInfo { Character = "誠", Reading = "성", Meaning = "정성", FiveElement = "金", YinYang = "陽", StrokeCount = 13, Category = "개념", TonePref = TonePreference.Neutral } },

        // 남성 선호
        { "俊", new HanjaInfo { Character = "俊", Reading = "준", Meaning = "준수함", FiveElement = "火", YinYang = "陽", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Neutral } },
        { "建", new HanjaInfo { Character = "建", Reading = "건", Meaning = "세움", FiveElement = "木", YinYang = "陽", StrokeCount = 8, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "雄", new HanjaInfo { Character = "雄", Reading = "웅", Meaning = "웅대함", FiveElement = "水", YinYang = "陽", StrokeCount = 12, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "豪", new HanjaInfo { Character = "豪", Reading = "호", Meaning = "호걸", FiveElement = "水", YinYang = "陽", StrokeCount = 14, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },

        // 여성 선호
        { "美", new HanjaInfo { Character = "美", Reading = "미", Meaning = "아름다움", FiveElement = "水", YinYang = "陰", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "雅", new HanjaInfo { Character = "雅", Reading = "아", Meaning = "우아함", FiveElement = "木", YinYang = "陰", StrokeCount = 12, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "秀", new HanjaInfo { Character = "秀", Reading = "수", Meaning = "빼어남", FiveElement = "金", YinYang = "陰", StrokeCount = 7, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "恩", new HanjaInfo { Character = "恩", Reading = "은", Meaning = "은혜", FiveElement = "土", YinYang = "陰", StrokeCount = 10, Category = "덕목", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "惠", new HanjaInfo { Character = "惠", Reading = "혜", Meaning = "은혜", FiveElement = "水", YinYang = "陰", StrokeCount = 12, Category = "덕목", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },

        // 중립/인기
        { "우", new HanjaInfo { Character = "우", Reading = "우", Meaning = "나", FiveElement = "土", YinYang = "陽", StrokeCount = 4, Category = "개념", TonePref = TonePreference.Neutral } },
        { "진", new HanjaInfo { Character = "진", Reading = "진", Meaning = "참", FiveElement = "火", YinYang = "陽", StrokeCount = 10, Category = "개념", TonePref = TonePreference.Neutral } },
        { "서", new HanjaInfo { Character = "서", Reading = "서", Meaning = "서쪽", FiveElement = "金", YinYang = "陰", StrokeCount = 6, Category = "개념", TonePref = TonePreference.Neutral } },
        { "하", new HanjaInfo { Character = "하", Reading = "하", Meaning = "아래", FiveElement = "水", YinYang = "陰", StrokeCount = 3, Category = "개념", TonePref = TonePreference.Neutral } },
        { "윤", new HanjaInfo { Character = "윤", Reading = "윤", Meaning = "윤리", FiveElement = "土", YinYang = "陽", StrokeCount = 4, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "민", new HanjaInfo { Character = "민", Reading = "민", Meaning = "백성", FiveElement = "水", YinYang = "陽", StrokeCount = 5, Category = "개념", TonePref = TonePreference.Neutral } },
        { "지", new HanjaInfo { Character = "지", Reading = "지", Meaning = "땅", FiveElement = "土", YinYang = "陽", StrokeCount = 6, Category = "개념", TonePref = TonePreference.Neutral } },
        { "현", new HanjaInfo { Character = "현", Reading = "현", Meaning = "현재", FiveElement = "水", YinYang = "陽", StrokeCount = 8, Category = "개념", TonePref = TonePreference.Neutral } },
        { "연", new HanjaInfo { Character = "연", Reading = "연", Meaning = "연결", FiveElement = "火", YinYang = "陽", StrokeCount = 11, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "채", new HanjaInfo { Character = "채", Reading = "채", Meaning = "채소", FiveElement = "木", YinYang = "陽", StrokeCount = 11, Category = "자연", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
    };

    /// <summary>
    /// 인명용 한자 사전 (통합 JSON 데이터와 기존 상세 데이터 통합)
    /// </summary>
    public static Dictionary<string, HanjaInfo> HanjaDictionary
    {
        get
        {
            // _loadedDictionary != null 을 완료 신호로 쓰면 안 된다.
            // LoadFromFinalJson()이 외부 데이터를 병합하기 전에 사전을 필드에 꽂기 때문에,
            // 그 사이에 들어온 다른 스레드가 Core_v1·인명빈도가 빠진 사전을 그대로 들고 나간다.
            //
            // 두 필드를 지역 변수로 한 번씩만 읽는다 — _fullyLoaded 확인과 _loadedDictionary
            // 반환 사이에 다른 스레드가 Reload()로 필드를 내리면 null을 !로 억지 반환하게 된다.
            var snapshot = _loadedDictionary;
            if (_fullyLoaded && snapshot != null) return snapshot;

            // 로딩 중인 스레드 자신의 재진입 — 여기서 lock을 다시 잡으면 재귀 로드가 된다
            if (_loadingOnThisThread) return _loadedDictionary!;

            lock (_lockObject)
            {
                if (!_fullyLoaded)
                {
                    _loadingOnThisThread = true;
                    try
                    {
                        if (_loadedDictionary == null) LoadFromFinalJson();
                    }
                    catch
                    {
                        // 로드 도중 예외가 전파되면 부분 병합 사전이 필드에 남는다.
                        // 그대로 두면 다음 호출자가 null 가드를 통과해 재로드를 건너뛰고
                        // 그 부분 사전을 완료로 승격시킨다 — 이 수정이 막으려던 증상 그대로.
                        _loadedDictionary = null;
                        throw;
                    }
                    finally
                    {
                        _loadingOnThisThread = false;
                    }
                    _fullyLoaded = true; // 병합까지 끝난 뒤에야 독자에게 공개
                }
                return _loadedDictionary!; // lock 안에서 반환 — Reload()와의 경합 창 제거
            }
        }
    }

    /// <summary>
    /// 총획수로부터 오행 계산 (원획법 기준)
    /// 총획수가 10 이상이면 끝자리(일의 자리)만 사용
    /// </summary>
    /// <param name="totalStrokes">총획수</param>
    /// <returns>오행: 木, 火, 土, 金, 水 중 하나</returns>
    private static string CalculateFiveElementFromStrokes(int totalStrokes)
    {
        if (totalStrokes <= 0)
            return string.Empty;

        // 총획수가 10 이상이면 끝자리만 사용
        int lastDigit = totalStrokes >= 10 ? totalStrokes % 10 : totalStrokes;

        // 오행 매핑 규칙
        // 1,2 → 목(木)
        // 3,4 → 화(火)
        // 5,6 → 토(土)
        // 7,8 → 금(金)
        // 9,0 → 수(水)
        return lastDigit switch
        {
            1 or 2 => "木",
            3 or 4 => "火",
            5 or 6 => "土",
            7 or 8 => "金",
            9 or 0 => "水",
            _ => string.Empty
        };
    }

    /// <summary>
    /// 총획수로부터 음양 계산 (원획법 기준)
    /// 총획수가 10 이상이면 끝자리(일의 자리)만 사용
    /// </summary>
    /// <param name="totalStrokes">총획수</param>
    /// <returns>음양: 陰, 陽 중 하나</returns>
    private static string CalculateYinYangFromStrokes(int totalStrokes)
    {
        if (totalStrokes <= 0)
            return string.Empty;

        // 총획수가 10 이상이면 끝자리만 사용
        int lastDigit = totalStrokes >= 10 ? totalStrokes % 10 : totalStrokes;

        // 음양 판별 규칙
        // 홀수(1,3,5,7,9) → 양(陽)
        // 짝수(2,4,6,8,0) → 음(陰)
        return lastDigit % 2 == 0 ? "陰" : "陽";
    }

    /// <summary>
    /// 총획수가 있으면 자동으로 오행과 음양을 계산하여 설정
    /// </summary>
    /// <param name="hanjaInfo">한자 정보</param>
    private static void AutoCalculateFiveElementAndYinYang(HanjaInfo hanjaInfo)
    {
        if (hanjaInfo.StrokeCount > 0)
        {
            // 오행이 없으면 자동 계산 (Tier 4 fallback)
            if (string.IsNullOrEmpty(hanjaInfo.FiveElement))
            {
                hanjaInfo.FiveElement = CalculateFiveElementFromStrokes(hanjaInfo.StrokeCount);
                // 획수 기반 자동 계산 = 최저 신뢰도
                if (hanjaInfo.Source == "Auto_Fallback" || string.IsNullOrEmpty(hanjaInfo.Source))
                {
                    hanjaInfo.Source = "Auto_Fallback";
                    hanjaInfo.ConfidenceGrade = "D";
                }
            }

            // 음양이 없으면 자동 계산
            if (string.IsNullOrEmpty(hanjaInfo.YinYang))
            {
                hanjaInfo.YinYang = CalculateYinYangFromStrokes(hanjaInfo.StrokeCount);
            }
        }
    }

    /// <summary>
    /// 의미 기반 자동 카테고리 분류 (JSON 설정 파일 기반)
    /// 가장 긴 매칭 키워드가 이기고(완전 일치가 자연히 최우선), 동률이면 자연→덕목→개념 순
    /// </summary>
    private static string ClassifyCategoryByMeaning(string meaning)
    {
        if (string.IsNullOrEmpty(meaning))
            return "기타";

        var meaningLower = meaning.ToLower();
        var legacyKeywords = CategoryKeywordsLoader.LegacyCategoryKeywords;
        var categoryOrder = new[] { "자연", "덕목", "개념" };

        List<(string Category, IReadOnlyList<string> Keywords)> sources;
        if (legacyKeywords != null && legacyKeywords.Count > 0)
        {
            // JSON 설정 파일에서 키워드 로드 (하위 호환성)
            sources = categoryOrder
                .Where(legacyKeywords.ContainsKey)
                .Select(c => (c, (IReadOnlyList<string>)legacyKeywords[c]))
                .ToList();
        }
        else
        {
            // 기본값 (하위 호환성 - JSON 파일이 없을 때)
            sources = new List<(string, IReadOnlyList<string>)>
            {
                ("자연", new[] {
                    "봄", "여름", "가을", "겨울", "하늘", "바다", "산", "강", "물", "불", "구름", "별", "달", "해", "꽃", "나무", "숲", "바람", "비", "눈", "새", "동물"
                }),
                ("덕목", new[] {
                    "덕", "선", "효", "충", "신", "의", "예", "지", "인", "정", "화", "화목", "바름", "고름", "은혜", "정성", "믿음"
                }),
                ("개념", new[] {
                    "빛", "지혜", "용기", "길이", "항상", "흐름", "현재", "미래", "과거", "영원", "강함", "부", "명예", "성공"
                })
            };
        }

        // 짧은 키워드 선점 오분류 방지 ('용기'가 자연 '용'에, '지혜'가 덕목 '지'에 걸리던 문제)
        var bestCategory = "기타";
        var bestLength = 0;
        foreach (var (category, keywords) in sources)
        {
            foreach (var kw in keywords)
            {
                if (kw.Length > bestLength && meaningLower.Contains(kw.ToLower()))
                {
                    bestCategory = category;
                    bestLength = kw.Length;
                }
            }
        }

        return bestCategory;
    }

    /// <summary>
    /// 통합 JSON 파일에서 한자 데이터 로드 및 기존 상세 데이터와 통합
    /// </summary>
    private static void LoadFromFinalJson()
    {
        var dict = new Dictionary<string, HanjaInfo>();

        // 1. 기존 상세 데이터 먼저 로드 (Tier 2: Manual)
        foreach (var kvp in _detailedHanjaDictionary)
        {
            var info = kvp.Value;
            // 하드코딩 데이터는 수동 검증된 것으로 표시
            if (string.IsNullOrEmpty(info.Source) || info.Source == "Auto_Fallback")
            {
                info.Source = "Manual";
                info.ConfidenceGrade = "B"; // 수동 작성이나 전문 검수 미완
            }
            dict[kvp.Key] = info;
        }

        // 2. hanja_dictionary_final.json 파일에서 데이터 로드
        // 여러 경로에서 JSON 파일 찾기 (data 폴더 우선, 프로젝트 루트, 실행 디렉토리 등)
        var jsonDataPaths = new List<string>();

        // 실행 디렉토리에서 찾기
        var execDir = AppContext.BaseDirectory;
        jsonDataPaths.Add(Path.Combine(execDir, "data", "hanja_dictionary_final.json")); // data 폴더 우선
        jsonDataPaths.Add(Path.Combine(execDir, "hanja_dictionary_final.json"));

        // 현재 작업 디렉토리에서 찾기
        var currentDir = Directory.GetCurrentDirectory();
        jsonDataPaths.Add(Path.Combine(currentDir, "data", "hanja_dictionary_final.json")); // data 폴더 우선
        jsonDataPaths.Add(Path.Combine(currentDir, "hanja_dictionary_final.json"));

        // 프로젝트 루트에서 찾기 (개발 환경)
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));
        jsonDataPaths.Add(Path.Combine(projectRoot, "data", "hanja_dictionary_final.json")); // data 폴더 우선
        jsonDataPaths.Add(Path.Combine(projectRoot, "hanja_dictionary_final.json"));

        var jsonFilePath = jsonDataPaths.FirstOrDefault(File.Exists);

        if (jsonFilePath == null)
        {
            // JSON 파일을 찾을 수 없으면 기존 상세 데이터만 사용
            _loadedDictionary = dict;
            return;
        }

        try
        {
            var jsonContent = File.ReadAllText(jsonFilePath, System.Text.Encoding.UTF8);
            var jsonData = JsonSerializer.Deserialize<Dictionary<string, FinalJsonEntry>>(jsonContent);

            if (jsonData == null)
            {
                _loadedDictionary = dict;
                return;
            }

            // 3. JSON 데이터를 통합 (기존 상세 데이터가 있으면 유지, 없으면 JSON 데이터로 생성)
            foreach (var kvp in jsonData)
            {
                var hanja = kvp.Key;
                var entry = kvp.Value;

                if (!dict.ContainsKey(hanja))
                {
                    // 기존 상세 데이터가 없으면 JSON 데이터로 기본 정보 생성
                    // 여러 발음이 있으면 첫 번째 발음을 기본으로 사용
                    // 쉼표 포함 reading 정리: "률,율" → "률"
                    var rawReading = entry.readings_hangul?.FirstOrDefault() ?? string.Empty;
                    var firstReading = rawReading.Contains(',') ? rawReading.Split(',')[0].Trim() : rawReading;
                    var firstConsonant = entry.initial_consonants?.FirstOrDefault() ?? string.Empty;
                    if (firstConsonant == "nan") firstConsonant = string.Empty;
                    
                    // 카테고리 결정: JSON의 category > 의미 기반 자동 분류 > "기타"
                    string category;
                    if (!string.IsNullOrEmpty(entry.category))
                    {
                        category = entry.category;
                    }
                    else if (!string.IsNullOrEmpty(entry.meaning_ko))
                    {
                        category = ClassifyCategoryByMeaning(entry.meaning_ko);
                    }
                    else
                    {
                        category = "기타";
                    }
                    
                    // 의미 추출 (여러 필드명 지원)
                    var meaning = entry.meaning_ko ?? 
                                  entry.meaning_en ?? 
                                  entry.definition ?? 
                                  entry.kDefinition ?? 
                                  string.Empty;
                    
                    // 획수 추출 (여러 필드명 지원)
                    var strokeCount = entry.total_strokes ?? 
                                     entry.strokeCount ?? 
                                     0;
                    
                    // 오행 추출 (여러 필드명 지원)
                    var fiveElement = entry.five_element ?? 
                                     entry.fiveElement ?? 
                                     string.Empty;
                    
                    // 음양 추출 (여러 필드명 지원)
                    var yinYang = entry.yin_yang ?? 
                                 entry.yinYang ?? 
                                 string.Empty;
                    
                    // 모든 발음 수집 (쉼표 분리 포함)
                    var allReadings = new HashSet<string>();
                    if (entry.readings_hangul != null)
                    {
                        foreach (var r in entry.readings_hangul)
                        {
                            foreach (var part in r.Split(','))
                            {
                                var trimmed = part.Trim();
                                if (!string.IsNullOrEmpty(trimmed))
                                    allReadings.Add(trimmed);
                            }
                        }
                    }
                    var alternateReadings = allReadings.Where(r => r != firstReading).ToList();

                    var newHanjaInfo = new HanjaInfo
                    {
                        Character = hanja,
                        Reading = firstReading,
                        AlternateReadings = alternateReadings,
                        Unicode = entry.unicode_hex ?? string.Empty,
                        Consonant = firstConsonant,
                        Meaning = meaning,
                        FiveElement = fiveElement,
                        YinYang = yinYang,
                        StrokeCount = strokeCount,
                        Category = category,
                        GenderPref = GenderPreference.Neutral,
                        TonePref = TonePreference.Neutral
                    };

                    // 총획수가 있으면 자동으로 오행과 음양 계산
                    AutoCalculateFiveElementAndYinYang(newHanjaInfo);

                    dict[hanja] = newHanjaInfo;
                }
                else
                {
                    // 기존 상세 데이터가 있으면 JSON 데이터로 보완 (상세 데이터 우선, 덮어쓰지 않음)
                    var existing = dict[hanja];
                    
                    // Unicode 정보 업데이트 (없는 경우만)
                    if (string.IsNullOrEmpty(existing.Unicode) && !string.IsNullOrEmpty(entry.unicode_hex))
                    {
                        existing.Unicode = entry.unicode_hex;
                    }
                    
                    // Consonant 정보 업데이트 (없는 경우만)
                    if (string.IsNullOrEmpty(existing.Consonant) && entry.initial_consonants?.Any() == true)
                    {
                        existing.Consonant = entry.initial_consonants.First();
                    }
                    
                    // 의미 정보 업데이트 (없는 경우만, 여러 필드명 지원)
                    if (string.IsNullOrEmpty(existing.Meaning))
                    {
                        var meaning = entry.meaning_ko ?? 
                                     entry.meaning_en ?? 
                                     entry.definition ?? 
                                     entry.kDefinition ?? 
                                     string.Empty;
                        
                        if (!string.IsNullOrEmpty(meaning))
                        {
                            existing.Meaning = meaning;
                            // 카테고리가 없거나 "기타"인 경우 자동 분류 시도
                            if (string.IsNullOrEmpty(existing.Category) || existing.Category == "기타")
                            {
                                existing.Category = ClassifyCategoryByMeaning(meaning);
                            }
                        }
                    }
                    
                    // 획수 정보 업데이트 (없는 경우만, 상세 데이터가 우선, 여러 필드명 지원)
                    // total_strokes 필드를 우선적으로 읽고, 없으면 strokeCount 필드 사용
                    bool strokeCountUpdated = false;
                    if (existing.StrokeCount == 0)
                    {
                        var strokeCount = entry.total_strokes ?? entry.strokeCount ?? 0;
                        if (strokeCount > 0)
                        {
                            existing.StrokeCount = strokeCount;
                            strokeCountUpdated = true;
                        }
                    }
                    else if (entry.total_strokes.HasValue && entry.total_strokes.Value > 0 && existing.StrokeCount != entry.total_strokes.Value)
                    {
                        // 기존 획수가 있지만 total_strokes가 다르면 업데이트 (더 정확한 데이터)
                        existing.StrokeCount = entry.total_strokes.Value;
                        strokeCountUpdated = true;
                    }
                    
                    // 카테고리 정보 업데이트 (없거나 "기타"인 경우만)
                    if ((string.IsNullOrEmpty(existing.Category) || existing.Category == "기타") && !string.IsNullOrEmpty(entry.category))
                    {
                        existing.Category = entry.category;
                    }
                    else if ((string.IsNullOrEmpty(existing.Category) || existing.Category == "기타"))
                    {
                        // 의미 기반 자동 분류 시도
                        var meaning = entry.meaning_ko ?? 
                                     entry.meaning_en ?? 
                                     entry.definition ?? 
                                     entry.kDefinition ?? 
                                     string.Empty;
                        if (!string.IsNullOrEmpty(meaning))
                        {
                            existing.Category = ClassifyCategoryByMeaning(meaning);
                        }
                    }
                    
                    // 오행 정보 업데이트 (없는 경우만, 여러 필드명 지원)
                    if (string.IsNullOrEmpty(existing.FiveElement))
                    {
                        var fiveElement = entry.five_element ?? entry.fiveElement ?? string.Empty;
                        if (!string.IsNullOrEmpty(fiveElement))
                        {
                            existing.FiveElement = fiveElement;
                        }
                    }
                    
                    // 음양 정보 업데이트 (없는 경우만, 여러 필드명 지원)
                    if (string.IsNullOrEmpty(existing.YinYang))
                    {
                        var yinYang = entry.yin_yang ?? entry.yinYang ?? string.Empty;
                        if (!string.IsNullOrEmpty(yinYang))
                        {
                            existing.YinYang = yinYang;
                        }
                    }

                    // 획수가 업데이트되었거나, 오행/음양이 없는 경우 자동 계산
                    if (strokeCountUpdated || string.IsNullOrEmpty(existing.FiveElement) || string.IsNullOrEmpty(existing.YinYang))
                    {
                        AutoCalculateFiveElementAndYinYang(existing);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            // 로그 출력 (실제 운영 시에는 로거 사용)
            System.Diagnostics.Debug.WriteLine($"통합 JSON 파일 로드 실패: {ex.Message}");
        }

        // Assign fully populated dictionary so LoadExternalDataCore can see it
        _loadedDictionary = dict;

        // Load external data as part of initialization (meanings, unihan, categories, gender/tone)
        // 여기서 _loadedDictionary는 이미 채워져 있지만 아직 완성이 아니다.
        // 독자는 _fullyLoaded로 막혀 있고, 로더 자신만 _loadingOnThisThread로 통과한다.
        LoadExternalDataCore();

        // ── Tier 3: Auto_Radical (의미 기반 오행 추정, grade=C) ──────────
        // Tier 1이 나중에 덮어쓰므로 여기서 먼저 적용
        LoadRadicalElementMap();

        // ── Tier 1: Core Dataset (최고 우선순위 — 마지막에 덮어씀) ────────
        LoadCoreDataset();

        // ── Unicode 획수 (수리사격용 — kTotalStrokes 95.8% 커버) ──────────
        LoadStrokeData();

        // ── 대표 훈 오버라이드 (모든 Meaning 기록자 이후 — LoadMeaningsFromJson이 덮어쓰므로) ──
        ApplyGlossOverrides();
    }

    /// <summary>
    /// Core Dataset v1 (hanja_core_v1.json) 로드 — Tier 1 최고 신뢰도.
    /// 五常 원칙 + 자원오행 전문 근거로 검수된 데이터.
    /// 기존 오행/획수를 무조건 덮어씁니다.
    /// </summary>
    private static void LoadCoreDataset()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        var paths = new[]
        {
            Path.Combine(execDir, "data", "hanja_core_v1.json"),
            Path.Combine(currentDir, "data", "hanja_core_v1.json"),
            Path.Combine(projectRoot, "data", "hanja_core_v1.json"),
        };

        var filePath = paths.FirstOrDefault(File.Exists);
        if (filePath == null) return;

        try
        {
            var json = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var entries = JsonSerializer.Deserialize<List<CoreDatasetEntry>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (entries == null) return;

            // ── Sanity Check ────────────────────────────────────────────
            var englishElements = new HashSet<string> { "Wood", "Fire", "Earth", "Metal", "Water" };
            var validElements   = new HashSet<string> { "木", "火", "土", "金", "水" };
            int sanityErrors = 0;

            foreach (var entry in entries)
            {
                if (string.IsNullOrWhiteSpace(entry.Hanja)) continue;

                // 1. 영문 오행 감지
                if (!string.IsNullOrEmpty(entry.FiveElement) && englishElements.Contains(entry.FiveElement))
                {
                    System.Diagnostics.Debug.WriteLine(
                        $"[Core Dataset] ❌ SANITY ERROR: {entry.Hanja}({entry.Hangul}) — " +
                        $"five_element='{entry.FiveElement}' 영문 오행. 木/火/土/金/水 로 수정 필요.");
                    sanityErrors++;
                }
                // 2. 유효하지 않은 오행 값
                else if (!string.IsNullOrEmpty(entry.FiveElement) && !validElements.Contains(entry.FiveElement))
                {
                    System.Diagnostics.Debug.WriteLine(
                        $"[Core Dataset] ❌ SANITY ERROR: {entry.Hanja}({entry.Hangul}) — " +
                        $"five_element='{entry.FiveElement}' 유효하지 않은 값.");
                    sanityErrors++;
                }

                // 3. 강희획수 범위 체크 (1~64)
                if (entry.KangxiStrokes < 1 || entry.KangxiStrokes > 64)
                {
                    System.Diagnostics.Debug.WriteLine(
                        $"[Core Dataset] ⚠️  SANITY WARN: {entry.Hanja}({entry.Hangul}) — " +
                        $"kangxi_strokes={entry.KangxiStrokes} 범위 초과 (1~64).");
                }

                // 4. hanja 필드에 한글 감지 (순서 뒤바뀜)
                if (!string.IsNullOrEmpty(entry.Hanja) &&
                    entry.Hanja.Length == 1 && entry.Hanja[0] >= '\uAC00' && entry.Hanja[0] <= '\uD7A3')
                {
                    System.Diagnostics.Debug.WriteLine(
                        $"[Core Dataset] ❌ SANITY ERROR: hanja='{entry.Hanja}' 한글 감지 — hanja/hangul 순서 뒤바뀜.");
                    sanityErrors++;
                }
            }

            if (sanityErrors > 0)
                System.Diagnostics.Debug.WriteLine($"[Core Dataset] ⚠️  Sanity Check: {sanityErrors}건 오류 발견. 데이터 수정 후 재시작 권장.");
            // ────────────────────────────────────────────────────────────

            foreach (var entry in entries)
            {
                if (string.IsNullOrWhiteSpace(entry.Hanja)) continue;

                if (dict.TryGetValue(entry.Hanja, out var existing))
                {
                    // 기존 항목에 Core Dataset 정보 덮어씀 (Tier 1 우선)
                    if (!string.IsNullOrEmpty(entry.FiveElement))
                        existing.FiveElement = entry.FiveElement;
                    if (entry.KangxiStrokes > 0)
                        existing.KangxiStrokes = entry.KangxiStrokes;
                    if (!string.IsNullOrEmpty(entry.Rationale))
                        existing.Rationale = entry.Rationale;
                    existing.ConfidenceGrade = entry.Confidence ?? "S";
                    existing.Source = "Core_v1";

                    // 음양은 KangxiStrokes 기준으로 재계산
                    if (entry.KangxiStrokes > 0)
                        existing.YinYang = CalculateYinYangFromStrokes(entry.KangxiStrokes);
                }
                else
                {
                    // 사전에 없는 경우 새로 추가
                    dict[entry.Hanja] = new HanjaInfo
                    {
                        Character      = entry.Hanja,
                        Reading        = entry.Hangul ?? string.Empty,
                        FiveElement    = entry.FiveElement ?? string.Empty,
                        YinYang        = entry.KangxiStrokes > 0
                            ? CalculateYinYangFromStrokes(entry.KangxiStrokes) : string.Empty,
                        StrokeCount    = entry.KangxiStrokes,
                        KangxiStrokes  = entry.KangxiStrokes,
                        Rationale      = entry.Rationale ?? string.Empty,
                        ConfidenceGrade = entry.Confidence ?? "S",
                        Source         = "Core_v1",
                        Category       = "덕목",
                    };
                }
            }

            // ── Core Dataset 후처리: "기타" 카테고리 재분류 ────────────────────
            // Core_v1 한자의 약 64%가 final.json 기본값 "기타"로 남아있음.
            // NamePoolEngine이 natureHanja/virtueHanja/conceptHanja로 분기하므로
            // Rationale + Meaning 키워드 기반으로 재분류해야 조합 풀에 반영됨.
            ReclassifyCoreDatasetCategories();

            System.Diagnostics.Debug.WriteLine($"[Core Dataset] {entries.Count}자 Tier 1 로드 완료");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Core Dataset] 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// Unicode kTotalStrokes 기반 획수 데이터 로드 (hanja_strokes.json, 9,190자 95.8% 커버).
    /// 수리사격 계산용. StrokeCount가 0인 항목만 채우고, 기존 값(하드코딩/Core)은 유지.
    /// </summary>
    private static void LoadStrokeData()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        var paths = new[]
        {
            Path.Combine(execDir, "data", "hanja_strokes.json"),
            Path.Combine(currentDir, "data", "hanja_strokes.json"),
            Path.Combine(projectRoot, "data", "hanja_strokes.json"),
        };

        var filePath = paths.FirstOrDefault(File.Exists);
        if (filePath == null) return;

        try
        {
            var json = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var strokeMap = JsonSerializer.Deserialize<Dictionary<string, int>>(json);
            if (strokeMap == null) return;

            int updated = 0;
            foreach (var kvp in strokeMap)
            {
                if (dict.TryGetValue(kvp.Key, out var info) && info.StrokeCount == 0)
                {
                    info.StrokeCount = kvp.Value;
                    updated++;
                }
            }

            System.Diagnostics.Debug.WriteLine($"[StrokeData] {updated}개 항목 획수 보완 (hanja_strokes.json)");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[StrokeData] 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// Core Dataset 한자 중 Category="기타" 또는 빈 값인 것을
    /// Rationale + Meaning 키워드로 자동 재분류.
    /// NamePoolEngine의 natureHanja/virtueHanja/conceptHanja 풀에 제대로 들어가도록 함.
    /// </summary>
    private static void ReclassifyCoreDatasetCategories()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        // 카테고리 키워드 사전 (Rationale/Meaning 포함 여부로 판정)
        var virtueKeywords = new[]
        {
            "어질", "인자", "덕", "의로", "예의", "지혜", "슬기", "정성", "신의", "믿음",
            "도의", "효", "충", "선함", "착함", "바름", "정직", "겸손", "화목", "사랑",
            "은혜", "베풂", "아름다", "고귀", "고상", "품격", "절제", "정갈"
        };
        var natureKeywords = new[]
        {
            "봄", "여름", "가을", "겨울", "하늘", "바다", "강", "산", "들", "숲", "나무",
            "꽃", "풀", "잎", "열매", "씨앗", "뿌리", "새", "구름", "비", "눈", "이슬",
            "바람", "안개", "노을", "새벽", "해", "달", "별", "물", "불", "흙", "돌",
            "옥", "금", "은", "쇠", "빛", "광채"
        };
        var conceptKeywords = new[]
        {
            "뜻", "길", "영원", "항상", "시작", "끝", "처음", "무한", "빛남", "성취",
            "완성", "승리", "성공", "기쁨", "행복", "복", "귀함", "높", "크", "강함",
            "용기", "기운", "정신", "마음", "생각", "이상", "이치", "이념", "가르침",
            "배움", "길러", "흐름"
        };

        int reclassified = 0;
        foreach (var (_, h) in dict)
        {
            if (h.Source != "Core_v1") continue;
            if (h.Category != "기타" && !string.IsNullOrEmpty(h.Category)) continue;

            var haystack = (h.Rationale ?? string.Empty) + " " + (h.Meaning ?? string.Empty);
            if (string.IsNullOrWhiteSpace(haystack)) continue;

            string? newCategory = null;
            if (virtueKeywords.Any(kw => haystack.Contains(kw)))       newCategory = "덕목";
            else if (natureKeywords.Any(kw => haystack.Contains(kw)))  newCategory = "자연";
            else if (conceptKeywords.Any(kw => haystack.Contains(kw))) newCategory = "개념";

            if (newCategory != null)
            {
                h.Category = newCategory;
                reclassified++;
            }
        }

        System.Diagnostics.Debug.WriteLine($"[Core Dataset] {reclassified}자 카테고리 재분류 완료");
    }

    private class CoreDatasetEntry
    {
        [JsonPropertyName("hanja")]   public string? Hanja          { get; set; }
        [JsonPropertyName("hangul")]  public string? Hangul         { get; set; }
        [JsonPropertyName("five_element")] public string? FiveElement { get; set; }
        [JsonPropertyName("kangxi_strokes")] public int KangxiStrokes { get; set; }
        [JsonPropertyName("rationale")] public string? Rationale    { get; set; }
        [JsonPropertyName("confidence")] public string? Confidence  { get; set; }
    }

    /// <summary>
    /// Tier 3: hanja_radical_element_map.json 로드 — 의미 기반 오행 추정 (grade=C).
    /// Tier 1(Core Dataset)보다 먼저 적용되며, Core Dataset이 덮어씁니다.
    /// FiveElement가 이미 B등급 이상이면 덮어쓰지 않습니다.
    /// </summary>
    private static void LoadRadicalElementMap()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        var paths = new[]
        {
            Path.Combine(execDir, "data", "hanja_radical_element_map.json"),
            Path.Combine(currentDir, "data", "hanja_radical_element_map.json"),
            Path.Combine(projectRoot, "data", "hanja_radical_element_map.json"),
        };

        var filePath = paths.FirstOrDefault(File.Exists);
        if (filePath == null) return;

        try
        {
            var json = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var entries = JsonSerializer.Deserialize<Dictionary<string, RadicalMapEntry>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (entries == null) return;

            int applied = 0;
            foreach (var (hanja, entry) in entries)
            {
                if (string.IsNullOrWhiteSpace(hanja) || string.IsNullOrEmpty(entry.FiveElement))
                    continue;

                if (dict.TryGetValue(hanja, out var existing))
                {
                    // B등급 이상(Manual/Core)은 건드리지 않음
                    if (existing.ConfidenceGrade == "S" || existing.ConfidenceGrade == "A" ||
                        existing.ConfidenceGrade == "B")
                        continue;

                    // 이미 오행이 있고 Auto_Fallback이 아닌 경우도 스킵
                    if (!string.IsNullOrEmpty(existing.FiveElement) &&
                        existing.Source != "Auto_Fallback" && existing.Source != "Auto_Radical")
                        continue;

                    existing.FiveElement    = entry.FiveElement;
                    existing.Rationale      = entry.Rationale ?? string.Empty;
                    existing.ConfidenceGrade = "C";
                    existing.Source         = "Auto_Radical";
                    applied++;
                }
            }

            System.Diagnostics.Debug.WriteLine($"[Tier 3] {applied}자 의미 기반 오행 적용 완료");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Tier 3] 로드 실패: {ex.Message}");
        }
    }

    private class RadicalMapEntry
    {
        [JsonPropertyName("five_element")] public string? FiveElement { get; set; }
        [JsonPropertyName("rationale")]    public string? Rationale   { get; set; }
        [JsonPropertyName("confidence")]   public string? Confidence  { get; set; }
        [JsonPropertyName("source")]       public string? Source      { get; set; }
    }

    /// <summary>
    /// hanja_dictionary_final.json 파일의 데이터 구조
    /// </summary>
    private class FinalJsonEntry
    {
        public string? hanja { get; set; }
        public List<string>? readings_hangul { get; set; }
        public List<string>? initial_consonants { get; set; }
        public string? unicode_hex { get; set; }
        public List<string>? sources { get; set; }
        public string? meaning_ko { get; set; }
        public string? meaning_en { get; set; } // 영어 의미 (다양한 필드명 지원)
        public string? definition { get; set; } // definition 필드 (Unihan 등)
        public string? kDefinition { get; set; } // kDefinition 필드 (Unihan)
        public int? total_strokes { get; set; } // 획수 정보 (Unihan 등에서 추가 가능)
        public int? strokeCount { get; set; } // strokeCount 필드명도 지원
        public string? category { get; set; } // 카테고리 정보 (수동 매핑 등에서 추가 가능)
        public string? five_element { get; set; } // 오행 정보 (향후 추가 가능)
        public string? fiveElement { get; set; } // fiveElement 필드명도 지원
        public string? yin_yang { get; set; } // 음양 정보 (향후 추가 가능)
        public string? yinYang { get; set; } // yinYang 필드명도 지원
        public string? rs_unicode { get; set; } // 부수 정보
        public string? radical { get; set; } // radical 필드명도 지원
    }

    /// <summary>
    /// 한자의 유니코드 코드 포인트가 CJK 기본 영역(U+4E00~U+9FFF)에 속하는지 확인
    /// </summary>
    public static bool IsInCjkBasicRange(string character)
    {
        if (string.IsNullOrEmpty(character)) return false;
        int codePoint = char.ConvertToUtf32(character, 0);
        return codePoint >= 0x4E00 && codePoint <= 0x9FFF;
    }

    /// <summary>
    /// 한자의 유니코드 코드 포인트가 CJK 확장A 영역(U+3400~U+4DBF)에 속하는지 확인
    /// </summary>
    public static bool IsInCjkExtensionA(string character)
    {
        if (string.IsNullOrEmpty(character)) return false;
        int codePoint = char.ConvertToUtf32(character, 0);
        return codePoint >= 0x3400 && codePoint <= 0x4DBF;
    }

    /// <summary>
    /// 인명용 한자 관련성 점수 계산 (높을수록 좋음)
    /// 기준: 대법원 인명용 DB > CJK 기본 영역 > 의미 있음 > 카테고리 있음 > 획수 있음
    /// </summary>
    /// <summary>
    /// 불용한자 — 뜻이 명백히 부정적이라 이름에 쓰지 않는 한자
    /// (죽음·병·범죄·천함·불쾌한 짐승 등). 작명규칙의 '불용한자(부정적 의미)' 중
    /// 합리적인 부분만 채택한다.
    /// ⚠️ '불길한자'(明·仁·德·榮 등을 "단명·고난"으로 보는 류)는 사주·성명학 미신이며,
    /// 본 프로젝트의 '미학 우선·미신 배제' 철학에 정면으로 반하므로 의도적으로 제외하지 않는다.
    /// </summary>
    private static readonly HashSet<string> ForbiddenNameHanjaSet = new(StringComparer.Ordinal)
    {
        // 죽음·재앙·흉
        "死","亡","喪","屍","厄","禍","凶","殃","殞","歿",
        // 병·고통
        "病","疾","痛","苦","患","瘡","癌","盲","聾","啞",
        // 악·범죄·형벌
        "惡","邪","妖","魔","鬼","罪","犯","罰","刑","獄","賊","盜","寇","殺","暴","虐",
        // 부정·거짓
        "偽","假","詐","欺","騙","奸","姦","淫","亂","狂","痴","狡","妄","罔",
        // 천함·열등
        "愚","拙","劣","弱","衰","卑","賤","陋","奴","婢","乞","狹","侮","恥",
        // 가난·결핍·훼손
        "貧","困","乏","缺","損","傷","殘","廢","棄","逃",
        // 잘못·무기·오염·막힘·해악
        "誤","矛","菌","塞","害",
        // 더러움·추함
        "醜","汚","濁","腐","臭",
        // 어두움·음산·쇠락
        "暗","曀","鬱","老","零",
        // 제례(죽음 연상)
        "祭",
        // 부정적 감정
        "怨","恨","怒","哀","悲","憂","嫉","妬","貪","毒","仇","敵","哭","泣","嘆","恚","嗚","淚",
        // 불쾌한 짐승
        "犬","狗","豚","豬","鼠","蛇","蟲","蚊","蠅","蛆",

        // ───────────────────────────────────────────────────────────────
        // 2026-07-02 전수 스캔 일괄 추가 (731자):
        // hanja_dictionary_final.json 9,595자(뜻 보유 9,096자)의 훈을 부정어 사전으로
        // 전수 스캔 → 후보 1,220자 → 수동 검수로 확정. 판정 기준:
        //   ① 다중 훈은 첫 훈 기준 (부훈만 부정인 글자는 배제: 誕·創·郁·蔚·乾 등)
        //   ② 동음이의 훈 오탐 배제 (옥=玉, 종=鐘, 때=時, 빌=祈禱, 마를=裁斷,
        //      가릴=選擇, 갚을=報答, 죽=竹筍/粥, 창=窓, 이=齒/是, 미칠=及 등)
        //   ③ 통용 의미가 긍정인 글자 배제 (責=책임, 竣=준공, 濬=깊을, 隱·逸·畢 등 보류)
        //   ④ 불길한자 미신(明·仁·德 류)과 무관 — 명백히 부정적 뜻만
        // ───────────────────────────────────────────────────────────────
        // 죽음·주검·장례
        "冢","塚","墓","墳","塋","尸","妣","殂","剿","劉","屠","戕","戮","煞","泯","吊","弔","葬",
        "殮","輇","絰","髏","髑",
        // 재앙·흉·귀신
        "災","灾","祅","祟","禜","歉","玼","魂","魄","魈","魍","魎","魑","燐","粦","神","兇",
        // 병·고통
        "佝","痀","喑","恙","疣","疫","疲","疴","疹","疼","痂","痍","痎","痔","痢","痤","痿","瘁",
        "瘐","瘟","瘢","瘤","瘧","瘯","瘻","癇","癎","癉","癤","癬","癭","癱","聵","腫","膿","贅",
        "跛","蹇","疔","痞","瘍","癘","瘕","痙","痲","痹","痺","蠡","敝",
        // 악·범죄·형벌
        "㦶","倰","偸","劫","咎","囚","囹","圄","奪","悍","愆","拷","抬","捶","掠","撻","擄","毆",
        "韃","鞭","謫","辜","酷","痓","瑕","疵","獰","獷","狴","竊","褫","訧","誅","罸","篡","簒",
        "絞","縊","駻","鬨","鬩","鬪","剆",
        // 무기·폭력
        "乂","伐","刀","刈","刖","刲","刺","剚","割","劍","劒","戈","戟","戭","戵","戳","扑","打",
        "扺","挌","搥","搷","摽","撅","撞","撲","撾","擊","攊","攙","攻","討","涿","斧","斫","斬",
        "朾","棨","槊","槍","矡","矢","箚","箠","箭","芟","荑","衝","釿","鈇","鈒","鈔","鉍","鉗",
        "鉞","鋎","錟","鏃","鏌","鏑","鏦","鐏","鑕",
        // 거짓·간사·문란
        "䛲","伋","佞","佯","僞","姰","瘈","癲","媚","慝","憸","懗","泆","猾","獪","瞞","謾","詭",
        "誆","誑","誣","諆","諼","譎","詫","譃","諂","諛","蕩","詛",
        // 비방·소란
        "劾","叱","呵","咄","咤","哬","喝","罵","詆","詬","誚","謑","譙","譴","訶","姍","訕","訾",
        "誹","謗","謷","譖","讒","哄","嘩","噪","聒","譟","騷","鬧","嗷","擾","哱","怋","溷","紊",
        "紛","紜","綧","繽","訌","嘍","撓","眩","伺","佔","覗","覘","覷","矙","窺","遉","闚","闖",
        "攪",
        // 천함·열등
        "傖","僕","隷","隸","妓","妾","娼","嫠","嫚","敡","蔑","馮","庳","輖","汙","濊","鄙","辱",
        "低","体","窘",
        // 어리석음·게으름·교만
        "侄","倥","倲","傋","呆","嚚","憃","戇","獃","癡","騃","蚩","禺","鈍","倨","傲","慢","憍",
        "敖","驕","嫯","慠","倦","劵","勌","嬾","怠","惰","慵","懈","懶","侈","奢","忕",
        // 부끄러움
        "媿","愧","怍","怩","愐","慙","慚","羞","咍","嗤","嘲","譏","詼",
        // 훼손·붕괴·추락
        "㨹","倒","僵","圮","坍","壞","崩","潰","隤","頹","隳","墜","墮","落","隕","霣","斃","獘",
        "蹶","躓","蹉","截","絕","絶","斷","撝","磔","裂","玷","窳","虧","騫","捌","破","沰","忮",
        // 상실·실패·도피
        "債","失","抎","弃","拌","捐","捨","擻","敗","竄","詿","譌","逋","遁","遯","𨓜","退","𢓭",
        "違","錯","齟","齬","儳","窶","危","圾","懍","殆","叛","乖","舛","戾","彷","徨","徬","佂",
        "汒",
        // 오물·배설
        "吐","哇","喀","嘔","歐","尿","屎","糞","胱","膀","朽","渣","滓","坸","垢","垽","淀","澱",
        // 먼지·진창·구덩이
        "坋","坌","坱","埃","塵","坎","坑","埂","埳","塹","穽","堇","淖","淤","泥",
        // 막힘·흐림
        "沌","沍","滯","窒","阨","錮","曇","朦","淈","眊","眚","瞖","瞙",
        // 어두움·황혼
        "冥","昏","昧","眛","晻","懞","曚","蒙","闇","雺","瞢","𩔉","曛","曨","暝","暮",
        // 쇠락·시듦·야윔
        "凄","淒","凋","萎","嫶","悴","憔","顇","顦","瘠","瘦","癯","膄","羸","皺","縐","枯","槀",
        "槁","穢","荒","蕪","笨","粗","麤",
        // 늙음
        "叟","耄","翁","耆","耇","耈","耉",
        // 외로움·공허
        "孑","孤","仃","煢","踽","虛","廖","懬","漮","窾","罄","悶","腷",
        // 소멸·종말
        "卒","罷","滅","殄","殫","竭","盡","尽","窮","匱","鐀","儘","儩","㪤","湫","戩","消","慘",
        // 저주·구걸
        "呪","䛆","匃",
        // 두려움·놀람
        "伈","傽","兢","嘵","怕","怖","怯","恇","恐","恟","悚","惕","惴","惶","慄","慴","懼","懾",
        "畏","瞿","噩","愕","驚","駭","抖","顫",
        // 근심·연민
        "忉","忡","怲","悄","悇","悒","愀","愁","愍","慬","慱","慼","慽","懆","焭","閔","惸","憐",
        "憫","恤",
        // 분노·증오·탐욕
        "嗔","噁","奰","忿","悁","悻","慍","愾","讉","洸","厭","嫌","憎","斁","叨","忨","恈","婪",
        "惏","慾","飻","饕","饞","吝","悋","慳","嗇","慪","苛","躁",
        // 슬픔·한탄·울음
        "怊","怛","悢","悵","悼","悽","惋","愴","惻","懊","懟","吁","嗟","歎","誒","齎","涕","潸",
        "澘","歔","哽","噎","嗢","怏","怞","呦","呱","咯","啼","嘶","嘹","渧","喤","唳","悔","懺",
        "憾","欿","觖","猜",
        // 굶주림
        "飢","餒","餓","饉","饑","渴",
        // 불쾌한 짐승 (확장)
        "亥","巳","戌","彘","猪","豕","豨","狐","狸","貍","狉","狼","狽","豺","獒","梟","鴟","鵄",
        "鶹","烏",
        // 벌레·해충
        "虫","豸","喓","虱","蝨","蚤","蚋","蚓","蚯","蚣","蜈","蛭","蛛","蜘","鼄","蛾","蜚","蝎",
        "蠍","蝙","蝠","蝮","虺","蟇","鼀","蟾","蛞","蚪","蝌","鼢","鼴","鼹",
        // 2차: 재생성 조합 검수에서 확정 (責=채 독음 오선택·魯 노둔·膃 살질·膝 무릎) + LIVE 보류분 (隱·逸·畢)
        "責","魯","膃","膝","隱","逸","畢",
        // 3차(2026-07-02 대표 훈 검수): 정확한 대표 훈이 부정(외로움 계열)으로 확인된 글자
        "鰥", // 홀아비 환
        // 4차(2026-07-02 weak 재생성 검수): 약한 글자가 밀리며 승격된 명백 부정자
        "孼", // 서자/재앙 얼 (糵 누룩이 weak로 밀리자 대체 선택됨)
    };

    /// <summary>
    /// 이름 뜻으로 약한 한자(감점) — 부정은 아니지만 평범한 사물·허사 훈이라
    /// 더 나은 동음 대안이 있으면 양보해야 하는 글자. 불용(하드 배제)과 달리 감점이므로
    /// 대안이 없는 발음에서는 여전히 선택된다(combos 소실 없음).
    /// 2026-07-02 전수 스캔(사전 9,096자 훈 × 약한 훈 사전) → 검수 확정 345자 + 기존 14자.
    /// 경계 24자(禾 벼=결실, 錐 낭중지추, 鯉 등용문, 襟 흉금 등 긍정 연상)는 의도적 미포함 —
    /// 재스캔 시 다시 제안하지 말 것. 대표 훈 오버라이드로 첫 훈이 바뀐 則·頷·鬲도 제외.
    /// </summary>
    private static readonly HashSet<string> WeakGivenNameHanjaSet = new(StringComparer.Ordinal)
    {
        // ── 빈출이지만 뜻이 약함(기존) ──
        "友","雨","二","米","株","注","牛","主","西","虎","兒","朱","序","紙",
        // ── 허사(뜻 없음) (32자) ──
        "那","乃","但","凡","奈","焉","乎","于","何","兮","其","即","卽","厥","只","哩",
        "啊","奚","尔","彼","於","曷","歟","爰","爾","矣","秖","秪","粤","耶","豈","迺",
        // ── 도구·기물 (91자) ──
        "枷","䡣","䤥","凳","剴","勒","匙","厎","垌","壜","夆","婁","床","扃","扊","拉",
        "拕","拖","拽","挏","掎","掔","揄","曳","杅","杵","枕","梯","梳","棚","楑","楗",
        "榻","槃","槌","櫛","牀","瓮","甌","甑","甕","畚","盂","盆","盎","硧","碓","碗",
        "碬","竿","筌","筐","箸","篊","簞","紲","縻","缸","缾","罃","罋","罎","罐","羇",
        "羈","耞","耡","臼","輓","輪","轡","針","釤","鉋","鉏","鉽","銛","銶","鋑","鋤",
        "鋸","錤","鍑","鎌","鎡","鏟","鏵","鑰","鑵","钁","韁",
        // ── 건물·시설(허드레) (45자) ──
        "倉","瓦","厠","囷","圂","圊","垣","埒","堦","堳","堵","塼","墉","墻","庖","庫",
        "廁","廏","廐","廚","廧","廩","柵","桷","梱","椽","榰","榱","樊","牆","甃","甎",
        "甓","砌","磉","磚","磶","窩","窹","竈","籬","藩","閫","閾","階",
        // ── 신체(범속) (50자) ──
        "脅","腸","㳄","䎻","乳","咽","唾","喉","噲","奶","嬭","毛","毫","汗","涎","湩",
        "爪","耳","股","肺","胠","脇","脖","脛","腋","腎","腿","膚","臀","臍","臚","褶",
        "襞","跟","踝","踵","鍼","鑱","頰","顁","顋","額","顎","顙","髀","髮","鬍","鬚",
        "鼻","臑",
        // ── 곡물·음식 (41자) ──
        "糵","䴛","秸","稞","稻","穅","粢","粥","粱","糊","糕","糖","糜","糠","糱","羹",
        "荳","菽","蓽","蕎","藁","蠟","醯","食","飦","飯","飴","餃","餐","餠","餦","餳",
        "餹","鹵","鹷","鹺","鹽","麥","麯","麴","黍",
        // ── 나물·풀 (33자) ──
        "菜","菻","叢","帶","緄","艾","芣","芰","芹","苓","苔","苡","茅","茟","莧","莪",
        "菅","菱","萹","葦","葭","蒲","蒹","蒿","蔆","薺","藜","藺","蘆","蘚","蘿","韭",
        "韱",
        // ── 동물(범속) (34자) ──
        "蟀","猫","蚱","蛙","蛩","蛬","蛹","蝗","蝦","蝸","螺","螽","蟋","蟹","貓","酉",
        "雞","騾","驘","鮎","鮒","鮧","鯷","鰌","鰍","鰕","鰹","鱣","鱧","鳧","鴨","鵝",
        "鵞","鷄",
        // ── 의복(허드레) (13자) ──
        "屐","帉","衽","衿","袂","袪","袴","袵","裙","裳","褌","襠","襪",
        // ── 음절 점유 아티팩트 감사 (2026-07-02 전수 점검, 727자 노출 글자 triage) ──
        // 어색한 훈(사물·상업·신체·친족·허사·동사·부정 연상)이 combos 상위를 점유하던 글자.
        // 라이브 사례: 평화=評和, 소망=素忘, 축복=逐福, 행복=行馥, 혁 음절=革(가죽) 181쌍.
        "革","嬪","帥","財","寒","命","採","弟","種","兄","言","昔","庸","歲","臨","銅",
        "龜","颿","解","願","別","說","丸","眼","譜","候","娘","先","緩","煙","談","該",
        "細","兼","誦","線","女","聞","後","送","備","引","比","擇","涉","崖","近","兵",
        "管","批","男","勞","愢","屑","灪","祈","頑","椒","竝","飮","報","卷","勸","貌",
        "午","鑛","代","覽","辛","舌","恣","散","論","募","父","濫","提","印","橋","席",
        "式","招","咬","夫","秘","券","動","秒","交","産","區","構","値","列","運","評",
        "慣","堤","謀","余","短","陰","臺","算","補","無","召","仗","資","玩","熊","頭",
        "飾","少","摩","飄","馬","架","宅","對","畝","禁","事","姑","借","差","次","弄",
        "壇","置","今","削","麻","員","拳","陷","胎","千","經","第","瞥","睞","哨","票",
        "壁","爹","祢","禰","杌","咸","行","製","體","替","某","忘","忙","歆","逐","檢",
        "彆","索","鷸","遹","騋","艦","襒","樣","漂","淺","旅","價","北","晦","囁","夜",
        "九","銃","總","丑","不","魚","漁","車",
        // ── 감사 2차: 1차 감점으로 승격된 새 두더지 (부정·신체·범속) ──
        "口","齒","肥","膩","焦","炒","煮","否","非","故","貸","費","逮","遮","除","踐",
        "切","魅","鱉","鼈","鷩","鐍","䵥","尼","拜","遷","諸","具","副","付","符","般",
        "表","字","句","語",
        // ── 감사 3차: -3000 상향 후 승격된 두더지 (친족·동물·장마·기물) ──
        "冒","姥","媼","媽","娭","囮","壘","壟","螻","耬","劘","霪","鮭","殖","鐓","拑","苹","讞","偃","函","浮","型",
        // ── 감사 4차: 최종 잔여 두더지 ──
        "僂","媢","累","螞","負","檻","唉","漊","吪","蓱",
        // ── weak 재생성 검수 보충 (밀린 약자의 대체로 승격된 약자들, 2회 반복 수렴) ──
        "蘖","窣","臥","賽","未","鰓","臬",
        // 商(장사 상)·貨(재물 화)·暈(무리 훈): 상업·사물·어지럼 훈인데 점수 아티팩트로
        // 각 음절을 점유하던 글자 — 尙常相祥 / 和花華 / 勳薰訓 등 대안 풍부 (2026-07-02 후속 검토)
        "商","貨","暈",
        // ── 단위·잡물 (6자) ──
        "枡","棅","段","片","袋","馱",
    };

    /// <summary>이름에 쓰지 않는 불용한자(부정적 의미)인지 판정.
    /// CJK 호환 코드포인트(U+F900·U+2F800 영역의 落神禍 등)는 NFKC 정규형으로 조회 —
    /// 세트에 정규형만 있으면 모든 호환 변형이 자동 차단된다.
    /// (호환자를 리터럴로 세트에 넣는 방식은 편집기 NFC 정규화로 조용히 깨진 전력이 있음.)</summary>
    public static bool IsForbiddenNameHanja(string character)
    {
        if (ForbiddenNameHanjaSet.Contains(character)) return true;
        if (character.IsNormalized(System.Text.NormalizationForm.FormKC)) return false;
        return ForbiddenNameHanjaSet.Contains(character.Normalize(System.Text.NormalizationForm.FormKC));
    }

    /// <summary>실제 인명에 자주 쓰이는 대표 한자(인명 빈출 셋)인지 판정. 뜻 풀이 시 비(非)이름 한자 배제용.</summary>
    public static bool IsCommonNameHanja(string character) => CommonNameHanja.Contains(character);

    /// <summary>이름 뜻으로 약한 한자(감점 대상)인지 판정 — 동음의 더 나은 대안이 있으면 양보.</summary>
    public static bool IsWeakGivenNameHanja(string character) => WeakGivenNameHanjaSet.Contains(character);

    public static int CalculateRelevanceScore(HanjaInfo hanja)
    {
        int score = 0;

        // Core Dataset v1 — 五常 원칙/자원오행 전문 검수 완료자 (최우선)
        if (hanja.Source == "Core_v1")
            score += 2000;

        // S등급 (검수 완료) 추가 가점 — Core_v1 내 품질 정렬용
        if (hanja.ConfidenceGrade == "S")
            score += 100;

        // CJK 영역 기준 (가장 중요)
        if (IsInCjkBasicRange(hanja.Character))
            score += 1000;
        else if (IsInCjkExtensionA(hanja.Character))
            score += 100;
        // 그 외 확장 영역 (B, C, D 등)은 0점

        // 대법원 인명용 한자 목록 포함
        if (hanja.IsGovernmentListed)
            score += 500;

        // 인명 빈도 가점: 실제 이름에 자주 쓰이는 한자
        if (CommonNameHanja.Contains(hanja.Character))
            score += 300;

        // 한글 의미가 있는지 (영어만 있는 것보다 한글 의미가 더 유용)
        if (!string.IsNullOrEmpty(hanja.Meaning))
            score += 50;

        // 카테고리가 "기타"가 아닌 의미 있는 카테고리
        if (!string.IsNullOrEmpty(hanja.Category) && hanja.Category != "기타")
            score += 30;

        // 오행 정보 보유
        if (!string.IsNullOrEmpty(hanja.FiveElement))
            score += 20;

        // 획수 정보 보유
        if (hanja.StrokeCount > 0)
            score += 10;

        // 성별/톤 선호도가 설정됨 (Neutral이 아닌 경우)
        if (hanja.GenderPref != GenderPreference.Neutral)
            score += 5;
        if (hanja.TonePref != TonePreference.Neutral)
            score += 5;

        return score;
    }

    /// <summary>
    /// 한자 목록을 인명용 관련성 기준으로 정렬 (내림차순)
    /// </summary>
    public static List<HanjaInfo> SortByRelevance(List<HanjaInfo> hanjaList)
    {
        return hanjaList
            .OrderByDescending(h => CalculateRelevanceScore(h))
            .ToList();
    }

    /// <summary>
    /// 한글 발음으로 한자 찾기 (인명용 관련성 기준 정렬)
    /// </summary>
    public static List<HanjaInfo> FindByReading(string reading)
    {
        var results = HanjaDictionary.Values
            .Where(h => h.Reading == reading || h.AlternateReadings.Contains(reading))
            .ToList();
        return SortByRelevance(results);
    }

    /// <summary>
    /// 한자로 정보 찾기
    /// </summary>
    public static HanjaInfo? FindByCharacter(string character)
    {
        return HanjaDictionary.TryGetValue(character, out var info) ? info : null;
    }

    /// <summary>
    /// 모든 한자 목록 가져오기
    /// </summary>
    public static List<HanjaInfo> GetAllHanja()
    {
        return HanjaDictionary.Values.ToList();
    }

    /// <summary>
    /// 데이터 다시 로드 (JSON 파일이 업데이트된 경우)
    /// </summary>
    public static void Reload()
    {
        lock (_lockObject)
        {
            _fullyLoaded = false; // 사전보다 먼저 내려 독자가 빈 상태를 완료로 오인하지 않게 한다
            _loadedDictionary = null;
        }
    }

    /// <summary>
    /// 의미 데이터를 추가하고 자동 카테고리 분류 수행
    /// 향후 hanjadict, Unihan 등에서 의미 데이터를 수집한 후 이 메서드로 업데이트
    /// </summary>
    public static void UpdateMeaningAndClassify(string character, string meaning)
    {
        if (!HanjaDictionary.TryGetValue(character, out var hanja))
            return;

        lock (_lockObject)
        {
            hanja.Meaning = meaning;
            
            // 카테고리가 없거나 "기타"인 경우 자동 분류 시도
            if (string.IsNullOrEmpty(hanja.Category) || hanja.Category == "기타")
            {
                hanja.Category = ClassifyCategoryByMeaning(meaning);
            }
        }
    }

    /// <summary>
    /// 여러 한자에 의미 데이터를 일괄 업데이트
    /// 향후 hanjadict, Unihan 데이터 통합 시 사용
    /// </summary>
    public static void BatchUpdateMeanings(Dictionary<string, string> meaningMap)
    {
        lock (_lockObject)
        {
            foreach (var kvp in meaningMap)
            {
                UpdateMeaningAndClassify(kvp.Key, kvp.Value);
            }
        }
    }

    /// <summary>
    /// Unihan 데이터로부터 획수, 오행, 음양 정보 업데이트
    /// 향후 Unihan 데이터 통합 시 사용
    /// </summary>
    public static void UpdateFromUnihan(string character, int strokeCount, string fiveElement, string yinYang)
    {
        if (!HanjaDictionary.TryGetValue(character, out var hanja))
            return;

        lock (_lockObject)
        {
            bool strokeCountUpdated = false;
            if (strokeCount > 0 && hanja.StrokeCount == 0)
            {
                hanja.StrokeCount = strokeCount;
                strokeCountUpdated = true;
            }
            if (!string.IsNullOrEmpty(fiveElement) && string.IsNullOrEmpty(hanja.FiveElement))
            {
                hanja.FiveElement = fiveElement;
            }
            if (!string.IsNullOrEmpty(yinYang) && string.IsNullOrEmpty(hanja.YinYang))
            {
                hanja.YinYang = yinYang;
            }
            
            // 획수가 업데이트되었거나, 오행/음양이 없는 경우 자동 계산
            if (strokeCountUpdated || string.IsNullOrEmpty(hanja.FiveElement) || string.IsNullOrEmpty(hanja.YinYang))
            {
                AutoCalculateFiveElementAndYinYang(hanja);
            }
        }
    }

    /// <summary>
    /// JSON 파일에서 의미 데이터 로드 및 자동 분류
    /// hanjadict 스크립트로 생성한 hanja_meanings.json 파일 사용
    /// </summary>
    public static void LoadMeaningsFromJson(string jsonFilePath)
    {
        if (!File.Exists(jsonFilePath))
            return;

        try
        {
            var jsonContent = File.ReadAllText(jsonFilePath, System.Text.Encoding.UTF8);
            var meaningMap = JsonSerializer.Deserialize<Dictionary<string, string>>(jsonContent);
            
            if (meaningMap != null)
            {
                BatchUpdateMeanings(meaningMap);
            }
        }
        catch (Exception ex)
        {
            // 로그 출력 (실제 운영 시에는 로거 사용)
            System.Diagnostics.Debug.WriteLine($"의미 데이터 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// JSON 파일에서 Unihan 데이터 로드
    /// Unihan 스크립트로 생성한 hanja_unihan.json 파일 사용
    /// </summary>
    public static void LoadUnihanFromJson(string jsonFilePath)
    {
        if (!File.Exists(jsonFilePath))
            return;

        try
        {
            var jsonContent = File.ReadAllText(jsonFilePath, System.Text.Encoding.UTF8);
            var unihanData = JsonSerializer.Deserialize<Dictionary<string, UnihanData>>(jsonContent);
            
            if (unihanData != null)
            {
                foreach (var kvp in unihanData)
                {
                    var data = kvp.Value;
                    var hanja = kvp.Key;
                    
                    // 한자가 사전에 없으면 기본 정보로 추가
                    if (!HanjaDictionary.ContainsKey(hanja))
                    {
                        lock (_lockObject)
                        {
                            var newHanjaInfo = new HanjaInfo
                            {
                                Character = hanja,
                                Reading = string.Empty,
                                Unicode = string.Empty,
                                Category = "기타"
                            };
                            
                            // 총획수가 있으면 자동으로 오행과 음양 계산
                            if (data.strokeCount.HasValue && data.strokeCount.Value > 0)
                            {
                                newHanjaInfo.StrokeCount = data.strokeCount.Value;
                                AutoCalculateFiveElementAndYinYang(newHanjaInfo);
                            }

                            // GenderPref/TonePref 설정
                            if (!string.IsNullOrEmpty(data.genderPref))
                            {
                                newHanjaInfo.GenderPref = data.genderPref switch
                                {
                                    "Male" => GenderPreference.Male,
                                    "Female" => GenderPreference.Female,
                                    _ => GenderPreference.Neutral
                                };
                            }
                            if (!string.IsNullOrEmpty(data.tonePref))
                            {
                                newHanjaInfo.TonePref = data.tonePref switch
                                {
                                    "Strong" => TonePreference.Strong,
                                    "Soft" => TonePreference.Soft,
                                    _ => TonePreference.Neutral
                                };
                            }

                            _loadedDictionary![hanja] = newHanjaInfo;
                        }
                    }
                    
                    if (HanjaDictionary.TryGetValue(hanja, out var hanjaInfo))
                    {
                        lock (_lockObject)
                        {
                            bool strokeCountUpdated = false;
                            
                            // Unihan 데이터 업데이트 (획수, 오행, 음양)
                            if (data.strokeCount.HasValue && data.strokeCount.Value > 0)
                            {
                                // 기존 값이 없거나 0인 경우에만 업데이트
                                // 또는 기존 값이 있지만 Unihan 데이터가 더 정확할 수 있으므로 업데이트
                                if (hanjaInfo.StrokeCount == 0 || hanjaInfo.StrokeCount != data.strokeCount.Value)
                                {
                                    hanjaInfo.StrokeCount = data.strokeCount.Value;
                                    strokeCountUpdated = true;
                                }
                                
                                // 오행 정보 업데이트 (JSON에 있는 경우 우선, 없으면 자동 계산)
                                if (string.IsNullOrEmpty(hanjaInfo.FiveElement))
                                {
                                    if (!string.IsNullOrEmpty(data.fiveElement))
                                    {
                                        hanjaInfo.FiveElement = data.fiveElement;
                                    }
                                }
                                
                                // 음양 정보 업데이트 (JSON에 있는 경우 우선, 없으면 자동 계산)
                                if (string.IsNullOrEmpty(hanjaInfo.YinYang))
                                {
                                    if (!string.IsNullOrEmpty(data.yinYang))
                                    {
                                        hanjaInfo.YinYang = data.yinYang;
                                    }
                                }
                            }
                            
                            // 획수가 업데이트되었거나, 오행/음양이 없는 경우 자동 계산
                            // total_strokes로 오행과 음양을 계산하고 저장
                            if (strokeCountUpdated || string.IsNullOrEmpty(hanjaInfo.FiveElement) || string.IsNullOrEmpty(hanjaInfo.YinYang))
                            {
                                AutoCalculateFiveElementAndYinYang(hanjaInfo);
                            }
                            
                            // GenderPref/TonePref 업데이트 (기본값인 Neutral일 때만)
                            if (hanjaInfo.GenderPref == GenderPreference.Neutral && !string.IsNullOrEmpty(data.genderPref))
                            {
                                hanjaInfo.GenderPref = data.genderPref switch
                                {
                                    "Male" => GenderPreference.Male,
                                    "Female" => GenderPreference.Female,
                                    _ => GenderPreference.Neutral
                                };
                            }
                            if (hanjaInfo.TonePref == TonePreference.Neutral && !string.IsNullOrEmpty(data.tonePref))
                            {
                                hanjaInfo.TonePref = data.tonePref switch
                                {
                                    "Strong" => TonePreference.Strong,
                                    "Soft" => TonePreference.Soft,
                                    _ => TonePreference.Neutral
                                };
                            }

                            // Unihan definition을 의미 데이터로 활용 (hanjadict에 없는 경우)
                            if (!string.IsNullOrEmpty(data.definition) && string.IsNullOrEmpty(hanjaInfo.Meaning))
                            {
                                // 영어 정의를 한글 의미로 사용 (간단한 처리)
                                hanjaInfo.Meaning = data.definition;
                                // 의미 기반 자동 카테고리 분류
                                var category = ClassifyCategoryByMeaning(data.definition);
                                if (!string.IsNullOrEmpty(category) && category != "기타" && 
                                    (string.IsNullOrEmpty(hanjaInfo.Category) || hanjaInfo.Category == "기타"))
                                {
                                    hanjaInfo.Category = category;
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Unihan 데이터 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// Unihan JSON 데이터 구조
    /// </summary>
    private class UnihanData
    {
        public int? strokeCount { get; set; }
        public string? fiveElement { get; set; }
        public string? yinYang { get; set; }
        public string? definition { get; set; }
        public string? radical { get; set; }
        public string? genderPref { get; set; }
        public string? tonePref { get; set; }
    }

    /// <summary>
    /// 대표 훈 오버라이드(data/hanja-gloss-overrides.json) 적용.
    /// 다중 훈 사전의 첫 훈이 통용 대표 훈이 아닌 글자(然 "불탈 연/그럴 연" 등)의
    /// Meaning을 재배열해 대표 훈이 맨 앞에 오도록 한다 — 기존 훈은 전부 보존.
    /// 소비처(CleanGloss/BuildCardMeaning/firstGloss 등)는 첫 훈만 취하므로 코드 수정 없이 전파.
    /// LoadMeaningsFromJson이 Meaning을 무조건 덮어쓰므로 반드시 모든 기록자 이후에 호출.
    /// </summary>
    private static void ApplyGlossOverrides()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        foreach (var basePath in new[] { execDir, currentDir, projectRoot })
        {
            foreach (var path in new[]
                     {
                         Path.Combine(basePath, "data", "hanja-gloss-overrides.json"),
                         Path.Combine(basePath, "hanja-gloss-overrides.json")
                     })
            {
                if (!File.Exists(path)) continue;
                try
                {
                    var overrides = JsonSerializer.Deserialize<Dictionary<string, string>>(
                        File.ReadAllText(path));
                    if (overrides == null) return;
                    foreach (var (ch, preferred) in overrides)
                    {
                        if (dict.TryGetValue(ch, out var h))
                            h.Meaning = ReorderGloss(h.Meaning, preferred);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"대표 훈 오버라이드 로드 실패: {ex.Message}");
                }
                return;
            }
        }
    }

    /// <summary>
    /// 다중 훈 문자열에서 preferred 훈이 맨 앞에 오도록 재배열 — 기존 훈 무손실, 멱등.
    /// 구분자 집합은 첫 훈 소비처(Split ',','/',';','·')와 동일해야 한다(계약).
    /// </summary>
    public static string ReorderGloss(string meaning, string preferred)
    {
        preferred = preferred?.Trim() ?? "";
        if (preferred.Length == 0) return meaning;
        if (string.IsNullOrWhiteSpace(meaning)) return preferred;

        var tokens = meaning.Split(',', '/', ';', '·')
            .Select(t => t.Trim())
            .Where(t => t.Length > 0)
            .ToList();
        if (tokens.Count > 0 && tokens[0] == preferred) return meaning;

        tokens.Remove(preferred); // 목록에 있으면 이동, 없으면 신규 삽입
        tokens.Insert(0, preferred);
        return string.Join(", ", tokens);
    }

    /// <summary>
    /// 외부 데이터 소스에서 한자 정보 자동 로드
    /// Program.cs 시작 시 호출
    /// </summary>
    public static void LoadExternalData()
    {
        // HanjaDictionary getter handles both JSON loading and external data loading
        // in a thread-safe manner. This method is kept for backward compatibility.
        _ = HanjaDictionary;
    }

    private static void LoadExternalDataCore()
    {
        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        var searchPaths = new[]
        {
            execDir,
            currentDir,
            projectRoot
        };

        // 의미 데이터 로드 (data 폴더 우선)
        foreach (var basePath in searchPaths)
        {
            var meaningsPath = Path.Combine(basePath, "data", "hanja_meanings.json");
            if (File.Exists(meaningsPath))
            {
                LoadMeaningsFromJson(meaningsPath);
                break;
            }
            meaningsPath = Path.Combine(basePath, "hanja_meanings.json");
            if (File.Exists(meaningsPath))
            {
                LoadMeaningsFromJson(meaningsPath);
                break;
            }
        }

        // Unihan 데이터 로드 (data 폴더 우선, 획수 정보로 오행/음양 자동 계산)
        foreach (var basePath in searchPaths)
        {
            var unihanPath = Path.Combine(basePath, "data", "hanja_unihan.json");
            if (File.Exists(unihanPath))
            {
                LoadUnihanFromJson(unihanPath);
                break;
            }
            unihanPath = Path.Combine(basePath, "hanja_unihan.json");
            if (File.Exists(unihanPath))
            {
                LoadUnihanFromJson(unihanPath);
                break;
            }
        }

        // 수동 카테고리 매핑 파일 로드 (선택사항)
        // 확장 형식 파일을 우선적으로 로드 (data 폴더 우선)
        foreach (var basePath in searchPaths)
        {
            var extendedMappingPath = Path.Combine(basePath, "data", "hanja_category_mapping_extended.json");
            if (File.Exists(extendedMappingPath))
            {
                LoadCategoryMapping(extendedMappingPath);
                break;
            }
            extendedMappingPath = Path.Combine(basePath, "hanja_category_mapping_extended.json");
            if (File.Exists(extendedMappingPath))
            {
                LoadCategoryMapping(extendedMappingPath);
                break;
            }
        }
        
        // 확장 형식이 없으면 기존 형식 로드 (data 폴더 우선)
        foreach (var basePath in searchPaths)
        {
            var categoryMappingPath = Path.Combine(basePath, "data", "hanja_category_mapping.json");
            if (File.Exists(categoryMappingPath))
            {
                LoadCategoryMapping(categoryMappingPath);
                break;
            }
            categoryMappingPath = Path.Combine(basePath, "hanja_category_mapping.json");
            if (File.Exists(categoryMappingPath))
            {
                LoadCategoryMapping(categoryMappingPath);
                break;
            }
        }

        // 대법원 인명용 한자 CSV 로드 (data-gov.csv) — IsGovernmentListed 플래그 설정
        foreach (var basePath in searchPaths)
        {
            var govCsvPath = Path.Combine(basePath, "data", "data-gov.csv");
            if (File.Exists(govCsvPath))
            {
                LoadGovernmentHanjaList(govCsvPath);
                break;
            }
        }

        // 의미 기반 GenderPref/TonePref 자동 분류 (Neutral인 한자만 대상)
        if (_loadedDictionary != null)
        {
            GenderToneClassifier.AutoClassifyAll(_loadedDictionary);
        }
    }

    /// <summary>
    /// 대법원 인명용 한자 CSV 파일에서 한자 목록을 로드하여 IsGovernmentListed 플래그를 설정
    /// </summary>
    private static void LoadGovernmentHanjaList(string csvFilePath)
    {
        if (_loadedDictionary == null || !File.Exists(csvFilePath))
            return;

        try
        {
            var csvData = HanjaCsvLoader.LoadFromCsv(csvFilePath);
            foreach (var kvp in csvData)
            {
                var hanjaChar = kvp.Key;
                if (_loadedDictionary.TryGetValue(hanjaChar, out var hanjaInfo))
                {
                    hanjaInfo.IsGovernmentListed = true;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"대법원 인명용 한자 CSV 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// 수동 카테고리 매핑 파일 로드
    /// 기존 형식 (하위 호환):
    /// {
    ///   "category_mapping": {
    ///     "가": "개념",
    ///     "나": "자연",
    ///     "다": "덕목"
    ///   }
    /// }
    /// 
    /// 확장 형식 (새 스키마):
    /// {
    ///   "schema_version": "2.0",
    ///   "category_mapping": {
    ///     "漢": {
    ///       "major": "NATURE",
    ///       "minor": "WATER",
    ///       "tags": ["river", "flow"],
    ///       "evidence": ["훈:물", "부수:水"],
    ///       "confidence": 0.8
    ///     }
    ///   }
    /// }
    /// </summary>
    public static void LoadCategoryMapping(string jsonFilePath)
    {
        if (!File.Exists(jsonFilePath))
            return;

        try
        {
            var jsonContent = File.ReadAllText(jsonFilePath, System.Text.Encoding.UTF8);
            var mappingData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(jsonContent);
            
            if (mappingData == null)
                return;
            
            // schema_version 확인 (확장 형식인지 판단)
            bool isExtendedFormat = mappingData.TryGetValue("schema_version", out var schemaVersion);
            
            if (mappingData.TryGetValue("category_mapping", out var mappingObj))
            {
                lock (_lockObject)
                {
                    if (isExtendedFormat)
                    {
                        // 확장 형식 처리
                        var extendedMapping = JsonSerializer.Deserialize<Dictionary<string, ExtendedCategoryEntry>>(
                            mappingObj.GetRawText());
                        
                        if (extendedMapping != null)
                        {
                            foreach (var kvp in extendedMapping)
                            {
                                if (HanjaDictionary.TryGetValue(kvp.Key, out var hanja))
                                {
                                    var entry = kvp.Value;
                                    hanja.CategoryMajor = entry.major ?? string.Empty;
                                    hanja.CategoryMinor = entry.minor ?? string.Empty;
                                    hanja.CategoryTags = entry.tags ?? new List<string>();
                                    hanja.CategoryEvidence = entry.evidence ?? new List<string>();
                                    hanja.CategoryConfidence = entry.confidence ?? 0.0;
                                    
                                    // 하위 호환성을 위해 Category 필드도 설정
                                    hanja.Category = MapMajorToLegacyCategory(entry.major ?? string.Empty);
                                }
                            }
                        }
                    }
                    else
                    {
                        // 기존 형식 처리 (하위 호환)
                        var mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(
                            mappingObj.GetRawText());
                        
                        if (mapping != null)
                        {
                            foreach (var kvp in mapping)
                            {
                                if (HanjaDictionary.TryGetValue(kvp.Key, out var hanja))
                                {
                                    hanja.Category = kvp.Value;
                                    // 기존 카테고리를 새 스키마로 변환
                                    var (major, minor) = MapLegacyCategoryToMajorMinor(kvp.Value);
                                    hanja.CategoryMajor = major;
                                    hanja.CategoryMinor = minor;
                                    hanja.CategoryConfidence = 1.0; // 수동 지정은 높은 신뢰도
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"카테고리 매핑 로드 실패: {ex.Message}");
        }
    }
    
    /// <summary>
    /// 기존 카테고리(자연/덕목/개념)를 새 스키마의 major로 변환
    /// </summary>
    private static (string major, string minor) MapLegacyCategoryToMajorMinor(string legacyCategory)
    {
        return legacyCategory switch
        {
            "자연" => ("NATURE", "OTHER"),
            "덕목" => ("VIRTUE", "OTHER"),
            "개념" => ("CONCEPT", "OTHER"),
            _ => (string.Empty, string.Empty)
        };
    }
    
    /// <summary>
    /// 새 스키마의 major를 기존 카테고리로 변환 (하위 호환성)
    /// </summary>
    private static string MapMajorToLegacyCategory(string major)
    {
        return major switch
        {
            "NATURE" => "자연",
            "VIRTUE" => "덕목",
            "CONCEPT" => "개념",
            _ => "기타"
        };
    }
    
    /// <summary>
    /// 확장된 카테고리 매핑 엔트리
    /// </summary>
    private class ExtendedCategoryEntry
    {
        public string? major { get; set; }
        public string? minor { get; set; }
        public List<string>? tags { get; set; }
        public List<string>? evidence { get; set; }
        public double? confidence { get; set; }
    }
}
