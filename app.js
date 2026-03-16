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
    addMessage("Hello! I am Math AI Assistant. Ask me any math question — algebra, geometry, calculus, trigonometry, statistics and more!", "assistant");
});

function generateSessionId() {
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

// ── NEW CHAT ──────────────────────────────────────────────────────────────────
function startNewChat() {
    sessionId = generateSessionId();
    localStorage.setItem("sessionId", sessionId);
    document.getElementById("chatContainer").innerHTML = "";
    document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active-chat"));
    addMessage("New chat started! Ask me any math question!", "assistant");
}

// ── LOAD SESSIONS ─────────────────────────────────────────────────────────────
async function loadSessions() {
    const list = document.getElementById("chatList");
    if (!list) return;
    try {
        list.innerHTML = `<li class="loading-chats">Loading chats...</li>`;
        const res      = await fetch(SESSIONS_API);
        const text     = await res.text();
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
            if (session.sessionId === sessionId) li.classList.add("active-chat");

            const date = session.date
                ? new Date(Number(session.date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

// ── LOAD HISTORY ──────────────────────────────────────────────────────────────
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
        addMessage("Could not generate graph.\n\nTry:\n- plot x squared\n- graph sin(x)\n- plot x cubed minus 2x", "assistant");
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
    img.onclick     = () => window.open(dataUrl, "_blank");
    img.onerror     = () => { wrapper.innerText = "Image could not be displayed."; };
    wrapper.appendChild(img);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// ── RENDER GRAPH — PROPER MATH COORDINATE SYSTEM ─────────────────────────────
function addGraph(data) {
    const container = document.getElementById("chatContainer");

    const wrapper         = document.createElement("div");
    wrapper.className     = "message assistant graph-wrapper";
    wrapper.style.cssText = "background:white;padding:20px;border-radius:16px;max-width:95%;width:95%;";

    // Title
    const title         = document.createElement("p");
    title.innerText     = "📈 " + (data.label || "Graph");
    title.style.cssText = "font-weight:bold;color:#1e3a5f;margin-bottom:14px;font-size:14px;text-align:center;";
    wrapper.appendChild(title);

    // Canvas container — fixed height
    const canvasBox         = document.createElement("div");
    canvasBox.style.cssText = "position:relative;height:420px;width:100%;";
    const canvas            = document.createElement("canvas");
    canvasBox.appendChild(canvas);
    wrapper.appendChild(canvasBox);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    // Build sorted valid data points
    const points = [];
    const xArr   = data.x || [];
    const yArr   = data.y || [];

    for (let i = 0; i < xArr.length; i++) {
        const x = Number(xArr[i]);
        const y = yArr[i];
        if (y !== null && y !== undefined && isFinite(Number(y)) && isFinite(x)) {
            points.push({ x: x, y: Number(y) });
        }
    }

    // Sort by x — critical for correct curve shape
    points.sort((a, b) => a.x - b.x);

    if (points.length === 0) {
        wrapper.innerHTML += "<p style='color:red;text-align:center'>No valid data points to plot.</p>";
        return;
    }

    const allY   = points.map(p => p.y);
    const minY   = Math.min(...allY);
    const maxY   = Math.max(...allY);
    const yRange = maxY - minY || 4;
    const yPad   = yRange * 0.18;

    const xMin   = Number(data.x_min !== undefined ? data.x_min : -5);
    const xMax   = Number(data.x_max !== undefined ? data.x_max :  5);
    const yMin   = Number(data.y_min !== undefined ? data.y_min : minY - yPad);
    const yMax   = Number(data.y_max !== undefined ? data.y_max : maxY + yPad);

    // ── TICK SIZE — clean round numbers ──────────────────────────────────────
    const xRange    = xMax - xMin;
    const xTickSize = xRange <= 4   ? 0.5
                    : xRange <= 10  ? 1
                    : xRange <= 20  ? 2
                    : 5;

    const yDisplayRange = yMax - yMin;
    const yTickSize     = yDisplayRange <= 4   ? 0.5
                        : yDisplayRange <= 10  ? 1
                        : yDisplayRange <= 20  ? 2
                        : yDisplayRange <= 50  ? 5
                        : 10;

    new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [{
                data:             points,
                showLine:         true,
                borderColor:      "#1d4ed8",
                borderWidth:      2.5,
                pointRadius:      0,
                pointHoverRadius: 5,
                tension:          0,
                fill:             false
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 600 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `(${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(3)})`
                    }
                }
            },
            scales: {
                x: {
                    type:     "linear",
                    min:      xMin,
                    max:      xMax,

                    // ── X AXIS CROSSES AT Y=0 — like real math graph ──
                    position: "center",

                    title: {
                        display: true,
                        text:    "x",
                        color:   "#1e293b",
                        font:    { size: 14, weight: "bold" }
                    },
                    grid: {
                        color:        (ctx) => ctx.tick.value === 0
                            ? "#000000"   // bold zero line
                            : "#d1d5db", // light grid
                        lineWidth:    (ctx) => ctx.tick.value === 0 ? 2 : 1,
                        drawTicks:    true
                    },
                    ticks: {
                        color:     "#374151",
                        stepSize:  xTickSize,
                        font:      { size: 11 },
                        callback:  (val) => val === 0 ? "" : val  // hide 0 label to keep clean
                    },
                    border: {
                        display: true,
                        color:   "#000000",
                        width:   2
                    }
                },
                y: {
                    type: "linear",
                    min:  yMin,
                    max:  yMax,

                    // ── Y AXIS CROSSES AT X=0 — like real math graph ──
                    position: "center",

                    title: {
                        display: true,
                        text:    "y",
                        color:   "#1e293b",
                        font:    { size: 14, weight: "bold" }
                    },
                    grid: {
                        color:     (ctx) => ctx.tick.value === 0
                            ? "#000000"
                            : "#d1d5db",
                        lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1,
                        drawTicks: true
                    },
                    ticks: {
                        color:     "#374151",
                        stepSize:  yTickSize,
                        font:      { size: 11 },
                        callback:  (val) => val === 0 ? "" : val
                    },
                    border: {
                        display: true,
                        color:   "#000000",
                        width:   2
                    }
                }
            }
        }
    });
}

// ── ADD MESSAGE ───────────────────────────────────────────────────────────────
function addMessage(text, role) {
    const container      = document.getElementById("chatContainer");
    const div            = document.createElement("div");
    div.className        = "message " + role;
    div.style.whiteSpace = "pre-line";
    div.innerText        = text;
    container.appendChild(div);
    container.scrollTop  = container.scrollHeight;
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
