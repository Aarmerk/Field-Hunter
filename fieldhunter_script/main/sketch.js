let canvas;
let myFont;

// Camera Button
var camButton;
let camFreeImgs = [];
let camPlayerImgs = [];
let camPolygonImgs = [];
// Camera modes
const CameraMode = Object.freeze({
  FREE: 1,
  PLAYER: 2,
  POLYGON: 3,
});
let camMode = CameraMode.FREE;
// Prevents the Button from registering touches as double clicks
let camButtonEnabled = true;
let camButtonActivated = false;
let camAlpha = 0;
var cameraInfo = "";

// Score Button
let showScore = false;
let scoreButton;
let scoreImgs = [];

// API key for map provider.
var key = 'pk.eyJ1Ijoic2ltdGluIiwiYSI6ImNraW5mODU2ajA4ZTUyem1sMGQ1MXRsYmYifQ.QiM3UZyf58-ehmisIRHQnw';

// Create a new Mappa instance.
var mappa = new Mappa('MapboxGL', key);
let gpsOn = true;
let myMap;
let lat = -1.0; // wo bin ich
let long = -1.0;

// Map options
const options = {
  lat: lat, // center in bremen
  lng: long,
  zoom: 18,
  minZoom: 1,
  maxZoom: 22,
  style: 'mapbox://styles/simtin/ckl5nkoog2sf317qhmranwvs6',
  pitch: 0,
};

// Position options
var posOptions = {
  enableHighAccuracy: true,
  timeout: 50000, 
  maximumAge: 0
}

// Database
let uid = gen_uid(); // unique brower/user id wird als db key benutze...
var database; // db ref
var players; // liste alle spieler
var score = 0;
let pName = ""; // player name
let ranking = [];

// Saved coordinates
let coords = [];
let hullPoints;
var hullAlpha;
var alphaAmount = 1;
var linesIntersect = false;

// Pulsing Dot
var theta;

// Player
const playerHue = Math.round(Math.random() * 255);
const playerColor = 'hsl(' + playerHue + ', 100%, 55%)';
let playerImage;

