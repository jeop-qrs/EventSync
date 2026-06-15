// ------------------------------------------------------------
// File: AuthService.cs
// Purpose: Handles authentication logic and password management
// ------------------------------------------------------------

using System.IdentityModel.Tokens.Jwt;
using backend.Data;
using backend.DTO;
using backend.Helpers;
using backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;


namespace backend.Services
{
    public class AuthService
    {
        private readonly AppDbContext _context;
        private readonly IPasswordHasher<User> _hasher;
        private readonly JwtGenerator _jwtGenerator;

        public AuthService(AppDbContext context, IPasswordHasher<User> hasher, JwtGenerator jwtGenerator)
        {
            _context = context;
            _hasher = hasher;
            _jwtGenerator = jwtGenerator;
        }

        public async Task<GlobalResponse> Register(AuthRegisterRequest req)
        {
            var roleLower = req.Role?.ToLowerInvariant();
            if (roleLower != "student" && roleLower != "faculty")
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Invalid role specified"
                };
            }

            User? existingUser = null;
            if (roleLower == "student")
            {
                if (string.IsNullOrEmpty(req.StudentNumber))
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Student Number cannot be empty"
                    };
                }
                if (req.StudentNumber.Contains(' '))
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Student Number may not contain spaces"
                    };
                }
                if (req.StudentNumber.Length <= 8 || req.StudentNumber.Length >= 20)
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Student Number must be at least 8 characters long and at most 20 characters long"
                    };
                }
                existingUser = await _context.Users.FirstOrDefaultAsync(u => u.StudentNumber == req.StudentNumber);
            }
            else
            {
                if (string.IsNullOrEmpty(req.Username))
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Username cannot be empty"
                    };
                }
                if (req.Username.Contains(' '))
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Username may not contain spaces"
                    };
                }
                if (req.Username.Length <= 8 || req.Username.Length >= 20)
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Username must be at least 8 characters long and at most 20 characters long"
                    };
                }
                existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
            }

            if (existingUser != null)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User already registered"
                };
            }

            // Check Password Length
            if (string.IsNullOrEmpty(req.Password) || req.Password.Length <= 8 || req.Password.Length >= 20)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Password must be at least 8 characters long and at most 20 characters long"
                };
            }

            // Create object for newUser and initial AccessToken
            var newUser = new User
            {
                Username = roleLower == "faculty" ? req.Username : null,
                StudentNumber = roleLower == "student" ? req.StudentNumber : null,
                PasswordHash = _hasher.HashPassword(new User(), req.Password),
                Role = roleLower,
                CreatedAt = DateTime.UtcNow
            };
            
            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Register successful. Log in again"
            };
        }

        public async Task<GlobalResponse> Login(AuthLoginRequest req)
        {
            User? user = null;
            if (!string.IsNullOrEmpty(req.StudentNumber))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.StudentNumber == req.StudentNumber);
            }
            else if (!string.IsNullOrEmpty(req.Username))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
            }

            if (user == null)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not found"
                };
            }

            // Check if password is correct via hashed password
            if (!_hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password).Equals(PasswordVerificationResult.Success))
            {
                return new GlobalResponse
                {
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
            var expiresAt = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Login successful.",
                Data = new AuthDataObjectResponse
                {
                    Username = user.Role == "faculty" ? user.Username : null,
                    StudentNumber = user.Role == "student" ? user.StudentNumber : null,
                    StudNo = user.Role == "student" ? user.StudentNumber : null,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresAt = expiresAt,
                    RefreshToken = refreshToken
                }
            };
        }

        public async Task<GlobalResponse> Refresh(AuthRefreshRequest req, int userId)
        {
            // Check if user exists
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not found"
                };

            // Check if RefreshToken sent matches the RefreshToken saved in DB
            if (user.RefreshToken != req.RefreshToken)
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Invalid refresh token"
                };

            // Check if Refresh token is still valid
            if (user.RefreshTokenExpiry < DateTime.UtcNow)
                return new GlobalResponse
                {
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
            var expiresAt = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Token refreshed.",
                Data = new AuthDataObjectResponse
                {
                    Username = user.Role == "faculty" ? user.Username : null,
                    StudentNumber = user.Role == "student" ? user.StudentNumber : null,
                    StudNo = user.Role == "student" ? user.StudentNumber : null,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresAt = expiresAt,
                    RefreshToken = refreshToken
                }
            };
        }

        public async Task<GlobalResponse> Logout(int userId)
        {

            // Find the username in DB
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not found"
                };
            }

            // Clear RefreshToken from user
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
            await _context.SaveChangesAsync();

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Logout successful"
            };
        }
    }
}
