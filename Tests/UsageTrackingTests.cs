using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NameForm.Api.Controllers;
using NameForm.Application.Services;
using NameForm.Infrastructure.Data;
using NameForm.Infrastructure.Repositories;
using Xunit;

namespace NameForm.Tests;

public class UsageTrackingTests
{
    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("DataSource=:memory:")
            .Options;
        var db = new AppDbContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        return db;
    }

    // ── 1. EfUsageTracker row 저장 확인 ──────────────────────────────────

    [Fact]
    public async Task EfUsageTracker_TrackAsync_SavesRow()
    {
        using var db = CreateInMemoryDb();
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);

        await tracker.TrackAsync("endpoint", "smart");

        var row = await db.UsageEvents.SingleAsync();
        Assert.Equal("endpoint", row.EventType);
        Assert.Equal("smart", row.Key);
    }

    // ── 2. DB 연결 실패 시 예외 미전파 확인 ──────────────────────────────

    [Fact]
    public async Task EfUsageTracker_WhenDbFails_DoesNotThrow()
    {
        // 이미 닫힌 connection으로 강제 실패 유도
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("DataSource=:memory:")
            .Options;
        var db = new AppDbContext(options);
        // connection을 열지 않으면 SaveChangesAsync에서 예외 발생
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);

        // 예외가 밖으로 새면 xUnit이 Fail로 잡음 — 통과하면 OK
        var ex = await Record.ExceptionAsync(() => tracker.TrackAsync("endpoint", "smart"));
        Assert.Null(ex);
    }

    // ── 3. UsageController POST — 화이트리스트 밖 key → 400 ─────────────

    [Fact]
    public async Task UsageController_Post_InvalidKey_Returns400()
    {
        using var db = CreateInMemoryDb();
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);
        var controller = new UsageController(tracker, db);

        var result = await controller.TrackEvent(new TrackEventRequest("tab_view", "hack"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(400, badRequest.StatusCode);
    }

    [Fact]
    public async Task UsageController_Post_InvalidEventType_Returns400()
    {
        using var db = CreateInMemoryDb();
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);
        var controller = new UsageController(tracker, db);

        var result = await controller.TrackEvent(new TrackEventRequest("click", "standard"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(400, badRequest.StatusCode);
    }

    [Fact]
    public async Task UsageController_Post_ValidRequest_Returns204()
    {
        using var db = CreateInMemoryDb();
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);
        var controller = new UsageController(tracker, db);

        var result = await controller.TrackEvent(new TrackEventRequest("tab_view", "creative"));

        Assert.IsType<NoContentResult>(result);
    }

    // ── 4. GET summary — 기간 필터 + 카운트 정확성 ──────────────────────

    [Fact]
    public async Task UsageController_GetSummary_ReturnsGroupedCounts()
    {
        using var db = CreateInMemoryDb();
        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);

        // 3개 이벤트 삽입: smart×2, creative×1
        await tracker.TrackAsync("endpoint", "smart");
        await tracker.TrackAsync("endpoint", "smart");
        await tracker.TrackAsync("endpoint", "creative");

        var controller = new UsageController(tracker, db);
        var result = await controller.GetSummary(days: 7);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value!);
        var list = rows.ToList();

        // smart count=2 가 첫 번째 (내림차순)
        var smartRow = list[0];
        var props = smartRow.GetType().GetProperties();
        int smartCount = (int)props.First(p => p.Name == "Count").GetValue(smartRow)!;
        string smartKey = (string)props.First(p => p.Name == "Key").GetValue(smartRow)!;

        Assert.Equal("smart", smartKey);
        Assert.Equal(2, smartCount);
        Assert.Equal(2, list.Count); // smart + creative
    }

    [Fact]
    public async Task UsageController_GetSummary_ExcludesOldEvents()
    {
        using var db = CreateInMemoryDb();
        // 오래된 이벤트 직접 삽입
        db.UsageEvents.Add(new NameForm.Domain.Models.UsageEvent
        {
            EventType = "endpoint",
            Key = "smart",
            CreatedAt = DateTime.UtcNow.AddDays(-40),
        });
        await db.SaveChangesAsync();

        var tracker = new EfUsageTracker(db, NullLogger<EfUsageTracker>.Instance);
        var controller = new UsageController(tracker, db);

        var result = await controller.GetSummary(days: 30);
        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value!).ToList();

        Assert.Empty(rows);
    }
}
