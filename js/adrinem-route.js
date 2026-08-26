/* ===================================================================================
   Adrinem — the way across. The same cost model adrinem_infra.py used to lay the
   trade network, run in the browser over the adjacency the Voronoi pass recovered,
   so a route asked for on the sheet is priced exactly as the exported network was.

       cost(a -> b) = miles(a,b) * terrain(b) * slope(a,b) + river(a,b)

   terrain is the biome's own cost against grassland, slope is the climb into b over
   the divisor that doubles it, and river is the toll for fording onto a river cell
   from dry ground. Water is not passable: sea legs are a separate trade, and the
   sheet says which harbours they would have to leave from.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const C=A.cells, M=A.meta, D=A.data;

const BIOME_COST=D.biomes.map(b=>b.cost);

function miles(a,b){
  return Math.hypot(C.x[b]-C.x[a],C.y[b]-C.y[a])*M.scale;
}
function edgeCost(a,b){
  const terrain=BIOME_COST[C.b[b]]/M.baseCost;
  const slope=1+Math.max(0,C.h[b]-C.h[a])/M.slopeDivisor;
  const river=(C.riv[b]&&!C.riv[a])?M.riverCrossMi:0;
  return miles(a,b)*terrain*slope+river;
}

/* ---- a binary heap, since the graph is big enough to care ------------------------- */
function Heap(){ this.k=[]; this.v=[]; }
Heap.prototype.push=function(key,val){
  const k=this.k,v=this.v; let i=k.length; k.push(key); v.push(val);
  while(i>0){ const p=(i-1)>>1; if(k[p]<=k[i]) break;
    [k[p],k[i]]=[k[i],k[p]]; [v[p],v[i]]=[v[i],v[p]]; i=p; }
};
Heap.prototype.pop=function(){
  const k=this.k,v=this.v, top=v[0], key=k[0], last=k.length-1;
  k[0]=k[last]; v[0]=v[last]; k.pop(); v.pop();
  let i=0;
  while(true){
    const l=2*i+1, r=l+1; let s=i;
    if(l<k.length&&k[l]<k[s]) s=l;
    if(r<k.length&&k[r]<k[s]) s=r;
    if(s===i) break;
    [k[s],k[i]]=[k[i],k[s]]; [v[s],v[i]]=[v[i],v[s]]; i=s;
  }
  return {key:key,val:top};
};
Heap.prototype.size=function(){ return this.k.length; };

/* ---- least cost from one cell ----------------------------------------------------- */
function from(source,stopAt){
  A.build();
  const n=A.count;
  const dist=new Float64Array(n).fill(Infinity);
  const prev=new Int32Array(n).fill(-1);
  const done=new Uint8Array(n);
  if(!A.isLand(source)) return {dist:dist,prev:prev};
  const want=stopAt?new Set(stopAt):null;
  const h=new Heap();
  dist[source]=0; h.push(0,source);
  while(h.size()){
    const {key:d,val:u}=h.pop();
    if(done[u]) continue;
    done[u]=1;
    if(want){ want.delete(u); if(!want.size) break; }
    const nb=A.neighboursOf(u);
    for(let i=0;i<nb.length;i++){
      const v=nb[i];
      if(!A.isLand(v)||done[v]) continue;
      const nd=d+edgeCost(u,v);
      if(nd<dist[v]){ dist[v]=nd; prev[v]=u; h.push(nd,v); }
    }
  }
  return {dist:dist,prev:prev};
}

/* ---- nearest source and its cost, everywhere, in one sweep ------------------------ */
function fromMany(sources){
  A.build();
  const n=A.count;
  const dist=new Float64Array(n).fill(Infinity);
  const owner=new Int32Array(n).fill(-1);
  const done=new Uint8Array(n);
  const h=new Heap();
  sources.forEach(s=>{ if(A.isLand(s)){ dist[s]=0; owner[s]=s; h.push(0,s); } });
  while(h.size()){
    const {key:d,val:u}=h.pop();
    if(done[u]) continue;
    done[u]=1;
    const nb=A.neighboursOf(u);
    for(let i=0;i<nb.length;i++){
      const v=nb[i];
      if(!A.isLand(v)||done[v]) continue;
      const nd=d+edgeCost(u,v);
      if(nd<dist[v]){ dist[v]=nd; owner[v]=owner[u]; h.push(nd,v); }
    }
  }
  return {dist:dist,owner:owner};
}

/* ---- a named route between two cells ---------------------------------------------- */
function route(a,b){
  if(a===b) return {ok:false,why:"Both ends are the same ground."};
  if(!A.isLand(a)||!A.isLand(b))
    return {ok:false,why:"A leg of this route starts or ends in open water. "+
      "The overland network does not cross it."};
  const {dist,prev}=from(a,[b]);
  if(!isFinite(dist[b]))
    return {ok:false,why:"No overland way exists. These lie on different landmasses; "+
      "the crossing would have to be made by sea."};
  const cells=[b];
  while(cells[cells.length-1]!==a){
    const p=prev[cells[cells.length-1]];
    if(p<0) return {ok:false,why:"The way broke while being traced back."};
    cells.push(p);
  }
  cells.reverse();
  return {ok:true, cells:cells, cost:dist[b], days:A.daysOf(dist[b]),
    legs:legsOf(cells)};
}

/* Break the cell chain into legs a person would recognise: a run of one biome through
   one realm, with what it cost and what was crossed on it. */
function legsOf(cells){
  const out=[];
  let start=0;
  for(let i=1;i<=cells.length;i++){
    const last=i===cells.length;
    const cur=cells[i-1], nxt=last?-1:cells[i];
    const breaks = last || C.b[nxt]!==C.b[cur] || C.st[nxt]!==C.st[cur];
    if(!breaks) continue;
    let cost=0, fords=0, climb=0, straight=0;
    /* edges, not cells: the leg owns everything up to the cell the next leg starts on */
    for(let k=start;k<i-1;k++){
      const u=cells[k], v=cells[k+1];
      cost+=edgeCost(u,v);
      straight+=miles(u,v);
      if(C.riv[v]&&!C.riv[u]) fords++;
      climb+=Math.max(0,C.h[v]-C.h[u]);
    }
    out.push({
      from:cells[start], to:cur,
      biome:A.biomeOf(cur).name, state:A.stateOf(cur),
      cost:cost, miles:straight, fords:fords, climb:climb,
      cells:i-start
    });
    start=i-1;
    if(last) break;
  }
  return out.filter(l=>l.cost>0);
}

A.route={ edgeCost:edgeCost, miles:miles, from:from, fromMany:fromMany, find:route };
})();
