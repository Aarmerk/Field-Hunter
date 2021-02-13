let canvas;
let myFont;
//let gameWidth = window.innerWidth;
//let gameHeight = window.innerHeight;

// API key for map provider.
var key = 'pk.eyJ1IjoiZmlkZWxkYSIsImEiOiJja2luOHk3dmMxMTNvMnZxanNubGJ2dW82In0.9WiB5IP8aDLBO-i6HBmtdQ';

// Create a new Mappa instance.
var mappa = new Mappa('MapboxGL', key);
const version = "21";

let myMap;
let lat = -1; // wo bin ich
let long = -1;
let pName = "-"; // player name

// Map options
const options = {
  lat: lat, // center in bremen
  lng: long,
  zoom: 16,
  //minZoom: 15,
  maxZoom: 22,
  style: 'mapbox://styles/mapbox/streets-v11',
  pitch: 0,
};

// Position options
const posOptions = {
  enableHighAccuracy: true
}

// Database
let uid = gen_uid(); // unique brower/user id wird als db key benutze...
var database; // db ref
var players; // liste alle spieler
var score = 0;

// Saved coordinates
let coords = [];
let hullPoints;
var hullAlpha;
var alphaAmount = 3;
var linesIntersect = false;

// Pulsing Dot
var theta;

function preload() {
  myFont = loadFont('Ligconsolata-Regular.otf');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  textFont(myFont, 20);
  textSize(20);
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

  getCurrentPosition(setupPosition, error, posOptions); // gps callback

  watchPosition(positionChanged, error, posOptions); // gps callback

  setupGui();

  maintenancePlayerData();
  updatePlayerData();
  getAllPlayerData();
  setInterval(updateData, 2000); // daten mit server abgleichen
}

function draw() {
  /*if(gameWidth != window.innerWidth || gameHeight != window.innerHeight) {
    gameWidth = window.innerWidth;
    gameHeight = window.innerHeight;
    canvas = resizeCanvas(gameWidth, gameHeight);
  }*/
  clear();
  if(myMap != null) {
    drawPolygon();
    drawLine();
    drawPlayer();
  }
  drawGui();
}


// Position functions

function setupPosition(position) {
  lat = position.latitude;
  long = position.longitude;
  options.lat = lat;
  options.lng = long;
  myMap = mappa.tileMap(options); 
  myMap.overlay(canvas);
  if (coords.length < 1) {
    coords.push({x: lat, y: long});
  }
}

function positionChanged(position) {
  if (myMap == null) {
    setupPosition(position);
    return;
  }
  lat = position.latitude;
  long = position.longitude;
  const newCoord = {x: lat, y: long};
  if(coords.length > 0) {
    // Push if unique
    if(coords[coords.length - 1].x != newCoord.x || coords[coords.length - 1].y != newCoord.y) {
      // Push if point doesn't cause intersection
      if(coords.length >= 3 && setLinesIntersect(newCoord)) {
        return;
      }
      coords.push(newCoord);
    }
  } else {
    coords.push(newCoord);
  }
}

function error() {
  // nop
}

//Server functions

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
    //name: pName,
    timestamp: Date.now()
  });
}

function updateData() {
  updatePlayerData(); // meine daten updaten
  maintenancePlayerData(); // kill all zombies
  getAllPlayerData(); // alle anders player daten holen
  storeItem('demoName', pName.value()); // meinen player namen im coookie speichern
}

// Setup functions

function setupGui() {
  button = createButton('click me');
  button.position((windowWidth * 0.90) + 20,  (windowHeight * 0.90) + 20);
  button.mousePressed(flyToPos);

    // eingebefeld für den namen
    pName = createInput();
    pName.position((windowWidth * 0.90) - 50, 30);
    pName.value(getItem('demoName')); // holt pNamen aus coookie
}


// Draw functions

function drawPolygon(){
  push();
  if(linesIntersect) {
    noStroke();
    hullColor = color(255, 0, 255);
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
    stroke('rgba(255, 0, 255, 1)');
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

  // Pulsing circle
  var maxDiameter = pow(1.4, size);
  var diam = (((size / 2) * 0.7 * theta) % maxDiameter) + size;
  noStroke();
  var playerColor = color(255, 0, 255);
  playerColor.setAlpha(150 - (diam *  (150 / maxDiameter)));
  fill(playerColor);
  ellipse(mypos.x, mypos.y, diam, diam);
  theta += (maxDiameter / 250);

  //Player
  stroke(255);
  fill(255, 0, 255);
  ellipse(mypos.x, mypos.y, size, size);

  //Player name
  noStroke();
  fill(255, 0, 255);
  text(pName.value(), mypos.x + 20, mypos.y);

  if (players != null) {
    var keys = Object.keys(players);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      // If not myself
      if (k != uid) {
        var pos = myMap.latLngToPixel(players[k].lat, players[k].long);
        size = map(myMap.zoom(), 1, 6, 5, 7);
        
        // Other
        stroke(255);
        fill(0, 255, 255)
        ellipse(pos.x, pos.y, size, size);

        // Other name
        stroke(255);
        fill(0);
        text(players[k].name, pos.x + 20, pos.y);
      }
    }
  }
  pop();
}

function drawGui() {
  textSize(15);
  noStroke();
  fill(0);
  var info = "score = " + score;
  if (geoCheck() == true) {
    info += '\nlat = ' + lat + ' long = ' + long;
  } else {
    info += 'no geo';
  }
  text(info, 30, (windowHeight * 0.90) + 20);
  stroke(0, 255, 0);
}



// Math functions

function measure(point1, point2){  // generally used geo measurement function
  var R = 6378.137; // Radius of earth in KM
  var dLat = point2.x * Math.PI / 180 - point1.x * Math.PI / 180;
  var dLon = point2.y * Math.PI / 180 - point1.y * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
  Math.cos(point1.x * Math.PI / 180) * Math.cos(point2.x * Math.PI / 180) *
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

function getIntersectionPoint(p1, p2, q1, q2) {
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
    return {x: x, y: y}; 
  }

}

// returns true if the line from p1->p2 intersects with q1->q2
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

function polygonArea(polygon){
  var total = 0;

  for (var i = 0, l = polygon.length; i < l; i++) {
    var addX = polygon[i].x;
    var addY = polygon[i == polygon.length - 1 ? 0 : i + 1].y;
    var subX = polygon[i == polygon.length - 1 ? 0 : i + 1].x;
    var subY = polygon[i].y;

    total += (addX * addY * 0.5);
    total -= (subX * subY * 0.5);
  }

  return Math.abs(total);
}

function increaseScore() {
  score += (round(polygonArea(hullPoints) * 10000000000000));
}


function flyToPos() {
  myMap.map.flyTo({center: [long, lat]});
}



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