import './fonts.css';
import './style.css';
import CONFIG from './config.js';
import { details, DAYS, dayRange, wrapHour, h12, meridiem, fmtLong, fmtShort } from './details.js';
import { createScene, ARCH_SPACING, ARCH_HALF_WIDTH } from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;

/* ---------------- Opening hours ---------------- */
// details.js works the hours and contacts out from config.js, for this script and for the text built into the page
const D = details(CONFIG);
const OPENS = D.opens, CLOSES = D.closes;
const isOpen = h => D.allDay || wrapHour(h - OPENS) < wrapHour(CLOSES - OPENS);
function el(tag, props = {}, text) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => n.setAttribute(k, v));
  if (text != null) n.textContent = text;
  return n;
}

/* ---------------- Text splitting ---------------- */
function splitWords(el) {
  let i = 0;
  const walk = node => {
    Array.from(node.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--i', i++);
          w.appendChild(inner);
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
}
$$('[data-split]').forEach(splitWords);

// Manifesto: words light up as you read down the page
const manifesto = $('#manifesto');
let manifestoWords = [];
if (manifesto) {
  const words = manifesto.textContent.trim().split(/\s+/);
  manifesto.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'mw' + (/^(feel,|belong\.)$/i.test(w) ? ' gold' : '');
    s.textContent = w;
    manifesto.appendChild(s);
    if (i < words.length - 1) manifesto.appendChild(document.createTextNode(' '));
  });
  manifestoWords = $$('.mw', manifesto);
  if (reduced) root.classList.add('no-scrub');
}

/* ---------------- Reveal on scroll ---------------- */
const hero = $('.hero');
const revealEls = $$('[data-reveal], [data-split]');
let heroReleased = false;
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    if (!heroReleased && hero.contains(e.target)) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: .12, rootMargin: '0px 0px -6% 0px' }) : null;
if (io) revealEls.forEach(el => io.observe(el)); else revealEls.forEach(el => el.classList.add('in'));

function releaseHero() {
  heroReleased = true;
  $$('[data-reveal], [data-split]', hero).forEach((el, i) => {
    el.style.setProperty('--d', (i * .14) + 's');
    el.classList.add('in');
    if (io) io.unobserve(el);
  });
}

/* ---------------- 3D scene ---------------- */
let scene = null;
const canvas = $('#scene');
const ROOM_COUNT = document.querySelectorAll('.room').length;
const LAST_ROOM = Math.max(1, ROOM_COUNT - 1);
try { scene = createScene(canvas, { archCount: ROOM_COUNT + 1, reducedMotion: reduced, still: /[?&]still\b/.test(location.search), opensAt: OPENS, closesAt: CLOSES }); } catch (err) { console.warn('[ORA] 3D scene unavailable:', err); }
if (!scene) root.classList.add('no-webgl');
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (scene) scene.stop(); scene = null; root.classList.add('no-webgl'); });

