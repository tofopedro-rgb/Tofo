(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const {seg,dot,curl,path,broken,paint,rng}=VG,TAU=Math.PI*2,lerp=(a,b,t)=>a+(b-a)*t;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const EX=window.VG_EX,PL=window.VG_PL||{};
function colors(){const cs=getComputedStyle(document.documentElement),g=n=>cs.getPropertyValue(n).trim();return {guide:g('--guide')||'#4F8FD0',arrow:g('--arrow')||'#C66F00',ink:g('--ink-draw')||'#222'}}
const EXPORT={guide:'#4F8FD0',arrow:'#C66F00',ink:'#22262A'};

/* ---------- painel: um canvas que mostra uma cena num dos 4 estados ---------- */
const panels=[];
function Panel(cv,scene,o){o=o||{};this.cv=cv;this.S=scene;this.level=o.level||4;this.seed=o.seed||3;this.dur=o.dur||2200;this.maxH=o.maxH||600;this.after=o.after;this.raf=0;this.drawn=false;panels.push(this)}
Panel.prototype.draw=function(animate){cancelAnimationFrame(this.raf);const cv=this.cv,S=this.S,v=VG.bounds(S),par=cv.parentElement,pcs=getComputedStyle(par),box=par.clientWidth-parseFloat(pcs.paddingLeft)-parseFloat(pcs.paddingRight);if(!(box>0))return;this.drawn=true;
  const cssW=Math.min(box,this.maxH*v[2]/v[3]),dpr=Math.min(2,window.devicePixelRatio||1),k=cssW*dpr/v[2];
  cv.style.width=cssW+'px';cv.style.height=(cssW*v[3]/v[2])+'px';cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssW*dpr*v[3]/v[2]);
  const ctx=cv.getContext('2d');ctx.setTransform(k,0,0,k,-v[0]*k,-v[1]*k);ctx.clearRect(v[0],v[1],v[2],v[3]);
  const C=colors();if(S.drawLevel){S.drawLevel(ctx,this.level,C);return}
  const B=VG.build(S,this.level,this.seed),R=rng(this.seed+101);if(this.guides)B.guides=S.guides;VG.paintGuides(ctx,B,S,C);
  const st=B.strokes,self=this,fin=()=>{if(self.after)self.after(ctx,C)};
  if(!animate||reduce||!st.length){for(const s of st)paint(ctx,s,C.ink,R);fin();return}
  let i=0;const t0=performance.now();
  (function frame(now){const target=Math.min(st.length,Math.ceil((now-t0)/self.dur*st.length));for(;i<target;i++)paint(ctx,st[i],C.ink,R);
    if(i<st.length)self.raf=requestAnimationFrame(frame);else fin()})(t0)};
