// ============================================================
// voice.js — Voice System — Full Production Version
// Fixes: auto-play on first interaction, instant volume,
//        instant speed, instant voice/language switching
// ============================================================

const VoiceState = {
    enabled:         true,
    speaking:        false,
    paused:          false,
    utterance:       null,
    currentText:     "",
    volume:          0.95,
    rate:            0.9,
    pitch:           1.05,
    voiceIndex:      -1,
    voices:          [],
    welcomePlayed:   false,
    userInteracted:  false
};

// ── INIT ──────────────────────────────────────────────────────
function initVoice() {
    if (!window.speechSynthesis) {
        console.warn("Web Speech API not supported");
        hideVoiceBar();
        return false;
    }

    // Load voices
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        loadVoices();
    };

    // Listen for FIRST user interaction to play welcome
    const playOnFirstInteraction = () => {
        if (!VoiceState.userInteracted) {
            VoiceState.userInteracted = true;
            dismissInteractionPrompt();
            if (!VoiceState.welcomePlayed) {
                VoiceState.welcomePlayed = true;
                setTimeout(playWelcomeSpeech, 300);
            }
        }
    };

    // Listen on multiple events to catch first interaction
    ["click", "keydown", "touchstart"].forEach(evt => {
        document.addEventListener(evt, playOnFirstInteraction, { once: true });
    });

    // Show tap-to-enable prompt
    setTimeout(showInteractionPrompt, 500);

    console.log("Voice system initialized");
    return true;
}

// ── SHOW / DISMISS INTERACTION PROMPT ─────────────────────────
function showInteractionPrompt() {
    const existing = document.getElementById("voicePrompt");
    if (existing) return;

    const prompt     = document.createElement("div");
    prompt.id        = "voicePrompt";
    prompt.className = "voice-prompt";
    prompt.innerHTML =
        "<span class='vp-icon'>🔊</span>" +
        "<span class='vp-text'>Tap anywhere to enable voice</span>" +
        "<button class='vp-btn' onclick='dismissInteractionPrompt()'>Enable</button>";

    document.body.appendChild(prompt);

    // Animate in
    setTimeout(() => { prompt.style.opacity = "1"; prompt.style.transform = "translateY(0)"; }, 100);
}

function dismissInteractionPrompt() {
    const prompt = document.getElementById("voicePrompt");
    if (prompt) {
        prompt.style.opacity   = "0";
        prompt.style.transform = "translateY(20px)";
        setTimeout(() => { if (prompt.parentNode) prompt.parentNode.removeChild(prompt); }, 400);
    }
}

// ── WELCOME SPEECH ────────────────────────────────────────────
function playWelcomeSpeech() {
    const text =
        "Welcome to Math AI Assistant — your intelligent, voice-powered math tutor, " +
        "built for HighupWeb Academy in Cameroon. " +
        "I am designed for 2026 and beyond — combining artificial intelligence, " +
        "step-by-step teaching, real-time answer verification, " +
        "and voice interaction to make mathematics accessible to every student. " +
        "I can solve equations, draw graphs, explain concepts from the basics, " +
        "and I speak every answer so you can listen and learn at the same time. " +
        "Whether you need algebra, calculus, trigonometry, or statistics — " +
        "I am here. Go ahead. Ask me anything.";
    speakText(text);
}

