// ============================================================
// voice.js — Voice System — Path 7 Full
// Path 6: Voice output (speak answers)
// Path 7: Voice input (speech recognition — mic button)
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
var RecognitionState = {
    active:      false,
    recognition: null,
    supported:   false,
    finalText:   "",
    interimText: ""
};

// ══════════════════════════════════════════════════════════════
// VOICE OUTPUT — SPEECH SYNTHESIS
// ══════════════════════════════════════════════════════════════

function initVoice() {
    if (!window.speechSynthesis) {
        console.warn("Speech synthesis not supported");
        return false;
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = function() {
        loadVoices();
    };

    // Init speech recognition
    initSpeechRecognition();

    // First interaction listener
    var playOnFirstInteraction = function() {
        if (!VoiceState.userInteracted) {
            VoiceState.userInteracted = true;
            dismissInteractionPrompt();
            if (!VoiceState.welcomePlayed) {
                VoiceState.welcomePlayed = true;
                setTimeout(playWelcomeSpeech, 300);
            }
        }
    };

    ["click", "keydown", "touchstart"].forEach(function(evt) {
        document.addEventListener(evt, playOnFirstInteraction, { once: true });
    });

    setTimeout(showInteractionPrompt, 600);
    console.log("Voice system initialized");
    return true;
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

    if (googleEn.length > 0) addVoiceGroup(selector, "⭐ Google English (Best)", googleEn, raw);
    if (otherEn.length  > 0) addVoiceGroup(selector, "🇬🇧 English Voices",       otherEn,  raw);
    if (french.length   > 0) addVoiceGroup(selector, "🇫🇷 French / Français",    french,   raw);
    if (spanish.length  > 0) addVoiceGroup(selector, "🇪🇸 Spanish / Español",    spanish,  raw);
    if (arabic.length   > 0) addVoiceGroup(selector, "🇸🇦 Arabic / عربي",        arabic,   raw);
    if (others.length   > 0) addVoiceGroup(selector, "🌍 Other Languages",       others,   raw);

    if (savedVal && savedVal !== "-1") selector.value = savedVal;
    console.log("Loaded " + raw.length + " voices");
}

function addVoiceOption(select, value, text) {
    var opt  = document.createElement("option");
    opt.value = value;
    opt.text  = text;
    select.appendChild(opt);
}

function addVoiceGroup(select, label, voices, allVoices) {
    var group = document.createElement("optgroup");
    group.label = label;
    voices.forEach(function(voice) {
        var idx = allVoices.indexOf(voice);
        var opt  = document.createElement("option");
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

    t = t.replace(/x\^2/gi, "x squared");
    t = t.replace(/x\^3/gi, "x cubed");
    t = t.replace(/²/g,     " squared");
    t = t.replace(/³/g,     " cubed");
    t = t.replace(/√/g,     "square root of");
    t = t.replace(/π/g,     "pi");
    t = t.replace(/∞/g,     "infinity");
    t = t.replace(/∫/g,     "integral");
    t = t.replace(/∑/g,     "sum");
    t = t.replace(/±/g,     "plus or minus");
    t = t.replace(/≤/g,     "less than or equal to");
    t = t.replace(/≥/g,     "greater than or equal to");
    t = t.replace(/≠/g,     "not equal to");
    t = t.replace(/≈/g,     "approximately");
    t = t.replace(/×/g,     "times");
    t = t.replace(/÷/g,     "divided by");
    t = t.replace(/→/g,     "gives");
    t = t.replace(/∴/g,     "therefore");
    t = t.replace(/∈/g,     "is in");

    t = t.replace(/\s+/g, " ").trim();

    if (t.length > 1400) {
        t = t.substring(0, 1400) + "... and so on.";
    }

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

    setTimeout(function() {
        _doSpeak(clean);
    }, 120);
}

function _doSpeak(clean) {
    var utt  = new SpeechSynthesisUtterance(clean);
    utt.volume = VoiceState.volume;
    utt.rate   = VoiceState.rate;
    utt.pitch  = VoiceState.pitch;
    utt.lang   = "en-US";

    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        var v  = VoiceState.voices[VoiceState.voiceIndex];
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

    utt.onstart  = function() { VoiceState.speaking = true;  VoiceState.paused = false; VoiceState.utterance = utt; _updateOutputUI(); };
    utt.onend    = function() { VoiceState.speaking = false; VoiceState.paused = false; VoiceState.utterance = null; _updateOutputUI(); };
    utt.onerror  = function(e) { if (e.error === "interrupted" || e.error === "canceled") return; console.warn("Speech error:", e.error); VoiceState.speaking = false; VoiceState.paused = false; _updateOutputUI(); };
    utt.onpause  = function() { VoiceState.paused = true;  _updateOutputUI(); };
    utt.onresume = function() { VoiceState.paused = false; _updateOutputUI(); };

    VoiceState.utterance = utt;
    window.speechSynthesis.speak(utt);

    // Chrome bug fix
    var fix = setInterval(function() {
        if (!VoiceState.speaking) { clearInterval(fix); return; }
        if (window.speechSynthesis.paused) return;
        window.speechSynthesis.resume();
    }, 10000);
}

function pauseSpeaking() {
    if (!window.speechSynthesis || !VoiceState.speaking) return;
    if (VoiceState.paused) {
        window.speechSynthesis.resume();
        VoiceState.paused = false;
    } else {
        window.speechSynthesis.pause();
        VoiceState.paused = true;
    }
    _updateOutputUI();
}

function stopSpeaking() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    VoiceState.speaking    = false;
    VoiceState.paused      = false;
    VoiceState.utterance   = null;
    VoiceState.currentText = "";
    _updateOutputUI();
}

function replayLastMessage() {
    var msgs = document.querySelectorAll(".markdown-message");
    if (msgs.length > 0) {
        var last = msgs[msgs.length - 1];
        var text = last.innerText || last.textContent || "";
        if (text) { speakText(text); return; }
    }
    if (VoiceState.currentText) {
        speakText(VoiceState.currentText);
    }
}

function toggleVoice() {
    VoiceState.enabled = !VoiceState.enabled;
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
    if (!VoiceState.enabled) stopSpeaking();
}

function setVolume(value) {
    VoiceState.volume = parseFloat(value);
    var label = document.getElementById("volumeLabel");
    if (label) label.textContent = Math.round(VoiceState.volume * 100) + "%";
    if (VoiceState.speaking && VoiceState.utterance) {
        var text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) speakText(text);
    }
}

function setSpeed(value) {
    VoiceState.rate = parseFloat(value);
    var labels = { "0.6": "Slow", "0.85": "Normal", "1.2": "Fast", "1.6": "Very Fast" };
    var label  = document.getElementById("speedLabel");
    if (label) label.textContent = labels[value] || (value + "x");
    if (VoiceState.speaking && VoiceState.utterance) {
        var text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) speakText(text);
    }
}

