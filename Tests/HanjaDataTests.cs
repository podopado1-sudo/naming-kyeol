using System.Linq;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

public class HanjaDataTests
{
    [Fact]
    public void FindByCharacter_ExistingHanja_ReturnsInfo()
    {
        // Arrange
        var character = "春";

        // Act
        var result = HanjaData.FindByCharacter(character);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(character, result.Character);
        Assert.NotEmpty(result.Reading);
    }

    [Theory]
    [InlineData(0xF918)]  // 落 호환자
    [InlineData(0xFA19)]  // 神 호환자
    [InlineData(0xFA52)]  // 禍 호환자
    [InlineData(0x2F996)] // 苦 호환자
    [InlineData(0x2F9A2)] // 菌 호환자
    public void IsForbiddenNameHanja_CompatCodepoint_BlockedViaNfkc(int codepoint)
    {
        // 사전에 호환 코드포인트가 별도 엔트리로 존재 — NFKC 정규형 조회로 차단돼야 함.
        // 문자 리터럴 대신 정수 코드포인트 사용: 리터럴은 편집기 NFC 정규화로
        // 조용히 일반자로 바뀐 회귀 전력이 있음(그게 이 테스트가 지키는 버그).
        var compat = char.ConvertFromUtf32(codepoint);
        Assert.True(HanjaData.IsForbiddenNameHanja(compat));
    }

    [Fact]
    public void IsForbiddenNameHanja_NormalPositiveHanja_NotBlocked()
    {
        Assert.False(HanjaData.IsForbiddenNameHanja("春"));
        Assert.False(HanjaData.IsForbiddenNameHanja("智"));
    }

    [Fact]
    public void FindByCharacter_NonExistingHanja_ReturnsNull()
    {
        // Arrange
        var character = "없는한자";

        // Act
        var result = HanjaData.FindByCharacter(character);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void FindByReading_ExistingReading_ReturnsList()
    {
        // Arrange
        var reading = "춘";

        // Act
        var result = HanjaData.FindByReading(reading);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result);
        Assert.All(result, h => Assert.Equal(reading, h.Reading));
    }

    [Fact]
    public void GetAllHanja_ReturnsNonEmptyList()
    {
        // Act
        var result = HanjaData.GetAllHanja();

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }

    [Fact]
    public void FindByReading_Ju_CommonHanjaRankHigherThanUncommon()
    {
        // "주"로 검색 시 검수된 Core Dataset 인명 한자가 상위권에 위치해야 함
        // Core Dataset(2026-04) 도입 후 Core_v1이 +2000 가점을 받고 실제 인명에 쓰이는
        // 검수 완료 한자가 우선 정렬됨. 株(그루터기)처럼 실제 인명에 드문 한자는
        // Core_v1에 포함되지 않아 하위권으로 밀리는 것이 올바른 동작
        var result = HanjaData.FindByReading("주");
        Assert.True(result.Count >= 7, "주 읽기로 최소 7개 한자가 있어야 합니다");

        // 인명에 실제로 쓰이는 대표 한자들(모두 Core_v1 수록)
        var commonExpected = new HashSet<string> { "珠", "柱", "周", "主", "注", "朱" };
        var topChars = result.Take(commonExpected.Count + 5).Select(h => h.Character).ToHashSet();

        foreach (var ch in commonExpected)
        {
            Assert.Contains(ch, topChars);
        }
    }

    [Fact]
    public void FindByReading_Won_CommonHanjaRankHigherThanUncommon()
    {
        // "원"으로 검색 시 인명 빈도 한자가 상위권(Top N+5)에 위치해야 함
        var result = HanjaData.FindByReading("원");
        var commonExpected = new HashSet<string> { "源", "元", "園", "遠", "原", "院", "援", "願" };

        var topChars = result.Take(commonExpected.Count + 5).Select(h => h.Character).ToHashSet();
        foreach (var ch in commonExpected)
        {
            Assert.Contains(ch, topChars);
        }
    }

