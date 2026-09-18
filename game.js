const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 35, 100);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 150);
camera.position.set(0, 10, 14);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
document.body.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xffffff, 0x555555, 1.8);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(20, 30, 10);
scene.add(sun);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshLambertMaterial({ color: 0x4f8a45 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Roads
const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
for (let x = -40; x <= 40; x += 20) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 100), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.x = x;
  road.position.y = 0.01;
  scene.add(road);
}
for (let z = -40; z <= 40; z += 20) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 7), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = z;
  road.position.y = 0.02;
  scene.add(road);
}

// Buildings
const buildings = [];
const buildingColors = [0x9b7b68, 0x6d8ca3, 0xb08b62, 0x777777, 0x8f6f8f];

for (let x = -35; x <= 35; x += 10) {
  for (let z = -35; z <= 35; z += 10) {
    if (Math.abs(x % 20) < 1 || Math.abs(z % 20) < 1) continue;
    if (Math.random() < 0.2) continue;

    const w = 6 + Math.random() * 2;
    const d = 6 + Math.random() * 2;
    const h = 4 + Math.random() * 10;

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)]
      })
    );
    building.position.set(x, h / 2, z);
    scene.add(building);
    buildings.push(building);
  }
}

// Player
const player = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshLambertMaterial({ color: 0x2266ff })
);
player.position.set(0, 1, 5);
scene.add(player);

const keys = {};
addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

let timeLeft = 60;
let score = 0;
let disaster = null;
let disasterTimer = 0;
let gameOver = false;

const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");

function startDisaster() {
  disaster = {
    x: (Math.random() - 0.5) * 60,
    z: (Math.random() - 0.5) * 60,
    radius: 2
  };
  disasterTimer = 8;

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 2.2, 0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0xff3333 })
  );
  marker.position.set(disaster.x, 0.25, disaster.z);
  marker.userData.disaster = true;
  scene.add(marker);

  statusEl.textContent = "⚠️ METEOR INCOMING!";
  setTimeout(() => {
    if (gameOver) return;
    marker.position.y = 0.1;
    marker.scale.set(3, 1, 3);
    disaster.radius = 7;
    statusEl.textContent = "💥 IMPACT! RUN!";
    setTimeout(() => {
      scene.remove(marker);
      disaster = null;
      if (!gameOver) statusEl.textContent = "☀️ Clear... for now.";
    }, 900);
  }, 1200);
}

function endGame(message) {
  gameOver = true;
  statusEl.textContent = message + " Press R to restart.";
}

addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "r" && gameOver) location.reload();
});

let last = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!gameOver) {
    // Movement
    const speed = 8 * dt;
    if (keys["w"] || keys["arrowup"]) player.position.z -= speed;
    if (keys["s"] || keys["arrowdown"]) player.position.z += speed;
    if (keys["a"] || keys["arrowleft"]) player.position.x -= speed;
    if (keys["d"] || keys["arrowright"]) player.position.x += speed;

    player.position.x = THREE.MathUtils.clamp(player.position.x, -47, 47);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -47, 47);

    // Countdown
    timeLeft -= dt;
    timerEl.textContent = Math.max(0, Math.ceil(timeLeft));

    if (timeLeft <= 0) {
      score += 100;
      scoreEl.textContent = score;
      endGame("🏆 YOU SURVIVED!");
    }

    // Random disaster
    disasterTimer -= dt;
    if (disasterTimer <= 0 && !disaster) {
      startDisaster();
      disasterTimer = 12;
    }

    // Disaster collision
    if (disaster) {
      const dx = player.position.x - disaster.x;
      const dz = player.position.z - disaster.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < disaster.radius) {
        endGame("💥 You got caught in the disaster!");
      }
    }

    // Camera follows player
    camera.position.x += (player.position.x - camera.position.x) * 0.08;
    camera.position.z += (player.position.z + 14 - camera.position.z) * 0.08;
    camera.lookAt(player.position.x, 0, player.position.z);
  }

  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

statusEl.textContent = "🌆 Survive the city!";
animate(performance.now());