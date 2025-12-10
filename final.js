import * as THREE from "https://csc-vu.github.io/lib/three.module.js";
import { GLTFLoader } from "https://csc-vu.github.io/lib/GLTFLoader.js";
import KeyboardState from "https://csc-vu.github.io/lib/KeyboardState.js";

const uiContainer = document.createElement("div");
Object.assign(uiContainer.style, {
  position: "fixed",
  bottom: "20px",
  left: "50%",
  transform: "translateX(-45%)",
  width: "100%",
  display: "flex",
  gap: "20px",
  zIndex: 9999,
});
document.body.appendChild(uiContainer);

function createUIBox(text) {
  const box = document.createElement("div");
  box.textContent = text;

  Object.assign(box.style, {
    padding: "10px 20px",
    background: "rgba(0, 0, 0, 0.6)",
    color: "white",
    fontFamily: "sans-serif",
    borderRadius: "8px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(4px)",
  });

  return box;
}

uiContainer.appendChild(createUIBox("Enter to Pitch"));
uiContainer.appendChild(createUIBox("Space to Swing"));
uiContainer.appendChild(createUIBox("C - Toggle Chase View"));
uiContainer.appendChild(createUIBox("B - Toggle Ball View"));
uiContainer.appendChild(createUIBox("Right Arrow - Next Camera Position"));
uiContainer.appendChild(createUIBox("Left Arrow - Previous Camera Position"));

const loader = new GLTFLoader();
let pitcherAnims;
const clock = new THREE.Clock();
let textureLoader = new THREE.TextureLoader();
let bat;
let mixerBat;
let ball;
let swingAction;
let groundFrictionCoefficient = 0.99;
let airFrictionCoefficient = 0.999;
let batHitCenter;
let batHitSurface;
let wasBallHit = false;
let didMiss = false;
let keyboard = new KeyboardState();
let isPitching = false;
let isRecovering = false;
let followBall = false;
let cameraModeChangedFollow = false;
let cameraModeChangedChase = false;
let cameraModeChangedNextPosition = false;
let cameraModeChangedPrevPosition = false;
let chaseBall = false;
let cameraPositionIndex = 0;
let cameraPositions = [
  [-30, 30, 100],
  [90, 30, 0],
];
let spacePressed = false;

function loadPitcherModel(scene) {
  return new Promise((resolve, _) => {
    const loader = new GLTFLoader();
    const urlPitcher = "./pitcher.glb";

    loader.load(urlPitcher, (gltf) => {
      const pitcher = gltf.scene;
      scene.add(pitcher);

      pitcher.scale.set(5, 5, 5);
      pitcher.position.set(-25, 0, 0);
      pitcher.rotation.set(0, Math.PI / 2, 0);

      const pitcherMixer = new THREE.AnimationMixer(pitcher);
      const animations = gltf.animations;

      const anims = {
        mixer: pitcherMixer,
        pitch: pitcherMixer.clipAction(
          animations.find((a) => a.name === "Pitch")
        ),
        throw: pitcherMixer.clipAction(
          animations.find((a) => a.name === "Throw")
        ),
        miss: pitcherMixer.clipAction(
          animations.find((a) => a.name === "Miss")
        ),
        strike: pitcherMixer.clipAction(
          animations.find((a) => a.name === "Strike")
        ),
        stand: pitcherMixer.clipAction(
          animations.find((a) => a.name === "Stand")
        ),
      };

      resolve(anims);
    });
  });
}

function loadStadiumModel(scene) {
  return new Promise((resolve, _) => {
    const loader = new GLTFLoader();
    const urlField = "./baseball_field.glb";

    loader.load(urlField, (gltf) => {
      let field = gltf.scene;
      scene.add(field);
      field.scale.set(3, 3, 3);
      field.position.set(-65, -3.7, -152);
      field.rotation.set(-Math.PI / 2, 0, Math.PI / 2);

      resolve(field);
    });
  });
}

