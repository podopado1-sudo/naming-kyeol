using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NameForm.Api.Controllers;
using NameForm.Application.DTOs;
using NameForm.Application.Services;

namespace NameForm.Tests;

/// <summary>
/// /saju/elements 는 입력값(생년월일·시각·출생지)을 서버 로그·사용 통계에 남기지 않는다 — 2026-11 설계 docs/plan-ohaeng-2026-11.md §5-14·§8.
/// 개인정보처리방침이 '‘부족한 오행 찾기’에 넣은 값은 데이터베이스와 서버 로그에 남기지 않는다'고 적을 근거.
/// PiiMaskingPolicy 는 {@obj} 구조 분해에만 작동해 사실상 쓰이지 않으므로, 로그 템플릿에 입력값을 아예 넣지 않는 것을 여기서 지킨다.
/// </summary>
public class SajuControllerLoggingTests
{
    private static readonly string[] InputValues = { "1990-03-15", "1990", "14:30", "busan", "Busan", "부산" };

    /// <summary>메시지·구조화 속성 값·예외 문구를 모두 모으는 테스트 로거</summary>
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

    /// <summary>엔진 안에서 나는 프레임워크 예외의 영문 문구(내부 매개변수 이름 포함) — 응답에 실리면 안 된다</summary>
    private const string FrameworkArgumentMessage = "Index was out of range. Must be non-negative and less than the size of the collection.";

    /// <summary>
    /// 가짜 서비스 — mode 에 따라 성공·서비스 입력 오류(SajuInputException)·엔진 안의 ArgumentException 계열·그 밖 예외.
    /// 서비스 입력 오류 문구는 입력값이 없는 서비스 문구를 흉내 낸다
    /// </summary>
    private sealed class FakeElementsService(string mode) : ISajuElementsService
    {
        public int Calls { get; private set; }
        public Task<SajuElementsResponseDto> FindAsync(DateTime birthDate, TimeSpan? birthTime, string? birthplaceCode)
        {
            Calls++;
            return mode switch
            {
                "ok" => Task.FromResult(new SajuElementsResponseDto { CharacterCount = birthTime.HasValue ? 8 : 6 }),
                "input" => throw new SajuInputException("출생지는 목록에 있는 시·도 가운데 하나여야 합니다."),
                "engine-argument" => throw new ArgumentOutOfRangeException("index", FrameworkArgumentMessage),
                "engine-plain-argument" => throw new ArgumentException("An item with the same key has already been added. Key: 木"),
                _ => throw new InvalidOperationException("계산 실패"),
            };
        }
    }

    private static SajuElementsRequestDto Request(string? time = "14:30", string? place = "busan")
        => new() { BirthDate = "1990-03-15", BirthTime = time, BirthplaceCode = place };

    private static void AssertNoInput(CollectingLogger<SajuController> logger)
    {
        foreach (var text in logger.Texts)
        foreach (var v in InputValues)
            Assert.False(text.Contains(v, StringComparison.Ordinal), $"로그에 입력값 '{v}': {text}");
    }

    [Fact]
    public async Task Success_LogsWithoutInput_TracksKindOnly()
    {
        var logger = new CollectingLogger<SajuController>();
        var tracker = new RecordingTracker();
        var service = new FakeElementsService("ok");
        var controller = new SajuController(service, logger, tracker);

        var result = await controller.FindElements(Request(place: " Busan "));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(1, service.Calls);
        Assert.True(logger.Count >= 1);
        AssertNoInput(logger);
        Assert.Equal(new[] { ("endpoint", "ohaeng") }, tracker.Events); // 종류·키만 — 입력값 없음
    }

