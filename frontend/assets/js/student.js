// =============================================
// student.js — Student Dashboard (index.html)
// Handles venue browsing, calendar interaction with 3-slot-per-day
// time logic, event application form, and proposal management.
// Depends on shared.js being loaded first.
// =============================================

let activeVenue = null;
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();
let selectedCalendarDay = null;
let selectedCalendarTime = "";
let studentVenueData = {};
let notifications = [];
let unreadNotifications = 0;
let cancelEventId = null;

// =============================================
// Venue Data — Read from Faculty-managed localStorage
// =============================================

/**
 * loadFacultyVenues()
 * Reads venues array from localStorage. These are created/managed by faculty.
 * Each venue: { id, name, address, description, availability, photoDataUrl,
 *               calendarAvailability, timeSlots }
 */
function loadFacultyVenues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENUES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getAllVenues() {
  return loadFacultyVenues();
}

function buildVenueMap(venues) {
  const map = {};
  venues.forEach((v) => { map[v.id] = v; });
  return map;
}

// =============================================
// View Navigation
// =============================================

function switchView(viewId, element) {
  document.querySelectorAll(".view-section").forEach((v) => v.classList.remove("active-view"));
  document.getElementById(viewId)?.classList.add("active-view");

  const titles = {
    "dashboard-view": "Dashboard Overview",
    "venues-view": "Venue Directory",
    "schedule-view": "Event Application",
  };
  document.getElementById("workspaceTitle").textContent = titles[viewId] || "Dashboard";

  if (element) {
    document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }
}

// =============================================
// Session Start
// =============================================

function startSession() {
  document.getElementById("landingOverlay").style.display = "none";
  document.querySelector(".sidebar")?.classList.remove("hidden");
  document.querySelector(".main-workspace")?.classList.remove("hidden");
  refreshAll();
}

// =============================================
// Dashboard Stats
// =============================================

function updateStudentStats() {
  const proposals = loadProposals();
  const proposed = proposals.length;
  const pending = proposals.filter((p) => p.status === "pending").length;

  document.getElementById("countProposed").textContent = proposed;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countVenues").textContent = getAllVenues().length;
}

