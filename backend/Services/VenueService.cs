using backend.Data;
using backend.DTO;
using backend.Models;

namespace backend.Services
{
    public class VenueService
    {
        private readonly AppDbContext _context;
        public VenueService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<GlobalResponse> GetVenues(string? status)
        {
            throw new NotImplementedException();
        }

        public async Task<GlobalResponse> AddVenue(VenueCreateDto req)
        {
            throw new NotImplementedException();
        }
    }
}