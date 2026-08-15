(function () {
  "use strict";

  var NAME_KEY = "nphcda-tracker-editor-name";
  var POLL_MS = 20000;

  var PHASES = [
    { id: "p1", name: "Preparation & Data Segmentation", start: "2026-08-10", end: "2026-08-23",
      target: "100% of 8 states' baseline HW lists obtained and de-duplicated." },
    { id: "p2", name: "Needs Assessment & LMS Readiness", start: "2026-08-17", end: "2026-08-30",
      target: "Readiness checklist ≥90% complete, or workarounds documented for every gap." },
    { id: "p3", name: "HF/PFMO & State Lead Training", start: "2026-08-24", end: "2026-09-06",
      target: "≥95% of HF/PFMOs pass the practical competency assessment." },
    { id: "p4", name: "Onboarding Materials Development", start: "2026-08-24", end: "2026-09-06",
      target: "Full onboarding resource pack reviewed and approved before Phase 5 starts." },
    { id: "p5", name: "Health Worker Onboarding", start: "2026-09-07", end: "2026-10-04",
      target: "Weekly onboarding rate on track (~1,250 Health Workers/week)." },
    { id: "p6", name: "Follow-up, Support & Remediation", start: "2026-09-14", end: "2026-10-11",
      target: "Fewer than 10% of targeted HWs remain unregistered by end of Week 9." },
    { id: "p7", name: "Monitoring, Reporting & Continuous Improvement", start: "2026-08-10", end: "2026-10-18",
      target: "≥90% of the 5,000 target onboarded; reporting fully reconciled." },
    { id: "p8", name: "Team & Programme Admin", start: "2026-08-01", end: "2026-10-18",
      target: "Core team operational; procurement and budget approvals secured." }
  ];

  var STATUSES = ["To Do", "In Progress", "Blocked", "Done"];
  var STATUS_CLASS = { "To Do": "todo", "In Progress": "progress", "Blocked": "blocked", "Done": "done" };
  var PRIORITIES = ["Low", "Medium", "High"];
  var WORKSTREAMS = ["Data", "LMS/Tech", "Training", "Materials", "Field Ops", "Support", "M&E", "Admin", "Recruitment", "Stakeholders"];

  var state = [];
  var activeWs = new Set();
  var activeStatus = new Set();
  var searchTerm = "";
  var dirty = false;
  var saveTimer = null;

  function today() { return new Date().toISOString().slice(0, 10); }

  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function currentPhaseId() {
    var t = today();
    for (var i = 0; i < PHASES.length; i++) {
      if (PHASES[i].id === "p8") continue;
      if (t >= PHASES[i].start && t <= PHASES[i].end) return PHASES[i].id;
    }
    for (var j = 0; j < PHASES.length; j++) {
      if (PHASES[j].id === "p8") continue;
      if (t < PHASES[j].start) return PHASES[j].id;
    }
    return "p7";
  }

  function getEditorName() {
    var input = document.getElementById("editorName");
    return (input && input.value.trim()) || "";
  }

  function stamp(task) {
    task.editedBy = getEditorName();
    task.editedAt = new Date().toISOString();
  }

  function counts(list) {
    var c = { "To Do": 0, "In Progress": 0, "Blocked": 0, "Done": 0 };
    list.forEach(function (t) { if (c[t.status] !== undefined) c[t.status]++; });
    return c;
  }

  // ---------- Networking ----------
  function loadBoard() {
    return fetch("/api/board").then(function (r) {
      if (!r.ok) throw new Error("load failed");
      return r.json();
    });
  }

  function scheduleSave() {
    dirty = true;
    setSync("Saving…", false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      fetch("/api/board", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      }).then(function (r) {
        if (!r.ok) throw new Error("save failed");
        dirty = false;
        setSync("Saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), false);
      }).catch(function () {
        setSync("Couldn't save — check the connection", true);
      });
    }, 350);
  }

  function setSync(text, isErr) {
    var el = document.getElementById("syncStatus");
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
  }

  function isEditingSomething() {
    var active = document.activeElement;
    if (!active) return false;
    if (active.isContentEditable) return true;
    var tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function poll() {
    if (dirty || isEditingSomething()) return;
    loadBoard().then(function (fresh) {
      if (dirty || isEditingSomething()) return;
      state = fresh;
      render();
    }).catch(function () {});
  }

  // ---------- Rendering ----------
  function renderOverview() {
    var c = counts(state);
    var total = state.length || 1;
    var blocked = state.filter(function (t) { return t.status === "Blocked"; });
    var blockedHigh = blocked.filter(function (t) { return t.priority === "High"; });
    var overdue = state.filter(function (t) { return t.due && t.due < today() && t.status !== "Done"; });

    var rag = "green", ragLabel = "On Track";
    if (blockedHigh.length > 0) { rag = "red"; ragLabel = "Needs Attention"; }
    else if (blocked.length > 0 || overdue.length > 3) { rag = "amber"; ragLabel = "Watch Closely"; }

    var chip = document.getElementById("ragChip");
    chip.textContent = ragLabel;
    chip.className = "rag-chip " + rag;

    document.getElementById("overviewProgress").innerHTML =
      "<b>" + c["Done"] + " / " + state.length + "</b> tasks complete &nbsp;·&nbsp; " + Math.round(100 * c["Done"] / total) + "%";

    var cur = currentPhaseId();
    var roadmap = document.getElementById("roadmap");
    roadmap.innerHTML = PHASES.filter(function (p) { return p.id !== "p8"; }).map(function (p) {
      var ptasks = state.filter(function (t) { return t.phase === p.id; });
      var pc = counts(ptasks);
      var icon = "○", cls = "";
      if (ptasks.length && pc["Done"] === ptasks.length) icon = "✓";
      else if (pc["Blocked"] > 0) icon = "⛔";
      else if (pc["In Progress"] > 0 || pc["Done"] > 0) icon = "◐";
      if (p.id === cur) cls = " current";
      return '<div class="roadmap-step' + cls + '"><span class="rs-icon">' + icon + '</span><span class="rs-label">' + p.name + '</span></div>';
    }).join("");

    function listOrEmpty(items, emptyText) {
      if (!items.length) return '<li class="ov-empty">' + emptyText + '</li>';
      return items.map(function (t) { return "<li>" + t + "</li>"; }).join("");
    }

    document.getElementById("colAttention").innerHTML = listOrEmpty(
      blocked
        .sort(function (a, b) { return (b.priority === "High") - (a.priority === "High"); })
        .slice(0, 6)
        .map(function (t) { return t.title + " <em>(" + t.owner + ")</em>"; }),
      "Nothing blocked right now."
    );

    document.getElementById("colDone").innerHTML = listOrEmpty(
      state.filter(function (t) { return t.status === "Done"; })
        .sort(function (a, b) { return (b.editedAt || "").localeCompare(a.editedAt || ""); })
        .slice(0, 6)
        .map(function (t) { return t.title; }),
      "Nothing marked done yet."
    );

    document.getElementById("colNext").innerHTML = listOrEmpty(
      state.filter(function (t) { return (t.phase === cur) && t.status !== "Done"; })
        .sort(function (a, b) { return (b.priority === "High") - (a.priority === "High"); })
        .slice(0, 6)
        .map(function (t) { return t.title; }),
      "Nothing queued in the current phase."
    );
  }

  function renderPhaseRail() {
    var el = document.getElementById("phaseRail");
    var cur = currentPhaseId();
    el.innerHTML = PHASES.map(function (p) {
      return '<a class="phase-chip' + (p.id === cur ? " current" : "") + '" href="#sec-' + p.id + '">' +
        '<span class="dot"></span>' + p.name.split(" ").slice(0, 3).join(" ") + (p.name.split(" ").length > 3 ? "…" : "") +
        "</a>";
    }).join("");
  }

  function taskMatches(t) {
    if (activeWs.size && !activeWs.has(t.ws)) return false;
    if (activeStatus.size && !activeStatus.has(t.status)) return false;
    if (searchTerm) {
      var hay = (t.title + " " + t.owner + " " + (t.note || "")).toLowerCase();
      if (hay.indexOf(searchTerm) === -1) return false;
    }
    return true;
  }

  function renderBoard() {
    var board = document.getElementById("board");
    var cur = currentPhaseId();
    board.innerHTML = "";
    PHASES.forEach(function (phase) {
      var all = state.filter(function (t) { return t.phase === phase.id; });
      var visible = all.filter(taskMatches);
      var c = counts(all);
      var total = all.length || 1;

      var section = document.createElement("section");
      section.className = "phase-section";
      section.id = "sec-" + phase.id;

      var head = document.createElement("div");
      head.className = "phase-head";
      head.innerHTML =
        '<div class="phase-head-left">' +
          "<h2>" + phase.name + (phase.id === cur ? ' <span class="ws-tag" style="vertical-align:1px;">Current</span>' : "") + "</h2>" +
          '<div class="phase-meta">' + formatDate(phase.start) + " – " + formatDate(phase.end) + "</div>" +
          '<div class="phase-target"><b>Target:</b> ' + phase.target + "</div>" +
        "</div>" +
        '<div class="phase-head-right">' +
          '<div class="phase-progress-num">' + c["Done"] + " / " + all.length + " done</div>" +
          '<div class="phase-bar">' +
            '<span class="seg-done" style="width:' + (100 * c["Done"] / total) + '%"></span>' +
            '<span class="seg-progress" style="width:' + (100 * c["In Progress"] / total) + '%"></span>' +
            '<span class="seg-blocked" style="width:' + (100 * c["Blocked"] / total) + '%"></span>' +
          "</div>" +
        "</div>";
      section.appendChild(head);

      var grid = document.createElement("div");
      grid.className = "task-grid";
      if (visible.length === 0) {
        var empty = document.createElement("div");
        empty.className = "empty-note";
        empty.textContent = all.length === 0 ? "No tasks yet." : "No tasks match the current filters.";
        grid.appendChild(empty);
      } else {
        visible.forEach(function (t) { grid.appendChild(renderCard(t)); });
      }
      section.appendChild(grid);

      var addRow = document.createElement("div");
      addRow.className = "add-task-row";
      var addBtn = document.createElement("button");
      addBtn.type = "button"; addBtn.className = "add-task-btn"; addBtn.textContent = "+ Add task to this phase";
      addBtn.addEventListener("click", function () {
        var nt = { id: "t" + Date.now(), phase: phase.id, ws: WORKSTREAMS[0], title: "New task", owner: "", due: phase.end, priority: "Medium", status: "To Do", note: "", editedBy: "", editedAt: "" };
        stamp(nt);
        state.push(nt);
        scheduleSave();
        render();
        var card = document.querySelector('[data-id="' + nt.id + '"] .task-title');
        if (card) card.focus();
      });
      addRow.appendChild(addBtn);
      section.appendChild(addRow);

      board.appendChild(section);
    });
  }

  function renderCard(t) {
    var card = document.createElement("div");
    card.className = "task-card status-" + STATUS_CLASS[t.status];
    card.setAttribute("data-id", t.id);

    var top = document.createElement("div");
    top.className = "task-top";
    var title = document.createElement("div");
    title.className = "task-title";
    title.contentEditable = "true";
    title.textContent = t.title;
    title.addEventListener("blur", function () {
      var v = title.textContent.trim() || "Untitled task";
      if (v !== t.title) { t.title = v; stamp(t); scheduleSave(); }
    });
    var del = document.createElement("button");
    del.type = "button"; del.className = "del-btn"; del.title = "Delete task"; del.textContent = "×";
    del.addEventListener("click", function () {
      if (!confirm('Delete "' + t.title + '"?')) return;
      state = state.filter(function (x) { return x.id !== t.id; });
      scheduleSave();
      render();
    });
    top.appendChild(title); top.appendChild(del);
    card.appendChild(top);

    var tags = document.createElement("div");
    tags.className = "task-tags";
    var wsSelect = document.createElement("select");
    wsSelect.className = "status-select";
    WORKSTREAMS.forEach(function (w) {
      var o = document.createElement("option"); o.value = w; o.textContent = w;
      if (w === t.ws) o.selected = true;
      wsSelect.appendChild(o);
    });
    wsSelect.addEventListener("change", function () { t.ws = wsSelect.value; stamp(t); scheduleSave(); renderBoard(); });

    var prio = document.createElement("select");
    prio.className = "prio-select";
    PRIORITIES.forEach(function (p) {
      var o = document.createElement("option"); o.value = p; o.textContent = p + " priority";
      if (p === t.priority) o.selected = true;
      prio.appendChild(o);
    });
    prio.addEventListener("change", function () { t.priority = prio.value; stamp(t); scheduleSave(); });

    tags.appendChild(wsSelect);
    tags.appendChild(prio);
    if (t.step) {
      var stepTag = document.createElement("span");
      stepTag.className = "step-tag";
      stepTag.textContent = "STEP " + t.step;
      tags.appendChild(stepTag);
    }
    card.appendChild(tags);

    var ownerRow = document.createElement("div");
    ownerRow.className = "task-row";
    var owner = document.createElement("div");
    owner.className = "task-owner";
    owner.contentEditable = "true";
    owner.textContent = t.owner || "Unassigned";
    owner.addEventListener("blur", function () {
      var v = owner.textContent.trim();
      if (v !== t.owner) { t.owner = v; stamp(t); scheduleSave(); }
    });
    var due = document.createElement("input");
    due.type = "date"; due.className = "task-due";
    due.value = t.due || "";
    var overdue = t.due && t.due < today() && t.status !== "Done";
    if (overdue) due.classList.add("overdue");
    due.addEventListener("change", function () { t.due = due.value; stamp(t); scheduleSave(); renderBoard(); });
    ownerRow.appendChild(owner); ownerRow.appendChild(due);
    card.appendChild(ownerRow);

    var controls = document.createElement("div");
    controls.className = "task-controls";
    var statusSel = document.createElement("select");
    statusSel.className = "status-select";
    STATUSES.forEach(function (s) {
      var o = document.createElement("option"); o.value = s; o.textContent = s;
      if (s === t.status) o.selected = true;
      statusSel.appendChild(o);
    });
    statusSel.addEventListener("change", function () { t.status = statusSel.value; stamp(t); scheduleSave(); render(); });
    controls.appendChild(statusSel);
    card.appendChild(controls);

    var note = document.createElement("div");
    note.className = "task-note";
    note.contentEditable = "true";
    note.textContent = t.note || "Add a note…";
    note.addEventListener("focus", function () { if (!t.note) note.textContent = ""; });
    note.addEventListener("blur", function () {
      var v = note.textContent.trim();
      if (v !== t.note) { t.note = v; stamp(t); scheduleSave(); }
      if (!note.textContent.trim()) note.textContent = "Add a note…";
    });
    card.appendChild(note);

    if (t.editedBy) {
      var meta = document.createElement("div");
      meta.className = "task-meta-edit";
      var when = t.editedAt ? new Date(t.editedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
      meta.textContent = "Edited by " + t.editedBy + (when ? " · " + when : "");
      card.appendChild(meta);
    }

    return card;
  }

  function render() {
    renderOverview();
    renderPhaseRail();
    renderBoard();
  }

  // ---------- Filters ----------
  function renderFilters() {
    var wsEl = document.getElementById("wsFilters");
    WORKSTREAMS.forEach(function (ws) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = ws;
      b.addEventListener("click", function () {
        if (activeWs.has(ws)) activeWs.delete(ws); else activeWs.add(ws);
        b.classList.toggle("active");
        renderBoard();
      });
      wsEl.appendChild(b);
    });
    var stEl = document.getElementById("statusFilters");
    STATUSES.forEach(function (st) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = st;
      b.addEventListener("click", function () {
        if (activeStatus.has(st)) activeStatus.delete(st); else activeStatus.add(st);
        b.classList.toggle("active");
        renderBoard();
      });
      stEl.appendChild(b);
    });
    document.getElementById("searchInput").addEventListener("input", function (e) {
      searchTerm = e.target.value.trim().toLowerCase();
      renderBoard();
    });
  }

  // ---------- Toolbar ----------
  var nameInput = document.getElementById("editorName");
  nameInput.value = localStorage.getItem(NAME_KEY) || "";
  nameInput.addEventListener("change", function () {
    localStorage.setItem(NAME_KEY, nameInput.value.trim());
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    if (!confirm("Reset the shared board to the original seeded plan? This clears everyone's edits.")) return;
    fetch("/api/reset", { method: "POST" }).then(function (r) { return r.json(); }).then(function (fresh) {
      state = fresh;
      render();
      setSync("Reset to original plan", false);
    });
  });

  document.getElementById("exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "nphcda-tracker-backup-" + today() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  renderFilters();
  loadBoard().then(function (data) {
    state = data;
    render();
    setSync("Saved", false);
    setInterval(poll, POLL_MS);
  }).catch(function () {
    setSync("Couldn't load the board — check the server", true);
  });
})();
