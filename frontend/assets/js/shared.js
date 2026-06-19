// =============================================
// shared.js — Reusable Utilities for EventSync
// Loaded on ALL pages before any page-specific scripts.
// Contains: constants, localStorage helpers, auth session management,
// notification system, theme toggling, form validation helpers,
// calendar utilities, and the secure API fetch wrapper.
// =============================================


// =============================================
// GLOBAL CONSTANTS
// =============================================

// Month name lookup table used by the calendar to display the header label
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Rotating color classes assigned to venue cards so each one has a unique accent
const VENUE_COLORS = [
  "venue-image--purple",
  "venue-image--green",
  "venue-image--gold",
  "venue-image--yellow",
];

/**
 * STORAGE_KEYS — Central registry of all localStorage keys used by EventSync.
 * Keeping them in one place avoids typos across files and makes it easy
 * to audit exactly what data the app saves to the browser.
 */
const STORAGE_KEYS = {
  VENUES: "eventsync_faculty_venues",         // Array of venue objects created by faculty
  PROPOSALS: "eventsync_proposals",           // Array of event proposals submitted by students
  THEME_STUDENT: "eventsync_theme_student",   // "light" | "dark" preference for the student dashboard
  THEME_FACULTY: "eventsync_theme_faculty",   // "light" | "dark" preference for the faculty dashboard
  STUDENT_USERS: "eventsync_student_users",   // Array of registered student accounts
  FACULTY_USERS: "eventsync_faculty_users",   // Array of registered faculty accounts
  PROFILE_STUDENT: "eventsync_profile_student", // Student profile settings (name, ID, etc.)
  PROFILE_FACULTY: "eventsync_profile_faculty", // Faculty profile settings
  SETTINGS_STUDENT: "eventsync_settings_student", // Student notification preferences
  SETTINGS_FACULTY: "eventsync_settings_faculty", // Faculty notification preferences
};

/**
 * DEFAULT_TIME_SLOTS — The 3 standard booking time slots available per day per venue.
 * Faculty can override these per-date using the Day Manager, but this is the
 * starting set when a venue is first created.
 */
const DEFAULT_TIME_SLOTS = [
  "8:00 AM - 11:00 AM",
  "12:00 PM - 3:00 PM",
  "4:00 PM - 7:00 PM",
];


// =============================================
// HTML ESCAPING UTILITY
// =============================================

// [escapeHtml]: Converts special HTML characters in user-supplied text to safe
// HTML entities before injecting them into innerHTML. Prevents XSS attacks.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// =============================================
// AUTH SESSION MANAGEMENT
// =============================================

// All auth-related localStorage keys are grouped here to prevent typos
const AUTH_KEYS = {
  ACCESS_TOKEN: "eventsync_access_token",
  REFRESH_TOKEN: "eventsync_refresh_token",
  USER_ROLE: "eventsync_user_role",
  USER_IDENTIFIER: "eventsync_user_identifier",
  EXPIRES_AT: "eventsync_expires_at",
};

// [saveAuthSession]: Persists the JWT tokens and user info returned by the login API
// into localStorage so they survive a page refresh. Also pre-populates the user's
// profile with their full name if provided by the backend. Called after successful login.
function saveAuthSession(authData) {
  if (!authData) return;
  localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, authData.accessToken || "");
  localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, authData.refreshToken || "");
  localStorage.setItem(AUTH_KEYS.USER_ROLE, authData.role || "");

  // Use username for faculty, or student number for students, as the unique identifier
  const identifier = authData.role === "faculty" ? authData.username : (authData.studentNumber || authData.studNo);
  localStorage.setItem(AUTH_KEYS.USER_IDENTIFIER, identifier || "");

  // Calculate and store the exact timestamp when the access token expires
  const expiresAtMs = Date.now() + (authData.expiresAt || authData.expiresIn || 3600) * 1000;
  localStorage.setItem(AUTH_KEYS.EXPIRES_AT, String(expiresAtMs));

  // Sync the user's full name into their profile immediately after login
  const roleLower = authData.role?.toLowerCase();
  if (authData.fullName && (roleLower === "student" || roleLower === "faculty")) {
    const profile = loadProfile(roleLower);
    profile.displayName = authData.fullName;
    saveProfile(roleLower, profile);
  }

  // Auto-populate idNumber for students so the profile panel shows it without manual entry
  if (authData.role && authData.role.toLowerCase() === "student" && identifier) {
    const profile = loadProfile("student");
    if (!profile.idNumber) {
      profile.idNumber = identifier;
      saveProfile("student", profile);
    }
  }
}

