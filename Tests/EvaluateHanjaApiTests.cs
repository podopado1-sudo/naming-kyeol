using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NameForm.Api.Controllers;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using NameForm.Domain.Models.Saju;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Tests;

/// <summary>
/// /evaluate 의 한자 입력 — 응답·판정 API 층(설계서 docs/plan-hanja-input-2026-11.md §13-1 의 ⑧·⑨ 응답 몫, ⑨-2 정규 꼴 왕복, ⑪ 성씨 표시,
/// ⑬ 로그, ⑯ ElementFit·fills, ⑱ /hanja/resolve, ⑲ hanjaSummary 는 던지지 않는다). 계산 층(picks 가 점수에 들어가는지)은 <see cref="EvaluateUserHanjaTests"/>.
/// 컨트롤러를 직접 만들어 부른다(진짜 평가 서비스·사주·용신). 출생일이 들어가는 기대값(용신·부족 오행·자동 배정 글자)은 숫자를 적어 두지 않고
/// 테스트 안에서 사주·용신 서비스로 다시 센다.
/// ⚠️ 이름·성씨에 넣는 한자는 코드포인트 숫자(<see cref="Cp"/>)로만 적는다(호환 한자·BMP 밖 글자를 글자로 적지 않는다).
/// 오행·음양 글자(木·火·土·金·水·陰·陽)는 엔진과 같은 통합 한자 리터럴이고, 주석의 한자는 모두 통합 한자다.
/// </summary>
public class EvaluateHanjaApiTests
{
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();

    public EvaluateHanjaApiTests()
    {
        HanjaData.LoadExternalData();
    }

    // ── 도우미 ───────────────────────────────────────────────────────────────────

    private static string Cp(int codePoint) => char.ConvertFromUtf32(codePoint);
    private static HanjaInfo Hanja(int codePoint) => HanjaData.FindByCharacter(Cp(codePoint))
        ?? throw new InvalidOperationException($"U+{codePoint:X4} 가 사전에 없다");

