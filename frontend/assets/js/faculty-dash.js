let activeVenue = null;
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();
let selectedCalendarDay = null;
let facultyVenueData = {};
let notifications = [];
let unreadNotifications = 0;

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
  venues.forEach((v) => {
    map[v.id] = v;
  });
  return map;
}

function switchView(viewId, element) {
  document
    .querySelectorAll(".view-section")
    .forEach((v) => v.classList.remove("active-view"));
  document.getElementById(viewId)?.classList.add("active-view");

  const titles = {
    "dashboard-view": "Dashboard Overview",
    "venues-view": "Venue Directory",
    "proposals-view": "Proposed Events",
  };
  const titleEl = document.getElementById("workspaceTitle");
  if (titleEl) titleEl.textContent = titles[viewId] || "Dashboard";

  if (element) {
    document
      .querySelectorAll(".menu-item")
      .forEach((i) => i.classList.remove("active"));
    element.classList.add("active");
  }

  if (viewId === "proposals-view") renderProposals();
}

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

function renderFacultySchedule() {
  const list = document.getElementById("facultyScheduleList");
  const countBadge = document.getElementById("scheduleTrackerCount");
  if (!list) return;

  const proposals = loadProposals().filter((p) => p.status !== "rejected");

  if (countBadge) {
    countBadge.textContent = `${proposals.length} event${proposals.length === 1 ? "" : "s"}`;
  }

  if (!proposals.length) {
    list.innerHTML =
      '<p class="empty-state">No scheduled events to display yet.</p>';
    return;
  }

  const statusMap = {
    pending: { label: "Pending Review", cls: "status-pending" },
    accepted: { label: "Accepted", cls: "status-approved" },
    rejected: { label: "Rejected", cls: "status-rejected" },
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

  document
    .getElementById("openAddVenueBtn")
    ?.addEventListener("click", openAddVenueModal);
  updateDashboardStats();
}

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
  document.getElementById("venueAvailabilityText").textContent =
    venue.availability;

  const deleteBtn = document.getElementById("deleteVenueBtn");
  if (deleteBtn) {
    deleteBtn.style.display = "inline-block";
  }

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}

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
  document.getElementById("detailVenueName").textContent = "Select a Venue";
  document.getElementById("venueDescription").textContent =
    "Pick a venue from the directory to view its details and availability.";
  document.getElementById("venueAddress").textContent = "-";
  document.getElementById("venueAvailabilityText").textContent = "-";
  document.getElementById("deleteVenueBtn").style.display = "none";

  renderFacultyVenueGrid();
  updateDashboardStats();
  addNotification(`Venue "${venueName}" has been deleted.`, "Just now");
}

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
  const daysInMonth = new Date(
    viewCalendarYear,
    viewCalendarMonth + 1,
    0,
  ).getDate();

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

function openAddVenueModal() {
  document.getElementById("addVenueModal")?.classList.remove("hidden");
  document.getElementById("addVenueForm")?.reset();
  document.getElementById("venuePhotoName").textContent = "No file selected";
}

function closeAddVenueModal() {
  document.getElementById("addVenueModal")?.classList.add("hidden");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  let photoDataUrl = "";
  if (photoFile) {
    photoDataUrl = await readFileAsDataUrl(photoFile);
  }

  const venues = loadVenues();
  const newVenue = {
    id: `venue-${Date.now()}`,
    name,
    address,
    description,
    availability,
    photoDataUrl,
    calendarAvailability: {},
  };

  venues.push(newVenue);
  saveVenues(venues);
  closeAddVenueModal();
  renderFacultyVenueGrid();
  displayVenueDetail(newVenue.id);
  addNotification(`Venue "${name}" added to the directory.`, "Just now");
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
        p.status === "accepted"
          ? "status-approved"
          : p.status === "rejected"
            ? "status-rejected"
            : p.status === "cancelled"
              ? "status-cancelled"
              : "status-pending";
      const statusLabel =
        p.status === "accepted"
          ? "Accepted"
          : p.status === "rejected"
            ? "Rejected"
            : p.status === "cancelled"
              ? "Cancelled"
              : "Pending Review";

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
          <div class="proposal-pdf-label">Letter Request Preview</div>
          ${
            p.pdfDataUrl
              ? `<iframe src="${p.pdfDataUrl}" title="PDF preview for ${escapeHtml(p.title)}" class="proposal-pdf-frame"></iframe>`
              : '<p class="empty-state">No PDF attached.</p>'
          }
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

  grid.querySelectorAll(".proposal-accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => acceptProposal(btn.dataset.id));
  });
  grid.querySelectorAll(".proposal-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .getElementById(`reject-form-${btn.dataset.id}`)
        ?.classList.remove("hidden");
    });
  });
  grid.querySelectorAll(".proposal-cancel-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .getElementById(`reject-form-${btn.dataset.id}`)
        ?.classList.add("hidden");
    });
  });
  grid.querySelectorAll(".proposal-confirm-reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reason = document
        .getElementById(`reject-reason-${btn.dataset.id}`)
        ?.value.trim();
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
  addNotification(
    `Proposal "${proposal.title}" has been accepted.`,
    "Just now",
  );
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
  addNotification(
    `Proposal "${proposal.title}" has been rejected.`,
    "Just now",
  );
  renderProposals();
  renderFacultySchedule();
  updateDashboardStats();
}

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

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  document
    .getElementById("calendarPrevMonth")
    ?.addEventListener("click", () => shiftCalendarMonth(-1));
  document
    .getElementById("calendarNextMonth")
    ?.addEventListener("click", () => shiftCalendarMonth(1));

  document
    .getElementById("addVenueForm")
    ?.addEventListener("submit", handleAddVenueSubmit);
  document
    .getElementById("closeAddVenueBtn")
    ?.addEventListener("click", closeAddVenueModal);
  document
    .getElementById("cancelAddVenueBtn")
    ?.addEventListener("click", closeAddVenueModal);
  document.getElementById("addVenueModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addVenueModal") closeAddVenueModal();
  });

  document
    .getElementById("deleteVenueBtn")
    ?.addEventListener("click", () => {
      if (activeVenue) {
        deleteVenue(activeVenue);
      }
    });

  document
    .getElementById("notificationBell")
    ?.addEventListener("click", toggleNotificationPopup);

  function initializeProfileMenu() {
    const profileButton = document.getElementById("profileButton");
    const viewProfileBtn = document.getElementById("viewProfileBtn");
    const accountSettingsBtn = document.getElementById("accountSettingsBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (profileButton) {
      profileButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleProfileDropdown();
      });
    }

    if (viewProfileBtn) {
      viewProfileBtn.addEventListener("click", () => {
        closeProfileDropdown();
        alert("View Profile page not yet implemented.");
      });
    }

    if (accountSettingsBtn) {
      accountSettingsBtn.addEventListener("click", () => {
        closeProfileDropdown();
        alert("Account Settings page not yet implemented.");
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        closeProfileDropdown();
        window.location.href = "index.html";
      });
    }
  }

  initializeProfileMenu();
  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });
  initializeVenuePhotoZone();
  renderFacultyVenueGrid();
  renderFacultySchedule();
  renderProposals();
  updateDashboardStats();
  updateNotificationBadge();

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
