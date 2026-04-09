namespace RentalsPlatform.Domain.Entities;

public class PushSubscription
{
    public Guid Id { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public string Endpoint { get; private set; } = string.Empty;
    public string P256dh { get; private set; } = string.Empty;
    public string Auth { get; private set; } = string.Empty;

    private PushSubscription() { }

    public PushSubscription(string userId, string endpoint, string p256dh, string auth)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        Endpoint = endpoint;
        P256dh = p256dh;
        Auth = auth;
    }

    public void UpdateKeys(string p256dh, string auth)
    {
        P256dh = p256dh;
        Auth = auth;
    }
}