// [getAuthSession]: Reads the stored auth tokens and user info from localStorage.
// Returns a single object so callers don't need to reference AUTH_KEYS directly.
function getAuthSession() {
  return {
    accessToken: localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN),
    refreshToken: localStorage.getItem(AUTH_KEYS.REFRESH_TOKEN),
    role: localStorage.getItem(AUTH_KEYS.USER_ROLE),
    identifier: localStorage.getItem(AUTH_KEYS.USER_IDENTIFIER),
    expiresAt: Number(localStorage.getItem(AUTH_KEYS.EXPIRES_AT) || 0),
  };
}

// [clearAuthSession]: Removes all auth tokens and session data from localStorage.
// Also clears the saved active view from sessionStorage so the user starts fresh
// on their next login. Called on logout.
function clearAuthSession() {
  localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(AUTH_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(AUTH_KEYS.USER_ROLE);
  localStorage.removeItem(AUTH_KEYS.USER_IDENTIFIER);
  localStorage.removeItem(AUTH_KEYS.EXPIRES_AT);
  sessionStorage.removeItem("facultyActiveView");
  sessionStorage.removeItem("studentActiveView");
}

// [checkAuthAndRedirect]: Guards every dashboard page. If the user is not logged in
// or their role doesn't match the page they are on, they are sent back to the login page.
// If called from a login page and the user IS logged in, redirects to their dashboard.
function checkAuthAndRedirect(requiredRole) {
  const session = getAuthSession();
  const pathname = window.location.pathname || "";
  const isAuthPage = pathname.endsWith("users.html") || pathname.endsWith("faculty.html");

  if (isAuthPage) {
    // If already logged in, skip the login page and go straight to the dashboard
    if (session.accessToken && session.role) {
      if (session.role.toLowerCase() === "student") {
        window.location.href = "index.html?role=Student";
      } else if (session.role.toLowerCase() === "faculty") {
        window.location.href = "faculty-dash.html";
      }
    }
    return;
  }

  // On dashboard pages — if the role doesn't match, clear session and redirect to login
  if (!session.accessToken || !session.role || session.role.toLowerCase() !== requiredRole.toLowerCase()) {
    clearAuthSession();
    if (requiredRole.toLowerCase() === "student") {
      window.location.href = "users.html";
    } else {
      window.location.href = "faculty.html";
    }
  }
}


// =============================================
// SECURE API FETCH WRAPPER
// =============================================

// [apiFetch]: A wrapper around the native fetch() that automatically:
// 1. Prepends the base server URL to relative paths.
// 2. Injects the stored Bearer token into the Authorization header.
// 3. Silently refreshes the access token if it is about to expire.
// 4. Redirects to login if the server returns 401 Unauthorized.
// Called instead of fetch() on all authenticated API requests.
async function apiFetch(url, options = {}) {
  const baseUrl = "http://localhost:5108";
  const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

  let session = getAuthSession();

  // Proactively refresh the token if it expires in the next 10 seconds
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
          // Save new tokens and re-read session so this request uses the fresh token
          saveAuthSession(result.data);
          session = getAuthSession();
        }
      } else {
        // Refresh failed — session is dead; send the user back to login
        clearAuthSession();
        window.location.href = session.role === "faculty" ? "faculty.html" : "users.html";
        throw new Error("Session expired. Please log in again.");
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
  }

  // Attach the Bearer token to every request
  options.headers = options.headers || {};
  if (session.accessToken) {
    options.headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  let response = await fetch(absoluteUrl, options);

  // If the server says Unauthorized (401), the session is invalid — redirect to login
  if (response.status === 401) {
    clearAuthSession();
    window.location.href = session.role === "faculty" ? "faculty.html" : "users.html";
    throw new Error("Unauthorized access. Redirecting to login.");
  }

  return response;
}


