// =============================================
// shared.js — Reusable utilities for EventSync
// Loaded on ALL pages before page-specific scripts.
// =============================================

// =============================================
// Constants
// =============================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VENUE_COLORS = [
  "venue-image--purple",
  "venue-image--green",
  "venue-image--gold",
  "venue-image--yellow",
];

/**
 * STORAGE_KEYS — Central registry of all localStorage keys used by EventSync.
 * Keeping them in one place avoids typos and makes it easy to audit what data
 * the app persists.
 */
const STORAGE_KEYS = {
  VENUES: "eventsync_faculty_venues",         // Array of venue objects created by faculty
  PROPOSALS: "eventsync_proposals",           // Array of event proposals submitted by students
  THEME_STUDENT: "eventsync_theme_student",   // "light" | "dark" for student dashboard
  THEME_FACULTY: "eventsync_theme_faculty",   // "light" | "dark" for faculty dashboard
  STUDENT_USERS: "eventsync_student_users",   // Array of registered student accounts
  FACULTY_USERS: "eventsync_faculty_users",   // Array of registered faculty accounts
  PROFILE_STUDENT: "eventsync_profile_student", // Student profile settings
  PROFILE_FACULTY: "eventsync_profile_faculty", // Faculty profile settings
  SETTINGS_STUDENT: "eventsync_settings_student", // Student preferences
  SETTINGS_FACULTY: "eventsync_settings_faculty", // Faculty preferences
};

/**
 * DEFAULT_TIME_SLOTS — The 3 time slots available per day per venue.
 * Faculty can customize these per-venue, but this serves as the initial set
 * when a venue is first created.
 */
const DEFAULT_TIME_SLOTS = [
  "8:00 AM - 11:00 AM",
  "12:00 PM - 3:00 PM",
  "4:00 PM - 7:00 PM",
];

// =============================================
// HTML Escaping
// =============================================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =============================================
// localStorage — Proposals (Student ↔ Faculty)
// =============================================

/**
 * loadProposals()
 * Reads the proposals array from localStorage.
 * Each proposal object has: id, title, org, venue, date, time, attendees,
 * pdfName, pdfDataUrl, status, rejectionReason, submittedAt.
 * Returns [] if nothing is stored or on parse error.
 */
function loadProposals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * saveProposals(proposals)
 * Writes the full proposals array to localStorage and dispatches a custom
 * event so other open tabs/views can react in real-time without polling.
 */
function saveProposals(proposals) {
  localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals));
  // Custom event lets the faculty dashboard update if both are open in the same tab
  window.dispatchEvent(new Event("eventsync-proposals-updated"));
}

// =============================================
// localStorage — User Accounts
// =============================================

/**
 * loadStudentUsers() / saveStudentUsers(users)
 * Persist student accounts in localStorage.
 * Each user: { studentNumber, fullName, password, createdAt }
 * NOTE: In production, passwords must be hashed server-side.
 */
function loadStudentUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENT_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStudentUsers(users) {
  localStorage.setItem(STORAGE_KEYS.STUDENT_USERS, JSON.stringify(users));
}

/**
 * loadFacultyUsers() / saveFacultyUsers(users)
 * Persist faculty accounts in localStorage.
 * Each user: { username, password, createdAt }
 */
function loadFacultyUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FACULTY_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFacultyUsers(users) {
  localStorage.setItem(STORAGE_KEYS.FACULTY_USERS, JSON.stringify(users));
}

// =============================================
// localStorage — Profile & Settings
// =============================================

/**
 * loadProfile(role) / saveProfile(role, data)
 * Store per-role profile data: { displayName, email, idNumber, department }
 */
