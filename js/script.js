/* ==========================================================================
   Life Dashboard — script.js
   Vanilla JS only. No libraries, no frameworks, no build tools.

   Implements:
     - Realtime clock + date (one line) and time-based greeting
     - Custom name (localStorage)
     - Light/dark theme toggle (localStorage)
     - Focus / Pomodoro timer: Start / Pause / Reset
     - To-Do: add, edit (double-click), complete, delete (localStorage)
     - Quick Links: defaults seeded once, add/remove custom links (localStorage)
     - Settings dialog (name + pomodoro duration)

   All localStorage access is wrapped in try/catch so private mode or
   disabled storage never breaks the app; missing/invalid data falls back
   to safe defaults. Wrapped in an IIFE to avoid polluting global scope.
   ========================================================================== */

(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     1. Storage keys
     ---------------------------------------------------------------------- */
  const KEYS = {
    NAME: 'life-name',
    THEME: 'life-theme',
    POMODORO: 'life-pomodoro',
    TODOS: 'life-todos',
    LINKS: 'life-links'
  };

  /* ----------------------------------------------------------------------
     2. Safe localStorage helpers (never throw)
     ---------------------------------------------------------------------- */
  function getString(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : String(v);
    } catch (e) {
      return fallback;
    }
  }

  function getNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // Parses JSON; runs optional shape validation; returns fallback on any error.
  function getJSON(key, fallback, validate) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (typeof validate === 'function' && !validate(parsed)) return fallback;
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  function setString(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function setNumber(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }
  function setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ----------------------------------------------------------------------
     3. Module state
     ---------------------------------------------------------------------- */
  let userName = '';
  let lastGreeting = '';
  let pomodoroMinutes = 25;
  let timerRemaining = 25 * 60;   // seconds
  let timerRunning = false;
  let timerInterval = null;
  let todos = [];
  let links = [];
  let audioCtx = null;

  let rewardActive = false;
  let rewardCount = 0;
  let rewardTimer = null;
  let rewardOverlayEl = null;
  let rewardImgEl = null;
  let rewardMsgEl = null;

  /* ----------------------------------------------------------------------
     4. DOM references (populated in init)
     ---------------------------------------------------------------------- */
  let greetingEl, clockEl, themeToggleEl, themeIconEl,
    settingsOpenEl, settingsDialogEl, settingsFormEl,
    nameInputEl, pomodoroInputEl, settingsCloseEl,
    timerModeEl, timerDisplayEl, timerStartEl, timerPauseEl, timerResetEl,
    todoFormEl, todoInputEl, todoListEl, todoClearAllEl,
    linksNavEl, focusTimerEl;

  /* ----------------------------------------------------------------------
     5. Defaults
     ---------------------------------------------------------------------- */
  const DEFAULT_LINKS = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'YouTube', url: 'https://www.youtube.com' },
    { name: 'Gmail', url: 'https://mail.google.com' }
  ];

  /* ----------------------------------------------------------------------
     6. Clock + greeting
     ---------------------------------------------------------------------- */
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString(undefined, {
      hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit'
    });
    clockEl.textContent = dateStr + ' · ' + timeStr;
  }

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night'; // 22–4
  }

  function updateGreeting() {
    if (!greetingEl) return;
    const g = getGreeting(new Date().getHours());
    const text = userName ? (g + ', ' + userName + '!') : (g + '!');
    // Only write when the greeting changes. Rewriting every tick would
    // fight the browser's page translation and cause visible flicker.
    if (text === lastGreeting) return;
    greetingEl.textContent = text;
    lastGreeting = text;
  }

  /* ----------------------------------------------------------------------
     7. Theme
     ---------------------------------------------------------------------- */
  function applyTheme(theme) {
    const t = (theme === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    if (themeIconEl) themeIconEl.textContent = (t === 'dark') ? '☀️' : '🌙';
  }

  function loadTheme() {
    let theme = null;
    try {
      const raw = localStorage.getItem(KEYS.THEME);
      if (raw === 'light' || raw === 'dark') theme = raw;
    } catch (e) { theme = null; }
    // No saved (or invalid) theme -> default to light.
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
    applyTheme(theme);
  }

  function toggleTheme() {
    const current =
      (document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
    const next = (current === 'dark') ? 'light' : 'dark';
    applyTheme(next);
    setString(KEYS.THEME, next);
  }

  /* ----------------------------------------------------------------------
     8. Focus / Pomodoro timer
     ---------------------------------------------------------------------- */
  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function renderTimer() {
    if (timerDisplayEl) timerDisplayEl.textContent = formatTime(timerRemaining);
  }

  function setRunning(running) {
    timerRunning = running;
    if (focusTimerEl) {
      if (running) focusTimerEl.classList.add('running');
      else focusTimerEl.classList.remove('running');
    }
  }

  function startTimer() {
    if (timerRunning) return;          // already running: ignore
    if (timerRemaining <= 0) timerRemaining = pomodoroMinutes * 60;
    setRunning(true);
    if (timerModeEl) timerModeEl.textContent = 'Work';
    renderTimer();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
  }

  function pauseTimer() {
    if (!timerRunning) return;
    setRunning(false);
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    // keep display + remaining
  }

  function resetTimer() {
    setRunning(false);
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerRemaining = pomodoroMinutes * 60;
    if (timerModeEl) timerModeEl.textContent = 'Work';
    renderTimer();
  }

  function tick() {
    timerRemaining -= 1;
    if (timerRemaining <= 0) {
      timerRemaining = 0;
      setRunning(false);
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (timerModeEl) timerModeEl.textContent = 'Done';
      renderTimer();
      playBeep();
      return;
    }
    renderTimer();
  }

  // Apply a new duration from settings.
  function applyPomodoroChange(newMinutes) {
    pomodoroMinutes = newMinutes;
    setNumber(KEYS.POMODORO, newMinutes);
    if (!timerRunning) {
      // Not running: reset the display to the new full duration.
      timerRemaining = newMinutes * 60;
      if (timerModeEl) timerModeEl.textContent = 'Work';
      renderTimer();
    }
    // If running: store only; do not disrupt the active session (used on reset).
  }

  // Optional completion beep. Everything guarded so it never throws.
  function playBeep() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () { /* ignore */ });
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      osc.onended = function () {
        try { osc.disconnect(); gain.disconnect(); } catch (e) { /* ignore */ }
      };
    } catch (e) { /* ignore: never let audio break the app */ }
  }

  /* ----------------------------------------------------------------------
     9. To-Do list
     ---------------------------------------------------------------------- */
  function genId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (e) { /* fall through */ }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function saveTodos() { setJSON(KEYS.TODOS, todos); }

  function findTodo(id) {
    for (let i = 0; i < todos.length; i++) {
      if (todos[i].id === id) return todos[i];
    }
    return null;
  }

  function addTodo(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    todos.push({ id: genId(), text: trimmed, completed: false });
    saveTodos();
    renderTodos();
  }

  function deleteTodoById(id) {
    todos = todos.filter(function (t) { return t.id !== id; });
    saveTodos();
    renderTodos();
  }

  function toggleTodoById(id, checked, li) {
    const todo = findTodo(id);
    if (!todo) return;
    todo.completed = !!checked;
    if (li) {
      if (todo.completed) li.classList.add('completed');
      else li.classList.remove('completed');
    }
    saveTodos();
    if (todo.completed) triggerReward(); // dino reward only on completion
  }

  function renderTodos() {
    if (!todoListEl) return;
    todoListEl.innerHTML = '';
    if (todoClearAllEl) todoClearAllEl.disabled = (todos.length === 0);
    if (todos.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'todo-empty';
      empty.textContent = 'No tasks yet.';
      empty.style.color = 'var(--color-text-muted)';
      todoListEl.appendChild(empty);
      return;
    }
    todos.forEach(function (todo) {
      const li = document.createElement('li');
      li.dataset.id = todo.id;
      if (todo.completed) li.classList.add('completed');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!todo.completed;

      const span = document.createElement('span');
      span.textContent = todo.text;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'todo-delete';
      del.title = 'Delete';
      del.setAttribute('aria-label', 'Delete task');
      del.textContent = '✕';

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      todoListEl.appendChild(li);
    });
  }

  // Inline edit: double-click a <span> to edit the task text.
  function startEdit(li, id, span) {
    if (!li || !span) return;
    if (todoListEl.querySelector('.todo-edit')) return; // only one edit at a time
    const todo = findTodo(id);
    if (!todo) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit';
    input.value = todo.text;
    input.style.flex = '1 1 auto';
    input.style.minWidth = '0';
    li.replaceChild(input, span);
    input.focus();
    input.select();

    let finished = false;
    function finish(commit) {
      if (finished) return;
      finished = true;
      if (commit) {
        const val = input.value.trim();
        if (val) {
          todo.text = val;
          saveTodos();
        } else {
          // empty on commit -> delete the task
          todos = todos.filter(function (t) { return t.id !== id; });
          saveTodos();
        }
      }
      renderTodos();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function onTodoSubmit(e) {
    e.preventDefault();
    if (!todoInputEl) return;
    addTodo(todoInputEl.value);
    todoInputEl.value = '';
    todoInputEl.focus();
  }

  // "Clear All": confirm, then delete every task and persist the empty list.
  function onTodoClearAll() {
    if (!todoClearAllEl || todoClearAllEl.disabled) return;
    if (todos.length === 0) return;
    if (!window.confirm('Clear all tasks? This cannot be undone.')) return;
    todos = [];
    saveTodos();
    renderTodos();
  }

  // Delegated handlers on the todo list
  function onTodoListClick(e) {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const li = target.closest('li');
    if (!li) return;
    const id = li.dataset.id;
    if (!id) return; // empty-state <li>
    if (target.classList && target.classList.contains('todo-delete')) {
      deleteTodoById(id);
    }
  }

  function onTodoListChange(e) {
    if (!e.target || e.target.type !== 'checkbox') return;
    const target = e.target;
    if (typeof target.closest !== 'function') return;
    const li = target.closest('li');
    if (!li) return;
    const id = li.dataset.id;
    if (!id) return;
    toggleTodoById(id, target.checked, li);
  }

  function onTodoListDblClick(e) {
    if (!e.target || e.target.tagName !== 'SPAN') return;
    const target = e.target;
    if (typeof target.closest !== 'function') return;
    const li = target.closest('li');
    if (!li) return;
    const id = li.dataset.id;
    if (!id) return;
    startEdit(li, id, target);
  }

  /* ----------------------------------------------------------------------
     9b. Dino task-completion reward
     - Shows one random dino centered + a "Great Job!" / "N Tasks Completed!" message.
     - Plays a short synthesized chime (no external asset, no copyrighted audio).
     - Batches rapid completions into a single reward (one dino, one sound, counted message).
     - Only fires when a task is marked complete (not on edit/delete/uncheck).
     - pointer-events:none so it never blocks interaction.
  ---------------------------------------------------------------------- */
  function rewardMessage(count) {
    return count > 1 ? (count + ' Tasks Completed!') : 'Great Job!';
  }

  function buildRewardOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'reward-overlay';
    overlay.id = 'reward-overlay';

    const card = document.createElement('div');
    card.className = 'reward-card';

    const img = document.createElement('img');
    img.className = 'reward-img';
    img.alt = ''; // decorative; the live message conveys the meaning
    // If a dino asset is ever missing, hide the image and still show the message.
    img.addEventListener('error', function () { img.style.display = 'none'; });

    const msg = document.createElement('span');
    msg.className = 'reward-msg';
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');

    card.appendChild(img);
    card.appendChild(msg);
    overlay.appendChild(card);

    // Reset internal state once the fade-out completes.
    overlay.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'opacity' && !overlay.classList.contains('visible')) {
        rewardActive = false;
        rewardCount = 0;
        rewardTimer = null;
      }
    });

    document.body.appendChild(overlay);
    rewardOverlayEl = overlay;
    rewardImgEl = img;
    rewardMsgEl = msg;
  }

  function scheduleHide() {
    if (rewardTimer) clearTimeout(rewardTimer);
    rewardTimer = setTimeout(function () {
      if (rewardOverlayEl) rewardOverlayEl.classList.remove('visible');
      // rewardActive resets via the transitionend handler above.
    }, 1200);
  }

  function showReward(count) {
    if (!rewardOverlayEl) return;
    rewardActive = true;
    rewardCount = count;
    const n = Math.floor(Math.random() * 10) + 1;
    const nn = String(n).padStart(2, '0');
    if (rewardImgEl) {
      rewardImgEl.style.display = '';
      rewardImgEl.src = 'assets/dino/dino-' + nn + '.webp';
    }
    if (rewardMsgEl) rewardMsgEl.textContent = rewardMessage(count);
    rewardOverlayEl.classList.add('visible');
    playRewardSound();
    scheduleHide();
  }

  function bumpReward() {
    rewardCount += 1;
    if (rewardMsgEl) rewardMsgEl.textContent = rewardMessage(rewardCount);
    if (rewardOverlayEl) rewardOverlayEl.classList.add('visible');
    scheduleHide();
  }

  function triggerReward() {
    if (!rewardActive) showReward(1);
    else bumpReward();
  }

  // Short, pleasant synthesized chord "strum" (jeng/jreng). No external asset,
  // no copyrighted audio. Fully guarded so it never throws.
  function playRewardSound() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () { /* ignore */ });
      }
      const now = audioCtx.currentTime;
      const master = audioCtx.createGain();
      master.gain.value = 0.5;
      master.connect(audioCtx.destination);
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3800;
      filter.connect(master);
      // Ascending major-chord arpeggio ~ C5, E5, G5, C6 — a gentle strum.
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach(function (f, i) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const start = now + i * 0.06;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.22, start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        osc.connect(g);
        g.connect(filter);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch (e) { /* ignore: never let audio break the app */ }
  }

  /* ----------------------------------------------------------------------
     10. Quick links
     ---------------------------------------------------------------------- */
  function isLink(obj) {
    return obj && typeof obj === 'object' &&
      typeof obj.name === 'string' && typeof obj.url === 'string' &&
      obj.name.length > 0 && obj.url.length > 0;
  }

  function saveLinks() { setJSON(KEYS.LINKS, links); }

  function loadLinks() {
    // Seed defaults ONLY if the key is absent or invalid.
    const stored = getJSON(KEYS.LINKS, null, function (arr) {
      return Array.isArray(arr) && arr.every(isLink);
    });
    if (stored === null) {
      links = DEFAULT_LINKS.map(function (l) {
        return { name: l.name, url: l.url };
      });
    } else {
      links = stored;
    }
  }

  function renderLinks() {
    if (!linksNavEl) return;
    linksNavEl.innerHTML = '';
    links.forEach(function (link) {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = link.name;
      a.appendChild(nameSpan);

      const remove = document.createElement('span');
      remove.className = 'link-remove';
      remove.setAttribute('role', 'button');
      remove.setAttribute('tabindex', '0');
      remove.setAttribute('aria-label', 'Remove ' + link.name);
      remove.title = 'Remove';
      remove.textContent = '✕';
      a.appendChild(remove);

      // <a> stays a direct child of .links-nav so the CSS grid works.
      linksNavEl.appendChild(a);
    });
  }

  function removeLink(index) {
    if (index < 0 || index >= links.length) return;
    links.splice(index, 1);
    saveLinks();
    renderLinks();
  }

  // Find the index of the anchor that contains the given child element.
  function linkIndexFromChild(child) {
    if (!child || typeof child.closest !== 'function') return -1;
    const a = child.closest('a');
    if (!a || a.parentElement !== linksNavEl) return -1;
    return Array.prototype.indexOf.call(linksNavEl.children, a);
  }

  function onLinksNavClick(e) {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const remove = target.closest('.link-remove');
    if (!remove) return;
    e.preventDefault();   // do not follow the anchor
    e.stopPropagation();
    const idx = linkIndexFromChild(remove);
    if (idx >= 0) removeLink(idx);
  }

  function onLinksNavKeydown(e) {
    const target = e.target;
    if (!target || !target.classList ||
      !target.classList.contains('link-remove')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); // prevent Space from scrolling
      const idx = linkIndexFromChild(target);
      if (idx >= 0) removeLink(idx);
    }
  }

  // Inject the "add link" form right before .links-nav (i.e. right after the
  // section's <h2>). Reuses the .todo-form styling for a consistent look.
  function buildAddLinkForm() {
    const form = document.createElement('form');
    form.className = 'todo-form';
    form.style.flexWrap = 'wrap';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Link name';
    nameInput.setAttribute('aria-label', 'Link name');
    nameInput.style.minWidth = '120px';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://...';
    urlInput.setAttribute('aria-label', 'Link URL');
    urlInput.style.minWidth = '160px';

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Add';

    form.appendChild(nameInput);
    form.appendChild(urlInput);
    form.appendChild(btn);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const linkName = nameInput.value.trim();
      if (!linkName) return; // name required
      let linkUrl = urlInput.value.trim();
      if (!linkUrl) return;
      if (linkUrl.indexOf('://') === -1) linkUrl = 'https://' + linkUrl;
      // Validate and restrict to web schemes (avoids javascript:/data: etc.).
      let parsed;
      try {
        parsed = new URL(linkUrl);
      } catch (err) {
        return; // invalid URL -> ignore
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      links.push({ name: linkName, url: linkUrl });
      saveLinks();
      renderLinks();
      nameInput.value = '';
      urlInput.value = '';
      nameInput.focus();
    });
    return form;
  }

  function setupAddLinkForm() {
    if (!linksNavEl || !linksNavEl.parentElement) return;
    linksNavEl.parentElement.insertBefore(buildAddLinkForm(), linksNavEl);
  }

  /* ----------------------------------------------------------------------
     11. Settings dialog
     ---------------------------------------------------------------------- */
  function openSettings() {
    if (!settingsDialogEl) return;
    if (nameInputEl) nameInputEl.value = userName;
    if (pomodoroInputEl) pomodoroInputEl.value = String(pomodoroMinutes);
    try {
      if (typeof settingsDialogEl.showModal === 'function') {
        settingsDialogEl.showModal();
      } else {
        settingsDialogEl.setAttribute('open', '');
      }
    } catch (e) { /* ignore */ }
  }

  function closeSettings() {
    if (!settingsDialogEl) return;
    try {
      settingsDialogEl.close();
    } catch (e) {
      try { settingsDialogEl.removeAttribute('open'); } catch (e2) { /* ignore */ }
    }
  }

  function saveSettings(e) {
    if (e) e.preventDefault();
    const newName = nameInputEl ? nameInputEl.value.trim() : '';
    userName = newName;
    setString(KEYS.NAME, userName);

    let dur = parseInt(pomodoroInputEl ? pomodoroInputEl.value : '', 10);
    if (!Number.isFinite(dur)) dur = 25;
    dur = Math.min(120, Math.max(1, Math.round(dur)));
    applyPomodoroChange(dur);

    updateGreeting(); // apply name immediately
    closeSettings();
  }

  function onSettingsBackdrop(e) {
    if (e.target === settingsDialogEl) closeSettings();
  }

  /* ----------------------------------------------------------------------
     12. Initialization
     ---------------------------------------------------------------------- */
  function init() {
    // Grab DOM (guard every lookup; missing elements are simply skipped).
    greetingEl = document.getElementById('greeting-text');
    clockEl = document.getElementById('clock');
    themeToggleEl = document.getElementById('theme-toggle');
    themeIconEl = document.getElementById('theme-icon');
    settingsOpenEl = document.getElementById('settings-open');
    settingsDialogEl = document.getElementById('settings-dialog');
    settingsFormEl = document.getElementById('settings-form');
    nameInputEl = document.getElementById('name-input');
    pomodoroInputEl = document.getElementById('pomodoro-duration');
    settingsCloseEl = document.getElementById('settings-close');
    timerModeEl = document.getElementById('timer-mode');
    timerDisplayEl = document.getElementById('timer-display');
    timerStartEl = document.getElementById('timer-start');
    timerPauseEl = document.getElementById('timer-pause');
    timerResetEl = document.getElementById('timer-reset');
    todoFormEl = document.getElementById('todo-form');
    todoInputEl = document.getElementById('todo-input');
    todoListEl = document.getElementById('todo-list');
    todoClearAllEl = document.getElementById('todo-clear-all');
    linksNavEl = document.querySelector('.links-nav');
    focusTimerEl = document.querySelector('.focus-timer');

    // Restore state
    userName = getString(KEYS.NAME, '');
    loadTheme();

    let savedPomodoro = getNumber(KEYS.POMODORO, 25);
    if (!Number.isFinite(savedPomodoro) || savedPomodoro < 1 || savedPomodoro > 120) {
      savedPomodoro = 25;
    }
    pomodoroMinutes = Math.round(savedPomodoro);
    timerRemaining = pomodoroMinutes * 60;

    todos = getJSON(KEYS.TODOS, [], function (arr) {
      if (!Array.isArray(arr)) return false;
      return arr.every(function (t) {
        return t && typeof t === 'object' &&
          typeof t.id === 'string' && typeof t.text === 'string' &&
          typeof t.completed === 'boolean';
      });
    });
    if (!Array.isArray(todos)) todos = [];

    loadLinks();

    // Apply UI
    if (clockEl) clockEl.setAttribute('aria-live', 'off'); // avoid spamming SRs
    updateGreeting();
    setRunning(false);
    if (timerModeEl) timerModeEl.textContent = 'Work';
    renderTimer();
    renderTodos();
    renderLinks();
    setupAddLinkForm();
    buildRewardOverlay();

    // Start the clock + greeting tick
    updateClock();
    setInterval(function () {
      updateClock();
      updateGreeting();
    }, 1000);

    // Wire up events
    if (themeToggleEl) themeToggleEl.addEventListener('click', toggleTheme);
    if (settingsOpenEl) settingsOpenEl.addEventListener('click', openSettings);
    if (settingsCloseEl) settingsCloseEl.addEventListener('click', closeSettings);
    if (settingsFormEl) settingsFormEl.addEventListener('submit', saveSettings);
    if (settingsDialogEl) settingsDialogEl.addEventListener('click', onSettingsBackdrop);

    if (timerStartEl) timerStartEl.addEventListener('click', startTimer);
    if (timerPauseEl) timerPauseEl.addEventListener('click', pauseTimer);
    if (timerResetEl) timerResetEl.addEventListener('click', resetTimer);

    if (todoFormEl) todoFormEl.addEventListener('submit', onTodoSubmit);
    if (todoClearAllEl) todoClearAllEl.addEventListener('click', onTodoClearAll);
    if (todoListEl) {
      todoListEl.addEventListener('click', onTodoListClick);
      todoListEl.addEventListener('change', onTodoListChange);
      todoListEl.addEventListener('dblclick', onTodoListDblClick);
    }

    if (linksNavEl) {
      linksNavEl.addEventListener('click', onLinksNavClick);
      linksNavEl.addEventListener('keydown', onLinksNavKeydown);
    }
  }

  // The script tag is at the end of <body>, but guard for safety.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
