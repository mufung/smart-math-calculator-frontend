// ============================================================
// app.js — Math AI Assistant — Path 7
// Voice input: record → preview → send or cancel
// ============================================================

var CHAT_API     = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/chat";
var GRAPH_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/graph";
var IMAGE_API    = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/image";
var SESSIONS_API = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/sessions";
var HISTORY_API  = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/history";
var VERIFY_API   = "https://h205wzv2tg.execute-api.us-west-1.amazonaws.com/prod/verify";

var sessionId = localStorage.getItem("sessionId") || generateSessionId();
localStorage.setItem("sessionId", sessionId);

window.addEventListener("load", function() {
    initConversation(sessionId);
    initVoice();
    loadSessions();
    showWelcomeMessage();
});

function generateSessionId() {
    return "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function startNewChat() {
    sessionId = generateSessionId();
    localStorage.setItem("sessionId", sessionId);
    clearHistory();
    initConversation(sessionId);
    stopSpeaking();
    cancelRecording();

    var container = document.getElementById("chatContainer");
    if (container) container.innerHTML = "";

    document.querySelectorAll(".chat-item").forEach(function(el) {
        el.classList.remove("active-chat");
    });

    hideQuickReplies();
    showWelcomeMessage();

    if (VoiceState.userInteracted) {
        setTimeout(function() {
            speakText("New chat started. Ask me any math question!");
        }, 400);
    }
}

async function loadSessions() {
    var list = document.getElementById("chatList");
    if (!list) return;
    try {
        list.innerHTML = "<li class='loading-chats'>Loading chats...</li>";
        var res        = await fetch(SESSIONS_API);
        var text       = await res.text();
        var data       = JSON.parse(text);
        var sessions   = data.sessions || [];
        list.innerHTML = "";

        if (sessions.length === 0) {
            list.innerHTML = "<li class='no-chats'>No past chats yet</li>";
            return;
        }

        sessions.forEach(function(session) {
            var li       = document.createElement("li");
            li.className = "chat-item";
            li.dataset.sid = session.sessionId;
            if (session.sessionId === sessionId) li.classList.add("active-chat");

            var date = session.date
                ? new Date(Number(session.date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "";

            li.innerHTML =
                "<span class='chat-item-icon'>💬</span>" +
                "<div class='chat-item-info'>" +
                    "<span class='chat-item-text'>" + escapeHtml(session.title) + "</span>" +
                    "<span class='chat-item-date'>" + date + "</span>" +
                "</div>";

            li.addEventListener("click", function() { loadHistory(session.sessionId, li); });
            list.appendChild(li);
        });

        console.log("Loaded " + sessions.length + " sessions");
    } catch (err) {
        console.error("Sessions error:", err);
        list.innerHTML = "<li class='no-chats'>Could not load chats</li>";
    }
}

async function loadHistory(sid, clickedEl) {
    try {
        sessionId = sid;
        localStorage.setItem("sessionId", sid);
        clearHistory();
        initConversation(sid);
        stopSpeaking();
        cancelRecording();

        document.querySelectorAll(".chat-item").forEach(function(el) {
            el.classList.remove("active-chat");
        });
        if (clickedEl) clickedEl.classList.add("active-chat");

        var container = document.getElementById("chatContainer");
        if (container) container.innerHTML = "";
        hideQuickReplies();
        addMathMarkdownMessage("Loading chat history...");

        var res  = await fetch(HISTORY_API + "?sessionId=" + encodeURIComponent(sid));
        var data = await res.json();
        if (container) container.innerHTML = "";

        var messages = data.messages || [];
        if (messages.length === 0) {
            addMathMarkdownMessage("No messages found in this chat.");
            return;
        }

        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            if (!msg.text && !msg.s3_url && !msg.graph_data) continue;

            if (msg.role === "user") {
                addUserMessage(msg.text);
                addToHistory("user", msg.text);
            } else if (msg.type === "image") {
                if (msg.s3_url) {
                    addImageToChat(msg.s3_url, msg.s3_url);
                } else {
                    addMathMarkdownMessage("🎨 Image generated here");
                }
                addToHistory("assistant", msg.text || "[Image]");
            } else if (msg.type === "graph") {
                if (msg.graph_data && msg.graph_data.x && msg.graph_data.y) {
                    addGraph(msg.graph_data);
                } else {
                    addMathMarkdownMessage("📈 " + msg.text);
                }
                addToHistory("assistant", msg.text || "[Graph]");
            } else {
                addMathMarkdownMessage(msg.text);
                addToHistory("assistant", msg.text);
            }
        }

        var cont = document.getElementById("chatContainer");
        if (cont) cont.scrollTop = cont.scrollHeight;

    } catch (err) {
        console.error("History error:", err);
        addMathMarkdownMessage("Could not load chat history. Please try again.");
    }
}

async function sendMessage() {
    var input = document.getElementById("messageInput");
    if (!input) return;
    var message = input.value.trim();
    if (!message) return;

    // Mark user as interacted
    if (!VoiceState.userInteracted) {
        VoiceState.userInteracted = true;
        dismissInteractionPrompt();
    }

    stopSpeaking();
    hideRecordingPanel();

    addUserMessage(message);
    input.value = "";
    hideQuickReplies();
    showTyping();
    detectTopic(message);

    var isConfused   = isConfusionMessage(message);
    var isUnderstood = isUnderstandingMessage(message);
    if (isConfused)   { recordClarificationRequest(); showClarificationIndicator(); }
    if (isUnderstood) { recordUnderstanding(); }

    var isGraphRequest = /\b(graph|plot|chart|sketch)\b/i.test(message);
    var isImageRequest =
        /^(draw|create|sketch|show)\s.*(square|circle|triangle|hexagon|polygon|rectangle|pentagon|octagon|shape)/i.test(message) ||
        /\b(imagen|generate image|ai image|ai picture)\b/i.test(message);

    try {
        if (isGraphRequest && !isImageRequest) {
            await handleGraph(message);
        } else if (isImageRequest) {
            await handleImage(message);
        } else {
            await handleChat(message);
        }
        setTimeout(loadSessions, 2000);
    } catch (error) {
        removeTyping();
        addMathMarkdownMessage("Something went wrong. Please try again.");
        console.error("sendMessage error:", error);
    }
}

async function handleChat(message) {
    var contextAdd = getContextualInstruction();
    var history    = getFormattedHistory();

    var res = await fetch(CHAT_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: message, sessionId: sessionId, history: history, contextAdd: contextAdd })
    });

    var data = await res.json();
    if (typeof data.body === "string") data = JSON.parse(data.body);

    sessionId = data.sessionId || sessionId;
    localStorage.setItem("sessionId", sessionId);

    var reply = data.reply || "No response received.";
    addToHistory("user",      message);
    addToHistory("assistant", reply);

    removeTyping();
    removeClarificationIndicator();

    // addMathMarkdownMessage now adds a 🔊 button per response automatically
    var msgWrapper = addMathMarkdownMessage(reply);
    setTimeout(showQuickReplies, 400);

    // Auto-speak the reply via global voice
    setTimeout(function() { speakText(reply); }, 200);

    verifyAndShowBadge(message, reply, msgWrapper);
}

