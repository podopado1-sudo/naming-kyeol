namespace NameForm.Application.Engines.Data;

/// <summary>
/// 상호 작명 데이터 — 의미 축(axis) 12개 × 업종 프로필 18개.
///
/// 설계: 업종마다 사전을 따로 두면 중복이 폭발하므로, 의미 축 하나에
/// 한자·순우리말·라틴 세 축의 어휘를 함께 묶고 업종은 축을 고르기만 한다.
/// 업종을 추가할 때 새 어휘를 쓸 필요가 없다.
///
/// 한자 독음·뜻을 HanjaData가 아니라 여기에 직접 들고 있는 이유:
/// 인명 사전의 대표 훈은 "이름"에 맞춰 다듬어진 것이라 상호 문장에는 어색하다
/// (예: 味 "맛 미"). 상호용 뜻은 이 파일이 단일 진실의 원천이다.
/// HanjaData는 오행·획수 등 부가 정보 조회에만 쓴다.
/// </summary>
public static class CompanyNamingData
{
    /// <summary>한자 씨앗 — 글자, 독음(본음), 상호용 뜻</summary>
    public record HanjaSeed(string Char, string Reading, string Meaning);

    /// <summary>순우리말 어근 — 표기, 뜻</summary>
    public record KoreanRoot(string Text, string Meaning);

    /// <summary>라틴/그리스 어근 — 로마자 표기, 뜻</summary>
    public record LatinRoot(string Text, string Meaning);

    /// <summary>의미 축</summary>
    public class MeaningAxis
    {
        public string Key { get; init; } = string.Empty;
        public string Label { get; init; } = string.Empty;
        public List<HanjaSeed> Hanja { get; init; } = new();
        public List<KoreanRoot> Korean { get; init; } = new();
        public List<LatinRoot> Latin { get; init; } = new();
    }

