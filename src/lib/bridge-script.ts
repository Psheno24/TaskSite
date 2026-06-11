/**
 * Injected into task HTML inside the iframe.
 * Communicates with the parent page via postMessage for autosave.
 */
export const BRIDGE_SCRIPT = `
(function () {
  var DEBOUNCE_MS = 500;
  var POLL_MS = 2000;
  var debounceTimer = null;
  var pollTimer = null;
  var isReadOnly = false;
  var isRestoring = false;
  var allowSave = false;
  var lastSnapshot = "";
  var bridgeIdCounter = 0;
  var pendingAnswers = null;
  var restoreTimer = null;

  function isContentEditable(el) {
    return el.getAttribute && el.getAttribute("contenteditable") === "true";
  }

  function ensureBridgeId(el) {
    if (el.dataset && el.dataset.bridgeId) {
      return el.dataset.bridgeId;
    }
    bridgeIdCounter += 1;
    var id = "bridge_" + bridgeIdCounter;
    if (el.dataset) el.dataset.bridgeId = id;
    return id;
  }

  function parseCheckHandler(el) {
    var onclick = el.getAttribute("onclick") || "";
    var match = onclick.match(
      /check\\s*\\(\\s*this\\s*,\\s*['"]([^'"]+)['"]\\s*,\\s*['"]([^'"]*)['"]\\s*\\)/i
    );
    if (match) {
      return { questionId: match[1], value: match[2] };
    }
    return null;
  }

  function getQuizButtonQuestionId(btn) {
    var parsed = parseCheckHandler(btn);
    if (parsed) return parsed.questionId;

    var parent = btn.closest(".opts, .options, .choices, [data-question]") || btn.parentElement;
    if (parent) return "opts:" + ensureBridgeId(parent);
    return "btn:" + ensureBridgeId(btn);
  }

  function getQuizButtonValue(btn) {
    var parsed = parseCheckHandler(btn);
    if (parsed) return parsed.value;
    return (btn.textContent || "").trim();
  }

  function isQuizOptionButton(el) {
    if (!el || el.tagName !== "BUTTON") return false;
    if (el.classList && (el.classList.contains("opt") || el.classList.contains("option"))) {
      return true;
    }
    var onclick = el.getAttribute("onclick") || "";
    return onclick.indexOf("check(") !== -1;
  }

  function getQuizButtonGroups() {
    var groups = {};
    var buttons = document.querySelectorAll("button");
    buttons.forEach(function (btn) {
      if (!isQuizOptionButton(btn)) return;
      var qId = getQuizButtonQuestionId(btn);
      if (!groups[qId]) groups[qId] = [];
      groups[qId].push(btn);
    });
    return groups;
  }

  function getSelectedQuizButton(group) {
    var i;
    for (i = 0; i < group.length; i++) {
      if (group[i].classList.contains("wrong")) return group[i];
    }
    for (i = 0; i < group.length; i++) {
      if (group[i].classList.contains("correct")) return group[i];
    }
    for (i = 0; i < group.length; i++) {
      if (
        group[i].classList.contains("selected") ||
        group[i].classList.contains("active") ||
        group[i].classList.contains("chosen") ||
        group[i].classList.contains("picked")
      ) {
        return group[i];
      }
    }
    return null;
  }

  function collectQuizButtonAnswers(answers) {
    var groups = getQuizButtonGroups();
    Object.keys(groups).forEach(function (qId) {
      var selected = getSelectedQuizButton(groups[qId]);
      if (selected) {
        answers[qId] = getQuizButtonValue(selected);
      }
    });
  }

  function applyQuizButtonAnswers(answers, onlyEmpty) {
    var groups = getQuizButtonGroups();

    Object.keys(answers).forEach(function (qId) {
      if (!(qId in answers)) return;
      var value = String(answers[qId]);
      var group = groups[qId];
      if (!group || !group.length) return;

      var already = getSelectedQuizButton(group);
      if (already && getQuizButtonValue(already) === value) return;
      if (onlyEmpty && already) return;

      for (var i = 0; i < group.length; i++) {
        var btn = group[i];
        if (getQuizButtonValue(btn) !== value) continue;

        isRestoring = true;
        try {
          if (typeof window.check === "function") {
            var parsed = parseCheckHandler(btn);
            if (parsed) {
              window.check(btn, parsed.questionId, parsed.value);
            } else {
              btn.click();
            }
          } else {
            btn.click();
          }
        } catch (e) {
          try { btn.click(); } catch (e2) {}
        }
        isRestoring = false;
        break;
      }
    });
  }

  function getRadioGroupKey(el) {
    if (el.name) return "name:" + el.name;

    var node = el.parentElement;
    while (node && node !== document.body) {
      var radios = node.querySelectorAll('input[type="radio"]');
      if (radios.length > 1) {
        var parent = node.parentElement;
        var parentRadios = parent
          ? parent.querySelectorAll('input[type="radio"]')
          : [];
        if (parentRadios.length !== radios.length) {
          return "rg:" + ensureBridgeId(node);
        }
      }
      node = node.parentElement;
    }

    return "r:" + ensureBridgeId(el);
  }

  function getCheckboxGroupKey(el) {
    if (el.name) return "name:" + el.name;
    return "cb:" + ensureBridgeId(el);
  }

  function getFieldKey(el, index) {
    if (el.name) return el.name;
    if (el.id) return el.id;
    if (el.dataset && el.dataset.answerId) return el.dataset.answerId;
    if (el.dataset && el.dataset.questionId) return el.dataset.questionId;
    if (el.getAttribute && el.getAttribute("aria-label")) {
      return "aria:" + el.getAttribute("aria-label");
    }
    return ensureBridgeId(el);
  }

  function getFieldValue(el) {
    if (isContentEditable(el)) {
      return el.innerText || el.textContent || "";
    }
    return el.value != null ? el.value : "";
  }

  function setFieldValue(el, value) {
    if (isContentEditable(el)) {
      el.innerText = String(value);
      return;
    }
    el.value = String(value);
  }

  function getRadioGroups() {
    var groups = {};
    var radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(function (el) {
      var key = getRadioGroupKey(el);
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });
    return groups;
  }

  function getRadioStoredValue(el, group) {
    if (el.checked) {
      if (el.value) return el.value;
      if (el.id) return el.id;
      var idx = group.indexOf(el);
      return "idx:" + idx;
    }
    return null;
  }

  function matchRadioValue(el, group, stored) {
    if (stored === el.value || stored === el.id) return true;
    if (String(stored).indexOf("idx:") === 0) {
      var idx = parseInt(String(stored).slice(4), 10);
      return group.indexOf(el) === idx;
    }
    return false;
  }

  function getAllFields() {
    var standard = document.querySelectorAll("input, textarea, select");
    var editables = document.querySelectorAll('[contenteditable="true"]');
    var map = new Map();
    standard.forEach(function (el) { map.set(el, true); });
    editables.forEach(function (el) { map.set(el, true); });
    return Array.from(map.keys());
  }

  function collectAnswers() {
    var answers = {};
    var fields = getAllFields();
    var checkboxGroups = {};
    var radioGroups = getRadioGroups();

    Object.keys(radioGroups).forEach(function (key) {
      var group = radioGroups[key];
      for (var i = 0; i < group.length; i++) {
        var stored = getRadioStoredValue(group[i], group);
        if (stored !== null) {
          answers[key] = stored;
          break;
        }
      }
    });

    collectQuizButtonAnswers(answers);

    fields.forEach(function (el, index) {
      var tag = el.tagName.toLowerCase();
      var type = (el.type || "").toLowerCase();

      if (isContentEditable(el)) {
        answers[getFieldKey(el, index)] = getFieldValue(el);
        return;
      }

      if (type === "radio") return;

      if (type === "checkbox") {
        var cbKey = getCheckboxGroupKey(el);
        if (!checkboxGroups[cbKey]) checkboxGroups[cbKey] = [];
        if (el.checked) checkboxGroups[cbKey].push(el.value || el.id || "on");
        return;
      }

      if (type === "button" || type === "submit" || type === "reset" || type === "file" || type === "hidden") {
        return;
      }

      var key = getFieldKey(el, index);

      if (tag === "select") {
        if (el.multiple) {
          answers[key] = Array.from(el.selectedOptions).map(function (o) { return o.value; });
        } else {
          answers[key] = el.value;
        }
        return;
      }

      answers[key] = getFieldValue(el);
    });

    Object.keys(checkboxGroups).forEach(function (k) {
      if (checkboxGroups[k].length > 0) answers[k] = checkboxGroups[k];
    });

    return answers;
  }

  function applyAnswers(answers, onlyEmpty) {
    if (!answers || typeof answers !== "object") return;
    pendingAnswers = answers;
    isRestoring = true;

    var radioGroups = getRadioGroups();
    Object.keys(radioGroups).forEach(function (key) {
      if (!(key in answers)) return;
      var value = answers[key];
      var group = radioGroups[key];
      group.forEach(function (el) {
        if (document.activeElement === el) return;
        el.checked = matchRadioValue(el, group, value);
      });
    });

    applyQuizButtonAnswers(answers, onlyEmpty);

    var fields = getAllFields();

    fields.forEach(function (el, index) {
      var tag = el.tagName.toLowerCase();
      var type = (el.type || "").toLowerCase();
      var key = getFieldKey(el, index);

      if (type === "radio") return;

      if (!(key in answers)) return;
      var value = answers[key];

      if (document.activeElement === el) return;

      if (onlyEmpty && !isContentEditable(el) && type !== "checkbox") {
        var current = getFieldValue(el);
        if (String(current).trim() !== "") return;
      }

      if (isContentEditable(el)) {
        var text = getFieldValue(el);
        if (String(text) === String(value)) return;
        if (onlyEmpty && String(text).trim() !== "") return;
        setFieldValue(el, value);
        return;
      }

      if (type === "checkbox") {
        var cbKey = getCheckboxGroupKey(el);
        var cbValue = answers[cbKey] || answers[key];
        if (Array.isArray(cbValue)) {
          el.checked = cbValue.indexOf(el.value || el.id || "on") !== -1;
        } else {
          el.checked = !!cbValue;
        }
        return;
      }

      if (tag === "select") {
        if (el.multiple && Array.isArray(value)) {
          Array.from(el.options).forEach(function (opt) {
            opt.selected = value.indexOf(opt.value) !== -1;
          });
        } else {
          el.value = String(value);
        }
        return;
      }

      if (String(getFieldValue(el)) === String(value)) return;
      setFieldValue(el, value);
    });

    isRestoring = false;
  }

  function setReadOnly(readonly) {
    isReadOnly = !!readonly;
    var fields = getAllFields();
    fields.forEach(function (el) {
      if (isContentEditable(el)) {
        if (isReadOnly) el.contentEditable = "false";
        return;
      }
      var type = (el.type || "").toLowerCase();
      if (type === "hidden") return;
      if (el.tagName.toLowerCase() === "textarea" || el.tagName.toLowerCase() === "select" ||
          ["text", "email", "number", "password", "search", "tel", "url", ""].indexOf(type) !== -1) {
        el.disabled = isReadOnly;
      }
      if (type === "radio" || type === "checkbox") {
        el.disabled = isReadOnly;
      }
    });

    if (isReadOnly) {
      document.querySelectorAll("button").forEach(function (btn) {
        if (isQuizOptionButton(btn)) btn.disabled = true;
      });
    }
  }

  function buildMergedAnswers() {
    var collected = collectAnswers();
    var answers = {};
    var key;

    if (pendingAnswers && typeof pendingAnswers === "object") {
      for (key in pendingAnswers) {
        if (Object.prototype.hasOwnProperty.call(pendingAnswers, key)) {
          answers[key] = pendingAnswers[key];
        }
      }
    }

    for (key in collected) {
      if (Object.prototype.hasOwnProperty.call(collected, key)) {
        answers[key] = collected[key];
      }
    }

    return answers;
  }

  function scheduleAllowSave() {
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(function () {
      allowSave = true;
      lastSnapshot = JSON.stringify(buildMergedAnswers());
    }, 2500);
  }

  function sendAnswers() {
    if (isReadOnly || isRestoring || !allowSave) return;
    var answers = buildMergedAnswers();
    var snapshot = JSON.stringify(answers);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    pendingAnswers = answers;
    window.parent.postMessage({
      type: "ANSWERS_CHANGED",
      answers: answers
    }, "*");
  }

  function notifyChange() {
    if (isReadOnly || isRestoring) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendAnswers, DEBOUNCE_MS);
  }

  function onParentMessage(event) {
    var data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "RESTORE_ANSWERS") {
      allowSave = false;
      applyAnswers(data.answers, false);
      scheduleAllowSave();
    }

    if (data.type === "SET_READONLY") {
      setReadOnly(data.readonly);
    }

    if (data.type === "REQUEST_ANSWERS") {
      var prevAllow = allowSave;
      allowSave = true;
      sendAnswers();
      allowSave = prevAllow;
    }
  }

  document.addEventListener("input", notifyChange, true);
  document.addEventListener("change", notifyChange, true);
  document.addEventListener("click", notifyChange, true);
  document.addEventListener("paste", notifyChange, true);
  window.addEventListener("message", onParentMessage);

  if (typeof MutationObserver !== "undefined") {
    var observer = new MutationObserver(function (mutations) {
      var hasNewNodes = false;
      var hasAttrChange = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList" && mutations[i].addedNodes.length > 0) {
          hasNewNodes = true;
        }
        if (
          mutations[i].type === "attributes" &&
          (mutations[i].attributeName === "class" ||
            mutations[i].attributeName === "disabled" ||
            mutations[i].attributeName === "aria-checked")
        ) {
          hasAttrChange = true;
        }
      }
      if (hasNewNodes && pendingAnswers) {
        applyAnswers(pendingAnswers, true);
      }
      if (hasAttrChange) {
        notifyChange();
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "checked", "aria-checked"]
    });
  }

  function init() {
    window.parent.postMessage({ type: "TASK_READY" }, "*");
    pollTimer = setInterval(sendAnswers, POLL_MS);
    scheduleAllowSave();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

export function injectBridgeIntoHtml(html: string): string {
  const scriptTag = `<script>${BRIDGE_SCRIPT}<\/script>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${scriptTag}</body>`);
  }

  if (html.includes("</html>")) {
    return html.replace("</html>", `${scriptTag}</html>`);
  }

  return html + scriptTag;
}
