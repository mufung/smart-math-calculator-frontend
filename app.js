const CHAT_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
const GRAPH_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";

let sessionId = localStorage.getItem("sessionId");

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
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = "25px";
    wrapper.style.borderRadius = "20px";

    const canvas = document.createElement("canvas");
    canvas.height = 500;
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
                    grid: {
                        color: "#e0e0e0"
                    },
                    ticks: {
                        stepSize: 1
                    },
                    border: {
                        display: true,
                        color: "#000",
                        width: 3
                    }
                },
                y: {
                    min: data.y_min,
                    max: data.y_max,
                    grid: {
                        color: "#e0e0e0"
                    },
                    ticks: {
                        stepSize: (data.y_max - data.y_min) / 10
                    },
                    border: {
                        display: true,
                        color: "#000",
                        width: 3
                    }
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
