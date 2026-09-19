const canvas = document.getElementById("game");
const gl = canvas.getContext("webgl", { antialias:false, powerPreference:"low-power" });
if(!gl){ document.getElementById("status").textContent="WebGL is not supported."; throw new Error("WebGL not supported"); }

const vertexSource=`
attribute vec3 aPosition;
uniform mat4 uMVP;
uniform vec3 uColor;
varying vec3 vColor;
void main(){gl_Position=uMVP*vec4(aPosition,1.0);vColor=uColor;}`;
const fragmentSource=`
precision mediump float;
varying vec3 vColor;
void main(){gl_FragColor=vec4(vColor,1.0);}`;
function shader(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);gl.useProgram(program);
const vertices=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]);
const indices=new Uint16Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,1,5,6,1,6,2,0,3,7,0,7,4]);
const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
const aPosition=gl.getAttribLocation(program,"aPosition"),uMVP=gl.getUniformLocation(program,"uMVP"),uColor=gl.getUniformLocation(program,"uColor");
gl.enableVertexAttribArray(aPosition);gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,0,0);gl.enable(gl.DEPTH_TEST);
function perspective(f,a,n,far){const q=1/Math.tan(f/2),nf=1/(n-far);return[q/a,0,0,0,0,q,0,0,0,0,(far+n)*nf,-1,0,0,2*far*n*nf,0]}
function multiply(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function lookAt(e,t){let z=[e[0]-t[0],e[1]-t[1],e[2]-t[2]],zl=Math.hypot(...z);z=z.map(v=>v/zl);let x=[z[2],0,-z[0]],xl=Math.hypot(...x);x=x.map(v=>v/xl);let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]),-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]),-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]),1]}
function model(x,y,z,sx,sy,sz){return[sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]}
function cube(x,y,z,sx,sy,sz,color,vp){gl.uniformMatrix4fv(uMVP,false,new Float32Array(multiply(vp,model(x,y,z,sx,sy,sz))));gl.uniform3fv(uColor,new Float32Array(color));gl.drawElements(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0)}

const MAP_MIN=-45,MAP_MAX=45,player={x:0,z:0},survivor={skin:[.78,.52,.30],shirt:[.10,.20,.28],pants:[.08,.09,.10]},keys={};
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false});

const obstacles=[],items=[],buildings=[{x:-22,z:-18,h:3},{x:22,z:-18,h:4},{x:-22,z:20,h:2.5},{x:24,z:22,h:3.5},{x:-5,z:32,h:2.5},{x:8,z:-32,h:3}];
for(const b of buildings)obstacles.push({x:b.x,z:b.z,r:4});
const tower={x:0,z:16},towerFloors=[];let ty=0,tx=0,tz=0;
for(let i=0;i<9;i++){towerFloors.push({x:tower.x+tx,y:ty+.55,z:tower.z+tz,sx:4.5-i*.075,sy:.55,sz:4.5-i*.075,color:i%2===0?[.29,.25,.21]:[.20,.19,.17]});ty+=.65+Math.random()*.18;tx+=(Math.random()-.45)*.42*(1+i/9);tz+=(Math.random()-.45)*.42*(1+i/9)}
for(const f of towerFloors)obstacles.push({x:f.x,z:f.z,r:3.5});
const rubble=[];for(let i=0;i<42;i++){const a=Math.random()*Math.PI*2,d=3+Math.pow(Math.random(),.65)*8,s=.18+Math.random()*.65;rubble.push({x:tower.x+Math.cos(a)*d,y:s*.45,z:tower.z+Math.sin(a)*d,sx:s*(.8+Math.random()*1.2),sy:s*(.5+Math.random()*.8),sz:s*(.8+Math.random()*1.2),color:Math.random()<.65?[.25,.22,.19]:[.34,.31,.26]})}
function addItem(x,z,type){items.push({x,z,type,taken:false})} addItem(-32,-8,"food");addItem(30,5,"food");addItem(-5,38,"food");addItem(30,-30,"water");addItem(-32,28,"water");addItem(8,-20,"water");addItem(7,16,"food");
let hunger=100,thirst=100,health=100,survival=120,score=0,gameOver=false,message="Explore the city and find the broken building!",messageTimer=3;
const timerEl=document.getElementById("timer"),healthEl=document.getElementById("health"),hungerEl=document.getElementById("hunger"),thirstEl=document.getElementById("thirst"),scoreEl=document.getElementById("score"),statusEl=document.getElementById("status");
function collides(x,z){for(const o of obstacles)if(Math.hypot(x-o.x,z-o.z)<o.r+.7)return true;return false}
function move(dx,dz){const nx=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.x+dx)),nz=Math.max(MAP_MIN+1,Math.min(MAP_MAX-1,player.z+dz));if(!collides(nx,player.z))player.x=nx;if(!collides(player.x,nz))player.z=nz}
function collectItems(){for(const item of items)if(!item.taken&&Math.hypot(player.x-item.x,player.z-item.z)<2){item.taken=true;if(item.type==="food"){hunger=Math.min(100,hunger+35);score+=25;message="🍎 Food collected! Hunger restored."}else{thirst=Math.min(100,thirst+40);score+=25;message="💧 Water collected! Thirst restored."}messageTimer=2}}
function endGame(m){gameOver=true;statusEl.textContent=m+" Press R to restart."}
addEventListener("keydown",e=>{if(e.key.toLowerCase()==="r"&&gameOver)location.reload()});

function resize(){const scale=Math.min(1,960/innerWidth);canvas.width=Math.max(480,Math.floor(innerWidth*scale));canvas.height=Math.max(360,Math.floor(innerHeight*scale));canvas.style.width="100%";canvas.style.height="100%";gl.viewport(0,0,canvas.width,canvas.height)} addEventListener("resize",resize);resize();

