// ============================================================
// voice.js — Voice System — Path 6 Full Fix
// All controls working instantly
// ============================================================

const VoiceState = {
    enabled:    true,
    speaking:   false,
    paused:     false,
    utterance:  null,
    volume:     0.9,
    rate:       0.95,
    pitch:      1.0,
    voiceIndex: -1,
    voices:     []
};

// ── INIT ──────────────────────────────────────────────────────
function initVoice() {
    if (!window.speechSynthesis) {
        console.warn("Speech not supported");
        return false;
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    console.log("Voice system ready");
    return true;
}

// ── LOAD VOICES ───────────────────────────────────────────────
function loadVoices() {
    VoiceState.voices = window.speechSynthesis.getVoices();
    const selector    = document.getElementById("voiceSelector");
    if (!selector || VoiceState.voices.length === 0) return;

    const current = selector.value;
    selector.innerHTML = "";

    // Auto option
    const auto   = document.createElement("option");
    auto.value   = "-1";
    auto.text    = "🤖 Auto";
    selector.appendChild(auto);

    // English voices first then others
    const english = VoiceState.voices.filter(v => v.lang.startsWith("en"));
    const others  = VoiceState.voices.filter(v => !v.lang.startsWith("en"));

    [...english, ...others].forEach((voice, idx) => {
        const realIdx = VoiceState.voices.indexOf(voice);
        const opt     = document.createElement("option");
        opt.value     = realIdx;
        opt.text      = voice.name + " (" + voice.lang + ")";
        if (voice.name.includes("Google") && voice.lang === "en-US") {
            opt.text = "⭐ " + opt.text;
        }
        selector.appendChild(opt);
    });

    // Restore selection
    if (current) selector.value = current;
    console.log("Loaded " + VoiceState.voices.length + " voices");
}

// ── CLEAN TEXT FOR SPEECH ─────────────────────────────────────
function cleanTextForSpeech(text) {
    if (!text) return "";
    let t = text;

    // Remove display math
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => " " + mathToWords(m) + " ");
    t = t.replace(/\$([^$\n]+?)\$/g,     (_, m) => " " + mathToWords(m) + " ");

    // Remove markdown
    t = t.replace(/\*\*(.+?)\*\*/g, "$1");
    t = t.replace(/\*(.+?)\*/g,     "$1");
    t = t.replace(/#{1,6}\s+/g,     "");
    t = t.replace(/```[\s\S]*?```/g, "");
    t = t.replace(/`(.+?)`/g,       "$1");
    t = t.replace(/---+/g,          ". ");
    t = t.replace(/>\s*/g,          "");

    // Math symbols to words
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\\boxed\{([^}]+)\}/g,             "The answer is $1");
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
    t = t.replace(/\\int/g,   "integral");
    t = t.replace(/\\sum/g,   "sum");
    t = t.replace(/\\\\/g,    " ");
    t = t.replace(/\\/g,      "");

    // Common math notation
    t = t.replace(/x\^2/gi,   "x squared");
    t = t.replace(/x\^3/gi,   "x cubed");
    t = t.replace(/\^(\d+)/g, " to the power of $1");
    t = t.replace(/²/g,       " squared");
    t = t.replace(/³/g,       " cubed");
    t = t.replace(/√/g,       "square root of");
    t = t.replace(/π/g,       "pi");
    t = t.replace(/∞/g,       "infinity");
    t = t.replace(/∫/g,       "integral");
    t = t.replace(/∑/g,       "sum");
    t = t.replace(/±/g,       "plus or minus");
    t = t.replace(/≤/g,       "less than or equal to");
    t = t.replace(/≥/g,       "greater than or equal to");
    t = t.replace(/≠/g,       "not equal to");
    t = t.replace(/≈/g,       "approximately");

    // Clean up
    t = t.replace(/\s+/g, " ").trim();

    // Limit length
    if (t.length > 1200) {
        t = t.substring(0, 1200) + "... and so on.";
    }

    return t;
}

function mathToWords(math) {
    let t = math;
    t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    t = t.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    t = t.replace(/\^(\d+)/g,                       " to the power $1");
    t = t.replace(/\\pm/g,  "plus or minus");
    t = t.replace(/\\pi/g,  "pi");
    t = t.replace(/\\/g,    "");
    return t;
}

// ── SPEAK TEXT ────────────────────────────────────────────────
function speakText(text) {
    if (!VoiceState.enabled)          return;
    if (!window.speechSynthesis)      return;

    // Cancel anything currently playing
    window.speechSynthesis.cancel();

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    const utt       = new SpeechSynthesisUtterance(clean);
    utt.volume      = VoiceState.volume;
    utt.rate        = VoiceState.rate;
    utt.pitch       = VoiceState.pitch;

    // Pick voice
    if (VoiceState.voiceIndex >= 0 && VoiceState.voices[VoiceState.voiceIndex]) {
        utt.voice = VoiceState.voices[VoiceState.voiceIndex];
    } else {
        const best =
            VoiceState.voices.find(v => v.name.includes("Google") && v.lang === "en-US") ||
            VoiceState.voices.find(v => v.lang.startsWith("en-US")) ||
            VoiceState.voices.find(v => v.lang.startsWith("en"));
        if (best) utt.voice = best;
    }

    utt.onstart  = () => { VoiceState.speaking = true;  VoiceState.paused = false; VoiceState.utterance = utt; updateUI(); };
    utt.onend    = () => { VoiceState.speaking = false; VoiceState.paused = false; VoiceState.utterance = null; updateUI(); };
    utt.onerror  = (e) => { if (e.error !== "interrupted") console.warn("Speech error:", e.error); VoiceState.speaking = false; VoiceState.paused = false; updateUI(); };
    utt.onpause  = () => { VoiceState.paused = true;  updateUI(); };
    utt.onresume = () => { VoiceState.paused = false; updateUI(); };

    VoiceState.utterance = utt;
    window.speechSynthesis.speak(utt);
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
    updateUI();
}

