/* ═══════════════════════════════════════════════
   STAGE
   Renderer, scene, camera, lighting, orbit controls,
   floor grid and shadow plane. The static three.js setup.
═══════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp } from './utils.js';

/* ── canvas window ── */
export const cv = document.getElementById('cv');
const wrap = document.getElementById('canvas-wrap');
export const W = () => wrap.clientWidth;
export const H = () => wrap.clientHeight;

/* ── renderer ── */
export const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.setClearColor(0xf8f8f6, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
export const clock = new THREE.Clock();

/* ── lighting: hemisphere fill + warm key + soft cool rim ──
   Students orbit all the way around the model, so the back must read as well
   as the front. A hemisphere fill keeps every angle modeled, and the rim is a
   soft cool white rather than saturated blue (which used to tint the whole
   back side purple). */
scene.add(new THREE.AmbientLight(0xffffff, 0.3));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.45));

const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xdde4ff, 0.55);
rimLight.position.set(-4, 2, -6);
scene.add(rimLight);

/* ── camera: starts slightly above floor looking up at character ── */
export const camera = new THREE.PerspectiveCamera(44, W() / H(), 0.01, 200);
camera.up.set(0, 1, 0);
camera.position.set(0, 2.5, 7);
camera.lookAt(0, 1, 0);

/* ── orbit controls ── */
export const orbitCtrl = new OrbitControls(camera, cv);
orbitCtrl.enableDamping = true;
orbitCtrl.dampingFactor = 0.08;
orbitCtrl.enablePan = true;
orbitCtrl.minDistance = 3;
orbitCtrl.maxDistance = 14;
orbitCtrl.minPolarAngle = 0.2;                  // can't go below floor
orbitCtrl.maxPolarAngle = Math.PI * 0.55;       // can't go fully overhead
orbitCtrl.enabled = false;
orbitCtrl.target.set(0, 1, 0);

orbitCtrl.addEventListener('change', () => {
    orbitCtrl.target.x = clamp(orbitCtrl.target.x, -10, 10);
    orbitCtrl.target.y = clamp(orbitCtrl.target.y, 0, 5);
    orbitCtrl.target.z = clamp(orbitCtrl.target.z, -10, 10);
});

/* ── floor grid & shadow plane: ground the character visually ── */
const gridHelper = new THREE.GridHelper(20, 20, 0x000000, 0x000000);
gridHelper.material.opacity = 0.1;
gridHelper.material.transparent = true;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