function playOnce(action, mixer, anims, modifiers = null) {
  return new Promise((resolve) => {
    for (const key in anims) {
      if (key === "mixer") continue;
      anims[key].stop();
      anims[key].setEffectiveWeight(0);
    }

    action.reset();
    action.setEffectiveWeight(1);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce);
    action.play();
    action.timeScale = modifiers ? modifiers.timeScale : 1;

    const onFinished = (e) => {
      if (e.action === action) {
        mixer.removeEventListener("finished", onFinished);
        resolve(action);
      }
    };

    mixer.addEventListener("finished", onFinished);
  });
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function animatePitcher() {
  isPitching = true;
  let throwSpeedModifier = Math.random();
  await playOnce(pitcherAnims.pitch, pitcherAnims.mixer, pitcherAnims);
  await wait(Math.random() * 2000);
  await playOnce(pitcherAnims.throw, pitcherAnims.mixer, pitcherAnims, {
    timeScale: 1 + throwSpeedModifier,
  });
  throwBall(0.5 + throwSpeedModifier);
  isPitching = false;
}

async function animateRecovery() {
  isRecovering = true;
  if (wasBallHit) {
    await playOnce(pitcherAnims.miss, pitcherAnims.mixer, pitcherAnims);
    wasBallHit = false;
  }
  if (didMiss) {
    resetBall();
    await playOnce(pitcherAnims.strike, pitcherAnims.mixer, pitcherAnims);
  }
  isRecovering = false;
}

function createLights(scene) {
  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight("white", 1);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);
}

function createCylinder(radiusTop, radiusBottom, height) {
  const mat = new THREE.MeshPhongMaterial({
    color: "orange",
  });

  const geom = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    64,
    64
  );
  const mesh = new THREE.Mesh(geom, mat);
  return mesh;
}

function createEnd(radius) {
  const mat = new THREE.MeshPhongMaterial({ color: "orange" });
  const geom = new THREE.SphereGeometry(
    radius,
    32,
    32,
    0,
    2 * Math.PI,
    0,
    Math.PI / 2
  );
  const mesh = new THREE.Mesh(geom, mat);
  mesh.scale.y = 0.5;

  return mesh;
}

function createBat() {
  bat = new THREE.Object3D();
  let knob = createCylinder(1, 1, 1);
  let handle = createCylinder(0.5, 0.5, 8);
  let taper = createCylinder(1.25, 0.5, 6);
  let barrel = createCylinder(1.25, 1.25, 9);
  let end = createEnd(1.25);
  batHitCenter = new THREE.Object3D();
  batHitSurface = new THREE.Object3D();
  knob.position.y = 5.5;
  handle.position.y = 10;
  taper.position.y = 17;
  barrel.position.y = 24.5;
  end.position.y = 29;

  batHitCenter.position.y = 24.5;
  batHitSurface.position.y = 24.5;
  batHitSurface.position.x = 1;

  bat.add(knob);
  bat.add(handle);
  bat.add(taper);
  bat.add(barrel);
  bat.add(end);
  bat.add(batHitCenter);
  bat.add(batHitSurface);

  bat.scale.set(0.25, 0.25, 0.25);
  bat.position.set(50, 5, 4);
  return bat;
}

function animateBat() {
  bat.name = "bat";
  mixerBat = new THREE.AnimationMixer(bat);

  swingAction = mixerBat.clipAction(createSwingClip());

  swingAction.clampWhenFinished = true;
  swingAction.timeScale = 2; // 1.0 = normal speed
  swingAction.loop = THREE.LoopRepeat; // default; repeats forever
  swingAction.repetitions = 1;
  // swingAction.play();
}

function createSwingClip() {
  const keyTimes = [0, 0.2, 0.4, 0.6, 1];
  const batAngleX = [
    Math.PI / 4,
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 2,
    Math.PI / 4,
  ];
  const batAngleY = [0, 0, 0, 0, 0];
  const batAngleZ = [0, -Math.PI / 2, -Math.PI, -Math.PI * 1.5, -Math.PI * 2];

  const angleXTrack = new THREE.NumberKeyframeTrack(
    "bat.rotation[x]",
    keyTimes,
    batAngleX
  );

  const angleYTrack = new THREE.NumberKeyframeTrack(
    "bat.rotation[y]",
    keyTimes,
    batAngleY
  );

  const angleZTrack = new THREE.NumberKeyframeTrack(
    "bat.rotation[z]",
    keyTimes,
    batAngleZ
  );

  const swingClip = new THREE.AnimationClip("swingClip", -1, [
    angleXTrack,
    angleYTrack,
    angleZTrack,
  ]);

  return swingClip;
}

