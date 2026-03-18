// ============================================================
// voice.js — Voice Response System for Math AI Assistant
// Uses Web Speech API (free, built into every browser)
// Features: Play, Pause, Stop, Volume, Speed, Voice selection
// Path 6: Voice Response With Controls
// ============================================================

// ── VOICE STATE ───────────────────────────────────────────────
const VoiceState = {
    enabled:      true,       // Voice on/off toggle
    speaking:     false,      // Currently speaking?
    paused:       false,      // Currently paused?
    utterance:    null,       // Current SpeechSynthesisUtterance
    volume:       0.9,        // 0.0 to 1.0
    rate:         0.95,       // 0.5 to 2.0 (speed)
    pitch:        1.0,        // 0.0 to 2.0
    voiceIndex:   -1,         // Selected voice index (-1 = auto)
    voices:       [],         // Available voices
    queue:        [],         // Text queue
    currentMsgId: null        // ID of message being spoken
};

// ── INITIALIZE VOICE SYSTEM ───────────────────────────────────
function initVoice() {
    if (!window.speechSynthesis) {
        console.warn("Web Speech API not supported in this browser");
        return false;
    }

    // Load available voices
    loadVoices();

    // Voices load asynchronously in some browsers
    window.speechSynthesis.onvoiceschanged = () => {
        loadVoices();
    };

    console.log("Voice system initialized");
    return true;
}

// ── LOAD AVAILABLE VOICES ─────────────────────────────────────
function loadVoices() {
    VoiceState.voices = window.speechSynthesis.getVoices();

    // Populate voice selector if it exists
    const selector = document.getElementById("voiceSelector");
    if (!selector) return;

    selector.innerHTML = `<option value="-1">🤖 Auto (Default)</option>`;

    VoiceState.voices.forEach((voice, index) => {
        const option       = document.createElement("option");
        option.value       = index;
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.lang.startsWith("en")) {
            selector.appendChild(option);
        }
    });

    console.log(`Loaded ${VoiceState.voices.length} voices`);
}

// ── CLEAN TEXT FOR SPEECH ─────────────────────────────────────
// Removes LaTeX, markdown, and symbols that sound bad when spoken
function cleanTextForSpeech(text) {
    if (!text) return "";

    let cleaned = text;

    // Remove display math $$...$$
    cleaned = cleaned.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
        return speakMath(math);
    });

    // Remove inline math $...$
    cleaned = cleaned.replace(/\$([^$\n]+?)\$/g, (match, math) => {
        return speakMath(math);
    });

    // Remove markdown symbols
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
    cleaned = cleaned.replace(/\*(.+?)\*/g,     "$1");
    cleaned = cleaned.replace(/#{1,6}\s+/g,      "");
    cleaned = cleaned.replace(/```[a-z]*\n?/gi,  "");
    cleaned = cleaned.replace(/```/g,             "");
    cleaned = cleaned.replace(/`(.+?)`/g,         "$1");
    cleaned = cleaned.replace(/---+/g,            "");
    cleaned = cleaned.replace(/>\s*/g,            "");

    // Replace math symbols with words
    cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    cleaned = cleaned.replace(/\\pm/g,                           "plus or minus");
    cleaned = cleaned.replace(/\\times/g,                        "times");
    cleaned = cleaned.replace(/\\div/g,                          "divided by");
    cleaned = cleaned.replace(/\\leq/g,                          "less than or equal to");
    cleaned = cleaned.replace(/\\geq/g,                          "greater than or equal to");
    cleaned = cleaned.replace(/\\neq/g,                          "not equal to");
    cleaned = cleaned.replace(/\\approx/g,                       "approximately equal to");
    cleaned = cleaned.replace(/\\infty/g,                        "infinity");
    cleaned = cleaned.replace(/\\pi/g,                           "pi");
    cleaned = cleaned.replace(/\\theta/g,                        "theta");
    cleaned = cleaned.replace(/\\alpha/g,                        "alpha");
    cleaned = cleaned.replace(/\\beta/g,                         "beta");
    cleaned = cleaned.replace(/\\Delta/g,                        "delta");
    cleaned = cleaned.replace(/\\boxed\{([^}]+)\}/g,             "The answer is $1");
    cleaned = cleaned.replace(/\^{([^}]+)}/g,                    " to the power of $1");
    cleaned = cleaned.replace(/\^(\d+)/g,                        " to the power of $1");
    cleaned = cleaned.replace(/_{([^}]+)}/g,                     " sub $1");
    cleaned = cleaned.replace(/\\\\/g,                           " ");
    cleaned = cleaned.replace(/\\/g,                             " ");

    // Symbols to words
    cleaned = cleaned.replace(/\+/g, " plus ");
    cleaned = cleaned.replace(/\-/g, " minus ");
    cleaned = cleaned.replace(/\×/g, " times ");
    cleaned = cleaned.replace(/\÷/g, " divided by ");
    cleaned = cleaned.replace(/=/g,  " equals ");
    cleaned = cleaned.replace(/²/g,  " squared ");
    cleaned = cleaned.replace(/³/g,  " cubed ");
    cleaned = cleaned.replace(/√/g,  " square root of ");
    cleaned = cleaned.replace(/π/g,  " pi ");
    cleaned = cleaned.replace(/∞/g,  " infinity ");
    cleaned = cleaned.replace(/∫/g,  " integral of ");
    cleaned = cleaned.replace(/∑/g,  " sum of ");
    cleaned = cleaned.replace(/±/g,  " plus or minus ");

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // Limit length for very long responses
    if (cleaned.length > 1500) {
        cleaned = cleaned.substring(0, 1500) + "... and so on.";
    }

    return cleaned;
}