    // ============================================================
    // 의미 축 12개
    // ============================================================
    public static readonly Dictionary<string, MeaningAxis> Axes = new()
    {
        ["LIGHT"] = new MeaningAxis
        {
            Key = "LIGHT",
            Label = "빛 · 밝음",
            Hanja = new()
            {
                new("光", "광", "빛"),
                new("明", "명", "밝음"),
                new("昭", "소", "환히 비춤"),
                new("曜", "요", "빛남"),
                new("燦", "찬", "찬란함"),
                new("晟", "성", "밝고 성함"),
                new("旭", "욱", "아침 해"),
                new("暻", "경", "밝음"),
            },
            Korean = new()
            {
                new("빛", "빛"),
                new("볕", "햇볕"),
                new("새벽", "동트는 무렵"),
                new("노을", "저녁 하늘빛"),
                new("아침", "하루의 첫머리"),
            },
            Latin = new()
            {
                new("lum", "빛"),
                new("luce", "빛"),
                new("clar", "맑고 밝음"),
                new("aur", "새벽빛"),
                new("sole", "해"),
            },
        },

        ["WOOD"] = new MeaningAxis
        {
            Key = "WOOD",
            Label = "초목 · 자람",
            Hanja = new()
            {
                new("松", "송", "소나무"),
                new("林", "림", "수풀"),
                new("柏", "백", "잣나무"),
                new("芽", "아", "싹"),
                new("蘭", "란", "난초"),
                new("槿", "근", "무궁화"),
                new("楓", "풍", "단풍"),
                new("榮", "영", "무성하게 자람"),
            },
            Korean = new()
            {
                new("숲", "숲"),
                new("솔", "소나무"),
                new("잎", "잎사귀"),
                new("뜰", "집 앞 뜰"),
                new("움", "돋아나는 싹"),
                new("뿌리", "뿌리"),
            },
            Latin = new()
            {
                new("silva", "숲"),
                new("flor", "꽃"),
                new("verde", "푸름"),
                new("arbo", "나무"),
            },
        },

        ["WATER"] = new MeaningAxis
        {
            Key = "WATER",
            Label = "물 · 흐름",
            Hanja = new()
            {
                new("淸", "청", "맑음"),
                new("泉", "천", "샘"),
                new("潭", "담", "깊은 못"),
                new("津", "진", "나루"),
                new("澄", "징", "티 없이 맑음"),
                new("湖", "호", "호수"),
                new("瀾", "란", "물결"),
                new("洌", "렬", "맑고 참"),
            },
            Korean = new()
            {
                new("샘", "샘물"),
                new("여울", "물살이 빠른 얕은 곳"),
                new("가람", "강"),
                new("물결", "물결"),
                new("이슬", "이슬"),
                new("나루", "건너는 자리"),
            },
            Latin = new()
            {
                new("onda", "물결"),
                new("rivo", "시내"),
                new("mare", "바다"),
                new("fonte", "샘"),
                new("lago", "호수"),
            },
        },

        ["EARTH"] = new MeaningAxis
        {
            Key = "EARTH",
            Label = "터 · 뿌리",
            Hanja = new()
            {
                new("基", "기", "터"),
                new("垈", "대", "집터"),
                new("磐", "반", "반석"),
                new("堂", "당", "번듯한 집"),
                new("原", "원", "너른 벌판"),
                new("峰", "봉", "봉우리"),
                new("岸", "안", "언덕"),
                new("坤", "곤", "땅"),
            },
            Korean = new()
            {
                new("터", "터전"),
                new("마루", "가장 높은 곳"),
                new("들", "들판"),
                new("돌", "바위"),
                new("골", "고을"),
                // '채'는 뒷자리 전용 — 배움채·깨움채는 읽히지만 채길·채결은 말이 안 된다.
                // (KoreanTailRoots에 어미로 들어 있다)
            },
            Latin = new()
            {
                new("terra", "땅"),
                new("campo", "들"),
                new("monte", "산"),
                new("petra", "바위"),
            },
        },

        ["TIME"] = new MeaningAxis
        {
            Key = "TIME",
            Label = "오램 · 한결같음",
            Hanja = new()
            {
                new("久", "구", "오램"),
                new("常", "상", "한결같음"),
                new("永", "영", "길이 이어짐"),
                new("恒", "항", "늘 그러함"),
                new("悠", "유", "유유함"),
                new("承", "승", "이어받음"),
                new("續", "속", "이어짐"),
                new("綿", "면", "끊이지 않음"),
            },
            Korean = new()
            {
                new("늘", "언제나"),
                new("한결", "처음과 끝이 같음"),
                new("오래", "긴 세월"),
                new("이음", "이어감"),
                new("두레", "함께 이어온 품앗이"),
            },
            Latin = new()
            {
                new("dura", "이어짐"),
                new("firma", "굳건함"),
                new("perenne", "끊이지 않음"),
                new("longa", "오램"),
            },
        },

        ["CRAFT"] = new MeaningAxis
        {
            Key = "CRAFT",
            Label = "손길 · 다듬음",
            Hanja = new()
            {
                new("工", "공", "만듦"),
                new("匠", "장", "장인"),
                new("精", "정", "정성"),
                new("練", "련", "익힘"),
                new("藝", "예", "재주"),
                new("琢", "탁", "다듬음"),
                new("織", "직", "짜냄"),
                new("彫", "조", "새김"),
            },
            Korean = new()
            {
                new("결", "결, 무늬"),
                new("손길", "손길"),
                new("매듭", "매듭"),
                new("지음", "지어냄"),
                new("벼림", "벼려 만듦"),
            },
            Latin = new()
            {
                new("arti", "기예"),
                new("forma", "꼴"),
                new("fabri", "장인"),
                new("tecna", "기술"),
            },
        },

        ["WARMTH"] = new MeaningAxis
        {
            Key = "WARMTH",
            Label = "온기 · 환대",
            Hanja = new()
            {
                new("溫", "온", "따뜻함"),
                new("和", "화", "어울림"),
                new("厚", "후", "두터움"),
                new("款", "관", "정성껏 맞음"),
                new("惠", "혜", "베풂"),
                new("寬", "관", "너그러움"),
                new("慈", "자", "자애로움"),
                new("暖", "난", "따사로움"),
            },
            Korean = new()
            {
                new("온", "온전하고 따뜻함"),
                new("품", "품에 안음"),
                new("담", "담아냄"),
                new("도담", "탈 없이 자람"),
                new("곁", "곁"),
                new("포근", "포근함"),
            },
            Latin = new()
            {
                new("cara", "귀함"),
                new("amica", "벗"),
                new("grata", "고마움"),
                new("dolce", "달큰함"),
            },
        },

        ["WISDOM"] = new MeaningAxis
        {
            Key = "WISDOM",
            Label = "슬기 · 앎",
            Hanja = new()
            {
                new("智", "지", "슬기"),
                new("慧", "혜", "지혜"),
                new("叡", "예", "밝은 슬기"),
                new("睿", "예", "깊이 헤아림"),
                new("覺", "각", "깨달음"),
                new("學", "학", "배움"),
                new("思", "사", "생각"),
                new("識", "식", "앎"),
            },
            Korean = new()
            {
                new("슬기", "슬기"),
                new("앎", "아는 것"),
                new("배움", "배움"),
                new("새김", "새겨 둠"),
                new("깨움", "일깨움"),
            },
            Latin = new()
            {
                new("mente", "마음"),
                new("nota", "새겨 앎"),
                new("lucida", "또렷함"),
                new("sensa", "느껴 앎"),
            },
        },

        ["LINK"] = new MeaningAxis
        {
            Key = "LINK",
            Label = "연결 · 사이",
            Hanja = new()
            {
                new("連", "련", "이음"),
                new("緣", "연", "인연"),
                new("結", "결", "맺음"),
                new("交", "교", "사귐"),
                new("共", "공", "함께함"),
                new("隣", "린", "이웃"),
                new("聯", "련", "잇닿음"),
                new("通", "통", "통함"),
            },
            Korean = new()
            {
                new("이음", "이어줌"),
                new("사이", "사이"),
                new("맺음", "맺음"),
                new("나눔", "나눔"),
                new("어울", "어울림"),
                new("모두", "모두"),
            },
            Latin = new()
            {
                new("nesso", "이음"),
                new("junta", "모임"),
                new("liga", "묶음"),
                new("sinta", "어울림"),
            },
        },

        ["HARVEST"] = new MeaningAxis
        {
            Key = "HARVEST",
            Label = "결실 · 풍요",
            Hanja = new()
            {
                new("豊", "풍", "풍성함"),
                new("實", "실", "열매"),
                new("稔", "임", "익음"),
                new("盛", "성", "성함"),
                new("裕", "유", "넉넉함"),
                new("穰", "양", "풍년"),
                new("饒", "요", "넉넉함"),
                new("碩", "석", "크고 알참"),
            },
            Korean = new()
            {
                new("열매", "열매"),
                new("알", "알찬 알갱이"),
                new("거둠", "거둬들임"),
                new("이삭", "여문 이삭"),
                new("넉넉", "넉넉함"),
            },
            Latin = new()
            {
                new("fruta", "열매"),
                new("plena", "가득"),
                new("messe", "거둠"),
                new("grana", "알"),
            },
        },

        ["CALM"] = new MeaningAxis
        {
            Key = "CALM",
            Label = "고요 · 여백",
            Hanja = new()
            {
                new("靜", "정", "고요"),
                new("安", "안", "편안"),
                new("寧", "녕", "평안"),
                new("閑", "한", "한가로움"),
                new("穩", "온", "평온"),
                new("澹", "담", "담박함"),
                new("素", "소", "꾸밈없음"),
                new("餘", "여", "여백"),
            },
            Korean = new()
            {
                new("고요", "고요함"),
                new("쉼", "쉬어 감"),
                new("여백", "비워 둔 자리"),
                new("숨결", "숨결"),
                new("사이", "사이"),
            },
            Latin = new()
            {
                new("sereno", "고요"),
                new("pausa", "멈춤"),
                new("lento", "느림"),
                new("silente", "조용함"),
            },
        },

        ["START"] = new MeaningAxis
        {
            Key = "START",
            Label = "새로움 · 처음",
            Hanja = new()
            {
                new("新", "신", "새로움"),
                new("初", "초", "처음"),
                new("創", "창", "지어냄"),
                new("始", "시", "비롯함"),
                new("曙", "서", "새벽빛"),
                new("興", "흥", "일어남"),
                new("發", "발", "피어남"),
                new("開", "개", "엶"),
            },
            Korean = new()
            {
                new("새", "새로움"),
                new("처음", "처음"),
                new("틔움", "틔워 냄"),
                new("돋음", "돋아남"),
                new("첫", "첫"),
            },
            Latin = new()
            {
                new("nova", "새로움"),
                new("prima", "처음"),
                new("orto", "돋음"),
                new("crea", "지어냄"),
            },
        },
    };

