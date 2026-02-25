const API_URL = "https://7gq8pq0p7a.execute-api.us-west-1.amazonaws.com/prod/chat";

const sessionId = "session-" + Date.now();

let currentChart = null;

async function sendMessage() {
    const messageInput = document.getElementById("message");
    const fileInput = document.getElementById("fileInput");

    let fileBase64 = null;

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async function () {
            fileBase64 = reader.result.split(',')[1];
            await sendToAPI(messageInput.value, fileBase64);
        };

        reader.readAsDataURL(file);
    } else {
        await sendToAPI(messageInput.value, null);
    }
}

async function sendToAPI(message, fileBase64) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                sessionId: sessionId,
                file: fileBase64
            })
        });

        const data = await response.json();

        if (!data || !data.data) {
            displayError("Invalid response from server");
            return;
        }

        displayResponse(data.data);

    } catch (error) {
        displayError(error.message);
    }
}

function displayResponse(data) {
    const chatBox = document.getElementById("chat-box");

    let html = "<div class='response-block'>";

    if (data.final_answer) {
        html += `<div class='answer'><b>Final Answer:</b><br>${data.final_answer}</div><br>`;
    }

    if (Array.isArray(data.steps) && data.steps.length > 0) {
        html += "<div><b>Steps:</b></div>";
        data.steps.forEach(step => {
            html += `<div class="step">• ${step}</div>`;
        });
    }

    if (data.explanation) {
        html += `<div class="explanation"><b>Explanation:</b><br>${data.explanation}</div>`;
    }

    if (data.confidence) {
        html += `<div class="confidence"><b>Confidence:</b> ${data.confidence}</div>`;
    }

    html += "</div><hr>";

    chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight;

    renderMathInElement(chatBox);

    if (data.graph_data && data.graph_data.x && data.graph_data.y) {
        drawGraph(data.graph_data);
    }
}

function drawGraph(graphData) {
    const ctx = document.getElementById("graphCanvas");

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graphData.x,
            datasets: [{
                label: 'Graph',
                data: graphData.y
            }]
        },
        options: {
            responsive: true
        }
    });
}

function displayError(message) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div style="color:red;"><b>Error:</b> ${message}</div>`;
}
