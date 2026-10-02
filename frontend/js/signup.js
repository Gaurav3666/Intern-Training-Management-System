/* S2 Signup (FR-AUTH-01) */
'use strict';

(async () => {
  const session = Session.get();
  if (session?.token) {
    location.replace(dashboardFor(session.role));
    return;
  }

  const form = $('#signup-form');
  const internFields = $('#intern-fields');

  // Role toggle shows or hides the intern fields. A disabled fieldset is
  // skipped by validation and left out of the request.
  function syncRole() {
    const isIntern = form.elements.role.value === 'intern';
    internFields.hidden = !isIntern;
    internFields.disabled = !isIntern;
  }
  form.elements.role.forEach((radio) => radio.addEventListener('change', syncRole));
  syncRole();

  bindForm(form, {
    validate(values) {
      const errors = {};
      const password = values.password || '';
      if (password && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
        errors.password = 'Use at least 8 characters with at least 1 letter and 1 number';
      }
      if (values.confirm_password && values.confirm_password !== password) {
        errors.confirm_password = 'Passwords do not match';
      }
      if (values.start_date && values.end_date && values.start_date >= values.end_date) {
        errors.end_date = 'End date must be after the start date';
      }
      return errors;
    },
    async submit(values) {
      await api('/auth/signup', { method: 'POST', body: values, auth: false });
      setFlash('Account created. Please log in.');
      location.href = 'login.html';
    },
  });

  try {
    const mentors = await api('/mentors', { auth: false });
    fillSelect($('#mentor_id'), mentors);
    $('#mentor-hint').hidden = mentors.length > 0;
  } catch (err) {
    showError(err);
  }
})();