const io=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const p=e.target.__p;if(p&&!p.drawn)p.draw(false)}}),{rootMargin:'300px'}):null;
function watch(p){p.cv.__p=p;if(io)io.observe(p.cv);else p.draw(false)}
function redraw(){panels.forEach(p=>{if(p.drawn&&p.cv.offsetParent!==null)p.draw(false);else p.drawn=false});panels.forEach(p=>{if(!p.drawn&&io){io.unobserve(p.cv);io.observe(p.cv)}})}
let rz=0,lastW=innerWidth;addEventListener('resize',()=>{if(innerWidth===lastW)return;lastW=innerWidth;clearTimeout(rz);rz=setTimeout(redraw,160)});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redraw);
new MutationObserver(redraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
const inkScene=(W,H,fn,seed)=>({W:W,H:H,zones:[],guides:[],ink:fn(rng(seed*9973+11)),sample:()=>true});

/* ---------- as doze marcas ---------- */
const MARKS=[
 {n:'Hachura paralela',w:'Roupas e sombras da Haia, casacos.',h:'Traços do mesmo tamanho, do mesmo lado, sem ir e voltar.',
  f:R=>{const o=[];for(let i=0;i<40;i++)o.push(seg(14+i*5.6+R()*2,165+R()*8,-1.05+R()*.06,95+R()*40,1.7,.85,.02));return o}},
 {n:'Hachura cruzada',w:'Casaco de Roulin, fundos em treliça.',h:'Três camadas com ângulos bem diferentes. A terceira só entra no escuro máximo.',
  f:R=>{const o=[];for(let i=0;i<30;i++)o.push(seg(16+i*7.4+R()*2,168,-1.2,150+R()*10,1.5,.75,.01));
   for(let i=0;i<18;i++)o.push(seg(110+i*7.4+R()*2,26,1.25,150+R()*10,1.5,.75,.01));for(let i=0;i<16;i++)o.push(seg(196,30+i*9+R()*2,0,92,1.6,.8,.01));return o}},
 {n:'Ponto',w:'Areia de Saintes-Maries, céus e campos distantes.',h:'Toque e levante, sem girar. Ponta grossa para os de perto, fina para os de longe.',
  f:R=>{const o=[];let y=178;while(y>12){const t=1-(y-12)/166,sp=lerp(15,4.5,t),w=lerp(5,1.3,t);for(let x=10+R()*sp;x<292;x+=sp*(.8+R()*.4))o.push(dot(x,y+(R()-.5)*sp*.4,w,.9));y-=sp*.85}return o}},
 {n:'Tracinho deitado',w:'Mar, campos ceifados, telhados, pele.',h:'Fileiras desencontradas, como tijolos. Largura constante.',
  f:R=>{const o=[];let y=176,row=0;while(y>14){const t=1-(y-14)/162,L=lerp(17,4,t),w=lerp(3,1.2,t);for(let x=8+(row%2)*L*.8+R()*3;x<288;x+=L*1.7*(.9+R()*.2))o.push(seg(x,y+(R()-.5)*2,(R()-.5)*.12,L,w,.88));y-=L*.62+2;row++}return o}},
 {n:'Vírgula',w:'Relva e trigo em primeiro plano, barba.',h:'Um gancho curto que sobe e cai. Faça em tufos, nunca isoladas.',
  f:R=>{const o=[];for(let c=0;c<26;c++){const cx=20+R()*260,cy=40+R()*135,s=.6+cy/175;for(let i=0;i<5;i++)o.push(seg(cx+(i-2)*5*s+R()*2,cy+R()*4,-1.57+(i-2)*.22+(R()-.5)*.2,(14+R()*8)*s,2.2*s,.88,.3*(i<2?-1:1)))}
   return o.sort((a,b)=>a.pts[0][1]-b.pts[0][1])}},
 {n:'Chama',w:'Ciprestes de Saint-Rémy, cabelo dos autorretratos.',h:'Um C de três traços paralelos, sempre subindo. Aperte no miolo, solte na borda.',
  f:R=>{const o=[];for(let i=0;i<150;i++){const t=Math.pow(R(),.8),y=176-t*162,half=38*Math.pow(Math.sin(Math.PI*Math.min(1,.12+t*.9)),.75)*(1-t*.25),off=(R()*1.3+R()*.7-1)*half,d=off>0?1:-1,r=5+R()*7,rot=-1.57-d*(1.5+R()*.6);
    for(let k=0;k<(Math.abs(off)<half*.5?3:2);k++)o.push(curl(150+off,y,r*(1-k*.2),d,rot,2-k*.3,.9,2.3+R()*.7))}
   o.sort((a,b)=>b.pts[0][1]-a.pts[0][1]);for(let i=0;i<10;i++)o.push(seg(90+i*13,178+R()*4,-.15+R()*.3,18,1.8,.8,.2));return o}},
 {n:'Redemoinho',w:'Céus de 1889, fundos dos autorretratos, órbita dos olhos.',h:'Trace a espiral bem leve e cubra com tracinhos que nunca se cruzam.',
  f:R=>{const o=[];for(let r=8;r<92;r+=8.5){const n=Math.floor(r*.62)+4,ph=R()*TAU;for(let i=0;i<n;i++){const th=ph+i/n*TAU,rr=r+i/n*8.5,x=150+Math.cos(th)*rr*1.45,y=95+Math.sin(th)*rr*.95;
    if(x<6||x>294||y<6||y>184)continue;o.push(seg(x,y,Math.atan2(Math.cos(th)*.95,-Math.sin(th)*1.45),7+r*.07,1.5+r*.012,.86,.12))}}return o}},
 {n:'Contorno quebrado',w:'Cascos de barco, troncos, pálpebras, figuras.',h:'Linha grossa em pedaços, com pequenas falhas. Mais pesada embaixo da forma.',
  f:R=>{const q=(a,b,c)=>t=>[(1-t)*(1-t)*a[0]+2*t*(1-t)*b[0]+t*t*c[0],(1-t)*(1-t)*a[1]+2*t*(1-t)*b[1]+t*t*c[1]],L=(a,b)=>t=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];let o=[];
   o=o.concat(broken(q([34,78],[70,165],[150,160]),4,.95,R,3),broken(q([150,160],[235,158],[270,92]),4,.95,R,3),broken(q([34,78],[150,112],[270,92]),2.4,.9,R,4),broken(L([150,104],[158,12]),3,.92,R,2),broken(L([92,44],[246,20]),2,.88,R,3),broken(q([60,96],[150,128],[252,108]),1.4,.7,R,5));
   for(let i=0;i<9;i++)o.push(seg(80+i*19,118+Math.sin(i*.4)*5,1.45,24-Math.abs(i-4)*2,1.3,.7));return o}},
 {n:'Onda longa',w:'Trigo ao vento, chão sob os ciprestes, colinas, casaco de 1889.',h:'Punho solto, braço inteiro. Linhas vizinhas quase paralelas, com falhas.',
  f:R=>{const o=[];for(let y=24;y<178;y+=8.5){const ph=R()*2+y*.03;let x=10;while(x<280){const L=50+R()*80,x0=x,x1=Math.min(290,x+L);
    o.push(path(t=>[t,y+Math.sin(t/24+ph)*5+Math.sin(t/61+ph)*4],x0,x1,Math.ceil((x1-x0)/5),1.7+y*.006,.82));x=x1+5+R()*10}}return o}},
 {n:'Raios',w:'Sol de O Semeador, astros de 1889, halo dos autorretratos.',h:'Disco em contorno e coroas de tracinhos que crescem ao se afastar.',
  f:R=>{let o=broken(t=>[150+Math.cos(t*TAU)*20,95+Math.sin(t*TAU)*20],2.6,.9,R,5);
   [[30,16,7],[44,24,9],[60,32,11],[78,40,13],[98,50,14]].forEach(([r,n,L],k)=>{for(let i=0;i<n;i++){const th=i/n*TAU+k*.13+(R()-.5)*.05,x=150+Math.cos(th)*r,y=95+Math.sin(th)*r*.92;
    if(y>8&&y+Math.sin(th)*L<184&&y+Math.sin(th)*L>6)o.push(seg(x,y,th,L,1.9,.86))}});return o}},
 {n:'Laço',w:'Arbustos, sebes de La Crau, nuvens.',h:'Uma letra "e" cursiva repetida sem levantar a ponta. Mais apertada na sombra.',
  f:R=>{const o=[];for(let row=0;row<8;row++){const y=30+row*19,inset=Math.abs(row-4)*14,x0=22+inset+R()*8,x1=278-inset-R()*8,r=6.5+R()*2,ph=R()*TAU;
   o.push(path(t=>[t+Math.cos(t*.42+ph)*r,y-Math.sin(t*.42+ph)*r+Math.sin(t*.05)*4],x0,x1,Math.ceil((x1-x0)/1.8),1.5+row*.12,.84))}return o}},
 {n:'Mancha e luz levantada',w:'Só em Haia e Nuenen: cabeças, interiores.',h:'Lateral do carvão ou do giz, borracha para abrir a luz, acento preto no fim.',
  f:R=>{const o=[];for(let i=0;i<90;i++){const s=seg(40+R()*190,30+R()*130,-.5+R()*.4,40+R()*40,16,.11);s.soft=1;o.push(s)}
   for(let i=0;i<14;i++)o.push(seg(188+R()*10,60+i*7,2.2+R()*.2,34,3.2,.9));for(let i=0;i<6;i++)o.push(seg(70+i*7,150+R()*3,-.3,30,2.4,.85));return o}}
];
const marksEl=$('#marks');
MARKS.forEach((m,i)=>{const d=document.createElement('article');d.className='mark';
  d.innerHTML='<button type="button" aria-label="Ver a marca '+m.n+' ser desenhada"><canvas></canvas></button><h4>'+m.n+'</h4><p><b>Onde:</b> '+m.w+'</p><p><b>Como:</b> '+m.h+'</p>';
  marksEl.appendChild(d);const p=new Panel($('canvas',d),inkScene(300,190,m.f,i+3),{dur:1500,seed:i+3});watch(p);$('button',d).addEventListener('click',()=>p.draw(true))});

