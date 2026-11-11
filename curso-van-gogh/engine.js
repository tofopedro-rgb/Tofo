/* Motor de rascunhos-guia: gera cada exercício em 4 estados (estrutura, direção, amostra, pronto). */
(function(G){
"use strict";
const TAU=Math.PI*2,PI=Math.PI,lerp=(a,b,t)=>a+(b-a)*t,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- traços ---------- */
function seg(x,y,ang,len,w,a,bend){bend=bend||0;const n=Math.max(1,Math.ceil(len/5)),p=[];
  for(let i=0;i<=n;i++){const t=i/n,o=Math.sin(t*PI)*bend*len;p.push([x+Math.cos(ang)*len*t-Math.sin(ang)*o,y+Math.sin(ang)*len*t+Math.cos(ang)*o])}
  return {pts:p,w:w,a:a}}
const dot=(x,y,w,a)=>({pts:[[x,y],[x+.4,y+.3]],w:w,a:a});
const line=(x1,y1,x2,y2,w,a)=>seg(x1,y1,Math.atan2(y2-y1,x2-x1),Math.hypot(x2-x1,y2-y1),w||1,a||1);
function curl(x,y,r,dir,rot,w,a,sweep){const p=[],n=10;sweep=sweep||2.7;
  for(let i=0;i<=n;i++){const u=i/n,th=rot+dir*u*sweep,rr=r*(.3+u*.7);p.push([x+Math.cos(th)*rr,y+Math.sin(th)*rr])}
  return {pts:p,w:w,a:a}}
function path(fn,t0,t1,n,w,a){const p=[];for(let i=0;i<=n;i++)p.push(fn(lerp(t0,t1,i/n)));return {pts:p,w:w,a:a}}
function broken(fn,w,a,R,pieces){const out=[];let t=0;const step=1/pieces;
  while(t<1){const len=step*(.7+R()*.5),e=Math.min(1,t+len);out.push(path(fn,t,e,Math.max(3,Math.ceil((e-t)*40)),w*(.8+R()*.4),a));t=e+step*.12*R()}
  return out}
const pl=(pts,dash)=>({pts:pts,dash:!!dash});
function ell(cx,cy,rx,ry,a0,a1,n){const p=[];a0=a0||0;a1=a1==null?TAU:a1;n=n||40;for(let i=0;i<=n;i++){const t=lerp(a0,a1,i/n);p.push([cx+Math.cos(t)*rx,cy+Math.sin(t)*ry])}return p}
function smooth(P,closed){const o=[],n=P.length;const g=i=>closed?P[(i+n)%n]:P[cl(i,0,n-1)];
  for(let i=0;i<(closed?n:n-1);i++){const p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2);
    for(let k=0;k<8;k++){const t=k/8,t2=t*t,t3=t2*t;o.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)])}}
  if(closed)o.push(o[0]);else o.push(P[n-1]);return o}