// =============================================
// My Submitted Events List
// =============================================

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

  const statusMap = {
    pending: { label: "Pending Review", cls: "status-pending" },
    accepted: { label: "Accepted", cls: "status-approved" },
    rejected: { label: "Rejected", cls: "status-rejected" },
    cancelled: { label: "Cancelled", cls: "status-rejected" },
  };

  list.innerHTML = proposals
    .map((p) => {
      const st = statusMap[p.status] || statusMap.pending;
      const rejectNote = p.status === "rejected" && p.rejectionReason
        ? `<p class="event-reject-reason"><strong>Reason:</strong> ${escapeHtml(p.rejectionReason)}</p>`
        : "";
      const cancelBtn = (p.status === "accepted" || p.status === "pending")
        ? `<button type="button" class="btn btn-secondary btn-small cancel-event-btn" data-id="${escapeHtml(p.id)}">Cancel Request</button>`
        : "";

      return `
        <article class="my-event-card" data-id="${escapeHtml(p.id)}">
          <div class="my-event-card-main">
            <h4>${escapeHtml(p.title)}</h4>
            <p class="my-event-meta">${escapeHtml(p.venue)} · ${escapeHtml(p.date)} · ${escapeHtml(p.time)}</p>
            ${rejectNote}
          </div>
          <div class="my-event-card-actions">
            <span class="status-pill ${st.cls}">${st.label}</span>
            ${cancelBtn}
          </div>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll(".cancel-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => cancelEvent(btn.dataset.id));
  });
}

// =============================================
// Cancel Event Flow
// =============================================

function cancelEvent(id) {
  cancelEventId = id;
  document.getElementById("cancelReason").value = "";
  document.getElementById("cancelReasonModal").classList.remove("hidden");
}

function closeCancelReasonModal() {
  document.getElementById("cancelReasonModal").classList.add("hidden");
  cancelEventId = null;
}

function confirmCancellation() {
  if (!cancelEventId) return;

  const reason = document.getElementById("cancelReason").value.trim();
  const proposals = loadProposals();
  const proposal = proposals.find((p) => p.id === cancelEventId);
  if (!proposal) return;

  proposal.status = "cancelled";
  if (reason) {
    proposal.cancellationReason = reason;
  }
  saveProposals(proposals);
  addNotification(`Event "${proposal.title}" has been cancelled.`, "Just now");
  closeCancelReasonModal();
  refreshAll();
}

// =============================================
// Venue Grid Rendering
// =============================================

function renderStudentVenueGrid() {
  const grid = document.getElementById("studentVenueGrid");
  if (!grid) return;

  const venues = getAllVenues();
  studentVenueData = buildVenueMap(venues);

  grid.innerHTML = venues
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

  populateVenueSelect(venues);
}

function populateVenueSelect(venues) {
  const select = document.getElementById("eventVenue");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Choose a venue --</option>';
  venues.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = v.name;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

// =============================================
// Venue Detail Panel
// =============================================

function displayVenueDetail(venueId) {
  const venue = studentVenueData[venueId];
  if (!venue) return;

  activeVenue = venueId;
  selectedCalendarDay = null;
  selectedCalendarTime = "";
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();

  document.getElementById("detailVenueName").textContent = venue.name;
  document.getElementById("venueDescription").textContent = venue.description;
  document.getElementById("venueAddress").textContent = venue.address;
  document.getElementById("venueAvailabilityText").textContent = venue.availability;

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}

// =============================================
// Calendar — 3-Slot-Per-Day Time Logic
// =============================================

/**
 * getDayAvailabilityStatus(venueId, day)
 * Determines the status of a calendar day for a given venue by checking
 * how many of the 3 time slots are booked.
 * Returns: "booked" (all 3 taken), "available" (some free), "neutral" (no data)
 */
function getDayAvailabilityStatus(venueId, day) {
  const venue = studentVenueData[venueId];
  if (!venue) return "neutral";

  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const bookedCount = slots.filter((s) => s.booked).length;
  const totalSlots = slots.length;

  if (totalSlots === 0) return "neutral";
  if (bookedCount >= totalSlots) return "booked";
  if (bookedCount > 0) return "partial";
  return "available";
}

/**
 * updateCalendarDayDetail(venueId, day)
 * Shows the time slot detail panel below the calendar grid.
 * Each slot is rendered as a clickable item (if available) or a disabled
 * item showing "Booked" with the reserved time.
 */
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
  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const bookedCount = slots.filter((s) => s.booked).length;

  detailPanel.hidden = false;

  if (bookedCount >= slots.length) {
    detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — Fully booked`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">All 3 time slots are booked for this date.</li>';
    return;
  }

  const heading = bookedCount > 0 ? "Limited availability" : "Available times";
  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — ${heading}`;

  // Render each slot as interactive list item
  detailTimes.innerHTML = slots.map((slot) => {
    if (slot.booked) {
      return `
        <li class="time-slot-item time-slot-item--booked" aria-disabled="true">
          <span class="time-slot-time">${escapeHtml(slot.time)}</span>
          <span class="time-slot-badge time-slot-badge--booked">Booked</span>
        </li>`;
    }
    const isSelected = selectedCalendarTime === slot.time;
    return `
      <li class="time-slot-item time-slot-item--available${isSelected ? " time-slot-item--selected" : ""}"
          data-time="${escapeHtml(slot.time)}" tabindex="0" role="button">
        <span class="time-slot-time">${escapeHtml(slot.time)}</span>
        <span class="time-slot-badge time-slot-badge--available">${isSelected ? "✓ Selected" : "Available"}</span>
      </li>`;
  }).join("");

  // Attach click handlers to available slots
  detailTimes.querySelectorAll(".time-slot-item--available").forEach((item) => {
    item.addEventListener("click", () => {
      selectedCalendarTime = item.dataset.time;
      // Re-render to update selected state
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

function selectCalendarDay(venueId, day) {
  selectedCalendarDay = day;
  selectedCalendarTime = ""; // Reset time when changing day

  document.querySelectorAll("#venueCalendarDates .calendar-date[data-day]").forEach((cell) => {
    cell.classList.toggle("is-selected", Number(cell.dataset.day) === day);
  });

  updateCalendarDayDetail(venueId, day);
}

function renderVenueCalendar(venueId) {
  const calendarDates = document.getElementById("venueCalendarDates");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const venue = studentVenueData[venueId];
  if (!calendarDates || !venue) return;

  if (monthLabel) {
    monthLabel.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${viewCalendarYear}`;
  }

  const firstDay = new Date(viewCalendarYear, viewCalendarMonth, 1).getDay();
  const daysInMonth = new Date(viewCalendarYear, viewCalendarMonth + 1, 0).getDate();

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-date empty" aria-hidden="true"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const status = getDayAvailabilityStatus(venueId, day);
    const isSelected = selectedCalendarDay === day;
    const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
    const availableSlots = slots.filter((s) => !s.booked);
    const bookedSlots = slots.filter((s) => s.booked);

    let slotsHTML = "";
    if (status === "booked") {
      slotsHTML = '<span class="day-status-label">Booked</span>';
    } else if (status === "available" || status === "partial") {
      slotsHTML = `<div class="day-times">${formatCalendarDaySlots(availableSlots.map(s => s.time))}</div>`;
    }

    html += `
      <button type="button" class="calendar-date ${status}${isSelected ? " is-selected" : ""}" data-day="${day}">
        <span class="day-number">${day}</span>
        ${slotsHTML}
      </button>
    `;
  }

  calendarDates.innerHTML = html;

  calendarDates.querySelectorAll(".calendar-date[data-day]").forEach((cell) => {
    cell.addEventListener("click", () => selectCalendarDay(venueId, Number(cell.dataset.day)));
  });

  // Restore selection if within valid range
  if (selectedCalendarDay && selectedCalendarDay <= daysInMonth && selectedCalendarDay >= 1) {
    updateCalendarDayDetail(venueId, selectedCalendarDay);
  } else {
    selectedCalendarDay = null;
    const detailPanel = document.getElementById("calendarDayDetail");
    if (detailPanel) detailPanel.hidden = true;
  }
}

