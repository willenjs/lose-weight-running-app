import { PLAN, findWorkout, totalSeconds } from '../core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState, shouldOfferResume,
} from '../core/timer.js';
import { markDone, unmark, programStats } from '../core/progress.js';
import { translate, formatDuration, formatList, LANGS, DEFAULT_LANG, LOCALES, VOICE_LOCALES } from '../i18n/index.js';
import { createStorage } from '../platform/storage.js';
import { createCuePlayer } from '../platform/audio.js';
import { speak, cancelSpeech } from '../platform/speech.js';
import { createWakeLock } from '../platform/wakeLock.js';
import { share, canShare } from '../platform/share.js';
import { normalizeAudioSettings, isMuted, testSequence, activeCues } from '../core/audioSettings.js';
import { coachExtras } from '../core/coach.js';

export { VOICE_STYLES } from '../core/audioSettings.js';

/** @typedef {import('../core/timer.js').Session} Session */

// UI refresh rate while visible. Correctness never depends on it: state is
// derived from timestamps and cues are pre-scheduled on the audio clock.
const TICK_MS = 250;
// Lets the scheduled finish melody play before audio is torn down.
const FINISH_AUDIO_GRACE_MS = 3000;
const TOAST_MS = 2000;
// Phase length used in the audio test's sample announcement.
const TEST_PHASE_SECONDS = 5 * 60;

const storage = createStorage();
const cuePlayer = createCuePlayer();
const wakeLock = createWakeLock();

export const app = $state({
  /** @type {'plan' | 'workout' | 'run' | 'finished'} */
  screen: 'plan',
  /** @type {string | null} */
  workoutId: null,
  /** @type {Session | null} */
  session: null,
  /** @type {Session | null} */
  pendingResume: null,
  progress: storage.loadProgress(),
  lang: DEFAULT_LANG,
  now: Date.now(),
  audioAvailable: true,
  settings: storage.loadSettings(),
  audioSheetOpen: false,
  audioTesting: false,
  confirmingStop: false,
  /** @type {string | null} */
  toast: null,
  canShare: canShare(),
});

let ticker = null;
let finishTimer = null;
let lastPhaseIndex = -1;
let toastTimer = null;
let testTimer = null;
// Bumped on each audio test so callbacks from an earlier test are ignored.
let testRun = 0;

export function init() {
  const savedLang = storage.loadLang();
  applyLang(LANGS.includes(savedLang) ? savedLang : DEFAULT_LANG);

  const saved = storage.loadSession();
  if (!saved) return;
  if (shouldOfferResume(saved, Date.now())) app.pendingResume = saved;
  else storage.clearSession();
}

export function t(key, params) {
  return translate(app.lang, key, params);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(LOCALES[app.lang]);
}

export function setLang(lang) {
  applyLang(lang);
  storage.saveLang(lang);
}

export function openWorkout(id) {
  app.workoutId = id;
  app.screen = 'workout';
}

export function goToPlan() {
  app.workoutId = null;
  app.screen = 'plan';
}

/** Header brand tap: back to the plan, but never ends a run without asking. */
export function goHome() {
  if (app.screen === 'run') {
    requestStop();
    return;
  }
  if (app.screen === 'plan') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  goToPlan();
  // Instant: a smooth scroll gets cut short while the new screen renders.
  window.scrollTo(0, 0);
}

export function unmarkWorkout(id) {
  saveProgress(unmark(app.progress, id));
}

export function startWorkout() {
  beginRun(startSession(app.workoutId, Date.now()));
}

export function acceptResume() {
  const session = app.pendingResume;
  app.pendingResume = null;
  beginRun(session);
}

export function discardResume() {
  app.pendingResume = null;
  storage.clearSession();
}

export function pause() {
  cuePlayer.stop();
  setSession(pauseSession(app.session, Date.now()));
}

export function resume() {
  setSession(resumeSession(app.session, Date.now()));
  playCues();
}

export function skip() {
  cuePlayer.stop();
  setSession(skipPhase(app.session, currentWorkout(), Date.now()));
  if (app.session.pausedAt === null) playCues();
  tick();
}

export function requestStop() {
  app.confirmingStop = true;
}

export function cancelStop() {
  app.confirmingStop = false;
}

export function stop() {
  cuePlayer.stop();
  endRun();
  app.screen = 'workout';
}

export function openAudioSheet() {
  app.audioSheetOpen = true;
}

export function closeAudioSheet() {
  app.audioSheetOpen = false;
}

/** Applies and saves audio settings; called from taps and slider input (user gestures). */
export function setAudio(patch) {
  app.settings = normalizeAudioSettings({ ...$state.snapshot(app.settings), ...patch });
  storage.saveSettings($state.snapshot(app.settings));
  if (!canSpeak()) cancelSpeech();
  // Re-schedule so the change applies now.
  if (app.session) {
    cuePlayer.stop();
    if (app.session.pausedAt === null) playCues();
  }
}

/** Live slider feedback while dragging: no saving or re-scheduling until setAudio on release. */
export function previewAudio(patch) {
  app.settings = normalizeAudioSettings({ ...$state.snapshot(app.settings), ...patch });
}

/**
 * Plays each sound that has volume, in the order of the sliders: a sample
 * announcement, then the beeps, then the fanfare. Called from a tap.
 */