/* ---------------- Loader ---------------- */
const loader = $('#loader');
const loaderCount = $('#loaderCount');
let loaderDone = false;
function finishLoader() {
  if (loaderDone) return;
  loaderDone = true;
  loader.classList.add('is-done');
  if (scene) scene.playIntro();
  setTimeout(releaseHero, reduced ? 0 : 450);
}
(function runLoader() {
  const start = performance.now();
  const minTime = reduced ? 150 : 1100;
  // Wait for the fonts and for the 3D scene to finish compiling, so the intro starts without a stutter.
  let assetsReady = false;
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : null;
  Promise.all([fontsReady, scene ? scene.ready : null]).then(() => { assetsReady = true; }, () => { assetsReady = true; });
  const step = now => {
    if (loaderDone) return;
    const t = clamp((now - start) / minTime);
    loaderCount.textContent = Math.round(easeIO(t) * (assetsReady ? 100 : 92));
    if (t >= 1 && assetsReady) { setTimeout(finishLoader, reduced ? 0 : 250); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(finishLoader, 4500); // never hold the page hostage
})();

/* ---------------- Layout metrics ---------------- */
// Positions are measured once per layout change, so scrolling itself never forces the browser to re-layout.
const nav = $('#nav');
const house = $('#house'), rooms = $('#rooms'), day = $('#day'), join = $('#join'), list = $('#list'), visit = $('#visit');
const houseSvgPaths = $$('#houseSvg .house__lines path');
const houseSvg = $('#houseSvg');
const band = $('.band');
const bandTrack = $('#bandTrack');
const sectionsForNav = [['house', house], ['rooms', rooms], ['day', day], ['join', join], ['list', list], ['visit', visit]];
let M = {};
function measure() {
  const y = window.scrollY;
  const box = el => { const r = el.getBoundingClientRect(); return { top: r.top + y, bottom: r.bottom + y, height: r.height }; };
  M = {
    vw: window.innerWidth, vh: window.innerHeight,
    house: box(house).top, rooms: box(rooms).top, roomsH: rooms.offsetHeight,
    day: box(day).top, join: box(join).top, visit: box(visit).top,
    docH: root.scrollHeight,
    sections: sectionsForNav.map(([id, el]) => [id, box(el)]),
    manifesto: manifesto ? box(manifesto) : null,
    houseSvg: houseSvg ? box(houseSvg) : null,
    band: band ? box(band) : null,
    bandHalf: bandTrack ? bandTrack.scrollWidth / 2 : 0
  };
  M.aspect = M.vw / M.vh;
  M.mobile = M.vw <= 900;
  M.dist = M.aspect < .6 ? 7.8 : M.aspect < 1 ? 7 : 7.8;      // in front of each room arch
  M.heroDist = M.aspect < .6 ? 4.6 : M.aspect < 1 ? 5 : 4.6; // the entrance arch frames the hero
  M.heroLook = M.aspect < .6 ? 1.7 : M.aspect < 1 ? 1.9 : 2.4;
  M.roomSpan = Math.max(1, M.roomsH - M.vh);
  M.roomX = M.mobile ? 0 : roomCameraX();
  if (scene) scene.resize();
  dirty = true;
}

// On wider screens the camera stands to one side, so the arch sits to the right of the room text. How far it
// moves depends on where the widest room's text ends: far enough that the arch clears it, never so far that
// the arch's right column leaves the screen, and never less than the original composition.
function roomCameraX() {
  // where the words actually end: a paragraph's box runs wider than its longest line, the tag is its own shape
  let textRight = 0;
  const range = document.createRange();
  $$('.room > *').forEach(el => {
    const inline = getComputedStyle(el).display.startsWith('inline');
    if (!inline) range.selectNodeContents(el);
    textRight = Math.max(textRight, (inline ? el : range).getBoundingClientRect().right);
  });
  const fov = M.aspect < .6 ? 66 : M.aspect < 1 ? 58 : 48; // matches the camera in scene.js
  const span = 2 * M.dist * Math.tan(fov * Math.PI / 360) * M.aspect; // world width seen across the screen at the arch
  const clearOfText = -ARCH_HALF_WIDTH - ((textRight + M.vw * .02) / M.vw - .5) * span;
  const onScreen = ARCH_HALF_WIDTH - (.97 - .5) * span;
  return Math.max(onScreen, Math.min(-1.15, clearOfText));
}
let dirty = true;
// Phones fire resize repeatedly while their toolbars slide, so re-measure at most once per frame.
let measureQueued = false;
const queueMeasure = () => {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(() => { measureQueued = false; measure(); });
};
window.addEventListener('resize', queueMeasure);
if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);

/* ---------------- Rooms ---------------- */
const roomEls = $$('.room');
const roomBtns = $$('#roomsIndex button');
let activeRoom = -1;
function setRoom(i) {
  if (i === activeRoom) return;
  activeRoom = i;
  roomEls.forEach((el, k) => {
    const on = k === i;
    el.classList.toggle('is-active', on);
    el.classList.toggle('is-past', k < i);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
    const cta = $('.room__cta', el);
    if (cta) cta.tabIndex = on ? 0 : -1;
  });
  roomBtns.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
}
setRoom(0);
rooms.style.setProperty('--rooms', ROOM_COUNT);
roomBtns.forEach(b => b.addEventListener('click', () => {
  const i = +b.dataset.go;
  window.scrollTo({ top: M.rooms + (i / LAST_ROOM) * M.roomSpan + 2, behavior: reduced ? 'auto' : 'smooth' });
}));

/* ---------------- Camera journey ---------------- */
// Arch 0 is the entrance; each room sits at the next arch along. The camera dwells in front of each arch.
const dwell = f => f - Math.sin(2 * Math.PI * f) / (2 * Math.PI) * .86;
function journey(y) {
  const D = M.dist;
  const zRoom = i => -(i + 1) * ARCH_SPACING + D;
  const zStart = M.heroDist;
  const xRooms = M.roomX;
  const lookRooms = M.mobile ? 1.45 : 2.1;
  let z, x = 0, look = 2.2, lift = 0, room = -1, focus = 0;
  if (y < M.rooms) {
    const a = clamp(y / Math.max(1, M.rooms));
    z = lerp(zStart, zRoom(0), easeIO(a));
    const into = sstep(.72, 1, a);
    x = xRooms * into; look = lerp(M.heroLook, lookRooms, sstep(.3, 1, a));
    focus = a > .6 ? 1 : 0;
  } else if (y < M.rooms + M.roomSpan) {
    const p = clamp((y - M.rooms) / M.roomSpan);
    z = zRoom(0) - ARCH_SPACING * dwell(p * LAST_ROOM);
    x = xRooms; look = lookRooms;
    room = clamp(Math.round(p * LAST_ROOM), 0, LAST_ROOM);
    focus = room + 1;
  } else {
    const q = clamp((y - (M.rooms + M.roomSpan)) / Math.max(1, M.day - (M.rooms + M.roomSpan)));
    const e = easeIO(q);
    z = zRoom(LAST_ROOM) - (D + 9) * e;
    x = lerp(xRooms, 0, e); look = lerp(lookRooms, 2.2, e); lift = e;
    room = LAST_ROOM; focus = LAST_ROOM + 1;
  }
  return { z, x, look, lift, room, focus };
}

/* ---------------- Day clock ---------------- */
// A 24-hour sun clock in whole hours. Noon points straight up; the sun rises on the left at 6 am, sets on
// the right at 6 pm and spends the night below the horizon, matching the sun in the 3D garden behind it.
// Each moment runs from its hour until the next one starts; outside opening hours the clock shows Closed.
const MOMENTS = [
  { h: 8, name: 'First light', space: 'Café · Nature', text: 'The first pour of coffee, birdsong, and dew still on the lawn.' },
  { h: 10, name: 'Reading morning', space: 'Library', text: 'A book from the shelves and a window seat in a quiet corner of the house.' },
  { h: 12, name: 'Making hours', space: 'Studio · Art', text: 'Sound, image and ideas in the studio. New work hung on the old walls.' },
  { h: 17, name: 'Golden hour', space: 'Music & Stage', text: 'Acoustic sets, poetry and theatre on the lawn as the light turns amber.' },
  { h: 19, name: 'Lanterns on', space: 'Film', text: 'A screen goes up under the trees. Film evenings, shared slowly.' },
  { h: 21, name: 'Private evenings', space: 'Private Events', text: 'Gatherings and private evenings, held in a heritage house.' }
].sort((a, b) => wrapHour(a.h - OPENS) - wrapHour(b.h - OPENS));
const momentFor = h => { let m = MOMENTS[0]; MOMENTS.forEach(x => { if (wrapHour(x.h - OPENS) <= wrapHour(h - OPENS)) m = x; }); return m; };

const clock = $('#dialClock');
const hand = $('#dialHand');
const knob = $('#dialKnob');
const dialTime = $('#dialTime'), dialMer = $('#dialMer'), dialStatus = $('#dialStatus');
const dialName = $('#dialName'), dialText = $('#dialText'), dialTags = $('#dialTags'), dialCard = $('#dialCard');
const C = 200, R = 138, FACE = 66; // in SVG units: centre, radius of the sun's path, centre medallion
const pt = (h, r) => { const a = (h - 12) / 24 * Math.PI * 2; return [(C + Math.sin(a) * r).toFixed(1), (C - Math.cos(a) * r).toFixed(1)]; };
const arcPath = (from, to, r) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${x1} ${y1}A${r} ${r} 0 ${wrapHour(to - from) > 12 ? 1 : 0} 1 ${x2} ${y2}`; };
const svgEl = (tag, attrs) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };

$('#dialOpen').setAttribute('d', OPENS === CLOSES ? `M${C} ${C - R}a${R} ${R} 0 1 1 0 ${2 * R}a${R} ${R} 0 1 1 0 ${-2 * R}` : arcPath(OPENS, CLOSES, R));
$('#dialClosed').setAttribute('d', OPENS === CLOSES ? '' : arcPath(CLOSES, OPENS, R));
const hourLabels = {};
for (let h = 0; h < 24; h++) {
  const major = h % 3 === 0;
  const [x1, y1] = pt(h, R + 8), [x2, y2] = pt(h, R + (major ? 18 : 13));
  $('#dialTicks').appendChild(svgEl('line', { x1, y1, x2, y2, class: [major && 'is-major', isOpen(h) && 'is-open'].filter(Boolean).join(' ') }));
  if (major) {
    // labels on the sides start just past their tick and run outward, so they never sit on it
    const s = Math.sin((h - 12) / 24 * Math.PI * 2);
    const anchor = Math.abs(s) < .2 ? 'middle' : s > 0 ? 'start' : 'end';
    const [x, y] = pt(h, anchor === 'middle' ? R + 30 : R + 24);
    const label = svgEl('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central' });
    label.textContent = fmtShort(h);
    $('#dialLabels').appendChild(label);
    hourLabels[h] = label;
  }
}
const marks = MOMENTS.map(m => {
  const [cx, cy] = pt(m.h, R);
  const dot = svgEl('circle', { cx, cy, r: 4.5, class: 'dial__mark' });
  const tip = svgEl('title', {});
  tip.textContent = `${fmtShort(m.h)} · ${m.name}`;
  dot.appendChild(tip);
  dot.addEventListener('click', e => { e.stopPropagation(); setHour(m.h); });
  $('#dialMarks').appendChild(dot);
  return dot;
});

// The moment buttons are written from MOMENTS, so the list and the clock always agree.
const momentList = $('#dayMoments');
momentList.textContent = '';
const momentBtns = MOMENTS.map(m => {
  const b = el('button', { type: 'button', 'data-hour': m.h });
  b.append(el('time', { datetime: String(m.h).padStart(2, '0') + ':00' }, fmtShort(m.h)), m.name);
  b.addEventListener('click', () => setHour(m.h));
  const li = document.createElement('li');
  li.appendChild(b);
  momentList.appendChild(li);
  return b;
});

let hour = 19, handDeg = null, lastMoment;
function setHour(h) {
  hour = wrapHour(Math.round(h));
  // turn the hand the short way round, so passing midnight never spins it back through the whole day
  const deg = (hour - 12) * 15;
  handDeg = handDeg === null ? deg : handDeg + (((deg - handDeg) % 360) + 540) % 360 - 180;
  hand.style.transform = `rotate(${handDeg}deg)`;
  Object.entries(hourLabels).forEach(([at, label]) => label.classList.toggle('is-under', +at === hour)); // the sun covers its own hour
  // how high the sun stands: 1 at noon, 0 on the horizon at 6 am and 6 pm, below zero at night
  const alt = Math.sin((hour - 6) / 12 * Math.PI);
  clock.classList.toggle('is-night', alt < -.1);
  clock.classList.toggle('is-low', alt >= -.1 && alt < .3);
  clock.style.setProperty('--day', clamp(alt * 1.6).toFixed(2));
  clock.style.setProperty('--night', clamp(.1 - alt * 2.5).toFixed(2));
  const open = isOpen(hour);
  const m = open ? momentFor(hour) : null;
  clock.classList.toggle('is-closed', !open);
  dialTime.textContent = `${h12(hour)}.00`;
  dialMer.textContent = meridiem(hour);
  dialStatus.textContent = open ? 'Open' : 'Closed';
  knob.setAttribute('aria-valuenow', String(hour));
  knob.setAttribute('aria-valuetext', `${fmtLong(hour)}, ${open ? `open. ${m.name}` : 'closed'}`);
  if (m !== lastMoment) {
    lastMoment = m;
    dialCard.classList.toggle('is-closed', !open);
    dialName.textContent = open ? m.name : 'We’re closed';
    dialText.textContent = open ? m.text : `The house is resting. The doors open again at ${fmtLong(OPENS)}.`;
    dialTags.textContent = '';
    (open ? m.space.split(' · ') : [D.closedDays.length ? `Open ${dayRange(D.openDays, true)}` : 'Open daily', `${fmtShort(OPENS)} to ${fmtShort(CLOSES)}`]).forEach(t => dialTags.appendChild(el('span', {}, t)));
    dialCard.classList.remove('swap'); void dialCard.offsetWidth; dialCard.classList.add('swap');
    MOMENTS.forEach((x, i) => {
      momentBtns[i].setAttribute('aria-pressed', String(x === m));
      marks[i].classList.toggle('is-current', x === m);
    });
  }
  if (scene) scene.setHour(hour);
}
setHour(hour);
requestAnimationFrame(() => requestAnimationFrame(() => clock.classList.add('is-live'))); // ease the hand only after the first paint

let dragging = false, downType = '';
// The hour the pointer points at (noon straight up, clockwise), and its distance from the centre in SVG units
function pointerHour(e) {
  const r = clock.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  return { h: wrapHour(Math.round(12 + Math.atan2(dx, -dy) / (Math.PI * 2) * 24)), d: Math.hypot(dx, dy) / r.width * 400 };
}
clock.addEventListener('pointerdown', e => {
  downType = e.pointerType;
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  // On touch screens only the sun itself drags, so a swipe across the clock still scrolls the page.
  if (e.pointerType === 'touch' && !knob.contains(e.target)) return;
  const p = pointerHour(e);
  if (p.d < FACE && !knob.contains(e.target)) return; // the centre points nowhere
  dragging = true;
  try { clock.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
  setHour(p.h);
  knob.focus({ preventScroll: true });
});
// A tap on the clock face sets the time to the hour tapped.
clock.addEventListener('click', e => {
  if (downType !== 'touch' || e.detail === 0 || knob.contains(e.target)) return;
  const p = pointerHour(e);
  if (p.d >= FACE) setHour(p.h);
});
clock.addEventListener('pointermove', e => {
  if (!dragging) return;
  const p = pointerHour(e);
  if (p.d > FACE / 2) setHour(p.h); // near the centre the direction is too unsteady to follow
});
const endDrag = () => { dragging = false; };
clock.addEventListener('pointerup', endDrag);
clock.addEventListener('pointercancel', endDrag);
knob.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 }[e.key];
  if (step) setHour(hour + step);
  else if (e.key === 'Home') setHour(0);
  else if (e.key === 'End') setHour(23);
  else return;
  e.preventDefault();
});

/* ---------------- Cursor & pointer ---------------- */
const cursor = $('#cursor');
const cursorLabel = $('#cursorLabel');
const ring = $('.cursor__ring', cursor), dot = $('.cursor__dot', cursor);
let px = M.vw / 2 || window.innerWidth / 2, py = window.innerHeight / 2, rx = px, ry = py, pointerSeen = false;
if (finePointer && !reduced) root.classList.add('has-cursor');
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') { if (scene) scene.setPointer(0, 0, false); return; }
  px = e.clientX; py = e.clientY; pointerSeen = true;
  cursor.classList.remove('is-hidden');
  if (scene) scene.setPointer((px / window.innerWidth) * 2 - 1, (py / window.innerHeight) * 2 - 1, true);
}, { passive: true });
document.addEventListener('mouseout', e => {
  if (e.relatedTarget) return; // still inside the page
  cursor.classList.add('is-hidden');
  if (scene) scene.setPointer(0, 0, false);
});
document.addEventListener('pointerover', e => {
  if (!e.target.closest) return;
  const t = e.target.closest('a, button, summary, [role="slider"], label, input, textarea, [data-cursor], .dial__clock');
  const label = t && t.closest('[data-cursor]') ? t.closest('[data-cursor]').dataset.cursor : (t && t.closest('.dial__clock') ? 'Drag' : '');
  // over text fields the regular text cursor takes over
  cursor.classList.toggle('is-text', !!e.target.closest('input:not([type="checkbox"]), textarea'));
  cursor.classList.toggle('is-hover', !!t && !label);
  cursor.classList.toggle('is-label', !!label);
  cursorLabel.textContent = label;
});

// Magnetic buttons
if (finePointer && !reduced) {
  $$('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * .18}px, ${dy * .3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  // Lantern spotlight + tilt on cards
  $$('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (x * 100) + '%');
      card.style.setProperty('--my', (y * 100) + '%');
      card.style.setProperty('--rx', ((.5 - y) * 7) + 'deg');
      card.style.setProperty('--ry', ((x - .5) * 9) + 'deg');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

/* ---------------- Nav, menu ---------------- */
const menu = $('#menu');
const toggle = $('#menuToggle');
// While the menu is open, everything behind it is inert, so keyboard focus stays inside the menu.
const behindMenu = [$('.skip'), $('#main'), $('.foot')];
let menuOpen = false;
function openMenu() {
  menuOpen = true;
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  root.style.overflow = 'hidden';
  behindMenu.forEach(el => { el.inert = true; });
  navHidden = false;
  nav.classList.remove('is-hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  setTimeout(() => { const a = $('a', menu); if (menuOpen && a) a.focus({ preventScroll: true }); }, 300);
}
function closeMenu(focusToggle = true) {
  if (!menuOpen) return;
  menuOpen = false;
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  root.style.overflow = '';
  behindMenu.forEach(el => { el.inert = false; });
  setTimeout(() => { if (!menuOpen) menu.hidden = true; }, reduced ? 0 : 900);
  if (focusToggle) toggle.focus({ preventScroll: true });
}
toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
$$('a', menu).forEach(a => a.addEventListener('click', () => closeMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) closeMenu(); });
window.matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) closeMenu(false); });

const navLinks = $$('.nav__links a');

/* ---------------- Interest shortcuts ---------------- */
// A join link from a room or card ticks that interest on the form. The chip flashes once it has scrolled
// fully into view, so the flash is seen rather than played out while the page is still travelling.
const flash = box => { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); };
const flashWhenSeen = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  flashWhenSeen.unobserve(e.target);
  flash(e.target.querySelector('input'));
}), { threshold: 1 }) : null;
$$('[data-interest]').forEach(a => a.addEventListener('click', () => {
  const box = $(`#joinForm input[value="${a.dataset.interest}"]`);
  if (!box) return;
  box.checked = true;
  if (!flashWhenSeen) { flash(box); return; }
  flashWhenSeen.unobserve(box.parentElement);
  flashWhenSeen.observe(box.parentElement);
}));

