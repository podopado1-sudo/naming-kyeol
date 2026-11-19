using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// /evaluate 한자 고르기의 음절별 정적 후보 파일(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §4-6).
/// <c>frontend/public/data/hanja-pick/v1/{음절 코드포인트 16진 소문자}.json</c>(서 = c11c.json) 과 <c>index.json</c> 의 내용을 만든다.
/// <c>dotnet run -- dump-hanja-pick</c>(Program.cs)와 동기화 테스트(Tests/HanjaPickStaticFilesTests)가 같은 <see cref="Build"/> 를 쓴다.
///
/// 내용은 다른 곳이 이미 정한 값을 옮기기만 한다 — 목록과 순서는 <see cref="HanjaInput.CandidatesFor"/>(평가의 입력 검증과 같은 술어),
/// 글자 사실은 <see cref="HanjaFactMapper.ToFact"/>(/evaluate 의 hanjaSummary·/hanja/resolve 와 같은 함수),
/// 잠긴 칸은 <see cref="HanjaInput.AutoIsEmpty"/>(서버가 그 자리의 '한자 없음'을 자동으로 접는 기준), 성씨 표는 <see cref="SurnameData.RepresentativeHanja"/>.
///
/// 파일 꼴에서 지키는 것:
/// · 줄바꿈 없는 한 줄 JSON(끝 줄바꿈도 없음). 이 저장소는 core.autocrlf 라 줄바꿈이 있으면 커밋·체크아웃에서 바이트가 바뀐다.
/// · 시각·실행 환경 값을 넣지 않는다 — 같은 데이터면 몇 번을 돌려도 같은 바이트다.
/// · 글자 사실의 기본값(false·빈 목록)은 쓰지 않는다 — 읽는 쪽(프런트)은 없는 필드를 false·[] 로 읽는다.
/// · 파일 이름에 한글을 쓰지 않는다(운영체제마다 NFC/NFD 가 달라진다).
/// 한자 데이터(불용·약자·자원오행·획수·뜻·성씨 표)를 바꾸면 덤프를 다시 돌려 커밋한다 — 안 돌리면 동기화 테스트가 실패한다.
/// </summary>
public static class HanjaPickDump
{
    /// <summary>파일 꼴의 판 번호 — 꼴이 바뀌면 폴더(v1)와 함께 올린다.</summary>
    public const int Version = 1;

    public const string IndexFileName = "index.json";

    /// <summary>저장소 루트 기준 기본 출력 폴더.</summary>
    public static string DefaultOutputDirectory => Path.Combine("frontend", "public", "data", "hanja-pick", "v1");

    /// <summary>음절 파일 이름 꼴 — UTF-16 코드 값 네 자리 16진 소문자(한글 음절은 모두 BMP).</summary>
    public static readonly Regex SyllableFileNamePattern = new(@"^[0-9a-f]{4}\.json$", RegexOptions.CultureInvariant);

    public static string FileNameFor(char syllable) => $"{(int)syllable:x4}.json";

    /// <summary>
    /// 후보 목록이 있는 음절 — 사전 글자의 지정 독음(보충 표 포함)과 그 두음 꼴 전부(<see cref="HanjaInput.AcceptedSyllables"/>), 코드 값 순.
    /// 여기 없는 음절(봄·빛)은 인명용 한자 독음이 아니라 화면이 칸을 잠근다.
    /// </summary>
    public static List<char> Syllables()
    {
        var set = new SortedSet<char>();
        foreach (var hanja in HanjaData.GetAllHanja())
            foreach (var syllable in HanjaInput.AcceptedSyllables(hanja))
                if (syllable.Length == 1 && HanjaInput.IsHangulSyllables(syllable)) set.Add(syllable[0]);
        return set.ToList();
    }

    /// <summary>
    /// 파일 이름과 내용(한 줄 JSON) — 음절 파일을 음절 코드 값 순으로, 맨 끝에 index.json.
    /// index.json 의 수(counts)는 음절 파일에 실제로 실은 글자에서 센다(파일과 숫자가 어긋나지 않게).
    /// </summary>
    public static List<(string FileName, string Json)> Build()
    {
        var files = new List<(string FileName, string Json)>();
        var entries = new List<(char Syllable, int All, int Usable, bool AutoEmpty)>();
        var characters = new HashSet<string>(StringComparer.Ordinal);
        var forbidden = new HashSet<string>(StringComparer.Ordinal);
        var common = new HashSet<string>(StringComparer.Ordinal);
        int pairs = 0;

        foreach (char syllable in Syllables())
        {
            var candidates = HanjaInput.CandidatesFor(syllable);
            if (candidates.Count == 0) continue;

            var syllableText = syllable.ToString();
            var facts = candidates.Select(h => HanjaFactMapper.ToFact(h, syllableText)).ToList();
            foreach (var fact in facts)
            {
                characters.Add(fact.Character);
                if (fact.Forbidden) forbidden.Add(fact.Character);
                if (fact.Common) common.Add(fact.Character);
            }
            pairs += facts.Count;
            entries.Add((syllable, facts.Count, candidates.Count(HanjaSelector.IsUsableNameHanja), HanjaInput.AutoIsEmpty(syllable)));

            files.Add((FileNameFor(syllable), Json(writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("syllable", syllableText);
                writer.WriteStartArray("hanja");
                foreach (var fact in facts) WriteFact(writer, fact);
                writer.WriteEndArray();
                writer.WriteEndObject();
            })));
        }

