using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RentalsPlatform.Infrastructure.Data;

// الكلاس ده بيشتغل بس وقت ما بنكتب أوامر dotnet ef في الـ Terminal
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<ApplicationDbContext>();

        // بنحط الـ Connection String هنا بشكل مباشر عشان الـ Migrations تشتغل بدون مشاكل
        builder.UseNpgsql("Host=localhost;Port=5444;Database=RentalsDb;Username=admin;Password=secret;");

        return new ApplicationDbContext(builder.Options);
    }
}