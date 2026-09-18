const canvas = document.getElementById("game");
const gl = canvas.getContext("webgl", { antialias: false, powerPreference: "low-power" });

if (!gl) {
  document.getElementById("status").textContent = "WebGL is not supported in this browser.";
  throw new Error("WebGL not supported");
}

const vertexSource = `
attribute vec3 aPosition;
uniform mat4 uMVP;
uniform vec3 uColor;
varying vec3 vColor;
void main(){ gl_Position=uMVP*vec4(aPosition,1.0); vColor=uColor; }`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
void main(){ gl_FragColor=vec4(vColor,1.0); }`;

function makeShader(type, source){
  const s=gl.createShader(type);
  gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const program=gl.createProgram();
gl.attachShader(program,makeShader(gl.VERTEX_SHADER,vertexSource));
gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,fragmentSource));
gl.linkProgram(program); gl.useProgram(program);

const vertices=new Float32Array([
 -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
 -1,-1, 1, 1,-1, 1, 1,1, 1, -1,1, 1
]);
const indices=new Uint16Array([
 0,1,2,0,2,3, 4,6,5,4,7,6,
 0,4,5,0,5,1, 3,2,6,3,6,7,
 1,5,6,1,6,2, 0,3,7,0,7,4
]);

const vb=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
const ib=gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);

const aPosition=gl.getAttribLocation(program,"aPosition");
const uMVP=gl.getUniformLocation(program,"uMVP");
const uColor=gl.getUniformLocation(program,"uColor");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,0,0);
gl.enable(gl.DEPTH_TEST);

function perspective(fov,aspect,near,far){
  const f=1/Math.tan(fov/2), nf=1/(near-far);
  return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
}
function multiply(a,b){
  const o=new Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++)
    o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function lookAt(eye,target){
  let z=[eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]];
  let zl=Math.hypot(z[0],z[1],z[2]); z=z.map(v=>v/zl);
  let x=[z[2],0,-z[0]];
  let xl=Math.hypot(x[0],x[1],x[2]); x=x.map(v=>v/xl);
  let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
   -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
   -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
   -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1];
}
function model(x,y,z,sx,sy,sz){
  return [sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1];
}
function cube(x,y,z,sx,sy,sz,color,vp){
  gl.uniformMatrix4fv(uMVP,false,new Float32Array(multiply(vp,model(x,y,z,sx,sy,sz))));
  gl.uniform3fv(uColor,new Float32Array(color));
  gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0);
}

const MAP_MIN=-45, MAP_MAX=45;
const player={x:0,z:0};
const keys={};
addEventListener("keydown",e=>keys[e.key.toLowerCase()]=true);
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

const obstacles=[];
const items=[];
const buildings=[
 {x:-22,z:-18,h:3},{x:22,z:-18,h:4},{x:-22,z:20,h:2.5},
 {x:24,z:22,h:3.5},{x:-5,z:32,h:2.5},{x:8,z:-32,h:3}
];
for(const b of buildings) obstacles.push({x:b.x,z:b.z,r:4});

function addItem(x,z,type){ items.push({x,z,type,taken:false}); }
addItem(-32,-8,"food"); addItem(30,5,"food"); addItem(-5,38,"food");
addItem(30,-30,"water"); addItem(-32,28,"water"); addItem(8,-20,"water");

let hunger=100, thirst=100, health=100, survival=120, score=0, gameOver=false;
let message="Explore, collect supplies, and survive!";
let messageTimer=0;

const timerEl=document.getElementById("timer");
const healthEl=document.getElementById("health");
const hungerEl=document.getElementById("hunger");
const thirstEl=document.getElementById("thirst");
const scoreEl=document.getElementById("score");
const statusEl=document.getElementById("status");

function collides(x,z){
  for(const o of obstacles) if(Math.hypot(x-o.x,z-o.z)<o.r+0.7) return true;
  return false;
}
function move(dx,dz){
  const nx=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.x+dx));
  const nz=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.z+dz));
  if(!collides(nx,player.z)) player.x=nx;
  if(!collides(player.x,nz)) player.z=nz;
}
function collectItems(){
  for(const item of items){
    if(item.taken) continue;
    if(Math.hypot(player.x-item.x,player.z-item.z)<2){
      item.taken=true;
      if(item.type==="food"){
        hunger=Math.min(100,hunger+35);
        score+=25;
        message="🍎 Food collected! Hunger restored.";
      } else {
        thirst=Math.min(100,thirst+40);
        score+=25;
        message="💧 Water collected! Thirst restored.";
      }
      messageTimer=2;
    }
  }
}
function endGame(msg){
  gameOver=true; statusEl.textContent=msg+" Press R to restart.";
}
addEventListener("keydown",e=>{ if(e.key.toLowerCase()==="r"&&gameOver) location.reload(); });

function resize(){
  const scale=Math.min(1,960/innerWidth);
  canvas.width=Math.max(480,Math.floor(innerWidth*scale));
  canvas.height=Math.max(360,Math.floor(innerHeight*scale));
  canvas.style.width="100%"; canvas.style.height="100%";
  gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener("resize",resize); resize();

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.05); last=now;

  if(!gameOver){
    const speed=7*dt;
    let dx=0,dz=0;
    if(keys.w||keys.arrowup) dz-=speed;
    if(keys.s||keys.arrowdown) dz+=speed;
    if(keys.a||keys.arrowleft) dx-=speed;
    if(keys.d||keys.arrowright) dx+=speed;
    if(dx||dz) move(dx,dz);

    collectItems();
    survival-=dt;
    hunger=Math.max(0,hunger-dt*1.7);
    thirst=Math.max(0,thirst-dt*2.2);
    if(hunger<=0||thirst<=0) health=Math.max(0,health-dt*5);
    if(health<=0) endGame("☠️ Survival failed.");
    if(survival<=0){ score+=200; endGame("🏆 YOU SURVIVED!"); }

    timerEl.textContent=Math.max(0,Math.ceil(survival));
    healthEl.textContent=Math.ceil(health);
    hungerEl.textContent=Math.ceil(hunger);
    thirstEl.textContent=Math.ceil(thirst);
    scoreEl.textContent=score;
    if(messageTimer>0){ messageTimer-=dt; statusEl.textContent=message; }
    else statusEl.textContent="🌲 Find food and water. Stay inside the boundary.";
  }

  gl.clearColor(0.06,0.11,0.08,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  const eye=[player.x,8,player.z+11];
  const target=[player.x,0,player.z-2];
  const vp=multiply(perspective(Math.PI/3,canvas.width/canvas.height,0.1,130),lookAt(eye,target));

  // Ground
  cube(0,-0.55,0,47,0.45,47,[0.16,0.30,0.12],vp);

  // Simple roads
  cube(0,-0.03,0,3,0.08,45,[0.12,0.12,0.12],vp);
  cube(0,-0.03,0,45,0.08,3,[0.12,0.12,0.12],vp);

  // Boundary walls
  const wall=[0.07,0.10,0.08];
  cube(0,2.5,MAP_MIN,46,2.5,0.5,wall,vp);
  cube(0,2.5,MAP_MAX,46,2.5,0.5,wall,vp);
  cube(MAP_MIN,2.5,0,0.5,2.5,46,wall,vp);
  cube(MAP_MAX,2.5,0,0.5,2.5,46,wall,vp);

  // Buildings
  for(const b of buildings) cube(b.x,b.h,b.z,3,b.h,3,[0.30,0.28,0.23],vp);

  // Supplies
  for(const item of items){
    if(item.taken) continue;
    const color=item.type==="food"?[0.95,0.55,0.08]:[0.08,0.55,0.95];
    cube(item.x,0.8,item.z,0.65,0.8,0.65,color,vp);
  }

  // Player
  cube(player.x,1,player.z,0.55,1,0.55,[0.85,0.85,0.2],vp);
}
requestAnimationFrame(frame);