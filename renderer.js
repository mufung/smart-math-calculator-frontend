// ============================================================
// renderer.js — All message rendering for Math AI Assistant
// Handles: Markdown, message creation, typing indicator
// Path 1: Markdown Rendering
// ============================================================

// ── WAIT FOR MARKED AND DOMPURIFY TO LOAD ────────────────────
function isRendererReady() {
    return typeof marked !== "undefined" && typeof DOMPurify !== "undefined";
}

// ── CONFIGURE MARKED.JS ──────────────────────────────────────
function configureMarked() {
    if (typeof marked === "undefined") return;

    marked.setOptions({
        breaks:   true,    // \n becomes <br>
        gfm:      true,    // GitHub Flavored Markdown
        headerIds: false,  // No auto IDs on headings
        mangle:    false
    });
}

// ── RENDER MARKDOWN TO SAFE HTML ─────────────────────────────
function renderMarkdown(text) {
    if (!isRendererReady()) {
        // Fallback if libraries not loaded yet
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
    }

    try {
        // Step 1: Parse markdown to HTML
        const rawHtml = marked.parse(text);

        // Step 2: Sanitize to prevent XSS attacks
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                "p", "br", "strong", "em", "b", "i", "u",
                "h1", "h2", "h3", "h4", "h5", "h6",
                "ul", "ol", "li",
                "blockquote", "code", "pre",
                "hr", "table", "thead", "tbody", "tr", "th", "td",
                "span", "div", "sup", "sub"
            ],
            ALLOWED_ATTR: ["class", "style"]
        });

        return cleanHtml;

    } catch (err) {
        console.error("Markdown render error:", err);
        return escapeHtml(text);
    }
}

// ── ADD USER MESSAGE ─────────────────────────────────────────
function addUserMessage(text) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const div           = document.createElement("div");
    div.className       = "message user";
    div.innerText       = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ── ADD ASSISTANT MESSAGE (Plain text fallback) ───────────────
function addMessage(text, role) {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const div            = document.createElement("div");
    div.className        = "message " + role;
    div.style.whiteSpace = "pre-line";
    div.innerText        = text;
    container.appendChild(div);
    container.scrollTop  = container.scrollHeight;
}

// ── ADD MARKDOWN MESSAGE (Main AI response) ───────────────────
function addMarkdownMessage(text, role = "assistant") {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const wrapper     = document.createElement("div");
    wrapper.className = `message ${role} markdown-message`;

    // Configure marked each time (safe to call repeatedly)
    configureMarked();

    // Render markdown to sanitized HTML
    wrapper.innerHTML = renderMarkdown(text);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    return wrapper;
}

// ── ADD IMAGE TO CHAT ─────────────────────────────────────────
function addImageToChat(dataUrl, s3Url = null) {
    const container   = document.getElementById("chatContainer");
    if (!container) return;

    const wrapper     = document.createElement("div");
    wrapper.className = "message assistant image-message";

    const img         = document.createElement("img");

    // Use S3 URL if available (for persistence), else use dataUrl
    img.src           = s3Url || dataUrl;
    img.alt           = "Generated image";
    img.className     = "chat-image";
    img.title         = "Click to enlarge";
    img.onclick       = () => window.open(img.src, "_blank");
    img.onerror       = () => {
        // If S3 URL fails, try dataUrl as fallback
        if (s3Url && img.src !== dataUrl && dataUrl) {
            img.src = dataUrl;
        } else {
            wrapper.innerText = "Image could not be displayed.";
        }
    };

    wrapper.appendChild(img);

    // Add download button
    const downloadBtn       = document.createElement("button");
    downloadBtn.className   = "image-download-btn";
    downloadBtn.innerText   = "⬇ Download";
    downloadBtn.onclick     = () => {
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

    // Remove existing typing indicator first
    removeTyping();

    const el      = document.createElement("div");
    el.id         = "typing";
    el.className  = "message assistant typing-msg";
    el.innerHTML  = `
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

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}

// ── ADD GRAPH WRAPPER ─────────────────────────────────────────
function createGraphWrapper(label, expression) {
    const container = document.getElementById("chatContainer");
    if (!container) return null;

    const wrapper         = document.createElement("div");
    wrapper.className     = "message assistant graph-wrapper";

    const titleBar        = document.createElement("div");
    titleBar.className    = "graph-title-bar";
    titleBar.innerHTML    = `
        <span class="graph-icon">📈</span>
        <span class="graph-title">${escapeHtml(label || "Graph")}</span>
    `;
    wrapper.appendChild(titleBar);

    const canvasBox       = document.createElement("div");
    canvasBox.className   = "graph-canvas-box";
    const canvas          = document.createElement("canvas");
    canvasBox.appendChild(canvas);
    wrapper.appendChild(canvasBox);

    const footer          = document.createElement("div");
    footer.className      = "graph-footer";
    footer.innerText      = `f(x) = ${expression || label}`;
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
- **Trigonometry** — sin, cos, tan, identities
- **Calculus** — derivatives, integrals, limits
- **Statistics** — probability, mean, median, mode
- **And much more!**

---

### How I work:
1. I start from the **basics** of any topic
2. I explain **why** each step is done
3. I ask if you understand before moving on
4. I verify every answer for accuracy

**Go ahead — ask me any math question!** 🚀`;

    addMarkdownMessage(welcomeText);
}