/* ---------------- Visit: today's hours, copying, the map ---------------- */
const CFG = CONFIG;

// Today (in Sri Lanka) is picked out in the week. Once ORA has opened (nowOpen in config.js), the badge
// also says whether it is open right now and when that changes.
const weekDays = $$('#week .week__day');
const hoursStatus = $('#hoursStatus');
function colomboNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  return { day: parts.weekday, hour: (+parts.hour % 24) + (+parts.minute) / 60 };
}
function updateHours() {
  const now = colomboNow();
  weekDays.forEach(li => {
    const today = li.dataset.day === now.day;
    li.classList.toggle('is-today', today);
    if (today) li.setAttribute('aria-current', 'date'); else li.removeAttribute('aria-current');
  });
  if (!CFG.nowOpen || !hoursStatus) return;
  const open = D.isOpenAt(now.day, now.hour);
  let label;
  if (open) label = D.allDay ? 'Open now' : `Open now · until ${fmtShort(D.closes)}`;
  else {
    const i = DAYS.indexOf(now.day);
    const laterToday = D.openDays.includes(now.day) && now.hour < D.opens;
    let ahead = laterToday ? 0 : 1;
    while (!laterToday && ahead < 7 && !D.openDays.includes(DAYS[(i + ahead) % 7])) ahead++;
    label = `Closed · opens ${laterToday ? 'today' : ahead === 1 ? 'tomorrow' : DAYS[(i + ahead) % 7]} ${fmtShort(D.opens)}`;
  }
  hoursStatus.textContent = label;
  hoursStatus.hidden = false;
  hoursStatus.classList.toggle('is-closed', !open);
}
updateHours();
setInterval(updateHours, 60000);

