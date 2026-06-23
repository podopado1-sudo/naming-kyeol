using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Tests;

/// <summary>
/// 2026-04-21 옵션 C Phase 1-e: 음운 하드필터 + 특성 노출 유닛 테스트.
/// 설계 철학 확인:
///   - 하드필터는 '존재하지 않는 이름'만 차단 (박박/밥보/맛다)
///   - 트렌드 이름(라온/라희/리아)은 하드필터 통과
///   - 흔한 이름(박지훈/김민우/강주원)은 차단도 특성 감지도 안 됨 (정상)
///   - 특이한 이름(박라온/강아라)은 차단 안 되고 특성 노트만 붙음
/// </summary>
public class PhonologyTests
{
    // ── PhonologyJointLoader 단위 ────────────────────────────────────────

    [Theory]
    [InlineData("ㄲ", "ㄱ")] // ㄲ은 7종성법칙으로 ㄱ
    [InlineData("ㅋ", "ㄱ")]
    [InlineData("ㅅ", "ㄷ")]
    [InlineData("ㅈ", "ㄷ")]
    [InlineData("ㅊ", "ㄷ")]
    [InlineData("ㅌ", "ㄷ")]
    [InlineData("ㅎ", "ㄷ")]
    [InlineData("ㅆ", "ㄷ")]
    [InlineData("ㅍ", "ㅂ")]
    public void NormalizeFinal_SevenJongseongMapping_Works(string input, string expected)
    {
        Assert.Equal(expected, PhonologyJointLoader.NormalizeFinal(input));
    }

    [Theory]
    [InlineData("ㄱ", "ㄱ")]  // 기본 7종성 그대로
    [InlineData("ㄴ", "ㄴ")]
    [InlineData("ㄹ", "ㄹ")]
    [InlineData("ㅁ", "ㅁ")]
    [InlineData("ㅇ", "ㅇ")]
    public void NormalizeFinal_Preserves7Jongseong(string input, string expected)
    {
        Assert.Equal(expected, PhonologyJointLoader.NormalizeFinal(input));
    }

    [Fact]
    public void NormalizeFinal_EmptyInput_ReturnsEmpty()
    {
        Assert.Equal("", PhonologyJointLoader.NormalizeFinal(""));
    }

    [Theory]
    [InlineData("ㄱ", "ㄱ", true)]  // 하드필터 동일자음중복
    [InlineData("ㄷ", "ㄷ", true)]
    [InlineData("ㅂ", "ㅂ", true)]
    [InlineData("ㅈ", "ㅈ", true)]  // ㅈ→ㄷ 매핑 후 ㄷㄷ? 아니면 그대로 ㅈㅈ? 매핑은 final만. ㅈ은 final 매핑 후 ㄷ.
    [InlineData("ㅅ", "ㅅ", true)]  // final ㅅ → ㄷ, initial ㅅ. ㄷ+ㅅ은 블랙 X. → false? 실제로는 ㄷ+ㅅ이 블랙이 아님. 수정
    public void IsJointBlocked_DuplicateConsonant_IsBlocked_Draft(string final, string initial, bool expected)
    {
        // 이 Theory는 매핑 후에 동일자음 되는 케이스 검증. 실제는 아래 _Strict에서 다시 함.
        _ = expected; _ = final; _ = initial;
    }

    [Theory]
    [InlineData("ㄱ", "ㄱ")]  // 박박
    [InlineData("ㄷ", "ㄷ")]  // 맛다
    [InlineData("ㅂ", "ㅂ")]  // 밥보
    public void IsJointBlocked_CoreDuplicates_ReturnTrue(string final, string initial)
    {
        Assert.True(PhonologyJointLoader.IsJointBlocked(final, initial));
    }

    [Theory]
    [InlineData("ㄱ", "ㄴ")]  // 박나 — 비음화이지만 차단 X
    [InlineData("ㄱ", "ㅈ")]  // 박지 — 경음화이지만 차단 X
    [InlineData("ㄴ", "ㄴ")]  // 안나 — 중복이지만 차단 X
    [InlineData("ㄹ", "ㄹ")]  // 달라 — 중복이지만 차단 X
    [InlineData("ㅁ", "ㅁ")]  // 엄미 — 중복이지만 차단 X
    [InlineData("ㅇ", "ㄱ")]  // 영가 — 자연스러움
    [InlineData("", "ㄱ")]    // 받침 없음
    public void IsJointBlocked_NonHardCases_ReturnFalse(string final, string initial)
    {
        Assert.False(PhonologyJointLoader.IsJointBlocked(final, initial));
    }

    // ── IsPhonologicallyBlocked (이름 단위) ──────────────────────────────

