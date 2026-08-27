/* ===================================================================================
   Adrinem — the city plate viewer. Opens over the world sheet, draws what
   adrinem-city.js generated, and lets it be read block by block.

   Everything is laid out in metres with the origin on the great market, and the plate
   is drawn true to the bearings the world sheet gave it: north is where the export
   says north is, and the roads leave by the bearings they arrive on.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const SVGNS="http://www.w3.org/2000/svg";
const el=(t,a)=>{const n=document.createElementNS(SVGNS,t);
  for(const k in a) if(a[k]!=null) n.setAttribute(k,a[k]); return n;};
const clear=g=>{ while(g.firstChild) g.removeChild(g.firstChild); };
const q=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;"}[c]));
const path=pts=>pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join("");

const SEA="#7C97A6", SHOAL="#93A9B4";
const SYM_M=18, SYM_PX=17;      /* symbols drawn 18 m across, shown 17 px across */
const STREET={way:"#9C8C6C",quay:"#A2947A",great:"#B0A184",ring:"#C0B69B",
  minor:"#CCC3AB"};
const WIDTH={way:44,quay:26,great:17,ring:11,minor:7};

/* what a landmark is drawn as */
const MARK={
  harbour:{sym:"anchor", col:"#3A5A6B"}, staple:{sym:"star", col:"#8A5A12"},
  civic:{sym:"dot", col:"#3F5F78"},      merchant:{sym:"dot", col:"#7A5A2A"},
  store:{sym:"square", col:"#7A6634"},   yard:{sym:"square", col:"#7A5C36"},
  garrison:{sym:"tower", col:"#4A4842"}, noxious:{sym:"cross", col:"#6A4A38"},
  waggon:{sym:"square", col:"#6E6042"},  gate:{sym:"gate", col:"#2C2C2A"}
};

let city=null, view=null, sel=null;

