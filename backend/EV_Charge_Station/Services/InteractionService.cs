using EV_Charge_Station.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Bson;

namespace EV_Charge_Station.Services;

public class InteractionService : IInteractionService
{
    private readonly IMongoCollection<Favorite> _favorites;
    private readonly IMongoCollection<ReportDetail> _reports;

    public InteractionService(IOptions<MongoDbSettings> mongoSettings)
    {
        var mongoClient = new MongoClient(mongoSettings.Value.ConnectionString);
        var database = mongoClient.GetDatabase(mongoSettings.Value.DatabaseName);
        
        _favorites = database.GetCollection<Favorite>("Favorites");
        _reports = database.GetCollection<ReportDetail>("ReportDetails");
    }

    public async Task<List<Favorite>> GetFavoritesAsync(string userId)
    {
        return await _favorites.Find(f => f.UserId == userId).ToListAsync();
    }

    public async Task<bool> AddFavoriteAsync(string userId, string stationId, string stationJson)
    {
        var existing = await _favorites.Find(f => f.UserId == userId && f.StationId == stationId).FirstOrDefaultAsync();
        if (existing != null)
            return true; // already fav

        var fav = new Favorite
        {
            UserId = userId,
            StationId = stationId,
            StationJson = stationJson
        };
        
        await _favorites.InsertOneAsync(fav);
        return true;
    }

    public async Task<bool> RemoveFavoriteAsync(string userId, string stationId)
    {
        var result = await _favorites.DeleteOneAsync(f => f.UserId == userId && f.StationId == stationId);
        return result.DeletedCount > 0;
    }

    public async Task<List<ReportDetail>> GetReportsAsync(string stationId)
    {
        return await _reports.Find(r => r.StationId == stationId)
                             .SortByDescending(r => r.CreatedAt)
                             .ToListAsync();
    }

    public async Task<ReportDetail> AddReportAsync(string userId, string userName, string stationId, string status, int rating, string reviewText)
    {
        var report = new ReportDetail
        {
            UserId = userId,
            UserName = userName,
            StationId = stationId,
            Status = status,
            Rating = rating,
            ReviewText = reviewText
        };

        await _reports.InsertOneAsync(report);
        return report;
    }

    public async Task<bool> VoteReportAsync(string reportId, bool isUpvote)
    {
        if (!ObjectId.TryParse(reportId, out var oId))
            return false;

        var update = isUpvote 
            ? Builders<ReportDetail>.Update.Inc(r => r.ThumbsUp, 1)
            : Builders<ReportDetail>.Update.Inc(r => r.ThumbsDown, 1);

        var result = await _reports.UpdateOneAsync(r => r.Id == reportId, update);
        return result.ModifiedCount > 0;
    }
}
