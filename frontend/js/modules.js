/* S4 Modules (FR-MOD-01 to FR-MOD-04) */
'use strict';

(async () => {
  const session = initPage({ nav: 'modules.html' });
  if (!session) return;
  const isMentor = session.role === 'mentor';

  const list = $('#modules');
  const dialog = $('#module-dialog');
  const form = $('#module-form');
  let modules = [];
  let editingId = null;

  // Only the moves the FRD allows are offered, so an invalid choice cannot be made.
  const NEXT_STATUS = {
    'Not Started': ['In Progress'],
    'In Progress': ['Completed', 'Not Started'],
    'Completed': [],
  };

  const shorten = (text) => (text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text);

  function statusControl(m) {
    const options = [m.status, ...NEXT_STATUS[m.status]];
    if (options.length === 1) {
      return '<p class="field__hint">Completed modules are final unless your mentor adds a new assignment.</p>';
    }
    return `
      <div class="field">
        <label for="status-${m.id}">Update status<span class="visually-hidden"> for ${esc(m.title)}</span></label>
        <select id="status-${m.id}" data-status-for="${m.id}">
          ${options.map((s) => `<option${s === m.status ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`;
  }

  function card(m) {
    const count = `${m.assignment_count} ${m.assignment_count === 1 ? 'assignment' : 'assignments'}`;
    return `
      <article class="card stack stack--sm" id="module-${m.id}" tabindex="-1" aria-labelledby="module-title-${m.id}">
        <div class="card__head">
          <p class="eyebrow">Module ${m.order_no}</p>
          ${isMentor ? '' : badge(m.status)}
        </div>
        <h2 id="module-title-${m.id}">${esc(m.title)}</h2>
        <p class="muted">${esc(shorten(m.description))}</p>
        <p><a href="assignments.html?module_id=${m.id}">${count}<span class="visually-hidden"> in ${esc(m.title)}</span></a></p>
        ${isMentor ? '' : statusControl(m)}
        ${isMentor && m.can_edit ? `
          <div class="card__actions">
            <button type="button" class="btn btn--secondary" data-edit="${m.id}">Edit<span class="visually-hidden"> ${esc(m.title)}</span></button>
            <button type="button" class="btn btn--secondary" data-delete="${m.id}">Delete<span class="visually-hidden"> ${esc(m.title)}</span></button>
          </div>` : ''}
      </article>`;
  }

  async function load() {
    try {
      modules = await api('/modules');
    } catch (err) {
      showError(err);
      return;
    }
    list.innerHTML = modules.length
      ? modules.map(card).join('')
      : emptyState(isMentor ? 'No modules yet. Add the first one to start the learning path.' : 'No modules yet. Your mentor has not added any.');
  }

  /* ----- Intern: status dropdown ----- */
  list.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-status-for]');
    if (!select) return;
    const id = Number(select.dataset.statusFor);
    const module = modules.find((m) => m.id === id);
    try {
      await api(`/modules/${id}/progress`, { method: 'PUT', body: { status: select.value } });
      toast(`${module.title} marked ${select.value}`);
      await load();
      // The list was redrawn: put focus back where the user was.
      ($(`#status-${id}`) || $(`#module-${id}`))?.focus();
    } catch (err) {
      select.value = module.status;
      showError(err);
    }
  });

  /* ----- Mentor: add, edit, delete ----- */
  function openForm(module) {
    editingId = module?.id ?? null;
    form.reset();
    clearErrors(form);
    $('#module-dialog-title').textContent = module ? 'Edit module' : 'Add module';
    if (module) {
      form.elements.title.value = module.title;
      form.elements.description.value = module.description;
      form.elements.order_no.value = module.order_no;
    } else {
      form.elements.order_no.value = Math.max(0, ...modules.map((m) => m.order_no)) + 1;
    }
    dialog.showModal();
  }

  if (isMentor) {
    wireDialog(dialog);
    $('#add-module').hidden = false;
    $('#add-module').addEventListener('click', () => openForm(null));

    list.addEventListener('click', async (event) => {
      const editId = event.target.closest('[data-edit]')?.dataset.edit;
      const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
      if (editId) openForm(modules.find((m) => m.id === Number(editId)));
      if (!deleteId) return;

      const module = modules.find((m) => m.id === Number(deleteId));
      const confirmed = await confirmDialog({
        title: 'Delete this module?',
        message: `"${module.title}" will be removed for everyone. This cannot be undone.`,
        confirmLabel: 'Delete module',
      });
      if (!confirmed) return;
      try {
        await api(`/modules/${module.id}`, { method: 'DELETE' });
        toast('Module deleted');
        await load();
        $('#main').focus();
      } catch (err) {
        showError(err);
      }
    });

    bindForm(form, {
      async submit(values) {
        const saved = editingId
          ? await api(`/modules/${editingId}`, { method: 'PUT', body: values })
          : await api('/modules', { method: 'POST', body: values });
        dialog.close();
        toast(editingId ? 'Module updated' : 'Module added');
        await load();
        $(`#module-${saved.id}`)?.focus();
      },
    });
  }

  load();
})();
