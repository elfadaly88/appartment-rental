namespace RentalsPlatform.Domain.Enums;

public enum TransactionStatus
{
    Pending = 1,        // في انتظار الدفع
    HeldInEscrow = 2,   // تم الدفع والفلوس معلقة
    PayoutReady = 3,    // جاهزة للتحويل للمالك
    Settled = 4,        // تم التحويل للمالك بنجاح (نهاية الدورة)
    Refunded = 5        // تم إرجاع الفلوس للعميل (في حالة الإلغاء)
}