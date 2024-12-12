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
export const DEFAULT_LIGHT_DISTANCE = 200;
export const PEDESTRIAN_MOVE_MULTIPLIER = 50;
export const IS_DEBUG = false; //Yapılacak değişiklik engine.mjs üzerinde değilse kapalı kalsın, diğer şeyleri etkilemediğini kontrol etmek için kullanılacak
export const IS_PROD = true;
export const USE_TEST_DATA = false
export const THREATS = ["rogar", "bariyer", "cukur", "car", "road", "pedestrian"];
export const REAL_THREATS = ["rogar", "bariyer", "cukur", "car", "pedestrian"];
export const PHYSICAL_THREATS = ["car", "pedestrian", "building", "side"];
export const NONPHYSICAL_THREATS = ["yayaGecidi", "light", "kasis"];
export const ROAD_TYPES_ARR = ["straight", "rightcurve", "3", "4"];
export const CAR_SPRITES = [["car2.png", true, 0.3, 1], ["temp_car.png", true, 0.3, 1]];
//total 1 olmaları gerekmiyor
export const ROAD_CONDITION_WEIGHTS = {
  asphalt: 0.7,
  dirt: 0.2,
  slippery: 0.2
};
export const ROAD_CONDITION_ARR = ["asphalt", "dirt", "slippery"];
export const ROAD_CONDITION_INDEXES = {
  asphalt: 0,
  dirt: 1,
  slippery: 2
};
let withoutCurve = ROAD_TYPES_ARR.filter(e => e != "rightcurve");
export const OBSTACLES = {
  rogar: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH * 3 / 2,
    image: "rogarKapagi.png",
    useWidthAsHeight: true,
    isRotated: true,
    lanes: 1,
    directionOffset: 90,
    roadCondition: "dirt",
    roadConditionInverted: true,
    weight: 2
  },
  cukur: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH,
    image: "cukur.png",
    useWidthAsHeight: false,
    lanes: 1,
    directionOffset: 90,
    roadCondition: "dirt",
    roadConditionInverted: false,
    weight: 3
  },
  bariyer: {
    isOnRoad: true,
    roadTypes: ["straight"],
    width: CAR_WIDTH * 15 / 18,
    image: "bariyer.png",
    useWidthAsHeight: true,
    lanes: 1,
    roadCondition: "dirt",
    roadConditionInverted: true,
    isImmovable: true,
    weight: 2
  },
  bariyerLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH * 2 / 3,
    width: CAR_WIDTH * 2 / 3,
    image: "bariyerLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "dirt",
    roadConditionInverted: true
  },
  kasis: {
    isOnRoad: true,
    roadTypes: ["straight"],
    width: ROAD_WIDTH / 2,
    image: "kasis.png",
    useWidthAsHeight: true,
    lanes: 2,
    roadCondition: "asphalt",
    roadConditionInverted: false
  },
  kasisLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH,
    image: "kasisLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "asphalt",
    roadConditionInverted: false
  },
  hizSiniriLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH * 3 / 4,
    image: "hiz.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "dirt",
    roadConditionInverted: true
  },
  hizSiniriKaldirmaLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: CAR_WIDTH * 2 / 3,
    image: "hizLevha.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "dirt",
    roadConditionInverted: true,
    weight: 0.25
  },
  yayaGecidi: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: CAR_WIDTH / 2,
    height: ROAD_WIDTH / 2,
    imagePerRoad: { asphalt: "yayayoluasfalt.png", slippery: "yayayolukaygan.png" },
    useWidthAsHeight: true,
    directionOffset: 270,
    lanes: 2,
    roadCondition: "dirt",
    roadConditionInverted: true,
    weight: 0.5
  },
  yayaGecidiLevha: {
    isOnRoad: false,
    roadTypes: withoutCurve,
    width: (CAR_WIDTH * 2) / 3,
    image: "lvh2.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "asphalt",
    roadConditionInverted: false
  },
  puddle: {
    isOnRoad: true,
    roadTypes: withoutCurve,
    width: (CAR_WIDTH * 2) / 3,
    image: "birikinti.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "slippery",
    roadConditionInverted: false,
    weight: 2
  },
  stopLevha: {
    isOnRoad: false,
    roadTypes: ["4"],
    width: (CAR_WIDTH * 2) / 3,
    image: "lvh.png",
    useWidthAsHeight: false,
    lanes: 1,
    roadCondition: "slippery",
    roadConditionInverted: true,
    crossOnly: true,
    weight: 0.1
  },
};
export const OBSTACLE_SIGNS = [];
export const OBSTACLES_WITH_SIGN = Object.fromEntries(Object.keys(OBSTACLES).filter(e => {
  let signKey = e + "Levha";
  let retVal = signKey in OBSTACLES;
  if (retVal) {
    OBSTACLE_SIGNS.push(signKey);
  }
  return retVal;
}).map(e => [e, 1]));
export const OBSTACLE_IMAGES = Object.values(OBSTACLES).map(e => e.imagePerRoad ? Object.values(e.imagePerRoad) : e.image).flat();
export const OBSTACLE_IMAGE_TO_NAME = Object.fromEntries(Object.entries(OBSTACLES).map(e => e[1].imagePerRoad ? Object.values(e[1].imagePerRoad).map(img => [img, e[0]]) : [[e[1].image, e[0]]]).flat());
// Farklı uzantıları olsa bile aynı ismi birden fazla resimde kullanmamamız gerekiyor, zaten karışıklık olurdu
export const TYPE_TO_IMAGE = {
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
export const ROAD_IMAGES = Object.values(TYPE_TO_IMAGE).map(e => Object.values(e)).flat();
export const LIGHT_IMAGES = ["k-ısık.png", "s-ısık.png", "y-ısık.png", "kapalı_ısık.png"];
export const ROAD_TYPES_OBJ = Object.fromEntries(ROAD_TYPES_ARR.map((e, i) => [e, i]));
export const BUILDING_TOPS = ["bina_test.png", "cati1.png"];
export const BUILDING_SIDES = ["bina_yan.png", "bina1.png"];
export const PEDESTRIANS = ["yaya.png", "yaya2.png", "yaya3.png"];
export const CAR_IMAGES = CAR_SPRITES.map(e => e[0]);
export const DIRECTION_ALTERNATIVE = 1; // 1 ya da 2 olabilir, kullanım gerekçeleri yorum olarak açıklandı
export const PERSPECTIVE = [0.5, 0.5]; // Binalar varsayılan olarak ortadan bakan birinin göreceği şekilde 3d çiziliyor, başka oyunlarda yine kuş bakışı olmasına rağmen yukarıdan veya aşağıdan bakılmış gibi çizenler olmuş, belirtilen değerler sırasıyla genişlik ve yüksekliğe göre ölçekleniyor
export const ROAD_TYPES = {
  straight: [0, 180],
  rightcurve: [90, 180],
  3: [0, 90, 270],
  4: [0, 90, 180, 270],
};
export let angleLookup = {
  0: "up",
  90: "right",
  180: "down",
  270: "left",
};
export let connectionArray = ["up", "right", "down", "left"];
export let connectionLookup = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};
export const LINE_AMOUNTS = {
  straight: 4,
  4: 8,
  3: 5,
  rightcurve: 10,
};
export const CHANCE_ROAD_WEIGHTS = {
  3: 0.5,
  4: 0.5,
};
export const LIGHT_STATES = ["RED", "YELLOW", "GREEN"];
export let testData = [[[[1,90,0,1],[1,270,0,1],[0,270,1,0],[0,270,0,1],[1,0,0,2],[1,180,1,2]],[[0,180,0,2],[3,270,0,1],[2,0,2,0],[0,90,0,1],[0,270,2,2],[-1,-1]],[[1,0,1,0],[3,270,0,0],[1,180,2,0],[0,90,0,1],[2,180,2,2],[1,270,0,2]],[[0,90,2,0],[1,90,0,1],[0,0,0,1],[1,180,2,1],[0,90,0,2],[0,90,0,2]],[[1,90,0,0],[0,180,0,0],[2,90,0,0],[1,270,0,0],[0,90,0,2],[0,90,0,2]],[[0,0,2,2],[1,270,2,2],[0,270,1,1],[0,270,0,0],[0,90,0,2],[2,180,0,2]],[[-1,-1],[0,90,2,2],[1,90,1,1],[3,270,0,0],[3,270,0,1],[3,180,0,1]],[[1,0,2,1],[3,90,0,1],[2,90,0,1],[2,0,0,0],[0,90,0,2],[1,90,0,2]]],[3,1],[7,2]]
