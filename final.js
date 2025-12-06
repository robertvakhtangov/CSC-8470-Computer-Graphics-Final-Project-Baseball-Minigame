import * as THREE from "https://csc-vu.github.io/lib/three.module.js";
import { OrbitControls } from "https://csc-vu.github.io/lib/OrbitControls.js";
import { TransformControls } from "https://csc-vu.github.io/lib/TransformControls.js";
import { GLTFLoader } from "https://csc-vu.github.io/lib/GLTFLoader.js";
import KeyboardState from "https://csc-vu.github.io/lib/KeyboardState.js";

const loader = new GLTFLoader();
let mixer;
const clock = new THREE.Clock();
let textureLoader = new THREE.TextureLoader();
let bat;
let mixerBat;
let ball;
let swingAction;
let ballIncrement = 0;
let intervalId;
let frictionCoefficient = 0.99;
let batHitCenter;
let batHitSurface;

let keyboard = new KeyboardState();

function loadModels(scene) {
  const loader = new GLTFLoader();
  const urlPitcher = "./pitcher.glb";
  const urlField = "./baseball_field.glb";

  function onLoadPitcher(gltf) {
    let pitcher = gltf.scene;
    scene.add(pitcher);
    pitcher.scale.set(5, 5, 5);
    pitcher.position.set(-25, 0, 0);
    pitcher.rotation.set(0, Math.PI / 2, 0);

    mixer = new THREE.AnimationMixer(pitcher);
    let animations = gltf.animations;

    const pitch = mixer.clipAction(animations.find((a) => a.name === "Pitch"));

    pitch.play();
  }

  function onLoadField(gltf) {
    let field = gltf.scene;
    scene.add(field);
    field.scale.set(3, 3, 3);
    field.position.set(-65, -3.7, -152);
    field.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  }

  loader.load(urlPitcher, onLoadPitcher);
  loader.load(urlField, onLoadField);
}

function createLights(scene, camera) {
  // AmbientLight (color, intensity)
  const ambient = new THREE.AmbientLight(0x404040); // soft light
  scene.add(ambient);

  // Dim overhead DirectionalLight (color, intensity) shining from above
  const topLight = new THREE.DirectionalLight("white", 1);
  topLight.position.set(1, 1, 1);
  scene.add(topLight);
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
  let guide = createCylinder(0.25, 0.25, 10);
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

  guide.position.y = 24.5;
  guide.position.x = 1;
  guide.rotation.z = Math.PI / 2;

  bat.add(knob);
  bat.add(handle);
  bat.add(taper);
  bat.add(barrel);
  bat.add(end);
  // bat.add(guide);
  bat.add(batHitCenter);
  bat.add(batHitSurface);

  bat.scale.set(0.25, 0.25, 0.25);
  bat.position.set(50, 5, 4);
  // bat.rotation.set(Math.PI / 4, 0, 0);
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

export function buildScene(scene, camera, orbitControls, tfControls) {
  // const tfContrls = new TransformControls(camera, document);
  loadModels(scene);
  const axesHelper = new THREE.AxesHelper(8);
  scene.add(axesHelper);
  let bat = createBat();
  scene.add(bat);
  animateBat();

  let ground = createGround(600, 500);
  ground.position.y = -0.5;
  scene.add(ground);
  ball = createBall(0.5);
  ball.position.set(50, 7, -1);
  scene.add(ball);

  tfControls.addEventListener("dragging-changed", function (event) {
    orbitControls.enabled = !event.value;
  });
  tfControls.attach(ball);
  tfControls.mode = "translate";
  scene.add(tfControls);

  camera.position.x = 100;
  camera.position.y = 30;
  camera.position.z = 0;
  intervalId = setInterval(throwBall, 5000, 0.5);
  initialPositions(ball);
  // setTimeout(() => {
  //   // ball.manualVelocities.x = 0.5;
  //   ball.manualVelocities.y = 1;
  //   // ball.position.y = 1;
  //   // ball.manualVelocities.x = 0;
  // }, 1000);

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
  console.log(ball.manualVelocities.x);
  ball.affectedByGravity = false;
  if (ball.manualVelocities.x === 0) {
    ball.position.set(-15, 5, 0);
    ball.initPositions.x = -15;
    ball.initPositions.y = 5;
    ball.initPositions.z = 0;
  }
  ball.manualVelocities.x = speed;
  if (ball.position.x > 100 || !ball.isInFreefall) {
    // console.log("hi");
    ball.position.set(-15, 5, 0);
    ball.manualVelocities.x = 0;

    // clearInterval(intervalId);
  }
}

function applyPhysics(obj, delta) {
  if (obj.isInFreefall && obj.affectedByGravity) {
    obj.velocities.y -= (9.8 / 4) * delta;
  }

  if (!obj.isInFreefall) {
    obj.velocities.x *= frictionCoefficient;
    obj.velocities.z *= frictionCoefficient;
    obj.initPositions.y = 0.5;
    obj.position.y = 0.5;
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
  console.log(distance);
  if (distance < 2.5) {
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

export function update(camera) {
  const delta = clock.getDelta();
  calcVelocities(ball);
  isInFreefall(ball);
  applyPhysics(ball, delta);
  if (mixer) mixer.update(delta);
  if (mixerBat) mixerBat.update(delta);

  if (keyboard.down(" ")) {
    swingAction.play();
    swingAction.reset();
  }

  hitBall();

  // ball.position.x += 1;
  // camera.lookAt(ball.position);
}