// =============================================
// LOCALSTORAGE — PROPOSALS (Student ↔ Faculty)
// =============================================

/**
 * loadProposals(): Reads the proposals array from localStorage.
 * Each proposal object contains: id, title, org, venue, date, time, attendees,
 * pdfName, pdfDataUrl, status, rejectionReason, submittedAt.
 * Returns [] if nothing is stored or if the stored JSON is malformed.
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
 * saveProposals(proposals): Writes the full proposals array to localStorage
 * and fires a custom browser event so other open tabs can react without polling.
 */
function saveProposals(proposals) {
  localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify(proposals));
  // Notify any other open tab/view that proposals have changed
  window.dispatchEvent(new Event("eventsync-proposals-updated"));
}


// =============================================
// LOCALSTORAGE — USER ACCOUNTS
// =============================================

/**
 * loadStudentUsers() / saveStudentUsers(users)
 * Persist registered student accounts in localStorage.
 * Each user: { studentNumber, fullName, password, createdAt }
 */
// [loadStudentUsers]: Reads the list of registered student accounts from localStorage.
function loadStudentUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENT_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// [saveStudentUsers]: Writes the updated student account list to localStorage.
function saveStudentUsers(users) {
  localStorage.setItem(STORAGE_KEYS.STUDENT_USERS, JSON.stringify(users));
}

/**
 * loadFacultyUsers() / saveFacultyUsers(users)
 * Persist registered faculty accounts in localStorage.
 * Each user: { username, password, createdAt }
 */
// [loadFacultyUsers]: Reads the list of registered faculty accounts from localStorage.
function loadFacultyUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FACULTY_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// [saveFacultyUsers]: Writes the updated faculty account list to localStorage.
function saveFacultyUsers(users) {
  localStorage.setItem(STORAGE_KEYS.FACULTY_USERS, JSON.stringify(users));
}


// =============================================
// LOCALSTORAGE — PROFILE & SETTINGS
// =============================================

/**
 * loadProfile(role) / saveProfile(role, data)
 * Store per-role profile data: { displayName, email, idNumber, department }
 * The "role" parameter selects the correct storage key automatically.
 */