    [Fact]
    public void FindByReading_Jun_CommonHanjaRankHigherThanUncommon()
    {
        // "준"으로 검색 시 인명 빈도 한자가 상위권(Top N+5)에 위치해야 함
        // Core Dataset 도입 후 Core_v1 한자가 우선 정렬됨
        var result = HanjaData.FindByReading("준");
        var commonExpected = new HashSet<string> { "俊", "準", "峻", "浚", "駿" };

        var topChars = result.Take(commonExpected.Count + 5).Select(h => h.Character).ToHashSet();
        foreach (var ch in commonExpected)
        {
            Assert.Contains(ch, topChars);
        }
    }

    [Fact]
    public void CalculateRelevanceScore_CommonNameHanja_GetsBonus()
    {
        // 인명 빈도 한자는 가점을 받아야 함
        var common = HanjaData.FindByCharacter("珠");
        Assert.NotNull(common);
        var score = HanjaData.CalculateRelevanceScore(common);

        // CJK Basic(1000) + 대법원(500) + 인명빈도(300) = 최소 1800
        Assert.True(score >= 1800, $"珠의 점수가 최소 1800 이상이어야 합니다 (실제: {score})");
    }

    // ── Core Dataset v1 (hanja_core_v1.json) 통합 검증 ──────────────────────

    [Fact]
    public void CoreDataset_LoadsAtLeast2000Entries()
    {
        // 2026-04 기준 hanja_core_v1.json 2,060자 → Source="Core_v1"로 표시되어야 함
        var coreEntries = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1")
            .ToList();

        Assert.True(coreEntries.Count >= 2000,
            $"Core Dataset v1 로드 엔트리가 최소 2,000자 이상이어야 함 (실제: {coreEntries.Count})");
    }

    [Fact]
    public void CoreDataset_NoEnglishFiveElement()
    {
        // 영문 오행 값(Wood/Fire/Earth/Metal/Water/Gold)이 Core Dataset에 섞여 있으면 안 됨
        var english = new HashSet<string> { "Wood", "Fire", "Earth", "Metal", "Water", "Gold" };

        var violations = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1" && english.Contains(h.FiveElement))
            .Select(h => $"{h.Character}={h.FiveElement}")
            .ToList();

        Assert.Empty(violations);
    }

    [Fact]
    public void CoreDataset_AllEntriesHaveValidFiveElement()
    {
        var valid = new HashSet<string> { "木", "火", "土", "金", "水" };

        var invalid = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1" && !valid.Contains(h.FiveElement))
            .Select(h => $"{h.Character}={h.FiveElement}")
            .ToList();

        Assert.Empty(invalid);
    }

    [Fact]
    public void CoreDataset_RationalePopulated()
    {
        // Core_v1로 로드된 엔트리는 rationale(판정 근거)가 반드시 있어야 함
        var missingRationale = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1" && string.IsNullOrWhiteSpace(h.Rationale))
            .Select(h => h.Character)
            .ToList();

        Assert.True(missingRationale.Count == 0,
            $"Core_v1 엔트리 중 rationale 누락 {missingRationale.Count}자: " +
            string.Join(", ", missingRationale.Take(10)));
    }

    [Fact]
    public void CoreDataset_ConfidenceGradeIsS()
    {
        // Core_v1 소스는 S등급(검수 완료)이어야 함
        var nonS = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1" && h.ConfidenceGrade != "S")
            .Select(h => $"{h.Character}={h.ConfidenceGrade}")
            .ToList();

        Assert.Empty(nonS);
    }

    [Fact]
    public void CoreDataset_KnownBatchHanjaLoaded()
    {
        // 이번 세션에 병합한 배치 중 샘플 한자들이 Core_v1으로 로드되었는지 확인
        var samples = new[] { "嘉", "姑", "國", "蘭", "媚", "嫦" };

        foreach (var ch in samples)
        {
            var info = HanjaData.FindByCharacter(ch);
            Assert.NotNull(info);
            Assert.Equal("Core_v1", info!.Source);
            Assert.False(string.IsNullOrWhiteSpace(info.Rationale),
                $"{ch}의 rationale이 비어있음");
        }
    }
}
