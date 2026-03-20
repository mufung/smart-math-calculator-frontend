 // ============================================================
// renderer.js — Message rendering
// Safe wrappers — math-renderer.js must load first
// ============================================================

function configureMarked() {
    if (typeof marked === "undefined") return;
    marked.setOptions({
        breaks:    true,
        gfm:       true,
        headerIds: false,
        mangle:    false
    });
}

function safeAddMathMarkdown(text, role) {
    role = role || "assistant";
    if (typeof addMathMarkdownMessage === "function") {
        return addMathMarkdownMessage(text, role);
    }
    var container = document.getElementById("chatContainer");
    if (!container) return null;
    var div       = document.createElement("div");
    div.className = "message " + role + " markdown-message";
    div.innerText = text || "";
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

function addUserMessage(text) {
    var container = document.getElementById("chatContainer");
    if (!container) return;
    var div       = document.createElement("div");
    div.className = "message user";
    div.innerText = text || "";
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addMessage(text, role) {
    var container = document.getElementById("chatContainer");
    if (!container) return;
    var div            = document.createElement("div");
    div.className      = "message " + (role || "assistant");
    div.style.whiteSpace = "pre-line";
    div.innerText      = text || "";
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addMarkdownMessage(text, role) {
    return safeAddMathMarkdown(text, role || "assistant");
}

function addImageToChat(dataUrl, s3Url) {
    var container = document.getElementById("chatContainer");
    if (!container) return null;

    var wrapper      = document.createElement("div");
    wrapper.className = "message assistant image-message";

    var img       = document.createElement("img");
    img.alt       = "Generated image";
    img.className = "chat-image";
    img.title     = "Click to enlarge";

    var primary  = dataUrl || s3Url || "";
    var fallback = (dataUrl && s3Url && dataUrl !== s3Url) ? s3Url : null;
    var attempts = 0;

    img.src = primary;

    img.onerror = function() {
        attempts++;
        if (attempts === 1 && fallback) {
            img.src = fallback;
        } else if (attempts === 1 && s3Url && img.src !== s3Url) {
            img.src = s3Url;
        } else {
            wrapper.innerHTML =
                "<div class='image-error'>" +
                    "<span>🖼️</span>" +
                    "<span>Image could not be loaded</span>" +
                    (s3Url
                        ? "<a href='" + s3Url +
                          "' target='_blank' class='image-link'>Open in new tab</a>"
                        : "") +
                "</div>";
        }
    };

    img.onclick = function() {
        var url = img.src || s3Url || dataUrl;
        if (url) window.open(url, "_blank");
    };

    wrapper.appendChild(img);

    var downloadBtn      = document.createElement("button");
    downloadBtn.className = "image-download-btn";
    downloadBtn.innerText = "⬇ Download";
    downloadBtn.onclick   = function() {
        var a      = document.createElement("a");
        a.href     = img.src || s3Url || dataUrl || "";
        a.download = "math-ai-image.png";
        a.click();
    };
    wrapper.appendChild(downloadBtn);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return wrapper;
}

function showTyping() {
    var container = document.getElementById("chatContainer");
    if (!container) return;
    removeTyping();
    var el       = document.createElement("div");
    el.id        = "typing";
    el.className = "message assistant typing-msg";
    el.innerHTML =
        "<div class='typing-dots'>" +
            "<span class='dot'></span>" +
            "<span class='dot'></span>" +
            "<span class='dot'></span>" +
        "</div>" +
        "<span class='typing-label'>Math AI is thinking...</span>";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    var el = document.getElementById("typing");
    if (el) el.remove();
}

function createGraphWrapper(label, expression) {
    var container = document.getElementById("chatContainer");
    if (!container) return null;

    var wrapper       = document.createElement("div");
    wrapper.className = "message assistant graph-wrapper";

    var titleBar       = document.createElement("div");
    titleBar.className = "graph-title-bar";
    titleBar.innerHTML =
        "<span class='graph-icon'>📈</span>" +
        "<span class='graph-title'>" + escapeHtml(label || "Graph") + "</span>";
    wrapper.appendChild(titleBar);

    var canvasBox       = document.createElement("div");
    canvasBox.className = "graph-canvas-box";
    var canvas          = document.createElement("canvas");
    canvasBox.appendChild(canvas);
    wrapper.appendChild(canvasBox);

    var footer       = document.createElement("div");
    footer.className = "graph-footer";
    footer.innerText = "f(x) = " + (expression || label || "");
    wrapper.appendChild(footer);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return canvas;
}

function showWelcomeMessage() {
    var welcomeText =
        "# Welcome to Math AI Assistant! 🎓\n\n" +
        "Hello! I am your personal math tutor, built for **HighupWeb Academy, Cameroon**.\n\n" +
        "## What I can help you with:\n" +
        "- **Algebra** — equations, inequalities, polynomials\n" +
        "- **Geometry** — shapes, area, volume, angles\n" +
        "- **Trigonometry** — $\\sin$, $\\cos$, $\\tan$, identities\n" +
        "- **Calculus** — derivatives, integrals, limits\n" +
        "- **Statistics** — probability, mean, median, mode\n" +
        "- **Differential Equations** — ODE, PDE, Laplace transforms\n" +
        "- **Linear Algebra** — matrices, eigenvalues, vectors\n\n" +
        "---\n\n" +
        "### Example math I can render:\n" +
        "Quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n" +
        "Pythagorean theorem: $a^2 + b^2 = c^2$\n\n" +
        "---\n\n" +
        "### How I work:\n" +
        "1. I start from the **basics** of any topic\n" +
        "2. I explain **why** each step is done\n" +
        "3. 🔬 **SymPy** computes exact symbolic answers\n" +
        "4. **W|A** Wolfram Alpha certifies complex problems\n" +
        "5. ✅ Every answer triple-verified before you see it\n" +
        "6. 🎤 Speak your questions using the mic button\n\n" +
        "**Go ahead — ask me any math question!** 🚀";

    safeAddMathMarkdown(welcomeText, "assistant");
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
