using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RentalsPlatform.Infrastructure.Hubs;

// بنضيف Authorize عشان نضمن إن المالك مسجل دخول عشان يقدر يفتح الاتصال
[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        }

        if (Context.User != null && Context.User.IsInRole("Admin"))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
        }
        else if (Context.User != null && Context.User.IsInRole("Host"))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Hosts");
        }

        await base.OnConnectedAsync();
    }
}