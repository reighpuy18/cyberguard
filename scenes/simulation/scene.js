const SimulationScene = {
  id: 'simulation',
  name: 'Simulation Center',
  background: 'assets/images/scenes/simulation.png',
  playerStart: { x: 48, y: 90 },
  accessibilityPath: [],
  accessibilityLooping: true,
  idleThoughts: [
    "Need more coffee...",
    "Check the signal analyzer.",
    "Should update my dead man's switch.",
    "Flipper Zero firmware needs updating.",
    "The SSTV terminal is humming.",
    "When did I last sleep?",
    "Drenthe: land of radio silence. Perfect for listening.",
    "Wonder what's on 243 MHz today."
  ],

  hotspots: [
    {
      id: 'email-phishing',
      name: 'Mulai Simulasi Email Phishing',
      // SVG: frame x=55 y=407 w=180 h=374
      x: 26.7,
      y: 29.2,
      width: 13.9,
      height: 41,
      cursor: 'pointer',
      action: function (game) {
        game.loadScene('email_phishing_sim');
      }
    },
    {
      id: 'socmed-phishing',
      name: 'Mulai Simulasi Social Media Phishing',
      // SVG: frame x=55 y=407 w=180 h=374
      x: 42.3,
      y: 29.3,
      width: 13.9,
      height: 41,
      cursor: 'pointer',
      action: function (game) {
        game.loadScene('socmed_phishing_sim');
      }
    },
    {
      id: 'fakelogin-phishing',
      name: 'Mulai Simulasi Fake Login Phishing',
      // SVG: frame x=55 y=407 w=180 h=374
      x: 57.9,
      y: 29.2,
      width: 13.9,
      height: 41,
      cursor: 'pointer',
      action: function (game) {
        game.loadScene('fakelogin_phishing_sim');
      }
    },
    {
      id: 'back-to-home',
      name: 'Kembali ke Ruang Tamu',
      // SVG: frame x=55 y=407 w=180 h=374
      x: 80.2,
      y: 16,
      width: 17,
      height: 60,
      cursor: 'pointer',
      action: function (game) {
        game.loadScene('home');
      }
    },
  ],

  /* ══════════════════════════════════════════════════════════
     ON ENTER — Welcome + random incoming calls (cinematic)
     ══════════════════════════════════════════════════════════ */

  // ── Ambient Audio ───────────────────────────────────────────
  _audioCtx: null, _audioNodes: [], _audioIntervals: [],
  _getAudioCtx: function () {
    if (!this._audioCtx) {
      try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
    return this._audioCtx;
  },
  _stopAmbientAudio: function () {
    this._audioIntervals.forEach(function (id) { clearInterval(id); });
    this._audioIntervals = [];
    this._audioNodes.forEach(function (n) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { } });
    this._audioNodes = [];
    if (this._audioCtx) { try { this._audioCtx.close(); } catch (e) { } this._audioCtx = null; }
  },
  _startAmbientAudio: function (game) {
    var self = this, ctx = this._getAudioCtx();
    if (!ctx) return;
    try {
      // ── story stage detection ──────────────────────────────────────────
      // 0: first visit / just arrived
      // 1: email checked, SSTV terminal active
      // 2: first transmission received, tuning HackRF / decoding SSTV
      // 3: klooster unlocked — mystery deepens, tension rises
      // 5: Volkov investigated, Eva identified — full alert / pre-mission
      // 6: mission prep complete — final quiet before departure
      var g = game || {};
      var stage = 0;
      if (g.getFlag) {
        if (g.getFlag('mission_prep_complete')) stage = 6;
        else if (g.getFlag('identified_eva')) stage = 5;
        else if (g.getFlag('klooster_unlocked')) stage = 3;
        else if (g.getFlag('sstv_transmission_received')) stage = 2;
        else if (g.getFlag('checked_email')) stage = 1;
      }

      // ── master bus — volume escalates with tension ─────────────────────
      var masterVols = [0.28, 0.30, 0.34, 0.40, 0.44, 0.48, 0.22];
      var master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(masterVols[stage], ctx.currentTime + 6);
      master.connect(ctx.destination);
      self._audioNodes.push(master);

      // ── LAYER 1: server fan drone (always present) ────────────────────
      var fanBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var fd = fanBuf.getChannelData(0);
      for (var i = 0; i < fd.length; i++) fd[i] = Math.random() * 2 - 1;
      var fan = ctx.createBufferSource(); fan.buffer = fanBuf; fan.loop = true;
      var fanLp = ctx.createBiquadFilter(); fanLp.type = 'lowpass'; fanLp.frequency.value = 380;
      var fanG = ctx.createGain(); fanG.gain.value = 0.018 + stage * 0.002;
      fan.connect(fanLp); fanLp.connect(fanG); fanG.connect(master); fan.start();
      self._audioNodes.push(fan, fanLp, fanG);

      // ── LAYER 2: 60 Hz power hum (scales with stage) ─────────────────
      var hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 60;
      var humG = ctx.createGain(); humG.gain.value = 0.004 + stage * 0.0015;
      hum.connect(humG); humG.connect(master); hum.start();
      self._audioNodes.push(hum, humG);

      // ── LAYER 3: radio static (unlocks at stage >= 1, pitch up with tension) ──
      if (stage >= 1) {
        var sBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var sd = sBuf.getChannelData(0);
        for (var j = 0; j < sd.length; j++) sd[j] = Math.random() * 2 - 1;
        var stat = ctx.createBufferSource(); stat.buffer = sBuf; stat.loop = true;
        var sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass';
        sbp.frequency.value = 1400 + stage * 200; // sweeps up with tension
        sbp.Q.value = 0.4;
        var sG = ctx.createGain(); sG.gain.value = 0.005 + stage * 0.002;
        stat.connect(sbp); sbp.connect(sG); sG.connect(master); stat.start();
        self._audioNodes.push(stat, sbp, sG);
      }

      // ── LAYER 4: SSTV data bursts (stage 2-4: SSTV terminal active) ──
      if (stage >= 2 && stage <= 4) {
        function burstTick() {
          if (!self._audioCtx) return;
          var t = ctx.currentTime;
          var notes = [1050, 1200, 1500, 2300]; // classic SSTV tones
          var note = notes[Math.floor(Math.random() * notes.length)];
          var osc = ctx.createOscillator(); osc.type = 'sine';
          osc.frequency.setValueAtTime(note, t);
          var env = ctx.createGain();
          env.gain.setValueAtTime(0.012, t);
          env.gain.linearRampToValueAtTime(0, t + 0.04);
          osc.connect(env); env.connect(master);
          osc.start(t); osc.stop(t + 0.045);
          self._audioNodes.push(osc, env);
          self._audioIntervals.push(setTimeout(burstTick, 400 + Math.random() * 900));
        }
        self._audioIntervals.push(setTimeout(burstTick, 2000 + Math.random() * 1500));
      }

      // ── LAYER 5: heartbeat-like sub pulse (stage 3-5: high tension) ──
      if (stage >= 3 && stage <= 5) {
        var pulse = ctx.createOscillator(); pulse.type = 'sine';
        pulse.frequency.value = 42 + (stage - 3) * 4; // gets slightly higher with tension
        var pulseLFO = ctx.createOscillator(); pulseLFO.type = 'sine';
        pulseLFO.frequency.value = 0.9 + (stage - 3) * 0.2; // beats faster at higher stages
        var pulseLFOG = ctx.createGain(); pulseLFOG.gain.value = 0.010;
        pulseLFO.connect(pulseLFOG); pulseLFOG.connect(pulse.frequency);
        var pulseG = ctx.createGain(); pulseG.gain.value = 0.014 + (stage - 3) * 0.005;
        pulse.connect(pulseG); pulseG.connect(master);
        pulse.start(); pulseLFO.start();
        self._audioNodes.push(pulse, pulseLFO, pulseLFOG, pulseG);
      }

      // ── LAYER 6: urgent interference crackles (stage 4-5: Volkov/Eva) ──
      if (stage >= 4) {
        function crackle() {
          if (!self._audioCtx) return;
          var t = ctx.currentTime;
          var nb = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.035), ctx.sampleRate);
          var nd = nb.getChannelData(0);
          for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
          var ns = ctx.createBufferSource(); ns.buffer = nb;
          var cbp = ctx.createBiquadFilter(); cbp.type = 'bandpass';
          cbp.frequency.value = 1800 + Math.random() * 2000; cbp.Q.value = 1.5;
          var cenv = ctx.createGain();
          cenv.gain.setValueAtTime(0.016 + Math.random() * 0.012, t);
          cenv.gain.linearRampToValueAtTime(0, t + 0.035);
          ns.connect(cbp); cbp.connect(cenv); cenv.connect(master);
          ns.start(t); ns.stop(t + 0.04);
          self._audioNodes.push(ns, cbp, cenv);
          self._audioIntervals.push(setTimeout(crackle, 2500 + Math.random() * 6000));
        }
        self._audioIntervals.push(setTimeout(crackle, 3000 + Math.random() * 2000));
      }

      // ── LAYER 7: stage 6 — very soft wind (calm before the storm) ────
      if (stage === 6) {
        var wBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        var wd = wBuf.getChannelData(0);
        for (var w = 0; w < wd.length; w++) wd[w] = Math.random() * 2 - 1;
        var wind = ctx.createBufferSource(); wind.buffer = wBuf; wind.loop = true;
        var wlp1 = ctx.createBiquadFilter(); wlp1.type = 'lowpass'; wlp1.frequency.value = 280;
        var whp = ctx.createBiquadFilter(); whp.type = 'highpass'; whp.frequency.value = 60;
        var wG = ctx.createGain(); wG.gain.value = 0.018;
        wind.connect(wlp1); wlp1.connect(whp); whp.connect(wG); wG.connect(master);
        wind.start();
        self._audioNodes.push(wind, wlp1, whp, wG);
      }

    } catch (e) { }
  },

  onEnter: function (game) {
    SimulationScene._startAmbientAudio(game);

    game.addQuest({
      id: 'lakukan_simulasi_email_phishing',
      name: 'Mulai Simulasi Email Phishing',
      description: 'Identifikasi bagian mencurigakan pada email phishing seperti alamat email palsu, tautan manipulative, typo domain, dan lampiran berbahaya.',
      hint: 'Mulai simulasi email phishing melalui menu yang tersedia.'
    });
    game.addQuest({
      id: 'lakukan_simulasi_medsos_phishing',
      name: 'Mulai Simulasi Media Sosial Phishing',
      description: 'Kenali tanda-tanda akun mencurigakan.',
      hint: 'Mulai simulasi email phishing melalui menu yang tersedia.'
    });
    game.addQuest({
      id: 'lakukan_simulasi_fakelogin_phishing',
      name: 'Mulai Simulasi Fake Login Phishing',
      description: 'Bedakan website asli, website phishing, dan domain palsu.',
      hint: 'Mulai simulasi fake login phishing melalui menu yang tersedia.'
    });

    if (game.getFlag('email_phishing_sim', true) && game.getFlag('email_socmed_sim', true) && game.getFlag('email_fakelogin_sim', true)) {
      setTimeout(() => {
        game.startDialogue([
          { speaker: 'Cygu', text: 'Selamat, kamu telah menyelesaikan semua simulasi! Semoga dapat diterapkan dikehidupan nyata ya...' },
          { speaker: 'Cygu', text: 'Oh iya... Kamu juga dapat mengulangi kembali simulasinya berkali-kali kok!' },
        ]);
      }, 1000);
      game.setFlag('email_phishing_sim', false);
      game.setFlag('email_socmed_sim', false);
      game.setFlag('email_fakelogin_sim', false);
    }

    // document.getElementById('scene-background').className = 'scene-simulation';

    // if (!game.getFlag('visited_simulation')) {
    //   game.setFlag('visited_simulation', true);
    //   game.startDialogue([
    //     { speaker: 'Cygu', text: 'Ruang kerja adalah segalanya.' },
    //     { speaker: 'Cygu', text: 'Cek email dan mulai bekerja.' }
    //   ]);
    // }

  },

  onExit: function () {
    SimulationScene._stopAmbientAudio();
  }
};

// Register scene when loaded
if (window.game) {
  window.game.registerScene('simulation', SimulationScene);
}

if (typeof module !== 'undefined') {
  module.exports = SimulationScene;
}
