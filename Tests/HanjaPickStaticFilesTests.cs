using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Tests;

/// <summary>
/// /evaluate 한자 고르기의 음절별 정적 후보 파일(frontend/public/data/hanja-pick/v1 — 설계서 docs/plan-hanja-input-2026-11.md §4-6, §13-1 ⑮)이
/// 지금 백엔드와 같은 말을 하는지 본다. 한자 데이터(불용·약자·자원오행·획수·뜻·성씨 대표 한자 표)를 바꾸고 덤프를 안 돌리면 여기서 실패한다 —
/// 고치는 법: 저장소 루트에서 <c>dotnet run -- dump-hanja-pick</c> 을 돌리고 바뀐 파일을 커밋한다.
///
/// 대조는 바이트가 아니라 파싱한 값으로 한다. 기대값은 덤프 함수(<see cref="HanjaPickDump.Build"/>)와의 대조 하나에 기대지 않고,
/// 입력 검증이 쓰는 함수(<see cref="HanjaInput"/>)·응답이 쓰는 함수(<see cref="HanjaFactMapper"/>)·사전 원자료로 따로 센다.
/// ⚠️ 호환 한자·BMP 밖 글자는 글자로 적지 않는다 — 코드포인트 숫자(<see cref="Cp"/>)만 쓴다. 주석의 한자는 모두 통합 한자다.
/// ⚠️ 사전 전체를 운영 산출물과 대조하므로, 공유 사전의 항목을 잠깐 고치는 테스트(<see cref="HanjaDictionaryMutationCollection"/>)와 같은 묶음에 둔다
/// — 따로 두면 그 테스트가 水 의 뜻을 바꿔 둔 사이에 이 대조가 돌 수 있다.
/// </summary>
[Collection(HanjaDictionaryMutationCollection.Name)]
public class HanjaPickStaticFilesTests
{
    private const string Redump = "저장소 루트에서 dotnet run -- dump-hanja-pick 을 돌리고 바뀐 파일을 커밋하세요";

    private static readonly JsonSerializerOptions ApiJsonOptions = new(JsonSerializerDefaults.Web);

    public HanjaPickStaticFilesTests()
    {
        HanjaData.LoadExternalData();
    }

    // ── 도우미 ───────────────────────────────────────────────────────────────────

