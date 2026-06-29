const MateriEdukasiScene = {
    id: 'materiedukasi',
    name: 'Materi Edukasi',

    background: 'assets/images/materi_img/slide1.png',
    backgroundColor: '#000000',

    description: 'Tonton video edukasi mengenai phishing dan sebagainya.',

    playerStart: { x: 50, y: 85 },

    accessibilityPath: [
        async function (game) {
            // Poll every 3 s until the documentary sets tv_documentary_watched
            // (happens when the last step auto-advances and calls loadScene).
            // Hard cap: 10 minutes (should be ample for any TTS speed).
            const started = Date.now();
            while (!game.getFlag('tv_documentary_watched') && (Date.now() - started) < 600000) {
                await game.wait(3000);
            }
        }
    ],

    hotspots: [
        {
            id: 'skip_docu',
            name: '⏭ Lewati Dokumentasi',
            x: 2, y: 2, width: 15, height: 8,
            cursor: 'pointer',
            action: (game) => {
                MateriEdukasiScene._cleanupDocumentary();
                game.setFlag('tv_documentary_watched', true);
                game.setFlag('documentary_completed_once', true);
                game.loadScene('home');
            }
        }
    ],

    /* ═══════════════════════════════════════════════════════
     *  AUDIO ENGINE — Cinematic Documentary Sound Design
     *  Rich layered Web Audio API synthesis with reverb,
     *  noise textures, evolving pads, and ambient music bed
     * ═══════════════════════════════════════════════════════ */
    _audioCtx: null,
    _masterGain: null,
    _reverbNodes: {},   // keyed by 'duration-decay'
    _noiseBuffer: null,

    _getAudioCtx() {
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioCtx.state === 'suspended') {
            this._audioCtx.resume();
        }
        // Create master gain (soft-limits overall volume)
        if (!this._masterGain) {
            this._masterGain = this._audioCtx.createGain();
            this._masterGain.gain.value = 0.7;
            this._masterGain.connect(this._audioCtx.destination);
        }
        return this._audioCtx;
    },

    /** Get or create a shared white-noise buffer (1 second) */
    _getNoiseBuffer() {
        if (this._noiseBuffer) return this._noiseBuffer;
        const ctx = this._getAudioCtx();
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noiseBuffer = buf;
        return buf;
    },

    /** Create a convolution reverb impulse response (cached per unique params) */
    _createReverb(duration = 2.5, decay = 2.0) {
        const key = `${duration}-${decay}`;
        if (this._reverbNodes[key]) return this._reverbNodes[key];
        const ctx = this._getAudioCtx();
        const len = ctx.sampleRate * duration;
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        const conv = ctx.createConvolver();
        conv.buffer = buf;
        this._reverbNodes[key] = conv;
        // Wire reverb → master
        conv.connect(this._masterGain);
        return conv;
    },

    /** Helper: create a noise source node */
    _createNoise(ctx) {
        const src = ctx.createBufferSource();
        src.buffer = this._getNoiseBuffer();
        src.loop = true;
        return src;
    },

    /* ─── WHOOSH — layered noise sweep with reverb ─── */
    _playWhoosh() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb();
            const master = this._masterGain;

            // Layer 1: filtered noise sweep (the "air" texture)
            const noise = this._createNoise(ctx);
            const nGain = ctx.createGain();
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 1.2;
            bp.frequency.setValueAtTime(300, now);
            bp.frequency.exponentialRampToValueAtTime(4000, now + 0.18);
            bp.frequency.exponentialRampToValueAtTime(200, now + 0.6);
            nGain.gain.setValueAtTime(0, now);
            nGain.gain.linearRampToValueAtTime(0.18, now + 0.06);
            nGain.gain.linearRampToValueAtTime(0.12, now + 0.18);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            noise.connect(bp).connect(nGain);
            nGain.connect(master);
            nGain.connect(rev);

            // Layer 2: tonal sweep for body
            const osc = ctx.createOscillator();
            const oGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.55);
            oGain.gain.setValueAtTime(0, now);
            oGain.gain.linearRampToValueAtTime(0.06, now + 0.04);
            oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(oGain);
            oGain.connect(master);
            oGain.connect(rev);

            noise.start(now);
            noise.stop(now + 0.8);
            osc.start(now);
            osc.stop(now + 0.7);
        } catch (e) { /* silent fail */ }
    },

    /* ─── IMPACT — deep cinematic boom with sub-bass, transient & reverb tail ─── */
    _playImpact() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb();
            const master = this._masterGain;

            // Sub-bass thud
            const sub = ctx.createOscillator();
            const subGain = ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(90, now);
            sub.frequency.exponentialRampToValueAtTime(25, now + 1.2);
            subGain.gain.setValueAtTime(0.22, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            sub.connect(subGain);
            subGain.connect(master);
            subGain.connect(rev);

            // Mid transient punch
            const mid = ctx.createOscillator();
            const midGain = ctx.createGain();
            mid.type = 'triangle';
            mid.frequency.setValueAtTime(250, now);
            mid.frequency.exponentialRampToValueAtTime(60, now + 0.3);
            midGain.gain.setValueAtTime(0.12, now);
            midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            mid.connect(midGain);
            midGain.connect(master);

            // Noise crack layer
            const noise = this._createNoise(ctx);
            const nGain = ctx.createGain();
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 2000;
            nGain.gain.setValueAtTime(0.1, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            noise.connect(hp).connect(nGain);
            nGain.connect(master);
            nGain.connect(rev);

            sub.start(now); sub.stop(now + 1.6);
            mid.start(now); mid.stop(now + 0.4);
            noise.start(now); noise.stop(now + 0.15);
        } catch (e) { /* silent fail */ }
    },

    /* ─── DRONE — rich evolving ambient pad with LFO modulation ─── */
    _playDrone() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb(3.5, 1.8);
            const master = this._masterGain;

            // Master drone gain (for fade-out)
            const droneGain = ctx.createGain();
            droneGain.gain.setValueAtTime(0, now);
            droneGain.gain.linearRampToValueAtTime(1, now + 3);
            droneGain.connect(master);

            // Warm filter
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 350;
            lp.Q.value = 0.7;
            lp.connect(droneGain);
            lp.connect(rev);

            // LFO for filter modulation (slow breathing)
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.08; // very slow
            lfoGain.gain.value = 100;
            lfo.connect(lfoGain);
            lfoGain.connect(lp.frequency);
            lfo.start(now);

            // 4 detuned oscillators for richness
            const freqs = [55, 82.5, 110, 165]; // A1, E2, A2, E3
            const types = ['sine', 'sine', 'triangle', 'sine'];
            const gains = [0.07, 0.05, 0.03, 0.02];
            const oscs = freqs.map((f, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = types[i];
                o.frequency.value = f;
                // Slight random detune for warmth
                o.detune.value = (Math.random() - 0.5) * 12;
                g.gain.value = gains[i];
                o.connect(g).connect(lp);
                o.start(now);
                return o;
            });

            // Sub-bass breathe layer (very slow vibrato)
            const subLfo = ctx.createOscillator();
            const subLfoG = ctx.createGain();
            subLfo.type = 'sine';
            subLfo.frequency.value = 0.15;
            subLfoG.gain.value = 3;
            subLfo.connect(subLfoG);
            oscs[0] && subLfoG.connect(oscs[0].frequency);
            subLfo.start(now);

            return () => {
                const t = ctx.currentTime;
                droneGain.gain.linearRampToValueAtTime(0.001, t + 2);
                setTimeout(() => {
                    oscs.forEach(o => { try { o.stop(); } catch (e) { } });
                    try { lfo.stop(); subLfo.stop(); } catch (e) { }
                }, 2200);
            };
        } catch (e) { return () => { }; }
    },

    /* ─── TICK — warm piano-like pluck with harmonics ─── */
    _playTick() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const master = this._masterGain;
            const rev = this._createReverb();

            // Fundamental
            const baseFreq = 800 + Math.random() * 300;
            const harmonics = [1, 2, 3, 5];
            const hGains = [0.05, 0.025, 0.012, 0.006];

            harmonics.forEach((h, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * h;
                gain.gain.setValueAtTime(hGains[i], now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 + i * 0.05);
                osc.connect(gain);
                gain.connect(master);
                if (i === 0) gain.connect(rev);
                osc.start(now);
                osc.stop(now + 0.3 + i * 0.05);
            });
        } catch (e) { /* silent fail */ }
    },

    /* ─── RISER — multi-layered tension build ─── */
    _playRiser() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb();
            const master = this._masterGain;

            // Tonal sweep
            const osc = ctx.createOscillator();
            const oGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 2.0);
            oGain.gain.setValueAtTime(0, now);
            oGain.gain.linearRampToValueAtTime(0.05, now + 0.3);
            oGain.gain.linearRampToValueAtTime(0.07, now + 1.6);
            oGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(400, now);
            lp.frequency.exponentialRampToValueAtTime(3000, now + 2.0);
            osc.connect(lp).connect(oGain);
            oGain.connect(master);
            oGain.connect(rev);

            // Noise texture rising underneath
            const noise = this._createNoise(ctx);
            const nGain = ctx.createGain();
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 2;
            bp.frequency.setValueAtTime(500, now);
            bp.frequency.exponentialRampToValueAtTime(5000, now + 2.0);
            nGain.gain.setValueAtTime(0, now);
            nGain.gain.linearRampToValueAtTime(0.04, now + 1.0);
            nGain.gain.linearRampToValueAtTime(0.08, now + 1.8);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);
            noise.connect(bp).connect(nGain);
            nGain.connect(master);

            // Sub-bass swell
            const sub = ctx.createOscillator();
            const sGain = ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(55, now);
            sub.frequency.linearRampToValueAtTime(80, now + 2.0);
            sGain.gain.setValueAtTime(0, now);
            sGain.gain.linearRampToValueAtTime(0.08, now + 1.5);
            sGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);
            sub.connect(sGain);
            sGain.connect(master);

            osc.start(now); osc.stop(now + 2.4);
            noise.start(now); noise.stop(now + 2.5);
            sub.start(now); sub.stop(now + 2.5);
        } catch (e) { /* silent fail */ }
    },

    /* ─── CHIME — bell-like harmonics with pentatonic resolution ─── */
    _playChime() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb();
            const master = this._masterGain;

            // Pentatonic: C5, D5, E5, G5, A5, C6
            const notes = [523, 587, 659, 784, 880, 1047];
            notes.forEach((freq, i) => {
                const t = now + i * 0.18;
                // Fundamental + 2nd partial for bell-like quality
                [1, 2.76].forEach((partial, pi) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = pi === 0 ? 'sine' : 'triangle';
                    osc.frequency.value = freq * partial;
                    const vol = pi === 0 ? 0.06 : 0.015;
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2 - pi * 0.3);
                    osc.connect(gain);
                    gain.connect(master);
                    gain.connect(rev);
                    osc.start(t);
                    osc.stop(t + 1.4);
                });
            });
        } catch (e) { /* silent fail */ }
    },

    /* ─── MUSIC BED — gentle ambient generative music ─── */
    _playMusicBed() {
        try {
            const ctx = this._getAudioCtx();
            const now = ctx.currentTime;
            const rev = this._createReverb(4, 1.5);
            const master = this._masterGain;

            const musicGain = ctx.createGain();
            musicGain.gain.setValueAtTime(0, now);
            musicGain.gain.linearRampToValueAtTime(1, now + 4);

            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 600;
            lp.Q.value = 0.5;
            lp.connect(musicGain);
            musicGain.connect(master);

            // Warm pad — slow chord tones
            // Am → C → F → G progression (gentle, cinematic)
            const chords = [
                [220, 261.6, 329.6],    // Am (A3, C4, E4)
                [261.6, 329.6, 392],     // C  (C4, E4, G4)
                [174.6, 220, 261.6],     // F  (F3, A3, C4)
                [196, 246.9, 293.7],     // G  (G3, B3, D4)
            ];

            const chordDur = 8; // seconds per chord
            let activeOscs = [];

            const playChord = (chordIdx) => {
                const chord = chords[chordIdx % chords.length];
                const t = ctx.currentTime;

                chord.forEach((freq) => {
                    // Two detuned oscillators per note for warmth
                    [-4, 4].forEach((detune) => {
                        const osc = ctx.createOscillator();
                        const g = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.value = freq;
                        osc.detune.value = detune;
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.025, t + 1.5);
                        g.gain.linearRampToValueAtTime(0.025, t + chordDur - 1.5);
                        g.gain.linearRampToValueAtTime(0, t + chordDur);
                        osc.connect(g).connect(lp);
                        g.connect(rev);
                        osc.start(t);
                        osc.stop(t + chordDur + 0.1);
                        activeOscs.push(osc);
                    });
                });

                // Simple arpeggio on top (sparse, atmospheric)
                const arpNotes = [...chord, chord[0] * 2]; // octave up
                arpNotes.forEach((freq, i) => {
                    const at = t + i * 1.8 + 0.5;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq * 2; // one octave up
                    g.gain.setValueAtTime(0, at);
                    g.gain.linearRampToValueAtTime(0.015, at + 0.1);
                    g.gain.exponentialRampToValueAtTime(0.001, at + 2.5);
                    osc.connect(g).connect(lp);
                    g.connect(rev);
                    osc.start(at);
                    osc.stop(at + 3);
                    activeOscs.push(osc);
                });
            };

            // Start chord progression loop
            let chordIndex = 0;
            let stopped = false;
            const scheduleNext = () => {
                if (stopped) return;
                playChord(chordIndex);
                chordIndex++;
                MateriEdukasiScene._musicTimer = setTimeout(scheduleNext, chordDur * 1000);
            };
            scheduleNext();

            return () => {
                stopped = true;
                clearTimeout(MateriEdukasiScene._musicTimer);
                const t = ctx.currentTime;
                musicGain.gain.linearRampToValueAtTime(0.001, t + 2);
                setTimeout(() => {
                    activeOscs.forEach(o => { try { o.stop(); } catch (e) { } });
                    activeOscs = [];
                }, 2500);
            };
        } catch (e) { return () => { }; }
    },
    _musicTimer: null,

    /* ═══════════════════════════════════════════════════════
     *  CLEANUP
     * ═══════════════════════════════════════════════════════ */
    _cleanupDocumentary() {
        const overlay = document.getElementById('matedukasi-overlay');
        if (overlay) overlay.remove();
        const style = document.getElementById('matedukasi-style');
        if (style) style.remove();
        if (MateriEdukasiScene._stopDrone) {
            MateriEdukasiScene._stopDrone();
            MateriEdukasiScene._stopDrone = null;
        }
        if (MateriEdukasiScene._musicStop) {
            MateriEdukasiScene._musicStop();
            MateriEdukasiScene._musicStop = null;
        }
        // Stop any ongoing TTS
        MateriEdukasiScene._stopSpeech();
    },

    _stopDrone: null,
    _musicStop: null,

    /** Speak text via the game voice system (with speaker profile). Returns a Promise. */
    _speak(text, speaker = 'Documentary') {
        try {
            const vm = window.voiceManager;
            if (vm && vm.enabled) {
                // if (vm && vm.enabled) {
                // vm.speak() internally cancels any prior utterance
                return vm.speak(text, speaker); // returns a Promise
            }
        } catch (e) { /* TTS not critical */ }
        return Promise.resolve();
    },

    /** Stop any ongoing TTS */
    _stopSpeech() {
        try {
            const vm = window.voiceManager;
            if (vm) vm.stop();
        } catch (e) { /* silent */ }
    },

    /* ═══════════════════════════════════════════════════════
     *  MAIN DOCUMENTARY OVERLAY
     * ═══════════════════════════════════════════════════════ */
    showDocumentaryOverlay(game) {
        const self = MateriEdukasiScene;

        // ── CSS ──
        const style = document.createElement('style');
        style.id = 'matedukasi-style';
        style.textContent = `
            /* ═══════ BASE OVERLAY ═══════ */
            #matedukasi-overlay {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: #000;
                z-index: 8000;
                overflow: hidden;
                font-family: 'Helvetica Neue', 'Arial', sans-serif;
            }

            /* ═══════ SCREEN CONTAINER ═══════ */
            .matedukasi-screen {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                opacity: 0;
                transition: opacity 1.2s ease-in-out;
            }
            .matedukasi-screen.active { opacity: 1; }

            /* ═══════ BACKGROUND — Ken Burns ═══════ */
            .matedukasi-bg {
                position: absolute;
                top: -5%; left: -5%;
                width: 110%; height: 110%;
                background-size: cover;
                background-position: center;
                filter: brightness(0.6) contrast(1.1) saturate(0.9);
                animation: kenBurns 12s ease-in-out forwards;
            }
            @keyframes kenBurns {
                0%   { transform: scale(1) translate(0, 0); }
                100% { transform: scale(1.08) translate(-1%, -1%); }
            }

            /* ═══════ LETTERBOX BARS ═══════ */
            .matedukasi-letterbox-top,
            .matedukasi-letterbox-bottom {
                position: absolute;
                left: 0; width: 100%;
                background: #000;
                z-index: 50;
                pointer-events: none;
            }
            .matedukasi-letterbox-top    { top: 0; height: 6%; }
            .matedukasi-letterbox-bottom { bottom: 0; height: 6%; }

            /* ═══════ FILM GRAIN OVERLAY ═══════ */
            .matedukasi-grain {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background-image: url("assets/images/overlayimg/grain-noise-tvdoc.svg");
                opacity: 0.4;
                mix-blend-mode: overlay;
                pointer-events: none;
                z-index: 40;
                animation: grainShift 0.3s steps(4) infinite;
            }
            @keyframes grainShift {
                0%   { transform: translate(0, 0); }
                25%  { transform: translate(-2px, 3px); }
                50%  { transform: translate(3px, -1px); }
                75%  { transform: translate(-1px, -2px); }
                100% { transform: translate(2px, 1px); }
            }

            /* ═══════ SCAN LINES ═══════ */
            .matedukasi-scanlines {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0,0,0,0.06) 2px,
                    rgba(0,0,0,0.06) 4px
                );
                pointer-events: none;
                z-index: 41;
            }

            /* ═══════ VIGNETTE ═══════ */
            .matedukasi-vignette {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%);
                pointer-events: none;
                z-index: 42;
            }

            /* ═══════ TITLE CARD — BBC style ═══════ */
            .matedukasi-title-card {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                width: 85%;
                z-index: 20;
            }
            .matedukasi-title-card h1 {
                font-size: 3.8em;
                font-weight: 100;
                letter-spacing: 14px;
                color: #fff;
                text-transform: uppercase;
                margin: 0 0 20px 0;
                opacity: 0;
                animation: titleReveal 2s ease-out 0.3s forwards;
                text-shadow: 0 2px 30px rgba(0,0,0,0.8);
            }
            .matedukasi-title-card h2 {
                font-size: 1.6em;
                font-weight: 300;
                letter-spacing: 4px;
                color: #c0c0c0;
                margin: 0;
                opacity: 0;
                animation: subtitleReveal 1.5s ease-out 1.2s forwards;
                text-shadow: 0 2px 20px rgba(0,0,0,0.8);
            }
            .matedukasi-title-card .matedukasi-accent {
                display: block;
                width: 80px;
                height: 2px;
                background: #332dec;
                margin: 25px auto;
                opacity: 0;
                animation: lineGrow 1s ease-out 0.8s forwards;
            }

            @keyframes titleReveal {
                0%   { opacity: 0; transform: translateY(20px); letter-spacing: 20px; }
                100% { opacity: 1; transform: translateY(0); letter-spacing: 14px; }
            }
            @keyframes subtitleReveal {
                0%   { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes lineGrow {
                0%   { opacity: 0; width: 0; }
                100% { opacity: 1; width: 80px; }
            }

            /* ═══════ CHAPTER CARD ═══════ */
            .matedukasi-chapter {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 20;
                opacity: 0;
                animation: chapterReveal 1.5s ease-out 0.2s forwards;
            }
            .matedukasi-chapter .chapter-num {
                font-size: 1em;
                font-weight: 300;
                letter-spacing: 8px;
                color: #373af5;
                text-transform: uppercase;
                margin: 0 0 12px 0;
            }
            .matedukasi-chapter .chapter-title {
                font-size: 2.8em;
                font-weight: 100;
                letter-spacing: 8px;
                color: #fff;
                text-transform: uppercase;
                margin: 0;
                text-shadow: 0 2px 30px rgba(0,0,0,0.8);
            }
            .matedukasi-chapter .chapter-line {
                display: block;
                width: 60px;
                height: 2px;
                background: #373af5;
                margin: 18px auto 0;
            }
            @keyframes chapterReveal {
                0%   { opacity: 0; transform: translate(-50%, -40%); }
                100% { opacity: 1; transform: translate(-50%, -50%); }
            }

            /* ═══════ CHARACTER ENTRANCE ═══════ */
            .matedukasi-character-scene {
                position: absolute;
                bottom: 0; left: 0;
                width: 100%; height: 100%;
            }
            .matedukasi-character {
                position: absolute;
                bottom: 6%;
                left: 5%;
                opacity: 0;
                transform: translateX(-60px) scale(0.95);
                transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                z-index: 10;
            }
            .matedukasi-character.active {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
            .matedukasi-character img {
                height: 60vh;
                filter: drop-shadow(0 10px 50px rgba(0,0,0,0.9));
            }

            /* ═══════ NAMEPLATE — BBC lower-third ═══════ */
            .matedukasi-nameplate {
                position: absolute;
                bottom: 10%;
                left: 5%;
                display: flex;
                align-items: stretch;
                transform: translateX(-110%);
                animation: nameplateSlide 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;
                z-index: 15;
            }
            .matedukasi-nameplate .np-accent {
                width: 5px;
                background: #373af5;
                flex-shrink: 0;
            }
            .matedukasi-nameplate .np-content {
                background: rgba(0, 0, 0, 0.85);
                padding: 14px 28px 14px 18px;
                backdrop-filter: blur(10px);
            }
            .matedukasi-nameplate h3 {
                font-size: 1.6em;
                font-weight: 600;
                color: #fff;
                margin: 0 0 4px 0;
                letter-spacing: 1px;
            }
            .matedukasi-nameplate p {
                font-size: 1em;
                color: #aaa;
                margin: 0;
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            @keyframes nameplateSlide {
                0%   { transform: translateX(-110%); }
                100% { transform: translateX(0); }
            }

            /* ═══════ QUOTE BUBBLE — above nameplate ═══════ */
            .matedukasi-quote-bubble {
                position: absolute;
                bottom: 24%;
                right: 6%;
                width: 42%;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(20px);
                padding: 28px 35px;
                border-left: 4px solid #373af5;
                border-radius: 4px;
                box-shadow: 0 15px 60px rgba(0,0,0,0.6);
                opacity: 0;
                transform: translateY(20px);
                animation: quoteReveal 0.8s ease-out 1s forwards;
                z-index: 14;
            }
            .matedukasi-quote-bubble::before {
                content: '\\201C';
                position: absolute;
                top: -8px;
                left: 14px;
                font-size: 4em;
                color: rgba(57, 86, 230, 0.4);
                font-family: Georgia, serif;
                line-height: 1;
            }
            .matedukasi-quote-bubble p {
                font-size: 1.4em;
                font-weight: 300;
                color: #eee;
                margin: 0;
                line-height: 1.65;
                text-shadow: 0 1px 8px rgba(0,0,0,0.7);
                position: relative;
                z-index: 1;
            }
            @keyframes quoteReveal {
                0%   { opacity: 0; transform: translateY(20px); }
                100% { opacity: 1; transform: translateY(0); }
            }

            /* ═══════ TEXT OVERLAY — narration ═══════ */
            .matedukasi-text-overlay {
                position: absolute;
                bottom: 10%;
                left: 50%;
                transform: translateX(-50%);
                width: 70%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(15px);
                padding: 28px 45px;
                border-left: 4px solid #5939e6;
                border-radius: 4px;
                box-shadow: 0 10px 50px rgba(0,0,0,0.7);
                opacity: 0;
                animation: textSlideUp 0.8s ease-out 0.3s forwards;
                z-index: 20;
            }
            .matedukasi-text-overlay p {
                font-size: 1.4em;
                font-weight: 300;
                color: #ddd;
                margin: 10px 0;
                line-height: 1.7;
                text-align: left;
                text-shadow: 0 1px 6px rgba(0,0,0,0.6);
            }
            .matedukasi-text-overlay a {
                display: inline-block;
                margin-top: 12px;
                padding: 10px 24px;
                background: rgba(66, 57, 230, 0.25);
                border: 1px solid rgba(57, 97, 230, 0.6);
                border-radius: 4px;
                color: #fff;
                text-decoration: none;
                font-weight: 400;
                font-size: 0.9em;
                letter-spacing: 1px;
                transition: all 0.3s ease;
            }
            .matedukasi-text-overlay a:hover {
                background: rgba(63, 57, 230, 0.5);
                box-shadow: 0 0 20px rgba(69, 57, 230, 0.4);
            }
            @keyframes textSlideUp {
                0%   { opacity: 0; transform: translate(-50%, 30px); }
                100% { opacity: 1; transform: translate(-50%, 0); }
            }

            /* ═══════ CONTINUE BUTTON ═══════ */
            .matedukasi-continue {
                position: absolute;
                bottom: 2%;
                right: 3%;
                font-size: 0.95em;
                font-weight: 500;
                letter-spacing: 3px;
                text-transform: uppercase;
                color: #aaa;
                background: rgba(0,0,0,0.6);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 4px;
                padding: 10px 24px;
                cursor: pointer;
                z-index: 55;
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
            }
            .matedukasi-continue:hover {
                color: #fff;
                border-color: #373af5;
                background: rgba(86, 57, 230, 0.2);
                box-shadow: 0 0 20px rgba(74, 57, 230, 0.3);
            }

            /* ═══════ TIMELINE BAR ═══════ */
            .matedukasi-timeline {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 3px;
                background: rgba(255,255,255,0.08);
                z-index: 55;
            }
            .matedukasi-timeline-fill {
                height: 100%;
                background: #373af5;
                width: 0%;
                transition: width 0.3s ease;
            }

            /* ═══════ STEP COUNTER ═══════ */
            .matedukasi-step-counter {
                position: absolute;
                top: 2.5%;
                right: 3%;
                font-size: 0.8em;
                font-weight: 300;
                letter-spacing: 3px;
                color: rgba(255,255,255,0.3);
                z-index: 55;
            }

            /* ═══════ NETWORK BRAND ═══════ */
            .matedukasi-brand {
                position: absolute;
                top: 2.5%;
                left: 3%;
                font-size: 0.7em;
                font-weight: 600;
                letter-spacing: 4px;
                text-transform: uppercase;
                color: rgba(255,255,255,0.2);
                z-index: 55;
            }

            /* ═══════ FACT LINE (yellow — properly aligned) ═══════ */
            .matedukasi-fact {
                display: block;
                margin-top: 14px;
                padding: 10px 18px;
                background: rgba(230, 170, 0, 0.12);
                border-left: 3px solid #e6aa00;
                border-radius: 2px;
                font-size: 0.85em !important;
                color: #e6d280 !important;
                font-style: italic;
                line-height: 1.5 !important;
            }

            /* ═══════ INTERVIEW BG CHAPTER LABEL ═══════ */
            .matedukasi-chapter-label {
                position: absolute;
                top: 8%;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.85em;
                font-weight: 300;
                letter-spacing: 6px;
                text-transform: uppercase;
                color: rgba(255,255,255,0.25);
                z-index: 18;
                padding: 8px 20px;
                border: 1px solid rgba(255,255,255,0.1);
            }

            /* ═══════ GLOBAL TRANSITIONS ═══════ */
            .matedukasi-screen { animation: screenFadeIn 0.5s ease forwards; }
            @keyframes screenFadeIn {
                0%   { opacity: 0; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // ── Overlay container ──
        const overlay = document.createElement('div');
        overlay.id = 'matedukasi-overlay';
        document.body.appendChild(overlay);

        // Start background drone + ambient music bed
        self._stopDrone = self._playDrone();
        self._musicStop = self._playMusicBed();

        // ── Documentary sequence ──
        const sequence = [
            // ─── 0: COLD OPEN ───
            {
                duration: 4000,
                sound: 'impact',
                voice: { text: 'Materi Edukasi Spear Phishing', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide1.png');"></div>
                    <div class="matedukasi-title-card">
                        <h1>Materi Edukasi</h1>
                        <span class="matedukasi-accent"></span>
                        <h2>Phishing, Spear Phishing</h2>
                    </div>
                `
            },
            // ─── 1: NARRATOR — introduces the theme ───
            {
                duration: 12000,
                sound: 'whoosh',
                voice: { text: 'Internet memudahkan kita belajar, bekerja, berbelanja, hingga berkomunikasi. Namun, di balik kemudahan tersebut terdapat berbagai ancaman yang dapat mencuri data pribadi, akun media sosial, bahkan informasi keuangan apabila kita tidak berhati-hati.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide2.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Internet memudahkan kita belajar, bekerja, berbelanja, hingga berkomunikasi.</br>
                        Namun, di balik kemudahan tersebut terdapat berbagai ancaman yang dapat mencuri data pribadi, akun media sosial, bahkan informasi keuangan apabila kita tidak berhati-hati.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Phishing adalah metode penipuan yang dilakukan dengan menyamar sebagai pihak yang terpercaya untuk memperoleh informasi sensitif, seperti username, password, kode OTP, maupun data kartu pembayaran. Biasanya pelaku menggunakan email, pesan singkat, media sosial, atau situs web palsu.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide3.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Phishing adalah metode penipuan yang dilakukan dengan menyamar sebagai pihak yang terpercaya untuk memperoleh informasi sensitif, seperti username, password, kode OTP, maupun data kartu pembayaran.</br>
                        Biasanya pelaku menggunakan email, pesan singkat, media sosial, atau situs web palsu.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Pelaku akan mengirimkan pesan yang terlihat meyakinkan, misalnya pemberitahuan akun akan diblokir, hadiah undian, atau promo tertentu. Korban kemudian diarahkan untuk mengklik tautan dan memasukkan data pribadi pada halaman palsu yang telah disiapkan.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide4.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Pelaku akan mengirimkan pesan yang terlihat meyakinkan, misalnya pemberitahuan akun akan diblokir, hadiah undian, atau promo tertentu.</br>
                        Korban kemudian diarahkan untuk mengklik tautan dan memasukkan data pribadi pada halaman palsu yang telah disiapkan.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Beberapa tanda phishing yang perlu diperhatikan antara lain yaitu Alamat email pengirim tidak resmi, URL website berbeda dari yang asli, Banyak kesalahan penulisan, Pesan bernada mendesak, Meminta informasi pribadi. Jika menemukan salah satu tanda tersebut, jangan langsung mempercayainya.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide5.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Beberapa tanda phishing yang perlu diperhatikan antara lain yaitu Alamat email pengirim tidak resmi, URL website berbeda dari yang asli, Banyak kesalahan penulisan, Pesan bernada mendesak, Meminta informasi pribadi.</br>
                        Jika menemukan salah satu tanda tersebut, jangan langsung mempercayainya.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Berbeda dengan phishing biasa, Spear Phishing merupakan serangan yang menargetkan orang tertentu. Pelaku biasanya sudah mengetahui sebagian informasi mengenai korbannya sehingga pesan yang dikirim terlihat lebih meyakinkan dan sulit dikenali.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide6.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Berbeda dengan phishing biasa, Spear Phishing merupakan serangan yang menargetkan orang tertentu.</br>
                        Pelaku biasanya sudah mengetahui sebagian informasi mengenai korbannya sehingga pesan yang dikirim terlihat lebih meyakinkan dan sulit dikenali.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Dalam Spear Phishing, pelaku dapat menggunakan nama korban, tempat bekerja, sekolah, teman, bahkan aktivitas di media sosial untuk membangun kepercayaan. Karena terlihat sangat nyata, korban sering kali tidak menyadari bahwa dirinya sedang menjadi sasaran penipuan.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide7.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Dalam Spear Phishing, pelaku dapat menggunakan nama korban, tempat bekerja, sekolah, teman, bahkan aktivitas di media sosial untuk membangun kepercayaan.</br>
                        Karena terlihat sangat nyata, korban sering kali tidak menyadari bahwa dirinya sedang menjadi sasaran penipuan.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Misalnya kamu menerima email dari seseorang yang mengaku sebagai dosen, HRD perusahaan, atau jasa ekspedisi. Email tersebut menyebut namamu dan meminta membuka lampiran atau mengisi data melalui tautan tertentu. Meskipun terlihat resmi, pesan tersebut belum tentu berasal dari pihak yang sebenarnya.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide8.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Misalnya kamu menerima email dari seseorang yang mengaku sebagai dosen, HRD perusahaan, atau jasa ekspedisi.</br>
                        Email tersebut menyebut namamu dan meminta membuka lampiran atau mengisi data melalui tautan tertentu. Meskipun terlihat resmi, pesan tersebut belum tentu berasal dari pihak yang sebenarnya.
                    </div>
                `
            },
            {
                duration: 10000,
                sound: 'impact',
                voice: { text: 'Sebelum mengklik tautan atau memberikan informasi pribadi, biasakan untuk Memeriksa alamat email pengirim, Memastikan URL website benar, Tidak membagikan kode OTP, Mengaktifkan autentikasi dua faktor (2FA), Melakukan verifikasi kepada pihak terkait apabila merasa ragu.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide9.png'); animation-duration: 14s;"></div>
                    <div class="matedukasi-text-overlay">
                        Sebelum mengklik tautan atau memberikan informasi pribadi, biasakan untuk Memeriksa alamat email pengirim, Memastikan URL website benar, Tidak membagikan kode OTP, Mengaktifkan autentikasi dua faktor (2FA), Melakukan verifikasi kepada pihak terkait apabila merasa ragu.
                    </div>
                `
            },
            {
                duration: 8000,
                sound: 'chime',
                voice: { text: 'Sekarang kamu telah memahami dasar-dasar phishing dan Spear Phishing. Selanjutnya, kamu akan mencoba mendeteksi berbagai ancaman melalui simulasi Point-and-Click. Temukan setiap tanda yang mencurigakan dan buktikan bahwa kamu siap menjadi seorang Cyber Guard.', speaker: 'Documentary' },
                content: `
                    <div class="matedukasi-bg" style="background-image: url('assets/images/materi_img/slide10.png'); animation-direction: reverse;"></div>
                    <div class="matedukasi-title-card">
                        <span class="matedukasi-accent"></span>
                        <h1>Yuk Mulai Simulasi!</h1>
                        <span class="matedukasi-accent"></span>
                    </div>
                `
            }
        ];

        let currentStep = 0;

        const showStep = () => {
            if (currentStep >= sequence.length) {
                // Documentary finished
                setTimeout(() => {
                    self._cleanupDocumentary();
                    game.setFlag('tv_documentary_watched', true);
                    game.setFlag('documentary_completed_once', true);

                    // game.startDialogue([
                    //     { speaker: 'Ryan', text: 'Incredible documentary. Those engineers are remarkable.' },
                    //     { speaker: 'Ryan', text: 'Now I really need to check my radio equipment.' }
                    // ]);

                    game.sceneTimeout(() => {
                        game.loadScene('home');
                    }, 3000);
                }, 1000);
                return;
            }

            const step = sequence[currentStep];

            // Play sound FX
            try {
                switch (step.sound) {
                    case 'whoosh': self._playWhoosh(); break;
                    case 'impact': self._playImpact(); break;
                    case 'tick': self._playTick(); break;
                    case 'riser': self._playRiser(); break;
                    case 'chime': self._playChime(); break;
                }
            } catch (e) { /* audio not critical */ }

            // Speak voice-over / interview dialogue via TTS
            // speechDone resolves when TTS finishes (or immediately if no TTS)
            let speechDone = Promise.resolve();
            if (step.voice) {
                speechDone = new Promise(resolve => {
                    setTimeout(() => {
                        self._speak(step.voice.text, step.voice.speaker || 'Documentary')
                            .then(resolve)
                            .catch(resolve);
                    }, 600);  // slight delay so sound FX lands first
                });
            }

            // Calculate minimum reading time from word count (~160 WPM comfortable reading)
            // This guarantees text stays on screen long enough even if TTS isn't working
            const voiceText = step.voice ? step.voice.text : '';
            const wordCount = voiceText.split(/\s+/).filter(w => w).length;
            const minReadMs = Math.max(4000, wordCount * 375);  // ~160 WPM, floor 4s
            const minReadTimer = new Promise(resolve => setTimeout(resolve, minReadMs));

            // Build screen
            const screen = document.createElement('div');
            screen.className = 'matedukasi-screen';
            screen.innerHTML = step.content;

            // Add cinematic overlays
            screen.innerHTML += `
                <div class="matedukasi-grain"></div>
                <div class="matedukasi-scanlines"></div>
                <div class="matedukasi-vignette"></div>
                <div class="matedukasi-letterbox-top"></div>
                <div class="matedukasi-letterbox-bottom"></div>
            `;

            // Add brand watermark
            const brand = document.createElement('div');
            brand.className = 'matedukasi-brand';
            brand.textContent = '';
            screen.appendChild(brand);

            // Add step counter
            const counter = document.createElement('div');
            counter.className = 'matedukasi-step-counter';
            counter.textContent = `${currentStep + 1} / ${sequence.length}`;
            screen.appendChild(counter);

            // Timeline bar
            const timeline = document.createElement('div');
            timeline.className = 'matedukasi-timeline';
            const fill = document.createElement('div');
            fill.className = 'matedukasi-timeline-fill';
            fill.style.width = `${((currentStep + 1) / sequence.length) * 100}%`;
            timeline.appendChild(fill);
            screen.appendChild(timeline);

            // Continue button
            const continueBtn = document.createElement('div');
            continueBtn.className = 'matedukasi-continue';
            continueBtn.textContent = currentStep < sequence.length - 1 ? 'LEWATI ▸' : 'SELESAI ▸';
            continueBtn.onclick = () => {
                self._stopSpeech();
                screen.style.opacity = '0';
                setTimeout(() => {
                    screen.remove();
                    currentStep++;
                    showStep();
                }, 600);
            };
            screen.appendChild(continueBtn);

            overlay.appendChild(screen);

            // Trigger entrance animations
            setTimeout(() => {
                screen.classList.add('active');

                // Animate character if present
                if (step.character) {
                    const character = screen.querySelector('.matedukasi-character');
                    if (character) {
                        setTimeout(() => character.classList.add('active'), 200);
                    }
                }
            }, 50);

            // Auto-advance: wait for BOTH speech AND minimum reading time, then pause
            Promise.all([speechDone, minReadTimer]).then(() => {
                const pauseMs = (window.game && window.game.settings)
                    ? (window.game.settings.docuPauseDuration ?? 1500)
                    : 1500;
                setTimeout(() => {
                    if (screen.parentElement) {
                        continueBtn.click();
                    }
                }, pauseMs);
            });
        };

        showStep();
    },

    /* ═══════════════════════════════════════════════════════
     *  SCENE LIFECYCLE
     * ═══════════════════════════════════════════════════════ */
    onEnter(game) {
        if (game.player) game.player.hide();

        setTimeout(() => {
            MateriEdukasiScene.showDocumentaryOverlay(game);
        }, 500);
    },

    onExit(game) {
        MateriEdukasiScene._cleanupDocumentary();
        if (game.player) game.player.show();
    }
};

// Register the scene
if (typeof window !== 'undefined' && window.game) {
    window.game.registerScene(MateriEdukasiScene);
}