// Copy buttons: the value goes to the clipboard, the icon turns to a tick and a short note confirms it.
const toast = $('#toast'), toastText = $('#toastText');
let toastTimer = 0;
function showToast(message) {
  toastText.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-on');
    toastTimer = setTimeout(() => { toastText.textContent = ''; }, 600);
  }, 2400);
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch (err) { /* older browsers, or no permission */ }
  const area = el('textarea', { readonly: '', style: 'position:fixed;top:0;left:0;opacity:0' });
  area.value = value;
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (err) { /* nothing more to try */ }
  area.remove();
  return copied;
}
$$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const copied = await copyText(button.dataset.copy);
  showToast(copied ? (button.dataset.copied || 'Copied') : `Couldn’t copy. ${button.dataset.copy}`);
  if (!copied) return;
  const icon = $('use', button), was = icon && icon.getAttribute('href');
  button.classList.add('is-copied');
  if (icon) icon.setAttribute('href', '#u-check');
  setTimeout(() => { button.classList.remove('is-copied'); if (icon) icon.setAttribute('href', was); }, 1800);
}));

// The illustrated map swaps for a live Google map on request; Google's map only loads once asked for.
const place = $('#place'), placeMap = $('#placeMap'), placeLive = $('#placeLive'), mapToggle = $('#mapToggle');
if (mapToggle && mapToggle.dataset.embed) {
  mapToggle.addEventListener('click', () => {
    const live = !place.classList.contains('is-live');
    if (live && !placeLive.firstChild) {
      const frame = el('iframe', { src: mapToggle.dataset.embed, title: `Map showing ORA Space in ${D.city || 'Sri Lanka'}`, referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: '' });
      frame.addEventListener('load', () => frame.classList.add('is-loaded'), { once: true });
      placeLive.appendChild(frame);
    }
    place.classList.toggle('is-live', live);
    mapToggle.setAttribute('aria-pressed', String(live));
    $('span', mapToggle).textContent = live ? 'Illustrated map' : 'Live map';
  });
} else if (mapToggle) {
  mapToggle.hidden = true;
}

