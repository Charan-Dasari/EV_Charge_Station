using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

[ApiController]
[Route("api/ev")]
public class EvStationsController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;

    public EvStationsController(IConfiguration config, IHttpClientFactory httpClientFactory, IMemoryCache cache)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
    }

    [HttpGet("stations")]
    public async Task<IActionResult> GetStations(
        double south = -90, double west = -180,
        double north = 90, double east = 180)
    {
        var apiKey = _config["OpenChargeMap:ApiKey"];

        // Round bounds to 1 decimal to improve cache hit rate
        var cacheKey = $"ev_{Math.Round(south, 1)}_{Math.Round(west, 1)}_{Math.Round(north, 1)}_{Math.Round(east, 1)}";

        // Return cached result if available (cache for 3 minutes)
        if (_cache.TryGetValue(cacheKey, out string cachedContent))
            return Content(cachedContent, "application/json");

        var url = $"https://api.openchargemap.io/v3/poi/?" +
                  $"output=json&compact=true&verbose=false&maxresults=1500" +
                  $"&key={apiKey}" +
                  $"&boundingbox=({south},{west}),({north},{east})";

        // Retry up to 3 times on connection failure
        for (int attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                    return StatusCode((int)response.StatusCode);

                var content = await response.Content.ReadAsStringAsync();

                // Cache successful response for 3 minutes
                _cache.Set(cacheKey, content, TimeSpan.FromMinutes(3));

                return Content(content, "application/json");
            }
            catch (HttpRequestException) when (attempt < 3)
            {
                // Wait before retry: 500ms, 1000ms
                await Task.Delay(attempt * 500);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        return StatusCode(500, new { error = "Failed after 3 retries" });
    }
}