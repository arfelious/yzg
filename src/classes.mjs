import { getIndexes, getNormalizedAngle, inBounds, getMagnitude, checkIntersects, getBounds, app, toRadian, getSprite, dotProduct, toUnitVector, toVector, noop, getAbsoluteSubgridIndex, getSubgridAngle, arrayEquals, toDegree, getLaneOffset, getOpposite, getNextDirection, findPath, drawPath, highlightStyle, clearPath, getNeighbours, getConnections, getRandom, getRelativeDirectionList, checkIsOnRoad, getCoordinates, getDistance, getRelativeDirection, getLaneCoordinates, calculateVehicleProperties, getPossibleSubgrids, getAbsoluteGlobalSubgrid, unorderedArrayEquals, getIntersectionPoint } from "./engine.mjs";
import { connectionArray, connectionLookup, LIGHT_STATES, LINE_AMOUNTS, ROAD_TYPES, angleLookup, DIRECTION_ALTERNATIVE, PERSPECTIVE, REAL_THREATS, THREATS, NONPHYSICAL_THREATS, CAR_SPRITES, TYPE_TO_IMAGE, PEDESTRIANS, OBSTACLES, BUILDING_SIDES, BUILDING_TOPS, IS_DEBUG, ROAD_WIDTH, MOVE_MULTIPLIER, DRAG, TURN_DRAG, STEERING_MULTIPLIER, MIN_ALIGNMENT, CAR_WIDTH, GRID_WIDTH, GRID_HEIGHT, PEDESTRIAN_MOVE_MULTIPLIER, LIGHT_CHANGE_TICK, BUILDING_MULTIPLIER } from "./constants.mjs";
class Entity {
  game;
  isImmovable = true;
  isCollisionEffected = false;
  shouldDraw;
  tickCounter = 0;
  actionInterval = 5; //kaç tick'te bir eylem alınacağı
  isWrongDirection = false;
  collisionLineAmount = 4;
  zIndex = 2;
  accX = 0;
  accY = 0;
  velX = 0;
  velY = 0;
  posX = 0;
  posY = 0;
  lastPosX = 0;
  lastPosY = 0;
  savedDirection = 0;
  directionOffset = 90; // resmin yönünü gösteriyor (0 derece kuzey olsaydı resmin baktığı yön neye karşılık gelirdi )
  _direction = 0;
  lastDirection = 0;
  bounds;
  scale;
  graphics;
  boundingRect;
  lastColliders;
  anchorX = 0;
  anchorY = 0;
  createGraphics = false;
  drawBounds = false;
  drawCollision = false;
  collisionBounds;
  entityType = "generic";
  forceSquare = false;
  gridIndexes = [0, 0];
  onIndexChange = [];
  childGraphics = [];
  customDrawers = new Set();
  childContainer = new PIXI.Container();
  cachedLines;
  currentGrids = new Set();
  destroyed = false;
  redrawNecessary = true;
  mass = null;
  massMultiplier = 1;
  subgridEntities = [];
  isChild = false;
  currentGridsArray = [];
  setSand(subgridX, subgridY, oceanIndex, isSmall = false) {
    let sand = new Sand(this.game, this, [subgridX, subgridY], oceanIndex, isSmall);
    this.subgridEntities.push([sand.subgridIndexes, sand]);
  }
  getGrids() {
    let lines = this.getLines();
    let points = lines.map(e => e[0]);
    let currentGridsArray = points.map(e => getIndexes(e[0], e[1]));
    this.currentGridsArray = currentGridsArray;
    return new Set(currentGridsArray);
  }
  addDrawer = (fun) => {
    this.customDrawers.add(fun);
  };
  removeDrawer = (fun) => {
    if (!fun) return;
    this.customDrawers.delete(fun);
  };
  drawGraphics(clearRect) {
    if (this.destroyed) return;
    if (!this.createGraphics) return;
    if (clearRect) this.graphics.clear();
    if (this.drawBounds) {
      this.graphics.rect(...this.boundingRect);
      this.graphics.fill(this.fillColor);
    }
    if (this.drawCollision && (!this.isImmovable || this.redrawNecessary)) {
      let lines = this.getLines();
      this.lines.forEach((e, i) => {
        let line = lines[i];
        if (!line) return;
        e.clear();
        e.moveTo(line[0][0], line[0][1]).lineTo(line[1][0], line[1][1]).stroke();
      });
      this.redrawNecessary = false;
    }
  }
  getRoundedDirection(useVisualDirection = false) {
    let direction = getNormalizedAngle(useVisualDirection ? this.direction : this._direction);
    return Math.round(direction / 90) * 90;
  }
  getNormalizedAngle(angle = this.direction) {
    return getNormalizedAngle(angle);
  }
  getAngleIndex(angle = this.getNormalizedAngle()) {
    return Math.round(angle / 90) % 4;
  }
  getFacingDirection() {
    return connectionArray[this.getAngleIndex()];
  }
  getRelevantEntities() {
    // array'deki harita sınırı dahilindeki her set array'e çevriliyor, array içinde array olmaması için düzleştiriliyor
    return this.currentGridsArray.filter(inBounds).map(e => [...this.game.gridEntitySets[e[0]][e[1]]] /* set'ten array'e çevirmek için */).flat();
  }
  getColliders() {
    if (!this.isCollisionEffected) return [];
    let currLines = this.getLines();
    return this.getRelevantEntities().filter(e => {
      if (e == this || e.entityType == "sensor" || e.entityType == "sand") return false;
      //normalde genişliğin yarısına bakmak yeterli olmalı ama nesnelerin anchor'ına bakmadan emin olunamıyor
      //yollar için emin olunabilir
      //sqrt2 kısmı merkezden max uzaklık için
      let distance = getMagnitude(this.posX - e.posX, this.posY - e.posY);
      if (distance > (this.width + e.width) * Math.SQRT2) return;
      let entityLines = e.getLines();
      return currLines.find((l1) => {
        let retVal = entityLines.find((l2) => checkIntersects(l1[0], l1[1], l2[0], l2[1]));
        return retVal;
      });
    });
  }
  init(sprite) {
    this.bounds = getBounds(sprite);
    let wh = sprite.getSize();
    this.ratio = wh.height / wh.width;
    if (this.height && !this.width) this.width = this.height / this.ratio;
    this.spriteWidth = this.spriteWidth ?? this.width;
    this.scale = this.spriteWidth / wh.width;
    this.height = this.height ?? (this.forceSquare ? this.spriteWidth : this.spriteWidth * this.ratio);
    this.mass = this.mass ?? (this.width * this.height) * this.massMultiplier / 10;
    sprite.setSize(this.spriteWidth, this.height);
    sprite.anchor.set(this.anchorX, this.anchorY);
    //! değilini aldığı için !! boolean yapıyor
    let hadSprite = !!this._sprite;
    this._sprite = sprite;
    if (hadSprite) return;
    this.scaledBounds = [
      this.bounds[0][0],
      this.bounds[0][1],
      this.bounds[3][0] - this.bounds[0][0] + 1,
      this.bounds[3][1] - this.bounds[0][1] + 1,
    ].map(e => e * this.scale);
    app.stage.addChild(this.childContainer);
    if (this.width == ROAD_WIDTH) this.childContainer.zIndex = this.zIndex + 1;
    if (this.createGraphics) {
      this.graphics = new PIXI.Graphics();
      this.graphics.zIndex = 1;
      this.lines = Array(this.collisionLineAmount).fill().map(() => new PIXI.Graphics());
      this.lines.forEach(e => {
        e.setStrokeStyle(39423);
        e.zIndex = 1;
      });
      this.collisionGraphics = new PIXI.Graphics();
      this.childGraphics.push(this.graphics, this.collisionGraphics, ...this.lines);
      this.childGraphics.forEach(e => {
        app.stage.addChild(e);
      });
      this.boundingRect = this.scaledBounds.map((e, i) => e - (i == 0 ? this.sprite.width * this.anchorX : i == 1 ? this.sprite.height * this.anchorY : 0));
      this.drawGraphics();
    }
  }
  a = 0;
  getSurroundingLines() {
    /*
          A----B
          |    |
          D----C
        */
    let width = this.scaledBounds[2];
    let height = this.scaledBounds[3];
    let startAngleRad = toRadian(this._direction);
    let xMultiplier = Math.cos(startAngleRad);
    let yMultiplier = Math.sin(startAngleRad);
    let anchorX = this.width * this.anchorX - this.scaledBounds[0];
    let anchorY = this.width * this.anchorY * this.ratio - this.scaledBounds[1];
    let anchorOffsetX = anchorX * xMultiplier - anchorY * yMultiplier;
    let anchorOffsetY = anchorX * yMultiplier + anchorY * xMultiplier;
    let xOffset = this.posX - anchorOffsetX;
    let yOffset = this.posY - anchorOffsetY;
    let A = [xOffset, yOffset];
    let B = [A[0] + width * xMultiplier, A[1] + width * yMultiplier];
    let C = [
      B[0] + height * Math.cos(toRadian(90) + startAngleRad),
      B[1] + height * Math.sin(toRadian(90) + startAngleRad),
    ];
    let D = [
      C[0] + width * Math.cos(toRadian(180) + startAngleRad),
      C[1] + width * Math.sin(toRadian(180) + startAngleRad),
    ];
    let AB = [A, B];
    let BC = [B, C];
    let CD = [C, D];
    let DA = [D, A];
    this.shouldDraw = true;
    return [AB, BC, CD, DA];
  }
  getLines() {
    if (this.cachedLines) return this.cachedLines;
    return this.cachedLines = this.getSurroundingLines();
  }
  setGraphics() {
    if (this.shouldDraw) {
      this.drawGraphics(true);
    }
  }
  set fillColor(value) {
    if (this.graphics && !this.destroyed) {
      this.graphics.fill(value);
      this.shouldDraw = true;
    }
    return (this._fillColor = value);
  }
  get fillColor() {
    return this._fillColor;
  }
  get direction() {
    return this._direction + this.directionOffset; //in order to use rotated sprites
  }
  set direction(val) {
    return this.setDirection(val);
  }
  setDirection(val) {
    //let lastColliders = this.getColliders()
    //let lastDirection = this._direction
    this._direction = val - this.directionOffset;
    //let currColliders = this.getColliders()
    //if(!unorderedArrayEquals(lastColliders,currColliders)){
    //this._direction=lastDirection
    //}
  }
  setPosition(x, y) {
    this.lastPosX = this.posX;
    this.lastPosY = this.posY;
    this.posX = x;
    this.posY = y;
    this.gridIndexes = getIndexes(x, y, this.anchorX * this.width, this.anchorY * this.height);
    this.cachedLines = null;
    let lastGrids = this.currentGrids;
    this.currentGrids = this.getGrids();
    this.resetGridSets(lastGrids);
    this.redrawNecessary = true;
  }
  get position() {
    return [this.posX, this.posY];
  }
  set position(val) {
    this.setPosition(val[0], val[1]);
  }
  inScene = false;
  _sprite;
  ratio;
  get sprite() {
    return this._sprite;
  }
  spriteCache = {};
  set sprite(currSpritePath) {
    if (this._sprite) app.stage.removeChild(this._sprite);
    if (!this.inScene) {
      this.inScene = true;
    }
    this.spriteName = currSpritePath;
    let sprite;
    if (this.spriteCache[currSpritePath]) {
      sprite = this.spriteCache[currSpritePath];
    } else {
      sprite = getSprite(currSpritePath);
      this.spriteCache[currSpritePath] = sprite;
    }
    this.init(sprite);
    if (!this.isChild) app.stage.addChild(sprite);
    sprite.zIndex = this.zIndex;
  }
  // Hız büyüklüğünü hesaplayan fonksiyon
  absoluteVel() {
    return getMagnitude(this.velX, this.velY);
  }
  // İvme büyüklüğünü hesaplayan fonksiyon
  absoluteAcc() {
    return getMagnitude(this.accX, this.accY);
  }
  getAlignment() {
    return (dotProduct(toUnitVector([this.velX, this.velY]), toVector(this._direction)) || 0);
  }
  resetGridSets(lastGrids) {
    if (lastGrids) {
      //belki manuel döngüden daha hızlıdır
      let diff = lastGrids.difference(this.currentGrids);
      let diffSize = diff.size;
      if (diffSize > 0) {
        diff.forEach(e => inBounds(e) && this.game.gridEntitySets[e[0]][e[1]].delete(this));
      }
      let added = this.currentGrids.difference(lastGrids);
      let addedSize = added.size;
      if (addedSize > 0) {
        added.forEach(e => inBounds(e) && this.game.gridEntitySets[e[0]][e[1]].add(this));
      }
    }
  }
  tick() {
    if (!this.destroyed) {
      if (this.sprite.x != this.posX) {
        this.sprite.x = this.posX;
        this.childContainer.x = this.posX;
      }
      if (this.sprite.y != this.posY) {
        this.sprite.y = this.posY;
        this.childContainer.y = this.posY;
      }
      if (this.createGraphics) {
        if (this.graphics.x != this.posX) this.graphics.x = this.posX;
        if (this.graphics.y != this.posY) this.graphics.y = this.posY;
        if (this.graphics.angle != this.sprite.angle) this.graphics.angle = this.sprite.angle;
      }
    }
    this.customDrawers.forEach((fun) => fun());
    if (this.childContainer.angle != this.direction) {
      this.childContainer.angle = this.direction;
    }
    if (this.isImmovable) {
      this.sprite.angle = this.direction;
    } else if (!this.destroyed) {
      this.cachedLines = null;
      let lastGrids = this.currentGrids;
      this.currentGrids = this.getGrids();
      this.resetGridSets(lastGrids);
    }
  }
  destroy() {
    let lastGrids = this.currentGrids;
    this.currentGrids = new Set();
    this.resetGridSets(lastGrids);
    this.shouldDraw = false;
    this.destroyed = true;
    this.game.entities.splice(this.game.entities.indexOf(this), 1);
    if (this.sprite) this.sprite.destroy();
    if (this.childGraphics) {
      this.childGraphics.forEach(e => e.destroy());
    }
    if (this.childContainer) {
      this.childContainer.children.forEach(e => e.destroy());
      this.childContainer.destroy();
    }
    this.tick = noop;
  }
  constructor(game) {
    this.game = game;
    this.game.entities.push(this);
  }
}
export class Sand extends Entity {
  anchorX = 0.5;
  anchorY = 0.5;
  isChild = true;
  zIndex = 3;
  parent;
  subgridIndexes;
  isImmovable = true;
  constructor(game, parent, subgrid, oceanIndex, isSmall = false) {
    super(game);
    this.parent = parent;
    this.entityType = "sand";
    let relativeSubgrid = getAbsoluteSubgridIndex(subgrid, this.parent._direction, true);
    let subgridWidth = ROAD_WIDTH / 3;
    let smallSideWidth = ROAD_WIDTH / 4;
    let sizeDiff = subgridWidth - smallSideWidth;
    let parentIndexes = this.parent.gridIndexes;
    let oceanAngle = getSubgridAngle([oceanIndex[0] - parentIndexes[0], oceanIndex[1] - parentIndexes[1]]);
    this.width = !isSmall && oceanAngle % 90 == 0 ? subgridWidth : smallSideWidth;
    this.height = isSmall || this.width == subgridWidth ? smallSideWidth : subgridWidth;
    if (isSmall) {
      //TODO: gerçek offset bulunacak. şu anki değerlerin matematiksel anlamı çok yok
      this.width += Math.floor(sizeDiff / 2 / Math.sqrt(2));
      this.height += Math.floor(sizeDiff / 2 / Math.sqrt(2));
    }
    this.sprite = "sand";
    this.parent.childContainer.addChild(this.sprite);
    let positionX = relativeSubgrid[0] * subgridWidth;
    let positionY = relativeSubgrid[1] * subgridWidth;
    let angleToUse = oceanAngle - parent._direction;
    let angleForVector = -(oceanAngle + parent._direction - 90);
    let angleVector = toVector(angleForVector);
    positionX += sizeDiff * angleVector[0];
    positionY += sizeDiff * angleVector[1];
    this.setPosition(positionX, positionY);
    this.subgridIndexes = relativeSubgrid;
    this.direction = angleToUse;
  }
}
export class MovableEntity extends Entity {
  isCollisionEffected = true;
  isImmovable = false;
  isAutonomous = false;
  entityMoveMultiplier = MOVE_MULTIPLIER;
  _entityDrag = DRAG;
  entityTurnDrag = TURN_DRAG;
  entitySteeringMultiplier = STEERING_MULTIPLIER;
  entityMinAlignment = MIN_ALIGNMENT;
  entityTurnLimiters = [2, 1.25];
  _customMoveLimiter = 1;
  get customMoveLimiter() {
    return this._customMoveLimiter;
  }
  set customMoveLimiter(value) {
    if (value < 0 || value > 1) return;
    return this._customMoveLimiter = value;
  }
  customDragMultiplier = 1;
  _entityMoveLimiter = 1;
  get entityDrag() {
    return this._entityDrag * this.customDragMultiplier;
  }
  set entityDrag(value) {
    return this._entityDrag = value;
  }
  get entityMoveLimiter() {
    return Math.min(this._entityMoveLimiter, this.customMoveLimiter);
  }
  set entityMoveLimiter(value) {
    return this._entityMoveLimiter = value;
  }
  chosenAlgorithms = ["rule", "rule", "rule"];
  tick(dt) {
    this.velX += this.accX * dt;
    this.velY += this.accY * dt;
    let currAlignment = this.getAlignment();
    let absAlignment = Math.abs(currAlignment);
    let nextVelY = this.velY * dt;
    let nextVelX = this.velX * dt;
    this.accX = (nextVelX - this.velX) * this.entityDrag;
    this.accY = (nextVelY - this.velY) * this.entityDrag;
    let posChangeX = this.velX * dt * absAlignment;
    let posChangeY = this.velY * dt * absAlignment;
    this.lastPosX = this.posX;
    this.lastPosY = this.posY;
    this.savedDirection = this.direction;
    this.posX += posChangeX;
    this.posY += posChangeY;
    let newIndexes = getIndexes(this.posX, this.posY, this.anchorX * this.width, this.anchorY * this.height);
    if (!arrayEquals(this.gridIndexes, newIndexes)) {
      let oldIndexes = this.gridIndexes;
      this.gridIndexes = newIndexes;
      this.onIndexChange.forEach((fun) => fun.call(this, oldIndexes, newIndexes));
    }
    let absVel = this.absoluteVel();
    let absAcc = this.absoluteAcc();
    let nextAngle;
    if (absVel == 0) {
      nextAngle = this.lastDirection;
    } else nextAngle = toDegree(Math.atan2(this.velY, this.velX));
    this.sprite.angle = nextAngle;
    if (this._direction != this.sprite.angle) {
      nextAngle = this._direction;
      this.accX *= this.entityTurnDrag;
      this.accY *= this.entityTurnDrag;
      this.sprite.angle = nextAngle;
    } else {
      this._direction = nextAngle;
    }
    if (absVel < 0.01) {
      this.lastDirection = this._direction;
      this.velX = 0;
      this.velY = 0;
    }
    if (absAcc < 0.001) {
      this.accX = 0;
      this.accY = 0;
    }
    if (this.isAutonomous) {
      if (this.tickCounter % this.actionInterval == 0 || this.lastActionType == "goal") {
        let currAction = this.getAction();
        this.lastAction = currAction;
      }
      if (this.lastAction) {
        let updateAction = this.lastAction(dt);
        if (updateAction && this.lastActionType != "goal") {
          let goalAction = this.getGoalAction(this.chosenAlgorithms[2]);
          if (goalAction) goalAction.call(this, dt);
          let nextAction = this.getAction();
          this.lastAction = nextAction ?? this.lastAction;
        }
      }
    }
    let nextColliders = this.getColliders();
    this.fillColor = nextColliders.length == 0 ? 16750848 : 16711680;
    if (nextColliders.length) {
      this.game.globalColliders.add([this, nextColliders]);
    }
    this.lastColliders = nextColliders;
    this.tickCounter++;
    super.tick();
  }
}
export class Car extends MovableEntity {
  recordedData = {
    inputs: [],
    outputs: [],
  };
  isMain = false;
  isUsingBrake = false;
  isAutonomous = true;
  _isWandering = false;
  anchorX = 0.3;
  anchorY = 0.5;
  _fillColor = 16750848;
  drawCollision = false;
  path = [];
  customLine = new PIXI.Graphics();
  lineEnd;
  customLineDrawer;
  goal;
  sensors = [];
  pathAlgorithm = "A*";
  laneMultiplier = 1;
  currentRoad = null;
  isRecording = false;
  isTurning = false;
  lastIsTurning = false;
  lastIsUsingBrake = false;
  isAccelerating = false;
  lastPath;
  allowSteer = false;
  isOverriden = false;
  isWaiting = 0; //0 ise beklemiyor, 1 ise yaya/ışık bekliyor, 2 ise bekleyen birini bekliyor
  dominanceFactor = Math.random(); //buna göre yol verecekler
  patienceFactor = Math.floor(Math.random() * 2000 + 2000); //sabır faktörü, sorun olunca buna göre bekleyecekler
  preventGoal = false;
  massMultiplier = 10;
  canStart = false;
  set isWandering(value) {
    this._isWandering = value;
  }
  get isWandering() {
    return this._isWandering;
  }
  setRecording(value = !this.isRecording) {
    this.isRecording = value;
  }
  recordData() {
    this.setRecording(true);
  }
  switchLane() {
    this.laneMultiplier *= -1;
  }
  addSensor(degree, lengthMultiplier = 1, xOffset = 0, yOffset = 0) {
    let sensor = new Sensor(this.game, degree, this, lengthMultiplier * CAR_WIDTH, xOffset, yOffset);
    this.childContainer.addChild(sensor.graphics);
    this.sensors.push(sensor);
  }
  setPosition(x, y) {
    super.setPosition(x, y);

  }
  isOnCorrectLane() {
    let laneOffset = getLaneOffset(this.getFacingDirection(), this.laneMultiplier, 20);
    let nonZeroAxis = laneOffset[0] === 0 ? 1 : 0;
    let axisDifference = this[nonZeroAxis == 0 ? "posX" : "posY"] - this.currentRoad[nonZeroAxis == 0 ? "posX" : "posY"];
    return Math.sign(axisDifference) === Math.sign(laneOffset[nonZeroAxis]) && Math.abs(axisDifference) > Math.abs(laneOffset[nonZeroAxis]);
  }
  setGoal(x, y) {
    let currentDirection = this.getFacingDirection();
    let fromDirection = getOpposite(currentDirection);
    let currRoad = this.currentRoad;
    if (!currRoad) return;
    let currRoadType = currRoad?.roadType;
    //T şeklindeki yolda karşılıklı olmayan yerden gelen araç için gelinen yöne izin verilmemeli
    let nextDirection = currRoadType == "straight" ? currentDirection :
      getNextDirection(currRoadType, currRoad.direction, fromDirection, null, currentDirection);
    let forcedDirection = DIRECTION_ALTERNATIVE == 1 ? nextDirection : fromDirection;
    let currPath = this.findPathTo(x, y, true, forcedDirection);
    if (currPath) {
      this.setPath(currPath);
    } else {
      if (!IS_DEBUG) return;
      //TODO: bu yolun rengi farklı olmalı
      currPath = this.findPathTo(x, y, true);
      if (currPath) {
        this.setPath(currPath, true);
      }
    }
    if (currPath) this.goal = [x, y];
  }
  getFrontPoint() {
    let BC = this.getLines()[1];
    return [(BC[0][0] + BC[1][0]) / 2, (BC[0][1] + BC[1][1]) / 2];
  }
  findPathTo(x, y, getMinimumDistance, forceInitialDirection) {
    let gridIndexes = getIndexes(x, y);
    let [gridX, gridY] = gridIndexes;
    let gridElement = this.game.map[gridX][gridY];
    let currIndexes = getIndexes(this.posX, this.posY);
    if (!gridElement || gridElement[0] == -1) return false;
    if (gridX == currIndexes[0] && gridY == currIndexes[1]) return false;
    let res = findPath(this.game.map, this.pathAlgorithm, currIndexes, gridIndexes, getMinimumDistance, forceInitialDirection);
    return res;
  };
  setPath(path, isWrongDirection = false) {
    this.path = path;
    this.isWrongDirection = isWrongDirection;
    if (this.isWandering) return;
    let startIndex = drawPath(this.game.roads, path);
    if (startIndex === undefined) return;
    let roadIndexes = this.path.length < 3 ? this.path[this.path.length - 1] : this.path[1];
    let currRoad = this.game.roads[roadIndexes[0]][roadIndexes[1]];
    let lineCoords = currRoad.getHighlightCoordinates(startIndex);
    if (!this.destroyed && this.customLine.strokeStyle.width == 1) this.customLine.setStrokeStyle(highlightStyle);
    this.lineEnd = lineCoords[0];
    this.removeDrawer(this.customLineDrawer);
    this.customLineDrawer = () => {
      this.customLine.clear();
      if (!this.lineEnd) {
        return this.removeGoal();
      }
      let frontPoint = this.getFrontPoint();
      this.customLine.moveTo(frontPoint[0], frontPoint[1]).lineTo(this.lineEnd[0], this.lineEnd[1]).stroke();
    };
    this.addDrawer(this.customLineDrawer);
  }
  removeGoal() {
    this.path = null;
    if (this.customLine && !this.destroyed) this.customLine.clear();
    this.removeDrawer(this.customLineDrawer);
    this.goal = null;
    if (!this.isWandering) clearPath(this.game.roads);
  }
  resetPath() {
    if (this.goal) {
      let goalIndexes = getIndexes(this.goal[0], this.goal[1]);
      if (arrayEquals(this.gridIndexes, goalIndexes)) {
        this.removeGoal();
        return;
      }
      let foundIndex = this.path.findIndex(e => e[0] == this.gridIndexes[0] && e[1] == this.gridIndexes[1]);
      if (foundIndex == -1 && !this.isWandering) {
        return this.setGoal(this.goal[0], this.goal[1]);
      }
      if (foundIndex != -1 || this.isWandering) {
        this.lastPath = this.path[foundIndex - 1] ?? this.lastPath;
      }
      let currPath = foundIndex == -1 ? this.path : this.path.slice(foundIndex);
      this.setPath(currPath);
    }
    if (this.isWandering) {
      if (!this.currentRoad) {
        let foundRoad = this.game.roads.flat().map(e => [e, getMagnitude(this.posX - e.posX, this.posY - e.posY)]).sort((x, y) => x[1] - y[1])[0][0];
        this.goal = foundRoad.gridIndexes;
        this.path = [this.gridIndexes, foundRoad.gridIndexes];
        return;
      }
      let currentDirection = this.getFacingDirection();
      let fromDirection = getOpposite(currentDirection);
      let next = getNextDirection(this.currentRoad.roadType, this.currentRoad._direction, fromDirection);
      let neighbours = getNeighbours(this.gridIndexes);
      let coordinates = neighbours[connectionLookup[next]];
      let path = [this.gridIndexes, coordinates];
      let goal = coordinates;
      let nextRoad = this.game.roads[coordinates[0]]?.[coordinates[1]];
      this.partialPath = [this.gridIndexes, coordinates];
      while (nextRoad) {
        let nextConnections = getConnections(nextRoad.roadType, nextRoad._direction);
        let nextNeighbours = getNeighbours(goal);
        let goalIndex = nextNeighbours[connectionLookup[getRandom(nextConnections)]];
        path.push(goalIndex);
        goal = goalIndex;
        nextRoad = this.game.roads[goal[0]]?.[goal[1]];
      }
      this.path = path;
      this.goal = goal;
    }
  }
  lastActionType = null;
  preventSigns = [];
  resetChanged() {
    this.entityMoveLimiter = 1;
    this.laneMultiplier = 1;
    this.customDragMultiplier = 1;
    this.isWaiting = 0;
    this.sprite.tint = 16777215;
    this.preventSigns = [];
  }
  getAction() {
    if (!this.isOverriden && (this.canStart || !this.isMain)) {
      let threatAction = this.getThreatAction(this.chosenAlgorithms[0]);
      if (threatAction !== null) {
        this.lastActionType = "threat";
        return threatAction;
      }
      let ruleAction = this.getRuleAction(this.chosenAlgorithms[1]);
      if (ruleAction !== null) {
        this.lastActionType = "rule";
        return ruleAction;
      }
    } else if (this.isOverriden && !this.canStart) this.canStart = true;
    //kurallar ve tehditler hızı sınırlayabiliyor, o sınır kaldırılıyor
    this.resetChanged();
    let goalAction = this.getGoalAction(this.chosenAlgorithms[2]);
    if (goalAction !== null) {
      this.lastActionType = "goal";
      if (!this.canStart) this.canStart = true;
      return goalAction;
    }
    return null;
  }
  checkSensor(entityTypes, requiredDistance, sensors = this.sensors.slice(1, 3), checkEvery) {
    //signature mantığı olmadığı için kullanıldığı kısımda okunurluğu arttırmak için değişimi burada yapıyoruz
    if (!Array.isArray(entityTypes)) entityTypes = [entityTypes];
    let foundEntity;
    let foundDistance = Infinity;
    let res = sensors[checkEvery ? "every" : "find"](sensor => {
      if (!sensor) return false;
      let [dist, entity] = sensor.output;
      let cond = entity && dist <= requiredDistance && (entityTypes.includes("any") || entityTypes.includes(entity.entityType));
      if (!cond) return false;
      if (dist < foundDistance) {
        foundDistance = dist || Number.EPSILON;
        foundEntity = entity;
      }
      return true;
    });
    if (!res) return false;
    return [foundDistance, foundEntity];
  }
  checkSign(entityTypes) {
    if (!Array.isArray(entityTypes)) entityTypes = [entityTypes];
    let facingDirection = this.getFacingDirection();
    //haritaya göre değil, araca göre sağ
    let right = connectionArray[(connectionLookup[facingDirection] + 1) % 4];
    let hasAny = entityTypes.includes("any");
    return this.currentRoad && this.currentRoad.obstacles.find(e => {
      let entity = e[0];
      if (entity.isOnRoad) return false;
      if (this.preventSigns.includes(entity) || (!entityTypes.includes(entity.entityType) && !hasAny)) return false;
      let currentPos = [this.posX, this.posY];
      let entityPos = [entity.posX, entity.posY];
      let directionList = getRelativeDirectionList(currentPos, entityPos);
      let dist = getMagnitude(currentPos[0] - entityPos[0], currentPos[1] - entityPos[1]);
      return directionList.includes(right) && dist < ROAD_WIDTH / 3;
    });
  }
  checkCurrent(entityTypes) {
    let found = (this.lastColliders || this.getColliders()).find(e => entityTypes.includes(e.entityType));
    if (!found) return null;
    return [0, found];
  }
  checkThreatCondition() {
    return this.checkSensor(this.isMain || !this.isOnRoad() ? REAL_THREATS : THREATS, 110, this.sensors.slice(0, 5).concat([this.sensors[9], this.sensors[10]]));
  }
  getSensorSums(isDynamic) {
    let xorWith = isDynamic ? 1 : 0;
    let sensors = this.sensors.slice(0, 11).map(e => e.output);
    let increasers = [0, 1 ^ xorWith, -1 ^ xorWith, 3 ^ xorWith, -2 ^ xorWith, -1.5, 1, -1.5, 1, -1, 1];
    let sum = 0;
    let weightedSum = 0;
    sensors.forEach((e, i) => {
      if (e[1] && !NONPHYSICAL_THREATS.includes(e[1].entityType)) {
        sum += increasers[i];
        weightedSum += (i == 0 ? 0 : i % 2 == 0 ? -1 : 1) * (1 - e[0] / CAR_WIDTH / 2); // kendi uzunluklarına göre değil sabit bir değere göre normalleştiriliyorlar çünkü boş mesafe lazım
      } else sum -= increasers[i] / 10;
    });
    return [sum, weightedSum];
  }
  stationaryAt = 0;
  isOnRoad() {
    if (this.currentRoad == null) return false;
    return checkIsOnRoad(this, this.currentRoad);
  }
  frontCounters = [];
  frontCounter = 0;
  dominanceCounters = [];
  sumCounters = [];
  sumCounter = 0;
  #threatAction(dt) {
    if (!this.checkThreatCondition()) return true;
    let now = Date.now();
    let sensors = this.sensors.slice(0, 11).map(e => e.output);
    let back = this.sensors.slice(-2).map(e => e.output);
    let conditionFirst = sensors[1][1] && (sensors[1][1].entityType == "road" ? sensors[1][0] < 40 : sensors[1][0] < 100 && REAL_THREATS.includes(sensors[1][1].entityType));
    let conditionSecond = sensors[2][1] && (sensors[2][1].entityType == "road" ? sensors[2][0] < 40 : sensors[2][0] < 100 && REAL_THREATS.includes(sensors[2][1].entityType));
    let mainTriggered = conditionFirst || conditionSecond;
    let bothTriggereed = conditionFirst && conditionSecond;
    //sağ veya sol sensörlerin tamamını araçlar kaplıyorsa o yöne gidilmemeli
    //yavaşlamanın koşulları arttırılmalı
    let isOnRoad = this.isOnRoad();
    let threatsToUse = isOnRoad ? REAL_THREATS : THREATS;
    let angleDifference = this.getGoalAngle();
    //ön yandaki sensörler 9 ve 10. indis
    let frontSensors = sensors.slice(0, 5).concat([sensors[9], sensors[10]]);
    let mainBlockedByCar = sensors.slice(0, 5).find(e => e[0] < 40 && e[1].entityType == "car");
    let frontTriggered = frontSensors.filter(e => e[1] && !NONPHYSICAL_THREATS.includes(e[1].entityType));
    let threatCars = sensors.filter((e, i) => e[1] && e[1].entityType == "car");
    let dominanceFactors = threatCars.map(e => e[1].dominanceFactor);
    let hasDynamicThreat = threatCars.length > 0 || sensors.find(e => e[1] && e[1].entityType == "pedestrian");
    let leftIsFullyDynamic = [sensors[5], sensors[7], sensors[9]].filter(e => e[1] && e[1].entityType == "car" && e[0] < 50).length >= 2;
    let rightIsFullyDynamic = [sensors[6], sensors[8], sensors[10]].filter(e => e[1] && e[1].entityType == "car" && e[0] < 50).length >= 2;
    //üst üste threatAction olması durumunda 2 saniyelik veri
    let index = this.frontCounter++ % (Math.floor(1 / this.game.gameTick) * 2);
    this.frontCounters[index] = mainTriggered;
    let carIsComing = threatCars.length > 0;
    let otherCar;
    let directionAlignment = 0;
    if (carIsComing) {
      carIsComing = threatCars.find(otherCar => {
        //let speedAlignment = dotProduct(toUnitVector([this.velX,this.velY]),toUnitVector([otherCar.velX,otherCar.velY]))
        directionAlignment = dotProduct(toVector(this.direction), toUnitVector([otherCar.velX, otherCar.velY]));
        return directionAlignment < -0.5;
      });
    }
    let absVelocity = this.absoluteVel();
    let allNonPhysical = sensors.every(e => !e[1] || !threatsToUse.includes(e[1].entityType));
    let frontCloseness = Math.floor(frontSensors.map(e => {
      let isProblematic = e[1] && threatsToUse.includes(e[1].entityType);
      return !isProblematic ? 0 : Math.max(10, 50 - e[0]);
    }).reduce((x, y) => x + y, 0));
    let frontPossibleness = Math.floor(frontSensors.map(e => {
      let isPossible = e[0] > 40 && (!e[1] || !threatsToUse.includes(e[1].entityType));
      return isPossible ? Math.max(5, e[0] - 40) : 0;
    }).reduce((x, y) => x + y));
    if (absVelocity > 16 && !this.isGoingBackwards()) this.stationaryAt = now;
    let waitingFor = now - this.stationaryAt;
    let frontImpossibility = sensors.map(e => e[1] && threatsToUse.includes(e[1].entityType) ? e[0] < 25 ? 25 - e[0] : 0 : 0).reduce((x, y) => x + y) * 3 + (this.lastColliders?.filter(e => e.entityType == "car").length || 0) * 25;
    // nesnenin random sabır süresi kadar ms bekledikten sonra yavaş yavaş agresiflik artıyor
    let frontUsability = frontPossibleness - frontCloseness * 1.3 - frontImpossibility + Math.max(0, (waitingFor - this.patienceFactor) / 10);
    let hasDominance = this.dominanceFactor == Math.max(this.dominanceFactor, ...dominanceFactors) || frontUsability > 70;
    this.dominanceCounters[index] = hasDominance;
    hasDominance &&= this.dominanceCounters.filter(e => e).length > 100;
    //bekleme değeri normalde 0, ışık ve yaya geçidinde 1
    //ışıkta veya yaya geçidindeki aracı görenlerin ise 2+
    //2+ olanların isWaiting'te kalması için kendilerinden düşük ancak 0 olmayan isWaiting değerine sahip araç bulmalılar
    this.isWaiting = threatCars.find(e => e[0] < 75 && e[1].isWaiting != 0 && e[1].isWaiting < 4 && (this.isWaiting == 0 || e[1].isWaiting < this.isWaiting))?.[1].isWaiting || 0;
    if (this.isWaiting) {
      this.isWaiting++;
      return this.isMain;
    }
    let frontCounterAmount = this.frontCounters.filter(e => e).length;
    if ((frontCounterAmount > 30 || frontCounterAmount / this.frontCounters.length > 0.9) || mainTriggered || absVelocity < 1 || this.isGoingBackwards() || waitingFor > 3000) {
      //aniden geri gitmemesi için ya zaten geriye giderken ya da hızı çok düşükken geri gitmeye başlıyor
      let backFreenes = back.map(e => e[0] > 20 || e[1] == null || (!THREATS.includes(e[1].entityType)));
      let backSensorsFree = backFreenes.every(e => e);
      let freeBack = backFreenes.findIndex(e => e);
      let canAct = (hasDominance || !hasDynamicThreat);
      if (mainBlockedByCar || ((backSensorsFree || freeBack != -1) && ((frontUsability < -30 || frontTriggered.length > 1) && ((now - this.stationaryAt > 400) || frontTriggered.length > 2)) && (this.getAlignment() <= 0 || absVelocity < 10))) {
        let [sum, weightedSum] = this.getSensorSums();
        let sumSign = Math.abs(sum) < 1 ? 0 : Math.sign(sum);
        //araç/tehdit yaklaşmıyorsa en erken 0.2 saniye sonra geri gidebiliyor
        //if(frontTriggered.length>0&&((now-this.stationaryAt>200)&&(backSensorsFree||freeBack!=-1))){
        if (IS_DEBUG) this.sprite.tint = 65280;
        this.entityMoveLimiter = 1;
        this.moveBackward(dt);
        let currentSteeringMultiplier = backSensorsFree ? -sumSign * 1.5 : freeBack == 0 ? -2 : 2;
        this.steer(dt, currentSteeringMultiplier, true);
        return;
        //ya hemen önünde nesne olmadığında ya da araç olduğunda
        //ikisi beraberken çalışmamalı ki ileri gitmesin
        //xor
      } else if (frontImpossibility < 100 != hasDynamicThreat && !mainBlockedByCar) {
        let [sum, weightedSum] = this.getSensorSums(hasDynamicThreat);
        this.sumCounters[this.sumCounter++ % 5] = [sum, now];
        let lastSums = sum || this.sumCounters.filter(e => now - e[1] < 100).map(e => e[0]).reduce((x, y) => x + Math.sign(y)); /*büyüklüklüklerini hesaba katınca aynı yöne dönüyor*/
        if (typeof angleDifference == "number") lastSums += Math.sign(angleDifference);
        let sumSign = Math.sign(lastSums);
        if (IS_DEBUG) this.sprite.tint = 10066329;
        let minimum = this.isWaiting ? 0 : frontUsability < -30 ? frontUsability > 10 && !bothTriggereed ? 0.6 : 0 : 0.6;
        this.entityMoveLimiter = Math.max(minimum, this.entityMoveLimiter - this.absoluteVel() / 100);
        if (canAct) {
          this.moveForward(dt);
        }
        if (!canAct || this.entityMoveLimiter == 0) this.brake(dt);
        if (sumSign != this.laneMultiplier) {
          if (!allNonPhysical) this.switchLane();
        }
        this.steer(dt, sumSign * 1.3);
        return this.isMain;
      } else {
        this.entityMoveLimiter = 0.7;
        if (frontImpossibility > 30 || hasDynamicThreat) this.brake(dt);
        if (frontImpossibility <= 50 && !mainBlockedByCar) {
          let [sum] = this.getSensorSums(hasDynamicThreat);
          let sumSign = Math.sign(sum);
          this.steer(dt, sumSign * 1.3);
        }
        if (IS_DEBUG) this.sprite.tint = 3355443;
        return true;
      }
    } else {
      if (IS_DEBUG) this.sprite.tint = 16777215;
      this.entityMoveLimiter = 1;
      if (allNonPhysical) this.resetChanged();
      return true;
    }

  }
  getThreatAction(chosenAlgorithm) {
    if (chosenAlgorithm == "rule") {
      if (this.checkPedThreatCondition()) {
        return this.#pedAction;
      }
      if (this.checkThreatCondition()) {
        return this.#threatAction;
      }
    } else {
    }
    return null;
  }
  checkLaneCondition() {
    return this.checkSensor("road", 20, [this.sensors[8], this.sensors[10]], true);
  }
  checkLightCondition() {
    let res = this.checkSensor("light", 100);
    if (res && res[1].state != LIGHT_STATES[2]) return res;
    return false;
  }
  #lightAction(dt) {
    let res = this.checkLightCondition();
    if (!res) {
      this.entityMoveLimiter = 1;
      return true;
    }
    let [dist, light] = res;
    if ((light.state == LIGHT_STATES[0] && dist < 60) || (light.state == LIGHT_STATES[1] && dist >= 40)) {
      this.entityMoveLimiter *= 0.5;
      this.brake(dt);
      this.isWaiting = 1;
    } else this.isWaiting = 0;
    if (light.state == LIGHT_STATES[1]) {
      this.entityMoveLimiter = Math.max(0.3, this.entityMoveLimiter * 0.9);
      this.allowSteer = true;
      this.isWaiting = 1;
    }
    return true;
  }
  checkBumpCondition() {
    return this.checkSensor("kasis", 40);
  }
  #bumpAction(dt) {
    let res = this.checkBumpCondition();
    if (!res) {
      if (this.entityMoveLimiter > 0.8) {
        this.entityMoveLimiter = 1;
        return true;
      }
      this.entityMoveLimiter = (1 + this.entityMoveLimiter) / 2;
    }
    this.entityMoveLimiter = Math.max(0.3, this.entityMoveLimiter - this.absoluteVel() / 100);
    return true;
  }
  checkSpeedCondition() {
    return this.checkSign(["hizSiniriLevha", "hizKaldirmaLevha", "kasisLevha", "yayaGecidi"]);
  }
  #speedAction(dt) {
    let res = this.checkSpeedCondition();
    if (!res) return true;
    let entity = res[0];
    let entityType = entity.entityType;
    if (entityType == "hizSiniriLevha") {
      //bu sınırlayıcı kendisi sıfırlanmıyor
      this.customMoveLimiter = 0.83;
    } else if (entityType == "kasisLevha" || entityType == "yayaGecidi") {
      this.entityMoveLimiter = 0.83;
    } else if (entityType == "hizKaldirmaLevha") {
      this.customMoveLimiter = 1;
    }
    this.preventSigns.push(entity);
    return true;
  }
  checkPedThreatCondition() {
    return this.checkSensor("pedestrian", 150) || this.checkCurrent("pedestrian");
  }
  checkPedRuleCondition() {
    return this.checkSensor("yayaGecidi", 100) || this.checkCurrent("yayaGecidi");
  }
  #pedAction(dt) {
    let res = this.checkSensor(["yayaGecidi", "pedestrian"], 120);
    if (!res) {
      this.resetChanged();
      return true;
    }
    let [dist, entity] = res;
    if (entity.entityType == "pedestrian" || (entity.entityType == "yayaGecidi" && entity.pedestrians.find(e => e.state == "passing"))) {
      this.entityMoveLimiter /= 2;
      this.brake(dt);
      this.isWaiting = 1;
    } else {
      this.entityMoveLimiter = 1;
      this.isWaiting = 0;
    }
    return true;
  }
  checkPuddleCondition() {
    return this.checkSensor("puddle", 20, this.sensors.slice(0, 5));
  }
  #puddleAction(dt) {
    let res = this.checkPuddleCondition();
    if (!res) return true;
    //sensörle varlığına bakıyoruz ama yalnızca birikintinin üzerindeyse sürtünmeyi düşürüyoruz
    let isOnPuddle = this.lastColliders?.find(e => e.entityType == "puddle");
    this.customDragMultiplier = isOnPuddle ? 0.65 : 1;
    this.entityMoveLimiter = 0.5;
    return true;
  }
  checkStopCondition() {
    return this.checkSign("stopLevha");
  }
  #stopAction(dt) {
    let res = this.checkStopCondition();
    if (!res) return true;
    let vel = this.absoluteVel();
    if (vel < 10) {
      this.preventSigns.push(res[0]);
      this.isWaiting = 0;
      return true;
    } else {
      this.entityMoveLimiter = 0;
      this.brake(dt);
      this.isWaiting = 1;
    }
  }
  getRuleAction(chosenAlgorithm) {
    if (chosenAlgorithm == "rule") {
      if (this.checkPedRuleCondition()) {
        return this.#pedAction;
      }
      //if(this.isMain&&this.checkLaneCondition()){
      //  return this.#laneAction
      //}
      if (this.checkLightCondition()) {
        return this.#lightAction;
      }
      if (this.checkBumpCondition()) {
        return this.#bumpAction;
      }
      if (this.checkSpeedCondition()) {
        return this.#speedAction;
      }
      if (this.checkPuddleCondition()) {
        return this.#puddleAction;
      }
      if (this.checkStopCondition()) {
        return this.#stopAction;
      }
    }
    return null;
  }
  getGoalAction(chosenAlgorithm) {
    if (this.preventGoal) return null;
    if (this.isWandering || this.path && this.path.length > 0) {
      return this.#goalAction;
    }
    return null;
  }
  getGoalAngle() {
    if (!this.path || this.path.length < 2 || !this.goal) {
      if (this.isWandering) {
        this.goal = null;
        this.resetPath();
        if (!this.path || !this.path[1]) return;
      } else return;
    }
    if (this.isWandering) this.lastActionType = "wander";
    if (!arrayEquals(this.path[0], this.gridIndexes)) {
      this.resetPath();
      if (!this.path || this.path.length == 0) return this.isWandering;
    }
    let currCoords = getCoordinates(this.gridIndexes[0], this.gridIndexes[1]);
    //sol üstten başlıyor
    let relativeToCurr = [this.posX - currCoords[0] - ROAD_WIDTH / 2, this.posY - currCoords[1] - ROAD_WIDTH / 2];
    let distanceToNext = getDistance([this.posX, this.posY], getCoordinates(this.path[1][0], this.path[1][1]));
    //şerit ihlalini engellemiyor, istenen şeride yakın gidiyor. değiştirilecek
    let facingDirection = this.getFacingDirection();
    let relativeDirection = getRelativeDirection(this.path[0], this.path[1]);
    let goalDirection = getRelativeDirection(this.path[1], this.path[0]);
    let nextStart = this.path.length > 2 ? this.path[1] : this.path[0];
    let nextEnd = this.path.length > 2 ? this.path[2] : this.path[1];
    let nextDirection = getRelativeDirection(nextEnd, nextStart);
    let lastDirection = this.lastPath ? getRelativeDirection(this.path[0], this.lastPath) : facingDirection;
    let relativeTurningDirection = connectionArray[(connectionLookup[goalDirection] - connectionLookup[lastDirection] + 4) % 4];
    let isTurning = lastDirection != goalDirection;
    let isNowTurning = facingDirection != goalDirection;
    const THRESHOLD = ROAD_WIDTH / 4;
    let hasPassedStart = !isTurning || (!relativeToCurr.find(e => Math.abs(e / THRESHOLD) > 3));
    let roadDistanceMultiplier = isTurning ? 1 : 1.04;
    if (relativeTurningDirection == "left") roadDistanceMultiplier -= 0.3;
    let hasCompletedCurrentRoad = distanceToNext < ROAD_WIDTH * roadDistanceMultiplier;
    let midGoal = [(this.path[0][0] * 0.8 + this.path[1][0] * 0.2), (this.path[0][1] * 0.8 + this.path[1][1] * 0.2)];
    let useCurrent = isTurning && !hasCompletedCurrentRoad;
    let currGoal = useCurrent ? midGoal : this.path[1];
    let currentMultiplier = this.laneMultiplier;
    let currentDivider = relativeTurningDirection == "right" || useCurrent ? 10 : 8;
    let directionToUse = (isTurning && !hasCompletedCurrentRoad) ? lastDirection : relativeDirection;
    let [targetX, targetY] = getLaneCoordinates(directionToUse, currGoal, currentMultiplier, currentDivider);
    let dx = targetX - this.posX;
    let dy = targetY - this.posY;
    let angleToTarget = toDegree(Math.atan2(dy, dx)); // Hedef açısı
    let angleDifference = getNormalizedAngle(angleToTarget - this._direction);
    return angleDifference;
  }
  #goalAction(dt) {
    let angleResult = this.getGoalAngle();
    if (typeof angleResult === "boolean") return angleResult;
    let angleDifference = angleResult;
    if (angleDifference > 180) {
      angleDifference -= 360;
    }
    let steeringMultiplier = 1.2;
    if (Math.abs(angleDifference) > 2) {
      steeringMultiplier *= Math.sign(angleDifference);
      this.steer(dt, steeringMultiplier);
    }
    this.moveForward(dt);
  }
  setVehicleProperties() {
    let currentProperties = calculateVehicleProperties(this.currentRoad?.roadCondition || "asphalt", this.isTurning, this.isUsingBrake);
    let { acceleration, drag, turnDrag, steering, turnLimiters, alignment } = currentProperties;
    this.entityMoveMultiplier = acceleration;
    this.entityDrag = drag;
    this.entityTurnDrag = turnDrag;
    this.entitySteeringMultiplier = steering;
    this.entityTurnLimiters = turnLimiters;
    this.entityMinAlignment = alignment;
  }
  tick(dt) {
    super.tick(dt);
    let nextColliders = this.getColliders();
    this.fillColor = nextColliders.length == 0 ? 16750848 : 16711680;
    this.lastColliders = nextColliders;
    if (this.isRecording) {
      if (this.goal) {
        let relativeGoal = [
          (this.goal[0] - this.posX) / GRID_WIDTH,
          (this.goal[1] - this.posY) / GRID_HEIGHT,
        ];
        let relativePathCoords = this.path[1] || this.path[0];
        let relativeDirection = getRelativeDirection(this.path.length > 1 ? this.path[0] : this.gridIndexes, relativePathCoords);
        let relativePath = getLaneCoordinates(relativeDirection, relativePathCoords, this.laneMultiplier);
        relativePath = [
          (relativePath[0] - this.posX) / ROAD_WIDTH,
          (relativePath[1] - this.posY) / ROAD_WIDTH,
        ];
        const velocity = [
          this.velX / MOVE_MULTIPLIER,
          this.velY / MOVE_MULTIPLIER,
        ];
        let input = [...this.sensors.map(e => e.output[0] / this.width), ...relativeGoal, ...relativePath, ...velocity,];
        let output = [
          this.getAlignment() < 0 ? -1 : 1,
          this.isUsingBrake ? -1 : 1,
        ];
        this.recordedData.inputs.push(input);
        this.recordedData.outputs.push([this.lastActionType, output]);
      }
    }
    if (this.lastIsTurning != this.isTurning || this.lastIsUsingBrake != this.isUsingBrake) {
      this.setVehicleProperties();
    }
    this.lastIsUsingBrake = this.isUsingBrake;
    this.isUsingBrake = false;
    this.lastIsTurning = this.isTurning;
    this.isTurning = false;
    this.isAccelerating = false;
    this.allowSteer = false;
    this.isOverriden = false;
  }
  accelerate(dt = 1, scale = 1, setOverride = false) {
    if (setOverride) this.isOverriden = true;
    if (this.isAccelerating) return;
    let degree = this._direction;
    let radian = toRadian(degree);
    this.accX += Math.cos(radian) * this.entityMoveMultiplier * this.entityMoveLimiter * scale * dt;
    this.accY += Math.sin(radian) * this.entityMoveMultiplier * this.entityMoveLimiter * scale * dt;
    this.isAccelerating = true;
  }
  moveForward(dt = 1, scale = 1, setOverride = false) {
    // scale 0-1.0 arasında, ivmelenme kontrolünde lazım olacak
    this.accelerate(dt * 1000, scale, setOverride);
  }
  // Geri hareket fonksiyonu
  moveBackward(dt = 1, scale = 1, setOverride = false) {
    this.accelerate(dt * 1000, -scale / 2, setOverride);
  }
  isGoingBackwards(alignment = this.getAlignment()) {
    return alignment < 0;
  }
  steer(dt, angle, setOverride = false) {
    if (setOverride) this.isOverriden = true;
    let currentMultiplier = this.entitySteeringMultiplier;
    let alignment = this.getAlignment();
    let isGoingBackwards = this.isGoingBackwards(alignment);
    if (!this.allowSteer && Math.abs(alignment) < ((this.entityMinAlignment / this.absoluteVel()) * this.entityMoveMultiplier) / ((isGoingBackwards ? this.entityTurnLimiters[0] : this.entityTurnLimiters[1]) + (this.isUsingBrake ? 2 : 0))) return;
    this.isTurning = true;
    currentMultiplier *= dt * 100;
    if (this.isUsingBrake) {
      currentMultiplier *= 0.5;
    }
    if (isGoingBackwards) {
      currentMultiplier *= -0.7; // - yön için, 0.7 daha az dönmesi için
    }
    this.direction += angle * currentMultiplier;
  }
  steerLeft(dt, setOverride = false) {
    this.steer(dt, -1, setOverride);
  }
  steerRight(dt, setOverride = false) {
    this.steer(dt, 1, setOverride);
  }
  brake(dt) {
    this.accX *= 0.999 ** (dt * 100);
    this.accY *= 0.999 ** (dt * 100);
    this.velX *= 0.9 ** (dt * 100);
    this.velY *= 0.9 ** (dt * 100);
    this.isUsingBrake = true;
  }
  destroy() {
    super.destroy();
    this.shouldDraw = false;
    this.drawCollision = false;
    this.removeDrawer(this.customLineDrawer);
    this.customLine.destroy();
    this.sensors.forEach(e => e.destroy());
    this.game.cars.splice(this.game.cars.indexOf(this), 1);
  }
  setPosition(x, y) {
    super.setPosition(x, y);
    this.setRoad();
    this.setVehicleProperties();
  }
  setRoad() {
    let currRoad = this.game.roads[this.gridIndexes[0]]?.[this.gridIndexes[1]];
    if (!currRoad) currRoad = null;
    this.currentRoad = currRoad;
  }
  constructor(game, spritePath, createGraphics = false) {
    super(game);
    let chosenCar;
    if (!spritePath) {
      chosenCar = getRandom(CAR_SPRITES);
      spritePath = chosenCar[0];
    }
    else chosenCar = CAR_SPRITES.find(e => e[0] == spritePath);
    this.directionOffset = chosenCar[1] ? 90 : 0;
    this.anchorX = chosenCar[2];
    this.setVehicleProperties();
    this.onIndexChange.push(this.setRoad);
    this.onIndexChange.push(this.resetPath);
    this.onIndexChange.push(this.setVehicleProperties);
    this.childGraphics.push(this.customLine);
    this.width = CAR_WIDTH * chosenCar[3];
    this.createGraphics = createGraphics;
    this.drawBounds = createGraphics;
    this.sprite = spritePath;
    this.entityType = "car";
    this.addSensor(-this.directionOffset, 2, 10);
    this.addSensor(-this.directionOffset - 10, 2, 10);
    this.addSensor(-this.directionOffset + 10, 2, 10);
    this.addSensor(-this.directionOffset - 25, 1.8, 10);
    this.addSensor(-this.directionOffset + 25, 1.8, 10);
    for (let i = 0; i < 3; i++) {
      this.addSensor(this.directionOffset - 90 - i * 10, 0.7, i * 10);
      this.addSensor(this.directionOffset + 90 + i * 10, 0.7, i * 10);
    }
    this.addSensor(this.directionOffset - 10, 0.7);
    this.addSensor(this.directionOffset + 10, 0.7);
    this.game.cars.push(this);
  }
}
export class MainCar extends Car {
  isMain = true;
  dominanceFactor = 0.5;
  constructor(game, spritePath) {
    super(game, spritePath, true);
  }
}
export class Road extends Entity {
  anchorX = 0.5;
  anchorY = 0.5;
  obstacles = [];
  roadCondition;
  recursionIndex = 0;
  #alignObstacles() {
    return this.obstacles.forEach(e => e.setRelativePosition());
  }
  setDirection(val) {
    super.setDirection(val);
    this.#alignObstacles();
  }
  getGrids() {
    let currentGridsArray = [this.gridIndexes];
    this.currentGridsArray = currentGridsArray;
    return new Set(currentGridsArray);
  }
  getLines() {
    if (this.cachedLines) return this.cachedLines;
    const GREEN = 50;
    const ROAD = 50;
    const RATIO = GREEN / (GREEN + ROAD) / 2;
    let res = super.getLines();
    let mapped = res.map((e, i) => e.map((e, j) => e.map((e, q) => e * (1 - RATIO) + res[(i + 2) % 4][1 - j][q] * RATIO)));
    let retVal = [];
    let length = this.width || getMagnitude(res[0][0][0] - res[0][1][0], res[0][0][1] - res[0][1][1]);
    let lineLength = length * RATIO;
    switch (this.roadType) {
      case "straight": {
        retVal.push(mapped[1], mapped[3]);
      }
        break;
      case "4": {
        for (let i = 0; i < mapped.length; i++) {
          let e = mapped[i];
          let angle = Math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]);
          let first = [
            e[0],
            [
              e[0][0] + lineLength * Math.cos(angle),
              e[0][1] + lineLength * Math.sin(angle),
            ],
          ];
          let second = [
            e[1],
            [
              e[1][0] - lineLength * Math.cos(angle),
              e[1][1] - lineLength * Math.sin(angle),
            ],
          ];
          retVal.push(first);
          retVal.push(second);
        }
      }
        break;
      case "3": {
        retVal.push(mapped[2]);
        for (let i = 0; i < mapped.length; i++) {
          if (i == 2) continue; // 2; _|_ şeklindeki yolda __ olan kısım, CD kenarı
          let e = mapped[i];
          let angle = Math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]);
          //çizginin ilk çeyreği
          let first = [
            e[0],
            [
              e[0][0] + lineLength * Math.cos(angle),
              e[0][1] + lineLength * Math.sin(angle),
            ],
          ];
          //çizginin son çeyreği, noktaların sırası önemli değil
          let last = [
            e[1],
            [
              e[1][0] - lineLength * Math.cos(angle),
              e[1][1] - lineLength * Math.sin(angle),
            ],
          ];
          /*
                1) AB kenarında yolun sol kısmı, BC kenarında yolun üst kısmı
                2) DA kenarında yolun üst kısmı, AB kenarında yolun sağ kısmı
                için
    
                Birinde 0 ve 1, diğerinde 0 ve 3 olmasının sebebi kenarlarda ilk olanın kenarların isimlendirme sırasına göre belirlenmesi
                ve bunun karşılıklı kenarlarda ters olması
    
              */
          if (i == 0 || i == 1) retVal.push(first);
          if (i == 0 || i == 3) retVal.push(last);
        }
      }
        break;
      case "rightcurve": {
        for (let i = 0; i < mapped.length; i++) {
          let currLineLength = i == 0 || i == 3 ? lineLength * 2 : lineLength;
          //0 ve 3, dönemeçin dışta kalan kısımları
          let e = mapped[i];
          let angle = Math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]);
          let first = [
            e[0],
            [
              e[0][0] + currLineLength * Math.cos(angle),
              e[0][1] + currLineLength * Math.sin(angle),
            ],
          ];
          let second = [
            e[1],
            [
              e[1][0] - currLineLength * Math.cos(angle),
              e[1][1] - currLineLength * Math.sin(angle),
            ],
          ];
          /*
              Kısa çizgiler:
                1) CD kenarında sağ kısım
                2) BC kenarında alt kısım
              Uzun çizgiler:
                1) AB kenarı sağ kısım
                2) DA kenarı alt kısım
              */
          if (i == 2 || i == 3) retVal.push(first);
          if (i == 1 || i == 0) retVal.push(second);
        }
        let remaining = LINE_AMOUNTS[this.roadType] - 4;
        let centerX = this.posX;
        let centerY = this.posY;
        let offset = -this.direction;
        let offsetRad = toRadian(offset);
        let angleIndex = this.getAngleIndex();
        let sign = [-1, 1, -1, 1][angleIndex];
        let last = [
          centerX + sign * lineLength * Math.cos(offsetRad),
          centerY + sign * lineLength * Math.sin(offsetRad),
        ];
        let deltaDeg = 90 / (remaining - 1);
        let deltaRad = toRadian(deltaDeg);
        for (let i = 1; i < remaining; i++) {
          let curr = [
            centerX + sign * lineLength * Math.cos(offsetRad + deltaRad * i),
            centerY + sign * lineLength * Math.sin(offsetRad + deltaRad * i),
          ];
          retVal.push([last, curr]);
          last = curr;
        }
      }
    }
    return (this.cachedLines = retVal);
  }
  highlightContainer;
  highlightLines;
  highlightToggles;
  getHighlightCoordinates(index) {
    let currentAngle = connectionLookup[getConnections(this.roadType, this._direction)[index]] * 90 - 90; //sistem 0 dereceyi kuzey alıyor ama normalde doğu olmalı, o yüzden -90
    return [
      [this.posX, this.posY],
      [
        this.posX + (ROAD_WIDTH / 2) * Math.cos(toRadian(currentAngle)),
        this.posY + (ROAD_WIDTH / 2) * Math.sin(toRadian(currentAngle)),
      ],
    ];
  }
  drawHighlight(index) {
    let coords = this.getHighlightCoordinates(index);
    let [startX, startY] = coords[0];
    let [endX, endY] = coords[1];
    this.highlightLines[index].moveTo(startX, startY).lineTo(endX, endY).stroke();
  }
  toggleHighlight(index, value = !this.highlightToggles[index]) {
    if (!this.highlightContainer) {
      this.highlightContainer = new PIXI.Container();
      app.stage.addChild(this.highlightContainer);
    }
    let curr = this.highlightLines[index];
    if (curr && curr.destroyed) return;
    if (!curr) {
      this.highlightLines[index] = new PIXI.Graphics();
      curr = this.highlightLines[index];
      this.highlightContainer.addChild(curr);
      curr.setStrokeStyle(highlightStyle);
      curr.zIndex = this.zIndex + 1;
      this.drawHighlight(index);
    }
    this.highlightToggles[index] = value;
    this.highlightLines[index].visible = value;
  }
  destroy() {
    super.destroy();
    this.highlightLines.forEach(e => e && e.destroy());
  }
  constructor(game, roadType, directionOffset, direction, roadCondition, recursionIndex) {
    super(game);
    let spritePath = TYPE_TO_IMAGE[roadCondition][roadType];
    this.roadCondition = roadCondition;
    this.entityType = "road";
    this.zIndex = 0;
    this.drawCollision = IS_DEBUG;
    this.createGraphics = true;
    this.forceSquare = true;
    this.width = ROAD_WIDTH;
    this.directionOffset = directionOffset;
    this.direction = direction;
    this.roadType = roadType;
    this.collisionLineAmount = LINE_AMOUNTS[this.roadType] || 4;
    this.sprite = spritePath;
    this.roadAmount = ROAD_TYPES[this.roadType].length;
    this.highlightToggles = Array(this.roadAmount).fill(false);
    this.highlightLines = Array(this.roadAmount).fill();
    this.recursionIndex = recursionIndex;
  }
}
export class Pedestrian extends MovableEntity {
  rangeStart;
  rangeEnd;
  parent;
  state = "waiting";
  counter = 0;
  anchorX = 0.5;
  anchorY = 0.5;
  startingFromInitial;
  tryDirectionCounter = 0;
  lastAngleMultiplier = 1;
  passingStartedAt = 0;
  getAlignment() {
    return 1;
  }
  replenish() {
    this.parent.addPedestrian(1, this.startingFromInitial != (this.counter % 2 == 1));
    this.destroy();
  }
  tick(dt) {
    if (this.destroyed) return;
    if (this.state == "turning") {
      let startAngle = this.parent._direction;
      let goalAngle = startAngle + (this.counter % 2 == 0 ? 90 : 270);
      let diff = getNormalizedAngle(this.direction - goalAngle);
      this.direction += Math.sign(diff);
      if (Math.abs(diff) < 3) {
        if (Math.round(Math.random()) == 1) {
          this.direction = goalAngle;
          this.state = "waiting";
        } else {
          //%50 ihtimalle ölüyor, ölmezse dönüp yeniden geçiyor
          //yeni gelecek olanı aynı yere koyuyoruz 
          //(başladığı yerde değil) XOR (başlangıç noktasından başlar)
          this.replenish();
        }
      }
    }
    if (this.state == "waiting") {
      //her frame düşük şansı olunca bir süre durup geçmeye başlamış oluyor
      let currentPlace = this.counter % 2 == 1 ? this.rangeEnd : this.rangeStart;
      let distanceVector = [currentPlace[0] - this.posX, currentPlace[1] - this.posY];
      let remaining = getMagnitude(distanceVector[0], distanceVector[1]);
      let remainingRatio = remaining / this.parent.width;
      //güncel konumdan bir sebeple uzaklaşıldıysa bir oranda geri dönecek
      if (remainingRatio > 0.03) {
        let speed = 100;
        let directionVector = toUnitVector(distanceVector);
        let nonDirectionalSpeed = speed * dt * PEDESTRIAN_MOVE_MULTIPLIER;
        this.velX = directionVector[0] * nonDirectionalSpeed;
        this.velY = directionVector[1] * nonDirectionalSpeed;
      }
      if (Math.random() * 2000 < 1) {
        this.state = "passing";
        this.passingStartedAt = this.tickCounter;
      }
    }
    if (this.state == "passing") {
      let currentGoal = this.counter % 2 == 0 ? this.rangeEnd : this.rangeStart;
      let distanceVector = [currentGoal[0] - this.posX, currentGoal[1] - this.posY];
      let remaining = getMagnitude(distanceVector[0], distanceVector[1]);
      let remainingRatio = remaining / this.parent.width;
      let speed = 100;
      let directionVector = toUnitVector(distanceVector);
      let gridIndexes = getIndexes(this.posX, this.posY);
      let carsInGrid = Array.from(this.game.gridEntitySets[gridIndexes[0]]?.[gridIndexes[1]] || []).filter(e => e.entityType == "car");
      if (!this.isCollisionEffected || !carsInGrid.find(e => e.absoluteVel() > 3)) {
        let nonDirectionalSpeed = speed * dt * PEDESTRIAN_MOVE_MULTIPLIER;
        this.velX = directionVector[0] * nonDirectionalSpeed;
        this.velY = directionVector[1] * nonDirectionalSpeed;
        //önünde araç varsa konumu az değişecek, konumu az değişirse kendisine göre sağa veya sola gitsin
        let effectiveSpeed = getMagnitude(this.posX - this.lastPosX, this.posY - this.lastPosY);
        if (effectiveSpeed < 0.1) { // yola göre yaya hızı değişmiyor, normal konum değişimleri 0.23-0.24 gibi
          if (this.tryDirectionCounter < 3) {
            //+= ile fazla birikebiliyor
            this.tryDirectionCounter = 30;
            //rastgele yön denenmesi ama üst üste aynısının kullanılması için
            this.lastAngleMultiplier = Math.round(Math.random()) ? 1 : -1;
          }
        }
        let passedTickCount = this.tickCounter - this.passingStartedAt;
        if (passedTickCount > 1000) {
          //karşıdan karşıya geçmesi bu kadar sürmemeli
          this.isCollisionEffected = false;
        }
        if (this.tryDirectionCounter > 0) {
          this.tryDirectionCounter--;
          let pedDirection = toVector(this.direction - 90 * this.lastAngleMultiplier);
          nonDirectionalSpeed += Math.min(20, passedTickCount / 10) * dt * PEDESTRIAN_MOVE_MULTIPLIER;
          this.velX += nonDirectionalSpeed * pedDirection[0] * 2;
          this.velY += nonDirectionalSpeed * pedDirection[1] * 2;
        }
        if (remainingRatio < 0.03) {
          this.state = "turning";
          this.counter++;
          this.posX = currentGoal[0];
          this.posY = currentGoal[1];
          this.velX = 0;
          this.velY = 0;
          this.accX = 0;
          this.accY = 0;
          this.isCollisionEffected = true;
        }
      }
    }
    super.tick(dt);
  }
  //nereden başlayacağı verilmediyse rastgele olarak başlangıçtan ya da bitişten başlıyor
  constructor(game, parent, subgrid, startingFromInitial) {
    super(game);
    if (typeof startingFromInitial != "boolean") startingFromInitial = Math.round(Math.random()) == 1;
    this.width = 25;
    this.parent = parent;
    this.entityType = "pedestrian";
    this.sprite = getRandom(PEDESTRIANS);
    let absoluteSubgrid = getAbsoluteSubgridIndex(subgrid, this.parent.parent._direction);
    let directionVector = toUnitVector(absoluteSubgrid);
    let offsetAxis = directionVector[0] == 0 ? 0 : 1;
    directionVector = [offsetAxis == 0 ? 1 : 0, offsetAxis == 1 ? 1 : 0].map(e => e * ROAD_WIDTH * 2 / 5);
    let offsetMultiplier = [offsetAxis == 0 ? -1 : 1, offsetAxis == 1 ? -1 : 1];
    let [midX, midY] = [this.parent.posX, this.parent.posY];
    let offsetVector = [directionVector[0] * offsetMultiplier[0], directionVector[1] * offsetMultiplier[1]];
    let offsetCoordsAmount = [directionVector[0], directionVector[1]];
    let currentRangeStart = [midX + offsetCoordsAmount[0], midY + offsetCoordsAmount[1]];
    let currentRangeEnd = [midX + offsetVector[0], midY + offsetVector[1]];
    let assignFrom;
    this.startingFromInitial = startingFromInitial;
    if (this.startingFromInitial) {
      assignFrom = [currentRangeStart, currentRangeEnd];
    } else {
      assignFrom = [currentRangeEnd, currentRangeStart];
      this.directionOffset = 270;
    }
    [this.rangeStart, this.rangeEnd] = assignFrom;
    let startAngle = this.parent._direction;
    let goalAngle = startAngle + (this.counter % 2 == 0 ? 90 : 270);
    this.direction = goalAngle;
    this.setPosition(this.rangeStart[0], this.rangeStart[1]);
  }
}
export class Obstacle extends MovableEntity {
  parent;
  isOnRoad;
  possibleRoads;
  anchorX = 0.5;
  anchorY = 0.5;
  chosenLane; //1 ise sağ şerit, -1 ise sol şerit. çift şerit genişliğindeyse de -1 çünkü çizimin başladığı şerit sol

