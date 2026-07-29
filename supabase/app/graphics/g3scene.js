import * as THREE from './three.module.js?v=8f45f37';

const COLORS = { x: 0xdc2626, y: 0x059669, z: 0x2563eb, object: 0x2563eb };

function vector(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) && value.length === 3 ? value : fallback;
  return new THREE.Vector3(Number(source[0]) || 0, Number(source[1]) || 0, Number(source[2]) || 0);
}

function color(value, fallback = COLORS.object) {
  try { return new THREE.Color(value || fallback); } catch (_) { return new THREE.Color(fallback); }
}

function styleOf(object) {
  const style = object.attributes || object.style || {};
  return { color: color(style.color || style.strokeColor || style.stroke), opacity: Number(style.opacity ?? style.fillOpacity ?? 1) };
}

function addLabel(scene, text, position) {
  if (!text) return;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = '600 28px system-ui';
  const width = Math.ceil(context.measureText(String(text)).width) + 16;
  canvas.width = width; canvas.height = 42;
  context.font = '600 28px system-ui';
  context.fillStyle = '#111827'; context.fillText(String(text), 8, 30);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.position.copy(position); sprite.position.y += 0.18; sprite.scale.set(width / 60, 0.7, 1);
  scene.add(sprite);
}

function addAxes(scene, size) {
  const origin = new THREE.Vector3(0, 0, 0);
  scene.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, size, COLORS.x, 0.22, 0.12));
  scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, size, COLORS.y, 0.22, 0.12));
  scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, size, COLORS.z, 0.22, 0.12));
  addLabel(scene, 'x', new THREE.Vector3(size + .2, 0, 0));
  addLabel(scene, 'y', new THREE.Vector3(0, size + .2, 0));
  addLabel(scene, 'z', new THREE.Vector3(0, 0, size + .2));
}

function addSegment(scene, from, to, style) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: style.color, transparent: style.opacity < 1, opacity: style.opacity })));
}

function addFace(scene, points, style) {
  if (points.length < 3) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const indices = [];
  for (let index = 1; index < points.length - 1; index++) indices.push(0, index, index + 1);
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: style.color, transparent: true, opacity: Math.min(style.opacity, .65), side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(geometry, material));
  for (let index = 0; index < points.length; index++) addSegment(scene, points[index], points[(index + 1) % points.length], { color: style.color, opacity: 1 });
}

function createObject(scene, object) {
  const type = String(object.type || '').toLowerCase();
  const style = styleOf(object);
  if (type === 'point') {
    const position = vector(object.position || object.coords);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(Number(object.radius) || .09, 20, 14), new THREE.MeshStandardMaterial({ color: style.color }));
    mesh.position.copy(position); scene.add(mesh); addLabel(scene, object.name || object.label, position);
  } else if (type === 'segment' || type === 'line') {
    const from = vector(object.from || (object.through && object.through[0])), to = vector(object.to || (object.through && object.through[1]));
    addSegment(scene, from, to, style);
  } else if (type === 'polyline') {
    const points = Array.isArray(object.points) ? object.points.map(point => vector(point)) : [];
    for (let index = 1; index < points.length; index++) addSegment(scene, points[index - 1], points[index], style);
  } else if (type === 'face' || type === 'polygon') {
    addFace(scene, (object.points || []).map(point => vector(point)), style);
  } else if (type === 'box') {
    const size = Array.isArray(object.size) ? object.size : [1, 1, 1];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Number(size[0]) || 1, Number(size[1]) || 1, Number(size[2]) || 1), new THREE.MeshStandardMaterial({ color: style.color, transparent: style.opacity < 1, opacity: style.opacity }));
    mesh.position.copy(vector(object.center || object.position)); scene.add(mesh);
  } else if (type === 'sphere') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(Number(object.radius) || 1, 32, 20), new THREE.MeshStandardMaterial({ color: style.color, transparent: style.opacity < 1, opacity: style.opacity }));
    mesh.position.copy(vector(object.center || object.position)); scene.add(mesh);
  } else if (type === 'cylinder' || type === 'cone') {
    const radius = Number(object.radius) || 1, height = Number(object.height) || 2;
    const geometry = type === 'cone' ? new THREE.ConeGeometry(radius, height, 32) : new THREE.CylinderGeometry(radius, radius, height, 32);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: style.color, transparent: style.opacity < 1, opacity: style.opacity }));
    mesh.position.copy(vector(object.center || object.position)); scene.add(mesh);
  }
}

export function validateThree3dPayload(payload) {
  const errors = [];
  if (!payload || String(payload.engine || '').toLowerCase() !== 'three3d') errors.push({ code: 'THREE3D_ENGINE_REQUIRED', path: 'engine', message: 'Expected engine: "three3d".' });
  if (!payload || !Array.isArray(payload.objects) || !payload.objects.length) errors.push({ code: 'THREE3D_OBJECTS_REQUIRED', path: 'objects', message: 'objects must contain at least one 3D object.' });
  if (payload && Array.isArray(payload.objects)) payload.objects.forEach((object, index) => { if (!object || !object.type) errors.push({ code: 'THREE3D_OBJECT_TYPE_REQUIRED', path: 'objects[' + index + '].type', message: 'Each 3D object needs a type.' }); });
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function mountThree3d(host, payload) {
  const config = payload.scene || {};
  host.innerHTML = '<div class="gongboo-three-host"></div>';
  const target = host.firstElementChild;
  const width = Math.max(360, Math.round(host.getBoundingClientRect().width || 600));
  const height = Math.max(360, Math.round(width * .72));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height); renderer.setClearColor(0xffffff, 1); target.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width / height, .1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(6, 9, 7); scene.add(light);
  const axisLength = Number(config.axisLength) || 4;
  if (config.axes !== false) addAxes(scene, axisLength);
  if (config.grid !== false) { const grid = new THREE.GridHelper(axisLength * 2, axisLength * 2, 0xcbd5e1, 0xe2e8f0); scene.add(grid); }
  (payload.objects || []).forEach(object => createObject(scene, object));
  let azimuth = .72, elevation = .55, distance = Number(config.cameraDistance) || axisLength * 2.5;
  const render = () => { camera.position.set(distance * Math.cos(elevation) * Math.cos(azimuth), distance * Math.sin(elevation), distance * Math.cos(elevation) * Math.sin(azimuth)); camera.lookAt(0, 0, 0); renderer.render(scene, camera); };
  let dragging = false, previous = null;
  renderer.domElement.addEventListener('pointerdown', event => { dragging = true; previous = [event.clientX, event.clientY]; renderer.domElement.setPointerCapture(event.pointerId); });
  renderer.domElement.addEventListener('pointermove', event => { if (!dragging || !previous) return; azimuth += (event.clientX - previous[0]) * .012; elevation = Math.max(-1.35, Math.min(1.35, elevation - (event.clientY - previous[1]) * .012)); previous = [event.clientX, event.clientY]; render(); });
  renderer.domElement.addEventListener('pointerup', () => { dragging = false; previous = null; });
  renderer.domElement.addEventListener('wheel', event => { event.preventDefault(); distance = Math.max(2, Math.min(50, distance * (event.deltaY > 0 ? 1.12 : .89))); render(); }, { passive: false });
  render();
  return true;
}
