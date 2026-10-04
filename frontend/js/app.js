/* Shared helpers: session, API client, header, toasts, forms, formatting. */
'use strict';

// Same origin when FastAPI serves the pages, whatever port it runs on; from Live Server (5500),
// Live Preview (3000) or a file opened directly, call the API on its default port.
const SERVED_SEPARATELY = location.protocol === 'file:' || ['5500', '3000'].includes(location.port);
const API_BASE = SERVED_SEPARATELY ? 'http://127.0.0.1:8000' : '';
const SESSION_KEY = 'itms_session';
const FLASH_KEY = 'itms_flash';
const NETWORK_ERROR = 'Something went wrong. Please try again.';

const $ = (selector, root = document) => root.querySelector(selector);

/* ---------- Session ---------- */

const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  },
  set(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clear() { localStorage.removeItem(SESSION_KEY); },
};

const dashboardFor = (role) => (role === 'mentor' ? 'mentor-dashboard.html' : 'intern-dashboard.html');

// A message that survives one redirect (e.g. "Account created. Please log in.").
function setFlash(message) { sessionStorage.setItem(FLASH_KEY, message); }
function takeFlash() {
  const message = sessionStorage.getItem(FLASH_KEY);
  sessionStorage.removeItem(FLASH_KEY);
  return message;
}

function logout() {
  Session.clear();
  location.href = 'login.html';
}

/* ---------- Formatting ---------- */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-10-01" is a calendar date: build it from parts so the time zone cannot shift it.
function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Timestamps are stored in UTC and shown in the viewer's local time.
function fmtDateTime(isoDateTime) {
  if (!isoDateTime) return '—';
  return new Date(isoDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const BADGE_TONE = {
  'Not Started': '', 'In Progress': 'info', 'Completed': 'success',
  'Not Submitted': '', 'Pending': 'info', 'Reviewed': 'success', 'Needs Rework': 'warning',
  'Overdue': 'danger', 'Late': 'warning', 'Blocker': 'warning',
};

function badge(label) {
  const tone = BADGE_TONE[label];
  return `<span class="badge${tone ? ` badge--${tone}` : ''}">${esc(label)}</span>`;
}

function safeLink(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return `<a class="ext-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
}

function emptyState(message) {
  return `<p class="empty">${esc(message)}</p>`;
}

function meter(percent, label) {
  return `<div class="meter" role="img" aria-label="${esc(label)}: ${percent}%"><div class="meter__fill" style="width:${percent}%"></div></div>`;
}

/* One submission, used on Assignment Detail, Review Submissions and Intern Detail. */
function submissionHTML(s, { showIntern = false, showAssignment = false, actions = '', level = 3 } = {}) {
  const heading = [showIntern && s.intern_name, showAssignment && s.assignment_title].filter(Boolean).join(' · ');
  const feedbackLabel = s.status === 'Pending' ? 'Previous feedback' : 'Mentor feedback';
  return `
    <article class="card" aria-label="Submission${heading ? `: ${esc(heading)}` : ''}">
      <div class="card__head">
        <div>
          ${heading ? `<h${level}>${esc(heading)}</h${level}>` : ''}
          <p class="muted">${showAssignment ? `${esc(s.module_title)} · ` : ''}Submitted ${esc(fmtDateTime(s.submitted_at))}</p>
        </div>
        <span class="badges">${badge(s.status)}${s.is_late ? badge('Late') : ''}</span>
      </div>
      <div class="stack stack--sm">
        <p class="prose">${esc(s.response_text)}</p>
        ${s.link ? `<p>${safeLink(s.link)}</p>` : ''}
        ${s.feedback ? `
          <div class="note">
            <p class="note__label">${feedbackLabel}${s.reviewer_name ? ` from ${esc(s.reviewer_name)}` : ''}, ${esc(fmtDateTime(s.reviewed_at))}</p>
            <p class="prose">${esc(s.feedback)}</p>
          </div>` : ''}
      </div>
      ${actions ? `<div class="card__actions">${actions}</div>` : ''}
    </article>`;
}

/* Log history table: editable on Daily Logs, read-only on the mentor's Intern Detail page. */
function logsTableHTML(logs, { editable = false } = {}) {
  return `
    <div class="table-wrap" role="region" aria-label="Log history" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" class="num">Hours</th>
            <th scope="col">Work done</th>
            <th scope="col">Blockers</th>
            ${editable ? '<th scope="col"><span class="visually-hidden">Actions</span></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${logs.map((log) => `
            <tr>
              <th scope="row" style="white-space:nowrap">${esc(fmtDate(log.log_date))}</th>
              <td class="num">${log.hours}</td>
              <td><div class="cell-text">${esc(log.description)}</div></td>
              <td>${log.has_blocker
                ? `${badge('Blocker')}<div class="cell-text" style="margin-top:6px">${esc(log.blockers)}</div>`
                : '<span class="muted">None</span>'}</td>
              ${editable ? `<td>${log.can_edit
                ? `<button type="button" class="btn btn--secondary" data-edit="${log.id}">Edit<span class="visually-hidden"> log for ${esc(fmtDate(log.log_date))}</span></button>`
                : '<span class="muted">Read-only</span>'}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ---------- Toasts and loading indicator ---------- */

function toastRegion() {
  let region = $('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    document.body.append(region);
  }
  return region;
}

// Success toasts leave after 6s; errors stay until dismissed so nobody misses them.
function toast(message, type = 'success') {
  const region = toastRegion();
  while (region.children.length >= 3) region.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(message)}</span><button type="button" class="toast__close" aria-label="Dismiss message">&times;</button>`;
  $('.toast__close', el).addEventListener('click', () => el.remove());
  region.append(el);
  if (type !== 'error') setTimeout(() => el.remove(), 6000);
}

const showError = (err) => toast(err?.message || NETWORK_ERROR, 'error');

let pendingRequests = 0;
function setLoading(on) {
  pendingRequests += on ? 1 : -1;
  let loader = $('.loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'loader';
    loader.setAttribute('role', 'status');
    loader.innerHTML = '<span class="visually-hidden">Loading</span>';
    document.body.append(loader);
  }
  loader.hidden = pendingRequests === 0;
  $('main')?.setAttribute('aria-busy', String(pendingRequests > 0));
}

/* ---------- API client ---------- */

class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || null; // { field: message } from the server
  }
}

async function api(path, { method = 'GET', body, query, auth = true } = {}) {
  const url = new URL(API_BASE + path, location.href);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== '' && value != null) url.searchParams.set(key, value);
  });

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const session = Session.get();
  if (auth && session) headers.Authorization = `Bearer ${session.token}`;

  setLoading(true);
  let response;
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  } finally {
    setLoading(false);
  }

  if (response.status === 401 && auth) {
    Session.clear();
    setFlash('Your session has ended. Please log in again.');
    location.replace('login.html');
    return new Promise(() => {}); // the page is navigating away
  }
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : null;
    throw new ApiError(response.status, detail || (response.status === 404 ? 'Not found' : NETWORK_ERROR), data?.errors);
  }
  return data;
}

