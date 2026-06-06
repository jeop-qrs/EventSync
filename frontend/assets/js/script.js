let activeVenue = null;
let viewCalendarMonth = new Date().getMonth();
let viewCalendarYear = new Date().getFullYear();
let selectedCalendarDay = null;

const venueData = {
  "Bamboo Building": {
    title: "Bamboo Building",
    capacity: 250,
    description:
      "A premium indoor venue with A/V support and climate control, ideal for large symposiums and product launches.",
    link: "https://example.com/bamboo-building",
    availability: {
      3: { booked: true },
      4: { booked: true },
      8: { booked: true },
      15: { booked: true },
      16: { booked: true },
      22: { booked: true },
      1: { booked: false, times: ["09:00 - 12:00", "14:00 - 17:00"] },
      2: { booked: false, times: ["08:00 - 11:00", "13:00 - 16:00"] },
    },
  },
  "Function Hall": {
    title: "Function Hall",
    capacity: 45,
    description:
      "A compact, flexible room with workstation support and presentation-ready lighting for workshops or seminars.",
    link: "https://example.com/function-hall",
    availability: {
      1: { booked: true },
      6: { booked: true },
      12: { booked: true },
      19: { booked: true },
      25: { booked: true },
      2: { booked: false, times: ["10:00 - 13:00", "15:00 - 18:00"] },
      5: { booked: false, times: ["09:00 - 12:00", "14:00 - 17:00"] },
    },
  },
  "PSC Ground": {
    title: "PSC Ground",
    capacity: 80,
    description:
      "A versatile ground floor venue with sound support and flexible seating, great for fairs and networking events.",
    link: "https://example.com/psc-ground",
    availability: {
      2: { booked: true },
      7: { booked: true },
      13: { booked: true },
      18: { booked: true },
      23: { booked: true },
      29: { booked: true },
      3: {
        booked: false,
        times: ["08:00 - 11:00", "12:00 - 15:00", "16:00 - 19:00"],
      },
      10: { booked: false, times: ["09:00 - 12:00", "14:00 - 17:00"] },
    },
  },
  Court: {
    title: "Court",
    capacity: 80,
    description:
      "An open-air court setting with sound system options, suited for performances, competitions, and casual gatherings.",
    link: "https://example.com/court",
    availability: {
      5: { booked: true },
      9: { booked: true },
      14: { booked: true },
      20: { booked: true },
      26: { booked: true },
      6: { booked: false, times: ["10:00 - 13:00", "15:00 - 18:00"] },
      11: { booked: false, times: ["08:00 - 11:00", "13:00 - 16:00"] },
    },
  },
};

function getDayAvailabilityStatus(dayAvailability) {
  if (!dayAvailability) return "neutral";
  if (dayAvailability.booked) return "booked";
  if (dayAvailability.times?.length === 1) return "partial";
  if (dayAvailability.times?.length > 1) return "available";
  return "neutral";
}

function updateCalendarDayDetail(venueName, day, dayAvailability) {
  const detailPanel = document.getElementById("calendarDayDetail");
  const detailTitle = document.getElementById("calendarDayDetailTitle");
  const detailTimes = document.getElementById("calendarDayTimes");

  if (!detailPanel || !detailTitle || !detailTimes) return;

  if (!day || !dayAvailability) {
    detailPanel.hidden = true;
    detailTimes.innerHTML = "";
    return;
  }

  const monthLabel = MONTH_NAMES[viewCalendarMonth];
  const status = getDayAvailabilityStatus(dayAvailability);

  detailPanel.hidden = false;

  if (status === "booked") {
    detailTitle.textContent = `${monthLabel} ${day}, ${viewCalendarYear} — Fully booked`;
    detailTimes.innerHTML =
      '<li class="calendar-day-times-empty">This date is fully booked.</li>';
    return;
  }

  if (status === "available" || status === "partial") {
    const heading = status === "partial" ? "Limited availability" : "Available times";
    detailTitle.textContent = `${monthLabel} ${day}, ${viewCalendarYear} — ${heading}`;
    detailTimes.innerHTML = dayAvailability.times
      .map((slot) => `<li>${escapeHtml(slot)}</li>`)
      .join("");
    return;
  }

  detailTitle.textContent = `${monthLabel} ${day}, ${viewCalendarYear}`;
  detailTimes.innerHTML =
    '<li class="calendar-day-times-empty">No availability listed for this date.</li>';
}

