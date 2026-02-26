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
        body: JSON.stringify({
            message,
            sessionId
        })
    });

    let data = await res.json();

    // Handle API Gateway proxy format
    if (data.body) {
        data = JSON.parse(data.body);
    }

    sessionId = data.sessionId || sessionId;
    if (sessionId) {
        localStorage.setItem("sessionId", sessionId);
    }

    removeTyping();

    addMessage(data.reply || "No response", "assistant");
}

async function handleGraph(message) {

    let expression = message;

    // Extract expression after "of"
    const match = message.match(/of (.*)/i);
    if (match) expression = match[1];

    const res = await fetch(GRAPH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            expression: expression
        })
    });

    let data = await res.json();

    if (data.body) {
        data = JSON.parse(data.body);
    }

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

    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    new Chart(canvas, {
        type: "line",
        data: {
            labels: xValues,
            datasets: [{
                data: yValues,
                borderWidth: 2,
                fill: false,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
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