    /// <summary>메시지·구조화 속성 값·예외 문구를 모두 모으는 테스트 로거(SajuControllerLoggingTests 와 같은 꼴)</summary>
    private sealed class CollectingLogger<T> : ILogger<T>
    {
        public List<string> Texts { get; } = new();
        public int Count { get; private set; }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            Texts.Add(state.ToString() ?? "");
            return null;
        }

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Count++;
            Texts.Add(formatter(state, exception));
            if (state is IEnumerable<KeyValuePair<string, object?>> props)
                foreach (var kv in props) Texts.Add($"{kv.Key}={kv.Value}");
            if (exception != null) Texts.Add(exception.ToString());
        }
    }

    private sealed class RecordingTracker : IUsageTracker
    {
        public List<(string EventType, string Key)> Events { get; } = new();
        public Task TrackAsync(string eventType, string key) { Events.Add((eventType, key)); return Task.CompletedTask; }
    }

    /// <summary>진짜 평가 서비스를 부르면서 컨트롤러가 넘긴 지정(picks)을 적어 둔다.</summary>
    private sealed class RecordingEvaluationService(INameEvaluationService inner) : INameEvaluationService
    {
        public List<HanjaPicks?> Picks { get; } = new();

        public Task<NameEvaluationResultDto> EvaluateNameAsync(
            string name, string lastName, DateTime? birthDate, string gender, string tone,
            TimeSpan? birthTime = null, HanjaPicks? picks = null)
        {
            Picks.Add(picks);
            return inner.EvaluateNameAsync(name, lastName, birthDate, gender, tone, birthTime, picks);
        }
    }

    private sealed class Api
    {
        public CollectingLogger<RecommendationsController> Logger { get; } = new();
        public RecordingTracker Tracker { get; } = new();
        public RecordingEvaluationService Service { get; }
        public RecommendationsController Controller { get; }

        public Api(INameEvaluationService real)
        {
            Service = new RecordingEvaluationService(real);
            // 평가 엔드포인트가 쓰는 것은 로거·평가 서비스·사용 통계뿐이다
            Controller = new RecommendationsController(null!, null!, Logger,
                null!, null!, null!, null!, null!, null!, null!, null!, Service, Tracker);
        }
    }

    private Api NewApi() => new(new NameEvaluationService(
        new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
        new ExplanationEngine()));

    private static NameEvaluateRequestDto Request(
        string name, string lastName, string? date = null, string? time = null, string gender = "none",
        string? nameHanja = null, string? lastNameHanja = null)
        => new()
        {
            Name = name, LastName = lastName, BirthDate = date ?? "", BirthTime = time, Gender = gender, Tone = "neutral",
            NameHanja = nameHanja, LastNameHanja = lastNameHanja,
        };

    private static NameEvaluationResultDto OkBody(ActionResult<NameEvaluationResultDto> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<NameEvaluationResultDto>(ok.Value);
    }

    private static (string Error, string Code, string Target, int Slot, int PropertyCount) Problem<T>(ActionResult<T> result)
    {
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var value = bad.Value!;
        object? Get(string name) => value.GetType().GetProperty(name)?.GetValue(value);
        return ((string)Get("error")!, (string)Get("code")!, (string)Get("target")!, (int)Get("slot")!, value.GetType().GetProperties().Length);
    }

    /// <summary>API 와 같은 직렬화(웹 기본값 — camelCase, 한글·한자 그대로)</summary>
    private static readonly JsonSerializerOptions ApiJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static string Json(object value) => JsonSerializer.Serialize(value, ApiJsonOptions);

    /// <summary>한자(통합·확장·호환)나 부수 블록 글자가 들어 있는가 — 로그에 한자가 실리지 않았는지 볼 때 쓴다.</summary>
    private static bool HasHan(string text) => text.EnumerateRunes().Any(r =>
        HanjaData.IsHanCodePoint(r.ToString()) || (r.Value >= 0x2E80 && r.Value <= 0x2FD5));

    private static bool IsCompatOrMark(System.Text.Rune r) =>
        (r.Value >= 0xF900 && r.Value <= 0xFAFF) || (r.Value >= 0x2F800 && r.Value <= 0x2FA1F)
        || (r.Value >= 0xFE00 && r.Value <= 0xFE0F) || (r.Value >= 0xE0100 && r.Value <= 0xE01EF)
        || System.Text.Rune.IsWhiteSpace(r);

    private static bool IsKoreanSentence(string message) =>
        Regex.IsMatch(message, "[가-힣]") && !Regex.IsMatch(message, "[a-z]");

    private static (int Won, int Hyeong) Suri(IEnumerable<string> notes)
    {
        var note = Assert.Single(notes, n => n.StartsWith("수리사격(전통 81수리, 참고): "));
        var m = Regex.Match(note, @"원격 (\d+)\(.+?\) · 형격 (\d+)\(");
        Assert.True(m.Success, note);
        return (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value));
    }

    private static readonly (string? Date, string? Time)[] Births = { (null, null), ("2024-03-15", null), ("2021-07-08", "09:30") };
    private static readonly string[] FiveElements = { "木", "火", "土", "金", "水" };

    // ═══════════════════════════════════════════════════════════════
    // ⑧ 지정 없음으로 접히는 요청 = 한자 필드 없는 요청 (응답·통계 키)
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> FoldedRequests() => new[]
    {
        new object?[] { "한빛", "김", "*-", null },                        // ⑧-2 잠긴 칸의 '-'
        new object?[] { "빛봄", "김", "--", null },
        new object?[] { "몰닉", "김", "--", "" },
        new object?[] { "서윤", "이", "**", Cp(0x674E) },                  // 전부 자동 + 대표 한자(李)
        new object?[] { "서윤", "이", "", Cp(0xF9E1) },                    // 대표 한자의 호환 코드
        new object?[] { "서윤", "남궁", " * * ", Cp(0x5357) + "*" },       // 복성 한 글자만(南*) — 채우면 표의 글자
        new object?[] { "서윤", "이", null, "*" },
        new object?[] { "서아린", "유", "***", Cp(0x67F3) },               // 柳
    };

    [Theory]
    [MemberData(nameof(FoldedRequests))]
    public async Task Folded_Request_SerializesTheSameAsNoField_AndCountsAsEvaluate(
        string name, string lastName, string? nameHanja, string? lastNameHanja)
    {
        foreach (var (date, time) in Births)
        {
            var api = NewApi();
            var plain = OkBody(await api.Controller.EvaluateName(Request(name, lastName, date, time, "female")));
            var folded = OkBody(await api.Controller.EvaluateName(
                Request(name, lastName, date, time, "female", nameHanja, lastNameHanja)));

            Assert.Equal(Json(plain), Json(folded));
            Assert.NotNull(folded.HanjaSummary);
            Assert.False(folded.HanjaSummary!.UserHanja);
            Assert.Equal("", folded.HanjaSummary.NameHanja);
            Assert.Equal("", folded.HanjaSummary.LastNameHanja);

            // 통계 키는 둘 다 evaluate, 서비스에는 지정 없이(null) 넘어간다 — 예전 경로
            Assert.Equal(new[] { ("endpoint", "evaluate"), ("endpoint", "evaluate") }, api.Tracker.Events);
            Assert.Equal(new HanjaPicks?[] { null, null }, api.Service.Picks);
        }
    }

    [Fact]
    public async Task Specified_Request_CountsAsEvaluateHanja_AndPassesPicksToTheService()
    {
        var api = NewApi();

        // 이름 한 칸을 고름 / 성씨만 고름(표의 글자와 다른 劉) / 한 칸을 비움 — 모두 '한자를 정한 요청'
        var first = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", "2024-03-15", nameHanja: Cp(0x745E) + "*")));
        var second = OkBody(await api.Controller.EvaluateName(Request("서윤", "유", lastNameHanja: Cp(0x5289))));
        var third = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", nameHanja: "*-")));

        Assert.Equal(Enumerable.Repeat(("endpoint", "evaluate-hanja"), 3), api.Tracker.Events);
        Assert.All(api.Service.Picks, p => Assert.NotNull(p));
        Assert.Equal(Cp(0x745E) + "*", api.Service.Picks[0]!.NameText);
        Assert.Equal(Cp(0x5289), api.Service.Picks[1]!.SurnameText);
        Assert.True(api.Service.Picks[2]!.AnyNone);

        Assert.All(new[] { first, second, third }, r => Assert.True(r.HanjaSummary!.UserHanja));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑨-2 정규 꼴 왕복 — 응답의 nameHanja·lastNameHanja 를 그대로 다시 보내면 응답이 같다(한 번에 수렴)
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> RoundTripCases()
    {
        string tangDefault = Cp(0x6E6F);   // 湯 — 표 밖 성씨 '탕'의 추정 글자(아래 테스트가 SurnameDefaultAt 과 같은지 본다)
        return new[]
        {
            // 이름, 성씨, 보낸 이름 한자, 보낸 성씨 한자, 기대 정규 꼴(이름), 기대 정규 꼴(성씨)
            new object?[] { "서연", "이", Cp(0x745E) + Cp(0xF999), Cp(0xF9E1), Cp(0x745E) + Cp(0x84EE), "" },   // 호환 한자(蓮·李) → 통합, 대표 성씨는 접힘
            new object?[] { "서윤", "이", Cp(0x745E) + "*", Cp(0x674E), Cp(0x745E) + "*", "" },                 // 대표 성씨 李
            new object?[] { "서윤", "남궁", "*" + Cp(0x6F64), Cp(0x5357) + "*", "*" + Cp(0x6F64), "" },         // 복성 南* → 표의 글자라 접힘
            new object?[] { "서윤", "남궁", null, Cp(0x7537) + "*", "", Cp(0x7537) + Cp(0x5BAE) },              // 복성 男* → '*' 자리를 채운 男宮
            new object?[] { "서윤", "탕", Cp(0x745E) + "-", tangDefault, Cp(0x745E) + "-", tangDefault },       // 표 밖 성씨 — 추정 글자와 같아도 접지 않는다
            new object?[] { "서윤", "탕쁨", Cp(0x745E) + "*", Cp(0x6E6F) + "*", Cp(0x745E) + "*", Cp(0x6E6F) + "*" }, // 채울 글자가 없는 자리는 '*' 그대로
            new object?[] { "한빛", "김", Cp(0x6F22) + "-", null, Cp(0x6F22) + "*", "" },                       // 잠긴 칸의 '-' → '*'
            new object?[] { "미소", "김", Cp(0x5A9A) + "-", null, Cp(0x5A9A) + "-", "" },                       // 비운 칸
            new object?[] { "하늘", "제갈", "--", null, "--", "" },
            new object?[] { "서윤", "이", " " + Cp(0x745E) + Cp(0xFE00) + " * ", null, Cp(0x745E) + "*", "" },          // 공백·이체 선택자
            new object?[] { "울림", "박", Cp(0x200D7) + "*", null, Cp(0x200D7) + "*", "" },                     // BMP 밖 글자(UTF-16 길이 2)
            new object?[] { "서윤", "유", null, Cp(0x5289), "", Cp(0x5289) },                                   // 성씨만(劉)
            new object?[] { "한빛", "김", "*-", null, "", "" },                                                 // 지정 없음으로 접힘
        };
    }

    [Theory]
    [MemberData(nameof(RoundTripCases))]
    public async Task CanonicalForm_SentBack_GivesTheSameResponse(
        string name, string lastName, string? nameHanja, string? lastNameHanja, string expectedName, string expectedLastName)
    {
        Assert.Equal(Cp(0x6E6F), HanjaInput.SurnameDefaultAt("탕", 0)!.Character);

        foreach (var (date, time) in Births)
        {
            var api = NewApi();
            var first = OkBody(await api.Controller.EvaluateName(Request(name, lastName, date, time, "female", nameHanja, lastNameHanja)));
            var summary = first.HanjaSummary!;

            Assert.Equal(expectedName, summary.NameHanja);
            Assert.Equal(expectedLastName, summary.LastNameHanja);
            Assert.Equal(expectedName != "" || expectedLastName != "", summary.UserHanja);

            // 정규 꼴: 통합 한자만, 공백·이체 선택자 없음, 이름 한자는 비었거나 이름 글자 수(룬)만큼
            Assert.DoesNotContain(summary.NameHanja.EnumerateRunes(), IsCompatOrMark);
            Assert.DoesNotContain(summary.LastNameHanja.EnumerateRunes(), IsCompatOrMark);
            Assert.Contains(summary.NameHanja.EnumerateRunes().Count(), new[] { 0, name.Length });
            Assert.Contains(summary.LastNameHanja.EnumerateRunes().Count(), new[] { 0, lastName.Length });

            var second = OkBody(await api.Controller.EvaluateName(
                Request(name, lastName, date, time, "female", summary.NameHanja, summary.LastNameHanja)));

            Assert.Equal(Json(first), Json(second));
            Assert.Equal(summary.NameHanja, second.HanjaSummary!.NameHanja);
            Assert.Equal(summary.LastNameHanja, second.HanjaSummary.LastNameHanja);
            Assert.Equal(api.Tracker.Events[0], api.Tracker.Events[1]);   // 통계 키도 갈리지 않는다
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // hanjaSummary — 칸의 출처(source)와 글자 사실
    // ═══════════════════════════════════════════════════════════════

    private static void AssertFact(HanjaInfo expected, string syllable, HanjaFactDto? actual)
    {
        Assert.NotNull(actual);
        Assert.Equal(expected.Character, actual!.Character);
        Assert.Equal(HanjaData.GlossForReading(expected.Meaning, syllable), actual.Gloss);
        Assert.Equal(expected.FiveElement, actual.FiveElement);
        Assert.Equal(expected.ResourceGrade, actual.ResourceGrade);
        Assert.Equal(expected.StrokeCount, actual.StrokeCount);
        Assert.Equal(expected.StrokeCount % 2 == 1 ? "陽" : "陰", actual.YinYang);   // 음양 = 획수 홀짝(홀수 陽)
        Assert.Equal(!string.IsNullOrEmpty(expected.Meaning), actual.HasMeaning);
        int cp = char.ConvertToUtf32(expected.Character, 0);
        Assert.Equal(cp >= 0x4E00 && cp <= 0x9FFF, actual.Basic);
    }

    [Fact]
    public async Task Summary_Sources_AreUserAutoNoneUnavailable_AndAutoSlotsKeepTheAutoAssignment()
    {
        foreach (var (date, time) in Births)
        {
            var api = NewApi();

            // 서윤 — 첫 칸만 고름(瑞): [user, auto]. 자동 칸은 같은 조건의 지정 없는 응답과 같은 글자다
            var plain = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", date, time, "female")));
            var partial = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", date, time, "female", Cp(0x745E) + "*")));
            Assert.Equal(new[] { "auto", "auto" }, plain.HanjaSummary!.Syllables.Select(s => s.Source));
            Assert.Equal(new[] { "user", "auto" }, partial.HanjaSummary!.Syllables.Select(s => s.Source));
            Assert.Equal(new[] { "서", "윤" }, partial.HanjaSummary.Syllables.Select(s => s.Syllable));
            AssertFact(Hanja(0x745E), "서", partial.HanjaSummary.Syllables[0].Hanja);
            Assert.Equal(plain.HanjaSummary.Syllables[1].Hanja!.Character, partial.HanjaSummary.Syllables[1].Hanja!.Character);
            // 글자 사실은 사전 원자료와 같다(자동 칸도)
            AssertFact(HanjaData.FindByCharacter(plain.HanjaSummary.Syllables[1].Hanja!.Character)!, "윤", plain.HanjaSummary.Syllables[1].Hanja);
            // 응답의 다른 자리(후보 표 첫 칸)와 같은 글자 — 블록과 표가 갈리지 않는다
            Assert.Equal(partial.HanjaCandidates[0].Candidates[0].Character, partial.HanjaSummary.Syllables[0].Hanja!.Character);
            Assert.Equal(partial.HanjaCandidates[1].Candidates[0].Character, partial.HanjaSummary.Syllables[1].Hanja!.Character);

            // 미소 — 불용 글자(媚)를 고르고 둘째 칸을 비움: [user, none]. 불용 글자는 막지 않고 forbidden 으로 알린다
            var forbidden = OkBody(await api.Controller.EvaluateName(Request("미소", "김", date, time, "female", Cp(0x5A9A) + "-")));
            Assert.Equal(new[] { "user", "none" }, forbidden.HanjaSummary!.Syllables.Select(s => s.Source));
            Assert.True(forbidden.HanjaSummary.Syllables[0].Hanja!.Forbidden);
            Assert.False(forbidden.HanjaSummary.Syllables[0].Hanja!.Common);
            Assert.Null(forbidden.HanjaSummary.Syllables[1].Hanja);
            Assert.Empty(forbidden.HanjaSummary.Syllables[1].Fills);
            // 불용 글자는 '한자 후보' 표에 없고, 조화·미학의 성별 값에도 세지 않는다(계산 층 테스트와 같은 사실을 응답에서 한 번 더)
            Assert.DoesNotContain(forbidden.HanjaCandidates[0].Candidates, c => c.Character == Cp(0x5A9A));
            Assert.Equal(0, forbidden.Harmony.GenderBonus);
            Assert.DoesNotContain(forbidden.Harmony.Notes, n => n.Contains("성별 선호도"));

            // 한빛 — 잠긴 칸에 '-' 가 와도 unavailable
            var locked = OkBody(await api.Controller.EvaluateName(Request("한빛", "김", date, time, "female", Cp(0x6F22) + "-")));
            Assert.Equal(new[] { "user", "unavailable" }, locked.HanjaSummary!.Syllables.Select(s => s.Source));
            Assert.Null(locked.HanjaSummary.Syllables[1].Hanja);

            // 몰닉 — 쓸 수 있는 인명용 한자가 없는 음절뿐
            var none = OkBody(await api.Controller.EvaluateName(Request("몰닉", "김", date, time, "female")));
            Assert.Equal(new[] { "unavailable", "unavailable" }, none.HanjaSummary!.Syllables.Select(s => s.Source));
            Assert.All(none.HanjaSummary.Syllables, s => { Assert.Null(s.Hanja); Assert.Empty(s.Fills); });

            // 먼저 보여 드리는 글자 표시 — 瑞 는 빈출 목록의 비약자, 媚 는 아니다
            Assert.True(partial.HanjaSummary.Syllables[0].Hanja!.Common);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑪ 성씨 — 출처·획수·글자, 이름용 표시는 싣지 않는다
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Summary_Surname_AllTableSurnames_ShowTableHanja_WithoutNameQualityFlags()
    {
        var api = NewApi();
        int forbiddenAsName = 0, commonAsName = 0;

        foreach (var (surname, table) in SurnameData.RepresentativeHanja)
        {
            if (surname.Length > 2) continue;   // 요청 DTO 가 성씨를 2자까지 받는다
            var summary = OkBody(await api.Controller.EvaluateName(Request("서윤", surname))).HanjaSummary!;

            Assert.Equal(surname, summary.Surname.Hangul);
            Assert.Equal("default", summary.Surname.Source);
            Assert.Equal(table, string.Concat(summary.Surname.Chars.Select(c => c.Character)));
            Assert.Equal(surname.Length, summary.Surname.Chars.Count);
            Assert.Equal(summary.Surname.Chars.Sum(c => c.StrokeCount), summary.Surname.Strokes);
            Assert.Equal(SurnameData.ResolveStrokes(surname).Strokes, summary.Surname.Strokes);

            foreach (var fact in summary.Surname.Chars)
            {
                // 성씨 글자에는 '이름에 피하는 글자'·'먼저 보여 드리는 글자' 표시를 싣지 않는다 — 이름 글자였다면 붙었을 글자도
                Assert.False(fact.Forbidden, $"{surname} {fact.Character}");
                Assert.False(fact.Common, $"{surname} {fact.Character}");
                if (HanjaData.IsForbiddenNameHanja(fact.Character)) forbiddenAsName++;
                if (HanjaData.IsCommonNameHanja(fact.Character) && !HanjaData.IsWeakGivenNameHanja(fact.Character)) commonAsName++;
            }
        }

        // 이 단언이 실제로 일을 하는지 — 대표 한자 가운데 사이트 불용 글자(민 閔·필 畢·풍 馮·독고 孤)와 빈출 글자가 있다
        Assert.True(forbiddenAsName >= 4, $"불용인 성씨 대표 한자 {forbiddenAsName}");
        Assert.True(commonAsName >= 10, $"빈출 목록에 든 성씨 대표 한자 {commonAsName}");
    }

    [Fact]
    public async Task Summary_Surname_SourceAndStrokes_FollowWhatSuriUsed()
    {
        var api = NewApi();
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(0x5289)));   // 劉 — 사이트 불용 글자인 성씨 한자
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(0x9B6F)));   // 魯

        async Task<NameEvaluationResultDto> Run(string lastName, string? lastNameHanja, string? date = "2024-03-15")
            => OkBody(await api.Controller.EvaluateName(Request("서윤", lastName, date, lastNameHanja: lastNameHanja)));

        // 고른 성씨 한자(유 + 劉, 노 + 魯) — user, 획수 = 그 글자, 이름용 표시 없음
        foreach (var (lastName, cp) in new[] { ("유", 0x5289), ("노", 0x9B6F) })
        {
            var picked = await Run(lastName, Cp(cp));
            var surname = picked.HanjaSummary!.Surname;
            Assert.Equal("user", surname.Source);
            Assert.Equal(Hanja(cp).StrokeCount, surname.Strokes);
            var fact = Assert.Single(surname.Chars);
            Assert.Equal(Cp(cp), fact.Character);
            Assert.False(fact.Forbidden);
            Assert.False(fact.Common);
            var (won, hyeong) = Suri(picked.Harmony.Notes);
            Assert.Equal(surname.Strokes, hyeong - won);   // 수리의 형격 − 원격 = 성씨 획수

            // 대표 한자와 다르다 — 지정 없는 응답은 default 이고 획수가 표의 글자 것
            var plain = await Run(lastName, null);
            Assert.Equal("default", plain.HanjaSummary!.Surname.Source);
            var (plainWon, plainHyeong) = Suri(plain.Harmony.Notes);
            Assert.Equal(plain.HanjaSummary.Surname.Strokes, plainHyeong - plainWon);
            Assert.NotEqual(Cp(cp), plain.HanjaSummary.Surname.Chars[0].Character);
        }

        // 복성 — 두 글자 합. 한 글자만 고르면(男*) 나머지 자리는 표의 글자(宮)로 채운다
        var compound = await Run("남궁", Cp(0x7537) + "*");
        Assert.Equal("user", compound.HanjaSummary!.Surname.Source);
        Assert.Equal(new[] { Cp(0x7537), Cp(0x5BAE) }, compound.HanjaSummary.Surname.Chars.Select(c => c.Character));
        Assert.Equal(Hanja(0x7537).StrokeCount + Hanja(0x5BAE).StrokeCount, compound.HanjaSummary.Surname.Strokes);
        var (cWon, cHyeong) = Suri(compound.Harmony.Notes);
        Assert.Equal(compound.HanjaSummary.Surname.Strokes, cHyeong - cWon);

        // 표에 없는 성씨 — estimated, 글자 = 독음 추정(ResolveStrokes)
        var estimated = await Run("탕", null);
        Assert.Equal("estimated", estimated.HanjaSummary!.Surname.Source);
        Assert.Equal(SurnameData.ResolveStrokes("탕").Hanja, string.Concat(estimated.HanjaSummary.Surname.Chars.Select(c => c.Character)));
        Assert.Equal(SurnameData.ResolveStrokes("탕").Strokes, estimated.HanjaSummary.Surname.Strokes);
        Assert.True(estimated.HanjaSummary.Surname.Strokes > 0);

        // 추정 글자와 같은 글자를 골라도 접지 않는다 — user
        var sameAsEstimate = await Run("탕", SurnameData.ResolveStrokes("탕").Hanja);
        Assert.Equal("user", sameAsEstimate.HanjaSummary!.Surname.Source);
        Assert.True(sameAsEstimate.HanjaSummary.UserHanja);

        // 성씨 글자를 전부 정하지 못하면 chars 는 빈 목록·획수 0 (추정이 끊김: 쁨 / 탕쁨 / 쁨탕, 고른 뒤에도 빈 자리: 탕쁨 + 湯*)
        foreach (var (lastName, lastNameHanja, source) in new[]
                 {
                     ("쁨", (string?)null, "estimated"), ("탕쁨", null, "estimated"), ("쁨탕", null, "estimated"),
                     ("탕쁨", Cp(0x6E6F) + "*", "user"),
                 })
            foreach (var date in new[] { null, "2024-03-15" })
            {
                var broken = await Run(lastName, lastNameHanja, date);
                Assert.Equal(source, broken.HanjaSummary!.Surname.Source);
                Assert.Empty(broken.HanjaSummary.Surname.Chars);
                Assert.Equal(0, broken.HanjaSummary.Surname.Strokes);
                Assert.Equal(lastName, broken.HanjaSummary.Surname.Hangul);
                if (date != null)
                {
                    var (bWon, bHyeong) = Suri(broken.Harmony.Notes);
                    Assert.Equal(0, bHyeong - bWon);
                }
            }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑯ ElementFit · fills — 점수가 쓴 값과 같은 말을 한다
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void ElementFit_Balance_HandTable()
    {
        // 여섯 글자(시각 없음): 평균 1.2 → 1개 이하는 모두 부족, 1.8개 초과가 과다
        var six = new Dictionary<string, int> { ["木"] = 3, ["火"] = 1, ["土"] = 1, ["金"] = 1, ["水"] = 0 };
        var (lacking6, excessive6) = ElementFit.Balance(six);
        Assert.Equal(new[] { "火", "土", "金", "水" }, lacking6);
        Assert.Equal(new[] { "木" }, excessive6);

        // 여덟 글자: 평균 1.6 → 1개 이하가 부족, 2.4개 초과가 과다(2개는 과다가 아니다)
        var eight = new Dictionary<string, int> { ["木"] = 2, ["火"] = 2, ["土"] = 2, ["金"] = 1, ["水"] = 1 };
        var (lacking8, excessive8) = ElementFit.Balance(eight);
        Assert.Equal(new[] { "金", "水" }, lacking8);
        Assert.Empty(excessive8);

        var skewed = new Dictionary<string, int> { ["木"] = 0, ["火"] = 4, ["土"] = 3, ["金"] = 1, ["水"] = 0 };
        var (lackingS, excessiveS) = ElementFit.Balance(skewed);
        Assert.Equal(new[] { "木", "金", "水" }, lackingS);
        Assert.Equal(new[] { "火", "土" }, excessiveS);

        // 사주를 못 구했으면 null(던지지 않는다), 빈 용신은 null 로
        Assert.Null(ElementFit.From(null, "水", "金", "土"));
        Assert.Null(ElementFit.From(new Dictionary<string, int>(), "水", "金", "土"));
        var fit = ElementFit.From(six, "", null, "土")!;
        Assert.Null(fit.Yongshin);
        Assert.Null(fit.Heeshin);
        Assert.Equal("土", fit.Gishin);
        Assert.Equal(six, fit.Counts);
        Assert.NotSame(six, fit.Counts);
    }

    [Fact]
    public void ElementFit_RolesOf_HandTable()
    {
        var fit = new ElementFit("水", "金", "土",
            Lacking: new[] { "水", "土" }, Excessive: new[] { "木", "金" },
            Counts: new Dictionary<string, int> { ["木"] = 3, ["火"] = 2, ["土"] = 1, ["金"] = 3, ["水"] = 0 });

        Assert.Equal(new[] { "yongshin", "lacking" }, fit.RolesOf("水"));
        Assert.Equal(new[] { "heeshin" }, fit.RolesOf("金"));           // 희신이면 많은 오행이어도 excessive 를 붙이지 않는다
        Assert.Equal(new[] { "gishin", "lacking" }, fit.RolesOf("土")); // 기신이 부족한 오행이면 둘 다
        Assert.Equal(new[] { "excessive" }, fit.RolesOf("木"));
        Assert.Empty(fit.RolesOf("火"));
        Assert.Empty(fit.RolesOf(""));
        Assert.Empty(fit.RolesOf(null));

        // 용신이 많은 오행이어도 excessive 없음
        var yongExcess = new ElementFit("木", null, null, Array.Empty<string>(), new[] { "木" }, new Dictionary<string, int>());
        Assert.Equal(new[] { "yongshin" }, yongExcess.RolesOf("木"));

        // 용신을 못 구한 경우 — 부족·과다만
        var noYongshin = new ElementFit(null, null, null, new[] { "水" }, new[] { "木" }, new Dictionary<string, int>());
        Assert.Equal(new[] { "lacking" }, noYongshin.RolesOf("水"));
        Assert.Equal(new[] { "excessive" }, noYongshin.RolesOf("木"));
    }

    private sealed class ThrowingYongshinService : IYongshinCalculationService
    {
        public YongshinResult Calculate(SajuChart chart) => throw new InvalidOperationException("용신 계산 실패");
    }

    [Fact]
    public async Task ElementFit_WithoutOrWithFailingYongshin_KeepsCountsAndBalance_WithNullYongshin()
    {
        var date = new DateTime(2024, 3, 15);
        var chart = _saju.CalculateChart(date, null);
        var (lacking, excessive) = ElementFit.Balance(chart.FiveElementCount);

        foreach (var engine in new[] { new HarmonyEngine(_saju), new HarmonyEngine(_saju, new ThrowingYongshinService()) })
            foreach (var name in new[] { "서윤", "몰닉" })   // 몰닉 = 전 음절 한자 없음(기본값 분기)에서도 실린다
            {
                var breakdown = await engine.CalculateScoreWithBreakdownAsync(name, "김", date, "female");
                var fit = breakdown.ElementFit;
                Assert.NotNull(fit);
                Assert.Null(fit!.Yongshin);
                Assert.Null(fit.Heeshin);
                Assert.Null(fit.Gishin);
                Assert.Equal(chart.FiveElementCount, fit.Counts);
                Assert.Equal(lacking, fit.Lacking);
                Assert.Equal(excessive, fit.Excessive);
            }
    }

    [Fact]
    public async Task ElementFit_AndFills_SayTheSameAsTheHarmonyNotes_OnGrid()
    {
        var api = NewApi();
        var roleRows = new Dictionary<string, int>
        {
            ["yongshin"] = 0, ["heeshin"] = 0, ["gishin"] = 0, ["lacking"] = 0, ["excessive"] = 0,
        };
        int rows = 0;

        var births = new (string Date, string? Time)[]
        {
            ("2024-03-15", null), ("2021-07-08", "09:30"), ("2023-11-20", null), ("2019-12-31", "23:40"), ("2025-03-02", null),
        };

        foreach (var name in new[] { "서윤", "지우", "민준", "하늘", "한빛", "몰닉", "서아린", "민" })
            foreach (var (date, time) in births)
            {
                // 기대값 — 사주·용신 서비스로 따로 센다(응답을 만든 코드를 부르지 않는다)
                var chart = _saju.CalculateChart(DateTime.Parse(date), time == null ? null : TimeSpan.Parse(time));
                var counts = chart.FiveElementCount;
                double average = counts.Values.Average();
                var lacking = counts.Where(kv => kv.Value < average).Select(kv => kv.Key).ToList();
                var excessive = counts.Where(kv => kv.Value > average * 1.5).Select(kv => kv.Key).ToList();
                var yongshin = _yongshin.Calculate(chart);
                string yong = yongshin.PrimaryYongshin, hee = yongshin.Heeshin, gi = yongshin.Gishin;

                List<string> ExpectedRoles(string element)
                {
                    var roles = new List<string>();
                    if (element == yong) roles.Add("yongshin");
                    if (element == hee) roles.Add("heeshin");
                    if (element == gi) roles.Add("gishin");
                    if (lacking.Contains(element)) roles.Add("lacking");
                    if (excessive.Contains(element) && element != yong && element != hee) roles.Add("excessive");
                    return roles;
                }

                // 지정 없음 + 첫 칸에 오행별 한자를 하나씩 골라 넣은 것(자동 배정은 기신·많은 오행 글자를 거의 고르지 않는다)
                var variants = new List<string?> { null };
                var usable = HanjaInput.CandidatesFor(name[0]).Where(HanjaSelector.IsUsableNameHanja).ToList();
                foreach (var element in FiveElements)
                    if (usable.FirstOrDefault(h => h.FiveElement == element) is { } pick)
                        variants.Add(pick.Character + new string('*', name.Length - 1));

                foreach (var nameHanja in variants)
                {
                    var response = OkBody(await api.Controller.EvaluateName(Request(name, "김", date, time, "female", nameHanja)));
                    var summary = response.HanjaSummary!;
                    var fit = summary.ElementFit;
                    rows++;

                    // elementFit = 사주 글자의 오행 개수와 그 평균 기준 부족·과다, 용신 세 값
                    Assert.NotNull(fit);
                    Assert.Equal(counts.ToList(), fit!.Counts.ToList());
                    Assert.Equal(time == null ? 6 : 8, fit.Counts.Values.Sum());
                    Assert.Equal(lacking, fit.Lacking);
                    Assert.Equal(excessive, fit.Excessive);
                    Assert.All(fit.Lacking, e => Assert.True(fit.Counts[e] < average));
                    Assert.Equal(string.IsNullOrEmpty(yong) ? null : yong, fit.Yongshin);
                    Assert.Equal(string.IsNullOrEmpty(hee) ? null : hee, fit.Heeshin);
                    Assert.Equal(string.IsNullOrEmpty(gi) ? null : gi, fit.Gishin);

                    // fills = 그 글자 자원오행의 역할
                    foreach (var syllable in summary.Syllables)
                    {
                        if (syllable.Hanja == null) { Assert.Empty(syllable.Fills); continue; }
                        Assert.Equal(ExpectedRoles(syllable.Hanja.FiveElement), syllable.Fills);
                        foreach (var role in syllable.Fills) roleRows[role]++;
                    }

                    // 노트와 같은 말 — 역할이 붙은 글자가 있으면 그 노트가 있고, 노트가 있으면 그 역할의 글자가 있다
                    var notes = response.Harmony.Notes;
                    bool AnyFill(string role) => summary.Syllables.Any(s => s.Fills.Contains(role));
                    bool AnyFillOf(string role, string element) =>
                        summary.Syllables.Any(s => s.Hanja?.FiveElement == element && s.Fills.Contains(role));

                    Assert.Equal(AnyFill("yongshin"), notes.Contains($"용신 '{yong}' 보완"));
                    Assert.Equal(AnyFill("heeshin"), notes.Contains($"희신 '{hee}' 포함"));
                    Assert.Equal(AnyFill("gishin"), notes.Contains($"기신 '{gi}' 충돌 (감점)"));
                    foreach (var element in FiveElements)
                    {
                        bool lackingNote = notes.Contains($"부족한 오행 '{element}' 보완")
                            || notes.Contains($"기신 '{element}' — 사주에 부족한 오행이라 감점 일부 상쇄");
                        Assert.Equal(AnyFillOf("lacking", element), lackingNote);
                        Assert.Equal(AnyFillOf("excessive", element), notes.Contains($"과다한 오행 '{element}' 증가 (감점)"));
                    }
                }

                // 출생일이 없으면 elementFit 은 null, fills 는 모두 빈 목록
                var noBirth = OkBody(await api.Controller.EvaluateName(Request(name, "김", gender: "female"))).HanjaSummary!;
                Assert.Null(noBirth.ElementFit);
                Assert.All(noBirth.Syllables, s => Assert.Empty(s.Fills));
            }

        // 격자가 다섯 역할을 모두 실제로 지났는지
        Assert.True(rows >= 150, $"격자 {rows}행");
        foreach (var (role, count) in roleRows)
            Assert.True(count > 0, $"'{role}' 역할이 붙은 글자가 격자에 없다");
    }

    // ═══════════════════════════════════════════════════════════════
    // 검증·오류 — 400 { error, code, target, slot }
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> ProblemCases() => new[]
    {
        // 이름, 성씨, 이름 한자, 성씨 한자, code, target, slot
        new object?[] { "서ㅇ", "이", Cp(0x745E) + "*", null, "name_not_hangul", "name", -1 },
        new object?[] { "서 윤", "이", Cp(0x745E) + "*", null, "name_not_hangul", "name", -1 },
        new object?[] { "서윤", "Lee", Cp(0x745E) + "*", null, "name_not_hangul", "surname", -1 },
        new object?[] { "서윤", "이", Cp(0x745E) + Cp(0x6F64) + Cp(0x6F64), null, "name_hanja_count", "name", -1 },
        new object?[] { "서윤", "이", Cp(0x745E), null, "name_hanja_count", "name", -1 },
        new object?[] { "서윤", "남궁", null, Cp(0x5357), "surname_hanja_count", "surname", -1 },
        new object?[] { "서윤", "이", null, "-", "surname_none", "surname", 0 },
        new object?[] { "서윤", "이", Cp(0x745E) + "a", null, "not_hanja", "name", 1 },
        new object?[] { "서윤", "이", Cp(0x328A) + "*", null, "not_hanja", "name", 0 },                       // 동그라미 문자는 한자가 아니다
        new object?[] { "만수", "이", Cp(0x6669) + "*", null, "not_in_dictionary", "name", 0 },               // 晩 — 사전에는 꼴이 다른 晚 만 있다
        new object?[] { "서윤", "이", Cp(0x6F64) + Cp(0x745E), null, "reading_mismatch", "name", 0 },         // 潤瑞 — 자리가 바뀜
        new object?[] { "서윤", "이", "*" + Cp(0x745E), null, "reading_mismatch", "name", 1 },
        new object?[] { "서윤", "유", null, Cp(0x674E), "reading_mismatch", "surname", 0 },                   // 유 + 李
        new object?[] { "서윤", "남궁", null, "*" + Cp(0x5357), "reading_mismatch", "surname", 1 },
    };

    [Theory]
    [MemberData(nameof(ProblemCases))]
    public async Task HanjaProblem_Returns400_WithKoreanMessageCodeTargetSlot_AndNoLogNoTrackingNoScoring(
        string name, string lastName, string? nameHanja, string? lastNameHanja, string code, string target, int slot)
    {
        var api = NewApi();
        var problem = Problem(await api.Controller.EvaluateName(
            Request(name, lastName, "2024-03-15", nameHanja: nameHanja, lastNameHanja: lastNameHanja)));

        Assert.Equal(code, problem.Code);
        Assert.Equal(target, problem.Target);
        Assert.Equal(slot, problem.Slot);
        Assert.Equal(4, problem.PropertyCount);   // error · code · target · slot 뿐
        Assert.True(IsKoreanSentence(problem.Error), problem.Error);

        // 서비스 입력 검증(HanjaInput.Resolve)이 낸 문장 그대로다
        var (_, expected) = HanjaInput.Resolve(name, lastName, nameHanja, lastNameHanja);
        Assert.Equal(expected!.Message, problem.Error);

        // 화면·응답 문장에 길흉 단정과 '출생신고에 쓸 수 없다'는 단정을 쓰지 않는다
        foreach (var banned in new[] { "대길", "대흉", "길하", "흉하", "출생신고에 쓸 수 없", "대법원 목록에 없" })
            Assert.DoesNotContain(banned, problem.Error);

        // 예외를 던지지 않고 바로 돌려준다 — 로그·통계·채점 없음(사용자가 넣은 글자가 로그에 남을 길이 없다)
        Assert.Equal(0, api.Logger.Count);
        Assert.Empty(api.Tracker.Events);
        Assert.Empty(api.Service.Picks);
    }

    [Fact]
    public async Task HanjaProblem_NotInDictionary_UsesTheConfirmedWording_WithoutEchoingTheCharacter()
    {
        var api = NewApi();
        var problem = Problem(await api.Controller.EvaluateName(Request("만수", "이", nameHanja: Cp(0x6669) + "*")));

        Assert.Equal(
            "이 사이트 사전에 없는 글자라서 이 글자로는 계산하지 못해요. 사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다. " +
            "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 ‘만’ 칸의 후보 목록에서 먼저 찾아보세요. " +
            "출생신고에 쓸 수 있는 글자인지는 대법원 전자가족관계등록시스템의 ‘인명용 한자 조회’에서 한글 음 한 글자를 넣어 확인할 수 있습니다.",
            problem.Error);
        Assert.False(HasHan(problem.Error));

        // 독음 불일치 문장은 그 글자의 지정 독음을 적는다 — 均 은 (균·연)
        var mismatch = Problem(await api.Controller.EvaluateName(Request("서윤", "이", nameHanja: Cp(0x5747) + "*")));
        Assert.Equal("reading_mismatch", mismatch.Code);
        Assert.Contains("(균·연)", mismatch.Error);
        Assert.Contains("‘서’ 칸", mismatch.Error);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑬ 로그 — 한자를 정한 평가 요청의 서버 로그에 한자가 없다
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Evaluate_WithPickedHanja_LogsNoHanja()
    {
        var api = NewApi();
        var requests = new[]
        {
            Request("서윤", "유", "2024-03-15", "09:30", "female", Cp(0x745E) + Cp(0x6F64), Cp(0x5289)),
            Request("서윤", "이", null, null, "none", Cp(0x745E) + "*"),
            Request("미소", "김", "2021-07-08", null, "female", Cp(0x5A9A) + "-"),
            Request("울림", "남궁", "2021-07-08", null, "male", Cp(0x200D7) + "*", Cp(0x7537) + "*"),
            Request("서연", "이", "2024-03-15", null, "female", Cp(0x745E) + Cp(0xF999), Cp(0xF9E1)),   // 호환 코드로 넣어도
        };
        foreach (var request in requests)
            OkBody(await api.Controller.EvaluateName(request));

        Assert.True(api.Logger.Count >= requests.Length * 2);   // 요청·완료 두 줄씩(기존 템플릿)
        foreach (var text in api.Logger.Texts)
            Assert.False(HasHan(text), $"로그에 한자: {text}");
        // 기존 템플릿은 그대로다 — 이름·성씨·성별·톤과 최종 점수
        Assert.Contains(api.Logger.Texts, t => t.StartsWith("이름 평가 요청: 이름=서윤, 성=유, 성별=female, 톤=neutral"));
        Assert.Contains(api.Logger.Texts, t => t.StartsWith("이름 평가 완료: 유서윤, 최종점수="));
        // 구조화 속성도 예전 것뿐(한자 필드가 속성으로 실리지 않는다)
        var propertyNames = api.Logger.Texts.Where(t => Regex.IsMatch(t, @"^[A-Za-z{}]+=")).Select(t => t.Split('=')[0]).Distinct().ToList();
        Assert.Equal(new[] { "FinalScore", "FullName", "Gender", "LastName", "Name", "Tone", "{OriginalFormat}" }, propertyNames.OrderBy(x => x, StringComparer.Ordinal));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑲ hanjaSummary 는 던지지 않는다 — 한자 필드 없는 요청은 어떤 이름·성씨에도 지금처럼 답한다
    // ═══════════════════════════════════════════════════════════════

    // 테스트 이름에 깨진 글자가 실리지 않게 Theory 가 아니라 한 테스트 안에서 돈다(홀로 남은 서로게이트 포함)
    private static readonly (string Name, string LastName)[] OddNames =
    {
        ("ㅅ", "김"),                                  // 낱자모
        ("서ㅇ", "김"),
        ("서 윤", "김"),                               // 공백
        (" 서윤", "김"),
        (Cp(0x745E) + Cp(0x6F64), "김"),               // 한자 이름
        ("서" + Cp(0x1F600), "김"),                    // 이모지(서로게이트 쌍)
        ("서\uD83D", "김"),                            // 홀로 남은 서로게이트
        ("Seoyun", "김"),
        ("서1", "김"),
        ("서윤", Cp(0x674E)),                          // 한자 성씨
        ("서윤", "A"),
        ("서윤", "ㄱ"),
        ("서윤", "이1"),
        ("서윤", Cp(0x1F600)),
        ("서윤", "\uDE00"),
    };

    [Fact]
    public async Task Unspecified_OddNameOrSurname_StillAnswers_WithNullSummary()
    {
        foreach (var (name, lastName) in OddNames)
            foreach (var (date, time) in Births)
            {
                var api = NewApi();
                var response = OkBody(await api.Controller.EvaluateName(Request(name, lastName, date, time, "female")));

                Assert.Null(response.HanjaSummary);
                Assert.Equal(name, response.Name);
                Assert.Equal(new[] { ("endpoint", "evaluate") }, api.Tracker.Events);

                // 빈 문자열 한자 필드도 지정 없음이다 — 같은 응답
                var withEmptyFields = OkBody(await api.Controller.EvaluateName(Request(name, lastName, date, time, "female", "", " ")));
                Assert.Equal(Json(response), Json(withEmptyFields));
            }
    }

    [Fact]
    public async Task Unspecified_SurnameWithSpaces_IsTrimmedInSummary()
    {
        var api = NewApi();
        var response = OkBody(await api.Controller.EvaluateName(Request("서윤", " 이 ", "2024-03-15")));
        var trimmed = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", "2024-03-15")));

        Assert.NotNull(response.HanjaSummary);
        Assert.Equal("이", response.HanjaSummary!.Surname.Hangul);
        Assert.Equal(Json(trimmed.HanjaSummary!), Json(response.HanjaSummary));
    }

    // ═══════════════════════════════════════════════════════════════
    // 응답 꼴 — 화면(프런트)이 읽는 이름 그대로
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Response_Json_HasTheContractShape()
    {
        var api = NewApi();
        var response = OkBody(await api.Controller.EvaluateName(Request("서윤", "이", "2025-03-02", null, "female", Cp(0x745E) + "*")));
        using var doc = JsonDocument.Parse(Json(response));
        var summary = doc.RootElement.GetProperty("hanjaSummary");

        static string[] Names(JsonElement e) => e.EnumerateObject().Select(p => p.Name).ToArray();
        string[] factNames =
        {
            "character", "gloss", "fiveElement", "resourceGrade", "vReasons", "strokeCount", "yinYang",
            "common", "forbidden", "hasMeaning", "basic",
        };

        Assert.Equal(new[] { "userHanja", "nameHanja", "lastNameHanja", "surname", "syllables", "elementFit" }, Names(summary));
        Assert.Equal(new[] { "hangul", "source", "strokes", "chars" }, Names(summary.GetProperty("surname")));
        Assert.Equal(factNames, Names(summary.GetProperty("surname").GetProperty("chars")[0]));
        var syllable = summary.GetProperty("syllables")[0];
        Assert.Equal(new[] { "syllable", "source", "fills", "hanja" }, Names(syllable));
        Assert.Equal(factNames, Names(syllable.GetProperty("hanja")));
        Assert.Equal(new[] { "yongshin", "heeshin", "gishin", "lacking", "excessive", "counts" }, Names(summary.GetProperty("elementFit")));
        Assert.Equal(FiveElements, Names(summary.GetProperty("elementFit").GetProperty("counts")));

        // 후보 표의 글자마다 같은 꼴의 글자 사실(fact)이 실린다
        var candidate = doc.RootElement.GetProperty("hanjaCandidates")[0].GetProperty("candidates")[0];
        Assert.Equal(factNames, Names(candidate.GetProperty("fact")));

        Assert.True(summary.GetProperty("userHanja").GetBoolean());
        Assert.Equal(Cp(0x745E) + "*", summary.GetProperty("nameHanja").GetString());
        Assert.Equal("", summary.GetProperty("lastNameHanja").GetString());
        Assert.Equal("user", syllable.GetProperty("source").GetString());
        Assert.Equal(JsonValueKind.Array, syllable.GetProperty("fills").ValueKind);

        // 지정 없는 응답에도 필드가 실리고, 출생일이 없으면 elementFit 은 null
        var plain = OkBody(await api.Controller.EvaluateName(Request("서윤", "이")));
        using var plainDoc = JsonDocument.Parse(Json(plain));
        var plainSummary = plainDoc.RootElement.GetProperty("hanjaSummary");
        Assert.False(plainSummary.GetProperty("userHanja").GetBoolean());
        Assert.Equal(JsonValueKind.Null, plainSummary.GetProperty("elementFit").ValueKind);

        // 응답 문장(노트·메모·요약)에 길흉 단정과 검수 주장이 없다
        var body = Json(response);
        foreach (var banned in new[] { "대길", "대흉", "길하다", "흉하다", "전문가가 검수", "작명가 검수", "사람이 검수" })
            Assert.DoesNotContain(banned, body);
    }

    // ═══════════════════════════════════════════════════════════════
    // HanjaFactMapper — 글자 사실
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void HanjaFact_HandCases()
    {
        // 瑞 — 빈출 목록의 비약자, 기본 영역
        var seo = HanjaFactMapper.ToFact(Hanja(0x745E), "서");
        Assert.Equal(Cp(0x745E), seo.Character);
        Assert.Equal("상서 서", seo.Gloss);
        Assert.Equal("金", seo.FiveElement);
        Assert.Equal(13, seo.StrokeCount);
        Assert.Equal("陽", seo.YinYang);
        Assert.True(seo.Common);
        Assert.False(seo.Forbidden);
        Assert.True(seo.HasMeaning);
        Assert.True(seo.Basic);

        // 훈은 칸의 음절로 고른다 — 李 '이' 칸(괄호 속 두음 독음), 金 '김' 칸, 均 '연' 칸(보충 표 독음)
        Assert.Equal("오얏 리(이)", HanjaFactMapper.ToFact(Hanja(0x674E), "이").Gloss);
        Assert.Equal("성씨 김", HanjaFactMapper.ToFact(Hanja(0x91D1), "김").Gloss);
        Assert.Equal("쇠 금", HanjaFactMapper.ToFact(Hanja(0x91D1), "금").Gloss);
        Assert.Equal("따를 연", HanjaFactMapper.ToFact(Hanja(0x5747), "연").Gloss);
        // 음절을 주지 않으면 대표 독음 기준
        Assert.Equal("고를 균", HanjaFactMapper.ToFact(Hanja(0x5747), null).Gloss);

        // 媚 — 불용. 성씨 글자로 실으면 이름용 표시를 뺀다
        Assert.True(HanjaFactMapper.ToFact(Hanja(0x5A9A), "미").Forbidden);
        Assert.False(HanjaFactMapper.ToFact(Hanja(0x5A9A), "미", surname: true).Forbidden);
        Assert.True(HanjaFactMapper.ToFact(Hanja(0x674E), "이").Common == (HanjaData.IsCommonNameHanja(Cp(0x674E)) && !HanjaData.IsWeakGivenNameHanja(Cp(0x674E))));
        Assert.False(HanjaFactMapper.ToFact(Hanja(0x674E), "이", surname: true).Common);

        // 男 — 빈출 목록에 있지만 약자라 '먼저 보여 드리는 글자'가 아니다
        Assert.True(HanjaData.IsCommonNameHanja(Cp(0x7537)) && HanjaData.IsWeakGivenNameHanja(Cp(0x7537)));
        Assert.False(HanjaFactMapper.ToFact(Hanja(0x7537), "남").Common);

        // BMP 밖 글자 — basic 거짓
        var extended = HanjaFactMapper.ToFact(Hanja(0x200D7), "울");
        Assert.False(extended.Basic);
        Assert.Equal(Cp(0x200D7), extended.Character);

        // 뜻 없는 글자 — gloss 빈 문자열, hasMeaning 거짓
        var noMeaning = HanjaData.GetAllHanja().First(h => string.IsNullOrEmpty(h.Meaning));
        var fact = HanjaFactMapper.ToFact(noMeaning, noMeaning.Reading);
        Assert.Equal("", fact.Gloss);
        Assert.False(fact.HasMeaning);

        // 사전에 영문 뜻만 있는 글자(로더가 Unihan 뜻을 채워 둔 글자 — 지금 U+39B3) — 훈이 아니라서 뜻 없는 글자와 같게 싣는다.
        // 자료가 고쳐져 그런 글자가 없어져도 꾸며 만든 항목으로 같은 규칙을 본다
        var foreignOnly = HanjaData.GetAllHanja().Where(h => !string.IsNullOrEmpty(h.Meaning) && !Regex.IsMatch(h.Meaning, "[가-힣]")).ToList();
        foreignOnly.Add(new HanjaInfo { Character = Cp(0x745E), Reading = "서", Meaning = "auspicious; felicitous omen" });
        foreach (var hanja in foreignOnly)
        {
            var english = HanjaFactMapper.ToFact(hanja, hanja.Reading);
            Assert.Equal("", english.Gloss);
            Assert.False(english.HasMeaning);
        }

        // 사전의 모든 글자 — 던지지 않고, 음양은 획수 홀짝이다. 훈은 한글이거나 비어 있다(영문 뜻이 화면에 나가지 않는다)
        foreach (var hanja in HanjaData.GetAllHanja())
        {
            var each = HanjaFactMapper.ToFact(hanja, null);
            Assert.Equal(hanja.StrokeCount % 2 == 1 ? "陽" : "陰", each.YinYang);
            Assert.Equal(hanja.Character, each.Character);
            Assert.Equal(each.HasMeaning, each.Gloss.Length > 0);
            if (each.HasMeaning)
                Assert.True(Regex.IsMatch(each.Gloss, "[가-힣]") && !Regex.IsMatch(each.Gloss, "[A-Za-z]"), $"U+{char.ConvertToUtf32(hanja.Character, 0):X4} 훈 '{each.Gloss}'");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 후보 표의 글자 사실 · hanjaSummary 를 만들다 실패했을 때
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// '한자 후보' 표의 글자마다 글자 사실(fact)이 실린다 — hanjaSummary·음절 후보 파일과 같은 함수의 값(훈은 그 음절로 읽는 한 조각).
    /// 화면이 표에서 '이 글자로'를 누른 글자를 응답을 기다리지 않고 그릴 때 쓴다(표의 meaning 은 훈 전체라 그 음절의 훈을 따로 고를 수 없다).
    /// </summary>
    [Fact]
    public async Task HanjaCandidates_CarryTheFact_SameAsMapperAndSummary()
    {
        var api = NewApi();
        int facts = 0, firstCells = 0;
        var cases = new (string Name, string LastName, string? NameHanja)[]
        {
            ("서윤", "이", null),
            ("임유", "김", Cp(0x6797) + "*"),      // 林 을 '임' 칸에 — 두음 꼴 칸의 훈('수풀 림(임)')
            ("한빛", "김", null),                  // 빛: 후보 0개
            ("연우", "박", Cp(0x5747) + "*"),      // 均 을 '연' 칸에 — 보충 표 독음의 훈
        };
        foreach (var (name, lastName, nameHanja) in cases)
            foreach (var date in new[] { null, "2024-03-15" })
            {
                var response = OkBody(await api.Controller.EvaluateName(Request(name, lastName, date, gender: "female", nameHanja: nameHanja)));
                Assert.Equal(name.Length, response.HanjaCandidates.Count);
                for (int i = 0; i < name.Length; i++)
                {
                    var group = response.HanjaCandidates[i];
                    var syllable = name[i].ToString();
                    foreach (var candidate in group.Candidates)
                    {
                        facts++;
                        Assert.NotNull(candidate.Fact);
                        var expected = HanjaFactMapper.ToFact(Hanja(char.ConvertToUtf32(candidate.Character, 0)), syllable);
                        Assert.Equal(Json(expected), Json(candidate.Fact!));
                        Assert.Equal(candidate.Character, candidate.Fact!.Character);
                        Assert.Equal(candidate.StrokeCount, candidate.Fact.StrokeCount);
                        Assert.Equal(candidate.FiveElement ?? "", candidate.Fact.FiveElement);
                        Assert.False(candidate.Fact.Forbidden);          // 표에는 이름에 피하는 글자가 없다
                        Assert.Contains(candidate.Fact.Gloss, candidate.Meaning);   // 그 음절의 훈은 훈 전체의 한 조각이다
                    }

                    // 표의 첫 칸이 계산에 쓴 글자면 그 사실이 hanjaSummary 의 그 음절과 글자 그대로 같다
                    var shown = response.HanjaSummary!.Syllables[i].Hanja;
                    if (shown != null && group.Candidates.Count > 0 && group.Candidates[0].Character == shown.Character)
                    {
                        firstCells++;
                        Assert.Equal(Json(shown), Json(group.Candidates[0].Fact!));
                    }
                }
            }
        Assert.True(facts >= 30 && firstCells >= 10, $"글자 사실 {facts}건·첫 칸 대조 {firstCells}건 — 검사가 비어 있다");

        // 고른 글자가 표 맨 앞에 서고 훈이 그 칸의 음절로 골라진다
        var picked = OkBody(await api.Controller.EvaluateName(Request("임유", "김", nameHanja: Cp(0x6797) + "*")));
        Assert.Equal(Cp(0x6797), picked.HanjaCandidates[0].Candidates[0].Character);
        Assert.Equal("수풀 림(임)", picked.HanjaCandidates[0].Candidates[0].Fact!.Gloss);
    }

    /// <summary>채점 결과를 그대로 돌려주되 배정 한자 목록만 없애는 채점 서비스 — hanjaSummary 를 만드는 코드가 실패하는 경우를 만든다.</summary>
    private sealed class BrokenAssignmentScoring(IScoringService inner) : IScoringService
    {
        public async Task<CanonicalNameScore> EvaluateAsync(
            string firstName, string lastName, DateTime? birthDate, string gender, string tone,
            TimeSpan? birthTime = null, HanjaPicks? picks = null)
        {
            var score = await inner.EvaluateAsync(firstName, lastName, birthDate, gender, tone, birthTime, picks);
            score.AssignedHanja = null!;
            return score;
        }
    }

    /// <summary>
    /// hanjaSummary 를 만들다 예외가 나도 평가는 그대로 나간다(덧붙이는 필드 하나 때문에 지금 되는 요청을 500 으로 만들지 않는다).
    /// 다만 조용히 사라지지 않게 로그에 예외 종류와 난 자리를 남긴다 — 이름·성씨·한자·생년월일·예외 문구는 싣지 않는다.
    /// </summary>
    [Fact]
    public async Task Summary_BuildFailure_KeepsTheEvaluation_AndLogsOnlyTheExceptionType()
    {
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var logger = new CollectingLogger<NameEvaluationService>();
        var broken = new NameEvaluationService(new BrokenAssignmentScoring(scoring), new ExplanationEngine(), logger);

        var result = await broken.EvaluateNameAsync("서윤", "이", DateTime.Parse("2024-03-15"), "female", "neutral");
        Assert.Null(result.HanjaSummary);
        Assert.True(result.FinalScore > 0);
        Assert.Equal(2, result.HanjaCandidates.Count);

        Assert.Equal(1, logger.Count);
        Assert.Contains(logger.Texts, t => t.Contains("NullReferenceException"));
        foreach (var text in logger.Texts)
        {
            Assert.False(HasHan(text), $"로그에 한자: {text}");
            Assert.DoesNotContain("서윤", text);
            Assert.DoesNotContain("2024-03-15", text);
            Assert.DoesNotContain("Object reference", text);   // 예외 문구(입력값이 섞일 수 있는 자리)는 싣지 않는다
        }

        // 로거 없이 만든 서비스(테스트·도구)도 던지지 않는다
        var silent = new NameEvaluationService(new BrokenAssignmentScoring(scoring), new ExplanationEngine());
        Assert.Null((await silent.EvaluateNameAsync("서윤", "이", null, "none", "neutral")).HanjaSummary);

        // 정상 경로는 로그를 쓰지 않는다 — 이름이 한글 음절만이 아니어서 null 인 것은 실패가 아니다
        var quiet = new CollectingLogger<NameEvaluationService>();
        var healthy = new NameEvaluationService(scoring, new ExplanationEngine(), quiet);
        Assert.NotNull((await healthy.EvaluateNameAsync("서윤", "이", DateTime.Parse("2024-03-15"), "female", "neutral")).HanjaSummary);
        Assert.Null((await healthy.EvaluateNameAsync("서 윤", "이", null, "none", "neutral")).HanjaSummary);
        Assert.Equal(0, quiet.Count);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑱ POST /api/v1/hanja/resolve — 글자 한 자 판정
    // ═══════════════════════════════════════════════════════════════

    private static HanjaResolveResponseDto ResolveOk(HanjaController controller, string text, string? syllable = null)
    {
        var result = controller.Resolve(new HanjaResolveRequestDto { Text = text, Syllable = syllable });
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<HanjaResolveResponseDto>(ok.Value);
    }

    private static string ResolveBad(HanjaController controller, HanjaResolveRequestDto? request)
    {
        var result = controller.Resolve(request!);
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var value = bad.Value!;
        Assert.Single(value.GetType().GetProperties());
        return (string)value.GetType().GetProperty("error")!.GetValue(value)!;
    }

    [Fact]
    public void Resolve_Judgements_AreAll200()
    {
        var logger = new CollectingLogger<HanjaController>();
        var controller = new HanjaController(logger);

        // 정상 — 林 + 임(두음 꼴): 통합 한자, 훈, 넣을 수 있는 음절
        var ok = ResolveOk(controller, Cp(0x6797), "임");
        Assert.Equal("ok", ok.Status);
        Assert.Equal(Cp(0x6797), ok.Character);
        Assert.Equal(Cp(0x6797), ok.Hanja!.Character);
        Assert.Equal("수풀 림(임)", ok.Hanja.Gloss);
        Assert.Equal("木", ok.Hanja.FiveElement);
        Assert.Equal(8, ok.Hanja.StrokeCount);
        Assert.Equal(new[] { "림", "임" }, ok.AcceptedSyllables);
        Assert.Null(ok.Message);
        Assert.Null(ok.Suggestion);

        // 均 + 연 — 대법원 목록의 지정 발음(보충 표)
        var gyun = ResolveOk(controller, Cp(0x5747), "연");
        Assert.Equal("ok", gyun.Status);
        Assert.Equal(new[] { "균", "연" }, gyun.AcceptedSyllables);
        Assert.Equal("따를 연", gyun.Hanja!.Gloss);

        // 입력기가 내는 호환 코드·PDF 의 강희 부수 코드·이체 선택자 → 통합 한자
        Assert.Equal(Cp(0x6797), ResolveOk(controller, Cp(0xF9F4), "임").Character);
        Assert.Equal(Cp(0x91D1), ResolveOk(controller, Cp(0x2FA6), "금").Character);
        Assert.Equal(Cp(0x674E), ResolveOk(controller, Cp(0x674E) + Cp(0xFE00), "이").Character);

        // 음절 없이 — 독음 판정 없이 글자만 찾는다. 훈은 대표 독음 기준
        var noSyllable = ResolveOk(controller, Cp(0x674E));
        Assert.Equal("ok", noSyllable.Status);
        Assert.Equal(new[] { "리", "이" }, noSyllable.AcceptedSyllables);
        Assert.Equal("오얏 리(이)", noSyllable.Hanja!.Gloss);
        Assert.Equal("ok", ResolveOk(controller, Cp(0x5A1C), "").Status);   // 빈 음절 = 음절 없음

        // 여러 글자가 오면 정리 뒤 첫 글자만 본다
        Assert.Equal(Cp(0x6797), ResolveOk(controller, " " + Cp(0x6797) + Cp(0x68EE), "임").Character);

        // 독음 불일치 — 娜 는 '나'만(두음 독음뿐인 글자를 본음 칸에 받지 않는다)
        var mismatch = ResolveOk(controller, Cp(0x5A1C), "라");
        Assert.Equal("reading_mismatch", mismatch.Status);
        Assert.Equal(Cp(0x5A1C), mismatch.Character);
        Assert.NotNull(mismatch.Hanja);
        Assert.Equal(new[] { "나" }, mismatch.AcceptedSyllables);
        Assert.Equal($"‘{Cp(0x5A1C)}’ 글자의 인명용 독음(나)이 ‘라’ 칸과 맞지 않아요. ‘라’ 음절로 읽는 한자를 넣어 주세요.", mismatch.Message);
        Assert.Null(mismatch.Suggestion);

        // 사전에 없음 — 晩 에는 꼴만 다른 등재 글자 晚 을 권한다
        var missing = ResolveOk(controller, Cp(0x6669), "만");
        Assert.Equal("not_in_dictionary", missing.Status);
        Assert.Equal(Cp(0x6669), missing.Character);
        Assert.Null(missing.Hanja);
        Assert.Empty(missing.AcceptedSyllables);
        Assert.Equal(HanjaInput.NotInDictionaryMessage('만'), missing.Message);
        Assert.Equal(Cp(0x665A), missing.Suggestion!.Character);
        Assert.Equal("늦을 만", missing.Suggestion.Gloss);
        Assert.False(missing.Suggestion.Forbidden);
        // 권할 글자가 없는 경우(弑 — 대상 훈이 '윗사람 죽일')
        var noSuggestion = ResolveOk(controller, Cp(0x5F11));
        Assert.Equal("not_in_dictionary", noSuggestion.Status);
        Assert.Null(noSuggestion.Suggestion);
        foreach (var message in new[] { missing.Message!, noSuggestion.Message! })
        {
            Assert.DoesNotContain("출생신고에 쓸 수 없", message);
            Assert.DoesNotContain("대법원 목록에 없", message);
        }

        // 한자가 아님 — 한글·영문·동그라미 문자·폭 없는 문자뿐
        foreach (var text in new[] { "가", "a", Cp(0x328A), Cp(0x200B), "ㄱ", "1" })
        {
            var notHanja = ResolveOk(controller, text, "서");
            Assert.Equal("not_hanja", notHanja.Status);
            Assert.Null(notHanja.Character);
            Assert.Null(notHanja.Hanja);
            Assert.Empty(notHanja.AcceptedSyllables);
            Assert.Equal("한자 한 글자를 넣어 주세요.", notHanja.Message);
        }

        // 넣은 글자·음절을 로그에 남기지 않는다(판정은 로그를 쓰지 않는다)
        Assert.Equal(0, logger.Count);
    }

    /// <summary>
    /// 성씨 칸의 판정(target = "surname") — 판정은 이름 칸과 같고, 안내 문장이 성씨용이며(인명용 한자·출생신고 이야기를 하지 않는다 — 성씨는 그 제한을
    /// 받지 않는다) 글자 사실에 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자)를 싣지 않는다. 평가 응답의 성씨 글자와 같은 규칙이다.
    /// </summary>
    [Fact]
    public void Resolve_SurnameTarget_UsesSurnameWording_AndOmitsNameQualityFlags()
    {
        var logger = new CollectingLogger<HanjaController>();
        var controller = new HanjaController(logger);
        HanjaResolveResponseDto Call(string text, string? syllable, string? target)
        {
            var result = controller.Resolve(new HanjaResolveRequestDto { Text = text, Syllable = syllable, Target = target });
            return Assert.IsType<HanjaResolveResponseDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        }

        // 劉 U+5289 — 흔한 성씨 한자인데 사이트가 이름에는 피하는 글자로 둔다
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(0x5289)));
        var asName = Call(Cp(0x5289), "유", null);
        var asSurname = Call(Cp(0x5289), "유", "surname");
        Assert.Equal("ok", asName.Status);
        Assert.Equal("ok", asSurname.Status);
        Assert.True(asName.Hanja!.Forbidden);
        Assert.False(asSurname.Hanja!.Forbidden);
        Assert.Equal(asName.Hanja.StrokeCount, asSurname.Hanja.StrokeCount);
        Assert.Equal(asName.Hanja.FiveElement, asSurname.Hanja.FiveElement);
        Assert.Equal(asName.AcceptedSyllables, asSurname.AcceptedSyllables);
        Assert.Null(asSurname.Message);

        // 瑞 U+745E — 이름 칸에서는 먼저 보여 드리는 글자, 성씨 칸('서')에는 그 표시도 싣지 않는다
        Assert.True(Call(Cp(0x745E), "서", "name").Hanja!.Common);
        Assert.False(Call(Cp(0x745E), "서", "surname").Hanja!.Common);

        // 정확히 "surname" 일 때만 성씨 칸 — 그 밖의 값·생략은 이름 칸으로 본다(새 오류를 만들지 않는다)
        foreach (var target in new string?[] { null, "", "name", "SURNAME", " surname", "성씨" })
            Assert.True(Call(Cp(0x5289), "유", target).Hanja!.Forbidden, $"target '{target}'");

        // 문장 — 사전에 없는 글자(晩)·독음 불일치(潤 을 '유' 칸에)
        var missing = Call(Cp(0x6669), "유", "surname");
        Assert.Equal("not_in_dictionary", missing.Status);
        Assert.Equal(
            "이 사이트 사전에 없는 글자라서 이 글자로는 성씨 획수를 세지 못해요. " +
            "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 ‘유’ 칸의 후보 목록에서 먼저 찾아보세요. " +
            "비워 두면 이 사이트가 성씨 한자를 정해 계산해요.", missing.Message);   // 판정 API 는 성씨를 모른다 — 표 안·밖 어느 쪽에도 맞는 맺음(2026-11-25)
        var mismatch = Call(Cp(0x6F64), "유", "surname");
        Assert.Equal("reading_mismatch", mismatch.Status);
        Assert.Equal(
            $"‘{Cp(0x6F64)}’ 글자는 이 사이트 사전에 실린 독음(윤)이 ‘유’ 칸과 맞지 않아요. ‘유’ 음절로 읽는 한자를 넣어 주세요. " +
            "비워 두면 이 사이트가 성씨 한자를 정해 계산해요.", mismatch.Message);
        foreach (var message in new[] { missing.Message!, mismatch.Message! })
        {
            Assert.DoesNotContain("인명용", message);
            Assert.DoesNotContain("출생신고", message);
            Assert.True(IsKoreanSentence(message), message);
        }

        // 평가의 입력 검증이 성씨 칸에 내는 문장과 같다(같은 함수) — 맺음만 다르다: 판정 API 는 성씨를 몰라 표 안·밖 어느 쪽에도 맞는 말(2026-11-25)
        static string Unknown(string m) => m.Replace(HanjaInput.SurnameLeaveEmptyTailDefault, HanjaInput.SurnameLeaveEmptyTailUnknown);
        Assert.Equal(Unknown(HanjaInput.Resolve("서윤", "유", null, Cp(0x6669)).Problem!.Message), missing.Message);
        Assert.Equal(Unknown(HanjaInput.Resolve("서윤", "유", null, Cp(0x6F64)).Problem!.Message), mismatch.Message);
        // 같은 입력을 이름 칸으로 물으면 이름용 문장(§20-3 확정 문구)이다
        Assert.Equal(HanjaInput.NotInDictionaryMessage('유'), Call(Cp(0x6669), "유", null).Message);
        Assert.Contains("인명용 독음(윤)", Call(Cp(0x6F64), "유", null).Message);

        Assert.Equal(0, logger.Count);
    }

    /// <summary>그 음절로 읽는 한자가 사전에 없는 칸(봄)에 한자를 넣으면 — '그 음절로 읽는 한자를 넣어 주세요'라고 하지 않는다(따를 수 없는 안내).</summary>
    [Fact]
    public void Resolve_SyllableWithoutAnyHanja_SaysTheSyllableHasNoHanja()
    {
        var controller = new HanjaController(new CollectingLogger<HanjaController>());
        var judged = ResolveOk(controller, Cp(0x6625), "봄");   // 春
        Assert.Equal("reading_mismatch", judged.Status);
        Assert.Equal(new[] { "춘" }, judged.AcceptedSyllables.Take(1));
        Assert.Equal($"‘{Cp(0x6625)}’ 글자의 인명용 독음(춘)이 ‘봄’ 칸과 맞지 않아요. 이 음절은 인명용 한자 독음이 아니어서 한글로만 써요.", judged.Message);

        // 호환 블록의 배정되지 않은 코드(U+FA6E)는 글자가 아니다 — '사전에 없는 글자' 안내를 붙이지 않는다
        var unassigned = ResolveOk(controller, Cp(0xFA6E), "김");
        Assert.Equal("not_hanja", unassigned.Status);
        Assert.Null(unassigned.Character);
        Assert.Equal("한자 한 글자를 넣어 주세요.", unassigned.Message);
    }

    [Fact]
    public void Resolve_LengthAndSyllableLimits_Return400_InKorean()
    {
        var logger = new CollectingLogger<HanjaController>();
        var controller = new HanjaController(logger);

        // 빈 본문·빈 글자·9자
        Assert.Equal("한자 한 글자를 넣어 주세요.", ResolveBad(controller, null));
        Assert.Equal("한자 한 글자를 넣어 주세요.", ResolveBad(controller, new HanjaResolveRequestDto()));
        Assert.Equal("한자 한 글자를 넣어 주세요.", ResolveBad(controller, new HanjaResolveRequestDto { Text = "   " }));
        Assert.Equal("한자 한 글자를 넣어 주세요.",
            ResolveBad(controller, new HanjaResolveRequestDto { Text = string.Concat(Enumerable.Repeat(Cp(0x6797), 9)), Syllable = "임" }));
        // 8자까지는 받는다
        Assert.Equal("ok", ResolveOk(controller, string.Concat(Enumerable.Repeat(Cp(0x6797), 8)), "임").Status);

        // 음절은 한글 음절 한 글자 — 두 글자·낱자모·공백·영문·한자는 400
        foreach (var syllable in new[] { "임수", "ㅇ", " ", "a", Cp(0x6797), "임 " })
            Assert.Equal("음절은 한글 한 글자로 넣어 주세요.",
                ResolveBad(controller, new HanjaResolveRequestDto { Text = Cp(0x6797), Syllable = syllable }));

        Assert.Equal(0, logger.Count);
    }

    private sealed class FailingHanjaController(ILogger<HanjaController> logger, string exceptionMessage) : HanjaController(logger)
    {
        protected override HanjaJudgement Judge(string text, char? syllable, bool surname)
            => throw new InvalidOperationException(exceptionMessage + text);
    }

    [Fact]
    public void Resolve_Failure_Returns500_WithoutExceptionMessage_AndLogsNoInput()
    {
        var logger = new CollectingLogger<HanjaController>();
        var controller = new FailingHanjaController(logger, "The given key was not present: ");

        var result = controller.Resolve(new HanjaResolveRequestDto { Text = Cp(0x6797), Syllable = "임" });
        var error = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(500, error.StatusCode);
        var value = error.Value!;
        Assert.Equal("한자 확인 중 오류가 발생했습니다.", (string)value.GetType().GetProperty("error")!.GetValue(value)!);
        Assert.Single(value.GetType().GetProperties());   // 예외 문구(message)를 싣지 않는다

        Assert.Equal(1, logger.Count);
        foreach (var text in logger.Texts)
        {
            Assert.False(HasHan(text), $"로그에 한자: {text}");
            Assert.DoesNotContain("given key", text);          // 예외 문구에는 넣은 글자가 섞일 수 있어 싣지 않는다
            Assert.DoesNotContain("Syllable=", text);
        }
        Assert.Contains(logger.Texts, t => t.Contains("InvalidOperationException"));
    }

    [Fact]
    public void Resolve_AgreesWithEvaluateValidation_ForEveryCandidateOfSampleSyllables()
    {
        // 판정 API 가 ok 라고 한 (글자, 음절)은 평가의 입력 검증도 통과한다 — 같은 술어(HanjaInput)를 쓰는지
        var controller = new HanjaController(new CollectingLogger<HanjaController>());
        int checkedPairs = 0;
        foreach (char syllable in "서윤유임연나라녹")
            foreach (var hanja in HanjaInput.CandidatesFor(syllable))
            {
                var judged = ResolveOk(controller, hanja.Character, syllable.ToString());
                Assert.Equal("ok", judged.Status);
                Assert.Contains(syllable.ToString(), judged.AcceptedSyllables);
                var (picks, problem) = HanjaInput.Resolve(syllable.ToString(), "김", hanja.Character, null);
                Assert.Null(problem);
                Assert.NotNull(picks);
                checkedPairs++;
            }
        Assert.True(checkedPairs >= 400, $"대조한 쌍 {checkedPairs}");
    }
}
