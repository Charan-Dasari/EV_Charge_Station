using EV_Charge_Station.Models;
using EV_Charge_Station.Services;
using Microsoft.AspNetCore.Mvc;

namespace EV_Charge_Station.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        if (!result.Success)
        {
            return BadRequest(new { Message = result.ErrorMessage });
        }
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (!result.Success)
        {
            return Unauthorized(new { Message = result.ErrorMessage });
        }
        return Ok(result);
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        var result = await _authService.GoogleLoginAsync(request.Credential);
        if (!result.Success)
        {
            return Unauthorized(new { Message = result.ErrorMessage });
        }
        return Ok(result);
    }

    [HttpPost("check-email")]
    public async Task<IActionResult> CheckEmail([FromBody] CheckEmailRequest request)
    {
        var result = await _authService.CheckEmailForResetAsync(request.Email);
        if (!result.Success)
        {
            return BadRequest(new { Message = result.ErrorMessage });
        }
        return Ok(result);
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { Message = "Password must be at least 6 characters." });
        }
        var result = await _authService.ResetPasswordAsync(request.Email, request.NewPassword);
        if (!result.Success)
        {
            return BadRequest(new { Message = result.ErrorMessage });
        }
        return Ok(result);
    }
}
