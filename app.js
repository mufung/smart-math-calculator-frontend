const CHAT_API     = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
const IMAGE_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";
const SESSIONS_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/sessions";
const HISTORY_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/history";

let sessionId = localStorage.getItem("sessionId") || generateSessionId();
localStorage.setItem("sessionId", sessionId);

window.addEventListener("load", async () => {
    await loadSessions();
    addMessage("Hello! I am Math AI Assistant. Ask me any math question — algebra, geometry, calculus, trigonometry, statistics and more!", "assistant");
});

function generateSessionId() {
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function startNewChat() {
    sessionId = generateSessionId();
    localStorage.setItem("sessionId", sessionId);
    document.getElementById("chatContainer").innerHTML = "";
    document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active-chat"));
    addMessage("New chat started! Ask me any math question!", "assistant");
}

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

function addImageToChat(dataUrl) {
    const container   = document.getElementById("chatContainer");
    const wrapper     = document.createElement("div");
    wrapper.className = "message assistant";
    const img         = document.createElement("img");
    img.src           = dataUrl;
    img.alt           = "Generated image";
    img.style.cssText = "max-width:100%;border-radius:12px;margin-top:6px;display:block;cursor:pointer;";
    img.onclick       = () => window.open(dataUrl, "_blank");
    img.onerror       = () => { wrapper.innerText = "Image could not be displayed."; };
    wrapper.appendChild(img);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// ── RENDER GRAPH — PROPER MATH COORDINATE SYSTEM ─────────────────────────────
function addGraph(data) {
    const container = document.getElementById("chatContainer");

    const wrapper         = document.createElement("div");
    wrapper.className     = "message assistant graph-wrapper";
    wrapper.style.cssText = `
        background: white;
        padding: 20px 16px 16px;
        border-radius: 16px;
        max-width: 98%;
        width: 98%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        border: 1px solid #e2e8f0;
    `;

    // Title bar
    const titleBar         = document.createElement("div");
    titleBar.style.cssText = "display:flex;align-items:center;justify-content:center;margin-bottom:14px;gap:8px;";
    titleBar.innerHTML     = `
        <span style="font-size:18px;">📈</span>
        <span style="font-weight:700;color:#1e3a5f;font-size:15px;font-family:'Segoe UI',sans-serif;">
            ${escapeHtml(data.label || "Graph")}
        </span>
    `;
    wrapper.appendChild(titleBar);

    // Canvas container
    const canvasBox         = document.createElement("div");
    canvasBox.style.cssText = "position:relative;height:440px;width:100%;background:#fafafa;border-radius:10px;border:1px solid #e5e7eb;";
    const canvas            = document.createElement("canvas");
    canvasBox.appendChild(canvas);
    wrapper.appendChild(canvasBox);

    // Footer label
    const footer         = document.createElement("div");
    footer.style.cssText = "text-align:center;margin-top:10px;font-size:11px;color:#94a3b8;font-family:monospace;";
    footer.innerText     = `f(x) = ${data.expression || data.label}`;
    wrapper.appendChild(footer);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    // ── Build sorted valid data points ────────────────────────────────────────
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

    points.sort((a, b) => a.x - b.x);

    if (points.length === 0) {
        canvasBox.innerHTML = "<p style='color:red;text-align:center;padding-top:180px;'>No valid data points to plot.</p>";
        return;
    }

    // ── Calculate bounds ──────────────────────────────────────────────────────
    const allY   = points.map(p => p.y);
    const minY   = Math.min(...allY);
    const maxY   = Math.max(...allY);
    const yRange = maxY - minY || 4;
    const yPad   = yRange * 0.20;

    const xMin = Number(data.x_min !== undefined ? data.x_min : -5);
    const xMax = Number(data.x_max !== undefined ? data.x_max :  5);

    // Make y axis symmetric around data — extend to include 0
    let yMin = Number(data.y_min !== undefined ? data.y_min : minY - yPad);
    let yMax = Number(data.y_max !== undefined ? data.y_max : maxY + yPad);

    // Always include 0 in view so x-axis is visible
    if (yMin > 0) yMin = -(yMax * 0.15);
    if (yMax < 0) yMax = -(yMin * 0.15);

    // ── Smart tick sizes ──────────────────────────────────────────────────────
    const xRange    = xMax - xMin;
    const xTickStep = xRange <= 4  ? 0.5
                    : xRange <= 8  ? 1
                    : xRange <= 16 ? 2
                    : xRange <= 40 ? 5
                    : 10;

    const yDisplayRange = yMax - yMin;
    const yTickStep     = yDisplayRange <= 4  ? 0.5
                        : yDisplayRange <= 8  ? 1
                        : yDisplayRange <= 16 ? 2
                        : yDisplayRange <= 40 ? 5
                        : yDisplayRange <= 100 ? 10
                        : 20;

    // ── Draw Chart ────────────────────────────────────────────────────────────
    new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [{
                data:             points,
                showLine:         true,
                borderColor:      "#2563eb",
                borderWidth:      2.5,
                pointRadius:      0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: "#2563eb",
                tension:          0,
                fill:             false
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           { duration: 700, easing: "easeInOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e3a5f",
                    titleColor:      "#fff",
                    bodyColor:       "#93c5fd",
                    padding:         10,
                    cornerRadius:    8,
                    callbacks: {
                        title: () => data.label || "f(x)",
                        label: ctx => `x = ${ctx.parsed.x.toFixed(2)},  y = ${ctx.parsed.y.toFixed(3)}`
                    }
                }
            },
            scales: {
                x: {
                    type:     "linear",
                    min:      xMin,
                    max:      xMax,
                    position: "center",   // ← X axis at y=0

                    title: {
                        display: true,
                        text:    "x",
                        color:   "#1e293b",
                        font:    { size: 13, weight: "bold" },
                        padding: { top: 8 }
                    },
                    grid: {
                        color: (ctx) => {
                            if (ctx.tick.value === 0) return "#000000";
                            return "#e5e7eb";
                        },
                        lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1
                    },
                    ticks: {
                        color:     "#374151",
                        stepSize:  xTickStep,
                        font:      { size: 11, family: "monospace" },
                        callback:  (val) => {
                            if (val === 0) return "0";
                            return Number.isInteger(val) ? val : val.toFixed(1);
                        }
                    },
                    border: {
                        display:   true,
                        color:     "#111827",
                        width:     2,
                        dash:      [],
                    }
                },
                y: {
                    type:     "linear",
                    min:      yMin,
                    max:      yMax,
                    position: "center",   // ← Y axis at x=0

                    title: {
                        display: true,
                        text:    "y",
                        color:   "#1e293b",
                        font:    { size: 13, weight: "bold" },
                        padding: { bottom: 8 }
                    },
                    grid: {
                        color: (ctx) => {
                            if (ctx.tick.value === 0) return "#000000";
                            return "#e5e7eb";
                        },
                        lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1
                    },
                    ticks: {
                        color:     "#374151",
                        stepSize:  yTickStep,
                        font:      { size: 11, family: "monospace" },
                        callback:  (val) => {
                            if (val === 0) return "0";
                            return Number.isInteger(val) ? val : val.toFixed(1);
                        }
                    },
                    border: {
                        display: true,
                        color:   "#111827",
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
    const container = document.getElementById("chatContainer");
    const el        = document.createElement("div");
    el.id           = "typing";
    el.className    = "message assistant typing-msg";
    el.innerHTML    = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
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