function inPoly(P,x,y){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function dseg(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=cl(((x-x1)*dx+(y-y1)*dy)/l,0,1),px=x1+dx*t,py=y1+dy*t;
  return {d:Math.hypot(x-px,y-py),t:t,s:Math.sign((x-x1)*dy-(y-y1)*dx)||1}}
const inEll=(x,y,cx,cy,rx,ry)=>{const a=(x-cx)/rx,b=(y-cy)/ry;return a*a+b*b<1};
const tang=(cx,cy,rx,ry)=>{rx=rx||1;ry=ry||1;return (x,y)=>Math.atan2((x-cx)/(rx*rx),-(y-cy)/(ry*ry))};
const radial=(cx,cy)=>(x,y)=>Math.atan2(y-cy,x-cx);
const K=a=>()=>a;
function vortex(cs,base){return (x,y)=>{let vx=base?base[0]:0,vy=base?base[1]:0;
  for(const c of cs){const dx=x-c.x,dy=y-c.y,d=Math.hypot(dx,dy)+1,w=Math.exp(-d/(c.r||150))*c.s*2.6;vx+=-dy/d*w;vy+=dx/d*w}return Math.atan2(vy,vx)}}

/* ---------- uma marca num ponto ---------- */
function mk(o,z,x,y,R,f,owner){const m=z.mark,a=z.dir?z.dir(x,y):0,A=m.a||.86,w=(m.w||2)*f,L=(m.len||12)*f;
  switch(m.t){
  case 'dot':o.push(dot(x,y,w,A));break;
  case 'dash':{const aa=a+(R()-.5)*(m.jit==null?.14:m.jit),l=L*(.85+R()*.3);o.push(seg(x-Math.cos(aa)*l/2,y-Math.sin(aa)*l/2,aa,l,w,A,m.bend||0));break}
  case 'xhatch':{for(const k of [0,m.x||1.1]){const aa=a+k,l=L*(.9+R()*.2);o.push(seg(x-Math.cos(aa)*l/2,y-Math.sin(aa)*l/2,aa,l,w,A))}break}
  case 'comma':{const b=m.bend||.3;o.push(seg(x,y,a+(R()-.5)*.35,L*(.8+R()*.4),w,A,R()<.5?b:-b));break}
  case 'curl':{const d=m.side?m.side(x,y):(R()<.5?1:-1),r=L*(.7+R()*.7),rot=a-d*(1.5+R()*.6),n=m.n||3;
    for(let k=0;k<n;k++)o.push(curl(x,y,r*(1-k*.2),d,rot,w*(1-k*.14),A,2.3+R()*.7));break}
  case 'loop':{const ph=R()*TAU,r=(m.r||6)*f,ca=Math.cos(a),sa=Math.sin(a),l=L*(.7+R()*.6);
    o.push(path(u=>[x+ca*u+Math.cos(u*.42/f+ph)*r,y+sa*u-Math.sin(u*.42/f+ph)*r],0,l,Math.ceil(l/1.8),w,A));break}
  case 'stream':{const p=[[x,y]];let px=x,py=y,pa=null;const st=4,n=Math.ceil(L*(.6+R()*.8)/st);
    for(let i=0;i<n;i++){let aa=z.dir(px,py);if(pa!=null&&Math.cos(aa-pa)<0)aa+=PI;pa=aa;px+=Math.cos(aa)*st;py+=Math.sin(aa)*st;if(owner(px,py)!==z)break;p.push([px,py])}
    if(p.length>2)o.push({pts:p,w:w,a:A});break}
  }}
function ownerOf(S){const zs=S.zones;return (x,y)=>{for(let i=0;i<zs.length;i++)if(zs[i].in(x,y))return zs[i];return null}}
function bounds(S){return S.view||[0,0,S.W,S.H]}
function fill(S,R,only){const o=[],owner=ownerOf(S),v=bounds(S);
  for(const z of S.zones){if(!z.mark)continue;const b=z.bb||[0,0,S.W,S.H],f=z.f||1,m=z.mark,sp=m.sp*f;
    const x0=Math.max(b[0],v[0]-20),y0=Math.max(b[1],v[1]-20),x1=Math.min(b[2],v[0]+v[2]+20),y1=Math.min(b[3],v[1]+v[3]+20);
    for(let y=y0+sp*.5;y<y1;y+=sp*(m.row||.85)){for(let x=x0+R()*sp;x<x1;x+=sp*(m.xk||1)*(.8+R()*.45)){const yy=y+(R()-.5)*sp*(m.row||.85)*.6;
      if(z.keep&&R()>z.keep(x,yy))continue;if(only&&!only(x,yy))continue;if(owner(x,yy)!==z)continue;mk(o,z,x,yy,R,f,owner)}}}
  return o}
function arrowsOf(S){const o=[],owner=ownerOf(S),v=bounds(S),k=v[2]/600;
  for(const z of S.zones){if(!z.dir||z.noArrow)continue;const b=z.bb||[0,0,S.W,S.H],sp=(z.arrow||44)*k;
    for(let y=Math.max(b[1],v[1])+sp*.5;y<Math.min(b[3],v[1]+v[3]);y+=sp)for(let x=Math.max(b[0],v[0])+sp*.5;x<Math.min(b[2],v[0]+v[2]);x+=sp){
      if(owner(x,y)===z&&(!z.arrowIf||z.arrowIf(x,y)))o.push([x,y,z.dir(x,y)])}}
  return o}
function build(S,level,seed){const R=rng((seed||1)*7919+13);let strokes=[];const first=s=>s.pts[0];
  if(level===3){strokes=fill(S,R,S.sample).concat((S.ink||[]).filter(s=>S.sample(first(s)[0],first(s)[1])))}
  else if(level===4){strokes=fill(S,R).concat(S.ink||[])}
  return {guides:level<4?S.guides:[],arrows:(level===2||level===3)?arrowsOf(S):[],strokes:strokes}}

function paint(ctx,s,ink,R){ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=ink;const P=s.pts,n=P.length;
  for(let k=0;k<2;k++){const jx=(R()-.5)*.9,jy=(R()-.5)*.9;
    for(let i=1;i<n;i++){const fade=s.soft?1:(i/n>.7?1-(i/n-.7)*1.6:1);
      ctx.globalAlpha=Math.max(.04,s.a*(.38+R()*.42)*fade);ctx.lineWidth=s.w*(.55+R()*.6);
      ctx.beginPath();ctx.moveTo(P[i-1][0]+jx,P[i-1][1]+jy);ctx.lineTo(P[i][0]+jx,P[i][1]+jy);ctx.stroke()}}
  ctx.globalAlpha=1}
function paintGuides(ctx,B,S,C){const v=bounds(S),u=v[2]/600;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=1;
  ctx.strokeStyle=C.guide;ctx.lineWidth=1.5*u;
  for(const g of B.guides){ctx.setLineDash(g.dash?[7*u,6*u]:[]);ctx.beginPath();g.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke()}
  ctx.setLineDash([]);ctx.strokeStyle=C.arrow;ctx.fillStyle=C.arrow;ctx.lineWidth=1.6*u;
  for(const a of B.arrows){const L=17*u,c=Math.cos(a[2]),s=Math.sin(a[2]),x0=a[0]-c*L/2,y0=a[1]-s*L/2,x1=a[0]+c*L/2,y1=a[1]+s*L/2,h=5.5*u;
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    if(S.isImage)continue;
    ctx.beginPath();ctx.moveTo(x1+c*h*.6,y1+s*h*.6);ctx.lineTo(x1-c*h+s*h*.6,y1-s*h-c*h*.6);ctx.lineTo(x1-c*h-s*h*.6,y1-s*h+c*h*.6);ctx.closePath();ctx.fill()}}
/* desenha tudo de uma vez num canvas já dimensionado (largura em px = pxW) */
function render(cv,S,level,C,seed,pxW){const v=bounds(S),k=pxW/v[2];cv.width=Math.round(pxW);cv.height=Math.round(pxW*v[3]/v[2]);
  const ctx=cv.getContext('2d');ctx.setTransform(k,0,0,k,-v[0]*k,-v[1]*k);ctx.clearRect(v[0],v[1],v[2],v[3]);
  if(C.bg){ctx.fillStyle=C.bg;ctx.fillRect(v[0],v[1],v[2],v[3])}
  if(S.drawLevel){S.drawLevel(ctx,level,C);return {ctx:ctx}}
  const B=build(S,level,seed),R=rng((seed||1)+101);paintGuides(ctx,B,S,C);for(const s of B.strokes)paint(ctx,s,C.ink,R);return {ctx:ctx,B:B}}

/* =====================================================================
   CENAS
   ===================================================================== */
const MD={
  dash:{t:'dash',sp:17,len:15,w:2.6,row:.62,jit:.1},dot:{t:'dot',sp:12,w:4.2},comma:{t:'comma',sp:15,len:17,w:2.4},
  hatch:{t:'dash',sp:8,len:42,w:1.8,row:3.6,jit:.05,bend:.02},loop:{t:'loop',sp:44,len:60,w:1.6,row:.42,r:6},
  wave:{t:'stream',sp:13,len:130,w:1.8,xk:7},curl:{t:'curl',sp:19,len:9,w:2},xhatch:{t:'xhatch',sp:12,len:26,w:1.7,x:1.25}};
const MDIR={dash:K(0),comma:K(-PI/2),hatch:K(-1.05),loop:K(0),wave:(x,y)=>Math.sin(x/24+y*.05)*.33,curl:K(-PI/2),xhatch:K(-1.1)};
const rect=(x0,y0,x1,y1)=>(x,y)=>x>=x0&&x<x1&&y>=y0&&y<y1;
const rectG=(x0,y0,x1,y1)=>pl([[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]);
function mkS(W,H){return {W:W,H:H,zones:[],guides:[],ink:[],sample:(x,y)=>x<W*.36}}

const SC={};
/* folha de treino: uma marca em três tamanhos */
SC.strip=p=>{const S=mkS(600,380),bands=[[18,128,1.55],[140,246,1],[258,362,.58]];
  bands.forEach(b=>{S.zones.push({in:rect(14,b[0],586,b[1]),bb:[14,b[0],586,b[1]],dir:MDIR[p.m],f:b[2],mark:MD[p.m],arrow:60});S.guides.push(rectG(14,b[0],586,b[1]))});return S};
/* escala de valor por densidade */
SC.value=p=>{const S=mkS(600,190),ks=[.1,.26,.48,.74,1];
  ks.forEach((k,i)=>{const x0=16+i*116,x1=x0+104,m=Object.assign({},MD[p.m],p.m==='hatch'?{sp:5,len:26,row:3.2}:p.m==='dot'?{sp:6.5,w:3.4}:{sp:9,len:11,w:2.4});
    S.zones.push({in:rect(x0,36,x1,154),bb:[x0,36,x1,154],dir:MDIR[p.m],mark:m,keep:K(k),noArrow:1});S.guides.push(rectG(x0,36,x1,154))});
  S.sample=(x,y)=>x<132||x>480;return S};
/* duas texturas que se encostam sem linha */
SC.twoTex=p=>{const S=mkS(600,380),e=y=>300+Math.sin(y/50)*60+Math.sin(y/17)*10;
  S.zones.push({in:(x,y)=>x<e(y),dir:MDIR[p.a],mark:MD[p.a],arrow:70},{in:()=>true,dir:MDIR[p.b]||null,mark:MD[p.b],arrow:70});
  S.guides.push(pl(Array.from({length:40},(_,i)=>[e(i*9.8),i*9.8]),1));S.sample=(x,y)=>y<130;return S};

/* ---------- peças de paisagem ---------- */
function addSun(S,x,y,r,rad){S.zones.unshift({in:(a,b)=>Math.hypot(a-x,b-y)<r+3,noArrow:1},{in:(a,b)=>Math.hypot(a-x,b-y)<rad,bb:[x-rad,y-rad,x+rad,y+rad],dir:radial(x,y),mark:{t:'dash',sp:r*.62,len:r*.5,w:1.9,jit:.04},arrow:rad*.42});
  S.guides.push(pl(ell(x,y,r,r)),pl(ell(x,y,rad,rad),1));const R=rng(5);broken(t=>[x+Math.cos(t*TAU)*r,y+Math.sin(t*TAU)*r],2.6,.9,R,5).forEach(s=>S.ink.push(s))}
function cySil(cx,base,h,hw){return (x,y)=>{const t=(base-y)/h;if(t<0||t>1)return -1;const half=hw*Math.pow(Math.sin(PI*Math.min(1,.12+t*.9)),.75)*(1-t*.25);return Math.abs(x-cx)/(half+.01)}}
function addCypress(S,cx,base,h,hw){const e=cySil(cx,base,h,hw);
  S.zones.unshift({in:(x,y)=>{const v=e(x,y);return v>=0&&v<1},bb:[cx-hw-4,base-h,cx+hw+4,base],dir:K(-PI/2),keep:(x,y)=>e(x,y)<.55?1:.5,
    mark:{t:'curl',sp:hw*.16+3,len:hw*.14+2,w:1.4+hw*.012,side:x=>x>cx?1:-1,a:.9},arrow:Math.max(30,hw*.9)});
  const L=[],Rr=[];for(let t=0;t<=1.001;t+=.04){const half=hw*Math.pow(Math.sin(PI*Math.min(1,.12+t*.9)),.75)*(1-t*.25);L.push([cx-half,base-t*h]);Rr.unshift([cx+half,base-t*h])}
  S.guides.push(pl(L.concat(Rr)),pl([[cx,base],[cx,base-h]],1))}
function addBands(S,p){const W=S.W,n=p.n||5,hor=p.hor,bot=p.bot||S.H,x0=p.x0||0,x1=p.x1||W,R=rng(p.seed||3),types=p.types||['dot','dash','up','dot2','comma','long'];
  const wind=p.wind==null?.3:p.wind;
  for(let b=0;b<n;b++){const ya=hor+(bot-hor)*Math.pow(b/n,1.6),yb=hor+(bot-hor)*Math.pow((b+1)/n,1.6),t=(b+.5)/n,f=lerp(1/(p.ratio||6),1,Math.pow(t,1.2));
    const e0=x=>ya+Math.sin(x/(90*f+30)+b*1.7)*3*f,e1=x=>yb+Math.sin(x/(90*lerp(1/(p.ratio||6),1,Math.pow((b+1.5)/n,1.2))+30)+(b+1)*1.7)*3*f,ty=types[b%types.length];
    const mark={dot:{t:'dot',sp:14,w:4.4},dot2:{t:'dot',sp:13,w:5.4},dash:{t:'dash',sp:17,len:19,w:3,row:.6,jit:.08},up:{t:'dash',sp:10.5,len:24,w:2.1,jit:.1,bend:.03},
      comma:{t:'comma',sp:17,len:30,w:2.9,bend:.28},long:{t:'dash',sp:12.5,len:40,w:3.3,bend:.2,jit:.25},loop:{t:'loop',sp:40,len:50,w:1.8,row:.5,r:6},wave:{t:'stream',sp:14,len:120,w:2.2,xk:6}}[ty];
    mark.sp=mark.sp/(p.dens||1);
    const dir=ty==='up'?K(-PI/2+wind):ty==='comma'?K(-PI/2+wind*1.3):ty==='long'?K(-PI/2+wind*1.5):ty==='wave'?((x,y)=>Math.sin(x/(40*f+12))*.3):K(0);
    S.zones.push({in:(x,y)=>x>=x0&&x<x1&&y>=e0(x)&&y<e1(x),bb:[x0,ya-6,x1,yb+6],dir:(ty==='dot'||ty==='dot2')?null:dir,f:f,mark:mark,arrow:Math.max(26,70*f)});
    const pts=[];for(let x=x0;x<=x1;x+=12)pts.push([x,e0(x)]);S.guides.push(pl(pts));
    if(b>0){let x=x0;while(x<x1){const xe=Math.min(x1,x+30+R()*90);S.ink.push(path(u=>[u,e0(u)],x,xe,Math.ceil((xe-x)/6),.8+2*f,.85));x=xe+3+R()*8}}
    if(p.hedges&&b>0&&b<n-1)for(let h=0;h<p.hedges;h++){const hx=x0+R()*(x1-x0-80),hl=(50+R()*90)*f+14,r=5.5*f+1;
      S.ink.push(path(u=>[u+Math.cos(u*.5/f)*r,e0(u)-r*.9-Math.sin(u*.5/f)*r],hx,hx+hl,Math.ceil(hl/1.6),1+1.6*f,.92))}}}
function addHouse(S,hx,hy,k){k=k||1;const L=[[0,0,0,-22],[46,0,46,-22],[0,0,46,0],[-5,-22,23,-40],[23,-40,51,-22],[28,0,28,-13],[36,-13,28,-13],[36,0,36,-13]];
  S.zones.unshift({in:(x,y)=>x>hx-6*k&&x<hx+52*k&&y>hy-42*k&&y<hy+2,noArrow:1});
  L.forEach(l=>{S.ink.push(line(hx+l[0]*k,hy+l[1]*k,hx+l[2]*k,hy+l[3]*k,2*k,.92));S.guides.push(pl([[hx+l[0]*k,hy+l[1]*k],[hx+l[2]*k,hy+l[3]*k]]))})}
function horizon(S,fn,w){const R=rng(9);let x=0;const pts=[];for(let u=0;u<=S.W;u+=10)pts.push([u,fn(u)]);S.guides.push(pl(pts));
  while(x<S.W){const xe=Math.min(S.W,x+40+R()*110);S.ink.push(path(u=>[u,fn(u)],x,xe,Math.ceil((xe-x)/6),w||1.5,.86));x=xe+4+R()*7}}

SC.fields=p=>{p=Object.assign({n:5,ratio:6,horK:.22},p);const S=mkS(640,440),hor=S.H*p.horK;
  if(p.sun)addSun(S,p.sun[0],p.sun[1],p.sun[2],p.sun[3]);
  S.zones.push({in:(x,y)=>y<hor+Math.sin(x/70)*4,mark:p.sky?{t:'dot',sp:15,w:1.6}:null});
  horizon(S,x=>hor+Math.sin(x/70)*4+Math.sin(x/23)*1.5);
  if(p.house)addHouse(S,p.house,hor+3,p.houseK||.8);
  addBands(S,Object.assign({hor:hor+2},p));return S};
SC.hero=p=>{const R=rng((p.seed||4)*31+7),S=mkS(1200,430),hor=150+R()*14,sx=780+R()*220,sy=58+R()*24,cyx=120+R()*120,
  cs=[{x:260+R()*160,y:50+R()*40,s:1,r:150},{x:540+R()*120,y:84+R()*30,s:-1,r:150}],hill=x=>hor-10-Math.sin(x/190+1)*9-Math.sin(x/67)*4;
  S.zones.push({in:(x,y)=>y<hill(x)+2,dir:vortex(cs,[.75,0]),mark:{t:'dash',sp:13,len:12,w:1.8,bend:.13}});
  addSun(S,sx,sy,20,76);horizon(S,hill,1.6);
  addBands(S,{hor:hor-12,bot:432,ratio:7,n:6,hedges:3,seed:(p.seed||4)+2});
  addHouse(S,640+R()*80,hor+2,1);addCypress(S,cyx,406,330+R()*40,64);addCypress(S,cyx+104,400,150,30);return S};
SC.boat=()=>{const S=mkS(640,440),hor=118;
  const hull=smooth([[90,250],[140,330],[250,352],[400,345],[520,300],[560,232],[420,262],[250,268]],true);
  S.zones.push({in:(x,y)=>inPoly(hull,x,y),dir:(x,y)=>.08,mark:{t:'dash',sp:26,len:150,w:1.3,row:.7,jit:.03},keep:K(.5),arrow:80},
    {in:(x,y)=>y<hor},{in:(x,y)=>y<hor+70,dir:K(0),f:.55,mark:{t:'dash',sp:17,len:19,w:3,row:.6,jit:.08},arrow:44},
    {in:(x,y)=>y<300,f:.6,mark:{t:'dot',sp:13,w:4.6}},{in:()=>true,mark:{t:'dot',sp:14,w:5}});
  S.guides.push(pl(hull),pl([[0,hor],[640,hor]]),pl([[0,hor+70],[640,hor+70]],1),pl([[330,268],[345,40]]),pl([[200,110],[520,60]]));
  const R=rng(4),q=(a,b,c)=>t=>[(1-t)*(1-t)*a[0]+2*t*(1-t)*b[0]+t*t*c[0],(1-t)*(1-t)*a[1]+2*t*(1-t)*b[1]+t*t*c[1]],Ln=(a,b)=>t=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
  [[q([90,250],[130,345],[260,352]),4.4,3],[q([260,352],[470,350],[560,232]),4.4,4],[q([90,250],[300,285],[560,232]),2.6,5],[Ln([330,268],[345,40]),3.2,3],[Ln([200,110],[520,60]),2.2,4],[Ln([345,45],[560,232]),1,5],[Ln([345,45],[100,250]),1,5]]
    .forEach(a=>broken(a[0],a[1],.93,R,a[2]).forEach(s=>S.ink.push(s)));
  horizon(S,()=>hor,1.3);S.sample=(x,y)=>x<250;return S};
SC.cottages=()=>{const S=mkS(640,440),vp=[350,150];
  const roof=(a)=>smooth(a,true),r1=roof([[20,210],[90,70],[170,60],[250,205],[130,235]]),r2=roof([[215,196],[262,112],[300,108],[330,188],[270,204]]);
  const road=[[vp[0]-6,vp[1]+30],[vp[0]+14,vp[1]+30],[560,440],[170,440]],bush=smooth([[400,190],[470,120],[600,90],[640,200],[640,400],[540,330],[440,270]],true);
  S.zones.push({in:(x,y)=>inPoly(r1,x,y),dir:tang(135,300,1,1.4),mark:{t:'dash',sp:10,len:7,w:3},arrow:50},{in:(x,y)=>inPoly(r2,x,y),f:.6,dir:tang(272,260,1,1.4),mark:{t:'dash',sp:10,len:7,w:3},arrow:40},
    {in:(x,y)=>inPoly(bush,x,y),dir:vortex([{x:520,y:210,s:1,r:90},{x:610,y:330,s:-1,r:70}],[0,-.4]),mark:{t:'curl',sp:22,len:10,w:1.9,n:2},arrow:54},
    {in:(x,y)=>inPoly(road,x,y),dir:radial(vp[0],vp[1]),mark:{t:'dot',sp:15,w:3.6},keep:(x,y)=>.25+(y-180)/600,arrow:60},
    {in:(x,y)=>y>205&&x<330,dir:K(PI/2),mark:{t:'dash',sp:16,len:20,w:1.6,jit:.04},keep:K(.4),arrow:60},{in:()=>true});
  S.guides.push(pl(r1),pl(r2),pl(road.concat([road[0]])),pl(bush),pl([[vp[0],vp[1]+30],[640,vp[1]+30]],1));
  const R=rng(6);[r1,r2,bush].forEach(P=>{for(let i=0;i<P.length-9;i+=11)S.ink.push({pts:P.slice(i,i+9),w:2.6,a:.9})});
  S.ink.push(line(40,235,40,330,2.4,.9),line(240,222,240,318,2.4,.9),line(40,330,240,318,2,.85),line(232,205,232,270,1.8,.9),line(326,196,326,250,1.8,.9));
  S.sample=(x,y)=>x<215;return S};

/* ---------- fluxo ---------- */
function streamGuides(S,dir,seeds,len){seeds.forEach(s=>{for(const sg of [1,-1]){const p=[[s[0],s[1]]];let x=s[0],y=s[1],pa=null;
  for(let i=0;i<len;i++){let a=dir(x,y)+(sg<0?PI:0);if(pa!=null&&Math.cos(a-pa)<0)a+=PI;pa=a;x+=Math.cos(a)*6;y+=Math.sin(a)*6;if(x<0||x>S.W||y<0||y>S.H)break;p.push([x,y])}
  if(p.length>3)S.guides.push(pl(p))}})}
SC.flow=p=>{const S=mkS(640,440),cs=p.cs,ob=p.ob||[];let dir=vortex(cs,p.base||[.7,0]);
  if(ob.length){const d0=dir;dir=(x,y)=>{let vx=Math.cos(d0(x,y)),vy=Math.sin(d0(x,y));for(const o of ob){const dx=x-o[0],dy=y-o[1],d2=dx*dx+dy*dy,r2=o[2]*o[2],k=r2/(d2*d2+1);vx+=-k*(dx*dx-dy*dy);vy+=-k*2*dx*dy}return Math.atan2(vy,vx)};
    ob.forEach(o=>{S.zones.push({in:(x,y)=>Math.hypot(x-o[0],y-o[1])<o[2],noArrow:1});S.guides.push(pl(ell(o[0],o[1],o[2],o[2])));const R=rng(8);broken(t=>[o[0]+Math.cos(t*TAU)*o[2],o[1]+Math.sin(t*TAU)*o[2]],3,.9,R,6).forEach(s=>S.ink.push(s))})}
  S.zones.push({in:()=>true,dir:dir,mark:p.long?{t:'stream',sp:13,len:70,w:2,xk:3.4}:{t:'dash',sp:13,len:12,w:2.1,bend:.13},arrow:46});
  cs.forEach(c=>S.guides.push(pl(ell(c.x,c.y,7,7)),pl(ell(c.x,c.y,c.r*.45,c.r*.45,c.s>0?0:PI,c.s>0?4.6:PI+4.6),1)));
  const seeds=[];for(let i=0;i<7;i++)seeds.push([320,30+i*63]);streamGuides(S,dir,seeds,70);
  S.sample=cs.length?((x,y)=>Math.hypot(x-cs[0].x,y-cs[0].y)<110):((x,y)=>x<230);return S};
SC.sunrays=()=>{const S=mkS(640,440);addSun(S,320,200,40,215);S.zones.push({in:()=>true});S.sample=(x,y)=>x<320&&y<200;return S};
SC.sky=p=>{p=p||{};const S=mkS(640,440),hill=x=>350+Math.sin(x/120+1)*18+Math.sin(x/37)*5,cs=[{x:180,y:140,s:1,r:120},{x:400,y:210,s:-1,r:110}],dir=vortex(cs,[.75,0]);
  addSun(S,540,90,24,78);[[70,70],[300,60],[250,250],[470,300]].forEach(s=>addSun(S,s[0],s[1],7,30));
  S.zones.push({in:(x,y)=>y<hill(x),dir:dir,mark:{t:'dash',sp:13,len:13,w:2.1,bend:.13},arrow:48},
    {in:()=>true,dir:(x,y)=>Math.atan(Math.cos(x/120+1)*.15),mark:{t:'stream',sp:12,len:90,w:2.4,xk:5}});
  horizon(S,hill,2);streamGuides(S,(x,y)=>y<hill(x)?dir(x,y):0,[[320,40],[320,110],[320,180],[320,250],[320,310]],60);
  cs.forEach(c=>S.guides.push(pl(ell(c.x,c.y,7,7))));S.sample=(x,y)=>x<260;return S};
SC.wheat=p=>{p=p||{};const S=mkS(640,440),hor=120,wind=(x,y)=>-PI/2+.45+Math.sin(x/75+y/45)*.5;
  if(p.sun)addSun(S,470,62,22,70);
  S.zones.push({in:(x,y)=>y<hor,dir:(x,y)=>Math.sin(x/95)*.25,mark:{t:'stream',sp:17,len:80,w:1.5,xk:5},keep:K(.5),arrow:70});
  [[hor,190,.42],[190,290,.7],[290,440,1]].forEach(b=>S.zones.push({in:rect(0,b[0],640,b[1]),bb:[0,b[0],640,b[1]],dir:wind,f:b[2],mark:{t:'stream',sp:13,len:50,w:2.6,xk:1.1},arrow:66*b[2]}));
  for(let k=0;k<5;k++){const pts=[];for(let x=0;x<=640;x+=12)pts.push([x,150+k*62+Math.sin(x/75+k*1.38)*24]);S.guides.push(pl(pts,1))}
  horizon(S,()=>hor,1.6);S.sample=(x,y)=>x<230;return S};
SC.hills=()=>{const S=mkS(640,440),rg=[x=>110+Math.sin(x/130)*26,x=>190+Math.sin(x/95+2)*30,x=>275+Math.sin(x/150+4)*34,x=>360+Math.sin(x/110+1)*30,x=>470],dr=[x=>Math.cos(x/130)*26/130,x=>Math.cos(x/95+2)*30/95,x=>Math.cos(x/150+4)*34/150,x=>Math.cos(x/110+1)*30/110,x=>0];
  S.zones.push({in:(x,y)=>y<rg[0](x)});
  for(let i=0;i<4;i++){const f=lerp(.45,1,i/3);S.zones.push({in:(x,y)=>y>=rg[i](x)&&y<rg[i+1](x),dir:(x,y)=>{const t=cl((y-rg[i](x))/(rg[i+1](x)-rg[i](x)),0,1);return Math.atan(lerp(dr[i](x),dr[i+1](x),t))},f:f,mark:{t:'stream',sp:11,len:110,w:2.3,xk:5.5},arrow:64*f});
    horizon(S,rg[i],1.2+i*.5)}
  S.sample=(x,y)=>x<240;return S};
SC.cypress=p=>{p=p||{};const S=mkS(p.pair?600:440,640),cx=p.pair?230:220,base=560;
  addCypress(S,cx,base,500,p.pair?86:92);if(p.pair)addCypress(S,440,base-6,250,46);
  S.zones.push({in:(x,y)=>y>base-14,dir:(x,y)=>Math.sin(x/38+y/20)*.4,mark:{t:'stream',sp:10,len:70,w:2.2,xk:3.4},arrow:60},{in:()=>true});
  S.guides.push(pl([[0,base-14],[S.W,base-14]]));S.sample=(x,y)=>y>330;return S};
SC.olive=()=>{const S=mkS(600,640),ax=[[300,600],[315,520],[285,440],[300,360],[230,290],[170,235]],bx=[[300,360],[360,300],[420,250]];
  const A=smooth(ax,false),B=smooth(bx,false),dPoly=(P,x,y)=>{let best={d:1e9};for(let i=1;i<P.length;i+=2){const r=dseg(x,y,P[i-1][0],P[i-1][1],P[i][0],P[i][1]);if(r.d<best.d){best=r;best.i=i;best.a=Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0])}}return best};
  const blobs=[[160,190,95],[290,140,105],[430,190,100],[90,270,60],[520,270,62],[330,235,70]];
  const trunk=(P,r0,r1)=>({in:(x,y)=>{const b=dPoly(P,x,y);return b.d<lerp(r0,r1,b.i/P.length)},dir:(x,y)=>{const b=dPoly(P,x,y);return b.a+.42*Math.sin(b.i*.5+b.d*.08)*b.s},mark:{t:'stream',sp:8,len:60,w:2.4,xk:1.3},arrow:40});
  S.zones.push(trunk(A,40,13),trunk(B,18,9),
    {in:(x,y)=>blobs.some(b=>Math.hypot(x-b[0],y-b[1])<b[2]),dir:vortex(blobs.slice(0,3).map((b,i)=>({x:b[0],y:b[1],s:i%2?-1:1,r:80})),[0,-.3]),mark:{t:'curl',sp:21,len:10,w:1.9,n:2},keep:(x,y)=>y>200?1:.7,arrow:60},
    {in:(x,y)=>y>585,dir:(x,y)=>Math.sin(x/40+y/18)*.4,mark:{t:'stream',sp:10,len:80,w:2.2,xk:3.6},arrow:60},{in:()=>true});
  S.guides.push(pl(A,1),pl(B,1),pl([[0,585],[600,585]]));blobs.forEach(b=>S.guides.push(pl(ell(b[0],b[1],b[2],b[2]))));
  [[A,40,13],[B,18,9]].forEach(t=>{for(const sd of [1,-1]){const pts=t[0].map((q,i)=>{const n=t[0][Math.min(i+1,t[0].length-1)],a=Math.atan2(n[1]-q[1],n[0]-q[0])+PI/2,r=lerp(t[1],t[2],i/t[0].length)*sd;return [q[0]+Math.cos(a)*r,q[1]+Math.sin(a)*r]});S.guides.push(pl(pts))}});
  S.sample=(x,y)=>y>400;return S};
