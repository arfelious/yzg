/*
    PRIORITY:
          model
          şerit takip düzeltme
          tehdit algılama düzeltme
          collision resolution
    TODO:
          GENEL OPTİMİZASYON
          sabit nesne collision
          normal collision
          ışık sınır
          resim isimleri ve koddaki halleri tutarlı hale getirilecek, boşluklu isimler vs. düzeltilecek
      MAYBE:
        budama
        model basıyor olsa da basılan butonlar WASD kısmında gösterilmeli
*/
// \s*\?\s*([.?])\s* ?$1
// "([^"]*)' "$1"
// \(e\)\s*=>[\n\s]* e=>
// Sabitler
export const WIDTH = 1200;
export const HEIGHT = 900;
export const ROAD_WIDTH = 150;
export const GRID_WIDTH = WIDTH / ROAD_WIDTH;
export const GRID_HEIGHT = HEIGHT / ROAD_WIDTH;
export const CAR_WIDTH = 48;
export const DRAG = 4.4; // increases drag when increased
export const TURN_DRAG = 1.2;
export const MOVE_MULTIPLIER = 100; // acceleration, should be increased when drag is increased
export const STEERING_MULTIPLIER = 1.6;
export const MIN_ALIGNMENT = 0.7;
export const PATH_START_INDEX = 2;
export const BUILDING_MULTIPLIER = 0.9;
export const LIGHT_CHANGE_TICK = 700;
export const DEFAULT_LIGHT_DISTANCE = 200
export const PEDESTRIAN_MOVE_MULTIPLIER = 50
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
const IS_DEBUG = false; //Yapılacak değişiklik engine.mjs üzerinde değilse kapalı kalsın, diğer şeyleri etkilemediğini kontrol etmek için kullanılacak
const IS_PROD = false
const DIRECTION_ALTERNATIVE = 1; // 1 ya da 2 olabilir, kullanım gerekçeleri yorum olarak açıklandı
const PERSPECTIVE = [0.5, 0.5]; // Binalar varsayılan olarak ortadan bakan birinin göreceği şekilde 3d çiziliyor, başka oyunlarda yine kuş bakışı olmasına rağmen yukarıdan veya aşağıdan bakılmış gibi çizenler olmuş, belirtilen değerler sırasıyla genişlik ve yüksekliğe göre ölçekleniyor
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
const THREATS = ["rogar","bariyer","cukur","car","road","pedestrian"]
const REAL_THREATS = ["rogar","bariyer","cukur","car","pedestrian"]

