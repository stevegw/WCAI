/**
 * WCAI -- Narration Module
 * =========================
 * Page-level text-to-speech with:
 *   - Sticky control bar (always visible) with voice/speed selectors
 *   - Click anywhere in text to start narration from that word
 *   - Word-level highlighting overlay with auto-scroll
 *   - Sentence chunking (Chrome 15s workaround)
 *   - onboundary events with timer fallback
 *   - Auto-injected section play buttons on headings
 *
 * Ported from ptclms NarrationPlayer pattern.
 * Attached to window.WCAI.speech.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  /* ── Constants ────────────────────────────────────────────── */
  var RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  var STORAGE_VOICE = "wcai_narr_voice";
  var STORAGE_RATE = "wcai_narr_rate";
  var DEFAULT_CPM = 0.015; // chars per millisecond at 1x
  var TIMER_INTERVAL = 50;

  /* ── State ────────────────────────────────────────────────── */
  var synth = window.speechSynthesis || null;
  var voices = [];
  var selectedVoice = null;
  var rate = 1.0;

  // Playback state
  var state = "stopped"; // "stopped" | "playing" | "paused"
  var narrationId = 0;   // generation counter to ignore stale callbacks
  var chunks = [];
  var currentChunk = 0;

  // Text map: array of { node: TextNode, start: int, end: int }
  var textMap = [];
  var fullText = "";
  var narrationRoot = null; // the element we're narrating

  // Highlight
  var overlay = null;
  var boundaryFired = false;

  // Timer fallback
  var timerInterval = null;
  var wordSchedule = [];
  var playStart = 0;
  var pausedDuration = 0;
  var pauseStartTime = 0;
  var lastTimerWord = -1;
  var calibratedCPM = DEFAULT_CPM;

  // UI
  var bar = null;
  var sectionBtns = [];
  var clickHandler = null;

  /* ── Helpers ──────────────────────────────────────────────── */
  function isSupported() { return !!synth; }

  function isBlockEl(el) {
    if (!el || el.nodeType !== 1) return false;
    var d = window.getComputedStyle(el).display;
    return d === "block" || d === "flex" || d === "grid" || d === "list-item" || d === "table";
  }

  function getBlockAncestor(node, root) {
    var el = node.parentElement;
    while (el && el !== root) {
      if (isBlockEl(el)) return el;
      el = el.parentElement;
    }
    return root;
  }

  /* ── Voice Management ─────────────────────────────────────── */
  function loadVoices() {
    if (!synth) return;
    var v = synth.getVoices();
    if (!v.length) return;
    voices = v;

    var saved = localStorage.getItem(STORAGE_VOICE);
    if (saved) {
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].name === saved) { selectedVoice = voices[i]; break; }
      }
    }
    if (!selectedVoice) pickDefaultVoice();
    populateVoiceSelect();
  }

  function pickDefaultVoice() {
    var english = [], localEn = [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf("en") === 0) {
        english.push(voices[i]);
        if (voices[i].localService) localEn.push(voices[i]);
      }
    }
    selectedVoice = (localEn[0] || english[0] || voices[0]) || null;
  }

  function populateVoiceSelect() {
    var sel = bar && bar.querySelector("#narr-voice");
    if (!sel || !voices.length) return;
    sel.innerHTML = "";
    for (var i = 0; i < voices.length; i++) {
      var o = document.createElement("option");
      o.value = voices[i].name;
      var lang = voices[i].lang || "";
      o.textContent = voices[i].name + (lang ? " (" + lang + ")" : "");
      if (selectedVoice && voices[i].name === selectedVoice.name) o.selected = true;
      sel.appendChild(o);
    }
  }

  /* ── Text Map ─────────────────────────────────────────────── */
  /** Walk DOM text nodes under `root`, build map of char positions */
  function buildTextMap(root) {
    var map = [];
    var offset = 0;
    var lastBlock = null;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Skip text inside buttons, SVGs, script, style
        var p = node.parentElement;
        while (p && p !== root) {
          var tag = p.tagName;
          if (tag === "BUTTON" || tag === "SVG" || tag === "SCRIPT" || tag === "STYLE" ||
              p.classList.contains("narr-section-btn") || p.classList.contains("narr-bar")) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var node;
    while ((node = walker.nextNode())) {
      var len = (node.textContent || "").length;
      if (len === 0) continue;

      // Insert virtual space between block elements
      var block = getBlockAncestor(node, root);
      if (lastBlock && block !== lastBlock && offset > 0) {
        offset += 1; // virtual space
      }
      lastBlock = block;

      map.push({ node: node, start: offset, end: offset + len });
      offset += len;
    }

    return map;
  }

  /** Reconstruct full text from text map (with virtual spaces between blocks) */
  function buildFullText(map) {
    var result = "";
    for (var i = 0; i < map.length; i++) {
      if (i > 0 && map[i].start > map[i - 1].end) {
        result += " "; // virtual space
      }
      result += map[i].node.textContent || "";
    }
    return result;
  }

  /** Find the text map entry containing charIndex (binary search) */
  function findNodeForChar(charIdx) {
    var lo = 0, hi = textMap.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (charIdx < textMap[mid].start) hi = mid - 1;
      else if (charIdx >= textMap[mid].end) lo = mid + 1;
      else return textMap[mid];
    }
    return null;
  }

  /* ── Sentence Chunking ────────────────────────────────────── */
  function splitIntoChunks(text, startOffset) {
    startOffset = startOffset || 0;
    var result = [];
    var start = 0;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if ((ch === "." || ch === "!" || ch === "?") &&
          (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
        var end = i + 1;
        while (end < text.length && /\s/.test(text[end])) end++;
        var chunk = text.slice(start, end);
        if (chunk.trim()) {
          result.push({ text: chunk, startChar: startOffset + start });
        }
        start = end;
      }
    }
    // Remainder
    if (start < text.length) {
      var rem = text.slice(start);
      if (rem.trim()) {
        result.push({ text: rem, startChar: startOffset + start });
      }
    }

    // Merge short chunks (< 20 chars) with previous
    var merged = [];
    for (var j = 0; j < result.length; j++) {
      if (merged.length > 0 && result[j].text.trim().length < 20) {
        merged[merged.length - 1].text += result[j].text;
      } else {
        merged.push({ text: result[j].text, startChar: result[j].startChar });
      }
    }
    return merged.length > 0 ? merged : [{ text: text, startChar: startOffset }];
  }

  /* ── Word Schedule (timer fallback) ───────────────────────── */
  function computeWordSchedule(chunkText, chunkStartChar) {
    var schedule = [];
    var re = /\S+/g;
    var m;
    while ((m = re.exec(chunkText)) !== null) {
      var charPos = m.index;
      var time = charPos / (calibratedCPM * rate);
      schedule.push({
        charIndex: chunkStartChar + m.index,
        charLength: m[0].length,
        time: time
      });
    }
    return schedule;
  }

  /* ── Highlight Overlay ────────────────────────────────────── */
  function ensureOverlay() {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "narr-word-overlay";
      overlay.style.cssText = "position:absolute;pointer-events:none;background:rgba(250,204,21,0.40);border-radius:2px;transition:all 0.08s ease;z-index:50;display:none;";
    }
    // Attach to narration root
    if (narrationRoot && overlay.parentElement !== narrationRoot) {
      if (narrationRoot.style.position === "" || narrationRoot.style.position === "static") {
        narrationRoot.style.position = "relative";
      }
      narrationRoot.appendChild(overlay);
    }
    return overlay;
  }

  function highlightWord(charIndex, charLength) {
    var entry = findNodeForChar(charIndex);
    if (!entry) return;

    var localOffset = charIndex - entry.start;
    var nodeText = entry.node.textContent || "";
    var wordEnd = localOffset + (charLength || 0);

    // If charLength is 0, find word boundary
    if (!charLength || charLength <= 0) {
      wordEnd = localOffset;
      while (wordEnd < nodeText.length && !/\s/.test(nodeText[wordEnd])) wordEnd++;
    }
    if (wordEnd > nodeText.length) wordEnd = nodeText.length;
    if (localOffset >= nodeText.length) return;

    try {
      var range = document.createRange();
      range.setStart(entry.node, localOffset);
      range.setEnd(entry.node, wordEnd);

      var rangeRect = range.getBoundingClientRect();
      if (rangeRect.width === 0 && rangeRect.height === 0) return;

      var rootRect = narrationRoot.getBoundingClientRect();
      var ov = ensureOverlay();

      ov.style.top = (rangeRect.top - rootRect.top + narrationRoot.scrollTop) + "px";
      ov.style.left = (rangeRect.left - rootRect.left + narrationRoot.scrollLeft) + "px";
      ov.style.width = rangeRect.width + "px";
      ov.style.height = rangeRect.height + "px";
      ov.style.display = "block";

      // Auto-scroll to keep highlighted word visible
      var mainEl = document.getElementById("main");
      if (mainEl) {
        var mainRect = mainEl.getBoundingClientRect();
        if (rangeRect.top < mainRect.top + 40 || rangeRect.bottom > mainRect.bottom - 60) {
          entry.node.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    } catch (e) {
      // Range errors can happen with edge-case DOM nodes
    }
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
  }

  /* ── Timer Fallback ───────────────────────────────────────── */
  function startChunkTimer() {
    stopTimer();
    playStart = Date.now();
    pausedDuration = 0;
    lastTimerWord = -1;

    timerInterval = setInterval(function () {
      if (boundaryFired) { stopTimer(); return; }
      if (state !== "playing") return;

      var elapsed = Date.now() - playStart - pausedDuration;
      var idx = -1;
      for (var i = wordSchedule.length - 1; i >= 0; i--) {
        if (wordSchedule[i].time <= elapsed) { idx = i; break; }
      }
      if (idx >= 0 && idx !== lastTimerWord) {
        lastTimerWord = idx;
        highlightWord(wordSchedule[idx].charIndex, wordSchedule[idx].charLength);
      }
    }, TIMER_INTERVAL);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  /* ── Core Playback ────────────────────────────────────────── */
  function startNarration(root, fromCharIndex) {
    if (!isSupported()) return;
    stopNarration();

    narrationRoot = root;
    textMap = buildTextMap(root);
    fullText = buildFullText(textMap);

    if (!fullText.trim()) return;

    fromCharIndex = fromCharIndex || 0;
    var textToSpeak = fullText.substring(fromCharIndex);
    if (!textToSpeak.trim()) return;

    chunks = splitIntoChunks(textToSpeak, fromCharIndex);
    currentChunk = 0;
    narrationId++;
    boundaryFired = false;
    calibratedCPM = DEFAULT_CPM;

    state = "playing";
    showBar(chunks[0].text);
    speakNextChunk();
  }

  function speakNextChunk() {
    if (state === "stopped" || currentChunk >= chunks.length) {
      onDone();
      return;
    }

    var myId = narrationId;
    var chunk = chunks[currentChunk];
    var chunkStart = Date.now();

    // Build word schedule for timer fallback
    wordSchedule = computeWordSchedule(chunk.text, chunk.startChar);

    var utt = new SpeechSynthesisUtterance(chunk.text);
    utt.rate = rate;
    utt.pitch = 1.0;
    if (selectedVoice) utt.voice = selectedVoice;

    // Word boundary events (preferred highlighting)
    utt.onboundary = function (e) {
      if (myId !== narrationId) return;
      if (e.name === "word") {
        if (!boundaryFired) {
          boundaryFired = true;
          stopTimer();
        }
        highlightWord(chunk.startChar + e.charIndex, e.charLength || 0);
      }
    };

    utt.onend = function () {
      if (myId !== narrationId) return;
      stopTimer();

      // Calibrate: measure actual duration
      var elapsed = Date.now() - chunkStart - pausedDuration;
      if (elapsed > 100 && chunk.text.length > 5) {
        calibratedCPM = chunk.text.length / elapsed;
      }

      currentChunk++;
      if (currentChunk < chunks.length) {
        updateLabel(chunks[currentChunk].text);
        speakNextChunk();
      } else {
        onDone();
      }
    };

    utt.onerror = function () {
      if (myId !== narrationId) return;
      onDone();
    };

    // Start timer fallback (in case onboundary doesn't fire)
    if (!boundaryFired) startChunkTimer();

    updateLabel(chunk.text);

    // Small delay after cancel to avoid Chrome dropping the utterance
    setTimeout(function () {
      if (myId === narrationId && state === "playing") {
        synth.speak(utt);
      }
    }, currentChunk === 0 ? 60 : 10);
  }

  function stopNarration() {
    narrationId++;
    if (synth) synth.cancel();
    stopTimer();
    hideOverlay();
    state = "stopped";
    chunks = [];
    currentChunk = 0;
    textMap = [];
    fullText = "";
    narrationRoot = null;
    if (bar) bar.classList.remove("speaking");
    updatePlayIcon();
  }

  function onDone() {
    stopTimer();
    hideOverlay();
    state = "stopped";
    chunks = [];
    currentChunk = 0;
    if (bar) bar.classList.remove("speaking");
    updateLabel("");
    updatePlayIcon();
  }

  /* ── Public Playback Controls ─────────────────────────────── */
  function readPage() {
    var main = document.getElementById("main");
    if (!main) return;
    startNarration(main, 0);
  }

  function speakElement(el) {
    if (!el) return;
    startNarration(el, 0);
  }

  function pause() {
    if (state !== "playing") return;
    synth.pause();
    state = "paused";
    pauseStartTime = Date.now();
    updatePlayIcon();
  }

  function resume() {
    if (state !== "paused") return;
    synth.resume();
    state = "playing";
    pausedDuration += Date.now() - pauseStartTime;
    updatePlayIcon();
  }

  function togglePlayPause() {
    if (state === "stopped") { readPage(); return; }
    if (state === "paused") resume();
    else pause();
  }

  function stop() {
    stopNarration();
  }

  /* ── Click-to-Jump ────────────────────────────────────────── */
  function setupClickHandler() {
    removeClickHandler();
    var main = document.getElementById("main");
    if (!main || !isSupported()) return;

    clickHandler = function (e) {
      // Don't intercept clicks on buttons, links, inputs, selects
      var tag = e.target.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" ||
          tag === "TEXTAREA" || tag === "LABEL" || tag === "OPTION") return;
      // Don't intercept if clicking inside a button or interactive element
      if (e.target.closest("button, a, input, select, textarea, label, .sb-actions")) return;

      // Find the clicked text position
      var range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
        }
      }

      if (!range || range.startContainer.nodeType !== 3) return;

      // Build text map for the main area
      var tempMap = buildTextMap(main);
      var clickedNode = range.startContainer;
      var clickedOffset = range.startOffset;

      // Find this node in the map
      var entry = null;
      for (var i = 0; i < tempMap.length; i++) {
        if (tempMap[i].node === clickedNode) { entry = tempMap[i]; break; }
      }
      if (!entry) return;

      // Calculate position in full text
      var charPos = entry.start + clickedOffset;

      // Snap to start of word
      var tempFullText = buildFullText(tempMap);
      while (charPos > 0 && !/\s/.test(tempFullText[charPos - 1])) charPos--;

      // Start narration from this position
      startNarration(main, charPos);
    };

    main.addEventListener("click", clickHandler);
    main.style.cursor = "text";
  }

  function removeClickHandler() {
    var main = document.getElementById("main");
    if (main && clickHandler) {
      main.removeEventListener("click", clickHandler);
      main.style.cursor = "";
    }
    clickHandler = null;
  }

  /* ── Settings ─────────────────────────────────────────────── */
  function setVoice(name) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].name === name) {
        selectedVoice = voices[i];
        localStorage.setItem(STORAGE_VOICE, name);
        break;
      }
    }
  }

  function setRate(val) {
    rate = parseFloat(val) || 1.0;
    localStorage.setItem(STORAGE_RATE, rate);
  }

  /* ── Control Bar ──────────────────────────────────────────── */
  function init() {
    if (!isSupported()) return;

    var savedRate = parseFloat(localStorage.getItem(STORAGE_RATE));
    if (savedRate && !isNaN(savedRate)) rate = savedRate;

    loadVoices();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

    // Build bar
    bar = document.createElement("div");
    bar.className = "narr-bar";
    bar.id = "narr-bar";

    var rateOpts = "";
    for (var i = 0; i < RATES.length; i++) {
      rateOpts += '<option value="' + RATES[i] + '"' + (RATES[i] === rate ? " selected" : "") + '>' + RATES[i] + 'x</option>';
    }

    bar.innerHTML =
      '<div class="narr-bar-inner">' +
        '<button class="narr-btn narr-page" onclick="WCAI.speech.readPage()" title="Read entire page">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/></svg>' +
          ' Read Page' +
        '</button>' +
        '<select class="narr-select" id="narr-voice" onchange="WCAI.speech.setVoice(this.value)" title="Voice"></select>' +
        '<select class="narr-select narr-rate" id="narr-rate" onchange="WCAI.speech.setRate(this.value)" title="Speed">' +
          rateOpts +
        '</select>' +
        '<div class="narr-playback">' +
          '<div class="narr-divider"></div>' +
          '<button class="narr-btn narr-play" id="narr-playpause" onclick="WCAI.speech.togglePlayPause()" title="Play / Pause">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path id="narr-play-icon" d="M8 5v14l11-7z"/></svg>' +
          '</button>' +
          '<button class="narr-btn narr-stop" onclick="WCAI.speech.stop()" title="Stop">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>' +
          '</button>' +
          '<div class="narr-label" id="narr-label"></div>' +
        '</div>' +
        '<div class="narr-spacer"></div>' +
        '<span class="narr-hint">Click any text to narrate from there</span>' +
      '</div>';

    document.body.appendChild(bar);
    populateVoiceSelect();
    setupClickHandler();
  }

  /* ── Bar UI ───────────────────────────────────────────────── */
  function showBar(text) {
    if (!bar) return;
    bar.classList.add("speaking");
    updateLabel(text);
    updatePlayIcon();
  }

  function updateLabel(text) {
    var el = bar && bar.querySelector("#narr-label");
    if (!el) return;
    if (!text) { el.textContent = ""; return; }
    el.textContent = text.length > 70 ? text.substring(0, 70) + "..." : text;
  }

  function updatePlayIcon() {
    var icon = bar && bar.querySelector("#narr-play-icon");
    if (!icon) return;
    if (state === "playing") {
      icon.setAttribute("d", "M6 4h4v16H6zM14 4h4v16h-4z");
    } else {
      icon.setAttribute("d", "M8 5v14l11-7z");
    }
  }

  /* ── Section Buttons ──────────────────────────────────────── */
  function injectSectionButtons() {
    removeSectionButtons();
    if (!isSupported()) return;

    var main = document.getElementById("main");
    if (!main) return;

    var headings = main.querySelectorAll("h1, h2, h3, .bp-header, .cl-section-head");
    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      if (heading.querySelector(".narr-section-btn")) continue;

      var btn = document.createElement("button");
      btn.className = "narr-section-btn";
      btn.title = "Read this section";
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

      (function (h) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var target = null;
          if (h.classList.contains("bp-header")) {
            target = h.nextElementSibling;
          } else if (h.classList.contains("cl-section-head")) {
            target = h.parentElement;
          } else {
            target = h.parentElement;
          }
          speakElement(target || h);
        });
      })(heading);

      heading.appendChild(btn);
      sectionBtns.push(btn);
    }

    // Re-setup click handler for new content
    setupClickHandler();
  }

  function removeSectionButtons() {
    for (var i = 0; i < sectionBtns.length; i++) {
      if (sectionBtns[i].parentNode) sectionBtns[i].parentNode.removeChild(sectionBtns[i]);
    }
    sectionBtns = [];
  }

  /* ── Public API ───────────────────────────────────────────── */
  WCAI.speech = {
    init: init,
    isSupported: isSupported,
    speak: function (text, el) { if (el) startNarration(el, 0); },
    speakElement: speakElement,
    readPage: readPage,
    pause: pause,
    resume: resume,
    stop: stop,
    togglePlayPause: togglePlayPause,
    setVoice: setVoice,
    setRate: setRate,
    injectSectionButtons: injectSectionButtons,
    removeSectionButtons: removeSectionButtons,
    btn: function () { return ""; },
    extractText: function (el) { return ""; }
  };
})();