function addVillage(S,x0,y,n,k){const R=rng(12);let x=x0;for(let i=0;i<n;i++){const w=(26+R()*22)*k,h=(18+R()*12)*k,xx=x,church=i===Math.floor(n/2);
  S.zones.unshift({in:(a,b)=>a>xx&&a<xx+w&&b>y-h&&b<y,bb:[xx,y-h,xx+w,y],dir:K(PI/2),mark:{t:'dash',sp:6*k+2,len:9*k,w:1.5,jit:.02},noArrow:i%2});
  [[0,0,0,-h],[w,0,w,-h],[0,-h,w/2,-h-12*k],[w/2,-h-12*k,w,-h],[0,0,w,0]].forEach(l=>{S.ink.push(line(xx+l[0],y+l[1],xx+l[2],y+l[3],1.8,.92));S.guides.push(pl([[xx+l[0],y+l[1]],[xx+l[2],y+l[3]]]))});
  if(church){S.ink.push(line(xx+w/2,y-h-12*k,xx+w/2,y-h-70*k,2.4,.95),line(xx+w/2-6*k,y-h-30*k,xx+w/2,y-h-70*k,1.6,.9),line(xx+w/2+6*k,y-h-30*k,xx+w/2,y-h-70*k,1.6,.9));S.guides.push(pl([[xx+w/2,y-h],[xx+w/2,y-h-70*k]]))}
  x+=w+6*k}}
