// =============================================
// script.js — Auth pages only (users.html, faculty.html)
// Handles login/signup form logic, auth panel toggling.
// Shared utilities are in shared.js (loaded before this file).
// =============================================

// =============================================
// Auth Panel Toggle (Login ↔ Sign Up)
// =============================================

function initializeAuthPanels() {
  const showSignUpBtn = document.getElementById("showSignUpBtn");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const signUpBackBtn = document.getElementById("signUpBackBtn");

  if (showSignUpBtn) {
    showSignUpBtn.addEventListener("click", () => switchAuthPanel("signup"));
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", () => switchAuthPanel("login"));
  }

  if (signUpBackBtn) {
    signUpBackBtn.addEventListener("click", () => switchAuthPanel("login"));
  }
}

function switchAuthPanel(mode) {
  const loginPanel = document.getElementById("loginPanel");
  const signUpPanel = document.getElementById("signUpPanel");
  const subtitle = document.getElementById("authSubtitle");
  const title = document.getElementById("authTitle");
  const copy = document.getElementById("authCopy");
  const terms = document.getElementById("authTerms");

  if (!loginPanel || !signUpPanel) return;

  // Detect which portal we are on
  const pathname = window.location.pathname || "";
  const isFacultyPage =
    pathname.endsWith("/faculty.html") || pathname.endsWith("faculty.html");
  const portalLabel = isFacultyPage ? "Faculty" : "Student";

  if (mode === "signup") {
    loginPanel.classList.add("auth-panel--hidden");
    signUpPanel.classList.remove("auth-panel--hidden");

    // Re-trigger animation
    signUpPanel.style.animation = "none";
    signUpPanel.offsetHeight; // force reflow
    signUpPanel.style.animation = "";

    if (subtitle) subtitle.textContent = `${portalLabel.toUpperCase()} REGISTRATION`;
    if (title) title.textContent = `Create Your Account`;
    if (copy) copy.textContent = `Fill in the details below to get started`;
    if (terms) terms.textContent = `By creating an account, you agree to the EventSync Terms of Use and Privacy Statement.`;
  } else {
    signUpPanel.classList.add("auth-panel--hidden");
    loginPanel.classList.remove("auth-panel--hidden");

    // Re-trigger animation
    loginPanel.style.animation = "none";
    loginPanel.offsetHeight;
    loginPanel.style.animation = "";

    if (subtitle) subtitle.textContent = `${portalLabel.toUpperCase()} LOGIN`;
    if (title) title.textContent = `${portalLabel} Portal`;
    if (copy) copy.textContent = `Please sign in with your account`;
    if (terms) {
      terms.textContent = isFacultyPage
        ? `Use your faculty credentials to log in.`
        : `Use your institutional credentials to log in.`;
    }
  }
}

// =============================================
// Student Login
// =============================================

function initializeStudentLogin() {
  const form = document.getElementById("studentLoginForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const studentNumber = document.getElementById("studentNumber")?.value.trim();
    const password = document.getElementById("studentPassword")?.value;

    if (!studentNumber || !password) {
      alert("Please enter Student Number and Password.");
      return;
    }

    // Redirect to student dashboard
    window.location.href = "index.html?role=Student";
  });
}

// =============================================
// Faculty Login
// =============================================

function initializeFacultyLogin() {
  const form = document.getElementById("facultyLoginForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("facultyUsername")?.value.trim();
    const password = document.getElementById("facultyPassword")?.value;

    if (!username || !password) {
      alert("Please enter Username and Password.");
      return;
    }

    // Redirect to faculty dashboard
    window.location.href = "faculty-dash.html";
  });
}

// =============================================
// Student Sign Up
// =============================================

function initializeStudentSignUp() {
  const form = document.getElementById("studentSignUpForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const studentNumber = document.getElementById("signUpStudentNumber").value.trim();
    const fullName = document.getElementById("signUpFullName").value.trim();
    const password = document.getElementById("signUpPassword").value;
    const confirmPassword = document.getElementById("signUpConfirmPassword").value;

    let hasError = false;

    if (password.length < 8) {
      showFieldError("signUpPassword", "Password must be at least 8 characters.");
      hasError = true;
    }

    if (password !== confirmPassword) {
      showFieldError("signUpConfirmPassword", "Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    // Check for duplicate student number in localStorage
    const users = loadStudentUsers();
    const existing = users.find((u) => u.studentNumber === studentNumber);
    if (existing) {
      showFieldError("signUpStudentNumber", "This student number is already registered.");
      return;
    }

    // Save new user to localStorage
    users.push({
      studentNumber,
      fullName,
      password, // In production, this should be hashed server-side
      createdAt: new Date().toISOString(),
    });
    saveStudentUsers(users);

    form.reset();
    switchAuthPanel("login");
    showToast();
  });
}

// =============================================
// Faculty Sign Up
// =============================================

function initializeFacultySignUp() {
  const form = document.getElementById("facultySignUpForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const username = document.getElementById("signUpFacultyUsername").value.trim();
    const password = document.getElementById("signUpFacultyPassword").value;
    const confirmPassword = document.getElementById("signUpFacultyConfirmPassword").value;

    let hasError = false;

    if (password.length < 8) {
      showFieldError("signUpFacultyPassword", "Password must be at least 8 characters.");
      hasError = true;
    }

    if (password !== confirmPassword) {
      showFieldError("signUpFacultyConfirmPassword", "Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    // Check for duplicate username in localStorage
    const users = loadFacultyUsers();
    const existing = users.find((u) => u.username === username);
    if (existing) {
      showFieldError("signUpFacultyUsername", "This username is already registered.");
      return;
    }

    users.push({
      username,
      password,
      createdAt: new Date().toISOString(),
    });
    saveFacultyUsers(users);

    form.reset();
    switchAuthPanel("login");
    showToast();
  });
}

// =============================================
// DOMContentLoaded — Auth Pages
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  initializeAuthPanels();
  initializeStudentLogin();
  initializeFacultyLogin();
  initializeStudentSignUp();
  initializeFacultySignUp();
  // Password toggles are initialized in shared.js
});