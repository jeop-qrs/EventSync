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
let notifications = [];
let unreadNotifications = 0;
let editingVenueId = null; // Track if we're editing vs adding

// =============================================
// Venue Data — localStorage CRUD
// =============================================

/**
 * loadVenues() / saveVenues(venues)
 * Read/write the venues array to localStorage under STORAGE_KEYS.VENUES.
 * Each venue: { id, name, address, description, availability, photoDataUrl,
 *               calendarAvailability, timeSlots }
 *
 * calendarAvailability: { [day]: { booked: bool, times: string[] } }
 * timeSlots: string[] — the 3 customizable time slots for this venue
 */
function loadVenues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENUES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVenues(venues) {
  localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(venues));
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
  };
  const titleEl = document.getElementById("workspaceTitle");
  if (titleEl) titleEl.textContent = titles[viewId] || "Dashboard";

  if (element) {
    document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }

  if (viewId === "proposals-view") renderProposals();
}

// =============================================
// Dashboard Stats
// =============================================

function updateDashboardStats() {
  const proposals = loadProposals();
  const venues = loadVenues();
  const active = proposals.filter((p) => p.status === "accepted").length;
  const pending = proposals.filter((p) => p.status === "pending").length;
  const rejected = proposals.filter((p) => p.status === "rejected").length;

  document.getElementById("countActive").textContent = active;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countRejected").textContent = rejected;
  document.getElementById("countVenues").textContent = venues.length;
}

// =============================================
// Schedule Tracker (Dashboard)
// =============================================

function renderFacultySchedule() {
  const list = document.getElementById("facultyScheduleList");
  const countBadge = document.getElementById("scheduleTrackerCount");
  if (!list) return;

  const proposals = loadProposals().filter((p) => p.status !== "rejected" && p.status !== "cancelled");

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
    rejected: { label: "Rejected", cls: "status-rejected" },
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
            <p class="schedule-card-datetime">${escapeHtml(p.date)} · ${escapeHtml(p.time)}</p>
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
  if (!confirm("Are you sure you want to delete this venue? This action cannot be undone.")) {
    return;
  }

  const venues = loadVenues();
  const venueIndex = venues.findIndex((v) => v.id === venueId);
  if (venueIndex === -1) return;

  const venueName = venues[venueIndex].name;
  venues.splice(venueIndex, 1);
  saveVenues(venues);

  activeVenue = null;
  resetVenueDetailPanel();
  renderFacultyVenueGrid();
  updateDashboardStats();
  addNotification(`Venue "${venueName}" has been deleted.`, "Just now");
}

function resetVenueDetailPanel() {
  document.getElementById("detailVenueName").textContent = "Select a Venue";
  document.getElementById("venueDescription").textContent =
    "Pick a venue from the directory to view its details and availability.";
  document.getElementById("venueAddress").textContent = "-";
  document.getElementById("venueAvailabilityText").textContent = "-";
  document.getElementById("deleteVenueBtn").style.display = "none";
  document.getElementById("editVenueBtn").style.display = "none";
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

  // Reset schedule editor
  const s1 = document.getElementById("venueSlot1");
  const s2 = document.getElementById("venueSlot2");
  const s3 = document.getElementById("venueSlot3");
  if (s1) s1.value = DEFAULT_TIME_SLOTS[0];
  if (s2) s2.value = DEFAULT_TIME_SLOTS[1];
  if (s3) s3.value = DEFAULT_TIME_SLOTS[2];

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
  document.getElementById("venueDescInput").value = venue.description;
  document.getElementById("venueAvailInput").value = venue.availability;
  document.getElementById("venuePhotoName").textContent = venue.photoDataUrl ? "Current photo loaded" : "No file selected";

  // Pre-fill time slots
  const slots = venue.timeSlots || DEFAULT_TIME_SLOTS;
  const s1 = document.getElementById("venueSlot1");
  const s2 = document.getElementById("venueSlot2");
  const s3 = document.getElementById("venueSlot3");
  if (s1) s1.value = slots[0] || DEFAULT_TIME_SLOTS[0];
  if (s2) s2.value = slots[1] || DEFAULT_TIME_SLOTS[1];
  if (s3) s3.value = slots[2] || DEFAULT_TIME_SLOTS[2];

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
  const description = document.getElementById("venueDescInput").value.trim();
  const availability = document.getElementById("venueAvailInput").value.trim();
  const photoInput = document.getElementById("venuePhotoInput");
  const photoFile = photoInput?.files?.[0];

  // Read time slot values from the schedule editor
  const timeSlots = [
    document.getElementById("venueSlot1")?.value.trim() || DEFAULT_TIME_SLOTS[0],
    document.getElementById("venueSlot2")?.value.trim() || DEFAULT_TIME_SLOTS[1],
    document.getElementById("venueSlot3")?.value.trim() || DEFAULT_TIME_SLOTS[2],
  ];

  const venues = loadVenues();

  if (editingVenueId) {
    // ---- EDIT MODE ----
    const venueIndex = venues.findIndex((v) => v.id === editingVenueId);
    if (venueIndex === -1) return;

    venues[venueIndex].name = name;
    venues[venueIndex].address = address;
    venues[venueIndex].description = description;
    venues[venueIndex].availability = availability;
    venues[venueIndex].timeSlots = timeSlots;

    // Only update photo if a new one was selected
    if (photoFile) {
      venues[venueIndex].photoDataUrl = await readFileAsDataUrl(photoFile);
    }

    saveVenues(venues);
    closeAddVenueModal();
    renderFacultyVenueGrid();
    displayVenueDetail(editingVenueId);
    addNotification(`Venue "${name}" has been updated.`, "Just now");
  } else {
    // ---- ADD MODE ----
    let photoDataUrl = "";
    if (photoFile) {
      photoDataUrl = await readFileAsDataUrl(photoFile);
    }

    const newVenue = {
      id: `venue-${Date.now()}`,
      name,
      address,
      description,
      availability,
      photoDataUrl,
      calendarAvailability: {},
      timeSlots,
    };

    venues.push(newVenue);
    saveVenues(venues);
    closeAddVenueModal();
    renderFacultyVenueGrid();
    displayVenueDetail(newVenue.id);
    addNotification(`Venue "${name}" added to the directory.`, "Just now");
  }
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
    const dayAvailability = availability[day];
    const status = getDayAvailabilityStatus(dayAvailability);
    const times = dayAvailability?.times || [];
    const isSelected = selectedCalendarDay === day;
    const slotsHTML =
      status === "available"
        ? `<div class="day-times">${formatCalendarDaySlots(times)}</div>`
        : status === "booked"
          ? '<span class="day-status-label">Booked</span>'
          : "";

    html += `
      <button type="button" class="calendar-date ${status}${isSelected ? " is-selected" : ""}" data-day="${day}">
        <span class="day-number">${day}</span>
        ${slotsHTML}
      </button>
    `;
  }

  calendarDates.innerHTML = html;
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
  if (activeVenue) renderVenueCalendar(activeVenue);
}

