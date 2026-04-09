namespace RentalsPlatform.Application.Services;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string toName, string templateId, object dynamicTemplateData);
}