SC.village=p=>{p=p||{};const S=mkS(640,440),hill=x=>255+Math.sin(x/140+2)*26,cs=[{x:200,y:110,s:1,r:130},{x:470,y:150,s:-1,r:110}],dir=vortex(cs,[.75,0]);
  if(p.cypress)addCypress(S,105,430,400,54);
  addVillage(S,250,330,7,1);if(p.moon)addSun(S,560,70,22,70);
  S.zones.push({in:(x,y)=>y<hill(x),dir:dir,mark:{t:'dash',sp:13,len:13,w:2.1,bend:.13},arrow:48},
    {in:(x,y)=>y<335,dir:(x,y)=>Math.atan(Math.cos(x/140+2)*.18),mark:{t:'stream',sp:11,len:90,w:2,xk:5.2},arrow:60},
    {in:()=>true,dir:(x,y)=>Math.sin(x/60+y/30)*.3,mark:{t:'stream',sp:11,len:70,w:2.5,xk:3.5},arrow:60});
  horizon(S,hill,2);streamGuides(S,(x,y)=>y<hill(x)?dir(x,y):0,[[320,40],[320,100],[320,160],[320,215]],60);S.guides.push(pl([[0,335],[640,335]],1));
  S.sample=(x,y)=>x>330;return S};
SC.furrows=()=>{const S=mkS(640,440),vp=[400,150],hill=x=>96+Math.sin(x/90)*18+Math.sin(x/31)*6;
  addSun(S,400,74,30,100);
  S.zones.push({in:(x,y)=>y<hill(x)},{in:(x,y)=>y<150,dir:(x,y)=>Math.atan(Math.cos(x/90)*.2),mark:{t:'stream',sp:9,len:60,w:1.6,xk:4},arrow:60});
  [[150,215,.4],[215,300,.68],[300,440,1]].forEach(b=>S.zones.push({in:rect(0,b[0],640,b[1]),bb:[0,b[0],640,b[1]],dir:radial(vp[0],vp[1]),f:b[2],mark:{t:'dash',sp:15,len:26,w:3,jit:.05,bend:.05},arrow:70*b[2]}));
  horizon(S,hill,1.8);horizon(S,()=>150,2.6);for(let i=0;i<9;i++){const a=.25+i*.33;S.guides.push(pl([[vp[0],vp[1]],[vp[0]+Math.cos(a)*600,vp[1]+Math.sin(a)*600]],1))}
  S.sample=(x,y)=>x<250;return S};