// ── CONVERT MATH TO SPOKEN WORDS ─────────────────────────────
function speakMath(math) {
    let spoken = math;
    spoken = spoken.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
    spoken = spoken.replace(/\\sqrt\{([^}]+)\}/g,             "square root of $1");
    spoken = spoken.replace(/\^(\d+)/g,                       " to the power $1");
    spoken = spoken.replace(/\\pm/g,                          "plus or minus");
    spoken = spoken.replace(/\\pi/g,                          "pi");
    spoken = spoken.replace(/\\/g,                            "");
    return " " + spoken + " ";
}

// ── SPEAK TEXT ────────────────────────────────────────────────
function speakText(text, msgId = null) {
    if (!VoiceState.enabled) return;
    if (!window.speechSynthesis) return;

    // Stop any current speech
    stopSpeaking();

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    const utterance        = new SpeechSynthesisUtterance(cleanedText);
    utterance.volume       = VoiceState.volume;
    utterance.rate         = VoiceState.rate;
    utterance.pitch        = VoiceState.pitch;

    // Set voice if selected
    if (VoiceState.voiceIndex >= 0 &&
        VoiceState.voices[VoiceState.voiceIndex]) {
        utterance.voice = VoiceState.voices[VoiceState.voiceIndex];
    } else {
        // Auto select best English voice
        const englishVoice = VoiceState.voices.find(v =>
            v.lang.startsWith("en") && v.name.includes("Google")
        ) || VoiceState.voices.find(v =>
            v.lang.startsWith("en")
        );
        if (englishVoice) utterance.voice = englishVoice;
    }

    // Events
    utterance.onstart = () => {
        VoiceState.speaking     = true;
        VoiceState.paused       = false;
        VoiceState.utterance    = utterance;
        VoiceState.currentMsgId = msgId;
        updateVoiceControls(true, false);
        console.log("Speaking started");
    };

    utterance.onend = () => {
        VoiceState.speaking     = false;
        VoiceState.paused       = false;
        VoiceState.utterance    = null;
        VoiceState.currentMsgId = null;
        updateVoiceControls(false, false);
        console.log("Speaking ended");
    };

    utterance.onerror = (e) => {
        console.warn("Speech error:", e.error);
        VoiceState.speaking = false;
        VoiceState.paused   = false;
        updateVoiceControls(false, false);
    };

    utterance.onpause = () => {
        VoiceState.paused = true;
        updateVoiceControls(true, true);
    };

    utterance.onresume = () => {
        VoiceState.paused = false;
        updateVoiceControls(true, false);
    };

    VoiceState.utterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// ── PAUSE SPEAKING ────────────────────────────────────────────
function pauseSpeaking() {
    if (window.speechSynthesis && VoiceState.speaking && !VoiceState.paused) {
        window.speechSynthesis.pause();
        VoiceState.paused = true;
        updateVoiceControls(true, true);
    }
}

// ── RESUME SPEAKING ───────────────────────────────────────────
function resumeSpeaking() {
    if (window.speechSynthesis && VoiceState.paused) {
        window.speechSynthesis.resume();
        VoiceState.paused = false;
        updateVoiceControls(true, false);
    }
}

// ── STOP SPEAKING ─────────────────────────────────────────────
function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        VoiceState.speaking     = false;
        VoiceState.paused       = false;
        VoiceState.utterance    = null;
        VoiceState.currentMsgId = null;
        updateVoiceControls(false, false);
    }
}

