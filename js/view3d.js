/* ===================================================================================
   NYC 2050 — the three-dimensional view.
   A camera over the world built by world3d.js. Instanced boxes for the fabric and the
   named structures, an indexed grid for the ground, ribbons for the roadway. The
   THROW panel drives world3d.trace(), which is the seam a physics engine replaces.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};
const q=id=>document.getElementById(id);
const {M4,invert,unproject,program,buffer,attrib,unitBox}=NYC.gl;

let gl=null, canvas=null, prog=null, mesh=null, line=null, bufs={}, ready=false;
let mode="use", show={roads:true,parks:true,ground:true,boxes:true};
let cam={tx:0,ty:0,tz:0,dist:2600,yaw:-0.62,pitch:0.72};
let raf=null, hooks={}, lastTrace=null, throwOrigin=null, anim=null, picking=false;

const VS_BOX=`#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm;
in vec3 iOff; in vec3 iScl; in vec3 iCol; in float iYaw;
uniform mat4 uVP; uniform vec3 uEye;
out vec3 vCol; out vec3 vNrm; out float vDist; out float vUp;
void main(){
  float c=cos(iYaw), s=sin(iYaw);
  vec3 p=aPos*iScl;
  vec3 r=vec3(p.x*c - p.z*s, p.y, p.x*s + p.z*c);
  vec3 w=r+iOff;
  vec3 n=vec3(aNrm.x*c - aNrm.z*s, aNrm.y, aNrm.x*s + aNrm.z*c);
  vCol=iCol; vNrm=n; vUp=aPos.y;
  vDist=length(w-uEye);
  gl_Position=uVP*vec4(w,1.0);
}`;
const FS_COMMON=`
  vec3 shade(vec3 col, vec3 n, float dist, float up){
    vec3 sun=normalize(vec3(0.42,0.78,0.46));
    float d=max(dot(normalize(n),sun),0.0);
    float amb=0.52+0.16*normalize(n).y;
    vec3 c=col*(amb+0.62*d);
    c*=mix(0.72,1.0,clamp(up,0.0,1.0));            // streets sit in their own shade
    float f=clamp((dist-2200.0)/9000.0,0.0,0.82);
    return mix(c, vec3(0.796,0.792,0.760), f);
  }`;
const FS_BOX=`#version 300 es
precision highp float;
in vec3 vCol; in vec3 vNrm; in float vDist; in float vUp;
out vec4 outColor;`+FS_COMMON+`
void main(){ outColor=vec4(shade(vCol,vNrm,vDist,vUp*0.6+0.4),1.0); }`;

const VS_MESH=`#version 300 es
precision highp float;
in vec3 aPos; in vec3 aCol;
uniform mat4 uVP; uniform vec3 uEye;
out vec3 vCol; out float vDist; out vec3 vW;
void main(){ vCol=aCol; vW=aPos; vDist=length(aPos-uEye); gl_Position=uVP*vec4(aPos,1.0); }`;
const FS_MESH=`#version 300 es
precision highp float;
in vec3 vCol; in float vDist; in vec3 vW;
out vec4 outColor;`+FS_COMMON+`
void main(){
  vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));
  if(n.y<0.0) n=-n;
  outColor=vec4(shade(vCol,n,vDist,1.0),1.0);
}`;
const VS_LINE=`#version 300 es
precision highp float;
in vec3 aPos; uniform mat4 uVP; uniform float uSize;
void main(){ gl_Position=uVP*vec4(aPos,1.0); gl_PointSize=uSize; }`;
const FS_LINE=`#version 300 es
precision highp float;
uniform vec4 uCol; out vec4 outColor;
void main(){ outColor=uCol; }`;

/* =================================================================================== */
function init(o){
  hooks=o||{};
  q("v3Close").onclick=close;
  q("v3Throw").onclick=doThrow;
  q("v3Pick").onclick=()=>{ picking=!picking;
    q("v3Pick").setAttribute("aria-pressed",picking);
    hooks.toast&&hooks.toast(picking?"Click the city to set the launch point":""); };
  [...document.querySelectorAll("#v3Modes .chip")].forEach(b=>b.onclick=()=>{
    mode=b.dataset.mode;
    [...document.querySelectorAll("#v3Modes .chip")].forEach(x=>
      x.setAttribute("aria-pressed",x===b));
    rebuild();
  });
  [...document.querySelectorAll("#v3Layers button")].forEach(b=>b.onclick=()=>{
    show[b.dataset.layer]=!show[b.dataset.layer];
    b.setAttribute("aria-pressed",show[b.dataset.layer]);
    draw();
  });
  ["v3Speed","v3Angle","v3Bearing"].forEach(id=>{
    q(id).addEventListener("input",()=>{
      q(id+"Val").textContent=q(id).value+(id==="v3Speed"?" m/s":"°");
    });
  });
}

