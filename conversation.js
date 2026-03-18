// ============================================================
// conversation.js — Conversation History & Socratic Flow
// Handles: message history, context tracking, understanding
//          detection, clarification requests
// Path 3: Socratic Interactive Teaching
// ============================================================

// ── CONVERSATION STATE ────────────────────────────────────────
const ConversationState = {
    history:        [],        // Full message history sent to AI
    currentTopic:   null,      // Current math topic being taught
    awaitingReply:  false,     // Is AI waiting for student response?
    stepCount:      0,         // How many steps explained so far
    clarifications: 0,         // How many times student asked for help
    sessionId:      null       // Current session ID
};

// ── INITIALIZE CONVERSATION ───────────────────────────────────
function initConversation(sessionId) {
    ConversationState.history        = [];
    ConversationState.currentTopic   = null;
    ConversationState.awaitingReply  = false;
    ConversationState.stepCount      = 0;
    ConversationState.clarifications = 0;
    ConversationState.sessionId      = sessionId;
    console.log("Conversation initialized for session:", sessionId);
}

// ── ADD MESSAGE TO HISTORY ────────────────────────────────────
function addToHistory(role, content) {
    ConversationState.history.push({ role, content });

    // Keep history at max 20 messages to avoid token limits
    // Always keep system context — remove oldest pairs first
    if (ConversationState.history.length > 20) {
        ConversationState.history.splice(0, 2);
    }
}

// ── GET FULL HISTORY FOR API CALL ─────────────────────────────
function getHistory() {
    return ConversationState.history;
}

// ── CLEAR HISTORY (new chat) ──────────────────────────────────
function clearHistory() {
    ConversationState.history        = [];
    ConversationState.currentTopic   = null;
    ConversationState.awaitingReply  = false;
    ConversationState.stepCount      = 0;
    ConversationState.clarifications = 0;
    console.log("Conversation history cleared");
}