// ── TOGGLE VOICE ON/OFF ───────────────────────────────────────
function toggleVoice() {
    VoiceState.enabled = !VoiceState.enabled;

    const btn = document.getElementById("voiceToggleBtn");
    if (btn) {
        btn.textContent = VoiceState.enabled ? "🔊 Voice On" : "🔇 Voice Off";
        btn.classList.toggle("voice-off", !VoiceState.enabled);
    }

    if (!VoiceState.enabled) {
        stopSpeaking();
    }

    console.log("Voice enabled:", VoiceState.enabled);
}

// ── SET VOLUME ────────────────────────────────────────────────
function setVolume(value) {
    VoiceState.volume = parseFloat(value);
    const label = document.getElementById("volumeLabel");
    if (label) label.textContent = Math.round(VoiceState.volume * 100) + "%";
}

// ── SET SPEED ─────────────────────────────────────────────────
function setSpeed(value) {
    VoiceState.rate = parseFloat(value);
    const label = document.getElementById("speedLabel");
    if (label) {
        const labels = { "0.7": "Slow", "0.95": "Normal", "1.3": "Fast", "1.6": "Very Fast" };
        label.textContent = labels[value] || value + "x";
    }
}

// ── SET VOICE ─────────────────────────────────────────────────
function setVoice(index) {
    VoiceState.voiceIndex = parseInt(index);
}

// ── UPDATE VOICE CONTROL BUTTONS ─────────────────────────────
function updateVoiceControls(isSpeaking, isPaused) {
    const playBtn   = document.getElementById("voicePlayBtn");
    const pauseBtn  = document.getElementById("voicePauseBtn");
    const stopBtn   = document.getElementById("voiceStopBtn");
    const indicator = document.getElementById("voiceIndicator");

    if (playBtn) {
        playBtn.disabled    = isSpeaking && !isPaused;
        playBtn.style.opacity = (isSpeaking && !isPaused) ? "0.4" : "1";
    }

    if (pauseBtn) {
        pauseBtn.textContent = isPaused ? "▶️ Resume" : "⏸️ Pause";
        pauseBtn.disabled    = !isSpeaking;
        pauseBtn.style.opacity = !isSpeaking ? "0.4" : "1";
    }

    if (stopBtn) {
        stopBtn.disabled    = !isSpeaking;
        stopBtn.style.opacity = !isSpeaking ? "0.4" : "1";
    }

    if (indicator) {
        if (isSpeaking && !isPaused) {
            indicator.innerHTML = `<span class="voice-wave"></span><span class="voice-wave"></span><span class="voice-wave"></span> Speaking...`;
            indicator.classList.add("active");
        } else if (isPaused) {
            indicator.innerHTML = `⏸️ Paused`;
            indicator.classList.remove("active");
        } else {
            indicator.innerHTML = `🔊 Ready`;
            indicator.classList.remove("active");
        }
    }
}

// ── REPLAY LAST MESSAGE ───────────────────────────────────────
function replayLastMessage() {
    const messages = document.querySelectorAll(".markdown-message");
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        speakText(lastMsg.innerText || lastMsg.textContent);
    }
}

// ── IS VOICE SUPPORTED ────────────────────────────────────────
function isVoiceSupported() {
    return "speechSynthesis" in window;
}