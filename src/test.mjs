import {
    createMap,
    findPath,
  } from "../src/engine.mjs";

let grid = createMap();
window.grid=grid;
let getRandom =(grid) => {
let x = Math.floor(Math.random() * grid.length);
let y = Math.floor(Math.random() * grid[0].length);
return [x, y];
}
let arePathsEqual = (paths) => {
    
const referencePath = paths[0];

// Diğer yolları karşılaştır
for (let i = 1; i < paths.length; i++) {
    const currentPath = paths[i];

    // Uzunlukları farklıysa yollar eşit değildir
    if (referencePath.length !== currentPath.length) {
    return false;
    }

    // Her bir düğümü kontrol et
    for (let j = 0; j < referencePath.length; j++) {
    const [x1, y1] = referencePath[j];
    const [x2, y2] = currentPath[j];

    if (x1 !== x2 || y1 !== y2) {
        return false;
    }
    }
}
return true;
}
const algorithms = ["DFS", "UCS", "A*"];
let roadEqual;

do {
const randStart = getRandom(grid); 
const randEnd = getRandom(grid);  

let paths = algorithms.map(algorithm => findPath(grid, algorithm, randStart, randEnd));

const dfsPath = paths[0];
const ucsPath = paths[1];
const aStarPath = paths[2];

const ucsEqualsAStar = arePathsEqual([ucsPath, aStarPath]);
const dfsDifferent = !arePathsEqual([dfsPath, aStarPath]);

roadEqual = !(ucsEqualsAStar && dfsDifferent);

console.log("Başlangıç:", randStart, "Bitiş:", randEnd);
console.log("DFS Yolu:", dfsPath);
console.log("UCS Yolu:", ucsPath);
console.log("A* Yolu:", aStarPath);
console.log("A* == UCS:", ucsEqualsAStar, "DFS != A*:", dfsDifferent);
} while (roadEqual);

console.log("Uygun grid bulundu!");
//console.log(grid)