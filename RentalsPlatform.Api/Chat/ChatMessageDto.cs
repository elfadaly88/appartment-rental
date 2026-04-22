namespace RentalsPlatform.Api.Chat;

public sealed record ChatMessageDto(
    string Id,
    string BookingId,
    string SenderId,
    string ReceiverId,
    string Content,
    string SentAt,
    string? SenderName,
    string? SenderAvatarUrl
);