        files.Add((IndexFileName, Json(writer =>
        {
            writer.WriteStartObject();
            writer.WriteNumber("version", Version);

            writer.WriteStartObject("counts");
            writer.WriteNumber("characters", characters.Count);
            writer.WriteNumber("syllables", entries.Count);
            writer.WriteNumber("pairs", pairs);
            writer.WriteNumber("forbidden", forbidden.Count);
            writer.WriteNumber("common", common.Count);
            writer.WriteEndObject();

            writer.WriteStartObject("syllables");
            foreach (var entry in entries)
            {
                writer.WriteStartObject(entry.Syllable.ToString());
                writer.WriteNumber("all", entry.All);
                writer.WriteNumber("usable", entry.Usable);
                // 자동 배정이 비는 음절에만 싣는다. usable 0 과 따로 두는 까닭: 자동 배정은 두음 꼴·보충 독음을 보지 않아
                // 후보는 있는데 자동 배정은 없는 음절이 생길 수 있다 — 화면과 서버가 같은 값을 보게 한다
                if (entry.AutoEmpty) writer.WriteBoolean("autoEmpty", true);
                writer.WriteEndObject();
            }
            writer.WriteEndObject();

            writer.WriteStartObject("surnames");
            foreach (var pair in SurnameData.RepresentativeHanja.OrderBy(p => p.Key, StringComparer.Ordinal))
                writer.WriteString(pair.Key, pair.Value);
            writer.WriteEndObject();

            writer.WriteEndObject();
        })));

        return files;
    }

    /// <summary>
    /// 글자 사실 한 건 — 필드 이름은 API 응답(HanjaFactDto 의 camelCase)과 같다. false 인 표시와 빈 vReasons 는 쓰지 않는다.
    /// HanjaFactDto 에 필드가 늘면 여기도 고친다(동기화 테스트가 API 꼴과 대조해 알린다).
    /// </summary>
    private static void WriteFact(Utf8JsonWriter writer, HanjaFactDto fact)
    {
        writer.WriteStartObject();
        writer.WriteString("character", fact.Character);
        writer.WriteString("gloss", fact.Gloss);
        writer.WriteString("fiveElement", fact.FiveElement);
        writer.WriteString("resourceGrade", fact.ResourceGrade);
        if (fact.VReasons.Count > 0)
        {
            writer.WriteStartArray("vReasons");
            foreach (var reason in fact.VReasons) writer.WriteStringValue(reason);
            writer.WriteEndArray();
        }
        writer.WriteNumber("strokeCount", fact.StrokeCount);
        writer.WriteString("yinYang", fact.YinYang);
        if (fact.Common) writer.WriteBoolean("common", true);
        if (fact.Forbidden) writer.WriteBoolean("forbidden", true);
        if (fact.HasMeaning) writer.WriteBoolean("hasMeaning", true);
        if (fact.Basic) writer.WriteBoolean("basic", true);
        writer.WriteEndObject();
    }

    /// <summary>한 줄 JSON — 들여쓰기 없음(줄바꿈 문자가 생기지 않는다), 한글·한자는 글자 그대로(기존 덤프와 같은 인코더).</summary>
    private static string Json(Action<Utf8JsonWriter> write)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions
        {
            Indented = false,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        }))
        {
            write(writer);
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    /// <summary>
    /// 폴더에 쓴다 — UTF-8(BOM 없음), 내용이 같은 파일은 다시 쓰지 않는다. 지금 목록에 없는 음절 파일(이름이 16진 네 자리.json 인 것만)은 지운다
    /// — 독음이 사라진 음절의 파일이 남아 화면이 낡은 목록을 받지 않게.
    /// </summary>
    /// <returns>Files = 만든 파일 전부(이름·내용), Written = 새로 쓰거나 바꾼 파일 수, Removed = 지운 낡은 파일 수</returns>
    public static (List<(string FileName, string Json)> Files, int Written, int Removed) WriteTo(string outputDirectory)
    {
        var files = Build();
        Directory.CreateDirectory(outputDirectory);
        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

        int written = 0;
        foreach (var (fileName, json) in files)
        {
            var path = Path.Combine(outputDirectory, fileName);
            var bytes = encoding.GetBytes(json);
            if (File.Exists(path) && File.ReadAllBytes(path).AsSpan().SequenceEqual(bytes)) continue;
            File.WriteAllBytes(path, bytes);
            written++;
        }

        var names = files.Select(f => f.FileName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        int removed = 0;
        foreach (var path in Directory.GetFiles(outputDirectory, "*.json"))
        {
            var name = Path.GetFileName(path);
            if (names.Contains(name) || !SyllableFileNamePattern.IsMatch(name)) continue;
            File.Delete(path);
            removed++;
        }

        return (files, written, removed);
    }
}