const PHYSICAL_THREATS = ["car","pedestrian","building","side"]
const NONPHYSICAL_THREATS = ["yayaGecidi","light","kasis"]
const ROAD_TYPES_ARR = ["straight", "rightcurve", "3", "4"];
const CAR_SPRITES = [["car2.png",true,0.3,1],["temp_car.png",true,0.3,1]]
//total 1 olmaları gerekmiyor
const ROAD_CONDITION_WEIGHTS = {
  asphalt: 0.7,
  dirt: 0.2,
  slippery: 0.2
};
const ROAD_CONDITION_ARR = ["asphalt","dirt","slippery"]
const ROAD_CONDITION_INDEXES = {
  asphalt:0,
  dirt:1,
  slippery:2
}
let withoutCurve = ROAD_TYPES_ARR.filter(e=>e!="rightcurve")
const OBSTACLES = {
  rogar: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH * 3/2,
    image: "rogarKapagi.png",
    useWidthAsHeight: true,
    isRotated: true,
    lanes: 1,
    directionOffset: 90,
    roadCondition:"dirt",
    roadConditionInverted:true, //neler olsun neler olmasın demek yerine eğer sadece biri olmayacaksa olacaklara onu belirtip koşulun ters olacağnı belirtmek için bunu true yapıyoruz
    weight:2
  },
  cukur: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH,
    image: "cukur.png",
    useWidthAsHeight: false,
    lanes: 1,
    directionOffset: 90,
    roadCondition:"dirt",
    roadConditionInverted:false,
    weight:3
  },
  bariyer: {
    isOnRoad: true,
    roadTypes: ["straight"],
    width: CAR_WIDTH*15/18,
    image: "bariyer.png",
    useWidthAsHeight: true,
    lanes: 1,
    roadCondition:"dirt",
    roadConditionInverted:true,
    isImmovable:true,
    weight:2
  },
  bariyerLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH*2/3,
    width: CAR_WIDTH*2/3,
    image: "bariyerLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"dirt",
    roadConditionInverted:true
  },
  kasis: {
    isOnRoad: true,
    roadTypes: ["straight"],
    width: ROAD_WIDTH / 2,
    image: "kasis.png",
    useWidthAsHeight: true,
    lanes: 2,
    roadCondition:"asphalt",
    roadConditionInverted:false
  },
  kasisLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH,
    image: "kasisLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"asphalt",
    roadConditionInverted:false
  },
  hizSiniriLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH*3/4,
    image: "hiz.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"dirt",
    roadConditionInverted:true
  },
  hizSiniriKaldirmaLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH*2/3,
    image: "hizLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"dirt",
    roadConditionInverted:true,
    weight:0.25
  },
  yayaGecidi: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH/2,
    height:ROAD_WIDTH/2,
    imagePerRoad: {asphalt:"yayayoluasfalt.png",slippery:"yayayolukaygan.png"},
    useWidthAsHeight: true,
    directionOffset:270,
    lanes: 2,
    roadCondition:"dirt",
    roadConditionInverted:true,
    weight:0.5
  },
  yayaGecidiLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: (CAR_WIDTH * 2) / 3,
    image: "lvh2.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"asphalt",
    roadConditionInverted:false
  },
  puddle: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: (CAR_WIDTH * 2) / 3,
    image: "birikinti.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"slippery",
    roadConditionInverted:false
  },
  stopLevha: {
    isOnRoad: false,
    roadTypes: ["4"],
    width: (CAR_WIDTH * 2) / 3,
    image: "lvh.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition:"slippery",
    roadConditionInverted:true,
    crossOnly:true,
    weight:0.5
  },
};
const OBSTACLE_SIGNS = [];
const OBSTACLES_WITH_SIGN = Object.fromEntries(Object.keys(OBSTACLES).filter(e=>{
  let signKey = e + "Levha";
  let retVal = signKey in OBSTACLES;
  if (retVal) {
    OBSTACLE_SIGNS.push(signKey);
  }
  return retVal;
}).map(e=>[e, 1]));
const OBSTACLE_IMAGES = Object.values(OBSTACLES).map(e=>e.imagePerRoad?Object.values(e.imagePerRoad):e.image).flat();
const OBSTACLE_IMAGE_TO_NAME = Object.fromEntries(Object.entries(OBSTACLES).map(e=>e[1].imagePerRoad?Object.values(e[1].imagePerRoad).map(img=>[img,e[0]]):[[e[1].image, e[0]]]).flat())
// Farklı uzantıları olsa bile aynı ismi birden fazla resimde kullanmamamız gerekiyor, zaten karışıklık olurdu
const TYPE_TO_IMAGE = {
  asphalt: {
    straight: "duzyol.png",
    rightcurve: "yol1.png",
    3: "yol3.png",
    4: "dortyol.png",
  },
  dirt: {
    straight: "toprakyol1.png",
    rightcurve: "toprakyol2.png",
    3: "toprakyol3.png",
    4: "toprakyol4.png",
  },
  slippery: {
    straight: "kayganyol1.png",
    rightcurve: "kayganyol2.png",
    3: "kayganyol3.png",
    4: "kayganyol4.png",
  },
};
const ROAD_IMAGES = Object.values(TYPE_TO_IMAGE).map(e=>Object.values(e)).flat()
const LIGHT_IMAGES = ["k-ısık.png", "s-ısık.png", "y-ısık.png", "kapalı_ısık.png"];
const ROAD_TYPES_OBJ = Object.fromEntries(ROAD_TYPES_ARR.map((e, i) => [e, i]));
const BUILDING_TOPS = ["bina_test.png","cati1.png"]
const BUILDING_SIDES = ["bina_yan.png","bina1.png"]
const PEDESTRIANS = ["yaya.png","yaya2.png","yaya3.png"]
const CAR_IMAGES = CAR_SPRITES.map(e=>e[0])
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
const ROAD_TYPES = {
  straight: [0, 180],
  rightcurve: [90, 180],
  3: [0, 90, 270],
  4: [0, 90, 180, 270],
};
let angleLookup = {
  0: "up",
  90: "right",
  180: "down",
  270: "left",
};
let connectionArray = ["up", "right", "down", "left"];
let connectionLookup = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};
const LINE_AMOUNTS = {
  straight: 4,
  4: 8,
  3: 5,
  rightcurve: 10,
};
const CHANCE_ROAD_WEIGHTS = {
  3: 0.5,
  4: 0.5,
};
const LIGHT_STATES = ["RED", "YELLOW", "GREEN"];
let startTime = Date.now();
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
let checkIsOnRoad = (entity,road)=>{
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
function getConnections(roadType, angle) {
  return shiftConnections(ROAD_TYPES[roadType].map(e=>angleLookup[e]), angle);
}
//her yol 9 kısma bölünebilir, bunlardan yol olmayanlara levha, olanlara engel yerleştirilebilir
let getSubgridAngle = (index) => {
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
let getAbsoluteSubgridIndex = (absIndex, offsetAngle,noRound=false) => {
  if (absIndex[0] == 0 && absIndex[1] == 0) return absIndex;
  let currAngle = getSubgridAngle(absIndex);
  let magnitude = getMagnitude(absIndex[0],absIndex[1])
  if(noRound)return getAbsoluteIndexNoRound(currAngle + offsetAngle,magnitude)
  return getSubgridIndex(currAngle + offsetAngle,magnitude);
};
let getRandom = arr=>arr[Math.floor(Math.random()*arr.length)]
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
let getPossibleSubgrids = (roadType, angle, isOnRoad) => {
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
let getOpposite = (direction) => {
  return connectionArray[(connectionLookup[direction] + 2) % 4];
};
let getNextDirection = (roadType, angle, fromDirection, possibleDirections, facingDirection) => {
  if (!possibleDirections) possibleDirections = getConnections(roadType, angle);
  return roadType == "4" ? getOpposite(fromDirection) : roadType == "3" ? angleLookup[angle] == fromDirection ? possibleDirections.find(e=>e != fromDirection) : getOpposite(fromDirection) : roadType == "rightcurve" ? facingDirection ? possibleDirections.find(e=>e == facingDirection) || possibleDirections.find(e=>e != fromDirection) : possibleDirections.find(e=>e != fromDirection) : possibleDirections.find(e=>e != fromDirection);
};
let getRelativeDirection = (p1, p2) => {
  //p1 p2'ye gidiyorsa hangi yönden geldiği
  let xDiff = p2[0] - p1[0];
  let yDiff = p2[1] - p1[1];
  return xDiff > 0 ? "left" : xDiff < 0 ? "right" : yDiff > 0 ? "up" : "down";
};
let getRelativeDirectionList = (p1,p2)=>{
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
let inBounds = (point) => point[0] >= 0 && point[0] < GRID_WIDTH && point[1] >= 0 && point[1] < GRID_HEIGHT;
let checkOnEdge = point=>point[0]==0||point[0]==GRID_WIDTH-1||point[1]==0||point[1]==GRID_HEIGHT-1
let shuffle = (x) => {
  for (let i = 0; i < x.length; i++) {
    let randIndex = Math.floor(Math.random() * (x.length - i)) + i;
    [x[i], x[randIndex]] = [x[randIndex], x[i]];
  }
  return x;
};
let randomAngles = () => shuffle([0, 90, 180, 270]);
let getNeighbours = (point) => [
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
let noop = () => {};
document.body.appendChild(app.canvas);
app.canvas.style = "";
app.canvas.id = "game";
let toRadian = (x) => (x / 180) * Math.PI;
let getMagnitude = Math.hypot;
let toVector = (x) => [Math.cos(toRadian(x)), Math.sin(toRadian(x))];
let toUnitVector = (x) => {
  let length = getMagnitude(x[0], x[1]);
  return [x[0] / length, x[1] / length];
};
let dotProduct = (x, y) => {
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
let getLaneOffset = (direction, laneMultiplier, roadDivider = 8) => {
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
let getLaneCoordinates = (direction, coords, laneMultiplier, roadDivider = 8) => {
  //laneMultiplier 1 ise sağ, -1 ise sol
  let [xOffset, yOffset] = getLaneOffset(direction, laneMultiplier, roadDivider);
  let targetX = coords[0] * ROAD_WIDTH + ROAD_WIDTH / 2 + xOffset;
  let targetY = coords[1] * ROAD_WIDTH + ROAD_WIDTH / 2 + yOffset;
  return [targetX, targetY];
};
// Cramer kuralı
// stackoverflow.com/a/14795484
let getIntersectionPoint = (line1, line2) => {
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
let checkIntersects = (A, B, C, D) => {
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
let getDistance = (x,y)=>getMagnitude(x[0]-y[0],x[1]-y[1])
let toDegree = (x) => (x / Math.PI) * 180;
let getBounds = (sprite) => {
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
let getSprite = (currSpritePath) => {
  let found = imagePaths[currSpritePath];
  return PIXI.Sprite.from(found);
};
let getNormalizedAngle = (angle) => {
  return ((angle % 360) + 360) % 360;
};
let getNormalizedVector = vector=>{
  let mag = getMagnitude(vector[0],vector[1])
  return [vector[0]/mag,vector[1]/mag]
}
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
  lastPosX=0
  lastPosY=0
  savedDirection=0
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
  drawCollision = false
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
  mass=null
  massMultiplier=1
  subgridEntities=[]
  isChild=false
  currentGridsArray=[]
  setSand(subgridX,subgridY,oceanIndex,isSmall=false){
    let sand = new Sand(this.game,this,[subgridX,subgridY],oceanIndex,isSmall)
    this.subgridEntities.push([sand.subgridIndexes,sand])
  }
  getGrids() {
    let lines = this.getLines();
    let points = lines.map(e=>e[0]);
    let currentGridsArray = points.map(e=>getIndexes(e[0], e[1]))
    this.currentGridsArray=currentGridsArray
    return new Set(currentGridsArray)
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
  getRoundedDirection(useVisualDirection=false) {
    let direction = getNormalizedAngle(useVisualDirection?this.direction:this._direction)
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
  getRelevantEntities(){
    // array'deki harita sınırı dahilindeki her set array'e çevriliyor, array içinde array olmaması için düzleştiriliyor
    return this.currentGridsArray.filter(inBounds).map(e=>[...this.game.gridEntitySets[e[0]][e[1]]]/* set'ten array'e çevirmek için */).flat()
  }
  getColliders() {
    if (!this.isCollisionEffected) return [];
    let currLines = this.getLines();
    return this.getRelevantEntities().filter(e=>{
      if (e == this || e.entityType == "sensor"||e.entityType=="sand") return false;
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
    if(this.height&&!this.width)this.width=this.height/this.ratio
    this.spriteWidth = this.spriteWidth??this.width;
    this.scale = this.spriteWidth / wh.width;
    this.height = this.height??(this.forceSquare ? this.spriteWidth : this.spriteWidth * this.ratio);
    this.mass=this.mass??(this.width*this.height)*this.massMultiplier/10
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
    ].map(e=>e * this.scale);
    app.stage.addChild(this.childContainer);
    if(this.width==ROAD_WIDTH)this.childContainer.zIndex=this.zIndex+1
    if (this.createGraphics) {
      this.graphics = new PIXI.Graphics();
      this.graphics.zIndex = 1;
      this.lines = Array(this.collisionLineAmount).fill().map(() => new PIXI.Graphics());
      this.lines.forEach(e=>{
        e.setStrokeStyle(0x099ff);
        e.zIndex = 1;
      });
      this.collisionGraphics = new PIXI.Graphics();
      this.childGraphics.push(this.graphics, this.collisionGraphics, ...this.lines);
      this.childGraphics.forEach(e=>{
        app.stage.addChild(e);
      });
      this.boundingRect = this.scaledBounds.map((e, i) => 
      e - (i == 0 ? this.sprite.width * this.anchorX : i == 1 ? this.sprite.height * this.anchorY : 0));
      this.drawGraphics();
    }
  }
  a = 0;
  getSurroundingLines(){
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
    return this.cachedLines = this.getSurroundingLines()
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
    this.lastPosX=this.posX
    this.lastPosY=this.posY
    this.posX = x;
    this.posY = y;
    this.gridIndexes = getIndexes(x, y, this.anchorX * this.width, this.anchorY * this.height);
    this.cachedLines = null;
    let lastGrids = this.currentGrids
    this.currentGrids = this.getGrids();
    this.resetGridSets(lastGrids)
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
    if(!this.isChild)app.stage.addChild(sprite);
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
  resetGridSets(lastGrids){
    if(lastGrids){
      //belki manuel döngüden daha hızlıdır
      let diff = lastGrids.difference(this.currentGrids)
      let diffSize = diff.size
      if(diffSize>0){
        diff.forEach(e=>inBounds(e)&&this.game.gridEntitySets[e[0]][e[1]].delete(this))
      }
      let added = this.currentGrids.difference(lastGrids)
      let addedSize = added.size
      if(addedSize>0){
        added.forEach(e=>inBounds(e)&&this.game.gridEntitySets[e[0]][e[1]].add(this))
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
    } else if(!this.destroyed){
      this.cachedLines = null;
      let lastGrids = this.currentGrids
      this.currentGrids = this.getGrids();
      this.resetGridSets(lastGrids)
    }
  }
  destroy() {
    let lastGrids = this.currentGrids
    this.currentGrids=new Set()
    this.resetGridSets(lastGrids)
    this.shouldDraw = false;
    this.destroyed = true;
    this.game.entities.splice(this.game.entities.indexOf(this), 1);
    if (this.sprite) this.sprite.destroy();
    if (this.childGraphics) {
      this.childGraphics.forEach(e=>e.destroy());
    }
    if (this.childContainer) {
      this.childContainer.children.forEach(e=>e.destroy());
      this.childContainer.destroy();
    }
    this.tick=noop
  }
  constructor(game) {
    this.game = game;
    this.game.entities.push(this);
  }
}
export class Sand extends Entity{
  anchorX=0.5
  anchorY=0.5
  isChild=true
  zIndex=3
  parent;
  subgridIndexes
  isImmovable=true
  constructor(game,parent,subgrid,oceanIndex,isSmall=false){
    super(game)
    this.parent=parent
    this.entityType="sand"
    let relativeSubgrid = getAbsoluteSubgridIndex(subgrid,this.parent._direction,true)
    let subgridWidth = ROAD_WIDTH/3
    let smallSideWidth = ROAD_WIDTH/4
    let sizeDiff = subgridWidth-smallSideWidth
    let parentIndexes = this.parent.gridIndexes
    let oceanAngle = getSubgridAngle([oceanIndex[0]-parentIndexes[0],oceanIndex[1]-parentIndexes[1]])
    this.width=!isSmall&&oceanAngle%90==0?subgridWidth:smallSideWidth
    this.height=isSmall||this.width==subgridWidth?smallSideWidth:subgridWidth
    if(isSmall){
      //TODO: gerçek offset bulunacak. şu anki değerlerin matematiksel anlamı çok yok
      this.width+=Math.floor(sizeDiff/2/Math.sqrt(2)) 
      this.height+=Math.floor(sizeDiff/2/Math.sqrt(2))
    }
    this.sprite="sand"
    this.parent.childContainer.addChild(this.sprite)
    let positionX = relativeSubgrid[0]*subgridWidth
    let positionY = relativeSubgrid[1]*subgridWidth
    let angleToUse = oceanAngle-parent._direction
    let angleForVector = -(oceanAngle+parent._direction-90)
    let angleVector = toVector(angleForVector)
    positionX+=sizeDiff*angleVector[0]
    positionY+=sizeDiff*angleVector[1]
    this.setPosition(positionX,positionY)
    this.subgridIndexes=relativeSubgrid
    this.direction=angleToUse
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
  _customMoveLimiter=1
  get customMoveLimiter(){
    return this._customMoveLimiter
  }
  set customMoveLimiter(value){ //0-1.0 arası olmak zorunda, hız sınırlamalarında kullanılıyor
    if(value<0||value>1)return
    return this._customMoveLimiter=value
  }
  customDragMultiplier=1
  _entityMoveLimiter=1
  get entityDrag(){
    return this._entityDrag*this.customDragMultiplier
  }
  set entityDrag(value){
    return this._entityDrag=value
  }
  get entityMoveLimiter(){
    return Math.min(this._entityMoveLimiter,this.customMoveLimiter)
  }
  set entityMoveLimiter(value){
    return this._entityMoveLimiter=value
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
    this.lastPosX=this.posX
    this.lastPosY=this.posY
    this.savedDirection=this.direction
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
      if (this.tickCounter % this.actionInterval == 0||this.lastActionType=="goal") {
        let currAction = this.getAction();
        this.lastAction = currAction;
      }
      if (this.lastAction) {
        let updateAction = this.lastAction(dt);
        if (updateAction&&this.lastActionType!="goal"){
          let goalAction = this.getGoalAction(this.chosenAlgorithms[2])
          if(goalAction)goalAction.call(this,dt)
          let nextAction = this.getAction()
          this.lastAction=nextAction??this.lastAction
        }
      }
    }
    let nextColliders = this.getColliders();
    this.fillColor = nextColliders.length == 0 ? 0xff9900 : 0xff0000;
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
  _fillColor = 0xff9900;
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
  isAccelerating=false
  lastPath
  allowSteer=false
  isOverriden=false
  isWaiting=0 //0 ise beklemiyor, 1 ise yaya/ışık bekliyor, 2 ise bekleyen birini bekliyor
  dominanceFactor=Math.random() //buna göre yol verecekler
  patienceFactor=Math.floor(Math.random()*2000+2000)//sabır faktörü, sorun olunca buna göre bekleyecekler
  preventGoal=false
  massMultiplier=10
  canStart=false
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
  setPosition(x,y){
    super.setPosition(x,y)

  }
  isOnCorrectLane() {
    let laneOffset = getLaneOffset(this.getFacingDirection(), this.laneMultiplier, 20); 
    let nonZeroAxis = laneOffset[0] === 0 ? 1 : 0; 
    let axisDifference = this[nonZeroAxis==0?"posX":"posY"] - this.currentRoad[nonZeroAxis==0?"posX":"posY"];
    return Math.sign(axisDifference) === Math.sign(laneOffset[nonZeroAxis]) && Math.abs(axisDifference) > Math.abs(laneOffset[nonZeroAxis]) 
  }
  setGoal(x, y) {
    let currentDirection = this.getFacingDirection();
    let fromDirection = getOpposite(currentDirection);
    let currRoad = this.currentRoad
    if(!currRoad)return
    let currRoadType = currRoad?.roadType;
    //T şeklindeki yolda karşılıklı olmayan yerden gelen araç için gelinen yöne izin verilmemeli
    let nextDirection = currRoadType == "straight"?currentDirection: 
      getNextDirection(currRoadType, currRoad.direction, fromDirection, null, currentDirection)
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
    if(this.isWandering)return
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
    if(!this.isWandering)clearPath(this.game.roads);
  }
  resetPath() {
    if (this.goal) {
      let goalIndexes = getIndexes(this.goal[0], this.goal[1]);
      if (arrayEquals(this.gridIndexes, goalIndexes)) {
        this.removeGoal();
        return;
      }
      let foundIndex = this.path.findIndex(e=>e[0] == this.gridIndexes[0] && e[1] == this.gridIndexes[1]);
      if (foundIndex == -1&&!this.isWandering) {
        return this.setGoal(this.goal[0], this.goal[1]);
      }
      if(foundIndex!=-1||this.isWandering){
        this.lastPath=this.path[foundIndex-1]??this.lastPath
      }
      let currPath = foundIndex==-1?this.path:this.path.slice(foundIndex)
      this.setPath(currPath);
    }
    if(this.isWandering){
        if(!this.currentRoad){
          let foundRoad = this.game.roads.flat().map(e=>[e,getMagnitude(this.posX-e.posX,this.posY-e.posY)]).sort((x,y)=>x[1]-y[1])[0][0]
          this.goal=foundRoad.gridIndexes
          this.path=[this.gridIndexes,foundRoad.gridIndexes]
          return
        }
        let currentDirection = this.getFacingDirection()
        let fromDirection = getOpposite(currentDirection)
        let next = getNextDirection(this.currentRoad.roadType,this.currentRoad._direction,fromDirection)
        let neighbours = getNeighbours(this.gridIndexes)
        let coordinates = neighbours[connectionLookup[next]]
        let path = [this.gridIndexes,coordinates]
        let goal = coordinates
        let nextRoad = this.game.roads[coordinates[0]]?.[coordinates[1]]
        this.partialPath=[this.gridIndexes,coordinates]
        while(nextRoad){
          let nextConnections = getConnections(nextRoad.roadType, nextRoad._direction)
          let nextNeighbours = getNeighbours(goal)
          let goalIndex = nextNeighbours[connectionLookup[getRandom(nextConnections)]]
          path.push(goalIndex)
          goal=goalIndex
          nextRoad=this.game.roads[goal[0]]?.[goal[1]]
        }
        this.path=path
        this.goal=goal
    }
  }
  lastActionType=null
  preventSigns=[];
  resetChanged(){
    this.entityMoveLimiter=1
    this.laneMultiplier=1
    this.customDragMultiplier=1
    this.isWaiting=0
    this.sprite.tint=0xffffff
    this.preventSigns=[]
  }
  getAction() {
    if(!this.isOverriden&&(this.canStart||!this.isMain)){
      let threatAction = this.getThreatAction(this.chosenAlgorithms[0]);
      if (threatAction !== null) {
        this.lastActionType="threat"
        return threatAction;
      }
      let ruleAction = this.getRuleAction(this.chosenAlgorithms[1]);
      if (ruleAction !== null){
        this.lastActionType="rule"
        return ruleAction;
      }
    }else if(this.isOverriden&&!this.canStart)this.canStart=true
    //kurallar ve tehditler hızı sınırlayabiliyor, o sınır kaldırılıyor
    this.resetChanged()
    let goalAction = this.getGoalAction(this.chosenAlgorithms[2]);
    if (goalAction !== null){
      this.lastActionType="goal"
      if(!this.canStart)this.canStart=true
      return goalAction;
    }
    return null;
  }
  checkSensor(entityTypes,requiredDistance,sensors=this.sensors.slice(1,3),checkEvery){
    //signature mantığı olmadığı için kullanıldığı kısımda okunurluğu arttırmak için değişimi burada yapıyoruz
    if(!Array.isArray(entityTypes))entityTypes=[entityTypes]
    let foundEntity
    let foundDistance = Infinity
    let res = sensors[checkEvery?"every":"find"](sensor=>{
      if(!sensor)return false
      let [dist,entity] = sensor.output
      let cond =  entity&&dist<=requiredDistance&&(entityTypes.includes("any")||entityTypes.includes(entity.entityType))
      if(!cond)return false
      if(dist<foundDistance){
        foundDistance=dist||Number.EPSILON
        foundEntity=entity
      }
      return true
    })
    if(!res)return false
    return [foundDistance,foundEntity]
  }
  checkSign(entityTypes){
    if(!Array.isArray(entityTypes))entityTypes=[entityTypes]
    let facingDirection = this.getFacingDirection()
    //haritaya göre değil, araca göre sağ
    let right = connectionArray[(connectionLookup[facingDirection]+1)%4]
    let hasAny = entityTypes.includes("any")
    return this.currentRoad&&this.currentRoad.obstacles.find(e=>{
      let entity = e[0]
      if(entity.isOnRoad)return false
      if(this.preventSigns.includes(entity)||(!entityTypes.includes(entity.entityType)&&!hasAny))return false
      let currentPos = [this.posX,this.posY]
      let entityPos = [entity.posX,entity.posY]
      let directionList = getRelativeDirectionList(currentPos,entityPos)
      let dist = getMagnitude(currentPos[0]-entityPos[0],currentPos[1]-entityPos[1])
      return directionList.includes(right)&&dist<ROAD_WIDTH/3
    })
  }
  checkCurrent(entityTypes){
    let found = (this.lastColliders||this.getColliders()).find(e=>entityTypes.includes(e.entityType))
    if(!found)return null
    return [0,found]
  }
  checkThreatCondition(){
    return this.checkSensor(this.isMain||!this.isOnRoad()?REAL_THREATS:THREATS,110,this.sensors.slice(0,5).concat([this.sensors[9],this.sensors[10]]))
  }
  getSensorSums(isDynamic){
    let xorWith = isDynamic?1:0
    let sensors = this.sensors.slice(0,11).map(e=>e.output)
    let increasers = [0,1^xorWith,-1^xorWith,3^xorWith,-2^xorWith,-1.5,1,-1.5,1,-1,1]
    let sum = 0
    let weightedSum = 0
    sensors.forEach((e,i)=>{
      if(e[1]&&!NONPHYSICAL_THREATS.includes(e[1].entityType)){
        sum+=increasers[i]
        weightedSum+=(i==0?0:i%2==0?-1:1)*(1-e[0]/CAR_WIDTH/2) // kendi uzunluklarına göre değil sabit bir değere göre normalleştiriliyorlar çünkü boş mesafe lazım
      }else sum-=increasers[i]/10
    })
    return [sum,weightedSum]
  }
  stationaryAt=0
  isOnRoad(){
    if(this.currentRoad==null)return false
    return checkIsOnRoad(this,this.currentRoad)
  }
  frontCounters=[]
  frontCounter=0
  dominanceCounters=[]
  sumCounters=[]
  sumCounter=0
  #threatAction(dt){
    if(!this.checkThreatCondition())return true
    let now = Date.now()
    let sensors = this.sensors.slice(0,11).map(e=>e.output)
    let back = this.sensors.slice(-2).map(e=>e.output)
    let conditionFirst = sensors[1][1]&&(sensors[1][1].entityType=="road"?sensors[1][0]<40:sensors[1][0]<100&&REAL_THREATS.includes(sensors[1][1].entityType))
    let conditionSecond = sensors[2][1]&&(sensors[2][1].entityType=="road"?sensors[2][0]<40:sensors[2][0]<100&&REAL_THREATS.includes(sensors[2][1].entityType))
    let mainTriggered = conditionFirst||conditionSecond
    let bothTriggereed = conditionFirst&&conditionSecond
    //sağ veya sol sensörlerin tamamını araçlar kaplıyorsa o yöne gidilmemeli
    //yavaşlamanın koşulları arttırılmalı
    let isOnRoad = this.isOnRoad()
    let threatsToUse = isOnRoad?REAL_THREATS:THREATS
    let angleDifference = this.getGoalAngle()
    //ön yandaki sensörler 9 ve 10. indis
    let frontSensors = sensors.slice(0,5).concat([sensors[9],sensors[10]])
    let mainBlockedByCar = sensors.slice(0,5).find(e=>e[0]<40&&e[1].entityType=="car")
    let frontTriggered = frontSensors.filter(e=>e[1]&&!NONPHYSICAL_THREATS.includes(e[1].entityType))
    let threatCars = sensors.filter((e,i)=>e[1]&&e[1].entityType=="car")
    let dominanceFactors = threatCars.map(e=>e[1].dominanceFactor)
    let hasDynamicThreat = threatCars.length>0||sensors.find(e=>e[1]&&e[1].entityType=="pedestrian")
    let leftIsFullyDynamic = [sensors[5],sensors[7],sensors[9]].filter(e=>e[1]&&e[1].entityType=="car"&&e[0]<50).length>=2
    let rightIsFullyDynamic = [sensors[6],sensors[8],sensors[10]].filter(e=>e[1]&&e[1].entityType=="car"&&e[0]<50).length>=2
    //üst üste threatAction olması durumunda 2 saniyelik veri
    let index=this.frontCounter++%(Math.floor(1/this.game.gameTick)*2)
    this.frontCounters[index]=mainTriggered
    let carIsComing = threatCars.length>0
    let otherCar
    let directionAlignment = 0
    if(carIsComing){
      carIsComing=threatCars.find(otherCar=>{
        //let speedAlignment = dotProduct(toUnitVector([this.velX,this.velY]),toUnitVector([otherCar.velX,otherCar.velY]))
        directionAlignment = dotProduct(toVector(this.direction),toUnitVector([otherCar.velX,otherCar.velY]))
        return directionAlignment<-0.5
      })
    }
    let absVelocity = this.absoluteVel()
    let allNonPhysical = sensors.every(e=>!e[1]||!threatsToUse.includes(e[1].entityType))
    let frontCloseness = Math.floor(frontSensors.map(e=>{
      let isProblematic = e[1]&&threatsToUse.includes(e[1].entityType)
      return !isProblematic?0:Math.max(10,50-e[0])
    }).reduce((x,y)=>x+y,0))
    let frontPossibleness = Math.floor(frontSensors.map(e=>{
      let isPossible = e[0]>40&&(!e[1]||!threatsToUse.includes(e[1].entityType))
      return isPossible?Math.max(5,e[0]-40):0
    }).reduce((x,y)=>x+y))
    if(absVelocity>16&&!this.isGoingBackwards())this.stationaryAt=now
    let waitingFor = now-this.stationaryAt
    let frontImpossibility = sensors.map(e=>e[1]&&threatsToUse.includes(e[1].entityType)?e[0]<25?25-e[0]:0:0).reduce((x,y)=>x+y)*3+(this.lastColliders?.filter(e=>e.entityType=="car").length||0)*25
    // nesnenin random sabır süresi kadar ms bekledikten sonra yavaş yavaş agresiflik artıyor
    let frontUsability = frontPossibleness-frontCloseness*1.3-frontImpossibility+Math.max(0,(waitingFor-this.patienceFactor)/10)
    let hasDominance = this.dominanceFactor==Math.max(this.dominanceFactor,...dominanceFactors)||frontUsability>70
    this.dominanceCounters[index]=hasDominance
    hasDominance&&=this.dominanceCounters.filter(e=>e).length>100
    //bekleme değeri normalde 0, ışık ve yaya geçidinde 1
    //ışıkta veya yaya geçidindeki aracı görenlerin ise 2+
    //2+ olanların isWaiting'te kalması için kendilerinden düşük ancak 0 olmayan isWaiting değerine sahip araç bulmalılar
    this.isWaiting=threatCars.find(e=>e[0]<60&&e[1].isWaiting!=0&&e[1].isWaiting<4&&(this.isWaiting==0||e[1].isWaiting<this.isWaiting))?.[1].isWaiting||0
    if(this.isWaiting){
      this.isWaiting++
      return this.isMain
    }
    let frontCounterAmount = this.frontCounters.filter(e=>e).length
    if((frontCounterAmount>30||frontCounterAmount/this.frontCounters.length>0.9)||mainTriggered||absVelocity<1||this.isGoingBackwards()||waitingFor>3000){
      //aniden geri gitmemesi için ya zaten geriye giderken ya da hızı çok düşükken geri gitmeye başlıyor
      let backFreenes = back.map(e=>e[0]>20||e[1]==null||(!THREATS.includes(e[1].entityType)))
      let backSensorsFree = backFreenes.every(e=>e)
      let freeBack = backFreenes.findIndex(e=>e)
      let canAct = (hasDominance||!hasDynamicThreat)
      if(mainBlockedByCar||((backSensorsFree||freeBack!=-1)&&((frontUsability<-30||frontTriggered.length>1)&&((now-this.stationaryAt>400)||frontTriggered.length>2))&&(this.getAlignment()<=0||absVelocity<10))){
        let [sum,weightedSum] = this.getSensorSums()
        let sumSign = Math.abs(sum)<1?0:Math.sign(sum)
        //araç/tehdit yaklaşmıyorsa en erken 0.2 saniye sonra geri gidebiliyor
        //if(frontTriggered.length>0&&((now-this.stationaryAt>200)&&(backSensorsFree||freeBack!=-1))){
          if(IS_DEBUG)this.sprite.tint=0x00ff00
          this.entityMoveLimiter=1
          this.moveBackward(dt)
          let currentSteeringMultiplier=backSensorsFree?-sumSign*1.5:freeBack==0?-2:2
          this.steer(dt,currentSteeringMultiplier,true)
        return
        //ya hemen önünde nesne olmadığında ya da araç olduğunda
        //ikisi beraberken çalışmamalı ki ileri gitmesin
        //xor
      }else if(frontImpossibility<100!=hasDynamicThreat&&!mainBlockedByCar){
        let [sum,weightedSum] = this.getSensorSums(true)
        this.sumCounters[this.sumCounter++%5]=[sum,now]
        let lastSums =sum|| this.sumCounters.filter(e=>now-e[1]<100).map(e=>e[0]).reduce((x,y)=>x+Math.sign(y)) /*büyüklüklüklerini hesaba katınca aynı yöne dönüyor*/
        if(typeof angleDifference=="number")lastSums+=Math.sign(angleDifference)
        let sumSign = Math.sign(lastSums)
        if(IS_DEBUG)this.sprite.tint=0x999999
        let minimum = this.isWaiting?0:frontUsability<-30?frontUsability>10&&!bothTriggereed?0.6:0:0.6
        this.entityMoveLimiter=Math.max(minimum,this.entityMoveLimiter-this.absoluteVel()/100)
        if(canAct){
          this.moveForward(dt)
        }
        if(!canAct||this.entityMoveLimiter==0)this.brake(dt)
        if(sumSign&&sumSign!=this.laneMultiplier&&sumSign==-1){
          if(!allNonPhysical)this.switchLane()
        }
        this.steer(dt,sumSign*1.3)
        return this.isMain
      }else{
        this.entityMoveLimiter=0.7
        if(frontImpossibility>30||hasDynamicThreat)this.brake(dt)
        if(frontImpossibility<=50&&!mainBlockedByCar){
          let [sum] = this.getSensorSums(false)
          let sumSign = Math.sign(sum)
          this.steer(dt,sumSign*1.3)
        }
        if(IS_DEBUG)this.sprite.tint=0x333333
        return true
      }
    }else{
      if(IS_DEBUG)this.sprite.tint=0xffffff
      this.entityMoveLimiter=1
      if(allNonPhysical)this.resetChanged()
      return true
    }

  }
  getThreatAction(chosenAlgorithm) {
    if(chosenAlgorithm=="rule"){
      if(this.checkPedThreatCondition()){
        return this.#pedAction
      }
      if(this.checkThreatCondition()){
        return this.#threatAction
      }
    }else{

    }
    return null;
  }
  checkLaneCondition(){
    return this.checkSensor("road",20,[this.sensors[8],this.sensors[10]],true)
  }
  checkLightCondition(){
    let res = this.checkSensor("light",100)
    if(res&&res[1].state!=LIGHT_STATES[2])return res
    return false
  }
  #lightAction(dt){
    let res = this.checkLightCondition()
    if(!res){
      this.entityMoveLimiter=1
      return true
    }
    let [dist,light] = res
    if((light.state==LIGHT_STATES[0]&&dist<50)||(light.state==LIGHT_STATES[1]&&dist>=40)){
      this.entityMoveLimiter*=0.7
      this.brake(dt)
      this.isWaiting=1
    }else this.isWaiting=0
    if(light.state==LIGHT_STATES[1]){
      this.entityMoveLimiter=Math.max(0.3,this.entityMoveLimiter*0.9)
      this.allowSteer=true
      this.isWaiting=1
    }
    return true
  }
  checkBumpCondition(){
    return this.checkSensor("kasis",40)
  }
  #bumpAction(dt){
    let res = this.checkBumpCondition()
    if(!res){
      if(this.entityMoveLimiter>0.8){
        this.entityMoveLimiter=1
        return true
      }
      this.entityMoveLimiter=(1+this.entityMoveLimiter)/2
    }
    this.entityMoveLimiter=Math.max(0.3,this.entityMoveLimiter-this.absoluteVel()/100)
    return true
  }
  checkSpeedCondition(){
    return this.checkSign(["hizSiniriLevha","hizKaldirmaLevha","kasisLevha","yayaGecidi"])
  }
  #speedAction(dt){
    let res = this.checkSpeedCondition()
    if(!res)return true
    let entity=res[0]
    let entityType = entity.entityType
    if(entityType=="hizSiniriLevha"){
      //bu sınırlayıcı kendisi sıfırlanmıyor
      this.customMoveLimiter=0.83
    }else if(entityType=="kasisLevha"||entityType=="yayaGecidi"){
      this.entityMoveLimiter=0.83
    }else if(entityType=="hizKaldirmaLevha"){
      this.customMoveLimiter=1
    }
    this.preventSigns.push(entity)
    return true
  }
  checkPedThreatCondition(){
    return this.checkSensor("pedestrian",150)||this.checkCurrent("pedestrian")
  }
  checkPedRuleCondition(){
    return this.checkSensor("yayaGecidi",100)||this.checkCurrent("yayaGecidi")
  }
  #pedAction(dt){
    let res = this.checkSensor(["yayaGecidi","pedestrian"],120)
    if(!res){
      this.resetChanged()
      return false
    }
    let [dist,entity] = res
    if(entity.entityType=="pedestrian"||(entity.entityType=="yayaGecidi"&&entity.pedestrians.find(e=>e.state=="passing"))){
      this.entityMoveLimiter/=2
      this.brake(dt)
      this.isWaiting=1
    }else{
      this.entityMoveLimiter=1
      this.isWaiting=0
    }
    return true
  }
  checkPuddleCondition(){
    return this.checkSensor("puddle",20,this.sensors.slice(0,5))
  }
  #puddleAction(dt){
    let res = this.checkPuddleCondition()
    if(!res)return true
    //sensörle varlığına bakıyoruz ama yalnızca birikintinin üzerindeyse sürtünmeyi düşürüyoruz
    let isOnPuddle = this.lastColliders?.find(e=>e.entityType=="puddle")
    this.customDragMultiplier=isOnPuddle?0.7:1
    this.entityMoveLimiter=0.5
    return true
  }
  checkStopCondition(){
    return this.checkSign("stopLevha")
  }
  #stopAction(dt){
    let res = this.checkStopCondition()
    if(!res)return true
    let vel = this.absoluteVel()
    if(vel<10){
      this.preventSigns.push(res[0])
      this.isWaiting=0
      return true
    }else{
      this.entityMoveLimiter=0
      this.brake(dt)
      this.isWaiting=1
    }
  }
  getRuleAction(chosenAlgorithm) {
    if(chosenAlgorithm=="rule"){
      if(this.checkPedRuleCondition()){
        return this.#pedAction
      }
      //if(this.isMain&&this.checkLaneCondition()){
      //  return this.#laneAction
      //}
      if(this.checkLightCondition()){
        return this.#lightAction
      }
      if(this.checkBumpCondition()){
        return this.#bumpAction
      }
      if(this.checkSpeedCondition()){
        return this.#speedAction
      }
      if(this.checkPuddleCondition()){
        return this.#puddleAction
      }
      if(this.checkStopCondition()){
        return this.#stopAction
      }
    }
    return null;
  }
  getGoalAction(chosenAlgorithm) {
    if(this.preventGoal)return null
    if (this.isWandering||this.path && this.path.length > 0) {
      return this.#goalAction;
    }
    return null;
  }
  getGoalAngle(){
    if (!this.path || this.path.length<2||!this.goal){
      if(this.isWandering){
        this.goal=null
        this.resetPath()
        if(!this.path||!this.path[1])return
      }else return
    }
    if(this.isWandering)this.lastActionType="wander"
    if(!arrayEquals(this.path[0],this.gridIndexes)){
      this.resetPath()
      if (!this.path || this.path.length == 0) return this.isWandering
    }
    let currCoords = getCoordinates(this.gridIndexes[0],this.gridIndexes[1])
    //sol üstten başlıyor
    let relativeToCurr = [this.posX-currCoords[0]-ROAD_WIDTH/2,this.posY-currCoords[1]-ROAD_WIDTH/2]
    let distanceToNext = getDistance([this.posX,this.posY],getCoordinates(this.path[1][0],this.path[1][1]))
    //şerit ihlalini engellemiyor, istenen şeride yakın gidiyor. değiştirilecek
    let facingDirection = this.getFacingDirection()
    let relativeDirection = getRelativeDirection(this.path[0],this.path[1])
    let goalDirection = getRelativeDirection(this.path[1],this.path[0])
    let nextStart = this.path.length>2?this.path[1]:this.path[0]
    let nextEnd = this.path.length>2?this.path[2]:this.path[1]
    let nextDirection = getRelativeDirection(nextEnd, nextStart)
    let lastDirection = this.lastPath?getRelativeDirection(this.path[0],this.lastPath):facingDirection
    let relativeTurningDirection = connectionArray[(connectionLookup[goalDirection]-connectionLookup[lastDirection]+4)%4]
    let isTurning = lastDirection!=goalDirection
    let isNowTurning = facingDirection!=goalDirection
    const THRESHOLD = ROAD_WIDTH/4
    let hasPassedStart =!isTurning||(!relativeToCurr.find(e=>Math.abs(e/THRESHOLD)>3))
    let roadDistanceMultiplier = isTurning?1:1.04
    if(relativeTurningDirection=="left")roadDistanceMultiplier-=0.3
    let hasCompletedCurrentRoad = distanceToNext<ROAD_WIDTH*roadDistanceMultiplier
    let midGoal = [(this.path[0][0]*0.8+this.path[1][0]*0.2),(this.path[0][1]*0.8+this.path[1][1]*0.2)]
    let useCurrent = isTurning&&!hasCompletedCurrentRoad
    let currGoal = useCurrent?midGoal:this.path[1]
    let currentMultiplier = this.laneMultiplier
    let currentDivider = relativeTurningDirection=="right"||useCurrent?10:8
    let directionToUse = (isTurning&&!hasCompletedCurrentRoad)?lastDirection:relativeDirection
    let [targetX, targetY] = getLaneCoordinates(directionToUse, currGoal, currentMultiplier, currentDivider);
    let dx = targetX - this.posX;
    let dy = targetY - this.posY;
    let angleToTarget = toDegree(Math.atan2(dy, dx)); // Hedef açısı
    let angleDifference = getNormalizedAngle(angleToTarget-this._direction);
    return angleDifference
  }
  #goalAction(dt) {
    let angleResult = this.getGoalAngle()
    if(typeof angleResult==="boolean")return angleResult
    let angleDifference = angleResult
    if (angleDifference > 180) {
        angleDifference -= 360;
    }
    let steeringMultiplier = 1.2
    if(Math.abs(angleDifference)>2){
      steeringMultiplier*=Math.sign(angleDifference)
      this.steer(dt,steeringMultiplier)
    }
    this.moveForward(dt);
  }
  setVehicleProperties() {
    let currentProperties = calculateVehicleProperties(this.currentRoad?.roadCondition || "asphalt", this.isTurning, this.isUsingBrake);
    let {acceleration,drag,turnDrag,steering,turnLimiters,alignment} = currentProperties;
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
    this.fillColor = nextColliders.length == 0 ? 0xff9900 : 0xff0000;
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
        let input = [...this.sensors.map(e=>e.output[0] / this.width), ...relativeGoal, ...relativePath, ...velocity, ];
        let output = [
          this.getAlignment() < 0 ? -1 : 1,
          this.isUsingBrake ? -1 : 1,
        ];
        this.recordedData.inputs.push(input);
        this.recordedData.outputs.push([this.lastActionType,output]);
      }
    }
    if (this.lastIsTurning != this.isTurning || this.lastIsUsingBrake != this.isUsingBrake) {
      this.setVehicleProperties();
    }
    this.lastIsUsingBrake = this.isUsingBrake;
    this.isUsingBrake = false;
    this.lastIsTurning = this.isTurning;
    this.isTurning = false;
    this.isAccelerating=false
    this.allowSteer=false
    this.isOverriden=false
  }
  accelerate(dt = 1, scale = 1,setOverride=false) {
    if(setOverride)this.isOverriden=true
    if(this.isAccelerating)return
    let degree = this._direction;
    let radian = toRadian(degree);
    this.accX += Math.cos(radian) * this.entityMoveMultiplier*this.entityMoveLimiter * scale * dt;
    this.accY += Math.sin(radian) * this.entityMoveMultiplier*this.entityMoveLimiter * scale * dt;
    this.isAccelerating=true
  }
  moveForward(dt = 1, scale = 1,setOverride=false) {
    // scale 0-1.0 arasında, ivmelenme kontrolünde lazım olacak
    this.accelerate(dt * 1000, scale,setOverride);
  }
  // Geri hareket fonksiyonu
  moveBackward(dt = 1, scale = 1,setOverride=false) {
    this.accelerate(dt * 1000, -scale / 2,setOverride);
  }
  isGoingBackwards(alignment = this.getAlignment()) {
    return alignment < 0;
  }
  steer(dt, angle,setOverride=false) {
    if(setOverride)this.isOverriden=true
    let currentMultiplier = this.entitySteeringMultiplier;
    let alignment = this.getAlignment();
    let isGoingBackwards = this.isGoingBackwards(alignment);
    if (!this.allowSteer&&Math.abs(alignment) < ((this.entityMinAlignment / this.absoluteVel()) * this.entityMoveMultiplier) / ((isGoingBackwards ? this.entityTurnLimiters[0] : this.entityTurnLimiters[1]) + (this.isUsingBrake ? 2 : 0))) return;
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
  steerLeft(dt,setOverride=false) {
    this.steer(dt, -1,setOverride);
  }
  steerRight(dt,setOverride=false) {
    this.steer(dt, 1,setOverride);
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
    this.sensors.forEach(e=>e.destroy())
    this.game.cars.splice(this.game.cars.indexOf(this), 1);
  }
  setPosition(x,y){
    super.setPosition(x,y)
    this.setRoad()
    this.setVehicleProperties()
  }
  setRoad() {
    let currRoad = this.game.roads[this.gridIndexes[0]]?.[this.gridIndexes[1]];
    if (!currRoad) currRoad = null;
    this.currentRoad = currRoad;
  }
  constructor(game, spritePath, createGraphics = false) {
    super(game);
    let chosenCar
    if(!spritePath){
      chosenCar=getRandom(CAR_SPRITES)
      spritePath=chosenCar[0]
    }
    else chosenCar=CAR_SPRITES.find(e=>e[0]==spritePath)
    this.directionOffset=chosenCar[1]?90:0
    this.anchorX=chosenCar[2]
    this.setVehicleProperties();
    this.onIndexChange.push(this.setRoad);
    this.onIndexChange.push(this.resetPath);
    this.onIndexChange.push(this.setVehicleProperties);
    this.childGraphics.push(this.customLine);
    this.width = CAR_WIDTH*chosenCar[3]
    this.createGraphics = createGraphics;
    this.drawBounds = createGraphics;
    this.sprite = spritePath;
    this.entityType = "car";
    this.addSensor(-this.directionOffset, 2.0, 10);
    this.addSensor(-this.directionOffset - 10, 2.0, 10);
    this.addSensor(-this.directionOffset + 10, 2.0, 10);
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
  dominanceFactor=0.5
  constructor(game, spritePath) {
    super(game, spritePath, true);
  }
}
export class Road extends Entity {
  anchorX = 0.5;
  anchorY = 0.5;
  obstacles = [];
  roadCondition;
  recursionIndex=0
  #alignObstacles() {
    return this.obstacles.forEach(e=>e.setRelativePosition());
  }
  setDirection(val) {
    super.setDirection(val);
    this.#alignObstacles();
  }
  getGrids() {
    let currentGridsArray = [this.gridIndexes]
    this.currentGridsArray=currentGridsArray
    return new Set(currentGridsArray);
  }
  getLines() {
    if (this.cachedLines) return this.cachedLines;
    const GREEN = 50;
    const ROAD = 50;
    const RATIO = GREEN / (GREEN + ROAD) / 2;
    let res = super.getLines();
    let mapped = res.map((e, i) => e.map((e, j) => e.map((e, q) => e * (1 - RATIO) + res[(i + 2) % 4][1-j][q] * RATIO)));
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
    if (curr&&curr.destroyed) return;
    if (!curr) {
      this.highlightLines[index] = new PIXI.Graphics();
      curr=this.highlightLines[index]
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
    this.highlightLines.forEach(e=>e && e.destroy());
  }
  constructor(game, roadType, directionOffset, direction, roadCondition,recursionIndex) {
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
    this.recursionIndex=recursionIndex
  }
}
export class Pedestrian extends MovableEntity{
  rangeStart
  rangeEnd
  parent
  state="waiting"
  counter=0
  anchorX=0.5
  anchorY=0.5
  startingFromInitial
  tryDirectionCounter=0
  lastAngleMultiplier=1
  passingStartedAt=0
  getAlignment(){
    return 1
  }
  replenish(){
    this.parent.addPedestrian(1,this.startingFromInitial!=(this.counter%2==1))
    this.destroy()
  }
  tick(dt){
    if(this.destroyed)return
    if(this.state=="turning"){
      let startAngle = this.parent._direction
      let goalAngle = startAngle+(this.counter%2==0?90:270)
      let diff = getNormalizedAngle(this.direction-goalAngle)
      this.direction+=Math.sign(diff)
      if(Math.abs(diff)<3){
        if(Math.round(Math.random())==1){
          this.direction=goalAngle
          this.state="waiting"
        }else{
          //%50 ihtimalle ölüyor, ölmezse dönüp yeniden geçiyor
          //yeni gelecek olanı aynı yere koyuyoruz 
          //(başladığı yerde değil) XOR (başlangıç noktasından başlar)
          this.replenish()
        }
      }
    }
    if(this.state=="waiting"){
      //her frame düşük şansı olunca bir süre durup geçmeye başlamış oluyor
      let currentPlace = this.counter%2==1?this.rangeEnd:this.rangeStart
      let distanceVector = [currentPlace[0]-this.posX,currentPlace[1]-this.posY]
      let remaining = getMagnitude(distanceVector[0],distanceVector[1])
      let remainingRatio = remaining/this.parent.width
      //güncel konumdan bir sebeple uzaklaşıldıysa bir oranda geri dönecek
      if(remainingRatio>0.03){
        let speed = 100
        let directionVector = toUnitVector(distanceVector)
        let nonDirectionalSpeed = speed*dt*PEDESTRIAN_MOVE_MULTIPLIER
        this.velX=directionVector[0]*nonDirectionalSpeed
        this.velY=directionVector[1]*nonDirectionalSpeed
      }
      if(Math.random()*2000<1){
        this.state="passing"
        this.passingStartedAt=this.tickCounter
      }
    }
    if(this.state=="passing"){
      let currentGoal = this.counter%2==0?this.rangeEnd:this.rangeStart
      let distanceVector = [currentGoal[0]-this.posX,currentGoal[1]-this.posY]
      let remaining = getMagnitude(distanceVector[0],distanceVector[1])
      let remainingRatio = remaining/this.parent.width
      let speed = 100
      let directionVector = toUnitVector(distanceVector)
      let gridIndexes = getIndexes(this.posX,this.posY)
      let carsInGrid = Array.from(this.game.gridEntitySets[gridIndexes[0]]?.[gridIndexes[1]]||[]).filter(e=>e.entityType=="car")
      if(!this.isCollisionEffected||!carsInGrid.find(e=>e.absoluteVel()>3)){
        let nonDirectionalSpeed = speed*dt*PEDESTRIAN_MOVE_MULTIPLIER
        this.velX=directionVector[0]*nonDirectionalSpeed
        this.velY=directionVector[1]*nonDirectionalSpeed
        //önünde araç varsa konumu az değişecek, konumu az değişirse kendisine göre sağa veya sola gitsin
        let effectiveSpeed = getMagnitude(this.posX-this.lastPosX,this.posY-this.lastPosY)
        if(effectiveSpeed<0.1){ // yola göre yaya hızı değişmiyor, normal konum değişimleri 0.23-0.24 gibi
          if(this.tryDirectionCounter<3){
            //+= ile fazla birikebiliyor
            this.tryDirectionCounter=30
            //rastgele yön denenmesi ama üst üste aynısının kullanılması için
            this.lastAngleMultiplier=Math.round(Math.random())?1:-1
          }
        }
        let passedTickCount = this.tickCounter-this.passingStartedAt
        if(passedTickCount>1000){
          //karşıdan karşıya geçmesi bu kadar sürmemeli
          this.isCollisionEffected=false
        }
        if(this.tryDirectionCounter>0){
          this.tryDirectionCounter--
          let pedDirection = toVector(this.direction-90*this.lastAngleMultiplier)
          nonDirectionalSpeed+=Math.min(20,passedTickCount/10)*dt*PEDESTRIAN_MOVE_MULTIPLIER
          this.velX+=nonDirectionalSpeed*pedDirection[0]*2
          this.velY+=nonDirectionalSpeed*pedDirection[1]*2
        }
        if(remainingRatio<0.03){
          this.state="turning"
          this.counter++
          this.posX=currentGoal[0]
          this.posY=currentGoal[1]
          this.velX=0
          this.velY=0
          this.accX=0
          this.accY=0
          this.isCollisionEffected=true
        }
      }
    }
    super.tick(dt)
  }
  //nereden başlayacağı verilmediyse rastgele olarak başlangıçtan ya da bitişten başlıyor
  constructor(game, parent, subgrid, startingFromInitial) {
    super(game);
    if(typeof startingFromInitial!="boolean")startingFromInitial=Math.round(Math.random())==1
    this.width=25
    this.parent=parent
    this.entityType="pedestrian"
    this.sprite=getRandom(PEDESTRIANS)
    let absoluteSubgrid = getAbsoluteSubgridIndex(subgrid,this.parent.parent._direction)
    let directionVector = toUnitVector(absoluteSubgrid)
    let offsetAxis = directionVector[0]==0?0:1
    directionVector=[offsetAxis==0?1:0,offsetAxis==1?1:0].map(e=>e*ROAD_WIDTH*2/5)
    let offsetMultiplier = [offsetAxis==0?-1:1,offsetAxis==1?-1:1]
    let [midX,midY]=[this.parent.posX,this.parent.posY]
    let offsetVector = [directionVector[0]*offsetMultiplier[0],directionVector[1]*offsetMultiplier[1]]
    let offsetCoordsAmount = [directionVector[0],directionVector[1]]
    let currentRangeStart = [midX+offsetCoordsAmount[0],midY+offsetCoordsAmount[1]]
    let currentRangeEnd = [midX+offsetVector[0],midY+offsetVector[1]]
    let assignFrom
    this.startingFromInitial=startingFromInitial
    if(this.startingFromInitial){
      assignFrom=[currentRangeStart,currentRangeEnd]
    }else {
      assignFrom=[currentRangeEnd,currentRangeStart];
      this.directionOffset=270
    }
    [this.rangeStart,this.rangeEnd]=assignFrom
    let startAngle = this.parent._direction
    let goalAngle = startAngle+(this.counter%2==0?90:270)
    this.direction=goalAngle
    this.setPosition(this.rangeStart[0],this.rangeStart[1])
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
  signObstacles=[]
  parentObstacle
  forcedDirection
  _relativeDirection
  laneWhenRelativeSet
  isOther=false
  massMultiplier=1
  minSubgridDistance=4
  pedestrians=[]
  crossOnly=false
  _subgridIndexes
  get subgridIndexes(){
    return this._subgridIndexes
  }
  set subgridIndexes(value){
    this._subgridIndexes=value
    let foundIndex = this.parent.obstacles.findIndex(e=>e[0]==this)
    if(foundIndex!=-1)this.parent.obstacles[foundIndex][1]=value
  }
  //belirtilmezse 1-2 adet yaya ekleniyor
  addPedestrian(amount=Math.floor(Math.random()*2)+1,startingFromInitial){
    for(let i = 0;i<amount;i++){
      let ped = new Pedestrian(this.game,this,this.subgridIndexes,startingFromInitial)
      this.pedestrians.push(ped)
    }
  }
  set relativeDirection(value){
    this._relativeDirection=value
    this.laneWhenRelativeSet=this.chosenLane
  }
  get relativeDirection(){
    if(this.laneWhenRelativeSet==this.chosenLane){
      return this._relativeDirection
    }
    this.laneWhenRelativeSet=this.chosenLane
    return this._relativeDirection=getOpposite(this._relativeDirection)
  }
  setCompatibleSign(otherDirection,maxTries=2){
    let lastRoad = this.parent
    let signName=this.entityType+"Levha"
    let lastRoads = [lastRoad]
    let directions = [this._direction==0?otherDirection?"up":"down":otherDirection?"right":"left"]
    for(let i = 0;i<maxTries;i++){
      let lastDirection = i==0?directions[0]:getRelativeDirection(lastRoads[i].gridIndexes,lastRoads[i-1].gridIndexes)
      let fromDirection = lastDirection
      let next = getNextDirection(lastRoad.roadType,lastRoad._direction,getOpposite(fromDirection))
      directions.push(next)
      let currNeighbours  = getNeighbours(lastRoad.gridIndexes)
      let neighbourRoads = getConnections(lastRoad.roadType,lastRoad._direction).map(e=>currNeighbours[connectionLookup[e]])
      let currRoad = currNeighbours[connectionLookup[next]]
      currRoad=!lastRoads.find(e=>arrayEquals(e.gridIndexes,currRoad))&&neighbourRoads.includes(currRoad)&&inBounds(currRoad)&&this.game.roads[currRoad[0]][currRoad[1]]
      if(!currRoad||i==maxTries-1)break
      lastRoads.push(currRoad)
      directions.push(next)
      lastRoad=currRoad
    }
    let signObstacle
    for(let i = lastRoads.length-1;i>=0;i--){
      let foundRoad=lastRoads[i]
      if(foundRoad.roadType=="rightcurve")continue
      let lastDirection = directions[i]
      let foundGridIndexes = foundRoad.gridIndexes
      //aynı yola aynı levhaya dair aynı yönden gelen ikinci levhayı koymuyoruz
      if(foundRoad.obstacles.find(([obstacle,index])=>{
        if(obstacle.entityType!=signName)return false
        let usable = lastDirection
        let abs = getAbsoluteSubgridIndex(index,this.parent._direction)
        let directionList = getRelativeDirectionList([0,0],abs)
        return directionList.includes(usable)
      }))break
      signObstacle = new Obstacle(this.game, signName,null,this,lastDirection);
      if(signObstacle.setRoad(foundGridIndexes[0],foundGridIndexes[1])){
        signObstacle.setRelativePosition()
        this.signObstacles.push(signObstacle)
        break
      }else{
        signObstacle.destroy()
        signObstacle=null
      }
    }
    return signObstacle
  }
  setRelativePosition() {
    let indexes = getAbsoluteSubgridIndex(this.subgridIndexes, this.parent._direction);
    let multiplier = ROAD_WIDTH / 2 - this.width / 2;
    let [relX, relY] = indexes.map(e=>e * multiplier);
    if (this.isOnRoad) {
      let divider = this.usedLanes == 2 ? 0 : 8;
      //normalde T tipi yolda soldakiler sırasıyla düz ters, sağdakiler ters düz olurdu
      //ikisinin aynı olması için ikisinin de sağdaki gibi davranmasını sağlıyoruz
      let currentAngle = getNormalizedAngle(getSubgridAngle(indexes.map(e=>Math.abs(e))));
      let [relOffsetX, relOffsetY] = getLaneOffset(angleLookup[currentAngle], this.chosenLane, divider);
      //y değerinin ters yönde olması gerekmesi getLaneOffset'te hallediliyor
      relX += relOffsetX;
      relY += relOffsetY;
      let index = [relOffsetY>0,relOffsetX>0,relOffsetY<0,relOffsetX<0].indexOf(true)
      this.relativeDirection=index>=0?connectionArray[index]:"right"
      this.direction = currentAngle;
    }
    let [resX, resY] = [this.parent.posX + relX, this.parent.posY - relY];
    this.setPosition(resX, resY);
  }
  removeFromObstacles(){
    if(this.parent)this.parent.obstacles=this.parent.obstacles.filter(e=>e[0]!=this)
  }
  setRoad(gridX, gridY) {
    if(this.parent){
      this.removeFromObstacles()
      this.parent=null
    }
    let currRoad = this.game.roads[gridX][gridY];
    this.parent = currRoad;
    //subgrid indexler kaydedilirken direction 0'mış gibi hesaplanır, çizilirken gerçek değer okunur
    //bu şekilde nesne döndürülünce eski değer ve yeni değerin bilinmesi gerekmeyecek
    let possibleSubgridIndexes = getPossibleSubgrids(currRoad.roadType, 0, this.isOnRoad)
    if(this.isOnRoad)possibleSubgridIndexes=possibleSubgridIndexes.filter(e=>{
      if((this.parent.roadType=="4"||this.parent.roadType=="3")&&(e[0]==0||e[1]==0))return false
      //ardışık engel sınırlamasına uymayacak subgrid'leri siliyoruz
      let currentGlobalSubgrid = getAbsoluteGlobalSubgrid(this.parent,e)
      return !this.game.roads.find(e=>e.find(otherRoad=>{
        return otherRoad&&otherRoad.obstacles.find(obstacle=>{
          let [entity] = obstacle
          let minDistance = Math.max(this.minSubgridDistance,entity.minSubgridDistance)
          let otherGlobalSubgrid = getAbsoluteGlobalSubgrid(otherRoad,entity.subgridIndexes)
          let distance = getMagnitude(currentGlobalSubgrid[0]-otherGlobalSubgrid[0],currentGlobalSubgrid[1]-otherGlobalSubgrid[1])
          return distance<minDistance
        })
      }))
    })
    let sameParent = this.parentObstacle&&this.parentObstacle.parent==this.parent
    if(!this.isOnRoad){
      possibleSubgridIndexes=possibleSubgridIndexes.filter(e=>{
        //|[-1,1]| vs. olduğunda bu değer sqrt2 olacak, yalnızca köşelere yerleştirmemiz gerekmesi durumunda işe yarıyor
        let isCross = getMagnitude(e[0],e[1])>1
        if(this.crossOnly&&!isCross)return false
        if(sameParent){
          return this.parentObstacle.subgridIndexes[0]==e[0]||this.parentObstacle.subgridIndexes[1]==e[1]
        }
        return true
      })
    }
    let currentSubgridIndexes = possibleSubgridIndexes.filter(e=>{
      return !currRoad.obstacles.find(([_, obsIndexes]) => arrayEquals(e, obsIndexes));
    });
    let occupierToHandle
    if (!possibleSubgridIndexes.length) return false;
      let currIndexes;
      if(this.forcedDirection){
      let ideal = [connectionArray[(connectionLookup[this.forcedDirection]+3)%4], //3 kısmı -1+4 için, sağa gidilecekse yukarı isteniyor vs.
      connectionArray[(connectionLookup[this.forcedDirection]+2)%4], 
        ] 
      let usable = ideal[0]
      let foundSubgrid=possibleSubgridIndexes.find(e=>{
        let abs = getAbsoluteSubgridIndex(e,this.parent._direction)
        return unorderedArrayEquals(getRelativeDirectionList([0,0],abs),ideal)
      })
      if(!foundSubgrid){
        foundSubgrid=possibleSubgridIndexes.find(e=>{
          let abs = getAbsoluteSubgridIndex(e,this.parent._direction)
          let currList =  getRelativeDirectionList([0,0],abs)
          return currList.includes(usable)
        })
      }
      if(!foundSubgrid)return false
      let occupier = this.parent.obstacles.find(e=>arrayEquals(e[1],foundSubgrid))
      if(occupier){
        if(occupier[0].forcedDirection)return false
        occupierToHandle=occupier[0]
      }
      currIndexes=foundSubgrid
    }else{
      let usableLength = currentSubgridIndexes.length
      if(usableLength==0)return false
      currIndexes = currentSubgridIndexes[Math.floor(Math.random() * usableLength)];
      if (this.isOnRoad) {
        this.chosenLane = this.usedLanes == 2 ? -1 : Math.floor(Math.random()) ? 1 : -1;
      }else this.chosenLane=currIndexes[1]
    }
    this.subgridIndexes = currIndexes;
    this.setRelativePosition();
    currRoad.obstacles.push([this, currIndexes]);
    if(occupierToHandle){
      //yer atandıktan sonra silinecek olana yeniden atanması için güncel nesne eklendikten sonra kontrol edilmesi gerekiyor
      let res = occupierToHandle.setRoad(gridX,gridY)
      if(!res)occupierToHandle.destroy()
    }
    return true;
  }
  destroy(){
    this.signObstacles.forEach(e=>e.destroy())
    this.removeFromObstacles()
    super.destroy()
  }
  changeRoadCondition(currentCondition){
    let obstacleType = this.entityType
    let curr = OBSTACLES[obstacleType];
    if(currentCondition){
      if(curr.imagePerRoad){
        this.sprite=curr.imagePerRoad[currentCondition]
      }else this.sprite=curr.image
    }else{
      this.sprite = curr.image;
    }
  }
  constructor(game, obstacleType,roadCondition,parentObstacle,forcedDirection) {
    super(game);
    this.parentObstacle=parentObstacle||null
    this.forcedDirection=forcedDirection
    let curr = OBSTACLES[obstacleType];
    this.entityType = obstacleType || "obstacle";
    if(THREATS.includes(obstacleType))this.massMultiplier=20
    //OBSTACLES'ta olmayan nesneler de yolda sayılıyor
    this.isOnRoad = !curr || curr.isOnRoad;
    if (!this.isOnRoad) this.isCollisionEffected = false;
    if (!curr) return;
    if(curr.zIndex!==undefined)this.zIndex=curr.zIndex
    this.possibleRoads = curr.roadTypes;
    this.width = curr.width;
    this.height=curr.height||null
    this.usedLanes = curr.lanes??1;
    this.directionOffset = curr.directionOffset??0;
    if(curr.isImmovable)this.isImmovable=true
    //boolean yapılıyor
    this.crossOnly=!!curr.crossOnly
    if (!game.obstacleCounters[obstacleType]) {
      game.obstacleCounters[obstacleType] = 0;
    }
    game.obstacleCounters[obstacleType]++;
    if(roadCondition){
      if(curr.imagePerRoad){
        this.sprite=curr.imagePerRoad[roadCondition]
      }else this.sprite=curr.image
    }else{
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
  changeCounter=0;
  isReverse=false
  zIndex=3
  minSubgridDistance=4
  sync(yellowLightTick,offset=0){
    if(!this.parent)return false
    this.yellowLightTick=yellowLightTick
    this.tickSinceChange=offset
    this.isReverse=this.parent.recursionIndex%2==0
    let stateIndex=this.isReverse?0:2
    this.state=LIGHT_STATES[stateIndex]
    this.spriteIndex=stateIndex
    this.setSprite()

    return true
  }
  setSprite() {
    this.sprite = this.sprites[this.spriteIndex % this.sprites.length];
  }
  tick(dt) {
    let isYellow = this.state==LIGHT_STATES[1]
    let requirement = isYellow?this.yellowLightTick:(LIGHT_CHANGE_TICK-this.yellowLightTick/2)
    let needsToChange = this.tickSinceChange++>=requirement
    if (needsToChange) {
      let stateIndex = isYellow?(this.changeCounter%2==1)==this.isReverse?2:0:1
      this.state = LIGHT_STATES[stateIndex];
      this.spriteIndex=stateIndex
      this.setSprite();
      this.setPosition(this.posX, this.posY);
      this.tickSinceChange=0
      if(!isYellow)this.changeCounter++
    }
    super.tick(dt);
  }
  setRelativePosition(){
    super.setRelativePosition()
    if(this.relativeDirection=="left"||this.relativeDirection=="right"){
      //diğer nesnelerin yönlerini bozmadan ışıkların ışık kısmınını birbirine yakın olması için
      this._direction+=180
    }
  }
  destroy(){
    this.game.lights=this.game.lights.filter(e=>e!=this)
    super.destroy()
  }
  constructor(game,isOther=false) {
    super(game);
    this.sprites = ["k-ısık", "s-ısık", "y-ısık"];
    this.entityType = "light";
    this.width = CAR_WIDTH*3/11;
    if(isOther)this.directionOffset=90
    this.isOther=isOther
    this.game.lights.push(this)
    this.setSprite();
  }
}
//haritada boşluğu doldurmak için kullanılan her class bu class'tan kalıtım alıyor, class olduğu gibi kullanılmamalı
class Filler extends Entity {
  isImmovable=true
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
    this.sprite.tint = 0x00ffcf;
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
    this.entityType="side"
  }
}
export class BuildingCollision extends Entity{
  ratio=1
  tick=noop
  setPosition(x,y){
    let lastIndexes = this.gridIndexes
    super.setPosition(x,y)
    this.gridIndexes=getIndexes(x,y)
    let gridIndexes = this.gridIndexes
    if(lastIndexes){
      this.game.gridEntitySets[lastIndexes[0]]?.[lastIndexes[1]]?.delete(this)
    }
    this.game.gridEntitySets[gridIndexes[0]]?.[gridIndexes[1]]?.add(this)
  }
  constructor(game) {
    super(game)
    this.entityType="buildingcollision"
    this.width=ROAD_WIDTH*0.9
    let xMax = this.width-1
    let bounds = [0,0,xMax,xMax]
    this.scaledBounds=bounds
    this.bounds=[[0,0],[0,xMax],[xMax,0],[xMax,xMax]]
    
  }
}
export class Building extends Filler {
  tick = noop;
  collisionEntity
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
    let lastGrids = this.currentGrids
    this.currentGrids = this.getGrids();
    this.resetGridSets(lastGrids)
  }
  spriteWidth = ROAD_WIDTH * BUILDING_MULTIPLIER;
  constructor(game) {
    super(game);
    this.entityType = "building";
    this.sprite = getRandom(BUILDING_TOPS);
    this.forceSquare=true
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
    this.childContainer.zIndex=0
    background.zIndex=0
    this.sprite.zIndex = 4;
    //this.collisionEntity=new BuildingCollision(game)
  }
}
export class Park extends Filler {
  constructor(game) {
    super(game);
    this.entityType="park"
    this.sprite = "park alanı";
    this.sprite.tint = 0xd0e0d0;
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
  lastStart=[-1,-1]
  lastEnd=[-1,-1]
  lastGrids
  getGrids() {
    let line = this.getLines()[0]
    let start = getIndexes(line[0][0],line[0][1])
    let end = getIndexes(line[1][0],line[1][1])
    if(this.lastGrids&&this.lastStart[0]==start[0]&&this.lastStart[1]==start[1]&&this.lastEnd[0]==end[0]&&this.lastEnd[1]){
      return this.lastGrids
    }
    let currentGridsArray = []
    let minX = Math.min(start[0],end[0])
    let maxX = Math.max(start[0],end[0])
    let minY = Math.min(start[1],end[1])
    let maxY = Math.max(start[1],end[1])
    for(let i = minX;i<=maxX;i++){
      for(let j = minY;j<=maxY;j++){
        let curr = [i,j]
        currentGridsArray.push((curr));
      }
    }
    this.lastStart=start
    this.lastEnd=end
    let lastGrids = this.currentGrids
    this.currentGridsArray=currentGridsArray
    if(this.isImmovable){
      this.resetGridSets(lastGrids)
    }
    return this.lastStart=new Set(currentGridsArray);
  }
  getColliders() {
    return super.getColliders().filter(e=>e != this.parent);
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
        color: isColliding ? 0xff0000 : 0x0000ff,
      });
      this.drawLine(true);
      this.lastColliding = isColliding;
    }
    this.currentGrids = this.getGrids();
  };
  constructor(game, degree, parent, length = CAR_WIDTH, xOffset = 0, yOffset = 0) {
    super(game);
    this.xOffset = xOffset;
    this.yOffset = yOffset
    this.entityType = "sensor";
    this.length = length;
    this.lineLength = length;
    this.output = [length, null];
    this.offsetDegree = degree;
    this.parent = parent;
    this.graphics.setStrokeStyle({
      color: 0x0000ff,
    });
    this.drawLine(true);
  }
}

function calculateVehicleProperties(roadCondition, isTurning = false, isBraking = false) {
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
      drag = 3.1;
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
let clearPath = (roads) => {
  roads.forEach(e=>e.forEach(e=>e.highlightToggles.forEach((_, i) => e.toggleHighlight(i, false))));
};
let drawPath = (roads, currPath, clearPrevious = true) => {
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
let getAbsoluteGlobalSubgrid = (road,subgridIndex)=>{
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
      resolveAllCollisions(dt,this.globalColliders,20,0.2,1)
    }
    this.globalColliders = new Set();
    this.tickCounter++;
  }
  graphicsTick() {
    //Frame değişimi başına çağrılıyor
    this.entities.forEach(e=>e.setGraphics());
  }
  setMap() {
    this.map = pruneRoads(createMap());
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
      let chosenAmount = Math.max(remaining,2)+Math.floor(Math.random()*2)//normalde kalan engel miktarı kadar, aksi takdirde 2+ adet ışık
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