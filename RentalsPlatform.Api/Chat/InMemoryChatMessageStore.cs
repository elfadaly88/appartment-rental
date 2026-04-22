using System.Collections.Concurrent;

namespace RentalsPlatform.Api.Chat;

public sealed class InMemoryChatMessageStore : IChatMessageStore
{
    private readonly ConcurrentDictionary<Guid, ConcurrentQueue<ChatMessageDto>> _messages = new();

    public void Add(ChatMessageDto message)
    {
        if (!Guid.TryParse(message.BookingId, out var bookingId))
        {
            return;
        }

        var queue = _messages.GetOrAdd(bookingId, _ => new ConcurrentQueue<ChatMessageDto>());
        queue.Enqueue(message);
    }

    public IReadOnlyList<ChatMessageDto> GetByBookingId(Guid bookingId)
    {
        if (!_messages.TryGetValue(bookingId, out var queue))
        {
            return Array.Empty<ChatMessageDto>();
        }

        return queue
            .OrderBy(m => m.SentAt, StringComparer.Ordinal)
            .ToList();
    }
}