/* ---- the GL side ------------------------------------------------------------------- */
function start(){
  canvas=q("v3Canvas");
  if(!gl){
    gl=canvas.getContext("webgl2",{antialias:true,alpha:false});
    if(!gl){ q("v3Fail").style.display="block"; return false; }
    prog=program(gl,VS_BOX,FS_BOX);
    mesh=program(gl,VS_MESH,FS_MESH);
    line=program(gl,VS_LINE,FS_LINE);
    const box=unitBox();
    bufs.boxPos=buffer(gl,box.pos); bufs.boxNrm=buffer(gl,box.nrm);
    bufs.boxCount=box.count;
    bufs.line=gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    bindControls();
    rebuild();
  }
  resize();
  loop();
  return true;
}
function rebuild(){
  const t0=performance.now();
  const states=(NYC.simui&&NYC.simui.projectionContext&&NYC.simui.projectionContext());
  const m=NYC.world3d.meshes({mode:mode==="damage"?"use":mode,
    states:(mode==="damage"&&states)?states.blocks:null});
  const up=(name,data)=>{
    if(!bufs[name]) bufs[name]=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,bufs[name]);
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  };
  up("iOff",m.boxes.off); up("iScl",m.boxes.scl); up("iCol",m.boxes.col);
  up("iYaw",m.boxes.yaw);
  bufs.instances=m.boxes.count;
  up("tPos",m.terrain.pos); up("tCol",m.terrain.col);
  if(!bufs.tIdx) bufs.tIdx=gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,bufs.tIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.terrain.idx,gl.STATIC_DRAW);
  bufs.tCount=m.terrain.count;
  up("rPos",m.roads.pos); up("rCol",m.roads.col); bufs.rCount=m.roads.count;
  up("pPos",m.parks.pos); up("pCol",m.parks.col); bufs.pCount=m.parks.count;
  ready=true;
  q("v3Stat").textContent=NYC.world3d.stats.colliders.toLocaleString()+" boxes · "+
    Math.round(performance.now()-t0)+" ms";
  draw();
}
function resize(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const w=canvas.clientWidth||innerWidth, h=canvas.clientHeight||innerHeight;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  gl&&gl.viewport(0,0,canvas.width,canvas.height);
}
function viewProj(){
  const asp=canvas.width/Math.max(1,canvas.height);
  const P=M4.perspective(M4.create(),0.9,asp,8,26000);
  const cp=Math.cos(cam.pitch), eye=[
    cam.tx+Math.sin(cam.yaw)*cp*cam.dist,
    cam.ty+Math.sin(cam.pitch)*cam.dist,
    cam.tz+Math.cos(cam.yaw)*cp*cam.dist];
  const V=M4.lookAt(M4.create(),eye,[cam.tx,cam.ty,cam.tz],[0,1,0]);
  return {VP:M4.mul(M4.create(),P,V),eye};
}
function draw(){
  if(!ready||!gl) return;
  const {VP,eye}=viewProj();
  gl.clearColor(0.796,0.792,0.760,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  gl.useProgram(mesh);
  gl.uniformMatrix4fv(mesh.u.uVP,false,VP);
  gl.uniform3fv(mesh.u.uEye,eye);
  if(show.ground){
    attrib(gl,mesh,"aPos",bufs.tPos,3); attrib(gl,mesh,"aCol",bufs.tCol,3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,bufs.tIdx);
    gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES,bufs.tCount,gl.UNSIGNED_INT,0);
    gl.enable(gl.CULL_FACE);
  }
  if(show.parks&&bufs.pCount){
    attrib(gl,mesh,"aPos",bufs.pPos,3); attrib(gl,mesh,"aCol",bufs.pCol,3);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES,0,bufs.pCount);
    gl.enable(gl.CULL_FACE);
  }
  if(show.roads&&bufs.rCount){
    attrib(gl,mesh,"aPos",bufs.rPos,3); attrib(gl,mesh,"aCol",bufs.rCol,3);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES,0,bufs.rCount);
    gl.enable(gl.CULL_FACE);
  }
  if(show.boxes){
    gl.useProgram(prog);
    gl.uniformMatrix4fv(prog.u.uVP,false,VP);
    gl.uniform3fv(prog.u.uEye,eye);
    attrib(gl,prog,"aPos",bufs.boxPos,3);
    attrib(gl,prog,"aNrm",bufs.boxNrm,3);
    attrib(gl,prog,"iOff",bufs.iOff,3,{divisor:1});
    attrib(gl,prog,"iScl",bufs.iScl,3,{divisor:1});
    attrib(gl,prog,"iCol",bufs.iCol,3,{divisor:1});
    attrib(gl,prog,"iYaw",bufs.iYaw,1,{divisor:1});
    gl.drawArraysInstanced(gl.TRIANGLES,0,bufs.boxCount,bufs.instances);
    [prog.a.iOff,prog.a.iScl,prog.a.iCol,prog.a.iYaw].forEach(l=>{
      if(l>=0) gl.vertexAttribDivisor(l,0); });
  }
  drawTrace(VP);
}
function drawTrace(VP){
  if(!lastTrace) return;
  const n=anim?Math.max(2,Math.floor(anim.i)):lastTrace.samples.length;
  const pts=lastTrace.samples.slice(0,n);
  const arr=new Float32Array(pts.length*3);
  pts.forEach((s,i)=>{ arr[i*3]=s.p[0]; arr[i*3+1]=s.p[1]; arr[i*3+2]=s.p[2]; });
  gl.useProgram(line);
  gl.uniformMatrix4fv(line.u.uVP,false,VP);
  gl.bindBuffer(gl.ARRAY_BUFFER,bufs.line);
  gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
  attrib(gl,line,"aPos",bufs.line,3);
  gl.disable(gl.DEPTH_TEST);
  gl.uniform4f(line.u.uCol,0.56,0.16,0.13,0.95);
  gl.uniform1f(line.u.uSize,3.4);
  gl.drawArrays(gl.LINE_STRIP,0,pts.length);
  /* line width is clamped to one pixel almost everywhere, so the path is also
     drawn as points, which are not */
  gl.drawArrays(gl.POINTS,0,pts.length);
  /* where it hit something, and where it came to rest */
  const marks=lastTrace.impacts.filter((_,i)=>true).map(i=>i.point).concat([lastTrace.rest]);
  const ma=new Float32Array(marks.length*3);
  marks.forEach((p,i)=>{ ma[i*3]=p[0]; ma[i*3+1]=p[1]; ma[i*3+2]=p[2]; });
  gl.bufferData(gl.ARRAY_BUFFER,ma,gl.DYNAMIC_DRAW);
  attrib(gl,line,"aPos",bufs.line,3);
  gl.uniform4f(line.u.uCol,0.10,0.10,0.09,1.0);
  gl.uniform1f(line.u.uSize,7.0);
  gl.drawArrays(gl.POINTS,0,marks.length);
  gl.enable(gl.DEPTH_TEST);
}
function loop(){
  if(!q("v3").classList.contains("on")){ raf=null; return; }
  if(anim){
    anim.i+=anim.rate;
    if(anim.i>=lastTrace.samples.length){ anim=null; }
  }
  draw();
  raf=requestAnimationFrame(loop);
}

