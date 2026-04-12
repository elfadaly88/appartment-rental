using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalsPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakePropertyPricingNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ServiceFeePercentage",
                table: "Properties",
                type: "numeric(5,2)",
                nullable: true,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxPercentage",
                table: "Properties",
                type: "numeric(5,2)",
                nullable: true,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServiceFeePercentage",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "TaxPercentage",
                table: "Properties");
        }
    }
}