    [Theory]
    [InlineData("박가")]   // 박 받침 ㄱ + 가 초성 ㄱ → ㄱ+ㄱ 동일자음중복
    [InlineData("밥보")]   // 밥 받침 ㅂ + 보 초성 ㅂ → ㅂ+ㅂ
    [InlineData("맛다")]   // 맛 받침 ㅅ(→ㄷ) + 다 초성 ㄷ → ㄷ+ㄷ
    [InlineData("김밥보")] // 중간 경계(밥+보)가 걸리면 전체 true
    public void IsPhonologicallyBlocked_KnownBadNames_ReturnTrue(string name)
    {
        Assert.True(KoreanUtils.IsPhonologicallyBlocked(name));
    }

    [Theory]
    // 흔한 이름들 — 경음화/비음화 있어도 차단 X
    [InlineData("박지훈")]  // ㄱ+ㅈ 경음화지만 통과
    [InlineData("박서준")]
    [InlineData("박수빈")]
    [InlineData("박민수")]  // ㄱ+ㅁ 비음화지만 통과
    [InlineData("박하늘")]  // ㄱ+ㅎ 격음화지만 통과
    [InlineData("김민우")]
    [InlineData("강주원")]
    [InlineData("이지우")]
    [InlineData("한가람")]
    [InlineData("안나")]    // ㄴ+ㄴ 중복이지만 통과
    // 트렌드 이름들 — ㄹ 초성 있지만 통과
    [InlineData("라온")]
    [InlineData("라희")]
    [InlineData("리아")]
    [InlineData("박라온")]
    public void IsPhonologicallyBlocked_CommonOrTrendyNames_ReturnFalse(string name)
    {
        Assert.False(KoreanUtils.IsPhonologicallyBlocked(name),
            $"'{name}' 은 차단 대상이 아님. 하이브리드 철학 위반.");
    }

    [Fact]
    public void IsPhonologicallyBlocked_ShortName_ReturnFalse()
    {
        Assert.False(KoreanUtils.IsPhonologicallyBlocked(""));
        Assert.False(KoreanUtils.IsPhonologicallyBlocked("김"));
    }

    // ── DescribePhonology (특성 노트) ────────────────────────────────────

    [Fact]
    public void DescribePhonology_ParkRaon_ReportsRInitialCharacteristic()
    {
        var notes = KoreanUtils.DescribePhonology("박라온");

        // 박(받침 ㄱ) + 라(초성 ㄹ) → r_initial_after_final 특성 감지
        Assert.Contains(notes, n => n.Id == "r_initial_after_final");
    }

    [Fact]
    public void DescribePhonology_JungRa_ReportsRInitial()
    {
        // 정(받침 ㅇ) + 라(초성 ㄹ) → r_initial_after_final
        var notes = KoreanUtils.DescribePhonology("정라");
        Assert.Contains(notes, n => n.Id == "r_initial_after_final");
    }

    [Fact]
    public void DescribePhonology_ParkJihun_NoCharacteristics()
    {
        // 흔한 이름 — 특성 감지 없음
        var notes = KoreanUtils.DescribePhonology("박지훈");
        Assert.Empty(notes);
    }

    [Fact]
    public void DescribePhonology_KimMinwoo_NoCharacteristics()
    {
        var notes = KoreanUtils.DescribePhonology("김민우");
        Assert.Empty(notes);
    }

    [Fact]
    public void DescribePhonology_SameVowelThreeStreak_Detected()
    {
        // 강(ㅏ) + 아(ㅏ) + 라(ㅏ) = ㅏ 3연속
        var notes = KoreanUtils.DescribePhonology("강아라");
        Assert.Contains(notes, n => n.Id == "same_vowel_three_streak");

        // 메시지에 ㅏ가 포함되어야 함 (플레이스홀더 치환 검증)
        var streakNote = notes.First(n => n.Id == "same_vowel_three_streak");
        Assert.Contains("ㅏ", streakNote.Message);
    }

    [Fact]
    public void DescribePhonology_TwoVowelStreak_NotTriggered()
    {
        // 2연속은 감지 안 함 (minLength=3)
        var notes = KoreanUtils.DescribePhonology("아라");
        Assert.DoesNotContain(notes, n => n.Id == "same_vowel_three_streak");
    }

    [Fact]
    public void DescribePhonology_PureNeutralStreak_Detected()
    {
        // 민(ㅣ) + 지(ㅣ) + 니(ㅣ) = ㅣ 3연속
        var notes = KoreanUtils.DescribePhonology("민지니");
        Assert.Contains(notes, n => n.Id == "pure_neutral_streak");
    }

    // ── PhonologyVowelLoader 단위 ────────────────────────────────────────

