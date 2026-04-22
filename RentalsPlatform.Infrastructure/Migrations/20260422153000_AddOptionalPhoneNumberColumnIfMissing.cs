using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RentalsPlatform.Infrastructure.Data;

#nullable disable

namespace RentalsPlatform.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260422153000_AddOptionalPhoneNumberColumnIfMissing")]
public partial class AddOptionalPhoneNumberColumnIfMissing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            @"DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AspNetUsers'
          AND column_name = 'PhoneNumber'
    ) THEN
        ALTER TABLE ""AspNetUsers"" ADD COLUMN ""PhoneNumber"" character varying(20) NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AspNetUsers'
          AND column_name = 'PhoneNumber'
    ) THEN
        ALTER TABLE ""AspNetUsers"" ALTER COLUMN ""PhoneNumber"" TYPE character varying(20);
    END IF;
END $$;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            @"DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AspNetUsers'
          AND column_name = 'PhoneNumber'
    ) THEN
        ALTER TABLE ""AspNetUsers"" DROP COLUMN ""PhoneNumber"";
    END IF;
END $$;");
    }
}