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
    app_config_set: "הגדרת גרסה"
  };
  // Rate limit actions (private.rate_limits), in the order the settings tab shows them.
  var LIMITS = [
    ["chat_message", "הודעות בצ׳אט"],
    ["join_request", "בקשות הצטרפות לריצה"],
    ["run_create", "ריצות חדשות"],
    ["connection_request", "בקשות חיבור"],
    ["run_invite", "הזמנות לריצה"],
    ["report", "דיווחים"]
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

  var sb = null;
  var state = {
    email: "",
    tab: "reports",
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
    var known = ["not_admin", "not_authenticated", "invalid_argument", "user_not_found", "message_not_found",
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
      options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname }
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
    var tab = (location.hash || "#reports").slice(1);
    if (["reports", "flags", "words", "log", "settings"].indexOf(tab) < 0) tab = "reports";
    setTab(tab);
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
      if (r.context && r.context.type === "message" && r.message_id && !r.message_removed) {
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

  function removeMessage(r) {
    confirmNote({
      title: "הסרת ההודעה",
      text: "ההודעה תוחלף ב״ההודעה הוסרה״ אצל כולם. הטקסט נשמר ביומן.",
      label: "הערה קצרה",
      ok: "הסרה",
      required: true
    }).then(function (note) {
      if (note === null) return;
      rpc("admin_remove_message", { message: r.message_id, note: note }).then(function () {
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

  // ------------------------------------------------------------------ user page ---

  function renderUser(id) {
    loading("טוענים את הפרופיל…");
    rpc("admin_user", { target: id }).then(function (u) {
      var p = u.profile || { id: id };
      var suspended = !!p.suspended_at;
      var facts = h("dl", { class: "facts" });
      [["אימייל", p.email], ["שכונה", p.neighborhood], ["נראה/תה לאחרונה", ago(p.last_active_at)],
        ["תנאי שימוש", p.terms_version ? "גרסה " + p.terms_version + " · " + ago(p.terms_accepted_at) : "לא אושרו עדיין"],
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
