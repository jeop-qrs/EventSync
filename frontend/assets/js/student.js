// =============================================
// student.js — Student Dashboard (index.html)
// Handles the entire student-facing experience:
// landing page role selection, sidebar navigation,
// venue browsing, calendar interaction, event application
// form submission, and proposal management.
// Depends on shared.js being loaded first.
// =============================================


// =============================================
// GLOBAL STATE VARIABLES
// =============================================

// Full list of venues fetched from the server
let allVenuesList = [];

// The student's own event proposals fetched from the server
let myEventsList = [];

// A fast-lookup map of venue objects keyed by venue ID (built after fetch)
let studentVenueData = {};

// The ID of the venue currently selected and displayed in the detail panel
let activeVenue = null;

// The calendar month and year currently displayed (changes when prev/next is clicked)
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();

// The day number (1–31) the user has clicked on the calendar
let selectedCalendarDay = null;

// The time slot string selected from the day detail panel
let selectedCalendarTime = "";

// Tracks the proposal ID being edited, or null for new submissions
let editingProposalId = null;

// Tracks the proposal ID being cancelled, used across the multi-step cancel flow
let cancelEventId = null;


// =============================================
// DATA LOADING — SERVER API CALLS
// =============================================

// [loadFacultyVenues]: Fetches all venues from the backend API and normalizes them
// into the shape used throughout this file. Called on page load and after any changes.
async function loadFacultyVenues() {
  try {
    const response = await apiFetch("/api/venues");
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        allVenuesList = result.data.map(v => ({
          id: v.venueId,
          name: v.name,
          address: v.address,
          capacity: v.capacity,
          description: v.description,
          availability: v.availability,
          status: v.status,
          // Build a full URL for the venue photo if a server path was returned
          photoDataUrl: v.photoPath ? (v.photoPath.startsWith("data:") ? v.photoPath : `${baseUrl}/${v.photoPath.replace(/\\/g, "/")}`) : "",
          timeSlots: v.timeSlots || [],
          facilities: v.facilities || []
        }));
        return allVenuesList;
      }
    }
  } catch (err) {
    console.error("Failed to load venues:", err);
  }
  return [];
}