SC.sea=()=>{const S=mkS(640,440),hor=130;S.zones.push({in:(x,y)=>y<hor});
  [[hor,175,.35],[175,240,.55],[240,330,.78],[330,440,1]].forEach((b,i)=>S.zones.push({in:rect(0,b[0],640,b[1]),bb:[0,b[0],640,b[1]],dir:(x,y)=>Math.sin(x/(30*b[2]+8)+y*.2)*.35,f:b[2],mark:{t:'dash',sp:19,len:24,w:3,row:.55,bend:.16,jit:.1},arrow:70*b[2]}));
  const R=rng(3);[[180,hor,34],[420,hor+16,52]].forEach(s=>{const x=s[0],y=s[1],k=s[2];S.zones.unshift({in:(a,b)=>a>x-k*.6&&a<x+k*.7&&b>y-k*1.5&&b<y+k*.22,noArrow:1});
    [[-.5,0,.6,0],[-.4,.18,.45,.18],[-.5,0,-.4,.18],[.6,0,.45,.18],[0,0,0,-1.4],[0,-1.4,.5,-.1],[0,-1.3,-.4,-.2],[-.4,-.2,0,-.2]].forEach(l=>{S.ink.push(line(x+l[0]*k,y+l[1]*k,x+l[2]*k,y+l[3]*k,2.2,.92));S.guides.push(pl([[x+l[0]*k,y+l[1]*k],[x+l[2]*k,y+l[3]*k]]))})});
  horizon(S,()=>hor,1.4);S.sample=(x,y)=>x<240;return S};

