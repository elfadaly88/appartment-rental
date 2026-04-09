namespace RentalsPlatform.Application.DTOs.Lookups;

public record GovernorateDto(
    int Id,
    string NameAr,
    string NameEn,
    IReadOnlyCollection<CityDto> Cities);
