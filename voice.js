// ============================================================
// voice.js — Voice System — Path 7
// Text-to-speech + Voice Input with preview before send
// ============================================================

// ── VOICE OUTPUT STATE ────────────────────────────────────────
var VoiceState = {
    enabled:        true,
    speaking:       false,
    paused:         false,
    utterance:      null,
    currentText:    "",
    volume:         0.95,
    rate:           0.9,
    pitch:          1.05,
    voiceIndex:     -1,
    voices:         [],
    welcomePlayed:  false,
    userInteracted: false
};

// ── VOICE INPUT STATE ─────────────────────────────────────────
var VoiceInput = {
    recognition:  null,
    recording:    false,
    transcript:   "",
    supported:    false
};

// ── INIT ──────────────────────────────────────────────────────
function initVoice() {
    if (!window.speechSynthesis) {
        console.warn("Speech synthesis not supported");
        hideVoiceBar();
        return false;
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Init voice input
    initVoiceInput();

    // First interaction listener
    var playOnce = function() {
        if (!VoiceState.userInteracted) {
            VoiceState.userInteracted = true;
            dismissInteractionPrompt();
            if (!VoiceState.welcomePlayed) {
                VoiceState.welcomePlayed = true;
                setTimeout(playWelcomeSpeech, 300);
            }
        }
    };

    document.addEventListener("click",      playOnce, { once: true });
    document.addEventListener("keydown",    playOnce, { once: true });
    document.addEventListener("touchstart", playOnce, { once: true });

    setTimeout(showInteractionPrompt, 600);
    console.log("Voice system ready");
    return true;
}

// ── INIT VOICE INPUT ──────────────────────────────────────────
function initVoiceInput() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        VoiceInput.supported = false;
        console.warn("Speech recognition not supported");
        var micBtn = document.getElementById("micBtn");
        if (micBtn) {
            micBtn.title   = "Voice input not supported in this browser";
            micBtn.style.opacity = "0.4";
        }
        return;
    }

    VoiceInput.supported    = true;
    VoiceInput.recognition  = new SpeechRecognition();

    var rec = VoiceInput.recognition;
    rec.continuous          = false;
    rec.interimResults      = true;
    rec.lang                = "en-US";
    rec.maxAlternatives     = 1;

    rec.onstart = function() {
        VoiceInput.recording  = true;
        VoiceInput.transcript = "";
        updateMicUI(true);
        showRecordingPanel("", true);
        console.log("Recording started");
    };

    rec.onresult = function(event) {
        var interim  = "";
        var final    = "";

        for (var i = event.resultIndex; i < event.results.length; i++) {
            var text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += text;
            } else {
                interim += text;
            }
        }

        VoiceInput.transcript = final || interim;
        showRecordingPanel(VoiceInput.transcript, !final);
    };

    rec.onend = function() {
        VoiceInput.recording = false;
        updateMicUI(false);

        if (VoiceInput.transcript && VoiceInput.transcript.trim().length > 0) {
            // Show preview with Send / Cancel buttons — do NOT auto-send
            showRecordingPanel(VoiceInput.transcript, false);
            showVoicePreview(VoiceInput.transcript);
        } else {
            hideRecordingPanel();
        }
        console.log("Recording ended. Transcript:", VoiceInput.transcript);
    };

    rec.onerror = function(event) {
        VoiceInput.recording = false;
        updateMicUI(false);

        var msg = "";
        if      (event.error === "no-speech")     msg = "No speech detected. Please try again.";
        else if (event.error === "not-allowed")   msg = "Microphone access denied. Please allow microphone in browser settings.";
        else if (event.error === "network")       msg = "Network error during voice recognition.";
        else                                       msg = "Voice error: " + event.error;

        showRecordingError(msg);
        setTimeout(hideRecordingPanel, 3000);
        console.error("Speech recognition error:", event.error);
    };
}

