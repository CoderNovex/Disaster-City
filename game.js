import * as THREE from "https://unpkg.com/three@0.149.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.149.0/examples/jsm/loaders/GLTFLoader.js";

const canvas=document.getElementById("game");
const minimap=document.getElementById("minimap"), mapCtx=minimap.getContext("2d");
const timerEl=document.getElementById("timer"),healthEl=document.getElementById("health"),hungerEl=document.getElementById("hunger"),thirstEl=document.getElementById("thirst"),scoreEl=document.getElementById("score"),statusEl=document.getElementById("status");

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b120d);
scene.fog=new THREE.Fog(0x0b120d,65,120);

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,140);
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"low-power",failIfMajorPerformanceCaveat:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd4c0,0x263020,1.7));
const sun=new THREE.DirectionalLight(0xffffff,1.2);sun.position.set(30,50,20);scene.add(sun);

const MAP_MIN=-45,MAP_MAX=45;
const player={x:0,z:0};
const keys={};
let yaw=0,pitch=0,targetYaw=0,targetPitch=0,locked=false;
let hunger=100,thirst=100,health=100,survival=120,score=0,gameOver=false,message="Explore the city and find supplies!",messageTimer=3;

addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="r"&&gameOver)location.reload()});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false});
canvas.addEventListener("click",()=>canvas.requestPointerLock?.());
document.addEventListener("pointerlockchange",()=>locked=document.pointerLockElement===canvas);
addEventListener("mousemove",e=>{if(!locked)return;targetYaw-=e.movementX*.0028;targetPitch-=e.movementY*.0022;targetPitch=Math.max(-.5,Math.min(.65,targetPitch));carHeading-=e.movementX*.0007});

const loader=new GLTFLoader();
const assetBaseRoad="./assets/kenney-city-kit-roads/";
const assetBaseCar="./assets/kenney-car-kit/";
const modelCache=new Map();
async function loadModel(url){
  if(modelCache.has(url))return modelCache.get(url).clone(true);
  const gltf=await loader.loadAsync(url);
  modelCache.set(url,gltf.scene);
  return gltf.scene.clone(true);
}
function placeModel(model,x,y,z,scale=1,rot=0){
  model.position.set(x,y,z);model.rotation.y=rot;model.scale.setScalar(scale);
  model.traverse(o=>{if(o.isMesh){o.frustumCulled=true;o.castShadow=false;o.receiveShadow=false}});
  scene.add(model);return model;
}

const obstacles=[];
function addBuilding(x,z,w,d,h){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:0x514b40}));
  m.position.set(x,h/2,z);scene.add(m);obstacles.push({x,z,r:Math.max(w,d)*.52});
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.25,.18,d+.25),new THREE.MeshLambertMaterial({color:0x292720}));
  roof.position.set(x,h+.09,z);scene.add(roof);
  for(let fy=1;fy<h;fy+=1.15){
    for(const side of[-1,1]){const strip=new THREE.Mesh(new THREE.BoxGeometry(w*.72,.16,.035),new THREE.MeshBasicMaterial({color:0x1d5360}));strip.position.set(x,fy,z+side*(d/2+.02));scene.add(strip)}
  }
}
addBuilding(-25,-20,9,9,7);addBuilding(23,-20,10,8,9);addBuilding(-24,22,8,10,5);addBuilding(24,23,11,9,8);addBuilding(-7,33,9,8,6);addBuilding(10,-32,10,9,8);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshLambertMaterial({color:0x27452a}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const roadMat=new THREE.MeshLambertMaterial({color:0x363737});
function road(x,z,w,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.06,d),roadMat);m.position.set(x,.03,z);scene.add(m)}
road(0,0,12,90);road(0,0,90,12);

const tower=new THREE.Group();tower.position.set(0,16,0);scene.add(tower);
for(let i=0;i<7;i++){const f=new THREE.Mesh(new THREE.BoxGeometry(7-i*.25,.65,7-i*.25),new THREE.MeshLambertMaterial({color:i%2?0x403b34:0x615748}));f.position.set((Math.random()-.5)*.8,i*.8,(Math.random()-.5)*.8);tower.add(f)}
obstacles.push({x:0,z:16,r:4});

for(let x=-40;x<=40;x+=10){road(x,0,2.2,5);road(0,x,5,2.2)}

