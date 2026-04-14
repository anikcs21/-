/**
 * body3d.js — 3D интерактивная модель тела на Three.js
 * Клик по части тела выбирает pain_area
 */

(function () {
  const container = document.getElementById('body3d-canvas');
  if (!container) return;

  const W = 280, H = 420;
  container.style.width = W + 'px';
  container.style.height = H + 'px';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 6, 5);
  scene.add(dirLight);

  // Materials
  const skinMat = new THREE.MeshPhongMaterial({ color: 0xf5c5a3, shininess: 30 });
  const skinMatHover = new THREE.MeshPhongMaterial({ color: 0x22c55e, shininess: 50 });
  const selectedMat = new THREE.MeshPhongMaterial({ color: 0x16a34a, shininess: 60, emissive: 0x052e16, emissiveIntensity: 0.15 });

  // Body parts: [name, geometry, x, y, z, area_key]
  const bodyParts = [
    // Head
    { key: 'head', label: 'Голова', mesh: new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), skinMat.clone()), x: 0, y: 2.9, z: 0 },
    // Neck
    { key: 'neck', label: 'Шея', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.35, 20), skinMat.clone()), x: 0, y: 2.2, z: 0 },
    // Torso upper (chest)
    { key: 'chest', label: 'Грудная клетка', mesh: new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.5, 4, 4, 2), skinMat.clone()), x: 0, y: 1.55, z: 0 },
    // Torso lower (abdomen)
    { key: 'abdomen', label: 'Живот', mesh: new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.48, 4, 4, 2), skinMat.clone()), x: 0, y: 0.82, z: 0 },
    // Pelvis
    { key: 'pelvis', label: 'Таз', mesh: new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.46), skinMat.clone()), x: 0, y: 0.3, z: 0 },
    // Left arm (upper)
    { key: 'left_arm', label: 'Левая рука', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 1.1, 16), skinMat.clone()), x: -0.84, y: 1.35, z: 0 },
    // Left arm (lower)
    { key: 'left_arm', label: 'Левая рука', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.9, 16), skinMat.clone()), x: -0.9, y: 0.3, z: 0 },
    // Right arm (upper)
    { key: 'right_arm', label: 'Правая рука', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 1.1, 16), skinMat.clone()), x: 0.84, y: 1.35, z: 0 },
    // Right arm (lower)
    { key: 'right_arm', label: 'Правая рука', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.9, 16), skinMat.clone()), x: 0.9, y: 0.3, z: 0 },
    // Left leg (upper)
    { key: 'left_leg', label: 'Левая нога', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.1, 16), skinMat.clone()), x: -0.3, y: -0.7, z: 0 },
    // Left leg (lower)
    { key: 'left_leg', label: 'Левая нога', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.0, 16), skinMat.clone()), x: -0.3, y: -1.85, z: 0 },
    // Right leg (upper)
    { key: 'right_leg', label: 'Правая нога', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.1, 16), skinMat.clone()), x: 0.3, y: -0.7, z: 0 },
    // Right leg (lower)
    { key: 'right_leg', label: 'Правая нога', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.0, 16), skinMat.clone()), x: 0.3, y: -1.85, z: 0 },
  ];

  // Add back parts (slightly behind)
  const backParts = [
    { key: 'back_upper', label: 'Верхняя часть спины', mesh: new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.2), skinMat.clone()), x: 0, y: 1.6, z: -0.36 },
    { key: 'back_lower', label: 'Поясница', mesh: new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.2), skinMat.clone()), x: 0, y: 0.85, z: -0.34 },
  ];

  const allParts = [...bodyParts, ...backParts];
  const meshToPart = new Map();

  allParts.forEach(part => {
    part.mesh.position.set(part.x, part.y, part.z);
    part.mesh.castShadow = true;
    scene.add(part.mesh);
    meshToPart.set(part.mesh, part);
  });

  // Rotate group slightly
  const bodyGroup = new THREE.Group();
  bodyGroup.rotation.y = 0.15;
  allParts.forEach(p => { scene.remove(p.mesh); bodyGroup.add(p.mesh); });
  scene.add(bodyGroup);

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredMesh = null;
  let selectedKey = null;

  function getDefaultMat() { return skinMat.clone(); }

  function resetColors() {
    allParts.forEach(p => {
      if (p.key === selectedKey) {
        p.mesh.material = selectedMat.clone();
      } else {
        p.mesh.material = getDefaultMat();
      }
    });
  }

  function onMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = allParts.map(p => p.mesh);
    const intersects = raycaster.intersectObjects(meshes);
    resetColors();
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const part = meshToPart.get(hit);
      if (part && part.key !== selectedKey) {
        hit.material = skinMatHover.clone();
      }
      hoveredMesh = hit;
      renderer.domElement.style.cursor = 'pointer';
    } else {
      hoveredMesh = null;
      renderer.domElement.style.cursor = 'default';
    }
  }

  function onClick(e) {
    if (!hoveredMesh) return;
    const part = meshToPart.get(hoveredMesh);
    if (!part) return;
    selectedKey = part.key;
    resetColors();
    // Call global selectArea function
    if (typeof selectArea === 'function') {
      selectArea(part.key, part.label);
    }
  }

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick);

  // Touch support
  renderer.domElement.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((touch.clientX - rect.left) / W) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / H) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = allParts.map(p => p.mesh);
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const part = meshToPart.get(hit);
      if (part) {
        selectedKey = part.key;
        resetColors();
        if (typeof selectArea === 'function') selectArea(part.key, part.label);
      }
    }
  });

  // Expose function to sync selection from buttons
  window.highlightBodyPart = function(key) {
    selectedKey = key;
    resetColors();
  };

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    bodyGroup.rotation.y += 0.003;
    renderer.render(scene, camera);
  }
  animate();
})();