// =============================================
// Proposals — Render, Accept, Reject
// =============================================

/**
 * renderProposals()
 * Reads proposals from localStorage and renders each as a card.
 * Includes PDF preview iframe AND a download button for direct download.
 */
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
        : p.status === "rejected" ? "status-rejected"
        : p.status === "cancelled" ? "status-cancelled"
        : "status-pending";
      const statusLabel =
        p.status === "accepted" ? "Accepted"
        : p.status === "rejected" ? "Rejected"
        : p.status === "cancelled" ? "Cancelled"
        : "Pending Review";

      // PDF section: preview iframe + download button
      const pdfSection = p.pdfDataUrl
        ? `<iframe src="${p.pdfDataUrl}" title="PDF preview for ${escapeHtml(p.title)}" class="proposal-pdf-frame"></iframe>
           <div class="proposal-pdf-actions">
             <a href="${p.pdfDataUrl}" download="${escapeHtml(p.pdfName || 'letter-request.pdf')}" class="btn btn-small proposal-download-btn">⬇ Download PDF</a>
             <a href="${p.pdfDataUrl}" target="_blank" class="btn btn-small btn-secondary proposal-view-btn">↗ Open in New Tab</a>
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
          <p><strong>Venue:</strong> ${escapeHtml(p.venue)}</p>
          <p><strong>Date &amp; Time:</strong> ${escapeHtml(p.date)} · ${escapeHtml(p.time)}</p>
          <p><strong>Attendance:</strong> ${escapeHtml(String(p.attendees || "-"))}</p>
          ${p.status === "rejected" && p.rejectionReason ? `<p class="event-reject-reason"><strong>Rejection Reason:</strong> ${escapeHtml(p.rejectionReason)}</p>` : ""}
        </div>
        <div class="proposal-pdf-preview">
          <div class="proposal-pdf-label">Letter Request</div>
          ${pdfSection}
        </div>
        <div class="proposal-card-actions">
          ${p.status === "pending" ? `
            <button type="button" class="btn btn-success proposal-accept-btn" data-id="${escapeHtml(p.id)}">Accept</button>
            <button type="button" class="btn btn-danger proposal-reject-btn" data-id="${escapeHtml(p.id)}">Reject</button>
          ` : ""}
        </div>
        ${p.status === "pending" ? `
          <div class="proposal-reject-form hidden" id="reject-form-${escapeHtml(p.id)}">
            <label for="reject-reason-${escapeHtml(p.id)}">Reason for rejection <span class="required-indicator" aria-label="required">*</span></label>
            <textarea id="reject-reason-${escapeHtml(p.id)}" class="form-control" rows="2" required placeholder="Provide a reason for the student..."></textarea>
            <div class="form-actions">
              <button type="button" class="btn btn-danger proposal-confirm-reject-btn" data-id="${escapeHtml(p.id)}">Confirm Reject</button>
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
        alert("Please provide a reason for rejection.");
        return;
      }
      rejectProposal(btn.dataset.id, reason);
    });
  });
}

function acceptProposal(id) {
  const proposals = loadProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return;

  proposal.status = "accepted";
  saveProposals(proposals);
  addNotification(`Proposal "${proposal.title}" has been accepted.`, "Just now");
  renderProposals();
  renderFacultySchedule();
  updateDashboardStats();
}

function rejectProposal(id, reason) {
  const proposals = loadProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return;

  proposal.status = "rejected";
  proposal.rejectionReason = reason;
  saveProposals(proposals);
  addNotification(`Proposal "${proposal.title}" has been rejected.`, "Just now");
  renderProposals();
  renderFacultySchedule();
  updateDashboardStats();
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
  input.addEventListener("change", () => {
    label.textContent = input.files[0]?.name || "No file selected";
  });
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

  // Initialize all
  initializeVenuePhotoZone();
  renderFacultyVenueGrid();
  renderFacultySchedule();
  renderProposals();
  updateDashboardStats();
  updateNotificationBadge();

  // Listen for cross-tab updates
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS) {
      renderProposals();
      renderFacultySchedule();
      updateDashboardStats();
    }
  });

  window.addEventListener("eventsync-proposals-updated", () => {
    renderProposals();
    renderFacultySchedule();
    updateDashboardStats();
  });
});