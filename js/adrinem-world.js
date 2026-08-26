/* ===================================================================================
   Adrinem — the world, unpacked. Turns the columns in adrinem-data.js back into a
   cell table, rebuilds each cell's ground from its centroid, and derives the things
   the sheet draws off that: the coast, the realm and province marches, the rivers,
   and the adjacency the way-finder runs over.

   The exports carry a point per cell, not a polygon. The ground is recovered the way
   the generator made it in the first place — as a Voronoi diagram — by clipping the
   map frame with the perpendicular bisector to every near neighbour. Which bisectors
   survive that clip is exactly the cell's neighbour list, so the adjacency the router
   needs falls out of the same pass.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const D=window.ADRINEM_DATA;

const nums=s=>{ if(!s) return []; const p=s.split(","), a=new Float64Array(p.length);
  for(let i=0;i<p.length;i++) a[i]=+p[i]; return a; };
const ints=s=>{ if(!s) return []; const p=s.split(","), a=new Int32Array(p.length);
  for(let i=0;i<p.length;i++) a[i]=+p[i]; return a; };

/* ---- the cell table --------------------------------------------------------------- */
const C={
  x:nums(D.cols.x), y:nums(D.cols.y), h:ints(D.cols.h), b:ints(D.cols.b),
  st:ints(D.cols.st), pv:ints(D.cols.pv), cu:ints(D.cols.cu), pop:ints(D.cols.pop),
  riv:ints(D.cols.riv), flux:ints(D.cols.flux), hrb:ints(D.cols.hrb),
  mkt:ints(D.cols.mkt), cost:nums(D.cols.cost)
};
const N=C.x.length;
const M=D.meta;
const isLand=i=>C.h[i]>=M.seaLevel;

/* lon/lat is a linear function of the map frame; the packer kept the transform */
const lonOf=x=>M.lonW+M.lonPer*x, latOf=y=>M.latN+M.latPer*y;

/* ---- roads, as cell pairs --------------------------------------------------------- */
const R={a:ints(D.roads.a), b:ints(D.roads.b), cls:ints(D.roads.cls), uses:ints(D.roads.uses)};

/* ---- market lookup ---------------------------------------------------------------- */
const marketByCell=new Map(); D.markets.forEach(m=>marketByCell.set(m.cell,m));
const burgOfCell=new Map(); for(const k in D.burgOfCell) burgOfCell.set(+k,D.burgs[D.burgOfCell[k]]);
const portOfCell=new Map(); for(const k in D.ports) portOfCell.set(+k,D.ports[k]);

/* =================================================================================== */
/*  the frame, and a bucket grid over the sites                                        */
/* =================================================================================== */
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(let i=0;i<N;i++){
  if(C.x[i]<minX)minX=C.x[i]; if(C.x[i]>maxX)maxX=C.x[i];
  if(C.y[i]<minY)minY=C.y[i]; if(C.y[i]>maxY)maxY=C.y[i];
}
/* mean spacing, from area per site — the sites came off a jittered grid */
const SPACING=Math.sqrt((maxX-minX)*(maxY-minY)/N);
const PAD=SPACING*0.6;
const FRAME={x0:minX-PAD, y0:minY-PAD, x1:maxX+PAD, y1:maxY+PAD};

const GS=SPACING*2;                     /* bucket side */
const GW=Math.ceil((FRAME.x1-FRAME.x0)/GS)+1, GH=Math.ceil((FRAME.y1-FRAME.y0)/GS)+1;
const buckets=new Array(GW*GH);
const bucketOf=(x,y)=>{
  const cx=Math.min(GW-1,Math.max(0,Math.floor((x-FRAME.x0)/GS)));
  const cy=Math.min(GH-1,Math.max(0,Math.floor((y-FRAME.y0)/GS)));
  return cy*GW+cx;
};
for(let i=0;i<N;i++){ const k=bucketOf(C.x[i],C.y[i]); (buckets[k]||(buckets[k]=[])).push(i); }

