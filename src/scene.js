// ORA Space — the enfilade: a walk through lantern-lit heritage arches under old trees.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, Group, Mesh, Object3D,
  BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, PlaneGeometry, IcosahedronGeometry,
  SphereGeometry, ShapeGeometry, EdgesGeometry, BufferGeometry, BufferAttribute, Shape,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial, ShaderMaterial, PointsMaterial,
  SpriteMaterial, Sprite, Points, LineSegments, InstancedMesh, PointLight, HemisphereLight,
  DirectionalLight, CanvasTexture, AdditiveBlending, DoubleSide, BackSide, Vector2, Vector3,
  ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace, WebGLRenderTarget, HalfFloatType
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ARCH_SPACING = 9;
export const ARCH_HALF_WIDTH = 1.95; // centre to the outer edge of a column's plinth, so page layout can keep text clear of an arch
export const ARCHES_DEFAULT = 9; // entrance + eight rooms (main.js passes the real count)

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const wrapHour = h => ((h % 24) + 24) % 24;

// Time-of-day keyframes over the full 24 hours (hour of day → look of the garden). As near the equator all
// year round, the sun rises at 6:00, stands overhead at noon and sets at 18:00. 0 and 24 are the same night.
const NIGHT = { fog: '#06110b', top: '#030906', dens: .052, hemi: .2, sun: 0.0, sunCol: '#ffcf96', lantern: 1.15, fire: 1.0, stars: 1 };
const KEYS = [
  { h: 0, ...NIGHT },
  { h: 4.8,  fog: '#08160f', top: '#040b07', dens: .050, hemi: .22, sun: 0.0, sunCol: '#ffcf96', lantern: 1.05, fire: .7,  stars: .7 },
  { h: 6.0,  fog: '#24362a', top: '#2f4a3c', dens: .044, hemi: .55, sun: .7,  sunCol: '#ffc48a', lantern: .45,  fire: .2,  stars: .1 },
  { h: 7.5,  fog: '#33473a', top: '#536e60', dens: .040, hemi: .85, sun: 1.3, sunCol: '#ffe2b3', lantern: .18,  fire: .06, stars: 0 },
  { h: 12.0, fog: '#47634f', top: '#6f8f80', dens: .032, hemi: 1.25, sun: 2.2, sunCol: '#fff4de', lantern: 0.0, fire: 0,   stars: 0 },
  { h: 15.0, fog: '#4a5a40', top: '#667a62', dens: .034, hemi: 1.0, sun: 1.9, sunCol: '#ffe6bd', lantern: .05,  fire: 0,   stars: 0 },
  { h: 17.2, fog: '#5b4a29', top: '#3f4a3a', dens: .038, hemi: .7,  sun: 1.5, sunCol: '#ffae5e', lantern: .55,  fire: .3,  stars: 0 },
  { h: 18.2, fog: '#2c3320', top: '#1f2a20', dens: .042, hemi: .46, sun: .55, sunCol: '#ff9450', lantern: .85,  fire: .6,  stars: .12 },
  { h: 19.0, fog: '#11261b', top: '#0a1912', dens: .046, hemi: .32, sun: .15, sunCol: '#ff9a52', lantern: 1.0,  fire: .85, stars: .35 },
  { h: 21.5, ...NIGHT },
  { h: 24, ...NIGHT }
];
const KEY_COLS = KEYS.map(k => ({ fog: new Color(k.fog), top: new Color(k.top), sunCol: new Color(k.sunCol) }));