// [loadProfile]: Reads the saved profile data for a given user role from localStorage.
function loadProfile(role) {
  try {
    const key = role === "faculty" ? STORAGE_KEYS.PROFILE_FACULTY : STORAGE_KEYS.PROFILE_STUDENT;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// [saveProfile]: Persists updated profile data (name, ID, etc.) to localStorage.
function saveProfile(role, data) {
  const key = role === "faculty" ? STORAGE_KEYS.PROFILE_FACULTY : STORAGE_KEYS.PROFILE_STUDENT;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * loadSettings(role) / saveSettings(role, data)
 * Store per-role preferences: { notifications: true, language: "en" }
 */
// [loadSettings]: Reads notification and language preferences for a given role.
// Returns safe defaults if nothing has been saved yet.
function loadSettings(role) {
  try {
    const key = role === "faculty" ? STORAGE_KEYS.SETTINGS_FACULTY : STORAGE_KEYS.SETTINGS_STUDENT;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { notifications: true, language: "en" };
  } catch {
    return { notifications: true, language: "en" };
  }
}

// [saveSettings]: Writes updated preferences to localStorage for a given role.
function saveSettings(role, data) {
  const key = role === "faculty" ? STORAGE_KEYS.SETTINGS_FACULTY : STORAGE_KEYS.SETTINGS_STUDENT;
  localStorage.setItem(key, JSON.stringify(data));
}


// =============================================
// THEME UTILITIES (Light / Dark Mode)
// =============================================

/**
 * loadTheme(role): Reads the saved theme preference from localStorage.
 * Returns "light" or "dark". Defaults to "light" if nothing is saved.
 */
// [loadTheme]: Reads the user's saved dark/light mode preference for their role.
function loadTheme(role) {
  try {
    if (role === "faculty") return localStorage.getItem(STORAGE_KEYS.THEME_FACULTY) || "light";
    return localStorage.getItem(STORAGE_KEYS.THEME_STUDENT) || "light";
  } catch {
    return "light";
  }
}

// [saveTheme]: Persists the user's chosen theme ("light" or "dark") to localStorage.
function saveTheme(role, theme) {
  try {
    if (role === "faculty") localStorage.setItem(STORAGE_KEYS.THEME_FACULTY, theme);
    else localStorage.setItem(STORAGE_KEYS.THEME_STUDENT, theme);
  } catch {}
}

// [applyTheme]: Adds or removes the "dark-mode" class on <body> to switch the
// active theme immediately without a page reload.
function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
}

// [toggleTheme]: Reads the current theme, flips it to the opposite,
// saves the new preference, and applies it instantly. Called by the toggle switch.
function toggleTheme(role) {
  if (!role) return;
  const current = loadTheme(role);
  const next = current === "dark" ? "light" : "dark";
  saveTheme(role, next);
  applyTheme(next);
}


// =============================================
// PASSWORD VISIBILITY TOGGLE
// =============================================

// [initializePasswordToggles]: Finds all password toggle buttons on the page and
// wires them up to show/hide their respective password field. Each button uses a
// data-target attribute to identify which input to control. Runs on DOMContentLoaded.
function initializePasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", () => {
      const targetId = toggleBtn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      // Switch between "password" (hidden) and "text" (visible)
      input.type = isPassword ? "text" : "password";

      // Swap the eye icon — show the "closed eye" when the password is currently visible
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
// FORM VALIDATION HELPERS
// =============================================

// [showFieldError]: Marks a specific form field as invalid by adding a red border
// and showing an error message below it. Automatically clears when the user
// starts typing again. Called when server-side or client-side validation fails.
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

  // Remove the error state as soon as the user starts correcting the field
  input.addEventListener(
    "input",
    () => {
      input.classList.remove("input-error");
      const existing = formGroup?.querySelector(".form-error-text");
      if (existing) existing.remove();
    },
    { once: true } // "once: true" means this listener fires only one time then self-removes
  );
}

// [clearFormErrors]: Removes all validation error styles and messages from a form.
// Called at the start of each new form submission attempt so old errors don't persist.
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
  form.querySelectorAll(".form-error-text").forEach((el) => el.remove());
}


// =============================================
// TOAST NOTIFICATION
// =============================================

// [showToast]: Briefly shows a floating success notification at the bottom of the screen
// for 3.5 seconds, then fades it out. The toast must already exist in the HTML.
// Called after successful actions like registration or saving a profile.
function showToast(toastId = "signUpToast") {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  toast.classList.remove("hidden");
  toast.offsetHeight; // Force a browser reflow so the CSS transition triggers correctly
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    // Wait for the fade-out CSS transition to finish before hiding the element
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 400);
  }, 3500);
}


// =============================================
// FILE READER UTILITY
// =============================================

// [readFileAsDataUrl]: Converts a File object into a base64-encoded data URL string.
// Returns a Promise that resolves with the data URL.
// Used by both the student PDF upload and the faculty venue photo upload.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// =============================================
// PDF VALIDATION & DROPZONE
// =============================================

