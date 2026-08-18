/* ===================================================================================
   NYC 2050 — street-view drawing kit.
   Every plate is procedural SVG: no photographs, no external assets. Elements that
   belong to the collapse go in <g class="decay">; elements that only existed before
   it go in <g class="intact">. The viewer's THEN/NOW switch cross-fades the two.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

/* ---- markup helpers --------------------------------------------------------------- */
const A=o=>Object.keys(o||{}).filter(k=>o[k]!=null&&o[k]!==false)
  .map(k=>' '+k+'="'+o[k]+'"').join("");
const T=(n,a,inner)=> "<"+n+A(a)+(inner==null?"/>":">"+inner+"</"+n+">");
const G=(inner,a)=>T("g",a,inner);
const R=(x,y,w,h,fill,a)=>T("rect",Object.assign({x:r2(x),y:r2(y),width:r2(w),
  height:r2(h),fill:fill},a));
const PT=(d,a)=>T("path",Object.assign({d:d},a));
const PG=(pts,a)=>T("polygon",Object.assign({points:pts.map(p=>r2(p[0])+","+r2(p[1])).join(" ")},a));
const LN=(x1,y1,x2,y2,a)=>T("line",Object.assign({x1:r2(x1),y1:r2(y1),x2:r2(x2),y2:r2(y2)},a));
const EL=(cx,cy,rx,ry,a)=>T("ellipse",Object.assign({cx:r2(cx),cy:r2(cy),rx:r2(rx),ry:r2(ry)},a));
const TX=(x,y,s,a)=>T("text",Object.assign({x:r2(x),y:r2(y)},a),s);
function r2(n){ return Math.round(n*100)/100; }

/* deterministic noise so a plate looks the same every time it is opened */
function rng(seed){
  let a=seed>>>0;
  return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
}
const pick=(rand,arr)=>arr[Math.floor(rand()*arr.length)];
const between=(rand,a,b)=>a+rand()*(b-a);

/* ---- palette ---------------------------------------------------------------------- */
const C={
  skyTop:"#8E9AA0", skyMid:"#AEB4B2", skyLow:"#CFC9B8",
  far:"#7F888C", far2:"#8E9599", mid:"#7A776E",
  stoneL:"#D2CCBC", stone:"#BAB3A2", stoneD:"#948D7C", stoneX:"#6E6858",
  brickL:"#9E7B68", brick:"#87614F", brickD:"#6A4A3C",
  metal:"#A9AEB0", metalD:"#7C8285", glass:"#93A3A8", dark:"#1B1E22", dark2:"#2A2E33",
  ink:"#20211F", green:"#4E6B3A", green2:"#63804A", green3:"#3A5430",
  water:"#5A707A", waterL:"#7E939A", rust:"#8A5A2B", patina:"#4F7D6B",
  paper:"#EDE9DC", warm:"#E8A54B"
};

