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
        addMessage("Error: Could not connect to the server.", "assistant");
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
        addGraph(data.x, data.y);
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

function addGraph(xValues, yValues) {

    const container = document.getElementById("chatContainer");

    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = "20px";
    wrapper.style.borderRadius = "16px";

    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    const points = xValues.map((x, i) => ({
        x: x,
        y: yValues[i]
    }));

    new Chart(canvas, {
        type: "line",
        data: {
            datasets: [
                {
                    data: points,
                    borderColor: "#16a085",
                    borderWidth: 4,
                    pointRadius: 0,
                    tension: 0.3
                },
                {
                    label: "Origin",
                    data: [{ x: 0, y: 0 }],
                    backgroundColor: "red",
                    pointRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    type: "linear",
                    min: -10,
                    max: 10,
                    grid: {
                        color: "#bfe8f5",
                        lineWidth: 1
                    },
                    ticks: {
                        stepSize: 2,
                        color: "#000"
                    },
                    border: {
                        display: true,
                        color: "#000",
                        width: 4
                    }
                },
                y: {
                    min: -10,
                    max: 100,
                    grid: {
                        color: "#bfe8f5",
                        lineWidth: 1
                    },
                    ticks: {
                        stepSize: 20,
                        color: "#000"
                    },
                    border: {
                        display: true,
                        color: "#000",
                        width: 4
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
