using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

/// <summary>
/// 쌍둥이/형제 이름 서비스 인터페이스
/// </summary>
public interface ITwinNameService
{
    Task<TwinNameResponseDto> GenerateTwinNamesAsync(TwinNameRequestDto request);
}