/* ---- sky, haze, ground ------------------------------------------------------------ */
function sky(o){
  o=o||{};
  return R(0,0,1200,700,"url(#svSky)")+
   (o.rain?rain(o.seed||1):"")+
   G(clouds(o.seed||7),{opacity:o.cloud==null?.5:o.cloud});
}
function clouds(seed){
  const rand=rng(seed); let s="";
  for(let i=0;i<7;i++){
    const x=between(rand,-60,1200), y=between(rand,20,220),
      w=between(rand,140,340), h=between(rand,18,46);
    s+=EL(x,y,w,h,{fill:"#E6E2D6",opacity:r2(between(rand,.18,.42))});
  }
  return s;
}
function rain(seed){
  const rand=rng(seed); let s="";
  for(let i=0;i<140;i++){
    const x=between(rand,-40,1240), y=between(rand,0,700), l=between(rand,10,26);
    s+=LN(x,y,x-l*.28,y+l,{stroke:"#D8DCDB","stroke-width":.7,opacity:r2(between(rand,.1,.3))});
  }
  return s;
}
/* a receding row of dead towers on the horizon */
function skyline(seed,o){
  o=o||{}; const rand=rng(seed);
  const base=o.base||470, fill=o.fill||C.far, n=o.count||14;
  const x0=o.x0==null?-40:o.x0, x1=o.x1==null?1240:o.x1;
  let s="",x=x0;
  while(x<x1){
    const w=between(rand,26,86), h=between(rand,40,o.max||220);
    const top=base-h;
    let d="M"+r2(x)+" "+r2(base)+"L"+r2(x)+" "+r2(top);
    if(rand()<.3){ /* a broken crown */
      const b=between(rand,8,26);
      d+="L"+r2(x+w*.3)+" "+r2(top+b)+"L"+r2(x+w*.55)+" "+r2(top-b*.5)+
         "L"+r2(x+w*.8)+" "+r2(top+b*1.4)+"L"+r2(x+w)+" "+r2(top+b*.4);
    } else d+="L"+r2(x+w)+" "+r2(top);
    d+="L"+r2(x+w)+" "+r2(base)+"Z";
    s+=PT(d,{fill:fill,opacity:r2(between(rand,.5,.95))});
    if(rand()<.5&&h>90)
      s+=R(x+w*.4,top-between(rand,8,26),2,between(rand,8,26),fill,{opacity:.8});
    x+=w*between(rand,.6,1.05);
  }
  return s;
}
/* asphalt plane with a vanishing point, cracks and standing water */
function ground(o){
  o=o||{}; const rand=rng(o.seed||3);
  const hz=o.horizon||470, vp=o.vp==null?600:o.vp, col=o.fill||"#6E6C66";
  let s=R(0,hz,1200,700-hz,col);
  s+=R(0,hz,1200,26,"#5E5C57",{opacity:.55});
  /* perspective lines */
  let lines="";
  for(let i=-6;i<=6;i++){
    const bx=vp+i*230;
    lines+=LN(vp,hz,bx,700,{stroke:"#8A887F","stroke-width":.8,opacity:.2});
  }
  s+=lines;
  /* transverse joints */
  for(let i=1;i<=8;i++){
    const y=hz+Math.pow(i/8,2.1)*(700-hz);
    s+=LN(0,y,1200,y,{stroke:"#8A887F","stroke-width":.7,opacity:.13});
  }
  s+=G(cracksField(o.seed||3,0,hz+14,1200,700-hz-14,o.cracks||22)+
       potholes(o.seed||3,hz,o.pot||9)+
       (o.weeds===false?"":weedLine(o.seed||3,hz+6,26)),{class:"decay"});
  return s;
}
function potholes(seed,hz,n){
  const rand=rng(seed+11); let s="";
  for(let i=0;i<n;i++){
    const y=hz+Math.pow(rand(),1.7)*(700-hz)+8, x=between(rand,-20,1220);
    const w=between(rand,18,70)*(y-hz)/(700-hz)+8;
    s+=EL(x,y,w,w*.32,{fill:"#4C4A46",opacity:.7});
    s+=EL(x,y,w*.72,w*.22,{fill:C.water,opacity:.5});
  }
  return s;
}
function cracksField(seed,x,y,w,h,n){
  const rand=rng(seed+3); let s="";
  for(let i=0;i<n;i++) s+=crack(between(rand,x,x+w),between(rand,y,y+h),
    between(rand,20,120),rand,{stroke:"#4A4844","stroke-width":between(rand,.5,1.3),
    opacity:r2(between(rand,.25,.6))});
  return s;
}
/* one jagged fissure */
function crack(x,y,len,rand,a){
  let d="M"+r2(x)+" "+r2(y), px=x,py=y,ang=between(rand,-Math.PI,Math.PI);
  const steps=Math.max(3,Math.round(len/12));
  for(let i=0;i<steps;i++){
    ang+=between(rand,-.8,.8);
    px+=Math.cos(ang)*len/steps; py+=Math.sin(ang)*len/steps*.55;
    d+="L"+r2(px)+" "+r2(py);
    if(rand()<.25){ /* a branch */
      const bx=px+Math.cos(ang+1.1)*len/steps*1.2, by=py+Math.sin(ang+1.1)*len/steps*.6;
      d+="M"+r2(px)+" "+r2(py)+"L"+r2(bx)+" "+r2(by)+"M"+r2(px)+" "+r2(py);
    }
  }
  return PT(d,Object.assign({fill:"none","stroke-linecap":"round"},a));
}
function cracksOn(x,y,w,h,seed,n,col){
  const rand=rng(seed+29); let s="";
  for(let i=0;i<(n||6);i++)
    s+=crack(between(rand,x,x+w),between(rand,y,y+h),between(rand,30,h*.8+40),rand,
      {stroke:col||"#6B6558","stroke-width":between(rand,.5,1.2),opacity:.5});
  return s;
}

