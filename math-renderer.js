// ============================================================
// math-renderer.js — Path 7: Per-response speak button
// ============================================================

function isKatexReady() {
    return typeof window.renderMathInElement !== "undefined" &&
           typeof window.katex !== "undefined";
}

function renderMathInEl(element) {
    if (!element) return;
    if (!isKatexReady()) {
        setTimeout(function() { renderMathInEl(element); }, 300);
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
            throwOnError: false,
            errorColor:   "#ef4444",
            strict:       false,
            output:       "html"
        });
    } catch (err) {
        console.warn("KaTeX error:", err);
    }
}

// ── ADD MATH + MARKDOWN + SPEAK BUTTON ───────────────────────
function addMathMarkdownMessage(text, role) {
    role = role || "assistant";
    var container = document.getElementById("chatContainer");
    if (!container) return null;

    var wrapper      = document.createElement("div");
    wrapper.className = "message " + role + " markdown-message math-message";

    if (typeof marked !== "undefined") {
        marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
    }

    // Protect math before markdown parsing
    var mathBlocks  = [];
    var processed   = text;

    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, function(match) {
        var idx = mathBlocks.length;
        mathBlocks.push({ type: "display", content: match });
        return "MATHBLOCK_" + idx + "_END";
    });

    processed = processed.replace(/\$([^$\n]+?)\$/g, function(match) {
        var idx = mathBlocks.length;
        mathBlocks.push({ type: "inline", content: match });
        return "MATHBLOCK_" + idx + "_END";
    });

    var html = processed;
    if (typeof marked !== "undefined") {
        try { html = marked.parse(processed); } catch (e) { html = processed; }
    }

    if (typeof DOMPurify !== "undefined") {
        html = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                "p","br","strong","em","b","i","u",
                "h1","h2","h3","h4","h5","h6",
                "ul","ol","li","blockquote","code","pre",
                "hr","table","thead","tbody","tr","th","td",
                "span","div","sup","sub"
            ],
            ALLOWED_ATTR: ["class","style"]
        });
    }

    mathBlocks.forEach(function(block, idx) {
        html = html.replace("MATHBLOCK_" + idx + "_END", block.content);
    });

    wrapper.innerHTML = html;

    // ── Add per-response speak button ─────────────────────────
    if (role === "assistant") {
        var speakBtn       = document.createElement("button");
        speakBtn.className = "response-speak-btn";
        speakBtn.title     = "Listen to this answer";
        speakBtn.innerHTML = "🔊";

        // Capture the text for this specific message
        var responseText   = text;

        speakBtn.onclick   = function() {
            speakResponse(responseText, speakBtn);
        };

        wrapper.appendChild(speakBtn);
    }

    container.appendChild(wrapper);

    // Render KaTeX
    renderMathInEl(wrapper);

    container.scrollTop = container.scrollHeight;
    return wrapper;
}

// ── RENDER ALL MATH ON PAGE ───────────────────────────────────
function renderAllMathInPage() {
    var els = document.querySelectorAll(".math-message, .markdown-message");
    for (var i = 0; i < els.length; i++) {
        renderMathInEl(els[i]);
    }
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(text || ""));
    return div.innerHTML;
}
