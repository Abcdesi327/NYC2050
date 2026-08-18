/* ===================================================================================
   NYC 2050 — SURVEY DATA
   All coordinates are in GRID SPACE, the survey's working frame:
     x  ... cross-island, 5th Avenue = 0, east positive. 1 unit ~ 33 ft.
     y  ... along-island, Houston St = 0, north positive. 1 street = 8 units.
   map.js projects grid space to screen space (the Manhattan grid runs 29 deg
   east of north, so the whole frame is rotated on draw).
   =================================================================================== */
(function(){
"use strict";
const NYC = window.NYC = window.NYC || {};

/* ---- shorelines: [y, x] sampled south to north ------------------------------------ */
const WEST=[[-352,10],[-330,-30],[-300,-52],[-260,-66],[-210,-80],[-160,-95],[-110,-114],
  [-60,-130],[0,-146],[112,-158],[272,-168],[472,-172],[752,-168],[1000,-160],[1240,-150],
  [1440,-140],[1600,-125],[1690,-104],[1740,-80]];
const EAST=[[-352,10],[-330,48],[-300,72],[-260,92],[-210,112],[-160,132],[-110,152],
  [-60,186],[0,210],[112,222],[272,210],[472,175],[752,136],[1000,110],[1240,60],
  [1440,20],[1600,-22],[1690,-56],[1740,-80]];

function shore(tbl,y){
  if(y<=tbl[0][0])return tbl[0][1];
  if(y>=tbl[tbl.length-1][0])return tbl[tbl.length-1][1];
  for(let i=1;i<tbl.length;i++){
    if(y<=tbl[i][0]){const a=tbl[i-1],b=tbl[i];
      return b[1]+(a[1]-b[1])*(b[0]-y)/(b[0]-a[0]);}
  }
  return 0;
}
const WX=y=>shore(WEST,y), EX=y=>shore(EAST,y);

/* ---- habitability bands (grid y) --------------------------------------------------- */
const BANDS=[[-352,-190,"#8F2222","INUNDATED"],[-190,112,"#C4472A","CRITICAL"],
  [112,472,"#E08A24","SEVERE"],[472,1240,"#F2C572","DEGRADED"],[1240,1740,"#E8E3C8","MARGINAL"]];

/* ---- avenues: [label, x, yStart, yEnd, tier] --------------------------------------- */
const AVES=[
 ["12 Av",-168,130,500,3],["11 Av",-144,110,470,3],["West End",-144,472,880,3],
 ["10 Av",-120,110,470,3],["Amsterdam",-120,472,1400,2],
 ["9 Av",-96,100,470,3],["Columbus",-96,472,880,2],
 ["8 Av",-72,96,472,2],["Central Pk W",-72,472,880,2],["Fred Douglass",-72,880,1240,3],
 ["7 Av",-48,0,472,2],["A C Powell",-48,880,1240,3],
 ["6 Av",-24,-40,472,2],["Malcolm X",-24,880,1240,3],
 ["5 Av",0,64,1140,1],
 ["Madison",14,184,1104,3],["Park",28,120,1056,2],["Lexington",42,168,1040,3],
 ["3 Av",60,-40,1040,2],["2 Av",84,0,1040,3],["1 Av",108,0,1020,3],
 ["Av A",132,0,112,3],["Av B",156,0,112,3],["Av C",180,0,112,3],["Av D",204,0,112,3],
 /* added on the second sheet — uptown and east-side avenues */
 ["York Av",128,472,744,3],["Sutton Pl",124,400,472,3],
 ["Convent Av",-104,1080,1256,3],["Edgecombe",-88,1128,1320,3],
 ["Fort Washington",-128,1352,1608,3],["Wadsworth",-112,1400,1576,3],
 ["Pleasant Av",104,904,1000,3],["Manhattan Av",-52,824,880,3]
];

/* ---- Broadway: the one street that ignores the grid -------------------------------- */
const BROADWAY=[[10,-352],[-4,-280],[-10,-200],[-15,-120],[-16,-60],[-14,0],[-8,64],
  [0,184],[-24,272],[-48,360],[-72,472],[-96,600],[-112,720],[-120,880],[-135,1080],
  [-150,1240],[-145,1440],[-130,1600],[-105,1720]];

/* ---- crosstown streets carried at name, not number: [street no, label, tier] ------- */
const CROSSTOWN=[
 [14,"14 St",2],[23,"23 St",2],[34,"34 St",1],[42,"42 St",1],[57,"57 St",2],
 [59,"Central Park S",2],[72,"72 St",2],[79,"79 St",3],[86,"86 St",2],[96,"96 St",3],
 [110,"Cathedral Pkwy",2],[116,"116 St",3],[125,"M L King Jr Blvd",1],[135,"135 St",3],
 [145,"145 St",2],[155,"155 St",3],[181,"181 St",2],[207,"Dyckman St",3]
];

/* ---- named thoroughfares: [label, [[x,y]...], tier, kind, borough] ------------------
   kind: ave | st | pkwy | hwy | walk  — drawn with different weight and casing.      */
const THRU=[
 /* --- Manhattan, below Houston: the pre-grid streets ---------------------------- */
 ["Houston St",[[-146,0],[-60,-2],[20,-4],[120,-5],[210,-6]],1,"st","MN"],
 ["Canal St",[[-116,-112],[-60,-106],[-4,-101],[60,-96],[152,-92]],1,"st","MN"],
 ["Chambers St",[[-88,-196],[-30,-192],[20,-190],[104,-186]],2,"st","MN"],
 ["Fulton St",[[-62,-258],[-14,-256],[40,-252],[88,-250]],2,"st","MN"],
 ["Wall St",[[-30,-302],[10,-300],[48,-297],[76,-296]],2,"st","MN"],
 ["Delancey St",[[-6,-58],[60,-52],[130,-46],[176,-42]],2,"st","MN"],
 ["Grand St",[[-52,-70],[10,-64],[80,-58],[150,-52]],3,"st","MN"],
 ["Bleecker St",[[-96,26],[-40,20],[10,14],[50,8]],3,"st","MN"],
 ["Bowery",[[52,-104],[50,-70],[48,-30],[46,10],[44,44]],2,"ave","MN"],
 ["W Broadway",[[-62,-190],[-56,-130],[-50,-70],[-44,-20]],3,"st","MN"],
 ["Park Row",[[8,-198],[40,-176],[58,-150],[62,-120]],3,"st","MN"],
 ["Lafayette St",[[8,-192],[13,-140],[18,-88],[24,-38],[30,4]],3,"st","MN"],
 ["Church St",[[-32,-250],[-28,-190],[-24,-130],[-21,-78]],3,"st","MN"],
 ["Varick St",[[-50,-124],[-55,-74],[-60,-24],[-64,18]],3,"st","MN"],
 ["Hudson St",[[-74,-104],[-80,-44],[-86,16],[-92,68]],3,"st","MN"],
 ["Greenwich St",[[-84,-262],[-92,-192],[-100,-112],[-108,-32]],3,"st","MN"],
 ["Water St",[[44,-332],[68,-302],[90,-272],[110,-242]],3,"st","MN"],
 ["Pearl St",[[28,-336],[50,-308],[72,-278],[90,-248]],3,"st","MN"],
 ["South St",[[62,-340],[88,-306],[110,-274],[128,-244]],3,"st","MN"],
 ["Allen St",[[86,-96],[88,-58],[90,-20],[92,10]],3,"st","MN"],
 ["Orchard St",[[96,-92],[98,-54],[100,-16]],3,"st","MN"],
 ["Essex St",[[106,-90],[108,-52],[110,-14]],3,"st","MN"],
 ["Rivington St",[[52,-32],[104,-27],[152,-22]],3,"st","MN"],
 ["Prince St",[[-70,-20],[-20,-16],[30,-13]],3,"st","MN"],
 ["Spring St",[[-86,-42],[-30,-38],[26,-34]],3,"st","MN"],
 ["Worth St",[[-70,-176],[-24,-172],[24,-168]],3,"st","MN"],
 ["Maiden Ln",[[-6,-278],[36,-274],[72,-270]],3,"st","MN"],
 ["Christopher St",[[-118,52],[-90,48],[-62,44]],3,"st","MN"],
 ["St Marks Pl",[[36,74],[70,78],[104,82]],3,"st","MN"],
 /* --- Manhattan, the water's-edge roads and the uptown diagonals ----------------- */
 ["FDR Dr",[[118,-200],[168,-120],[206,-30],[222,90],[214,240],[186,440],[146,720],
   [126,880],[108,1000]],2,"hwy","MN"],
 ["West St",[[-70,-260],[-92,-190],[-116,-110],[-140,-20],[-152,96]],2,"hwy","MN"],
 ["Henry Hudson Pkwy",[[-156,120],[-164,260],[-170,420],[-173,600],[-172,780],
   [-163,1000],[-154,1240],[-146,1440],[-138,1600]],2,"hwy","MN"],
 ["Riverside Dr",[[-160,592],[-158,760],[-152,1000],[-144,1240],[-138,1400]],2,"ave","MN"],
 ["St Nicholas Av",[[-30,872],[-48,962],[-64,1060],[-78,1160],[-92,1268],[-104,1358]],
   2,"ave","MN"],
 ["Harlem River Dr",[[104,1000],[86,1122],[66,1240],[38,1362],[14,1452]],3,"hwy","MN"],
 ["The High Line",[[-128,96],[-136,152],[-142,208],[-146,258]],3,"walk","MN"],
 /* --- Brooklyn ------------------------------------------------------------------- */
 ["Flatbush Av",[[188,-190],[206,-178],[222,-170],[234,-172],[246,-198],[258,-236],
   [286,-248],[310,-266],[318,-300],[326,-344]],1,"ave","BK"],
 ["Atlantic Av",[[196,-196],[216,-182],[234,-172],[268,-164],[312,-156],[364,-148],
   [420,-140],[470,-134]],1,"ave","BK"],
 ["Fulton St",[[208,-172],[238,-152],[278,-142],[326,-134],[380,-126],[428,-120]],
   2,"st","BK"],
 ["4 Av",[[230,-176],[220,-214],[212,-256],[206,-300],[200,-344],[196,-386]],2,"ave","BK"],
 ["Eastern Pkwy",[[262,-242],[292,-234],[330,-226],[376,-218],[420,-210],[462,-204]],
   1,"pkwy","BK"],
 ["Ocean Pkwy",[[276,-304],[268,-346],[261,-388],[255,-418]],2,"pkwy","BK"],
 ["Prospect Park W",[[259,-246],[263,-272],[267,-296]],3,"ave","BK"],
 ["Bedford Av",[[268,-30],[257,-78],[262,-124],[280,-168],[300,-208],[316,-250],
   [326,-300],[332,-350]],2,"ave","BK"],
 ["Kent Av",[[240,-44],[229,-88],[219,-124]],3,"ave","BK"],
 ["Myrtle Av",[[264,-96],[292,-104],[330,-112],[380,-120],[430,-128]],2,"ave","BK"],
 ["Bushwick Av",[[268,-70],[292,-100],[316,-134],[336,-170]],3,"ave","BK"],
 ["Brooklyn–Queens Expwy",[[214,-208],[240,-150],[262,-92],[276,-30],[268,40],
   [254,120],[248,220],[252,300]],2,"hwy","BK"],
 /* --- Queens --------------------------------------------------------------------- */
 ["Queens Blvd",[[268,286],[300,272],[344,258],[396,244],[448,232],[496,222]],1,"ave","QN"],
 ["Northern Blvd",[[282,396],[330,392],[386,388],[440,384],[492,380]],1,"ave","QN"],
 ["Roosevelt Av",[[300,330],[352,322],[408,314],[462,306],[510,300]],2,"ave","QN"],
 ["Astoria Blvd",[[288,436],[330,442],[380,450],[430,458]],2,"ave","QN"],
 ["Vernon Blvd",[[254,300],[266,364],[278,420],[288,470]],3,"ave","QN"],
 ["Jackson Av",[[250,318],[268,300],[286,286]],3,"ave","QN"],
 ["Grand Central Pkwy",[[300,472],[356,462],[420,432],[470,382],[500,322],[520,262]],
   2,"pkwy","QN"],
 /* --- The Bronx ------------------------------------------------------------------ */
 ["Grand Concourse",[[246,1080],[250,1162],[252,1250],[248,1340],[240,1430]],1,"ave","BX"],
 ["Fordham Rd",[[196,1300],[248,1306],[306,1312],[364,1318],[414,1322]],2,"st","BX"],
 ["Bruckner Blvd",[[268,1062],[330,1080],[392,1098],[452,1114],[506,1128]],2,"hwy","BX"],
 ["Southern Blvd",[[300,1120],[312,1200],[322,1280],[330,1360]],3,"ave","BX"]
];

/* ---- landmasses (grid space) ------------------------------------------------------ */
const NJ=[[-190,-420],[-215,-260],[-235,-100],[-252,60],[-262,240],[-268,460],[-262,700],
  [-250,980],[-236,1240],[-224,1500],[-214,1800],[-560,1800],[-560,-420]];
const BKQN=[[130,-420],[168,-330],[196,-262],[214,-206],[236,-160],[252,-120],[266,-70],
  [278,-16],[292,60],[300,150],[292,250],[276,340],[262,430],[252,520],[262,600],[300,660],
  [420,700],[620,700],[620,-420]];
const BRONX=[[236,1060],[210,1160],[176,1240],[140,1320],[120,1420],[300,1520],[620,1520],
  [620,900],[380,900],[300,980]];
const ROOSEVELT=[[196,352],[206,400],[212,470],[214,530],[204,560],[196,530],[192,466],[190,400]];
const CPARK=[[-72,472],[0,472],[0,880],[-72,880]];
const RANDALLS=[[210,1000],[268,1010],[280,1080],[224,1078]];
/* harbour islands — added to the sheet when the survey crossed the Upper Bay */
const LIBERTY=[[-132,-484],[-108,-480],[-104,-462],[-126,-458]];
const ELLIS=[[-146,-436],[-120,-432],[-118,-416],[-144,-419]];
const GOVERNORS=[[46,-436],[92,-430],[98,-402],[52,-400]];

/* ---- severed crossings: [x1,y1,x2,y2,label] --------------------------------------- */
const CROSS=[
 [-146,-24,-232,-16,"Holland Tunnel"],[-160,236,-244,244,"Lincoln Tunnel"],
 [-142,1432,-220,1444,"George Washington Br"],
 [116,-206,180,-232,"Brooklyn Bridge"],[128,-176,196,-196,"Manhattan Bridge"],
 [150,-118,214,-130,"Williamsburg Bridge"],[196,72,262,64,"Queens–Midtown Tunnel"],
 [178,296,266,286,"Queensboro Bridge"],[124,1150,214,1140,"Harlem River spans"]
];

/* ---- survey coverage: the sheet's documented y-ranges; the rest is hatched -------- */
const GAPS=[[200,250],[1080,1740]];

/* ---- landmarks: [name, x, y, category, disposition, tier, note] ------------------ */
const D=[
/* --- Financial District / Battery : INUNDATED --- */
["The Battery",4,-346,"Park","FLOODED",2,"Landfill over the original shoreline. Nothing here is above the waterline at high tide."],
["National Museum of the American Indian",2,-336,"Civic","FLOODED",2,"The Custom House rotunda holds water year-round. Upper galleries were emptied early."],
["Cunard Building",6,-326,"Landmark","SALVAGE",3,""],
["One New York Plaza",26,-336,"Tower","FLOODED",3,""],
["Robert F. Wagner Jr. Park",-24,-324,"Park","FLOODED",3,""],
["The Dead Rabbit",54,-314,"Trade","FLOODED",3,""],
["New York Stock Exchange",14,-301,"Landmark","SEALED",1,"Trading floor sits below the current mean tide. Sealed at the Broad Street doors."],
["120 Wall Street",74,-298,"Tower","FLOODED",3,""],
["Battery Park City",-52,-292,"District","FLOODED",2,"Entirely fill. The first ground the survey wrote off."],
["Metropolitan College",-40,-292,"Civic","FLOODED",3,""],
["Financial District",26,-284,"District","FLOODED",1,"Below Chambers the streets are channels. Movement here is by boat at all tides."],
["The Cloud One Hotel",-26,-272,"Trade","SALVAGE",3,""],
["South Street Seaport",84,-268,"District","FLOODED",2,""],
["IPIC Theaters",70,-263,"Trade","FLOODED",3,""],
["St Paul's Chapel",-10,-262,"Landmark","STANDING",2,"Highest dry ground below Chambers. Survey party used the churchyard as a landing."],
["Mercer Labs",-18,-258,"Civic","FLOODED",3,""],
["9/11 Memorial & Museum",-46,-250,"Landmark","FLOODED",2,"The reflecting pools no longer drain. They are simply part of the harbor now."],
["One World Trade Center",-58,-244,"Tower","SEALED",1,"Structurally sound above the podium. No water, no lift, no way up past floor six."],
["Nobu Downtown",-12,-238,"Trade","FLOODED",3,""],
["Leon's Bagels",4,-240,"Trade","FLOODED",3,""],
["NY-Presbyterian Lower Manhattan",30,-216,"Medical","SEALED",2,"Stripped of everything portable in the first year. Generators gone."],
["Alfred E. Smith Playground",68,-214,"Park","FLOODED",3,""],
/* --- Civic Center / Tribeca / Chinatown : CRITICAL --- */
["New York City Hall",0,-201,"Civic","STANDING",1,"On the ridge. Dry, intact, and the highest-value shelter below Canal Street."],
["Target",-70,-200,"Trade","SALVAGE",3,""],
["Pace University",24,-198,"Civic","SALVAGE",3,""],
["Brooklyn Bridge–City Hall",18,-192,"Transit","FLOODED",2,"Platform level is permanently submerged. The 4, 5, 6 tubes flooded from here south."],
["The Sun Building",-15,-190,"Landmark","STANDING",3,""],
["Surrogate's Court",5,-186,"Civic","STANDING",3,""],
["The Django",-32,-185,"Trade","SEALED",3,""],
["Gibney Dance",-2,-180,"Civic","SALVAGE",3,""],
["Tribeca",-56,-176,"District","SALVAGE",1,"Cast-iron lofts on made ground. Ground floors wet, upper floors picked over."],
["Scalini Fedeli",-62,-173,"Trade","SALVAGE",3,""],
["James Madison Plaza",44,-171,"Park","STANDING",3,""],
["Thurgood Marshall Courthouse",18,-169,"Civic","SEALED",2,"Granite, elevated, defensible. Marked as a fallback shelter on the second sheet."],
["Federal Bureau of Investigation",-8,-163,"Civic","SEALED",3,""],
["Thomas Paine Park",-4,-172,"Park","STANDING",3,""],
["Bar Oliver",62,-166,"Trade","COLLAPSED",3,""],
["Franklin St",-45,-161,"Transit","FLOODED",3,""],
["Playground One",52,-158,"Park","STANDING",3,""],
["Buddha Bodai",42,-141,"Trade","STANDING",3,""],
["Paros Tribeca",-40,-140,"Trade","SALVAGE",3,""],
["Todd Snyder",-38,-129,"Trade","SALVAGE",3,""],
["Joe's Shanghai",48,-126,"Trade","STANDING",3,""],
["Mei Lai Wah Bakery",46,-119,"Trade","OCCUPIED",3,"Coal-fired ovens still functional. One of four working bakeries logged on the island."],
["Chinatown",46,-118,"District","OCCUPIED",1,"Highest ground below Houston and the last part of Lower Manhattan with a standing population."],
["Battery Dance",-15,-116,"Civic","SALVAGE",3,""],
["Soho Grand Hotel",-52,-113,"Trade","SEALED",3,""],
["Jing Fong Restaurant",28,-109,"Trade","STANDING",3,""],
["Bowery Savings Bank",58,-106,"Landmark","SEALED",3,""],
["Canal St",10,-104,"Transit","FLOODED",1,"The name is literal again. Canal is the tideline on all but the driest weeks."],
["Origins NYC",-8,-101,"Trade","SALVAGE",3,""],
["McDonald's",6,-100,"Trade","SALVAGE",3,""],
["Quest Diagnostics",5,-99,"Medical","SALVAGE",3,""],
["Chinatown Street Market",24,-96,"Trade","OCCUPIED",2,"Reconstituted. The only regular exchange point logged south of Houston."],
["Duane Reade",8,-95,"Medical","SALVAGE",3,"Pharmacy stripped in week two. Listed for the shelving, not the stock."],
["401 Broadway",-8,-93,"Tower","SEALED",3,""],
["Telfar",-4,-88,"Trade","SALVAGE",3,""],
["La Mercerie",-14,-79,"Trade","SALVAGE",3,""],
["Macao Trading Co",-58,-78,"Trade","COLLAPSED",3,""],
["Mixue",-16,-71,"Trade","SALVAGE",3,""],
["Walgreens",-12,-63,"Medical","SALVAGE",2,"Cross-referenced against the Duane Reade at Canal. Both empty."],
["Catbird",-2,-53,"Trade","SALVAGE",3,""],
["Steve Madden",-12,-49,"Trade","SALVAGE",3,""],
["Mod Ref",-5,-50,"Trade","SALVAGE",3,""],
["Dolce Vita",-8,-51,"Trade","SALVAGE",3,""],
["Eataly",2,-46,"Trade","SALVAGE",3,""],
["Black Tap",-46,-48,"Trade","SEALED",3,""],
["SoHo",-30,-44,"District","SALVAGE",1,"Cast-iron frames outlast their floors. Several buildings are facade and nothing behind it."],
["Little Italy",25,-57,"District","OCCUPIED",2,""],
["maman",0,-41,"Trade","SALVAGE",3,""],
["Live by the Sword Tattoo",-16,-42,"Trade","SEALED",3,""],
["Nolita",16,-32,"District","OCCUPIED",2,""],
["Levi's",-30,-33,"Trade","SALVAGE",3,""],
["2nd Street",-8,-31,"Trade","SALVAGE",3,""],
["Museum of Ice Cream",-22,-28,"Civic","COLLAPSED",3,""],
["Caffe Paradiso",25,-26,"Trade","OCCUPIED",3,""],
["Trader Joe's",-58,-25,"Trade","SALVAGE",2,"Emptied inside eleven days. The loading dock is still the neighborhood's dry entrance."],
["Brandy Melville",-26,-24,"Trade","SALVAGE",3,""],
["Blank Street",-14,-26,"Trade","SALVAGE",3,""],
["Uniqlo",-20,-22,"Trade","SALVAGE",3,"Textile recovery site. Priority listing — clothing, not food."],
["New York or Nowhere",-10,-20,"Trade","SALVAGE",3,""],
["Madhappy",-8,-18,"Trade","SALVAGE",3,""],
["Leon's Bagels SoHo",-2,-16,"Trade","SALVAGE",3,""],
["NYU Lafayette Hall",-2,-14,"Civic","SEALED",3,""],
["Gay Activists Alliance Firehouse",-32,-8,"Landmark","STANDING",3,""],
["Houston Hall",-78,8,"Trade","SEALED",3,""],
["Broadway–Lafayette St",0,-6,"Transit","FLOODED",2,""],
["NoHo",8,7,"District","SALVAGE",2,""],
["Mimi's",-52,-8,"Trade","SEALED",3,""],
/* --- Village / East Village --- */
["W 4 St–Wash Sq",-52,26,"Transit","FLOODED",2,"Four levels of platform. The lower mezzanine took water in the first winter."],
["Comedy Cellar",-48,25,"Trade","FLOODED",3,"Basement room. Below the water table now."],
["Washington Square Arch",-38,32,"Landmark","STANDING",1,"Intact. The park is under cultivation — the largest worked soil below 59th Street."],
["New York University",-24,32,"Civic","SEALED",2,"Campus buildings sealed floor by floor. Library holdings moved north."],
["The Commerce Inn",-90,30,"Trade","STANDING",3,""],
["L'industrie Pizzeria",-88,40,"Trade","OCCUPIED",3,""],
["West Village",-95,52,"District","OCCUPIED",2,"Low-rise, walkable, above the tideline. The most viable residential fabric below 14th."],
["Greenwich Village",-62,52,"District","OCCUPIED",1,""],
["8 St–NYU",8,64,"Transit","FLOODED",3,""],
["Astor Pl",32,68,"Transit","FLOODED",3,""],
["Cooper Square",42,62,"Civic","STANDING",3,""],
["McSorley's Old Ale House",52,58,"Trade","OCCUPIED",3,"Sawdust floor, no electricity required, never had any. Still serving."],
["Jefferson Market Library",-58,76,"Civic","STANDING",3,""],
["Ippudo",28,82,"Trade","SEALED",3,""],
["Webster Hall",48,90,"Civic","SEALED",3,""],
["North Coast University",0,96,"Civic","SEALED",3,""],
["East Village",92,60,"District","OCCUPIED",1,"Tenement stock, five floors, walk-up by design. Functions without power."],
["Forbidden Planet",6,104,"Trade","SALVAGE",3,""],
["Palladium",44,110,"Civic","COLLAPSED",3,""],
["Union Square",14,113,"Park","OCCUPIED",1,"Market ground again. The greenmarket outlasted the grid that killed the city around it."],
["14 St–Union Sq",22,112,"Transit","FLOODED",1,"Deep station, four lines. Pump failure here took the whole Lexington trunk."],
["Sephora",16,117,"Trade","SALVAGE",3,""],
["Xavier High School",-52,126,"Civic","SEALED",3,""],
["14 St",-26,112,"Transit","FLOODED",3,""],
["Stuyvesant Square",68,124,"Park","OCCUPIED",3,""],
/* --- Flatiron / Gramercy --- */
["Barnes & Noble",2,137,"Trade","SALVAGE",3,"Paper recovery. Listed under fuel, not literature."],
["Gramercy Park",34,160,"Park","OCCUPIED",2,"Still locked. The keys turned out to mean something after all."],
["Flatiron",-2,177,"District","SEALED",2,""],
["Bathhouse Flatiron",-14,178,"Trade","FLOODED",3,""],
["Flatiron Building",2,184,"Landmark","STANDING",1,"Narrow floor plate, masonry bearing walls, twenty-two storeys of nothing usable above six."],
["Shake Shack",14,190,"Trade","SALVAGE",3,""],
["Museum of Sex",6,216,"Civic","SEALED",3,""],
["Rose Hill",30,216,"District","SEALED",3,""],
/* --- Midtown : SEVERE --- */
["Penn Station",-50,264,"Transit","FLOODED",1,"North River tunnels flooded from the Jersey side. The station is the sump they drain into."],
["Empire State Building",2,272,"Tower","SEALED",1,"Eighty-six floors of dry, unreachable space. Survey used the mast as a sightline, nothing more."],
["Macy's",-24,272,"Trade","SALVAGE",2,""],
["Morgan Library",14,288,"Civic","SEALED",3,"Collection intact behind bronze. Flagged for recovery, not yet attempted."],
["Joe's Pizza",-44,320,"Trade","SALVAGE",3,""],
["Bryant Park",-18,328,"Park","OCCUPIED",2,"Under cultivation. The reservoir it was built on is being reopened by hand."],
["New York Public Library",2,328,"Civic","SEALED",1,"Stacks are dry. The building is the single highest recovery priority above 14th Street."],
["Summit One Vanderbilt",22,340,"Tower","SEALED",3,""],
["Grand Central Terminal",28,336,"Transit","FLOODED",1,"Lower loops took water within a week of the pumps stopping. Concourse remains dry."],
["42 St–Port Authority",-72,336,"Transit","FLOODED",2,""],
["Los Tacos No. 1",-60,344,"Trade","SALVAGE",3,""],
["Tony's Di Napoli",-52,348,"Trade","SEALED",3,""],
["Times Square",-48,360,"Landmark","STANDING",1,"Dark. The survey notes it is quieter than any other point logged on the island."],
["Becco",-84,368,"Trade","SEALED",3,""],
["Rockefeller Center",-12,392,"Landmark","SEALED",1,"Steam plant ruptured under the plaza. The concourse is unenterable — heat, then collapse."],
["47–50 Sts / Rockefeller Ctr",-16,388,"Transit","FLOODED",3,""],
["M&M'S",-30,384,"Trade","SALVAGE",3,""],
["49 St",-44,392,"Transit","FLOODED",3,""],
["50 St",-70,400,"Transit","FLOODED",3,""],
["St. Patrick's Cathedral",4,408,"Landmark","STANDING",1,"Stone, unpowered by design, and the largest intact interior volume in Midtown."],
["5 Av–53 St",0,424,"Transit","FLOODED",3,""],
["Museum of Modern Art",-12,424,"Civic","SEALED",2,"Climate control failed in the first week. Contents presumed lost to damp."],
["Hotel Riu",-56,432,"Trade","SEALED",3,""],
["SPYSCAPE",-70,440,"Civic","SALVAGE",3,""],
["Din Tai Fung",-62,448,"Trade","SEALED",3,""],
["Trump Tower",4,448,"Tower","SEALED",3,""],
["Nike",-4,456,"Trade","SALVAGE",3,""],
["Carnegie Hall",-48,456,"Landmark","STANDING",2,"Acoustically intact and structurally sound. Used as an assembly hall."],
["Blank Street Midtown",-40,440,"Trade","SALVAGE",3,""],
["7-Eleven",-70,452,"Trade","SALVAGE",3,""],
["57 St–7 Av",-48,456,"Transit","FLOODED",3,""],
["Hell's Kitchen",-95,380,"District","OCCUPIED",2,"Tenement scale again. Low buildings, shallow basements, walkable to the Hudson."],
["Planet Fitness",-92,440,"Trade","SALVAGE",3,""],
/* --- Columbus Circle / Lincoln Center : DEGRADED --- */
["59 St–Columbus Circle",-72,472,"Transit","FLOODED",1,"Junction of four trunk lines. Flooded from the Broadway tube in under a fortnight."],
["Mount Sinai West",-118,474,"Medical","SEALED",2,"Last hospital south of 110th to hold a working theatre. Closed when the oxygen ran out."],
["Fordham University",-95,496,"Civic","SEALED",3,""],
["Lincoln Center",-104,512,"Landmark","STANDING",1,"Travertine plaza above street grade, dry throughout. Designated northern muster point."],
["Metropolitan Opera",-108,510,"Landmark","SEALED",3,""],
["66 St–Lincoln Center",-96,512,"Transit","FLOODED",3,""],
["Dairy Visitor Center",-40,520,"Park","STANDING",3,""],
["Central Park",-36,676,"Park","OCCUPIED",1,"Eight hundred and forty acres of soil, standing water, and the only fuel wood on the island."],
/* --- unsurveyed anchors --- */
["Harlem",-16,1004,"District","UNSURVEYED",2,"Beyond the survey line. High ground, mainland-adjacent, presumed populated."],
["Washington Heights",-100,1440,"District","UNSURVEYED",1,"Schist at the surface, real elevation, short spans to the mainland. The likely remnant settlement."],
["Inwood",-108,1660,"District","UNSURVEYED",2,""],
/* --- Brooklyn --- */
["Brooklyn Navy Yard",290,-58,"Industry","OCCUPIED",1,"Walled yard, dry docks, machine shops, and its own generation. The strongest asset in the region."],
["Navy Yard Basin",278,-38,"Water","OCCUPIED",3,""],
["Wegmans Food Markets",270,-70,"Trade","OCCUPIED",2,"Distribution point. Supplied overland from Long Island, not from the island."],
["Pratt Institute",300,-104,"Civic","OCCUPIED",3,"Foundries and kilns intact. Metalwork and ceramics run out of the campus shops."],
["Commodore Barry Park",255,-86,"Park","OCCUPIED",3,""],
["Gotham Health, Cumberland",262,-105,"Medical","OCCUPIED",2,""],
["Fort Greene Park",248,-120,"Park","OCCUPIED",1,"High ground with a working well. The settlement's centre of gravity."],
["The Brooklyn Hospital Center",228,-126,"Medical","OCCUPIED",1,"The nearest functioning hospital to Manhattan. Everything from the island comes here."],
["Brooklyn Technical High School",245,-141,"Civic","OCCUPIED",2,""],
["Lafayette Av",262,-168,"Transit","STANDING",3,""],
["Fulton St",250,-158,"Transit","STANDING",3,""],
["Clinton–Washington Avs",285,-140,"Transit","STANDING",3,""],
["Atlantic Terminal",232,-165,"Transit","OCCUPIED",1,"The mainland connection. Rail east to Long Island is the region's supply artery."],
["Atlantic Av–Barclays Ctr",225,-173,"Transit","OCCUPIED",2,""],
["Nevins St",210,-160,"Transit","STANDING",3,""],
["Prospect Heights",290,-180,"District","OCCUPIED",2,""],
["Union St",222,-215,"Transit","STANDING",3,""],
["Gowanus",200,-236,"District","FLOODED",1,"A Superfund canal in a bowl below the Slope. Every outfall in the district drains to it."],
["Whole Foods Market",195,-250,"Trade","SALVAGE",3,""],
["Home Depot",185,-300,"Trade","OCCUPIED",2,"Timber and hardware. Rationed and guarded."],
["4 Av–9 St",205,-262,"Transit","STANDING",3,""],
["9 St",212,-267,"Transit","STANDING",3,""],
["Park Slope",240,-262,"District","OCCUPIED",1,"Brownstone rows on the ridge, above the canal and below the park. Intact and inhabited."],
["7 Av",255,-250,"Transit","STANDING",3,""],
["EV Charging Station",250,-286,"Industry","SEALED",3,""],
["South Slope",232,-300,"District","OCCUPIED",2,""],
["Prospect Ave",215,-306,"Transit","STANDING",3,""],
["Windsor Terrace",258,-312,"District","OCCUPIED",3,""],
["Prospect Park",282,-272,"Park","OCCUPIED",1,"Five hundred acres, a working lake, and the region's principal cultivated ground."],
["25 St",205,-330,"Transit","STANDING",3,""],
["Green-Wood Cemetery",225,-346,"Park","OCCUPIED",2,"Highest point in Brooklyn. Signal station and lookout."],
/* --- Queens --- */
["Long Island City",250,340,"District","OCCUPIED",2,""],
["Hoyt Playground",270,426,"Park","OCCUPIED",3,""],
["Astoria Blvd",300,430,"Transit","OCCUPIED",3,""],
["Astoria",305,456,"District","OCCUPIED",1,"Adjacent to the generating complex. The most reliably powered ground in the five boroughs."],
["Steinway St",320,460,"Transit","OCCUPIED",3,""],
["Blend Astoria",312,470,"Trade","OCCUPIED",3,""],
["Mount Sinai Queens",330,406,"Medical","OCCUPIED",2,""],
["Planet Fitness Astoria",340,490,"Trade","SALVAGE",3,""],
/* --- infrastructure lifelines --- */
["Hillview / Aqueduct Terminus",180,1560,"Lifeline","SEALED",1,"Nine-tenths of the city's water arrived here by gravity. No local substitute exists."],
["Hunts Point Market",320,1080,"Lifeline","OCCUPIED",1,"Produce, meat and fish for the whole region. The reason the outer boroughs held."],
["Astoria Generating Station",286,520,"Lifeline","OCCUPIED",1,"Largest concentration of generation in the city. Running on barged fuel."],
["East River Station",180,300,"Lifeline","SEALED",1,"Waterfront siting put it inside the surge zone. Steam loop under Midtown ruptured from here."],
["Newtown Creek Works",268,180,"Lifeline","SEALED",1,"The largest wastewater plant in the city. When it stopped, the outfalls became inflows."],
["Holland Tunnel Vent Shaft",-140,-30,"Lifeline","FLOODED",2,"The shafts failed before the tubes did. Ventilation loss sealed the crossing, not water."],
["Lincoln Tunnel Vent Shaft",-160,232,"Lifeline","FLOODED",2,""],
/* --- New Jersey --- */
["Hoboken",-232,60,"District","OCCUPIED",2,""],
["Jersey City",-248,-140,"District","OCCUPIED",2,""]
,
/* ================== SECOND SHEET: additions north of the old survey line ==========
   The survey line was moved from 66 St to 135 St in the second season. Everything
   below is new ground, plus the harbour islands and the outer-borough anchors. ==== */
/* --- Upper West Side --- */
["American Museum of Natural History",-84,632,"Civic","SEALED",1,"Four city blocks of collection under one roof. Sealed at every door; the survey did not attempt entry."],
["Beresford Apartments",-76,648,"Landmark","SALVAGE",3,""],
["79 St Rotunda",-166,632,"Transit","FLOODED",3,""],
["The Dakota",-74,576,"Landmark","OCCUPIED",2,"Courtyard building, one gate, its own well. Held continuously since the second winter."],
["72 St",-70,576,"Transit","FLOODED",3,""],
["Beacon Theatre",-104,592,"Civic","SEALED",3,""],
["Zabar's",-118,632,"Trade","SALVAGE",3,""],
["Cathedral of St John the Divine",-116,896,"Landmark","OCCUPIED",1,"Unfinished for a century and a half and still the largest roofed room north of 42nd. Now a granary."],
["Columbia University",-134,928,"Civic","OCCUPIED",1,"Walled campus on the Morningside ridge. Library, workshops, and the only working press logged."],
["Grant's Tomb",-156,976,"Landmark","STANDING",2,"Granite drum, no contents worth taking. Used as a river lookout."],
["Riverside Church",-152,968,"Landmark","STANDING",2,"Carillon tower intact. The bells are rung at dusk and carry to Harlem."],
["Morningside Park",-92,904,"Park","OCCUPIED",3,""],
/* --- Museum Mile / Upper East Side --- */
["Solomon R. Guggenheim Museum",-8,712,"Landmark","SEALED",1,"The ramp is a single continuous floor with no landings — nothing to seal but the door, so the door was sealed. Skylight cracked; the spiral takes rain."],
["Metropolitan Museum of Art",-18,656,"Civic","SEALED",1,"Largest holding on the island. Roof failures logged over the European wing; the rest is dry and unentered."],
["Museum Mile",-6,720,"District","SEALED",2,"Nine institutions in twenty-three blocks, every one shut on the same week. The survey walked it end to end in an afternoon."],
["Neue Galerie",-6,700,"Civic","SEALED",3,""],
["Cooper Hewitt",-6,728,"Civic","SEALED",3,""],
["Jewish Museum",-6,736,"Civic","SEALED",3,""],
["Museum of the City of New York",-4,808,"Civic","SALVAGE",2,"Records recovered. The city's own archive is now the survey's reference set."],
["El Museo del Barrio",-4,832,"Civic","SEALED",3,""],
["The Frick Collection",-6,560,"Civic","SEALED",3,""],
["Central Park Reservoir",-36,750,"Water","OCCUPIED",1,"A billion gallons of standing water in the middle of the island. Untreated, and drunk anyway."],
["The Great Lawn",-36,676,"Park","OCCUPIED",2,"Under the plough. Thirteen acres of it, worked by hand from the 85th Street transverse."],
["Belvedere Castle",-40,632,"Landmark","OCCUPIED",2,"Weather station again, as it was built to be. Readings logged twice daily."],
["Mount Sinai Hospital",-8,792,"Medical","OCCUPIED",1,"The furthest north of the island's hospitals and the only one still admitting."],
["86 St",-8,688,"Transit","FLOODED",3,""],
["Carl Schurz Park",112,704,"Park","OCCUPIED",3,""],
["Gracie Mansion",114,712,"Landmark","OCCUPIED",2,"Wood frame, 1799, no services and never needed any. Occupied, though not by the city."],
/* --- Harlem --- */
["Apollo Theater",-62,1000,"Landmark","OCCUPIED",1,"Marquee dark, house intact, stage in nightly use. The survey logged four hundred people inside it."],
["Studio Museum in Harlem",-30,1000,"Civic","SALVAGE",3,""],
["Marcus Garvey Park",-18,960,"Park","OCCUPIED",2,""],
["Harlem Hospital Center",-38,1080,"Medical","OCCUPIED",1,"Running on Hunts Point supply and Harlem River barge fuel. The northern anchor of the medical net."],
["Abyssinian Baptist Church",-46,1016,"Landmark","OCCUPIED",2,""],
["City College of New York",-100,1160,"Civic","OCCUPIED",2,"Neo-Gothic quadrangle on the ridge. Engineering shops running."],
["125 St",-56,1000,"Transit","STANDING",2,"Above ground, above the tideline, and the only station on the island still taking passengers."],
["Hamilton Grange",-90,1112,"Landmark","STANDING",3,""],
/* --- Washington Heights / Inwood --- */
["The Met Cloisters",-140,1608,"Civic","SEALED",1,"Highest and driest institution on the island. Contents intact. The survey recommends it as the archive of record."],
["Fort Tryon Park",-134,1592,"Park","OCCUPIED",2,""],
["NY-Presbyterian Columbia",-124,1352,"Medical","OCCUPIED",1,"The largest working hospital in the five boroughs. Everything north of 96th routes here."],
["Highbridge Water Tower",-72,1352,"Lifeline","STANDING",1,"Gravity tower on the Manhattan side of the old aqueduct. Refilled by hand; it still holds pressure."],
["United Palace",-104,1400,"Landmark","OCCUPIED",3,""],
["Inwood Hill Park",-124,1688,"Park","OCCUPIED",2,"The last old-growth forest on the island. Cut under licence, one stand at a time."],
/* --- Hudson Yards / Chelsea / Meatpacking --- */
["Whitney Museum",-124,100,"Civic","SEALED",2,"Terraces stripped by wind. Galleries dry to the fourth floor, flooded below."],
["The High Line",-140,180,"Park","OCCUPIED",1,"An elevated railway that became a park and is now a road again — the only dry route from Gansevoort to 34th."],
["Chelsea Market",-116,124,"Trade","OCCUPIED",2,"Brick, thick floors, cold cellars. The largest indoor market below 59th Street."],
["Little Island",-152,110,"Park","FLOODED",3,""],
["Hudson Yards",-140,268,"District","SEALED",2,"Built on a rail deck over water. The deck is holding; nothing on it is."],
["Vessel",-138,268,"Landmark","STANDING",3,""],
["Javits Center",-146,236,"Civic","SEALED",2,"Glass envelope, no glass. Used as covered ground for barge cargo."],
["Moynihan Train Hall",-56,264,"Transit","FLOODED",2,""],
/* --- Lower Manhattan additions --- */
["Trinity Church",-8,-282,"Landmark","STANDING",2,"Churchyard is the highest unbuilt ground on Wall Street. Burials have resumed."],
["Woolworth Building",-14,-196,"Landmark","SEALED",2,"Terracotta shedding from the tower. The survey marks a fall zone of sixty feet around the base."],
["Manhattan Municipal Building",12,-196,"Civic","SALVAGE",3,""],
["Fraunces Tavern",30,-330,"Landmark","FLOODED",3,""],
["Tenement Museum",100,-58,"Civic","STANDING",3,"Preserved as a record of how people lived without services. Read differently now."],
["Katz's Delicatessen",92,2,"Trade","OCCUPIED",3,"Smokehouse in the cellar, still curing. Trades by weight, not by coin."],
["New Museum",52,-14,"Civic","SALVAGE",1,"Seven stacked boxes in aluminium mesh. The mesh has peeled from the upper three; the lowest is a warehouse now."],
["Bowery Ballroom",58,-32,"Civic","OCCUPIED",3,""],
["The Strand",-4,98,"Trade","SALVAGE",2,"Eighteen miles of shelving. Listed twice — once for the books, once for the timber."],
["Governors Island",70,-418,"District","OCCUPIED",2,"Ferry-dependent, defensible, and above the surge on the southern hills. Quarantine ground."],
["Statue of Liberty",-118,-470,"Landmark","STANDING",1,"Copper on an iron frame, on a granite fort, on a rock. The torch is dark and the pedestal takes water at spring tide. Otherwise unchanged."],
["Ellis Island",-132,-424,"Civic","FLOODED",2,"Ground floor lost. The registry hall above it is dry and empty."],
/* --- Brooklyn additions --- */
["Grand Army Plaza",258,-240,"Landmark","OCCUPIED",1,"The plaza is the settlement's forum — market on the oval, notices nailed to the arch."],
["Soldiers' and Sailors' Memorial Arch",258,-238,"Landmark","STANDING",1,"Granite arch, bronze quadriga. One horse has come off the attic and lies where it fell in the roadway."],
["Brooklyn Museum",300,-250,"Civic","SEALED",1,"Beaux-Arts block, skylights blown, upper galleries wet. Egyptian holdings moved to the cellar and sealed."],
["Brooklyn Botanic Garden",304,-262,"Park","OCCUPIED",1,"Seed bank. The single most valuable asset logged in the borough."],
["Brooklyn Public Library",290,-244,"Civic","OCCUPIED",2,"Doors open daily. Lending resumed against a deposit of food."],
["Barclays Center",228,-176,"Civic","SALVAGE",2,"Weathering steel over a bowl. Rainwater is collected off the roof and piped to Atlantic Terminal."],
["Brooklyn Heights Promenade",190,-206,"Park","OCCUPIED",2,"Cantilevered over a dead expressway. The best view of a dark island in the region."],
["Brooklyn Bridge",148,-218,"Landmark","STANDING",1,"Towers sound, cables sound, deck breached at the Manhattan approach. Crossed on foot at low wind, one at a time."],
["DUMBO",210,-146,"District","OCCUPIED",2,""],
["Williamsburg",246,-118,"District","OCCUPIED",1,"Bridge-side and mainland-fed. The densest occupied ground in the region."],
["Greenpoint",270,-34,"District","OCCUPIED",2,""],
["Bushwick",316,-136,"District","OCCUPIED",2,""],
["Bedford–Stuyvesant",296,-186,"District","OCCUPIED",1,"Brownstone rows, low, dry, and continuously occupied. No part of it was ever evacuated."],
["Crown Heights",316,-232,"District","OCCUPIED",2,""],
["Coney Island Creek Pumps",236,-410,"Lifeline","SEALED",3,""],
/* --- Queens / Bronx additions --- */
["Unisphere",470,232,"Landmark","STANDING",2,"Twelve storeys of stainless steel with nothing to corrode. It will outlast every building around it."],
["Flushing Meadows",466,240,"Park","OCCUPIED",1,"Fairground twice over, farmland now. The largest cultivated ground in Queens."],
["Citi Field",480,272,"Civic","SALVAGE",3,""],
["Flushing",506,296,"District","OCCUPIED",1,"Mainland-connected, market-fed, and the largest continuously trading district in the city."],
["Jackson Heights",408,314,"District","OCCUPIED",2,""],
["Elmhurst Hospital Center",396,272,"Medical","OCCUPIED",1,""],
["Sunnyside Yard",300,300,"Industry","SALVAGE",2,"Forty acres of track. The rail out of the region begins here or it does not begin."],
["Yankee Stadium",216,1120,"Civic","OCCUPIED",2,"Field under cultivation, stands used as housing. The Bronx's largest single shelter."],
["Bronx Zoo",330,1240,"Park","OCCUPIED",2,"Livestock now, of a kind. The collection that could be fed was kept."],
["New York Botanical Garden",338,1300,"Park","OCCUPIED",1,"Herbarium and seed store intact — the northern counterpart to the Brooklyn bank."],
["The Bronx",280,1180,"District","OCCUPIED",1,"Mainland. Every route out of the city that still works runs through it."]
];

/* ---- scenes: landmark name -> street-view scene id -------------------------------- */
const SCENE_OF={
 "Soldiers' and Sailors' Memorial Arch":"arch-brooklyn",
 "Grand Army Plaza":"arch-brooklyn",
 "New Museum":"new-museum",
 "Solomon R. Guggenheim Museum":"guggenheim",
 "Empire State Building":"empire-34th",
 "Flatiron Building":"flatiron",
 "Washington Square Arch":"washington-arch",
 "Grand Central Terminal":"grand-central",
 "Times Square":"times-square",
 "Brooklyn Bridge":"brooklyn-bridge",
 "St. Patrick's Cathedral":"st-patricks",
 "New York Public Library":"nypl",
 "Statue of Liberty":"liberty",
 "Apollo Theater":"apollo"
};

NYC.data={WEST,EAST,shore,WX,EX,BANDS,AVES,BROADWAY,CROSSTOWN,THRU,
  NJ,BKQN,BRONX,ROOSEVELT,CPARK,RANDALLS,LIBERTY,ELLIS,GOVERNORS,
  CROSS,GAPS,LANDMARKS:D,SCENE_OF};
})();
