// =============================================
// student.js — Student Dashboard (index.html)
// Handles venue browsing, calendar interaction with 3-slot-per-day
// time logic, event application form, and proposal management.
// Depends on shared.js being loaded first.
// =============================================

let allVenuesList = [];
let myEventsList = [];

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
          photoDataUrl: v.photoPath ? `http://localhost:5108/${v.photoPath.replace(/\\/g, "/")}` : "",
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

async function loadEventsFromServer() {
  try {
    const statuses = ["pending", "approved", "rejected", "cancelled"];
    const promises = statuses.map(async (status) => {
      const response = await apiFetch(`/api/events?status=${status}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        }
      }
      return [];
    });
    const results = await Promise.all(promises);
    myEventsList = results.flat().map(e => ({
      id: `proposal-${e.eventId}`,
      eventId: e.eventId,
      title: e.title,
      org: e.department,
      venue: allVenuesList.find(v => v.id === e.venueId)?.name || `Venue #${e.venueId}`,
      venueId: e.venueId,
      date: e.eventDate ? e.eventDate.split("T")[0] : "",
      time: e.startTime,
      attendees: e.expectedAttendees,
      pdfName: e.submitLetterPath ? e.submitLetterPath.split("/").pop() : "letter-request.pdf",
      pdfDataUrl: e.submitLetterPath ? `http://localhost:5108/${e.submitLetterPath.replace(/\\/g, "/")}` : "",
      status: e.status === "approved" ? "accepted" : (e.status === "rejected" ? "pending_reviewed" : e.status),
      rejectionReason: e.reason || "",
      submittedAt: e.createdAt
    }));
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

function getAllVenues() {
  return allVenuesList;
}

function loadProposals() {
  return myEventsList;
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

  sessionStorage.setItem("studentActiveView", viewId);
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
  document.getElementById("countVenues").textContent = getAllVenues().filter(v => (v.status || "").toLowerCase() === "available").length;
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
    pending_reviewed: { label: "Pending Reviewed", cls: "status-rejected" },
    cancelled: { label: "Cancelled", cls: "status-rejected" },
  };

  list.innerHTML = proposals
    .map((p) => {
      const st = statusMap[p.status] || statusMap.pending;
      const rejectNote = p.status === "pending_reviewed" && p.rejectionReason
        ? `<p class="event-reject-reason"><strong>Review Comments:</strong> ${escapeHtml(p.rejectionReason)}</p>`
        : "";
      const cancelBtn = (p.status === "accepted" || p.status === "pending")
        ? `<button type="button" class="btn btn-secondary btn-small cancel-event-btn" data-id="${escapeHtml(p.id)}">Cancel Request</button>`
        : "";
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

  list.querySelectorAll(".cancel-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => cancelEvent(btn.dataset.id));
  });

  list.querySelectorAll(".edit-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => editEvent(btn.dataset.id));
  });
}

// =============================================
// Edit Event Flow
// =============================================

function editEvent(id) {
  const proposals = loadProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return;

  editingProposalId = id;
  
  // Pre-fill the form
  document.getElementById("eventTitle").value = proposal.title || "";
  document.getElementById("StudOrg").value = proposal.org || "";
  document.getElementById("eventDate").value = proposal.date || "";
  document.getElementById("attendees").value = proposal.attendees || "";
  
  // Update venue options so we can select it
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
  
  // Update time slot options and set it
  updateAvailableTimeSlots();
  const timeInput = document.getElementById("eventTime");
  if (timeInput && proposal.time) {
    let matchingValue = "";
    for (let i = 0; i < timeInput.options.length; i++) {
      if (timesAreEqual(timeInput.options[i].value, proposal.time)) {
        matchingValue = timeInput.options[i].value;
        break;
      }
    }
    
    if (!matchingValue) {
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
    
    if (matchingValue) {
      timeInput.value = matchingValue;
    }
  }
  
  // Remove required attribute from PDF if they already have one
  const pdfInput = document.getElementById("eventPdf");
  if (pdfInput && proposal.pdfDataUrl) {
    pdfInput.required = false;
    document.getElementById("pdfFileName").textContent = `Current: ${proposal.pdfName || "letter-request.pdf"}`;
  }
  switchView("schedule-view", document.querySelector('[data-view="schedule-view"]'));
  document.getElementById("workspaceTitle").textContent = "Edit Event Application";
}

// =============================================
// Cancel Event Flow
// =============================================

function cancelEvent(id) {
  cancelEventId = id;
  const reasonSelect = document.getElementById("cancelReason");
  if (reasonSelect) reasonSelect.value = "";
  document.getElementById("cancelReasonModal")?.classList.remove("hidden");
}

function closeCancelReasonModal() {
  document.getElementById("cancelReasonModal")?.classList.add("hidden");
  cancelEventId = null;
}

function confirmCancellation() {
  if (!cancelEventId) return;
  // Hide the cancel reason modal
  document.getElementById("cancelReasonModal")?.classList.add("hidden");
  // Show the custom confirmation prompt modal
  document.getElementById("cancelConfirmModal")?.classList.remove("hidden");
}

function closeCancelConfirmModal() {
  document.getElementById("cancelConfirmModal")?.classList.add("hidden");
  cancelEventId = null;
}

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
// Venue Grid Rendering
// =============================================

function renderStudentVenueGrid() {
  const grid = document.getElementById("studentVenueGrid");
  if (!grid) return;

  const query = document.getElementById("venueSearchQuery")?.value.toLowerCase().trim() || "";
  const minCapacity = parseInt(document.getElementById("venueCapacityFilter")?.value || "0", 10);

  let venues = getAllVenues();

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

  studentVenueData = buildVenueMap(venues);

  if (venues.length === 0) {
    grid.innerHTML = '<p class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">No venues match the selected filters.</p>';
    populateVenueSelect(venues);
    return;
  }

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
    opt.textContent = `${v.name} (Capacity: ${v.capacity || 'Not specified'})`;
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
  if (document.getElementById("venueCapacity")) document.getElementById("venueCapacity").textContent = venue.capacity || "Not specified";
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
  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);

  // Show unavailable message for past or blacked-out dates
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
    detailTitle.innerHTML = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — <span class="fully-booked-label">Fully Booked</span>`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">All time slots are booked for this date.</li>';
    return;
  }

  const heading = bookedCount > 0 ? "Limited availability" : "Available times";
  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — ${heading}`;

  // Render each slot as interactive list item
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

  calendarDates.querySelectorAll(".calendar-date[data-day]:not([disabled])").forEach((cell) => {
    cell.addEventListener("click", () => selectCalendarDay(venueId, Number(cell.dataset.day)));
  });

  // Restore selection if within valid range and not disabled
  if (selectedCalendarDay && selectedCalendarDay <= daysInMonth && selectedCalendarDay >= 1) {
    const selectedCell = calendarDates.querySelector(`.calendar-date[data-day="${selectedCalendarDay}"]`);
    if (selectedCell && !selectedCell.disabled) {
      updateCalendarDayDetail(venueId, selectedCalendarDay);
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

function updateAvailableTimeSlots() {
  const venueSelect = document.getElementById("eventVenue");
  const dateInput = document.getElementById("eventDate");
  const timeSelect = document.getElementById("eventTime");
  if (!venueSelect || !dateInput || !timeSelect) return;

  const venueName = venueSelect.value;
  const dateStr = dateInput.value;
  
  const currentValue = timeSelect.value;
  timeSelect.innerHTML = '<option value="">-- Choose a time slot --</option>';

  if (!venueName || !dateStr) {
    return;
  }

  const venue = allVenuesList.find(v => v.name === venueName);
  if (!venue) return;

  const parts = dateStr.split("-");
  if (parts.length !== 3) return;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const slots = getVenueTimeSlotsForDay(venue, day, month, year);

  const isPast = isDateInPast(day, month, year);
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  if (isPast || isBlackedOut) {
    return;
  }

  slots.forEach(slot => {
    if (!slot.booked) {
      const opt = document.createElement("option");
      opt.value = slot.time;
      opt.textContent = formatTime12h(slot.time);
      timeSelect.appendChild(opt);
    }
  });

  if (currentValue) {
    timeSelect.value = currentValue;
  }
}

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

  // Populate time slot options based on select/date change
  updateAvailableTimeSlots();

  // Set the time slot from the selected slot
  if (timeInput && selectedCalendarTime) {
    let found = false;
    for (let i = 0; i < timeInput.options.length; i++) {
      if (timeInput.options[i].value === selectedCalendarTime) {
        found = true;
        break;
      }
    }
    if (!found) {
      const opt = document.createElement("option");
      opt.value = selectedCalendarTime;
      opt.textContent = formatTime12h(selectedCalendarTime);
      timeInput.appendChild(opt);
    }
    timeInput.value = selectedCalendarTime;
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
  const venueName = document.getElementById("eventVenue").value;
  const date = document.getElementById("eventDate").value;
  const timeSlot = document.getElementById("eventTime").value;
  const time = getStartHour24h(timeSlot);
  const attendees = document.getElementById("attendees").value;
  const pdfInput = document.getElementById("eventPdf");
  const pdfFile = pdfInput.files[0];

  if (!pdfFile && !editingProposalId) {
    alert("Please attach a letter request PDF before submitting.");
    return;
  }

  const selectedVenue = allVenuesList.find(v => v.name === venueName);
  if (!selectedVenue) {
    alert("Please choose a valid venue.");
    return;
  }

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
// Success Modal (Centered)
// =============================================

function showSuccessModal() {
  document.getElementById("successModal")?.classList.remove("hidden");
}

function closeSuccessModal() {
  document.getElementById("successModal")?.classList.add("hidden");
  document.getElementById("scheduleForm")?.reset();
  
  const pdfInput = document.getElementById("eventPdf");
  if (pdfInput) pdfInput.required = true;
  
  updatePdfFileDisplay();
  switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  refreshAll();
}

function closePdfPreview() {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  if (modal) modal.classList.add("hidden");
  if (iframe) iframe.src = "";
}

// =============================================
// Refresh All UI
// =============================================

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
// DOMContentLoaded — Student Dashboard Init
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar navigation
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  // Restore active view from sessionStorage
  const savedView = sessionStorage.getItem("studentActiveView");
  if (savedView) {
    const menuItem = document.querySelector(`.menu-item[data-view="${savedView}"]`);
    switchView(savedView, menuItem);
  }

  // Venue Directory Filters
  document.getElementById("venueSearchQuery")?.addEventListener("input", renderStudentVenueGrid);
  document.getElementById("venueCapacityFilter")?.addEventListener("change", renderStudentVenueGrid);

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

  // Dropdown synchronization
  document.getElementById("eventVenue")?.addEventListener("change", updateAvailableTimeSlots);
  document.getElementById("eventDate")?.addEventListener("change", updateAvailableTimeSlots);

  // Form interactions
  document.getElementById("scheduleCancelBtn")?.addEventListener("click", () => {
    document.getElementById("scheduleForm")?.reset();
    
    const pdfInput = document.getElementById("eventPdf");
    if (pdfInput) pdfInput.required = true;
    
    updatePdfFileDisplay();
    editingProposalId = null;
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

  // Cancellation Confirmation modal handlers
  document.getElementById("cancelConfirmNoBtn")?.addEventListener("click", closeCancelConfirmModal);
  document.getElementById("cancelConfirmOverlay")?.addEventListener("click", closeCancelConfirmModal);
  document.getElementById("cancelConfirmYesBtn")?.addEventListener("click", executeCancellation);

  // Success modal handlers
  document.getElementById("successModalBtn")?.addEventListener("click", closeSuccessModal);
  document.getElementById("successModalOverlay")?.addEventListener("click", closeSuccessModal);

  // PDF Preview modal handlers
  document.getElementById("closePdfPreviewBtn")?.addEventListener("click", closePdfPreview);
  document.getElementById("pdfPreviewOverlay")?.addEventListener("click", closePdfPreview);

  // Auto-start session if redirected from login or already logged in
  const params = new URLSearchParams(window.location.search);
  const session = getAuthSession();
  if (params.get("role") === "Student" || (session.accessToken && session.role?.toLowerCase() === "student")) {
    startSession();
  } else if (session.accessToken && session.role?.toLowerCase() === "faculty") {
    window.location.href = "faculty-dash.html";
  } else {
    // Keep landing overlay visible so user can choose between Student and Faculty portal
    const overlay = document.getElementById("landingOverlay");
    if (overlay) overlay.style.display = "flex";
  }

  // Listen for cross-tab localStorage changes to stay in sync
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS || e.key === STORAGE_KEYS.VENUES) refreshAll();
  });
  window.addEventListener("eventsync-proposals-updated", refreshAll);
});
