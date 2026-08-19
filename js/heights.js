/* ===================================================================================
   NYC 2050 — structure heights.
   Roof heights in metres, near enough to the real thing for the ones anybody would
   recognise and plausible for the rest. Height drives three things: what a falling
   structure reaches, what a thrown fragment flies over rather than into, and the
   elevation profile drawn under a debris corridor.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

/* ---- named structures: height to roof, metres ------------------------------------ */
const H={
 /* --- Lower Manhattan --- */
 "One World Trade Center":541,"One New York Plaza":195,"120 Wall Street":120,
 "Woolworth Building":241,"Manhattan Municipal Building":177,"Trinity Church":86,
 "New York Stock Exchange":34,"Cunard Building":68,"New York City Hall":30,
 "Thurgood Marshall Courthouse":180,"Surrogate's Court":33,"The Sun Building":26,
 "St Paul's Chapel":66,"9/11 Memorial & Museum":34,"Pace University":52,
 "401 Broadway":65,"Battery Park City":90,"South Street Seaport":18,
 "Fraunces Tavern":14,"National Museum of the American Indian":42,
 "NY-Presbyterian Lower Manhattan":48,"Bowery Savings Bank":26,
 /* --- Village to Midtown --- */
 "Washington Square Arch":23,"New York University":48,"Jefferson Market Library":30,
 "Cooper Square":30,"Webster Hall":24,"Palladium":26,"The Strand":22,
 "Flatiron Building":87,"Empire State Building":381,"Macy's":45,"Morgan Library":22,
 "Museum of Sex":26,"Barnes & Noble":30,"Xavier High School":28,
 "New York Public Library":30,"Grand Central Terminal":32,"Summit One Vanderbilt":427,
 "Penn Station":30,"Moynihan Train Hall":28,"Times Square":111,
 "Rockefeller Center":260,"St. Patrick's Cathedral":100,"Museum of Modern Art":76,
 "Trump Tower":202,"Carnegie Hall":45,"Javits Center":46,"Hudson Yards":387,
 "Vessel":46,"The High Line":9,"Chelsea Market":25,"Whitney Museum":67,
 "Little Island":12,"Bathhouse Flatiron":22,"Tenement Museum":20,"New Museum":53,
 "Katz's Delicatessen":12,"McSorley's Old Ale House":12,"Bowery Ballroom":18,
 "Cooper Square":30,"Union Square":0,"Madison Square Garden":45,
 /* --- Upper Manhattan --- */
 "Lincoln Center":40,"Metropolitan Opera":42,"Mount Sinai West":60,
 "American Museum of Natural History":45,"Beresford Apartments":91,"The Dakota":44,
 "Beacon Theatre":30,"Solomon R. Guggenheim Museum":28,"Metropolitan Museum of Art":30,
 "Neue Galerie":26,"Cooper Hewitt":24,"Jewish Museum":30,
 "Museum of the City of New York":26,"El Museo del Barrio":22,
 "The Frick Collection":20,"Mount Sinai Hospital":90,"Gracie Mansion":11,
 "Belvedere Castle":14,"Cathedral of St John the Divine":70,"Columbia University":58,
 "Grant's Tomb":46,"Riverside Church":120,"Apollo Theater":20,
 "Studio Museum in Harlem":18,"Harlem Hospital Center":58,
 "Abyssinian Baptist Church":30,"City College of New York":44,"Hamilton Grange":11,
 "The Met Cloisters":36,"NY-Presbyterian Columbia":90,"Highbridge Water Tower":61,
 "United Palace":40,"Museum Mile":30,
 /* --- Brooklyn --- */
 "Soldiers' and Sailors' Memorial Arch":24,"Grand Army Plaza":24,
 "Brooklyn Museum":34,"Brooklyn Public Library":25,"Barclays Center":40,
 "Atlantic Terminal":56,"Brooklyn Technical High School":40,"Pratt Institute":30,
 "The Brooklyn Hospital Center":52,"Brooklyn Bridge":84,"Williamsburgh Savings Bank":156,
 "Brooklyn Navy Yard":24,"Home Depot":12,"Whole Foods Market":10,
 "Green-Wood Cemetery":30,"Brooklyn Heights Promenade":18,
 /* --- Queens, the Bronx, the harbour --- */
 "Unisphere":42,"Citi Field":48,"Elmhurst Hospital Center":56,"Mount Sinai Queens":40,
 "Astoria Generating Station":60,"Sunnyside Yard":8,"Yankee Stadium":42,
 "New York Botanical Garden":20,"Statue of Liberty":93,"Ellis Island":30,
 "Hillview / Aqueduct Terminus":18,"Newtown Creek Works":42,"East River Station":70,
 "Hunts Point Market":16,"Holland Tunnel Vent Shaft":48,"Lincoln Tunnel Vent Shaft":48
};

/* ---- everything else, by what it is and where it stands -------------------------- */
const BASE={Tower:180,Landmark:45,Civic:34,Trade:18,Transit:8,Medical:46,
            Lifeline:28,Industry:22,District:26,Park:0,Water:0};
/* the same shop is a different building in Midtown than it is in Windsor Terrace */
function densityFactor(x,y){
  const onManhattan = y>=-352&&y<=1740;
  if(!onManhattan) return 0.6;
  if(y<-186) return 1.5;                       /* the Financial District */
  if(y<112)  return 0.85;                      /* below 14th, low-rise by age */
  if(y<480)  return 1.6;                       /* Midtown */
  if(y<880)  return 1.0;
  return 0.7;
}
function heightOf(m){
  if(H[m.name]!=null) return H[m.name];
  const b=BASE[m.cat]!=null?BASE[m.cat]:18;
  if(b===0) return 0;
  let h=b*densityFactor(m.x,m.y);
  if(m.tier===1) h*=1.25;                      /* the survey listed it first for a reason */
  return Math.round(h);
}
/* a floor is about three and a half metres, and has been since the lifts arrived */
const floorsOf=h=>h<=0?0:Math.max(1,Math.round(h/3.6));
const named=name=>H[name]!=null;

NYC.heights={H,BASE,heightOf,floorsOf,named,densityFactor};
})();