function sampleTime(h, out) {
  h = wrapHour(h);
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth(a.h, b.h, h);
  out.fog.copy(KEY_COLS[i].fog).lerp(KEY_COLS[i + 1].fog, t);
  out.top.copy(KEY_COLS[i].top).lerp(KEY_COLS[i + 1].top, t);
  out.sunCol.copy(KEY_COLS[i].sunCol).lerp(KEY_COLS[i + 1].sunCol, t);
  for (const k of ['dens', 'hemi', 'sun', 'lantern', 'fire', 'stars']) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

function glowTexture(inner = 'rgba(255,226,170,1)', mid = 'rgba(255,190,100,.35)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(.18, mid);
  grd.addColorStop(.5, 'rgba(255,170,80,.08)');
  grd.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createScene(canvas, opts = {}) {
  const reduced = !!opts.reducedMotion;
  const still = !!opts.still; // test hook: snap the camera instead of easing
  const ARCH_COUNT = opts.archCount || ARCHES_DEFAULT;
  const opensAt = opts.opensAt ?? 8, closesAt = opts.closesAt ?? 22;
  // 0 while the house is open, 1 while it is closed; the change eases over the half hour before closing
  // and before opening, so at closing time itself the lanterns have already burned low.
  const closedLength = wrapHour(opensAt - closesAt);
  const closedness = h => {
    if (!closedLength) return 0;
    const t = wrapHour(h - closesAt + .5);
    return t >= closedLength + .5 ? 0 : smooth(0, .5, t) * (1 - smooth(closedLength, closedLength + .5, t));
  };
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 4) <= 4;
  const useBloom = !small;

  // Check support on a throwaway canvas first so unsupported browsers fall back quietly (three.js needs WebGL 2)
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return null;
    const lose = probe.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { return null; }

  let renderer;
  try {
    // With bloom, edges are smoothed by the multisampled render target below instead of the canvas.
    renderer = new WebGLRenderer({ canvas, antialias: !useBloom, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;

  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const state = sampleTime(19, { fog: new Color(), top: new Color(), sunCol: new Color() });
  scene.background = state.fog.clone();
  scene.fog = new FogExp2(state.fog.clone(), state.dens);

  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new PerspectiveCamera(48, 1, 0.1, 420);
  camera.position.set(0, 1.6, 22);

  // ---------- Materials ----------
  const gold = new MeshStandardMaterial({ color: 0xcfa95b, metalness: 1, roughness: .3, envMapIntensity: .55 });
  const goldSoft = new MeshStandardMaterial({ color: 0xb8924a, metalness: .9, roughness: .45, envMapIntensity: .4 });
  const groundMat = new MeshStandardMaterial({ color: 0x0b2216, roughness: .95, metalness: 0, envMapIntensity: .12 });
  const pathMat = new MeshStandardMaterial({ color: 0x1a3527, roughness: .62, metalness: .15, envMapIntensity: .25 });
  const trunkMat = new MeshStandardMaterial({ color: 0x1b1a12, roughness: 1, metalness: 0, envMapIntensity: .05 });
  const canopyMat = new MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0, envMapIntensity: .08 });

  // ---------- Ground ----------
  const ground = new Mesh(new PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -40;
  scene.add(ground);

  const pathLen = ARCH_SPACING * (ARCH_COUNT + 3);
  const path = new Mesh(new PlaneGeometry(2.6, pathLen), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, .004, -pathLen / 2 + 14);
  scene.add(path);
  const inlayGeo = new BoxGeometry(.035, .012, pathLen);
  for (const s of [-1, 1]) {
    const inlay = new Mesh(inlayGeo, gold);
    inlay.position.set(s * 1.36, .008, path.position.z);
    scene.add(inlay);
  }
  // stone joints across the path
  const jointGeo = new BoxGeometry(2.6, .01, .025);
  const jointMat = new MeshBasicMaterial({ color: 0x0c1f15 });
  const joints = new InstancedMesh(jointGeo, jointMat, Math.floor(pathLen / 1.3));
  const dummy = new Object3D();
  for (let i = 0; i < joints.count; i++) {
    dummy.position.set(0, .01, 14 - i * 1.3);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    joints.setMatrixAt(i, dummy.matrix);
  }
  scene.add(joints);

  // ---------- Arches & lanterns ----------
  const W = 1.65, H = 2.7;
  const geo = {
    plinth: new BoxGeometry(.6, .22, .6),
    base: new BoxGeometry(.48, .1, .48),
    shaft: new CylinderGeometry(.145, .17, H - .66, 24),
    capital: new CylinderGeometry(.25, .155, .17, 24),
    abacus: new BoxGeometry(.56, .09, .56),
    arch: new TorusGeometry(W, .085, 16, 72, Math.PI),
    archInner: new TorusGeometry(W - .2, .028, 8, 72, Math.PI),
    archOuter: new TorusGeometry(W + .17, .022, 8, 72, Math.PI),
    key: new BoxGeometry(.15, .26, .2),
    chain: new CylinderGeometry(.01, .01, .5, 6),
    cap: new ConeGeometry(.17, .17, 6),
    capRing: new CylinderGeometry(.155, .155, .03, 6),
    glass: new CylinderGeometry(.125, .1, .34, 6),
    bottom: new ConeGeometry(.1, .1, 6),
    finial: new SphereGeometry(.03, 8, 8)
  };
  const frameGeo = new EdgesGeometry(new CylinderGeometry(.132, .106, .34, 6));
  const frameMat = new LineBasicMaterial({ color: 0xcfa95b });
  const glowTex = glowTexture();
  const floorTex = glowTexture('rgba(255,210,140,.9)', 'rgba(255,180,90,.25)');

  const lanterns = [];
  const arches = [];
  for (let i = 0; i < ARCH_COUNT; i++) {
    const g = new Group();
    g.position.z = -i * ARCH_SPACING;
    for (const s of [-1, 1]) {
      const x = s * W;
      const parts = [
        [geo.plinth, .11], [geo.base, .27], [geo.shaft, .32 + (H - .66) / 2], [geo.capital, H - .2], [geo.abacus, H - .07]
      ];
      for (const [gg, y] of parts) {
        const m = new Mesh(gg, gold);
        m.position.set(x, y, 0);
        g.add(m);
      }
    }
    const arch = new Mesh(geo.arch, gold); arch.position.y = H - .02; g.add(arch);
    const ai = new Mesh(geo.archInner, goldSoft); ai.position.y = H - .02; g.add(ai);
    const ao = new Mesh(geo.archOuter, goldSoft); ao.position.y = H - .02; g.add(ao);
    const key = new Mesh(geo.key, goldSoft); key.position.y = H + W + .02; g.add(key);

    // Lantern, hung from the keystone
    const hang = new Group();
    hang.position.set(0, H + W - .08, 0);
    const chain = new Mesh(geo.chain, goldSoft); chain.position.y = -.25; hang.add(chain);
    const fin = new Mesh(geo.finial, gold); fin.position.y = -.52; hang.add(fin);
    const cap = new Mesh(geo.cap, gold); cap.position.y = -.62; hang.add(cap);
    const ring = new Mesh(geo.capRing, gold); ring.position.y = -.71; hang.add(ring);
    const glassMat = new MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .92 });
    const glass = new Mesh(geo.glass, glassMat); glass.position.y = -.9; hang.add(glass);
    const frame = new LineSegments(frameGeo, frameMat); frame.position.y = -.9; hang.add(frame);
    const bottom = new Mesh(geo.bottom, gold); bottom.position.y = -1.12; bottom.rotation.x = Math.PI; hang.add(bottom);
    const halo = new Sprite(new SpriteMaterial({ map: glowTex, color: 0xffb04a, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    halo.position.y = -.9; halo.scale.setScalar(2.1); hang.add(halo);
    g.add(hang);

    const pool = new Mesh(new PlaneGeometry(3.6, 3.6), new MeshBasicMaterial({ map: floorTex, color: 0xffb862, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = .02;
    g.add(pool);

    scene.add(g);
    arches.push(g);
    lanterns.push({ hang, glassMat, halo, pool, z: g.position.z, ignite: reduced ? 1 : 0, focus: 0, phase: i * 1.37 });
  }

  // ---------- Trees ----------
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const TREE_N = small ? 46 : 74;
  const trunkGeo = new CylinderGeometry(.16, .32, 1, 7);
  trunkGeo.translate(0, .5, 0);
  // lumpy, organic canopy: icosphere pushed out by smooth pseudo-noise
  let canopyGeo = new IcosahedronGeometry(1, 3);
  canopyGeo.deleteAttribute('normal'); canopyGeo.deleteAttribute('uv');
  canopyGeo = mergeVertices(canopyGeo);
  {
    const pos = canopyGeo.attributes.position, v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 3.1 + Math.sin(v.y * 4.3)) * Math.sin(v.y * 3.7 + Math.sin(v.z * 2.9)) * Math.sin(v.z * 3.3 + Math.sin(v.x * 2.3));
      const n2 = Math.sin(v.x * 7.3 + v.z * 5.1) * Math.sin(v.y * 6.7 - v.x * 3.9) * .35;
      v.multiplyScalar(1 + n * .17 + n2 * .07);
      pos.setXYZ(i, v.x, v.y * .86, v.z);
    }
    canopyGeo.computeVertexNormals();
  }
  const trunks = new InstancedMesh(trunkGeo, trunkMat, TREE_N);
  const canopies = new InstancedMesh(canopyGeo, canopyMat, TREE_N * 3);
  const greens = ['#0c2c1d', '#0f3222', '#0a2418', '#123826', '#153d29'].map(c => new Color(c));
  let ci = 0;
  for (let i = 0; i < TREE_N; i++) {
    const side = i % 2 ? 1 : -1;
    const beyond = i > TREE_N * .82; // a few distant trees around the open garden
    const x = side * (beyond ? 15 + rng() * 14 : 4.2 + rng() * 11);
    const corridor = ARCH_SPACING * (ARCH_COUNT - 1);
    const z = beyond ? -(corridor + 12) - rng() * 40 : 16 - (i / (TREE_N * .82)) * (corridor + 20) + (rng() - .5) * 6;
    const h = 3.2 + rng() * 3.2;
    dummy.position.set(x, 0, z); dummy.rotation.set(0, rng() * 6, (rng() - .5) * .12); dummy.scale.set(1 + rng() * .5, h, 1 + rng() * .5);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      const r = 1.4 + rng() * 1.6;
      dummy.position.set(x + (rng() - .5) * 2.2, h + (rng() - .2) * 1.6, z + (rng() - .5) * 2.2);
      dummy.rotation.set(rng() * 3, rng() * 3, 0);
      dummy.scale.set(r * 1.15, r * .82, r);
      dummy.updateMatrix(); canopies.setMatrixAt(ci, dummy.matrix);
      canopies.setColorAt(ci, greens[Math.floor(rng() * greens.length)]);
      ci++;
    }
  }
  scene.add(trunks, canopies);

  // The grand old tree, waiting in the garden beyond the last arch
  const grand = new Group();
  const gTrunk = new Mesh(new CylinderGeometry(.55, 1.25, 8, 10), trunkMat);
  gTrunk.position.y = 4; grand.add(gTrunk);
  for (const [bx, by, bz, rz] of [[-1.6, 6.2, 0, .55], [1.7, 6.6, .3, -.5], [.2, 7.2, -.8, .1]]) {
    const b = new Mesh(new CylinderGeometry(.18, .42, 4.2, 7), trunkMat);
    b.position.set(bx, by, bz); b.rotation.z = rz; grand.add(b);
  }
  const grandMat = new MeshStandardMaterial({ color: 0x0f3222, roughness: .95, envMapIntensity: .08 });
  for (const [cx, cy, cz, r] of [[0, 10.5, 0, 4.6], [-4.2, 9.2, .8, 3.6], [4.4, 9.6, -.6, 3.8], [-1.8, 12.6, -1, 3.4], [2.4, 12.4, 1.2, 3.2], [-6.4, 8, -1, 2.4], [6.6, 8.4, .5, 2.6]]) {
    const c = new Mesh(canopyGeo, grandMat);
    c.position.set(cx, cy, cz); c.scale.set(r * 1.15, r * .9, r); c.rotation.set(cx, cy, cz);
    grand.add(c);
  }
  grand.position.set(-12, 0, -ARCH_SPACING * (ARCH_COUNT - 1) - 36);
  grand.rotation.y = -.5;
  grand.scale.setScalar(1.15);
  scene.add(grand);

  // ---------- Sky dome, sun, moon, stars ----------
  const skyMat = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTop: { value: state.top.clone() }, uHorizon: { value: state.fog.clone() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vP; void main(){ float t = smoothstep(0.02, 0.55, vP.y); gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.);\n#include <colorspace_fragment>\n}'
  });
  const sky = new Mesh(new SphereGeometry(300, 32, 16), skyMat);
  scene.add(sky);

  const sun = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,214,150,.55)'), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  sun.scale.setScalar(60);
  scene.add(sun);
  const moon = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(250,246,230,1)', 'rgba(220,226,210,.22)'), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  moon.scale.setScalar(26);
  scene.add(moon);

  const STAR_N = 900;
  const starPos = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    const th = rng() * Math.PI * 2, ph = Math.acos(rng() * .85 + .12);
    starPos[i * 3] = Math.sin(ph) * Math.cos(th) * 260;
    starPos[i * 3 + 1] = Math.cos(ph) * 260;
    starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 260;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new BufferAttribute(starPos, 3));
  const starMat = new PointsMaterial({ color: 0xf4eedd, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new Points(starGeo, starMat);
  scene.add(stars);

  // ---------- Fireflies ----------
  const FLY_N = small ? 260 : 620;
  const fp = new Float32Array(FLY_N * 3), fPhase = new Float32Array(FLY_N), fSpeed = new Float32Array(FLY_N);
  for (let i = 0; i < FLY_N; i++) {
    fp[i * 3] = (rng() - .5) * 18;
    fp[i * 3 + 1] = .25 + Math.pow(rng(), 1.6) * 5.5;
    fp[i * 3 + 2] = 18 - rng() * (ARCH_SPACING * (ARCH_COUNT - 1) + 36);
    fPhase[i] = rng() * 6.28; fSpeed[i] = .35 + rng() * .9;
  }
  const flyGeo = new BufferGeometry();
  flyGeo.setAttribute('position', new BufferAttribute(fp, 3));
  flyGeo.setAttribute('aPhase', new BufferAttribute(fPhase, 1));
  flyGeo.setAttribute('aSpeed', new BufferAttribute(fSpeed, 1));
  const flyMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uSize: { value: small ? 34 : 42 }, uPR: { value: dpr }, uColor: { value: new Color(1.0, .78, .42) }, uI: { value: state.fire } },
    vertexShader: `uniform float uTime; uniform float uSize; uniform float uPR; attribute float aPhase; attribute float aSpeed; varying float vTw; varying float vD;
      void main(){ vec3 p = position; float t = uTime * aSpeed;
        p.x += sin(t + aPhase) * .45; p.y += sin(t * .7 + aPhase * 1.7) * .32; p.z += cos(t * .5 + aPhase) * .45;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPR / max(1., -mv.z);
        vTw = pow(.5 + .5 * sin(uTime * 2.2 * aSpeed + aPhase * 3.), 2.); vD = -mv.z; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vTw; varying float vD;
      void main(){ float d = length(gl_PointCoord - .5); float a = pow(smoothstep(.5, 0., d), 2.2);
        gl_FragColor = vec4(uColor, a * (.25 + .75 * vTw) * uI * exp(-vD * .03) * smoothstep(.4, 1.8, vD));
#include <colorspace_fragment>
      }`
  });
  const flies = new Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  scene.add(flies);

  // ---------- Falling leaves ----------
  const leafShape = new Shape();
  leafShape.moveTo(0, -.5);
  leafShape.bezierCurveTo(.42, -.2, .38, .3, 0, .55);
  leafShape.bezierCurveTo(-.38, .3, -.42, -.2, 0, -.5);
  const leafGeo = new ShapeGeometry(leafShape, 6);
  const leafMat = new MeshStandardMaterial({ color: 0xc9a456, metalness: .55, roughness: .45, side: DoubleSide, envMapIntensity: .5 });
  const LEAF_N = small ? 34 : 70;
  const leaves = new InstancedMesh(leafGeo, leafMat, LEAF_N);
  leaves.frustumCulled = false;
  const leafData = [];
  for (let i = 0; i < LEAF_N; i++) {
    leafData.push({ x: (rng() - .5) * 12, y: rng() * 7, dz: -rng() * 32 + 4, v: .22 + rng() * .35, s: .07 + rng() * .08, ph: rng() * 6.28, rs: .4 + rng() * 1.2 });
  }
  scene.add(leaves);

  // ---------- Lights ----------
  const hemi = new HemisphereLight(0x6f9a82, 0x0a1a10, state.hemi);
  scene.add(hemi);
  const sunLight = new DirectionalLight(0xffe6c0, 0);
  sunLight.position.set(-20, 30, -30);
  scene.add(sunLight);
  scene.add(sunLight.target);
  const lanternLights = [0, 1, 2].map(() => { const l = new PointLight(0xffb86a, 0, 13, 1.6); scene.add(l); return l; });
  const cursorLight = new PointLight(0xffcf8a, 0, 8, 1.7);
  scene.add(cursorLight);

  // ---------- Post ----------
  let composer = null, bloom = null;
  if (useBloom) {
    composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(512, 512), .8, .5, .7);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- Runtime state ----------
  const target = { z: 22, lookY: 2.2, lift: 0, x: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  let hour = 19, hourTarget = 19;
  let focus = -1;
  let running = true, visible = !document.hidden, ready = false, raf = 0, last = performance.now(), time = 0;
  let intro = (reduced || still) ? 1 : 0, introPlaying = false;
  const lookAt = new Vector3(0, 2.2, 0);
  const tmp = new Vector3();
  let width = 0, height = 0;

  const draw = () => { if (composer) composer.render(); else renderer.render(scene, camera); };

  // The canvas is sized to the large viewport in CSS, so mobile toolbars sliding in and out don't resize it.
  function resize(force = false) {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (!force && w === width && h === height) return;
    width = w; height = h;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < .6 ? 66 : aspect < 1 ? 58 : 48;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
    if (ready && !raf) draw(); // resizing clears the canvas, so repaint even while paused
  }
  resize();

  // Compile every shader before the first frame (in parallel where the browser supports it), so nothing
  // compiles mid-scroll when the far end of the garden comes into view.
  const whenReady = new Promise(resolve => {
    setTimeout(resolve, 3000);
    try {
      renderer.setRenderTarget(composer ? composer.readBuffer : null);
      const compiling = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(null);
      compiling.then(resolve, resolve);
    } catch (e) {
      renderer.setRenderTarget(null);
      resolve();
    }
  }).then(() => { ready = true; kick(); });

  function updateTime(dt) {
    // ease toward the chosen hour the short way round the clock, so 11 pm to 1 am passes through midnight
    let gap = hourTarget - hour;
    gap -= Math.round(gap / 24) * 24;
    hour = wrapHour(hour + gap * (still ? 1 : 1 - Math.exp(-dt * (reduced ? 20 : 2.6))));
    sampleTime(hour, state);
    state.lantern *= 1 - .6 * closedness(hour);
    scene.background.copy(state.fog);
    scene.fog.color.copy(state.fog);
    scene.fog.density = state.dens;
    skyMat.uniforms.uTop.value.copy(state.top);
    skyMat.uniforms.uHorizon.value.copy(state.fog);
    hemi.intensity = state.hemi;
    sunLight.intensity = state.sun;
    sunLight.color.copy(state.sunCol);
    flyMat.uniforms.uI.value = state.fire;
    starMat.opacity = state.stars * .9;
    // the sun's arc, matching the day clock: 6:00 on the left horizon, noon straight overhead,
    // 18:00 on the right horizon, and below the horizon through the night
    const a = (hour - 6) / 12 * Math.PI;
    const cz = camera.position.z - 150;
    sun.position.set(-Math.cos(a) * 85, Math.sin(a) * 66 + 22, cz);
    sun.material.color.copy(state.sunCol);
    sun.material.opacity = smooth(5.7, 6.5, hour) * (1 - smooth(17.7, 18.5, hour));
    moon.position.set(34, 46, cz);
    moon.material.opacity = (hour >= 12 ? smooth(18.6, 19.8, hour) : 1 - smooth(4.8, 5.9, hour)) * .85;
    sunLight.position.set(sun.position.x * .4, Math.max(4, sun.position.y * .6), camera.position.z - 40);
    sunLight.target.position.set(0, 0, camera.position.z - 10);
  }

  // Adaptive quality: if frames run slow, drop the bloom glow first, then resolution.
  // Bloom is switched off rather than removed: rendering straight to the screen would recompile every shader.
  function degrade() {
    if (bloom && bloom.enabled) { bloom.enabled = false; return true; }
    if (dpr > .8) {
      dpr = Math.max(.75, dpr - .25);
      renderer.setPixelRatio(dpr);
      if (composer) composer.setPixelRatio(dpr);
      flyMat.uniforms.uPR.value = dpr;
      resize(true);
      return true;
    }
    return false;
  }
  // Judge speed over windows of about a second, skipping warm-up frames and one-off stalls (GC, uploads),
  // and step down only when slowness lasts, or right away when the scene is badly struggling.
  let perfN = 0, perfSum = 0, perfSkip = 40, slowRuns = 0;
  function watchPerf(raw) {
    if (raw > .25) return;
    if (perfSkip > 0) { perfSkip--; return; }
    perfSum += raw; perfN++;
    if (perfN < 60 && !(perfN >= 8 && perfSum > 1)) return;
    const avg = perfSum / perfN;
    perfN = 0; perfSum = 0;
    slowRuns = avg > 1 / 28 ? slowRuns + 1 : 0;
    if ((slowRuns >= 2 || avg > 1 / 12) && degrade()) { slowRuns = 0; perfSkip = 30; }
  }
  function frame(now) {
    raf = 0;
    if (!running || !visible) return;
    const raw = (now - last) / 1000;
    const dt = Math.min(.05, raw);
    last = now;
    watchPerf(raw);
    time += reduced ? 0 : dt;

    if (introPlaying) {
      intro = Math.min(1, intro + dt / 3.2);
      if (intro >= 1) introPlaying = false;
    }
    const introEase = 1 - Math.pow(1 - intro, 3);

    // camera follows scroll target with damping
    const k = still ? 1 : 1 - Math.exp(-dt * (reduced ? 30 : 3.4));
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 4));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 4));
    const sway = reduced ? 0 : Math.sin(time * .25) * .06;
    const z = target.z + (1 - introEase) * 14;
    camera.position.z += (z - camera.position.z) * k;
    camera.position.x += ((target.x + pointer.x * .55 + sway) - camera.position.x) * k;
    camera.position.y += ((1.62 + target.lift * .6 - pointer.y * .22) - camera.position.y) * k;
    tmp.set(target.x + pointer.x * .25, target.lookY + target.lift * 2.4 - pointer.y * .3, camera.position.z - 10);
    lookAt.lerp(tmp, k);
    camera.lookAt(lookAt);

    updateTime(dt);

    // lanterns: ignite, swing, glow
    const camZ = camera.position.z;
    const slotBest = [null, null, null];
    for (let i = 0; i < lanterns.length; i++) {
      const L = lanterns[i];
      if (!reduced) L.ignite = clamp(intro * 2.1 - i * .12);
      L.focus += ((i === focus ? 1 : 0) - L.focus) * (1 - Math.exp(-dt * 3));
      const flicker = reduced ? 1 : .93 + Math.sin(time * 9 + L.phase) * .03 + Math.sin(time * 23.7 + L.phase * 2) * .02;
      const I = state.lantern * L.ignite * flicker * (1 + L.focus * .45);
      L.hang.rotation.z = reduced ? 0 : Math.sin(time * .9 + L.phase) * .035;
      L.hang.rotation.x = reduced ? 0 : Math.sin(time * .7 + L.phase * 1.3) * .02;
      const d = Math.abs(camZ - L.z);
      const c = Math.min(1, I); L.glassMat.color.setRGB(.2 + .8 * c, .14 + .3 * c, .08 + .04 * c);
      L.halo.material.opacity = Math.min(1, I) * (.7 + .3 * Math.exp(-d * .02));
      L.halo.scale.setScalar(1.8 + I * 1.4);
      L.pool.material.opacity = Math.min(1, I) * .42 * Math.exp(-d * .035);
      // assign to one of three light slots (lantern i uses slot i % 3, the nearest such lantern wins)
      const s = i % 3;
      if (!slotBest[s] || Math.abs(camZ - 3 - L.z) < Math.abs(camZ - 3 - slotBest[s].L.z)) slotBest[s] = { L, I };
    }
    for (let s = 0; s < 3; s++) {
      const b = slotBest[s];
      const light = lanternLights[s];
      if (!b) { light.intensity = 0; continue; }
      const d = Math.abs(camZ - 3 - b.L.z);
      const w = 1 - smooth(7, 13.5, d);
      light.position.set(0, b.L.hang.position.y - .9, b.L.z);
      light.intensity = b.I * w * 9;
    }

    // cursor lantern
    if (pointer.active) {
      tmp.set(pointer.tx, -pointer.ty, .5).unproject(camera).sub(camera.position).normalize();
      cursorLight.position.copy(camera.position).addScaledVector(tmp, 3.6);
      cursorLight.intensity += ((2.8 * (.35 + state.lantern * .65)) - cursorLight.intensity) * .08;
    } else {
      cursorLight.intensity *= .92;
    }

    // fireflies, leaves, sky follow camera
    flyMat.uniforms.uTime.value = time;
    sky.position.copy(camera.position);
    stars.position.set(camera.position.x, 0, camera.position.z);
    for (let i = 0; i < LEAF_N; i++) {
      const p = leafData[i];
      if (!reduced) {
        p.y -= p.v * dt;
        if (p.y < 0) { p.y = 6.5 + rng(); p.x = (rng() - .5) * 12; }
      }
      let lz = camZ + p.dz;
      dummy.position.set(p.x + Math.sin(time * .8 + p.ph) * .6, p.y, lz);
      dummy.rotation.set(time * p.rs + p.ph, time * p.rs * .7, Math.sin(time + p.ph) * .8);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;

    draw();
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && ready && running && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  document.addEventListener('visibilitychange', () => { visible = !document.hidden; kick(); });

  return {
    ready: whenReady,
    resize,
    setTarget(z, lookY, lift, x = 0) { target.z = z; target.lookY = lookY; target.lift = lift; target.x = x; },
    setPointer(x, y, active) { pointer.tx = x; pointer.ty = y; pointer.active = active; },
    setHour(h) { hourTarget = wrapHour(h); kick(); },
    setFocus(i) { focus = i; },
    setRunning(r) { if (r === running) return; running = r; kick(); },
    playIntro() { if (reduced || still) return; intro = 0; introPlaying = true; kick(); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    get bloom() { return !!(bloom && bloom.enabled); }
  };
}
