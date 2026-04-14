/* ================================================================
   auth.js — Login & Register page logic
   Depends on: api.js (loaded first via <script> tag)
================================================================ */

'use strict';

/* ── GUARD: already logged in ───────────────────────────────── */
// If the user is already authenticated, skip the auth pages entirely.
if (Auth.isLoggedIn()) {
  window.location.replace('search.html');
}

/* ── HELPERS ────────────────────────────────────────────────── */
function showFormError(msg) {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('success-msg')?.classList.remove('show');
}

function showFormSuccess(msg) {
  const el = document.getElementById('success-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  document.getElementById('error-msg')?.classList.remove('show');
}

function clearMessages() {
  document.getElementById('error-msg')?.classList.remove('show');
  document.getElementById('success-msg')?.classList.remove('show');
}

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

/* ================================================================
   LOGIN PAGE
================================================================ */

/**
 * Called by the Sign In button (onclick="handleLogin()")
 * and also on Enter keydown.
 */
/**
 * Called by the Sign In button (onclick="handleLogin()")
 * and also on Enter keydown.
 */
async function handleLogin() {
  const email    = document.getElementById('email')?.value.trim()    || '';
  const password = document.getElementById('password')?.value        || '';

  clearMessages();

  // Client-side validation
  if (!email || !password) {
    showFormError('Please fill in both fields.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormError('Please enter a valid email address.');
    return;
  }

  setButtonLoading('login-btn', true);

  try {
    const data = await apiLogin(email, password);
    
    // 1. Store all necessary data exactly once
    localStorage.setItem("folio_token", data.access_token);
    localStorage.setItem("access_token", data.access_token); // Backup for some of your other pages
    localStorage.setItem("user_id", data.user_id);
    localStorage.setItem("role", data.role);

    showFormSuccess('Signed in! Redirecting…');

    // 2. Single, clean redirect logic
    setTimeout(() => {
        const userRole = data.role;
        
        if (userRole === 'super_admin') {
            window.location.href = 'super_admin.html';  // 👑 Master Control
            
        } else if (userRole === 'admin') {
            window.location.href = 'admin.html';        // 🛠️ Regular Admin
            
        } else if (userRole === 'support') {
            window.location.href = 'support_dashboard.html'; // 🎧 Support Agent
            
        } else {
            window.location.href = 'search.html';       // 🎓 Student
        }
    }, 900);

  } catch (err) {
    showFormError(err.message || 'Login failed. Please try again.');
  } finally {
    setButtonLoading('login-btn', false);
  }
}

/* ================================================================
   REGISTER PAGE
================================================================ */

/**
 * Password strength indicator.
 * Called oninput on the password field.
 */

(function initYearLogic() {
  const statusSel = document.getElementById('status');
  const yearSel   = document.getElementById('year');
  const yearHint  = document.getElementById('year-hint');
  if (!statusSel || !yearSel) return;

  statusSel.addEventListener('change', () => {
    const max = statusSel.value === 'UG' ? 4 : statusSel.value === 'PG' ? 2 : 0;
    yearSel.innerHTML = '<option value="">Select year…</option>';
    if (yearHint) yearHint.textContent = statusSel.value === 'UG'
      ? 'UG — 4-year programme' : statusSel.value === 'PG'
      ? 'PG — 2-year programme' : '';
    for (let y = 1; y <= max; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Year ${y}`;
      yearSel.appendChild(opt);
    }
  });
})();

function checkStrength(val) {
  const bar = document.getElementById('strength-bar');
  if (!bar) return;

  let score = 0;
  if (val.length >= 6)              score++;
  if (val.length >= 10)             score++;
  if (/[A-Z]/.test(val))           score++;
  if (/[0-9]/.test(val))           score++;
  if (/[^A-Za-z0-9]/.test(val))    score++;

  const pct    = score * 20;
  const colors = ['#c0392b', '#e67e22', '#c9a84c', '#2d4a3e', '#27ae60'];
  bar.style.width      = `${pct}%`;
  bar.style.background = colors[score - 1] || 'transparent';
}

/**
 * Called by the Create Account button (onclick="handleRegister()")
 * and also on Enter keydown.
 */
async function handleRegister() {
  const email     = document.getElementById('email')?.value.trim()      || '';
  const password  = document.getElementById('password')?.value           || '';
  const confirm   = document.getElementById('confirm')?.value            || '';
  const firstName = document.getElementById('first-name')?.value.trim() || '';
  const lastName  = document.getElementById('last-name')?.value.trim()  || '';
  const studentId = document.getElementById('student-id')?.value.trim() || '';

  clearMessages();

  // Validation
  if (!email || !password) {
    showFormError('Email and password are required.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormError('Please enter a valid email address.');
    return;
  }
  if (password.length < 6) {
    showFormError('Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    showFormError('Passwords do not match.');
    return;
  }

  setButtonLoading('register-btn', true);

  // Build optional student_info only if fields were filled
const phone         = document.getElementById('phone')?.value.trim()  || '';
const dob           = document.getElementById('dob')?.value            || '';
const universityId  = parseInt(document.getElementById('university')?.value) || null;
const major         = document.getElementById('major')?.value.trim()   || '';
const status        = document.getElementById('status')?.value         || '';
const yearOfStudent = parseInt(document.getElementById('year')?.value) || null;

if (phone && !/^\d{7,15}$/.test(phone)) {
  showFormError('Phone number must be 7–15 digits.'); return;
}
if (status && !yearOfStudent) {
  showFormError('Please select your year of study.'); return;
}

const studentInfo = {};
if (firstName)     studentInfo.first_name      = firstName;
if (lastName)      studentInfo.last_name       = lastName;
if (phone)         studentInfo.phone           = phone;
if (dob)           studentInfo.dob             = dob;
if (universityId)  studentInfo.university_id   = universityId;
if (major)         studentInfo.major           = major;
if (status)        studentInfo.status          = status;
if (yearOfStudent) studentInfo.year_of_student = yearOfStudent;

  try {
    await apiRegister(email, password, studentInfo);
    showFormSuccess('Account created! Redirecting…');
    setTimeout(() => window.location.href = 'search.html', 1000);
  } catch (err) {
    showFormError(err.message || 'Registration failed. Please try again.');
  } finally {
    setButtonLoading('register-btn', false);
  }
}

/* ── KEYBOARD SUPPORT ───────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  // Detect which page we're on by which button exists
  if (document.getElementById('login-btn'))    handleLogin();
  if (document.getElementById('register-btn')) handleRegister();
});