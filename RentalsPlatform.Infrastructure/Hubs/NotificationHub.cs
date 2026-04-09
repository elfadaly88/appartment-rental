using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace RentalsPlatform.Infrastructure.Hubs;

// بنضيف Authorize عشان نضمن إن المالك مسجل دخول عشان يقدر يفتح الاتصال
[Authorize]
public class NotificationHub : Hub
{
    // الـ Hub هنا فاضي لأننا بنستخدمه للـ Server-to-Client push فقط.
    // مش محتاجين العميل يبعت حاجة للسيرفر من خلاله في المرحلة دي.
}