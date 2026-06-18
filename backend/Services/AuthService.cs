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
        private readonly AuditLogService _auditLogService;

        public AuthService(AppDbContext context, IPasswordHasher<User> hasher, JwtGenerator jwtGenerator, AuditLogService auditLogService)
        {
            _context = context;
            _hasher = hasher;
            _jwtGenerator = jwtGenerator;
            _auditLogService = auditLogService;
        }

        public async Task<GlobalResponse> Register(AuthRegisterRequest req)
        {
            if (req.Role == "student")
            {
                if (string.IsNullOrEmpty(req.StudentNumber) || req.StudentNumber.Trim().Length != 10)
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Student Number must be exactly 10 characters long"
                    };
                }
            }

            // Check if user already exists safely
            User? user = null;
            if (!string.IsNullOrEmpty(req.Username))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
            }
            else if (!string.IsNullOrEmpty(req.StudentNumber))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.StudentNumber == req.StudentNumber);
            }

            if (user != null)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User already registered"
                };
            }
            // Check which identifier is used based on role
            string identifier;
            if (req.Role == "student" && req.StudentNumber != null)
            {
                identifier = req.StudentNumber;
            }
            else if (req.Role == "faculty" && req.Username != null)
            {
                identifier = req.Username;
            }
            else
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Invalid Role"
                };
            }
            // Check if Username is empty
            if (string.IsNullOrEmpty(identifier))
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Username and Student Number cannot be empty"
                };
            }
            // Check if Username contains no spaces
            if (identifier.Contains(' '))
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Username and Student Number may not contain spaces"
                };
            }
            // Check Username Length
            if (identifier.Length < 8)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Username and Student Number must be at least 8 characters long"
                };
            }
            if (identifier.Length > 20)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Username and Student Number may only be 20 characters long"
                };
            }
            // Check Password Length
            if (req.Password.Length < 8 || req.Password.Length > 20)
            {
                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "Password must be at least 8 characters long and at most 20 characters long"
                };
            }
            // Create object for newUser
            var newUser = new User
            {
                StudentNumber = req.StudentNumber,
                Username = req.Username,
                FullName = req.FullName,
                PasswordHash = _hasher.HashPassword(new User(), req.Password),
                Role = req.Role,
                CreatedAt = DateTime.UtcNow
            };
            // Add newUser to DB and save changes 
            // SQL Query: INSERT INTO Users (Username, PasswordHash, Role, CreatedAt) VALUES (req.Username, _hasher.HashPassword(new User(), req.Password), req.Role, DateTime.UtcNow);
            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                newUser.UserId,
                identifier,
                newUser.FullName,
                newUser.Role,
                "Auth",
                "Register",
                identifier
            );

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Register successful. Log in again"
            };
        }

        public async Task<GlobalResponse> Login(AuthLoginRequest req)
        {
            // Check if user exists safely
            User? user = null;
            if (!string.IsNullOrEmpty(req.Username))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
            }
            else if (!string.IsNullOrEmpty(req.StudentNumber))
            {
                if (req.StudentNumber.Trim().Length != 10)
                {
                    return new GlobalResponse
                    {
                        Success = false,
                        BackendMessage = "Student Number must be exactly 10 characters long"
                    };
                }
                user = await _context.Users.FirstOrDefaultAsync(u => u.StudentNumber == req.StudentNumber);
            }

            if (user == null)
            {
                await _auditLogService.LogAsync(
                    null,
                    req.Username ?? req.StudentNumber ?? "Unknown",
                    "Unknown",
                    "Anonymous",
                    "Auth",
                    "Login Failed (User not found)",
                    req.Username ?? req.StudentNumber ?? "Unknown"
                );

                return new GlobalResponse
                {
                    Success = false,
                    BackendMessage = "User not found"
                };
            }

            // Check if password input is correct
            if (!_hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password).Equals(PasswordVerificationResult.Success))
            {
                await _auditLogService.LogAsync(
                    user.UserId,
                    user.Role == "faculty" ? user.Username : user.StudentNumber,
                    user.FullName,
                    user.Role,
                    "Auth",
                    "Login Failed (Incorrect password)",
                    user.Role == "faculty" ? user.Username : user.StudentNumber
                );

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

            await _auditLogService.LogAsync(
                user.UserId,
                user.Role == "faculty" ? user.Username : user.StudentNumber,
                user.FullName,
                user.Role,
                "Auth",
                "Login",
                user.Role == "faculty" ? user.Username : user.StudentNumber
            );

            var jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
            var expiresIn = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Login successful",
                Data = new AuthDataObjectResponse
                {
                    Username = user.Username,
                    StudentNumber = user.StudentNumber,
                    FullName = user.FullName,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresIn = expiresIn,
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
            var expiresIn = (int)(jwtToken.ValidTo - DateTime.UtcNow).TotalSeconds;

            return new GlobalResponse
            {
                Success = true,
                BackendMessage = "Token refreshed",
                Data = new AuthDataObjectResponse
                {
                    Username = user.Username,
                    StudentNumber = user.StudentNumber,
                    FullName = user.FullName,
                    Role = user.Role,
                    AccessToken = accessToken,
                    ExpiresIn = expiresIn,
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