// [loadEventsFromServer]: Fetches all of the current student's event proposals
// across all statuses (pending, approved, rejected, cancelled) and merges them
// into the myEventsList array. Also maps venue IDs to human-readable venue names.
async function loadEventsFromServer() {
  try {
    const statuses = ["pending", "approved", "rejected", "cancelled"];

    // Fetch all statuses in parallel for speed
    const promises = statuses.map(async (status) => {
      const response = await apiFetch(`/api/events?status=${status}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) return result.data;
      }
      return [];
    });

    const results = await Promise.all(promises);

    myEventsList = results.flat().map(e => ({
      id: `proposal-${e.eventId}`,
      eventId: e.eventId,
      title: e.title,
      org: e.department,
      // Resolve the venue name from the ID, falling back to a generic label
      venue: allVenuesList.find(v => v.id === e.venueId)?.name || `Venue #${e.venueId}`,
      venueId: e.venueId,
      date: e.eventDate ? e.eventDate.split("T")[0] : "",
      time: e.startTime,
      attendees: e.expectedAttendees,
      pdfName: e.submitLetterPath ? e.submitLetterPath.split("/").pop() : "letter-request.pdf",
      pdfDataUrl: e.submitLetterPath ? `${baseUrl}/${e.submitLetterPath.replace(/\\/g, "/")}` : "",
      // Map backend status names to the internal names used in this file
      status: e.status === "approved" ? "accepted" : (e.status === "rejected" ? "pending_reviewed" : e.status),
      rejectionReason: e.reason || "",
      submittedAt: e.createdAt
    }));
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

// [getAllVenues]: Returns the current in-memory list of all venues.
function getAllVenues() {
  return allVenuesList;
}

// [loadProposals]: Returns the current in-memory list of the student's proposals.
// Overrides the shared.js version to use the server-sourced array instead of localStorage.
function loadProposals() {
  return myEventsList;
}

// [buildVenueMap]: Converts the flat venues array into a key-value map for O(1) lookup
// by venue ID. Stored in studentVenueData after each data refresh.
function buildVenueMap(venues) {
  const map = {};
  venues.forEach((v) => { map[v.id] = v; });
  return map;
}

// [refreshAll]: Master refresh function. Reloads all data from the server and
// then re-renders every visible section of the dashboard. Called on page load
// and after any user action that changes data.
async function refreshAll() {
  await loadFacultyVenues();
  await loadEventsFromServer();
  if (typeof loadNotificationsFromServer === "function") {
    await loadNotificationsFromServer();
  }
  updateStudentStats();
  renderMyEvents();
  renderStudentVenueGrid();
}


// =============================================
// LANDING OVERLAY — Role Selection
// =============================================

// [startSession]: Hides the landing overlay and shows the full dashboard
// after the student is confirmed to be logged in. Also triggers the first
// data load to populate the dashboard.
function startSession() {
  document.getElementById("landingOverlay").style.display = "none";
  document.querySelector(".sidebar")?.classList.remove("hidden");
  document.querySelector(".main-workspace")?.classList.remove("hidden");
  refreshAll();
}


// =============================================
// SIDEBAR — View Navigation
// =============================================

// [switchView]: Shows the selected content view and hides all others.
// Also updates the page title in the navbar and highlights the active
// sidebar menu item. Saves the current view to sessionStorage so it
// persists across page refreshes.
function switchView(viewId, element) {
  // Hide all content views first
  document.querySelectorAll(".view-section").forEach((v) => v.classList.remove("active-view"));
  document.getElementById(viewId)?.classList.add("active-view");

  // Map view IDs to their human-readable page titles
  const titles = {
    "dashboard-view": "Dashboard Overview",
    "venues-view": "Venue Directory",
    "schedule-view": "Event Application",
  };
  document.getElementById("workspaceTitle").textContent = titles[viewId] || "Dashboard";

  // Highlight the clicked sidebar item and remove highlight from others
  if (element) {
    document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }

  // Persist the active view so the user returns to the same section after a refresh
  sessionStorage.setItem("studentActiveView", viewId);
}


// =============================================
// DASHBOARD VIEW — Stats & My Events
// =============================================

// [updateStudentStats]: Calculates and displays the summary numbers in the
// three stat cards at the top of the Dashboard view. Called after every data refresh.
function updateStudentStats() {
  const proposals = loadProposals();
  const proposed = proposals.length;
  const pending = proposals.filter((p) => p.status === "pending").length;

  document.getElementById("countProposed").textContent = proposed;
  document.getElementById("countPending").textContent = pending;
  // Count only venues that the server marks as "available"
  document.getElementById("countVenues").textContent = getAllVenues().filter(v => (v.status || "").toLowerCase() === "available").length;
}

// [renderMyEvents]: Builds and inserts the HTML for the "My Submitted Events"
// list on the dashboard. Shows status pills, rejection reasons, Cancel and Edit
// buttons based on each proposal's current status. Also wires up action buttons.
function renderMyEvents() {
  const list = document.getElementById("myEventsList");
  const countBadge = document.getElementById("myEventsCount");
  if (!list) return;

  const proposals = loadProposals();

  if (countBadge) {
    countBadge.textContent = `${proposals.length} event${proposals.length === 1 ? "" : "s"}`;
  }

  if (!proposals.length) {
    list.innerHTML = '<p class="empty-state">You have not submitted any events yet.</p>';
    return;
  }

  // Map internal status codes to human-readable labels and CSS classes
  const statusMap = {
    pending: { label: "Pending Review", cls: "status-pending" },
    accepted: { label: "Accepted", cls: "status-approved" },
    pending_reviewed: { label: "Pending Reviewed", cls: "status-rejected" },
    cancelled: { label: "Cancelled", cls: "status-rejected" },
  };

  list.innerHTML = proposals
    .map((p) => {
      const st = statusMap[p.status] || statusMap.pending;

      // Show rejection/review comments only if the proposal was sent back for revision
      const rejectNote = p.status === "pending_reviewed" && p.rejectionReason
        ? `<p class="event-reject-reason"><strong>Review Comments:</strong> ${escapeHtml(p.rejectionReason)}</p>`
        : "";

      // Show "Cancel" button only for active proposals (can't cancel what's already done)
      const cancelBtn = (p.status === "accepted" || p.status === "pending")
        ? `<button type="button" class="btn btn-secondary btn-small cancel-event-btn" data-id="${escapeHtml(p.id)}">Cancel Request</button>`
        : "";

      // Show "Edit" button only for proposals that were sent back for revision
      const editBtn = p.status === "pending_reviewed"
        ? `<button type="button" class="btn btn-secondary btn-small edit-event-btn" data-id="${escapeHtml(p.id)}">Edit Request</button>`
        : "";

      return `
        <article class="my-event-card" data-id="${escapeHtml(p.id)}">
          <div class="my-event-card-main">
            <h4>${escapeHtml(p.title)}</h4>
            <p class="my-event-meta">${escapeHtml(p.venue)} · ${escapeHtml(p.date)} · ${escapeHtml(formatTime12h(p.time))}</p>
            ${rejectNote}
          </div>
          <div class="my-event-card-actions">
            <span class="status-pill ${st.cls}">${st.label}</span>
            ${editBtn}
            ${cancelBtn}
          </div>
        </article>
      `;
    })
    .join("");

  // Wire up action buttons now that the cards are in the DOM
  list.querySelectorAll(".cancel-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => cancelEvent(btn.dataset.id));
  });

  list.querySelectorAll(".edit-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => editEvent(btn.dataset.id));
  });
}


// =============================================
// VENUE DIRECTORY VIEW — Venue Grid & Detail
// =============================================