function near(x,y,radius,out){
  out.length=0;
  const r=Math.ceil(radius/GS);
  const cx=Math.floor((x-FRAME.x0)/GS), cy=Math.floor((y-FRAME.y0)/GS);
  const r2=radius*radius;
  for(let gy=cy-r;gy<=cy+r;gy++){
    if(gy<0||gy>=GH) continue;
    for(let gx=cx-r;gx<=cx+r;gx++){
      if(gx<0||gx>=GW) continue;
      const list=buckets[gy*GW+gx]; if(!list) continue;
      for(let n=0;n<list.length;n++){
        const j=list[n], dx=C.x[j]-x, dy=C.y[j]-y;
        if(dx*dx+dy*dy<=r2) out.push(j);
      }
    }
  }
  return out;
}
/* nearest site to an arbitrary point — how a tap on the sheet becomes a cell */
function cellAt(x,y){
  let best=-1,bd=Infinity,radius=SPACING*1.5;
  const bag=[];
  for(let pass=0;pass<6&&best<0;pass++,radius*=2){
    near(x,y,radius,bag);
    for(let n=0;n<bag.length;n++){
      const j=bag[n], dx=C.x[j]-x, dy=C.y[j]-y, d=dx*dx+dy*dy;
      if(d<bd){bd=d;best=j;}
    }
  }
  return best;
}

/* =================================================================================== */
/*  Voronoi: clip the frame by every bisector that bites                               */
/* =================================================================================== */
/* A polygon is held as flat [x0,y0,x1,y1,...] with own[k] naming the neighbour whose
   bisector produced the edge leaving vertex k (-1 for an edge of the frame itself). */
function clip(pts,own,px,py,jx,jy,j){
  const mx=(px+jx)/2, my=(py+jy)/2, dx=jx-px, dy=jy-py;
  const side=(x,y)=>(x-mx)*dx+(y-my)*dy;      /* <= 0 keeps the site's half */
  const n=pts.length/2;
  const outP=[], outO=[];
  let bit=false;
  for(let k=0;k<n;k++){
    const ax=pts[2*k], ay=pts[2*k+1], o=own[k];
    const k2=(k+1)%n, bx=pts[2*k2], by=pts[2*k2+1];
    const sa=side(ax,ay), sb=side(bx,by);
    const ai=sa<=0, bi=sb<=0;
    if(!ai||!bi) bit=true;
    if(ai&&bi){ outP.push(ax,ay); outO.push(o); }
    else if(ai&&!bi){
      const t=sa/(sa-sb);
      outP.push(ax,ay); outO.push(o);
      outP.push(ax+(bx-ax)*t, ay+(by-ay)*t); outO.push(j);
    } else if(!ai&&bi){
      const t=sa/(sa-sb);
      outP.push(ax+(bx-ax)*t, ay+(by-ay)*t); outO.push(o);
    }
  }
  return bit?{pts:outP,own:outO}:null;
}

let POLY=null, OWN=null, ADJ=null;

function buildGround(){
  if(POLY) return;
  POLY=new Array(N); OWN=new Array(N); ADJ=new Array(N);
  const bag=[];
  for(let i=0;i<N;i++){
    const px=C.x[i], py=C.y[i];
    let radius=SPACING*2.2, pts, own;
    /* the clip is only trustworthy once the search radius covers twice the farthest
       vertex; anything nearer could still be cut by a site we never looked at */
    for(let pass=0;pass<7;pass++){
      pts=[FRAME.x0,FRAME.y0, FRAME.x1,FRAME.y0, FRAME.x1,FRAME.y1, FRAME.x0,FRAME.y1];
      own=[-1,-1,-1,-1];
      near(px,py,radius,bag);
      for(let n=0;n<bag.length;n++){
        const j=bag[n]; if(j===i) continue;
        const res=clip(pts,own,px,py,C.x[j],C.y[j],j);
        if(res){ pts=res.pts; own=res.own; if(pts.length<6) break; }
      }
      let far=0;
      for(let k=0;k<pts.length;k+=2){
        const d=Math.hypot(pts[k]-px,pts[k+1]-py); if(d>far) far=d;
      }
      if(radius>=2*far) break;
      radius=2*far+SPACING;
    }
    POLY[i]=pts; OWN[i]=own;
    const nb=[];
    for(let k=0;k<own.length;k++) if(own[k]>=0&&nb.indexOf(own[k])<0) nb.push(own[k]);
    ADJ[i]=nb;
  }
  /* the clip is symmetric in theory and all but symmetric in floating point; make it
     so, since the router walks it in both directions */
  for(let i=0;i<N;i++) for(const j of ADJ[i]) if(ADJ[j].indexOf(i)<0) ADJ[j].push(i);
}