/* ---------- cabeça ---------- */
SC.head=p=>{p=Object.assign({yaw:-.7,beard:1,hat:'none',hair:1,bg:'none',coat:1,k:1,shadow:1,face:'wrap'},p);
  const S=mkS(600,760),ya=Math.abs(p.yaw),ys=Math.sign(p.yaw)||-1,cx=300-p.yaw*14,cy=350,k=p.k;
  const sx=x=>x===0?1:(Math.sign(x)===ys?1-.4*ya:1+.05*ya),T=(x,y,z)=>[cx+x*sx(x)+p.yaw*(z||0)*40,cy+y];
  const half=[[0,-225,0],[70,-215,0],[125,-175,0],[152,-110,0],[158,-30,0],[150,50,.1],[132,120,.25],[100,180,.4],[55,222,.6],[0,236,.7]];
  const loc=half.concat(half.slice(1,-1).reverse().map(q=>[-q[0],q[1],q[2]])),HP=smooth(loc.map(q=>T(q[0],q[1],q[2])),true);
  const eL=T(-68,-18,.6),eR=T(68,-18,.6),erx=x=>31*sx(x),nb=T(0,-28,.8),nt=T(0,74,1.55),M=T(0,128,1.05),mw=44*(1-.22*ya),na=Math.atan2(nt[1]-nb[1],nt[0]-nb[0]);
  const near=-ys,ear=T(near*160,18,-.6),Pf=T(0,70,1),cL=T(-82,58,.6),cR=T(82,58,.6),mu=T(0,102,1.2),bc=T(0,150,.6);
  const browY=cy-46,hairY=x=>cy-150+Math.pow(Math.abs(x-cx-p.yaw*30)/150,2)*132,beardTop=x=>cy+94-Math.pow(Math.abs(x-M[0])/128,2)*150;
  const skinM={t:'dash',sp:8.6*k,len:12*k,w:2.1*k},hatc=p.hat==='straw'?{by:cy-118,brx:248,bry:54,cyy:cy-196,crx:142,cry:92}:p.hat==='cap'?{by:cy-126,brx:118,bry:24,cyy:cy-188,crx:156,cry:80}:{by:cy-128,brx:206,bry:40,cyy:cy-214,crx:148,cry:106};
  const hx=cx+p.yaw*12,Z=S.zones,lit=x=>((x-nt[0])*ys>0?1:0);
  const eye=e=>({in:(x,y)=>inEll(x,y,e[0],e[1],erx(e[0]-cx)+13,27),bb:[e[0]-50,e[1]-30,e[0]+50,e[1]+30],dir:tang(e[0],e[1],1.25,1),mark:{t:'dash',sp:6.4*k,len:8*k,w:1.8*k},arrow:26});
  Z.push(eye(eL),eye(eR));
  Z.push({in:(x,y)=>{const r=dseg(x,y,nb[0],nb[1],nt[0],nt[1]);return r.d<lerp(12,27,r.t)*(1-.15*ya)||inEll(x,y,nt[0],nt[1]+2,30*(1-.15*ya),14)},dir:(x,y)=>y>nt[1]-10?tang(nt[0],nt[1]-26)(x,y):na,mark:{t:'dash',sp:7*k,len:10*k,w:2*k},arrow:28});
  if(p.beard)Z.push({in:(x,y)=>inEll(x,y,mu[0],mu[1],64*(1-.2*ya),18),dir:(x,y)=>radial(mu[0],mu[1]-22)(x,y),mark:{t:'comma',sp:7*k,len:13*k,w:2.1*k,bend:.2},arrow:30});
  Z.push({in:(x,y)=>inEll(x,y,M[0],M[1],mw,10),dir:K(0),mark:{t:'dash',sp:6*k,len:10*k,w:1.9*k,row:.6},arrow:30});
  if(p.hat!=='none'){const h=hatc;
    if(p.hat==='cap'){const vz=T(0,-126,1.3);Z.push({in:(x,y)=>inEll(x,y,vz[0],h.by+6,h.brx*(1-.1*ya),h.bry),dir:tang(vz[0],h.by-30,h.brx,h.bry*2),mark:{t:'dash',sp:7*k,len:12*k,w:2.2*k},arrow:36});
      S.guides.push(pl(ell(vz[0],h.by+6,h.brx*(1-.1*ya),h.bry)))}
    else {Z.push({in:(x,y)=>inEll(x,y,hx,h.by,h.brx,h.bry),dir:tang(hx,h.by,h.brx,h.bry),mark:{t:'dash',sp:9*k,len:14*k,w:2.2*k},arrow:40});S.guides.push(pl(ell(hx,h.by,h.brx,h.bry)))}
    Z.push({in:(x,y)=>y<h.by&&inEll(x,y,hx,h.cyy,h.crx,h.cry),dir:p.hat==='cap'?K(0):tang(hx,h.by,h.crx,h.cry*1.6),mark:{t:'dash',sp:9*k,len:14*k,w:2.2*k,row:.7},arrow:42});
    S.guides.push(pl(ell(hx,h.cyy,h.crx,h.cry,PI*.98,TAU*1.01)))}
  Z.push({in:(x,y)=>inEll(x,y,ear[0],ear[1],21,43),dir:tang(ear[0],ear[1],1,2),mark:{t:'dash',sp:7*k,len:9*k,w:1.9*k},arrow:30});
  if(p.hair)Z.push({in:(x,y)=>inEll(x,y,cx,cy-70,174,180)&&y<hairY(x)&&y<cy+46,dir:(x,y)=>radial(Pf[0],cy-30)(x,y)+.55*ys,mark:{t:'dash',sp:8*k,len:15*k,w:2.2*k,bend:.2},arrow:36});
  if(p.beard)Z.push({in:(x,y)=>inEll(x,y,bc[0],bc[1],146*(1-.12*ya),128)&&y>beardTop(x)&&y>cy-10,dir:radial(mu[0],mu[1]-10),mark:{t:'comma',sp:8*k,len:15*k,w:2.2*k,bend:.26},arrow:36});
  Z.push({in:(x,y)=>inPoly(HP,x,y),dir:(x,y)=>{if(y<browY)return tang(Pf[0],Pf[1],1.2,1)(x,y);if(p.face==='radiate')return radial(nb[0],nb[1]+30)(x,y);const c=x<nt[0]?eL:eR;return tang(c[0],c[1]+14,1,1.3)(x,y)},
    mark:skinM,keep:p.shadow?((x,y)=>lit(x)?.5:1):K(.8),arrow:38});
  Z.push({in:(x,y)=>Math.abs(x-cx-p.yaw*8)<64&&y>cy+190&&y<cy+300,dir:K(PI/2+.08*ys),mark:{t:'dash',sp:9*k,len:14*k,w:2*k},keep:K(.55),arrow:44});
  if(p.coat){const sh=x=>cy+252+.22*Math.abs(x-cx);
    Z.push({in:(x,y)=>y>sh(x),dir:p.coat==='wave'?((x,y)=>(x<cx?1:PI-1)+Math.sin(x/34+y/26)*.45):((x,y)=>x<cx?1.05:PI-1.05),mark:p.coat==='wave'?{t:'stream',sp:10*k,len:60,w:2.4*k,xk:1.6}:{t:'xhatch',sp:11*k,len:26*k,w:2.4*k,x:1.2},arrow:50});
    const pts=[];for(let x=0;x<=600;x+=20)pts.push([x,sh(x)]);S.guides.push(pl(pts),pl([[cx-64,cy+300],[cx,cy+410]]),pl([[cx+64,cy+300],[cx,cy+410]]));
    S.ink.push(line(cx-64,cy+300,cx-4,cy+405,3,.92),line(cx+64,cy+300,cx+4,cy+405,3,.92))}
  const hc=[cx,cy-40];
  if(p.bg==='halo')Z.push({in:()=>true,dir:tang(hc[0],hc[1],1,1.2),mark:{t:'dash',sp:13*k,len:15*k,w:2.2*k,a:.74},arrow:56});
  else if(p.bg==='swirl'){const cs=[{x:95,y:170,s:1,r:120},{x:515,y:300,s:-1,r:130},{x:480,y:80,s:1,r:90}];Z.push({in:()=>true,dir:vortex(cs,[.2,-.6]),mark:{t:'stream',sp:12*k,len:44,w:2.2*k,xk:2.2,a:.76},arrow:56});cs.forEach(c=>S.guides.push(pl(ell(c.x,c.y,6,6))))}
  else if(p.bg==='lattice')Z.push({in:()=>true,dir:(x,y)=>((Math.floor(x/30)+Math.floor(y/30))%2?0:PI/2),mark:{t:'dash',sp:8.5*k,len:22*k,w:1.5*k,jit:.03,a:.7},arrow:60});
  else if(p.bg==='dots')Z.push({in:()=>true,mark:{t:'dot',sp:12*k,w:3.2*k,a:.74}});
  else if(p.bg==='rays')Z.push({in:()=>true,dir:radial(hc[0],hc[1]),mark:{t:'dash',sp:13*k,len:16*k,w:2.2*k,a:.74},arrow:56});
  else Z.push({in:()=>true});
  /* estrutura */
  const zc=y=>y<-150?.2:(y<74?lerp(.6,1.55,(y+150)/224):lerp(1.55,.7,(y-74)/162)),axis=[];for(let y=-225;y<=236;y+=20)axis.push(T(0,y,zc(y)));
  const hl=[],bt=[];for(let x=cx-150;x<=cx+150;x+=12){hl.push([x,hairY(x)]);bt.push([x,beardTop(x)])}
  S.guides.push(pl(HP),pl(axis,1),pl([T(-156,-18,0),eL,eR,T(156,-18,0)],1),pl([T(-150,-50,0),T(0,-50,.7),T(150,-50,0)],1),pl([T(-140,82,.2),T(0,82,1.4),T(140,82,.2)],1),
    pl(ell(eL[0],eL[1],erx(-1),15)),pl(ell(eR[0],eR[1],erx(1),15)),pl([nb,T(-24,78,1.05),nt,T(24,78,1.05),nb]),pl(ell(M[0],M[1],mw,10)),pl(ell(ear[0],ear[1],21,43)),
    pl([[cx-64+p.yaw*8,cy+200],[cx-64+p.yaw*8,cy+300]]),pl([[cx+64+p.yaw*8,cy+200],[cx+64+p.yaw*8,cy+300]]));
  if(p.hair&&p.hat==='none')S.guides.push(pl(hl,1));if(p.beard)S.guides.push(pl(bt,1));
  /* contornos finais */
  const R=rng(31),I=S.ink,arc=(c,rx,ry,a0,a1,w)=>broken(t=>{const a=lerp(a0,a1,t);return [c[0]+Math.cos(a)*rx,c[1]+Math.sin(a)*ry]},w*k,.95,R,2).forEach(s=>I.push(s));
  [eL,eR].forEach(e=>{const rx=erx(e[0]-cx);arc(e,rx,13,PI*1.08,PI*1.92,3.6);arc(e,rx,11,.2,PI-.2,1.6);I.push(dot(e[0]+p.yaw*5,e[1]-1,9*k,.98));
    for(let i=0;i<6;i++)I.push(seg(e[0]-rx+i*rx*.4,e[1]-32-Math.sin(i/5*PI)*7,-.5+i*.16,13*k,2.8*k,.92))});
  arc([nt[0]-17*sx(-1),nt[1]+2],9,8,PI*.5,PI*1.5,2.6);arc([nt[0]+17*sx(1),nt[1]+2],9,8,-PI*.5,PI*.5,2.6);arc([nt[0],nt[1]+8],12,5,.2,PI-.2,2.2);
  broken(t=>[M[0]+lerp(-mw,mw,t),M[1]+Math.sin(t*PI)*3-Math.sin(t*TAU)*1.5],3*k,.94,R,3).forEach(s=>I.push(s));
  arc(ear,19,41,near>0?-PI*.5:PI*.5,near>0?PI*.5:PI*1.5,2.8);
  if(!p.beard){const j=HP.filter(q=>q[1]>cy+40);for(let i=0;i<j.length-7;i+=9)I.push({pts:j.slice(i,i+8),w:2.8*k,a:.9})}
  if(p.hat==='cap'){const h=hatc;arc([hx,h.cyy],h.crx,h.cry,PI*1.0,PI*2.0,3);arc([T(0,-126,1.3)[0],h.by+6],h.brx*(1-.1*ya),h.bry,.05,PI-.05,3.4);I.push(line(hx-h.crx,h.cyy,hx-h.crx+6,h.by,3*k,.92),line(hx+h.crx,h.cyy,hx+h.crx-6,h.by,3*k,.92))}
  if(p.hat!=='none'&&p.hat!=='cap'){const h=hatc;arc([hx,h.by],h.brx,h.bry,.05,PI-.05,3.2);arc([hx,h.cyy],h.crx,h.cry,PI*1.02,PI*1.98,2.6)}
  const sc=near>0?cR:cL;S.sample=(x,y)=>Math.hypot(x-sc[0],y-sc[1]-20)<112;
  S.pts={eL:eL,eR:eR,nt:nt,nb:nb,M:M,ear:ear,cx:cx,cy:cy,bc:bc,hx:hx,hat:hatc};
  if(p.zoom){const P=S.pts,z=p.zoom,V={eye:[(near>0?eR:eL)[0]-80,eL[1]-62,160,124],eyes:[cx-175+p.yaw*20,cy-100,330,170],nose:[nt[0]-85,cy-50,170,170],mouth:[M[0]-110,cy+60,220,150],ear:[ear[0]-75,ear[1]-75,150,150],
      beard:[bc[0]-170,cy+50,340,250],brow:[cx-170,cy-235,340,200],hat:[hx-260,cy-330,520,290],cheek:[sc[0]-90,sc[1]-80,180,180]}[z];S.view=V;
    S.sample=(x,y)=>x<V[0]+V[2]*.42}
  return S};

