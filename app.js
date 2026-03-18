// ============================================================
// app.js — Main application logic
// Path 3: Uses conversation.js for Socratic flow
//         Sends full history to Lambda
//         Detects confusion and understanding
// ============================================================

// ── API ENDPOINTS ─────────────────────────────────────────────
const CHAT_API     = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
const IMAGE_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";
const SESSIONS_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/sessions";
const HISTORY_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/history";

// ── SESSION ───────────────────────────────────────────────────
let sessionId = localStorage.getItem("sessionId") || generateSessionId();
localStorage.setItem("sessionId", sessionId);

// ── ON PAGE LOAD ──────────────────────────────────────────────
window.addEventListener("load", async () => {
    // Initialize conversation tracking from conversation.js
    initConversation(sessionId);

    await loadSessions();
    showWelcomeMessage(); // from renderer.js
});

// ── GENERATE SESSION ID ───────────────────────────────────────
function generateSessionId() {
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

// ── NEW CHAT ──────────────────────────────────────────────────
function startNewChat() {
    sessionId = generateSessionId();
    localStorage.setItem("sessionId", sessionId);

    // Reset conversation history for new chat
    clearHistory(); // from conversation.js
    initConversation(sessionId);

    const container = document.getElementById("chatContainer");
    if (container) container.innerHTML = "";

    document.querySelectorAll(".chat-item").forEach(el => {
        el.classList.remove("active-chat");
    });

    showWelcomeMessage(); // from renderer.js
}

// ── LOAD SESSIONS ─────────────────────────────────────────────
async function loadSessions() {
    const list = document.getElementById("chatList");
    if (!list) return;

    try {
        list.innerHTML = `<li class="loading-chats">Loading chats...</li>`;

        const res      = await fetch(SESSIONS_API);
        const text     = await res.text();
        const data     = JSON.parse(text);
        const sessions = data.sessions || [];

        list.innerHTML = "";

        if (sessions.length === 0) {
            list.innerHTML = `<li class="no-chats">No past chats yet</li>`;
            return;
        }

        sessions.forEach(session => {
            const li       = document.createElement("li");
            li.className   = "chat-item";
            li.dataset.sid = session.sessionId;

            if (session.sessionId === sessionId) {
                li.classList.add("active-chat");
            }

            const date = session.date
                ? new Date(Number(session.date)).toLocaleDateString("en-US", {
                    month: "short", day: "numeric"
                  })
                : "";

            li.innerHTML = `
                <span class="chat-item-icon">💬</span>
                <div class="chat-item-info">
                    <span class="chat-item-text">${escapeHtml(session.title)}</span>
                    <span class="chat-item-date">${date}</span>
                </div>`;

            li.addEventListener("click", () => loadHistory(session.sessionId, li));
            list.appendChild(li);
        });

        console.log(`Loaded ${sessions.length} sessions`);

    } catch (err) {
        console.error("Failed to load sessions:", err);
        list.innerHTML = `<li class="no-chats">Could not load chats</li>`;
    }
}

// ── LOAD CHAT HISTORY ─────────────────────────────────────────
async function loadHistory(sid, clickedEl) {
    try {
        sessionId = sid;
        localStorage.setItem("sessionId", sid);

        // Reset and re-init conversation for this session
        clearHistory();
        initConversation(sid);

        document.querySelectorAll(".chat-item").forEach(el => {
            el.classList.remove("active-chat");
        });
        if (clickedEl) clickedEl.classList.add("active-chat");

        const container = document.getElementById("chatContainer");
        if (container) container.innerHTML = "";

        addMarkdownMessage("Loading chat history...");

        const res  = await fetch(`${HISTORY_API}?sessionId=${encodeURIComponent(sid)}`);
        const data = await res.json();

        if (container) container.innerHTML = "";

        const messages = data.messages || [];

        if (messages.length === 0) {
            addMarkdownMessage("No messages found in this chat.");
            return;
        }

        // Rebuild conversation history from DynamoDB for context
        messages.forEach(msg => {
            if (!msg.text) return;

            if (msg.role === "user") {
                addUserMessage(msg.text);
                // Rebuild history context
                addToHistory("user", msg.text);

            } else if (msg.type === "image") {
                if (msg.s3_url) {
                    addImageToChat(null, msg.s3_url);
                } else {
                    addMarkdownMessage("🎨 *Image generated here*");
                }
                addToHistory("assistant", msg.text || "[Image generated]");

            } else if (msg.type === "graph") {
                addMarkdownMessage("📈 " + msg.text);
                addToHistory("assistant", msg.text);

            } else {
                addMarkdownMessage(msg.text);
                // Rebuild history context
                addToHistory("assistant", msg.text);
            }
        });

        const cont = document.getElementById("chatContainer");
        if (cont) cont.scrollTop = cont.scrollHeight;

    } catch (err) {
        console.error("Load history error:", err);
        addMarkdownMessage("Could not load chat history. Please try again.");
    }
}

// ── SEND MESSAGE — MAIN ENTRY POINT ──────────────────────────
async function sendMessage() {
    const input = document.getElementById("messageInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    addUserMessage(message);
    input.value = "";
    showTyping();

    // Detect topic from message
    detectTopic(message); // from conversation.js

    // Check if student is expressing confusion or understanding
    const isConfused    = isConfusionMessage(message);    // from conversation.js
    const isUnderstood  = isUnderstandingMessage(message); // from conversation.js

    if (isConfused) {
        recordClarificationRequest(); // from conversation.js
        showClarificationIndicator(); // show visual indicator
    }
    if (isUnderstood) {
        recordUnderstanding(); // from conversation.js
    }

    // Intent detection for routing
    const isGraphRequest = /\b(graph|plot|chart|sketch)\b/i.test(message);
    const isImageRequest = /^(draw|create|sketch|show)\s.*(square|circle|triangle|hexagon|polygon|rectangle|pentagon|octagon|shape)/i.test(message)
        || /\b(imagen|generate image|ai image|ai picture)\b/i.test(message);

    try {
        if (isGraphRequest && !isImageRequest) {
            await handleGraph(message);
        } else if (isImageRequest) {
            await handleImage(message);
        } else {
            await handleChat(message);
        }

        setTimeout(loadSessions, 2000);

    } catch (error) {
        removeTyping();
        addMarkdownMessage("Something went wrong. Please try again.");
        console.error("sendMessage error:", error);
    }
}

// ── HANDLE CHAT — WITH FULL CONVERSATION HISTORY ─────────────
async function handleChat(message) {
    // Get contextual instruction based on confusion level
    const contextAdd = getContextualInstruction(); // from conversation.js

    // Get full formatted history
    const history = getFormattedHistory(); // from conversation.js

    const res = await fetch(CHAT_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            message,
            sessionId,
            history,       // ← Send full history to Lambda
            contextAdd     // ← Send confusion context if any
        })
    });

    let data = await res.json();
    if (typeof data.body === "string") data = JSON.parse(data.body);

    sessionId = data.sessionId || sessionId;
    localStorage.setItem("sessionId", sessionId);

    const reply = data.reply || "No response received.";

    // Add BOTH sides to conversation history for next message
    addToHistory("user",      message); // from conversation.js
    addToHistory("assistant", reply);   // from conversation.js

    removeTyping();
    removeClarificationIndicator();

    // Render with full math + markdown
    addMathMarkdownMessage(reply); // from math-renderer.js
}

