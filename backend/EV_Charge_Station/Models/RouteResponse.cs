namespace EV_Charge_Station.Models
{
    public class RouteResponse
    {
        public double DistanceKm { get; set; }
        public double DurationMinutes { get; set; }
        public List<RouteCoordinate> Geometry { get; set; }
    }
}
