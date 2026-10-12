// Demo countdown on the "spontaneous run" feature and the partners contact form.
(function () {
  var timeEl = document.getElementById('cd-time');
  var ring = document.getElementById('cd-ring');
  if (timeEl && ring) {
    var circumference = 238.8;
    var windowSeconds = 15 * 60;
    var left = 12 * 60 + 40;
    var render = function () {
      var m = Math.floor(left / 60);
      var s = left % 60;
      timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      var progress = 1 - left / windowSeconds;
      ring.setAttribute('stroke-dashoffset', String(circumference * (1 - Math.max(0, Math.min(1, progress)))));
    };
    render();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      setInterval(function () {
        left = left > 0 ? left - 1 : 12 * 60 + 40;
        render();
      }, 1000);
    }
  }

  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  if (form && status) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();
      if (!name || !email || !message || !form.elements.email.checkValidity()) {
        status.hidden = false;
        status.textContent = 'חסרים שם, אימייל תקין או הודעה. אפשר להשלים ולשלוח שוב.';
        return;
      }
      var subject = 'שיתוף פעולה עם בוא נרוץ · ' + form.elements.type.value;
      var body = message + '\n\n' + name + (form.elements.org.value.trim() ? ' · ' + form.elements.org.value.trim() : '') + '\n' + email;
      status.hidden = false;
      status.textContent = 'פתחנו טיוטת מייל עם הפרטים. אם היא לא נפתחה, אפשר לכתוב ישירות לכתובת שמתחת לכפתור.';
      window.location.href = 'mailto:masrab11@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }
})();
