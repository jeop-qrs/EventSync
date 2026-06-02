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

function validatePdfFile(file) {
  return (
    file &&
    (file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf"))
  );
}

function updatePdfFileDisplay(fileName) {
  const pdfFileName = document.getElementById("pdfFileName");
  if (pdfFileName) {
    pdfFileName.innerText = fileName || "No file selected";
  }
}

function handlePdfSelection() {
  const pdfInput = document.getElementById("eventPdf");
  const file = pdfInput.files[0];

  if (!file) {
    updatePdfFileDisplay();
    return;
  }

  if (!validatePdfFile(file)) {
    alert("Please upload a valid PDF file.");
    pdfInput.value = "";
    updatePdfFileDisplay();
    return;
  }

  updatePdfFileDisplay(file.name);
}

function initializePdfDropzone() {
  const pdfInput = document.getElementById("eventPdf");
  const pdfDropzone = document.getElementById("pdfDropzone");

  if (!pdfInput || !pdfDropzone) {
    return;
  }

  pdfInput.addEventListener("change", handlePdfSelection);

  pdfDropzone.addEventListener("click", () => pdfInput.click());

  pdfDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    pdfDropzone.classList.add("dropzone-active");
  });

  pdfDropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    pdfDropzone.classList.remove("dropzone-active");
  });

  pdfDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    pdfDropzone.classList.remove("dropzone-active");

    if (event.dataTransfer.files.length) {
      const file = event.dataTransfer.files[0];
      if (!validatePdfFile(file)) {
        alert("Please drop a valid PDF file.");
        return;
      }

      pdfInput.files = event.dataTransfer.files;
      updatePdfFileDisplay(file.name);
    }
  });
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
    window.location.href = "index.html?role=Faculty";
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
    Student: { label: "Organizer", avatar: "OG" },
    Faculty: { label: "Manager", avatar: "EM" },
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

function renderNotificationPopup() {
  const list = document.getElementById("notificationPopupList");
  if (!list) return;
  list.innerHTML = notifications
    .map(
      (notification) => `
        <div class="notification-popup-item">
            <div>${notification.message}</div>
            <small>${notification.time}</small>
        </div>
    `,
    )
    .join("");
}

function updateNotificationBadge() {
  const badge = document.getElementById("notificationCount");
  if (!badge) return;
  badge.innerText = unreadNotifications > 99 ? "99+" : unreadNotifications;
  badge.style.display = unreadNotifications > 0 ? "inline-flex" : "none";
}

function addNotification(message, time = "Just now") {
  notifications.unshift({ message, time });
  unreadNotifications += 1;
  renderNotificationPopup();
  updateNotificationBadge();
}

function toggleNotificationPopup() {
  closeProfileDropdown();
  const popup = document.getElementById("notificationPopup");
  if (!popup) return;
  popup.classList.toggle("hidden");
  if (!popup.classList.contains("hidden")) {
    unreadNotifications = 0;
    updateNotificationBadge();
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const button = document.getElementById("profileButton");
  if (!dropdown || !button) return;

  const isHidden = dropdown.classList.toggle("hidden");
  button.setAttribute("aria-expanded", String(!isHidden));
}

function closeProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const button = document.getElementById("profileButton");
  if (!dropdown) return;
  dropdown.classList.add("hidden");
  if (button) button.setAttribute("aria-expanded", "false");
}

function initializeProfileMenu() {
  const profileButton = document.getElementById("profileButton");
  const logoutBtn = document.getElementById("logoutBtn");
  if (profileButton) {
    profileButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleProfileDropdown();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      closeProfileDropdown();
      alert("You have been logged out.");
      const landingOverlay = document.getElementById("landingOverlay");
      const sidebar = document.querySelector(".sidebar");
      const workspace = document.querySelector(".main-workspace");
      const roleSimulator = document.querySelector(".role-simulator");
      if (landingOverlay) landingOverlay.style.display = "";
      if (sidebar) sidebar.classList.add("hidden");
      if (workspace) workspace.classList.add("hidden");
      if (roleSimulator) roleSimulator.classList.add("hidden");
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
  const venueButtons = document.querySelectorAll(".venue-select-button");
  const scheduleForm = document.getElementById("scheduleForm");
  const cancelButton = document.getElementById("scheduleCancelBtn");
  const eventsTableBody = document.querySelector("#eventsTable tbody");
  const landingButtons = document.querySelectorAll(".landing-button");

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

  venueButtons.forEach((button) => {
    button.addEventListener("click", () =>
      openReservationWithVenue(button.dataset.venue),
    );
  });

  if (scheduleForm) {
    scheduleForm.addEventListener("submit", handleFormSubmission);
  }

  initializePdfDropzone();
  initializeStudentLogin();
  initializeFacultyLogin();
  initializeProfileMenu();
  document.addEventListener("click", handleDocumentClick);

  // If redirected with ?role=Student or ?role=Faculty, start the session automatically
  try {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");
    if (role === "Student" || role === "Faculty") {
      startSession(role);
    }
  } catch (err) {
    // ignore if URL API unavailable
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
