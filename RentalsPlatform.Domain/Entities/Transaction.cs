using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.ValueObjects;

namespace RentalsPlatform.Domain.Entities;

public class Transaction
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }

    // الفلوس اللي دفعها العميل
    public Money TotalAmount { get; private set; }

    // مكسب المنصة
    public Money PlatformFee { get; private set; }

    // مستحقات المالك
    public Money HostPayout { get; private set; }

    public TransactionStatus Status { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime? SettledOnUtc { get; private set; }

    // نسبة عمولة المنصة (مثلاً 10%)
    private const decimal PLATFORM_COMMISSION_RATE = 0.10m;

    private Transaction() { }

    public Transaction(Guid bookingId, Money totalAmount)
    {
        Id = Guid.NewGuid();
        BookingId = bookingId;
        TotalAmount = totalAmount;
        Status = TransactionStatus.Pending;
        CreatedOnUtc = DateTime.UtcNow;

        CalculateSplit();
    }

    // الدالة دي بتحسب التقسيمة بشكل صارم
    private void CalculateSplit()
    {
        // حساب عمولتك
        decimal fee = TotalAmount.Amount * PLATFORM_COMMISSION_RATE;
        PlatformFee = new Money(fee, TotalAmount.Currency);

        // حساب الباقي للمالك
        decimal payout = TotalAmount.Amount - fee;
        HostPayout = new Money(payout, TotalAmount.Currency);
    }

    // العميل دفع بالفيزا
    public void MarkAsHeldInEscrow()
    {
        if (Status != TransactionStatus.Pending)
            throw new InvalidOperationException("Can only hold pending transactions.");

        Status = TransactionStatus.HeldInEscrow;
    }

    // العميل استلم الشقة ومفيش مشاكل
    public void ReleaseToHost()
    {
        if (Status != TransactionStatus.HeldInEscrow)
            throw new InvalidOperationException("Transaction is not in escrow.");

        Status = TransactionStatus.PayoutReady;
    }

    // تم التحويل البنكي للمالك
    public void MarkAsSettled()
    {
        if (Status != TransactionStatus.PayoutReady)
            throw new InvalidOperationException("Only ready payouts can be settled.");

        Status = TransactionStatus.Settled;
        SettledOnUtc = DateTime.UtcNow;
    }
}