const items=[];
function addItem(x,z,type){const color=type==="food"?0xffa31a:0x1c9fff;const m=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshLambertMaterial({color}));m.position.set(x,.6,z);scene.add(m);items.push({x,z,type,taken:false,mesh:m})}
addItem(-32,-8,"food");addItem(30,5,"food");addItem(-5,38,"food");addItem(30,-30,"water");addItem(-32,28,"water");addItem(8,-20,"water");addItem(7,16,"food");

function collides(x,z){for(const o of obstacles)if(Math.hypot(x-o.x,z-o.z)<o.r+.8)return true;return false}
function move(dx,dz){const nx=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.x+dx)),nz=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.z+dz));if(!collides(nx,player.z))player.x=nx;if(!collides(player.x,nz))player.z=nz}
function collect(){for(const i of items)if(!i.taken&&Math.hypot(player.x-i.x,player.z-i.z)<1.8){i.taken=true;i.mesh.visible=false;if(i.type==="food"){hunger=Math.min(100,hunger+35);message="🍎 Food collected!"}else{thirst=Math.min(100,thirst+40);message="💧 Water collected!"}score+=25;messageTimer=2}}
function endGame(m){gameOver=true;statusEl.textContent=m+" Press R to restart."}

const playerMarker=new THREE.Mesh(new THREE.CapsuleGeometry(.22,.7,4,8),new THREE.MeshLambertMaterial({color:0x35a7ff}));
playerMarker.position.set(0,1.05,0);scene.add(playerMarker); playerMarker.visible=false;


// --- Third-person car system ---
const carDefs=[
  {name:"Sedan",file:"sedan.glb",speed:11,scale:.9},
  {name:"Sports Sedan",file:"sedan-sports.glb",speed:14,scale:.9},
  {name:"SUV",file:"suv.glb",speed:10,scale:.9},
  {name:"Luxury SUV",file:"suv-luxury.glb",speed:11,scale:.9},
  {name:"Taxi",file:"taxi.glb",speed:12,scale:.9},
  {name:"Ambulance",file:"ambulance.glb",speed:9,scale:.82},
  {name:"Police",file:"police.glb",speed:13,scale:.82},
  {name:"Fire Truck",file:"firetruck.glb",speed:8,scale:.82},
  {name:"Van",file:"van.glb",speed:10,scale:.9},
  {name:"Delivery",file:"delivery.glb",speed:10,scale:.85},
  {name:"Truck",file:"truck.glb",speed:8,scale:.82},
  {name:"Flat Truck",file:"truck-flat.glb",speed:8,scale:.82},
  {name:"Race Car",file:"race.glb",speed:16,scale:.9},
  {name:"Future Racer",file:"race-future.glb",speed:17,scale:.9},
  {name:"Tractor",file:"tractor.glb",speed:6,scale:.82}
];
let selectedCar=0,playerCar=null,carHeading=0;

const carMenu=document.createElement("div");
carMenu.id="carMenu";
carMenu.innerHTML='<div class="carMenuTitle">🚗 CHOOSE YOUR RIDE</div><div class="carButtons"></div><div class="carHint">W = forward • S = reverse • A/D = steer • C = change vehicle</div>';
document.body.appendChild(carMenu);
const carButtons=carMenu.querySelector(".carButtons");

function makeCarButton(i){
  const b=document.createElement("button");
  b.textContent=carDefs[i].name;
  b.addEventListener("click",()=>selectCar(i));
  carButtons.appendChild(b);
}
carDefs.forEach((_,i)=>makeCarButton(i));

function setCarMenu(open){
  carMenu.style.display=open?"flex":"none";\n  if(open) document.exitPointerLock?.();
}
setCarMenu(true);

async function selectCar(i){
  selectedCar=i;
  document.querySelectorAll("#carMenu button").forEach((b,n)=>b.classList.toggle("selected",n===i));
  if(playerCar)scene.remove(playerCar);
  try{
    playerCar=await loadModel(assetBaseCar+carDefs[i].file);
    playerCar.visible=true;
    placeModel(playerCar,player.x,.02,player.z,carDefs[i].scale,carHeading);
    statusEl.textContent="🚗 "+carDefs[i].name+" selected. Explore the city!";
    setCarMenu(false);
  }catch(e){
    statusEl.textContent="⚠️ Could not load "+carDefs[i].name+" model.";
    console.warn("Car load failed",e);
  }
}

