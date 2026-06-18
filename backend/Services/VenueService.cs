using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services
{
    public class VenueService
    {
        private readonly AppDbContext _context;
        private readonly AuditLogService _auditLogService;
        public VenueService(AppDbContext context, AuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }

        public async Task<GlobalResponse> GetVenues(string? status)
        {
            var venues = status == null
                ? await _context.Venues.ToListAsync()
                : await _context.Venues
                    .Where(v => v.Status == status)
                    .ToListAsync();

            var result = venues.Select(v => new
            {
                v.VenueId,
                v.Name,
                v.Address,
                v.Capacity,
                v.Description,
                v.Availability,
                v.Status,
                v.PhotoPath,
                TimeSlots = string.IsNullOrEmpty(v.TimeSlots)
                    ? []
                    : v.TimeSlots.Split(",", StringSplitOptions.RemoveEmptyEntries).ToList()
            });
            return new GlobalResponse { Success = true, BackendMessage = "Venues fetched successfully.", Data = result };
        }

        public async Task<GlobalResponse> AddVenue(VenueCreateDto req)
        {
            string? photoPath = null;
            if (req.PhotoCover != null)
            {
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Venue", "Banners");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }
                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(req.PhotoCover.FileName)}";
                var filePath = Path.Combine(uploadsFolder, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await req.PhotoCover.CopyToAsync(stream);
                }
                photoPath = Path.Combine("Uploads", "Venue", "Banners", fileName);
            }
            var newVenue = new Venue
            {
                Name = req.Name,
                Address = req.Address,
                Capacity = req.Capacity,
                Description = req.Description,
                Availability = req.Availability,
                TimeSlots = string.Join(",", req.Timeslots),
                Status = "available",
                PhotoPath = photoPath
            };
            _context.Venues.Add(newVenue);
            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                null, null, null, null,
                "Venue",
                "Create",
                newVenue.Name
            );

            return new GlobalResponse { Success = true, BackendMessage = "Venue added successfully.", Data = newVenue };
        }
    }
}