function setVoice(index) {
    VoiceState.voiceIndex = parseInt(index);
    var indicator = document.getElementById("voiceIndicator");
    if (indicator && !VoiceState.speaking) {
        var v = VoiceState.voices[VoiceState.voiceIndex];
        if (v) {
            indicator.textContent = "🎙 " + v.name.split(" ").slice(0, 2).join(" ");
            setTimeout(function() {
                if (!VoiceState.speaking) indicator.innerHTML = "🔊 Ready";
            }, 2000);
        }
    }
    if (VoiceState.speaking && VoiceState.utterance) {
        var text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) speakText(text);
    } else {
        var v2 = VoiceState.voices[VoiceState.voiceIndex];
        if (v2) speakText("Voice selected: " + v2.name);
    }
}

// ── UPDATE OUTPUT UI ──────────────────────────────────────────
function _updateOutputUI() {
    var isSpeaking = VoiceState.speaking;
    var isPaused   = VoiceState.paused;

    var pauseBtn  = document.getElementById("voicePauseBtn");
    var stopBtn   = document.getElementById("voiceStopBtn");
    var replayBtn = document.getElementById("voicePlayBtn");
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
    if (replayBtn) {
        replayBtn.disabled      = false;
        replayBtn.style.opacity = "1";
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

// ── WELCOME SPEECH ────────────────────────────────────────────
function playWelcomeSpeech() {
    var text =
        "Welcome to Math AI Assistant — your intelligent, voice-powered math tutor, " +
        "built for HighupWeb Academy in Cameroon. " +
        "I am powered by artificial intelligence and designed for 2026 and beyond. " +
        "I can solve equations, draw graphs, explain concepts from the very basics, " +
        "verify every answer automatically, and I speak every explanation aloud. " +
        "You can also speak to me directly using the microphone button. " +
        "Whether you need algebra, calculus, trigonometry, or statistics — " +
        "I am here. Go ahead. Ask me anything.";
    speakText(text);
}

// ── INTERACTION PROMPT ────────────────────────────────────────
function showInteractionPrompt() {
    var existing = document.getElementById("voicePrompt");
    if (existing) return;

    var prompt     = document.createElement("div");
    prompt.id      = "voicePrompt";
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

function hideVoiceBar() {
    var bar = document.getElementById("voiceBar");
    if (bar) bar.style.display = "none";
}

function isVoiceSupported() {
    return "speechSynthesis" in window;
}

// ══════════════════════════════════════════════════════════════
// VOICE INPUT — SPEECH RECOGNITION — PATH 7
// ══════════════════════════════════════════════════════════════

function initSpeechRecognition() {
    var SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition ||
        window.msSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn("Speech recognition not supported in this browser");
        RecognitionState.supported = false;
        // Hide mic button if not supported
        var mic = document.getElementById("micBtn");
        if (mic) {
            mic.title   = "Voice input not supported in this browser";
            mic.style.opacity = "0.4";
            mic.style.cursor  = "not-allowed";
        }
        return false;
    }

    RecognitionState.supported = true;
    var recognition = new SpeechRecognition();

    recognition.continuous      = false; // Stop after one sentence
    recognition.interimResults  = true;  // Show text as you speak
    recognition.maxAlternatives = 1;
    recognition.lang            = "en-US";

    // ── RESULT: text received ────────────────────────────────
    recognition.onresult = function(event) {
        var interim = "";
        var final   = "";

        for (var i = event.resultIndex; i < event.results.length; i++) {
            var transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcript;
            } else {
                interim += transcript;
            }
        }

        RecognitionState.finalText   = final;
        RecognitionState.interimText = interim;

        var input = document.getElementById("messageInput");
        if (input) {
            // Show interim text in grey, final in white
            if (final) {
                input.value = final;
                input.style.color = "";
            } else {
                input.value = interim;
                input.style.color = "rgba(255,255,255,0.5)";
            }
        }

        updateMicStatus("🎤 " + (interim || final || "Listening..."));
    };

    // ── END: recognition finished ────────────────────────────
    recognition.onend = function() {
        RecognitionState.active = false;
        setMicInactive();

        var input = document.getElementById("messageInput");
        if (input) {
            input.style.color = "";
        }

        var finalText = RecognitionState.finalText.trim();

        if (finalText) {
            if (input) input.value = finalText;
            // Auto-send after short delay
            setTimeout(function() {
                if (input && input.value.trim() === finalText) {
                    sendMessage();
                }
            }, 600);
        } else {
            // Nothing was said
            updateMicStatus(null);
        }
    };



    
// ── START ─────────────────────────────────────────────────
    recognition.onstart = function() {
        RecognitionState.active = true;
        RecognitionState.finalText   = "";
        RecognitionState.interimText = "";

        // Stop any current speech output
        stopSpeaking();

        // Clear input and show listening state
        var input = document.getElementById("messageInput");
        if (input) {
            input.value       = "";
            input.placeholder = "🎤 Listening... speak now";
        }

        setMicActive();
        updateMicStatus("🎤 Listening...");
    };

    // ── ERROR ─────────────────────────────────────────────────
    recognition.onerror = function(event) {
        console.warn("Recognition error:", event.error);
        RecognitionState.active = false;
        setMicInactive();

        var input = document.getElementById("messageInput");
        if (input) {
            input.value       = "";
            input.placeholder = "Ask any math question...";
            input.style.color = "";
        }

        var messages = {
            "no-speech":          "No speech detected. Please try again.",
            "audio-capture":      "Microphone not found. Please check your microphone.",
            "not-allowed":        "Microphone access denied. Please allow microphone access in your browser settings.",
            "network":            "Network error. Please check your internet connection.",
            "aborted":            null, // User cancelled — no message
            "service-not-allowed": "Voice input not available. Try typing instead."
        };

        var msg = messages[event.error];
        if (msg) {
            addMathMarkdownMessage("🎤 " + msg);
            speakText(msg);
        }

        updateMicStatus(null);
    };

    // ── SOUND START (user started speaking) ──────────────────
    recognition.onsoundstart = function() {
        updateMicStatus("🎤 Hearing you...");
    };

    // ── SPEECH START ──────────────────────────────────────────
    recognition.onspeechstart = function() {
        updateMicStatus("🎤 Processing...");
    };

    RecognitionState.recognition = recognition;
    console.log("Speech recognition initialized");
    return true;
}

// ── TOGGLE MIC ────────────────────────────────────────────────
function toggleMic() {
    if (!RecognitionState.supported) {
        addMathMarkdownMessage(
            "🎤 **Voice input is not supported** in your browser.\n\n" +
            "**Supported browsers:**\n" +
            "- Google Chrome (recommended)\n" +
            "- Microsoft Edge\n" +
            "- Safari (iOS/macOS)\n\n" +
            "Please use Chrome for the best experience."
        );
        return;
    }

    if (RecognitionState.active) {
        // Stop listening
        stopListening();
    } else {
        // Start listening
        startListening();
    }
}

// ── START LISTENING ───────────────────────────────────────────
function startListening() {
    if (!RecognitionState.recognition) {
        initSpeechRecognition();
    }
    if (!RecognitionState.recognition) return;

    // Set language to match selected voice language
    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        RecognitionState.recognition.lang = VoiceState.voices[VoiceState.voiceIndex].lang;
    } else {
        RecognitionState.recognition.lang = "en-US";
    }

    try {
        RecognitionState.recognition.start();
    } catch (e) {
        console.warn("Recognition start error:", e);
        // Already running — stop and restart
        RecognitionState.recognition.stop();
        setTimeout(function() {
            try { RecognitionState.recognition.start(); } catch (e2) { console.warn(e2); }
        }, 300);
    }
}

