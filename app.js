const CHAT_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
const IMAGE_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";

let sessionId = localStorage.getItem("sessionId");

async function sendMessage() {
    const input   = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";
    showTyping();

    const isImageRequest = /draw|create|shape|square|circle|triangle|hexagon|polygon|rectangle|imagen|generate image|picture/i.test(message);
    const isGraphRequest  = /graph|plot|function of|f\(x\)/i.test(message);

    try {
        if (isImageRequest) {
            await handleImage(message);
        } else if (isGraphRequest) {
            await handleGraph(message);
        } else {
            await handleChat(message);
        }
    } catch (error) {
        removeTyping();
        addMessage("Server error. Please try again.", "assistant");
        console.error(error);
    }
}

// ── CHAT ──────────────────────────────────────────────────────────────────────
async function handleChat(message) {
    const res = await fetch(CHAT_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, sessionId })
    });

    let data = await res.json();
    if (data.body) data = JSON.parse(data.body);

    sessionId = data.sessionId || sessionId;
    if (sessionId) localStorage.setItem("sessionId", sessionId);

    removeTyping();
    addMessage(data.reply || "No response", "assistant");
}

// ── GRAPH ─────────────────────────────────────────────────────────────────────
async function handleGraph(message) {
    const res = await fetch(GRAPH_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ expression: message })
    });

    let data = await res.json();
    if (data.body) data = JSON.parse(data.body);

    removeTyping();

    if (data.x && data.y) {
        addGraph(data);
    } else {
        addMessage("Could not generate graph. Try: 'plot x^2' or 'graph sin(x)'", "assistant");
    }
}

// ── IMAGE ─────────────────────────────────────────────────────────────────────
async function handleImage(message) {
    const msg = message.toLowerCase();
    let body  = {};

    if (/imagen|generate image|ai image|picture/i.test(msg)) {
        // Google Imagen AI
        body = { action: "imagen_ai", prompt: message };

    } else {
        // PIL shape drawing
        let shape = "square";
        if      (/circle/.test(msg))    shape = "circle";
        else if (/triangle/.test(msg))  shape = "triangle";
        else if (/hexagon/.test(msg))   shape = "hexagon";
        else if (/rectangle/.test(msg)) shape = "rectangle";
        else if (/pentagon/.test(msg))  shape = "pentagon";
        else if (/octagon/.test(msg))   shape = "octagon";
        else if (/polygon/.test(msg))   shape = "polygon";
        else if (/square/.test(msg))    shape = "square";

        // Extract number of sides if mentioned
        const sidesMatch = msg.match(/(\d+)\s*side/);
        const sides      = sidesMatch ? parseInt(sidesMatch[1]) : 6;

        // Extract size if mentioned
        const sizeMatch = msg.match(/size\s*(\d+)|(\d+)\s*px/);
        const size      = sizeMatch ? parseInt(sizeMatch[1] || sizeMatch[2]) : 150;

        // Extract color if mentioned
        const colors = ["red","blue","green","yellow","purple","orange","pink","white","cyan","royalblue","gold"];
        let color    = "royalblue";
        for (const c of colors) {
            if (msg.includes(c)) { color = c; break; }
        }

        body = { action: "draw_shape", shape, sides, size, color, outline: "white", label: message };
    }

    const res = await fetch(IMAGE_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body)
    });

    removeTyping();

    try {
        const text = await res.text();
        let data   = JSON.parse(text);

        // Unwrap double-encoded body if needed
        if (typeof data.body === "string") data = JSON.parse(data.body);

        if (data.data_url) {
            addImageToChat(data.data_url);
        } else if (data.image) {
            addImageToChat("data:image/png;base64," + data.image);
        } else if (data.images && data.images[0]) {
            addImageToChat(data.images[0].data_url);
        } else {
            addMessage("Could not generate image: " + (data.error || "Unknown error"), "assistant");
        }
    } catch (e) {
        console.error("Image parse error:", e);
        addMessage("Could not display image. Check console for details.", "assistant");
    }
}

// ── RENDER IMAGE IN CHAT ──────────────────────────────────────────────────────
function addImageToChat(dataUrl) {
    const container = document.getElementById("chatContainer");
    const wrapper   = document.createElement("div");
    wrapper.className = "message assistant";

    const img   = document.createElement("img");
    img.src     = dataUrl;
    img.alt     = "Generated image";
    img.style.cssText = "max-width:100%;border-radius:12px;margin-top:6px;display:block;";

    img.onerror = () => {
        wrapper.innerText = "Image could not be displayed.";
    };

    wrapper.appendChild(img);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// ── RENDER GRAPH IN CHAT ──────────────────────────────────────────────────────
function addGraph(data) {
    const container = document.getElementById("chatContainer");
    const wrapper   = document.createElement("div");
    wrapper.className            = "message assistant";
    wrapper.style.background     = "#ffffff";
    wrapper.style.padding        = "25px";
    wrapper.style.borderRadius   = "20px";

    // Label
    const title       = document.createElement("p");
    title.innerText   = data.label || "Graph";
    title.style.cssText = "font-weight:bold;color:#333;margin-bottom:10px;font-size:14px;";
    wrapper.appendChild(title);

    const canvas    = document.createElement("canvas");
    canvas.height   = 500;
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    const points = data.x.map((x, i) => ({ x, y: data.y[i] }));

    new Chart(canvas, {
        type: "line",
        data: {
            datasets: [{
                data:        points,
                borderColor: "#2c7be5",
                borderWidth: 3,
                pointRadius: 0,
                tension:     0.25
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `y = ${ctx.parsed.y.toFixed(3)}`
                    }
                }
            },
            scales: {
                x: {
                    type:  "linear",
                    min:   -10,
                    max:   10,
                    title: { display: true, text: "x", color: "#333", font: { size: 14, weight: "bold" } },
                    grid:  { color: "#e0e0e0" },
                    ticks: { stepSize: 1, color: "#555" },
                    border: { display: true, color: "#000", width: 3 }
                },
                y: {
                    min:   data.y_min,
                    max:   data.y_max,
                    title: { display: true, text: "y", color: "#333", font: { size: 14, weight: "bold" } },
                    grid:  { color: "#e0e0e0" },
                    ticks: { color: "#555" },
                    border: { display: true, color: "#000", width: 3 }
                }
            }
        }
    });
}

// ── TYPING ────────────────────────────────────────────────────────────────────
function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    const div       = document.createElement("div");
    div.className   = "message " + role;
    div.innerText   = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById("chatContainer");
    const typing    = document.createElement("div");
    typing.id       = "typing";
    typing.className = "message assistant";
    typing.innerText = "Typing...";
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
}

