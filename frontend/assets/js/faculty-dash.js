// =============================================
// faculty-dash.js — Faculty Dashboard (faculty-dash.html)
// Handles venue management (add/edit/delete), student proposal review
// (accept/pending reviewed), schedule tracking, day-level slot editing
// via the Day Manager, and the Audit Logs view.
// Depends on shared.js being loaded first.
// =============================================


// =============================================
// GLOBAL STATE VARIABLES
// =============================================

// The ID of the venue currently selected and shown in the detail panel
let activeVenue = null;

// The calendar month/year currently visible (changes with prev/next arrow clicks)
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();

// The day number (1–31) the faculty has clicked on the calendar
let selectedCalendarDay = null;

// Fast-lookup map of venue objects by ID (rebuilt after each data refresh)
let facultyVenueData = {};

// Tracks whether the Add Venue modal is in "edit" mode (null = adding new)
let editingVenueId = null;

// Tracks which venue is pending deletion in the confirmation modal
let deleteVenueId = null;

// The venue and day currently open in the Day Manager panel
let dayManagerVenueId = null;
let dayManagerDay = null;

// In-memory lists fetched from the server
let allFacultyVenuesList = [];
let allFacultyProposalsList = [];
let allAuditLogs = [];


// =============================================
// DATA LOADING — SERVER API CALLS
// =============================================

// [loadFacultyVenues]: Fetches all venues from the backend and normalizes them
// into the shape used throughout this file. Called on page load and after changes.
async function loadFacultyVenues() {
  try {
    const response = await apiFetch("/api/venues");
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        allFacultyVenuesList = result.data.map(v => ({
          id: v.venueId,
          name: v.name,
          address: v.address,
          capacity: v.capacity,
          description: v.description,
          availability: v.availability,
          status: v.status,
          // Build a full URL for the venue photo from the server's relative path
          photoDataUrl: v.photoPath ? (v.photoPath.startsWith("data:") ? v.photoPath : `${baseUrl}/${v.photoPath.replace(/\\/g, "/")}`) : "",
          timeSlots: v.timeSlots || [],
          facilities: v.facilities || []
        }));
        return allFacultyVenuesList;
      }
    }
  } catch (err) {
    console.error("Failed to load venues:", err);
  }
  return [];
}

