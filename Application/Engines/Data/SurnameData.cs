namespace NameForm.Application.Engines.Data;

/// <summary>
/// 한국 성씨 메타데이터
/// 복성(남궁, 독고), 희귀성(봉, 빈) 등 다양한 성씨 유형 지원
/// </summary>
public static class SurnameData
{
    public enum SurnameType
    {
        /// <summary>일반 1자 성씨 (김, 이, 박 등)</summary>
        Standard,
        /// <summary>복성 2자 (남궁, 독고, 사공 등)</summary>
        TwoChar,
        /// <summary>희귀 1자 성씨 (봉, 빈, 탁 등)</summary>
        Rare
    }

    public class SurnameInfo
    {
        public string Surname { get; set; } = string.Empty;
        public SurnameType Type { get; set; }
        public int SyllableCount { get; set; }

        /// <summary>초성 (발음 리듬 판단용)</summary>
        public string LeadConsonant { get; set; } = string.Empty;

        /// <summary>받침 유무 (발음 흐름 판단용)</summary>
        public bool HasFinalConsonant { get; set; }
    }

    /// <summary>복성 목록</summary>
    private static readonly HashSet<string> TwoCharSurnames = new()
    {
        "남궁", "독고", "동방", "사공", "서문", "선우", "제갈",
        "황보", "강전", "망절"
    };

    /// <summary>희귀 1자 성씨</summary>
    private static readonly HashSet<string> RareSurnames = new()
    {
        "봉", "빈", "탁", "판", "편", "필", "하", "해", "호",
        "국", "궁", "궉", "근", "금", "기", "길", "나", "남",
        "내", "노", "뇌", "단", "담", "도", "돈", "동", "두",
        "라", "로", "마", "맹", "모", "묘", "묵", "미", "민",
        "반", "방", "배", "백", "범", "변", "복", "부", "비",
        "사", "삼", "상", "서", "석", "선", "설", "섭", "성",
        "소", "손", "승", "시", "신", "심", "아", "안", "애",
        "양", "엄", "어", "여", "연", "염", "예", "옥", "옹",
        "완", "왕", "요", "용", "우", "원", "위", "유", "육",
        "윤", "은", "음", "이", "인", "임", "자", "장", "전",
        "정", "조", "종", "주", "증", "지", "진", "차", "채",
        "천", "초", "추", "탄", "태", "하", "한", "함", "해",
        "허", "현", "형", "호", "홍", "화", "환", "황", "후"
    };

    /// <summary>가장 흔한 성씨 (상위 50)</summary>
    private static readonly HashSet<string> CommonSurnames = new()
    {
        "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
        "한", "오", "서", "신", "권", "황", "안", "송", "류", "전",
        "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남",
        "심", "노", "하", "곽", "성", "차", "주", "우", "구", "민",
        "원", "진", "나", "지", "함", "엄", "채", "변", "천", "방"
    };

