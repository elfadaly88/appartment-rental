using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace RentalsPlatform.Api.Controllers;

public abstract class BaseController : ControllerBase
{
    protected Guid? CurrentUserId
    {
        get
        {
            var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(rawUserId, out var userId) ? userId : null;
        }
    }
}