// ── START / STOP RECORDING ────────────────────────────────────
function toggleVoiceInput() {
    if (!VoiceInput.supported) {
        addMathMarkdownMessage("🎤 Voice input is not supported in this browser. Please use **Chrome** or **Edge** for best results.");
        return;
    }

    if (!VoiceState.userInteracted) {
        VoiceState.userInteracted = true;
        dismissInteractionPrompt();
    }

    if (VoiceInput.recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!VoiceInput.recognition) return;

    // Set language to match selected voice language
    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        VoiceInput.recognition.lang = VoiceState.voices[VoiceState.voiceIndex].lang;
    } else {
        VoiceInput.recognition.lang = "en-US";
    }

    // Stop any playing speech while recording
    if (VoiceState.speaking) stopSpeaking();

    try {
        VoiceInput.recognition.start();
    } catch (e) {
        console.warn("Recognition start error:", e);
    }
}

function stopRecording() {
    if (VoiceInput.recognition && VoiceInput.recording) {
        try {
            VoiceInput.recognition.stop();
        } catch (e) {
            console.warn("Recognition stop error:", e);
        }
    }
}

function cancelRecording() {
    if (VoiceInput.recognition && VoiceInput.recording) {
        try {
            VoiceInput.recognition.abort();
        } catch (e) { }
    }
    VoiceInput.recording  = false;
    VoiceInput.transcript = "";
    updateMicUI(false);
    hideRecordingPanel();
}

// ── VOICE PREVIEW — SEND OR CANCEL ───────────────────────────
function showVoicePreview(transcript) {
    // Put transcript into input box so user can edit or confirm
    var input = document.getElementById("messageInput");
    if (input) {
        input.value = transcript;
        input.focus();
    }

    // Show the preview panel with Send and Cancel
    var panel = document.getElementById("voicePreviewPanel");
    if (!panel) return;

    panel.style.display = "flex";
    panel.innerHTML =
        "<span class='vp-transcript-icon'>🎤</span>" +
        "<span class='vp-transcript-text' id='voiceTranscriptDisplay'>" +
            escapeHtmlVoice(transcript) +
        "</span>" +
        "<div class='vp-action-btns'>" +
            "<button class='vp-send-btn' onclick='sendVoiceMessage()'>Send ➤</button>" +
            "<button class='vp-cancel-btn' onclick='cancelVoicePreview()'>✕ Cancel</button>" +
        "</div>";
}

function sendVoiceMessage() {
    hideRecordingPanel();
    // sendMessage() is defined in app.js and reads from messageInput
    sendMessage();
}

function cancelVoicePreview() {
    var input = document.getElementById("messageInput");
    if (input) input.value = "";
    hideRecordingPanel();
    VoiceInput.transcript = "";
}

// ── RECORDING PANEL UI ────────────────────────────────────────
function showRecordingPanel(transcript, isInterim) {
    var panel = document.getElementById("voicePreviewPanel");
    if (!panel) return;

    panel.style.display = "flex";

    if (isInterim || !transcript) {
        panel.innerHTML =
            "<span class='vp-recording-dot'></span>" +
            "<span class='vp-recording-label'>" +
                (transcript ? escapeHtmlVoice(transcript) : "Listening...") +
            "</span>" +
            "<button class='vp-stop-rec-btn' onclick='stopRecording()'>■ Stop</button>" +
            "<button class='vp-cancel-btn'   onclick='cancelRecording()'>✕</button>";
    }
}

function hideRecordingPanel() {
    var panel = document.getElementById("voicePreviewPanel");
    if (panel) panel.style.display = "none";
    var input = document.getElementById("messageInput");
    if (input && !input.value) input.value = "";
}

function showRecordingError(msg) {
    var panel = document.getElementById("voicePreviewPanel");
    if (!panel) return;
    panel.style.display = "flex";
    panel.innerHTML =
        "<span style='color:#f87171;font-size:13px'>⚠ " + msg + "</span>" +
        "<button class='vp-cancel-btn' onclick='hideRecordingPanel()'>✕</button>";
}

function updateMicUI(isRecording) {
    var micBtn = document.getElementById("micBtn");
    if (!micBtn) return;

    if (isRecording) {
        micBtn.classList.add("active");
        micBtn.title     = "Click to stop recording";
        micBtn.innerHTML = "⏹";
    } else {
        micBtn.classList.remove("active");
        micBtn.title     = "Click to speak your question";
        micBtn.innerHTML = "🎤";
    }
}

