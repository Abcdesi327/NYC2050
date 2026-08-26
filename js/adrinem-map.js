/* ===================================================================================
   Adrinem — plate renderer. Draws the world onto one SVG sheet and owns the view
   state (pan, zoom, fly-to) and the hit testing.

   The ground is 3,817 cells, which is far too many to give each one an element and
   still pan smoothly. Instead every cell's outline is turned into a path fragment
   once, and the layer is drawn as one path per colour — nine or twenty elements
   rather than thousands. Nothing is bound to the DOM, so a tap is resolved back to a
   cell arithmetically, by nearest site, which is what a Voronoi cell means anyway.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const C=A.cells, M=A.meta, D=A.data, PAL=A.palette;
const SVGNS="http://www.w3.org/2000/svg";
const el=(t,a)=>{const n=document.createElementNS(SVGNS,t);
  for(const k in a) if(a[k]!=null) n.setAttribute(k,a[k]); return n;};
const clear=g=>{ while(g.firstChild) g.removeChild(g.firstChild); };

/* the map frame is already north-up and square, so the projection is the identity;
   it stays a function so the rest of the file reads like the survey sheet's does */
const PX=x=>x, PY=y=>y;

/* ---- cell outlines, cut once ------------------------------------------------------ */
let DPATH=null;
function outlines(){
  if(DPATH) return DPATH;
  A.build();
  DPATH=new Array(A.count);
  for(let i=0;i<A.count;i++){
    const p=A.polyOf(i);
    let s="";
    for(let k=0;k<p.length;k+=2) s+=(k?"L":"M")+p[k].toFixed(1)+" "+p[k+1].toFixed(1);
    DPATH[i]=s+"Z";
  }
  return DPATH;
}

/* ---- how the ground is coloured, per mode ----------------------------------------- */
const DEPTH=[PAL.deep,PAL.shelf,"#A5B8C0"];
function waterColour(i){ return DEPTH[Math.min(2,Math.floor(C.h[i]/7))]; }

let catchIx=null;                       /* market cell -> index into the ramp */
function catchmentIndex(){
  if(catchIx) return catchIx;
  catchIx=new Map();
  D.markets.forEach((m,n)=>catchIx.set(m.cell,n));
  return catchIx;
}

let popMax=0; for(let i=0;i<A.count;i++) if(C.pop[i]>popMax) popMax=C.pop[i];
let costMax=0; for(let i=0;i<A.count;i++) if(C.cost[i]>costMax) costMax=C.cost[i];

const MODES={
  biome:{ label:"BIOME", colour:i=>PAL.biome(A.biomeOf(i).name) },
  relief:{ label:"RELIEF", colour:i=>
    PAL.step(PAL.RELIEF,(C.h[i]-M.seaLevel)/(100-M.seaLevel)) },
  realm:{ label:"REALMS", colour:i=>PAL.realm(A.stateOf(i)) },
  culture:{ label:"PEOPLES", colour:i=>PAL.culture(A.cultureOf(i)) },
  catchment:{ label:"CATCHMENTS", colour:i=>{
    const ix=catchmentIndex().get(C.mkt[i]);
    return ix===undefined?"url(#beyond)":PAL.catchment(ix); } },
  supply:{ label:"SUPPLY", colour:i=>
    C.cost[i]<0?"url(#beyond)":PAL.step(PAL.SUPPLY,Math.min(1,C.cost[i]/costMax)) },
  density:{ label:"POPULATION", colour:i=>
    C.pop[i]<=0?"#EFEADA":PAL.step(PAL.DENSITY,Math.sqrt(C.pop[i]/popMax)) },
  habitability:{ label:"HABITABILITY", colour:i=>
    PAL.step(PAL.HAB,A.biomeOf(i).hab/100) }
};