/* =================================================================================== */
function draw(c){
  const svg=q("cpMap"); clear(svg);
  const root=el("g",{}); svg.appendChild(root);
  const L={};
  ["ground","water","marsh","block","street","wall","route","mark","lab"]
    .forEach(k=>{L[k]=el("g",{}); root.appendChild(L[k]);});

  const defs=el("defs",{});
  defs.innerHTML=
    /* the tiles are in metres, so they have to be tens of them to be seen at all */
    '<pattern id="reed" width="46" height="46" patternUnits="userSpaceOnUse">'+
    '<rect width="46" height="46" fill="#A8B99B"/>'+
    '<path d="M10 46 V22 M30 46 V10" stroke="#6E7F62" stroke-width="4" fill="none"/>'+
    '</pattern>'+
    '<pattern id="water" width="74" height="74" patternUnits="userSpaceOnUse">'+
    '<rect width="74" height="74" fill="'+SEA+'"/>'+
    '<path d="M0 37 q18 -13 37 0 t37 0" stroke="#8FA7B4" stroke-width="4.5" '+
    'fill="none"/></pattern>';
  svg.insertBefore(defs,root);

  const S=c.S, W=c.water, R=S.reach*1.9;

  /* ---- the country the city stands in ---- */
  L.ground.appendChild(el("rect",{x:-R,y:-R,width:R*2,height:R*2,fill:"#E7E2CE"}));

  /* ---- the marsh, on the bearing the export put it ---- */
  if(c.site.marshBearing!=null){
    const g=A.city._geom, b=c.site.marshBearing, st=c.plan.staple;
    const pts=[];
    for(let k=0;k<=22;k++){
      const t=-38+k*(76/22);
      pts.push(g.add(st,g.vec(b+t,S.reach*(0.82+0.10*Math.sin(k*1.7)))));
    }
    for(let k=22;k>=0;k--){
      const t=-38+k*(76/22);
      pts.push(g.add(st,g.vec(b+t,S.reach*(1.45+0.08*Math.cos(k*2.1)))));
    }
    L.marsh.appendChild(el("path",{d:path(pts)+"Z",fill:"url(#reed)","fill-opacity":.85}));
  }

  /* ---- the water: the open sea, and the basin cut into it ---- */
  const coast=[];
  for(let s=-R;s<=R;s+=60) coast.push(W.coastOf(s));
  const seaward=[W.coastOf(R),
    A.city._geom.add(W.coastOf(R),A.city._geom.mul(W.n,R*1.6)),
    A.city._geom.add(W.coastOf(-R),A.city._geom.mul(W.n,R*1.6)),
    W.coastOf(-R)];
  L.water.appendChild(el("path",{d:path(coast.concat(seaward.slice(1)))+"Z",
    fill:"url(#water)"}));
  L.water.appendChild(el("path",{d:path(W.basin)+"Z",fill:"url(#water)"}));
  /* the shoal inside the basin, so the deep water reads as deep */
  L.water.appendChild(el("path",{d:path(W.basin)+"Z",fill:"none",stroke:SHOAL,
    "stroke-width":34,"stroke-opacity":.5}));
  L.water.appendChild(el("path",{d:path(coast)+path(W.basin)+"Z",fill:"none",
    stroke:"#3A4A52","stroke-width":2.4,"stroke-opacity":.75}));
  /* the spit that shelters the mouth */
  L.water.appendChild(el("path",{d:path(W.spit),fill:"none",stroke:"#E7E2CE",
    "stroke-width":3,"stroke-opacity":0}));

  /* ---- the streets, drawn as the ground they take up.
         A street stops at the water like everything else, so each line is broken into
         the runs of it that are on land. ---- */
  const dry=p=>W.room(p)>S.quayClear*0.35;
  function onLand(pts,closed){
    const list=closed?pts.concat([pts[0]]):pts;
    const runs=[]; let run=[];
    list.forEach(p=>{
      if(dry(p)) run.push(p);
      else { if(run.length>1) runs.push(run); run=[]; }
    });
    if(run.length>1) runs.push(run);
    return runs;
  }
  ["minor","ring","great","quay","way"].forEach(cls=>{
    let d="";
    c.streets.filter(s=>s.cls===cls).forEach(s=>
      onLand(s.pts,s.closed).forEach(r=>{ d+=path(r); }));
    if(d) L.street.appendChild(el("path",{d:d,fill:"none",stroke:STREET[cls],
      "stroke-width":WIDTH[cls],"stroke-linejoin":"round","stroke-linecap":"round",
      class:"st st-"+cls}));
    if(d&&cls==="way") L.street.appendChild(el("path",{d:d,fill:"none",stroke:"#7A6B4E",
      "stroke-width":9,"stroke-opacity":.5,"stroke-linecap":"round",
      "stroke-dasharray":"46 30",class:"st st-way"}));
  });

  /* ---- the market square itself: the one piece of open paved ground ---- */
  L.block.appendChild(el("circle",{cx:c.plan.staple[0],cy:c.plan.staple[1],
    r:S.ring0*0.92,fill:"#D8C9A2",stroke:"#A2947A","stroke-width":4}));

  /* ---- the blocks ---- */
  paintBlocks(L.block);

  /* ---- the wall ---- */
  const wall=el("g",{});
  wall.appendChild(el("path",{d:path(c.wall.ring),fill:"none",stroke:"#4A463C",
    "stroke-width":13,"stroke-linejoin":"round","stroke-linecap":"round"}));
  wall.appendChild(el("path",{d:path(c.wall.ring),fill:"none",stroke:"#6E6857",
    "stroke-width":7,"stroke-linejoin":"round","stroke-linecap":"round"}));
  c.wall.towers.forEach(p=>wall.appendChild(el("circle",{cx:p[0],cy:p[1],r:11,
    fill:"#4A463C",stroke:"#E7E2CE","stroke-width":2})));
  if(c.inner){
    /* the wall round consecrated ground: thinner, and it does not open for traffic */
    wall.appendChild(el("path",{d:path(c.inner.ring),fill:"#8E7BA8","fill-opacity":.12,
      stroke:"#5A4A70","stroke-width":16,"stroke-linejoin":"round"}));
    wall.appendChild(el("path",{d:path(c.inner.ring),fill:"none",stroke:"#A897C0",
      "stroke-width":7,"stroke-linejoin":"round"}));
    c.inner.towers.forEach(p=>wall.appendChild(el("circle",{cx:p[0],cy:p[1],r:7,
      fill:"#6B5A82",stroke:"#E7E2CE","stroke-width":1.6})));
  }
  L.wall.appendChild(wall);

  /* ---- the through-way, drawn over the top of the town it goes round ---- */
  if(c.plan.corridor){
    const d=path(c.plan.corridor);
    L.route.appendChild(el("path",{d:d,fill:"none",stroke:"#E7E2CE","stroke-width":9,
      "stroke-linecap":"round","stroke-linejoin":"round",
      "vector-effect":"non-scaling-stroke"}));
    L.route.appendChild(el("path",{d:d,fill:"none",stroke:"#6E5A34","stroke-width":5,
      "stroke-linecap":"round","stroke-linejoin":"round",
      "vector-effect":"non-scaling-stroke"}));
    /* and the line it would have taken if it were allowed to */
    const a=c.plan.corridor[0], b=c.plan.corridor[c.plan.corridor.length-1];
    L.route.appendChild(el("path",{d:path([a,b]),fill:"none",stroke:"#8F2222",
      "stroke-width":1.6,"stroke-opacity":.55,"stroke-dasharray":"7 7",
      "vector-effect":"non-scaling-stroke"}));
  }

  /* ---- the named ground ---- */
  paintMarks(L.mark,L.lab);

  view=makeView(svg,root,L);
  return view;
}

