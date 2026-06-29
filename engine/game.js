const DEV_MODE = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
if (!DEV_MODE) {
    // eslint-disable-next-line no-console
    console.log = () => { };
}

/** @type {Object} Engine configuration constants */
const ENGINE_CONFIG = Object.freeze({
    TRANSITION_DURATION: 500,
    SCENE_CHANGE_DELAY: 300,
    TYPEWRITER_SPEED: 40,
    NOTIFICATION_DURATION: 3000,
    NOTIFICATION_FADE: 500,
    DEFAULT_TIME: '08:00',
    DEFAULT_DAY: 1,
    HOURS_IN_DAY: 24,
    MINUTES_IN_HOUR: 60,
});

/**
 * Utility: attach both click and touchend handlers to an element.
 * @param {HTMLElement} el
 * @param {Function} handler
 */
function addInteractionHandler(el, handler) {
    if (!el) return;
    el.addEventListener('click', handler);
    el.addEventListener('touchend', handler);
}

class CyberGuardEngine {
    /**
     * @param {Object} [deps] - Optional dependency overrides for testing
     * @param {Object} [deps.voiceManager]
     * @param {Function} [deps.PlayerCharacter]
     * @param {Storage} [deps.storage] - Storage backend (default: localStorage)
     */
    constructor(deps = {}) {
        this.currentScene = null;
        this.scenes = {};
        this._defaultGameState = Object.freeze({
            questsCompleted: [],
            activeQuests: [],
            flags: {}
        });
        this._saveVersion = 2; // Bump when save format changes
        this.gameState = JSON.parse(JSON.stringify(this._defaultGameState));
        this.dialogueQueue = [];
        this.isDialogueActive = false;
        this.initialized = false;
        this._sceneLoading = false;
        this.voiceEnabled = true;
        this.voiceManager = null;
        this.player = null;
        this.typewriterAbortController = null;
        this.isPaused = false;
        this._autoAdvanceTimer = null;

        // Dependency injection for testing
        this._deps = deps;
        // Respect explicit null: only fall back to localStorage if 'storage' was NOT provided at all
        this._storage = ('storage' in deps) ? deps.storage : (typeof localStorage !== 'undefined' ? localStorage : null);

        // Track event handlers for cleanup
        this._boundHandlers = [];

        // Track scene-scoped timeouts — auto-cleared on scene exit
        this._sceneTimeouts = [];

        // Mutable per-session settings (mirrors ENGINE_CONFIG defaults)
        this.settings = {
            textSpeed: 40,  // ms per character (0 = instant)
            animSpeed: 500,  // ms for scene fade transitions (0 = none)
            autoAdvanceDelay: 0,  // ms before auto-advancing dialogue (0 = manual)
            materiPauseDuration: 1500, // ms pause after documentary speech finishes
            accessibilityMode: false, // 🎬 Movie mode — auto-plays story path, voices and puzzles
        };

        // Accessibility mode runner state
        this.accessibilityMode = false;
        this._accessibilityRunnerActive = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Create DOM structure
        this.createGameContainer();
        this._loadSettings();
        this._applySettings();
        this.bindEvents();
        this.loadGameState();

        // Initialize voice manager (ensure it's connected)
        this.voiceManager = this._resolveDep('voiceManager', 'voiceManager');
        if (this.voiceManager) {
            console.log('Voice system connected');
        } else {
            console.warn('Voice system not available');
        }

        // Initialize player character
        this.initPlayer();

        // console.log('CyberGuard Engine initialized');
    }

    /**
     * Resolve a dependency: if explicitly provided (even as null), use it;
     * otherwise fall back to the window global.
     */
    _resolveDep(depKey, globalKey) {
        if (depKey in this._deps) return this._deps[depKey];
        return (typeof window !== 'undefined' ? window[globalKey] : null) || null;
    }

    initPlayer() {
        const PlayerCharacterClass = this._resolveDep('PlayerCharacter', 'PlayerCharacter');
        if (PlayerCharacterClass) {
            this.player = new PlayerCharacterClass(this);
            this.player.init();
            console.log('Player character initialized');
        }
    }

    createGameContainer() {
        const container = document.getElementById('game-container');
        if (!container) {
            console.error('Game container not found');
            return;
        }

        container.innerHTML = `
            <div id="game-top-bar">
                <div id="quest-log">
                    <div id="quest-toggle">
                        <span class="label">What To Do</span>
                    </div>
                    <div id="quest-list" class="hidden"></div>
                </div>
            </div>
            <div id="scene-wrapper">
                <div id="scene-container">
                    <div id="scene-background"></div>
                    <div id="scene-hotspots"></div>
                    <div id="scene-characters"></div>
                    <div id="scene-transition-overlay">
                        <div class="trans-curtain"></div>
                        <div class="trans-sweep"></div>
                        <div class="trans-flash"></div>
                    </div>
                    <div id="ui-overlay">
                        <div id="dialogue-box" class="hidden">
                            <div id="dialogue-portrait"></div>
                            <div id="dialogue-content">
                                <div id="dialogue-speaker"></div>
                                <div id="dialogue-text"></div>
                            </div>
                            <div id="dialogue-continue">Sentuh untuk lanjut...</div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="pause-overlay" class="hidden">
                <div id="pause-content">
                    <div id="pause-icon">⏸️</div>
                    <div id="pause-title">Sistem sedang dijeda</div>
                    <div id="pause-hint">Sentuh untuk lanjut</div>
                </div>
            </div>
            <div id="notification-area"></div>
            <div id="accessibility-badge" class="hidden">🎬 Movie Mode</div>
        `;
    }

