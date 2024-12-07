import {createMap,findPath} from "../src/engine.mjs";
const CREATE_TEST = true
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
let findDifferent = ()=>{
    let grid,randStart,randEnd,pathCondition
    do {
        grid = createMap(),randStart=getRandom(grid),randEnd=getRandom(grid);
        let paths = algorithms.map(algorithm => findPath(grid, algorithm, randStart, randEnd,true /*true olması durumunda DFS'de kısa yol bulmak için diğer yollar da aranıyor*/));
        const dfsPath = paths[0];
        const ucsPath = paths[1];
        const aStarPath = paths[2];
        const ucsEqualsAStar = arePathsEqual([ucsPath, aStarPath]);
        const dfsDifferent = !arePathsEqual([dfsPath, aStarPath]);
        pathCondition = ucsEqualsAStar&&dfsDifferent;
        console.count("test")
        if(pathCondition){
            console.log("Başlangıç:", randStart, "Bitiş:", randEnd);
            console.log("DFS Yolu:", dfsPath);
            console.log("UCS Yolu:", ucsPath);
            console.log("A* Yolu:", aStarPath);
            console.log("A* == UCS:", ucsEqualsAStar, "DFS != A*:", dfsDifferent);
        }
    } while (!pathCondition);
    return [grid,randStart,randEnd]
}
if(CREATE_TEST){
    window.testResult=findDifferent()
    console.log("copy(JSON.stringify(testResult) yazarak sonuç kopyalanabilir")
}else{
    let testData = [[[[1,90,0,1],[1,270,0,1],[0,270,1,0],[0,270,0,1],[1,0,0,2],[1,180,1,2]],[[0,180,0,2],[3,270,0,1],[2,0,2,0],[0,90,0,1],[0,270,2,2],[-1,-1]],[[1,0,1,0],[3,270,0,0],[1,180,2,0],[0,90,0,1],[2,180,2,2],[1,270,0,2]],[[0,90,2,0],[1,90,0,1],[0,0,0,1],[1,180,2,1],[0,90,0,2],[0,90,0,2]],[[1,90,0,0],[0,180,0,0],[2,90,0,0],[1,270,0,0],[0,90,0,2],[0,90,0,2]],[[0,0,2,2],[1,270,2,2],[0,270,1,1],[0,270,0,0],[0,90,0,2],[2,180,0,2]],[[-1,-1],[0,90,2,2],[1,90,1,1],[3,270,0,0],[3,270,0,1],[3,180,0,1]],[[1,0,2,1],[3,90,0,1],[2,90,0,1],[2,0,0,0],[0,90,0,2],[1,90,0,2]]],[3,1],[7,2]]
    let [grid,randStart,randEnd] = testData
    let paths = algorithms.map(algorithm => findPath(grid, algorithm, randStart, randEnd));
    const dfsPath = paths[0];
    const ucsPath = paths[1];
    const aStarPath = paths[2];
    const ucsEqualsAStar = arePathsEqual([ucsPath, aStarPath]);
    const dfsDifferent = !arePathsEqual([dfsPath, aStarPath]);
    let pathCondition = ucsEqualsAStar&&dfsDifferent
    let errMessage = ""
    if(!ucsEqualsAStar){
        errMessage+="UCS: "+JSON.stringify(ucsPath)
        errMessage+=" != "
        errMessage+="A*: "+JSON.stringify(aStarPath)
    }
    if(!dfsDifferent){
        errMessage+="DFS: "+JSON.stringify(dfsPath)
        errMessage+=" == "
        errMessage+="A*: "+JSON.stringify(aStarPath)
    }
    console.assert(pathCondition,"Yol bulma test verisi hatalı:\n"+errMessage)
}