// [renderStudentVenueGrid]: Fetches all venues and renders them as clickable cards
// in the Venue Directory view. Also refreshes the venue dropdown in the form.
function renderStudentVenueGrid() {
  const grid = document.getElementById("studentVenueGrid");
  if (!grid) return;

  const query = document.getElementById("venueSearchQuery")?.value.toLowerCase().trim() || "";
  const maxCapacity = parseInt(document.getElementById("venueCapacityFilter")?.value || "0", 10);

  let venues = getAllVenues();

  // Apply filters
  if (query) {
    venues = venues.filter(v => 
      v.name.toLowerCase().includes(query) || 
      v.address.toLowerCase().includes(query) ||
      v.description.toLowerCase().includes(query)
    );
  }
  if (maxCapacity > 0) {
    venues = venues.filter(v => v.capacity <= maxCapacity);
  }

  // Rebuild the lookup map every time the grid is refreshed
  studentVenueData = buildVenueMap(venues);

  if (venues.length === 0) {
    grid.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">No venues match the selected filters.</p>';
    populateVenueSelect(venues);
    return;
  }

  grid.innerHTML = venues
    .map((venue, i) => {
      // Cycle through color classes for visual variety
      const colorClass = VENUE_COLORS[i % VENUE_COLORS.length];
      const bg = venue.photoDataUrl
        ? `style="background-image:url('${venue.photoDataUrl}')"`
        : "";
      return `
        <article class="venue-card" data-venue="${escapeHtml(venue.id)}" tabindex="0">
          <div class="venue-card-header ${colorClass}" ${bg}>
            ${escapeHtml(venue.name)}
          </div>
          <div class="venue-card-body">
            <div class="venue-title">${escapeHtml(venue.name)}</div>
            <div class="venue-address"><h5>${escapeHtml(venue.address)}</h5></div>
          </div>
        </article>
      `;
    })
    .join("");

  // Wire up click and keyboard events on all venue cards
  grid.querySelectorAll(".venue-card[data-venue]").forEach((card) => {
    const id = card.dataset.venue;
    card.addEventListener("click", () => displayVenueDetail(id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        displayVenueDetail(id);
      }
    });
  });

  // Keep the venue dropdown in the booking form in sync with the venue list
  populateVenueSelect(venues);

  // Restore the selected state highlight if a venue was active
  if (activeVenue) {
    setActiveVenueCard(activeVenue);
  }
}

// [populateVenueSelect]: Updates the venue <select> dropdown in the Event Application
// form whenever the venue list changes. Preserves the currently selected value if it
// still exists in the new list.
function populateVenueSelect(venues) {
  const select = document.getElementById("eventVenue");
  if (!select) return;
  const current = select.value; // Remember what was selected before we wipe the options
  select.innerHTML = '<option value="">-- Choose a venue --</option>';
  venues.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} (Capacity: ${v.capacity || 'Not specified'})`;
    select.appendChild(opt);
  });
  // Restore the previous selection after rebuilding the options
  if (current) select.value = current;
}

// [displayVenueDetail]: Populates the right-hand detail panel with the selected
// venue's info and renders its availability calendar. Resets all calendar state
// so the user starts with a clean view. Called when a venue card is clicked.
function displayVenueDetail(venueId) {
  const venue = studentVenueData[venueId];
  if (!venue) return;

  // Reset all calendar state for the newly selected venue
  activeVenue = venueId;
  selectedCalendarDay = null;
  selectedCalendarTime = "";
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();

  // Populate the detail panel with the venue's information
  document.getElementById("detailVenueName").textContent = venue.name;
  document.getElementById("venueDescription").textContent = venue.description;
  if (document.getElementById("venueCapacity")) document.getElementById("venueCapacity").textContent = venue.capacity || "Not specified";
  document.getElementById("venueAddress").textContent = venue.address;
  document.getElementById("venueAvailabilityText").textContent = venue.availability;

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}


// =============================================
// CALENDAR — Availability Display & Day Selection
// =============================================

/**
 * getDayAvailabilityStatus(venueId, day)
 * Checks how many of the venue's time slots are booked on a specific day and
 * returns a CSS class name to color-code the calendar cell:
 * - "booked"    = all slots taken (red)
 * - "partial"   = some slots taken (orange)
 * - "available" = no slots taken (green)
 * - "neutral"   = no slot data available
 */
// [getDayAvailabilityStatus]: Determines the color-coding status of a calendar day
// by counting how many of its time slots are already booked vs. available.
function getDayAvailabilityStatus(venueId, day) {
  const venue = studentVenueData[venueId];
  if (!venue) return "neutral";

  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const bookedCount = slots.filter((s) => s.booked).length;
  const totalSlots = slots.length;

  if (totalSlots === 0) return "neutral";
  if (bookedCount >= totalSlots) return "booked";    // All slots taken
  if (bookedCount > 0) return "partial";             // Some slots taken
  return "available";                                // All slots free
}

// [renderVenueCalendar]: Builds and injects the full calendar grid HTML for the
// currently viewed month. Each day is rendered as a button with the correct
// availability color. Past and blacked-out days are disabled.
function renderVenueCalendar(venueId) {
  const calendarDates = document.getElementById("venueCalendarDates");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const venue = studentVenueData[venueId];
  if (!calendarDates || !venue) return;

  if (monthLabel) {
    monthLabel.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${viewCalendarYear}`;
  }

  // Calculate the first day of the month and total days in the month
  const firstDay = new Date(viewCalendarYear, viewCalendarMonth, 1).getDay();
  const daysInMonth = new Date(viewCalendarYear, viewCalendarMonth + 1, 0).getDate();

  let html = "";

  // Add empty placeholder cells to align the first day with the correct weekday column
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-date empty" aria-hidden="true"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
    const isPast = isDateInPast(day, viewCalendarMonth, viewCalendarYear);
    const isBlackedOut = isVenueBlackedOut(venue, dateStr);
    const status = getDayAvailabilityStatus(venueId, day);
    const isSelected = selectedCalendarDay === day;

    let cellClass = `calendar-date ${status}`;
    let isDisabled = false;

    if (isPast) {
      cellClass = "calendar-date past";
      isDisabled = true;
    } else if (isBlackedOut) {
      cellClass = "calendar-date blackout";
      isDisabled = true;
    } else if (status === "booked") {
      // Fully booked days are shown but cannot be clicked
      isDisabled = true;
    }

    if (isSelected && !isDisabled) cellClass += " is-selected";

    html += `
      <button type="button" class="${cellClass}" data-day="${day}"${isDisabled ? " disabled" : ""}>
        <span class="day-number">${day}</span>
      </button>
    `;
  }

  calendarDates.innerHTML = html;

  // Wire up click handlers for enabled day cells
  calendarDates.querySelectorAll(".calendar-date[data-day]:not([disabled])").forEach((cell) => {
    cell.addEventListener("click", () => selectCalendarDay(venueId, Number(cell.dataset.day)));
  });

  // If there was a previously selected day, try to restore it in the new month view
  if (selectedCalendarDay && selectedCalendarDay <= daysInMonth && selectedCalendarDay >= 1) {
    const selectedCell = calendarDates.querySelector(`.calendar-date[data-day="${selectedCalendarDay}"]`);
    if (selectedCell && !selectedCell.disabled) {
      updateCalendarDayDetail(venueId, selectedCalendarDay);
    } else {
      // Previously selected day is not available in this month — reset
      selectedCalendarDay = null;
      const detailPanel = document.getElementById("calendarDayDetail");
      if (detailPanel) detailPanel.hidden = true;
    }
  } else {
    selectedCalendarDay = null;
    const detailPanel = document.getElementById("calendarDayDetail");
    if (detailPanel) detailPanel.hidden = true;
  }
}

