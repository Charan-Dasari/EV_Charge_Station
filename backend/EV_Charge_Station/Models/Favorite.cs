using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EV_Charge_Station.Models;

public class Favorite
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string UserId { get; set; } = null!;
    
    // We store the full JSON of the station or just the crucial subset so 
    // the frontend doesn't have to re-query the external API for favorites
    public string StationId { get; set; } = null!;
    public string StationJson { get; set; } = null!;
    
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
