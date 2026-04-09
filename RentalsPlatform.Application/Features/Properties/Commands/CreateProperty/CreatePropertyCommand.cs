using MediatR;

namespace RentalsPlatform.Application.Features.Properties.Commands.CreateProperty;

// الـ record هنا ممتاز لأنه Read-only.
// بنعمل Implement لـ IRequest<Guid> عشان نقول إن الأمر ده لما يخلص، هيرجع ID الشقة الجديدة.
public record CreatePropertyCommand(
    Guid HostId,
    string Name,
    string Description,
    string Country,
    string City,
    string Street,
    string ZipCode,
    decimal PriceAmount,
    string Currency,
    int MaxGuests,string MapUrl) : IRequest<Guid>;