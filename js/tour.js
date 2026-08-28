/* ===================================================================================
   A guided read of the sheet. Both sheets carry a great deal and almost none of it
   announces itself, so this walks a reader round the controls and works them as it
   goes: the step that explains the fabric turns the fabric on, the step that explains
   the way-finder opens it. Nothing is described that is not also shown.

   It runs itself once, the first time a sheet is opened in a browser, and afterwards
   lives behind the ? on the rail.
   =================================================================================== */
(function(){
"use strict";
const q=id=>document.getElementById(id);
const has=id=>!!q(id);

/* ---- small helpers for driving the app's own controls ----------------------------- */
const pressed=el=>el&&el.getAttribute("aria-pressed")==="true";
function toggle(id,on){                       /* a rail button with aria-pressed */
  const b=q(id); if(!b) return;
  if(pressed(b)!==!!on) b.click();
}
function panel(btnId,panelId,on){             /* a button that opens a panel */
  const p=q(panelId); if(!p) return;
  if(p.classList.contains("on")!==!!on&&q(btnId)) q(btnId).click();
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* =================================================================================== */
/*  the engine                                                                         */
/* =================================================================================== */
let steps=null, ix=0, live=false, onEnd=null;
let dim,hole,card,ttl,body,count,prev,next,skip;

function build(){
  if(dim) return;
  dim=document.createElement("div"); dim.className="tourdim";
  hole=document.createElement("div"); hole.className="tourhole";
  dim.appendChild(hole);
  card=document.createElement("div"); card.className="tourcard";
  card.innerHTML=
    '<p class="tt"></p><div class="tb"></div>'+
    '<div class="tf"><span class="tc"></span>'+
    '<button class="tskip">SKIP</button>'+
    '<button class="tprev">BACK</button>'+
    '<button class="tnext">NEXT</button></div>';
  document.body.appendChild(dim);
  document.body.appendChild(card);
  ttl=card.querySelector(".tt"); body=card.querySelector(".tb");
  count=card.querySelector(".tc");
  prev=card.querySelector(".tprev"); next=card.querySelector(".tnext");
  skip=card.querySelector(".tskip");
  prev.onclick=()=>go(ix-1);
  next.onclick=()=>go(ix+1);
  skip.onclick=()=>stop();
  dim.onclick=e=>{ if(e.target===dim) go(ix+1); };
  addEventListener("keydown",key,true);
  addEventListener("resize",()=>{ if(live) place(); });
}

function key(e){
  if(!live) return;
  e.stopPropagation();
  if(e.key==="Escape"){ e.preventDefault(); stop(); }
  else if(e.key==="ArrowRight"||e.key==="Enter"){ e.preventDefault(); go(ix+1); }
  else if(e.key==="ArrowLeft"){ e.preventDefault(); go(ix-1); }
}

/* The union of several elements' rectangles, skipping any that are not on screen —
   used where the thing being explained is a control and the panel it just opened. */
function union(){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  [].slice.call(arguments).forEach(sel=>{
    const n=typeof sel==="string"?document.querySelector(sel):sel;
    if(!n) return;
    const r=n.getBoundingClientRect();
    if(!r.width||!r.height) return;
    x0=Math.min(x0,r.left); y0=Math.min(y0,r.top);
    x1=Math.max(x1,r.right); y1=Math.max(y1,r.bottom);
  });
  if(x0===Infinity) return null;
  return {x:x0-8,y:y0-8,w:x1-x0+16,h:y1-y0+16};
}

/* where the hole is: a named element, a custom rectangle, or nothing at all */
function targetRect(s){
  if(s.spot) return s.spot();
  if(!s.el) return null;
  const n=typeof s.el==="string"?document.querySelector(s.el):s.el;
  if(!n) return null;
  const r=n.getBoundingClientRect();
  if(!r.width||!r.height) return null;
  const pad=s.pad==null?8:s.pad;
  return {x:r.left-pad, y:r.top-pad, w:r.width+pad*2, h:r.height+pad*2};
}

function place(){
  const s=steps[ix], r=targetRect(s);
  if(!r){
    /* nothing to point at, so the dimmer paints its own ground instead of relying on
       the hole's shadow to do it */
    dim.classList.add("solid");
    hole.style.display="none";
    card.style.left="50%"; card.style.top="50%";
    card.style.transform="translate(-50%,-50%)";
    return;
  }
  dim.classList.remove("solid");
  hole.style.display="";
  hole.style.left=r.x+"px"; hole.style.top=r.y+"px";
  hole.style.width=r.w+"px"; hole.style.height=r.h+"px";
  hole.style.borderRadius=(s.round==null?12:s.round)+"px";

  card.style.transform="none";
  const cw=card.offsetWidth, ch=card.offsetHeight, gap=14;
  let x,y;
  if(r.x-gap-cw>8) x=r.x-gap-cw;                     /* left of the target */
  else if(r.x+r.w+gap+cw<innerWidth-8) x=r.x+r.w+gap; /* right of it */
  else x=Math.min(Math.max(8,r.x+r.w/2-cw/2),innerWidth-cw-8);
  if(x===r.x-gap-cw||x===r.x+r.w+gap) y=r.y+r.h/2-ch/2;
  else if(r.y+r.h+gap+ch<innerHeight-8) y=r.y+r.h+gap;
  else y=r.y-gap-ch;
  card.style.left=Math.round(Math.min(Math.max(8,x),innerWidth-cw-8))+"px";
  card.style.top=Math.round(Math.min(Math.max(8,y),innerHeight-ch-8))+"px";
}

async function go(n){
  if(!live) return;
  if(n<0) return;
  if(n>=steps.length) return stop(true);
  const from=steps[ix];
  if(from&&from.after&&n!==ix) try{ from.after(); }catch(e){}
  ix=n;
  const s=steps[ix];
  /* Let the click that got us here finish bubbling first. The sheets close their own
     search results on any click landing outside the box, so a step that types into it
     during that same click has its results shut again a moment later. */
  await sleep(0);
  if(!live) return;
  if(s.before) try{ s.before(); }catch(e){}
  if(s.wait) await sleep(s.wait);
  if(!live) return;
  ttl.textContent=s.title;
  body.innerHTML=s.body;
  count.textContent=(ix+1)+" / "+steps.length;
  prev.style.visibility=ix?"":"hidden";
  next.textContent=ix===steps.length-1?"DONE":"NEXT";
  card.classList.remove("on");
  place();
  requestAnimationFrame(()=>card.classList.add("on"));
}

function start(list,opts){
  build();
  steps=list; ix=-1; live=true;
  onEnd=(opts||{}).onEnd||null;
  dim.classList.add("on");
  go(0);
}
function stop(finished){
  if(!live) return;
  const s=steps&&steps[ix];
  if(s&&s.after) try{ s.after(); }catch(e){}
  live=false;
  dim.classList.remove("on"); card.classList.remove("on");
  if(onEnd) try{ onEnd(!!finished); }catch(e){}
}

/* =================================================================================== */
/*  what to say, sheet by sheet                                                        */
/* =================================================================================== */
const RAIL="Every control on the right does one thing and says so in four letters.";

const NYC_STEPS=[
 {title:"NYC 2050", body:
  "A survey sheet of a New York left to the water — 304 logged sites, a generated city "+
  "of 5,242 blocks under them, and a set of tools for asking what happens next.<br><br>"+
  "This walk works the controls as it explains them. <b>→</b> or <b>NEXT</b> to go on, "+
  "<b>Esc</b> to leave at any point."},

 {el:"#stage", title:"The sheet itself", pad:-2, round:0,
  spot:()=>({x:innerWidth*0.18,y:innerHeight*0.22,w:innerWidth*0.5,h:innerHeight*0.5}),
  body:"Drag to pan, scroll or pinch to zoom, and <b>tap anything</b> — a station, a "+
  "block, a street — to read its field note. Manhattan is banded by habitability, and "+
  "the ground the survey never covered is left hatched."},

 {title:"Search the sheet", wait:150,
  spot:()=>union("#srch","#results"),
  before(){ q("search").value="Grand Central"; q("search").dispatchEvent(new Event("input")); },
  after(){ q("searchClear").click(); },
  body:"Type any site, street or district. Press <b>/</b> from anywhere to jump into "+
  "the box. Choosing a result flies the sheet to it and opens its note."},

 {title:"KEY — the legend", wait:220,
  spot:()=>union("#keyBtn","#key"),
  before(){ toggle("keyBtn",true); }, after(){ toggle("keyBtn",false); },
  body:"The whole colour scheme in one panel: habitability bands, disposition, the "+
  "fabric, heights, and what a projection's colours mean. It changes with whatever "+
  "you have turned on."},

 {el:"#covBtn", title:"CVRG and THRU", pad:10,
  spot:()=>{const a=q("covBtn").getBoundingClientRect(),b=q("thruBtn").getBoundingClientRect();
    return {x:a.left-8,y:a.top-8,w:a.width+16,h:b.bottom-a.top+16};},
  body:"<b>CVRG</b> shows or hides the survey's coverage — the hatched ground nobody "+
  "walked. <b>THRU</b> draws the named thoroughfares with their names riding the road: "+
  "Flatbush, Eastern Parkway, the Grand Concourse, the FDR."},

 {el:"#hgtBtn", title:"HGT — structure heights", wait:220,
  before(){ toggle("hgtBtn",true); }, after(){ toggle("hgtBtn",false); },
  body:"A bar over every station, its length the roof height. Real figures for the 127 "+
  "buildings anybody would recognise; for the rest, a plausible height from category "+
  "and district density. The collapse projection reads these directly."},

 {el:"#blkBtn", title:"BLK — the built fabric", wait:320,
  before(){ toggle("blkBtn",true); },
  after(){ const b=q("blkBtn"); for(let i=0;i<6&&pressed(b);i++) b.click(); },
  body:"5,242 city blocks generated from the street grid itself — avenues and streets "+
  "bound them, the shoreline clips them, the parks are cut out. Each carries a use, a "+
  "period, a height, a floor area and a shelter capacity. <b>Press BLK again</b> to "+
  "colour them by use, by height, or by period. Tap one to read it."},

 {title:"SIM — contingency projections", wait:360,
  spot:()=>union("#simBtn","#simPanel"),
  before(){ panel("simBtn","simPanel",true); },
  body:"Six hazards — hurricane surge, earthquake, firestorm, structural collapse, a "+
  "blast event, an infrastructure failure. Choose one, set its sliders, place it on "+
  "the sheet and run it. Twenty-four hours are simulated and the sheet recolours to "+
  "the outcome."},

 {el:"#simPanel", title:"What a projection reports", pad:6,
  body:"Every site is scored twice: what the event broke, and what stopped working "+
  "because something else broke. Fourteen installations supply power, water, food and "+
  "sanitation across a reach, and the write-up reports only what <i>this</i> event took "+
  "away.<br><br>A blast or a collapse also throws debris, flown as ballistic fragments "+
  "through the real block heights — the console draws a section under the throw line."},

 {el:"#simTime", title:"The hour scrubber",
  spot:()=>{const n=q("simTime"),r=n.getBoundingClientRect();
    return r.width?{x:r.left-8,y:r.top-8,w:r.width+16,h:r.height+16}:
      {x:innerWidth/2-260,y:innerHeight-150,w:520,h:110};},
  body:"Once a projection has run, this appears along the bottom. Play it, or drag "+
  "through the twenty-four hours: the sheet recolours to that hour and the log says "+
  "what failed when."},

 {title:"NAV — find a way across", wait:360,
  spot:()=>union("#navBtn","#rtPanel"),
  before(){ panel("simBtn","simPanel",false); panel("navBtn","rtPanel",true); },
  body:"Set two ends — search them, tap them on the sheet, or send any site straight "+
  "here with ROUTE TO / ROUTE FROM on its note. Four weightings of the same network "+
  "give up to four routes: <b>fastest</b>, <b>safest</b>, <b>driest</b> and "+
  "<b>supplied</b>, each with a distance, a walking time, a hazard index and a "+
  "turn-by-turn list."},

 {el:"#rtPanel", title:"Tide, and planning against a disaster", pad:6,
  after(){ panel("navBtn","rtPanel",false); },
  body:"The <b>tide</b> slider decides which low ground is passable — the elevation "+
  "surface is measured against the 2050 waterline. And <b>PLAN AGAINST THE CURRENT "+
  "PROJECTION</b> re-prices every link against whatever SIM has just done: fire is "+
  "impassable, lost blocks are rubble at a fifth of walking pace, flooded ground is "+
  "closed."},

 {title:"LIST — plates and your marks", wait:320,
  spot:()=>union("#listBtn","#drawer"),
  before(){ panel("listBtn","drawer",true); }, after(){ panel("listBtn","drawer",false); },
  body:"Thirteen sites are drawn with a ring on the sheet and open a <b>street-level "+
  "plate</b>: a procedurally drawn view of the place as the survey found it, with a "+
  "switch to see it as it was built. They are grouped into walks, and the arrows step "+
  "along the walk you are on.<br><br>The second tab holds your own marks."},

 {el:"#pinBtn", title:"PIN — your own marks",
  body:"Press <b>PIN</b> and tap the sheet to drop a mark, name it and write a note. "+
  "<b>BOOKMARK</b> on any surveyed site keeps it. Marks can be copied out and pasted "+
  "back in as JSON, and everything is held in this browser — nothing leaves it."},

 {el:".sheetsw", title:"Two sheets",
  body:"This switch moves between the survey sheet and <b>Adrinem</b> — an "+
  "infrastructure plate of a high fantasy world, with the same chrome pointed at a "+
  "different problem. It has a walk of its own."},

 {title:"Keys", body:
  "<b>/</b> search &nbsp; <b>P</b> pin &nbsp; <b>B</b> marks &nbsp; <b>K</b> key<br>"+
  "<b>S</b> projections &nbsp; <b>N</b> navigate &nbsp; <b>H</b> heights &nbsp; "+
  "<b>F</b> fabric<br>In a plate: <b>←</b> <b>→</b> walk, <b>T</b> then/now, "+
  "<b>Esc</b> out.<br><br>"+RAIL+" The <b>?</b> at the bottom of it starts this walk "+
  "again whenever you want it."}
];

const ADRINEM_STEPS=[
 {title:"Adrinem", body:
  "An infrastructure plate of a high fantasy world: 3,817 cells, 14 realms, 8 peoples, "+
  "80 burgs and the trade network between them — all of it read out of a map export "+
  "and rebuilt in the browser.<br><br>This walk works the controls as it explains "+
  "them. <b>→</b> or <b>NEXT</b> to go on, <b>Esc</b> to leave."},

 {el:"#stage", title:"The plate itself",
  spot:()=>({x:innerWidth*0.18,y:innerHeight*0.2,w:innerWidth*0.5,h:innerHeight*0.55}),
  body:"Drag to pan, scroll or pinch to zoom, <b>tap any ground</b> to read the cell "+
  "under it: its biome, its realm and province, who lives there, and how far it is "+
  "from the market that feeds it.<br><br>The cell shapes are not in the export — it "+
  "carries a point per cell — so the sheet rebuilds the Voronoi diagram the generator "+
  "made in the first place."},

 {title:"Search the world", wait:150,
  spot:()=>union("#srch","#results"),
  before(){ q("search").value="Kel"; q("search").dispatchEvent(new Event("input")); },
  after(){ q("searchClear").click(); },
  body:"Burgs, realms, provinces, peoples and biomes. Press <b>/</b> from anywhere to "+
  "jump into the box."},

 {title:"GRND — what the ground is coloured by", wait:280,
  spot:()=>union("#grndBtn","#key"),
  before(){ toggle("keyBtn",true); },
  body:"Press it to cycle: <b>biome</b>, <b>relief</b>, <b>realms</b>, <b>peoples</b>, "+
  "<b>catchments</b>, <b>supply</b>, <b>population</b>, <b>habitability</b>. The key "+
  "on the left changes with it."},

 {el:"#key", title:"Two of those are the point", pad:6,
  after(){ toggle("keyBtn",false); },
  body:"<b>Catchments</b> shows which of the seventeen markets each piece of ground "+
  "actually belongs to, and hatches the 326 land cells beyond the reach of every one "+
  "of them — including all of Jomhor, which has no market on it at all.<br><br>"+
  "<b>Supply</b> is the same surface read as distance: at twenty-five effective miles "+
  "a day, half the land is more than forty days from the market that feeds it."},

 {el:"#rdBtn", title:"The layers", pad:10,
  spot:()=>{const a=q("rdBtn").getBoundingClientRect(),b=q("grtBtn").getBoundingClientRect();
    return {x:a.left-8,y:a.top-8,w:a.width+16,h:b.bottom-a.top+16};},
  body:"<b>RDS</b> the trade network, classed trunk, road and trail by how many market "+
  "pairs use it. <b>RIV</b> the rivers, thickened by flux. <b>BRD</b> the realm and "+
  "province marches. <b>GRT</b> a graticule, off the longitude and latitude the export "+
  "carried."},

 {title:"WAY — find a way across", wait:340,
  spot:()=>union("#wayBtn","#wayPanel"),
  before(){ panel("wayBtn","wayPanel",true); },
  body:"Set two ends and the console finds the least-cost route, priced by the same "+
  "model that laid the exported network:<br><br>"+
  "<code>cost = miles × terrain × slope + 12 mi a ford</code><br><br>"+
  "It comes back with the cost in effective miles, what that is in days of supply, how "+
  "much further it is than the straight line, and a leg list broken at every change of "+
  "biome or realm."},

 {el:"#wayPanel", title:"When there is no way", pad:6,
  after(){ panel("wayBtn","wayPanel",false); },
  body:"44 of the 136 market pairs have no overland route at any price. Ask for one "+
  "and the console says so and names the nearest harbours — because that crossing "+
  "would have to be sailed, and no sea legs are drawn.<br><br>Over all 136 pairs this "+
  "router reproduces the exported figures to within 0.006 per cent."},

 {el:"#reachBtn", title:"RCH — cast a reach",
  body:"Open any place, then press <b>RCH</b>: everything within 25, 50, 100, 200 and "+
  "400 days of it is banded on the plate, with the cells, the people and the burgs "+
  "inside each band."},

 {title:"LIST — the index and the account", wait:320,
  spot:()=>union("#listBtn","#drawer"),
  before(){ panel("listBtn","drawer",true); }, after(){ panel("listBtn","drawer",false); },
  body:"Three tabs: an <b>index</b> of every burg by realm, your own <b>marks</b>, and "+
  "<b>the account</b> — the figures straight out of the exported network report, "+
  "including every landmass and what it does and does not have a market on."},

 {el:"#pinBtn", title:"PIN — your own marks",
  body:"Press <b>PIN</b> and tap the plate to drop a mark, name it and write a note. "+
  "They are kept in this browser under their own key, so the two sheets never tread on "+
  "each other."},

 {title:"City plates", body:
  "A market centre that is also a harbour carries a <b>◉ CITY PLATE</b> on its note. "+
  "It generates the ground under the dot — streets, quays, blocks, the wall and its "+
  "gates and about thirty named places — in about a third of a second.<br><br>"+
  "Try <b>Oem'rek</b>, a merchant port whose sister city cannot be reached by land, or "+
  "<b>Rithi</b>, the only through-route in Adrinem, whose road is bent round a "+
  "sanctuary it may not cross. The plate has a short walk of its own the first time "+
  "you open one."},

 {el:".sheetsw", title:"Two sheets",
  body:"This switch moves between Adrinem and <b>NYC 2050</b>, a survey sheet of a New "+
  "York left to the water. It has a walk of its own."},

 {title:"Keys", body:
  "<b>/</b> search &nbsp; <b>G</b> ground &nbsp; <b>K</b> key &nbsp; <b>W</b> way<br>"+
  "<b>P</b> pin &nbsp; <b>B</b> index &nbsp; <b>R</b> roads &nbsp; <b>Esc</b> out."+
  "<br><br>"+RAIL+" The <b>?</b> at the bottom of it starts this walk again whenever "+
  "you want it."}
];

const PLATE_STEPS=[
 {title:"A city plate", body:
  "The ground under one dot on the world sheet, generated the moment you asked for it. "+
  "Nothing here was surveyed and nothing was drawn by hand: the plan follows from what "+
  "the export says about the site — where the sea is, how enclosed the harbour is, "+
  "which way the land trade arrives, whether there is a river — plus the burg's "+
  "population.<br><br><b>→</b> to go on, <b>Esc</b> to leave."},

 {el:"#cpStage", title:"Reading it",
  spot:()=>({x:innerWidth*0.2,y:innerHeight*0.2,w:innerWidth*0.5,h:innerHeight*0.55}),
  body:"Drag and zoom as on the world sheet. <b>Tap any block</b> for its use, its "+
  "floor area, its storeys and how many live on it; <b>tap any named place</b> — the "+
  "anchors, stars, gates and towers — for why it is there."},

 {el:"#cpFabBtn", title:"USE — colour the fabric",
  body:"Cycle the blocks by <b>use</b>, by <b>storeys</b>, or by <b>density</b>. Press "+
  "<b>F</b> for the same thing."},

 {title:"KEY", wait:240,
  spot:()=>union("#cpKeyBtn","#cpKey"),
  before(){ toggle("cpKeyBtn",true); }, after(){ toggle("cpKeyBtn",false); },
  body:"Every use on the plate with the ground it takes up, plus the streets, the wall "+
  "and anything else the plan has."},

 {title:"ACCT — the account, and why this plan", wait:500,
  spot:()=>union("#cpAcctBtn","#cpAcct"),
  before(){ toggle("cpAcctBtn",true); }, after(){ toggle("cpAcctBtn",false); },
  body:"The figures — people, ground, density, blocks, the wall — and then the "+
  "important part: <b>what the export says</b>, line by line, and what each line "+
  "decided.<br><br>Where a city's plan also depends on something the map file does not "+
  "contain — a realm's religion, say — that is listed separately and labelled as the "+
  "author's premise, so the two kinds of claim never get mixed up."},

 {title:"Two kinds of city", body:
  "The generator picks the plan from the network. A burg whose trade is seaborne gets "+
  "the <b>port</b> plan: a staple where the land road meets the quay, radials to each "+
  "gate, rings thrown across them.<br><br>A burg with two trunk roads leaving on "+
  "nearly opposite bearings is not a town with roads but a road with a town on it, and "+
  "gets the <b>crossing</b> plan instead. Exactly one market in Adrinem answers to "+
  "that.<br><br><b>Esc</b> or the <b>×</b> returns you to the world sheet."}
];

/* =================================================================================== */
/*  wiring                                                                             */
/* =================================================================================== */
const SHEET=has("simBtn")?"nyc":has("grndBtn")?"adrinem":null;
const KEY="tour.seen."+SHEET+".v1", PKEY="tour.seen.plate.v1";
const seen=k=>{ try{ return !!localStorage.getItem(k); }catch(e){ return true; } };
const mark=k=>{ try{ localStorage.setItem(k,"1"); }catch(e){} };

function startSheet(){
  if(!SHEET) return;
  start(SHEET==="nyc"?NYC_STEPS:ADRINEM_STEPS,{onEnd(){ mark(KEY); }});
}
function startPlate(){ start(PLATE_STEPS,{onEnd(){ mark(PKEY); }}); }

function addButton(rail,id,label,fn){
  if(!rail||q(id)) return;
  const b=document.createElement("button");
  b.id=id; b.className="sm"; b.textContent="?";
  b.setAttribute("aria-label",label);
  b.style.fontSize="15px";
  b.onclick=fn;
  rail.appendChild(b);
}
function addButtons(){
  addButton(document.querySelector(".ctl"),"tourBtn","How this sheet works",startSheet);
  addButton(document.querySelector(".cpctl"),"cpTourBtn","How this plate works",
    startPlate);
}

function boot(){
  if(!SHEET) return;
  addButtons();
  if(!seen(KEY)) setTimeout(startSheet,900);
}

window.TOUR={
  start:startSheet, startPlate:startPlate, stop:stop,
  /* the plate walk runs itself the first time a plate is opened, and not again */
  maybePlate(){ if(!seen(PKEY)&&!live) setTimeout(startPlate,700); },
  reset(){ try{ localStorage.removeItem(KEY); localStorage.removeItem(PKEY); }catch(e){} }
};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
