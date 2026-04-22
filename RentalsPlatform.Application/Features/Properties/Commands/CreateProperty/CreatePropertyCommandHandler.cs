using MediatR;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.ValueObjects;

namespace RentalsPlatform.Application.Features.Properties.Commands.CreateProperty;

public class CreatePropertyCommandHandler : IRequestHandler<CreatePropertyCommand, Guid>
{
    private readonly IPropertyRepository _propertyRepository;
    private readonly INotificationService _notificationService;

    // بنحقن الـ Interface مش الـ DbContext
    public CreatePropertyCommandHandler(IPropertyRepository propertyRepository, INotificationService notificationService)
    {
        _propertyRepository = propertyRepository;
        _notificationService = notificationService;
    }

    public async Task<Guid> Handle(CreatePropertyCommand request, CancellationToken cancellationToken)
    {
        // 1. بناء كائنات القيمة (Value Objects)
        var location = new Address(request.Country, request.City, request.Street, request.ZipCode, request.MapUrl);
        var price = new Money(request.PriceAmount, request.Currency);
        var name = new LocalizedText(request.Name, request.Name);
        var description = new LocalizedText(request.Description, request.Description);

        // 2. بناء كيان الشقة (Entity) 
        // لاحظ إن الـ Constructor بتاع الـ Property بيحمي نفسه من أي داتا غلط
        var property = new Property(
            request.HostId,
            name,
            description,
            location,
            price,
            request.MaxGuests);

        // 3. الحفظ في الداتابيز
        await _propertyRepository.AddAsync(property, cancellationToken);
        await _propertyRepository.SaveChangesAsync(cancellationToken);

        await _notificationService.NotifyGroupAsync("Admins", "ReceiveNotification", new
        {
            id = Guid.NewGuid().ToString(),
            title = "New Property Submission",
            message = $"Host submitted '{request.Name}' for review.",
            createdAt = DateTime.UtcNow.ToString("O"),
            propertyName = request.Name,
            hostId = request.HostId
        });

        // 4. إرجاع الـ ID عشان الفرانتد يقدر يحول المستخدم لصفحة الشقة
        return property.Id;
    }
}