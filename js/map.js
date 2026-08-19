/* ===================================================================================
   NYC 2050 — map renderer. Builds the survey sheet in SVG and owns the view state
   (pan, zoom, fly-to), the projection, and the place-naming used everywhere else.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, D=NYC.data;
const SVGNS="http://www.w3.org/2000/svg";

/* ---- projection: the Manhattan grid runs 29 deg east of north --------------------- */
const A=29*Math.PI/180, CA=Math.cos(A), SA=Math.sin(A);
const PX=(x,y)=>x*CA+y*SA, PY=(x,y)=>x*SA-y*CA;
const P=(x,y)=>[PX(x,y),PY(x,y)];
/* inverse, for turning a click back into grid space */
const INV=(px,py)=>[px*CA+py*SA, px*SA-py*CA];

const el=(t,a)=>{const n=document.createElementNS(SVGNS,t);
  for(const k in a) if(a[k]!=null) n.setAttribute(k,a[k]); return n;};
const poly=pts=>pts.map(p=>P(p[0],p[1]).join(",")).join(" ");
const pathOf=pts=>pts.map((p,i)=>(i?"L":"M")+P(p[0],p[1]).join(" ")).join("");

const DISP={FLOODED:"#3D6B8F",COLLAPSED:"#8F2222",SALVAGE:"#B4741A",SEALED:"#5A5852",
  STANDING:"#2C2C2A",OCCUPIED:"#3F6B3A",UNSURVEYED:"#8A8880"};
const BIG=new Set(["District","Lifeline","Park"]);
const MAJOR=new Set([14,23,34,42,57,59,72,86,96,110,125,145,155,168,181,190,207]);

