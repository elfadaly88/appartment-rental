namespace RentalsPlatform.Domain.Enums;

public enum BookingStatus
{
    Pending = 1,      // بانتظار موافقة المالك
    Confirmed = 2,    // تم الدفع والتأكيد
    Cancelled = 3,    // تم الإلغاء
    Completed = 4,    // العميل غادر الشقة بنجاح
    HostBlocked = 5,  // المالك قام بحظر التاريخ على التقويم
    Approved = 6,     // المالك وافق – بانتظار دفع الضيف (نافذة 24 ساعة)
    Expired = 7       // انتهت نافذة الدفع وأُفرجت الأيام
}