function loadProfile(role) {
  try {
    const key = role === "faculty" ? STORAGE_KEYS.PROFILE_FACULTY : STORAGE_KEYS.PROFILE_STUDENT;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProfile(role, data) {
  const key = role === "faculty" ? STORAGE_KEYS.PROFILE_FACULTY : STORAGE_KEYS.PROFILE_STUDENT;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * loadSettings(role) / saveSettings(role, data)
 * Store per-role settings: { notifications, language }
 */
function loadSettings(role) {
  try {
    const key = role === "faculty" ? STORAGE_KEYS.SETTINGS_FACULTY : STORAGE_KEYS.SETTINGS_STUDENT;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { notifications: true, language: "en" };
  } catch {
    return { notifications: true, language: "en" };
  }
}

function saveSettings(role, data) {
  const key = role === "faculty" ? STORAGE_KEYS.SETTINGS_FACULTY : STORAGE_KEYS.SETTINGS_STUDENT;
  localStorage.setItem(key, JSON.stringify(data));
}

// =============================================
// PDF Validation & Dropzone
// =============================================

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

// =============================================
// Calendar Helpers
// =============================================

function formatCalendarDaySlots(times) {
  if (!times?.length) return "";
  return times
    .map((slot) => `<span class="calendar-time-slot">${escapeHtml(formatTime12h(slot))}</span>`)
    .join("");
}

/**
 * formatTime12h(timeStr)
 * Converts a 24-hour time string (or range) to 12-hour AM/PM format.
 * Examples:
 *   "08:00"          → "8:00 AM"
 *   "14:00"          → "2:00 PM"
 *   "08:00 - 11:00"  → "8:00 AM - 11:00 AM"
 *   "12:00 - 15:00"  → "12:00 PM - 3:00 PM"
 */
function formatTime12h(timeStr) {
  if (!timeStr) return timeStr;
  
  // If the string already contains AM or PM, it's already in 12-hour format
  // or was manually typed by the user. Just return it to avoid "AM AM".
  if (timeStr.toUpperCase().includes("AM") || timeStr.toUpperCase().includes("PM")) {
    return timeStr;
  }

  return timeStr.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  });
}


// =============================================
// Notification System
// =============================================

let notifications = [];
let unreadNotifications = 0;

function timeAgo(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function loadNotificationsFromServer() {
  try {
    const response = await apiFetch("/api/notifications");
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        notifications = result.data.map(n => ({
          id: n.notificationId,
          message: n.message,
          time: timeAgo(n.createdAt),
          isRead: n.isRead
        }));
        unreadNotifications = result.data.filter(n => !n.isRead).length;
        renderNotificationPopup();
        updateNotificationBadge();
      }
    }
  } catch (err) {
    console.error("Failed to load notifications from server:", err);
  }
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

async function toggleNotificationPopup() {
  if (typeof closeProfileDropdown === "function") {
    closeProfileDropdown();
  }
  const popup = document.getElementById("notificationPopup");
  if (!popup) return;
  const isHidden = popup.classList.toggle("hidden");
  if (!isHidden) {
    if (unreadNotifications > 0) {
      try {
        const response = await apiFetch("/api/notifications/read-all", { method: "POST" });
        if (response.ok) {
          unreadNotifications = 0;
          updateNotificationBadge();
          notifications.forEach(n => n.isRead = true);
        }
      } catch (err) {
        console.error("Failed to mark all notifications as read:", err);
      }
    }
  }
}

// =============================================
// Profile Dropdown
// =============================================

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

// =============================================
// Venue Card Selection
// =============================================

function setActiveVenueCard(venueId) {
  document.querySelectorAll(".venue-card[data-venue]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.venue === venueId);
  });
}

// =============================================
// Theme Utilities (Light / Dark)
// =============================================

/**
 * loadTheme(role) — Reads the saved theme preference from localStorage.
 * Returns "light" or "dark".
 */
function loadTheme(role) {
  try {
    if (role === "faculty") return localStorage.getItem(STORAGE_KEYS.THEME_FACULTY) || "light";
    return localStorage.getItem(STORAGE_KEYS.THEME_STUDENT) || "light";
  } catch {
    return "light";
  }
}

/**
 * saveTheme(role, theme) — Persists theme preference to localStorage.
 */