/* --- blocks, one path per colour, as on the world sheet --------------------------- */
let blockMode="use";
function blockColour(b){
  if(blockMode==="use") return A.city.USES[b.use].colour;
  if(blockMode==="storeys"){
    const r=["#E3DCC4","#D3C7A2","#C0AE82","#A99167","#8E7550","#71593B"];
    return r[Math.max(0,Math.min(r.length-1,b.storeys))];
  }
  const d=b.people/(b.area/10000);           /* persons a hectare */
  const r=["#EFE9D6","#DED2AE","#CBB585","#B69561","#9B7444","#7C542F","#5C3922"];
  return r[Math.max(0,Math.min(r.length-1,Math.floor(d/110)))];
}
function paintBlocks(g){
  clear(g);
  const by=new Map();
  city.blocks.forEach(b=>{
    const col=blockColour(b), d=path(b.poly)+"Z";
    const cur=by.get(col); if(cur) cur.push(d); else by.set(col,[d]);
  });
  by.forEach((frags,col)=>g.appendChild(el("path",{d:frags.join(""),fill:col,
    stroke:"#6E6857","stroke-width":1,"stroke-opacity":.32})));
}

/* --- landmarks -------------------------------------------------------------------- */
function paintMarks(g,labg){
  clear(g); clear(labg);
  city.landmarks.forEach((m,ix)=>{
    const k=MARK[m.kind]||MARK.civic, x=m.p[0], y=m.p[1];
    const node=el("g",{class:"cmk",style:"cursor:pointer"});
    const sym=el("g",{class:"csym"});
    if(k.sym==="anchor"){
      sym.appendChild(el("path",{d:`M${x} ${y-9} v14 M${x-6} ${y-5} h12 M${x-7} ${y+2}
        a7 7 0 0 0 14 0`,fill:"none",stroke:k.col,"stroke-width":2.2,
        "stroke-linecap":"round"}));
    } else if(k.sym==="star"){
      let d="";
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5, r=i%2?4:10;
        d+=(i?"L":"M")+(x+Math.cos(a)*r).toFixed(1)+" "+(y+Math.sin(a)*r).toFixed(1);
      }
      sym.appendChild(el("path",{d:d+"Z",fill:k.col,stroke:"#FAF9F5","stroke-width":1.4}));
    } else if(k.sym==="tower"){
      sym.appendChild(el("path",{d:`M${x-7} ${y+8} v-13 h3 v-4 h3 v4 h2 v-4 h3 v4 h3 v13 Z`,
        fill:k.col,stroke:"#FAF9F5","stroke-width":1.2}));
    } else if(k.sym==="gate"){
      sym.appendChild(el("path",{d:`M${x-8} ${y+8} v-9 a8 8 0 0 1 16 0 v9 Z`,
        fill:"#FAF9F5",stroke:k.col,"stroke-width":2.2}));
    } else if(k.sym==="square"){
      sym.appendChild(el("rect",{x:x-6,y:y-6,width:12,height:12,fill:k.col,
        stroke:"#FAF9F5","stroke-width":1.4}));
    } else if(k.sym==="cross"){
      sym.appendChild(el("path",{d:`M${x-6} ${y-6} l12 12 M${x+6} ${y-6} l-12 12`,
        stroke:k.col,"stroke-width":2.6,"stroke-linecap":"round"}));
    } else {
      sym.appendChild(el("circle",{cx:x,cy:y,r:6,fill:"#FAF9F5",stroke:k.col,
        "stroke-width":2.4}));
    }
    node.appendChild(sym);
    g.appendChild(node);

    /* the harbour, the market and the gates are always named; the rest wait for the
       reader to come closer, or the middle of the plate is a wall of type */
    const tier=(m.kind==="harbour"||m.kind==="staple"||m.kind==="gate")?1:
      (m.kind==="garrison"||m.kind==="noxious")?2:3;
    const t=el("text",{x:x,y:y,dx:"0.95em",dy:"0.34em",class:"cplab l"+tier});
    t.textContent=m.name;
    labg.appendChild(t);
  });
}

