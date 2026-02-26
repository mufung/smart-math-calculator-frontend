 const API_URL = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";

let sessionId = localStorage.getItem("sessionId");

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";

    showTyping();

    try {
        const res = await fetch(API_URL, {
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
    } catch (error) {
        removeTyping();
        addMessage("Error: Could not connect to the server.", "assistant");
        console.error(error);
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
