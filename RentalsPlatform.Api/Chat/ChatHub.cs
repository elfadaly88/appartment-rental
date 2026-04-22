using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Api.Chat;

[Authorize]
public sealed class ChatHub : Hub
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IChatMessageStore _chatMessageStore;

    public ChatHub(ApplicationDbContext dbContext, IChatMessageStore chatMessageStore)
    {
        _dbContext = dbContext;
        _chatMessageStore = chatMessageStore;
    }

    public async Task SendMessage(string bookingId, string receiverId, string content)
    {
        if (!Guid.TryParse(bookingId, out var parsedBookingId))
        {
            throw new HubException("Invalid booking id.");
        }

        if (!Guid.TryParse(receiverId, out var parsedReceiverId))
        {
            throw new HubException("Invalid receiver id.");
        }

        var senderId = ReadCurrentUserId() ?? throw new HubException("Unauthorized.");

        var participantInfo = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Id == parsedBookingId)
            .Select(b => new
            {
                GuestId = b.GuestId,
                HostId = b.Property.HostId,
            })
            .FirstOrDefaultAsync();

        if (participantInfo is null)
        {
            throw new HubException("Booking not found.");
        }

        var senderIsParticipant = senderId == participantInfo.GuestId || senderId == participantInfo.HostId;
        var receiverIsParticipant = parsedReceiverId == participantInfo.GuestId || parsedReceiverId == participantInfo.HostId;

        if (!senderIsParticipant || !receiverIsParticipant)
        {
            throw new HubException("You are not allowed to chat for this booking.");
        }

        var text = content.Trim();
        if (string.IsNullOrEmpty(text))
        {
            throw new HubException("Message cannot be empty.");
        }

        var sender = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == senderId.ToString())
            .Select(u => new
            {
                u.DisplayName,
                u.FullName,
                u.AvatarUrl,
                u.ProfilePictureUrl,
            })
            .FirstOrDefaultAsync();

        var senderName = sender?.DisplayName;
        if (string.IsNullOrWhiteSpace(senderName))
        {
            senderName = sender?.FullName;
        }

        var senderAvatarUrl = sender?.AvatarUrl;
        if (string.IsNullOrWhiteSpace(senderAvatarUrl))
        {
            senderAvatarUrl = sender?.ProfilePictureUrl;
        }

        var message = new ChatMessageDto(
            Id: Guid.NewGuid().ToString(),
            BookingId: parsedBookingId.ToString(),
            SenderId: senderId.ToString(),
            ReceiverId: parsedReceiverId.ToString(),
            Content: text,
            SentAt: DateTime.UtcNow.ToString("O"),
            SenderName: string.IsNullOrWhiteSpace(senderName) ? null : senderName,
            SenderAvatarUrl: string.IsNullOrWhiteSpace(senderAvatarUrl) ? null : senderAvatarUrl
        );

        _chatMessageStore.Add(message);

        await Clients.Users(senderId.ToString(), parsedReceiverId.ToString())
            .SendAsync("ReceiveMessage", message);
    }

    private Guid? ReadCurrentUserId()
    {
        var raw = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(raw, out var parsed))
        {
            return parsed;
        }

        return null;
    }
}