// ── LOAD VOICES ───────────────────────────────────────────────
function loadVoices() {
    const raw = window.speechSynthesis.getVoices();
    if (!raw || raw.length === 0) return;
    VoiceState.voices = raw;

    const selector = document.getElementById("voiceSelector");
    if (!selector) return;

    const savedVal = selector.value;
    selector.innerHTML = "";

    // Auto option
    addOption(selector, "-1", "🤖 Auto (Best available)");

    // Group: Google English (best quality)
    const googleEn = raw.filter(v => v.name.includes("Google") && v.lang.startsWith("en"));
    if (googleEn.length > 0) {
        addOptGroup(selector, "⭐ Google English (Recommended)", googleEn, raw);
    }

    // Group: Other English
    const otherEn = raw.filter(v => !v.name.includes("Google") && v.lang.startsWith("en"));
    if (otherEn.length > 0) {
        addOptGroup(selector, "🇬🇧 English Voices", otherEn, raw);
    }

    // Group: French
    const french = raw.filter(v => v.lang.startsWith("fr"));
    if (french.length > 0) {
        addOptGroup(selector, "🇫🇷 French / Français", french, raw);
    }

    // Group: Spanish
    const spanish = raw.filter(v => v.lang.startsWith("es"));
    if (spanish.length > 0) {
        addOptGroup(selector, "🇪🇸 Spanish / Español", spanish, raw);
    }

    // Group: Arabic
    const arabic = raw.filter(v => v.lang.startsWith("ar"));
    if (arabic.length > 0) {
        addOptGroup(selector, "🇸🇦 Arabic / عربي", arabic, raw);
    }

    // Group: All others
    const others = raw.filter(v =>
        !v.lang.startsWith("en") &&
        !v.lang.startsWith("fr") &&
        !v.lang.startsWith("es") &&
        !v.lang.startsWith("ar")
    );
    if (others.length > 0) {
        addOptGroup(selector, "🌍 Other Languages", others, raw);
    }

    // Restore selection
    if (savedVal && savedVal !== "-1") {
        selector.value = savedVal;
    }

    console.log("Loaded " + raw.length + " voices");
}

function addOption(select, value, text) {
    const opt   = document.createElement("option");
    opt.value   = value;
    opt.text    = text;
    select.appendChild(opt);
}

function addOptGroup(select, label, voices, allVoices) {
    const group   = document.createElement("optgroup");
    group.label   = label;
    voices.forEach(voice => {
        const idx  = allVoices.indexOf(voice);
        const opt  = document.createElement("option");
        opt.value  = idx;
        opt.text   = voice.name;
        group.appendChild(opt);
    });
    select.appendChild(group);
}

