// API key for map provider.
var key = 'pk.eyJ1IjoiZmlkZWxkYSIsImEiOiJja2luOHk3dmMxMTNvMnZxanNubGJ2dW82In0.9WiB5IP8aDLBO-i6HBmtdQ';

// Create a new Mappa instance.
var mappa = new Mappa('MapboxGL', key);
const version = "21";
let canvas;
let myFont;

let uid = gen_uid(); // unique brower/user id wird als db key benutze...
let lat = -1; // wo bin ich
let long = -1;
var database; // db ref
var players; // liste alle spieler

var hullPoints_size = 0;

let myMap;
let coords = [];
var hullPoints = [];

const options = {
  lat: 53.073635, // center in bremen
  lng: 8.806422,
  zoom: 6,
  style: 'mapbox://styles/mapbox/streets-v11',
  pitch: 0,
};

function preload() {
  myFont = loadFont('Ligconsolata-Regular.otf');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  textFont(myFont, 20);
  textSize(20);
  watchPosition(positionChanged); // gps callback

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

  maintenancePlayerData();
  updatePlayerData();
  getAllPlayerData();
  setInterval(updateData, 2000); // daten mit server abgleichen

  myMap = mappa.tileMap(options); 
  // Overlay the canvas over the tile map
  myMap.overlay(canvas);
}

function draw() {
  drawPlayer();
  drawGui();
}

function drawPlayer() {
  clear();
  push();
  var mypos = myMap.latLngToPixel(lat, long);
  size = map(myMap.zoom(), 1, 6, 5, 7);
  noStroke();
  fill(255, 0, 255);
  ellipse(mypos.x, mypos.y, size, size);
  fill(255);
  if (players != null) {
    var keys = Object.keys(players);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k != uid) {
        // not myself
        var pos = myMap.latLngToPixel(players[k].lat, players[k].long);
        size = map(myMap.zoom(), 1, 6, 5, 7);
        noStroke();
        fill(0, 255, 255)
        ellipse(pos.x, pos.y, size, size);
        fill(255);
      }
    }
  }
  drawHull();
  drawLine();
  pop();
}

function drawLine() {
  push();
  for (let i = 0; i < (coords.length - 1); i++) {
    var pos1 = myMap.latLngToPixel(coords[i][0], coords[i][1]);
    var pos2 = myMap.latLngToPixel(coords[i+1][0], coords[i+1][1]);
    stroke('rgba(255, 0, 255, 1)');
    strokeWeight(myMap.zoom() / 2);
    line(pos1.x, pos1.y, pos2.x + i, pos2.y + i);
  }
  pop();
}

function drawHull(){
  push();
  var points = [...coords];
  points.sort(sortPointX);
  points.sort(sortPointY);
  if(points.length > hullPoints_size) {
    hullPoints_size = chainHull_2D(points, points.length, hullPoints);
  }
  if(hullPoints_size > 3) {
    noStroke();
    fill('rgba(255, 0, 255, 0.3)');
    beginShape();
    for (var i = 0; i < (hullPoints_size); i++) {
      var pos = myMap.latLngToPixel(hullPoints[i][0], hullPoints[i][1]);
      vertex(pos.x, pos.y);
    }
    endShape(CLOSE);
  }
  pop();
}

function drawGui() {
  textSize(15);
  noStroke();
  fill(255);
  var info = "version = " + version;
  if (geoCheck() == true) {
    info += '\nlat = ' + lat + ' long = ' + long;
  } else {
    info += 'no geo';
  }
  text(info, 30, (windowHeight * 0.90) + 20);
  stroke(0, 255, 0);
}

function positionChanged(position) {
  lat = position.latitude;
  long = position.longitude;
  coords.push([lat, long]);
}

function maintenancePlayerData() {
  var ref = firebase.database().ref('player');
  var now = Date.now();
  var cutoff = now - 20 * 1000; // 20 sekunden.
  var old = ref.orderByChild('timestamp').endAt(cutoff).limitToLast(1);
  var listener = old.on('child_added', function (snapshot) {
    snapshot.ref.remove();
  });
}

function updatePlayerData() {
  firebase.database().ref('player/' + uid).set({
    lat: lat,
    long: long,
    timestamp: Date.now()
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

function updateData() {
  updatePlayerData(); // meine daten updaten
  maintenancePlayerData(); // kill all zombies
  getAllPlayerData(); // alle anders player daten holen
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
