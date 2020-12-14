import 'https://api.mapbox.com/mapbox-gl-js/v2.0.0/mapbox-gl.js';
mapboxgl.accessToken = 'pk.eyJ1IjoiZmlkZWxkYSIsImEiOiJja2luOHk3dmMxMTNvMnZxanNubGJ2dW82In0.9WiB5IP8aDLBO-i6HBmtdQ';

var lng;
var lat;

const coordinates = [];

var size = 100;

// implementation of CustomLayerInterface to draw a pulsing dot icon on the map
// see https://docs.mapbox.com/mapbox-gl-js/api/#customlayerinterface for more info
var pulsingDot = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    // get rendering context for the map canvas when layer is added to the map
    onAdd: function () {
        var canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },

    // called once before every frame where the icon will be used
    render: function () {
        var duration = 2500;
        var t = (performance.now() % duration) / duration;

        var radius = (size / 2) * 0.3;
        var outerRadius = (size / 2) * 0.7 * t + radius;
        var context = this.context;

        // draw outer circle
        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2
        );
        context.fillStyle = 'rgba(70, 200, 242,' + (1 - t) + ')';
        context.fill();

        // draw inner circle
        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            radius,
            0,
            Math.PI * 2
        );
        context.fillStyle = 'rgba(29, 161, 242, 1)';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        // update this image's data with data from the canvas
        this.data = context.getImageData(
            0,
            0,
            this.width,
            this.height
        ).data;

        // continuously repaint the map, resulting in the smooth animation of the dot
        map.triggerRepaint();

        // return `true` to let the map know that the image was updated
        return true;
    }
};

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [8.806422, 53.073635],
  zoom: 7
});

map.on('load', function () {
  map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });
  loadGeoJSON();
  loadPoints();
  update();
});

function update() {
  navigator.geolocation.watchPosition(
    data => {
      console.log(data);
      if(lng != data.coords.longitude || lat != data.coords.latitude) {
        lng = data.coords.longitude;
        lat = data.coords.latitude;
        map.removeLayer('points');
        map.removeSource('points');
        loadPoints();
        coordinates.push([lng, lat]);
        map.flyTo({speed: 3.0, center: [lng, lat], zoom: 16});
        window.localStorage.setItem("coordinates", JSON.stringify(coordinates));
        map.removeLayer('route');
        map.removeSource('route');
        loadGeoJSON();
      }
    },
    error => console.log(error), 
    {
      enableHighAccuracy: true
    }
  );
}

map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    fitBoundsOptions: {
      maxZoom: 16
    },
    trackUserLocation: true,
    showAccuracyCircle: false,
    showUserLocation: false,
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

function loadPoints(){
  map.addSource('points', {
    'type': 'geojson',
    'data': {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lng, lat]
                }
            }
        ]
    }
  });
  map.addLayer({
    'id': 'points',
    'type': 'symbol',
    'source': 'points',
    'layout': {
        'icon-image': 'pulsing-dot'
    }
  });
}