function saveTheme(role, theme) {
  try {
    if (role === "faculty") localStorage.setItem(STORAGE_KEYS.THEME_FACULTY, theme);
    else localStorage.setItem(STORAGE_KEYS.THEME_STUDENT, theme);
  } catch {}
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
}

function toggleTheme(role) {
  if (!role) return;
  const current = loadTheme(role);
  const next = current === "dark" ? "light" : "dark";
  saveTheme(role, next);
  applyTheme(next);
}

// =============================================
// Password Visibility Toggle (Shared)
// Each password field has exactly ONE toggle button with data-target pointing
// to the input ID. This function is called once on DOMContentLoaded.
// =============================================

function initializePasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", () => {
      const targetId = toggleBtn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      // Toggle eye icons — show the "closed" icon when password is visible
      const openIcon = toggleBtn.querySelector(".eye-open");
      const closedIcon = toggleBtn.querySelector(".eye-closed");
      if (openIcon && closedIcon) {
        openIcon.style.display = isPassword ? "none" : "block";
        closedIcon.style.display = isPassword ? "block" : "none";
      }

      toggleBtn.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
      );
    });
  });
}

// =============================================
// Form Validation Helpers (Shared)
// =============================================

function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  if (!input) return;

  input.classList.add("input-error");

  const formGroup = input.closest(".form-group");
  if (formGroup) {
    const errorEl = document.createElement("small");
    errorEl.className = "form-error-text";
    errorEl.textContent = message;
    formGroup.appendChild(errorEl);
  }

  // Auto-clear error when user starts typing
  input.addEventListener(
    "input",
    () => {
      input.classList.remove("input-error");
      const existing = formGroup?.querySelector(".form-error-text");
      if (existing) existing.remove();
    },
    { once: true }
  );
}

function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
  form.querySelectorAll(".form-error-text").forEach((el) => el.remove());
}

// =============================================
// Toast Notification (Shared)
// =============================================

function showToast(toastId = "signUpToast") {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.remove("hidden");
  toast.offsetHeight; // Force reflow for transition
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 400);
  }, 3500);
}

// =============================================
// File Reader Utility (Shared)
// Converts a File object to a base64 data URL string.
// Used by both student (PDF upload) and faculty (venue photo upload).
// =============================================

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =============================================
// Venue Schedule Helpers (3-slot-per-day model)
// =============================================

/**
 * getBookedSlotsForDate(venueName, dateStr)
 * Scans all proposals in localStorage to find which time slots are already
 * booked for a specific venue on a specific date.
 * Returns an array of time strings that are taken.
 */
function getBookedSlotsForDate(venueName, dateStr) {
  const proposals = loadProposals();
  return proposals
    .filter((p) =>
      p.venue === venueName &&
      p.date === dateStr &&
      (p.status === "pending" || p.status === "accepted")
    )
    .map((p) => p.time);
}

/**
 * timesAreEqual(timeA, timeB)
 * Robustly compares two time strings or time slots to see if they represent
 * the same starting hour/minute of the day.
 */
function timesAreEqual(timeA, timeB) {
  const parseTime = (str) => {
    if (!str) return null;
    let s = str.trim().toUpperCase();
    if (s.includes("-")) {
      s = s.split("-")[0].trim();
    }
    const isPM = s.includes("PM");
    const isAM = s.includes("AM");
    s = s.replace(/[AP]M/g, "").trim();
    const parts = s.split(":");
    if (parts.length < 2) return null;
    let hour = parseInt(parts[0], 10);
    let min = parseInt(parts[1], 10);
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    return { hour, min };
  };

  const a = parseTime(timeA);
  const b = parseTime(timeB);
  if (!a || !b) return false;
  return a.hour === b.hour && a.min === b.min;
}

/**
 * getStartHour24h(slotStr)
 * Extracts the starting hour and minute in 24-hour HH:mm format from a slot.
 */
