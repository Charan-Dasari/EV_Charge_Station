using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using EV_Charge_Station.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EV_Charge_Station.Controllers;

[ApiController]
[Route("api/interaction")]
public class InteractionController : ControllerBase
{
    private readonly IInteractionService _interactionService;

    public InteractionController(IInteractionService interactionService)
    {
        _interactionService = interactionService;
    }

    private string GetUserId() =>
        User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "";
    private string GetUserName() =>
        User.FindFirstValue("Name")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? "Anonymous";

    // --- FAVORITES ---

    [HttpGet("favorites")]
    [Authorize]
    public async Task<IActionResult> GetFavorites()
    {
        var userId = GetUserId();
        var favs = await _interactionService.GetFavoritesAsync(userId);
        return Ok(new { success = true, data = favs });
    }

    public class AddFavoriteRequest
    {
        public string StationId { get; set; } = null!;
        public string StationJson { get; set; } = null!;
    }

    [HttpPost("favorites")]
    [Authorize]
    public async Task<IActionResult> AddFavorite([FromBody] AddFavoriteRequest request)
    {
        var userId = GetUserId();
        await _interactionService.AddFavoriteAsync(userId, request.StationId, request.StationJson);
        return Ok(new { success = true });
    }

    [HttpDelete("favorites/{stationId}")]
    [Authorize]
    public async Task<IActionResult> RemoveFavorite(string stationId)
    {
        var userId = GetUserId();
        await _interactionService.RemoveFavoriteAsync(userId, stationId);
        return Ok(new { success = true });
    }

    // --- REPORTS & REVIEWS ---

    [HttpGet("reports/{stationId}")]
    public async Task<IActionResult> GetReports(string stationId)
    {
        Console.WriteLine($"[InteractionController] GET reports for stationId='{stationId}'");
        var reports = await _interactionService.GetReportsAsync(stationId);
        Console.WriteLine($"[InteractionController] Found {reports.Count} reports");
        return Ok(new { success = true, data = reports });
    }

    public class AddReportRequest
    {
        public string StationId { get; set; } = null!;
        public string Status { get; set; } = null!;      // e.g. "Available", "Not Available"
        public int Rating { get; set; }                  // 1-5
        public string ReviewText { get; set; } = null!;  
    }

    [HttpPost("reports")]
    [Authorize]
    public async Task<IActionResult> AddReport([FromBody] AddReportRequest request)
    {
        var userId = GetUserId();
        var userName = GetUserName();
        Console.WriteLine($"[InteractionController] POST report: userId='{userId}', userName='{userName}', stationId='{request.StationId}', status='{request.Status}', rating={request.Rating}");
        var newReport = await _interactionService.AddReportAsync(
            userId, userName, request.StationId, request.Status, request.Rating, request.ReviewText);
        Console.WriteLine($"[InteractionController] Report stored with Id='{newReport.Id}', StationId='{newReport.StationId}'");
        return Ok(new { success = true, data = newReport });
    }

    public class VoteRequest
    {
        public bool IsUpvote { get; set; }
    }

    [HttpPost("reports/{reportId}/vote")]
    [Authorize]
    public async Task<IActionResult> VoteReport(string reportId, [FromBody] VoteRequest request)
    {
        var result = await _interactionService.VoteReportAsync(reportId, request.IsUpvote);
        if (!result) return BadRequest(new { success = false, message = "Report not found or invalid." });
        return Ok(new { success = true });
    }
}
