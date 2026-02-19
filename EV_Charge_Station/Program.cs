using System.Diagnostics.Metrics;

var builder = WebApplication.CreateBuilder(args);

// 1. CORS — allow React dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// 2. Named HttpClient for Overpass API
//    IMPORTANT: Must be named "OverpassClient" — PoiController calls
//    _httpClientFactory.CreateClient("OverpassClient") specifically.
//    Without this named registration it falls back to a client with NO
//    timeout, causing hangs that hold the semaphore slot indefinitely.
builder.Services.AddHttpClient("OverpassClient", client =>
{
    client.Timeout = TimeSpan.FromSeconds(25); // matches [timeout:20] in query + buffer
    client.DefaultRequestHeaders.Add("User-Agent", "ChargeSaathi/1.0");
    // Overpass API requires a User-Agent header — requests without one may be rejected
});

// 3. Memory cache — NO SizeLimit here.
//    If SizeLimit is set, every _cache.Set() call MUST also set a Size value
//    on the MemoryCacheEntryOptions, otherwise .NET throws InvalidOperationException
//    at runtime → which was the cause of the HTTP 500 errors.
//    The fixed PoiController.cs now sets Size = 1 on each entry, so if you
//    want to re-enable SizeLimit later you can safely uncomment it:
//
//    builder.Services.AddMemoryCache(o => { o.SizeLimit = 500; });
builder.Services.AddMemoryCache();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Middleware order — CORS must come before Authorization
// app.UseHttpsRedirection(); // uncomment in production
app.UseStaticFiles();
app.UseRouting();
app.UseCors("AllowReactApp");
app.UseAuthorization();
app.MapControllers();

app.Run();