function getStartHour24h(slotStr) {
  if (!slotStr) return "";
  let start = slotStr.split("-")[0].trim().toUpperCase();
  const isPM = start.includes("PM");
  const isAM = start.includes("AM");
  start = start.replace(/[AP]M/g, "").trim();
  const parts = start.split(":");
  if (parts.length < 2) return "";
  let hour = parseInt(parts[0], 10);
  let min = parseInt(parts[1], 10);
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * getVenueTimeSlotsForDay(venue, day, month, year)
 * Returns the 3 available time slots for a venue on a given calendar day,
 * cross-referencing with existing bookings to mark each as available or booked.
 * Returns: [{ time: "08:00 - 11:00", booked: false, bookedBy: null }, ...]
 */
function getVenueTimeSlotsForDay(venue, day, month, year) {
  const dateStr = formatDateString(year, month, day);
  const slots = getDayTimeSlots(venue, dateStr);
  const bookedTimes = getBookedSlotsForDate(venue.name, dateStr);

  return slots.map((slot) => {
    const isBooked = bookedTimes.some((bt) => timesAreEqual(bt, slot));
    return {
      time: slot,
      booked: isBooked,
      bookedBy: isBooked ? "Reserved" : null,
    };
  });
}

/**
 * formatDateString(year, month, day)
 * Produces "YYYY-MM-DD" for date comparisons and form input values.
 */
function formatDateString(year, month, day) {
  const paddedMonth = String(month + 1).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

/**
 * isDateInPast(day, month, year)
 * Returns true if the given calendar date is strictly before today (local time).
 * Today itself is NOT considered past.
 */
function isDateInPast(day, month, year) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(year, month, day);
  return target < today;
}

/**
 * isVenueBlackedOut(venue, dateStr)
 * Returns true if the faculty has manually marked this date as unavailable.
 * venue.blackoutDates is an array of "YYYY-MM-DD" strings.
 */
function isVenueBlackedOut(venue, dateStr) {
  if (!venue?.blackoutDates?.length) return false;
  return venue.blackoutDates.includes(dateStr);
}

/**
 * getDayTimeSlots(venue, dateStr)
 * Returns the array of available time slot strings for a specific date.
 * Faculty can override the slots per day via venue.daySlotOverrides.
 */
function getDayTimeSlots(venue, dateStr) {
  const defaultSlots = venue.timeSlots || DEFAULT_TIME_SLOTS;
  if (!venue?.daySlotOverrides) return defaultSlots;
  const override = venue.daySlotOverrides[dateStr];
  
  if (override === undefined) return defaultSlots;
  
  // Backwards compatibility with old integer-based overrides
  if (typeof override === "number") {
    return defaultSlots.slice(0, Math.max(0, override));
  }
  
  // New array-based override
  if (Array.isArray(override)) {
    return override;
  }
  
  return defaultSlots;
}

// =============================================
// Profile & Settings Modal Logic (Shared)
// =============================================

/**
 * openProfileModal(role)
 * Populates and shows the View Profile modal with data from localStorage.
 */
function openProfileModal(role) {
  const modal = document.getElementById("profileModal");
  if (!modal) return;

  const profile = loadProfile(role);
  const nameInput = document.getElementById("profileDisplayName");
  const emailInput = document.getElementById("profileEmail");
  const idInput = document.getElementById("profileIdNumber");
  const deptGroup = document.getElementById("profileDeptGroup");
  const deptInput = document.getElementById("profileDepartment");

  if (nameInput) nameInput.value = profile.displayName || "";
  if (emailInput) emailInput.value = profile.email || "";
  if (idInput) idInput.value = profile.idNumber || "";
  if (deptInput) deptInput.value = profile.department || "";

  // Show department field only for faculty
  if (deptGroup) deptGroup.style.display = role === "faculty" ? "block" : "none";

  modal.classList.remove("hidden");
}

function closeProfileModal() {
  document.getElementById("profileModal")?.classList.add("hidden");
}

function saveProfileFromModal(role) {
  const data = {
    displayName: document.getElementById("profileDisplayName")?.value.trim() || "",
  };

  const emailEl = document.getElementById("profileEmail");
  if (emailEl) {
    data.email = emailEl.value.trim();
  }

  const idEl = document.getElementById("profileIdNumber");
  if (idEl) {
    data.idNumber = idEl.value.trim();
  }

  const deptEl = document.getElementById("profileDepartment");
  if (deptEl) {
    data.department = deptEl.value.trim();
  }

  saveProfile(role, data);
  closeProfileModal();
  showToast("profileSavedToast");
}

/**
 * openSettingsModal(role)
 * Populates and shows the Settings modal with saved preferences.
 */
async function openSettingsModal(role) {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  let notifyVal = true;
  try {
    const response = await apiFetch("/api/notifications/preferences");
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        notifyVal = result.data.notifyOnStatusChange;
      }
    }
  } catch (err) {
    console.error("Failed to fetch notification preferences:", err);
  }

  const notifToggle = document.getElementById("settingsNotifications");

  if (notifToggle) notifToggle.checked = notifyVal;

  modal.classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settingsModal")?.classList.add("hidden");
}