/* ---------- laboratório de profundidade ---------- */
const lab={ratio:6,dens:1,dir:20,sky:false},labScene=()=>VG.scene(['fields',{n:6,ratio:lab.ratio,dens:lab.dens,wind:lab.dir*Math.PI/180,sky:lab.sky,horK:.24}]);
const labP=new Panel($('#lab-cv'),labScene(),{seed:21});watch(labP);
[['ratio',v=>v+'×',v=>lab.ratio=+v],['dens',v=>v+'%',v=>lab.dens=v/100],['dir',v=>v+'°',v=>lab.dir=+v]].forEach(([k,fmt,set])=>{
  const el=$('#lab-'+k),out=$('#lab-'+k+'-o'),up=()=>{out.textContent=fmt(el.value);set(el.value)};up();el.addEventListener('input',()=>{up();labP.S=labScene();labP.draw(false)})});
$('#lab-sky').addEventListener('change',e=>{lab.sky=e.target.checked;labP.S=labScene();labP.draw(false)});

/* ---------- laboratório de fluxo ---------- */
const fl={cs:[{x:190,y:160,s:1,r:130},{x:450,y:270,s:-1,r:130}],long:false,lines:true,base:.7};
function flScene(){const S=VG.scene(['flow',{cs:fl.cs,base:[fl.base,0],long:fl.long}]);if(!fl.lines)S.guides=[];return S}
const flCv=$('#flow-cv'),flP=new Panel(flCv,flScene(),{seed:5,level:4,after:(ctx,C)=>{fl.cs.forEach(c=>{ctx.globalAlpha=1;ctx.fillStyle=C.arrow;ctx.beginPath();ctx.arc(c.x,c.y,13,0,TAU);ctx.fill();
  ctx.fillStyle='#15171A';ctx.font='700 17px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.s>0?'\u21bb':'\u21ba',c.x,c.y+1)})}});
flP.guides=true;watch(flP);const flDraw=()=>{flP.S=flScene();flP.draw(false)};
const flPos=e=>{const r=flCv.getBoundingClientRect();return [(e.clientX-r.left)/r.width*640,(e.clientY-r.top)/r.height*440]};
let drag=null,moved=false,flRaf=0;const flReq=()=>{if(flRaf)return;flRaf=requestAnimationFrame(()=>{flRaf=0;flDraw()})};
flCv.addEventListener('pointerdown',e=>{const p=flPos(e);let best=null,bd=46;fl.cs.forEach(c=>{const d=Math.hypot(c.x-p[0],c.y-p[1]);if(d<bd){bd=d;best=c}});if(best){drag=best;moved=false;flCv.setPointerCapture(e.pointerId);e.preventDefault()}});
flCv.addEventListener('pointermove',e=>{if(!drag)return;const p=flPos(e);if(Math.hypot(p[0]-drag.x,p[1]-drag.y)>3)moved=true;drag.x=Math.max(10,Math.min(630,p[0]));drag.y=Math.max(10,Math.min(430,p[1]));flReq()});
const flUp=()=>{if(drag&&!moved){drag.s=-drag.s;flReq()}drag=null};flCv.addEventListener('pointerup',flUp);flCv.addEventListener('pointercancel',()=>{drag=null});
$('#fl-add').addEventListener('click',()=>{if(fl.cs.length<6){fl.cs.push({x:120+Math.random()*400,y:80+Math.random()*280,s:fl.cs.length%2?-1:1,r:110});flDraw()}});
$('#fl-del').addEventListener('click',()=>{fl.cs.pop();flDraw()});
$('#fl-long').addEventListener('change',e=>{fl.long=e.target.checked;flDraw()});$('#fl-lines').addEventListener('change',e=>{fl.lines=e.target.checked;flDraw()});
const flB=$('#fl-base'),flBo=$('#fl-base-o');flB.addEventListener('input',()=>{fl.base=flB.value/100;flBo.textContent=flB.value+'%';flDraw()});
const preset=(cs,base,long)=>()=>{fl.cs=cs.map(c=>({x:c[0],y:c[1],s:c[2],r:c[3]}));fl.base=base;flB.value=base*100;flBo.textContent=Math.round(base*100)+'%';fl.long=long;$('#fl-long').checked=long;flDraw()};
$('#fl-p1').addEventListener('click',preset([[180,140,1,120],[400,210,-1,110],[560,90,1,70]],.75,false));
$('#fl-p2').addEventListener('click',preset([[320,200,1,260]],0,false));
$('#fl-p3').addEventListener('click',preset([[320,520,1,300]],1,true));

/* ---------- certo e errado ---------- */
[['bad-head','c12','Traços em qualquer direção, cruzando uns aos outros. A semelhança até existe, mas o rosto fica chapado e sujo.','Cada zona tem a sua corrente: anéis nos olhos, arcos na testa, leque na barba. O volume aparece sem sombra.'],
 ['bad-flow','f04','A ideia dos dois redemoinhos está lá, mas os tracinhos se cruzam. Vira palha.','Vizinhos quase paralelos. A direção muda aos poucos e nenhum traço cruza outro.'],
 ['bad-plain','r13','Todas as marcas do mesmo tamanho e o céu coberto. A planície vira papel de parede.','As marcas encolhem até o horizonte e o céu fica reservado. O chão afunda.']
].forEach(p=>{const row=document.createElement('div');row.className='pairrow';
  row.innerHTML='<figure><div class="cvbox"><img loading="lazy" alt="Exemplo errado"></div><figcaption><b>Errado</b></figcaption></figure><figure><div class="cvbox"><img loading="lazy" alt="Exemplo certo"></div><figcaption><b>Certo</b></figcaption></figure>';
  const im=$$('img',row),fc=$$('figcaption',row);im[0].src='ex/'+p[0]+'.jpg';im[1].src='ex/'+p[1]+'.jpg';fc[0].append(p[2]);fc[1].append(p[3]);$('#pairs').appendChild(row)});

/* ---------- galerias ---------- */
const dlg=$('#zoom'),dimg=$('img',dlg),dtxt=$('#zoom-txt');
function zoom(src,txt){dimg.src=src;dtxt.textContent=txt||'';if(dlg.open)dlg.close();if(dlg.showModal)dlg.showModal()}
window.VGApp={zoom:zoom};
function xray(k){const pl=PL[k];VGAnalyze.load('img/'+k+'.jpg').then(im=>VGStudio.open(VGModel.make(im,{ghost:false,sep:34}),'Raio-X · '+pl.t,{level:2,under:.6,seed:5})).catch(()=>{})}
$('#zoom-close').addEventListener('click',()=>dlg.close());dimg.addEventListener('click',()=>dlg.close());
function overlay(pic,img,pl){const ar=img.naturalHeight/img.naturalWidth*100,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 '+ar);
  (pl.flow||[]).forEach(L=>{const P=L.map(q=>[q[0],q[1]*ar/100]),pa=document.createElementNS(ns,'path');let d='M'+P[0][0]+' '+P[0][1];
    for(let i=1;i<P.length-1;i++){const mx=(P[i][0]+P[i+1][0])/2,my=(P[i][1]+P[i+1][1])/2;d+=' Q'+P[i][0]+' '+P[i][1]+' '+mx+' '+my}d+=' L'+P[P.length-1][0]+' '+P[P.length-1][1];pa.setAttribute('d',d);svg.appendChild(pa);
    const a=P[P.length-2],b=P[P.length-1],an=Math.atan2(b[1]-a[1],b[0]-a[0]),h=2.2,pg=document.createElementNS(ns,'polygon');
    pg.setAttribute('points',[[b[0]+Math.cos(an)*h*.5,b[1]+Math.sin(an)*h*.5],[b[0]-Math.cos(an)*h+Math.sin(an)*h*.55,b[1]-Math.sin(an)*h-Math.cos(an)*h*.55],[b[0]-Math.cos(an)*h-Math.sin(an)*h*.55,b[1]-Math.sin(an)*h+Math.cos(an)*h*.55]].map(q=>q.join(',')).join(' '));svg.appendChild(pg)});
  (pl.centers||[]).forEach(c=>{const ci=document.createElementNS(ns,'circle');ci.setAttribute('cx',c[0]);ci.setAttribute('cy',c[1]*ar/100);ci.setAttribute('r',c[2]||2);svg.appendChild(ci)});
  pic.appendChild(svg);return svg}
let nPl=0;const seen={};
$$('[data-gal]').forEach(g=>{g.dataset.gal.split(',').forEach(k=>{const pl=PL[k];if(!pl)return;if(!seen[k]){seen[k]=1;nPl++}
  const f=document.createElement('figure');f.innerHTML='<div class="pic"><img loading="lazy" alt=""></div><figcaption><b></b><br><i></i><span></span></figcaption>';
  const img=$('img',f);img.src='img/'+k+'.jpg';img.alt=pl.t;$('b',f).textContent=pl.t;$('i',f).textContent=pl.c;$('i',f).style.fontStyle='normal';$('span',f).textContent=pl.l||'';
  img.tabIndex=0;img.addEventListener('click',()=>zoom(img.src,pl.t+'. '+pl.c));
  if(pl.flow){const b=document.createElement('button');b.textContent='Mostrar direção';let svg=null;b.addEventListener('click',()=>{if(!svg){if(!img.naturalWidth)return;svg=overlay($('.pic',f),img,pl);b.textContent='Esconder direção'}else{svg.hidden=!svg.hidden;svg.style.display=svg.hidden?'none':'';b.textContent=svg.hidden?'Mostrar direção':'Esconder direção'}});f.appendChild(b)}
  const xb=document.createElement('button');xb.textContent='Raio-X no Ateliê';xb.addEventListener('click',()=>xray(k));f.appendChild(xb);
  g.appendChild(f)})});
$('#n-pl').textContent=nPl;$('#n-ex').textContent=EX.length;

/* ---------- exercícios ---------- */
const KEY='vg-lapis-v2';let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){saved={}}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){}};
const LV=[[4,'Modelo'],[1,'1 Estrutura'],[2,'2 Direção'],[3,'3 Amostra']],LVN={1:'1 Estrutura',2:'2 Direção',3:'3 Amostra',4:'Modelo'};
EX.forEach((x,i)=>{const host=$('.exlist[data-ch="'+x.ch+'"]');if(!host)return;const a=document.createElement('article');a.className='xc';a.id='x-'+x.id;
  const ref=x.ref&&PL[x.ref]?'<p class="ref"><img loading="lazy" src="img/'+x.ref+'.jpg" alt=""><span>Obra dele para comparar: '+PL[x.ref].t+'</span></p>':'';
  a.innerHTML='<div class="xg"><div class="cvbox"><img class="model" loading="lazy" alt=""><canvas hidden aria-label="Rascunho-guia do exercício"></canvas></div><div class="lv" role="group" aria-label="Estado do rascunho">'+LV.map(l=>'<button type="button" data-l="'+l[0]+'" aria-pressed="'+(l[0]===4)+'">'+l[1]+'</button>').join('')+
    '</div><div class="xa"><button type="button" data-a="draw" class="solid">Desenhar aqui</button><button type="button" data-a="img">Abrir como imagem</button></div></div>'+
    '<div class="xt"><p class="num">'+x.id.toUpperCase()+'</p><h4></h4><p class="meta"></p><p class="d"></p><p class="crit"><b>Pronto quando:</b> <span></span></p>'+ref+
    '<div class="done"><label><input type="checkbox" id="ex-'+x.id+'"> Feito</label><button type="button" data-a="timer">Cronômetro '+x.min+':00</button></div></div>';
  $('h4',a).textContent=x.t;$('.meta',a).textContent=x.m;$('.d',a).textContent=x.d;$('.crit span',a).textContent=x.c;host.appendChild(a);
  const img=$('img.model',a),cv=$('canvas',a),src='ex/'+x.id+'.jpg';img.src=src;img.alt='Desenho-modelo: '+x.t;let S=null,P=null,level=4,pend=null;
  const need=()=>S?Promise.resolve(S):(pend||(pend=VGAnalyze.load(src).then(im=>{S=VGModel.make(im);P=new Panel(cv,S,{level:1,seed:i+2});return S})));
  $$('.lv button',a).forEach(b=>b.addEventListener('click',()=>{level=+b.dataset.l;$$('.lv button',a).forEach(o=>o.setAttribute('aria-pressed',o===b));
    if(level===4){img.hidden=false;cv.hidden=true}else need().then(()=>{img.hidden=true;cv.hidden=false;P.level=level;P.draw(false)})}));
  $('[data-a=draw]',a).addEventListener('click',()=>need().then(S=>VGStudio.open(S,x.id.toUpperCase()+' · '+x.t,{level:level===4?2:level,seed:i+2})));
  $('[data-a=img]',a).addEventListener('click',()=>{if(level===4){zoom(src,x.id.toUpperCase()+' · Modelo. Segure o dedo sobre a imagem e escolha Copiar ou Salvar.');return}
    need().then(S=>{const c=document.createElement('canvas');VG.render(c,S,level,EXPORT,i+2,1600);zoom(c.toDataURL('image/png'),x.id.toUpperCase()+' · '+LVN[level]+'. Segure o dedo sobre a imagem e escolha Copiar ou Salvar. No Procreate: Ações › Adicionar › Colar. O fundo é transparente.')})});
  img.addEventListener('click',()=>zoom(src,x.id.toUpperCase()+' · '+x.t));
  $('[data-a=timer]',a).addEventListener('click',()=>startTimer(x.min,x.id.toUpperCase()+' '+x.t));
  const r=$('.ref img',a);if(r)r.addEventListener('click',()=>zoom(r.src,PL[x.ref].t+'. '+PL[x.ref].c));
  const cb=$('#ex-'+x.id,a);cb.checked=!!saved[cb.id];cb.addEventListener('change',()=>{saved[cb.id]=cb.checked;save();refresh()})});
const rubs=$$('#rubric input');rubs.forEach(b=>{b.checked=!!saved[b.id];b.addEventListener('change',()=>{saved[b.id]=b.checked;save();refresh()})});
function refresh(){const done=EX.filter(x=>saved['ex-'+x.id]).length;$('#total-txt').textContent=done+' de '+EX.length+' feitos';$('#total-bar').style.width=(done/EX.length*100)+'%';
  $$('#rail-list a[data-ch]').forEach(a=>{const l=EX.filter(x=>x.ch===a.dataset.ch);$('span',a).textContent=l.filter(x=>saved['ex-'+x.id]).length+'/'+l.length});
  $('#rub-score').textContent=rubs.filter(b=>b.checked).length+' de '+rubs.length}
refresh();

/* ---------- ateliê: foto e raio-x ---------- */
const ph={img:null,k:1,dens:1,panel:null,S:null};
function phBuild(){if(!ph.img)return;const Sa=VGAnalyze.analyze(ph.img,{k:ph.k,dens:ph.dens});ph.S=VGModel.make(ph.img,{sep:34});const base=ph.S.drawLevel;
  ph.S.drawLevel=(ctx,l,C)=>{if(l===3){const B=VG.build(Sa,4,7),R=rng(108);for(const st of B.strokes)paint(ctx,st,C.ink,R)}else base(ctx,l,C)};if(!ph.panel){ph.panel=new Panel($('#ph-cv'),ph.S,{level:3,seed:7,dur:3600});watch(ph.panel);if($('#ph-cv').offsetParent)ph.panel.draw(false)}else{ph.panel.S=ph.S;ph.panel.draw(false)}}
VGAnalyze.load('img/sp_felt.jpg').then(im=>{ph.img=im;phBuild()}).catch(()=>{});
$('#ph-file').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>VGAnalyze.load(rd.result).then(im=>{ph.img=im;$('#ph-tag').textContent='SUA FOTO';$('#ph-title').textContent='Sua imagem, lida pelo curso';phBuild()}).catch(()=>{$('#ph-title').textContent='Não consegui abrir esse arquivo. Tente uma foto em JPG ou PNG.'});rd.readAsDataURL(f)});
let phT=0;const phRe=()=>{clearTimeout(phT);phT=setTimeout(phBuild,120)};
$('#ph-k').addEventListener('input',e=>{ph.k=e.target.value/100;phRe()});$('#ph-d').addEventListener('input',e=>{ph.dens=e.target.value/100;phRe()});
$$('#ph-lv button').forEach(b=>b.addEventListener('click',()=>{if(!ph.panel)return;ph.panel.level=+b.dataset.l;$$('#ph-lv button').forEach(o=>o.setAttribute('aria-pressed',o===b));ph.panel.draw(false)}));
$('#ph-draw').addEventListener('click',()=>{if(ph.S)VGStudio.open(ph.S,$('#ph-title').textContent,{level:ph.panel.level<3?ph.panel.level:2,seed:7})});
$('#ph-img').addEventListener('click',()=>{if(!ph.S)return;const c=document.createElement('canvas');VG.render(c,ph.S,ph.panel.level,EXPORT,7,1800);zoom(c.toDataURL('image/png'),'Rascunho da sua imagem. Segure o dedo sobre ele e escolha Copiar ou Salvar. No Procreate: Ações › Adicionar › Colar.')});
const xr=$('#xray');Object.keys(PL).forEach(k=>{const b=document.createElement('button');b.type='button';b.innerHTML='<img loading="lazy" alt=""><span></span>';$('img',b).src='img/'+k+'.jpg';$('span',b).textContent=PL[k].t;b.setAttribute('aria-label','Raio-X de '+PL[k].t);b.addEventListener('click',()=>xray(k));xr.appendChild(b)});

