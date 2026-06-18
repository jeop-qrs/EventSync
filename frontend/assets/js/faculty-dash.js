// =============================================
// faculty-dash.js — Faculty Dashboard (faculty-dash.html)
// Handles venue management, proposal review, schedule tracking,
// and venue schedule editing with 3-slot-per-day model.
// Depends on shared.js being loaded first.
// =============================================

let activeVenue = null;
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();
let selectedCalendarDay = null;
let facultyVenueData = {};
let editingVenueId = null; // Track if we're editing vs adding

let allFacultyVenuesList = [];
let allFacultyProposalsList = [];
let allAuditLogs = [];

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
          photoDataUrl: v.photoPath ? `http://localhost:5108/${v.photoPath.replace(/\\/g, "/")}` : "",
          timeSlots: v.timeSlots || []
        }));
        return allFacultyVenuesList;
      }
    }
  } catch (err) {
    console.error("Failed to load venues:", err);
  }
  return [];
}

async function loadEventsFromServer() {
  try {
    const statuses = ["pending", "approved", "rejected"];
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
    allFacultyProposalsList = results.flat().map(e => ({
      id: `proposal-${e.eventId}`,
      eventId: e.eventId,
      title: e.title,
      org: e.department,
      studentNumber: e.organizer && e.organizer.studentNumber ? e.organizer.studentNumber : (e.organizerId ? String(e.organizerId) : "Unknown"),
      venue: allFacultyVenuesList.find(v => v.id === e.venueId)?.name || `Venue #${e.venueId}`,
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

function loadVenues() {
  return allFacultyVenuesList;
}

function saveVenues(venues) {
}

function loadProposals() {
  return allFacultyProposalsList;
}

function buildVenueDataMap(venues) {
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
    "proposals-view": "Proposed Events",
    "logs-view": "System Audit Logs",
  };
  const titleEl = document.getElementById("workspaceTitle");
  if (titleEl) titleEl.textContent = titles[viewId] || "Dashboard";

  if (element) {
    document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }

  if (viewId === "proposals-view") renderProposals();
  if (viewId === "logs-view") {
    loadAuditLogs().then(renderAuditLogs);
  }
}

// =============================================
// Dashboard Stats
// =============================================

function updateDashboardStats() {
  const proposals = loadProposals();
  const venues = loadVenues();
  const active = proposals.filter((p) => p.status === "accepted").length;
  const pending = proposals.filter((p) => p.status === "pending").length;
  const pendingReviewed = proposals.filter((p) => p.status === "pending_reviewed").length;

  document.getElementById("countActive").textContent = active;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countPendingReviewed").textContent = pendingReviewed;
  document.getElementById("countVenues").textContent = venues.filter(v => (v.status || "").toLowerCase() === "available").length;
}

// =============================================
// Schedule Tracker (Dashboard)
// =============================================

function renderFacultySchedule() {
  const list = document.getElementById("facultyScheduleList");
  const countBadge = document.getElementById("scheduleTrackerCount");
  if (!list) return;

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
// Venue Grid Rendering
// =============================================

function renderFacultyVenueGrid() {
  const grid = document.getElementById("facultyVenueGrid");
  if (!grid) return;

  const venues = loadVenues();
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

  grid.innerHTML = `
    <button type="button" class="venue-card venue-card--add" id="openAddVenueBtn" aria-label="Add a new venue">
      <span class="add-venue-icon">+</span>
      <span class="add-venue-label">Add Venue</span>
    </button>
    ${cards}
  `;

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

  document.getElementById("openAddVenueBtn")?.addEventListener("click", openAddVenueModal);
  updateDashboardStats();
}

// =============================================
// Venue Detail Panel
// =============================================

function displayVenueDetail(venueId) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  activeVenue = venueId;
  selectedCalendarDay = null;
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();

  document.getElementById("detailVenueName").textContent = venue.name;
  document.getElementById("venueDescription").textContent = venue.description;
  document.getElementById("venueCapacity").textContent = venue.capacity || "Not specified";
  document.getElementById("venueAddress").textContent = venue.address;
  document.getElementById("venueAvailabilityText").textContent = venue.availability;

  // Show action buttons
  const deleteBtn = document.getElementById("deleteVenueBtn");
  const editBtn = document.getElementById("editVenueBtn");
  if (deleteBtn) deleteBtn.style.display = "inline-block";
  if (editBtn) editBtn.style.display = "inline-block";

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}

// =============================================
// Venue CRUD — Delete
// =============================================

function deleteVenue(venueId) {
  alert("Deleting venues is not supported by the backend API.");
}

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
// Dynamic Slot Editor Helpers
// =============================================

function renderDynamicSlots(containerId, slots) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!slots || slots.length === 0) slots = ["8:00 AM - 11:00 AM"];

  slots.forEach((slotTime) => {
    const row = document.createElement("div");
    row.className = "dynamic-slot-row";
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control dynamic-slot-input";
    // Auto-convert any legacy 24h slots in local storage to 12h
    input.value = formatTime12h(slotTime);
    input.placeholder = "e.g. 8:00 AM - 11:00 AM";
    input.required = true;
    
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "dynamic-slot-remove";
    removeBtn.innerHTML = "×";
    removeBtn.ariaLabel = "Remove slot";
    removeBtn.onclick = () => row.remove();
    
    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function getDynamicSlots(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const inputs = container.querySelectorAll(".dynamic-slot-input");
  return Array.from(inputs).map(input => input.value.trim()).filter(v => v);
}

// =============================================
// Venue CRUD — Add / Edit Modal
// =============================================

function openAddVenueModal() {
  editingVenueId = null;
  document.getElementById("addVenueModalTitle").textContent = "Add New Venue";
  document.getElementById("addVenueSubmitBtn").textContent = "Add Venue";
  document.getElementById("addVenueForm")?.reset();
  document.getElementById("venuePhotoName").textContent = "No file selected";

  // Reset photo upload zone preview
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

  // Reset schedule editor
  renderDynamicSlots("venueSlotsContainer", DEFAULT_TIME_SLOTS);

  document.getElementById("addVenueModal")?.classList.remove("hidden");
}

/**
 * openEditVenueModal(venueId)
 * Pre-fills the Add Venue modal with existing venue data for editing.
 */
function openEditVenueModal(venueId) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  editingVenueId = venueId;
  document.getElementById("addVenueModalTitle").textContent = "Edit Venue";
  document.getElementById("addVenueSubmitBtn").textContent = "Save Changes";

  // Pre-fill form fields
  document.getElementById("venueNameInput").value = venue.name;
  document.getElementById("venueAddressInput").value = venue.address;
  document.getElementById("venueCapacityInput").value = venue.capacity || "";
  document.getElementById("venueDescInput").value = venue.description;
  document.getElementById("venueAvailInput").value = venue.availability;
  document.getElementById("venuePhotoName").textContent = venue.photoDataUrl ? "Current photo loaded" : "No file selected";

  // Set photo upload zone preview for editing
  const zone = document.getElementById("venuePhotoZone");
  if (zone) {
    if (venue.photoDataUrl) {
      zone.style.backgroundImage = `url('${venue.photoDataUrl}')`;
      zone.style.backgroundSize = "cover";
      zone.style.backgroundPosition = "center";
      const span = zone.querySelector("span");
      if (span) span.style.display = "none";
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

  // Pre-fill time slots
  const slots = venue.timeSlots || DEFAULT_TIME_SLOTS;
  renderDynamicSlots("venueSlotsContainer", slots);

  document.getElementById("addVenueModal")?.classList.remove("hidden");
}

function closeAddVenueModal() {
  document.getElementById("addVenueModal")?.classList.add("hidden");
  editingVenueId = null;
}

/**
 * handleAddVenueSubmit(e)
 * Handles both Add and Edit venue submissions.
 * Reads the time slots from the schedule editor fields.
 */
async function handleAddVenueSubmit(e) {
  e.preventDefault();
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
  if (timeSlots.length === 0) timeSlots = [DEFAULT_TIME_SLOTS[0]];

  if (editingVenueId) {
    alert("Editing existing venues is not supported by the backend API.");
    closeAddVenueModal();
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("address", address);
  formData.append("capacity", parseInt(capacity, 10) || 0);
  formData.append("description", description);
  formData.append("availability", availability);
  timeSlots.forEach(slot => {
    formData.append("timeslots", slot);
  });
  if (photoFile) {
    formData.append("photoCover", photoFile);
  }

  try {
    const response = await apiFetch("/api/venues", {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      alert(result.backendMessage || "Failed to save venue.");
      return;
    }
    addNotification(`Venue "${name}" added to the directory.`, "Just now");
  } catch (err) {
    console.error("Failed to save venue:", err);
    alert("An error occurred while saving the venue.");
  }
  closeAddVenueModal();
  await refreshAll();
}

// =============================================
// Calendar Rendering (Faculty View)
// =============================================

function getDayAvailabilityStatus(dayAvailability) {
  if (!dayAvailability) return "neutral";
  if (dayAvailability.booked) return "booked";
  if (dayAvailability.times?.length) return "available";
  return "neutral";
}

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
      isDisabled = true;
    } else if (isBlackedOut) {
      cellClass = "calendar-date blackout";
      // Intentionally NOT disabled so faculty can click to un-blackout
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

  calendarDates.querySelectorAll(".calendar-date[data-day]:not([disabled])").forEach((cell) => {
    cell.addEventListener("click", () => selectFacultyDay(venueId, Number(cell.dataset.day)));
  });

  // Restore selection if within valid range
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

function selectFacultyDay(venueId, day) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  selectedCalendarDay = day;

  // Highlight selected cell
  document.querySelectorAll(".calendar-date").forEach((c) => c.classList.remove("is-selected"));
  const selectedCell = document.querySelector(`.calendar-date[data-day="${day}"]`);
  if (selectedCell) selectedCell.classList.add("is-selected");

  // Show day detail strip
  const detailPanel = document.getElementById("calendarDayDetail");
  const detailTitle = document.getElementById("calendarDayDetailTitle");
  const detailTimes = document.getElementById("calendarDayTimes");
  const editDayBtn = document.getElementById("editDayBtn");
  if (!detailPanel || !detailTitle || !detailTimes) return;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
  const slots = getVenueTimeSlotsForDay(venue, day, viewCalendarMonth, viewCalendarYear);
  const bookedCount = slots.filter((s) => s.booked).length;
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;

  if (isBlackedOut) {
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">Marked as unavailable by faculty.</li>';
  } else if (!slots.length) {
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">No time slots configured for this date.</li>';
  } else {
    detailTimes.innerHTML = slots.map((slot) =>
      slot.booked
        ? `<li class="fac-slot-item fac-slot-booked"><span>${escapeHtml(formatTime12h(slot.time))}</span><span class="fac-slot-badge fac-slot-badge--booked">Booked</span></li>`
        : `<li class="fac-slot-item fac-slot-available"><span>${escapeHtml(formatTime12h(slot.time))}</span><span class="fac-slot-badge fac-slot-badge--available">Available</span></li>`
    ).join("");
  }

  if (editDayBtn) editDayBtn.dataset.venueId = venueId;
  if (editDayBtn) editDayBtn.dataset.day = day;
  detailPanel.hidden = false;
}

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
// Day Manager Panel
// =============================================

let dayManagerVenueId = null;
let dayManagerDay = null;

function openDayManager(venueId, day) {
  const venue = facultyVenueData[venueId];
  if (!venue) return;

  dayManagerVenueId = venueId;
  dayManagerDay = day;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, day);
  const isBlackedOut = isVenueBlackedOut(venue, dateStr);

  // Update modal title
  document.getElementById("dayManagerTitle").textContent =
    `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;

  // Set blackout toggle
  const blackoutToggle = document.getElementById("blackoutToggle");
  if (blackoutToggle) blackoutToggle.checked = isBlackedOut;

  // Render dynamic slots
  const currentSlots = getDayTimeSlots(venue, dateStr);
  renderDynamicSlots("dayManagerSlotsContainer", currentSlots);

  // Toggle slot section based on blackout state
  const slotSection = document.getElementById("slotManagerSection");
  if (slotSection) slotSection.style.opacity = isBlackedOut ? "0.4" : "1";
  if (slotSection) slotSection.style.pointerEvents = isBlackedOut ? "none" : "auto";

  // Show modal
  const modal = document.getElementById("dayManagerModal");
  if (modal) modal.classList.remove("hidden");
}

function closeDayManager() {
  dayManagerVenueId = null;
  dayManagerDay = null;
  const modal = document.getElementById("dayManagerModal");
  if (modal) modal.classList.add("hidden");
}

function saveDayManager() {
  if (!dayManagerVenueId || !dayManagerDay) return;

  const venues = loadVenues();
  const venue = venues.find((v) => v.id === dayManagerVenueId);
  if (!venue) return;

  const dateStr = formatDateString(viewCalendarYear, viewCalendarMonth, dayManagerDay);
  const isBlackedOut = document.getElementById("blackoutToggle")?.checked || false;
  const allSlots = venue.timeSlots || DEFAULT_TIME_SLOTS;

  // Persist blackout
  if (!venue.blackoutDates) venue.blackoutDates = [];
  const blackoutIdx = venue.blackoutDates.indexOf(dateStr);
  if (isBlackedOut && blackoutIdx === -1) venue.blackoutDates.push(dateStr);
  if (!isBlackedOut && blackoutIdx !== -1) venue.blackoutDates.splice(blackoutIdx, 1);

  // Persist slot override
  if (!venue.daySlotOverrides) venue.daySlotOverrides = {};
  const editedSlots = getDynamicSlots("dayManagerSlotsContainer");
  
  // Compare array content to check if it's different from default
  if (JSON.stringify(editedSlots) !== JSON.stringify(allSlots)) {
    venue.daySlotOverrides[dateStr] = editedSlots;
  } else {
    delete venue.daySlotOverrides[dateStr];
  }

  saveVenues(venues);
  facultyVenueData[dayManagerVenueId] = venue;
  renderVenueCalendar(dayManagerVenueId);
  addNotification(`Schedule for ${MONTH_NAMES[viewCalendarMonth]} ${dayManagerDay} updated.`, "Just now");
  closeDayManager();
}

// =============================================
// Proposals — Render, Accept, Reject
// =============================================

/**
 * renderProposals()
 * Reads proposals from localStorage and renders each as a card.
 * Includes PDF preview iframe AND a download button for direct download.
 */
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

function closePdfPreview() {
  const modal = document.getElementById("pdfPreviewModal");
  const iframe = document.getElementById("pdfPreviewIframe");
  if (modal) modal.classList.add("hidden");
  if (iframe) iframe.src = "";
}

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

      // PDF section: preview iframe + download button + fullscreen button
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

  // Wire up Accept/Reject buttons
  grid.querySelectorAll(".proposal-accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => acceptProposal(btn.dataset.id));
  });
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
    btn.addEventListener("click", () => {
      openPdfPreview(btn.dataset.url, btn.dataset.title);
    });
  });
}

async function acceptProposal(id) {
  const proposal = allFacultyProposalsList.find((p) => p.id === id);
  if (!proposal) return;

  const originalStatus = proposal.status;

  // Optimistic UI update
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
      // Revert optimistic update
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
    // Revert optimistic update
    proposal.status = originalStatus;
    renderProposals();
    updateDashboardStats();
    renderFacultySchedule();
    alert("An error occurred while approving the proposal.");
  }
  await refreshAll();
}

async function rejectProposal(id, reason) {
  const proposal = allFacultyProposalsList.find((p) => p.id === id);
  if (!proposal) return;

  const originalStatus = proposal.status;
  const originalReason = proposal.rejectionReason;

  // Optimistic UI update
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
      // Revert optimistic update
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
    // Revert optimistic update
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
// Venue Photo Upload Zone
// =============================================

function initializeVenuePhotoZone() {
  const zone = document.getElementById("venuePhotoZone");
  const input = document.getElementById("venuePhotoInput");
  const label = document.getElementById("venuePhotoName");
  if (!zone || !input) return;

  zone.addEventListener("click", () => input.click());

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    zone.addEventListener(eventName, e => e.preventDefault(), false);
    document.body.addEventListener(eventName, e => e.preventDefault(), false);
  });

  // Highlight drop area when item is dragged over it
  ["dragenter", "dragover"].forEach(eventName => {
    zone.addEventListener(eventName, () => {
      zone.classList.add("dropzone-active");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    zone.addEventListener(eventName, () => {
      zone.classList.remove("dropzone-active");
    }, false);
  });

  // Handle dropped files
  zone.addEventListener("drop", e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      input.files = files;
      handlePhotoSelected(files[0]);
    }
  });

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) {
      handlePhotoSelected(file);
    } else {
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

  function handlePhotoSelected(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please select or drop an image file.");
      return;
    }
    label.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      zone.style.backgroundImage = `url('${e.target.result}')`;
      zone.style.backgroundSize = "cover";
      zone.style.backgroundPosition = "center";
      const span = zone.querySelector("span");
      if (span) span.style.display = "none";
      
      label.style.background = "rgba(15, 23, 42, 0.7)";
      label.style.color = "#fff";
      label.style.padding = "2px 8px";
      label.style.borderRadius = "4px";
    };
    reader.readAsDataURL(file);
  }
}

// =============================================
// Audit Logs — Fetch & Render
// =============================================

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
  
  return `${roleLabel} <strong>${escapeHtml(nameLabel)}</strong> performed action <strong>${escapeHtml(log.action)}</strong> on <strong>${escapeHtml(log.objectType)}</strong>: "${escapeHtml(log.objectName)}"`;
}

function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  const searchQuery = document.getElementById("logsSearch")?.value.trim().toLowerCase() || "";
  const filterActionVal = document.getElementById("filterAction")?.value || "";
  const filterObjectTypeVal = document.getElementById("filterObjectType")?.value || "";
  const filterRoleVal = document.getElementById("filterRole")?.value || "";

  const filteredLogs = allAuditLogs.filter(log => {
    // Search filter
    if (searchQuery) {
      const userMatch = log.userIdentifier?.toLowerCase().includes(searchQuery);
      const nameMatch = log.userFullName?.toLowerCase().includes(searchQuery);
      const objectMatch = log.objectName?.toLowerCase().includes(searchQuery);
      const actionMatch = log.action?.toLowerCase().includes(searchQuery);
      const typeMatch = log.objectType?.toLowerCase().includes(searchQuery);
      if (!userMatch && !nameMatch && !objectMatch && !actionMatch && !typeMatch) {
        return false;
      }
    }

    // Dropdown filters
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
    return `
      <tr>
        <td>${escapeHtml(timeStr)}</td>
        <td><strong>${escapeHtml(log.userIdentifier)}</strong><br><small>${escapeHtml(log.userFullName)}</small></td>
        <td><span class="status-pill ${log.role === 'faculty' ? 'status-approved' : log.role === 'student' ? 'status-pending' : 'status-rejected'}">${escapeHtml(log.role)}</span></td>
        <td>${getLogActivityDescription(log)}</td>
      </tr>
    `;
  }).join("");
}

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
// DOMContentLoaded — Faculty Dashboard Init
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar navigation
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  // Calendar navigation
  document.getElementById("calendarPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calendarNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));

  // Add/Edit Venue modal
  document.getElementById("addVenueForm")?.addEventListener("submit", handleAddVenueSubmit);
  document.getElementById("closeAddVenueBtn")?.addEventListener("click", closeAddVenueModal);
  document.getElementById("cancelAddVenueBtn")?.addEventListener("click", closeAddVenueModal);
  document.getElementById("addVenueModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addVenueModal") closeAddVenueModal();
  });

  // Venue detail — Delete and Edit buttons
  document.getElementById("deleteVenueBtn")?.addEventListener("click", () => {
    if (activeVenue) deleteVenue(activeVenue);
  });
  document.getElementById("editVenueBtn")?.addEventListener("click", () => {
    if (activeVenue) openEditVenueModal(activeVenue);
  });

  // Day Manager panel controls
  document.getElementById("dayManagerClose")?.addEventListener("click", closeDayManager);
  document.getElementById("dayManagerCancel")?.addEventListener("click", closeDayManager);
  document.getElementById("dayManagerSave")?.addEventListener("click", saveDayManager);
  document.getElementById("dayManagerOverlay")?.addEventListener("click", closeDayManager);

  // Edit Day button in day detail strip
  document.getElementById("editDayBtn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const venueId = btn.dataset.venueId;
    const day = Number(btn.dataset.day);
    if (venueId && day) openDayManager(venueId, day);
  });

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

  document.getElementById("blackoutToggle")?.addEventListener("change", (e) => {
    const slotSection = document.getElementById("slotManagerSection");
    if (slotSection) {
      slotSection.style.opacity = e.target.checked ? "0.4" : "1";
      slotSection.style.pointerEvents = e.target.checked ? "none" : "auto";
    }
  });


  // Notification bell
  document.getElementById("notificationBell")?.addEventListener("click", toggleNotificationPopup);

  // Profile dropdown
  document.getElementById("profileButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileDropdown();
  });

  // Profile & Settings modals (shared logic from shared.js)
  initializeProfileAndSettingsModals("faculty");

  // Theme toggle inside profile dropdown (faculty)
  (function initThemeToggleFaculty() {
    const toggle = document.getElementById("themeToggleFaculty");
    if (!toggle || typeof loadTheme !== "function") return;
    try {
      toggle.checked = loadTheme("faculty") === "dark";
    } catch {}
    toggle.addEventListener("change", () => {
      const next = toggle.checked ? "dark" : "light";
      if (typeof saveTheme === "function") saveTheme("faculty", next);
      if (typeof applyTheme === "function") applyTheme(next);
    });
  })();

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });

  // Auto-redirect if not logged in
  checkAuthAndRedirect("faculty");

  // Search and filters for logs
  document.getElementById("logsSearch")?.addEventListener("input", renderAuditLogs);
  document.getElementById("filterAction")?.addEventListener("change", renderAuditLogs);
  document.getElementById("filterObjectType")?.addEventListener("change", renderAuditLogs);
  document.getElementById("filterRole")?.addEventListener("change", renderAuditLogs);

  // Initialize all
  initializeVenuePhotoZone();
  
  // PDF Preview modal handlers
  document.getElementById("closePdfPreviewBtn")?.addEventListener("click", closePdfPreview);
  document.getElementById("pdfPreviewOverlay")?.addEventListener("click", closePdfPreview);

  refreshAll().then(() => {
    updateNotificationBadge();
  });

  // Listen for cross-tab updates
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS) {
      refreshAll();
    }
  });

  window.addEventListener("eventsync-proposals-updated", () => {
    refreshAll();
  });
});
