const CHAT_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
// ADDED: image support
const IMAGE_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";

let sessionId = localStorage.getItem("sessionId");

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";

    showTyping();

    // ADDED: detect image/shape requests before graph check
    const isImageRequest = /draw|create|generate|shape|square|circle|triangle|hexagon|polygon|rectangle|imagen|picture|image/i.test(message);
    const isGraphRequest  = /graph|plot/i.test(message);

    try {
        if (isImageRequest) {
            // ADDED: route to image handler
            await handleImage(message);
        } else if (isGraphRequest) {
            await handleGraph(message);
        } else {
            await handleChat(message);
        }
    } catch (error) {
        removeTyping();
        addMessage("Server error.", "assistant");
        console.error(error);
    }
}

async function handleChat(message) {
    const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId })
    });

    let data = await res.json();
    if (data.body) data = JSON.parse(data.body);

    sessionId = data.sessionId || sessionId;
    if (sessionId) localStorage.setItem("sessionId", sessionId);

    removeTyping();
    addMessage(data.reply || "No response", "assistant");
}

async function handleGraph(message) {
    let expression = message;
    const match = message.match(/of (.*)/i);
    if (match) expression = match[1];

    const res = await fetch(GRAPH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression })
    });

    let data = await res.json();
    if (data.body) data = JSON.parse(data.body);

    removeTyping();

    if (data.x && data.y) {
        addGraph(data);
    } else {
        addMessage("Could not generate graph.", "assistant");
    }
}

// ADDED: image handler — talks to IMAGE_API, renders result as <img>
async function handleImage(message) {
    // Detect action type from message
    let action = "draw_shape";
    let body   = {};

    const msg = message.toLowerCase();

    if (/ai|imagen|generate|picture/i.test(msg)) {
        // Google Imagen AI
        action = "imagen_ai";
        body   = { action, prompt: message };

    } else if (/graph|plot|function|sin|cos|tan|x\^|x\*\*/.test(msg)) {
        // Math graph
        action = "draw_graph";
        const exprMatch = msg.match(/(?:of|graph|plot)\s+(.*)/i);
        const expression = exprMatch ? exprMatch[1].replace(/\^/g, "**") : "x**2";
        body = { action, expression, x_min: -10, x_max: 10, label: message };

    } else {
        // Shape drawing — detect shape name
        let shape = "square";
        if (/circle/.test(msg))                       shape = "circle";
        else if (/triangle/.test(msg))                shape = "triangle";
        else if (/hexagon/.test(msg))                 shape = "hexagon";
        else if (/rectangle/.test(msg))               shape = "rectangle";
        else if (/polygon/.test(msg))                 shape = "polygon";
        else if (/square/.test(msg))                  shape = "square";

        // Try to extract number of sides
        const sidesMatch = msg.match(/(\d+)\s*side/);
        const sides = sidesMatch ? parseInt(sidesMatch[1]) : 6;

        // Try to extract size
        const sizeMatch = msg.match(/size\s*(\d+)|(\d+)\s*px/);
        const size = sizeMatch ? parseInt(sizeMatch[1] || sizeMatch[2]) : 150;

        // Try to extract color
        const colors = ["red","blue","green","yellow","purple","orange","pink","white","cyan","royalblue"];
        let color = "royalblue";
        for (const c of colors) {
            if (msg.includes(c)) { color = c; break; }
        }

        body = {
            action: "draw_shape",
            shape,
            sides,
            size,
            color,
            outline: "white",
            label: message
        };
    }

    const res = await fetch(IMAGE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    removeTyping();

    // Handle imagen_ai JSON response (contains data_url)
    if (action === "imagen_ai") {
        let data = await res.json();
        if (data.body) data = JSON.parse(data.body);

        if (data.images && data.images.length > 0) {
            addImageFromDataUrl(data.images[0].data_url);
        } else {
            addMessage("Could not generate AI image. " + (data.error || ""), "assistant");
        }
        return;
    }

    // Handle PIL image response (raw base64 PNG)
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType.includes("image/png") || res.ok) {
        let b64 = null;

        // Try JSON first (in case Lambda wraps it)
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            if (json.body) {
                b64 = json.body;
            } else if (json.error) {
                addMessage("Image error: " + json.error, "assistant");
                return;
            }
        } catch (_) {
            // Raw base64
            b64 = text;
        }

        if (b64) {
            addImageFromDataUrl("data:image/png;base64," + b64);
        } else {
            addMessage("Could not render image.", "assistant");
        }
    } else {
        addMessage("Could not generate image.", "assistant");
    }
}

// ADDED: renders a data URL as a visible image in the chat
function addImageFromDataUrl(dataUrl) {
    const container = document.getElementById("chatContainer");
    const wrapper   = document.createElement("div");
    wrapper.className = "message assistant";

    const img = document.createElement("img");
    img.src   = dataUrl;
    img.alt   = "Generated image";
    img.style.maxWidth     = "100%";
    img.style.borderRadius = "12px";
    img.style.marginTop    = "6px";
    img.style.display      = "block";

    wrapper.appendChild(img);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    const div = document.createElement("div");
    div.className = "message " + role;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addGraph(data) {
    const container = document.getElementById("chatContainer");
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";
    wrapper.style.background    = "#ffffff";
    wrapper.style.padding       = "25px";
    wrapper.style.borderRadius  = "20px";

    const canvas = document.createElement("canvas");
    canvas.height = 500;
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    const points = data.x.map((x, i) => ({ x: x, y: data.y[i] }));

    new Chart(canvas, {
        type: "line",
        data: {
            datasets: [{
                data: points,
                borderColor: "#2c7be5",
                borderWidth: 3,
                pointRadius: 0,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    type: "linear",
                    min: -10,
                    max: 10,
                    grid: { color: "#e0e0e0" },
                    ticks: { stepSize: 1 },
                    border: { display: true, color: "#000", width: 3 }
                },
                y: {
                    min: data.y_min,
                    max: data.y_max,
                    grid: { color: "#e0e0e0" },
                    ticks: { stepSize: (data.y_max - data.y_min) / 10 },
                    border: { display: true, color: "#000", width: 3 }
                }
            }
        }
    });
}

function showTyping() {
    const container = document.getElementById("chatContainer");
    const typing = document.createElement("div");
    typing.id = "typing";
    typing.className = "message assistant";
    typing.innerText = "Typing...";
    container.appendChild(typing);
}

function removeTyping() {
    const typing = document.getElementById("typing");
    if (typing) typing.remove();
}