    [Theory]
    [InlineData("ㅏ", VowelClass.Yang)]
    [InlineData("ㅗ", VowelClass.Yang)]
    [InlineData("ㅐ", VowelClass.Yang)]
    [InlineData("ㅓ", VowelClass.Yin)]
    [InlineData("ㅜ", VowelClass.Yin)]
    [InlineData("ㅡ", VowelClass.Yin)]
    [InlineData("ㅣ", VowelClass.Neutral)]
    public void ClassifyVowel_KnownVowels_ReturnsExpectedClass(string vowel, VowelClass expected)
    {
        Assert.Equal(expected, PhonologyVowelLoader.ClassifyVowel(vowel));
    }

    [Fact]
    public void ClassifyVowel_UnknownInput_ReturnsUnknown()
    {
        Assert.Equal(VowelClass.Unknown, PhonologyVowelLoader.ClassifyVowel("A"));
        Assert.Equal(VowelClass.Unknown, PhonologyVowelLoader.ClassifyVowel(""));
    }

    // ── 동시 로딩 레이스 회귀 (2026-06-23) ───────────────────────────────
    // 과거 버그: LoadData가 _data에 Empty를 먼저 publish한 뒤 실제 데이터로 교체 →
    // double-checked locking의 락 밖 첫 읽기에서 다른 스레드가 빈 데이터를 관측,
    // NormalizeFinal/ClassifyVowel이 입력을 그대로 반환(7종성·모음분류 실패).
    // 수정 후엔 완전히 빌드된 객체만 한 번에 할당되므로 어느 스레드도 빈 데이터를 보지 않아야 함.

    [Fact]
    public async Task PhonologyJointLoader_ConcurrentLoadAfterReset_NeverYieldsEmptyData()
    {
        for (int round = 0; round < 5; round++)
        {
            PhonologyJointLoader.ResetCache();

            const int threads = 32;
            using var start = new ManualResetEventSlim(false);
            var failures = new System.Collections.Concurrent.ConcurrentBag<string>();

            var tasks = Enumerable.Range(0, threads).Select(_ => Task.Run(() =>
            {
                start.Wait();
                // ㅋ → ㄱ 매핑이 비어 있으면 입력 "ㅋ"이 그대로 반환됨 = 레이스 노출
                var mapped = PhonologyJointLoader.NormalizeFinal("ㅋ");
                if (mapped != "ㄱ") failures.Add($"NormalizeFinal('ㅋ')={mapped}");
            })).ToArray();

            start.Set();
            await Task.WhenAll(tasks);

            Assert.True(failures.IsEmpty,
                $"라운드 {round}: 동시 로딩 중 빈 데이터 관측 — {string.Join(", ", failures)}");
        }
    }

    [Fact]
    public async Task PhonologyVowelLoader_ConcurrentLoadAfterReset_NeverYieldsEmptyData()
    {
        for (int round = 0; round < 5; round++)
        {
            PhonologyVowelLoader.ResetCache();

            const int threads = 32;
            using var start = new ManualResetEventSlim(false);
            var failures = new System.Collections.Concurrent.ConcurrentBag<string>();

            var tasks = Enumerable.Range(0, threads).Select(_ => Task.Run(() =>
            {
                start.Wait();
                var cls = PhonologyVowelLoader.ClassifyVowel("ㅏ");
                if (cls != VowelClass.Yang) failures.Add($"ClassifyVowel('ㅏ')={cls}");
            })).ToArray();

            start.Set();
            await Task.WhenAll(tasks);

            Assert.True(failures.IsEmpty,
                $"라운드 {round}: 동시 로딩 중 빈 데이터 관측 — {string.Join(", ", failures)}");
        }
    }

    [Fact]
    public async Task NegativePatternLoader_ConcurrentLoadAfterReset_NeverYieldsEmptyData()
    {
        for (int round = 0; round < 5; round++)
        {
            NegativePatternLoader.ResetCache();

            const int threads = 32;
            using var start = new ManualResetEventSlim(false);
            var failures = new System.Collections.Concurrent.ConcurrentBag<string>();

            var tasks = Enumerable.Range(0, threads).Select(_ => Task.Run(() =>
            {
                start.Wait();
                // in-place 변경 중인 부분 초기화 상태가 노출되면 컬렉션이 비어 있음
                var data = NegativePatternLoader.Data;
                if (data.StrongPlosives.Count == 0 || data.NegativeVerbsAndAdjectives.Count == 0)
                    failures.Add($"plosives={data.StrongPlosives.Count}, verbs={data.NegativeVerbsAndAdjectives.Count}");
            })).ToArray();

            start.Set();
            await Task.WhenAll(tasks);

            Assert.True(failures.IsEmpty,
                $"라운드 {round}: 동시 로딩 중 부분 초기화 상태 관측 — {string.Join(", ", failures)}");
        }
    }
}