// ── CLEAN TEXT FOR SPEECH ─────────────────────────────────────
function cleanTextForSpeech(text) {
    if (!text) return "";
    let t = text;

    // Remove display math $$...$$
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => " " + mathToWords(m) + " ");

    // Remove inline math $...$
    t = t.replace(/\$([^$\n]+?)\$/g, (_, m) => " " + mathToWords(m) + " ");

    // Remove markdown
    t = t.replace(/\*\*(.+?)\*\*/gs, "$1");
    t = t.replace(/\*(.+?)\*/gs,     "$1");
    t = t.replace(/#{1,6}\s+/g,      "");
    t = t.replace(/```[\s\S]*?```/g, "");
    t = t.replace(/`([^`]+)`/g,      "$1");
    t = t.replace(/---+/g,           ". ");
    t = t.replace(/>\s*/g,           "");
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // LaTeX commands
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\\boxed\{([^}]+)\}/g,             "The answer is $1");
    t = t.replace(/\\text\{([^}]+)\}/g,              "$1");
    t = t.replace(/\\left\(/g,  "open bracket");
    t = t.replace(/\\right\)/g, "close bracket");
    t = t.replace(/\\pm/g,      "plus or minus");
    t = t.replace(/\\times/g,   "times");
    t = t.replace(/\\div/g,     "divided by");
    t = t.replace(/\\leq/g,     "less than or equal to");
    t = t.replace(/\\geq/g,     "greater than or equal to");
    t = t.replace(/\\neq/g,     "not equal to");
    t = t.replace(/\\approx/g,  "approximately");
    t = t.replace(/\\infty/g,   "infinity");
    t = t.replace(/\\pi/g,      "pi");
    t = t.replace(/\\theta/g,   "theta");
    t = t.replace(/\\alpha/g,   "alpha");
    t = t.replace(/\\beta/g,    "beta");
    t = t.replace(/\\gamma/g,   "gamma");
    t = t.replace(/\\delta/g,   "delta");
    t = t.replace(/\\int/g,     "integral");
    t = t.replace(/\\sum/g,     "sum");
    t = t.replace(/\\lim/g,     "limit");
    t = t.replace(/\\sin/g,     "sine");
    t = t.replace(/\\cos/g,     "cosine");
    t = t.replace(/\\tan/g,     "tangent");
    t = t.replace(/\\log/g,     "log");
    t = t.replace(/\\ln/g,      "natural log");
    t = t.replace(/\^{([^}]+)}/g, " to the power of $1");
    t = t.replace(/\^(\d+)/g,    " to the power of $1");
    t = t.replace(/_{([^}]+)}/g,  " subscript $1");
    t = t.replace(/\\\\/g,        " ");
    t = t.replace(/\\/g,          "");

    // Unicode math symbols
    t = t.replace(/²/g,  " squared");
    t = t.replace(/³/g,  " cubed");
    t = t.replace(/√/g,  "square root of");
    t = t.replace(/π/g,  "pi");
    t = t.replace(/∞/g,  "infinity");
    t = t.replace(/∫/g,  "integral");
    t = t.replace(/∑/g,  "sum");
    t = t.replace(/±/g,  "plus or minus");
    t = t.replace(/≤/g,  "less than or equal to");
    t = t.replace(/≥/g,  "greater than or equal to");
    t = t.replace(/≠/g,  "not equal to");
    t = t.replace(/≈/g,  "approximately");
    t = t.replace(/×/g,  "times");
    t = t.replace(/÷/g,  "divided by");
    t = t.replace(/→/g,  "gives");
    t = t.replace(/∴/g,  "therefore");
    t = t.replace(/∵/g,  "because");
    t = t.replace(/∈/g,  "is in");
    t = t.replace(/∩/g,  "intersection");
    t = t.replace(/∪/g,  "union");

    // Clean up whitespace
    t = t.replace(/\s+/g, " ").trim();

    // Trim to sensible length
    if (t.length > 1400) {
        t = t.substring(0, 1400) + "... and so on.";
    }

    return t;
}

function mathToWords(math) {
    let t = math;
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\^{([^}]+)}/g,                   " to the power of $1");
    t = t.replace(/\^(\d+)/g,                       " to the power of $1");
    t = t.replace(/\\pm/g,  "plus or minus");
    t = t.replace(/\\pi/g,  "pi");
    t = t.replace(/\\theta/g, "theta");
    t = t.replace(/\\/g,    "");
    return t.trim();
}

// ── CORE SPEAK FUNCTION ───────────────────────────────────────
function speakText(text) {
    if (!VoiceState.enabled)     return;
    if (!window.speechSynthesis) return;

    // Cancel anything playing
    window.speechSynthesis.cancel();

    const clean = cleanTextForSpeech(text);
    if (!clean || clean.length < 2) return;

    VoiceState.currentText = clean;

    // Small delay after cancel to avoid browser bugs
    setTimeout(() => {
        _doSpeak(clean);
    }, 120);
}

function _doSpeak(clean) {
    const utt   = new SpeechSynthesisUtterance(clean);
    utt.volume  = VoiceState.volume;
    utt.rate    = VoiceState.rate;
    utt.pitch   = VoiceState.pitch;
    utt.lang    = "en-US";

    // Set selected voice
    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        const v  = VoiceState.voices[VoiceState.voiceIndex];
        utt.voice = v;
        utt.lang  = v.lang;
    } else {
        // Auto-pick best English voice
        const best =
            VoiceState.voices.find(v => v.name.includes("Google") && v.lang === "en-US") ||
            VoiceState.voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
            VoiceState.voices.find(v => v.lang === "en-US") ||
            VoiceState.voices.find(v => v.lang.startsWith("en"));
        if (best) { utt.voice = best; utt.lang = best.lang; }
    }

    utt.onstart = () => {
        VoiceState.speaking  = true;
        VoiceState.paused    = false;
        VoiceState.utterance = utt;
        _updateUI();
    };

    utt.onend = () => {
        VoiceState.speaking  = false;
        VoiceState.paused    = false;
        VoiceState.utterance = null;
        _updateUI();
    };

    utt.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.warn("Speech error:", e.error);
        VoiceState.speaking  = false;
        VoiceState.paused    = false;
        VoiceState.utterance = null;
        _updateUI();
    };

    utt.onpause  = () => { VoiceState.paused = true;  _updateUI(); };
    utt.onresume = () => { VoiceState.paused = false; _updateUI(); };

    VoiceState.utterance = utt;
    window.speechSynthesis.speak(utt);

    // Chrome bug fix — resume if synthesis stops mid-sentence
    const chromeFix = setInterval(() => {
        if (!VoiceState.speaking) { clearInterval(chromeFix); return; }
        if (window.speechSynthesis.paused) return;
        window.speechSynthesis.resume();
    }, 10000);
}

// ── PAUSE / RESUME ────────────────────────────────────────────
function pauseSpeaking() {
    if (!window.speechSynthesis) return;
    if (!VoiceState.speaking) return;

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
    VoiceState.speaking     = false;
    VoiceState.paused       = false;
    VoiceState.utterance    = null;
    VoiceState.currentText  = "";
    _updateUI();
}

// ── REPLAY ────────────────────────────────────────────────────
function replayLastMessage() {
    // Try to get text from last AI message in DOM
    const msgs = document.querySelectorAll(".markdown-message");
    if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        const text = last.innerText || last.textContent || "";
        if (text) { speakText(text); return; }
    }
    // Fallback to last stored text
    if (VoiceState.currentText) {
        speakText(VoiceState.currentText);
    }
}

// ── TOGGLE VOICE ──────────────────────────────────────────────
function toggleVoice() {
    VoiceState.enabled = !VoiceState.enabled;

    const btn = document.getElementById("voiceToggleBtn");
    if (btn) {
        if (VoiceState.enabled) {
            btn.textContent          = "🔊 Voice On";
            btn.style.borderColor    = "rgba(74,222,128,0.5)";
            btn.style.color          = "#4ade80";
            btn.style.background     = "rgba(74,222,128,0.1)";
        } else {
            btn.textContent          = "🔇 Voice Off";
            btn.style.borderColor    = "rgba(148,163,184,0.3)";
            btn.style.color          = "#94a3b8";
            btn.style.background     = "rgba(148,163,184,0.06)";
        }
    }

    if (!VoiceState.enabled) { stopSpeaking(); }
}

// ── SET VOLUME — INSTANT ──────────────────────────────────────
function setVolume(value) {
    VoiceState.volume = parseFloat(value);

    const label = document.getElementById("volumeLabel");
    if (label) label.textContent = Math.round(VoiceState.volume * 100) + "%";

    // Restart current speech with new volume for instant effect
    if (VoiceState.speaking && VoiceState.utterance) {
        const text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) { speakText(text); }
    }
}

// ── SET SPEED — INSTANT ───────────────────────────────────────
function setSpeed(value) {
    VoiceState.rate = parseFloat(value);

    const labels = { "0.6": "Slow", "0.85": "Normal", "1.2": "Fast", "1.6": "Very Fast" };
    const label  = document.getElementById("speedLabel");
    if (label) label.textContent = labels[value] || (value + "x");

    // Restart with new speed
    if (VoiceState.speaking && VoiceState.utterance) {
        const text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) { speakText(text); }
    }
}

// ── SET VOICE — INSTANT WITH LANGUAGE MATCH ───────────────────
function setVoice(index) {
    VoiceState.voiceIndex = parseInt(index);

    // Show selected voice name in indicator
    const indicator = document.getElementById("voiceIndicator");
    if (indicator && !VoiceState.speaking) {
        const v = VoiceState.voices[VoiceState.voiceIndex];
        if (v) {
            indicator.textContent = "🎙 " + v.name.split(" ").slice(0, 2).join(" ");
            setTimeout(() => {
                if (!VoiceState.speaking) indicator.innerHTML = "🔊 Ready";
            }, 2000);
        }
    }

    // Restart current speech with new voice
    if (VoiceState.speaking && VoiceState.utterance) {
        const text = VoiceState.utterance.text || VoiceState.currentText;
        if (text) { speakText(text); }
    } else {
        // Speak a preview in the selected voice
        const v = VoiceState.voices[VoiceState.voiceIndex];
        if (v) {
            speakText("Voice selected: " + v.name);
        }
    }
}

// ── UPDATE UI ─────────────────────────────────────────────────
function _updateUI() {
    const isSpeaking = VoiceState.speaking;
    const isPaused   = VoiceState.paused;

    const pauseBtn  = document.getElementById("voicePauseBtn");
    const stopBtn   = document.getElementById("voiceStopBtn");
    const replayBtn = document.getElementById("voicePlayBtn");
    const indicator = document.getElementById("voiceIndicator");

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
        replayBtn.disabled      = false; // Replay always available
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

function hideVoiceBar() {
    const bar = document.getElementById("voiceBar");
    if (bar) bar.style.display = "none";
}

function isVoiceSupported() {
    return "speechSynthesis" in window;
}