// [validatePdfFile]: Returns true if the given File object is a valid PDF.
// Checks both the MIME type and the file extension for robustness.
function validatePdfFile(file) {
  return (
    file &&
    (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
  );
}

// [updatePdfFileDisplay]: Updates the file name label inside the PDF dropzone.
// Shows "No file selected" when no file is provided.
function updatePdfFileDisplay(fileName) {
  const pdfFileName = document.getElementById("pdfFileName");
  if (pdfFileName) {
    pdfFileName.innerText = fileName || "No file selected";
  }
}

// [handlePdfSelection]: Called when the user picks a file via the hidden file input.
// Validates that it is a PDF, then updates the display label with the file name.
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

// [initializePdfDropzone]: Sets up the PDF upload area with click-to-browse and
// drag-and-drop support. Also validates that any dropped file is a PDF.
// Called once on DOMContentLoaded on the student dashboard.
function initializePdfDropzone() {
  const pdfInput = document.getElementById("eventPdf");
  const pdfDropzone = document.getElementById("pdfDropzone");
  if (!pdfInput || !pdfDropzone) return;

  pdfInput.addEventListener("change", handlePdfSelection);
  pdfDropzone.addEventListener("click", () => pdfInput.click());

  pdfDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    pdfDropzone.classList.add("dropzone-active"); // Highlight the drop zone
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
      // Assign the dropped file to the hidden input so the form can read it on submit
      pdfInput.files = event.dataTransfer.files;
      updatePdfFileDisplay(file.name);
    }
  });
}


// =============================================
// NOTIFICATION SYSTEM
// =============================================

// In-memory arrays that hold the current notification state for this session
let notifications = [];
let unreadNotifications = 0;

// [timeAgo]: Converts a date string into a human-friendly relative time string
// like "5m ago" or "2d ago". Used for notification timestamps.
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

// [loadNotificationsFromServer]: Fetches the user's notifications from the backend API
// and updates the notification badge and popup list. Called after login and on page load.
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
        // Count how many haven't been read yet for the badge number
        unreadNotifications = result.data.filter(n => !n.isRead).length;
        renderNotificationPopup();
        updateNotificationBadge();
      }
    }
  } catch (err) {
    console.error("Failed to load notifications from server:", err);
  }
}

// [addNotification]: Adds a new notification to the in-memory list and immediately
// updates the badge and popup. Used to show real-time feedback after user actions
// (e.g., "Proposal submitted").
function addNotification(message, time = "Just now") {
  notifications.unshift({ message, time });
  unreadNotifications += 1;
  renderNotificationPopup();
  updateNotificationBadge();
}

// [renderNotificationPopup]: Rebuilds the HTML inside the notification popup list
// from the current in-memory notifications array. Called whenever the list changes.
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

// [updateNotificationBadge]: Updates the red dot badge number on the bell icon.
// Hides the badge entirely when there are no unread notifications.
function updateNotificationBadge() {
  const badge = document.getElementById("notificationCount");
  if (!badge) return;
  badge.innerText = unreadNotifications > 99 ? "99+" : unreadNotifications;
  badge.style.display = unreadNotifications > 0 ? "inline-flex" : "none";
}

// [toggleNotificationPopup]: Shows or hides the notification dropdown popup when
// the bell icon is clicked. If opened with unread notifications, marks all as read
// via an API call. Closes the profile dropdown if open.
async function toggleNotificationPopup() {
  if (typeof closeProfileDropdown === "function") {
    closeProfileDropdown();
  }
  const popup = document.getElementById("notificationPopup");
  if (!popup) return;
  const isHidden = popup.classList.toggle("hidden");

  if (!isHidden) {
    // Popup is now visible — mark all unread notifications as read on the server
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
// PROFILE DROPDOWN
// =============================================

// [toggleProfileDropdown]: Toggles the profile dropdown menu open or closed.
// Also updates the aria-expanded attribute for accessibility. Triggered by the
// profile button click.
function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const button = document.getElementById("profileButton");
  if (!dropdown || !button) return;
  const isHidden = dropdown.classList.toggle("hidden");
  button.setAttribute("aria-expanded", String(!isHidden));
}

// [closeProfileDropdown]: Forces the profile dropdown to close.
// Called when the user clicks outside the dropdown or opens another popup.
function closeProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  const button = document.getElementById("profileButton");
  if (!dropdown) return;
  dropdown.classList.add("hidden");
  if (button) button.setAttribute("aria-expanded", "false");
}


