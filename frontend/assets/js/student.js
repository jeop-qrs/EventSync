const DEFAULT_VENUES = [
  {
    id: "bamboo-building",
    name: "Bamboo Building",
    address: "Main Campus, Building B",
    description:
      "A premium indoor venue with A/V support and climate control, ideal for large symposiums.",
    availability: "Mon–Fri 8:00 AM – 6:00 PM",
    photoDataUrl: "/frontend/assets/img/Bamboo building.png",
    calendarAvailability: {
      3: { booked: true },
      1: { booked: false, times: ["09:00 - 12:00", "14:00 - 17:00"] },
      2: { booked: false, times: ["08:00 - 11:00", "13:00 - 16:00"] },
    },
  },
  {
    id: "function-hall",
    name: "Function Hall",
    address: "Annex Wing, Level 2",
    description:
      "A compact, flexible room with workstation support for workshops or seminars.",
    availability: "Tue–Sat 9:00 AM – 5:00 PM",
    photoDataUrl: "/frontend/assets/img/Function Hall.png",
    calendarAvailability: {
      1: { booked: true },
      2: { booked: false, times: ["10:00 - 13:00", "15:00 - 18:00"] },
    },
  },
  {
    id: "psc-ground",
    name: "PSC Ground",
    address: "Ground Floor, PSC Building",
    description:
      "A versatile ground floor venue with sound support and flexible seating.",
    availability: "Daily 7:00 AM – 8:00 PM",
    photoDataUrl: "/frontend/assets/img/PSC Ground.png",
    calendarAvailability: {
      2: { booked: true },
      3: { booked: false, times: ["08:00 - 11:00", "16:00 - 19:00"] },
    },
  },
  {
    id: "court",
    name: "Court",
    address: "Outdoor Sports Complex",
    description:
      "An open-air court setting with sound system options for performances and gatherings.",
    availability: "Weekends 8:00 AM – 4:00 PM",
    photoDataUrl: "/frontend/assets/img/Court.png",
    calendarAvailability: {
      5: { booked: true },
      6: { booked: false, times: ["10:00 - 13:00", "15:00 - 18:00"] },
    },
  },
];

let activeVenue = null;
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();
let selectedCalendarDay = null;
let studentVenueData = {};
let notifications = [];
let unreadNotifications = 0;
let cancelEventId = null;

function loadFacultyVenues() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VENUES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getAllVenues() {
  const facultyVenues = loadFacultyVenues();
  const merged = [...DEFAULT_VENUES];
  facultyVenues.forEach((fv) => {
    if (!merged.find((v) => v.id === fv.id || v.name === fv.name)) {
      merged.push(fv);
    }
  });
  return merged;
}

function buildVenueMap(venues) {
  const map = {};
  venues.forEach((v) => { map[v.id] = v; });
  return map;
}

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

function startSession() {
  document.getElementById("landingOverlay").style.display = "none";
  document.querySelector(".sidebar")?.classList.remove("hidden");
  document.querySelector(".main-workspace")?.classList.remove("hidden");
  document.querySelector(".role-simulator")?.classList.remove("hidden");
  refreshAll();
}

function updateStudentStats() {
  const proposals = loadProposals();
  const proposed = proposals.length;
  const pending = proposals.filter((p) => p.status === "pending").length;

  document.getElementById("countProposed").textContent = proposed;
  document.getElementById("countPending").textContent = pending;
  document.getElementById("countVenues").textContent = 4;
}

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

function cancelEvent(id) {
  cancelEventId = id;
  document.getElementById("cancelReason").value = "";
  document.getElementById("cancelReasonModal").classList.remove("hidden");
}

