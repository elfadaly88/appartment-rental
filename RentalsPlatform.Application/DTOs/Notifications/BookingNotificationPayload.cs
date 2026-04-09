namespace RentalsPlatform.Application.DTOs.Notifications;

public record BookingNotificationPayload(
    Guid BookingId,
    string PropertyName,
    string GuestName,
    string Message);
