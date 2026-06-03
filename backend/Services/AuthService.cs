// ------------------------------------------------------------
// File: AuthService.cs
// Purpose: Handles authentication logic and password management
// ------------------------------------------------------------

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using backend.Data;
using backend.DTO.Auth;
using backend.Models;


namespace backend.Services.App
{
    public class AuthService: IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IPasswordHasher<User> _hasher;
        public AuthService(AppDbContext context, IPasswordHasher<User> hasher)
        {
            _context = context;
            _hasher = hasher;
        }
        public async Task<AuthRes> Register(RegisterReq req)
        {   
            // Check if user already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.StudNo == req.StudNo);
            if (existingUser != null)
            {
                return new AuthRes { Success = false, Message = "Student ID already registered" };
            }
            // Check Password Length
            if (req.Password.Length <= 8)
            {
                return new AuthRes { Success = false, Message = "Password must be at least 8 characters long."};
            }
            if (req.Password.Length >= 20)
            {
                return new AuthRes { Success = false, Message = "Password may only be 20 characters long."};
            }

            // Create an object for newUser
            var newUser = new User
            {
                StudNo = req.StudNo,
                PasswordHashed = _hasher.HashPassword(new User(), req.Password),
                Role = req.Role
            };
            // Add newUser to DB and save changes
            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();
            return new AuthRes { Success = true, Message = "Registration successful" };
        }
    public async Task<AuthRes> Login(LoginReq req)
        {
            // Check if user doesn't exist
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.StudNo == req.StudNo);
            if (user == null)
            {
                return new AuthRes { Success = false, Message = "Student ID not found" };
            }

            // Check if password is correct
            var result = _hasher.VerifyHashedPassword(user, user.PasswordHashed, req.Password);
            if (result == PasswordVerificationResult.Failed)
            {
                return new AuthRes { Success = false, Message = "Incorrect password" };
            }

            return new AuthRes { Success = true, Message = "Login successful" };
        }
    }
}