function preload() {
  myFont = loadFont('../../fonts/ErasBoldITC.ttf');

  camFreeImgs[0] = loadImage('../../cambutton/Camera1.png');
  camFreeImgs[1] = loadImage('../../cambutton/Camera1_clicked.png');
  camPlayerImgs[0] = loadImage('../../cambutton/Camera2.png');
  camPlayerImgs[1] = loadImage('../../cambutton/Camera2_clicked.png');
  camPolygonImgs[0] = loadImage('../../cambutton/Camera3.png');
  camPolygonImgs[1] = loadImage('../../cambutton/Camera3_clicked.png');

  for (let i = 0; i < 19; i++) {
    scoreImgs[i] = loadImage('../../scorebutton/ranking' + i + '.png');
  }
  if(sessionStorage.getItem('playerName') != null) {
    pName = sessionStorage.getItem('playerName'); // holt pNamen aus dem session storage
  }

  playerImage = loadImage('../../playercharacter/Spray.png');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('display', 'block');
  textFont(myFont, 20);

  playerImage = changeImageHue(playerImage, playerHue);

  hullAlpha = 200;
	theta = 0; 

  var firebaseConfig = {
    apiKey: "AIzaSyDMnC4vT3VmhMeaMzE1o8WR_OoydFLSssQ",
    authDomain: "fieldhunter2-9f40b.firebaseapp.com",
    databaseURL: "https://fieldhunter2-9f40b-default-rtdb.firebaseio.com",
    projectId: "fieldhunter2-9f40b",
    storageBucket: "fieldhunter2-9f40b.appspot.com",
    messagingSenderId: "1090412845541",
    appId: "1:1090412845541:web:5f115b9ed995728cecf70c"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  console.log(firebase);
  console.log('uid:' + uid);
  database = firebase.database();

  if(getItem('latitude') != undefined || getItem('longitude') != undefined) {
    lat = parseFloat(getItem('latitude'));
    long = parseFloat(getItem('longitude'));
    setupMap();
  }

  watchPosition(positionChanged, error, posOptions); // gps callback

  setupGui();

  maintenancePlayerData();
  updatePlayerData();
  getAllPlayerData();
  setInterval(updateData, 2000); // daten mit server abgleichen
}

function draw() {
  clear();
  if(typeof myMap !== 'undefined') {
    drawPolygon();
    drawLine();
    drawPlayer();
  }
  drawGui();
}



// Database functions //////////////////////////////////////////////////////////////////////////////////////

function maintenancePlayerData() {
  var ref = firebase.database().ref('player');
  var now = Date.now();
  var cutoff = now - 20 * 1000; // 20 sekunden.
  var old = ref.orderByChild('timestamp').endAt(cutoff).limitToLast(1);
  var listener = old.on('child_added', function (snapshot) {
    snapshot.ref.remove();
  });
}

function getAllPlayerData() {
  var ref = database.ref("player");
  ref.on("value", gotData, errData);
}

function errData(data) {
  // nop
}

function gotData(data) {
  players = data.val();
}

function updatePlayerData() {
  firebase.database().ref('player/' + uid).set({
    lat: lat,
    long: long,
    name: pName,
    score: score,
    timestamp: Date.now(),
    uid: uid,
    color: playerColor
  });
}

function updateData() {
  updatePlayerData(); // meine daten updaten
  maintenancePlayerData(); // kill all zombies
  getAllPlayerData(); // alle anders player daten holen
  if(lat > -1.0 && long > -1.0) {
    storeItem('latitude', lat.toString()); // meinen player namen im coookie speichern
    storeItem('longitude', long.toString()); // meinen player namen im coookie speichern
  }
  sortRanking();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Setup functions //////////////////////////////////////////////////////////////////////////////////////////////////////

function setupMap() {
  options.lat = lat;
  options.lng = long;
  myMap = mappa.tileMap(options); 
  myMap.overlay(canvas);
}

function setupGui() {
  camButton = new Button(windowWidth - 60, 20, 50, 57, camFreeImgs);
  scoreButton = new Button(10, 20, 53, 53, scoreImgs);
}

function positionChanged(position) {
  if(!gpsOn) {
    gpsOn = true;
  }
  const newCoord = {x: position.latitude, y: position.longitude};
  
  if(coords.length > 0) {
    // Push if unique
    if(measure(coords[coords.length - 1], newCoord) > 1.0) {
      lat = position.latitude;
      long = position.longitude;
      // Push if point doesn't cause intersection
      if(coords.length >= 3 && setLinesIntersect(newCoord)) {
        return;
      }
      coords.push(newCoord);
      if(camMode == CameraMode.PLAYER) {
        flyToPos();
      } else if (camMode == CameraMode.POLYGON) {
        fitToPolygon(coords);
      }
    }
    return;
  }
  
  if(lat != position.latitude || long != position.longitude) {
    lat = position.latitude;
    long = position.longitude;
    if(typeof myMap !== 'undefined') {
      flyToPos();
    } else {
      setupMap();
    }
  }

  coords.push(newCoord);
}

function error() {
  gpsOn = false;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Draw functions /////////////////////////////////////////////////////////////////////////////////////////////////

function drawPolygon(){
  push();
  if(linesIntersect) {
    noStroke();
    hullColor = color(playerColor);
    hullColor.setAlpha(hullAlpha);
    fill(hullColor);
    beginShape();
    for (var i = 0; i < (hullPoints.length); i++) {
      var pos = myMap.latLngToPixel(hullPoints[i].x, hullPoints[i].y);
      vertex(pos.x, pos.y);
    }
    endShape(CLOSE);
    
    hullAlpha -= alphaAmount;
    if (hullAlpha < 1) {
      hullPoints = [];
      linesIntersect = false;
      hullAlpha = 200;
    }
  }
  pop();
}

function drawLine() {
  push();
  for (var i = 0; i < (coords.length - 1); i++) {
    var pos1 = myMap.latLngToPixel(coords[i].x, coords[i].y);
    var pos2 = myMap.latLngToPixel(coords[i + 1].x, coords[i + 1].y);
    stroke(playerColor);
    strokeWeight(myMap.zoom() / 2);
    line(pos1.x, pos1.y, pos2.x, pos2.y);
    if(linesIntersect && i == coords.length - 2) {
      var pos3 = myMap.latLngToPixel(coords[0].x, coords[0].y);
      line(pos2.x, pos2.y, pos3.x, pos3.y);
    }
  }
  pop();
}

function drawPlayer() {
  push();
  var mypos = myMap.latLngToPixel(lat, long);
  size = map(myMap.zoom(), 1, 6, 5, 7);

  if(gpsOn) {
    // Pulsing circle
    var maxDiameter = pow(1.43, size);
    var diam = (((size / 2) * 0.3 * theta) % maxDiameter) + size;
    noStroke();
    var pulseColor = color(playerColor);
    pulseColor.setAlpha(150 - (diam *  (150 / maxDiameter)));
    fill(pulseColor);
    ellipse(mypos.x, mypos.y, diam, diam);
    theta += (maxDiameter / 250);
  }

  if (players != null) {
    var keys = Object.keys(players);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      // If not myself
      if (k != uid) {
        var pos = myMap.latLngToPixel(players[k].lat, players[k].long);
        size = map(myMap.zoom(), 1, 6, 5, 7);
        
        var otherColor = players[k].color != null ? players[k].color : 'rgb(255, 0, 255)';
        // Other
        noStroke();
        fill(otherColor)
        ellipse(pos.x, pos.y, size, size);

        // Other name
        fill(otherColor);
        text(players[k].name, pos.x + 20, pos.y);

        //Player score
        fill(otherColor);
        text(players[k].score, pos.x + 20, pos.y + 18);
      }
    }
  }

  drawingContext.shadowOffsetX = 5;
  drawingContext.shadowOffsetY = 5;
  drawingContext.shadowBlur = 1;
  drawingContext.shadowColor = 'black';
  push();
  angleMode(DEGREES); // Change the mode to DEGREES
  imageMode(CENTER);
  translate(mypos.x, mypos.y);
  rotate(90 - rotationZ + myMap.map.getBearing());
  image(playerImage, 0, 0, size * 1.4, size * 2.8);
  pop();

  //Player name
  noStroke();
  fill(playerColor);
  text(pName, mypos.x + 20, mypos.y);

  //Player score
  stroke(0);
  fill(255, 255, 255);
  text(score, mypos.x + 20, mypos.y + 18);

  pop();
}

function drawGui() {
  push();
  if(camButtonActivated) {
    camAlpha = 255;
    switch(camMode) {
      case CameraMode.POLYGON:
        cameraInfo = "free camera mode";
        break;
      case CameraMode.FREE:
        cameraInfo = "player view";
        break;
      default:
        cameraInfo = "polygon view";
    }
  }
  textSize(15);
  textAlign(CENTER);
  var textColor = color(255, 255, 255);
  camAlpha = camAlpha - 5 < 0 ? 0 : camAlpha - 5;
  textColor.setAlpha(camAlpha);
  fill(textColor);
  text(cameraInfo, windowWidth / 2, windowHeight - 40);

  textAlign(LEFT);
  if (showScore == true) {
    if(scoreButton.getCurImg() < scoreImgs.length - 1) {
      setTimeout(scoreButton.nextImage(), 120);
    }
    scoreButton.display();
    if (players != null && scoreButton.getCurImg() == scoreImgs.length - 1) {
      var highscore = "";
      noStroke();
      textSize(14);

      scoreLenght = ranking.length < 5 ? ranking.length : 5;
      for (var i = 0; i < scoreLenght; i++) {
        highscore = i+1 + "." + ranking[i].name + ": " + ranking[i].score + "\n";
        if(ranking[i].uid == uid) {
          fill(255, 255, 0);
        } else {
          fill(255, 255, 255);
        }
        text(highscore, 13, 70 + (i * 15));
      }
      let selfRanking = ranking.findIndex((element) => element.uid == uid) + 1;
      if(selfRanking > 5) {
        highscore = selfRanking + "." + pName + ": " + score;
        fill(255, 255, 0);
        text(highscore, 13, 70 + (5 * 15));
      }

    }
  } else {
    if(scoreButton.getCurImg() > 0) {
      setTimeout(scoreButton.prevImage(), 120);
    }
    scoreButton.display();
  }

  camButton.display();

  pop();
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////

function changeImageHue(img, hue) {
  img.loadPixels();
  let newColor;
  for (let i = 0; i < img.width; i++) {
    for (let j = 0; j < img.height; j++) {
      newColor = rgba2hsla(img.get(i, j));
      newColor[0] = hue;
      newColor = color('hsla(' + newColor[0] + ',' + newColor[1] + '%,' + newColor[2] + '%,' +  newColor[3] + ')');
      img.set(i, j, newColor);
    }
  }
  img.updatePixels();
  return img;
}

// Takes a RGBA array and returns an HSLA array
function rgba2hsla(rgba) {
  let r = rgba[0];
  let g = rgba[1];
  let b = rgba[2];
  let a = rgba[3];
  r /= 255, g /= 255, b /= 255, a /= 255;

  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return [h, s * 100, l * 100, a];
}


function sortRanking() {
  if(players == null) {
    return;
  }
  var keys = Object.keys(players);
  ranking = [];
  for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      ranking.push(players[k]);
  }
  ranking.sort((a,b) => b.score - a.score);
}

// score
function increaseScore() {
  disableMapInteraction();
  fitToPolygon(hullPoints);
  setTimeout(function() {flyToPos()}, 3000);
  score += round(polygonArea(hullPoints) * 10);
  if(camMode == CameraMode.FREE) {
    setTimeout(function() {enableMapInteraction()}, 6000);
  }
}




// Math functions ////////////////////////////////////////////////////////////////////////////////////////////

  /* Generally used geo measurement function between two LatLong points.
     Returns distance in meters.

    https://en.wikipedia.org/wiki/Haversine_formula
  */
function measure(point1, point2){  
  var R = 6378.137; // Radius of earth in KM
  var dLat = degToRad(point2.x) - degToRad(point1.x);
  var dLon = degToRad(point2.y) - degToRad(point1.y);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
  Math.cos(degToRad(point1.x)) * Math.cos(degToRad(point2.x)) *
  Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d * 1000; // meters
}

function setLinesIntersect(newPoint) {
  if(coords < 3) {
    return linesIntersect;
  }
  // Intersects if new point near first point
  if(Math.abs(coords[0].x - newPoint.x) < 1e-6 && Math.abs(coords[0].y - newPoint.y) < 1e-6) {
    linesIntersect = true;
    hullPoints = [];
    hullAlpha = 200;
    hullPoints = [...coords];
    coords = [];
    increaseScore();
    return true;
  }
  // Intersects if new line intersects with an old line
  var intersection;
  for (var i = 0; i < coords.length - 2; i++) {
    intersection = getIntersectionPoint(coords[i], coords[i + 1], coords[coords.length - 1], newPoint);
    if(intersection != null) {
      linesIntersect = true;
      hullPoints = [...coords];
      hullPoints.splice(0, i + 1);
      hullPoints.unshift(intersection);
      coords = [];
      increaseScore();
      return true;
    }
  }
  return false;
}

// Returns intersectios point by converting them first into mercator value, then returns
// the point with langitude and longitude
function getIntersectionPoint(a, b, c, d) {
  var p1 = merc(a);
  var p2 = merc(b);
  var q1 = merc(c);
  var q2 = merc(d);
  if(intersects(p1, p2, q1, q2) == false){
    return null;
  }
  else {
    var det = getDeterminant(p1, p2, q1, q2);
    // Line P represented as a1x + b1y = c1 
    var a1 = p2.y - p1.y; 
    var b1 = p1.x - p2.x; 
    var c1 = a1*(p1.x) + b1*(p1.y); 

    // Line Q represented as a2x + b2y = c2 
    var a2 = q2.y - q1.y; 
    var b2 = q1.x - q2.x; 
    var c2 = a2 * q1.x + b2 * q1.y; 

    var x = (b2 * c1 - b1 * c2) / det; 
    var y = (a1 * c2 - a2 * c1) / det; 
    return mercToLatLong({x: x, y: y}); 
  }
}

/*  returns true if the line from p1->p2 intersects with q1->q2
*/
function intersects(p1, p2, q1, q2) {
  var det, gamma, lambda;

  det = getDeterminant(p1, p2, q1, q2);

  if (-1e-8 <= det && det <= 1e-8) {
    return false;
  } else {
    lambda = ((q2.y - q1.y) * (q2.x - p1.x) + (q1.x - q2.x) * (q2.y - p1.y)) / det;
    gamma = ((p1.y - p2.y) * (q2.x - p1.x) + (p2.x - p1.x) * (q2.y - p1.y)) / det;
    return ((-0.01 < lambda && lambda < 1.01) && (-0.01 < gamma && gamma < 1.01));
  }
};

function getDeterminant(p1, p2, q1, q2) {
  const px = p2.x - p1.x;
  const py = p2.y - p1.y;
  const qx = q2.x - q1.x;
  const qy = q2.y - q1.y;

  return px * qy - qx * py;
}

// Returns the area of a polygon using an array of lat/long coordinates
function polygonArea(polygon){
  var total = 0;

  for (var i = 0, l = polygon.length; i < l; i++) {
    var addX = merc_x(polygon[i].y);
    var addY = merc_y(polygon[i == polygon.length - 1 ? 0 : i + 1].x);
    var subX = merc_x(polygon[i == polygon.length - 1 ? 0 : i + 1].y);
    var subY = merc_y(polygon[i].x);

    total += (addX * addY * 0.5);
    total -= (subX * subY * 0.5);
  }

  return Math.abs(total / pow(getAverageScale(polygon), 2));
}

function degToRad(ang) {
  return ang * (Math.PI/180.0)
}

function radToDeg(rad) {
  return rad / (Math.PI/180.0);
}


 /* Mercator transformations 
    https://wiki.openstreetmap.org/wiki/Mercator
 */

// Returns average scale factor from an array of points
function getAverageScale(array) {
  scaleFactor = 0.0;
  for(var i = 0; i < array.length; i++) {
    scaleFactor += array[i].x / array.length;
  }
  scaleFactor = 1 / Math.cos(degToRad(scaleFactor));
  return scaleFactor;
}

function merc_x(long) { // conversion longitude => x
  var r_major = 6378137.000;
  return r_major * degToRad(long);
}

function merc_y(lat) { // conversion latitude => y
  if (lat > 89.5) {
      lat = 89.5;
  }
  if (lat < -89.5) {
      lat = -89.5;
  }
  var r_major = 6378137.000;
  var r_minor = 6356752.3142;
  var temp = r_minor / r_major;
  var es = 1.0 - (temp * temp);
  var eccent = Math.sqrt(es);
  var phi = degToRad(lat);
  var sinphi = Math.sin(phi);
  var con = eccent * sinphi;
  var com = 0.5 * eccent;
  con = Math.pow((1.0-con)/(1.0+con), com);
  var ts = Math.tan(.5 * (Math.PI*0.5 - phi))/con;
  var y = 0 - r_major * Math.log(ts);
  return y;
}

function merc(point) {
  const lat = point.x;
  const long = point.y;
  return {x: merc_x(long), y: merc_y(lat)};
}

function mercToLatLong(point) //mercator to lat lon
{
  var x = point.x;
  var y = point.y;
  const r_major = 6378137.0;//Equatorial Radius, WGS84
  const r_minor = 6356752.314245179;//defined as constant

  var long = radToDeg(x / r_major);
            
  var temp = r_minor / r_major;
  var e = Math.sqrt(1.0 - (temp * temp));
  var lat = radToDeg(pj_phi2(Math.exp(0 - (y / r_major)), e));
  
  return {x: lat, y: long};
}

function pj_phi2(ts, e) {
  var N_ITER = 15;
  var HALFPI = Math.PI/2;
  var TOL = 0.0000000001;
  var eccnth, Phi, con, dphi;
  var i;
  var eccnth = .5 * e;
  Phi = HALFPI - 2. * Math.atan (ts);
  i = N_ITER;
  do {
    con = e * Math.sin (Phi);
    dphi = HALFPI - 2. * Math.atan (ts * Math.pow((1. - con) / (1. + con), eccnth)) - Phi;
    Phi += dphi;
    
  } while ( Math.abs(dphi) > TOL && --i);
  return Phi;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// fly to position
function flyToPos() {
  myMap.map.flyTo({center: [long, lat], zoom: 18, duration: 3000});
}

// fit view to polygon
function fitToPolygon(polygon) {
  polygon = toLongLatArray(polygon);
  var bounds = polygon.reduce(function (bounds, coord) {
    return bounds.extend(coord);
  }, new mapboxgl.LngLatBounds(polygon[0], polygon[0]));
  myMap.map.fitBounds(bounds, {
    padding: 5,
    duration: 500
  });
}

// converts array to LongLat array for MapboxGl functions
function toLongLatArray(array) {
  var temp = [];
  for(var i = 0; i < array.length; i++) {
    temp.push([array[i].y, array[i].x]);
  }
  return temp;
}




// Buttons /////////////////////////////////////////////////////////////////////////////////////////////////////

// Class for Image Buttons
class Button {
  
  imgArr = [];

  constructor(inX, inY, inWidth, inHeight, inImgArr) {
    this.x = inX;
    this.y = inY;
    this.width = inWidth;
    this.height = inHeight;
    this.imgArr = inImgArr;
    this.curImg = 0;
  }
  
  display() {
    image(this.imgArr[this.curImg], this.x, this.y, this.width, this.height);
  }

  nextImage() {
    let nextCurImg = (this.curImg + 1) % this.imgArr.length;
    this.changeHitbox(nextCurImg);
    this.curImg = nextCurImg;
  }

  prevImage() {
    let nextCurImg = this.curImg - 1 >= 0 ? this.curImg - 1 : this.imgArr.length - 1;
    this.changeHitbox(nextCurImg);
    this.curImg = nextCurImg;
  }
  
  changeHitbox(nextCurImg) {
    if(this.imgArr[this.curImg].width != this.imgArr[nextCurImg].width) {
      this.width = Math.round(this.width * (this.imgArr[nextCurImg].width / this.imgArr[this.curImg].width));
    }
    if(this.imgArr[this.curImg].height != this.imgArr[nextCurImg].height) {
      this.height = Math.round(this.height * (this.imgArr[nextCurImg].height / this.imgArr[this.curImg].height));
    }
  }

  changeButton(inImgArr) {
    this.imgArr = inImgArr;
    this.curImg = 0;
  }

  getCurImg() {
    return this.curImg;
  }


  // over automatically matches the width & height of the image read from the file
  // see this.img.width and this.img.height below
  over() {
    if (mouseX > this.x && mouseX < this.x + this.width && mouseY > this.y && mouseY < this.y + this.height) {
      return true;
    } else {
      return false;
    }
  }
}

function mousePressed() {
  if(camButton.over() && camButtonEnabled) {
    camButton.nextImage();
    camButtonActivated = true;
  }
}

function mouseClicked() {
  if(scoreButton.over()) {
    showScore = !showScore
  }
}


function mouseReleased() {
  if(camButtonActivated) {
    if(camButton.over()) {
      camButtonEnabled = false;
      camButtonActivated = false;
      switch(camMode) {
        case CameraMode.FREE:
          flyToPos();
          disableMapInteraction();
          camMode = CameraMode.PLAYER;
          camButton.changeButton(camPlayerImgs);
          break;
        case CameraMode.PLAYER:
          disableMapInteraction();
          if(coords.length > 0) {
            fitToPolygon(coords);
          }
          camMode = CameraMode.POLYGON;
          camButton.changeButton(camPolygonImgs);
          break;
        default:
          enableMapInteraction();
          camButton.changeButton(camFreeImgs);
          camMode = CameraMode.FREE;
      }
    } else {
      camButton.nextImage();
    }
    setTimeout(function() {camButtonEnabled = true}, 300);
  }
}

function disableMapInteraction() {
  myMap.map.boxZoom.disable();
  myMap.map.scrollZoom.disable();
  myMap.map.dragPan.disable();
  myMap.map.dragRotate.disable();
  myMap.map.keyboard.disable();
  myMap.map.touchZoomRotate.disable();
  myMap.map.touchPitch.disable();
}

function enableMapInteraction() {
  myMap.map.boxZoom.enable();
  myMap.map.scrollZoom.enable();
  myMap.map.dragPan.enable();
  myMap.map.dragRotate.enable();
  myMap.map.keyboard.enable();
  myMap.map.touchZoomRotate.enable();
  myMap.map.touchPitch.enable();
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////



function gen_uid() {
  /*
   erzeuge eine user id anhänig von bildschirmaufläsung; browser id, etc....
   https://pixelprivacy.com/resources/browser-fingerprinting/
   https://en.wikipedia.org/wiki/Device_fingerprint
  */
  var navigator_info = window.navigator;
  var screen_info = window.screen;
  var uid = navigator_info.mimeTypes.length;
  uid += navigator_info.userAgent.replace(/\D+/g, '');
  uid += navigator_info.plugins.length;
  uid += screen_info.height || '';
  uid += screen_info.width || '';
  uid += screen_info.pixelDepth || '';
  return uid;
}