// ── HANDLE GRAPH ──────────────────────────────────────────────
async function handleGraph(message) {
    const res = await fetch(GRAPH_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ expression: message, sessionId })
    });

    let data = await res.json();
    if (typeof data.body === "string") data = JSON.parse(data.body);

    removeTyping();

    if (data.x && data.y) {
        // Add to history as text description
        addToHistory("user",      message);
        addToHistory("assistant", `Graph plotted: ${data.label || message}`);
        addGraph(data);
    } else {
        const errMsg = `Could not generate graph.

**Try these examples:**
- plot x squared
- graph sin(x)
- plot x cubed minus 2x
- graph cos(x) + x`;
        addMathMarkdownMessage(errMsg);
    }
}

// ── HANDLE IMAGE ──────────────────────────────────────────────
async function handleImage(message) {
    const msg = message.toLowerCase();
    let body  = {};

    if (/imagen|generate image|ai image|ai picture/i.test(msg)) {
        body = { action: "imagen_ai", prompt: message, sessionId };
    } else {
        let shape = "square";
        if      (/circle/.test(msg))    shape = "circle";
        else if (/triangle/.test(msg))  shape = "triangle";
        else if (/hexagon/.test(msg))   shape = "hexagon";
        else if (/rectangle/.test(msg)) shape = "rectangle";
        else if (/pentagon/.test(msg))  shape = "pentagon";
        else if (/octagon/.test(msg))   shape = "octagon";
        else if (/polygon/.test(msg))   shape = "polygon";

        const sidesMatch = msg.match(/(\d+)\s*side/);
        const sides      = sidesMatch ? parseInt(sidesMatch[1]) : 6;
        const sizeMatch  = msg.match(/size\s*(\d+)|(\d+)\s*px/);
        const size       = sizeMatch ? parseInt(sizeMatch[1] || sizeMatch[2]) : 150;

        const colorList = ["red","blue","green","yellow","purple","orange","pink","cyan","royalblue","gold","white"];
        let color       = "royalblue";
        for (const c of colorList) { if (msg.includes(c)) { color = c; break; } }

        body = {
            action: "draw_shape", shape, sides, size,
            color, outline: "white", label: message, sessionId
        };
    }

    const res = await fetch(IMAGE_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body)
    });

    removeTyping();

    try {
        let data = JSON.parse(await res.text());
        if (typeof data.body === "string") data = JSON.parse(data.body);

        if      (data.data_url)    addImageToChat(data.data_url);
        else if (data.image)       addImageToChat("data:image/png;base64," + data.image);
        else if (data.images?.[0]) addImageToChat(data.images[0].data_url);
        else addMathMarkdownMessage("Could not generate image: " + (data.error || "Unknown error"));

        addToHistory("user",      message);
        addToHistory("assistant", "[Image generated successfully]");

    } catch (e) {
        console.error("Image error:", e);
        addMathMarkdownMessage("Could not display image.");
    }
}

