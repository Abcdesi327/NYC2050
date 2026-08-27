/* ===================================================================================
   Adrinem — application wiring: the plate, the index, search, the way-finder and the
   reader's own marks. The survey sheet's chrome, pointed at another world.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM;
const C=A.cells, D=A.data, M=A.meta, PAL=A.palette;
const q=id=>document.getElementById(id);

let map=null, sel=null, selPin=null, pinMode=false, editing=null, tab="index";
let pickFor=null;                 /* "from" | "to" when the sheet is being tapped for an end */
let ends={from:null,to:null};
let reachOn=false;

/* ---- the reader's marks, kept in this browser only -------------------------------- */
const KEY="adrinem.marks.v1";
const store={
  all(){ try{ return JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ return []; } },
  save(v){ try{ localStorage.setItem(KEY,JSON.stringify(v)); }catch(e){} },
  add(p){ const v=store.all(); v.push(p); store.save(v); return p; },
  update(id,patch){ const v=store.all(), r=v.find(p=>p.id===id);
    if(r) Object.assign(r,patch,{isNew:false}); store.save(v); return r; },
  remove(id){ store.save(store.all().filter(p=>p.id!==id)); }
};

/* ---- toast ------------------------------------------------------------------------ */
let toastT=null;
function toast(msg){
  const t=q("toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200);
}

/* ---- reading a place off the sheet ------------------------------------------------ */
function coordOf(x,y){
  const lon=A.lonOf(x), lat=A.latOf(y);
  return Math.abs(lat).toFixed(1)+"°"+(lat<0?"S":"N")+" "+
         Math.abs(lon).toFixed(1)+"°"+(lon<0?"W":"E");
}
function describe(i){
  const st=A.stateOf(i), pv=A.provinceOf(i);
  if(!A.isLand(i)) return "OPEN WATER · "+coordOf(C.x[i],C.y[i]);
  return (st==="Neutrals"?"UNCLAIMED":st.toUpperCase())+
    (pv?" · "+pv.toUpperCase():"")+" · "+coordOf(C.x[i],C.y[i]);
}
const miles=n=>Math.round(n).toLocaleString()+" mi";
function daysText(mi){
  const d=A.daysOf(mi);
  return d<1?Math.round(d*24)+" h":d.toFixed(d<10?1:0)+" d";
}

/* ---- the info sheet --------------------------------------------------------------- */
function closeSheet(){ q("sheet").classList.remove("on"); sel=selPin=null;
  map&&map.clearHighlight(); }

function btn(label,cls,fn){
  const b=document.createElement("button");
  b.textContent=label; if(cls) b.className=cls; b.onclick=fn; return b;
}

function showCell(i){
  sel=i; selPin=null;
  const burg=A.burgOf(i), mkt=A.marketOf(i), port=A.portOf(i), bio=A.biomeOf(i);
  q("sNm").textContent = burg ? burg.name : A.isLand(i) ? bio.name : "Open water";
  q("sMeta").textContent = describe(i)+" · CELL "+i;

  const code=q("sCode");
  code.textContent = mkt ? "MARKET CENTRE" : burg ? "SETTLEMENT"
    : A.isLand(i) ? bio.name.toUpperCase() : "SEA";
  code.style.background = mkt?"#7A4A22":burg?"#2C2C2A":PAL.biome(bio.name);
  code.style.color = (mkt||burg)?"var(--paper)":"#2C2C2A";

  const lines=[];
  if(A.isLand(i)){
    lines.push(bio.name+", habitability "+bio.hab+"/100, going "+
      (bio.cost/M.baseCost).toFixed(1)+"× grassland.");
    lines.push("Elevation "+C.h[i]+" of 100. "+A.cultureOf(i)+
      (C.pop[i]>0?", "+C.pop[i].toLocaleString()+" living on this ground":", unpeopled")+".");
    if(burg) lines.push(burg.name+" holds "+burg.pop.toLocaleString()+" of them.");
    if(port) lines.push("Harbour of quality "+port.quality+
      ", the haven lying at cell "+port.haven+"."+
      (A.cityview&&A.cityview.has(i)?
        " A market on a harbour: the ground under it is drawn on its own plate.":""));
    if(C.riv[i]) lines.push("A river runs through it, carrying "+C.flux[i]+" of flux.");
    if(C.mkt[i]>=0){
      const m=A.marketOf(C.mkt[i]);
      lines.push(C.cost[i]<=0 ? "This is the market itself."
        : miles(C.cost[i])+" of effective going to "+(m?m.name:"its market")+
          " — about "+daysText(C.cost[i])+" of supply.");
    } else {
      lines.push("Beyond the reach of every market on the sheet. Nothing on the trade "+
        "network gets here overland.");
    }
  } else {
    lines.push("Sea. The overland network stops at the shore; a crossing from here "+
      "would have to be sailed.");
  }
  q("sNote").textContent=lines.join(" ");

  const acts=q("sActs"); acts.innerHTML="";
  if(A.cityview&&A.cityview.has(i))
    acts.appendChild(btn("◉ CITY PLATE","pri",()=>A.cityview.open(i)));
  acts.appendChild(btn("⌖ CENTRE","",()=>map.flyTo(C.x[i],C.y[i],Math.max(map.scale,4))));
  if(A.isLand(i)){
    acts.appendChild(btn("→ WAY TO","",()=>setEnd("to",i,true)));
    acts.appendChild(btn("← WAY FROM","",()=>setEnd("from",i,true)));
    acts.appendChild(btn("◎ REACH","",()=>runReach(i)));
  }
  acts.appendChild(btn("✎ MARK HERE","",()=>dropMark(C.x[i],C.y[i])));
  q("sheet").classList.add("on");
  map.highlight(i);
}

function showPin(p){
  selPin=p; sel=null;
  const i=A.cellAt(p.x,p.y);
  q("sNm").textContent=p.name;
  q("sMeta").textContent="OWN MARK · "+describe(i);
  const code=q("sCode");
  code.textContent="OWN MARK"; code.style.background="var(--mark)"; code.style.color="#fff";
  q("sNote").textContent=p.note||"No note.";
  const acts=q("sActs"); acts.innerHTML="";
  acts.appendChild(btn("✎ EDIT","pri",()=>openEditor(p)));
  acts.appendChild(btn("⌖ CENTRE","",()=>map.flyTo(p.x,p.y,Math.max(map.scale,4))));
  acts.appendChild(btn("✕ REMOVE","",()=>{
    store.remove(p.id); refreshPins(); closeSheet(); toast("Mark removed"); }));
  q("sheet").classList.add("on");
  map.highlight(i);
}

/* ---- marks ------------------------------------------------------------------------ */
function dropMark(x,y){
  const p={id:"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    x:x, y:y, name:"", note:"", isNew:true};
  store.add(p); refreshPins(); openEditor(p);
}
function openEditor(p){
  editing=p;
  q("edTitle").textContent=p.isNew?"New mark":"Edit mark";
  q("edLoc").textContent=describe(A.cellAt(p.x,p.y));
  q("edName").value=p.isNew?"":p.name;
  q("edNote").value=p.note||"";
  q("edDel").style.display=p.isNew?"none":"";
  q("editor").classList.add("on"); q("scrim").classList.add("on");
  setTimeout(()=>q("edName").focus(),30);
}
function closeEditor(commit){
  const p=editing; editing=null;
  q("editor").classList.remove("on"); q("scrim").classList.remove("on");
  if(!p) return;
  if(!commit){ if(p.isNew) store.remove(p.id); refreshPins(); return; }
  const name=q("edName").value.trim()||"Mark at "+coordOf(p.x,p.y);
  const rec=store.update(p.id,{name:name,note:q("edNote").value.trim()});
  refreshPins();
  if(rec) showPin(rec);
  toast(p.isNew?"Mark dropped — "+name:"Mark saved");
}
function refreshPins(){
  const all=store.all();
  map.renderPins(all);
  const b=q("pinCount"); b.textContent=all.length; b.classList.toggle("on",all.length>0);
  if(tab==="marks") fillDrawer();
}

/* =================================================================================== */
/*  search                                                                             */
/* =================================================================================== */
function index(){
  const out=[];
  A.burgs.forEach(b=>{
    const mkt=A.marketOf(b.cell);
    out.push({name:b.name, sub:(mkt?"MARKET CENTRE · ":"SETTLEMENT · ")+
      (D.states[b.state]||"Unclaimed").toUpperCase()+" · "+b.pop.toLocaleString(),
      cell:b.cell, zoom:5});
  });
  const seen=new Set();
  for(let i=0;i<A.count;i++){
    if(!A.isLand(i)) continue;
    const st=C.st[i]; if(!st||seen.has("s"+st)) continue;
    seen.add("s"+st);
    out.push({name:D.states[st], sub:"REALM", cell:i, zoom:1.4, realm:st});
  }
  for(let i=0;i<A.count;i++){
    if(!A.isLand(i)||!C.pv[i]) continue;
    const k="p"+C.pv[i]; if(seen.has(k)) continue; seen.add(k);
    out.push({name:D.provinces[C.pv[i]], sub:"PROVINCE OF "+A.stateOf(i).toUpperCase(),
      cell:i, zoom:2.6});
  }
  const cu=new Map();
  for(let i=0;i<A.count;i++){ if(!A.isLand(i)) continue;
    const r=cu.get(C.cu[i])||{x:0,y:0,n:0};
    r.x+=C.x[i]; r.y+=C.y[i]; r.n++; cu.set(C.cu[i],r); }
  cu.forEach((r,k)=>out.push({name:D.cultures[k], sub:"PEOPLE · "+r.n+" cells",
    cell:A.cellAt(r.x/r.n,r.y/r.n), zoom:1.2}));
  D.biomes.forEach((b,ix)=>{
    if(b.name==="Marine") return;
    let cell=-1;
    for(let i=0;i<A.count;i++) if(C.b[i]===ix){ cell=i; break; }
    if(cell>=0) out.push({name:b.name, sub:"BIOME · habitability "+b.hab,
      cell:cell, zoom:2.2});
  });
  return out;
}
let INDEX=null;
const idx=()=>INDEX||(INDEX=index());

function search(term,limit){
  const t=term.trim().toLowerCase();
  if(!t) return [];
  const hits=idx().filter(r=>r.name.toLowerCase().includes(t));
  hits.sort((a,b)=>{
    const ai=a.name.toLowerCase().startsWith(t), bi=b.name.toLowerCase().startsWith(t);
    if(ai!==bi) return ai?-1:1;
    return a.name.length-b.name.length;
  });
  return hits.slice(0,limit||12);
}
function fillResults(box,term,onPick){
  const hits=search(term);
  box.innerHTML="";
  if(!hits.length){ box.classList.remove("on"); return; }
  hits.forEach(r=>{
    const b=document.createElement("button");
    b.innerHTML="";
    b.appendChild(document.createTextNode(r.name));
    const s=document.createElement("span"); s.className="sub"; s.textContent=r.sub;
    b.appendChild(s);
    b.onclick=()=>onPick(r);
    box.appendChild(b);
  });
  box.classList.add("on");
}

/* =================================================================================== */
/*  the way-finder                                                                     */
/* =================================================================================== */
function nameOf(i){
  const b=A.burgOf(i);
  if(b) return b.name;
  const st=A.stateOf(i), pv=A.provinceOf(i);
  return (pv||st||"Open ground")+" "+coordOf(C.x[i],C.y[i]);
}
function setEnd(which,cell,openPanel){
  ends[which]=cell;
  q(which==="from"?"wFrom":"wTo").value=nameOf(cell);
  if(openPanel) openWay();
  if(ends.from&&ends.to) plan();
}
function openWay(){ q("wayPanel").classList.add("on"); q("wayBtn").setAttribute("aria-pressed","true"); }
function closeWay(){ q("wayPanel").classList.remove("on"); q("wayBtn").setAttribute("aria-pressed","false");
  setPick(null); }
function setPick(which){
  pickFor=which;
  q("wFromPick").setAttribute("aria-pressed",String(which==="from"));
  q("wToPick").setAttribute("aria-pressed",String(which==="to"));
  q("stage").classList.toggle("picking",!!which);
}

function plan(){
  const out=q("wOut");
  if(ends.from==null||ends.to==null){
    out.innerHTML='<div class="rterr">Set both ends first.</div>'; return;
  }
  const t0=performance.now();
  const r=A.route.find(ends.from,ends.to);
  const ms=Math.round(performance.now()-t0);
  if(!r.ok){
    map.clearRoute();
    out.innerHTML='<div class="rterr">'+r.why+'</div>'+seaNote(ends.from,ends.to);
    return;
  }
  map.drawRoute(r.cells);
  const straight=A.route.miles(ends.from,ends.to);
  const fords=r.legs.reduce((n,l)=>n+l.fords,0);
  const climb=r.legs.reduce((n,l)=>n+l.climb,0);
  let html='<div class="rtcard on"><div class="rth"><i style="background:#7A3E8F"></i>'+
    '<b>LEAST COST</b><span>'+miles(r.cost)+'</span></div>'+
    '<div class="rtm">'+daysText(r.cost)+' of supply · '+r.cells.length+
    ' cells · '+fords+' ford'+(fords===1?"":"s")+' · '+climb+' of climb</div>'+
    '<div class="rtm">'+miles(straight)+' as the raven flies, so '+
    (r.cost/straight).toFixed(2)+'× the straight line</div></div>';
  html+='<ul class="rtlegs">';
  r.legs.forEach(l=>{
    html+='<li><b>'+esc(l.biome)+'</b><span>'+
      (l.state==="Neutrals"?"UNCLAIMED":esc(l.state.toUpperCase()))+' · '+
      miles(l.cost)+' effective, '+miles(l.miles)+' on the ground</span>'+
      (l.fords?'<em>'+l.fords+' river crossing'+(l.fords===1?"":"s")+
        ' at '+M.riverCrossMi+' mi each</em>':'')+'</li>';
  });
  html+='</ul>';
  html+='<p class="rtfoot">Priced by the same model that laid the trade network: '+
    'biome cost against grassland, climb over a divisor of '+M.slopeDivisor+
    ', and '+M.riverCrossMi+' effective miles for an unbridged crossing. '+
    'Solved in '+ms+' ms.</p>';
  out.innerHTML=html;
}
function seaNote(a,b){
  const pa=nearestPort(a), pb=nearestPort(b);
  if(!pa||!pb) return "";
  return '<p class="rtfoot">The nearest harbours are '+esc(pa.name)+' and '+
    esc(pb.name)+'. '+D.report.harbor_capable_burgs+
    ' burgs on the sheet can take shipping; none is flagged as a working port in the '+
    'source file, so no sea leg is drawn.</p>';
}
function nearestPort(cell){
  let best=null,bd=Infinity;
  A.burgs.forEach(b=>{
    if(!A.portOf(b.cell)) return;
    const d=Math.hypot(C.x[b.cell]-C.x[cell],C.y[b.cell]-C.y[cell]);
    if(d<bd){bd=d;best=b;}
  });
  return best;
}

/* ---- a reach: how far a place can supply ------------------------------------------ */
/* Days, not miles, and sized to this world: half the land sits more than forty days
   from its own market, so a reach worth drawing has to run to hundreds. */
const BANDS=[25,50,100,200,400];
function runReach(cell){
  if(!A.isLand(cell)){ toast("A reach can only be cast from land"); return; }
  const {dist}=A.route.from(cell);
  map.drawReach(dist,BANDS);
  reachOn=true;
  q("reachBtn").setAttribute("aria-pressed","true");

  const cells=BANDS.map(()=>0), pop=BANDS.map(()=>0), burgs=BANDS.map(()=>0);
  let unreached=0;
  for(let i=0;i<A.count;i++){
    if(!A.isLand(i)) continue;
    const d=isFinite(dist[i])?A.daysOf(dist[i]):Infinity;
    let placed=false;
    for(let b=0;b<BANDS.length;b++)
      if(d<=BANDS[b]){ cells[b]++; pop[b]+=C.pop[i]; if(A.burgOf(i)) burgs[b]++;
        placed=true; break; }
    if(!placed) unreached++;
  }
  openWay();
  let html='<div class="rtcard on"><div class="rth">'+
    '<i style="background:#7A3E8F"></i><b>REACH FROM</b><span>'+esc(nameOf(cell))+
    '</span></div><div class="rtm">'+
    cells.reduce((a,b)=>a+b,0).toLocaleString()+' cells, '+
    pop.reduce((a,b)=>a+b,0).toLocaleString()+' people and '+
    burgs.reduce((a,b)=>a+b,0)+' burgs lie within '+BANDS[BANDS.length-1]+
    ' days</div></div><ul class="rtlegs">';
  let run=0, runPop=0, runBurg=0;
  BANDS.forEach((d,b)=>{
    run+=cells[b]; runPop+=pop[b]; runBurg+=burgs[b];
    html+='<li><b>within '+d+' days</b><span>'+run.toLocaleString()+' cells · '+
      runPop.toLocaleString()+' people · '+runBurg+' burg'+(runBurg===1?"":"s")+
      '</span></li>';
  });
  html+='</ul>';
  html+='<p class="rtfoot">'+unreached.toLocaleString()+
    ' land cells lie further off or on another landmass entirely. Bands are days at '+
    M.supplyDivisor+' effective miles each — the figure the generator used to turn '+
    'cost into supply. Press RCH again to clear it.</p>';
  q("wOut").innerHTML=html;
  toast("Reach cast from "+nameOf(cell));
}
function clearReach(){
  reachOn=false; map.clearReach(); q("reachBtn").setAttribute("aria-pressed","false");
}

/* =================================================================================== */
/*  the drawer                                                                         */
/* =================================================================================== */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function fillDrawer(){
  const body=q("drawerBody"); body.innerHTML="";
  if(tab==="marks"){
    const all=store.all();
    q("drawerFoot").style.display="";
    if(!all.length){
      body.innerHTML='<p class="empty">No marks yet. Press <b>PIN</b> and tap the plate '+
        'to drop one, or use MARK HERE on any place you have opened. Marks are kept in '+
        'this browser and nowhere else.</p>';
      return;
    }
    all.forEach(p=>{
      const b=document.createElement("button"); b.className="row";
      b.innerHTML='<b>'+esc(p.name)+'</b><span>'+esc(describe(A.cellAt(p.x,p.y)))+'</span>'+
        (p.note?'<i>'+esc(p.note)+'</i>':'');
      b.onclick=()=>{ closeDrawer(); map.flyTo(p.x,p.y,Math.max(map.scale,4)); showPin(p); };
      body.appendChild(b);
    });
    return;
  }
  q("drawerFoot").style.display="none";
  if(tab==="account"){ fillAccount(body); return; }

  /* the index: realms, and what stands in them */
  const byState=new Map();
  A.burgs.forEach(b=>{ const k=b.state; (byState.get(k)||byState.set(k,[]).get(k)).push(b); });
  const order=[...byState.keys()].sort((a,b)=>
    (D.states[a]||"").localeCompare(D.states[b]||""));
  order.forEach(st=>{
    const h=document.createElement("p"); h.className="grp";
    h.textContent=(D.states[st]||"Unclaimed").toUpperCase();
    body.appendChild(h);
    byState.get(st).sort((a,b)=>b.pop-a.pop).forEach(b=>{
      const mkt=A.marketOf(b.cell), port=A.portOf(b.cell);
      const btnEl=document.createElement("button"); btnEl.className="row";
      btnEl.innerHTML='<b>'+esc(b.name)+(mkt?' ◎':'')+'</b><span>'+
        b.pop.toLocaleString()+(port?' · HARBOUR '+port.quality:'')+' · '+
        esc(A.biomeOf(b.cell).name)+'</span>';
      btnEl.onclick=()=>{ closeDrawer(); map.flyTo(C.x[b.cell],C.y[b.cell],5);
        showCell(b.cell); };
      body.appendChild(btnEl);
    });
  });
}

function fillAccount(body){
  const R=D.report;
  const rows=[
    ["Cells on the plate",M.cells.toLocaleString()],
    ["Of them, land",R.land_cells.toLocaleString()],
    ["Market centres",R.market_centers],
    ["Market pairs",R.market_pairs],
    ["Pairs with no overland way",R.unreachable_pairs],
    ["Land beyond every market",R.cells_beyond_reach_of_any_market+" cells"],
    ["Harbour-capable burgs",R.harbor_capable_burgs],
    ["Flagged as working ports",R.ports_flagged_in_file],
    ["Trunk / road / trail",[R.segments_by_class.trunk,R.segments_by_class.road,
      R.segments_by_class.trail].join(" / ")],
    ["Scale",M.scale+" miles a map unit"]
  ];
  let html='<p class="grp">THE ACCOUNT</p><dl class="acct">';
  rows.forEach(([k,v])=>html+='<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>');
  html+='</dl>';

  html+='<p class="grp">LANDMASSES</p>';
  R.landmasses.forEach(lm=>{
    html+='<div class="lm"><b>'+lm.cells.toLocaleString()+' cells · '+
      lm.population.toLocaleString()+' people</b><span>'+
      (lm.markets.length?esc(lm.markets.join(", ")):"no market centre")+'</span>'+
      '<span>'+esc((lm.states||[]).join(", "))+'</span></div>';
  });

  html+='<p class="grp">CATCHMENTS</p><dl class="acct">';
  Object.keys(R.catchment_sizes).forEach(k=>
    html+='<dt>'+esc(k)+'</dt><dd>'+R.catchment_sizes[k]+' cells</dd>');
  html+='</dl>';
  html+='<p class="empty">Every figure here is read straight out of '+
    'network_report.json, which adrinem_infra.py wrote when it laid the network.</p>';
  body.innerHTML=html;
}
function openDrawer(which){
  tab=which||tab;
  ["index","marks","account"].forEach(t=>
    q("tab"+t[0].toUpperCase()+t.slice(1)).setAttribute("aria-selected",String(t===tab)));
  q("drawerTitle").textContent=tab==="marks"?"Your marks":
    tab==="account"?"The account":"Index of the world";
  fillDrawer();
  q("drawer").classList.add("on");
  q("listBtn").setAttribute("aria-pressed","true");
}
function closeDrawer(){ q("drawer").classList.remove("on");
  q("listBtn").setAttribute("aria-pressed","false"); }

/* =================================================================================== */
/*  the key                                                                            */
/* =================================================================================== */
const MODE_ORDER=["biome","relief","realm","culture","catchment","supply","density",
  "habitability"];
function swatch(c){ return '<i style="background:'+c+'"></i>'; }
function fillKey(){
  const mode=map.mode;
  let h='<b>GROUND — '+A.map.MODES[mode].label+'</b>';
  if(mode==="biome"){
    Object.keys(PAL.BIOME).filter(n=>n!=="Marine").sort().forEach(n=>
      h+=swatch(PAL.BIOME[n])+n.toUpperCase()+"<br>");
  } else if(mode==="realm"){
    D.states.forEach(n=>{ if(n) h+=swatch(PAL.realm(n))+
      (n==="Neutrals"?"UNCLAIMED":n.toUpperCase())+"<br>"; });
  } else if(mode==="culture"){
    D.cultures.forEach((n,i)=>{ if(i&&D.cultures.indexOf(n)!==i) return;
      if(n) h+=swatch(PAL.culture(n))+n.toUpperCase()+"<br>"; });
  } else if(mode==="catchment"){
    D.markets.forEach((m,i)=>h+=swatch(PAL.catchment(i))+m.name.toUpperCase()+"<br>");
    h+=swatch("#E6E2D2")+"BEYOND EVERY MARKET<br>";
  } else if(mode==="supply"){
    h+=ramp(PAL.SUPPLY,"AT THE MARKET","FARTHEST")+swatch("#E6E2D2")+"BEYOND REACH<br>";
  } else if(mode==="relief"){
    h+=ramp(PAL.RELIEF,"SHORE","SUMMIT");
  } else if(mode==="density"){
    h+=ramp(PAL.DENSITY,"EMPTY","THICKEST");
  } else if(mode==="habitability"){
    h+=ramp(PAL.HAB,"BARREN","KINDEST");
  }
  h+='<b>ON THE PLATE</b>'+
    '<span style="display:inline-block;width:11px;text-align:center;margin-right:6px">◎</span>'+
    'RINGED · MARKET CENTRE<br>'+
    '<span style="display:inline-block;width:11px;text-align:center;margin-right:6px">—</span>'+
    'BARRED · HARBOUR<br>'+
    swatch(PAL.road.trunk)+'TRUNK &nbsp;'+swatch(PAL.road.road)+'ROAD &nbsp;'+
    swatch(PAL.road.trail)+'TRAIL<br>'+
    swatch(PAL.river)+'RIVER, THICKENED BY FLUX<br>'+
    swatch("#7A3E8F")+'YOUR MARKS AND ANY WAY FOUND'+
    '<b>KEYS</b>/ SEARCH &nbsp; G GROUND &nbsp; K KEY<br>'+
    'W WAY &nbsp; P PIN &nbsp; B INDEX &nbsp; R ROADS<br>ESC OUT';
  q("key").innerHTML=h;
}
function ramp(list,lo,hi){
  let h='<span style="display:inline-block;vertical-align:-2px;margin-right:6px">';
  list.forEach(c=>h+='<i style="background:'+c+';width:9px;margin:0;border-radius:0"></i>');
  return h+'</span>'+lo+' → '+hi+'<br>';
}

/* =================================================================================== */
/*  wiring                                                                             */
/* =================================================================================== */
function boot(){
  const t0=performance.now();
  map=A.map.init({
    svg:q("map"), stage:q("stage"),
    onGround(cell,x,y){
      if(pinMode){ dropMark(x,y); setPin(false); return; }
      if(pickFor){ if(!A.isLand(cell)){ toast("That end is in the water"); return; }
        setEnd(pickFor,cell); setPick(null); return; }
      if(cell>=0) showCell(cell);
    },
    onBurg(b){ showCell(b.cell); },
    onPin(p){ showPin(p); }
  });
  refreshPins();
  fillKey();
  const ms=Math.round(performance.now()-t0);
  q("hdrSub").textContent=
    M.cells.toLocaleString()+" CELLS · "+D.report.land_cells.toLocaleString()+" LAND · "+
    D.markets.length+" MARKETS · "+A.burgs.length+" BURGS · "+
    D.report.harbor_capable_burgs+" HARBOURS · PLATE CUT IN "+ms+" MS";

  /* ---- header search ---- */
  const si=q("search"), sr=q("results"), sw=q("srch");
  si.addEventListener("input",()=>{
    sw.classList.toggle("has",!!si.value);
    fillResults(sr,si.value,r=>{
      sr.classList.remove("on"); si.blur();
      map.flyTo(C.x[r.cell],C.y[r.cell],r.zoom||4);
      showCell(r.cell);
    });
  });
  q("searchClear").onclick=()=>{ si.value=""; sw.classList.remove("has");
    sr.classList.remove("on"); si.focus(); };
  document.addEventListener("click",e=>{ if(!sw.contains(e.target)) sr.classList.remove("on"); });

  /* ---- the rail ---- */
  let modeIx=0;
  q("grndBtn").onclick=()=>{
    modeIx=(modeIx+1)%MODE_ORDER.length;
    map.setMode(MODE_ORDER[modeIx]);
    q("grndBtn").textContent=A.map.MODES[map.mode].label.slice(0,4);
    fillKey();
    toast("Ground — "+A.map.MODES[map.mode].label.toLowerCase());
  };
  const toggles=[["rdBtn","road",true],["rivBtn","river",true],["brdBtn","march",true],
    ["grtBtn","grat",false]];
  toggles.forEach(([id,layer,on])=>{
    const b=q(id); let state=on;
    b.setAttribute("aria-pressed",String(state));
    map.setLayer(layer,state);
    b.onclick=()=>{ state=!state; b.setAttribute("aria-pressed",String(state));
      map.setLayer(layer,state); };
  });
  q("keyBtn").onclick=()=>{
    const on=q("key").classList.toggle("on");
    q("keyBtn").setAttribute("aria-pressed",String(on));
  };
  function setPin(on){
    pinMode=on;
    q("pinBtn").setAttribute("aria-pressed",String(on));
    q("stage").classList.toggle("pinning",on);
    if(on){ setPick(null); toast("Tap the plate to drop a mark"); }
  }
  q("pinBtn").onclick=()=>setPin(!pinMode);
  q("listBtn").onclick=()=>q("drawer").classList.contains("on")?closeDrawer():openDrawer();
  q("drawerClose").onclick=closeDrawer;
  q("tabIndex").onclick=()=>openDrawer("index");
  q("tabMarks").onclick=()=>openDrawer("marks");
  q("tabAccount").onclick=()=>openDrawer("account");
  q("wayBtn").onclick=()=>q("wayPanel").classList.contains("on")?closeWay():openWay();
  q("wayClose").onclick=closeWay;
  q("reachBtn").onclick=()=>{
    if(reachOn){ clearReach(); return; }
    const at=sel!=null?sel:ends.from;
    if(at==null){ toast("Open a place first, then cast a reach from it"); return; }
    runReach(at);
  };
  q("zin").onclick=()=>map.zoomAt(1.35,innerWidth/2,innerHeight/2);
  q("zout").onclick=()=>map.zoomAt(1/1.35,innerWidth/2,innerHeight/2);
  q("rst").onclick=()=>{ map.fit(); closeSheet(); };

  /* ---- the way console ---- */
  [["from","wFrom","wFromRes","wFromPick"],["to","wTo","wToRes","wToPick"]]
  .forEach(([which,inp,res,pick])=>{
    q(inp).addEventListener("input",()=>{
      ends[which]=null;
      fillResults(q(res),q(inp).value,r=>{
        q(res).classList.remove("on");
        setEnd(which,r.cell);
      });
    });
    q(pick).onclick=()=>setPick(pickFor===which?null:which);
  });
  q("wSwap").onclick=()=>{
    const a=ends.from, b=ends.to;
    ends.from=b; ends.to=a;
    q("wFrom").value=b==null?"":nameOf(b);
    q("wTo").value=a==null?"":nameOf(a);
    if(ends.from!=null&&ends.to!=null) plan();
  };
  q("wPlan").onclick=plan;
  q("wClear").onclick=()=>{
    ends={from:null,to:null}; q("wFrom").value=""; q("wTo").value="";
    q("wOut").innerHTML=""; map.clearRoute(); clearReach(); setPick(null);
  };

  /* ---- the editor ---- */
  q("edSave").onclick=()=>closeEditor(true);
  q("edCancel").onclick=()=>closeEditor(false);
  q("edDel").onclick=()=>{ if(editing){ store.remove(editing.id); editing=null;
    closeEditor(false); closeSheet(); toast("Mark removed"); } };
  q("scrim").onclick=()=>closeEditor(false);
  q("closeSheet").onclick=closeSheet;

  /* ---- marks in and out ---- */
  q("mkCopy").onclick=()=>{
    const txt=JSON.stringify(store.all(),null,1);
    navigator.clipboard?navigator.clipboard.writeText(txt).then(
      ()=>toast("Marks copied"),()=>toast("Could not copy")):toast("Could not copy");
  };
  q("mkPaste").onclick=()=>{
    const txt=prompt("Paste marks as JSON:");
    if(!txt) return;
    try{
      const rows=JSON.parse(txt);
      if(!Array.isArray(rows)) throw 0;
      const have=store.all();
      rows.forEach(r=>{ if(typeof r.x==="number"&&typeof r.y==="number")
        have.push({id:"m"+Math.random().toString(36).slice(2,9),x:r.x,y:r.y,
          name:String(r.name||"Imported mark"),note:String(r.note||"")}); });
      store.save(have); refreshPins(); toast("Imported "+rows.length+" marks");
    }catch(e){ toast("That was not a list of marks"); }
  };
  q("mkClear").onclick=()=>{
    if(!store.all().length) return;
    if(confirm("Remove every mark on this plate?")){ store.save([]); refreshPins();
      closeSheet(); toast("Marks cleared"); }
  };

  /* ---- keys ---- */
  addEventListener("keydown",e=>{
    if(e.target.matches("input,textarea")){
      if(e.key==="Escape") e.target.blur();
      if(e.key==="Enter"&&e.target.id==="wFrom") q("wTo").focus();
      if(e.key==="Enter"&&e.target.id==="wTo") plan();
      return;
    }
    const k=e.key.toLowerCase();
    if(k==="/"){ e.preventDefault(); si.focus(); si.select(); }
    else if(k==="g") q("grndBtn").click();
    else if(k==="k") q("keyBtn").click();
    else if(k==="w") q("wayBtn").click();
    else if(k==="p") q("pinBtn").click();
    else if(k==="b") q("listBtn").click();
    else if(k==="r") q("rdBtn").click();
    else if(e.key==="Escape"){
      closeSheet(); closeDrawer(); closeWay(); setPin(false); setPick(null);
      q("key").classList.remove("on"); q("keyBtn").setAttribute("aria-pressed","false");
    }
  });

  q("grndBtn").textContent=A.map.MODES[map.mode].label.slice(0,4);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
