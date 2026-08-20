/* ===================================================================================
   NYC 2050 — the walking network.
   Everything needed to route across the region is already on the sheet: the avenues,
   the numbered streets, the named thoroughfares, and the handful of crossings that
   still carry weight. This welds them into a graph — nodes at the junctions, edges
   along the roadway, each edge carrying the name of the street it runs on.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, D=NYC.data;

const SNAP=3;                     /* nodes within 30 m of each other are one junction */
const U2M=10;

let G=null;

const key=(x,y)=>Math.round(x/SNAP)+":"+Math.round(y/SNAP);

function build(){
  if(G) return G;
  const t0=(typeof performance!=="undefined")?performance.now():0;
  const nodes=[], byKey=new Map(), edges=[];

  function node(x,y){
    const k=key(x,y);
    let i=byKey.get(k);
    if(i===undefined){
      i=nodes.length;
      nodes.push({i,x,y,adj:[]});
      byKey.set(k,i);
    }
    return i;
  }
  function link(a,b,name,kind){
    if(a===b) return;
    const A=nodes[a], B=nodes[b];
    const len=Math.hypot(A.x-B.x,A.y-B.y)*U2M;
    if(len<1||len>1200) return;                 /* nothing silly */
    for(const r of A.adj) if(r.to===b) return;  /* already joined */
    const e={i:edges.length,a,b,len,name:name||"unnamed",kind:kind||"st",
             mx:(A.x+B.x)/2,my:(A.y+B.y)/2};
    edges.push(e);
    A.adj.push({to:b,e:e.i}); B.adj.push({to:a,e:e.i});
  }

  /* ---- Manhattan: the lattice the commissioners drew ---------------------------- */
  const avenueRows=[];                          /* per street: [[x,label]...] */
  for(let s=-44;s<=217;s++){
    const y=s*8;
    if(y<-352||y>1740) continue;
    const w=D.WX(y), e=D.EX(y);
    if(e-w<8) continue;
    const row=[];
    D.AVES.forEach(a=>{ if(y>=a[2]&&y<=a[3]&&a[1]>w+1&&a[1]<e-1) row.push([a[1],a[0]]); });
    row.sort((p,q)=>p[0]-q[0]);
    avenueRows[s]=row;
    if(!row.length) continue;
    /* the crosstown run */
    const stName=streetName(s,y);
    const ends=[[w+2,"shore"]].concat(row).concat([[e-2,"shore"]]);
    for(let i=0;i<ends.length-1;i++){
      const gap=ends[i+1][0]-ends[i][0];
      if(gap<2||gap>60) continue;               /* do not invent a road across the park */
      if(inCentralPark(ends[i][0],ends[i+1][0],y)) continue;
      link(node(ends[i][0],y),node(ends[i+1][0],y),stName,"st");
    }
  }
  /* the avenues, street by street */
  D.AVES.forEach(a=>{
    const x=a[1];
    let prev=null;
    for(let s=Math.ceil(a[2]/8);s<=Math.floor(a[3]/8);s++){
      const y=s*8;
      if(y<-352||y>1740) continue;
      if(x<D.WX(y)||x>D.EX(y)){ prev=null; continue; }
      const n=node(x,y);
      if(prev!=null) link(prev,n,a[0],"ave");
      prev=n;
    }
  });

  /* ---- the named thoroughfares, sampled and welded ------------------------------ */
  function polyline(pts,name,kind){
    let prev=null;
    for(let i=0;i<pts.length-1;i++){
      const [x0,y0]=pts[i], [x1,y1]=pts[i+1];
      const d=Math.hypot(x1-x0,y1-y0), steps=Math.max(1,Math.round(d/7));
      for(let k=0;k<=steps;k++){
        const t=k/steps, x=x0+(x1-x0)*t, y=y0+(y1-y0)*t;
        const n=node(x,y);
        if(prev!=null) link(prev,n,name,kind);
        prev=n;
      }
    }
  }
  D.THRU.forEach(t=>polyline(t[1],t[0],t[3]==="hwy"?"hwy":t[3]==="walk"?"walk":"thru"));
  polyline(D.BROADWAY.map(p=>[p[0],p[1]]),"Broadway","bway");

  /* ---- weld: a road that passes within fifty metres of another meets it ---------- */
  {
    const cell=6, grid=new Map();
    nodes.forEach(n=>{
      const k=Math.floor(n.x/cell)+":"+Math.floor(n.y/cell);
      let a=grid.get(k); if(!a){a=[];grid.set(k,a);}
      a.push(n.i);
    });
    nodes.forEach(n=>{
      const c=Math.floor(n.x/cell), r=Math.floor(n.y/cell);
      for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
        const a=grid.get((c+dc)+":"+(r+dr));
        if(!a) continue;
        for(const j of a){
          if(j<=n.i) continue;
          const m=nodes[j];
          if(Math.hypot(m.x-n.x,m.y-n.y)<=5) link(n.i,j,"junction","join");
        }
      }
    });
  }

  /* ---- what still crosses the water --------------------------------------------- */
  /* The survey lists every crossing as severed. Two are passable on foot and are the
     only way off the island; the rest are carried as blocked, so the router can say
     why there is no route rather than simply failing. */
  const PASSABLE={"Brooklyn Bridge":{cost:3.2,note:"one at a time, on a still day"},
                  "Harlem River spans":{cost:1.5,note:"footway laid over the old deck"}};
  /* a crossing lands on whatever road meets it, which can be some way off */
  const snapTo=(x,y)=>{
    let best=-1,bd=6400;
    for(const n of nodes){
      const d=(n.x-x)*(n.x-x)+(n.y-y)*(n.y-y);
      if(d<bd){ bd=d; best=n.i; }
    }
    return best>=0?best:node(x,y);
  };
  D.CROSS.forEach(c=>{
    const a=snapTo(c[0],c[1]), b=snapTo(c[2],c[3]);
    const p=PASSABLE[c[4]];
    const A=nodes[a], B=nodes[b];
    const len=Math.hypot(A.x-B.x,A.y-B.y)*U2M;
    const e={i:edges.length,a,b,len,name:c[4],kind:"cross",
             mx:(A.x+B.x)/2,my:(A.y+B.y)/2,
             crossing:true,passable:!!p,penalty:p?p.cost:0,note:p?p.note:"severed"};
    edges.push(e);
    A.adj.push({to:b,e:e.i}); B.adj.push({to:a,e:e.i});
  });

  G={nodes,edges,byKey,
     buildMs:Math.round(((typeof performance!=="undefined")?performance.now():0)-t0)};
  index();
  return G;
}

