/* ===================================================================================
   Adrinem — the colours the plate is washed in. Kept apart from the renderer so the
   sheet can be recoloured without touching how it is drawn.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};

/* Biomes, as an atlas would hand-colour them: cool north, dry middle, wet tropics,
   and the three that are not natural history at all given their own register. */
const BIOME={
  "Marine":"#7C97A6",
  "Glacier":"#DEE6EA",
  "Snowy":"#E3E6E2",
  "Cold desert":"#DCD3B8",
  "Hot desert":"#E7D6A0",
  "Barrens":"#CBC1A8",
  "Grassland":"#C9D29B",
  "Savanna":"#DACB8E",
  "Wetland":"#A3B99B",
  "Coastal":"#D6D4B6",
  "Taiga":"#9AB096",
  "Temperate deciduous forest":"#A6BF88",
  "Temperate rainforest":"#82A67A",
  "Tropical seasonal forest":"#A8C07C",
  "Tropical rainforest":"#7BA765",
  "Glades":"#B8CE92",
  "Volcanic":"#9E7C72",
  "Dragon Tundra":"#B9A6C0",
  "Dead Forrest":"#97907F",
  "Blood Fields":"#B06B6B"
};

/* The fourteen realms. Neutrals is left the colour of bare paper on purpose. */
const REALM={
  "Neutrals":"#D9D6C8",
  "Asra":"#C98A5E", "Cutho":"#8FA9C4", "Remoore":"#A8B96A", "Boru":"#C4A24E",
  "Kel'Esta":"#7FA890", "Mhekinn":"#B2718F", "Dragon Coves":"#9E86C0",
  "Jomhor":"#5F8C93", "Edhellon":"#88B071", "Lecende":"#D3A05F",
  "Dymia":"#A0B8CE", "Dead Forrest":"#8C8676", "Blood Fields":"#B06B6B"
};

const CULTURE={
  "Wildlands":"#D2CFC2", "HUMANS":"#B9A46E", "ANGELS":"#CFD8E4",
  "DEMONS":"#A66A64", "GODLINGS":"#B9A0C8", "SHIFTERS":"#8FA87E",
  "DRAGON RIDGERS":"#9E86C0", "HALFLINGS":"#C4B48C"
};

/* Seventeen catchments; picked to stay apart from their neighbours on the sheet. */
const CATCH=["#C98A5E","#7FA890","#8FA9C4","#C4A24E","#B2718F","#A8B96A","#9E86C0",
  "#5F8C93","#88B071","#D3A05F","#A0B8CE","#8C8676","#B06B6B","#6E9AA8","#BFA05A",
  "#94A870","#AE8FA8"];

/* Sequential ramps. Nine steps: enough to read a gradient, few enough to keep the
   ground layer down to nine paths. */
const RELIEF=["#B9C99B","#C3CE9A","#CDD199","#D5CE95","#D8C48A","#D4B47C","#C79E6D",
  "#B5896A","#D8D2CC"];
const SUPPLY=["#3F6B5A","#5B8168","#7B9878","#9BAE89","#BBC49E","#D3D2B0","#E2DCBF",
  "#EDE6CE","#F4EEDC"];
const DENSITY=["#F2ECD8","#E4DCB8","#D5C795","#C6AC72","#B48E5A","#9E7048","#84543A",
  "#6A3B2E","#4E2626"];
const HAB=["#CFC7B0","#C9CBA4","#C0CD97","#B4CC89","#A6C87B","#95C06D","#82B65F",
  "#6DA952","#569A45"];

const step=(ramp,t)=>ramp[Math.max(0,Math.min(ramp.length-1,Math.floor(t*ramp.length)))];

A.palette={
  biome:n=>BIOME[n]||"#C9C6B6",
  realm:n=>REALM[n]||"#CFCCBE",
  culture:n=>CULTURE[n]||"#D2CFC2",
  catchment:i=>CATCH[i%CATCH.length],
  RELIEF:RELIEF, SUPPLY:SUPPLY, DENSITY:DENSITY, HAB:HAB, CATCH:CATCH,
  BIOME:BIOME, REALM:REALM, CULTURE:CULTURE,
  step:step,
  sea:"#7C97A6", shelf:"#93A9B4", deep:"#6B8695",
  ink:"#2C2C2A", paper:"#FAF9F5",
  road:{trunk:"#7A4A22", road:"#8E6134", trail:"#9C8258"},
  river:"#4E7C96"
};
})();
