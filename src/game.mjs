import {
  app,
  WIDTH,
  HEIGHT,
  Game,
  Car,
  MainCar,
  ROAD_WIDTH,
  BitmapText,
  arrayEquals,
  getIndexes,
} from "../src/engine.mjs";

let game = new Game();
let currentStart =
  game.possibleStarts[Math.floor(Math.random() * game.possibleStarts.length)];
let roadOffsetY = currentStart * ROAD_WIDTH;
let mainCar = new MainCar(game, "temp_car");
window.mainCar = mainCar;
mainCar.setPosition(80, 50 + roadOffsetY);
//--------------------------------------------------

// WASD Butonları
const controlButtons = {
  up: document.getElementById("control-up"),
  left: document.getElementById("control-left"),
  down: document.getElementById("control-down"),
  right: document.getElementById("control-right"),
};

// Kontrol işlevleri
let moveIntervals = {};

const startMove = (direction) => {
  if (moveIntervals[direction]) return; // Aynı yönde zaten hareket varsa tekrarlamayı engelle

  moveIntervals[direction] = setInterval(() => {
    if (direction === "up") mainCar.moveForward(0.01);
    if (direction === "down") mainCar.moveBackward(0.01);
    if (direction === "left") mainCar.steerLeft(0.01);
    if (direction === "right") mainCar.steerRight(0.01);
  }, 8);
};

const stopMove = (direction) => {
  clearInterval(moveIntervals[direction]);
  moveIntervals[direction] = null;
};

// Butonlara olay dinleyicileri ekleme
controlButtons.up.addEventListener("pointerdown", () => startMove("up"));
controlButtons.down.addEventListener("pointerdown", () => startMove("down"));
controlButtons.left.addEventListener("pointerdown", () => startMove("left"));
controlButtons.right.addEventListener("pointerdown", () => startMove("right"));

controlButtons.up.addEventListener("pointerup", () => stopMove("up"));
controlButtons.down.addEventListener("pointerup", () => stopMove("down"));
controlButtons.left.addEventListener("pointerup", () => stopMove("left"));
controlButtons.right.addEventListener("pointerup", () => stopMove("right"));

// Pointerout eklendi -> (parmak kayarsa durması için)
controlButtons.up.addEventListener("pointerout", () => stopMove("up"));
controlButtons.down.addEventListener("pointerout", () => stopMove("down"));
controlButtons.left.addEventListener("pointerout", () => stopMove("left"));
controlButtons.right.addEventListener("pointerout", () => stopMove("right"));

//--------------------------------------------------

let randCar = new Car(game, "temp_car");
randCar.setPosition(100, 100 + roadOffsetY);
const ticker = PIXI.Ticker.system;
window.ticker = ticker;
window.stage = app.stage;
window.app = app;
//testing section, will be deleted
let frameTimes = [];
let isDown = {};
window.addEventListener("keydown", (event) => {
  const isValid = /^(Arrow|[a-zA-Z ]$)/.test(event.key);
  if (isValid && !event.repeat) {
    isDown[event.key.toUpperCase()] = 1;
  }
  if (event.key == " ") {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  delete isDown[event.key.toUpperCase()];
});
let frameText = "0";
let lastUpdate = Date.now();
const FIXED_LOOP_MS = 7;
const FIXED_LOOP_S = FIXED_LOOP_MS / 1000;
let accumulatedTime = 0;
app.canvas.onpointerup = (e) => {
  let rect = e.target.getBoundingClientRect();
  let scale = WIDTH / rect.width;
  let x = (e.clientX - rect.left) * scale;
  let y = (e.clientY - rect.top) * scale;
  if (
    mainCar.goal &&
    arrayEquals(getIndexes(mainCar.goal[0], mainCar.goal[1]), getIndexes(x, y))
  ) {
    mainCar.removeGoal();
    return;
  }
  mainCar.setGoal(x, y);
};
let updateLoop = () => {
  let now = Date.now();
  let diff = now - lastUpdate;
  accumulatedTime += diff;
  while (accumulatedTime >= FIXED_LOOP_MS) {
    if (isDown[" "]) {
      mainCar.brake(FIXED_LOOP_S);
    }
    if (isDown["W"] || isDown["ARROWUP"]) {
      mainCar.moveForward(FIXED_LOOP_S);
    }
    if (isDown["S"] || isDown["ARROWDOWN"]) {
      mainCar.moveBackward(FIXED_LOOP_S);
    }
    if (isDown["A"] || isDown["ARROWLEFT"]) {
      mainCar.steerLeft(FIXED_LOOP_S);
    }
    if (isDown["D"] || isDown["ARROWRIGHT"]) {
      mainCar.steerRight(FIXED_LOOP_S);
    }
    game.tick(FIXED_LOOP_S);
    accumulatedTime -= FIXED_LOOP_MS;
  }
  lastUpdate = now;
};
setInterval(updateLoop, FIXED_LOOP_MS);
ticker.add((dt) => {
  game.graphicsTick();
  frameTimes.push(Date.now());
});
// FPS Sayacı
let fpsFontSize = 20;
const bitmapFontText = new BitmapText({
  text: frameText,
  style: {
    fontFamily: "Desyrel",
    fontSize: fpsFontSize,
    align: "left",
  },
});
bitmapFontText.x = (WIDTH - fpsFontSize) / 2;
bitmapFontText.y = 0;
app.stage.addChild(bitmapFontText);
let modelIdentifier = Math.random().toString(36).slice(2);
let model = await fetch("https://bilis.im/yzgmodel").then(
  (r) => r.json(),
  () => {}
);
// FPS Hesaplama
let secondCounter = 0;
setInterval(() => {
  let now = Date.now();
  frameTimes = frameTimes.filter((e) => now - e < 1000);
  frameText = frameTimes.length.toString();
  bitmapFontText.text = frameText;
  bitmapFontText.x = (WIDTH - fpsFontSize * frameText.length) / 2;
  if (secondCounter++ % 30 == 0) {
    fetch("https://bilis.im/yzgmodelGuncelle", {
      method: "POST",
      body: JSON.stringify({ identifier: modelIdentifier, model: model }),
      headers: { "content-type": "application/json" },
    }).then(
      (r) => r.text(),
      () => {}
    );
  }
}, 1000);
