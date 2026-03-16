const CHAT_API     = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
const IMAGE_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";
const SESSIONS_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/sessions";
const HISTORY_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/history";

let sessionId = localStorage.getItem("sessionId") || generateSessionId();
localStorage.setItem("sessionId", sessionId);

// ── ON PAGE LOAD ──────────────────────────────────────────────────────────────
window.addEventListener("load", async () => {
    await loadSessions();
    addMessage("Hello! I am Math AI Assistant. Ask me any math question — algebra, geometry, calculus, trigonometry, statistics and more! 🧮", "assistant");
});

// ── GENERATE SESSION ID ───────────────────────────────────────────────────────
function generateSessionId() {
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

// ── NEW CHAT ──────────────────────────────────────────────────────────────────
function startNewChat() {
    sessionId = generateSessionId();
    localStorage.setItem("sessionId", sessionId);
    document.getElementById("chatContainer").innerHTML = "";
    document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active-chat"));
    addMessage("New chat started! Ask me any math question! 🧮", "assistant");
}

// ── LOAD ALL SESSIONS ─────────────────────────────────────────────────────────
async function loadSessions() {
    const list = document.getElementById("chatList");
    if (!list) return;

    try {
        list.innerHTML = `<li class="loading-chats">Loading chats...</li>`;

        const res  = await fetch(SESSIONS_API);
        const text = await res.text();
        console.log("Sessions raw response:", text);

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
                </div>
            `;

            li.addEventListener("click", () => loadHistory(session.sessionId, li));
            list.appendChild(li);
        });

        console.log(`Loaded ${sessions.length} sessions`);

    } catch (err) {
        console.error("Failed to load sessions:", err);
        list.innerHTML = `<li class="no-chats">Could not load chats</li>`;
    }
}

// ── LOAD CHAT HISTORY ─────────────────────────────────────────────────────────
async function loadHistory(sid, clickedEl) {
    try {
        sessionId = sid;
        localStorage.setItem("sessionId", sid);

        document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active-chat"));
        if (clickedEl) clickedEl.classList.add("active-chat");

        const container = document.getElementById("chatContainer");
        container.innerHTML = "";
        addMessage("Loading chat history...", "assistant");

        const res  = await fetch(`${HISTORY_API}?sessionId=${encodeURIComponent(sid)}`);
        const data = await res.json();

        container.innerHTML = "";

        const messages = data.messages || [];
        if (messages.length === 0) {
            addMessage("No messages found in this chat.", "assistant");
            return;
        }

        messages.forEach(msg => {
            if (!msg.text) return;
            if (msg.role === "user") {
                addMessage(msg.text, "user");
            } else {
                if      (msg.type === "image") addMessage("🎨 " + msg.text, "assistant");
                else if (msg.type === "graph") addMessage("📈 " + msg.text, "assistant");
                else                           addMessage(msg.text, "assistant");
            }
        });

        container.scrollTop = container.scrollHeight;

    } catch (err) {
        console.error("Load history error:", err);
        addMessage("Could not load chat history.", "assistant");
    }
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
async function sendMessage() {
    const input   = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";
    showTyping();

    const isGraphRequest = /\b(graph|plot|chart|draw the function|sketch the function|draw the graph|sketch the graph)\b/i.test(message);
    const isImageRequest = /^(draw|create|sketch|show)\s.*(square|circle|triangle|hexagon|polygon|rectangle|pentagon|octagon|shape)/i.test(message)
        || /\b(imagen|generate image|ai image|ai picture)\b/i.test(message);

    try {
        if (isGraphRequest) {
            await handleGraph(message);
        } else if (isImageRequest) {
            await handleImage(message);
        } else {
            await handleChat(message);
        }

        setTimeout(loadSessions, 2000);

    } catch (error) {
        removeTyping();
        addMessage("Something went wrong. Please try again.", "assistant");
        console.error("sendMessage error:", error);
    }
}

// ── HANDLE CHAT ───────────────────────────────────────────────────────────────
async function handleChat(message) {
    const res = await fetch(CHAT_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, sessionId })
    });

    let data = await res.json();
    if (typeof data.body === "string") data = JSON.parse(data.body);

    sessionId = data.sessionId || sessionId;
    localStorage.setItem("sessionId", sessionId);

    removeTyping();
    addMessage(data.reply || "No response received.", "assistant");
}

// ── HANDLE GRAPH ──────────────────────────────────────────────────────────────
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
        addGraph(data);
    } else {
        addMessage(
            "Could not generate graph. Try:\n- plot x squared\n- graph sin(x)\n- plot x^3 minus 2x",
            "assistant"
        );
    }
}

// ── HANDLE IMAGE ──────────────────────────────────────────────────────────────
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

        const colorList  = ["red","blue","green","yellow","purple","orange","pink","cyan","royalblue","gold","white"];
        let color        = "royalblue";
        for (const c of colorList) { if (msg.includes(c)) { color = c; break; } }

        body = { action: "draw_shape", shape, sides, size, color, outline: "white", label: message, sessionId };
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
        else addMessage("Could not generate image: " + (data.error || "Unknown error"), "assistant");

    } catch (e) {
        console.error("Image error:", e);
        addMessage("Could not display image.", "assistant");
    }
}

// ── RENDER IMAGE ──────────────────────────────────────────────────────────────
function addImageToChat(dataUrl) {
    const container   = document.getElementById("chatContainer");
    const wrapper     = document.createElement("div");
    wrapper.className = "message assistant";

    const img       = document.createElement("img");
    img.src         = dataUrl;
    img.alt         = "Generated image";
    img.style.cssText = "max-width:100%;border-radius:12px;margin-top:6px;display:block;cursor:pointer;";
    img.title       = "Click to enlarge";
    img.onclick     = () => window.open(dataUrl, "_blank");
    img.onerror     = () => { wrapper.innerText = "Image could not be displayed."; };

    wrapper.appendChild(img);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// ── RENDER GRAPH — FIXED ──────────────────────────────────────────────────────
function addGraph(data) {
    const container = document.getElementById("chatContainer");
    const wrapper   = document.createElement("div");
    wrapper.className = "message assistant graph-wrapper";

    const title         = document.createElement("p");
    title.innerText     = "📈 " + (data.label || "Graph");
    title.style.cssText = "font-weight:bold;color:#1e3a5f;margin-bottom:12px;font-size:14px;";
    wrapper.appendChild(title);

    const canvasWrapper       = document.createElement("div");
    canvasWrapper.style.cssText = "position:relative;height:380px;width:100%;background:white;border-radius:12px;padding:10px;";

    const canvas = document.createElement("canvas");
    canvasWrapper.appendChild(canvas);
    wrapper.appendChild(canvasWrapper);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    // ── Build clean sorted data points ──
    const rawPoints = [];
    const xArr = data.x || [];
    const yArr = data.y || [];

    for (let i = 0; i < xArr.length; i++) {
        const x = Number(xArr[i]);
        const y = yArr[i];
        // Only include finite valid numbers
        if (
            y !== null &&
            y !== undefined &&
            isFinite(Number(y)) &&
            isFinite(x)
        ) {
            rawPoints.push({ x: x, y: Number(y) });
        }
    }

    // Sort by x value — critical for correct parabola shape
    rawPoints.sort((a, b) => a.x - b.x);

    if (rawPoints.length === 0) {
        wrapper.innerHTML = "<p style='color:red'>Could not render graph — no valid data points.</p>";
        return;
    }

    // Calculate proper y bounds from actual data
    const allY    = rawPoints.map(p => p.y);
    const minY    = Math.min(...allY);
    const maxY    = Math.max(...allY);
    const yRange  = maxY - minY || 10;
    const yPad    = yRange * 0.15;

    const xMin    = data.x_min !== undefined ? Number(data.x_min) : -10;
    const xMax    = data.x_max !== undefined ? Number(data.x_max) :  10;
    const yMin    = Number(data.y_min !== undefined ? data.y_min : minY - yPad);
    const yMax    = Number(data.y_max !== undefined ? data.y_max : maxY + yPad);

    console.log(`Graph: ${data.label} | Points: ${rawPoints.length} | Y range: ${minY} to ${maxY}`);

    new Chart(canvas, {
        type: "scatter",   // USE SCATTER not line — this respects x values properly
        data: {
            datasets: [{
                data:            rawPoints,
                showLine:        true,        // draw the line through points
                borderColor:     "#1d4ed8",
                borderWidth:     2.5,
                pointRadius:     0,           // no dots on each point
                pointHoverRadius: 4,
                tension:         0,           // straight lines between points — no smoothing
                fill:            false,
                backgroundColor: "transparent"
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `(${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(4)})`
                    }
                }
            },
            scales: {
                x: {
                    type:  "linear",
                    min:   xMin,
                    max:   xMax,
                    title: {
                        display:  true,
                        text:     "x",
                        color:    "#1e293b",
                        font:     { size: 13, weight: "bold" }
                    },
                    grid:  {
                        color:     "#e2e8f0",
                        lineWidth: 1
                    },
                    ticks: {
                        color:         "#475569",
                        maxTicksLimit: 11,
                        stepSize:      2
                    },
                    border: {
                        display: true,
                        color:   "#1e293b",
                        width:   2
                    }
                },
                y: {
                    type:  "linear",
                    min:   yMin,
                    max:   yMax,
                    title: {
                        display:  true,
                        text:     "y",
                        color:    "#1e293b",
                        font:     { size: 13, weight: "bold" }
                    },
                    grid:  {
                        color:     "#e2e8f0",
                        lineWidth: 1
                    },
                    ticks: {
                        color:         "#475569",
                        maxTicksLimit: 8
                    },
                    border: {
                        display: true,
                        color:   "#1e293b",
                        width:   2
                    }
                }
            }
        }
    });
}

// ── ADD MESSAGE ───────────────────────────────────────────────────────────────
function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    const div       = document.createElement("div");
    div.className   = "message " + role;
    div.style.whiteSpace = "pre-line";
    div.innerText   = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container  = document.getElementById("chatContainer");
    const el         = document.createElement("div");
    el.id            = "typing";
    el.className     = "message assistant typing-msg";
    el.innerHTML     = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
