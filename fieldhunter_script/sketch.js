let canvas;
let myFont;
let buttonImg;

// API key for map provider.
var key = 'pk.eyJ1Ijoic2ltdGluIiwiYSI6ImNraW5mODU2ajA4ZTUyem1sMGQ1MXRsYmYifQ.QiM3UZyf58-ehmisIRHQnw';

// Create a new Mappa instance.
var mappa = new Mappa('MapboxGL', key);
const version = "21";

let myMap;
let lat = -1; // wo bin ich
let long = -1;

// Map options
const options = {
  lat: lat, // center in bremen
  lng: long,
  zoom: 16,
  //minZoom: 15,
  maxZoom: 22,
  style: 'mapbox://styles/simtin/ckl5nkoog2sf317qhmranwvs6',
  pitch: 0,
};

// Position options
var posOptions = {
  enableHighAccuracy: true
}

// Database
let uid = gen_uid(); // unique brower/user id wird als db key benutze...
var database; // db ref
var players; // liste alle spieler
var score = 0;
let pName = "-"; // player name
let ranking = [];

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
  buttonImg = loadImage('../button/LocationZoom_unclicked.png')
}

function setup() {
  noCanvas();
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('display', 'block');
  centerCanvas();
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
  clear();
  if(lat != -1) {
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

function setupGui() {
    // Button für das Fixieren
    button = createImg('../button/LocationZoom_clicked.png');
    button.position(10, windowHeight - 60);
    button.style('width: 30px');
    button.mousePressed(flyToPos);
    button.mouseOver(changeToBlue);

    // Eingebefeld für den namen
    pName = createInput();
    pName.position(20, 30);
    pName.style('width: 85px');
    pName.value(getItem('demoName')); // holt pNamen aus coookie
}

function positionChanged(position) {
  if (myMap == null) {
    setupPosition(position);
    return;
  }
  const newCoord = {x: position.latitude, y: position.longitude};
  if(coords.length > 0) {
    // Push if unique
    if(measure(coords[coords.length - 1], newCoord) > 1.0) {
    //if(coords[coords.length - 1].x != newCoord.x || coords[coords.length - 1].y != newCoord.y) {
      lat = position.latitude;
      long = position.longitude;
      if(posOptions.enableHighAccuracy) {
        posOptions.enableHighAccuracy = false;
      }
      // Push if point doesn't cause intersection
      if(coords.length >= 3 && setLinesIntersect(newCoord)) {
        return;
      }
      coords.push(newCoord);
    }
  } else {
    lat = position.latitude;
    long = position.longitude;
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
    name: pName.value(),
    score: score,
    timestamp: Date.now()
  });
}

function updateData() {
  updatePlayerData(); // meine daten updaten
  maintenancePlayerData(); // kill all zombies
  getAllPlayerData(); // alle anders player daten holen
  storeItem('demoName', pName.value()); // meinen player namen im coookie speichern
  sortRanking();
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
        stroke(0);
        fill(0, 255, 255);
        text(players[k].name, pos.x + 20, pos.y);
      }
    }
  }
  pop();
}

function drawGui() {
  push();
  var info = "Score = " + score;
  textSize(20);
  textAlign(LEFT);
  textStyle(BOLD);
  stroke(0);
  fill(255, 0, 255);
  text(info, 20, 75);
  pop();
  if (players != null){
    var highscore = "";
    scoreLenght = ranking.length < 5 ? ranking.length : 5;
    for (var i = 0; i < scoreLenght; i++) {
      highscore += ranking[i].name + ": " + ranking[i].score + "\n";
    }
    fill(0,255,255);
    textSize(20)
    stroke(0);
    text("Rankings:", 20, 100);

    fill(255,255,0);
    textSize(12);
    stroke(0);
    text(highscore, 20, 120);
  }
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

// returns true if the line from p1->p2 intersects with q1->q2
function intersects(p1, p2, q1, q2) {
  var det, gamma, lambda;

  det = getDeterminant(p1, p2, q1, q2);

  if (-1e-8 <= det && det <= 1e-8) {
    return false;
  } else {
    lambda = ((q2.y - q1.y) * (q2.x - p1.x) + (q1.x - q2.x) * (q2.y - p1.y)) / det;
    gamma = ((p1.y - p2.y) * (q2.x - p1.x) + (p2.x - p1.x) * (q2.y - p1.y)) / det;
    return ((-0.1 < lambda && lambda < 1.1) && (-0.1 < gamma && gamma < 1.1));
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
    var addX = merc_x(polygon[i].x);
    var addY = merc_y(polygon[i == polygon.length - 1 ? 0 : i + 1].y);
    var subX = merc_x(polygon[i == polygon.length - 1 ? 0 : i + 1].x);
    var subY = merc_y(polygon[i].y);

    total += (addX * addY * 0.5);
    total -= (subX * subY * 0.5);
  }

  return Math.abs(total);
}

 //Mercator transformations
function deg_rad(ang) {
  return ang * (Math.PI/180.0)
}

function rad_deg(rad) {
  return rad / (Math.PI/180.0);
}

function merc_x(long) { // conversion longitude => x
  var r_major = 6378137.000;
  return r_major * deg_rad(long);
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
  var phi = deg_rad(lat);
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

  var long = rad_deg(x / r_major);
            
  var temp = r_minor / r_major;
  var e = Math.sqrt(1.0 - (temp * temp));
  var lat = rad_deg(pj_phi2(Math.exp(0 - (y / r_major)), e));
  
  return {x: lat, y: long};
}

function pj_phi2(ts, e) 
	{
		var N_ITER = 15;
		var HALFPI = Math.PI/2;
		
		
		var TOL = 0.0000000001;
		var eccnth, Phi, con, dphi;
		var i;
		var eccnth = .5 * e;
		Phi = HALFPI - 2. * Math.atan (ts);
		i = N_ITER;
		do 
		{
			con = e * Math.sin (Phi);
			dphi = HALFPI - 2. * Math.atan (ts * Math.pow((1. - con) / (1. + con), eccnth)) - Phi;
			Phi += dphi;
			
		} while ( Math.abs(dphi) > TOL && --i);
		return Phi;
	}


// score
function increaseScore() {
  score += round(polygonArea(hullPoints));
}

// fly to position
function flyToPos() {
  if(!posOptions.enableHighAccuracy) {
    posOptions.enableHighAccuracy = true;
  }
  myMap.map.flyTo({center: [long, lat], zoom: 18});
}

function changeToBlue() {
  
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


function centerCanvas() {
  var x = (windowWidth - width) / 2;
  var y = (windowHeight - height) / 2;
  canvas.position(x, y);
}

function windowResized() {
  // assigns new values for width and height variables
  centerCanvas();
}