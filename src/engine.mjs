import { Building, Car, Light, Obstacle, Ocean, Park, Road } from "./classes.mjs";
import { BUILDING_SIDES, BUILDING_TOPS, CAR_IMAGES, CHANCE_ROAD_WEIGHTS, DEFAULT_LIGHT_DISTANCE, DIRECTION_ALTERNATIVE, GRID_HEIGHT, GRID_WIDTH, HEIGHT, IS_PROD, LIGHT_IMAGES, OBSTACLES, OBSTACLES_WITH_SIGN, OBSTACLE_IMAGES, OBSTACLE_IMAGE_TO_NAME, OBSTACLE_SIGNS, PATH_START_INDEX, PEDESTRIANS, PHYSICAL_THREATS, ROAD_CONDITION_ARR, ROAD_CONDITION_INDEXES, ROAD_CONDITION_WEIGHTS, ROAD_IMAGES, ROAD_TYPES, ROAD_TYPES_ARR, ROAD_TYPES_OBJ, ROAD_WIDTH, WIDTH, angleLookup, connectionArray, connectionLookup ,USE_TEST_DATA,testData} from "./constants.mjs";
export let highlightStyle = {
  color: 0x006699,
  width: 4,
};
export const app = new PIXI.Application();
export const {
  BitmapText
} = PIXI;
await app.init({
  width: WIDTH,
  height: HEIGHT,
  antialias: true,
  autoDensity: true,
});
let changeImageResolution = async (texture, options) => {
  if (!options) return texture;
  let [intendedWidth, isRotated] = options;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (isRotated) {
    canvas.width = Math.ceil((texture.width / texture.height) * intendedWidth);
    canvas.height = intendedWidth;
  } else {
    canvas.width = intendedWidth;
    canvas.height = Math.ceil((texture.width / texture.height) * intendedWidth);
  }
  let image = await app.renderer.extract.image(texture);
  return new Promise((res) => {
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let retVal = PIXI.Texture.from(canvas);
      res(retVal);
    };
  });
};
let imagesArray = [ "ocean.jpeg", "park alanı.jpg", "cim.jpg","sand.jpg","yaya.png", ...ROAD_IMAGES, ...OBSTACLE_IMAGES, ...LIGHT_IMAGES, ...BUILDING_SIDES, ...BUILDING_TOPS,  ...PEDESTRIANS, ...CAR_IMAGES];
//Alta eklenen resimler ölçekleniyor, bellek kullanımını düşürmeye büyük katkı sağlıyor
//2. değerin true olması durumunda resmin genişliği yerine yüksekliğine göre ölçekleniyor
let intendedWidths = {
  "ocean.jpeg": [ROAD_WIDTH],
  "park alanı.jpg": [ROAD_WIDTH],
  "cim.jpg": [ROAD_WIDTH],
  "sand.png": [ROAD_WIDTH/4],
};
//tüm engel ve yol resimleri için resimler ölçeklenecek
let toScale = [...ROAD_IMAGES.map(e=>[e, false]),
  ...LIGHT_IMAGES.map(e=>[e, true]), ...OBSTACLE_IMAGES.map(e=>[e, OBSTACLE_IMAGE_TO_NAME[e][4]]),
  ...BUILDING_SIDES.map(e=>[e,false]),
  ...BUILDING_TOPS.map(e=>[e,false]),
  ...PEDESTRIANS.map(e=>[e,true]),
  ...CAR_IMAGES.map(e=>[e,true]),
];
toScale.forEach(e=>(intendedWidths[e[0]] = [ROAD_WIDTH, e[1] || false]));
let getRoadWeight = (roadType) => {
  return CHANCE_ROAD_WEIGHTS[roadType] || 1;
};
let getWeightedRandomCondition = (obj) => {
  let sum = 0;
  for (let e in obj) sum += obj[e];
  let rand = Math.random() * sum;
  let acc = 0;
  let last;
  for (let e in obj) {
    acc += obj[e];
    last = obj[3];
    if (acc >= rand) return e;
  }
  return last;
};
let getWeightedRandom = (elements)=>{
  let total = elements.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  for (const [name, weight] of elements) {
      if (random < weight) {
          return name;
      }
      random -= weight;
  }
}
//aracın arkasının ortasından aracın baktığı yönün sağına giden bir nokta çekiliyor, noktanın total kesişim sayısı tekse poligon içindedir
//bakılan yön açısından sağ olmasının gerekip gerekmediği kontrol edilebilir
export let checkIsOnRoad = (entity,road)=>{
    let entityLines = entity.getLines()
    let absBounds = getAbsoluteBounds(road)
    let [minX,maxX,minY,maxY] = getMinsAndMaxes(absBounds)
    if(entity.posX<minX||entity.posX>maxX||entity.posY<minY||entity.posY>maxY)return false
    let roadLines = road.getLines()
    let [A,B,C,D] = entityLines
    let aStart = A
    let dStart = D
    let midPoint = [(aStart[0]+dStart[0])/2,(aStart[1]+dStart[1])/2]
    let mag = 2000 //normalde sonsuza dek uzatılan farazi çizgi üzerinden yapılır, yol içerisinde ROAD_WIDTH'i geçemez
    let magX = Math.sin(toRadian(entity._direction))*mag
    let magY = Math.cos(toRadian(entity._direction))*mag

    let extendedEnd = [midPoint[0]+magX,midPoint[1]+magY]
    let line = [midPoint,extendedEnd]
    let count = roadLines.map(e=>[line,e]).reduce((x,y)=>x+ /* sağdaki artı sayıya çeviriyor */ +checkIntersects(y[0][0],y[0][1],y[1][0],y[1][1]),0)
    return count%2==0
}
let shiftConnections = (connections, angle) => {
  return connections.map(
    e=>connectionArray[Math.floor(connectionLookup[e] + angle / 90) % 4]);
};
//yol tipi ve yol açısı verilince istenen yolun hangi yönlerde bağlantıları olduğunu döndürüyor
export function getConnections(roadType, angle) {
  return shiftConnections(ROAD_TYPES[roadType].map(e=>angleLookup[e]), angle);
}
//her yol 9 kısma bölünebilir, bunlardan yol olmayanlara levha, olanlara engel yerleştirilebilir
export let getSubgridAngle = (index) => {
  //polar koordinat diye geçiyor aslında ama hem boyut bu durumda önemli değil hem de fonksiyon direkt kullanılırsa amacın anlaşılması zorlaşır
  //asıl fonksiyon atan2(y,x) şeklinde kullanılıyor ama bizde 0 derece kuzey olduğu için atan(x,y) yapıyoruz (doğu olmalı)
  return toDegree(Math.atan2(index[0], index[1]));
};
let getSubgridIndex = (angle,magnitude=1) => {
  return [
    Math.round(magnitude*Math.sin(toRadian(angle))),
    Math.round(magnitude*Math.cos(toRadian(angle))),
  ];
};
//kum eklenirken oluşan küsüratlı değerler küsüratıyla gerekiyor
let getAbsoluteIndexNoRound = (angle,magnitude=1)=>{
  return [
    magnitude*Math.sin(toRadian(angle)),
    magnitude*Math.cos(toRadian(angle)),
  ];
}
//nesnelerde subgrid'ler direction 0'mışçasına tutuluyor (hem hesaplama kolaylığı hem de yolun bir şekilde yönü değişmesi durumuna karşı)
//subgrid ve açı verilerek açıya göre konumunu almamızı sağlıyor
export let getAbsoluteSubgridIndex = (absIndex, offsetAngle,noRound=false) => {
  if (absIndex[0] == 0 && absIndex[1] == 0) return absIndex;
  let currAngle = getSubgridAngle(absIndex);
  let magnitude = getMagnitude(absIndex[0],absIndex[1])
  if(noRound)return getAbsoluteIndexNoRound(currAngle + offsetAngle,magnitude)
  return getSubgridIndex(currAngle + offsetAngle,magnitude);
};
export let getRandom = arr=>arr[Math.floor(Math.random()*arr.length)]
let getBlockedIndexes = (connections) => {
  //merkez subgrid her zaman yol
  /*
      0: 0, 1
      90: 1, 0
      180: 0, -1
      270: -1, 0
      olmalı
      sağdaki cos, soldaki sin
      */
  return [
    [0, 0], ...connections.map(e=>getSubgridIndex(e))
  ];
};
//nesnelerin 3x3 subgridlerinde yolda olup olmadığına ve yol biçimine uygunluğuna göre kullanılabilecek alanlar filtreleniyor
export let getPossibleSubgrids = (roadType, angle, isOnRoad) => {
  let currConnections = getConnections(roadType, angle).map(
    e=>connectionLookup[e] * 90);
  let currBlocked = getBlockedIndexes(currConnections);
  let retVal = [];
  for (let i = -1; i < 2; i++) {
    for (let j = -1; j < 2; j++) {
      let curr = [i, j];
      if (arrayEquals(curr, [0, 0])) continue;
      // yoldaysa engellenenleri, değilse engellenmeyenleri almalı
      // engellenmedi XOR isOnRoad ya da engellendi==isOnRoad
      // yapılabilir
      //! değilini aldığı için !! boolean yapıyor
      let found = !!currBlocked.find(e=>arrayEquals(curr, e));
      if (found == isOnRoad) {
        retVal.push(curr);
      }
    }
  }
  return retVal;
};
export let getOpposite = (direction) => {
  return connectionArray[(connectionLookup[direction] + 2) % 4];
};
export let getNextDirection = (roadType, angle, fromDirection, possibleDirections, facingDirection) => {
  if (!possibleDirections) possibleDirections = getConnections(roadType, angle);
  return roadType == "4" ? getOpposite(fromDirection) : roadType == "3" ? angleLookup[angle] == fromDirection ? possibleDirections.find(e=>e != fromDirection) : getOpposite(fromDirection) : roadType == "rightcurve" ? facingDirection ? possibleDirections.find(e=>e == facingDirection) || possibleDirections.find(e=>e != fromDirection) : possibleDirections.find(e=>e != fromDirection) : possibleDirections.find(e=>e != fromDirection);
};
export let getRelativeDirection = (p1, p2) => {
  //p1 p2'ye gidiyorsa hangi yönden geldiği
  let xDiff = p2[0] - p1[0];
  let yDiff = p2[1] - p1[1];
  return xDiff > 0 ? "left" : xDiff < 0 ? "right" : yDiff > 0 ? "up" : "down";
};
export let getRelativeDirectionList = (p1,p2)=>{
  //bu fonksiyon getRelativeDirection ile tutarlı değil, birbiri yerine kullanılamazlar
  let results = []
  let xDiff = p2[0] - p1[0];
  let yDiff = p2[1] - p1[1];
  if(xDiff>0)results.push("right")
  //eşitlik yok
  else if(xDiff<0)results.push("left")
  if(yDiff<0)results.push("down")
  else if(yDiff>0)results.push("up")
  return results
}
let getWeights = (grid) => {
  let weightObj = {};
  ROAD_TYPES_ARR.forEach(e=>(weightObj[e] = Math.random()));
  grid.forEach((col) => col.forEach(e=>{
    if (e[0] == -1) return;
    // 4 ve 3 tipi yolların gelme ihtimali düşürülüyor, harita daha az dolu oluyor
    weightObj[ROAD_TYPES_ARR[e[0]]] += Math.random() * (1 / getRoadWeight(ROAD_TYPES_ARR[e[0]]));
  }));
  return weightObj;
};
let countInserted = (grid) => grid.map(e=>e.filter(e=>e[0] != -1).length).reduce((x, y) => x + y);
export let inBounds = (point) => point[0] >= 0 && point[0] < GRID_WIDTH && point[1] >= 0 && point[1] < GRID_HEIGHT;
let checkOnEdge = point=>point[0]==0||point[0]==GRID_WIDTH-1||point[1]==0||point[1]==GRID_HEIGHT-1
let shuffle = (x) => {
  for (let i = 0; i < x.length; i++) {
    let randIndex = Math.floor(Math.random() * (x.length - i)) + i;
    [x[i], x[randIndex]] = [x[randIndex], x[i]];
  }
  return x;
};
let randomAngles = () => shuffle([0, 90, 180, 270]);
export let getNeighbours = (point) => [
  [point[0], point[1] - 1],
  [point[0] + 1, point[1]],
  [point[0], point[1] + 1],
  [point[0] - 1, point[1]],
];
export let createMap = (grid, curr, fromDirection,lastCondition,recursionCounter=0) => {
  //recursiounCounter sadece ana yolda sapan oluşturucuları sayıyor, sayının çift olup olmadığına göre ışıklar belirleniyor
  let firstInsert = !grid;
  if (firstInsert) {
    grid = Array(GRID_WIDTH).fill().map(e=>Array(GRID_HEIGHT).fill([-1, -1]));
    let initialY = Math.floor(Math.random() * GRID_HEIGHT);
    curr = [0, initialY];
    fromDirection = "left";
    lastCondition="asphalt"
  }
  if (grid[curr[0]][curr[1]][0] != -1) {
    let roadType = ROAD_TYPES_ARR[grid[curr[0]][curr[1]][0]];
    let currentDirections = getConnections(roadType, grid[curr[0]][curr[1]][1]);
    return currentDirections.includes(fromDirection) ? grid : false;
  }
  let nextPossibleRoads = getNeighbours(curr);
  let currWeights = getWeights(grid);
  let currRoads = firstInsert ? ["straight"] : ROAD_TYPES_ARR.slice(0).sort((x, y) => currWeights[x] - currWeights[y]);
  let tempGrid = grid.map(e=>e.slice(0)); //referansın üzerine yazmamak için kopyalanıyor
  let changePossibility = Math.sqrt(1 / ROAD_CONDITION_WEIGHTS[lastCondition] / 10);
  let rand = Math.random()
  if(rand<changePossibility){
    lastCondition=getWeightedRandomCondition(ROAD_CONDITION_WEIGHTS)
  }
  let currConditionIndex = ROAD_CONDITION_INDEXES[lastCondition]
  for (let i = 0; i < currRoads.length; i++) {
    let roadType = currRoads[i];
    let angles = randomAngles();
    for (let j = 0; j < 4; j++) {
      let angle = angles[j];
      let possibleDirections = getConnections(roadType, angle);
      if (!possibleDirections.includes(fromDirection)) continue;
      let iTempGrid = tempGrid;
      possibleDirections = possibleDirections.filter(e=>e != fromDirection);
      let mainNextDirection = getNextDirection(roadType, angle, fromDirection, possibleDirections);
      let nextCoords = nextPossibleRoads[connectionLookup[mainNextDirection]];
      let nextFromDirection = getOpposite(mainNextDirection);
      iTempGrid[curr[0]][curr[1]] = [ROAD_TYPES_OBJ[roadType], angle, currConditionIndex, recursionCounter];
      if (inBounds(nextCoords)) {
        //önce gelinen yolun devamı oluşturuluyor
        let currTempGrid = createMap(tempGrid, nextCoords, nextFromDirection, lastCondition, recursionCounter);
        if (!currTempGrid) continue;
        iTempGrid = currTempGrid;
      } //eğer harita sınırı dahilinde değilse sorun değil, şehir harita dışına uzuyor gibi olur sadece
      possibleDirections = possibleDirections.filter(e=>e != mainNextDirection);
      let hasFailed = false;
      for (let q = 0; q < possibleDirections.length; q++) {
        let currDirection = possibleDirections[q];
        let directionIndex = connectionLookup[currDirection];
        let currCoords = nextPossibleRoads[directionIndex];
        let currFromDirection = getOpposite(currDirection);
        if (inBounds(currCoords)) {
          let increaser = roadType!="3"||getOpposite(fromDirection)==mainNextDirection?1:0
          //yan yollar oluşturuluyor
          let currGrid = createMap(iTempGrid, currCoords, currFromDirection,lastCondition,recursionCounter+increaser);
          if (!currGrid) {
            hasFailed = true;
            break;
          }
          iTempGrid = currGrid;
        }
      }
      if (!hasFailed) {
        if (firstInsert && countInserted(iTempGrid) / GRID_HEIGHT / GRID_HEIGHT < (IS_PROD?0.6:0.4)) return createMap();
        return iTempGrid;
      }
    }
  }
  return false;
};
//WIP: henüz kullanılmamalı
let findSuitableRoad = (point, connections, grid) => {
  let curveIndex = ROAD_TYPES_OBJ["rightcurve"];
  let threeIndex = ROAD_TYPES_OBJ["3"];
  let fourIndex = ROAD_TYPES_OBJ["4"];
  let straightIndex = ROAD_TYPES_OBJ["straight"];
  console.log("test", point, connections);
  let directions = connections.map(e=>getRelativeDirection(point, e));
  console.log("dire", point, directions.length);
  if (connections.length == 4) {
    return [fourIndex, [0, 90, 180, 270][Math.floor(Math.random() * 4)]];
  }
  if (connections.length == 3) {
    /*
        up 180
        right 270
        down 0
        left 90
        */
    //let foundAngle = !directions.include("down")?0:!directions.include("up")?180:!directions.include("right")?270:90
    let foundAngle;
    for (let i = 0; i < 4; i++) {
      let e = connectionArray[i];
      if (!directions.includes(e)) {
        foundAngle = (i /* +n?  */ * 90) % 360;
        break;
      }
    }
    return [threeIndex, foundAngle];
  }
  if (connections.length == 2) {
    let indexLeft = connectionLookup[directions[0]];
    let indexRight = connectionLookup[directions[1]];
    let difference = connectionArray[(indexLeft + 3) % 4] == directions[1] || connectionArray[(indexRight + 3) % 4] == directions[0] ? 1 : 2;
    console.log("diff is", difference);
    if (difference == 1) {
      let firstDirectionIndex = connectionLookup[directions[0]];
      let foundAngle = [0, 90, 180, 270][firstDirectionIndex];
      return [curveIndex, foundAngle];
    } else {
      let foundAngles = directions[0] == "up" ? [90, 270] : [0, 180];
      let index = Math.round(Math.random());
      return [straightIndex, foundAngles[index]];
    }
  }
  return grid[point[0]][point[1]];
};
//WIP: henüz kullanılmamalı
let fixRoad = (points, grid) => {
  let changes = Array(grid.length).fill().map(e=>[]);
  points.forEach((connectionGroup) => {
    connectionGroup.forEach((currPoint) => {
      let [direction, point] = currPoint;
      let [i, j] = point;
      let e = grid[i][j];
      if (!inBounds(point) || e[0] == -1) return;
      let currNeighbours = getNeighbours(point);
      let newConnections = getConnections(ROAD_TYPES_ARR[e[0]], e[1]).map(e=>currNeighbours[connectionLookup[e]]).filter(e=>{
        let currDirection = getRelativeDirection(point, e);
        let toBeDeleted = currDirection == direction;
        return (!inBounds(e) || grid[e[0]][e[1]][0] != -1) && !toBeDeleted;
      });
      changes[i][j] = findSuitableRoad(point, newConnections, grid);
    });
  });
  return changes;
};
let changeGrid = (changes, grid) => {
  changes.forEach((e, i) => e.forEach((e, j) => (grid[i][j] = e)));
  resetChanges(changes);
  return grid;
};
let resetChanges = (changes) => {
  changes.forEach((e, i) => {
    if (e.length) changes[i] = [];
  });
};
//WIP: henüz kullanılmamalı, muhtemelen tamamen değiştirilecek
let pruneRoads = (grid) => {
  return grid;
  //Aşama 1: birbirine bağlı olan ve diğer bağlı oldukları yer de birbirine bağlanan dönemeçler siliniyor. bunların yolların ulaşılabilirliğine bir etkisi yok
  let curveIndex = ROAD_TYPES_OBJ["rightcurve"];
  let threeIndex = ROAD_TYPES_OBJ["3"];
  let fourIndex = ROAD_TYPES_OBJ["4"];
  let changes = Array(grid.length).fill().map(e=>[]);
  grid.forEach((e, i) => e.forEach((e, j) => {
    if (e[0] != curveIndex) return;
    let point = [i, j];
    let currNeighbours = getNeighbours(point);
    let currentConnections = getConnections("rightcurve", e[1]).map(e=>[
      e,
      currNeighbours[connectionLookup[e]],
    ]);
    let found = currentConnections.find(
      e=>inBounds(e[1]) && grid[e[1][0]][e[1][1]][0] == curveIndex);
    let otherDirection = found && currentConnections.find(e=>e[1] != found[1])[0];
    let notCompatible = found && currentConnections.find(
      e=>found[1] != e[1] && inBounds(e[1]) && grid[e[1][0]][e[1][1]][0] != threeIndex && grid[e[1][0]][e[1][1]][0] != fourIndex);
    if (found && !notCompatible) {
      console.log("2");
      //TODO
      changes[i][j] = [-1, -1];
      let angle = grid[found[1][0]][found[1][1]][1];
      changes[found[1][0]][found[1][1]] = [-1, -1];
      let foundNeighbours = getNeighbours(found[1]);
      let foundConnections = getConnections("rightcurve", angle).map(e=>[
        e,
        foundNeighbours[connectionLookup[e]],
      ]);
      let foundNotCompatible = foundConnections.find(e=>{
        let currPoint = e[1];
        if (!inBounds(e[1])) return;
        let gridElement = grid[currPoint[0]][currPoint[1]];
        let isDifferent = currPoint[0] != point[0] || currPoint[1] != point[1];
        let isInvalidType = gridElement[0] != threeIndex && gridElement[0] != fourIndex;
        let isDifferentDirection = otherDirection && e[0] != otherDirection;
        return isDifferent && isInvalidType && isDifferentDirection;
      });
      if (foundNotCompatible) {
        delete changes[found[1][0]][found[1][1]];
        console.log("3");
        return;
      }
      console.log("4");
      grid = changeGrid(changes, grid);
      changes = fixRoad(
        [
          currentConnections.filter(e=>e != found),
          foundConnections.filter(
            e=>inBounds(e[1]) && (e[1][0] != i || e[1][1] != j)),
        ].filter(e=>e), grid);
      grid = changeGrid(changes, grid);
    }
  }));
  //TODO: Aşama 2: harita dışına çıkan yollar, kendilerine bağlanan şeylerin de düzenlenmesiyle birlikte siliniyor.
  //TODO: Aşama 3: rastgele bir yol bloğu, sebep olacağı bağlantı kopmasına rağmen yol bulunabilirliğine bakılarak siliniyor.
  return grid;
};
let copyVisitedObj = (x) => {
  let res = {};
  for (let e in x) {
    res[e] = {};
    for (let i in x[e]) {
      res[e][i] = x[e][i].slice(0);
    }
  }
  return res;
};
let manhattanHeuristic = (start, end) => {
  return Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]);
};
let getStartPoint = (grid) => {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    if (grid[0][y][0] != -1) return [0, y];
  }
};
let getCost = (roadTypeNumber, amount,roadCondition,problemAmount=0) => {
  let roadType = ROAD_TYPES_ARR[roadTypeNumber];
  //Ardışık düz yollar konforlu olacağı için tercih edilir
  //Ardışık dönemeçler konforsuz olacağı için tercih edilmez
  let conditionCost = ROAD_CONDITION_INDEXES[roadCondition]*2
  let problemCost = problemAmount*1.5
  switch (roadType) {
    case "straight":
      return Math.max(5, 10 - amount * 1.5)+conditionCost+problemCost;
    case "rightcurve":
      return Math.min(15, 10 + amount * 1.5)+conditionCost+problemCost;
    default:
      return 7.5+conditionCost+problemAmount
  }
};
let getCosts = (grid, curr = getStartPoint(grid), visitedObj, consecutiveRoadType = -1, consecutiveCoords = []) => {
  // consecutiveRoadType ilk değer yol tipinin sayı hali, ikincisi ondan kaç tane olduğu
  // consecutiveCoords ise o yol tipinin üst üste son denk geldiği koordinatlar
  //iTempGrid[curr[0]][curr[1]] = [ROAD_TYPES_OBJ[roadType], angle];
  let isInitial = !visitedObj;
  if (isInitial) visitedObj = {};
  let [currX, currY] = curr;
  if (currX < 0 || currX >= GRID_WIDTH || currY < 0 || currY >= GRID_HEIGHT) return false;
  if (!visitedObj[currX]) visitedObj[currX] = {};
  if (visitedObj[currX][currY]) return;
  let currGridElement = grid[currX][currY]
  let roadTypeNumber = currGridElement[0];
  let consecutiveAmount = consecutiveCoords.length;
  let isSameRoad = roadTypeNumber == consecutiveRoadType;
  if (isSameRoad) {
    consecutiveCoords.push(curr);
  }
  //son değer zaten aşağıda atanacak, o yüzden 1 eksik yapılıyor
  for (let i = 0; i < consecutiveAmount - 1; i++) {
    let e = consecutiveCoords[i];
    let currValue = visitedObj[e[0]][e[1]];
    let currCounter = currValue ? currValue[0] : 0;
    if (consecutiveAmount > currCounter) {
      let currCost = getCost(consecutiveRoadType,consecutiveAmount,ROAD_CONDITION_ARR[grid[e[0]][e[1]][2]])
      visitedObj[e[0]][e[1]] = [consecutiveAmount, currCost];
    }
  }
  if (!isSameRoad) {
    consecutiveRoadType = roadTypeNumber;
    consecutiveCoords = [curr];
  }
  visitedObj[currX][currY] = [1,getCost(consecutiveRoadType, consecutiveCoords.length,ROAD_CONDITION_ARR[currGridElement[2]])];
  let left = grid[currX][currY];
  if (left[0] == -1) return false;
  let leftNeighbours = getNeighbours(curr);
  let directionsAndConnections = getConnections(ROAD_TYPES_ARR[left[0]], left[1]).map(e=>[e, leftNeighbours[connectionLookup[e]]]);
  let leftConnections = directionsAndConnections.map(e=>e[1]);
  for (let i = 0; i < leftConnections.length; i++) {
    let next = leftConnections[i];
    getCosts(grid, next, visitedObj, consecutiveRoadType, consecutiveCoords);
  }
  return visitedObj;
};
export let findPath = (grid, pathAlgorithm, road1Indexes, road2Indexes, getMinimumDistance = false, forceInitialDirection, visited, visitedObj, lastDirection = forceInitialDirection) => {
  switch (pathAlgorithm) {
    case "A*": {
      const openSet = [
        [0, road1Indexes, [road1Indexes], forceInitialDirection],
      ];
      const gScore = {};
      gScore[road1Indexes.toString()] = 0;
      const costs = getCosts(grid);
      let isInitial = true;
      while (openSet.length > 0) {
        openSet.sort((a, b) => a[0] - b[0]);
        let [_, [currX, currY], path, currDirection] = openSet.shift();
        if (currX === road2Indexes[0] && currY === road2Indexes[1]) return path;
        let current = grid[currX][currY];
        if (!current || current[0] === -1) continue;
        let neighbours = getNeighbours([currX, currY]);
        let connections = getConnections(ROAD_TYPES_ARR[current[0]], current[1]).map(e=>neighbours[connectionLookup[e]]);
        // Apply forced direction constraint on the initial node
        if (isInitial && forceInitialDirection) {
          let forcedDirection = neighbours[connectionLookup[forceInitialDirection]];
          if (DIRECTION_ALTERNATIVE == 1) {
            if (connections.includes(forcedDirection)) {
              connections = [forcedDirection];
            }
          } else {
            connections = connections.filter(e=>e != forcedDirection);
          }
          isInitial = false;
        } else {
          connections = connections.filter((conn) => {
            let nextDirection = getRelativeDirection([currX, currY], conn);
            return nextDirection !== getOpposite(currDirection);
          });
        }
        for (let next of connections) {
          if (!inBounds(next)) continue;
          let [nextX, nextY] = next;
          let roadType = grid[nextX][nextY][0];
          if (roadType === -1) continue;
          let baseCost = costs[nextX][nextY]?.[1] || 10; //Gerekmemeli
          let tentative_gScore = gScore[[currX, currY].toString()] + baseCost;
          if (tentative_gScore < (gScore[next.toString()] || Infinity)) {
            gScore[next.toString()] = tentative_gScore;
            let fScore = tentative_gScore + manhattanHeuristic([nextX, nextY], road2Indexes);
            openSet.push([
              fScore,
              next,
              [...path, next],
              getRelativeDirection([currX, currY], next),
            ]);
          }
        }
      }
      return false;
    }
    case "UCS": {
      const queue = [
        [0, road1Indexes, [road1Indexes], forceInitialDirection]
      ];
      const costMap = {};
      const costs = getCosts(grid); //
      costMap[road1Indexes.toString()] = 0;
      let isInitial = true;
      while (queue.length > 0) {
        queue.sort((a, b) => a[0] - b[0]); // Cost a göre sırala
        let [cost, [currX, currY], path, currDirection] = queue.shift();
        if (currX === road2Indexes[0] && currY === road2Indexes[1]) {
          return path;
        }
        let left = grid[currX][currY];
        if (left[0] === -1) continue;
        let leftNeighbours = getNeighbours([currX, currY]);
        let leftConnections = getConnections(ROAD_TYPES_ARR[left[0]], left[1]).map(e=>leftNeighbours[connectionLookup[e]]);
        if (isInitial && forceInitialDirection) {
          let forcedDirection = leftNeighbours[connectionLookup[forceInitialDirection]];
          if (DIRECTION_ALTERNATIVE == 1) {
            if (leftConnections.includes(forcedDirection)) {
              leftConnections = [forcedDirection];
            }
          } else if (DIRECTION_ALTERNATIVE == 2) {
            leftConnections = leftConnections.filter(e=>e != forcedDirection);
          }
          isInitial = false;
        } else {
          leftConnections = leftConnections.filter((conn) => {
            let nextDirection = getRelativeDirection([currX, currY], conn);
            return nextDirection !== getOpposite(currDirection);
          });
        }
        for (let next of leftConnections) {
          if (!inBounds(next)) continue;
          let [nextX, nextY] = next;
          let roadType = grid[nextX][nextY][0];
          let baseCost = roadType !== -1 ? costs[nextX][nextY]?.[1] || 10 : Infinity;
          let nextDirection = getRelativeDirection([currX, currY], next);
          let newCost = cost + baseCost;
          if (newCost < (costMap[next.toString()] || Infinity)) {
            costMap[next.toString()] = newCost;
            queue.push([newCost, next, [...path, next], nextDirection]);
          }
        }
      }
      return false;
    }
    case "DFS":
    default: {
      let isInitial = !visited;
      if (isInitial) {
        visited = [];
        visitedObj = {};
      }
      visited.push(road1Indexes);
      let [currX, currY] = road1Indexes;
      let isAtInitial = currX == visited[0][0] && currY == visited[0][1];
      if (currX < 0 || currX >= GRID_WIDTH || currY < 0 || currY >= GRID_HEIGHT) return false;
      if (!visitedObj[currX]) visitedObj[currX] = {};
      if (currX == road2Indexes[0] && currY == road2Indexes[1]) {
        return visited;
      }
      let visitedArr = visitedObj[currX][currY];
      let opposite = getOpposite(lastDirection);
      if (visitedObj[currX][currY]) {
        if (!isAtInitial) {
          /* 
            Alternatif 1:
              dört yol gibi yollarda yolun farklı kısımlarından gelinebileceği ve bunun 
              şu an bulunan yerden geçmeyi gerektirebileceği için ilk gidilen yerden tekrar gidilebiliyor 
              ancak path'te geçildiği gösteriliyor
            Alternatif 2: 
              aracın gidebileceği değil, gidemeyeceği yön kısıtlanır ve ilk yola dair bir istisna olmaz
            
            ikisi beraber yapılmaya çalışırsa araç gidememesi gereken yerlerden gidebilir, yalnızca ilki yapılırsa yolu gerekirsiz uzatabilir veya gidebileceği yere gidemeyebilir, yalnızca ikincisi yapılırsa dörtyolda dönebileceği en geç noktadan daha geç olmasına rağmen dönmesi gerekecek şekilde rota ayarlanır
            Düşük ihtimal alternatif 3:
              her yol en az 2 parçaya ayrılır, gelinen ve içinde bulunulan yöne ait olmayan ihtimaller silinir
            
            */
          if (DIRECTION_ALTERNATIVE == 1) return;
        }
        if (DIRECTION_ALTERNATIVE == 2) return;
        //Belki bir önceki yolun izin vermesi durumunda ters yönden gelmeye izin verilebilir
        if (visitedArr.includes(lastDirection) || visitedArr.includes(opposite)) return false;
      } else visitedObj[currX][currY] = [];
      visitedObj[currX][currY].push(lastDirection);
      let left = grid[road1Indexes[0]][road1Indexes[1]];
      if (left[0] == -1) return false;
      let leftNeighbours = getNeighbours(road1Indexes);
      let directionsAndConnections = getConnections(ROAD_TYPES_ARR[left[0]], left[1]).map(e=>[e, leftNeighbours[connectionLookup[e]]]);
      let leftConnections = directionsAndConnections.map(e=>e[1]);
      let forcedIsArray = Array.isArray(forceInitialDirection);
      let forcedDirection = forceInitialDirection ? forcedIsArray ? forceInitialDirection.map(
        e=>leftConnections[connectionLookup[e]]) : leftNeighbours[connectionLookup[forceInitialDirection]] : null;
      if (isInitial && forceInitialDirection) {
        if (DIRECTION_ALTERNATIVE == 1) {
          if (leftConnections.includes(forcedDirection)) {
            leftConnections = [forcedDirection];
          }
        } else if (DIRECTION_ALTERNATIVE == 2) {
          leftConnections = leftConnections.filter(e=>e != forcedDirection);
        }
      }
      let currMinimumLength = Infinity;
      let res = false;
      for (let i = 0; i < leftConnections.length; i++) {
        let curr = leftConnections[i];
        let direction = directionsAndConnections[i][0];
        let tempRes = findPath(grid, null, curr, road2Indexes, getMinimumDistance, null, visited.map(e=>e), copyVisitedObj(visitedObj), direction);
        if (tempRes) {
          if (!getMinimumDistance) return tempRes;
          let tempLength = tempRes.length;
          if (tempLength < currMinimumLength) {
            currMinimumLength = tempLength;
            res = tempRes;
          }
        }
      }
      return res;
    }
  }
};
let imagePaths = {};
//Tüm resimler asenkron yükleniyor, hepsi yüklenene kadar bekleniliyor
await Promise.all(imagesArray.map(imgPath => new Promise(async (res) => {
    let currPath = "../assets/" + imgPath;
    let loaded = await PIXI.Assets.load(currPath);
    loaded.source.scaleMode = "nearest";
    let imageToUse = await changeImageResolution(loaded, intendedWidths[imgPath]);
    imagePaths[imgPath] = imageToUse;
    imagePaths[imgPath.split(".").slice(0, -1).join(".")] = imageToUse;
    res();
  })));
