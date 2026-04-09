namespace RentalsPlatform.Application.Services;

public interface IPayoutService
{
    Task ProcessDailyPayoutsAsync();
}