// ── DETECT IF STUDENT IS SAYING THEY DON'T UNDERSTAND ─────────
function isConfusionMessage(text) {
    const confusionPatterns = [
        /i (don'?t|do not|didn'?t|did not) (understand|get it|follow|know)/i,
        /not (clear|sure|following)/i,
        /confus(ed|ing)/i,
        /what do(es)? (that|this) mean/i,
        /can you (explain|clarify|repeat|say that again)/i,
        /\b(huh|what\?|sorry\?|pardon)\b/i,
        /explain (more|again|further|better)/i,
        /too (fast|quick|complex|complicated|hard)/i,
        /lost (me|you)/i,
        /\bwhy\b.*(this|that|do we|does)/i,
        /no[,.]?\s*(i don'?t|i do not)/i,
        /not (yet|really)/i,
        /can('t| not) follow/i,
        /step \d+ (is|was) (unclear|confusing|hard)/i
    ];
    return confusionPatterns.some(p => p.test(text));
}

// ── DETECT IF STUDENT CONFIRMS UNDERSTANDING ──────────────────
function isUnderstandingMessage(text) {
    const understandPatterns = [
        /\b(yes|yeah|yep|yup|ok|okay|sure|got it|i see|i get it)\b/i,
        /i (understand|follow|get it now|see now)/i,
        /that (makes sense|is clear|helped)/i,
        /\b(clear|understood|perfect|great|thanks|thank you)\b/i,
        /now i (understand|get it|see)/i,
        /makes sense/i
    ];
    return understandPatterns.some(p => p.test(text));
}

// ── DETECT MATH TOPIC FROM MESSAGE ────────────────────────────
function detectTopic(text) {
    const topicPatterns = [
        { pattern: /quadratic|x\^2|x²|parabola/i,                  topic: "Quadratic Equations" },
        { pattern: /linear equation|straight line|slope/i,           topic: "Linear Equations" },
        { pattern: /simultaneous|system of equation/i,               topic: "Simultaneous Equations" },
        { pattern: /integral|integration|antiderivat/i,              topic: "Integration" },
        { pattern: /derivative|differentiat|dy.dx/i,                 topic: "Differentiation" },
        { pattern: /limit|approach(es)? (zero|infinity)/i,           topic: "Limits" },
        { pattern: /trigon|sin|cos|tan|angle of elev/i,              topic: "Trigonometry" },
        { pattern: /pythagoras|hypotenuse/i,                         topic: "Pythagoras Theorem" },
        { pattern: /probability|chance|likelihood/i,                  topic: "Probability" },
        { pattern: /statistic|mean|median|mode|standard dev/i,       topic: "Statistics" },
        { pattern: /matrix|matrices|determinant/i,                   topic: "Matrices" },
        { pattern: /vector|dot product|cross product/i,              topic: "Vectors" },
        { pattern: /logarithm|log|ln\b/i,                            topic: "Logarithms" },
        { pattern: /indices|exponent|power|surds/i,                  topic: "Indices and Surds" },
        { pattern: /fraction|ratio|proportion/i,                     topic: "Fractions and Ratios" },
        { pattern: /percentage|percent/i,                             topic: "Percentages" },
        { pattern: /factor|factori(se|ze)/i,                         topic: "Factorisation" },
        { pattern: /polynomial|cubic|quartic/i,                      topic: "Polynomials" },
        { pattern: /geometry|area|volume|perimeter|circle|triangle/i, topic: "Geometry" },
        { pattern: /sequence|series|arithmetic.*progression|geometric.*progression/i, topic: "Sequences and Series" },
        { pattern: /interest|compound|depreciat/i,                   topic: "Financial Mathematics" },
        { pattern: /prime|factor|hcf|lcm|divisib/i,                  topic: "Number Theory" }
    ];

    for (const { pattern, topic } of topicPatterns) {
        if (pattern.test(text)) {
            ConversationState.currentTopic = topic;
            return topic;
        }
    }

    return null;
}

// ── BUILD CONTEXTUAL SYSTEM ADDITION ─────────────────────────
// Adds context to the system prompt based on conversation state
function getContextualInstruction() {
    const { clarifications, currentTopic, awaitingReply } = ConversationState;

    if (clarifications === 0) {
        return ""; // Normal first explanation
    }

    if (clarifications === 1) {
        return `\n\nIMPORTANT CONTEXT: The student has indicated they did not fully understand your previous explanation of ${currentTopic || "this topic"}. 
Please re-explain using:
- Even simpler language
- A real-life analogy or story
- Breaking each step into smaller mini-steps
- More examples
Start with "No problem at all! Let me explain this differently..."`;
    }

    if (clarifications === 2) {
        return `\n\nIMPORTANT CONTEXT: The student is still struggling with ${currentTopic || "this topic"} after two explanations.
Please use the absolute most basic approach:
- Start from the very simplest version of this concept
- Use numbers like 1, 2, 3 (no variables yet if possible)
- Use a visual description or diagram in text
- Go extremely slowly, one tiny step at a time
- Ask after EACH mini step if they follow
Start with "Let me start from the very beginning with this..."`;
    }

    if (clarifications >= 3) {
        return `\n\nIMPORTANT CONTEXT: The student has asked for clarification ${clarifications} times on ${currentTopic || "this topic"}.
Please try a completely different teaching approach:
- Use a real-world story or scenario
- Avoid all math symbols for now, use plain English
- Build up to the math very gradually
- Be extra encouraging and patient
Start with "Let me try a completely different way to explain this..."`;
    }

    return "";
}

// ── INCREMENT CLARIFICATION COUNT ─────────────────────────────
function recordClarificationRequest() {
    ConversationState.clarifications++;
    ConversationState.awaitingReply = false;
    console.log(`Clarification requested. Count: ${ConversationState.clarifications}`);
}

// ── RECORD UNDERSTANDING ──────────────────────────────────────
function recordUnderstanding() {
    ConversationState.clarifications = 0; // Reset confusion counter
    ConversationState.awaitingReply  = false;
    console.log("Student confirmed understanding");
}

// ── SET AWAITING REPLY ────────────────────────────────────────
function setAwaitingReply(isAwaiting) {
    ConversationState.awaitingReply = isAwaiting;
}

// ── GET CURRENT STATE ─────────────────────────────────────────
function getConversationState() {
    return { ...ConversationState };
}

// ── FORMAT HISTORY FOR API ─────────────────────────────────────
// Returns history in the format Groq expects
function getFormattedHistory() {
    return ConversationState.history.map(msg => ({
        role:    msg.role,
        content: msg.content
    }));
}