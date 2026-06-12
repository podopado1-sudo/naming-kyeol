using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 한국어 이름의 보편 작명 원리 — 한자/순우리말/3글자 모든 이름에 공통 적용.
/// 발음(한글 자모)만 있으면 평가 가능. 한자 메타데이터(Category, FiveElement 필드 등) 의존 없음.
///
/// 호출 위치: NamePoolEngine, ThreeSyllableEngine, PureKoreanNameEngine 등
/// </summary>
public static class NamingPrinciples
{
    // 음령오행 상생: A → B 관계
    private static readonly Dictionary<string, string> ShengNext = new()
    {
        ["木"] = "火", ["火"] = "土", ["土"] = "金", ["金"] = "水", ["水"] = "木"
    };

    // 음령오행 상극: A가 B를 극함
    private static readonly Dictionary<string, string> KeTarget = new()
    {
        ["木"] = "土", ["土"] = "水", ["水"] = "火", ["火"] = "金", ["金"] = "木"
    };

    /// <summary>
    /// 유행 이름 — 후보 제외 (세대 중립 철학)
    /// </summary>
    public static readonly HashSet<string> TrendyNames = new()
    {
        "서준", "민준", "하준", "지호", "준서", "도윤", "예준",
        "서연", "하은", "지은", "채원", "지유", "서윤", "예은",
        "건우", "시우", "수호", "하린", "아린", "소율", "민서",
        "서아", "지아", "다은", "서은", "수아", "예린", "유나"
    };

    public static bool IsTrendyName(string name) => TrendyNames.Contains(name);

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 0 — 이름다움 (Name-Likeness)
    // ═══════════════════════════════════════════════════════════════
    //
    // 음운론적으로 매끄러워도 "경타", "빈기"처럼 실제 이름에 쓰이지 않는
    // 음절 조합은 이름답지 않다. 실명에서 각 음절이 해당 위치(첫째/둘째)에
    // 등장하는 빈도를 3단계로 평가해 조합의 이름다움을 0~1로 반환한다.
    // 독창성(희귀한 "조합")은 장려하되, 비(非)이름 "음절"은 걸러내는 것이 목적.

    /// <summary>이름 첫째 음절로 흔히 쓰이는 음절</summary>
    private static readonly HashSet<string> CommonFirstSyllables = new()
    {
        "가", "건", "경", "규", "나", "다", "도", "동", "라", "민",
        "범", "보", "상", "서", "선", "성", "세", "소", "수", "승",
        "시", "연", "영", "예", "온", "우", "원", "유", "윤",
        "은", "이", "인", "재", "정", "주", "준", "지", "진", "채",
        "태", "하", "한", "해", "현", "호", "효", "희"
    };

    /// <summary>이름 첫째 음절로 가끔 쓰이는 음절</summary>
    private static readonly HashSet<string> AcceptableFirstSyllables = new()
    {
        // "아"는 아린/아인처럼 부드러운 어미와는 어울리지만
        // 아승/아수처럼 한자 어미와 붙으면 어색 → 가능 등급으로만 인정
        "아", "강", "근", "금", "기", "남", "노", "누", "단", "대",
        "란", "루", "리", "마", "명", "무", "미", "별", "비", "새",
        "슬", "애", "여", "오", "용", "율", "청", "초", "형", "환", "휘"
    };

    /// <summary>이름 끝(둘째) 음절로 흔히 쓰이는 음절</summary>
    private static readonly HashSet<string> CommonFinalSyllables = new()
    {
        "결", "경", "규", "나", "린", "람", "리", "미", "민", "빈",
        "비", "서", "석", "선", "성", "솔", "수", "승", "슬", "아",
        "안", "연", "영", "온", "우", "욱", "원", "유", "윤", "율",
        "은", "인", "재", "정", "주", "준", "지", "진", "찬", "하",
        "현", "혁", "호", "환", "훈", "희"
    };

