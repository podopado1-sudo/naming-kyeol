using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Tests;

/// <summary>
/// /evaluate 한자 입력의 정리·판정(<see cref="HanjaInput"/>·<see cref="HanjaPicks"/>) — 설계서 docs/plan-hanja-input-2026-11.md §13-1 ①~⑦.
/// 기대값은 검사 대상 함수가 아니라 코드포인트 숫자·사전 원자료·유니코드 정규화·프런트 사전 파일로 따로 센다.
/// ⚠️ 호환 한자(U+F900~FAFF·U+2F800~2FA1F)와 BMP 밖 글자는 글자로 적지 않는다 — 코드포인트 숫자(<see cref="Cp"/>)만 쓴다
/// (글자 리터럴이 편집 도구의 NFC 정규화로 통합 한자로 바뀐 전력이 있다). 주석의 한자는 모두 통합 한자다.
/// 보이지 않는 글자(전각 공백·폭 없는 문자·이체 선택자)와 조합형 자모(NFD)도 같은 까닭으로 유니코드 이스케이프로만 적는다 — 편집 도구가 지우거나
/// NFC 로 합치면 단언은 통과한 채 검사 내용만 사라진다.
/// </summary>
public class HanjaInputTests
{
    public HanjaInputTests()
    {
        HanjaData.LoadExternalData();
    }

