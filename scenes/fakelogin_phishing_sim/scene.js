const FakeLoginPhishingSimulation = {
  id: 'fakelogin_phishing_sim',
  name: 'Fake Login Phishing Simulation',
  background: 'assets/images/scenes/simulation.png',
  playerStart: { x: 50, y: 50 },

  loginPages: [
    {
      id: 'login1',
      serviceName: 'Google Login',
      url: 'accounts.google.com',
      screenshot: '🔷 Google',
      isPhishing: false,
      details: {
        indicators: [
          '✓ Domain resmi: accounts.google.com',
          '✓ Logo Google official',
          '✓ URL dengan HTTPS dan sertifikat valid',
          '✓ Design sesuai standar Google official'
        ]
      }
    },
    {
      id: 'login2',
      serviceName: 'Facebook Login',
      url: 'facebook-secure-login.xyz',
      screenshot: '📘 Facebook',
      isPhishing: true,
      details: {
        indicators: [
          '✗ Domain mencurigakan: facebook-secure-login.xyz',
          '✗ .xyz adalah TLD yang sering digunakan scammer',
          '✗ Format URL aneh dan bukan domain resmi Facebook',
          '✗ Warna dan design mirip tapi ada detail yang berbeda'
        ]
      }
    },
    {
      id: 'login3',
      serviceName: 'Instagram Login',
      url: 'instagram.com',
      screenshot: '📷 Instagram',
      isPhishing: false,
      details: {
        indicators: [
          '✓ Domain resmi: instagram.com',
          '✓ HTTPS dengan sertifikat yang valid',
          '✓ Design dan logo sesuai standar Instagram',
          '✓ URL lengkap tanpa karakter mencurigakan'
        ]
      }
    },
    {
      id: 'login4',
      serviceName: 'Amazon Login',
      url: 'amazn-secure-login.com',
      screenshot: '🛍️ Amazon',
      isPhishing: true,
      details: {
        indicators: [
          '✗ Domain typosquatting: amazn-secure-login.com (seharusnya amazon.com)',
          '✗ Menambahkan kata "secure-login" untuk terlihat resmi',
          '✗ Domain mirip tapi berbeda satu huruf',
          '✗ Taktik phishing klasik menggunakan typo domain'
        ]
      }
    },
    {
      id: 'login5',
      serviceName: 'PayPal Login',
      url: 'paypal-account-verify.net',
      screenshot: '💳 PayPal',
      isPhishing: true,
      details: {
        indicators: [
          '✗ Domain palsu: paypal-account-verify.net',
          '✗ Menggunakan .net bukan domain resmi PayPal (.com)',
          '✗ Menambahkan "account-verify" untuk terlihat urgent',
          '✗ URL dirancang untuk membuat korban merasa perlu verifikasi'
        ]
      }
    },
    {
      id: 'login6',
      serviceName: 'GitHub Login',
      url: 'github.com',
      screenshot: '💻 GitHub',
      isPhishing: false,
      details: {
        indicators: [
          '✓ Domain resmi GitHub: github.com',
          '✓ HTTPS dengan sertifikat valid',
          '✓ Branding resmi dan design konsisten',
          '✓ Tidak ada taktik urgency atau penawaran mencurigakan'
        ]
      }
    }
  ],

  currentState: 'selection',
  selectedAnswers: [],
  maxLogins: 6,

  hotspots: [
    {
      id: 'back-button',
      name: 'Kembali ke Ruang Simulasi',
      x: 5,
      y: 5,
      width: 8,
      height: 5,
      cursor: 'pointer',
      action: function (game) {
        game.loadScene('simulation');
      }
    }
  ],

  onEnter: function (game) {
    if (!game.getFlag('email_fakelogin_sim')) {
      game.setFlag('email_fakelogin_sim', true);
    }
    this.selectedAnswers = [];
    this.currentState = 'selection';

    // Delay rendering overlay until dialogue is shown
    setTimeout(() => {
      this.renderSimulation(game);
    }, 5000);

    game.startDialogue([
      // { speaker: 'Cygu', text: 'Sekarang simulasi terakhir: mengenali halaman login palsu.' },
      // { speaker: 'Cygu', text: 'Periksa setiap URL dengan hati-hati. Typosquatting sangat umum!' },
      { speaker: 'Cygu', text: 'Perhatikan domain, sertifikat, dan desain halaman login.' }
    ]);
  },

  renderSimulation: function (game) {
    const container = document.getElementById('simulation-overlay') || this.createSimulationOverlay(game);
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Identifikasi Halaman Login Palsu vs Asli';
    container.appendChild(title);

    const loginsContainer = document.createElement('div');
    loginsContainer.className = 'logins-container';

    this.loginPages.forEach((login) => {
      const loginCard = document.createElement('div');
      loginCard.className = 'login-card login-item';
      loginCard.innerHTML = `
        <div class="login-preview">
          <div class="login-icon">${login.screenshot}</div>
          <div class="login-url-display">URL: ${login.url}</div>
        </div>
        <div class="login-service">${login.serviceName}</div>
        <div class="login-actions">
          <button class="btn-phishing" data-login-id="${login.id}">⚠️ Phishing</button>
          <button class="btn-safe" data-login-id="${login.id}">✓ Asli</button>
        </div>
      `;

      loginCard.querySelector('.btn-phishing').addEventListener('click', () => {
        this.recordAnswer(login.id, true, game);
      });

      loginCard.querySelector('.btn-safe').addEventListener('click', () => {
        this.recordAnswer(login.id, false, game);
      });

      loginsContainer.appendChild(loginCard);
    });

    container.appendChild(loginsContainer);
  },

  recordAnswer: function (loginId, isPhishing, game) {
    const login = this.loginPages.find(l => l.id === loginId);
    const isCorrect = login.isPhishing === isPhishing;

    this.selectedAnswers.push({
      loginId: loginId,
      userAnswer: isPhishing,
      correct: isCorrect,
      login: login
    });

    const loginCard = document.querySelector(`[data-login-id="${loginId}"]`).closest('.login-item');
    loginCard.classList.add('answered');

    if (this.selectedAnswers.length === this.maxLogins) {
      this.showResults(game);
    }
  },

  showResults: function (game) {
    const container = document.getElementById('simulation-overlay');
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Hasil Simulasi Fake Login Phishing';
    container.appendChild(title);

    const score = this.selectedAnswers.filter(a => a.correct).length;
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score-section';
    scoreDiv.innerHTML = `
      <div class="score-text">Skor Kamu: ${score}/${this.maxLogins}</div>
      <div class="score-percentage">${Math.round(score / this.maxLogins * 100)}%</div>
    `;
    container.appendChild(scoreDiv);

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-container';

    this.selectedAnswers.forEach(answer => {
      const resultCard = document.createElement('div');
      resultCard.className = `result-card ${answer.correct ? 'correct' : 'incorrect'}`;

      const icon = answer.correct ? '✓' : '✗';
      const status = answer.correct ? 'Benar' : 'Salah';

      resultCard.innerHTML = `
        <div class="result-header">
          <span class="result-icon">${icon}</span>
          <span class="result-status">${status}</span>
        </div>
        <div class="result-login">
          <strong>Layanan:</strong> ${answer.login.serviceName}<br>
          <strong>URL:</strong> <code>${answer.login.url}</code>
        </div>
        <div class="result-analysis">
          <strong>Analisis URL dan Indikator:</strong>
          <div class="red-flags">
            ${answer.login.details.indicators.map(indicator => `<li>${indicator}</li>`).join('')}
          </div>
          <strong>Status yang benar:</strong> 
          <span class="true-status">${answer.login.isPhishing ? '⚠️ Phishing/Palsu' : '✓ Asli/Resmi'}</span>
        </div>
      `;
      resultsContainer.appendChild(resultCard);
    });

    container.appendChild(resultsContainer);

    // Tips tambahan
    const tipsDiv = document.createElement('div');
    tipsDiv.className = 'tips-section';
    tipsDiv.innerHTML = `
      <strong>💡 Tips Mengidentifikasi URL Palsu:</strong>
      <ul>
        <li>Selalu periksa domain di address bar sebelum login</li>
        <li>Waspada dengan domain mirip (typosquatting): amaz0n.com, paypa1.com</li>
        <li>Domain resmi tidak pernah dimulai dengan http://, selalu https://</li>
        <li>Hati-hati dengan TLD aneh (.xyz, .tk, .ml yang sering untuk phishing)</li>
        <li>Jangan klik link di email atau chat untuk login, ketik langsung di browser</li>
      </ul>
    `;
    resultsContainer.appendChild(tipsDiv);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.innerHTML = `
      <button id="retry-login-sim" class="btn-primary">Coba Lagi</button>
      <button id="back-to-sim-3" class="btn-secondary">Kembali ke Ruang Simulasi</button>
    `;
    container.appendChild(buttonContainer);

    document.getElementById('retry-login-sim').addEventListener('click', () => {
      this.onEnter(game);
    });

    document.getElementById('back-to-sim-3').addEventListener('click', () => {
      game.loadScene('simulation');
    });
  },

  createSimulationOverlay: function (game) {
    let overlay = document.getElementById('simulation-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'simulation-overlay';
      overlay.className = 'simulation-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  },

  onExit: function () {
    game.completeQuest('lakukan_simulasi_fakelogin_phishing');
    const overlay = document.getElementById('simulation-overlay');
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      overlay.remove();  // ← Hapus sepenuhnya!
    }
  }
};

if (window.game) {
  window.game.registerScene('fakelogin_phishing_sim', FakeLoginPhishingSimulation);
}

if (typeof module !== 'undefined') {
  module.exports = FakeLoginPhishingSimulation;
}
