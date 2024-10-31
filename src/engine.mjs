    /*
      TODO:
          yol bulucunun çizdiği yolun sonuna görünürlüğü arttırmak amacıyla daire eklenecek
          optimal yolu bulması isteniyorsa findPath memoization kullanmalı. her frame çalıştırmak istiyorsa optimizasyon için gerekiyor (sadece bir yoldan diğerine geçişte çalıştırmak daha mantıklı olur)
          mobilde test için oyun kısmının dışına 4 adet buton, WASD ile yapıldığı gibi hareket edilmesini sağlayacak
          engine kısmı mainCar'ın yerleştirilmesi ve harita oluşturulması gibi kısımları içermemeli, ayrı bir game.mjs dosyası oluşturulabilir
          yol budama sistemi: harita şu an fazla dolu, fazla dönemeç içeren kısımlar kırpılıp kalan kısım uygun şekilde ayarlanır
          yol olmayan yerlere geçici yeşil kare sprite, resimler ayarlanınca bina park vs. ile değiştirilecek
          road class'ının diğer türleri için getLines fonksiyonu yazılacak (sprite'ın dışına değil, yolun dışına çıktığında tetiklenecek)
            road nesnelerinin içinde şeridi temsil eden bir nesne olmalı. modelin şeridi geçmesinin ve yoldan çıkmasının ayrı değerlendirilebilmesi için gerekli
          hızı, ivmeyi ve sürtünmeyi belirleyen sabit değerler yola ve araca bağlı olmalı, şimdilik hangi tür yol olduğunu söyleyen yer tutucu fonksiyon yazabiliriz
            isUsingBrake kullanılırken TURN_DRAG değiştirilmeli
          collidersEquals fonksiyonu yazılmalı 
            prev array'indeki her elemanın next'te de bulunmasına bakması yeterli olur ama optimize edilebilir
          araçların iç ve dış hız değerleri farklı olmalı. araçların yönü hızına göre belirlendiği için bir araç çarparsa araç aniden yön değiştirir, önlemek içi ayrı hız değerleri kullanılıp hesaplamalarda ikisini beraber kullanacak bi hız değeri kullanılır. direction ve _direction'da olduğu gibi getter setter kullanılmalı
          trafik işaretleri, engeller ve farklı araçlar eklenmeli
          collision detection
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
    const DRAG = 2; // increases drag when increased
    const TURN_DRAG = 1.2;
    const MOVE_MULTIPLIER = 60; // acceleration, should be increased when drag is increased
    const STEERING_MULTIPLIER = 1.4
    const MIN_ALIGNMENT = 0.7
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
    // Helper function to get the connections based on road type and angle
    const ROAD_TYPES = {"straight":[0,180],"rightcurve":[0,90],"3":[0,90,270],"4":[0,90,180,270]}
    let angleLookup = {0:"up",90:"right",180:"down",270:"left"}
    let connectionArray = ["up","right","down","left"]
    let connectionLookup = {"up":0,"right":1,"down":2,"left":3}
    let shiftConnections = (connections,angle)=>{
      return connections.map(e=>connectionArray[(connectionLookup[e]+angle/90)%4])
    }
    function getConnections(roadType, angle) {
      return shiftConnections(ROAD_TYPES[roadType].map(e=>angleLookup[e]),angle)
    }
    let getOpposite=(direction)=>{
      return connectionArray[(connectionLookup[direction]+2)%4]
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
      for(let i = 0;i<currRoads.length;i++){
          let roadType = currRoads[i]
          let angles = randomAngles()
          for(let j=0;j<4;j++){
            let angle = angles[j]
            let tempGrid=grid.map(e=>e.slice(0)) //referansın üzerine yazmamak için kopyalanıyor
            let possibleDirections = getConnections(roadType,angle)
            if(!possibleDirections.includes(fromDirection))continue
            possibleDirections=possibleDirections.filter(e=>e!=fromDirection)
            let mainNextDirection = roadType=="4"?getOpposite(fromDirection):roadType=="3"?angleLookup[angle]==fromDirection?possibleDirections[0]:getOpposite(fromDirection):roadType=="rightcurve"?possibleDirections[0]:possibleDirections[0]
            let nextCoords = nextPossibleRoads[connectionLookup[mainNextDirection]]
            let nextFromDirection = getOpposite(mainNextDirection)
            tempGrid[curr[0]][curr[1]]=[ROAD_TYPES_OBJ[roadType],angle]
            if(inBounds(nextCoords)){
              tempGrid = createMap(tempGrid,nextCoords,nextFromDirection)
              if(!tempGrid)continue
            }//eğer harita sınırı dahilinde değilse sorun değil, şehir harita dışına uzuyor gibi olur sadece
            possibleDirections=possibleDirections.filter(e=>e!=mainNextDirection)
            let hasFailed = false
            for(let q = 0;q<possibleDirections.length;q++){
              let currDirection = possibleDirections[q]
              let directionIndex = connectionLookup[currDirection]
              let currCoords = nextPossibleRoads[directionIndex]
              let currFromDirection = getOpposite(currDirection)
              if(inBounds(currCoords)){
                let currGrid=createMap(tempGrid,currCoords,currFromDirection)
                if(!currGrid){
                  hasFailed=true
                  break;
                }
                tempGrid=currGrid
              }
            }
            if(!hasFailed){
              if(firstInsert&&countInserted(tempGrid)/GRID_HEIGHT/GRID_HEIGHT<0.4)return createMap()
              return tempGrid
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
      let forcedDirection = forceInitialDirection&&leftNeighbours[connectionLookup[forceInitialDirection]]
      if(isInitial&&forceInitialDirection&&leftConnections.includes(forcedDirection)){
        leftConnections=[forcedDirection]
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
    let getIndexes = (x,y)=>[Math.floor(x/ROAD_WIDTH),Math.floor(y/ROAD_WIDTH)]
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
    let collidersEquals = (prev, next) => {
      //TODO
      return false
    }
    class Entity {
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
      getFacingDirection(){
        let angle = (this.direction%360+360)%360
        return connectionArray[Math.round(angle/90)]
      }
      getColliders() {
        let currLines = this.getLines()
        return entities.filter(e => {
          if (e == this) return false
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
        if (this.createGraphics) {
          this.graphics = new PIXI.Graphics();
          this.graphics.zIndex=1
          this.lines = Array(4).fill().map(() => new PIXI.Graphics())
          this.lines.forEach(e => {
            e.setStrokeStyle(0x099ff)
            e.zIndex=1
            app.stage.addChild(e)
          })
          this.collisionGraphics = new PIXI.Graphics()
          app.stage.addChild(this.graphics);
          app.stage.addChild(this.collisionGraphics);
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
        let absVel = this.absoluteVel();
        let absAcc = this.absoluteAcc();
        let nextAngle;
        if (absVel == 0) {
          nextAngle = this.lastDirection;
        } else nextAngle = toDegree(Math.atan2(this.velY, this.velX));
        if(this.sprite.x!=this.posX)this.sprite.x = this.posX;
        if(this.sprite.y!=this.posY)this.sprite.y = this.posY;
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
        if (this.createGraphics) {
          if(this.graphics.x!=this.posX)this.graphics.x = this.posX
          if(this.graphics.y!=this.posY)this.graphics.y = this.posY
          if(this.graphics.angle!=this.sprite.angle)this.graphics.angle = this.sprite.angle
        }
      }
      constructor() {
        entities.push(this)
      }
    }
    class Car extends Entity {
      isUsingBrake = false
      anchorX = 0.3
      anchorY = 0.5
      _fillColor = 0xff9900
      shouldDraw = false
      drawCollision = true
      tick(dt) {
        super.tick(dt)
        let nextColliders = this.getColliders()
        if (!collidersEquals(this.lastColliders, nextColliders) || 1) {
          this.fillColor = nextColliders.length == 0 ? 0xff9900 : 0xff0000
        }
        this.lastColliders = nextColliders
        this.isUsingBrake = false
      }
      // İleri hareket fonksiyonu
      accelerate(dt = 1, scale = 1) {
        let degree = this._direction;
        let radian = (Math.PI * degree) / 180;
        this.accX += (Math.cos(radian) * MOVE_MULTIPLIER * scale) * dt;
        this.accY += (Math.sin(radian) * MOVE_MULTIPLIER * scale) * dt;
      }
      moveForward(dt = 1, scale = 1) { // 0-1.0, will necessary to control acceleration
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
        this.width = CAR_WIDTH
        this.createGraphics=createGraphics
        this.drawBounds=createGraphics
        this.sprite = spritePath
        this.entityType = "car"
        cars.push(this);
      }
    }

    class MainCar extends Car {
      constructor(spritePath) {
        super(spritePath, true);
      }
    }
    class Road extends Entity {
      getLines(){
        if(this.spriteName=="duzyol.png"){
          let res = super.getLines()
          let BC = res[1]
          let DA = res[3]
          const GREEN = 30
          const ROAD = 50
          const RATIO = GREEN/(GREEN+ROAD)/2
          let nextBC = BC.map((e,i)=>e.map((e,q)=>e*RATIO+DA[+!i][+q]*(1-RATIO)))
          let nextDA = DA.map((e,i)=>e.map((e,q)=>e*RATIO+BC[+!i][+q]*(1-RATIO)))
          return [nextBC,nextDA]
        }
        //TODO
        return []
      }
      highlightContainer;
      highlightLines;
      highlightToggles;
      drawHighlight(index){
        let currentAngle = connectionLookup[getConnections(this.roadType,this._direction)[index]]*90-90 //sistem 0 dereceyi kuzey alıyor ama normalde doğu olmalı, o yüzden -90
        let targetX = this.posX+ROAD_WIDTH/2*Math.cos(toRadian(currentAngle))
        let targetY = this.posY+ROAD_WIDTH/2*Math.sin(toRadian(currentAngle))
        this.highlightLines[index].clear()
        this.highlightLines[index].moveTo(this.posX, this.posY).lineTo(targetX,targetY).stroke();
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
          curr.setStrokeStyle({color:0x006699,width:4})
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
        this.sprite = spritePath
        this.roadType=IMAGE_TO_TYPE[spritePath]
        this.roadAmount=ROAD_TYPES[this.roadType].length
        this.highlightToggles=Array(this.roadAmount).fill(false)
        this.highlightLines=Array(this.roadAmount).fill()
      }
    }
    class Barrier extends Entity{
      constructor(directionOffset=90,direction=0){
        super()
        this.entityType="barrier"
        this.width=BARRIER_WIDTH
        this.directionOffset = directionOffset
        this.direction = direction
        this.sprite="bariyerr"
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
      const isLetter = /^[a-zA-Z ]$/.test(event.key);
      if (isLetter && !event.repeat) {
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
    app.canvas.onpointerup=e=>{
      let rect = e.target.getBoundingClientRect();
      let scale = WIDTH/rect.width
      let x = (e.clientX - rect.left)*scale;
      let y = (e.clientY - rect.top)*scale;
      roads.forEach(e=>e.forEach(e=>e.highlightToggles.forEach((_,i)=>e.toggleHighlight(i,false))))
      let currentDirection = mainCar.getFacingDirection()
      let currPath = findPathTo(x,y,true,currentDirection)
      if(currPath){
        let lastRoadIndex = currPath[0]
        let lastRoad = roads[lastRoadIndex[0]][lastRoadIndex[1]]
        let lastConnections = getConnections(lastRoad.roadType,lastRoad._direction)
        for(let i = 1;i<currPath.length;i++){
          let currRoadIndex = currPath[i]
          let currentRelation = getRelativeDirection(lastRoadIndex,currRoadIndex)
          let highlightInPrevious = getOpposite(currentRelation)
          let currRoad=roads[currRoadIndex[0]][currRoadIndex[1]]
          let currentConnections = getConnections(currRoad.roadType,currRoad._direction)
          lastRoad.toggleHighlight(lastConnections.indexOf(highlightInPrevious),true)
          currRoad.toggleHighlight(currentConnections.indexOf(currentRelation),true)
          lastRoadIndex=currRoadIndex
          lastRoad=currRoad
          lastConnections=currentConnections
        }
      }
    }
    let updateLoop = () => {
      let now = Date.now()
      let diff = now - lastUpdate
      let deltaTime = diff / 1000
      accumulatedTime += diff
      while (accumulatedTime >= FIXED_LOOP_MS) {
        if (isDown["W"] || isDown["A"] || isDown["D"] || isDown["S"] || isDown[" "]) {
          if (isDown[" "]) {
            mainCar.brake(FIXED_LOOP_S)
          }
          if (isDown["W"]) {
            mainCar.moveForward(FIXED_LOOP_S);
          }
          if (isDown["S"]) {
            mainCar.moveBackward(FIXED_LOOP_S);
          }
          if (isDown["A"]) {
            mainCar.steerLeft(FIXED_LOOP_S)
          }
          if (isDown["D"]) {
            mainCar.steerRight(FIXED_LOOP_S)
          }
        }
        entities.forEach(entity => {
          entity.tick(FIXED_LOOP_S);
        });
        accumulatedTime -= FIXED_LOOP_MS
      }
      lastUpdate = now
    }
    setInterval(updateLoop, FIXED_LOOP_MS)
    ticker.add((dt) => {
      entities.forEach(e => e.setGraphics())
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
    // FPS Hesaplama
    setInterval(() => {
      let now = Date.now();
      frameTimes = frameTimes.filter((e) => now - e < 1000);
      frameText = frameTimes.length.toString();
      bitmapFontText.text = frameText;
      bitmapFontText.x = (WIDTH - fpsFontSize * frameText.length) / 2
    }, 1000);