/* =================================================================================== */
/*  view state                                                                         */
/* =================================================================================== */
function makeView(svg,root,L){
  let sc=1,tx=0,ty=0;
  const stage=q("cpStage");
  function apply(){
    root.setAttribute("transform",`translate(${tx} ${ty}) scale(${sc})`);
    const k=Math.max(0.7,Math.min(1.2,Math.sqrt(sc/0.16)));
    L.lab.style.fontSize=(11*k/sc)+"px";
    /* The symbols are drawn at SYM_M metres across so they sit in the plan while it is
       being built; on screen they want to be the same size at every zoom, so they are
       scaled by whatever turns SYM_M metres into SYM_PX pixels. */
    svg.style.setProperty("--csymk",
      Math.max(0.5,Math.min(14,SYM_PX/(SYM_M*sc))).toFixed(3));
    L.street.querySelectorAll(".st-minor").forEach(n=>n.style.display=sc<0.10?"none":"");
    svg.querySelectorAll(".cplab").forEach(n=>{
      const c=n.classList;
      n.style.display=(c.contains("l3")&&sc<0.13)||(c.contains("l2")&&sc<0.09)||sc<0.05
        ?"none":"";
    });
  }
  /* Fit to the ground that was actually built on, with the harbour thrown in, rather
     than to the radius the generator was allowed to reach. */
  let box=null;
  function extent(){
    if(box) return box;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    const eat=p=>{ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0];
      if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; };
    /* The town, its wall and its water set the frame. The outlying marks on the spit
       and the open shore are pulled in afterwards, but only so far: a beacon a mile
       out must not shrink the city to a thumbnail to make room for itself. */
    city.blocks.forEach(b=>b.poly.forEach(eat));
    city.wall.ring.forEach(eat);
    city.water.basin.forEach(eat);
    const cx=(x0+x1)/2, cy=(y0+y1)/2, hw=(x1-x0)/2, hh=(y1-y0)/2;
    city.landmarks.forEach(m=>{
      x0=Math.min(x0,Math.max(m.p[0],cx-hw*1.3)); x1=Math.max(x1,Math.min(m.p[0],cx+hw*1.3));
      y0=Math.min(y0,Math.max(m.p[1],cy-hh*1.3)); y1=Math.max(y1,Math.min(m.p[1],cy+hh*1.3));
    });
    return (box=[x0,y0,x1,y1]);
  }
  function fit(){
    const w=svg.clientWidth||innerWidth, h=svg.clientHeight||innerHeight;
    const [x0,y0,x1,y1]=extent();
    const insetL=20,insetR=70,insetT=66,insetB=20;
    const availW=Math.max(80,w-insetL-insetR), availH=Math.max(80,h-insetT-insetB);
    sc=Math.max(0.01,Math.min(2,Math.min(availW/(x1-x0),availH/(y1-y0))));
    tx=insetL+(availW-(x1-x0)*sc)/2-x0*sc;
    ty=insetT+(availH-(y1-y0)*sc)/2-y0*sc;
    apply();
  }
  function zoomAt(f,cx,cy){
    const ns=Math.max(0.02,Math.min(3,sc*f));
    const k=ns/sc; tx=cx-(cx-tx)*k; ty=cy-(cy-ty)*k; sc=ns; apply();
  }
  function toMap(clientX,clientY){
    const r=svg.getBoundingClientRect();
    return [(clientX-r.left-tx)/sc,(clientY-r.top-ty)/sc];
  }
  const ptrs=new Map(); let last=null,pd=0,moved=0;
  stage.addEventListener("pointerdown",e=>{
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    moved=0; if(ptrs.size===1) last={x:e.clientX,y:e.clientY};
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
      if(ptrs.size<2)pd=0; if(ptrs.size===0)last=null;}));
  stage.addEventListener("wheel",e=>{e.preventDefault();
    zoomAt(Math.pow(0.9986,e.deltaY),e.clientX,e.clientY);},{passive:false});
  /* One hit test for the whole plate, in map space. Hanging a listener on each symbol
     looks tidier and does not survive the pointer capture the pan uses — the click
     arrives at the stage, not at the mark. A named place wins over the block it stands
     on, within the radius its symbol is actually drawn at. */
  stage.addEventListener("click",e=>{
    if(moved>6) return;
    const p=toMap(e.clientX,e.clientY);
    const m=markAt(p,SYM_PX*0.85/sc);
    if(m) { showMark(m); return; }
    const b=blockAt(p);
    if(b) showBlock(b); else hideRead();
  });
  fit();
  return {fit:fit,apply:apply,zoomAt:zoomAt,toMap:toMap,
    repaint(){paintBlocks(L.block);},
    get scale(){return sc;}};
}

function markAt(p,radius){
  let best=null,bd=Infinity;
  city.landmarks.forEach(m=>{
    const d=Math.hypot(m.p[0]-p[0],m.p[1]-p[1]);
    if(d<bd){bd=d;best=m;}
  });
  return bd<=radius?best:null;
}
function blockAt(p){
  let best=null,bd=Infinity;
  city.blocks.forEach(b=>{
    const d=Math.hypot(b.c[0]-p[0],b.c[1]-p[1]);
    if(d<bd){bd=d;best=b;}
  });
  if(!best||bd>320) return null;
  return inside(best.poly,p)?best:(bd<90?best:null);
}
function inside(poly,p){
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
       p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}

