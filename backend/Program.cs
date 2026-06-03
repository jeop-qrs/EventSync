using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using backend.Data;
using backend.Models;
using backend.Services.App;


var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();

// List of DI
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<IAuthService, AuthService>();
// Configure DbContext with MySQL connection string from appsettings.json
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));


var app = builder.Build();

app.MapControllers();
app.Run();