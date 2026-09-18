const canvas = document.getElementById("game");
const gl = canvas.getContext("webgl", { antialias: false });

if (!gl) {
  document.getElementById("status").textContent = "WebGL is not supported in this browser.";
  throw new Error("WebGL not supported");
}

const vertexSource = `
attribute vec3 aPosition;
uniform mat4 uMVP;
uniform vec3 uColor;
varying vec3 vColor;
void main() {
  gl_Position = uMVP * vec4(aPosition, 1.0);
  vColor = uColor;
}`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}`;

function shader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
gl.useProgram(program);

const cubeVertices = new Float32Array([
  -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1,
  -1,-1, 1, 1,-1, 1, 1,1, 1, -1,1, 1
]);
const cubeIndices = new Uint16Array([
  0,1,2, 0,2,3, 4,6,5, 4,7,6,
  0,4,5, 0,5,1, 3,2,6, 3,6,7,
  1,5,6, 1,6,2, 0,3,7, 0,7,4
]);

const vb = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const ib = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

const aPosition = gl.getAttribLocation(program, "aPosition");
const uMVP = gl.getUniformLocation(program, "uMVP");
const uColor = gl.getUniformLocation(program, "uColor");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
gl.enable(gl.DEPTH_TEST);

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return [
    f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1,
    0,0,(2*far*near)*nf,0
  ];
}
function multiply(a,b) {
  const o = new Array(16);
  for (let c=0;c<4;c++) for (let r=0;r<4;r++)
    o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function lookAt(eye, target, up=[0,1,0]) {
  let z = [eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]];
  let zl = Math.hypot(...z); z=z.map(v=>v/zl);
  let x = [up[1]*z[2]-up[2]*z[1],up[2]*z[0]-up[0]*z[2],up[0]*z[1]-up[1]*z[0]];
  let xl = Math.hypot(...x); x=x.map(v=>v/xl);
  let y = [z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return [
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
    -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
    -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1
  ];
}
function model(x,y,z,sx,sy,sz) {
  return [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, x,y,z,1];
}

function drawCube(x,y,z,sx,sy,sz,color, vp) {
  gl.uniformMatrix4fv(uMVP,false,new Float32Array(multiply(vp,model(x,y,z,sx,sy,sz))));
  gl.uniform3fv(uColor,new Float32Array(color));
  gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0);
}

const buildings=[];
const colors=[
  [0.45,0.36,0.30],[0.32,0.45,0.55],[0.55,0.43,0.30],
  [0.42,0.42,0.42],[0.48,0.35,0.48]
];

for(let x=-35;x<=35;x+=10){
  for(let z=-35;z<=35;z+=10){
    if(x%20===0 || z%20===0 || Math.random()<0.2) continue;
    buildings.push({x,z,h:2+Math.random()*5,c:colors[Math.floor(Math.random()*colors.length)]});
  }
}

const player={x:0,z:5};
const keys={};
addEventListener("keydown",e=>keys[e.key.toLowerCase()]=true);
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

let timeLeft=60,score=0,disaster=null,disasterTimer=3,gameOver=false;
const timerEl=document.getElementById("timer");
const scoreEl=document.getElementById("score");
const statusEl=document.getElementById("status");

function startDisaster(){
  disaster={x:(Math.random()-0.5)*70,z:(Math.random()-0.5)*70,r:2,active:false};
  statusEl.textContent="⚠️ METEOR INCOMING!";
  setTimeout(()=>{
    if(gameOver||!disaster)return;
    disaster.active=true; disaster.r=7;
    statusEl.textContent="💥 IMPACT! RUN!";
    setTimeout(()=>{ disaster=null; if(!gameOver)statusEl.textContent="☀️ Clear... for now."; },1000);
  },1200);
}

function endGame(msg){gameOver=true;statusEl.textContent=msg+" Press R to restart.";}
addEventListener("keydown",e=>{if(e.key.toLowerCase()==="r"&&gameOver)location.reload();});

function resize(){
  canvas.width=innerWidth;
  canvas.height=innerHeight;
  gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener("resize",resize); resize();

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.05); last=now;

  if(!gameOver){
    const speed=8*dt;
    if(keys.w||keys.arrowup)player.z-=speed;
    if(keys.s||keys.arrowdown)player.z+=speed;
    if(keys.a||keys.arrowleft)player.x-=speed;
    if(keys.d||keys.arrowright)player.x+=speed;
    player.x=Math.max(-47,Math.min(47,player.x));
    player.z=Math.max(-47,Math.min(47,player.z));

    timeLeft-=dt;
    timerEl.textContent=Math.max(0,Math.ceil(timeLeft));
    if(timeLeft<=0){score+=100;scoreEl.textContent=score;endGame("🏆 YOU SURVIVED!");}

    disasterTimer-=dt;
    if(disasterTimer<=0&&!disaster){startDisaster();disasterTimer=12;}

    if(disaster){
      const d=Math.hypot(player.x-disaster.x,player.z-disaster.z);
      if(disaster.active&&d<disaster.r)endGame("💥 You got caught!");
    }
  }

  gl.clearColor(0.05,0.12,0.18,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  const eye=[player.x,10,player.z+14];
  const target=[player.x,0,player.z-2];
  const vp=multiply(perspective(Math.PI/3,canvas.width/canvas.height,0.1,150),lookAt(eye,target));

  // Ground
  drawCube(0,-0.6,0,50,0.5,50,[0.18,0.38,0.16],vp);

  // Roads
  for(let x=-40;x<=40;x+=20)drawCube(x,-0.02,0,3.5,0.08,50,[0.12,0.12,0.13],vp);
  for(let z=-40;z<=40;z+=20)drawCube(0,0,z,50,0.08,3.5,[0.12,0.12,0.13],vp);

  for(const b of buildings)drawCube(b.x,b.h,b.z,3,b.h,3,b.c,vp);

  // Player
  drawCube(player.x,1,player.z,0.55,1,0.55,[0.1,0.35,1],vp);

  // Meteor warning / impact
  if(disaster){
    drawCube(disaster.x,0.15,disaster.z,disaster.active?7:2,0.12,disaster.active?7:2,
      disaster.active?[1,0.08,0.03]:[1,0.65,0.05],vp);
    if(disaster.active)drawCube(disaster.x,4,disaster.z,1.5,1.5,1.5,[0.2,0.08,0.03],vp);
  }

  statusEl.textContent = gameOver ? statusEl.textContent : (disaster ? statusEl.textContent : "🌆 Survive the city!");
}
requestAnimationFrame(frame);