/* =================================================================================== */
/*  reading the plate                                                                  */
/* =================================================================================== */
function hideRead(){ q("cpRead").classList.remove("on"); sel=null; }
function showBlock(b){
  sel=b;
  const u=A.city.USES[b.use];
  q("cpRNm").textContent=u.label;
  q("cpRMeta").textContent=
    Math.round(b.area).toLocaleString()+" m² of ground · "+
    Math.round(b.coverage*100)+"% built · "+b.storeys+" storey"+(b.storeys===1?"":"s")+
    " · "+Math.round(b.floor).toLocaleString()+" m² of floor";
  const code=q("cpRCode");
  code.textContent=b.use.toUpperCase(); code.style.background=u.colour;
  const dens=b.people/(b.area/10000);
  q("cpRNote").textContent=
    (b.people>0?b.people.toLocaleString()+" people live on this block, "+
      Math.round(dens)+" to the hectare. ":"Nobody lives on this block. ")+
    (b.toWater<300?"It stands "+Math.round(b.toWater)+" m from the water. ":"")+
    Math.round(Math.hypot(b.c[0]-city.plan.centre[0],b.c[1]-city.plan.centre[1]))+
    " m from the "+(city.archetype==="crossing"?"Temple Rock":"Staple")+", "+
    (b.r<city.S.wallR?"inside":"outside")+" the wall"+
    (b.sacred?", inside the interdict":"")+
    (b.onWay?", on the through-way":"")+
    (b.onRoad&&!b.onWay?", on a road out":"")+
    ". Generated fabric, not a surveyed street.";
  q("cpRead").classList.add("on");
}
function showMark(m){
  q("cpRNm").textContent=m.name;
  q("cpRMeta").textContent=(m.kind==="gate"?"GATE OF THE WALL":m.kind.toUpperCase())+
    " · "+Math.round(Math.hypot(m.p[0]-city.plan.staple[0],
      m.p[1]-city.plan.staple[1])).toLocaleString()+" m from the Staple";
  const code=q("cpRCode");
  code.textContent=(MARK[m.kind]||MARK.civic).sym==="anchor"?"HARBOUR":m.kind.toUpperCase();
  code.style.background=(MARK[m.kind]||MARK.civic).col;
  q("cpRNote").textContent=m.note;
  q("cpRead").classList.add("on");
}

/* =================================================================================== */
/*  the key and the account                                                            */
/* =================================================================================== */
function fillKey(){
  let h="";
  if(blockMode==="use"){
    h+="<b>THE FABRIC — BY USE</b>";
    Object.keys(A.city.USES).forEach(k=>{
      const u=A.city.USES[k], v=city.byUse[k];
      if(!v) return;
      h+='<i style="background:'+u.colour+'"></i>'+u.label.toUpperCase()+
        ' <span style="opacity:.6">'+(v.area/10000).toFixed(0)+' ha</span><br>';
    });
  } else if(blockMode==="storeys"){
    h+="<b>THE FABRIC — BY STOREYS</b>"+
      '<i style="background:#E3DCC4"></i>NONE OR ONE<br>'+
      '<i style="background:#C0AE82"></i>TWO<br>'+
      '<i style="background:#A99167"></i>THREE<br>'+
      '<i style="background:#8E7550"></i>FOUR<br>'+
      '<i style="background:#71593B"></i>FIVE<br>';
  } else {
    h+="<b>THE FABRIC — BY DENSITY</b>"+
      '<span style="display:inline-block;vertical-align:-2px;margin-right:6px">'+
      ["#EFE9D6","#DED2AE","#CBB585","#B69561","#9B7444","#7C542F","#5C3922"]
        .map(c=>'<i style="background:'+c+';width:9px;margin:0;border-radius:0"></i>').join("")+
      '</span>0 → 770 A HECTARE<br>';
  }
  h+='<b>ON THE PLATE</b>'+
    '<i style="background:'+STREET.quay+'"></i>QUAY &nbsp;'+
    '<i style="background:'+STREET.great+'"></i>GREAT STREET<br>'+
    '<i style="background:'+STREET.ring+'"></i>RING &nbsp;'+
    '<i style="background:'+STREET.minor+'"></i>MINOR<br>'+
    '<i style="background:#4A463C"></i>THE WALL, ITS TOWERS AND GATES<br>'+
    (city.inner?'<i style="background:#6B5A82"></i>THE INTERDICT WALL · '+
      'CONSECRATED GROUND<br>'+
      '<i style="background:#6E5A34"></i>THE THROUGH-WAY, AND IN RED THE LINE IT '+
      'WOULD TAKE IF IT COULD<br>':'')+
    '<i style="background:url(#reed) #A8B99B"></i>MARSH AND THE SALT PANS<br>'+
    '<b>KEYS</b>F FABRIC &nbsp; K KEY &nbsp; ESC OUT';
  q("cpKey").innerHTML=h;
}

/* How much of the continent's overland trade actually passes through this cell. Seventeen
   least-cost trees, so it is worked out when the account is first opened and not before. */