/* ---- place naming ----------------------------------------------------------------- */
function inPoly(x,y,pts){
  let hit=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
    if((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}
function onManhattan(x,y){ return y>=-352&&y<=1740 && x>=D.WX(y)&&x<=D.EX(y); }
function nearestAve(x,y){
  let best=null,bd=1e9;
  for(const a of D.AVES){ if(y<a[2]||y>a[3])continue;
    const d=Math.abs(x-a[1]); if(d<bd){bd=d;best=a[0];} }
  return bd<40?best:null;
}
function nearestThru(x,y,boro){
  let best=null,bd=1e9;
  for(const t of D.THRU){ if(boro&&t[4]!==boro)continue;
    for(const p of t[1]){ const d=Math.hypot(p[0]-x,p[1]-y); if(d<bd){bd=d;best=t[0];} }
  }
  return bd<70?best:null;
}
/* returns a short survey-style location string for any grid point */
function describe(x,y){
  x=+x; y=+y;
  if(onManhattan(x,y)){
    const s=Math.round(y/8);
    let street = y>=4 ? (x<0?"W ":"E ")+s+" ST" : null;
    if(!street){ const near=nearestThru(x,y,"MN"); street=near?near.toUpperCase():"BELOW HOUSTON"; }
    const av=nearestAve(x,y);
    return "MANHATTAN · "+street+(av?" nr "+av.toUpperCase():"");
  }
  if(inPoly(x,y,D.BKQN)){
    const boro = y<150 ? "BROOKLYN" : "QUEENS";
    const t=nearestThru(x,y,boro==="BROOKLYN"?"BK":"QN");
    return boro+(t?" · nr "+t.toUpperCase():"");
  }
  if(inPoly(x,y,D.BRONX)){
    const t=nearestThru(x,y,"BX");
    return "THE BRONX"+(t?" · nr "+t.toUpperCase():"");
  }
  if(inPoly(x,y,D.NJ)) return "NEW JERSEY · FAR SHORE";
  if(inPoly(x,y,D.ROOSEVELT)) return "ROOSEVELT ISLAND";
  if(inPoly(x,y,D.RANDALLS)) return "RANDALL'S ISLAND";
  if(inPoly(x,y,D.LIBERTY)) return "LIBERTY ISLAND";
  if(inPoly(x,y,D.ELLIS)) return "ELLIS ISLAND";
  if(inPoly(x,y,D.GOVERNORS)) return "GOVERNORS ISLAND";
  if(y<-360) return "UPPER BAY · OPEN WATER";
  if(y>1100&&x>0) return "HARLEM RIVER";
  return x<0 ? "HUDSON RIVER" : "EAST RIVER";
}
function bandOf(y){ for(const b of D.BANDS) if(y>=b[0]&&y<b[1]) return b[3]; return "OUTER"; }
/* the sheet's own grid reference, printed on every pin */
function gridRef(x,y){
  const ns=(y<0?"S":"N")+String(Math.abs(Math.round(y))).padStart(4,"0");
  const ew=(x<0?"W":"E")+String(Math.abs(Math.round(x))).padStart(3,"0");
  return "GR "+ew+"/"+ns;
}

/* =================================================================================== */
function init(opts){
  const svg=opts.svg, stage=opts.stage;
  const gRoot=el("g",{}); svg.appendChild(gRoot);
  const L={};
  ["sea","land","band","cover","fab","fabhaz","park","grid","thru","bway","shore","cross","thrulab",
   "haz","deb","hgt","pin","upin","halo","lab"].forEach(k=>{L[k]=el("g",{}); gRoot.appendChild(L[k]);});

  const defs=el("defs",{});
  defs.innerHTML='<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" '+
   'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#2C2C2A" '+
   'stroke-width="1" stroke-opacity="0.13"/></pattern>'+
   '<pattern id="flood" width="8" height="8" patternUnits="userSpaceOnUse" '+
   'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#F7D9D9" '+
   'stroke-width="1" stroke-opacity="0.42"/></pattern>';
  svg.insertBefore(defs,gRoot);

  /* --- water and the far landmasses --- */
  L.sea.appendChild(el("rect",{x:-4000,y:-4000,width:8000,height:8000,fill:"var(--water)"}));
  [[D.NJ,"var(--far)"],[D.BKQN,"var(--land)"],[D.BRONX,"var(--land)"],[D.RANDALLS,"var(--land)"],
   [D.ROOSEVELT,"var(--land)"],[D.LIBERTY,"var(--land)"],[D.ELLIS,"var(--land)"],
   [D.GOVERNORS,"var(--land)"]].forEach(([p,f])=>
    L.land.appendChild(el("polygon",{points:poly(p),fill:f,stroke:"#82807A","stroke-width":.8})));

  /* --- Manhattan outline and the habitability bands --- */
  function islandPts(y0,y1){
    const pts=[],step=12;
    for(let y=y0;y<=y1;y+=step) pts.push([D.WX(y),y]);
    pts.push([D.WX(y1),y1]);
    for(let y=y1;y>=y0;y-=step) pts.push([D.EX(y),y]);
    pts.push([D.EX(y0),y0]);
    return pts;
  }
  D.BANDS.forEach(b=>{
    const p=islandPts(b[0],b[1]);
    L.band.appendChild(el("polygon",{points:poly(p),fill:b[2]}));
    if(b[3]==="INUNDATED") L.band.appendChild(el("polygon",{points:poly(p),fill:"url(#flood)"}));
  });
  L.park.appendChild(el("polygon",{points:poly(D.CPARK),fill:"var(--park)",
    stroke:"#33482350","stroke-width":.8}));
  /* outer-borough green: Prospect, Green-Wood, Fort Greene, Astoria, Flushing Meadows,
     Bronx Park, Inwood Hill, Morningside, Van Cortlandt */
  D.PARKS.slice(1).forEach(p=>
    L.park.appendChild(el("polygon",{points:poly(p),fill:"var(--park)",
      stroke:"#33482350","stroke-width":.8})));

  /* --- undocumented ground --- */
  D.GAPS.forEach(g=>L.cover.appendChild(el("polygon",
    {points:poly(islandPts(g[0],g[1])),fill:"url(#hatch)"})));

  /* --- the numbered grid --- */
  function line(x1,y1,x2,y2,cls,w,op){
    const a=P(x1,y1),b=P(x2,y2);
    return el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls,
      stroke:"#2C2C2A","stroke-width":w||.7,"stroke-opacity":op||.28,"stroke-linecap":"round"});
  }
  for(let s=1;s<=218;s++){
    const y=s*8; if(y>1735) break;
    const w=D.WX(y),e=D.EX(y);
    if(y>=472&&y<=880){
      L.grid.appendChild(line(w,y,-72,y,"g3",.6,.24));
      L.grid.appendChild(line(0,y,e,y,"g3",.6,.24));
    } else {
      const cls=MAJOR.has(s)?"g1":(s%10===0?"g2":"g3");
      L.grid.appendChild(line(w,y,e,y,cls,MAJOR.has(s)?1.1:.6,MAJOR.has(s)?.4:.24));
    }
  }
  D.AVES.forEach(a=>L.grid.appendChild(
    line(a[1],a[2],a[1],a[3],"g"+a[4],a[4]===1?1.2:.8,a[4]===1?.42:.3)));

  /* --- named thoroughfares, drawn as paths so their names can ride them --- */
  const KIND={ave:{w:1.15,op:.42,c:"#2C2C2A"}, st:{w:.85,op:.34,c:"#2C2C2A"},
    pkwy:{w:1.2,op:.4,c:"#3A4A32"}, hwy:{w:1.35,op:.38,c:"#4A4842",dash:"none"},
    walk:{w:.9,op:.5,c:"#4E6B3A",dash:"3 3"}};
  D.THRU.forEach((t,i)=>{
    const [nm,pts,tier,kind]=t, k=KIND[kind]||KIND.st;
    /* keep every label reading left to right in projected space */
    const a=P(pts[0][0],pts[0][1]), b=P(pts[pts.length-1][0],pts[pts.length-1][1]);
    const ordered = a[0]<=b[0] ? pts : pts.slice().reverse();
    const id="thru"+i, d=pathOf(ordered);
    L.thru.appendChild(el("path",{d:d,fill:"none",stroke:k.c,
      "stroke-width":tier===1?k.w*1.35:k.w,"stroke-opacity":tier===1?k.op*1.15:k.op,
      "stroke-linejoin":"round","stroke-linecap":"round",
      "stroke-dasharray":k.dash&&k.dash!=="none"?k.dash:null,
      class:"g"+tier}));
    defs.appendChild(el("path",{id:id,d:d,fill:"none"}));
    const tp=document.createElementNS(SVGNS,"textPath");
    tp.setAttribute("href","#"+id);
    tp.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href","#"+id);
    tp.setAttribute("startOffset","50%");
    tp.setAttribute("text-anchor","middle");
    tp.textContent=nm.toUpperCase();
    const txt=el("text",{"font-size":(tier===1?1.13:1)+"em",dy:"-0.34em",
      class:"tlab g"+tier});
    txt.appendChild(tp);
    L.thrulab.appendChild(txt);
  });
  /* Broadway keeps its own weight */
  L.bway.appendChild(el("polyline",{points:D.BROADWAY.map(p=>P(p[0],p[1]).join(",")).join(" "),
    fill:"none",stroke:"#2C2C2A","stroke-width":1.5,"stroke-opacity":.5,
    "stroke-linejoin":"round","stroke-linecap":"round"}));

  L.shore.appendChild(el("polygon",{points:poly(islandPts(-352,1740)),fill:"none",
    stroke:"#4A4842","stroke-width":1.4}));

  D.CROSS.forEach(c=>{
    const a=P(c[0],c[1]),b=P(c[2],c[3]);
    L.cross.appendChild(el("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
      stroke:"#F2EFE6","stroke-width":1.8,"stroke-dasharray":"6 7","stroke-opacity":.9}));
  });

  /* --- landmarks --- */
  const marks=D.LANDMARKS.map((d,i)=>({
    i, name:d[0], x:d[1], y:d[2], cat:d[3], disp:d[4], tier:d[5], note:d[6]||"",
    scene:D.SCENE_OF[d[0]]||null
  }));
  const nodes=new Map(), shapes=new Map();
  marks.forEach(m=>{
    const [px,py]=P(m.x,m.y);
    const c=DISP[m.disp]||"#2C2C2A";
    const g=el("g",{class:"pin t"+m.tier,style:"cursor:pointer"});
    const sym=el("g",{class:"sym"});
    const r=m.cat==="Lifeline"?5.6:BIG.has(m.cat)?4.4:3.2;
    if(m.cat==="Lifeline"){
      sym.appendChild(el("rect",{x:px-r,y:py-r,width:r*2,height:r*2,
        transform:`rotate(45 ${px} ${py})`,fill:c,stroke:"#FAF9F5","stroke-width":1.1}));
    } else {
      sym.appendChild(el("circle",{cx:px,cy:py,r:r,fill:c,stroke:"#FAF9F5","stroke-width":1}));
    }
    if(m.scene){ /* a site with a street-view plate carries a ring */
      sym.appendChild(el("circle",{cx:px,cy:py,r:r+2.6,fill:"none",stroke:c,
        "stroke-width":.9,"stroke-opacity":.85}));
    }
    sym.appendChild(el("circle",{cx:px,cy:py,r:13,fill:"transparent"}));
    g.appendChild(sym);
    shapes.set(m.name,{node:sym.firstChild,base:c,text:null,g:g});
    const t=el("text",{x:px,y:py,dx:(m.cat==="District"?.62:.82)+"em",dy:".38em",
      "font-size":(m.cat==="District"?1.22:1)+"em",
      class:"mlab"+(m.cat==="District"?" dist":"")});
    t.textContent=m.cat==="District"?m.name.toUpperCase():m.name;
    g.appendChild(t);
    g.addEventListener("click",e=>{e.stopPropagation(); opts.onMark&&opts.onMark(m);});
    L.pin.appendChild(g);
    nodes.set(m.name,g);
  });

  /* --- street and avenue labels --- */
  const LABBASE=8;
  function lab(txt,x,y,size,cls,layer){
    const [px,py]=P(x,y);
    const t=el("text",{x:px,y:py,"font-size":(size/LABBASE)+"em",
      class:"slab "+(cls||""),"text-anchor":"middle"});
    t.textContent=txt; (layer||L.lab).appendChild(t); return t;
  }
  const named=new Map(D.CROSSTOWN.map(c=>[c[0],c]));
  for(let s=5;s<=215;s+=5){
    const y=s*8; if(y>1720) break;
    const n=named.get(s);
    lab(n?n[1].toUpperCase():(s+(s%10===0?" ST":"")), D.WX(y)+(n?22:13), y,
      n?7.2:6.4, n?("g"+n[2]):(MAJOR.has(s)?"g2":"g3"));
  }
  /* the named crosstown streets again, out in the middle of the island, so a reader
     zoomed into Midtown can still tell which street they are standing on */
  D.CROSSTOWN.forEach(c=>{
    if(c[2]>2) return;
    const y=c[0]*8, mid=(D.WX(y)+D.EX(y))/2;
    lab(c[1].toUpperCase(), mid, y-3, c[2]===1?7.4:6.8, "g"+(c[2]+1));
  });
  D.AVES.forEach(a=>{
    if(a[4]>2) return;
    const y=Math.min(a[3]-40,Math.max(a[2]+60,240));
    lab(a[0].toUpperCase(),a[1],y,6.6,"g2");
  });
  lab("BROADWAY",-30,300,6.8,"g2");
  lab("HUDSON RIVER",-230,700,12,"g1");
  lab("EAST RIVER",250,560,11,"g1");
  lab("UPPER BAY",60,-460,11,"g1");
  lab("HARLEM RIVER",120,1300,8,"g2");
  lab("NEWTOWN CREEK",258,150,7,"g2");
  lab("GOWANUS CANAL",196,-244,6.6,"g3");
  D.CROSS.forEach(c=>lab(c[4].toUpperCase(),(c[0]+c[2])/2,(c[1]+c[3])/2-14,6.2,"g3"));
  lab("SURVEY LINE — NO DATA NORTH",-30,1096,9,"g1");
  lab("UNSURVEYED",-70,1420,15,"g1");

  /* =========================== view state ========================================= */
  let sc=1,tx=0,ty=0;
  function apply(){
    gRoot.setAttribute("transform",`translate(${tx} ${ty}) scale(${sc})`);
    /* labels are laid out in map space but sized in screen space, so a zoom moves
       them without inflating them */
    svg.style.setProperty("--symk",(1/sc).toFixed(3));
    L.hgt.style.setProperty("--symk",(1/sc).toFixed(3));
    L.pin.style.fontSize=(8.6/sc)+"px";
    L.upin.style.fontSize=(9/sc)+"px";
    L.lab.style.fontSize=(8/sc)+"px";
    L.thrulab.style.fontSize=(6/sc)+"px";
    document.querySelectorAll(".g1,.g2,.g3,.t1,.t2,.t3").forEach(n=>{
      const c=n.classList; let show=true;
      if(c.contains("g3")||c.contains("t3")) show=sc>=2.1;
      else if(c.contains("g2")||c.contains("t2")) show=sc>=0.9;
      n.style.display=show?"":"none";
    });
  }
  function bounds(){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(let y=-352;y<=1740;y+=40){[D.WX(y),D.EX(y)].forEach(x=>{
      const [a,b]=P(x,y); x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);});}
    return [x0,y0,x1,y1];
  }
  function fit(){
    const w=svg.clientWidth||innerWidth, h=svg.clientHeight||innerHeight;
    const [x0,y0,x1,y1]=bounds(), pad=70;
    sc=Math.min((w-pad*2)/(x1-x0),(h-pad*2-60)/(y1-y0));
    sc=Math.max(0.3,Math.min(sc,1.4));
    tx=w/2-(x0+x1)/2*sc; ty=(h+40)/2-(y0+y1)/2*sc;
    apply();
  }
  function zoomAt(f,cx,cy){
    const ns=Math.max(0.3,Math.min(8,sc*f));
    const k=ns/sc; tx=cx-(cx-tx)*k; ty=cy-(cy-ty)*k; sc=ns; apply();
  }
  /* screen point -> grid point */
  function toGrid(clientX,clientY){
    const r=svg.getBoundingClientRect();
    const mx=(clientX-r.left-tx)/sc, my=(clientY-r.top-ty)/sc;
    return INV(mx,my);
  }
  function toScreen(x,y){
    const [a,b]=P(x,y), r=svg.getBoundingClientRect();
    return [a*sc+tx+r.left, b*sc+ty+r.top];
  }
  let anim=null;
  function flyTo(x,y,target){
    const w=svg.clientWidth||innerWidth, h=svg.clientHeight||innerHeight;
    const [a,b]=P(x,y);
    const ns=target||Math.max(sc,2.6);
    const nx=w/2-a*ns, ny=h/2-b*ns;
    const s0=sc,x0=tx,y0=ty,t0=performance.now(),dur=520;
    if(anim) cancelAnimationFrame(anim);
    (function step(t){
      const k=Math.min(1,(t-t0)/dur), e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
      sc=s0+(ns-s0)*e; tx=x0+(nx-x0)*e; ty=y0+(ny-y0)*e; apply();
      if(k<1) anim=requestAnimationFrame(step);
    })(t0);
  }

  /* --- selection halo --- */
  let halo=null;
  function highlight(x,y){
    const [px,py]=P(x,y);
    if(!halo){ halo=el("circle",{r:11,fill:"none",stroke:"#C4472A","stroke-width":1.6,
      "stroke-opacity":.9}); L.halo.appendChild(halo); }
    halo.setAttribute("cx",px); halo.setAttribute("cy",py);
    halo.style.display="";
  }
  function clearHighlight(){ if(halo) halo.style.display="none"; }

  /* --- user pins ------------------------------------------------------------------ */
  function renderPins(pins,starred){
    while(L.upin.firstChild) L.upin.removeChild(L.upin.firstChild);
    (pins||[]).forEach(p=>{
      const [px,py]=P(p.x,p.y);
      const g=el("g",{style:"cursor:pointer"});
      const sym=el("g",{class:"usym"});
      /* a dropped-pin teardrop, drawn upright regardless of the sheet rotation */
      sym.appendChild(el("path",{d:`M${px} ${py} l-4.6 -7.4 a5.4 5.4 0 1 1 9.2 0 Z`,
        fill:"var(--mark)",stroke:"#FAF9F5","stroke-width":1.1,"stroke-linejoin":"round"}));
      sym.appendChild(el("circle",{cx:px,cy:py-9.4,r:1.9,fill:"#FAF9F5"}));
      sym.appendChild(el("circle",{cx:px,cy:py-6,r:13,fill:"transparent"}));
      g.appendChild(sym);
      const t=el("text",{x:px,y:py,dx:".8em",dy:"-0.9em",class:"ulab"});
      t.textContent=p.name;
      g.appendChild(t);
      g.addEventListener("click",e=>{e.stopPropagation(); opts.onPin&&opts.onPin(p);});
      L.upin.appendChild(g);
    });
    /* a star on any bookmarked landmark */
    (starred||[]).forEach(nm=>{
      const m=marks.find(m=>m.name===nm); if(!m) return;
      const [px,py]=P(m.x,m.y);
      const s=el("text",{x:px,y:py,dx:"-0.5em",dy:"-0.6em",class:"star"});
      s.textContent="★";
      L.upin.appendChild(s);
    });
  }

  /* --- pointer: pan, pinch, wheel -------------------------------------------------- */
  const ptrs=new Map(); let last=null,pd=0,moved=0;
  stage.addEventListener("pointerdown",e=>{
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    stage.classList.add("drag"); moved=0;
    if(ptrs.size===1) last={x:e.clientX,y:e.clientY};
    if(ptrs.size===2){const[a,b]=[...ptrs.values()];pd=Math.hypot(a.x-b.x,a.y-b.y);}
  });
  stage.addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId))return;
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1&&last){
      const dx=e.clientX-last.x, dy=e.clientY-last.y;
      moved+=Math.abs(dx)+Math.abs(dy);
      tx+=dx; ty+=dy; last={x:e.clientX,y:e.clientY}; apply();
    } else if(ptrs.size===2){
      const [a,b]=[...ptrs.values()], nd=Math.hypot(a.x-b.x,a.y-b.y);
      if(pd>0) zoomAt(nd/pd,(a.x+b.x)/2,(a.y+b.y)/2);
      pd=nd; moved+=6;
    }
  });
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>
    stage.addEventListener(ev,e=>{ptrs.delete(e.pointerId);
      if(ptrs.size<2)pd=0; if(ptrs.size===0){last=null;stage.classList.remove("drag");}}));
  stage.addEventListener("wheel",e=>{e.preventDefault();
    zoomAt(Math.pow(0.9986,e.deltaY),e.clientX,e.clientY);},{passive:false});
  stage.addEventListener("click",e=>{
    if(moved>6) return;                 /* a drag is not a click */
    opts.onGround&&opts.onGround(toGrid(e.clientX,e.clientY),e);
  });
  addEventListener("resize",fit);

  /* --- hazard overlay: the geometry a projection produces at one hour ----------- */
  function clearHazard(){
    [L.haz,L.deb].forEach(g=>{ while(g.firstChild) g.removeChild(g.firstChild); });
  }
  function drawHazard(frame){
    clearHazard();
    if(!frame) return;
    let target=L.haz;
    const add=n=>target.appendChild(n);
    const rectsPath=list=>list.map(r=>{
      const a=P(r[0],r[1]), b=P(r[0]+r[2],r[1]), c=P(r[0]+r[2],r[1]+r[3]), d=P(r[0],r[1]+r[3]);
      return "M"+a+"L"+b+"L"+c+"L"+d+"Z";
    }).join("");
    if(frame.burnt&&frame.burnt.length)
      add(el("path",{d:rectsPath(frame.burnt),fill:"#37332E","fill-opacity":.52}));
    if(frame.flood&&frame.flood.length)
      add(el("path",{d:rectsPath(frame.flood),fill:"#3D6B8F","fill-opacity":.62}));
    if(frame.fire&&frame.fire.length)
      add(el("path",{d:rectsPath(frame.fire),fill:"#C4472A","fill-opacity":.85}));
    (frame.cones||[]).forEach(pts=>
      add(el("polygon",{points:poly(pts),fill:"#8F2222","fill-opacity":.42,
        stroke:"#8F2222","stroke-width":1,"stroke-opacity":.7})));
    (frame.dust||[]).forEach(d=>{
      const [px,py]=P(d.x,d.y);
      add(el("circle",{cx:px,cy:py,r:d.r,fill:"#8A8377","fill-opacity":.28}));
    });
    (frame.rings||[]).forEach((r,i)=>{
      const [px,py]=P(r.x,r.y);
      add(el("circle",{cx:px,cy:py,r:r.r,fill:"#8F2222",
        "fill-opacity":i===0?.5:.12,stroke:"#8F2222","stroke-width":1.2,
        "stroke-opacity":.75}));
    });
    if(frame.debris){
      target=L.deb;
      const d=frame.debris, o=P(d.origin[0],d.origin[1]);
      let far="",near="";
      d.rays.forEach(r=>{
        const a=P(r.x1,r.y1), b=P(r.x2,r.y2);
        const seg="M"+a[0]+" "+a[1]+"L"+b[0]+" "+b[1];
        if(r.through) far+=seg; else near+=seg;
      });
      add(el("path",{d:near,fill:"none",stroke:"#8A8377","stroke-width":.6,
        "stroke-opacity":.4,"stroke-linecap":"round"}));
      add(el("path",{d:far,fill:"none",stroke:"#B4741A","stroke-width":.9,
        "stroke-opacity":.75,"stroke-linecap":"round"}));
      let hit="";
      d.impacts.forEach(i=>{
        const p=P(i.x,i.y);
        hit+="M"+(p[0]-1.6)+" "+p[1]+"a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0";
      });
      add(el("path",{d:hit,fill:"#8F2222","fill-opacity":.75}));
      add(el("circle",{cx:o[0],cy:o[1],r:3,fill:"#8F2222"}));
      target=L.haz;
    }
    if(frame.quake){
      const [px,py]=P(frame.quake.x,frame.quake.y), k=frame.quake.faint?.45:1;
      for(let i=1;i<=5;i++)
        add(el("circle",{cx:px,cy:py,r:i*Math.pow(10,frame.quake.mag/3)*1.6,fill:"none",
          stroke:"#8F2222","stroke-width":1.4,"stroke-opacity":(.5/i+.12)*k,
          "stroke-dasharray":"5 5"}));
      add(el("path",{d:`M${px-9} ${py}L${px+9} ${py}M${px} ${py-9}L${px} ${py+9}`,
        stroke:"#8F2222","stroke-width":2.2,"stroke-opacity":k}));
      add(el("circle",{cx:px,cy:py,r:5,fill:"none",stroke:"#8F2222","stroke-width":2,
        "stroke-opacity":k}));
    }
  }
  /* --- the built fabric ---------------------------------------------------------- */
  const HGT_RAMP=[[12,"#D9D2C2"],[20,"#CFC4AC"],[35,"#C0B092"],[60,"#A89478"],
                  [120,"#8C7A60"],[1e9,"#6B5B46"]];
  const fabColour={
    use:b=>NYC.fabric.USES[b.use].colour,
    era:b=>NYC.fabric.ERAS[b.era].colour,
    height:b=>{ for(const r of HGT_RAMP) if(b.height<r[0]) return r[1]; return "#6B5B46"; }
  };
  let fabMode=null;
  function blockPath(b){
    let d="M";
    b.pts.forEach((p,i)=>{ const q=P(p[0],p[1]); d+=(i?"L":"")+r1(q[0])+" "+r1(q[1]); });
    return d+"Z";
  }
  const r1=n=>Math.round(n*10)/10;
  function drawFabric(mode){
    fabMode=mode;
    while(L.fab.firstChild) L.fab.removeChild(L.fab.firstChild);
    /* with the fabric up the habitability band becomes a wash under it */
    L.band.style.opacity=mode?".34":"";
    L.cover.style.opacity=mode?".5":"";
    if(!mode){ L.fab.style.display="none"; return; }
    L.fab.style.display="";
    const blocks=NYC.fabric.build(), col=fabColour[mode], buckets=new Map();
    blocks.forEach(b=>{
      const c=col(b);
      if(!buckets.has(c)) buckets.set(c,[]);
      buckets.get(c).push(blockPath(b));
    });
    buckets.forEach((paths,c)=>
      L.fab.appendChild(el("path",{d:paths.join(""),fill:c,"fill-opacity":.97,
        stroke:"#6E675C","stroke-width":.22,"stroke-opacity":.45})));
  }
  function paintFabricStates(states){
    while(L.fabhaz.firstChild) L.fabhaz.removeChild(L.fabhaz.firstChild);
    if(!states) return;
    const blocks=NYC.fabric.build(), buckets=new Map();
    for(let i=0;i<blocks.length;i++){
      const st=states[i];
      if(st==null||st>=4) continue;            /* HELD blocks stay as they were */
      const c=NYC.sim.STATES[st][2];
      if(!buckets.has(c)) buckets.set(c,[]);
      buckets.get(c).push(blockPath(blocks[i]));
    }
    buckets.forEach((paths,c)=>
      L.fabhaz.appendChild(el("path",{d:paths.join(""),fill:c,"fill-opacity":.8})));
  }

  /* --- structure heights, drawn as the shadow of the thing itself --------------- */
  let hgtOn=false;
  function buildHeights(){
    if(L.hgt.firstChild) return;
    const H=NYC.heights;
    marks.slice().sort((a,b)=>a.y-b.y).forEach(m=>{
      const h=H.heightOf(m);
      if(h<25) return;
      const [px,py]=P(m.x,m.y);
      /* a bar in screen space, so it reads as elevation and not as ground */
      const len=Math.min(58,3+h*0.105);
      const col=h>=200?"#8F2222":h>=90?"#B4741A":"#4A4842";
      const g=el("g",{class:"hbar"});
      g.appendChild(el("line",{x1:px,y1:py,x2:px,y2:py-len,
        stroke:"#FAF9F5","stroke-opacity":.75,"stroke-width":3,"stroke-linecap":"round"}));
      g.appendChild(el("line",{x1:px,y1:py,x2:px,y2:py-len,
        stroke:col,"stroke-opacity":.85,"stroke-width":1.5,"stroke-linecap":"round"}));
      g.appendChild(el("circle",{cx:px,cy:py-len,r:2.1,fill:col,
        stroke:"#FAF9F5","stroke-width":.9}));
      L.hgt.appendChild(g);
    });
  }
  function setHeights(on){
    hgtOn=on;
    if(on) buildHeights();
    L.hgt.style.display=on?"":"none";
  }
  setHeights(false);

  /* --- outcome colours over the survey's own dispositions ---------------------- */
  let painted=false;
  function paintOutcomes(names,states){
    painted=true;
    shapes.forEach((sh,name)=>{
      const st=states?states.get(name):null;
      if(st==null){ sh.node.setAttribute("fill","#B4B2A9"); sh.node.style.opacity=".35"; return; }
      sh.node.setAttribute("fill",st.colour);
      sh.node.style.opacity = st.state==="HELD" ? ".42" : "1";
    });
  }
  function clearOutcomes(){
    if(!painted) return;
    painted=false;
    shapes.forEach(sh=>{ sh.node.setAttribute("fill",sh.base); sh.node.style.opacity=""; });
  }

  const api={ marks, layers:L, fit, zoomAt, flyTo, apply, toGrid, toScreen,
    drawHazard, clearHazard, paintOutcomes, clearOutcomes, setHeights,
    drawFabric, paintFabricStates, get fabricMode(){return fabMode;},
    renderPins, highlight, clearHighlight, project:P,
    get scale(){return sc;},
    setCoverage(on){ L.cover.style.display=on?"":"none"; },
    setThoroughfares(on){ L.thru.style.display=L.thrulab.style.display=on?"":"none"; },
    markByName(n){ return marks.find(m=>m.name===n); },
    node(n){ return nodes.get(n); }
  };
  fit();
  return api;
}

NYC.map={init,describe,bandOf,gridRef,DISP,project:P,inPoly};
})();
