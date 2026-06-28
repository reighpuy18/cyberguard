/**
 * Scene: Home (Kitchen)
 * Starting scene - Ryan's farmhouse kitchen in Compascuum
 */

const HomeScene = {
    id: 'home',
    name: 'Di Ruang Tamu',

    // SVG background
    background: 'assets/images/scenes/home.png',

    // Player starting position
    playerStart: { x: 50, y: 85 },

    // 🎬 Accessibility / Movie Mode — optimal story path
    accessibilityPath: [
        // 'espresso-machine',
        async function (game) {
            // Go to livingroom first if documentary not yet watched, else mancave
            if (!game.getFlag('tv_documentary_watched')) {
                game.loadScene('home');
            } else {
                game.loadScene('mancave');
            }
        }
    ],

    // Random idle thoughts for this scene
    idleThoughts: [
        "Kok diam? butuh kopi kah?",
        "Sepi banget...",
    ],

    hotspots: [
        {
            id: 'door-simulation',
            name: 'Pergi ke Ruang Simulasi',
            // SVG: frame x=285 y=407 w=180 h=374
            x: 81.1,
            y: 25,
            width: 16,
            height: 51.5,
            cursor: 'pointer',
            condition: function (game) {
                return game.getFlag('tv_documentary_watched');
            },
            failMessage: 'Gagal menuju Ruang Simulasi, sentuh Tombol What To Do diatas!.',
            targetScene: 'simulation'
        },
        {
            id: 'tv',
            name: 'Tonton Video Edukasi',
            x: 15.6,
            y: 45.9,
            width: 18,
            height: 20.7,
            cursor: 'pointer',
            action: (game) => {
                if (!game.getFlag('tv_documentary_watched')) {
                    game.setFlag('tv_documentary_watched', true);
                    game.startDialogue([
                        { speaker: 'Cygu', text: 'Video berikut berisi informasi mengenai ancaman Spear Phishing dan cara mengenali tanda-tandanya.' },
                        { speaker: 'Cygu', text: 'Selamat menyaksikan.' }
                    ]);
                    game.sceneTimeout(() => {
                        game.loadScene('materiedukasi');
                    }, 6000);
                    if ((game.gameState.day || 1) === 1 || game.gameState.storyPart < 1) game.setStoryPart(1);
                } else if (game.accessibilityMode) {
                    // 🎬 Movie mode: auto-pick next unwatched channel
                    if (!game.getFlag('tv_documentary_watched')) {
                        game.loadScene('materiedukasi');
                    } else if (!game.getFlag('tv_news_watched')) {
                        game.loadScene('materikedua');
                    }
                    // If both watched, do nothing (path continues to to_home)
                } else {
                    // Show channel picker overlay
                    HomeScene._showChannelPicker(game);
                }
            }
        },
    ],

    // ======= WEB AUDIO: KITCHEN AMBIENCE + COFFEE MACHINE =======
    _audioCtx: null,
    _audioNodes: [],
    _audioIntervals: [],
    _audioTimeouts: [],

    _getAudioCtx: function () {
        if (!this._audioCtx || this._audioCtx.state === 'closed') {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
        return this._audioCtx;
    },

    _startKitchenAmbience: function () {
        try {
            const ctx = this._getAudioCtx();
            const nodes = this._audioNodes;
            const intervals = this._audioIntervals;
            const timeouts = this._audioTimeouts;
            const now = ctx.currentTime;

            // === 1. CLOCK TICKING ===
            const scheduleTick = () => {
                const t = ctx.currentTime;
                // Tick
                const tickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.02), ctx.sampleRate);
                const tickData = tickBuf.getChannelData(0);
                for (let i = 0; i < tickData.length; i++) {
                    tickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
                }
                const tickSrc = ctx.createBufferSource();
                tickSrc.buffer = tickBuf;
                const tickFilter = ctx.createBiquadFilter();
                tickFilter.type = 'bandpass';
                tickFilter.frequency.setValueAtTime(3500, t);
                tickFilter.Q.setValueAtTime(5, t);
                const tickGain = ctx.createGain();
                tickGain.gain.setValueAtTime(0.025, t);
                tickSrc.connect(tickFilter);
                tickFilter.connect(tickGain);
                tickGain.connect(ctx.destination);
                tickSrc.start(t);
            };
            intervals.push(setInterval(scheduleTick, 1000));

            // === 2. BIRDS OUTSIDE WINDOW (cheerful morning birds) ===
            // Robin song
            const scheduleRobin = () => {
                const t = ctx.currentTime;
                const noteCount = 4 + Math.floor(Math.random() * 4);
                for (let i = 0; i < noteCount; i++) {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    const freq = 2200 + Math.random() * 1200;
                    osc.frequency.setValueAtTime(freq, t + i * 0.12);
                    osc.frequency.exponentialRampToValueAtTime(freq * (0.85 + Math.random() * 0.3), t + i * 0.12 + 0.08);
                    const g = ctx.createGain();
                    g.gain.setValueAtTime(0, t + i * 0.12);
                    g.gain.linearRampToValueAtTime(0.015, t + i * 0.12 + 0.02);
                    g.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.1);
                    osc.connect(g);
                    g.connect(ctx.destination);
                    osc.start(t + i * 0.12);
                    osc.stop(t + i * 0.12 + 0.12);
                }
            };
            timeouts.push(setTimeout(() => {
                scheduleRobin();
                intervals.push(setInterval(() => {
                    if (Math.random() < 0.5) scheduleRobin();
                }, 4000 + Math.random() * 5000));
            }, 2000));

            // Sparrow chatter
            const scheduleSparrow = () => {
                const t = ctx.currentTime;
                for (let i = 0; i < 3; i++) {
                    const osc = ctx.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(3800 + Math.random() * 400, t + i * 0.08);
                    const g = ctx.createGain();
                    g.gain.setValueAtTime(0, t + i * 0.08);
                    g.gain.linearRampToValueAtTime(0.01, t + i * 0.08 + 0.02);
                    g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.06);
                    osc.connect(g);
                    g.connect(ctx.destination);
                    osc.start(t + i * 0.08);
                    osc.stop(t + i * 0.08 + 0.07);
                }
            };
            intervals.push(setInterval(() => {
                if (Math.random() < 0.4) scheduleSparrow();
            }, 6000 + Math.random() * 6000));

            // === 3. DISTANT DOG BARK (Ryan has dogs) ===
            const scheduleDogBark = () => {
                const t = ctx.currentTime;
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(500, t);
                filter.Q.setValueAtTime(2, t);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.015, t + 0.02);
                g.gain.linearRampToValueAtTime(0, t + 0.1);
                osc.connect(filter);
                filter.connect(g);
                g.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.12);
            };
            timeouts.push(setTimeout(() => {
                scheduleDogBark();
                intervals.push(setInterval(() => {
                    if (Math.random() < 0.25) scheduleDogBark();
                }, 15000 + Math.random() * 20000));
            }, 8000));

            // === 4. FRIDGE HUM (low continuous drone) ===
            const fridgeOsc = ctx.createOscillator();
            fridgeOsc.type = 'sine';
            fridgeOsc.frequency.setValueAtTime(120, now);
            const fridgeGain = ctx.createGain();
            fridgeGain.gain.setValueAtTime(0, now);
            fridgeGain.gain.linearRampToValueAtTime(0.008, now + 2);
            const fridgeFilter = ctx.createBiquadFilter();
            fridgeFilter.type = 'lowpass';
            fridgeFilter.frequency.setValueAtTime(180, now);
            fridgeOsc.connect(fridgeFilter);
            fridgeFilter.connect(fridgeGain);
            fridgeGain.connect(ctx.destination);
            fridgeOsc.start(now);
            nodes.push(fridgeOsc, fridgeGain, fridgeFilter);

            // === 5. WATER DRIP FROM SINK (occasional) ===
            const scheduleDrip = () => {
                const t = ctx.currentTime;
                const dOsc = ctx.createOscillator();
                dOsc.type = 'sine';
                dOsc.frequency.setValueAtTime(1800, t);
                dOsc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
                const dG = ctx.createGain();
                dG.gain.setValueAtTime(0.012, t);
                dG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                dOsc.connect(dG);
                dG.connect(ctx.destination);
                dOsc.start(t);
                dOsc.stop(t + 0.2);
            };
            intervals.push(setInterval(() => {
                if (Math.random() < 0.35) scheduleDrip();
            }, 4000 + Math.random() * 4000));

            console.log('[Home] Kitchen ambience started');
        } catch (e) {
            console.warn('[Home] Ambience failed:', e);
        }
    },

    onEnter: function (game) {
        // Remove any existing NPC characters from previous scenes
        const charactersContainer = document.getElementById('scene-characters');
        if (charactersContainer) {
            const npcCharacters = charactersContainer.querySelectorAll('.npc-character');
            npcCharacters.forEach(npc => npc.remove());
        }

        // ── Night-time auto-sleep ─────────────────────────────────────────
        // If Ryan arrives home at 22:00 or later (or at midnight) and hasn't
        // already slept tonight, send him straight to the bedroom.
        const _homeHour = (game.gameState && game.gameState.time)
            ? parseInt(game.gameState.time.split(':')[0], 10)
            : -1;
        const _homeDayKey = 'slept_day_' + ((game.gameState && game.gameState.day) || 1);
        if ((_homeHour >= 22 || _homeHour === 0 || _homeHour === 1)
            && !game.getFlag(_homeDayKey)) {
            document.getElementById('scene-background').className = 'scene-home';
            setTimeout(() => {
                game.startDialogue([
                    { speaker: 'Ryan', text: 'Long day. Time for some sleep.' }
                ], () => game.loadScene('bedroom'));
            }, 500);
            return;
        }
        // ─────────────────────────────────────────────────────────────────

        // First time entering the game
        if (!game.getFlag('game_started')) {
            game.setFlag('game_started', true);
            game.showNotification('Selamat datang di CyberGuard');

            setTimeout(() => {
                game.startDialogue([
                    { speaker: 'Cygu', text: 'Halo, semuanya, Perkenalkan aku Cygu..' },
                    { speaker: 'Cygu', text: 'Disini aku sebagai asisten kamu selama simulasi, Aku akan memandu kamu.' },
                    { speaker: 'Cygu', text: 'Sentuh tombol What To Do dibagian atas untuk mengetahui apa yang harus kamu lakukan.' },
                ]);
            }, 1000);
            game.addQuest({
                id: 'tonton_edukasi_phishing',
                name: 'Tonton Animasi Edukasi Phishing',
                description: 'Tonton animasi edukasi phishing terlebih dahulu sebelum kamu memulai untuk simulasi.',
                hint: 'Tonton Animasi Edukasi Phishing melalui TV di Ruang Tamu.'
            });
        } else if (game.getFlag('documentary_completed_once') && !game.getFlag('post_documentary_reminder_shown')) {
            game.setFlag('post_documentary_reminder_shown', true);
            setTimeout(() => {
                game.startDialogue([
                    { speaker: 'Cygu', text: 'Sekarang Kamu telah memahami bagaimana Spear Phishing bekerja.' },
                    { speaker: 'Cygu', text: 'Saatnya menerapkan pengetahuan tersebut.' },
                    { speaker: 'Cygu', text: 'Temukan setiap tanda bahaya dan jangan biarkan ancaman lolos dari pengamatanmu.' },
                    { speaker: 'Cygu', text: 'Sekarang kamu dapat pergi ke Ruang Simulasi.' }
                ]);
            }, 500);
            game.completeQuest('tonton_edukasi_phishing');
        } else if (game.getFlag('email_phishing_sim', true) && game.getFlag('email_socmed_sim', true) && game.getFlag('email_fakelogin_sim', true)) {
            setTimeout(() => {
                game.startDialogue([
                    { speaker: 'Cygu', text: 'Selamat, kamu telah menyelesaikan semua simulasi! Semoga dapat diterapkan dikehidupan nyata ya...' },
                    { speaker: 'Cygu', text: 'Oh iya... Kamu juga dapat mengulangi kembali simulasinya berkali-kali kok!' },
                ]);
            }, 1000);
            game.setFlag('email_phishing_sim', false);
            game.setFlag('email_socmed_sim', false);
            game.setFlag('email_fakelogin_sim', false);
        } else {
            return
        }

        // Guide player after returning from klooster with USB
        if (game.hasItem('usb_stick') && !game.getFlag('usb_analyzed')) {
            setTimeout(() => {
                game.startDialogue([
                    { speaker: 'Ryan', text: 'Home. Time to check that USB stick.' },
                    { speaker: 'Ryan', text: 'The air-gapped laptop in the mancave. No network, no risk.' }
                ]);
                setTimeout(() => {
                    game.showNotification('Head to the mancave — use the air-gapped laptop');
                }, 2000);
            }, 800);
        }

        // Update scene background with CSS class
        document.getElementById('scene-background').className = 'scene-home';

        // Start ambient kitchen sounds
        HomeScene._startKitchenAmbience();
    },

    onExit: function () {
        // Remove any NPC characters when leaving home scene
        const charactersContainer = document.getElementById('scene-characters');
        if (charactersContainer) {
            const npcCharacters = charactersContainer.querySelectorAll('.npc-character');
            npcCharacters.forEach(npc => npc.remove());
        }
        // Stop all kitchen audio
        // HomeScene._stopKitchenAudio();
    },

    /* ═══════════════════════════════════════════════════
     *  CHANNEL PICKER — TV remote overlay
     * ═══════════════════════════════════════════════════ */
    _showChannelPicker(game) {
        // Remove any existing picker
        const existing = document.getElementById('channel-picker-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'channel-picker-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9000',
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Courier New', monospace"
        });

        const channels = [
            { id: 'materiedukasi', label: 'Video Edukasi Phishing', desc: 'Phishing, Spear phishing', icon: '🎬' },
            // { id: 'materikedua', label: 'Video Edukasi 2', desc: 'Video Edukasi 2', icon: '🎬' }
        ];

        const card = document.createElement('div');
        Object.assign(card.style, {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '2px solid #0f3460', borderRadius: '12px',
            padding: '28px 32px', minWidth: '340px', maxWidth: '440px',
            boxShadow: '0 0 40px rgba(15,52,96,0.6)'
        });

        const title = document.createElement('div');
        title.textContent = 'Pilih Topik Materi';
        Object.assign(title.style, {
            color: '#e0e0e0', fontSize: '15px', fontWeight: 'bold',
            textAlign: 'center', marginBottom: '18px', letterSpacing: '2px'
        });
        card.appendChild(title);

        channels.forEach(ch => {
            const btn = document.createElement('button');
            btn.innerHTML = `<span style="font-size:22px;margin-right:10px">${ch.icon}</span>
                             <span><strong style="color:#e0e0e0">${ch.label}</strong>
                             <br><small style="color:#8899aa">${ch.desc}</small></span>`;
            Object.assign(btn.style, {
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '12px 16px', marginBottom: '10px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.2s, border-color 0.2s'
            });
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(15,52,96,0.6)';
                btn.style.borderColor = '#4a9eff';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255,255,255,0.06)';
                btn.style.borderColor = 'rgba(255,255,255,0.12)';
            });
            btn.addEventListener('click', () => {
                overlay.remove();
                game.loadScene(ch.id);
            });
            card.appendChild(btn);
        });

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Materi lainnya sedang dalam tahap pengembangan.';
        Object.assign(subtitle.style, {
            color: '#e0e0e0', fontSize: '12px', fontWeight: 'bold',
            textAlign: 'center', marginBottom: '5px'
        });
        card.appendChild(subtitle);

        // Cancel / back button
        const cancel = document.createElement('button');
        cancel.textContent = 'Kembali';
        Object.assign(cancel.style, {
            display: 'block', margin: '14px auto 0', padding: '6px 18px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px', color: '#8899aa', cursor: 'pointer',
            fontSize: '12px', fontFamily: 'inherit',
            transition: 'color 0.2s'
        });
        cancel.addEventListener('mouseenter', () => { cancel.style.color = '#e0e0e0'; });
        cancel.addEventListener('mouseleave', () => { cancel.style.color = '#8899aa'; });
        cancel.addEventListener('click', () => overlay.remove());
        card.appendChild(cancel);

        overlay.appendChild(card);

        // Close on overlay click (outside card)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.body.appendChild(overlay);
    },


};

// Register scene when loaded
if (window.game) {
    window.game.registerScene('home', HomeScene);
}

// Export for module systems
if (typeof module !== 'undefined') {
    module.exports = HomeScene;
}