// With a mouse: a soft light follows the pointer across each tile, and the map's layers shift a little for depth.
if (finePointer && !reduced) {
  $$('.tile').forEach(tile => tile.addEventListener('pointermove', e => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
    tile.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
  }));
  if (placeMap) {
    placeMap.addEventListener('pointermove', e => {
      const r = placeMap.getBoundingClientRect();
      placeMap.style.setProperty('--px', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      placeMap.style.setProperty('--py', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    });
    placeMap.addEventListener('pointerleave', () => { placeMap.style.setProperty('--px', '0'); placeMap.style.setProperty('--py', '0'); });
  }
}

$('#year').textContent = String(new Date().getFullYear());

/* ---------------- Form ---------------- */
const form = $('#joinForm');
const fName = $('#fName'), fEmail = $('#fEmail');
const status = $('#formStatus');
const submitBtn = $('#fSubmit');
function fieldError(input, errEl, bad) {
  input.setAttribute('aria-invalid', bad ? 'true' : 'false');
  errEl.hidden = !bad;
  if (bad) input.setAttribute('aria-describedby', errEl.id); else input.removeAttribute('aria-describedby');
}
fName.addEventListener('input', () => { if (fName.getAttribute('aria-invalid') === 'true') fieldError(fName, $('#fNameErr'), !fName.value.trim()); });
fEmail.addEventListener('input', () => { if (fEmail.getAttribute('aria-invalid') === 'true') fieldError(fEmail, $('#fEmailErr'), !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail.value.trim())); });
form.addEventListener('submit', async e => {
  e.preventDefault();
  const name = fName.value.trim(), email = fEmail.value.trim();
  const badName = !name, badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  fieldError(fName, $('#fNameErr'), badName);
  fieldError(fEmail, $('#fEmailErr'), badEmail);
  if (badName || badEmail) { (badName ? fName : fEmail).focus(); return; }
  // Field names read well in the Formspree inbox; _subject and _gotcha are Formspree's own fields
  // (the email subject, and the spam trap that people leave empty).
  const data = {
    name, email,
    interests: $$('input[name="interest"]:checked', form).map(i => i.nextElementSibling.textContent).join(', ') || 'None chosen',
    note: $('#fNote').value.trim(),
    _subject: `Opening List sign-up: ${name}`,
    _gotcha: $('#fGotcha').value
  };
  submitBtn.disabled = true;
  status.classList.remove('is-error');
  status.textContent = 'Sending…';
  try {
    if (CFG.formEndpoint) await sendSignUp(data);
    else console.info('[ORA] Sign-up captured on the page only. Add formEndpoint in src/config.js to receive sign-ups.', data);
    status.textContent = '';
    $('#doneTitle').textContent = 'Thank you, ' + name.split(/\s+/)[0] + '.';
    form.classList.add('is-sent');
    const done = $('#formDone');
    done.hidden = false;
    done.focus({ preventScroll: true });
  } catch (err) {
    console.warn('[ORA] Sign-up not sent:', err.message);
    status.classList.add('is-error');
    if (err.field === 'email') {
      fieldError(fEmail, $('#fEmailErr'), true);
      fEmail.focus();
      status.textContent = 'Please check your email address and try again.';
    } else {
      status.textContent = err.name === 'AbortError'
        ? 'That took too long. Please check your connection and try again.'
        : 'We couldn’t send that just now. Please try again in a moment.';
    }
    submitBtn.disabled = false;
  }
});