async function saveSettingsFromModal(role) {
  const isEnabled = document.getElementById("settingsNotifications")?.checked ?? true;
  
  try {
    const response = await apiFetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifyOneDayBefore: isEnabled,
        notifyOneWeekBefore: isEnabled,
        notifyOnStatusChange: isEnabled
      })
    });
    if (!response.ok) {
      console.error("Failed to save notification preferences to backend");
    }
  } catch (err) {
    console.error("Error saving preferences:", err);
  }

  const data = {
    notifications: isEnabled,
  };
  saveSettings(role, data);
  closeSettingsModal();
  showToast("settingsSavedToast");
}

/**
 * initializeProfileAndSettingsModals(role)
 * Wires up event listeners for the profile and settings modals.
 * Called from both student.js and faculty-dash.js during DOMContentLoaded.
 */
function initializeProfileAndSettingsModals(role) {
  // View Profile button
  document.getElementById("viewProfileBtn")?.addEventListener("click", () => {
    closeProfileDropdown();
    openProfileModal(role);
  });

  // Settings button
  document.getElementById("accountSettingsBtn")?.addEventListener("click", () => {
    closeProfileDropdown();
    openSettingsModal(role);
  });

  // Profile modal controls
  document.getElementById("profileModalClose")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalCancel")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalOverlay")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalSave")?.addEventListener("click", () => saveProfileFromModal(role));

  // Settings modal controls
  document.getElementById("settingsModalClose")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalCancel")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalOverlay")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalSave")?.addEventListener("click", () => saveSettingsFromModal(role));

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    closeProfileDropdown();
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      clearAuthSession();
      window.location.href = "index.html";
    }
  });
}

// =============================================
// Auth Session & Fetch Helpers
// =============================================

const AUTH_KEYS = {
  ACCESS_TOKEN: "eventsync_access_token",
  REFRESH_TOKEN: "eventsync_refresh_token",
  USER_ROLE: "eventsync_user_role",
  USER_IDENTIFIER: "eventsync_user_identifier",
  EXPIRES_AT: "eventsync_expires_at",
};

function saveAuthSession(authData) {
  if (!authData) return;
  localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, authData.accessToken || "");
  localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, authData.refreshToken || "");
  localStorage.setItem(AUTH_KEYS.USER_ROLE, authData.role || "");
  const identifier = authData.role === "faculty" ? authData.username : (authData.studentNumber || authData.studNo);
  localStorage.setItem(AUTH_KEYS.USER_IDENTIFIER, identifier || "");
  const expiresAtMs = Date.now() + (authData.expiresAt || authData.expiresIn || 3600) * 1000;
  localStorage.setItem(AUTH_KEYS.EXPIRES_AT, String(expiresAtMs));

  // Sync full name (displayName) to profile information
  const roleLower = authData.role?.toLowerCase();
  if (authData.fullName && (roleLower === "student" || roleLower === "faculty")) {
    const profile = loadProfile(roleLower);
    profile.displayName = authData.fullName;
    saveProfile(roleLower, profile);
  }

  // Auto-populate profile idNumber if it's a student
  if (authData.role && authData.role.toLowerCase() === "student" && identifier) {
    const profile = loadProfile("student");
    if (!profile.idNumber) {
      profile.idNumber = identifier;
      saveProfile("student", profile);
    }
  }
}