// [selectCalendarDay]: Sets the newly clicked day as selected, highlights it,
// resets the time selection, and reveals the time slot detail panel below the calendar.
function selectCalendarDay(venueId, day) {
  selectedCalendarDay = day;
  selectedCalendarTime = ""; // Reset time selection whenever a new day is chosen

  // Visually highlight the clicked cell
  document.querySelectorAll("#venueCalendarDates .calendar-date[data-day]").forEach((cell) => {
    cell.classList.toggle("is-selected", Number(cell.dataset.day) === day);
  });

  updateCalendarDayDetail(venueId, day);
}

/**
 * updateCalendarDayDetail(venueId, day)
 * Shows the time slot detail panel beneath the calendar for a selected day.
 * Each slot is shown as either clickable (available) or a disabled label (booked).
 * The currently selected time slot is highlighted with a checkmark.
 */
// [updateCalendarDayDetail]: Renders the time slot list below the calendar for the
// selected date. Handles past dates, blacked-out dates, and fully booked dates with
// appropriate messages. Wires up click handlers for available slots.
function updateCalendarDayDetail(venueId, day) {
  const detailPanel = document.getElementById("calendarDayDetail");
  const detailTitle = document.getElementById("calendarDayDetailTitle");
  const detailTimes = document.getElementById("calendarDayTimes");
  if (!detailPanel || !detailTitle || !detailTimes) return;

  if (!day || !studentVenueData[venueId]) {
    detailPanel.hidden = true;
    return;
  }

  const venue = studentVenueData[venueId];
  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);

  // Show a message instead of slots if the date cannot be booked at all
  if (isDateInPast(day, viewCalendarMonth, viewCalendarYear)) {
    detailPanel.hidden = false;
    detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">This date has already passed and cannot be booked.</li>';
    return;
  }
  if (isVenueBlackedOut(venue, dateStr)) {
    detailPanel.hidden = false;
    detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">This date has been marked as unavailable by the faculty.</li>';
    return;
  }

  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const bookedCount = slots.filter((s) => s.booked).length;

  detailPanel.hidden = false;

  if (bookedCount >= slots.length) {
    // All slots are taken — show the "Fully Booked" label in the heading
    detailTitle.innerHTML = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — <span class="fully-booked-label">Fully Booked</span>`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">All time slots are booked for this date.</li>';
    return;
  }

  const heading = bookedCount > 0 ? "Limited availability" : "Available times";
  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — ${heading}`;

  // Render each slot as either a clickable available item or a disabled booked item
  detailTimes.innerHTML = slots.map((slot) => {
    if (slot.booked) {
      return `
        <li class="time-slot-item time-slot-item--booked" aria-disabled="true">
          <span class="time-slot-time">${escapeHtml(formatTime12h(slot.time))}</span>
          <span class="time-slot-badge time-slot-badge--booked">Booked</span>
        </li>`;
    }
    const isSelected = selectedCalendarTime === slot.time;
    return `
      <li class="time-slot-item time-slot-item--available${isSelected ? " time-slot-item--selected" : ""}"
          data-time="${escapeHtml(slot.time)}" tabindex="0" role="button">
        <span class="time-slot-time">${escapeHtml(formatTime12h(slot.time))}</span>
        <span class="time-slot-badge time-slot-badge--available">${isSelected ? "✓ Selected" : "Available"}</span>
      </li>`;
  }).join("");

  // Wire up click and keyboard events for available (selectable) slot items
  detailTimes.querySelectorAll(".time-slot-item--available").forEach((item) => {
    item.addEventListener("click", () => {
      selectedCalendarTime = item.dataset.time;
      // Re-render to update the visual selection state
      updateCalendarDayDetail(venueId, day);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectedCalendarTime = item.dataset.time;
        updateCalendarDayDetail(venueId, day);
      }
    });
  });
}

