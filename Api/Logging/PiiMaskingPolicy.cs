using Serilog.Core;
using Serilog.Events;

namespace NameForm.Api.Logging;

/// <summary>
/// 개인정보(PII) 마스킹 정책.
///
/// Serilog가 객체를 구조화 로그로 펼칠 때 민감 필드를 자동으로 마스킹한다.
/// 적용 대상:
/// - BirthDate / birthDate / 출생일 (YYYY-MM-DD → YYYY-**-**)
/// - BirthTime / birthTime (HH:mm → HH:**)
/// - Name / FirstName / LastName / 이름 / 성 (가운데 글자 마스킹)
/// - Email / 이메일 (앞 2자 외 마스킹)
/// - FatherName / MotherName / ParentName (이름 마스킹과 동일)
///
/// 로그에 평문 PII가 남으면 개인정보보호법(GDPR/PIPA) 위반 위험 + 침해 시 책임 증가.
/// </summary>
public class PiiMaskingPolicy : IDestructuringPolicy
{
    private static readonly HashSet<string> DateFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "BirthDate", "birthDate", "출생일", "Birth", "DateOfBirth"
    };

    private static readonly HashSet<string> TimeFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "BirthTime", "birthTime", "출생시각", "TimeOfBirth"
    };

    private static readonly HashSet<string> NameFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Name", "FirstName", "LastName", "FullName",
        "FatherName", "MotherName", "ParentName",
        "이름", "성", "성씨"
    };

    private static readonly HashSet<string> EmailFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "Email", "EmailAddress", "이메일"
    };

    public bool TryDestructure(object value, ILogEventPropertyValueFactory propertyValueFactory, out LogEventPropertyValue result)
    {
        if (value == null)
        {
            result = null!;
            return false;
        }

        var type = value.GetType();

        // 기본 타입은 마스킹 안 함 (DTO 같은 복합 객체만 대상)
        if (type.IsPrimitive || type == typeof(string) || type == typeof(DateTime) || type == typeof(TimeSpan))
        {
            result = null!;
            return false;
        }

        var properties = type.GetProperties()
            .Where(p => p.CanRead && p.GetIndexParameters().Length == 0);

        var maskedProps = new List<LogEventProperty>();

        foreach (var prop in properties)
        {
            object? rawValue;
            try
            {
                rawValue = prop.GetValue(value);
            }
            catch
            {
                continue;
            }

            if (rawValue == null)
            {
                maskedProps.Add(new LogEventProperty(prop.Name, new ScalarValue(null)));
                continue;
            }

            string? maskedDisplay = MaskFieldIfNeeded(prop.Name, rawValue);
            if (maskedDisplay != null)
            {
                maskedProps.Add(new LogEventProperty(prop.Name, new ScalarValue(maskedDisplay)));
            }
            else
            {
                // 마스킹 대상이 아니면 그대로 직렬화
                maskedProps.Add(new LogEventProperty(prop.Name, propertyValueFactory.CreatePropertyValue(rawValue, destructureObjects: true)));
            }
        }

        result = new StructureValue(maskedProps, type.Name);
        return true;
    }

    /// <summary>
    /// 필드명에 따라 값을 마스킹. 마스킹 대상이 아니면 null 반환.
    /// </summary>
    private static string? MaskFieldIfNeeded(string fieldName, object value)
    {
        var stringValue = value.ToString() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(stringValue)) return null;

        if (DateFields.Contains(fieldName))
        {
            // 1985-06-05 → 1985-**-**
            return MaskDate(stringValue);
        }

        if (TimeFields.Contains(fieldName))
        {
            // 13:01 → 13:** / 13:01:00 → 13:**:**
            return MaskTime(stringValue);
        }

        if (NameFields.Contains(fieldName))
        {
            // 김서윤 → 김*윤 / 김민준호 → 김**호 / 김 → 김
            return MaskName(stringValue);
        }

        if (EmailFields.Contains(fieldName))
        {
            // podopado1@gmail.com → po******@gmail.com
            return MaskEmail(stringValue);
        }

        return null;
    }

    public static string MaskDate(string value)
    {
        // YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS
        if (value.Length >= 10 && value[4] == '-' && value[7] == '-')
        {
            return value[..4] + "-**-**" + (value.Length > 10 ? " (time-masked)" : "");
        }
        return "***";
    }

    public static string MaskTime(string value)
    {
        // HH:MM 또는 HH:MM:SS
        if (value.Length >= 2 && value.Contains(':'))
        {
            var parts = value.Split(':');
            if (parts.Length >= 2)
            {
                return parts[0] + ":**" + (parts.Length >= 3 ? ":**" : "");
            }
        }
        return "***";
    }

    public static string MaskName(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length switch
        {
            <= 1 => trimmed, // 한 글자는 마스킹 의미 없음
            2 => trimmed[0] + "*",
            3 => trimmed[0] + "*" + trimmed[^1],
            _ => trimmed[0] + new string('*', trimmed.Length - 2) + trimmed[^1],
        };
    }

    public static string MaskEmail(string value)
    {
        var atIdx = value.IndexOf('@');
        if (atIdx <= 0) return "***";
        var local = value[..atIdx];
        var domain = value[atIdx..];
        var keep = Math.Min(2, local.Length);
        return local[..keep] + new string('*', Math.Max(local.Length - keep, 1)) + domain;
    }
}
