using Microsoft.AspNetCore.SignalR;
using EV_Charge_Station.Services;

namespace EV_Charge_Station.Hubs;

/// <summary>
/// SignalR Hub for Social Sync — real-time collaborative EV travel.
/// Handles OTP session creation/joining, live location, and messaging.
/// </summary>
public class SocialSyncHub : Hub
{
    private readonly SocialSyncService _syncService;

    public SocialSyncHub(SocialSyncService syncService)
    {
        _syncService = syncService;
    }

    // ───────────────────────────────────────────────────────────
    //  SESSION MANAGEMENT
    // ───────────────────────────────────────────────────────────

    /// <summary>Host creates a new session and receives a 6-digit OTP.</summary>
    public async Task CreateSession(string userId, string userName)
    {
        var otp = _syncService.CreateSession(Context.ConnectionId, userId, userName);
        await Clients.Caller.SendAsync("SessionCreated", otp);
    }

    /// <summary>Guest joins a session using the OTP.</summary>
    public async Task JoinSession(string otp, string userId, string userName)
    {
        var (success, session) = _syncService.JoinSession(otp, Context.ConnectionId, userId, userName);

        if (!success || session == null)
        {
            await Clients.Caller.SendAsync("JoinFailed", "Invalid or expired OTP, or session is already full.");
            return;
        }

        // Notify the guest that they joined successfully
        await Clients.Caller.SendAsync("SessionJoined", new
        {
            otp = session.Otp,
            peerName = session.HostUserName,
            peerId = session.HostUserId,
            destination = session.Destination
        });

        // Notify the host that a peer joined
        await Clients.Client(session.HostConnectionId).SendAsync("PeerJoined", new
        {
            peerName = userName,
            peerId = userId
        });
    }

    // ───────────────────────────────────────────────────────────
    //  LIVE LOCATION
    // ───────────────────────────────────────────────────────────

    /// <summary>Broadcast current location to peer.</summary>
    public async Task UpdateLocation(double lat, double lng)
    {
        var peerId = _syncService.GetPeerConnectionId(Context.ConnectionId);
        if (peerId == null) return;

        await Clients.Client(peerId).SendAsync("LocationUpdated", new { lat, lng });
    }

    /// <summary>Sync the chosen destination to the peer.</summary>
    public async Task UpdateDestination(object destination)
    {
        var otp = _syncService.GetOtpForConnection(Context.ConnectionId);
        if (otp != null)
        {
            var session = _syncService.GetSession(otp);
            if (session != null) session.Destination = destination;
        }

        var peerId = _syncService.GetPeerConnectionId(Context.ConnectionId);
        if (peerId != null)
        {
            await Clients.Client(peerId).SendAsync("DestinationUpdated", destination);
        }
    }

    // ───────────────────────────────────────────────────────────
    //  MESSAGING
    // ───────────────────────────────────────────────────────────

    /// <summary>Send a text message to peer.</summary>
    public async Task SendMessage(string message)
    {
        var peerId = _syncService.GetPeerConnectionId(Context.ConnectionId);
        if (peerId == null) return;

        // Also look up the sender's name
        var otp = _syncService.GetOtpForConnection(Context.ConnectionId);
        var session = otp != null ? _syncService.GetSession(otp) : null;
        var senderName = session?.HostConnectionId == Context.ConnectionId
            ? session.HostUserName
            : session?.GuestUserName ?? "Unknown";

        await Clients.Client(peerId).SendAsync("MessageReceived", new
        {
            sender = senderName,
            text = message,
            timestamp = DateTime.UtcNow
        });
    }

    // ───────────────────────────────────────────────────────────
    //  LEAVE / DISCONNECT
    // ───────────────────────────────────────────────────────────

    /// <summary>Manually leave the current session.</summary>
    public async Task LeaveSession()
    {
        await CleanupConnection(Context.ConnectionId);
    }

    /// <summary>Auto-cleanup when a client disconnects (e.g. tab close).</summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await CleanupConnection(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task CleanupConnection(string connectionId)
    {
        var session = _syncService.RemoveSession(connectionId);
        if (session == null) return;

        // Notify the other side that the session ended
        var otherId = session.HostConnectionId == connectionId
            ? session.GuestConnectionId
            : session.HostConnectionId;

        if (otherId != null)
        {
            await Clients.Client(otherId).SendAsync("SessionEnded", "Your sync partner has left the session.");
        }
    }
}
