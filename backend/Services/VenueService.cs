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
                    : v.TimeSlots.Split(",", StringSplitOptions.RemoveEmptyEntries).ToList(),
                Facilities = string.IsNullOrEmpty(v.Facilities)
                    ? []
                    : v.Facilities.Split(",", StringSplitOptions.RemoveEmptyEntries).Select(f => f.Trim()).ToList()
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
                PhotoPath = photoPath,
                Facilities = req.Facilities ?? string.Empty
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

        public async Task<GlobalResponse> DeleteVenue(int venueId)
        {
            var venue = await _context.Venues.FindAsync(venueId);
            if (venue == null)
            {
                return new GlobalResponse { Success = false, BackendMessage = "Venue not found." };
            }

            var hasActiveEvents = await _context.Events.AnyAsync(e => 
                e.VenueId == venueId && 
                e.Status != "cancelled" && 
                e.Status != "rejected");
            if (hasActiveEvents)
            {
                return new GlobalResponse { Success = false, BackendMessage = "Cannot delete venue because it has active events scheduled/associated with it." };
            }

            if (!string.IsNullOrEmpty(venue.PhotoPath))
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), venue.PhotoPath);
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }

            _context.Venues.Remove(venue);
            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                null, null, null, null,
                "Venue",
                "Delete",
                venue.Name
            );

            return new GlobalResponse { Success = true, BackendMessage = "Venue deleted successfully." };
        }

        public async Task<GlobalResponse> UpdateVenue(int venueId, VenueCreateDto req)
        {
            var venue = await _context.Venues.FindAsync(venueId);
            if (venue == null)
            {
                return new GlobalResponse { Success = false, BackendMessage = "Venue not found." };
            }

            // Update simple properties
            venue.Name = req.Name;
            venue.Address = req.Address;
            venue.Capacity = req.Capacity;
            venue.Description = req.Description;
            venue.Availability = req.Availability;
            venue.TimeSlots = string.Join(",", req.Timeslots);
            venue.Facilities = req.Facilities ?? string.Empty;

            // Handle photo cover update if provided
            if (req.PhotoCover != null)
            {
                // Delete old photo if it exists
                if (!string.IsNullOrEmpty(venue.PhotoPath))
                {
                    var oldFilePath = Path.Combine(Directory.GetCurrentDirectory(), venue.PhotoPath);
                    if (File.Exists(oldFilePath))
                    {
                        try
                        {
                            File.Delete(oldFilePath);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error deleting old photo: {ex.Message}");
                        }
                    }
                }

                // Save new photo
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
                venue.PhotoPath = Path.Combine("Uploads", "Venue", "Banners", fileName);
            }

            await _context.SaveChangesAsync();

            await _auditLogService.LogAsync(
                null, null, null, null,
                "Venue",
                "Update",
                venue.Name
            );

            return new GlobalResponse { Success = true, BackendMessage = "Venue updated successfully.", Data = venue };
        }
    }
}