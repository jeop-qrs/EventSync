// =============================================
// script.js — Auth Pages (users.html, faculty.html)
// Handles login/signup form logic and auth panel switching.
// Shared utilities (showToast, showFieldError, etc.) are in shared.js,
// which must be loaded before this file.
// =============================================


// =============================================
// AUTH PANEL TOGGLE (Login ↔ Sign Up)
// =============================================

// [initializeAuthPanels]: Attaches click listeners to the "Sign Up", "Back to Login",
// and "Show Login" buttons so the auth panel can switch between login and signup views.
// Runs once on DOMContentLoaded.
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

// [switchAuthPanel]: Switches the visible auth panel between "login" and "signup"
// and updates all heading text to match the current portal (Student or Faculty).
// Triggered by button clicks wired in initializeAuthPanels().
function switchAuthPanel(mode) {
  const loginPanel = document.getElementById("loginPanel");
  const signUpPanel = document.getElementById("signUpPanel");
  const subtitle = document.getElementById("authSubtitle");
  const title = document.getElementById("authTitle");
  const copy = document.getElementById("authCopy");
  const terms = document.getElementById("authTerms");

  if (!loginPanel || !signUpPanel) return;

  // Detect which portal we are on by checking the URL filename
  const pathname = window.location.pathname || "";
  const isFacultyPage =
    pathname.endsWith("/faculty.html") || pathname.endsWith("faculty.html");
  const portalLabel = isFacultyPage ? "Faculty" : "Student";

  if (mode === "signup") {
    loginPanel.classList.add("auth-panel--hidden");
    signUpPanel.classList.remove("auth-panel--hidden");

    // Force the CSS animation to replay by resetting it momentarily
    signUpPanel.style.animation = "none";
    signUpPanel.offsetHeight; // force reflow — required by browsers to restart animations
    signUpPanel.style.animation = "";

    if (subtitle) subtitle.textContent = `${portalLabel.toUpperCase()} REGISTRATION`;
    if (title) title.textContent = `Create Your Account`;
    if (copy) copy.textContent = `Fill in the details below to get started`;
    if (terms) terms.textContent = `By creating an account, you agree to the EventSync Terms of Use and Privacy Statement.`;
  } else {
    signUpPanel.classList.add("auth-panel--hidden");
    loginPanel.classList.remove("auth-panel--hidden");

    // Force animation replay on return to login panel
    loginPanel.style.animation = "none";
    loginPanel.offsetHeight;
    loginPanel.style.animation = "";

    if (subtitle) subtitle.textContent = `${portalLabel.toUpperCase()} LOGIN`;
    if (title) title.textContent = `${portalLabel} Portal`;
    if (copy) copy.textContent = `Please sign in with your account`;
    if (terms) {
      // Show different terms text depending on the portal
      terms.textContent = isFacultyPage
        ? `Use your faculty credentials to log in.`
        : `Use your institutional credentials to log in.`;
    }
  }
}


// =============================================
// STUDENT LOGIN
// =============================================

// [initializeStudentLogin]: Attaches a submit listener to the student login form.
// Validates input, sends credentials to the backend, and redirects to the student
// dashboard on success. Triggers on form submit.
function initializeStudentLogin() {
  const form = document.getElementById("studentLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentNumber = document.getElementById("studentNumber")?.value.trim();
    const password = document.getElementById("studentPassword")?.value;

    if (!studentNumber || !password) {
      alert("Please enter Student Number and Password.");
      return;
    }

    // Student numbers must be exactly 10 characters per system rules
    if (studentNumber.length !== 10) {
      alert("Student Number must be exactly 10 characters long.");
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.backendMessage || "Login failed.");
        return;
      }
      // Store the auth session tokens in localStorage, then navigate to the dashboard
      saveAuthSession(result.data);
      window.location.href = "index.html?role=Student";
    } catch (err) {
      console.error(err);
      alert("An error occurred during login.");
    }
  });
}


// =============================================
// FACULTY LOGIN
// =============================================

