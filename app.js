const API_URL = "https://7gq8pq0p7a.execute-api.us-west-1.amazonaws.com/prod/chat";

const sessionId = "session-" + Date.now();

async function sendMessage() {
    const messageInput = document.getElementById("message");
    const fileInput = document.getElementById("fileInput");

    let fileBase64 = null;

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function() {
            fileBase64 = reader.result.split(',')[1];
            await sendToAPI(messageInput.value, fileBase64);
        };
        reader.readAsDataURL(file);
    } else {
        await sendToAPI(messageInput.value, null);
    }
}

async function sendToAPI(message, fileBase64) {
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
    displayResponse(data.data);
}

function displayResponse(data) {
    const chatBox = document.getElementById("chat-box");

    chatBox.innerHTML += `<div><b>Answer:</b> ${data.final_answer}</div>`;

    data.steps.forEach(step => {
        chatBox.innerHTML += `<div>• ${step}</div>`;
    });

    if (data.graph_data) {
        drawGraph(data.graph_data);
    }
}

function drawGraph(graphData) {
    const ctx = document.getElementById("graphCanvas");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: graphData.x,
            datasets: [{
                label: 'Graph',
                data: graphData.y
            }]
        }
    });
}