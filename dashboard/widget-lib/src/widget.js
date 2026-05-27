import Sentiment from "sentiment";

/*
 * Buddy AI on-device emotion detection.
 * Raw conversations never leave this device.
 */
/* Buddy AI — emotional intelligence embed (Living Face widget bundle) */
(function initLivingFaceWidget() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  /** Default stylesheet — same origin as the widget script (not external CDN). */
  const WIDGET_CSS_PATH = "/widget/buddy-widget.css";
  const TAMPER_REPORT_URL = "https://www.buddieai.com/api/security/tamper-attempt";
  const TRUSTED_POST_MESSAGE_ORIGIN = "https://www.buddieai.com";

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
      zen: "#2dd4bf",
      lit: "#fbbf24",
      deep: "#1e1b4b",
    },
    premium: {
      neutral: "#14b8a6",
      happy: "#10b981",
      thinking: "#eab308",
      concerned: "#f43f5e",
      excited: "#8b5cf6",
      sleepy: "#475569",
      zen: "#5eead4",
      lit: "#fcd34d",
      deep: "#0f172a",
    },
  };

  const DISPLAY_MOODS = ["neutral", "happy", "thinking", "concerned", "excited", "sleepy", "zen", "lit"];
  const ANALYTICS_MOODS = new Set(["neutral", "happy", "thinking", "concerned", "excited", "sleepy"]);
  const PARTY_WORDS = ["party", "celebrate", "lit"];
  const CHILL_WORDS = ["chill", "relax", "vibe"];
  const TRIPPY_WORDS = ["trippy", "wild"];

  const HAPPY_WORDS = ["amazing", "awesome", "great", "love", "perfect", "thanks", "wow", "excellent"];
  const SAD_WORDS = ["wrong", "bad", "error", "fix", "broken", "hate", "terrible", "useless"];
  const EXCITED_WORDS = ["incredible", "fantastic", "brilliant", "outstanding", "superb", "best"];
  const QUESTION_WORDS = ["how", "what", "why", "explain", "help", "?"];
  const SLEEPY_WORDS = ["sleep", "rest", "tired", "late", "exhausted", "fatigue", "nap"];
  const sentimentAnalyzer = new Sentiment();
  const OPTIN_KEY = "buddy_analytics_opt_in";
  const SERVER_ANALYTICS_KEY = "buddy_server_anonymous_analytics";
  const SESSION_TOKEN_KEY = "buddy_analytics_session_token";

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
  const cfg = {
    licenseKey: (scriptEl?.getAttribute("data-hq-key") || "").trim(),
    apiBase: (scriptEl?.getAttribute("data-hq-api") || "https://yourdomain.com").replace(/\/$/, ""),
    verifyDomain: (scriptEl?.getAttribute("data-hq-domain") || "").trim().toLowerCase(),
    cssHref: (scriptEl?.getAttribute("data-hq-css") || "").trim(),
  };
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
    partyModeUntil: 0,
    chillMode: false,
    trippyMode: false,
    trippyTimer: 0,
    trippyLandMood: "neutral",
    lastParticleSpawn: 0,
    suppressBreathingRaf: false,
    analyticsOptIn: readAnalyticsOptIn(),
    analyticsPromptShown: false,
  };

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function anonymizedSessionTokenFromLicense(licenseKey) {
    const seed = String(licenseKey || "").trim();
    if (!seed) return "";
    let hash = 2166136261;
    const source = `${seed}:buddy-private-v1`;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `bdy_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function readAnalyticsOptIn() {
    try {
      const raw = window.localStorage.getItem(OPTIN_KEY);
      if (raw === "yes") return true;
      if (raw === "no") return false;
    } catch {
      /* ignore */
    }
    return null;
  }

  function writeAnalyticsOptIn(value) {
    try {
      window.localStorage.setItem(OPTIN_KEY, value ? "yes" : "no");
    } catch {
      /* ignore */
    }
  }

  function getSessionToken() {
    try {
      const stored = window.localStorage.getItem(SESSION_TOKEN_KEY);
      if (stored) return stored;
      const generated = anonymizedSessionTokenFromLicense(cfg.licenseKey) || `bdy_${Date.now().toString(16)}`;
      window.localStorage.setItem(SESSION_TOKEN_KEY, generated);
      return generated;
    } catch {
      return anonymizedSessionTokenFromLicense(cfg.licenseKey) || `bdy_${Date.now().toString(16)}`;
    }
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
    const sentimentScore = sentimentAnalyzer.analyze(t).score;
    if (sentimentScore >= 4) return "excited";
    if (sentimentScore >= 2) return "happy";
    if (sentimentScore <= -4) return "concerned";
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

  function reportTamperAttempt(payload) {
    const body = {
      type: String((payload && payload.type) || "widget").slice(0, 80),
      detail: String((payload && payload.detail) || "").slice(0, 2000),
      path: window.location && window.location.pathname ? String(window.location.pathname).slice(0, 500) : "",
    };
    fetch(TAMPER_REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      mode: "cors",
      keepalive: true,
    }).catch(function () {});
  }

  let buddyConsoleGuardInstalled = false;
  function installConsoleTamperGuard() {
    if (buddyConsoleGuardInstalled) return;
    buddyConsoleGuardInstalled = true;
    const nativeLog = console.log.bind(console);
    function wrappedLog() {
      for (let i = 0; i < arguments.length; i += 1) {
        const arg = arguments[i];
        if (typeof arg === "string" && arg.toLowerCase().indexOf("buddy-ai") !== -1) {
          reportTamperAttempt({ type: "console_probe", detail: "buddy-ai string in console.log" });
          break;
        }
      }
      return nativeLog.apply(console, arguments);
    }
    console.log = wrappedLog;
  }

  function isTrustedPostMessage(ev) {
    if (ev.origin !== TRUSTED_POST_MESSAGE_ORIGIN) return false;
    if (!ev.data || typeof ev.data !== "object" || Array.isArray(ev.data)) return false;
    return Object.prototype.hasOwnProperty.call(ev.data, "type") && Object.prototype.hasOwnProperty.call(ev.data, "payload");
  }

  function installPostMessageGuard() {
    window.addEventListener(
      "message",
      function (ev) {
        if (!isTrustedPostMessage(ev)) return;
      },
      false,
    );
  }

  function resolveWidgetCssHref() {
    if (cfg.cssHref) return cfg.cssHref;
    const scriptSrc = scriptEl?.src || "";
    if (scriptSrc) {
      try {
        return new URL(WIDGET_CSS_PATH, scriptSrc).href;
      } catch {
        /* fall through */
      }
    }
    return `${cfg.apiBase.replace(/\/$/, "")}${WIDGET_CSS_PATH}`;
  }

  function appendWidgetStylesheet(shadow) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = resolveWidgetCssHref();
    shadow.appendChild(link);
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
    appendWidgetStylesheet(shadow);
    const tpl = document.createElement("template");
    tpl.innerHTML = `
      <div class="root" aria-label="Buddy AI companion">
        <button class="sound-toggle" aria-label="Toggle widget sound">🔈</button>
        <div class="aura-stack">
          <div class="ring"></div>
          <div class="particle-field"></div>
          <div class="party-confetti"></div>
          <div class="mini-confetti"></div>
          <div class="orb" data-mood="neutral">
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
          <div class="smoke-ring"></div>
          <div class="sparkle-burst"></div>
        </div>
        <div class="orb-hotspot" aria-hidden="true" title="Say hi to Buddy"></div>
        <div class="tooltip">
          <span class="tip-text">Buddy AI companion • neutral</span>
          <a class="upgrade" href="${cfg.apiBase}/pricing" target="_blank" rel="noopener noreferrer">Upgrade</a>
        </div>
        <div class="reaction-emoji">🤫</div>
      </div>
    `;
    shadow.appendChild(tpl.content);

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
      partyConfetti: shadow.querySelector(".party-confetti"),
      particleField: shadow.querySelector(".particle-field"),
      auraStack: shadow.querySelector(".aura-stack"),
      orbHotspot: shadow.querySelector(".orb-hotspot"),
      smokeRing: shadow.querySelector(".smoke-ring"),
      sparkleBurst: shadow.querySelector(".sparkle-burst"),
    };
  }

  function moodInTheme(themeName, mood) {
    return Boolean(THEMES[themeName] && THEMES[themeName][mood]);
  }

  function analyticsSafeMood(mood) {
    return ANALYTICS_MOODS.has(mood) ? mood : mood === "lit" ? "excited" : mood === "zen" ? "neutral" : "neutral";
  }

  function moodToMouthPath(curve) {
    const y = 9;
    const c = y - curve / 2;
    return `M4 ${y} Q17 ${c} 30 ${y}`;
  }

  async function verifyLicenseKey(key) {
    if (!key) return { valid: false, features: FREE_FEATURES };
    try {
      const domain = encodeURIComponent(cfg.verifyDomain || window.location.hostname);
      const res = await fetch(`${cfg.apiBase}/api/licenses/verify?key=${encodeURIComponent(key)}&domain=${domain}`, {
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
      const domain = encodeURIComponent(cfg.verifyDomain || window.location.hostname);
      const res = await fetch(`${cfg.apiBase}/api/licenses/theme?key=${encodeURIComponent(key)}&domain=${domain}`, {
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

    function privacyStatusLine() {
      if (state.analyticsOptIn === true) {
        return "Anonymous mood data helps Buddy improve — no raw text ever shared.";
      }
      return "Your emotions never leave this device.";
    }

    function showAnalyticsConsentPrompt() {
      if (state.analyticsPromptShown || state.analyticsOptIn !== null || !ui.shadow) return;
      state.analyticsPromptShown = true;

      const prompt = document.createElement("div");
      prompt.setAttribute("role", "dialog");
      prompt.setAttribute("aria-live", "polite");
      prompt.style.position = "absolute";
      prompt.style.left = "50%";
      prompt.style.bottom = "96px";
      prompt.style.transform = "translateX(-50%)";
      prompt.style.maxWidth = "260px";
      prompt.style.padding = "10px 12px";
      prompt.style.borderRadius = "12px";
      prompt.style.border = "1px solid rgba(167,243,208,0.28)";
      prompt.style.background = "rgba(15,23,42,0.94)";
      prompt.style.backdropFilter = "blur(8px)";
      prompt.style.color = "rgba(226,232,240,0.92)";
      prompt.style.fontSize = "11px";
      prompt.style.lineHeight = "1.4";
      prompt.style.boxShadow = "0 12px 30px rgba(2,6,23,0.45)";
      prompt.style.zIndex = "2147483647";
      prompt.innerHTML = `
        <div style="margin-bottom:8px;">Share anonymous mood labels to improve Buddy? No chat text — ever. Manage granular choices in your Buddie AI settings.</div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button data-opt="no" style="border:1px solid rgba(148,163,184,0.4); background:transparent; color:#cbd5e1; border-radius:999px; padding:4px 10px; font-size:11px;">No</button>
          <button data-opt="yes" style="border:1px solid rgba(16,185,129,0.45); background:rgba(16,185,129,0.2); color:#d1fae5; border-radius:999px; padding:4px 10px; font-size:11px;">Yes</button>
        </div>
      `;
      ui.shadow.appendChild(prompt);

      const clickHandler = (ev) => {
        const button = ev.target.closest("button[data-opt]");
        if (!button) return;
        const opt = button.getAttribute("data-opt") === "yes";
        state.analyticsOptIn = opt;
        writeAnalyticsOptIn(opt);
        applyTooltip();
        prompt.remove();
      };
      prompt.addEventListener("click", clickHandler);
      window.setTimeout(() => {
        if (prompt.isConnected && state.analyticsOptIn === null) prompt.remove();
      }, 15000);
    }

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

    function triggerPartyConfetti() {
      if (!ui.partyConfetti) return;
      ui.partyConfetti.textContent = "";
      const colors = ["#ff6bcb", "#67e8f9", "#c4b5fd", "#fbbf24", "#34d399", "#fb7185", "#a78bfa", "#22d3ee"];
      const count = 32 + Math.floor(Math.random() * 9);
      for (let i = 0; i < count; i += 1) {
        const piece = document.createElement("span");
        piece.className = "party-piece";
        const w = 4 + Math.random() * 8;
        const h = 4 + Math.random() * 10;
        piece.style.width = `${w}px`;
        piece.style.height = `${h}px`;
        piece.style.background = colors[i % colors.length];
        piece.style.setProperty("--cx", `${(Math.random() - 0.5) * 120}px`);
        piece.style.setProperty("--cy", `${-40 - Math.random() * 90}px`);
        piece.style.setProperty("--cr", `${Math.random() * 720 - 360}deg`);
        piece.style.animationDelay = `${Math.random() * 0.25}s`;
        ui.partyConfetti.appendChild(piece);
      }
      state.partyModeUntil = Date.now() + 3000;
      window.setTimeout(() => {
        if (ui.partyConfetti) ui.partyConfetti.textContent = "";
      }, 3200);
    }

    function setChillMode(on) {
      state.chillMode = Boolean(on);
      if (ui.orb) ui.orb.classList.toggle("chill-mode", state.chillMode);
      state.suppressBreathingRaf = state.chillMode;
    }

    function clearTrippyMode(landOn) {
      window.clearInterval(state.trippyTimer);
      state.trippyTimer = 0;
      state.trippyMode = false;
      if (ui.orb) ui.orb.classList.remove("trippy-mode");
      const target = landOn && moodInTheme(state.themeName, landOn) ? landOn : "neutral";
      applyMood(target, false);
    }

    function startTrippyCycle(landMood) {
      state.trippyLandMood = landMood || "neutral";
      state.trippyMode = true;
      if (ui.orb) ui.orb.classList.add("trippy-mode");
      let idx = 0;
      window.clearInterval(state.trippyTimer);
      state.trippyTimer = window.setInterval(() => {
        const mood = DISPLAY_MOODS[idx % DISPLAY_MOODS.length];
        idx += 1;
        applyMood(mood, false);
      }, 175);
      window.setTimeout(() => clearTrippyMode(state.trippyLandMood), 2000);
    }

    function moodParticleColor(mood) {
      const c = THEMES[state.themeName][mood] || THEMES[state.themeName].neutral;
      return c;
    }

    function spawnFloatingParticle(burst) {
      if (!ui.particleField) return;
      const mood = state.mood;
      const color = moodParticleColor(mood);
      const el = document.createElement("span");
      el.className = burst ? "particle particle-burst" : "particle";
      const size = burst ? 5 + Math.random() * 4 : 3 + Math.random() * 2;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = color;
      el.style.left = `${35 + Math.random() * 30}%`;
      el.style.top = `${40 + Math.random() * 25}%`;
      if (burst) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 42;
        el.style.setProperty("--bx", `${Math.cos(angle) * dist}px`);
        el.style.setProperty("--by", `${Math.sin(angle) * dist}px`);
      } else {
        el.style.setProperty("--px", `${(Math.random() - 0.5) * 16}px`);
        el.style.setProperty("--py", `${-32 - Math.random() * 48}px`);
      }
      ui.particleField.appendChild(el);
      window.setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, burst ? 900 : 2400);
    }

    function spawnParticleBurst() {
      const n = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i += 1) spawnFloatingParticle(true);
    }

    function triggerSparkleBurst() {
      if (!ui.sparkleBurst) return;
      ui.sparkleBurst.textContent = "";
      for (let i = 0; i < 10; i += 1) {
        const s = document.createElement("span");
        s.className = "sparkle";
        s.style.left = `${38 + Math.random() * 24}%`;
        s.style.top = `${38 + Math.random() * 24}%`;
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 22;
        s.style.setProperty("--sx", `${Math.cos(angle) * dist}px`);
        s.style.setProperty("--sy", `${Math.sin(angle) * dist}px`);
        ui.sparkleBurst.appendChild(s);
      }
      window.setTimeout(() => {
        if (ui.sparkleBurst) ui.sparkleBurst.textContent = "";
      }, 700);
    }

    function triggerSmokeRing() {
      if (!ui.smokeRing) return;
      ui.smokeRing.classList.remove("pop");
      void ui.smokeRing.offsetWidth;
      ui.smokeRing.classList.add("pop");
      window.setTimeout(() => ui.smokeRing && ui.smokeRing.classList.remove("pop"), 750);
    }

    function syncOrbMoodClasses(mood) {
      if (!ui.orb) return;
      ui.orb.setAttribute("data-mood", mood);
      DISPLAY_MOODS.forEach((m) => ui.orb.classList.remove(`mood-${m}`));
      ui.orb.classList.add(`mood-${mood}`);
      ui.orb.classList.toggle("party-mode", Date.now() < state.partyModeUntil);
    }

    function setupOrbInteraction() {
      if (!ui.orbHotspot || !ui.root) return;
      let wiggleTimer = 0;
      ui.orbHotspot.addEventListener("mouseenter", () => {
        ui.root.classList.add("orb-hover-intense");
        ui.root.classList.add("orb-wiggle");
        window.clearTimeout(wiggleTimer);
        wiggleTimer = window.setTimeout(() => ui.root.classList.remove("orb-wiggle"), 480);
      });
      ui.orbHotspot.addEventListener("mouseleave", () => {
        ui.root.classList.remove("orb-hover-intense");
      });
      ui.orbHotspot.addEventListener(
        "touchstart",
        () => {
          ui.root.classList.add("orb-hover-intense", "orb-wiggle");
        },
        { passive: true },
      );
      ui.orbHotspot.addEventListener(
        "touchend",
        () => {
          ui.root.classList.remove("orb-hover-intense", "orb-wiggle");
        },
        { passive: true },
      );
      ui.orbHotspot.addEventListener("click", () => {
        if (ui.orb) {
          ui.orb.classList.remove("pulse-click");
          void ui.orb.offsetWidth;
          ui.orb.classList.add("pulse-click");
          window.setTimeout(() => ui.orb && ui.orb.classList.remove("pulse-click"), 520);
        }
        triggerSmokeRing();
        triggerSparkleBurst();
        spawnParticleBurst();
        showReactionEmoji("✨", 900);
      });
    }

    function playMoodChime(mood) {
      if (!state.soundEnabled || !audioCtx) return;
      const noteMap = {
        neutral: 261.63,
        happy: 329.63,
        thinking: 392,
        concerned: 220,
        excited: 440,
        sleepy: 246.94,
        zen: 293.66,
        lit: 466.16,
      };
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
      fetch(`${cfg.apiBase}/api/widget/mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId: state.licenseId, mood, ttlSeconds: 120 }),
      }).catch(() => undefined);
    }

    async function pollCollaborativeMood() {
      if (state.plan !== "agency" || !state.licenseId) return;
      try {
        const res = await fetch(`${cfg.apiBase}/api/widget/mood?licenseId=${encodeURIComponent(state.licenseId)}`, {
          method: "GET",
        });
        const data = await res.json();
        if (res.ok && data.mood && data.mood !== state.mood && moodInTheme(state.themeName, data.mood)) {
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
        ui.tipText.textContent = whiteLabel
          ? tooltipText || `${state.mood}`
          : `Buddy AI companion • ${state.mood} • ${privacyStatusLine()}`;
      }
      if (whiteLabel && ui.upgrade) ui.upgrade.style.display = "none";
      if (ui.root) ui.root.setAttribute("aria-label", whiteLabel ? "AI companion" : "Buddy AI companion");
      if (ui.soundToggle) {
        ui.soundToggle.style.display = state.features.voiceSync ? "flex" : "none";
      }
    }

    function applyMood(nextMood, emitAnalytics) {
      if (emitAnalytics === undefined) emitAnalytics = true;
      if (!moodInTheme(state.themeName, nextMood)) nextMood = "neutral";
      const previousDisplayedMood = state.mood;
      const moodChanged = previousDisplayedMood !== nextMood;
      state.mood = nextMood;
      syncOrbMoodClasses(nextMood);

      const eyeScale = state.isBlinking
        ? 0.1
        : {
            neutral: 1,
            happy: 0.75,
            thinking: 0.6,
            concerned: 0.88,
            excited: 0.65,
            sleepy: 0.3,
            zen: 0.92,
            lit: 0.7,
          }[nextMood];
      const browTilt = {
        neutral: 0,
        happy: -5,
        thinking: 10,
        concerned: 14,
        excited: -10,
        sleepy: 0,
        zen: -2,
        lit: -8,
      }[nextMood];
      let mouthCurve = {
        neutral: 0,
        happy: 22,
        thinking: -5,
        concerned: -14,
        excited: 20,
        sleepy: 0,
        zen: 6,
        lit: 24,
      }[nextMood];
      const color = THEMES[state.themeName][nextMood];
      const deep = THEMES[state.themeName].deep;

      ui.leftEye.style.transform = `scaleY(${eyeScale})`;
      ui.rightEye.style.transform = `scaleY(${eyeScale})`;
      ui.leftEye.classList.toggle("heart-eye", state.isHeartEyes);
      ui.rightEye.classList.toggle("heart-eye", state.isHeartEyes);
      if (state.isWinking) ui.rightEye.style.transform = "scaleY(0.1)";
      ui.brows.style.transform = `rotate(${browTilt}deg)`;

      if (state.remoteTheme && state.remoteTheme.mode === "image") {
        ui.orb.style.setProperty("--mood-glow", `${color}88`);
        if (ui.ring) {
          ui.ring.style.opacity = "0.9";
        }
      } else if (state.remoteTheme && state.remoteTheme.mode === "css") {
        ui.orb.style.setProperty("--mood-glow", `${color}66`);
      } else {
        const highlight =
          nextMood === "lit"
            ? "#fef08a"
            : nextMood === "zen"
              ? "#ccfbf1"
              : nextMood === "excited"
                ? "#f5d0fe"
                : "#fbcfe8";
        ui.orb.style.background = `radial-gradient(circle at 28% 20%, ${highlight} 0%, ${color} 40%, ${deep} 100%)`;
        ui.orb.style.setProperty("--mood-glow", `${color}88`);
        if (ui.ring) {
          ui.ring.style.opacity = "";
        }
      }

      ui.mouthPath.setAttribute("d", moodToMouthPath(mouthCurve));

      if (state.features.voiceSync) {
        const amp = state.voiceLevel * 10;
        ui.mouthPath.setAttribute("d", moodToMouthPath(mouthCurve + amp));
      }

      if (moodChanged && !state.trippyMode) spawnParticleBurst();

      applyTooltip();
      if (emitAnalytics && moodChanged) {
        sendAnalyticsMoodEvent(nextMood);
        playMoodChime(nextMood);
        syncCollaborativeMood(analyticsSafeMood(nextMood));
        if (nextMood === "concerned") {
          showReactionEmoji(Math.random() < 0.5 ? "💧" : "🤗", 2000);
        }
        if (nextMood === "lit" || nextMood === "excited") {
          showReactionEmoji("✨", 1100);
        }
      }
    }

    function inferEidataSource() {
      const h = (window.location.hostname || "").toLowerCase();
      if (h.includes("chatgpt") || h.includes("openai")) return "chatgpt";
      if (h.includes("claude")) return "claude";
      if (h.includes("gemini") || h.includes("google")) return "gemini";
      if (h.includes("buddieai")) return "website";
      return "unknown";
    }

    function serverAnonymousAnalyticsGranted() {
      try {
        return window.localStorage.getItem(SERVER_ANALYTICS_KEY) === "granted";
      } catch {
        return false;
      }
    }

    function refreshServerConsentStatus() {
      const sessionToken = getSessionToken();
      if (!sessionToken) return;
      const q = new URLSearchParams({ sessionToken });
      if (cfg.licenseKey) q.set("licenseKey", cfg.licenseKey);
      fetch(`${cfg.apiBase}/api/consent/status?${q.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const granted = Boolean(data.anonymous_analytics);
          try {
            window.localStorage.setItem(SERVER_ANALYTICS_KEY, granted ? "granted" : "denied");
            if (granted) window.localStorage.setItem(OPTIN_KEY, "yes");
          } catch {
            /* ignore */
          }
        })
        .catch(() => undefined);
    }

    function sendAnalyticsMoodEvent(mood) {
      if (state.analyticsOptIn !== true) return;
      if (!serverAnonymousAnalyticsGranted()) return;
      const safe = analyticsSafeMood(mood);
      const sessionToken = getSessionToken();
      if (!sessionToken) return;
      const payload = {
        sessionToken,
        mood: safe,
        timestamp: new Date().toISOString(),
        companionType: "buddy",
        source: inferEidataSource(),
      };
      const headers = {
        "Content-Type": "application/json",
        "X-Buddy-Widget-Opt-In": "yes",
      };
      fetch(`${cfg.apiBase}/api/analytics/anonymized-event`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }

    function animate() {
      const now = performance.now();
      const t = (now - t0) / 1000;

      if (!state.suppressBreathingRaf && !state.trippyMode && ui.orb) {
        const skipTransform =
          ui.orb.classList.contains("mood-happy") ||
          ui.orb.classList.contains("mood-lit") ||
          ui.orb.classList.contains("mood-concerned") ||
          ui.orb.classList.contains("chill-mode");
        if (!skipTransform) {
          const breathing = 1 + Math.sin(t * 1.3) * 0.02;
          ui.orb.style.transform = `scale(${breathing.toFixed(4)})`;
        }
      }

      if (state.features.voiceSync) {
        state.voiceLevel = (Math.sin(t * 4.2) + 1) / 2;
      } else {
        state.voiceLevel = 0;
      }

      if (now - state.lastParticleSpawn > 650 + Math.random() * 200) {
        state.lastParticleSpawn = now;
        if (!state.trippyMode) spawnFloatingParticle(false);
      }

      if (ui.orb) {
        ui.orb.classList.toggle("party-mode", now < state.partyModeUntil);
      }

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

    function messageHasWord(lower, words) {
      return words.some((w) => lower.includes(w));
    }

    function processLatestMessage() {
      if (state.moodOverride && state.moodOverrideUntil > Date.now()) {
        applyMood(state.moodOverride, false);
        return;
      }
      if (hasTypingIndicator()) {
        window.clearTimeout(state.typingTimeout);
        setChillMode(false);
        applyMood("thinking");
        state.typingTimeout = window.setTimeout(() => applyMood(state.previousMood), 2200);
        return;
      }

      const latest = getLatestAIMessage();
      const text = normalizeText(latest.text || "");
      if (!text || text === state.lastMessage) return;
      state.lastMessage = text;
      const lower = text.toLowerCase();
      showAnalyticsConsentPrompt();

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

      if (messageHasWord(lower, PARTY_WORDS)) {
        setChillMode(false);
        state.isHeartEyes = false;
        triggerPartyConfetti();
        triggerMiniConfetti();
        state.previousMood = "excited";
        applyMood("excited");
        speakWithLipSync(text);
        return;
      }

      if (messageHasWord(lower, CHILL_WORDS)) {
        setChillMode(true);
        state.previousMood = mood === "excited" ? "zen" : mood;
        applyMood("zen");
        speakWithLipSync(text);
        return;
      }

      if (messageHasWord(lower, TRIPPY_WORDS)) {
        setChillMode(false);
        startTrippyCycle(mood);
        speakWithLipSync(text);
        return;
      }

      setChillMode(false);
      state.previousMood = mood;
      applyMood(mood);
      speakWithLipSync(text);
    }

    async function refreshLicenseState() {
      if (!cfg.licenseKey) return;
      const result = await verifyLicenseKey(cfg.licenseKey);
      state.licenseValid = result.valid;
      state.plan = result.plan || "free";
      state.licenseId = result.licenseId || "";
      state.features = { ...FREE_FEATURES, ...(result.features || {}) };
      state.themeName = state.features.customTheme ? "premium" : "default";
      applyWidgetConfig(result.widgetConfig || {});
      if (result.moodOverride && moodInTheme(state.themeName, result.moodOverride)) {
        state.moodOverride = result.moodOverride;
        state.moodOverrideUntil = Date.now() + 15000;
        applyMood(result.moodOverride, false);
      } else {
        state.moodOverride = null;
        state.moodOverrideUntil = 0;
      }
      if (state.features.customTheme && cfg.licenseKey) {
        const theme = await fetchRemoteTheme(cfg.licenseKey);
        applyRemoteThemePayload(theme);
      } else {
        applyRemoteThemePayload(null);
      }
      applyTooltip();
      pollCollaborativeMood();
      refreshServerConsentStatus();
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

    setupOrbInteraction();
    state.lastParticleSpawn = performance.now();
    applyMood("neutral");
    scheduleBlink();
    animate();
    processLatestMessage();
  }

  let buddyBootStarted = false;
  function bootBuddyWidget(opts) {
    if (buddyBootStarted) return;
    buddyBootStarted = true;
    if (opts && typeof opts === "object") {
      if (opts.licenseKey != null && String(opts.licenseKey).trim() !== "")
        cfg.licenseKey = String(opts.licenseKey).trim();
      if (opts.apiBase != null && String(opts.apiBase).trim() !== "")
        cfg.apiBase = String(opts.apiBase).replace(/\/$/, "");
      if (opts.verifyDomain != null && String(opts.verifyDomain).trim() !== "")
        cfg.verifyDomain = String(opts.verifyDomain).trim().toLowerCase();
      if (opts.domain != null && String(opts.domain).trim() !== "")
        cfg.verifyDomain = String(opts.domain).trim().toLowerCase();
      if (opts.cssHref != null && String(opts.cssHref).trim() !== "") cfg.cssHref = String(opts.cssHref).trim();
    }
    installConsoleTamperGuard();
    installPostMessageGuard();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  window.BuddyAI = {
    init: function initBuddyWidget(config) {
      bootBuddyWidget(config && typeof config === "object" ? config : {});
    },
    getPrivacyMode: function getPrivacyMode() {
      return true;
    },
  };

  if (scriptEl?.getAttribute("data-hq-manual-init") !== "true") {
    window.BuddyAI.init({});
  }
})();
