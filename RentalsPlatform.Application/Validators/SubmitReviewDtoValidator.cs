using System.Net;
using System.Text.RegularExpressions;
using FluentValidation;
using RentalsPlatform.Application.DTOs.Reviews;

namespace RentalsPlatform.Application.Validators;

public partial class SubmitReviewDtoValidator : AbstractValidator<SubmitReviewDto>
{
    public SubmitReviewDtoValidator()
    {
        RuleFor(x => x.BookingId)
            .NotEmpty().WithMessage("BookingId is required.");

        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5)
            .WithMessage("Rating must be between 1 and 5.");

        RuleFor(x => x.Comment)
            .NotEmpty().WithMessage("Comment is required.")
            .MaximumLength(1000).WithMessage("Comment cannot exceed 1000 characters.");

        RuleFor(x => x)
            .Custom((model, context) =>
            {
                model.Comment = SanitizeHtml(model.Comment);

                if (string.IsNullOrWhiteSpace(model.Comment))
                {
                    context.AddFailure(nameof(model.Comment), "Comment cannot be empty after sanitization.");
                }
            });
    }

    public static string SanitizeHtml(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var withoutTags = HtmlTagRegex().Replace(input, string.Empty);
        return WebUtility.HtmlDecode(withoutTags).Trim();
    }

    [GeneratedRegex("<.*?>", RegexOptions.Singleline | RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();
}