function selectCalendarDay(venueName, day) {
  selectedCalendarDay = day;
  const venue = venueData[venueName];
  const dayAvailability = venue?.availability?.[day];

  document
    .querySelectorAll("#venueCalendarDates .calendar-date[data-day]")
    .forEach((cell) => {
      cell.classList.toggle(
        "is-selected",
        Number(cell.dataset.day) === day,
      );
    });

  updateCalendarDayDetail(venueName, day, dayAvailability);
}

function renderVenueCalendar(venueName) {
  const calendarDates = document.getElementById("venueCalendarDates");
  const monthLabel = document.getElementById("calendarMonthLabel");

  if (!calendarDates) return;

  const venue = venueData[venueName];
  if (!venue) {
    calendarDates.innerHTML = "";
    if (monthLabel) monthLabel.textContent = "";
    return;
  }

  if (monthLabel) {
    monthLabel.textContent = `${MONTH_NAMES[viewCalendarMonth]} ${viewCalendarYear}`;
  }

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
    const dayAvailability = venue.availability[day];
    const status = getDayAvailabilityStatus(dayAvailability);
    const times = dayAvailability?.times || [];
    const isSelected = selectedCalendarDay === day;
    const ariaLabel =
      status === "booked"
        ? `${MONTH_NAMES[viewCalendarMonth]} ${day}: fully booked`
        : status === "available"
          ? `${MONTH_NAMES[viewCalendarMonth]} ${day}: available ${times.join(", ")}`
          : status === "partial"
            ? `${MONTH_NAMES[viewCalendarMonth]} ${day}: limited availability ${times.join(", ")}`
            : `${MONTH_NAMES[viewCalendarMonth]} ${day}: no schedule data`;

    const slotsHTML =
      status === "available" || status === "partial"
        ? `<div class="day-times">${formatCalendarDaySlots(times)}</div>`
        : status === "booked"
          ? '<span class="day-status-label">Booked</span>'
          : "";

    html += `
      <button
        type="button"
        class="calendar-date ${status}${isSelected ? " is-selected" : ""}"
        data-day="${day}"
        aria-label="${escapeHtml(ariaLabel)}"
      >
        <span class="day-number">${day}</span>
        ${slotsHTML}
      </button>
    `;
  }

  calendarDates.innerHTML = html;

  calendarDates.querySelectorAll(".calendar-date[data-day]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectCalendarDay(venueName, Number(cell.dataset.day));
    });
  });

  if (
    selectedCalendarDay &&
    selectedCalendarDay <= daysInMonth &&
    selectedCalendarDay >= 1
  ) {
    selectCalendarDay(venueName, selectedCalendarDay);
  } else {
    selectedCalendarDay = null;
    updateCalendarDayDetail(venueName, null, null);
  }
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

function initializeVenueCalendarNav() {
  document
    .getElementById("calendarPrevMonth")
    ?.addEventListener("click", () => shiftCalendarMonth(-1));
  document
    .getElementById("calendarNextMonth")
    ?.addEventListener("click", () => shiftCalendarMonth(1));
}

function displayVenueDetail(venueName) {
  const venue = venueData[venueName];
  if (!venue) return;

  activeVenue = venueName;
  selectedCalendarDay = null;
  viewCalendarMonth = new Date().getMonth();
  viewCalendarYear = new Date().getFullYear();
  document.getElementById("detailVenueName").innerText = venue.title;
  document.getElementById("venueDescription").innerText = venue.description;
  document.getElementById("venueCapacity").innerText =
    venue.capacity + " people";

  const linkElement = document.getElementById("externalVenueInfoLink");
  if (linkElement) {
    linkElement.innerHTML = `<a href="${venue.link}" target="_blank" style="color: #0066cc; text-decoration: none;">View More Info →</a>`;
  }

  setActiveVenueCard(venueName);
  renderVenueCalendar(venueName);
}

