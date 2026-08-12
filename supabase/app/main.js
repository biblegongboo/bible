// ========================================================================
// BLOCK 0000: System Configuration / maintenance map
// 1000 Global State | 2000 Login/Auth handoff | 3000 Subject Management
// 4000 Question Loader | 5000 Quiz Engine | 6000 Review System
// 7000 Graphic Engine | 8000 Storage | 9000 Initialize / Export
// Existing fine-grained block numbers are retained to avoid rewriting v8.0B.
// ========================================================================

// Super graphics are isolated from the Legacy SAT renderer.  The router only
// activates for an explicit engine:"super" JSON payload.
import { isSuperGraphicPayload, preloadSuperGraphicEngine, renderSuperGraphicPayload } from './graphics/graphic-router.js?v=8.38-family-roles1';
import { VectorScene25D, sceneFromGraphicObjects } from './graphics/map25d/vector-scene25d.js?v=8.44-map25d-all1';
import './bible-explorer.js?v=9.11-map-place-reveal1';

// ========================================================================
// BLOCK 0000: 시스템 메타 정보
// ========================================================================
// 버전: 8.0D (Trial / Paid / Admin Auth)
// 날짜: 2026-07-12
// 설명: 표준 다국어 스키마 + 언어 전환 + 기존 그래픽/퀴즈 엔진 통합
// 표준 열: N, SUBJECT, Q_EN, Q_KO, P_EN, P_KO, 1_EN~4_KO, A, E_EN, E_KO, G, D,
//          SOURCE_TYPE, VARIANT_NO, SOURCE_ID, STATUS, CREATED_AT, UPDATED_AT
// ========================================================================

// ========================================================================
// BLOCK 0100: 로깅 시스템
// ========================================================================
const LOG = {
    level: 'debug',
    _log(level, ...args) {
        if (this.level === 'none') return;
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.indexOf(level) < levels.indexOf(this.level)) return;
        console[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}]`, ...args);
    },
    debug(...args) { this._log('debug', ...args); },
    info(...args) { this._log('info', ...args); },
    warn(...args) { this._log('warn', ...args); },
    error(...args) { this._log('error', ...args); }
};

// ========================================================================
// BLOCK 0110: LANG 객체 (원본 B001 완전 유지)
// ========================================================================
var LANG = {
  enterNumber: "Enter Starting Number",
  enterSub: "Enter the question number to begin",
  rangeInfo: "Range: 1 ~ ",
  startBtn: "▶ START",
  freshHint: "Enter a number and click START to begin a new session or click Resume above to continue where you left off",
  resumeTitle: "Resume from where you left off",
  resumeDetail: "{answered}/{total} answered · {time}",
  resumeHint: "Click to continue your previous session",
  qPrefix: "Question",
  of: "/",
  originalPrefix: "(Original #",
  originalSuffix: ")",
  prevBtn: "◀ PREV",
  skipBtn: "SKIP",
  nextBtn: "NEXT ▶",
  submitBtn: "SUBMIT",
  quitBtn: "✕ QUIT",
  reviewModePrefix: "Review Mode: ",
  reviewModeSuffix: " questions (Wrong/Skipped/Unanswered)",
  exitReview: "EXIT REVIEW",
  resultTitle: "📊 RESULT",
  correctLabel: "✅ CORRECT",
  accuracyLabel: "🎯 ACCURACY",
  resultClickLabel: "Results (Click to move)",
  retryBtn: "🔄 RETRY",
  reviewBtn: "📝 REVIEW",
  closeBtn: "✕ CLOSE",
  reviewModalTitle: "📝 REVIEW",
  reviewModalSubtitle: "Wrong / Skipped / Unanswered",
  retryWrongOnlyBtn: "🔄 RETRY WRONG ONLY",
  reviewQuestions: "Review Questions:",
  wrongCount: "Wrong:",
  skippedCount: "Skipped:",
  unansweredCount: "Unanswered:",
  questionPrefix: "Question",
  originalPrefixShort: "(Original #)",
  statusWrong: "WRONG",
  statusSkipped: "SKIPPED",
  statusUnanswered: "UNANSWERED",
  statusNotAnswered: "Status: You did not answer this question.",
  correctAnswerLabel: "Correct Answer:",
  explanationLabel: "Explanation",
  yourAnswerLabel: "(YOUR ANSWER)",
  correctAnswer: "✅ CORRECT! Answer:",
  wrongAnswer: "❌ WRONG. Answer:",
  noExplanation: "No explanation available.",
  loadError: "Failed to load questions:",
  allCorrect: "🎉 Congratulations! All correct!",
  perfectReview: "✨ Perfect! No questions to review!",
  confirmExit: "Return to main menu. Progress will not be saved.",
  reviewModeQuestionPrefix: "Review Question",
  loading: "Loading...",
  loadingQuestions: "Loading questions from ",
  rangeText: "Range: 1 ~ "
};

// ========================================================================
// BLOCK 0120: 시스템 상수 (원본 B002)
// ========================================================================
var API_URL = "https://script.google.com/macros/s/AKfycbxY57qwgS363Gfg-H1xzMJ1CKjCeB1xl51Ydw4x_fUj3I6_-g5y6y5anhHK_ioGFL7djw/exec";
var ORIGINAL_API_URL = API_URL;
// BLOCK 1000: Multi Subject Global State
var currentUser = null;
var currentSubject = '';
var subjectConfig = null;
var availableSubjects = [];
var DATA_SHEET = 'sat';
var CURRENT_SUBJECT = '';
var STORAGE_KEY = 'quiz_progress_main_v8_0C_sat';
var TOTAL_CACHE_KEY = 'quiz_total_questions_v8_0D_sat';
var IS_TRIAL_USER = false;
var IS_ADMIN_USER = false;
var TRIAL_START = 1;
var TRIAL_LIMIT = 20;
var LANGUAGE_STORAGE_KEY = 'quiz_language_v7';
var MODE_STORAGE_KEY = 'quiz_mode_v8_0B';
var BIBLE_PASSAGE_PREFS_KEY = 'bible_passage_preferences_v2';
var BIBLE_QUIZ_VISIBLE_KEY = 'bible_quiz_visible_v1';
var BIBLE_PRIMARY_TEXT_KEY = 'bible_primary_text_v2';
var BIBLE_SECONDARY_TEXT_KEY = 'bible_secondary_text_v2';
var SUPPORTED_MODES = ['learn', 'study', 'exam'];
var currentMode = (localStorage.getItem(MODE_STORAGE_KEY) || 'study').toLowerCase();
if (SUPPORTED_MODES.indexOf(currentMode) < 0) currentMode = 'study';
var learnRevealed = {};
var examFinished = false;
var biblePassagePreferences = { learn: true, study: true, exam: true };
var bibleQuizVisible = localStorage.getItem(BIBLE_QUIZ_VISIBLE_KEY) !== 'false';
try {
  var savedBiblePassagePreferences = JSON.parse(localStorage.getItem(BIBLE_PASSAGE_PREFS_KEY) || '{}');
  SUPPORTED_MODES.forEach(function(mode) {
    if (typeof savedBiblePassagePreferences[mode] === 'boolean') {
      biblePassagePreferences[mode] = savedBiblePassagePreferences[mode];
    }
  });
} catch (biblePassagePreferenceError) {
  console.warn('Bible passage preference could not be restored:', biblePassagePreferenceError);
}
var BIBLE_TEXT_OPTIONS = ['KJV', 'WEB', 'KO_WEB'];
var biblePrimaryText = String(localStorage.getItem(BIBLE_PRIMARY_TEXT_KEY) || 'WEB').toUpperCase();
if (BIBLE_TEXT_OPTIONS.indexOf(biblePrimaryText) < 0) biblePrimaryText = 'WEB';
var bibleSecondaryText = String(localStorage.getItem(BIBLE_SECONDARY_TEXT_KEY) || 'NONE').toUpperCase();
if (['NONE'].concat(BIBLE_TEXT_OPTIONS).indexOf(bibleSecondaryText) < 0) bibleSecondaryText = 'NONE';
if (bibleSecondaryText === biblePrimaryText) bibleSecondaryText = 'NONE';

var SUPPORTED_LANGUAGES = ['EN', 'KO'];
var currentLanguage = (localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'EN').toUpperCase();
if (SUPPORTED_LANGUAGES.indexOf(currentLanguage) < 0) currentLanguage = 'EN';
var QUESTIONS_PER_SET = 120;
var TOTAL_QUESTIONS = 0;
var masterQuestions = [];
var currentQuestions = [];
var userAnswers = [];
var currentIndex = 0;
var correctCount = 0;
var isReviewMode = false;
var originalQuestions = [];
var currentStartNumber = 1;
var autoSaveInterval = null;
var chartInstances = {};
var DOM = {};

// BLOCK 2000: Login/Auth validation and role policy
function normalizeRoleValue(value) {
  return String(value || '').trim().toLowerCase();
}

function hasValidCurrentUser(user) {
  return !!(user && typeof user === 'object' &&
    String(user.email || '').trim() && String(user.session_token || '').trim());
}

function isAdminUser(user) {
  return normalizeRoleValue(user && user.account_type) === 'admin';
}

function isTrialUser(user) {
  if (!user || isAdminUser(user)) return false;
  return user.is_trial === true || normalizeRoleValue(user.payment_status) === 'p';
}

function clearAuthAndRedirect(reason) {
  if (window.__bibleAuthRedirectStarted) return;
  window.__bibleAuthRedirectStarted = true;
  localStorage.removeItem('quiz_current_user_v1');
  localStorage.removeItem('quiz_available_subjects_v1');
  localStorage.removeItem('quiz_current_subject_v1');
  var rawReason = String(reason || '').replace(/[^A-Z0-9_\-]/gi, '').slice(0, 40);
  var authReason = rawReason.indexOf('AUTH_') === 0 ? 'LOGIN_REQUIRED' : rawReason;
  window.location.replace('./login.html?v=9.07-direct-bible-books1' + (authReason ? '&auth_error=' + encodeURIComponent(authReason) : ''));
}

function initBibleLogout_() {
  var logoutButton = document.getElementById('bibleLogoutToggle');
  if (!logoutButton || logoutButton.dataset.bound) return;
  logoutButton.dataset.bound = '1';
  logoutButton.addEventListener('click', function() {
    if (!window.confirm('Log out of GongBoo Bible on this device?')) return;
    if (window.BibleSupabaseAuth && typeof window.BibleSupabaseAuth.signOut === 'function') {
      window.BibleSupabaseAuth.signOut();
    }
    localStorage.removeItem('quiz_current_user_v1');
    localStorage.removeItem('quiz_available_subjects_v1');
    localStorage.removeItem('quiz_current_subject_v1');
    window.location.replace('./login.html?v=9.07-direct-bible-books1');
  });
}

function initBibleGuide_() {
  var guideButton = document.getElementById('bibleGuideToggle');
  if (!guideButton || guideButton.dataset.bound) return;
  guideButton.dataset.bound = '1';
  guideButton.addEventListener('click', function() {
    window.open(
      './guide.html?v=8.87-guide-storage1',
      '_blank',
      'noopener,noreferrer'
    );
  });
}

function initBibleGroupAdmin_() {
  var button = document.getElementById('bibleGroupAdminToggle');
  if (!button || button.dataset.bound) return;
  button.hidden = !IS_ADMIN_USER;
  button.dataset.bound = '1';
  button.addEventListener('click', function() {
    window.open('./group-admin.html?v=1', '_blank', 'noopener,noreferrer');
  });
}

function initBibleTapFeedback_() {
  var header = document.querySelector('.quiz-header');
  if (!header || header.dataset.tapFeedbackBound) return;
  header.dataset.tapFeedbackBound = '1';
  header.addEventListener('click', function(event) {
    var button = event.target.closest(
      '.quiz-tool-toggle, .mode-btn, .bible-passage-toggle, .bible-quiz-toggle, .bible-guide-toggle'
    );
    if (!button || button.disabled) return;
    button.classList.remove('bible-tap-feedback');
    // Restart the animation for every press, including two deliberate
    // consecutive presses on Play, Replay, or a mode selector.
    void button.offsetWidth;
    button.classList.add('bible-tap-feedback');
    window.setTimeout(function() {
      button.classList.remove('bible-tap-feedback');
    }, 360);
  });
}

function applyUserRolePolicy() {
  IS_ADMIN_USER = isAdminUser(currentUser);
  IS_TRIAL_USER = isTrialUser(currentUser);
  TRIAL_START = Math.max(1, parseInt(currentUser && currentUser.trial_start, 10) || 1);
  TRIAL_LIMIT = Math.max(1, parseInt(currentUser && currentUser.trial_limit, 10) || 20);
  document.documentElement.classList.toggle('admin-user', IS_ADMIN_USER);
  document.documentElement.classList.toggle('trial-user', IS_TRIAL_USER);
  ['bibleGroupAdminToggle']
    .forEach(function(id) {
      var element = document.getElementById(id);
      if (element) element.hidden = !IS_ADMIN_USER;
    });
}

function applyCopyProtectionPolicy() {
  // Keep ordinary browser behavior intact. Blocking selection/context-menu
  // prevented Chrome's translation and accessibility tools from operating.
  // Administrative screens remain role-gated separately.
  return;
}

function getSessionToken_() {
  return String(currentUser && currentUser.session_token || '').trim();
}

async function fetchQuizApi_(params, signal) {
  var token = getSessionToken_();
  if (!token) {
    clearAuthAndRedirect('TOKEN_MISSING');
    throw new Error('Please log in again.');
  }
  var body = {};
  params.forEach(function(value, key) { body[key] = value; });
  body.session_token = token;
  var response;
  if (window.BibleSupabaseProvider &&
      typeof window.BibleSupabaseProvider.request === 'function') {
    response = await window.BibleSupabaseProvider.request(body, signal);
  } else {
    response = await fetch(ORIGINAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: signal
    });
  }
  if (response && (response.status === 401 || response.status === 403)) {
    clearAuthAndRedirect('SESSION_EXPIRED');
    var authError = new Error('Your session has expired. Please log in again.');
    authError.code = 'AUTH_EXPIRED';
    throw authError;
  }
  return response;
}

function throwQuizApiError_(data, fallbackMessage) {
  var code = String(data && data.code || '');
  if (code.indexOf('AUTH_') === 0) {
    clearAuthAndRedirect(code);
  }
  var error = new Error(data && data.message ? data.message : fallbackMessage);
  error.code = code;
  throw error;
}

function isTrialProgressSafe(saved) {
  if (!IS_TRIAL_USER) return true;
  if (!saved || !Array.isArray(saved.currentQuestions)) return false;
  if ((parseInt(saved.currentStartNumber, 10) || 1) !== TRIAL_START) return false;
  if (saved.currentQuestions.length > TRIAL_LIMIT) return false;
  return saved.currentQuestions.every(function(q, index) {
    var n = parseInt(q && (q.originalNumber || q.N || q.n), 10);
    return isNaN(n) ? index < TRIAL_LIMIT : n >= TRIAL_START && n < TRIAL_START + TRIAL_LIMIT;
  });
}

// BLOCK 3000: Subject Management
function applySubjectConfig() {
  try {
    currentUser = JSON.parse(localStorage.getItem('quiz_current_user_v1') || 'null');
    availableSubjects = JSON.parse(localStorage.getItem('quiz_available_subjects_v1') || '[]');
    subjectConfig = JSON.parse(localStorage.getItem('quiz_current_subject_v1') || 'null');
    // An explicit subject query overrides an older remembered Testament.
    var requestedSubject = String(new URLSearchParams(window.location.search).get('subject') || '')
      .trim().replace(/-/g, '_').toUpperCase();
    if (requestedSubject) {
      var requestedConfig = availableSubjects.find(function(subject) {
        return String(subject && subject.CODE || '').trim().replace(/-/g, '_').toUpperCase() === requestedSubject;
      });
      if (requestedConfig) {
        subjectConfig = requestedConfig;
        localStorage.setItem('quiz_current_subject_v1', JSON.stringify(requestedConfig));
      }
    }
  } catch (e) {
    currentUser = null;
    availableSubjects = [];
    subjectConfig = null;
  }
  if (!hasValidCurrentUser(currentUser)) {
    clearAuthAndRedirect('LOGIN_DATA_MISSING');
    return false;
  }
  applyUserRolePolicy();
  applyCopyProtectionPolicy();
  if (!subjectConfig || !subjectConfig.CODE || !subjectConfig.SHEET) {
    clearAuthAndRedirect('SUBJECT_DATA_MISSING');
    return false;
  }
  currentSubject = String(subjectConfig.CODE).trim().toUpperCase();
  CURRENT_SUBJECT = currentSubject;
  DATA_SHEET = String(subjectConfig.SHEET).trim();
  var sheetAliases = {
    REAL_ESTATE: 'realestate',
    BIBLE_OT: 'bible-ot',
    'BIBLE-OT': 'bible-ot',
    BIBLE_NT: 'bible-nt',
    'BIBLE-NT': 'bible-nt'
  };
  DATA_SHEET =
    sheetAliases[currentSubject] ||
    sheetAliases[DATA_SHEET.toUpperCase()] ||
    DATA_SHEET.toLowerCase();
  QUESTIONS_PER_SET = Math.max(1, parseInt(subjectConfig.SET_SIZE, 10) || 120);
  TOTAL_QUESTIONS = Math.max(0, parseInt(subjectConfig.QUESTION_COUNT, 10) || 0);
  var keyPart = currentSubject.replace(/[^A-Z0-9_-]/g, '_');
  STORAGE_KEY = 'quiz_progress_main_v8_0D_' + keyPart;
  TOTAL_CACHE_KEY = 'quiz_total_questions_v8_0D_' + keyPart;
  window.currentUser = currentUser;
  window.currentSubject = currentSubject;
  window.subjectConfig = subjectConfig;
  window.availableSubjects = availableSubjects;
  console.log('Using subject configuration:', { code: currentSubject, sheet: DATA_SHEET, setSize: QUESTIONS_PER_SET, questionCount: TOTAL_QUESTIONS });
  return true;
}

function updateSubjectTitle(setNumber) {
  var title = document.querySelector('.sat-title');
  var englishName = currentSubject === 'BIBLE_OT'
    ? 'Old Testament'
    : (currentSubject === 'BIBLE_NT' ? 'New Testament' : String(subjectConfig.NAME || currentSubject));
  if (title) title.textContent = currentSubject === 'BIBLE_OT' || currentSubject === 'BIBLE_NT'
    ? 'Bib · ' + (currentSubject === 'BIBLE_OT' ? 'OT' : 'NT')
    : 'GongBoo · ' + englishName + (IS_TRIAL_USER ? ' · Sample' : ' · Set ' + (setNumber || 1));
}

// ========================================================================
// BLOCK 0200: CDN 폴백 체계
// ========================================================================
const CDN_LIST = {
    chartjs: [
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js',
        '/vendor/chart.min.js'
    ],
    threejs: [
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
        '/vendor/three.min.js'
    ],
    mathjax: [
        'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js',
        'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.min.js',
        '/vendor/mathjax.min.js'
    ],
    mathjs: [
        'https://cdn.jsdelivr.net/npm/mathjs@14.3.0/lib/browser/math.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/mathjs/14.3.0/math.min.js',
        '/vendor/math.min.js'
    ]
};

// ========================================================================
// BLOCK 0210: Lazy Loading System (렌더 토큰 포함)
// ========================================================================
const LOADER = {
    chartjs: { loaded: false, loading: false, promise: null, attempts: 0 },
    threejs: { loaded: false, loading: false, promise: null, attempts: 0 },
    mathjax: { loaded: false, loading: false, promise: null, attempts: 0 },
    mathjs: { loaded: false, loading: false, promise: null, attempts: 0 }
};

let currentRenderToken = null;
let renderCounter = 0;

function generateRenderToken() {
    renderCounter++;
    return Symbol(`render-${renderCounter}`);
}

function isRenderValid(token) {
    return token === currentRenderToken;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            LOG.info(`✅ Loaded: ${src.split('/').pop()}`);
            resolve();
        };
        script.onerror = () => {
            LOG.error(`❌ Failed: ${src}`);
            reject(new Error(`Failed to load: ${src}`));
        };
        document.head.appendChild(script);
    });
}

async function loadWithFallback(cdnKey, loaderKey) {
    const cdnList = CDN_LIST[cdnKey];
    if (!cdnList || cdnList.length === 0) {
        throw new Error(`No CDN list for ${cdnKey}`);
    }
    const loader = LOADER[loaderKey];
    if (!loader) throw new Error(`No loader for ${loaderKey}`);
    let lastError = null;
    for (let i = 0; i < cdnList.length; i++) {
        try {
            await loadScript(cdnList[i]);
            loader.attempts = i + 1;
            return true;
        } catch (err) {
            lastError = err;
            LOG.warn(`CDN ${cdnKey} attempt ${i + 1} failed, trying next...`);
        }
    }
    throw lastError || new Error(`All CDN attempts failed for ${cdnKey}`);
}

// ========================================================================
// BLOCK 0220: 개별 CDN 로더
// ========================================================================
function ensureChartJS() {
    if (LOADER.chartjs.loaded) return Promise.resolve();
    if (LOADER.chartjs.loading) return LOADER.chartjs.promise;
    LOADER.chartjs.loading = true;
    LOG.info('⏳ Loading Chart.js...');
    LOADER.chartjs.promise = loadWithFallback('chartjs', 'chartjs')
        .then(() => {
            LOADER.chartjs.loaded = true;
            LOADER.chartjs.loading = false;
            LOG.info('✅ Chart.js ready!');
        })
        .catch((err) => {
            LOADER.chartjs.loading = false;
            LOG.error('❌ Chart.js load failed:', err);
            showToast('📊 차트 라이브러리 로드 실패', 'error');
            throw err;
        });
    return LOADER.chartjs.promise;
}

function ensureThreeJS() {
    if (LOADER.threejs.loaded) return Promise.resolve();
    if (LOADER.threejs.loading) return LOADER.threejs.promise;
    LOADER.threejs.loading = true;
    LOG.info('⏳ Loading Three.js...');
    LOADER.threejs.promise = loadWithFallback('threejs', 'threejs')
        .then(() => {
            LOADER.threejs.loaded = true;
            LOADER.threejs.loading = false;
            LOG.info('✅ Three.js ready!');
        })
        .catch((err) => {
            LOADER.threejs.loading = false;
            LOG.error('❌ Three.js load failed:', err);
            showToast('🧊 3D 라이브러리 로드 실패', 'error');
            throw err;
        });
    return LOADER.threejs.promise;
}

function ensureMathJax() {
    if (LOADER.mathjax.loaded) return Promise.resolve();
    if (LOADER.mathjax.loading) return LOADER.mathjax.promise;
    LOADER.mathjax.loading = true;
    LOG.info('⏳ Loading MathJax...');
    LOADER.mathjax.promise = loadWithFallback('mathjax', 'mathjax')
        .then(() => {
            LOADER.mathjax.loaded = true;
            LOADER.mathjax.loading = false;
            LOG.info('✅ MathJax ready!');
            if (DOM.questionContainer && DOM.questionContainer.innerHTML.includes('\\(')) {
                if (window.MathJax && MathJax.typesetPromise) {
                    const token = currentRenderToken;
                    MathJax.typesetPromise([DOM.questionContainer])
                        .then(() => { if (isRenderValid(token)) LOG.debug('✅ MathJax re-render complete'); })
                        .catch(err => LOG.warn('⚠️ MathJax re-render error:', err));
                }
            }
        })
        .catch((err) => {
            LOADER.mathjax.loading = false;
            LOG.error('❌ MathJax load failed:', err);
            showToast('📐 수식 라이브러리 로드 실패', 'error');
            throw err;
        });
    return LOADER.mathjax.promise;
}

function ensureMathJS() {
    if (LOADER.mathjs.loaded) return Promise.resolve();
    if (LOADER.mathjs.loading) return LOADER.mathjs.promise;
    LOADER.mathjs.loading = true;
    LOG.info('⏳ Loading Math.js...');
    LOADER.mathjs.promise = loadWithFallback('mathjs', 'mathjs')
        .then(() => {
            LOADER.mathjs.loaded = true;
            LOADER.mathjs.loading = false;
            LOG.info('✅ Math.js ready!');
        })
        .catch((err) => {
            LOADER.mathjs.loading = false;
            LOG.error('❌ Math.js load failed:', err);
            showToast('🔢 계산 라이브러리 로드 실패', 'error');
            throw err;
        });
    return LOADER.mathjs.promise;
}

// ========================================================================
// BLOCK 0230: 백그라운드 통합 로더 (순차 로드)
// ========================================================================
let _backgroundLoadingStarted = false;
let _backgroundLoadingPromise = null;

async function loadAllLibrariesInBackground() {
    if (_backgroundLoadingStarted) {
        LOG.debug('⏳ 백그라운드 로딩 이미 진행 중...');
        return _backgroundLoadingPromise;
    }
    _backgroundLoadingStarted = true;
    LOG.info('📦 백그라운드에서 모든 CDN 순차 로드 시작...');
    const loadSequence = [
        { name: 'Chart.js', fn: ensureChartJS, delay: 0 },
        { name: 'MathJax', fn: ensureMathJax, delay: 2000 },
        { name: 'Math.js', fn: ensureMathJS, delay: 2000 },
        { name: 'Three.js', fn: ensureThreeJS, delay: 2000 }
    ];
    _backgroundLoadingPromise = (async () => {
        const results = [];
        for (const item of loadSequence) {
            try {
                if (item.delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, item.delay));
                }
                const result = await item.fn();
                results.push({ name: item.name, status: 'fulfilled', value: result });
                LOG.info(`✅ ${item.name} 로드 완료 (백그라운드)`);
            } catch (err) {
                results.push({ name: item.name, status: 'rejected', reason: err });
                LOG.warn(`⚠️ ${item.name} 로드 실패 (백그라운드):`, err);
            }
        }
        const loaded = results.filter(r => r.status === 'fulfilled').length;
        LOG.info(`✅ ${loaded}/4 CDN 로드 완료 (백그라운드)`);
        return results;
    })();
    return _backgroundLoadingPromise;
}

// ========================================================================
// BLOCK 0300: 토스트/에러 시스템
// ========================================================================
let toastTimeout = null;

function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast-container');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);
    const colors = { info: '#3498db', success: '#27ae60', warn: '#f39c12', error: '#e74c3c' };
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: ${colors[type] || '#333'}; color: white;
        padding: 14px 28px; border-radius: 12px; font-weight: 600;
        z-index: 99999; max-width: 90%; text-align: center;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        font-size: 15px; transition: opacity 0.3s;
        font-family: 'Segoe UI', sans-serif;
    `;
    container.textContent = message;
    document.body.appendChild(container);
    toastTimeout = setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => container.remove(), 300);
    }, duration);
}

// ========================================================================
// BLOCK 0400: RendererManager (메모리 누수 방지)
// ========================================================================
const RendererManager = {
    charts: [],
    threeScenes: [],
    animationIds: [],
    canvases: [],
    
    registerChart(chart) {
        if (chart && typeof chart === 'object') {
            this.charts.push(chart);
            LOG.debug(`📊 Chart registered (total: ${this.charts.length})`);
        }
        return chart;
    },
    
    registerThree(scene, renderer, animationId) {
        if (scene) this.threeScenes.push(scene);
        if (renderer) this.threeScenes.push(renderer);
        if (animationId) this.animationIds.push(animationId);
        LOG.debug(`🧊 Three registered (scenes: ${this.threeScenes.length}, animations: ${this.animationIds.length})`);
    },
    
    registerCanvas(canvas) {
        if (canvas) {
            this.canvases.push(canvas);
            LOG.debug(`🖼️ Canvas registered (total: ${this.canvases.length})`);
        }
    },
    
    disposeAll() {
        this.charts.forEach(chart => { try { if (chart && typeof chart.destroy === 'function') chart.destroy(); } catch(e) {} });
        this.charts = [];
        this.threeScenes.forEach(item => { try { if (item && typeof item.dispose === 'function') item.dispose(); } catch(e) {} });
        this.threeScenes = [];
        this.animationIds.forEach(id => { try { if (id) cancelAnimationFrame(id); } catch(e) {} });
        this.animationIds = [];
        this.canvases.forEach(canvas => { try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch(e) {} });
        this.canvases = [];
        LOG.debug('✅ All renderer resources disposed');
    },
    
    disposeCurrent() {
        this.charts.forEach(chart => { try { if (chart && typeof chart.destroy === 'function') chart.destroy(); } catch(e) {} });
        this.charts = [];
        this.canvases.forEach(canvas => { try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch(e) {} });
        this.canvases = [];
        LOG.debug('✅ Current renderer resources disposed');
    }
};

// ========================================================================
// BLOCK 0410: DOM 참조 일원화 (원본 B002의 DOM 객체 통합)
// ========================================================================
DOM.setupSection = null;
DOM.quizMain = null;
DOM.quizContent = null;
DOM.startNumberInput = null;
DOM.startQuizBtn = null;
DOM.maxNumberSpan = null;
DOM.progressText = null;
DOM.quizProgressBar = null;
DOM.accountIdentity = null;
DOM.questionContainer = null;
DOM.explanationBox = null;
DOM.explanationText = null;
DOM.prevBtn = null;
DOM.nextBtn = null;
DOM.skipBtn = null;
DOM.submitBtn = null;
DOM.quitBtn = null;
DOM.resultModal = null;
DOM.correctCountSpan = null;
DOM.accuracyRateSpan = null;
DOM.resultGrid = null;
DOM.retryAllBtn = null;
DOM.reviewWrongBtn = null;
DOM.closeModalBtn = null;
DOM.wrongModal = null;
DOM.wrongListDiv = null;
DOM.closeWrongBtn = null;
DOM.retryWrongFromReviewBtn = null;
DOM.reviewBanner = null;
DOM.savedBadgeContainer = null;
DOM.loadNextContainer = null;
DOM.mainContainer = null;
DOM.maxNumberDisplay = null;
DOM.setSelector = null;
DOM.progressArea = null;
DOM.splashOverlay = null;
DOM.splashBar = null;
DOM.splashStatus = null;
DOM.splashError = null;
DOM.splashRetry = null;
DOM.progressModal = null;
DOM.progressModalBody = null;
DOM.progressContinueBtn = null;
DOM.progressCancelBtn = null;
DOM.timerDisplay = null;
DOM.timerPauseBtn = null;
DOM.timerResetBtn = null;
DOM.timerSetBtn = null;
DOM.timerHours = null;
DOM.timerMinutes = null;
DOM.timerSecondsInput = null;
DOM.calculatorToggle = null;
DOM.timerToggle = null;
DOM.calculatorPanel = null;
DOM.timerPanel = null;
DOM.calculatorDisplay = null;
DOM.calculatorExpression = null;
DOM.calculatorTimerMirror = null;
DOM.headerTimerDisplay = null;
DOM.languageSelector = null;
DOM.modeButtons = null;
DOM.modeDescription = null;
DOM.biblePassageToggle = null;
DOM.bibleQuizToggle = null;
DOM.biblePrimaryTextSelector = null;
DOM.bibleSecondaryTextSelector = null;

function initDOM() {
    DOM.splashOverlay = document.getElementById('splashOverlay');
    DOM.splashBar = document.getElementById('splashBar');
    DOM.splashStatus = document.getElementById('splashStatus');
    DOM.splashError = document.getElementById('splashError');
    DOM.splashRetry = document.getElementById('splashRetry');
    DOM.setupSection = document.getElementById('setupSection');
    DOM.quizMain = document.getElementById('quizMain');
    DOM.quizContent = document.getElementById('quizContent');
    DOM.startNumberInput = document.getElementById('startNumber');
    DOM.startQuizBtn = document.getElementById('startQuizBtn');
    DOM.maxNumberSpan = document.getElementById('maxNumber');
    DOM.progressText = document.getElementById('progressText');
    DOM.quizProgressBar = document.getElementById('quizProgressBar');
    DOM.accountIdentity = document.getElementById('accountIdentity');
    DOM.questionContainer = document.getElementById('questionContainer');
    DOM.explanationBox = document.getElementById('explanationBox');
    DOM.explanationText = document.getElementById('explanationText');
    DOM.prevBtn = document.getElementById('prevBtn');
    DOM.nextBtn = document.getElementById('nextBtn');
    DOM.skipBtn = document.getElementById('skipBtn');
    DOM.submitBtn = document.getElementById('submitBtn');
    DOM.quitBtn = document.getElementById('quitBtn');
    DOM.resultModal = document.getElementById('resultModal');
    DOM.correctCountSpan = document.getElementById('correctCount');
    DOM.accuracyRateSpan = document.getElementById('accuracyRate');
    DOM.resultGrid = document.getElementById('resultGrid');
    DOM.retryAllBtn = document.getElementById('retryAllBtn');
    DOM.reviewWrongBtn = document.getElementById('reviewWrongBtn');
    DOM.closeModalBtn = document.getElementById('closeModalBtn');
    DOM.wrongModal = document.getElementById('wrongModal');
    DOM.wrongListDiv = document.getElementById('wrongList');
    DOM.closeWrongBtn = document.getElementById('closeWrongBtn');
    DOM.retryWrongFromReviewBtn = document.getElementById('retryWrongFromReviewBtn');
    DOM.reviewBanner = document.getElementById('reviewBanner');
    DOM.savedBadgeContainer = document.getElementById('resumeQuickContainer');
    DOM.loadNextContainer = document.getElementById('loadNextContainer');
    DOM.mainContainer = document.getElementById('mainContainer');
    DOM.maxNumberDisplay = document.getElementById('maxNumberDisplay');
    DOM.setSelector = document.getElementById('setSelector');
    DOM.progressArea = document.querySelector('.progress-area') || document.getElementById('progressArea');
    DOM.progressModal = document.getElementById('progressModal');
    DOM.progressModalBody = document.getElementById('progressModalBody');
    DOM.progressContinueBtn = document.getElementById('progressContinueBtn');
    DOM.progressCancelBtn = document.getElementById('progressCancelBtn');
    DOM.timerDisplay = document.getElementById('timerDisplay');
    DOM.timerPauseBtn = document.getElementById('timerPauseBtn');
    DOM.timerResetBtn = document.getElementById('timerResetBtn');
    DOM.timerSetBtn = document.getElementById('timerSetBtn');
    DOM.timerHours = document.getElementById('timerHours');
    DOM.timerMinutes = document.getElementById('timerMinutes');
    DOM.timerSecondsInput = document.getElementById('timerSecondsInput');
    DOM.calculatorToggle = document.getElementById('calculatorToggle');
    DOM.timerToggle = document.getElementById('timerToggle');
    DOM.calculatorPanel = document.getElementById('calculatorPanel');
    DOM.timerPanel = document.getElementById('timerPanel');
    DOM.calculatorDisplay = document.getElementById('calculatorDisplay');
    DOM.calculatorExpression = document.getElementById('calculatorExpression');
    DOM.calculatorTimerMirror = document.getElementById('calculatorTimerMirror');
    DOM.headerTimerDisplay = document.getElementById('headerTimerDisplay');
    DOM.languageSelector = document.getElementById('languageSelector');
    DOM.modeButtons = document.getElementById('modeButtons');
    DOM.modeDescription = document.getElementById('modeDescription');
    DOM.biblePassageToggle = document.getElementById('biblePassageToggle');
    DOM.bibleQuizToggle = document.getElementById('bibleQuizToggle');
    DOM.biblePrimaryTextSelector = document.getElementById('biblePrimaryTextSelector');
    DOM.bibleSecondaryTextSelector = document.getElementById('bibleSecondaryTextSelector');
    LOG.debug('✅ DOM initialized');
}

// ========================================================================
// BLOCK 0500: Splash 화면 (원본 B003)
// ========================================================================
function updateSplash(percent, text) {
  var bar = DOM.splashBar;
  var status = DOM.splashStatus;
  if (bar) bar.style.width = Math.min(100, percent) + '%';
  if (status) status.textContent = text || 'Loading...';
  console.log('Splash: ' + percent + '% - ' + text);
}

function showSplashError(msg) {
  var errorEl = DOM.splashError;
  var retryBtn = DOM.splashRetry;
  if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = '▲ ' + msg; }
  if (retryBtn) retryBtn.style.display = 'inline-block';
}

function hideSplash() {
  var overlay = DOM.splashOverlay;
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(function() {
      overlay.style.display = 'none';
      var mc = DOM.mainContainer;
      if (mc) mc.style.display = 'block';
    }, 500);
  }
}

