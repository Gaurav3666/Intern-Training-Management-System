/* S5 Assignments (FR-ASG-01 to FR-ASG-04) */
'use strict';

(async () => {
  const session = initPage({ nav: 'assignments.html' });
  if (!session) return;
  const isMentor = session.role === 'mentor';

  const filters = $('#filters');
  const container = $('#assignments');
  const dialog = $('#assignment-dialog');
  const form = $('#assignment-form');
  let assignments = [];
  let editingId = null;

  function statusCell(a) {
    if (!isMentor) {
      return `<span class="badges">${badge(a.submission_status)}${a.is_overdue ? badge('Overdue') : ''}</span>`;
    }
    const parts = [];
    if (a.pending_count) parts.push(`<span class="badge badge--info">${a.pending_count} to review</span>`);
    if (a.overdue_count) parts.push(`<span class="badge badge--danger">Overdue · ${a.overdue_count}</span>`);
    return parts.length ? `<span class="badges">${parts.join('')}</span>` : '<span class="muted">—</span>';
  }

  function row(a) {
    return `
      <tr id="assignment-${a.id}">
        <th scope="row"><a href="assignment.html?id=${a.id}">${esc(a.title)}</a></th>
        <td>${esc(a.module_title)}</td>
        <td>${esc(fmtDate(a.due_date))}</td>
        ${isMentor ? `<td class="num">${a.submission_count} of ${a.intern_count}</td>` : ''}
        <td>${statusCell(a)}</td>
        ${isMentor ? `<td>${a.can_edit
          ? `<button type="button" class="btn btn--secondary" data-edit="${a.id}">Edit<span class="visually-hidden"> ${esc(a.title)}</span></button>`
          : ''}</td>` : ''}
      </tr>`;
  }

  async function load() {
    const query = Object.fromEntries(new FormData(filters));
    try {
      assignments = await api('/assignments', { query });
    } catch (err) {
      showError(err);
      return;
    }
    const filtered = query.module_id || query.status;
    $('#result-count').textContent = `${assignments.length} ${assignments.length === 1 ? 'assignment' : 'assignments'}${filtered ? ' match your filters' : ''}`;

    if (!assignments.length) {
      container.innerHTML = emptyState(filtered ? 'No assignments match these filters.' : 'No assignments yet');
      return;
    }
    container.innerHTML = `
      <div class="table-wrap" role="region" aria-label="Assignments" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Assignment</th>
              <th scope="col">Module</th>
              <th scope="col">Due date</th>
              ${isMentor ? '<th scope="col" class="num">Submissions</th>' : ''}
              <th scope="col">Status</th>
              ${isMentor ? '<th scope="col"><span class="visually-hidden">Actions</span></th>' : ''}
            </tr>
          </thead>
          <tbody>${assignments.map(row).join('')}</tbody>
        </table>
      </div>`;
  }

  /* ----- Filters: results update in place, the count is announced ----- */
  let modules = [];
  try {
    modules = await api('/modules');
  } catch (err) {
    showError(err);
  }
  fillSelect($('#filter-module'), modules, { label: 'title' });
  fillSelect($('#module_id'), modules, { label: 'title' });

  const params = new URLSearchParams(location.search);
  if (params.has('module_id')) $('#filter-module').value = params.get('module_id');
  if (params.has('status')) $('#filter-status').value = params.get('status');
  filters.addEventListener('change', load);
  filters.addEventListener('submit', (event) => event.preventDefault());

  /* ----- Mentor: add and edit ----- */
  function openForm(assignment) {
    editingId = assignment?.id ?? null;
    form.reset();
    clearErrors(form);
    $('#assignment-dialog-title').textContent = assignment ? 'Edit assignment' : 'Add assignment';
    const due = form.elements.due_date;
    form.elements.module_id.disabled = Boolean(assignment);
    if (assignment) {
      form.elements.module_id.value = assignment.module_id;
      form.elements.title.value = assignment.title;
      form.elements.description.value = assignment.description;
      due.value = assignment.due_date;
      due.removeAttribute('min'); // the current date may stay, even if it has passed
      $('#due-hint').textContent = 'Can only be changed to a future date.';
    } else {
      form.elements.module_id.value = $('#filter-module').value;
      due.min = todayISO();
      $('#due-hint').textContent = 'Today or later.';
    }
    dialog.showModal();
  }

  if (isMentor) {
    wireDialog(dialog);
    $('#add-assignment').hidden = false;
    $('#add-assignment').addEventListener('click', () => openForm(null));

    container.addEventListener('click', (event) => {
      const id = event.target.closest('[data-edit]')?.dataset.edit;
      if (id) openForm(assignments.find((a) => a.id === Number(id)));
    });

    bindForm(form, {
      validate(values) {
        const current = assignments.find((a) => a.id === editingId);
        if (current && values.due_date && values.due_date !== current.due_date && values.due_date <= todayISO()) {
          return { due_date: 'Due date can only be changed to a future date' };
        }
        return {};
      },
      async submit(values) {
        const saved = editingId
          ? await api(`/assignments/${editingId}`, { method: 'PUT', body: values })
          : await api('/assignments', { method: 'POST', body: values });
        dialog.close();
        toast(editingId ? 'Assignment updated' : 'Assignment added');
        await load();
        $(`#assignment-${saved.id} a`)?.focus();
      },
    });
  }

  load();
})();
