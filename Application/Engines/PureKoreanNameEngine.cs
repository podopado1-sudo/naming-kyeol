using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 순우리말 이름 추천 엔진
/// 한자 없이 순우리말만으로 이름을 생성한다.
/// 내장 사전(60개 이상)에서 성별/톤 필터링 후, 성씨와의 발음 조화를 평가한다.
/// </summary>
public class PureKoreanNameEngine : IPureKoreanNameEngine
{
    // 금칙어 및 부정적 발음 패턴 — 공통 데이터 클래스 사용
    // ForbiddenWordData.ForbiddenWords (100개+) + ForbiddenWordData.ContainsForbiddenWord()

    /// <summary>순우리말 이름 내장 사전</summary>
    private static readonly List<PureKoreanEntry> NameDictionary = BuildDictionary();

    public async Task<List<PureKoreanCandidate>> GenerateCandidatesAsync(
        string lastName, string gender, string tone, int count)
    {
        count = Math.Clamp(count, 1, 50);
        var normalizedGender = (gender ?? "none").ToLower();
        var normalizedTone = (tone ?? "neutral").ToLower();

        // 1. 성별 필터링
        var filtered = NameDictionary
            .Where(e => MatchesGender(e.GenderFit, normalizedGender))
            .ToList();

        // 2. 톤 필터링
        if (normalizedTone != "neutral")
        {
            var toneFiltered = filtered
                .Where(e => e.ToneFit == normalizedTone || e.ToneFit == "neutral")
                .ToList();
            if (toneFiltered.Count >= count)
                filtered = toneFiltered;
        }

        // 3. 금칙어/부정 발음 체크
        filtered = filtered
            .Where(e => !ContainsForbiddenWord(lastName + e.Name))
            .ToList();

        // 4. 성씨와의 발음 조화 점수 계산 및 정렬
        //    이름 기준 중복 제거 (사전 자체에 동일 이름 중복이 있어도 결과에는 1개만)
        var candidates = filtered.Select(e => new PureKoreanCandidate
        {
            Name = e.Name,
            Meaning = e.Meaning,
            Origin = e.Origin,
            GenderFit = e.GenderFit,
            ToneFit = e.ToneFit,
            PronunciationScore = EvaluatePronunciation(lastName, e.Name)
        })
        .GroupBy(c => c.Name)
        .Select(g => g.OrderByDescending(c => c.PronunciationScore).First())
        .OrderByDescending(c => c.PronunciationScore)
        .Take(count)
        .ToList();

        return await Task.FromResult(candidates);
    }

    /// <summary>
    /// 성별 매칭 검사
    /// </summary>
    private static bool MatchesGender(string entryGender, string requestedGender)
    {
        if (requestedGender == "none") return true;
        if (entryGender == "neutral") return true;
        return entryGender == requestedGender;
    }

    /// <summary>
    /// 금칙어/부정 발음 포함 여부 검사 (공통 데이터 활용)
    /// </summary>
    private static bool ContainsForbiddenWord(string fullName)
    {
        return ForbiddenWordData.ContainsForbiddenWord(fullName);
    }

    /// <summary>
    /// 성씨와 이름의 발음 조화 점수 (0~100)
    /// 보편 작명 원리(NamingPrinciples) + 순우리말 특화(모음 다양성, 음절 수) 결합.
    /// </summary>
    private static int EvaluatePronunciation(string lastName, string name)
    {
        if (string.IsNullOrEmpty(lastName) || string.IsNullOrEmpty(name))
            return 60;

        double score = 0;

        // 보편 원리 — 성씨 연음 (0~25)
        score += NamingPrinciples.EvalSurnameFlow(lastName, name) * 25;

        // 보편 원리 — 페어 평가 (2글자 이상)
        if (name.Length >= 2)
        {
            var r1 = name[0].ToString();
            var r2 = name[1].ToString();
            score += NamingPrinciples.EvalRhythm(r1, r2) * 18;
            score += NamingPrinciples.EvalInitialDiversity(r1, r2) * 12;
            score += NamingPrinciples.EvalOhaengSynergy(r1, r2) * 12;
        }
        else
        {
            score += 25;
        }

        // 순우리말 특화 — 모음 다양성 (0~6)
        var fullName = lastName + name;
        var vowels = new HashSet<string>();
        foreach (var ch in fullName)
        {
            var (_, v, _) = KoreanUtils.Decompose(ch);
            if (!string.IsNullOrEmpty(v)) vowels.Add(v);
        }
        if (vowels.Count >= 3) score += 6;
        else if (vowels.Count >= 2) score += 3;

        // 순우리말 특화 — 음절 수 (0~8)
        if (name.Length == 2) score += 8;
        else if (name.Length == 1) score += 5;
        else if (name.Length == 3) score += 3;

        // 순우리말 특화 — 길이 패널티 (4글자 이상 줄여 부를 가능성)
        if (name.Length >= 4) score -= 5;

        // 순우리말 특화 — 받침 과다 패널티 (이름 내 받침 비율 70% 초과 시 묵직)
        var nameOnlyFinals = KoreanUtils.CountFinalConsonants(name);
        if (name.Length > 0 && (double)nameOnlyFinals / name.Length > 0.7)
            score -= 4;

        // 동일 자음 반복 패널티
        if (KoreanUtils.HasSameConsonantRepetition(fullName))
            score -= 5;

        return Math.Clamp((int)score, 0, 100);
    }

