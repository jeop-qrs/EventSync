using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

using backend.Models;
using Microsoft.EntityFrameworkCore.Metadata.Internal;


namespace backend.Helpers
{
    public class JwtGenerator
    {
        private readonly IConfiguration _config;

        public JwtGenerator(IConfiguration config)
        {
            _config = config;
        }

        public string AccessToken(User user)
        {
            var iss = _config["Jwt:Issuer"];
            var aud = _config["Jwt:Audience"];

            var userClaims = new[]
            {
                new Claim("user", user.Username),
                new Claim("role", user.Role)
            };
            
            var expiryMinutes = _config.GetValue<int>("Jwt:ExpiryMinutes");
            var expiryTime = DateTime.UtcNow.AddMinutes(expiryMinutes);
            
            var jwtKey = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Missing Jwt:Key configuration");

            var securityKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            );

            var credentials = new SigningCredentials
            (
                securityKey,
                SecurityAlgorithms.HmacSha256
            );
            
            // 6. Build the token structure
            var token = new JwtSecurityToken
            (
                issuer: iss,
                audience: aud,
                claims: userClaims,
                expires: expiryTime,
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string RefreshToken()
        {
            var randomBytes = RandomNumberGenerator.GetBytes(96);
            return Convert.ToBase64String(randomBytes);
        }
    }
}