/* ---------- Page setup: route protection + header ---------- */

const NAV_LINKS = {
  intern: [
    ['intern-dashboard.html', 'Dashboard'],
    ['modules.html', 'Modules'],
    ['assignments.html', 'Assignments'],
    ['logs.html', 'Daily logs'],
    ['profile.html', 'Profile'],
  ],
  mentor: [
    ['mentor-dashboard.html', 'Dashboard'],
    ['modules.html', 'Modules'],
    ['assignments.html', 'Assignments'],
    ['reviews.html', 'Reviews'],
    ['profile.html', 'Profile'],
  ],
};

/**
 * Call first on every protected page. Returns the session, or null after
 * starting a redirect (no token -> login, wrong role -> own dashboard).
 * `nav` is the file name of the nav item to mark as the current page.
 */
function initPage({ role = null, nav = '' } = {}) {
  const session = Session.get();
  if (!session?.token) {
    location.replace('login.html');
    return null;
  }
  if (role && session.role !== role) {
    location.replace(dashboardFor(session.role));
    return null;
  }
  renderHeader(session, nav);
  return session;
}

function renderHeader(session, nav) {
  const header = $('#site-header');
  const links = NAV_LINKS[session.role].map(([href, label]) => (
    `<li><a class="nav__link" href="${href}"${href === nav ? ' aria-current="page"' : ''}>${label}</a></li>`
  )).join('');

  header.className = 'site-header';
  header.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="${dashboardFor(session.role)}">Intern<span>Path</span></a>
      <button type="button" class="btn btn--secondary nav__toggle" aria-expanded="false" aria-controls="primary-nav">Menu</button>
      <nav class="nav" id="primary-nav" aria-label="Primary">
        <ul class="nav__list">${links}</ul>
        <div class="nav__user">
          <span class="nav__name">${esc(session.name)} · ${session.role === 'mentor' ? 'Mentor' : 'Intern'}</span>
          <button type="button" class="btn btn--secondary" id="logout-btn">Log out</button>
        </div>
      </nav>
    </div>`;

  const toggle = $('.nav__toggle', header);
  toggle.addEventListener('click', () => {
    const open = $('#primary-nav').classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $('#logout-btn').addEventListener('click', logout);
}

/* ---------- Forms: inline errors tied to their fields ---------- */

function fieldLabel(el) {
  if (el.dataset.label) return el.dataset.label;
  const label = el.labels?.[0];
  if (!label) return 'This field';
  return (label.firstChild?.textContent || label.textContent).trim();
}

function errorElement(el) {
  const id = `${el.id || el.name}-error`;
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement('p');
    node.id = id;
    node.className = 'field__error';
    node.hidden = true;
    (el.closest('.field') || el.parentElement).append(node);
  }
  return node;
}

function setFieldError(el, message) {
  const node = errorElement(el);
  const described = new Set((el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
  if (message) {
    node.textContent = message;
    node.hidden = false;
    described.add(node.id);
    el.setAttribute('aria-invalid', 'true');
  } else {
    node.hidden = true;
    node.textContent = '';
    described.delete(node.id);
    el.removeAttribute('aria-invalid');
  }
  if (described.size) el.setAttribute('aria-describedby', [...described].join(' '));
  else el.removeAttribute('aria-describedby');
}

function fieldsOf(form) {
  return [...form.elements].filter((el) => el.name && !el.disabled && el.type !== 'radio' && el.willValidate);
}

function clearErrors(form) {
  form.querySelectorAll('[aria-invalid]').forEach((el) => setFieldError(el, ''));
}

// Mirrors the server rules using the field's own attributes (required, minlength, min, step...).
function ruleMessage(el) {
  const label = fieldLabel(el);
  const value = el.value.trim();
  if (el.required && !value) return `${label} is required`;
  if (!value) return '';
  if (el.minLength > 0 && value.length < el.minLength) return `${label} must be at least ${el.minLength} characters`;
  if (el.maxLength > 0 && value.length > el.maxLength) return `${label} must be at most ${el.maxLength} characters`;
  const v = el.validity;
  if (v.typeMismatch && el.type === 'email') return 'Enter a valid email address, like name@example.com';
  if (v.typeMismatch && el.type === 'url') return 'Enter a valid link starting with http:// or https://';
  if (v.rangeUnderflow || v.rangeOverflow) {
    return el.dataset.rangeError || `${label} must be between ${el.min} and ${el.max}`;
  }
  if (v.stepMismatch) return `${label} must be in steps of ${el.step}`;
  if (v.badInput || v.typeMismatch) return 'Enter a valid value';
  return '';
}

function formValues(form) {
  const values = {};
  new FormData(form).forEach((raw, name) => {
    const el = form.elements[name];
    const value = el.type === 'password' ? String(raw) : String(raw).trim();
    const numeric = el.type === 'number' || el.dataset?.type === 'number';
    values[name] = value === '' ? null : numeric ? Number(value) : value;
  });
  return values;
}

function applyErrors(form, errors) {
  let first = null;
  const unplaced = [];
  Object.entries(errors).forEach(([name, message]) => {
    let el = form.elements[name];
    if (el instanceof RadioNodeList) el = el[0];
    if (!el || el.disabled || el.type === 'hidden') { unplaced.push(message); return; }
    setFieldError(el, message);
    first = first || el;
  });
  first?.focus();
  return unplaced;
}

/**
 * Wires a form: validates on the client, sends, shows field errors under each
 * field and moves focus to the first one. The submit button is locked while the
 * request runs so a double click cannot send twice.
 *   validate(values) -> { field: message } for cross-field rules (optional)
 *   submit(values)   -> async, does the API call
 *   errorArea        -> element for non-field errors (defaults to an error toast)
 */
function bindForm(form, { validate, submit, errorArea }) {
  form.noValidate = true;
  let busy = false;

  form.addEventListener('input', (event) => {
    let el = event.target;
    if (el.type === 'radio') el = form.elements[el.name][0]; // a radio group reports on its first input
    if (el.getAttribute('aria-invalid')) setFieldError(el, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    clearErrors(form);
    if (errorArea) errorArea.hidden = true;

    const values = formValues(form);
    const errors = {};
    fieldsOf(form).forEach((el) => {
      const message = ruleMessage(el);
      if (message) errors[el.name] = message;
    });
    Object.entries(validate?.(values) || {}).forEach(([name, message]) => { errors[name] ??= message; });
    if (Object.keys(errors).length) {
      applyErrors(form, errors);
      return;
    }

    const button = form.querySelector('[type="submit"]');
    busy = true;
    button?.setAttribute('aria-disabled', 'true');
    try {
      await submit(values);
    } catch (err) {
      const unplaced = err.errors ? applyErrors(form, err.errors) : [err.message || NETWORK_ERROR];
      if (unplaced.length) {
        if (errorArea) {
          errorArea.textContent = unplaced[0];
          errorArea.hidden = false;
        } else {
          toast(unplaced[0], 'error');
        }
      }
    } finally {
      busy = false;
      button?.removeAttribute('aria-disabled');
    }
  });
}

/* ---------- Dialogs ---------- */

// Native <dialog>: focus is trapped while open, Esc closes, focus returns to the opener.
function wireDialog(dialog) {
  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
}

function confirmDialog({ title, message, confirmLabel = 'Confirm' }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    dialog.innerHTML = `
      <h2 id="confirm-title">${esc(title)}</h2>
      <p>${esc(message)}</p>
      <div class="form-actions" style="margin-top:24px">
        <button type="button" class="btn btn--secondary" value="cancel">Cancel</button>
        <button type="button" class="btn btn--danger" value="confirm">${esc(confirmLabel)}</button>
      </div>`;
    dialog.addEventListener('click', (event) => {
      if (event.target.value) dialog.close(event.target.value);
    });
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/* Fills a <select> with options, keeping its first (placeholder) option. */
function fillSelect(select, items, { value = 'id', label = 'name' } = {}) {
  select.length = 1;
  items.forEach((item) => select.add(new Option(item[label], item[value])));
}
  