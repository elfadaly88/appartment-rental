using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RentalsPlatform.Application.DTOs.Analytics;

namespace RentalsPlatform.Infrastructure.Services;

public class ReportService : IReportService
{
    public ReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public Task<byte[]> GenerateExcelReportAsync(HostAnalyticsDashboardDto data)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Host Analytics");

        worksheet.Cell(1, 1).Value = "Month";
        worksheet.Cell(1, 2).Value = "Year";
        worksheet.Cell(1, 3).Value = "Revenue";

        var headerRange = worksheet.Range(1, 1, 1, 3);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#1F4E78");
        headerRange.Style.Font.FontColor = XLColor.White;

        var row = 2;
        foreach (var item in data.MonthlyRevenues)
        {
            worksheet.Cell(row, 1).Value = item.Month;
            worksheet.Cell(row, 2).Value = item.Year;
            worksheet.Cell(row, 3).Value = item.TotalRevenue;
            worksheet.Cell(row, 3).Style.NumberFormat.Format = "#,##0.00";
            row++;
        }

        worksheet.Cell(row + 1, 1).Value = "Total Earnings";
        worksheet.Cell(row + 1, 2).Value = data.TotalEarnings;
        worksheet.Cell(row + 1, 2).Style.NumberFormat.Format = "#,##0.00";
        worksheet.Cell(row + 2, 1).Value = "Occupancy Rate";
        worksheet.Cell(row + 2, 2).Value = data.OverallOccupancyRate;
        worksheet.Cell(row + 2, 2).Style.NumberFormat.Format = "0.00\\%";

        worksheet.Range(row + 1, 1, row + 2, 2).Style.Font.Bold = true;

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return Task.FromResult(stream.ToArray());
    }

    public Task<byte[]> GeneratePdfReportAsync(HostAnalyticsDashboardDto data)
    {
        var generatedOn = DateTime.UtcNow;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(30);

                page.Header().Column(column =>
                {
                    column.Item().Text("Host Analytics Report")
                        .FontSize(20)
                        .Bold()
                        .FontColor(Colors.Blue.Darken2);

                    column.Item().Text($"Generated at (UTC): {generatedOn:yyyy-MM-dd HH:mm}")
                        .FontSize(10)
                        .FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingVertical(15).Column(column =>
                {
                    column.Spacing(12);

                    column.Item().Text("Monthly Revenue")
                        .FontSize(14)
                        .Bold();

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.ConstantColumn(70);
                            columns.ConstantColumn(120);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(CellStyle).Text("Month").Bold();
                            header.Cell().Element(CellStyle).Text("Year").Bold();
                            header.Cell().Element(CellStyle).AlignRight().Text("Revenue").Bold();

                            static IContainer CellStyle(IContainer container) => container
                                .Background(Colors.Grey.Lighten3)
                                .Padding(6);
                        });

                        foreach (var item in data.MonthlyRevenues)
                        {
                            table.Cell().Element(CellBorder).Text(item.Month);
                            table.Cell().Element(CellBorder).Text(item.Year.ToString());
                            table.Cell().Element(CellBorder).AlignRight().Text($"{item.TotalRevenue:N2}");
                        }

                        static IContainer CellBorder(IContainer container) => container
                            .BorderBottom(1)
                            .BorderColor(Colors.Grey.Lighten2)
                            .PaddingVertical(4)
                            .PaddingHorizontal(6);
                    });

                    column.Item().PaddingTop(10).Column(summary =>
                    {
                        summary.Item().Text($"Total Earnings: {data.TotalEarnings:N2}").Bold();
                        summary.Item().Text($"Overall Occupancy Rate: {data.OverallOccupancyRate:N2}%").Bold();
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        });

        return Task.FromResult(document.GeneratePdf());
    }
}