function shiftCalendarMonth(delta) {
  viewCalendarMonth += delta;
  if (viewCalendarMonth < 0) { viewCalendarMonth = 11; viewCalendarYear -= 1; }
  else if (viewCalendarMonth > 11) { viewCalendarMonth = 0; viewCalendarYear += 1; }
  selectedCalendarDay = null;
  selectedCalendarTime = "";
  if (activeVenue) renderVenueCalendar(activeVenue);
}

// =============================================
// Book Now — Calendar → Form Population
// =============================================

/**
 * openReservationWithVenue(venueName)
 * Called when "Book Now" is clicked. Populates the event application form
 * with the selected venue, date, and time slot from the calendar.
 */
function openReservationWithVenue(venueName) {
  const select = document.getElementById("eventVenue");
  const dateInput = document.getElementById("eventDate");
  const timeInput = document.getElementById("eventTime");

  // Set the venue dropdown
  if (select) select.value = venueName;

  // Set the date from the calendar selection
  if (dateInput && selectedCalendarDay) {
    dateInput.value = formatDateString(viewCalendarYear, viewCalendarMonth, selectedCalendarDay);
  }

  // Set the time from the selected slot (use the start time for the time input)
  if (timeInput && selectedCalendarTime) {
    const normalizedTime = selectedCalendarTime.split(" - ")[0];
    timeInput.value = normalizedTime;
  }

  switchView("schedule-view", document.querySelector('[data-view="schedule-view"]'));
}

// =============================================
// Form Submission — Save to localStorage
// =============================================

/**
 * handleFormSubmission(e)
 * Intercepts form submit (preventDefault), validates all fields,
 * converts the PDF to a base64 data URL, and saves the proposal
 * to localStorage so the Faculty dashboard can read it.
 */
async function handleFormSubmission(e) {
  e.preventDefault(); // Prevent page reload

  const form = document.getElementById("scheduleForm");
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const title = document.getElementById("eventTitle").value.trim();
  const org = document.getElementById("StudOrg").value.trim();
  const venue = document.getElementById("eventVenue").value;
  const date = document.getElementById("eventDate").value;
  const time = document.getElementById("eventTime").value;
  const attendees = document.getElementById("attendees").value;
  const pdfInput = document.getElementById("eventPdf");
  const pdfFile = pdfInput.files[0];

  if (!pdfFile) {
    alert("Please attach a letter request PDF before submitting.");
    return;
  }

  // Convert PDF to base64 data URL so faculty can download it from localStorage
  const pdfDataUrl = await readFileAsDataUrl(pdfFile);

  /**
   * Build the proposal object and prepend it to the proposals array.
   * This data is the bridge between Student and Faculty POVs.
   */
  const proposals = loadProposals();
  proposals.unshift({
    id: `proposal-${Date.now()}`,
    title,
    org,
    venue,
    date,
    time,
    attendees,
    pdfName: pdfFile.name,
    pdfDataUrl,           // Base64 PDF for faculty to view/download
    status: "pending",
    rejectionReason: "",
    submittedAt: new Date().toISOString(),
  });

  // Write to localStorage — faculty-dash.js reads this same key
  saveProposals(proposals);
  addNotification(`Proposal "${title}" submitted. Awaiting faculty review.`, "Just now");
  showSuccessModal();
}

