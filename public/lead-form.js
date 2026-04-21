document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    var btn = form.querySelector('[type="submit"]');
    var originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        body: new FormData(form),
      });

      var data = await res.json();
      if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        window.location.href = '/thank-you';
      }
    } catch(err) {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
      var errEl = document.getElementById('form-error');
      if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
    }
  });
});
