/* S9 Review Submissions (FR-SUB-03, FR-SUB-04) */
'use strict';

(async () => {
  const session = initPage({ role: 'mentor', nav: 'reviews.html' });
  if (!session) return;

  const filters = $('#filters');
  const container = $('#submissions');
  const dialog = $('#review-dialog');
  const form = $('#review-form');
  let submissions = [];
  let reviewing = null;

  async function load() {
    const query = Object.fromEntries(new FormData(filters));
    try {
      submissions = await api('/submissions', { query });
    } catch (err) {
      showError(err);
      return;
    }
    const filtered = Object.values(query).some(Boolean);
    $('#result-count').textContent = `${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}${filtered ? ' match your filters' : ''}`;
    container.innerHTML = submissions.length
      ? submissions.map((s) => `<div id="submission-${s.id}" tabindex="-1">${submissionHTML(s, {
        showIntern: true,
        showAssignment: true,
        level: 2,
        actions: `<button type="button" class="btn${s.status === 'Pending' ? '' : ' btn--secondary'}" data-review="${s.id}">${s.status === 'Pending' ? 'Review' : 'Change review'}<span class="visually-hidden"> of ${esc(s.intern_name)}'s ${esc(s.assignment_title)}</span></button>`,
      })}</div>`).join('')
      : emptyState(filtered ? 'No submissions match these filters.' : 'No submissions yet');
  }

  /* ----- Filter bar ----- */
  try {
    const [interns, modules] = await Promise.all([api('/interns'), api('/modules')]);
    fillSelect($('#filter-intern'), interns);
    fillSelect($('#filter-module'), modules, { label: 'title' });
  } catch (err) {
    showError(err);
  }
  const params = new URLSearchParams(location.search);
  ['intern_id', 'module_id', 'status'].forEach((name) => {
    if (params.has(name)) filters.elements[name].value = params.get(name);
  });
  filters.addEventListener('change', load);
  filters.addEventListener('submit', (event) => event.preventDefault());

  /* ----- Review form ----- */
  wireDialog(dialog);

  container.addEventListener('click', (event) => {
    const id = event.target.closest('[data-review]')?.dataset.review;
    if (!id) return;
    reviewing = submissions.find((s) => s.id === Number(id));
    form.reset();
    clearErrors(form);
    $('#review-context').textContent = `${reviewing.intern_name} · ${reviewing.assignment_title}`;
    if (reviewing.status !== 'Pending') {
      form.elements.status.value = reviewing.status;
      form.elements.feedback.value = reviewing.feedback || '';
    }
    dialog.showModal();
  });

  bindForm(form, {
    validate(values) {
      const errors = {};
      if (!values.status) errors.status = 'Choose Reviewed or Needs Rework';
      if (values.status === 'Needs Rework' && !values.feedback) {
        errors.feedback = 'Feedback is required when you ask for rework';
      }
      return errors;
    },
    async submit(values) {
      const id = reviewing.id;
      await api(`/submissions/${id}/review`, { method: 'PUT', body: values });
      dialog.close();
      toast(`Marked ${values.status}`);
      await load();
      ($(`#submission-${id}`) || $('#main')).focus();
    },
  });

  load();
})();
