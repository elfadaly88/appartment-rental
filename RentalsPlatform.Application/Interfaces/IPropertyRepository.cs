using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Application.Interfaces;

public interface IPropertyRepository
{
    Task AddAsync(Property property, CancellationToken cancellationToken);

    Task<IEnumerable<Property>> GetAllAsync(CancellationToken cancellationToken);

    // لاحظ هنا استخدمنا Property? (بعلامة الاستفهام)
    Task<Property?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}