// ── STOP LISTENING ────────────────────────────────────────────
function stopListening() {
    if (RecognitionState.recognition && RecognitionState.active) {
        RecognitionState.recognition.stop();
    }
    RecognitionState.active = false;
    setMicInactive();

    var input = document.getElementById("messageInput");
    if (input) {
        input.placeholder = "Ask any math question...";
        input.style.color = "";
    }

    updateMicStatus(null);
}

// ── SET MIC ACTIVE STATE ──────────────────────────────────────
function setMicActive() {
    var micBtn = document.getElementById("micBtn");
    if (!micBtn) return;

    micBtn.classList.add("mic-listening");
    micBtn.innerHTML   = "⏹";
    micBtn.title       = "Click to stop listening";

    // Show listening indicator
    var indicator = document.getElementById("micIndicator");
    if (indicator) {
        indicator.style.display = "flex";
    }
}

// ── SET MIC INACTIVE STATE ────────────────────────────────────
function setMicInactive() {
    var micBtn = document.getElementById("micBtn");
    if (!micBtn) return;

    micBtn.classList.remove("mic-listening");
    micBtn.innerHTML = "🎤";
    micBtn.title     = "Click to speak your question";

    // Hide listening indicator
    var indicator = document.getElementById("micIndicator");
    if (indicator) {
        indicator.style.display = "none";
    }

    // Restore placeholder
    var input = document.getElementById("messageInput");
    if (input) {
        input.placeholder = "Ask any math question...";
    }
}

// ── UPDATE MIC STATUS TEXT ────────────────────────────────────
function updateMicStatus(text) {
    var status = document.getElementById("micStatus");
    if (!status) return;

    if (text) {
        status.textContent  = text;
        status.style.display = "block";
    } else {
        status.style.display = "none";
        status.textContent  = "";
    }
}

// ── SET RECOGNITION LANGUAGE ──────────────────────────────────
// Called when voice is changed so recognition matches output language
function syncRecognitionLanguage() {
    if (!RecognitionState.recognition) return;
    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        RecognitionState.recognition.lang = VoiceState.voices[VoiceState.voiceIndex].lang;
    } else {
        RecognitionState.recognition.lang = "en-US";
    }
}
