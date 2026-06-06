const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const VENUE_COLORS = [
  "venue-image--purple",
  "venue-image--green",
  "venue-image--gold",
  "venue-image--yellow",
];

const STORAGE_KEYS = {
  VENUES: "eventsync_faculty_venues",
  PROPOSALS: "eventsync_proposals",
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadProposals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProposals(proposals) {
  localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals));
  window.dispatchEvent(new Event("eventsync-proposals-updated"));
}

function validatePdfFile(file) {
  return (
    file &&
    (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
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
  const file = pdfInput?.files?.[0];

  if (!file) {
    updatePdfFileDisplay();
    return;
  }

  if (!validatePdfFile(file)) {
    alert("Please upload a valid PDF file.");
    if (pdfInput) pdfInput.value = "";
    updatePdfFileDisplay();
    return;
  }

  updatePdfFileDisplay(file.name);
}

function initializePdfDropzone() {
  const pdfInput = document.getElementById("eventPdf");
  const pdfDropzone = document.getElementById("pdfDropzone");
  if (!pdfInput || !pdfDropzone) return;

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

function formatCalendarDaySlots(times) {
  if (!times?.length) return "";
  return times
    .map((slot) => `<span class="calendar-time-slot">${escapeHtml(slot)}</span>`)
    .join("");
}

function addNotification(message, time = "Just now") {
  notifications.unshift({ message, time });
  unreadNotifications += 1;
  renderNotificationPopup();
  updateNotificationBadge();
}

function renderNotificationPopup() {
  const list = document.getElementById("notificationPopupList");
  if (!list) return;
  list.innerHTML = notifications
    .map(
      (notification) => `
        <div class="notification-popup-item">
            <div>${escapeHtml(notification.message)}</div>
            <small>${escapeHtml(notification.time)}</small>
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

function toggleNotificationPopup() {
  if (typeof closeProfileDropdown === "function") {
    closeProfileDropdown();
  }
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

function setActiveVenueCard(venueId) {
  document.querySelectorAll(".venue-card[data-venue]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.venue === venueId);
  });
}