    // ============================================================
    // 업종 프로필 18개
    // ============================================================
    public class IndustryProfile
    {
        public string Key { get; init; } = string.Empty;
        public string Label { get; init; } = string.Empty;

        /// <summary>이 업종이 끌어다 쓰는 의미 축 (앞쪽일수록 비중 높음)</summary>
        public List<string> AxisKeys { get; init; } = new();

        /// <summary>상호 뒤에 붙는 말 — 사용 예시 조립용 (예: "온담 카페")</summary>
        public List<string> Suffixes { get; init; } = new();

        /// <summary>
        /// 업종 일반어 — 상호에 그대로 들어가면 식별력이 떨어진다.
        /// 상표법상 기술적 표장은 등록이 어렵고, 검색에서도 경쟁 상호에 묻힌다.
        /// </summary>
        public List<string> GenericWords { get; init; } = new();
    }

    public static readonly Dictionary<string, IndustryProfile> Industries = new()
    {
        ["cafe"] = new()
        {
            Key = "cafe", Label = "카페 · 디저트",
            AxisKeys = new() { "WARMTH", "CALM", "LIGHT", "TIME" },
            Suffixes = new() { "카페", "커피", "로스터스" },
            GenericWords = new() { "커피", "카페", "원두", "로스팅", "브루", "라떼", "에스프레소", "빈" },
        },
        ["food"] = new()
        {
            Key = "food", Label = "음식점 · 외식",
            AxisKeys = new() { "HARVEST", "CRAFT", "WARMTH", "EARTH" },
            Suffixes = new() { "식당", "키친", "밥상" },
            GenericWords = new() { "맛집", "식당", "키친", "미식", "요리", "주방", "푸드", "다이닝" },
        },
        ["bakery"] = new()
        {
            Key = "bakery", Label = "베이커리 · 제과",
            AxisKeys = new() { "HARVEST", "CRAFT", "WARMTH", "START" },
            Suffixes = new() { "베이커리", "제과", "빵집" },
            GenericWords = new() { "베이커리", "제과", "브레드", "케이크", "오븐", "파티세리" },
        },
        ["beauty"] = new()
        {
            Key = "beauty", Label = "뷰티 · 미용",
            AxisKeys = new() { "LIGHT", "CALM", "WATER", "CRAFT" },
            Suffixes = new() { "헤어", "살롱", "뷰티" },
            GenericWords = new() { "헤어", "뷰티", "미용", "살롱", "네일", "에스테틱", "스킨" },
        },
        ["fashion"] = new()
        {
            Key = "fashion", Label = "패션 · 의류",
            AxisKeys = new() { "CRAFT", "LIGHT", "CALM", "START" },
            Suffixes = new() { "스튜디오", "아뜰리에", "상점" },
            GenericWords = new() { "패션", "의류", "웨어", "클로짓", "스타일", "룩" },
        },
        ["it"] = new()
        {
            Key = "it", Label = "IT · 소프트웨어",
            AxisKeys = new() { "WISDOM", "LINK", "START", "LIGHT" },
            Suffixes = new() { "랩", "테크", "주식회사" },
            GenericWords = new() { "테크", "랩", "소프트", "디지털", "데이터", "시스템", "솔루션", "아이티" },
        },
        ["edu"] = new()
        {
            Key = "edu", Label = "교육 · 학원",
            AxisKeys = new() { "WISDOM", "WOOD", "START", "TIME" },
            Suffixes = new() { "학원", "교육", "아카데미" },
            GenericWords = new() { "학원", "교육", "아카데미", "스쿨", "러닝", "에듀" },
        },
        ["health"] = new()
        {
            Key = "health", Label = "병원 · 의원",
            AxisKeys = new() { "WATER", "CALM", "WARMTH", "TIME" },
            Suffixes = new() { "의원", "한의원", "치과", "클리닉" },
            GenericWords = new() { "의원", "병원", "클리닉", "메디", "케어", "헬스" },
        },
        ["wellness"] = new()
        {
            Key = "wellness", Label = "운동 · 필라테스",
            AxisKeys = new() { "EARTH", "CALM", "START", "WATER" },
            Suffixes = new() { "필라테스", "스튜디오", "요가" },
            GenericWords = new() { "짐", "피트니스", "필라테스", "요가", "헬스", "바디" },
        },
        ["retail"] = new()
        {
            Key = "retail", Label = "소매 · 편집숍",
            AxisKeys = new() { "HARVEST", "CALM", "CRAFT", "LIGHT" },
            Suffixes = new() { "상점", "스토어", "마켓" },
            GenericWords = new() { "마트", "스토어", "샵", "상점", "몰", "마켓" },
        },
        ["interior"] = new()
        {
            Key = "interior", Label = "인테리어 · 건축",
            AxisKeys = new() { "EARTH", "CRAFT", "CALM", "WOOD" },
            Suffixes = new() { "디자인", "건축", "공간" },
            GenericWords = new() { "인테리어", "디자인", "건축", "공간", "하우스", "홈" },
        },
        ["consulting"] = new()
        {
            Key = "consulting", Label = "컨설팅 · 전문서비스",
            AxisKeys = new() { "WISDOM", "LINK", "TIME", "EARTH" },
            Suffixes = new() { "파트너스", "컨설팅", "주식회사" },
            GenericWords = new() { "컨설팅", "파트너스", "어드바이저", "매니지먼트", "그룹" },
        },
        ["culture"] = new()
        {
            Key = "culture", Label = "문화 · 공방",
            AxisKeys = new() { "CRAFT", "CALM", "WOOD", "TIME" },
            Suffixes = new() { "공방", "스튜디오", "서재" },
            GenericWords = new() { "공방", "스튜디오", "아트", "갤러리", "문화" },
        },
        ["pet"] = new()
        {
            Key = "pet", Label = "반려동물",
            AxisKeys = new() { "WARMTH", "WOOD", "LINK", "START" },
            Suffixes = new() { "동물병원", "펫샵", "살롱" },
            GenericWords = new() { "펫", "동물", "반려", "애견", "독", "캣" },
        },
        ["travel"] = new()
        {
            Key = "travel", Label = "여행 · 숙박",
            AxisKeys = new() { "WATER", "CALM", "EARTH", "START" },
            Suffixes = new() { "스테이", "게스트하우스", "여행" },
            GenericWords = new() { "여행", "투어", "스테이", "호텔", "펜션", "트래블" },
        },
        ["agri"] = new()
        {
            Key = "agri", Label = "농수산 · 식품제조",
            AxisKeys = new() { "HARVEST", "EARTH", "WATER", "TIME" },
            Suffixes = new() { "농장", "식품", "주식회사" },
            GenericWords = new() { "농장", "식품", "팜", "농산", "수산", "푸드" },
        },
        ["finance"] = new()
        {
            Key = "finance", Label = "금융 · 투자",
            AxisKeys = new() { "TIME", "EARTH", "HARVEST", "WISDOM" },
            Suffixes = new() { "자산운용", "인베스트", "주식회사" },
            GenericWords = new() { "금융", "자산", "인베스트", "캐피탈", "펀드", "파이낸스" },
        },
        ["law"] = new()
        {
            Key = "law", Label = "법률 · 세무",
            AxisKeys = new() { "TIME", "EARTH", "WISDOM", "LINK" },
            Suffixes = new() { "법률사무소", "세무회계", "노무법인" },
            GenericWords = new() { "법률", "세무", "회계", "법무", "로펌" },
        },
    };

