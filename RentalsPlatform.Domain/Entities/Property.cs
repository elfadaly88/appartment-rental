using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Domain.ValueObjects;

namespace RentalsPlatform.Domain.Entities;

public class Property
{
    // الـ ID الخاص بالشقة
    public Guid Id { get; private set; }

    // الـ ID بتاع المالك (Host)
    public Guid HostId { get; private set; }

    public LocalizedText Name { get; private set; }
    public LocalizedText Description { get; private set; }

    // استخدام الـ Value Objects اللي عملناها
    public Address Location { get; private set; }
    public Money PricePerNight { get; private set; }
    public decimal BasePricePerNight { get; private set; }

    public int MaxGuests { get; private set; }
    public PropertyStatus Status { get; private set; } // تحديث هنا لإضافة الحالة
    public string? RejectionReason { get; private set; } // السبب في حالة الرفض
    public DateTime SubmittedAt { get; private set; } // تاريخ ووقت التقديم
    public Guid Version { get; private set; }

    public ICollection<PropertyPriceRule> PropertyPriceRules { get; private set; } = new List<PropertyPriceRule>();
    public ICollection<Booking> Bookings { get; private set; } = new List<Booking>();
    public ICollection<UnavailableDate> UnavailableDates { get; private set; } = new List<UnavailableDate>();
    public ICollection<PropertyImage> PropertyImages { get; private set; } = new List<PropertyImage>();

    // Constructor فاضي عشان الـ Entity Framework Core محتاجه (لازم يكون private أو protected)
    private Property() { }

    // الـ Constructor اللي هنستخدمه وقت إنشاء شقة جديدة
    public Property(Guid hostId, LocalizedText name, LocalizedText description, Address location, Money pricePerNight, int maxGuests)
    {
        //if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name cannot be empty");
        if (!pricePerNight.IsGreaterThanZero()) throw new ArgumentException("Price must be greater than zero");

        Id = Guid.NewGuid();
        HostId = hostId;
        Name = name;
        Description = description;
        Location = location;
        PricePerNight = pricePerNight;
        BasePricePerNight = pricePerNight.Amount;
        MaxGuests = maxGuests;
        Status = PropertyStatus.Pending; // الحالة الافتراضية تكون Pending
        RejectionReason = null;
        SubmittedAt = DateTime.UtcNow; // تسجيل وقت التقديم
    }

    // Business Behavior: دالة لتغيير السعر
    public void UpdatePrice(Money newPrice)
    {
        if (!newPrice.IsGreaterThanZero())
            throw new ArgumentException("New price must be valid");

        PricePerNight = newPrice;
        BasePricePerNight = newPrice.Amount;
    }

    public void UpdateDetails(LocalizedText name, LocalizedText description, Address location, Money newPrice, int maxGuests)
    {
        if (maxGuests <= 0)
            throw new ArgumentException("Max guests must be greater than zero.");

        Name = name;
        Description = description;
        Location = location;
        MaxGuests = maxGuests;
        UpdatePrice(newPrice);
        Version = Guid.NewGuid();

        if (Status == PropertyStatus.Rejected)
        {
            Status = PropertyStatus.Pending;
            RejectionReason = null;
            SubmittedAt = DateTime.UtcNow;
        }
    }

    // Business Behavior: دالة لموافقة الـ Admin على الشقة
    public void Approve()
    {
        Status = PropertyStatus.Approved;
        RejectionReason = null; // إلغاء سبب الرفض في حالة القبول
    }

    // Business Behavior: دالة لرفض الشقة مع توضيح السبب
    public void Reject(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.");

        Status = PropertyStatus.Rejected;
        RejectionReason = reason.Trim(); // حفظ سبب الرفض
    }

    public void MarkAsBooked()
    {
        Version = Guid.NewGuid();
    }
}