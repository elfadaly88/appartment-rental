namespace RentalsPlatform.Infrastructure.Services;

public class ExternalAuthSettings
{
    public GoogleAuthSettings Google { get; init; } = new();
    public FacebookAuthSettings Facebook { get; init; } = new();
}

public class GoogleAuthSettings
{
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
}

public class FacebookAuthSettings
{
    public string AppId { get; init; } = string.Empty;
    public string AppSecret { get; init; } = string.Empty;
}