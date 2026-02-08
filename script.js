(() => {
  "use strict";

  /* =======================================
     Area codes JSON (for note display)
  ======================================= */
  let areaList = [];
  let codeToArea = new Map();
  let sortedCodes = [];

  async function loadAreaCodes() {
    try {
      const res = await fetch("./area-codes.json", { cache: "no-store" });
      const data = await res.json();

      areaList = Array.isArray(data) ? data : [];

      codeToArea = new Map(
        areaList.map((x) => [
          String(x.code),
          x.areaName || x.note || "地域不明",
        ]),
      );
      // ★追加：市外局番配列をJSONから生成
      AREA_CODES = [...new Set(areaList.map((x) => String(x.code)))];
      // longest-match: 5 → 4 → 3 → 2
      sortedCodes = [...codeToArea.keys()].sort((a, b) => b.length - a.length);
    } catch (e) {
      // fallback
      areaList = [
        { code: "03", areaName: "東京都（23区）" },
        { code: "06", areaName: "大阪府（大阪市）" },
        { code: "04992", areaName: "東京都（小笠原諸島）" },
      ];
      codeToArea = new Map(
        areaList.map((x) => [
          String(x.code),
          x.areaName || x.note || "地域不明",
        ]),
      );
      sortedCodes = [...codeToArea.keys()].sort((a, b) => b.length - a.length);
    }
  }

  function resolveAreaNoteFromDigits(phoneDigits) {
    // phoneDigits is raw 10 digits
    for (const c of sortedCodes) {
      if (phoneDigits.startsWith(c)) return codeToArea.get(c) || "地域不明";
    }
    return "地域不明";
  }

  /* =======================================
     Original AREA_CODES (for natural hyphenation)
  ======================================= */
  let AREA_CODES = []; // JSON読込後にここへ入れる

  /* =======================================
     DOM Elements
  ======================================= */
  const screenSelect = document.getElementById("screen-select");
  const screenTyping = document.getElementById("screen-typing");
  const btnBack = document.getElementById("btn-back");
  const modeIndicator = document.getElementById("mode-indicator");
  const nowValue = document.getElementById("now-value");
  const nextArea = document.getElementById("next-area");
  const nextValue = document.getElementById("next-value");
  const typingInput = document.getElementById("typing-input");
  const inputDisplay = document.getElementById("input-display");
  const logList = document.getElementById("log-list");

  // added in HTML
  const areaNoteEl = document.getElementById("area-note");

  /* =======================================
     State
  ======================================= */
  let currentMode = null; // 'number' | 'birthday' | 'phone'
  let currentTarget = ""; // raw digits
  let nextTargetDigits = ""; // raw digits
  let currentAreaCodeLen = 0;
  let nextAreaCodeLen = 0;

  /* =======================================
     Utilities
  ======================================= */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateRandomNumber() {
    const digits = randInt(1, 12);
    let str = "";
    for (let i = 0; i < digits; i++) {
      if (i === 0 && digits > 1) str += randInt(1, 9).toString();
      else str += randInt(0, 9).toString();
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

  function generateRandomDate() {
    let y, m, d;
    do {
      y = randInt(1900, 2026);
      m = randInt(1, 12);
      d = randInt(1, 31);
    } while (!isValidDate(y, m, d));
    return (
      y.toString() +
      m.toString().padStart(2, "0") +
      d.toString().padStart(2, "0")
    );
  }

  // Japanese landline: always 10 digits total
  function generatePhoneNumber() {
    const code = AREA_CODES[randInt(0, AREA_CODES.length - 1)];
    const codeLen = code.length;
    const totalDigits = 10;
    const subscriberLen = 4;
    const middleLen = totalDigits - codeLen - subscriberLen;

    let middle = "";
    for (let i = 0; i < middleLen; i++) middle += randInt(0, 9).toString();

    let subscriber = "";
    for (let i = 0; i < subscriberLen; i++)
      subscriber += randInt(0, 9).toString();

    return { digits: code + middle + subscriber, areaCodeLen: codeLen };
  }

  function formatPhone(digits, areaCodeLen) {
    const a = digits.slice(0, areaCodeLen);
    const m = digits.slice(areaCodeLen, digits.length - 4);
    const s = digits.slice(digits.length - 4);
    return a + "-" + m + "-" + s;
  }

  function formatPhoneInput(raw, areaCodeLen) {
    const middleEnd = 10 - 4;
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      if (i === areaCodeLen || i === middleEnd) result += "-";
      result += raw[i];
    }
    return result;
  }

  function generateValue() {
    if (currentMode === "number")
      return { digits: generateRandomNumber(), areaCodeLen: 0 };
    if (currentMode === "birthday")
      return { digits: generateRandomDate(), areaCodeLen: 0 };
    return generatePhoneNumber();
  }

  function formatDisplay(digits, areaCodeLen) {
    if (currentMode === "birthday" && digits.length === 8) {
      return (
        digits.slice(0, 4) + " " + digits.slice(4, 6) + " " + digits.slice(6, 8)
      );
    }
    if (currentMode === "phone") return formatPhone(digits, areaCodeLen);
    return digits;
  }

  function formatInputDisplay(raw) {
    if (currentMode === "phone")
      return formatPhoneInput(raw, currentAreaCodeLen);
    return raw;
  }

  /* =======================================
     Screen Navigation
  ======================================= */
  function showScreen(id) {
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function setAreaNote(text) {
    if (!areaNoteEl) return;
    areaNoteEl.textContent = text || "";

    if (currentMode === "phone") areaNoteEl.classList.remove("hidden");
    else areaNoteEl.classList.add("hidden");

    fitAreaNoteScale();
  }

  function fitAreaNoteScale() {
    if (!areaNoteEl) return;
    if (areaNoteEl.classList.contains("hidden")) return;

    // ★ 修正：:root の CSS 変数として更新（CSS側の設計意図どおり）
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--area-scale", "1");

    const max = 1.0;
    const min = 0.55;

    let lo = min;
    let hi = max;

    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      rootStyle.setProperty("--area-scale", String(mid));

      const rawW = areaNoteEl.scrollWidth;
      const boxW = areaNoteEl.clientWidth;

      if (rawW * mid <= boxW) lo = mid;
      else hi = mid;
    }

    rootStyle.setProperty("--area-scale", String(lo));
  }

  function startMode(mode) {
    currentMode = mode;
    logList.innerHTML = "";
    typingInput.value = "";
    inputDisplay.textContent = "";

    const modeNames = {
      number: "無限数値タイピング",
      birthday: "生年月日タイピング",
      phone: "電話番号タイピング",
    };
    modeIndicator.textContent = modeNames[mode];

    nextArea.classList.remove("hidden");

    const nowVal = generateValue();
    currentTarget = nowVal.digits;
    currentAreaCodeLen = nowVal.areaCodeLen;

    const nextVal = generateValue();
    nextTargetDigits = nextVal.digits;
    nextAreaCodeLen = nextVal.areaCodeLen;

    nowValue.textContent = formatDisplay(currentTarget, currentAreaCodeLen);
    nextValue.textContent = formatDisplay(nextTargetDigits, nextAreaCodeLen);

    if (currentMode === "phone") {
      setAreaNote(resolveAreaNoteFromDigits(currentTarget));
    } else {
      setAreaNote("");
    }

    showScreen("screen-typing");
    requestAnimationFrame(() => {
      typingInput.focus({ preventScroll: true });
    });
  }

  function goBack() {
    currentMode = null;
    setAreaNote("");
    showScreen("screen-select");
  }

  /* =======================================
     Input Handling
  ======================================= */
  function onInput() {
    const raw = typingInput.value.replace(/\D/g, "");
    typingInput.value = raw;

    inputDisplay.textContent = formatInputDisplay(raw);

    const targetLen = currentTarget.length;
    if (raw.length >= targetLen) {
      advanceTarget(raw);
    }
  }

  function advanceTarget(typed) {
    const logText =
      currentMode === "phone"
        ? formatPhoneInput(
            typed.slice(0, currentTarget.length),
            currentAreaCodeLen,
          )
        : typed;

    addLogEntry(logText);

    currentTarget = nextTargetDigits;
    currentAreaCodeLen = nextAreaCodeLen;

    const nextVal = generateValue();
    nextTargetDigits = nextVal.digits;
    nextAreaCodeLen = nextVal.areaCodeLen;

    nowValue.textContent = formatDisplay(currentTarget, currentAreaCodeLen);
    nextValue.textContent = formatDisplay(nextTargetDigits, nextAreaCodeLen);

    typingInput.value = "";
    inputDisplay.textContent = "";

    if (currentMode === "phone") {
      setAreaNote(resolveAreaNoteFromDigits(currentTarget));
    } else {
      setAreaNote("");
    }

    typingInput.focus({ preventScroll: true });
  }

  function addLogEntry(text) {
    const el = document.createElement("div");
    el.className = "log-item";
    el.textContent = text;
    logList.appendChild(el);

    requestAnimationFrame(() => {
      logList.scrollTop = logList.scrollHeight;
    });

    while (logList.children.length > 200) {
      logList.removeChild(logList.firstChild);
    }
  }

  /* =======================================
     Event Listeners
  ======================================= */
  document.querySelectorAll(".btn-start").forEach((btn) => {
    btn.addEventListener("click", () => startMode(btn.dataset.mode));
  });

  btnBack.addEventListener("click", goBack);
  typingInput.addEventListener("input", onInput);

  typingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }
    const allowed = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  });

  screenTyping.addEventListener("click", (e) => {
    if (e.target !== btnBack) typingInput.focus({ preventScroll: true });
  });

  window.addEventListener("focus", () => {
    if (currentMode) typingInput.focus({ preventScroll: true });
  });

  typingInput.addEventListener("blur", () => {
    if (currentMode) {
      setTimeout(() => {
        if (currentMode && document.activeElement !== btnBack)
          typingInput.focus({ preventScroll: true });
      }, 100);
    }
  });

  window.addEventListener("resize", () => {
    fitAreaNoteScale();
  });

  /* =======================================
     Init: load JSON first
  ======================================= */
  (async function init() {
    await loadAreaCodes();
  })();
})();
