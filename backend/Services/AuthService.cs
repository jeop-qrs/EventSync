// ------------------------------------------------------------
// File: AuthService.cs
// Purpose: Handles authentication logic and password management
// ------------------------------------------------------------

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;

using backend.Data;
using backend.DTO;
using backend.Models;
using backend.Helpers;


namespace backend.Services
{
    public class AuthService
    {
        private readonly AppDbContext _context;
        private readonly IPasswordHasher<User> _hasher;
        private readonly JwtGenerator _jwtGenerator;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuthService(AppDbContext context, IPasswordHasher<User> hasher, JwtGenerator jwtGenerator, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _hasher = hasher;
            _jwtGenerator = jwtGenerator;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<AuthResponse> Register(AuthRegisterRequest req)
        {   
            // Check if user already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == req.Username);
            if (existingUser != null)
            {
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "User already registered"
                };
            }

            // Check Password Length
            if (req.Password.Length <= 8)
            {
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "Password must be at least 8 characters long"
                };
            }
            if (req.Password.Length >= 20)
            {
                return new AuthResponse
                {
                    Success = false,
                    BackendMessage = "Password may only be 20 characters long"
                };
            }

            // Create object for newUser and initial AccessToken
            var newUser = new User
            {
                Username = req.Username,
                PasswordHashed = _hasher.HashPassword(new User(), req.Password),
                Role = req.Role,
            };

            // Add newUser to DB and save changes
            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return new AuthResponse 
            {
                Success = true,
                BackendMessage = "Register successful. Log in again",
                Data = new ObjectResponse {
                    Username = newUser.Username,
                    Role = newUser.Role,
                }
            };
        }

        public async Task<AuthResponse> Login(AuthLoginRequest req)
        {
            // Check if user exists 
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == req.Username);
            if (user == null)
            {
                return new AuthResponse{
                    Success = false,
                    BackendMessage = "User not found"
                };
            }

            // Check if password is correct
            if (!_hasher.VerifyHashedPassword(user, user.PasswordHashed, req.Password).Equals(PasswordVerificationResult.Success))
            {
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "Incorrect password"
                };
            }

            // Generate token
            var accessToken = _jwtGenerator.AccessToken(user);
            var refreshToken = _jwtGenerator.RefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
            await _context.SaveChangesAsync();
            var jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
            var expiresIn = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new AuthResponse {
                Success = true,
                BackendMessage = "Login successful",
                Data = new ObjectResponse {
                    Username = user.Username,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresIn = expiresIn,
                    RefreshToken = refreshToken
                }
            };
        }

        public async Task<AuthResponse> Refresh(RefreshRequest req)
        {
            // Check if user exists
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == req.Username);
            if (user == null)
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "User not found"
                };

            // Check if RefreshToken sent matches the RefreshToken saved in DB
            if (user.RefreshToken != req.RefreshToken)
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "Invalid refresh token"
                };

            // Check if Refresh token is still valid
            if (user.RefreshTokenExpiry < DateTime.UtcNow)
                return new AuthResponse {
                    Success = false,
                    BackendMessage = "Refresh token expired"
                };

            // Rotate the accessToken and refreshToken
            var accessToken = _jwtGenerator.AccessToken(user);
            var refreshToken = _jwtGenerator.RefreshToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
            await _context.SaveChangesAsync();

            var jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
            var expiresIn = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new AuthResponse {
                Success = true,
                BackendMessage = "Token refreshed",
                Data = new ObjectResponse {
                    Username = user.Username,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresIn = expiresIn,
                    RefreshToken = refreshToken
                }
            };
        }

        public async Task<AuthResponse> Logout()
        {
            // Read the username claim from the current JWT principal
            var username = _httpContextAccessor.HttpContext?
                .User.FindFirst("user")?.Value;

            // Find the username in DB
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == username);
            if (user == null)
            {
                return new AuthResponse
                {
                    Success = false,
                    BackendMessage = "User not found"
                };
            }

            // Clear RefreshToken from user
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
            await _context.SaveChangesAsync();

            return new AuthResponse
            {
                Success = true,
                BackendMessage = "Logout successful"
            };
        }
    }
}