function createBall(radius) {
  const mat = new THREE.MeshPhongMaterial({ color: "white" });
  const geom = new THREE.SphereGeometry(radius, 32, 32, 0, 2 * Math.PI, 0);
  const mesh = new THREE.Mesh(geom, mat);

  return mesh;
}

function createGround(length, width) {
  const textureGround = textureLoader.load("grass.jpg");
  textureGround.wrapS = THREE.RepeatWrapping;
  textureGround.wrapT = THREE.RepeatWrapping;
  textureGround.repeat.set(20, 20);
  // textureGround.needsUpdate = true;
  const groundMat = new THREE.MeshPhongMaterial({
    color: "green",
    map: textureGround,
  });
  const geomGround = new THREE.PlaneGeometry(length, width);
  const ground = new THREE.Mesh(geomGround, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

export async function buildScene(scene, camera) {
  pitcherAnims = await loadPitcherModel(scene);
  await loadStadiumModel(scene);
  let bat = createBat();
  scene.add(bat);
  animateBat();
  playOnce(pitcherAnims.stand, pitcherAnims.mixer, pitcherAnims);

  let ground = createGround(600, 500);
  ground.position.y = -0.5;
  scene.add(ground);
  ball = createBall(0.5);
  ball.visible = false;
  scene.add(ball);

  camera.position.x = -30;
  camera.position.y = 30;
  camera.position.z = 100;

  initialPositions(ball);

  createLights(scene, camera);
}

function initialPositions(obj) {
  obj.affectedByGravity = null;

  obj.initPositions = {
    x: obj.position.x,
    y: obj.position.y,
    z: obj.position.z,
  };

  obj.velocities = {
    x: 0,
    y: 0,
    z: 0,
  };

  obj.manualVelocities = {
    x: 0,
    y: 0,
    z: 0,
  };
}

function throwBall(speed) {
  resetBall();
  ball.visible = true;
  ball.manualVelocities.x = speed;
}

function applyPhysics(obj, delta) {
  if (obj.isInFreefall && obj.affectedByGravity) {
    obj.velocities.y -= (9.8 / 4) * delta;
    obj.velocities.x *= airFrictionCoefficient;
    obj.velocities.z *= airFrictionCoefficient;
  }

  if (!obj.isInFreefall) {
    obj.velocities.x *= groundFrictionCoefficient;
    obj.velocities.z *= groundFrictionCoefficient;
    obj.initPositions.y = 2;
    obj.position.y = 2;
  }
  obj.position.y += obj.velocities.y;
  obj.position.x += obj.velocities.x;
  obj.position.z += obj.velocities.z;
}

function isInFreefall(obj) {
  let isInFF = obj.position.y <= 0.5 ? false : true;
  obj.isInFreefall = isInFF;
}

function calcVelocities(obj) {
  obj.velocities = {
    x:
      obj.manualVelocities.x === 0
        ? obj.position.x - obj.initPositions.x
        : obj.manualVelocities.x,
    y:
      obj.manualVelocities.y === 0
        ? obj.position.y - obj.initPositions.y
        : obj.manualVelocities.y,
    z:
      obj.manualVelocities.z === 0
        ? obj.position.z - obj.initPositions.z
        : obj.manualVelocities.z,
  };

  obj.initPositions = {
    x: obj.position.x,
    y: obj.position.y,
    z: obj.position.z,
  };

  obj.manualVelocities = {
    x: 0,
    y: 0,
    z: 0,
  };

  obj.directionVector = new THREE.Vector3(
    obj.velocities.x,
    obj.velocities.y,
    obj.velocities.z
  );
}

function calcBatNormalVector() {
  let normalVector = new THREE.Vector3();
  let pointA = new THREE.Vector3();
  let pointB = new THREE.Vector3();
  batHitCenter.getWorldPosition(pointA), batHitSurface.getWorldPosition(pointB);
  normalVector.subVectors(pointB, pointA);
  normalVector.normalize();
  return normalVector;
}

function calcReflectedTrajectory() {
  let subVec = new THREE.Vector3(1, 0, 0);
  let normal = calcBatNormalVector();
  return subVec.reflect(normal);
}

function hitBall() {
  let distance = calcBallBatDistance();
  if (distance < 2.5) {
    wasBallHit = true;
    followBall = true;
    ball.affectedByGravity = true;
    let trajectory = calcReflectedTrajectory();
    ball.manualVelocities.x = trajectory.x;
    ball.manualVelocities.y = 2;
    ball.manualVelocities.z = trajectory.z;
  }
}

function calcBallBatDistance() {
  let distance = new THREE.Vector3();
  let pointA = new THREE.Vector3();
  let pointB = new THREE.Vector3();
  ball.getWorldPosition(pointA);
  batHitCenter.getWorldPosition(pointB);
  distance.subVectors(pointB, pointA);

  return distance.length();
}

function checkWithinBounds() {
  let stadiumCenter = new THREE.Vector3(-60, 0, 0);
  let ballPositionNoY = new THREE.Vector3(ball.position.x, 0, ball.position.z);
  let distVec = new THREE.Vector3();
  distVec.subVectors(ballPositionNoY, stadiumCenter);
  if (distVec.length() >= 240) {
    ball.manualVelocities.x = -ball.velocities.x;
    ball.manualVelocities.z = -ball.velocities.z;
  }
}

function checkBallHit() {
  if (ball.position.x > 65 && !ball.affectedByGravity) {
    didMiss = true;
    spacePressed = false;
  }
}

function resetBall() {
  ball.visible = false;
  chaseBall = false;
  ball.affectedByGravity = false;
  ball.position.set(-15, 5, 0);
  ball.initPositions.x = -15;
  ball.initPositions.y = 5;
  ball.initPositions.z = 0;
}

function cameraModes(camera) {
  if (chaseBall) {
    let tailingVector = ball.directionVector.negate().normalize();
    camera.position.set(
      ball.position.x + tailingVector.x * 10,
      ball.position.y + tailingVector.y * 10,
      ball.position.z + tailingVector.z * 10
    );
    camera.lookAt(ball.position);
  } else {
    if (followBall) {
      camera.lookAt(ball.position);
    } else {
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }

    camera.position.set(...cameraPositions[cameraPositionIndex]);
  }
}

export function update(camera) {
  const delta = clock.getDelta();
  calcVelocities(ball);
  isInFreefall(ball);
  applyPhysics(ball, delta);
  if (pitcherAnims.mixer) pitcherAnims.mixer.update(delta);
  if (mixerBat) mixerBat.update(delta);

  if (keyboard.down(" ")) {
    spacePressed = true;
    swingAction.play();
    swingAction.reset();
  }

  hitBall();
  checkWithinBounds();
  checkBallHit();

  if (keyboard.down("Enter") && !isPitching && !isRecovering) {
    chaseBall = false;
    followBall = false;
    animatePitcher();
  }

  if ((wasBallHit || didMiss) && !isPitching && !isRecovering) {
    animateRecovery();
    wasBallHit = false;
    didMiss = false;
  }

  if (keyboard.down("b") && !cameraModeChangedFollow) {
    followBall = !followBall;
  }
  cameraModeChangedFollow = keyboard.down("b");

  if (keyboard.down("c") && !cameraModeChangedChase && ball.visible) {
    chaseBall = !chaseBall;
  }
  cameraModeChangedChase = keyboard.down("c");

  if (keyboard.down("ArrowRight") && !cameraModeChangedNextPosition) {
    cameraPositionIndex =
      cameraPositionIndex === cameraPositions.length - 1
        ? 0
        : cameraPositionIndex + 1;
  }
  cameraModeChangedNextPosition = keyboard.down("ArrowRight");

  if (keyboard.down("ArrowLeft") && !cameraModeChangedPrevPosition) {
    cameraPositionIndex =
      cameraPositionIndex === 0
        ? cameraPositions.length - 1
        : cameraPositionIndex - 1;
  }
  cameraModeChangedPrevPosition = keyboard.down("ArrowLeft");

  cameraModes(camera);
}