    /**
     * Register a global event handler and track it for cleanup.
     * @param {EventTarget} target
     * @param {string} event
     * @param {Function} handler
     * @param {Object} [options]
     */
    _addTrackedListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        this._boundHandlers.push({ target, event, handler, options });
    }

    bindEvents() {
        // Dialogue continuation (click and touch)
        const handleDialogueInteraction = (e) => {
            if (this.isPaused) return;
            if (this.isDialogueActive && e.target.closest('#dialogue-box')) {
                e.preventDefault();
                this.advanceDialogue();
            }
        };
        this._addTrackedListener(document, 'click', handleDialogueInteraction);
        this._addTrackedListener(document, 'touchend', handleDialogueInteraction);

        // Scene interaction for walking (click and touch)
        const handleSceneInteraction = (e) => {
            // Don't walk if paused, clicking on UI, hotspots, or during dialogue/puzzle
            if (this.isPaused) return;
            if (this.isDialogueActive || this.isPuzzleActive) return;
            if (e.target.closest('.hotspot')) return;
            if (e.target.closest('#ui-overlay')) return;
            if (e.target.closest('#game-top-bar')) return;
            if (e.target.closest('#game-bottom-bar')) return;

            e.preventDefault();

            // Calculate position as percentage
            const sceneContainer = document.getElementById('scene-container');
            if (!sceneContainer) return;
            const rect = sceneContainer.getBoundingClientRect();

            // Handle both touch and mouse events — use changedTouches for touchend
            const touch = e.touches?.[0] || e.changedTouches?.[0];
            const clientX = touch ? touch.clientX : e.clientX;
            const clientY = touch ? touch.clientY : e.clientY;

            const x = ((clientX - rect.left) / rect.width) * 100;
            const y = ((clientY - rect.top) / rect.height) * 100;

            // Walk to position
            if (this.player) {
                this.player.walkTo(x, y);
            }
        };
        const sceneEl = document.getElementById('scene-container');
        if (sceneEl) {
            this._addTrackedListener(sceneEl, 'click', handleSceneInteraction);
            this._addTrackedListener(sceneEl, 'touchstart', handleSceneInteraction);
        }

        // Quest log toggle (click and touch)
        const questToggle = document.getElementById('quest-toggle');
        const toggleQuest = (e) => {
            e.preventDefault();
            document.getElementById('quest-list')?.classList.toggle('hidden');
        };
        questToggle?.addEventListener('click', toggleQuest);
        questToggle?.addEventListener('touchend', toggleQuest);

        // Menu buttons (click and touch)
        const addButtonHandler = (id, handler) => {
            const btn = document.getElementById(id);
            const wrappedHandler = (e) => { e.preventDefault(); handler(); };
            btn?.addEventListener('click', wrappedHandler);
            btn?.addEventListener('touchend', wrappedHandler);
        };
        addButtonHandler('menu-save', () => this.openSaveSlotModal('save'));
        addButtonHandler('menu-load', () => this.openSaveSlotModal('load'));
        addButtonHandler('menu-voice', () => this.toggleVoice());
        addButtonHandler('menu-movie', () => this.toggleAccessibilityMode());
        addButtonHandler('menu-hint', () => this.showHint());
        addButtonHandler('menu-settings', () => this.openSettingsModal());

        // Pause overlay — click to resume
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) {
            const resumeHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.isPaused) this.togglePause();
            };
            pauseOverlay.addEventListener('click', resumeHandler);
            pauseOverlay.addEventListener('touchend', resumeHandler);
        }

        // Keyboard shortcuts
        const keyHandler = (e) => {
            // Pause toggle — always available (P or Escape when paused)
            if (e.key === 'p' || e.key === 'P') {
                if (!this.isDialogueActive && !this.isPuzzleActive) {
                    this.togglePause();
                }
                return;
            }
            // Escape unpauses if paused, otherwise closes puzzle
            if (e.key === 'Escape') {
                if (this.isPaused) {
                    this.togglePause();
                    return;
                }
                return;
            }
            // Block all other keys while paused
            if (this.isPaused) return;

            if (e.key === 'h' || e.key === 'H') {
                document.getElementById('quest-list')?.classList.toggle('hidden');
            }
            if (e.key === ' ' && this.isDialogueActive) {
                this.advanceDialogue();
            }
        };
        this._addTrackedListener(document, 'keydown', keyHandler);
    }

    // Scene Management
    registerScene(sceneOrId, sceneData = null) {
        // Support both registerScene(sceneObj) and registerScene(id, sceneData)
        if (typeof sceneOrId === 'object' && sceneOrId.id) {
            this.scenes[sceneOrId.id] = sceneOrId;
            // console.log(`Scene registered: ${sceneOrId.id}`);
        } else if (sceneData) {
            this.scenes[sceneOrId] = sceneData;
            // console.log(`Scene registered: ${sceneOrId}`);
        }
    }

    async loadScene(sceneId, transition = 'fade', { skipAutoSave = false } = {}) {
        // Auto-resume if paused when changing scenes
        if (this.isPaused) this.togglePause();

        const scene = this.scenes[sceneId];
        if (!scene) {
            console.error(`Scene not found: ${sceneId}`);
            return;
        }

        // Guard against overlapping scene loads
        if (this._sceneLoading) {
            console.warn(`Scene load already in progress, ignoring request for: ${sceneId}`);
            return;
        }
        this._sceneLoading = true;

        try {
            // Clear all scene-scoped timeouts before leaving
            this.clearSceneTimeouts();

            // Call onExit for the current scene before leaving
            if (this.currentScene && this.scenes[this.currentScene] && this.scenes[this.currentScene].onExit) {
                try {
                    this.scenes[this.currentScene].onExit(this);
                } catch (err) {
                    console.error(`Error in onExit for scene ${this.currentScene}:`, err);
                }
            }

            // Safety-net: remove any scene-SVG overlays that onExit may have missed
            // (fetch-loaded SVGs carry class="scene-overlay-svg" and must not bleed into next scene)
            document.querySelectorAll('.scene-overlay-svg').forEach(el => el.remove());

            const sceneContainer = document.getElementById('scene-container');
            if (!sceneContainer) {
                console.error('Scene container not found');
                return;
            }

            // ── Cinematic transition out ──
            const overlay = document.getElementById('scene-transition-overlay');
            if (transition === 'fade' && overlay) {
                // Phase 1: darken + zoom-out old scene
                overlay.className = 'cine-out';
                sceneContainer.classList.add('cine-out');
                await this.wait(900);

                // Phase 2: hold at black with light sweep
                overlay.className = 'cine-hold';
                sceneContainer.style.opacity = '0';
                await this.wait(350);
            } else if (transition === 'fade') {
                sceneContainer.classList.add('fade-out');
                await this.wait(this.settings.animSpeed);
            }

            this.currentScene = sceneId;

            // Advance the game clock to match this scene's timeline
            // this._applySceneClock(sceneId);

            // Load background
            const bgElement = document.getElementById('scene-background');

            // Remove old scene classes
            bgElement.className = '';

            // Add scene-specific CSS class for placeholder graphics
            bgElement.classList.add(`scene-${sceneId}`);
            bgElement.setAttribute('data-scene-name', scene.name || sceneId);

            if (scene.background) {
                const bgUrl = scene.background.includes('?') ? scene.background : `${scene.background}?v=5`;
                bgElement.style.backgroundImage = `url('${bgUrl}')`;
                bgElement.style.backgroundSize = '100% 100%';
                bgElement.style.backgroundRepeat = 'no-repeat';
                bgElement.style.backgroundPosition = 'center';
            } else {
                bgElement.style.backgroundImage = 'none';
            }
            if (scene.backgroundColor) {
                bgElement.style.backgroundColor = scene.backgroundColor;
            }

            // Load hotspots
            this.loadHotspots(scene.hotspots || []);

            // Set up player for this scene
            if (this.player) {
                // Set player position (entry point or default center-bottom)
                const startX = scene.playerStart?.x ?? 50;
                const startY = scene.playerStart?.y ?? 85;
                this.player.setPosition(startX, startY);

                // Set scene-specific idle thoughts
                if (scene.idleThoughts) {
                    this.player.setIdleThoughts(scene.idleThoughts);
                }

                // Show or hide player based on scene settings
                if (scene.hidePlayer) {
                    this.player.hide();
                } else {
                    this.player.show();
                }
            }

            // Execute scene entry script
            if (scene.onEnter) {
                try {
                    scene.onEnter(this);
                } catch (err) {
                    console.error(`Error in onEnter for scene ${sceneId}:`, err);
                }
            }

            // Auto-save AFTER onEnter so flags set during entry are captured
            if (!skipAutoSave) {
                this._autoSave();
            }

            // ── Cinematic transition in ──
            if (transition === 'fade' && overlay) {
                // Prepare new scene slightly zoomed-in & bright
                sceneContainer.classList.remove('cine-out');
                sceneContainer.style.opacity = '';
                sceneContainer.classList.add('cine-in');

                // Phase 3: reveal new scene from black
                overlay.className = 'cine-in';
                // Force a reflow so the starting state (cine-in) is painted
                void sceneContainer.offsetWidth;
                sceneContainer.classList.add('cine-in-play');
                await this.wait(1000);

                // Cleanup
                sceneContainer.classList.remove('cine-in', 'cine-in-play');
                overlay.className = '';
            } else if (transition === 'fade') {
                sceneContainer.classList.remove('fade-out');
                sceneContainer.classList.add('fade-in');
                await this.wait(this.settings.animSpeed);
                sceneContainer.classList.remove('fade-in');
            }

            // Update URL hash for navigation
            if (typeof window !== 'undefined') {
                window.location.hash = sceneId;
            }

            console.log(`Scene loaded: ${sceneId}`);

            // 🎬 Accessibility mode: start the auto-play runner for this scene
            if (this.accessibilityMode && scene.accessibilityPath?.length) {
                // Give onEnter() and any scene-start dialogue a moment to settle
                setTimeout(() => this._startAccessibilityRunner(scene), 1500);
            }
        } finally {
            this._sceneLoading = false;
        }
    }

    loadHotspots(hotspots) {
        const container = document.getElementById('scene-hotspots');
        if (!container) {
            console.error('Hotspot container not found');
            return;
        }
        container.innerHTML = '';

        hotspots.forEach(hotspot => {
            // Skip hotspots that are explicitly hidden
            if (hotspot.visible === false) {
                return;
            }

            const element = document.createElement('div');
            element.className = 'hotspot';
            element.id = `hotspot-${hotspot.id}`;
            element.style.left = `${hotspot.x}%`;
            element.style.top = `${hotspot.y}%`;
            element.style.width = `${hotspot.width}%`;
            element.style.height = `${hotspot.height}%`;

            // Support custom CSS classes (e.g. 'hotspot-nav' for visible nav buttons)
            // Split on whitespace so callers can pass multiple classes in one string.
            if (hotspot.cssClass) {
                element.classList.add(...hotspot.cssClass.trim().split(/\s+/));
            }

            if (hotspot.cursor) {
                element.style.cursor = hotspot.cursor;
            }

            // Tooltip
            if (hotspot.name) {
                element.setAttribute('data-tooltip', hotspot.name);
            }

            // Icon image (for tool overlays)
            if (hotspot.icon) {
                const img = document.createElement('img');
                img.src = hotspot.icon;
                img.alt = hotspot.name || '';
                element.appendChild(img);
            }

            // Label text (for tool overlays)
            if (hotspot.label) {
                const lbl = document.createElement('span');
                lbl.className = 'tool-label';
                lbl.textContent = hotspot.label;
                element.appendChild(lbl);
            }

            // Click and touch handlers
            const handleHotspotInteraction = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleHotspotClick(hotspot);
            };
            addInteractionHandler(element, handleHotspotInteraction);

            container.appendChild(element);
        });
    }

    handleHotspotClick(hotspot) {
        if (this.isPaused || this.isDialogueActive || this.isPuzzleActive) return;

        // Check 'enabled' property (function or boolean)
        if (hotspot.enabled !== undefined) {
            const isEnabled = typeof hotspot.enabled === 'function' ? hotspot.enabled(this) : hotspot.enabled;
            if (!isEnabled) {
                if (hotspot.disabledMessage) {
                    this.playerThink(hotspot.disabledMessage);
                }
                return;
            }
        }

        // Check conditions
        if (hotspot.condition && !this.checkCondition(hotspot.condition)) {
            if (hotspot.failMessage) {
                this.playerThink(hotspot.failMessage);
            }
            return;
        }

        // Calculate hotspot center position for walking
        const targetX = hotspot.x + (hotspot.width / 2);
        const targetY = Math.min(hotspot.y + hotspot.height, 90); // Stay in walkable area

        // Walk to the hotspot, then execute action
        if (this.player && !hotspot.skipWalk) {
            this.player.walkTo(targetX, targetY, () => {
                this.executeHotspotAction(hotspot);
            });
        } else {
            this.executeHotspotAction(hotspot);
        }
    }

    executeHotspotAction(hotspot) {
        // If lookMessage exists, Ryan thinks out loud
        if (hotspot.lookMessage) {
            const message = typeof hotspot.lookMessage === 'function'
                ? hotspot.lookMessage(this)
                : hotspot.lookMessage;
            this.playerThink(message);
        }

        // Support 'interactions' pattern used by some scenes
        if (hotspot.interactions) {
            const interaction = hotspot.interactions.look || hotspot.interactions.use || hotspot.interactions.default;
            if (typeof interaction === 'function') {
                interaction(this);
                return; // interactions pattern handles its own actions
            }
        }

        // Execute action
        if (hotspot.action) {
            hotspot.action(this);
        }

        // Navigate to scene
        if (hotspot.targetScene) {
            // Short delay for scene transitions
            setTimeout(() => {
                this.loadScene(hotspot.targetScene);
            }, this.settings.animSpeed ? ENGINE_CONFIG.SCENE_CHANGE_DELAY : 0);
        }

        // Start dialogue
        if (hotspot.dialogue) {
            this.startDialogue(hotspot.dialogue);
        }

    }

    // Player thinks out loud
    playerThink(thought) {
        if (this.player) {
            this.player.think(thought);
        } else {
            // Fallback to notification if player not available
            this.showNotification(thought);
        }
    }

    /** Escape a string for safe insertion into innerHTML. */
    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str ?? '';
        return d.innerHTML;
    }

    // Dialogue System
    startDialogue(dialogue, onComplete) {
        if (!dialogue) {
            console.error('startDialogue: dialogue is required');
            return;
        }
        this.dialogueQueue = Array.isArray(dialogue) ? [...dialogue] : [dialogue];
        this._dialogueCallback = typeof onComplete === 'function' ? onComplete : null;
        this.isDialogueActive = true;
        const dialogueBox = document.getElementById('dialogue-box');
        if (dialogueBox) dialogueBox.classList.remove('hidden');
        this.showCurrentDialogue();
    }

    // Simplified dialogue method - accepts array of strings and speaker name
    showDialogue(lines, speaker = 'Cygu') {
        const dialogue = lines.map(text => ({ speaker, text }));
        this.startDialogue(dialogue);
    }

    showCurrentDialogue() {
        if (this.dialogueQueue.length === 0) {
            this.endDialogue();
            return;
        }

        // Abort any ongoing typewriter effect
        if (this.typewriterAbortController) {
            this.typewriterAbortController.abort();
        }
        this.typewriterAbortController = new AbortController();

        const current = this.dialogueQueue[0];
        const speakerEl = document.getElementById('dialogue-speaker');
        const textEl = document.getElementById('dialogue-text');
        const portraitEl = document.getElementById('dialogue-portrait');

        if (!speakerEl || !textEl) {
            console.error('Dialogue DOM elements not found');
            this.endDialogue();
            return;
        }

        const speaker = current.speaker || 'Cygu';
        speakerEl.textContent = speaker;
        if (portraitEl) {
            // Auto-derive portrait from speaker name if not explicitly set
            const PORTRAIT_MAP = {
                'cygu': 'assets/images/characters/cygu.svg',
            };
            const portraitPath = current.portrait ||
                PORTRAIT_MAP[speaker.toLowerCase()] || '';
            portraitEl.style.backgroundImage = portraitPath ? `url('${portraitPath}')` : 'none';
        }

        // Execute action callback if provided (for visual changes, etc.)
        if (current.action && typeof current.action === 'function') {
            current.action(this);
        }

        // Typewriter effect + speech in parallel; auto-advance waits for both
        // Sync the HUD clock if this line mentions a specific time
        this._syncClockToText(current.text || '');

        // ── *italic* narrator convention ──────────────────────────────────
        // If the entire text (or any segment) is wrapped in *…* it is spoken
        // by the Narrator voice. Strip the asterisks for display and override
        // the speaker label so the UI and TTS both reflect the narrator.
        let displayText = current.text || '';
        let effectiveSpeaker = speaker;
        const _isNarratorLine = /^\s*\*[^*]+\*\s*$/.test(displayText);
        if (_isNarratorLine) {
            displayText = displayText.replace(/^\s*\*|\*\s*$/g, '').trim();
            effectiveSpeaker = 'Cygu';
            speakerEl.textContent = 'Cygu';
        }

        const _twSignal = this.typewriterAbortController.signal;
        // 🎬 Movie mode: instant typewriter so auto-advance is bounded only by TTS, not typing speed
        const typePromise = this.typeText(textEl, displayText,
            this.accessibilityMode ? 0 : this.settings.textSpeed, _twSignal);
        const speechPromise = this.speakText(displayText, effectiveSpeaker);

        Promise.all([typePromise, speechPromise]).then(() => {
            if (_twSignal.aborted || !this.isDialogueActive) return;
            if (this.accessibilityMode) {
                // 🎬 Movie mode: auto-advance immediately after TTS finishes
                if (!this.isPaused) this.advanceDialogue();
            } else if (this.settings.autoAdvanceDelay > 0) {
                this._autoAdvanceTimer = setTimeout(() => {
                    if (this.isDialogueActive && !this.isPaused) this.advanceDialogue();
                }, this.settings.autoAdvanceDelay);
            }
        });
    }

    async typeText(element, text, speed = 30, signal = null) {
        element.textContent = '';
        try {
            for (let i = 0; i < text.length; i++) {
                if (signal && signal.aborted) {
                    return;
                }
                element.textContent += text[i];
                await this.wait(speed);
            }
        } catch (error) {
            // Abort or other error - just stop typing
            return;
        }
    }

    advanceDialogue() {
        // Clear any pending auto-advance timer
        if (this._autoAdvanceTimer) { clearTimeout(this._autoAdvanceTimer); this._autoAdvanceTimer = null; }
        // Stop current speech when advancing
        this.stopSpeech();

        // Abort any ongoing typewriter effect
        if (this.typewriterAbortController) {
            this.typewriterAbortController.abort();
        }

        this.dialogueQueue.shift();
        if (this.dialogueQueue.length > 0) {
            this.showCurrentDialogue();
        } else {
            this.endDialogue();
        }
    }

    endDialogue() {
        if (this._autoAdvanceTimer) { clearTimeout(this._autoAdvanceTimer); this._autoAdvanceTimer = null; }
        this.isDialogueActive = false;
        this.stopSpeech();

        // Abort any ongoing typewriter effect
        if (this.typewriterAbortController) {
            this.typewriterAbortController.abort();
            this.typewriterAbortController = null;
        }

        const dialogueBox = document.getElementById('dialogue-box');
        if (dialogueBox) dialogueBox.classList.add('hidden');

        // Fire completion callback if set
        const cb = this._dialogueCallback;
        this._dialogueCallback = null;
        if (cb) cb(this);
    }

    // Voice System Methods
    speakText(text, speaker = '') {
        if (!this.voiceManager) {
            this.voiceManager = window.voiceManager;
        }
        if (this.voiceEnabled && this.voiceManager) {
            // Ensure text is a string
            const textStr = typeof text === 'string' ? text : String(text);
            console.log(`Speaking: "${textStr.substring(0, 50)}..." as ${speaker || 'Cygu'}`);
            return this.voiceManager.speak(textStr, speaker);
        }
        // Voice disabled: in accessibility (movie) mode, simulate reading time so text
        // isn't skipped instantly. ~60 ms/character, minimum 1.5 s, maximum 12 s.
        if (this.accessibilityMode) {
            const textStr = typeof text === 'string' ? text : String(text);
            const readMs = Math.min(12000, Math.max(1500, textStr.length * 60));
            return this.wait(readMs);
        }
        return Promise.resolve();
    }

    /**
     * Speak text and wait for speech to finish (plus optional extra pause).
     * Use this in cinematic sequences to ensure timing stays in sync with voice.
     * @param {string} text - Text to speak
     * @param {string} speaker - Character name
     * @param {number} [minDuration=0] - Minimum ms to wait (even if speech is shorter)
     * @returns {Promise<void>}
     */
    async speakAndWait(text, speaker = '', minDuration = 0) {
        const speechPromise = this.speakText(text, speaker);
        const timerPromise = minDuration > 0 ? this.wait(minDuration) : Promise.resolve();
        await Promise.all([speechPromise, timerPromise]);
    }

    stopSpeech() {
        if (this.voiceManager) {
            this.voiceManager.stop();
        }
    }

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        const btn = document.getElementById('menu-voice');
        if (btn) {
            btn.textContent = this.voiceEnabled ? '🔊 Voice' : '🔇 Muted';
            btn.title = this.voiceEnabled ? 'Voice On - Click to Mute' : 'Voice Off - Click to Enable';
            btn.classList.toggle('muted', !this.voiceEnabled);
        }
        if (!this.voiceEnabled) {
            this.stopSpeech();
        }
        this.showNotification(this.voiceEnabled ? 'Voice enabled' : 'Voice muted');
        return this.voiceEnabled;
    }

    // ── Accessibility / Movie Mode ─────────────────────────────────────────────

    /**
     * Toggle accessibility (movie) mode on/off.
     * In movie mode the game auto-plays the good story path:
     *   - Dialogue auto-advances after TTS finishes
     *   - Puzzles are displayed and auto-solved
     *   - Hotspots defined in scene.accessibilityPath are clicked automatically
     */
    toggleAccessibilityMode() {
        this.accessibilityMode = !this.accessibilityMode;
        this.settings.accessibilityMode = this.accessibilityMode;
        this._saveSettings();
        this._updateAccessibilityBadge();

        if (this.accessibilityMode) {
            // Ensure voice is on when entering movie mode
            if (!this.voiceEnabled) {
                this.toggleVoice();
            }
            this.showNotification('🎬 Movie Mode ON — sit back and enjoy the story');
            // If a scene with an accessibilityPath is already active, start runner
            const scene = this.scenes?.[this.currentScene];
            if (scene?.accessibilityPath?.length) {
                setTimeout(() => this._startAccessibilityRunner(scene), 500);
            }
        } else {
            this._stopAccessibilityRunner();
            this.showNotification('🎮 Movie Mode OFF — manual control restored');
        }
        return this.accessibilityMode;
    }

    /** Update the 🎬 badge visibility and the menu button label. */
    _updateAccessibilityBadge() {
        const badge = document.getElementById('accessibility-badge');
        if (badge) badge.classList.toggle('hidden', !this.accessibilityMode);

        const btn = document.getElementById('menu-movie');
        if (btn) {
            btn.textContent = this.accessibilityMode ? '🎬 Movie ON' : '🎬 Movie';
            btn.classList.toggle('accessibility-active', this.accessibilityMode);
        }
    }

    /**
     * 🎬 Accessibility runner: walks through scene.accessibilityPath in order,
     * triggering each hotspot as if the player clicked it, and waiting for
     * dialogue/puzzles to finish before moving to the next.
     * @param {Object} scene - The scene object that was just loaded
     */
    async _startAccessibilityRunner(scene) {
        // Cancel any existing runner
        this._accessibilityRunnerActive = false;
        await this.wait(50); // let old runner notice the flag
        this._accessibilityRunnerActive = true;

        const path = scene.accessibilityPath || [];
        const looping = scene.accessibilityLooping === true;
        console.log(`[🎬] Starting accessibility runner for ${this.currentScene}`, looping ? '(looping)' : '');

        if (!looping) {
            await runPass();
        } else {
            // Looping mode: repeat passes until stable AND no pending garden destination
            let loopGuard = 0;
            do {
                if (!this._accessibilityRunnerActive || !this.accessibilityMode) break;
                if (this.currentScene !== scene.id && scene.id !== undefined) break;

                const flagsBefore = JSON.stringify(this.gameState.flags);
                const sceneChanged = await runPass();
                if (sceneChanged) break;

                const flagsAfter = JSON.stringify(this.gameState.flags);
                const changed = flagsBefore !== flagsAfter;
                const pending = this._gardenHasPendingDestination();

                console.log(`[🎬] Loop pass done — flags changed: ${changed}, pending garden: ${pending}`);

                if (!changed && !pending) break;          // stable → stop
                if (++loopGuard > 20) {
                    console.warn('[🎬] Loop guard hit (20) — stopping to avoid infinite loop');
                    break;
                }

                await this.wait(800);
            } while (this._accessibilityRunnerActive && this.accessibilityMode
                && this.currentScene === scene.id);
        }

        console.log(`[🎬] Accessibility runner finished for ${scene.id ?? this.currentScene}`);
    }

    /** Signal the current accessibility runner to stop. */
    _stopAccessibilityRunner() {
        this._accessibilityRunnerActive = false;
    }

    /**
     * Pauses CSS animations, speech, typewriter, and blocks all interaction.
     * @returns {boolean} new pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;

        const overlay = document.getElementById('pause-overlay');
        const btn = document.getElementById('menu-pause');
        const sceneWrapper = document.getElementById('scene-wrapper');
        const sceneContainer = document.getElementById('scene-container');

        if (this.isPaused) {
            // --- PAUSE ---
            // Show overlay
            if (overlay) overlay.classList.remove('hidden');

            // Update button
            if (btn) {
                btn.textContent = '▶️ Resume';
                btn.title = 'Resume Game (P)';
                btn.classList.add('paused');
            }

            // Freeze all CSS animations in the scene
            if (sceneContainer) {
                sceneContainer.style.animationPlayState = 'paused';
                sceneContainer.querySelectorAll('*').forEach(el => {
                    el.style.animationPlayState = 'paused';
                });
            }

            // Pause speech synthesis
            if (this.voiceManager?.synth?.speaking) {
                try { this.voiceManager.synth.pause(); } catch (e) { /* ignore */ }
            }

            // Pause typewriter by aborting current and storing state
            if (this.typewriterAbortController) {
                this._typewriterWasPaused = true;
                this.typewriterAbortController.abort();
            }

            // Freeze player idle timer
            if (this.player?._idleTimer) {
                clearTimeout(this.player._idleTimer);
                this.player._idleFrozen = true;
            }

            console.log('Game PAUSED');
        } else {
            // --- RESUME ---
            // Hide overlay
            if (overlay) overlay.classList.add('hidden');

            // Update button
            if (btn) {
                btn.textContent = '⏸️ Pause';
                btn.title = 'Pause / Resume (P)';
                btn.classList.remove('paused');
            }

            // Unfreeze all CSS animations
            if (sceneContainer) {
                sceneContainer.style.animationPlayState = '';
                sceneContainer.querySelectorAll('*').forEach(el => {
                    el.style.animationPlayState = '';
                });
            }

            // Resume speech synthesis
            if (this.voiceManager?.synth?.paused) {
                try { this.voiceManager.synth.resume(); } catch (e) { /* ignore */ }
            }

            // Restart player idle timer
            if (this.player?._idleFrozen) {
                this.player._idleFrozen = false;
                if (this.player.startIdleTimer) {
                    this.player.startIdleTimer();
                }
            }

            this._typewriterWasPaused = false;

            console.log('Game RESUMED');
        }

        return this.isPaused;
    }

    // Quest Manager API (for compatibility with scene scripts)
    get questManager() {
        const self = this;
        return {
            isActive: (questId) => self.gameState.activeQuests.some(q => q.id === questId),
            hasQuest: (questId) => self.gameState.activeQuests.some(q => q.id === questId) ||
                self.gameState.questsCompleted.includes(questId),
            addQuest: (quest) => self.addQuest(quest),
            updateProgress: (questId, step) => {
                const quest = self.gameState.activeQuests.find(q => q.id === questId);
                if (quest) {
                    quest.progress = quest.progress || [];
                    if (!quest.progress.includes(step)) {
                        quest.progress.push(step);
                    }
                    self.updateQuestUI();
                }
            },
            complete: (questId) => self.completeQuest(questId),
            getProgress: (questId) => {
                const quest = self.gameState.activeQuests.find(q => q.id === questId);
                return quest?.progress || [];
            }
        };
    }

    // Quest System - supports both addQuest(obj) and addQuest(id, name, description)
    addQuest(questOrId, name = null, description = null) {
        let quest;
        if (typeof questOrId === 'object') {
            quest = questOrId;
        } else {
            quest = { id: questOrId, name: name || questOrId, description: description || '' };
        }

        if (!quest.id) {
            console.error('addMission: quest must have an id', quest);
            return;
        }

        // Skip if quest is already active or was already completed
        if (this.gameState.activeQuests.find(q => q.id === quest.id) ||
            this.gameState.questsCompleted.includes(quest.id)) {
            return;
        }
        this.gameState.activeQuests.push(quest);
        this.updateQuestUI();
        this.showNotification(`Misi baru: ${quest.name || quest.id}`);
    }

    completeQuest(questId) {
        const quest = this.gameState.activeQuests.find(q => q.id === questId);
        if (quest) {
            this.gameState.activeQuests = this.gameState.activeQuests.filter(q => q.id !== questId);
            this.gameState.questsCompleted.push(questId);
            this.updateQuestUI();
            this.showNotification(`Misi selesai: ${quest.name}`);

            if (quest.onComplete) {
                quest.onComplete(this);
            }
        }
    }

    updateQuestUI() {
        const container = document.getElementById('quest-list');
        if (!container) return;
        container.innerHTML = '';

        if (this.gameState.activeQuests.length === 0) {
            container.innerHTML = '<div class="quest-empty">Tidak ada misi.</div>';

            const qec = document.createElement('div');
            qec.innerHTML = '<div class="quest-empty-desc">Kamu dapat melakukan kembali apa yang sudah dipelajari.</div>';
            container.appendChild(qec);
            return;
        }

        this.gameState.activeQuests.forEach(quest => {
            const element = document.createElement('div');
            element.className = 'quest-item';
            element.innerHTML = `
                <div class="quest-name">${this._esc(quest.name)}</div>
                <div class="quest-description">${this._esc(quest.description)}</div>
                ${quest.hint ? `<div class="quest-hint"><button class="quest-hint-btn">💡 Hint</button><p class="quest-hint-text hidden">${this._esc(quest.hint)}</p></div>` : ''}
            `;
            const hintBtn = element.querySelector('.quest-hint-btn');
            if (hintBtn) {
                hintBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    hintBtn.nextElementSibling.classList.toggle('hidden');
                });
            }
            container.appendChild(element);
        });
    }


    // Game State
    setFlag(flag, value) {
        this.gameState.flags[flag] = value;
    }

    getFlag(flag) {
        return this.gameState.flags[flag];
    }

    checkCondition(condition) {
        if (typeof condition === 'function') {
            return condition(this);
        }
        if (typeof condition === 'string') {
            return this.getFlag(condition);
        }
        return true;
    }

    /**
     * Parse a time mention from spoken/typed dialogue text and advance the
     * HUD clock if a recognisable time was found.  Never goes backwards.
     * Handles:
     *   • HH:MM (24-h)          "het is 22:47", "at 09:00"
     *   • H:MM AM/PM             "8:15 AM", "11:30 pm"
     *   • N o'clock              "8 o'clock", "acht uur"
     *   • "half past N"          → N:30
     *   • "quarter past/to N"    → N:15 / (N-1):45
     *   • Dutch digital (same HH:MM regex covers it)
     */
    _syncClockToText(text) {
        if (!text) return;
        let h = null, m = 0;

        // ── 1. HH:MM with optional AM/PM ─────────────────────────────────
        const digitalRe = /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/;
        const d = text.match(digitalRe);
        if (d) {
            h = parseInt(d[1], 10);
            m = parseInt(d[2], 10);
            const meridiem = (d[3] || '').toLowerCase();
            if (meridiem === 'pm' && h < 12) h += 12;
            if (meridiem === 'am' && h === 12) h = 0;
        }

        // ── 2. "N o'clock" / "N uur" (Dutch) ─────────────────────────────
        if (h === null) {
            const oRe = /\b(\d{1,2})\s+(?:o'clock|uur)\b/i;
            const o = text.match(oRe);
            if (o) { h = parseInt(o[1], 10); m = 0; }
        }

        // ── 3. "half past N" ──────────────────────────────────────────────
        if (h === null) {
            const halfRe = /\bhalf\s+past\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
            const hp = text.match(halfRe);
            if (hp) {
                h = this._wordToNum(hp[1]);
                m = 30;
            }
        }

        // ── 4. "quarter past N" / "quarter to N" ─────────────────────────
        if (h === null) {
            const qpRe = /\bquarter\s+past\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
            const qp = text.match(qpRe);
            if (qp) { h = this._wordToNum(qp[1]); m = 15; }
        }
        if (h === null) {
            const qtRe = /\bquarter\s+to\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
            const qt = text.match(qtRe);
            if (qt) { h = this._wordToNum(qt[1]) - 1; m = 45; if (h < 0) h = 23; }
        }

        if (h === null || isNaN(h) || h < 0 || h > 23 || m < 0 || m > 59) return;

        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        // Try on the current day first; setTime guards against going backwards.
        // If still on current day it won't advance, try next day for AM times
        // that clearly come after a late-night scene (e.g. 22:00 → "8:15 AM").
        const [curH] = this.gameState.time.split(':').map(Number);
        const day = (h < curH && h < 12) ? this.gameState.day + 1 : this.gameState.day;
        this.setTime(day, timeStr);
    }

    /** Map English number words to integers, or parse numeric strings. */
    _wordToNum(w) {
        const MAP = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
            seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
        };
        return MAP[w.toLowerCase()] ?? parseInt(w, 10);
    }

    advanceTime(minutes) {
        if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
            console.warn('advanceTime: invalid minutes value', minutes);
            return;
        }
        const [hours, mins] = this.gameState.time.split(':').map(Number);
        let totalMins = hours * 60 + mins + minutes;
        const dayMinutes = ENGINE_CONFIG.HOURS_IN_DAY * ENGINE_CONFIG.MINUTES_IN_HOUR;

        if (totalMins >= dayMinutes) {
            totalMins -= dayMinutes;
            this.gameState.day++;
            const dayEl = document.getElementById('game-day');
            if (dayEl) dayEl.textContent = `Day ${this.gameState.day}`;
        }

        const newHours = Math.floor(totalMins / 60);
        const newMins = totalMins % 60;
        this.gameState.time = `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
        const timeEl = document.getElementById('game-time');
        if (timeEl) timeEl.textContent = this.gameState.time;
    }

    /**
     * Set the game clock to an absolute day + time.
     * Only moves the clock FORWARD — never backwards.
     * @param {number} day
     * @param {string} time  e.g. '14:30'
     */
    setTime(day, time) {
        const [newH, newM] = time.split(':').map(Number);
        const [curH, curM] = this.gameState.time.split(':').map(Number);
        const newTotal = day * 1440 + newH * 60 + newM;
        const curTotal = this.gameState.day * 1440 + curH * 60 + curM;
        if (newTotal <= curTotal) return;   // never wind back

        this.gameState.day = day;
        this.gameState.time = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

        const dayEl = document.getElementById('game-day');
        const timeEl = document.getElementById('game-time');
        if (dayEl) dayEl.textContent = `Day ${day}`;
        if (timeEl) timeEl.textContent = this.gameState.time;
    }

    // Notifications
    showNotification(message, duration = ENGINE_CONFIG.NOTIFICATION_DURATION) {
        const area = document.getElementById('notification-area');
        if (!area) {
            console.log(`[Notification] ${message}`);
            return;
        }
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        area.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), ENGINE_CONFIG.NOTIFICATION_FADE);
        }, duration);
    }

    addChatMessage(conversationId, message, immediate = false) {
        if (this.chatInterface) {
            this.chatInterface.addMessage(conversationId, message, immediate);
        }
    }

    async sendChatMessagesWithDelay(conversationId, messages, delay = 2000) {
        if (this.chatInterface) {
            return this.chatInterface.sendMessagesWithDelay(conversationId, messages, delay);
        }
    }

    // Save/Load
    /**
     * Silent autosave to the dedicated autosave slot ('cyberguard_autosave').
     * Called after every scene transition, post-onEnter, so all entry flags are captured.
     */
    _autoSave() {
        try {
            if (!this._storage) return;
            const saveData = {
                version: this._saveVersion,
                slot: 0,
                slotLabel: 'Autosave',
                currentScene: this.currentScene,
                gameState: this.gameState,
                voiceEnabled: this.voiceEnabled,
                timestamp: new Date().toISOString()
            };
            this._storage.setItem('cyberguard_autosave', JSON.stringify(saveData));
            console.log(`[Autosave] scene=${this.currentScene}, flags=${Object.keys(this.gameState.flags).length}, quests=${this.gameState.activeQuests.length}`);
        } catch (err) {
            console.error('[Autosave] Failed:', err);
        }
    }

    saveGame(silent = false, slot = 0) {
        try {
            if (!this._storage) {
                if (!silent) this.showNotification('Save unavailable — no storage.');
                return false;
            }
            const saveData = {
                version: this._saveVersion,
                slot,
                slotLabel: slot > 0 ? `Slot ${slot}` : 'Auto',
                currentScene: this.currentScene,
                gameState: this.gameState,
                voiceEnabled: this.voiceEnabled,
                timestamp: new Date().toISOString()
            };

            const key = this._getSaveKey(slot);
            this._storage.setItem(key, JSON.stringify(saveData));
            if (!silent) {
                const label = slot > 0 ? ` (Slot ${slot})` : '';
                this.showNotification(`Game saved${label}!`);
            }
            console.log(`[Save] key=${key}, scene=${this.currentScene}, flags=${Object.keys(this.gameState.flags).length}, quests=${this.gameState.activeQuests.length}`);
            return true;
        } catch (err) {
            console.error('Failed to save game:', err);
            if (!silent) this.showNotification('Failed to save game.');
            return false;
        }
    }

    loadGame(slot = 0) {
        try {
            // Slot 0 = autosave; slots 1-3 = named slots
            let raw;
            if (!slot || slot < 1) {
                // Load from dedicated autosave key; fall back to legacy key
                raw = this._storage ? this._storage.getItem('cyberguard_autosave') : null;
                if (!raw) raw = this._storage ? this._storage.getItem('cyberguard_save') : null;
            } else {
                const key = this._getSaveKey(slot);
                raw = this._storage ? this._storage.getItem(key) : null;
                if (!raw && slot === 1) {
                    raw = this._storage ? this._storage.getItem('cyberguard_save') : null;
                }
            }
            if (!raw) {
                this.showNotification('No save file found.');
                return false;
            }

            const data = JSON.parse(raw);

            // --- Game state: merge saved over defaults so new fields get defaults ---
            const defaults = JSON.parse(JSON.stringify(this._defaultGameState));
            this.gameState = { ...defaults, ...data.gameState };

            // Guard nested structures
            this.gameState.flags = (typeof this.gameState.flags === 'object' && this.gameState.flags !== null) ? this.gameState.flags : {};
            this.gameState.activeQuests = Array.isArray(this.gameState.activeQuests) ? this.gameState.activeQuests : [];
            this.gameState.questsCompleted = Array.isArray(this.gameState.questsCompleted) ? this.gameState.questsCompleted : [];

            // --- Restore sub-system state ---

            // Voice preference
            if (typeof data.voiceEnabled === 'boolean') {
                this.voiceEnabled = data.voiceEnabled;
            }

            // --- Update all UI ---
            this.updateQuestUI();
            const dayEl = document.getElementById('game-day');
            const timeEl = document.getElementById('game-time');
            if (dayEl) dayEl.textContent = `Day ${this.gameState.day}`;
            if (timeEl) timeEl.textContent = this.gameState.time;

            // --- Navigate to saved scene ---
            if (data.currentScene) {
                this.loadScene(data.currentScene, 'fade', { skipAutoSave: true });
            }

            console.log(`[Load] scene=${data.currentScene}, quests=${this.gameState.activeQuests.length}`);
            // console.log(`[Load] scene=${data.currentScene}, flags=${Object.keys(this.gameState.flags).length}, quests=${this.gameState.activeQuests.length}`);
            const slotLabel = data.slot > 0 ? ` (Slot ${data.slot})` : '';
            this.showNotification(`Memuat program${slotLabel}...`);
            return true;
        } catch (err) {
            console.error('Gagal memuat program:', err);
            this.showNotification('Gagal memuat program, data ditemukan data yang tersimpan.');
            return false;
        }
    }

    // ── Save-slot helpers ──────────────────────────────────────────────────────

    /**
     * Return the localStorage key for a save slot.
     * Slot 0 = legacy auto-save key.  Slots 1-3 = named slots.
     * @param {number} slot
     * @returns {string}
     */
    _getSaveKey(slot) {
        if (!slot || slot < 1) return 'cyberguard_save';
        return `cyberguard_save_${slot}`;
    }

    /** Read persisted settings from localStorage and merge over defaults. */
    _loadSettings() {
        try {
            const raw = this._storage ? this._storage.getItem('cyberguard_settings') : null;
            if (raw) {
                const saved = JSON.parse(raw);
                if (typeof saved.textSpeed === 'number') this.settings.textSpeed = saved.textSpeed;
                if (typeof saved.animSpeed === 'number') this.settings.animSpeed = saved.animSpeed;
                if (typeof saved.autoAdvanceDelay === 'number') this.settings.autoAdvanceDelay = saved.autoAdvanceDelay;
                if (typeof saved.materiPauseDuration === 'number') this.settings.materiPauseDuration = saved.materiPauseDuration;
                if (typeof saved.accessibilityMode === 'boolean') this.settings.accessibilityMode = saved.accessibilityMode;
            }
        } catch (e) {
            console.warn('[Settings] Failed to load settings:', e);
        }
    }

    /** Persist current settings to localStorage. */
    _saveSettings() {
        try {
            if (this._storage) {
                this._storage.setItem('cyberguard_settings', JSON.stringify(this.settings));
            }
        } catch (e) {
            console.warn('[Settings] Failed to save settings:', e);
        }
    }

    /**
     * Apply current settings to live engine state.
     * Call after _loadSettings() or after the user changes a slider.
     */
    _applySettings() {
        // Voice speech rate
        if (this.voiceManager && typeof this.voiceManager.setRate === 'function') {
            // Map autoAdvanceDelay to a speech rate: 0→1.0, 500→0.9, 1000→0.8
            // (voice rate is independently user-controlled via voice profiles;
            //  we only nudge it slightly based on dialogue speed preference)
        }
        // textSpeed and animSpeed are read inline at call-sites — no extra work needed here.
        // Restore accessibilityMode from persisted setting.
        this.accessibilityMode = !!this.settings.accessibilityMode;
        this._updateAccessibilityBadge();
        // console.log('[Settings] applied:', JSON.stringify(this.settings));
    }

    // ── Save-slot picker modal ─────────────────────────────────────────────────

    /**
     * Open a 3-slot save/load picker.
     * @param {'save'|'load'} mode
     */
    openSaveSlotModal(mode) {
        // Remove any existing instance
        document.getElementById('save-slot-modal')?.remove();

        const NUM_SLOTS = 3;

        // ── Autosave slot (slot 0) ──────────────────────────────────────────────
        let autoSaveCard;
        const autoRaw = this._storage
            ? (this._storage.getItem('cyberguard_autosave') || this._storage.getItem('cyberguard_save'))
            : null;
        if (autoRaw) {
            try {
                const d = JSON.parse(autoRaw);
                const sceneName = (d.currentScene || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const ts = d.timestamp ? new Date(d.timestamp).toLocaleString() : '—';
                const loadBtn = `<button class="slot-action-btn" data-slot="0" data-action="load">Load</button>`;
                const saveNote = `<div class="slot-card__info slot-card__info--empty" style="font-size:0.8em;">Auto-managed</div>`;
                autoSaveCard = `
                    <div class="slot-card slot-card--autosave" data-slot="0" style="border-color:rgba(0,200,120,0.4)">
                        <div class="slot-card__header">
                            <span class="slot-card__number" style="color:#00c878;">⟳ Autosave</span>
                        </div>
                        <div class="slot-card__scene">${sceneName}</div>
                        <div class="slot-card__meta">Part ${d.gameState?.storyPart ?? '?'}</div>
                        <div class="slot-card__timestamp">${ts}</div>
                        ${mode === 'load' ? loadBtn : saveNote}
                    </div>`;
            } catch { autoSaveCard = ''; }
        } else {
            autoSaveCard = `
                <div class="slot-card slot-card--empty slot-card--autosave" data-slot="0" style="border-color:rgba(0,200,120,0.2)">
                    <span class="slot-card__number" style="color:#00c878;">⟳ Autosave</span>
                    <div class="slot-card__info slot-card__info--empty">— No autosave yet —</div>
                </div>`;
        }

        // ── Named slots 1-3 ────────────────────────────────────────────────────
        const slots = [];
        for (let i = 1; i <= NUM_SLOTS; i++) {
            const key = this._getSaveKey(i);
            const raw = this._storage ? this._storage.getItem(key) : null;
            if (raw) {
                try {
                    const d = JSON.parse(raw);
                    slots.push({
                        slot: i,
                        scene: d.currentScene || '—',
                        storyPart: d.gameState?.storyPart ?? '?',
                        timestamp: d.timestamp ? new Date(d.timestamp).toLocaleString() : '—',
                        empty: false,
                        raw: d
                    });
                } catch {
                    slots.push({ slot: i, empty: true });
                }
            } else {
                // Check legacy key for slot 1 migration
                const legacyRaw = i === 1 && this._storage ? this._storage.getItem('cyberguard_save') : null;
                if (legacyRaw) {
                    try {
                        const d = JSON.parse(legacyRaw);
                        slots.push({
                            slot: i,
                            scene: d.currentScene || '—',
                            storyPart: d.gameState?.storyPart ?? '?',
                            timestamp: d.timestamp ? new Date(d.timestamp).toLocaleString() : '(legacy save)',
                            empty: false,
                            raw: d
                        });
                    } catch {
                        slots.push({ slot: i, empty: true });
                    }
                } else {
                    slots.push({ slot: i, empty: true });
                }
            }
        }

        const title = mode === 'save' ? '💾 Save Game' : '📂 Load Game';

        const namedCardsHtml = slots.map(s => {
            if (s.empty) {
                return `
                    <div class="slot-card slot-card--empty" data-slot="${s.slot}">
                        <div class="slot-card__number">Slot ${s.slot}</div>
                        <div class="slot-card__info slot-card__info--empty">— Empty —</div>
                        ${mode === 'save' ? `<button class="slot-action-btn" data-slot="${s.slot}" data-action="save">Save Here</button>` : `<button class="slot-action-btn slot-action-btn--disabled" disabled>Empty</button>`}
                    </div>`;
            }
            const sceneName = s.scene.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return `
                <div class="slot-card" data-slot="${s.slot}">
                    <div class="slot-card__header">
                        <span class="slot-card__number">Slot ${s.slot}</span>
                        <button class="slot-delete-btn" data-slot="${s.slot}" title="Delete save">✕</button>
                    </div>
                    <div class="slot-card__scene">${sceneName}</div>
                    <div class="slot-card__meta">Part ${s.storyPart}</div>
                    <div class="slot-card__timestamp">${s.timestamp}</div>
                    ${mode === 'save'
                    ? `<button class="slot-action-btn slot-action-btn--overwrite" data-slot="${s.slot}" data-action="save">Overwrite</button>`
                    : `<button class="slot-action-btn" data-slot="${s.slot}" data-action="load">Load</button>`}
                </div>`;
        }).join('');

        const cardsHtml = autoSaveCard + namedCardsHtml;

        const modal = document.createElement('div');
        modal.id = 'save-slot-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content save-slot-modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" id="save-slot-close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="save-slot-grid">${cardsHtml}</div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        // Close button
        modal.querySelector('#save-slot-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        // Action buttons (save / load)
        modal.querySelectorAll('.slot-action-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slot = parseInt(btn.dataset.slot, 10);
                const action = btn.dataset.action;
                modal.remove();
                if (action === 'save') {
                    this.saveGame(false, slot);
                } else if (action === 'load') {
                    this.loadGame(slot);
                }
            });
        });

        // Delete buttons
        modal.querySelectorAll('.slot-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const slot = parseInt(btn.dataset.slot, 10);
                const key = this._getSaveKey(slot);
                if (confirm(`Delete Slot ${slot} save? This cannot be undone.`)) {
                    this._storage?.removeItem(key);
                    // Also remove legacy key if slot 1
                    if (slot === 1) this._storage?.removeItem('cyberguard_save');
                    modal.remove();
                    this.openSaveSlotModal(mode); // refresh
                }
            });
        });
    }

    // ── Settings modal ─────────────────────────────────────────────────────────

    openSettingsModal() {
        document.getElementById('settings-modal')?.remove();

        // Snapshot current values so Cancel can restore them
        const prev = { ...this.settings };

        const textLabels = { 0: 'Instant', 15: 'Fast', 40: 'Normal', 80: 'Slow' };
        const animLabels = { 0: 'None', 200: 'Fast', 500: 'Normal', 1000: 'Slow' };
        const autoLabels = { 0: 'Manual', 1500: 'Fast', 3000: 'Normal', 5000: 'Slow' };
        const materiLabels = { 0: 'None', 500: 'Quick', 1500: 'Normal', 3000: 'Relaxed', 5000: 'Slow' };

        const labelFor = (map, val) => {
            // Find closest key
            const keys = Object.keys(map).map(Number);
            const closest = keys.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
            return map[closest] || val + 'ms';
        };

        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content settings-modal-content">
                <div class="modal-header">
                    <h2>⚙️ Settings</h2>
                    <button class="modal-close" id="settings-close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <h3 class="settings-section-title">Dialogue &amp; Text</h3>

                        <div class="settings-row">
                            <div class="settings-row__labels">
                                <span class="settings-row__name">Text Speed</span>
                                <span class="settings-row__value" id="lbl-text-speed">${labelFor(textLabels, this.settings.textSpeed)}</span>
                            </div>
                            <div class="settings-row__presets">
                                <button class="preset-btn${this.settings.textSpeed === 0 ? ' preset-btn--active' : ''}" data-target="textSpeed" data-value="0">Instant</button>
                                <button class="preset-btn${this.settings.textSpeed === 15 ? ' preset-btn--active' : ''}" data-target="textSpeed" data-value="15">Fast</button>
                                <button class="preset-btn${this.settings.textSpeed === 40 ? ' preset-btn--active' : ''}" data-target="textSpeed" data-value="40">Normal</button>
                                <button class="preset-btn${this.settings.textSpeed === 80 ? ' preset-btn--active' : ''}" data-target="textSpeed" data-value="80">Slow</button>
                            </div>
                            <input class="settings-slider" type="range" id="slider-text-speed"
                                min="0" max="100" step="5" value="${this.settings.textSpeed}">
                        </div>

                        <div class="settings-row">
                            <div class="settings-row__labels">
                                <span class="settings-row__name">Auto-advance</span>
                                <span class="settings-row__value" id="lbl-auto-advance">${labelFor(autoLabels, this.settings.autoAdvanceDelay)}</span>
                            </div>
                            <div class="settings-row__presets">
                                <button class="preset-btn${this.settings.autoAdvanceDelay === 0 ? ' preset-btn--active' : ''}" data-target="autoAdvanceDelay" data-value="0">Manual</button>
                                <button class="preset-btn${this.settings.autoAdvanceDelay === 1500 ? ' preset-btn--active' : ''}" data-target="autoAdvanceDelay" data-value="1500">Fast</button>
                                <button class="preset-btn${this.settings.autoAdvanceDelay === 3000 ? ' preset-btn--active' : ''}" data-target="autoAdvanceDelay" data-value="3000">Normal</button>
                                <button class="preset-btn${this.settings.autoAdvanceDelay === 5000 ? ' preset-btn--active' : ''}" data-target="autoAdvanceDelay" data-value="5000">Slow</button>
                            </div>
                            <input class="settings-slider" type="range" id="slider-auto-advance"
                                min="0" max="6000" step="500" value="${this.settings.autoAdvanceDelay}">
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3 class="settings-section-title">Materi</h3>

                        <div class="settings-row">
                            <div class="settings-row__labels">
                                <span class="settings-row__name">Pause After Speech</span>
                                <span class="settings-row__value" id="lbl-materi-pause">${labelFor(materiLabels, this.settings.materiPauseDuration)}</span>
                            </div>
                            <div class="settings-row__presets">
                                <button class="preset-btn${this.settings.materiPauseDuration === 0 ? ' preset-btn--active' : ''}" data-target="materiPauseDuration" data-value="0">None</button>
                                <button class="preset-btn${this.settings.materiPauseDuration === 500 ? ' preset-btn--active' : ''}" data-target="materiPauseDuration" data-value="500">Quick</button>
                                <button class="preset-btn${this.settings.materiPauseDuration === 1500 ? ' preset-btn--active' : ''}" data-target="materiPauseDuration" data-value="1500">Normal</button>
                                <button class="preset-btn${this.settings.materiPauseDuration === 3000 ? ' preset-btn--active' : ''}" data-target="materiPauseDuration" data-value="3000">Relaxed</button>
                                <button class="preset-btn${this.settings.materiPauseDuration === 5000 ? ' preset-btn--active' : ''}" data-target="materiPauseDuration" data-value="5000">Slow</button>
                            </div>
                            <input class="settings-slider" type="range" id="slider-materi-pause"
                                min="0" max="6000" step="250" value="${this.settings.materiPauseDuration}">
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3 class="settings-section-title">Visuals</h3>

                        <div class="settings-row">
                            <div class="settings-row__labels">
                                <span class="settings-row__name">Animation Speed</span>
                                <span class="settings-row__value" id="lbl-anim-speed">${labelFor(animLabels, this.settings.animSpeed)}</span>
                            </div>
                            <div class="settings-row__presets">
                                <button class="preset-btn${this.settings.animSpeed === 0 ? ' preset-btn--active' : ''}" data-target="animSpeed" data-value="0">None</button>
                                <button class="preset-btn${this.settings.animSpeed === 200 ? ' preset-btn--active' : ''}" data-target="animSpeed" data-value="200">Fast</button>
                                <button class="preset-btn${this.settings.animSpeed === 500 ? ' preset-btn--active' : ''}" data-target="animSpeed" data-value="500">Normal</button>
                                <button class="preset-btn${this.settings.animSpeed === 1000 ? ' preset-btn--active' : ''}" data-target="animSpeed" data-value="1000">Slow</button>
                            </div>
                            <input class="settings-slider" type="range" id="slider-anim-speed"
                                min="0" max="1200" step="100" value="${this.settings.animSpeed}">
                        </div>
                    </div>

                    <div class="settings-footer">
                        <button class="settings-btn settings-btn--apply" id="settings-apply">Apply &amp; Close</button>
                        <button class="settings-btn settings-btn--cancel" id="settings-cancel">Cancel</button>
                        <button class="settings-btn settings-btn--reset" id="settings-reset">Reset to Defaults</button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        // Live label map
        const labelMap = {
            'slider-text-speed': { lblId: 'lbl-text-speed', map: textLabels, key: 'textSpeed' },
            'slider-auto-advance': { lblId: 'lbl-auto-advance', map: autoLabels, key: 'autoAdvanceDelay' },
            'slider-materi-pause': { lblId: 'lbl-materi-pause', map: materiLabels, key: 'materiPauseDuration' },
            'slider-anim-speed': { lblId: 'lbl-anim-speed', map: animLabels, key: 'animSpeed' },
        };

        // Update label + active preset buttons when slider moves
        const syncPresets = (key, val) => {
            modal.querySelectorAll(`.preset-btn[data-target="${key}"]`).forEach(b => {
                b.classList.toggle('preset-btn--active', parseInt(b.dataset.value, 10) === val);
            });
        };

        Object.entries(labelMap).forEach(([sliderId, cfg]) => {
            const slider = modal.querySelector(`#${sliderId}`);
            const lbl = modal.querySelector(`#${cfg.lblId}`);
            slider?.addEventListener('input', () => {
                const v = parseInt(slider.value, 10);
                this.settings[cfg.key] = v;
                if (lbl) lbl.textContent = labelFor(cfg.map, v);
                syncPresets(cfg.key, v);
            });
        });

        // Preset buttons update slider + label
        modal.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.target;
                const val = parseInt(btn.dataset.value, 10);
                this.settings[key] = val;
                // Update corresponding slider
                const cfg = Object.values(labelMap).find(c => c.key === key);
                if (cfg) {
                    const slider = modal.querySelector(`#${Object.keys(labelMap).find(k => labelMap[k].key === key)}`);
                    if (slider) slider.value = val;
                    const lbl = modal.querySelector(`#${cfg.lblId}`);
                    if (lbl) lbl.textContent = labelFor(cfg.map, val);
                }
                syncPresets(key, val);
            });
        });

        const close = () => modal.remove();

        modal.querySelector('#settings-close').addEventListener('click', () => {
            // Close without saving — restore previous values
            Object.assign(this.settings, prev);
            close();
        });

        modal.querySelector('#settings-cancel').addEventListener('click', () => {
            Object.assign(this.settings, prev);
            close();
        });

        modal.querySelector('#settings-apply').addEventListener('click', () => {
            this._applySettings();
            this._saveSettings();
            this.showNotification('Settings saved.');
            close();
        });

        modal.querySelector('#settings-reset').addEventListener('click', () => {
            this.settings.textSpeed = 40;
            this.settings.animSpeed = 500;
            this.settings.autoAdvanceDelay = 0;
            this.settings.materiPauseDuration = 1500;
            // Reset sliders
            Object.entries(labelMap).forEach(([sliderId, cfg]) => {
                const slider = modal.querySelector(`#${sliderId}`);
                if (slider) slider.value = this.settings[cfg.key];
                const lbl = modal.querySelector(`#${cfg.lblId}`);
                if (lbl) lbl.textContent = labelFor(cfg.map, this.settings[cfg.key]);
                syncPresets(cfg.key, this.settings[cfg.key]);
            });
        });

        modal.addEventListener('click', e => { if (e.target === modal) { Object.assign(this.settings, prev); close(); } });
    }

    loadGameState() {
        // Check URL hash for direct scene loading
        const hash = window.location.hash.substring(1);
        if (hash && this.scenes[hash]) {
            this.loadScene(hash);
        }
    }

    // Character Display System
    showCharacter(characterName, x, y, scale = 0.3) {
        if (!characterName) {
            console.error('showCharacter: characterName is required');
            return null;
        }
        const charactersContainer = document.getElementById('scene-characters');
        if (!charactersContainer) {
            console.error('Characters container not found');
            return null;
        }

        // Create character image element
        const character = document.createElement('img');
        character.className = 'npc-character';
        character.src = `assets/images/characters/${characterName}_southpark.svg`;
        character.style.cssText = `
            position: absolute; 
            left: ${x}%; 
            bottom: ${100 - y}%; 
            width: ${scale * 100}%; 
            height: auto; 
            opacity: 0; 
            transition: opacity 0.8s; 
            pointer-events: none; 
            z-index: 10;
        `;

        // Add unique ID if same character appears multiple times
        character.setAttribute('data-character', characterName);

        charactersContainer.appendChild(character);

        // Fade in
        requestAnimationFrame(() => {
            character.style.opacity = '1';
        });

        return character;
    }

    // Utilities
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Scene-scoped setTimeout — automatically cleared when leaving the current scene.
     * Use this instead of raw setTimeout() in scene code to prevent stale timers.
     * @param {Function} fn - callback
     * @param {number} delay - milliseconds
     * @returns {number} timeout ID
     */
    sceneTimeout(fn, delay) {
        const id = setTimeout(() => {
            // Remove from tracking array when it naturally fires
            this._sceneTimeouts = this._sceneTimeouts.filter(t => t !== id);
            fn();
        }, delay);
        this._sceneTimeouts.push(id);
        return id;
    }

    /**
     * Clear all pending scene-scoped timeouts. Called automatically on scene exit.
     */
    clearSceneTimeouts() {
        if (this._sceneTimeouts) {
            this._sceneTimeouts.forEach(id => clearTimeout(id));
            this._sceneTimeouts = [];
        }
    }

    /**
     * Clean up all engine resources. Call when the engine is being destroyed.
     */
    destroy() {
        // Remove all tracked event listeners
        for (const { target, event, handler, options } of this._boundHandlers) {
            target.removeEventListener(event, handler, options);
        }
        this._boundHandlers = [];

        // Stop speech
        this.stopSpeech();

        // Abort typewriter
        if (this.typewriterAbortController) {
            this.typewriterAbortController.abort();
            this.typewriterAbortController = null;
        }

        // Destroy player
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        // Clean up debug panel styles
        const debugStyles = document.getElementById('debug-panel-styles');
        if (debugStyles) debugStyles.remove();
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) debugPanel.remove();

        this.initialized = false;
        console.log('CyberGuard Engine destroyed');
    }



}

// Export for use
window.CyberGuardEngine = CyberGuardEngine;
