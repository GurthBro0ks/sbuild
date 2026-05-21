import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
const BLOCK_TYPES = [
    "hero",
    "text",
    "image",
    "cards",
    "hours",
    "gallery",
    "contact",
    "testimonial",
    "map",
    "marquee",
    "spacer",
    "divider",
    "html"
];
const EFFECTS = ["glow", "marquee", "fade-in", "gradient-text", "parallax", "pulse", "hover-grow"];
const themePresets = [
    {
        name: "Harvest",
        bg: "#f6f3e9",
        surface: "#fffef9",
        text: "#1f2a24",
        accent: "#2f6b3f",
        muted: "#6f7f73"
    },
    {
        name: "Ocean",
        bg: "#eef6fb",
        surface: "#ffffff",
        text: "#1b2f3b",
        accent: "#1a7ba8",
        muted: "#5f7380"
    },
    {
        name: "Sunset",
        bg: "#fff1e8",
        surface: "#fffaf4",
        text: "#3a241f",
        accent: "#cc5f2f",
        muted: "#8b6b60"
    }
];
function apiBase() {
    return "";
}
async function fetchJson(url, init) {
    const res = await fetch(`${apiBase()}${url}`, {
        headers: { "Content-Type": "application/json" },
        ...init
    });
    return (await res.json());
}
function blockStyleToCss(block) {
    const s = block.styles || {};
    const css = {
        background: s.backgroundColor || "#fff",
        color: s.textColor || "inherit",
        fontFamily: s.fontFamily ? `'${s.fontFamily}', sans-serif` : "inherit",
        fontSize: s.fontSize ? `${s.fontSize}px` : "",
        fontWeight: s.fontWeight || "",
        textAlign: s.textAlign || "left",
        padding: `${s.padding ?? 16}px`,
        margin: `${s.margin ?? 8}px 0`,
        borderRadius: `${s.borderRadius ?? 12}px`,
        boxShadow: s.shadow || ""
    };
    if ((s.effects || []).includes("glow"))
        css.textShadow = "0 0 12px rgba(70, 130, 255, .5)";
    if ((s.effects || []).includes("gradient-text")) {
        css.background = "linear-gradient(90deg,#1f5fff,#34c48a)";
        css.WebkitBackgroundClip = "text";
        css.color = "transparent";
    }
    if ((s.effects || []).includes("pulse"))
        css.animation = "pulse 2.2s infinite";
    if ((s.effects || []).includes("hover-grow"))
        css.transition = "transform .2s ease";
    if ((s.effects || []).includes("parallax"))
        css.backgroundAttachment = "fixed";
    return css;
}
function defaultBlock(type) {
    const base = { id: `${type}-${Math.random().toString(36).slice(2, 8)}`, type, styles: { padding: 16 } };
    switch (type) {
        case "hero":
            return { ...base, data: { heading: "New Hero", subheading: "Tell your story", ctaLabel: "Learn More", ctaHref: "#" } };
        case "text":
            return { ...base, data: { title: "New Section", body: "Add your text here." } };
        case "image":
            return { ...base, data: { src: "", alt: "Image", caption: "" } };
        case "cards":
            return {
                ...base,
                data: {
                    title: "Cards",
                    cards: [
                        { id: "c1", title: "Card 1", body: "Description" },
                        { id: "c2", title: "Card 2", body: "Description" }
                    ]
                }
            };
        case "hours":
            return { ...base, data: { title: "Hours", rows: [{ day: "Mon", open: "9:00", close: "17:00" }] } };
        case "gallery":
            return { ...base, data: { title: "Gallery", images: [{ id: "g1", src: "", alt: "Image" }] } };
        case "contact":
            return { ...base, data: { title: "Contact", phone: "", email: "", address: "" } };
        case "testimonial":
            return { ...base, data: { quote: "Great service!", author: "Happy Customer" } };
        case "map":
            return { ...base, data: { address: "Address", embedUrl: "" } };
        case "marquee":
            return { ...base, data: { text: "Scrolling highlight text" } };
        case "spacer":
            return { ...base, data: { height: 36 } };
        case "divider":
            return { ...base, data: { style: "solid" } };
        case "html":
            return { ...base, data: { html: "<p>Custom HTML</p>" } };
        default:
            return { ...base, data: { body: "Unknown block" } };
    }
}
function updateBlock(blocks, id, updater) {
    return blocks.map((b) => (b.id === id ? updater(b) : b));
}
function move(arr, from, to) {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}
const HeroBlock = ({ block, onText }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h1", { contentEditable: true, suppressContentEditableWarning: true, onBlur: (e) => onText("heading", e.currentTarget.textContent || ""), children: data.heading }), _jsx("p", { contentEditable: true, suppressContentEditableWarning: true, onBlur: (e) => onText("subheading", e.currentTarget.textContent || ""), children: data.subheading }), _jsx("button", { className: "cta-btn", children: data.ctaLabel || "Call to Action" })] }));
};
const TextBlock = ({ block, onText }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h2", { contentEditable: true, suppressContentEditableWarning: true, onBlur: (e) => onText("title", e.currentTarget.textContent || ""), children: data.title }), _jsx("p", { contentEditable: true, suppressContentEditableWarning: true, onBlur: (e) => onText("body", e.currentTarget.textContent || ""), children: data.body })] }));
};
const ImageBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [data.src ? _jsx("img", { src: data.src, alt: data.alt, className: "block-image" }) : _jsx("div", { className: "image-placeholder", children: "Image Placeholder" }), _jsx("p", { children: data.caption })] }));
};
const CardsBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h2", { children: data.title }), _jsx("div", { className: "cards-grid", children: data.cards.map((card) => (_jsxs("article", { children: [_jsx("h3", { children: card.title }), _jsx("p", { children: card.body })] }, card.id))) })] }));
};
const HoursBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h2", { children: data.title }), _jsx("ul", { children: data.rows.map((row, i) => (_jsxs("li", { children: [row.day, ": ", row.open, " - ", row.close] }, `${row.day}-${i}`))) })] }));
};
const GalleryBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h2", { children: data.title }), _jsx("div", { className: "gallery-grid", children: data.images.map((img) => (_jsx("figure", { children: img.src ? _jsx("img", { src: img.src, alt: img.alt, className: "block-image" }) : _jsx("div", { className: "image-placeholder", children: "Gallery Image" }) }, img.id))) })] }));
};
const ContactBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsx("h2", { children: data.title }), _jsx("p", { children: data.phone }), _jsx("p", { children: data.email }), _jsx("p", { children: data.address })] }));
};
const TestimonialBlock = ({ block }) => {
    const data = block.data;
    return (_jsxs("section", { children: [_jsxs("blockquote", { children: ["\u201C", data.quote, "\u201D"] }), _jsx("cite", { children: data.author })] }));
};
const MapBlock = ({ block }) => {
    const data = block.data;
    return _jsxs("section", { children: [_jsx("h2", { children: "Map" }), _jsx("p", { children: data.address || "Map placeholder" })] });
};
const MarqueeBlock = ({ block }) => {
    const data = block.data;
    return _jsx("section", { className: "marquee", children: _jsx("div", { children: data.text }) });
};
const SpacerBlock = ({ block }) => {
    const data = block.data;
    return _jsx("section", { style: { height: data.height } });
};
const DividerBlock = ({ block }) => {
    const data = block.data;
    return _jsx("hr", { style: { borderStyle: data.style || "solid" } });
};
const HtmlBlock = ({ block }) => {
    const data = block.data;
    return _jsx("section", { dangerouslySetInnerHTML: { __html: data.html } });
};
function renderTypedBlock(block, onText) {
    switch (block.type) {
        case "hero":
            return _jsx(HeroBlock, { block: block, onText: onText });
        case "text":
            return _jsx(TextBlock, { block: block, onText: onText });
        case "image":
            return _jsx(ImageBlock, { block: block });
        case "cards":
            return _jsx(CardsBlock, { block: block });
        case "hours":
            return _jsx(HoursBlock, { block: block });
        case "gallery":
            return _jsx(GalleryBlock, { block: block });
        case "contact":
            return _jsx(ContactBlock, { block: block });
        case "testimonial":
            return _jsx(TestimonialBlock, { block: block });
        case "map":
            return _jsx(MapBlock, { block: block });
        case "marquee":
            return _jsx(MarqueeBlock, { block: block });
        case "spacer":
            return _jsx(SpacerBlock, { block: block });
        case "divider":
            return _jsx(DividerBlock, { block: block });
        case "html":
            return _jsx(HtmlBlock, { block: block });
        default:
            return _jsx("div", { children: "Unknown block" });
    }
}
export function App() {
    const [project, setProject] = useState(null);
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedBlockId, setSelectedBlockId] = useState("");
    const [previewMode, setPreviewMode] = useState(false);
    const [paintMode, setPaintMode] = useState(false);
    const [rightTab, setRightTab] = useState("properties");
    const [deviceMode, setDeviceMode] = useState("desktop");
    const [dirty, setDirty] = useState(false);
    const [status, setStatus] = useState("Loading project...");
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [fonts, setFonts] = useState([]);
    const [fontSearch, setFontSearch] = useState("");
    const [showWizard, setShowWizard] = useState(false);
    const [wizardForm, setWizardForm] = useState({ name: "", businessType: "", description: "", theme: "" });
    const [lastAction, setLastAction] = useState("none");
    const [paintPath, setPaintPath] = useState([]);
    const [paintPrompt, setPaintPrompt] = useState("");
    const [paintOpen, setPaintOpen] = useState(false);
    const selectedPage = useMemo(() => project?.pages.find((p) => p.id === selectedPageId) || project?.pages[0], [project, selectedPageId]);
    const selectedBlock = selectedPage?.blocks.find((b) => b.id === selectedBlockId) || selectedPage?.blocks[0];
    useEffect(() => {
        void loadProject();
        void loadFonts();
    }, []);
    useEffect(() => {
        if (!project || selectedPageId)
            return;
        const page = project.pages[0];
        setSelectedPageId(page.id);
        setSelectedBlockId(page.blocks[0]?.id || "");
    }, [project, selectedPageId]);
    async function loadProject() {
        try {
            const data = await fetchJson("/api/project");
            setProject(data.project);
            setStatus("Project loaded");
        }
        catch (error) {
            setStatus(`Failed to load project: ${String(error)}`);
        }
    }
    async function loadFonts() {
        try {
            const data = await fetchJson("/api/fonts");
            setFonts(data.fonts || []);
        }
        catch {
            setFonts([]);
        }
    }
    function patchCurrentPage(nextPage) {
        if (!project || !selectedPage)
            return;
        const pages = project.pages.map((p) => (p.id === selectedPage.id ? nextPage : p));
        setProject({ ...project, pages, updatedAt: new Date().toISOString() });
        setDirty(true);
    }
    function patchSelectedBlock(mutator) {
        if (!selectedPage || !selectedBlock)
            return;
        patchCurrentPage({
            ...selectedPage,
            blocks: updateBlock(selectedPage.blocks, selectedBlock.id, mutator)
        });
    }
    async function saveProject() {
        if (!project)
            return;
        setStatus("Saving...");
        const data = await fetchJson("/api/project", {
            method: "PUT",
            body: JSON.stringify({ project })
        });
        if (data.ok) {
            setDirty(false);
            setStatus("Saved");
            setLastAction("save");
        }
    }
    async function runBuild() {
        setStatus("Building static site...");
        const data = await fetchJson("/api/build", { method: "POST", body: "{}" });
        setStatus(data.ok ? `Build complete: ${data.result?.outputDir}` : "Build failed");
        setLastAction("build");
    }
    async function runPublish() {
        setStatus("Publishing...");
        const data = await fetchJson("/api/publish", { method: "POST", body: "{}" });
        if (data.ok) {
            setStatus(data.dryRun ? `Dry-run publish complete → ${data.target}` : `Published → ${data.target}`);
            setLastAction("publish");
        }
    }
    async function chat() {
        if (!chatInput.trim())
            return;
        const prompt = chatInput.trim();
        setChatHistory((h) => [...h, { role: "user", text: prompt }]);
        setChatInput("");
        const data = await fetchJson("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({ prompt })
        });
        setChatHistory((h) => [...h, { role: "assistant", text: data.response }]);
    }
    async function quickRewrite(mode) {
        if (!selectedBlock)
            return;
        const prompt = `${mode.toUpperCase()} this content: ${JSON.stringify(selectedBlock.data)}`;
        setChatInput(prompt);
        await chat();
    }
    async function runWizard() {
        const data = await fetchJson("/api/ai/wizard", {
            method: "POST",
            body: JSON.stringify(wizardForm)
        });
        if (data.ok) {
            setProject(data.project);
            setDirty(true);
            setShowWizard(false);
            setStatus("Wizard applied");
            setLastAction("wizard");
        }
    }
    function duplicateBlock() {
        if (!selectedPage || !selectedBlock)
            return;
        const copy = { ...selectedBlock, id: `${selectedBlock.id}-copy-${Math.random().toString(36).slice(2, 6)}` };
        patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, copy] });
        setSelectedBlockId(copy.id);
        setLastAction("duplicate-block");
    }
    function deleteBlock() {
        if (!selectedPage || !selectedBlock)
            return;
        const next = selectedPage.blocks.filter((b) => b.id !== selectedBlock.id);
        patchCurrentPage({ ...selectedPage, blocks: next });
        setSelectedBlockId(next[0]?.id || "");
        setLastAction("delete-block");
    }
    function moveBlock(direction) {
        if (!selectedPage || !selectedBlock)
            return;
        const index = selectedPage.blocks.findIndex((b) => b.id === selectedBlock.id);
        const to = direction === "up" ? index - 1 : index + 1;
        if (to < 0 || to >= selectedPage.blocks.length)
            return;
        patchCurrentPage({ ...selectedPage, blocks: move(selectedPage.blocks, index, to) });
        setLastAction(`move-${direction}`);
    }
    function applyTheme(index) {
        if (!project)
            return;
        const theme = themePresets[index];
        setProject({
            ...project,
            globalStyles: {
                ...project.globalStyles,
                colors: {
                    bg: theme.bg,
                    surface: theme.surface,
                    text: theme.text,
                    accent: theme.accent,
                    muted: theme.muted
                }
            }
        });
        setDirty(true);
        setLastAction(`theme-${theme.name}`);
    }
    function addBlock(type) {
        if (!selectedPage)
            return;
        const b = defaultBlock(type);
        patchCurrentPage({ ...selectedPage, blocks: [...selectedPage.blocks, b] });
        setSelectedBlockId(b.id);
        setLastAction(`add-${type}`);
    }
    function updateNav(index, patch) {
        if (!project)
            return;
        const nav = [...project.site.nav];
        nav[index] = { ...nav[index], ...patch };
        setProject({ ...project, site: { ...project.site, nav } });
        setDirty(true);
        setLastAction("edit-nav");
    }
    function addNav() {
        if (!project)
            return;
        const nav = [...project.site.nav, { id: `nav-${Date.now()}`, label: "New", href: "#" }];
        setProject({ ...project, site: { ...project.site, nav } });
        setDirty(true);
    }
    function removeNav(index) {
        if (!project)
            return;
        const nav = project.site.nav.filter((_, i) => i !== index);
        setProject({ ...project, site: { ...project.site, nav } });
        setDirty(true);
    }
    function addRecentFont(name) {
        const key = "sbuild_recent_fonts";
        const current = JSON.parse(localStorage.getItem(key) || "[]");
        const next = [name, ...current.filter((f) => f !== name)].slice(0, 10);
        localStorage.setItem(key, JSON.stringify(next));
    }
    const filteredFonts = useMemo(() => {
        const q = fontSearch.toLowerCase();
        return fonts.filter((f) => f.family.toLowerCase().includes(q)).slice(0, 50);
    }, [fonts, fontSearch]);
    function pointerPoint(e) {
        const rect = e.target.closest(".canvas-frame").getBoundingClientRect();
        return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
    }
    function beginPaint(e) {
        if (!paintMode)
            return;
        setPaintPath([pointerPoint(e)]);
    }
    function movePaint(e) {
        if (!paintMode || paintPath.length === 0)
            return;
        setPaintPath((pts) => [...pts, pointerPoint(e)]);
    }
    function endPaint() {
        if (!paintMode || paintPath.length < 2)
            return;
        setPaintOpen(true);
    }
    async function applyPaintFix() {
        if (!project || !selectedPage)
            return;
        const data = await fetchJson("/api/ai/paint-fix", {
            method: "POST",
            body: JSON.stringify({
                instruction: paintPrompt,
                pageId: selectedPage.id,
                bounds: { width: 0, height: 0 },
                points: paintPath,
                selectedBlockId,
                project
            })
        });
        if (data.ok) {
            setProject(data.project);
            setDirty(true);
            setStatus(`Paint fix applied: ${data.notes.join("; ")}`);
            setLastAction("paint-fix");
        }
        setPaintOpen(false);
        setPaintPrompt("");
        setPaintPath([]);
    }
    if (!project || !selectedPage) {
        return _jsx("div", { className: "loading", children: "Loading sBuild..." });
    }
    return (_jsxs("div", { className: `app ${previewMode ? "preview" : "edit"}`, children: [_jsxs("header", { className: "topbar", children: [_jsx("button", { children: "\u2630" }), _jsx("div", { className: "logo", children: "sBuild v2" }), _jsx("button", { onClick: () => setPreviewMode((v) => !v), children: previewMode ? "Edit" : "Preview" }), _jsx("button", { onClick: () => setPaintMode((p) => !p), className: paintMode ? "active" : "", children: "Paint" }), _jsx("button", { onClick: () => setRightTab("ai"), children: "AI" }), _jsx("button", { onClick: () => setRightTab("status"), children: "Settings" }), _jsx("button", { onClick: () => void saveProject(), children: "Save" }), _jsx("button", { onClick: () => void runBuild(), children: "Build" }), _jsx("button", { onClick: () => void runPublish(), children: "Publish" })] }), _jsxs("div", { className: "workspace", children: [_jsxs("aside", { className: "left-drawer", children: [_jsxs("section", { children: [_jsx("h3", { children: "Pages" }), project.pages.map((page) => (_jsx("button", { className: page.id === selectedPage.id ? "selected" : "", onClick: () => setSelectedPageId(page.id), children: page.title }, page.id)))] }), _jsxs("section", { children: [_jsx("h3", { children: "Add Block" }), _jsx("div", { className: "palette-grid", children: BLOCK_TYPES.map((type) => (_jsx("button", { onClick: () => addBlock(type), children: type }, type))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Theme Presets" }), themePresets.map((t, i) => (_jsx("button", { onClick: () => applyTheme(i), children: t.name }, t.name)))] }), _jsxs("section", { children: [_jsx("h3", { children: "Fonts" }), _jsx("input", { value: fontSearch, onChange: (e) => setFontSearch(e.target.value), placeholder: "Search fonts" }), _jsx("div", { className: "font-list", children: filteredFonts.map((f) => (_jsx("button", { onClick: () => {
                                                addRecentFont(f.family);
                                                setProject({ ...project, globalStyles: { ...project.globalStyles, headingFont: f.family } });
                                                setDirty(true);
                                            }, children: f.family }, f.family))) })] }), _jsx("section", { children: _jsx("button", { onClick: () => setShowWizard(true), children: "Website Wizard" }) })] }), _jsxs("main", { className: "canvas-area", children: [_jsxs("div", { className: "canvas-controls", children: [_jsx("button", { onClick: () => setDeviceMode("desktop"), className: deviceMode === "desktop" ? "selected" : "", children: "Desktop" }), _jsx("button", { onClick: () => setDeviceMode("tablet"), className: deviceMode === "tablet" ? "selected" : "", children: "Tablet" }), _jsx("button", { onClick: () => setDeviceMode("phone"), className: deviceMode === "phone" ? "selected" : "", children: "Phone" }), _jsx("button", { onClick: duplicateBlock, children: "Duplicate" }), _jsx("button", { onClick: deleteBlock, children: "Delete" }), _jsx("button", { onClick: () => moveBlock("up"), children: "Up" }), _jsx("button", { onClick: () => moveBlock("down"), children: "Down" })] }), _jsxs("div", { className: `canvas-frame ${deviceMode}`, style: { background: project.globalStyles.colors.bg, color: project.globalStyles.colors.text }, onPointerDown: beginPaint, onPointerMove: movePaint, onPointerUp: endPaint, children: [_jsxs("nav", { className: "canvas-nav", children: [_jsx("strong", { children: project.site.siteName }), _jsx("div", { className: "nav-items", children: project.site.nav.map((item) => (_jsx("span", { children: item.label }, item.id))) })] }), selectedPage.blocks.map((block) => (_jsxs("div", { className: `block-shell ${block.id === selectedBlock?.id ? "selected-block" : ""}`, style: blockStyleToCss(block), onClick: () => setSelectedBlockId(block.id), children: [!previewMode && _jsxs("div", { className: "block-meta", children: [block.type, " \u00B7 ", block.id] }), renderTypedBlock(block, (field, value) => {
                                                patchSelectedBlock((current) => ({ ...current, data: { ...current.data, [field]: value } }));
                                            })] }, block.id))), paintMode && (_jsx("svg", { className: "paint-overlay", viewBox: "0 0 1200 1200", preserveAspectRatio: "none", children: _jsx("polyline", { points: paintPath.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: "#2b6dff", strokeWidth: "3" }) }))] }), paintOpen && (_jsxs("div", { className: "paint-prompt", children: [_jsx("label", { children: "Paint Instruction" }), _jsx("input", { value: paintPrompt, onChange: (e) => setPaintPrompt(e.target.value), placeholder: "make heading bigger" }), _jsx("button", { onClick: () => void applyPaintFix(), children: "Apply" }), _jsx("button", { onClick: () => { setPaintOpen(false); setPaintPath([]); }, children: "Cancel" })] }))] }), _jsxs("aside", { className: "right-drawer", children: [_jsxs("div", { className: "tabs", children: [_jsx("button", { onClick: () => setRightTab("properties"), className: rightTab === "properties" ? "selected" : "", children: "Properties" }), _jsx("button", { onClick: () => setRightTab("ai"), className: rightTab === "ai" ? "selected" : "", children: "AI Chat" }), _jsx("button", { onClick: () => setRightTab("status"), className: rightTab === "status" ? "selected" : "", children: "Debug" })] }), rightTab === "properties" && selectedBlock && (_jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Block Styles" }), _jsxs("label", { children: ["Background ", _jsx("input", { type: "color", value: selectedBlock.styles?.backgroundColor || "#ffffff", onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), backgroundColor: e.target.value } })) })] }), _jsxs("label", { children: ["Text Color ", _jsx("input", { type: "color", value: selectedBlock.styles?.textColor || "#222222", onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), textColor: e.target.value } })) })] }), _jsxs("label", { children: ["Font Family", _jsx("input", { value: selectedBlock.styles?.fontFamily || "", onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontFamily: e.target.value } })), placeholder: "e.g. Poppins" })] }), _jsxs("label", { children: ["Font Size ", _jsx("input", { type: "number", value: selectedBlock.styles?.fontSize || 18, onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontSize: Number(e.target.value) } })) })] }), _jsxs("label", { children: ["Font Weight ", _jsx("input", { type: "number", value: selectedBlock.styles?.fontWeight || 500, onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), fontWeight: Number(e.target.value) } })) })] }), _jsxs("label", { children: ["Text Align", _jsxs("select", { value: selectedBlock.styles?.textAlign || "left", onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), textAlign: e.target.value } })), children: [_jsx("option", { value: "left", children: "left" }), _jsx("option", { value: "center", children: "center" }), _jsx("option", { value: "right", children: "right" })] })] }), _jsxs("label", { children: ["Padding ", _jsx("input", { type: "number", value: selectedBlock.styles?.padding || 16, onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), padding: Number(e.target.value) } })) })] }), _jsxs("label", { children: ["Margin ", _jsx("input", { type: "number", value: selectedBlock.styles?.margin || 8, onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), margin: Number(e.target.value) } })) })] }), _jsxs("label", { children: ["Border Radius ", _jsx("input", { type: "number", value: selectedBlock.styles?.borderRadius || 12, onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), borderRadius: Number(e.target.value) } })) })] }), _jsxs("label", { children: ["Shadow", _jsx("input", { value: selectedBlock.styles?.shadow || "", onChange: (e) => patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), shadow: e.target.value } })), placeholder: "0 4px 12px rgba(0,0,0,.15)" })] }), _jsx("h4", { children: "Effects" }), _jsx("div", { className: "effect-list", children: EFFECTS.map((effect) => {
                                            const has = (selectedBlock.styles?.effects || []).includes(effect);
                                            return (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: has, onChange: (e) => {
                                                            const current = new Set(selectedBlock.styles?.effects || []);
                                                            if (e.target.checked)
                                                                current.add(effect);
                                                            else
                                                                current.delete(effect);
                                                            patchSelectedBlock((b) => ({ ...b, styles: { ...(b.styles || {}), effects: [...current] } }));
                                                        } }), effect] }, effect));
                                        }) })] })), rightTab === "ai" && (_jsxs("div", { className: "panel", children: [_jsx("h3", { children: "AI Chat" }), _jsxs("div", { className: "quick-actions", children: [_jsx("button", { onClick: () => void quickRewrite("rewrite"), children: "Rewrite" }), _jsx("button", { onClick: () => void quickRewrite("shorten"), children: "Shorten" }), _jsx("button", { onClick: () => void quickRewrite("lengthen"), children: "Lengthen" }), _jsx("button", { onClick: () => void quickRewrite("tone"), children: "Tone" })] }), _jsx("div", { className: "chat-log", children: chatHistory.map((msg, i) => (_jsx("div", { className: `msg ${msg.role}`, children: msg.text }, i))) }), _jsx("textarea", { value: chatInput, onChange: (e) => setChatInput(e.target.value), rows: 4, placeholder: "Ask AI to improve copy or layout" }), _jsx("button", { onClick: () => void chat(), children: "Send" })] })), rightTab === "status" && (_jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Status" }), _jsxs("p", { children: [_jsx("strong", { children: "API:" }), " ", status] }), _jsxs("p", { children: [_jsx("strong", { children: "Selected Block:" }), " ", selectedBlock?.id || "none"] }), _jsxs("p", { children: [_jsx("strong", { children: "Dirty:" }), " ", dirty ? "yes" : "no"] }), _jsxs("p", { children: [_jsx("strong", { children: "Last action:" }), " ", lastAction] }), _jsx("h4", { children: "Navigation Editor" }), project.site.nav.map((item, i) => (_jsxs("div", { className: "nav-edit-row", children: [_jsx("input", { value: item.label, onChange: (e) => updateNav(i, { label: e.target.value }) }), _jsx("input", { value: item.href, onChange: (e) => updateNav(i, { href: e.target.value }) }), _jsx("button", { onClick: () => removeNav(i), children: "X" })] }, item.id))), _jsx("button", { onClick: addNav, children: "Add Nav Item" }), _jsx("h4", { children: "Deploy Settings" }), _jsxs("label", { children: ["Method", _jsxs("select", { value: project.deploy.method, onChange: (e) => {
                                                    setProject({ ...project, deploy: { ...project.deploy, method: e.target.value } });
                                                    setDirty(true);
                                                }, children: [_jsx("option", { value: "dry-run", children: "dry-run" }), _jsx("option", { value: "local-web-root", children: "local-web-root" }), _jsx("option", { value: "git", children: "git" })] })] }), _jsxs("label", { children: ["Web Root", _jsx("input", { value: project.deploy.webRoot, onChange: (e) => {
                                                    setProject({ ...project, deploy: { ...project.deploy, webRoot: e.target.value } });
                                                    setDirty(true);
                                                } })] }), _jsxs("label", { children: ["GitHub Repo URL", _jsx("input", { value: project.deploy.githubRepo || "", onChange: (e) => {
                                                    setProject({ ...project, deploy: { ...project.deploy, githubRepo: e.target.value } });
                                                    setDirty(true);
                                                }, placeholder: "https://github.com/org/repo" })] }), _jsxs("label", { children: ["Token Placeholder ", _jsx("input", { value: "", placeholder: "not stored in prototype", readOnly: true })] }), _jsxs("div", { className: "button-row", children: [_jsx("button", { onClick: async () => setStatus(JSON.stringify(await fetchJson("/api/backup", { method: "POST", body: "{}" }))), children: "Backup" }), _jsx("button", { onClick: async () => setStatus("Use /api/restore with backup path"), children: "Restore" })] })] }))] })] }), showWizard && (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "modal", children: [_jsx("h3", { children: "Website Wizard" }), _jsxs("label", { children: ["Name ", _jsx("input", { value: wizardForm.name, onChange: (e) => setWizardForm({ ...wizardForm, name: e.target.value }) })] }), _jsxs("label", { children: ["Business Type ", _jsx("input", { value: wizardForm.businessType, onChange: (e) => setWizardForm({ ...wizardForm, businessType: e.target.value }) })] }), _jsxs("label", { children: ["Description ", _jsx("textarea", { value: wizardForm.description, onChange: (e) => setWizardForm({ ...wizardForm, description: e.target.value }) })] }), _jsxs("label", { children: ["Theme ", _jsx("input", { value: wizardForm.theme, onChange: (e) => setWizardForm({ ...wizardForm, theme: e.target.value }) })] }), _jsxs("div", { className: "button-row", children: [_jsx("button", { onClick: () => void runWizard(), children: "Apply" }), _jsx("button", { onClick: () => setShowWizard(false), children: "Cancel" })] })] }) }))] }));
}
//# sourceMappingURL=App.js.map