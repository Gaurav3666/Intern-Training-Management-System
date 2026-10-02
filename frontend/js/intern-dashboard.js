/* S3 Intern Dashboard (FR-PRG-02, FR-LOG-04) */
'use strict';

(async () => {
  const session = initPage({ role: 'intern', nav: 'intern-dashboard.html' });
  if (!session) return;

  $('#greeting').textContent = `Hello, ${session.name.split(' ')[0]}`;

  let p;
  try {
    p = await api('/progress/me');
  } catch (err) {
    showError(err);
    return;
  }

  $('#log-status').innerHTML = p.log_today
    ? '<p class="notice notice--success">Today\'s log is submitted.</p>'
    : '<p class="notice">Log not submitted today <a href="logs.html">Add today\'s log</a></p>';

  $('#stats').innerHTML = `
    <div class="card">
      <p class="stat__label">Overall progress</p>
      <p class="stat__value">${p.overall_percent}%</p>
      ${meter(p.overall_percent, 'Overall progress')}
    </div>
    <div class="card">
      <p class="stat__label">Modules completed</p>
      <p class="stat__value">${p.modules_completed} <small>of ${p.modules_total}</small></p>
      <p class="stat__hint"><a href="modules.html">View modules</a></p>
    </div>
    <div class="card">
      <p class="stat__label">Assignments reviewed</p>
      <p class="stat__value">${p.assignments_reviewed} <small>of ${p.assignments_total}</small></p>
      <p class="stat__hint"><a href="assignments.html">View assignments</a></p>
    </div>
    <div class="card${p.overdue_count ? ' stat--danger' : ''}">
      <p class="stat__label">Overdue</p>
      <p class="stat__value">${p.overdue_count}</p>
      <p class="stat__hint">${p.overdue_count
        ? '<a href="assignments.html?status=Overdue">See overdue work</a>'
        : 'Nothing overdue. Nice.'}</p>
    </div>`;

  $('#upcoming').innerHTML = p.upcoming.length
    ? `<ul class="list">${p.upcoming.map((a) => `
        <li>
          <span><a href="assignment.html?id=${a.id}">${esc(a.title)}</a><br><span class="muted">${esc(a.module_title)}</span></span>
          <span class="muted">Due ${esc(fmtDate(a.due_date))}</span>
        </li>`).join('')}</ul>`
    : emptyState('No upcoming assignments. You are all caught up.');
})();