/* ---- masonry ---------------------------------------------------------------------- */
function stone(x,y,w,h,tone,o){
  o=o||{};
  let s=R(x,y,w,h,tone||C.stone,{stroke:o.stroke||"none"});
  if(o.course!==false){
    for(let cy=y+ (o.course||14); cy<y+h; cy+=(o.course||14))
      s+=LN(x,cy,x+w,cy,{stroke:"#00000018","stroke-width":.7});
  }
  if(o.shade) s+=R(x+w*.66,y,w*.34,h,"#00000012");
  return s;
}
/* soot and rain-streaking down a facade */
function streaks(x,y,w,h,seed,o){
  o=o||{}; const rand=rng(seed+5); let s="";
  for(let i=0;i<(o.n||14);i++){
    const sx=between(rand,x,x+w), sw=between(rand,1.5,7), sh=between(rand,h*.2,h);
    s+=R(sx,y,sw,sh,o.col||"#3E3B33",{opacity:r2(between(rand,.05,.16))});
  }
  return s;
}
function column(x,base,top,w,o){
  o=o||{}; const tone=o.tone||C.stoneL;
  let s=R(x-w/2,top+6,w,base-top-10,tone,{stroke:"none"});
  for(let i=1;i<4;i++) s+=LN(x-w/2+w*i/4,top+8,x-w/2+w*i/4,base-6,
    {stroke:"#00000014","stroke-width":.8});
  s+=R(x-w*.72,top,w*1.44,7,o.capTone||C.stoneL);         /* capital */
  s+=R(x-w*.66,base-6,w*1.32,7,o.capTone||C.stoneL);      /* base */
  s+=R(x+w*.2,top+6,w*.3,base-top-10,"#00000012");
  return s;
}
function colonnade(x0,x1,base,top,n,w,o){
  let s=""; for(let i=0;i<n;i++) s+=column(x0+(x1-x0)*(n===1?.5:i/(n-1)),base,top,w,o);
  return s;
}
function cornice(x,y,w,h,tone){
  return R(x,y,w,h,tone||C.stoneL)+R(x-4,y+h-3,w+8,4,tone||C.stoneL)+
    R(x,y+h-1,w,2,"#00000018");
}
/* a round-headed opening */
function archPath(cx,spring,r,bottom){
  return "M"+r2(cx-r)+" "+r2(bottom)+"L"+r2(cx-r)+" "+r2(spring)+
    "A"+r2(r)+" "+r2(r)+" 0 0 1 "+r2(cx+r)+" "+r2(spring)+"L"+r2(cx+r)+" "+r2(bottom)+"Z";
}
/* voussoirs around an arch */
function voussoirs(cx,spring,r,n,tone){
  let s="";
  for(let i=0;i<=n;i++){
    const a=Math.PI+ (i/n)*Math.PI;
    const x1=cx+Math.cos(a)*r, y1=spring+Math.sin(a)*r;
    const x2=cx+Math.cos(a)*(r+11), y2=spring+Math.sin(a)*(r+11);
    s+=LN(x1,y1,x2,y2,{stroke:"#00000020","stroke-width":.9});
  }
  s+=PT("M"+r2(cx-r-11)+" "+r2(spring)+"A"+r2(r+11)+" "+r2(r+11)+" 0 0 1 "+
    r2(cx+r+11)+" "+r2(spring),{fill:"none",stroke:tone||"#00000018","stroke-width":1});
  return s;
}

