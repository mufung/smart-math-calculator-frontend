  const API_URL = "YOUR_API_GATEWAY_URL";

async function sendMessage() {
    const input = document.getElementById("user-input");
    const message = input.value.trim();

    if (!message) return;

    addUserMessage(message);
    input.value = "";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (data.type === "graph") {
        addBotGraph(data.graph_data, data.expression);
    } else {
        addBotMessage(data.response);
    }
}

function addUserMessage(text) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div class="message user">${text}</div>`;
    scrollBottom();
}

function addBotMessage(text) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div class="message bot">${text}</div>`;
    scrollBottom();
}

function addBotGraph(graphData, expression) {
    const chatBox = document.getElementById("chat-box");

    const canvasId = "chart-" + Date.now();

    chatBox.innerHTML += `
        <div class="message bot">
            <div>Graph of ${expression}</div>
            <canvas id="${canvasId}"></canvas>
        </div>
    `;

    const ctx = document.getElementById(canvasId).getContext("2d");

    new Chart(ctx, {
        type: "line",
        data: {
            labels: graphData.x,
            datasets: [{
                label: expression,
                data: graphData.y,
                borderWidth: 2,
                fill: false
            }]
        }
    });

    scrollBottom();
}

function scrollBottom() {
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTop = chatBox.scrollHeight;
}