function openCancelReasonModal() {
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

function displayVenueDetail(venueId) {
  const venue = studentVenueData[venueId];
  if (!venue) return;

  activeVenue = venueId;
  selectedCalendarDay = null;
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();

  document.getElementById("detailVenueName").textContent = venue.name;
  document.getElementById("venueDescription").textContent = venue.description;
  document.getElementById("venueAddress").textContent = venue.address;
  document.getElementById("venueAvailabilityText").textContent = venue.availability;

  setActiveVenueCard(venueId);
  renderVenueCalendar(venueId);
}

function getDayAvailabilityStatus(dayAvailability) {
  if (!dayAvailability) return "neutral";
  if (dayAvailability.booked) return "booked";
  if (dayAvailability.times?.length) return "available";
  return "neutral";
}

function updateCalendarDayDetail(venueId, day, dayAvailability) {
  const detailPanel = document.getElementById("calendarDayDetail");
  const detailTitle = document.getElementById("calendarDayDetailTitle");
  const detailTimes = document.getElementById("calendarDayTimes");
  if (!detailPanel || !detailTitle || !detailTimes) return;

  if (!day || !dayAvailability) {
    detailPanel.hidden = true;
    return;
  }

  const status = getDayAvailabilityStatus(dayAvailability);
  detailPanel.hidden = false;

  if (status === "booked") {
    detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — Fully booked`;
    detailTimes.innerHTML = '<li class="calendar-day-times-empty">This date is fully booked.</li>';
    return;
  }
  if (status === "available") {
    detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear} — Available times`;
    detailTimes.innerHTML = dayAvailability.times.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
    return;
  }
  detailTitle.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${day}, ${viewCalendarYear}`;
  detailTimes.innerHTML = '<li class="calendar-day-times-empty">No availability listed for this date.</li>';
}

function selectCalendarDay(venueId, day) {
  selectedCalendarDay = day;
  const venue = studentVenueData[venueId];
  const dayAvailability = venue?.calendarAvailability?.[day];

  document.querySelectorAll("#venueCalendarDates .calendar-date[data-day]").forEach((cell) => {
    cell.classList.toggle("is-selected", Number(cell.dataset.day) === day);
  });

  updateCalendarDayDetail(venueId, day, dayAvailability);
}

function renderVenueCalendar(venueId) {
  const calendarDates = document.getElementById("venueCalendarDates");
  const monthLabel = document.getElementById("calendarMonthLabel");
  const venue = studentVenueData[venueId];
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

  calendarDates.querySelectorAll(".calendar-date[data-day]").forEach((cell) => {
    cell.addEventListener("click", () => selectCalendarDay(venueId, Number(cell.dataset.day)));
  });
}

function shiftCalendarMonth(delta) {
  viewCalendarMonth += delta;
  if (viewCalendarMonth < 0) { viewCalendarMonth = 11; viewCalendarYear -= 1; }
  else if (viewCalendarMonth > 11) { viewCalendarMonth = 0; viewCalendarYear += 1; }
  selectedCalendarDay = null;
  if (activeVenue) renderVenueCalendar(activeVenue);
}

function openReservationWithVenue(venueName) {
  const select = document.getElementById("eventVenue");
  if (select) select.value = venueName;
  switchView("schedule-view", document.querySelector('[data-view="schedule-view"]'));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFormSubmission(e) {
  e.preventDefault();

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

  const pdfDataUrl = await readFileAsDataUrl(pdfFile);

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
    pdfDataUrl,
    status: "pending",
    rejectionReason: "",
    submittedAt: new Date().toISOString(),
  });

  saveProposals(proposals);
  addNotification(`Proposal "${title}" submitted. Awaiting faculty review.`, "Just now");

  document.getElementById("scheduleForm").reset();
  updatePdfFileDisplay();
  switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  refreshAll();
}

function refreshAll() {
  updateStudentStats();
  renderMyEvents();
  renderStudentVenueGrid();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  document.getElementById("student-btn")?.addEventListener("click", () => {
    window.location.href = "users.html";
  });
  document.getElementById("faculty-btn")?.addEventListener("click", () => {
    window.location.href = "faculty.html";
  });

  document.getElementById("dashboardBookNowBtn")?.addEventListener("click", () => {
    switchView("venues-view", document.querySelector('[data-view="venues-view"]'));
  });

  document.getElementById("bookNowBtn")?.addEventListener("click", () => {
    if (!activeVenue) {
      alert("Please select a venue before booking.");
      return;
    }
    const venue = studentVenueData[activeVenue];
    openReservationWithVenue(venue?.name || "");
  });

  document.getElementById("scheduleForm")?.addEventListener("submit", handleFormSubmission);
  document.getElementById("scheduleCancelBtn")?.addEventListener("click", () => {
    switchView("dashboard-view", document.querySelector('[data-view="dashboard-view"]'));
  });

  document.getElementById("calendarPrevMonth")?.addEventListener("click", () => shiftCalendarMonth(-1));
  document.getElementById("calendarNextMonth")?.addEventListener("click", () => shiftCalendarMonth(1));

  document.getElementById("notificationBell")?.addEventListener("click", toggleNotificationPopup);
  document.getElementById("profileButton")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileDropdown();
  });
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    closeProfileDropdown();
    document.getElementById("landingOverlay").style.display = "";
    document.querySelector(".sidebar")?.classList.add("hidden");
    document.querySelector(".main-workspace")?.classList.add("hidden");
    document.querySelector(".role-simulator")?.classList.add("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("profileMenu")?.contains(e.target)) closeProfileDropdown();
  });

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

  const params = new URLSearchParams(window.location.search);
  if (params.get("role") === "Student") {
    startSession();
  }

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.PROPOSALS || e.key === STORAGE_KEYS.VENUES) refreshAll();
  });
  window.addEventListener("eventsync-proposals-updated", refreshAll);
});