// [initializeFacultyLogin]: Attaches a submit listener to the faculty login form.
// Validates input, sends credentials to the backend, and redirects to the faculty
// dashboard on success. Triggers on form submit.
function initializeFacultyLogin() {
  const form = document.getElementById("facultyLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("facultyUsername")?.value.trim();
    const password = document.getElementById("facultyPassword")?.value;

    if (!username || !password) {
      alert("Please enter Username and Password.");
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        alert(result.backendMessage || "Login failed.");
        return;
      }
      // Store the auth session tokens in localStorage, then navigate to the dashboard
      saveAuthSession(result.data);
      window.location.href = "faculty-dash.html";
    } catch (err) {
      console.error(err);
      alert("An error occurred during login.");
    }
  });
}


// =============================================
// REGISTRATION ERROR HANDLING
// =============================================

// [handleRegistrationError]: Reads the backend error message and shows it
// inline under the correct field (password field vs. username/student number field).
// Called when a register API call fails.
function handleRegistrationError(result, isFaculty) {
  const message = result.backendMessage || "Registration failed.";
  const msgLower = message.toLowerCase();

  // Check if the error is about the password or the username/student number
  if (msgLower.includes("password")) {
    const fieldId = isFaculty ? "signUpFacultyPassword" : "signUpPassword";
    showFieldError(fieldId, message);
  } else {
    const fieldId = isFaculty ? "signUpFacultyUsername" : "signUpStudentNumber";
    showFieldError(fieldId, message);
  }
}


// =============================================
// STUDENT SIGN UP
// =============================================

// [initializeStudentSignUp]: Attaches a submit listener to the student sign-up form.
// Validates all fields, sends registration data to the backend, and switches back
// to the login panel with a success toast on completion. Triggers on form submit.
function initializeStudentSignUp() {
  const form = document.getElementById("studentSignUpForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(form); // Clear any previous validation errors before re-validating

    const studentNumber = document.getElementById("signUpStudentNumber").value.trim();
    const fullName = document.getElementById("signUpFullName").value.trim();
    const password = document.getElementById("signUpPassword").value;
    const confirmPassword = document.getElementById("signUpConfirmPassword").value;

    // Enforce 10-character student number requirement
    if (studentNumber.length !== 10) {
      showFieldError("signUpStudentNumber", "Student Number must be exactly 10 characters long.");
      return;
    }

    // Confirm passwords match before hitting the server
    if (password !== confirmPassword) {
      showFieldError("signUpConfirmPassword", "Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber, fullName, password, role: "student" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        handleRegistrationError(result, false);
        return;
      }
      form.reset();
      switchAuthPanel("login");
      showToast(); // Show the "Account created!" success toast
    } catch (err) {
      console.error(err);
      alert("An error occurred during sign up.");
    }
  });
}


// =============================================
// FACULTY SIGN UP
// =============================================

// [initializeFacultySignUp]: Attaches a submit listener to the faculty sign-up form.
// Validates all fields, sends registration data to the backend, and switches back
// to the login panel with a success toast on completion. Triggers on form submit.
function initializeFacultySignUp() {
  const form = document.getElementById("facultySignUpForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(form); // Clear any previous validation errors before re-validating

    const username = document.getElementById("signUpFacultyUsername").value.trim();
    const fullName = document.getElementById("signUpFacultyFullName").value.trim();
    const password = document.getElementById("signUpFacultyPassword").value;
    const confirmPassword = document.getElementById("signUpFacultyConfirmPassword").value;

    // Confirm passwords match before hitting the server
    if (password !== confirmPassword) {
      showFieldError("signUpFacultyConfirmPassword", "Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, fullName, password, role: "faculty" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        handleRegistrationError(result, true);
        return;
      }
      form.reset();
      switchAuthPanel("login");
      showToast(); // Show the "Account created!" success toast
    } catch (err) {
      console.error(err);
      alert("An error occurred during sign up.");
    }
  });
}


// =============================================
// DOM CONTENT LOADED — Auth Pages Entry Point
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  // If the user is already logged in, redirect them to their respective dashboard
  if (typeof checkAuthAndRedirect === "function") {
    checkAuthAndRedirect();
  }

  initializeAuthPanels();
  initializeStudentLogin();
  initializeFacultyLogin();
  initializeStudentSignUp();
  initializeFacultySignUp();

  // Password visibility toggles are initialized globally by shared.js
});
