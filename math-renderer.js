// ============================================================
// math-renderer.js — LaTeX Math Rendering for Math AI
// Handles: KaTeX rendering, math detection, display math
// Path 2: LaTeX Math Rendering
// ============================================================

// ── WAIT FOR KATEX TO BE READY ────────────────────────────────
function isKatexReady() {
    return typeof window.renderMathInElement !== "undefined"
        && typeof window.katex !== "undefined";
}

// ── RENDER ALL MATH IN AN ELEMENT ────────────────────────────
function renderMathInEl(element) {
    if (!element) return;
    if (!isKatexReady()) {
        // KaTeX not loaded yet — retry after short delay
        setTimeout(() => renderMathInEl(element), 300);
        return;
    }

    try {
        renderMathInElement(element, {
            delimiters: [
                { left: "$$", right: "$$", display: true  },
                { left: "\\[", right: "\\]", display: true  },
                { left: "$",  right: "$",  display: false },
                { left: "\\(", right: "\\)", display: false }
            ],
            throwOnError:    false,
            errorColor:      "#ef4444",
            strict:          false,
            trust:           false,
            output:          "html",
            fleqn:           false  // centered display math
        });
    } catch (err) {
        console.warn("KaTeX render error:", err);
    }
}

// ── RENDER INLINE MATH STRING TO HTML STRING ──────────────────
function renderInlineMath(expression) {
    if (!isKatexReady()) return escapeHtml(expression);
    try {
        return katex.renderToString(expression, {
            throwOnError: false,
            displayMode:  false,
            output:       "html"
        });
    } catch (err) {
        return escapeHtml(expression);
    }
}

// ── RENDER DISPLAY MATH STRING TO HTML STRING ─────────────────
function renderDisplayMath(expression) {
    if (!isKatexReady()) return `<div class="math-display-fallback">${escapeHtml(expression)}</div>`;
    try {
        return katex.renderToString(expression, {
            throwOnError: false,
            displayMode:  true,
            output:       "html"
        });
    } catch (err) {
        return `<div class="math-display-fallback">${escapeHtml(expression)}</div>`;
    }
}

// ── CHECK IF TEXT CONTAINS MATH ───────────────────────────────
function containsMath(text) {
    if (!text) return false;
    return (
        /\$\$[\s\S]+?\$\$/.test(text)   ||  // display math $$...$$
        /\$[^$\n]+?\$/.test(text)        ||  // inline math $...$
        /\\\[[\s\S]+?\\\]/.test(text)    ||  // display \[...\]
        /\\\([\s\S]+?\\\)/.test(text)       // inline \(...\)
    );
}

// ── ADD MATH + MARKDOWN MESSAGE ───────────────────────────────
// This is the main function to display AI responses
// It handles both Markdown AND LaTeX in the same message
function addMathMarkdownMessage(text, role = "assistant") {
    const container = document.getElementById("chatContainer");
    if (!container) return;

    const wrapper     = document.createElement("div");
    wrapper.className = `message ${role} markdown-message math-message`;

    // Step 1: Configure Marked
    if (typeof marked !== "undefined") {
        marked.setOptions({
            breaks:    true,
            gfm:       true,
            headerIds: false,
            mangle:    false
        });
    }

    // Step 2: Protect math blocks BEFORE markdown parsing
    // Replace $$ and $ with placeholders so Marked does not eat them
    const mathBlocks   = [];
    let   processedText = text;

    // Protect display math $$...$$ first
    processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
        const idx = mathBlocks.length;
        mathBlocks.push({ type: "display", content: match });
        return `MATHBLOCK_${idx}_END`;
    });

    // Protect inline math $...$
    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match) => {
        const idx = mathBlocks.length;
        mathBlocks.push({ type: "inline", content: match });
        return `MATHBLOCK_${idx}_END`;
    });

    // Step 3: Parse markdown
    let html = processedText;
    if (typeof marked !== "undefined") {
        try {
            html = marked.parse(processedText);
        } catch (e) {
            html = processedText;
        }
    }

    // Step 4: Sanitize with DOMPurify
    if (typeof DOMPurify !== "undefined") {
        html = DOMPurify.sanitize(html, {
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
    }

    // Step 5: Restore math blocks back into HTML
    mathBlocks.forEach((block, idx) => {
        html = html.replace(`MATHBLOCK_${idx}_END`, block.content);
    });

    // Set inner HTML
    wrapper.innerHTML = html;

    // Step 6: Render all math with KaTeX
    container.appendChild(wrapper);
    renderMathInEl(wrapper);

    container.scrollTop = container.scrollHeight;
    return wrapper;
}

// ── RENDER MATH IN ALL EXISTING MESSAGES ─────────────────────
// Called after KaTeX fully loads on the page
function renderAllMathInPage() {
    document.querySelectorAll(".math-message, .markdown-message").forEach(el => {
        renderMathInEl(el);
    });
}

// ── ESCAPE HTML HELPER ────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}