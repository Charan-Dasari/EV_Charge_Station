using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EV_Charge_Station.Models;

public class ReportDetail
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string StationId { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string UserName { get; set; } = null!;
    
    // "Available", "Not Available"
    public string Status { get; set; } = null!;
    
    // 1 to 5
    public int Rating { get; set; }
    
    public string ReviewText { get; set; } = null!;
    
    public int ThumbsUp { get; set; }
    public int ThumbsDown { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
