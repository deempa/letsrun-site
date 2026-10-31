// Frame-buster (PRA-27). GitHub Pages sends no headers and a <meta> CSP can't set frame-ancestors, so nothing stops
// another site from loading this page in a hidden frame and tricking a signed-in admin into clicks (clickjacking).
// Inside a frame: blank the page, try to take over the top window, and never start the console (see the first line
// of the main function below). Longer term: serve /admin from its own subdomain or a host that sends real headers
// (Content-Security-Policy: frame-ancestors 'none'; X-Frame-Options: DENY), which also keeps its session off the
// main site's origin.
(function () {
  "use strict";
  if (window.top === window.self) return;
  try { document.documentElement.style.display = "none"; } catch (e) { /* none */ }
  try { if (document.body) document.body.textContent = ""; } catch (e) { /* none */ }
  try { window.top.location = window.self.location.href; } catch (e) { /* a sandboxed or blocked frame: stays blank */ }
})();

// Admin page for בוא נרוץ (round 24, sketch A; round 38: sketch A on a computer, sketch B on a phone). Static: supabase-js from the CDN, the project's URL and anon key
// (public by design: the apps ship the same key, and every admin_* RPC checks private.admins on the server).
// Sign-in: an email one-time code. Rendering builds DOM nodes (textContent only, never innerHTML with data).
(function () {
  "use strict";
  if (window.top !== window.self) return; // framed: the frame-buster above has blanked the page

  var SUPABASE_URL = "https://hpzekzgcexjuychyobxt.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwemVremdjZXhqdXljaHlvYnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTExODUsImV4cCI6MjEwNzA2NzE4NX0.t5wlEXKUSvKz8prEITweQJUJ1lXL3mKQLuj98MLJKQI";

  var REASONS = {
    inappropriate: "התנהגות לא הולמת",
    fake: "פרופיל מזויף",
    safety: "חשש לבטיחות",
    spam: "ספאם או פרסום",
    other: "אחר"
  };
  var TRUST = { starter: "מתחיל/ה", verified: "מאומת/ת", regular: "קבוע/ה", pacer: "פייסר/ית" };
  var STATUS = { open: "פתוח", actioned: "טופל", dismissed: "נסגר בלי פעולה" };
  var ACTIONS = {
    suspend: "השעיה",
    unsuspend: "ביטול השעיה",
    remove_message: "הסרת הודעה",
    remove_run: "הסרת ריצה",
    report_status: "עדכון דיווח",
    flag_reviewed: "סימון נבדק",
    word_added: "מילה נוספה",
    word_removed: "מילה הוסרה",
    rate_limit_set: "מגבלת קצב",
    app_config_set: "הגדרת גרסה",
    users_viewed: "צפייה ברשימת המשתמשים",
    newsletter_exported: "ייצוא מנויי הניוזלטר",
    race_hidden: "מרוץ הוסתר",
    race_shown: "מרוץ הוצג שוב",
    user_deleted: "מחיקת חשבון",
    test_push: "התראת בדיקה",
    offer_save: "שמירת הטבה או אירוע",
    offer_status: "שינוי מצב של הטבה או אירוע"
  };
  var PLATFORMS = { ios: "iPhone", android: "Android" };
  // The word typed to confirm a deletion.
  var DELETE_WORD = "מחיקה";
  var SOURCES = { onboarding: "באונבורדינג", settings: "בהגדרות" };
  var RESEND_URL = "https://resend.com/broadcasts";
  // Rate limit actions (private.rate_limits), in the order the settings tab shows them.
  var LIMITS = [
    ["chat_message", "הודעות בצ׳אט"],
    ["join_request", "בקשות הצטרפות לריצה"],
    ["run_create", "ריצות חדשות"],
    ["connection_request", "בקשות חיבור"],
    ["run_invite", "הזמנות לריצה"],
    ["report", "דיווחים"],
    ["location_update", "עדכוני מיקום"],
    ["link_preview", "פתיחת קישורי חיבור"],
    ["events", "נתוני שימוש מהאפליקציה"],
    ["crew_create", "קבוצות חדשות"],
    ["crew_invite", "הזמנות לקבוצה"],
    ["crew_rename", "שינויי שם של קבוצה"],
    ["crew_link_join", "הצטרפות לקבוצה בקישור"],
    ["crew_schedule", "שינויים בריצה הקבועה"],
    ["activity_insert", "שמירת ריצות"],
    ["meeting_points", "חיפושי ״איפה נפגשים?״"],
    ["offer_event", "פתיחות, העתקות קוד ולחיצות על הטבות"]
  ];
  var CONFIG = {
    min_version_ios: "iOS · גרסה מינימלית",
    latest_version_ios: "iOS · גרסה אחרונה",
    store_url_ios: "iOS · קישור לחנות",
    min_version_android: "Android · גרסה מינימלית",
    latest_version_android: "Android · גרסה אחרונה",
    store_url_android: "Android · קישור לחנות"
  };
  var TONES = ["var(--tone-1)", "var(--tone-2)", "var(--tone-3)", "var(--tone-4)", "var(--tone-5)"];
  var PENDING_KEY = "letsrun-admin-pending-email";
  var RANGE_KEY = "letsrun-admin-range";
  var RANGES = [7, 30, 90];
  // The last range picked on "מבט על" (this browser only; any storage failure just means 30).
  function readRange() {
    var n = 30;
    try { n = Number(window.localStorage.getItem(RANGE_KEY)) || 30; } catch (e) { /* none */ }
    return RANGES.indexOf(n) >= 0 ? n : 30;
  }
  function saveRange(n) {
    try { window.localStorage.setItem(RANGE_KEY, String(n)); } catch (e) { /* none */ }
  }

  var sb = null;
  var state = {
    email: "",
    signedIn: false,
    tab: "overview",
    inboxFilter: "all",
    userTab: "overview",
    range: readRange(),
    filter: "open",
    openReports: [],
    listReports: [],
    flags: [],
    words: [],
    log: [],
    logDone: false
  };

  // ------------------------------------------------------------------ helpers ---

  function $(id) { return document.getElementById(id); }

  // h("div", { class: "x", onclick: fn, "aria-label": "…" }, child, "text", …)
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  function svg(path) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2.4");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", path);
    s.appendChild(p);
    return s;
  }
  function storageGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) {
    try { if (v) window.sessionStorage.setItem(k, v); else window.sessionStorage.removeItem(k); } catch (e) { /* none */ }
  }

  function view() { return $("view"); }
  function show() {
    var v = view();
    v.textContent = "";
    for (var i = 0; i < arguments.length; i++) append(v, arguments[i]);
  }
  function loading(text) {
    show(h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), text || "טוענים…"));
  }
  function empty(title, sub) {
    return h("div", { class: "card empty" }, svg("M5 12l4 4 10-10"), h("b", { text: title }), sub ? h("span", { text: sub }) : null);
  }

  function hash(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(n);
  }
  function avatar(p, big) {
    var cls = "avatar" + (big ? " big" : "");
    if (p && p.avatar_url && /^https:\/\//.test(p.avatar_url)) {
      return h("img", { class: cls, src: p.avatar_url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
    }
    var name = (p && p.name) || "?";
    var el = h("span", { class: cls, "aria-hidden": "true", text: Array.from(name.trim())[0] || "?" });
    el.style.background = TONES[hash((p && p.id) || name) % TONES.length];
    return el;
  }

  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  function clock(d) {
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" });
  }
  function dayKey(d) { return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); }
  function ago(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var ms = Date.now() - d.getTime();
    if (isNaN(ms)) return "";
    if (ms < MIN) return "עכשיו";
    if (ms < HOUR) return "לפני " + Math.round(ms / MIN) + " דק׳";
    if (ms < 2 * HOUR) return "לפני שעה";
    if (ms < 3 * HOUR) return "לפני שעתיים";
    if (dayKey(d) === dayKey(new Date())) return "לפני " + Math.round(ms / HOUR) + " שעות";
    if (dayKey(d) === dayKey(new Date(Date.now() - DAY))) return "אתמול " + clock(d);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" }) + " " + clock(d);
  }
  // "13.10 21:40" (a run's start, future or past).
  function stamp(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" }) + " " + clock(d);
  }
  function joined(iso) {
    if (!iso) return "";
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
    if (isNaN(days)) return "";
    if (days < 1) return "הצטרף/ה היום";
    if (days < 2) return "הצטרף/ה אתמול";
    if (days < 30) return "הצטרף/ה לפני " + days + " ימים";
    var months = Math.floor(days / 30);
    if (months < 2) return "הצטרף/ה לפני חודש";
    if (months < 12) return "הצטרף/ה לפני " + months + " חודשים";
    return months < 24 ? "הצטרף/ה לפני שנה" : "הצטרף/ה לפני " + Math.floor(months / 12) + " שנים";
  }
  function nameAge(p) {
    if (!p) return "משתמש/ת שנמחק/ה";
    var n = p.name && p.name.trim() ? p.name.trim() : "ללא שם";
    return typeof p.age === "number" && p.age > 0 && p.age < 120 ? n + ", " + p.age : n;
  }
  function personSub(p) {
    if (!p) return "";
    return [TRUST[p.trust_level] || "", joined(p.created_at)].filter(Boolean).join(" · ");
  }

  // ------------------------------------------------------------------ RPC and errors ---

  function rpc(name, args) {
    return sb.rpc(name, args || {}).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }
  function code(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || "");
    var known = ["mfa_required", "not_admin", "not_authenticated", "invalid_argument", "user_not_found", "message_not_found",
      "group_run_not_found", "crew_not_found", "report_not_found", "flag_not_found", "cannot_delete_admin", "too_soon"];
    for (var i = 0; i < known.length; i++) if (m.indexOf(known[i]) >= 0) return known[i];
    if (/jwt|token|session/i.test(m)) return "session";
    return "other";
  }
  function errorText(e) {
    switch (code(e)) {
      case "invalid_argument": return "חסר פרט, או שהוא לא תקין.";
      case "user_not_found": return "המשתמש/ת לא נמצא/ה. אולי החשבון נמחק.";
      case "message_not_found": return "ההודעה כבר לא קיימת.";
      case "group_run_not_found": return "הריצה כבר לא קיימת.";
      case "report_not_found": return "הדיווח כבר לא קיים.";
      case "flag_not_found": return "הסימון כבר לא קיים.";
      case "cannot_delete_admin": return "אי אפשר למחוק חשבון של מנהל.";
      case "too_soon": return "נשלחה בדיקה לפני פחות מחצי דקה. עוד רגע.";
      case "session": return "החיבור פג. נכנסים שוב.";
      default: return "משהו השתבש. אפשר לנסות שוב.";
    }
  }
  // Every failed admin action ends here: no access, an expired session, or a calm message.
  function fail(e) {
    if (missingRpc(e)) return toast("השרת עוד לא עודכן לגרסה הזו (v36). מריצים את העדכון ב־Supabase.");
    var c = code(e);
    if (c === "not_admin") return showDenied();
    if (c === "mfa_required") return secondStep();
    if (c === "not_authenticated" || c === "session") {
      toast(errorText({ message: "session" }));
      return signOut();
    }
    toast(errorText(e));
  }

  // ------------------------------------------------------------------ toast and confirm ---

  var toastTimer = null;
  function toast(text, actionLabel, action) {
    var t = $("toast");
    $("toast-text").textContent = text;
    var btn = $("toast-action");
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || "";
    btn.onclick = action ? function () { t.hidden = true; action(); } : null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, actionLabel ? 7000 : 4000);
  }

  // Asks for a short note; resolves to the note ("" when optional and empty), or null when cancelled.
  function confirmNote(o) {
    return new Promise(function (resolve) {
      var dlg = $("confirm");
      var note = $("confirm-note");
      var err = $("confirm-error");
      $("confirm-title").textContent = o.title;
      $("confirm-text").textContent = o.text || "";
      $("confirm-text").hidden = !o.text;
      $("confirm-label").textContent = o.label + (o.required ? "" : " (לא חובה)");
      $("confirm-ok").textContent = o.ok;
      note.value = "";
      note.required = !!o.required;
      err.hidden = true;
      var done = function (v) {
        $("confirm-form").onsubmit = null;
        $("confirm-cancel").onclick = null;
        dlg.onclose = null;
        if (dlg.open) dlg.close();
        resolve(v);
      };
      $("confirm-form").onsubmit = function (ev) {
        ev.preventDefault();
        var v = note.value.trim();
        if (o.required && !v) {
          err.textContent = "כמה מילים, בשביל היומן.";
          err.hidden = false;
          note.focus();
          return;
        }
        done(v);
      };
      $("confirm-cancel").onclick = function () { done(null); };
      dlg.onclose = function () { done(null); };
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      note.focus();
    });
  }

  // ------------------------------------------------------------------ sign-in ---

  // The signed-in chrome: the side menu (computer) or the bottom tabs (phone), and the search buttons.
  function chrome(on) {
    state.signedIn = on;
    $("side").hidden = !on;
    $("tabbar").hidden = !on;
    document.body.classList.toggle("signed-in", on);
    Array.prototype.forEach.call(document.querySelectorAll(".bar [data-search]"), function (b) { b.hidden = !on; });
  }

  function showSignIn(prefill) {
    chrome(false);
    $("sign-out").hidden = true;
    var pending = storageGet(PENDING_KEY);
    if (pending && !prefill) return showCode(pending);
    show($("t-signin").content.cloneNode(true));
    var input = $("email");
    if (prefill) input.value = prefill;
    $("email-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = input.value.trim().toLowerCase();
      var err = $("email-error");
      if (!input.checkValidity() || !email) {
        err.textContent = "צריך כתובת אימייל תקינה.";
        err.hidden = false;
        input.focus();
        return;
      }
      sendCode(email, ev.submitter || ev.target.querySelector("button"), err);
    });
    input.focus();
  }

  function sendCode(email, button, err) {
    if (button) button.disabled = true;
    sb.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname }
    }).then(function (res) {
      if (button) button.disabled = false;
      if (res.error) {
        var m = res.error.message || "";
        err.textContent = /seconds|rate/i.test(m) ? "אפשר לבקש קוד חדש בעוד רגע." : "לא הצלחנו לשלוח קוד. אפשר לנסות שוב.";
        err.hidden = false;
        return;
      }
      storageSet(PENDING_KEY, email);
      showCode(email);
    });
  }

  function showCode(email) {
    show($("t-code").content.cloneNode(true));
    $("code-email").textContent = email;
    var input = $("code");
    var err = $("code-error");
    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D+/g, "").slice(0, 6);
      if (input.value.length === 6) $("code-form").requestSubmit();
    });
    $("code-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var token = input.value.replace(/\D+/g, "");
      if (token.length !== 6) {
        err.textContent = "הקוד הוא 6 ספרות.";
        err.hidden = false;
        input.focus();
        return;
      }
      var btn = ev.target.querySelector("button[type=submit]");
      btn.disabled = true;
      sb.auth.verifyOtp({ email: email, token: token, type: "email" }).then(function (res) {
        btn.disabled = false;
        if (res.error || !res.data || !res.data.session) {
          err.textContent = "הקוד לא נכון או שפג תוקפו.";
          err.hidden = false;
          input.select();
          return;
        }
        storageSet(PENDING_KEY, null);
        enter(res.data.session);
      });
    });
    $("resend").addEventListener("click", function () { sendCode(email, $("resend"), err); });
    $("other-email").addEventListener("click", function () {
      storageSet(PENDING_KEY, null);
      showSignIn(email);
    });
    input.focus();
  }

  // ------------------------------------------------------------------ second step (TOTP) ---

  // The email code gives an aal1 session; admin_* calls need aal2. A verified factor → ask for its code;
  // none yet → enroll one (an unfinished enrollment from an earlier try is removed first).
  function secondStep() {
    chrome(false);
    $("sign-out").hidden = false;
    loading("עוד רגע…");
    sb.auth.mfa.listFactors().then(function (res) {
      if (res.error) throw res.error;
      var all = (res.data && res.data.all) || [];
      var verified = all.filter(function (f) { return f.factor_type === "totp" && f.status === "verified"; });
      if (verified.length) return showMfa(verified[0].id);
      var stale = all.filter(function (f) { return f.factor_type === "totp" && f.status !== "verified"; });
      return Promise.all(stale.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); })).then(enrollMfa);
    }).catch(function () {
      show(empty("לא הצלחנו להמשיך", "אפשר לרענן את הדף ולנסות שוב."));
    });
  }

  // The QR comes back as SVG markup (or already as a data URL in newer servers); shown in an <img>, so it can't run.
  function qrSrc(q) {
    if (!q) return "";
    return /^data:/.test(q) ? q : "data:image/svg+xml;utf-8," + encodeURIComponent(q);
  }

  function sixDigits(input, form) {
    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D+/g, "").slice(0, 6);
      if (input.value.length === 6) form.requestSubmit();
    });
  }

  function verifyMfa(factorId, input, err, btn) {
    var token = input.value.replace(/\D+/g, "");
    if (token.length !== 6) {
      err.textContent = "הקוד הוא 6 ספרות.";
      err.hidden = false;
      input.focus();
      return;
    }
    btn.disabled = true;
    sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: token }).then(function (res) {
      btn.disabled = false;
      if (res.error) {
        err.textContent = "הקוד לא נכון. בודקים שהשעה בטלפון מדויקת ומנסים את הקוד הבא.";
        err.hidden = false;
        input.select();
        return;
      }
      sb.auth.getSession().then(function (r) { if (r.data && r.data.session) enter(r.data.session); });
    });
  }

  function enrollMfa() {
    return sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "letsrun-admin" }).then(function (res) {
      if (res.error || !res.data) throw res.error || new Error("enroll");
      var factorId = res.data.id;
      show($("t-mfa-enroll").content.cloneNode(true));
      $("mfa-qr").src = qrSrc(res.data.totp && res.data.totp.qr_code);
      $("mfa-secret").textContent = ((res.data.totp && res.data.totp.secret) || "").replace(/(.{4})/g, "$1 ").trim();
      var input = $("mfa-enroll-code");
      var form = $("mfa-enroll-form");
      sixDigits(input, form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        verifyMfa(factorId, input, $("mfa-enroll-error"), form.querySelector("button[type=submit]"));
      });
      input.focus();
    });
  }

  function showMfa(factorId) {
    show($("t-mfa").content.cloneNode(true));
    var input = $("mfa-code");
    var form = $("mfa-form");
    sixDigits(input, form);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      verifyMfa(factorId, input, $("mfa-error"), form.querySelector("button[type=submit]"));
    });
    input.focus();
  }

  function showDenied() {
    chrome(false);
    show($("t-denied").content.cloneNode(true));
    $("denied-out").addEventListener("click", signOut);
  }

  function signOut() {
    storageSet(PENDING_KEY, null);
    return sb.auth.signOut().catch(function () { /* local session cleared anyway */ }).then(function () {
      state.email = "";
      showSignIn();
    });
  }

  // ------------------------------------------------------------------ entering ---

  // An enter() in flight (the link's sign-in can arrive both from getSession() and from onAuthStateChange).
  var entering = false;

  function enter(session) {
    if (entering) return;
    entering = true;
    state.email = (session.user && session.user.email) || "";
    $("sign-out").hidden = false;
    loading("בודקים הרשאה…");
    Promise.all([rpc("admin_reports", { status: "open", max_rows: 200 }), rpc("admin_flags")])
      .then(function (res) {
        entering = false;
        state.openReports = res[0] || [];
        state.flags = res[1] || [];
        updateCounts();
        $("sign-out").hidden = true;
        chrome(true);
        route();
      })
      .catch(function (e) {
        entering = false;
        if (code(e) === "not_admin") return showDenied();
        if (code(e) === "mfa_required") return secondStep();
        fail(e);
        show(empty("לא הצלחנו לטעון", "בדקו את החיבור ונסו לרענן את הדף."));
      });
  }

  // What waits (open reports + open flags): the count on "משימות" and the top bar's pill ("N לטיפול").
  function todoCount() { return state.openReports.length + state.flags.length; }
  function updateCounts() {
    var n = todoCount();
    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (c) {
      c.textContent = String(n);
      c.hidden = n === 0;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-todo-label]"), function (c) {
      c.textContent = n ? fmt(n) + " לטיפול" : "אין משימות";
      c.parentNode.classList.toggle("hot", n > 0);
    });
  }

  // A computer gets the top bar, a phone the bottom tabs; both start on "מבט על" (round 58).
  var WIDE = window.matchMedia("(min-width: 960px)");
  var TABS = ["overview", "inbox", "users", "runs", "groups", "offers", "races", "system", "data", "log", "words", "settings", "more"];
  // מערכת's own tabs (the top bar marks מערכת for each).
  var SYSTEM_TABS = [["system", "מצב"], ["data", "נתונים וגרפים"], ["log", "יומן"], ["words", "מילים חסומות"], ["settings", "הגדרות"]];
  var IN_SYSTEM = { system: true, data: true, log: true, words: true, settings: true };
  // On a phone these live under "עוד".
  var UNDER_MORE = { runs: true, offers: true, races: true, system: true, data: true, log: true, words: true, settings: true };

  function setTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      var nav = a.getAttribute("data-nav");
      var on = nav === tab || (nav === "more" && UNDER_MORE[tab]) || (nav === "system" && IN_SYSTEM[tab]);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function route() {
    if (!sb || !state.signedIn) return;
    closeMenus();
    var m = location.hash.match(/^#(report|user|run|group)\/([0-9a-f-]{36})$/i);
    if (m && m[1] === "report") { setTab("inbox"); return renderOneReport(m[2]); }
    if (m && m[1] === "user") { setTab("users"); return renderUser(m[2]); }
    if (m && m[1] === "run") { setTab("runs"); return renderRun(m[2]); }
    if (m && m[1] === "group") { setTab("groups"); return renderGroup(m[2]); }
    var tab = location.hash.slice(1);
    // Links from before round 38 (the old tabs, the report mails).
    if (tab === "reports" || tab === "flags") { state.inboxFilter = tab; tab = "inbox"; }
    if (TABS.indexOf(tab) < 0) tab = "overview";
    if (tab === "more" && WIDE.matches) tab = "overview";
    setTab(tab);
    if (tab === "overview") return renderOverview();
    if (tab === "inbox") return renderInbox();
    if (tab === "users") return renderUsers();
    if (tab === "runs") return renderRuns();
    if (tab === "groups") return renderGroups();
    if (tab === "offers") return renderOffers();
    if (tab === "races") return renderRaces();
    if (tab === "system") return renderHealth();
    if (tab === "data") return renderData();
    if (tab === "words") return renderWords();
    if (tab === "settings") return renderSettings();
    if (tab === "more") return renderMore();
    return renderLog(true);
  }

  // The head of מערכת's pages: the title and its tabs (links, so each has its own address).
  function systemHead(active) {
    return [pageHead("מערכת"),
      h("nav", { class: "subtabs", "aria-label": "מערכת" }, SYSTEM_TABS.map(function (t) {
        return h("a", { href: "#" + t[0], "aria-current": t[0] === active ? "page" : null, text: t[1] });
      }))];
  }
  function go(h2) {
    if (location.hash === h2) route();
    else location.hash = h2;
    view().focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ reports ---

  function reloadOpen() {
    return Promise.all([rpc("admin_reports", { status: "open", max_rows: 200 }), rpc("admin_flags")]).then(function (res) {
      state.openReports = res[0] || [];
      state.flags = res[1] || [];
      updateCounts();
    });
  }

  // ------------------------------------------------------------------ inbox (צריך טיפול / משימות, round 38) ---
  // Open reports and open trust flags in one list, newest first (sketch B). "טופלו": reports already handled.
  var INBOX_FILTERS = [["all", "הכל"], ["reports", "דיווחים"], ["flags", "סימונים"], ["handled", "טופלו"]];

  function inboxHead() {
    var n = todoCount();
    var line = h("p", { class: "inbox-sub", text: "בודקים שהשאר עובד…" });
    healthLine(line);
    return h("div", { class: "inbox-head" },
      h("h1", { class: "inbox-title" }, n === 0 ? "אין מה לטפל כרגע"
        : n === 1 ? "דבר אחד מחכה לך" : [h("span", { class: "num", text: fmt(n) }), " דברים מחכים לך"]),
      line);
  }

  // "השאר עובד כשורה · Push 98%" or what needs a look (admin_health).
  function healthLine(el) {
    ovCall("admin_health").then(function (res) {
      if (!res.ok || !document.body.contains(el)) {
        if (document.body.contains(el)) el.textContent = "דיווח פתוח או משתמש/ת מסומן/ת מופיעים כאן, וגם מגיעים במייל.";
        return;
      }
      var rows = healthRows(res.data || {});
      var warn = rows.filter(function (r) { return r.status === "warn"; });
      el.textContent = "";
      if (!warn.length) {
        el.appendChild(h("span", { class: "ov-dot ok small", "aria-hidden": "true" }, svg("M6 12.5l4 4 8-9")));
        el.appendChild(document.createTextNode("השאר עובד כשורה · Push " + rows[0].value));
      } else {
        el.appendChild(h("span", { class: "ov-dot warn small", "aria-hidden": "true" }, svg("M12 6v7M12 17.5v.5")));
        el.appendChild(h("a", { href: "#system", text: warn.length === 1 ? "כדאי לבדוק: " + warn[0].title : warn.length + " דברים דורשים בדיקה" }));
      }
    });
  }

  function renderInbox() {
    var f = state.inboxFilter;
    var filters = h("div", { class: "filters", role: "group", "aria-label": "סינון" }, INBOX_FILTERS.map(function (x) {
      return h("button", { type: "button", "aria-pressed": f === x[0] ? "true" : "false",
        onclick: function () { state.inboxFilter = x[0]; renderInbox(); } }, x[1]);
    }));
    if (f === "handled") {
      loading("טוענים דיווחים שטופלו…");
      return rpc("admin_reports", { status: null, max_rows: 200 }).then(function (rows) {
        rows = (rows || []).filter(function (r) { return r.report_status !== "open"; });
        state.listReports = rows;
        show(inboxHead(), filters, rows.length ? h("div", { class: "inbox-list" }, rows.map(function (r) { return reportCard(r); }))
          : empty("עוד לא טופלו דיווחים", ""));
      }).catch(fail);
    }
    loading("בודקים מה מחכה…");
    return reloadOpen().then(function () {
      var items = [];
      if (f !== "flags") state.openReports.forEach(function (r) { items.push({ at: r.created_at, make: function () { return reportCard(r); } }); });
      if (f !== "reports") state.flags.forEach(function (x) { items.push({ at: x.flagged_at, make: function () { return flagCard(x); } }); });
      items.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      show(inboxHead(), filters,
        items.length ? h("div", { class: "inbox-list" }, items.map(function (i) { return i.make(); }))
          : empty(f === "flags" ? "אין סימונים פתוחים" : f === "reports" ? "אין דיווחים פתוחים" : "הכל טופל",
            f === "flags" ? "משתמש/ת מסומן/ת כשיש 3 מדווחים או 5 חוסמים ב־90 יום." : "דיווח חדש יופיע כאן, וגם יגיע במייל."),
        todayBox());
    }).catch(fail);
  }

  // "היום בקצרה": three numbers for today (admin_overview of one day).
  function todayBox() {
    var grid = h("div", { class: "today-grid" }, [0, 1, 2].map(function () { return h("div", { class: "ov-card skel-card", "aria-hidden": "true" }); }));
    var box = h("section", { class: "today", "aria-labelledby": "today-title" }, h("h2", { class: "ov-label", id: "today-title", text: "היום בקצרה" }), grid);
    ovCall("admin_overview", { days: 1 }).then(function (res) {
      if (!document.body.contains(grid)) return;
      if (!res.ok) { box.remove(); return; }
      var u = (res.data || {}).users || {}, r = (res.data || {}).runs || {};
      fill(grid, countCard("הרשמות", u.new_today, 0, "היום"), countCard("ריצות", r.today, 0, "מתוכננות להיום"),
        countCard("פעילים", u.active_today, 0, "היום"));
    });
    return box;
  }

  function renderOneReport(id) {
    var found = state.openReports.filter(function (r) { return r.id === id; })[0];
    var draw = function (r) {
      show(
        h("button", { type: "button", class: "btn text back", onclick: function () { go("#inbox"); } }, "→ לכל המשימות"),
        r ? reportCard(r, true) : empty("הדיווח לא נמצא", "אולי הוא נמחק יחד עם החשבון.")
      );
    };
    if (found) return draw(found);
    loading("טוענים את הדיווח…");
    rpc("admin_reports", { status: null, max_rows: 200 }).then(function (rows) {
      draw((rows || []).filter(function (r) { return r.id === id; })[0]);
    }).catch(fail);
  }

  function contextBox(r) {
    var c = r.context;
    if (!c || typeof c !== "object") return null;
    if (c.type === "message") {
      var removed = r.message_removed || c.removed;
      return h("div", { class: "context" },
        h("div", { class: "context-body" },
          h("span", { class: "context-label", text: "הודעה בצ׳אט" + (c.run_title ? " · " + c.run_title : "") }),
          h("span", { class: "context-text", text: "״" + (c.text || "") + "״" }),
          removed ? h("span", { class: "context-text removed", text: "ההודעה הוסרה מהצ׳אט" }) : null,
          c.chat !== "crew" && c.run_id ? h("a", { class: "btn text link", href: "#run/" + c.run_id, text: "לדף הריצה" }) : null));
    }
    if (c.type === "run") {
      var cover = null;
      if (c.cover_url && /^https:\/\//.test(c.cover_url)) cover = h("img", { class: "cover", src: c.cover_url, alt: "", loading: "lazy" });
      else if (c.cover_photo && /^[a-z]+-[a-z]+-[0-9]{2}$/.test(c.cover_photo)) {
        cover = h("img", { class: "cover", src: "../covers/thumb/" + c.cover_photo + ".jpg", alt: "", loading: "lazy" });
      } else cover = h("span", { class: "cover", "aria-hidden": "true" });
      return h("div", { class: "context" }, cover,
        h("div", { class: "context-body" },
          h("span", { class: "context-label", text: "הריצה" + (r.run_exists ? "" : " (כבר לא קיימת)") }),
          h("b", { text: c.display_title || c.title || "ריצה" }),
          c.caption ? h("span", { class: "context-text", text: c.caption }) : null,
          c.place ? h("span", { class: "note", text: c.place + (c.starts_at ? " · " + stamp(c.starts_at) : "") }) : null,
          r.run_exists && r.group_run_id ? h("a", { class: "btn text link", href: "#run/" + r.group_run_id, text: "לדף הריצה" }) : null));
    }
    return null;
  }

  function reportCard(r, highlight) {
    var p = r.reported || {};
    var suspended = !!p.suspended_at;
    var chips = [h("span", { class: "chip reason-" + r.reason, text: REASONS[r.reason] || r.reason })];
    chips.push(h("span", { class: "chip", text: r.open_reports <= 1 && r.report_status === "open" ? "דיווח ראשון" : r.open_reports + " דיווחים פתוחים" }));
    chips.push(h("span", { class: "chip", text: !r.blocks_90d ? "בלי חסימות" : r.blocks_90d === 1 ? "חסימה אחת" : r.blocks_90d + " חסימות" }));
    if (r.trust_flag && !r.trust_flag.reviewed_at) chips.push(h("span", { class: "chip suspended", text: "מסומן/ת" }));
    if (suspended) chips.push(h("span", { class: "chip suspended", text: "מושעה/ית" }));
    if (r.report_status !== "open") chips.push(h("span", { class: "chip status", text: STATUS[r.report_status] || r.report_status }));

    var by = "דווח ע״י " + ((r.reporter && r.reporter.name) || "משתמש/ת") + (r.details ? ": ״" + r.details + "״" : "");
    var actions = h("div", { class: "actions" });
    if (r.report_status === "open") {
      if (!suspended) {
        actions.appendChild(h("button", { type: "button", class: "btn ink", onclick: function () { suspend(p, r.id); } }, "השעיה"));
      }
      if (r.context && r.context.type === "message" && messageId(r) && !r.message_removed) {
        actions.appendChild(h("button", { type: "button", class: "btn outline", onclick: function () { removeMessage(r); } }, "הסרת ההודעה"));
      } else if (r.context && r.context.type === "run" && r.group_run_id && r.run_exists) {
        actions.appendChild(h("button", { type: "button", class: "btn outline", onclick: function () { removeRun(r); } }, "הסרת הריצה"));
      } else {
        actions.appendChild(h("button", { type: "button", class: "btn quiet", onclick: function () { go("#user/" + p.id); } }, "לכרטיס"));
      }
      actions.appendChild(h("button", { type: "button", class: "btn text", onclick: function () { dismiss(r); } }, "סגירה"));
    } else {
      actions.appendChild(h("button", { type: "button", class: "btn quiet", onclick: function () { go("#user/" + p.id); } }, "לכרטיס"));
      actions.appendChild(h("button", { type: "button", class: "btn text", onclick: function () { reopen(r); } }, "פתיחה מחדש"));
    }

    var kind = r.context && r.context.type === "message" ? "דיווח על הודעה" : r.context && r.context.type === "run" ? "דיווח על ריצה" : "דיווח על פרופיל";
    return h("article", { class: "card" + (highlight ? " highlight" : ""), "aria-label": "דיווח על " + nameAge(p) },
      h("span", { class: "card-kind report", text: kind }),
      h("a", { class: "who", href: "#user/" + p.id, "aria-label": "לכרטיס של " + nameAge(p) },
        avatar(p),
        h("span", { class: "who-text" }, h("span", { class: "who-name", text: nameAge(p) }), h("span", { class: "who-sub", text: personSub(p) })),
        h("span", { class: "when", text: ago(r.created_at) })),
      h("div", { class: "chips" }, chips),
      contextBox(r),
      h("p", { class: "by", text: by }),
      r.report_status !== "open" && r.action_note ? h("p", { class: "note", text: "הערה: " + r.action_note }) : null,
      actions);
  }

  function afterAction(message) {
    toast(message);
    reloadOpen().catch(function () { /* the counts refresh next time */ }).then(route);
  }

  function suspend(p, reportId) {
    confirmNote({
      title: "השעיית " + nameAge(p),
      text: "הריצות הקרובות שלו/ה יבוטלו והמשתתפים יקבלו התראה. הוא/היא יוצא/ת מריצות של אחרים, הפרופיל מוסתר מכולם " +
        "והדיווחים הפתוחים עליו/ה נסגרים. אפשר לבטל את ההשעיה מהפרופיל.",
      label: "סיבה (נשמרת ביומן, לא מוצגת למשתמש/ת)",
      ok: "השעיה",
      required: true
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_suspend", { target: p.id, reason: note }).then(function (res) {
        var n = (res && res.runs_cancelled) || 0;
        afterAction((p.name || "המשתמש/ת") + " הושעה/תה" + (n ? " · " + n + (n === 1 ? " ריצה בוטלה" : " ריצות בוטלו") : ""));
      }).catch(fail);
    });
  }

  // The reported line: a run chat line (message_id), or a crew chat line (v29: kept in the context only).
  function messageId(r) {
    if (r.message_id) return r.message_id;
    var c = r.context;
    return c && c.type === "message" && c.chat === "crew" && !c.removed ? c.message_id : null;
  }

  function removeMessage(r) {
    confirmNote({
      title: "הסרת ההודעה",
      text: "ההודעה תוחלף ב״ההודעה הוסרה״ אצל כולם. הטקסט נשמר ביומן.",
      label: "הערה קצרה",
      ok: "הסרה",
      required: true
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_remove_message", { message: messageId(r), note: note }).then(function () {
        afterAction("ההודעה הוסרה");
      }).catch(fail);
    });
  }

  function removeRun(r) {
    confirmNote({
      title: "הסרת הריצה",
      text: "הריצה נמחקת, והמשתתפים מקבלים ״הריצה בוטלה״ כמו בביטול רגיל. הפרטים נשמרים ביומן.",
      label: "הערה קצרה",
      ok: "הסרה",
      required: true
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_remove_run", { run: r.group_run_id, note: note }).then(function () {
        // From the run's own page there is nothing left to show: back to the runs.
        if (/^#run\//.test(location.hash)) {
          toast("הריצה הוסרה. המשתתפים קיבלו התראה.");
          return reloadOpen().catch(function () { /* the counts refresh next time */ }).then(function () { updateCounts(); go("#runs"); });
        }
        afterAction("הריצה הוסרה. המשתתפים קיבלו התראה.");
      }).catch(fail);
    });
  }

  function dismiss(r) {
    rpc("admin_set_report_status", { report: r.id, status: "dismissed", note: null }).then(function () {
      toast("הדיווח נסגר בלי פעולה", "ביטול", function () { reopen(r); });
      reloadOpen().then(route).catch(fail);
    }).catch(fail);
  }

  function reopen(r) {
    rpc("admin_set_report_status", { report: r.id, status: "open", note: null }).then(function () {
      afterAction("הדיווח נפתח מחדש");
    }).catch(fail);
  }

  // ------------------------------------------------------------------ flags ---

  // One open trust flag (in the inbox).
  function flagCard(f) {
    var p = f.person || { id: f.user_id };
    return h("article", { class: "card", "aria-label": "סימון של " + nameAge(p) },
      h("span", { class: "card-kind flag", text: "משתמש/ת מסומן/ת" }),
      h("a", { class: "who", href: "#user/" + f.user_id, "aria-label": "לכרטיס של " + nameAge(p) },
        avatar(p),
        h("span", { class: "who-text" }, h("span", { class: "who-name", text: nameAge(p) }), h("span", { class: "who-sub", text: personSub(p) })),
        h("span", { class: "when", text: ago(f.flagged_at) })),
      h("div", { class: "chips" },
        h("span", { class: "chip warn", text: f.reporters_90d + " מדווחים · " + f.blockers_90d + " חוסמים ב־90 יום" }),
        h("span", { class: "chip", text: f.open_reports + " דיווחים פתוחים" }),
        p.suspended_at ? h("span", { class: "chip suspended", text: "מושעה/ית" }) : null),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn ink", onclick: function () { go("#user/" + f.user_id); } }, "לכרטיס"),
        h("button", { type: "button", class: "btn quiet", onclick: function () { reviewFlag(f, p); } }, "סימון כנבדק")));
  }

  function reviewFlag(f, p) {
    confirmNote({ title: "סימון נבדק: " + nameAge(p), text: "סימון חדש יגיע אם יתווספו דיווחים או חסימות.", label: "הערה", ok: "נבדק", required: false })
      .then(function (note) {
        if (note === null) return;
        rpc("admin_mark_flag_reviewed", { target: f.user_id, note: note || null }).then(function () {
          afterAction("סומן כנבדק");
        }).catch(fail);
      });
  }

  // ------------------------------------------------------------------ words ---

  function renderWords() {
    loading("טוענים את רשימת המילים…");
    rpc("admin_list_words").then(function (rows) {
      state.words = rows || [];
      var input = h("input", { id: "new-word", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", maxlength: "60", required: true });
      var form = h("form", { class: "card add-word", novalidate: true, onsubmit: function (ev) { ev.preventDefault(); addWord(input); } },
        h("label", { class: "field", for: "new-word" }, h("span", { class: "sr-only", text: "מילה להוספה" }), input),
        h("button", { type: "submit", class: "btn ink" }, "הוספה"));
      input.setAttribute("placeholder", "מילה להוספה");
      var list = state.words.length
        ? h("div", { class: "list", role: "list" }, state.words.map(function (w) {
          return h("div", { class: "list-row", role: "listitem" },
            h("span", { class: "grow", text: w.word }),
            h("button", { type: "button", class: "icon-btn", "aria-label": "הסרת " + w.word, onclick: function () { removeWord(w.word); } }, svg("M6 6l12 12M18 6L6 18")));
        }))
        : empty("הרשימה ריקה", "מילה ברשימה נחסמת בשם, בתיאור ובכיתוב של ריצה, ומוחלפת ב-*** בצ׳אט.");
      show(systemHead("words"), form, h("p", { class: "note", text: "המילים נשמרות בצורה מנורמלת (בלי ניקוד, אותיות סופיות רגילות). נבדקות מילים שלמות." }), list);
    }).catch(fail);
  }

  function addWord(input) {
    var w = input.value.trim();
    if (!w) { input.focus(); return; }
    rpc("admin_add_word", { word: w }).then(function (stored) {
      toast("נוספה: " + stored);
      renderWords();
    }).catch(function (e) {
      if (code(e) === "invalid_argument") toast("מילה אחת, 2 עד 40 אותיות.");
      else fail(e);
    });
  }

  function removeWord(w) {
    rpc("admin_remove_word", { word: w }).then(function () {
      toast("הוסרה: " + w, "ביטול", function () {
        rpc("admin_add_word", { word: w }).then(renderWords).catch(fail);
      });
      renderWords();
    }).catch(fail);
  }

  // ------------------------------------------------------------------ log ---

  function logRow(l) {
    var what = (ACTIONS[l.action] || l.action) + (l.target_name ? " · " + l.target_name : "");
    if ((l.action === "word_added" || l.action === "word_removed") && l.context && l.context.word) what += " · " + l.context.word;
    if (l.action === "report_status" && l.context && l.context.status) what += " · " + (STATUS[l.context.status] || l.context.status);
    if (l.action === "rate_limit_set" && l.context) {
      what += " · " + limitLabel(l.context.action) + " " + windowLabel(l.context.per_seconds) + ": " +
        (l.context.previous === null || l.context.previous === undefined ? "—" : l.context.previous) + " ← " + l.context.max_count;
    }
    if (l.action === "users_viewed" && l.context && l.context.quick) {
      what = "חיפוש מהיר" + (typeof l.context.rows === "number" ? " · " + l.context.rows + " משתמשים בתוצאות" : "");
    } else if ((l.action === "users_viewed" || l.action === "newsletter_exported") && l.context && typeof l.context.rows === "number") {
      what += " · " + l.context.rows + " שורות";
    }
    if (l.action === "user_deleted" && l.context) {
      var rc = Number(l.context.runs_cancelled) || 0;
      what += " · " + (rc ? (rc === 1 ? "ריצה אחת בוטלה" : rc + " ריצות בוטלו") : "בלי ריצות קרובות");
    }
    if (l.action === "test_push" && l.context) {
      what += Number(l.context.devices) ? " · " + (Number(l.context.devices) === 1 ? "מכשיר אחד" : l.context.devices + " מכשירים") : " · אין מכשיר";
    }
    if ((l.action === "offer_save" || l.action === "offer_status") && l.context) {
      var offerStatus = { draft: "טיוטה", published: "פורסם", archived: "ארכיון" };
      if (l.action === "offer_save") what += " · " + (OFFER_KIND[l.context.kind] || "") + " · " + (offerStatus[l.context.status] || l.context.status || "");
      else what += " · " + (offerStatus[l.context.from] || l.context.from) + " ← " + (offerStatus[l.context.to] || l.context.to);
      if (Number(l.context.pushes)) what += " · " + (Number(l.context.pushes) === 1 ? "התראה אחת" : fmt(l.context.pushes) + " התראות");
    }
    if (l.action === "app_config_set" && l.context) {
      what += " · " + (CONFIG[l.context.key] || l.context.key) + ": " + configText(l.context.previous) + " ← " + configText(l.context.value);
    }
    return h("div", { class: "log-row" },
      h("span", { class: "log-main", text: what }),
      l.note ? h("span", { class: "log-note", text: l.note }) : null,
      l.context && l.context.text ? h("span", { class: "log-note", text: "״" + l.context.text + "״" }) : null,
      h("span", { class: "log-when", text: ago(l.created_at) + (l.admin_email ? " · " + l.admin_email : "") }),
      l.target_user && l.target_name && !location.hash.match(/^#user\//)
        ? h("button", { type: "button", class: "btn text link", onclick: function () { go("#user/" + l.target_user); } },
          "לכרטיס של " + l.target_name)
        : null);
  }

  function renderLog(fresh) {
    if (fresh) { state.log = []; state.logDone = false; loading("טוענים את היומן…"); }
    var before = state.log.length ? state.log[state.log.length - 1].created_at : null;
    rpc("admin_log", { max_rows: 50, before: before }).then(function (rows) {
      rows = rows || [];
      state.log = state.log.concat(rows);
      state.logDone = rows.length < 50;
      if (!state.log.length) return show(systemHead("log"), empty("עוד אין פעולות", "כל פעולה שלך נשמרת כאן."));
      show(systemHead("log"), h("div", { class: "list" }, state.log.map(logRow)),
        state.logDone ? null : h("button", { type: "button", class: "btn quiet", onclick: function () { renderLog(false); } }, "עוד"));
    }).catch(fail);
  }

  // ------------------------------------------------------------------ settings ---

  function limitLabel(a) {
    for (var i = 0; i < LIMITS.length; i++) if (LIMITS[i][0] === a) return LIMITS[i][1];
    return a || "";
  }
  // 60 → "בדקה", 7200 → "ב־2 שעות".
  function windowLabel(s) {
    s = Number(s);
    if (s === 60) return "בדקה";
    if (s === 3600) return "בשעה";
    if (s === 86400) return "ביום";
    if (s % 86400 === 0) return "ב־" + s / 86400 + " ימים";
    if (s % 3600 === 0) return "ב־" + s / 3600 + " שעות";
    if (s % 60 === 0) return "ב־" + s / 60 + " דקות";
    return "ב־" + s + " שניות";
  }
  function configText(v) {
    if (v === null || v === undefined) return "—";
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  // A whole number 0…max from an input, or null.
  function wholeNumber(input, max) {
    var t = input.value.trim();
    if (!/^[0-9]{1,10}$/.test(t)) return null;
    var n = Number(t);
    return n <= max ? n : null;
  }
  function numberInput(id, value, label) {
    return h("input", { id: id, class: "num-input", type: "text", inputmode: "numeric", pattern: "[0-9]*",
      autocomplete: "off", dir: "ltr", maxlength: "10", value: value === null || value === undefined ? "" : String(value),
      "aria-label": label });
  }
  function settingsForm(title, sub, rows, onSave) {
    var err = h("p", { class: "form-error", role: "alert", hidden: true });
    var btn = h("button", { type: "submit", class: "btn ink" }, "שמירה");
    var form = h("form", { class: "card settings", novalidate: true, onsubmit: function (ev) {
      ev.preventDefault();
      err.hidden = true;
      onSave(btn, function (text) { err.textContent = text; err.hidden = false; });
    } },
      h("div", { class: "settings-head" }, h("h2", { class: "settings-title", text: title }), sub ? h("p", { class: "note", text: sub }) : null),
      rows, err, h("div", { class: "actions" }, btn));
    return form;
  }

  // Saves the changed values one by one (each RPC logs its own change). done(n) with how many were saved.
  function saveAll(calls, btn, done) {
    btn.disabled = true;
    var n = 0;
    var next = function () {
      if (!calls.length) { btn.disabled = false; return done(n); }
      var c = calls.shift();
      rpc(c[0], c[1]).then(function () { n++; next(); }).catch(function (e) {
        btn.disabled = false;
        if (n) toast(n === 1 ? "נשמר שינוי אחד, השאר לא" : "נשמרו " + n + " שינויים, השאר לא");
        fail(e);
        renderSettings();
      });
    };
    next();
  }

  function renderSettings() {
    loading("טוענים הגדרות…");
    rpc("admin_get_settings").then(function (s) {
      var limits = (s && s.rate_limits) || [];
      var config = {};
      ((s && s.app_config) || []).forEach(function (c) { config[c.key] = c.value; });

      // Rate limits: one group per action, one row per window.
      var limitInputs = [];
      var groups = LIMITS.map(function (a) {
        var rows = limits.filter(function (l) { return l.action === a[0]; });
        if (!rows.length) return null;
        return h("div", { class: "setting-group" },
          h("span", { class: "setting-label", text: a[1] }),
          rows.map(function (l) {
            var id = "limit-" + l.action + "-" + l.per_seconds;
            var input = numberInput(id, l.max_count, a[1] + " " + windowLabel(l.per_seconds));
            limitInputs.push({ row: l, input: input });
            return h("div", { class: "setting-row" },
              h("label", { class: "grow", for: id, text: windowLabel(l.per_seconds) }),
              input);
          }));
      });
      var limitsForm = settingsForm("מגבלות קצב",
        "כמה פעולות מותר לכל משתמש/ת בחלון זמן. מעבר לזה הפעולה נדחית (״רגע, הרבה פעולות בזמן קצר״). 0 = בלי מגבלה בחלון הזה. מנהלים פטורים.",
        groups,
        function (btn, showError) {
          var calls = [];
          for (var i = 0; i < limitInputs.length; i++) {
            var li = limitInputs[i];
            var n = wholeNumber(li.input, 100000);
            if (n === null) {
              li.input.focus();
              return showError("מספר שלם בין 0 ל־100,000.");
            }
            if (n !== li.row.max_count) {
              calls.push(["admin_set_rate_limit", { action: li.row.action, max_count: n, per_seconds: li.row.per_seconds }]);
            }
          }
          if (!calls.length) return toast("אין שינויים");
          saveAll(calls, btn, function (n) { toast(n === 1 ? "נשמר" : "נשמרו " + n + " שינויים"); renderSettings(); });
        });

      // App versions: per platform, min and latest build numbers and the store link.
      var cfgInputs = [];
      var platform = function (p, name, hint) {
        var minKey = "min_version_" + p, lastKey = "latest_version_" + p, urlKey = "store_url_" + p;
        var minIn = numberInput("cfg-" + minKey, config[minKey], name + " גרסה מינימלית");
        var lastIn = numberInput("cfg-" + lastKey, config[lastKey], name + " גרסה אחרונה");
        var urlIn = h("input", { id: "cfg-" + urlKey, class: "url-input", type: "url", inputmode: "url", dir: "ltr",
          autocomplete: "off", spellcheck: "false", maxlength: "500", value: typeof config[urlKey] === "string" ? config[urlKey] : "" });
        cfgInputs.push({ key: minKey, kind: "num", input: minIn }, { key: lastKey, kind: "num", input: lastIn },
          { key: urlKey, kind: "url", input: urlIn });
        var placeholder = typeof config[urlKey] === "string" && /id0{6,}/.test(config[urlKey]);
        return h("div", { class: "setting-group" },
          h("span", { class: "setting-label", text: name }),
          h("div", { class: "setting-row" },
            h("label", { class: "grow", for: minIn.id }, "גרסה מינימלית", h("small", { text: "מתחתיה חובה לעדכן" })),
            minIn),
          h("div", { class: "setting-row" },
            h("label", { class: "grow", for: lastIn.id }, "גרסה אחרונה", h("small", { text: "מתחתיה מציעים לעדכן" })),
            lastIn),
          h("label", { class: "field", for: urlIn.id },
            h("span", { class: "label" }, "קישור לחנות", placeholder ? h("span", { class: "chip warn", text: "זמני" }) : null),
            urlIn),
          h("p", { class: "note", text: hint }));
      };
      var versionsForm = settingsForm("גרסאות האפליקציה",
        "מספרי build. האפליקציה בודקת בכל פתיחה: מתחת למינימלית — מסך עדכון חובה; מתחת לאחרונה — הצעה שקטה לעדכן.",
        [platform("ios", "iPhone", "מספר ה־build ב־App Store Connect (CFBundleVersion)."),
          platform("android", "Android", "ה־versionCode ב־Play Console.")],
        function (btn, showError) {
          var calls = [];
          for (var i = 0; i < cfgInputs.length; i++) {
            var c = cfgInputs[i];
            var v;
            if (c.kind === "num") {
              v = wholeNumber(c.input, 2147483647);
              if (v === null) { c.input.focus(); return showError("מספר build הוא מספר שלם, 0 ומעלה."); }
            } else {
              v = c.input.value.trim();
              if (!/^https:\/\/\S+$/.test(v)) { c.input.focus(); return showError("קישור מלא שמתחיל ב־https://"); }
            }
            if (v !== config[c.key]) calls.push(["admin_set_app_config", { key: c.key, value: v }]);
          }
          var minI = wholeNumber($("cfg-min_version_ios"), 2147483647), lastI = wholeNumber($("cfg-latest_version_ios"), 2147483647);
          var minA = wholeNumber($("cfg-min_version_android"), 2147483647), lastA = wholeNumber($("cfg-latest_version_android"), 2147483647);
          if (minI > lastI || minA > lastA) return showError("הגרסה המינימלית גבוהה מהאחרונה. כדאי לעדכן קודם את האחרונה.");
          if (!calls.length) return toast("אין שינויים");
          saveAll(calls, btn, function (n) { toast(n === 1 ? "נשמר" : "נשמרו " + n + " שינויים"); renderSettings(); });
        });

      show(systemHead("settings"), limitsForm, versionsForm, accountCard());
    }).catch(fail);
  }

  // ------------------------------------------------------------------ overview (מבט על, v27) ---
  // Counts only, no people: admin_overview(days), admin_health(), admin_metrics(days). Each part loads on its own and
  // shows its own skeleton, empty state or retry. Before v27 is applied the RPCs are missing: one calm note instead.

  var SVG_NS = "http://www.w3.org/2000/svg";
  var CRON_NAMES = {
    "lets-run-push-sweep": "שליחת התראות",
    "lets-run-push-reminders": "תזכורות לריצות",
    "lets-run-moderation-sweep": "מיילים על דיווחים",
    "lets-run-daily": "ניקוי וסיכום יומי"
  };
  var ov = { token: 0, tab: "", ui: null, healthAt: null, ticker: null, missing: false };

  // "1,240" / "4.2" / "—".
  function fmt(n, digits) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "—";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: digits === undefined ? 0 : digits });
  }
  function num(n, digits, cls) { return h("span", { class: "num" + (cls ? " " + cls : ""), dir: "ltr", text: fmt(n, digits) }); }
  // "16.9" from "2026-09-16".
  function shortDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? Number(m[3]) + "." + Number(m[2]) : "";
  }
  // A week from its first day: "13–19.9" or "28.9–4.10".
  function weekLabel(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    if (!m) return "";
    var a = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var b = new Date(a.getTime() + 6 * DAY);
    var am = a.getUTCMonth() + 1, bm = b.getUTCMonth() + 1;
    return am === bm ? a.getUTCDate() + "–" + b.getUTCDate() + "." + bm : a.getUTCDate() + "." + am + "–" + b.getUTCDate() + "." + bm;
  }
  // 1500 s → "25 דק׳", 7200 → "שעתיים", 259200 → "3 ימים".
  function duration(s) {
    s = Number(s);
    if (!isFinite(s) || s < 60) return "פחות מדקה";
    if (s < 3600) return Math.round(s / 60) + " דק׳";
    var hrs = Math.round(s / 3600);
    if (s < 86400) return hrs === 1 ? "שעה" : hrs === 2 ? "שעתיים" : hrs + " שעות";
    var d = Math.round(s / 86400);
    return d === 1 ? "יום" : d === 2 ? "יומיים" : d + " ימים";
  }
  function plural(n, one, many) { return Number(n) === 1 ? one : fmt(n) + " " + many; }
  // { value, status } items from admin_health.
  function val(item) { return item && typeof item === "object" && item.value !== undefined ? item.value : null; }
  function worst(group) {
    if (!group || typeof group !== "object") return "na";
    var warn = Object.keys(group).some(function (k) { return group[k] && group[k].status === "warn"; });
    return warn ? "warn" : "ok";
  }
  function missingRpc(e) {
    if (!e) return false;
    if (e.code === "PGRST202" || e.code === "42883") return true;
    var m = String(e.message || "") + " " + String(e.details || "") + " " + String(e.hint || "");
    return /could not find the function|schema cache|function [^ ]+ does not exist/i.test(m);
  }

  function skeleton(text, cls) {
    return h("div", { class: "skel" + (cls ? " " + cls : ""), "aria-busy": "true" },
      h("span", { class: "dot", "aria-hidden": "true" }), h("span", { text: text }));
  }
  function retryBox(text, again) {
    return h("div", { class: "ov-error", role: "alert" },
      h("span", { text: text }),
      h("button", { type: "button", class: "btn quiet", onclick: again }, "לנסות שוב"));
  }
  function emptyNote(text, icon, title) {
    return h("div", { class: "ov-empty" }, svg(icon || "M4 19h16M7 15v-3M12 15V8M17 15v-5"), h("b", { text: title || "עוד אין מספיק נתונים" }),
      text ? h("span", { text: text }) : null);
  }
  function fill(el) {
    el.textContent = "";
    for (var i = 1; i < arguments.length; i++) append(el, arguments[i]);
    el.removeAttribute("aria-busy");
  }

  // Runs an RPC for the overview; resolves { ok, data } or { ok: false, error } (never rejects).
  function ovCall(name, args) {
    return rpc(name, args).then(function (d) { return { ok: true, data: d }; }, function (e) { return { ok: false, error: e }; });
  }
  // false when the result should not be drawn (another tab, a newer load, or an access / version problem handled here).
  function ovUsable(token, res) {
    if (token !== ov.token || state.tab !== ov.tab || ov.missing) return false;
    if (res.ok) return true;
    var c = code(res.error);
    if (missingRpc(res.error)) { ov.missing = true; showNotYet(); return false; }
    if (c === "not_admin" || c === "not_authenticated" || c === "session") { ov.token++; fail(res.error); return false; }
    return true;
  }

  function showNotYet() {
    stopTicker();
    show(h("div", { class: "card empty" }, svg("M12 8v4M12 16h.01M12 3a9 9 0 100 18 9 9 0 000-18z"),
      h("b", { text: "השרת עוד לא עודכן לגרסה הזו" }),
      h("span", { text: "העמוד הזה יופיע אחרי שעדכון v27 יורץ ב־Supabase. שאר הלשוניות עובדות כרגיל." })));
  }

  // ---- מבט על (round 58, direction B): six tiles, one per area. Each loads on its own and links to its page.

  var TILE_ICONS = {
    users: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2",
    runs: "M14 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 21l3-6 3 2v4M6.5 11.5l3-3.5 4 1.5 2.5 3h3M11 15l2-5",
    groups: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.6-3.2 2.6-5 5-5s4.4 1.8 5 5M11 20c.6-3.2 2.6-5 5-5s4.4 1.8 5 5",
    offers: "M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 8v10",
    safety: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
    system: "M3 12h4l2-5 4 10 2-5h6"
  };

  function tile(key, title) {
    var el = h("section", { class: "tile", "aria-labelledby": "tile-" + key, "aria-busy": "true" });
    el.dataset.title = title;
    fill(el, tileHead(key, title), h("div", { class: "tile-skel", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h("span", { class: "sr-only", text: "טוענים…" }));
    el.setAttribute("aria-busy", "true");
    return el;
  }
  function tileHead(key, title) {
    return h("h2", { class: "tile-title", id: "tile-" + key }, h("span", { class: "tile-icon" }, svg(TILE_ICONS[key])), title);
  }
  // o: { big, bigClass, bigSub, visual, lines: [[label, value]], href, link }
  function drawTile(el, key, o) {
    fill(el, tileHead(key, el.dataset.title),
      h("div", { class: "tile-big" }, typeof o.big === "string"
        ? h("span", { class: "num tile-value" + (o.bigClass ? " " + o.bigClass : ""), dir: "ltr", text: o.big })
        : num(o.big, o.digits, "tile-value" + (o.bigClass ? " " + o.bigClass : "")),
        o.bigSub ? h("span", { class: "tile-big-sub", text: o.bigSub }) : null),
      o.visual || null,
      h("dl", { class: "tile-lines" }, (o.lines || []).map(function (l) {
        return h("div", null, h("dt", { text: l[0] }), h("dd", null, l[1] === null || l[1] === undefined ? "—" : l[1]));
      })),
      h("a", { class: "btn quiet small tile-go", href: o.href, text: o.link }));
  }
  function tileProblem(el, key, res, again, version) {
    fill(el, tileHead(key, el.dataset.title), missingRpc(res.error)
      ? h("p", { class: "note", text: "יופיע אחרי עדכון " + version + " בשרת." })
      : retryBox("לא הצלחנו לטעון.", again));
  }
  // A small line of a daily series, oldest on the right (RTL), today on the left.
  function sparkline(vals, label) {
    if (!vals.length || Math.max.apply(null, vals) === 0) return null;
    var W = 200, H = 36, max = Math.max.apply(null, vals), n = vals.length;
    var pts = vals.map(function (v, i) {
      var x = n === 1 ? W / 2 : W - (i * W) / (n - 1);
      return x.toFixed(1) + " " + (H - 2 - (v / max) * (H - 4)).toFixed(1);
    });
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 " + W + " " + H);
    s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("class", "spark");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", label);
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", "M" + pts.join(" L"));
    p.setAttribute("vector-effect", "non-scaling-stroke");
    s.appendChild(p);
    return s;
  }
  // One part of a two-part bar. The page's CSP allows no style attributes, so the share is set through the CSSOM.
  function splitPart(cls, n) {
    if (!n) return null;
    var el = h("span", { class: cls });
    el.style.flex = String(n);
    return el;
  }
  function inDays(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (isNaN(ms)) return "";
    var d = Math.ceil(ms / DAY);
    return d <= 0 ? "היום" : d === 1 ? "מחר" : "בעוד " + d + " ימים";
  }

  function renderOverview() {
    ov.token++;
    ov.tab = "overview";
    var ui = ov.ui = {
      status: h("a", { class: "ov-line", href: "#system" }, h("span", { class: "ov-dot na", "aria-hidden": "true" }), "בודקים שהכל עובד…"),
      range: h("div", { class: "filters", role: "group", "aria-label": "טווח ימים" }),
      users: tile("users", "משתמשים"), runs: tile("runs", "ריצות"), groups: tile("groups", "קבוצות"),
      offers: tile("offers", "הטבות ואירועים"), safety: tile("safety", "בטיחות"), system: tile("system", "מערכת")
    };
    show(h("div", { class: "page-head ov-head" }, h("h1", { class: "page-title", text: "מבט על" }), ui.range, ui.status),
      h("div", { class: "tiles" }, ui.users, ui.runs, ui.groups, ui.offers, ui.safety, ui.system));
    drawRange();
    loadTiles();
  }

  function loadTiles() {
    loadPeopleTiles();
    loadGroupsTile();
    loadOffersTile();
    loadSafetyTile();
    loadSystemTile();
  }
  function tileLive(token) { return token === ov.token && state.tab === "overview"; }

  // משתמשים + ריצות: admin_overview (by range) and the platforms (admin_push_summary).
  function loadPeopleTiles() {
    var ui = ov.ui, token = ov.token, days = state.range;
    Promise.all([ovCall("admin_overview", { days: days }), ovCall("admin_push_summary")]).then(function (r) {
      if (!tileLive(token) || days !== state.range) return;
      var res = r[0], push = r[1].ok ? r[1].data || {} : null;
      if (!res.ok) {
        tileProblem(ui.users, "users", res, loadPeopleTiles, "v27");
        tileProblem(ui.runs, "runs", res, loadPeopleTiles, "v27");
        return;
      }
      var d = res.data || {}, u = d.users || {}, g = d.runs || {};
      var series = Array.isArray(d.series) ? d.series : [];
      var ios = push ? Number(push.ios_users) || 0 : 0, android = push ? Number(push.android_users) || 0 : 0;
      var share = ios + android ? Math.round((ios / (ios + android)) * 100) + "% / " + (100 - Math.round((ios / (ios + android)) * 100)) + "%" : null;
      drawTile(ui.users, "users", {
        big: u.total, bigSub: "+" + fmt(u.new_in_range) + " ב־" + days + " ימים",
        visual: sparkline(series.map(function (x) { return Number(x && x.new_users) || 0; }), "הרשמות לפי יום, " + days + " ימים"),
        lines: [["פעילים ב־7 ימים", num(u.active_7d)], ["פעילים היום", num(u.active_today)],
          ["iPhone / Android", share ? h("span", { class: "num", dir: "ltr", text: share }) : null]],
        href: "#users", link: "לטבלת המשתמשים" });
      var avg = g.avg_participants_in_range;
      drawTile(ui.runs, "runs", {
        big: g.today, bigSub: "היום",
        visual: sparkline(series.map(function (x) { return Number(x && x.runs_created) || 0; }), "ריצות שנוצרו לפי יום, " + days + " ימים"),
        lines: [["קרובות", num(g.upcoming_total)], ["קרו עם משתתפים", num(g.happened_in_range)],
          ["ממוצע משתתפים", avg === null || avg === undefined ? null : num(avg, 1)]],
        href: "#runs", link: "לכל הריצות" });
    });
  }

  function loadGroupsTile() {
    var ui = ov.ui, token = ov.token;
    ovCall("admin_crews_summary").then(function (res) {
      if (!tileLive(token)) return;
      if (!res.ok) return tileProblem(ui.groups, "groups", res, loadGroupsTile, "v57");
      var d = res.data || {};
      var pub = Number(d.public) || 0, priv = Number(d.private) || 0;
      var bar = pub + priv ? h("div", { class: "tile-split" },
        h("div", { class: "split-bar", role: "img", "aria-label": fmt(pub) + " ציבוריות, " + fmt(priv) + " פרטיות" },
          splitPart("split-a", pub), splitPart("split-b", priv)),
        h("div", { class: "split-keys", "aria-hidden": "true" },
          h("span", null, h("i", { class: "split-a" }), num(pub), " ציבוריות"),
          h("span", null, h("i", { class: "split-b" }), num(priv), " פרטיות"))) : null;
      drawTile(ui.groups, "groups", {
        big: d.open, bigSub: "פתוחות", visual: bar,
        lines: [["עם ריצה קבועה", num(d.with_schedule)], ["בקשות הצטרפות ממתינות", num(d.pending_requests)],
          ["שקטות 14 יום", num(d.quiet_14d)]],
        href: "#groups", link: "לכל הקבוצות" });
    });
  }

  function loadOffersTile() {
    var ui = ov.ui, token = ov.token;
    ovCall("admin_offers").then(function (res) {
      if (!tileLive(token)) return;
      if (!res.ok) return tileProblem(ui.offers, "offers", res, loadOffersTile, "v56");
      var live = (res.data || []).filter(function (o) { return o.state === "live"; });
      var sum = function (k) { return live.reduce(function (a, o) { return a + (Number(o[k]) || 0); }, 0); };
      var next = live.filter(function (o) { return o.ends_at; }).sort(function (a, b) { return new Date(a.ends_at) - new Date(b.ends_at); })[0];
      drawTile(ui.offers, "offers", {
        big: live.length, bigSub: "באוויר",
        lines: [["צפיות", num(sum("seen_count"))], ["קודים שהועתקו", num(sum("copy_count"))],
          ["נגמרת הכי קרוב", next ? inDays(next.ends_at) : live.length ? "בלי תאריך סיום" : "אין באוויר"]],
        href: "#offers", link: live.length ? "להטבות" : "+ הטבה חדשה" });
    });
  }

  function loadSafetyTile() {
    var ui = ov.ui, token = ov.token;
    reloadOpen().then(function () {
      if (!tileLive(token)) return;
      var msg = state.openReports.filter(function (r) { return r.context && r.context.type === "message"; }).length;
      var oldest = state.openReports.reduce(function (a, r) { return !a || new Date(r.created_at) < new Date(a) ? r.created_at : a; }, null);
      var n = todoCount();
      drawTile(ui.safety, "safety", {
        big: n, bigClass: n ? "hot" : "", bigSub: n ? "פתוחים" : "הכל טופל",
        lines: [["דיווחים על הודעות", num(msg)], ["דיווחים על פרופילים וריצות", num(state.openReports.length - msg)],
          ["מסומנים", num(state.flags.length)], ["הוותיק פתוח", oldest ? ago(oldest) : null]],
        href: "#inbox", link: "לתיבת המשימות" });
    }, function (e) {
      if (tileLive(token)) tileProblem(ui.safety, "safety", { error: e }, loadSafetyTile, "v25");
    });
  }

  function loadSystemTile() {
    var ui = ov.ui, token = ov.token;
    ovCall("admin_health").then(function (res) {
      if (!tileLive(token)) return;
      if (!res.ok) {
        fill(ui.status, h("span", { class: "ov-dot na", "aria-hidden": "true" }), "לא הצלחנו לבדוק");
        return tileProblem(ui.system, "system", res, loadSystemTile, "v27");
      }
      var rows = healthRows(res.data || {});
      var by = {};
      rows.forEach(function (r) { by[r.title] = r; });
      var warn = rows.filter(function (r) { return r.status === "warn"; });
      ui.status.className = "ov-line " + (warn.length ? "warn" : "ok");
      fill(ui.status, statusMark(warn.length ? "warn" : "ok"),
        !warn.length ? "כל המערכות תקינות" : warn.length === 1 ? "לבדיקה: " + warn[0].title : warn.length + " דברים לבדיקה");
      var push = by["התראות Push"] || {}, cron = by["משימות מתוזמנות"] || {}, mail = by["מיילים על דיווחים"] || {}, photo = by["בדיקות תמונה"] || {};
      drawTile(ui.system, "system", {
        big: push.value && push.value !== "—" ? push.value : "—", bigClass: push.status === "warn" ? "hot" : "", bigSub: "פוש נמסר (24 ש׳)",
        lines: [["משימות מתוזמנות", h("span", { class: "num", dir: "ltr", text: cron.value || "—" })],
          ["מיילים ממתינים", num(mail.value)], ["בדיקות תמונה (24 ש׳)", num(photo.value)]],
        href: "#system", link: "למצב המערכת" });
    });
  }

  // ---- מערכת › מצב: the status line and "האם הכל עובד" (round 38's rows, moved here in round 58).

  function renderHealth() {
    ov.token++;
    ov.tab = "system";
    ov.missing = false;
    ov.healthAt = null;
    var ui = ov.ui = {
      status: h("section", { class: "ov-status", "aria-live": "polite" }),
      health: h("section", { class: "list ov-health", "aria-labelledby": "ov-health-title" }),
      push: h("div", { class: "list-row ov-row" })
    };
    show(systemHead("system"), ui.status,
      h("h2", { class: "ov-label", id: "ov-health-title", text: "האם הכל עובד (24 שעות אחרונות)" }), ui.health);
    loadHealth();
    loadPush();
  }

  // ---- מערכת › נתונים וגרפים: the numbers, the charts and the returning-users table, by range.

  function renderData() {
    ov.token++;
    ov.tab = "data";
    ov.missing = false;
    var ui = ov.ui = {
      range: h("div", { class: "filters", role: "group", "aria-label": "טווח ימים" }),
      counts: h("section", { class: "ov-grid kpis", "aria-label": "מספרים" }),
      signups: h("section", { class: "card ov-chart", "aria-labelledby": "ov-signups-title" }),
      chart: h("section", { class: "card ov-chart", "aria-labelledby": "ov-chart-title" }),
      retention: h("section", { class: "card ov-ret", "aria-labelledby": "ov-ret-title" })
    };
    show(systemHead("data"), ui.range, ui.counts,
      h("div", { class: "ov-cols" }, ui.signups, ui.chart),
      ui.retention);
    drawRange();
    loadRange();
  }

  // ---- push devices (admin_push_summary): one more row under "האם הכל עובד"

  function loadPush() {
    var ui = ov.ui, token = ov.token;
    fill(ui.push, statusMark("na"), h("span", { class: "grow" }, h("span", { class: "ov-row-title", text: "מכשירים עם פוש" }),
      h("span", { class: "ov-row-detail", text: "סופרים מכשירים…" })), h("span", { class: "num ov-row-value", text: "—" }));
    ovCall("admin_push_summary").then(function (res) {
      if (token !== ov.token || !res.ok) {
        if (token === ov.token && missingRpc(res.error)) {
          fill(ui.push, statusMark("na"), h("span", { class: "grow" }, h("span", { class: "ov-row-title", text: "מכשירים עם פוש" }),
            h("span", { class: "ov-row-detail", text: "יופיע אחרי עדכון v36 בשרת." })), h("span", { class: "num ov-row-value", text: "—" }));
        }
        return;
      }
      var d = res.data || {}, o = d.outbox_7d || {};
      var people = Number(d.users) || 0, withTok = Number(d.users_with_token) || 0;
      var pct = people ? Math.round((withTok / people) * 100) : 0;
      var bits = [PLATFORMS.ios + " " + fmt(d.ios_users), PLATFORMS.android + " " + fmt(d.android_users),
        fmt(d.users_without_token) + " בלי מכשיר"];
      var week = "השבוע: " + fmt(o.delivered) + " נמסרו" + (Number(o.no_tokens) ? " · " + fmt(o.no_tokens) + " בלי מכשיר" : "") +
        (Number(o.failed) ? " · " + fmt(o.failed) + " נכשלו" : "");
      fill(ui.push, statusMark(withTok ? (pct < 40 ? "warn" : "ok") : "warn"),
        h("span", { class: "grow" }, h("span", { class: "ov-row-title", text: "משתמשים עם פוש" }),
          h("span", { class: "ov-row-detail", text: bits.join(" · ") }), h("span", { class: "ov-row-detail", text: week })),
        h("span", { class: "num ov-row-value", dir: "ltr", text: pct + "%" }));
    });
  }

  // Sign-ups per day (the overview's series), the newest day in volt.
  function drawSignups(d) {
    var ui = ov.ui;
    var series = Array.isArray(d.series) ? d.series : [];
    var title = h("h2", { class: "ov-card-title", id: "ov-signups-title", text: "הרשמות לפי יום" });
    var vals = series.map(function (x) { return Number(x && x.new_users) || 0; });
    var max = Math.max.apply(null, vals.concat([0]));
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    if (!series.length || max === 0) return fill(ui.signups, title, emptyNote("כשיירשמו משתמשים בטווח הזה, הם יופיעו כאן."));
    var n = series.length, W = 600, H = 120, slot = W / n, gap = Math.max(slot * 0.28, 0.8), bw = slot - gap;
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 " + W + " " + H);
    s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("class", "ov-bars");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", "גרף עמודות, " + n + " ימים: " + sum + " הרשמות. הפירוט בטבלה שאחרי הגרף.");
    for (var i = 0; i < n; i++) {
      if (!vals[i]) continue;
      var hgt = Math.max((vals[i] / max) * (H - 2), 1.5);
      var r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", (W - (i + 1) * slot + gap / 2).toFixed(2)); r.setAttribute("width", bw.toFixed(2));
      r.setAttribute("y", (H - hgt).toFixed(2)); r.setAttribute("height", hgt.toFixed(2));
      r.setAttribute("class", i === n - 1 ? "bar-b" : "bar-a");
      s.appendChild(r);
    }
    fill(ui.signups,
      h("div", { class: "card-head" }, title, h("span", { class: "head-num" }, num(sum), " בטווח")),
      h("div", { class: "ov-plot" }, h("span", { class: "ov-max", "aria-hidden": "true" }, num(max)), s,
        h("div", { class: "ov-axis", "aria-hidden": "true" }, h("span", { class: "num", dir: "ltr", text: shortDay(series[0].day) }), h("span", { text: "היום" }))),
      h("table", { class: "sr-only" }, h("caption", { text: "הרשמות לפי יום" }),
        h("tbody", null, series.map(function (row, k) { return h("tr", null, h("th", { scope: "row", text: shortDay(row.day) }), h("td", { text: String(vals[k]) })); }))));
  }

  function drawRange() {
    var ui = ov.ui;
    ui.range.textContent = "";
    RANGES.forEach(function (n) {
      ui.range.appendChild(h("button", {
        type: "button",
        "aria-pressed": state.range === n ? "true" : "false",
        onclick: function () {
          if (state.range === n) return;
          state.range = n;
          saveRange(n);
          drawRange();
          if (ov.tab === "overview") loadPeopleTiles();
          else loadRange();
        }
      }, h("span", { class: "num", dir: "ltr", text: String(n) }), " ימים"));
    });
  }

  // ---- status line + "האם הכל עובד" (admin_health)

  function stopTicker() { if (ov.ticker) { clearInterval(ov.ticker); ov.ticker = null; } }
  function updatedText() {
    if (!ov.healthAt) return "";
    var ms = Date.now() - ov.healthAt;
    if (ms < MIN) return "עודכן עכשיו";
    if (ms < HOUR) return "עודכן לפני " + Math.round(ms / MIN) + " דק׳";
    return "עודכן " + ago(new Date(ov.healthAt).toISOString());
  }

  function loadHealth() {
    var ui = ov.ui, token = ov.token;
    stopTicker();
    fill(ui.status, h("span", { class: "ov-dot na", "aria-hidden": "true" }),
      h("span", { class: "ov-status-text" }, h("b", { text: "בודקים שהכל עובד…" }), h("span", { text: "Push, מיילים, משימות ודיווחים" })));
    ui.status.className = "ov-status loading";
    ui.health.setAttribute("aria-busy", "true");
    ui.health.textContent = "";
    ui.health.appendChild(skeleton("עוברים על Push, מיילים ומשימות…", "rows"));
    ovCall("admin_health").then(function (res) {
      if (!ovUsable(token, res)) return;
      if (!res.ok) {
        ui.status.className = "ov-status";
        fill(ui.status, h("span", { class: "ov-status-text" }, h("b", { text: "לא הצלחנו לבדוק" }), h("span", { text: "בדקו את החיבור ונסו שוב." })),
          refreshButton());
        fill(ui.health, retryBox("לא הצלחנו לטעון את הבדיקות.", loadHealth));
        return;
      }
      ov.healthAt = Date.now();
      drawHealth(res.data || {});
    });
  }

  function refreshButton() {
    return h("button", { type: "button", class: "ov-refresh", "aria-label": "רענון", onclick: function () {
      ov.token++;
      loadHealth();
      loadPush();
    } }, svg("M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"));
  }

  function healthRows(d) {
    var push = d.push || {}, mail = d.mail || {}, mod = d.moderation || {}, photo = d.photo_checks || {};
    var rows = [];

    // Push: success rate of the last 24 hours.
    var sent = Number(val(push.sent_24h)) || 0, failed = Number(val(push.failed_24h)) || 0;
    var expired = Number(val(push.expired_24h)) || 0, pending = Number(val(push.pending)) || 0;
    var pushBits = [];
    pushBits.push(pending ? plural(pending, "אחת ממתינה", "ממתינות") +
      (val(push.oldest_pending_age_s) !== null ? ", הוותיקה לפני " + duration(val(push.oldest_pending_age_s)) : "") : "אין ממתינות");
    pushBits.push(fmt(sent) + " נשלחו");
    if (failed) pushBits.push(fmt(failed) + " נכשלו");
    if (expired) pushBits.push(plural(expired, "מכשיר אחד לא בתוקף", "מכשירים לא בתוקף"));
    rows.push({ title: "התראות Push", detail: pushBits.join(" · "), status: worst(push),
      value: sent + failed ? Math.round((sent / (sent + failed)) * 100) + "%" : "—" });

    // Report mails (moderation-mail).
    var mPending = Number(val(mail.pending)) || 0, mFailed = Number(val(mail.failed_24h)) || 0;
    var mailBits = [mPending ? plural(mPending, "אחד ממתין", "ממתינים") +
      (val(mail.oldest_pending_age_s) !== null ? ", הוותיק לפני " + duration(val(mail.oldest_pending_age_s)) : "") : "אין ממתינים"];
    if (mFailed) mailBits.push(fmt(mFailed) + " נכשלו");
    rows.push({ title: "מיילים על דיווחים", detail: mailBits.join(" · "), status: worst(mail), value: fmt(mPending) });

    // Scheduled jobs (pg_cron).
    if (!d.cron || typeof d.cron !== "object") {
      rows.push({ title: "משימות מתוזמנות", detail: "אי אפשר לקרוא את היסטוריית המשימות", status: "na", value: "—" });
    } else {
      var jobs = Object.keys(d.cron);
      var late = jobs.filter(function (k) { return d.cron[k] && d.cron[k].status === "warn"; });
      var detail = !jobs.length ? "לא נמצאו משימות"
        : !late.length ? "כל המשימות רצו בזמן"
        : late.map(function (k) {
          var j = d.cron[k] || {};
          return (CRON_NAMES[k] || k) + (j.last_success ? ": לא רצה " + duration(j.age_s) : ": עוד לא רצה");
        }).join(" · ");
      rows.push({ title: "משימות מתוזמנות", detail: detail, status: !jobs.length ? "na" : late.length ? "warn" : "ok",
        value: (jobs.length - late.length) + "/" + jobs.length });
    }

    // Open reports and flags.
    var open = Number(val(mod.open_reports)) || 0, flagsOpen = Number(val(mod.flags_open)) || 0;
    var modBits = [open ? "הוותיק פתוח " + duration(val(mod.oldest_open_report_age_s)) : "אין דיווחים פתוחים"];
    if (flagsOpen) modBits.push(plural(flagsOpen, "סימון אחד", "סימונים"));
    if (Number(val(mod.suspensions_7d))) modBits.push(plural(val(mod.suspensions_7d), "השעיה אחת השבוע", "השעיות השבוע"));
    rows.push({ title: "דיווחים פתוחים", detail: modBits.join(" · "), status: worst(mod), value: fmt(open) });

    // Photo checks.
    var total = val(photo.total_24h), rejected = Number(val(photo.rejected_24h)) || 0, errs = Number(val(photo.error_24h)) || 0;
    var photoBits = [fmt(total) + " נבדקו", fmt(rejected) + " נדחו"];
    if (errs) photoBits.push(plural(errs, "שגיאה אחת", "שגיאות"));
    rows.push({ title: "בדיקות תמונה", detail: photoBits.join(" · "), status: worst(photo), value: fmt(total) });

    // Rate limits: refusals are not counted on the server (a refusal rolls back its own write).
    rows.push({ title: "מגבלות קצב", detail: "השרת לא סופר חסימות. המגבלות עצמן בלשונית הגדרות.", status: "na", value: "—" });
    return rows;
  }

  function statusMark(status) {
    var glyph = status === "ok" ? "M6 12.5l4 4 8-9" : status === "warn" ? "M12 6v7M12 17.5v.5" : "M7 12h10";
    return h("span", { class: "ov-dot " + status, "aria-hidden": "true" }, svg(glyph));
  }
  var STATUS_TEXT = { ok: "תקין", warn: "לבדיקה", na: "לא נמדד" };

  function drawHealth(d) {
    var ui = ov.ui;
    var rows = healthRows(d);
    var warnCount = rows.filter(function (r) { return r.status === "warn"; }).length;
    var warn = warnCount > 0 || d.status === "warn";
    var title = !warn ? "הכל עובד כשורה"
      : warnCount <= 1 ? (warnCount === 1 ? "דבר אחד דורש בדיקה" : "משהו דורש בדיקה")
      : warnCount + " דברים דורשים בדיקה";
    var when = h("span", { class: "ov-updated", text: updatedText() });
    ui.status.className = "ov-status " + (warn ? "warn" : "ok");
    fill(ui.status, statusMark(warn ? "warn" : "ok"),
      h("span", { class: "ov-status-text" }, h("b", { text: title }), when),
      refreshButton());
    ov.ticker = setInterval(function () {
      if (!document.body.contains(when)) return stopTicker();
      when.textContent = updatedText();
    }, 30000);

    fill(ui.health, rows.map(function (r) {
      return h("div", { class: "list-row ov-row" },
        statusMark(r.status),
        h("span", { class: "grow" },
          h("span", { class: "ov-row-title" }, r.title, h("span", { class: "sr-only", text: ": " + STATUS_TEXT[r.status] + "." })),
          h("span", { class: "ov-row-detail", text: r.detail })),
        h("span", { class: "num ov-row-value", dir: "ltr", text: r.value }));
    }), ui.push);
  }

  // ---- counts, chart, retention (admin_overview + admin_metrics, by range)

  function loadRange() {
    var ui = ov.ui, token = ov.token, days = state.range;
    ui.counts.setAttribute("aria-busy", "true");
    ui.counts.textContent = "";
    for (var i = 0; i < 6; i++) ui.counts.appendChild(h("div", { class: "ov-card skel-card", "aria-hidden": "true" }));
    fill(ui.signups, skeleton("סופרים הרשמות…", "chart"));
    ui.counts.appendChild(h("p", { class: "sr-only", text: "סופרים משתמשים וריצות…" }));
    fill(ui.chart, skeleton("מציירים את הגרף…", "chart"));
    ui.chart.setAttribute("aria-busy", "true");
    fill(ui.retention, skeleton("מחשבים מי חזר…", "table"));
    ui.retention.setAttribute("aria-busy", "true");

    ovCall("admin_overview", { days: days }).then(function (res) {
      if (!ovUsable(token, res) || days !== state.range) return;
      if (!res.ok) {
        fill(ui.counts, retryBox("לא הצלחנו לטעון את המספרים.", retryRange));
        fill(ui.signups, h("h2", { class: "ov-card-title", id: "ov-signups-title", text: "הרשמות לפי יום" }),
          retryBox("לא הצלחנו לטעון את הגרף.", retryRange));
        fill(ui.chart, h("h2", { class: "ov-card-title", id: "ov-chart-title", text: "ריצות לפי יום" }),
          retryBox("לא הצלחנו לטעון את הגרף.", retryRange));
        return;
      }
      drawCounts(res.data || {});
      drawSignups(res.data || {});
      drawChart(res.data || {});
    });
    ovCall("admin_metrics", { days: days }).then(function (res) {
      if (!ovUsable(token, res) || days !== state.range) return;
      if (!res.ok) {
        fill(ui.retention, h("h2", { class: "ov-card-title", id: "ov-ret-title", text: "חוזרים אחרי (לפי שבוע הרשמה)" }),
          retryBox("לא הצלחנו לטעון את הטבלה.", retryRange));
        return;
      }
      drawRetention(res.data || {});
    });
  }
  function retryRange() { ov.token++; loadRange(); }

  function countCard(label, value, digits, sub) {
    return h("div", { class: "ov-card" },
      h("span", { class: "ov-card-label", text: label }),
      num(value, digits, "ov-card-value"),
      h("span", { class: "ov-card-sub" }, sub));
  }

  function drawCounts(d) {
    var u = d.users || {}, r = d.runs || {}, a = d.activity || {};
    var avg = r.avg_participants_in_range;
    var n = todoCount();
    var todo = h("a", { class: "ov-card todo" + (n ? " hot" : ""), href: "#inbox" },
      h("span", { class: "ov-card-label", text: "צריך טיפול" }),
      num(n, 0, "ov-card-value"),
      h("span", { class: "ov-card-sub", text: n ? state.openReports.length + " דיווחים · " + state.flags.length + " סימונים" : "הכל טופל" }));
    fill(ov.ui.counts,
      countCard("משתמשים", u.total, 0, ["+", num(u.new_in_range), " בטווח"]),
      countCard("פעילים ב־7 ימים", u.active_7d, 0, [num(u.active_today), " היום"]),
      countCard("ריצות היום", r.today, 0, [num(r.upcoming_total), " קרובות בסך הכל"]),
      countCard("ריצות שקרו", r.happened_in_range, 0,
        avg === null || avg === undefined ? "עם משתתפים, בטווח" : ["בממוצע ", num(avg, 1), " משתתפים"]),
      countCard("הצטרפויות", a.joins_in_range, 0,
        Number(a.join_requests_pending) === 1 ? "בקשה אחת ממתינה" : [num(a.join_requests_pending), " בקשות ממתינות"]),
      todo);
  }

  // Per-day bars, two series side by side. Right to left: the oldest day on the right, today on the left.
  // The contract's daily series has no "happened" count yet: a future runs_happened field is used when present,
  // otherwise the phone-recorded runs of that day.
  function drawChart(d) {
    var ui = ov.ui;
    var series = Array.isArray(d.series) ? d.series : [];
    var hasHappened = series.some(function (s) { return s && s.runs_happened !== undefined; });
    var keyB = hasHappened ? "runs_happened" : "recorded_runs";
    var labelA = "נוצרו", labelB = hasHappened ? "קרו עם משתתפים" : "הוקלטו בטלפון";
    var title = h("h2", { class: "ov-card-title", id: "ov-chart-title", text: hasHappened ? "ריצות שנוצרו מול ריצות שקרו, לפי יום" : "ריצות שנוצרו מול ריצות שהוקלטו, לפי יום" });
    var A = series.map(function (s) { return Number(s && s.runs_created) || 0; });
    var B = series.map(function (s) { return Number(s && s[keyB]) || 0; });
    var max = Math.max.apply(null, A.concat(B, [0]));
    if (!series.length || max === 0) {
      return fill(ui.chart, title, emptyNote("כשייווצרו ריצות בטווח הזה, הן יופיעו כאן לפי יום."));
    }

    var n = series.length, W = 600, H = 120, slot = W / n;
    var gap = Math.max(slot * 0.18, 0.6), bw = (slot - gap) / 2;
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 " + W + " " + H);
    s.setAttribute("preserveAspectRatio", "none");
    s.setAttribute("class", "ov-bars");
    s.setAttribute("role", "img");
    var sumA = A.reduce(function (x, y) { return x + y; }, 0), sumB = B.reduce(function (x, y) { return x + y; }, 0);
    var peak = A.indexOf(Math.max.apply(null, A));
    s.setAttribute("aria-label", "גרף עמודות, " + n + " ימים: " + labelA + " " + sumA + " ריצות, " + labelB + " " + sumB +
      ". הכי הרבה ריצות נוצרו ב־" + shortDay(series[peak].day) + " (" + A[peak] + "). הפירוט בטבלה שאחרי הגרף.");
    var grid = document.createElementNS(SVG_NS, "line");
    grid.setAttribute("x1", "0"); grid.setAttribute("x2", String(W)); grid.setAttribute("y1", "0.5"); grid.setAttribute("y2", "0.5");
    grid.setAttribute("class", "ov-grid-line");
    s.appendChild(grid);
    var rect = function (x, v, cls) {
      if (!v) return;
      var hgt = Math.max((v / max) * (H - 2), 1.5);
      var r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", x.toFixed(2)); r.setAttribute("width", bw.toFixed(2));
      r.setAttribute("y", (H - hgt).toFixed(2)); r.setAttribute("height", hgt.toFixed(2));
      r.setAttribute("class", cls);
      s.appendChild(r);
    };
    for (var i = 0; i < n; i++) {
      var right = W - i * slot - gap / 2;
      rect(right - bw, A[i], "bar-a");
      rect(right - 2 * bw, B[i], "bar-b");
    }

    var table = h("table", { class: "sr-only" },
      h("caption", { text: title.textContent }),
      h("thead", null, h("tr", null, h("th", { scope: "col", text: "יום" }), h("th", { scope: "col", text: labelA }),
        h("th", { scope: "col", text: labelB }))),
      h("tbody", null, series.map(function (row, k) {
        return h("tr", null, h("th", { scope: "row", text: shortDay(row.day) }), h("td", { text: String(A[k]) }), h("td", { text: String(B[k]) }));
      })));

    fill(ui.chart, title,
      h("div", { class: "ov-plot" },
        h("span", { class: "ov-max", "aria-hidden": "true" }, num(max)),
        s,
        h("div", { class: "ov-axis", "aria-hidden": "true" },
          h("span", { class: "num", dir: "ltr", text: shortDay(series[0].day) }),
          h("span", { text: "היום" }))),
      h("div", { class: "ov-legend", "aria-hidden": "true" },
        h("span", null, h("i", { class: "key-a" }), labelA),
        h("span", null, h("i", { class: "key-b" }), labelB)),
      table);
  }

  function drawRetention(d) {
    var ui = ov.ui;
    var title = h("h2", { class: "ov-card-title", id: "ov-ret-title", text: "חוזרים אחרי (לפי שבוע הרשמה)" });
    var rows = (Array.isArray(d.retention) ? d.retention : []).filter(function (r) { return r && Number(r.users) > 0; }).reverse();
    var opted = Number(d.opted_out) || 0;
    var foot = h("p", { class: "note" }, opted
      ? [num(opted), opted === 1 ? " משתמש/ת כיבה את שיתוף נתוני השימוש ולא נספר/ת כאן." : " משתמשים כיבו את שיתוף נתוני השימוש ולא נספרים כאן."]
      : "כל המשתמשים משתפים נתוני שימוש.");
    if (!rows.length) return fill(ui.retention, title, emptyNote("הטבלה תתמלא כשיהיו הרשמות בטווח הזה."), foot);
    var cell = function (c) {
      var rate = c && c.rate !== null && c.rate !== undefined ? Number(c.rate) : null;
      if (rate === null || isNaN(rate)) {
        return h("td", { class: "na" }, h("span", { "aria-hidden": "true", text: "—" }), h("span", { class: "sr-only", text: "עוד אי אפשר למדוד" }));
      }
      return h("td", null, h("span", { class: "num", dir: "ltr", text: Math.round(rate * 100) + "%" }));
    };
    fill(ui.retention, title,
      h("table", { class: "ov-table" },
        h("thead", null, h("tr", null, ["שבוע", "יום 1", "יום 7", "יום 30"].map(function (t) { return h("th", { scope: "col", text: t }); }))),
        h("tbody", null, rows.map(function (r) {
          return h("tr", null,
            h("th", { scope: "row" }, h("span", { class: "num", dir: "ltr", text: weekLabel(r.week) }),
              h("small", null, num(r.users), r.users === 1 ? " נרשם/ה" : " נרשמו")),
            cell(r.d1), cell(r.d7), cell(r.d30));
        }))),
      h("p", { class: "note", text: "חזרו = היו פעילים באפליקציה ביום הזה או למחרת. ״—״ = עוד מוקדם למדוד." }),
      foot);
  }

  // ------------------------------------------------------------------ users and newsletter (round 30, M1) ---

  // Every user's email (the server logs each list call, counts only). Export covers newsletter subscribers only.
  // Round 38: a table with filters (admin_user_list, v36), a row menu, and suspending several at once.
  var users = { rows: [], total: 0, search: "", status: "all", platform: "", trust: "", only: false, sort: "joined",
    token: 0, timer: null, selected: {} };
  var USER_STATUS = [["all", "כולם"], ["active", "פעילים"], ["new", "חדשים השבוע"], ["suspended", "מושעים"], ["flagged", "מסומנים"]];
  var PLATFORM_OPTIONS = [["", "כל המכשירים"], ["ios", "iPhone"], ["android", "Android"], ["none", "בלי פוש"]];
  var TRUST_OPTIONS = [["", "כל רמות האמון"], ["starter", TRUST.starter], ["verified", TRUST.verified], ["regular", TRUST.regular],
    ["pacer", TRUST.pacer]];
  var SORT_OPTIONS = [["joined", "מיון: הצטרפות"], ["active", "מיון: פעילות אחרונה"], ["runs", "מיון: הכי הרבה ריצות"], ["name", "מיון: שם"]];

  function newsletterText(n) {
    if (!n || !n.subscribed) return "לא מנוי/ה";
    return ["מנוי/ה", SOURCES[n.source] || "", n.consent_at ? stamp(n.consent_at) : ""].filter(Boolean).join(" · ");
  }
  function shortDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    if (dayKey(d) === dayKey(new Date())) return "היום";
    if (dayKey(d) === dayKey(new Date(Date.now() - DAY))) return "אתמול";
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "Asia/Jerusalem" });
  }

  function newsletterCard(s) {
    var pct = s.users ? Math.round((s.subscribers / s.users) * 100) : 0;
    var exportBtn = h("button", { type: "button", class: "btn nl-export", onclick: function () { exportSubscribers(exportBtn); } },
      svg("M12 4v11M7 10l5 5 5-5M5 20h14"), "ייצוא מנויים (CSV)");
    return h("section", { class: "nl-card", "aria-label": "ניוזלטר" },
      h("div", { class: "nl-top" },
        h("div", { class: "nl-main" },
          h("span", { class: "nl-label", text: "ניוזלטר" }),
          h("span", { class: "nl-value num", text: s.subscribers.toLocaleString("he-IL") }),
          h("span", { class: "nl-sub", text: "מנויים מתוך " + s.users.toLocaleString("he-IL") + " משתמשים · " + pct + "%" })),
        h("div", { class: "nl-side" },
          h("span", null, h("b", { class: "num", text: "+" + s.subscribed_30d }), " ב־30 יום"),
          h("span", { text: s.unsubscribed_30d + " הסירו" }))),
      h("div", { class: "nl-actions" }, exportBtn,
        h("a", { class: "btn nl-link", href: RESEND_URL, target: "_blank", rel: "noopener noreferrer" }, "שליחה ב־Resend")),
      h("span", { class: "nl-foot", text: "רשימה מסונכרנת אוטומטית." +
        (s.apple_relay_subscribers ? " " + s.apple_relay_subscribers + " מהמנויים עם מייל מוסתר של Apple." : "") +
        (s.outbox_failed ? " " + s.outbox_failed + " עדכונים ל־Resend נכשלו." : "") }));
  }

  // A page's title row: the title, an optional count, and controls on the far side.
  function pageHead(title, count, side) {
    return h("div", { class: "page-head" },
      h("h1", { class: "page-title" }, title, count),
      side ? h("div", { class: "page-side" }, side) : null);
  }
  function selectBox(label, options, value, onchange) {
    var sel = h("select", { "aria-label": label }, options.map(function (o) {
      return h("option", { value: o[0], selected: o[0] === value }, o[1]);
    }));
    sel.addEventListener("change", function () { onchange(sel.value); });
    return h("span", { class: "select" }, sel, svg("M7 10l5 5 5-5"));
  }
  function trustChip(level) {
    return level ? h("span", { class: "chip trust-" + level, text: TRUST[level] || level }) : null;
  }
  function userChips(u) {
    return [u.suspended ? h("span", { class: "chip suspended", text: "מושעה/ית" }) : null,
      u.flagged ? h("span", { class: "chip warn", text: "מסומן/ת" }) : null,
      u.newsletter ? h("span", { class: "chip info", text: "מנוי/ה" }) : null];
  }
  function deviceCell(u) {
    var p = u.platforms || [];
    if (!p.length) return h("span", { class: "chip warn", text: "בלי פוש" });
    return h("span", { class: "device" }, p.map(function (x) { return h("span", { class: "chip", text: PLATFORMS[x] || x }); }),
      u.app_version ? h("small", { dir: "ltr", text: u.app_version }) : null);
  }

  function renderUsers() {
    users.selected = {};
    var input = h("input", { type: "search", id: "user-search", placeholder: "חיפוש לפי שם או מייל", "aria-label": "חיפוש לפי שם או מייל",
      autocomplete: "off", value: users.search });
    input.addEventListener("input", function () {
      clearTimeout(users.timer);
      users.timer = setTimeout(function () { users.search = input.value.trim(); loadUsers(true); }, 350);
    });
    var status = h("div", { class: "filters", role: "group", "aria-label": "סטטוס" }, USER_STATUS.map(function (f) {
      return h("button", { type: "button", "aria-pressed": users.status === f[0] ? "true" : "false", onclick: function (ev) {
        users.status = f[0];
        Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (b) { b.setAttribute("aria-pressed", "false"); });
        ev.currentTarget.setAttribute("aria-pressed", "true");
        loadUsers(true);
      } }, f[1]);
    }));
    var subs = h("button", { type: "button", class: "toggle", "aria-pressed": users.only ? "true" : "false", onclick: function () {
      users.only = !users.only;
      subs.setAttribute("aria-pressed", users.only ? "true" : "false");
      loadUsers(true);
    } }, svg("M4 6h16v12H4zM4 7l8 6 8-6"), "מנויי ניוזלטר");
    show(
      pageHead("משתמשים", h("span", { class: "page-count num", id: "users-total", dir: "ltr" })),
      h("div", { id: "nl-slot" }, h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים…")),
      h("div", { class: "toolbar" },
        h("label", { class: "search" }, svg("M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4-4"), input),
        status,
        h("div", { class: "toolbar-row" },
          selectBox("מכשיר", PLATFORM_OPTIONS, users.platform, function (v) { users.platform = v; loadUsers(true); }),
          selectBox("רמת אמון", TRUST_OPTIONS, users.trust, function (v) { users.trust = v; loadUsers(true); }),
          selectBox("מיון", SORT_OPTIONS, users.sort, function (v) { users.sort = v; loadUsers(true); }),
          subs)),
      h("div", { id: "bulk-slot" }),
      h("div", { id: "user-list" }),
      h("p", { class: "note center", text: "כל צפייה ברשימה וכל ייצוא נרשמים ביומן." }));
    rpc("admin_newsletter_summary").then(function (s) {
      var slot = $("nl-slot");
      if (!slot) return;
      slot.textContent = "";
      slot.appendChild(newsletterCard(s || {}));
    }).catch(function (e) {
      var slot = $("nl-slot");
      if (slot) slot.textContent = "";
      fail(e);
    });
    loadUsers(true);
  }

  function loadUsers(fresh) {
    var token = ++users.token;
    if (fresh) { users.rows = []; users.selected = {}; drawBulk(); }
    var box = $("user-list");
    if (!box) return;
    if (fresh) {
      box.textContent = "";
      box.appendChild(h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים משתמשים…"));
    }
    rpc("admin_user_list", { search: users.search || null, status: users.status, platform: users.platform || null,
      trust: users.trust || null, subscribers_only: users.only, sort: users.sort, max_rows: 50, skip: users.rows.length })
      .then(function (rows) {
        if (token !== users.token || !$("user-list")) return;
        rows = rows || [];
        users.rows = users.rows.concat(rows);
        if (rows.length) users.total = Number(rows[0].total) || users.rows.length;
        else if (fresh) users.total = 0;
        $("users-total").textContent = fmt(users.total);
        box.textContent = "";
        if (!users.rows.length) {
          var filtered = users.search || users.status !== "all" || users.platform || users.trust || users.only;
          box.appendChild(empty(filtered ? "אין משתמשים שמתאימים" : "עוד אין משתמשים",
            filtered ? "אפשר לחפש חלק מהשם או מהמייל, או לנקות את הסינון." : null));
          return;
        }
        box.appendChild(userTable(users.rows));
        if (users.rows.length < users.total) {
          box.appendChild(h("button", { type: "button", class: "btn quiet more-btn", onclick: function () { loadUsers(false); } },
            "עוד " + fmt(Math.min(50, users.total - users.rows.length))));
        }
      }).catch(function (e) {
        if (token !== users.token) return;
        box.textContent = "";
        if (missingRpc(e)) return box.appendChild(empty("השרת עוד לא עודכן", "הטבלה החדשה תופיע אחרי שעדכון v36 יורץ ב־Supabase."));
        fail(e);
      });
  }

  function userTable(rows) {
    var th = function (t, cls) { return h("th", { scope: "col", class: cls || null, text: t }); };
    return h("div", { class: "table-box" }, h("table", { class: "utable" },
      h("thead", null, h("tr", null,
        h("th", { scope: "col", class: "c-check" }, h("span", { class: "sr-only", text: "בחירה" })),
        th("משתמש/ת", "c-who"), th("אזור", "c-area"), th("רמת אמון", "c-trust"), th("ריצות", "c-runs"), th("הצטרפות", "c-joined"),
        th("פעילות", "c-active"), th("מכשיר", "c-device"), th("סטטוס", "c-status"),
        h("th", { scope: "col", class: "c-menu" }, h("span", { class: "sr-only", text: "פעולות" })))),
      h("tbody", null, rows.map(userTr))));
  }

  function userTr(u) {
    var cb = h("input", { type: "checkbox", "aria-label": "בחירת " + nameAge(u), checked: !!users.selected[u.id] });
    cb.addEventListener("change", function () {
      if (cb.checked) users.selected[u.id] = u;
      else delete users.selected[u.id];
      cb.closest("tr").classList.toggle("selected", cb.checked);
      drawBulk();
    });
    var runs = (u.runs_joined || 0) + (u.runs_organized || 0);
    return h("tr", { class: users.selected[u.id] ? "selected" : null },
      h("td", { class: "c-check" }, cb),
      h("td", { class: "c-who" }, h("a", { class: "u-who", href: "#user/" + u.id },
        avatar(u),
        h("span", { class: "who-text" }, h("span", { class: "who-name", text: nameAge(u) }),
          h("span", { class: "user-email", dir: "ltr", title: u.email || null, text: u.email || "—" })))),
      h("td", { class: "c-area", title: u.neighborhood || null, text: u.neighborhood || "—" }),
      h("td", { class: "c-trust" }, trustChip(u.trust_level)),
      h("td", { class: "c-runs" }, h("span", { class: "num", text: fmt(runs) }),
        u.runs_organized ? h("small", { text: " · ארגן/ה " + u.runs_organized }) : null),
      h("td", { class: "c-joined", text: shortDate(u.created_at) }),
      h("td", { class: "c-active", text: ago(u.last_active_at) || "—" }),
      h("td", { class: "c-device" }, deviceCell(u)),
      h("td", { class: "c-status" }, h("span", { class: "chips" }, userChips(u))),
      h("td", { class: "c-menu" }, rowMenu(u)),
      // Phone: the same facts on one line under the name.
      h("td", { class: "c-meta", "aria-hidden": "true" }, h("span", { class: "chips" }, trustChip(u.trust_level), deviceCell(u), userChips(u),
        u.last_active_at ? h("span", { class: "meta-when", text: "נראה/תה " + ago(u.last_active_at) }) : null)));
  }

  // The "⋯" menu of a row: open the card, a test push, suspend / unsuspend, delete.
  function rowMenu(u) {
    var btn = h("button", { type: "button", class: "icon-btn menu-btn", "aria-label": "פעולות על " + nameAge(u),
      "aria-haspopup": "menu", "aria-expanded": "false" }, svg("M5 12h.01M12 12h.01M19 12h.01"));
    var p = { id: u.id, name: u.name, age: u.age };
    var item = function (label, fn, cls) {
      return h("button", { type: "button", role: "menuitem", class: cls || null, onclick: function () { closeMenus(); fn(); } }, label);
    };
    var menu = h("div", { class: "menu", role: "menu", hidden: true },
      item("פתיחת הכרטיס", function () { go("#user/" + u.id); }),
      item("התראת בדיקה", function () { testPush(p); }),
      u.suspended ? item("ביטול השעיה", function () { unsuspend(p); }) : item("השעיה…", function () { suspend(p, null); }),
      h("hr"),
      item("מחיקת החשבון…", function () { askDelete(u.id); }, "danger"));
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var open = menu.hidden;
      closeMenus();
      if (open) {
        // Fixed to the window (a table that scrolls sideways would clip it): under the button, opening inward.
        var r = btn.getBoundingClientRect();
        menu.hidden = false;
        var below = r.bottom + 4 + menu.offsetHeight <= window.innerHeight;
        menu.style.top = (below ? r.bottom + 4 : Math.max(8, r.top - 4 - menu.offsetHeight)) + "px";
        menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
        btn.setAttribute("aria-expanded", "true");
        var first = menu.querySelector("button");
        if (first) first.focus({ preventScroll: true });
      }
    });
    menu.addEventListener("keydown", function (ev) {
      var items = Array.prototype.slice.call(menu.querySelectorAll("button"));
      var i = items.indexOf(document.activeElement);
      if (ev.key === "ArrowDown") { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (ev.key === "ArrowUp") { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (ev.key === "Escape") { closeMenus(); btn.focus(); }
    });
    return h("span", { class: "menu-wrap" }, btn, menu);
  }
  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll(".menu:not([hidden])"), function (m) {
      m.hidden = true;
      var b = m.parentNode.querySelector(".menu-btn");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }

  // Several rows ticked: suspend them together (one reason for all).
  function drawBulk() {
    var slot = $("bulk-slot");
    if (!slot) return;
    var ids = Object.keys(users.selected);
    slot.textContent = "";
    if (!ids.length) return;
    slot.appendChild(h("div", { class: "bulk", role: "region", "aria-label": "פעולות על הנבחרים" },
      h("b", { text: ids.length === 1 ? "נבחר/ה אחד/ת" : ids.length + " נבחרו" }),
      h("button", { type: "button", class: "btn ink small", onclick: bulkSuspend }, "השעיה…"),
      h("button", { type: "button", class: "btn text small", onclick: function () {
        users.selected = {};
        Array.prototype.forEach.call(document.querySelectorAll(".utable input[type=checkbox]"), function (c) { c.checked = false; });
        Array.prototype.forEach.call(document.querySelectorAll(".utable tr.selected"), function (r) { r.classList.remove("selected"); });
        drawBulk();
      } }, "ביטול הבחירה")));
  }

  function bulkSuspend() {
    var list = Object.keys(users.selected).map(function (k) { return users.selected[k]; }).filter(function (u) { return !u.suspended; });
    if (!list.length) return toast("כל הנבחרים כבר מושעים");
    confirmNote({
      title: "השעיית " + (list.length === 1 ? nameAge(list[0]) : list.length + " משתמשים"),
      text: "לכל אחד/ת: הריצות הקרובות שלו/ה יבוטלו והמשתתפים יקבלו התראה, הפרופיל מוסתר והדיווחים הפתוחים נסגרים. אפשר לבטל מהכרטיס.",
      label: "סיבה (אחת לכולם, נשמרת ביומן)",
      ok: "השעיה",
      required: true
    }).then(function (note) {
      if (note === null) return;
      var done = 0;
      var next = function () {
        if (!list.length) {
          toast(done === 1 ? "משתמש/ת אחד/ת הושעה/תה" : done + " משתמשים הושעו");
          return reloadOpen().catch(function () { /* next time */ }).then(function () { updateCounts(); loadUsers(true); });
        }
        var u = list.shift();
        rpc("admin_suspend", { target: u.id, reason: note }).then(function () { done++; next(); }).catch(function (e) {
          if (done) toast(done + " הושעו, השאר לא");
          fail(e);
          loadUsers(true);
        });
      };
      next();
    });
  }

  // A cell that Excel or Sheets would read as a formula gets a leading apostrophe.
  function csvCell(v) {
    var t = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  function exportSubscribers(btn) {
    btn.disabled = true;
    rpc("admin_newsletter_export").then(function (rows) {
      btn.disabled = false;
      rows = rows || [];
      if (!rows.length) return toast("עוד אין מנויים לייצוא");
      var lines = [["email", "first_name", "consent_at", "consent_source"].join(",")].concat(rows.map(function (r) {
        return [r.email, r.first_name, r.consent_at, r.consent_source].map(csvCell).join(",");
      }));
      // A BOM, so Excel reads the Hebrew names as UTF-8.
      var blob = new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = h("a", { href: url, download: "letsrun-newsletter-" + dayKey(new Date()) + ".csv" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      toast(rows.length === 1 ? "יוצא מנוי אחד" : "יוצאו " + rows.length + " מנויים");
    }).catch(function (e) { btn.disabled = false; fail(e); });
  }

  // ------------------------------------------------------------------ user card (round 38) ---
  // admin_user (v36): a head with the actions, then tabs: סקירה / ריצות / דיווחים / מכשירים / יומן.

  var USER_TABS = [["overview", "סקירה"], ["runs", "ריצות"], ["reports", "דיווחים"], ["devices", "מכשירים"], ["log", "יומן"]];
  var PHOTO_KIND = { avatar: "תמונת פרופיל", cover: "תמונת ריצה" };
  var PHOTO_VERDICT = { ok: "עברה", rejected: "נדחתה", error: "שגיאה בבדיקה" };
  var PROVIDERS = { apple: "Apple", google: "Google", email: "מייל" };

  function copyButton(value, label) {
    return h("button", { type: "button", class: "icon-btn copy", "aria-label": label, onclick: function () {
      var done = function () { toast("הועתק"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, function () { toast("לא הצלחנו להעתיק"); });
    } }, svg("M9 9h10v11H9zM5 15V4h10"));
  }
  function pace(s) {
    s = Number(s);
    if (!s) return "";
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " לק״מ";
  }
  function title(g) { return (g && (g.display_title || g.title)) || "ריצה"; }

  function renderUser(id) {
    loading("טוענים את הכרטיס…");
    rpc("admin_user", { target: id }).then(function (u) {
      var p = u.profile || { id: id };
      var st = u.stats || {};
      var suspended = !!p.suspended_at;
      var flagged = u.trust_flag && !u.trust_flag.reviewed_at;
      state.lastUser = u;

      var chips = h("div", { class: "chips" },
        trustChip(p.trust_level),
        suspended ? h("span", { class: "chip suspended", text: "מושעה/ית " + ago(p.suspended_at) }) : null,
        flagged ? h("span", { class: "chip warn", text: "מסומן/ת · " + u.trust_flag.reporters_90d + " מדווחים · " + u.trust_flag.blockers_90d + " חוסמים" }) : null,
        p.newsletter && p.newsletter.subscribed ? h("span", { class: "chip info", text: "מנוי/ה לניוזלטר" }) : null,
        p.is_admin ? h("span", { class: "chip", text: "מנהל/ת" }) : null,
        p.is_hidden ? h("span", { class: "chip", text: "פרופיל מוסתר" }) : null);
      var sub = [p.neighborhood, joined(p.created_at), p.last_active_at ? "נראה/תה " + ago(p.last_active_at) : ""].filter(Boolean).join(" · ");
      var head = h("section", { class: "card u-head" },
        h("div", { class: "u-head-main" },
          avatar(p, true),
          h("div", { class: "u-head-text" },
            h("h1", { text: nameAge(p) }), chips,
            h("span", { class: "who-sub", text: sub }),
            h("span", { class: "u-ids" },
              p.email ? h("span", { class: "u-id" }, h("span", { dir: "ltr", text: p.email }), copyButton(p.email, "העתקת המייל")) : null,
              h("span", { class: "u-id" }, h("span", { dir: "ltr", class: "mono", text: p.id.slice(0, 8) + "…" }), copyButton(p.id, "העתקת המזהה"))))),
        suspended && p.suspension_reason ? h("div", { class: "banner", text: "סיבת ההשעיה: " + p.suspension_reason }) : null,
        h("div", { class: "actions u-actions" },
          h("button", { type: "button", class: "btn quiet", onclick: function () { testPush(p, function () { renderUser(id); }); } },
            svg("M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9zM10 19a2 2 0 0 0 4 0"), "התראת בדיקה"),
          p.is_admin ? null : suspended
            ? h("button", { type: "button", class: "btn ink", onclick: function () { unsuspend(p); } }, "ביטול השעיה")
            : h("button", { type: "button", class: "btn ink", onclick: function () { suspend(p, null); } }, "השעיה…")));

      var counts = { runs: (u.runs || []).length + (u.joined_runs || []).length,
        reports: (u.reports_against || []).length + (u.reports_by || []).length, devices: (u.devices || []).length, log: (u.log || []).length };
      var panes = {};
      var tabs = h("div", { class: "u-tabs", role: "tablist", "aria-label": "חלקי הכרטיס" }, USER_TABS.map(function (t) {
        var b = h("button", { type: "button", role: "tab", id: "ut-" + t[0], "aria-controls": "up-" + t[0],
          "aria-selected": state.userTab === t[0] ? "true" : "false", tabindex: state.userTab === t[0] ? "0" : "-1" },
          t[1], counts[t[0]] ? h("span", { class: "tab-count num", text: String(counts[t[0]]) }) : null);
        b.addEventListener("click", function () { pickUserTab(t[0]); });
        b.addEventListener("keydown", function (ev) {
          var d = ev.key === "ArrowLeft" ? 1 : ev.key === "ArrowRight" ? -1 : 0;
          if (!d) return;
          ev.preventDefault();
          var i = (USER_TABS.map(function (x) { return x[0]; }).indexOf(t[0]) + d + USER_TABS.length) % USER_TABS.length;
          pickUserTab(USER_TABS[i][0]);
          $("ut-" + USER_TABS[i][0]).focus();
        });
        return b;
      }));
      panes.overview = userOverview(u);
      panes.runs = userRuns(u);
      panes.reports = userReports(u);
      panes.devices = userDevices(u, id);
      panes.log = (u.log || []).length ? h("div", { class: "list" }, u.log.map(logRow)) : h("p", { class: "note", text: "אין פעולות עדיין." });
      var paneEls = USER_TABS.map(function (t) {
        return h("section", { class: "u-pane", role: "tabpanel", id: "up-" + t[0], "aria-labelledby": "ut-" + t[0],
          hidden: state.userTab !== t[0] }, panes[t[0]]);
      });
      function pickUserTab(k) {
        state.userTab = k;
        USER_TABS.forEach(function (t) {
          var on = t[0] === k;
          $("ut-" + t[0]).setAttribute("aria-selected", on ? "true" : "false");
          $("ut-" + t[0]).tabIndex = on ? 0 : -1;
          $("up-" + t[0]).hidden = !on;
        });
      }

      show(
        h("nav", { class: "crumbs", "aria-label": "מיקום" }, h("a", { href: "#users", text: "משתמשים" }), h("span", { "aria-hidden": "true", text: "›" }),
          h("span", { "aria-current": "page", text: (p.name || "").trim() || "ללא שם" })),
        head, tabs, paneEls);
    }).catch(function (e) {
      if (code(e) === "user_not_found") return show(empty("המשתמש/ת לא נמצא/ה", "אולי החשבון נמחק."));
      fail(e);
    });
  }

  function stat(label, value, sub) {
    return h("div", { class: "stat" }, h("span", { class: "stat-label", text: label }), num(value, 0, "stat-value"),
      sub ? h("span", { class: "stat-sub", text: sub }) : null);
  }

  function userOverview(u) {
    var p = u.profile || {}, st = u.stats || {};
    var marked = (Number(st.attended) || 0) + (Number(st.no_show) || 0);
    var stats = h("div", { class: "stats" },
      stat("ארגן/ה", st.organized),
      stat("הצטרף/ה", st.joined),
      stat("הגיע/ה בפועל", st.attended, marked ? "מתוך " + marked + " שסומנו" : "עוד לא סומן"),
      stat("חיבורים", st.connections),
      stat("קבוצות", st.crews),
      stat("ק״מ מוקלטים", Math.round(Number(st.recorded_km) || 0), fmt(st.recorded_runs) + " ריצות"));

    var facts = h("dl", { class: "facts" });
    [["כניסה עם", PROVIDERS[p.provider] || p.provider],
      ["קצב", pace(p.pace_seconds)],
      ["מרחק רגיל", p.typical_km ? fmt(p.typical_km, 1) + " ק״מ" : ""],
      ["תנאי שימוש", p.terms_version ? "גרסה " + p.terms_version + " · " + ago(p.terms_accepted_at) : "לא אושרו עדיין"],
      ["ניוזלטר", newsletterText(p.newsletter)],
      ["נתוני שימוש", p.usage_events === false ? "כיבה/תה שיתוף" : "משתף/ת"],
      ["הגיע/ה דרך", p.referred_by ? p.referred_by.name : ""],
      ["דיווחים פתוחים", String(u.open_reports || 0)],
      ["חסימות ב־90 יום", String(u.blocks_90d || 0)]]
      .forEach(function (kv) {
        if (!kv[1]) return;
        facts.appendChild(h("dt", { text: kv[0] }));
        facts.appendChild(h("dd", { text: kv[1] }));
      });

    var danger = h("section", { class: "card danger-zone", "aria-labelledby": "dz-title" },
      h("h2", { class: "ov-card-title", id: "dz-title", text: "אזור מסוכן" }),
      p.is_admin ? h("p", { class: "note", text: "חשבון מנהל/ת: אי אפשר להשעות או למחוק מכאן." })
        : [h("p", { class: "note", text: "מחיקה היא בלתי הפיכה ונרשמת ביומן. השעיה עוצרת בלי למחוק." }),
          h("div", { class: "actions" },
            h("button", { type: "button", class: "btn danger", onclick: function () { openDelete(u); } }, "מחיקת החשבון…"))]);

    return h("div", { class: "u-grid" },
      h("div", { class: "u-col" },
        stats,
        p.bio ? h("section", { class: "card" }, h("h2", { class: "ov-card-title", text: "על עצמו/ה" }), h("p", { class: "context-text", text: p.bio })) : null,
        h("section", { class: "card", "aria-labelledby": "tl-title" }, h("h2", { class: "ov-card-title", id: "tl-title", text: "ציר זמן" }), timeline(u))),
      h("div", { class: "u-col" },
        h("section", { class: "card", "aria-labelledby": "facts-title" }, h("h2", { class: "ov-card-title", id: "facts-title", text: "פרטים והסכמות" }), facts),
        danger));
  }

  // The latest things that happened to this person, newest first.
  function timeline(u) {
    var p = u.profile || {}, ev = [];
    var now = Date.now();
    ev.push({ at: p.created_at, text: "הצטרף/ה לבוא נרוץ" });
    if (p.terms_accepted_at) ev.push({ at: p.terms_accepted_at, text: "אישר/ה את תנאי השימוש (גרסה " + p.terms_version + ")" });
    (u.runs || []).forEach(function (g) {
      ev.push({ at: g.starts_at, href: "#run/" + g.id, text: (new Date(g.starts_at) > now ? "מארגן/ת " : "ארגן/ה ") + title(g) + " · " + fmt(g.participants) + " רצים" });
    });
    (u.joined_runs || []).forEach(function (g) {
      ev.push({ at: g.joined_at, href: "#run/" + g.id, text: "הצטרף/ה ל" + title(g) + " של " + ((g.creator && g.creator.name) || "מישהו") });
    });
    (u.reports_against || []).forEach(function (r) {
      ev.push({ at: r.created_at, tone: "danger", text: "דווח/ה: " + (REASONS[r.reason] || r.reason) + " (ע״י " + ((r.reporter && r.reporter.name) || "משתמש/ת") + ")" });
    });
    (u.reports_by || []).forEach(function (r) {
      ev.push({ at: r.created_at, text: "דיווח/ה על " + ((r.reported && r.reported.name) || "משתמש/ת") + ": " + (REASONS[r.reason] || r.reason) });
    });
    (u.log || []).forEach(function (l) { ev.push({ at: l.created_at, tone: "admin", text: "מנהל: " + (ACTIONS[l.action] || l.action) + (l.note ? " · " + l.note : "") }); });
    ev = ev.filter(function (e) { return e.at; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 14);
    return h("ol", { class: "timeline" }, ev.map(function (e) {
      return h("li", { class: e.tone || null },
        h("span", { class: "tl-dot", "aria-hidden": "true" }),
        h("span", { class: "tl-body" }, e.href ? h("a", { href: e.href, text: e.text }) : h("span", { text: e.text }),
          h("span", { class: "tl-when", text: new Date(e.at) > now ? stamp(e.at) : ago(e.at) })));
    }));
  }

  function runMini(g, joined) {
    return h("a", { class: "mini run-mini", href: "#run/" + g.id },
      h("b", { text: title(g) }),
      g.caption ? h("span", { class: "context-text", text: g.caption }) : null,
      h("span", { class: "note", text: [g.place, stamp(g.starts_at), fmt(g.participants) + " רצים",
        joined && g.creator ? "של " + g.creator.name : ""].filter(Boolean).join(" · ") }));
  }

  function userRuns(u) {
    var own = (u.runs || []).map(function (g) { return runMini(g, false); });
    var joinedRuns = (u.joined_runs || []).map(function (g) { return runMini(g, true); });
    return [h("h2", { class: "section-title", text: "ריצות שארגן/ה" }),
      own.length ? h("div", { class: "list" }, own) : h("p", { class: "note", text: "אין." }),
      h("h2", { class: "section-title", text: "ריצות של אחרים" }),
      joinedRuns.length ? h("div", { class: "list" }, joinedRuns) : h("p", { class: "note", text: "אין." }),
      h("h2", { class: "section-title", text: "קבוצות" }),
      (u.crews || []).length ? h("div", { class: "list" }, u.crews.map(function (c) {
        return h("a", { class: "list-row", href: "#group/" + c.id },
          h("span", { class: "grow" }, h("span", { class: "who-name", text: c.name }),
            h("span", { class: "row-sub", text: [CREW_STATUS[c.status] || c.status, fmt(c.members) + " חברים", "הצטרף/ה " + shortDate(c.joined_at)].join(" · ") })),
          svg("M15 6l-6 6 6 6"));
      })) : h("p", { class: "note", text: "אין." })];
  }

  function userReports(u) {
    var against = (u.reports_against || []).map(function (r) {
      var ctx = r.context && r.context.type === "message" ? "״" + (r.context.text || "") + "״"
        : r.context && r.context.type === "run" ? "הריצה: " + (r.context.display_title || r.context.title || "") : "";
      return h("div", { class: "mini" },
        h("div", { class: "chips" }, h("span", { class: "chip reason-" + r.reason, text: REASONS[r.reason] || r.reason }),
          h("span", { class: "chip status", text: STATUS[r.status] || r.status })),
        ctx ? h("span", { class: "context-text", text: ctx }) : null,
        h("span", { class: "by", text: "ע״י " + ((r.reporter && r.reporter.name) || "משתמש/ת") + (r.details ? ": ״" + r.details + "״" : "") + " · " + ago(r.created_at) }),
        r.status === "open" ? h("a", { class: "btn text link", href: "#report/" + r.id, text: "לדיווח" }) : null);
    });
    var by = (u.reports_by || []).map(function (r) {
      return h("div", { class: "mini" },
        h("span", { class: "by", text: (REASONS[r.reason] || r.reason) + " על " + ((r.reported && r.reported.name) || "משתמש/ת") + " · " + ago(r.created_at) }));
    });
    return [h("h2", { class: "section-title", text: "דיווחים עליו/ה" }),
      against.length ? h("div", { class: "list" }, against) : h("p", { class: "note", text: "אין." }),
      h("h2", { class: "section-title", text: "דיווחים שלו/ה" }),
      by.length ? h("div", { class: "list" }, by) : h("p", { class: "note", text: "אין." })];
  }

  // What happened to a push: delivered / no device / replaced / failed / waiting.
  function pushOutcome(o) {
    if (!o.sent_at) return h("span", { class: "chip", text: o.attempts >= 3 ? "לא נמסרה" : "ממתינה" });
    if (!o.error) return h("span", { class: "chip ok", text: "נמסרה" });
    if (o.error === "no_tokens") return h("span", { class: "chip warn", text: "אין מכשיר" });
    if (o.error === "superseded") return h("span", { class: "chip", text: "הוחלפה בחדשה" });
    if (/expired/.test(o.error)) return h("span", { class: "chip warn", text: "פג תוקף" });
    return h("span", { class: "chip suspended", title: o.error, text: "נכשלה" });
  }

  function userDevices(u, id) {
    var p = u.profile || {};
    var devices = (u.devices || []).map(function (d) {
      return h("div", { class: "list-row device-row" },
        h("span", { class: "dev-icon", "aria-hidden": "true" }, svg("M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2")),
        h("span", { class: "grow" },
          h("b", { text: (PLATFORMS[d.platform] || d.platform) + (d.app_version ? " · " : "") }, d.app_version ? h("span", { dir: "ltr", text: d.app_version }) : null),
          h("span", { class: "ov-row-detail", text: "נרשם " + shortDate(d.created_at) + " · עודכן " + ago(d.updated_at) +
            (d.environment === "sandbox" ? " · סביבת בדיקות" : "") })));
    });
    var pushes = (u.pushes || []).map(function (o) {
      return h("div", { class: "list-row push-row" },
        h("span", { class: "grow" }, h("b", { text: o.title }, o.test ? h("span", { class: "chip small-chip", text: "בדיקה" }) : null),
          h("span", { class: "ov-row-detail", text: ago(o.created_at) + (o.error && o.error !== "no_tokens" && o.error !== "superseded" ? " · " + o.error : "") })),
        pushOutcome(o));
    });
    var photos = (u.photo_checks || []).map(function (c) {
      return h("div", { class: "list-row" },
        h("span", { class: "grow" }, h("b", { text: PHOTO_KIND[c.kind] || c.kind }), h("span", { class: "ov-row-detail", text: ago(c.created_at) + (c.face === false ? " · בלי פנים" : "") })),
        h("span", { class: "chip " + (c.verdict === "ok" ? "ok" : c.verdict === "rejected" ? "suspended" : "warn"), text: PHOTO_VERDICT[c.verdict] || c.verdict }));
    });
    return [
      h("div", { class: "card-head" }, h("h2", { class: "section-title", text: "מכשירים לפוש" }),
        h("button", { type: "button", class: "btn quiet small", onclick: function () { testPush(p, function () { renderUser(id); }); } }, "התראת בדיקה")),
      devices.length ? h("div", { class: "list" }, devices)
        : h("div", { class: "card empty-inline" }, h("b", { text: "אין מכשיר רשום לפוש" }),
          h("span", { class: "note", text: "המכשיר נרשם כשפותחים את האפליקציה ומאשרים התראות. בלי מכשיר, אף התראה לא תגיע." })),
      h("h2", { class: "section-title", text: "התראות אחרונות" }),
      pushes.length ? h("div", { class: "list" }, pushes) : h("p", { class: "note", text: "עוד לא נשלחו התראות." }),
      h("h2", { class: "section-title", text: "בדיקות תמונה" }),
      photos.length ? h("div", { class: "list" }, photos) : h("p", { class: "note", text: "אין." })];
  }

  function unsuspend(p) {
    confirmNote({
      title: "ביטול ההשעיה של " + nameAge(p),
      text: "הגישה חוזרת. ריצות שבוטלו לא חוזרות.",
      label: "הערה",
      ok: "ביטול השעיה",
      required: false
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_unsuspend", { target: p.id, note: note || null }).then(function () {
        afterAction("ההשעיה בוטלה");
      }).catch(fail);
    });
  }

  // ------------------------------------------------------------------ deleting an account (round 38) ---
  // What goes and what stays, from the card's delete_impact; a reason; the word "מחיקה". admin_delete_user (v36).

  function askDelete(id) {
    toast("טוענים את פרטי החשבון…");
    rpc("admin_user", { target: id }).then(function (u) {
      $("toast").hidden = true;
      openDelete(u);
    }).catch(fail);
  }

  function openDelete(u) {
    var p = u.profile || {}, impact = u.delete_impact || {};
    if (p.is_admin) return toast(errorText({ message: "cannot_delete_admin" }));
    var dlg = $("delete"), reason = $("delete-reason"), word = $("delete-word"), ok = $("delete-ok"), err = $("delete-error");
    var runs = Number(impact.upcoming_runs) || 0, people = Number(impact.upcoming_participants) || 0, reps = Number(impact.reports) || 0;
    $("delete-title").textContent = "מחיקת החשבון של " + nameAge(p);
    var gone = [
      "הפרופיל, התמונות והמייל",
      runs ? (runs === 1 ? "ריצה קרובה אחת שארגן/ה תבוטל" : runs + " ריצות קרובות שארגן/ה יבוטלו") +
        (people ? ", ו־" + (people === 1 ? "משתתף/ת אחד/ת יקבל/ו" : people + " משתתפים יקבלו") + " התראה" : "") : "אין ריצות קרובות שארגן/ה",
      "המקומות שלו/ה בריצות, ההודעות בצ׳אטים, החיבורים והקבוצות",
      reps ? (reps === 1 ? "דיווח אחד" : reps + " דיווחים") + " עליו/ה או שלו/ה" : null,
      p.newsletter && p.newsletter.subscribed ? "המנוי לניוזלטר (יוסר גם מ־Resend)" : null
    ].filter(Boolean);
    var gl = $("delete-gone"), kl = $("delete-kept");
    gl.textContent = "";
    kl.textContent = "";
    gone.forEach(function (t) { gl.appendChild(h("li", { text: t })); });
    kl.appendChild(h("li", { text: "שורה ביומן הפעולות עם הסיבה, בלי שם ובלי מייל (90 יום)" }));
    $("delete-suggest").hidden = !!p.suspended_at;
    reason.value = "";
    word.value = "";
    err.hidden = true;
    ok.disabled = true;
    var check = function () { ok.disabled = !(reason.value.trim() && word.value.trim() === DELETE_WORD); };
    reason.oninput = check;
    word.oninput = check;
    var close = function () {
      $("delete-form").onsubmit = null;
      if (dlg.open) dlg.close();
    };
    $("delete-cancel").onclick = close;
    $("delete-suspend").onclick = function () { close(); suspend(p, null); };
    $("delete-form").onsubmit = function (ev) {
      ev.preventDefault();
      check();
      if (ok.disabled) return;
      ok.disabled = true;
      rpc("admin_delete_user", { target: p.id, reason: reason.value.trim() }).then(function (res) {
        close();
        var n = (res && res.runs_cancelled) || 0;
        toast("החשבון נמחק" + (n ? " · " + (n === 1 ? "ריצה אחת בוטלה" : n + " ריצות בוטלו") : ""));
        reloadOpen().catch(function () { /* the counts refresh next time */ }).then(function () { updateCounts(); go("#users"); });
      }).catch(function (e) {
        ok.disabled = false;
        if (code(e) === "user_not_found") { close(); toast("החשבון כבר נמחק"); return go("#users"); }
        if (["invalid_argument", "cannot_delete_admin", "other"].indexOf(code(e)) >= 0 && !missingRpc(e)) {
          err.textContent = errorText(e);
          err.hidden = false;
          return;
        }
        close();
        fail(e);
      });
    };
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    reason.focus();
  }

  // ------------------------------------------------------------------ test push (round 38) ---
  // One push to every device of one person, then its outcome (admin_send_test_push / admin_push_status, v36).

  function testPush(p, after) {
    confirmNote({
      title: "התראת בדיקה ל" + nameAge(p),
      text: "תגיע לכל המכשירים שלו/ה: ״בדיקת התראות מהצוות. אין צורך לעשות כלום.״ נשלחת גם אם כיבה/תה התראות על ריצות.",
      label: "הערה ליומן",
      ok: "שליחה",
      required: false
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_send_test_push", { target: p.id }).then(function (res) {
        if (!res || !res.queued) {
          toast("אין לו/ה מכשיר רשום, אז אין לאן לשלוח. המכשיר נרשם כשפותחים את האפליקציה ומאשרים התראות.");
          return after && after();
        }
        toast("נשלחה. בודקים אם הגיעה…");
        watchPush(res.outbox_id, 0, after);
      }).catch(fail);
    });
  }

  function watchPush(id, tries, after) {
    setTimeout(function () {
      rpc("admin_push_status", { id: id }).then(function (o) {
        if (!o.sent_at && tries < 10) return watchPush(id, tries + 1, after);
        if (!o.sent_at) toast("עוד לא נשלחה. אם זה נמשך, כדאי לבדוק את push-send ב־Supabase.");
        else if (!o.error) toast("ההתראה נמסרה למכשיר");
        else if (o.error === "no_tokens") toast("לא נמסרה: אין מכשיר תקין");
        else toast("לא נמסרה: " + o.error);
        if (after) after();
      }).catch(fail);
    }, 2000);
  }

  // ------------------------------------------------------------------ runs (round 38) ---
  // admin_runs (v36): עכשיו / היום / קרובות / שהיו, a search, one row per run; a row opens the run's page.

  var runs = { scope: "upcoming", search: "", rows: [], total: 0, token: 0, timer: null };
  var RUN_SCOPES = [["now", "עכשיו"], ["today", "היום"], ["upcoming", "קרובות"], ["past", "שהיו"]];

  // "היום" / "מחר" / "אתמול" / "יום ה׳ 23.10".
  function dayLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var k = dayKey(d);
    if (k === dayKey(new Date())) return "היום";
    if (k === dayKey(new Date(Date.now() + DAY))) return "מחר";
    if (k === dayKey(new Date(Date.now() - DAY))) return "אתמול";
    var wd = d.toLocaleDateString("he-IL", { weekday: "short", timeZone: "Asia/Jerusalem" }).replace(/^יום\s*/, "");
    return wd + " " + d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });
  }
  // Where a run stands: soon / running now / done.
  function runStatus(g) {
    var ms = new Date(g.starts_at).getTime() - Date.now();
    if (isNaN(ms)) return null;
    if (ms > 0 && ms < 6 * HOUR) {
      var m = Math.round(ms / MIN);
      return h("span", { class: "pill soon", text: m < 60 ? "בעוד " + m + " דק׳" : "בעוד " + duration(ms / 1000) });
    }
    if (ms <= 0 && ms > -2 * HOUR) return h("span", { class: "pill live", text: "רצים עכשיו" });
    if (ms <= 0) return h("span", { class: "pill done", text: "הסתיימה" });
    return null;
  }

  function runRow(g, compact) {
    var c = g.creator || {};
    var flags = [
      g.open_reports ? h("span", { class: "chip suspended", text: g.open_reports === 1 ? "דיווח פתוח" : g.open_reports + " דיווחים" }) : null,
      g.pending_requests ? h("span", { class: "chip warn", text: g.pending_requests === 1 ? "בקשה ממתינה" : g.pending_requests + " בקשות" }) : null,
      g.visibility === "private" ? h("span", { class: "chip", text: "פרטית" }) : null,
      g.crew_name ? h("span", { class: "chip", text: "קבוצה: " + g.crew_name }) : null
    ];
    return h("a", { class: "run-row" + (compact ? " compact" : ""), href: "#run/" + g.id },
      h("span", { class: "run-when" }, h("span", { class: "run-day", text: dayLabel(g.starts_at) }),
        h("span", { class: "run-clock num", dir: "ltr", text: clock(new Date(g.starts_at)) })),
      h("span", { class: "run-main" },
        h("b", { class: "run-title", text: title(g) }),
        h("span", { class: "run-sub", text: [g.place, g.area_label && g.area_label !== g.place ? g.area_label : null].filter(Boolean).join(" · ") }),
        compact ? null : g.caption ? h("span", { class: "run-caption", text: g.caption }) : null,
        h("span", { class: "chips" }, flags)),
      h("span", { class: "run-who" }, avatar(c), h("span", { class: "run-org", text: (c.name || "").trim() || "—" })),
      h("span", { class: "run-people" }, h("span", { class: "num", dir: "ltr", text: fmt(g.participants) + "/" + fmt(g.capacity) }),
        h("small", { text: "רצים" })),
      h("span", { class: "run-status" }, runStatus(g)));
  }

  function renderRuns() {
    var input = h("input", { type: "search", placeholder: "שם ריצה, מקום או מארגן/ת", "aria-label": "חיפוש ריצה", autocomplete: "off", value: runs.search });
    input.addEventListener("input", function () {
      clearTimeout(runs.timer);
      runs.timer = setTimeout(function () { runs.search = input.value.trim(); loadRuns(true); }, 350);
    });
    var scopes = h("div", { class: "filters", role: "group", "aria-label": "מתי" }, RUN_SCOPES.map(function (f) {
      return h("button", { type: "button", "aria-pressed": runs.scope === f[0] ? "true" : "false", onclick: function (ev) {
        runs.scope = f[0];
        Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (b) { b.setAttribute("aria-pressed", "false"); });
        ev.currentTarget.setAttribute("aria-pressed", "true");
        loadRuns(true);
      } }, f[1]);
    }));
    show(pageHead("ריצות", h("span", { class: "page-count num", id: "runs-total", dir: "ltr" })),
      h("div", { class: "toolbar" }, h("label", { class: "search" }, svg("M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4-4"), input), scopes),
      h("div", { id: "run-list" }));
    loadRuns(true);
  }

  function loadRuns(fresh) {
    var token = ++runs.token;
    if (fresh) runs.rows = [];
    var box = $("run-list");
    if (!box) return;
    if (fresh) {
      box.textContent = "";
      box.appendChild(h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים ריצות…"));
    }
    rpc("admin_runs", { scope: runs.scope, search: runs.search || null, max_rows: 50, skip: runs.rows.length }).then(function (rows) {
      if (token !== runs.token || !$("run-list")) return;
      rows = rows || [];
      runs.rows = runs.rows.concat(rows);
      if (rows.length) runs.total = Number(rows[0].total) || runs.rows.length;
      else if (fresh) runs.total = 0;
      $("runs-total").textContent = fmt(runs.total);
      box.textContent = "";
      if (!runs.rows.length) {
        var words = { now: "אין ריצות בשלוש השעות האחרונות או בשש הקרובות.", today: "אין ריצות היום.", upcoming: "אין ריצות קרובות.", past: "עוד לא היו ריצות." };
        box.appendChild(empty(runs.search ? "אין ריצות שמתאימות" : "אין כאן ריצות", runs.search ? "אפשר לחפש חלק מהשם, מהמקום או משם המארגן/ת." : words[runs.scope]));
        return;
      }
      box.appendChild(h("div", { class: "run-list" }, runs.rows.map(function (g) { return runRow(g, false); })));
      if (runs.rows.length < runs.total) {
        box.appendChild(h("button", { type: "button", class: "btn quiet more-btn", onclick: function () { loadRuns(false); } },
          "עוד " + fmt(Math.min(50, runs.total - runs.rows.length))));
      }
    }).catch(function (e) {
      if (token !== runs.token) return;
      box.textContent = "";
      if (missingRpc(e)) return box.appendChild(empty("השרת עוד לא עודכן", "רשימת הריצות תופיע אחרי שעדכון v36 יורץ ב־Supabase."));
      fail(e);
    });
  }

  // ------------------------------------------------------------------ one run (round 38) ---
  // admin_run (v36): the run, its runners and requests, its reports and log. No chat text (a reported line is shown
  // from its report). Removing it = cancelling: the runners get "הריצה בוטלה" (admin_remove_run).

  function renderRun(id) {
    loading("טוענים את הריצה…");
    rpc("admin_run", { run: id }).then(function (d) {
      var g = d.run || {}, c = g.creator || {};
      var cover = g.cover_url && /^https:\/\//.test(g.cover_url) ? h("img", { class: "run-cover", src: g.cover_url, alt: "", loading: "lazy" })
        : g.cover_photo && /^[a-z]+-[a-z]+-[0-9]{2}$/.test(g.cover_photo) ? h("img", { class: "run-cover", src: "../covers/thumb/" + g.cover_photo + ".jpg", alt: "", loading: "lazy" })
        : h("span", { class: "run-cover blank", "aria-hidden": "true" }, svg("M4 17c3-6 5 2 8-4s5-2 8-6"));
      var started = new Date(g.starts_at) <= new Date();
      var facts = h("dl", { class: "facts" });
      [["מתי", dayLabel(g.starts_at) + " " + clock(new Date(g.starts_at))],
        ["איפה", [g.place, g.area_label].filter(Boolean).join(" · ")],
        ["מרחק וקצב", [g.km ? fmt(g.km, 1) + " ק״מ" : "", pace(g.pace_seconds)].filter(Boolean).join(" · ")],
        ["מקומות", fmt(g.capacity)],
        ["מי רואה", g.visibility === "private" ? "פרטית (מוזמנים בלבד)" : "פתוחה לכולם"],
        ["אישור מארגן/ת", g.requires_approval ? "כן" : "לא"],
        ["רמת אמון מינימלית", g.min_trust ? TRUST[g.min_trust] || g.min_trust : ""],
        ["מסלול", g.has_route ? "צויר מסלול" : "רק נקודת מפגש"],
        ["קבוצה", g.crew ? h("a", { href: "#group/" + g.crew.id, text: g.crew.name }) : ""],
        ["הודעות בצ׳אט", fmt(g.messages)],
        ["נוצרה", ago(g.created_at)]].forEach(function (kv) {
        if (!kv[1]) return;
        facts.appendChild(h("dt", { text: kv[0] }));
        facts.appendChild(h("dd", null, kv[1]));
      });

      var people = (d.participants || []).map(function (p) {
        return h("a", { class: "list-row person-row", href: "#user/" + p.id },
          avatar(p),
          h("span", { class: "grow" }, h("b", { text: nameAge(p) }),
            h("span", { class: "ov-row-detail", text: (p.is_creator ? "מארגן/ת · " : "") + "הצטרף/ה " + ago(p.joined_at) })),
          trustChip(p.trust_level),
          p.attended === true ? h("span", { class: "chip ok", text: "הגיע/ה" }) : p.attended === false ? h("span", { class: "chip warn", text: "לא הגיע/ה" }) : null,
          p.suspended_at ? h("span", { class: "chip suspended", text: "מושעה/ית" }) : null);
      });
      var REQ = { pending: "ממתין/ה לאישור", approved: "אושר/ה", declined: "נדחה/תה", cancelled: "ביטל/ה" };
      var requests = (d.requests || []).map(function (r) {
        var p = r.person || {};
        return h("a", { class: "list-row person-row", href: "#user/" + p.id },
          avatar(p),
          h("span", { class: "grow" }, h("b", { text: nameAge(p) }),
            h("span", { class: "ov-row-detail", text: (r.message ? "״" + r.message + "״ · " : "") + ago(r.created_at) })),
          h("span", { class: "chip" + (r.status === "pending" ? " warn" : ""), text: REQ[r.status] || r.status }));
      });
      var reports = (d.reports || []).map(function (r) {
        var ctx = r.context && r.context.type === "message" ? "״" + (r.context.text || "") + "״" : "";
        return h("div", { class: "mini" },
          h("div", { class: "chips" }, h("span", { class: "chip reason-" + r.reason, text: REASONS[r.reason] || r.reason }),
            h("span", { class: "chip status", text: STATUS[r.status] || r.status })),
          ctx ? h("span", { class: "context-text", text: ctx }) : null,
          h("span", { class: "by", text: "על " + ((r.about && r.about.name) || "משתמש/ת") + " · ע״י " + ((r.reporter && r.reporter.name) || "משתמש/ת") +
            (r.details ? ": ״" + r.details + "״" : "") + " · " + ago(r.created_at) }),
          r.status === "open" ? h("a", { class: "btn text link", href: "#report/" + r.id, text: "לדיווח" }) : null);
      });
      var log = (d.log || []).map(logRow);

      var head = h("section", { class: "card run-head" },
        cover,
        h("div", { class: "run-head-text" },
          h("h1", { text: title(g) }),
          g.caption ? h("p", { class: "context-text", text: g.caption }) : null,
          h("span", { class: "who-sub", text: [dayLabel(g.starts_at) + " " + clock(new Date(g.starts_at)), g.place].filter(Boolean).join(" · ") }),
          h("span", { class: "chips" }, runStatus(g),
            g.visibility === "private" ? h("span", { class: "chip", text: "פרטית" }) : null,
            g.requires_approval ? h("span", { class: "chip", text: "באישור מארגן/ת" }) : null),
          h("a", { class: "who org", href: "#user/" + c.id }, avatar(c),
            h("span", { class: "who-text" }, h("span", { class: "who-name", text: nameAge(c) }), h("span", { class: "who-sub", text: "מארגן/ת · " + (TRUST[c.trust_level] || "") })))),
        h("div", { class: "actions" },
          h("button", { type: "button", class: "btn outline", onclick: function () { removeRun({ group_run_id: g.id }, started); } },
            started ? "הסרת הריצה…" : "ביטול הריצה והודעה לרצים…")));

      show(
        h("nav", { class: "crumbs", "aria-label": "מיקום" }, h("a", { href: "#runs", text: "ריצות" }), h("span", { "aria-hidden": "true", text: "›" }),
          h("span", { "aria-current": "page", text: title(g) })),
        head,
        h("div", { class: "u-grid" },
          h("div", { class: "u-col" },
            h("h2", { class: "section-title" }, "רצים ", h("span", { class: "num", dir: "ltr", text: fmt(people.length) + "/" + fmt(g.capacity) })),
            people.length ? h("div", { class: "list" }, people) : h("p", { class: "note", text: "אין רצים." }),
            requests.length ? [h("h2", { class: "section-title", text: "בקשות להצטרף" }), h("div", { class: "list" }, requests)] : null,
            Number(d.invites_pending) ? h("p", { class: "note", text: d.invites_pending + " הזמנות שעוד לא נענו." }) : null),
          h("div", { class: "u-col" },
            h("section", { class: "card" }, h("h2", { class: "ov-card-title", text: "פרטים" }), facts),
            h("h2", { class: "section-title", text: "דיווחים" }),
            reports.length ? h("div", { class: "list" }, reports) : h("p", { class: "note", text: "אין דיווחים על הריצה." }),
            h("h2", { class: "section-title", text: "יומן" }),
            log.length ? h("div", { class: "list" }, log) : h("p", { class: "note", text: "אין פעולות עדיין." }))));
    }).catch(function (e) {
      if (code(e) === "group_run_not_found") return show(empty("הריצה לא נמצאה", "אולי היא בוטלה או נמחקה."));
      if (missingRpc(e)) return show(empty("השרת עוד לא עודכן", "דף הריצה יופיע אחרי שעדכון v36 יורץ ב־Supabase."));
      fail(e);
    });
  }

  // ------------------------------------------------------------------ groups (round 58, v57, view only) ---
  // admin_crews_summary / admin_crews / admin_crew. In code a group is a crew. Nothing here changes a group, and the
  // chat's text never shows (only counts; a reported line is read from its report).

  var groups = { rows: [], total: 0, search: "", visibility: "", state: "open", sort: "activity", token: 0, timer: null };
  var GROUP_VIS = [["", "הכל"], ["public", "ציבוריות"], ["private", "פרטיות"]];
  var GROUP_STATES = [["open", "פתוחות"], ["quiet", "שקטות 14 יום"], ["closed", "נסגרו"], ["all", "הכל"]];
  var GROUP_SORTS = [["activity", "מיון: פעילות אחרונה"], ["members", "מיון: הכי הרבה חברים"], ["new", "מיון: חדשות"]];
  var WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  var CREW_STATUS = { forming: "בהתהוות", active: "פעילה", closed: "נסגרה" };
  var CREW_EVENTS = {
    opened: "הקבוצה נפתחה", joined: "הצטרפ/ה", left: "יצא/ה", renamed: "שינוי שם", run_opened: "נפתחה ריצה",
    closed: "הקבוצה נסגרה", chat_mode: "שינוי מי כותב בצ׳אט", schedule_set: "נקבעה ריצה קבועה",
    schedule_cleared: "הריצה הקבועה הופסקה", crew_made_public: "הפכה לציבורית", crew_made_private: "הפכה לפרטית",
    member_removed: "הוצא/ה מהקבוצה"
  };

  function paceRange(a, b) {
    var f = function (s) { s = Number(s); return s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : ""; };
    var x = f(a), y = f(b);
    // Isolated left to right, or the bidi algorithm prints "6:15–5:30" in a Hebrew line.
    var r = x && y ? (x === y ? x : x + "–" + y) : x || y;
    return r ? "\u2066" + r + "\u2069" : "";
  }
  function scheduleText(s) {
    if (!s || s.weekday === null || s.weekday === undefined) return "";
    return "כל " + (WEEKDAYS[s.weekday] || "") + " " + String(s.local_time || "").slice(0, 5) + (s.active === false ? " (מושהית)" : "");
  }
  function crewBadge(c, big) {
    if (c && c.photo_url && /^https:\/\//.test(c.photo_url)) {
      return h("img", { class: "crew-badge" + (big ? " big" : ""), src: c.photo_url, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
    }
    var el = h("span", { class: "crew-badge" + (big ? " big" : ""), "aria-hidden": "true", text: Array.from(((c && c.name) || "?").trim())[0] || "?" });
    el.style.background = TONES[hash((c && c.id) || "") % TONES.length];
    return el;
  }
  function visChip(v) { return v === "public" ? h("span", { class: "chip ink", text: "ציבורית" }) : h("span", { class: "chip", text: "פרטית" }); }

  function groupCount(label, value, sub, hot) {
    return h("div", { class: "ov-card" }, h("span", { class: "ov-card-label", text: label }),
      num(value, 0, "ov-card-value" + (hot ? " hot" : "")), h("span", { class: "ov-card-sub", text: sub || "" }));
  }

  function renderGroups() {
    var input = h("input", { type: "search", placeholder: "שם קבוצה, אזור או חבר/ה", "aria-label": "חיפוש קבוצה", autocomplete: "off", value: groups.search });
    input.addEventListener("input", function () {
      clearTimeout(groups.timer);
      groups.timer = setTimeout(function () { groups.search = input.value.trim(); loadGroups(true); }, 350);
    });
    var seg = function (label, list, key) {
      return h("div", { class: "filters", role: "group", "aria-label": label }, list.map(function (f) {
        return h("button", { type: "button", "aria-pressed": groups[key] === f[0] ? "true" : "false", onclick: function (ev) {
          groups[key] = f[0];
          Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (b) { b.setAttribute("aria-pressed", "false"); });
          ev.currentTarget.setAttribute("aria-pressed", "true");
          loadGroups(true);
        } }, f[1]);
      }));
    };
    var counts = h("section", { class: "ov-grid group-counts", "aria-label": "מספרים" },
      [0, 1, 2, 3].map(function () { return h("div", { class: "ov-card skel-card", "aria-hidden": "true" }); }));
    show(pageHead("קבוצות", h("span", { class: "page-count num", id: "groups-total", dir: "ltr" })),
      counts,
      h("div", { class: "toolbar" }, h("label", { class: "search" }, svg("M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4-4"), input),
        seg("גלוי", GROUP_VIS, "visibility"), seg("מצב", GROUP_STATES, "state"),
        selectBox("מיון", GROUP_SORTS, groups.sort, function (v) { groups.sort = v; loadGroups(true); })),
      h("div", { id: "group-list" }));
    rpc("admin_crews_summary").then(function (d) {
      if (!document.body.contains(counts)) return;
      d = d || {};
      var users = Number(d.users_total) || 0, members = Number(d.members) || 0;
      fill(counts,
        groupCount("פתוחות", d.open, fmt(d.with_schedule) + " עם ריצה קבועה"),
        groupCount("ציבוריות בגילוי", d.public, Number(d.pending_requests) === 1 ? "בקשת הצטרפות אחת ממתינה" : fmt(d.pending_requests) + " בקשות הצטרפות ממתינות"),
        groupCount("חברים בקבוצות", members, users ? Math.round((members / users) * 100) + "% מהמשתמשים" : ""),
        groupCount("דורשות מבט", d.crews_with_reports, Number(d.open_reports) === 1 ? "דיווח פתוח אחד" : Number(d.open_reports) ? fmt(d.open_reports) + " דיווחים פתוחים" : "אין דיווחים פתוחים", Number(d.crews_with_reports) > 0));
    }).catch(function () { if (document.body.contains(counts)) counts.remove(); });
    loadGroups(true);
  }

  function loadGroups(fresh) {
    var token = ++groups.token;
    if (fresh) groups.rows = [];
    var box = $("group-list");
    if (!box) return;
    if (fresh) {
      box.textContent = "";
      box.appendChild(h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים קבוצות…"));
    }
    rpc("admin_crews", { visibility: groups.visibility || null, state: groups.state, search: groups.search || null,
      sort: groups.sort, max_rows: 50, skip: groups.rows.length }).then(function (rows) {
      if (token !== groups.token || !$("group-list")) return;
      rows = rows || [];
      groups.rows = groups.rows.concat(rows);
      if (rows.length) groups.total = Number(rows[0].total) || groups.rows.length;
      else if (fresh) groups.total = 0;
      $("groups-total").textContent = fmt(groups.total);
      box.textContent = "";
      if (!groups.rows.length) {
        box.appendChild(empty(groups.search ? "אין קבוצות שמתאימות" : "אין כאן קבוצות",
          groups.search ? "אפשר לחפש חלק משם הקבוצה, מהאזור או משם של חבר/ה." : groups.state === "quiet" ? "כל הקבוצות הפתוחות היו פעילות בשבועיים האחרונים." : "קבוצה חדשה תופיע כאן."));
        return;
      }
      box.appendChild(h("div", { class: "crew-list" },
        h("div", { class: "crew-row crew-head", "aria-hidden": "true" },
          h("span", { class: "c-name", text: "קבוצה" }), h("span", { class: "c-members", text: "חברים" }),
          h("span", { class: "c-sched", text: "ריצה קבועה · הבאה" }), h("span", { class: "c-chat", text: "צ׳אט" }),
          h("span", { class: "c-flags", text: "דורש מבט" })),
        groups.rows.map(crewRow)));
      if (groups.rows.length < groups.total) {
        box.appendChild(h("button", { type: "button", class: "btn quiet more-btn", onclick: function () { loadGroups(false); } },
          "עוד " + fmt(Math.min(50, groups.total - groups.rows.length))));
      }
    }).catch(function (e) {
      if (token !== groups.token) return;
      box.textContent = "";
      if (missingRpc(e)) return box.appendChild(empty("השרת עוד לא עודכן", "רשימת הקבוצות תופיע אחרי שעדכון v57 יורץ ב־Supabase."));
      fail(e);
    });
  }

  function crewRow(c) {
    var flags = [
      c.open_reports ? h("span", { class: "chip suspended", text: c.open_reports === 1 ? "דיווח פתוח" : c.open_reports + " דיווחים" }) : null,
      c.pending_requests ? h("span", { class: "chip warn", text: c.pending_requests === 1 ? "בקשה ממתינה" : c.pending_requests + " בקשות" }) : null
    ];
    var sub = [c.area_label, paceRange(c.pace_min_s, c.pace_max_s)].filter(Boolean).join(" · ");
    return h("a", { class: "crew-row", href: "#group/" + c.id },
      h("span", { class: "c-name" }, crewBadge(c),
        h("span", { class: "crew-text" }, h("b", { class: "crew-title", text: c.name }),
          h("span", { class: "chips" }, visChip(c.visibility),
            c.status !== "active" ? h("span", { class: "chip", text: CREW_STATUS[c.status] || c.status }) : null,
            sub ? h("span", { class: "crew-sub", text: sub }) : null))),
      h("span", { class: "c-members" }, h("span", { class: "num", text: fmt(c.members) }),
        h("small", { text: c.admins === 1 ? " · מנהל/ת" : " · " + fmt(c.admins) + " מנהלים" })),
      h("span", { class: "c-sched" }, h("span", { text: scheduleText(c.schedule) || "בלי ריצה קבועה" }),
        h("small", { text: c.next_run_at ? "הבאה " + dayLabel(c.next_run_at) + " " + clock(new Date(c.next_run_at)) : "אין ריצה קרובה" })),
      h("span", { class: "c-chat" }, h("span", { text: c.last_message_at ? ago(c.last_message_at) : "עוד לא כתבו" }),
        h("small", { text: fmt(c.messages_7d) + " הודעות השבוע" })),
      h("span", { class: "c-flags chips" }, flags[0] || flags[1] ? flags : h("span", { class: "muted", text: "—" })));
  }

  // ------------------------------------------------------------------ one group (round 58) ---

  function renderGroup(id) {
    loading("טוענים את הקבוצה…");
    rpc("admin_crew", { crew: id }).then(function (d) {
      if (state.tab !== "groups" || location.hash !== "#group/" + id) return;
      d = d || {};
      var c = d.crew || {}, chat = d.chat || {}, members = d.members || [], reports = d.reports || [];
      var openReports = reports.filter(function (r) { return r.status === "open"; });
      var together = (d.runs || []).filter(function (g) { return new Date(g.starts_at) <= new Date(); }).length;
      var origin = c.origin_run;
      var facts = [c.area_label, paceRange(c.pace_min_s, c.pace_max_s) ? "קצב " + paceRange(c.pace_min_s, c.pace_max_s) : "",
        c.chat_mode === "admins" ? "צ׳אט: רק מנהלים כותבים" : "צ׳אט: כולם כותבים",
        c.invite_link_on ? "קישור הזמנה פעיל" : ""].filter(Boolean);

      var head = h("section", { class: "card crew-head-card" },
        crewBadge(c, true),
        h("div", { class: "crew-head-main" },
          h("div", { class: "crew-h1" }, h("h1", { class: "page-title", text: c.name || "קבוצה" }), visChip(c.visibility),
            h("span", { class: "chip " + (c.status === "active" ? "ok" : c.status === "closed" ? "" : "warn"), text: CREW_STATUS[c.status] || c.status })),
          c.blurb ? h("p", { class: "crew-blurb", text: "״" + c.blurb + "״" }) : null,
          h("p", { class: "crew-facts" }, facts.join(" · ")),
          h("p", { class: "note" }, origin
            ? ["נולדה מהריצה ", h("a", { href: "#run/" + origin.id, text: title(origin) }), " · " + shortDate(c.created_at)]
            : "נוצרה ישירות · " + shortDate(c.created_at),
            c.creator ? [" · על ידי ", h("a", { href: "#user/" + c.creator.id, text: nameAge(c.creator) })] : null,
            c.closed_at ? " · נסגרה " + shortDate(c.closed_at) : null)));

      var stats = h("div", { class: "stats crew-stats" },
        stat("חברים", members.length), stat("ריצות יחד", together), stat("הודעות ב־7 ימים", chat.messages_7d),
        stat("דיווחים פתוחים", openReports.length));

      var memberRows = members.map(function (m) {
        var how = m.via === "invite" ? "הוזמנ/ה" : m.via === "request" ? "אושר/ה מבקשה" : m.via === "link" ? "הצטרפ/ה בקישור" : "הצטרפ/ה מהריצה";
        return h("a", { class: "list-row person-row", href: "#user/" + m.id }, avatar(m),
          h("span", { class: "grow" }, h("span", { class: "who-name", text: nameAge(m) }),
            h("span", { class: "row-sub", text: [how + " " + shortDate(m.joined_at), fmt(m.runs_together) + " ריצות יחד", m.muted ? "השתיק/ה את הצ׳אט" : ""].filter(Boolean).join(" · ") })),
          h("span", { class: "chips" }, m.role === "admin" ? h("span", { class: "chip ink", text: "מנהל/ת" }) : null,
            m.suspended_at ? h("span", { class: "chip suspended", text: "מושעה" }) : null));
      });
      var requests = (d.requests || []).map(function (r) {
        var p = r.person || {};
        return h("a", { class: "list-row person-row", href: "#user/" + p.id }, avatar(p),
          h("span", { class: "grow" }, h("span", { class: "who-name", text: nameAge(p) }),
            h("span", { class: "row-sub", text: r.status === "pending" ? ago(r.created_at) + " · פג תוקף " + inDays(r.lapses_at) : "נדחתה " + (r.decided_at ? ago(r.decided_at) : "") })),
          r.status === "pending" ? h("span", { class: "chip warn", text: "ממתינה" }) : h("span", { class: "chip", text: "נדחתה" }));
      });
      var removals = (d.removals || []).map(function (r) {
        var p = r.person || {};
        return h("a", { class: "list-row person-row", href: "#user/" + p.id }, avatar(p),
          h("span", { class: "grow" }, h("span", { class: "who-name", text: nameAge(p) }),
            h("span", { class: "row-sub", text: ago(r.removed_at) + (r.removed_by ? " · על ידי " + (r.removed_by.name || "מנהל/ת") : "") })));
      });
      var section = function (id2, titleText, count, body, note) {
        return h("section", { class: "card", "aria-labelledby": id2 },
          h("h2", { class: "ov-card-title", id: id2 }, titleText, count !== null && count !== undefined ? h("span", { class: "head-num num", text: " " + fmt(count) }) : null),
          note ? h("p", { class: "note", text: note }) : null, body);
      };
      var kv = function (rows) {
        var dl = h("dl", { class: "facts" });
        rows.forEach(function (r) { if (r[1] === "" || r[1] === null || r[1] === undefined) return; dl.appendChild(h("dt", { text: r[0] })); dl.appendChild(h("dd", null, r[1])); });
        return dl;
      };
      var s = d.schedule;
      var upcoming = (d.runs || []).filter(function (g) { return new Date(g.starts_at) > new Date(); });
      var past = (d.runs || []).filter(function (g) { return new Date(g.starts_at) <= new Date(); });
      var runLink = function (g) {
        return h("a", { class: "list-row", href: "#run/" + g.id },
          h("span", { class: "grow" }, h("span", { class: "who-name", text: title(g) }), h("span", { class: "row-sub", text: dayLabel(g.starts_at) + " " + clock(new Date(g.starts_at)) })),
          h("span", { class: "num", dir: "ltr", text: fmt(g.participants) }), h("small", { class: "muted", text: "רצים" }));
      };

      show(h("a", { class: "back", href: "#groups" }, "› כל הקבוצות"),
        head, stats,
        h("div", { class: "u-grid" },
          h("div", { class: "u-col" },
            openReports.length ? h("section", { class: "card crew-alert", "aria-labelledby": "cr-rep" },
              h("h2", { class: "ov-card-title", id: "cr-rep", text: openReports.length === 1 ? "דיווח פתוח" : openReports.length + " דיווחים פתוחים" }),
              openReports.map(function (r) {
                return h("div", { class: "list-row" }, h("span", { class: "grow" },
                  h("span", { class: "who-name", text: (REASONS[r.reason] || r.reason) + (r.about && r.about.name ? " · על " + r.about.name : "") }),
                  h("span", { class: "row-sub", text: ago(r.created_at) + (r.context && r.context.type === "message" ? " · הודעה בצ׳אט" : "") })),
                  h("a", { class: "btn ink small", href: "#report/" + r.id, text: "לטיפול" }));
              })) : null,
            section("cr-mem", "חברים", members.length, members.length ? h("div", { class: "list flat" }, memberRows) : h("p", { class: "note", text: "אין חברים." })),
            requests.length ? section("cr-req", "בקשות הצטרפות", (d.requests || []).filter(function (r) { return r.status === "pending"; }).length,
              h("div", { class: "list flat" }, requests), "מנהלי הקבוצה מאשרים. כאן רק רואים.") : null,
            removals.length ? section("cr-rem", "הוצאו מהקבוצה", removals.length, h("div", { class: "list flat" }, removals),
              "רק מנהל/ת של הקבוצה יכול/ה להחזיר.") : null),
          h("div", { class: "u-col" },
            section("cr-sch", "ריצה קבועה", null, s ? kv([["מתי", scheduleText(s)], ["מרחק", s.km ? fmt(s.km, 1) + " ק״מ" : ""],
              ["נוצרה אחרונה", s.last_run_date ? shortDate(s.last_run_date) : "עוד לא"], ["עודכנה", ago(s.updated_at)]])
              : h("p", { class: "note", text: "אין ריצה קבועה. כל חבר/ה יכול/ה לפתוח ריצה לקבוצה." })),
            section("cr-runs", "ריצות", null, upcoming.length || past.length ? h("div", { class: "list flat" },
              upcoming.length ? h("span", { class: "list-label", text: "קרובות" }) : null, upcoming.map(runLink),
              past.length ? h("span", { class: "list-label", text: "היו" }) : null, past.map(runLink)) : h("p", { class: "note", text: "עוד לא היו ריצות." })),
            section("cr-chat", "צ׳אט", null, kv([["הודעה אחרונה", chat.last_message_at ? ago(chat.last_message_at) : "עוד לא כתבו"],
              ["הודעות בסך הכל", num(chat.messages)], ["הוסרו", num(chat.removed)], ["הזמנות ממתינות", num(d.invites_pending)]]),
              "תוכן הצ׳אט לא מוצג, רק סביב הודעה מדווחת."),
            (d.history || []).length ? section("cr-hist", "היסטוריה", null, kv((d.history || []).map(function (e) {
              return [CREW_EVENTS[e.event] || e.event, shortDate(e.created_at) + (e.subject && e.subject.name ? " · " + e.subject.name : "")];
            }))) : null)));
    }).catch(function (e) {
      if (missingRpc(e)) return show(h("a", { class: "back", href: "#groups" }, "› כל הקבוצות"), empty("השרת עוד לא עודכן", "דף הקבוצה יופיע אחרי שעדכון v57 יורץ ב־Supabase."));
      if (/crew_not_found/.test(String(e && e.message))) return show(h("a", { class: "back", href: "#groups" }, "› כל הקבוצות"), empty("הקבוצה לא נמצאה", "אולי היא נמחקה."));
      fail(e);
    });
  }

  // ------------------------------------------------------------------ מרוצים (round 58; v33's catalog) ---
  // admin_list_race_catalog: the catalog from 30 days ago on. admin_set_race_hidden hides one from the app (logged).

  var races = { rows: [], filter: "all" };
  var RACE_FILTERS = [["all", "הכל"], ["shown", "מוצגים"], ["hidden", "מוסתרים"]];

  function renderRaces() {
    loading("טוענים מרוצים…");
    rpc("admin_list_race_catalog").then(function (rows) {
      races.rows = rows || [];
      drawRaces();
    }).catch(function (e) {
      if (missingRpc(e)) return show(pageHead("מרוצים"), empty("השרת עוד לא עודכן", "רשימת המרוצים תופיע אחרי שעדכון v33 יורץ."));
      fail(e);
    });
  }
  function drawRaces() {
    var f = races.filter;
    var rows = races.rows.filter(function (r) { return f === "all" || (f === "hidden") === !!r.hidden; });
    var hiddenN = races.rows.filter(function (r) { return r.hidden; }).length;
    show(pageHead("מרוצים", h("span", { class: "page-count num", dir: "ltr", text: fmt(races.rows.length) })),
      h("p", { class: "note", text: "המרוצים שהאפליקציה מציעה ב״מתכוננים ל־״, מלפני 30 יום והלאה. מרוץ מוסתר לא מופיע באפליקציה." + (hiddenN ? " מוסתרים: " + hiddenN + "." : "") }),
      h("div", { class: "filters", role: "group", "aria-label": "סינון" }, RACE_FILTERS.map(function (x) {
        return h("button", { type: "button", "aria-pressed": f === x[0] ? "true" : "false", onclick: function () { races.filter = x[0]; drawRaces(); } }, x[1]);
      })),
      rows.length ? h("div", { class: "list" }, rows.map(raceRow))
        : empty(f === "hidden" ? "אין מרוצים מוסתרים" : "אין מרוצים", f === "hidden" ? "" : "מרוצים נוספים לקטלוג מהשרת."));
  }
  function raceRow(r) {
    var past = new Date(r.starts_on + "T23:59:59") < new Date();
    var sw = h("input", { type: "checkbox", role: "switch", checked: !r.hidden, "aria-label": (r.hidden ? "הצגת " : "הסתרת ") + r.name });
    sw.addEventListener("change", function () { setRaceHidden(r, !sw.checked, sw); });
    return h("div", { class: "list-row race-row" + (r.hidden ? " is-hidden" : "") },
      h("span", { class: "race-date" }, h("b", { class: "num", dir: "ltr", text: shortDay(r.starts_on) }),
        h("small", { text: past ? "עבר" : inDays(r.starts_on + "T12:00:00") })),
      h("span", { class: "grow" }, h("span", { class: "who-name", text: r.name }),
        h("span", { class: "row-sub", text: [r.city, (r.distances || []).join(" · "), r.confidence === "estimated" ? "תאריך משוער" : ""].filter(Boolean).join(" · ") })),
      r.url && /^https:\/\//.test(r.url) ? h("a", { class: "btn text small", href: r.url, target: "_blank", rel: "noopener noreferrer", text: "לאתר" }) : null,
      h("label", { class: "switch" }, sw, h("span", { class: "switch-text", text: r.hidden ? "מוסתר" : "מוצג" })));
  }
  function setRaceHidden(r, hidden, sw) {
    sw.disabled = true;
    rpc("admin_set_race_hidden", { id: r.id, hidden: hidden }).then(function () {
      r.hidden = hidden;
      drawRaces();
      toast(hidden ? "״" + r.name + "״ הוסתר מהאפליקציה" : "״" + r.name + "״ מוצג שוב", "ביטול", function () {
        rpc("admin_set_race_hidden", { id: r.id, hidden: !hidden }).then(function () { r.hidden = !hidden; if (state.tab === "races") drawRaces(); }).catch(fail);
      });
    }).catch(function (e) { sw.disabled = false; sw.checked = !r.hidden; fail(e); });
  }

  // ------------------------------------------------------------------ quick search (⌘K, round 38) ---
  // admin_search (v36): people and runs; ↑ ↓ to move, Enter to open, Esc to close.

  var finder = { timer: null, token: 0, items: [], active: -1 };

  function openFinder() {
    if (!state.signedIn) return;
    var dlg = $("finder"), input = $("finder-input");
    input.value = "";
    drawFinder([], "לפחות 2 אותיות. ↑ ↓ לבחירה, Enter לפתיחה.");
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    input.focus();
  }
  function closeFinder() {
    var dlg = $("finder");
    if (dlg.open) dlg.close();
  }

  function drawFinder(items, hint) {
    finder.items = items;
    finder.active = items.length ? 0 : -1;
    var list = $("finder-list");
    list.textContent = "";
    var lastKind = null;
    items.forEach(function (it, i) {
      if (it.kind !== lastKind) {
        list.appendChild(h("div", { class: "finder-group", role: "presentation", text: it.kind === "user" ? "משתמשים" : "ריצות" }));
        lastKind = it.kind;
      }
      list.appendChild(h("a", { class: "finder-item", id: "fi-" + i, role: "option", href: it.href, "aria-selected": i === 0 ? "true" : "false",
        onclick: function () { closeFinder(); } },
        it.kind === "user" ? avatar(it.person) : h("span", { class: "finder-run", "aria-hidden": "true" }, svg("M14 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 21l3-6 3 2v4M6.5 11.5l3-3.5 4 1.5 2.5 3h3M11 15l2-5")),
        h("span", { class: "who-text" }, h("span", { class: "who-name", text: it.title }), h("span", { class: "who-sub", dir: it.ltr ? "ltr" : null, text: it.sub })),
        it.chip ? h("span", { class: "chip suspended", text: it.chip }) : null));
    });
    $("finder-input").setAttribute("aria-expanded", items.length ? "true" : "false");
    $("finder-input").setAttribute("aria-activedescendant", items.length ? "fi-0" : "");
    $("finder-hint").textContent = hint || "";
    $("finder-hint").hidden = !hint;
  }

  function finderMove(d) {
    if (!finder.items.length) return;
    finder.active = (finder.active + d + finder.items.length) % finder.items.length;
    finder.items.forEach(function (it, i) { $("fi-" + i).setAttribute("aria-selected", i === finder.active ? "true" : "false"); });
    $("finder-input").setAttribute("aria-activedescendant", "fi-" + finder.active);
    $("fi-" + finder.active).scrollIntoView({ block: "nearest" });
  }

  function finderSearch() {
    var q = $("finder-input").value.trim();
    var token = ++finder.token;
    if (q.length < 2) return drawFinder([], "לפחות 2 אותיות. ↑ ↓ לבחירה, Enter לפתיחה.");
    $("finder-hint").hidden = false;
    $("finder-hint").textContent = "מחפשים…";
    rpc("admin_search", { q: q }).then(function (res) {
      if (token !== finder.token) return;
      var items = [];
      (res.users || []).forEach(function (u) {
        items.push({ kind: "user", href: "#user/" + u.id, person: u, title: (u.name || "").trim() || "ללא שם", sub: u.email || "", ltr: true,
          chip: u.suspended ? "מושעה/ית" : null });
      });
      (res.runs || []).forEach(function (g) {
        items.push({ kind: "run", href: "#run/" + g.id, title: title(g),
          sub: [dayLabel(g.starts_at) + " " + clock(new Date(g.starts_at)), g.place, fmt(g.participants) + " רצים"].filter(Boolean).join(" · ") });
      });
      drawFinder(items, items.length ? null : "לא נמצא משתמש או ריצה בשם הזה.");
    }).catch(function (e) {
      if (token !== finder.token) return;
      drawFinder([], missingRpc(e) ? "החיפוש יעבוד אחרי שעדכון v36 יורץ ב־Supabase." : "החיפוש נכשל. אפשר לנסות שוב.");
    });
  }

  // ------------------------------------------------------------------ הטבות ואירועים (round 57, v56) ---
  // admin_offers / admin_save_offer / admin_set_offer_status. The composer on one side, the app's card as a live preview
  // on the other, and every offer below it, grouped by state with the four counts (unique runners). Images go to the
  // offer-images bucket (admins with aal2 only), downscaled in the browser to a 1600 px wide JPEG first.

  var OFFER_KINDS = [["offer", "הטבה"], ["event", "אירוע"], ["update", "עדכון"]];
  var OFFER_KIND = { offer: "הטבה", event: "אירוע", update: "עדכון" };
  var OFFER_STATES = [["draft", "טיוטות"], ["live", "פעילות"], ["scheduled", "מתוזמנות"], ["ended", "הסתיימו"],
    ["archived", "בארכיון"]];
  var OFFER_STATE = { draft: "טיוטה", live: "פעילה", scheduled: "מתוזמנת", ended: "הסתיימה", archived: "בארכיון" };
  var OFFER_RADII = [5, 10, 20, 50];
  // City centres for the audience (approximate; a radius is drawn around them).
  var OFFER_CITIES = [
    ["תל אביב", 32.0853, 34.7818], ["ירושלים", 31.7683, 35.2137], ["חיפה", 32.794, 34.9896],
    ["באר שבע", 31.252, 34.7915], ["ראשון לציון", 31.973, 34.7925], ["פתח תקווה", 32.084, 34.8878],
    ["אשדוד", 31.8014, 34.6435], ["נתניה", 32.3215, 34.8532], ["חולון", 32.0158, 34.7874],
    ["רמת גן", 32.0684, 34.8248], ["גבעתיים", 32.0722, 34.8125], ["בת ים", 32.0132, 34.748],
    ["רחובות", 31.8928, 34.8113], ["נס ציונה", 31.9293, 34.7987], ["אשקלון", 31.6688, 34.5743],
    ["הרצליה", 32.1624, 34.8447], ["רמת השרון", 32.146, 34.839], ["רעננה", 32.1848, 34.8713],
    ["כפר סבא", 32.175, 34.907], ["הוד השרון", 32.15, 34.888], ["מודיעין", 31.898, 35.0104],
    ["חדרה", 32.434, 34.9196], ["עפולה", 32.6074, 35.2892], ["נצרת", 32.6996, 35.3035],
    ["כרמיאל", 32.919, 35.295], ["טבריה", 32.7922, 35.5312], ["אילת", 29.5577, 34.9519]
  ];
  var OFFER_IMAGE_MAX_W = 1600;
  var OFFER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
  // admin_save_offer's details (English, from the server) in Hebrew.
  var OFFER_DETAILS = [
    [/^kind/, "צריך לבחור סוג: הטבה, אירוע או עדכון."],
    [/^title/, "הכותרת: 2 עד 80 תווים."],
    [/^body/, "הטקסט: עד 500 תווים."],
    [/^business_name/, "שם בית העסק: עד 60 תווים."],
    [/^address/, "הכתובת: עד 100 תווים."],
    [/^code is for offers/, "קוד הנחה מתאים רק להטבה."],
    [/^code/, "קוד ההנחה: עד 40 תווים, בלי רווחים."],
    [/^link_url/, "הקישור צריך להתחיל ב־https:// (עד 300 תווים)."],
    [/^image_url/, "התמונה צריכה לעלות מכאן (offer-images)."],
    [/^event_at is required/, "לאירוע צריך תאריך ושעה."],
    [/^event_at/, "תאריך ושעה מתאימים רק לאירוע."],
    [/^sponsored/, "״בית העסק משלם״ צריך שם של בית עסק."],
    [/^an area|^area_label|^lat|^radius/, "האזור: עיר ורדיוס של 1 עד 100 ק״מ, או כל הארץ."],
    [/^ends_at is required/, "חסר תאריך סיום."],
    [/^ends_at/, "הסיום צריך להיות אחרי ההתחלה."],
    [/^status/, "אפשר לשמור רק כטיוטה או לפרסם."]
  ];

  var offers = { rows: [], token: 0, form: null, editing: null, ui: null, uploading: false };

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  // A datetime-local / date / time value (this browser's time zone) ↔ ISO.
  function localParts(iso) {
    if (!iso) return { date: "", time: "", both: "" };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { date: "", time: "", both: "" };
    var date = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    var time = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    return { date: date, time: time, both: date + "T" + time };
  }
  function localIso(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  function dM(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });
  }
  function offerDays(o) {
    if (o.kind === "event" && o.event_at) return dayLabel(o.event_at) + " " + clock(new Date(o.event_at));
    return dM(o.starts_at) + "–" + dM(o.ends_at);
  }
  function offerAudience(o) {
    return o.area_label ? o.area_label + " · " + fmt(o.radius_km) + " ק״מ" : "כל הארץ";
  }
  function offerDetail(e) {
    var d = String((e && e.details) || "");
    for (var i = 0; i < OFFER_DETAILS.length; i++) if (OFFER_DETAILS[i][0].test(d)) return OFFER_DETAILS[i][1];
    if (e && /offer_not_found/.test(String(e.message || ""))) return "הפרסום כבר לא קיים. רעננו את הרשימה.";
    return null;
  }

  // A new composer state, or one filled from an admin_offers row.
  function offerForm(o) {
    if (!o) {
      var end = new Date(Date.now() + 14 * DAY);
      end.setHours(23, 59, 0, 0);
      return { id: null, kind: "offer", title: "", body: "", business_name: "", address: "", code: "", link_url: "",
        image_url: "", event_date: "", event_time: "19:00", sponsored: false, city: "", radius_km: 10, starts: "",
        ends: localParts(end.toISOString()).both, endsTouched: false, push_requested: false, pushed_at: null, status: "draft",
        state: null };
    }
    var ev = localParts(o.event_at);
    var city = "";
    if (o.area_label) {
      city = o.area_label;
      var known = OFFER_CITIES.some(function (c) { return c[0] === o.area_label; });
      if (!known) OFFER_CITIES.push([o.area_label, o.lat, o.lon]);
    }
    return { id: o.id, kind: o.kind, title: o.title || "", body: o.body || "", business_name: o.business_name || "",
      address: o.address || "", code: o.code || "", link_url: o.link_url || "", image_url: o.image_url || "",
      event_date: ev.date, event_time: ev.time || "19:00", sponsored: !!o.sponsored, city: city,
      radius_km: o.radius_km || 10, starts: localParts(o.starts_at).both, ends: localParts(o.ends_at).both, endsTouched: true,
      push_requested: !!o.push_requested, pushed_at: o.pushed_at, status: o.status, state: o.state };
  }

  function renderOffers() {
    offers.form = offers.form || offerForm(null);
    var listBox = h("div", { class: "of-list", id: "offer-list" }, skeleton("טוענים הטבות…"));
    var formBox = h("div", { id: "offer-form" });
    var previewBox = h("div", { class: "card of-preview-card", id: "offer-preview" });
    offers.ui = { list: listBox, form: formBox, preview: previewBox };
    show(pageHead("הטבות ואירועים", null,
        h("button", { type: "button", class: "btn ink", onclick: function () { editOffer(null); } }, "פרסום חדש")),
      h("div", { class: "of-grid" }, formBox, h("div", { class: "of-side" }, previewBox)),
      listBox);
    drawOfferForm();
    loadOffers();
  }

  function loadOffers() {
    var token = ++offers.token;
    return rpc("admin_offers").then(function (rows) {
      if (token !== offers.token || state.tab !== "offers" || !offers.ui) return;
      offers.rows = rows || [];
      drawOfferList();
      // The open offer may have moved (published, paused, ended): keep its state chip right.
      if (offers.form && offers.form.id) {
        var cur = offers.rows.filter(function (r) { return r.id === offers.form.id; })[0];
        if (cur) { offers.form.state = cur.state; offers.form.status = cur.status; offers.form.pushed_at = cur.pushed_at; drawOfferActions(); }
      }
    }).catch(function (e) {
      if (token !== offers.token || !offers.ui) return;
      fill(offers.ui.list, missingRpc(e)
        ? empty("השרת עוד לא עודכן", "ההטבות יופיעו אחרי שעדכון v56 יורץ ב־Supabase.")
        : retryBox("לא הצלחנו לטעון את ההטבות.", loadOffers));
      if (!missingRpc(e)) fail(e);
    });
  }

  function drawOfferList() {
    var box = offers.ui.list;
    if (!offers.rows.length) {
      fill(box, emptyNote("הטבה, אירוע או עדכון שתפרסמו יופיעו כאן, עם כמה רצים ראו ולחצו.",
        "M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 8v10", "עוד אין פרסומים"));
      return;
    }
    var groups = OFFER_STATES.map(function (s) {
      var rows = offers.rows.filter(function (r) { return r.state === s[0]; });
      if (!rows.length) return null;
      return h("section", { class: "of-group", "aria-label": s[1] },
        h("h2", { class: "section-title" }, s[1], " ", h("span", { class: "page-count num", dir: "ltr", text: fmt(rows.length) })),
        h("div", { class: "run-list" }, rows.map(offerRow)));
    });
    fill(box, groups);
  }

  function offerCount(label, n, na) {
    return h("span", { class: "of-count" + (na ? " na" : "") },
      na ? h("span", { class: "num", text: "—" }) : num(n), h("span", { text: label }));
  }

  function offerRow(o) {
    var on = offers.form && offers.form.id === o.id;
    return h("button", { type: "button", class: "of-row" + (on ? " on" : ""), "aria-current": on ? "true" : null,
        onclick: function () { editOffer(o); } },
      h("span", { class: "of-row-main" },
        h("span", { class: "run-title", text: (on ? "✓ " : "") + o.title }),
        h("span", { class: "run-sub", text: [OFFER_KIND[o.kind] || o.kind, offerDays(o), offerAudience(o)].join(" · ") }),
        h("span", { class: "chips" },
          o.sponsored ? h("span", { class: "chip info", text: "בשיתוף " + (o.business_name || "") }) : null,
          o.pushed_at ? h("span", { class: "chip ok", text: "התראה נשלחה " + dM(o.pushed_at) }) :
            (o.push_requested && o.status === "published" && o.state === "scheduled"
              ? h("span", { class: "chip", text: "התראה בתחילת התוקף" }) : null))),
      h("span", { class: "of-counts" },
        offerCount("נראו", o.seen_count),
        offerCount("נפתחו", o.open_count),
        offerCount("העתיקו קוד", o.copy_count, !o.code),
        offerCount("לחצו על הקישור", o.link_count, !o.link_url)));
  }

  function editOffer(o) {
    if (offers.uploading) return toast("עוד מעלים את התמונה. רגע.");
    if (offers.form && offers.form.dirty) {
      return askYes({ title: "לעזוב בלי לשמור?", text: "השינויים בטופס לא נשמרו.", ok: "לעזוב" }).then(function (yes) {
        if (yes) { offers.form.dirty = false; editOffer(o); }
      });
    }
    offers.form = offerForm(o);
    drawOfferForm();
    if (offers.rows.length) drawOfferList();
    view().focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // The composer. Inputs write offers.form; every change redraws the preview only.
  function drawOfferForm() {
    var f = offers.form;
    var box = offers.ui.form;
    var err = h("p", { class: "form-error", id: "offer-error", role: "alert", hidden: true });
    var changed = function () { f.dirty = true; drawOfferPreview(); err.hidden = true; };
    var text = function (key, label, o) {
      o = o || {};
      var input = h(o.area ? "textarea" : "input", { id: "of-" + key, maxlength: o.max, dir: o.ltr ? "ltr" : null,
        rows: o.area ? 3 : null, type: o.area ? null : (o.type || "text"), inputmode: o.inputmode || null,
        placeholder: o.placeholder || null, autocomplete: "off", spellcheck: o.ltr ? "false" : null });
      input.value = f[key] || "";
      input.addEventListener("input", function () { f[key] = input.value; changed(); });
      return h("label", { class: "field" + (o.span ? " span2" : ""), hidden: o.hidden || null, "data-field": key },
        h("span", { class: "label", text: label }), input, o.hint ? h("span", { class: "note", text: o.hint }) : null);
    };

    var kinds = h("div", { class: "seg", role: "group", "aria-label": "סוג" }, OFFER_KINDS.map(function (k) {
      return h("button", { type: "button", "aria-pressed": f.kind === k[0] ? "true" : "false", onclick: function () {
        f.kind = k[0];
        f.dirty = true;
        if (f.kind !== "offer") f.code = "";
        drawOfferForm();
      } }, (f.kind === k[0] ? "✓ " : "") + k[1]);
    }));

    var evDate = h("input", { type: "date", id: "of-event-date" });
    evDate.value = f.event_date;
    var evTime = h("input", { type: "time", id: "of-event-time", step: 300 });
    evTime.value = f.event_time;
    var syncEnd = function () {
      // An event ends, by default, at the end of its day (until the end date is changed by hand).
      if (!f.endsTouched && f.event_date) {
        f.ends = f.event_date + "T23:59";
        if ($("of-ends")) $("of-ends").value = f.ends;
      }
    };
    evDate.addEventListener("input", function () { f.event_date = evDate.value; syncEnd(); changed(); });
    evTime.addEventListener("input", function () { f.event_time = evTime.value; changed(); });

    // Audience: the whole country, or a city and a radius.
    var cityMode = !!f.city;
    var citySel = h("select", { id: "of-city", "aria-label": "עיר" },
      h("option", { value: "" }, "בחירת עיר…"),
      OFFER_CITIES.map(function (c) { return h("option", { value: c[0], selected: c[0] === f.city }, c[0]); }));
    citySel.addEventListener("change", function () { f.city = citySel.value; changed(); });
    var aud = h("div", { class: "filters", role: "group", "aria-label": "מי רואה" },
      h("button", { type: "button", "aria-pressed": cityMode ? "false" : "true", onclick: function () { f.city = ""; f.dirty = true; drawOfferForm(); } },
        (cityMode ? "" : "✓ ") + "כל הארץ"),
      h("button", { type: "button", "aria-pressed": cityMode ? "true" : "false", onclick: function () {
        if (!f.city) f.city = OFFER_CITIES[0][0];
        f.dirty = true;
        drawOfferForm();
      } }, (cityMode ? "✓ " : "") + "עיר ורדיוס"));
    var radii = h("div", { class: "filters", role: "group", "aria-label": "רדיוס" }, OFFER_RADII.map(function (r) {
      var on = Number(f.radius_km) === r;
      return h("button", { type: "button", "aria-pressed": on ? "true" : "false", onclick: function () { f.radius_km = r; f.dirty = true; drawOfferForm(); } },
        (on ? "✓ " : "") + r + " ק״מ");
    }));

    var starts = h("input", { type: "datetime-local", id: "of-starts" });
    starts.value = f.starts;
    starts.addEventListener("input", function () { f.starts = starts.value; changed(); });
    var ends = h("input", { type: "datetime-local", id: "of-ends" });
    ends.value = f.ends;
    ends.addEventListener("input", function () { f.ends = ends.value; f.endsTouched = true; changed(); });

    var check = function (key, title, sub, disabled) {
      var cb = h("input", { type: "checkbox", id: "of-" + key, disabled: disabled || null });
      cb.checked = !!f[key];
      cb.addEventListener("change", function () { f[key] = cb.checked; changed(); });
      return h("label", { class: "of-check" }, cb, h("span", null, h("b", { text: title }), h("span", { class: "note", text: sub })));
    };
    var pushed = !!f.pushed_at;

    var fields = h("div", { class: "of-fields" },
      text("title", "כותרת", { span: true, max: 80, placeholder: f.kind === "event" ? "ריצת לילה ב[מקום]" : "15% הנחה על נעלי ריצה" }),
      text("body", "טקסט", { span: true, area: true, max: 500 }),
      text("business_name", f.kind === "event" ? "מי מארגן" : "בית העסק", { max: 60 }),
      text("address", f.kind === "event" ? "מקום" : "כתובת", { max: 100 }),
      f.kind === "offer" ? text("code", "קוד הנחה", { max: 40, ltr: true, hint: "בלי רווחים. לא חובה." }) : null,
      text("link_url", f.kind === "event" ? "קישור להרשמה" : "קישור", { max: 300, ltr: true, type: "url", inputmode: "url",
        placeholder: "https://" }),
      f.kind === "event"
        ? h("div", { class: "field span2" }, h("span", { class: "label", text: "מתי האירוע" }),
          h("div", { class: "of-pair" }, evDate, evTime))
        : null);

    var imgBox = h("div", { class: "of-image", id: "of-image" });
    drawOfferImage(imgBox);

    var actions = h("div", { class: "actions of-actions", id: "of-actions" });

    fill(box, h("form", { class: "card of-form", novalidate: true, onsubmit: function (ev) { ev.preventDefault(); saveOffer("published"); } },
      h("div", { class: "of-form-head" },
        h("h2", { class: "settings-title", text: f.id ? "עריכת פרסום" : "פרסום חדש" }),
        f.state ? h("span", { class: "chip status", text: OFFER_STATE[f.state] || f.state }) : null),
      kinds,
      fields,
      imgBox,
      h("div", { class: "field" }, h("span", { class: "label", text: "מי רואה" }), aud,
        cityMode ? h("div", { class: "of-area" }, h("span", { class: "select of-city" }, citySel, svg("M7 10l5 5 5-5")), radii) : null),
      h("div", { class: "of-pair" },
        h("label", { class: "field" }, h("span", { class: "label", text: "מתחיל" }), starts,
          h("span", { class: "note", text: f.id ? "" : "ריק = מרגע הפרסום" })),
        h("label", { class: "field" }, h("span", { class: "label", text: "נגמר" }), ends)),
      check("sponsored", "בית העסק משלם על הפרסום", "הכרטיס יסומן ״בשיתוף " + (f.business_name.trim() || "[שם בית העסק]") + "״."),
      check("push_requested", "לשלוח גם התראה",
        pushed ? "ההתראה כבר נשלחה (" + stamp(f.pushed_at) + "). פרסום נשלח בהתראה פעם אחת בלבד."
          : "רק למי שהפעיל ״הטבות ואירועים״ בהגדרות ונמצא באזור. עד התראה אחת בשבוע.", pushed),
      err,
      actions));
    drawOfferActions();
    drawOfferPreview();
  }

  function drawOfferActions() {
    var box = $("of-actions");
    if (!box) return;
    var f = offers.form;
    var published = f.id && f.status === "published";
    fill(box,
      h("button", { type: "submit", class: "btn ink", id: "of-publish" }, published ? "שמירה ופרסום" : "פרסום"),
      h("button", { type: "button", class: "btn quiet", onclick: function () { saveOffer("draft"); } },
        published ? "שמירה כטיוטה" : "שמירת טיוטה"),
      published ? h("button", { type: "button", class: "btn outline", onclick: function () { setOfferStatus(f.id, "draft"); } }, "הפסקה") : null,
      f.id && f.status !== "archived"
        ? h("button", { type: "button", class: "btn text", onclick: function () { setOfferStatus(f.id, "archived"); } }, "העברה לארכיון")
        : null);
  }

  function drawOfferImage(box) {
    var f = offers.form;
    var input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "sr-only", id: "of-file" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (file) uploadOfferImage(file);
    });
    fill(box,
      h("label", { class: "of-thumb" + (f.image_url ? " has" : ""), for: "of-file" },
        offers.uploading ? h("span", { text: "מעלים…" })
          : f.image_url ? h("img", { src: f.image_url, alt: "התמונה של הפרסום", referrerpolicy: "no-referrer" })
          : h("span", { text: "תמונה" })),
      input,
      h("span", { class: "of-image-text" },
        h("span", { class: "note", text: "תמונה רחבה. מוקטנת ל־1600 פיקסלים ונשמרת כ־JPEG, עד 2MB. בלי תמונה מופיע צבע." }),
        h("span", { class: "of-image-btns" },
          h("label", { class: "btn quiet small", for: "of-file" }, f.image_url ? "החלפה" : "בחירת תמונה"),
          f.image_url ? h("button", { type: "button", class: "btn text small", onclick: function () {
            f.image_url = "";
            f.dirty = true;
            drawOfferImage(box);
            drawOfferPreview();
          } }, "הסרה") : null)));
  }

  // Downscales to at most 1600 px wide and encodes JPEG (lower quality until it is under 2 MB).
  function downscaleImage(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("type"));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("decode")); };
        img.onload = function () {
          var w = Math.min(OFFER_IMAGE_MAX_W, img.naturalWidth || img.width);
          var hgt = Math.round((img.naturalHeight || img.height) * w / (img.naturalWidth || img.width));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = hgt;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, hgt);
          ctx.drawImage(img, 0, 0, w, hgt);
          var qualities = [0.85, 0.75, 0.6, 0.45];
          var tryAt = function (i) {
            canvas.toBlob(function (blob) {
              if (!blob) return reject(new Error("encode"));
              if (blob.size <= OFFER_IMAGE_MAX_BYTES || i === qualities.length - 1) {
                return blob.size <= OFFER_IMAGE_MAX_BYTES ? resolve(blob) : reject(new Error("size"));
              }
              tryAt(i + 1);
            }, "image/jpeg", qualities[i]);
          };
          tryAt(0);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadOfferImage(file) {
    var f = offers.form;
    var box = $("of-image");
    offers.uploading = true;
    if (box) drawOfferImage(box);
    var month = new Date().toISOString().slice(0, 7);
    var rand = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID()
      : String(Date.now()) + "-" + Math.floor(Math.random() * 1e9);
    var path = month + "/" + rand + ".jpg";
    downscaleImage(file).then(function (blob) {
      return sb.storage.from("offer-images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    }).then(function (res) {
      if (res && res.error) throw res.error;
      var pub = sb.storage.from("offer-images").getPublicUrl(path);
      f.image_url = pub && pub.data && pub.data.publicUrl ? pub.data.publicUrl : "";
      f.dirty = true;
    }).catch(function (e) {
      var m = String((e && e.message) || "");
      if (m === "type") toast("אפשר להעלות JPEG, PNG או WebP.");
      else if (m === "size") toast("התמונה גדולה מדי גם אחרי הקטנה. אפשר לנסות תמונה אחרת.");
      else if (m === "decode" || m === "read") toast("לא הצלחנו לקרוא את התמונה.");
      else if (/row-level security|unauthorized|403/i.test(m)) toast("אין הרשאה להעלות. צריך כניסה עם קוד מאפליקציית האימות.");
      else toast("ההעלאה נכשלה. אפשר לנסות שוב.");
    }).then(function () {
      offers.uploading = false;
      if (offers.form === f && $("of-image")) { drawOfferImage($("of-image")); drawOfferPreview(); }
    });
  }

  // The app's card (canvas board B1 / Main): a hero (the image, or a colour), the kind, title, meta line, sponsor line.
  function drawOfferPreview() {
    var box = offers.ui && offers.ui.preview;
    if (!box) return;
    var f = offers.form;
    var title = f.title.trim() || (f.kind === "event" ? "שם האירוע" : f.kind === "update" ? "כותרת העדכון" : "כותרת ההטבה");
    var biz = f.business_name.trim();
    var addr = f.address.trim();
    var endIso = localIso(f.ends);
    var evIso = f.event_date ? localIso(f.event_date + "T" + (f.event_time || "00:00")) : null;
    var meta;
    if (f.kind === "event") {
      meta = [addr || "[מקום]", evIso ? dayLabel(evIso) + " " + clock(new Date(evIso)) : "[מתי]"].join(" · ");
    } else if (f.kind === "update") {
      meta = f.body.trim().split("\n")[0].slice(0, 70) || "תחילת הטקסט";
    } else {
      meta = [biz || "[בית העסק]", f.city ? "[מרחק]" : null, endIso ? "עד " + dM(endIso) : null].filter(Boolean).join(" · ");
    }
    var hero = h("div", { class: "of-hero" });
    if (f.image_url) hero.appendChild(h("img", { src: f.image_url, alt: "", referrerpolicy: "no-referrer" }));
    else hero.style.background = TONES[hash(f.id || f.kind) % TONES.length];
    if (f.kind === "event" && evIso) {
      var d = new Date(evIso);
      hero.appendChild(h("span", { class: "of-datetile", "aria-hidden": "true" },
        h("span", { text: d.toLocaleDateString("he-IL", { month: "short", timeZone: "Asia/Jerusalem" }) }),
        h("b", { class: "num", text: d.toLocaleDateString("he-IL", { day: "numeric", timeZone: "Asia/Jerusalem" }) })));
    }
    hero.appendChild(h("span", { class: "of-tag", text: OFFER_KIND[f.kind] }));
    fill(box,
      h("span", { class: "ov-label", text: "תצוגה מקדימה באפליקציה" }),
      h("div", { class: "of-card" },
        hero,
        h("div", { class: "of-card-body" },
          h("b", { class: "of-card-title", text: title }),
          h("span", { class: "of-card-meta", text: meta }),
          f.sponsored && biz ? h("span", { class: "of-card-sponsor", text: "בשיתוף " + biz }) : null)),
      f.kind === "offer" && f.code.trim()
        ? h("div", { class: "of-code" }, h("span", { class: "note", text: "קוד ההנחה במסך ההטבה" }),
          h("b", { dir: "ltr", text: f.code.trim() }))
        : null,
      h("span", { class: "note", text: f.city
        ? "רק מי שנמצא עד " + fmt(f.radius_km) + " ק״מ מ" + f.city + " יראה את זה."
        : "כל מי שמשתמש באפליקציה יראה את זה." }));
  }

  function offerPayload(status) {
    var f = offers.form;
    var city = f.city ? OFFER_CITIES.filter(function (c) { return c[0] === f.city; })[0] : null;
    var p = {
      kind: f.kind,
      title: f.title.trim(),
      body: f.body.trim() || null,
      business_name: f.business_name.trim() || null,
      address: f.address.trim() || null,
      code: f.kind === "offer" ? (f.code.trim() || null) : null,
      link_url: f.link_url.trim() || null,
      image_url: f.image_url || null,
      event_at: f.kind === "event" && f.event_date ? localIso(f.event_date + "T" + (f.event_time || "00:00")) : null,
      sponsored: !!f.sponsored,
      area_label: city ? city[0] : null,
      lat: city ? city[1] : null,
      lon: city ? city[2] : null,
      radius_km: city ? Number(f.radius_km) : null,
      starts_at: localIso(f.starts),
      ends_at: localIso(f.ends),
      status: status,
      push_requested: !!f.push_requested
    };
    if (f.id) p.id = f.id;
    return p;
  }

  // What the form says before it goes to the server (the server checks it all again).
  function offerProblem(p) {
    if (p.title.length < 2 || p.title.length > 80) return ["title", "כותרת: 2 עד 80 תווים."];
    if (p.kind === "event" && !p.event_at) return ["event_at", "לאירוע צריך תאריך ושעה."];
    if (p.code && /\s/.test(p.code)) return ["code", "קוד ההנחה בלי רווחים."];
    if (p.link_url && !/^https:\/\/\S+$/.test(p.link_url)) return ["link_url", "הקישור צריך להתחיל ב־https://"];
    if (p.sponsored && !p.business_name) return ["business_name", "״בית העסק משלם״ צריך שם של בית עסק."];
    if (offers.form.city && !p.area_label) return ["city", "צריך לבחור עיר, או ״כל הארץ״."];
    if (!p.ends_at) return ["ends", "חסר תאריך סיום."];
    var start = p.starts_at ? new Date(p.starts_at).getTime() : Date.now();
    if (new Date(p.ends_at).getTime() <= start) return ["ends", "הסיום צריך להיות אחרי ההתחלה."];
    return null;
  }

  function offerError(text, key) {
    var err = $("offer-error");
    if (!err) return toast(text);
    err.textContent = text;
    err.hidden = false;
    var input = key ? $("of-" + key) : null;
    if (input && input.focus) input.focus();
  }

  function saveOffer(status) {
    if (offers.uploading) return offerError("עוד מעלים את התמונה. רגע.");
    var f = offers.form;
    var p = offerPayload(status);
    var bad = offerProblem(p);
    if (bad) return offerError(bad[1], bad[0] === "event_at" ? "event-date" : bad[0]);
    var willPush = status === "published" && p.push_requested && !f.pushed_at;
    var ask = willPush
      ? askYes({
        title: "לפרסם ולשלוח התראה?",
        text: (p.starts_at && new Date(p.starts_at).getTime() > Date.now()
          ? "ההתראה תצא כשהתוקף יתחיל (" + stamp(p.starts_at) + ")"
          : "ההתראה תצא עכשיו") + " למי שהפעיל ״הטבות ואירועים״" + (p.area_label ? " ונמצא עד " + p.radius_km + " ק״מ מ" + p.area_label : "") +
          ", חוץ ממי שקיבל התראה כזו בשבוע האחרון. אי אפשר לבטל התראה שיצאה.",
        ok: "פרסום ושליחה"
      })
      : Promise.resolve(true);
    ask.then(function (yes) {
      if (!yes) return;
      var btns = document.querySelectorAll("#of-actions .btn");
      Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
      rpc("admin_save_offer", { offer: p }).then(function (id) {
        toast(status === "published" ? (willPush ? "פורסם, וההתראה בדרך" : "פורסם") : "נשמר כטיוטה");
        offers.form.id = id;
        return loadOffers().then(function () {
          var row = offers.rows.filter(function (r) { return r.id === id; })[0];
          if (row && state.tab === "offers") { offers.form = offerForm(row); drawOfferForm(); drawOfferList(); }
        });
      }).catch(function (e) {
        Array.prototype.forEach.call(btns, function (b) { b.disabled = false; });
        if (missingRpc(e)) return offerError("השרת עוד לא עודכן לגרסה הזו (v56). מריצים את העדכון ב־Supabase.");
        var c = code(e);
        if (c === "invalid_argument" || /offer_not_found/.test(String(e && e.message))) {
          return offerError(offerDetail(e) || errorText(e));
        }
        fail(e);
      });
    });
  }

  function setOfferStatus(id, status) {
    var row = offers.rows.filter(function (r) { return r.id === id; })[0];
    var prev = (row && row.status) || offers.form.status;
    rpc("admin_set_offer_status", { offer: id, status: status }).then(function () {
      var undo = function () {
        rpc("admin_set_offer_status", { offer: id, status: prev }).then(function () {
          toast("בוטל");
          refreshOffer(id);
        }).catch(fail);
      };
      toast(status === "archived" ? "הועבר לארכיון" : status === "draft" ? "הפרסום הופסק. הוא חזר לטיוטות." : "פורסם", "ביטול", undo);
      refreshOffer(id);
    }).catch(function (e) {
      if (/offer_not_found/.test(String(e && e.message))) { toast("הפרסום כבר לא קיים."); return loadOffers(); }
      fail(e);
    });
  }

  function refreshOffer(id) {
    return loadOffers().then(function () {
      if (state.tab !== "offers" || !offers.form || offers.form.id !== id) return;
      var row = offers.rows.filter(function (r) { return r.id === id; })[0];
      offers.form = row ? offerForm(row) : offerForm(null);
      drawOfferForm();
      drawOfferList();
    });
  }

  // A yes / no question (the push confirmation). Resolves true on yes.
  function askYes(o) {
    return new Promise(function (resolve) {
      var dlg = $("ask");
      $("ask-title").textContent = o.title;
      $("ask-text").textContent = o.text || "";
      $("ask-ok").textContent = o.ok;
      var done = function (v) {
        $("ask-form").onsubmit = null;
        $("ask-cancel").onclick = null;
        dlg.onclose = null;
        if (dlg.open) dlg.close();
        resolve(v);
      };
      $("ask-form").onsubmit = function (ev) { ev.preventDefault(); done(true); };
      $("ask-cancel").onclick = function () { done(false); };
      dlg.onclose = function () { done(false); };
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      $("ask-ok").focus();
    });
  }

  // ------------------------------------------------------------------ "עוד" (phone, round 38) ---

  function accountCard() {
    return h("section", { class: "card account" },
      h("span", { class: "note", text: "מחובר/ת בתור" }),
      h("b", { dir: "ltr", text: state.email }),
      h("button", { type: "button", class: "btn quiet", onclick: signOut }, "יציאה"));
  }

  function renderMore() {
    var link = function (href, text, icon) {
      return h("a", { class: "list-row more-row", href: href }, h("span", { class: "dev-icon", "aria-hidden": "true" }, svg(icon)),
        h("span", { class: "grow", text: text }), svg("M15 6l-6 6 6 6"));
    };
    show(pageHead("עוד"),
      h("nav", { class: "list", "aria-label": "עוד מדורים" },
        link("#runs", "ריצות", "M14 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 21l3-6 3 2v4M6.5 11.5l3-3.5 4 1.5 2.5 3h3M11 15l2-5"),
        link("#offers", "הטבות ואירועים", "M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 8v10"),
        link("#races", "מרוצים", "M5 21V4M5 4h11l-2 4 2 4H5"),
        link("#system", "מערכת והגדרות", "M3 12h4l2-5 4 10 2-5h6")),
      accountCard());
  }

  // ------------------------------------------------------------------ boot ---

  function wireChrome() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sign-out]"), function (b) { b.addEventListener("click", signOut); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-search]"), function (b) { b.addEventListener("click", openFinder); });
    // A menu link to the page already open reloads it (the hash does not change).
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      a.addEventListener("click", function () {
        if (location.hash === a.getAttribute("href")) { route(); view().focus({ preventScroll: true }); }
      });
    });
    window.addEventListener("hashchange", function () {
      if ($("finder").open) closeFinder();
      route();
      view().focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
    // Crossing the computer / phone width with no page named: start where that layout starts.
    var onWidth = function () { if (!location.hash || (location.hash === "#more" && WIDE.matches)) route(); };
    if (WIDE.addEventListener) WIDE.addEventListener("change", onWidth);
    document.addEventListener("click", function (ev) { if (!ev.target.closest(".menu-wrap")) closeMenus(); });
    // A fixed menu would drift from its row.
    window.addEventListener("scroll", closeMenus);
    window.addEventListener("resize", closeMenus);
    // ⌘K / Ctrl+K anywhere, or "/" outside a field: the quick search.
    document.addEventListener("keydown", function (ev) {
      var typing = /^(input|textarea|select)$/i.test((ev.target && ev.target.tagName) || "") || (ev.target && ev.target.isContentEditable);
      if ((ev.key === "k" || ev.key === "K") && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); openFinder(); }
      else if (ev.key === "/" && !typing && !document.querySelector("dialog[open]")) { ev.preventDefault(); openFinder(); }
    });
    var input = $("finder-input");
    input.addEventListener("input", function () {
      clearTimeout(finder.timer);
      finder.timer = setTimeout(finderSearch, 250);
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); finderMove(1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); finderMove(-1); }
      else if (ev.key === "Enter") {
        ev.preventDefault();
        var it = finder.items[finder.active];
        if (it) { closeFinder(); location.hash = it.href; }
      }
    });
    // A click on the dimmed backdrop closes it.
    $("finder").addEventListener("click", function (ev) { if (ev.target === $("finder")) closeFinder(); });
  }

  function boot() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      show(empty("הדף לא נטען עד הסוף", "בדקו את החיבור ונסו לרענן."));
      return;
    }
    // The admin session is kept in localStorage (shared by the browser's tabs). A tab-only session (sessionStorage,
    // PRA-27 on 2026-10-21) broke signing in: Supabase's default email has a sign-in link, which opens a new tab, and
    // the tab that asked for the email never got the session. Every admin call still needs MFA (aal2) on the server.
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "letsrun-admin" }
    });
    wireChrome();
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") showSignIn();
      // Signed in from the email's link in another tab (or by the link landing here): this tab goes on to the
      // authenticator step too, unless it is already in.
      if (event === "SIGNED_IN" && session && !state.signedIn && !entering) {
        storageSet(PENDING_KEY, null);
        enter(session);
      }
    });
    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session) enter(session);
      else showSignIn();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
