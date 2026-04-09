using EV_Charge_Station.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;

namespace EV_Charge_Station.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> GoogleLoginAsync(string credential);
    Task<AuthResponse> CheckEmailForResetAsync(string email);
    Task<AuthResponse> ResetPasswordAsync(string email, string newPassword);
}

public class AuthService : IAuthService
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly JwtSettings _jwtSettings;

    public AuthService(IOptions<MongoDbSettings> mongoSettings, IOptions<JwtSettings> jwtSettings)
    {
        var mongoClient = new MongoClient(mongoSettings.Value.ConnectionString);
        var mongoDatabase = mongoClient.GetDatabase(mongoSettings.Value.DatabaseName);
        _usersCollection = mongoDatabase.GetCollection<User>("Users");
        _jwtSettings = jwtSettings.Value;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var existingUser = await _usersCollection.Find(u => u.Email == request.Email).FirstOrDefaultAsync();
        if (existingUser != null)
        {
            return new AuthResponse { Success = false, ErrorMessage = "Email already exists." };
        }

        var user = new User
        {
            Name = request.Name,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        await _usersCollection.InsertOneAsync(user);

        var token = GenerateJwtToken(user);
        return new AuthResponse { Success = true, Token = token, User = new UserDto(user) };
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _usersCollection.Find(u => u.Email == request.Email).FirstOrDefaultAsync();
        if (user == null || user.PasswordHash == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return new AuthResponse { Success = false, ErrorMessage = "Invalid email or password." };
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse { Success = true, Token = token, User = new UserDto(user) };
    }

    public async Task<AuthResponse> GoogleLoginAsync(string credential)
    {
        try
        {
            // The "credential" might actually be an access_token when using useGoogleLogin.
            // We verify the token securely by making a request to Google's userinfo endpoint.
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", credential);
            
            var response = await httpClient.GetAsync("https://www.googleapis.com/oauth2/v3/userinfo");
            if (!response.IsSuccessStatusCode)
            {
                return new AuthResponse { Success = false, ErrorMessage = "Invalid Google token." };
            }

            var content = await response.Content.ReadAsStringAsync();
            var payload = System.Text.Json.JsonDocument.Parse(content).RootElement;
            
            var email = payload.GetProperty("email").GetString()!;
            var name = payload.GetProperty("name").GetString()!;
            var subject = payload.GetProperty("sub").GetString()!;

            var user = await _usersCollection.Find(u => u.Email == email).FirstOrDefaultAsync();
            
            if (user == null)
            {
                user = new User
                {
                    Name = name,
                    Email = email,
                    GoogleId = subject,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString())
                };
                await _usersCollection.InsertOneAsync(user);
            }
            else if (user.GoogleId == null)
            {
                user.GoogleId = subject;
                await _usersCollection.ReplaceOneAsync(u => u.Id == user.Id, user);
            }

            var token = GenerateJwtToken(user);
            return new AuthResponse { Success = true, Token = token, User = new UserDto(user) };
        }
        catch (Exception ex)
        {
            return new AuthResponse { Success = false, ErrorMessage = "Error verifying Google login." };
        }
    }

    public async Task<AuthResponse> CheckEmailForResetAsync(string email)
    {
        var user = await _usersCollection.Find(u => u.Email == email).FirstOrDefaultAsync();
        if (user == null)
            return new AuthResponse { Success = false, ErrorMessage = "No account found with this email." };

        if (!string.IsNullOrEmpty(user.GoogleId))
            return new AuthResponse { Success = false, ErrorMessage = "This account uses Google Sign-In. Password reset is not available." };

        return new AuthResponse { Success = true };
    }

    public async Task<AuthResponse> ResetPasswordAsync(string email, string newPassword)
    {
        var user = await _usersCollection.Find(u => u.Email == email).FirstOrDefaultAsync();
        if (user == null)
            return new AuthResponse { Success = false, ErrorMessage = "Account not found." };

        if (!string.IsNullOrEmpty(user.GoogleId))
            return new AuthResponse { Success = false, ErrorMessage = "Cannot reset password for a Google account." };

        var update = Builders<User>.Update.Set(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(newPassword));
        await _usersCollection.UpdateOneAsync(u => u.Id == user.Id, update);

        return new AuthResponse { Success = true };
    }

    private string GenerateJwtToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id!),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("Name", user.Name)
        };

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.Now.AddMinutes(_jwtSettings.ExpiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record RegisterRequest(string Name, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record GoogleLoginRequest(string Credential);
public record CheckEmailRequest(string Email);
public record ResetPasswordRequest(string Email, string NewPassword);

public class AuthResponse
{
    public bool Success { get; set; }
    public string? Token { get; set; }
    public UserDto? User { get; set; }
    public string? ErrorMessage { get; set; }
}

public class UserDto
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }

    public UserDto(User user)
    {
        Id = user.Id!;
        Name = user.Name;
        Email = user.Email;
    }
}