// ========================================================================
// BLOCK 0510: LoadingManager
// ========================================================================
const LoadingManager = {
    _overlay: null,
    _timeout: null,
    
    show(message, type = 'spinner') {
        this.hide();
        this._overlay = document.createElement('div');
        this._overlay.className = 'loading-manager-overlay';
        this._overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 99998;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            font-family: 'Segoe UI', sans-serif;
        `;
        const spinner = type === 'spinner' 
            ? `<div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.3);border-top:4px solid #f5a623;border-radius:50%;animation:spin 0.8s linear infinite;"></div>`
            : `<div style="font-size:48px;">⏳</div>`;
        this._overlay.innerHTML = `
            <div style="background:rgba(0,0,0,0.8);padding:30px 40px;border-radius:16px;text-align:center;max-width:90%;">
                ${spinner}
                <div style="color:white;margin-top:16px;font-size:16px;font-weight:500;">${message}</div>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(this._overlay);
        this._timeout = setTimeout(() => {
            LOG.warn('⚠️ Loading taking too long...');
            showToast('로딩이 길어지고 있습니다...', 'warn', 5000);
        }, 30000);
    },
    
    hide() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    },
    
    update(message) {
        if (this._overlay) {
            const textEl = this._overlay.querySelector('div:last-child div:last-child');
            if (textEl) textEl.textContent = message;
        }
    }
};

// ========================================================================
// BLOCK 0520: 진행 표시 (원본 B005)
// ========================================================================
function getBibleSourceCode_(question) {
  return String(question && (question.sourceCode || question.subject) || '').trim();
}

function getBibleVerseIndexes_() {
  var indexes = [];
  var seen = {};
  currentQuestions.forEach(function(question, index) {
    var sourceCode = getBibleSourceCode_(question) || ('INDEX-' + index);
    if (seen[sourceCode]) return;
    seen[sourceCode] = true;
    indexes.push(index);
  });
  return indexes;
}

function getFirstIndexForSource_(sourceCode) {
  if (!sourceCode) return Math.max(0, currentIndex);
  for (var index = 0; index < currentQuestions.length; index++) {
    if (getBibleSourceCode_(currentQuestions[index]) === sourceCode) return index;
  }
  return Math.max(0, currentIndex);
}

function getBibleReadingPosition_() {
  var indexes = getBibleVerseIndexes_();
  var sourceCode = getBibleSourceCode_(currentQuestions[currentIndex]);
  var position = indexes.findIndex(function(index) {
    return getBibleSourceCode_(currentQuestions[index]) === sourceCode;
  });
  return { indexes: indexes, position: Math.max(0, position) };
}

function updateProgressDisplay() {
  var displayIndex = currentIndex;
  var total = currentQuestions.length || 1;
  if (!bibleQuizVisible) {
    var reading = getBibleReadingPosition_();
    displayIndex = reading.position;
    total = reading.indexes.length || 1;
  }
  var percent = ((displayIndex + 1) / total) * 100;
  if (DOM.quizProgressBar) DOM.quizProgressBar.style.width = percent + '%';
  if (DOM.progressText) {
    DOM.progressText.style.display = 'inline-block';
    DOM.progressText.innerText = (displayIndex + 1) + ' / ' + total;
  }
}

function showLoadingOverlay(message) {
  var overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = '<div class="loading-spinner"></div><h3>' + message + '</h3>';
  document.body.appendChild(overlay);
  return overlay;
}

function hideLoadingOverlay() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}

function updateQuestionLoadingStatus_(message) {
  var overlay = document.getElementById('loadingOverlay');
  var heading = overlay && overlay.querySelector('h3');
  if (heading) heading.textContent = message || 'Loading questions...';
}

// ========================================================================
// BLOCK 0600: 진행 저장/로드 (원본 B006 + 즉시 저장)
// ========================================================================
function saveProgress() {
  try {
    var data = {
      currentQuestions: currentQuestions,
      userAnswers: userAnswers,
      currentIndex: currentIndex,
      correctCount: correctCount,
      currentStartNumber: currentStartNumber,
      isReviewMode: isReviewMode,
      originalQuestions: originalQuestions,
      masterQuestions: masterQuestions,
      timestamp: new Date().toISOString(),
      currentLanguage: currentLanguage,
      currentMode: currentMode,
      currentSubject: currentSubject,
      subjectConfig: subjectConfig,
      learnRevealed: learnRevealed,
      examFinished: examFinished,
      cdnLoaded: {
        chartjs: LOADER.chartjs.loaded,
        threejs: LOADER.threejs.loaded,
        mathjax: LOADER.mathjax.loaded,
        mathjs: LOADER.mathjs.loaded
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch(e) {
    console.warn('Save failed:', e);
    return false;
  }
}

function saveProgressImmediate() {
    saveProgress();
    LOG.debug('💾 Progress saved immediately');
}

function loadProgress() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (data.currentLanguage) setLanguage(data.currentLanguage, false);
    // Reading a saved session must not change the mode currently selected in
    // the UI. The saved mode is restored only when the student explicitly
    // chooses Continue (see resumeProgress). Otherwise an old Learn session
    // can make a visibly selected Study session reveal every answer.
    if (data.learnRevealed && typeof data.learnRevealed === 'object') learnRevealed = data.learnRevealed;
    examFinished = !!data.examFinished;
    if (data.cdnLoaded) {
        if (data.cdnLoaded.chartjs && typeof Chart === 'undefined') data.cdnLoaded.chartjs = false;
        if (data.cdnLoaded.mathjax && typeof MathJax === 'undefined') data.cdnLoaded.mathjax = false;
        if (data.cdnLoaded.threejs && typeof THREE === 'undefined') data.cdnLoaded.threejs = false;
    }
    return data;
  } catch(e) {
    console.warn('Load failed:', e);
    return null;
  }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(function() {
    saveProgress();
  }, 5000);
}

// ========================================================================
// BLOCK 0650: 다국어 엔진 (그래픽 G는 언어와 무관하게 영어 원본 유지)
// ========================================================================
function cleanTextValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\n/g, '<br>').trim();
}


function normalizeSchemaKey(key) {
  return String(key === null || key === undefined ? '' : key)
    .replace(/^\uFEFF/, '')
    .trim()
    .toUpperCase();
}

function buildNormalizedRowMap(parsed) {
  var map = {};
  if (!parsed || typeof parsed !== 'object') return map;
  Object.keys(parsed).forEach(function(key) {
    map[normalizeSchemaKey(key)] = parsed[key];
  });
  return map;
}

function readSchemaValue(parsed, normalizedMap, key) {
  if (!parsed || typeof parsed !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(parsed, key)) return parsed[key];
  var normalizedKey = normalizeSchemaKey(key);
  if (normalizedMap && Object.prototype.hasOwnProperty.call(normalizedMap, normalizedKey)) {
    return normalizedMap[normalizedKey];
  }
  return '';
}

function readLocalizedSchemaValue(parsed, normalizedMap, baseKey, language) {
  var lang = String(language || 'EN').toUpperCase();
  var value = readSchemaValue(parsed, normalizedMap, baseKey + '_' + lang);
  if (value === undefined || value === null || value === '') {
    value = readSchemaValue(parsed, normalizedMap, baseKey + '_EN');
  }
  return cleanTextValue(value);
}

function getLocalizedRaw(parsed, baseKey, language) {
  var lang = String(language || currentLanguage || 'EN').toUpperCase();
  var localizedKey = baseKey + '_' + lang;
  var englishKey = baseKey + '_EN';
  var value = parsed && parsed[localizedKey];
  if (value === undefined || value === null || value === '') value = parsed && parsed[englishKey];
  return cleanTextValue(value);
}

function getQuestionLocalizedText(q, field) {
  if (!q) return '';
  var lang = currentLanguage;
  var map = q.localized || {};
  var fieldMap = map[field] || {};
  var value = fieldMap[lang];
  if (value === undefined || value === null || value === '') value = fieldMap.EN;
  if (value === undefined || value === null || value === '') value = q[field] || '';
  return cleanTextValue(value);
}

function getChoiceLocalizedText(q, key) {
  if (!q) return '';
  var translations = q.choiceTranslations || {};
  var choiceMap = translations[String(key)] || {};
  var value = choiceMap[currentLanguage];
  if (value === undefined || value === null || value === '') value = choiceMap.EN;
  if (value === undefined || value === null || value === '') value = q.choices && q.choices[String(key)];
  return cleanTextValue(value);
}

function getFieldLanguagePair(q, field) {
  var map = (q && q.localized) || {};
  var fieldMap = map[field] || {};
  return {
    EN: cleanTextValue(fieldMap.EN || (q && q[field]) || ''),
    KO: cleanTextValue(fieldMap.KO || '')
  };
}

function getChoiceLanguagePair(q, key) {
  var translations = (q && q.choiceTranslations) || {};
  var choiceMap = translations[String(key)] || {};
  return {
    EN: cleanTextValue(choiceMap.EN || (q && q.choices && q.choices[String(key)]) || ''),
    KO: cleanTextValue(choiceMap.KO || '')
  };
}

function renderBilingualTextBlock(enText, koText, className, processEnglish, processKorean) {
  var enHtml = processEnglish ? processEnglish(enText || '') : (enText || '');
  var koHtml = processKorean ? processKorean(koText || '') : (koText || '');
  var languages = getSelectedQuizLanguages_();
  var lines = [];
  languages.forEach(function(language) {
    if (language === 'KO' && String(koText || '').trim()) {
      lines.push('<div class="language-line language-line-ko">' + koHtml + '</div>');
    } else if (language === 'EN' && String(enText || '').trim()) {
      lines.push('<div class="language-line language-line-en">' + enHtml + '</div>');
    }
  });
  return '<div class="' + className + (lines.length > 1 ? ' bilingual-block' : '') + '">' +
    lines.join('') + '</div>';
}

function bibleTextOptionLanguage_(option) {
  return option === 'KO_WEB' ? 'KO' : 'EN';
}

function getSelectedBibleTextOptions_() {
  var options = [biblePrimaryText];
  if (bibleSecondaryText !== 'NONE' && bibleSecondaryText !== biblePrimaryText) {
    options.push(bibleSecondaryText);
  }
  return options;
}

function getSelectedQuizLanguages_() {
  var languages = [];
  getSelectedBibleTextOptions_().forEach(function(option) {
    var language = bibleTextOptionLanguage_(option);
    if (languages.indexOf(language) < 0) languages.push(language);
  });
  return languages;
}

function renderQuestionLanguageBlock(q, isMath) {
  var pair = getFieldLanguagePair(q, 'question');
  return renderBilingualTextBlock(
    pair.EN || 'No question text',
    pair.KO,
    'question-text',
    wrapPowerExpressionsSafely,
    wrapPowerExpressionsSafely
  );
}

function getBiblePassageReference_(q, option) {
  var sourceCode = String((q && (q.sourceCode || q.subject)) || '').trim();
  var match = sourceCode.match(/^(?:OT|NT)-(.+)-(\d{2,3})-(\d{2,3})$/);
  if (!match) return '';
  var book = match[1].replace(/-/g, ' ');
  var chapter = parseInt(match[2], 10);
  var verse = parseInt(match[3], 10);
  return option === 'KO_WEB'
    ? book + ' ' + chapter + '장 ' + verse + '절'
    : book + ' ' + chapter + ':' + verse;
}

function renderPassageLanguageBlock(q, isMath) {
  if (!isBiblePassageVisible_()) return '';
  var versions = q && q.passageVersions ? q.passageVersions : {};
  var kjv = String(versions.KJV || '').trim();
  var web = String(versions.WEB || '').trim();
  var koWeb = String(versions.KO_WEB || '').trim();
  if (kjv || web || koWeb) {
    var blocks = [];
    getSelectedBibleTextOptions_().forEach(function(option) {
      var text = option === 'KJV' ? kjv : (option === 'KO_WEB' ? koWeb : web);
      if (!text) return;
      var label = option === 'KJV'
        ? 'KJV Original'
        : (option === 'KO_WEB' ? 'WEB Korean Literal Translation' : 'WEB Modern English');
      var languageClass = option === 'KO_WEB' ? 'language-line-ko' : 'language-line-en';
      var reference = getBiblePassageReference_(q, option);
      blocks.push('<div class="bible-passage-version"><span class="bible-version-label">' + label + '</span>' +
        (reference ? '<span class="bible-passage-reference" aria-label="Bible reference">' +
          escapeHtml(reference) + '</span>' : '') +
        '<div class="passage-language-content language-line ' + languageClass + '">' +
        renderWithEditingMarks(text, isMath) + '</div></div>');
    });
    if (blocks.length) return '<div class="passage-language-card">' + blocks.join('') + '</div>';
  }
  var pair = getFieldLanguagePair(q, 'passage');
  if (!pair.EN || pair.EN.trim() === '' || pair.EN.trim() === 'No passage.') return '';
  return '<div class="passage-language-card">' +
    renderBilingualTextBlock(
      pair.EN,
      pair.KO,
      'passage-language-content',
      function(v) { return renderWithEditingMarks(v, isMath); },
      function(v) { return renderWithEditingMarks(v, isMath); }
    ) +
    '</div>';
}

function renderChoiceLanguageBlock(q, key) {
  var pair = getChoiceLanguagePair(q, key);
  if (!pair.EN) return '';
  return renderBilingualTextBlock(
    pair.EN,
    pair.KO,
    'choice-language-content math-content',
    wrapPowerExpressionsSafely,
    wrapPowerExpressionsSafely
  );
}

function renderExplanationLanguageBlock(q) {
  var pair = getFieldLanguagePair(q, 'explanation');
  if (!pair.EN) pair.EN = LANG.noExplanation;
  return renderBilingualTextBlock(
    pair.EN,
    pair.KO,
    'explanation-language-content math-content',
    escapeHtml,
    escapeHtml
  );
}

function setLanguage(language, rerender) {
  var next = String(language || 'EN').toUpperCase();
  if (SUPPORTED_LANGUAGES.indexOf(next) < 0) next = 'EN';
  currentLanguage = next;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  if (DOM.languageSelector) DOM.languageSelector.value = currentLanguage;
  document.documentElement.lang = currentLanguage === 'KO' ? 'ko' : 'en';
  LOG.info('🌐 Language changed:', currentLanguage);
  if (rerender !== false && currentQuestions.length && DOM.questionContainer) {
    renderCurrentQuestion();
  }
  return currentLanguage;
}

function initLanguageSelector() {
  if (!DOM.languageSelector) return;
  DOM.languageSelector.value = currentLanguage;
  DOM.languageSelector.onchange = function() {
    setLanguage(this.value, true);
  };
}


// ========================================================================
// BLOCK 0660: Learn / Study / Exam 모드 엔진
// ========================================================================
var MODE_INFO = {
  learn: {
    label: 'Learn',
    icon: '🟢',
    description: 'Read the question, reveal the answer, and learn from the explanation.'
  },
  study: {
    label: 'Study',
    icon: '🔵',
    description: 'Choose an answer and receive instant feedback.'
  },
  exam: {
    label: 'Exam',
    icon: '🔴',
    description: 'Answers are saved, but feedback stays hidden until submission.'
  }
};

function normalizeMode(mode) {
  var value = String(mode || 'study').toLowerCase();
  return SUPPORTED_MODES.indexOf(value) >= 0 ? value : 'study';
}

function updateModeUI() {
  var info = MODE_INFO[currentMode] || MODE_INFO.study;
  document.documentElement.setAttribute('data-study-mode', currentMode);

  if (DOM.modeButtons) {
    DOM.modeButtons.querySelectorAll('[data-ui-mode]').forEach(function(button) {
      var active = button.getAttribute('data-ui-mode') === currentMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  if (DOM.modeDescription) {
    DOM.modeDescription.textContent = info.icon + ' ' + info.label + ' · ' + info.description;
  }
  var examMode = currentMode === 'exam';
  if (DOM.timerToggle) {
    DOM.timerToggle.hidden = !examMode;
    DOM.timerToggle.setAttribute('aria-hidden', examMode ? 'false' : 'true');
    DOM.timerToggle.tabIndex = examMode ? 0 : -1;
  }
  if (!examMode && DOM.timerPanel) {
    DOM.timerPanel.hidden = true;
    if (DOM.timerToggle) DOM.timerToggle.setAttribute('aria-expanded', 'false');
  }
  updateBiblePassageControls_();
}

function setMode(mode, rerender) {
  currentMode = normalizeMode(mode);
  localStorage.setItem(MODE_STORAGE_KEY, currentMode);

  if (currentMode === 'learn') {
    for (var i = 0; i < currentQuestions.length; i++) {
      learnRevealed[String(i)] = true;
    }
  }

  if (currentMode !== 'exam') examFinished = false;
  updateModeUI();
  saveProgress();

  if (rerender !== false && currentQuestions.length && DOM.questionContainer) {
    renderCurrentQuestion();
  }
  return currentMode;
}

function initModeSelector() {
  if (!DOM.modeButtons) return;

  DOM.modeButtons.querySelectorAll('[data-ui-mode]').forEach(function(button) {
    button.addEventListener('click', function() {
      setMode(this.getAttribute('data-ui-mode'), true);
    });
  });

  updateModeUI();
  initBiblePassageControls_();
}

function isBiblePassageVisible_() {
  if (!bibleQuizVisible) return true;
  if (currentMode === 'exam') return !!examFinished;
  return !!biblePassagePreferences[currentMode];
}

function updateBibleReadingModeUI_() {
  document.documentElement.classList.toggle('bible-reading-only', !bibleQuizVisible);
  if (DOM.bibleQuizToggle) {
    DOM.bibleQuizToggle.classList.toggle('is-on', bibleQuizVisible);
    DOM.bibleQuizToggle.setAttribute('aria-pressed', bibleQuizVisible ? 'true' : 'false');
    DOM.bibleQuizToggle.textContent = 'Qz';
    DOM.bibleQuizToggle.title = bibleQuizVisible ? 'Quiz display: on' : 'Quiz display: off';
  }
}

function updateBiblePassageControls_() {
  var visible = isBiblePassageVisible_();
  if (DOM.biblePassageToggle) {
    var locked = !bibleQuizVisible || (currentMode === 'exam' && !examFinished);
    DOM.biblePassageToggle.disabled = locked;
    DOM.biblePassageToggle.classList.toggle('is-on', visible);
    DOM.biblePassageToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
    DOM.biblePassageToggle.textContent = locked
      ? 'PSG'
      : 'PSG';
    DOM.biblePassageToggle.title = locked
      ? 'Passage becomes available after submission'
      : (visible ? 'Passage display: on' : 'Passage display: off');
  }
  updateBibleReadingModeUI_();
  if (DOM.biblePrimaryTextSelector) DOM.biblePrimaryTextSelector.value = biblePrimaryText;
  if (DOM.bibleSecondaryTextSelector) DOM.bibleSecondaryTextSelector.value = bibleSecondaryText;
}

function initBiblePassageControls_() {
  updateBiblePassageControls_();
  if (DOM.bibleQuizToggle && !DOM.bibleQuizToggle.dataset.bound) {
    DOM.bibleQuizToggle.dataset.bound = '1';
    DOM.bibleQuizToggle.addEventListener('click', function() {
      bibleQuizVisible = !bibleQuizVisible;
      if (!bibleQuizVisible) {
        biblePassagePreferences[currentMode] = true;
        localStorage.setItem(BIBLE_PASSAGE_PREFS_KEY, JSON.stringify(biblePassagePreferences));
        currentIndex = getFirstIndexForSource_(getBibleSourceCode_(currentQuestions[currentIndex]));
      }
      localStorage.setItem(BIBLE_QUIZ_VISIBLE_KEY, String(bibleQuizVisible));
      updateBiblePassageControls_();
      if (currentQuestions.length) renderCurrentQuestion();
    });
  }
  if (DOM.biblePassageToggle && !DOM.biblePassageToggle.dataset.bound) {
    DOM.biblePassageToggle.dataset.bound = '1';
    DOM.biblePassageToggle.addEventListener('click', function() {
      if (currentMode === 'exam' && !examFinished) return;
      biblePassagePreferences[currentMode] = !biblePassagePreferences[currentMode];
      localStorage.setItem(BIBLE_PASSAGE_PREFS_KEY, JSON.stringify(biblePassagePreferences));
      updateBiblePassageControls_();
      if (currentQuestions.length) renderCurrentQuestion();
    });
  }
  if (DOM.biblePrimaryTextSelector && !DOM.biblePrimaryTextSelector.dataset.bound) {
    DOM.biblePrimaryTextSelector.dataset.bound = '1';
    DOM.biblePrimaryTextSelector.addEventListener('change', function() {
      biblePrimaryText = String(this.value || 'WEB').toUpperCase();
      if (bibleSecondaryText === biblePrimaryText) bibleSecondaryText = 'NONE';
      localStorage.setItem(BIBLE_PRIMARY_TEXT_KEY, biblePrimaryText);
      localStorage.setItem(BIBLE_SECONDARY_TEXT_KEY, bibleSecondaryText);
      updateBiblePassageControls_();
      if (currentQuestions.length) renderCurrentQuestion();
    });
  }
  if (DOM.bibleSecondaryTextSelector && !DOM.bibleSecondaryTextSelector.dataset.bound) {
    DOM.bibleSecondaryTextSelector.dataset.bound = '1';
    DOM.bibleSecondaryTextSelector.addEventListener('change', function() {
      bibleSecondaryText = String(this.value || 'NONE').toUpperCase();
      if (bibleSecondaryText === biblePrimaryText) bibleSecondaryText = 'NONE';
      localStorage.setItem(BIBLE_SECONDARY_TEXT_KEY, bibleSecondaryText);
      updateBiblePassageControls_();
      if (currentQuestions.length) renderCurrentQuestion();
    });
  }
}

function isLearnRevealed(index) {
  return currentMode === 'learn' || !!learnRevealed[String(index)];
}

function revealLearnAnswer() {
  learnRevealed[String(currentIndex)] = true;
  saveProgressImmediate();
  renderCurrentQuestion();
}

function calculateCorrectCount() {
  var count = 0;
  for (var i = 0; i < currentQuestions.length; i++) {
    var q = currentQuestions[i];
    var ans = userAnswers[i];
    if (ans === null || ans === undefined || ans === -1) continue;

    if (isSubjectiveQuestion(q)) {
      var correctText = String(q.A || q.answer || '').trim();
      var userText = String(ans).trim();
      if (userText === correctText ||
          (!isNaN(parseFloat(userText)) && parseFloat(userText) === parseFloat(correctText))) {
        count++;
      }
    } else if (parseInt(ans, 10) === parseInt(q.answer, 10)) {
      count++;
    }
  }
  correctCount = count;
  return count;
}

function renderLearnPanel(q, displayAnswer) {
  // 객관식 Learn에서는 정답 선택지가 이미 초록색으로 표시되므로
  // 중복되는 Correct Answer 안내 박스를 출력하지 않는다.
  return '';
}

// ========================================================================
// BLOCK 0700: API 호출 함수 (통합 패키지)
// ========================================================================

// ========================================================================
// BLOCK 0710: updateSetSelector
// ========================================================================
function updateSetSelector() {
  var setSelector = DOM.setSelector;
  if (!setSelector) return;
  while (setSelector.options.length > 0) {
    setSelector.remove(0);
  }
  var configuredTotal = Math.max(0, parseInt(subjectConfig && subjectConfig.QUESTION_COUNT, 10) || 0);
  var totalQuestions = configuredTotal || (TOTAL_QUESTIONS > 0 ? TOTAL_QUESTIONS : 360);
  var totalSets = Math.ceil(totalQuestions / QUESTIONS_PER_SET);
  if (IS_TRIAL_USER) {
    var sampleOption = document.createElement('option');
    sampleOption.value = 'sample';
    sampleOption.textContent = 'SAMPLE (Questions 1-20)';
    setSelector.appendChild(sampleOption);
  }
  for (var i = 1; i <= totalSets; i++) {
    var start = (i - 1) * QUESTIONS_PER_SET + 1;
    var end = Math.min(i * QUESTIONS_PER_SET, totalQuestions);
    var option = document.createElement('option');
    option.value = i;
    option.textContent = (IS_TRIAL_USER ? '🔒 ' : '') + 'Set ' + i + ' (Questions ' + start + '-' + end + ')';
    option.disabled = IS_TRIAL_USER;
    setSelector.appendChild(option);
  }
  var maxStartNumber = Math.max(1, totalQuestions - QUESTIONS_PER_SET + 1);
  if (DOM.maxNumberDisplay) {
    DOM.maxNumberDisplay.innerHTML = maxStartNumber.toLocaleString();
  }
  if (DOM.startNumberInput) {
    DOM.startNumberInput.placeholder = '1 ~ ' + maxStartNumber.toLocaleString();
    DOM.startNumberInput.max = maxStartNumber;
  }
  if (setSelector.options.length > 0) {
    setSelector.value = IS_TRIAL_USER ? 'sample' : '1';
  }
  if (DOM.startNumberInput) {
    DOM.startNumberInput.value = '1';
  }
  var setHint = document.querySelector('.card-new .card-hint');
  if (setHint) {
    setHint.textContent = IS_TRIAL_USER
      ? 'SAMPLE is available now. Locked sets require account approval.'
      : 'Select a set or enter a number';
  }
}

function renderAccountIdentity_() {
  if (!DOM.accountIdentity) return;
  var email = String(currentUser && currentUser.email || '').trim();
  DOM.accountIdentity.textContent = email ? 'Account: ' + email : '';
}

// ========================================================================
// BLOCK 0720: detectTotalQuestions (타임아웃 + fallback)
// ========================================================================
async function detectTotalQuestions() {
    if (TOTAL_QUESTIONS > 0) return TOTAL_QUESTIONS;
    const cached = localStorage.getItem(TOTAL_CACHE_KEY);
    const cachedTime = localStorage.getItem(TOTAL_CACHE_KEY + '_time');
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000;
    const staleCachedTotal = Math.max(0, parseInt(cached, 10) || 0);

    if (cached && cachedTime && (now - parseInt(cachedTime) < CACHE_TTL)) {
        const total = parseInt(cached);
        console.log('✅ Using cached total:', total);
        TOTAL_QUESTIONS = total;
        updateSplash(60, 'Preparing data...');
        return total;
    }

    console.log('🔄 Fetching fresh total...');
    const controller = new AbortController();
    // Apps Script cold starts and token verification can exceed ten seconds.
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    try {
        updateSplash(30, 'Checking total questions...');
        const totalParams = new URLSearchParams();
        totalParams.set('total', 'true');
        totalParams.set('_', String(Date.now()));
        totalParams.set('sheet', DATA_SHEET);
        console.log('📡 Requesting authorized question total');
        
        const response = await fetchQuizApi_(totalParams, controller.signal);
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        const text = await response.text();
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error('HTML response - check Apps Script URL');
        }
        
        const data = JSON.parse(text);
        if (data && (data.status === 'error' || data.success === false)) {
            throwQuizApiError_(data, 'Failed to load question total');
        }
        const total = data.total || 0;
        
        if (total > 0) {
            TOTAL_QUESTIONS = total;
            localStorage.setItem(TOTAL_CACHE_KEY, String(TOTAL_QUESTIONS));
            localStorage.setItem(TOTAL_CACHE_KEY + '_time', String(now));
            console.log('✅ Total questions:', total);
            updateSplash(60, 'Preparing data...');
            return total;
        }
        
        console.warn('⚠️ Could not detect total, using fallback: 1440');
    } catch(e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            console.warn('⏱️ API timeout, using fallback...');
            showToast('서버 응답이 없습니다. 기본값을 사용합니다.', 'warn', 3000);
        } else {
            console.error('❌ Total API call failed:', e.message);
            showToast('문제 수를 불러오지 못했습니다. 기본값을 사용합니다.', 'warn', 3000);
        }
    }
    
    if (staleCachedTotal > 0) {
        TOTAL_QUESTIONS = staleCachedTotal;
        console.warn('Using last known question total:', staleCachedTotal);
        updateSplash(60, 'Preparing data...');
        return TOTAL_QUESTIONS;
    }

    throw new Error('Question count is unavailable for ' + currentSubject);
}

// ========================================================================
// BLOCK 0730: load50Questions (선택지 강화 + 텍스트 처리 + 주관식 지원)
// ========================================================================
let currentAbortController = null;

function isRetryableQuestionLoadError_(error) {
    var code = String(error && error.code || '').toUpperCase();
    if ([
        'SHEET_NOT_ALLOWED',
        'SHEET_NOT_FOUND',
        'CATALOG_NOT_FOUND',
        'AUTH_REQUIRED',
        'AUTH_INVALID',
        'AUTH_EXPIRED'
    ].indexOf(code) !== -1) {
        return false;
    }
    var message = String(error && error.message || '');
    if (/^HTTP 4\d\d\b/.test(message) && !/^HTTP (408|429)\b/.test(message)) {
        return false;
    }
    return true;
}

async function load50Questions(uiStartNumber, retryCount = 0) {
    const MAX_RETRIES = 3;
    if (TOTAL_QUESTIONS === 0) await detectTotalQuestions();
    
    if (currentAbortController) {
        currentAbortController.abort();
        LOG.debug('🛑 Previous request aborted');
    }
    currentAbortController = new AbortController();
    
    const timeoutId = setTimeout(() => {
        if (currentAbortController) currentAbortController.abort();
    }, 15000);
    
    try {
        var requestParams = new URLSearchParams();
        var requestedStart = IS_TRIAL_USER ? TRIAL_START : uiStartNumber;
        var requestedLimit = IS_TRIAL_USER ? TRIAL_LIMIT : QUESTIONS_PER_SET;
        if (IS_TRIAL_USER) {
          uiStartNumber = TRIAL_START;
          currentStartNumber = TRIAL_START;
          if (DOM.startNumberInput) DOM.startNumberInput.value = String(TRIAL_START);
          if (DOM.setSelector) DOM.setSelector.value = 'sample';
        }
        requestParams.set('start', String(requestedStart));
        requestParams.set('limit', String(requestedLimit));
        requestParams.set('_', String(Date.now()));
        requestParams.set('sheet', DATA_SHEET);
        console.log('📡 Requesting authorized questions');
        
        var response = await fetchQuizApi_(requestParams, currentAbortController.signal);
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        var text = await response.text();
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error('HTML response - check Apps Script URL');
        }
        
        var data = JSON.parse(text);
        if (data && (data.status === 'error' || data.success === false)) {
            throwQuizApiError_(data, 'Failed to load questions');
        }
        console.log('📡 Response type:', typeof data);
        console.log('📡 Is array?', Array.isArray(data));
        
        var questionsData = [];
        
        if (Array.isArray(data)) {
            questionsData = data;
            console.log('✅ Data is direct array, length:', questionsData.length);
        } else if (data && typeof data === 'object') {
            if (Array.isArray(data.data)) {
                questionsData = data.data;
                console.log('✅ Found data.data array, length:', questionsData.length);
            } else if (Array.isArray(data.questions)) {
                questionsData = data.questions;
                console.log('✅ Found data.questions array, length:', questionsData.length);
            } else if (Array.isArray(data.items)) {
                questionsData = data.items;
                console.log('✅ Found data.items array, length:', questionsData.length);
            }
        }
        
        if (!Array.isArray(questionsData) || questionsData.length === 0) {
            throw new Error('No question data received');
        }
        
        console.log('✅ Processing ' + questionsData.length + ' questions');
        
        var processed = [];
        for (var idx = 0; idx < questionsData.length; idx++) {
            try {
                var item = questionsData[idx];
                var parsed = item;
                
                if (typeof item === 'string') {
                    try { parsed = JSON.parse(item); } catch(e) { parsed = { question: item, answer: '1' }; }
                }
                if (!parsed || typeof parsed !== 'object') {
                    parsed = { question: String(item), answer: '1' };
                }
                
                // ============================================================
                // ★★★ 표준 다국어 스키마 매핑 (공백/BOM/대소문자 안전) ★★★
                // ============================================================
                var normalizedRow = buildNormalizedRowMap(parsed);

                var localized = {
                    question: {
                        EN: readLocalizedSchemaValue(parsed, normalizedRow, 'Q', 'EN'),
                        KO: readLocalizedSchemaValue(parsed, normalizedRow, 'Q', 'KO')
                    },
                    passage: {
                        EN: readLocalizedSchemaValue(parsed, normalizedRow, 'P', 'EN'),
                        KO: readLocalizedSchemaValue(parsed, normalizedRow, 'P', 'KO')
                    },
                    explanation: {
                        EN: readLocalizedSchemaValue(parsed, normalizedRow, 'E', 'EN'),
                        KO: readLocalizedSchemaValue(parsed, normalizedRow, 'E', 'KO')
                    }
                };
                var sourceCode = readSchemaValue(parsed, normalizedRow, 'SOURCE_CODE') ||
                    readSchemaValue(parsed, normalizedRow, 'SUBJECT') || '';
                var passageVersions = {
                    KJV: readSchemaValue(parsed, normalizedRow, 'P_KJV'),
                    WEB: readSchemaValue(parsed, normalizedRow, 'P_WEB') ||
                        readSchemaValue(parsed, normalizedRow, 'P_EN'),
                    KO_WEB: readSchemaValue(parsed, normalizedRow, 'P_KO_WEB') ||
                        readSchemaValue(parsed, normalizedRow, 'P_KO')
                };

                if (!localized.question.EN) localized.question.EN = 'Question ' + (uiStartNumber + idx);
                if (!localized.passage.EN) localized.passage.EN = '';
                if (!localized.explanation.EN) localized.explanation.EN = 'No explanation available.';

                var choices = {};
                var choiceTranslations = {};
                var hasAnyChoice = false;

                for (var ci = 1; ci <= 4; ci++) {
                    var key = String(ci);
                    var enChoice = readLocalizedSchemaValue(parsed, normalizedRow, key, 'EN');
                    var koChoice = readLocalizedSchemaValue(parsed, normalizedRow, key, 'KO');

                    if (enChoice !== '') {
                        choices[key] = enChoice;
                        choiceTranslations[key] = {
                            EN: enChoice,
                            KO: koChoice || enChoice
                        };
                        hasAnyChoice = true;
                    }
                }

                // 새 표준 스키마 전용:
                // parsed.options / parsed.choices 구포맷 폴백을 사용하지 않는다.
                // 이 폴백이 남아 있으면 영어·한국어가 서로 다른 선택지로 섞일 수 있다.

                if (!hasAnyChoice) {
                    choices = {};
                    choiceTranslations = {};
                    console.log('📝 주관식 문제 감지 - 정답:', parsed.A || parsed.answer || '');
                }

                if (hasAnyChoice && Object.keys(choices).length !== 4) {
                    console.warn('⚠️ 선택지 4개 미완성:', {
                        N: readSchemaValue(parsed, normalizedRow, 'N'),
                        found: Object.keys(choices),
                        row: parsed
                    });
                }

                var finalAnswer = '1';
                var schemaAnswer = readSchemaValue(parsed, normalizedRow, 'A');
                if (schemaAnswer !== undefined && schemaAnswer !== null && schemaAnswer !== '') {
                    finalAnswer = String(schemaAnswer).trim();
                }

                var letterToNum = { A: '1', B: '2', C: '3', D: '4' };
                if (letterToNum[finalAnswer.toUpperCase()]) finalAnswer = letterToNum[finalAnswer.toUpperCase()];

                if (hasAnyChoice && !choices[finalAnswer]) {
                    finalAnswer = Object.keys(choices)[0] || '1';
                    console.warn('⚠️ 정답 위치 보정:', finalAnswer);
                }

                var originalNumber = parsed.N || parsed.originalNumber || parsed.n || (uiStartNumber + idx);
                var isLatex = parsed.latex || parsed.math || parsed.isMath || false;

                var graphicValue = readSchemaValue(parsed, normalizedRow, 'G');
                if (graphicValue === undefined || graphicValue === null) graphicValue = '';

                processed.push({
                    N: originalNumber,
                    subject: readSchemaValue(parsed, normalizedRow, 'SUBJECT') || CURRENT_SUBJECT,
                    sourceCode: sourceCode,
                    question: localized.question.EN,
                    passage: localized.passage.EN,
                    passageVersions: passageVersions,
                    choices: choices,
                    choiceTranslations: choiceTranslations,
                    answer: finalAnswer,
                    explanation: localized.explanation.EN,
                    localized: localized,
                    graphic: graphicValue,
                    originalNumber: originalNumber,
                    A: schemaAnswer !== undefined && schemaAnswer !== null && schemaAnswer !== '' ? schemaAnswer : finalAnswer,
                    difficulty: readSchemaValue(parsed, normalizedRow, 'D') || '',
                    sourceType: readSchemaValue(parsed, normalizedRow, 'SOURCE_TYPE') || '',
                    variantNo: readSchemaValue(parsed, normalizedRow, 'VARIANT_NO') || 0,
                    sourceId: readSchemaValue(parsed, normalizedRow, 'SOURCE_ID') || '',
                    status: readSchemaValue(parsed, normalizedRow, 'STATUS') || '',
                    latex: isLatex,
                    raw: parsed
                });

                if (idx === 0) {
                    console.log('📝 First question mapped:', processed[0]);
                    console.log('📝 Choices:', choices);
                    console.log('🌐 Choice translations:', choiceTranslations);
                    console.log('📝 Answer:', finalAnswer);
                    console.log('📝 hasAnyChoice:', hasAnyChoice);
                }
            } catch(e) {
                console.warn('⚠️ Parse error for item', idx, ':', e);
            }
        }
        
        if (processed.length === 0) {
            throw new Error('No valid question data');
        }
        
        console.log('✅ Successfully parsed ' + processed.length + ' questions');
        console.log('📝 First question preview:', processed[0]);
        return processed;
        
    } catch(err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            LOG.info('🛑 Request aborted or timeout');
            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`🔄 재시도 ${retryCount + 1}/${MAX_RETRIES} (${delay}ms 대기)...`);
                updateQuestionLoadingStatus_('Loading questions...');
                await new Promise(resolve => setTimeout(resolve, delay));
                return load50Questions(uiStartNumber, retryCount + 1);
            }
            throw new Error('Timeout after retries');
        }
        if (!isRetryableQuestionLoadError_(err)) {
            console.error('❌ Non-retryable question request:', err);
            throw err;
        }
        if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.warn(`🔄 재시도 ${retryCount + 1}/${MAX_RETRIES} (${delay}ms 대기)...`);
            updateQuestionLoadingStatus_('Loading questions...');
            await new Promise(resolve => setTimeout(resolve, delay));
            return load50Questions(uiStartNumber, retryCount + 1);
        }
        console.error('❌ Load failed after', MAX_RETRIES, 'retries:', err);
        showToast('문제 데이터를 불러오지 못했습니다. 다시 시도해주세요.', 'error', 5000);
        throw err;
    }
}
// ========================================================================
// BLOCK 0800: 유틸리티 함수 (완전체)
// ========================================================================

// ========================================================================
// BLOCK 0810: escapeHtml
// ========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  if (typeof str !== 'string') str = String(str);
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ========================================================================
// BLOCK 0820: getAnswerLetter
// ========================================================================
function getAnswerLetter(num) {
  var n = parseInt(num);
  if (isNaN(n)) return num;
  var letters = {1:'A',2:'B',3:'C',4:'D'};
  return letters[n] || num;
}

// ========================================================================
// BLOCK 0830: getValidChoiceKeys
// ========================================================================
function getValidChoiceKeys(choices) {
  return Object.keys(choices).filter(function(key) {
    var val = choices[key];
    if (typeof val === 'string') return val && val.trim() !== "";
    return val !== null && val !== undefined && val !== "";
  }).sort(function(a, b) { return Number(a) - Number(b); });
}

// ========================================================================
// BLOCK 0840: hasRealChoices (기존 코드 유지 + 추가 함수들과 통합)
// ========================================================================
function hasRealChoices(q) {
    if (!q || !q.choices) return false;
    
    if (Object.keys(q.choices).length === 0) return false;
    
    var hasNonEmptyChoice = false;
    var choiceValues = Object.values(q.choices);
    for (var i = 0; i < choiceValues.length; i++) {
        var v = choiceValues[i];
        if (typeof v !== 'string') v = String(v);
        var trimmed = v.trim();
        if (trimmed !== "" && 
            trimmed.toLowerCase() !== 'no options' && 
            trimmed.toLowerCase() !== 'no options.' && 
            trimmed !== 'No options' &&
            trimmed !== 'none' &&
            trimmed !== 'N/A') {
            hasNonEmptyChoice = true;
            break;
        }
    }
    if (!hasNonEmptyChoice) return false;
    
    var has1 = q.choices['1'] && q.choices['1'].trim() !== '';
    var has2 = q.choices['2'] && q.choices['2'].trim() !== '';
    var has3 = q.choices['3'] && q.choices['3'].trim() !== '';
    var has4 = q.choices['4'] && q.choices['4'].trim() !== '';
    
    var hasLetterChoices = false;
    var choiceKeys = Object.keys(q.choices);
    for (var j = 0; j < choiceKeys.length; j++) {
        var key = choiceKeys[j];
        var val = q.choices[key];
        if (typeof val === 'string' && val.trim() !== '') {
            if (/^[A-Da-d][)\\.]/.test(val.trim())) {
                hasLetterChoices = true;
                break;
            }
        }
    }
    
    var choiceCount = Object.keys(q.choices).filter(function(k) {
        return q.choices[k] && q.choices[k].trim() !== '';
    }).length;
    
    var answerIsNumeric = false;
    if (q.answer) {
        var ansNum = parseInt(q.answer);
        if (!isNaN(ansNum) && ansNum >= 1 && ansNum <= 4) {
            answerIsNumeric = true;
        }
    }
    
    var isMultipleChoice = (has1 && has2 && has3 && has4) || 
                           hasLetterChoices || 
                           choiceCount >= 3 ||
                           (answerIsNumeric && choiceCount >= 2);
    
    if (isMultipleChoice) {
        console.log('📋 객관식 감지:', {
            has1_2_3_4: has1 && has2 && has3 && has4,
            hasLetterChoices: hasLetterChoices,
            choiceCount: choiceCount,
            answerIsNumeric: answerIsNumeric,
            choices: q.choices
        });
    }
    
    return isMultipleChoice;
}

// ========================================================================
// BLOCK 0850: isSubjectiveQuestion
// ========================================================================
function isSubjectiveQuestion(q) {
  if (!q || !q.choices) return true;
  return !hasRealChoices(q);
}

// ========================================================================
// BLOCK 0860: randomizeChoicesOnly
// ========================================================================
function randomizeChoicesOnly(q) {
    if (!q || !q.choices || !hasRealChoices(q)) return q;
    try {
        var validEntries = Object.entries(q.choices).filter(function(item) {
            return item[1] !== null && item[1] !== undefined && String(item[1]).trim() !== '';
        }).map(function(item) {
            return {
                k: String(item[0]),
                v: String(item[1]),
                translations: (q.choiceTranslations && q.choiceTranslations[String(item[0])]) || { EN: String(item[1]), KO: String(item[1]) }
            };
        });
        if (!validEntries.length) return q;
        var shuffled = validEntries.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = temp;
        }
        var newChoices = {};
        var newTranslations = {};
        shuffled.forEach(function(c, idx) {
            var newKey = String(idx + 1);
            newChoices[newKey] = c.v;
            newTranslations[newKey] = c.translations;
        });
        var originalAns = String(q.answer);
        var correctIdx = shuffled.findIndex(function(c) { return c.k === originalAns; });
        if (correctIdx < 0) return q;
        return { ...q, choices: newChoices, choiceTranslations: newTranslations, answer: String(correctIdx + 1) };
    } catch(e) {
        console.error('Randomize error:', e);
        return q;
    }
}

// ========================================================================
// BLOCK 0900: 퀴즈 네비게이션 (원본 B008)
// ========================================================================
function goNext() {
  if (!bibleQuizVisible) {
    var reading = getBibleReadingPosition_();
    if (reading.position < reading.indexes.length - 1) {
      RendererManager.disposeCurrent();
      currentIndex = reading.indexes[reading.position + 1];
      renderCurrentQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }
  if (currentIndex < currentQuestions.length - 1) {
    RendererManager.disposeCurrent();
    currentIndex++;
    renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function goPrev() {
  if (!bibleQuizVisible) {
    var reading = getBibleReadingPosition_();
    if (reading.position > 0) {
      RendererManager.disposeCurrent();
      currentIndex = reading.indexes[reading.position - 1];
      renderCurrentQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }
  if (currentIndex > 0) {
    RendererManager.disposeCurrent();
    currentIndex--;
    renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function skipQuestion() {
  if (!bibleQuizVisible) {
    goNext();
    return;
  }
  if (userAnswers[currentIndex] === null || userAnswers[currentIndex] === undefined) {
    userAnswers[currentIndex] = -1;
    saveProgress();
  }
  if (currentIndex < currentQuestions.length - 1) {
    RendererManager.disposeCurrent();
    currentIndex++;
    renderCurrentQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function submitSubjective() {
  var input = document.getElementById('subjectiveInput');
  if (!input) return;
  var userAnswer = input.value.trim();
  if (userAnswer === "") {
    alert('Please enter your answer.');
    return;
  }
  var q = currentQuestions[currentIndex];
  var correctAnswer = '';
  if (q.A && q.A !== '') {
    correctAnswer = String(q.A).trim();
  } else if (q.answer && q.answer !== '' && q.answer !== '0') {
    correctAnswer = String(q.answer).trim();
  } else {
    correctAnswer = userAnswer;
  }
  userAnswers[currentIndex] = userAnswer;
  calculateCorrectCount();
  saveProgressImmediate();
  renderCurrentQuestion();

  if (currentMode === 'study') {
    showExplanation();
  }
}

// ========================================================================
// BLOCK 0910: 결과 및 리뷰 (원본 B009)
// ========================================================================
function getWrongSkippedUnansweredIndices() {
  var result = [];
  for (var i = 0; i < currentQuestions.length; i++) {
    var q = currentQuestions[i];
    var ans = userAnswers[i];
    var isUnanswered = (ans === null || ans === undefined);
    var isSkipped = (ans === -1);
    var isSubjective = isSubjectiveQuestion(q);
    var isIncorrect = false;
    if (!isUnanswered && !isSkipped) {
      if (isSubjective) {
        var correctAns = q.A || q.answer || '';
        isIncorrect = !(String(ans).trim() === String(correctAns).trim());
      } else {
        isIncorrect = (ans !== parseInt(q.answer));
      }
    }
    if (isUnanswered || isSkipped || isIncorrect) result.push(i);
  }
  return result;
}

function showResults() {
  if (currentMode === 'exam') examFinished = true;
  calculateCorrectCount();
  saveProgressImmediate();

  if (currentMode === 'learn') {
    var learnedCount = Object.keys(learnRevealed).length;
    DOM.correctCountSpan.innerHTML = learnedCount + ' / ' + currentQuestions.length;
    DOM.accuracyRateSpan.innerHTML = 'Learned';
    DOM.resultGrid.innerHTML =
      '<div class="learn-completion-message">' +
      '<strong>📘 Learn session complete</strong><br>' +
      'Next, repeat this set in Study mode for instant feedback.' +
      '</div>';
    DOM.resultModal.style.display = 'flex';
    return;
  }
  var answeredCount = userAnswers.filter(function(a) { return a !== null && a !== undefined && a !== -1; }).length;
  var accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  DOM.correctCountSpan.innerHTML = correctCount + ' / ' + answeredCount;
  DOM.accuracyRateSpan.innerHTML = accuracy + '%';
  var gridHtml = '<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px;">';
  for (var i = 0; i < currentQuestions.length; i++) {
    var ans = userAnswers[i];
    var isCorrect = (ans !== null && ans !== undefined && ans !== -1 && ans === parseInt(currentQuestions[i].answer));
    var isSkipped = (ans === -1);
    var isUnanswered = (ans === null || ans === undefined);
    var statusClass = isCorrect ? 'correct' : isSkipped ? 'skipped' : isUnanswered ? 'unanswered' : 'incorrect';
    gridHtml += '<div class="result-item ' + statusClass + '" data-qidx="' + i + '">' + (i + 1) + '</div>';
  }
  gridHtml += '</div>';
  DOM.resultGrid.innerHTML = gridHtml;
  DOM.resultGrid.querySelectorAll('.result-item[data-qidx]').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(el.getAttribute('data-qidx'));
      currentIndex = idx;
      DOM.resultModal.style.display = 'none';
      RendererManager.disposeCurrent();
      renderCurrentQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  DOM.resultModal.style.display = 'flex';
}

function showWrongAnswersList() {
  var wrongItems = [];
  for (var i = 0; i < currentQuestions.length; i++) {
    var q = currentQuestions[i];
    var ans = userAnswers[i];
    var isSkipped = (ans === -1);
    var isUnanswered = (ans === null || ans === undefined);
    var isSubjective = isSubjectiveQuestion(q);
    var isIncorrect = false;
    if (!isSkipped && !isUnanswered) {
      if (isSubjective) {
        var correctAns = q.A || q.answer || '';
        isIncorrect = !(String(ans).trim() === String(correctAns).trim());
      } else {
        isIncorrect = (ans !== parseInt(q.answer));
      }
    }
    if (isSkipped || isIncorrect || isUnanswered) {
      var actualNumber = q.originalNumber || (currentStartNumber + i);
      wrongItems.push({ idx: i, actualNumber: actualNumber, q: q, ans: ans, isSkipped: isSkipped, isUnanswered: isUnanswered, isSubjective: isSubjective });
    }
  }
  if (wrongItems.length === 0) {
    alert(LANG.allCorrect);
    return;
  }
  var html = '<p style="margin-bottom:15px;padding:10px;background:#f0f0f0;border-radius:8px;text-align:center;">' +
    LANG.reviewQuestions + ' <strong>' + wrongItems.length + '</strong><br>' +
    LANG.wrongCount + ' ' + wrongItems.filter(function(w) { return !w.isSkipped && !w.isUnanswered; }).length +
    ' | ' + LANG.skippedCount + ' ' + wrongItems.filter(function(w) { return w.isSkipped; }).length +
    ' | ' + LANG.unansweredCount + ' ' + wrongItems.filter(function(w) { return w.isUnanswered; }).length +
    '</p>';
  wrongItems.forEach(function(item) {
    var statusText = item.isSkipped ? LANG.statusSkipped : (item.isUnanswered ? LANG.statusUnanswered : LANG.statusWrong);
    var statusColor = item.isSkipped ? '#f39c12' : (item.isUnanswered ? '#6c757d' : '#e74c3c');
    var userAnswerDisplay = (item.ans === null || item.ans === undefined || item.ans === -1) ? '—' : String(item.ans);
    var correctAnswerDisplay = (item.isSubjective) ? (item.q.A || item.q.answer || '—') : getAnswerLetter(item.q.answer);
    if (!item.isSubjective && !item.isSkipped && !item.isUnanswered) {
      userAnswerDisplay = getAnswerLetter(item.ans);
      correctAnswerDisplay = getAnswerLetter(item.q.answer);
    }
    html += '<div class="wrong-item" style="border-left:5px solid ' + statusColor + '">' +
      '<div style="font-weight:bold;margin-bottom:10px;">' +
      'Question ' + (item.idx + 1) + ' (Original #' + item.actualNumber + ')' +
      '<span class="status-badge" style="background:' + statusColor + ';">' + statusText + '</span>' +
      (item.isSubjective ? ' Subjective' : '') +
      '</div>' +
      '<div style="margin-bottom:12px;"><strong>' + escapeHtml(item.q.question) + '</strong></div>' +
      '<div style="margin-top:12px;padding:10px;background:#f8f9fa;border-radius:8px;">' +
      '<strong>Your answer:</strong> ' + escapeHtml(String(userAnswerDisplay)) +
      '<br><strong>Correct answer:</strong> ' + escapeHtml(String(correctAnswerDisplay)) +
      '</div>' +
      '<div style="margin-top:12px;padding:10px;background:#e8f4fc;border-radius:8px;">' +
      '<strong>Explanation</strong><br>' + escapeHtml(item.q.explanation || LANG.noExplanation) +
      '</div>' +
      '</div>';
  });
  DOM.wrongListDiv.innerHTML = html;
  DOM.wrongModal.style.display = 'flex';
}

function startWrongOnlyReview() {
  var indices = getWrongSkippedUnansweredIndices();
  if (indices.length === 0) {
    alert(LANG.allCorrect);
    return;
  }
  var reviewQuestions = indices.map(function(idx) {
    return currentQuestions[idx];
  });
  currentQuestions = reviewQuestions.slice();
  userAnswers = new Array(currentQuestions.length).fill(null);
  correctCount = 0;
  currentIndex = 0;
  isReviewMode = true;
  DOM.reviewBanner.style.display = 'block';
  DOM.reviewBanner.innerHTML = '<span>Review Mode: ' + currentQuestions.length + ' questions</span>' +
    '<button id="exitReviewBtn" class="exit-review-btn">EXIT REVIEW</button>';
  document.getElementById('exitReviewBtn').addEventListener('click', function() {
    clearProgress();
    window.location.reload();
  });
  DOM.wrongModal.style.display = 'none';
  DOM.resultModal.style.display = 'none';
  RendererManager.disposeCurrent();
  renderCurrentQuestion();
  saveProgress();
}

// ========================================================================
// BLOCK 1000: 타이머 함수 (원본 B010)
// ========================================================================
var TIMER_DEFAULT_SECONDS = 0;
var timerConfiguredSeconds = TIMER_DEFAULT_SECONDS;
var timerSeconds = timerConfiguredSeconds;
var timerInterval = null;
var timerRunning = false;
var timerPaused = false;
var timerEndsAt = 0;
var quizToolsInitialized = false;
var calculatorState = { expression: '', answer: 0, memory: 0, angle: 'DEG', justEvaluated: false };

function formatTimer(seconds) {
  var hrs = Math.floor(seconds / 3600);
  var mins = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;
  return String(hrs).padStart(2, '0') + ':' + 
         String(mins).padStart(2, '0') + ':' + 
         String(secs).padStart(2, '0');
}

function updateTimerDisplay() {
  var formatted = formatTimer(timerSeconds);
  if (DOM.timerDisplay) {
    DOM.timerDisplay.textContent = formatted;
    DOM.timerDisplay.classList.toggle('warning', timerSeconds > 0 && timerSeconds < 300);
  }
  if (DOM.calculatorTimerMirror) DOM.calculatorTimerMirror.textContent = formatted;
  if (DOM.headerTimerDisplay) DOM.headerTimerDisplay.textContent = formatted;
  if (DOM.timerToggle) {
    var examMode = currentMode === 'exam';
    DOM.timerToggle.hidden = !examMode;
    DOM.timerToggle.style.display = examMode ? 'flex' : 'none';
    DOM.timerToggle.style.visibility = 'visible';
    DOM.timerToggle.style.opacity = '1';
    DOM.timerToggle.setAttribute('aria-hidden', examMode ? 'false' : 'true');
    DOM.timerToggle.tabIndex = examMode ? 0 : -1;
  }
  if (DOM.timerPauseBtn) DOM.timerPauseBtn.textContent = timerRunning ? '⏸ Pause' : (timerPaused ? '▶ Resume' : '▶ Start');
}

function startTimer() {
  if (timerInterval || timerSeconds <= 0) return;
  timerRunning = true;
  timerPaused = false;
  timerEndsAt = Date.now() + timerSeconds * 1000;
  updateTimerDisplay();
  timerInterval = setInterval(function() {
    timerSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
    updateTimerDisplay();
    if (timerSeconds === 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
      timerPaused = false;
      updateTimerDisplay();
      alert('⏰ Time is up!');
    }
  }, 250);
}

function pauseTimer() {
  if (timerInterval) {
    timerSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerPaused = true;
  } else if (timerPaused) {
    startTimer();
    return;
  } else {
    startTimer();
  }
  updateTimerDisplay();
}

function resetTimer(clearConfiguration) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (clearConfiguration === true) {
    timerConfiguredSeconds = 0;
    timerEndsAt = 0;
    if (DOM.timerHours) DOM.timerHours.value = '0';
    if (DOM.timerMinutes) DOM.timerMinutes.value = '0';
    if (DOM.timerSecondsInput) DOM.timerSecondsInput.value = '0';
  }
  timerSeconds = clearConfiguration === true ? 0 : timerConfiguredSeconds;
  timerRunning = false;
  timerPaused = false;
  updateTimerDisplay();
}

function setTimerFromInputs() {
  var hours = Math.max(0, Math.min(99, parseInt(DOM.timerHours && DOM.timerHours.value, 10) || 0));
  var minutes = Math.max(0, Math.min(59, parseInt(DOM.timerMinutes && DOM.timerMinutes.value, 10) || 0));
  var seconds = Math.max(0, Math.min(59, parseInt(DOM.timerSecondsInput && DOM.timerSecondsInput.value, 10) || 0));
  var total = hours * 3600 + minutes * 60 + seconds;
  timerConfiguredSeconds = total;
  if (DOM.timerHours) DOM.timerHours.value = hours;
  if (DOM.timerMinutes) DOM.timerMinutes.value = minutes;
  if (DOM.timerSecondsInput) DOM.timerSecondsInput.value = seconds;
  resetTimer();
  if (DOM.timerPanel) DOM.timerPanel.hidden = false;
  if (DOM.timerToggle) DOM.timerToggle.setAttribute('aria-expanded', 'true');
}

function closeQuizTools() {
  [DOM.calculatorPanel, DOM.timerPanel].forEach(function(panel) { if (panel) panel.hidden = true; });
  [DOM.calculatorToggle, DOM.timerToggle].forEach(function(button) { if (button) button.setAttribute('aria-expanded', 'false'); });
}

function toggleQuizTool(panel, button) {
  var shouldOpen = !!(panel && panel.hidden);
  closeQuizTools();
  if (shouldOpen) {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    var focusTarget = panel === DOM.calculatorPanel ? DOM.calculatorDisplay : DOM.timerPauseBtn;
    if (focusTarget) focusTarget.focus();
  }
}

function normalizeCalculatorExpression(expression) {
  var source = String(expression || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!/^[0-9+\-*/^().,%!\s_a-zA-Zπ√]+$/.test(source)) throw new Error('Unsupported input');
  source = source.replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/\bans\b/gi, '(' + calculatorState.answer + ')');
  source = source.replace(/(\d+(?:\.\d+)?|\))%/g, '($1/100)');
  if (calculatorState.angle === 'DEG') {
    source = source.replace(/\b(sin|cos|tan)\s*\(/g, '$1(pi/180*');
    source = source.replace(/\b(asin|acos|atan)\s*\(([^()]*)\)/g, '(180/pi*$1($2))');
  }
  return source;
}

function safeArithmeticFallback(expression) {
  var source = expression.replace(/\s+/g, '');
  if (!/^[0-9.+\-*/^()]+$/.test(source)) throw new Error('Scientific functions require Math.js');
  var tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/^]/g) || [];
  if (tokens.join('') !== source) throw new Error('Invalid expression');
  var output = [], operators = [], precedence = { '+':1, '-':1, '*':2, '/':2, '^':3, 'u-':4 }, previous = 'operator';
  tokens.forEach(function(token) {
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) { output.push(Number(token)); previous = 'number'; return; }
    if (token === '(') { operators.push(token); previous = 'operator'; return; }
    if (token === ')') { while (operators.length && operators[operators.length - 1] !== '(') output.push(operators.pop()); if (operators.pop() !== '(') throw new Error('Parenthesis'); previous = 'number'; return; }
    var op = token === '-' && previous !== 'number' ? 'u-' : token;
    while (operators.length && operators[operators.length - 1] !== '(' && ((op === '^' || op === 'u-') ? precedence[operators[operators.length - 1]] > precedence[op] : precedence[operators[operators.length - 1]] >= precedence[op])) output.push(operators.pop());
    operators.push(op); previous = 'operator';
  });
  while (operators.length) { var remaining = operators.pop(); if (remaining === '(') throw new Error('Parenthesis'); output.push(remaining); }
  var stack = [];
  output.forEach(function(item) { if (typeof item === 'number') stack.push(item); else if (item === 'u-') stack.push(-stack.pop()); else { var b = stack.pop(), a = stack.pop(); if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Operand'); stack.push(item === '+' ? a+b : item === '-' ? a-b : item === '*' ? a*b : item === '/' ? a/b : Math.pow(a,b)); } });
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Invalid result');
  return stack[0];
}

function evaluateCalculator() {
  var raw = DOM.calculatorDisplay ? DOM.calculatorDisplay.value : calculatorState.expression;
  try {
    var normalized = normalizeCalculatorExpression(raw);
    var result = window.math && typeof window.math.evaluate === 'function' ? window.math.evaluate(normalized) : safeArithmeticFallback(normalized);
    if (result && typeof result === 'object' && typeof result.toNumber === 'function') result = result.toNumber();
    if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('Invalid result');
    calculatorState.answer = Number(result.toPrecision(14));
    calculatorState.expression = String(calculatorState.answer);
    calculatorState.justEvaluated = true;
    if (DOM.calculatorExpression) DOM.calculatorExpression.textContent = raw + ' =';
    if (DOM.calculatorDisplay) DOM.calculatorDisplay.value = calculatorState.expression;
  } catch (error) {
    calculatorState.justEvaluated = true;
    if (DOM.calculatorExpression) DOM.calculatorExpression.textContent = 'Invalid expression';
    if (DOM.calculatorDisplay) DOM.calculatorDisplay.value = 'Error';
  }
}

function appendCalculatorValue(value) {
  if (!DOM.calculatorDisplay) return;
  var current = DOM.calculatorDisplay.value;
  if (current === '0' || current === 'Error' || calculatorState.justEvaluated && /^[0-9.(a-z]/i.test(value)) current = '';
  calculatorState.justEvaluated = false;
  DOM.calculatorDisplay.value = current + value;
  calculatorState.expression = DOM.calculatorDisplay.value;
}

function handleCalculatorAction(action) {
  if (!DOM.calculatorDisplay) return;
  if (action === 'equals') return evaluateCalculator();
  if (action === 'clear') { calculatorState.expression = ''; calculatorState.justEvaluated = false; DOM.calculatorDisplay.value = '0'; if (DOM.calculatorExpression) DOM.calculatorExpression.textContent = ''; return; }
  if (action === 'backspace') { DOM.calculatorDisplay.value = DOM.calculatorDisplay.value.length > 1 ? DOM.calculatorDisplay.value.slice(0,-1) : '0'; return; }
  if (action === 'sign') { DOM.calculatorDisplay.value = DOM.calculatorDisplay.value.charAt(0) === '-' ? DOM.calculatorDisplay.value.slice(1) : '-(' + DOM.calculatorDisplay.value + ')'; return; }
  if (action === 'angle') { calculatorState.angle = calculatorState.angle === 'DEG' ? 'RAD' : 'DEG'; var angleButton = document.getElementById('calculatorAngleMode'); if (angleButton) angleButton.textContent = calculatorState.angle; return; }
  if (action === 'memory-clear') calculatorState.memory = 0;
  if (action === 'memory-recall') appendCalculatorValue(String(calculatorState.memory));
  if (action === 'memory-add' || action === 'memory-subtract') { evaluateCalculator(); calculatorState.memory += (action === 'memory-add' ? 1 : -1) * calculatorState.answer; }
}

function initTimer() {
  if (quizToolsInitialized) return;
  quizToolsInitialized = true;
  updateTimerDisplay();
  if (DOM.timerPauseBtn) DOM.timerPauseBtn.addEventListener('click', function() {
    pauseTimer();
    if (timerRunning) {
      if (DOM.timerPanel) DOM.timerPanel.hidden = true;
      if (DOM.timerToggle) DOM.timerToggle.setAttribute('aria-expanded', 'false');
      updateTimerDisplay();
    }
  });
  if (DOM.timerResetBtn) DOM.timerResetBtn.addEventListener('click', function() {
    resetTimer(true);
  });
  if (DOM.timerSetBtn) DOM.timerSetBtn.addEventListener('click', setTimerFromInputs);
  [DOM.timerHours, DOM.timerMinutes, DOM.timerSecondsInput].forEach(function(input) {
    if (!input) return;
    input.addEventListener('focus', function() { this.select(); });
    input.addEventListener('click', function() { this.select(); });
  });
  if (DOM.calculatorToggle) DOM.calculatorToggle.addEventListener('click', function() { toggleQuizTool(DOM.calculatorPanel, DOM.calculatorToggle); });
  if (DOM.timerToggle) DOM.timerToggle.addEventListener('click', function() { toggleQuizTool(DOM.timerPanel, DOM.timerToggle); });
  document.querySelectorAll('[data-close-tool]').forEach(function(button) { button.addEventListener('click', closeQuizTools); });
  if (DOM.calculatorPanel) DOM.calculatorPanel.addEventListener('click', function(event) { var button = event.target.closest('button'); if (!button) return; if (button.dataset.calcValue !== undefined) appendCalculatorValue(button.dataset.calcValue); else if (button.dataset.calcAction) handleCalculatorAction(button.dataset.calcAction); });
  if (DOM.calculatorDisplay) DOM.calculatorDisplay.addEventListener('input', function() { calculatorState.expression = this.value; calculatorState.justEvaluated = false; });
  document.addEventListener('keydown', function(event) {
    var calculatorOpen = DOM.calculatorPanel && !DOM.calculatorPanel.hidden;
    var timerOpen = DOM.timerPanel && !DOM.timerPanel.hidden;
    if (event.key === 'Escape' && (calculatorOpen || timerOpen)) { event.preventDefault(); closeQuizTools(); return; }
    if (!calculatorOpen || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); evaluateCalculator(); }
  });
}

// ========================================================================
// BLOCK 1105: 혼합 문장 안의 지수식 안전 처리
// ========================================================================
function wrapPowerExpressionsSafely(text) {
    if (!text || typeof text !== 'string') return text || '';

    // 기존 MathJax 구간과 HTML 태그는 그대로 보호한다.
    var protectedParts = [];
    var protectedText = text.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$[^$]*\$|<[^>]+>/g, function(match) {
        protectedParts.push(match);
        return '%%SAFE' + (protectedParts.length - 1) + '%%';
    });

    // 혼합 문장 안의 간단한 지수는 MathJax에 보내지 않고 HTML <sup>로 표시한다.
    // 예: 2.2^x → 2.2<sup>x</sup>, x^{2} → x<sup>2</sup>
    protectedText = protectedText.replace(
        /((?:\d+(?:\.\d+)?|[A-Za-z]|\([^()\n]+\))\s*)\^\s*(\{[^{}\n]+\}|[A-Za-z0-9]+)(?![A-Za-z0-9}])/g,
        function(match, base, exponent) {
            var exp = exponent;
            if (exp.charAt(0) === '{' && exp.charAt(exp.length - 1) === '}') {
                exp = exp.slice(1, -1);
            }
            return base.trim() + '<sup>' + exp + '</sup>';
        }
    );

    protectedText = protectedText
        .replace(/((?:\d+(?:\.\d+)?|[A-Za-z]|\([^()\n]+\)))²/g, '$1<sup>2</sup>')
        .replace(/((?:\d+(?:\.\d+)?|[A-Za-z]|\([^()\n]+\)))³/g, '$1<sup>3</sup>');

    return protectedText.replace(/%%SAFE(\d+)%%/g, function(match, idx) {
        return protectedParts[parseInt(idx, 10)] || match;
    });
}

// ========================================================================
// BLOCK 1110: autoWrapLatex (수정본 - 일반 텍스트 오감지 방지 + 제곱符号 지원)
// ========================================================================
function autoWrapLatex(text) {
    if (!text) return text;
    if (text.includes('\\(') || text.includes('$')) return wrapPowerExpressionsSafely(text);

    // 문장 전체를 MathJax로 감싸지 않는다. 혼합 문장에서는 지수식만 처리한다.
    var wordCount = (String(text).match(/[A-Za-z가-힣]+/g) || []).length;
    if (wordCount > 6 || /[.!?]|[가-힣]/.test(text)) {
        return wrapPowerExpressionsSafely(text);
    }
    
    // 1. 일반 텍스트 패턴 (먼저 체크 - 통과시키기)
    const textPatterns = [
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*$/,
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*[.!?]?$/,
        /^[A-Za-z0-9\s,.'"!?\-]+$/,
        /^[0-9]+(?:\.[0-9]+)?\s*(?:km|m|kg|mi|ft|in|cm|mm|해리|킬로미터)s?$/,
        /^[A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+/,
        /^(?:to|for|of|with|from|by|in|at|on|and|or|but|nor|for|yet|so)\s/i,
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*[;:]/,
        /^[A-Z][a-z]+[,]/,
        /^[A-Za-z]+['’][A-Za-z]+/,
        /^How\s+[A-Za-z]/,
        /^What\s+[A-Za-z]/,
        /^Which\s+[A-Za-z]/,
        /^Why\s+[A-Za-z]/,
        /^When\s+[A-Za-z]/,
        /^Where\s+[A-Za-z]/,
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*\?$/,
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*[.!?]$/,
        /^[A-Z][a-z]+(?:[ ][A-Z][a-z]+)*\s+/,
    ];
    
    for (var i = 0; i < textPatterns.length; i++) {
        if (textPatterns[i].test(text)) {
            return text;
        }
    }
    
    // 2. 수식 패턴 (엄격하게 - 실제 수식만)
    const mathPatterns = [
        /\\sqrt\{[^}]+\}/,
        /\\frac\{[^}]+\}\{[^}]+\}/,
        /\\sum_[^{]+\}\^{[^}]+\}/,
        /\\int_[^{]+\}\^{[^}]+\}/,
        /\\lim_[^{]+\}/,
        /\\binom\{[^}]+\}\{[^}]+\}/,
        /\\begin\{[a-z]+\}/,
        /\\bar\{[^}]+\}/,
        /\\hat\{[^}]+\}/,
        /\\vec\{[^}]+\}/,
        /\\overrightarrow\{[^}]+\}/,
        /\\sin\^\{?2\}?/,
        /\\cos\^\{?2\}?/,
        /\\tan\^\{?2\}?/,
        /\\left\([^)]*\\right\)/,
        /\\{.*?\\}/,
        /[a-zA-Z]\^\{?[0-9a-zA-Z]+\}?(?:\s|$)/,
        /[a-zA-Z]_\{[0-9a-zA-Z]+\}/,
        /[0-9]+\^\{?[0-9]+\}?/,
        /²/,
        /³/,
        /[0-9]²/,
        /[a-zA-Z]²/,
        /\([^)]+\)²/,
        /\([^)]+\s*[=≠<>≤≥]\s*[^)]+\)/,
        /\{[^}]+\s*[=≠<>≤≥]\s*[^}]+\}/,
        /[0-9]+\s*[+\-*/]\s*[0-9]+/,
        /[a-zA-Z]\s*[=≠<>≤≥]\s*[0-9a-zA-Z]+/,
    ];
    
    for (var i = 0; i < mathPatterns.length; i++) {
        if (mathPatterns[i].test(text)) {
            return '\\(' + text + '\\)';
        }
    }
    
    return text;
}

// ========================================================================
// BLOCK 1120: detectMathQuestion (수학 문제 감지)
// ========================================================================
function detectMathQuestion(q) {
    if (!q) return false;
    
    var questionText = q.question || '';
    var mathIndicators = [
        /[=≠<>≤≥]/,
        /[0-9]+[.\s]*[=≠<>≤≥]/,
        /[a-zA-Z]\^/,
        /[a-zA-Z]_/,
        /sqrt|frac|sum|int/,
        /sin|cos|tan|log|ln/,
        /[0-9]+\s*[+\-*/]\s*[0-9]+/,
        /\([^)]+\s*[=≠<>≤≥]\s*[^)]+\)/,
        /\\[a-zA-Z]+/,
        /\$.*\$/,
        /\\\(.*\\\)/
    ];
    
    for (var i = 0; i < mathIndicators.length; i++) {
        if (mathIndicators[i].test(questionText)) {
            return true;
        }
    }
    
    if (q.choices) {
        var choiceValues = Object.values(q.choices);
        for (var j = 0; j < choiceValues.length; j++) {
            var choice = String(choiceValues[j] || '');
            for (var k = 0; k < mathIndicators.length; k++) {
                if (mathIndicators[k].test(choice)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// ========================================================================
// BLOCK 1130: renderWithEditingMarks (Writing 편집 마크업)
// ========================================================================
function renderWithEditingMarks(text, isMath) {
    if (!text) return text;
    var html = text;
    
    // SAT Writing 편집 표시
    html = html.replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>');
    html = html.replace(/\[s\](.*?)\[\/s\]/g, '<del>$1</del>');
    html = html.replace(/\[i\](.*?)\[\/i\]/g, '<ins>$1</ins>');
    html = html.replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>');
    html = html.replace(/\[em\](.*?)\[\/em\]/g, '<em>$1</em>');
    html = html.replace(/\[underline\](.*?)\[\/underline\]/g,
        '<span style="text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px;">$1</span>');
    html = html.replace(/\[(\d+)\]/g,
        '<sup style="color:#3498db;font-weight:bold;font-size:0.8em;">[$1]</sup>');
    
    // 수식이면 LaTeX 처리
    if (isMath) {
        var tagPlaceholders = [];
        html = html.replace(/<[^>]+>/g, function(match) {
            tagPlaceholders.push(match);
            return '%%TAG' + (tagPlaceholders.length - 1) + '%%';
        });
        html = autoWrapLatex(html);
        html = html.replace(/%%TAG(\d+)%%/g, function(match, idx) {
            return tagPlaceholders[parseInt(idx)] || match;
        });
    }
    return html;
}

// ========================================================================
// BLOCK 1200: 그래픽 렌더러 (SAT 모든 타입 지원)
// ========================================================================

// ========================================================================
// BLOCK 1210: 그래픽 데이터 검증 및 유틸리티
// ========================================================================

// ========================================================================
// BLOCK 1211: 안전한 숫자/배열 변환
// ========================================================================
function safeNumber(val, defaultVal) {
    if (val === undefined || val === null || isNaN(Number(val))) return defaultVal;
    return Number(val);
}

function safeArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch(e) {}
        return val.split(',').map(v => Number(v.trim())).filter(v => !isNaN(v));
    }
    return [];
}

// ========================================================================
// BLOCK 1212: 좌표계 및 스크린 변환 유틸리티
// ========================================================================
function createCoordinateSystem(ctx, w, h, minX, maxX, minY, maxY) {
    var padding = 40;
    var graphW = w - padding * 2;
    var graphH = h - padding * 2;
    
    function toScreen(px, py) {
        var sx = padding + ((px - minX) / (maxX - minX)) * graphW;
        var sy = padding + graphH - ((py - minY) / (maxY - minY)) * graphH;
        return { x: sx, y: sy };
    }
    
    function drawGrid() {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (var x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
            if (Math.abs(x) < 0.001) continue;
            var pos = toScreen(x, 0);
            ctx.beginPath();
            ctx.moveTo(pos.x, padding);
            ctx.lineTo(pos.x, padding + graphH);
            ctx.stroke();
        }
        for (var y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
            if (Math.abs(y) < 0.001) continue;
            var pos = toScreen(0, y);
            ctx.beginPath();
            ctx.moveTo(padding, pos.y);
            ctx.lineTo(padding + graphW, pos.y);
            ctx.stroke();
        }
    }
    
    function drawAxes() {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        var origin = toScreen(0, 0);
        if (origin.x >= padding && origin.x <= padding + graphW) {
            ctx.beginPath();
            ctx.moveTo(origin.x, padding);
            ctx.lineTo(origin.x, padding + graphH);
            ctx.stroke();
        }
        if (origin.y >= padding && origin.y <= padding + graphH) {
            ctx.beginPath();
            ctx.moveTo(padding, origin.y);
            ctx.lineTo(padding + graphW, origin.y);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#333';
        if (origin.x >= padding && origin.x <= padding + graphW) {
            ctx.beginPath();
            ctx.moveTo(origin.x, padding);
            ctx.lineTo(origin.x - 6, padding + 8);
            ctx.lineTo(origin.x + 6, padding + 8);
            ctx.fill();
        }
        if (origin.y >= padding && origin.y <= padding + graphH) {
            ctx.beginPath();
            ctx.moveTo(padding + graphW, origin.y);
            ctx.lineTo(padding + graphW - 8, origin.y - 6);
            ctx.lineTo(padding + graphW - 8, origin.y + 6);
            ctx.fill();
        }
    }
    
    return {
        toScreen: toScreen,
        drawGrid: drawGrid,
        drawAxes: drawAxes,
        padding: padding,
        graphW: graphW,
        graphH: graphH
    };
}

// ========================================================================
// BLOCK 1213: Canvas 초기화 유틸리티
// ========================================================================
function initCanvas(canvasId, width, height) {
    return new Promise(function(resolve) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) { resolve(null); return; }
        
        var dpr = window.devicePixelRatio || 1;
        var w = canvas.parentElement.clientWidth || width || 600;
        var h = height || 400;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        if (window.RendererManager) {
            RendererManager.registerCanvas(canvas);
        }
        resolve({ canvas: canvas, ctx: ctx, w: w, h: h });
    });
}

// ========================================================================
// BLOCK 1220: 도형/기하 렌더러 (graphic, shape)
// ========================================================================

// ========================================================================
// BLOCK 1221: graphic 타입 렌더러
// ========================================================================
function renderGraphicType(parsedData) {
    var canvasId = 'graphic_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;position:relative;">' +
        '<canvas id="' + canvasId + '" style="width:100%;height:400px;display:block;border-radius:4px;"></canvas>' +
        '</div>';
    
    setTimeout(function() {
        initCanvas(canvasId, 600, 400).then(function(result) {
            if (!result) return;
            var ctx = result.ctx, w = result.w, h = result.h;
            var objects = parsedData.objects;
            
            var allPoints = [];
            objects.forEach(function(obj) {
                if (obj.from) allPoints.push(obj.from);
                if (obj.to) allPoints.push(obj.to);
                if (obj.vertex) allPoints.push(obj.vertex);
                if (obj.x !== undefined && obj.y !== undefined) allPoints.push({x: obj.x, y: obj.y});
                if (obj.center) allPoints.push(obj.center);
            });
            
            var minX = 0, maxX = 20, minY = 0, maxY = 20;
            if (allPoints.length > 0) {
                var xs = allPoints.map(function(p) { return p.x; });
                var ys = allPoints.map(function(p) { return p.y; });
                minX = Math.min.apply(null, xs) - 1;
                maxX = Math.max.apply(null, xs) + 1;
                minY = Math.min.apply(null, ys) - 1;
                maxY = Math.max.apply(null, ys) + 1;
                if (maxX - minX < 5) { var cx = (minX + maxX) / 2; minX = cx - 3; maxX = cx + 3; }
                if (maxY - minY < 5) { var cy = (minY + maxY) / 2; minY = cy - 3; maxY = cy + 3; }
            }
            
            var coord = createCoordinateSystem(ctx, w, h, minX, maxX, minY, maxY);
            var toScreen = coord.toScreen;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            coord.drawGrid();
            coord.drawAxes();
            
            objects.forEach(function(obj) {
                switch(obj.type) {
                    case 'segment':
                        var from = toScreen(obj.from.x, obj.from.y);
                        var to = toScreen(obj.to.x, obj.to.y);
                        ctx.beginPath();
                        ctx.moveTo(from.x, from.y);
                        ctx.lineTo(to.x, to.y);
                        ctx.strokeStyle = obj.style?.stroke || '#2c3e50';
                        ctx.lineWidth = obj.style?.strokeWidth || 2;
                        ctx.stroke();
                        break;
                    case 'rightAngle':
                        var v = toScreen(obj.vertex.x, obj.vertex.y);
                        var size = obj.size || 0.8;
                        var neighbors = [];
                        objects.forEach(function(other) {
                            if (other.type === 'segment') {
                                var fromP = other.from;
                                var toP = other.to;
                                if (fromP.x === obj.vertex.x && fromP.y === obj.vertex.y) neighbors.push(toP);
                                if (toP.x === obj.vertex.x && toP.y === obj.vertex.y) neighbors.push(fromP);
                            }
                        });
                        if (neighbors.length >= 2) {
                            var n1 = toScreen(neighbors[0].x, neighbors[0].y);
                            var n2 = toScreen(neighbors[1].x, neighbors[1].y);
                            var dx1 = n1.x - v.x, dy1 = n1.y - v.y;
                            var dx2 = n2.x - v.x, dy2 = n2.y - v.y;
                            var len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                            var len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
                            if (len1 > 0 && len2 > 0) {
                                var ratio = size / len1;
                                var p1x = v.x + dx1 * ratio;
                                var p1y = v.y + dy1 * ratio;
                                ratio = size / len2;
                                var p2x = v.x + dx2 * ratio;
                                var p2y = v.y + dy2 * ratio;
                                var p3x = p1x + p2x - v.x;
                                var p3y = p1y + p2y - v.y;
                                ctx.beginPath();
                                ctx.moveTo(p1x, p1y);
                                ctx.lineTo(p3x, p3y);
                                ctx.lineTo(p2x, p2y);
                                ctx.strokeStyle = '#2c3e50';
                                ctx.lineWidth = 1.5;
                                ctx.stroke();
                            }
                        }
                        break;
                    case 'text':
                        var pos = toScreen(obj.x, obj.y);
                        ctx.fillStyle = obj.color || '#2c3e50';
                        ctx.font = (obj.fontSize || 16) + 'px sans-serif';
                        ctx.textAlign = obj.align || 'center';
                        ctx.textBaseline = obj.baseline || 'middle';
                        if (obj.rotation) {
                            ctx.save();
                            ctx.translate(pos.x, pos.y);
                            ctx.rotate(obj.rotation * Math.PI / 180);
                            ctx.fillText(obj.text, 0, 0);
                            ctx.restore();
                        } else {
                            ctx.fillText(obj.text, pos.x, pos.y);
                        }
                        break;
                }
            });
        });
    }, 100);
    
    return html;
}

// ========================================================================
// BLOCK 1222: shape 타입 렌더러 (문자열 ID 지원)
// ========================================================================
function renderShapeType(parsedData) {
    var canvasId = 'shape_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;position:relative;">' +
        '<canvas id="' + canvasId + '" style="width:100%;height:400px;display:block;border-radius:4px;"></canvas>' +
        '</div>';
    
    setTimeout(function() {
        initCanvas(canvasId, 600, 400).then(function(result) {
            if (!result) return;
            var ctx = result.ctx, w = result.w, h = result.h;
            
            var pointMap = {};
            parsedData.points.forEach(function(p) {
                var id = p.id;
                if (id !== undefined && id !== null) pointMap[String(id)] = p;
            });
            
            var allPoints = parsedData.points.map(function(p) { return {x: p.x, y: p.y}; });
            var minX = Math.min.apply(null, allPoints.map(function(p) { return p.x; })) - 1;
            var maxX = Math.max.apply(null, allPoints.map(function(p) { return p.x; })) + 1;
            var minY = Math.min.apply(null, allPoints.map(function(p) { return p.y; })) - 1;
            var maxY = Math.max.apply(null, allPoints.map(function(p) { return p.y; })) + 1;
            if (maxX - minX < 5) { var cx = (minX + maxX) / 2; minX = cx - 3; maxX = cx + 3; }
            if (maxY - minY < 5) { var cy = (minY + maxY) / 2; minY = cy - 3; maxY = cy + 3; }
            
            var coord = createCoordinateSystem(ctx, w, h, minX, maxX, minY, maxY);
            var toScreen = coord.toScreen;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            if (parsedData.segments) {
                parsedData.segments.forEach(function(seg) {
                    var fromPt = pointMap[String(seg.from)];
                    var toPt = pointMap[String(seg.to)];
                    if (!fromPt || !toPt) return;
                    var from = toScreen(fromPt.x, fromPt.y);
                    var to = toScreen(toPt.x, toPt.y);
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.strokeStyle = seg.stroke || '#2c3e50';
                    ctx.lineWidth = seg.lineWidth || 2;
                    ctx.stroke();
                });
            }
            
            if (parsedData.angles) {
                parsedData.angles.forEach(function(a) {
                    var v = pointMap[String(a.vertex)];
                    if (!v) return;
                    var vScreen = toScreen(v.x, v.y);
                    var sides = a.sides || [];
                    if (sides.length >= 2) {
                        var p1 = pointMap[String(sides[0])];
                        var p2 = pointMap[String(sides[1])];
                        if (!p1 || !p2) return;
                        var p1s = toScreen(p1.x, p1.y);
                        var p2s = toScreen(p2.x, p2.y);
                        var angle1 = Math.atan2(p1s.y - vScreen.y, p1s.x - vScreen.x);
                        var angle2 = Math.atan2(p2s.y - vScreen.y, p2s.x - vScreen.x);
                        var radius = a.radius || 30;
                        var startA = Math.min(angle1, angle2);
                        var endA = Math.max(angle1, angle2);
                        if (endA - startA > Math.PI) {
                            var temp = startA;
                            startA = endA;
                            endA = temp + 2 * Math.PI;
                        }
                        ctx.beginPath();
                        ctx.arc(vScreen.x, vScreen.y, radius, startA, endA);
                        ctx.strokeStyle = a.color || '#e74c3c';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        if (a.label) {
                            var midA = (startA + endA) / 2;
                            var labelR = radius + 18;
                            var lx = vScreen.x + labelR * Math.cos(midA);
                            var ly = vScreen.y + labelR * Math.sin(midA);
                            ctx.fillStyle = '#e74c3c';
                            ctx.font = '14px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(a.label, lx, ly);
                        }
                    }
                });
            }
            
            parsedData.points.forEach(function(p) {
                var screen = toScreen(p.x, p.y);
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, p.radius || 5, 0, 2 * Math.PI);
                ctx.fillStyle = p.color || '#3498db';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
            
            if (parsedData.labels) {
                parsedData.labels.forEach(function(l) {
                    var pos = toScreen(l.x, l.y);
                    ctx.fillStyle = l.color || '#2c3e50';
                    ctx.font = (l.fontSize || 14) + 'px sans-serif';
                    ctx.textAlign = l.align || 'center';
                    ctx.textBaseline = l.baseline || 'middle';
                    ctx.fillText(l.text, pos.x, pos.y);
                });
            }
        });
    }, 100);
    
    return html;
}

// ========================================================================
// BLOCK 1230: Geometry 2D Engine v2.2 (ES Module 통합형)
// main.js v6.10 통합 버전: Dispatcher/Export/전역 노출과 함께 연결됨.
// ========================================================================

function geometry2DSafeNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function geometry2DNormalizePoint(point, fallbackId) {
    if (Array.isArray(point)) {
        return {
            id: fallbackId || '',
            x: geometry2DSafeNumber(point[0], 0),
            y: geometry2DSafeNumber(point[1], 0),
            visible: true
        };
    }

    point = point || {};

    return {
        id: point.id || fallbackId || '',
        x: geometry2DSafeNumber(point.x, 0),
        y: geometry2DSafeNumber(point.y, 0),
        label: point.label,
        visible: point.visible !== false
    };
}

function geometry2DPointMap(points) {
    var map = {};

    if (Array.isArray(points)) {
        points.forEach(function(point, index) {
            var id = point && point.id ? point.id : 'P' + index;
            map[id] = geometry2DNormalizePoint(point, id);
        });
    } else if (points && typeof points === 'object') {
        Object.keys(points).forEach(function(id) {
            map[id] = geometry2DNormalizePoint(points[id], id);
            map[id].id = id;
        });
    }

    return map;
}

function geometry2DGetPoint(pointMap, reference) {
    if (reference === null || reference === undefined) return null;

    if (typeof reference === 'string') {
        return pointMap[reference] || null;
    }

    if (Array.isArray(reference)) {
        return geometry2DNormalizePoint(reference, '');
    }

    if (typeof reference === 'object') {
        return geometry2DNormalizePoint(reference, reference.id || '');
    }

    return null;
}

function geometry2DCreateViewport(width, height, data) {
    var padding = geometry2DSafeNumber(data.padding, 34);
    var noteSpace = data.note ? 40 : 10;

    var viewBox = data.viewBox || {};
    var minX = geometry2DSafeNumber(viewBox.minX, 0);
    var maxX = geometry2DSafeNumber(viewBox.maxX, 100);
    var minY = geometry2DSafeNumber(viewBox.minY, 0);
    var maxY = geometry2DSafeNumber(viewBox.maxY, 100);

    if (maxX === minX) maxX = minX + 1;
    if (maxY === minY) maxY = minY + 1;

    var drawingWidth = Math.max(1, width - padding * 2);
    var drawingHeight = Math.max(1, height - padding * 2 - noteSpace);

    return {
        toScreen: function(point) {
            return {
                x: padding + ((point.x - minX) / (maxX - minX)) * drawingWidth,
                y: padding + drawingHeight - ((point.y - minY) / (maxY - minY)) * drawingHeight
            };
        }
    };
}

function geometry2DDrawSegment(ctx, viewport, from, to, style) {
    if (!from || !to) return;

    style = style || {};
    var a = viewport.toScreen(from);
    var b = viewport.toScreen(to);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = style.color || '#111';
    ctx.lineWidth = geometry2DSafeNumber(style.lineWidth, 2);

    if (style.dashed) {
        ctx.setLineDash(Array.isArray(style.dash) ? style.dash : [7, 5]);
    }

    ctx.stroke();
    ctx.restore();
}

function geometry2DDrawPoint(ctx, viewport, point, style) {
    if (!point || point.visible === false) return;

    style = style || {};
    var p = viewport.toScreen(point);

    ctx.save();
    ctx.beginPath();
    ctx.arc(
        p.x,
        p.y,
        geometry2DSafeNumber(style.radius, 3.5),
        0,
        Math.PI * 2
    );
    ctx.fillStyle = style.color || '#111';
    ctx.fill();
    ctx.restore();
}

function geometry2DDrawText(ctx, viewport, label) {
    if (!label || label.text === undefined) return;

    var p = viewport.toScreen({
        x: geometry2DSafeNumber(label.x, 0),
        y: geometry2DSafeNumber(label.y, 0)
    });

    ctx.save();
    ctx.font =
        (label.italic ? 'italic ' : '') +
        geometry2DSafeNumber(label.fontSize, 17) +
        'px ' +
        (label.fontFamily || 'Georgia, serif');
    ctx.fillStyle = label.color || '#111';
    ctx.textAlign = label.align || 'center';
    ctx.textBaseline = label.baseline || 'middle';
    ctx.fillText(
        String(label.text),
        p.x + geometry2DSafeNumber(label.dx, 0),
        p.y + geometry2DSafeNumber(label.dy, 0)
    );
    ctx.restore();
}

function geometry2DDrawParallelMark(ctx, viewport, from, to, position, count) {
    if (!from || !to) return;

    var a = viewport.toScreen(from);
    var b = viewport.toScreen(to);
    var ratio = geometry2DSafeNumber(position, 0.5);

    var centerX = a.x + (b.x - a.x) * ratio;
    var centerY = a.y + (b.y - a.y) * ratio;

    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var length = Math.hypot(dx, dy) || 1;

    var ux = dx / length;
    var uy = dy / length;
    var nx = -uy;
    var ny = ux;

    var slashCount = Math.max(1, Math.round(count || 1));
    var slashLength = 10;
    var separation = 7;

    ctx.save();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;

    for (var i = 0; i < slashCount; i++) {
        var offset = (i - (slashCount - 1) / 2) * separation;
        var x = centerX + ux * offset;
        var y = centerY + uy * offset;

        ctx.beginPath();
        ctx.moveTo(
            x - nx * slashLength / 2 - ux * 3,
            y - ny * slashLength / 2 - uy * 3
        );
        ctx.lineTo(
            x + nx * slashLength / 2 + ux * 3,
            y + ny * slashLength / 2 + uy * 3
        );
        ctx.stroke();
    }

    ctx.restore();
}

function geometry2DDrawRightAngle(ctx, viewport, mark, pointMap) {
    var vertex = geometry2DGetPoint(pointMap, mark.vertex);
    var arm1 = geometry2DGetPoint(pointMap, mark.arm1);
    var arm2 = geometry2DGetPoint(pointMap, mark.arm2);

    if (!vertex || !arm1 || !arm2) return;

    var v = viewport.toScreen(vertex);
    var a = viewport.toScreen(arm1);
    var b = viewport.toScreen(arm2);
    var size = geometry2DSafeNumber(mark.size, 13);

    var va = {x: a.x - v.x, y: a.y - v.y};
    var vb = {x: b.x - v.x, y: b.y - v.y};

    var la = Math.hypot(va.x, va.y) || 1;
    var lb = Math.hypot(vb.x, vb.y) || 1;

    va.x = va.x / la * size;
    va.y = va.y / la * size;
    vb.x = vb.x / lb * size;
    vb.y = vb.y / lb * size;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(v.x + va.x, v.y + va.y);
    ctx.lineTo(v.x + va.x + vb.x, v.y + va.y + vb.y);
    ctx.lineTo(v.x + vb.x, v.y + vb.y);
    ctx.strokeStyle = mark.color || '#111';
    ctx.lineWidth = geometry2DSafeNumber(mark.lineWidth, 1.5);
    ctx.stroke();
    ctx.restore();
}

function geometry2DExpandParallelTransversal(data) {
    var vars = data.vars || {};
    var angle = geometry2DSafeNumber(vars.angle, 110);
    var unknown = vars.unknown || 'x';
    var lineLabels = Array.isArray(vars.lineLabels) ? vars.lineLabels : ['s', 't'];
    var transversalLabel = vars.transversalLabel || 'c';

    return {
        type: 'geometry-2d',
        height: geometry2DSafeNumber(data.height, 330),
        padding: 34,
        viewBox: {minX: 0, maxX: 100, minY: 0, maxY: 100},
        points: {
            S1: [8, 66],
            S2: [92, 66],
            T1: [8, 34],
            T2: [92, 34],
            C1: [18, 8],
            C2: [82, 92]
        },
        segments: [
            {from: 'S1', to: 'S2', lineWidth: 2},
            {from: 'T1', to: 'T2', lineWidth: 2},
            {from: 'C1', to: 'C2', lineWidth: 2}
        ],
        labels: [
            {text: lineLabels[0], x: 95, y: 66, italic: true, fontSize: 18, align: 'left'},
            {text: lineLabels[1], x: 95, y: 34, italic: true, fontSize: 18, align: 'left'},
            {text: transversalLabel, x: 83, y: 95, italic: true, fontSize: 18},
            {text: angle + '°', x: 35, y: 39, fontSize: 17},
            {text: unknown + '°', x: 69, y: 70, fontSize: 17, italic: true}
        ],
        marks: [
            {type: 'parallel', segment: ['S1', 'S2'], position: 0.22, count: 1},
            {type: 'parallel', segment: ['T1', 'T2'], position: 0.22, count: 1}
        ],
        note: data.note === false
            ? ''
            : (data.note || 'Note: Figure not drawn to scale.')
    };
}

function geometry2DExpandRightTriangle(data) {
    var vars = data.vars || {};
    var a = geometry2DSafeNumber(vars.a, 4);
    var b = geometry2DSafeNumber(vars.b, 5);
    var unknown = vars.unknown || 'c';

    return {
        type: 'geometry-2d',
        height: geometry2DSafeNumber(data.height, 330),
        viewBox: {minX: 0, maxX: 100, minY: 0, maxY: 100},
        points: {
            A: [18, 18],
            B: [82, 18],
            C: [18, 78]
        },
        segments: [
            {from: 'A', to: 'B'},
            {from: 'A', to: 'C'},
            {from: 'B', to: 'C'}
        ],
        labels: [
            {text: String(a), x: 50, y: 12, fontSize: 17},
            {text: String(b), x: 11, y: 48, fontSize: 17},
            {text: String(unknown), x: 54, y: 53, fontSize: 17, italic: true}
        ],
        marks: [
            {type: 'right-angle', vertex: 'A', arm1: 'B', arm2: 'C', size: 14}
        ],
        note: data.note || ''
    };
}

function geometry2DExpandTemplate(data) {
    var template = String(data.template || data.shape || '').toLowerCase();

    switch (template) {
        case 'parallel-lines-transversal':
            return geometry2DExpandParallelTransversal(data);

        case 'right-triangle':
            return geometry2DExpandRightTriangle(data);

        default:
            return data;
    }
}

function geometry2DDrawGeneric(ctx, width, height, rawData) {
    var data = geometry2DExpandTemplate(rawData);
    var viewport = geometry2DCreateViewport(width, height, data);
    var pointMap = geometry2DPointMap(data.points);

    ctx.save();
    ctx.fillStyle = data.background || '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    var polygons = Array.isArray(data.polygons) ? data.polygons : [];

    polygons.forEach(function(polygon) {
        var vertices = Array.isArray(polygon.vertices) ? polygon.vertices : [];
        if (vertices.length < 3) return;

        ctx.save();
        ctx.beginPath();

        vertices.forEach(function(reference, index) {
            var point = geometry2DGetPoint(pointMap, reference);
            if (!point) return;
            var p = viewport.toScreen(point);

            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });

        ctx.closePath();

        if (polygon.fill) {
            ctx.fillStyle = polygon.fill;
            ctx.fill();
        }

        ctx.strokeStyle = polygon.color || '#111';
        ctx.lineWidth = geometry2DSafeNumber(polygon.lineWidth, 2);

        if (polygon.dashed) ctx.setLineDash([7, 5]);

        ctx.stroke();
        ctx.restore();
    });

    var segments = Array.isArray(data.segments) ? data.segments : [];

    segments.forEach(function(segment) {
        var fromRef = Array.isArray(segment) ? segment[0] : segment.from;
        var toRef = Array.isArray(segment) ? segment[1] : segment.to;

        geometry2DDrawSegment(
            ctx,
            viewport,
            geometry2DGetPoint(pointMap, fromRef),
            geometry2DGetPoint(pointMap, toRef),
            segment
        );
    });

    var marks = Array.isArray(data.marks) ? data.marks : [];

    marks.forEach(function(mark) {
        if (!mark || !mark.type) return;

        if (mark.type === 'parallel' && Array.isArray(mark.segment)) {
            geometry2DDrawParallelMark(
                ctx,
                viewport,
                geometry2DGetPoint(pointMap, mark.segment[0]),
                geometry2DGetPoint(pointMap, mark.segment[1]),
                mark.position,
                mark.count
            );
        } else if (mark.type === 'right-angle') {
            geometry2DDrawRightAngle(ctx, viewport, mark, pointMap);
        }
    });

    if (data.showPoints) {
        Object.keys(pointMap).forEach(function(id) {
            geometry2DDrawPoint(ctx, viewport, pointMap[id], data.pointStyle || {});
        });
    }

    Object.keys(pointMap).forEach(function(id) {
        var point = pointMap[id];

        if (point.label) {
            geometry2DDrawText(ctx, viewport, {
                text: point.label,
                x: point.x,
                y: point.y,
                dx: 8,
                dy: -8,
                align: 'left'
            });
        }
    });

    var labels = Array.isArray(data.labels) ? data.labels : [];
    labels.forEach(function(label) {
        geometry2DDrawText(ctx, viewport, label);
    });

    if (data.note) {
        ctx.save();
        ctx.font = '15px Georgia, serif';
        ctx.fillStyle = '#222';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(data.note), width / 2, height - 8);
        ctx.restore();
    }
}

function renderGeometry2D(parsedData) {
    var canvasId = 'geometry2d_' + Math.random().toString(36).slice(2, 11);
    var height = geometry2DSafeNumber(parsedData && parsedData.height, 360);

    var html =
        '<div style="margin:15px 0;padding:12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">' +
            '<canvas id="' + canvasId + '" style="width:100%;height:' + height + 'px;display:block;"></canvas>' +
        '</div>';

    setTimeout(function() {
        initCanvas(canvasId, 650, height).then(function(result) {
            if (!result) return;

            try {
                geometry2DDrawGeneric(
                    result.ctx,
                    result.w,
                    result.h,
                    parsedData || {}
                );
            } catch (error) {
                console.error('Geometry 2D render error:', error, parsedData);

                if (result.canvas && result.canvas.parentElement) {
                    result.canvas.parentElement.innerHTML =
                        '<div style="padding:20px;text-align:center;color:#c0392b;">' +
                        'Geometry 2D rendering error: ' +
                        escapeHtml(error.message) +
                        '</div>';
                }
            }
        });
    }, 0);

    return html;
}

// ========================================================================
// BLOCK 1231: 함수 평가기
// ========================================================================
function evaluateFunction(expr, x) {
    try {
        if (typeof math !== 'undefined' && math.parse) {
            var node = math.parse(expr);
            var result = node.evaluate({ x: x });
            return typeof result === 'number' && isFinite(result) ? result : NaN;
        }
        var sanitized = expr.replace(/x/g, '(' + x + ')');
        return Function('"use strict"; return (' + sanitized + ')')();
    } catch(e) {
        return NaN;
    }
}

// ========================================================================
// BLOCK 1232: 함수 그래프 렌더러
// ========================================================================
function renderFunctionGraph(ctx, func, coord, xMin, xMax, yMin, yMax) {
    var equation = func.equation || '';
    var color = func.color || '#e74c3c';
    var lineWidth = func.lineWidth || 3;
    var samples = 500;
    var step = (xMax - xMin) / samples;
    var points = [];
    
    for (var xVal = xMin; xVal <= xMax; xVal += step) {
        var yVal = evaluateFunction(equation, xVal);
        if (!isNaN(yVal) && isFinite(yVal) && yVal >= yMin && yVal <= yMax) {
            points.push({ x: xVal, y: yVal });
        } else {
            points.push({ x: xVal, y: NaN });
        }
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    var i = 0;
    while (i < points.length) {
        while (i < points.length && isNaN(points[i].y)) i++;
        if (i >= points.length) break;
        var start = i;
        while (i < points.length && !isNaN(points[i].y)) i++;
        if (i - start > 1) {
            ctx.beginPath();
            var p = coord.toScreen(points[start].x, points[start].y);
            ctx.moveTo(p.x, p.y);
            for (var j = start + 1; j < i; j++) {
                p = coord.toScreen(points[j].x, points[j].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }
}

// ========================================================================
// BLOCK 1233: coordinate-plane 메인 렌더러
// ========================================================================
function renderCoordinatePlane(parsedData) {
    var canvasId = 'coord_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;position:relative;">' +
        '<canvas id="' + canvasId + '" style="width:100%;height:400px;display:block;border-radius:4px;"></canvas>' +
        '</div>';
    
    setTimeout(function() {
        initCanvas(canvasId, 600, 400).then(function(result) {
            if (!result) return;
            var ctx = result.ctx, w = result.w, h = result.h;
            
            var xMin = parsedData.xAxis?.min !== undefined ? parsedData.xAxis.min : -10;
            var xMax = parsedData.xAxis?.max !== undefined ? parsedData.xAxis.max : 10;
            var yMin = parsedData.yAxis?.min !== undefined ? parsedData.yAxis.min : -10;
            var yMax = parsedData.yAxis?.max !== undefined ? parsedData.yAxis.max : 10;
            
            var coord = createCoordinateSystem(ctx, w, h, xMin, xMax, yMin, yMax);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            coord.drawGrid();
            coord.drawAxes();
            
            ctx.fillStyle = '#555';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(parsedData.xAxis?.label || 'x', coord.padding + coord.graphW / 2, h - 18);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(parsedData.yAxis?.label || 'y', 12, coord.padding);
            
            if (parsedData.functions) {
                parsedData.functions.forEach(function(func) {
                    renderFunctionGraph(ctx, func, coord, xMin, xMax, yMin, yMax);
                });
            }
            
            if (parsedData.points) {
                parsedData.points.forEach(function(pt) {
                    var screen = coord.toScreen(pt.x, pt.y);
                    ctx.beginPath();
                    ctx.arc(screen.x, screen.y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = pt.color || '#3498db';
                    ctx.fill();
                    if (pt.label) {
                        ctx.fillStyle = '#333';
                        ctx.font = '12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(pt.label, screen.x, screen.y - 8);
                    }
                });
            }
            
            if (parsedData.segments) {
                parsedData.segments.forEach(function(seg) {
                    var from = coord.toScreen(seg.from[0], seg.from[1]);
                    var to = coord.toScreen(seg.to[0], seg.to[1]);
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.strokeStyle = seg.color || '#2c3e50';
                    ctx.lineWidth = seg.lineWidth || 2;
                    if (seg.dash) {
                        ctx.setLineDash(seg.dash);
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                });
            }
        });
    }, 100);
    
    return html;
}

// ========================================================================
// BLOCK 1234: 통합 방정식 그래프 엔진 v1.0
// 지원: 일차/이차/절댓값/지수/원/연립/부등식/일반 좌표평면
// ========================================================================

function normalizeEquationExpression(input) {
    var s = String(input == null ? '' : input).trim();
    s = s.replace(/[−–—]/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    s = s.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/²/g, '^2').replace(/³/g, '^3');
    s = s.replace(/\bpi\b/gi, 'pi').replace(/π/g, 'pi');
    s = s.replace(/\bln\s*\(/gi, 'log(');
    s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
    // 암시적 곱셈: 8x, 2(x+1), (x+1)(x-1), x(y+1)
    s = s.replace(/(\d|[xy]|\))\s*(?=\()/gi, '$1*');
    s = s.replace(/(\d|\))\s*(?=[xy])/gi, '$1*');
    s = s.replace(/([xy])\s*(?=\d)/gi, '$1*');
    s = s.replace(/\)\s*(?=\d|[xy])/gi, ')*');
    return s.replace(/\s+/g, '');
}

function splitEquationRelation(input) {
    var s = normalizeEquationExpression(input);
    var m = s.match(/(<=|>=|=|<|>)/);
    if (!m) return { left: 'y', op: '=', right: s, raw: s };
    var i = m.index;
    return { left: s.slice(0, i), op: m[1], right: s.slice(i + m[1].length), raw: s };
}

function compileMathExpression(expr, variables) {
    var normalized = normalizeEquationExpression(expr);
    if (typeof math !== 'undefined' && math.compile) {
        var compiled = math.compile(normalized);
        return function(scope) {
            var value = compiled.evaluate(scope || {});
            return Number(value);
        };
    }
    // Math.js가 아직 없을 때의 안전한 기본 평가기
    var js = normalized
        .replace(/\^/g, '**')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\blog\b/g, 'Math.log')
        .replace(/\bexp\b/g, 'Math.exp')
        .replace(/\bpi\b/g, 'Math.PI');
    if (!/^[0-9xy+\-*/().,A-Za-z_\s*]+$/.test(js)) throw new Error('허용되지 않는 수식 문자');
    var names = variables || ['x', 'y'];
    var fn = Function.apply(null, names.concat(['"use strict"; return (' + js + ');']));
    return function(scope) {
        var args = names.map(function(name) { return Number((scope || {})[name] || 0); });
        return Number(fn.apply(null, args));
    };
}

function compileEquationItem(input) {
    var relation = splitEquationRelation(input);
    var leftFn = compileMathExpression(relation.left, ['x', 'y']);
    var rightFn = compileMathExpression(relation.right, ['x', 'y']);
    return {
        relation: relation,
        value: function(x, y) { return leftFn({ x: x, y: y }) - rightFn({ x: x, y: y }); }
    };
}

function upgradeLegacyEquationData(data) {
    var out = Object.assign({}, data || {});
    var equations = out.equations;
    if (!equations && Array.isArray(out.functions)) equations = out.functions;
    if (!equations && out.equation) equations = [out.equation];
    if (!equations) equations = [];
    if (!Array.isArray(equations)) equations = [equations];
    out.equations = equations.map(function(item) {
        if (typeof item === 'string') return { equation: item };
        return Object.assign({}, item || {}, { equation: (item && (item.equation || item.expression || item.formula)) || '' });
    }).filter(function(item) { return item.equation; });
    return out;
}

function niceTickStep(min, max, requested) {
    if (requested !== undefined && requested !== null && Number(requested) > 0) return Number(requested);
    var range = Math.abs(max - min) || 1;
    var rough = range / 10;
    var power = Math.pow(10, Math.floor(Math.log10(rough)));
    var fraction = rough / power;
    var nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * power;
}

function createEquationCoordinateSystem(ctx, w, h, data) {
    var xAxis = data.xAxis || {}, yAxis = data.yAxis || {};
    var xMin = safeNumber(xAxis.min, -10), xMax = safeNumber(xAxis.max, 10);
    var yMin = safeNumber(yAxis.min, -10), yMax = safeNumber(yAxis.max, 10);
    if (!(xMax > xMin)) { xMin = -10; xMax = 10; }
    if (!(yMax > yMin)) { yMin = -10; yMax = 10; }
    var pad = { left: 62, right: 24, top: 24, bottom: 54 };
    var graphW = w - pad.left - pad.right, graphH = h - pad.top - pad.bottom;
    var equal = data.aspectMode === 'equal';
    if (equal) {
        var unit = Math.min(graphW / (xMax - xMin), graphH / (yMax - yMin));
        graphW = unit * (xMax - xMin); graphH = unit * (yMax - yMin);
        pad.left += (w - pad.left - pad.right - graphW) / 2;
        pad.top += (h - pad.top - pad.bottom - graphH) / 2;
    }
    function toScreen(x, y) {
        return { x: pad.left + (x - xMin) * graphW / (xMax - xMin), y: pad.top + graphH - (y - yMin) * graphH / (yMax - yMin) };
    }
    function toMath(sx, sy) {
        return { x: xMin + (sx - pad.left) * (xMax - xMin) / graphW, y: yMin + (pad.top + graphH - sy) * (yMax - yMin) / graphH };
    }
    return { xMin:xMin,xMax:xMax,yMin:yMin,yMax:yMax,pad:pad,graphW:graphW,graphH:graphH,toScreen:toScreen,toMath:toMath };
}

function drawEquationAxes(ctx, c, data) {
    var xAxis = data.xAxis || {}, yAxis = data.yAxis || {};
    var xStep = niceTickStep(c.xMin, c.xMax, xAxis.tick);
    var yStep = niceTickStep(c.yMin, c.yMax, yAxis.tick);
    ctx.save();
    ctx.beginPath(); ctx.rect(c.pad.left, c.pad.top, c.graphW, c.graphH); ctx.clip();
    ctx.strokeStyle = data.gridColor || '#d6d6d6'; ctx.lineWidth = 1;
    for (var x = Math.ceil(c.xMin / xStep) * xStep; x <= c.xMax + xStep * 1e-6; x += xStep) {
        var sx = c.toScreen(x, 0).x; ctx.beginPath(); ctx.moveTo(sx, c.pad.top); ctx.lineTo(sx, c.pad.top + c.graphH); ctx.stroke();
    }
    for (var y = Math.ceil(c.yMin / yStep) * yStep; y <= c.yMax + yStep * 1e-6; y += yStep) {
        var sy = c.toScreen(0, y).y; ctx.beginPath(); ctx.moveTo(c.pad.left, sy); ctx.lineTo(c.pad.left + c.graphW, sy); ctx.stroke();
    }
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.8;
    if (c.xMin <= 0 && c.xMax >= 0) { var ox = c.toScreen(0,0).x; ctx.beginPath(); ctx.moveTo(ox,c.pad.top); ctx.lineTo(ox,c.pad.top+c.graphH); ctx.stroke(); }
    if (c.yMin <= 0 && c.yMax >= 0) { var oy = c.toScreen(0,0).y; ctx.beginPath(); ctx.moveTo(c.pad.left,oy); ctx.lineTo(c.pad.left+c.graphW,oy); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle='#333'; ctx.font='12px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    for (var xt = Math.ceil(c.xMin / xStep) * xStep; xt <= c.xMax + xStep * 1e-6; xt += xStep) {
        var xp=c.toScreen(xt,0).x; ctx.fillText(Number(xt.toFixed(10)).toString(),xp,c.pad.top+c.graphH+6);
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for (var yt = Math.ceil(c.yMin / yStep) * yStep; yt <= c.yMax + yStep * 1e-6; yt += yStep) {
        var yp=c.toScreen(0,yt).y; ctx.fillText(Number(yt.toFixed(10)).toString(),c.pad.left-7,yp);
    }
    ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.font='14px sans-serif';
    ctx.fillText(xAxis.label || 'x', c.pad.left+c.graphW/2, hSafe(ctx.canvas, 8));
    ctx.save(); ctx.translate(16,c.pad.top+c.graphH/2); ctx.rotate(-Math.PI/2); ctx.fillText(yAxis.label || 'y',0,0); ctx.restore();
}
function hSafe(canvas, margin) { return (parseFloat(canvas.style.height) || canvas.height / (window.devicePixelRatio || 1) || 400) - margin; }

function relationMatches(op, v) {
    var eps = 1e-9;
    if (op === '<') return v < 0; if (op === '<=') return v <= eps;
    if (op === '>') return v > 0; if (op === '>=') return v >= -eps;
    return Math.abs(v) <= eps;
}

function drawImplicitCurve(ctx, c, compiled, style) {
    var cols = Math.max(120, Math.min(420, Math.round(c.graphW)));
    var rows = Math.max(100, Math.min(360, Math.round(c.graphH)));
    var dx=(c.xMax-c.xMin)/cols, dy=(c.yMax-c.yMin)/rows;
    ctx.save(); ctx.beginPath(); ctx.rect(c.pad.left,c.pad.top,c.graphW,c.graphH); ctx.clip();
    ctx.strokeStyle=style.color || '#111'; ctx.lineWidth=safeNumber(style.lineWidth,2.5); ctx.setLineDash(style.dash || []);
    function interp(x1,y1,v1,x2,y2,v2){ var den=v1-v2; var t=Math.abs(den)<1e-15?0.5:v1/den; t=Math.max(0,Math.min(1,t)); return c.toScreen(x1+t*(x2-x1),y1+t*(y2-y1)); }
    for(var j=0;j<rows;j++){
        var y0=c.yMin+j*dy,y1=y0+dy;
        for(var i=0;i<cols;i++){
            var x0=c.xMin+i*dx,x1=x0+dx;
            var v00=compiled.value(x0,y0),v10=compiled.value(x1,y0),v11=compiled.value(x1,y1),v01=compiled.value(x0,y1);
            if(![v00,v10,v11,v01].every(Number.isFinite)) continue;
            var hits=[];
            if((v00<=0)!=(v10<=0)) hits.push(interp(x0,y0,v00,x1,y0,v10));
            if((v10<=0)!=(v11<=0)) hits.push(interp(x1,y0,v10,x1,y1,v11));
            if((v11<=0)!=(v01<=0)) hits.push(interp(x1,y1,v11,x0,y1,v01));
            if((v01<=0)!=(v00<=0)) hits.push(interp(x0,y1,v01,x0,y0,v00));
            if(hits.length===2){ctx.beginPath();ctx.moveTo(hits[0].x,hits[0].y);ctx.lineTo(hits[1].x,hits[1].y);ctx.stroke();}
            else if(hits.length===4){ctx.beginPath();ctx.moveTo(hits[0].x,hits[0].y);ctx.lineTo(hits[1].x,hits[1].y);ctx.moveTo(hits[2].x,hits[2].y);ctx.lineTo(hits[3].x,hits[3].y);ctx.stroke();}
        }
    }
    ctx.restore();
}

function drawInequalityRegion(ctx, c, compiled, style) {
    var pixel = Math.max(2, safeNumber(style.shadeResolution, 3));
    ctx.save(); ctx.beginPath(); ctx.rect(c.pad.left,c.pad.top,c.graphW,c.graphH); ctx.clip();
    ctx.fillStyle=style.fillColor || 'rgba(52,152,219,0.18)';
    for(var sy=c.pad.top;sy<c.pad.top+c.graphH;sy+=pixel){
        for(var sx=c.pad.left;sx<c.pad.left+c.graphW;sx+=pixel){
            var p=c.toMath(sx+pixel/2,sy+pixel/2),v=compiled.value(p.x,p.y);
            if(Number.isFinite(v)&&relationMatches(compiled.relation.op,v)) ctx.fillRect(sx,sy,pixel,pixel);
        }
    }
    ctx.restore();
    drawImplicitCurve(ctx,c,compiled,Object.assign({},style,{dash:(compiled.relation.op==='<'||compiled.relation.op==='>')?[7,5]:[]}));
}

function drawEquationPointsAndSegments(ctx,c,data){
    (data.segments||[]).forEach(function(seg){var a=c.toScreen(seg.from[0],seg.from[1]),b=c.toScreen(seg.to[0],seg.to[1]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=seg.color||'#333';ctx.lineWidth=seg.lineWidth||2;ctx.setLineDash(seg.dash||[]);ctx.stroke();ctx.setLineDash([]);});
    (data.points||[]).forEach(function(pt){var p=c.toScreen(Number(pt.x),Number(pt.y));ctx.beginPath();ctx.arc(p.x,p.y,pt.radius||5,0,Math.PI*2);ctx.fillStyle=pt.color||'#3498db';ctx.fill();if(pt.label){ctx.fillStyle='#222';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(pt.label,p.x,p.y-8);}});
}

function renderEquationGraph(parsedData) {
    var data = upgradeLegacyEquationData(parsedData);
    var canvasId = 'equation_' + Math.random().toString(36).substr(2, 9);
    var height = safeNumber(data.height, 420);

    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;position:relative;">' +
        (data.title
            ? '<div style="text-align:center;font-weight:700;margin-bottom:8px;">' + escapeHtml(data.title) + '</div>'
            : '') +
        '<canvas id="' + canvasId + '" style="width:100%;height:' + height + 'px;display:block;background:white;border-radius:4px;"></canvas></div>';

    setTimeout(function () {
        initCanvas(canvasId, 650, height).then(async function (result) {
            if (!result) return;

            var ctx = result.ctx;
            var w = result.w;
            var h = result.h;
            var c = createEquationCoordinateSystem(ctx, w, h, data);

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);

            // 축, 격자, 점, 선분은 Math.js를 기다리지 않고 즉시 표시
            drawEquationAxes(ctx, c, data);
            drawEquationPointsAndSegments(ctx, c, data);

            var equations = Array.isArray(data.equations) ? data.equations : [];

            // 점 또는 선분만 있는 그래프는 여기서 즉시 종료
            if (equations.length === 0) return;

            // 실제 방정식이 있을 때만 Math.js 로드
            try {
                if (typeof math === 'undefined') {
                    await ensureMathJS();
                }
            } catch (error) {
                console.warn('Math.js unavailable; fallback evaluator used', error);
            }

            // Math.js 로딩 중 다른 문제로 이동했으면 이전 캔버스에 그리지 않음
            var canvas = document.getElementById(canvasId);
            if (!canvas || !canvas.isConnected) return;

            equations.forEach(function (item, index) {
                try {
                    var equationItem = typeof item === 'string'
                        ? { equation: item }
                        : item;

                    if (!equationItem || !equationItem.equation) return;

                    var compiled = compileEquationItem(equationItem.equation);
                    var style = Object.assign({
                        color: ['#111', '#d62728', '#1f77b4', '#2ca02c'][index % 4]
                    }, equationItem);

                    if (compiled.relation.op === '=') {
                        drawImplicitCurve(ctx, c, compiled, style);
                    } else {
                        drawInequalityRegion(ctx, c, compiled, style);
                    }
                } catch (err) {
                    console.error('Equation compile/render error:', item, err);
                }
            });
        }).catch(function (error) {
            console.error('Equation canvas initialization error:', error);
        });
    }, 0);

    return html;
}

// ========================================================================


// ========================================================================
// BLOCK 1240: Box-Plot 렌더러 (SAT 통계)
// ========================================================================
function renderBoxPlotType(parsedData) {
    var canvasId = 'boxplot_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">' +
        '<div style="text-align:center;font-weight:bold;color:#2c3e50;margin-bottom:10px;">' + (parsedData.title || 'Box Plot') + '</div>' +
        '<canvas id="' + canvasId + '" style="width:100%;height:300px;display:block;"></canvas>' +
        '</div>';
    
    setTimeout(function() {
        initCanvas(canvasId, 600, 300).then(function(result) {
            if (!result) return;
            var ctx = result.ctx, w = result.w, h = result.h;
            
            var min = safeNumber(parsedData.min, 0);
            var q1 = safeNumber(parsedData.q1, 10);
            var median = safeNumber(parsedData.median, 20);
            var q3 = safeNumber(parsedData.q3, 30);
            var max = safeNumber(parsedData.max, 40);
            var outliers = safeArray(parsedData.outliers);
            
            if (!(q1 < median && median < q3)) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚠️ Box Plot 데이터 오류', w/2, h/2);
                return;
            }
            
            var padding = { top: 30, bottom: 40, left: 50, right: 30 };
            var graphW = w - padding.left - padding.right;
            var graphH = h - padding.top - padding.bottom;
            
            var allValues = [min, q1, median, q3, max, ...outliers];
            var minVal = Math.min(...allValues);
            var maxVal = Math.max(...allValues);
            var range = maxVal - minVal || 1;
            
            function toY(val) {
                return padding.top + graphH - ((val - minVal) / range) * graphH;
            }
            
            var cx = w / 2;
            var boxWidth = graphW * 0.2;
            var x1 = cx - boxWidth / 2;
            var x2 = cx + boxWidth / 2;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 0.5;
            for (var i = 0; i <= 4; i++) {
                var y = padding.top + (i / 4) * graphH;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(w - padding.right, y);
                ctx.stroke();
                var val = maxVal - (i / 4) * range;
                ctx.fillStyle = '#666';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(val.toFixed(1), padding.left - 8, y);
            }
            
            var q1y = toY(q1);
            var q3y = toY(q3);
            
            ctx.fillStyle = 'rgba(52,152,219,0.2)';
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
            ctx.fillRect(x1, q3y, boxWidth, q1y - q3y);
            ctx.strokeRect(x1, q3y, boxWidth, q1y - q3y);
            
            var medianY = toY(median);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, medianY);
            ctx.lineTo(x2, medianY);
            ctx.stroke();
            
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
            var minY = toY(min);
            ctx.beginPath();
            ctx.moveTo(cx, minY);
            ctx.lineTo(cx, q3y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x1, minY);
            ctx.lineTo(x2, minY);
            ctx.stroke();
            
            var maxY = toY(max);
            ctx.beginPath();
            ctx.moveTo(cx, q1y);
            ctx.lineTo(cx, maxY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x1, maxY);
            ctx.lineTo(x2, maxY);
            ctx.stroke();
            
            outliers.forEach(function(val) {
                var y = toY(val);
                ctx.beginPath();
                ctx.arc(cx, y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#e74c3c';
                ctx.fill();
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
            
            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('Q1: ' + q1.toFixed(1), x1 - 30, q3y - 10);
            ctx.fillText('Median: ' + median.toFixed(1), cx, medianY + 8);
            ctx.fillText('Q3: ' + q3.toFixed(1), x2 + 10, q1y - 10);
        });
    }, 100);
    
    return html;
}

// ========================================================================
// BLOCK 1250: 정규분포 곡선 렌더러 (SAT 통계)
// ========================================================================
function renderNormalDistributionType(parsedData) {
    var canvasId = 'normal_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">' +
        '<div style="text-align:center;font-weight:bold;color:#2c3e50;margin-bottom:10px;">' + (parsedData.title || 'Normal Distribution') + '</div>' +
        '<canvas id="' + canvasId + '" style="width:100%;height:300px;display:block;"></canvas>' +
        '</div>';
    
    setTimeout(function() {
        initCanvas(canvasId, 600, 300).then(function(result) {
            if (!result) return;
            var ctx = result.ctx, w = result.w, h = result.h;
            
            var mean = safeNumber(parsedData.mean, 0);
            var std = safeNumber(parsedData.std, 1);
            var xMin = parsedData.xMin !== undefined ? parsedData.xMin : mean - 4 * std;
            var xMax = parsedData.xMax !== undefined ? parsedData.xMax : mean + 4 * std;
            
            if (std <= 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('⚠️ 표준편차는 0보다 커야 합니다', w/2, h/2);
                return;
            }
            
            function normalPDF(x, m, s) {
                return (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - m, 2) / (2 * s * s));
            }
            
            var range = xMax - xMin;
            var samples = 200;
            var points = [];
            var maxY = 0;
            for (var i = 0; i <= samples; i++) {
                var x = xMin + (i / samples) * range;
                var y = normalPDF(x, mean, std);
                points.push({ x: x, y: y });
                if (y > maxY) maxY = y;
            }
            
            var padding = { top: 30, bottom: 40, left: 40, right: 40 };
            var graphW = w - padding.left - padding.right;
            var graphH = h - padding.top - padding.bottom;
            
            function toScreenX(x) {
                return padding.left + ((x - xMin) / range) * graphW;
            }
            function toScreenY(y) {
                return padding.top + graphH - (y / maxY) * graphH * 0.95;
            }
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, padding.top + graphH);
            ctx.lineTo(padding.left + graphW, padding.top + graphH);
            ctx.stroke();
            
            ctx.fillStyle = '#555';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (var i = -4; i <= 4; i++) {
                var val = mean + i * std;
                if (val >= xMin && val <= xMax) {
                    var sx = toScreenX(val);
                    ctx.fillText(val.toFixed(1), sx, padding.top + graphH + 6);
                    ctx.beginPath();
                    ctx.moveTo(sx, padding.top + graphH);
                    ctx.lineTo(sx, padding.top + graphH + 4);
                    ctx.stroke();
                }
            }
            
            var meanX = toScreenX(mean);
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(meanX, padding.top);
            ctx.lineTo(meanX, padding.top + graphH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('μ = ' + mean.toFixed(1), meanX, padding.top - 2);
            
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (var i = 0; i < points.length; i++) {
                var sx = toScreenX(points[i].x);
                var sy = toScreenY(points[i].y);
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            
            ctx.fillStyle = '#555';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('x', padding.left + graphW / 2, padding.top + graphH + 25);
        });
    }, 100);
    
    return html;
}

// ========================================================================
// BLOCK 1260: Table 렌더러
// ========================================================================
function renderTableType(parsedData) {
    if (!parsedData.headers || !parsedData.rows) {
        return '<div style="padding:10px;color:#999;text-align:center;">📊 Invalid table data</div>';
    }
    
    var h = '<div style="margin:15px 0;overflow-x:auto;background:white;border-radius:8px;border:1px solid #ddd;">' +
        '<table style="width:100%;border-collapse:collapse;text-align:center;font-size:14px;">';
    h += '<thead><tr style="background:#3498db;color:white;">';
    parsedData.headers.forEach(function(hd) { 
        h += '<th style="padding:10px 14px;border:1px solid #2980b9;font-weight:bold;">' + escapeHtml(hd) + '</th>'; 
    });
    h += '</tr></thead><tbody>';
    parsedData.rows.forEach(function(row, ri) {
        h += '<tr style="background:' + (ri%2===0?'#fff':'#f8f9fa') + ';">';
        row.forEach(function(cell) { 
            h += '<td style="padding:8px 14px;border:1px solid #ddd;">' + escapeHtml(cell) + '</td>'; 
        });
        h += '</tr>';
    });
    h += '</tbody></table>';
    if (parsedData.title) {
        h += '<div style="text-align:center;padding:8px;font-weight:bold;color:#555;background:#f8f9fa;border-radius:0 0 8px 8px;">' + escapeHtml(parsedData.title) + '</div>';
    }
    h += '</div>';
    return h;
}

// ========================================================================
// BLOCK 1270: Chart.js 기반 렌더러 (bar, pie, line, scatter, dot-plot 등)
// ========================================================================
function renderChartType(parsedData) {
    var type = parsedData.type || '';
    var chartId = 'chart_' + Math.random().toString(36).substr(2, 9);
    var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">' +
        '<canvas id="' + chartId + '" style="width:100%;height:400px;display:block;border-radius:4px;"></canvas>' +
        '</div>';
    
    if (typeof Chart === 'undefined') {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = function() {
            renderChartWithChartJS(parsedData, chartId);
        };
        document.head.appendChild(script);
    } else {
        setTimeout(function() {
            renderChartWithChartJS(parsedData, chartId);
        }, 50);
    }
    
    return html;
}

// ========================================================================
// BLOCK 1271: Chart.js 렌더링 엔진
// ========================================================================
function renderChartWithChartJS(parsedData, chartId) {
    var canvas = document.getElementById(chartId);
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
        canvas.parentElement.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">📊 Chart.js 로딩 중...</div>';
        return;
    }
    
    var ctx = canvas.getContext('2d');
    var type = parsedData.type || '';
    var config = null;
    var colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c'];
    
    // === BAR ===
    if (type === 'bar') {
        var labels = parsedData.labels || [];
        var datasets = [];
        
        if (parsedData.xAxis && parsedData.xAxis.categories) {
            labels = parsedData.xAxis.categories;
        }
        
        if (parsedData.series && Array.isArray(parsedData.series)) {
            datasets = parsedData.series.map(function(s, i) {
                var color = s.color || colors[i % colors.length];
                return {
                    label: s.name || 'Series ' + (i+1),
                    data: s.data || [],
                    backgroundColor: color + '80',
                    borderColor: color,
                    borderWidth: 2
                };
            });
        } else if (parsedData.values) {
            datasets = [{
                label: parsedData.label || 'Data',
                data: parsedData.values,
                backgroundColor: parsedData.color || '#3498db80',
                borderColor: parsedData.stroke || '#3498db',
                borderWidth: 2
            }];
        }
        
        config = {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!parsedData.title,
                        text: parsedData.title || '',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: parsedData.showLegend !== undefined
                            ? !!parsedData.showLegend
                            : datasets.length > 1,
                        position: 'bottom'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: !!(parsedData.xAxis && parsedData.xAxis.label),
                            text: parsedData.xAxis?.label || ''
                        },
                        grid: { color: '#e0e0e0' }
                    },
                    y: {
                        beginAtZero: parsedData.yAxis?.min === undefined
                            ? true
                            : Number(parsedData.yAxis.min) === 0,
                        min: parsedData.yAxis?.min !== undefined
                            ? Number(parsedData.yAxis.min)
                            : undefined,
                        max: parsedData.yAxis?.max !== undefined
                            ? Number(parsedData.yAxis.max)
                            : undefined,
                        title: {
                            display: !!(parsedData.yAxis && parsedData.yAxis.label),
                            text: parsedData.yAxis?.label || ''
                        },
                        ticks: {
                            stepSize: parsedData.yAxis?.tick !== undefined
                                ? Number(parsedData.yAxis.tick)
                                : undefined,
                            callback: function(value) {
                                return value + (parsedData.yAxis?.suffix || '');
                            }
                        },
                        grid: { color: '#e0e0e0' }
                    }
                }
            }
        };
    }
    
    // === PIE ===
    else if (type === 'pie' && parsedData.labels && parsedData.values) {
        config = {
            type: 'pie',
            data: {
                labels: parsedData.labels,
                datasets: [{
                    data: parsedData.values,
                    backgroundColor: parsedData.colors || ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Pie Chart', font: { size: 16, weight: 'bold' } },
                    legend: { position: 'bottom' }
                }
            }
        };
    }
    
    // === LINE ===
    // Supports both:
    // 1) category data: xAxis.categories + series[].data
    // 2) coordinate data: series[].points = [{x,y}, ...]
    else if (type === 'line' && parsedData.series && Array.isArray(parsedData.series)) {
        var categoryLabels =
            (parsedData.xAxis && Array.isArray(parsedData.xAxis.categories))
                ? parsedData.xAxis.categories
                : (Array.isArray(parsedData.labels) ? parsedData.labels : []);

        var usesCategoryData = categoryLabels.length > 0 ||
            parsedData.series.some(function(s) {
                return Array.isArray(s.data) || Array.isArray(s.values);
            });

        var lineDatasets = parsedData.series.map(function(s, i) {
            var color = s.color || colors[i % colors.length];
            var pointRadius =
                s.pointRadius !== undefined ? s.pointRadius :
                (s.pointSize !== undefined ? s.pointSize : 4);

            var dataset = {
                label: s.name || s.label || 'Series ' + (i + 1),
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: s.lineWidth || 2,
                pointRadius: pointRadius,
                pointHoverRadius: pointRadius + 2,
                pointBackgroundColor: color,
                pointBorderColor: color,
                tension: s.tension !== undefined ? s.tension : 0,
                showLine: s.showLine !== false,
                fill: s.fill === true
            };

            if (usesCategoryData) {
                dataset.data = Array.isArray(s.data)
                    ? s.data
                    : (Array.isArray(s.values) ? s.values : []);
            } else {
                dataset.data = (s.points || []).map(function(p) {
                    return { x: Number(p.x), y: Number(p.y) };
                });
            }

            return dataset;
        });

        var yAxis = parsedData.yAxis || {};
        var xAxis = parsedData.xAxis || {};
        var suffix = yAxis.suffix || '';

        var commonPlugins = {
            title: {
                display: !!parsedData.title,
                text: parsedData.title || '',
                font: { size: 16, weight: 'bold' }
            },
            legend: {
                display: parsedData.showLegend !== undefined
                    ? !!parsedData.showLegend
                    : lineDatasets.length > 1,
                position: 'bottom'
            }
        };

        if (usesCategoryData) {
            config = {
                type: 'line',
                data: {
                    labels: categoryLabels,
                    datasets: lineDatasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: commonPlugins,
                    scales: {
                        x: {
                            type: 'category',
                            title: {
                                display: !!xAxis.label,
                                text: xAxis.label || ''
                            },
                            ticks: {
                                autoSkip: false,
                                maxRotation: xAxis.rotation !== undefined ? xAxis.rotation : 45,
                                minRotation: xAxis.rotation !== undefined ? xAxis.rotation : 45
                            },
                            grid: {
                                display: parsedData.grid !== false,
                                color: '#cfcfcf'
                            }
                        },
                        y: {
                            beginAtZero: yAxis.min === undefined ? true : Number(yAxis.min) === 0,
                            min: yAxis.min !== undefined ? Number(yAxis.min) : undefined,
                            max: yAxis.max !== undefined ? Number(yAxis.max) : undefined,
                            title: {
                                display: !!yAxis.label,
                                text: yAxis.label || ''
                            },
                            ticks: {
                                stepSize: yAxis.tick !== undefined ? Number(yAxis.tick) : undefined,
                                callback: function(value) {
                                    return value + suffix;
                                }
                            },
                            grid: {
                                display: parsedData.grid !== false,
                                color: '#cfcfcf'
                            }
                        }
                    }
                }
            };
        } else {
            config = {
                type: 'scatter',
                data: { datasets: lineDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: commonPlugins,
                    scales: {
                        x: {
                            type: 'linear',
                            min: xAxis.min !== undefined ? Number(xAxis.min) : undefined,
                            max: xAxis.max !== undefined ? Number(xAxis.max) : undefined,
                            title: {
                                display: !!xAxis.label,
                                text: xAxis.label || 'x'
                            },
                            ticks: {
                                stepSize: xAxis.tick !== undefined ? Number(xAxis.tick) : undefined
                            },
                            grid: {
                                display: parsedData.grid !== false,
                                color: '#cfcfcf'
                            }
                        },
                        y: {
                            min: yAxis.min !== undefined ? Number(yAxis.min) : undefined,
                            max: yAxis.max !== undefined ? Number(yAxis.max) : undefined,
                            title: {
                                display: !!yAxis.label,
                                text: yAxis.label || 'y'
                            },
                            ticks: {
                                stepSize: yAxis.tick !== undefined ? Number(yAxis.tick) : undefined,
                                callback: function(value) {
                                    return value + suffix;
                                }
                            },
                            grid: {
                                display: parsedData.grid !== false,
                                color: '#cfcfcf'
                            }
                        }
                    }
                }
            };
        }
    }

    // === SCATTER ===
    else if (type === 'scatter' && parsedData.points) {
        var dataPoints = parsedData.points.map(function(p) {
            return { x: p.x, y: p.y };
        });
        
        config = {
            type: 'scatter',
            data: {
                datasets: [{
                    label: parsedData.title || 'Scatterplot',
                    data: dataPoints,
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Scatter Plot', font: { size: 16, weight: 'bold' } },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: parsedData.xAxis?.label || 'x' }, grid: { color: '#e0e0e0' } },
                    y: { title: { display: true, text: parsedData.yAxis?.label || 'y' }, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    // === DOT-PLOT ===
    else if (type === 'dot-plot' && parsedData.data) {
        var labels = parsedData.data.map(function(d) { return d.value; });
        var values = parsedData.data.map(function(d) { return d.count; });
        
        config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: parsedData.title || 'Frequency',
                    data: values,
                    backgroundColor: '#3498db80',
                    borderColor: '#2c3e50',
                    borderWidth: 1,
                    barPercentage: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Dot Plot', font: { size: 16, weight: 'bold' } },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: parsedData.xAxis?.label || 'Value' }, grid: { color: '#e0e0e0' } },
                    y: { beginAtZero: true, title: { display: true, text: parsedData.yAxis?.label || 'Count' }, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    // === STACKED-BAR ===
    else if (type === 'stacked-bar' && parsedData.labels && parsedData.datasets) {
        var datasets = parsedData.datasets.map(function(ds, i) {
            var color = colors[i % colors.length];
            return {
                label: ds.label || 'Series ' + (i+1),
                data: ds.values || [],
                backgroundColor: color + '80',
                borderColor: color,
                borderWidth: 1
            };
        });
        
        config = {
            type: 'bar',
            data: {
                labels: parsedData.labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Stacked Bar Chart', font: { size: 16, weight: 'bold' } },
                    legend: { position: 'bottom' }
                },
                scales: {
                    x: { stacked: true, grid: { color: '#e0e0e0' } },
                    y: { stacked: true, beginAtZero: true, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    // === RADAR ===
    else if (type === 'radar' && parsedData.labels && parsedData.datasets) {
        var datasets = parsedData.datasets.map(function(ds, i) {
            var color = colors[i % colors.length];
            return {
                label: ds.label || 'Series ' + (i+1),
                data: ds.values || [],
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                pointRadius: 4
            };
        });
        
        config = {
            type: 'radar',
            data: {
                labels: parsedData.labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Radar Chart', font: { size: 16, weight: 'bold' } }
                },
                scales: {
                    r: { beginAtZero: true, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    // === COMPARE ===
    else if (type === 'compare' && parsedData.graphs) {
        var datasets = parsedData.graphs.map(function(g, i) {
            var color = colors[i % colors.length];
            var data = (g.points || []).map(function(p) {
                return { x: p.x || 0, y: p.y || 0 };
            });
            return {
                label: g.label || 'Series ' + (i+1),
                data: data,
                borderColor: color,
                backgroundColor: color + '20',
                pointRadius: 4,
                pointBackgroundColor: color,
                tension: 0.3,
                showLine: true,
                fill: false
            };
        });
        
        config = {
            type: 'scatter',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Comparison Chart', font: { size: 16, weight: 'bold' } },
                    legend: { position: 'bottom' }
                },
                scales: {
                    x: { type: 'linear', title: { display: true, text: parsedData.xAxis?.label || 'x' }, grid: { color: '#e0e0e0' } },
                    y: { title: { display: true, text: parsedData.yAxis?.label || 'y' }, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    // === HISTOGRAM ===
    else if (type === 'histogram' && parsedData.bins && parsedData.counts) {
        config = {
            type: 'bar',
            data: {
                labels: parsedData.bins,
                datasets: [{
                    label: parsedData.title || 'Frequency',
                    data: parsedData.counts,
                    backgroundColor: 'rgba(52,152,219,0.7)',
                    borderColor: '#2c3e50',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: parsedData.title || 'Histogram', font: { size: 16, weight: 'bold' } },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: parsedData.xLabel || '' }, grid: { color: '#e0e0e0' } },
                    y: { beginAtZero: true, title: { display: true, text: parsedData.yLabel || 'Frequency' }, grid: { color: '#e0e0e0' } }
                }
            }
        };
    }
    
    if (config) {
        try {
            var chart = new Chart(ctx, config);
            if (window.RendererManager) {
                RendererManager.registerChart(chart);
            }
        } catch(e) {
            console.error('Chart rendering error:', e);
            canvas.parentElement.innerHTML = '<div style="padding:20px;text-align:center;color:#e74c3c;">📊 차트 렌더링 오류</div>';
        }
    }
}

// ========================================================================
// BLOCK 1280: 메인 renderGraphic 함수 (SAT 모든 타입 통합)
// ========================================================================
function decodeGraphicHtmlEntities(text) {
    if (typeof text !== 'string' || text.indexOf('&') < 0) return text;
    try {
        var textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    } catch (e) {
        return text;
    }
}

function parseGraphicPayload(jsonData) {
    if (jsonData === null || jsonData === undefined) return null;

    if (typeof jsonData === 'object') {
        return Array.isArray(jsonData) ? null : jsonData;
    }

    var data = String(jsonData).trim();
    if (!data) return null;

    var emptyMarkers = ['null', 'undefined', 'none', 'n/a', 'na', '-', 'no graphic', 'no data'];
    if (emptyMarkers.indexOf(data.toLowerCase()) >= 0) return null;

    data = decodeGraphicHtmlEntities(data)
        .replace(/^\uFEFF/, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();

    var candidate = data;
    for (var attempt = 0; attempt < 3; attempt++) {
        try {
            var parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'string') {
                candidate = parsed.trim();
                continue;
            }
            return null;
        } catch (e) {
            if (attempt === 0) {
                var cleaned = candidate;
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                    cleaned = cleaned.slice(1, -1);
                }
                cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
                if (cleaned !== candidate) {
                    candidate = cleaned;
                    continue;
                }
            }
            return null;
        }
    }
    return null;
}

function renderGraphic(jsonData) {
    var parsedData = parseGraphicPayload(jsonData);
    if (!parsedData) return "";

    // Legacy JSON intentionally has no engine field and continues through the
    // established renderer below without any conversion or behavior change.
    if (isSuperGraphicPayload(parsedData)) {
        return renderSuperGraphicPayload(parsedData);
    }

    var type = String(parsedData.type || '').trim();
    if (!type) return "";

    // ★★★ scatter-only를 먼저 처리 (Chart.js 직접 렌더링) ★★★
    if (type === 'scatter-only' && parsedData.points && Array.isArray(parsedData.points)) {
        var canvasId = 'chart_' + Math.random().toString(36).substr(2, 9);
        var html = '<div style="margin:15px 0;padding:15px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">' +
            '<canvas id="' + canvasId + '" style="width:100%;height:400px;display:block;"></canvas>' +
            '</div>';

        // Chart.js 렌더링 (setTimeout으로 DOM 준비 후 실행)
        setTimeout(function () {
            var canvas = document.getElementById(canvasId);
            if (!canvas) return;
            var ctx = canvas.getContext('2d');

            if (typeof Chart !== 'undefined') {
                try {
                    new Chart(ctx, {
                        type: 'scatter',
                        data: {
                            datasets: [{
                                label: 'Data',
                                data: parsedData.points,
                                backgroundColor: '#3498db',
                                borderColor: '#2980b9',
                                pointRadius: 6,
                                pointHoverRadius: 8
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            return '(' + context.parsed.x + ', ' + context.parsed.y + ')';
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    min: parsedData.xAxis?.min !== undefined ? parsedData.xAxis.min : undefined,
                                    max: parsedData.xAxis?.max !== undefined ? parsedData.xAxis.max : undefined,
                                    ticks: {
                                        stepSize: parsedData.xAxis?.tick || 1
                                    },
                                    title: {
                                        display: true,
                                        text: parsedData.xAxis?.label || 'x'
                                    },
                                    grid: { color: '#e0e0e0' }
                                },
                                y: {
                                    min: parsedData.yAxis?.min !== undefined ? parsedData.yAxis.min : undefined,
                                    max: parsedData.yAxis?.max !== undefined ? parsedData.yAxis.max : undefined,
                                    ticks: {
                                        stepSize: parsedData.yAxis?.tick || 1
                                    },
                                    title: {
                                        display: true,
                                        text: parsedData.yAxis?.label || 'y'
                                    },
                                    grid: { color: '#e0e0e0' }
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error('❌ Chart.js scatter error:', e);
                }
            } else {
                console.warn('⚠️ Chart.js not loaded');
                canvas.parentElement.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">📊 Chart.js 로딩 중...</div>';
            }
        }, 150);

        return html;
    }

    // ★★★ SAT 모든 그래픽 타입 지원 (기존 switch문) ★★★
    switch (type) {
        case 'graphic':
            return renderGraphicType(parsedData);
        case 'shape':
            return renderShapeType(parsedData);
        case 'geometry-2d':
        case 'geometry2d':
        case 'geometry':
            return renderGeometry2D(parsedData);
        case 'equation-graph':
        case 'equation':
        case 'linear-graph':
        case 'quadratic-graph':
        case 'absolute-value':
        case 'exponential-graph':
        case 'circle-equation':
        case 'system-of-equations':
        case 'inequality-graph':
        case 'coordinate-plane':
        case 'function':
            return renderEquationGraph(parsedData);
        case 'box-plot':
        case 'boxplot':
            return renderBoxPlotType(parsedData);
        case 'normal-distribution':
        case 'normal':
            return renderNormalDistributionType(parsedData);
        case 'table':
        case 'frequency-table':
            return renderTableType(parsedData);
        case 'bar':
        case 'pie':
        case 'line':
        case 'scatter':
        case 'dot-plot':
        case 'stacked-bar':
        case 'radar':
        case 'compare':
        case 'histogram':
            return renderChartType(parsedData);
        default:
            return '<div style="padding:10px;text-align:center;color:#999;border:1px dashed #ddd;border-radius:8px;margin:15px 0;">' +
                '<span style="font-size:20px;">📊</span>' +
                '<p style="margin-top:8px;">Graph type "<strong>' + escapeHtml(type) + '</strong>" is not supported.</p>' +
                '</div>';
    }
}

// ========================================================================
// BLOCK 1290: renderGraphic 전역 노출
// ========================================================================
window.renderGraphic = renderGraphic;

// ========================================================================
// BLOCK 1300: 문제 렌더링 (원본 B011 renderCurrentQuestion + renderSubjectiveQuestion + showExplanation)
// ========================================================================

// ========================================================================
// BLOCK 1310: renderSubjectiveQuestion (원본 B011)
// ========================================================================
function renderSubjectiveQuestion(q, answered, headerText, passageHtml) {
  var isAnswered = (answered !== null && answered !== undefined && answered !== -1);
  var correctAnswerText = String(q.A || q.answer || 'Answer not available').trim();
  var revealLearn = currentMode === 'learn';
  var revealExam = currentMode === 'exam' && examFinished && isAnswered;
  var revealStudy = currentMode === 'study' && isAnswered;

  var html = '<div class="question-card">' +
    '<div class="q-num">' + headerText + '</div>' +
    passageHtml +
    renderGraphic(q.graphic) +
    renderQuestionLanguageBlock(q, detectMathQuestion(q));

  if (currentMode === 'learn') {
    html += '<div class="learn-panel revealed">' +
      '<div class="learn-correct-answer">Correct Answer: ' + escapeHtml(correctAnswerText) + '</div>' +
      renderExplanationLanguageBlock(q) +
      '</div>';
  } else if (!isAnswered || (currentMode === 'exam' && !examFinished)) {
    html += '<div class="subjective-input-group">' +
      '<input type="text" id="subjectiveInput" value="' + (isAnswered ? escapeHtml(String(answered)) : '') + '" placeholder="Enter your answer">' +
      '<button onclick="submitSubjective()">Submit</button>' +
      '</div>';
  }

  if (revealStudy || revealExam) {
    var userAns = String(answered).trim();
    var isCorrect = (userAns === correctAnswerText) ||
      (!isNaN(parseFloat(userAns)) && parseFloat(userAns) === parseFloat(correctAnswerText));
    var statusColor = isCorrect ? '#27ae60' : '#e74c3c';

    html += '<div style="margin-top:15px;padding:15px;background:#f8f9fa;border-radius:8px;border-left:4px solid #666;">' +
      '<div style="font-size:14px;color:#666;">Your answer: <strong>' + escapeHtml(userAns) + '</strong></div>' +
      '</div>' +
      '<div class="subjective-result" style="background:' + statusColor + ';">' +
      'Answer: ' + escapeHtml(correctAnswerText) +
      '</div>' +
      '<div class="subjective-explanation"><strong>Explanation</strong>' +
      renderExplanationLanguageBlock(q) +
      '</div>';
  }

  html += '</div>';
  DOM.questionContainer.innerHTML = html;

  var input = document.getElementById('subjectiveInput');
  if (input) {
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') submitSubjective();
    });
  }

  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([DOM.questionContainer]).catch(console.warn);
  }

  DOM.explanationBox.classList.remove('show');

  var isLastQuestion = (currentIndex >= currentQuestions.length - 1);
  if (isLastQuestion) {
    DOM.nextBtn.style.display = 'none';
    DOM.submitBtn.style.display = 'inline-block';
    DOM.submitBtn.innerHTML = 'SUBMIT (Enter)';
    var canSubmit = currentMode === 'learn' || isAnswered;
    DOM.submitBtn.disabled = !canSubmit;
    DOM.submitBtn.style.background = canSubmit ? '#27ae60' : '#95a5a6';
    DOM.submitBtn.style.color = canSubmit ? 'white' : '#666';
  } else {
    DOM.nextBtn.style.display = 'inline-block';
    DOM.nextBtn.innerHTML = 'NEXT (N)';
    DOM.submitBtn.style.display = 'none';
  }
  DOM.prevBtn.disabled = (currentIndex === 0);
}



// ========================================================================
// BLOCK 1320: showExplanation (원본 B011)
// ========================================================================
function showExplanation(force) {
  if (currentMode === 'exam' && !examFinished && force !== true) {
    DOM.explanationBox.classList.remove('show');
    return;
  }

  var q = currentQuestions[currentIndex];
  var ans = userAnswers[currentIndex];
  if (!q) {
    DOM.explanationBox.classList.remove('show');
    return;
  }

  if (currentMode === 'learn' && isLearnRevealed(currentIndex)) {
    var hasLearnChoices = hasRealChoices(q);
    DOM.explanationText.innerHTML =
      (hasLearnChoices ? '' :
        '<div class="learn-correct-answer">Correct Answer: ' +
        escapeHtml(String(q.A || q.answer || '')) +
        '</div>') +
      renderExplanationLanguageBlock(q);
    DOM.explanationBox.classList.add('show');
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([DOM.explanationText]).catch(console.warn);
    }
    return;
  }

  if (ans === null || ans === undefined || ans === -1) {
    DOM.explanationBox.classList.remove('show');
    return;
  }
  var hasChoices = hasRealChoices(q);
  if (!hasChoices) {
    var correctAns = '';
    if (q.A && q.A !== '') {
      correctAns = String(q.A).trim();
    } else if (q.answer && q.answer !== '' && q.answer !== '0') {
      correctAns = String(q.answer).trim();
    } else {
      correctAns = 'Answer not available';
    }
    var userAns = String(ans).trim();
    var isCorrect = (userAns === correctAns) || (parseFloat(userAns) === parseFloat(correctAns));
    var statusColor = isCorrect ? '#27ae60' : '#e74c3c';
    DOM.explanationText.innerHTML =
      '<div style="background:' + statusColor + ';color:white;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:700;margin-bottom:15px;">' +
      'Answer: ' + escapeHtml(correctAns) +
      '</div>' +
      '<div style="margin-top:8px;font-size:14px;color:#555;">' +
      'Your answer: <strong>' + escapeHtml(userAns) + '</strong>' +
      '</div>' +
      renderExplanationLanguageBlock(q);
    DOM.explanationBox.classList.add('show');
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([DOM.explanationText]).catch(console.warn);
    }
    return;
  }
  var validKeys = getValidChoiceKeys(q.choices);
  var originalAnswerKey = String(q.answer);
  var originalAnswerText = q.choices[originalAnswerKey] || '';
  var actualAnswerKey = null;
  for (var i = 0; i < validKeys.length; i++) {
    var key = validKeys[i];
    if (q.choices[key] === originalAnswerText) {
      actualAnswerKey = key;
      break;
    }
  }
  var displayAnswerIndex = actualAnswerKey !== null ? validKeys.indexOf(actualAnswerKey) + 1 : parseInt(originalAnswerKey);
  var userAnswerLetter = getAnswerLetter(ans);
  var correctAnswerLetter = getAnswerLetter(displayAnswerIndex);
  var isCorrect = (ans === displayAnswerIndex);
  var statusColor = isCorrect ? '#27ae60' : '#e74c3c';
  DOM.explanationText.innerHTML =
    '<div style="background:' + statusColor + ';color:white;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:700;margin-bottom:15px;">' +
    'Answer: ' + correctAnswerLetter +
    '</div>' +
    '<div style="margin-top:8px;font-size:14px;color:#555;">' +
    'Your answer: <strong>' + userAnswerLetter + '</strong>' +
    '</div>' +
    renderExplanationLanguageBlock(q);
  DOM.explanationBox.classList.add('show');
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([DOM.explanationText]).catch(console.warn);
  }
}

// ========================================================================
// BLOCK 1330: renderCurrentQuestion (수정 - 수식만 LaTeX 처리)
// ========================================================================
function attachBiblePlacesButton_(q) {
  var sourceCode = getBibleSourceCode_(q);
  if (!/^(OT|NT)-/.test(sourceCode || '')) return;
  var card = DOM.questionContainer.querySelector('.question-card');
  if (!card || card.querySelector('[data-bible-verse-places]')) return;
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'bible-verse-places-button';
  button.setAttribute('data-bible-verse-places', sourceCode);
  button.textContent = '📍 Places in this passage';
  button.addEventListener('click', function() {
    if (typeof window.openBiblePlacesForSource === 'function') {
      window.openBiblePlacesForSource(sourceCode);
    }
  });
  var number = card.querySelector('.q-num');
  if (number) number.insertAdjacentElement('afterend', button);
  if (!card.querySelector('[data-bible-verse-knowledge]')) {
    var knowledgeButton = document.createElement('button');
    knowledgeButton.type = 'button';
    knowledgeButton.className = 'bible-verse-knowledge-button';
    knowledgeButton.setAttribute('data-bible-verse-knowledge', sourceCode);
    knowledgeButton.textContent = 'Topics in this passage';
    knowledgeButton.addEventListener('click', function() {
      if (typeof window.openBibleKnowledgeForSource === 'function') {
        window.openBibleKnowledgeForSource(sourceCode);
      }
    });
    button.insertAdjacentElement('afterend', knowledgeButton);
    var commentaryButton = document.createElement('button');
    commentaryButton.type = 'button';
    commentaryButton.className = 'bible-verse-knowledge-button';
    commentaryButton.setAttribute('data-bible-verse-commentary', sourceCode);
    commentaryButton.textContent = 'Commentary';
    commentaryButton.addEventListener('click', function() {
      if (typeof window.openBibleCommentaryForSource === 'function') {
        window.openBibleCommentaryForSource(sourceCode);
      }
    });
    knowledgeButton.insertAdjacentElement('afterend', commentaryButton);
  }
}

function bibleEscapeRegExp_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attachBibleEnglishEntityLinks_(q) {
  var root = DOM.questionContainer;
  var sourceCode = getBibleSourceCode_(q);
  if (!root || !/^(OT|NT)-/.test(sourceCode || '') || !root.querySelector('.language-line-en')) return;
  Promise.all([biblePeopleLoadNameIndex_(), biblePeopleLoadContextLinks_()]).then(function(results) {
    if (DOM.questionContainer !== root) return;
    var people = results[0] || {};
    var context = results[1] || {};
    var names = {};
    Object.keys(people).forEach(function(personId) {
      var name = String(people[personId] && people[personId].name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      var key = name.toLowerCase();
      if (!name || name.length < 3 || /^(god|lord|man|woman|king|son|father)$/i.test(name)) return;
      names[key] = names[key] === undefined ? { name: key, kind: 'person', id: personId } : null;
    });
    var sourcePlaces = (context.source_to_places && context.source_to_places[sourceCode]) || [];
    sourcePlaces.forEach(function(placeId) {
      var place = context.geocoding_places && context.geocoding_places[placeId];
      if (place && place.name) names[String(place.name).toLowerCase()] = { name: String(place.name).toLowerCase(), kind: 'place', nameToOpen: place.name };
    });
    var fullText = Array.from(root.querySelectorAll('.language-line-en')).map(function(node) { return node.textContent || ''; }).join(' ').toLowerCase();
    var candidates = Object.keys(names).map(function(key) { return names[key]; }).filter(Boolean)
      .filter(function(item) { return fullText.indexOf(item.name) >= 0; })
      .sort(function(a, b) { return b.name.length - a.name.length; }).slice(0, 24);
    if (!candidates.length) return;
    var lookup = {};
    candidates.forEach(function(item) { lookup[item.name] = item; });
    var matcher = new RegExp('\\b(' + Object.keys(lookup).map(bibleEscapeRegExp_).join('|') + ')\\b', 'gi');
    root.querySelectorAll('.language-line-en').forEach(function(block) {
      var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(function(textNode) {
        if (!textNode.parentElement || textNode.parentElement.closest('button,a')) return;
        var text = textNode.nodeValue;
        matcher.lastIndex = 0;
        if (!matcher.test(text)) return;
        matcher.lastIndex = 0;
        var fragment = document.createDocumentFragment();
        var cursor = 0;
        text.replace(matcher, function(match, name, offset) {
          fragment.appendChild(document.createTextNode(text.slice(cursor, offset)));
          var item = lookup[String(name).toLowerCase()];
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'bible-inline-entity-link bible-inline-' + item.kind;
          button.textContent = match;
          button.title = item.kind === 'person' ? 'Open Bible People' : 'Open Atlas';
          button.addEventListener('click', function() {
            if (item.kind === 'person') {
              biblePeopleOpen_();
              biblePeopleLoadDetail_(item.id);
            } else if (typeof window.openBibleContext === 'function') {
              window.openBibleContext({ tab: 'places', placeName: item.nameToOpen });
            }
          });
          fragment.appendChild(button);
          cursor = offset + match.length;
          return match;
        });
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        textNode.parentNode.replaceChild(fragment, textNode);
      });
    });
  }).catch(function(error) { console.warn('Bible entity links unavailable:', error.message); });
}

function renderCurrentQuestion() {
  console.log('🔴 renderCurrentQuestion START');
  updateBiblePassageControls_();
  
  var token = generateRenderToken();
  currentRenderToken = token;
  LOG.debug(`🔑 Render token: ${token.toString()}`);
  
  RendererManager.disposeCurrent();
  
  if (!currentQuestions.length || currentIndex >= currentQuestions.length) {
    DOM.questionContainer.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error: Cannot load question</div>';
    return;
  }
  
  var q = currentQuestions[currentIndex];
  if (!q) {
    DOM.questionContainer.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error: Invalid question data</div>';
    return;
  }
  
  console.log('🔍 Current question:', q);
  console.log('🔍 q.question:', q.question);
  console.log('🔍 q.choices:', q.choices);
  
  var answered = userAnswers[currentIndex];
  updateProgressDisplay();
  
  var actualNumber = q.originalNumber || (currentStartNumber + currentIndex);
  var headerText = LANG.qPrefix + ' ' + (currentIndex + 1) + ' ' + LANG.of + ' ' + currentQuestions.length + ' ' + LANG.originalPrefix + actualNumber + LANG.originalSuffix;
  if (isReviewMode) {
    headerText = LANG.reviewModeQuestionPrefix + ' ' + (currentIndex + 1) + ' ' + LANG.of + ' ' + currentQuestions.length + ' ' + LANG.originalPrefix + actualNumber + LANG.originalSuffix;
  }
  
  var hasChoices = hasRealChoices(q);
  var isSubjective = !hasChoices;
  var isMath = detectMathQuestion(q);
  
  var passageHtml = renderPassageLanguageBlock(q, isMath);
  var questionDisplay = renderQuestionLanguageBlock(q, isMath);

  if (!bibleQuizVisible) {
    var reading = getBibleReadingPosition_();
    var reference = getBiblePassageReference_(q, 'WEB') || getBibleSourceCode_(q);
    DOM.questionContainer.innerHTML =
      '<div class="question-card bible-reading-card">' +
      '<div class="q-num">Bible Reading · ' + escapeHtml(reference) + '</div>' +
      passageHtml +
      '</div>';
    DOM.explanationBox.classList.remove('show');
    DOM.skipBtn.style.display = 'none';
    DOM.submitBtn.style.display = 'none';
    DOM.nextBtn.style.display =
      reading.position < reading.indexes.length - 1 ? 'inline-block' : 'none';
    DOM.nextBtn.innerHTML = 'NEXT VERSE (N)';
    DOM.prevBtn.disabled = reading.position === 0;
    attachBiblePlacesButton_(q);
    attachBibleEnglishEntityLinks_(q);
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([DOM.questionContainer]).catch(console.warn);
    }
    return;
  }

  DOM.skipBtn.style.display = 'inline-block';

  if (isSubjective) {
    renderSubjectiveQuestion(q, answered, headerText, passageHtml);
    attachBiblePlacesButton_(q);
    attachBibleEnglishEntityLinks_(q);
    return;
  }
  
  var validKeys = getValidChoiceKeys(q.choices);
  var originalAnswerKey = String(q.answer);
  var originalAnswerText = q.choices[originalAnswerKey] || '';
  var actualAnswerKey = null;
  for (var i = 0; i < validKeys.length; i++) {
    var key = validKeys[i];
    if (q.choices[key] === originalAnswerText) {
      actualAnswerKey = key;
      break;
    }
  }
  var displayAnswer = actualAnswerKey !== null ? validKeys.indexOf(actualAnswerKey) + 1 : parseInt(originalAnswerKey);
  
  var html = '<div class="question-card">' +
    '<div class="q-num">' + headerText + '</div>' +
    passageHtml +
    renderGraphic(q.graphic) +
    questionDisplay +
    '<div class="choices">';
  
  for (var idx = 0; idx < validKeys.length; idx++) {
    var key = validKeys[idx];
    var choiceNum = parseInt(key);
    var letter = getAnswerLetter(idx + 1);
    var choiceText = renderChoiceLanguageBlock(q, key);
    if (!choiceText) continue;
    var isSelected = (parseInt(answered, 10) === choiceNum);
    var isCorrectChoice = (choiceNum === displayAnswer);
    var hasAnswer = (answered !== null && answered !== undefined && answered !== -1);
    var showLearnAnswer = currentMode === 'learn' && isLearnRevealed(currentIndex);
    var showStudyAnswer = currentMode === 'study' && hasAnswer;
    var showExamReview = currentMode === 'exam' && examFinished && hasAnswer;
    var cls = 'choice';

    if (currentMode === 'learn') {
      cls += ' learn-choice disabled';
      if (isCorrectChoice) cls += ' correct';
    } else if (currentMode === 'exam' && !examFinished) {
      if (isSelected) cls += ' selected';
    } else if (showStudyAnswer || showExamReview) {
      cls += ' disabled';
      if (isCorrectChoice) cls += ' correct';
      if (isSelected && !isCorrectChoice) cls += ' incorrect';
    }
    html += '<div class="' + cls + '" data-choice="' + choiceNum + '">' +
      '<span class="choice-letter">' + letter + '</span>' +
      '<span class="math-content">' + choiceText + '</span>' +
      '</div>';
  }
  html += '</div>';

  if (currentMode === 'learn') {
    html += renderLearnPanel(q, displayAnswer);
  }

  html += '</div>';

  DOM.questionContainer.innerHTML = html;
  attachBiblePlacesButton_(q);
  attachBibleEnglishEntityLinks_(q);
  console.log('✅ Question rendered');
  
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([DOM.questionContainer])
      .then(function() {
        if (isRenderValid(token)) {
          console.log('✅ MathJax rendering complete');
        }
      })
      .catch(function(err) {
        console.warn('⚠️ MathJax rendering error:', err);
      });
  } else {
    console.warn('⚠️ MathJax not available. LaTeX will not render.');
  }
  
  // ★★★ handleChoiceClick 사용 (전역 함수) ★★★
  var choiceEls = DOM.questionContainer.querySelectorAll('.choice:not(.disabled)');
  choiceEls.forEach(function(el) {
    el.removeEventListener('click', handleChoiceClick);
    el.addEventListener('click', handleChoiceClick);
  });
  
  if (currentMode === 'learn') {
    showExplanation(true);
  } else if (currentMode === 'study' &&
             answered !== null && answered !== undefined && answered !== -1) {
    showExplanation();
  } else if (currentMode === 'exam' && examFinished &&
             answered !== null && answered !== undefined && answered !== -1) {
    showExplanation(true);
  } else {
    DOM.explanationBox.classList.remove('show');
  }
  
  var isLastQuestion = (currentIndex >= currentQuestions.length - 1);
  if (isLastQuestion) {
    DOM.nextBtn.style.display = 'none';
    DOM.submitBtn.style.display = 'inline-block';
    DOM.submitBtn.innerHTML = 'SUBMIT (Enter)';
    var isAnswered = (answered !== null && answered !== undefined && answered !== -1);
    var canSubmit = (currentMode === 'learn') ? true : isAnswered;
    DOM.submitBtn.disabled = !canSubmit;
    DOM.submitBtn.style.background = canSubmit ? '#27ae60' : '#95a5a6';
    DOM.submitBtn.style.color = canSubmit ? 'white' : '#666';
  } else {
    DOM.nextBtn.style.display = 'inline-block';
    DOM.nextBtn.innerHTML = 'NEXT (N)';
    DOM.submitBtn.style.display = 'none';
  }
  DOM.prevBtn.disabled = (currentIndex === 0);
}

// ========================================================================
// BLOCK 1335: handleChoiceClick (전역 함수로 분리)
// ========================================================================
function handleChoiceClick(e) {
  var el = e.currentTarget;
  var choice = parseInt(el.getAttribute('data-choice'));
  if (isNaN(choice)) return;

  if (currentMode === 'learn') {
    revealLearnAnswer();
    return;
  }

  userAnswers[currentIndex] = choice;
  calculateCorrectCount();
  saveProgressImmediate();
  renderCurrentQuestion();

  if (currentMode === 'study') {
    showExplanation();
  }
}

// ========================================================================
// BLOCK 1400: 이벤트 및 초기화 (원본 B012)
// ========================================================================

// ========================================================================
// BLOCK 1410: 키보드 이벤트
// ========================================================================
function attachKeyboardEvents() {
  document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && (event.key === 'c' || event.key === 'v' || event.key === 'x' || event.key === 'a' ||
        event.key === 'C' || event.key === 'V' || event.key === 'X' || event.key === 'A')) {
      return;
    }
    if (!DOM.quizContent || DOM.quizContent.style.display === 'none' || DOM.quizContent.style.display === '') return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    var key = event.key;
    if (/^[1-4]$/.test(key)) {
      var choice = DOM.questionContainer &&
        DOM.questionContainer.querySelector('.choice:not(.disabled)[data-choice="' + key + '"]');
      if (choice) {
        event.preventDefault();
        choice.click();
      }
      return;
    }
    if (key === 'n' || key === 'N' || key === 'L') {
      event.preventDefault();
      if (currentIndex < currentQuestions.length - 1) goNext();
      return;
    }
    if (key === 'p' || key === 'P' || key === 'H') {
      event.preventDefault();
      if (currentIndex > 0) goPrev();
      return;
    }
    if (key === 's' || key === 'S' || key === 'A') {
      event.preventDefault();
      skipQuestion();
      return;
    }
    if (key === 'Enter') {
      if (currentIndex >= currentQuestions.length - 1 && DOM.submitBtn && DOM.submitBtn.style.display !== 'none') {
        var isAnswered = (userAnswers[currentIndex] !== null && userAnswers[currentIndex] !== undefined && userAnswers[currentIndex] !== -1);
        if (currentMode === 'learn' || isAnswered) {
          event.preventDefault();
          showResults();
        }
      }
      return;
    }
    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (currentIndex > 0) goPrev();
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      if (currentIndex < currentQuestions.length - 1) goNext();
      return;
    }
  });
}

// ========================================================================
// BLOCK 1420: UI 이벤트 (onclick 방식으로 중복 방지)
// ========================================================================
function attachEvents() {
  var continueBtn = DOM.progressContinueBtn;
  if (continueBtn) {
    continueBtn.addEventListener('click', function() {
      var modal = DOM.progressModal;
      var savedData = modal.getAttribute('data-saved');
      if (savedData) {
        var saved = JSON.parse(savedData);
        modal.style.display = 'none';
        resumeProgress(saved);
      }
    });
  }
  var cancelBtn = DOM.progressCancelBtn;
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      DOM.progressModal.style.display = 'none';
      clearProgress();
      var startNum = parseInt(DOM.startNumberInput.value) || 1;
      startQuizWithNumber(startNum);
    });
  }
  DOM.startQuizBtn.addEventListener('click', function() {
    var startNum = parseInt(DOM.startNumberInput.value);
    if (isNaN(startNum) || DOM.startNumberInput.value === "") startNum = 1;
    if (startNum < 1) startNum = 1;
    if (startNum > TOTAL_QUESTIONS) startNum = TOTAL_QUESTIONS;
    clearProgress();
    startQuizWithNumber(startNum);
  });
  DOM.startNumberInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      DOM.startQuizBtn.click();
    }
  });
  DOM.prevBtn.addEventListener('click', goPrev);
  DOM.nextBtn.addEventListener('click', goNext);
  DOM.skipBtn.addEventListener('click', skipQuestion);
  DOM.submitBtn.addEventListener('click', showResults);
  DOM.quitBtn.addEventListener('click', function() {
    saveProgress();
    if (confirm(LANG.confirmExit)) window.location.reload();
  });
  DOM.retryAllBtn.addEventListener('click', function() {
    clearProgress();
    DOM.resultModal.style.display = 'none';
    startQuizWithNumber(currentStartNumber);
  });
  DOM.reviewWrongBtn.addEventListener('click', function() {
    DOM.resultModal.style.display = 'none';
    showWrongAnswersList();
  });
  DOM.closeModalBtn.addEventListener('click', function() {
    DOM.resultModal.style.display = 'none';
  });
  DOM.closeWrongBtn.addEventListener('click', function() {
    DOM.wrongModal.style.display = 'none';
  });
  DOM.retryWrongFromReviewBtn.addEventListener('click', startWrongOnlyReview);
  DOM.splashRetry.addEventListener('click', function() {
    DOM.splashError.style.display = 'none';
    DOM.splashRetry.style.display = 'none';
    DOM.splashStatus.textContent = 'Retrying...';
    initialize();
  });
  attachKeyboardEvents();
}

// ========================================================================
// BLOCK 1430: 진행 모달
// ========================================================================
function showProgressModal(saved) {
  var answered = saved.userAnswers.filter(function(a) { return a !== null && a !== -1; }).length;
  var total = saved.currentQuestions.length;
  var progress = saved.currentIndex + 1;
  DOM.progressModalBody.innerHTML = '<div style="padding:10px 0;">' +
    '<p style="font-size:22px;font-weight:700;color:#2c3e50;text-align:center;margin-bottom:10px;">📊 Resume Session</p>' +
    '<div style="background:#f8f9fa;border-radius:12px;padding:16px 20px;margin:15px 0;">' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Mode</span><strong>' + ((MODE_INFO[normalizeMode(saved.currentMode)] || MODE_INFO.study).label) + '</strong></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Progress</span><strong>' + progress + ' / ' + total + '</strong></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Answered</span><strong>' + answered + ' / ' + total + '</strong></div>' +
    '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Correct</span><strong>' + (saved.correctCount || 0) + '</strong></div>' +
    '</div>' +
    '<p style="font-size:13px;color:#999;text-align:center;margin-top:10px;">' +
    'Click <strong>"Continue"</strong> to resume. Click <strong>"Start Fresh"</strong> to begin again.' +
    '</p>' +
    '</div>';
  DOM.progressModal.setAttribute('data-saved', JSON.stringify(saved));
  DOM.progressModal.style.display = 'flex';
}

function resumeProgress(saved) {
  currentQuestions = saved.currentQuestions;
  userAnswers = saved.userAnswers;
  currentIndex = saved.currentIndex || 0;
  correctCount = saved.correctCount || 0;
  currentStartNumber = saved.currentStartNumber || 1;
  currentMode = normalizeMode(saved.currentMode || currentMode);
  learnRevealed = saved.learnRevealed || {};
  examFinished = !!saved.examFinished;

  if (currentMode === 'learn') {
    for (var lr = 0; lr < currentQuestions.length; lr++) {
      learnRevealed[String(lr)] = true;
    }
  }

  updateModeUI();
  isReviewMode = saved.isReviewMode || false;
  if (saved.masterQuestions) masterQuestions = saved.masterQuestions;
  if (saved.originalQuestions) originalQuestions = saved.originalQuestions;
  
  if (saved.cdnLoaded) {
    Object.keys(saved.cdnLoaded).forEach(function(key) {
      if (LOADER[key]) LOADER[key].loaded = saved.cdnLoaded[key];
    });
  }
  
  startAutoSave();
  DOM.setupSection.style.display = 'none';
  DOM.quizMain.style.display = 'block';
  if (DOM.quizContent) DOM.quizContent.style.display = 'block';
  if (DOM.progressArea) DOM.progressArea.style.display = 'flex';
  if (isReviewMode) {
    DOM.reviewBanner.style.display = 'block';
    DOM.reviewBanner.innerHTML = '<span>Review Mode: ' + currentQuestions.length + ' questions</span>' +
      '<button id="exitReviewBtn" class="exit-review-btn">EXIT REVIEW</button>';
    document.getElementById('exitReviewBtn').addEventListener('click', function() {
      clearProgress();
      window.location.reload();
    });
  }
  RendererManager.disposeCurrent();
  renderCurrentQuestion();
  
  if (!LOADER.chartjs.loaded || !LOADER.mathjax.loaded) {
    loadAllLibrariesInBackground();
  }
}

// ========================================================================
// BLOCK 1500: 퀴즈 시작 (원본 B013 + 백그라운드 로딩)
// ========================================================================
async function startQuizWithNumber(uiStartNumber, options) {
  if (IS_TRIAL_USER) {
    uiStartNumber = TRIAL_START;
    if (DOM.startNumberInput) DOM.startNumberInput.value = String(TRIAL_START);
    if (DOM.setSelector) DOM.setSelector.value = 'sample';
  }
  if (isNaN(uiStartNumber) || uiStartNumber < 1) uiStartNumber = 1;
  
  if (uiStartNumber > TOTAL_QUESTIONS) {
    console.log('🔄 Number ' + uiStartNumber + ' exceeds total ' + TOTAL_QUESTIONS + '. Looping back to 1.');
    uiStartNumber = 1;
  }
  
  var startNum = uiStartNumber;
  if (!(options && options.exactStart)) {
    var setNumber = Math.ceil(uiStartNumber / QUESTIONS_PER_SET);
    var setStart = (setNumber - 1) * QUESTIONS_PER_SET + 1;
    if (uiStartNumber < setStart || uiStartNumber > Math.min(setNumber * QUESTIONS_PER_SET, TOTAL_QUESTIONS)) {
      startNum = setStart;
    }
  }
  
  currentStartNumber = startNum;
  learnRevealed = {};
  examFinished = false;

  if (currentMode === 'learn') {
    for (var li = 0; li < currentQuestions.length; li++) {
      learnRevealed[String(li)] = true;
    }
  }
  
  var overlay = showLoadingOverlay('Loading questions...');
  try {
    var questions = await load50Questions(startNum);
    if (questions.length === 0) throw new Error('No question data received');
    masterQuestions = questions.slice();
    currentQuestions = masterQuestions.map(function(q) { return randomizeChoicesOnly(q); });
    userAnswers = new Array(currentQuestions.length).fill(null);
    correctCount = 0;
    currentIndex = 0;
    isReviewMode = false;
    startAutoSave();
    hideLoadingOverlay();
    DOM.setupSection.style.display = 'none';
    DOM.quizMain.style.display = 'block';
    
    if (DOM.quizContent) {
      DOM.quizContent.style.display = 'block';
    }
    if (DOM.progressArea) {
      DOM.progressArea.style.display = 'flex';
    }
    
    RendererManager.disposeCurrent();
    renderCurrentQuestion();
    
    console.log('📖 사용자 문제 읽는 중... 백그라운드 CDN 순차 로드 시작');
    loadAllLibrariesInBackground();
    
    resetTimer();
    // Timer always waits for the student's explicit Set and Start action.
    return true;
    
  } catch(err) {
    if (err.name === 'AbortError') {
      LOG.info('🛑 Request aborted, user navigated away');
      return false;
    }
    hideLoadingOverlay();
    alert(LANG.loadError + ' ' + err.message);
    console.error(err);
    return false;
  }
}

// ========================================================================
// BLOCK 1510: 시스템 초기화 (원본 B012 initialize)
// ========================================================================
function initialize() {
  if (!applySubjectConfig()) return;
  console.log('🔧 initialize() started');
  
  initDOM();
  renderAccountIdentity_();
  updateSubjectTitle(1);
  initLanguageSelector();
  initModeSelector();
  initTimer();
  attachEvents();
  initBibleTapFeedback_();
  initBibleLogout_();
  initBibleGuide_();
  initBibleGroupAdmin_();
  initBiblePeopleExplorer();

  // Keep the initial quiz screen responsive.  Non-SAT subjects prepare the
  // isolated Super Engine after the UI has already been displayed; SAT keeps
  // using the existing Legacy renderer unless a future question explicitly
  // requests engine:"super".
  setTimeout(function() {
    if (String(currentSubject || '').trim().toUpperCase() !== 'SAT') {
      preloadSuperGraphicEngine().catch(function(error) {
        console.warn('Super Graphic Engine background preload failed:', error);
      });
    }
  }, 1000);

  updateSplash(10, 'Connecting to server...');
  
  (async function() {
    try {
      await detectTotalQuestions();
      
      if (TOTAL_QUESTIONS === 0) {
        TOTAL_QUESTIONS = 720;
        localStorage.setItem(TOTAL_CACHE_KEY, String(TOTAL_QUESTIONS));
      }
      
      if (IS_TRIAL_USER) TOTAL_QUESTIONS = Math.min(TOTAL_QUESTIONS || TRIAL_LIMIT, TRIAL_LIMIT);
      updateSetSelector();
      
      updateSplash(60, IS_TRIAL_USER ? 'Preparing FREE TRIAL questions 1–20...' : 'Preparing data...');
      
      var maxStartNumber = TOTAL_QUESTIONS;
      console.log('📊 Total questions: ' + TOTAL_QUESTIONS);
      
      if (DOM.maxNumberSpan) DOM.maxNumberSpan.style.display = 'none';
      if (DOM.maxNumberDisplay) DOM.maxNumberDisplay.style.display = 'none';
      
      DOM.startNumberInput.placeholder = IS_TRIAL_USER ? 'FREE TRIAL: 1' : '1-' + TOTAL_QUESTIONS;
      DOM.startNumberInput.max = IS_TRIAL_USER ? TRIAL_START : TOTAL_QUESTIONS;
      DOM.startNumberInput.min = 1;
      if (IS_TRIAL_USER) {
        DOM.startNumberInput.value = String(TRIAL_START);
        DOM.startNumberInput.readOnly = true;
      }
      
      if (DOM.setSelector) {
        DOM.setSelector.addEventListener('change', function() {
          var setNum = IS_TRIAL_USER ? 1 : parseInt(this.value);
          if (IS_TRIAL_USER) this.value = 'sample';
          if (!isNaN(setNum) && setNum >= 1) {
            var startNum = (setNum - 1) * QUESTIONS_PER_SET + 1;
            DOM.startNumberInput.value = startNum;
            updateSubjectTitle(setNum);
            console.log('Set ' + setNum + ' selected, starting from question ' + startNum);
          }
        });
        if (DOM.setSelector.options.length > 0) {
          DOM.setSelector.value = IS_TRIAL_USER ? 'sample' : '1';
          DOM.startNumberInput.value = '';
        }
      }
      
      var saved = loadProgress();
      if (IS_TRIAL_USER && saved && !isTrialProgressSafe(saved)) {
        clearProgress();
        saved = null;
      }
      if (saved && saved.currentQuestions && saved.currentQuestions.length > 0) {
        var answered = saved.userAnswers.filter(function(a) { return a !== null && a !== -1; }).length;
        var timeStr = new Date(saved.timestamp).toLocaleString();
        DOM.savedBadgeContainer.innerHTML =
          '<div class="resume-badge" id="resumeBadge">' +
          '<div><div class="count">Resume previous lesson</div>' +
          '<div class="time">' + answered + ' / ' + saved.currentQuestions.length + ' answered · ' + timeStr + '</div></div>' +
          '<div class="hint">Continue ›</div>' +
          '</div>';
        DOM.savedBadgeContainer.hidden = false;
        var resumeBadge = document.getElementById('resumeBadge');
        if (resumeBadge) {
          resumeBadge.addEventListener('click', function(e) {
            e.stopPropagation();
            var savedData = loadProgress();
            if (savedData) showProgressModal(savedData);
          });
        }
      } else {
        DOM.savedBadgeContainer.innerHTML = '';
        DOM.savedBadgeContainer.hidden = true;
      }
      
      updateSplash(100, 'Ready!');
      
      hideSplash();
      DOM.setupSection.style.display = 'block';
      DOM.quizMain.style.display = 'block';
      
      setTimeout(function() { 
        if (DOM.startNumberInput) {
          DOM.startNumberInput.focus(); 
          DOM.startNumberInput.select(); 
        }
      }, 150);
      
      console.log('✅ Initialization complete: ' + TOTAL_QUESTIONS + ' total questions');
      
    } catch(e) {
      console.error('Initialization error:', e);
      showSplashError(e.message || 'Initialization failed');
    }
  })();
}

window.renderWithEditingMarks = renderWithEditingMarks;

// ========================================================================
// BLOCK 1590: 콘솔 그래픽 미리보기 도구
// ========================================================================
function previewGraphic(graphicData) {
    var hostId = 'graphic_preview_' + Math.random().toString(36).slice(2, 10);
    var host = document.createElement('div');
    host.id = hostId;
    host.style.cssText = 'max-width:760px;margin:20px auto;padding:12px;background:#fff;border:2px solid #f5a623;border-radius:12px;position:relative;z-index:99999;';
    document.body.appendChild(host);
    host.innerHTML = renderGraphic(graphicData);
    host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return hostId;
}

// ========================================================================
// BLOCK 1595: Admin on-page JSON and LaTeX preview
// ========================================================================
function initAdminPreviewTool() {
    if (!IS_ADMIN_USER || window.__gongbooAdminPreviewInstalled) return;
    var toggle = document.getElementById('adminPreviewToggle');
    var studioLink = document.getElementById('superGraphicStudioLink');
    var panel = document.getElementById('adminPreviewPanel');
    if (!toggle || !panel) return;
    window.__gongbooAdminPreviewInstalled = true;

    var closeBtn = document.getElementById('adminPreviewClose');
    var graphicInput = document.getElementById('adminGraphicInput');
    var graphicOutput = document.getElementById('adminGraphicOutput');
    var graphicStatus = document.getElementById('adminGraphicStatus');
    var mathInput = document.getElementById('adminMathInput');
    var mathOutput = document.getElementById('adminMathOutput');
    var mathStatus = document.getElementById('adminMathStatus');

    toggle.hidden = false;
    if (studioLink) studioLink.hidden = false;

    function setStatus(el, text, state) {
        if (!el) return;
        el.textContent = text;
        el.className = 'admin-preview-status' + (state ? ' ' + state : '');
    }

    function openPanel() {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    function renderGraphicPreview() {
        if (!graphicInput || !graphicOutput) return;
        var value = graphicInput.value.trim();
        if (!value) {
            graphicOutput.innerHTML = '<div class="admin-preview-empty">Graphic output appears here.</div>';
            setStatus(graphicStatus, 'Waiting for JSON.', '');
            return;
        }
        try {
            var html = renderGraphic(value);
            if (!html) throw new Error('No renderable graphic payload.');
            graphicOutput.innerHTML = html;
            setStatus(graphicStatus, 'Rendered.', 'success');
        } catch (error) {
            graphicOutput.innerHTML = '<div class="admin-preview-empty">Render failed.</div>';
            setStatus(graphicStatus, error.message || 'Graphic render failed.', 'error');
        }
    }

    async function renderMathPreview() {
        if (!mathInput || !mathOutput) return;
        var value = mathInput.value.trim();
        if (!value) {
            mathOutput.innerHTML = '<div class="admin-preview-empty">Math output appears here.</div>';
            setStatus(mathStatus, 'Waiting for math text.', '');
            return;
        }
        try {
            mathOutput.innerHTML = renderWithEditingMarks(value, true);
            await ensureMathJax();
            if (window.MathJax && window.MathJax.typesetPromise) {
                await window.MathJax.typesetPromise([mathOutput]);
            }
            setStatus(mathStatus, 'Rendered.', 'success');
        } catch (error) {
            mathOutput.textContent = value;
            setStatus(mathStatus, error.message || 'Math render failed.', 'error');
        }
    }

    toggle.addEventListener('click', function() {
        panel.hidden ? openPanel() : closePanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    var graphicRenderBtn = document.getElementById('adminGraphicRender');
    var graphicFormatBtn = document.getElementById('adminGraphicFormat');
    var graphicClearBtn = document.getElementById('adminGraphicClear');
    var mathRenderBtn = document.getElementById('adminMathRender');
    var mathClearBtn = document.getElementById('adminMathClear');
    if (graphicRenderBtn) graphicRenderBtn.addEventListener('click', renderGraphicPreview);
    if (graphicFormatBtn) graphicFormatBtn.addEventListener('click', function() {
        if (!graphicInput) return;
        try {
            var parsed = parseGraphicPayload(graphicInput.value);
            if (!parsed) throw new Error('Invalid graphic JSON.');
            graphicInput.value = JSON.stringify(parsed, null, 2);
            renderGraphicPreview();
        } catch (error) {
            setStatus(graphicStatus, error.message || 'Format failed.', 'error');
        }
    });
    if (graphicClearBtn) graphicClearBtn.addEventListener('click', function() {
        if (graphicInput) graphicInput.value = '';
        renderGraphicPreview();
    });
    if (mathRenderBtn) mathRenderBtn.addEventListener('click', renderMathPreview);
    if (mathClearBtn) mathClearBtn.addEventListener('click', function() {
        if (mathInput) mathInput.value = '';
        renderMathPreview();
    });
}

// ========================================================================
// BLOCK 1600: 내보내기 및 전역 노출 (최종본)
// ========================================================================

// 1. 전역(window) 노출
window.renderGraphic = renderGraphic;
window.renderEquationGraph = renderEquationGraph;
window.renderGeometry2D = renderGeometry2D;
window.previewGraphic = previewGraphic;
window.normalizeEquationExpression = normalizeEquationExpression;
window.currentQuestions = currentQuestions;    
window.currentIndex = currentIndex;            
window.userAnswers = userAnswers;
window.initialize = initialize;
window.startQuizWithNumber = startQuizWithNumber;
window.renderGraphic = renderGraphic;
window.renderCurrentQuestion = renderCurrentQuestion;
window.showExplanation = showExplanation;
window.goNext = goNext;
window.goPrev = goPrev;
window.skipQuestion = skipQuestion;
window.submitSubjective = submitSubjective;
window.showResults = showResults;
window.showWrongAnswersList = showWrongAnswersList;
window.startWrongOnlyReview = startWrongOnlyReview;
window.saveProgress = saveProgress;
window.loadProgress = loadProgress;
window.clearProgress = clearProgress;
window.attachEvents = attachEvents;
window.ensureChartJS = ensureChartJS;
window.ensureThreeJS = ensureThreeJS;
window.ensureMathJax = ensureMathJax;
window.ensureMathJS = ensureMathJS;
window.loadAllLibrariesInBackground = loadAllLibrariesInBackground;
window.showToast = showToast;
window.LOG = LOG;
window.LANG = LANG;
window.setLanguage = setLanguage;
window.setMode = setMode;
window.getCurrentMode = function() { return currentMode; };
window.getCurrentQuestionContext = function() {
  var q = currentQuestions[currentIndex] || null;
  if (!q) return null;

  var raw = q.raw && typeof q.raw === 'object' ? q.raw : {};
  var localized = q.localized || {};
  var choiceTranslations = q.choiceTranslations || {};

  return {
    N: q.N || q.originalNumber || raw.N || '',
    SUBJECT: q.subject || raw.SUBJECT || 'SAT',
    Q_EN: (localized.question && localized.question.EN) || raw.Q_EN || q.question || '',
    Q_KO: (localized.question && localized.question.KO) || raw.Q_KO || '',
    P_EN: (localized.passage && localized.passage.EN) || raw.P_EN || q.passage || '',
    P_KO: (localized.passage && localized.passage.KO) || raw.P_KO || '',
    '1_EN': (choiceTranslations['1'] && choiceTranslations['1'].EN) || raw['1_EN'] || '',
    '1_KO': (choiceTranslations['1'] && choiceTranslations['1'].KO) || raw['1_KO'] || '',
    '2_EN': (choiceTranslations['2'] && choiceTranslations['2'].EN) || raw['2_EN'] || '',
    '2_KO': (choiceTranslations['2'] && choiceTranslations['2'].KO) || raw['2_KO'] || '',
    '3_EN': (choiceTranslations['3'] && choiceTranslations['3'].EN) || raw['3_EN'] || '',
    '3_KO': (choiceTranslations['3'] && choiceTranslations['3'].KO) || raw['3_KO'] || '',
    '4_EN': (choiceTranslations['4'] && choiceTranslations['4'].EN) || raw['4_EN'] || '',
    '4_KO': (choiceTranslations['4'] && choiceTranslations['4'].KO) || raw['4_KO'] || '',
    A: q.A || q.answer || raw.A || '',
    E_EN: (localized.explanation && localized.explanation.EN) || raw.E_EN || q.explanation || '',
    E_KO: (localized.explanation && localized.explanation.KO) || raw.E_KO || '',
    G: q.graphic || raw.G || '',
    D: q.difficulty || raw.D || '',
    SOURCE_TYPE: q.sourceType || raw.SOURCE_TYPE || '',
    VARIANT_NO: q.variantNo || raw.VARIANT_NO || '',
    SOURCE_ID: q.sourceId || raw.SOURCE_ID || '',
    STATUS: q.status || raw.STATUS || '',
    currentIndex: currentIndex,
      currentMode: currentMode,
      currentSubject: currentSubject,
      subjectConfig: subjectConfig,
    currentLanguage: currentLanguage
  };
};
window.revealLearnAnswer = revealLearnAnswer;
window.getCurrentLanguage = function() { return currentLanguage; };
window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
window.DOM = DOM;
window.LOADER = LOADER;
window.RendererManager = RendererManager;
window.currentUser = currentUser;
window.currentSubject = currentSubject;
window.subjectConfig = subjectConfig;
window.availableSubjects = availableSubjects;
window.applySubjectConfig = applySubjectConfig;
window.gongbooLogout = clearAuthAndRedirect;

// ★★★★★ 유틸리티 함수 전역 노출 ★★★★★
window.escapeHtml = escapeHtml;
window.getAnswerLetter = getAnswerLetter;
window.hasRealChoices = hasRealChoices;
window.isSubjectiveQuestion = isSubjectiveQuestion;
window.getValidChoiceKeys = getValidChoiceKeys;
window.randomizeChoicesOnly = randomizeChoicesOnly;
window.autoWrapLatex = autoWrapLatex;
window.wrapPowerExpressionsSafely = wrapPowerExpressionsSafely;
window.detectMathQuestion = detectMathQuestion;
window.renderWithEditingMarks = renderWithEditingMarks;

// ★★★★★ 전역 변수 노출 (이 부분이 누락됨!) ★★★★★
window.TOTAL_QUESTIONS = TOTAL_QUESTIONS;
window.currentQuestions = currentQuestions;
window.userAnswers = userAnswers;
window.currentIndex = currentIndex;
window.correctCount = correctCount;
window.isReviewMode = isReviewMode;
window.currentStartNumber = currentStartNumber;
window.masterQuestions = masterQuestions;
window.originalQuestions = originalQuestions;

// 2. ES Module Export
export { 
  initialize, 
  startQuizWithNumber, 
  renderGraphic,
  renderEquationGraph,
  renderGeometry2D,
  previewGraphic,
  renderCurrentQuestion,
  showExplanation,
  goNext,
  goPrev,
  skipQuestion,
  submitSubjective,
  showResults,
  showWrongAnswersList,
  startWrongOnlyReview,
  saveProgress,
  loadProgress,
  clearProgress,
  ensureChartJS,
  ensureThreeJS,
  ensureMathJax,
  ensureMathJS,
  loadAllLibrariesInBackground,
  showToast,
  setLanguage,
  setMode,
  revealLearnAnswer,
  LOG,
  RendererManager
};

// ========================================================================
// BLOCK 9999: 시스템 시작 로그
// ========================================================================
console.log("✅ GongBoo Learning System v8.0D Trial / Paid / Admin Auth Loaded!");
console.log("✅ Chart Engine v6.2: line series.data/categories + axis min/max/tick/suffix 지원");
console.log("📋 원본 B001~B015 완전 복구 + v4.0.0 최적화 병합");
console.log("✅ renderGraphic() 800+ 줄 완전 복구");
console.log("✅ 표준 다국어 스키마 + 언어 전환 + Exponential Backoff + AbortController");
console.log("✅ renderSubjectiveQuestion() + showExplanation() 복구");
console.log("✅ Render Token (Race Condition 방지)");
console.log("✅ RendererManager (메모리 누수 방지)");
console.log("✅ 이벤트 중복 방지 (removeEventListener + onclick)");
console.log("✅ 백그라운드 순차 CDN 로드 (CPU spike 방지)");
console.log("🚀 초기 로딩 속도: 0.5~1초 (기존 대비 80% 단축)");
console.log("✅ Geometry 2D Engine v2.2 (geometry-2d) 통합");
console.log("✅ ES Module export + window 전역 노출 동시 지원");
console.log("✅ previewGraphic() 콘솔 미리보기 지원");
console.log("🌐 EN/KO 전환 지원 · G 그래픽은 영어 원본 고정");
console.log("📊 v8.0B: Learn / Study / Exam mode engine enabled");



// ========================================================================
// BIBLE: Browser speech controls (Chrome/Safari)
// ========================================================================
function getBibleNativeSpeechPlugin_() {
  var capacitor = window.Capacitor;
  if (!capacitor) return null;
  var isNative = typeof capacitor.isNativePlatform === 'function'
    ? capacitor.isNativePlatform()
    : typeof capacitor.getPlatform === 'function' && capacitor.getPlatform() !== 'web';
  if (!isNative) return null;
  // Capacitor exposes installed native plugins through this bridge even when
  // the content page itself is served remotely by GitHub Pages.
  if (capacitor.Plugins && capacitor.Plugins.TextToSpeech) {
    return capacitor.Plugins.TextToSpeech;
  }
  return typeof capacitor.registerPlugin === 'function'
    ? capacitor.registerPlugin('TextToSpeech')
    : null;
}

function initBibleSpeechControls() {
  if (window.__bibleSpeechControlsInstalled) return;
  window.__bibleSpeechControlsInstalled = true;
  // Some Android WebViews expose the speech API only after the first page
  // render (and a few do not expose it at all).  Keep the controls visible in
  // either case: hiding them made the Android app look as if reading support
  // had disappeared.  A clear tap-time message is safer than silently
  // removing the feature.
  var bibleBrowserSpeechSupported =
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';
  var bibleNativeSpeech = getBibleNativeSpeechPlugin_();
  var bibleSpeechSupported = bibleBrowserSpeechSupported || !!bibleNativeSpeech;

  var wrap = document.createElement('div');
  wrap.id = 'bibleSpeechControls';
  wrap.className = 'bible-speech-controls';
  wrap.hidden = true;
  wrap.style.cssText = 'position:relative;z-index:4;display:none;flex-wrap:nowrap;justify-content:center;gap:4px;width:fit-content;max-width:100%;margin:4px auto 1px;padding:4px;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.16);border-radius:9px';

  var readButton = document.createElement('button');
  readButton.type = 'button';
  readButton.className = 'bible-speech-button bible-speech-play';
  readButton.textContent = '▶';
  readButton.setAttribute('aria-label', 'Play current Bible lesson');
  readButton.title = bibleSpeechSupported
    ? 'Read the current Bible lesson'
    : 'Text-to-speech is not available in this Android WebView';
  readButton.style.cssText = 'border:0;border-radius:8px;padding:0;background:#f5a623;color:#fff;font-size:14px;font-weight:800;cursor:pointer';

  var replayButton = document.createElement('button');
  replayButton.type = 'button';
  replayButton.className = 'bible-speech-button bible-speech-replay';
  replayButton.textContent = '↻';
  replayButton.setAttribute('aria-label', 'Replay current item');
  replayButton.title = 'Read the current item again without moving to the next item';
  replayButton.style.cssText = 'border:0;border-radius:8px;padding:0;background:#2563eb;color:#fff;font-size:14px;font-weight:800;cursor:pointer';

  var stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.className = 'bible-speech-button bible-speech-stop';
  stopButton.textContent = '■';
  stopButton.setAttribute('aria-label', 'Stop reading');
  stopButton.title = 'Stop reading';
  stopButton.style.cssText = 'border:0;border-radius:8px;padding:0;background:#475569;color:#fff;font-size:14px;font-weight:800;cursor:pointer';

  var speedSelect = document.createElement('select');
  speedSelect.className = 'bible-speech-speed';
  speedSelect.title = 'Reading speed';
  speedSelect.setAttribute('aria-label', 'Reading speed');
  speedSelect.style.cssText = 'border:0;border-radius:8px;padding:0 3px;background:#fff;color:#0f172a;font-size:11px;font-weight:800;cursor:pointer';
  [
    { value: '0.5', label: '0.5×' },
    { value: '0.75', label: '0.75×' },
    { value: '1', label: '1.0×' },
    { value: '1.25', label: '1.25×' },
    { value: '1.5', label: '1.5×' }
  ].forEach(function(optionData) {
    var option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    speedSelect.appendChild(option);
  });

  var autoNextButton = document.createElement('button');
  autoNextButton.type = 'button';
  autoNextButton.className = 'bible-speech-button bible-speech-auto-next';
  autoNextButton.title = 'Automatically move to the next item after reading';
  autoNextButton.style.cssText = 'border:0;border-radius:8px;padding:0;color:#fff;font-size:14px;font-weight:800;cursor:pointer';

  var speechSpeedKey = 'bibleSpeechSpeed';
  var speechAutoNextKey = 'bibleSpeechAutoNext';
  var savedSpeed = Number(localStorage.getItem(speechSpeedKey));
  var bibleSpeechRate = [0.5, 0.75, 1, 1.25, 1.5].indexOf(savedSpeed) !== -1 ? savedSpeed : 1;
  var bibleAutoNextEnabled = localStorage.getItem(speechAutoNextKey) !== 'false';
  speedSelect.value = String(bibleSpeechRate);

  var bibleAutoReadActive = false;
  var bibleSpeechRunId = 0;

  function updateAutoNextButton_() {
    autoNextButton.textContent = '⏭';
    autoNextButton.title = 'Auto next ' + (bibleAutoNextEnabled ? 'on' : 'off');
    autoNextButton.setAttribute('aria-label', 'Automatically move to the next item: ' + (bibleAutoNextEnabled ? 'on' : 'off'));
    autoNextButton.setAttribute('aria-pressed', bibleAutoNextEnabled ? 'true' : 'false');
    autoNextButton.style.background = bibleAutoNextEnabled ? '#16a34a' : '#64748b';
  }

  function syncBibleSpeechControlsVisibility_() {
    var quizContent = document.getElementById('quizContent');
    var hasVisibleQuestion =
      quizContent &&
      currentQuestions.length > 0 &&
      window.getComputedStyle(quizContent).display !== 'none';
    wrap.hidden = !hasVisibleQuestion;
    wrap.style.display = hasVisibleQuestion ? 'flex' : 'none';
    if (!hasVisibleQuestion) stopBibleSpeech(false);
  }

  function stopBibleSpeech(keepAutoRead) {
    bibleSpeechRunId++;
    if (!keepAutoRead) bibleAutoReadActive = false;
    if (bibleBrowserSpeechSupported) window.speechSynthesis.cancel();
    if (bibleNativeSpeech && typeof bibleNativeSpeech.stop === 'function') {
      Promise.resolve(bibleNativeSpeech.stop()).catch(function() {});
    }
  }

  function getBibleVoice_(langCode) {
    if (!bibleBrowserSpeechSupported) return null;
    var prefix = langCode.slice(0, 2).toLowerCase();
    return window.speechSynthesis.getVoices().find(function(item) {
      return String(item.lang || '').toLowerCase().indexOf(prefix) === 0;
    });
  }

  function normalizeBibleReferencesForSpeech_(text, langCode) {
    var value = String(text || '');
    if (String(langCode || '').toLowerCase().indexOf('ko') === 0) {
      value = value.replace(/\b(\d{1,3})\s*장\s*(\d{1,3})\s*절/g,
        function(_, chapter, verse) {
          return koreanBibleNumber_(chapter) + '장 ' + koreanBibleNumber_(verse) + '절';
        });
      value = value.replace(/\b(\d{1,3}):(\d{1,3})-(\d{1,3}):(\d{1,3})\b/g,
        function(_, c1, v1, c2, v2) {
          return koreanBibleNumber_(c1) + '장 ' + koreanBibleNumber_(v1) + '절부터 ' +
            koreanBibleNumber_(c2) + '장 ' + koreanBibleNumber_(v2) + '절까지';
        });
      value = value.replace(/\b(\d{1,3}):(\d{1,3})-(\d{1,3})\b/g,
        function(_, chapter, firstVerse, lastVerse) {
          return koreanBibleNumber_(chapter) + '장 ' + koreanBibleNumber_(firstVerse) +
            '절부터 ' + koreanBibleNumber_(lastVerse) + '절까지';
        });
      value = value.replace(/\b(\d{1,3}):(\d{1,3})\b/g, function(_, chapter, verse) {
        return koreanBibleNumber_(chapter) + '장 ' + koreanBibleNumber_(verse) + '절';
      });
      // Keep the reference visually unchanged, but make TTS pause before the verse text.
      return value.replace(
        /((?:[일이삼사오육칠팔구십백천영]+장\s*)?[일이삼사오육칠팔구십백천영]+절(?:까지)?)(?=\s+[^.!?。！？])/g,
        '$1. '
      ).replace(/\.\s{2,}/g, '. ');
    }
    value = value.replace(/\b(\d{1,3}):(\d{1,3})-(\d{1,3}):(\d{1,3})\b/g,
      'chapter $1, verse $2 through chapter $3, verse $4');
    value = value.replace(/\b(\d{1,3}):(\d{1,3})-(\d{1,3})\b/g,
      'chapter $1, verses $2 through $3');
    return value.replace(/\b(\d{1,3}):(\d{1,3})\b/g, 'chapter $1, verse $2');
  }

  function koreanBibleNumber_(input) {
    var number = Math.max(0, parseInt(input, 10) || 0);
    if (number === 0) return '영';
    var digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    var units = ['', '십', '백', '천'];
    var result = '';
    var position = 0;
    while (number > 0) {
      var digit = number % 10;
      if (digit) {
        var digitText = digit === 1 && position > 0 ? '' : digits[digit];
        result = digitText + units[position] + result;
      }
      number = Math.floor(number / 10);
      position++;
    }
    return result;
  }

  function splitBibleSpeechSegments_(text) {
    var segments = [];
    String(text || '').split(/\n+/).forEach(function(line) {
      var clean = line.replace(/\s+/g, ' ').trim();
      if (!clean) return;
      var hangulCount = (clean.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || []).length;
      var latinCount = (clean.match(/[A-Za-z]/g) || []).length;
      var langCode = hangulCount > 0 && hangulCount >= latinCount * 0.25 ? 'ko-KR' : 'en-US';
      clean = normalizeBibleReferencesForSpeech_(clean, langCode);
      var chunks = clean.match(/.{1,180}(?:[.!?。！？]\s*|$)/g) || [clean];
      chunks.forEach(function(chunk) {
        if (chunk.trim()) segments.push({ text: chunk.trim(), lang: langCode });
      });
    });
    return segments;
  }

  function collectBibleSpeechSegments_() {
    var container = document.getElementById('questionContainer');
    if (!container) return [];
    var result = [];

    function appendElements(selector, delayBeforeFirst) {
      var elements = Array.prototype.slice.call(container.querySelectorAll(selector));
      elements.forEach(function(element, elementIndex) {
        var text = String(element.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        splitBibleSpeechSegments_(text).forEach(function(chunk, chunkIndex) {
          result.push({
            text: chunk.text,
            lang: chunk.lang,
            delayBefore: elementIndex === 0 && chunkIndex === 0 ? (delayBeforeFirst || 0) : 0
          });
        });
      });
    }

    // Screen labels such as version names are intentionally excluded.
    appendElements('.bible-passage-version .passage-language-content', 0);
    if (!bibleQuizVisible) return result;
    appendElements('.question-text .language-line', 0);

    if (currentMode === 'learn') {
      // Pause for thinking, then read only the correct choice.
      appendElements('.choice.correct .choice-language-content .language-line', 3000);
    } else {
      // Never include the visible A/B/C/D badges.
      appendElements('.choice .choice-language-content .language-line', 1200);
    }
    return result;
  }

  function readCurrentBibleQuestion(fromAutoAdvance, replayOnly) {
    if (!bibleSpeechSupported) {
      window.alert('Text-to-speech is not available on this device yet. The lesson and all study controls remain available.');
      return;
    }
    if (!fromAutoAdvance) {
      bibleAutoReadActive =
        !replayOnly &&
        bibleAutoNextEnabled &&
        (!bibleQuizVisible || currentMode === 'learn');
    }
    stopBibleSpeech(true);
    var runId = bibleSpeechRunId;
    var questionIndexAtStart = currentIndex;
    var segments = collectBibleSpeechSegments_();
    if (!segments.length) {
      if (typeof showToast === 'function') showToast('읽을 문제가 없습니다.', 'warn');
      return;
    }

    function finishBibleSpeech_() {
      if (replayOnly || !bibleAutoNextEnabled) {
        bibleAutoReadActive = false;
        return;
      }
      if (
        runId !== bibleSpeechRunId ||
        !bibleAutoReadActive ||
        (bibleQuizVisible && currentMode !== 'learn') ||
        currentIndex !== questionIndexAtStart
      ) return;
      var atLastItem = currentIndex >= currentQuestions.length - 1;
      if (!bibleQuizVisible) {
        var reading = getBibleReadingPosition_();
        atLastItem = reading.position >= reading.indexes.length - 1;
      }
      if (atLastItem) {
        bibleAutoReadActive = false;
        return;
      }
      goNext();
      window.setTimeout(function() {
        if (bibleAutoReadActive && (!bibleQuizVisible || currentMode === 'learn')) {
          readCurrentBibleQuestion(true);
        }
      }, 350);
    }

    function speakBibleSegment_(segmentIndex) {
      if (runId !== bibleSpeechRunId) return;
      if (segmentIndex >= segments.length) {
        finishBibleSpeech_();
        return;
      }
      var segment = segments[segmentIndex];
      var speak = function() {
        if (runId !== bibleSpeechRunId) return;
        if (bibleNativeSpeech && typeof bibleNativeSpeech.speak === 'function') {
          Promise.resolve(bibleNativeSpeech.speak({
            text: segment.text,
            lang: segment.lang,
            rate: bibleSpeechRate,
            pitch: 1,
            volume: 1,
            category: 'ambient'
          })).then(function() {
            speakBibleSegment_(segmentIndex + 1);
          }).catch(function() {
            bibleAutoReadActive = false;
            window.alert('Android text-to-speech could not start. Please check that a text-to-speech engine is enabled in your device settings.');
          });
          return;
        }
        var utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.lang;
        utterance.rate = bibleSpeechRate;
        var voice = getBibleVoice_(segment.lang);
        if (voice) utterance.voice = voice;
        utterance.onend = function() {
          speakBibleSegment_(segmentIndex + 1);
        };
        utterance.onerror = function() {
          bibleAutoReadActive = false;
        };
        window.speechSynthesis.speak(utterance);
      };
      if (segment.delayBefore > 0) {
        window.setTimeout(speak, segment.delayBefore);
      } else {
        speak();
      }
    }

    speakBibleSegment_(0);
  }
  updateAutoNextButton_();
  readButton.addEventListener('click', function() { readCurrentBibleQuestion(false, false); });
  replayButton.addEventListener('click', function() { readCurrentBibleQuestion(false, true); });
  stopButton.addEventListener('click', function() { stopBibleSpeech(false); });
  speedSelect.addEventListener('change', function() {
    var nextRate = Number(speedSelect.value);
    if ([0.5, 0.75, 1, 1.25, 1.5].indexOf(nextRate) === -1) nextRate = 1;
    bibleSpeechRate = nextRate;
    localStorage.setItem(speechSpeedKey, String(nextRate));
    if (bibleBrowserSpeechSupported && window.speechSynthesis.speaking) {
      readCurrentBibleQuestion(false, !bibleAutoNextEnabled);
    }
  });
  autoNextButton.addEventListener('click', function() {
    bibleAutoNextEnabled = !bibleAutoNextEnabled;
    localStorage.setItem(speechAutoNextKey, bibleAutoNextEnabled ? 'true' : 'false');
    if (!bibleAutoNextEnabled) bibleAutoReadActive = false;
    updateAutoNextButton_();
  });
  document.addEventListener('click', function(event) {
    var id = event.target && event.target.id;
    if (['prevBtn', 'nextBtn', 'skipBtn', 'submitBtn', 'quitBtn'].indexOf(id) !== -1) {
      stopBibleSpeech(false);
    }
  });
  window.addEventListener('beforeunload', function() { stopBibleSpeech(false); });
  wrap.appendChild(readButton);
  wrap.appendChild(replayButton);
  wrap.appendChild(stopButton);
  wrap.appendChild(speedSelect);
  wrap.appendChild(autoNextButton);
  var quizHeader = document.querySelector('.quiz-header');
  var learningModePanel = quizHeader && quizHeader.querySelector('.learning-mode-panel');
  var actionRow = document.getElementById('bibleHeaderActionRow');
  if (actionRow) {
    actionRow.insertBefore(wrap, actionRow.firstChild);
  } else if (quizHeader && learningModePanel) {
    quizHeader.insertBefore(wrap, learningModePanel);
  } else if (quizHeader) {
    quizHeader.appendChild(wrap);
  } else {
    document.body.appendChild(wrap);
  }
  var quizContent = document.getElementById('quizContent');
  if (quizContent && typeof MutationObserver !== 'undefined') {
    new MutationObserver(syncBibleSpeechControlsVisibility_)
      .observe(quizContent, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  syncBibleSpeechControlsVisibility_();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBibleSpeechControls);
} else {
  initBibleSpeechControls();
}
// ========================================================================
// BIBLE: People DB explorer
// ========================================================================
var biblePeopleExplorerInitialized = false;
var biblePeopleSelectedId = '';
var biblePeopleSearchTimer = null;
var biblePeopleSearchRequestId = 0;
var biblePeopleDirectoryLoaded = false;
var biblePeopleNameIndex = {};
var biblePeopleNameIndexPromise = null;
var bibleContextLinks = null;
var bibleContextLinksPromise = null;
var biblePeopleRelationshipScene = null;

function biblePeopleLoadNameIndex_() {
  if (biblePeopleNameIndexPromise) return biblePeopleNameIndexPromise;
  var nameIndexRequest = (window.BibleSupabaseProvider &&
    typeof window.BibleSupabaseProvider.fetchContent === 'function')
    ? window.BibleSupabaseProvider.fetchContent('content/people-index.json')
    : fetch('./content/people-index.json?v=8.88-context-storage1');
  biblePeopleNameIndexPromise = nameIndexRequest
    .then(function(response) {
      if (!response.ok) throw new Error('Bible person names could not be loaded.');
      return response.json();
    })
    .then(function(index) {
      biblePeopleNameIndex = index || {};
      return biblePeopleNameIndex;
    })
    .catch(function(error) {
      console.warn(error.message);
      return {};
    });
  return biblePeopleNameIndexPromise;
}

function biblePeopleLoadContextLinks_() {
  if (bibleContextLinksPromise) return bibleContextLinksPromise;
  // Context links were moved out of the public repository into authenticated
  // Supabase Storage.  Keep the old static-file fallback only for local
  // standalone previews so people/place/event connections do not disappear
  // after the public repository cleanup.
  var contextRequest = (window.BibleSupabaseProvider &&
    typeof window.BibleSupabaseProvider.fetchContent === 'function')
    ? window.BibleSupabaseProvider.fetchContent('content/bible-context-links.json')
    : fetch('./content/bible-context-links.json?v=8.88-context-storage1');
  bibleContextLinksPromise = contextRequest
    .then(function(response) {
      if (!response.ok) throw new Error('Bible context links could not be loaded.');
      return response.json();
    })
    .then(function(value) {
      bibleContextLinks = value || {};
      return bibleContextLinks;
    })
    .catch(function(error) {
      console.warn(error.message);
      return {};
    });
  return bibleContextLinksPromise;
}

async function biblePeopleApi_(action, values) {
  var params = new URLSearchParams();
  params.set('action', action);
  Object.keys(values || {}).forEach(function(key) {
    if (values[key] != null && values[key] !== '') params.set(key, String(values[key]));
  });
  var response = await fetchQuizApi_(params);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  var data = await response.json();
  if (!data || data.status === 'error' || data.success === false) {
    throwQuizApiError_(data, 'The Bible People request could not be completed.');
  }
  return data.data;
}

function biblePeopleSetStatus_(message, isError) {
  var status = document.getElementById('biblePeopleStatus');
  if (!status) return;
  status.textContent = message || '';
  status.classList.toggle('is-error', !!isError);
}

function biblePeopleOpen_() {
  var panel = document.getElementById('biblePeoplePanel');
  var toggle = document.getElementById('biblePeopleToggle');
  if (!panel) return;
  panel.hidden = false;
  document.body.classList.add('bible-people-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  setTimeout(function() {
    var input = document.getElementById('biblePeopleSearchInput');
    if (input) input.focus();
  }, 0);
  if (!biblePeopleDirectoryLoaded) {
    biblePeopleDirectoryLoaded = true;
    biblePeopleSetStatus_('Loading names...');
    biblePeopleRunSearch_('a', true);
  }
}

function biblePeopleClose_() {
  var panel = document.getElementById('biblePeoplePanel');
  var toggle = document.getElementById('biblePeopleToggle');
  if (panel) panel.hidden = true;
  document.body.classList.remove('bible-people-open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
}

function biblePeopleRenderResults_(people) {
  var results = document.getElementById('biblePeopleResults');
  if (!results) return;
  if (!Array.isArray(people) || !people.length) {
    results.innerHTML = '<div class="bible-people-empty"><strong>No results</strong><span>Try another English name or alias.</span></div>';
    return;
  }
  results.innerHTML = people.map(function(person) {
    var aliases = person.MATCH_KIND === 'alias' && Array.isArray(person.ALIASES) && person.ALIASES.length
      ? 'Alias match: ' + person.ALIASES.slice(0, 3).join(', ')
      : (Array.isArray(person.ALIASES) && person.ALIASES.length
        ? 'Aliases: ' + person.ALIASES.slice(0, 3).join(', ')
        : (person.ROLES || person.GENDER || 'Bible person'));
    return '<button type="button" class="bible-person-result' +
      (person.PERSON_ID === biblePeopleSelectedId ? ' is-active' : '') +
      '" data-person-id="' + escapeHtml(person.PERSON_ID) + '">' +
      '<strong>' + escapeHtml(person.NAME_EN || person.PERSON_ID) + '</strong>' +
      (person.NAME_KO ? '<span>' + escapeHtml(person.NAME_KO) + '</span>' : '') +
      '<span>' + escapeHtml(aliases) + '</span></button>';
  }).join('');
  results.querySelectorAll('[data-person-id]').forEach(function(button) {
    button.addEventListener('click', function() {
      biblePeopleLoadDetail_(button.getAttribute('data-person-id'));
    });
  });
}

function biblePeopleRelationshipName_(relationship, personId) {
  var relatedId = relationship.RELATED_ID ||
    (relationship.FROM_ID === personId ? relationship.TO_ID : relationship.FROM_ID);
  var displayName = relationship.RELATED_NAME_EN ||
    (biblePeopleNameIndex[relatedId] && biblePeopleNameIndex[relatedId].name
    ? biblePeopleNameIndex[relatedId].name
    : relatedId);
  return String(displayName || '').replace(/^PER-/i, '');
}

function biblePeopleRelationshipType_(relationship, personId) {
  var type = String(relationship.RELATIONSHIP_TYPE || 'related').toLowerCase();
  var fromSelected = relationship.FROM_ID === personId;
  if (fromSelected) {
    if (type === 'father' || type === 'mother') return 'parent';
    return type;
  }
  if (type === 'child') return 'parent';
  if (type === 'father' || type === 'mother') return 'child';
  return type;
}

function biblePeopleRelationshipRole_(relationship, personId) {
  var type = relationship.DISPLAY_TYPE || biblePeopleRelationshipType_(relationship, personId);
  var relatedId = relationship.RELATED_ID ||
    (relationship.FROM_ID === personId ? relationship.TO_ID : relationship.FROM_ID);
  var gender = String(
    biblePeopleNameIndex[relatedId] && biblePeopleNameIndex[relatedId].gender || ''
  ).toLowerCase();
  if (type === 'parent') return gender === 'male' ? 'Father' : gender === 'female' ? 'Mother' : 'Parent';
  if (type === 'partner') return gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Spouse';
  if (type === 'sibling') return gender === 'male' ? 'Brother' : gender === 'female' ? 'Sister' : 'Sibling';
  if (type === 'child') return gender === 'male' ? 'Son' : gender === 'female' ? 'Daughter' : 'Child';
  return String(type || 'Related').replace(/_/g, ' ').replace(/\b\w/g, function(letter) {
    return letter.toUpperCase();
  });
}

function biblePeopleUniqueRelationships_(relationships, personId) {
  var unique = new Map();
  (relationships || []).forEach(function(relationship) {
    var relatedId = relationship.RELATED_ID ||
      (relationship.FROM_ID === personId ? relationship.TO_ID : relationship.FROM_ID);
    if (!relatedId || relatedId === personId) return;
    var type = biblePeopleRelationshipType_(relationship, personId);
    var key = relatedId + '|' + type;
    if (!unique.has(key)) {
      unique.set(key, Object.assign({}, relationship, {
        RELATED_ID: relatedId,
        DISPLAY_TYPE: type
      }));
    }
  });
  return Array.from(unique.values());
}

function biblePeopleGraphPayload_(person, relationships) {
  var related = biblePeopleUniqueRelationships_(relationships, person.PERSON_ID).slice(0, 28);
  var groups = { parent: [], partner: [], sibling: [], child: [], other: [] };
  related.forEach(function(relationship) {
    var type = relationship.DISPLAY_TYPE;
    if (groups[type]) groups[type].push(relationship);
    else groups.other.push(relationship);
  });
  var objects = [{
    id: 'center',
    type: 'point',
    coords: [0, 0],
    name: person.NAME_EN || person.PERSON_ID,
    attributes: { size: 6, strokeColor: '#92400e', fillColor: '#fbbf24', label: { fontSize: 14, color: '#78350f', offset: [10, 10] } }
  }];

  function addGroup(groupName, y, color, title) {
    var members = groups[groupName];
    if (!members.length) return;
    var spacing = Math.min(5.2, 20 / Math.max(1, members.length));
    var startX = -((members.length - 1) * spacing) / 2;
    objects.push({
      id: 'title_' + groupName,
      type: 'text',
      position: [-10.5, y + (y >= 0 ? 1.25 : -1.25)],
      value: title,
      attributes: { color: '#64748b', fontSize: 11 }
    });
    members.forEach(function(relationship, index) {
      var coords = [startX + index * spacing, y];
      var id = groupName + '_' + index;
      objects.push({
        id: id,
        type: 'point',
        coords: coords,
        name: biblePeopleRelationshipName_(relationship, person.PERSON_ID) +
          ' (' + biblePeopleRelationshipRole_(relationship, person.PERSON_ID) + ')',
        attributes: { size: 4, strokeColor: color.stroke, fillColor: color.fill, label: { fontSize: 12, color: color.text, offset: [8, 8] } },
        metadata: { personId: relationship.RELATED_ID }
      });
      objects.push({
        id: 'line_' + id,
        type: 'segment',
        from: [0, 0],
        to: coords,
        attributes: { strokeColor: color.line, strokeWidth: 1.8 }
      });
    });
  }

  function addPartnerGroup() {
    var members = groups.partner;
    if (!members.length) return;
    var positions = [-5, 5, -9, 9, -12, 12];
    objects.push({
      id: 'title_partner',
      type: 'text',
      position: [-10.5, 1.35],
      value: 'SPOUSE / PARTNER',
      attributes: { color: '#64748b', fontSize: 11 }
    });
    members.forEach(function(relationship, index) {
      var coords = [positions[index] || (5 + index * 3), 0];
      var id = 'partner_' + index;
      objects.push({
        id: id,
        type: 'point',
        coords: coords,
        name: biblePeopleRelationshipName_(relationship, person.PERSON_ID) +
          ' (' + biblePeopleRelationshipRole_(relationship, person.PERSON_ID) + ')',
        attributes: { size: 4, strokeColor: '#be185d', fillColor: '#f9a8d4', label: { fontSize: 12, color: '#831843', offset: [8, -16] } },
        metadata: { personId: relationship.RELATED_ID }
      });
      objects.push({
        id: 'line_' + id,
        type: 'segment',
        from: [0, 0],
        to: coords,
        attributes: { strokeColor: '#f472b6', strokeWidth: 1.8 }
      });
    });
  }

  addGroup('parent', 7, { stroke: '#6d28d9', fill: '#c4b5fd', text: '#4c1d95', line: '#a78bfa' }, 'PARENTS');
  addPartnerGroup();
  addGroup('sibling', -3.7, { stroke: '#1d4ed8', fill: '#93c5fd', text: '#1e3a8a', line: '#60a5fa' }, 'SIBLINGS');
  addGroup('child', -7, { stroke: '#047857', fill: '#6ee7b7', text: '#064e3b', line: '#34d399' }, 'CHILDREN');
  addGroup('other', -9.5, { stroke: '#475569', fill: '#cbd5e1', text: '#334155', line: '#94a3b8' }, 'OTHER');
  return {
    schemaVersion: '1.1',
    engine: 'jsxgraph',
    type: 'bible.people.relationships',
    board: { boundingbox: [-12, 10, 12, -11], axis: false, grid: false },
    objects: objects
  };
}

function biblePeopleRenderDetail_(detail) {
  var host = document.getElementById('biblePeopleDetail');
  if (!host || !detail || !detail.person) return;
  if (biblePeopleRelationshipScene) {
    biblePeopleRelationshipScene.destroy();
    biblePeopleRelationshipScene = null;
  }
  var person = detail.person;
  var aliases = Array.isArray(detail.aliases) ? detail.aliases : [];
  var referenceMap = {};
  (Array.isArray(detail.references) ? detail.references : []).forEach(function(reference) {
    var code = String(reference.SOURCE_CODE || '').trim();
    if (!code) return;
    var key = code.toLowerCase();
    if (!referenceMap[key]) referenceMap[key] = Object.assign({}, reference);
    if (reference.IS_KEY === 'TRUE' || reference.IS_KEY === 'true' ||
        reference.IS_KEY === true) {
      referenceMap[key].IS_KEY = 'TRUE';
    }
  });
  var references = Object.keys(referenceMap).map(function(key) {
    return referenceMap[key];
  });
  var relationships = biblePeopleUniqueRelationships_(
    Array.isArray(detail.relationships) ? detail.relationships : [],
    person.PERSON_ID
  );
  var roles = String(person.ROLES || '').split('|').filter(Boolean);
  var description = person.DESCRIPTION_EN || person.DESCRIPTION_KO || 'No source description is available.';
  var referenceLimit = 24;
  var relationshipLimit = 30;
  var context = detail.context || {};
  var contextEvents = Array.isArray(context.events) ? context.events : [];
  var contextPlaces = Array.isArray(context.places) ? context.places : [];
  var scripturePlaces = Array.isArray(context.scripture_places)
    ? context.scripture_places
    : [];
  var relationshipGraphic = relationships.length ? biblePeopleGraphPayload_(person, relationships) : null;
  var graphHtml = relationships.length
    ? '<div class="vector-scene25d-host bible-relationship-25d"></div>'
    : '<div class="bible-single-person">' +
        '<div class="bible-single-person-icon" aria-hidden="true">👤</div>' +
        '<strong>' + escapeHtml(person.NAME_EN || person.PERSON_ID) + '</strong>' +
        (person.NAME_KO ? '<span>' + escapeHtml(person.NAME_KO) + '</span>' : '') +
        '<small>No family relationships are recorded for this person.</small>' +
      '</div>';

  host.innerHTML = '<article class="bible-person-card">' +
    '<div class="bible-person-title"><div><h3>' + escapeHtml(person.NAME_EN || person.PERSON_ID) + '</h3>' +
    (person.NAME_KO ? '<p>' + escapeHtml(person.NAME_KO) + '</p>' : '') +
    '</div><span class="bible-person-id">' + escapeHtml(person.PERSON_ID) + '</span></div>' +
    '<div class="bible-person-meta">' +
    roles.map(function(role) { return '<span class="bible-person-chip">' + escapeHtml(role) + '</span>'; }).join('') +
    (person.GENDER ? '<span class="bible-person-chip">' + escapeHtml(person.GENDER) + '</span>' : '') +
    '</div><p class="bible-person-description">' + escapeHtml(description) + '</p>' +
    (aliases.length ? '<section class="bible-person-section"><h4>Aliases</h4><div class="bible-person-meta">' +
      aliases.map(function(alias) { return '<span class="bible-person-chip">' + escapeHtml(alias.ALIAS) + '</span>'; }).join('') +
      '</div></section>' : '') +
    '<section class="bible-person-section"><h4>Scripture references (' + references.length + ')</h4>' +
    '<div class="bible-person-grid">' + references.slice(0, referenceLimit).map(function(reference) {
      return '<button type="button" class="bible-reference" data-bible-source-code="' +
        escapeHtml(reference.SOURCE_CODE) + '">' + escapeHtml(reference.SOURCE_CODE) +
        (reference.IS_KEY === 'TRUE' || reference.IS_KEY === 'true' ? ' · Key' : '') + '</button>';
    }).join('') + '</div>' +
    (references.length > referenceLimit ? '<div class="bible-reference-more">Showing the first ' + referenceLimit + ' of ' + references.length + ' references.</div>' : '') +
    '</section><section class="bible-person-section"><h4>People · Places · Events</h4>' +
    '<div class="bible-person-meta">' +
      '<button type="button" class="bible-person-chip" data-context-tab="places" title="Open Atlas">🌐 Atlas</button>' +
      '<button type="button" class="bible-person-chip" data-context-tab="timeline">Timeline</button>' +
      '<button type="button" class="bible-person-chip" data-context-tab="journeys">Journeys</button>' +
    '</div>' +
    (contextEvents.length
      ? '<div class="bible-context-list">' + contextEvents.slice(0, 12).map(function(event) {
          var eventReference = (event.source_codes || [])[0] || '';
          var eventPlaces = Array.isArray(event.place_names) ? event.place_names : [];
          return '<div class="bible-context-event-row">' +
            '<button type="button" class="bible-context-item" data-context-event-reference="' +
              escapeHtml(eventReference) + '"><strong>Event · ' + escapeHtml(event.title) +
              '</strong><span>' + escapeHtml((event.source_codes || []).slice(0, 2).join(', ')) +
              '</span></button>' +
            (eventPlaces.length
              ? '<div class="bible-context-event-places"><span>Places:</span>' +
                  eventPlaces.map(function(placeName) {
                    return '<button type="button" class="bible-person-chip" data-context-place-name="' +
                      escapeHtml(placeName) + '">📍 ' + escapeHtml(placeName) + '</button>';
                  }).join('') + '</div>'
              : '') +
          '</div>';
        }).join('') + '</div>'
      : '<div class="bible-context-empty">No source event is directly linked to this person.</div>') +
    (contextPlaces.length
      ? '<div class="bible-person-meta">' + contextPlaces.slice(0, 16).map(function(place) {
          return '<button type="button" class="bible-person-chip" data-context-place-name="' +
            escapeHtml(place.name) + '">📍 ' + escapeHtml(place.name) + '</button>';
        }).join('') + '</div>'
      : '') +
    (scripturePlaces.length
      ? '<details class="bible-context-more"><summary>Additional places appearing in the same Scripture passages (' +
          scripturePlaces.length + ')</summary><div class="bible-person-meta">' +
          scripturePlaces.slice(0, 30).map(function(place) {
            return '<button type="button" class="bible-person-chip" data-context-place-name="' +
              escapeHtml(place.name) + '">' + escapeHtml(place.name) + '</button>';
          }).join('') + '</div></details>'
      : '') +
    '</section><section class="bible-person-section"><h4>Relationships (' + relationships.length + ')</h4>' +
    '<div class="bible-person-grid">' + relationships.slice(0, relationshipLimit).map(function(relationship) {
      return '<button type="button" class="bible-relationship" data-related-person-id="' +
        escapeHtml(relationship.RELATED_ID) + '"><strong>' +
        escapeHtml(biblePeopleRelationshipName_(relationship, person.PERSON_ID)) +
        '</strong>' + escapeHtml(biblePeopleRelationshipRole_(relationship, person.PERSON_ID)) + '</button>';
    }).join('') + '</div></section>' +
    '<section class="bible-person-section"><h4>Relationship graph</h4><div class="bible-person-graph">' + graphHtml + '</div></section>' +
    '</article>';
  if (relationshipGraphic) {
    var relationshipHost = host.querySelector('.bible-relationship-25d');
    biblePeopleRelationshipScene = new VectorScene25D(relationshipHost, {
      ariaLabel: 'Interactive Bible relationship graph',
      labelFontSize: 12
    });
    biblePeopleRelationshipScene.setScene(sceneFromGraphicObjects(relationshipGraphic));
    relationshipHost.addEventListener('scene25d:select', function(event) {
      var relatedId = event && event.detail && event.detail.node && event.detail.node.metadata && event.detail.node.metadata.personId;
      if (relatedId) biblePeopleLoadDetail_(relatedId);
    });
  }
  host.querySelectorAll('[data-related-person-id]').forEach(function(button) {
    button.addEventListener('click', function() {
      biblePeopleLoadDetail_(button.getAttribute('data-related-person-id'));
    });
  });
  host.querySelectorAll('[data-context-place-name]').forEach(function(button) {
    button.addEventListener('click', function() {
      window.__bibleContextReturn = { kind: 'person', personId: person.PERSON_ID };
      biblePeopleClose_();
      if (typeof window.openBibleContext === 'function') {
        window.openBibleContext({
          tab: 'places',
          placeName: button.getAttribute('data-context-place-name')
        });
      }
    });
  });
  host.querySelectorAll('[data-context-event-reference]').forEach(function(button) {
    button.addEventListener('click', function() {
      window.__bibleContextReturn = { kind: 'person', personId: person.PERSON_ID };
      biblePeopleClose_();
      if (typeof window.openBibleContext === 'function') {
        window.openBibleContext({
          tab: 'timeline',
          sourceCode: button.getAttribute('data-context-event-reference')
        });
      }
    });
  });
  host.querySelectorAll('[data-context-tab]').forEach(function(button) {
    button.addEventListener('click', function() {
      biblePeopleClose_();
      if (typeof window.openBibleContext === 'function') {
        window.openBibleContext({ tab: button.getAttribute('data-context-tab') });
      }
    });
  });
}

async function biblePeopleLoadDetail_(personId) {
  if (!personId) return;
  biblePeopleSelectedId = personId;
  biblePeopleSetStatus_('Loading person details...');
  var host = document.getElementById('biblePeopleDetail');
  if (host) host.innerHTML = '<div class="bible-people-empty"><strong>Loading...</strong></div>';
  document.querySelectorAll('[data-person-id]').forEach(function(button) {
    button.classList.toggle('is-active', button.getAttribute('data-person-id') === personId);
  });
  try {
    var results = await Promise.all([
      biblePeopleApi_('person_detail', { person_id: personId }),
      biblePeopleLoadNameIndex_(),
      biblePeopleLoadContextLinks_()
    ]);
    var detail = results[0];
    var contextData = results[2] || {};
    var personContext = contextData.person_contexts &&
      contextData.person_contexts[personId] || {};
    detail.context = {
      events: (personContext.event_ids || []).map(function(eventId) {
        var event = contextData.events && contextData.events[eventId];
        if (!event) return null;
        return Object.assign({}, event, {
          place_names: (event.place_ids || []).map(function(placeId) {
            return contextData.places && contextData.places[placeId] &&
              contextData.places[placeId].name;
          }).filter(Boolean)
        });
      }).filter(Boolean),
      places: (personContext.place_ids || []).map(function(placeId) {
        return contextData.places && contextData.places[placeId];
      }).filter(Boolean),
      scripture_places: (personContext.scripture_place_ids || []).map(function(placeId) {
        return contextData.geocoding_places && contextData.geocoding_places[placeId];
      }).filter(Boolean)
    };
    biblePeopleRenderDetail_(detail);
    biblePeopleSetStatus_('Loaded ' + (detail.person.NAME_EN || personId) + '.');
  } catch (error) {
    if (host) host.innerHTML = '<div class="bible-people-empty"><strong>Unable to load this person</strong><span>' + escapeHtml(error.message) + '</span></div>';
    biblePeopleSetStatus_(error.message, true);
  }
}

async function biblePeopleRunSearch_(query, isDirectory) {
  query = String(query || '').trim();
  if (!query) return;
  var requestId = ++biblePeopleSearchRequestId;
  biblePeopleSetStatus_('Searching...');
  try {
    var people = await biblePeopleApi_('people_search', { q: query, limit: 30 });
    // The first directory request can finish after a later keystroke.  Do
    // not let that older response overwrite the results for the new letter.
    if (requestId !== biblePeopleSearchRequestId) return;
    biblePeopleRenderResults_(people);
    biblePeopleSetStatus_(isDirectory
      ? 'Select a name, or type to search all people and aliases.'
      : people.length + ' result' + (people.length === 1 ? '' : 's') + ' found.');
    if (!isDirectory && people.length === 1) biblePeopleLoadDetail_(people[0].PERSON_ID);
  } catch (error) {
    if (requestId !== biblePeopleSearchRequestId) return;
    biblePeopleRenderResults_([]);
    biblePeopleSetStatus_(error.message, true);
  }
}

function biblePeopleSearchSubmit_(event) {
  event.preventDefault();
  var input = document.getElementById('biblePeopleSearchInput');
  biblePeopleRunSearch_(input && input.value);
}

window.openBiblePerson = function(personId, navigationOptions) {
  biblePeopleOpen_();
  if (!(navigationOptions && navigationOptions.skipHistory) &&
      window.BibleReferenceNavigation) {
    window.BibleReferenceNavigation.push({ kind: 'person', personId: personId });
  }
  biblePeopleLoadDetail_(personId);
};

function initBiblePeopleExplorer() {
  if (biblePeopleExplorerInitialized) return;
  var toggle = document.getElementById('biblePeopleToggle');
  var panel = document.getElementById('biblePeoplePanel');
  var close = document.getElementById('biblePeopleClose');
  var back = document.getElementById('biblePeopleBack');
  var forward = document.getElementById('biblePeopleForward');
  var form = document.getElementById('biblePeopleSearchForm');
  if (!toggle || !panel || !close || !form) return;
  biblePeopleExplorerInitialized = true;
  toggle.addEventListener('click', biblePeopleOpen_);
  close.addEventListener('click', biblePeopleClose_);
  if (back && window.BibleReferenceNavigation) {
    back.addEventListener('click', function() {
      window.BibleReferenceNavigation.back();
    });
  }
  if (forward && window.BibleReferenceNavigation) {
    forward.addEventListener('click', function() {
      window.BibleReferenceNavigation.forward();
    });
  }
  if (window.BibleReferenceNavigation) window.BibleReferenceNavigation.update();
  form.addEventListener('submit', biblePeopleSearchSubmit_);
  var input = document.getElementById('biblePeopleSearchInput');
  if (input) {
    input.addEventListener('input', function() {
      clearTimeout(biblePeopleSearchTimer);
      var query = String(input.value || '').trim();
      if (!query) {
        var results = document.getElementById('biblePeopleResults');
        if (results) results.innerHTML = '';
        biblePeopleSetStatus_('Start typing a name or alias.');
        return;
      }
      biblePeopleSearchTimer = setTimeout(function() {
        biblePeopleRunSearch_(query);
      }, 280);
    });
  }
  panel.addEventListener('click', function(event) {
    if (event.target === panel) biblePeopleClose_();
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !panel.hidden) biblePeopleClose_();
  });
}

// ========================================================================
// BIBLE: Chapter catalog selector (BIBLE-CATALOG)
// ========================================================================
var BIBLE_CHAPTER_CATALOG = [];
var BIBLE_SELECTED_BOOK = '';
var bibleLegacyDetectTotalQuestions_ = detectTotalQuestions;
var bibleLegacyUpdateSetSelector_ = updateSetSelector;

var BIBLE_BOOK_ORDER = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1-Samuel','2-Samuel','1-Kings','2-Kings','1-Chronicles','2-Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song-of-Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans','1-Corinthians','2-Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1-Thessalonians','2-Thessalonians',
  '1-Timothy','2-Timothy','Titus','Philemon','Hebrews','James','1-Peter','2-Peter',
  '1-John','2-John','3-John','Jude','Revelation'
];

function bibleSubjectForTestament_(testament) {
  return String(testament || '').toUpperCase() === 'NT' ? 'BIBLE_NT' : 'BIBLE_OT';
}

function activateBibleTestament_(testament) {
  var nextSubject = bibleSubjectForTestament_(testament);
  var nextConfig = availableSubjects.find(function(subject) {
    return String(subject && subject.CODE || '').replace(/-/g, '_').toUpperCase() === nextSubject;
  });
  if (nextConfig) subjectConfig = nextConfig;
  currentSubject = nextSubject;
  CURRENT_SUBJECT = nextSubject;
  DATA_SHEET = nextSubject === 'BIBLE_NT' ? 'bible-nt' : 'bible-ot';
  var keyPart = nextSubject.replace(/[^A-Z0-9_-]/g, '_');
  STORAGE_KEY = 'quiz_progress_main_v8_0D_' + keyPart;
  TOTAL_CACHE_KEY = 'quiz_total_questions_v8_0D_' + keyPart;
  TOTAL_QUESTIONS = BIBLE_CHAPTER_CATALOG.reduce(function(maximum, chapter) {
    return String(chapter.TESTAMENT || '').toUpperCase() === String(testament || '').toUpperCase()
      ? Math.max(maximum, parseInt(chapter.LAST_ROW, 10) || 0)
      : maximum;
  }, 0);
  window.currentSubject = currentSubject;
  window.subjectConfig = subjectConfig;
  localStorage.setItem('quiz_current_subject_v1', JSON.stringify(subjectConfig || {
    CODE: nextSubject,
    NAME: nextSubject === 'BIBLE_NT' ? 'New Testament' : 'Old Testament',
    SHEET: DATA_SHEET
  }));
}

function bibleBookRank_(bookName) {
  var rank = BIBLE_BOOK_ORDER.indexOf(String(bookName || ''));
  return rank < 0 ? BIBLE_BOOK_ORDER.length : rank;
}

function renderBibleBookPicker_() {
  var bookHost = document.getElementById('bibleBookPicker');
  var chapterHost = document.getElementById('bibleChapterPicker');
  if (!bookHost || !chapterHost) return;
  var books = [];
  BIBLE_CHAPTER_CATALOG.forEach(function(chapter) {
    var name = String(chapter.BOOK_EN || chapter.BOOK_KO || '').trim();
    if (name && books.indexOf(name) < 0) books.push(name);
  });
  books.sort(function(left, right) { return bibleBookRank_(left) - bibleBookRank_(right); });
  bookHost.innerHTML = '';
  var startButton = document.getElementById('startQuizBtn');
  if (startButton) startButton.disabled = true;
  var groups = [
    { testament: 'OT', title: 'Old Testament', count: 39 },
    { testament: 'NT', title: 'New Testament', count: 27 }
  ];
  groups.forEach(function(group) {
    var section = document.createElement('section');
    section.className = 'bible-testament-group';
    section.setAttribute('aria-labelledby', 'bible-' + group.testament.toLowerCase() + '-title');
    var heading = document.createElement('h3');
    heading.id = 'bible-' + group.testament.toLowerCase() + '-title';
    heading.className = 'bible-testament-title';
    heading.innerHTML = '<span>' + group.title + '</span><small>' + group.count + ' books</small>';
    var grid = document.createElement('div');
    grid.className = 'bible-book-grid';
    section.appendChild(heading);
    section.appendChild(grid);
    bookHost.appendChild(section);
    books.filter(function(bookName) {
      var chapter = BIBLE_CHAPTER_CATALOG.find(function(item) {
        return String(item.BOOK_EN || item.BOOK_KO || '') === bookName;
      });
      return String(chapter && chapter.TESTAMENT || 'OT').toUpperCase() === group.testament;
    }).forEach(function(bookName) {
    var firstChapter = BIBLE_CHAPTER_CATALOG.find(function(chapter) {
      return String(chapter.BOOK_EN || chapter.BOOK_KO || '') === bookName;
    });
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'bible-book-button';
    button.textContent = bookName.replace(/-/g, ' ');
    button.dataset.book = bookName;
    button.dataset.testament = String(firstChapter && firstChapter.TESTAMENT || 'OT');
    button.addEventListener('click', function() {
      BIBLE_SELECTED_BOOK = bookName;
      bookHost.querySelectorAll('.bible-book-button').forEach(function(item) {
        item.classList.toggle('is-selected', item === button);
      });
      activateBibleTestament_(button.dataset.testament);
      renderBibleChapterPicker_(bookName);
      if (startButton) startButton.disabled = true;
    });
      grid.appendChild(button);
    });
  });
}

function renderBibleChapterPicker_(bookName) {
  var chapterHost = document.getElementById('bibleChapterPicker');
  var selector = DOM.setSelector;
  if (!chapterHost || !selector) return;
  var chapters = BIBLE_CHAPTER_CATALOG.filter(function(chapter) {
    return String(chapter.BOOK_EN || chapter.BOOK_KO || '') === bookName;
  }).sort(function(left, right) {
    return (parseInt(left.CHAPTER, 10) || 0) - (parseInt(right.CHAPTER, 10) || 0);
  });
  chapterHost.innerHTML = '';
  var heading = document.createElement('div');
  heading.className = 'bible-chapter-heading';
  heading.innerHTML = '<strong>' + escapeHtml(bookName.replace(/-/g, ' ')) + '</strong>';
  var changeBookButton = document.createElement('button');
  changeBookButton.type = 'button';
  changeBookButton.className = 'bible-change-book';
  changeBookButton.textContent = 'Change book';
  changeBookButton.addEventListener('click', function() {
    document.getElementById('bibleBookPicker').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  heading.appendChild(changeBookButton);
  chapterHost.appendChild(heading);
  var chapterGrid = document.createElement('div');
  chapterGrid.className = 'bible-chapter-grid';
  chapters.forEach(function(chapter) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'bible-chapter-button';
    button.textContent = String(chapter.CHAPTER);
    button.setAttribute('aria-label', bookName.replace(/-/g, ' ') + ' Chapter ' + chapter.CHAPTER);
    button.addEventListener('click', async function() {
      chapterHost.querySelectorAll('.bible-chapter-button').forEach(function(item) {
        item.classList.toggle('is-selected', item === button);
      });
      var option = Array.prototype.find.call(selector.options, function(item) {
        return String(item.dataset.code || '') === String(chapter.CODE || '');
      });
      if (option) {
        selector.value = option.value;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var start = Math.max(1, parseInt(chapter.START_ROW, 10) || parseInt(chapter.START, 10) || 1);
      var hint = document.querySelector('.card-new .card-hint');
      if (hint) hint.textContent = 'Loading ' + bookName.replace(/-/g, ' ') + ' Chapter ' + chapter.CHAPTER + '...';
      button.disabled = true;
      var loaded = await startQuizWithNumber(start, { exactStart: true });
      if (!loaded) {
        button.disabled = false;
        if (hint) hint.textContent = 'Could not open this chapter. Please try again.';
      }
    });
    chapterGrid.appendChild(button);
  });
  chapterHost.appendChild(chapterGrid);
  chapterHost.hidden = false;
  window.requestAnimationFrame(function() {
    chapterHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  var title = document.querySelector('.sat-title');
  if (title) title.textContent = 'Bib ? ' + bookName.replace(/-/g, ' ');
}

function bibleShortBookName_(bookName) {
  var normalized = String(bookName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  var names = {
    'genesis': 'Gen', 'exodus': 'Ex', 'leviticus': 'Lev', 'numbers': 'Num', 'deuteronomy': 'Deut',
    'joshua': 'Josh', 'judges': 'Judg', 'ruth': 'Ruth', '1 samuel': '1 Sam', '2 samuel': '2 Sam',
    '1 kings': '1 Kgs', '2 kings': '2 Kgs', '1 chronicles': '1 Chr', '2 chronicles': '2 Chr',
    'ezra': 'Ezra', 'nehemiah': 'Neh', 'esther': 'Est', 'job': 'Job', 'psalms': 'Ps', 'proverbs': 'Prov',
    'ecclesiastes': 'Eccl', 'song of solomon': 'Song', 'isaiah': 'Isa', 'jeremiah': 'Jer', 'lamentations': 'Lam',
    'ezekiel': 'Ezek', 'daniel': 'Dan', 'hosea': 'Hos', 'joel': 'Joel', 'amos': 'Amos', 'obadiah': 'Obad',
    'jonah': 'Jonah', 'micah': 'Mic', 'nahum': 'Nah', 'habakkuk': 'Hab', 'zephaniah': 'Zeph',
    'haggai': 'Hag', 'zechariah': 'Zech', 'malachi': 'Mal', 'matthew': 'Matt', 'mark': 'Mark',
    'luke': 'Luke', 'john': 'John', 'acts': 'Acts', 'romans': 'Rom', '1 corinthians': '1 Cor',
    '2 corinthians': '2 Cor', 'galatians': 'Gal', 'ephesians': 'Eph', 'philippians': 'Phil',
    'colossians': 'Col', '1 thessalonians': '1 Thess', '2 thessalonians': '2 Thess', '1 timothy': '1 Tim',
    '2 timothy': '2 Tim', 'titus': 'Titus', 'philemon': 'Phlm', 'hebrews': 'Heb', 'james': 'Jas',
    '1 peter': '1 Pet', '2 peter': '2 Pet', '1 john': '1 John', '2 john': '2 John', '3 john': '3 John',
    'jude': 'Jude', 'revelation': 'Rev'
  };
  return names[normalized] || String(bookName || 'Bible').slice(0, 5);
}

function bibleSetHeaderTitle_(bookName, chapter) {
  return 'Bib · ' + bibleShortBookName_(bookName) + ' ' + (parseInt(chapter, 10) || 1);
}

function bibleSourceCodeParts_(sourceCode) {
  var match = String(sourceCode || '').trim().match(
    /^(OT|NT)-(.+)-(\d{2,3})-(\d{2,3})$/i
  );
  return match ? {
    testament: match[1].toUpperCase(),
    book: match[2],
    chapter: parseInt(match[3], 10),
    verse: parseInt(match[4], 10),
    sourceCode: match[1].toUpperCase() + '-' + match[2] + '-' +
      String(parseInt(match[3], 10)).padStart(2, '0') + '-' +
      String(parseInt(match[4], 10)).padStart(2, '0')
  } : null;
}

function bibleCatalogMatchesReference_(chapter, parts) {
  if (!chapter || !parts) return false;
  var expected = (parts.testament + '-' + parts.book + '-' +
    String(parts.chapter).padStart(2, '0')).toLowerCase();
  return String(chapter.CODE || '').toLowerCase() === expected ||
    (String(chapter.BOOK_EN || '').toLowerCase() === parts.book.toLowerCase() &&
      parseInt(chapter.CHAPTER, 10) === parts.chapter);
}

async function bibleQuizNumberForSource_(sourceCode) {
  var params = new URLSearchParams();
  params.set('action', 'source_lookup');
  params.set('source_code', sourceCode);
  params.set('sheet', DATA_SHEET);
  var response = await fetchQuizApi_(params);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  var data = await response.json();
  if (data && (data.status === 'error' || data.success === false)) {
    throwQuizApiError_(data, 'The linked Scripture reference could not be found.');
  }
  var row = data && Array.isArray(data.data) ? data.data[0] : null;
  // An older deployed function treats an unknown action as a normal range
  // request.  Ignore that unrelated first row and use the catalog fallback
  // until the direct-lookup function deployment has reached production.
  if (!row || String(row.SOURCE_CODE || row.source_code || '').toLowerCase() !==
      String(sourceCode || '').toLowerCase()) return 0;
  return Math.max(1, parseInt(row.N || row.n, 10) || 0);
}

async function openBibleScriptureReference_(sourceCode) {
  var parts = bibleSourceCodeParts_(sourceCode);
  if (!parts) {
    alert('This Scripture reference is not recognized: ' + sourceCode);
    return false;
  }
  // A reference can be clicked inside the full-screen People or Atlas
  // dialog.  Close that dialog before starting the quiz; otherwise the
  // question really changes behind the dialog and looks like a dead link.
  var peoplePanel = document.getElementById('biblePeoplePanel');
  if (peoplePanel && !peoplePanel.hidden) biblePeopleClose_();
  var explorePanel = document.getElementById('bibleExplorePanel');
  if (explorePanel && !explorePanel.hidden) {
    explorePanel.hidden = true;
    var exploreToggle = document.getElementById('bibleExploreToggle');
    if (exploreToggle) exploreToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('bible-people-open');
  }

  // Ask the protected API for the exact quiz number first.  This avoids
  // relying on a catalog range or a modal click handler to infer where a
  // reference belongs.  The catalog path remains as a safe fallback while
  // an older deployed Edge Function is still being refreshed.
  var start = 0;
  try {
    start = await bibleQuizNumberForSource_(parts.sourceCode);
  } catch (error) {
    console.warn('Direct Scripture lookup unavailable; using catalog fallback.', error);
  }
  if (!start) {
    if (!BIBLE_CHAPTER_CATALOG.length) {
      try {
        await loadBibleChapterCatalog_();
        updateSetSelector();
      } catch (error) {
        alert('The Bible chapter catalog could not be loaded. ' + error.message);
        return false;
      }
    }
    var catalogIndex = BIBLE_CHAPTER_CATALOG.findIndex(function(chapter) {
      return bibleCatalogMatchesReference_(chapter, parts);
    });
    if (catalogIndex < 0) {
      alert('This Bible chapter is not available yet: ' + parts.sourceCode);
      return false;
    }
    if (DOM.setSelector) {
      DOM.setSelector.selectedIndex = catalogIndex;
      DOM.setSelector.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var chapter = BIBLE_CHAPTER_CATALOG[catalogIndex];
    start = Math.max(1, parseInt(chapter.START_ROW, 10) ||
      parseInt(chapter.START, 10) || 1);
  }

  var loaded = await startQuizWithNumber(start, { exactStart: true });
  if (!loaded) return false;

  // Quiz rows are normalized by load50Questions() into lower-camel-case
  // properties.  Keep the original upper-case fallbacks for older rows, but
  // search the normalized fields first so a linked Scripture reference opens
  // its actual quiz instead of incorrectly reporting that none exists.
  var targetIndex = currentQuestions.findIndex(function(question) {
    return String(
      question.sourceCode || question.SOURCE_CODE ||
      question.subject || question.SUBJECT || ''
    ).toLowerCase() === parts.sourceCode.toLowerCase();
  });
  if (targetIndex < 0) {
    alert('The chapter opened, but no quiz has been created for ' +
      parts.sourceCode + ' yet.');
    return true;
  }
  currentIndex = targetIndex;
  RendererManager.disposeCurrent();
  renderCurrentQuestion();
  var quizContent = document.getElementById('quizContent');
  if (quizContent) {
    quizContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return true;
}

window.openBibleScriptureReference = openBibleScriptureReference_;

// Capture phase is intentional: reference buttons can be nested in People,
// Atlas, Timeline, and Library panels.  Some of those panels own bubbling
// click handlers, so resolving the Scripture link before bubbling makes the
// same button work consistently in every context.
document.addEventListener('click', function(event) {
  var referenceButton = event.target.closest('[data-bible-source-code]');
  if (!referenceButton) return;
  event.preventDefault();
  openBibleScriptureReference_(referenceButton.dataset.bibleSourceCode);
}, true);

async function loadBibleChapterCatalog_() {
  var catalogs = await Promise.all(['bible-ot', 'bible-nt'].map(async function(sheet) {
    var params = new URLSearchParams();
    params.set('action', 'catalog');
    params.set('sheet', sheet);
    params.set('_', String(Date.now()));
    var response = await fetchQuizApi_(params);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    var data = await response.json();
    if (data && (data.status === 'error' || data.success === false)) {
      throwQuizApiError_(data, 'Failed to load Bible catalog');
    }
    var testament = sheet === 'bible-nt' ? 'NT' : 'OT';
    return (Array.isArray(data.catalog) ? data.catalog : []).map(function(chapter) {
      return Object.assign({}, chapter, { TESTAMENT: testament });
    });
  }));
  BIBLE_CHAPTER_CATALOG = catalogs[0].concat(catalogs[1]);
  return BIBLE_CHAPTER_CATALOG;
}

detectTotalQuestions = async function() {
  var total = await bibleLegacyDetectTotalQuestions_();
  try {
    await loadBibleChapterCatalog_();
  } catch (error) {
    console.warn('Bible catalog unavailable:', error.message);
    BIBLE_CHAPTER_CATALOG = [];
  }
  return total;
};

updateSetSelector = function() {
  if (!Array.isArray(BIBLE_CHAPTER_CATALOG) || !BIBLE_CHAPTER_CATALOG.length) {
    return bibleLegacyUpdateSetSelector_();
  }
  var selector = DOM.setSelector;
  if (!selector) return;
  selector.innerHTML = '';
  BIBLE_CHAPTER_CATALOG.forEach(function(chapter, index) {
    var option = document.createElement('option');
    var bookName = chapter.BOOK_EN || chapter.BOOK_KO || 'Bible';
    option.value = String(index + 1);
    option.dataset.catalog = '1';
    // BIBLE-CATALOG START_ROW is the 1-based logical question number (N).
    // Older GAS responses also expose START = START_ROW - 1, which would
    // incorrectly begin each chapter with the previous chapter's last item.
    option.dataset.start = String(
      chapter.START_ROW != null && chapter.START_ROW !== ''
        ? chapter.START_ROW
        : chapter.START
    );
    option.dataset.limit = String(chapter.QUESTION_COUNT);
    option.dataset.code = String(chapter.CODE || '');
    option.dataset.bookName = bookName;
    option.dataset.chapter = String(chapter.CHAPTER || '');
    option.textContent = bookName + ' Chapter ' + chapter.CHAPTER;
    selector.appendChild(option);
  });

  renderBibleBookPicker_();

  if (DOM.startNumberInput && !IS_ADMIN_USER) {
    DOM.startNumberInput.parentElement.style.display = 'none';
  }
  var hint = document.querySelector('.card-new .card-hint');
  if (hint) hint.textContent = 'Select one of the 66 books.';
};

document.addEventListener('change', function(event) {
  if (!event.target || event.target.id !== 'setSelector') return;
  var option = event.target.options[event.target.selectedIndex];
  if (!option || option.dataset.catalog !== '1') return;
  event.stopImmediatePropagation();

  var start = Math.max(1, parseInt(option.dataset.start, 10) || 1);
  var limit = Math.max(1, Math.min(parseInt(option.dataset.limit, 10) || 1, 200));
  QUESTIONS_PER_SET = limit;
  currentStartNumber = start;
  if (DOM.startNumberInput) DOM.startNumberInput.value = String(start);
  var title = document.querySelector('.sat-title');
  if (title) title.textContent = bibleSetHeaderTitle_(
    option.dataset.bookName,
    option.dataset.chapter
  );
  console.log('Bible chapter selected:', option.dataset.code, 'start', start, 'count', limit);
}, true);
