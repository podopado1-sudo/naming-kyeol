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
        // 혁 — 2026-10-22 추가. 혁 줄에 빈출 글자가 없어 풀이 게이트되지 않았고, 赫(빛날 혁)이 성별 오분류(−400)로
        // 밀린 자리를 侐(고요할 혁, D등급)이 차지했다(준혁·민혁 등 남자 혁 이름 54명 1순위). 赫 하나만 둔다
        "赫",
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
        // 랑 — 2026-10-22 S4 추가. 랑 줄에 빈출 글자가 없어 풀이 게이트되지 않았고, Core 글자 廊(사랑채 랑)·浪(물결 랑)이
        // 1순위를 나눠 가졌다(S3 빌드 공개 랑 이름 15명 — 浪 11·廊 4). 朗(밝을 랑) 하나만 둔다: 浪을 함께 넣으면 浪이 Core 가점(+2100)으로
        // 朗을 이겨 1순위가 다시 浪이 된다(朗은 Core 아님). 그래서 랑 줄 조합은 朗 하나로만 나온다(浪·廊은 평가 후보 표에는 남음)
        "朗",
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
        /// <summary>
        /// 자원오행 木·火·土·金·水 — 부수 기준(data/hanja_resource_element.json 의 e) 하나만 쓴다 (2026-10-22 S4).
        /// 등급 미상(U)이면 빈 문자열이다(획수 끝자리 대체값 없음). 옛 뜻 기반 값은 <see cref="MeaningElement"/>.
        /// </summary>
        public string FiveElement { get; set; } = string.Empty;
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
        /// <summary>대법원 인명용 한자 목록 포함 여부 — data-gov.csv 또는 data-naver.csv 에 실린 글자(<see cref="GovernmentListCsvFiles"/>, 2026-10-26 B1)</summary>
        public bool IsGovernmentListed { get; set; } = false;

        // ── 부수 기준 자원오행 (2026-10-22 S4 — data/hanja_resource_element.json, 호환 한자 병합 뒤 통합 키에만 적용) ──
        /// <summary>자원오행 등급: R=확정, V=이견 있음, X=예외 적용(간지·문헌·실무 자료), U=미상(FiveElement 빈 값)</summary>
        public string ResourceGrade { get; set; } = "U";
        /// <summary>판정 부수 — 강희 부수 번호 1~214 (미상이면 0)</summary>
        public int RadicalNumber { get; set; }
        /// <summary>판정 부수의 통합 한자 꼴 (水·手 — 변형 氵·扌 가 아니라 원형)</summary>
        public string RadicalChar { get; set; } = string.Empty;
        /// <summary>부수 단위 다른 값(木火土金水 순) — '이 부수(X)를 Y로 보는 자료도 있습니다'. 글자 견해로 쓰지 말 것</summary>
        public List<string> AltRadicalElements { get; set; } = new();
        /// <summary>글자 단위 다른 값(문헌·실무 자료가 이 글자에 준 값)</summary>
        public List<string> AltCharElements { get; set; } = new();
        /// <summary>V 등급의 이유(결과 파일 v_reasons — radical_alt·radical_single·radical_unknown·char_practice 등, 2026-10-22 S7).
        /// 이유가 radical_single 하나뿐이면 '자료 적음', radical_unknown 하나뿐이면 '추정' — 대체값이 없어 '이견 있음'이라 쓰지 않는다</summary>
        public List<string> VReasons { get; set; } = new();
        /// <summary>자원오행 판정 근거 한 줄 (결과 파일 note — 예: "手·扌(손 수) 부수 → 木")</summary>
        public string Rationale { get; set; } = string.Empty;

        // ── 옛 뜻 기반 오행 (D4 — 보존만, 화면·점수에 쓰지 않는다) ────────────
        /// <summary>
        /// 2026-10-22 S4 전까지 FiveElement 였던 뜻 기반 값 — Core_v1(五常·뜻 해석, 옛 S) 또는 radical_map(뜻 키워드, 옛 C).
        /// 옛 획수 끝자리 대체값(옛 D)은 뜻 기반이 아니라 싣지 않는다(빈 문자열).
        /// </summary>
        public string MeaningElement { get; set; } = string.Empty;
        /// <summary>뜻 기반 판정 문장 (Core_v1·radical_map rationale — 옛 Rationale. 예: "仁: 어질다 …")</summary>
        public string MeaningRationale { get; set; } = string.Empty;

        // ── 다층 판정 레이어 (Tiered Resolution) ──────────────────────────
        /// <summary>강희자전 원획법 획수 (표시 획수와 다를 수 있음)</summary>
        public int KangxiStrokes { get; set; }
        /// <summary>
        /// 옛 뜻 기반 오행(MeaningElement)의 판정 등급: S=Core_v1, B=하드코딩, C=radical_map 뜻 키워드, D=획수 대체(값 없음).
        /// 2026-10-22 S4 부터 자원오행(FiveElement)과 무관하다 — 새 등급은 <see cref="ResourceGrade"/>, 옛 S 에 기대던
        /// 가중치(관련도 +100)는 <see cref="IsCoreData"/> 로 옮겼다(옛 S ⇔ Core_v1, 같은 동작). 옛 '획수 조화 감산(Core 아니면 ×0.85)'은
        /// 2026-10-26 폐기(B3 — S5c 뒤 모든 글자의 획수가 data/hanja_strokes.json 한 출처라 Core 여부가 획수 신뢰도와 무관).
        /// </summary>
        public string ConfidenceGrade { get; set; } = "D";
        /// <summary>데이터 출처: Core_v1, Manual, Auto_Radical, Auto_Fallback (옛 뜻 기반 오행 판정의 출처)</summary>
        public string Source { get; set; } = "Auto_Fallback";
        /// <summary>
        /// Core 데이터(hanja_core_v1.json — 강희 획수·뜻을 정리한 코어 글자) 여부. 관련도 +2000·+100, 3글자 Tier 1 의 기준이다.
        /// 옛 ConfidenceGrade S 와 같은 집합(2026-10-22 2,054자).
        /// ⚠️ 획수 신뢰도 신호로 쓰지 말 것 — 옛 '획수 조화 감산 면제'(Core 아니면 ×0.85·'획수 자료 미검수' 노트)는 2026-10-26 폐기(B3, API-4).
        /// S5c-2 부터 점수에 쓰는 StrokeCount 는 Core 든 아니든 data/hanja_strokes.json(kTotalStrokes) 한 출처이고,
        /// Core 로더는 KangxiStrokes(보존·표시)만 채운다 — Core 2,054자 중 404자는 점수 획수와 Core 강희 획수가 다르다(道 13/16 등).
        /// </summary>
        public bool IsCoreData => Source == "Core_v1";
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
        { "春", new HanjaInfo { Character = "春", Reading = "춘", Meaning = "봄", MeaningElement = "木", YinYang = "陽", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "秋", new HanjaInfo { Character = "秋", Reading = "추", Meaning = "가을", MeaningElement = "金", YinYang = "陰", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "天", new HanjaInfo { Character = "天", Reading = "천", Meaning = "하늘", MeaningElement = "火", YinYang = "陽", StrokeCount = 4, Category = "자연", TonePref = TonePreference.Neutral } },
        { "海", new HanjaInfo { Character = "海", Reading = "해", Meaning = "바다", MeaningElement = "水", YinYang = "陰", StrokeCount = 10, Category = "자연", TonePref = TonePreference.Strong } },
        { "雲", new HanjaInfo { Character = "雲", Reading = "운", Meaning = "구름", MeaningElement = "水", YinYang = "陰", StrokeCount = 12, Category = "자연", TonePref = TonePreference.Soft } },
        { "山", new HanjaInfo { Character = "山", Reading = "산", Meaning = "산", MeaningElement = "土", YinYang = "陽", StrokeCount = 3, Category = "자연", TonePref = TonePreference.Strong } },
        { "林", new HanjaInfo { Character = "林", Reading = "림", Meaning = "숲", MeaningElement = "木", YinYang = "陽", StrokeCount = 8, Category = "자연", TonePref = TonePreference.Neutral } },
        { "月", new HanjaInfo { Character = "月", Reading = "월", Meaning = "달", MeaningElement = "水", YinYang = "陰", StrokeCount = 4, Category = "자연", TonePref = TonePreference.Soft } },
        { "星", new HanjaInfo { Character = "星", Reading = "성", Meaning = "별", MeaningElement = "火", YinYang = "陽", StrokeCount = 9, Category = "자연", TonePref = TonePreference.Soft } },
        { "花", new HanjaInfo { Character = "花", Reading = "화", Meaning = "꽃", MeaningElement = "木", YinYang = "陰", StrokeCount = 7, Category = "자연", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },

        // 덕목 계열
        { "和", new HanjaInfo { Character = "和", Reading = "화", Meaning = "화목", MeaningElement = "火", YinYang = "陽", StrokeCount = 8, Category = "덕목", TonePref = TonePreference.Soft } },
        { "正", new HanjaInfo { Character = "正", Reading = "정", Meaning = "바름", MeaningElement = "金", YinYang = "陽", StrokeCount = 5, Category = "덕목", TonePref = TonePreference.Strong } },
        { "道", new HanjaInfo { Character = "道", Reading = "도", Meaning = "길", MeaningElement = "火", YinYang = "陽", StrokeCount = 12, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "均", new HanjaInfo { Character = "均", Reading = "균", Meaning = "고름", MeaningElement = "土", YinYang = "陽", StrokeCount = 7, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "明", new HanjaInfo { Character = "明", Reading = "명", Meaning = "밝음", MeaningElement = "火", YinYang = "陽", StrokeCount = 8, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "德", new HanjaInfo { Character = "德", Reading = "덕", Meaning = "덕", MeaningElement = "火", YinYang = "陽", StrokeCount = 15, Category = "덕목", TonePref = TonePreference.Neutral } },
        { "善", new HanjaInfo { Character = "善", Reading = "선", Meaning = "착함", MeaningElement = "金", YinYang = "陽", StrokeCount = 12, Category = "덕목", TonePref = TonePreference.Soft } },
        { "仁", new HanjaInfo { Character = "仁", Reading = "인", Meaning = "어짐", MeaningElement = "金", YinYang = "陽", StrokeCount = 4, Category = "덕목", TonePref = TonePreference.Soft } },

        // 개념 계열
        { "永", new HanjaInfo { Character = "永", Reading = "영", Meaning = "길이", MeaningElement = "土", YinYang = "陽", StrokeCount = 5, Category = "개념", TonePref = TonePreference.Neutral } },
        { "流", new HanjaInfo { Character = "流", Reading = "류", Meaning = "흐름", MeaningElement = "水", YinYang = "陰", StrokeCount = 10, Category = "개념", TonePref = TonePreference.Neutral } },
        { "恒", new HanjaInfo { Character = "恒", Reading = "항", Meaning = "항상", MeaningElement = "火", YinYang = "陽", StrokeCount = 9, Category = "개념", TonePref = TonePreference.Neutral } },
        { "光", new HanjaInfo { Character = "光", Reading = "광", Meaning = "빛", MeaningElement = "火", YinYang = "陽", StrokeCount = 6, Category = "개념", TonePref = TonePreference.Neutral } },
        { "智", new HanjaInfo { Character = "智", Reading = "지", Meaning = "지혜", MeaningElement = "火", YinYang = "陽", StrokeCount = 12, Category = "개념", TonePref = TonePreference.Neutral } },
        { "勇", new HanjaInfo { Character = "勇", Reading = "용", Meaning = "용기", MeaningElement = "土", YinYang = "陽", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "信", new HanjaInfo { Character = "信", Reading = "신", Meaning = "믿음", MeaningElement = "金", YinYang = "陽", StrokeCount = 9, Category = "개념", TonePref = TonePreference.Neutral } },
        { "誠", new HanjaInfo { Character = "誠", Reading = "성", Meaning = "정성", MeaningElement = "金", YinYang = "陽", StrokeCount = 13, Category = "개념", TonePref = TonePreference.Neutral } },

        // 남성 선호
        { "俊", new HanjaInfo { Character = "俊", Reading = "준", Meaning = "준수함", MeaningElement = "火", YinYang = "陽", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Neutral } },
        { "建", new HanjaInfo { Character = "建", Reading = "건", Meaning = "세움", MeaningElement = "木", YinYang = "陽", StrokeCount = 8, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "雄", new HanjaInfo { Character = "雄", Reading = "웅", Meaning = "웅대함", MeaningElement = "水", YinYang = "陽", StrokeCount = 12, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },
        { "豪", new HanjaInfo { Character = "豪", Reading = "호", Meaning = "호걸", MeaningElement = "水", YinYang = "陽", StrokeCount = 14, Category = "개념", GenderPref = GenderPreference.Male, TonePref = TonePreference.Strong } },

        // 여성 선호
        { "美", new HanjaInfo { Character = "美", Reading = "미", Meaning = "아름다움", MeaningElement = "水", YinYang = "陰", StrokeCount = 9, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        { "雅", new HanjaInfo { Character = "雅", Reading = "아", Meaning = "우아함", MeaningElement = "木", YinYang = "陰", StrokeCount = 12, Category = "개념", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },
        // 秀·恩은 2026-10-22 Female 지정을 뺐다 — 남자 이름에도 흔한 글자인데 −400 감점으로 남자 수·은 이름 1순위가
        // 樹(나무)·銀(은)으로 밀렸다. 秀는 unihan 값과 의미 분류기('빼어날')가 다시 Female 로 찍으므로
        // data/hanja-gender-overrides.json 에서 Neutral 로 고정한다(恩은 두 출처 모두 Neutral 이라 여기서 빼는 것으로 충분).
        // 惠는 그대로 둔다 — 혜 줄 빈출 惠·慧·蕙가 모두 Female 이라 상쇄되는데, 惠만 빼면 여자 혜 이름 52명의 1순위가 慧로 넘어간다.
        { "秀", new HanjaInfo { Character = "秀", Reading = "수", Meaning = "빼어남", MeaningElement = "金", YinYang = "陰", StrokeCount = 7, Category = "개념", TonePref = TonePreference.Soft } },
        { "恩", new HanjaInfo { Character = "恩", Reading = "은", Meaning = "은혜", MeaningElement = "土", YinYang = "陰", StrokeCount = 10, Category = "덕목", TonePref = TonePreference.Soft } },
        { "惠", new HanjaInfo { Character = "惠", Reading = "혜", Meaning = "은혜", MeaningElement = "水", YinYang = "陰", StrokeCount = 12, Category = "덕목", GenderPref = GenderPreference.Female, TonePref = TonePreference.Soft } },

        // ⚠️ 키는 반드시 한자 1글자. 초기 커밋의 "중립/인기" 블록은 우·진·서·하·윤·민·지·현·연·채
        // 한글 음절을 키로 쓴 가짜 항목 10건이었고(뜻도 "하=아래"·"채=채소"처럼 틀림), 사전 삽입 순서를
        // 그대로 쓰는 소비처(RareSurnameEngine.FindHanjaOptions)에 "우(나)"로 새어 나가 2026-09-08 제거.
        // 해당 음절의 실제 인명 한자(佑·宇·珍·眞·瑞·河·潤·敏·志·賢·娟·彩 등)는 JSON + Core_v1이 이미 공급한다.
        // HanjaDataTests.GetAllHanja_ContainsNoNonHanCodePoints가 비한자 키를 기계적으로 막는다.
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

    // [2026-10-22 S4 삭제] CalculateFiveElementFromStrokes — 획수 끝자리(1·2木 3·4火 5·6土 7·8金 9·0水) 오행 대체값.
    // 옛 D등급 5,582자의 FiveElement 가 이 값이었다. 자원오행은 부수 기준 결과 파일(ApplyResourceElements) 하나만 쓴다.

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
    /// 총획수가 있고 음양이 비어 있으면 획수로 음양을 채운다 (이미 있으면 그대로 — 처음 채운 값이 남는다).
    /// 2026-10-22 S4 전에는 오행도 획수 끝자리로 채웠다(AutoCalculateFiveElementAndYinYang, 옛 D등급).
    /// 로드 중간값일 뿐이다 — 사전의 음양은 ApplyYinYangFromStrokes 가 모든 글자를 StrokeCount 홀짝으로 다시 정한다(2026-10-22 S5c-1).
    /// </summary>
    /// <param name="hanjaInfo">한자 정보</param>
    private static void AutoCalculateYinYang(HanjaInfo hanjaInfo)
    {
        if (hanjaInfo.StrokeCount > 0 && string.IsNullOrEmpty(hanjaInfo.YinYang))
        {
            hanjaInfo.YinYang = CalculateYinYangFromStrokes(hanjaInfo.StrokeCount);
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
            // 이 객체들은 정적 사전이라 Reload() 뒤에도 같은 인스턴스다 — 앞 로드의 자원오행을 지우고 다시 적용받는다
            info.FiveElement = string.Empty;
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

                // 대법원 인명용 한자표의 유니코드 미등재 글자 405자는 법원 자체 코드(a01b1 등)가
                // 그대로 코드포인트로 변환돼 미할당 평면(U+A0xxx)·사용자 영역(U+F0xxx)에 실려 있다.
                // 어떤 폰트도 그리지 못하고 뜻·획수도 없으므로 사전에 올리지 않는다.
                if (!IsHanCodePoint(hanja)) continue;

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

                    // 오행은 사전 파일에서 읽지 않는다 — 자원오행은 ApplyResourceElements 하나만 기록한다(2026-10-22 S4).
                    // (five_element 필드는 사전 파일에 없다 — 2026-10-22 확인 0건)

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
                        YinYang = yinYang,
                        StrokeCount = strokeCount,
                        Category = category,
                        GenderPref = GenderPreference.Neutral,
                        TonePref = TonePreference.Neutral
                    };

                    // 총획수가 있으면 음양 계산
                    AutoCalculateYinYang(newHanjaInfo);

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
                    if (existing.StrokeCount == 0)
                    {
                        var strokeCount = entry.total_strokes ?? entry.strokeCount ?? 0;
                        if (strokeCount > 0)
                        {
                            existing.StrokeCount = strokeCount;
                        }
                    }
                    else if (entry.total_strokes.HasValue && entry.total_strokes.Value > 0 && existing.StrokeCount != entry.total_strokes.Value)
                    {
                        // 기존 획수가 있지만 total_strokes가 다르면 업데이트 (더 정확한 데이터)
                        existing.StrokeCount = entry.total_strokes.Value;
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
                    
                    // 오행은 사전 파일에서 읽지 않는다(ApplyResourceElements 하나만 기록 — 2026-10-22 S4)

                    // 음양 정보 업데이트 (없는 경우만, 여러 필드명 지원)
                    if (string.IsNullOrEmpty(existing.YinYang))
                    {
                        var yinYang = entry.yin_yang ?? entry.yinYang ?? string.Empty;
                        if (!string.IsNullOrEmpty(yinYang))
                        {
                            existing.YinYang = yinYang;
                        }
                    }

                    // 음양이 없으면 획수로 계산 (있으면 그대로 — 획수가 바뀌어도 다시 계산하지 않는 것은 S4 전과 같다)
                    AutoCalculateYinYang(existing);
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

        // ── 호환 한자 → 통합 한자 병합 (데이터 파일 적재가 모두 끝난 뒤 — 파일마다 호환 코드 키에도 값을 실었으므로) ──
        MergeCompatibilityIdeographs();

        // ── 획수 (StrokeCount 의 유일한 기록자 — data/hanja_strokes.json kTotalStrokes, /hanja 와 같은 파일 · 병합 뒤 통합 키에, 2026-10-22 S5c-2) ──
        ApplyStrokeCounts();

        // ── 음양 (YinYang 의 유일한 기록자 — StrokeCount 홀짝, 홀수 陽 · 병합 뒤 통합 키에, 2026-10-22 S5c-1) ──
        ApplyYinYangFromStrokes();

        // ── 부수 기준 자원오행 (FiveElement 의 유일한 기록자 — 병합 뒤 통합 키에만, 2026-10-22 S4) ──
        ApplyResourceElements();

        // ── 대표 훈 오버라이드 (모든 Meaning 기록자 이후 — LoadMeaningsFromJson이 덮어쓰고, 병합이 빈 뜻을 채우므로) ──
        ApplyGlossOverrides();

        // ── 성별 선호 오버라이드 (모든 GenderPref 기록자 이후 — unihan·의미 분류기·호환 병합이 Neutral 칸만 채우므로) ──
        ApplyGenderOverrides();
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
                    // 기존 항목에 Core Dataset 정보 덮어씀 (Tier 1 우선).
                    // core_v1 의 오행·근거는 뜻(五常) 해석이라 MeaningElement·MeaningRationale 로만 싣는다(D4, 2026-10-22 S4) —
                    // 자원오행(FiveElement)은 부수 기준 결과 파일이 정한다(ApplyResourceElements).
                    if (!string.IsNullOrEmpty(entry.FiveElement))
                        existing.MeaningElement = entry.FiveElement;
                    if (entry.KangxiStrokes > 0)
                        existing.KangxiStrokes = entry.KangxiStrokes;
                    if (!string.IsNullOrEmpty(entry.Rationale))
                        existing.MeaningRationale = entry.Rationale;
                    existing.ConfidenceGrade = entry.Confidence ?? "S";
                    existing.Source = "Core_v1";

                    // 음양은 여기서 정하지 않는다 — S5c-1 전에는 KangxiStrokes(원획) 홀짝으로 덮었다. 이제 모든 글자가
                    // ApplyYinYangFromStrokes 의 StrokeCount 홀짝 하나다(원획법은 D10 별도 결정 — KangxiStrokes 는 보존).
                }
                // 사전에 없는 글자는 추가하지 않는다 — 수록 범위는 hanja_dictionary_final.json 이 정한다(/hanja 와 같은 집합).
                // 2026-10-22 기준 core_v1 에만 있는 6자 晩·查·随·皂·颻·慥 은 대법원 인명용 한자표(data-gov.csv)·네이버 자료에
                // 없다. 앞 넷은 표준형 晚·査·隨·皁 가 사전에 있고(査·隨 는 core_v1 에도 있음), 颻·慥 은 대응 글자가 목록에 없다.
                // 예전엔 여기서(독음 없는 다섯은 Unihan 로더가 먼저) 새 항목으로 넣어, 뜻 없는 查(독음 사)가 Core 가점(+2000)을
                // 달고 뜻을 보지 않는 생성 풀(NamePoolEngine 등)에 섞였다.
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

    /// <summary>획수 파일 이름 (data/ 아래 — /hanja 를 만드는 scripts/build_hanja_seo_data.py 와 같은 파일)</summary>
    public const string StrokeFileName = "hanja_strokes.json";

    /// <summary>
    /// 획수 적용 (2026-10-22 S5c-2 — 계획 docs/plan-radical-ohaeng-2026-10.md §5 '획수 출처 통일', D9 '프론트 kTotalStrokes 로 통일').
    /// StrokeCount 의 유일한 기록자다. 호환 한자 병합 뒤에 불러 사전에는 통합 키만 있다.
    /// - StrokeCount = data/hanja_strokes.json(kTotalStrokes)의 통합 키 값, 없으면 그 글자로 병합된 호환 키 값
    ///   (scripts/build_hanja_seo_data.py 가 /hanja 의 s 를 만드는 규칙과 같다). 파일에 없는 글자만 앞 로더 값을 남긴다(2026-10-22 0자).
    /// - 음양은 뒤의 ApplyYinYangFromStrokes 가 이 획수 홀짝으로 정한다.
    /// S5c-2 전에는 StrokeCount 가 hanja_unihan.json(kRSAdobe_Japan1_6 부수 획수 + 나머지 획수, 일본 자형)·하드코딩 값이었고 이 파일은
    /// 빈 칸만 채워(옛 LoadStrokeData) 백엔드 ↔ /hanja 획수가 832자 달랐다. 원획법 획수는 별도 결정(D10)이라 KangxiStrokes 는 보존만 한다.
    /// </summary>
    private static void ApplyStrokeCounts()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var strokeMap = ReadStrokeFile();
        if (strokeMap == null) return;

        // 호환 키 값 — 통합 키에 값이 없을 때만 쓴다 (파일 순서 = 코드포인트 순에서 처음 나온 호환 키)
        var compatValue = new Dictionary<string, int>();
        foreach (var (key, n) in strokeMap)
        {
            var unified = ToUnifiedHanja(key);
            if (unified != key && n > 0) compatValue.TryAdd(unified, n);
        }
        int fromFile = 0, kept = 0;
        foreach (var (key, h) in dict)
        {
            if (strokeMap.TryGetValue(key, out var n) && n > 0) { h.StrokeCount = n; fromFile++; }
            else if (compatValue.TryGetValue(key, out var c)) { h.StrokeCount = c; fromFile++; }
            else kept++;
        }
        System.Diagnostics.Debug.WriteLine($"[Strokes] {fromFile}자 획수 파일 적용 · 파일에 없음 {kept}자(앞 로더 값 유지)");
    }

    /// <summary>
    /// 획수 파일(data/hanja_strokes.json — 호환 한자 키 포함). 파일을 못 찾거나 읽지 못하면 null. 테스트가 백엔드 적용값과 대조할 때도 쓴다.
    /// </summary>
    public static Dictionary<string, int>? ReadStrokeFile()
    {
        var path = FindOverrideFile(StrokeFileName);
        if (path == null) return null;
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, int>>(File.ReadAllText(path, System.Text.Encoding.UTF8));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Strokes] 획수 파일 로드 실패: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// 음양 적용 (2026-10-22 S5c-1 — 계획 docs/plan-radical-ohaeng-2026-10.md §3-1·§5 '음양 홀짝 통일', D9).
    /// YinYang 의 유일한 기록자다. 호환 한자 병합(과 획수 적용) 뒤에 불러 사전에는 통합 키만 있다.
    /// YinYang = StrokeCount 홀짝(홀수 陽·짝수 陰 — CalculateYinYangFromStrokes, /hanja 의 y 와 같은 규칙). 획수가 없으면 빈 값.
    /// S5c-1 전에는 먼저 채운 값이 남았다: hanja_unihan.json 음양(수집 스크립트가 짝수를 陽 으로 거꾸로 셌다) →
    /// Core 2,054자는 강희 원획(KangxiStrokes) 홀짝 → 하드코딩 35자는 수동 값. 원획법 음양은 별도 결정(D10)이라 KangxiStrokes 는 보존만 한다(DTO 표시).
    /// </summary>
    private static void ApplyYinYangFromStrokes()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;
        foreach (var h in dict.Values)
            h.YinYang = CalculateYinYangFromStrokes(h.StrokeCount);
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

            var haystack = (h.MeaningRationale ?? string.Empty) + " " + (h.Meaning ?? string.Empty);
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
    /// 이미 B등급 이상이면 덮어쓰지 않습니다.
    /// ⚠️ 파일 이름과 달리 부수를 보지 않는다(뜻 키워드) — 2026-10-22 S4 부터 MeaningElement 로만 싣는다(자원오행 아님).
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

                    // 이미 뜻 기반 오행이 있고 Auto_Fallback이 아닌 경우도 스킵
                    if (!string.IsNullOrEmpty(existing.MeaningElement) &&
                        existing.Source != "Auto_Fallback" && existing.Source != "Auto_Radical")
                        continue;

                    existing.MeaningElement   = entry.FiveElement;
                    existing.MeaningRationale = entry.Rationale ?? string.Empty;
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
    /// 문자열이 유니코드에 실제 등재된 한자 1글자인지 확인 (기본·확장A~H·호환 영역).
    /// 미할당 평면(U+A0xxx)이나 사용자 정의 영역(U+F0xxx~)의 코드포인트는 false —
    /// 대법원 목록의 유니코드 미등재 글자가 자체 코드로 섞여 들어온 경우를 걸러낸다.
    /// </summary>
    public static bool IsHanCodePoint(string character)
    {
        if (string.IsNullOrEmpty(character)) return false;
        if (!System.Text.Rune.TryGetRuneAt(character, 0, out var rune)) return false; // 홀로 남은 서로게이트
        if (rune.Utf16SequenceLength != character.Length) return false;              // 한 글자만 허용
        int codePoint = rune.Value;
        return (codePoint >= 0x3400 && codePoint <= 0x4DBF)     // 확장 A
            || (codePoint >= 0x4E00 && codePoint <= 0x9FFF)     // 기본
            || (codePoint >= 0xF900 && codePoint <= 0xFAFF)     // 호환
            || (codePoint >= 0x20000 && codePoint <= 0x2EBEF)   // 확장 B~F
            || (codePoint >= 0x2F800 && codePoint <= 0x2FA1F)   // 호환 보충
            || (codePoint >= 0x30000 && codePoint <= 0x323AF);  // 확장 G~H
    }

    /// <summary>
    /// CJK 호환 한자(U+F900~FAFF·U+2F800~2FA1F 중 정규화로 통합 한자에 대응하는 글자)이면 그 통합 한자를,
    /// 아니면 입력을 그대로 돌려준다(호환 블록 안의 통합 한자 12자는 정규형이 자기 자신이라 그대로).
    /// KS X 1001 이 金(금·김)·蘭(난·란)처럼 독음마다 코드를 따로 둬서 한국어 IME·네이버 자료가 호환 코드를 낸다.
    /// ⚠️ 호환 한자를 소스 리터럴로 쓰지 말 것 — 편집 도구의 NFC 정규화로 통합 한자로 바뀐 회귀 전력이 있다.
    /// </summary>
    public static string ToUnifiedHanja(string character)
    {
        // 한자 1글자만 — 빈 문자열·여러 글자·홀로 남은 서로게이트(Normalize 가 예외를 던짐)는 그대로 돌려준다
        if (!IsHanCodePoint(character)) return character;
        var unified = character.Normalize(System.Text.NormalizationForm.FormKC);
        return unified != character && IsHanCodePoint(unified) ? unified : character;
    }

    /// <summary>
    /// 호환 한자 항목을 통합 한자 항목에 합치고 사전에서 뺀다 (ND-4, 2026-10-22).
    /// 사전·뜻·Unihan·카테고리 파일이 같은 글자를 호환 코드(金 U+F90A)와 통합 코드(金 U+91D1)로 따로 실어,
    /// 독음 조회에 같은 모양 글자가 둘 나오고, 뜻이 호환 쪽에만 있던 金·蘭·朗·廊·剆 은 후보에서 빠졌다.
    /// 규칙: 통합 쪽 값이 있으면 통합 쪽이 이기고 빈 칸만 호환 쪽 값으로 채운다. 뜻을 호환 쪽에서 받으면
    /// 뜻에서 나온 값(카테고리·성별·톤)도 함께 받는다. 옛 뜻 기반 오행(MeaningElement·등급·근거·출처)은 통합 쪽에 판정이 없을 때만
    /// 호환 쪽 판정을 쓴다. 자원오행(FiveElement)은 여기서 다루지 않는다 — 병합 뒤 ApplyResourceElements 가 통합 키에만 적용한다.
    /// scripts/build_hanja_seo_data.py 가 같은 규칙으로 병합한다(/hanja 독음 페이지 중복 카드 제거).
    /// </summary>
    private static void MergeCompatibilityIdeographs()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var compatKeys = dict.Keys.Where(k => ToUnifiedHanja(k) != k).ToList();
        foreach (var key in compatKeys)
        {
            var src = dict[key];
            var unified = ToUnifiedHanja(key);
            dict.Remove(key);

            if (!dict.TryGetValue(unified, out var dst))
            {
                src.Character = unified;
                dict[unified] = src;
                continue;
            }

            if (string.IsNullOrEmpty(dst.Reading)) dst.Reading = src.Reading;
            foreach (var r in src.AlternateReadings.Prepend(src.Reading))
            {
                if (!string.IsNullOrEmpty(r) && r != dst.Reading && !dst.AlternateReadings.Contains(r))
                    dst.AlternateReadings.Add(r);
            }

            if (string.IsNullOrEmpty(dst.Meaning) && !string.IsNullOrEmpty(src.Meaning))
            {
                dst.Meaning = src.Meaning;
                if (string.IsNullOrEmpty(dst.Category) || dst.Category == "기타") dst.Category = src.Category;
                if (string.IsNullOrEmpty(dst.CategoryMajor))
                {
                    dst.CategoryMajor = src.CategoryMajor;
                    dst.CategoryMinor = src.CategoryMinor;
                    dst.CategoryTags = src.CategoryTags;
                    dst.CategoryEvidence = src.CategoryEvidence;
                    dst.CategoryConfidence = src.CategoryConfidence;
                }
                if (dst.GenderPref == GenderPreference.Neutral) dst.GenderPref = src.GenderPref;
                if (dst.TonePref == TonePreference.Neutral) dst.TonePref = src.TonePref;
            }

            if (dst.StrokeCount == 0) dst.StrokeCount = src.StrokeCount;
            if (dst.KangxiStrokes == 0) dst.KangxiStrokes = src.KangxiStrokes;
            if (string.IsNullOrEmpty(dst.YinYang)) dst.YinYang = src.YinYang;
            if (string.IsNullOrEmpty(dst.Consonant)) dst.Consonant = src.Consonant;
            dst.IsGovernmentListed |= src.IsGovernmentListed;

            // 통합 쪽이 판정 없음(Auto_Fallback = 옛 D)이고 호환 쪽에 뜻 기반 판정(Core_v1·radical_map·하드코딩)이 있으면 그 판정을 받는다.
            // (S4 전 규칙 '통합 쪽이 획수 대체값뿐이면 호환 쪽 판정'과 같은 결과 — 옛 D 의 값·근거는 비어 있으므로 나머지 경우는 바뀌는 것이 없다)
            if (dst.Source == "Auto_Fallback" && src.Source != "Auto_Fallback" && !string.IsNullOrEmpty(src.MeaningElement))
            {
                dst.MeaningElement = src.MeaningElement;
                dst.ConfidenceGrade = src.ConfidenceGrade;
                dst.MeaningRationale = src.MeaningRationale;
                dst.Source = src.Source;
            }
        }
    }

    /// <summary>자원오행 결과 파일 이름 (scripts/build_resource_element.py 산출, data/ 아래)</summary>
    public const string ResourceElementFileName = "hanja_resource_element.json";

    private static readonly HashSet<string> ValidElements = new(StringComparer.Ordinal) { "木", "火", "土", "金", "水" };
    private static readonly HashSet<string> ValidResourceGrades = new(StringComparer.Ordinal) { "R", "V", "X", "U" };

    /// <summary>
    /// 부수 기준 자원오행 적용 (2026-10-22 S4 — 계획 docs/plan-radical-ohaeng-2026-10.md §2-6).
    /// data/hanja_resource_element.json(scripts/build_resource_element.py)의 글자별 e·g·부수·대체값·근거를 싣는다.
    /// FiveElement 의 유일한 기록자다 — 뜻 기반 값(core_v1·radical_map)은 MeaningElement 에, 획수 끝자리 대체값은 없다.
    /// 호환 한자 병합(MergeCompatibilityIdeographs) 뒤에 부르므로 사전에는 통합 한자 키만 있고, 결과 파일의 호환 한자 키
    /// (compat_of — 통합 한자와 같은 값)는 적용하지 않는다. 결과 파일에 없는 글자·파일이 없을 때는 미상(U, FiveElement 빈 값).
    /// build_hanja_seo_data.py 가 같은 파일을 복사하므로 백엔드와 /hanja 의 오행이 한 원천이다(dump-hanja-elements 로 대조).
    /// </summary>
    private static void ApplyResourceElements()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var records = ReadResourceElementFile();
        int applied = 0, missing = 0;
        foreach (var (key, h) in dict)
        {
            h.FiveElement = string.Empty;
            h.ResourceGrade = "U";
            h.RadicalNumber = 0;
            h.RadicalChar = string.Empty;
            h.AltRadicalElements = new List<string>();
            h.AltCharElements = new List<string>();
            h.VReasons = new List<string>();
            h.Rationale = string.Empty;

            if (records == null || !records.TryGetValue(key, out var r) || r.CompatOf != null)
            {
                missing++;
                continue;
            }
            var grade = r.Grade != null && ValidResourceGrades.Contains(r.Grade) ? r.Grade : "U";
            var element = r.Element != null && ValidElements.Contains(r.Element) ? r.Element : string.Empty;
            if (grade == "U" || element.Length == 0) { grade = "U"; element = string.Empty; }

            h.FiveElement = element;
            h.ResourceGrade = grade;
            h.RadicalNumber = r.Radical ?? 0;
            h.RadicalChar = r.RadicalChar ?? string.Empty;
            h.AltRadicalElements = r.AltRadical?.Where(ValidElements.Contains).ToList() ?? new List<string>();
            h.AltCharElements = r.AltChar?.Select(a => a.Element ?? "").Where(ValidElements.Contains).Distinct().ToList()
                                ?? new List<string>();
            h.VReasons = grade == "V" ? r.VReasons?.Where(v => !string.IsNullOrEmpty(v)).ToList() ?? new List<string>() : new List<string>();
            h.Rationale = r.Note ?? string.Empty;
            applied++;
        }
        System.Diagnostics.Debug.WriteLine($"[ResourceElement] {applied}자 적용 · 결과 파일에 없음 {missing}자(미상)");
    }

    /// <summary>
    /// 자원오행 결과 파일의 글자별 기록(호환 한자 키 포함 — compat_of 로 구분). 파일을 못 찾거나 읽지 못하면 null.
    /// 테스트·덤프가 백엔드 적용값과 파일을 대조할 때도 쓴다.
    /// </summary>
    public static Dictionary<string, ResourceElementRecord>? ReadResourceElementFile()
    {
        var path = FindOverrideFile(ResourceElementFileName);
        if (path == null) return null;
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path, System.Text.Encoding.UTF8));
            if (!doc.RootElement.TryGetProperty("chars", out var chars)) return null;
            return JsonSerializer.Deserialize<Dictionary<string, ResourceElementRecord>>(chars.GetRawText());
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ResourceElement] 결과 파일 로드 실패: {ex.Message}");
            return null;
        }
    }

    /// <summary>data/hanja_resource_element.json 의 chars 항목 하나 (필드 뜻은 그 파일 meta.fields)</summary>
    public class ResourceElementRecord
    {
        [JsonPropertyName("e")] public string? Element { get; set; }
        [JsonPropertyName("g")] public string? Grade { get; set; }
        [JsonPropertyName("radical")] public int? Radical { get; set; }
        [JsonPropertyName("radical_char")] public string? RadicalChar { get; set; }
        [JsonPropertyName("alt_radical")] public List<string>? AltRadical { get; set; }
        [JsonPropertyName("alt_char")] public List<ResourceAltChar>? AltChar { get; set; }
        [JsonPropertyName("v_reasons")] public List<string>? VReasons { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("variant_of")] public string? VariantOf { get; set; }
        [JsonPropertyName("compat_of")] public string? CompatOf { get; set; }
    }

    /// <summary>alt_char 항목 — 이 글자에 다른 출처가 준 다른 값</summary>
    public class ResourceAltChar
    {
        [JsonPropertyName("e")] public string? Element { get; set; }
        [JsonPropertyName("basis")] public List<string>? Basis { get; set; }
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
        // 5차(2026-10-22 S4, 감사 EV-3): 雌(암컷 자) — S3 weak 등재로는 /evaluate 박영자(여)=映雌 배정이 남았다
        // (자 줄에 빈출 글자가 없어 weak 감점이 양보로 끝남). 불용이라야 배정·후보 표에서 빠진다
        "雌",
        // 6차(2026-10-22 S6-2 두더지 검수 2라운드): 溺(빠질 닉·오줌 뇨) — 1라운드 weak 뒤 라익 4순위 빈칸으로 승격된 명백 부정자
        "溺",
        // 7차(2026-10-26 B1 재생성 두더지 검수 1라운드): 妮(계집종 니(이)) — 인명용 목록 판정에 data-naver.csv 를 더하자(B1)
        // 관련도 +500 을 받아 /name 조합 9쌍(다니=茶妮·예니=譽妮·채니=彩妮 등)에 승격. 훈이 婢(계집종 비)·奴(종 노)와 같은 '천함' 부류
        "妮",
        // 8차(2026-10-26 B6 보완 두더지 검수 1라운드): 戹(좁을 액/재앙 액) — 약자 양보 뒤 액(용신 火) 1순위로 오른 글자.
        // 첫 훈 '좁을'이 狹(좁을 협)·阨(막힐 액)과 같은 부류이고 부훈이 厄(액 액)과 같은 '재앙'
        "戹",
        // 3라운드: 訛(그릇될 와 — 誤 선례. 萵 weak 뒤 와(남·용신 火) 1순위)
        "訛",
        // /name 재생성 두더지: 痘(역질 두 — 疫·疹 선례). 兜·杜 가 weak 로 밀린 뒤 두 줄 조합 후보 상위 6에 들어온다
        "痘",
        // 9차(2026-10-26 운영 검증 부정 훈 정리 1라운드): 최항준(남)=桁(차꼬)·/analysis 후보 犴(들개/감옥)·蠢(꿈틀거릴/어리석을)·旱(가물) 제보 뒤
        //   전 독음 덤프(/evaluate 배정 격자 = 독음 × 성별 3 × 생년월일 없음·용신 5(희신·기신은 YongshinCalculationService 규칙),
        //   /name-analysis 표시 상위 10 = OrderForDisplay)에서 형벌·감옥·병·죽음·더러움·어리석음·천함·도둑·재앙·신체 부정 훈을 골라 선례와 대조.
        //   글자는 \u 이스케이프(호환 한자 리터럴 회귀 방지 — 모두 CJK 기본 영역), 주석은 '글자(선례; 그 독음 자리·노출 위치)'.
        //   睾(불알 고)는 10/26 인명용 두 CSV 합집합(B1)으로 새로 인명용이 된 글자. 다른 독음에 좋은 훈이 있는 글자는 넣지 않았다(便·忓 는 weak).
        // 형구: 桁(囚·刑 선례(차꼬 = 형구); 항 — 최항준(남) 배정) 梏(囚·刑 선례(수갑); 곡 후보 8위) 桎(囚·刑 선례(차꼬); 질 후보 9위) 釱(囚·刑 선례(차꼬); 체 배정 3칸·후보 3위) 轞(囚 선례(함거 = 죄인 수레); 함 후보
        //   10위)
        "\u6841","\u688F","\u684E","\u91F1","\u8F5E",
        // 짐승·감옥: 犴(犬·狗·狴(감옥) 선례; 안 — 분석 후보 7위)
        "\u72B4",
        // 재앙: 旱(災·渴 선례(가뭄); 한 — 분석 후보 5위) 鴆(毒 선례(짐새 = 독조); 짐 배정 9칸·후보 1위) 蠱(蟲·呪 선례(뱃속벌레·고독); 고 배정 2칸 — 고(여, 생년월일 없음))
        "\u65F1","\u9D06","\u8831",
        // 어리석음: 蠢(憃·蟲 선례(어리석을·벌레); 준 — 분석 후보 8위) 駑(鈍·騃 선례(둔할); 노 — 잠재) 儢(怠·惰 선례(힘쓰지 아니할); 려 후보 7위)
        "\u8822","\u99D1","\u5122",
        // 신체 부정: 睾(尿·膀·胱 선례(배설·생식 기관); 고 — 10/26 인명용 합집합으로 새로 인명용) 脧(尿·膀·胱 선례(불알); 최 후보 5위) 膣(尿·膀·胱 선례(음도); 질 배정 3칸) 矇(盲 선례(청맹과니); 몽 후보 7위) 眇(盲
        //   선례(애꾸눈); 묘 후보 8위) 瞎(盲 선례(애꾸눈); 할 배정 6칸·후보 2위) 禿(跛·佝 선례(대머리); 독 후보 9위) 矮(佝·跛 선례(난쟁이); 왜 배정 6칸·후보 4위) 咼(跛·蹇 선례(입 비뚤어질); 괘 배정 4칸·후보 3위)
        //   牸(雌 선례(암소); 자 배정 1칸). 牡(수컷 모)는 같은 날 보완에서 weak 로 옮김(雄 '수컷 웅'이 인명 빈출 — weak 블록)
        "\u777E","\u8127","\u81A3","\u77C7","\u7707","\u778E","\u79BF","\u77EE","\u54BC","\u7278",
        // 도둑: 虜(擄 선례(노략질·사로잡을); 노·로 — 잠재) 刦(劫 선례(겁탈할 — 劫의 이체); 겁 배정 12칸·후보 1위) 刧(劫 선례(겁탈할 — 劫의 이체); 겁 후보 2위) 剽(劫 선례(겁박할); 표 배정 1칸) 拐(掠·擄 선례(후릴 =
        //   유괴); 괴 후보 9위) 俘(擄 선례(사로잡을); 부 배정 3칸)
        "\u865C","\u5226","\u5227","\u527D","\u62D0","\u4FD8",
        // 감옥: 圉(僕·圄·囹 선례(첫 훈 마부 = 천함, 부훈 감옥 어); 어 배정 3칸 — 첫 훈 기준 ①과도 맞음)
        "\u5709",
        // 형벌: 懲(罰·刑 선례(징계할); 징 후보 2위)
        "\u61F2",
        // 병: 疥(瘡·疣 선례(옴); 개 배정 2칸) 癨(病·瘡 선례(곽란); 곽 후보 7위) 疸(病 선례(황달); 달 후보 6위) 瘰(瘡 선례(연주창); 라 후보 8위) 癧(瘡 선례(연주창); 력·역 배정 2칸) 痳(病 선례(임질); 림 후보 8위)
        //   癕(瘡 선례(악창); 옹 배정 2칸·후보 9위) 癰(瘡 선례(악창); 옹 후보 10위) 癈(病 선례(고질병); 폐 후보 8위) 癥(病 선례(적취); 징 배정 1칸) 症(病 선례(증세); 증 배정 3칸) 瘋(狂·病 선례(두풍·미칠); 풍 배정
        //   6칸·후보 5위) 瘀(病 선례(어혈질); 어 후보 7위) 疙(瘡 선례(쥐부스럼); 흘 배정 4칸·후보 3위) 癃(疲·瘁 선례(느른할·고질병); 륭·융 배정 2칸)
        "\u75A5","\u7668","\u75B8","\u7630","\u7667","\u75F3","\u7655","\u7670","\u7648","\u7665","\u75C7","\u760B","\u7600","\u7599","\u7643",
        // 죽음: 殑(殞·殆 선례(까무러칠); 긍 후보 5위) 椁(冢·殮 선례(덧널 = 관); 곽 후보 5위) 槨(冢·殮 선례(외관); 곽 후보 6위) 窀(墓·塚 선례(광중 = 무덤 구덩이); 둔 배정 3칸) 邙(墓·塚 선례(북망산 = 무덤); 망 배정
        //   6칸·후보 4위) 窆(葬 선례(하관할); 폄 배정 6칸) 翣(葬·絰 선례(불삽 = 상여 장식); 삽 배정 4칸) 縗(絰 선례(상복); 최 후보 10위) 髽(絰 선례(북상투 = 상중 머리); 좌 후보 8위) 殉(死 선례(따라 죽을); 순 후보
        //   9위) 殲(殺·戮 선례(다 죽일); 섬 배정 3칸) 殍(餓·死 선례(주려 죽을); 표 배정 3칸·후보 4위) 祊(祭 선례(제사); 팽 배정 3칸) 膰(祭 선례(제사 고기); 번 배정 2칸) 餽(祭 선례(제사 지낼); 궤 후보 7위)
        "\u6B91","\u6901","\u69E8","\u7A80","\u9099","\u7A86","\u7FE3","\u7E17","\u9AFD","\u6B89","\u6BB2","\u6B8D","\u794A","\u81B0","\u993D",
        // 더러움: 溏(淖·泥 선례(진창); 당 배정 2칸) 濘(淖·泥 선례(진창); 녕 배정 4칸·후보 2위) 霉(腐·朽 선례(곰팡이); 매 배정 3칸) 粕(滓·渣 선례(지게미); 박 후보 9위) 衊(汚 선례(더럽힐); 멸 배정 6칸)
        "\u6E8F","\u6FD8","\u9709","\u7C95","\u884A",
        // 천함: 儓(僕·隷 선례(하인); 대 후보 6위) 懦(弱 선례(나약할); 나 후보 10위) 孱(弱 선례(잔약할); 잔 후보 5위) 窄(狹 선례(좁을); 착 배정 3칸) 貶(低·蔑 선례(낮출); 폄 후보 2위)
        "\u5113","\u61E6","\u5B71","\u7A84","\u8CB6",
        // 가난: 趜(困 선례(곤궁할); 국 후보 7위)
        "\u8D9C",
        // 범죄: 賂(罪·犯 선례(뇌물); 뇌·뢰 후보 7위)
        "\u8CC2",
        // 거짓: 詑(詐·欺 선례(속일); 타 배정 3칸) 詃(誑·誆 선례(꾈); 견 배정 3칸) 諜(覘·窺 선례(염탐할); 첩 배정 3칸·후보 2위) 謞(奸 선례(간특할); 학 후보 7위)
        "\u8A51","\u8A43","\u8ADC","\u8B1E",
        // 악: 傝(惡 선례(나쁠); 탑 배정 6칸·후보 2위)
        "\u509D",
        // 잘못: 忒(誤·訛 선례(틀릴); 특 배정 10칸·후보 2위) 逆(叛·違 선례(거스를); 역 후보 7위) 悖(叛·戾 선례(거스를); 패 후보 9위) 很(戾 선례(패려궂을); 흔 후보 7위)
        "\u5FD2","\u9006","\u6096","\u5F88",
        // 포악: 迫(虐 선례(핍박할); 박 배정 3칸)
        "\u8FEB",
        // 비방: 訐(詆·誹 선례(들추어낼); 알 배정 3칸·후보 4위) 捓(嘲 선례(야유할); 야 후보 10위)
        "\u8A10","\u6353",
        // 교만: 媟(嫚·慢 선례(버릇없이 굴); 설 배정 3칸)
        "\u5A9F",
        // 문란: 嬲(姦·淫 선례(희롱할); 뇨 배정 2칸·후보 3위)
        "\u5B32",
        // 다툼: 爭(鬩·鬪 선례(다툴); 쟁 배정 6칸·후보 2위) 戰(鬪 선례(싸움); 전 후보 2위)
        "\u722D","\u6230",
        // 훼손: 毀(壞·損 선례(헐); 훼 배정 3칸·후보 5위) 毁(壞·損 선례(헐 — 毀의 이체); 훼 후보 6위) 弊(敝 선례(폐단·해질); 폐 배정 3칸·후보 4위) 塌(崩·坍 선례(무너질); 탑 후보 3위)
        "\u6BC0","\u6BC1","\u5F0A","\u584C",
        // 고통: 儜(苦 선례(괴로워할); 녕 배정 6칸·후보 4위) 咻(嗚·哽 선례(신음 소리); 휴 배정 3칸·후보 3위)
        "\u511C","\u54BB",
        // 슬픔: 憯(慘 선례(비통할); 참 배정 3칸·후보 3위) 慟(哀·悲 선례(서러워할); 통 후보 8위) 恫(悼·傷 선례(상심할); 통 배정 3칸·후보 7위) 欸(嘆·歎 선례(한숨 쉴); 애 후보 7위)
        "\u61AF","\u615F","\u606B","\u6B38",
        // 감정: 妒(妬 선례(강샘할 — 妬의 이체); 투 후보 3위)
        "\u5992",
        // 짐승: 蛣(蚊·蛆 선례(장구벌레); 길 후보 4위) 蠹(蟲 선례(좀); 두 후보 8위) 虻(蚊·蠅 선례(등에); 맹 후보 8위) 蟊(蟲 선례(해충); 모 후보 4위) 蝥(蟲 선례(해충); 모 후보 6위) 鵂(鶹·梟 선례(수리부엉이); 휴 후보
        //   7위) 豖(豕 선례(발 얽은 돼지 걸음); 축 배정 3칸)
        "\u86E3","\u8839","\u867B","\u87CA","\u8765","\u9D42","\u8C56",
        // 9차 2라운드(1라운드 뒤 같은 칸·표시 상위 10 에 새로 오른 글자):
        // 더러움: 黷(汚 선례(더럽힐); 독(水) 瀆 뒤 1순위·후보 9위)
        "\u9EF7",
        // 신체 부정: 瞽(盲 선례(맹인); 고 후보 10위) 嫫(醜 선례(추녀); 모 후보 8위)
        "\u77BD","\u5AEB",
        // 비방: 揶(嘲·捓 선례(야유할); 야 후보 10위)
        "\u63F6",
        // 훼손: 跌(蹶·躓 선례(거꾸러질); 질 후보 10위)
        "\u8DCC",
        // 재앙: 晘(旱 선례(가물); 한 후보 9위)
        "\u6658",
        // 9차 보완(같은 날 검증 지적 — 정리 뒤 격자·표시 상위 10 재검수): '벗을' 부류는 두 세트에 한 글자도 없어 흔한 이름 칸에 남았다
        //   (김단우(남, 생년월일 없음)=胆 '옷 벗을 단' — 단우는 남아 2,914명, 胆 의 Male +40 이 旦 '아침'을 이김). 다른 독음에 좋은 훈이 없어 불용
        // 신체 부정: 胆(睾·盲·跛 선례(옷 벗을 — 단 자리. 다른 독음 '쓸개 담'은 膽 weak, '살찔 달'); 단(남, 생년월일 없음·水) 배정 2칸·후보 9위)
        //   臝(같은 선례(벌거벗을); 나 후보 8위·라 후보 6위) 倮(같은 선례(벗을 — 부훈 '좁을 과'는 窄 선례); 나 후보 10위(懦 뒤 새로 듦)·라 후보 8위)
        //   裸(臝·倮 와 같은 훈(벗을) — 표시·배정에는 아직 안 나오는 잠재 두더지)
        "\u80C6","\u81DD","\u502E","\u88F8",
        // 포악: 侵(迫·掠·擄·寇·犯 선례(침노할 = 침략); 침 배정 6칸(생년월일 없음 성별 3 + 火 3)·후보 1위 — HEAD 부터. 寢·沈·琛·駸·忱 대안)
        "\u4FB5",
        // 보완 2라운드: 癩(瘋·癧·病 선례(나병); 나 후보 19위·라 후보 13위 — 臝·倮·儺 가 빠지며 상위 10 에 다가선 잠재 두더지)
        "\u7669",
        // 10차(2026-10-26 '남긴 칸' 처리 — 9차가 '대안 없음'으로 남긴 음절의 글자): 그 음절 글자가 모두 같은 부류라 9차는 손대지 않았는데,
        //   그동안 /evaluate·/name-analysis 가 이 부정 훈을 그대로 배정·표시했다. 원칙 = 명백 부정(형벌·죽음·병·악덕과 그 선례 부류)만 불용,
        //   약한 훈은 weak(양보 — 대안 없는 음절에서는 남는다). 그 결과 후보가 0이 된 음절(괵·녈·몰·닉·녁·훙·퍅, 뜻 없는 글자만 남은 핍·뉵 —
        //   옛 에·죄·틈·픽·혐·히 와 같은 경로)은 배정 없음(HanjaSelector.Select null — 뜻 있는 글자가 모두 불용이면 뜻 없는 글자로 메우지 않는다)·
        //   후보 표 0개·안내 문구(HanjaSelector.NoUsableHanjaNote — 응답 noHanjaNote)로 끝난다.
        //   글자는 유니코드 이스케이프(모두 CJK 기본 영역), 주석은 '글자(선례; 그 독음 자리·노출 위치)'.
        // 신체 부정(언어 장애): 吶(啞·聾 선례(말 더듬을); 눌 후보 1위·배정 12칸) 訥(같은 훈(말 더듬거릴) — 訥言敏行 의 '말을 아낌'은 용례일 뿐 인명 훈은
        //   '말 더듬거릴'; 눌 후보 3위·배정 6칸) 吃(같은 훈(말 더듬을) — 9차가 訥 과 함께 둔 글자; 흘 후보 6위)
        "\u5436","\u8A25","\u5403",
        // 포악: 偪(迫 선례(핍박할); 핍 후보 1위·배정 12칸) 逼(迫 선례(핍박할); 핍 후보 2위·배정 6칸)
        "\u506A","\u903C",
        // 형벌: 馘(刖·割·斬 선례(귀 벨 — 적의 귀를 베는 형); 괵 유일 글자 — 배정 18칸 전부)
        "\u9998",
        // 병: 衄(病 선례(코피 — 부훈 敗衄 '꺾일'); 뉵 유일 뜻 있는 글자·육 후보 10위)
        "\u8844",
        // 더러움: 涅(泥·淖·淤 선례(개흙 — '검은 물 들일'은 자자형 연상); 녈 유일 글자·열 후보 8위. 통용 涅槃 은 승려의 죽음(입적)도 이르는 말이라
        //   '통용 의미가 긍정' 예외(③)에 들지 않는다)
        "\u6D85",
        // 죽음: 沒(歿 선례(빠질 — 歿 '죽을 몰'과 같은 독음으로 통용: 沒年·戰沒, 溺 '빠질' 선례); 몰 — 歿 이 불용이라 유일 글자)
        //   薨(死·殂 선례(훙서할 = 제후의 죽음); 훙 유일 글자) 殤·殀(死 선례(일찍 죽을); 상·요 — 잠재) 夭(첫 훈 기준①(일찍 죽을 요 — 부훈 '어릴'·'예쁠');
        //   요 후보 18위 — 잠재)
        "\u6C92","\u85A8","\u6BA4","\u6B80","\u592D",
        // 악: 匿(慝 선례(숨길 닉·사악할 특 — 慝 '사특할 특·숨길 닉'과 같은 두 훈) · 隱 '숨을' 선례; 닉 유일 뜻 있는 글자(溺 은 6차 불용)·익 후보 5위)
        "\u533F",
        // 굶주림: 惄(飢·餒 선례(허출할 — 부훈 '근심할'은 憂 선례); 녁 유일 글자·역 후보 16위)
        "\u60C4",
        // 악덕: 愎(很·戾 선례(강퍅할 = 성미가 까다롭고 고집셈); 퍅 유일 글자)
        "\u610E",
        // 신체 부정: 肛(尿·膀·胱 선례(항문); 항 후보 17위 — 9차가 잠재로만 적은 글자. 명백 부정 잠재 글자는 넣고, 약자급 잠재 글자는 넣지 않는다)
        "\u809B",
        // 10차 2라운드(1라운드 뒤 표시 상위 10 에 새로 든 글자): 笘(鞭·箠 선례(회초리 — 매질 도구, 부훈 '대쪽 첩'); 墊 weak 뒤 점 후보 10위)
        "\u7B18",
        // 11차(2026-10-27 성별 표 전면 적용 재생성 두더지 3라운드 — 산 줄 weak 를 넓히며 다음 순번에 다가선 잠재 글자):
        //   疝(疥·癨 선례(산증 — 병 훈); 산 줄 — 山·珊 다음 순번)
        "\u759D",
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
        // (雌 암컷 자 — 2026-10-22 S3 에 여기 넣었다가 S4 에 ForbiddenNameHanjaSet 으로 옮김: weak 는 양보라 /evaluate 배정에 남았다)
        // ── 2026-10-07 /name 라이브 실측 — 대표 훈이 이름 뜻으로 부적절한데 동점 풀에 들어와 조합에 노출 ──
        // 咳(기침 — 7/02 대표 훈 교정 뒤 해웅=咳雄) 煂(불태울 — 준혁=俊煂 등 12쌍, 혁은 爀·奕 대안 있음)
        // 烋·降은 독음별 훈이 갈리는 글자 — 烋 효 자리 '거들먹거릴'(휴 자리 '아름다울'은 休 대안, 효리=烋李 등 97쌍),
        // 降 항 자리 '항복할'(강 자리 '내릴'). 조합 카드가 독음 맞춤 훈을 보이게 되면서 드러남
        "咳","煂","烋","降",
        // ── 2026-09-02 수록 확장(30~79명) E 목록 두더지 검수 1라운드 — 어색·부정·사물·직분 훈 ──
        // 잠·이탈·신체·허사: 宿(잘) 熟(익을) 歸(돌아갈) 若(같을) 目(눈) 麽(작을) 匽(눕힐) 斜(비낄) 枉(굽을) 欠(하품) 捩(비틀)
        "宿","熟","歸","若","目","麽","匽","斜","枉","欠","捩",
        // 부정·위협·조문 연상: 喧(지껄일) 嚇(으를/웃음소리) 挽(당길·만사) 赦(용서) 瞱(噴려볼) 曠(빌) 寒(찰) 賽(굿할) 愢(책선할)
        "喧","嚇","挽","赦","瞱","曠","寒","賽","愢",
        // 사물·시설·집단: 圈(우리) 屋(집) 土(흙) 球(공) 物(물건) 砦(진터) 寨(목책) 陵(언덕·능) 輩(무리) 職(직분) 蕁(지모) 葷(훈채)
        "圈","屋","土","球","物","砦","寨","陵","輩","職","蕁","葷",
        // 관계·직분·기타 어색: 傔(시중들) 孫(손자) 魏(나라이름) 裵(성씨) 王(임금) 請(청할) 聽(들을) 諾(허락) 況(상황) 漫(질펀할) 巒(메) 廞(벌여놓을) 薦(천거할)
        "傔","孫","魏","裵","王","請","聽","諾","況","漫","巒","廞","薦",
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
        // ── 2026-10-22 S6-2 두더지 검수 1라운드 — 자원오행 전환 재생성 뒤 새로 1순위·조합에 오른 글자 ──
        // 1순위 승격(공개 이름): 帆(돛 — 범준·경범 등 16명, 汎·範 대안) 柯(가지 — 가온) 校(학교) 款(항목) 豆(콩 — 荳와 같은 곡물 훈)
        //   鹿(사슴 — 초록·승록, 祿·綠 대안) 必(반드시) 復(부 자리 '다시') 云(이를·말할) 致(이를) 半(반) 考(생각할 — 先考 '돌아가신 아버지' 연상)
        //   契(설 자리 '사람 이름' — 은설=恩契 문장이 계 자리 '맺을' 뜻을 끌어옴, 雪·設 대안) 貝(배 자리 '성씨', 패 자리 '조개')
        "帆","柯","校","款","豆","鹿","必","復","云","致","半","考","契","貝",
        // 빈칸 채우기 승격(2~4순위): 母(어머니) 墰(술 단지) 榏(이물) 棬(나무 그릇) 埴(찰흙) 場(마당) 每(매양) 傿(에누리) 疈(가를) 諷(풍자할)
        //   抄(베낄) 暇(틈) 遣(보낼) 萍(부평초 — 떠도는 삶 연상) 稚(어릴) 婐(날씬할) 甄(질그릇 구울) 稳(穩의 간체) 茤(이민족 이름) 荰(민족두리풀) 宋(송나라)
        "母","墰","榏","棬","埴","場","每","傿","疈","諷","抄","暇","遣","萍","稚","婐","甄","稳","茤","荰","宋",
        // 2라운드(1라운드 뒤 승격): 附(붙을 — 부겸·부영 1순위) 返·反(돌이킬 — 반희 1순위, 伴 대안) 街(거리) 觰(뿔 밑동) 膽(쓸개) 猧(발바리)
        //   鄲(조나라) 眸(눈동자) 泄(샐) 熄(불 꺼질). 溺(빠질·오줌 뇨)은 명백 부정이라 ForbiddenNameHanjaSet 으로
        "附","返","反","街","觰","膽","猧","鄲","眸","泄","熄",
        // 3라운드: 黵(문신할 — 膽 뒤 휘담 4순위 빈칸)
        "黵",
        // ── 2026-10-26 B1 재생성 두더지 검수 1라운드 — 인명용 목록에 data-naver.csv 를 더한 뒤(관련도 +500) 새로 오른 글자 ──
        // /name 조합: 弩(쇠뇌 — 무기 사물, 銃 선례. 노아=弩亞 등 5쌍, 努·璐 대안) 穏(穩의 일본 신자체 — 稳(간체) 선례. 온찬·휘온 4순위, 穩 대안)
        // /evaluate 1순위: 腦(골 — 신체 훈, 膽·腸 선례. 뇌(남)·뇌(용신 水) 1순위가 雷 '우레'에서 바뀜)
        //   醲(진한 술 — 사물 훈. 농(none·용신 金) 1순위가 瓏 '옥 소리'에서 바뀜)
        "弩","穏","腦","醲",
        // 2라운드: 矑(눈동자 — 신체 훈, 眸 선례. 弩 뒤 노(none·여, 용신 木) 1순위)
        //   笯(새장 — 사물 훈, 矑 뒤 같은 칸 1순위). 다음 撈(건질 로 — 로(none·여, 용신 木)와 같은 글자)에서 멈춘다(부정 훈 아님)
        "矑","笯",
        // ── 2026-10-26 B6 보완 두더지 검수 1라운드 — /evaluate 배정 격자(독음 × 성별 3 × 생년월일 없음·용신 5, 희신·기신까지 /evaluate 와 같은 인자)를
        //    HEAD(b0f840c)와 대조해 약자 양보(B6)·인명용 목록 보강(B1) 뒤 새로 1순위에 오른 글자 중 부정·허사·사물·동물 훈 ──
        // 惓(권 자리 '삼갈/싫증날' — 첫 훈은 부정 아님, 倦 '게으를'은 불용. 김권우(남·土)=勸 → 惓) 斯(사 자리 '이 사/천할 사' — 허사, 其·矣 선례.
        //   박사랑(여·金)=事 → 斯) 呝(닭 소리·볼멘소리) 喞(두런거릴 — 囁 '소곤거릴' 선례) 諠(지껄일 — 喧 선례) 褪(바랠 — 熄 '불 꺼질' 선례)
        //   枙(와 자리 '옹이' 사물, 부훈 '재앙 액' — 첫 훈 기준이라 불용 아님) 泐(돌 갈라질 — 熄·泄 선례) 挒(비틀 — 捩 선례)
        //   厓·崕(언덕 애 — 崖 의 이체, 崖 선례)
        "惓","斯","呝","喞","諠","褪","枙","泐","挒","厓","崕",
        // 동물·사물: 羔(새끼 양) 鷿(논병아리 — 鴨 선례) 兎·兔(토끼 — 虎 선례, 이체 둘 다) 兜(투구 — 弩·銃 선례) 鑞(땜납 — 蠟 선례) 勿(말 물 — 금지 허사, 未·不 선례)
        "羔","鷿","兎","兔","兜","鑞","勿",
        // 2라운드(1라운드 + 확장 영역 제외 뒤 승격): 肋(갈빗대 — 脅 선례) 颲(사나운 바람 — 挒 뒤 렬(木·남 金)) 僻(궁벽할 — 鷿 뒤 벽)
        //   刪(깎을 — 削 선례. 珊 이 Female 이 된 뒤 산(남·金)) 萵(상추 — 菜 선례) 荄(풀뿌리 — 艾·茅 선례. 확장 䀭 을 뺀 뒤 해(남·木))
        "肋","颲","僻","刪","萵","荄",
        // 3라운드: 剷(깎을 — 刪 뒤 산(남·金)) 酸(실 — 辛 선례, 剷 뒤 같은 칸) 廨(공해 — 관아 건물, 庫·倉 선례. 荄 뒤 해(木))
        "剷","酸","廨",
        // 4라운드: 釵(비녀 — 장신구 사물. 砦 weak 뒤 채(남·용신 金·水) 1순위 — 埰·彩 대안). 다음 칸들은 埰(사패지)·彩(채색)·楷(본보기)·山(메)·
        //   娃(예쁠)·渦(소용돌이)로 부정 훈이 아니어서 여기서 멈춘다. 모(여·土)=旄(깃대 장식)도 부정 훈이 아니라 둔다(뒤 후보 姆 유모·嫫 추녀)
        "釵",
        // /name 재생성 E 목록(위 weak 로 조합이 바뀐 뒤 새로 오른 글자): 姟(백 조 해 — 수 단위, 千·九 선례. 해웅·해찬 荄 뒤 빈칸)
        //   杜(막을 두 — 遮 '가릴'·禁 '금할' 선례. 두찬·두혁 兜 뒤 4순위, /evaluate 두(木)) 枓(두공 — 건물 부재, 椽·桷 선례. 杜 뒤 같은 칸)
        "姟","杜","枓",
        //   侅(이상할 해 — 姟 뒤 해찬·해웅 4순위, 해안 4순위는 HEAD 부터. 偕·海·垓·楷 대안) 孩(어린아이 — 兒 선례. 侅 뒤 해안 4순위)
        "侅","孩",
        // ── 2026-10-26 운영 검증 부정 훈 정리 1라운드 — 불용(9차)과 같은 전 독음 덤프에서 고른 '불용까지는 아닌' 글자(양보만) ──
        //   다중 독음 글자(便 변/편·忓 간/한)는 나쁜 훈이 그 독음 자리에만 있어 불용 대신 weak(降 선례). 呶·啂 는 앞 단계가 남긴 잠재 두더지
        // 嗽(咳 선례(기침); 수 후보 7위) 欬(咳 선례(기침); 해 후보 9위) 呶(喧·諠 선례(지껄일); 노 — 잠재) 啂(乳 선례(젖); 누 후보 9위) 尻(臀 선례(볼기); 고 후보 9위) 便(降 선례(독음별 훈 — 변 자리 '똥오줌', 편 자리
        //   '편할'); 변 배정 3칸) 忓(降 선례(독음별 훈 — 간 자리 '방해할', 한 자리 '아름다울'); 간 배정 2칸) 瀆(枙 선례(첫 훈 '도랑', 부훈 '더럽힐' — 첫 훈 기준이라 불용 아님); 독 배정 3칸) 淪(熄·泄 선례(빠질); 륜
        //   후보 2위) 捏(飾 선례(꾸밀); 날 배정 6칸·후보 2위) 埋(葬 은 불용이나 '묻을'은 매장·매립 겸용(약자); 매 배정 1칸·후보 3위) 堋(埋 와 같은 훈(묻을); 붕 배정 3칸) 煤(煙 선례(그을음); 매 배정 3칸) 焚(煂
        //   선례(불사를); 분 배정 3칸·후보 3위) 燔(煂 선례(불사를); 번 후보 5위) 爇(煂 선례(불사를); 설 배정 3칸) 刮(削·刪 선례(깎을); 괄 배정 6칸) 獗(颲 선례(날뛸); 궐 배정 6칸·후보 2위) 慊(愢 선례(찐덥지 않을); 겸
        //   배정 3칸) 趌(嚇 선례(성내어 달릴); 길 배정 2칸) 俖(非 선례(옳지 못할); 배 후보 10위) 弗(不 선례(아닐 — 허사); 불 배정 3칸) 祓(賽 선례(푸닥거리할); 불 후보 6위) 訟(諷 선례(송사할); 송 배정 2칸) 譫(喧
        //   선례(헛소리); 섬 후보 9위) 翫(玩 선례(희롱할); 완 배정 3칸) 戎(弩·兜 선례(병장기); 융 배정 3칸) 柙(檻 선례(우리); 합 배정 6칸) 壅(杜 선례(막을); 옹 배정 6칸) 嘖(喧 선례(들렐); 책 배정 6칸) 呫(囁·喞
        //   선례(소곤거릴); 첩 배정 3칸) 喋(喧 선례(재재거릴); 첩 후보 10위) 偢(愢 선례(인정 없을); 초 후보 6위) 勡(嚇 선례(으를); 표 배정 1칸) 吠(喧 선례(짖을); 폐 후보 7위) 黠(狡 는 불용이나 '약을'은 약자; 힐 배정
        //   3칸) 盻(瞥 선례(흘겨볼); 혜 후보 5위) 迷(眩 은 불용이나 '미혹할'은 약자; 미 후보 4위) 惑(迷 와 같은 훈(미혹할); 혹 배정 8칸·후보 1위) 釁(祭 근처 '피 칠할'·틈 — 약자; 흔 배정 3칸) 蝕(蠹 근처 '좀먹을' —
        //   약자; 식 배정 1칸) 媪(媼 선례(할머니 — 媼의 이체); 온 배정 2칸)
        "\u55FD","\u6B2C","\u5476","\u5542","\u5C3B","\u4FBF","\u5FD3","\u7006","\u6DEA","\u634F","\u57CB","\u580B","\u7164","\u711A",
        "\u71D4","\u7207","\u522E","\u7357","\u614A","\u8D8C","\u4FD6","\u5F17","\u7953","\u8A1F","\u8B6B","\u7FEB","\u620E","\u67D9",
        "\u58C5","\u5616","\u546B","\u558B","\u5062","\u52E1","\u5420","\u9EE0","\u76FB","\u8FF7","\u60D1","\u91C1","\u8755","\u5AAA",
        // 2라운드(1라운드 뒤 같은 칸 1순위·표시 상위 10 에 오른 글자):
        // 惘(悶 은 불용이나 '멍할'은 약자; 망(火·土) 邙 뒤 1순위) 齪(狹 근처 '악착할'(도량 좁음) — 약자; 착(여) 窄 뒤 1순위) 齷(齪 과 같은 훈(악착할); 악 배정 1칸) 剃(削 선례(머리털 깎을); 체(金) 釱 뒤 1순위) 髰(削
        //   선례(머리털 깎을); 체(火) 1순위) 鰾(鰓 선례(부레); 표(水) 殍 뒤 1순위) 矰(弩 선례(주살); 증(여·金·水) 症 뒤 1순위) 轢(踐 선례(짓밟을); 력 후보 10위) 邕(壅 과 같은 훈(막을) — 壅 weak 뒤 옹(土·金)
        //   1순위; 옹(土·金))
        "\u60D8","\u9F6A","\u9F77","\u5243","\u9AF0","\u9C3E","\u77F0","\u8F62","\u9095",
        // 3라운드(2라운드 수렴 뒤 격자 전체를 부정 낱말로 다시 훑어 남은 배정 칸):
        // 咢(喧 선례(시끄럽게 다툴); 악 배정 1칸) 酗(醲 선례(주정할 — 술 훈); 후 배정 1칸·후보 7위)
        "\u54A2","\u9157",
        // /name 재생성 E 목록(위 글자로 조합이 바뀐 뒤 새로 오른 글자):
        // 鼸(蛙·蝸 선례(도마뱀 — 범속 동물, 鼠 부수); 문겸 4순위 文慊 뒤 文鼸)
        "\u9F38",
        // ── 같은 날 보완(검증 지적 — 정리 뒤 격자·표시 상위 10 재검수): 위 글자와 훈이 같은데 '부정 낱말로 다시 훑음'에서 빠진 글자·사물 훈 ──
        // 같은 훈: 偓(齷 선례(악착할); 악(여·火) 배정 1칸·후보 8위) 燒(焚·燔·爇 선례(불사를); 소 후보 7위) 爚(焚 선례(불사를); 약(火) 배정 3칸·후보 6위)
        //   呢(呫 선례(소곤거릴); 니 후보 3위·/name 니나·다니·대니·라니·루니 2~4순위) 聶(呫 선례(소곤거릴); 섭 후보 6위) 咠(呫 선례(소곤거릴); 집 후보 7위)
        //   噥(呫 선례(소곤거릴); 농 후보 9위) 洩(泄 선례(샐 — 泄의 이체); 설 후보 8위) 漏(泄 선례(샐); 루 후보 10위) 橽(泄 선례(물 샐); 달(木) 배정 3칸·후보 3위)
        //   眄(盻 선례(곁눈질할); 면(남·木) 배정 1칸·후보 7위) 焮(煂 선례(태울); 흔 후보 10위 — 정리 뒤 새로 듦)
        //   煇(便·降 선례(독음별 훈 — 훈 자리 '태울', 휘 자리 '빛날'); 훈(여) 배정 2칸(지훈(여) 등)·후보 4위 — HEAD 부터, 焮 과 같은 훈)
        // 첫 훈은 괜찮고 부훈이 부정: 嫖(瀆 선례(첫 훈 '날랠', 부훈 '음탕할' — 淫·嬲 부류); 표(土) 배정 2칸·후보 9위(殍·剽·勡 이 빠진 뒤 새로 듦))
        // 사물·시설 훈(부정은 아님 — 뜻이 약함): 貥(貝 선례(큰 자개); 항(남, 생년월일 없음·金) 배정 3칸 — 최항준(남)=桁 을 뺀 뒤 Male +40 으로 恒 '항상'을 이김)
        //   珬(貝 선례(자개 — 貥 와 같은 훈); 술(金) 배정 3칸·후보 4위) 櫜(弩·矰 선례(활집 = 무기 사물); 고(남, 생년월일 없음·木) 배정 2칸 — HEAD 부터)
        //   驛(校 선례(역 = 시설 훈); 주역 4순위 柱驛·역 후보 7위)
        // 불용에서 옮김: 牡(수컷 모 — 雄 '수컷 웅'이 인명 빈출이라 불용은 과잉. 雌 를 불용으로 옮긴 까닭(옛 감점이 映雌 배정을 못 막음)은
        //   지금 Select 의 약자 양보(비약자 대안이 있으면 후보에서 뺌)가 막는다. 모(남·土)는 weak 여도 旄)
        "\u5053","\u71D2","\u721A","\u5462","\u8076","\u54A0","\u5665","\u6D29","\u6F0F","\u6A7D","\u7704","\u712E","\u7147",
        "\u5AD6","\u8CA5","\u73EC","\u6ADC","\u9A5B","\u7261",
        // 보완 2라운드(1라운드 뒤 같은 칸 1순위·표시 상위 10 에 오른 글자): 鉥(針 선례(돗바늘); 珬 뒤 술(金) 배정 3칸)
        //   鶸(鷄·鴨·鷿 선례(댓닭); 爚 뒤 약(火) 배정 3칸) 儺(祓 선례(푸닥거리); 臝·倮 뒤 나 후보 10위) 哪(祓·那 선례(역귀 쫓는 소리/어찌); 儺 다음 나 후보 11위)
        "\u9265","\u9DB8","\u513A","\u54EA",
        // ── 2026-10-26 '남긴 칸' 처리(불용 10차와 같은 날) — 앞 단계가 '부정 훈이 아니어서 둔 칸'·'weak 후보'로 적은 글자와 같은 훈 글자 ──
        // 飫(惓 선례(물릴 = 싫증날); 어 후보 2위·어(水) 배정 3칸·/name 어령 2순위 飫玲) 或(其·矣·乎 선례(혹 — 허사); 혹 후보 1위·배정 11칸, 惑 weak 뒤 1순위)
        // 痕(瘢 '흉터'는 불용이나 '흔적'은 약자(疒 부수 — 傷痕); 흔 후보 10위·흔(水) 배정 3칸) 顳(額·顎·頰 선례(관자놀이 — 신체 범속); 섭 후보 10위)
        // 肭(肥 선례(살찔) — 膃 '살질'은 2차 불용이나 '살찔'은 肥 처럼 약자; 눌 후보 2위 — 吶·訥 불용 뒤 눌 줄 유일 글자라 배정은 남는다(녀=女 와 같은 경로))
        // 墊(淪 선례(빠질 — 첫 훈); 점 후보 7위·점(여·土/金) 배정 2칸 — 沒 을 불용으로 옮기며 같은 훈 글자를 다시 봄)
        // 諱(秘 선례(숨길 — 부훈 '꺼릴'); 휘 후보 9위 — 匿 을 불용으로 옮기며 같은 훈 글자를 다시 봄)
        //   같은 훈 잠재 글자(猒 물릴 염 12위·湎 빠질 면 11위·渨·洆·洇·肪·腴·駜 살찔)는 표시 상위 10·배정 밖이라 넣지 않았다(약자급 잠재 글자 — 불용 10차 주석)
        "\u98EB","\u6216","\u75D5","\u9873","\u80AD","\u588A","\u8AF1",
        // 2라운드(/name 재생성 E 목록 — 匿 불용으로 익 줄 조합 후보 상위 6이 바뀐 뒤): 杙(臬 선례(말뚝); 찬익 4순위 燦杙·익(木) 배정 3칸 — HEAD 부터)
        //   弋(矰 선례(주살 — 같은 훈); 익 후보 5위·익(金) 배정 3칸 — HEAD 부터. 杙 을 빼면 같은 칸에 다가선다)
        "\u6759","\u5F0B",
        // 재생성 두더지(같은 날 — 바꾼 독음의 배정 격자·표시 상위 10 재검토, 衄 불용으로 다시 본 육 줄): 肉(膚·肥·乳 선례(고기 — 신체·음식 훈);
        //   육 후보 1위·배정 9칸(생년월일 없음 성별 3 + 木·水) — HEAD 부터. 育 '기를 육'과 관련도 동점이라 코드포인트 순서로 앞섰다. 育·陸·堉·毓 대안)
        "\u8089",
        // ── 2026-10-27 성별 표 전면 적용(고친 genderPref·선택기 O3) 재생성 두더지 1라운드 — 반대 성별 글자를 뺀 칸·빈출 Male/Female 이 Neutral 이 된 줄에
        //   새로 오른 글자. 주석은 '글자(선례; 노출 위치)'. 줄마다 뜻 좋은 대안이 있어 양보만 시킨다(배제 아님) ──
        // 사물·시설: 縕(헌솜 — 낡은 솜, 부정은 아님; 나온·새온 2순위) 橵(산자 — 서까래 위 산자널, 榏·棬 선례; 산아·산휘 1순위 橵亞·橵輝)
        //   櫓(방패·노 — 帆 선례; 로빈·로휘 4순위) 袀(군복; 찬균 4순위) 磁(자석; 자헌 3순위 — 子 Neutral 뒤) 簅(큰 피리; 산해 3순위·두산 4순위)
        //   盤(소반 — 棬 '나무 그릇' 선례; 공개 반희 1순위 盤喜 — 熙 Neutral 뒤, 伴 대안) 堰(둑 — 場·街 선례; 준언 4순위 — 嫣 Female 제외 뒤)
        "\u7E15","\u6A75","\u6AD3","\u8880","\u78C1","\u7C05","\u76E4","\u5830",
        // 땅·물 모양: 壚(검은 석비레 — 埴 '찰흙' 선례; 마로 4순위) 渦(소용돌이)·洼(웅덩이)(萍 선례; 로와·주와 2·3순위) 剡(땅 이름 — 鄲·宋 선례; 유섬 3순위)
        "\u58DA","\u6E26","\u6D3C","\u5261",
        // 동작·모양: 喁(벌름거릴 — 물고기 입; 슬옹 3순위) 睒(언뜻 볼 — 眄 '곁눈질할' 선례; 아섬 3순위) 摻(가늘 — 婐 선례; 아섬 4순위)
        //   儱(미숙한 모양 — 稚 '어릴' 선례; 초롱 1순위 草儱) 控(당길 — 抄·遣 선례; 공명 1순위 控明) 待(기다릴 — 遣 선례; 공개 대권·대산 1순위·규대 1·2순위 —
        //   大 '큰'이 Male 에서 빠져 동점이 된 뒤. 大·岱 대안) 巡(돌 — 返·反 '돌이킬' 선례; 순옥 1순위 巡玉 — 純 대안)·循(같은 훈 '돌')
        "\u5581","\u7752","\u647B","\u5131","\u63A7","\u5F85","\u5DE1","\u5FAA",
        // 그 밖: 內(안 — 半 선례(위치 훈); 시내 3·4순위) 狻(사자 — 鹿 선례(짐승 훈); 공개 강산 4순위 剛狻·두산 3순위)
        //   丈(어른 — 母 선례(친족·호칭 훈); 장민·장수·장군·장연 1순위 — 將·壯 이 Male 에서 빠진 뒤, 將·壯·章 대안)
        //   炎(담 자리 '아름다울' — 거의 '불꽃 염'으로만 읽혀 담 이름에서 어색, 염 자리 '불꽃'은 炎症 연상; 담휘·아담 4순위)
        //   烘(화톳불 — 젖은 것을 불에 말림, 熄 선례; 홍 줄 15→39쌍 — 鴻 이 Male 에서 빠진 뒤, 弘·洪·泓 대안)
        //   曅(曄 의 이체 — 穏·稳 선례(이체·간체 글자); 찬엽 4순위 燦曅 — 燦曄 이 같은 칸에 있다)
        "\u5167","\u72FB","\u4E08","\u708E","\u70D8","\u66C5",
        // 2라운드(1라운드 weak 뒤 같은 칸에 오른 글자): 孿(쌍둥이 — 친족 훈, 母 선례; 공개 강산 4순위·산아·산휘·산이 4순위)
        //   產(낳을 — 産 은 앞 블록부터 weak — 자형 짝을 맞춤; 산아·산휘 2순위·두산 3순위·은산 4순위) 傘(우산 — 사물 훈; 산아·산휘 3순위·대산 4순위)
        //   擡(들 — 抄 선례(동작 훈); 대웅·대찬·대혁·대휘 4순위) 媻(비틀거릴 — 부정에 가까운 동작; 반석 4순위)
        //   閃(엿볼 — 睒·眄 선례; 아섬 3순위) 陝(땅 이름 — 剡 선례; 아섬 4순위) 孅(가늘 — 摻 와 같은 훈, 부훈 '교활할 첨'; 아섬 2순위)
        //   窊(우묵할 — 洼 선례; 주와 4순위) 饔(아침밥 — 음식 훈, 肉 선례; 슬옹 4순위) 旬(열흘 — 半 선례(수·때 단위 훈); 순미·순화·영순 3·4순위)
        "\u5B7F","\u7522","\u5098","\u64E1","\u5ABB","\u9583","\u965D","\u5B45","\u7A8A","\u9954","\u65EC",
        // 3라운드(산·와 줄 — 2라운드 weak 뒤 같은 칸에 오른 글자, 줄에 山·珊 / 娃 만 남아 하나씩 막으면 다음 글자가 올라와 줄째 정리):
        //   汕(오구 — 물고기 잡는 통발, 사물 훈; 공개 강산·대산·이산 4순위) 祘(산가지 — 셈 막대; 산아·산해·산휘 2~4순위) 繖(우산 — 傘 과 같은 훈)
        //   蒜(마늘 — 음식 훈) 霰(싸라기눈 — 산 자리 희귀 글자, 다음 순번 잠재) 窪(웅덩이 — 洼 와 같은 훈; 주와 4순위).
        //   산 줄은 山·珊 뿐이라 강산·산아·산휘 등은 조합 수가 줄어든 채 둔다(약자로 빈칸을 채우지 않는다 — O3 보완 ②)
        "\u6C55","\u7958","\u7E56","\u849C","\u9730","\u7AAA",
        // 4라운드: 竇(구멍 — 孔 '구멍'은 성씨·공자로 통용, 竇 는 굴·구멍 훈뿐(사물 훈); 공개 두산 3순위 竇山 — 산 줄 정리 뒤)
        "\u7AC7",
        // 후속(같은 날 검증 지적 — 같은 조합을 꼴만 바꿔 두 칸에): 夛(多 '많을 다'의 이체 — 曅 선례(위 1라운드, 이체 글자); 다형 4순위 夛炯 — 多炯 이 같은 페이지에.
        //   HEAD 부터 다안·다올·다찬·다혁·다휘 4순위·다령 3순위가 多 와 나란히. hanja_variants.json 자형 쌍에 없어 이체자 접기가 못 잡는다)
        //   — 같은 줄 奲(관대할 차·풍부할 다)는 다 자리 훈 '풍부할'이 이름 뜻으로 괜찮아 둔다
        "\u591B",
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

    /// <summary>이름 뜻으로 약한 한자(감점 대상)인지 판정 — 동음의 더 나은 대안이 있으면 양보.
    /// 호환 코드포인트는 <see cref="IsForbiddenNameHanja"/>와 같이 NFKC 정규형으로 조회한다(세트에는 통합 한자만 둔다).</summary>
    public static bool IsWeakGivenNameHanja(string character)
    {
        if (WeakGivenNameHanjaSet.Contains(character)) return true;
        var unified = ToUnifiedHanja(character); // NFKC — 한자 1글자가 아니면 그대로
        return unified != character && WeakGivenNameHanjaSet.Contains(unified);
    }

    /// <summary>
    /// 관련도(<see cref="CalculateRelevanceScore"/>)의 '성별 값 있음(Neutral 아님) +5'. 옛날엔 Neutral 이 '값 없음'이라 정보 보유 가점이었고,
    /// 2026-10-27 고친 성별 표부터는 Neutral 도 정해진 값이지만 모든 경로(조합·배정·표시 정렬 <see cref="Utils.HanjaSelector.OrderForDisplay"/>)가 그대로 쓴다.
    /// 관련도 동점이 많아 이 +5 가 꽃·옥처럼 성별 결이 뚜렷한(이름에 맞는) 훈을 앞세우는 동점 깨기 노릇을 한다 — 표시 정렬에서만 빼 보니
    /// 然·夏·映·和 가 蓮·荷·榮·花 를 앞서고 剕·匪 가 비 상위 10에 올라 되돌렸다(OrderForDisplay 주석). 성별 표를 고치면 표시 순서도 함께 움직인다.
    /// </summary>
    public const int GenderLabelRelevanceBonus = 5;

    public static int CalculateRelevanceScore(HanjaInfo hanja)
    {
        int score = 0;

        // Core Dataset v1 — 강희 획수·뜻을 정리한 코어 글자 (최우선)
        if (hanja.IsCoreData)
            score += 2000;

        // 옛 'S등급' 가점 — 2026-10-22 S4 에 등급(ConfidenceGrade S)에서 Core 여부로 옮겼다(옛 S ⇔ Core_v1 이라 점수 불변).
        // Core +2000 과 겹치지만 생성 경로의 가감(약자 −3000·용신 가산 등)과 더해지는 절대값이라 그대로 둔다.
        if (hanja.IsCoreData)
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
        // 성별 쪽 가점은 성별 없는 표시 정렬(HanjaSelector.OrderForDisplay)에서도 동점 깨기로 쓴다 — GenderLabelRelevanceBonus 참고
        if (hanja.GenderPref != GenderPreference.Neutral)
            score += GenderLabelRelevanceBonus;
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
        if (string.IsNullOrEmpty(character)) return null;
        if (HanjaDictionary.TryGetValue(character, out var info)) return info;
        // 사전은 호환 한자를 통합 한자 항목에 병합해 두므로, IME 가 낸 호환 코드(김→金 U+F90A)는 통합 쪽으로 찾는다
        var unified = ToUnifiedHanja(character);
        return unified != character && HanjaDictionary.TryGetValue(unified, out info) ? info : null;
    }

    /// <summary>
    /// 자형 이체자 묶음 키 — 같은 글자의 꼴만 다른 글자(彥 U+5F65 ↔ 彦 U+5F66, 凛 ↔ 凜, 実 ↔ 實)이면 같은 키, 묶음에 없으면 null.
    /// data/hanja_variants.json(scripts/build_hanja_variants.py — Unihan 18.0 이체 연결 + 한국 훈 대조)의 쌍 중 세 조건을 모두 갖춘 high·medium 쌍만
    /// 잇는다: ① 자형 연결 필드(kZVariant·kTraditional/kSimplifiedVariant·kJapaneseOld/NewVariant) ② 대표 훈이 같음(k = K2) ③ 판정 부수가 같음.
    /// 뜻 이체(kSemanticVariant 만 — 彬/斌·德/悳·圭/珪·佑/祐)와 부수가 다른 간번체 쌍(傑/杰)은 이름에서 서로 다른 글자로 쓰여 잇지 않는다
    /// (HEAD /name 에서 같은 페이지에 함께 나오던 47·32·8·13·3쪽 — 꼴이 달라 읽는 사람에게 중복으로 보이지 않는다). 키는 묶음의 코드포인트 최소 글자.
    /// /name 조합 목록이 같은 조합을 꼴만 바꿔 두 칸에 싣지 않게 하는 데 쓴다(<see cref="Utils.HanjaSelector.SelectCombos"/>, 2026-10-27).
    /// </summary>
    public static string? GlyphVariantKey(string character)
        => GlyphVariants.Value.Key.TryGetValue(character, out var k) ? k : null;

    /// <summary>
    /// 자형 이체자 묶음의 정자(hanja_variants.json standard — 한국 표준형 kHangul E > KS X 1001 > KS X 1002 > 방향 > 인명용 표 > Core …,
    /// 그 파일 meta.rules) 인지. 묶음에 없거나 정자 판정이 동률(standard_tie — 사람 확인 대상)이면 null.
    /// </summary>
    public static bool? IsGlyphVariantStandard(string character)
        => GlyphVariants.Value.Standard.TryGetValue(character, out var std) ? std == character : null;

    private static readonly Lazy<(Dictionary<string, string> Key, Dictionary<string, string> Standard)> GlyphVariants = new(LoadGlyphVariants);

    /// <summary>자형(꼴) 이체를 뜻하는 Unihan 연결 필드 — kSemanticVariant(뜻 이체)·kSpecializedSemanticVariant 는 넣지 않는다.</summary>
    private static readonly HashSet<string> GlyphVariantFields = new(StringComparer.Ordinal)
        { "kZVariant", "kTraditionalVariant", "kSimplifiedVariant", "kJapaneseOldVariant", "kJapaneseNewVariant" };

    private static (Dictionary<string, string> Key, Dictionary<string, string> Standard) LoadGlyphVariants()
    {
        var key = new Dictionary<string, string>(StringComparer.Ordinal);
        var standard = new Dictionary<string, string>(StringComparer.Ordinal);
        var path = FindOverrideFile("hanja_variants.json");
        if (path == null) return (key, standard);
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path, System.Text.Encoding.UTF8));
            foreach (var g in doc.RootElement.GetProperty("groups").EnumerateArray())
            {
                // 자형 쌍만으로 이은 성분(유니온 파인드) — 묶음 안에서도 뜻 이체 쌍은 끊는다
                var parent = new Dictionary<string, string>(StringComparer.Ordinal);
                string Find(string x) { while (parent[x] != x) x = parent[x] = parent[parent[x]]; return x; }
                foreach (var p in g.GetProperty("pairs").EnumerateArray())
                {
                    var conf = p.GetProperty("confidence").GetString();
                    if (p.GetProperty("k").GetString() != "K2" || (conf != "high" && conf != "medium")) continue;
                    if (!p.GetProperty("fields").EnumerateArray().Any(f => GlyphVariantFields.Contains(f.GetString() ?? ""))) continue;
                    var a = p.GetProperty("a").GetString()!;
                    var b = p.GetProperty("b").GetString()!;
                    var radicals = g.GetProperty("radicals");
                    if (radicals.GetProperty(a).GetProperty("kn").GetInt32() != radicals.GetProperty(b).GetProperty("kn").GetInt32()) continue;
                    parent.TryAdd(a, a);
                    parent.TryAdd(b, b);
                    var ra = Find(a); var rb = Find(b);
                    if (ra != rb) parent[ra] = rb;
                }
                if (parent.Count == 0) continue;
                var std = g.GetProperty("standard").GetString();
                bool tie = g.TryGetProperty("standard_tie", out var t) && t.ValueKind == JsonValueKind.True;
                foreach (var comp in parent.Keys.GroupBy(Find))
                {
                    var members = comp.ToList();
                    var k = members.OrderBy(c => char.ConvertToUtf32(c, 0)).First();
                    foreach (var c in members)
                    {
                        key[c] = k;
                        if (!tie && std != null && members.Contains(std)) standard[c] = std;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"이체자 묶음 로드 실패: {ex.Message}");
        }
        return (key, standard);
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
    /// Unihan 데이터로부터 획수, 음양 정보 업데이트
    /// 향후 Unihan 데이터 통합 시 사용. fiveElement 인자는 받지만 쓰지 않는다 — 자원오행은 부수 기준 결과 파일
    /// (ApplyResourceElements) 하나만 기록한다(2026-10-22 S4).
    /// </summary>
    public static void UpdateFromUnihan(string character, int strokeCount, string fiveElement, string yinYang)
    {
        if (!HanjaDictionary.TryGetValue(character, out var hanja))
            return;

        lock (_lockObject)
        {
            if (strokeCount > 0 && hanja.StrokeCount == 0)
            {
                hanja.StrokeCount = strokeCount;
            }
            if (!string.IsNullOrEmpty(yinYang) && string.IsNullOrEmpty(hanja.YinYang))
            {
                hanja.YinYang = yinYang;
            }

            // 음양이 없으면 획수로 계산
            AutoCalculateYinYang(hanja);
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
    /// hanja_unihan.json 에 genderPref 기록이 있는 글자(값이 Neutral 이어도) — 오프라인 분류기(scripts/classify_gender_tone.py)가 판정한 글자라
    /// 런타임 의미 분류기(GenderToneClassifier.AutoClassifyAll)가 성별을 다시 매기지 않는다(2026-10-27 성별 규칙 감사 D2 — 판정 규칙은 오프라인 하나).
    /// 옛 동작은 unihan 이 Neutral 로 둔 글자를 C# 부분 일치가 다시 채워, 파이썬 규칙만 고치면 260자가 되살아났다.
    /// 레코드는 있어도 genderPref 칸이 없는 글자(48자 — 한글·영문 뜻이 없어 오프라인 분류기가 건너뜀)는 '기록 없음'으로 보고 런타임 분류기가 맡는다
    /// (런타임은 사전 훈(Meaning)을 보므로 판정 재료가 있을 수 있다. 2026-10-27 기준 89자 모두 Neutral).
    /// </summary>
    private static readonly HashSet<string> UnihanGenderDecided = new(StringComparer.Ordinal);

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
                    
                    // 사전에 없는 글자는 추가하지 않는다 — 수록 범위는 hanja_dictionary_final.json(인명용 목록)이 정한다.
                    // (2026-10-22까지는 여기서 독음·뜻 없는 Unihan 전용 5,482자를 새 항목으로 넣어, 백엔드 사전이
                    //  사이트 /hanja 보다 컸다. 독음이 없어 조회 경로엔 안 나왔지만 FindByCharacter·전수 순회에는 섞였다.)
                    if (!HanjaDictionary.ContainsKey(hanja)) continue;
                    
                    if (HanjaDictionary.TryGetValue(hanja, out var hanjaInfo))
                    {
                        lock (_lockObject)
                        {
                            // Unihan 데이터 업데이트 (획수, 음양)
                            if (data.strokeCount.HasValue && data.strokeCount.Value > 0)
                            {
                                // 기존 값이 없거나 0인 경우에만 업데이트
                                // 또는 기존 값이 있지만 Unihan 데이터가 더 정확할 수 있으므로 업데이트
                                if (hanjaInfo.StrokeCount == 0 || hanjaInfo.StrokeCount != data.strokeCount.Value)
                                {
                                    hanjaInfo.StrokeCount = data.strokeCount.Value;
                                }
                                
                                // 오행(fiveElement — 획수 끝자리 값)은 읽지 않는다. 자원오행은 ApplyResourceElements 하나만 기록한다(2026-10-22 S4)
                                // 음양(yinYang)도 읽지 않는다 — 수집 스크립트가 짝수를 陽 으로 거꾸로 셌다. 음양은
                                // ApplyYinYangFromStrokes(StrokeCount 홀짝)가 마지막에 정한다(2026-10-22 S5c-1)
                                // 획수도 중간값이다 — StrokeCount 는 ApplyStrokeCounts(data/hanja_strokes.json)가 마지막에 정한다(2026-10-22 S5c-2).
                                // 여기 값은 그 파일에 없는 글자의 대체값일 뿐(2026-10-22 0자)
                            }
                            
                            // GenderPref/TonePref 업데이트 (기본값인 Neutral일 때만)
                            if (!string.IsNullOrEmpty(data.genderPref)) UnihanGenderDecided.Add(hanja); // 오프라인 분류기가 판정한 글자(Neutral 포함, D2)
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

        var path = FindOverrideFile("hanja-gloss-overrides.json");
        if (path == null) return;
        try
        {
            var overrides = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path));
            if (overrides == null) return;
            foreach (var (ch, preferred) in overrides)
            {
                if (dict.TryGetValue(ToUnifiedHanja(ch), out var h)) // 사전은 통합 한자 키만 둔다
                    h.Meaning = ReorderGloss(h.Meaning, preferred);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"대표 훈 오버라이드 로드 실패: {ex.Message}");
        }
    }

    /// <summary>
    /// 성별 선호 오버라이드(data/hanja-gender-overrides.json — {"赫": "Neutral"}) 적용.
    /// GenderPref 기록자(하드코딩 → unihan → 의미 분류기 → 호환 병합)는 모두 'Neutral 칸만 채운다'라서
    /// 한 번 잘못 찍힌 성별(赫 '빛날'이 키워드 분류로 Female)은 뒤에서 되돌릴 수 없다 — 그래서 맨 마지막에 덮는다.
    /// 키워드 전면 재분류 대신 영향이 큰 글자만 좁게 고치는 자리다(2026-10-22 ND-2).
    /// </summary>
    private static void ApplyGenderOverrides()
    {
        var dict = _loadedDictionary;
        if (dict == null) return;

        var path = FindOverrideFile("hanja-gender-overrides.json");
        if (path == null) return;
        try
        {
            var overrides = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path));
            if (overrides == null) return;
            foreach (var (ch, value) in overrides)
            {
                if (!Enum.TryParse<GenderPreference>(value, ignoreCase: false, out var pref) || !Enum.IsDefined(pref)) continue;
                if (dict.TryGetValue(ToUnifiedHanja(ch), out var h)) // 사전은 통합 한자 키만 둔다
                    h.GenderPref = pref;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"성별 선호 오버라이드 로드 실패: {ex.Message}");
        }
    }

    /// <summary>오버라이드 데이터 파일 경로 — 실행 폴더 → 현재 폴더 → 프로젝트 루트 순, 각 폴더의 data/ 를 먼저 본다.</summary>
    private static string? FindOverrideFile(string fileName)
    {
        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        var projectRoot = Path.GetFullPath(Path.Combine(execDir, "..", "..", "..", ".."));

        foreach (var basePath in new[] { execDir, currentDir, projectRoot })
        {
            foreach (var path in new[] { Path.Combine(basePath, "data", fileName), Path.Combine(basePath, fileName) })
            {
                if (File.Exists(path)) return path;
            }
        }
        return null;
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
    /// 훈 조각의 끝 낱말(독음)과 괄호 속 두음 독음 — 프론트 lib/name-seo.ts glossForReading 의 정규식 글자 그대로
    /// (OpsVerificationRegressionTests.GlossForReading_SameRegexAsFrontend 가 대조한다).
    /// </summary>
    public const string GlossReadingTailPattern = @"\s([^\s(]+)(?:\(([^)]+)\))?$";

    private static readonly System.Text.RegularExpressions.Regex GlossReadingTail =
        new(GlossReadingTailPattern, System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    /// <summary>
    /// 다중 훈 문자열에서 이름 음절(reading)로 읽히는 훈 한 조각 — 프론트 lib/name-seo.ts <c>glossForReading</c>·dump-combo-glosses 와 같은 규칙.
    /// 조각(구분자 ',' '/' ';' '·' — 첫 훈 소비처와 같은 집합)의 끝 낱말이 독음이고, "연꽃 련(연)"처럼 괄호 속 두음 독음도 인정한다.
    /// 맞는 조각이 없으면 첫 훈(첫 조각 — 프론트 firstGloss 와 같음).
    /// 다중 독음 글자는 첫 훈이 다른 소리라(煇 "빛날 휘, …, 태울 훈"을 지훈의 '훈' 자리에, 乻 "땅 이름 얼, …"을 하늘의 '늘' 자리에)
    /// 첫 훈만 쓰면 독음과 훈이 어긋난다. 소비처: /evaluate 의미 메모·강점 줄(ExplanationEngine, 2026-10-26 B7 — API-2)·dump-combo-glosses.
    /// </summary>
    public static string GlossForReading(string? meaning, string reading)
    {
        if (string.IsNullOrWhiteSpace(meaning)) return "";
        var segs = meaning.Split(',', '/', ';', '·');
        foreach (var raw in segs)
        {
            var seg = raw.Trim();
            var m = GlossReadingTail.Match(seg);
            if (m.Success && (m.Groups[1].Value == reading || (m.Groups[2].Success && m.Groups[2].Value == reading)))
                return seg;
        }
        return segs[0].Trim();
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

        // 대법원 인명용 한자 목록 — IsGovernmentListed 플래그 설정. 두 공식 CSV 중 어느 쪽에든 실린 글자는 등재(2026-10-26 B1).
        // data-gov.csv 만 보면 그 파일의 ㄴ 구획이 '냉' 다음에 끊겨(1636행 冷 → 1637행 '다') 노·농·뇌·누·눈·눌·능·니 처럼
        // ㄴ 으로만 읽는 글자(努·能·農·腦·訥 등 32자)가 빠지고, 姬·港·珊·慜·冕 등 18자는 실제 코드포인트가 아니라
        // 법원 자체 코드(U+A0xxx·U+F0xxx — IsHanCodePoint 가 거르는 405자)나 다른 코드(姬 → 姫 U+59EB)로만 실려 있다.
        // 이 50자는 모두 data-naver.csv 에 그 독음으로 실려 있다(근거·목록: GovernmentListCsvFiles 주석).
        foreach (var csvFile in GovernmentListCsvFiles)
        {
            foreach (var basePath in searchPaths)
            {
                var csvPath = Path.Combine(basePath, "data", csvFile);
                if (File.Exists(csvPath))
                {
                    LoadGovernmentHanjaList(csvPath);
                    break;
                }
            }
        }

        // 의미 기반 GenderPref/TonePref 자동 분류 (Neutral인 한자만 대상) — 성별은 unihan genderPref 기록이 없는 글자만(D2, UnihanGenderDecided)
        if (_loadedDictionary != null)
        {
            GenderToneClassifier.AutoClassifyAll(_loadedDictionary, UnihanGenderDecided);
        }
    }

    /// <summary>
    /// 인명용 한자 목록 소속(<see cref="HanjaInfo.IsGovernmentListed"/>)을 정하는 공식 CSV — data/ 아래, 어느 쪽에든 있으면 등재.
    /// data-gov.csv(대법원 인명용 한자표, 10,163행)만으로는 50자가 빠진다(2026-10-26 B1 — 검증 2026-10-23 critic gap 1):
    ///   1) ㄴ 구획 절단 32자 — data-gov.csv 의 ㄴ 구획은 '나'~'내'·'냉,랭'(1636행)에서 끝나고 바로 '다'(1637행)다.
    ///      두음 겸용 행(녀,여 · 노,로 · 니,이)은 ㅇ·ㄹ 구획에 따로 있어 살아남았지만, ㄴ 으로만 읽는 노·농·뇌·누·눈·눌·능·니
    ///      글자(努·奴·怒·弩·能·農·濃·腦·惱·訥·嫩·妮 …)는 0행이다. data-naver.csv 는 같은 자리(1410~1625행)에 녀~닐을 싣는다.
    ///   2) 실제 코드포인트가 없는 18자 — 姬(U+59EC)는 姫(U+59EB)로만, 港·珊·冕·慜 등은 같은 독음 자리에 법원 자체 코드
    ///      (U+A0xxx·U+F0xxx, <see cref="IsHanCodePoint"/> 가 거르는 405자)만 있다. 자체 코드와 실제 글자의 대응은 문서 근거가 없어
    ///      잇지 않는다(姬·姫 도 Unihan_Variants 18.0 에 변형 관계가 없다 — 둘 다 사전에 따로 있는 글자). 18자 모두 data-naver.csv 에 있다.
    /// 사전(hanja_dictionary_final.json)이 두 CSV 의 합집합이라 이 규칙이면 적재 글자 전부가 등재다(두 CSV 어디에도 없는 글자 0 —
    /// OpsVerificationRegressionTests 가 CSV 를 직접 읽어 대조). CSV 는 손대지 않는다(공식 자료에 행을 지어 넣지 않는다).
    /// /hanja 의 gov(hanja-seo.json)는 build_hanja_seo_data.py 가 사전 sources 로 따로 정한다 — 같은 규칙으로 맞출 것.
    /// 네이버 CSV 의 호환 한자 행(金 U+F90A '김' 등 111행)은 호환 키에 표시되고 병합 때 통합 키로 OR 된다(없으면 통합 키에 바로).
    /// </summary>
    public static readonly IReadOnlyList<string> GovernmentListCsvFiles = new[] { "data-gov.csv", "data-naver.csv" };

    /// <summary>
    /// 인명용 한자 CSV 파일(<see cref="GovernmentListCsvFiles"/>)에서 한자 목록을 로드하여 IsGovernmentListed 플래그를 설정
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
                // 호환 병합 전이라 사전에 호환 키가 있으면 그 키에(병합이 통합 키로 OR), 없으면 통합 키에 표시한다
                if (_loadedDictionary.TryGetValue(hanjaChar, out var hanjaInfo)
                    || _loadedDictionary.TryGetValue(ToUnifiedHanja(hanjaChar), out hanjaInfo))
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
