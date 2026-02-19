using Microsoft.AspNetCore.Mvc;
using System;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

[ApiController]
[Route("api/poi")]
public class PoiController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PoiController> _logger;

    // Only 1 Overpass call at a time — prevents 429 floods
    private static readonly SemaphoreSlim _overpassSemaphore = new SemaphoreSlim(1, 1);
    private const int SEMAPHORE_WAIT_MS = 3000;
    private const int OVERPASS_TIMEOUT_S = 20;
    private const int CACHE_MINUTES = 10;

    public PoiController(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<PoiController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    [HttpGet("{type}")]
    public async Task<IActionResult> GetPoi(
        string type, double south, double west, double north, double east)
    {
        string tag = type.ToLower() switch
        {
            "hospital" => "amenity=hospital",
            "restaurant" => "amenity=restaurant",
            "hotel" => "tourism=hotel",
            "clinic" => "amenity=clinic",
            _ => ""
        };

        if (string.IsNullOrEmpty(tag))
            return BadRequest(new { error = $"Invalid POI type: {type}" });

        // ── Cache check (rounded to 3dp ≈ 110m for good hit rate) ─────────────
        var cacheKey = $"poi_{type}_{Math.Round(south, 3)}_{Math.Round(west, 3)}" +
                       $"_{Math.Round(north, 3)}_{Math.Round(east, 3)}";

        if (_cache.TryGetValue(cacheKey, out string? cachedJson))
        {
            _logger.LogDebug("[POI] Cache HIT for {Type}", type);
            Response.Headers["X-Cache"] = "HIT";
            return Content(cachedJson!, "application/json");
        }

        // ── Concurrency gate ──────────────────────────────────────────────────
        bool acquired = await _overpassSemaphore.WaitAsync(SEMAPHORE_WAIT_MS);
        if (!acquired)
        {
            _logger.LogWarning("[POI] Semaphore timeout for {Type} — returning 429", type);
            Response.Headers["Retry-After"] = "3";
            return StatusCode(429, new { error = "Server busy, retry in 3 seconds" });
        }

        try
        {
            // Double-check cache after acquiring (another thread may have just filled it)
            if (_cache.TryGetValue(cacheKey, out cachedJson))
            {
                Response.Headers["X-Cache"] = "HIT";
                return Content(cachedJson!, "application/json");
            }

            var parts = tag.Split('=');
            var key = parts[0];
            var value = parts[1];

            var query = $@"[out:json][timeout:{OVERPASS_TIMEOUT_S}];
(
  node[""{key}""=""{value}""]({south},{west},{north},{east});
  way[""{key}""=""{value}""]({south},{west},{north},{east});
  relation[""{key}""=""{value}""]({south},{west},{north},{east});
);
out center 50;";

            _logger.LogInformation("[POI] Querying Overpass for {Type} bounds {S},{W},{N},{E}",
                type, Math.Round(south, 3), Math.Round(west, 3),
                Math.Round(north, 3), Math.Round(east, 3));

            // Use "OverpassClient" registered in Program.cs with 25s timeout + User-Agent
            var client = _httpClientFactory.CreateClient("OverpassClient");

            using var cts = new CancellationTokenSource(
                TimeSpan.FromSeconds(OVERPASS_TIMEOUT_S + 2));

            HttpResponseMessage response;
            try
            {
                var body = new StringContent(
                    $"data={Uri.EscapeDataString(query)}",   // ← correct form encoding
                    Encoding.UTF8,
                    "application/x-www-form-urlencoded");

                response = await client.PostAsync(
                    "https://overpass-api.de/api/interpreter", body, cts.Token);
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[POI] Network error reaching Overpass for {Type}", type);
                return StatusCode(502, new { error = "Cannot reach Overpass API: " + httpEx.Message });
            }

            _logger.LogInformation("[POI] Overpass responded {Status} for {Type}",
                (int)response.StatusCode, type);

            if (!response.IsSuccessStatusCode)
            {
                if ((int)response.StatusCode == 429)
                    Response.Headers["Retry-After"] = "5";

                var errBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[POI] Overpass error {Status} for {Type}: {Body}",
                    (int)response.StatusCode, type, errBody[..Math.Min(200, errBody.Length)]);

                return StatusCode((int)response.StatusCode,
                    new { error = $"Overpass returned {(int)response.StatusCode}" });
            }

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
            if (!contentType.Contains("json"))
            {
                var preview = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[POI] Unexpected content-type '{CT}' for {Type}. Preview: {P}",
                    contentType, type, preview[..Math.Min(300, preview.Length)]);
                return StatusCode(502, new { error = $"Overpass returned non-JSON: {contentType}" });
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);

            // ── FIX: must set Size when SizeLimit is configured on the cache ──
            // Without Size, .NET throws InvalidOperationException at runtime,
            // which was causing the 500 errors.
            _cache.Set(cacheKey, json, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CACHE_MINUTES),
                SlidingExpiration = TimeSpan.FromMinutes(CACHE_MINUTES / 2),
                Size = 1  // required when SizeLimit is set
            });

            _logger.LogInformation("[POI] Cached {Type} result ({Len} bytes)", type, json.Length);
            Response.Headers["X-Cache"] = "MISS";
            return Content(json, "application/json");
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[POI] Overpass timed out for {Type}", type);
            return StatusCode(504, new { error = "Overpass request timed out" });
        }
        catch (Exception ex)
        {
            // Log the FULL exception so you can see the real crash reason in terminal
            _logger.LogError(ex, "[POI] Unhandled exception for {Type}: {Message}", type, ex.Message);
            return StatusCode(500, new { error = ex.Message, detail = ex.GetType().Name });
        }
        finally
        {
            _overpassSemaphore.Release();
        }
    }
}