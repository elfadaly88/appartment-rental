using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Application.Interfaces;
using RentalsPlatform.Domain.Entities;
using RentalsPlatform.Domain.Enums;
using RentalsPlatform.Infrastructure.Data;

namespace RentalsPlatform.Infrastructure.Repositories;

public class PropertyRepository : IPropertyRepository
{
    private readonly ApplicationDbContext _context;

    public PropertyRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Property property, CancellationToken cancellationToken)
    {
        await _context.Properties.AddAsync(property, cancellationToken);
    }

    public async Task<IEnumerable<Property>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await _context.Properties
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Approved)
            .ToListAsync(cancellationToken);
    }

    public async Task<Property?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return await _context.Properties.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}