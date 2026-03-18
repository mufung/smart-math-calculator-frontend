 // ============================================================
// renderer.js — Message rendering for Math AI Assistant
// Handles: Plain messages, images, typing, graph wrapper
// Path 1 + Path 2 updates
// ============================================================

// ── CONFIGURE MARKED.JS ──────────────────────────────────────
function configureMarked() {
    if (typeof marked === "undefined") return;
    marked.setOptions({
        breaks:    true,
        gfm:       true,
        headerIds: false,
        mangle:    false
    });
}

// ── ADD USER MESSAGE ─────────────────────────────────────────
function addUserMessage(text) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const div     = document.createElement("div");
    div.className = "message user";
    div.innerText = text;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ── ADD PLAIN MESSAGE (non-math, non-markdown) ────────────────
function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const div            = document.createElement("div");
    div.className        = "message " + role;
    div.style.whiteSpace = "pre-line";
    div.innerText        = text;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ── ADD MARKDOWN MESSAGE (no LaTeX) ──────────────────────────
// Used for simple system messages, loading states etc.
function addMarkdownMessage(text, role = "assistant") {
    // Always route through full math+markdown renderer
    // from math-renderer.js
    return addMathMarkdownMessage(text, role);
}

// ── ADD IMAGE TO CHAT ─────────────────────────────────────────
function addImageToChat(dataUrl, s3Url = null) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const wrapper     = document.createElement("div");
    wrapper.className = "message assistant image-message";

    const img         = document.createElement("img");
    img.src           = s3Url || dataUrl || "";
    img.alt           = "Generated image";
    img.className     = "chat-image";
    img.title         = "Click to enlarge";
    img.onclick       = () => window.open(img.src, "_blank");
    img.onerror       = () => {
        if (s3Url && dataUrl && img.src !== dataUrl) {
            img.src = dataUrl;
        } else {
            wrapper.innerText = "Image could not be displayed.";
        }
    };

    wrapper.appendChild(img);

    // Download button
    const downloadBtn     = document.createElement("button");
    downloadBtn.className = "image-download-btn";
    downloadBtn.innerText = "⬇ Download";
    downloadBtn.onclick   = () => {
        const a    = document.createElement("a");
        a.href     = img.src;
        a.download = "math-ai-image.png";
        a.click();
    };
    wrapper.appendChild(downloadBtn);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    return wrapper;
}

// ── SHOW TYPING INDICATOR ─────────────────────────────────────
function showTyping() {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    removeTyping();

    const el     = document.createElement("div");
    el.id        = "typing";
    el.className = "message assistant typing-msg";
    el.innerHTML = `
        <div class="typing-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
        <span class="typing-label">Math AI is thinking...</span>
    `;

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

// ── REMOVE TYPING INDICATOR ───────────────────────────────────
function removeTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
}

// ── CREATE GRAPH WRAPPER ──────────────────────────────────────
function createGraphWrapper(label, expression) {
    const container = document.getElementById("chatContainer");
    if (!container) return null;

    const wrapper      = document.createElement("div");
    wrapper.className  = "message assistant graph-wrapper";

    const titleBar     = document.createElement("div");
    titleBar.className = "graph-title-bar";
    titleBar.innerHTML = `
        <span class="graph-icon">📈</span>
        <span class="graph-title">${escapeHtml(label || "Graph")}</span>
    `;
    wrapper.appendChild(titleBar);

    const canvasBox     = document.createElement("div");
    canvasBox.className = "graph-canvas-box";
    const canvas        = document.createElement("canvas");
    canvasBox.appendChild(canvas);
    wrapper.appendChild(canvasBox);

    const footer      = document.createElement("div");
    footer.className  = "graph-footer";
    footer.innerText  = `f(x) = ${expression || label}`;
    wrapper.appendChild(footer);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    return canvas;
}

// ── WELCOME MESSAGE ───────────────────────────────────────────
function showWelcomeMessage() {
    const welcomeText = `# Welcome to Math AI Assistant! 🎓

Hello! I am your personal math tutor, built for **HighupWeb Academy, Cameroon**.

## What I can help you with:
- **Algebra** — equations, inequalities, polynomials
- **Geometry** — shapes, area, volume, angles  
- **Trigonometry** — $\\sin$, $\\cos$, $\\tan$, identities
- **Calculus** — derivatives, integrals, limits
- **Statistics** — probability, mean, median, mode

---

### Example math I can render:
The quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

Pythagorean theorem: $a^2 + b^2 = c^2$

---

### How I work:
1. I start from the **basics** of any topic
2. I explain **why** each step is done
3. I ask if you understand before moving on
4. I verify every answer for accuracy

**Go ahead — ask me any math question!** 🚀`;

    addMathMarkdownMessage(welcomeText);
}

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