function streetName(s,y){
  if(y<4){
    /* below Houston the grid has no numbers; the nearest named street will do */
    let best="Downtown street",bd=26;
    D.THRU.forEach(t=>{
      if(t[4]!=="MN") return;
      t[1].forEach(p=>{ const d=Math.abs(p[1]-y); if(d<bd){bd=d;best=t[0];} });
    });
    return best;
  }
  const named=D.CROSSTOWN.find(c=>c[0]===s);
  return named?named[1]:(s+" St");
}
/* the transverse roads exist, but not on every street */
function inCentralPark(x0,x1,y){
  if(y<472||y>880) return false;
  const TRANSVERSE=[65,79,86,97];
  const s=Math.round(y/8);
  if(TRANSVERSE.indexOf(s)>=0) return false;
  return !(x1<=-72||x0>=0);
}

/* ---- a spatial index over the nodes, for snapping a click to the network --------- */
const IX={cell:14,map:null};
function index(){
  IX.map=new Map();
  G.nodes.forEach(n=>{
    const k=Math.floor(n.x/IX.cell)+":"+Math.floor(n.y/IX.cell);
    let a=IX.map.get(k); if(!a){a=[];IX.map.set(k,a);}
    a.push(n.i);
  });
}
function nearest(x,y,maxUnits){
  const g=build(), lim=(maxUnits||40);
  const c=Math.floor(x/IX.cell), r=Math.floor(y/IX.cell);
  const span=Math.ceil(lim/IX.cell);
  let best=-1,bd=lim*lim;
  for(let dc=-span;dc<=span;dc++) for(let dr=-span;dr<=span;dr++){
    const a=IX.map.get((c+dc)+":"+(r+dr));
    if(!a) continue;
    for(const i of a){
      const n=g.nodes[i], d=(n.x-x)*(n.x-x)+(n.y-y)*(n.y-y);
      if(d<bd){ bd=d; best=i; }
    }
  }
  return best;
}
function stats(){
  const g=build();
  const kinds={};
  g.edges.forEach(e=>kinds[e.kind]=(kinds[e.kind]||0)+1);
  return {nodes:g.nodes.length,edges:g.edges.length,kinds,buildMs:g.buildMs};
}

NYC.network={build,nearest,stats,U2M,
  get graph(){return build();}};
})();