    private static string Cp(int codePoint) => char.ConvertFromUtf32(codePoint);

    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(thisFile), AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var dir = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        }
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }

    private static string StaticDirectory => Path.Combine(RepoRoot(), "frontend", "public", "data", "hanja-pick", "v1");

    private sealed record DiskFile(string Name, byte[] Bytes, string Text, JsonNode Json);

    /// <summary>디스크의 파일 전부(이름순). UTF-8 로 읽지 못하는 바이트가 있으면 여기서 던진다.</summary>
    private static List<DiskFile> ReadDisk()
    {
        var dir = StaticDirectory;
        Assert.True(Directory.Exists(dir), $"정적 후보 폴더가 없다: {dir} — {Redump}");
        var strictUtf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
        var files = new List<DiskFile>();
        foreach (var path in Directory.GetFiles(dir).OrderBy(p => p, StringComparer.Ordinal))
        {
            var bytes = File.ReadAllBytes(path);
            var text = strictUtf8.GetString(bytes);
            files.Add(new DiskFile(Path.GetFileName(path), bytes, text, JsonNode.Parse(text)!));
        }
        return files;
    }

    /// <summary>음절 파일만 — 음절(파일 이름의 16진 코드 값) → 파일.</summary>
    private static SortedDictionary<char, DiskFile> SyllableFiles(List<DiskFile> disk)
    {
        var map = new SortedDictionary<char, DiskFile>();
        foreach (var file in disk.Where(f => f.Name != HanjaPickDump.IndexFileName))
        {
            Assert.Matches(HanjaPickDump.SyllableFileNamePattern, file.Name);
            map.Add((char)Convert.ToInt32(file.Name[..4], 16), file);
        }
        return map;
    }

    private static JsonObject Index(List<DiskFile> disk)
        => disk.Single(f => f.Name == HanjaPickDump.IndexFileName).Json.AsObject();

    private static List<JsonObject> Facts(DiskFile file)
        => file.Json["hanja"]!.AsArray().Select(n => n!.AsObject()).ToList();

    private static string Character(JsonObject fact) => fact["character"]!.GetValue<string>();

    /// <summary>파일의 참·거짓 표시 — 없는 필드는 거짓으로 읽는다(프런트와 같은 규칙).</summary>
    private static bool Flag(JsonObject fact, string name) => fact[name]?.GetValue<bool>() ?? false;

    /// <summary>JSON 안의 문자열 전부(속성 이름 + 문자열 값) — 이스케이프를 푼 값.</summary>
    private static IEnumerable<string> Strings(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var pair in obj)
                {
                    yield return pair.Key;
                    foreach (var s in Strings(pair.Value)) yield return s;
                }
                break;
            case JsonArray array:
                foreach (var item in array)
                    foreach (var s in Strings(item)) yield return s;
                break;
            case JsonValue value when value.GetValueKind() == JsonValueKind.String:
                yield return value.GetValue<string>();
                break;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑮ 디스크의 파일 = 지금 덤프 출력 (파싱한 값)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Files_OnDisk_AreExactlyTheDumpOutput_ByParsedValue()
    {
        var built = HanjaPickDump.Build();
        var disk = ReadDisk();

        // 빠진 파일·낡은 파일이 없다(독음이 사라진 음절의 파일이 남으면 화면이 낡은 목록을 받는다)
        var builtNames = built.Select(f => f.FileName).OrderBy(n => n, StringComparer.Ordinal).ToList();
        var diskNames = disk.Select(f => f.Name).ToList();
        var missing = builtNames.Except(diskNames).ToList();
        var stale = diskNames.Except(builtNames).ToList();
        Assert.True(missing.Count == 0 && stale.Count == 0,
            $"빠진 파일 {missing.Count}개({string.Join(", ", missing.Take(10))}) · 덤프에 없는 파일 {stale.Count}개({string.Join(", ", stale.Take(10))}) — {Redump}");

        var byName = built.ToDictionary(f => f.FileName, f => f.Json);
        var different = disk.Where(f => !JsonNode.DeepEquals(f.Json, JsonNode.Parse(byName[f.Name]))).Select(f => f.Name).ToList();
        Assert.True(different.Count == 0,
            $"내용이 지금 데이터와 다른 파일 {different.Count}개({string.Join(", ", different.Take(10))}) — {Redump}");
    }

    [Fact]
    public void Build_IsDeterministic_SingleLine_AndNamedByHexSyllable()
    {
        var first = HanjaPickDump.Build();
        var second = HanjaPickDump.Build();
        Assert.Equal(first, second);   // 시각·실행 순서에 기대는 값이 없다

        Assert.Equal(HanjaPickDump.IndexFileName, first[^1].FileName);
        Assert.Equal(first.Count, first.Select(f => f.FileName).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        foreach (var (name, json) in first)
        {
            Assert.DoesNotContain('\n', json);
            Assert.DoesNotContain('\r', json);
            if (name == HanjaPickDump.IndexFileName) continue;
            Assert.Matches(HanjaPickDump.SyllableFileNamePattern, name);   // 한글 파일 이름을 쓰지 않는다
        }

        // 서 = c11c.json (설계서의 예)
        Assert.Equal("c11c.json", HanjaPickDump.FileNameFor('서'));
        Assert.Contains(first, f => f.FileName == "c11c.json");
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑮ 파일 꼴 — 줄바꿈 없음 · UTF-8 · 호환 한자 없음
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 이 저장소는 core.autocrlf 라 줄바꿈이 든 파일은 커밋·체크아웃에서 바이트가 바뀐다. 줄바꿈 문자가 아예 없으면 바뀔 것이 없다.
    /// </summary>
    [Fact]
    public void Files_OnDisk_HaveNoLineBreaks_NoBom_AndAreOneJsonObject()
    {
        var disk = ReadDisk();
        Assert.True(disk.Count > 400, $"파일 {disk.Count}개 — 검사가 비어 있다");

        var problems = new List<string>();
        foreach (var file in disk)
        {
            if (!file.Name.EndsWith(".json", StringComparison.Ordinal)) problems.Add($"{file.Name}: json 이 아닌 파일");
            if (Array.IndexOf(file.Bytes, (byte)'\n') >= 0 || Array.IndexOf(file.Bytes, (byte)'\r') >= 0) problems.Add($"{file.Name}: 줄바꿈 문자");
            if (file.Bytes.Length >= 3 && file.Bytes[0] == 0xEF && file.Bytes[1] == 0xBB && file.Bytes[2] == 0xBF) problems.Add($"{file.Name}: BOM");
            if (file.Bytes.Length == 0 || file.Bytes[0] != (byte)'{' || file.Bytes[^1] != (byte)'}') problems.Add($"{file.Name}: 앞뒤에 다른 바이트");
            if (file.Json is not JsonObject) problems.Add($"{file.Name}: 객체가 아님");
        }
        Assert.True(problems.Count == 0, string.Join("\n", problems.Take(20)));
    }

    /// <summary>
    /// 파일의 글자는 모두 통합 한자다 — 호환 한자(U+F900~FAFF·U+2F800~2FA1F), 강희 부수·부수 보충(U+2F00~2FD5·U+2E80~2EF3),
    /// 이체 선택자(U+FE00~FE0F·U+E0100~E01EF)가 없다. BMP 밖 글자는 파일에 \uD8xx\uDCxx 로 적혀 있어 이스케이프를 푼 값으로 본다.
    /// 화면이 고른 글자를 그대로 nameHanja 로 보내므로, 여기 호환 코드가 섞이면 주소·저장 값이 요청마다 달라진다.
    /// </summary>
    [Fact]
    public void Files_OnDisk_ContainOnlyUnifiedHanja()
    {
        var disk = ReadDisk();
        var problems = new List<string>();
        int characters = 0;

        foreach (var file in disk)
        {
            foreach (var text in Strings(file.Json))
                foreach (var rune in text.EnumerateRunes())
                {
                    int v = rune.Value;
                    bool bad = (v >= 0xF900 && v <= 0xFAFF) || (v >= 0x2F800 && v <= 0x2FA1F)
                            || (v >= 0x2F00 && v <= 0x2FD5) || (v >= 0x2E80 && v <= 0x2EF3)
                            || (v >= 0xFE00 && v <= 0xFE0F) || (v >= 0xE0100 && v <= 0xE01EF)
                            || v == 0xFFFD;
                    if (bad) problems.Add($"{file.Name}: U+{v:X4}");
                }

            if (file.Name == HanjaPickDump.IndexFileName) continue;
            foreach (var fact in Facts(file))
            {
                characters++;
                var character = Character(fact);
                var runes = character.EnumerateRunes().ToList();
                // 한 글자(Rune 하나)이고, 사전의 키 그대로이며, 입력 정규화를 다시 걸어도 그대로다
                if (runes.Count != 1) { problems.Add($"{file.Name}: 글자 수 {runes.Count}"); continue; }
                if (!HanjaData.HanjaDictionary.ContainsKey(character)) problems.Add($"{file.Name}: 사전 키가 아님 U+{runes[0].Value:X4}");
                if (HanjaInput.NormalizeRune(runes[0]) != runes[0]) problems.Add($"{file.Name}: 정규화하면 달라짐 U+{runes[0].Value:X4}");
            }
        }

        Assert.True(problems.Count == 0, string.Join("\n", problems.Distinct().Take(20)));
        Assert.True(characters > 9000, $"글자 {characters}건 — 검사가 비어 있다");

        // BMP 밖 글자가 실제로 실려 있다(이 검사가 이스케이프를 푼 값을 보고 있다는 확인)
        Assert.Contains(disk.Where(f => f.Name != HanjaPickDump.IndexFileName).SelectMany(Facts), f => Character(f).Length == 2);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑮ 음절 파일 = 입력 검증과 같은 목록 · 응답과 같은 글자 사실
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 음절 파일의 목록·순서는 <see cref="HanjaInput.CandidatesFor"/>(/evaluate 가 nameHanja 를 받는 술어와 같은 목록)이고,
    /// 글자 사실은 /evaluate 응답·/hanja/resolve 가 싣는 꼴(<see cref="HanjaFactMapper.ToFact"/> 를 API 설정으로 직렬화한 것)에서
    /// 기본값(false·빈 목록)인 필드만 뺀 것이다. HanjaFactDto 에 필드가 늘었는데 덤프가 안 실으면 여기서 실패한다.
    /// </summary>
    [Fact]
    public void SyllableFiles_AreCandidatesForInOrder_WithApiFactShapeMinusDefaults()
    {
        var files = SyllableFiles(ReadDisk());
        var problems = new List<string>();
        int facts = 0, omitted = 0;

        foreach (var (syllable, file) in files)
        {
            var syllableText = syllable.ToString();
            Assert.Equal(new[] { "syllable", "hanja" }, file.Json.AsObject().Select(p => p.Key).ToArray());
            Assert.Equal(syllableText, file.Json["syllable"]!.GetValue<string>());
            Assert.Equal(HanjaPickDump.FileNameFor(syllable), file.Name);

            var expected = HanjaInput.CandidatesFor(syllable);
            var actual = Facts(file);
            if (!expected.Select(h => h.Character).SequenceEqual(actual.Select(Character)))
            {
                problems.Add($"{file.Name}({syllableText}): 목록·순서가 CandidatesFor 와 다름 (파일 {actual.Count}자 · 지금 {expected.Count}자)");
                continue;
            }
            if (expected.Count == 0) problems.Add($"{file.Name}({syllableText}): 빈 목록");

            for (int i = 0; i < expected.Count; i++)
            {
                facts++;
                var api = JsonSerializer.SerializeToNode(HanjaFactMapper.ToFact(expected[i], syllableText), ApiJsonOptions)!.AsObject();
                var fact = actual[i];

                foreach (var extra in fact.Select(p => p.Key).Where(k => !api.ContainsKey(k)))
                    problems.Add($"{file.Name} {expected[i].Character}: 응답 꼴에 없는 필드 {extra}");

                foreach (var (key, value) in api)
                {
                    bool isDefault = value is JsonArray { Count: 0 }
                                  || (value is JsonValue v && v.GetValueKind() == JsonValueKind.False);
                    if (!fact.ContainsKey(key))
                    {
                        omitted++;
                        if (!isDefault) problems.Add($"{file.Name} {expected[i].Character}: {key} 가 빠졌는데 지금 값은 {value?.ToJsonString()}");
                    }
                    else if (isDefault)
                    {
                        problems.Add($"{file.Name} {expected[i].Character}: 기본값인 {key} 를 적었다(없는 필드 = false·[] 약속)");
                    }
                    else if (!JsonNode.DeepEquals(fact[key], value))
                    {
                        problems.Add($"{file.Name} {expected[i].Character}: {key} = {fact[key]?.ToJsonString()} · 지금 {value?.ToJsonString()}");
                    }
                }
            }
        }

        Assert.True(problems.Count == 0, $"{problems.Count}건 — {Redump}\n" + string.Join("\n", problems.Take(20)));
        Assert.True(facts > 9000 && omitted > 0, $"글자 사실 {facts}건·생략 {omitted}건 — 검사가 비어 있다");
    }

    /// <summary>
    /// 사전 원자료로 따로 센 기대값: 글자마다 지정 독음(대표·다른 독음)과 그 두음 꼴의 파일에 실려 있다. 파일이 있는 음절은 그렇게 나온 음절뿐이다
    /// (보충 표의 均 '연'은 사전 파일 원자료 쪽 독음이라 따로 단언한다). 두음은 한쪽 방향 — 지정 독음이 '나'뿐인 글자는 '라' 파일에 없다.
    /// </summary>
    [Fact]
    public void SyllableFiles_CoverEveryDictionaryReading_AndItsInitialSoundForm()
    {
        var files = SyllableFiles(ReadDisk());
        var charsBySyllable = files.ToDictionary(p => p.Key, p => Facts(p.Value).Select(Character).ToHashSet(StringComparer.Ordinal));

        var expectedSyllables = new SortedSet<char>();
        var problems = new List<string>();
        foreach (var hanja in HanjaData.GetAllHanja())
            foreach (var reading in new[] { hanja.Reading }.Concat(hanja.AlternateReadings))
            {
                Assert.Equal(1, reading.Length);
                foreach (char syllable in new[] { reading[0], RequiredCharEngine.ApplyInitialDueum(reading[0]) }.Distinct())
                {
                    expectedSyllables.Add(syllable);
                    if (!charsBySyllable.TryGetValue(syllable, out var set) || !set.Contains(hanja.Character))
                        problems.Add($"{syllable} 파일에 U+{char.ConvertToUtf32(hanja.Character, 0):X4} 없음(독음 {reading})");
                }
            }
        Assert.True(problems.Count == 0, $"{problems.Count}건 — {Redump}\n" + string.Join("\n", problems.Take(20)));
        Assert.Equal(expectedSyllables.ToList(), files.Keys.ToList());

        // 보충 표: 均 U+5747 은 '균'과 '연' 파일에(대법원 목록의 지정 발음 '균,연'), '연' 파일의 훈은 그 음절의 훈
        Assert.Contains(Cp(0x5747), charsBySyllable['균']);
        Assert.Contains(Cp(0x5747), charsBySyllable['연']);
        var gyunInYeon = Facts(files['연']).Single(f => Character(f) == Cp(0x5747));
        Assert.EndsWith(" 연", gyunInYeon["gloss"]!.GetValue<string>());

        // 본음 → 두음 꼴 한쪽 방향: 李 U+674E 은 리·이 두 파일에, 娜 U+5A1C(지정 독음 '나')는 '라' 파일에 없다
        Assert.Contains(Cp(0x674E), charsBySyllable['리']);
        Assert.Contains(Cp(0x674E), charsBySyllable['이']);
        Assert.Contains(Cp(0x5A1C), charsBySyllable['나']);
        Assert.DoesNotContain(Cp(0x5A1C), charsBySyllable['라']);

        // 인명용 한자 독음이 아닌 음절은 파일이 없다(화면이 칸을 잠근다)
        Assert.False(files.ContainsKey('봄'));
        Assert.False(files.ContainsKey('빛'));
    }

    /// <summary>
    /// 이름 칸 패널이 파일 순서 그대로 그리는 묶음 — ① 쓸 수 있는 글자(먼저 보여 드리는 글자 → 기본 영역 → 그 밖) ② 이름에 피하는 글자(코드포인트 순)
    /// ③ 뜻 풀이가 없는 글자(코드포인트 순). 파일의 표시만으로 센다(화면이 보는 값).
    /// </summary>
    [Fact]
    public void SyllableFiles_AreGrouped_UsableThenForbiddenThenNoMeaning()
    {
        var files = SyllableFiles(ReadDisk());
        var problems = new List<string>();
        int forbiddenSeen = 0, noMeaningSeen = 0, commonSeen = 0;

        foreach (var (syllable, file) in files)
        {
            int previousGroup = 0, previousRank = int.MaxValue, previousCodePoint = -1;
            foreach (var fact in Facts(file))
            {
                bool forbidden = Flag(fact, "forbidden");
                bool hasMeaning = Flag(fact, "hasMeaning");
                bool common = Flag(fact, "common");
                int group = forbidden ? 1 : hasMeaning ? 0 : 2;
                int codePoint = char.ConvertToUtf32(Character(fact), 0);
                if (forbidden) forbiddenSeen++;
                if (group == 2) noMeaningSeen++;
                if (common) commonSeen++;

                // 먼저 보여 드리는 글자는 쓸 수 있는 글자에만 붙는다(이름에 피하는 글자·뜻 없는 글자가 앞 묶음에 서지 않는다)
                if (common && group != 0) problems.Add($"{syllable} U+{codePoint:X4}: 쓸 수 없는 글자에 common");

                if (group < previousGroup) problems.Add($"{syllable} U+{codePoint:X4}: 묶음 순서가 거꾸로({previousGroup} → {group})");
                if (group != previousGroup) { previousRank = int.MaxValue; previousCodePoint = -1; }

                if (group == 0)
                {
                    int rank = (common ? 2 : 0) + (Flag(fact, "basic") ? 1 : 0);
                    if (rank > previousRank) problems.Add($"{syllable} U+{codePoint:X4}: 쓸 수 있는 글자 묶음 안의 순서(먼저 보여 드리는 글자 → 기본 영역)");
                    previousRank = rank;
                }
                else
                {
                    if (codePoint <= previousCodePoint) problems.Add($"{syllable} U+{codePoint:X4}: 코드포인트 순이 아님");
                    previousCodePoint = codePoint;
                }
                previousGroup = group;
            }
        }

        Assert.True(problems.Count == 0, string.Join("\n", problems.Take(20)));
        Assert.True(forbiddenSeen > 0 && noMeaningSeen > 0 && commonSeen > 0,
            $"불용 {forbiddenSeen}·뜻 없음 {noMeaningSeen}·먼저 보여 드리는 글자 {commonSeen} — 세 묶음이 다 나와야 검사가 된다");
    }

    /// <summary>
    /// 패널에 그대로 보이는 훈 — 뜻 풀이가 있는 글자(hasMeaning)의 gloss 는 한글이 있고 영문자가 없다. 뜻 풀이가 없는 글자는 gloss 가 빈 문자열이다.
    /// 사전 로더는 한글 뜻이 없는 글자에 Unihan 영문 뜻을 채워 두는데(U+39B3 'to cultivate, …'), 그 글이 한글 훈 사이에 '쓸 수 있는 글자'로 실리지 않는다.
    /// </summary>
    [Fact]
    public void SyllableFiles_GlossIsKoreanOrEmpty_NoForeignDefinitionLeaks()
    {
        var problems = new List<string>();
        int withGloss = 0, withoutGloss = 0;
        foreach (var (syllable, file) in SyllableFiles(ReadDisk()))
            foreach (var fact in Facts(file))
            {
                string gloss = fact["gloss"]!.GetValue<string>();
                bool hasMeaning = Flag(fact, "hasMeaning");
                string where = $"{syllable} U+{char.ConvertToUtf32(Character(fact), 0):X4} '{gloss}'";
                if (hasMeaning)
                {
                    withGloss++;
                    if (!Regex.IsMatch(gloss, "[가-힣]")) problems.Add($"{where}: 훈에 한글이 없다");
                    if (Regex.IsMatch(gloss, "[A-Za-z]")) problems.Add($"{where}: 훈에 영문자가 있다");
                }
                else
                {
                    withoutGloss++;
                    if (gloss.Length != 0) problems.Add($"{where}: 뜻 풀이 없는 글자인데 훈이 적혀 있다");
                }
            }
        Assert.True(problems.Count == 0, $"{problems.Count}건 — {Redump}\n" + string.Join("\n", problems.Take(20)));
        Assert.True(withGloss > 9000 && withoutGloss > 0, $"훈 있는 쌍 {withGloss}·없는 쌍 {withoutGloss} — 검사가 비어 있다");

        // U+39B3(재) — 사전 뜻은 영문뿐이다. '재' 파일에서 뜻 풀이 없는 글자로 실린다
        var english = HanjaData.FindByCharacter(Cp(0x39B3));
        if (english != null && !Regex.IsMatch(english.Meaning ?? "", "[가-힣]"))
        {
            var fact = Facts(SyllableFiles(ReadDisk())['재']).Single(f => Character(f) == Cp(0x39B3));
            Assert.False(Flag(fact, "hasMeaning"));
            Assert.Equal("", fact["gloss"]!.GetValue<string>());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑮ · ⑦ index.json — 수 · 음절 표 · autoEmpty · 성씨 표
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void Index_Counts_MatchDictionaryAndFiles()
    {
        var disk = ReadDisk();
        var index = Index(disk);
        var files = SyllableFiles(disk);
        var all = HanjaData.GetAllHanja();

        Assert.Equal(new[] { "version", "counts", "syllables", "surnames" }, index.Select(p => p.Key).ToArray());
        Assert.Equal(HanjaPickDump.Version, index["version"]!.GetValue<int>());

        var counts = index["counts"]!.AsObject();
        Assert.Equal(new[] { "characters", "syllables", "pairs", "forbidden", "common" }, counts.Select(p => p.Key).ToArray());

        // 사전 쪽에서 센 값
        Assert.Equal(all.Count, counts["characters"]!.GetValue<int>());
        Assert.Equal(all.Count(h => HanjaData.IsForbiddenNameHanja(h.Character)), counts["forbidden"]!.GetValue<int>());
        var shownFirst = all.Where(h => HanjaData.IsCommonNameHanja(h.Character) && !HanjaData.IsWeakGivenNameHanja(h.Character)).ToList();
        Assert.Equal(shownFirst.Count, counts["common"]!.GetValue<int>());
        // '먼저 보여 드리는 글자' 수로 화면에 적는 값이라, 그 글자는 모두 쓸 수 있는 글자여야 한다(불용·뜻 없는 글자가 섞이면 수가 목록과 어긋난다)
        Assert.All(shownFirst, h => Assert.True(HanjaSelector.IsUsableNameHanja(h), $"U+{char.ConvertToUtf32(h.Character, 0):X4}"));

        // 파일 쪽에서 센 값 — 설명 글이 이 수를 그대로 적는다
        var facts = files.Values.SelectMany(Facts).ToList();
        Assert.Equal(files.Count, counts["syllables"]!.GetValue<int>());
        Assert.Equal(facts.Count, counts["pairs"]!.GetValue<int>());
        Assert.Equal(facts.Select(Character).Distinct(StringComparer.Ordinal).Count(), counts["characters"]!.GetValue<int>());
        Assert.Equal(facts.Where(f => Flag(f, "forbidden")).Select(Character).Distinct(StringComparer.Ordinal).Count(), counts["forbidden"]!.GetValue<int>());
        Assert.Equal(facts.Where(f => Flag(f, "common")).Select(Character).Distinct(StringComparer.Ordinal).Count(), counts["common"]!.GetValue<int>());
    }

    /// <summary>
    /// 음절 표: all·usable 은 파일과 같고, autoEmpty 는 <see cref="HanjaInput.AutoIsEmpty"/> 가 참인 음절에만 true 로 실린다 —
    /// 서버가 그 칸의 '한자 없음'을 자동으로 접는 기준과 화면이 '한글' 칸으로 두는 기준이 같은 값이어야 한다(설계서 §13-1 ⑦ 의 끝 단언).
    /// 표에 없는 음절은 화면이 칸을 잠그는데, 그런 음절의 자동 배정도 비어 있어야 한다.
    /// </summary>
    [Fact]
    public void Index_Syllables_MatchFiles_AndAutoEmptyIsTheServerRule()
    {
        var disk = ReadDisk();
        var files = SyllableFiles(disk);
        var syllables = Index(disk)["syllables"]!.AsObject();

        Assert.Equal(files.Keys.Select(c => c.ToString()).ToList(), syllables.Select(p => p.Key).OrderBy(k => k, StringComparer.Ordinal).ToList());

        var problems = new List<string>();
        int autoEmptyCount = 0;
        foreach (var (syllable, file) in files)
        {
            var entry = syllables[syllable.ToString()]!.AsObject();
            var facts = Facts(file);
            var candidates = HanjaInput.CandidatesFor(syllable);

            foreach (var key in entry.Select(p => p.Key).Where(k => k is not ("all" or "usable" or "autoEmpty")))
                problems.Add($"{syllable}: 모르는 필드 {key}");
            if (entry["all"]!.GetValue<int>() != facts.Count) problems.Add($"{syllable}: all {entry["all"]} · 파일 {facts.Count}");

            int usable = entry["usable"]!.GetValue<int>();
            if (usable != facts.Count(f => !Flag(f, "forbidden") && Flag(f, "hasMeaning"))) problems.Add($"{syllable}: usable {usable} · 파일의 표시로 센 값과 다름");
            // 사전 쪽에서 따로 센 값 — 이름에 피하는 글자가 아니고 뜻에 한글 훈이 있는 글자(사전에 영문 뜻만 있는 글자는 뜻 풀이 없는 글자로 싣는다)
            int expectedUsable = candidates.Count(h => !HanjaData.IsForbiddenNameHanja(h.Character) && Regex.IsMatch(h.Meaning ?? "", "[가-힣]"));
            if (usable != expectedUsable) problems.Add($"{syllable}: usable {usable} · 지금 쓸 수 있는 글자 수 {expectedUsable} 와 다름");

            bool expectedAutoEmpty = HanjaInput.AutoIsEmpty(syllable);
            bool written = entry.ContainsKey("autoEmpty");
            if (written && entry["autoEmpty"]!.GetValueKind() != JsonValueKind.True) problems.Add($"{syllable}: autoEmpty 는 true 일 때만 싣는다");
            if (written != expectedAutoEmpty) problems.Add($"{syllable}: autoEmpty {written} · AutoIsEmpty {expectedAutoEmpty}");
            if (expectedAutoEmpty) autoEmptyCount++;
        }
        Assert.True(problems.Count == 0, $"{problems.Count}건 — {Redump}\n" + string.Join("\n", problems.Take(20)));
        Assert.True(autoEmptyCount > 0, "자동 배정이 비는 음절이 하나도 없다 — 검사가 비어 있다");

        // 글자가 모두 이름에 피하는 글자인 음절(몰·괵): 파일은 있고 autoEmpty
        foreach (char syllable in "몰괵")
        {
            var entry = syllables[syllable.ToString()]!.AsObject();
            Assert.True(entry["all"]!.GetValue<int>() > 0);
            Assert.Equal(0, entry["usable"]!.GetValue<int>());
            Assert.True(entry["autoEmpty"]!.GetValue<bool>());
        }
        Assert.False(syllables["서"]!.AsObject().ContainsKey("autoEmpty"));

        // 표에 없는 음절 = 잠긴 칸. 자동 배정은 사전의 독음(대표·다른 독음)으로만 찾으므로, 그 독음이 모두 표에 있으면 표 밖 음절의 자동 배정은 빈다
        foreach (var hanja in HanjaData.GetAllHanja())
            foreach (var reading in new[] { hanja.Reading }.Concat(hanja.AlternateReadings))
                Assert.True(syllables.ContainsKey(reading), $"독음 {reading} 이 음절 표에 없다");
        foreach (char syllable in "봄빛쁨힣")
        {
            Assert.False(syllables.ContainsKey(syllable.ToString()));
            Assert.True(HanjaInput.AutoIsEmpty(syllable));
        }
    }

    /// <summary>
    /// 성씨 표 = <see cref="SurnameData.RepresentativeHanja"/> 그대로. 화면은 이 표로 성씨 칸의 기본 한자를 그리고 서버는 같은 표의 글자와 같으면
    /// '지정 없음'으로 접는다. 표의 글자는 그 음절의 후보 파일에도 있어야 한다 — 성씨 패널이 같은 파일에서 기본 한자를 찾아 맨 앞에 세운다.
    /// </summary>
    [Fact]
    public void Index_Surnames_AreTheRepresentativeTable_AndEachCharIsInItsSyllableFile()
    {
        var disk = ReadDisk();
        var files = SyllableFiles(disk);
        var surnames = Index(disk)["surnames"]!.AsObject();

        var expected = SurnameData.RepresentativeHanja;
        Assert.Equal(expected.Count, surnames.Count);
        Assert.True(expected.Count > 100, $"성씨 표 {expected.Count}항목 — 검사가 비어 있다");

        var problems = new List<string>();
        foreach (var (surname, hanja) in expected)
        {
            if (surnames[surname]?.GetValue<string>() != hanja) { problems.Add($"{surname}: 표와 다름"); continue; }

            var runes = hanja.EnumerateRunes().ToList();
            if (runes.Count != surname.Length) { problems.Add($"{surname}: 글자 수가 성씨 글자 수와 다름"); continue; }
            for (int i = 0; i < runes.Count; i++)
            {
                var character = runes[i].ToString();
                if (!files.TryGetValue(surname[i], out var file) || Facts(file).All(f => Character(f) != character))
                    problems.Add($"{surname}: {i}번째 글자 U+{runes[i].Value:X4} 가 '{surname[i]}' 파일에 없음");
                // 서버가 성씨 칸의 기본값으로 쓰는 글자와 같다
                if (HanjaInput.SurnameDefaultAt(surname, i)?.Character != character)
                    problems.Add($"{surname}: {i}번째 글자가 SurnameDefaultAt 과 다름");
            }
        }
        Assert.True(problems.Count == 0, $"{problems.Count}건 — {Redump}\n" + string.Join("\n", problems.Take(20)));
    }
}