// [shiftCalendarMonth]: Moves the calendar forward or backward by one month
// when the prev/next arrows are clicked. Clamps the month to 0–11 and
// adjusts the year accordingly.
function shiftCalendarMonth(delta) {
  viewCalendarMonth += delta;
  if (viewCalendarMonth < 0) { viewCalendarMonth = 11; viewCalendarYear -= 1; }
  else if (viewCalendarMonth > 11) { viewCalendarMonth = 0; viewCalendarYear += 1; }

  // Clear day/time selection because they belong to a different month now
  selectedCalendarDay = null;
  selectedCalendarTime = "";
  if (activeVenue) renderVenueCalendar(activeVenue);
}


// =============================================
// EVENT APPLICATION FORM — Booking Logic
// =============================================

// [updateAvailableTimeSlots]: Updates the time slot dropdown in the Event Application
// form based on the currently selected venue and date. Filters out already-booked
// slots so students can only pick available ones.
function updateAvailableTimeSlots() {
  const venueSelect = document.getElementById("eventVenue");
  const dateInput = document.getElementById("eventDate");
  const timeSelect = document.getElementById("eventTime");
  if (!venueSelect || !dateInput || !timeSelect) return;

  const venueName = venueSelect.value;
  const dateStr = dateInput.value;

  const currentValue = timeSelect.value; // Remember current selection
  timeSelect.innerHTML = '<option value="">-- Choose a time slot --</option>';

  if (!venueName || !dateStr) return;

  const venue = allVenuesList.find(v => v.name === venueName);
  if (!venue) return;

  // Parse the date string into year/month/day integers for the slot helpers
  const parts = dateStr.split("-");
  if (parts.length !== 3) return;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Convert from 1-indexed to 0-indexed
  const day = parseInt(parts[2], 10);

  const slots = getVenueTimeSlotsForDay(venue, day, month, year);

  const isPast = isDateInPast(day, month, year);
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  // Don't populate slots for dates that can't be booked
  if (isPast || isBlackedOut) return;

  // Only show slots that aren't already booked
  slots.forEach(slot => {
    if (!slot.booked) {
      const opt = document.createElement("option");
      opt.value = slot.time;
      opt.textContent = formatTime12h(slot.time);
      timeSelect.appendChild(opt);
    }
  });

  // Restore the previously selected value if it's still in the list
  if (currentValue) timeSelect.value = currentValue;
}

// [openReservationWithVenue]: Pre-fills the Event Application form with the venue
// name and the calendar-selected date/time, then navigates to the form view.
// Called when the "Book Now" button is clicked from the venue detail panel.
function openReservationWithVenue(venueName) {
  const select = document.getElementById("eventVenue");
  const dateInput = document.getElementById("eventDate");
  const timeInput = document.getElementById("eventTime");

  // Pre-select the venue that was active when Book Now was clicked
  if (select) select.value = venueName;

  // Pre-fill the date from the calendar selection if one was made
  if (dateInput && selectedCalendarDay) {
    dateInput.value = formatDateString(viewCalendarYear, viewCalendarMonth, selectedCalendarDay);
  }

  // Populate the time slot options based on the venue and date
  updateAvailableTimeSlots();

  // Pre-select the time slot if the student had clicked one on the calendar
  if (timeInput && selectedCalendarTime) {
    // Check if the selected time is already in the dropdown options
    let found = false;
    for (let i = 0; i < timeInput.options.length; i++) {
      if (timeInput.options[i].value === selectedCalendarTime) { found = true; break; }
    }
    if (!found) {
      // Add it as an option if it wasn't there (edge case for manually selected times)
      const opt = document.createElement("option");
      opt.value = selectedCalendarTime;
      opt.textContent = formatTime12h(selectedCalendarTime);
      timeInput.appendChild(opt);
    }
    timeInput.value = selectedCalendarTime;
  }

  switchView("schedule-view", document.querySelector('[data-view="schedule-view"]'));
}