/* ---------- corpo ---------- */
const POSES={
  stand:{g:650,head:[262,92,36],segs:[[196,170,176,350,26,22],[330,170,350,345,26,22],[262,150,262,330,66,74],[262,330,262,450,78,88],[236,450,230,625,30,24],[290,450,296,625,30,24],[230,632,200,640,15,13],[296,632,326,640,15,13]],props:[[350,345,372,650]]},
  bend:{g:640,head:[150,392,33],segs:[[190,362,152,520,24,20],[226,372,222,540,24,20],[330,292,196,352,74,60],[344,300,352,540,84,100],[320,560,300,628,24,26],[380,560,400,628,24,26]],props:[[120,540,260,560]]},
  sower:{g:640,head:[272,96,33],segs:[[296,176,384,246,24,20],[384,246,456,236,20,17],[236,186,206,292,24,22],[226,300,262,330,44,40],[262,160,252,340,54,58],[240,350,184,496,36,28],[184,496,168,622,26,22],[268,350,330,488,36,28],[330,488,392,604,26,22],[168,630,134,634,14,13],[392,612,424,622,14,13]],props:[]},
  dig:{g:640,head:[188,176,33],segs:[[214,236,202,372,24,20],[244,250,228,414,24,20],[322,330,222,222,60,54],[312,340,270,480,36,28],[270,480,280,618,26,22],[338,340,362,480,36,28],[362,480,352,618,26,22],[280,626,248,632,14,13],[352,626,384,632,14,13]],props:[[178,300,256,612]]},
  sit:{g:640,head:[232,236,35],segs:[[276,284,228,366,26,22],[228,366,238,278,22,19],[330,420,270,258,58,52],[330,424,200,432,40,32],[200,432,194,606,30,24],[194,614,158,622,15,13]],props:[[300,470,420,470],[400,250,410,640],[310,470,304,640],[330,250,400,250]]},
  cyl:{g:660,head:null,segs:[[110,120,110,560,56,56],[230,560,400,140,50,34],[430,470,470,170,36,30]],props:[]}};
