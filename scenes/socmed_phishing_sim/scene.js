const SocialMediaPhishingSimulation = {
  id: 'socmed_phishing_sim',
  name: 'Social Media Phishing Simulation',
  background: 'assets/images/scenes/simulation.png',
  playerStart: { x: 50, y: 50 },

  posts: [
    {
      id: 'post1',
      username: 'Bank_Official_ID',
      avatar: '🏦',
      content: 'Kemenangan undian: Anda terpilih! Klik link untuk klaim hadiah: [bit.ly/claim123]',
      likes: '15K',
      comments: '342',
      isPhishing: true,
      details: {
        redFlags: [
          'Tautan yang disingkat untuk menyembunyikan URL sebenarnya',
          'Penawaran menang undian yang tidak pernah diikuti',
          'Username mirip tapi bukan akun resmi terverifikasi',
          'Link tidak memiliki badge verifikasi resmi'
        ]
      }
    },
    {
      id: 'post2',
      username: 'Tech Indonesia',
      avatar: '📱',
      content: '5 Tips Keamanan Media Sosial yang Harus Anda Ketahui Sekarang! Baca artikel lengkap di blog kami.',
      likes: '8.2K',
      comments: '156',
      isPhishing: false,
      details: {
        redFlags: [
          'Konten edukatif dan bermanfaat',
          'Tidak meminta informasi pribadi',
          'Akun terverifikasi dengan badge resmi',
          'Engagement normal dan organik'
        ]
      }
    },
    {
      id: 'post3',
      username: 'PayPal-Secure',
      avatar: '💳',
      content: 'PENTING: Update akun sekarang di paypal-verify.net untuk keamanan maksimal!',
      likes: '2.1K',
      comments: '89',
      isPhishing: true,
      details: {
        redFlags: [
          'Domain palsu: paypal-verify.net (bukan paypal resmi)',
          'Urgensi berlebihan dengan kata "PENTING"',
          'Meminta perbaruan akun melalui tautan mencurigakan',
          'Username tanpa verifikasi resmi'
        ]
      }
    },
    {
      id: 'post4',
      username: 'Instagram Official',
      avatar: '📸',
      content: 'Fitur Stories baru sudah tersedia! Update app Anda dari app store resmi untuk menikmati fitur terbaru.',
      likes: '12.5K',
      comments: '521',
      isPhishing: false,
      details: {
        redFlags: [
          'Akun terverifikasi dengan badge resmi',
          'Menyarankan update dari sumber resmi (app store)',
          'Konten relevan dengan platform',
          'Tidak ada link mencurigakan'
        ]
      }
    }
  ],

  currentState: 'selection',
  selectedAnswers: [],
  maxPosts: 4,

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
    if (!game.getFlag('email_socmed_sim')) {
      game.setFlag('email_socmed_sim', true);
    }
    this.selectedAnswers = [];
    this.currentState = 'selection';

    // Delay rendering overlay until dialogue is shown
    setTimeout(() => {
      this.renderSimulation(game);
    }, 8000);

    game.startDialogue([
      // { speaker: 'Cygu', text: 'Sekarang saatnya belajar tentang phishing di media sosial.' },
      // { speaker: 'Cygu', text: 'Scrolling feed Anda dan identifikasi post yang mencurigakan.' },
      { speaker: 'Cygu', text: 'Perhatikan username palsu, URL mencurigakan, dan penawaran terlalu bagus untuk menjadi kenyataan.' }
    ]);
  },

  renderSimulation: function (game) {
    const container = document.getElementById('simulation-overlay') || this.createSimulationOverlay(game);
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Identifikasi Social Media Phishing';
    container.appendChild(title);

    const feedContainer = document.createElement('div');
    feedContainer.className = 'socmed-feed-container';

    this.posts.forEach((post) => {
      const postCard = document.createElement('div');
      postCard.className = 'socmed-post-item post-item';
      postCard.innerHTML = `
        <div class="post-header">
          <span class="post-avatar">${post.avatar}</span>
          <div class="post-user-info">
            <div class="post-username">${post.username}</div>
            <div class="post-timestamp">2 jam yang lalu</div>
          </div>
        </div>
        <div class="post-content">${post.content}</div>
        <div class="post-stats">
          <span>❤️ ${post.likes}</span>
          <span>💬 ${post.comments}</span>
        </div>
        <div class="post-actions">
          <button class="btn-phishing" data-post-id="${post.id}">🚨 Phishing</button>
          <button class="btn-safe" data-post-id="${post.id}">✅ Aman</button>
        </div>
      `;

      postCard.querySelector('.btn-phishing').addEventListener('click', () => {
        this.recordAnswer(post.id, true, game);
      });

      postCard.querySelector('.btn-safe').addEventListener('click', () => {
        this.recordAnswer(post.id, false, game);
      });

      feedContainer.appendChild(postCard);
    });

    container.appendChild(feedContainer);
  },

  recordAnswer: function (postId, isPhishing, game) {
    const post = this.posts.find(p => p.id === postId);
    const isCorrect = post.isPhishing === isPhishing;

    this.selectedAnswers.push({
      postId: postId,
      userAnswer: isPhishing,
      correct: isCorrect,
      post: post
    });

    const postCard = document.querySelector(`[data-post-id="${postId}"]`).closest('.post-item');
    postCard.classList.add('answered');
    postCard.style.opacity = '0.6';

    if (this.selectedAnswers.length === this.maxPosts) {
      this.showResults(game);
    }
  },

  showResults: function (game) {
    const container = document.getElementById('simulation-overlay');
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sim-title';
    title.textContent = 'Hasil Simulasi Social Media Phishing';
    container.appendChild(title);

    const score = this.selectedAnswers.filter(a => a.correct).length;
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score-section';
    scoreDiv.innerHTML = `
      <div class="score-text">Skor Anda: ${score}/${this.maxPosts}</div>
      <div class="score-percentage">${Math.round(score / this.maxPosts * 100)}%</div>
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
        <div class="result-post">
          <strong>Username:</strong> ${answer.post.username}<br>
          <strong>Konten:</strong> "${answer.post.content.substring(0, 100)}..."
        </div>
        <div class="result-analysis">
          <strong>Analisis:</strong>
          <div class="red-flags">
            ${answer.post.details.redFlags.map(flag => `<li>• ${flag}</li>`).join('')}
          </div>
          <strong>Status yang benar:</strong> 
          <span class="true-status">${answer.post.isPhishing ? '🚨 Phishing' : '✅ Aman'}</span>
        </div>
      `;
      resultsContainer.appendChild(resultCard);
    });

    container.appendChild(resultsContainer);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.innerHTML = `
      <button id="retry-socmed-sim" class="btn-primary">Coba Lagi</button>
      <button id="back-to-sim-2" class="btn-secondary">Kembali ke Ruang Simulasi</button>
    `;
    container.appendChild(buttonContainer);

    document.getElementById('retry-socmed-sim').addEventListener('click', () => {
      this.onEnter(game);
    });

    document.getElementById('back-to-sim-2').addEventListener('click', () => {
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
    game.completeQuest('lakukan_simulasi_medsos_phishing');
    const overlay = document.getElementById('simulation-overlay');
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.display = 'none';
      overlay.remove();  // ← Hapus sepenuhnya!
    }
  }
};

if (window.game) {
  window.game.registerScene('socmed_phishing_sim', SocialMediaPhishingSimulation);
}

if (typeof module !== 'undefined') {
  module.exports = SocialMediaPhishingSimulation;
}