let sleep = (ms) => new Promise((res) => setTimeout(res, ms));
export let noop = () => {};
document.body.appendChild(app.canvas);
app.canvas.style = "";
app.canvas.id = "game";
export let toRadian = (x) => (x / 180) * Math.PI;
export let getMagnitude = Math.hypot;
export let toVector = (x) => [Math.cos(toRadian(x)), Math.sin(toRadian(x))];
export let toUnitVector = (x) => {
  let length = getMagnitude(x[0], x[1]);
  return [x[0] / length, x[1] / length];
};
export let dotProduct = (x, y) => {
  let product = 0;
  for (let i = 0; i < x.length; i++) product += x[i] * y[i];
  return product;
};
//stackoverflow.com/a/3461533
//PQ PR için
let crossProduct = (P, Q, R) => {
  return (Q[0] - P[0]) * (R[1] - P[1]) - (Q[1] - P[1]) * (R[0] - P[0]);
};
//3 noktanın birbirine göre yönü bulunurken 1 ve 2. noktaları oluşturan vektör ile 1. ve 3. noktaları oluşturan vektörün çapraz çarpımı yapılıyor
// 0 ise paralel, 1 ise birbirine göre saat yönündee, 2 ise saat yönünün tersinde
let getOrientation = (P, Q, R) => {
  const val = crossProduct(P, Q, R);
  if (val == 0) return 0;
  return val > 0 ? 1 : 2;
};
let isOnLineSegment = (P, Q, R) => {
  return (Q[0] < Math.max(P[0], R[0]) && Q[0] > Math.min(P[0], R[0]) && Q[1] < Math.max(P[1], R[1]) && Q[1] > Math.min(P[1], R[1]));
};
export let getLaneOffset = (direction, laneMultiplier, roadDivider = 8) => {
  const LINE_OFFSET = roadDivider > 0 ? ROAD_WIDTH / roadDivider : 0;
  let offsetArr = [
    [-LINE_OFFSET, 0],
    [0, -LINE_OFFSET],
    [LINE_OFFSET, 0],
    [0, LINE_OFFSET],
  ];
  let index = connectionLookup[direction];
  let [xOffset, yOffset] = offsetArr[index];
  xOffset *= laneMultiplier;
  yOffset *= laneMultiplier;
  return [xOffset, yOffset];
};
export let getLaneCoordinates = (direction, coords, laneMultiplier, roadDivider = 8) => {
  //laneMultiplier 1 ise sağ, -1 ise sol
  let [xOffset, yOffset] = getLaneOffset(direction, laneMultiplier, roadDivider);
  let targetX = coords[0] * ROAD_WIDTH + ROAD_WIDTH / 2 + xOffset;
  let targetY = coords[1] * ROAD_WIDTH + ROAD_WIDTH / 2 + yOffset;
  return [targetX, targetY];
};
// Cramer kuralı
// stackoverflow.com/a/14795484
export let getIntersectionPoint = (line1, line2) => {
  let [A, B] = line1;
  let [C, D] = line2;
  const [x1, y1] = A;
  const [x2, y2] = B;
  const [x3, y3] = C;
  const [x4, y4] = D;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denominator === 0) {
    return null;
  }
  const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
  const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
  return [intersectX, intersectY];
};
export let checkIntersects = (A, B, C, D) => {
  const o1 = getOrientation(A, B, C);
  const o2 = getOrientation(A, B, D);
  const o3 = getOrientation(C, D, A);
  const o4 = getOrientation(C, D, B);
  if (o1 != o2 && o3 != o4) return true;
  //0 olması durumunda paralel oluyor, paralel olması durumunda noktanın üzerindeyse kesişiyordur
  if (o1 == 0 && isOnLineSegment(A, C, B)) return true;
  if (o2 == 0 && isOnLineSegment(A, D, B)) return true;
  if (o3 == 0 && isOnLineSegment(C, A, D)) return true;
  if (o4 == 0 && isOnLineSegment(C, B, D)) return true;
  return false;
};
export let getIndexes = (x, y, anchorDiffX = 0, anchorDiffY = anchorDiffX) => [
  Math.floor((x - anchorDiffX) / ROAD_WIDTH),
  Math.floor((y - anchorDiffY) / ROAD_WIDTH),
];
//grid indisinden koordinat almamız için, yolun ortasına göre hesaplanıyor
export let getCoordinates = (x, y) => {
  return [(x + 0.5) * ROAD_WIDTH, (y + 0.5) * ROAD_WIDTH];
};
export let getDistance = (x,y)=>getMagnitude(x[0]-y[0],x[1]-y[1])
export let toDegree = (x) => (x / Math.PI) * 180;
export let getBounds = (sprite) => {
  let extracted = app.renderer.extract.pixels(sprite);
  let xMin = 255,
    yMin = 255,
    xMax = 0,
    yMax = 0;
  let pixels = extracted.pixels;
  let {
    width
  } = extracted;
  let pixelsLength = pixels.length;
  for (let i = 0; i < pixelsLength; i += 4) {
    let index = i / 4;
    let x = index % width;
    let y = Math.floor(index / width);
    let a = pixels[i + 3];
    if (a > 200) {
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  let retVal = [
    [xMin, yMin],
    [xMin, yMax],
    [xMax, yMin],
    [xMax, yMax],
  ];
  return retVal;
};
//farklı olarak nesnenin açısı da hesaba katılıyor
let getAbsoluteBounds = (entity)=>{
  let { posX, posY, _direction, anchorX, anchorY, bounds } = entity;
  let direction = _direction
  let xValues = bounds.map(([x]) => x);
  let yValues = bounds.map(([, y]) => y);
  let width = Math.max(...xValues) - Math.min(...xValues);
  let height = Math.max(...yValues) - Math.min(...yValues);
  let anchorOffsetX = width * anchorX;
  let anchorOffsetY = height * anchorY;
  return bounds.map(([relX, relY]) => {
      let offsetX = relX - anchorOffsetX;
      let offsetY = relY - anchorOffsetY;
      let rotatedX = Math.cos(direction) * offsetX - Math.sin(direction) * offsetY;
      let rotatedY = Math.sin(direction) * offsetX + Math.cos(direction) * offsetY;
      return [posX + rotatedX, posY + rotatedY];
  });
}
let getMinsAndMaxes = bounds=>{
  //sırasıyla xMin, xMax, yMin, yMax
  let xValues = bounds.map(([x])=>x)
  let yValues = bounds.map(([_,y])=>y)
  return [Math.min(...xValues),Math.max(...xValues),Math.min(...yValues),Math.max(...yValues)]
}
let isOverlapping = (bounds1, bounds2)=>{
  let [x1Min,x1Max,y1Min,y1Max]=getMinsAndMaxes(bounds1)
  let [x2Min,x2Max,y2Min,y2Max]=getMinsAndMaxes(bounds2)
  return (
      x1Min < x2Max &&
      x1Max > x2Min &&
      y1Min < y2Max &&
      y1Max > y2Min
  );
}
let getOverlap=(bounds1, bounds2)=>{ //getBounds değil getAbsoluteBounds kullanılmalı
  let [x1Min,x1Max,y1Min,y1Max]=getMinsAndMaxes(bounds1)
  let [x2Min,x2Max,y2Min,y2Max]=getMinsAndMaxes(bounds2)
  let dx = Math.min(x1Max, x2Max) - Math.max(x1Min, x2Min);
  let dy = Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min);
  return { dx, dy };
}
export let arrayEquals = (arr1, arr2) => {
  let len1 = arr1.length;
  let len2 = arr2.length;
  if (len1 != len2) return false;
  for (let i = 0; i < len1; i++)
    if (arr1[i] != arr2[i]) return false;
  return true;
};
export let unorderedArrayEquals = (arr1, arr2) => {
  let len1 = arr1.length;
  let len2 = arr2.length;
  if (len1 != len2) return false;
  //var olan değerleri etkilememek için
  //yeni gelen toSorted da olur
  arr1=arr1.slice(0).sort()
  arr2=arr2.slice(0).sort()
  for (let i = 0; i < len1; i++)
    if (arr1[i] != arr2[i]) return false;
  return true;
};
export let getSprite = (currSpritePath) => {
  let found = imagePaths[currSpritePath];
  return PIXI.Sprite.from(found);
};
export let getNormalizedAngle = (angle) => {
  return ((angle % 360) + 360) % 360;
};
let getNormalizedVector = vector=>{
  let mag = getMagnitude(vector[0],vector[1])
  return [vector[0]/mag,vector[1]/mag]
}
export function calculateVehicleProperties(roadCondition, isTurning = false, isBraking = false) {
  //turnDrag azalınca sürtünme artıyor
  let acceleration, drag, steering, turnDrag, turnLimiters, alignment;
  // Yol koşullarına göre hız, ivme ve sürtünme değerleri belirleniyor
  switch (roadCondition) {
    case "dirt":
      acceleration = 80;
      drag = 6;
      turnDrag = 1.2;
      alignment = 0.45;
      steering = 1.2;
      turnLimiters = [4.2, 1.25];
      break;
    case "slippery":
      acceleration = 70;
      drag = 3.2;
      turnDrag = 1.23;
      alignment = 0.6;
      steering = 1.4;
      turnLimiters = [3.7, 1.25];
      break;
    case "asphalt":
    default:
      // Varsayılan yol hızı
      acceleration = 90;
      drag = 5.1;
      turnDrag = 1.1;
      alignment = 0.5;
      steering = 1.4;
      turnLimiters = [4, 1.25];
  }
  if (isTurning) {
    acceleration *= 0.9;
  }
  if (isBraking) {
    turnDrag /= 2;
  }
  return {
    acceleration,
    drag,
    turnDrag,
    steering,
    turnLimiters,
    alignment
  };
}
app.stage.sortableChildren = true;
//recursive olarak noktanın bağlı olduğu yol olmayan (grid'deki ilk değer -1 olan) noktaların bulunmasını sağlıyor
let getConnectedEdge = (grid, curr, known = {}, arr = []) => {
  if (known[curr]) return;
  if (curr[0] < 0 || curr[0] >= GRID_WIDTH || curr[1] < 0 || curr[1] >= GRID_HEIGHT) return;
  let currNeighbours = getNeighbours(curr).filter(e=>grid[e[0]] && grid[e[0]][e[1]] && grid[e[0]][e[1]][0] === -1);
  known[curr] = true;
  arr.push(curr);
  currNeighbours.forEach(e=>getConnectedEdge(grid, e, known, arr));
  return arr;
};
//tüm kenarlardan en uzunu  alınıyor
let getEdge = (grid) => {
  return grid.map((e,i)=>e.map((e,i)=>[e,i /*y*/]).filter((e,i)=>e[0][0]==-1&&checkOnEdge([i,e[1]])).map((w) => {
    return [
      [i, w[1]], getConnectedEdge(grid, [i, w[1]])
    ];
  })).flat().sort((x, y) => y[1].length - x[1].length)?.[0]?.[1]; //0 sıralanmış array'deki max için, 1 istenen değer için
  //array normalde 2d olduğu için düzleştiriliyor
};
export let clearPath = (roads) => {
  roads.forEach(e=>e.forEach(e=>e.highlightToggles.forEach((_, i) => e.toggleHighlight(i, false))));
};
export let drawPath = (roads, currPath, clearPrevious = true) => {
  if (!currPath) return;
  if (currPath.length < PATH_START_INDEX) return;
  if (clearPrevious) {
    clearPath(roads);
  }
  let retVal;
  let lastRoadIndex = currPath[1];
  let lastRoad = roads[lastRoadIndex[0]][lastRoadIndex[1]];
  let lastConnections = getConnections(lastRoad.roadType, lastRoad._direction);
  if (currPath.length == PATH_START_INDEX) {
    let firstRoadIndex = currPath[0];
    let currentRelation = getRelativeDirection(firstRoadIndex, lastRoadIndex);
    return lastConnections.indexOf(currentRelation);
  }
  let length = currPath.length;
  //her yol için için gelinen ve gidilen yerdeki çizgi görünür hale getiriliyor
  //ilk yolların atlanma sebebi araçtan dinamik çizgi oluşturmak
  for (let i = PATH_START_INDEX; i < currPath.length; i++) {
    let currRoadIndex = currPath[i];
    let currentRelation = getRelativeDirection(lastRoadIndex, currRoadIndex);
    let currRoad = roads[currRoadIndex[0]][currRoadIndex[1]];
    let highlightInPrevious = getOpposite(currentRelation);
    let currentConnections = getConnections(currRoad.roadType, currRoad._direction);
    let indexLast = lastConnections.indexOf(highlightInPrevious);
    let indexCurr = currentConnections.indexOf(currentRelation);
    if (i == PATH_START_INDEX) {
      retVal = length == PATH_START_INDEX ? indexCurr : indexLast;
    }
    lastRoad.toggleHighlight(indexLast, true);
    currRoad.toggleHighlight(indexCurr, true);
    lastRoadIndex = currRoadIndex;
    lastRoad = currRoad;
    lastConnections = currentConnections;
  }
  return retVal;
};
const MAX_CORRECTION = 70
//aracın konum değişimi maksimumla sınırlı tutulup son hesaplanan yön değişimi yönünde ölçekleniyor
let adjustPosition = (entity, correctedX, correctedY) => {
  let deltaX = correctedX - entity.posX;
  let deltaY = correctedY - entity.posY;
  let correctionMagnitude = getMagnitude(deltaX,deltaY);
  if (correctionMagnitude > MAX_CORRECTION) {
    let scale = MAX_CORRECTION / correctionMagnitude;
    correctedX = entity.lastPosX + deltaX * scale;
    correctedY = entity.lastPosY + deltaY * scale;
  }
  entity.posX = correctedX;
  entity.posY = correctedY;
};
let resolveCollision = (dt,entity1,entity2,maxIterations,elasticity,correctionFactor,impulseCorrection)=>{
  let iteration = 0;
  while(iteration < maxIterations) {
    if(!PHYSICAL_THREATS.includes(entity2.entityType) || !PHYSICAL_THREATS.includes(entity1.entityType)) break;
    //yayalar yalnızca araçlarla etkileşime geçebilir
    if(entity1.entityType == "pedestrian"?entity2.entityType!="car":entity2.entityType=="pedestrian"?entity1.entityType!="car":false) break;
    let absBounds1 = getAbsoluteBounds(entity1);
    let absBounds2 = getAbsoluteBounds(entity2);
    if(!isOverlapping(absBounds1, absBounds2)) break;
    let overlap = getOverlap(absBounds1, absBounds2);
    let resolveXFirst = Math.abs(overlap.dx) > Math.abs(overlap.dy);
    let resolvedAny = false
    if (resolveXFirst && overlap.dx != 0) {
      let resolved = resolveAxis(0, overlap.dx, entity1, entity2, dt, elasticity, correctionFactor, impulseCorrection);
      resolvedAny||=resolved
    }else if(!resolveXFirst && overlap.dy !==0) {
      let resolved = resolveAxis(1, overlap.dy, entity1, entity2, dt, elasticity, correctionFactor, impulseCorrection);
      resolvedAny||=resolved
    }
    if(!resolvedAny||entity1.isImmovable||entity2.isImmovable)break
    iteration++;
  }
}
let resolveEntityCollisions = (dt,entity1,colliders,maxIterations,elasticity,correctionFactor,impulseCorrection)=>{
  for(let entity2 of colliders){
    resolveCollision(dt,entity1,entity2,maxIterations,elasticity,correctionFactor,impulseCorrection)
  }
}
let resolveAllCollisions = (dt, entities, maxIterations = 10, elasticity = 1, correctionFactor = 0.1, impulseCorrection = correctionFactor) => {
  for (let [entity1, colliders] of entities) {
    resolveEntityCollisions(dt,entity1,colliders,maxIterations,elasticity,correctionFactor,impulseCorrection)
  }
};
// araçların tek eksende çarpması durumunda diğer eksende hareket edebilmeleri için eksenlerin ayrı halledilmesi gerekiyor
// gamedev.stackexchange.com/a/160253
let resolveAxis = (axisIndex, overlapAmount, entity1, entity2, dt, elasticity, correctionFactor, impulseCorrection) => {
  let isX = axisIndex ==0;
  let normalizedNormal =overlapAmount //isX ? Math.sign(overlapAmount) : Math.sign(overlapAmount);
  let relativeVelocity = isX ? entity2.velX - entity1.velX : entity2.velY - entity1.velY;
  let relVelAlongNormal = relativeVelocity * normalizedNormal;
  let movableEntity, immovableEntity;
  if(!entity1.isCollisionEffected||!entity2.isCollisionEffected)return false
  if (entity1.isImmovable && !entity2.isImmovable) {
    immovableEntity = entity1;
    movableEntity = entity2;
  } else if (entity2.isImmovable && !entity1.isImmovable) {
    immovableEntity = entity2;
    movableEntity = entity1;
  }
  if (immovableEntity) {
    let correctedPos = isX 
    ? [movableEntity.lastPosX + overlapAmount  * dt, movableEntity.lastPosY] 
    : [movableEntity.lastPosX, movableEntity.lastPosY + overlapAmount  * dt];
    adjustPosition(movableEntity, correctedPos[0], correctedPos[1]);
    //if(movableEntity.isMain)console.log(isX,overlapAmount,relVelAlongNormal)
    if (relVelAlongNormal >= 0) return false;
    //if(isX)movableEntity.posX=movableEntity.lastPosX + overlapAmount*1.2 * dt
    //else movableEntity.posY=movableEntity.lastPosY + overlapAmount*1.2 * dt
    let impulse = -(1 + elasticity) * relVelAlongNormal // / (1 / movableEntity.mass);
    let impulseComponent = impulse * impulseCorrection;
    if (isX) {
      movableEntity.velX// +=  impulseComponent* dt;
    } else {
      movableEntity.velY// += impulseComponent * dt;
    }
  } else {
    if(overlapAmount<10)return false
    if (relVelAlongNormal >= 0) return false;
    // gamedev.stackexchange.com/a/5915
    //nokta çarpımı 0'dan büyükse birbirine doğru yönlendirmek gerekiyormuş
    //biz de böyle yapıyoruz ama genelleştirmeden dolayı, birbirine yönlenmelerini engellemek için >0 ise düzeltim yapılmıyor
    let posDifference = [entity1.posX-entity2.posX,entity1.posY-entity2.posY]
    let velDifference = [entity1.velX-entity2.velX,entity1.velY-entity2.velY]
    let currentProduct = dotProduct(posDifference,velDifference)
    if(currentProduct>0)return false
    let totalMass = entity1.mass + entity2.mass;
    let correction = overlapAmount * correctionFactor * dt;
    let correctedPos1 = isX
      ? [entity1.lastPosX - correction * (entity2.mass / totalMass), entity1.lastPosY]
      : [entity1.lastPosX, entity1.lastPosY - correction * (entity2.mass / totalMass)];
    let correctedPos2 = isX
      ? [entity2.lastPosX + correction * (entity1.mass / totalMass), entity2.lastPosY]
      : [entity2.lastPosX, entity2.lastPosY + correction * (entity1.mass / totalMass)];
    adjustPosition(entity1, correctedPos1[0], correctedPos1[1]);
    adjustPosition(entity2, correctedPos2[0], correctedPos2[1]);
    let impulse = -(1 + elasticity) * relVelAlongNormal / (1 / entity1.mass + 1 / entity2.mass);
    let impulseComponent = impulse * impulseCorrection;
    if (isX) {
      entity1.velX -= impulseComponent / entity1.mass * dt;
      entity2.velX += impulseComponent / entity2.mass * dt;
    } else {
      entity1.velY -= impulseComponent / entity1.mass * dt;
      entity2.velY += impulseComponent / entity2.mass * dt;
    }
  }

  return true;
};

let getPathCost = (grid,path)=>{
  let cost = 0
  let costs = getCosts(grid)
  path.forEach(block=>{
    cost+=costs[block[0]][block[1]][1]
  })
  return cost
}
//yol alt gridlerinin harita üzerinde nereye tekabül edeceğini gösteriyor, çoğunlukla min mesafe hesabı için
export let getAbsoluteGlobalSubgrid = (road,subgridIndex)=>{
  let roadIndex = road.gridIndexes
  let absIndex = getAbsoluteSubgridIndex(subgridIndex,road._direction)
  return [roadIndex[0]*3+absIndex[0]+1,roadIndex[1]*3+absIndex[1]+1]
}
export class Game {
  roads;
  map;
  entities = [];
  globalColliders = new Set();
  possibleStarts = [];
  destroyed = false;
  obstacleCounters = Object.fromEntries(Object.keys(OBSTACLES).map(e=>[e, 0]));
  minObstacles;
  maxObstacles;
  obstacleAmounts;
  possibleRoads = [];
  tickCounter = 0;
  wandererAmount = IS_PROD?4:10
  wanderers;
  resolveCollision=true
  lights=[]
  cars=[]
  gridEntitySets
  gameTick=0
  //mesafeye ve yol değişimlerine göre ışıkların süre ve renginin ayarlanması
  synchronizeLights(){
    let lightToLightAverage = []
    if(this.lights.length==1){
      this.lights[0].sync(DEFAULT_LIGHT_DISTANCE,0)
    }
    this.lights.forEach((light,i)=>{
      lightToLightAverage[i]=[]
      this.lights.forEach((otherLight,j)=>{
        if(i==j)lightToLightAverage[i][j]=[0,[]]
        let path=findPath(this.map,"UCS",light.parent.gridIndexes,otherLight.parent.gridIndexes)
        lightToLightAverage[i][j]=[getPathCost(this.map,path),this.path]
      })
    })
    lightToLightAverage.forEach((e,i)=>{
      let averages = e.map(e=>e[0]/(e[1]?.length||1))
      let minAverage = Math.min(...averages.filter(curr=>curr!=0))
      let minValue = Math.min(...e.map(e=>e[0]).filter(e=>e!=0))
      let val
      if(minAverage)val=DEFAULT_LIGHT_DISTANCE+minAverage*3
      else val=DEFAULT_LIGHT_DISTANCE
      this.lights[i].sync(val,(minValue||0)*10)
    })
    

  }
  createWanderer(fromEdge) {
    let possibleRoads = this.possibleRoads.filter(e=>{
      let isOnEdge = checkOnEdge(e)
      if(fromEdge&&!isOnEdge)return false
      let roadTypeFits = this.roads[e[0]][e[1]].roadType!="rightcurve"
      if(!roadTypeFits)return false
      return !this.cars.find(car=>arrayEquals(car.gridIndexes,e))
    })
    if(possibleRoads.length==0)return
    let wanderer = new Car(this);
    let road = getRandom(possibleRoads)
    road = this.roads[road[0]][road[1]];
    let direction = getRandom(getConnections(road.roadType, road._direction))
    //araçların sağ şeritte başlaması için
    //araçların baktığı değil geldiği yönü almamız gerektiği için tersini alıyoruz
    let laneOffset = getLaneOffset(getOpposite(direction),1,10)
    wanderer.setPosition(road.posX+laneOffset[0], road.posY+laneOffset[1]);
    wanderer.direction = connectionLookup[direction] * 90;
    wanderer.isWandering = true;
    wanderer.onIndexChange.push(() => {
      if (!inBounds(wanderer.gridIndexes)) {
        wanderer.destroy()
        this.createWanderer(true);
      }
    });
  }
  //boş gezen araçları açıyor, alttaki fonksiyona parametre olarak true verilmesi durumunda rastgele bir yerden değil, haritanın köşesideki yollardan doğuyorlar
  setWanderers() {
    for (let i = 0; i < this.wandererAmount; i++) {
      this.createWanderer(true);
    }
  }
  tick(dt) {
    //Hareket hesaplaması başına çağrılıyor
    this.entities.forEach((entity) => {
      entity.tick(dt);
    });
    if(this.resolveCollision){
      resolveAllCollisions(dt,this.globalColliders,20,0.3,0.9)
    }
    this.globalColliders = new Set();
    this.tickCounter++;
  }
  graphicsTick() {
    //Frame değişimi başına çağrılıyor
    this.entities.forEach(e=>e.setGraphics());
  }
  setMap() {
    this.map = pruneRoads(USE_TEST_DATA?testData[0]:createMap());
  }
  setRoads() {
    let roads = [];
    for (let i = 0; i < GRID_WIDTH; i++) {
      roads[i] = [];
      for (let j = 0; j < GRID_HEIGHT; j++) {
        let curr = this.map[i][j];
        if (curr[0] == -1) continue;
        if (i == 0 && curr[0] == 0 && (curr[1] == 90 || curr[1] == 270)) this.possibleStarts.push(j);
        let tempRoad = new Road(this, ROAD_TYPES_ARR[curr[0]], 0, curr[1], ROAD_CONDITION_ARR[curr[2]],curr[3]);
        roads[i][j] = tempRoad;
        this.possibleRoads.push([i, j]);
        tempRoad.setPosition(ROAD_WIDTH * i + ROAD_WIDTH / 2, ROAD_WIDTH * j + ROAD_WIDTH / 2);
      }
    }
    this.roads = roads;
  }
  fillEmpty() {
    //boş kısımların doldurulması
    let maxEdge = getEdge(this.map);
    let filled = {};
    if (maxEdge && maxEdge.length >= 2) {
      maxEdge.forEach(e=>{
        let currOcean = new Ocean(this);
        filled[e.join(",")] = true;
        let [i, j] = e;
        currOcean.setPosition(ROAD_WIDTH * (i + 0.5), ROAD_WIDTH * (j+0.5));
        let index = e
        let rawNeighbours = getNeighbours(index).map(e=>this.roads[e[0]]?.[e[1]])
        for(let i = 0;i<4;i++){
          let currentCouple = [rawNeighbours[i],rawNeighbours[(i+1)%4]]
          if(currentCouple[0]&&currentCouple[1]){
            let coupleIndexes = currentCouple.map(e=>e.gridIndexes)
            let currIndexX = coupleIndexes[0][0]==index[0]?coupleIndexes[1][0]:coupleIndexes[0][0]
            let currIndexY = coupleIndexes[0][1]==index[1]?coupleIndexes[1][1]:coupleIndexes[0][1]
            let roadIndex = [currIndexX,currIndexY]
            let road = this.roads[currIndexX]?.[currIndexY]
            if(!road)continue
            let angle = getSubgridAngle([roadIndex[0]-index[0],roadIndex[1]-index[1]])
            let absolute = getAbsoluteSubgridIndex([0,-1.8],angle,true)
            road.setSand(absolute[0],absolute[1],index,true)
          }
        }
        let neighbours = rawNeighbours.filter(e=>e)
        neighbours.filter(e=>e.entityType=="road").forEach(road=>{
          let roadIndex = road.gridIndexes
          let relativeDirection = getRelativeDirection(index,roadIndex)
          let angle = -connectionLookup[relativeDirection]*90;
          let absolute = [[-1,-1],[0,-1],[1,-1]].map(e=>getAbsoluteSubgridIndex(e,angle))
          absolute.forEach(subgridIndex=>{
            road.setSand(subgridIndex[0],subgridIndex[1],index)
          })
        })
      });
    }
    let fillers = [Building, Park];
    let fillersCounters = {};
    fillers.forEach(e=>(fillersCounters[e] = [0, -1]));
    fillersCounters[Park][1] = 1;
    this.map.forEach((e, i) => e.forEach((e, j) => {
      let key = [i, j].join(",");
      if (e[0] == -1 && !filled[key]) {
        filled[key] = true;
        let possibleFillers = fillers.filter(e=>fillersCounters[e][1] == -1 || fillersCounters[e][0] < fillersCounters[e][1]);
        let currClass = possibleFillers[Math.floor(Math.random() * possibleFillers.length)];
        fillersCounters[currClass][0]++;
        let filler = new currClass(this);
        filler.setPosition(ROAD_WIDTH * i + ROAD_WIDTH / 2, ROAD_WIDTH * j + ROAD_WIDTH / 2);
      }
    }));
  }
  setMapExtras(onlySpecified) {
    let currentObstacles = this.obstacleAmounts;
    let amountRange = [this.minObstacles, this.maxObstacles];
    let minCounter = 0;
    let maxCounter = 0;
    let obstaclesArray = [];
    for (let e in currentObstacles) {
      let o = currentObstacles[e];
      let val = o;
      if (typeof o === "number") {
        val = [o, o];
        currentObstacles[e] = val;
      }
      if (!(e in OBSTACLES_WITH_SIGN)) obstaclesArray.push([e, val]);
      let [currMin, currMax] = val;
      minCounter += currMin;
      maxCounter += currMax;
    }
    amountRange[0] = Math.max(minCounter, amountRange[0]);
    //yalnızca belirtilen değerlerin oluşturulması için
    let obstacleAmount;
    if (onlySpecified) {
      amountRange[1] = Math.max(minCounter, maxCounter); // max kısmı normalde gerekmemeli
      obstacleAmount = Math.floor(Math.random() * (amountRange[1] - amountRange[0])) + amountRange[0];
    } else {
      //diğer obstacle"lar da max değer ulaşılana kadar obstaclesArr"a eklenir
      let remainingObstacles = Object.keys(OBSTACLES).filter(e=>{
        //nesnesi olan levhalar direkt eklenmemeli, zaten nesne eklendiğinde levhası da beraberinde eklenecek
        if (OBSTACLE_SIGNS.includes(e)) return false;
        //halihazırda belirlenmiş olan nesnelerin değeri güncellenmeyecek
        if (e in currentObstacles) return false;
        return true;
      }).map(e=>[e,OBSTACLES[e].weight||1])
      if (!remainingObstacles.length) {
        //miktarı belirlenebilecek nesne yoksa hepsi önceden belirlenmiştir
        onlySpecified = true;
        amountRange[1] = Math.max(minCounter, maxCounter);
        obstacleAmount = Math.floor(Math.random() * (amountRange[1] - amountRange[0])) + amountRange[0];
      } else {
        obstacleAmount = Math.floor(Math.random() * (amountRange[1] - amountRange[0])) + amountRange[0];
        let remainingAmount = obstacleAmount - minCounter;
        while (remainingAmount > 0) {
          let randomObstacleName = getWeightedRandom(remainingObstacles)
          //aşağıya yakın random
          let randomAmount = Math.ceil(Math.random() * 2)
          remainingAmount -= randomAmount;
          //tek seferde birden fazla yerleştirince yüksek miktarlarda yerleştirilebilecek yerler bi oranda değişiyor
          obstaclesArray.push([randomObstacleName, 0, randomAmount]);
        }
      }
    }
    let collectiveObstacles =[]
    //engel seçimi şeklini değiştirdikten sonra geriye dönük uyumluluk için seçilen engeller her biri bir tane olup tümünün miktarını içerecek şekilde toplanıyor
    obstaclesArray.forEach(e=>{
      let foundIndex = collectiveObstacles.findIndex(curr=>curr[0]==e[0])
      if(foundIndex==-1){
        collectiveObstacles.push(e)
      }else collectiveObstacles[foundIndex][2]+=e[2]
    })
    for (let i = 0; i < obstacleAmount; i++) {
      //önce minimum gereksinimi olan ve henüz sağlanmayanlar ayarlanır
      let randomObstacles = collectiveObstacles.filter(e=>e[1] > 0 && this.obstacleCounters[e[0]] < e[1]);
      if (!randomObstacles.length) {
        randomObstacles = collectiveObstacles.filter(e=>{
          return this.obstacleCounters[e[0]] < e[2];
        });
      }
      let randomObstacle = getRandom(randomObstacles);
      if (!randomObstacle) return false;
      let [obstacleName] = randomObstacle;
      //Tüm yollardan levhası olmayan engel sayısı 2'den az olanları filtreliyoruz
      //levhası olmayanlar ya levhadır ya da levhasıyla beraber gelmiyordur
      // nesne ve levhasını ayrı ayrı saymamak için gerekiyor
      let currRoads = shuffle(this.possibleRoads.filter(e=>{
        let road = this.roads[e[0]][e[1]]
        if(!OBSTACLES[obstacleName].roadTypes.includes(road.roadType))return false
        let currObstacleOptions = OBSTACLES[obstacleName]
        let roadTypeEqual = currObstacleOptions.roadCondition==road.roadCondition
        //xor
        if(roadTypeEqual==currObstacleOptions.roadConditionInverted)return false
        let tempObstacles = road.obstacles.filter(e=>{
          return !OBSTACLES_WITH_SIGN[e];
        });
        return tempObstacles.length < 2;
      }))
      if (!currRoads.length)continue;
      let hasSign = obstacleName in OBSTACLES_WITH_SIGN;
      let currRoadIndex
      let randIndex
      let failedToSet = false
      let noRemainingRoads = false
      let obstacle
      do{
        if(failedToSet){
          currRoads.splice(randIndex,1)
        }
        let remainingLength = currRoads.length
        if(remainingLength==0){
          noRemainingRoads=true
          break
        }
        randIndex=Math.floor(Math.random() * remainingLength)
        currRoadIndex = currRoads[randIndex];
        let [indexX, indexY] = currRoadIndex;
        let road = this.roads[indexX][indexY]
        if(failedToSet){
          obstacle.changeRoadCondition(road.roadCondition)
        }else{
          //yalnızca ilk iterasyonda çalışıyor, aksi takdirde sonraki iterasyon gerçekleşmezdi zaten
          obstacle=new Obstacle(this, obstacleName,road.roadCondition);
        }
        let succesful = obstacle.setRoad(indexX,indexY)
        failedToSet=!succesful
      }while(failedToSet)
      if(noRemainingRoads){
        obstacle.destroy()
        continue
      }
      if(obstacle.entityType=="yayaGecidi"){
        obstacle.addPedestrian()
      }
      if (hasSign) {
        let laneAmount = obstacle.usedLanes
        //engel yolun ortasına göre solda veya üstteyse diğer yöndedir (diğer yön=başlangıç yolunun (0,n) bakış açısından sol şeritten gelen yön)
        let isOtherDirection = obstacle.relativeDirection=="left"||obstacle.relativeDirection=="up"
        //çift şeritte bulunan nesnelerden dolayı tek koşula alınmıyor
        //bir engel için iki adet levha oluşturulabileceğinden iki koşulun ayrı ayrı da çalışabilmesi gerekiyor
        if(isOtherDirection||laneAmount==2){
          //engel sol şeritte, levhası sağda olmalı
          obstacle.setCompatibleSign(true,2)
          
        }
       if(!isOtherDirection||laneAmount==2){
        //levhası solda olmalı
        obstacle.setCompatibleSign(false,2)
       }
      }
    }
    if (obstacleAmount < this.maxObstacles) {
      let remaining = this.maxObstacles - obstacleAmount;
      let chosenAmount = 10||Math.max(remaining,2)+Math.floor(Math.random()*2)//normalde kalan engel miktarı kadar, aksi takdirde 2+ adet ışık
      let remainingRoads = shuffle(this.possibleRoads.filter(e=>{
        let road = this.roads[e[0]][e[1]]
        return road.roadCondition!="dirt"&&road.obstacles.length == 0
      }))
      let toAdd = Math.min(remainingRoads.length, chosenAmount);
      for (let i = 0; i < toAdd; i++) {
        let light = new Light(this);
        let roadIndexes
        let failed = false
        let noRoads = false
        do{
          if(remainingRoads.length==0){
            noRoads=true
            break
          }
          roadIndexes = remainingRoads[0];
          remainingRoads.splice(0,1)
          let succesful = light.setRoad(roadIndexes[0], roadIndexes[1])
          failed=!succesful
        }while(failed)
        if(noRoads){
          light.destroy()
          break
        }
        let globalIndex = getAbsoluteGlobalSubgrid(light.parent,light.subgridIndexes)
        let subgridNeighbours = getNeighbours(globalIndex)
        let maxTries = 8
        let tries = 0
        while(this.lights.find(e=>{
          let curr = getAbsoluteGlobalSubgrid(e.parent,e.subgridIndexes)
          return subgridNeighbours.find(neighbour=>arrayEquals(curr,neighbour))
        })){
          tries++
          let status = light.setRoad(roadIndexes[0],roadIndexes[1])
          if(!status||tries==maxTries-1){
            failed=true
            light.destroy()
            break
          }
        }
        if(failed){
          continue
        }
        let otherLight = new Light(this,true);
        otherLight.setRoad(roadIndexes[0], roadIndexes[1]);
        otherLight.subgridIndexes = light.subgridIndexes;
        otherLight.chosenLane = light.chosenLane * -1;
        otherLight.setRelativePosition();
      }
      this.synchronizeLights()
    }
    return true;
  }
  //her nesnenin kendini dinamik olarak ekleyip çıkaracağı collision kontrolünü hızlandırma amaçlı kümeler
  setGridEntitySets(){
    this.gridEntitySets=Array(GRID_WIDTH).fill().map(()=>Array(GRID_HEIGHT).fill().map(e=>new Set()))
  }
  destroy() {
    this.destroyed = true;
    if (this.stage) {
      while (this.stage.children[0]) this.stage.removeChild(stage.children[0]);
    }
    this.entities.forEach(e=>e.destroy());
  }
  constructor(stage,gameTick, obstacleAmounts = {}, onlySpecified = false, maxObstacles = IS_PROD?12:30, minObstacles = IS_PROD?8:20) {
    this.gameTick=gameTick
    this.minObstacles = minObstacles;
    this.maxObstacles = maxObstacles;
    this.obstacleAmounts = obstacleAmounts;
    this.stage = stage;
    this.setGridEntitySets()
    this.setMap();
    this.setRoads();
    this.fillEmpty();
    this.setMapExtras(onlySpecified);
  }
}