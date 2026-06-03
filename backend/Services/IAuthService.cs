using backend.DTO.Auth;

namespace backend.Services.App
{
    public interface IAuthService
    {
        Task<AuthRes> Register(RegisterReq req);
        Task<AuthRes> Login(LoginReq req);
    }
}