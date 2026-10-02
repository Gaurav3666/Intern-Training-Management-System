/* S10 Intern Detail: profile, progress, submissions and logs tabs (FR-PRG-03) */
'use strict';

(async () => {
  const session = initPage({ role: 'mentor', nav: 'mentor-dashboard.html' });
  if (!session) return;

  const id = Number(new URLSearchParams(location.search).get('id'));
  const logFilters = $('#log-filters');

  /* ----- Tabs: arrow keys move between tabs, Tab moves into the panel ----- */
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  function selectTab(tab, { focus = false } = {}) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      let target = null;
      if (move) target = tabs[(index + move + tabs.length) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (!target) return;
      event.preventDefault();
      selectTab(target, { focus: true });
    });
  });

  /* ----- Data ----- */
  let detail;
  try {
    detail = await api(`/interns/${id}`);
  } catch (err) {
    if ([400, 403, 404].includes(err.status)) {
      $('#intern-name').textContent = 'Not found';
      $('#intern-meta').textContent = err.status === 403 ? err.message : 'This intern does not exist.';
    } else {
      showError(err);
    }
    return;
  }
  const { profile, progress: p } = detail;

  document.title = `${profile.name} · InternPath`;
  $('#intern-name').textContent = profile.name;
  $('#intern-meta').textContent = `${profile.domain} · Batch ${profile.batch}`;
  $('#detail').hidden = false;

  const item = (term, value) => `<div><dt>${term}</dt><dd>${esc(value)}</dd></div>`;
  $('#profile').innerHTML = [
    item('Name', profile.name),
    item('Email', profile.email),
    item('Domain', profile.domain),
    item('Batch', profile.batch),
    item('Start date', fmtDate(profile.start_date)),
    item('End date', fmtDate(profile.end_date)),
    item('Mentor', profile.mentor_name),
  ].join('');

  $('#progress').innerHTML = `
    <div class="card">
      <p class="stat__label">Overall progress</p>
      <p class="stat__value">${p.overall_percent}%</p>
      ${meter(p.overall_percent, 'Overall progress')}
    </div>
    <div class="card">
      <p class="stat__label">Modules completed</p>
      <p class="stat__value">${p.modules_completed} <small>of ${p.modules_total}</small></p>
      <p class="stat__hint">${p.module_percent}% of modules</p>
    </div>
    <div class="card">
      <p class="stat__label">Assignments reviewed</p>
      <p class="stat__value">${p.assignments_reviewed} <small>of ${p.assignments_total}</small></p>
      <p class="stat__hint">${p.assignment_percent}% of assignments</p>
    </div>
    <div class="card${p.overdue_count ? ' stat--danger' : ''}">
      <p class="stat__label">Overdue</p>
      <p class="stat__value">${p.overdue_count}</p>
      <p class="stat__hint">Last log: ${p.last_log_date ? esc(fmtDate(p.last_log_date)) : 'none yet'}</p>
    </div>`;

  async function loadSubmissions() {
    const subs = await api('/submissions', { query: { intern_id: id } });
    $('#submissions').innerHTML = subs.length
      ? subs.map((s) => submissionHTML(s, {
        showAssignment: true,
        level: 2,
        actions: `<a class="btn btn--secondary" href="reviews.html?intern_id=${id}&module_id=${s.module_id}">${s.status === 'Pending' ? 'Review' : 'Change review'}<span class="visually-hidden"> of ${esc(s.assignment_title)}</span></a>`,
      })).join('')
      : emptyState('No submissions yet');
  }

  async function loadLogs() {
    const query = { intern_id: id, ...Object.fromEntries(new FormData(logFilters)) };
    const logs = await api('/logs', { query });
    const filtered = query.from || query.to;
    $('#log-count').textContent = `${logs.length} ${logs.length === 1 ? 'log' : 'logs'}${filtered ? ' in this date range' : ''}`;
    $('#logs').innerHTML = logs.length
      ? logsTableHTML(logs)
      : emptyState(filtered ? 'No logs in this date range.' : 'No logs yet');
  }

  logFilters.addEventListener('submit', (event) => {
    event.preventDefault();
    loadLogs().catch(showError);
  });
  logFilters.addEventListener('reset', () => setTimeout(() => loadLogs().catch(showError)));

  loadSubmissions().catch(showError);
  loadLogs().catch(showError);
})();
