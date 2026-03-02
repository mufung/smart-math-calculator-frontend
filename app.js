  const CHAT_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";

let sessionId = localStorage.getItem("sessionId");

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";

    showTyping();

    const isGraphRequest = /graph|plot|draw|circle|square|triangle|angle/i.test(message);

    try {
        await handleChat(message);
    } catch (err) {
        removeTyping();
        addMessage("Server error.", "assistant");
        console.error(err);
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

    // If AI returned diagram/image base64, show it
    if (data.structured?.image_base64) {
        addDiagram(data.structured.image_base64);
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

function addDiagram(base64Image) {
    const container = document.getElementById("chatContainer");
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";
    wrapper.style.background = "#ffffff";
    wrapper.style.padding = "25px";
    wrapper.style.borderRadius = "20px";

    const img = document.createElement("img");
    img.src = `data:image/png;base64,${base64Image}`;
    wrapper.appendChild(img);

    container.appendChild(wrapper);
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