/* ---------- cronômetro ---------- */
const T={el:$('#timer'),left:0,total:0,run:false,id:0,end:0},fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
function tick(){if(!T.run)return;T.left=Math.max(0,(T.end-Date.now())/1000);$('#t-time').textContent=fmt(Math.ceil(T.left));if(T.left<=0){T.run=false;clearInterval(T.id);T.el.classList.add('done');$('#t-pause').textContent='Acabou'}}
function startTimer(min,name){clearInterval(T.id);T.total=min*60;T.left=T.total;T.end=Date.now()+T.total*1000;T.run=true;T.el.classList.remove('done');$('#t-name').textContent=name;$('#t-time').textContent=fmt(T.total);$('#t-pause').textContent='Pausar';T.el.hidden=false;T.id=setInterval(tick,250)}
$('#t-pause').addEventListener('click',()=>{if(T.left<=0)return;if(T.run){T.run=false;clearInterval(T.id);$('#t-pause').textContent='Continuar'}else{T.end=Date.now()+T.left*1000;T.run=true;T.id=setInterval(tick,250);$('#t-pause').textContent='Pausar'}});
$('#t-reset').addEventListener('click',()=>startTimer(T.total/60,$('#t-name').textContent));
$('#t-close').addEventListener('click',()=>{T.run=false;clearInterval(T.id);T.el.hidden=true});

/* ---------- capítulos pela âncora ---------- */
const views=$$('.view').map(v=>v.id.slice(2));
function show(){let h=(location.hash||'#inicio').slice(1);if(views.indexOf(h)<0)h='inicio';
  $$('.view').forEach(v=>v.hidden=v.id!=='v-'+h);$$('#rail-list a').forEach(a=>a.classList.toggle('on',a.dataset.v===h));
  const on=$('#rail-list a.on');if(on&&on.scrollIntoView&&innerWidth<=940)on.scrollIntoView({block:'nearest',inline:'center'});
  window.scrollTo(0,0);requestAnimationFrame(()=>panels.forEach(p=>{if(!p.drawn&&io){io.unobserve(p.cv);io.observe(p.cv)}}))}
addEventListener('hashchange',show);show();
window.__vg={EX:EX,EXPORT:EXPORT};
})();
