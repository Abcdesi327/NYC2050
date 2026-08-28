/* ===================================================================================
   NYC 2050 — a small WebGL2 layer.
   Enough matrix maths and buffer plumbing to draw the city, and no more. Written by
   hand rather than pulled from a library so the project keeps its one useful
   property: it is a folder of files that opens from disk with nothing installed.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

/* ---- 4x4 matrices, column-major, the way GL wants them --------------------------- */
const M4={
  create:()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  identity(o){ o.set([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); return o; },
  perspective(o,fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2), nf=1/(near-far);
    o.set([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
    return o;
  },
  lookAt(o,eye,ctr,up){
    let zx=eye[0]-ctr[0], zy=eye[1]-ctr[1], zz=eye[2]-ctr[2];
    let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
    let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
    l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    o.set([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
      -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
      -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1]);
    return o;
  },
  mul(o,a,b){
    for(let c=0;c<4;c++) for(let r=0;r<4;r++){
      let s=0;
      for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k];
      o[c*4+r]=s;
    }
    return o;
  }
};
/* screen point -> a ray in world space, for picking */
function unproject(px,py,w,h,invVP){
  const x=(px/w)*2-1, y=1-(py/h)*2;
  const pt=(z)=>{
    const cx=invVP[0]*x+invVP[4]*y+invVP[8]*z+invVP[12];
    const cy=invVP[1]*x+invVP[5]*y+invVP[9]*z+invVP[13];
    const cz=invVP[2]*x+invVP[6]*y+invVP[10]*z+invVP[14];
    const cw=invVP[3]*x+invVP[7]*y+invVP[11]*z+invVP[15];
    return [cx/cw,cy/cw,cz/cw];
  };
  const a=pt(-1), b=pt(1);
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const l=Math.hypot(d[0],d[1],d[2])||1;
  return {origin:a,dir:[d[0]/l,d[1]/l,d[2]/l]};
}
function invert(o,m){
  const a=m;
  const b00=a[0]*a[5]-a[1]*a[4], b01=a[0]*a[6]-a[2]*a[4], b02=a[0]*a[7]-a[3]*a[4],
        b03=a[1]*a[6]-a[2]*a[5], b04=a[1]*a[7]-a[3]*a[5], b05=a[2]*a[7]-a[3]*a[6],
        b06=a[8]*a[13]-a[9]*a[12], b07=a[8]*a[14]-a[10]*a[12],
        b08=a[8]*a[15]-a[11]*a[12], b09=a[9]*a[14]-a[10]*a[13],
        b10=a[9]*a[15]-a[11]*a[13], b11=a[10]*a[15]-a[11]*a[14];
  let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
  if(!det) return null;
  det=1/det;
  o[0]=(a[5]*b11-a[6]*b10+a[7]*b09)*det;
  o[1]=(a[2]*b10-a[1]*b11-a[3]*b09)*det;
  o[2]=(a[13]*b05-a[14]*b04+a[15]*b03)*det;
  o[3]=(a[10]*b04-a[9]*b05-a[11]*b03)*det;
  o[4]=(a[6]*b08-a[4]*b11-a[7]*b07)*det;
  o[5]=(a[0]*b11-a[2]*b08+a[3]*b07)*det;
  o[6]=(a[14]*b02-a[12]*b05-a[15]*b01)*det;
  o[7]=(a[8]*b05-a[10]*b02+a[11]*b01)*det;
  o[8]=(a[4]*b10-a[5]*b08+a[7]*b06)*det;
  o[9]=(a[1]*b08-a[0]*b10-a[3]*b06)*det;
  o[10]=(a[12]*b04-a[13]*b02+a[15]*b00)*det;
  o[11]=(a[9]*b02-a[8]*b04-a[11]*b00)*det;
  o[12]=(a[5]*b07-a[4]*b09-a[6]*b06)*det;
  o[13]=(a[0]*b09-a[1]*b07+a[2]*b06)*det;
  o[14]=(a[13]*b01-a[12]*b03-a[14]*b00)*det;
  o[15]=(a[8]*b03-a[9]*b01+a[10]*b00)*det;
  return o;
}

/* ---- shaders and buffers ---------------------------------------------------------- */
function shader(gl,type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s)+"\n"+src);
  return s;
}
function program(gl,vs,fs){
  const p=gl.createProgram();
  gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));
  gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  p.u={}; p.a={};
  const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<nu;i++){ const n=gl.getActiveUniform(p,i).name.replace(/\[0\]$/,"");
    p.u[n]=gl.getUniformLocation(p,n); }
  const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);
  for(let i=0;i<na;i++){ const n=gl.getActiveAttrib(p,i).name;
    p.a[n]=gl.getAttribLocation(p,n); }
  return p;
}
function buffer(gl,data,target){
  const b=gl.createBuffer();
  const t=target||gl.ARRAY_BUFFER;
  gl.bindBuffer(t,b); gl.bufferData(t,data,gl.STATIC_DRAW);
  return b;
}
function attrib(gl,prog,name,buf,size,opts){
  const loc=prog.a[name];
  if(loc==null||loc<0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,size,(opts&&opts.type)||gl.FLOAT,!!(opts&&opts.norm),
    (opts&&opts.stride)||0,(opts&&opts.offset)||0);
  if(opts&&opts.divisor) gl.vertexAttribDivisor(loc,opts.divisor);
}

/* a unit box, base on the ground: x,z in [-.5,.5], y in [0,1] */
function unitBox(){
  const p=[],n=[];
  const F=[
    [[ .5,0,-.5],[ .5,0, .5],[ .5,1, .5],[ .5,1,-.5],[1,0,0]],
    [[-.5,0, .5],[-.5,0,-.5],[-.5,1,-.5],[-.5,1, .5],[-1,0,0]],
    [[-.5,1,-.5],[ .5,1,-.5],[ .5,1, .5],[-.5,1, .5],[0,1,0]],
    [[-.5,0, .5],[ .5,0, .5],[ .5,0,-.5],[-.5,0,-.5],[0,-1,0]],
    [[-.5,0, .5],[-.5,1, .5],[ .5,1, .5],[ .5,0, .5],[0,0,1]],
    [[ .5,0,-.5],[ .5,1,-.5],[-.5,1,-.5],[-.5,0,-.5],[0,0,-1]]
  ];
  F.forEach(f=>{
    let c=[f[0],f[1],f[2],f[3]];
    /* wind each face so its face normal points out, whatever order it was written in */
    const e1=[c[1][0]-c[0][0],c[1][1]-c[0][1],c[1][2]-c[0][2]];
    const e2=[c[2][0]-c[0][0],c[2][1]-c[0][1],c[2][2]-c[0][2]];
    const cr=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    if(cr[0]*f[4][0]+cr[1]*f[4][1]+cr[2]*f[4][2]<0) c=[c[3],c[2],c[1],c[0]];
    const q=[c[0],c[1],c[2],c[0],c[2],c[3]];
    q.forEach(v=>{ p.push(v[0],v[1],v[2]); n.push(f[4][0],f[4][1],f[4][2]); });
  });
  return {pos:new Float32Array(p),nrm:new Float32Array(n),count:p.length/3};
}

NYC.gl={M4,invert,unproject,shader,program,buffer,attrib,unitBox};
})();
