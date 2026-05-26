using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // visual UI lives at /scalar/v1
}

app.UseAuthorization();     // checks if user is allowed to access a route
app.MapControllers();       // tells ASP.NET to look for Controller classes
app.Run();                  // starts the server — this line never "finishes"