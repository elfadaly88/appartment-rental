namespace RentalsPlatform.Application.Common;

public class Result
{
    public bool IsSuccess { get; }
    public string Message { get; }

    private Result(bool isSuccess, string message)
    {
        IsSuccess = isSuccess;
        Message = message;
    }

    public static Result Success(string message) => new(true, message);
    public static Result Failure(string message) => new(false, message);
}