  //çarpılabilir olarak ayarlanan nesnelerin konumu göreli olmaması gerektiği için childContainer kullanılamaz
  usedLanes = 1;
  zIndex = 2;
  directionOffset = 0;
  isCollisionEffected = false;
  signObstacles = [];
  parentObstacle;
  forcedDirection;
  _relativeDirection;
  laneWhenRelativeSet;
  isOther = false;
  massMultiplier = 1;
  minSubgridDistance = 4;
  pedestrians = [];
  crossOnly = false;
  _subgridIndexes;
  get subgridIndexes() {
    return this._subgridIndexes;
  }
  set subgridIndexes(value) {
    this._subgridIndexes = value;
    let foundIndex = this.parent.obstacles.findIndex(e => e[0] == this);
    if (foundIndex != -1) this.parent.obstacles[foundIndex][1] = value;
  }
  //belirtilmezse 1-2 adet yaya ekleniyor
  addPedestrian(amount = Math.floor(Math.random() * 2) + 1, startingFromInitial) {
    for (let i = 0; i < amount; i++) {
      let ped = new Pedestrian(this.game, this, this.subgridIndexes, startingFromInitial);
      this.pedestrians.push(ped);
    }
  }
  set relativeDirection(value) {
    this._relativeDirection = value;
    this.laneWhenRelativeSet = this.chosenLane;
  }
  get relativeDirection() {
    if (this.laneWhenRelativeSet == this.chosenLane) {
      return this._relativeDirection;
    }
    this.laneWhenRelativeSet = this.chosenLane;
    return this._relativeDirection = getOpposite(this._relativeDirection);
  }
  setCompatibleSign(otherDirection, maxTries = 2) {
    let lastRoad = this.parent;
    let signName = this.entityType + "Levha";
    let lastRoads = [lastRoad];
    let directions = [this._direction == 0 ? otherDirection ? "up" : "down" : otherDirection ? "right" : "left"];
    for (let i = 0; i < maxTries; i++) {
      let lastDirection = i == 0 ? directions[0] : getRelativeDirection(lastRoads[i].gridIndexes, lastRoads[i - 1].gridIndexes);
      let fromDirection = lastDirection;
      let next = getNextDirection(lastRoad.roadType, lastRoad._direction, getOpposite(fromDirection));
      directions.push(next);
      let currNeighbours = getNeighbours(lastRoad.gridIndexes);
      let neighbourRoads = getConnections(lastRoad.roadType, lastRoad._direction).map(e => currNeighbours[connectionLookup[e]]);
      let currRoad = currNeighbours[connectionLookup[next]];
      currRoad = !lastRoads.find(e => arrayEquals(e.gridIndexes, currRoad)) && neighbourRoads.includes(currRoad) && inBounds(currRoad) && this.game.roads[currRoad[0]][currRoad[1]];
      if (!currRoad || i == maxTries - 1) break;
      lastRoads.push(currRoad);
      directions.push(next);
      lastRoad = currRoad;
    }
    let signObstacle;
    for (let i = lastRoads.length - 1; i >= 0; i--) {
      let foundRoad = lastRoads[i];
      if (foundRoad.roadType == "rightcurve") continue;
      let lastDirection = directions[i];
      let foundGridIndexes = foundRoad.gridIndexes;
      //aynı yola aynı levhaya dair aynı yönden gelen ikinci levhayı koymuyoruz
      if (foundRoad.obstacles.find(([obstacle, index]) => {
        if (obstacle.entityType != signName) return false;
        let usable = lastDirection;
        let abs = getAbsoluteSubgridIndex(index, this.parent._direction);
        let directionList = getRelativeDirectionList([0, 0], abs);
        return directionList.includes(usable);
      })) break;
      signObstacle = new Obstacle(this.game, signName, null, this, lastDirection);
      if (signObstacle.setRoad(foundGridIndexes[0], foundGridIndexes[1])) {
        signObstacle.setRelativePosition();
        this.signObstacles.push(signObstacle);
        break;
      } else {
        signObstacle.destroy();
        signObstacle = null;
      }
    }
    return signObstacle;
  }
  setRelativePosition() {
    let indexes = getAbsoluteSubgridIndex(this.subgridIndexes, this.parent._direction);
    let multiplier = ROAD_WIDTH / 2 - this.width / 2;
    let [relX, relY] = indexes.map(e => e * multiplier);
    if (this.isOnRoad) {
      let divider = this.usedLanes == 2 ? 0 : 8;
      //normalde T tipi yolda soldakiler sırasıyla düz ters, sağdakiler ters düz olurdu
      //ikisinin aynı olması için ikisinin de sağdaki gibi davranmasını sağlıyoruz
      let currentAngle = getNormalizedAngle(getSubgridAngle(indexes.map(e => Math.abs(e))));
      let [relOffsetX, relOffsetY] = getLaneOffset(angleLookup[currentAngle], this.chosenLane, divider);
      //y değerinin ters yönde olması gerekmesi getLaneOffset'te hallediliyor
      relX += relOffsetX;
      relY += relOffsetY;
      let index = [relOffsetY > 0, relOffsetX > 0, relOffsetY < 0, relOffsetX < 0].indexOf(true);
      this.relativeDirection = index >= 0 ? connectionArray[index] : "right";
      this.direction = currentAngle;
    }
    let [resX, resY] = [this.parent.posX + relX, this.parent.posY - relY];
    this.setPosition(resX, resY);
  }
  removeFromObstacles() {
    if (this.parent) this.parent.obstacles = this.parent.obstacles.filter(e => e[0] != this);
  }
  setRoad(gridX, gridY) {
    if (this.parent) {
      this.removeFromObstacles();
      this.parent = null;
    }
    let currRoad = this.game.roads[gridX][gridY];
    this.parent = currRoad;
    //subgrid indexler kaydedilirken direction 0'mış gibi hesaplanır, çizilirken gerçek değer okunur
    //bu şekilde nesne döndürülünce eski değer ve yeni değerin bilinmesi gerekmeyecek
    let possibleSubgridIndexes = getPossibleSubgrids(currRoad.roadType, 0, this.isOnRoad);
    if (this.isOnRoad) possibleSubgridIndexes = possibleSubgridIndexes.filter(e => {
      if ((this.parent.roadType == "4" || this.parent.roadType == "3") && (e[0] == 0 || e[1] == 0)) return false;
      //ardışık engel sınırlamasına uymayacak subgrid'leri siliyoruz
      let currentGlobalSubgrid = getAbsoluteGlobalSubgrid(this.parent, e);
      return !this.game.roads.find(e => e.find(otherRoad => {
        return otherRoad && otherRoad.obstacles.find(obstacle => {
          let [entity] = obstacle;
          let minDistance = Math.max(this.minSubgridDistance, entity.minSubgridDistance);
          let otherGlobalSubgrid = getAbsoluteGlobalSubgrid(otherRoad, entity.subgridIndexes);
          let distance = getMagnitude(currentGlobalSubgrid[0] - otherGlobalSubgrid[0], currentGlobalSubgrid[1] - otherGlobalSubgrid[1]);
          return distance < minDistance;
        });
      }));
    });
    let sameParent = this.parentObstacle && this.parentObstacle.parent == this.parent;
    if (!this.isOnRoad) {
      possibleSubgridIndexes = possibleSubgridIndexes.filter(e => {
        //|[-1,1]| vs. olduğunda bu değer sqrt2 olacak, yalnızca köşelere yerleştirmemiz gerekmesi durumunda işe yarıyor
        let isCross = getMagnitude(e[0], e[1]) > 1;
        if (this.crossOnly && !isCross) return false;
        if (sameParent) {
          return this.parentObstacle.subgridIndexes[0] == e[0] || this.parentObstacle.subgridIndexes[1] == e[1];
        }
        return true;
      });
    }
    let currentSubgridIndexes = possibleSubgridIndexes.filter(e => {
      return !currRoad.obstacles.find(([_, obsIndexes]) => arrayEquals(e, obsIndexes));
    });
    let occupierToHandle;
    if (!possibleSubgridIndexes.length) return false;
    let currIndexes;
    if (this.forcedDirection) {
      let ideal = [connectionArray[(connectionLookup[this.forcedDirection] + 3) % 4],
      connectionArray[(connectionLookup[this.forcedDirection] + 2) % 4],
      ];
      let usable = ideal[0];
      let foundSubgrid = possibleSubgridIndexes.find(e => {
        let abs = getAbsoluteSubgridIndex(e, this.parent._direction);
        return unorderedArrayEquals(getRelativeDirectionList([0, 0], abs), ideal);
      });
      if (!foundSubgrid) {
        foundSubgrid = possibleSubgridIndexes.find(e => {
          let abs = getAbsoluteSubgridIndex(e, this.parent._direction);
          let currList = getRelativeDirectionList([0, 0], abs);
          return currList.includes(usable);
        });
      }
      if (!foundSubgrid) return false;
      let occupier = this.parent.obstacles.find(e => arrayEquals(e[1], foundSubgrid));
      if (occupier) {
        if (occupier[0].forcedDirection) return false;
        occupierToHandle = occupier[0];
      }
      currIndexes = foundSubgrid;
    } else {
      let usableLength = currentSubgridIndexes.length;
      if (usableLength == 0) return false;
      currIndexes = currentSubgridIndexes[Math.floor(Math.random() * usableLength)];
      if (this.isOnRoad) {
        this.chosenLane = this.usedLanes == 2 ? -1 : Math.floor(Math.random()) ? 1 : -1;
      } else this.chosenLane = currIndexes[1];
    }
    this.subgridIndexes = currIndexes;
    this.setRelativePosition();
    currRoad.obstacles.push([this, currIndexes]);
    if (occupierToHandle) {
      //yer atandıktan sonra silinecek olana yeniden atanması için güncel nesne eklendikten sonra kontrol edilmesi gerekiyor
      let res = occupierToHandle.setRoad(gridX, gridY);
      if (!res) occupierToHandle.destroy();
    }
    return true;
  }
  destroy() {
    this.signObstacles.forEach(e => e.destroy());
    this.removeFromObstacles();
    super.destroy();
  }
  changeRoadCondition(currentCondition) {
    let obstacleType = this.entityType;
    let curr = OBSTACLES[obstacleType];
    if (currentCondition) {
      if (curr.imagePerRoad) {
        this.sprite = curr.imagePerRoad[currentCondition];
      } else this.sprite = curr.image;
    } else {
      this.sprite = curr.image;
    }
  }
  constructor(game, obstacleType, roadCondition, parentObstacle, forcedDirection) {
    super(game);
    this.parentObstacle = parentObstacle || null;
    this.forcedDirection = forcedDirection;
    let curr = OBSTACLES[obstacleType];
    this.entityType = obstacleType || "obstacle";
    if (THREATS.includes(obstacleType)) this.massMultiplier = 20;
    //OBSTACLES'ta olmayan nesneler de yolda sayılıyor
    this.isOnRoad = !curr || curr.isOnRoad;
    if (!this.isOnRoad) this.isCollisionEffected = false;
    if (!curr) return;
    if (curr.zIndex !== undefined) this.zIndex = curr.zIndex;
    this.possibleRoads = curr.roadTypes;
    this.width = curr.width;
    this.height = curr.height || null;
    this.usedLanes = curr.lanes ?? 1;
    this.directionOffset = curr.directionOffset ?? 0;
    if (curr.isImmovable) this.isImmovable = true;
    //boolean yapılıyor
    this.crossOnly = !!curr.crossOnly;
    if (!game.obstacleCounters[obstacleType]) {
      game.obstacleCounters[obstacleType] = 0;
    }
    game.obstacleCounters[obstacleType]++;
    if (roadCondition) {
      if (curr.imagePerRoad) {
        this.sprite = curr.imagePerRoad[roadCondition];
      } else this.sprite = curr.image;
    } else {
      this.sprite = curr.image;
    }
  }
}
export class Light extends Obstacle {
  directionOffset = 270;
  tickSinceChange = 0;
  /*
  sarı ışık araçların o yoldaki hızına bağlı uzunlukta olur, oluşturduğumuz cost mantığında da üst üste düz yollar olması cost'u düşürürken
  dönemeç ve yol şartları cost'u arttırıyor, sarı ışığın uzunluğunu oraya bir diğer ışıktan ulaşan kişinin min cost'una göre belirliyoruz
  */
  yellowLightTick;
  spriteIndex = 0;
  sprites = [];
  state = LIGHT_STATES[0];
  changeCounter = 0;
  isReverse = false;
  zIndex = 3;
  minSubgridDistance = 4;
  sync(yellowLightTick, offset = 0) {
    if (!this.parent) return false;
    this.yellowLightTick = yellowLightTick;
    this.tickSinceChange = offset;
    this.isReverse = this.parent.recursionIndex % 2 == 0;
    let stateIndex = this.isReverse ? 0 : 2;
    this.state = LIGHT_STATES[stateIndex];
    this.spriteIndex = stateIndex;
    this.setSprite();

    return true;
  }
  setSprite() {
    this.sprite = this.sprites[this.spriteIndex % this.sprites.length];
  }
  tick(dt) {
    let isYellow = this.state == LIGHT_STATES[1];
    let requirement = isYellow ? this.yellowLightTick : (LIGHT_CHANGE_TICK - this.yellowLightTick / 2);
    let needsToChange = this.tickSinceChange++ >= requirement;
    if (needsToChange) {
      let stateIndex = isYellow ? (this.changeCounter % 2 == 1) == this.isReverse ? 2 : 0 : 1;
      this.state = LIGHT_STATES[stateIndex];
      this.spriteIndex = stateIndex;
      this.setSprite();
      this.setPosition(this.posX, this.posY);
      this.tickSinceChange = 0;
      if (!isYellow) this.changeCounter++;
    }
    super.tick(dt);
  }
  setRelativePosition() {
    super.setRelativePosition();
    if (this.relativeDirection == "left" || this.relativeDirection == "right") {
      //diğer nesnelerin yönlerini bozmadan ışıkların ışık kısmınını birbirine yakın olması için
      this._direction += 180;
    }
  }
  destroy() {
    this.game.lights = this.game.lights.filter(e => e != this);
    super.destroy();
  }
  constructor(game, isOther = false) {
    super(game);
    this.sprites = ["k-ısık", "s-ısık", "y-ısık"];
    this.entityType = "light";
    this.width = CAR_WIDTH * 3 / 11;
    if (isOther) this.directionOffset = 90;
    this.isOther = isOther;
    this.game.lights.push(this);
    this.setSprite();
  }
}
//haritada boşluğu doldurmak için kullanılan her class bu class'tan kalıtım alıyor, class olduğu gibi kullanılmamalı
class Filler extends Entity {
  isImmovable = true;
  anchorX = 0.5;
  anchorY = 0.5;
  constructor(game) {
    super(game);
    this.width = ROAD_WIDTH;
    this.forceSquare = true;
  }
}
export class Ocean extends Filler {
  constructor(game) {
    super(game);
    this.forceSquare = true;
    this.entityType = "ocean";
    this.width = ROAD_WIDTH;
    this.sprite = "ocean.jpeg";
    this.sprite.zIndex = 3;
    this.sprite.tint = 65487;
  }
}
//binaya sahte 3d görünüm verilirken kullanılacak kenarlar için
export class BuildingSide extends Entity {
  constructor(game, parent, direction = 0) {
    super(game);
    this.parent = parent;
    this.spriteWidth = ROAD_WIDTH * (1 - BUILDING_MULTIPLIER);
    this.sprite = getRandom(BUILDING_SIDES);
    this.direction = direction;
    this.sprite.zIndex = 4;
    this.entityType = "side";
  }
}
export class BuildingCollision extends Entity {
  ratio = 1;
  tick = noop;
  setPosition(x, y) {
    let lastIndexes = this.gridIndexes;
    super.setPosition(x, y);
    this.gridIndexes = getIndexes(x, y);
    let gridIndexes = this.gridIndexes;
    if (lastIndexes) {
      this.game.gridEntitySets[lastIndexes[0]]?.[lastIndexes[1]]?.delete(this);
    }
    this.game.gridEntitySets[gridIndexes[0]]?.[gridIndexes[1]]?.add(this);
  }
  constructor(game) {
    super(game);
    this.entityType = "buildingcollision";
    this.width = ROAD_WIDTH * 0.9;
    let xMax = this.width - 1;
    let bounds = [0, 0, xMax, xMax];
    this.scaledBounds = bounds;
    this.bounds = [[0, 0], [0, xMax], [xMax, 0], [xMax, xMax]];

  }
}
export class Building extends Filler {
  tick = noop;
  collisionEntity;
  setPosition(x, y) {
    this.posX = x;
    this.posY = y;
    let ratio = 1 - BUILDING_MULTIPLIER;
    let mapWidth = this.game.map.length * ROAD_WIDTH;
    let mapHeight = this.game.map[0].length * ROAD_WIDTH;
    let ratioX = (x - mapWidth * PERSPECTIVE[0]) / mapWidth;
    let ratioY = (y - mapHeight * PERSPECTIVE[1]) / mapHeight;
    ratioX = Math.sqrt(Math.abs(ratioX)) * Math.sign(ratioX);
    ratioY = Math.sqrt(Math.abs(ratioY)) * Math.sign(ratioY);
    let offsetX = ratioX * ROAD_WIDTH * ratio;
    let offsetY = ratioY * ROAD_WIDTH * ratio;
    let leftSpace = (ROAD_WIDTH * ratio) / 2;
    let spriteX = x + offsetX;
    let spriteY = y + offsetY;
    //this.collisionEntity.setPosition(spriteX,spriteY)
    this.sprite.x = spriteX;
    this.sprite.y = spriteY;
    this.childContainer.x = x;
    this.childContainer.y = y;
    let absOffsetX = Math.abs(offsetX);
    let absOffsetY = Math.abs(offsetY);
    absOffsetX = Math.max(absOffsetX, absOffsetY);
    absOffsetY = absOffsetX;
    offsetX = absOffsetX * Math.sign(offsetX);
    offsetY = absOffsetY * Math.sign(offsetY);
    let sideW = absOffsetX + leftSpace / 2;
    let sideH = absOffsetY + leftSpace / 2;
    let startXTop = spriteX + (ROAD_WIDTH / 2) * BUILDING_MULTIPLIER;
    let startYTop = spriteY + (ROAD_WIDTH / 2) * BUILDING_MULTIPLIER;
    let skewTop = -Math.atan2(leftSpace / 2 - Math.min(absOffsetX, absOffsetY) + this.spriteWidth, this.spriteWidth) * Math.sign(offsetX) * Math.sign(offsetY);
    let skewLeft = Math.atan2(leftSpace / 2 - Math.min(absOffsetY, absOffsetX) + this.spriteWidth, this.spriteWidth) * Math.sign(offsetX) * Math.sign(offsetY);
    if (offsetY > 0) {
      //üstte resim çizilecekse
      let skewOffsetX = offsetY * Math.tan(skewTop) * Math.sign(offsetY);
      let skewOffsetY = offsetY * Math.tan(skewTop) * Math.sign(offsetX);
      startYTop -= this.spriteWidth - skewOffsetY;
      startXTop += skewOffsetX;
    }
    this.sides[0].setPosition(startXTop, startYTop);
    this.sides[0].sprite.width = sideH;
    this.sides[0].sprite.height = this.spriteWidth;
    this.sides[0].sprite.skew.y = skewTop;
    this.sides[0].sprite.skew.x = 0;
    let startXLeft = spriteX - (ROAD_WIDTH / 2) * BUILDING_MULTIPLIER - sideW;
    let startYLeft = spriteY - (ROAD_WIDTH / 2) * BUILDING_MULTIPLIER;
    if (offsetX < 0) {
      //sağda resim çizilecekse
      startXLeft += this.spriteWidth + sideW;
    } else {
      //solda resim çizilecekse
      let skewOffsetX = (absOffsetX / 2) * Math.tan(skewLeft) * Math.sign(offsetY);
      let skewOffsetY = -absOffsetX * Math.tan(skewLeft);
      startYLeft += skewOffsetY;
      startXLeft += skewOffsetX;
    }
    this.sides[1].setPosition(startXLeft, startYLeft);
    this.sides[1].sprite.width = sideW;
    this.sides[1].sprite.height = this.height;
    this.sides[1].sprite.skew.y = skewLeft;
    this.sides[1].sprite.skew.x = 0;
    this.gridIndexes = getIndexes(x, y);
    this.cachedLines = null;
    let lastGrids = this.currentGrids;
    this.currentGrids = this.getGrids();
    this.resetGridSets(lastGrids);
  }
  spriteWidth = ROAD_WIDTH * BUILDING_MULTIPLIER;
  constructor(game) {
    super(game);
    this.entityType = "building";
    this.sprite = getRandom(BUILDING_TOPS);
    this.forceSquare = true;
    this.sides = [
      new BuildingSide(game, this, 90),
      new BuildingSide(game, this),
    ];
    let background = getSprite("cim.jpg");
    background.width = ROAD_WIDTH;
    //Anchor ile uyumlu olması için ya x ve y ayarlanmalı ya da anchor değiştirilmeli, bu hali negatif anchor'dan daha anlaşılır
    background.x = -ROAD_WIDTH / 2;
    background.y = -ROAD_WIDTH / 2;
    this.childContainer.addChild(background);
    this.childContainer.zIndex = 0;
    background.zIndex = 0;
    this.sprite.zIndex = 4;
    //this.collisionEntity=new BuildingCollision(game)
  }
}
export class Park extends Filler {
  constructor(game) {
    super(game);
    this.entityType = "park";
    this.sprite = "park alanı";
    this.sprite.tint = 13689040;
    this.direction = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
  }
}
export class Sensor extends MovableEntity {
  parent;
  offsetDegree;
  graphics = new PIXI.Graphics();
  length = 0;
  lastColliding = false;
  output;
  xOffset = 0;
  yOffset = 0;
  lineLength;
  lastStart = [-1, -1];
  lastEnd = [-1, -1];
  lastGrids;
  getGrids() {
    let line = this.getLines()[0];
    let start = getIndexes(line[0][0], line[0][1]);
    let end = getIndexes(line[1][0], line[1][1]);
    if (this.lastGrids && this.lastStart[0] == start[0] && this.lastStart[1] == start[1] && this.lastEnd[0] == end[0] && this.lastEnd[1]) {
      return this.lastGrids;
    }
    let currentGridsArray = [];
    let minX = Math.min(start[0], end[0]);
    let maxX = Math.max(start[0], end[0]);
    let minY = Math.min(start[1], end[1]);
    let maxY = Math.max(start[1], end[1]);
    for (let i = minX; i <= maxX; i++) {
      for (let j = minY; j <= maxY; j++) {
        let curr = [i, j];
        currentGridsArray.push((curr));
      }
    }
    this.lastStart = start;
    this.lastEnd = end;
    let lastGrids = this.currentGrids;
    this.currentGridsArray = currentGridsArray;
    if (this.isImmovable) {
      this.resetGridSets(lastGrids);
    }
    return this.lastStart = new Set(currentGridsArray);
  }
  getColliders() {
    return super.getColliders().filter(e => e != this.parent);
  }
  getLines(isOffset, forDrawing = false) {
    let xMultiplier = Math.cos(toRadian(this.parent._direction));
    let yMultiplier = Math.sin(toRadian(this.parent._direction));
    let xBaseMultiplier = Math.cos(toRadian(-this.parent.directionOffset));
    let yBaseMultiplier = Math.sin(toRadian(-this.parent.directionOffset));
    let xOffset = this.xOffset * xMultiplier + this.yOffset * yMultiplier;
    let yOffset = this.xOffset * yMultiplier + this.yOffset * xMultiplier;
    let xBaseOffset = this.xOffset * xBaseMultiplier + this.yOffset * yBaseMultiplier;
    let yBaseOffset = this.xOffset * yBaseMultiplier + this.yOffset * xBaseMultiplier;
    let startX = isOffset ? xBaseOffset : this.parent.posX + xOffset;
    let startY = isOffset ? yBaseOffset : this.parent.posY + yOffset;
    let degree = toRadian(isOffset ? this.offsetDegree : this.offsetDegree + this.parent.direction);
    let lineLength = forDrawing ? this.lineLength : this.length;
    let endX = startX + lineLength * Math.cos(degree);
    let endY = startY + lineLength * Math.sin(degree);
    return [
      [
        [startX, startY],
        [endX, endY],
      ],
    ];
  }
  drawLine(isOffset, curr = this.getLines(isOffset, true)[0]) {
    this.cachedLines = null;
    if (this.destroyed) return;
    this.graphics.clear();
    this.graphics.moveTo(curr[0][0], curr[0][1]).lineTo(curr[1][0], curr[1][1]).stroke();
  }
  destroy() {
    super.destroy();
    this.graphics.destroy();
  }
  tick = () => {
    let currColliders = this.getColliders();
    let isColliding = currColliders.length > 0;
    let currLine = this.getLines()[0];
    let lineLength = this.length;
    let min = [this.length, null];
    if (isColliding) {
      currColliders.forEach((collider) => {
        let colliderLines = collider.getLines();
        colliderLines.forEach((line) => {
          if (checkIntersects(currLine[0], currLine[1], line[0], line[1])) {
            let point = getIntersectionPoint(currLine, line);
            let distance = getMagnitude(point[0] - currLine[0][0], point[1] - currLine[0][1]);
            lineLength = Math.min(lineLength, distance);
            if (distance < min[0]) {
              min = [distance, collider];
            }
          }
        });
      });
    }
    this.output = min;
    let lastLength = this.lineLength;
    this.lineLength = lineLength;
    if (isColliding != this.lastColliding || lastLength != lineLength) {
      if (!this.graphics.destroyed) this.graphics.setStrokeStyle({
        color: isColliding ? 16711680 : 255,
      });
      this.drawLine(true);
      this.lastColliding = isColliding;
    }
    this.currentGrids = this.getGrids();
  };
  constructor(game, degree, parent, length = CAR_WIDTH, xOffset = 0, yOffset = 0) {
    super(game);
    this.xOffset = xOffset;
    this.yOffset = yOffset;
    this.entityType = "sensor";
    this.length = length;
    this.lineLength = length;
    this.output = [length, null];
    this.offsetDegree = degree;
    this.parent = parent;
    this.graphics.setStrokeStyle({
      color: 255,
    });
    this.drawLine(true);
  }
}