/* ---- controls ---------------------------------------------------------------------- */
function bindControls(){
  let drag=null;
  canvas.addEventListener("pointerdown",e=>{
    canvas.setPointerCapture(e.pointerId);
    drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2,moved:0};
  });
  canvas.addEventListener("pointermove",e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    drag.moved+=Math.abs(dx)+Math.abs(dy);
    if(drag.pan){
      const s=cam.dist*0.0016;
      cam.tx-=(dx*Math.cos(cam.yaw)+dy*Math.sin(cam.yaw))*s;
      cam.tz+=(dx*Math.sin(cam.yaw)-dy*Math.cos(cam.yaw))*s;
    } else {
      cam.yaw-=dx*0.005;
      cam.pitch=Math.max(0.06,Math.min(1.5,cam.pitch+dy*0.005));
    }
    drag.x=e.clientX; drag.y=e.clientY;
  });
  ["pointerup","pointercancel"].forEach(ev=>canvas.addEventListener(ev,e=>{
    if(drag&&drag.moved<5) click(e);
    drag=null;
  }));
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.addEventListener("wheel",e=>{
    e.preventDefault();
    cam.dist=Math.max(60,Math.min(18000,cam.dist*Math.pow(1.0016,e.deltaY)));
  },{passive:false});
  addEventListener("resize",()=>{ if(q("v3").classList.contains("on")){ resize(); draw(); } });
  addEventListener("keydown",e=>{
    if(!q("v3").classList.contains("on")) return;
    const s=cam.dist*0.06;
    const f=[Math.sin(cam.yaw),0,Math.cos(cam.yaw)];
    if(e.key==="Escape") close();
    else if(e.key==="w"||e.key==="W"){ cam.tx-=f[0]*s; cam.tz-=f[2]*s; }
    else if(e.key==="s"||e.key==="S"){ cam.tx+=f[0]*s; cam.tz+=f[2]*s; }
    else if(e.key==="a"||e.key==="A"){ cam.tx-=f[2]*s; cam.tz+=f[0]*s; }
    else if(e.key==="d"||e.key==="D"){ cam.tx+=f[2]*s; cam.tz-=f[0]*s; }
    else return;
    e.preventDefault();
  });
}
function click(e){
  const r=canvas.getBoundingClientRect();
  const {VP}=viewProj();
  const inv=invert(M4.create(),VP);
  if(!inv) return;
  const ray=unproject(e.clientX-r.left,e.clientY-r.top,r.width,r.height,inv);
  const hit=NYC.world3d.raycast(ray.origin,ray.dir,26000);
  if(picking){
    let p;
    if(hit) p=[hit.point[0],hit.point[1]+8,hit.point[2]];
    else p=groundPoint(ray);
    if(p){ throwOrigin=p; q("v3Origin").textContent=describe(p); }
    picking=false; q("v3Pick").setAttribute("aria-pressed","false");
    return;
  }
  if(hit){
    const c=hit.collider;
    q("v3Sel").innerHTML='<b>'+esc(c.label)+'</b>'+
      '<span>'+(c.kind==="structure"?"named structure":c.era+" · "+
        (NYC.fabric.USES[c.use]?NYC.fabric.USES[c.use].label:c.use))+'</span>'+
      '<span>'+Math.round(c.height)+' m · '+Math.round(c.hx*2)+'×'+Math.round(c.hz*2)+
      ' m · '+(c.mass/1e6).toFixed(1)+' kt · '+c.material.name+'</span>';
  }
}
function groundPoint(ray){
  if(Math.abs(ray.dir[1])<1e-5) return null;
  const t=-ray.origin[1]/ray.dir[1];
  if(t<0) return null;
  const p=[ray.origin[0]+ray.dir[0]*t,0,ray.origin[2]+ray.dir[2]*t];
  p[1]=NYC.world3d.groundAt(p[0],p[2])+2;
  return p;
}
function describe(p){
  const [gx,gy]=NYC.world3d.w2g(p[0],p[2]);
  return NYC.map.describe(gx,gy)+" · "+Math.round(p[1])+" m up";
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;"}[c]));

/* ---- the throw ---------------------------------------------------------------------- */
function doThrow(){
  const w=NYC.world3d.build();
  let o=throwOrigin;
  if(!o){
    /* default: off the top of the tallest thing near the camera target */
    let best=null,bd=1e18;
    w.colliders.forEach(c=>{
      if(c.kind!=="structure") return;
      const d=(c.cx-cam.tx)*(c.cx-cam.tx)+(c.cz-cam.tz)*(c.cz-cam.tz);
      if(d<bd&&c.height>80){ bd=d; best=c; }
    });
    o=best?[best.cx,best.base+best.height*0.55,best.cz]:[cam.tx,90,cam.tz];
    throwOrigin=o; q("v3Origin").textContent=describe(o);
  }
  const cls=q("v3Class").value;
  const preset=NYC.world3d.fragmentPreset(cls);
  const sp=+q("v3Speed").value, el=+q("v3Angle").value*Math.PI/180;
  const br=+q("v3Bearing").value*Math.PI/180;
  /* bearing is compass-style: 0 north, 90 east; north is -z */
  const v=[Math.sin(br)*Math.cos(el)*sp, Math.sin(el)*sp, -Math.cos(br)*Math.cos(el)*sp];
  const t0=performance.now();
  lastTrace=NYC.world3d.trace({origin:o.slice(),velocity:v,mass:preset.mass,
    cda:preset.cda,penetrate:true});
  const ms=Math.round(performance.now()-t0);
  anim={i:2,rate:Math.max(1,lastTrace.samples.length/90)};
  /* frame the whole flight, wherever the camera happened to be */
  const r=lastTrace.rest;
  cam.tx=(o[0]+r[0])/2; cam.tz=(o[2]+r[2])/2; cam.ty=(o[1]+r[1])/2;
  cam.dist=Math.max(320,lastTrace.range*2.1);
  cam.pitch=Math.min(cam.pitch,0.5);
  const t=lastTrace;
  const hitNames=[...new Set(t.impacts.map(i=>i.name))].slice(0,4);
  q("v3Out").innerHTML=
    '<div class="v3res"><b>'+esc(preset.label)+'</b> · '+preset.mass+' kg · '+sp+' m/s</div>'+
    '<ul class="svc">'+
    '<li><b>RANGE</b><span>'+Math.round(t.range)+' m · '+t.blocks.toFixed(1)+' blocks</span></li>'+
    '<li><b>STRUCTURES HIT</b><span>'+t.impacts.length+'</span></li>'+
    '<li><b>WENT THROUGH</b><span>'+t.through+'</span></li>'+
    '<li><b>CAME TO REST</b><span>'+(t.stopped.reason==="struck"
      ?"in "+esc(t.stopped.name):"on the ground")+'</span></li>'+
    '<li><b>SOLVED IN</b><span>'+ms+' ms</span></li></ul>'+
    (hitNames.length?'<div class="v3hits">through: '+hitNames.map(n=>esc(
      NYC.world3d.build().colliders.some(c=>c.kind==="structure"&&c.label===n)
        ? n : "fabric, "+n)).join(" · ")+'</div>':'');
}

/* ---- open and close ------------------------------------------------------------------ */
function open(){
  q("v3").classList.add("on");
  document.body.style.overflow="hidden";
  /* start over whatever the flat sheet was looking at */
  if(NYC.mapView){
    const c=NYC.mapView.centreGrid&&NYC.mapView.centreGrid();
    if(c){ const [wx,wz]=NYC.world3d.g2w(c[0],c[1]); cam.tx=wx; cam.tz=wz; }
  }
  if(!start()) return;
  q("v3Btn").setAttribute("aria-pressed","true");
}
function close(){
  q("v3").classList.remove("on");
  document.body.style.overflow="";
  q("v3Btn").setAttribute("aria-pressed","false");
  if(raf) cancelAnimationFrame(raf); raf=null;
}
function toggle(){ q("v3").classList.contains("on")?close():open(); }

NYC.view3d={init,open,close,toggle,rebuild,
  get trace(){return lastTrace;}};
})();