SC.figure=p=>{const S=mkS(520,680),P=POSES[p.pose],R=rng(17),k=p.k||1;
  if(P.head){const h=P.head;S.zones.push({in:(x,y)=>Math.hypot(x-h[0],y-h[1])<h[2],dir:tang(h[0],h[1]+h[2]*.6),mark:{t:'dash',sp:7,len:11,w:2.1},keep:(x,y)=>x>h[0]?1:.5,arrow:30});S.guides.push(pl(ell(h[0],h[1],h[2],h[2])));
    broken(t=>[h[0]+Math.cos(-1+t*3)*h[2],h[1]+Math.sin(-1+t*3)*h[2]],3.4,.94,R,3).forEach(s=>S.ink.push(s))}
  P.segs.forEach(g=>{const a=Math.atan2(g[3]-g[1],g[2]-g[0]),rr=t=>lerp(g[4],g[5],t);
    S.zones.push({in:(x,y)=>{const r=dseg(x,y,g[0],g[1],g[2],g[3]);return r.d<rr(r.t)},bb:[Math.min(g[0],g[2])-g[4]-4,Math.min(g[1],g[3])-g[4]-4,Math.max(g[0],g[2])+g[4]+4,Math.max(g[1],g[3])+g[4]+4],
      dir:(x,y)=>{const r=dseg(x,y,g[0],g[1],g[2],g[3]);return a+PI/2+r.s*(r.d/rr(r.t))*.55},mark:{t:'dash',sp:7.5*k,len:Math.max(10,g[4]*.42)*k,w:2.2*k,bend:.1},
      keep:(x,y)=>dseg(x,y,g[0],g[1],g[2],g[3]).s>0?1:.42,arrow:Math.max(26,g[4]*.8)});
    const n=[Math.cos(a+PI/2),Math.sin(a+PI/2)];S.guides.push(pl([[g[0],g[1]],[g[2],g[3]]],1),pl(ell(g[0],g[1],g[4],g[4])),pl(ell(g[2],g[3],g[5],g[5])),
      pl([[g[0]+n[0]*g[4],g[1]+n[1]*g[4]],[g[2]+n[0]*g[5],g[3]+n[1]*g[5]]]),pl([[g[0]-n[0]*g[4],g[1]-n[1]*g[4]],[g[2]-n[0]*g[5],g[3]-n[1]*g[5]]]));
    broken(t=>[lerp(g[0]-n[0]*g[4],g[2]-n[0]*g[5],t),lerp(g[1]-n[1]*g[4],g[3]-n[1]*g[5],t)],3.6,.94,R,3).forEach(s=>S.ink.push(s));
    broken(t=>[lerp(g[0]+n[0]*g[4],g[2]+n[0]*g[5],t),lerp(g[1]+n[1]*g[4],g[3]+n[1]*g[5],t)],1.6,.8,R,4).forEach(s=>S.ink.push(s))});
  P.props.forEach(l=>{S.guides.push(pl([[l[0],l[1]],[l[2],l[3]]]));broken(t=>[lerp(l[0],l[2],t),lerp(l[1],l[3],t)],2.8,.92,R,3).forEach(s=>S.ink.push(s))});
  S.zones.push({in:(x,y)=>y>P.g-8,dir:K(0),mark:{t:'dash',sp:16,len:26,w:2.4,jit:.1},keep:K(.4),arrow:70},{in:()=>true});
  S.guides.push(pl([[0,P.g-8],[520,P.g-8]]));S.sample=p.pose==='cyl'?((x,y)=>y>340):((x,y)=>y>P.g-330&&y<P.g-110);return S};

G.VG={ownerOf:ownerOf,rng:rng,seg:seg,dot:dot,curl:curl,path:path,broken:broken,paint:paint,paintGuides:paintGuides,build:build,render:render,bounds:bounds,SC:SC,
  scene:function(spec){return SC[spec[0]](spec[1]||{})}};
})(window);