    // ============================================================
    // 톤 프로필 — 축 가중치와 생성 스타일 선호
    // ============================================================
    public class ToneProfile
    {
        public string Key { get; init; } = string.Empty;
        public string Label { get; init; } = string.Empty;

        /// <summary>이 톤이 선호하는 축 (가점)</summary>
        public HashSet<string> FavoredAxes { get; init; } = new();

        /// <summary>이 톤이 선호하는 생성 축 (가점)</summary>
        public HashSet<string> FavoredStyles { get; init; } = new();
    }

    public static readonly Dictionary<string, ToneProfile> Tones = new()
    {
        ["modern"] = new()
        {
            Key = "modern", Label = "모던",
            FavoredAxes = new() { "START", "LINK", "WISDOM", "LIGHT" },
            FavoredStyles = new() { "english", "pure-korean" },
        },
        ["classic"] = new()
        {
            Key = "classic", Label = "클래식",
            FavoredAxes = new() { "TIME", "EARTH", "CRAFT", "WOOD" },
            FavoredStyles = new() { "hanja" },
        },
        ["warm"] = new()
        {
            Key = "warm", Label = "따뜻함",
            FavoredAxes = new() { "WARMTH", "WOOD", "HARVEST" },
            FavoredStyles = new() { "pure-korean" },
        },
        ["premium"] = new()
        {
            Key = "premium", Label = "프리미엄",
            FavoredAxes = new() { "CALM", "CRAFT", "TIME", "LIGHT" },
            FavoredStyles = new() { "hanja", "english" },
        },
        ["playful"] = new()
        {
            Key = "playful", Label = "경쾌함",
            FavoredAxes = new() { "START", "LIGHT", "WOOD", "LINK" },
            FavoredStyles = new() { "pure-korean", "english" },
        },
    };

