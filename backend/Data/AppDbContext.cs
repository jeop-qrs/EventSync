// ------------------------------------------------
// File: AppDbContext.cs
// Purpose: Defines the Entity Framework Core database context for the application
// ------------------------------------------------

using backend.Models;
using Microsoft.EntityFrameworkCore;

// Service uses LINQ to query the database
// EF Core will translate LINQ queries to SQL queries
// Models are mapped to tables in the database
// Models are used to let Database Entities be recognized by Entity Framework Core

namespace backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Event> Events { get; set; }
        public DbSet<Venue> Venues { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationPreference> NotificationPreferences { get; set; }
    }
}