    /// <summary>이름 끝(둘째) 음절로 가끔 쓰이는 음절 (순우리말 어미 포함)</summary>
    private static readonly HashSet<string> AcceptableFinalSyllables = new()
    {
        "기", "늘", "을", "름", "담", "솜", "랑", "산", "해", "별",
        "빛", "들", "래", "라", "루", "용", "든", "봄", "단", "새"
    };

    /// <summary>
    /// 2음절 이름의 이름다움 평가 (0~1).
    /// 첫째 음절 45% + 둘째 음절 55% 가중 (끝음절이 이름 인상을 더 좌우).
    /// 흔함 1.0 / 가능 0.6 / 이례적 0.2(첫째)·0.15(둘째).
    /// </summary>
    public static double EvalNameLikeness(string firstSyllable, string secondSyllable)
    {
        double first = CommonFirstSyllables.Contains(firstSyllable) ? 1.0
                     : AcceptableFirstSyllables.Contains(firstSyllable) ? 0.6
                     : 0.2;
        double second = CommonFinalSyllables.Contains(secondSyllable) ? 1.0
                      : AcceptableFinalSyllables.Contains(secondSyllable) ? 0.6
                      : 0.15;
        double score = first * 0.45 + second * 0.55;

        // 한쪽 음절이 이례적이면 다른 쪽이 아무리 흔해도 이름답지 않다
        // (예: "균비" — 균은 이름 첫음절로 안 쓰이는데 비가 흔하다고 통과되면 안 됨)
        if (first <= 0.2 || second <= 0.15)
        {
            score *= 0.6;
        }

        return score;
    }

    /// <summary>
    /// 이름 문자열 전체에 대한 이름다움 평가.
    /// 2음절만 평가 대상 — 그 외 길이는 중립값(0.7) 반환.
    /// </summary>
    public static double EvalNameLikeness(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length != 2) return 0.7;
        return EvalNameLikeness(name[0].ToString(), name[1].ToString());
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 1 — 성씨 연음
    // ═══════════════════════════════════════════════════════════════
    //
    // 한국어 이름은 성씨+이름이 연속 발음됨.
    // 성씨 받침(종성)과 이름 첫글자 초성의 조합에 따라 자연스러움이 다름.