// [loadEventsFromServer]: Fetches all student event proposals from the backend
// across "pending", "approved", and "rejected" statuses. Maps venue IDs to names
// and normalizes internal status labels for consistency across the UI.
async function loadEventsFromServer() {
  try {
    const statuses = ["pending", "approved", "rejected"];

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

    allFacultyProposalsList = results.flat().map(e => ({
      id: `proposal-${e.eventId}`,
      eventId: e.eventId,
      title: e.title,
      org: e.department,
      studentNumber: e.organizer && e.organizer.studentNumber
        ? e.organizer.studentNumber
        : (e.organizerId ? String(e.organizerId) : "Unknown"),
      // Resolve venue name from ID, falling back to a generic label
      venue: allFacultyVenuesList.find(v => v.id === e.venueId)?.name || `Venue #${e.venueId}`,
      venueId: e.venueId,
      date: e.eventDate ? e.eventDate.split("T")[0] : "",
      time: e.startTime,
      attendees: e.expectedAttendees,
      pdfName: e.submitLetterPath ? e.submitLetterPath.split("/").pop() : "letter-request.pdf",
      pdfDataUrl: e.submitLetterPath ? `${baseUrl}/${e.submitLetterPath.replace(/\\/g, "/")}` : "",
      // Map backend status names to internal labels used across the UI
      status: e.status === "approved" ? "accepted" : (e.status === "rejected" ? "pending_reviewed" : e.status),
      rejectionReason: e.reason || "",
      submittedAt: e.createdAt
    }));
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

// [loadVenues]: Returns the current in-memory list of faculty venues.
function loadVenues() {
  return allFacultyVenuesList;
}

// [saveVenues]: Placeholder for venue save operations.
// Currently, all venue mutations go directly to the backend API.
function saveVenues(venues) {
  // Intentionally empty — venue data is managed server-side
}

// [loadProposals]: Returns the current in-memory list of student proposals.
function loadProposals() {
  return allFacultyProposalsList;
}

// [buildVenueDataMap]: Converts the flat venue array into a key-value map for
// fast O(1) lookups by venue ID. Stored in facultyVenueData after each refresh.
function buildVenueDataMap(venues) {
  const map = {};
  venues.forEach((v) => { map[v.id] = v; });
  return map;
}

// [refreshAll]: Master refresh function. Re-fetches all data from the server
// and then re-renders every section of the faculty dashboard. Called on load
// and after any user action that modifies data.
async function refreshAll() {
  await loadFacultyVenues();
  await loadEventsFromServer();
  if (typeof loadNotificationsFromServer === "function") {
    await loadNotificationsFromServer();
  }
  renderFacultyVenueGrid();
  renderFacultySchedule();
  renderProposals();
  updateDashboardStats();
}


// =============================================
// SIDEBAR — View Navigation
// =============================================

// [switchView]: Shows the selected content section and hides all others.
// Updates the page title in the navbar, highlights the active sidebar item,
// saves the current view to sessionStorage, and triggers lazy data loading
// for sections that only fetch data when opened (proposals, logs).
function switchView(viewId, element) {
  // Hide all content sections first
  document.querySelectorAll(".view-section").forEach((v) => v.classList.remove("active-view"));
  document.getElementById(viewId)?.classList.add("active-view");

  // Map view IDs to their display titles shown in the navbar
  const titles = {
    "dashboard-view": "Dashboard Overview",
    "venues-view": "Venue Directory",
    "proposals-view": "Proposed Events",
    "logs-view": "System Audit Logs",
  };
  const titleEl = document.getElementById("workspaceTitle");
  if (titleEl) titleEl.textContent = titles[viewId] || "Dashboard";

  // Highlight the active sidebar item
  if (element) {
    document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }

  // Remember the active view so it's restored after a page refresh
  sessionStorage.setItem("facultyActiveView", viewId);

  // Lazy-load section data only when its view is actually opened
  if (viewId === "proposals-view") renderProposals();
  if (viewId === "logs-view") {
    loadAuditLogs().then(renderAuditLogs);
  }
}


// =============================================
// HEADER / NAVBAR — Profile & Notifications
// =============================================
// (Listeners are wired in DOMContentLoaded below.
//  toggleNotificationPopup, toggleProfileDropdown, etc. are in shared.js)


// =============================================
// DASHBOARD VIEW — Stats & Schedule Tracker
// =============================================

// [updateDashboardStats]: Calculates and displays the four summary numbers in
// the stat cards at the top of the Dashboard view. Called after every data refresh.
function updateDashboardStats() {
  const proposals = loadProposals();
  const venues = loadVenues();
  const active = proposals.filter((p) => p.status === "accepted").length;
  const pending = proposals.filter((p) => p.status === "pending").length;
  const pendingReviewed = proposals.filter((p) => p.status === "pending_reviewed").length;

  document.getElementById("countActive").textContent = active;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countPendingReviewed").textContent = pendingReviewed;
  // Count only venues the server marks as "available"
  document.getElementById("countVenues").textContent = venues.filter(v => (v.status || "").toLowerCase() === "available").length;
}

// [renderFacultySchedule]: Builds and renders the "Live Tracking & Schedules" list
// on the Dashboard view. Shows all non-cancelled/non-rejected proposals as schedule
// cards with their status pill.
function renderFacultySchedule() {
  const list = document.getElementById("facultyScheduleList");
  const countBadge = document.getElementById("scheduleTrackerCount");
  if (!list) return;

  // Exclude proposals that are fully done or cancelled from the live tracker
  const proposals = loadProposals().filter((p) => p.status !== "pending_reviewed" && p.status !== "cancelled");

  if (countBadge) {
    countBadge.textContent = `${proposals.length} event${proposals.length === 1 ? "" : "s"}`;
  }

  if (!proposals.length) {
    list.innerHTML = '<p class="empty-state">No scheduled events to display yet.</p>';
    return;
  }

  const statusMap = {
    pending: { label: "Pending Review", cls: "status-pending" },
    accepted: { label: "Accepted", cls: "status-approved" },
    pending_reviewed: { label: "Pending Reviewed", cls: "status-rejected" },
    cancelled: { label: "Cancelled", cls: "status-cancelled" },
  };

  list.innerHTML = proposals
    .map((p) => {
      const st = statusMap[p.status] || statusMap.pending;
      return `
        <article class="schedule-card" data-id="${escapeHtml(p.id)}">
          <div class="schedule-card-main">
            <h4>${escapeHtml(p.title)}</h4>
            <p class="schedule-card-meta">
              <span>${escapeHtml(p.org)}</span>
              <span class="schedule-card-divider">•</span>
              <span>${escapeHtml(p.venue)}</span>
            </p>
            <p class="schedule-card-datetime">${escapeHtml(p.date)} · ${escapeHtml(formatTime12h(p.time))}</p>
          </div>
          <div class="schedule-card-status">
            <span class="status-pill ${st.cls}">${st.label}</span>
          </div>
        </article>
      `;
    })
    .join("");
}


// =============================================
// VENUE DIRECTORY — Venue Grid & Detail
// =============================================

// [renderFacultyVenueGrid]: Renders all venues as clickable cards in the Venue
// Directory, preceded by the "Add Venue" button. Wires up card click handlers
// and the Add Venue button.
function renderFacultyVenueGrid() {
  const grid = document.getElementById("facultyVenueGrid");
  if (!grid) return;

  const query = document.getElementById("venueSearchQuery")?.value.toLowerCase().trim() || "";
  const minCapacity = parseInt(document.getElementById("venueCapacityFilter")?.value || "0", 10);

  let venues = loadVenues();

  // Apply filters
  if (query) {
    venues = venues.filter(v => 
      v.name.toLowerCase().includes(query) || 
      v.address.toLowerCase().includes(query) ||
      v.description.toLowerCase().includes(query)
    );
  }
  if (minCapacity > 0) {
    venues = venues.filter(v => v.capacity >= minCapacity);
  }

  // Rebuild the lookup map every time the grid is refreshed
  facultyVenueData = buildVenueDataMap(venues);

  const cards = venues
    .map((venue, i) => {
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

  // The "Add Venue" card always appears first in the grid
  grid.innerHTML = `
    <button type="button" class="venue-card venue-card--add" id="openAddVenueBtn" aria-label="Add a new venue">
      <span class="add-venue-icon">+</span>
      <span class="add-venue-label">Add Venue</span>
    </button>
    ${cards}
  `;

  // Wire up click events for each venue card
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

  // Re-attach the Add Venue button listener (it gets replaced when the grid re-renders)
  document.getElementById("openAddVenueBtn")?.addEventListener("click", openAddVenueModal);
  updateDashboardStats();

  // Restore the selected state highlight if a venue was active
  if (activeVenue) {
    setActiveVenueCard(activeVenue);
  }
}

// [displayVenueDetail]: Populates the right-hand panel with the selected venue's
// details and renders its availability calendar. Also shows the Edit/Delete buttons.
// Called when a venue card is clicked.
function displayVenueDetail(venueId) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  // Reset calendar state for the newly selected venue
  activeVenue = venueId;
  selectedCalendarDay = null;
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();

  // Populate the detail panel text fields
  document.getElementById("detailVenueName").textContent = venue.name;
  document.getElementById("venueDescription").textContent = venue.description;
  document.getElementById("venueCapacity").textContent = venue.capacity || "Not specified";
  document.getElementById("venueAddress").textContent = venue.address;
  document.getElementById("venueAvailabilityText").textContent = venue.availability;

  // Show the Edit/Delete action buttons (hidden by default when no venue is selected)
  const deleteBtn = document.getElementById("deleteVenueBtn");
  const editBtn = document.getElementById("editVenueBtn");
  if (deleteBtn) deleteBtn.style.display = "inline-block";
  if (editBtn) editBtn.style.display = "inline-block";

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}

// [resetVenueDetailPanel]: Resets the detail panel back to its default empty state
// after a venue is deleted. Hides the Edit/Delete buttons.
function resetVenueDetailPanel() {
  document.getElementById("detailVenueName").textContent = "Select a Venue";
  document.getElementById("venueDescription").textContent =
    "Pick a venue from the directory to view its details and availability.";
  document.getElementById("venueCapacity").textContent = "-";
  document.getElementById("venueAddress").textContent = "-";
  document.getElementById("venueAvailabilityText").textContent = "-";
  document.getElementById("deleteVenueBtn").style.display = "none";
  document.getElementById("editVenueBtn").style.display = "none";
}


// =============================================
// VENUE DIRECTORY — Calendar (Faculty View)
// =============================================

// [getDayAvailabilityStatus]: Checks the calendar availability data for a single day
// and returns a status string used as a CSS class to color the calendar cell.
function getDayAvailabilityStatus(dayAvailability) {
  if (!dayAvailability) return "neutral";
  if (dayAvailability.booked) return "booked";
  if (dayAvailability.times?.length) return "available";
  return "neutral";
}

// [renderVenueCalendar]: Builds and renders the full calendar grid for the current
// month. Each day cell is color-coded by availability. Past days are disabled;
// blacked-out days remain clickable (so faculty can un-blackout them via Day Manager).
function renderVenueCalendar(venueId) {
  const calendarDates = document.getElementById("venueCalendarDates");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const venue = facultyVenueData[venueId];
  if (!calendarDates || !venue) return;

  if (monthLabel) {
    monthLabel.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${viewCalendarYear}`;
  }

  const availability = venue.calendarAvailability || {};
  const firstDay = new Date(viewCalendarYear, viewCalendarMonth, 1).getDay();
  const daysInMonth = new Date(viewCalendarYear, viewCalendarMonth + 1, 0).getDate();

  let html = "";

  // Pad the grid start with empty cells to align the first day correctly
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-date empty" aria-hidden="true"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
    const isPast = isDateInPast(day, viewCalendarMonth, viewCalendarYear);
    const isBlackedOut = isVenueBlackedOut(venue, dateStr);
    const dayAvailability = availability[day];
    const status = getDayAvailabilityStatus(dayAvailability);
    const isSelected = selectedCalendarDay === day;

    let cellClass;
    let isDisabled = false;

    if (isPast) {
      cellClass = "calendar-date past";
      isDisabled = true; // Faculty cannot edit past dates
    } else if (isBlackedOut) {
      cellClass = "calendar-date blackout";
      // NOTE: Intentionally NOT disabled — faculty must be able to click to un-blackout
    } else {
      cellClass = `calendar-date ${status}`;
    }

    if (isSelected && !isDisabled) cellClass += " is-selected";

    html += `
      <button type="button" class="${cellClass}" data-day="${day}"${isDisabled ? " disabled" : ""}>
        <span class="day-number">${day}</span>
      </button>
    `;
  }

  calendarDates.innerHTML = html;

  // Wire click events on all non-disabled day cells
  calendarDates.querySelectorAll(".calendar-date[data-day]:not([disabled])").forEach((cell) => {
    cell.addEventListener("click", () => selectFacultyDay(venueId, Number(cell.dataset.day)));
  });

  // Restore the previously selected day if it's still valid in this month
  if (selectedCalendarDay && selectedCalendarDay <= daysInMonth && selectedCalendarDay >= 1) {
    const selectedCell = calendarDates.querySelector(`.calendar-date[data-day="${selectedCalendarDay}"]`);
    if (selectedCell) {
      selectFacultyDay(venueId, selectedCalendarDay);
    } else {
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

// [selectFacultyDay]: Highlights the clicked calendar day and renders its time slot
// detail strip below the calendar. Shows which slots are booked vs. available.
// Also sets the "Edit Day" button's data attributes for the Day Manager.
function selectFacultyDay(venueId, day) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  selectedCalendarDay = day;

  // Update visual highlight — only one day can be selected at a time
  document.querySelectorAll(".calendar-date").forEach((c) => c.classList.remove("is-selected"));
  const selectedCell = document.querySelector(`.calendar-date[data-day="${day}"]`);
  if (selectedCell) selectedCell.classList.add("is-selected");

  // Gather the elements for the day detail strip
  const detailPanel = document.getElementById("calendarDayDetail");
  const detailTitle = document.getElementById("calendarDayDetailTitle");
  const detailTimes = document.getElementById("calendarDayTimes");
  const editDayBtn = document.getElementById("editDayBtn");
  if (!detailPanel || !detailTitle || !detailTimes) return;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;

  if (isBlackedOut) {
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">Marked as unavailable by faculty.</li>';
  } else if (!slots.length) {
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">No time slots configured for this date.</li>';
  } else {
    // Render each slot as either "Booked" or "Available"
    detailTimes.innerHTML = slots.map((slot) =>
      slot.booked
        ? `<li class="fac-slot-item fac-slot-booked"><span>${escapeHtml(formatTime12h(slot.time))}</span><span class="fac-slot-badge fac-slot-badge--booked">Booked</span></li>`
        : `<li class="fac-slot-item fac-slot-available"><span>${escapeHtml(formatTime12h(slot.time))}</span><span class="fac-slot-badge fac-slot-badge--available">Available</span></li>`
    ).join("");
  }

  // Store the venue ID and day on the Edit Day button so the handler can read them
  if (editDayBtn) editDayBtn.dataset.venueId = venueId;
  if (editDayBtn) editDayBtn.dataset.day = day;
  detailPanel.hidden = false;
}

// [shiftCalendarMonth]: Moves the calendar forward or backward by one month.
// Clears the selected day and closes the Day Manager since they belong to the old month.
function shiftCalendarMonth(delta) {
  viewCalendarMonth += delta;
  if (viewCalendarMonth < 0) {
    viewCalendarMonth = 11;
    viewCalendarYear -= 1;
  } else if (viewCalendarMonth > 11) {
    viewCalendarMonth = 0;
    viewCalendarYear += 1;
  }
  selectedCalendarDay = null;
  closeDayManager();
  const detailPanel = document.getElementById("calendarDayDetail");
  if (detailPanel) detailPanel.hidden = true;
  if (activeVenue) renderVenueCalendar(activeVenue);
}


// =============================================
// DAY MANAGER — Per-Date Slot & Blackout Editor
// =============================================

// [openDayManager]: Opens the Day Manager modal for a specific venue and date.
// Pre-fills the blackout toggle and time slot editor with the currently saved
// settings for that date. Called from the "Edit Day" button in the detail strip.
function openDayManager(venueId, day) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  dayManagerVenueId = venueId;
  dayManagerDay = day;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  // Set the modal title to the selected date
  document.getElementById("dayManagerTitle").textContent =
    `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;

  // Set the blackout toggle to match the current state of this date
  const blackoutToggle = document.getElementById("blackoutToggle");
  if (blackoutToggle) blackoutToggle.checked = isBlackedOut;

  // Pre-fill the slot editor with the current slots for this date
  const currentSlots = getDayTimeSlots(venue, dateStr);
  renderDynamicSlots("dayManagerSlotsContainer", currentSlots);

  // Grey out the slot editor if the date is already blacked out
  const slotSection = document.getElementById("slotManagerSection");
  if (slotSection) slotSection.style.opacity = isBlackedOut ? "0.4" : "1";
  if (slotSection) slotSection.style.pointerEvents = isBlackedOut ? "none" : "auto";

  const modal = document.getElementById("dayManagerModal");
  if (modal) modal.classList.remove("hidden");
}

// [closeDayManager]: Hides the Day Manager modal and resets its state variables.
function closeDayManager() {
  dayManagerVenueId = null;
  dayManagerDay = null;
  const modal = document.getElementById("dayManagerModal");
  if (modal) modal.classList.add("hidden");
}

// [saveDayManager]: Reads the current state of the Day Manager (blackout toggle +
// slot inputs) and saves it to the local venue data. Refreshes the calendar to
// reflect the changes visually. Note: This saves locally only (backend Day Manager
// persistence is handled through venue slot overrides in localStorage).
function saveDayManager() {
  if (!dayManagerVenueId || !dayManagerDay) return;

  const venues = loadVenues();
  const venue = venues.find((v) => v.id === dayManagerVenueId);
  if (!venue) return;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, dayManagerDay);
  const isBlackedOut = document.getElementById("blackoutToggle")?.checked || false;
  const allSlots = venue.timeSlots || DEFAULT_TIME_SLOTS;

  // Update the blackout dates array — add or remove the date as needed
  if (!venue.blackoutDates) venue.blackoutDates = [];
  const blackoutIdx = venue.blackoutDates.indexOf(dateStr);
  if (isBlackedOut && blackoutIdx === -1) venue.blackoutDates.push(dateStr);
  if (!isBlackedOut && blackoutIdx !== -1) venue.blackoutDates.splice(blackoutIdx, 1);

  // Update the slot override for this date
  if (!venue.daySlotOverrides) venue.daySlotOverrides = {};
  const editedSlots = getDynamicSlots("dayManagerSlotsContainer");

  // Only store an override if the slots are different from the venue's defaults
  if (JSON.stringify(editedSlots) !== JSON.stringify(allSlots)) {
    venue.daySlotOverrides[dateStr] = editedSlots;
  } else {
    // If they match, remove the override so defaults are used
    delete venue.daySlotOverrides[dateStr];
  }

  saveVenues(venues);
  // Update the in-memory map so the calendar re-renders with fresh data
  facultyVenueData[dayManagerVenueId] = venue;
  renderVenueCalendar(dayManagerVenueId);
  addNotification(`Schedule for ${MONTH_NAMES[viewCalendarMonth]} ${dayManagerDay} updated.`, "Just now");
  closeDayManager();
}


// =============================================
// DYNAMIC SLOT EDITOR — Shared Input Builder
// =============================================

// [renderDynamicSlots]: Renders a list of text input rows inside the given container
// element. Each row has an "×" remove button. Used in both the Add Venue modal
// and the Day Manager to let faculty edit time slots visually.
function renderDynamicSlots(containerId, slots) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // Default to one empty slot if none were provided
  if (!slots || slots.length === 0) slots = ["8:00 AM - 11:00 AM"];

  slots.forEach((slotTime) => {
    const row = document.createElement("div");
    row.className = "dynamic-slot-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control dynamic-slot-input";
    // Convert any legacy 24-hour times stored in old data to 12-hour format for display
    input.value = formatTime12h(slotTime);
    input.placeholder = "e.g. 8:00 AM - 11:00 AM";
    input.required = true;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "dynamic-slot-remove";
    removeBtn.innerHTML = "×";
    removeBtn.ariaLabel = "Remove slot";
    removeBtn.onclick = () => row.remove(); // Remove only this row from the DOM

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

// [getDynamicSlots]: Reads all the filled-in time slot input values from a container
// and returns them as an array of non-empty strings. Used when saving venue or day data.
function getDynamicSlots(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const inputs = container.querySelectorAll(".dynamic-slot-input");
  return Array.from(inputs).map(input => input.value.trim()).filter(v => v);
}


// =============================================
// VENUE CRUD — Add / Edit / Delete Modals
// =============================================

// [openAddVenueModal]: Opens the Add Venue modal in "add new" mode.
// Resets all form fields and the photo upload zone to their blank state.
function openAddVenueModal() {
  editingVenueId = null; // null = we are adding, not editing
  document.getElementById("addVenueModalTitle").textContent = "Add New Venue";
  document.getElementById("addVenueSubmitBtn").textContent = "Add Venue";
  document.getElementById("addVenueForm")?.reset();
  document.getElementById("venuePhotoName").textContent = "No file selected";

  // Clear the photo upload zone preview image
  const zone = document.getElementById("venuePhotoZone");
  if (zone) {
    zone.style.backgroundImage = "";
    const span = zone.querySelector("span");
    if (span) span.style.display = "block";
    const label = document.getElementById("venuePhotoName");
    if (label) {
      label.style.background = "";
      label.style.color = "";
      label.style.padding = "";
      label.style.borderRadius = "";
    }
  }

  // Load the default time slot inputs
  renderDynamicSlots("venueSlotsContainer", DEFAULT_TIME_SLOTS);

  document.getElementById("addVenueModal")?.classList.remove("hidden");
}

/**
 * openEditVenueModal(venueId): Opens the Add Venue modal in "edit" mode.
 * Pre-fills all form fields with the existing venue's data.
 */
// [openEditVenueModal]: Re-uses the Add Venue modal for editing. Pre-fills all
// fields with the selected venue's existing data, including the photo preview
// and time slots.
function openEditVenueModal(venueId) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  editingVenueId = venueId; // Flag so the submit handler knows we're editing
  document.getElementById("addVenueModalTitle").textContent = "Edit Venue";
  document.getElementById("addVenueSubmitBtn").textContent = "Save Changes";

  // Pre-fill text fields
  document.getElementById("venueNameInput").value = venue.name;
  document.getElementById("venueAddressInput").value = venue.address;
  document.getElementById("venueCapacityInput").value = venue.capacity || "";
  document.getElementById("venueDescInput").value = venue.description;
  document.getElementById("venueAvailInput").value = venue.availability;
  document.getElementById("venuePhotoName").textContent = venue.photoDataUrl ? "Current photo loaded" : "No file selected";

  // Show the existing photo as a background image in the upload zone
  const zone = document.getElementById("venuePhotoZone");
  if (zone) {
    if (venue.photoDataUrl) {
      zone.style.backgroundImage = `url('${venue.photoDataUrl}')`;
      zone.style.backgroundSize = "cover";
      zone.style.backgroundPosition = "center";
      const span = zone.querySelector("span");
      if (span) span.style.display = "none"; // Hide the "Click to upload" text
      const label = document.getElementById("venuePhotoName");
      if (label) {
        label.style.background = "rgba(15, 23, 42, 0.7)";
        label.style.color = "#fff";
        label.style.padding = "2px 8px";
        label.style.borderRadius = "4px";
      }
    } else {
      zone.style.backgroundImage = "";
      const span = zone.querySelector("span");
      if (span) span.style.display = "block";
      const label = document.getElementById("venuePhotoName");
      if (label) {
        label.style.background = "";
        label.style.color = "";
        label.style.padding = "";
        label.style.borderRadius = "";
      }
    }
  }

  // Pre-fill the time slot editor
  const slots = venue.timeSlots || DEFAULT_TIME_SLOTS;
  renderDynamicSlots("venueSlotsContainer", slots);

  document.getElementById("addVenueModal")?.classList.remove("hidden");
}

// [closeAddVenueModal]: Hides the Add/Edit Venue modal and resets the edit target.
function closeAddVenueModal() {
  document.getElementById("addVenueModal")?.classList.add("hidden");
  editingVenueId = null;
}

/**
 * handleAddVenueSubmit(e): Handles form submission for both adding and editing a venue.
 * Sends the venue data (including photo and time slots) to the backend API.
 */
// [handleAddVenueSubmit]: Collects all form field values including the dynamic time
// slots and photo file, then POSTs them to the backend as a multipart FormData request.
// Shows an error if the backend returns a failure response.
async function handleAddVenueSubmit(e) {
  e.preventDefault();

  // Run browser-native validation before our custom logic
  const form = document.getElementById("addVenueForm");
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const name = document.getElementById("venueNameInput").value.trim();
  const address = document.getElementById("venueAddressInput").value.trim();
  const capacity = document.getElementById("venueCapacityInput").value.trim();
  const description = document.getElementById("venueDescInput").value.trim();
  const availability = document.getElementById("venueAvailInput").value.trim();
  const photoInput = document.getElementById("venuePhotoInput");
  const photoFile = photoInput?.files?.[0];

  let timeSlots = getDynamicSlots("venueSlotsContainer");
  // Ensure at least one slot is present even if all were removed
  if (timeSlots.length === 0) timeSlots = [DEFAULT_TIME_SLOTS[0]];

  const url = editingVenueId ? `/api/venues/${editingVenueId}` : "/api/venues";
  const method = editingVenueId ? "PUT" : "POST";

  // Build the multipart request body
  const formData = new FormData();
  formData.append("name", name);
  formData.append("address", address);
  formData.append("capacity", parseInt(capacity, 10) || 0);
  formData.append("description", description);
  formData.append("availability", availability);
  // Time slots are sent as multiple values with the same key
  timeSlots.forEach(slot => { formData.append("timeslots", slot); });
  if (photoFile) {
    formData.append("photoCover", photoFile);
  }

  try {
    const response = await apiFetch(url, {
      method: method,
      body: formData
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.backendMessage || "Failed to save venue.");
      return;
    }
    if (editingVenueId) {
      addNotification(`Venue "${name}" updated.`, "Just now");
    } else {
      addNotification(`Venue "${name}" added to the directory.`, "Just now");
    }
  } catch (err) {
    console.error("Failed to save venue:", err);
    alert("An error occurred while saving the venue.");
  }

  closeAddVenueModal();
  await refreshAll();
}

// [deleteVenue]: Entry point for the delete flow. Delegates immediately to
// the confirmation modal so the faculty cannot accidentally delete by one click.
function deleteVenue(venueId) {
  openDeleteVenueConfirmModal(venueId);
}

// [openDeleteVenueConfirmModal]: Shows the delete confirmation modal with the
// venue's name in the message so the faculty knows exactly what will be deleted.
function openDeleteVenueConfirmModal(venueId) {
  const venue = facultyVenueData[venueId];
  const name = venue ? venue.name : `Venue #${venueId}`;
  const msgEl = document.getElementById("deleteVenueConfirmMessage");
  if (msgEl) {
    msgEl.textContent = `Do you really want to delete "${name}"? This action cannot be undone.`;
  }
  deleteVenueId = venueId;
  document.getElementById("deleteVenueConfirmModal")?.classList.remove("hidden");
}

// [closeDeleteVenueConfirmModal]: Hides the delete confirmation modal and resets state.
function closeDeleteVenueConfirmModal() {
  document.getElementById("deleteVenueConfirmModal")?.classList.add("hidden");
  deleteVenueId = null;
}

// [executeDeleteVenue]: Sends the DELETE request to the backend, removes the venue
// from the UI, and resets the detail panel. Called when the faculty confirms deletion.
async function executeDeleteVenue() {
  if (!deleteVenueId) return;
  const venueId = deleteVenueId;
  const venue = facultyVenueData[venueId];
  const name = venue ? venue.name : `Venue #${venueId}`;

  closeDeleteVenueConfirmModal();

  try {
    const response = await apiFetch(`/api/venues/${venueId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.backendMessage || "Failed to delete venue.");
      return;
    }
    addNotification(`Venue "${name}" deleted from the directory.`, "Just now");
    resetVenueDetailPanel();
    activeVenue = null;

    // Clear the calendar view since the active venue no longer exists
    const calendarDates = document.getElementById("venueCalendarDates");
    if (calendarDates) calendarDates.innerHTML = "";
    const monthLabel = document.getElementById("calendarMonthLabel");
    if (monthLabel) monthLabel.textContent = "Select a Venue";
    const detailPanel = document.getElementById("calendarDayDetail");
    if (detailPanel) detailPanel.hidden = true;

    await refreshAll();
  } catch (err) {
    console.error("Failed to delete venue:", err);
    alert("An error occurred while deleting the venue.");
  }
}


// =============================================
// VENUE PHOTO UPLOAD ZONE
// =============================================

// [initializeVenuePhotoZone]: Sets up the drag-and-drop image upload zone in the
// Add Venue modal. Handles click-to-browse, drag-and-drop, and preview display.
// Called once on DOMContentLoaded.
function initializeVenuePhotoZone() {
  const zone = document.getElementById("venuePhotoZone");
  const input = document.getElementById("venuePhotoInput");
  const label = document.getElementById("venuePhotoName");
  if (!zone || !input) return;

  // Click on the zone triggers the hidden file input
  zone.addEventListener("click", () => input.click());

  // Prevent the browser from opening the file when dropped outside the zone
  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    zone.addEventListener(eventName, e => e.preventDefault(), false);
    document.body.addEventListener(eventName, e => e.preventDefault(), false);
  });

  // Visually highlight the zone when a file is dragged over it
  ["dragenter", "dragover"].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.add("dropzone-active"), false);
  });

  // Remove the highlight when the file leaves the zone or is dropped
  ["dragleave", "drop"].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.remove("dropzone-active"), false);
  });

  // Handle file dropped onto the zone
  zone.addEventListener("drop", e => {
    const files = e.dataTransfer.files;
    if (files.length) {
      input.files = files; // Assign to the file input so the form can submit it
      handlePhotoSelected(files[0]);
    }
  });

  // Handle file selected via the file browser dialog
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) {
      handlePhotoSelected(file);
    } else {
      // File was deselected — reset the zone to its empty state
      label.textContent = "No file selected";
      zone.style.backgroundImage = "";
      const span = zone.querySelector("span");
      if (span) span.style.display = "block";
      label.style.background = "";
      label.style.color = "";
      label.style.padding = "";
      label.style.borderRadius = "";
    }
  });

  // [handlePhotoSelected]: Validates that the selected file is an image,
  // then uses FileReader to display it as a preview inside the upload zone.
  function handlePhotoSelected(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please select or drop an image file.");
      return;
    }
    label.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Show the selected image as a background of the upload zone
      zone.style.backgroundImage = `url('${e.target.result}')`;
      zone.style.backgroundSize = "cover";
      zone.style.backgroundPosition = "center";
      const span = zone.querySelector("span");
      if (span) span.style.display = "none"; // Hide "Click or drag" text
      label.style.background = "rgba(15, 23, 42, 0.7)";
      label.style.color = "#fff";
      label.style.padding = "2px 8px";
      label.style.borderRadius = "4px";
    };
    reader.readAsDataURL(file);
  }
}


// =============================================
// PROPOSED EVENTS VIEW — Review, Accept, Reject
// =============================================

// [openPdfPreview]: Opens the fullscreen PDF viewer modal for reviewing a letter
// request attached to a proposal. Called from the "Fullscreen" button on a proposal card.
function openPdfPreview(url, title) {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  const titleEl = document.getElementById("pdfPreviewTitle");
  if (!modal || !iframe) return;

  iframe.src = url;
  if (titleEl && title) {
    titleEl.textContent = `Letter Request Preview - ${title}`;
  } else if (titleEl) {
    titleEl.textContent = "Letter Request Preview";
  }

  modal.classList.remove("hidden");
}

// [closePdfPreview]: Hides the PDF preview modal and clears the iframe src
// to stop the PDF loading in the background.
function closePdfPreview() {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  if (modal) modal.classList.add("hidden");
  if (iframe) iframe.src = ""; // Free up memory by stopping the PDF load
}

// [renderProposals]: Builds and injects all student proposal cards into the
// Proposed Events grid. Each card shows proposal details, an embedded PDF preview,
// and Accept/Pending Reviewed action buttons for pending proposals.
function renderProposals() {
  const grid = document.getElementById("proposalsGrid");
  const countBadge = document.getElementById("proposalsCount");
  if (!grid) return;

  const proposals = loadProposals();

  if (countBadge) {
    countBadge.textContent = `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`;
  }

  if (!proposals.length) {
    grid.innerHTML = '<p class="empty-state">No student proposals yet.</p>';
    return;
  }

  grid.innerHTML = proposals
    .map((p) => {
      // Map internal status to the right CSS class and display label
      const statusClass =
        p.status === "accepted" ? "status-approved"
        : p.status === "pending_reviewed" ? "status-rejected"
        : p.status === "cancelled" ? "status-cancelled"
        : "status-pending";
      const statusLabel =
        p.status === "accepted" ? "Accepted"
        : p.status === "pending_reviewed" ? "Pending Reviewed"
        : p.status === "cancelled" ? "Cancelled"
        : "Pending Review";

      // PDF section: inline preview + download link + fullscreen button
      const pdfSection = p.pdfDataUrl
        ? `<iframe src="${p.pdfDataUrl}" title="PDF preview for ${escapeHtml(p.title)}" class="proposal-pdf-frame"></iframe>
           <div class="proposal-pdf-actions" style="display: flex; gap: 8px; justify-content: center; padding: 10px 12px; border-top: 1px solid var(--border);">
             <a href="${p.pdfDataUrl}" download="${escapeHtml(p.pdfName || 'letter-request.pdf')}" class="btn btn-small proposal-download-btn">⬇ Download PDF</a>
             <button type="button" class="btn btn-small btn-secondary fullscreen-pdf-btn" data-url="${p.pdfDataUrl}" data-title="${escapeHtml(p.title)}">🔍 Fullscreen</button>
           </div>`
        : '<p class="empty-state">No PDF attached.</p>';

      return `
      <article class="proposal-card" data-id="${escapeHtml(p.id)}">
        <div class="proposal-card-header">
          <h4>${escapeHtml(p.title)}</h4>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
        <div class="proposal-card-body">
          <p><strong>Organization:</strong> ${escapeHtml(p.org)}</p>
          <p><strong>Student No.:</strong> ${escapeHtml(p.studentNumber || "Unknown")}</p>
          <p><strong>Venue:</strong> ${escapeHtml(p.venue)}</p>
          <p><strong>Date &amp; Time:</strong> ${escapeHtml(p.date)} · ${escapeHtml(formatTime12h(p.time))}</p>
          <p><strong>Attendance:</strong> ${escapeHtml(String(p.attendees || "-"))}</p>
          ${p.status === "pending_reviewed" && p.rejectionReason ? `<p class="event-reject-reason"><strong>Review Comments:</strong> ${escapeHtml(p.rejectionReason)}</p>` : ""}
        </div>
        <div class="proposal-pdf-preview">
          <div class="proposal-pdf-label">Letter Request</div>
          ${pdfSection}
        </div>
        <div class="proposal-card-actions">
          ${p.status === "pending" ? `
            <button type="button" class="btn btn-success proposal-accept-btn" data-id="${escapeHtml(p.id)}">Accept</button>
            <button type="button" class="btn btn-danger proposal-reject-btn" data-id="${escapeHtml(p.id)}">Pending Reviewed</button>
          ` : ""}
        </div>
        ${p.status === "pending" ? `
          <div class="proposal-reject-form hidden" id="reject-form-${escapeHtml(p.id)}">
            <label for="reject-reason-${escapeHtml(p.id)}">Review Comments <span class="required-indicator" aria-label="required">*</span></label>
            <textarea id="reject-reason-${escapeHtml(p.id)}" class="form-control" rows="2" required placeholder="Provide comments for the student to revise..."></textarea>
            <div class="form-actions">
              <button type="button" class="btn btn-danger proposal-confirm-reject-btn" data-id="${escapeHtml(p.id)}">Submit Comments</button>
              <button type="button" class="btn btn-secondary proposal-cancel-reject-btn" data-id="${escapeHtml(p.id)}">Cancel</button>
            </div>
          </div>
        ` : ""}
      </article>
    `;
    })
    .join("");

  // Wire up all action buttons now that the cards are in the DOM
  grid.querySelectorAll(".proposal-accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => acceptProposal(btn.dataset.id));
  });

  // "Pending Reviewed" button shows the inline rejection reason form
  grid.querySelectorAll(".proposal-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`reject-form-${btn.dataset.id}`)?.classList.remove("hidden");
    });
  });

  grid.querySelectorAll(".proposal-cancel-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(`reject-form-${btn.dataset.id}`)?.classList.add("hidden");
    });
  });

  grid.querySelectorAll(".proposal-confirm-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reason = document.getElementById(`reject-reason-${btn.dataset.id}`)?.value.trim();
      if (!reason) {
        alert("Please provide review comments.");
        return;
      }
      rejectProposal(btn.dataset.id, reason);
    });
  });

  grid.querySelectorAll(".fullscreen-pdf-btn").forEach((btn) => {
    btn.addEventListener("click", () => openPdfPreview(btn.dataset.url, btn.dataset.title));
  });
}

// [acceptProposal]: Approves a student's event proposal. Uses an optimistic UI
// update (status changes immediately before the API responds) for a snappy feel,
// then reverts if the server call fails.
async function acceptProposal(id) {
  const proposal = allFacultyProposalsList.find((p) => p.id === id);
  if (!proposal) return;

  const originalStatus = proposal.status;

  // Optimistic update: change the status in memory immediately so the UI feels fast
  proposal.status = "accepted";
  renderProposals();
  updateDashboardStats();
  renderFacultySchedule();

  try {
    const response = await apiFetch(`/api/events/${proposal.eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      // Server rejected the change — roll back the optimistic update
      proposal.status = originalStatus;
      renderProposals();
      updateDashboardStats();
      renderFacultySchedule();
      alert(result.backendMessage || "Failed to approve proposal.");
      return;
    }
    addNotification(`Proposal "${proposal.title}" has been accepted.`, "Just now");
  } catch (err) {
    console.error("Failed to accept proposal:", err);
    // Network error — roll back the optimistic update
    proposal.status = originalStatus;
    renderProposals();
    updateDashboardStats();
    renderFacultySchedule();
    alert("An error occurred while approving the proposal.");
  }
  await refreshAll();
}

// [rejectProposal]: Marks a student's event proposal as "Pending Reviewed" with
// the faculty's comments. Uses the same optimistic UI pattern as acceptProposal.
async function rejectProposal(id, reason) {
  const proposal = allFacultyProposalsList.find((p) => p.id === id);
  if (!proposal) return;

  const originalStatus = proposal.status;
  const originalReason = proposal.rejectionReason;

  // Optimistic update: change the status in memory before the server confirms
  proposal.status = "pending_reviewed";
  proposal.rejectionReason = reason;
  renderProposals();
  updateDashboardStats();
  renderFacultySchedule();

  try {
    const response = await apiFetch(`/api/events/${proposal.eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reason: reason })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      // Server rejected the change — roll back the optimistic update
      proposal.status = originalStatus;
      proposal.rejectionReason = originalReason;
      renderProposals();
      updateDashboardStats();
      renderFacultySchedule();
      alert(result.backendMessage || "Failed to reject proposal.");
      return;
    }
    addNotification(`Proposal "${proposal.title}" has been marked as pending reviewed.`, "Just now");
  } catch (err) {
    console.error("Failed to reject proposal:", err);
    // Network error — roll back the optimistic update
    proposal.status = originalStatus;
    proposal.rejectionReason = originalReason;
    renderProposals();
    updateDashboardStats();
    renderFacultySchedule();
    alert("An error occurred while rejecting the proposal.");
  }
  await refreshAll();
}


// =============================================
// AUDIT LOGS VIEW — Fetch & Render
// =============================================

// [loadAuditLogs]: Fetches the full system audit log from the backend API and
// stores it in allAuditLogs. Called when the Audit Logs tab is first opened.
async function loadAuditLogs() {
  try {
    const response = await apiFetch("/api/auditlogs");
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        allAuditLogs = result.data;
        return allAuditLogs;
      }
    }
  } catch (err) {
    console.error("Failed to load audit logs:", err);
  }
  return [];
}

// [getLogActivityDescription]: Converts a raw audit log entry object into a
// human-readable HTML sentence describing what happened. Uses the action type
// and object type to pick the right sentence template.
function getLogActivityDescription(log) {
  const roleLabel = log.role === "faculty" ? "Faculty" : log.role === "student" ? "Student" : "Guest";
  const nameLabel = log.userFullName && log.userFullName !== "Anonymous" ? log.userFullName : log.userIdentifier;

  if (log.objectType === "Event") {
    if (log.action === "Create") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> requested a new event booking: <strong>"${escapeHtml(log.objectName)}"</strong>`;
    }
    if (log.action === "Cancel") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> cancelled the event request: <strong>"${escapeHtml(log.objectName)}"</strong>`;
    }
    if (log.action === "Approve") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> approved the event booking request: <strong>"${escapeHtml(log.objectName)}"</strong>`;
    }
    if (log.action === "Reject") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> marked event request <strong>"${escapeHtml(log.objectName)}"</strong> as pending reviewed`;
    }
  } else if (log.objectType === "Venue") {
    if (log.action === "Create") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> added a new venue: <strong>"${escapeHtml(log.objectName)}"</strong>`;
    }
  } else if (log.objectType === "Auth") {
    if (log.action === "Login") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> logged in successfully`;
    }
    if (log.action === "Register") {
      return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> created an account`;
    }
    if (log.action.startsWith("Login Failed")) {
      return `Failed login attempt using identifier <strong>"${escapeHtml(log.objectName)}"</strong>`;
    }
  } else if (log.objectType === "NotificationPreference") {
    return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> updated their notification preferences`;
  }

  // Fallback for unrecognized action/type combinations
  return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> performed action <strong>${escapeHtml(log.action)}</strong> on <strong>${escapeHtml(log.objectType)}</strong>: "${escapeHtml(log.objectName)}"`;
}

// [renderAuditLogs]: Filters the in-memory audit log list by the current search
// and dropdown filter values, then renders matching entries as table rows.
// Called whenever a filter input changes or the logs tab is opened.
function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  // Read the current filter values from all four filter controls
  const searchQuery = document.getElementById("logsSearch")?.value.trim().toLowerCase() || "";
  const filterActionVal = document.getElementById("filterAction")?.value || "";
  const filterObjectTypeVal = document.getElementById("filterObjectType")?.value || "";
  const filterRoleVal = document.getElementById("filterRole")?.value || "";

  const filteredLogs = allAuditLogs.filter(log => {
    // Free-text search: match against user identifier, full name, object name, action, or type
    if (searchQuery) {
      const userMatch = log.userIdentifier?.toLowerCase().includes(searchQuery);
      const nameMatch = log.userFullName?.toLowerCase().includes(searchQuery);
      const objectMatch = log.objectName?.toLowerCase().includes(searchQuery);
      const actionMatch = log.action?.toLowerCase().includes(searchQuery);
      const typeMatch = log.objectType?.toLowerCase().includes(searchQuery);
      // Exclude the log if none of the fields match the search query
      if (!userMatch && !nameMatch && !objectMatch && !actionMatch && !typeMatch) {
        return false;
      }
    }

    // Dropdown filters: exact match (empty string = "All", so no filtering)
    if (filterActionVal && log.action !== filterActionVal) return false;
    if (filterObjectTypeVal && log.objectType !== filterObjectTypeVal) return false;
    if (filterRoleVal && log.role !== filterRoleVal) return false;

    return true;
  });

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="text-align: center; padding: 40px;">No matching audit logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredLogs.map(log => {
    const timeStr = new Date(log.timestamp).toLocaleString();
    // Color the role pill: green for faculty, orange for student, red for others
    const rolePillClass = log.role === 'faculty' ? 'status-approved' : log.role === 'student' ? 'status-pending' : 'status-rejected';
    return `
      <tr>
        <td>${escapeHtml(timeStr)}</td>
        <td><strong>${escapeHtml(log.userIdentifier)}</strong><br><small>${escapeHtml(log.userFullName)}</small></td>
        <td><span class="status-pill ${rolePillClass}">${escapeHtml(log.role)}</span></td>
        <td>${getLogActivityDescription(log)}</td>
      </tr>
    `;
  }).join("");
}


// =============================================
// DOM CONTENT LOADED — Faculty Dashboard Entry Point
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  // --- AUTH CHECK: Redirect to login if not logged in as faculty ---
  checkAuthAndRedirect("faculty");

  // --- SIDEBAR: Menu item navigation ---
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  // Restore the previously active view from sessionStorage on page reload
  const savedView = sessionStorage.getItem("facultyActiveView");
  if (savedView) {
    const menuItem = document.querySelector(`.menu-item[data-view="${savedView}"]`);
    switchView(savedView, menuItem);
  }

  // Venue Directory Filters
  document.getElementById("venueSearchQuery")?.addEventListener("input", renderFacultyVenueGrid);
  document.getElementById("venueCapacityFilter")?.addEventListener("change", renderFacultyVenueGrid);

  // --- HEADER: Notification bell, profile dropdown, theme toggle ---
  document.getElementById("notificationBell")?.addEventListener("click", toggleNotificationPopup);

  document.getElementById("profileButton")?.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent the document-level click from immediately closing it
    toggleProfileDropdown();
  });

  // Close the profile dropdown when clicking anywhere outside it
  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });

  // Profile & Settings modal wiring (shared across student and faculty from shared.js)
  initializeProfileAndSettingsModals("faculty");

  // Dark mode toggle inside the profile dropdown
  (function initThemeToggleFaculty() {
    const toggle = document.getElementById("themeToggleFaculty");
    if (!toggle || typeof loadTheme !== "function") return;
    try {
      // Set the toggle's visual state to match the saved preference
      toggle.checked = loadTheme("faculty") === "dark";
    } catch {}
    toggle.addEventListener("change", () => {
      const next = toggle.checked ? "dark" : "light";
      if (typeof saveTheme === "function") saveTheme("faculty", next);
      if (typeof applyTheme === "function") applyTheme(next);
    });
  })();

  // --- VENUE DIRECTORY: Calendar navigation ---
  document.getElementById("calendarPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calendarNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));

  // --- VENUE DIRECTORY: Add/Edit Venue modal ---
  document.getElementById("addVenueForm")?.addEventListener("submit", handleAddVenueSubmit);
  document.getElementById("closeAddVenueBtn")?.addEventListener("click", closeAddVenueModal);
  document.getElementById("cancelAddVenueBtn")?.addEventListener("click", closeAddVenueModal);
  // Also close when clicking the modal overlay background
  document.getElementById("addVenueModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addVenueModal") closeAddVenueModal();
  });

  // --- VENUE DIRECTORY: Edit and Delete buttons in the detail panel ---
  document.getElementById("deleteVenueBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (activeVenue) deleteVenue(activeVenue);
  });
  document.getElementById("deleteVenueConfirmNoBtn")?.addEventListener("click", closeDeleteVenueConfirmModal);
  document.getElementById("deleteVenueConfirmOverlay")?.addEventListener("click", closeDeleteVenueConfirmModal);
  document.getElementById("deleteVenueConfirmYesBtn")?.addEventListener("click", executeDeleteVenue);
  document.getElementById("editVenueBtn")?.addEventListener("click", () => {
    if (activeVenue) openEditVenueModal(activeVenue);
  });

  // --- VENUE DIRECTORY: Day Manager modal ---
  document.getElementById("dayManagerClose")?.addEventListener("click", closeDayManager);
  document.getElementById("dayManagerCancel")?.addEventListener("click", closeDayManager);
  document.getElementById("dayManagerSave")?.addEventListener("click", saveDayManager);
  document.getElementById("dayManagerOverlay")?.addEventListener("click", closeDayManager);

  // "Edit Day" button in the calendar day detail strip
  document.getElementById("editDayBtn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const venueId = btn.dataset.venueId;
    const day = Number(btn.dataset.day);
    if (venueId && day) openDayManager(venueId, day);
  });

  // "Blackout" toggle inside the Day Manager — grey out the slot editor when enabled
  document.getElementById("blackoutToggle")?.addEventListener("change", (e) => {
    const slotSection = document.getElementById("slotManagerSection");
    if (slotSection) {
      slotSection.style.opacity = e.target.checked ? "0.4" : "1";
      slotSection.style.pointerEvents = e.target.checked ? "none" : "auto";
    }
  });

  // Helper: dynamically adds a new empty slot row to a given slot container.
  // Shared by both the Add Venue form and the Day Manager.
  const setupAddSlotBtn = (btnId, containerId) => {
    document.getElementById(btnId)?.addEventListener("click", () => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const row = document.createElement("div");
      row.className = "dynamic-slot-row";
      row.innerHTML = `
        <input type="text" class="form-control dynamic-slot-input" placeholder="e.g. 8:00 AM - 11:00 AM" required />
        <button type="button" class="dynamic-slot-remove" aria-label="Remove slot">×</button>
      `;
      row.querySelector(".dynamic-slot-remove").onclick = () => row.remove();
      container.appendChild(row);
    });
  };

  setupAddSlotBtn("venueAddSlotBtn", "venueSlotsContainer");
  setupAddSlotBtn("dayManagerAddSlotBtn", "dayManagerSlotsContainer");

  // --- AUDIT LOGS: Search and filter controls ---
  document.getElementById("logsSearch")?.addEventListener("input", renderAuditLogs);
  document.getElementById("filterAction")?.addEventListener("change", renderAuditLogs);
  document.getElementById("filterObjectType")?.addEventListener("change", renderAuditLogs);
  document.getElementById("filterRole")?.addEventListener("change", renderAuditLogs);

  // --- PDF PREVIEW MODAL ---
  document.getElementById("closePdfPreviewBtn")?.addEventListener("click", closePdfPreview);
  document.getElementById("pdfPreviewOverlay")?.addEventListener("click", closePdfPreview);

  // --- INITIALIZE EVERYTHING ---
  initializeVenuePhotoZone();

  // Load all data and then update the notification badge
  refreshAll().then(() => {
    updateNotificationBadge();
  });

  // Listen for changes in other open tabs so the dashboard stays in sync
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS) {
      refreshAll();
    }
  });

  window.addEventListener("eventsync-proposals-updated", () => {
    refreshAll();
  });

  // Poll for changes from other devices every 10 seconds to keep dynamic screens in sync
  setInterval(refreshAll, 10000);
});
