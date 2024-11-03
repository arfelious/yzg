    /*
      TODO:
          GENEL OPTİMİZASYON
          Kod okunurluğu arttırılacak, kod tekrarı düşürülecek
          hareketsiz nesnelerin collision çizgileri kaydedilip kullanılmalı
          hareketli nesnelerin collisoin çizgileri de 1 tick süresi kadar kaydedilmeli
          collision sadece nesnenin içinde bulunduğu ve temas ettiği grid'ler için kontrol edilmeli
          game class'ı haritayı ve entity'leri barındırmalı, istenmesi durumunda yeniden başlatılabilmeli
          tüm nesnelerin alt nesnelere dair property'si olmalı, araçlarda bu customLine'ı tutacak, yollarda highlightLines ve engelleri tutacak
          road class'ı için getLines fonksiyonundaki kod tekrarı verimlilik düşürülmeden azaltılacak
          aracın oluşturduğu çizgi hesaplanırken getFrontLine tüm çizgileri hesaplatıyor, ayrı olarak hesaplanması daha iyi olur
          kavisli yolda bakılan yön yanlış bulunabiliyor
          yol bulucunun çizdiği yolun sonuna görünürlüğü arttırmak amacıyla daire eklenecek
          optimal yolu bulması isteniyorsa findPath memoization kullanmalı
          mobilde test için oyun kısmının dışına 4 adet buton, WASD ile yapıldığı gibi hareket edilmesini sağlayacak
          engine.mjs kısmı mainCar'ın yerleştirilmesi ve harita oluşturan fonksiyonun çağrılması gibi kısımları içermemeli, ayrı bir game.mjs dosyası oluşturulabilir
          yol budama sistemi: harita şu an fazla dolu, fazla dönemeç içeren kısımlar kırpılıp kalan kısım uygun şekilde ayarlanır
          yol olmayan yerlere geçici yeşil kare sprite, resimler ayarlanınca bina park vs. ile değiştirilecek
          road nesnelerinin içinde şeridi temsil eden bir nesne olmalı. modelin şeridi geçmesinin ve yoldan çıkmasının ayrı değerlendirilebilmesi için gerekli
          hızı, ivmeyi ve sürtünmeyi belirleyen sabit değerler yola ve araca bağlı olmalı, şimdilik hangi tür yol olduğunu söyleyen yer tutucu fonksiyon yazabiliriz
            isUsingBrake kullanılırken TURN_DRAG değiştirilmeli
          collidersEquals fonksiyonu yazılmalı 
            prev array'indeki her elemanın next'te de bulunmasına bakması yeterli olur ama optimize edilebilir
          araçların iç ve dış hız değerleri farklı olmalı. araçların yönü hızına göre belirlendiği için bir araç çarparsa araç aniden yön değiştirir, önlemek içi ayrı hız değerleri kullanılıp hesaplamalarda ikisini beraber kullanacak bi hız değeri kullanılır. direction ve _direction'da olduğu gibi getter setter kullanılmalı
          trafik işaretleri, engeller ve farklı araçlar eklenmeli
          collision resolution
      MAYBE:
        visualize buttons as they are being pressed, might be necessary when RL model is used
      */
    // Oyun ekranı boyutları
    const WIDTH = 1200;
    const HEIGHT = 900;
    // Araç özellikleri
    const CAR_WIDTH = 48;
    const ROAD_WIDTH = 150
    const BARRIER_WIDTH = CAR_WIDTH/2
    const DRAG = 4.4; // increases drag when increased
    const TURN_DRAG = 1.2;
    const MOVE_MULTIPLIER = 100; // acceleration, should be increased when drag is increased
    const STEERING_MULTIPLIER = 1.4
    const MIN_ALIGNMENT = 0.7
    const PATH_START_INDEX = 2
    const HIGHLIGHT_STYLE = {color:0x006699,width:4}
    const app = new PIXI.Application();
    const { BitmapText } = PIXI;
    await app.init({ width: WIDTH, height: HEIGHT, antialias: true, autoDensity: true});
    let staticContainer = new PIXI.Container();
    app.stage.addChild(staticContainer)
    let changeImageResolution=async (texture, options)=>{
      if(!options)return texture
      let [intendedWidth,isRotated] = options
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if(isRotated){
        canvas.width = Math.ceil(texture.width/texture.height * intendedWidth);
        canvas.height = intendedWidth;
      }else{
        canvas.width = intendedWidth;
        canvas.height = Math.ceil(texture.width/texture.height * intendedWidth);
      }
      let image = await app.renderer.extract.image(texture)
      return new Promise(res=>{
        image.onload=()=>{
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          let retVal = PIXI.Texture.from(canvas)
          res(retVal)
        }
      })
    }
    const ROAD_TYPES_ARR = ["straight","rightcurve","3","4"]
    // Farklı uzantıları olsa bile aynı ismi birden fazla resimde kullanmamamız gerekiyor, zaten karışıklık olurdu
    const ROAD_IMAGES = ["duzyol.png", "yol1.png","yol3.png","dortyol.png"]
    const IMAGE_TO_TYPE = {"duzyol.png":"straight","yol1.png":"rightcurve","yol3.png":"3","dortyol.png":"4"}
    const TYPE_TO_IMAGE = {"straight":"duzyol.png","rightcurve":"yol1.png","3":"yol3.png","4":"dortyol.png"}
    const ROAD_TYPES_OBJ = Object.fromEntries(ROAD_TYPES_ARR.map((e,i)=>[e,i]))
    let imagesArray = ["temp_car.png", "bariyerr.png",...ROAD_IMAGES]
    //Alta eklenen resimler ölçekleniyor, bellek kullanımını düşürmeye büyük katkı sağlıyor
    let intendedWidths = {"temp_car.png":[CAR_WIDTH,true]}
    ROAD_IMAGES.forEach(e=>intendedWidths[e]=[ROAD_WIDTH,false])
    const ROAD_TYPES = {"straight":[0,180],"rightcurve":[90,180],"3":[0,90,270],"4":[0,90,180,270]}
    let angleLookup = {0:"up",90:"right",180:"down",270:"left"}
    let connectionArray = ["up","right","down","left"]
    let connectionLookup = {"up":0,"right":1,"down":2,"left":3}
    const LINE_AMOUNTS = {"straight":4,"4":8,"3":5,"rightcurve":10}
    let startTime = Date.now()
    let shiftConnections = (connections,angle)=>{
      return connections.map(e=>connectionArray[Math.floor(connectionLookup[e]+angle/90)%4])
    }
    function getConnections(roadType, angle) {
      return shiftConnections(ROAD_TYPES[roadType].map(e=>angleLookup[e]),angle)
    }
    let getOpposite=(direction)=>{
      return connectionArray[(connectionLookup[direction]+2)%4]
    }
    let getNextDirection = (roadType,angle,fromDirection,possibleDirections=getConnections(roadType,angle))=>{
      return roadType=="4"?getOpposite(fromDirection):roadType=="3"?angleLookup[angle]==fromDirection?possibleDirections[0]:getOpposite(fromDirection):roadType=="rightcurve"?possibleDirections[0]:possibleDirections[0]
    }
    let getRelativeDirection = (p1,p2)=>{
      //p1 p2'ye gidiyorsa hangi yönden geldiği
      let xDiff = p2[0]-p1[0]
      let yDiff = p2[1]-p1[1]
      return xDiff>0?"left":xDiff<0?"right":yDiff>0?"up":"down"
    }
    let getWeights = grid=>{
      let weightObj = {}
      ROAD_TYPES_ARR.forEach(e=>weightObj[e]=Math.random())
      grid.forEach(col=>col.forEach(e=>{
        if(e[0]==-1)return
        weightObj[ROAD_TYPES_ARR[e[0]]]+=Math.random()
      }))
      return weightObj
    }
    let countInserted = grid=>grid.map(e=>e.filter(e=>e[0]!=-1).length).reduce((x,y)=>x+y)
    let inBounds = (point)=>point[0]>=0&&point[0]<GRID_WIDTH&&point[1]>=0&&point[1]<GRID_HEIGHT
    let shuffle = x=>{
      for(let i = 0;i<x.length;i++){
        let randIndex = Math.floor(Math.random()*(x.length-i))+i;
        [x[i],x[randIndex]]=[x[randIndex],x[i]]
      }
      return x
    }
    let randomAngles = ()=>shuffle([0,90,180,270])
    let getNeighbours = point=>[[point[0],point[1]-1],[point[0]+1,point[1]],[point[0],point[1]+1],[point[0]-1,point[1]]]
    let createMap = (grid,curr,fromDirection)=>{
      let firstInsert = !grid
      if(firstInsert){
        //TODO: memoization eklendiğinde burada eski veriler silinmeli
        grid=Array(GRID_WIDTH).fill().map(e=>Array(GRID_HEIGHT).fill([-1,-1]))
        let initialY = Math.floor(Math.random()*GRID_HEIGHT)
        curr=[0,initialY]
        fromDirection="left"
      }
      if(grid[curr[0]][curr[1]][0]!=-1){
        let roadType = ROAD_TYPES_ARR[grid[curr[0]][curr[1]][0]]
        let currentDirections = getConnections(roadType,grid[curr[0]][curr[1]][1])
        return currentDirections.includes(fromDirection)?grid:false
      }
      let nextPossibleRoads=getNeighbours(curr)
      let currWeights = getWeights(grid)
      let currRoads = firstInsert?["straight"]:ROAD_TYPES_ARR.slice(0).sort((x,y)=>currWeights[x]-currWeights[y])
      let tempGrid = grid.map(e=>e.slice(0)) //referansın üzerine yazmamak için kopyalanıyor
      for(let i = 0;i<currRoads.length;i++){
          let roadType = currRoads[i]
          let angles = randomAngles()
          for(let j=0;j<4;j++){
            let angle = angles[j]
            let possibleDirections = getConnections(roadType,angle)
            if(!possibleDirections.includes(fromDirection))continue
            let iTempGrid = tempGrid
            possibleDirections=possibleDirections.filter(e=>e!=fromDirection)
            let mainNextDirection = getNextDirection(roadType,angle,fromDirection,possibleDirections)
            let nextCoords = nextPossibleRoads[connectionLookup[mainNextDirection]]
            let nextFromDirection = getOpposite(mainNextDirection)
            iTempGrid[curr[0]][curr[1]]=[ROAD_TYPES_OBJ[roadType],angle]
            if(inBounds(nextCoords)){
              let currTempGrid = createMap(tempGrid,nextCoords,nextFromDirection)
              if(!currTempGrid)continue
              iTempGrid=currTempGrid
            }//eğer harita sınırı dahilinde değilse sorun değil, şehir harita dışına uzuyor gibi olur sadece
            possibleDirections=possibleDirections.filter(e=>e!=mainNextDirection)
            let hasFailed = false
            for(let q = 0;q<possibleDirections.length;q++){
              let currDirection = possibleDirections[q]
              let directionIndex = connectionLookup[currDirection]
              let currCoords = nextPossibleRoads[directionIndex]
              let currFromDirection = getOpposite(currDirection)
              if(inBounds(currCoords)){
                let currGrid=createMap(iTempGrid,currCoords,currFromDirection)
                if(!currGrid){
                  hasFailed=true
                  break;
                }
                iTempGrid=currGrid
              }
            }
            if(!hasFailed){
              if(firstInsert&&countInserted(iTempGrid)/GRID_HEIGHT/GRID_HEIGHT<0.4)return createMap()
              return iTempGrid
            }
          }
      }
      return false
    }
    let copyVisitedObj = x=>{
      let res = {}
      for(let e in x){
        res[e]={}
        for(let i in x[e]){
          res[e][i]=1
        }
      }
      return res
    }
    let findPath = (grid,road1Indexes,road2Indexes,getMinimumDistance=false,forceInitialDirection,visited,visitedObj)=>{
      let isInitial=!visited
      if(isInitial){
        visited=[]
        visitedObj={}
      }
      visited.push(road1Indexes)
      let [currX,currY]=road1Indexes
      if(!visitedObj[currX])visitedObj[currX]={}
      if(visitedObj[currX][currY])return false
      else visitedObj[currX][currY]=1
      if(currX<0||currX>=GRID_WIDTH||currY<0||currY>=GRID_HEIGHT)return false
      if(currX==road2Indexes[0]&&currY==road2Indexes[1]){
        return visited
      }
      let left = grid[road1Indexes[0]][road1Indexes[1]]
      if(left[0]==-1)return false
      let leftNeighbours=getNeighbours(road1Indexes)
      let leftConnections = getConnections(ROAD_TYPES_ARR[left[0]],left[1]).map(e=>leftNeighbours[connectionLookup[e]])
      let forcedIsArray = Array.isArray(forceInitialDirection)
      let forcedDirection = forceInitialDirection?forcedIsArray?forceInitialDirection.map(e=>leftConnections[connectionLookup[e]]):leftNeighbours[connectionLookup[forceInitialDirection]]:null
      if(isInitial&&forceInitialDirection){
        if(forcedIsArray){
          leftConnections=leftConnections.filter(e=>forcedDirection.includes(e))
        }else if(leftConnections.includes(forcedDirection)){
        leftConnections=[forcedDirection]
        }
      }
      let currMinimumLength=Infinity
      let res=false
      for(let i = 0;i<leftConnections.length;i++){
        let curr = leftConnections[i]
        let tempRes = findPath(grid,curr,road2Indexes,getMinimumDistance,null,visited.map(e=>e),copyVisitedObj(visitedObj))
        if(tempRes){
          if(!getMinimumDistance)return tempRes
          let tempLength = tempRes.length
          if(tempLength<currMinimumLength){
            currMinimumLength=tempLength
            res=tempRes
          }
        }
      }
      return res
    }
    let findPathTo = (x,y,getMinimumDistance,forceInitialDirection)=>{
      let gridIndexes = getIndexes(x,y)
      let [gridX,gridY] = gridIndexes
      let gridElement = currMap[gridX][gridY]
      if(gridElement[0]==-1)return false
      let res = findPath(currMap,getIndexes(mainCar.posX,mainCar.posY),gridIndexes,getMinimumDistance,forceInitialDirection)
      return res
    }
    let imagePaths = {}
    //Tüm resimler asenkron yükleniyor, hepsi yüklenene kadar bekleniliyor
    await Promise.all(imagesArray.map(imgPath =>new Promise(async res=>{
      let currPath = "../assets/" + imgPath
      let loaded = await PIXI.Assets.load(currPath)
      loaded.source.scaleMode = 'nearest';
      let imageToUse = await changeImageResolution(loaded,intendedWidths[imgPath])
      imagePaths[imgPath] = imageToUse
      imagePaths[imgPath.split(".").slice(0, -1).join(".")] = imageToUse
      res()
      })
    ))
    let sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    let noop = ()=>{}
    document.body.appendChild(app.canvas);
    app.canvas.style=""
    app.canvas.id="game"
    const GRID_WIDTH = WIDTH/ROAD_WIDTH
    const GRID_HEIGHT = HEIGHT/ROAD_WIDTH
    let entities = []
    window.GRID_WIDTH=GRID_WIDTH
    window.GRID_HEIGHT=GRID_HEIGHT
    window.entities = entities
    let cars = [];
    let toRadian = (x) => (x / 180) * Math.PI;
    let getMagnitude = Math.hypot
    let toVector = x => [Math.cos(toRadian(x)), Math.sin(toRadian(x))]
    let toUnitVector = x => {
      let length = getMagnitude(x[0], x[1])
      return [x[0] / length, x[1] / length]
    }
    let dotProduct = (x, y) => {
      let product = 0
      for (let i = 0; i < x.length; i++)product += x[i] * y[i]
      return product
    }
    let crossProduct = (P, Q, R) => {
      return (Q[0] - P[0]) * (R[1] - P[1]) - (Q[1] - P[1]) * (R[0] - P[0]);
    };
    let getOrientation = (P, Q, R) => {
      const val = crossProduct(P, Q, R);
      if (val == 0) return 0;
      return val > 0 ? 1 : 2
    };
    let isOnLineSegment = (P, Q, R) => {
      return (Q[0] < Math.max(P[0], R[0]) && Q[0] > Math.min(P[0], R[0]) &&
        Q[1] < Math.max(P[1], R[1]) && Q[1] > Math.min(P[1], R[1]));
    }
    let getIntersectionPoint = (line1,line2)=>{
      let [A,B] = line1
      let [C,D] = line2
      const x1 = A[0], y1 = A[1];
      const x2 = B[0], y2 = B[1];
      const x3 = C[0], y3 = C[1];
      const x4 = D[0], y4 = D[1];
      const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (denominator === 0) {
          return null;
      }
      const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
      const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
      return [intersectX, intersectY]; 
    }
    let checkIntersects = (A, B, C, D) => {
      const o1 = getOrientation(A, B, C);
      const o2 = getOrientation(A, B, D);
      const o3 = getOrientation(C, D, A);
      const o4 = getOrientation(C, D, B);
      if (o1 != o2 && o3 != o4) return true;
      if (o1 == 0 && isOnLineSegment(A, C, B)) return true;
      if (o2 == 0 && isOnLineSegment(A, D, B)) return true;
      if (o3 == 0 && isOnLineSegment(C, A, D)) return true;
      if (o4 == 0 && isOnLineSegment(C, B, D)) return true;
      return false;
    }
    let getIndexes = (x,y)=>[Math.floor(x/ROAD_WIDTH),Math.floor(y/ROAD_WIDTH)]
    let toDegree = (x) => (x / Math.PI) * 180;
    let getBounds = sprite => {
      let extracted = app.renderer.extract.pixels(sprite)
      let xMin = 255, yMin = 255, xMax = 0, yMax = 0
      let pixels = extracted.pixels
      let { width, height } = extracted
      let pixelsLength = pixels.length
      for (let i = 0; i < pixelsLength; i += 4) {
        let index = i / 4
        let x = index % width
        let y = Math.floor(index / width)
        let a = pixels[i + 3]
        if (a > 200) {
          if (x < xMin) xMin = x
          if (x > xMax) xMax = x
          if (y < yMin) yMin = y
          if (y > yMax) yMax = y
        }
      }
      let retVal = [[xMin, yMin], [xMin, yMax], [xMax, yMin], [xMax, yMax]]
      return retVal
    }
    let arrayEquals = (arr1,arr2)=>{
      let len1 = arr1.length
      let len2 = arr2.length
      if(len1!=len2)return false
      for(let i =0;i<len1;i++)if(arr1[i]!=arr2[i])return false
      return true
    }
    let collidersEquals = (prev, next) => {
      //TODO
      return false
    }
    class Entity {
      isImmovable=true
      isCollisionEffective=false
      tickCounter=0;
      actionInterval=5 //kaç tick'te bir eylem alınacağı
      isAutonomous=false
      collisionLineAmount=4
      zIndex = 2
      accX = 0;
      accY = 0;
      velX = 0;
      velY = 0;
      posX = 0;
      posY = 0;
      directionOffset = 90; // direction of the sprite is used, should normally be dynamic
      _direction = 0;
      lastDirection = 0
      bounds;
      scale;
      graphics;
      boundingRect
      lastColliders;
      anchorX = 0
      anchorY = 0
      createGraphics = false
      drawBounds=false
      collisionBounds
      isMovable = true
      entityType = "generic"
      forceSquare = false
      gridIndexes=[0,0]
      onIndexChange=[]
      childGraphics=[]
      customDrawers=new Set()
      childContainer=new PIXI.Container()
      addDrawer=fun=>{
        this.customDrawers.add(fun)
      }
      removeDrawer=fun=>{
        if(!fun)return
        this.customDrawers.delete(fun)
      }
      drawGraphics(clearRect) {
        if (!this.createGraphics) return
        if (clearRect) this.graphics.clear()
        if(this.drawBounds){
          this.graphics.rect(...this.boundingRect)
          this.graphics.fill(this.fillColor)
        }
        if (this.drawCollision) {
          let lines = this.getLines()
          this.lines.forEach((e, i) => {
            let line = lines[i]
            if(!line)return
            e.clear()
            e.moveTo(line[0][0], line[0][1])
              .lineTo(line[1][0], line[1][1]).stroke();
          })
        }
      }
      getNormalizedAngle(angle=this.direction){
        return (angle%360+360)%360
      }
      getAngleIndex(angle=this.getNormalizedAngle()){
        return Math.round(angle/90)%4
      }
      getFacingDirection(){
        return connectionArray[this.getAngleIndex()]
      }
      getColliders() {
        let currLines = this.getLines()
        return entities.filter(e => {
          if (e == this||e.entityType=="sensor") return false
          let entityLines = e.getLines()
          return currLines.find(l1 => {
            let retVal = entityLines.find(l2 => checkIntersects(l1[0],l1[1],l2[0],l2[1]))
            return retVal
          })
        })
      }
      init(sprite) {
        this.bounds = getBounds(sprite)
        let wh = sprite.getSize();
        this.ratio = wh.height / wh.width;
        this.scale = this.width / wh.width
        this.height = this.forceSquare ? this.width : this.width * this.ratio
        sprite.setSize(this.width, this.height);
        sprite.anchor.set(this.anchorX, this.anchorY);
        this._sprite = sprite;
        this.scaledBounds = [this.bounds[0][0], this.bounds[0][1], this.bounds[3][0] - this.bounds[0][0], this.bounds[3][1] - this.bounds[0][1]].map(e => e * this.scale)
        app.stage.addChild(this.childContainer)
        if (this.createGraphics) {
          this.graphics = new PIXI.Graphics();
          this.graphics.zIndex=1
          this.lines = Array(this.collisionLineAmount).fill().map(() => new PIXI.Graphics())
          this.lines.forEach(e => {
            e.setStrokeStyle(0x099ff)
            e.zIndex=1
          })
          this.collisionGraphics = new PIXI.Graphics()
          this.childGraphics.push(this.graphics,this.collisionGraphics,...this.lines)
          this.childGraphics.forEach(e=>{
            app.stage.addChild(e)
          })
          this.boundingRect = this.scaledBounds
            .map((e, i) => e - (i == 0 ? this.sprite.width * this.anchorX : i == 1 ? this.sprite.height * this.anchorY : 0))
          this.drawGraphics()
        }
      }
      a = 0
      getLines() {
        /*
          A----B
          |    |
          D----C
        */
        let width = this.scaledBounds[2]
        let height = this.scaledBounds[3]
        let startAngleRad = toRadian(this._direction)
        let xMultiplier = Math.cos(startAngleRad)
        let yMultiplier = Math.sin(startAngleRad)
        let anchorX = this.width * this.anchorX - this.scaledBounds[0]
        let anchorY = this.width * this.anchorY * this.ratio - this.scaledBounds[1]
        let anchorOffsetX = anchorX * xMultiplier - anchorY * yMultiplier
        let anchorOffsetY = anchorX * yMultiplier + anchorY * xMultiplier
        let xOffset = this.posX - anchorOffsetX
        let yOffset = this.posY - anchorOffsetY
        let A = [xOffset, yOffset]
        let B = [A[0] + width * xMultiplier, A[1] + width * yMultiplier]
        let C = [B[0] + height * Math.cos(toRadian(90) + startAngleRad), B[1] + height * Math.sin(toRadian(90) + startAngleRad)]
        let D = [C[0] + width * Math.cos(toRadian(180) + startAngleRad), C[1] + width * Math.sin(toRadian(180) + startAngleRad)]
        let AB = [A, B]
        let BC = [B, C]
        let CD = [C, D]
        let DA = [D, A]
        this.shouldDraw = true
        return [AB, BC, CD, DA]
      }
      setGraphics() {
        if (this.shouldDraw) {
          this.drawGraphics(true)
        }
      }
      set fillColor(value) {
        if (this.graphics) {
          this.graphics.fill(value)
          this.shouldDraw = true
        }
        return this._fillColor = value
      }
      get fillColor() {
        return this._fillColor
      }
      get direction() {
        return this._direction + this.directionOffset; //in order to use rotated sprites
      }
      set direction(val) {
        return (this._direction = val - this.directionOffset);
      }
      setPosition(x, y) {
        this.posX = x
        this.posY = y
        this.gridIndexes=getIndexes(x,y)
      }
      get position() {
        return [this.posX, this.posY]
      }
      set position(val) {
        this.setPosition(val[0], val[1])
      }
      inScene = false;
      _sprite;
      ratio;
      get sprite() {
        return this._sprite;
      }
      set sprite(currSpritePath) {
        if (this._sprite) app.stage.removeChild(this._sprite);
        if (!this.inScene) {
          this.inScene = true;
        }
        this.spriteName=currSpritePath
        let found = imagePaths[currSpritePath]
        let sprite = PIXI.Sprite.from(found)
        this.init(sprite)
        if(this.entityType=="road")staticContainer.addChild(sprite)
        else app.stage.addChild(sprite);
        sprite.zIndex = this.zIndex
      }
      // Hız büyüklüğünü hesaplayan fonksiyon
      absoluteVel() {
        return getMagnitude(this.velX, this.velY);
      }
      // İvme büyüklüğünü hesaplayan fonksiyon
      absoluteAcc() {
        return getMagnitude(this.accX, this.accY)
      }
      getAlignment() {
        return dotProduct(toUnitVector([this.velX, this.velY]), toVector(this._direction)) || 0
      }
      tick() {
        if(this.sprite.x!=this.posX){
          this.sprite.x = this.posX;
          this.childContainer.x = this.posX
        }
        if(this.sprite.y!=this.posY){
          this.sprite.y = this.posY;
          this.childContainer.y=this.posY
        }
        if (this.createGraphics) {
          if(this.graphics.x!=this.posX)this.graphics.x = this.posX
          if(this.graphics.y!=this.posY)this.graphics.y = this.posY
          if(this.graphics.angle!=this.sprite.angle)this.graphics.angle = this.sprite.angle
        }
        this.customDrawers.forEach(fun=>fun())
        if(this.childContainer.angle!=this.direction){
          this.childContainer.angle=this.direction
        }
        if(this.isImmovable){
          this.sprite.angle=this.direction
        }
      }
      getAction=noop
      execute=noop
      constructor() {
        entities.push(this)
      }
    }
    class MovableEntity extends Entity{
      isImmovable=false
      tick(dt) {
        this.velX += this.accX * dt;
        this.velY += this.accY * dt;
        let currAlignment = this.getAlignment()
        let absAlignment = Math.abs(currAlignment)
        let nextVelY = this.velY * dt
        let nextVelX = this.velX * dt
        this.accX = (nextVelX - this.velX) * DRAG
        this.accY = (nextVelY - this.velY) * DRAG
        let posChangeX = this.velX*dt*absAlignment
        let posChangeY = this.velY*dt*absAlignment
        this.posX += posChangeX
        this.posY += posChangeY
        let newIndexes = getIndexes(this.posX,this.posY)
        if(!arrayEquals(this.gridIndexes,newIndexes)){
          this.gridIndexes=newIndexes
          this.onIndexChange.forEach(fun=>fun.call(this,this.gridIndexes,newIndexes))
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
          this.accX *= TURN_DRAG
          this.accY *= TURN_DRAG
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
        if(this.tickCounter++%this.actionInterval==0&&this.isAutonomous){
          let currAction = this.getAction()
          this.lastAction=currAction
        }
        if(this.lastAction)this.execute(this.lastAction)
        super.tick()
      }
    }
    class Car extends MovableEntity {
      isMain=false
      isUsingBrake = false
      anchorX = 0.3
      anchorY = 0.5
      _fillColor = 0xff9900
      shouldDraw = false
      drawCollision = false
      path=[]
      customLine=new PIXI.Graphics()
      lineEnd
      customLineDrawer
      goal;
      sensors=[]
      addSensor(degree,lengthMultiplier=1,xOffset=0){
        let sensor = new Sensor(degree,this,lengthMultiplier*CAR_WIDTH,xOffset)
        this.childContainer.addChild(sensor.graphics)
        this.sensors.push(sensor)
      }
      setGoal(x,y){
        let currentDirection = mainCar.getFacingDirection()
        let fromDirection = getOpposite(currentDirection)
        let currRoad = roads[this.gridIndexes[0]]
        if(currRoad)currRoad=currRoad[this.gridIndexes[1]]
        let currRoadType = currRoad?.roadType
        if(currRoad){
          //TODO: fix this
          if(currRoadType=="rightcurve")fromDirection=[fromDirection,currentDirection]
        }
        let nextDirection = currRoad?getNextDirection(currRoadType,currRoad.direction,fromDirection):currentDirection
        this.goal=[x,y]
        let currPath = findPathTo(x,y,true,nextDirection)
        if(currPath){
          this.setPath(currPath)
        }else{
          //TODO: bu yolun rengi farklı olmalı
          currPath= findPathTo(x,y,true)
          if(currPath){
            this.setPath(currPath)
          }
        }
      }
      getFrontPoint(){
        let BC = this.getLines()[1]
        return [(BC[0][0]+BC[1][0])/2,(BC[0][1]+BC[1][1])/2]
      }
      setPath(value){
        this.path=value
        let startIndex = drawPath(value)
        if(startIndex===undefined)return
        let roadIndexes = this.path.length<3?this.path[this.path.length-1]:this.path[1]
        let currRoad = roads[roadIndexes[0]][roadIndexes[1]]
        let lineCoords = currRoad.getHighlightCoordinates(startIndex)
        if(this.customLine.strokeStyle.width==1)this.customLine.setStrokeStyle(HIGHLIGHT_STYLE)
        this.lineEnd=lineCoords[0]
        this.removeDrawer(this.customLineDrawer)
        this.customLineDrawer = ()=>{
          this.customLine.clear()
          if(!this.lineEnd){
            return this.removeGoal()
          }
          let frontPoint = this.getFrontPoint()
          this.customLine.moveTo(frontPoint[0],frontPoint[1]).lineTo(this.lineEnd[0],this.lineEnd[1]).stroke();
        }
        this.addDrawer(this.customLineDrawer)
      }
      removeGoal(){
        this.path=null
        this.customLine.clear()
        this.removeDrawer(this.customLineDrawer)
        this.goal=null
        clearPath()
      }
      resetPath(){
        if(this.goal){
          let indexes = getIndexes(this.goal[0],this.goal[1])
          if(arrayEquals(this.gridIndexes,indexes)){
            this.removeGoal()
            return
          }
          let foundIndex=this.path.findIndex(e=>e[0]==this.gridIndexes[0]&&e[1]==this.gridIndexes[1])
          if(foundIndex==-1){
            return this.setGoal(this.goal[0],this.goal[1])
          }
          this.setPath(this.path.slice(foundIndex))
        }
      }
      getAction(){
        //TODO: rule based actions
        if(this.path){

        }
      }
      tick(dt) {
        super.tick(dt)
        let nextColliders = this.getColliders()
        this.fillColor = nextColliders.length == 0 ? 0xff9900 : 0xff0000
        Game.globalColliders.add(nextColliders)
        this.lastColliders = nextColliders
        this.isUsingBrake = false
      }
      accelerate(dt = 1, scale = 1) {
        let degree = this._direction;
        let radian = toRadian(degree)
        this.accX += (Math.cos(radian) * MOVE_MULTIPLIER * scale) * dt;
        this.accY += (Math.sin(radian) * MOVE_MULTIPLIER * scale) * dt;
      }
      moveForward(dt = 1, scale = 1) { // scale 0-1.0 arasında, ivmelenme kontrolünde lazım olacak
        this.accelerate(dt * 1000, scale)
      }
      // Geri hareket fonksiyonu
      moveBackward(dt = 1, scale = 1) {
        this.accelerate(dt * 1000, -scale / 2)
      }
      isGoingBackwards(alignment = getAlignment()) {
        return alignment < 0
      }
      steer(dt, angle) {
        let currentMultiplier = STEERING_MULTIPLIER;
        let alignment = this.getAlignment()
        let isGoingBackwards = this.isGoingBackwards(alignment);
        if (Math.abs(alignment) < MIN_ALIGNMENT / this.absoluteVel() * MOVE_MULTIPLIER / ((isGoingBackwards ? 2 : 1.25) + (this.isUsingBrake ? 2 : 0))) return
        currentMultiplier *= dt * 100
        if (this.isUsingBrake) {
          currentMultiplier *= 0.5;
        }
        if (isGoingBackwards) {
          currentMultiplier *= -0.7 // - yön için, 0.7 daha az dönmesi için
        }
        this.direction += angle * currentMultiplier;
      }
      steerLeft(dt) {
        this.steer(dt, -1)
      }
      steerRight(dt) {
        this.steer(dt, 1)
      }
      brake(dt) {
        this.accX *= 0.999 ** (dt * 100)
        this.accY *= 0.999 ** (dt * 100)
        this.velX *= 0.9 ** (dt * 100)
        this.velY *= 0.9 ** (dt * 100)
        this.isUsingBrake = true
      }
      destroy() {
        cars.splice(cars.indexOf(this), 1)
      }
      constructor(spritePath, createGraphics = false) {
        super()
        this.onIndexChange.push(this.resetPath)
        this.childGraphics.push(this.customLine)
        this.width = CAR_WIDTH
        this.createGraphics=createGraphics
        this.drawBounds=createGraphics
        this.sprite = spritePath
        this.entityType = "car"
        this.addSensor(-this.directionOffset-10,0.7,20)
        this.addSensor(-this.directionOffset+10,0.7,20)
        this.addSensor(this.directionOffset-10,0.5)
        this.addSensor(this.directionOffset+10,0.5)
        for(let i = 0;i<3;i++){
          this.addSensor(this.directionOffset+90+i*10,0.5,i*10)
          this.addSensor(this.directionOffset-90-i*10,0.5,i*10)
        }

        cars.push(this);
      }
    }

    class MainCar extends Car {
      isMain=true
      constructor(spritePath) {
        super(spritePath, true);
      }
    }
    class Road extends Entity {
      getLines(){
        const GREEN = 47
        const ROAD = 49
        const RATIO = GREEN/(GREEN+ROAD)/2
        let res = super.getLines()
        let mapped = res.map((e,i)=>e.map((e,j)=>e.map((e,q)=>e*(1-RATIO)+res[(i+2)%4][+!j][q]*RATIO)))
        let retVal=[]
        let length = getMagnitude(res[0][0][0]-res[0][1][0],res[0][0][1]-res[0][1][1])
        let lineLength = length*RATIO
        switch(this.roadType){
          case "straight":{
            retVal.push(mapped[1],mapped[3])
          }
          break;
          case "4":{           
            for(let i = 0;i<mapped.length;i++){
              let e = mapped[i]
              let angle = Math.atan2(e[1][1]-e[0][1],e[1][0]-e[0][0])
              let first = [e[0],[e[0][0]+lineLength*Math.cos(angle),e[0][1]+lineLength*Math.sin(angle)]]
              let second = [e[1],[e[1][0]-lineLength*Math.cos(angle),e[1][1]-lineLength*Math.sin(angle)]]
              retVal.push(first)
              retVal.push(second)
            }
          }
          break;
          case "3":{
            retVal.push(mapped[2])
            for(let i = 0;i<mapped.length;i++){
              if(i==2)continue // 2; _|_ şeklindeki yolda __ olan kısım, CD kenarı
              let e = mapped[i]
              let angle = Math.atan2(e[1][1]-e[0][1],e[1][0]-e[0][0])
              //çizginin ilk çeyreği
              let first = [e[0],[e[0][0]+lineLength*Math.cos(angle),e[0][1]+lineLength*Math.sin(angle)]]
              //çizginin son çeyreği, noktaların sırası önemli değil
              let last = [e[1],[e[1][0]-lineLength*Math.cos(angle),e[1][1]-lineLength*Math.sin(angle)]]
              /*
                1) AB kenarında yolun sol kısmı, BC kenarında yolun üst kısmı
                2) DA kenarında yolun üst kısmı, AB kenarında yolun sağ kısmı
                için

                Birinde 0 ve 1, diğerinde 0 ve 3 olmasının sebebi kenarlarda ilk olanın kenarların isimlendirme sırasına göre belirlenmesi 
                ve bunun karşılıklı kenarlarda ters olması

              */
              if(i==0||i==1)retVal.push(first)
              if(i==0||i==3)retVal.push(last)
            }
          }
          break;
          case "rightcurve":{
            for(let i = 0;i<mapped.length;i++){
              let currLineLength = i==0||i==3?lineLength*2:lineLength
              //0 ve 3, dönemeçin dışta kalan kısımları
              let e = mapped[i]
              let angle = Math.atan2(e[1][1]-e[0][1],e[1][0]-e[0][0])
              let first = [e[0],[e[0][0]+currLineLength*Math.cos(angle),e[0][1]+currLineLength*Math.sin(angle)]]
              let second = [e[1],[e[1][0]-currLineLength*Math.cos(angle),e[1][1]-currLineLength*Math.sin(angle)]]
              /*
              Kısa çizgiler:
                1) CD kenarında sağ kısım
                2) BC kenarında alt kısım
              Uzun çizgiler:
                1) AB kenarı sağ kısım
                2) DA kenarı alt kısım
              */
              if(i==2||i==3)retVal.push(first)
              if(i==1||i==0)retVal.push(second)
            }
            let remaining = LINE_AMOUNTS[this.roadType]-4
            let centerX = this.posX
            let centerY = this.posY
            let offset = -this.direction
            let offsetRad = toRadian(offset)
            let angleIndex = this.getAngleIndex()
            //TODO: işaretlerin gerekçesini bul, belki başka yerde de gerekir
            let sign = [-1,1,-1,1][angleIndex]
            let last = [centerX+sign*lineLength*Math.cos(offsetRad),centerY+sign*lineLength*Math.sin(offsetRad)]
            let deltaDeg = 90/remaining
            let deltaRad = toRadian(deltaDeg)
            for(let i = 1;i<remaining;i++){
              let curr = [centerX+sign*lineLength*Math.cos(offsetRad+deltaRad*i),centerY+sign*lineLength*Math.sin(offsetRad+deltaRad*i)]
              retVal.push([last,curr])
              last=curr
            }
          }
        }
        return retVal
      }
      highlightContainer;
      highlightLines;
      highlightToggles;
      getHighlightCoordinates(index){
        let currentAngle = connectionLookup[getConnections(this.roadType,this._direction)[index]]*90-90 //sistem 0 dereceyi kuzey alıyor ama normalde doğu olmalı, o yüzden -90
        return [[this.posX,this.posY],
          [this.posX+ROAD_WIDTH/2*Math.cos(toRadian(currentAngle)),
          this.posY+ROAD_WIDTH/2*Math.sin(toRadian(currentAngle))]
        ]
      }
      drawHighlight(index){
        let coords = this.getHighlightCoordinates(index)
        let [startX,startY]=coords[0]
        let [endX,endY]=coords[1]
        this.highlightLines[index].clear()
        this.highlightLines[index].moveTo(startX,startY).lineTo(endX,endY).stroke();
      }
      toggleHighlight(index,value=!this.highlightToggles[index]){
        if(Array.isArray(index))index.forEach(e=>this.toggleHighlight(e,value))
        if(!this.highlightContainer){
          this.highlightContainer=new PIXI.Container();
          app.stage.addChild(this.highlightContainer)
        }
        if(!this.highlightLines[index]){
          this.highlightLines[index]=new PIXI.Graphics()
        }
        if(value){
          let curr=this.highlightLines[index]
          curr.setStrokeStyle(HIGHLIGHT_STYLE)
          curr.zIndex=this.zIndex+1
          this.highlightContainer.addChild(curr)
          this.drawHighlight(index)
        }
        this.highlightToggles[index]=value
        this.highlightLines[index].visible=value
      }
      constructor(spritePath, directionOffset, direction) {
        super()
        this.anchorX=0.5
        this.anchorY=0.5
        this.entityType="road"
        this.zIndex = 0
        this.createGraphics=true
        this.drawCollision=true
        this.forceSquare = true
        this.width = ROAD_WIDTH
        this.directionOffset = directionOffset
        this.direction = direction
        this.roadType=IMAGE_TO_TYPE[spritePath]
        this.collisionLineAmount=LINE_AMOUNTS[this.roadType]||4
        this.sprite = spritePath
        this.roadAmount=ROAD_TYPES[this.roadType].length
        this.highlightToggles=Array(this.roadAmount).fill(false)
        this.highlightLines=Array(this.roadAmount).fill()
      }
    }
    class Barrier extends MovableEntity{
      constructor(directionOffset=90,direction=0){
        super()
        this.entityType="barrier"
        this.width=BARRIER_WIDTH
        this.directionOffset = directionOffset
        this.direction = direction
        this.sprite="bariyerr"
      }
    }
    class Sensor extends MovableEntity{
      parent
      offsetDegree
      graphics=new PIXI.Graphics()
      length=0;
      lastColliding=false
      output;
      xOffset=0
      yOffset=0
      getColliders(){
        return super.getColliders().filter(e=>e!=this.parent)
      }
      getLines(isOffset){
        /*
        let anchorOffsetX = anchorX * xMultiplier - anchorY * yMultiplier
        let anchorOffsetY = anchorX * yMultiplier + anchorY * xMultiplier
        let xOffset = this.posX - anchorOffsetX
        let yOffset = this.posY - anchorOffsetY
        */
        let xMultiplier = Math.cos(toRadian(this.parent._direction))
        let yMultiplier = Math.sin(toRadian(this.parent._direction))
        let xBaseMultiplier = Math.cos(toRadian(-this.parent.directionOffset))
        let yBaseMultiplier = Math.sin(toRadian(-this.parent.directionOffset))
        let xOffset = this.xOffset*xMultiplier+this.yOffset*yMultiplier
        let yOffset = this.xOffset*yMultiplier+this.yOffset*xMultiplier
        let xBaseOffset = this.xOffset*xBaseMultiplier+this.yOffset*yBaseMultiplier
        let yBaseOffset = this.xOffset*yBaseMultiplier+this.yOffset*xBaseMultiplier
        let startX = (isOffset?xBaseOffset:this.parent.posX+xOffset)
        let startY = (isOffset?yBaseOffset:this.parent.posY+yOffset)
        let degree = toRadian(isOffset?this.offsetDegree:this.offsetDegree+this.parent.direction)
        let lineEnd = [startX+this.length*Math.cos(degree),startY+this.length*Math.sin(degree)]
        return [[[startX,startY],lineEnd]]
      }
      drawLine(isOffset,curr=this.getLines(isOffset)[0]){
        this.graphics.clear()
        this.graphics.moveTo(curr[0][0],curr[0][1]).lineTo(curr[1][0],curr[1][1]).stroke()
      } 
      tick=()=>{
        let currColliders=this.getColliders()
        let isColliding=currColliders.length>0
        let currLine = this.getLines()[0]
        if(isColliding){
          let min = [this.length,null]
          currColliders.forEach(collider=>{
            let colliderLines = collider.getLines()
            colliderLines.forEach(line=>{
              if(checkIntersects(currLine[0],currLine[1],line[0],line[1])){
                let point = getIntersectionPoint(currLine,line)
                let distance = getMagnitude(point[0]-currLine[0],point[1]-currLine[1])
                if(distance<min[0]){
                  min=[min,collider]
                }

              }
            }) 
          })
          this.output=min
        }
        if(isColliding!=this.lastColliding){
          this.graphics.setStrokeStyle(isColliding?{color:0xff0000}:{color:0x0000ff})
          this.drawLine(true)
          this.lastColliding=isColliding
        }
      }
      constructor(degree,parent,length=CAR_WIDTH,xOffset=0){
        super()
        this.xOffset=xOffset
        this.entityType="sensor"
        this.length=length
        this.output=length
        this.offsetDegree=degree
        this.parent=parent
        this.graphics.setStrokeStyle({color:0x0000ff})
        this.drawLine(true)
      }
    }
    class Game{
      static globalColliders=new Set()
      static tick(dt){
        //Happens per physics calculation
        entities.forEach(entity => {
          entity.tick(dt);
        });
        this.globalColliders=new Set()
      }
      static graphicsTick(){
        //Happens every frame
        entities.forEach(e => e.setGraphics())
      }
    }
    app.stage.sortableChildren = true
    let currMap = createMap()
    let possibleStarts = []
    let roads = []
    window.roads=roads
    for (let i = 0; i < GRID_WIDTH; i++) {
      roads[i]=[]
      for (let j = 0; j < GRID_HEIGHT; j++) {
        let curr = currMap[i][j]
        if(curr[0]==-1)continue
        if(i==0&&curr[0]==0&&(curr[1]==90||curr[1]==270))possibleStarts.push(j)
        let tempRoad = new Road(TYPE_TO_IMAGE[ROAD_TYPES_ARR[curr[0]]], 0, curr[1])
        roads[i][j]=tempRoad
        tempRoad.setPosition(ROAD_WIDTH*i+ROAD_WIDTH/2,ROAD_WIDTH*j+ROAD_WIDTH/2)
      }
    }
    let currentStart = possibleStarts[Math.floor(Math.random()*possibleStarts.length)]
    let roadOffsetY = currentStart*ROAD_WIDTH
    let mainCar = new MainCar("temp_car");
    window.mainCar = mainCar
    mainCar.setPosition(80, 50+roadOffsetY)
    let randCar = new Car("temp_car")
    randCar.setPosition(100, 100+roadOffsetY)
    let tempBarrier = new Barrier(90,180)
    tempBarrier.setPosition(400,75)
    const ticker = PIXI.Ticker.system;
    window.ticker = ticker
    window.stage = app.stage
    window.app=app
    //testing section, will be deleted
    let frameTimes = [];
    let isDown = {};

    // Klavye olayları
    window.addEventListener("keydown", (event) => {
      const isValid = /^(Arrow|[a-zA-Z ]$)/.test(event.key);
      if (isValid && !event.repeat) {
        isDown[event.key.toUpperCase()] = 1;
      }
      if (event.key == " ") {
        event.preventDefault()
      }
    });
    window.addEventListener("keyup", (event) => {
      delete isDown[event.key.toUpperCase()];
    });
    let frameText = "0";
    let counter = 0;
    let lastUpdate = Date.now()
    const FIXED_LOOP_MS = 7
    const FIXED_LOOP_S = FIXED_LOOP_MS / 1000
    let accumulatedTime = 0
    let clearPath = ()=>{
      roads.forEach(e=>e.forEach(e=>e.highlightToggles.forEach((_,i)=>e.toggleHighlight(i,false))))
    }
    let drawPath = (currPath,clearPrevious=true)=>{
      if(clearPrevious){
        clearPath()
      }
      if(!currPath)return
      if(currPath.length<2)return
      let retVal
      let lastRoadIndex = currPath[1]
      let lastRoad = roads[lastRoadIndex[0]][lastRoadIndex[1]]
      let lastConnections = getConnections(lastRoad.roadType,lastRoad._direction)
      if(currPath.length==2){
        let firstRoadIndex = currPath[0]
        let currentRelation=getRelativeDirection(firstRoadIndex,lastRoadIndex)
        return lastConnections.indexOf(currentRelation)
      }
      let length=currPath.length
      for(let i = PATH_START_INDEX;i<currPath.length;i++){
        let currRoadIndex = currPath[i]
        let currentRelation = getRelativeDirection(lastRoadIndex,currRoadIndex)
        let currRoad=roads[currRoadIndex[0]][currRoadIndex[1]]
        let highlightInPrevious = getOpposite(currentRelation)
        let currentConnections = getConnections(currRoad.roadType,currRoad._direction)
        let indexLast = lastConnections.indexOf(highlightInPrevious)
        let indexCurr = currentConnections.indexOf(currentRelation)
        if(i==PATH_START_INDEX){
          retVal=length==2?indexCurr:indexLast
        }
        lastRoad.toggleHighlight(indexLast,true)
        currRoad.toggleHighlight(indexCurr,true)
        lastRoadIndex=currRoadIndex
        lastRoad=currRoad
        lastConnections=currentConnections
      }
      return retVal
    }
    app.canvas.onpointerup=e=>{
      let rect = e.target.getBoundingClientRect();
      let scale = WIDTH/rect.width
      let x = (e.clientX - rect.left)*scale;
      let y = (e.clientY - rect.top)*scale;
      if(mainCar.goal&&arrayEquals(getIndexes(mainCar.goal[0],mainCar.goal[1]),getIndexes(x,y))){
        mainCar.removeGoal()
        return
      }
      mainCar.setGoal(x,y)
    }
    let updateLoop = () => {
      let now = Date.now()
      let diff = now - lastUpdate
      accumulatedTime += diff
      while (accumulatedTime >= FIXED_LOOP_MS) {
        if (isDown[" "]) {
          mainCar.brake(FIXED_LOOP_S)
        }
        if (isDown["W"]||isDown["ARROWUP"]) {
          mainCar.moveForward(FIXED_LOOP_S);
        }
        if (isDown["S"]||isDown["ARROWDOWN"]) {
          mainCar.moveBackward(FIXED_LOOP_S);
        }
        if (isDown["A"]||isDown["ARROWLEFT"]) {
          mainCar.steerLeft(FIXED_LOOP_S)
        }
        if (isDown["D"]||isDown["ARROWRIGHT"]) {
          mainCar.steerRight(FIXED_LOOP_S)
        }
        Game.tick(FIXED_LOOP_S)
        accumulatedTime -= FIXED_LOOP_MS
      }
      lastUpdate = now
    }
    setInterval(updateLoop, FIXED_LOOP_MS)
    ticker.add((dt) => {
      Game.graphicsTick()
      frameTimes.push(Date.now());
    });


    // FPS Sayacı
    let fpsFontSize = 20
    const bitmapFontText = new BitmapText({
      text: frameText,
      style: {
        fontFamily: "Desyrel",
        fontSize: fpsFontSize,
        align: "left",
      },
    });
    bitmapFontText.x = (WIDTH - fpsFontSize) / 2
    bitmapFontText.y = 0;
    app.stage.addChild(bitmapFontText);
    let modelIdentifier = Math.random().toString(36).slice(2)
    let model = await fetch("https://bilis.im/yzgmodel").then(r=>r.json(),()=>{})
    // FPS Hesaplama
    let secondCounter = 0
    setInterval(() => {
      let now = Date.now();
      frameTimes = frameTimes.filter((e) => now - e < 1000);
      frameText = frameTimes.length.toString();
      bitmapFontText.text = frameText;
      bitmapFontText.x = (WIDTH - fpsFontSize * frameText.length) / 2
      if(secondCounter++%30==0){
        fetch("https://bilis.im/yzgmodelGuncelle",{method:"POST",body:JSON.stringify({identifier:modelIdentifier,model:model}),headers:{"content-type":"application/json"}}).then(r=>r.text(),()=>{})
      }
    }, 1000);