// ── WELCOME SPEECH ────────────────────────────────────────────
function playWelcomeSpeech() {
    var text =
        "Welcome to Math AI Assistant. " +
        "Your intelligent, voice-powered math tutor for HighupWeb Academy in Cameroon. " +
        "I combine artificial intelligence with step-by-step teaching, " +
        "real-time answer verification, and full voice interaction. " +
        "I can solve equations, draw graphs, explain concepts from the basics, " +
        "and speak every answer clearly. " +
        "You can also speak your questions using the microphone button. " +
        "Go ahead. Ask me anything.";
    speakText(text);
}

// ── INTERACTION PROMPT ────────────────────────────────────────
function showInteractionPrompt() {
    if (document.getElementById("voicePrompt")) return;
    var prompt      = document.createElement("div");
    prompt.id       = "voicePrompt";
    prompt.className = "voice-prompt";
    prompt.innerHTML =
        "<span class='vp-icon'>🔊</span>" +
        "<span class='vp-text'>Tap anywhere to enable voice</span>" +
        "<button class='vp-btn' onclick='dismissInteractionPrompt()'>Enable</button>";
    document.body.appendChild(prompt);
    setTimeout(function() {
        prompt.style.opacity   = "1";
        prompt.style.transform = "translateX(-50%) translateY(0)";
    }, 100);
}

function dismissInteractionPrompt() {
    var prompt = document.getElementById("voicePrompt");
    if (prompt) {
        prompt.style.opacity   = "0";
        prompt.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(function() {
            if (prompt.parentNode) prompt.parentNode.removeChild(prompt);
        }, 400);
    }
}

// ── LOAD VOICES ───────────────────────────────────────────────
function loadVoices() {
    var raw = window.speechSynthesis.getVoices();
    if (!raw || raw.length === 0) return;
    VoiceState.voices = raw;

    var selector = document.getElementById("voiceSelector");
    if (!selector) return;

    var savedVal = selector.value;
    selector.innerHTML = "";

    addVoiceOption(selector, "-1", "🤖 Auto (Best available)");

    var googleEn = raw.filter(function(v) { return v.name.includes("Google") && v.lang.startsWith("en"); });
    var otherEn  = raw.filter(function(v) { return !v.name.includes("Google") && v.lang.startsWith("en"); });
    var french   = raw.filter(function(v) { return v.lang.startsWith("fr"); });
    var spanish  = raw.filter(function(v) { return v.lang.startsWith("es"); });
    var arabic   = raw.filter(function(v) { return v.lang.startsWith("ar"); });
    var others   = raw.filter(function(v) {
        return !v.lang.startsWith("en") && !v.lang.startsWith("fr") &&
               !v.lang.startsWith("es") && !v.lang.startsWith("ar");
    });

    if (googleEn.length) addVoiceOptGroup(selector, "⭐ Google English (Best)", googleEn, raw);
    if (otherEn.length)  addVoiceOptGroup(selector, "🇬🇧 English",              otherEn,  raw);
    if (french.length)   addVoiceOptGroup(selector, "🇫🇷 Français",             french,   raw);
    if (spanish.length)  addVoiceOptGroup(selector, "🇪🇸 Español",              spanish,  raw);
    if (arabic.length)   addVoiceOptGroup(selector, "🇸🇦 العربية",              arabic,   raw);
    if (others.length)   addVoiceOptGroup(selector, "🌍 Other Languages",       others,   raw);

    if (savedVal) selector.value = savedVal;
    console.log("Voices loaded:", raw.length);
}

function addVoiceOption(select, value, text) {
    var opt  = document.createElement("option");
    opt.value = value; opt.text = text;
    select.appendChild(opt);
}

function addVoiceOptGroup(select, label, voices, allVoices) {
    var group   = document.createElement("optgroup");
    group.label = label;
    voices.forEach(function(voice) {
        var idx = allVoices.indexOf(voice);
        var opt = document.createElement("option");
        opt.value = idx;
        opt.text  = voice.name;
        group.appendChild(opt);
    });
    select.appendChild(group);
}

