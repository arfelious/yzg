import { app, Game, BitmapText, arrayEquals, getIndexes} from "./engine.mjs";
import { WIDTH, HEIGHT, ROAD_WIDTH } from "./constants.mjs";
import {MainCar} from "./classes.mjs"
const FIXED_LOOP_MS = 7;
const FIXED_LOOP_S = FIXED_LOOP_MS / 1000;
let game = new Game(app.stage,FIXED_LOOP_S);
window.game=game
let currentStart =
game.possibleStarts[Math.floor(Math.random() * game.possibleStarts.length)];
let roadOffsetY = currentStart * ROAD_WIDTH;
let mainCar = new MainCar(game, "temp_car.png");
window.mainCar = mainCar;
mainCar.setPosition(80, 100 + roadOffsetY);
game.setWanderers()
const startMove = (e) => {
  const button = e.target.classList.contains("control")?e.target:e.target.closest(".control-button");
  if(!button)return
  let buttonId = button.id;
  let direction = buttonId.split("-")[1];
  isDown["button_" + direction.toUpperCase()] = true;
};
let brakeImage = document.getElementById("brake-image")
brakeImage.oncontextmenu = e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  return false;
}
const stopMove = (e) => {
  const button = e.target.classList.contains("control")?e.target:e.target.closest(".control-button");
  if(!button)return
  let buttonId = button.id;
  let direction = buttonId.split("-")[1];
  isDown["button_" + direction.toUpperCase()] = false;
};
let controlContainer = document.getElementById("control-container")
controlContainer.addEventListener("pointerdown",(e)=>startMove(e))
controlContainer.addEventListener("pointerup",(e)=>stopMove(e))
controlContainer.addEventListener("pointerout",(e)=>stopMove(e))

//--------------------------------------------------

// let randCar = new Car(game, "temp_car");
// randCar.setPosition(100, 100 + roadOffsetY);
const ticker = PIXI.Ticker.system;
window.ticker = ticker;
window.stage = app.stage;
window.app = app;
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
let accumulatedTime = 0;
let preventGoalActionCheckbox = document.getElementById("prevent-goal")
if(preventGoalActionCheckbox){
  preventGoalActionCheckbox.addEventListener("change",()=>{
    mainCar.preventGoal=!mainCar.preventGoal
  })
}
app.canvas.onpointerup = (e) => {
  let rect = e.target.getBoundingClientRect();
  let scaleX = WIDTH / rect.width;
  let scaleY = HEIGHT/rect.height
  let x = (e.clientX - rect.left) * scaleX;
  let y = (e.clientY - rect.top) * scaleY;
  if (
    mainCar.goal &&
    arrayEquals(getIndexes(mainCar.goal[0], mainCar.goal[1]), getIndexes(x, y))
  ) {
    mainCar.removeGoal();
    return;
  }
  mainCar.setGoal(x, y);
};
//https://stackoverflow.com/questions/1760250/how-to-tell-if-browser-tab-is-active
let notActiveFor = 0
let notActiveStart = Date.now()
window.onfocus = function () { 
  notActiveFor=Date.now()-notActiveStart
}; 
window.onblur = function () { 
  notActiveStart=Date.now()
}; 
let updateLoop = () => {
  let now = Date.now();
  let diff = now - lastUpdate;
  //sayfa arkaplana alındığında yeniden sayfaya geçildiğinde geçen sürenin tamamına dair değerler hesaplanıyordu
  //bu şekilde yapılınca kaldığı yerden devam ediyor
  accumulatedTime += Math.max(FIXED_LOOP_MS,diff-notActiveFor);
  if(notActiveFor!=0){
    notActiveFor=0
  }
  while (accumulatedTime >= FIXED_LOOP_MS) {
    if (isDown[" "]||isDown["button_BRAKE"]) {
      mainCar.brake(FIXED_LOOP_S,true);
    }
    if (isDown["W"] || isDown["ARROWUP"] || isDown["button_UP"]) {
      mainCar.moveForward(FIXED_LOOP_S,1,true);
    }
    if (isDown["S"] || isDown["ARROWDOWN"] || isDown["button_DOWN"]) {
      mainCar.moveBackward(FIXED_LOOP_S,1,true);
    }
    if (isDown["A"] || isDown["ARROWLEFT"] || isDown["button_LEFT"]) {
      mainCar.steerLeft(FIXED_LOOP_S,true);
    }
    if (isDown["D"] || isDown["ARROWRIGHT"] || isDown["button_RIGHT"]) {
      mainCar.steerRight(FIXED_LOOP_S,true);
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
bitmapFontText.zIndex = 999;
window.frameTimes = frameTimes;
setInterval(() => {
  let now = Date.now();
  frameTimes = frameTimes.filter((e) => now - e < 1000);
  frameText = frameTimes.length.toString();
  if(!bitmapFontText.destroyed&&!game.destroyed){
    bitmapFontText.text = frameText;
    bitmapFontText.x = (WIDTH - fpsFontSize * frameText.length) / 2;
  }
}, 1000);