let betCache=null;
function pairsThrough(cell){
  if(betCache) return betCache.of(cell);
  /* Count only the pairs a burg lies strictly between — a road that ends at a place
     does not pass through it — and count every burg in the same seventeen trees, so
     "more than anywhere else" can be checked rather than asserted. */
  const cells=A.data.markets.map(m=>m.cell);
  const between=new Map(), touching=new Map();
  A.burgs.forEach(b=>{ between.set(b.cell,0); touching.set(b.cell,0); });
  const bump=(m,k)=>{ if(m.has(k)) m.set(k,m.get(k)+1); };
  let total=0;
  for(let x=0;x<cells.length;x++){
    const {dist,prev}=A.route.from(cells[x]);
    for(let y=x+1;y<cells.length;y++){
      const a=cells[x], b=cells[y];
      if(!isFinite(dist[b])) continue;
      total++;
      bump(touching,a); bump(touching,b);
      for(let n=prev[b];n>=0&&n!==a;n=prev[n]){ bump(between,n); bump(touching,n); }
    }
  }
  const order=m=>[...m.entries()].sort((p,q)=>q[1]-p[1]);
  const rB=order(between), rT=order(touching);
  const nameOf=c=>(A.burgOf(c)||{}).name||"—";
  betCache={
    of(c){
      const iB=rB.findIndex(r=>r[0]===c), iT=rT.findIndex(r=>r[0]===c);
      return {
        cell:c, total:total, burgs:A.burgs.length,
        between:between.get(c)||0, betweenRank:iB+1,
        betweenLeader:rB[0]?nameOf(rB[0][0]):null, betweenLeaderN:rB[0]?rB[0][1]:0,
        touching:touching.get(c)||0, touchingRank:iT+1,
        touchingLeader:rT[0]?nameOf(rT[0][0]):null
      };
    }
  };
  return betCache.of(cell);
}

/* How far the land runs before the sea stops it, on the four winds. */
function neckOf(cell){
  const C=A.cells, out={};
  [["north",-90],["south",90],["east",0],["west",180]].forEach(([nm,deg])=>{
    const dx=Math.cos(deg*Math.PI/180), dy=Math.sin(deg*Math.PI/180);
    let d=0;
    for(;d<420;d+=4) if(!A.isLand(A.cellAt(C.x[cell]+dx*d,C.y[cell]+dy*d))) break;
    out[nm]=d>=420?null:Math.round(d*A.meta.scale);
  });
  return out;
}

