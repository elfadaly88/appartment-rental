using Microsoft.Extensions.Configuration;
using SendGrid;
using SendGrid.Helpers.Mail;
using RentalsPlatform.Application.Services;

namespace RentalsPlatform.Infrastructure.Services;

public class SendGridEmailService : IEmailService
{
    private readonly ISendGridClient _sendGridClient;
    private readonly IConfiguration _configuration;

    public SendGridEmailService(ISendGridClient sendGridClient, IConfiguration configuration)
    {
        _sendGridClient = sendGridClient;
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string toEmail, string toName, string templateId, object dynamicTemplateData)
    {
        if (string.IsNullOrWhiteSpace(toEmail))
            throw new ArgumentException("Recipient email is required.", nameof(toEmail));

        if (string.IsNullOrWhiteSpace(templateId))
            throw new ArgumentException("Template id is required.", nameof(templateId));

        var fromEmail = _configuration["SendGrid:FromEmail"] ?? "no-reply@rentalsplatform.com";
        var fromName = _configuration["SendGrid:FromName"] ?? "Rentals Platform";

        var message = new SendGridMessage
        {
            From = new EmailAddress(fromEmail, fromName),
            TemplateId = templateId
        };

        message.AddTo(new EmailAddress(toEmail, toName));
        message.SetTemplateData(dynamicTemplateData);

        var response = await _sendGridClient.SendEmailAsync(message);
        if ((int)response.StatusCode >= 400)
        {
            var body = await response.Body.ReadAsStringAsync();
            throw new InvalidOperationException($"SendGrid failed with status {(int)response.StatusCode}: {body}");
        }
    }
}