// [editEvent]: Pre-fills the Event Application form with the data from an existing
// proposal so the student can submit a corrected version. Sets editingProposalId
// so the submission handler knows to cancel the old proposal after submitting.
function editEvent(id) {
  const proposals = loadProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return;

  editingProposalId = id;

  // Pre-fill all form fields with the existing proposal's data
  document.getElementById("eventTitle").value = proposal.title || "";
  document.getElementById("StudOrg").value = proposal.org || "";
  document.getElementById("eventDate").value = proposal.date || "";
  document.getElementById("attendees").value = proposal.attendees || "";

  // Ensure the old venue is present in the dropdown before selecting it
  const venueSelect = document.getElementById("eventVenue");
  if (venueSelect) {
    const opts = Array.from(venueSelect.options);
    if (!opts.find(o => o.value === proposal.venue)) {
       const o = document.createElement("option");
       o.value = proposal.venue;
       o.text = proposal.venue;
       venueSelect.appendChild(o);
    }
    venueSelect.value = proposal.venue;
  }

  // Populate time slots for the pre-filled venue/date, then select the old time
  updateAvailableTimeSlots();
  const timeInput = document.getElementById("eventTime");
  if (timeInput && proposal.time) {
    let matchingValue = "";
    // Search existing options for a time that matches the proposal's time
    for (let i = 0; i < timeInput.options.length; i++) {
      if (timesAreEqual(timeInput.options[i].value, proposal.time)) {
        matchingValue = timeInput.options[i].value;
        break;
      }
    }

    if (!matchingValue) {
      // The slot isn't in the dropdown yet (e.g., it was since booked by someone else)
      // Add it so the student can see it but still change it
      const venue = allVenuesList.find(v => v.name === proposal.venue);
      if (venue) {
        const slots = getDayTimeSlots(venue, proposal.date);
        const matchingSlot = slots.find(slot => timesAreEqual(slot, proposal.time));
        if (matchingSlot) {
          const opt = document.createElement("option");
          opt.value = matchingSlot;
          opt.textContent = formatTime12h(matchingSlot);
          timeInput.appendChild(opt);
          matchingValue = matchingSlot;
        }
      }
    }

    if (matchingValue) timeInput.value = matchingValue;
  }

  // If the old proposal had a PDF, make it optional so the student doesn't have to re-upload
  const pdfInput = document.getElementById("eventPdf");
  if (pdfInput && proposal.pdfDataUrl) {
    pdfInput.required = false;
    document.getElementById("pdfFileName").textContent = `Current: ${proposal.pdfName || "letter-request.pdf"}`;
  }

  switchView("schedule-view", document.querySelector('[data-view="schedule-view"]'));
  document.getElementById("workspaceTitle").textContent = "Edit Event Application";
}