    /// <summary>
    /// 성씨 정보 조회
    /// </summary>
    public static SurnameInfo GetInfo(string surname)
    {
        if (string.IsNullOrEmpty(surname))
            return new SurnameInfo { Surname = surname, Type = SurnameType.Standard, SyllableCount = 1 };

        var type = SurnameType.Standard;
        if (TwoCharSurnames.Contains(surname))
            type = SurnameType.TwoChar;
        else if (surname.Length == 1 && !CommonSurnames.Contains(surname))
            type = SurnameType.Rare;

        // 마지막 음절의 받침 확인
        var lastChar = surname[^1];
        bool hasFinal = false;
        if (lastChar >= 0xAC00 && lastChar <= 0xD7A3)
        {
            var code = lastChar - 0xAC00;
            hasFinal = (code % 28) != 0; // 받침이 0이 아니면 받침 있음
        }

        // 첫 음절의 초성
        var firstChar = surname[0];
        string leadConsonant = "";
        if (firstChar >= 0xAC00 && firstChar <= 0xD7A3)
        {
            var code = firstChar - 0xAC00;
            var consonantIndex = code / (21 * 28);
            var consonants = new[] { "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };
            if (consonantIndex < consonants.Length)
                leadConsonant = consonants[consonantIndex];
        }

        return new SurnameInfo
        {
            Surname = surname,
            Type = type,
            SyllableCount = surname.Length,
            LeadConsonant = leadConsonant,
            HasFinalConsonant = hasFinal
        };
    }

    /// <summary>
    /// 성씨 유형별 권장 이름 글자 수
    /// 전체 이름(성+이름)이 자연스러운 3~4음절이 되도록 조정
    /// </summary>
    public static (int min, int max) GetRecommendedNameLength(string surname)
    {
        var info = GetInfo(surname);
        return info.Type switch
        {
            SurnameType.TwoChar => (1, 2),  // 남궁+서 (3), 남궁+서연 (4)
            SurnameType.Rare => (2, 3),      // 봉+민준 (3), 봉+서연아 (4) — 희귀성씨는 풀네임이 짧으면 특색있음
            SurnameType.Standard => (2, 3),  // 김+민준 (3), 김+서연이 (4)
            _ => (2, 3)
        };
    }

    /// <summary>
    /// 성씨가 복성인지 확인
    /// </summary>
    public static bool IsTwoCharSurname(string surname) => TwoCharSurnames.Contains(surname);

    /// <summary>
    /// 성씨가 희귀한지 확인
    /// </summary>
    public static bool IsRareSurname(string surname) =>
        surname.Length == 1 && !CommonSurnames.Contains(surname);

    // ── 성씨 대표 한자 (2026-10-22 S5a, 감사 BT-3 — 계획 docs/plan-radical-ohaeng-2026-10.md §5 4c) ──────────────
    // 수리사격(HarmonyEngine)의 성씨 획수용. 평가 입력에 성씨 한자가 없어, 예전에는 성씨 독음으로 관련도 1순위 한자를 골랐다
    // (이 → 11획 글자, 박 → 16획, 윤 → 15획, 남궁 → 첫 글자 '남'만). 같은 독음 성씨 가운데 인구가 가장 많은 한자를 쓴다
    // (이 李·박 朴·정 鄭·조 趙·유/류 柳·임/림 林). 복성은 두 글자(획수는 합).
    // 출발점은 CreativeNamingEngine.SurnameMeanings 의 한자(성씨 뜻 풀이용)다. 그 표와 다른 곳은 넷뿐이고
    // Tests/SurnameStrokeTests 가 이유와 함께 고정한다: 유 柳(창작 표 劉 — 柳 문화·진주 류씨가 더 많다), 모 牟(창작 표 毛 — 함평 모씨),
    // 배 裵(창작 표 裴 — 한국 배씨 표기), 상 尙(창작 표 尚 — 사전에 없는 꼴). 두음 표기(리·라·림·로·량·려·렴·룡·뇌)는 같은 한자.
    // 이 파일의 복성 10개는 모두 표에 있다(일본계 희성 강전 岡田·망절 網切 포함 — 한자가 하나뿐인 성씨). 창작 표의 소봉(小峯)은
    // 복성 목록(TwoCharSurnames)에 없어 넣지 않았다 — 목록에 더할 때 함께 정한다. 표에 없는 입력만 음절마다 독음 1순위 한자로 추정한다.
    private static readonly Dictionary<string, string> RepresentativeHanjaMap = new()
    {
        // 상위 성씨 (인구순에 가깝게)
        ["김"] = "金", ["이"] = "李", ["박"] = "朴", ["최"] = "崔", ["정"] = "鄭", ["강"] = "姜", ["조"] = "趙", ["윤"] = "尹",
        ["장"] = "張", ["임"] = "林", ["한"] = "韓", ["오"] = "吳", ["서"] = "徐", ["신"] = "申", ["권"] = "權", ["황"] = "黃",
        ["안"] = "安", ["송"] = "宋", ["전"] = "全", ["홍"] = "洪", ["유"] = "柳", ["류"] = "柳", ["고"] = "高", ["문"] = "文",
        ["양"] = "梁", ["손"] = "孫", ["배"] = "裵", ["백"] = "白", ["허"] = "許", ["남"] = "南", ["심"] = "沈", ["노"] = "盧",
        ["하"] = "河", ["곽"] = "郭", ["성"] = "成", ["차"] = "車", ["주"] = "朱", ["우"] = "禹", ["구"] = "具", ["민"] = "閔",
        ["나"] = "羅", ["진"] = "陳", ["지"] = "池", ["엄"] = "嚴", ["채"] = "蔡", ["원"] = "元", ["천"] = "千", ["방"] = "方",
        ["공"] = "孔", ["현"] = "玄", ["함"] = "咸", ["변"] = "卞", ["염"] = "廉", ["여"] = "呂", ["추"] = "秋", ["도"] = "都",
        ["소"] = "蘇", ["석"] = "石", ["선"] = "宣", ["설"] = "薛", ["마"] = "馬", ["길"] = "吉", ["연"] = "延", ["위"] = "魏",
        ["표"] = "表", ["명"] = "明", ["기"] = "奇", ["반"] = "潘", ["왕"] = "王", ["금"] = "琴", ["옥"] = "玉", ["육"] = "陸",
        ["인"] = "印", ["맹"] = "孟", ["제"] = "諸", ["모"] = "牟", ["탁"] = "卓", ["국"] = "鞠", ["어"] = "魚", ["은"] = "殷",
        ["편"] = "片", ["용"] = "龍", ["예"] = "芮", ["경"] = "慶", ["봉"] = "奉", ["부"] = "夫", ["가"] = "賈", ["복"] = "卜",
        ["태"] = "太", ["목"] = "睦", ["형"] = "邢", ["계"] = "桂", ["피"] = "皮", ["두"] = "杜", ["감"] = "甘", ["음"] = "陰",
        ["빈"] = "賓", ["동"] = "董", ["온"] = "溫", ["호"] = "扈", ["범"] = "范", ["좌"] = "左", ["팽"] = "彭", ["승"] = "承",
        ["간"] = "簡", ["상"] = "尙", ["시"] = "施", ["옹"] = "邕",
        // 드문 성씨 (창작 표 그대로)
        ["사"] = "謝", ["비"] = "丕", ["순"] = "荀", ["갈"] = "葛", ["견"] = "甄", ["곡"] = "曲", ["관"] = "管", ["근"] = "斤",
        ["단"] = "段", ["담"] = "譚", ["당"] = "唐", ["대"] = "大", ["돈"] = "頓", ["등"] = "鄧", ["랑"] = "浪", ["뢰"] = "雷",
        ["매"] = "梅", ["묵"] = "墨", ["미"] = "米", ["빙"] = "氷", ["섭"] = "葉", ["수"] = "水", ["식"] = "植", ["아"] = "阿",
        ["운"] = "雲", ["점"] = "占", ["학"] = "郝", ["해"] = "海", ["판"] = "判", ["필"] = "畢", ["화"] = "花", ["초"] = "楚",
        ["무"] = "武", ["풍"] = "馮",
        // 두음 표기
        ["리"] = "李", ["라"] = "羅", ["림"] = "林", ["로"] = "盧", ["량"] = "梁", ["려"] = "呂", ["렴"] = "廉", ["룡"] = "龍",
        ["뇌"] = "雷",
        // 복성
        ["남궁"] = "南宮", ["사공"] = "司空", ["제갈"] = "諸葛", ["황보"] = "皇甫", ["선우"] = "鮮于", ["독고"] = "獨孤",
        ["동방"] = "東方", ["서문"] = "西門", ["강전"] = "岡田", ["망절"] = "網切",
    };

    /// <summary>성씨(한글) → 대표 한자(복성은 두 글자). 읽기 전용.</summary>
    public static IReadOnlyDictionary<string, string> RepresentativeHanja => RepresentativeHanjaMap;

    /// <summary>
    /// 성씨 획수와 그 근거 한자. Hanja 는 획수를 센 한자(표에 없으면 음절마다 고른 추정 한자), FromTable 은 대표 한자 표에서 왔는지.
    /// Strokes 0 = 획수를 정하지 못함(수리사격이 '획수 불명'으로 센다).
    /// </summary>
    public readonly record struct SurnameStrokes(int Strokes, string Hanja, bool FromTable);

    /// <summary>
    /// 성씨 획수 — 대표 한자 표의 한자 획수(HanjaData.StrokeCount, 복성은 두 글자 합).
    /// 표에 없는 성씨는 음절마다 독음 관련도 1순위 한자(획수 있는 글자)의 획수를 더한다(옛 방식 — 추정).
    /// 한 글자라도 획수를 못 정하면 Strokes 0.
    /// </summary>
    public static SurnameStrokes ResolveStrokes(string? surname)
    {
        var s = surname?.Trim() ?? string.Empty;
        if (s.Length == 0) return new SurnameStrokes(0, string.Empty, false);

        if (RepresentativeHanjaMap.TryGetValue(s, out var hanja))
        {
            int total = 0;
            foreach (var ch in hanja)
            {
                int n = HanjaData.FindByCharacter(ch.ToString())?.StrokeCount ?? 0;
                if (n <= 0) return new SurnameStrokes(0, hanja, true);
                total += n;
            }
            return new SurnameStrokes(total, hanja, true);
        }

        int sum = 0;
        var picked = new System.Text.StringBuilder();
        foreach (var syllable in s)
        {
            var best = HanjaData.SortByRelevance(HanjaData.FindByReading(syllable.ToString()))
                .FirstOrDefault(h => h.StrokeCount > 0);
            if (best == null) return new SurnameStrokes(0, picked.ToString(), false);
            sum += best.StrokeCount;
            picked.Append(best.Character);
        }
        return new SurnameStrokes(sum, picked.ToString(), false);
    }
}
