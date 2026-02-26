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

    // Detect graph intent
    const isGraphRequest = /graph|plot|draw/i.test(message);

    try {

        if (isGraphRequest) {
            await handleGraphRequest(message);
        } else {
            await handleChatRequest(message);
        }

    } catch (error) {
        removeTyping();
        addMessage("Error: Could not connect to the server.", "assistant");
        console.error(error);
    }
}

async function handleChatRequest(message) {
    const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            sessionId
        })
    });

    const data = await res.json();

    sessionId = data.sessionId;
    localStorage.setItem("sessionId", sessionId);

    removeTyping();
    addMessage(data.reply, "assistant");
}

async function handleGraphRequest(message) {

    // Extract math expression after "of"
    let expression = message;
    const match = message.match(/of (.*)/i);
    if (match) expression = match[1];

    const res = await fetch(GRAPH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            expression: expression
        })
    });

    const data = await res.json();

    removeTyping();
    addGraphMessage(data.x, data.y);
}

function addMessage(text, role) {
    const container = document.getElementById("chatContainer");

    const div = document.createElement("div");
    div.className = "message " + role;
    div.innerText = text;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addGraphMessage(xValues, yValues) {
    const container = document.getElementById("chatContainer");

    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";

    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    new Chart(canvas, {
        type: "line",
        data: {
            labels: xValues,
            datasets: [{
                label: "Graph",
                data: yValues,
                borderWidth: 2,
                fill: false,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: "white" }
                },
                y: {
                    ticks: { color: "white" }
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
