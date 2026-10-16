// Admin page for בוא נרוץ (round 24, sketch A). Static: supabase-js from the CDN, the project's URL and anon key
// (public by design: the apps ship the same key, and every admin_* RPC checks private.admins on the server).
// Sign-in: an email one-time code. Rendering builds DOM nodes (textContent only, never innerHTML with data).
(function () {
  "use strict";

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
    newsletter_exported: "ייצוא מנויי הניוזלטר"
  };
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
    ["crew_rename", "שינויי שם של קבוצה"]
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
    tab: "overview",
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
      "group_run_not_found", "report_not_found", "flag_not_found"];
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
      case "session": return "החיבור פג. נכנסים שוב.";
      default: return "משהו השתבש. אפשר לנסות שוב.";
    }
  }
  // Every failed admin action ends here: no access, an expired session, or a calm message.
  function fail(e) {
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

  function showSignIn(prefill) {
    $("tabs").hidden = true;
    $("who").hidden = true;
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
    $("tabs").hidden = true;
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
    $("tabs").hidden = true;
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

  function enter(session) {
    state.email = (session.user && session.user.email) || "";
    $("who").textContent = state.email;
    $("who").hidden = !state.email;
    $("sign-out").hidden = false;
    loading("בודקים הרשאה…");
    Promise.all([rpc("admin_reports", { status: "open", max_rows: 200 }), rpc("admin_flags")])
      .then(function (res) {
        state.openReports = res[0] || [];
        state.flags = res[1] || [];
        updateCounts();
        $("tabs").hidden = false;
        route();
      })
      .catch(function (e) {
        if (code(e) === "not_admin") return showDenied();
        if (code(e) === "mfa_required") return secondStep();
        fail(e);
        show(empty("לא הצלחנו לטעון", "בדקו את החיבור ונסו לרענן את הדף."));
      });
  }

  function updateCounts() {
    var r = $("count-reports"), f = $("count-flags");
    r.textContent = String(state.openReports.length);
    r.hidden = state.openReports.length === 0;
    f.textContent = String(state.flags.length);
    f.hidden = state.flags.length === 0;
  }

  function setTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll(".tabs [role=tab]"), function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }

  function route() {
    if (!sb || $("tabs").hidden) return;
    var m = location.hash.match(/^#(report|user)\/([0-9a-f-]{36})$/i);
    if (m && m[1] === "report") { setTab("reports"); return renderOneReport(m[2]); }
    if (m && m[1] === "user") { setTab(""); return renderUser(m[2]); }
    var tab = (location.hash || "#overview").slice(1);
    if (["overview", "users", "reports", "flags", "words", "log", "settings"].indexOf(tab) < 0) tab = "overview";
    setTab(tab);
    if (tab === "overview") return renderOverview();
    if (tab === "users") return renderUsers();
    if (tab === "reports") return renderReports();
    if (tab === "flags") return renderFlags();
    if (tab === "words") return renderWords();
    if (tab === "settings") return renderSettings();
    return renderLog(true);
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

  function renderReports() {
    var filters = h("div", { class: "filters", role: "group", "aria-label": "סינון" },
      [["open", "פתוחים"], ["handled", "טופלו"], ["all", "הכל"]].map(function (f) {
        return h("button", {
          type: "button",
          "aria-pressed": state.filter === f[0] ? "true" : "false",
          onclick: function () { state.filter = f[0]; renderReports(); }
        }, f[1]);
      }));
    if (state.filter === "open") {
      return reloadOpen().then(function () {
        show(filters, state.openReports.length
          ? state.openReports.map(function (r) { return reportCard(r); })
          : empty("אין דיווחים פתוחים", "כל הדיווחים טופלו. דיווח חדש יגיע גם במייל."));
      }).catch(fail);
    }
    loading("טוענים דיווחים…");
    return rpc("admin_reports", { status: null, max_rows: 200 }).then(function (rows) {
      rows = (rows || []).filter(function (r) { return state.filter === "all" || r.report_status !== "open"; });
      state.listReports = rows;
      show(filters, rows.length ? rows.map(function (r) { return reportCard(r); }) : empty("אין כאן דיווחים", ""));
    }).catch(fail);
  }

  function renderOneReport(id) {
    var found = state.openReports.filter(function (r) { return r.id === id; })[0];
    var draw = function (r) {
      show(
        h("button", { type: "button", class: "btn text back", onclick: function () { go("#reports"); } }, "→ לכל הדיווחים"),
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
          removed ? h("span", { class: "context-text removed", text: "ההודעה הוסרה מהצ׳אט" }) : null));
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
          c.place ? h("span", { class: "note", text: c.place + (c.starts_at ? " · " + stamp(c.starts_at) : "") }) : null));
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
        actions.appendChild(h("button", { type: "button", class: "btn quiet", onclick: function () { go("#user/" + p.id); } }, "לפרופיל המלא"));
      }
      actions.appendChild(h("button", { type: "button", class: "btn text", onclick: function () { dismiss(r); } }, "סגירה"));
    } else {
      actions.appendChild(h("button", { type: "button", class: "btn quiet", onclick: function () { go("#user/" + p.id); } }, "לפרופיל המלא"));
      actions.appendChild(h("button", { type: "button", class: "btn text", onclick: function () { reopen(r); } }, "פתיחה מחדש"));
    }

    return h("article", { class: "card" + (highlight ? " highlight" : ""), "aria-label": "דיווח על " + nameAge(p) },
      h("button", { type: "button", class: "who", onclick: function () { go("#user/" + p.id); }, "aria-label": "לפרופיל של " + nameAge(p) },
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

  function renderFlags() {
    loading("טוענים סימונים…");
    rpc("admin_flags").then(function (rows) {
      state.flags = rows || [];
      updateCounts();
      if (!state.flags.length) return show(empty("אין סימונים פתוחים", "משתמש/ת מסומן/ת כשיש 3 מדווחים או 5 חוסמים."));
      show(state.flags.map(function (f) {
        var p = f.person || { id: f.user_id };
        return h("article", { class: "card", "aria-label": "סימון של " + nameAge(p) },
          h("button", { type: "button", class: "who", onclick: function () { go("#user/" + f.user_id); }, "aria-label": "לפרופיל של " + nameAge(p) },
            avatar(p),
            h("span", { class: "who-text" }, h("span", { class: "who-name", text: nameAge(p) }), h("span", { class: "who-sub", text: personSub(p) })),
            h("span", { class: "when", text: ago(f.flagged_at) })),
          h("div", { class: "chips" },
            h("span", { class: "chip", text: f.reporters_90d + " מדווחים · " + f.blockers_90d + " חוסמים ב־90 יום" }),
            h("span", { class: "chip", text: f.open_reports + " דיווחים פתוחים" }),
            p.suspended_at ? h("span", { class: "chip suspended", text: "מושעה/ית" }) : null),
          h("div", { class: "actions" },
            h("button", { type: "button", class: "btn ink", onclick: function () { reviewFlag(f, p); } }, "נבדק"),
            h("button", { type: "button", class: "btn quiet", onclick: function () { go("#user/" + f.user_id); } }, "לפרופיל המלא")));
      }));
    }).catch(fail);
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
      show(form, h("p", { class: "note", text: "המילים נשמרות בצורה מנורמלת (בלי ניקוד, אותיות סופיות רגילות). נבדקות מילים שלמות." }), list);
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
    if ((l.action === "users_viewed" || l.action === "newsletter_exported") && l.context && typeof l.context.rows === "number") {
      what += " · " + l.context.rows + " שורות";
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
          "לפרופיל של " + l.target_name)
        : null);
  }

  function renderLog(fresh) {
    if (fresh) { state.log = []; state.logDone = false; loading("טוענים את היומן…"); }
    var before = state.log.length ? state.log[state.log.length - 1].created_at : null;
    rpc("admin_log", { max_rows: 50, before: before }).then(function (rows) {
      rows = rows || [];
      state.log = state.log.concat(rows);
      state.logDone = rows.length < 50;
      if (!state.log.length) return show(empty("עוד אין פעולות", "כל פעולה שלך נשמרת כאן."));
      show(h("div", { class: "list" }, state.log.map(logRow)),
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

      show(limitsForm, versionsForm);
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
  var ov = { token: 0, ui: null, healthAt: null, ticker: null, missing: false };

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
  function emptyNote(text) {
    return h("div", { class: "ov-empty" }, svg("M4 19h16M7 15v-3M12 15V8M17 15v-5"), h("b", { text: "עוד אין מספיק נתונים" }),
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
    if (token !== ov.token || state.tab !== "overview" || ov.missing) return false;
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
      h("span", { text: "״מבט על״ יופיע אחרי שעדכון v27 יורץ ב־Supabase. שאר הלשוניות עובדות כרגיל." })));
  }

  function renderOverview() {
    ov.token++;
    ov.missing = false;
    ov.healthAt = null;
    var ui = ov.ui = {
      status: h("section", { class: "ov-status", "aria-live": "polite" }),
      range: h("div", { class: "filters", role: "group", "aria-label": "טווח ימים" }),
      countsTitle: h("h2", { class: "ov-label", id: "ov-counts" }),
      counts: h("section", { class: "ov-grid", "aria-labelledby": "ov-counts" }),
      chart: h("section", { class: "card ov-chart", "aria-labelledby": "ov-chart-title" }),
      health: h("section", { class: "list ov-health", "aria-labelledby": "ov-health-title" }),
      retention: h("section", { class: "card ov-ret", "aria-labelledby": "ov-ret-title" })
    };
    show(ui.status, ui.range, ui.countsTitle, ui.counts, ui.chart,
      h("h2", { class: "ov-label", id: "ov-health-title", text: "האם הכל עובד (24 שעות אחרונות)" }), ui.health,
      ui.retention);
    drawRange();
    loadHealth();
    loadRange();
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
          loadRange();
        }
      }, h("span", { class: "num", dir: "ltr", text: String(n) }), " ימים"));
    });
    ui.countsTitle.textContent = "כמה · " + state.range + " ימים אחרונים";
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
      loadRange();
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
    }));
  }

  // ---- counts, chart, retention (admin_overview + admin_metrics, by range)

  function loadRange() {
    var ui = ov.ui, token = ov.token, days = state.range;
    ui.counts.setAttribute("aria-busy", "true");
    ui.counts.textContent = "";
    for (var i = 0; i < 6; i++) ui.counts.appendChild(h("div", { class: "ov-card skel-card", "aria-hidden": "true" }));
    ui.counts.appendChild(h("p", { class: "sr-only", text: "סופרים משתמשים וריצות…" }));
    fill(ui.chart, skeleton("מציירים את הגרף…", "chart"));
    ui.chart.setAttribute("aria-busy", "true");
    fill(ui.retention, skeleton("מחשבים מי חזר…", "table"));
    ui.retention.setAttribute("aria-busy", "true");

    ovCall("admin_overview", { days: days }).then(function (res) {
      if (!ovUsable(token, res) || days !== state.range) return;
      if (!res.ok) {
        fill(ui.counts, retryBox("לא הצלחנו לטעון את המספרים.", retryRange));
        fill(ui.chart, h("h2", { class: "ov-card-title", id: "ov-chart-title", text: "ריצות לפי יום" }),
          retryBox("לא הצלחנו לטעון את הגרף.", retryRange));
        return;
      }
      drawCounts(res.data || {});
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
  function retryRange() { ov.token++; loadHealthIfFailed(); loadRange(); }
  function loadHealthIfFailed() { if (!ov.healthAt) loadHealth(); }

  function countCard(label, value, digits, sub) {
    return h("div", { class: "ov-card" },
      h("span", { class: "ov-card-label", text: label }),
      num(value, digits, "ov-card-value"),
      h("span", { class: "ov-card-sub" }, sub));
  }

  function drawCounts(d) {
    var u = d.users || {}, r = d.runs || {}, a = d.activity || {};
    var avg = r.avg_participants_in_range;
    fill(ov.ui.counts,
      countCard("משתמשים", u.total, 0, ["+", num(u.new_in_range), " חדשים בטווח"]),
      countCard("פעילים היום", u.active_today, 0, [num(u.active_7d), " השבוע"]),
      countCard("ריצות קרובות", r.upcoming_total, 0, [num(r.today), " מהן היום"]),
      countCard("ריצות שקרו", r.happened_in_range, 0,
        avg === null || avg === undefined ? "עם משתתפים, בטווח" : ["בממוצע ", num(avg, 1), " משתתפים"]),
      countCard("הצטרפויות", a.joins_in_range, 0,
        Number(a.join_requests_pending) === 1 ? "בקשה אחת ממתינה" : [num(a.join_requests_pending), " בקשות ממתינות"]),
      countCard("ק״מ שהוקלטו", a.total_km_in_range, 1, [num(a.recorded_runs_in_range), " ריצות מוקלטות"]));
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

  // Every user's email (the server logs each call, counts only). Export covers newsletter subscribers only.
  var users = { rows: [], done: false, search: "", only: false, token: 0, timer: null };

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

  function userRow(u) {
    return h("button", { type: "button", class: "user-row", onclick: function () { go("#user/" + u.id); } },
      avatar(u),
      h("span", { class: "who-text" },
        h("span", { class: "who-name", text: (u.name && u.name.trim()) || "ללא שם" }),
        h("span", { class: "user-email", dir: "ltr", text: u.email || (u.provider === "anonymous" ? "חשבון אנונימי" : "—") })),
      h("span", { class: "user-side" },
        u.newsletter ? h("span", { class: "chip sub", text: "מנוי/ה" }) : null,
        u.suspended ? h("span", { class: "chip suspended", text: "מושעה/ית" }) : null,
        h("span", { class: "when", text: shortDate(u.created_at) })));
  }

  function renderUsers() {
    users.rows = [];
    users.done = false;
    var card = h("div", { id: "nl-slot" }, h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים…"));
    var input = h("input", { type: "search", id: "user-search", placeholder: "חיפוש לפי שם או מייל", "aria-label": "חיפוש לפי שם או מייל",
      autocomplete: "off", value: users.search });
    input.addEventListener("input", function () {
      clearTimeout(users.timer);
      users.timer = setTimeout(function () { users.search = input.value.trim(); loadUsers(true); }, 400);
    });
    var filters = h("div", { class: "filters", role: "group", "aria-label": "סינון" },
      [["כולם", false], ["מנויים לניוזלטר", true]].map(function (f) {
        return h("button", { type: "button", "aria-pressed": users.only === f[1] ? "true" : "false", onclick: function (ev) {
          users.only = f[1];
          Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (b) { b.setAttribute("aria-pressed", "false"); });
          ev.currentTarget.setAttribute("aria-pressed", "true");
          loadUsers(true);
        } }, f[0]);
      }));
    show(card,
      h("label", { class: "search" }, svg("M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4-4"), input),
      filters,
      h("div", { id: "user-list" }),
      h("p", { class: "note center", text: "כל צפייה בדף הזה וכל ייצוא נרשמים ביומן." }));
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
    if (fresh) { users.rows = []; users.done = false; }
    var box = $("user-list");
    if (!box) return;
    if (fresh) {
      box.textContent = "";
      box.appendChild(h("p", { class: "loading" }, h("span", { class: "dot", "aria-hidden": "true" }), "טוענים משתמשים…"));
    }
    var before = users.rows.length ? users.rows[users.rows.length - 1].created_at : null;
    rpc("admin_users", { search: users.search || null, subscribers_only: users.only, max_rows: 50, before: before }).then(function (rows) {
      if (token !== users.token || !$("user-list")) return;
      rows = rows || [];
      users.rows = users.rows.concat(rows);
      users.done = rows.length < 50;
      box.textContent = "";
      if (!users.rows.length) {
        box.appendChild(empty(users.search ? "אין תוצאות" : users.only ? "עוד אין מנויים" : "עוד אין משתמשים",
          users.search ? "אפשר לחפש חלק מהשם או מהמייל." : null));
        return;
      }
      box.appendChild(h("div", { class: "list" }, users.rows.map(userRow)));
      if (!users.done) box.appendChild(h("button", { type: "button", class: "btn quiet", onclick: function () { loadUsers(false); } }, "עוד"));
    }).catch(function (e) {
      if (token !== users.token) return;
      box.textContent = "";
      fail(e);
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

  // ------------------------------------------------------------------ user page ---

  function renderUser(id) {
    loading("טוענים את הפרופיל…");
    rpc("admin_user", { target: id }).then(function (u) {
      var p = u.profile || { id: id };
      var suspended = !!p.suspended_at;
      var facts = h("dl", { class: "facts" });
      [["אימייל", p.email], ["שכונה", p.neighborhood], ["נראה/תה לאחרונה", ago(p.last_active_at)],
        ["תנאי שימוש", p.terms_version ? "גרסה " + p.terms_version + " · " + ago(p.terms_accepted_at) : "לא אושרו עדיין"],
        ["ניוזלטר", newsletterText(p.newsletter)],
        ["דיווחים פתוחים", String(u.open_reports)], ["חסימות ב־90 יום", String(u.blocks_90d)]]
        .forEach(function (kv) {
          if (!kv[1]) return;
          facts.appendChild(h("dt", { text: kv[0] }));
          facts.appendChild(h("dd", { text: kv[1], dir: kv[0] === "אימייל" ? "ltr" : null }));
        });

      var head = h("section", { class: "card" },
        h("div", { class: "profile-head" }, avatar(p, true),
          h("div", { class: "who-text" }, h("h1", { text: nameAge(p) }), h("span", { class: "who-sub", text: personSub(p) }))),
        suspended ? h("div", { class: "banner", text: "מושעה/ית " + ago(p.suspended_at) + (p.suspension_reason ? " · " + p.suspension_reason : "") }) : null,
        p.bio ? h("p", { class: "context-text", text: p.bio }) : null,
        facts,
        u.trust_flag && !u.trust_flag.reviewed_at
          ? h("div", { class: "chips" }, h("span", { class: "chip suspended", text: "מסומן/ת: " + u.trust_flag.reporters_90d + " מדווחים · " + u.trust_flag.blockers_90d + " חוסמים" }))
          : null,
        h("div", { class: "actions" }, suspended
          ? h("button", { type: "button", class: "btn ink", onclick: function () { unsuspend(p); } }, "ביטול השעיה")
          : h("button", { type: "button", class: "btn ink", onclick: function () { suspend(p, null); } }, "השעיה")));

      var against = (u.reports_against || []).map(function (r) {
        var ctx = r.context && r.context.type === "message" ? "״" + (r.context.text || "") + "״"
          : r.context && r.context.type === "run" ? "הריצה: " + (r.context.display_title || r.context.title || "") : "";
        return h("div", { class: "mini" },
          h("div", { class: "chips" }, h("span", { class: "chip reason-" + r.reason, text: REASONS[r.reason] || r.reason }),
            h("span", { class: "chip status", text: STATUS[r.status] || r.status })),
          ctx ? h("span", { class: "context-text", text: ctx }) : null,
          h("span", { class: "by", text: "ע״י " + ((r.reporter && r.reporter.name) || "משתמש/ת") + (r.details ? ": ״" + r.details + "״" : "") + " · " + ago(r.created_at) }),
          r.status === "open" ? h("button", { type: "button", class: "btn text", onclick: function () { go("#report/" + r.id); } }, "לדיווח") : null);
      });
      var by = (u.reports_by || []).map(function (r) {
        return h("div", { class: "mini" },
          h("span", { class: "by", text: (REASONS[r.reason] || r.reason) + " על " + ((r.reported && r.reported.name) || "משתמש/ת") + " · " + ago(r.created_at) }));
      });
      var runs = (u.runs || []).map(function (g) {
        return h("div", { class: "mini" },
          h("b", { text: g.display_title || g.title }),
          g.caption ? h("span", { class: "context-text", text: g.caption }) : null,
          h("span", { class: "note", text: [g.place, stamp(g.starts_at), g.participants + " משתתפים"].filter(Boolean).join(" · ") }));
      });
      var log = (u.log || []).map(logRow);

      show(
        h("button", { type: "button", class: "btn text back", onclick: function () { history.length > 1 ? history.back() : go("#reports"); } }, "→ חזרה"),
        head,
        h("h2", { class: "section-title", text: "דיווחים עליו/ה" }),
        against.length ? h("div", { class: "list" }, against) : h("p", { class: "note", text: "אין." }),
        h("h2", { class: "section-title", text: "דיווחים שלו/ה" }),
        by.length ? h("div", { class: "list" }, by) : h("p", { class: "note", text: "אין." }),
        h("h2", { class: "section-title", text: "ריצות אחרונות" }),
        runs.length ? h("div", { class: "list" }, runs) : h("p", { class: "note", text: "אין." }),
        h("h2", { class: "section-title", text: "יומן" }),
        log.length ? h("div", { class: "list" }, log) : h("p", { class: "note", text: "אין פעולות עדיין." }));
    }).catch(function (e) {
      if (code(e) === "user_not_found") return show(empty("המשתמש/ת לא נמצא/ה", "אולי החשבון נמחק."));
      fail(e);
    });
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

  // ------------------------------------------------------------------ boot ---

  function wireChrome() {
    $("sign-out").addEventListener("click", signOut);
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tabs [role=tab]"));
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { go("#" + b.getAttribute("data-tab")); });
      b.addEventListener("keydown", function (ev) {
        // Right to left: ArrowLeft moves to the next tab.
        var d = ev.key === "ArrowLeft" ? 1 : ev.key === "ArrowRight" ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        var next = tabs[(i + d + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });
    window.addEventListener("hashchange", route);
  }

  function boot() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      show(empty("הדף לא נטען עד הסוף", "בדקו את החיבור ונסו לרענן."));
      return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "letsrun-admin" }
    });
    wireChrome();
    sb.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") showSignIn();
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