    // ============================================================
    // 결합 규칙 재료
    // ============================================================

    /// <summary>
    /// 검수된 한자쌍 — 한자 축은 자유 순열을 쓰지 않는다.
    ///
    /// 한국어는 음절 수가 적어 임의의 한자 2자 조합이 기존 한자어와 동음이 될 확률이 높다.
    /// 실제로 자유 순열을 돌렸을 때 도달 가능한 표기가 1,797개였고 그 안에
    /// 久續(구속) · 工匠(공장) · 安靜(안정) · 素明(소명) 같은 충돌이 섞여 나왔다.
    /// 법률사무소 후보로 '구속'이 올라오는 종류의 사고는 감점으로 막을 수 없다.
    ///
    /// 그래서 조합을 만들지 않고 고른다. 각 쌍은 세 기준을 통과한 것만 싣는다:
    ///   1) 한글 표기가 기존 한국어 단어·유명 고유명사와 겹치지 않을 것
    ///   2) 표기와 발음이 갈라지지 않을 것 — 받침 뒤 ㄹ초성 금지 (아래 참조)
    ///   3) 두 글자가 상호로 읽었을 때 뜻이 이어질 것
    /// 독음·뜻·의미 축은 Axes에서 글자로 되찾으므로 여기서는 글자쌍만 관리한다.
    ///
    /// ⚠️ 기준 2가 가장 놓치기 쉽다. 받침 있는 앞글자 뒤에 ㄹ로 시작하는 글자가 오면
    /// 유음화·비음화가 예외 없이 일어나 쓴 글자와 들리는 소리가 달라진다:
    ///   溫林 "온림" → [올림]   旭林 "욱림" → [웅님]   澹林 "담림" → [담님]
    ///   溫隣 "온린" → [올린]   澹隣 "담린" → [달린]   松隣 "송린" → [송닌]
    /// 상호는 듣고 받아적어 검색하는 이름이라, 표기를 복원할 수 없으면 이름을 잃는다.
    /// 이 규칙은 CompanyNamingEngineTests가 기계적으로 검사하므로 어기면 테스트가 깨진다.
    ///
    /// 2026-08-28 검수에서 제외한 14쌍 (같은 쌍을 다시 넣지 말 것):
    ///   발음 변동  溫林 旭林 澹林 溫隣 澹隣 松隣 承隣
    ///   고유명사   澹原(담원 게이밍) 燦原(가수 이찬원)
    ///   기존 어휘  素潭(소담하다 — 요식업 상호 포화) 久智(구지 — '굳이'의 흔한 오기)
    ///   근접 동음  智恒(지향) 峰恒(봉황) 澹豊(단풍)
    /// </summary>
    public static readonly (string Head, string Tail)[] HanjaPairs =
    {
        // 물 — 潭(깊은 못) · 泉(샘)
        ("悠", "潭"), ("永", "潭"), ("承", "潭"), ("久", "潭"), ("原", "潭"),
        ("松", "潭"), ("曙", "潭"), ("溫", "潭"), ("澄", "潭"),
        ("松", "泉"), ("澹", "泉"), ("芽", "泉"), ("悠", "泉"),

        // 터 — 原(벌판) · 峰(봉우리)
        ("松", "原"), ("芽", "原"), ("旭", "原"),
        ("承", "原"), ("覺", "原"),
        ("曙", "峰"), ("松", "峰"), ("澹", "峰"), ("旭", "峰"), ("淸", "峰"),
        ("悠", "峰"), ("恒", "峰"), ("承", "峰"), ("久", "峰"), ("智", "峰"),
        ("津", "峰"), ("泉", "峰"),

        // 초목 — 林(수풀) · 松(소나무) · 槿(무궁화) · 芽(싹)
        ("曙", "林"), ("芽", "林"), 
        ("悠", "松"), ("澹", "松"), ("恒", "松"), ("曙", "松"), ("原", "松"),
        ("津", "松"), ("泉", "松"),
        ("溫", "槿"), ("曙", "槿"), ("悠", "槿"),
        ("曙", "芽"), ("燦", "芽"),

        // 손길 — 藝(재주) · 琢(다듬음) · 織(짜냄)
        ("溫", "藝"), ("澹", "藝"), ("燦", "藝"), ("松", "藝"), ("峰", "藝"),
        ("淸", "藝"), ("津", "藝"),
        ("溫", "琢"), ("悠", "琢"), ("曙", "琢"), ("澹", "琢"), ("峰", "琢"),
        ("溫", "織"), ("曙", "織"), ("澹", "織"), ("悠", "織"),

        // 온기 — 惠(베풂) · 溫(따뜻함) · 穩(평온)
        ("溫", "惠"), ("澹", "惠"), ("松", "惠"), ("悠", "惠"), ("峰", "惠"),
        ("淸", "惠"), ("津", "惠"), ("原", "惠"),
        ("曙", "溫"), ("松", "溫"), ("芽", "溫"), ("澹", "穩"),

        // 오램 — 恒(늘) · 承(이어받음)
        ("溫", "恒"), ("曙", "恒"), ("松", "恒"), 
        ("溫", "承"), ("澹", "承"), ("智", "承"),

        // 결실 — 裕(넉넉함) · 實(열매) · 豊(풍성함)
        ("曙", "裕"), ("澹", "裕"), ("燦", "裕"),
        ("澹", "實"), ("松", "實"), ("燦", "實"), ("峰", "實"), ("淸", "實"),
        ("槿", "豊"), ("悠", "豊"),

        // 슬기 — 智(슬기) · 學(배움) · 覺(깨달음)
        ("溫", "智"), ("澹", "智"), ("松", "智"), ("燦", "智"), ("恒", "智"),
        ("結", "智"), ("淸", "智"),
        ("溫", "學"), ("澹", "學"), ("燦", "學"), ("槿", "學"), ("恒", "學"),
        ("承", "學"), ("峰", "學"),
        ("曙", "覺"), ("澹", "覺"), ("悠", "覺"), ("恒", "覺"), ("承", "覺"),
        ("峰", "覺"),

        // 연결 — 隣(이웃) · 結(맺음)

        ("溫", "結"), ("曙", "結"), ("松", "結"), ("悠", "結"), ("恒", "結"),
        ("承", "結"), ("智", "結"),

        // 새로움 — 初(처음) · 創(지어냄) · 興(일어남)
        ("溫", "初"), ("澹", "初"), ("松", "初"), ("燦", "初"), ("峰", "初"),
        ("曙", "創"), ("澹", "創"), ("松", "創"),
        ("溫", "興"), ("曙", "興"), ("澹", "興"),
    };