async function loadCityModels(){
  statusEl.textContent="Loading Kenney roads & cars...";

  // The uploaded Kenney City Kit Roads pack is imported into the repo by the
  // GitHub Actions workflow, so these are same-site assets rather than remote road files.
  const roadPieces=[];
  for(let p=-40;p<=40;p+=10) roadPieces.push(["road-straight.glb",0,p,1,Math.PI/2]);
  for(let p=-40;p<=40;p+=10) roadPieces.push(["road-straight.glb",p,0,1,0]);
  roadPieces.push(["road-crossing.glb",0,0,1,0]);
  roadPieces.push(["road-bend.glb",-10,-10,1,0]);
  roadPieces.push(["road-bend.glb",10,-10,1,Math.PI/2]);
  roadPieces.push(["road-bend.glb",-10,10,1,-Math.PI/2]);
  roadPieces.push(["road-bend.glb",10,10,1,Math.PI]);

  for(const [file,x,z,scale,rot] of roadPieces){
    try{
      const m=await loadModel(assetBaseRoad+file);
      placeModel(m,x,.075,z,scale*1.18,rot);
    }catch(e){ console.warn("Road model failed:",file,e); }
  }

  const props=[
    ["road-sign-stop.glb",-6,.0,-12,1,0],
    ["construction-cone.glb",5,0,7,.8,0],
    ["light-square.glb",-14,0,12,1,0],
    ["construction-barrier.glb",14,0,-12,1,0],
    ["light-curved-cross.glb",-14,0,-12,.75,0]
  ];
  for(const [file,x,y,z,scale,rot] of props){
    try{
      const m=await loadModel(assetBaseRoad+file);
      placeModel(m,x,y,z,scale,rot);
    }catch(e){ console.warn("Prop model failed:",file,e); }
  }

  // All vehicle files are available in the imported Kenney car-kit folder.
  // The player chooses one instead of spawning every model on top of each other.
  statusEl.textContent="🏙️ Roads loaded! Choose your ride.";
  setCarMenu(true);
}
loadCityModels();

let last=performance.now();
function updateHud(){timerEl.textContent=Math.max(0,Math.ceil(survival));healthEl.textContent=Math.ceil(health);hungerEl.textContent=Math.ceil(hunger);thirstEl.textContent=Math.ceil(thirst);scoreEl.textContent=score}
function drawMinimap(){
  const c=mapCtx,w=minimap.width,h=minimap.height,sc=w/90;
  c.clearRect(0,0,w,h);c.fillStyle="#18271b";c.fillRect(0,0,w,h);
  c.fillStyle="#3c3d3d";c.fillRect(w/2-6*sc,0,12*sc,h);c.fillRect(0,h/2-6*sc,w,12*sc);
  c.fillStyle="#514b40";for(const o of obstacles)c.fillRect((o.x+45)*sc-4,(o.z+45)*sc-4,8,8);
  c.fillStyle="#f5a623";for(const i of items)if(!i.taken){c.beginPath();c.arc((i.x+45)*sc,(i.z+45)*sc,3,0,7);c.fill()}
  c.fillStyle="#ef4938";c.beginPath();c.arc((tower.position.x+5+45)*sc,(tower.position.z+4+45)*sc,4,0,7);c.fill();
  c.fillStyle="#35a7ff";c.beginPath();c.arc((player.x+45)*sc,(player.z+45)*sc,4,0,7);c.fill();
}
function animate(now){
  requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
  if(!gameOver){
    yaw+=(targetYaw-yaw)*.35;pitch+=(targetPitch-pitch)*.35;
    const speed=carDefs[selectedCar].speed*dt;let dx=0,dz=0;
    if(keys.a||keys.arrowleft)carHeading+=2.2*dt;
    if(keys.d||keys.arrowright)carHeading-=2.2*dt;
    if(keys.w||keys.arrowup){dx-=Math.sin(carHeading)*speed;dz-=Math.cos(carHeading)*speed}
    if(keys.s||keys.arrowdown){dx+=Math.sin(carHeading)*speed*.65;dz+=Math.cos(carHeading)*speed*.65}
    if(dx||dz){const l=Math.hypot(dx,dz);if(l>speed){dx=dx/l*speed;dz=dz/l*speed}move(dx,dz)}
    if(playerCar){playerCar.position.set(player.x,.02,player.z);playerCar.rotation.y=carHeading;} collect();
    survival-=dt;hunger=Math.max(0,hunger-dt*1.7);thirst=Math.max(0,thirst-dt*2.2);if(hunger<=0||thirst<=0)health=Math.max(0,health-dt*5);
    if(health<=0)endGame("☠️ Survival failed.");if(survival<=0){score+=200;endGame("🏆 YOU SURVIVED!")}
    updateHud();if(messageTimer>0){messageTimer-=dt;statusEl.textContent=message}
  }
  const camDistance=8,camHeight=4.2;
  const behindX=player.x+Math.sin(carHeading)*camDistance;
  const behindZ=player.z+Math.cos(carHeading)*camDistance;
  camera.position.lerp(new THREE.Vector3(behindX,camHeight,behindZ),.12);
  const lookAt=new THREE.Vector3(player.x,1.1,player.z);
  camera.lookAt(lookAt);
  renderer.render(scene,camera);drawMinimap();
}
requestAnimationFrame(animate);