// ── STOP ──────────────────────────────────────────────────────
function stopSpeaking() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    VoiceState.speaking  = false;
    VoiceState.paused    = false;
    VoiceState.utterance = null;
    updateUI();
}

// ── REPLAY LAST MESSAGE ───────────────────────────────────────
function replayLastMessage() {
    const messages = document.querySelectorAll(".markdown-message");
    if (messages.length > 0) {
        const last = messages[messages.length - 1];
        speakText(last.innerText || last.textContent || "");
    } else {
        speakText("No message to replay yet.");
    }
}

// ── TOGGLE ON/OFF ─────────────────────────────────────────────
function toggleVoice() {
    VoiceState.enabled = !VoiceState.enabled;
    if (!VoiceState.enabled) stopSpeaking();

    const btn = document.getElementById("voiceToggleBtn");
    if (btn) {
        btn.textContent = VoiceState.enabled ? "🔊 Voice On" : "🔇 Voice Off";
        btn.style.borderColor  = VoiceState.enabled ? "rgba(74,222,128,0.5)" : "rgba(148,163,184,0.3)";
        btn.style.color        = VoiceState.enabled ? "#4ade80" : "#94a3b8";
        btn.style.background   = VoiceState.enabled ? "rgba(74,222,128,0.1)" : "rgba(148,163,184,0.06)";
    }
}

// ── SET VOLUME — INSTANT ──────────────────────────────────────
function setVolume(value) {
    VoiceState.volume = parseFloat(value);
    const label = document.getElementById("volumeLabel");
    if (label) label.textContent = Math.round(VoiceState.volume * 100) + "%";

    // Apply to current utterance instantly
    if (VoiceState.utterance) {
        VoiceState.utterance.volume = VoiceState.volume;
    }
}

// ── SET SPEED — INSTANT ───────────────────────────────────────
function setSpeed(value) {
    const prev        = VoiceState.rate;
    VoiceState.rate   = parseFloat(value);
    const label       = document.getElementById("speedLabel");
    const labels      = { "0.6": "Slow", "0.85": "Normal", "1.2": "Fast", "1.6": "Very Fast" };
    if (label) label.textContent = labels[value] || (value + "x");

    // If currently speaking — restart with new speed
    if (VoiceState.speaking && VoiceState.utterance && prev !== VoiceState.rate) {
        const currentText = VoiceState.utterance.text;
        if (currentText) {
            setTimeout(() => speakText(currentText), 50);
        }
    }
}

// ── SET VOICE — INSTANT ───────────────────────────────────────
function setVoice(index) {
    VoiceState.voiceIndex = parseInt(index);

    // If currently speaking — restart with new voice immediately
    if (VoiceState.speaking && VoiceState.utterance) {
        const currentText = VoiceState.utterance.text;
        if (currentText) {
            setTimeout(() => speakText(currentText), 50);
        }
    }
}

// ── UPDATE UI ─────────────────────────────────────────────────
function updateUI() {
    const isSpeaking = VoiceState.speaking;
    const isPaused   = VoiceState.paused;

    const pauseBtn  = document.getElementById("voicePauseBtn");
    const stopBtn   = document.getElementById("voiceStopBtn");
    const replayBtn = document.getElementById("voicePlayBtn");
    const indicator = document.getElementById("voiceIndicator");

    if (pauseBtn) {
        pauseBtn.textContent   = isPaused ? "▶️ Resume" : "⏸️ Pause";
        pauseBtn.disabled      = !isSpeaking;
        pauseBtn.style.opacity = isSpeaking ? "1" : "0.4";
    }

    if (stopBtn) {
        stopBtn.disabled      = !isSpeaking;
        stopBtn.style.opacity = isSpeaking ? "1" : "0.4";
    }

    if (replayBtn) {
        replayBtn.disabled      = isSpeaking && !isPaused;
        replayBtn.style.opacity = (isSpeaking && !isPaused) ? "0.4" : "1";
    }

    if (indicator) {
        if (isSpeaking && !isPaused) {
            indicator.innerHTML = "<span class='vw'></span><span class='vw'></span><span class='vw'></span> Speaking...";
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
    const welcome = `
        Welcome to Math AI Assistant — your intelligent math tutor, built for HighupWeb Academy in Cameroon.
        I am powered by artificial intelligence and designed to help you master mathematics in 2026 and beyond.
        I can solve equations step by step, draw graphs, explain concepts from the basics, verify answers automatically,
        and I speak every explanation aloud so you can learn while listening.
        Whether you need help with algebra, calculus, trigonometry, statistics, or geometry —
        I am here, ready, and I will not stop until you understand.
        Go ahead — type your first math question, or just say it out loud using the microphone button.
        Let us begin!
    `;
    setTimeout(() => speakText(welcome), 800);
}

function isVoiceSupported() {
    return "speechSynthesis" in window;
}