/* ---- windows ---------------------------------------------------------------------- */
/* dark openings now; glass restored in the THEN layer */
function windows(x,y,w,h,cols,rows,seed,o){
  o=o||{}; const rand=rng(seed+17);
  const gx=o.gx==null?.34:o.gx, gy=o.gy==null?.38:o.gy;
  const cw=w/cols, ch=h/rows, ww=cw*(1-gx), wh=ch*(1-gy);
  let now="",then="",dec="";
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const wx=x+c*cw+(cw-ww)/2, wy=y+r*ch+(ch-wh)/2;
    if(ww<.7||wh<.7) continue;
    now+=R(wx,wy,ww,wh,o.dark||C.dark,{opacity:r2(between(rand,.72,.95))});
    then+=R(wx,wy,ww,wh,o.glass||C.glass,{opacity:r2(between(rand,.55,.85))});
    const q=rand();
    if(q<(o.broken==null?.3:o.broken)&&ww>3&&wh>3){
      dec+=PG([[wx,wy],[wx+ww*.6,wy],[wx,wy+wh*.55]],{fill:"#5A5F63",opacity:.5});
      dec+=PG([[wx+ww,wy+wh],[wx+ww*.45,wy+wh],[wx+ww,wy+wh*.4]],{fill:"#4A4F53",opacity:.4});
    } else if(q>.94&&o.lit){
      dec+=R(wx,wy,ww,wh,o.lit,{opacity:r2(between(rand,.35,.8))});
    }
  }
  return now+G(then,{class:"intact"})+G(dec,{class:"decay"});
}
/* a single tall shopfront */
function shopfront(x,y,w,h,seed,o){
  o=o||{}; const rand=rng(seed+41);
  let s=R(x,y,w,h,"#2A2C30");
  s+=G(R(x,y,w,h,"#9FB0B4",{opacity:.5}),{class:"intact"});
  let dec="";
  for(let i=0;i<5;i++){
    const bx=between(rand,x,x+w);
    dec+=PG([[bx,y],[bx+between(rand,10,40),y],[bx+between(rand,-16,16),y+h]],
      {fill:"#1A1C1F",opacity:.55});
  }
  dec+=R(x,y+h-4,w,4,"#3B3E42");
  s+=G(dec,{class:"decay"});
  if(o.awning) s+=G(PG([[x,y],[x+w,y],[x+w-14,y+20],[x+14,y+20]],
    {fill:o.awning,opacity:.9}),{class:"intact"});
  return s;
}
function fireEscape(x,y,w,floors,o){
  let s="";
  for(let i=0;i<floors;i++){
    const fy=y+i*(o&&o.step||46);
    s+=R(x,fy,w,2.4,C.metalD,{opacity:.85});
    for(let j=0;j<=6;j++) s+=LN(x+j*w/6,fy-14,x+j*w/6,fy,{stroke:C.metalD,
      "stroke-width":.8,opacity:.75});
    s+=LN(x,fy-14,x+w,fy-14,{stroke:C.metalD,"stroke-width":1,opacity:.75});
    s+=LN(x+w*.62,fy,x+w*.9,fy+(o&&o.step||46),{stroke:C.metalD,"stroke-width":1.4,
      opacity:.8,"stroke-dasharray":"3 3"});
  }
  return s;
}

/* ---- growth ----------------------------------------------------------------------- */
function ivy(x,y,w,h,seed,o){
  o=o||{}; const rand=rng(seed+23); const n=o.n||9; let s="";
  for(let i=0;i<n;i++){
    let px=between(rand,x,x+w), py=y+h;
    const pts=[[px,py]], climb=between(rand,h*.3,h*1.02), steps=9;
    let d="M"+r2(px)+" "+r2(py);
    for(let k=0;k<steps;k++){
      px+=between(rand,-11,11); py-=climb/steps;
      pts.push([px,py]); d+="L"+r2(px)+" "+r2(py);
    }
    s+=PT(d,{fill:"none",stroke:C.green3,"stroke-width":r2(between(rand,.9,2)),
      opacity:.8,"stroke-linecap":"round"});
    pts.forEach(p=>{
      const leaves=1+Math.floor(rand()*3);
      for(let k=0;k<leaves;k++)
        s+=EL(p[0]+between(rand,-7,7),p[1]+between(rand,-5,5),
          between(rand,2.4,5.2),between(rand,1.8,3.6),
          {fill:pick(rand,[C.green,C.green2,C.green3]),opacity:r2(between(rand,.55,.92))});
    });
  }
  return s;
}
function sapling(x,y,scale,seed){
  const rand=rng(seed+31); const h=34*scale; let s="";
  s+=PT("M"+r2(x)+" "+r2(y)+"q"+r2(between(rand,-4,4))+" "+r2(-h*.6)+" "+
    r2(between(rand,-6,6))+" "+r2(-h),{fill:"none",stroke:"#54443A",
    "stroke-width":r2(1.4*scale),"stroke-linecap":"round"});
  for(let i=0;i<7;i++){
    const t=between(rand,.35,1);
    s+=EL(x+between(rand,-13,13)*scale, y-h*t, between(rand,4,10)*scale,
      between(rand,3,7)*scale,{fill:pick(rand,[C.green,C.green2,C.green3]),
      opacity:r2(between(rand,.6,.92))});
  }
  return s;
}
function treeMass(x,y,w,h,seed,o){
  const rand=rng(seed+37); let s="";
  for(let i=0;i<(o&&o.n||16);i++){
    s+=EL(between(rand,x,x+w),between(rand,y,y+h),between(rand,18,52),
      between(rand,14,34),{fill:pick(rand,[C.green,C.green2,C.green3,"#44603A"]),
      opacity:r2(between(rand,.6,.95))});
  }
  return s;
}
function weedLine(seed,y,n){
  const rand=rng(seed+43); let s="";
  for(let i=0;i<n;i++){
    const x=between(rand,-20,1220), sc=between(rand,.25,.8);
    s+=grass(x,y+between(rand,-6,90),sc,rand);
  }
  return s;
}
function grass(x,y,scale,rand){
  let s="";
  for(let i=0;i<6;i++){
    const h=between(rand,10,26)*scale, lean=between(rand,-8,8)*scale;
    s+=PT("M"+r2(x+i*2*scale)+" "+r2(y)+"q"+r2(lean/2)+" "+r2(-h*.7)+" "+r2(lean)+" "+r2(-h),
      {fill:"none",stroke:pick(rand,[C.green2,C.green,"#6F8A4E"]),
      "stroke-width":r2(1*scale),opacity:.8,"stroke-linecap":"round"});
  }
  return s;
}