    /// <summary>글자 → (씨앗, 의미 축) 역인덱스 — 검수 쌍에서 독음·뜻·축을 되찾는다</summary>
    public static readonly Dictionary<string, (HanjaSeed Seed, string AxisKey)> HanjaIndex =
        Axes.Values
            .SelectMany(axis => axis.Hanja.Select(seed => (seed, axis.Key)))
            .GroupBy(x => x.seed.Char)
            .ToDictionary(g => g.Key, g => (g.First().seed, g.First().Key), StringComparer.Ordinal);

    /// <summary>
    /// 순우리말 조어의 뒷자리 어미.
    ///
    /// 앞자리는 축의 어근을 그대로 쓰지만 뒷자리는 이 목록으로 제한한다.
    /// 앞자리에서 잘 읽히는 어근이 뒷자리에서도 읽히는 것은 아니기 때문이다
    /// ('깨움'은 앞에서는 멀쩡하지만 '골깨움'이 되면 상호로 읽히지 않는다).
    /// 각 어미에 의미 축을 달아 뜻 문장을 앞자리 축과 이어 붙인다.
    /// </summary>
    public static readonly List<(KoreanRoot Root, string AxisKey)> KoreanTailRoots = new()
    {
        (new("담", "담아내는 자리"), "WARMTH"),
        (new("온", "온전함"), "WARMTH"),
        (new("품", "품에 안음"), "WARMTH"),
        (new("터", "터전"), "EARTH"),
        (new("채", "집채"), "EARTH"),
        (new("마루", "가장 높은 곳"), "EARTH"),
        (new("결", "결이 고움"), "CRAFT"),
        (new("뜰", "뜰"), "WOOD"),
        (new("솔", "소나무"), "WOOD"),
        (new("숲", "숲"), "WOOD"),
        (new("샘", "샘"), "WATER"),
        (new("빛", "빛"), "LIGHT"),
        (new("길", "길"), "LINK"),
        (new("누리", "온 세상"), "LINK"),
        (new("우리", "울타리 안"), "LINK"),
    };