let yaw=0,pitch=-0.20,targetYaw=0,targetPitch=-0.20,cameraDistance=10,dragging=false,lastMouseX=0,lastMouseY=0;
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("mousedown",e=>{if(e.button===0||e.button===2){dragging=true;lastMouseX=e.clientX;lastMouseY=e.clientY}});
addEventListener("mouseup",()=>dragging=false);
addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.clientX-lastMouseX,dy=e.clientY-lastMouseY;lastMouseX=e.clientX;lastMouseY=e.clientY;targetYaw-=dx*.006;targetPitch-=dy*.004;targetPitch=Math.max(-1.05,Math.min(.35,targetPitch))});
canvas.addEventListener("wheel",e=>{e.preventDefault();cameraDistance+=e.deltaY*.01;cameraDistance=Math.max(5,Math.min(16,cameraDistance))},{passive:false});
function camera(){yaw+=(targetYaw-yaw)*.16;pitch+=(targetPitch-pitch)*.16;const h=Math.cos(pitch),v=Math.sin(pitch);const eye=[player.x+Math.sin(yaw)*h*cameraDistance,5.2+v*cameraDistance,player.z+Math.cos(yaw)*h*cameraDistance];const target=[player.x,1.3,player.z];return lookAt(eye,target)}

let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;
if(!gameOver){const speed=7*dt;let dx=0,dz=0;if(keys.w||keys.arrowup)dz-=speed;if(keys.s||keys.arrowdown)dz+=speed;if(keys.a||keys.arrowleft)dx-=speed;if(keys.d||keys.arrowright)dx+=speed;if(dx||dz)move(dx,dz);collectItems();survival-=dt;hunger=Math.max(0,hunger-dt*1.7);thirst=Math.max(0,thirst-dt*2.2);if(hunger<=0||thirst<=0)health=Math.max(0,health-dt*5);if(health<=0)endGame("☠️ Survival failed.");if(survival<=0){score+=200;endGame("🏆 YOU SURVIVED!")}timerEl.textContent=Math.max(0,Math.ceil(survival));healthEl.textContent=Math.ceil(health);hungerEl.textContent=Math.ceil(hunger);thirstEl.textContent=Math.ceil(thirst);scoreEl.textContent=score;if(messageTimer>0){messageTimer-=dt;statusEl.textContent=message}else statusEl.textContent="🏚️ Explore the map, collect supplies, and reach the broken building."}
gl.clearColor(.06,.11,.08,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
const vp=multiply(perspective(Math.PI/3,canvas.width/canvas.height,.1,130),camera());
cube(0,-.55,0,47,.45,47,[.16,.30,.12],vp);cube(0,-.03,0,3,.08,45,[.12,.12,.12],vp);cube(0,-.03,0,45,.08,3,[.12,.12,.12],vp);
const wall=[.07,.10,.08];cube(0,2.5,MAP_MIN,46,2.5,.5,wall,vp);cube(0,2.5,MAP_MAX,46,2.5,.5,wall,vp);cube(MAP_MIN,2.5,0,.5,2.5,46,wall,vp);cube(MAP_MAX,2.5,0,.5,2.5,46,wall,vp);
for(const b of buildings)cube(b.x,b.h,b.z,3,b.h,3,[.30,.28,.23],vp);for(const f of towerFloors)cube(f.x,f.y,f.z,f.sx,f.sy,f.sz,f.color,vp);for(const r of rubble)cube(r.x,r.y,r.z,r.sx,r.sy,r.sz,r.color,vp);
const pulse=.65+Math.sin(now*.01)*.2;cube(tower.x+4.5,.55,tower.z+4.5,.35,pulse,.35,[.95,.25,.04],vp);cube(tower.x+5.5,.45,tower.z+3.8,.25,pulse*.8,.25,[1,.55,.05],vp);
for(const item of items)if(!item.taken)cube(item.x,.8,item.z,.65,.8,.65,item.type==="food"?[.95,.55,.08]:[.08,.55,.95],vp);
const bob=Math.sin(now*.012)*.04,walking=(keys.w||keys.a||keys.s||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright),step=walking?Math.sin(now*.025)*.12:0;
cube(player.x-.22,.62+step,player.z,.18,.62,.22,survivor.pants,vp);cube(player.x+.22,.62-step,player.z,.18,.62,.22,survivor.pants,vp);cube(player.x-.22,.12+step,player.z-.12,.22,.14,.32,[.03,.03,.03],vp);cube(player.x+.22,.12-step,player.z-.12,.22,.14,.32,[.03,.03,.03],vp);
cube(player.x,1.55+bob,player.z,.62,.72,.34,survivor.shirt,vp);cube(player.x,1.55+bob,player.z+.34,.42,.58,.18,[.18,.12,.07],vp);cube(player.x-.48,1.50+bob,player.z,.14,.58,.18,survivor.shirt,vp);cube(player.x+.48,1.50+bob,player.z,.14,.58,.18,survivor.shirt,vp);cube(player.x-.48,1.10+bob,player.z,.16,.16,.20,survivor.skin,vp);cube(player.x+.48,1.10+bob,player.z,.16,.16,.20,survivor.skin,vp);cube(player.x,2.10+bob,player.z,.22,.18,.22,survivor.skin,vp);cube(player.x,2.48+bob,player.z,.42,.42,.42,survivor.skin,vp);cube(player.x,2.73+bob,player.z,.44,.12,.44,[.04,.025,.015],vp);cube(player.x,2.48+bob,player.z-.22,.28,.16,.04,[.12,.18,.20],vp)}
requestAnimationFrame(frame);