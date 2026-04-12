using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RentalsPlatform.Domain.Entities;

namespace RentalsPlatform.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Property> Properties { get; set; }
    public DbSet<PropertyPriceRule> PropertyPriceRules { get; set; }
    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<Country> Countries { get; set; }
    public DbSet<Governorate> Governorates { get; set; }
    public DbSet<City> Cities { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<PushSubscription> PushSubscriptions { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<UnavailableDate> UnavailableDates { get; set; }
    public DbSet<PropertyImage> PropertyImages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.PaymobSubMerchantId).HasMaxLength(100);
            entity.Property(u => u.BankAccountNumber).HasMaxLength(100);
        });

        modelBuilder.Entity<Property>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Status).IsRequired();
            entity.Property(p => p.RejectionReason).HasMaxLength(500);
            entity.Property(p => p.SubmittedAt).IsRequired();
            entity.Property(p => p.BasePricePerNight).HasColumnType("numeric(18,2)").IsRequired();

            entity.HasMany(p => p.PropertyPriceRules)
                .WithOne(r => r.Property)
                .HasForeignKey(r => r.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.Bookings)
                .WithOne(b => b.Property)
                .HasForeignKey(b => b.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.UnavailableDates)
                .WithOne()
                .HasForeignKey(u => u.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.PropertyImages)
                .WithOne()
                .HasForeignKey(i => i.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.OwnsOne(p => p.PricePerNight, priceBuilder =>
            {
                priceBuilder.Property(m => m.Amount)
                    .HasColumnName("PriceAmount")
                    .HasColumnType("numeric(18,2)");

                priceBuilder.Property(m => m.Currency)
                    .HasColumnName("PriceCurrency")
                    .HasMaxLength(3);
            });

            entity.OwnsOne(p => p.Location, addressBuilder =>
            {
                addressBuilder.Property(a => a.Country).HasColumnName("Country");
                addressBuilder.Property(a => a.City).HasColumnName("City");
                addressBuilder.Property(a => a.Street).HasColumnName("Street");
                addressBuilder.Property(a => a.ZipCode).HasColumnName("ZipCode");
                addressBuilder.Property(a => a.MapUrl).HasColumnName("MapUrl");
            });

            entity.OwnsOne(p => p.Name, n =>
            {
                n.Property(x => x.Ar).HasColumnName("NameAr").IsRequired();
                n.Property(x => x.En).HasColumnName("NameEn").IsRequired();
            });

            entity.OwnsOne(p => p.Description, d =>
            {
                d.Property(x => x.Ar).HasColumnName("DescriptionAr").IsRequired();
                d.Property(x => x.En).HasColumnName("DescriptionEn").IsRequired();
            });
        });

        modelBuilder.Entity<Property>()
            .Property(p => p.Version)
            .IsConcurrencyToken();

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(t => t.Id);

            entity.OwnsOne(t => t.TotalAmount, a =>
            {
                a.Property(m => m.Amount).HasColumnName("TotalAmount").HasColumnType("numeric(18,2)");
                a.Property(m => m.Currency).HasColumnName("TotalCurrency").HasMaxLength(3);
            });

            entity.OwnsOne(t => t.PlatformFee, a =>
            {
                a.Property(m => m.Amount).HasColumnName("PlatformFeeAmount").HasColumnType("numeric(18,2)");
                a.Property(m => m.Currency).HasColumnName("PlatformFeeCurrency").HasMaxLength(3);
            });

            entity.OwnsOne(t => t.HostPayout, a =>
            {
                a.Property(m => m.Amount).HasColumnName("HostPayoutAmount").HasColumnType("numeric(18,2)");
                a.Property(m => m.Currency).HasColumnName("HostPayoutCurrency").HasMaxLength(3);
            });
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasKey(b => b.Id);

            entity.Property(b => b.StartDate).IsRequired();
            entity.Property(b => b.EndDate).IsRequired();
            entity.Property(b => b.Reason).HasMaxLength(500);
            entity.Property(b => b.PaymobOrderId).HasMaxLength(100);
            entity.Property(b => b.PaymentStatus).IsRequired();

            entity.HasOne(b => b.Property)
                .WithMany(p => p.Bookings)
                .HasForeignKey(b => b.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.OwnsOne(b => b.TotalPrice, price =>
            {
                price.Property(m => m.Amount).HasColumnName("TotalPriceAmount").HasColumnType("numeric(18,2)");
                price.Property(m => m.Currency).HasColumnName("TotalPriceCurrency").HasMaxLength(3);
            });
        });

        modelBuilder.Entity<Country>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.NameAr).IsRequired().HasMaxLength(100);
            entity.Property(c => c.NameEn).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<Governorate>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.Property(g => g.NameAr).IsRequired().HasMaxLength(100);
            entity.Property(g => g.NameEn).IsRequired().HasMaxLength(100);

            entity.HasOne(g => g.Country)
                .WithMany(c => c.Governorates)
                .HasForeignKey(g => g.CountryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<City>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.NameAr).IsRequired().HasMaxLength(100);
            entity.Property(c => c.NameEn).IsRequired().HasMaxLength(100);

            entity.HasOne(c => c.Governorate)
                .WithMany(g => g.Cities)
                .HasForeignKey(c => c.GovernorateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(n => n.Id);
            entity.Property(n => n.UserId).IsRequired().HasMaxLength(450);
            entity.Property(n => n.Title).IsRequired().HasMaxLength(200);
            entity.Property(n => n.Message).IsRequired().HasMaxLength(2000);
            entity.Property(n => n.TargetLink).IsRequired().HasMaxLength(500);
            entity.Property(n => n.CreatedAt).IsRequired();
            entity.Property(n => n.IsRead).IsRequired();

            entity.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
        });

        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.UserId).IsRequired().HasMaxLength(450);
            entity.Property(p => p.Endpoint).IsRequired().HasMaxLength(2000);
            entity.Property(p => p.P256dh).IsRequired().HasMaxLength(500);
            entity.Property(p => p.Auth).IsRequired().HasMaxLength(500);

            entity.HasIndex(p => new { p.UserId, p.Endpoint }).IsUnique();
        });

        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.GuestId).IsRequired().HasMaxLength(450);
            entity.Property(r => r.Rating).IsRequired();
            entity.Property(r => r.Comment).IsRequired().HasMaxLength(1000);
            entity.Property(r => r.CreatedAt).IsRequired();

            entity.HasIndex(r => r.BookingId).IsUnique();

            entity.HasOne<Booking>()
                .WithOne(b => b.Review)
                .HasForeignKey<Review>(r => r.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UnavailableDate>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.StartDate).IsRequired();
            entity.Property(u => u.EndDate).IsRequired();
            entity.Property(u => u.Reason).HasMaxLength(200);
            entity.HasIndex(u => new { u.PropertyId, u.StartDate, u.EndDate });
        });

        modelBuilder.Entity<PropertyImage>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.Property(i => i.Url).IsRequired().HasMaxLength(2000);
            entity.Property(i => i.PublicId).IsRequired().HasMaxLength(500);
            entity.Property(i => i.IsMain).IsRequired();
            entity.HasIndex(i => new { i.PropertyId, i.IsMain });
        });

        modelBuilder.Entity<Country>().HasData(
            new Country { Id = 1, NameAr = "مصر", NameEn = "Egypt" }
        );

        modelBuilder.Entity<Governorate>().HasData(
            new Governorate { Id = 1, CountryId = 1, NameAr = "القاهرة", NameEn = "Cairo" },
            new Governorate { Id = 2, CountryId = 1, NameAr = "الجيزة", NameEn = "Giza" },
            new Governorate { Id = 3, CountryId = 1, NameAr = "الإسكندرية", NameEn = "Alexandria" }
        );

        modelBuilder.Entity<City>().HasData(
            new City { Id = 1, GovernorateId = 1, NameAr = "مدينة نصر", NameEn = "Nasr City" },
            new City { Id = 2, GovernorateId = 1, NameAr = "المعادي", NameEn = "Maadi" },
            new City { Id = 3, GovernorateId = 1, NameAr = "التجمع الخامس", NameEn = "New Cairo" },

            new City { Id = 4, GovernorateId = 2, NameAr = "الدقي", NameEn = "Dokki" },
            new City { Id = 5, GovernorateId = 2, NameAr = "المهندسين", NameEn = "Mohandessin" },
            new City { Id = 6, GovernorateId = 2, NameAr = "الشيخ زايد", NameEn = "Sheikh Zayed" },
            new City { Id = 7, GovernorateId = 2, NameAr = "6 أكتوبر", NameEn = "6th of October" },

            new City { Id = 8, GovernorateId = 3, NameAr = "سموحة", NameEn = "Smouha" },
            new City { Id = 9, GovernorateId = 3, NameAr = "سيدي جابر", NameEn = "Sidi Gaber" },
            new City { Id = 10, GovernorateId = 3, NameAr = "العجمي", NameEn = "Agami" },
            new City { Id = 11, GovernorateId = 3, NameAr = "المنتزه", NameEn = "Montaza" }
        );

        modelBuilder.Entity<PropertyPriceRule>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.StartDate).IsRequired();
            entity.Property(r => r.EndDate).IsRequired();
            entity.Property(r => r.CustomPricePerNight).HasColumnType("numeric(18,2)").IsRequired();
            entity.HasIndex(r => new { r.PropertyId, r.StartDate, r.EndDate });
        });
    }
}