// =============================================
// VENUE CARD SELECTION
// =============================================

// [setActiveVenueCard]: Highlights the clicked venue card by adding the "selected"
// class to it and removing it from all other cards.
function setActiveVenueCard(venueId) {
  document.querySelectorAll(".venue-card[data-venue]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.venue === venueId);
  });
}


// =============================================
// CALENDAR HELPERS
// =============================================

// [formatCalendarDaySlots]: Takes an array of time strings and converts them into
// a row of styled <span> elements for rendering inside a calendar day cell.
function formatCalendarDaySlots(times) {
  if (!times?.length) return "";
  return times
    .map((slot) => `<span class="calendar-time-slot">${escapeHtml(formatTime12h(slot))}</span>`)
    .join("");
}

/**
 * formatTime12h(timeStr): Converts a 24-hour time string (or range) to 12-hour AM/PM format.
 * Examples:
 *   "08:00"          → "8:00 AM"
 *   "14:00"          → "2:00 PM"
 *   "08:00 - 11:00"  → "8:00 AM - 11:00 AM"
 *   "12:00 - 15:00"  → "12:00 PM - 3:00 PM"
 */
// [formatTime12h]: Converts 24-hour time notation to 12-hour AM/PM format.
// If the string already contains AM/PM, it is returned as-is to avoid duplication.
function formatTime12h(timeStr) {
  if (!timeStr) return timeStr;

  // If already in 12-hour format, return unchanged to avoid "8:00 AM AM"
  if (timeStr.toUpperCase().includes("AM") || timeStr.toUpperCase().includes("PM")) {
    return timeStr;
  }

  return timeStr.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12; // Convert 0 → 12 for midnight
    return `${h12}:${m} ${ampm}`;
  });
}


// =============================================
// VENUE SCHEDULE HELPERS (3-Slot-Per-Day Model)
// =============================================

/**
 * getBookedSlotsForDate(venueName, dateStr): Scans all proposals in localStorage
 * to find which time slots are already taken for a venue on a specific date.
 * Only counts "pending" or "accepted" proposals (not cancelled or rejected ones).
 * Returns an array of booked time strings.
 */
// [getBookedSlotsForDate]: Returns the list of time slots that are already booked
// for a given venue and date by scanning all active proposals.
function getBookedSlotsForDate(venueName, dateStr) {
  const proposals = loadProposals();
  return proposals
    .filter((p) =>
      p.venue === venueName &&
      p.date === dateStr &&
      p.status === "accepted"
    )
    .map((p) => p.time);
}

/**
 * timesAreEqual(timeA, timeB): Robustly compares two time strings to determine
 * if they represent the same starting time. Handles 12h, 24h, and "HH:MM - HH:MM" formats.
 */
