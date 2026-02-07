(() => {
  'use strict';

  // ===== DOM Elements =====
  const screenSelect = document.getElementById('screen-select');
  const screenTyping = document.getElementById('screen-typing');
  const btnBack = document.getElementById('btn-back');
  const modeIndicator = document.getElementById('mode-indicator');
  const nowValue = document.getElementById('now-value');
  const nextArea = document.getElementById('next-area');
  const nextValue = document.getElementById('next-value');
  const typingInput = document.getElementById('typing-input');
  const inputDisplay = document.getElementById('input-display');
  const logList = document.getElementById('log-list');

  // ===== State =====
  let currentMode = null; // 'number' | 'birthday'
  let currentTarget = '';
  let nextTarget = '';

  // ===== Utilities =====

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Generate random numeric string of 1-12 digits (uniform digit-length distribution) */
  function generateRandomNumber() {
    const digits = randInt(1, 12);
    let str = '';
    for (let i = 0; i < digits; i++) {
      if (i === 0 && digits > 1) {
        str += randInt(1, 9).toString();
      } else {
        str += randInt(0, 9).toString();
      }
    }
    return str;
  }

  function isValidDate(y, m, d) {
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  }

  /** Generate a valid random date string (yyyyMMdd) between 19000101 and 20261231 */
  function generateRandomDate() {
    let y, m, d;
    do {
      y = randInt(1900, 2026);
      m = randInt(1, 12);
      d = randInt(1, 31);
    } while (!isValidDate(y, m, d));

    const yy = y.toString();
    const mm = m.toString().padStart(2, '0');
    const dd = d.toString().padStart(2, '0');
    return yy + mm + dd;
  }

  /** Generate a new value based on current mode */
  function generateValue() {
    return currentMode === 'number' ? generateRandomNumber() : generateRandomDate();
  }

  /** Format for display */
  function formatDisplay(str) {
    if (currentMode === 'birthday' && str.length === 8) {
      return str.slice(0, 4) + ' ' + str.slice(4, 6) + ' ' + str.slice(6, 8);
    }
    return str;
  }

  // ===== Screen Navigation =====

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function startMode(mode) {
    currentMode = mode;
    logList.innerHTML = '';
    typingInput.value = '';
    inputDisplay.textContent = '';

    if (mode === 'number') {
      modeIndicator.textContent = '無限数値タイピング';
    } else {
      modeIndicator.textContent = '生年月日タイピング';
    }

    // Both modes: initialize NOW and NEXT
    nextArea.classList.remove('hidden');
    currentTarget = generateValue();
    nextTarget = generateValue();
    nowValue.textContent = formatDisplay(currentTarget);
    nextValue.textContent = formatDisplay(nextTarget);

    showScreen('screen-typing');

    requestAnimationFrame(() => {
      typingInput.focus({ preventScroll: true });
    });
  }

  function goBack() {
    currentMode = null;
    showScreen('screen-select');
  }

  // ===== Input Handling =====

  function onInput() {
    const raw = typingInput.value.replace(/\D/g, '');
    typingInput.value = raw;
    inputDisplay.textContent = raw;

    const targetLen = currentTarget.length;

    if (raw.length >= targetLen) {
      advanceTarget(raw);
    }
  }

  function advanceTarget(typed) {
    addLogEntry(typed);

    // Both modes use the same promote + replenish logic:
    // 1. NOW ← NEXT (promote)
    // 2. NEXT ← new value (replenish)
    currentTarget = nextTarget;
    nextTarget = generateValue();
    nowValue.textContent = formatDisplay(currentTarget);
    nextValue.textContent = formatDisplay(nextTarget);

    typingInput.value = '';
    inputDisplay.textContent = '';
    typingInput.focus({ preventScroll: true });
  }

  function addLogEntry(typed) {
    const el = document.createElement('div');
    el.className = 'log-item';
    el.textContent = typed;
    logList.appendChild(el);

    requestAnimationFrame(() => {
      logList.scrollTop = logList.scrollHeight;
    });

    while (logList.children.length > 200) {
      logList.removeChild(logList.firstChild);
    }
  }

  // ===== Event Listeners =====

  document.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', () => {
      startMode(btn.dataset.mode);
    });
  });

  btnBack.addEventListener('click', goBack);

  typingInput.addEventListener('input', onInput);

  typingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  });

  screenTyping.addEventListener('click', (e) => {
    if (e.target !== btnBack) {
      typingInput.focus({ preventScroll: true });
    }
  });

  window.addEventListener('focus', () => {
    if (currentMode) {
      typingInput.focus({ preventScroll: true });
    }
  });

  typingInput.addEventListener('blur', () => {
    if (currentMode) {
      setTimeout(() => {
        if (currentMode && document.activeElement !== btnBack) {
          typingInput.focus({ preventScroll: true });
        }
      }, 100);
    }
  });

})();