async function verifyAndShowBadge(question, aiAnswer, messageWrapper) {
    try {
        if (!messageWrapper) return;
        var spinner      = document.createElement("div");
        spinner.className = "verify-spinner";
        spinner.innerHTML = "<span class='verify-dot'></span> Verifying answer...";
        messageWrapper.appendChild(spinner);

        var res = await fetch(VERIFY_API, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                question:  question,
                ai_answer: aiAnswer.substring(0, 1000),
                topic:     detectTopic(question) || "general"
            })
        });

        var raw    = await res.json();
        var result = raw;
        if (typeof result.body === "string") result = JSON.parse(result.body);
        spinner.remove();
        if (result && result.badge) addVerificationBadge(messageWrapper, result);

    } catch (err) {
        console.warn("Verification silent fail:", err);
    }
}

function addVerificationBadge(messageWrapper, result) {
    if (!messageWrapper || !result) return;
    var badge      = document.createElement("div");
    badge.className = "verification-badge " + (result.badge_class || "badge-info");
    badge.innerHTML =
        "<span class='badge-icon'>" + (result.badge || "ℹ️") + "</span>" +
        "<span class='badge-label'>" + escapeHtml(result.badge_text || "Checked") + "</span>" +
        (result.computed_answer ? "<span class='badge-answer'>= " + escapeHtml(result.computed_answer) + "</span>" : "") +
        "<span class='badge-details-toggle' onclick='toggleBadgeDetails(this)'>▼</span>" +
        "<div class='badge-details hidden'>" +
            escapeHtml(result.message || "") +
            (result.confidence ? "<span class='badge-confidence'>Confidence: " + result.confidence + "</span>" : "") +
        "</div>";
    messageWrapper.appendChild(badge);
}