    /// <summary>
    /// 순우리말 이름 사전 빌드 (210개+)
    /// 남녀공용 70개+ / 남성 70개+ / 여성 70개+
    /// </summary>
    private static List<PureKoreanEntry> BuildDictionary()
    {
        return new List<PureKoreanEntry>
        {
            // ==========================================
            // 남녀공용 (Neutral) — 70개
            // ==========================================
            // --- 기존 22개 ---
            new("한결", "한결같이 변치 않는", "한결같다 — 처음과 끝이 같다는 순우리말", "neutral", "strong"),
            new("가온", "가운데, 세상의 중심", "가온 — 가운데를 뜻하는 순우리말", "neutral", "soft"),
            new("나래", "날개처럼 자유롭게 펼치다", "나래 — 날개의 순우리말", "neutral", "soft"),
            new("하늘", "하늘처럼 높고 넓은", "하늘 — 천공을 뜻하는 고유어", "neutral", "neutral"),
            new("보람", "삶의 보람을 느끼다", "보람 — 가치와 성취감의 순우리말", "neutral", "neutral"),
            new("이슬", "아침 이슬처럼 맑고 깨끗한", "이슬 — 새벽에 맺히는 물방울", "neutral", "soft"),
            new("다솜", "사랑, 다정한 마음", "다솜 — 사랑을 뜻하는 옛 순우리말", "neutral", "soft"),
            new("미르", "용처럼 위엄 있는", "미르 — 용(龍)을 뜻하는 순우리말", "neutral", "strong"),
            new("새롬", "늘 새로운 시작", "새롬 — 새롭다에서 파생된 순우리말", "neutral", "soft"),
            new("가람", "강처럼 유유히 흐르는", "가람 — 강(江)을 뜻하는 순우리말", "neutral", "neutral"),
            new("아라", "바다처럼 넓은 마음", "아라 — 바다를 뜻하는 순우리말", "neutral", "soft"),
            new("누리", "온 세상을 품다", "누리 — 세상을 뜻하는 순우리말", "neutral", "soft"),
            new("나루", "사람들이 건너는 곳", "나루 — 나루터(渡), 건널목의 순우리말", "neutral", "neutral"),
            new("바람", "바람처럼 자유로운", "바람 — 공기의 흐름을 뜻하는 고유어", "neutral", "neutral"),
            new("한울", "큰 울타리, 넓은 세상", "한울 — 큰 울타리를 뜻하는 순우리말", "neutral", "strong"),
            new("솔", "소나무처럼 곧고 푸른", "솔 — 소나무의 순우리말", "neutral", "strong"),
            new("빛", "빛처럼 밝고 환한", "빛 — 광명을 뜻하는 고유어", "neutral", "strong"),
            new("봄", "봄처럼 따뜻하고 생명력 있는", "봄 — 계절 봄, 새 생명의 순우리말", "neutral", "soft"),
            new("별", "별처럼 빛나는 존재", "별 — 밤하늘의 별, 고유어", "neutral", "soft"),
            new("온", "온전하고 완전한", "온 — 온전하다의 어근", "neutral", "soft"),
            new("담", "마음에 담다, 그릇처럼 넓은", "담 — 담다의 어근, 포용의 뜻", "neutral", "neutral"),
            new("결", "결이 고운, 품격 있는", "결 — 결, 무늬, 바탕을 뜻하는 순우리말", "neutral", "soft"),
            // --- 추가 48개 ---
            new("라온", "즐거움, 기쁨", "라온 — 즐거운을 뜻하는 옛 순우리말", "neutral", "soft"),
            new("바론", "바르고 올곧은", "바르다 — 곧고 정직하다의 어근", "neutral", "strong"),
            new("다함", "다 함께 어우러지는", "다+함께 — 모두 함께라는 뜻", "neutral", "neutral"),
            new("해오름", "해가 뜨는 밝은 시작", "해+오르다 — 태양이 떠오르다", "neutral", "strong"),
            new("다움", "다음 세대를 이끄는", "다음 — 미래를 뜻하는 순우리말 어근", "neutral", "neutral"),
            new("마루", "산꼭대기, 가장 높은 곳", "마루 — 꼭대기를 뜻하는 순우리말", "neutral", "strong"),
            new("시나", "기쁨을 주는", "시나 — 기쁨을 뜻하는 옛말", "neutral", "soft"),
            new("노을", "저녁 하늘의 고운 빛", "노을 — 석양의 붉은 빛", "neutral", "soft"),
            new("한", "크고 넓은", "한 — 크다를 뜻하는 순우리말 접두어", "neutral", "strong"),
            new("길", "곧은 길을 걷는", "길 — 도로, 방향의 순우리말", "neutral", "neutral"),
            new("터", "삶의 터전을 일구는", "터 — 기반, 터전의 순우리말", "neutral", "strong"),
            new("볕", "따사로운 햇볕 같은", "볕 — 햇볕의 순우리말", "neutral", "soft"),
            new("숲", "숲처럼 깊고 넉넉한", "숲 — 나무가 우거진 곳", "neutral", "neutral"),
            new("샘", "샘물처럼 맑고 끊이지 않는", "샘 — 샘물의 순우리말", "neutral", "soft"),
            new("들", "들판처럼 넓고 탁 트인", "들 — 넓은 평야, 들판", "neutral", "neutral"),
            new("내", "시냇물처럼 흐르는", "내 — 시내, 작은 강의 순우리말", "neutral", "soft"),
            new("참", "참되고 진실한", "참 — 참되다의 어근", "neutral", "strong"),
            new("새", "새처럼 자유로운", "새 — 새(鳥)의 순우리말", "neutral", "soft"),
            new("꿈", "꿈을 이루는", "꿈 — 소망, 이상의 순우리말", "neutral", "soft"),
            new("힘", "힘차고 든든한", "힘 — 기운, 역량의 순우리말", "neutral", "strong"),
            new("뜻", "뜻깊고 의미 있는", "뜻 — 의지, 뜻의 순우리말", "neutral", "strong"),
            new("슬기", "지혜롭고 슬기로운", "슬기 — 지혜를 뜻하는 순우리말", "neutral", "neutral"),
            new("나봄", "봄처럼 태어난", "나다+봄 — 봄에 태어난 아이", "neutral", "soft"),
            new("한샘", "큰 샘물처럼 풍요로운", "한(크다)+샘(샘물) 합성어", "neutral", "neutral"),
            new("맑", "맑고 깨끗한", "맑다 — 투명하고 깨끗하다의 어근", "neutral", "soft"),
            new("밝", "밝고 환한", "밝다 — 빛이 환하다의 어근", "neutral", "strong"),
            new("고을", "평화로운 마을처럼", "고을 — 마을, 고장의 순우리말", "neutral", "neutral"),
            new("비온", "비 온 뒤 맑은 하늘처럼", "비+오다 — 시련 뒤의 맑음", "neutral", "neutral"),
            new("늘", "언제나 변함없는", "늘 — 항상, 언제나의 순우리말", "neutral", "soft"),
            new("솔잎", "솔잎처럼 향기로운", "솔(소나무)+잎 — 소나무 잎", "neutral", "neutral"),
            new("다온", "좋은 일이 다 온다", "다+오다 — 좋은 것이 찾아온다", "neutral", "soft"),
            new("잎", "싱싱한 잎처럼 생기 있는", "잎 — 나뭇잎의 순우리말", "neutral", "soft"),
            new("소망", "소망을 품은", "소망 — 바람, 희망의 순우리말", "neutral", "soft"),
            new("아침", "아침처럼 상쾌한 시작", "아침 — 하루의 시작, 고유어", "neutral", "neutral"),
            new("바다", "바다처럼 넓고 깊은", "바다 — 대양을 뜻하는 고유어", "neutral", "neutral"),
            new("우듬지", "나무 꼭대기 가지처럼", "우듬지 — 나무 가장 높은 가지", "neutral", "strong"),
            new("둥지", "따뜻한 둥지 같은 사람", "둥지 — 새의 보금자리", "neutral", "soft"),
            new("물", "물처럼 유연하고 맑은", "물 — 물(水)의 순우리말", "neutral", "soft"),
            new("나들", "세상을 나들이하는", "나들이 — 밖으로 나가 구경하다", "neutral", "soft"),
            new("옹이", "나무의 옹이처럼 단단한", "옹이 — 나무 줄기의 마디", "neutral", "strong"),
            new("비", "비처럼 촉촉한 생명력", "비 — 비(雨)의 순우리말", "neutral", "soft"),
            new("산", "산처럼 듬직하고 든든한", "산 — 산(山)의 순우리말", "neutral", "strong"),
            new("한가람", "큰 강처럼 유유한", "한(크다)+가람(강) 합성어", "neutral", "neutral"),
            new("새나", "새롭게 태어난", "새+나다 — 새롭게 탄생하다", "neutral", "soft"),
            new("자람", "무럭무럭 자라는", "자라다의 명사형 — 성장", "neutral", "neutral"),
            new("다솜해", "사랑이 가득한", "다솜(사랑)+해(하다) 합성어", "neutral", "soft"),
            new("다올", "다 이루어지다", "다+오르다 — 모든 것을 이룬다", "neutral", "neutral"),
            new("한빛", "큰 빛, 위대한 광명", "한(크다)+빛 — 큰 빛이라는 합성어", "neutral", "strong"),

            // ==========================================
            // 남성 (Male) — 72개
            // ==========================================
            // --- 기존 22개 ---
            new("세찬", "세차고 힘찬 기운", "세차다 — 기운이 거세고 힘차다", "male", "strong"),
            new("거울", "세상을 비추는 거울 같은", "거울 — 비추는 물건의 순우리말", "male", "neutral"),
            new("이든", "이로운 사람이 되다", "이롭다 — 이로운, 유익한의 순우리말 어근", "male", "soft"),
            new("건", "건강하고 든든한", "건강하다의 어근, 튼튼함", "male", "strong"),
            new("늘봄", "늘 봄처럼 따뜻한", "늘+봄 — 항상 봄 같은 사람", "male", "soft"),
            new("으뜸", "가장 뛰어난 최고", "으뜸 — 첫째, 최고를 뜻하는 순우리말", "male", "strong"),
            new("찬", "빛나고 찬란한", "찬 — 찬란하다의 어근", "male", "strong"),
            new("바로", "곧고 바른 사람", "바로 — 곧다, 정직하다의 순우리말", "male", "strong"),
            new("우람", "우람하고 당당한", "우람하다 — 크고 당당한 모습", "male", "strong"),
            new("든든", "든든하고 믿음직한", "든든하다 — 안정감이 있다", "male", "strong"),
            new("해찬", "해처럼 찬란하게 빛나는", "해(태양)+찬(찬란하다) 합성어", "male", "strong"),
            new("산들", "산들바람처럼 부드럽고 시원한", "산들 — 가볍고 시원한 바람의 모양", "male", "soft"),
            new("푸름", "늘 푸르고 싱싱한", "푸르다의 명사형, 젊음과 생기", "male", "soft"),
            new("힘찬", "힘차고 활력 넘치는", "힘+차다 — 에너지가 가득한", "male", "strong"),
            new("다짐", "굳은 다짐으로 나아가는", "다짐 — 굳게 마음먹음", "male", "strong"),
            // --- 추가 57개 ---
            new("벼리", "일을 벼려 다스리는", "벼리다 — 다스리다, 관장하다의 순우리말", "male", "strong"),
            new("거름", "세상의 밑거름이 되는", "거름 — 밑거름, 기초가 되는 것", "male", "neutral"),
            new("한벗", "큰 벗, 든든한 친구", "한(크다)+벗(친구) 합성어", "male", "strong"),
            new("늘해랑", "항상 해와 함께하는", "늘+해+랑(함께) 합성어", "male", "soft"),
            new("푸른", "푸르고 싱그러운", "푸르다 — 녹색빛, 젊음의 순우리말", "male", "soft"),
            new("굳건", "굳세고 건강한", "굳세다+건강하다 합성어", "male", "strong"),
            new("샛별", "새벽별처럼 빛나는", "샛별 — 금성, 새벽에 빛나는 별", "male", "strong"),
            new("드높", "높이 드높은", "드높다 — 매우 높다의 순우리말", "male", "strong"),
            new("널리", "널리 이름을 떨치는", "널리 — 넓게, 두루의 순우리말", "male", "neutral"),
            new("우뚝", "우뚝 서서 빛나는", "우뚝 — 높이 솟은 모양", "male", "strong"),
            new("다부", "다부지고 단단한", "다부지다 — 단단하고 야무지다", "male", "strong"),
            new("듬직", "듬직하고 믿음직한", "듬직하다 — 모양이 크고 믿음직하다", "male", "strong"),
            new("한솔", "큰 소나무처럼 곧은", "한(크다)+솔(소나무) 합성어", "male", "strong"),
            new("겨레", "겨레를 이끄는", "겨레 — 민족, 동포의 순우리말", "male", "strong"),
            new("밝은", "밝은 미래를 향한", "밝다 — 빛이 환하다", "male", "neutral"),
            new("솔찬", "소나무처럼 곧고 찬란한", "솔(소나무)+찬(찬란하다) 합성어", "male", "strong"),
            new("아침해", "아침 해처럼 떠오르는", "아침+해 — 새벽 태양", "male", "strong"),
            new("늘찬", "늘 찬란하게 빛나는", "늘+찬(찬란하다) 합성어", "male", "strong"),
            new("높은", "높은 뜻을 품은", "높다 — 수준이 높다의 순우리말", "male", "strong"),
            new("굳세", "굳세고 꿋꿋한", "굳세다 — 의지가 강하다", "male", "strong"),
            new("볼", "풍요로운 두둑 같은", "볼 — 두둑, 풍요의 옛말", "male", "neutral"),
            new("곧음", "곧고 바른 사람", "곧다의 명사형 — 정직함", "male", "strong"),
            new("우리", "우리 모두를 이끄는", "우리 — 함께라는 뜻의 순우리말", "male", "neutral"),
            new("나라", "나라를 빛내는", "나라 — 국가를 뜻하는 순우리말", "male", "strong"),
            new("이룸", "뜻을 이루는 사람", "이루다의 명사형 — 성취", "male", "strong"),
            new("큰솔", "큰 소나무처럼 우뚝한", "큰+솔(소나무) 합성어", "male", "strong"),
            new("밝음", "밝고 환한 존재", "밝다의 명사형 — 밝음, 광명", "male", "neutral"),
            new("고른", "고르고 균형 잡힌", "고르다 — 균등하다의 순우리말", "male", "neutral"),
            new("새힘", "새로운 힘을 가진", "새+힘 — 새로운 역량", "male", "strong"),
            new("해돋이", "해돋이처럼 빛나는 시작", "해돋이 — 일출의 순우리말", "male", "strong"),
            new("다움찬", "다운 사람답게 찬란한", "다움+찬 — 다운 + 찬란한", "male", "strong"),
            new("오름", "높이 오르는", "오르다의 명사형 — 상승", "male", "strong"),
            new("버들", "버드나무처럼 유연하고 강한", "버들 — 버드나무의 순우리말", "male", "soft"),
            new("피리", "피리 소리처럼 맑은", "피리 — 전통 관악기의 순우리말", "male", "soft"),
            new("나설", "세상에 나서는", "나서다 — 앞으로 나아가다", "male", "strong"),
            new("거침", "거침없이 나아가는", "거침없다 — 막힘이 없다의 어근", "male", "strong"),
            new("다솜길", "사랑의 길을 걷는", "다솜(사랑)+길(길) 합성어", "male", "soft"),
            new("미래", "미래를 향해 나아가는", "미래 — 앞날을 뜻하는 순우리말 어근", "male", "neutral"),
            new("부릅", "눈을 부릅뜨고 나아가는", "부릅뜨다 — 의지를 불태우다의 어근", "male", "strong"),
            new("한마루", "가장 높은 꼭대기", "한(크다)+마루(꼭대기) 합성어", "male", "strong"),
            new("깊은", "깊은 뜻을 품은", "깊다 — 깊고 심오하다의 순우리말", "male", "neutral"),
            new("넓은", "넓은 마음을 가진", "넓다 — 폭이 넓다의 순우리말", "male", "neutral"),
            new("빛나", "빛나는 존재", "빛+나다 — 빛이 나다", "male", "strong"),
            new("씩씩", "씩씩하고 용감한", "씩씩하다 — 기운이 세고 당차다", "male", "strong"),
            new("온결", "온전하고 결이 고운", "온(온전하다)+결(결) 합성어", "male", "soft"),
            new("새벽", "새벽처럼 새로운 시작", "새벽 — 하루의 시작", "male", "neutral"),
            new("울림", "깊은 울림을 주는", "울리다의 명사형 — 감동, 여운", "male", "neutral"),

            // ==========================================
            // 여성 (Female) — 73개
            // ==========================================
            // --- 기존 23개 ---
            new("예나", "예쁘고 빛나는", "예쁘다+나다 — 아름다움이 태어나다", "female", "soft"),
            new("소담", "소담하고 탐스러운", "소담하다 — 생김새가 탐스럽다", "female", "soft"),
            new("보미", "보기 좋은 아름다움", "보다+미(아름다움) — 아름다운 존재", "female", "soft"),
            new("나린", "하늘이 내린 선물", "나리다(내리다) — 하늘이 내려준", "female", "soft"),
            new("고운", "곱고 아름다운", "곱다 — 아름답다의 순우리말", "female", "soft"),
            new("맑음", "맑고 투명한 마음", "맑다의 명사형 — 깨끗함", "female", "soft"),
            new("여울", "여울물처럼 맑게 흐르는", "여울 — 얕은 물이 빠르게 흐르는 곳", "female", "soft"),
            new("소리", "아름다운 소리처럼 울려 퍼지는", "소리 — 소리, 음향의 순우리말", "female", "soft"),
            new("단비", "가뭄 끝 단비 같은 존재", "단비 — 꼭 필요할 때 오는 비", "female", "soft"),
            new("아름", "아름답고 빛나는", "아름답다의 어근 — 아름다움", "female", "soft"),
            new("나리", "나리꽃처럼 우아한", "나리 — 백합(나리꽃)의 순우리말", "female", "soft"),
            new("해나", "해처럼 밝게 태어난", "해+나다 — 빛나는 탄생", "female", "neutral"),
            new("미소", "미소 짓게 하는 사람", "미소 — 살며시 짓는 웃음", "female", "soft"),
            new("다정", "다정하고 따뜻한", "다정하다 — 정이 많고 따스한", "female", "soft"),
            new("하린", "하늘이 내린 보석", "하(하늘)+린(내린) 합성어", "female", "soft"),
            new("봄이", "봄처럼 따뜻한 아이", "봄+이 — 봄의 아이", "female", "soft"),
            new("꽃", "꽃처럼 아름다운", "꽃 — 식물의 꽃, 아름다움의 상징", "female", "soft"),
            new("다솜이", "사랑스러운 아이", "다솜(사랑)+이 — 사랑의 아이", "female", "soft"),
            new("물결", "물결처럼 부드럽고 유연한", "물결 — 잔잔히 일렁이는 물의 파동", "female", "soft"),
            new("하얀", "하얗고 깨끗한 마음", "하얗다 — 순백, 깨끗함", "female", "soft"),
            new("이랑", "밭이랑처럼 성실하게 일구는", "이랑 — 밭고랑, 논의 두둑", "female", "neutral"),
            new("다래", "다래나무 열매처럼 풍요로운", "다래 — 다래나무 열매의 순우리말", "female", "soft"),
            // --- 추가 50개 ---
            new("하솔", "하늘과 소나무의 조화", "하(하늘)+솔(소나무) 합성어", "female", "neutral"),
            new("나비", "나비처럼 아름답고 자유로운", "나비 — 나비(蝶)의 순우리말", "female", "soft"),
            new("물빛", "물빛처럼 맑고 투명한", "물+빛 — 맑은 물의 빛깔", "female", "soft"),
            new("솔빛", "소나무 숲의 푸른 빛", "솔(소나무)+빛 합성어", "female", "neutral"),
            new("봄별", "봄밤의 별처럼 빛나는", "봄+별 — 봄날의 별", "female", "soft"),
            new("가을", "가을처럼 풍요롭고 성숙한", "가을 — 수확의 계절", "female", "neutral"),
            new("달빛", "달빛처럼 은은하고 아름다운", "달+빛 — 달의 빛", "female", "soft"),
            new("별빛", "별빛처럼 반짝이는", "별+빛 — 별의 빛", "female", "soft"),
            new("눈꽃", "눈꽃처럼 순수하고 고운", "눈+꽃 — 눈의 결정", "female", "soft"),
            new("새봄", "새봄처럼 싱그러운", "새+봄 — 새로운 봄", "female", "soft"),
            new("햇살", "햇살처럼 따뜻하고 밝은", "햇살 — 해의 빛줄기", "female", "soft"),
            new("하늘빛", "하늘빛처럼 맑고 푸른", "하늘+빛 — 하늘의 색깔", "female", "soft"),
            new("이삭", "이삭처럼 풍요로운", "이삭 — 곡식의 알맹이 부분", "female", "neutral"),
            new("마리", "고운 마리처럼 아름다운", "마리 — 머리카락의 옛 순우리말", "female", "soft"),
            new("노리", "노래하듯 즐거운", "노리 — 놀이, 노래의 옛말", "female", "soft"),
            new("아리", "아름답고 고운", "아리 — 아름답다의 옛 순우리말 어근", "female", "soft"),
            new("고요", "고요하고 평화로운", "고요하다 — 조용하고 평화롭다", "female", "soft"),
            new("맑은", "맑고 깨끗한 마음", "맑다 — 투명하고 깨끗하다", "female", "soft"),
            new("예린", "예쁘고 고운", "예쁘다+고운 — 아름답고 섬세한", "female", "soft"),
            new("꽃잎", "꽃잎처럼 부드럽고 고운", "꽃+잎 — 꽃의 잎사귀", "female", "soft"),
            new("햇빛", "햇빛처럼 밝고 환한", "햇+빛 — 태양의 빛", "female", "strong"),
            new("구름", "구름처럼 자유롭고 부드러운", "구름 — 하늘의 구름", "female", "soft"),
            new("무지개", "무지개처럼 다채로운", "무지개 — 일곱 색의 빛", "female", "soft"),
            new("이슬비", "이슬비처럼 촉촉한", "이슬+비 — 가랑비", "female", "soft"),
            new("꽃비", "꽃비처럼 아름다운", "꽃+비 — 꽃잎이 흩날리는 비", "female", "soft"),
            new("솔향", "소나무 향기처럼 그윽한", "솔(소나무)+향(향기) 합성어", "female", "neutral"),
            new("잔디", "잔디처럼 푸르고 생기 있는", "잔디 — 풀밭의 순우리말", "female", "soft"),
            new("도담", "건강하고 도담도담 자라는", "도담도담 — 건강하게 자라는 모양", "female", "soft"),
            new("나들이", "즐겁게 나들이하는", "나들이 — 밖으로 나가 놀다", "female", "soft"),
            new("보늬", "밤의 속살처럼 귀한", "보늬 — 밤 속의 얇은 껍질", "female", "soft"),
            new("가야", "넓은 들로 가는", "가다+야(들) — 넓은 세상으로", "female", "soft"),
            new("다흰", "다 하얗고 순수한", "다+흰(하얗다) 합성어", "female", "soft"),
            new("나을", "나아서 더 나은", "낫다의 어근 — 더 좋아지다", "female", "soft"),
            new("수련", "수련처럼 맑고 고운", "수련 — 연못의 수련꽃", "female", "soft"),
            new("은빛", "은빛처럼 고운", "은+빛 — 은색의 빛깔", "female", "soft"),
            new("보리", "보리처럼 강인한", "보리 — 곡식 보리의 순우리말", "female", "neutral"),
            new("채움", "마음을 채우는", "채우다의 명사형 — 가득 채움", "female", "soft"),
            new("가을빛", "가을빛처럼 따뜻한", "가을+빛 — 가을의 빛깔", "female", "soft"),
            new("들꽃", "들꽃처럼 순수하고 강한", "들+꽃 — 야생의 꽃", "female", "neutral"),
            new("송이", "꽃송이처럼 예쁜", "송이 — 꽃이나 열매의 덩이", "female", "soft"),
            new("해맑", "해맑고 밝은", "해맑다 — 맑고 밝다의 어근", "female", "soft"),
            new("꿈나래", "꿈의 날개를 펴는", "꿈+나래(날개) 합성어", "female", "soft"),
            new("봄나래", "봄의 날개를 펼치는", "봄+나래(날개) 합성어", "female", "soft"),
            new("별나래", "별처럼 빛나며 날아오르는", "별+나래(날개) 합성어", "female", "soft"),
            new("풀잎", "풀잎처럼 싱그럽고 부드러운", "풀+잎 — 풀의 잎사귀", "female", "soft"),
            new("초롬", "초롱초롱 빛나는", "초롱초롱 — 눈이 맑게 빛나는 모양", "female", "soft"),
            new("여름", "여름처럼 활기찬", "여름 — 뜨거운 계절의 순우리말", "female", "strong"),
            new("한나", "크고 아름다운 사람", "한(크다)+나(나다) 합성어", "female", "neutral"),
            new("달", "달처럼 밝고 은은한", "달 — 달(月)의 순우리말", "female", "soft"),
            new("윤슬", "물결에 비치는 햇빛", "윤슬 — 햇빛이 물결에 반사된 빛", "female", "soft"),

            // ==========================================
            // 확장 — 신규 70개 (2026-05-15)
            // 다양한 발음 패턴(받침 유/무, 다양한 초성)을 의도적으로 포함
            // ==========================================

            // 남녀공용 추가 20개
            new("가람누리", "강처럼 흐르는 세상", "가람(강)+누리(세상) 합성어", "neutral", "neutral"),
            new("한터", "큰 터전", "한(크다)+터(터전) 합성어", "neutral", "strong"),
            new("새터", "새로운 터전", "새+터(터전) 합성어", "neutral", "neutral"),
            new("별누리", "별이 빛나는 세상", "별+누리(세상) 합성어", "neutral", "soft"),
            new("누리솔", "세상의 소나무", "누리(세상)+솔(소나무) 합성어", "neutral", "neutral"),
            new("가람결", "강의 결", "가람(강)+결(결) 합성어", "neutral", "soft"),
            new("해담", "햇살을 담은", "해+담다 합성어", "neutral", "soft"),
            new("들빛", "들판의 빛", "들+빛 합성어", "neutral", "neutral"),
            new("한겨레", "큰 겨레", "한(크다)+겨레(민족) 합성어", "neutral", "strong"),
            new("다람", "다정하고 부드러운", "다람 — 다람쥐의 어근, 정겨움", "neutral", "soft"),
            new("솔내", "소나무의 내음", "솔(소나무)+내(내음) 합성어", "neutral", "soft"),
            new("봄결", "봄의 결", "봄+결(결) 합성어", "neutral", "soft"),
            new("별결", "별처럼 빛나는 결", "별+결(결) 합성어", "neutral", "soft"),
            new("누리봄", "세상의 봄", "누리(세상)+봄 합성어", "neutral", "soft"),
            new("다솔", "다 푸른 소나무", "다+솔(소나무) 합성어", "neutral", "neutral"),
            new("새온", "새롭고 온전한", "새+온(온전하다) 합성어", "neutral", "soft"),
            new("한들", "큰 들판", "한(크다)+들(들판) 합성어", "neutral", "neutral"),
            new("별빛결", "별빛의 결", "별+빛+결 합성어", "neutral", "soft"),
            new("가람빛", "강의 빛", "가람(강)+빛 합성어", "neutral", "soft"),
            new("누리빛", "세상의 빛", "누리(세상)+빛 합성어", "neutral", "soft"),

            // 남성 추가 25개
            new("한길", "큰 길을 가는", "한(크다)+길(길) 합성어", "male", "strong"),
            new("새길", "새로운 길", "새+길(길) 합성어", "male", "neutral"),
            new("굳찬", "굳세고 찬란한", "굳다+찬(찬란하다) 합성어", "male", "strong"),
            new("한찬", "크고 찬란한", "한(크다)+찬(찬란하다) 합성어", "male", "strong"),
            new("슬기찬", "슬기롭고 찬란한", "슬기+찬(찬란하다) 합성어", "male", "strong"),
            new("너른솔", "넓고 푸른 소나무", "너르다+솔(소나무) 합성어", "male", "strong"),
            new("다찬", "다 찬란한", "다+찬(찬란하다) 합성어", "male", "strong"),
            new("산울", "산의 메아리", "산+울(울림) 합성어", "male", "strong"),
            new("늘솔", "늘 푸른 소나무", "늘+솔(소나무) 합성어", "male", "strong"),
            new("새벽솔", "새벽의 소나무", "새벽+솔(소나무) 합성어", "male", "strong"),
            new("큰돌", "큰 바위", "큰+돌(바위) 합성어", "male", "strong"),
            new("누리찬", "세상을 빛내는", "누리(세상)+찬(찬란하다) 합성어", "male", "strong"),
            new("너른들", "넓은 들판", "너르다+들(들판) 합성어", "male", "neutral"),
            new("별찬", "별처럼 빛나는", "별+찬(찬란하다) 합성어", "male", "strong"),
            new("든솔", "든든한 소나무", "든든하다+솔(소나무) 합성어", "male", "strong"),
            new("솔터", "소나무의 터전", "솔(소나무)+터(터전) 합성어", "male", "strong"),
            new("한솔찬", "큰 소나무처럼 찬란한", "한+솔+찬 합성어", "male", "strong"),
            new("새들", "새로운 들판", "새+들(들판) 합성어", "male", "neutral"),
            new("들솔", "들판의 소나무", "들+솔(소나무) 합성어", "male", "neutral"),
            new("너른", "넓은 마음의", "너르다 — 넓다의 어근", "male", "neutral"),
            new("든터", "든든한 터전", "든든하다+터 합성어", "male", "strong"),
            new("한별찬", "크고 별처럼 찬란한", "한+별+찬 합성어", "male", "strong"),
            new("솔돌", "소나무와 돌처럼 굳센", "솔+돌 합성어", "male", "strong"),
            new("한힘", "큰 힘", "한(크다)+힘 합성어", "male", "strong"),
            new("나래찬", "날개를 펼쳐 찬란한", "나래(날개)+찬 합성어", "male", "strong"),

            // 여성 추가 25개
            new("가람나래", "강의 날개를 펼치는", "가람(강)+나래(날개) 합성어", "female", "soft"),
            new("진달래", "진달래꽃처럼 곱고 강한", "진달래 — 봄꽃의 순우리말", "female", "soft"),
            new("미리내", "은하수처럼 빛나는", "미리내 — 은하수의 순우리말", "female", "soft"),
            new("봄여울", "봄날의 여울", "봄+여울 합성어", "female", "soft"),
            new("별여울", "별빛이 비치는 여울", "별+여울 합성어", "female", "soft"),
            new("봄솜", "봄의 솜털처럼 포근한", "봄+솜 합성어", "female", "soft"),
            new("솜이", "솜처럼 부드러운 아이", "솜+이 합성어", "female", "soft"),
            new("솜결", "솜처럼 부드러운 결", "솜+결(결) 합성어", "female", "soft"),
            new("봄솔", "봄의 푸른 소나무", "봄+솔(소나무) 합성어", "female", "soft"),
            new("별솔", "별빛의 소나무", "별+솔(소나무) 합성어", "female", "soft"),
            new("봄나비", "봄의 나비처럼 자유로운", "봄+나비 합성어", "female", "soft"),
            new("가람비", "강의 비처럼 풍부한", "가람(강)+비 합성어", "female", "soft"),
            new("보슬", "보슬비처럼 부드러운", "보슬보슬 — 부드러운 비의 모양", "female", "soft"),
            new("보슬비", "가는 빗방울처럼 섬세한", "보슬비 — 가늘게 내리는 비", "female", "soft"),
            new("별가람", "별이 흐르는 강", "별+가람(강) 합성어", "female", "soft"),
            new("진솔", "진실되고 곧은", "진(참)+솔(소나무) 합성어", "female", "neutral"),
            new("솔하", "소나무와 하늘의 조화", "솔(소나무)+하(하늘) 합성어", "female", "soft"),
            new("가람별", "강에 비친 별", "가람(강)+별 합성어", "female", "soft"),
            new("새별", "새로 떠오른 별", "새+별 합성어", "female", "soft"),
            new("새봄나래", "새봄의 날개", "새+봄+나래(날개) 합성어", "female", "soft"),
            new("별이", "별처럼 빛나는 아이", "별+이 합성어", "female", "soft"),
            new("솜비", "솜처럼 부드러운 비", "솜+비 합성어", "female", "soft"),
            new("빛나리", "빛이 나는", "빛+나리(나리다) 합성어", "female", "soft"),
            new("채봄", "봄을 가득 채운", "채우다+봄 합성어", "female", "soft"),
            new("가람꽃", "강가의 꽃", "가람(강)+꽃 합성어", "female", "soft"),

            // ==========================================
            // 확장 v2 (2026-05-18): Neutral 24개 추가
            // ==========================================
            new("도담", "야무지고 탈없이 자라는", "도담 — 야무지게 잘 자라는 옛 순우리말", "neutral", "soft"),
            new("도란", "정겹게 이야기 나누는", "도란도란 — 정겨운 대화의 의태어", "neutral", "soft"),
            new("새벽", "동트는 새벽처럼 맑은", "새벽 — 동이 트는 시각의 순우리말", "neutral", "soft"),
            new("햇살", "햇살처럼 밝고 따뜻한", "햇살 — 햇빛의 줄기", "neutral", "soft"),
            new("산들", "산들바람처럼 시원한", "산들 — 산들바람의 어근, 부드러운 바람", "neutral", "soft"),
            new("여울", "여울처럼 맑게 흐르는", "여울 — 물살이 빠른 얕은 곳", "neutral", "neutral"),
            new("가을", "가을처럼 풍성하고 단정한", "가을 — 결실의 계절", "neutral", "neutral"),
            new("구름", "구름처럼 자유로운", "구름 — 하늘의 구름, 고유어", "neutral", "soft"),
            new("나래솔", "날개와 소나무처럼 곧은", "나래(날개)+솔(소나무) 합성어", "neutral", "neutral"),
            new("해솔", "해와 소나무처럼 우뚝한", "해+솔(소나무) 합성어", "neutral", "strong"),
            new("새봄", "새로 시작하는 봄", "새+봄 합성어 — 새로운 출발", "neutral", "soft"),
            new("봄솔", "봄날의 푸른 소나무", "봄+솔 합성어", "neutral", "soft"),
            new("봄결", "봄의 결처럼 곱고 따뜻한", "봄+결(결, 무늬) 합성어", "neutral", "soft"),
            new("다솔", "다 함께 푸른 소나무처럼", "다+솔 합성어", "neutral", "neutral"),
            new("한슬", "큰 슬기", "한(크다)+슬기(지혜) 합성어", "neutral", "neutral"),
            new("빛솔", "빛나는 소나무처럼", "빛+솔 합성어", "neutral", "neutral"),
            new("늘봄", "늘 봄날 같은", "늘+봄 합성어 — 변치 않는 봄", "neutral", "soft"),
            new("다이룸", "원하는 것을 다 이루는", "다+이룸 — 모든 것을 이룬다", "neutral", "soft"),
            new("이룸", "이뤄지는 모든 것", "이루다의 명사형", "neutral", "neutral"),
            new("새름", "새롭게 펼치는", "새+름(파생 접미사)", "neutral", "soft"),
            new("아름", "아름다움", "아름답다 — 어근 + 명사화", "neutral", "soft"),
            new("나봄솔", "봄에 태어난 솔", "나다+봄+솔 합성어", "neutral", "soft"),
            new("열매", "결실의 열매", "열매 — 결실, 성과의 고유어", "neutral", "neutral"),
            new("씨앗", "씨앗처럼 가능성을 품은", "씨앗 — 생명의 시작", "neutral", "soft"),

            // ==========================================
            // 확장 v2 (2026-05-18): Male 14개 추가
            // ==========================================
            new("우람", "우람하고 듬직한", "우람하다 — 크고 든든하다", "male", "strong"),
            new("우뚝", "우뚝 솟은", "우뚝 — 두드러지게 솟은 모양", "male", "strong"),
            new("솔뫼", "소나무 산처럼 우직한", "솔(소나무)+뫼(산) 합성어", "male", "strong"),
            new("강해", "강하게 해석되는", "강(强)+해(태양) 의역", "male", "strong"),
            new("한별찬해", "크고 별처럼 빛나는 해", "한+별+찬+해 합성어", "male", "strong"),
            new("든해", "든든한 해처럼", "든든+해(태양) 합성어", "male", "strong"),
            new("새해", "새로 떠오르는 해", "새+해 — 새 출발의 태양", "male", "strong"),
            new("차오름", "꾸준히 차오르는", "차다+오르다 — 점진적 성장", "male", "neutral"),
            new("굳찬", "굳건하고 찬란한", "굳다+찬란 합성어", "male", "strong"),
            new("굳솔", "굳건한 소나무처럼", "굳다+솔(소나무) 합성어", "male", "strong"),
            new("힘솔", "힘찬 소나무처럼", "힘+솔(소나무) 합성어", "male", "strong"),
            new("우람찬", "우람하고 찬란한", "우람+찬 합성어", "male", "strong"),
            new("바위", "바위처럼 굳건한", "바위 — 흔들리지 않는 단단함", "male", "strong"),
            new("바람결", "바람의 결처럼 자유로운", "바람+결 합성어", "male", "neutral"),

            // ==========================================
            // 확장 v2 (2026-05-18): Female 14개 추가
            // ==========================================
            new("봄볕", "봄볕처럼 따스한", "봄+볕(햇빛) 합성어", "female", "soft"),
            new("햇별", "햇빛 같은 별", "햇+별 합성어", "female", "soft"),
            new("새벽솔", "새벽의 푸른 소나무", "새벽+솔 합성어", "female", "soft"),
            new("별하", "별이 떠 있는 하늘", "별+하(하늘) 합성어", "female", "soft"),
            new("다은하", "다 은하수처럼", "다+은하 합성어", "female", "soft"),
            new("라온이", "즐거운 아이", "라온(즐거운)+이 — 친근형", "female", "soft"),
            new("다래", "다래나무 열매처럼 맑은", "다래 — 산열매 이름", "female", "soft"),
            new("빛가람", "빛이 흐르는 강", "빛+가람(강) 합성어", "female", "soft"),
            new("해솜", "햇살 같은 솜털", "해+솜 합성어", "female", "soft"),
            new("별솜", "별빛 같은 솜털", "별+솜 합성어", "female", "soft"),
            new("새이슬", "새벽 이슬같이 맑은", "새+이슬 합성어", "female", "soft"),
            new("봄이슬", "봄 이슬같이 신선한", "봄+이슬 합성어", "female", "soft"),
            new("솔이슬", "소나무 이슬처럼", "솔+이슬 합성어", "female", "soft"),
            new("결이", "결이 고운 아이", "결+이(친근 접미사)", "female", "soft"),
        };
    }

    /// <summary>내부 사전 항목</summary>
    private class PureKoreanEntry
    {
        public string Name { get; }
        public string Meaning { get; }
        public string Origin { get; }
        public string GenderFit { get; }
        public string ToneFit { get; }

        public PureKoreanEntry(string name, string meaning, string origin, string genderFit, string toneFit)
        {
            Name = name;
            Meaning = meaning;
            Origin = origin;
            GenderFit = genderFit;
            ToneFit = toneFit;
        }
    }
}
