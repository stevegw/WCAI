/**
 * WCAI -- Web Speech API Module
 * ==============================
 * Text-to-speech with floating control bar, sentence splitting
 * (Chrome 15s bug workaround), and source element highlighting.
 * Attached to window.WCAI.speech.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  var synth = window.speechSynthesis || null;
  var utterances = [];
  var currentIdx = 0;
  var isPaused = false;
  var isSpeaking = false;
  var sourceEl = null;
  var bar = null;

  function isSupported() {
    return !!synth;
  }

  function init() {
    if (!isSupported()) return;
    // Create floating control bar
    bar = document.createElement("div");
    bar.className = "speech-bar";
    bar.innerHTML =
      '<div class="speech-bar-inner">' +
        '<button class="speech-bar-btn" id="speech-playpause" onclick="WCAI.speech.togglePlayPause()" title="Play/Pause">||</button>' +
        '<span class="speech-bar-label" id="speech-label">Speaking...</span>' +
        '<button class="speech-bar-btn stop" onclick="WCAI.speech.stop()" title="Stop">X</button>' +
      '</div>';
    document.body.appendChild(bar);
  }

  function extractText(el) {
    if (!el) return "";
    var clone = el.cloneNode(true);
    // Remove speech buttons from clone
    var btns = clone.querySelectorAll(".speech-btn");
    for (var i = 0; i < btns.length; i++) btns[i].remove();
    return (clone.textContent || clone.innerText || "").trim();
  }

  function splitSentences(text) {
    // Split on sentence-ending punctuation followed by space or end
    var parts = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g);
    if (!parts) return [text];
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim();
      if (s) result.push(s);
    }
    return result.length > 0 ? result : [text];
  }

  function speak(text, el) {
    if (!isSupported()) return;
    stop();

    sourceEl = el || null;
    if (sourceEl) sourceEl.classList.add("speech-active");

    var sentences = splitSentences(text);
    utterances = [];
    currentIdx = 0;
    isPaused = false;
    isSpeaking = true;

    for (var i = 0; i < sentences.length; i++) {
      var u = new SpeechSynthesisUtterance(sentences[i]);
      u.rate = 1.0;
      u.pitch = 1.0;
      (function (idx) {
        u.onend = function () {
          if (idx < utterances.length - 1) {
            currentIdx = idx + 1;
            synth.speak(utterances[currentIdx]);
          } else {
            onDone();
          }
        };
        u.onerror = function () {
          onDone();
        };
      })(i);
      utterances.push(u);
    }

    showBar(text);
    synth.speak(utterances[0]);
  }

  function speakElement(el) {
    var text = extractText(el);
    if (text) speak(text, el);
  }

  function pause() {
    if (!isSpeaking || isPaused) return;
    synth.pause();
    isPaused = true;
    updateBarBtn();
  }

  function resume() {
    if (!isSpeaking || !isPaused) return;
    synth.resume();
    isPaused = false;
    updateBarBtn();
  }

  function togglePlayPause() {
    if (isPaused) resume();
    else pause();
  }

  function stop() {
    synth && synth.cancel();
    onDone();
  }

  function onDone() {
    isSpeaking = false;
    isPaused = false;
    utterances = [];
    currentIdx = 0;
    if (sourceEl) {
      sourceEl.classList.remove("speech-active");
      sourceEl = null;
    }
    hideBar();
  }

  function showBar(text) {
    if (!bar) return;
    var label = bar.querySelector("#speech-label");
    if (label) label.textContent = text.substring(0, 60) + (text.length > 60 ? "..." : "");
    bar.classList.add("active");
    updateBarBtn();
  }

  function hideBar() {
    if (bar) bar.classList.remove("active");
  }

  function updateBarBtn() {
    var btn = bar && bar.querySelector("#speech-playpause");
    if (btn) btn.textContent = isPaused ? ">" : "||";
  }

  // Helper to generate a speech button HTML string
  function btn(onclickFn) {
    if (!isSupported()) return "";
    return '<button class="speech-btn" onclick="' + onclickFn + '" title="Read aloud">&#9654;</button>';
  }

  WCAI.speech = {
    init: init,
    isSupported: isSupported,
    speak: speak,
    speakElement: speakElement,
    extractText: extractText,
    pause: pause,
    resume: resume,
    stop: stop,
    togglePlayPause: togglePlayPause,
    btn: btn,
  };
})();
