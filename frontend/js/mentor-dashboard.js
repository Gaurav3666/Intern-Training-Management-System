/* S8 Mentor Dashboard (FR-PRG-03) */
'use strict';

(async () => {
  const session = initPage({ role: 'mentor', nav: 'mentor-dashboard.html' });
  if (!session) return;

  let summary;
  try {
    summary = await api('/progress/summary');
  } catch (err) {
    showError(err);
    return;
  }
  const { interns, pending_reviews: pending } = summary;
  const overdue = interns.reduce((sum, i) => sum + i.overdue_count, 0);

  $('#stats').innerHTML = `
    <div class="card">
      <p class="stat__label">Pending reviews</p>
      <p class="stat__value">${pending}</p>
      <p class="stat__hint">${pending ? '<a href="reviews.html?status=Pending">Review submissions</a>' : 'You are all caught up.'}</p>
    </div>
    <div class="card">
      <p class="stat__label">Interns</p>
      <p class="stat__value">${interns.length}</p>
      <p class="stat__hint">Assigned to you</p>
    </div>
    <div class="card${overdue ? ' stat--danger' : ''}">
      <p class="stat__label">Overdue assignments</p>
      <p class="stat__value">${overdue}</p>
      <p class="stat__hint">Across all your interns</p>
    </div>`;

  if (!interns.length) {
    $('#interns').innerHTML = emptyState('No interns yet. Interns appear here once they sign up and choose you as their mentor.');
    return;
  }

  $('#interns').innerHTML = `
    <div class="table-wrap" role="region" aria-label="Interns table" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Domain</th>
            <th scope="col" class="num">Overall</th>
            <th scope="col" class="num">Overdue</th>
            <th scope="col">Last log</th>
          </tr>
        </thead>
        <tbody>
          ${interns.map((i) => `
            <tr class="is-clickable" data-href="intern.html?id=${i.id}">
              <th scope="row"><a href="intern.html?id=${i.id}">${esc(i.name)}</a></th>
              <td>${esc(i.domain)}</td>
              <td class="num">${i.overall_percent}%</td>
              <td class="num">${i.overdue_count ? badge('Overdue') + ' ' : ''}${i.overdue_count}</td>
              <td>${i.last_log_date ? esc(fmtDate(i.last_log_date)) : '<span class="muted">No logs yet</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // The whole row is a click target; the name link keeps it keyboard accessible.
  $('#interns').addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-href]');
    if (row && !event.target.closest('a')) location.href = row.dataset.href;
  });

  renderChart(interns);
})();

function renderChart(interns) {
  $('#chart-card').hidden = false;
  if (typeof Chart === 'undefined') {
    $('.chart-box').hidden = true;
    $('#chart-fallback').hidden = false;
    return;
  }

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const canvas = $('#progress-chart');
  canvas.setAttribute('aria-label',
    `Bar chart of overall progress. ${interns.map((i) => `${i.name}: ${i.overall_percent}%`).join(', ')}.`);
  $('.chart-box').style.setProperty('--chart-height', `${Math.max(140, interns.length * 44 + 56)}px`);

  Chart.defaults.font.family = token('--font-body');
  Chart.defaults.font.size = 13;
  Chart.defaults.color = token('--muted');

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: interns.map((i) => i.name),
      datasets: [{
        label: 'Overall progress',
        data: interns.map((i) => i.overall_percent),
        backgroundColor: token('--accent'),
        borderRadius: 4,
        maxBarThickness: 20,
      }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, callback: (value) => `${value}%` },
          grid: { color: token('--line') },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          border: { color: token('--line') },
          ticks: { color: token('--ink') },
        },
      },
      plugins: {
        legend: { display: false }, // one series: the heading names it
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x}% overall` } },
      },
    },
  });
}