// [timesAreEqual]: Compares two time strings by normalizing them both to 24h integers
// before comparing, so "8:00 AM" and "08:00" are correctly treated as equal.
function timesAreEqual(timeA, timeB) {
  const parseTime = (str) => {
    if (!str) return null;
    let s = str.trim().toUpperCase();
    // If it's a range (e.g. "8:00 AM - 11:00 AM"), only look at the start time
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

// [getStartHour24h]: Extracts just the start time from a time slot string and
// returns it in "HH:mm" 24-hour format. Used when submitting a form to the backend,
// which expects 24h time.
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
 * getVenueTimeSlotsForDay(venue, day, month, year): Returns an array of slot objects
 * for a venue on a specific calendar day, each marked with its booking status.
 * Returns: [{ time: "8:00 AM - 11:00 AM", booked: false, bookedBy: null }, ...]
 */
// [getVenueTimeSlotsForDay]: Combines the venue's configured time slots for a date
// with the real booking data to produce a list of slots, each labeled as booked or available.
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

// [formatDateString]: Builds a "YYYY-MM-DD" date string from year, month (0-indexed),
// and day integers. Used for consistent date keys across proposals and venue data.
function formatDateString(year, month, day) {
  const paddedMonth = String(month + 1).padStart(2, "0"); // month is 0-indexed
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

// [isDateInPast]: Returns true if a given calendar date is strictly before today
// (in local time). Today itself is NOT considered past, so it remains bookable.
function isDateInPast(day, month, year) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Compare dates only, not times
  const target = new Date(year, month, day);
  return target < today;
}

// [isVenueBlackedOut]: Returns true if the faculty has manually blocked a specific
// date for a venue (e.g., for holidays or maintenance). venue.blackoutDates is an
// array of "YYYY-MM-DD" strings set by the faculty via the Day Manager.
function isVenueBlackedOut(venue, dateStr) {
  if (!venue?.blackoutDates?.length) return false;
  return venue.blackoutDates.includes(dateStr);
}

/**
 * getDayTimeSlots(venue, dateStr): Returns the array of time slot strings for a
 * specific date. Faculty can override the default slots for individual dates using
 * the Day Manager. Also handles backward compatibility with old integer-based overrides.
 */
// [getDayTimeSlots]: Gets the time slots for a specific date, respecting any
// per-day overrides the faculty may have set. Falls back to venue defaults or
// system defaults if no override exists.
function getDayTimeSlots(venue, dateStr) {
  const defaultSlots = venue.timeSlots || DEFAULT_TIME_SLOTS;
  if (!venue?.daySlotOverrides) return defaultSlots;
  const override = venue.daySlotOverrides[dateStr];

  // No override set — use the venue's default schedule
  if (override === undefined) return defaultSlots;

  // Backwards compatibility: old data stored an integer (slot count) instead of an array
  if (typeof override === "number") {
    return defaultSlots.slice(0, Math.max(0, override));
  }

  // New format: override is a full array of time slot strings
  if (Array.isArray(override)) {
    return override;
  }

  return defaultSlots;
}


// =============================================
// PROFILE & SETTINGS MODAL LOGIC
// =============================================

/**
 * openProfileModal(role): Loads the user's saved profile data from localStorage
 * and populates the View Profile modal form. Shows the department field only for faculty.
 */
// [openProfileModal]: Reads the user's saved profile and pre-fills the View Profile
// modal form fields. Shows or hides the department field based on role. Called when
// the "View Profile" option is clicked in the profile dropdown.
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

  // Show the department field only for faculty users
  if (deptGroup) deptGroup.style.display = role === "faculty" ? "block" : "none";

  modal.classList.remove("hidden");
}

// [closeProfileModal]: Hides the View Profile modal.
function closeProfileModal() {
  document.getElementById("profileModal")?.classList.add("hidden");
}

// [saveProfileFromModal]: Reads all fields from the View Profile form, saves the
// data to localStorage, closes the modal, and shows a success toast. Called when
// "Save Profile" is clicked.
function saveProfileFromModal(role) {
  const data = {
    displayName: document.getElementById("profileDisplayName")?.value.trim() || "",
  };

  // Conditionally collect optional fields that may not exist on all pages
  const emailEl = document.getElementById("profileEmail");
  if (emailEl) data.email = emailEl.value.trim();

  const idEl = document.getElementById("profileIdNumber");
  if (idEl) data.idNumber = idEl.value.trim();

  const deptEl = document.getElementById("profileDepartment");
  if (deptEl) data.department = deptEl.value.trim();

  saveProfile(role, data);
  closeProfileModal();
  showToast("profileSavedToast");
}

/**
 * openSettingsModal(role): Fetches the user's notification preferences from the
 * backend and populates the Settings modal toggle. Called when "Settings" is clicked.
 */
// [openSettingsModal]: Fetches the user's current notification preferences from the
// server and pre-fills the Settings modal toggle. Shows the modal after loading.
async function openSettingsModal(role) {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  // Default to true (notifications on) in case the API call fails
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

// [closeSettingsModal]: Hides the Settings modal.
function closeSettingsModal() {
  document.getElementById("settingsModal")?.classList.add("hidden");
}

// [saveSettingsFromModal]: Reads the notification toggle from the Settings modal,
// sends the updated preference to the backend, saves it locally, and shows a toast.
// Called when "Save Settings" is clicked.
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

  // Also save locally as a fallback in case the server is unreachable
  const data = { notifications: isEnabled };
  saveSettings(role, data);
  closeSettingsModal();
  showToast("settingsSavedToast");
}

/**
 * initializeProfileAndSettingsModals(role): Wires all event listeners for the profile
 * and settings modals, including the logout confirmation flow. Called from both
 * student.js and faculty-dash.js during DOMContentLoaded.
 */
// [initializeProfileAndSettingsModals]: Sets up click listeners for the profile dropdown
// buttons and all related modal actions (open, close, save, logout). Called once on
// DOMContentLoaded from each dashboard page.
function initializeProfileAndSettingsModals(role) {
  // View Profile button in the dropdown
  document.getElementById("viewProfileBtn")?.addEventListener("click", () => {
    closeProfileDropdown();
    openProfileModal(role);
  });

  // Settings button in the dropdown
  document.getElementById("accountSettingsBtn")?.addEventListener("click", () => {
    closeProfileDropdown();
    openSettingsModal(role);
  });

  // Profile modal — close and save buttons
  document.getElementById("profileModalClose")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalCancel")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalOverlay")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModalSave")?.addEventListener("click", () => saveProfileFromModal(role));

  // Settings modal — close and save buttons
  document.getElementById("settingsModalClose")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalCancel")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalOverlay")?.addEventListener("click", closeSettingsModal);
  document.getElementById("settingsModalSave")?.addEventListener("click", () => saveSettingsFromModal(role));

  // Logout flow — open, cancel, confirm
  const openLogoutConfirm = () => {
    closeProfileDropdown();
    document.getElementById("logoutConfirmModal")?.classList.remove("hidden");
  };

  const closeLogoutConfirm = () => {
    document.getElementById("logoutConfirmModal")?.classList.add("hidden");
  };

  const executeLogout = async () => {
    closeLogoutConfirm();
    try {
      // Inform the server of the logout so it can invalidate the token
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      // Always clear local session and redirect, even if the server call fails
      clearAuthSession();
      window.location.href = "index.html";
    }
  };

  document.getElementById("logoutBtn")?.addEventListener("click", openLogoutConfirm);
  document.getElementById("logoutConfirmNoBtn")?.addEventListener("click", closeLogoutConfirm);
  document.getElementById("logoutConfirmOverlay")?.addEventListener("click", closeLogoutConfirm);
  document.getElementById("logoutConfirmYesBtn")?.addEventListener("click", executeLogout);
}


// =============================================
// EXPOSE UTILITIES TO PAGE SCRIPTS
// =============================================

// These functions need to be accessible from faculty-dash.js, student.js, and script.js.
// Attaching them to `window` makes them globally available across script tags.
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


// =============================================
// DOM CONTENT LOADED — Shared Initializations
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  // Apply the user's saved theme as soon as the DOM is ready (prevents flash of wrong theme)
  const role = document.body?.dataset?.page;
  if (role === "student" || role === "faculty") {
    applyTheme(loadTheme(role));
  }

  // Fill in today's date in the navbar header on dashboard pages
  const dateEl = document.getElementById("headerDate");
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

  // Set up all password show/hide toggles on the current page
  initializePasswordToggles();
});