export function testAudio() {
  const run = ++testRun;
  clearTimeout(testTimer);
  const settings = $state.snapshot(app.settings);
  const { speak: withVoice, voiceExtras, tones } = testSequence(settings);
  const playTones = () => {
    if (run !== testRun) return;
    const ms = cuePlayer.test(tones, settings);
    testTimer = setTimeout(() => { if (run === testRun) app.audioTesting = false; }, ms);
  };

  app.audioTesting = true;
  // Unlock audio within the tap, even when the voice goes first.
  cuePlayer.test([], settings);
  if (!withVoice || !say(phaseLine('run', TEST_PHASE_SECONDS, voiceExtras), { onEnd: playTones })) playTones();
}

export function audioMuted() {
  return isMuted(app.settings);
}

export function volumeIcon() {
  return isMuted(app.settings) ? 'volume-off' : 'volume';
}

/** Run screen audio chip, e.g. "Beeps + Voice + Fanfare"; null when nothing plays. */
export function cuesLabel() {
  const cues = activeCues(app.settings);
  return cues.length ? cues.map((cue) => t(`run.cue.${cue}`)).join(' + ') : null;
}

/** Workout screen audio note listing what will play; null when nothing will. */
export function cuesSentence() {
  const cues = activeCues(app.settings);
  if (!cues.length) return null;
  const items = ['voice', 'beeps', 'fanfare'].filter((cue) => cues.includes(cue)).map((cue) => t(`workout.cue.${cue}`));
  return t('workout.audioOn', { list: formatList(items, app.lang) });
}

/** Voice language tag shown next to the voice coach, e.g. "PT-BR". */
export function voiceTag() {
  return LOCALES[app.lang].toUpperCase();
}

export async function shareResult() {
  const workout = findWorkout(app.workoutId);
  if (!workout) return;
  const { done, total } = programStats(PLAN, app.progress);
  const result = await share({
    title: t('app.title'),
    text: t('share.text', { week: workout.week, day: workout.day, done, total }),
    url: location.origin + location.pathname,
  });
  if (result === 'copied') showToast(t('toast.copied'));
}

export function workoutMinutes(workout) {
  return Math.round(totalSeconds(workout) / 60);
}

/** Compact phase list, e.g. "C7 • T2 • R5". */
export function phaseShorthand(workout) {
  return workout.phases
    .map((phase) => `${t(`short.${phase.type}`)}${Math.round(phase.seconds / 60)}`)
    .join(' • ');
}

function showToast(text) {
  clearTimeout(toastTimer);
  app.toast = text;
  toastTimer = setTimeout(() => { app.toast = null; }, TOAST_MS);
}

function applyLang(lang) {
  app.lang = lang;
  document.documentElement.lang = LOCALES[lang];
}

function currentWorkout() {
  return findWorkout(app.session.workoutId);
}

function setSession(session) {
  app.session = session;
  storage.saveSession($state.snapshot(session));
}

function saveProgress(progress) {
  app.progress = progress;
  storage.saveProgress($state.snapshot(progress));
}

function beginRun(session) {
  clearTimeout(finishTimer);
  app.workoutId = session.workoutId;
  app.screen = 'run';
  lastPhaseIndex = -1;
  setSession(session);
  if (session.pausedAt === null) playCues();
  wakeLock.acquire();
  startTicking();
}

function playCues() {
  app.audioAvailable = cuePlayer.start(
    $state.snapshot(app.session), currentWorkout(), Date.now(), $state.snapshot(app.settings),
  );
}

function startTicking() {
  stopTicking();
  ticker = setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  tick();
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

// Re-schedule cues on return to the foreground: the audio clock can stall
// (context suspended, audio focus lost, output device switch) while the
// display stays correct, so returning must re-sync audio to the timer.
function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  tick();
  if (app.session && app.session.pausedAt === null) playCues();
}

function tick() {
  if (!app.session) return;
  const workout = currentWorkout();
  app.now = Date.now();
  const state = getState(app.session, workout, app.now);
  if (state.finished) {
    finish(workout);
    return;
  }
  if (!state.paused && state.phaseIndex !== lastPhaseIndex) {
    lastPhaseIndex = state.phaseIndex;
    announcePhase(workout, state.phaseIndex, state.phaseRemainingMs);
  }
}

function announcePhase(workout, phaseIndex, remainingMs) {
  const phase = workout.phases[phaseIndex];
  const extras = coachExtras(workout, phaseIndex, app.settings.voiceStyle);
  say(phaseLine(phase.type, Math.round(remainingMs / 1000), extras));
}

/** "Walk for 5 minutes", followed by any coach lines (i18n keys). */
function phaseLine(type, seconds, extraKeys) {
  const command = t('cue.phase', { phase: t(`phase.${type}`), duration: formatDuration(seconds, app.lang) });
  const extras = extraKeys.map((key) => t(key));
  return extras.length ? `${command}. ${extras.join(' ')}` : command;
}

function canSpeak() {
  return app.settings.voiceVolume > 0;
}

/** @param {{ onEnd?: () => void }} [options] @returns {boolean} whether speech started */
function say(text, { onEnd } = {}) {
  if (!canSpeak()) return false;
  return speak(text, VOICE_LOCALES[app.lang], { volume: app.settings.voiceVolume, onEnd });
}

function finish(workout) {
  saveProgress(markDone(app.progress, workout.id, new Date().toISOString()));
  endRun();
  app.screen = 'finished';
  say(t('cue.finish'));
  finishTimer = setTimeout(() => cuePlayer.stop(), FINISH_AUDIO_GRACE_MS);
}

function endRun() {
  app.confirmingStop = false;
  stopTicking();
  wakeLock.release();
  storage.clearSession();
  app.session = null;
}
