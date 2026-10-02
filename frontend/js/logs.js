/* S7 Daily Logs (FR-LOG-01 to FR-LOG-03) */
'use strict';

(async () => {
  const session = initPage({ role: 'intern', nav: 'logs.html' });
  if (!session) return;

  const form = $('#log-form');
  const filters = $('#log-filters');
  const dateInput = form.elements.log_date;
  let logs = [];
  let editingId = null;

  function resetForm() {
    editingId = null;
    form.reset();
    clearErrors(form);
    dateInput.disabled = false;
    dateInput.value = !dateInput.max || todayISO() <= dateInput.max ? todayISO() : '';
    $('#log-form-title').textContent = 'Add a log';
    $('#save-log').textContent = 'Save log';
    $('#cancel-edit').hidden = true;
  }

  async function load() {
    const query = Object.fromEntries(new FormData(filters));
    try {
      logs = await api('/logs', { query });
    } catch (err) {
      showError(err);
      return;
    }
    const filtered = query.from || query.to;
    $('#result-count').textContent = `${logs.length} ${logs.length === 1 ? 'log' : 'logs'}${filtered ? ' in this date range' : ''}`;
    $('#logs').innerHTML = logs.length
      ? logsTableHTML(logs, { editable: true })
      : emptyState(filtered ? 'No logs in this date range.' : 'No logs yet. Add your first one above.');
  }

  // The date must be inside the internship and not in the future.
  try {
    const me = await api('/me');
    dateInput.min = me.start_date;
    dateInput.max = me.end_date < todayISO() ? me.end_date : todayISO();
  } catch (err) {
    showError(err);
  }
  resetForm();

  bindForm(form, {
    async submit(values) {
      if (editingId) {
        await api(`/logs/${editingId}`, { method: 'PUT', body: values });
        toast('Log updated');
      } else {
        await api('/logs', { method: 'POST', body: values });
        toast('Log saved');
      }
      resetForm();
      await load();
    },
  });

  $('#logs').addEventListener('click', (event) => {
    const id = event.target.closest('[data-edit]')?.dataset.edit;
    if (!id) return;
    const log = logs.find((item) => item.id === Number(id));
    editingId = log.id;
    clearErrors(form);
    dateInput.value = log.log_date;
    dateInput.disabled = true; // the date of an existing log cannot change
    form.elements.hours.value = log.hours;
    form.elements.description.value = log.description;
    form.elements.blockers.value = log.blockers || '';
    $('#log-form-title').textContent = `Edit log for ${fmtDate(log.log_date)}`;
    $('#save-log').textContent = 'Update log';
    $('#cancel-edit').hidden = false;
    $('#log-form-title').focus();
    form.scrollIntoView({ block: 'start' });
  });

  $('#cancel-edit').addEventListener('click', resetForm);

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    load();
  });
  filters.addEventListener('reset', () => setTimeout(load));

  load();
})();