/* ---- water ------------------------------------------------------------------------ */
function flood(level,seed,o){
  o=o||{}; const rand=rng(seed+53);
  let s=R(0,level,1200,700-level,C.water,{opacity:o.opacity||.86});
  s+=R(0,level,1200,3,C.waterL,{opacity:.5});
  for(let i=0;i<40;i++){
    const y=level+Math.pow(rand(),1.6)*(700-level), w=between(rand,20,180);
    s+=R(between(rand,-40,1180),y,w,between(rand,.8,2.4),C.waterL,
      {opacity:r2(between(rand,.1,.4))});
  }
  if(o.reflect) s+=R(0,level,1200,(700-level)*.5,"#FFFFFF",{opacity:.05});
  return s;
}

/* ---- objects ---------------------------------------------------------------------- */
function car(x,y,scale,seed,o){
  o=o||{}; const rand=rng(seed+59), s=scale, body=o.col||
    pick(rand,["#6E6A63","#5C5F63","#7A5B4A","#4F5A5E","#8A8377"]);
  const P0=(a,b)=>[x+a*s,y+b*s];
  const shell=[[0,-10],[2,-26],[16,-30],[30,-48],[64,-48],[78,-30],[96,-26],[98,-12],
    [96,-4],[0,-4]].map(p=>P0(p[0],p[1]));
  let g=EL(x+48*s,y+1,52*s,5*s,{fill:"#00000026"});
  g+=PG(shell,{fill:body});
  g+=PG([[34,-44],[62,-44],[72,-30],[24,-30]].map(p=>P0(p[0],p[1])),
    {fill:"#23272B",opacity:.9});
  g+=PG([[0,-10],[96,-6],[96,-4],[0,-4]].map(p=>P0(p[0],p[1])),{fill:"#000",opacity:.22});
  [[24,-6],[74,-6]].forEach(w=>{
    g+=EL(x+w[0]*s,y+w[1]*s,11*s,11*s,{fill:"#2A2C2E"});
    g+=EL(x+w[0]*s,y+w[1]*s,5*s,5*s,{fill:"#4A4C4E"});
  });
  g+=G(streaks(x,y-46*s,96*s,42*s,seed,{col:C.rust,n:7})+
    grass(x+8*s,y+1,s*.7,rand)+grass(x+88*s,y+1,s*.6,rand),{class:"decay"});
  return G(g);
}
function busWreck(x,y,scale,seed){
  const rand=rng(seed+61), s=scale, w=220*s, h=64*s;
  let g=EL(x+w/2,y+2,w*.52,6*s,{fill:"#00000026"});
  g+=PT("M"+r2(x)+" "+r2(y-8*s)+"L"+r2(x)+" "+r2(y-h+8*s)+
    "q0 "+r2(-8*s)+" "+r2(10*s)+" "+r2(-8*s)+"L"+r2(x+w-10*s)+" "+r2(y-h)+
    "q"+r2(10*s)+" 0 "+r2(10*s)+" "+r2(8*s)+"L"+r2(x+w)+" "+r2(y-8*s)+"Z",{fill:"#9A9184"});
  g+=R(x+6*s,y-h+12*s,w-12*s,h*.34,"#23272B",{opacity:.88});
  for(let i=1;i<6;i++) g+=LN(x+i*(w/6),y-h+12*s,x+i*(w/6),y-h+12*s+h*.34,
    {stroke:"#9A9184","stroke-width":2.4*s});
  g+=R(x,y-16*s,w,4*s,"#7E7568");
  [[40,-8],[168,-8]].forEach(p=>{
    g+=EL(x+p[0]*s,y+p[1]*s,13*s,13*s,{fill:"#2A2C2E"});
    g+=EL(x+p[0]*s,y+p[1]*s,6*s,6*s,{fill:"#4A4C4E"});
  });
  g+=G(streaks(x,y-h,w,h,seed,{col:C.rust,n:11})+ivy(x,y-h,w,h,seed,{n:3})+
    grass(x+w*.5,y+1,s*.8,rand),{class:"decay"});
  return G(g);
}
function rubble(x,y,w,seed,o){
  const rand=rng(seed+67); let s="";
  const n=(o&&o.n)||28;
  for(let i=0;i<n;i++){
    const bx=x+between(rand,-w/2,w/2), by=y-Math.abs(between(rand,0,1))*(o&&o.h||26)*
      (1-Math.abs(bx-x)/(w*.6));
    const sz=between(rand,3,13);
    s+=PG([[bx,by],[bx+sz,by-sz*.5],[bx+sz*1.3,by+sz*.4],[bx+sz*.4,by+sz*.7]],
      {fill:pick(rand,[C.stone,C.stoneD,C.stoneL,"#A79F8C"]),opacity:r2(between(rand,.7,1))});
  }
  s+=EL(x,y+2,w*.55,5,{fill:"#00000018"});
  return s;
}
function trafficSignal(x,y,scale,seed,o){
  const h=110*scale;
  let s=R(x-2*scale,y-h,4*scale,h,C.metalD,{opacity:.9});
  s+=PT("M"+r2(x)+" "+r2(y-h)+"q"+r2(30*scale)+" 0 "+r2(46*scale)+" "+r2(14*scale),
    {fill:"none",stroke:C.metalD,"stroke-width":r2(3*scale),opacity:.9});
  const gx=x+46*scale, gy=y-h+14*scale;
  s+=G(R(gx-6*scale,gy,12*scale,30*scale,"#2E3236")+
    EL(gx,gy+7*scale,3*scale,3*scale,{fill:"#5A4038"})+
    EL(gx,gy+15*scale,3*scale,3*scale,{fill:"#5A5238"})+
    EL(gx,gy+23*scale,3*scale,3*scale,{fill:"#38503E"}),
    {transform:o&&o.hang?"rotate(24 "+r2(gx)+" "+r2(gy)+")":null});
  return s;
}
function lamp(x,y,scale,lean){
  const h=150*scale;
  return G(R(x-2*scale,y-h,4*scale,h,C.metalD,{opacity:.9})+
    PT("M"+r2(x)+" "+r2(y-h)+"q"+r2(16*scale)+" "+r2(-8*scale)+" "+r2(30*scale)+" "+r2(4*scale),
      {fill:"none",stroke:C.metalD,"stroke-width":r2(3*scale)})+
    EL(x+30*scale,y-h+8*scale,6*scale,3*scale,{fill:"#4A4F52"}),
    {transform:lean?"rotate("+lean+" "+r2(x)+" "+r2(y)+")":null});
}
function figure(x,y,scale,o){
  o=o||{}; const h=54*scale, col=o.col||"#3A3B38";
  return G(EL(x,y-h,4.4*scale,5*scale,{fill:col})+
    R(x-4.6*scale,y-h+5*scale,9.2*scale,h*.42,col)+
    R(x-4*scale,y-h*.52,3.4*scale,h*.5,col)+
    R(x+.8*scale,y-h*.52,3.4*scale,h*.5,col)+
    EL(x,y+1,7*scale,2*scale,{fill:"#00000022"}));
}
function birds(x,y,spread,n,seed,scale){
  const rand=rng(seed+71); let s="";
  for(let i=0;i<n;i++){
    const bx=x+between(rand,-spread,spread), by=y+between(rand,-spread*.4,spread*.4),
      w=between(rand,4,9)*(scale||1);
    s+=PT("M"+r2(bx-w)+" "+r2(by)+"q"+r2(w*.5)+" "+r2(-w*.6)+" "+r2(w)+" 0"+
      "q"+r2(w*.5)+" "+r2(-w*.6)+" "+r2(w)+" 0",
      {fill:"none",stroke:"#2E3134","stroke-width":.9,opacity:r2(between(rand,.35,.8))});
  }
  return s;
}
function scaffold(x,y,w,h,seed){
  const rand=rng(seed+73); let s="";
  for(let i=0;i<=Math.round(w/40);i++) s+=LN(x+i*40,y,x+i*40,y+h,
    {stroke:C.metalD,"stroke-width":1.6,opacity:.7});
  for(let j=0;j<=Math.round(h/50);j++) s+=LN(x,y+j*50,x+w,y+j*50,
    {stroke:C.metalD,"stroke-width":1.3,opacity:.7});
  s+=PG([[x,y+h*.3],[x+w*.5,y+h*.2],[x+w*.55,y+h*.6],[x+w*.05,y+h*.7]],
    {fill:"#7E8072",opacity:.35});
  return s;
}
/* a painted-out sign board, the ghost of whatever it advertised */
function deadSign(x,y,w,h,seed,label){
  const rand=rng(seed+79);
  let s=R(x,y,w,h,"#2E3236")+R(x,y,w,h,"#000",{opacity:.25});
  for(let i=0;i<6;i++) s+=R(x+between(rand,0,w*.8),y+between(rand,0,h*.8),
    between(rand,8,w*.3),between(rand,4,h*.3),"#3D4247",{opacity:.6});
  if(label) s+=TX(x+w/2,y+h/2+4,label,{"text-anchor":"middle","font-size":Math.min(h*.5,18),
    fill:"#575C61","font-family":"var(--mono)","letter-spacing":".16em",opacity:.7});
  s+=R(x-3,y-3,w+6,h+6,"none",{stroke:C.metalD,"stroke-width":2,opacity:.55});
  return s;
}

