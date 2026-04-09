namespace RentalsPlatform.Application.DTOs.Notifications;

public record PushSubscriptionRequestDto(
    string Endpoint,
    string P256dh,
    string Auth);
