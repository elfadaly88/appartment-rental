using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalsPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingApprovedAtAndNewStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "Bookings");
        }
    }
}
