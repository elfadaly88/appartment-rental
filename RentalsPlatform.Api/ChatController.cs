using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Api.Chat;
using RentalsPlatform.Api.Controllers;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Api;

[ApiController]
[Authorize]
[Route("api/chat")]
public sealed class ChatController : BaseController
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IChatMessageStore _chatMessageStore;

    public ChatController(ApplicationDbContext dbContext, IChatMessageStore chatMessageStore)
    {
        _dbContext = dbContext;
        _chatMessageStore = chatMessageStore;
    }

    [HttpGet("bookings/{bookingId:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<ChatMessageDto>>> GetMessages([FromRoute] Guid bookingId)
    {
        if (!CurrentUserId.HasValue)
        {
            return Unauthorized();
        }

        var participantInfo = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.Id == bookingId)
            .Select(b => new
            {
                GuestId = b.GuestId,
                HostId = b.Property.HostId,
            })
            .FirstOrDefaultAsync();

        if (participantInfo is null)
        {
            return NotFound();
        }

        var userId = CurrentUserId.Value;
        var isParticipant = userId == participantInfo.GuestId || userId == participantInfo.HostId;
        if (!isParticipant)
        {
            return Forbid();
        }

        var messages = _chatMessageStore.GetByBookingId(bookingId);
        return Ok(messages);
    }
}
