using System.Collections.Concurrent;

namespace EV_Charge_Station.Services;

/// <summary>
/// In-memory session manager for Social Sync.
/// All data lives in RAM — automatically cleaned when sessions end.
/// </summary>
public class SocialSyncService
{
    // OTP → Session
    private readonly ConcurrentDictionary<string, SyncSession> _sessions = new();

    // ConnectionId → OTP (reverse lookup for disconnect cleanup)
    private readonly ConcurrentDictionary<string, string> _connectionToOtp = new();

    /// <summary>Generate a unique 6-digit OTP and create a session.</summary>
    public string CreateSession(string connectionId, string userId, string userName)
    {
        string otp;
        var rng = new Random();
        do
        {
            otp = rng.Next(100000, 999999).ToString();
        } while (_sessions.ContainsKey(otp));

        var session = new SyncSession
        {
            Otp = otp,
            HostConnectionId = connectionId,
            HostUserId = userId,
            HostUserName = userName,
            CreatedAt = DateTime.UtcNow
        };

        _sessions[otp] = session;
        _connectionToOtp[connectionId] = otp;
        return otp;
    }

    /// <summary>Join an existing session by OTP.</summary>
    public (bool success, SyncSession? session) JoinSession(string otp, string connectionId, string userId, string userName)
    {
        if (!_sessions.TryGetValue(otp, out var session))
            return (false, null);

        if (session.GuestConnectionId != null)
            return (false, null); // already full

        session.GuestConnectionId = connectionId;
        session.GuestUserId = userId;
        session.GuestUserName = userName;
        _connectionToOtp[connectionId] = otp;
        return (true, session);
    }

    /// <summary>Get session by OTP.</summary>
    public SyncSession? GetSession(string otp)
    {
        _sessions.TryGetValue(otp, out var session);
        return session;
    }

    /// <summary>Get the OTP for a connection.</summary>
    public string? GetOtpForConnection(string connectionId)
    {
        _connectionToOtp.TryGetValue(connectionId, out var otp);
        return otp;
    }

    /// <summary>Get the peer's ConnectionId for a given connection.</summary>
    public string? GetPeerConnectionId(string connectionId)
    {
        var otp = GetOtpForConnection(connectionId);
        if (otp == null) return null;

        var session = GetSession(otp);
        if (session == null) return null;

        return session.HostConnectionId == connectionId
            ? session.GuestConnectionId
            : session.HostConnectionId;
    }

    /// <summary>Remove a session and clean up both sides.</summary>
    public SyncSession? RemoveSession(string connectionId)
    {
        var otp = GetOtpForConnection(connectionId);
        if (otp == null) return null;

        _sessions.TryRemove(otp, out var session);

        if (session != null)
        {
            if (session.HostConnectionId != null)
                _connectionToOtp.TryRemove(session.HostConnectionId, out _);
            if (session.GuestConnectionId != null)
                _connectionToOtp.TryRemove(session.GuestConnectionId, out _);
        }

        return session;
    }
}

/// <summary>Represents an active Social Sync session.</summary>
public class SyncSession
{
    public string Otp { get; set; } = "";

    public string HostConnectionId { get; set; } = "";
    public string HostUserId { get; set; } = "";
    public string HostUserName { get; set; } = "";

    public string? GuestConnectionId { get; set; }
    public string? GuestUserId { get; set; }
    public string? GuestUserName { get; set; }

    public DateTime CreatedAt { get; set; }

    public object? Destination { get; set; }
}