const mapOverlay=document.createElement("div");mapOverlay.id="fullMap";
mapOverlay.innerHTML='<div class="mapTitle">CITY MAP <span>M to close • Drag to pan • Wheel to zoom</span></div><canvas id="bigMap" width="1100" height="760"></canvas><div class="mapLegend">🔵 You &nbsp; 🟠 Supplies &nbsp; 🔴 Objective &nbsp; ▪ Buildings &nbsp; 🚗 Vehicles</div>';
document.body.appendChild(mapOverlay);
const bigMap=document.getElementById("bigMap"),bigCtx=bigMap.getContext("2d");let mapOpen=false,mapZoom=1,mapPanX=0,mapPanY=0,drag=false,lx=0,ly=0;
function drawBigMap(){
  const c=bigCtx,w=bigMap.width,h=bigMap.height,sc=Math.min((w-100)/90,(h-120)/90)*mapZoom,cx=w/2+mapPanX,cy=h/2+mapPanY,X=x=>cx+x*sc,Y=z=>cy+z*sc;
  c.fillStyle="#142018";c.fillRect(0,0,w,h);c.save();c.rect(25,55,w-50,h-85);c.clip();
  c.fillStyle="#203522";c.fillRect(X(-45),Y(-45),90*sc,90*sc);c.fillStyle="#3b3c3b";c.fillRect(X(-6),Y(-45),12*sc,90*sc);c.fillRect(X(-45),Y(-6),90*sc,12*sc);
  c.fillStyle="#514b40";for(const o of obstacles)c.fillRect(X(o.x-3),Y(o.z-3),6*sc,6*sc);
  c.fillStyle="#f5a623";for(const i of items)if(!i.taken){c.beginPath();c.arc(X(i.x),Y(i.z),Math.max(4,6*mapZoom),0,7);c.fill()}
  c.fillStyle="#ef4938";c.beginPath();c.arc(X(5),Y(20),8,0,7);c.fill();
  c.fillStyle="#35a7ff";c.beginPath();c.arc(X(player.x),Y(player.z),9,0,7);c.fill();c.restore();
  c.fillStyle="#fff";c.font="bold 14px Arial";c.fillText("ZOOM "+Math.round(mapZoom*100)+"%",35,h-38);c.fillText("CITY 90 × 90",35,h-18);
}
bigMap.addEventListener("wheel",e=>{if(!mapOpen)return;e.preventDefault();mapZoom=Math.max(1,Math.min(4,mapZoom*(e.deltaY<0?1.15:.87)));drawBigMap()},{passive:false});
bigMap.addEventListener("pointerdown",e=>{drag=true;lx=e.clientX;ly=e.clientY;bigMap.setPointerCapture(e.pointerId)});
bigMap.addEventListener("pointermove",e=>{if(!drag)return;mapPanX+=e.clientX-lx;mapPanY+=e.clientY-ly;lx=e.clientX;ly=e.clientY;drawBigMap()});
bigMap.addEventListener("pointerup",()=>drag=false);
addEventListener("keydown",e=>{if(e.key.toLowerCase()==="c"&&!gameOver){setCarMenu(true);return}if(e.key.toLowerCase()==="m"){mapOpen=!mapOpen;mapOverlay.style.display=mapOpen?"flex":"none";if(mapOpen){mapZoom=1;mapPanX=0;mapPanY=0;drawBigMap();document.exitPointerLock?.()}}});
setInterval(()=>{if(mapOpen)drawBigMap()},100);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false)});