// ── CLEAN TEXT FOR SPEECH ─────────────────────────────────────
function cleanTextForSpeech(text) {
    if (!text) return "";
    var t = text;

    t = t.replace(/\$\$([\s\S]+?)\$\$/g, function(_, m) { return " " + mathToWords(m) + " "; });
    t = t.replace(/\$([^$\n]+?)\$/g,     function(_, m) { return " " + mathToWords(m) + " "; });

    t = t.replace(/\*\*(.+?)\*\*/gs, "$1");
    t = t.replace(/\*(.+?)\*/gs,     "$1");
    t = t.replace(/#{1,6}\s+/g,      "");
    t = t.replace(/```[\s\S]*?```/g, "");
    t = t.replace(/`([^`]+)`/g,      "$1");
    t = t.replace(/---+/g,           ". ");
    t = t.replace(/>\s*/g,           "");
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\\boxed\{([^}]+)\}/g,             "The answer is $1");
    t = t.replace(/\\text\{([^}]+)\}/g,              "$1");
    t = t.replace(/\\pm/g,    "plus or minus");
    t = t.replace(/\\times/g, "times");
    t = t.replace(/\\div/g,   "divided by");
    t = t.replace(/\\leq/g,   "less than or equal to");
    t = t.replace(/\\geq/g,   "greater than or equal to");
    t = t.replace(/\\neq/g,   "not equal to");
    t = t.replace(/\\approx/g,"approximately");
    t = t.replace(/\\infty/g, "infinity");
    t = t.replace(/\\pi/g,    "pi");
    t = t.replace(/\\theta/g, "theta");
    t = t.replace(/\\alpha/g, "alpha");
    t = t.replace(/\\beta/g,  "beta");
    t = t.replace(/\\gamma/g, "gamma");
    t = t.replace(/\\delta/g, "delta");
    t = t.replace(/\\int/g,   "integral");
    t = t.replace(/\\sum/g,   "sum");
    t = t.replace(/\\lim/g,   "limit");
    t = t.replace(/\\sin/g,   "sine");
    t = t.replace(/\\cos/g,   "cosine");
    t = t.replace(/\\tan/g,   "tangent");
    t = t.replace(/\\log/g,   "log");
    t = t.replace(/\\ln/g,    "natural log");
    t = t.replace(/\^{([^}]+)}/g, " to the power of $1");
    t = t.replace(/\^(\d+)/g,    " to the power of $1");
    t = t.replace(/_{([^}]+)}/g,  " subscript $1");
    t = t.replace(/\\\\/g,        " ");
    t = t.replace(/\\/g,          "");

    t = t.replace(/²/g, " squared");
    t = t.replace(/³/g, " cubed");
    t = t.replace(/√/g, "square root of");
    t = t.replace(/π/g, "pi");
    t = t.replace(/∞/g, "infinity");
    t = t.replace(/∫/g, "integral");
    t = t.replace(/∑/g, "sum");
    t = t.replace(/±/g, "plus or minus");
    t = t.replace(/≤/g, "less than or equal to");
    t = t.replace(/≥/g, "greater than or equal to");
    t = t.replace(/≠/g, "not equal to");
    t = t.replace(/≈/g, "approximately");
    t = t.replace(/×/g, "times");
    t = t.replace(/÷/g, "divided by");
    t = t.replace(/→/g, "gives");
    t = t.replace(/∴/g, "therefore");

    t = t.replace(/\s+/g, " ").trim();
    if (t.length > 1400) t = t.substring(0, 1400) + "... and so on.";
    return t;
}

function mathToWords(math) {
    var t = math;
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\^{([^}]+)}/g,                   " to the power of $1");
    t = t.replace(/\^(\d+)/g,                       " to the power of $1");
    t = t.replace(/\\pm/g,    "plus or minus");
    t = t.replace(/\\pi/g,    "pi");
    t = t.replace(/\\theta/g, "theta");
    t = t.replace(/\\/g,      "");
    return t.trim();
}

// ── SPEAK TEXT ────────────────────────────────────────────────
function speakText(text) {
    if (!VoiceState.enabled)     return;
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    var clean = cleanTextForSpeech(text);
    if (!clean || clean.length < 2) return;

    VoiceState.currentText = clean;
    setTimeout(function() { _doSpeak(clean); }, 120);
}

// ── SPEAK SPECIFIC RESPONSE (per message) ────────────────────
function speakResponse(text, btnEl) {
    // If already speaking this, stop
    if (VoiceState.speaking) {
        stopSpeaking();
        if (btnEl) {
            btnEl.textContent = "🔊";
            btnEl.title       = "Listen to this answer";
        }
        return;
    }

    if (btnEl) {
        btnEl.textContent = "⏹";
        btnEl.title       = "Stop reading";
    }

    speakText(text);

    // When speech ends, reset button
    var checkDone = setInterval(function() {
        if (!VoiceState.speaking) {
            if (btnEl) {
                btnEl.textContent = "🔊";
                btnEl.title       = "Listen to this answer";
            }
            clearInterval(checkDone);
        }
    }, 500);
}

function _doSpeak(clean) {
    var utt    = new SpeechSynthesisUtterance(clean);
    utt.volume = VoiceState.volume;
    utt.rate   = VoiceState.rate;
    utt.pitch  = VoiceState.pitch;
    utt.lang   = "en-US";

    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        var v    = VoiceState.voices[VoiceState.voiceIndex];
        utt.voice = v;
        utt.lang  = v.lang;
    } else {
        var best =
            VoiceState.voices.find(function(v) { return v.name.includes("Google") && v.lang === "en-US"; }) ||
            VoiceState.voices.find(function(v) { return v.name.includes("Google") && v.lang.startsWith("en"); }) ||
            VoiceState.voices.find(function(v) { return v.lang === "en-US"; }) ||
            VoiceState.voices.find(function(v) { return v.lang.startsWith("en"); });
        if (best) { utt.voice = best; utt.lang = best.lang; }
    }

    utt.onstart  = function() { VoiceState.speaking = true;  VoiceState.paused = false; VoiceState.utterance = utt; _updateUI(); };
    utt.onend    = function() { VoiceState.speaking = false; VoiceState.paused = false; VoiceState.utterance = null; _updateUI(); };
    utt.onerror  = function(e) {
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.warn("Speech error:", e.error);
        VoiceState.speaking = false; VoiceState.paused = false; VoiceState.utterance = null; _updateUI();
    };
    utt.onpause  = function() { VoiceState.paused = true;  _updateUI(); };
    utt.onresume = function() { VoiceState.paused = false; _updateUI(); };

    VoiceState.utterance = utt;
    window.speechSynthesis.speak(utt);

    // Chrome resume bug fix
    var fix = setInterval(function() {
        if (!VoiceState.speaking) { clearInterval(fix); return; }
        if (!window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 10000);
}


 // ── PAUSE / RESUME ────────────────────────────────────────────
function pauseSpeaking() {
    if (!window.speechSynthesis || !VoiceState.speaking) return;
    if (VoiceState.paused) {
        window.speechSynthesis.resume();
        VoiceState.paused = false;
    } else {
        window.speechSynthesis.pause();
        VoiceState.paused = true;
    }
    _updateUI();
}

// ── STOP ──────────────────────────────────────────────────────
function stopSpeaking() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    VoiceState.speaking    = false;
    VoiceState.paused      = false;
    VoiceState.utterance   = null;
    VoiceState.currentText = "";
    _updateUI();
}

// ── REPLAY LAST MESSAGE ───────────────────────────────────────
function replayLastMessage() {
    var msgs = document.querySelectorAll(".markdown-message");
    if (msgs.length > 0) {
        var last = msgs[msgs.length - 1];
        speakText(last.innerText || last.textContent || "");
    }
}

// ── TOGGLE VOICE ON/OFF ───────────────────────────────────────
function toggleVoice() {
    VoiceState.enabled = !VoiceState.enabled;
    if (!VoiceState.enabled) stopSpeaking();

    var btn = document.getElementById("voiceToggleBtn");
    if (btn) {
        if (VoiceState.enabled) {
            btn.textContent       = "🔊 Voice On";
            btn.style.borderColor = "rgba(74,222,128,0.5)";
            btn.style.color       = "#4ade80";
            btn.style.background  = "rgba(74,222,128,0.1)";
        } else {
            btn.textContent       = "🔇 Voice Off";
            btn.style.borderColor = "rgba(148,163,184,0.3)";
            btn.style.color       = "#94a3b8";
            btn.style.background  = "rgba(148,163,184,0.06)";
        }
    }
}

// ── SET VOLUME — INSTANT ──────────────────────────────────────
function setVolume(value) {
    VoiceState.volume = parseFloat(value);
    var label = document.getElementById("volumeLabel");
    if (label) label.textContent = Math.round(VoiceState.volume * 100) + "%";
    if (VoiceState.speaking && VoiceState.utterance) {
        var t = VoiceState.utterance.text || VoiceState.currentText;
        if (t) speakText(t);
    }
}

// ── SET SPEED — INSTANT ───────────────────────────────────────
function setSpeed(value) {
    VoiceState.rate = parseFloat(value);
    var labels      = { "0.6": "Slow", "0.85": "Normal", "1.2": "Fast", "1.6": "Very Fast" };
    var label       = document.getElementById("speedLabel");
    if (label) label.textContent = labels[value] || (value + "x");
    if (VoiceState.speaking && VoiceState.utterance) {
        var t = VoiceState.utterance.text || VoiceState.currentText;
        if (t) speakText(t);
    }
}

// ── SET VOICE — INSTANT ───────────────────────────────────────
function setVoice(index) {
    VoiceState.voiceIndex = parseInt(index);

    // Also update speech recognition language to match
    if (VoiceInput.recognition) {
        var v = VoiceState.voices[VoiceState.voiceIndex];
        if (v) VoiceInput.recognition.lang = v.lang;
        else   VoiceInput.recognition.lang = "en-US";
    }

    if (VoiceState.speaking && VoiceState.utterance) {
        var t = VoiceState.utterance.text || VoiceState.currentText;
        if (t) speakText(t);
    } else {
        var vv = VoiceState.voices[VoiceState.voiceIndex];
        if (vv) speakText("Voice selected. " + vv.name + ".");
    }
}

// ── UPDATE UI ─────────────────────────────────────────────────
function _updateUI() {
    var isSpeaking = VoiceState.speaking;
    var isPaused   = VoiceState.paused;

    var pauseBtn  = document.getElementById("voicePauseBtn");
    var stopBtn   = document.getElementById("voiceStopBtn");
    var indicator = document.getElementById("voiceIndicator");

    if (pauseBtn) {
        pauseBtn.textContent   = isPaused ? "▶ Resume" : "⏸ Pause";
        pauseBtn.disabled      = !isSpeaking;
        pauseBtn.style.opacity = isSpeaking ? "1" : "0.35";
    }
    if (stopBtn) {
        stopBtn.disabled      = !isSpeaking;
        stopBtn.style.opacity = isSpeaking ? "1" : "0.35";
    }

    if (indicator) {
        if (isSpeaking && !isPaused) {
            indicator.innerHTML =
                "<span class='vw'></span>" +
                "<span class='vw'></span>" +
                "<span class='vw'></span>" +
                " Speaking...";
            indicator.className = "voice-indicator active";
        } else if (isPaused) {
            indicator.innerHTML = "⏸ Paused";
            indicator.className = "voice-indicator paused";
        } else {
            indicator.innerHTML = "🔊 Ready";
            indicator.className = "voice-indicator";
        }
    }
}

// ── HELPERS ───────────────────────────────────────────────────
function hideVoiceBar() {
    var bar = document.getElementById("voiceBar");
    if (bar) bar.style.display = "none";
}

function isVoiceSupported() {
    return "speechSynthesis" in window;
}

function escapeHtmlVoice(text) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(text || ""));
    return d.innerHTML;
}