    [Fact]
    public async Task ValidationError_LogsNothingWithInput_NoTracking()
    {
        var logger = new CollectingLogger<SajuController>();
        var tracker = new RecordingTracker();
        var service = new FakeElementsService("ok");
        var controller = new SajuController(service, logger, tracker);

        foreach (var req in new[] { Request(time: "25:00"), Request(place: "mars"), new SajuElementsRequestDto { BirthDate = "1990-13-15" } })
            Assert.IsType<BadRequestObjectResult>((await controller.FindElements(req)).Result);

        Assert.Equal(0, service.Calls);
        Assert.Empty(tracker.Events);
        AssertNoInput(logger);
    }

    [Fact]
    public async Task ServiceArgumentError_Returns400_LogsWithoutInput()
    {
        var logger = new CollectingLogger<SajuController>();
        var controller = new SajuController(new FakeElementsService("input"), logger, new RecordingTracker());

        var bad = Assert.IsType<BadRequestObjectResult>((await controller.FindElements(Request())).Result);
        var error = (string)bad.Value!.GetType().GetProperty("error")!.GetValue(bad.Value)!;
        Assert.Equal("출생지는 목록에 있는 시·도 가운데 하나여야 합니다.", error);
        AssertNoInput(logger);
    }

    [Theory]
    [InlineData("engine-argument")]
    [InlineData("engine-plain-argument")]
    public async Task EngineArgumentException_Returns500_WithoutFrameworkMessage(string mode)
    {
        // 서비스가 직접 막은 입력 오류(SajuInputException)가 아닌 ArgumentException 계열은 계산 오류다 — 400 으로 분류하지 않고,
        // 영문 프레임워크 문구·내부 매개변수 이름('index')을 응답에 싣지 않는다(2026-11-19 반박 검토, 설계 §16)
        var logger = new CollectingLogger<SajuController>();
        var controller = new SajuController(new FakeElementsService(mode), logger, new RecordingTracker());

        var result = Assert.IsType<ObjectResult>((await controller.FindElements(Request())).Result);
        Assert.IsNotType<BadRequestObjectResult>(result);
        Assert.Equal(500, result.StatusCode);
        var value = result.Value!;
        var error = (string)value.GetType().GetProperty("error")!.GetValue(value)!;
        Assert.Equal("오행 계산 중 오류가 발생했습니다.", error);
        Assert.Null(value.GetType().GetProperty("message"));
        foreach (var leak in new[] { "index", "Index was out of range", "same key", "Parameter" })
            Assert.DoesNotContain(leak, error, StringComparison.OrdinalIgnoreCase);
        AssertNoInput(logger);
    }

    [Fact]
    public async Task ServiceFailure_Returns500_WithoutExceptionMessage_LogsWithoutInput()
    {
        var logger = new CollectingLogger<SajuController>();
        var controller = new SajuController(new FakeElementsService("boom"), logger, new RecordingTracker());

        var result = Assert.IsType<ObjectResult>((await controller.FindElements(Request())).Result);
        Assert.Equal(500, result.StatusCode);
        var value = result.Value!;
        Assert.Equal("오행 계산 중 오류가 발생했습니다.", (string)value.GetType().GetProperty("error")!.GetValue(value)!);
        Assert.Null(value.GetType().GetProperty("message")); // NameAnalysisController 와 달리 ex.Message 를 싣지 않는다
        AssertNoInput(logger);
    }

    [Fact]
    public async Task RealService_Success_LogsWithoutInput()
    {
        // 진짜 서비스(로거 없음)로도 같은지 — 시각 없음·출생지 없음 경로 포함
        var logger = new CollectingLogger<SajuController>();
        var controller = new SajuController(
            new SajuElementsService(new SajuCalculationService(), new YongshinCalculationService()), logger, new RecordingTracker());

        foreach (var req in new[] { Request(), Request(time: null, place: null) })
        {
            var ok = Assert.IsType<OkObjectResult>((await controller.FindElements(req)).Result);
            var body = Assert.IsType<SajuElementsResponseDto>(ok.Value);
            Assert.Equal(req.BirthTime == null ? 6 : 8, body.CharacterCount);
        }
        AssertNoInput(logger);
    }
}
