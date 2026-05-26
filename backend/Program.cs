using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ─── SERVICES ──────────────────────────────────────────
// This section is where we register everything the app needs.
// Think of it as telling ASP.NET "here's your toolkit before you start."
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ─── BUILD ─────────────────────────────────────────────
var app = builder.Build();

// ─── MIDDLEWARE ────────────────────────────────────────
// Middleware = code that runs on EVERY request before it hits your controller.
// Order matters here — top runs first.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // visual UI lives at /scalar/v1
}

app.UseAuthorization();     // checks if user is allowed to access a route
app.MapControllers();       // tells ASP.NET to look for Controller classes
app.Run();                  // starts the server — this line never "finishes"