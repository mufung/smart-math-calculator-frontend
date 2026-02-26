 const CHAT_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";

let sessionId = localStorage.getItem("sessionId");

// -----------------------------
// Send Message
// -----------------------------

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";
    showTyping();

    const isGraphRequest = /graph|plot|draw/i.test(message);

    try {
        if (isGraphRequest) {
            await handleGraph(message);
        } else {
            await handleChat(message);
        }
    } catch (error) {
        removeTyping();
        addMessage("Error connecting to server.", "assistant");
        console.error(error);
    }
}

// -----------------------------
// Chat
// -----------------------------

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

// -----------------------------
// Graph
// -----------------------------

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

// -----------------------------
// Render Graph Properly
// -----------------------------

function addGraph(data) {

    const container = document.getElementById("chatContainer");

    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = "10px";
    wrapper.style.borderRadius = "12px";

    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    const points = data.x.map((x, i) => ({
        x: x,
        y: data.y[i]
    }));

    new Chart(canvas, {
        type: "line",
        data: {
            datasets: [
                {
                    data: points,
                    borderColor: "#1abc9c",
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    type: "linear",
                    min: data.xmin,
                    max: data.xmax,
                    grid: {
                        color: "#7ec8e3",
                        lineWidth: 1
                    },
                    ticks: {
                        stepSize: 1,
                        color: "#000"
                    },
                    border: {
                        display: true,
                        color: "#000",
                        width: 3
                    }
                },
                y: {
                    min: data.xmin,
                    max: data.xmax,
                    grid: {
                        color: "#7ec8e3",
                        lineWidth: 1
                    },
                    ticks: {
                        stepSize: 1,
                        color: "#000"
                    },
                    border: {
                        display: true,
                        color: "#ff6600",
                        width: 4
                    }
                }
            }
        }
    });
}

// -----------------------------

function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    const div = document.createElement("div");
    div.className = "message " + role;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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
