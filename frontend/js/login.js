/* S1 Login (FR-AUTH-02) */
'use strict';

(() => {
  const session = Session.get();
  if (session?.token) {
    location.replace(dashboardFor(session.role));
    return;
  }

  const flash = takeFlash();
  if (flash) {
    $('#flash').textContent = flash;
    $('#flash').hidden = false;
  }

  bindForm($('#login-form'), {
    errorArea: $('#login-error'),
    async submit(values) {
      const result = await api('/auth/login', { method: 'POST', body: values, auth: false });
      Session.set(result);
      location.href = dashboardFor(result.role);
    },
  });
})();