// Posts a sign-up to the form service as JSON. Gives up after 15 seconds, and when the service rejects a
// field (Formspree answers with { errors: [{ field, message }] }) the error carries that field's name.
async function sendSignUp(data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(CFG.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    if (res.ok) return;
    const errors = ((await res.json().catch(() => ({}))).errors) || [];
    const err = new Error(errors.map(x => x.message).join('; ') || `HTTP ${res.status}`);
    err.field = (errors.find(x => x.field) || {}).field;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

$('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

/* ---------------- Main loop ---------------- */
const progressBar = $('#progressBar');
let lastY = -1, lastT = performance.now(), bandX = 0, bandDir = 1, vel = 0, navHidden = false, navSolid = false, upAccum = 0;
let navCurrent = null, houseP = -1;
measure();

function onScroll(y, dy) {
  const max = Math.max(1, M.docH - M.vh);
  progressBar.style.transform = `scaleX(${clamp(y / max)})`;

  // nav
  const solid = y > 40;
  if (solid !== navSolid) { navSolid = solid; nav.classList.toggle('is-solid', solid); }
  if (!menuOpen) {
    if (dy > 0) upAccum = 0; else upAccum += -dy;
    const hide = y > 260 && dy > 2;
    const show = upAccum > 40 || y < 260;
    if (hide && !navHidden) { navHidden = true; nav.classList.add('is-hidden'); }
    else if (show && navHidden) { navHidden = false; nav.classList.remove('is-hidden'); }
  }
  let current = '';
  const probe = y + M.vh * .45;
  M.sections.forEach(([id, b]) => { if (b.top <= probe && b.bottom > probe) current = id; });
  if (current !== navCurrent) { navCurrent = current; navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.nav === current)); }

  // camera
  const J = journey(y);
  if (scene) {
    scene.setTarget(J.z, J.look, J.lift, J.x);
    scene.setFocus(J.focus);
    scene.setRunning(M.join - y > 0);
  }
  if (J.room >= 0) setRoom(J.room);

  // manifesto words
  if (manifestoWords.length && !reduced && M.manifesto) {
    const top = M.manifesto.top - y;
    const p = clamp((M.vh * .88 - top) / (M.manifesto.height + M.vh * .3));
    const lit = Math.round(p * manifestoWords.length * 1.08);
    manifestoWords.forEach((w, i) => { const on = i < lit; if (w._on !== on) { w._on = on; w.classList.toggle('lit', on); } });
  }

  // house drawing
  if (houseSvg && M.houseSvg) {
    const p = reduced ? 1 : clamp((M.vh * .95 - (M.houseSvg.top - y)) / (M.vh * .8));
    if (p !== houseP) {
      houseP = p;
      const n = houseSvgPaths.length;
      houseSvgPaths.forEach((path, i) => {
        const local = clamp((p - (i / n) * .45) / .55);
        path.style.setProperty('--o', (1 - local).toFixed(3));
      });
      houseSvg.style.setProperty('--g', clamp(p * 2.2 - 1.2).toFixed(3));
    }
  }
}

function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000);
  lastT = now;
  const y = window.scrollY;
  const dy = lastY < 0 ? 0 : y - lastY;
  vel = lerp(vel, dy / Math.max(dt, .001), 1 - Math.exp(-dt * 7.5));

  if (y !== lastY || dirty) { dirty = false; onScroll(y, dy); }
  lastY = y;

  // marquee band, nudged by scroll velocity; it eases into a change of direction and rests while off screen
  if (bandTrack && !reduced && M.band && y + M.vh > M.band.top && y < M.band.bottom) {
    bandDir = lerp(bandDir, vel < -5 ? -1 : 1, 1 - Math.exp(-dt * 6));
    bandX -= (38 + Math.min(900, Math.abs(vel)) * .35) * dt * bandDir;
    const half = M.bandHalf;
    if (half > 0) { if (bandX <= -half) bandX += half; if (bandX > 0) bandX -= half; }
    const skew = clamp(vel / 300, -1, 1) * -6;
    bandTrack.style.transform = `translate3d(${bandX.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
  }

  // cursor
  if (finePointer && !reduced && pointerSeen) {
    rx = lerp(rx, px, 1 - Math.exp(-dt * 14));
    ry = lerp(ry, py, 1 - Math.exp(-dt * 14));
    dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

root.classList.add('is-ready'); // tells the fallback in index.html that the page script ran