// [handleFormSubmission]: Main form submit handler for the Event Application form.
// Validates all fields, builds a FormData object with the event details and PDF,
// sends it to the backend API, and shows a success modal on completion. If editing
// an existing proposal, it also cancels the old one after the new one is submitted.
async function handleFormSubmission(e) {
  e.preventDefault(); // Prevent the default page-reload form submit

  // Let the browser's built-in validation run first before our custom logic
  const form = document.getElementById("scheduleForm");
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const title = document.getElementById("eventTitle").value.trim();
  const org = document.getElementById("StudOrg").value.trim();
  const venueName = document.getElementById("eventVenue").value;
  const date = document.getElementById("eventDate").value;
  const timeSlot = document.getElementById("eventTime").value;
  // Convert the selected slot from "8:00 AM - 11:00 AM" to "08:00" for the backend
  const time = getStartHour24h(timeSlot);
  const attendees = document.getElementById("attendees").value;
  const pdfInput = document.getElementById("eventPdf");
  const pdfFile = pdfInput.files[0];

  // PDF is required for new submissions but optional when editing (student may keep existing PDF)
  if (!pdfFile && !editingProposalId) {
    alert("Please attach a letter request PDF before submitting.");
    return;
  }

  const selectedVenue = allVenuesList.find(v => v.name === venueName);
  if (!selectedVenue) {
    alert("Please choose a valid venue.");
    return;
  }

  // Use FormData to send both text fields and the binary PDF file in one request
  const formData = new FormData();
  formData.append("title", title);
  formData.append("department", org);
  formData.append("venueId", selectedVenue.id);
  formData.append("eventDate", date);
  formData.append("startTime", time);
  formData.append("expectedAttendees", parseInt(attendees, 10));
  if (pdfFile) {
    formData.append("submitLetter", pdfFile);
  }

  try {
    const response = await apiFetch("/api/events", {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.backendMessage || "Failed to submit event proposal.");
      return;
    }

    // If editing, cancel the old (pending_reviewed) proposal now that a new one was submitted
    if (editingProposalId) {
      const oldProposal = myEventsList.find(p => p.id === editingProposalId);
      if (oldProposal) {
        await apiFetch(`/api/events/${oldProposal.eventId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled", reason: "Superseded by new request" })
        });
      }
      editingProposalId = null;
    }

    addNotification(`Proposal "${title}" submitted. Awaiting faculty review.`, "Just now");
    showSuccessModal();
  } catch (err) {
    console.error("Failed to submit event:", err);
    alert("An error occurred during submission.");
  }
}


// =============================================
// CANCEL EVENT FLOW — Multi-Step Confirmation
// =============================================

// [cancelEvent]: Initiates the cancel flow by storing the target proposal ID
// and showing the cancel reason selection modal. Called from the event list.
function cancelEvent(id) {
  cancelEventId = id;
  const reasonSelect = document.getElementById("cancelReason");
  if (reasonSelect) reasonSelect.value = ""; // Reset the reason dropdown
  document.getElementById("cancelReasonModal")?.classList.remove("hidden");
}

// [closeCancelReasonModal]: Hides the cancel reason modal and resets the target ID.
function closeCancelReasonModal() {
  document.getElementById("cancelReasonModal")?.classList.add("hidden");
  cancelEventId = null;
}

// [confirmCancellation]: Moves from the reason selection modal to the final
// "Are you sure?" confirmation modal. Called on the cancel reason form submit.
function confirmCancellation() {
  if (!cancelEventId) return;
  document.getElementById("cancelReasonModal")?.classList.add("hidden");
  document.getElementById("cancelConfirmModal")?.classList.remove("hidden");
}

// [closeCancelConfirmModal]: Hides the final confirmation modal and resets the target ID.
function closeCancelConfirmModal() {
  document.getElementById("cancelConfirmModal")?.classList.add("hidden");
  cancelEventId = null;
}

// [executeCancellation]: The final step of the cancel flow. Sends the PATCH request
// to set the event's status to "cancelled" with the selected reason, then refreshes
// the dashboard.
async function executeCancellation() {
  if (!cancelEventId) return;

  const reasonSelect = document.getElementById("cancelReason");
  const reason = reasonSelect ? reasonSelect.value : "";
  const proposal = myEventsList.find((p) => p.id === cancelEventId);
  if (!proposal) return;

  try {
    const response = await apiFetch(`/api/events/${proposal.eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason: reason })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.backendMessage || "Failed to cancel event.");
      closeCancelConfirmModal();
      return;
    }
    addNotification(`Event "${proposal.title}" has been cancelled.`, "Just now");
  } catch (err) {
    console.error("Failed to cancel event:", err);
    alert("An error occurred while cancelling the event.");
  }

  closeCancelConfirmModal();
  await refreshAll();
}



// =============================================
// SUCCESS MODAL
// =============================================

// [showSuccessModal]: Displays the booking submission success modal.
function showSuccessModal() {
  document.getElementById("successModal")?.classList.remove("hidden");
}

// [closeSuccessModal]: Hides the success modal, resets the booking form,
// and navigates back to the dashboard view.
function closeSuccessModal() {
  document.getElementById("successModal")?.classList.add("hidden");
  document.getElementById("scheduleForm")?.reset();

  // Restore the PDF field to required for the next fresh submission
  const pdfInput = document.getElementById("eventPdf");
  if (pdfInput) pdfInput.required = true;

  updatePdfFileDisplay();
  switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  refreshAll();
}


// =============================================
// PDF PREVIEW MODAL
// =============================================

// [openPdfPreview]: Opens the fullscreen PDF viewer modal and loads the given URL.
// Called when "Fullscreen" is clicked on a proposal card's PDF preview.
function openPdfPreview(url, title) {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  const titleEl = document.getElementById("pdfPreviewTitle");
  if (!modal || !iframe) return;
  iframe.src = url;
  if (titleEl) titleEl.textContent = title ? `Letter Request Preview - ${title}` : "Letter Request Preview";
  modal.classList.remove("hidden");
}

// [closePdfPreview]: Hides the PDF preview modal and clears the iframe src
// to stop the PDF from continuing to load in the background.
function closePdfPreview() {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  if (modal) modal.classList.add("hidden");
  if (iframe) iframe.src = ""; // Clear src to release memory and stop loading
}


