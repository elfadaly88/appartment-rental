namespace RentalsPlatform.Domain.Enums;

public enum BookingStatus
{
    Pending = 1,    // مستني موافقة المالك أو الدفع
    Confirmed = 2,  // تم الدفع والتأكيد
    Cancelled = 3,  // تم الإلغاء
    Completed = 4,  // العميل غادر الشقة بنجاح
    HostBlocked = 5  // المالك قام بحظر التاريخ على التقويم
}