/* =================================================================================== */
/*  what the sheet draws off the ground                                                */
/* =================================================================================== */
/* every edge of the diagram, once, tagged with the two cells it divides */
function edges(){
  buildGround();
  const out=[];
  for(let i=0;i<N;i++){
    const pts=POLY[i], own=OWN[i], n=pts.length/2;
    for(let k=0;k<n;k++){
      const j=own[k];
      /* the same segment sits in both cells' outlines, so only the lower id emits it —
         unless the clip was not quite symmetric, in which case nobody else will */
      if(j>=0&&j<i&&OWN[j].indexOf(i)>=0) continue;
      const k2=(k+1)%n;
      out.push({a:i, b:j, x1:pts[2*k], y1:pts[2*k+1], x2:pts[2*k2], y2:pts[2*k2+1]});
    }
  }
  return out;
}

/* rivers: each river cell drains to the neighbour carrying it onward — the one of its
   own river with more flux, failing that the sea, failing that the fullest neighbour */
function rivers(){
  buildGround();
  const segs=[];
  for(let i=0;i<N;i++){
    if(!C.riv[i]||!isLand(i)) continue;
    let best=-1,bestScore=-1;
    for(const j of ADJ[i]){
      let score;
      if(!isLand(j)) score=1e9;                                   /* a mouth */
      else if(C.riv[j]===C.riv[i]&&C.flux[j]>C.flux[i]) score=1e8-C.flux[j];
      else if(C.riv[j]&&C.flux[j]>C.flux[i]) score=1e7-C.flux[j]; /* a confluence */
      else continue;
      if(score>bestScore){bestScore=score;best=j;}
    }
    if(best<0) continue;
    segs.push({x1:C.x[i], y1:C.y[i], x2:C.x[best], y2:C.y[best],
      flux:C.flux[i], mouth:!isLand(best), river:C.riv[i]});
  }
  return segs;
}

/* =================================================================================== */
A.data=D;
A.meta=M;
A.cells=C;
A.count=N;
A.roads=R;
A.frame=FRAME;
A.spacing=SPACING;
A.isLand=isLand;
A.lonOf=lonOf; A.latOf=latOf;
A.biomeOf=i=>D.biomes[C.b[i]];
A.stateOf=i=>D.states[C.st[i]]||"Unclaimed";
A.provinceOf=i=>D.provinces[C.pv[i]]||"";
A.cultureOf=i=>D.cultures[C.cu[i]]||"Wildlands";
A.burgOf=i=>burgOfCell.get(i)||null;
A.marketOf=i=>marketByCell.get(i)||null;
A.portOf=i=>portOfCell.get(i)||null;
A.markets=D.markets;
A.burgs=D.burgs;
A.marketByCell=marketByCell;
A.build=buildGround;
A.polyOf=i=>{buildGround();return POLY[i];};
A.neighboursOf=i=>{buildGround();return ADJ[i];};
A.edges=edges;
A.rivers=rivers;
A.cellAt=cellAt;
A.near=near;
/* effective miles a day on the road, from the generator's own supply figure */
A.daysOf=mi=>mi/M.supplyDivisor;
})();
