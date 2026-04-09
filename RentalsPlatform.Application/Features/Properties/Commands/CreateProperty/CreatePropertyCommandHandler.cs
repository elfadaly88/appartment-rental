using MediatR;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.ValueObjects;

namespace RentalsPlatform.Application.Features.Properties.Commands.CreateProperty;

public class CreatePropertyCommandHandler : IRequestHandler<CreatePropertyCommand, Guid>
{
    private readonly IPropertyRepository _propertyRepository;

    // بنحقن الـ Interface مش الـ DbContext
    public CreatePropertyCommandHandler(IPropertyRepository propertyRepository)
    {
        _propertyRepository = propertyRepository;
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

        // 4. إرجاع الـ ID عشان الفرانتد يقدر يحول المستخدم لصفحة الشقة
        return property.Id;
    }
}