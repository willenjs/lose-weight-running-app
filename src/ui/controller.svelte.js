import { findWorkout } from '../core/plan.js';
import {
  startSession, pauseSession, resumeSession, skipPhase, getState, shouldOfferResume,
} from '../core/timer.js';
import { markDone, unmark } from '../core/progress.js';
import { translate, formatDuration, LANGS, DEFAULT_LANG, LOCALES } from '../i18n/index.js';
import { createStorage } from '../platform/storage.js';
import { createCuePlayer } from '../platform/audio.js';
import { speak } from '../platform/speech.js';
import { createWakeLock } from '../platform/wakeLock.js';

/** @typedef {import('../core/timer.js').Session} Session */

// UI refresh rate while visible. Correctness never depends on it: state is
// derived from timestamps and cues are pre-scheduled on the audio clock.
const TICK_MS = 250;
// Lets the scheduled finish melody play before audio is torn down.
const FINISH_AUDIO_GRACE_MS = 2000;

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
});

let ticker = null;
let finishTimer = null;
let lastPhaseIndex = -1;

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

export function stop() {
  cuePlayer.stop();
  endRun();
  app.screen = 'workout';
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
  app.audioAvailable = cuePlayer.start($state.snapshot(app.session), currentWorkout(), Date.now());
}

function startTicking() {
  stopTicking();
  ticker = setInterval(tick, TICK_MS);
  document.addEventListener('visibilitychange', tick);
  tick();
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
  document.removeEventListener('visibilitychange', tick);
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
  if (state.phaseIndex !== lastPhaseIndex) {
    lastPhaseIndex = state.phaseIndex;
    announcePhase(workout.phases[state.phaseIndex]);
  }
}

function announcePhase(phase) {
  const text = t('cue.phase', {
    phase: t(`phase.${phase.type}`),
    duration: formatDuration(phase.seconds, app.lang),
  });
  speak(text, LOCALES[app.lang]);
}

function finish(workout) {
  saveProgress(markDone(app.progress, workout.id, new Date().toISOString()));
  endRun();
  app.screen = 'finished';
  speak(t('cue.finish'), LOCALES[app.lang]);
  finishTimer = setTimeout(() => cuePlayer.stop(), FINISH_AUDIO_GRACE_MS);
}

function endRun() {
  stopTicking();
  wakeLock.release();
  storage.clearSession();
  app.session = null;
}