    private static string Cp(int codePoint) => char.ConvertFromUtf32(codePoint);
    private static Rune R(int codePoint) => new(codePoint);

    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(thisFile), AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var dir = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        }
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }

    /// <summary>사전의 독음 음절 전부 + 그 두음 꼴(후보 목록이 생기는 음절).</summary>
    private static List<char> AllSyllables()
    {
        var set = new SortedSet<char>();
        foreach (var h in HanjaData.GetAllHanja())
            foreach (var r in new[] { h.Reading }.Concat(h.AlternateReadings))
            {
                Assert.Equal(1, r.Length);
                set.Add(r[0]);
                set.Add(RequiredCharEngine.ApplyInitialDueum(r[0]));
            }
        return set.ToList();
    }

    // ═══════════════════════════════════════════════════════════════
    // ① 호환 한자 — 한글 입력기가 내는 코드
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Find_EveryCompatibilityIdeograph_ResolvesToItsUnifiedDictionaryEntry()
    {
        int found = 0;
        var problems = new List<string>();
        foreach (var (from, to) in new[] { (0xF900, 0xFAFF), (0x2F800, 0x2FA1F) })
        {
            for (int cp = from; cp <= to; cp++)
            {
                string nfkc;
                try { nfkc = Cp(cp).Normalize(NormalizationForm.FormKC); }
                catch (ArgumentException) { continue; }   // 배정되지 않은 코드포인트를 거절하는 정규화 구현(NLS)

                // 정규형이 한 글자이고 사전에 그 키가 있으면, 호환 코드로 넣어도 그 항목이 나와야 한다
                if (nfkc.EnumerateRunes().Count() != 1 || !HanjaData.HanjaDictionary.TryGetValue(nfkc, out var expected)) continue;
                found++;
                var actual = HanjaInput.Find(R(cp));
                if (!ReferenceEquals(expected, actual))
                    problems.Add($"U+{cp:X4} → U+{char.ConvertToUtf32(nfkc, 0):X4}: {(actual == null ? "못 찾음" : "다른 항목")}");
                else if (actual!.Character != nfkc)
                    problems.Add($"U+{cp:X4}: 항목의 Character 가 통합 한자가 아님");
            }
        }

        Assert.True(problems.Count == 0, string.Join("\n", problems.Take(20)));
        Assert.True(found >= 250, $"사전에 대응 글자가 있는 호환 한자 {found}자 — 검사가 비어 있다");
    }

    /// <summary>
    /// 윈도우 한글 입력기 사전(imkrhjd.lex)이 한자 키 후보로 내는 호환 한자 290건(Tests/TestData/win-ime-compat.json — 2026-11-19 이 PC 에서 뽑은 목록).
    /// 사전에 대응 글자가 있는 288건은 모두 찾아지고, 입력기가 그 음절에서 내는 글자는 그 음절 칸에 받아진다. 받아지지 않는 것은 입력기가 본음 키 아래에
    /// 실은 4건뿐이다(락 諾·령 寧·로 怒·리 異 — 지정 독음이 낙·녕/영·노·이 뿐이라 한쪽 방향 규칙으로 거절. 설계서 §5-4 의 '령 寧 거절'과 같은 줄).
    /// </summary>
    [Fact]
    public void Find_WindowsImeCompatibilityCandidates_AreAcceptedInTheirSyllable()
    {
        var path = Path.Combine(RepoRoot(), "Tests", "TestData", "win-ime-compat.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var rows = doc.RootElement.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal(290, rows.Count);

        int found = 0, accepted = 0;
        var rejected = new List<string>();
        foreach (var row in rows)
        {
            int compat = row.GetProperty("compat").GetInt32();
            int unified = row.GetProperty("unified").GetInt32();
            string reading = row.GetProperty("reading").GetString()!;
            Assert.True((compat >= 0xF900 && compat <= 0xFAFF) || (compat >= 0x2F800 && compat <= 0x2FA1F), $"U+{compat:X4} 는 호환 한자가 아니다");

            var hit = HanjaInput.Find(R(compat));
            if (!HanjaData.HanjaDictionary.TryGetValue(Cp(unified), out var expected))
            {
                Assert.Null(hit);
                continue;
            }
            Assert.Same(expected, hit);
            found++;

            // /evaluate 입력으로도 같은 판정 — 1음절 이름의 그 음절 칸에 호환 코드 그대로
            var (picks, problem) = HanjaInput.Resolve(reading, "김", Cp(compat), null);
            if (HanjaInput.ReadsAs(expected, reading[0]))
            {
                accepted++;
                Assert.Null(problem);
                Assert.Same(expected, picks!.Name[0].Hanja);
                Assert.Equal(Cp(unified), picks.NameText);   // 정규 꼴은 통합 한자
            }
            else
            {
                rejected.Add($"{reading} U+{unified:X4}");
                Assert.Equal(HanjaInput.CodeReadingMismatch, problem!.Code);
            }
        }

        Assert.Equal(288, found);
        Assert.Equal(284, accepted);
        Assert.Equal(new[] { "락 U+8AFE", "령 U+5BE7", "로 U+6012", "리 U+7570" }, rejected.OrderBy(x => x, StringComparer.Ordinal));
    }

    // ═══════════════════════════════════════════════════════════════
    // ② 정리·정규화
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Strip_RemovesWhitespaceZeroWidthAndVariationSelectors()
    {
        string seo = Cp(0x745E), yun = Cp(0x6F64);   // 瑞 · 潤
        Assert.Equal(string.Empty, HanjaInput.Strip(null));
        Assert.Equal(string.Empty, HanjaInput.Strip(" \t\u3000\u200B\uFEFF"));
        // 가운데 공백(반각·전각)·폭 없는 문자·이체 선택자(BMP U+FE00~FE0F, 보충 U+E0100~E01EF)
        Assert.Equal(seo + yun, HanjaInput.Strip($" {seo}\uFE00 \u3000\u200B\u200C\u200D{yun}{Cp(0xE0100)}\uFEFF\uFE0F{Cp(0xE01EF)}"));
        // 표시 글자는 남는다
        Assert.Equal("*-", HanjaInput.Strip(" * - "));
    }

    [Fact]
    public void Find_VariationSelectorAndKangxiRadical_AreNormalized()
    {
        // U+674E 李 + U+FE00 — 이체 선택자가 붙으면 NFKC 뒤에도 남아 한 글자 판정에서 떨어진다 → 먼저 지운다
        var (picks, problem) = HanjaInput.Resolve("이", "김", Cp(0x674E) + "\uFE00", null);
        Assert.Null(problem);
        Assert.Equal(Cp(0x674E), picks!.Name[0].Hanja!.Character);

        // 강희 부수 U+2FA6 → 金 U+91D1 (PDF 복사에서 온다), 부수 보충 U+2EA4(爪 꼴)는 NFKC 대응이 없어 한자가 아니다
        Assert.Equal(Cp(0x91D1), HanjaInput.Find(R(0x2FA6))!.Character);
        Assert.Equal(Cp(0x91D1), HanjaInput.NormalizeRune(R(0x2FA6)).ToString());
        (picks, problem) = HanjaInput.Resolve("금", "이", Cp(0x2FA6), null);
        Assert.Null(problem);
        Assert.Equal(Cp(0x91D1), picks!.NameText);

        // 범위 밖 글자는 건드리지 않는다
        Assert.Equal(0x745E, HanjaInput.NormalizeRune(R(0x745E)).Value);
        Assert.Equal(0x328A, HanjaInput.NormalizeRune(R(0x328A)).Value);
    }

    /// <summary>
    /// 호환 한자 블록(U+F900~FAFF·U+2F800~2FA1F) 안의 배정되지 않은 코드포인트(U+FA6E·U+FADA~FAFF 등)는 글자가 아니다 — '사전에 없는 글자'가 아니라
    /// '한자가 아님'으로 끝난다(사전에 없는 글자의 안내 — 모양만 다른 같은 글자를 찾아보라 — 가 글자 아닌 코드에 붙지 않게).
    /// 블록 안의 통합 한자 12자(정규형이 자기 자신)는 한자다. 기대값은 유니코드 분류(배정 여부)로 따로 센다.
    /// </summary>
    [Fact]
    public void CompatibilityBlock_UnassignedCodePoints_AreNotHanja_ButItsUnifiedIdeographsAre()
    {
        int unassigned = 0, unified = 0;
        foreach (var (from, to) in new[] { (0xF900, 0xFAFF), (0x2F800, 0x2FA1F) })
            for (int cp = from; cp <= to; cp++)
            {
                var text = Cp(cp);
                var category = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(text, 0);
                var judged = HanjaInput.Judge(text, '김');
                var (_, problem) = HanjaInput.Resolve("김", "이", text, null);

                if (category == System.Globalization.UnicodeCategory.OtherNotAssigned)
                {
                    unassigned++;
                    Assert.True(judged.Status == HanjaInput.CodeNotHanja, $"U+{cp:X4} 판정 {judged.Status}");
                    Assert.Null(judged.Character);
                    Assert.Null(judged.Suggestion);
                    Assert.Null(HanjaInput.Find(R(cp)));
                    Assert.Equal(HanjaInput.CodeNotHanja, problem!.Code);
                    continue;
                }

                // 배정된 글자는 한자다(사전에 있든 없든 '한자가 아님'은 아니다)
                Assert.True(judged.Status != HanjaInput.CodeNotHanja, $"U+{cp:X4} 판정 {judged.Status}");
                if (text.Normalize(NormalizationForm.FormKC) == text)
                {
                    // 정규형이 자기 자신인 글자 = 블록 안의 통합 한자. 정규 꼴 글자가 그 코드 그대로다
                    unified++;
                    Assert.Equal(text, judged.Character);
                    Assert.NotEqual(HanjaInput.CodeNotHanja, problem?.Code);
                }
            }
        Assert.Equal(12, unified);
        Assert.True(unassigned >= 40, $"배정되지 않은 코드 {unassigned}개 — 검사가 비어 있다");
    }

    /// <summary>
    /// 글자 조회는 정규화를 한 번만 하고 사전을 바로 찾는다 — 그 결과가 사전의 공용 조회(HanjaData.FindByCharacter — 사전에 없으면 정규화를 한 번 더 건다)와
    /// 같은지 한자 영역 전체에서 본다. 다른 것은 위 테스트의 배정되지 않은 호환 코드뿐이어야 하는데, 그런 코드는 어느 쪽으로도 사전에 없다.
    /// </summary>
    [Fact]
    public void Find_AgreesWithTheDictionaryLookup_OverEveryHanCodePoint()
    {
        int checkedCount = 0, hits = 0;
        foreach (var (from, to) in new[] { (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0x20000, 0x2EBEF), (0x2F800, 0x2FA1F), (0x30000, 0x323AF) })
            for (int cp = from; cp <= to; cp++)
            {
                HanjaInfo? expected;
                try { expected = HanjaData.FindByCharacter(Cp(cp)); }
                catch (ArgumentException) { continue; }   // 배정되지 않은 코드포인트를 거절하는 정규화 구현 — 그런 환경에서는 공용 조회가 던진다
                var actual = HanjaInput.Find(R(cp));
                if (!ReferenceEquals(expected, actual)) Assert.Fail($"U+{cp:X4}: 공용 조회 {expected?.Character ?? "없음"} · Find {actual?.Character ?? "없음"}");
                checkedCount++;
                if (actual != null) hits++;
            }
        Assert.True(checkedCount > 90000, $"대조한 코드포인트 {checkedCount}");
        Assert.True(hits >= HanjaData.GetAllHanja().Count, $"찾은 글자 {hits}");
    }

    [Theory]
    [InlineData(0x328A)]    // 동그라미 月 — 범위 없이 NFKC 를 걸면 月 이 된다
    [InlineData(0x3220)]    // 괄호 一
    [InlineData(0x2EA4)]    // 부수 보충(대응 한자 없음)
    [InlineData(0xFF0A)]    // 전각 별표 — 표시 글자 '*' 가 아니다
    [InlineData(0xC11C)]    // 한글 '서'
    [InlineData(0x0041)]    // A
    [InlineData(0x3042)]    // 히라가나
    [InlineData(0xFFFD)]    // 대체 문자
    public void NonHanInput_IsNotHanja(int codePoint)
    {
        Assert.Null(HanjaInput.Find(R(codePoint)));

        var (picks, problem) = HanjaInput.Resolve("월", "김", Cp(codePoint), null);
        Assert.Null(picks);
        Assert.Equal(HanjaInput.CodeNotHanja, problem!.Code);
        Assert.Equal(HanjaInput.TargetName, problem.Target);
        Assert.Equal(0, problem.Slot);
        Assert.Equal(HanjaInput.NotHanjaMessage('월'), problem.Message);

        var judged = HanjaInput.Judge(Cp(codePoint), '월');
        Assert.Equal(HanjaInput.CodeNotHanja, judged.Status);
        Assert.Null(judged.Character);
        Assert.Null(judged.Hanja);
    }

    // ═══════════════════════════════════════════════════════════════
    // ③ Rune 으로 센다 · 한글 검사
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Resolve_CountsRunes_NotUtf16Units()
    {
        // 사전의 BMP 밖 글자(UTF-16 길이 2)를 하나 고른다 — 테스트 안에서 찾는다
        var big = HanjaData.GetAllHanja()
            .Where(h => h.Character.Length == 2 && char.IsSurrogatePair(h.Character, 0))
            .OrderBy(h => h.Character, StringComparer.Ordinal)
            .First();
        string name = big.Reading + "윤";

        var (picks, problem) = HanjaInput.Resolve(name, "김", big.Character + "*", null);
        Assert.Null(problem);
        Assert.Equal(2, picks!.Name.Count);
        Assert.Same(big, picks.Name[0].Hanja);
        Assert.Equal(HanjaPickKind.Auto, picks.Name[1].Kind);
        Assert.Equal(big.Character + "*", picks.NameText);

        // 그 글자 하나만 넣으면 UTF-16 길이는 이름 글자 수(2)와 같지만 글자는 한 자다
        (picks, problem) = HanjaInput.Resolve(name, "김", big.Character, null);
        Assert.Null(picks);
        Assert.Equal(HanjaInput.CodeNameHanjaCount, problem!.Code);
        Assert.Equal(-1, problem.Slot);

        // 1음절 이름에는 한 칸으로 들어간다
        (picks, problem) = HanjaInput.Resolve(big.Reading, "김", big.Character, null);
        Assert.Null(problem);
        Assert.Same(big, Assert.Single(picks!.Name).Hanja);
    }

    [Fact]
    public void Resolve_LoneSurrogate_IsNotHanja()
    {
        var (picks, problem) = HanjaInput.Resolve("서윤", "김", "\uD840*", null);
        Assert.Null(picks);
        Assert.Equal(HanjaInput.CodeNotHanja, problem!.Code);
        Assert.Equal(0, problem.Slot);

        (picks, problem) = HanjaInput.Resolve("서윤", "김", "*\uDC00", null);
        Assert.Equal(HanjaInput.CodeNotHanja, problem!.Code);
        Assert.Equal(1, problem.Slot);

        Assert.Equal(HanjaInput.CodeNotHanja, HanjaInput.Judge("\uD840", null).Status);
    }

    public static IEnumerable<object[]> NonHangulNames() => new[]
    {
        new object[] { "서 윤" },                            // 공백
        new object[] { " 서윤" },
        new object[] { "ㅅ윤" },                             // 낱자모
        new object[] { "\u1109\u1165윤" },                   // 조합형 자모(NFD)
        new object[] { char.ConvertFromUtf32(0x745E) + "윤" }, // 한자
        new object[] { "서\U0001F600" },                     // 이모지(서로게이트 쌍)
        new object[] { "Seo" },
    };

    [Theory]
    [MemberData(nameof(NonHangulNames))]
    public void Resolve_HanjaFieldWithNonHangulName_IsRejected_ButNoFieldMeansNoCheck(string name)
    {
        // 한자 필드가 하나라도 지정되면(전부 '*' 여도) 이름은 한글 음절만이어야 한다
        foreach (var (nameHanja, lastNameHanja) in new (string?, string?)[] { ("**", null), (Cp(0x745E) + "*", null), (null, Cp(0x674E)) })
        {
            var (picks, problem) = HanjaInput.Resolve(name, "이", nameHanja, lastNameHanja);
            Assert.Null(picks);
            Assert.Equal(HanjaInput.CodeNameNotHangul, problem!.Code);
            Assert.Equal(HanjaInput.TargetName, problem.Target);
            Assert.Equal(-1, problem.Slot);
        }

        // 같은 이름이라도 한자 필드가 없으면 검사하지 않는다 — 지금처럼 통과
        foreach (var (nameHanja, lastNameHanja) in new (string?, string?)[] { (null, null), ("", ""), (" \u3000", "\u200B"), (null, "") })
        {
            var (picks, problem) = HanjaInput.Resolve(name, "이", nameHanja, lastNameHanja);
            Assert.Null(picks);
            Assert.Null(problem);
        }
    }

    [Fact]
    public void Resolve_SurnameIsTrimmedBeforeTheHangulCheck()
    {
        var (picks, problem) = HanjaInput.Resolve("서윤", " 이 ", Cp(0x745E) + "*", null);
        Assert.Null(problem);
        Assert.NotNull(picks);

        (picks, problem) = HanjaInput.Resolve("서윤", " 유 ", null, Cp(0x5289));   // 劉 — 글자 수도 Trim 한 성씨로 센다
        Assert.Null(problem);
        Assert.Equal(Cp(0x5289), picks!.SurnameText);

        foreach (var lastName in new[] { "이a", "李", "ㅇ", "남 궁" })
        {
            (picks, problem) = HanjaInput.Resolve("서윤", lastName, Cp(0x745E) + "*", null);
            Assert.Null(picks);
            Assert.Equal(HanjaInput.CodeNameNotHangul, problem!.Code);
            Assert.Equal(HanjaInput.TargetSurname, problem.Target);
        }
    }

    [Fact]
    public void IsHangulSyllables_OnlyPrecomposedSyllables()
    {
        Assert.True(HanjaInput.IsHangulSyllables("가"));
        Assert.True(HanjaInput.IsHangulSyllables("힣"));
        Assert.True(HanjaInput.IsHangulSyllables("서윤"));
        Assert.False(HanjaInput.IsHangulSyllables(null));
        Assert.False(HanjaInput.IsHangulSyllables(""));
        Assert.False(HanjaInput.IsHangulSyllables("서 윤"));
        Assert.False(HanjaInput.IsHangulSyllables("ㅅ"));
        Assert.False(HanjaInput.IsHangulSyllables("\u1109\u1165"));
        Assert.False(HanjaInput.IsHangulSyllables("서" + Cp(0x745E)));
        Assert.False(HanjaInput.IsHangulSyllables("\uD7A4"));   // 힣 바로 다음
        Assert.False(HanjaInput.IsHangulSyllables("\uABFF"));   // 가 바로 앞
    }

    [Fact]
    public void Resolve_CountAndSurnameNoneErrors()
    {
        // 이름 2자에 한자 3자 / 1자
        var (_, problem) = HanjaInput.Resolve("서윤", "이", Cp(0x745E) + Cp(0x6F64) + Cp(0x745E), null);
        Assert.Equal(HanjaInput.CodeNameHanjaCount, problem!.Code);
        Assert.Equal(HanjaInput.NameHanjaCountMessage, problem.Message);
        (_, problem) = HanjaInput.Resolve("서윤", "이", "*", null);
        Assert.Equal(HanjaInput.CodeNameHanjaCount, problem!.Code);

        // 성씨 '남궁'에 한 자
        (_, problem) = HanjaInput.Resolve("민", "남궁", null, Cp(0x5357));
        Assert.Equal(HanjaInput.CodeSurnameHanjaCount, problem!.Code);
        Assert.Equal(HanjaInput.TargetSurname, problem.Target);
        Assert.Equal(HanjaInput.SurnameHanjaCountMessage, problem.Message);

        // 성씨 자리의 '한자 없음'
        (_, problem) = HanjaInput.Resolve("민", "남궁", null, Cp(0x5357) + "-");
        Assert.Equal(HanjaInput.CodeSurnameNone, problem!.Code);
        Assert.Equal(1, problem.Slot);
        Assert.Equal(HanjaInput.SurnameNoneMessage, problem.Message);

        // 검사 순서 — 글자 수가 글자 판정보다 먼저, 성씨의 '한자 없음'이 이름 칸 글자 판정보다 먼저
        (_, problem) = HanjaInput.Resolve("서윤", "이", "A", null);
        Assert.Equal(HanjaInput.CodeNameHanjaCount, problem!.Code);
        (_, problem) = HanjaInput.Resolve("서윤", "이", "A*", "-");
        Assert.Equal(HanjaInput.CodeSurnameNone, problem!.Code);
    }

    // ═══════════════════════════════════════════════════════════════
    // ④ 독음 경계 사례표 (설계서 §5-4)
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    // 한글 입력기가 내는 호환 코드 → 통합 한자, 두음 꼴 칸
    [InlineData("이", 0xF9E1, 0x674E, true)]    // 李 리/이
    [InlineData("유", 0xF9C9, 0x67F3, true)]    // 柳 류/유
    [InlineData("임", 0xF9F4, 0x6797, true)]    // 林 — 사전 독음은 림 하나(하드코딩), 두음 꼴·보충 표
    [InlineData("나", 0xF90F, 0x7F85, true)]    // 羅 나/라
    [InlineData("연", 0xF999, 0x84EE, true)]    // 蓮 련/연
    [InlineData("용", 0xF9C4, 0x9F8D, true)]    // 龍 룡/용
    [InlineData("율", 0xF9D8, 0x5F8B, true)]    // 律 률/율
    [InlineData("율", 0xF9DA, 0x6817, true)]    // 栗 률/율
    [InlineData("열", 0xF99F, 0x70C8, true)]    // 烈
    [InlineData("예", 0xF9B6, 0x79AE, true)]    // 禮
    [InlineData("윤", 0xF9D4, 0x502B, true)]    // 倫
    [InlineData("영", 0xF9A8, 0x4EE4, true)]    // 令
    [InlineData("영", 0xF9AA, 0x5BE7, true)]    // 寧 녕/영
    [InlineData("유", 0xF9CA, 0x6D41, true)]    // 流 — 사전 독음은 류 하나(하드코딩)
    [InlineData("금", 0xF90A, 0x91D1, true)]    // 金 금 — 입력기의 '금' 후보가 호환 코드
    // 통합 코드로 본음 칸
    [InlineData("린", 0x9E9F, 0x9E9F, true)]    // 麟
    [InlineData("란", 0x862D, 0x862D, true)]    // 蘭
    [InlineData("렬", 0x70C8, 0x70C8, true)]    // 烈
    [InlineData("률", 0x5F8B, 0x5F8B, true)]    // 律
    [InlineData("림", 0x6797, 0x6797, true)]    // 林
    [InlineData("김", 0x91D1, 0x91D1, true)]    // 金 김
    [InlineData("녹", 0x742D, 0x742D, true)]    // 琭 록 → 녹 (사전 독음에 '녹'이 없어도 두음 꼴로 받는다)
    [InlineData("연", 0x5747, 0x5747, true)]    // 均 — 보충 표(대법원 목록의 지정 발음 '균,연')
    [InlineData("균", 0x5747, 0x5747, true)]
    // 거절
    [InlineData("라", 0x5A1C, 0x5A1C, false)]   // 娜 — 지정 독음 '나'뿐(한쪽 방향)
    [InlineData("총", 0x9F8D, 0x9F8D, false)]   // 龍 — 뜻 줄 안의 소리
    [InlineData("령", 0xF95F, 0x5BE7, false)]   // 寧 — 녕/영
    [InlineData("서", 0x6F64, 0x6F64, false)]   // 潤
    [InlineData("운", 0x5747, 0x5747, false)]   // 均 — 뜻 줄의 '운 운'
    public void ReadsAs_BoundaryTable(string syllable, int inputCodePoint, int unifiedCodePoint, bool accepted)
    {
        var hanja = HanjaInput.Find(R(inputCodePoint));
        Assert.NotNull(hanja);
        Assert.Equal(Cp(unifiedCodePoint), hanja!.Character);
        Assert.Equal(accepted, HanjaInput.ReadsAs(hanja, syllable[0]));

        // /evaluate 입력과 글자 판정도 같은 술어다
        var (picks, problem) = HanjaInput.Resolve(syllable, "김", Cp(inputCodePoint), null);
        var judged = HanjaInput.Judge(Cp(inputCodePoint), syllable[0]);
        if (accepted)
        {
            Assert.Null(problem);
            Assert.Same(hanja, Assert.Single(picks!.Name).Hanja);
            Assert.Equal(HanjaInput.StatusOk, judged.Status);
            Assert.Null(judged.Message);
            Assert.Contains(syllable, judged.AcceptedSyllables);
            Assert.Contains(hanja, HanjaInput.CandidatesFor(syllable[0]));
        }
        else
        {
            Assert.Null(picks);
            Assert.Equal(HanjaInput.CodeReadingMismatch, problem!.Code);
            Assert.Equal(HanjaInput.TargetName, problem.Target);
            Assert.Equal(0, problem.Slot);
            Assert.Equal(HanjaInput.CodeReadingMismatch, judged.Status);
            Assert.Equal(problem.Message, judged.Message);
            Assert.DoesNotContain(syllable, judged.AcceptedSyllables);
            Assert.DoesNotContain(hanja, HanjaInput.CandidatesFor(syllable[0]));
        }
        Assert.Same(hanja, judged.Hanja);
        Assert.Equal(Cp(unifiedCodePoint), judged.Character);
    }

    [Theory]
    [InlineData(0x674E, "리,이")]       // 李
    [InlineData(0x6797, "림,임")]       // 林
    [InlineData(0x6D41, "류,유")]       // 流
    [InlineData(0x5747, "균,연")]       // 均
    [InlineData(0x5A1C, "나")]          // 娜
    [InlineData(0x7F85, "나,라")]       // 羅 — 대표 독음이 가나다순이라 '나'가 먼저
    [InlineData(0x5BE7, "녕,영")]       // 寧
    [InlineData(0x742D, "록,녹")]       // 琭
    [InlineData(0x6F64, "윤")]          // 潤
    public void AcceptedSyllables_ListsReadingsThenDueumForms(int codePoint, string expected)
    {
        var hanja = HanjaData.FindByCharacter(Cp(codePoint))!;
        Assert.Equal(expected, string.Join(",", HanjaInput.AcceptedSyllables(hanja)));
    }

    [Fact]
    public void ReadingMismatchMessage_NamesEveryAcceptedReading()
    {
        // 均 을 '서' 칸에 — 괄호 안이 '(균)'만이면 대법원 목록(균,연)과 다른 말이 된다
        var (_, problem) = HanjaInput.Resolve("서윤", "이", Cp(0x5747) + "*", null);
        Assert.Equal($"‘{Cp(0x5747)}’ 글자의 인명용 독음(균·연)이 ‘서’ 칸과 맞지 않아요. ‘서’ 음절로 읽는 한자를 넣어 주세요.", problem!.Message);

        // 성씨 칸 — '인명용 독음'이라고 쓰지 않는다(성씨는 인명용 한자 제한을 받지 않는다 — 설계서 §20-4). 이 사전에 실린 독음이라고 적고,
        // 비워 두면 어떻게 되는지로 맺는다
        (_, problem) = HanjaInput.Resolve("서윤", "이", null, Cp(0x6F64));
        Assert.Equal(HanjaInput.TargetSurname, problem!.Target);
        Assert.Equal(
            $"‘{Cp(0x6F64)}’ 글자는 이 사이트 사전에 실린 독음(윤)이 ‘이’ 칸과 맞지 않아요. ‘이’ 음절로 읽는 한자를 넣어 주세요. " +
            "비워 두면 기본으로 두는 성씨 한자로 계산해요.", problem.Message);
    }

    /// <summary>
    /// 그 음절로 읽는 한자가 사전에 하나도 없는 칸(봄·빛 — 화면이 잠그는 칸, 성씨 궉)에는 '그 음절로 읽는 한자를 넣어 주세요'라고 하지 않는다
    /// — 따를 수 없는 안내다. 이름 칸은 후보 표의 안내와 같은 말, 성씨 칸은 사전에 그 음절 한자가 없다는 사실로 맺는다.
    /// </summary>
    [Fact]
    public void ReadingMismatchMessage_SyllableWithoutAnyHanja_DoesNotAskForOne()
    {
        // 전제 — 사전 원자료로 따로 센다: 봄·빛·궉 으로 읽는 글자가 없다(지정 독음과 그 두음 꼴 어느 쪽으로도)
        foreach (char syllable in "봄빛궉")
        {
            Assert.DoesNotContain(HanjaData.GetAllHanja(), h => new[] { h.Reading }.Concat(h.AlternateReadings)
                .Any(r => r[0] == syllable || RequiredCharEngine.ApplyInitialDueum(r[0]) == syllable));
            Assert.False(HanjaInput.HasCandidates(syllable));
            Assert.Empty(HanjaInput.CandidatesFor(syllable));
        }
        foreach (char syllable in "서임녹연")   // 임·녹 은 두음 꼴로, 연 은 보충 표(均)로도 후보가 는다
            Assert.True(HanjaInput.HasCandidates(syllable));

        // 이름 칸 — 春(춘)을 '봄' 칸에
        var (_, problem) = HanjaInput.Resolve("봄", "김", Cp(0x6625), null);
        Assert.Equal(HanjaInput.CodeReadingMismatch, problem!.Code);
        Assert.Equal($"‘{Cp(0x6625)}’ 글자의 인명용 독음(춘)이 ‘봄’ 칸과 맞지 않아요. 이 음절은 인명용 한자 독음이 아니어서 한글로만 써요.", problem.Message);
        Assert.EndsWith(HanjaSelector.NoHanjaReadingNote + ".", problem.Message);   // 후보 표의 안내와 같은 말
        Assert.DoesNotContain("넣어 주세요", problem.Message);
        Assert.Equal(problem.Message, HanjaInput.Judge(Cp(0x6625), '봄').Message);

        // 성씨 칸 — 鴌 U+9D0C 은 성씨로 '궉'이라 읽지만 이 사전의 독음은 '봉'뿐이다. 글자가 틀렸다고 하지 않고 사전의 한계로 적는다
        var gwok = HanjaData.FindByCharacter(Cp(0x9D0C))!;
        Assert.Equal(new[] { "봉" }, HanjaInput.AcceptedSyllables(gwok));
        (_, problem) = HanjaInput.Resolve("서윤", "궉", null, Cp(0x9D0C));
        Assert.Equal(HanjaInput.CodeReadingMismatch, problem!.Code);
        Assert.Equal(HanjaInput.TargetSurname, problem.Target);
        Assert.Equal(
            $"‘{Cp(0x9D0C)}’ 글자는 이 사이트 사전에 실린 독음(봉)이 ‘궉’ 칸과 맞지 않아요. " +
            "이 사이트 사전에는 ‘궉’ 음절로 읽는 한자가 없어 이 칸의 성씨 한자는 정할 수 없어요.", problem.Message);
        Assert.Equal(problem.Message, HanjaInput.Judge(Cp(0x9D0C), '궉', surname: true).Message);
        // 같은 글자·같은 칸이라도 이름 칸의 판정이면 이름용 문장이다
        Assert.Contains("인명용 독음(봉)", HanjaInput.Judge(Cp(0x9D0C), '궉').Message);
    }

    /// <summary>
    /// 성씨 칸의 문장에는 인명용 한자·출생신고 이야기가 없다 — 성씨는 인명용 한자 제한을 받지 않는다(설계서 §20-4).
    /// 이름 칸의 문장(§20-3 확정 문구)은 그대로다.
    /// </summary>
    [Fact]
    public void SurnameSlotMessages_DoNotSpeakOfNameHanjaRules()
    {
        // 사전에 없는 글자 — 유 + 晩 U+6669
        var (_, problem) = HanjaInput.Resolve("서윤", "유", null, Cp(0x6669));
        Assert.Equal(HanjaInput.CodeNotInDictionary, problem!.Code);
        Assert.Equal(HanjaInput.TargetSurname, problem.Target);
        Assert.Equal(
            "이 사이트 사전에 없는 글자라서 이 글자로는 성씨 획수를 세지 못해요. " +
            "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 ‘유’ 칸의 후보 목록에서 먼저 찾아보세요. " +
            "비워 두면 기본으로 두는 성씨 한자로 계산해요.", problem.Message);
        // 글자 판정 API 는 성씨를 모른다(요청에 성씨가 없다) — 맺음만 표 안·밖 어느 쪽에도 맞는 말이다(2026-11-25)
        Assert.Equal(problem.Message.Replace(HanjaInput.SurnameLeaveEmptyTailDefault, HanjaInput.SurnameLeaveEmptyTailUnknown),
            HanjaInput.Judge(Cp(0x6669), '유', surname: true).Message);
        Assert.Equal(
            "이 사이트 사전에 없는 글자라서 이 글자로는 성씨 획수를 세지 못해요. " +
            "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 후보 목록에서 먼저 찾아보세요. " +
            "비워 두면 이 사이트가 성씨 한자를 정해 계산해요.", HanjaInput.Judge(Cp(0x6669), null, surname: true).Message);

        var surnameMessages = new[]
        {
            problem.Message,
            HanjaInput.Judge(Cp(0x6669), null, surname: true).Message!,
            HanjaInput.Resolve("서윤", "유", null, Cp(0x6F64)).Problem!.Message,          // 독음 불일치
            HanjaInput.Resolve("서윤", "궉", null, Cp(0x9D0C)).Problem!.Message,          // 독음 불일치 — 그 음절 한자가 사전에 없음
            HanjaInput.Resolve("서윤", "남궁", null, "*" + Cp(0x5357)).Problem!.Message,  // 복성의 둘째 칸
        };
        foreach (var message in surnameMessages)
        {
            Assert.True(IsKoreanOnlyMessage(message), message);
            Assert.EndsWith(".", message);
            foreach (var banned in new[] { "인명용", "출생신고", "대길", "대흉", "길하", "흉하", "검수", "감수", "쓸 수 없는 글자", "목록에 없는 글자" })
                Assert.DoesNotContain(banned, message);
        }
        Assert.Equal(surnameMessages.Length, surnameMessages.Distinct().Count());

        // 판정(코드·글자·권하는 글자)은 이름 칸과 같다 — 문장만 다르다
        var asName = HanjaInput.Judge(Cp(0x6669), '만');
        var asSurname = HanjaInput.Judge(Cp(0x6669), '만', surname: true);
        Assert.Equal(asName.Status, asSurname.Status);
        Assert.Equal(asName.Character, asSurname.Character);
        Assert.Same(asName.Suggestion, asSurname.Suggestion);
        Assert.NotEqual(asName.Message, asSurname.Message);
        // 맞는 글자면 문장이 없다 — 劉 U+5289 를 '유' 칸에
        var ok = HanjaInput.Judge(Cp(0x5289), '유', surname: true);
        Assert.Equal(HanjaInput.StatusOk, ok.Status);
        Assert.Null(ok.Message);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑤ 사전 전수 — 독음 판정 ↔ 후보 목록 ↔ 입력 검증
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 프런트 사전(frontend/src/data/hanja-seo.json — /hanja 가 보이는 독음)의 (글자, 독음) 쌍 전부가 받아진다.
    /// 보충 표(均·林·流)가 낡으면 — 하드코딩 글자에 사전 파일과 독음이 다른 넷째 글자가 생기면 — 여기서 실패한다.
    /// </summary>
    [Fact]
    public void ReadsAs_AcceptsEveryPairOfTheFrontendDictionary()
    {
        var path = Path.Combine(RepoRoot(), "frontend", "src", "data", "hanja-seo.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        int pairs = 0;
        var problems = new List<string>();
        foreach (var entry in doc.RootElement.EnumerateObject())
        {
            var hanja = HanjaData.FindByCharacter(entry.Name);
            if (hanja == null) { problems.Add($"U+{char.ConvertToUtf32(entry.Name, 0):X4} 백엔드 사전에 없음"); continue; }
            foreach (var r in entry.Value.GetProperty("r").EnumerateArray())
            {
                pairs++;
                var reading = r.GetString()!;
                if (reading.Length != 1 || !HanjaInput.ReadsAs(hanja, reading[0]))
                    problems.Add($"U+{char.ConvertToUtf32(entry.Name, 0):X4} 독음 '{reading}' 거절 (받는 음절 {string.Join("·", HanjaInput.AcceptedSyllables(hanja))})");
            }
        }
        Assert.True(problems.Count == 0, $"{problems.Count}쌍:\n" + string.Join("\n", problems.Take(20)));
        Assert.True(pairs >= 9900, $"프런트 사전 쌍 {pairs}개 — 파일을 거의 못 읽었다");
    }

    [Fact]
    public void ReadsAs_AcceptsEveryBackendReadingAndItsDueumForm_AndCandidatesCoverFindByReading()
    {
        var problems = new List<string>();
        foreach (var h in HanjaData.GetAllHanja())
            foreach (var r in new[] { h.Reading }.Concat(h.AlternateReadings))
            {
                if (!HanjaInput.ReadsAs(h, r[0])) problems.Add($"{h.Character} 독음 {r}");
                char dueum = RequiredCharEngine.ApplyInitialDueum(r[0]);
                if (!HanjaInput.ReadsAs(h, dueum)) problems.Add($"{h.Character} 두음 꼴 {dueum}");
            }
        Assert.True(problems.Count == 0, string.Join("\n", problems.Take(20)));

        // 후보 목록 ⊇ 지금의 독음 조회 — 두음 합집합으로 늘기만 한다
        int wider = 0;
        foreach (char syllable in AllSyllables())
        {
            var candidates = HanjaInput.CandidatesFor(syllable);
            var byReading = HanjaData.FindByReading(syllable.ToString());
            var missing = byReading.Where(h => !candidates.Contains(h)).ToList();
            Assert.True(missing.Count == 0, $"'{syllable}' 후보 목록에 없는 FindByReading 글자: {string.Join("", missing.Select(h => h.Character))}");
            Assert.Equal(candidates.Count, candidates.Select(h => h.Character).Distinct().Count());
            if (candidates.Count > byReading.Count) wider++;
        }
        Assert.True(wider >= 10, $"두음 꼴로 후보가 느는 음절 {wider}개 — 임·유·녹 같은 음절이 있어야 한다");
        Assert.Contains(HanjaInput.CandidatesFor('연'), h => h.Character == Cp(0x5747));   // 보충 표의 均
    }

    /// <summary>후보 목록의 모든 글자는 그 음절 칸의 입력 검증을 통과한다(목록에 있는데 넣으면 거절되는 글자가 없다) — 순서는 쓸 수 있는 글자 → 불용 → 뜻 없음.</summary>
    [Fact]
    public void CandidatesFor_EveryCharacterPassesResolve_AndOrderIsUsableThenForbiddenThenNoMeaning()
    {
        int total = 0, syllables = 0;
        var problems = new List<string>();
        foreach (char syllable in AllSyllables())
        {
            var candidates = HanjaInput.CandidatesFor(syllable);
            if (candidates.Count == 0) continue;
            syllables++;

            foreach (var h in candidates)
            {
                total++;
                var (picks, problem) = HanjaInput.Resolve(syllable.ToString(), "김", h.Character, null);
                if (problem != null || !ReferenceEquals(h, picks!.Name[0].Hanja))
                    problems.Add($"'{syllable}' {h.Character}: {problem?.Code ?? "다른 항목"}");
            }

            // 세 묶음 — 묶음 번호가 줄어드는 자리가 없다. 뜻 풀이가 있는가는 '뜻에 한글이 있는가'로 따로 센다
            // (사전에 영문 뜻만 있는 글자는 뜻 풀이 없는 글자 묶음이다 — 아래 CandidatesFor_MeaningWithoutHangul_IsListedAsNoMeaning)
            static int GroupOf(HanjaInfo h) => HanjaData.IsForbiddenNameHanja(h.Character) ? 1 : Regex.IsMatch(h.Meaning ?? "", "[가-힣]") ? 0 : 2;
            var groups = candidates.Select(GroupOf).ToList();
            Assert.True(groups.SequenceEqual(groups.OrderBy(g => g)), $"'{syllable}' 묶음 순서");

            // 쓸 수 있는 글자: 빈출·비약자 먼저 → 기본 영역 먼저 → 관련도(약자 −3000) 내림차순 → 글자 순 — 표시 정렬 규칙을 여기서 따로 센다
            var usable = candidates.Where(h => GroupOf(h) == 0).ToList();
            var expectedUsable = usable
                .OrderByDescending(h => HanjaData.IsCommonNameHanja(h.Character) && !HanjaData.IsWeakGivenNameHanja(h.Character))
                .ThenByDescending(h => HanjaData.IsInCjkBasicRange(h.Character))
                .ThenByDescending(h => HanjaData.CalculateRelevanceScore(h) - (HanjaData.IsWeakGivenNameHanja(h.Character) ? 3000 : 0))
                .ThenBy(h => h.Character, StringComparer.Ordinal)
                .ToList();
            Assert.True(usable.SequenceEqual(expectedUsable), $"'{syllable}' 쓸 수 있는 글자 순서");
            Assert.True(usable.SequenceEqual(HanjaSelector.OrderForDisplay(candidates).Where(h => GroupOf(h) == 0)), $"'{syllable}' OrderForDisplay 와 다름");

            // 불용·뜻 없는 글자는 코드포인트 순
            foreach (int g in new[] { 1, 2 })
            {
                var cps = candidates.Where(h => GroupOf(h) == g).Select(h => char.ConvertToUtf32(h.Character, 0)).ToList();
                Assert.True(cps.SequenceEqual(cps.OrderBy(x => x)), $"'{syllable}' 묶음 {g} 코드포인트 순서");
            }
        }

        Assert.True(problems.Count == 0, $"{problems.Count}건:\n" + string.Join("\n", problems.Take(20)));
        Assert.True(syllables >= 480, $"후보가 있는 음절 {syllables}개");
        Assert.True(total >= 9977, $"(음절, 글자) 쌍 {total}개 — 프런트 사전 쌍보다 적을 수 없다");
    }

    /// <summary>
    /// 사전 뜻에 한글이 없는 글자(사전 로더가 Unihan 영문 뜻을 채워 둔 글자 — 지금 U+39B3 한 자)는 후보 목록에서 '뜻 풀이 없는 글자' 묶음에 선다.
    /// 영문 뜻이 한글 훈 사이에 '쓸 수 있는 글자'로 보이지 않게 — /hanja 사전(hanja-seo.json 의 m 없음)과 같은 판정이다.
    /// 엔진의 쓸 수 있는 글자 정의(HanjaSelector.IsUsableNameHanja)는 그대로다(자동 배정·점수는 바뀌지 않는다).
    /// </summary>
    [Fact]
    public void CandidatesFor_MeaningWithoutHangul_IsListedAsNoMeaning()
    {
        var foreignOnly = HanjaData.GetAllHanja()
            .Where(h => !string.IsNullOrEmpty(h.Meaning) && !Regex.IsMatch(h.Meaning, "[가-힣]"))
            .ToList();

        foreach (var h in foreignOnly)
        {
            Assert.False(HanjaInput.HasKoreanGloss(h));
            Assert.False(HanjaInput.IsListedAsUsable(h));
            foreach (var syllable in HanjaInput.AcceptedSyllables(h))
            {
                var candidates = HanjaInput.CandidatesFor(syllable[0]);
                int at = candidates.IndexOf(h);
                Assert.True(at >= 0, $"U+{char.ConvertToUtf32(h.Character, 0):X4} 가 '{syllable}' 후보에 없다");
                // 이 글자 뒤에는 한글 훈이 있는 비불용 글자가 오지 않는다(맨 뒤 묶음)
                Assert.DoesNotContain(candidates.Skip(at), c => !HanjaData.IsForbiddenNameHanja(c.Character) && Regex.IsMatch(c.Meaning ?? "", "[가-힣]"));
                // 그래도 넣으면 받는다 — 목록에 있는 글자는 입력 검증을 통과한다
                Assert.Null(HanjaInput.Resolve(syllable, "김", h.Character, null).Problem);
            }
        }

        // 사전의 모든 글자 — 한글 훈이 있는가 = 뜻에 한글 음절이 있는가, 첫 묶음에 서는가 = 불용이 아니고 한글 훈이 있는가
        foreach (var h in HanjaData.GetAllHanja())
        {
            bool hangul = Regex.IsMatch(h.Meaning ?? "", "[가-힣]");
            Assert.Equal(hangul, HanjaInput.HasKoreanGloss(h));
            Assert.Equal(hangul && !HanjaData.IsForbiddenNameHanja(h.Character), HanjaInput.IsListedAsUsable(h));
        }

        // 지금 자료에서 이 경우인 글자: U+39B3(재) — 자료에서 뜻을 고치면 이 줄만 바꾼다(위 단언은 글자가 0자여도 맞다)
        Assert.Equal(new[] { 0x39B3 }, foreignOnly.Select(h => char.ConvertToUtf32(h.Character, 0)).OrderBy(x => x));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑥ 사전에 없는 글자 · 오류 문구
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData(0x6669, 0x665A, "만")]     // 晩 → 晚
    [InlineData(0x7A3D, 0x25874, "계")]
    [InlineData(0x6E17, 0x6EF2, "삼")]
    public void NotInDictionary_HandListSuggestsTheListedGlyph(int typed, int suggested, string syllable)
    {
        Assert.False(HanjaData.HanjaDictionary.ContainsKey(Cp(typed)), "손 목록의 왼쪽 글자가 사전에 생겼다 — 목록에서 뺄 것");

        var judged = HanjaInput.Judge(Cp(typed), syllable[0]);
        Assert.Equal(HanjaInput.CodeNotInDictionary, judged.Status);
        Assert.Equal(Cp(typed), judged.Character);
        Assert.Null(judged.Hanja);
        Assert.Empty(judged.AcceptedSyllables);
        Assert.Equal(HanjaInput.NotInDictionaryMessage(syllable[0]), judged.Message);

        // 권하는 글자는 사전에 있고, 쓸 수 있는 글자이며, 그 음절 칸에 들어간다
        Assert.NotNull(judged.Suggestion);
        Assert.Equal(Cp(suggested), judged.Suggestion!.Character);
        Assert.True(HanjaSelector.IsUsableNameHanja(judged.Suggestion));
        Assert.True(HanjaInput.ReadsAs(judged.Suggestion, syllable[0]));

        // /evaluate 입력에서는 받지 않는다(문장은 같다)
        var (picks, problem) = HanjaInput.Resolve(syllable, "김", Cp(typed), null);
        Assert.Null(picks);
        Assert.Equal(HanjaInput.CodeNotInDictionary, problem!.Code);
        Assert.Equal(judged.Message, problem.Message);
    }

    [Theory]
    [InlineData(0x5F11)]    // 弑 — 등재 꼴 弒 의 훈이 '윗사람 죽일 시'라 권하지 않는다
    [InlineData(0x93AE)]    // 일본 꼴 鎮 (등재 꼴 鎭)
    [InlineData(0x9EC4)]    // 黄 (등재 꼴 黃)
    [InlineData(0x4E1C)]    // 중국 간체 东
    [InlineData(0x4E90)]    // 亐
    public void NotInDictionary_OtherGlyphs_HaveNoSuggestion(int typed)
    {
        Assert.False(HanjaData.HanjaDictionary.ContainsKey(Cp(typed)), "이 글자가 사전에 생겼다 — 사례를 바꿀 것");
        var judged = HanjaInput.Judge(Cp(typed), null);
        Assert.Equal(HanjaInput.CodeNotInDictionary, judged.Status);
        Assert.Null(judged.Suggestion);
        Assert.Equal(HanjaInput.NotInDictionaryMessage(null), judged.Message);
        Assert.Null(HanjaInput.SuggestionFor(R(typed)));
    }

    /// <summary>화면에 그대로 뜨는 한국어 문장인가 — ToolAccuracyRegressionTests.IsKoreanOnlyMessage 와 같은 규칙(한글이 있고 영문 소문자가 남지 않는다).</summary>
    private static bool IsKoreanOnlyMessage(string message)
    {
        var rest = Regex.Replace(message, @"'[^']*'", "");
        rest = Regex.Replace(rest, @"\{[^{}]*\}", "");
        return Regex.IsMatch(message, "[가-힣]") && !Regex.IsMatch(rest, "[a-z]");
    }

    [Fact]
    public void ProblemMessages_AllSeven_AreKoreanSentences_WithoutVerdictsOnTheCharacter()
    {
        // 일곱 가지를 실제 입력으로 낸다 — 이 문장들은 컨트롤러 리터럴이 아니라 ErrorMessages_InSource_AreKoreanOnly 가 보지 못한다
        var cases = new (string Code, HanjaInputProblem? Problem)[]
        {
            (HanjaInput.CodeNameNotHangul, HanjaInput.Resolve("서ㅇ", "이", "**", null).Problem),
            (HanjaInput.CodeNameHanjaCount, HanjaInput.Resolve("서윤", "이", "*", null).Problem),
            (HanjaInput.CodeSurnameHanjaCount, HanjaInput.Resolve("서윤", "남궁", null, "*").Problem),
            (HanjaInput.CodeSurnameNone, HanjaInput.Resolve("서윤", "이", null, "-").Problem),
            (HanjaInput.CodeNotHanja, HanjaInput.Resolve("서윤", "이", "가*", null).Problem),
            (HanjaInput.CodeNotInDictionary, HanjaInput.Resolve("만", "이", Cp(0x6669), null).Problem),
            (HanjaInput.CodeReadingMismatch, HanjaInput.Resolve("서윤", "이", Cp(0x6F64) + "*", null).Problem),
        };

        foreach (var (code, problem) in cases)
        {
            Assert.NotNull(problem);
            Assert.Equal(code, problem!.Code);
            Assert.True(IsKoreanOnlyMessage(problem.Message), $"{code}: {problem.Message}");
            Assert.EndsWith(".", problem.Message);
            Assert.Contains(problem.Target, new[] { HanjaInput.TargetName, HanjaInput.TargetSurname });
            // 길흉 단정, 사람이 살폈다는 말, 사전에 없는 글자에 대한 틀린 단정을 쓰지 않는다
            foreach (var banned in new[] { "대길", "대흉", "길하", "흉하", "검수", "감수", "쓸 수 없는 글자", "목록에 없는 글자", "글자를 넣어 조회" })
                Assert.DoesNotContain(banned, problem.Message);
        }
        Assert.Equal(7, cases.Select(c => c.Problem!.Message).Distinct().Count());

        Assert.True(IsKoreanOnlyMessage(HanjaInput.JudgeNotHanjaMessage));
        Assert.True(IsKoreanOnlyMessage(HanjaInput.NotInDictionaryMessage(null)));

        // 사전에 없는 글자 — 2026-11-19 사실 확인으로 정한 문장(설계서 §20-3): 사전에 없다고 인명용 한자가 아니라는 뜻은 아니다
        var notInDictionary = cases.Single(c => c.Code == HanjaInput.CodeNotInDictionary).Problem!.Message;
        Assert.Equal(
            "이 사이트 사전에 없는 글자라서 이 글자로는 계산하지 못해요. 사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다. " +
            "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 ‘만’ 칸의 후보 목록에서 먼저 찾아보세요. " +
            "출생신고에 쓸 수 있는 글자인지는 대법원 전자가족관계등록시스템의 ‘인명용 한자 조회’에서 한글 음 한 글자를 넣어 확인할 수 있습니다.",
            notInDictionary);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑦ HanjaPicks · 지정 없음 정규화 · 성씨 기본 한자 · 자동 배정이 비는 음절
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void ApplyTo_PickedNoneAuto()
    {
        var seo = HanjaData.FindByCharacter(Cp(0x745E))!;   // 瑞
        var autoA = HanjaData.FindByCharacter(Cp(0x897F))!; // 西
        var autoB = HanjaData.FindByCharacter(Cp(0x6F64))!; // 潤
        var autoC = HanjaData.FindByCharacter(Cp(0x9E9F))!; // 麟

        var picks = new HanjaPicks(new[] { HanjaPick.Of(seo), HanjaPick.None, HanjaPick.Auto }, null);
        Assert.True(picks.AnyNone);
        Assert.True(picks.AnyPicked);
        Assert.Equal(Cp(0x745E) + "-*", picks.NameText);
        Assert.Equal(string.Empty, picks.SurnameText);

        // 고름 → 그 글자, 한자 없음 → null, 자동 → 자동 배정의 그 자리
        var applied = picks.ApplyTo(new HanjaInfo?[] { autoA, autoB, autoC });
        Assert.Equal(3, applied.Count);
        Assert.Same(seo, applied[0]);
        Assert.Null(applied[1]);
        Assert.Same(autoC, applied[2]);

        // 자동 배정이 null 인 자리는 null 그대로, 길이가 어긋나면(짧으면) 자동 칸은 null — 길이는 늘 이름 칸 수
        Assert.Null(picks.ApplyTo(new HanjaInfo?[] { autoA, autoB, null })[2]);
        var shortAuto = picks.ApplyTo(new HanjaInfo?[] { autoA });
        Assert.Equal(3, shortAuto.Count);
        Assert.Same(seo, shortAuto[0]);
        Assert.Null(shortAuto[2]);
        Assert.Equal(3, picks.ApplyTo(new HanjaInfo?[] { autoA, autoB, autoC, autoA }).Count);

        // 자동 배정 목록은 건드리지 않는다
        var auto = new List<HanjaInfo?> { autoA, autoB, autoC };
        picks.ApplyTo(auto);
        Assert.Equal(new HanjaInfo?[] { autoA, autoB, autoC }, auto);

        var allAuto = new HanjaPicks(new[] { HanjaPick.Auto, HanjaPick.Auto }, new HanjaInfo?[] { seo, null });
        Assert.False(allAuto.AnyNone);
        Assert.False(allAuto.AnyPicked);
        Assert.Equal(string.Empty, allAuto.NameText);
        Assert.Equal(Cp(0x745E) + "*", allAuto.SurnameText);
    }

    public static IEnumerable<object?[]> UnspecifiedInputs() => new[]
    {
        new object?[] { "서윤", "이", null, null },
        new object?[] { "서윤", "이", "", "" },
        new object?[] { "서윤", "이", "**", null },
        new object?[] { "서윤", "이", "**", "*" },
        new object?[] { "서윤", "이", null, char.ConvertFromUtf32(0x674E) },                 // 대표 한자 李
        new object?[] { "서윤", "이", "**", char.ConvertFromUtf32(0xF9E1) },                 // 호환 코드로 넣은 李
        new object?[] { "서윤", "리", null, char.ConvertFromUtf32(0x674E) },                 // 두음 표기 성씨 — 표의 글자
        new object?[] { "민", "남궁", "*", char.ConvertFromUtf32(0x5357) + char.ConvertFromUtf32(0x5BAE) },   // 南宮
        new object?[] { "민", "남궁", null, char.ConvertFromUtf32(0x5357) + "*" },           // 복성 한 글자만 — 채운 결과가 표와 같다
        new object?[] { "민", "남궁", null, "*" + char.ConvertFromUtf32(0x5BAE) },
        new object?[] { "한빛", "김", "*-", null },                                          // 자동 배정이 비는 음절의 '한자 없음'은 자동
        new object?[] { "빛봄", "김", "--", null },
        new object?[] { "몰닉", "김", "-*", char.ConvertFromUtf32(0x91D1) },
    };

    [Theory]
    [MemberData(nameof(UnspecifiedInputs))]
    public void Resolve_UnspecifiedForms_FoldToNull(string name, string lastName, string? nameHanja, string? lastNameHanja)
    {
        var (picks, problem) = HanjaInput.Resolve(name, lastName, nameHanja, lastNameHanja);
        Assert.Null(problem);
        Assert.Null(picks);
    }

    [Fact]
    public void Resolve_SurnameFoldsOnlyForTableSurnames()
    {
        // 대표 한자 표에 있는 성씨에서 표의 글자 → 성씨는 지정 없음(이름 지정은 그대로)
        var (picks, problem) = HanjaInput.Resolve("서윤", "이", Cp(0x745E) + "*", Cp(0x674E));
        Assert.Null(problem);
        Assert.Null(picks!.Surname);
        Assert.Equal(string.Empty, picks.SurnameText);
        Assert.Equal(Cp(0x745E) + "*", picks.NameText);

        // 표의 글자와 다른 한자를 고르면 지정이다 — 유 + 劉(표는 柳)
        (picks, problem) = HanjaInput.Resolve("서윤", "유", null, Cp(0x5289));
        Assert.Null(problem);
        Assert.Equal(Cp(0x5289), Assert.Single(picks!.Surname!)!.Character);
        Assert.All(picks.Name, p => Assert.Equal(HanjaPickKind.Auto, p.Kind));
        Assert.Equal(string.Empty, picks.NameText);

        // 표 밖 성씨에서는 고른 글자가 추정 글자와 같아도 접지 않는다
        foreach (var surname in new[] { "탕", "창", "탕창" })
        {
            Assert.False(SurnameData.RepresentativeHanja.ContainsKey(surname));
            var estimated = SurnameData.ResolveStrokes(surname);
            Assert.False(estimated.FromTable);
            Assert.Equal(surname.Length, estimated.Hanja.EnumerateRunes().Count());

            (picks, problem) = HanjaInput.Resolve("서윤", surname, null, estimated.Hanja);
            Assert.Null(problem);
            Assert.NotNull(picks);
            Assert.Equal(estimated.Hanja, picks!.SurnameText);
        }

        // 복성에서 한 글자만 고르면 '*' 자리는 그 자리의 기본 한자 — 표에 있는 성씨는 표의 글자, 표 밖은 그 음절의 추정 글자
        (picks, problem) = HanjaInput.Resolve("민", "남궁", null, Cp(0x7537) + "*");   // 男 + *
        Assert.Null(problem);
        Assert.Equal(Cp(0x7537) + Cp(0x5BAE), picks!.SurnameText);

        var changEstimate = SurnameData.ResolveStrokes("창").Hanja;
        (picks, problem) = HanjaInput.Resolve("민", "탕창", null, Cp(0x6E6F) + "*");   // 湯 + *
        Assert.Null(problem);
        Assert.Equal(Cp(0x6E6F) + changEstimate, picks!.SurnameText);

        // 채울 글자가 없는 자리(한자 독음이 아닌 음절)는 null — 정규 꼴에서는 '*'
        (picks, problem) = HanjaInput.Resolve("민", "탕쁨", null, Cp(0x6E6F) + "*");
        Assert.Null(problem);
        Assert.Null(picks!.Surname![1]);
        Assert.Equal(Cp(0x6E6F) + "*", picks.SurnameText);
    }

    /// <summary>정규 꼴은 한 번에 수렴한다 — 받아들인 꼴(NameText·SurnameText)을 그대로 다시 넣으면 같은 지정이 나온다.</summary>
    [Fact]
    public void Resolve_CanonicalText_RoundTripsInOneStep()
    {
        var cases = new (string Name, string LastName, string? NameHanja, string? LastNameHanja)[]
        {
            ("이서", "김", Cp(0xF9E1) + "*", null),                            // 호환 코드 → 통합 한자
            ("서윤", "이", Cp(0x745E) + "\uFE00 " + Cp(0x6F64), Cp(0xF9E1)),   // 이체 선택자·공백, 대표 성씨(접힘)
            ("서윤", "남궁", Cp(0x745E) + "*", Cp(0x5357) + "*"),              // 복성 한 글자만(표와 같아 접힘)
            ("서윤", "남궁", "*" + Cp(0x6F64), Cp(0x7537) + "*"),              // 복성 한 글자만(표와 다름 — 채운 글자가 실린다)
            ("서윤", "탕", Cp(0x745E) + "-", SurnameData.ResolveStrokes("탕").Hanja),   // 표 밖 성씨, '한자 없음'
            ("한빛", "유", Cp(0x97D3) + "-", Cp(0x5289)),                      // 잠긴 칸의 '-' → '*'
            ("서아린", "탕쁨", "-*" + Cp(0x9E9F), Cp(0x6E6F) + "*"),           // 채울 글자 없는 성씨 자리
            ("금", "이", Cp(0x2FA6), null),                                    // 강희 부수
        };

        foreach (var (name, lastName, nameHanja, lastNameHanja) in cases)
        {
            var (first, problem) = HanjaInput.Resolve(name, lastName, nameHanja, lastNameHanja);
            Assert.Null(problem);
            Assert.NotNull(first);

            var (second, problem2) = HanjaInput.Resolve(name, lastName, first!.NameText, first.SurnameText);
            Assert.Null(problem2);
            Assert.NotNull(second);
            Assert.Equal(first.NameText, second!.NameText);
            Assert.Equal(first.SurnameText, second.SurnameText);
            Assert.Equal(first.Name, second.Name);                       // 칸마다 같은 종류·같은 사전 항목
            Assert.Equal(first.Surname == null, second.Surname == null);
            if (first.Surname != null) Assert.Equal(first.Surname, second.Surname);

            // 정규 꼴에는 통합 한자와 표시 글자만 — 호환 한자·이체 선택자·공백이 없다
            foreach (var rune in (first.NameText + first.SurnameText).EnumerateRunes())
                Assert.True(rune.Value == '*' || rune.Value == '-' || HanjaData.HanjaDictionary.ContainsKey(rune.ToString()),
                    $"정규 꼴에 U+{rune.Value:X4}");
        }

        // 잠긴 칸의 '-' 는 정규 꼴에서 '*' 다
        Assert.Equal(Cp(0x97D3) + "*", HanjaInput.Resolve("한빛", "유", Cp(0x97D3) + "-", null).Picks!.NameText);
    }

    [Fact]
    public void SurnameDefaultAt_TableSurnames_GiveTheTableCharacterAtEachSlot()
    {
        Assert.True(SurnameData.RepresentativeHanja.Count >= 150);
        foreach (var (surname, hanja) in SurnameData.RepresentativeHanja)
        {
            var tableChars = hanja.EnumerateRunes().Select(r => r.ToString()).ToList();
            Assert.Equal(surname.Length, tableChars.Count);
            for (int i = 0; i < surname.Length; i++)
            {
                var slot = HanjaInput.SurnameDefaultAt(surname, i);
                Assert.True(slot != null, $"{surname}[{i}] 기본 한자 없음");
                Assert.Equal(tableChars[i], slot!.Character);
                // 표의 글자는 그 음절 칸의 입력 검증을 통과한다 — 기본 한자가 검증에서 떨어지는 성씨가 없다
                Assert.True(HanjaInput.ReadsAs(slot, surname[i]), $"{surname}[{i}] {slot.Character} 독음 불일치");
            }
            Assert.Null(HanjaInput.SurnameDefaultAt(surname, surname.Length));
            Assert.Null(HanjaInput.SurnameDefaultAt(surname, -1));

            // 표의 글자를 그대로 넣으면 지정 없음
            var (picks, problem) = HanjaInput.Resolve("민", surname, null, hanja);
            Assert.Null(problem);
            Assert.Null(picks);
        }
    }

    [Theory]
    [InlineData("탕")]
    [InlineData("창")]
    [InlineData("종")]
    [InlineData("탕창")]
    [InlineData("소봉")]      // 음절은 표에 있어도 두 글자 성씨로는 표 밖 — 음절마다 추정
    [InlineData("쁨")]        // 한자 독음이 아닌 음절 — 추정 실패
    [InlineData("탕쁨")]      // 둘째 음절에서 끊긴다
    [InlineData("쁨탕")]      // 첫 음절에서 끊긴다(ResolveStrokes 의 문자열은 비지만 둘째 자리 추정 글자는 있다)
    public void SurnameDefaultAt_OutsideTheTable_MatchesResolveStrokesEstimate(string surname)
    {
        Assert.False(SurnameData.RepresentativeHanja.ContainsKey(surname));
        var slots = Enumerable.Range(0, surname.Length).Select(i => HanjaInput.SurnameDefaultAt(surname, i)).ToList();

        // 자리마다: 그 음절에 획수 있는 글자가 있으면 그중 관련도 1순위, 없으면 null — 여기서 따로 센다
        for (int i = 0; i < surname.Length; i++)
        {
            var expected = HanjaData.FindByReading(surname[i].ToString()).Where(h => h.StrokeCount > 0)
                .OrderByDescending(HanjaData.CalculateRelevanceScore).FirstOrDefault();
            Assert.Equal(expected == null, slots[i] == null);
            if (expected != null)
                Assert.Equal(HanjaData.CalculateRelevanceScore(expected), HanjaData.CalculateRelevanceScore(slots[i]!));
        }

        // 수리가 쓰는 추정과 같은 글자 — 추정이 끊기지 않았을 때(문자열 길이 = 성씨 길이) 자리마다 이은 문자열이 같다
        var resolved = SurnameData.ResolveStrokes(surname);
        if (resolved.Hanja.EnumerateRunes().Count() == surname.Length)
        {
            Assert.Equal(resolved.Hanja, string.Concat(slots.Select(h => h!.Character)));
            Assert.Equal(resolved.Strokes, slots.Sum(h => h!.StrokeCount));
        }
        else
        {
            Assert.Contains(slots, h => h == null);
            Assert.Equal(0, resolved.Strokes);
        }
    }

    /// <summary>
    /// 자동 배정이 비는 음절 — 쓸 수 있는 글자(불용 아님 + 뜻 있음)가 하나도 없는 음절이다. 사전 독음 전부와 사전에 없는 음절에서 따로 세어 대조하고,
    /// 이 판정이 성별·용신과 무관함도 본다(요청의 성별·출생일이 무엇이든 그 칸의 자동 배정이 비는지는 같다 — '-' 를 접는 기준이 흔들리지 않는다).
    /// </summary>
    [Fact]
    public void AutoIsEmpty_IsExactlyTheSyllablesWithoutUsableHanja_RegardlessOfGenderAndYongshin()
    {
        var empty = new List<char>();
        foreach (char syllable in AllSyllables().Concat(new[] { '봄', '빛', '쁨', '꽃', '늘' }).Distinct())
        {
            bool expected = !HanjaData.FindByReading(syllable.ToString())
                .Any(h => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning));
            Assert.True(expected == HanjaInput.AutoIsEmpty(syllable), $"'{syllable}' AutoIsEmpty ≠ 쓸 수 있는 글자 없음({expected})");
            if (expected) empty.Add(syllable);

            foreach (var gender in new[] { "male", "female", "none" })
                foreach (var yongshin in new string?[] { null, "木", "水" })
                    Assert.True(expected == (HanjaSelector.Select(syllable.ToString(), gender, yongshin, "金", "土")[0] == null),
                        $"'{syllable}' {gender} {yongshin}: 자동 배정이 비는지가 성별·용신에 따라 갈린다");
        }

        // 대표 사례 — 순우리말 음절, 글자가 모두 불용인 음절
        foreach (char c in "봄빛쁨꽃몰괵") Assert.Contains(c, empty);
        foreach (char c in "서윤한") Assert.DoesNotContain(c, empty);
    }
}