let acctFor=null;
function fillAccount(force){
  if(!force&&acctFor===city) return;
  acctFor=city;
  const s=city.stats, st=city.site, doc=city.doctrine;
  const row=(k,v)=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>';
  const pc=n=>Math.round(n/s.population*100)+"%";

  let h='<dl class="acct">'+
    row("People",s.population.toLocaleString())+
    row("Within the wall",s.inside.toLocaleString()+" ("+pc(s.inside)+")")+
    (city.archetype==="crossing"?
      row("In the strangers' wards",s.wardPeople.toLocaleString()+" ("+
        pc(s.wardPeople)+")"):
      row("In the suburbs",s.outside.toLocaleString()))+
    row("Built ground",Math.round(s.areaHa).toLocaleString()+" ha")+
    row("Intramural",Math.round(s.wallHa).toLocaleString()+" ha")+
    (city.archetype==="crossing"?
      row("Consecrated ground",Math.round(s.sacredHa).toLocaleString()+" ha")+
      row("Ground on the way",Math.round(s.wayHa).toLocaleString()+" ha"):"")+
    row("Density in / out",Math.round(s.densityInside)+" / "+
      Math.round(s.densityOutside)+" a hectare")+
    row("Blocks",s.blocks.toLocaleString())+
    row("Streets",s.streets.toLocaleString())+
    (city.archetype==="crossing"?
      row("The through-way",Math.round(s.corridorM).toLocaleString()+" m")+
      row("Straight between its gates",Math.round(s.gateGapM).toLocaleString()+" m")+
      row("The detour",s.detour.toFixed(2)+"× — "+
        Math.round(s.corridorM-s.gateGapM).toLocaleString()+" m of extra road")+
      row("Wall",s.wallGates+" gates, "+s.innerGates+" posterns"):
      row("Quay",Math.round(s.quayM).toLocaleString()+" m")+
      row("Wall",s.wallGates+" gates, "+s.wallTowers+" towers"))+
    '</dl>';

  /* ---- what the export says ---- */
  h+='<p class="grp">WHAT THE EXPORT SAYS</p><ul class="why">';
  const why=[];
  if(city.archetype==="crossing"){
    const trunks=st.roads.filter(r=>r.cls==="trunk").sort((a,b)=>b.uses-a.uses);
    const b=pairsThrough(st.cell), neck=neckOf(st.cell);
    let widest=0;
    for(let i=0;i<trunks.length;i++) for(let j=i+1;j<trunks.length;j++)
      widest=Math.max(widest,Math.abs(((trunks[i].bearing-trunks[j].bearing+540)%360)-180));
    why.push(["Two trunk roads, "+Math.round(widest)+"° apart",
      "the only market on the sheet with more than one — so this is a road with a "+
      "city on it, and it is laid out that way round"]);
    trunks.forEach(t=>why.push([
      "The "+(t.leadsTo||"trunk")+" road leaves "+bear(t.bearing),
      t.uses+" of the "+A.data.report.market_pairs+" market pairs"+
      (t.leadsTo?", reaching "+t.leadsTo+" in "+t.leadsIn+" after "+t.leadsHops+
        " cells":"")]));
    why.push([b.touching+" of "+b.total+" reachable market pairs touch this place",
      Math.round(b.touching/b.total*100)+" per cent of every overland trade on the "+
      "sheet — "+(b.touchingRank===1?("first of the "+b.burgs+" burgs in Adrinem"):
        ("ranked "+b.touchingRank+" of "+b.burgs+", behind "+b.touchingLeader))]);
    why.push([b.between+" of them are only passing through",
      "counting the pairs it lies between and not the ones it is an end of, which "+
      (b.betweenRank===1?("is more than anywhere else in Adrinem"):
        ("puts it "+b.betweenRank+" of "+b.burgs+", behind "+b.betweenLeader+" on "+
         b.betweenLeaderN+" — its own neighbour on the same trunk"))+
      ". That is the traffic the city has to move and cannot sell to."]);
    if(neck.north!=null||neck.south!=null)
      why.push(["The land runs out "+
        [neck.north!=null?neck.north+" mi north":null,
         neck.south!=null?neck.south+" mi south":null].filter(Boolean).join(" and "),
        "and continues past the edge of the search east and west — this is a neck, "+
        "and the road has nowhere else to be"]);
    why.push(["The sea lies "+bear(st.seaBearing)+", harbour "+st.harbour,
      "two sea contacts and no shelter worth the name, so the sea is the lesser road "+
      "here and the bend goes the other way"]);
  } else {
    why.push(["The sea lies "+bear(st.seaBearing),
      "cell "+st.cell+" touches exactly one water cell, and that is the bearing of it"]);
    why.push(["The haven has one mouth","harbour value "+st.harbour+
      " — one sea contact, so a basin that is entered and not sailed through"]);
    why.push(["The town is on the "+dirOf(st.landBearing)+" shore",
      "that is where the hinterland is; on the other shore every road out would cross "+
      "the harbour"]);
    st.roads.forEach(r=>why.push([
      (r.leadsTo||"A road")+" arrives "+bear(r.bearing),
      r.cls+", carrying "+r.uses+" of the "+A.data.report.market_pairs+" market pairs"]));
  }
  why.push(["No river, so cisterns",
    "r=0 on this cell and on every cell that touches it"]);
  if(st.riseBearing!=null) why.push(["The ground rises "+bear(st.riseBearing),
    "the highest neighbouring cell, height "+st.riseHeight+" against "+st.height+
    " here — "+(city.archetype==="crossing"?"the quarries and the sulphur climb it":
      "the citadel sits on it")]);
  if(st.marshBearing!=null) why.push(["The marsh is "+bear(st.marshBearing),
    "the neighbouring Wetland cell is that way, and so is everything that stinks"]);
  why.push(["The biome is "+st.biome,
    st.biome==="Volcanic"?"so the city is quarried out of its own hill and there is "+
      "nothing else here worth building with":"which is what the going costs are "+
      "priced from"]);
  why.push(["The wall is "+Math.round(city.S.wallR).toLocaleString()+" m out",
    "the radius enclosing three-quarters of the people, solved rather than chosen"]);
  why.forEach(([a,b])=>h+='<li><b>'+esc(a)+'</b><span>'+esc(b)+'</span></li>');
  h+='</ul>';

  /* ---- and what it does not ---- */
  if(doc){
    h+='<p class="grp">THE DOCTRINE — NOT FROM THE EXPORT</p>'+
      '<p class="empty">The map file says nothing about religion. '+esc(doc.name)+
      ' is the author\'s, stated as a premise; these are the things on the plate that '+
      'follow from it rather than from the data.</p><ul class="why">';
    const dw=[
      ["The plan is struck from the sanctuary","not from a market — "+
        Math.round(s.sacredHa).toLocaleString()+" ha of consecrated ground inside a "+
        "wall of its own, with "+s.innerGates+" posterns and no gate a waggon can use"],
      ["The through-way is bent round it","the road may not cross the precinct, so it "+
        "runs "+s.detour.toFixed(2)+"× the straight line between its own gates — "+
        Math.round(s.corridorM-s.gateGapM).toLocaleString()+
        " metres of extra road on every crossing of Adrinem made by land"],
      ["The strangers sleep outside","no stranger may lodge on consecrated ground, so "+
        s.wardPeople.toLocaleString()+" people — "+pc(s.wardPeople)+
        " of the city — live in two wards at the ends of the way"],
      ["The named trades are exiled","tanning and slaughter go beyond the wall by "+
        "doctrine rather than by wind, which is why they are on the lesser road and "+
        "not downwind"]
    ];
    dw.forEach(([a,b])=>h+='<li><b>'+esc(a)+'</b><span>'+esc(b)+'</span></li>');
    h+='</ul>';
  }

  /* ---- the reachable world ---- */
  h+='<p class="grp">WHAT IT CAN REACH</p><ul class="why">';
  st.seaOnly.forEach(m=>h+='<li><b>'+esc(m.name)+' · '+m.pop.toLocaleString()+
    '</b><span>'+esc(m.state)+' — no overland way at any price</span></li>');
  st.overland.slice(0,5).forEach(m=>h+='<li><b>'+esc(m.name)+' · '+
    m.pop.toLocaleString()+'</b><span>'+Math.round(m.cost).toLocaleString()+
    ' effective miles, '+Math.round(m.cost/A.meta.supplyDivisor)+' days over land</span></li>');
  h+='</ul>';

  h+='<p class="empty">The head count is the export\u2019s. Everything else on this '+
    'plate is generated from the site by the rules above — no street here was '+
    'surveyed, and none of it is a claim about what is there.</p>';
  q("cpAcct").innerHTML=h;
}
const COMPASS=["east","south-east","south","south-west","west","north-west","north",
  "north-east"];