// =============================================
// DOM CONTENT LOADED — Student Dashboard Entry Point
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  // --- SIDEBAR: Menu item navigation ---
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  // Restore the last active view from sessionStorage on page reload
  const savedView = sessionStorage.getItem("studentActiveView");
  if (savedView) {
    const menuItem = document.querySelector(`.menu-item[data-view="${savedView}"]`);
    switchView(savedView, menuItem);
  }

  // Venue Directory Filters
  document.getElementById("venueSearchQuery")?.addEventListener("input", renderStudentVenueGrid);
  document.getElementById("venueCapacityFilter")?.addEventListener("change", renderStudentVenueGrid);

  // --- LANDING OVERLAY: Role selection buttons ---
  document.getElementById("student-btn")?.addEventListener("click", () => {
    window.location.href = "users.html";
  });
  document.getElementById("faculty-btn")?.addEventListener("click", () => {
    window.location.href = "faculty.html";
  });

  // --- HEADER: Notification bell, profile dropdown, theme toggle ---
  document.getElementById("notificationBell")?.addEventListener("click", toggleNotificationPopup);

  document.getElementById("profileButton")?.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent the document-level click listener from immediately closing it
    toggleProfileDropdown();
  });

  // Close the profile dropdown when the user clicks anywhere else on the page
  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });

  // Profile & Settings modal wiring (from shared.js)
  initializeProfileAndSettingsModals("student");

  // Dark mode toggle inside the profile dropdown
  (function initThemeToggleStudent() {
    const toggle = document.getElementById("themeToggleStudent");
    if (!toggle || typeof loadTheme !== "function") return;
    try {
      // Sync the toggle's checked state with the saved preference
      toggle.checked = loadTheme("student") === "dark";
    } catch {}
    toggle.addEventListener("change", () => {
      const next = toggle.checked ? "dark" : "light";
      if (typeof saveTheme === "function") saveTheme("student", next);
      if (typeof applyTheme === "function") applyTheme(next);
    });
  })();

  // --- DASHBOARD VIEW: Book Now CTA ---
  document.getElementById("dashboardBookNowBtn")?.addEventListener("click", () => {
    switchView("venues-view", document.querySelector('[data-view="venues-view"]'));
  });

  // --- VENUE DIRECTORY VIEW: Book Now button in the detail panel ---
  document.getElementById("bookNowBtn")?.addEventListener("click", () => {
    if (!activeVenue) {
      alert("Please select a venue before booking.");
      return;
    }
    const venue = studentVenueData[activeVenue];
    openReservationWithVenue(venue?.name || "");
  });

  // Calendar prev/next month navigation
  document.getElementById("calendarPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calendarNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));

  // --- EVENT APPLICATION FORM ---
  document.getElementById("scheduleForm")?.addEventListener("submit", handleFormSubmission);

  // Update the time slot dropdown whenever the venue or date changes
  document.getElementById("eventVenue")?.addEventListener("change", updateAvailableTimeSlots);
  document.getElementById("eventDate")?.addEventListener("change", updateAvailableTimeSlots);

  // Cancel button resets the form and returns to the dashboard
  document.getElementById("scheduleCancelBtn")?.addEventListener("click", () => {
    document.getElementById("scheduleForm")?.reset();
    const pdfInput = document.getElementById("eventPdf");
    if (pdfInput) pdfInput.required = true;
    updatePdfFileDisplay();
    editingProposalId = null;
    switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  });

  // Initialize the PDF drag-and-drop upload zone
  initializePdfDropzone();

  // --- CANCEL REASON MODAL ---
  document.getElementById("cancelReasonForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    confirmCancellation();
  });
  document.getElementById("cancelReasonClose")?.addEventListener("click", closeCancelReasonModal);
  document.getElementById("cancelReasonCancel")?.addEventListener("click", closeCancelReasonModal);
  document.getElementById("cancelReasonOverlay")?.addEventListener("click", closeCancelReasonModal);

  // --- CANCEL CONFIRMATION MODAL ---
  document.getElementById("cancelConfirmNoBtn")?.addEventListener("click", closeCancelConfirmModal);
  document.getElementById("cancelConfirmOverlay")?.addEventListener("click", closeCancelConfirmModal);
  document.getElementById("cancelConfirmYesBtn")?.addEventListener("click", executeCancellation);

  // --- SUCCESS MODAL ---
  document.getElementById("successModalBtn")?.addEventListener("click", closeSuccessModal);
  document.getElementById("successModalOverlay")?.addEventListener("click", closeSuccessModal);

  // --- PDF PREVIEW MODAL ---
  document.getElementById("closePdfPreviewBtn")?.addEventListener("click", closePdfPreview);
  document.getElementById("pdfPreviewOverlay")?.addEventListener("click", closePdfPreview);

  // Update the unread count badge immediately (notifications load in the background)
  updateNotificationBadge();

  // --- SESSION START: Auto-start if the user is already logged in ---
  const params = new URLSearchParams(window.location.search);
  const session = getAuthSession();
  if (params.get("role") === "Student" || (session.accessToken && session.role?.toLowerCase() === "student")) {
    // User is a logged-in student — show the full dashboard
    startSession();
  } else if (session.accessToken && session.role?.toLowerCase() === "faculty") {
    // A faculty member landed here by mistake — send them to their dashboard
    window.location.href = "faculty-dash.html";
  } else {
    // No valid session — show the landing overlay so user can pick a role
    const overlay = document.getElementById("landingOverlay");
    if (overlay) overlay.style.display = "flex";
  }

  // Listen for changes in other open tabs so the dashboard stays in sync
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS || e.key === STORAGE_KEYS.VENUES) refreshAll();
  });
  window.addEventListener("eventsync-proposals-updated", refreshAll);

  // Poll for changes from other devices every 10 seconds to keep dynamic screens in sync
  setInterval(refreshAll, 10000);
});