/* ---- atmosphere ------------------------------------------------------------------- */
function defs(o){
  o=o||{};
  return T("defs",null,
    T("linearGradient",{id:"svSky",x1:0,y1:0,x2:0,y2:1},
      T("stop",{offset:"0%","stop-color":o.skyTop||C.skyTop})+
      T("stop",{offset:"52%","stop-color":o.skyMid||C.skyMid})+
      T("stop",{offset:"100%","stop-color":o.skyLow||C.skyLow}))+
    T("radialGradient",{id:"svVig",cx:"50%",cy:"46%",r:"72%"},
      T("stop",{offset:"58%","stop-color":"#000","stop-opacity":"0"})+
      T("stop",{offset:"100%","stop-color":"#000","stop-opacity":"0.42"}))+
    T("linearGradient",{id:"svHaze",x1:0,y1:0,x2:0,y2:1},
      T("stop",{offset:"0%","stop-color":o.skyLow||C.skyLow,"stop-opacity":"0"})+
      T("stop",{offset:"42%","stop-color":o.skyLow||C.skyLow,"stop-opacity":"0.6"})+
      T("stop",{offset:"100%","stop-color":o.skyLow||C.skyLow,"stop-opacity":"0"}))+
    T("filter",{id:"svGrain"},
      T("feTurbulence",{type:"fractalNoise",baseFrequency:"0.85",numOctaves:"3",result:"n"})+
      T("feColorMatrix",{type:"saturate",values:"0"})+
      T("feComponentTransfer",null,T("feFuncA",{type:"linear",slope:"0.16"}))));
}
function haze(y,h){ return R(0,y,1200,h,"url(#svHaze)",{opacity:.75}); }
function finish(){
  return R(0,0,1200,700,"url(#svVig)")+
    R(0,0,1200,700,"#B9B2A0",{opacity:.05,filter:"url(#svGrain)"});
}

NYC.svkit={T,G,R,PT,PG,LN,EL,TX,A,r2,rng,pick,between,C,
  sky,clouds,rain,skyline,ground,potholes,cracksField,crack,cracksOn,
  stone,streaks,column,colonnade,cornice,archPath,voussoirs,
  windows,shopfront,fireEscape,
  ivy,sapling,treeMass,weedLine,grass,
  flood,car,busWreck,rubble,trafficSignal,lamp,figure,birds,scaffold,deadSign,
  defs,haze,finish};
})();
