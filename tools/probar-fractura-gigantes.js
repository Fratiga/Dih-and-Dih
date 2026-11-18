// La Fractura: lo que depende del tamaño de los gigantes (2×2): la línea de Rykerd, la salpicadura sobre un gigante y curarse en una ciudad con cualquier casilla.
// Uso: node tools/probar-fractura-gigantes.js
const path=require("path");const R=p=>require(path.join(__dirname,"..","js",p));
R("fractura-datos.js");R("fractura-soldados.js");R("fractura-mapa.js");const FM=R("fractura-motor.js");
let hechas=0,fallos=0;const ok=(c,m)=>{hechas++;if(!c){fallos++;console.log("FALLO:",m);}};
function guerra(){const est=FM.crearGuerra({semilla:11,tipo:"reinos",forma:"continente",dificultad:"normal",anio:1,tregua:0,jugadores:["caballeros-del-reino","trono-de-ceniza"].map((f,i)=>({nombre:"B"+i,faccion:f,humano:i===0,nivelIA:"normal"}))});Object.keys(est.unidades).forEach(k=>delete est.unidades[k]);est.activo=0;return est;}
const llano=(est,x,y)=>{est.casillas[y][x].t="llanura";est.casillas[y][x].est=null;};
// 1. Línea de Rykerd hacia la derecha: sale del borde derecho y da a cada enemigo una vez
{const est=guerra();const x0=10,y0=10;for(let y=y0-1;y<=y0+3;y++)for(let x=x0-1;x<=x0+7;x++)llano(est,x,y);
 const r=FM.nuevaUnidad(est,0,"heroe",x0,y0,null,{heroe:"rykerd",nombre:"Rykerd",cd:0,cd2:0});r.tam=2;
 const a=FM.nuevaUnidad(est,1,"guerrero",x0+2,y0+1,null),b=FM.nuevaUnidad(est,1,"guerrero",x0+4,y0+1,null);const ha=a.hp,hb=b.hp;
 const res=FM.aplicar(est,{t:"habilidad",id:"heroe",n:1,uid:r.uid,x:x0+2,y:y0+1});
 ok(res.ok,"la línea no se puede usar hacia la derecha: "+res.error);ok(a.hp<ha&&b.hp<hb,"la línea no llega a los dos enemigos de la derecha");}
// 2. Salpicadura de un mago sobre un gigante enemigo vecino: una sola vez
{const est=guerra();for(let y=4;y<=9;y++)for(let x=4;x<=9;x++)llano(est,x,y);
 const g=FM.nuevaUnidad(est,1,"heroe",6,6,null,{heroe:"rykerd",nombre:"R",cd:0,cd2:0});g.tam=2;g.hp=60;g.dueno=1;
 const d=FM.nuevaUnidad(est,1,"guerrero",5,6,null);const m=FM.nuevaUnidad(est,0,"arcanista",4,6,null);m.pm=0;
 const h0=g.hp;FM.aplicar(est,{t:"atacar",uid:m.uid,x:d.x,y:d.y});const perd=h0-g.hp;
 ok(perd>0&&perd<=10,"la salpicadura no da al gigante una sola vez (perdió "+perd+")");}
// 3. El fuego quema al gigante aunque arda una casilla que no es su esquina, y cura en ciudad propia con cualquier casilla
{const est=guerra();const ci=FM.ciudadesDe(est,0)[0];const g=FM.nuevaUnidad(est,0,"heroe",ci.x-1,ci.y-1,null,{heroe:"rykerd",nombre:"R",cd:0,cd2:0});g.tam=2;g.hp=20;
 const sinCiudad=(()=>{const e2=guerra();const g2=FM.nuevaUnidad(e2,0,"heroe",3,3,null,{heroe:"rykerd",nombre:"R",cd:0,cd2:0});g2.tam=2;g2.hp=20;for(let y=3;y<=4;y++)for(let x=3;x<=4;x++)llano(e2,x,y);e2.activo=1;FM.aplicar(e2,{t:"terminar"});return g2.hp-20;})();est.activo=1;FM.aplicar(est,{t:"terminar"});console.log("cura en ciudad",g.hp-20,"fuera",sinCiudad);ok(g.hp-20>sinCiudad,"el gigante no se cura en su ciudad si la ciudad no está en su esquina");}
console.log(hechas+" comprobaciones, "+fallos+" fallos");
process.exit(fallos ? 1 : 0);