function switchView(viewId, element) {
  document.querySelectorAll(".view-section").forEach((view) => {
    view.classList.remove("active-view");
  });

  document.getElementById(viewId).classList.add("active-view");

  const titleMap = {
    "dashboard-view": "Dashboard Overview",
    "venues-view": "Venue Space Management Inventory",
    "schedule-view": "Schedule Event Allocation Form",
  };
  document.getElementById("workspaceTitle").innerText = titleMap[viewId];

  if (element) {
    document
      .querySelectorAll(".menu-item")
      .forEach((item) => item.classList.remove("active"));
    element.classList.add("active");
  }
}

function openReservationWithVenue(venueName) {
  document.getElementById("eventVenue").value = venueName;
  const targetMenuOption = document.querySelector(
    '[data-view="schedule-view"]',
  );
  switchView("schedule-view", targetMenuOption);
}

function handleFormSubmission(e) {
  e.preventDefault();

  const title = document.getElementById("eventTitle").value;
  const venue = document.getElementById("eventVenue").value;
  const date = document.getElementById("eventDate").value;
  const time = document.getElementById("eventTime").value;
  const pdfInput = document.getElementById("eventPdf");
  const pdfFile = pdfInput.files[0];

  if (!pdfFile) {
    alert("Please attach a letter request PDF before submitting.");
    return;
  }

  const attachmentLabel = ` with attachment "${pdfFile.name}"`;

  const tableBody = document.querySelector("#eventsTable tbody");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
        <td><strong>${title}</strong></td>
        <td>${venue}</td>
        <td>${date} | ${time}</td>
        <td><span class="status-pill status-pending">Pending Review</span></td>
        <td class="admin-actions">-</td>
    `;
  tableBody.appendChild(newRow);

  const pendingElement = document.getElementById("countPending");
  pendingElement.innerText = parseInt(pendingElement.innerText, 10) + 1;

  const logFeed = document.querySelector(".notification-feed");
  const alertItem = document.createElement("div");
  alertItem.className = "notification-item";
  alertItem.innerHTML = `<strong>System Routing:</strong> Reservation request generated for "${title}"${attachmentLabel}. Awaiting Administrative check. <div class="notification-time">Just now</div>`;
  logFeed.insertBefore(alertItem, logFeed.firstChild);

  addNotification(
    `Reservation request generated for "${title}"${attachmentLabel}. Awaiting Administrative check.`,
    "Just now",
  );

  document.getElementById("scheduleForm").reset();
  updatePdfFileDisplay();
  switchView(
    "dashboard-view",
    document.querySelector('[data-view="dashboard-view"]'),
  );
}

function showStudentLogin() {
  const landing = document.getElementById("landingOverlay");
  const login = document.getElementById("studentLoginOverlay");
  if (landing) landing.classList.add("hidden");
  if (login) login.classList.remove("hidden");
}

function hideStudentLogin() {
  const landing = document.getElementById("landingOverlay");
  const login = document.getElementById("studentLoginOverlay");
  if (login) login.classList.add("hidden");
  if (landing) landing.classList.remove("hidden");
}

function handleStudentLoginSubmit(e) {
  e.preventDefault();
  const studentNumber = document.getElementById("studentNumber").value.trim();
  const password = document.getElementById("studentPassword").value;

  if (!studentNumber || !password) {
    alert("Please enter Student Number and Password.");
    return;
  }

  // For now, assume successful login (front-end only)
  // If this page is the separate users.html, redirect back to index with role param
  const pathname = window.location.pathname || "";
  const isUsersPage =
    pathname.endsWith("/users.html") || pathname.endsWith("users.html");
  if (isUsersPage) {
    // Redirect to index and let index initialize the Student session
    window.location.href = "index.html?role=Student";
    return;
  }

  const loginOverlay = document.getElementById("studentLoginOverlay");
  if (loginOverlay) loginOverlay.classList.add("hidden");
  startSession("Student");
  const formEl = document.getElementById("studentLoginForm");
  if (formEl) formEl.reset();
}

function initializeStudentLogin() {
  const form = document.getElementById("studentLoginForm");
  const backBtn = document.getElementById("studentLoginBackBtn");
  if (form) form.addEventListener("submit", handleStudentLoginSubmit);
  if (backBtn) backBtn.addEventListener("click", hideStudentLogin);
}

function handleFacultyLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("facultyUsername").value.trim();
  const password = document.getElementById("facultyPassword").value;

  if (!username || !password) {
    alert("Please enter Username and Password.");
    return;
  }

  const pathname = window.location.pathname || "";
  const isFacultyPage =
    pathname.endsWith("/faculty.html") || pathname.endsWith("faculty.html");
  if (isFacultyPage) {
    window.location.href = "faculty-dash.html";
    return;
  }

  // Fallback: start session inline
  startSession("Faculty");
  const formEl = document.getElementById("facultyLoginForm");
  if (formEl) formEl.reset();
}

function initializeFacultyLogin() {
  const form = document.getElementById("facultyLoginForm");
  const backLink = document.getElementById("facultyLoginBackBtn");
  if (form) form.addEventListener("submit", handleFacultyLoginSubmit);
  if (backLink)
    backLink.addEventListener("click", () => {
      window.location.href = "index.html";
    });
}

function switchRoleContext(selectedRole) {
  const actionHeaders = document.querySelectorAll(".admin-action-header");
  const actionCells = document.querySelectorAll(".admin-actions");

  if (selectedRole === "Administrator") {
    actionHeaders.forEach((el) => (el.style.display = "table-cell"));
    actionCells.forEach((el) => (el.style.display = "table-cell"));
  } else {
    actionHeaders.forEach((el) => (el.style.display = "none"));
    actionCells.forEach((el) => (el.style.display = "none"));
  }
}

function updateProfileDisplay(userType) {
  const profileName = document.querySelector(".profile-name");
  const profileAvatar = document.querySelector(".profile-avatar");
  if (!profileName || !profileAvatar) return;

  const profileData = {
    Student: { label: "Student", avatar: "STF" },
    Faculty: { label: "Faculty", avatar: "FAH" },
  };

  const display = profileData[userType] || {
    label: "Admin",
    avatar: "AS",
  };

  profileName.innerText = display.label;
  profileAvatar.innerText = display.avatar;
}

function processStatus(outcome) {
  const label = document.getElementById("statusLabelPending");
  const pendingElement = document.getElementById("countPending");
  const activeElement = document.getElementById("countActive");

  if (outcome === "Approved") {
    label.className = "status-pill status-approved";
    label.innerText = "Approved";
    activeElement.innerText = parseInt(activeElement.innerText, 10) + 1;
    addNotification("Reservation request has been approved.", "Just now");
  } else {
    label.className = "status-pill status-rejected";
    label.innerText = "Rejected";
    addNotification("Reservation request has been rejected.", "Just now");
  }

  pendingElement.innerText = Math.max(
    0,
    parseInt(pendingElement.innerText, 10) - 1,
  );
  switchRoleContext(document.getElementById("roleSelect").value);
}

const notifications = [
  {
    message:
      "System Update: Double-booking validations passed for Main Auditorium.",
    time: "Just now",
  },
  {
    message:
      "Reminder Configured: Automated alert set for 24 hours prior to Tech Summit execution.",
    time: "2 hours ago",
  },
];

let unreadNotifications = notifications.length;

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

function handleDocumentClick(event) {
  const profileMenu = document.getElementById("profileMenu");
  if (!profileMenu) return;
  if (!profileMenu.contains(event.target)) {
    closeProfileDropdown();
  }
}

function startSession(selectionRole) {
  const roleMap = {
    Student: "Participant",
    Faculty: "Administrator",
  };
  const normalizedRole = roleMap[selectionRole] || selectionRole;

  const landingOverlay = document.getElementById("landingOverlay");
  const sidebar = document.querySelector(".sidebar");
  const workspace = document.querySelector(".main-workspace");
  const roleSimulator = document.querySelector(".role-simulator");

  updateProfileDisplay(selectionRole);
  document.getElementById("roleSelect").value = normalizedRole;
  switchRoleContext(normalizedRole);
  switchView(
    "dashboard-view",
    document.querySelector('[data-view="dashboard-view"]'),
  );

  landingOverlay.style.display = "none";
  sidebar.classList.remove("hidden");
  workspace.classList.remove("hidden");
  roleSimulator.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("roleSelect");
  const notificationBell = document.getElementById("notificationBell");
  const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
  const venueCards = document.querySelectorAll(".venue-card[data-venue]");
  const scheduleForm = document.getElementById("scheduleForm");
  const cancelButton = document.getElementById("scheduleCancelBtn");
  const eventsTableBody = document.querySelector("#eventsTable tbody");
  const landingButtons = document.querySelectorAll(".landing-button");
  const bookNowBtn = document.getElementById("bookNowBtn");

  if (roleSelect) {
    roleSelect.addEventListener("change", (event) =>
      switchRoleContext(event.target.value),
    );
  }

  if (notificationBell) {
    notificationBell.addEventListener("click", () => {
      toggleNotificationPopup();
      switchView(
        "dashboard-view",
        document.querySelector('[data-view="dashboard-view"]'),
      );
    });
  }

  menuItems.forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view, item));
  });

  landingButtons.forEach((button) => {
    if (button.dataset.role === "Student") {
      button.addEventListener("click", () => {
        // Navigate to separate users.html page for student login
        window.location.href = "users.html";
      });
    } else if (button.dataset.role === "Faculty") {
      button.addEventListener("click", () => {
        // Navigate to separate faculty login page
        window.location.href = "faculty.html";
      });
    } else {
      button.addEventListener("click", () => startSession(button.dataset.role));
    }
  });

  venueCards.forEach((card) => {
    const venueName = card.dataset.venue;
    card.addEventListener("click", () => displayVenueDetail(venueName));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        displayVenueDetail(venueName);
      }
    });
  });

  if (bookNowBtn) {
    bookNowBtn.addEventListener("click", () => {
      if (!activeVenue) {
        alert("Please select a venue before booking.");
        return;
      }
      openReservationWithVenue(activeVenue);
    });
  }

  if (scheduleForm) {
    scheduleForm.addEventListener("submit", handleFormSubmission);
  }

  initializePdfDropzone();
  initializeStudentLogin();
  initializeFacultyLogin();
  initializeProfileMenu();
  initializeVenueCalendarNav();
  document.addEventListener("click", handleDocumentClick);

  const currentPath = window.location.pathname || "";
  const isFacultyDash =
    currentPath.endsWith("/faculty-dash.html") ||
    currentPath.endsWith("faculty-dash.html");

  if (isFacultyDash) {
    startSession("Faculty");
  } else {
    try {
      const params = new URLSearchParams(window.location.search);
      const role = params.get("role");
      if (role === "Student" || role === "Faculty") {
        startSession(role);
      }
    } catch (err) {
      // ignore if URL API unavailable
    }
  }

  renderNotificationPopup();
  updateNotificationBadge();

  if (cancelButton) {
    cancelButton.addEventListener("click", () =>
      switchView(
        "dashboard-view",
        document.querySelector('[data-view="dashboard-view"]'),
      ),
    );
  }

  if (eventsTableBody) {
    eventsTableBody.addEventListener("click", (event) => {
      if (event.target.matches(".btn-success")) {
        processStatus("Approved");
      }
      if (event.target.matches(".btn-danger")) {
        processStatus("Rejected");
      }
    });
  }
});
