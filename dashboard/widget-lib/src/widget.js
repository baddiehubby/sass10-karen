/* Buddy AI — emotional intelligence embed (Living Face widget bundle) */
(function initLivingFaceWidget() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__HQ_LIVING_FACE_WIDGET__) return;
  window.__HQ_LIVING_FACE_WIDGET__ = true;

  const FREE_FEATURES = {
    customTheme: false,
    analytics: false,
    whiteLabel: false,
    voiceSync: false,
  };

  const THEMES = {
    default: {
      neutral: "#6366f1",
      happy: "#22c55e",
      thinking: "#f59e0b",
      concerned: "#ef4444",
      excited: "#a855f7",
      sleepy: "#64748b",
      deep: "#1e1b4b",
    },
    premium: {
      neutral: "#14b8a6",
      happy: "#10b981",
      thinking: "#eab308",
      concerned: "#f43f5e",
      excited: "#8b5cf6",
      sleepy: "#475569",
      deep: "#0f172a",
    },
  };

  const HAPPY_WORDS = ["amazing", "awesome", "great", "love", "perfect", "thanks", "wow", "excellent"];
  const SAD_WORDS = ["wrong", "bad", "error", "fix", "broken", "hate", "terrible", "useless"];
  const EXCITED_WORDS = ["incredible", "fantastic", "brilliant", "outstanding", "superb", "best"];
  const QUESTION_WORDS = ["how", "what", "why", "explain", "help", "?"];
  const SLEEPY_WORDS = ["sleep", "rest", "tired", "late", "exhausted", "fatigue", "nap"];

  function detectCurrentScript() {
    const scripts = Array.from(document.getElementsByTagName("script"));
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const s = scripts[i];
      const src = s.src || "";
      if (
        src.includes("livingface-widget") ||
        src.includes("/widget/livingface-widget") ||
        src.includes("/api/dev/widget")
      )
        return s;
      if (s.dataset && (s.dataset.hqKey || s.dataset.hqApi)) return s;
    }
    return document.currentScript;
  }

  const scriptEl = detectCurrentScript();
  const LICENSE_KEY = scriptEl?.getAttribute("data-hq-key") || "";
  const apiBaseRaw = scriptEl?.getAttribute("data-hq-api") || "https://yourdomain.com";
  const API_BASE = apiBaseRaw.replace(/\/$/, "");
  const SCRIPT_POS = (scriptEl?.getAttribute("data-hq-position") || "").trim().toLowerCase();
  const ALLOW_SCRIPT_POS = new Set(["bottom-right", "bottom-left", "top-right", "top-left"]);

  const state = {
    plan: "free",
    licenseId: "",
    mood: "neutral",
    previousMood: "neutral",
    features: { ...FREE_FEATURES },
    licenseValid: false,
    themeName: "default",
    remoteTheme: null,
    isBlinking: false,
    voiceLevel: 0,
    lastMessage: "",
    rafId: 0,
    observer: null,
    debounceId: 0,
    typingTimeout: 0,
    moodOverride: null,
    moodOverrideUntil: 0,
    widgetConfig: {
      tooltipText: "",
      position: "bottom-right",
      size: "medium",
      zIndex: null,
      customCss: "",
      themeMode: "auto",
    },
    soundEnabled: false,
    reactionEmojiTimeout: 0,
    isWinking: false,
    isHeartEyes: false,
    speechUtterance: null,
    lipSyncInterval: 0,
  };

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 24 && rect.height > 10;
  }

  function detectMood(text, previousMood) {
    const t = normalizeText(text).toLowerCase();
    if (!t) return previousMood || "neutral";
    if (SLEEPY_WORDS.some((w) => t.includes(w))) return "sleepy";
    if (EXCITED_WORDS.some((w) => t.includes(w))) return "excited";
    if (HAPPY_WORDS.some((w) => t.includes(w))) return "happy";
    if (SAD_WORDS.some((w) => t.includes(w))) return "concerned";
    if (QUESTION_WORDS.some((w) => t.includes(w))) return "thinking";
    return "neutral";
  }

  function hasTypingIndicator() {
    const selectors = [
      '[class*="typing"]',
      '[class*="streaming"]',
      '[class*="result-streaming"]',
      '[aria-label*="typing"]',
      '[data-is-streaming="true"]',
    ];
    for (let i = 0; i < selectors.length; i += 1) {
      if (document.querySelector(selectors[i])) return true;
    }
    return false;
  }

  function extractLatestBySelectors() {
    const selectorMap = [
      { selector: '[data-message-author-role="assistant"]', platform: "chatgpt" },
      { selector: '[data-testid*="assistant"], [data-testid*="response"]', platform: "chatgpt" },
      { selector: ".claude-message, [class*='claude'][class*='message']", platform: "claude" },
      { selector: "[class*='assistant'][class*='message']", platform: "generic-assistant" },
      { selector: "[class*='response-content'], [class*='model-response']", platform: "gemini" },
      { selector: ".prose", platform: "prose" },
    ];

    for (let i = 0; i < selectorMap.length; i += 1) {
      const rule = selectorMap[i];
      const nodes = document.querySelectorAll(rule.selector);
      for (let j = nodes.length - 1; j >= 0; j -= 1) {
        const el = nodes[j];
        if (!isVisible(el)) continue;
        const text = normalizeText(el.textContent || "");
        if (text.length >= 12) return { text, platform: rule.platform };
      }
    }
    return null;
  }

  function extractLatestByHeuristic() {
    const all = Array.from(document.querySelectorAll("div, p, article, section, li"));
    const candidates = [];

    for (let i = 0; i < all.length; i += 1) {
      const el = all[i];
      if (!isVisible(el)) continue;
      if (el.closest("#hq-livingface-container")) continue;
      const text = normalizeText(el.textContent || "");
      if (text.length < 20 || text.length > 6000) continue;
      if (el.children.length > 0 && el.children.length > 40) continue;

      const className = String(el.className || "").toLowerCase();
      const roleLike = className.includes("message") || className.includes("assistant") || className.includes("response");
      const rect = el.getBoundingClientRect();
      const alignedLeftBonus = rect.left < window.innerWidth * 0.55 ? 8 : 0;
      candidates.push({
        text,
        score: (roleLike ? 12 : 0) + alignedLeftBonus + rect.top + rect.left * 0.1,
      });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.score - b.score);
    return { text: candidates[candidates.length - 1].text, platform: "heuristic" };
  }

  function getLatestAIMessage() {
    return extractLatestBySelectors() || extractLatestByHeuristic() || { text: "", platform: null };
  }

  function createWidgetDom() {
    const host = document.createElement("div");
    host.id = "hq-livingface-container";
    host.style.position = "fixed";
    host.style.bottom = "24px";
    host.style.right = "24px";
    host.style.width = "80px";
    host.style.height = "80px";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .root {
          position: relative;
          width: 80px;
          height: 80px;
          pointer-events: auto;
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }
        .ring {
          position: absolute;
          inset: -6px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.35);
          animation: lfSpin 10s linear infinite;
        }
        .orb {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          overflow: hidden;
          background: radial-gradient(circle at 28% 20%, #c7d2fe 0%, #6366f1 40%, #312e81 100%);
          box-shadow: inset 0 -10px 20px rgba(15, 23, 42, 0.35);
          transform-origin: center center;
          will-change: transform, filter, background;
          transition: background 240ms ease, filter 240ms ease;
        }
        .orb.hq-orb-image {
          background-color: #0f172a;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        .face {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .brow-wrap {
          position: absolute;
          top: 24px;
          left: 18px;
          right: 18px;
          display: flex;
          justify-content: space-between;
          transition: transform 220ms ease;
        }
        .eye {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.45);
          transform-origin: center center;
          transition: transform 220ms ease;
        }
        .eye.heart-eye {
          width: 16px;
          height: 16px;
          background: transparent;
          clip-path: path("M8 14 C8 14,0 9,0 4 C0 1.5,2 0,4 0 C5.5 0,7 1.1,8 2.6 C9 1.1,10.5 0,12 0 C14 0,16 1.5,16 4 C16 9,8 14,8 14 Z");
          background-color: #ef4444;
        }
        .mouth-wrap {
          position: absolute;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          width: 34px;
          height: 18px;
          opacity: 0.9;
        }
        .mouth { width: 100%; height: 100%; }
        .mouth path {
          stroke: rgba(15, 23, 42, 0.65);
          stroke-width: 2.6;
          stroke-linecap: round;
          fill: transparent;
        }
        .tooltip {
          position: absolute;
          bottom: 92px;
          right: -8px;
          max-width: 220px;
          padding: 7px 10px;
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #e2e8f0;
          font-size: 11px;
          line-height: 1.2;
          white-space: nowrap;
          opacity: 0;
          transform: translateY(3px);
          transition: opacity 180ms ease, transform 180ms ease;
          pointer-events: none;
        }
        .sound-toggle {
          position: absolute;
          top: -6px;
          left: -6px;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.78);
          color: #e2e8f0;
          font-size: 10px;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
        }
        .reaction-emoji {
          position: absolute;
          top: -12px;
          right: -10px;
          font-size: 16px;
          opacity: 0;
          transform: translateY(6px);
          transition: all 180ms ease;
        }
        .reaction-emoji.show {
          opacity: 1;
          transform: translateY(0);
        }
        .mini-confetti {
          position: absolute;
          inset: -4px;
          pointer-events: none;
        }
        .mini-dot {
          position: absolute;
          width: 4px;
          height: 6px;
          border-radius: 2px;
          opacity: 0;
          animation: none;
        }
        .mini-confetti.run .mini-dot {
          animation: lfConfetti 760ms ease-out forwards;
        }
        @keyframes lfConfetti {
          from { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          to { opacity: 0; transform: translate(var(--x), var(--y)) rotate(360deg); }
        }
        .upgrade {
          color: #93c5fd;
          margin-left: 6px;
          text-decoration: underline;
          pointer-events: auto;
          cursor: pointer;
        }
        .root:hover .tooltip {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes lfSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
      <div class="root" aria-label="Buddy AI companion">
        <button class="sound-toggle" aria-label="Toggle widget sound">🔈</button>
        <div class="ring"></div>
        <div class="mini-confetti"></div>
        <div class="orb">
          <div class="face">
            <div class="brow-wrap">
              <div class="eye left-eye"></div>
              <div class="eye right-eye"></div>
            </div>
            <div class="mouth-wrap">
              <svg class="mouth" viewBox="0 0 34 18" preserveAspectRatio="none" aria-hidden="true">
                <path class="mouth-path" d="M4 10 Q17 10 30 10"></path>
              </svg>
            </div>
          </div>
        </div>
        <div class="tooltip">
          <span class="tip-text">Buddy AI companion • neutral</span>
          <a class="upgrade" href="${API_BASE}/pricing" target="_blank" rel="noopener noreferrer">Upgrade</a>
        </div>
        <div class="reaction-emoji">🤫</div>
      </div>
    `;

    return {
      host,
      shadow,
      root: shadow.querySelector(".root"),
      ring: shadow.querySelector(".ring"),
      orb: shadow.querySelector(".orb"),
      leftEye: shadow.querySelector(".left-eye"),
      rightEye: shadow.querySelector(".right-eye"),
      brows: shadow.querySelector(".brow-wrap"),
      mouthPath: shadow.querySelector(".mouth-path"),
      tipText: shadow.querySelector(".tip-text"),
      tooltip: shadow.querySelector(".tooltip"),
      upgrade: shadow.querySelector(".upgrade"),
      soundToggle: shadow.querySelector(".sound-toggle"),
      reactionEmoji: shadow.querySelector(".reaction-emoji"),
      confettiLayer: shadow.querySelector(".mini-confetti"),
    };
  }

  function moodToMouthPath(curve) {
    const y = 9;
    const c = y - curve / 2;
    return `M4 ${y} Q17 ${c} 30 ${y}`;
  }

  async function verifyLicenseKey(key) {
    if (!key) return { valid: false, features: FREE_FEATURES };
    try {
      const domain = encodeURIComponent(window.location.hostname);
      const res = await fetch(`${API_BASE}/api/licenses/verify?key=${encodeURIComponent(key)}&domain=${domain}`, {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok || !data.valid) return { valid: false, features: FREE_FEATURES };
      return {
        valid: true,
        licenseId: data.licenseId || "",
        plan: data.plan || "free",
        features: { ...FREE_FEATURES, ...(data.features || {}) },
        widgetConfig: data.widgetConfig || null,
        moodOverride: data.moodOverride || null,
      };
    } catch {
      return { valid: false, features: FREE_FEATURES };
    }
  }

  async function fetchRemoteTheme(key) {
    if (!key) return null;
    try {
      const domain = encodeURIComponent(window.location.hostname);
      const res = await fetch(`${API_BASE}/api/licenses/theme?key=${encodeURIComponent(key)}&domain=${domain}`, {
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return null;
      return data;
    } catch {
      return null;
    }
  }

  function start() {
    const ui = createWidgetDom();
    if (!ui.host || !ui.shadow) return;
    document.body.appendChild(ui.host);

    let dynamicStyleEl = null;
    let customCssStyleEl = null;
    const audioCtx = window.AudioContext ? new window.AudioContext() : null;

    function ensureConfettiNodes() {
      if (!ui.confettiLayer || ui.confettiLayer.childNodes.length > 0) return;
      const colors = ["#f43f5e", "#22c55e", "#f59e0b", "#8b5cf6", "#60a5fa"];
      for (let i = 0; i < 22; i += 1) {
        const dot = document.createElement("span");
        dot.className = "mini-dot";
        dot.style.left = `${30 + Math.random() * 40}px`;
        dot.style.top = `${30 + Math.random() * 30}px`;
        dot.style.background = colors[i % colors.length];
        dot.style.setProperty("--x", `${(Math.random() - 0.5) * 70}px`);
        dot.style.setProperty("--y", `${40 + Math.random() * 55}px`);
        ui.confettiLayer.appendChild(dot);
      }
    }

    function showReactionEmoji(emoji, durationMs) {
      if (!ui.reactionEmoji) return;
      const ms = typeof durationMs === "number" && durationMs > 0 ? durationMs : 1100;
      ui.reactionEmoji.textContent = emoji;
      ui.reactionEmoji.classList.add("show");
      window.clearTimeout(state.reactionEmojiTimeout);
      state.reactionEmojiTimeout = window.setTimeout(() => {
        if (ui.reactionEmoji) ui.reactionEmoji.classList.remove("show");
      }, ms);
    }

    function triggerMiniConfetti() {
      ensureConfettiNodes();
      if (!ui.confettiLayer) return;
      ui.confettiLayer.classList.remove("run");
      void ui.confettiLayer.offsetWidth;
      ui.confettiLayer.classList.add("run");
    }

    function playMoodChime(mood) {
      if (!state.soundEnabled || !audioCtx) return;
      const noteMap = { neutral: 261.63, happy: 329.63, thinking: 392, concerned: 220, excited: 440, sleepy: 246.94 };
      const freq = noteMap[mood] || 261.63;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.26);
    }

    function speakWithLipSync(text) {
      if (!state.features.voiceSync || !state.soundEnabled || !("speechSynthesis" in window) || !ui.mouthPath) return;
      const sentence = normalizeText(text).slice(0, 240);
      if (!sentence) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(sentence);
      state.speechUtterance = utter;
      utter.rate = 1;
      utter.pitch = 1;
      utter.onstart = () => {
        window.clearInterval(state.lipSyncInterval);
        state.lipSyncInterval = window.setInterval(() => {
          const amp = 8 + Math.random() * 10;
          ui.mouthPath.setAttribute("d", moodToMouthPath(amp));
        }, 90);
      };
      utter.onend = () => {
        window.clearInterval(state.lipSyncInterval);
        applyMood(state.mood, false);
      };
      utter.onerror = () => {
        window.clearInterval(state.lipSyncInterval);
      };
      window.speechSynthesis.speak(utter);
    }

    async function syncCollaborativeMood(mood) {
      if (state.plan !== "agency" || !state.licenseId) return;
      fetch(`${API_BASE}/api/widget/mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId: state.licenseId, mood, ttlSeconds: 120 }),
      }).catch(() => undefined);
    }

    async function pollCollaborativeMood() {
      if (state.plan !== "agency" || !state.licenseId) return;
      try {
        const res = await fetch(`${API_BASE}/api/widget/mood?licenseId=${encodeURIComponent(state.licenseId)}`, {
          method: "GET",
        });
        const data = await res.json();
        if (res.ok && data.mood && data.mood !== state.mood && THEMES[state.themeName][data.mood]) {
          applyMood(String(data.mood), false);
        }
      } catch {
        // ignore
      }
    }

    function removeDynamicTheme() {
      if (dynamicStyleEl && dynamicStyleEl.parentNode) {
        dynamicStyleEl.parentNode.removeChild(dynamicStyleEl);
      }
      dynamicStyleEl = null;
      if (ui.ring) ui.ring.classList.remove("hq-theme-remote-ring");
      if (ui.orb) {
        ui.orb.classList.remove("hq-theme-remote");
        ui.orb.classList.remove("hq-orb-image");
        ui.orb.style.backgroundImage = "";
        ui.orb.style.backgroundSize = "";
        ui.orb.style.backgroundPosition = "";
        ui.orb.style.backgroundRepeat = "";
        ui.orb.style.backgroundColor = "";
      }
    }

    function applyPosition(host, position) {
      host.style.top = "";
      host.style.right = "";
      host.style.bottom = "";
      host.style.left = "";
      const pos = String(position || "bottom-right");
      if (pos === "top-left") {
        host.style.top = "24px";
        host.style.left = "24px";
      } else if (pos === "top-right") {
        host.style.top = "24px";
        host.style.right = "24px";
      } else if (pos === "bottom-left") {
        host.style.bottom = "24px";
        host.style.left = "24px";
      } else {
        host.style.bottom = "24px";
        host.style.right = "24px";
      }
    }

    function applySize(size) {
      const px = { small: 64, medium: 80, large: 104 }[size] || 80;
      ui.host.style.width = `${px}px`;
      ui.host.style.height = `${px}px`;
      if (ui.root) {
        ui.root.style.width = `${px}px`;
        ui.root.style.height = `${px}px`;
      }
      if (ui.tooltip) ui.tooltip.style.bottom = `${px + 12}px`;
    }

    function applyCustomCss(css) {
      if (customCssStyleEl && customCssStyleEl.parentNode) {
        customCssStyleEl.parentNode.removeChild(customCssStyleEl);
      }
      customCssStyleEl = null;
      const raw = String(css || "").trim();
      if (!raw || !ui.shadow) return;
      const style = document.createElement("style");
      style.id = "hq-widget-custom-css";
      style.textContent = raw;
      ui.shadow.appendChild(style);
      customCssStyleEl = style;
    }

    function applyWidgetConfig(config) {
      if (!config) return;
      state.widgetConfig = {
        tooltipText: config.tooltipText || "",
        position: config.position || "bottom-right",
        size: config.size || "medium",
        zIndex: Number.isFinite(Number(config.zIndex)) ? Number(config.zIndex) : null,
        customCss: config.customCss || "",
        themeMode: config.themeMode || "auto",
      };
      if (SCRIPT_POS && ALLOW_SCRIPT_POS.has(SCRIPT_POS)) {
        state.widgetConfig.position = SCRIPT_POS;
      }
      applyPosition(ui.host, state.widgetConfig.position);
      applySize(state.widgetConfig.size);
      ui.host.style.zIndex = state.widgetConfig.zIndex ? String(state.widgetConfig.zIndex) : "2147483647";
      applyCustomCss(state.widgetConfig.customCss);
      applyTooltip();
      if (ui.orb && !state.remoteTheme) {
        const resolvedTheme =
          state.widgetConfig.themeMode === "dark" ||
          (state.widgetConfig.themeMode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
            ? "dark"
            : "light";
        if (resolvedTheme === "light") {
          ui.orb.style.boxShadow = "inset 0 -8px 16px rgba(15, 23, 42, 0.18)";
        }
      }
    }

    function injectThemeCss(css) {
      removeDynamicTheme();
      if (!css || !ui.shadow) return;
      const style = document.createElement("style");
      style.id = "hq-theme-dynamic";
      style.textContent = `
        .orb.hq-theme-remote {
          background: ${css.orbBackground} !important;
          box-shadow: inset 0 -10px 20px rgba(15, 23, 42, 0.35);
        }
        .orb.hq-theme-remote .eye {
          background: ${css.eyeBackground} !important;
        }
        .orb.hq-theme-remote .mouth path {
          stroke: ${css.mouthStroke} !important;
        }
        .ring.hq-theme-remote-ring {
          border-color: ${css.ringBorder} !important;
          box-shadow: ${css.ringShadow} !important;
        }
      `;
      ui.shadow.appendChild(style);
      dynamicStyleEl = style;
      if (ui.orb) ui.orb.classList.add("hq-theme-remote");
      if (ui.ring) ui.ring.classList.add("hq-theme-remote-ring");
    }

    function applyRemoteThemePayload(theme) {
      removeDynamicTheme();

      if (!theme || theme.mode === "default" || theme.mode === "none") {
        state.remoteTheme = null;
        return;
      }

      state.remoteTheme = theme;

      if (theme.mode === "image" && theme.imageUrl) {
        if (ui.orb) {
          ui.orb.classList.add("hq-orb-image");
          ui.orb.style.backgroundImage = `url("${theme.imageUrl}")`;
          ui.orb.style.backgroundSize = "cover";
          ui.orb.style.backgroundPosition = "center";
          ui.orb.style.backgroundRepeat = "no-repeat";
          ui.orb.style.backgroundColor = "#0f172a";
        }
        return;
      }

      if (theme.mode === "css" && theme.css) {
        injectThemeCss(theme.css);
      }
    }

    const t0 = performance.now();

    function applyTooltip() {
      const whiteLabel = Boolean(state.features.whiteLabel);
      const tooltipText = state.widgetConfig.tooltipText || "";
      if (ui.tooltip) {
        if (whiteLabel) {
          ui.tooltip.style.display = tooltipText ? "block" : "none";
        } else {
          ui.tooltip.style.display = "block";
        }
      }
      if (ui.upgrade) ui.upgrade.style.display = state.licenseValid ? "none" : "inline";
      if (ui.tipText) {
        ui.tipText.textContent = whiteLabel ? tooltipText || `${state.mood}` : `Buddy AI companion • ${state.mood}`;
      }
      if (whiteLabel && ui.upgrade) ui.upgrade.style.display = "none";
      if (ui.root) ui.root.setAttribute("aria-label", whiteLabel ? "AI companion" : "Buddy AI companion");
      if (ui.soundToggle) {
        ui.soundToggle.style.display = state.features.voiceSync ? "flex" : "none";
      }
    }

    function applyMood(nextMood, emitAnalytics) {
      if (emitAnalytics === undefined) emitAnalytics = true;
      if (!THEMES[state.themeName][nextMood]) nextMood = "neutral";
      const previousDisplayedMood = state.mood;
      state.mood = nextMood;
      const eyeScale = state.isBlinking
        ? 0.1
        : {
            neutral: 1,
            happy: 0.8,
            thinking: 0.6,
            concerned: 0.9,
            excited: 0.7,
            sleepy: 0.3,
          }[nextMood];
      const browTilt = { neutral: 0, happy: -5, thinking: 10, concerned: 8, excited: -10, sleepy: 0 }[nextMood];
      const mouthCurve = { neutral: 0, happy: 15, thinking: -5, concerned: -10, excited: 20, sleepy: 0 }[nextMood];
      const color = THEMES[state.themeName][nextMood];
      const deep = THEMES[state.themeName].deep;

      ui.leftEye.style.transform = `scaleY(${eyeScale})`;
      ui.rightEye.style.transform = `scaleY(${eyeScale})`;
      ui.leftEye.classList.toggle("heart-eye", state.isHeartEyes);
      ui.rightEye.classList.toggle("heart-eye", state.isHeartEyes);
      if (state.isWinking) ui.rightEye.style.transform = "scaleY(0.1)";
      ui.brows.style.transform = `rotate(${browTilt}deg)`;

      if (state.remoteTheme && state.remoteTheme.mode === "image") {
        ui.orb.style.filter = `drop-shadow(0 0 14px ${color}55)`;
        if (ui.ring) {
          ui.ring.style.borderColor = `${color}55`;
          ui.ring.style.boxShadow = `0 0 18px ${color}44`;
        }
      } else if (state.remoteTheme && state.remoteTheme.mode === "css") {
        if (ui.ring) {
          ui.ring.style.borderColor = `${color}55`;
          ui.ring.style.boxShadow = `0 0 18px ${color}44`;
        }
        ui.orb.style.filter = "none";
      } else {
        ui.orb.style.background = `radial-gradient(circle at 28% 20%, #e2e8f0 0%, ${color} 42%, ${deep} 100%)`;
        ui.orb.style.filter = `drop-shadow(0 0 16px ${color}66)`;
        if (ui.ring) {
          ui.ring.style.borderColor = "";
          ui.ring.style.boxShadow = "";
        }
      }

      ui.mouthPath.setAttribute("d", moodToMouthPath(mouthCurve));

      if (state.features.voiceSync) {
        const amp = state.voiceLevel * 10;
        ui.mouthPath.setAttribute("d", moodToMouthPath(mouthCurve + amp));
      }

      applyTooltip();
      if (emitAnalytics && previousDisplayedMood !== nextMood) {
        sendAnalyticsMoodEvent(nextMood);
        playMoodChime(nextMood);
        syncCollaborativeMood(nextMood);
        if (nextMood === "concerned") {
          showReactionEmoji(Math.random() < 0.5 ? "💧" : "🤗", 2000);
        }
      }
    }

    function sendAnalyticsMoodEvent(mood) {
      if (!LICENSE_KEY) return;
      fetch(`${API_BASE}/api/analytics/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: LICENSE_KEY,
          domain: window.location.hostname,
          mood,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => undefined);
    }

    function animate() {
      const t = (performance.now() - t0) / 1000;
      const breathing = 1 + Math.sin(t * 1.3) * 0.02;
      if (state.features.voiceSync) {
        state.voiceLevel = (Math.sin(t * 4.2) + 1) / 2;
      } else {
        state.voiceLevel = 0;
      }
      ui.orb.style.transform = `scale(${breathing.toFixed(4)})`;
      state.rafId = window.requestAnimationFrame(animate);
    }

    function scheduleBlink() {
      const next = 3000 + Math.random() * 4000;
      window.setTimeout(() => {
        state.isBlinking = true;
        applyMood(state.mood);
        window.setTimeout(() => {
          state.isBlinking = false;
          applyMood(state.mood);
          scheduleBlink();
        }, 150);
      }, next);
    }

    function processLatestMessage() {
      if (state.moodOverride && state.moodOverrideUntil > Date.now()) {
        applyMood(state.moodOverride, false);
        return;
      }
      if (hasTypingIndicator()) {
        window.clearTimeout(state.typingTimeout);
        applyMood("thinking");
        state.typingTimeout = window.setTimeout(() => applyMood(state.previousMood), 2200);
        return;
      }

      const latest = getLatestAIMessage();
      const text = normalizeText(latest.text || "");
      if (!text || text === state.lastMessage) return;
      state.lastMessage = text;
      const lower = text.toLowerCase();
      if (lower.includes("party")) {
        triggerMiniConfetti();
        state.isHeartEyes = false;
      }
      if (lower.includes("secret")) {
        state.isWinking = true;
        showReactionEmoji("🤫");
        window.setTimeout(() => {
          state.isWinking = false;
          applyMood(state.mood, false);
        }, 1000);
      }
      if (lower.includes("love")) {
        state.isHeartEyes = true;
        showReactionEmoji("💖");
        window.setTimeout(() => {
          state.isHeartEyes = false;
          applyMood(state.mood, false);
        }, 1200);
      }
      const mood = detectMood(text, state.previousMood);
      if (lower.includes("party")) {
        state.previousMood = "excited";
        applyMood("excited");
        speakWithLipSync(text);
        return;
      }
      state.previousMood = mood;
      applyMood(mood);
      speakWithLipSync(text);
    }

    async function refreshLicenseState() {
      if (!LICENSE_KEY) return;
      const result = await verifyLicenseKey(LICENSE_KEY);
      state.licenseValid = result.valid;
      state.plan = result.plan || "free";
      state.licenseId = result.licenseId || "";
      state.features = { ...FREE_FEATURES, ...(result.features || {}) };
      state.themeName = state.features.customTheme ? "premium" : "default";
      applyWidgetConfig(result.widgetConfig || {});
      if (result.moodOverride && THEMES[state.themeName][result.moodOverride]) {
        state.moodOverride = result.moodOverride;
        state.moodOverrideUntil = Date.now() + 15000;
        applyMood(result.moodOverride, false);
      } else {
        state.moodOverride = null;
        state.moodOverrideUntil = 0;
      }
      if (state.features.customTheme && LICENSE_KEY) {
        const theme = await fetchRemoteTheme(LICENSE_KEY);
        applyRemoteThemePayload(theme);
      } else {
        applyRemoteThemePayload(null);
      }
      applyTooltip();
      pollCollaborativeMood();
    }

    function scheduleProcess() {
      window.clearTimeout(state.debounceId);
      state.debounceId = window.setTimeout(processLatestMessage, 180);
    }

    state.observer = new MutationObserver(scheduleProcess);
    state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    refreshLicenseState().then(() => applyMood(state.mood, false));
    window.setInterval(refreshLicenseState, 8000);
    window.setInterval(pollCollaborativeMood, 5000);

    if (ui.soundToggle) {
      ui.soundToggle.addEventListener("click", async () => {
        state.soundEnabled = !state.soundEnabled;
        ui.soundToggle.textContent = state.soundEnabled ? "🔊" : "🔈";
        if (state.soundEnabled && audioCtx?.state === "suspended") {
          try {
            await audioCtx.resume();
          } catch {
            // ignore
          }
        }
      });
    }

    applyMood("neutral");
    scheduleBlink();
    animate();
    processLatestMessage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