    /// <summary>
    /// 라틴 조어 접미 — 어근 뒤에 붙어 브랜드 어감을 만든다.
    /// "-um"은 뺐다: 한글 음차가 '-움/-숨/-붐'이 되어 한국어 상호로 읽히지 않는다.
    /// </summary>
    public static readonly string[] LatinSuffixes =
    {
        "a", "o", "ia", "on", "en", "is", "na", "ra", "to",
    };

    /// <summary>
    /// 상호 클리셰 — 들어가면 식별력이 크게 깎인다.
    /// 동종업계에 이미 수천 개가 존재해 검색에서도 상표에서도 불리하다.
    /// </summary>
    public static readonly HashSet<string> ClicheParts = new(StringComparer.Ordinal)
    {
        "나라", "마트", "플러스", "하우스", "월드", "랜드", "킹", "프라임",
        "베스트", "스마트", "골드", "굿", "파크", "시티", "타운", "앤컴퍼니",
        "코리아", "글로벌", "토탈", "메가", "슈퍼", "퍼스트", "노블", "로얄",
        "새누리", // 정당명 연상이 강해 상호로 쓰기 어렵다
    };

    /// <summary>
    /// 단독으로 쓰면 식별력이 약한 일반명사.
    /// 상표 등록이 어렵고("하늘"은 이미 수백 건), 검색에서도 일반 정보에 묻힌다.
    /// 조어의 재료로 쓰이는 것은 문제가 없어 단독 사용만 감점한다.
    /// </summary>
    public static readonly HashSet<string> BareCommonNouns = new(StringComparer.Ordinal)
    {
        "하늘", "바다", "사랑", "행복", "미소", "자연", "소망", "희망", "우리",
        "봄", "여름", "가을", "겨울", "아침", "저녁", "별", "달", "해", "꽃",
        "나무", "바람", "구름", "사람", "친구", "가족", "마음", "생각",

        // 어근 두 개를 이었는데 결과가 이미 존재하는 일반명사인 경우 —
        // 조어처럼 보이지만 실제로는 사전에 있는 말이라 식별력이 없다
        "쉼터", "나루터", "온누리", "들길", "숲길", "돌담", "뜰채", "샘터",
        "솔밭", "물길", "뱃길", "돌솔", "잎새", "배움터", "일터", "삶터",
    };

