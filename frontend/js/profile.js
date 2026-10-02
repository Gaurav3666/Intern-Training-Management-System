/* S11 Profile (FR-PROF-01, FR-PROF-02) */
'use strict';

(async () => {
  const session = initPage({ nav: 'profile.html' });
  if (!session) return;
  const isIntern = session.role === 'intern';

  const form = $('#profile-form');
  const internFields = $('#intern-fields');
  internFields.hidden = !isIntern;
  internFields.disabled = !isIntern;
  $('#edit-hint').textContent = isIntern
    ? 'Email, role, mentor and internship dates cannot be changed here.'
    : 'Email and role cannot be changed here.';

  const item = (term, value) => `<div><dt>${term}</dt><dd>${esc(value)}</dd></div>`;

  function render(me) {
    const rows = [item('Name', me.name), item('Email', me.email), item('Role', isIntern ? 'Intern' : 'Mentor')];
    if (isIntern) {
      rows.push(
        item('Domain', me.domain),
        item('Batch', me.batch),
        item('Start date', fmtDate(me.start_date)),
        item('End date', fmtDate(me.end_date)),
        item('Mentor', me.mentor_name),
      );
    } else {
      rows.push(item('Assigned interns', me.intern_count));
    }
    $('#profile').innerHTML = rows.join('');

    form.elements.name.value = me.name;
    if (isIntern) {
      form.elements.domain.value = me.domain;
      form.elements.batch.value = me.batch;
    }
  }

  bindForm(form, {
    async submit(values) {
      const me = await api('/me', { method: 'PUT', body: values });
      render(me);
      // Keep the name in the header in step with the saved profile.
      const updated = { ...session, name: me.name };
      Session.set(updated);
      renderHeader(updated, 'profile.html');
      toast('Profile saved');
    },
  });

  try {
    render(await api('/me'));
  } catch (err) {
    showError(err);
  }
})();