// =============================================
// Success Modal (Centered)
// =============================================

function showSuccessModal() {
  document.getElementById("successModal")?.classList.remove("hidden");
}

function closeSuccessModal() {
  document.getElementById("successModal")?.classList.add("hidden");
  document.getElementById("scheduleForm")?.reset();
  updatePdfFileDisplay();
  switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  refreshAll();
}

// =============================================
// Refresh All UI
// =============================================

function refreshAll() {
  updateStudentStats();
  renderMyEvents();
  renderStudentVenueGrid();
}

// =============================================
// DOMContentLoaded — Student Dashboard Init
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar navigation
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  // Landing page role buttons
  document.getElementById("student-btn")?.addEventListener("click", () => {
    window.location.href = "users.html";
  });
  document.getElementById("faculty-btn")?.addEventListener("click", () => {
    window.location.href = "faculty.html";
  });

  // Dashboard "Book Now" CTA → go to venues view
  document.getElementById("dashboardBookNowBtn")?.addEventListener("click", () => {
    switchView("venues-view", document.querySelector('[data-view="venues-view"]'));
  });

  // Venue detail "Book Now" button → populate form and go to schedule view
  document.getElementById("bookNowBtn")?.addEventListener("click", () => {
    if (!activeVenue) {
      alert("Please select a venue before booking.");
      return;
    }
    const venue = studentVenueData[activeVenue];
    openReservationWithVenue(venue?.name || "");
  });

  // Form submit
  document.getElementById("scheduleForm")?.addEventListener("submit", handleFormSubmission);
  document.getElementById("scheduleCancelBtn")?.addEventListener("click", () => {
    switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  });

  // Calendar navigation
  document.getElementById("calendarPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calendarNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));

  // Notification bell
  document.getElementById("notificationBell")?.addEventListener("click", toggleNotificationPopup);

  // Profile dropdown
  document.getElementById("profileButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileDropdown();
  });

  // Profile & Settings modals (shared logic from shared.js)
  initializeProfileAndSettingsModals("student");

  // Theme toggle inside profile dropdown
  (function initThemeToggleStudent() {
    const toggle = document.getElementById("themeToggleStudent");
    if (!toggle || typeof loadTheme !== "function") return;
    try {
      toggle.checked = loadTheme("student") === "dark";
    } catch {}
    toggle.addEventListener("change", () => {
      const next = toggle.checked ? "dark" : "light";
      if (typeof saveTheme === "function") saveTheme("student", next);
      if (typeof applyTheme === "function") applyTheme(next);
    });
  })();

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });

  // Initialize PDF dropzone
  initializePdfDropzone();
  updateNotificationBadge();

  // Cancel reason modal handlers
  document.getElementById("cancelReasonForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    confirmCancellation();
  });
  document.getElementById("cancelReasonClose")?.addEventListener("click", closeCancelReasonModal);
  document.getElementById("cancelReasonCancel")?.addEventListener("click", closeCancelReasonModal);
  document.getElementById("cancelReasonOverlay")?.addEventListener("click", closeCancelReasonModal);

  // Success modal handlers
  document.getElementById("successModalBtn")?.addEventListener("click", closeSuccessModal);
  document.getElementById("successModalOverlay")?.addEventListener("click", closeSuccessModal);

  // Auto-start session if redirected from login
  const params = new URLSearchParams(window.location.search);
  if (params.get("role") === "Student") {
    startSession();
  }

  // Listen for cross-tab localStorage changes to stay in sync
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS || e.key === STORAGE_KEYS.VENUES) refreshAll();
  });
  window.addEventListener("eventsync-proposals-updated", refreshAll);
});