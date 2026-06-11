using backend.Data;
using backend.DTO;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Services;

public class NotificationService
{
    private readonly AppDbContext _context;
    public NotificationService(AppDbContext context)
    {
        _context = context;
    }

    private async Task SaveNotification(int userId, int eventId, string message)
    {
        var notification = new Notification
        {
            UserId = userId,
            EventId = eventId,
            Message = message,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();
    }

    public async Task NotifyOnStatusChange(Event @event, string? reason)
    {
        var preference = await _context.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == @event.OrganizerId);
        if (preference != null && !preference.NotifyOnStatusChange) return;
        var message = @event.Status switch
        {
            "approved" => $"Your event '{@event.Title}' has been approved!",
            "rejected" => reason is not null
                ? $"Your event '{@event.Title}' was rejected. Reason: {reason}"
                : $"Your event '{@event.Title}' was rejected.",
            _ => $"Your event '{@event.Title}' status changed to {@event.Status}." // Fallback case
        };
        await SaveNotification(@event.OrganizerId, @event.EventId, message);
    }

    public async Task NotifyUpcomingEvents()
    {
        var now = DateTime.UtcNow;
        var upcomingEvents = await _context.Events
            .Where(e => e.Status == "approved")
            .ToListAsync();
        foreach (var @event in upcomingEvents)
        {
            var preference = await _context.NotificationPreferences
                .FirstOrDefaultAsync(p => p.UserId == @event.OrganizerId);
            if (preference == null) continue;
            var timeToEvent = @event.StartDateTime - now;
            if (timeToEvent.TotalHours is >= 23 and <= 25 && preference.NotifyOneDayBefore)
                await SaveNotification(@event.OrganizerId,
                    @event.EventId,
                    $"Your event '{@event.Title}' is happening tomorrow!");
            if (timeToEvent.TotalDays is >= 6 and <= 8 && preference.NotifyOneWeekBefore)
                await SaveNotification(@event.OrganizerId,
                    @event.EventId,
                    $"Your event '{@event.Title}' is happening in one week!");
        }
    }

    public async Task<GlobalResponse> GetAll(int userId)
    {
        var notifs = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
        return new GlobalResponse
        {
            Success = true,
            BackendMessage = "Notifications retrieved successfully",
            Data = notifs
        };
    }

    public async Task<GlobalResponse> MarkAsRead(int id)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.NotificationId == id);
        if (notification == null)
        {
            return new GlobalResponse
            {
                Success = false,
                BackendMessage = "Notification not found",
                Data = null
            };
        }
        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return new GlobalResponse
        {
            Success = true,
            BackendMessage = "Notification marked as read",
            Data = null
        };
    }

    public async Task<GlobalResponse> MarkAllAsRead(int userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
        }
        await _context.SaveChangesAsync();
        return new GlobalResponse
        {
            Success = true,
            BackendMessage = "All notifications marked as read",
            Data = null
        };
    }

    public async Task<GlobalResponse> GetPreference(int userId)
    {
        var preference = await _context.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId);
        if (preference == null)
        {
            return new GlobalResponse
            {
                Success = false,
                BackendMessage = "Preference not found",
                Data = null
            };
        }
        return new GlobalResponse
        {
            Success = true,
            BackendMessage = "Preference retrieved successfully",
            Data = preference
        };
    }

    public async Task<GlobalResponse> UpdatePreference(int userId, NotificationUpdatePreferenceDto preference)
    {
        var existingPreference = await _context.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == userId);
        if (existingPreference == null)
        {
            return new GlobalResponse
            {
                Success = false,
                BackendMessage = "Preference not found",
                Data = null
            };
        }
        existingPreference.NotifyOneDayBefore = preference.NotifyOneDayBefore;
        existingPreference.NotifyOneWeekBefore = preference.NotifyOneWeekBefore;
        existingPreference.NotifyOnStatusChange = preference.NotifyOnStatusChange;
        await _context.SaveChangesAsync();
        return new GlobalResponse
        {
            Success = true,
            BackendMessage = "Preference updated successfully",
            Data = null
        };
    }
}