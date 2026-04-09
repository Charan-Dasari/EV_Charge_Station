using EV_Charge_Station.Models;

namespace EV_Charge_Station.Services;

public interface IInteractionService
{
    // Favorites
    Task<List<Favorite>> GetFavoritesAsync(string userId);
    Task<bool> AddFavoriteAsync(string userId, string stationId, string stationJson);
    Task<bool> RemoveFavoriteAsync(string userId, string stationId);

    // Reports & Reviews
    Task<List<ReportDetail>> GetReportsAsync(string stationId);
    Task<ReportDetail> AddReportAsync(string userId, string userName, string stationId, string status, int rating, string reviewText);
    Task<bool> VoteReportAsync(string reportId, bool isUpvote);
}