function dirOf(deg){
  return deg==null?"nowhere":COMPASS[(Math.round(((deg%360)+360)%360/45))%8];
}
function bear(deg){ return deg==null?"nowhere":"to the "+dirOf(deg); }

/* =================================================================================== */
/*  open and close                                                                     */
/* =================================================================================== */
function open(cell){
  const host=q("cityPlate");
  host.classList.add("on");
  q("cpName").textContent=(A.burgOf(cell)||{name:"…"}).name;
  q("cpSub").textContent="LAYING OUT THE GROUND…";
  /* let the panel paint before the generator takes the thread */
  setTimeout(()=>{
    const t0=performance.now();
    city=A.city.generate(cell);
    const ms=Math.round(performance.now()-t0);
    if(!city){ host.classList.remove("on"); return; }
    const st=city.site;
    q("cpName").textContent=st.name;
    q("cpSub").textContent=
      st.province.toUpperCase()+" · "+st.state.toUpperCase()+" · "+
      st.pop.toLocaleString()+" PEOPLE · HARBOUR "+st.harbour+" · "+
      city.stats.blocks.toLocaleString()+" BLOCKS GENERATED IN "+ms+" MS";
    draw(city);
    fillKey(); acctFor=null; q("cpAcct").innerHTML=""; hideRead();
  },30);
}
function close(){ q("cityPlate").classList.remove("on"); }

function boot(){
  q("cpClose").onclick=close;
  q("cpReadX").onclick=hideRead;
  q("cpKeyBtn").onclick=()=>{
    const on=q("cpKey").classList.toggle("on");
    q("cpKeyBtn").setAttribute("aria-pressed",String(on));
  };
  q("cpAcctBtn").onclick=()=>{
    const on=q("cpAcct").classList.toggle("on");
    q("cpAcctBtn").setAttribute("aria-pressed",String(on));
    if(on){ q("cpAcct").innerHTML='<p class="empty">Working out how much of the '+
      'continent goes through here…</p>';
      setTimeout(()=>fillAccount(),20); }
  };
  const modes=["use","storeys","density"];
  q("cpFabBtn").onclick=()=>{
    blockMode=modes[(modes.indexOf(blockMode)+1)%modes.length];
    q("cpFabBtn").textContent=blockMode==="use"?"USE":blockMode==="storeys"?"HGT":"DENS";
    view&&view.repaint(); fillKey();
  };
  q("cpIn").onclick=()=>view&&view.zoomAt(1.4,innerWidth/2,innerHeight/2);
  q("cpOut").onclick=()=>view&&view.zoomAt(1/1.4,innerWidth/2,innerHeight/2);
  q("cpRst").onclick=()=>view&&view.fit();
  /* While the plate is up it owns the keyboard — the world sheet underneath must not
     also act on the key. Caught on the way down, before the sheet's own listener. */
  addEventListener("keydown",e=>{
    if(!q("cityPlate").classList.contains("on")) return;
    if(e.target.matches("input,textarea")) return;
    e.stopPropagation();
    const k=e.key.toLowerCase();
    if(e.key==="Escape") close();
    else if(k==="f") q("cpFabBtn").click();
    else if(k==="k") q("cpKeyBtn").click();
    else if(k==="a") q("cpAcctBtn").click();
    else if(k==="r") q("cpRst").click();
  },true);
  addEventListener("resize",()=>{ if(view&&q("cityPlate").classList.contains("on")) view.fit(); });
}

A.cityview={open:open, close:close, boot:boot,
  has:cell=>{ const b=A.burgOf(cell); return !!(b&&A.portOf(cell)&&A.marketOf(cell)); }};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