/* =================================================================================== */
function init(opts){
  const svg=opts.svg, stage=opts.stage;
  const gRoot=el("g",{}); svg.appendChild(gRoot);
  const L={};
  ["sea","ground","reach","grat","river","march","coast","road","route",
   "burg","pin","halo","lab"].forEach(k=>{L[k]=el("g",{}); gRoot.appendChild(L[k]);});

  const defs=el("defs",{});
  defs.innerHTML=
    '<pattern id="beyond" width="8" height="8" patternUnits="userSpaceOnUse" '+
    'patternTransform="rotate(45)"><rect width="8" height="8" fill="#E6E2D2"/>'+
    '<line x1="0" y1="0" x2="0" y2="8" stroke="#8A8474" stroke-width="1.1" '+
    'stroke-opacity="0.5"/></pattern>';
  svg.insertBefore(defs,gRoot);

  /* --- the sea, and the frame the plate is cut to --- */
  const F=A.frame;
  L.sea.appendChild(el("rect",{x:F.x0,y:F.y0,width:F.x1-F.x0,height:F.y1-F.y0,
    fill:PAL.sea}));
  /* the plate is cut to a ruled edge, the way an atlas sheet is */
  L.coast.appendChild(el("rect",{x:F.x0,y:F.y0,width:F.x1-F.x0,height:F.y1-F.y0,
    fill:"none",stroke:"#2C2C2A","stroke-width":1.6,"stroke-opacity":.55}));

  /* --- graticule, off the lon/lat the export carried --- */
  (function(){
    const g=L.grat, ink="#2C2C2A";
    const xOf=lon=>(lon-M.lonW)/M.lonPer, yOf=lat=>(lat-M.latN)/M.latPer;
    for(let lon=-180;lon<=180;lon+=15){
      const x=xOf(lon); if(x<F.x0||x>F.x1) continue;
      g.appendChild(el("line",{x1:x,y1:F.y0,x2:x,y2:F.y1,stroke:ink,
        "stroke-width":.4,"stroke-opacity":.16,"stroke-dasharray":"3 5"}));
      const t=el("text",{x:x,y:F.y0,dy:"1.4em",class:"grat"});
      t.textContent=(lon<0?Math.abs(lon)+"°W":lon>0?lon+"°E":"0°"); g.appendChild(t);
    }
    for(let lat=-90;lat<=90;lat+=15){
      const y=yOf(lat); if(y<F.y0||y>F.y1) continue;
      g.appendChild(el("line",{x1:F.x0,y1:y,x2:F.x1,y2:y,stroke:ink,
        "stroke-width":.4,"stroke-opacity":.16,"stroke-dasharray":"3 5"}));
      const t=el("text",{x:F.x0,y:y,dx:"0.6em",dy:"-0.4em",class:"grat"});
      t.textContent=(lat<0?Math.abs(lat)+"°S":lat>0?lat+"°N":"0°"); g.appendChild(t);
    }
  })();

  /* --- the ground, one path per colour --- */
  let mode="biome";
  function paintGround(){
    const d=outlines(), by=new Map();
    const colour=MODES[mode].colour;
    for(let i=0;i<A.count;i++){
      const c=A.isLand(i)?colour(i):waterColour(i);
      const cur=by.get(c); if(cur) cur.push(d[i]); else by.set(c,[d[i]]);
    }
    clear(L.ground);
    by.forEach((frags,c)=>L.ground.appendChild(
      el("path",{d:frags.join(""),fill:c,"shape-rendering":"crispEdges"})));
  }

  /* --- the lines the diagram gives us: coast, marches, rivers --- */
  (function(){
    const coast=[], realm=[], prov=[];
    A.edges().forEach(e=>{
      const seg="M"+e.x1.toFixed(1)+" "+e.y1.toFixed(1)+
                "L"+e.x2.toFixed(1)+" "+e.y2.toFixed(1);
      if(e.b<0){ if(A.isLand(e.a)) coast.push(seg); return; }
      const la=A.isLand(e.a), lb=A.isLand(e.b);
      if(la!==lb){ coast.push(seg); return; }
      if(!la) return;
      if(C.st[e.a]!==C.st[e.b]) realm.push(seg);
      else if(C.pv[e.a]!==C.pv[e.b]) prov.push(seg);
    });
    L.march.appendChild(el("path",{d:prov.join(""),fill:"none",stroke:"#5A564A",
      "stroke-width":.5,"stroke-opacity":.4,"stroke-dasharray":"2.5 2.5",class:"prov"}));
    L.march.appendChild(el("path",{d:realm.join(""),fill:"none",stroke:"#4A463C",
      "stroke-width":1.15,"stroke-opacity":.75,class:"realm"}));
    L.coast.appendChild(el("path",{d:coast.join(""),fill:"none",stroke:"#3A4A52",
      "stroke-width":.85,"stroke-opacity":.9,"stroke-linecap":"round"}));

    /* rivers, thickened by the flux they carry */
    const band=[[],[],[],[]];
    A.rivers().forEach(s=>{
      const b=s.flux>=260?3:s.flux>=110?2:s.flux>=40?1:0;
      band[b].push("M"+s.x1.toFixed(1)+" "+s.y1.toFixed(1)+
                   "L"+s.x2.toFixed(1)+" "+s.y2.toFixed(1));
    });
    band.forEach((segs,b)=>{ if(!segs.length) return;
      L.river.appendChild(el("path",{d:segs.join(""),fill:"none",stroke:PAL.river,
        "stroke-width":(0.7+b*0.75).toFixed(2),"stroke-opacity":.8,
        "stroke-linecap":"round"}));
    });
  })();

  /* --- the trade network --- */
  (function(){
    const R=A.roads, byCls=[[],[],[]];
    for(let k=0;k<R.a.length;k++){
      const a=R.a[k], b=R.b[k];
      byCls[R.cls[k]].push("M"+C.x[a].toFixed(1)+" "+C.y[a].toFixed(1)+
                           "L"+C.x[b].toFixed(1)+" "+C.y[b].toFixed(1));
    }
    const spec=[["trail",PAL.road.trail,.7,"2 2.4"],["road",PAL.road.road,1.35,null],
                ["trunk",PAL.road.trunk,2.3,null]];
    spec.forEach(([name,col,w,dash],ix)=>{
      if(!byCls[ix].length) return;
      L.road.appendChild(el("path",{d:byCls[ix].join(""),fill:"none",stroke:col,
        "stroke-width":w,"stroke-opacity":.85,"stroke-linecap":"round",
        "stroke-dasharray":dash,class:"rd rd-"+name}));
    });
  })();

  /* --- settlements --- */
  const tierOf=p=>p>=800000?1:p>=300000?2:p>=100000?3:4;
  function paintBurgs(){
    clear(L.burg); clear(L.lab);
    /* realm names first, so a burg label never sits under one */
    const acc=new Map();
    for(let i=0;i<A.count;i++){
      if(!A.isLand(i)||!C.st[i]) continue;
      const w=C.pop[i]+1, r=acc.get(C.st[i])||{x:0,y:0,w:0,n:0};
      r.x+=C.x[i]*w; r.y+=C.y[i]*w; r.w+=w; r.n++; acc.set(C.st[i],r);
    }
    let widest=1; acc.forEach(r=>{ if(r.n>widest) widest=r.n; });
    acc.forEach((r,st)=>{
      /* a realm's name is set at a size its ground can carry, so Lecende does not
         shout as loudly as Asra */
      const k=Math.sqrt(r.n/widest);
      const t=el("text",{x:r.x/r.w,y:r.y/r.w,class:"realmlab g1",
        style:"font-size:"+(0.9+k*1.5).toFixed(2)+"em"});
      t.textContent=(D.states[st]||"").toUpperCase();
      L.lab.appendChild(t);
    });

    A.burgs.forEach(b=>{
      const i=b.cell, x=PX(C.x[i]), y=PY(C.y[i]), t=tierOf(b.pop);
      const mk=A.marketOf(i), port=A.portOf(i);
      const g=el("g",{class:"bg t"+t,style:"cursor:pointer"});
      const r=[0,4.4,3.4,2.6,1.9][t];
      if(mk) g.appendChild(el("circle",{cx:x,cy:y,r:r+2.6,fill:"none",
        stroke:"#2C2C2A","stroke-width":1,"stroke-opacity":.85}));
      if(port) g.appendChild(el("path",{d:`M${x-r-4.4} ${y} h${(r+4.4)*2}`,
        stroke:"#3A4A52","stroke-width":.9,"stroke-opacity":.75}));
      g.appendChild(el("circle",{cx:x,cy:y,r:r,fill:"#FAF9F5",stroke:"#2C2C2A",
        "stroke-width":1.1}));
      if(t<=2) g.appendChild(el("circle",{cx:x,cy:y,r:r*0.42,fill:"#2C2C2A"}));
      g.appendChild(el("circle",{cx:x,cy:y,r:Math.max(r+4,7),fill:"transparent"}));
      g.addEventListener("click",e=>{e.stopPropagation(); opts.onBurg&&opts.onBurg(b);});
      L.burg.appendChild(g);

      const lab=el("text",{x:x,y:y,dx:(r+3).toFixed(1),dy:"0.34em",
        class:"burglab g"+Math.min(3,t)});
      lab.textContent=b.name;
      L.lab.appendChild(lab);
    });
  }

  /* =========================== view state ========================================= */
  let sc=1,tx=0,ty=0;
  function apply(){
    gRoot.setAttribute("transform",`translate(${tx} ${ty}) scale(${sc})`);
    /* Labels and symbols are laid out in map space but sized in screen space, so a
       zoom moves them without inflating them. On a phone the whole world fits at
       about a quarter of the scale it does on a desk, and lettering held at a fixed
       number of screen pixels swamps it — so the type is eased down with the plate,
       the way a reduction of an atlas sheet sets its names smaller. */
    const k=Math.max(0.62,Math.min(1.15,Math.sqrt(sc/0.8)));
    L.lab.style.fontSize=(9*k/sc)+"px";
    L.grat.style.fontSize=(8*k/sc)+"px";
    L.pin.style.fontSize=(9*k/sc)+"px";
    svg.style.setProperty("--symk",(1/sc).toFixed(3));
    L.road.querySelectorAll(".rd").forEach(n=>{
      n.style.display=(n.classList.contains("rd-trail")&&sc<1.6)?"none":"";
    });
    L.march.querySelector(".prov").style.display=sc<1.3?"none":"";
    svg.querySelectorAll(".g1,.g2,.g3,.t1,.t2,.t3,.t4").forEach(n=>{
      const c=n.classList; let show=true;
      if(c.contains("g3")||c.contains("t4")) show=sc>=2.4;
      else if(c.contains("g2")||c.contains("t3")) show=sc>=1.2;
      n.style.display=show?"":"none";
    });
  }
  /* The plate is fitted into what is actually free: the header sits over the top and
     the control rail down the right, so centring on the raw viewport pushes the sheet
     under both. */
  const INSET={l:20,r:70,t:62,b:20};
  function fit(){
    const w=svg.clientWidth||innerWidth, h=svg.clientHeight||innerHeight;
    const availW=Math.max(80,w-INSET.l-INSET.r), availH=Math.max(80,h-INSET.t-INSET.b);
    const mw=F.x1-F.x0, mh=F.y1-F.y0;
    sc=Math.max(0.16,Math.min(3,Math.min(availW/mw,availH/mh)));
    tx=INSET.l+(availW-mw*sc)/2-F.x0*sc;
    ty=INSET.t+(availH-mh*sc)/2-F.y0*sc;
    apply();
  }
  function zoomAt(f,cx,cy){
    const ns=Math.max(0.16,Math.min(14,sc*f));
    const k=ns/sc; tx=cx-(cx-tx)*k; ty=cy-(cy-ty)*k; sc=ns; apply();
  }
  function toMap(clientX,clientY){
    const r=svg.getBoundingClientRect();
    return [(clientX-r.left-tx)/sc,(clientY-r.top-ty)/sc];
  }
  let anim=null;
  function flyTo(x,y,target){
    const w=svg.clientWidth||innerWidth, h=svg.clientHeight||innerHeight;
    const ns=target||Math.max(sc,3);
    const nx=w/2-PX(x)*ns, ny=h/2-PY(y)*ns;
    const s0=sc,x0=tx,y0=ty,t0=performance.now(),dur=520;
    if(anim) cancelAnimationFrame(anim);
    (function stepTo(t){
      const k=Math.min(1,(t-t0)/dur), e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
      sc=s0+(ns-s0)*e; tx=x0+(nx-x0)*e; ty=y0+(ny-y0)*e; apply();
      if(k<1) anim=requestAnimationFrame(stepTo);
    })(t0);
  }

  /* --- selection --- */
  let halo=null;
  function highlight(cell){
    if(halo&&!halo.parentNode) halo=null;
    if(!halo){ halo=el("path",{fill:"none",stroke:"#C4472A","stroke-width":2,
      "stroke-opacity":.95,"vector-effect":"non-scaling-stroke"});
      L.halo.appendChild(halo); }
    halo.setAttribute("d",outlines()[cell]);
    halo.style.display="";
  }
  function clearHighlight(){ if(halo) halo.style.display="none"; }

  /* --- a found way --- */
  function drawRoute(cells){
    clear(L.route);
    if(!cells||cells.length<2) return;
    const d=cells.map((i,n)=>(n?"L":"M")+PX(C.x[i]).toFixed(1)+" "+PY(C.y[i]).toFixed(1)).join("");
    L.route.appendChild(el("path",{d:d,fill:"none",stroke:"#FAF9F5","stroke-width":4.4,
      "stroke-opacity":.75,"stroke-linejoin":"round","stroke-linecap":"round"}));
    L.route.appendChild(el("path",{d:d,fill:"none",stroke:"#7A3E8F","stroke-width":2.1,
      "stroke-linejoin":"round","stroke-linecap":"round"}));
    [cells[0],cells[cells.length-1]].forEach((i,n)=>
      L.route.appendChild(el("circle",{cx:PX(C.x[i]),cy:PY(C.y[i]),r:3.6,
        fill:n?"#7A3E8F":"#FAF9F5",stroke:"#7A3E8F","stroke-width":1.8})));
  }
  function clearRoute(){ clear(L.route); }

  /* --- a reach: everything within so many days of one place --- */
  function drawReach(dist,bands){
    clear(L.reach);
    if(!dist) return;
    const d=outlines(), buckets=bands.map(()=>[]);
    for(let i=0;i<A.count;i++){
      if(!A.isLand(i)||!isFinite(dist[i])) continue;
      const days=A.daysOf(dist[i]);
      for(let b=0;b<bands.length;b++)
        if(days<=bands[b]){ buckets[b].push(d[i]); break; }
    }
    buckets.forEach((frags,b)=>{
      if(!frags.length) return;
      L.reach.appendChild(el("path",{d:frags.join(""),fill:"#7A3E8F",
        "fill-opacity":(0.5-b*0.08).toFixed(3),"shape-rendering":"crispEdges"}));
    });
  }
  function clearReach(){ clear(L.reach); }

  /* --- the reader's own marks --- */
  function renderPins(pins){
    clear(L.pin);
    (pins||[]).forEach(p=>{
      const x=PX(p.x), y=PY(p.y);
      const g=el("g",{style:"cursor:pointer"});
      const sym=el("g",{class:"usym"});
      sym.appendChild(el("path",{d:`M${x} ${y} l-4.6 -7.4 a5.4 5.4 0 1 1 9.2 0 Z`,
        fill:"var(--mark)",stroke:"#FAF9F5","stroke-width":1.1,"stroke-linejoin":"round"}));
      sym.appendChild(el("circle",{cx:x,cy:y-9.4,r:1.9,fill:"#FAF9F5"}));
      sym.appendChild(el("circle",{cx:x,cy:y-6,r:13,fill:"transparent"}));
      g.appendChild(sym);
      const t=el("text",{x:x,y:y,dx:".8em",dy:"-0.9em",class:"ulab"});
      t.textContent=p.name; g.appendChild(t);
      g.addEventListener("click",e=>{e.stopPropagation(); opts.onPin&&opts.onPin(p);});
      L.pin.appendChild(g);
    });
  }

  /* --- pointer: pan, pinch, wheel --------------------------------------------------- */
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
    if(moved>6) return;
    const [x,y]=toMap(e.clientX,e.clientY);
    opts.onGround&&opts.onGround(A.cellAt(x,y),x,y,e);
  });
  addEventListener("resize",fit);

  /* --- go --- */
  paintGround(); paintBurgs(); fit();

  return {
    layers:L, fit:fit, apply:apply, zoomAt:zoomAt, flyTo:flyTo, toMap:toMap,
    highlight:highlight, clearHighlight:clearHighlight,
    drawRoute:drawRoute, clearRoute:clearRoute,
    drawReach:drawReach, clearReach:clearReach,
    renderPins:renderPins,
    modes:MODES,
    setMode(m){ if(!MODES[m]) return; mode=m; paintGround(); },
    get mode(){ return mode; },
    setLayer(name,on){ const g=L[name]; if(g) g.style.display=on?"":"none"; },
    get scale(){ return sc; }
  };
}

A.map={init:init, MODES:MODES};
})();
