const EmailPhishingSimulation = {
  id: 'email_phishing_sim',
  name: 'Email Phishing Simulation',
  background: 'assets/images/scenes/simulation.png',
  playerStart: { x: 50, y: 50 },

  emails: [
    {
      id: 'email1',
      from: 'support@bank-official.com',
      subject: 'Verifikasi Akun Keamanan Mendesak',
      preview: 'Akun Anda telah terdeteksi aktivitas mencurigakan...',
      isPhishing: true,
      details: {
        body: 'Klik di sini untuk verifikasi akun Anda segera!',
        redFlags: [
          'Domain palsu: bank-official.com (bukan domain bank asli)',
          'Urgensi buatan: "Mendesak" untuk membuat pengguna panik',
          'Link mencurigakan tanpa SSL certificate'
        ]
      }
    },
    {
      id: 'email2',
      from: 'hr@company.com',
      subject: 'Gajian Bulan Ini Sudah Ditransfer',
      preview: 'Gajian Anda telah berhasil diproses...',
      isPhishing: false,
      details: {
        body: 'Silakan cek rekening bank Anda. Laporan gaji terlampir.',
        redFlags: [
          'Domain resmi: company.com',
          'Konten relevan dengan pekerjaan',
          'Tone profesional dan normal'
        ]
      }
    },
    {
      id: 'email3',
      from: 'noreply@paypal-secure.com',
      subject: 'Aktivitas Akun PayPal Membutuhkan Konfirmasi',
      preview: 'Kami mendeteksi login dari perangkat baru...',
      isPhishing: true,
      details: {
        body: 'Perbarui data pembayaran Anda: [LINK MENCURIGAKAN]',
        redFlags: [
          'Domain phishing: paypal-secure.com (bukan paypal.com)',
          'Meminta data sensitif melalui email',
          'Sertifikat SSL palsu'
        ]
      }
    },
    {
      id: 'email4',
      from: 'newsletter@techblog.id',
      subject: 'Newsletter Minggu Ini: Tips Keamanan Cyber',
      preview: 'Pelajari cara melindungi diri dari phishing...',
      isPhishing: false,
      details: {
        body: 'Artikel baru tentang phishing awareness telah tersedia.',
        redFlags: [
          'Domain terverifikasi: techblog.id',
          'Konten edukatif yang diharapkan',
          'Tidak meminta data pribadi'
        ]
      }
    }
  ],

  currentState: 'selection',
  selectedAnswers: [],
  maxEmails: 4,

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

    if (!game.getFlag('email_phishing_sim')) {
      game.setFlag('email_phishing_sim', true);
    }
    this.selectedAnswers = [];
    this.currentState = 'selection';

    // Delay rendering overlay until dialogue is shown
    setTimeout(() => {
      this.renderSimulation(game);
    }, 5000);

    game.startDialogue([
      // { speaker: 'Cygu', text: 'Sekarang kita latih pengenalan phishing email.' },
      // { speaker: 'Cygu', text: 'Klik pada setiap email dan tentukan mana yang phishing dan mana yang aman.' },
      { speaker: 'Cygu', text: 'Pastikan untuk membaca detail email dengan cermat!' }
    ]);
  },

  renderSimulation: function (game) {
    const container = document.getElementById('simulation-overlay') || this.createSimulationOverlay(game);
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Identifikasi Email Phishing vs Aman';
    container.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'sim-subtitle';
    subtitle.textContent = 'Klik pada setiap email dan tentukan mana yang phishing dan mana yang aman.';
    container.appendChild(subtitle);

    const emailsContainer = document.createElement('div');
    emailsContainer.className = 'emails-container';

    this.emails.forEach((email, index) => {
      const emailCard = document.createElement('div');
      emailCard.className = 'email-card email-item';
      emailCard.innerHTML = `
        <div class="email-from">${email.from}</div>
        <div class="email-subject">${email.subject}</div>
        <div class="email-preview">${email.preview}</div>
        <div class="email-actions">
          <button class="btn-phishing" data-email-id="${email.id}">⚠️ Phishing</button>
          <button class="btn-safe" data-email-id="${email.id}">✓ Aman</button>
        </div>
      `;

      emailCard.querySelector('.btn-phishing').addEventListener('click', () => {
        this.recordAnswer(email.id, true, game);
      });

      emailCard.querySelector('.btn-safe').addEventListener('click', () => {
        this.recordAnswer(email.id, false, game);
      });

      emailsContainer.appendChild(emailCard);
    });

    container.appendChild(emailsContainer);
  },

  recordAnswer: function (emailId, isPhishing, game) {
    const email = this.emails.find(e => e.id === emailId);
    const isCorrect = email.isPhishing === isPhishing;

    this.selectedAnswers.push({
      emailId: emailId,
      userAnswer: isPhishing,
      correct: isCorrect,
      email: email
    });

    const emailCard = document.querySelector(`[data-email-id="${emailId}"]`).closest('.email-item');
    emailCard.classList.add('answered');

    if (this.selectedAnswers.length === this.maxEmails) {
      this.showResults(game);
    }
  },

  showResults: function (game) {
    const container = document.getElementById('simulation-overlay');
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Hasil Simulasi Email Phishing';
    container.appendChild(title);

    const score = this.selectedAnswers.filter(a => a.correct).length;
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score-section';
    scoreDiv.innerHTML = `
      <div class="score-text">Skor Anda: ${score}/${this.maxEmails}</div>
      <div class="score-percentage">${Math.round(score / this.maxEmails * 100)}%</div>
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
        <div class="result-email">
          <strong>Dari:</strong> ${answer.email.from}<br>
          <strong>Subjek:</strong> ${answer.email.subject}
        </div>
        <div class="result-analysis">
          <strong>Analisis:</strong>
          <div class="red-flags">
            ${answer.email.details.redFlags.map(flag => `<li>• ${flag}</li>`).join('')}
          </div>
          <strong>Status yang benar:</strong> 
          <span class="true-status">${answer.email.isPhishing ? '⚠️ Phishing' : '✓ Aman'}</span>
        </div>
      `;
      resultsContainer.appendChild(resultCard);
    });

    container.appendChild(resultsContainer);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.innerHTML = `
      <button id="retry-email-sim" class="btn-primary">Coba Lagi</button>
      <button id="back-to-sim" class="btn-secondary">Kembali ke Ruang Simulasi</button>
    `;
    container.appendChild(buttonContainer);

    document.getElementById('retry-email-sim').addEventListener('click', () => {
      this.onEnter(game);
    });

    document.getElementById('back-to-sim').addEventListener('click', () => {
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
    game.completeQuest('lakukan_simulasi_email_phishing');
    const overlay = document.getElementById('simulation-overlay');
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      overlay.remove();  // ← Hapus sepenuhnya!
    }
  }
};

if (window.game) {
  window.game.registerScene('email_phishing_sim', EmailPhishingSimulation);
}

if (typeof module !== 'undefined') {
  module.exports = EmailPhishingSimulation;
}
