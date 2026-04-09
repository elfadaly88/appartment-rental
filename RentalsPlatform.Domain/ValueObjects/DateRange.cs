namespace RentalsPlatform.Domain.ValueObjects;

public record DateRange
{
    public DateOnly Start { get; init; }
    public DateOnly End { get; init; }

    public int LengthInDays => End.DayNumber - Start.DayNumber;

    private DateRange() { }

    public DateRange(DateOnly start, DateOnly end)
    {
        if (start >= end)
            throw new ArgumentException("Check-out date must be after Check-in date");

        if (start < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ArgumentException("Cannot book a date in the past");

        Start = start;
        End = end;
    }

    // الدالة دي هي البطل الحقيقي! بتكتشف لو في تداخل بين حجزين
    public bool OverlapsWith(DateRange other)
    {
        return Start < other.End && End > other.Start;
    }
}