function toggleBadgeDetails(btn) {
    var details = btn.nextElementSibling;
    if (!details) return;
    details.classList.toggle("hidden");
    btn.textContent = details.classList.contains("hidden") ? "▼" : "▲";
}

async function handleGraph(message) {
    var res = await fetch(GRAPH_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ expression: message, sessionId: sessionId })
    });
    var data = await res.json();
    if (typeof data.body === "string") data = JSON.parse(data.body);
    removeTyping();

    if (data.x && data.y) {
        addToHistory("user",      message);
        addToHistory("assistant", "Graph plotted: " + (data.label || message));
        addGraph(data);
        setTimeout(function() {
            speakText("I have plotted the graph of " + (data.label || message) + ". You can see the curve on your screen. Do you have any questions about what you see?");
        }, 600);
    } else {
        addMathMarkdownMessage("Could not generate graph.\n\n**Try these:**\n- plot x squared\n- graph sin(x)\n- plot x cubed minus 2x");
    }
}

async function handleImage(message) {
    var msg  = message.toLowerCase();
    var body = {};

    if (/imagen|generate image|ai image|ai picture/i.test(msg)) {
        body = { action: "imagen_ai", prompt: message, sessionId: sessionId };
    } else {
        var shape = "square";
        if      (/circle/.test(msg))    shape = "circle";
        else if (/triangle/.test(msg))  shape = "triangle";
        else if (/hexagon/.test(msg))   shape = "hexagon";
        else if (/rectangle/.test(msg)) shape = "rectangle";
        else if (/pentagon/.test(msg))  shape = "pentagon";
        else if (/octagon/.test(msg))   shape = "octagon";
        else if (/polygon/.test(msg))   shape = "polygon";

        var sidesMatch = msg.match(/(\d+)\s*side/);
        var sides      = sidesMatch ? parseInt(sidesMatch[1]) : 6;
        var sizeMatch  = msg.match(/size\s*(\d+)|(\d+)\s*px/);
        var size       = sizeMatch ? parseInt(sizeMatch[1] || sizeMatch[2]) : 150;

        var colorList  = ["red","blue","green","yellow","purple","orange","pink","cyan","royalblue","gold","white"];
        var color      = "royalblue";
        for (var ci = 0; ci < colorList.length; ci++) {
            if (msg.includes(colorList[ci])) { color = colorList[ci]; break; }
        }
        body = { action: "draw_shape", shape: shape, sides: sides, size: size, color: color, outline: "white", label: message, sessionId: sessionId };
    }

    var res = await fetch(IMAGE_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body)
    });
    removeTyping();

    try {
        var data = JSON.parse(await res.text());
        if (typeof data.body === "string") data = JSON.parse(data.body);

        var displayUrl = null;
        var s3Url      = data.s3_url || null;

        if      (data.data_url)                    displayUrl = data.data_url;
        else if (data.image)                       displayUrl = "data:image/png;base64," + data.image;
        else if (data.images && data.images[0])   {
            displayUrl = data.images[0].data_url;
            s3Url      = data.images[0].s3_url || s3Url;
        } else if (s3Url)                          displayUrl = s3Url;

        if (displayUrl) {
            addImageToChat(displayUrl, s3Url);
            addToHistory("user",      message);
            addToHistory("assistant", "[Image generated]");
            setTimeout(function() {
                speakText("There you go! I have drawn the " + (body.shape || "image") + " for you on your screen.");
            }, 500);
        } else {
            addMathMarkdownMessage("Could not generate image: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        console.error("Image error:", e);
        addMathMarkdownMessage("Could not display image. Please try again.");
    }
}

function addGraph(data) {
    var canvas = createGraphWrapper(data.label, data.expression);
    if (!canvas) return;

    var points = [];
    var xArr   = data.x || [];
    var yArr   = data.y || [];

    for (var i = 0; i < xArr.length; i++) {
        var x = Number(xArr[i]);
        var y = yArr[i];
        if (y !== null && y !== undefined && isFinite(Number(y)) && isFinite(x)) {
            points.push({ x: x, y: Number(y) });
        }
    }
    points.sort(function(a, b) { return a.x - b.x; });

    if (points.length === 0) { addMathMarkdownMessage("No valid data points to plot."); return; }

    var allY       = points.map(function(p) { return p.y; });
    var minY       = Math.min.apply(null, allY);
    var maxY       = Math.max.apply(null, allY);
    var yRange     = maxY - minY || 4;
    var yPad       = yRange * 0.20;
    var xMin       = Number(data.x_min !== undefined ? data.x_min : -5);
    var xMax       = Number(data.x_max !== undefined ? data.x_max :  5);
    var yMin       = Number(data.y_min !== undefined ? data.y_min : minY - yPad);
    var yMax       = Number(data.y_max !== undefined ? data.y_max : maxY + yPad);

    if (yMin > 0) yMin = -(yMax * 0.15);
    if (yMax < 0) yMax = -(yMin * 0.15);

    var xRange2    = xMax - xMin;
    var xTickStep  = xRange2 <= 4 ? 0.5 : xRange2 <= 8 ? 1 : xRange2 <= 16 ? 2 : 5;
    var yDispRange = yMax - yMin;
    var yTickStep  = yDispRange <= 4 ? 0.5 : yDispRange <= 8 ? 1 : yDispRange <= 16 ? 2 : yDispRange <= 40 ? 5 : 10;

    new Chart(canvas, {
        type: "scatter",
        data: { datasets: [{
            data: points, showLine: true,
            borderColor: "#2563eb", borderWidth: 2.5,
            pointRadius: 0, pointHoverRadius: 5,
            tension: 0, fill: false
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 700 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e3a5f", titleColor: "#fff", bodyColor: "#93c5fd",
                    padding: 10, cornerRadius: 8,
                    callbacks: {
                        title: function() { return data.label || "f(x)"; },
                        label: function(ctx) { return "x = " + ctx.parsed.x.toFixed(2) + ",  y = " + ctx.parsed.y.toFixed(3); }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear", min: xMin, max: xMax, position: "center",
                    title: { display: true, text: "x", color: "#1e293b", font: { size: 13, weight: "bold" } },
                    grid:  { color: function(ctx) { return ctx.tick.value === 0 ? "#000" : "#e5e7eb"; }, lineWidth: function(ctx) { return ctx.tick.value === 0 ? 2 : 1; } },
                    ticks: { color: "#374151", stepSize: xTickStep, font: { size: 11, family: "monospace" }, callback: function(val) { return val === 0 ? "0" : Number.isInteger(val) ? val : val.toFixed(1); } },
                    border: { display: true, color: "#111827", width: 2 }
                },
                y: {
                    type: "linear", min: yMin, max: yMax, position: "center",
                    title: { display: true, text: "y", color: "#1e293b", font: { size: 13, weight: "bold" } },
                    grid:  { color: function(ctx) { return ctx.tick.value === 0 ? "#000" : "#e5e7eb"; }, lineWidth: function(ctx) { return ctx.tick.value === 0 ? 2 : 1; } },
                    ticks: { color: "#374151", stepSize: yTickStep, font: { size: 11, family: "monospace" }, callback: function(val) { return val === 0 ? "0" : Number.isInteger(val) ? val : val.toFixed(1); } },
                    border: { display: true, color: "#111827", width: 2 }
                }
            }
        }
    });
}

function showClarificationIndicator() {
    var app = document.querySelector(".app");
    if (!app) return;
    removeClarificationIndicator();
    var banner      = document.createElement("div");
    banner.id       = "clarificationBanner";
    banner.className = "clarification-banner";
    banner.innerHTML = "<span class='clarification-icon'>🔄</span><span>Re-explaining with a simpler approach...</span>";
    var inputArea    = document.querySelector(".inputArea");
    if (inputArea) app.insertBefore(banner, inputArea);
}

function removeClarificationIndicator() {
    var el = document.getElementById("clarificationBanner");
    if (el) el.remove();
}

function showQuickReplies() {
    var el = document.getElementById("quickReplies");
    if (el) el.classList.remove("hidden");
}

function hideQuickReplies() {
    var el = document.getElementById("quickReplies");
    if (el) el.classList.add("hidden");
}

function quickReply(text) {
    var inp = document.getElementById("messageInput");
    if (inp) inp.value = text;
    hideQuickReplies();
    sendMessage();
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
