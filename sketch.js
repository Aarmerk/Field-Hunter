import 'https://api.mapbox.com/mapbox-gl-js/v2.0.0/mapbox-gl.js';
mapboxgl.accessToken = 'pk.eyJ1IjoiZmlkZWxkYSIsImEiOiJja2luOHk3dmMxMTNvMnZxanNubGJ2dW82In0.9WiB5IP8aDLBO-i6HBmtdQ';

var lng;
var lat;

const coordinates = [];


var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [8.806422, 53.073635],
  zoom: 15
});

map.on('load', function () {
  loadGeoJSON();
  navigator.geolocation.watchPosition(
    data => {
      console.log(data);
      lng = data.coords.longitude;
      lat = data.coords.latitude;
      coordinates.push([lng, lat]);
      map.flyTo({center: [lng, lat], zoom: 17});
      window.localStorage.setItem("coordinates", JSON.stringify(coordinates));
      map.removeLayer('route');
      map.removeSource('route');
      loadGeoJSON();
    },
    error => console.log(error), 
    {
      enableHighAccuracy: true
    }
  );
});

map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true
  })
);

function loadGeoJSON() {
  map.addSource('route', {
    'type': 'geojson',
    'data': {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': coordinates
        }
    }
  });
  map.addLayer({
      'id': 'route',
      'type': 'line',
      'source': 'route',
      'layout': {
          'line-join': 'round',
          'line-cap': 'round'
      },
      'paint': {
          'line-color': '#1da1f2',
          'line-width': 5
      }
  });
}

