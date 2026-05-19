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
}
