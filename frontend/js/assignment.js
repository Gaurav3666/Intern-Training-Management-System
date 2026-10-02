/* S6 Assignment Detail (FR-SUB-01, FR-SUB-02, FR-SUB-03) */
'use strict';

(async () => {
  const session = initPage({ nav: 'assignments.html' });
  if (!session) return;
  const isMentor = session.role === 'mentor';

  const id = Number(new URLSearchParams(location.search).get('id'));
  const form = $('#submission-form');
  let assignment = null;

  function notFound(message) {
    $('#assignment-title').textContent = message;
    $('#assignment-meta').textContent = 'This assignment may have been removed.';
  }

  function renderIntern() {
    const sub = assignment.submission;
    $('#submissions').innerHTML = sub ? submissionHTML(sub) : '';

    // The form shows for a first submission, and again only when rework is requested.
    const canSubmit = !sub || sub.status === 'Needs Rework';
    form.hidden = !canSubmit;
    if (!canSubmit) return;
    $('#form-title').textContent = sub ? 'Resubmit your work' : 'Submit your work';
    $('#submit-btn').textContent = sub ? 'Resubmit' : 'Submit';
    form.elements.response_text.value = sub?.response_text || '';
    form.elements.link.value = sub?.link || '';
  }

  async function renderMentor() {
    $('#work-title').textContent = `Submissions from your interns (${assignment.submission_count} of ${assignment.intern_count})`;
    const subs = await api('/submissions', { query: { assignment_id: id } });
    $('#submissions').innerHTML = subs.length
      ? subs.map((s) => submissionHTML(s, {
        showIntern: true,
        actions: `<a class="btn btn--secondary" href="reviews.html?intern_id=${s.intern_id}&module_id=${s.module_id}">Review<span class="visually-hidden"> ${esc(s.intern_name)}'s submission</span></a>`,
      })).join('')
      : emptyState('No submissions yet');
  }

  async function load() {
    try {
      assignment = await api(`/assignments/${id}`);
    } catch (err) {
      if (err.status === 404 || err.status === 400) notFound('Not found');
      else showError(err);
      return;
    }
    document.title = `${assignment.title} · InternPath`;
    $('#assignment-title').textContent = assignment.title;
    $('#assignment-meta').textContent = `${assignment.module_title} · Due ${fmtDate(assignment.due_date)}`;
    $('#assignment-description').textContent = assignment.description;
    $('#assignment-badges').innerHTML = isMentor
      ? (assignment.overdue_count ? `<span class="badge badge--danger">Overdue · ${assignment.overdue_count}</span>` : '')
      : badge(assignment.submission_status) + (assignment.is_overdue ? badge('Overdue') : '');
    $('#brief').hidden = false;
    $('#work').hidden = false;

    if (isMentor) await renderMentor().catch(showError);
    else renderIntern();
  }

  if (!isMentor) {
    bindForm(form, {
      async submit(values) {
        const existing = assignment.submission;
        if (existing) {
          await api(`/submissions/${existing.id}`, { method: 'PUT', body: values });
        } else {
          await api('/submissions', { method: 'POST', body: { ...values, assignment_id: id } });
        }
        toast(existing ? 'Work resubmitted. Status: Pending' : 'Work submitted. Status: Pending');
        await load();
        $('#main').focus();
      },
    });
  }

  load();
})();
