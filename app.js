 const API_URL = "https://7gq8pq0p7a.execute-api.us-west-1.amazonaws.com/prod/chat";

const sessionId = "session-" + Date.now();

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

    let html = "";

    // Final Answer
    if (data.final_answer) {
        html += `<div><b>Answer:</b> ${escapeHTML(data.final_answer)}</div>`;
    }

    // Steps
    if (Array.isArray(data.steps)) {
        data.steps.forEach(step => {

            // Force convert to string (prevents [object Object])
            const safeStep = typeof step === "string"
                ? step
                : JSON.stringify(step);

            html += `<div>• ${escapeHTML(safeStep)}</div>`;
        });
    }

    chatBox.innerHTML += html;

    // Render graph if available
    if (data.graph_data && data.graph_data.x && data.graph_data.y) {
        drawGraph(data.graph_data);
    }

    // Re-render MathJax if used
    if (window.MathJax) {
        MathJax.typeset();
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

function displayError(message) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div style="color:red;"><b>Error:</b> ${escapeHTML(message)}</div>`;
}

// Prevent encoding issues
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