// ── RENDER GRAPH ──────────────────────────────────────────────
function addGraph(data) {
    const canvas = createGraphWrapper(data.label, data.expression);
    if (!canvas) return;

    const points = [];
    const xArr   = data.x || [];
    const yArr   = data.y || [];

    for (let i = 0; i < xArr.length; i++) {
        const x = Number(xArr[i]);
        const y = yArr[i];
        if (y !== null && y !== undefined && isFinite(Number(y)) && isFinite(x)) {
            points.push({ x, y: Number(y) });
        }
    }
    points.sort((a, b) => a.x - b.x);

    if (points.length === 0) {
        addMathMarkdownMessage("No valid data points to plot.");
        return;
    }

    const allY       = points.map(p => p.y);
    const minY       = Math.min(...allY);
    const maxY       = Math.max(...allY);
    const yRange     = maxY - minY || 4;
    const yPad       = yRange * 0.20;
    const xMin       = Number(data.x_min !== undefined ? data.x_min : -5);
    const xMax       = Number(data.x_max !== undefined ? data.x_max :  5);
    let   yMin       = Number(data.y_min !== undefined ? data.y_min : minY - yPad);
    let   yMax       = Number(data.y_max !== undefined ? data.y_max : maxY + yPad);

    if (yMin > 0) yMin = -(yMax * 0.15);
    if (yMax < 0) yMax = -(yMin * 0.15);

    const xRange     = xMax - xMin;
    const xTickStep  = xRange <= 4 ? 0.5 : xRange <= 8 ? 1 : xRange <= 16 ? 2 : 5;
    const yDispRange = yMax - yMin;
    const yTickStep  = yDispRange <= 4 ? 0.5 : yDispRange <= 8 ? 1 : yDispRange <= 16 ? 2 : yDispRange <= 40 ? 5 : 10;

    new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [{
                data: points, showLine: true,
                borderColor: "#2563eb", borderWidth: 2.5,
                pointRadius: 0, pointHoverRadius: 5,
                tension: 0, fill: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 700 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e3a5f",
                    titleColor: "#fff", bodyColor: "#93c5fd",
                    padding: 10, cornerRadius: 8,
                    callbacks: {
                        title: () => data.label || "f(x)",
                        label: ctx => `x = ${ctx.parsed.x.toFixed(2)},  y = ${ctx.parsed.y.toFixed(3)}`
                    }
                }
            },
            scales: {
                x: {
                    type: "linear", min: xMin, max: xMax, position: "center",
                    title: { display: true, text: "x", color: "#1e293b", font: { size: 13, weight: "bold" } },
                    grid:  { color: ctx => ctx.tick.value === 0 ? "#000" : "#e5e7eb", lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1 },
                    ticks: { color: "#374151", stepSize: xTickStep, font: { size: 11, family: "monospace" }, callback: val => val === 0 ? "0" : Number.isInteger(val) ? val : val.toFixed(1) },
                    border: { display: true, color: "#111827", width: 2 }
                },
                y: {
                    type: "linear", min: yMin, max: yMax, position: "center",
                    title: { display: true, text: "y", color: "#1e293b", font: { size: 13, weight: "bold" } },
                    grid:  { color: ctx => ctx.tick.value === 0 ? "#000" : "#e5e7eb", lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1 },
                    ticks: { color: "#374151", stepSize: yTickStep, font: { size: 11, family: "monospace" }, callback: val => val === 0 ? "0" : Number.isInteger(val) ? val : val.toFixed(1) },
                    border: { display: true, color: "#111827", width: 2 }
                }
            }
        }
    });
}

// ── CLARIFICATION VISUAL INDICATOR ───────────────────────────
function showClarificationIndicator() {
    const inputArea = document.querySelector(".inputArea");
    if (!inputArea) return;

    removeClarificationIndicator();

    const banner      = document.createElement("div");
    banner.id         = "clarificationBanner";
    banner.className  = "clarification-banner";
    banner.innerHTML  = `
        <span class="clarification-icon">🔄</span>
        <span>Re-explaining with a simpler approach...</span>
    `;
    inputArea.parentNode.insertBefore(banner, inputArea);
}

function removeClarificationIndicator() {
    const el = document.getElementById("clarificationBanner");
    if (el) el.remove();
}

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
