(function () {
  'use strict';
  var webglEl = document.getElementById('webgl');

  if (!Detector.webgl) {
    Detector.addGetWebGLMessage(webglEl);
    return;
  }

  var width  = window.innerWidth,
    height = window.innerHeight;

  // Earth params
  var radius   = 0.5,
    segments = 32,
    rotation = 80;

  var sphereAndPoints = new THREE.Object3D();
  //var rotationSpeed = 0.0005;
  var rotationSpeed = 0.001;

  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
  camera.position.z = 4;

  var renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);

  var sunObj;
  var ambientLight = new THREE.AmbientLight(0x555555);
  var atlasLight = new THREE.AmbientLight(0xffffff);

  var btnToggleMap = document.getElementById('btn-toggle-map');
  var btnPrevElt = document.getElementById('btn-prev');
  var btnNextElt = document.getElementById('btn-next');
  var btnPlayElt = document.getElementById('btn-play');
  var btnPauseElt = document.getElementById('btn-pause');
  var btnRotateElt = document.getElementById('btn-rotate');
  var btnToggleMarkers = document.getElementById('btn-toggle-markers');
  var btnToggleLight = document.getElementById('btn-toggle-light');
  var btnTogglePictures = document.getElementById('btn-left-nav-toggle');

  var showingAtlasView = false;
  var surfaceMarkersHidden = false;

  var sphere;
  var mapIndex = maps.length;   // Start at the most recent.

  // Event listeners for prev/next
  var t = -1;
  document.addEventListener('keydown', function(e) {
    var now = new Date().getTime();
    if (now - t > 150) {
      // Left and right keys are 37 and 39 respectively, they step through the
      // select.
      var select = document.getElementById('years-ago');
      if (e.keyCode == 37) {
        step(false);
      } else if (e.keyCode == 39) {
        step(true);
      }
      t = now;
    }
  }, false);

  btnPrevElt.onclick = function() {
    step(false);
  };
  btnNextElt.onclick = function() {
    step(true);
  };

  // Play/pause logic
  var playInterval;
  btnPlayElt.onclick = function() {
    if (showingAtlasView) {
      toggleAtlasView.apply(btnToggleMap);
    }

    mapIndex = -1;
    (function play() {
      if (mapIndex == maps.length - 1) {
        return;
      }
      step(true);
      btnPlayElt.style.display = 'none';
      btnPauseElt.style.display = '';

      playInterval = setTimeout(play, 2000);
    })();
  };

  btnPauseElt.onclick = function() {
    clearInterval(playInterval);
    btnPlayElt.style.display = '';
    btnPauseElt.style.display = 'none';
  };

  // Rotate logic
  var rotatingFast = false;
  btnRotateElt.onclick = function() {
    if (rotatingFast) {
      rotationSpeed = 0;
      this.innerHTML = 'Rotate globe';
    } else {
      rotationSpeed = 0.01;
      this.innerHTML = 'Stop rotation';
    }
    rotatingFast = !rotatingFast;
  };

  /*
  webglEl.addEventListener('mousedown', function() {
    rotationSpeed = 0;
    btnRotateElt.innerHTML = 'Rotate globe';
  }, false);
  */

  // Select logic
  var selectHtml = '';
  var jumpToElt = document.getElementById('jump-to');
  for (var i=maps.length-1; i > -1; i--) {
    var timestep = maps[i];
    selectHtml += '<option value="' + i + '">' + timestep.date + '</option>';
  }
  jumpToElt.value = maps.length - 1;
  jumpToElt.innerHTML = selectHtml;
  jumpToElt.onchange = function() {
    mapIndex = jumpToElt.value - 1;
    step(true);
  };

  setupAtlasView();

  // Picture sidebar setup.
  setupPictureSidebar();

  // Lighting.
  var lightsOn = false;
  btnToggleLight.onclick = function() {
    if (lightsOn) {
      scene.remove(ambientLight);
      this.innerHTML = 'Increase light';
    } else {
      scene.add(ambientLight);
      this.innerHTML = 'Decrease light';
    }
    lightsOn = !lightsOn;
  };

  // Sun
  setupSun();

  // Final pluto object
  scene.add(sphereAndPoints);

  // Initialize the sphere texture.
  if (window.location.hash == '#atlas') {
    toggleAtlasView.apply(btnToggleMap);
  } else {
    step(false);
  }

  // Surface makers (must come after Pluto is set up).
  setupSurfaceMarkers();

  // Atmosphere (must go after Pluto is set up).
  var customMaterial = new THREE.ShaderMaterial({
    uniforms: {
      'c':   { type: 'f', value: 0.35 },
      'p':   { type: 'f', value: 6 },
      glowColor: { type: 'c', value: new THREE.Color(0x344152) },
      viewVector: { type: 'v3', value: camera.position }
    },
    vertexShader:   document.getElementById('atmosphere-vertex-shader').textContent,
    fragmentShader: document.getElementById('atmosphere-fragment-shader').textContent,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments), customMaterial);
  atmosphere.position.set(sphere.position.x, sphere.position.y, sphere.position.z);
  atmosphere.scale.multiplyScalar(1.2);
  scene.add(atmosphere);

  // Other orbits.
  var charon;
  var hydra;
  var charonCalc;
  var hydraCalc;
  if (!isMobile()) {
    var jed = 19084819.551782407;
    charonCalc = setupCharon();
    charon = createSphere('charon-bjorn-20150716.png', radius * 1270/2320, segments);
    var pos = charonCalc.getPosAtTime(jed);
    charon.position.set(pos[0], pos[1], pos[2]);
    scene.add(charon);

    hydraCalc = setupHydra();
    hydra = createSphere(null, radius * 55/2320 * 5, segments);
    var pos = hydraCalc.getPosAtTime(jed);
    hydra.position.set(pos[0], pos[1], pos[2]);
    scene.add(hydra);
  }

  // Preload textures
  setTimeout(function preloadTextures() {
    var preload = [window.atlas_view];
    preload.push.apply(preload, maps);
    for (var i=0; i < preload.length; i++) {
      if (!preload[i].path) continue;
      var im = new Image();
      im.src = 'images/' + preload[i].path;
    }
  }, 5000);

  /*
    var clouds = createClouds(radius, segments);
  clouds.rotation.y = rotation;
  scene.add(clouds)
 */

  // Stars
  var stars = createStars(90, 64);
  scene.add(stars);

  // Controls
  var controls = new THREE.OrbitControls(camera, webglEl);
  controls.minDistance = 1;
  controls.maxDistance = 20;
  controls.noKeys = true;
  controls.rotateSpeed = 1.4;

  THREEx.WindowResize(renderer, camera);

  webglEl.appendChild(renderer.domElement);

  setTimeout(function() {
    populatePictures();
  }, 2000);

  render();

  function render() {
    controls.update();
    if (sphereAndPoints && rotationSpeed) {
      sphereAndPoints.rotation.y += rotationSpeed;
    }
    if (charon) {
      jed += 0.002;
      var pos = charonCalc.getPosAtTime(jed);
      charon.position.set(pos[0], pos[1], pos[2]);
    }
    if (hydra) {
      jed += 0.002;
      var pos = hydraCalc.getPosAtTime(jed);
      hydra.position.set(pos[0], pos[1], pos[2]);
    }
    //clouds.rotation.y += 0.0005;
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  function startCountdown() {
    setInterval(function() {
      var time = countdown(new Date(Date.UTC(2015, 6, 14, 11, 49)) ).toString();
      document.getElementById('timer').innerHTML = time;
    }, 1000);
  }

  function createSphere(texturePath, radius, segments) {
    var map;
    if (texturePath) {
      map = THREE.ImageUtils.loadTexture('images/' + texturePath);
    }

    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, segments, segments),
      new THREE.MeshPhongMaterial({
        //map:         THREE.ImageUtils.loadTexture('images/2_no_clouds_4k.jpg'),
        map:         map,
        "color": 0xbbbbbb, "specular": 0x111111, "shininess": 1,
        /*
        "color": 0xbbbbbb, "specular": 0x111111, "shininess": 1,
        bumpMap:     map,
        bumpScale:   0.02,
        specularMap: map,
       */
        //specular:    new THREE.Color('grey')
        /*
        bumpMap:     THREE.ImageUtils.loadTexture('images/elev_bump_4k.jpg'),
        bumpScale:   0.005,
        specularMap: THREE.ImageUtils.loadTexture('images/water_4k.png'),
        specular:    new THREE.Color('grey')
        */
      })
    );
    return mesh;
  }

  function createClouds(radius, segments) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius + 0.003, segments, segments),
      new THREE.MeshPhongMaterial({
        map:         THREE.ImageUtils.loadTexture('images/fair_clouds_4k.png'),
        transparent: true
      })
    );
  }

  function createStars(radius, segments) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, segments, segments),
      new THREE.MeshBasicMaterial({
        map:  THREE.ImageUtils.loadTexture('images/galaxy_starfield.png'),
        side: THREE.BackSide
      })
    );
  }

  function clearSelection() {
    if(document.selection && document.selection.empty) {
      document.selection.empty();
    } else if(window.getSelection) {
      var sel = window.getSelection();
      sel.removeAllRanges();
    }
  }

  // Convert the positions from a lat, lng to a position on a sphere.
  function latLngToVector3(lat, lng, radius, height) {
    var phi = (lat)*Math.PI/180;
    var theta = (lng+90)*Math.PI/180;

    var x = -(radius+height) * Math.cos(phi) * Math.cos(theta);
    var y = (radius+height) * Math.sin(phi);
    var z = (radius+height) * Math.cos(phi) * Math.sin(theta);

    return new THREE.Vector3(x,y,z);
  }

  function populatePictures() {
    var leftNav = document.getElementById('left-nav');
    window.pictures.forEach(function(picture) {
      var pictureElement = document.createElement('img');
      pictureElement.src = '//wit.wurfl.io/w_180/' + picture.url;
      pictureElement.className = 'left-nav-image';
      pictureElement.setAttribute('width', 180);

      var linkElement = document.createElement('a');
      linkElement.href = picture.link;
      linkElement.target = '_blank';
      linkElement.title = picture.caption + '\n\n' + picture.desc;

      linkElement.appendChild(pictureElement);
      leftNav.appendChild(linkElement);
    });
  }

  function setupCharon(i) {
    var orbit = new Orbit3D({
      a: 19571,
      e: 0,
      i: -(90-0.001),
      p: 6.3872304,
      //o: 223.046,
      o: 0,
      w: 0,
      ma: 0,
      epoch: 2452600.5,
    }, {

    });
    return orbit;
  }

  function setupHydra() {
    var orbit = new Orbit3D({
      a: 64738,
      e: 0.005862,
      i: -(90-0.242),
      p: 38.20177,
      //o: 223.046,
      o: 0,
      w: 0,
      ma: 0,
      epoch: 2452600.5,
    }, {

    });
    return orbit;
  }

  function setupSun() {
    var sunlight = new THREE.DirectionalLight(0xffffff, 1);
    var texture = THREE.ImageUtils.loadTexture('images/sunsprite.png');
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      useScreenCoordinates: false,
      color: 0xffffff
    }));
    sprite.scale.set(4, 4, 4);
    sprite.position.set(45, 6, 45);

    sunlight.position.set(5, 3, 5);

    sunObj = new THREE.Object3D();
    sunObj.add(sprite);
    sunObj.add(sunlight);
    scene.add(sunObj);
  }

  function setupAtlasView() {
    btnToggleMap.onclick = toggleAtlasView;
  }

  function toggleAtlasView() {
    if (showingAtlasView) {
      scene.remove(atlasLight);
      scene.add(sunObj);
      this.innerHTML = 'Show atlas view';

      showingAtlasView = false;
      mapIndex = maps.length;
      step(true);
    } else {
      loadTimestep(window.atlas_view);

      if (lightsOn) {
        // Counterintuitively, we turn the lights out because we add our own
        // custom lighting.
        btnToggleLight.click();
      }
      scene.remove(sunObj);
      scene.add(atlasLight);

      if (!surfaceMarkersHidden) {
        btnToggleMarkers.click();
      }
      rotationSpeed = 0;
      this.innerHTML = 'Hide atlas view';
      showingAtlasView = true;
    }
  }

  function setupSurfaceMarkers() {
    // Surface markers
    var globeTooltipElt = document.getElementById('globe-tooltip');
    var domEvents = new THREEx.DomEvents(camera, renderer.domElement);
    var markers = [];
    sphereAndPoints.add(sphere);

    window.points.forEach(function(point) {
      var material = new THREE.MeshBasicMaterial({color: 0xFEE5AC});
      var geom =  new THREE.SphereGeometry(0.009, 64, 64);
      var marker = new THREE.Mesh(geom, material);
      var pos = latLngToVector3(point.latlng[0], point.latlng[1], radius, 0);
      marker.position.set(pos.x, pos.y, pos.z);
      domEvents.addEventListener(marker, 'mouseover', function(e) {
        // Stop rotation.
        rotationSpeed = 0;
        btnRotateElt.innerHTML = 'Rotate globe';

        // Build tooltip.
        var x = e.origDomEvent.clientX + 10;
        var y = e.origDomEvent.clientY - 5;

        globeTooltipElt.style.display = '';
        globeTooltipElt.style.left = x + 'px';
        globeTooltipElt.style.top = y + 'px';
        var tip = point.name;
        if (point.desc) {
          tip += '<br><span>' + point.desc + '</span>';
        }
        if (point.img) {
          tip += '<img src="' + point.img + '">';
        }
        globeTooltipElt.innerHTML = tip;
      }, false);
      domEvents.addEventListener(marker, 'mouseout', function(e) {
        globeTooltipElt.style.display = 'none';
      }, false);
      sphereAndPoints.add(marker);
      markers.push(marker);
    });

    btnToggleMarkers.onclick = function() {
      markers.forEach(function(marker) {
        if (surfaceMarkersHidden) {
          sphereAndPoints.add(marker);
        } else {
          sphereAndPoints.remove(marker);
        }
      });
      surfaceMarkersHidden = !surfaceMarkersHidden;
      this.innerHTML = (surfaceMarkersHidden ? 'Show' : 'Hide') + ' markers';
    };
  }

  function setupPictureSidebar() {
    var picturesShown = true;
    btnTogglePictures.onclick = function() {
      // Keep styles synced in main.css.
      if (picturesShown) {
        document.getElementById('left-nav').style.display = 'none';
        document.getElementById('bottom-left').style.left = '40px';
        btnTogglePictures.style.left = '0';
        btnTogglePictures.style.width = '192px';
      } else {
        document.getElementById('left-nav').style.display = 'block';
        document.getElementById('bottom-left').style.left = '240px';
        btnTogglePictures.style.left = '162px';
        btnTogglePictures.style.width = '30px';
      }
      picturesShown = !picturesShown;
      this.innerHTML = picturesShown ? '-' : 'Show NASA pictures &#9660;';
    };
  }

  function loadTimestep(timestep) {
    // Details setup.
    document.getElementById('mapped-by').innerHTML = timestep.mappedBy;
    document.getElementById('mapped-when').innerHTML =
      (isNaN(parseInt(timestep.date[0])) ? 'on' : 'in') + ' ' + timestep.date;
    document.getElementById('credit').innerHTML = timestep.desc;

    // Sphere setup.
    var oldRotation = rotation;
    if (sphere) {
      oldRotation = sphere.rotation.y;
      sphereAndPoints.remove(sphere);
    }
    if (timestep.lowResPath) {
      var im = new Image();
      var loaded = false;
      im.onload = function() {
        loaded = true;
        sphere.material.map =
          THREE.ImageUtils.loadTexture('images/' + timestep.path);
        sphere.material.needsUpdate = true;
      };
      im.src = 'images/' + timestep.path;
      if (!loaded) {
        sphere = createSphere(timestep.lowResPath, radius, segments);
      }
    } else {
      sphere = createSphere(timestep.path, radius, segments);
    }
    if (mapIndex == maps.length) {
      mapIndex = 0;
    }
    sphere.rotation.y = oldRotation;
    sphereAndPoints.add(sphere);
  }

  function step(forwards) {
    if (forwards) {
      mapIndex++;
    } else {
      mapIndex--;
    }

    mapIndex = Math.min(maps.length - 1, mapIndex);
    mapIndex = Math.max(0, mapIndex);

    document.getElementById('jump-to').value = mapIndex + '';

    var timestep = maps[mapIndex];
    loadTimestep(timestep);

    if (mapIndex == maps.length - 1) {
      btnNextElt.classList.add('inactive');
      mapIndex = maps.length - 1;
    } else {
      btnNextElt.classList.remove('inactive');
    }

    if (mapIndex == 0) {
      btnPrevElt.classList.add('inactive');
      mapIndex = 0;
    } else {
      btnPrevElt.classList.remove('inactive');
    }

    clearSelection();   // Sometimes part of the page can be selected on fast click.
  }

  function getCurrentJED() {
    return (new Date().getTime() / 86400.0) + 2440587.5;
  }

  function isMobile() {
    // For our intents and purposes, mobile is defined by window size.
    return window.innerWidth <= 800 && window.innerHeight <= 600;
  }
}());
