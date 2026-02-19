using EV_Charge_Station.Models;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace EV_Charge_Station.Controllers
{
    [ApiController]
    [Route("api/route")]
    public class RouteController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public RouteController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet]
        public async Task<IActionResult> GetRoute(
            double fromLat, double fromLng,
            double toLat, double toLng)
        {
            var apiKey = _configuration["OpenRouteService:ApiKey"];

            if (string.IsNullOrEmpty(apiKey))
                return StatusCode(500, "GraphHopper API key not configured.");

            var url =
                $"https://graphhopper.com/api/1/route?" +
                $"point={fromLat},{fromLng}&" +
                $"point={toLat},{toLng}&" +
                $"vehicle=car&locale=en&" +
                $"calc_points=true&points_encoded=true&" +
                $"key={apiKey}";

            try
            {
                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                    return StatusCode((int)response.StatusCode, "Routing failed.");

                var responseString = await response.Content.ReadAsStringAsync();

                using var doc = JsonDocument.Parse(responseString);

                if (!doc.RootElement.TryGetProperty("paths", out var paths) ||
                    paths.GetArrayLength() == 0)
                    return BadRequest("No route found.");

                var path = paths[0];
                var distanceMeters = path.GetProperty("distance").GetDouble();
                var timeMs = path.GetProperty("time").GetDouble();
                var encodedPolyline = path.GetProperty("points").GetString();
                var decodedCoords = DecodePolyline(encodedPolyline);

                var result = new RouteResponse
                {
                    DistanceKm = Math.Round(distanceMeters / 1000, 2),
                    DurationMinutes = Math.Round(timeMs / 1000 / 60, 1),
                    Geometry = decodedCoords
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private List<RouteCoordinate> DecodePolyline(string encoded)
        {
            var poly = new List<RouteCoordinate>();
            int index = 0, lat = 0, lng = 0;

            while (index < encoded.Length)
            {
                int shift = 0, result = 0, b;
                do { b = encoded[index++] - 63; result |= (b & 0x1f) << shift; shift += 5; }
                while (b >= 0x20);
                lat += ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);

                shift = 0; result = 0;
                do { b = encoded[index++] - 63; result |= (b & 0x1f) << shift; shift += 5; }
                while (b >= 0x20);
                lng += ((result & 1) != 0) ? ~(result >> 1) : (result >> 1);

                poly.Add(new RouteCoordinate { Latitude = lat / 1e5, Longitude = lng / 1e5 });
            }
            return poly;
        }
    }
}