function getAuthSession() {
  return {
    accessToken: localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN),
    refreshToken: localStorage.getItem(AUTH_KEYS.REFRESH_TOKEN),
    role: localStorage.getItem(AUTH_KEYS.USER_ROLE),
    identifier: localStorage.getItem(AUTH_KEYS.USER_IDENTIFIER),
    expiresAt: Number(localStorage.getItem(AUTH_KEYS.EXPIRES_AT) || 0),
  };
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(AUTH_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(AUTH_KEYS.USER_ROLE);
  localStorage.removeItem(AUTH_KEYS.USER_IDENTIFIER);
  localStorage.removeItem(AUTH_KEYS.EXPIRES_AT);
}

function checkAuthAndRedirect(requiredRole) {
  const session = getAuthSession();
  const pathname = window.location.pathname || "";
  const isAuthPage = pathname.endsWith("users.html") || pathname.endsWith("faculty.html");
  
  if (isAuthPage) {
    if (session.accessToken && session.role) {
      if (session.role.toLowerCase() === "student") {
        window.location.href = "index.html?role=Student";
      } else if (session.role.toLowerCase() === "faculty") {
        window.location.href = "faculty-dash.html";
      }
    }
    return;
  }

  if (!session.accessToken || !session.role || session.role.toLowerCase() !== requiredRole.toLowerCase()) {
    clearAuthSession();
    if (requiredRole.toLowerCase() === "student") {
      window.location.href = "users.html";
    } else {
      window.location.href = "faculty.html";
    }
  }
}

async function apiFetch(url, options = {}) {
  const baseUrl = "http://localhost:5108";
  const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  
  let session = getAuthSession();
  
  // If access token is expired, try to refresh it
  if (session.accessToken && session.refreshToken && Date.now() >= session.expiresAt - 10000) {
    try {
      const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        if (result.success && result.data) {
          saveAuthSession(result.data);
          session = getAuthSession();
        }
      } else {
        clearAuthSession();
        window.location.href = session.role === "faculty" ? "faculty.html" : "users.html";
        throw new Error("Session expired. Please log in again.");
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
  }
  
  options.headers = options.headers || {};
  if (session.accessToken) {
    options.headers["Authorization"] = `Bearer ${session.accessToken}`;
  }
  
  let response = await fetch(absoluteUrl, options);
  
  if (response.status === 401) {
    clearAuthSession();
    window.location.href = session.role === "faculty" ? "faculty.html" : "users.html";
    throw new Error("Unauthorized access. Redirecting to login.");
  }
  
  return response;
}

// Expose theme and auth utilities for page scripts
window.loadTheme = loadTheme;
window.saveTheme = saveTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.saveAuthSession = saveAuthSession;
window.getAuthSession = getAuthSession;
window.clearAuthSession = clearAuthSession;
window.checkAuthAndRedirect = checkAuthAndRedirect;
window.apiFetch = apiFetch;
window.loadNotificationsFromServer = loadNotificationsFromServer;

document.addEventListener("DOMContentLoaded", () => {
  // Apply saved theme on load
  const role = document.body?.dataset?.page;
  if (role === "student" || role === "faculty") {
    applyTheme(loadTheme(role));
  }

  // Set current date in the header navbar
  const dateEl = document.getElementById("headerDate");
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

  // Initialize password toggles on all pages
  initializePasswordToggles();
});
