/**
 * Phishing Simulation Scene Loader
 * Loads all phishing simulation scenes into the game
 */

// Import all simulation scenes
const simulationScenes = [
  'email_phishing_sim',
  'socmed_phishing_sim',
  'fakelogin_phishing_sim'
];

/**
 * Initialize all phishing simulations
 * Call this after game initialization
 */
function initializePhishingSimulations(game) {
  if (!game) {
    console.error('Game object not provided to initializePhishingSimulations');
    return;
  }

  // Ensure simulation CSS is loaded
  ensureSimulationCSSLoaded();

  console.log('✓ Phishing simulations initialized');
}

/**
 * Ensure simulation CSS is loaded
 */
function ensureSimulationCSSLoaded() {
  const cssId = 'phishing-simulation-styles';
  if (document.getElementById(cssId)) return;

  const link = document.createElement('link');
  link.id = cssId;
  link.rel = 'stylesheet';
  link.href = 'engine/simulation.css';
  document.head.appendChild(link);
}

/**
 * Get all simulation scenes info
 */
function getSimulationScenesInfo() {
  return [
    {
      id: 'email_phishing_sim',
      name: 'Email Phishing Simulation',
      description: 'Identify phishing vs legitimate emails',
      difficulty: 'Easy',
      duration: '5-10 minutes',
      icon: '📧'
    },
    {
      id: 'socmed_phishing_sim',
      name: 'Social Media Phishing',
      description: 'Identify phishing posts on social media',
      difficulty: 'Medium',
      duration: '5-10 minutes',
      icon: '📱'
    },
    {
      id: 'fakelogin_phishing_sim',
      name: 'Fake Login Detection',
      description: 'Identify fake vs legitimate login pages',
      difficulty: 'Hard',
      duration: '8-12 minutes',
      icon: '🔐'
    }
  ];
}

/**
 * Launch specific simulation
 */
function launchSimulation(game, simulationId) {
  if (!game) {
    console.error('Game object required');
    return false;
  }

  const validIds = ['email_phishing_sim', 'socmed_phishing_sim', 'fakelogin_phishing_sim'];
  if (!validIds.includes(simulationId)) {
    console.error(`Invalid simulation ID: ${simulationId}`);
    return false;
  }

  game.loadScene(simulationId);
  return true;
}

// Export for use in game
if (typeof window !== 'undefined') {
  window.initializePhishingSimulations = initializePhishingSimulations;
  window.getSimulationScenesInfo = getSimulationScenesInfo;
  window.launchSimulation = launchSimulation;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializePhishingSimulations,
    getSimulationScenesInfo,
    launchSimulation,
    simulationScenes
  };
}
