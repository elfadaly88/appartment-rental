namespace RentalsPlatform.Api.Middleware;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
        context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
        context.Response.Headers.TryAdd("X-XSS-Protection", "1; mode=block");
        context.Response.Headers.TryAdd(
            "Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' https://your-luxury-domain.com; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https://res.cloudinary.com; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https://your-luxury-domain.com wss://your-luxury-domain.com; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';");

        await _next(context);
    }
}