    // ============================================================
    // 뜻 문장 조립 — 축이 앞자리면 부사구, 뒷자리면 명사구를 낸다.
    // 두 축을 뽑아 "{앞축 부사구} {뒷축 명사구}" 로 이으면
    // 144개 조합이 전부 자연스러운 한 문장이 된다.
    // ============================================================

    /// <summary>축이 앞자리일 때의 부사구</summary>
    public static readonly Dictionary<string, string> AxisHeadPhrase = new()
    {
        ["LIGHT"] = "빛처럼",
        ["WOOD"] = "푸르게",
        ["WATER"] = "맑게",
        ["EARTH"] = "단단히",
        ["TIME"] = "한결같이",
        ["CRAFT"] = "정성껏",
        ["WARMTH"] = "따뜻하게",
        ["WISDOM"] = "슬기롭게",
        ["LINK"] = "촘촘히",
        ["HARVEST"] = "넉넉히",
        ["CALM"] = "고요히",
        ["START"] = "새롭게",
    };

    /// <summary>축이 뒷자리일 때의 명사구</summary>
    public static readonly Dictionary<string, string> AxisTailPhrase = new()
    {
        ["LIGHT"] = "빛나는 곳",
        ["WOOD"] = "자라는 곳",
        ["WATER"] = "흐르는 곳",
        ["EARTH"] = "뿌리내린 곳",
        ["TIME"] = "이어지는 곳",
        ["CRAFT"] = "다듬는 곳",
        ["WARMTH"] = "맞이하는 곳",
        ["WISDOM"] = "익히는 곳",
        ["LINK"] = "잇는 곳",
        ["HARVEST"] = "여무는 곳",
        ["CALM"] = "머무는 곳",
        ["START"] = "시작하는 곳",
    };

    /// <summary>업종 목록 (프론트 셀렉트 구성용)</summary>
    public static IEnumerable<IndustryProfile> AllIndustries => Industries.Values;

    /// <summary>업종 코드 유효성</summary>
    public static bool IsValidIndustry(string? key) =>
        !string.IsNullOrWhiteSpace(key) && Industries.ContainsKey(key);

    /// <summary>톤 코드 유효성</summary>
    public static bool IsValidTone(string? key) =>
        !string.IsNullOrWhiteSpace(key) && Tones.ContainsKey(key);
}