    public static double EvalSurnameFlow(string lastName, string firstReading)
    {
        if (string.IsNullOrEmpty(lastName) || string.IsNullOrEmpty(firstReading)) return 0.5;

        char lastSurnameChar = lastName[^1];
        char firstNameChar   = firstReading[0];

        bool hasBatchim = KoreanUtils.HasFinalConsonant(lastSurnameChar);
        var (initial, _, _) = KoreanUtils.Decompose(firstNameChar);

        if (!hasBatchim)
        {
            // 받침 없는 성씨도 이름 첫 초성에 따라 자연스러움이 다름
            return initial switch
            {
                "ㅇ" => 0.95, // 모음 시작 — 가장 부드러움 (허+아름 → 부드럽게)
                "ㄴ" => 0.92, // 비음
                "ㅁ" => 0.90,
                "ㄹ" => 0.88, // 유음
                "ㅎ" => 0.85, // 후음
                "ㅅ" or "ㅈ" => 0.82,
                "ㄱ" or "ㄷ" or "ㅂ" => 0.75, // 평음
                "ㅊ" or "ㅋ" or "ㅌ" or "ㅍ" => 0.65, // 격음
                "ㄲ" or "ㄸ" or "ㅃ" or "ㅆ" or "ㅉ" => 0.55, // 된소리
                _    => 0.75
            };
        }

        return initial switch
        {
            "ㅇ" => 1.0,  // 연음 현상: 박+아름 → 바+가름
            "ㄴ" => 0.90, // 비음
            "ㄹ" => 0.85, // 유음
            "ㅁ" => 0.80,
            "ㄱ" => 0.45, // 경음화: 박강 → 박깡
            "ㄷ" => 0.50,
            "ㅂ" => 0.50,
            _    => 0.65
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 2 — 음령오행 상생 (한글 초성 기반)
    // ═══════════════════════════════════════════════════════════════
    //
    // 이름 두 글자의 초성으로부터 음령오행을 구해 상생/상극 평가.
    // 한자/순우리말 모두 적용 가능.

    public static double EvalOhaengSynergy(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 0.5;
        var e1 = KoreanUtils.GetEumryeongFiveElement(r1[0]);
        var e2 = KoreanUtils.GetEumryeongFiveElement(r2[0]);
        if (string.IsNullOrEmpty(e1) || string.IsNullOrEmpty(e2)) return 0.5;

        if (ShengNext.TryGetValue(e1, out var next) && next == e2) return 1.0;   // 상생 정방향
        if (ShengNext.TryGetValue(e2, out var prev) && prev == e1) return 0.85;  // 상생 역방향
        if (e1 == e2) return 0.70;                                                // 동일 오행
        if (KeTarget.TryGetValue(e1, out var target) && target == e2) return 0.15; // 상극
        if (KeTarget.TryGetValue(e2, out var t2) && t2 == e1) return 0.20;        // 상극 역방향
        return 0.50;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 3 — 받침 리듬 패턴
    // ═══════════════════════════════════════════════════════════════
    //
    // 받침없음+받침있음(서현, 나린): 경쾌, 최고
    // 받침있음+받침없음(민서, 준아): 안정감
    // 받침없음+받침없음(서아, 나라): 부드러움
    // 받침있음+받침있음(민준, 건희): 묵직 (strong 톤 적합)

    public static double EvalRhythm(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 0.5;
        bool b1 = KoreanUtils.HasFinalConsonant(r1[0]);
        bool b2 = KoreanUtils.HasFinalConsonant(r2[0]);

        return (b1, b2) switch
        {
            (false, true)  => 1.00,
            (true,  false) => 0.90,
            (false, false) => 0.70,
            (true,  true)  => 0.60
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 4 — 초성 다양성
    // ═══════════════════════════════════════════════════════════════
    //
    // 두 글자 초성이 같으면 단조로움 (강근, 민명, 서선 등).

    public static double EvalInitialDiversity(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 0.5;
        var (i1, _, _) = KoreanUtils.Decompose(r1[0]);
        var (i2, _, _) = KoreanUtils.Decompose(r2[0]);

        if (string.IsNullOrEmpty(i1) || string.IsNullOrEmpty(i2)) return 0.5;
        if (i1 == i2) return 0.0;
        return 1.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 5 — 어색한 자음 결합 회피
    // ═══════════════════════════════════════════════════════════════
    //
    // 한국어에서 격음(ㅊㅋㅌㅍ) + 된소리(ㄲㄸㅃㅆㅉ) 같은 연속은 어색.
    // 또한 같은 조음 위치 자음의 연속도 불쾌감 (양순음+양순음 등).

    private static readonly HashSet<string> Aspirated = new() { "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };
    private static readonly HashSet<string> Tensed = new() { "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ" };

    public static double EvalAwkwardCombination(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 0.5;
        var (i1, _, _) = KoreanUtils.Decompose(r1[0]);
        var (i2, _, _) = KoreanUtils.Decompose(r2[0]);
        if (string.IsNullOrEmpty(i1) || string.IsNullOrEmpty(i2)) return 0.5;

        // 격음 + 된소리 또는 된소리 + 격음 — 가장 어색
        bool combo1 = Aspirated.Contains(i1) && Tensed.Contains(i2);
        bool combo2 = Tensed.Contains(i1) && Aspirated.Contains(i2);
        if (combo1 || combo2) return 0.1;

        // 격음 + 격음 — 딱딱함
        if (Aspirated.Contains(i1) && Aspirated.Contains(i2)) return 0.4;

        // 된소리 + 된소리 — 강한 톤이라면 OK, 일반적으로는 거침
        if (Tensed.Contains(i1) && Tensed.Contains(i2)) return 0.35;

        return 1.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 6 — 동음 받침/초성 반복 감점 (EvalInitialDiversity 보완)
    // ═══════════════════════════════════════════════════════════════
    //
    // 두 글자가 같은 받침이면 단조 (예: 민준 - ㄴㄴ).
    // EvalInitialDiversity는 초성만 보지만 이건 종성(받침)까지 본다.

    public static double EvalConsonantEcho(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 0.5;
        var (_, _, f1) = KoreanUtils.Decompose(r1[0]);
        var (_, _, f2) = KoreanUtils.Decompose(r2[0]);

        // 둘 다 받침 없음 — 중립
        if (string.IsNullOrEmpty(f1) && string.IsNullOrEmpty(f2)) return 1.0;
        // 한 쪽만 받침 — 다양성 있음
        if (string.IsNullOrEmpty(f1) || string.IsNullOrEmpty(f2)) return 1.0;
        // 같은 받침 연속 — 단조 (ㄴㄴ, ㅁㅁ, ㄹㄹ 등)
        if (f1 == f2) return 0.3;
        return 0.85;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 7 — 외래어 발음 회피
    // ═══════════════════════════════════════════════════════════════
    //
    // 한국어로 발음했을 때 외국인 이름·외래어 느낌이 강한 패턴.
    // 예: "조지(George)", "줄리(Julie)" 등.

    private static readonly HashSet<string> ForeignSoundingPatterns = new()
    {
        // 영어권 이름 발음 유사
        "조지", "줄리", "데이", "안나", "에밀",
        "마리", "아담", "이브", "리사", "사라",
        "마이", "주디", "케빈", "토마", "다니",
        // 일본 발음 유사
        "유키", "히로", "사쿠", "아키", "유리",
        "타로", "리코", "모모",
        // 중국식 발음 (한자 음역이 아닌 음 자체가 외래어)
        "샤오", "리리", "메이"
    };

    public static double EvalForeignPhonotactics(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length < 2) return 1.0;
        // 이름 자체 또는 부분 매칭
        if (ForeignSoundingPatterns.Contains(name)) return 0.2;
        // 첫 두 글자만 매칭되는 경우도 약한 감점
        if (name.Length > 2 && ForeignSoundingPatterns.Contains(name[..2])) return 0.6;
        return 1.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 8 — 성씨+이름 음절 길이 균형
    // ═══════════════════════════════════════════════════════════════
    //
    // 1+2 (김민준) → 가장 보편, 자연스러움
    // 1+3 (김민준호) → 4음절, 부담스러움
    // 2+1 (남궁민) → 복성 짧은이름, 끝맺음 강함
    // 2+2 (남궁민준) → 4음절, 정중하지만 길음
    // 2+3 (남궁민준호) → 5음절, 거의 회피

    public static double EvalSyllableLengthBalance(string lastName, string firstName)
    {
        if (string.IsNullOrEmpty(lastName) || string.IsNullOrEmpty(firstName)) return 0.5;
        int ln = lastName.Length;
        int fn = firstName.Length;

        return (ln, fn) switch
        {
            (1, 2) => 1.0,   // 김민준 — 표준
            (1, 1) => 0.75,  // 김준 — 짧은 외자 이름 (옛 양식)
            (1, 3) => 0.70,  // 김민준호 — 길지만 가능
            (2, 1) => 0.70,  // 남궁민 — 복성+외자
            (2, 2) => 0.65,  // 남궁민준
            (2, 3) => 0.25,  // 남궁민준호 — 5음절
            _      => 0.40
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 9 — 종성-초성 동화 (자음 동화)
    // ═══════════════════════════════════════════════════════════════
    //
    // 한국어 발음에서 받침과 다음 초성이 만나면 동화/탈락/경음화가 일어남.
    // 신라(信羅) → 실라, 박력 → 방녁 같은 변화. 발음 결과가 어색하지 않은지 평가.
    //
    // 기준:
    // - ㄴ+ㄹ → ㄹㄹ 동화 (자연스러움) — 권장
    // - 비음+ㄱㄷㅂㅈ → 격음화 가능성 (어색)
    // - 받침 ㄱㄷㅂ + 초성 ㄴㅁ → 비음화 (자연스러움, 약감점 없음)
    // - 받침 ㄱㄷㅂ + 초성 ㄱㄷㅂㅅㅈ → 경음화 (어색, 감점)

    public static double EvalConsonantAssimilation(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 1.0;
        var (_, _, f1) = KoreanUtils.Decompose(r1[0]);
        var (i2, _, _) = KoreanUtils.Decompose(r2[0]);

        if (string.IsNullOrEmpty(f1) || string.IsNullOrEmpty(i2)) return 1.0;

        // 받침 ㄱㄷㅂ + 초성 ㄱㄷㅂㅅㅈ → 경음화 (어색)
        var hardFinals = new HashSet<string> { "ㄱ", "ㄷ", "ㅂ" };
        var hardenable = new HashSet<string> { "ㄱ", "ㄷ", "ㅂ", "ㅅ", "ㅈ" };
        if (hardFinals.Contains(f1) && hardenable.Contains(i2))
            return 0.4; // 박강 → 박깡 같은 경음화

        // ㄴ+ㄹ → 유음화 (자연스러움)
        if (f1 == "ㄴ" && i2 == "ㄹ")
            return 0.85;

        // 받침 ㄱㄷㅂ + 초성 ㄴㅁ → 비음화 (자연스러움, 신경 안 씀)
        if (hardFinals.Contains(f1) && (i2 == "ㄴ" || i2 == "ㅁ"))
            return 0.95;

        return 1.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 10 — 모음 단조성 회피
    // ═══════════════════════════════════════════════════════════════
    //
    // 같은 모음이 반복되면 단조롭게 들림.
    // 예: 사사(ㅏㅏ), 미미(ㅣㅣ), 보보(ㅗㅗ).

    public static double EvalVowelMonotony(string r1, string r2)
    {
        if (string.IsNullOrEmpty(r1) || string.IsNullOrEmpty(r2)) return 1.0;
        var (_, v1, _) = KoreanUtils.Decompose(r1[0]);
        var (_, v2, _) = KoreanUtils.Decompose(r2[0]);

        if (string.IsNullOrEmpty(v1) || string.IsNullOrEmpty(v2)) return 1.0;

        if (v1 == v2) return 0.45; // 동일 모음 반복 — 단조
        return 1.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 작명 스킬 11 — 두음법칙 변환 (표기 정규화)
    // ═══════════════════════════════════════════════════════════════
    //
    // 한국어 표기에서 단어 첫머리의 'ㄹ'은 'ㅇ'/'ㄴ'으로 바뀜 (이→리, 림→임 등).
    // 작명에서는 이름 첫 글자에 두음법칙 적용 음절이 오면 같은 한자의 두 표기를 동등하게 처리.

    private static readonly Dictionary<string, string> DueumMap = new()
    {
        // 'ㄹ' → 'ㄴ' (예: 류→유, 락→낙)
        ["라"] = "나", ["래"] = "내", ["로"] = "노", ["루"] = "누",
        ["리"] = "이", ["량"] = "양", ["력"] = "역", ["련"] = "연",
        ["렬"] = "열", ["령"] = "영", ["례"] = "예", ["로"] = "노",
        ["록"] = "녹", ["룡"] = "용", ["륜"] = "윤", ["률"] = "율",
        ["릉"] = "능", ["리"] = "이", ["림"] = "임", ["립"] = "입",
        ["류"] = "유",
    };

    /// <summary>
    /// 두음법칙에 의해 변환된 음절 표기를 반환. 적용 대상이 아니면 원본 그대로.
    /// 이름 첫 글자에만 적용.
    /// </summary>
    public static string ApplyDueum(string syllable)
    {
        if (string.IsNullOrEmpty(syllable)) return syllable;
        return DueumMap.TryGetValue(syllable, out var converted) ? converted : syllable;
    }

    /// <summary>
    /// 두음법칙 적용이 필요한 음절인지 검사.
    /// </summary>
    public static bool RequiresDueum(string syllable)
    {
        return !string.IsNullOrEmpty(syllable) && DueumMap.ContainsKey(syllable);
    }
}
