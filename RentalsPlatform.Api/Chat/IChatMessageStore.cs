namespace RentalsPlatform.Api.Chat;

public interface IChatMessageStore
{
    void Add(ChatMessageDto message);
    IReadOnlyList<ChatMessageDto> GetByBookingId(Guid bookingId);
}
