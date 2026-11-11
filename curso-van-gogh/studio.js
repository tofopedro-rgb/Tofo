/* Ateliê: desenhar por cima de qualquer guia e receber avaliação de direção, cruzamentos, tamanho e cobertura. Nada é guardado. */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],PI=Math.PI,TAU=PI*2;
const dlg=$('#studio'),stage=$('#st-stage'),cvB=$('#st-base'),cvI=$('#st-ink'),cvH=$('#st-hud');
const NAMES={dot:'ponto',dash:'tracinho',comma:'vírgula',curl:'cacho',loop:'laço',stream:'linha longa',xhatch:'hachura cruzada'};
const COL={good:'#1F9D55',mid:'#D99A00',bad:'#D7402B'};
let S=null,V=null,owner=null,level=3,seed=3,strokes=[],cur=null,evalOn=false,compassOn=true,under=0,bw=2.4,k=1,penSeen=false,segHash=null,cover=null,targets=[];
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colors=()=>({guide:tok('--guide'),arrow:tok('--arrow'),ink:tok('--ink-draw'),paper:tok('--sheet')});
const adiff=(a,b)=>{let d=Math.abs(a-b)%PI;return d>PI/2?PI-d:d};

function expected(x,y){const z=owner(x,y);if(!z||!z.mark)return {reserved:true};
const f=z.f||1,m=z.mark;
  return {reserved:false,type:m.t,dir:z.dir?z.dir(x,y):null,x:m.x||1.1,len:(m.len||m.w*1.5)*f,w:(m.w||2)*f,name:z.label||NAMES[m.t]||m.t}}

function fit(){const r=stage.getBoundingClientRect(),sc=Math.min(r.width/V[2],r.height/V[3]),w=Math.floor(V[2]*sc),h=Math.floor(V[3]*sc),dpr=Math.min(2,window.devicePixelRatio||1);k=w*dpr/V[2];
  [cvB,cvI,cvH].forEach(c=>{c.style.width=w+'px';c.style.height=h+'px';c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.getContext('2d').setTransform(k,0,0,k,-V[0]*k,-V[1]*k)});
  $('#st-wrap').style.width=w+'px';$('#st-wrap').style.height=h+'px'}
function drawBase(){const ctx=cvB.getContext('2d'),C=colors();ctx.globalAlpha=1;ctx.fillStyle=C.paper;ctx.fillRect(V[0],V[1],V[2],V[3]);
  if(S.img&&under>0){ctx.globalAlpha=under;ctx.drawImage(S.img,0,0,S.W,S.H);ctx.globalAlpha=1}
  if(level>0){const B=VG.build(S,level,seed),R=VG.rng(seed+101);VG.paintGuides(ctx,B,S,C);for(const s of B.strokes)VG.paint(ctx,s,C.ink,R)}}
function strokeColor(s,C){if(!evalOn)return C.ink;if(s.res)return COL.bad;if(s.dev==null)return C.ink;return s.dev<.38?COL.good:s.dev<.7?COL.mid:COL.bad}
function paintStroke(ctx,s,color){const P=s.pts,n=P.length;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  if(n<2||s.len<1.2){ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(P[0][0],P[0][1],s.w*.75,0,TAU);ctx.fill();ctx.globalAlpha=1;return}
  for(let i=1;i<n;i++){const t=i/n,fade=t>.72?1-(t-.72)*1.5:1,p=P[i][2];ctx.globalAlpha=Math.max(.12,(.55+.45*p)*fade);ctx.lineWidth=s.w*(.8+.35*p);
    ctx.beginPath();ctx.moveTo(P[i-1][0],P[i-1][1]);ctx.lineTo(P[i][0],P[i][1]);ctx.stroke()}ctx.globalAlpha=1}
function redrawInk(){const ctx=cvI.getContext('2d'),C=colors();ctx.clearRect(V[0],V[1],V[2],V[3]);for(const s of strokes)paintStroke(ctx,s,strokeColor(s,C))}

/* ---------- avaliação ---------- */
const HC=22,hk=(x,y)=>((x/HC|0)+1000)*4096+((y/HC|0)+1000);
function isect(a,b,c,d){const r=(p,q,s)=>(q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]);return r(a,b,c)*r(a,b,d)<0&&r(c,d,a)*r(c,d,b)<0}
function score(s,si){const P=s.pts;let tot=0,sum=0,cnt=0,res=0;
  for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(l<.3)continue;tot+=l;const mx=(P[i][0]+P[i-1][0])/2,my=(P[i][1]+P[i-1][1])/2,e=expected(mx,my);
    if(e.reserved){res+=l;continue}if(e.dir==null||e.type==='curl'||e.type==='loop'||e.type==='dot')continue;
    const a=Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0]);let dv=adiff(a,e.dir);if(e.type==='xhatch')dv=Math.min(dv,adiff(a,e.dir+e.x));sum+=dv*l;cnt+=l}
  s.len=tot;const e0=expected(P[0][0],P[0][1]);s.res=tot>0?res>tot*.6:e0.reserved;s.dev=(cnt>3&&cnt>tot*.4)?sum/cnt:null;s.type=e0.type;
  s.ratio=null;if(!e0.reserved){if(e0.type==='dot')s.ratio=Math.max(1,tot/(e0.w*1.6));else if(e0.type==='dash'||e0.type==='comma'||e0.type==='xhatch'||(S.isImage&&e0.type==='stream'))s.ratio=tot>2?tot/e0.len:null}
  /* cruzamentos com traços anteriores */
  s.cross=0;const seen=new Set();
  for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],key=hk((a[0]+b[0])/2,(a[1]+b[1])/2);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const L=segHash.get(key+dx*4096+dy);if(!L)continue;for(const g of L){if(g.si===si||seen.has(g.si))continue;if(isect(a,b,g.a,g.b)){s.cross++;seen.add(g.si)}}}}
  for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],key=hk((a[0]+b[0])/2,(a[1]+b[1])/2);let L=segHash.get(key);if(!L){L=[];segHash.set(key,L)}L.push({a:a,b:b,si:si})}
  for(const p of P)cover.add(hk(p[0],p[1]))}
function rebuild(){segHash=new Map();cover=new Set();strokes.forEach((s,i)=>score(s,i))}
function stats(){const n=strokes.length,sc=strokes.filter(s=>s.dev!=null),good=sc.filter(s=>s.dev<.38).length,cross=strokes.reduce((a,s)=>a+s.cross,0),res=strokes.filter(s=>s.res).length;
  const rs=strokes.map(s=>s.ratio).filter(r=>r!=null).sort((a,b)=>a-b),med=rs.length?rs[rs.length>>1]:null;
  let cov=0;for(const t of targets){let hit=false;for(let dx=-1;dx<=1&&!hit;dx++)for(let dy=-1;dy<=1;dy++)if(cover.has(t+dx*4096+dy)){hit=true;break}if(hit)cov++}
  const pc=targets.length?Math.round(cov/targets.length*100):0,dp=sc.length?Math.round(good/sc.length*100):null;
  $('#st-m-n').textContent=n;$('#st-m-dir').textContent=dp==null?'–':dp+'%';$('#st-m-x').textContent=cross;$('#st-m-size').textContent=med==null?'–':med.toFixed(1).replace('.',',')+'×';$('#st-m-cov').textContent=pc+'%';
  const m=[];
  if(sc.length<6)m.push('Faça alguns traços. A avaliação começa a partir do sexto.');
  else{if(dp>=80)m.push('A direção está segura: '+dp+'% dos traços seguem a corrente.');else if(dp>=55)m.push('Parte dos traços foge da corrente ('+dp+'% alinhados). Ligue "Ver avaliação" para ver quais.');else m.push('A maioria dos traços vai contra a corrente. Mude o guia para "2 Direção" e siga as setas.');
    if(cross>n*.22)m.push(cross+' cruzamentos. Deixe um fio de papel entre traços vizinhos.');
    if(med!=null&&med>1.6)m.push('Suas marcas estão '+med.toFixed(1).replace('.',',')+' vezes maiores que as do guia.');else if(med!=null&&med<.55)m.push('Suas marcas estão menores que as do guia. Solte o braço.');
    if(res>3)m.push(res+' traços caíram em área de papel reservado.');
    if(m.length===1&&dp>=80&&pc>60)m.push('Folha bem coberta. Compare com o estado "Pronto".')}
  $('#st-msg').textContent=m.join(' ')}
function mkTargets(){targets=[];for(let y=V[1]+HC/2;y<V[1]+V[3];y+=HC)for(let x=V[0]+HC/2;x<V[0]+V[2];x+=HC){const e=expected(x,y);if(!e.reserved&&(!S.isImage||S.field.dark(x,y)>.3))targets.push(hk(x,y))}}

/* ---------- ponteiro ---------- */
function pos(e){const r=cvI.getBoundingClientRect();return [(e.clientX-r.left)/r.width*V[2]+V[0],(e.clientY-r.top)/r.height*V[3]+V[1],e.pointerType==='pen'?Math.max(.15,e.pressure||.5):.75]}
function hud(p){const ctx=cvH.getContext('2d');ctx.clearRect(V[0],V[1],V[2],V[3]);if(!compassOn||!p)return;const e=expected(p[0],p[1]),u=V[2]/600,r=20*u;
  let cx=p[0]-44*u,cy=p[1]-44*u;if(cx<V[0]+r+4)cx=p[0]+44*u;if(cy<V[1]+r+4)cy=p[1]+50*u;const C=colors();
  ctx.globalAlpha=.92;ctx.fillStyle=C.paper;ctx.strokeStyle=C.arrow;ctx.lineWidth=1.6*u;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();ctx.stroke();ctx.globalAlpha=1;
  ctx.fillStyle=C.arrow;ctx.font='600 '+(10.5*u)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
  if(e.reserved){ctx.fillText('papel',cx,cy-5*u);return}
  if(e.dir!=null&&e.type!=='dot'){const dirs=e.type==='xhatch'?[e.dir,e.dir+e.x]:[e.dir];ctx.lineWidth=3*u;ctx.lineCap='round';dirs.forEach(a=>{const c=Math.cos(a)*r*.72,s=Math.sin(a)*r*.72;ctx.beginPath();ctx.moveTo(cx-c,cy-s);ctx.lineTo(cx+c,cy+s);ctx.stroke()})}
  else{ctx.beginPath();ctx.arc(cx,cy,4*u,0,TAU);ctx.fill()}
  ctx.fillStyle=C.paper;ctx.globalAlpha=.85;const tw=ctx.measureText(e.name).width+8*u;ctx.fillRect(cx-tw/2,cy+r+2*u,tw,14*u);ctx.globalAlpha=1;ctx.fillStyle=C.arrow;ctx.fillText(e.name,cx,cy+r+3.5*u)}
cvI.addEventListener('pointerdown',e=>{if(e.pointerType==='pen')penSeen=true;if(penSeen&&e.pointerType==='touch')return;e.preventDefault();cvI.setPointerCapture(e.pointerId);const p=pos(e);cur={pts:[p],w:bw*(V[2]/600),len:0}});
cvI.addEventListener('pointermove',e=>{if(penSeen&&e.pointerType==='touch')return;const evs=(cur&&e.getCoalescedEvents)?e.getCoalescedEvents():[e];let p=null;
  if(cur){const ctx=cvI.getContext('2d'),C=colors();ctx.strokeStyle=C.ink;ctx.lineCap='round';
    for(const ev of (evs.length?evs:[e])){p=pos(ev);const q=cur.pts[cur.pts.length-1],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<1.1*(V[2]/600))continue;cur.len+=d;
      ctx.globalAlpha=.55+.45*p[2];ctx.lineWidth=cur.w*(.8+.35*p[2]);ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();cur.pts.push(p)}ctx.globalAlpha=1}
  hud(p||pos(e))});
function finish(){if(!cur)return;const s=cur;cur=null;if(s.pts.length<2)s.pts.push([s.pts[0][0]+.3,s.pts[0][1]+.2,s.pts[0][2]]);strokes.push(s);score(s,strokes.length-1);redrawInk();stats()}
cvI.addEventListener('pointerup',finish);cvI.addEventListener('pointercancel',finish);cvI.addEventListener('pointerleave',()=>{if(!cur)hud(null)});

/* ---------- controles ---------- */
function press(sel,val){$$(sel).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(val))))}
$$('#st-lv button').forEach(b=>b.addEventListener('click',()=>{level=+b.dataset.v;press('#st-lv button',level);drawBase()}));
$$('#st-bw button').forEach(b=>b.addEventListener('click',()=>{bw=+b.dataset.v;press('#st-bw button',bw)}));
$('#st-eval').addEventListener('click',e=>{evalOn=!evalOn;e.currentTarget.setAttribute('aria-pressed',evalOn);redrawInk()});
$('#st-comp').addEventListener('click',e=>{compassOn=!compassOn;e.currentTarget.setAttribute('aria-pressed',compassOn);hud(null)});
$('#st-undo').addEventListener('click',()=>{strokes.pop();rebuild();redrawInk();stats()});
$('#st-clear').addEventListener('click',()=>{strokes=[];rebuild();redrawInk();stats()});
$('#st-under').addEventListener('input',e=>{under=e.target.value/100;drawBase()});
$('#st-close').addEventListener('click',()=>dlg.close());
$('#st-save').addEventListener('click',()=>{const c=document.createElement('canvas');c.width=cvB.width;c.height=cvB.height;const x=c.getContext('2d');x.drawImage(cvB,0,0);x.drawImage(cvI,0,0);
  if(window.VGApp)window.VGApp.zoom(c.toDataURL('image/png'),'Seu desenho com o guia. Segure o dedo sobre a imagem para copiar ou salvar. Nada fica guardado no curso.')});
let rz=0;addEventListener('resize',()=>{if(!dlg.open||!S)return;clearTimeout(rz);rz=setTimeout(()=>{fit();drawBase();redrawInk()},150)});

window.VGStudio={open:function(scene,title,o){o=o||{};S=scene;V=VG.bounds(S);owner=VG.ownerOf(S);level=o.level==null?3:o.level;seed=o.seed||3;strokes=[];cur=null;evalOn=false;under=o.under||0;
  $('#st-title').textContent=title||'Ateliê';$('#st-underbox').hidden=!S.img;$('#st-under').value=Math.round(under*100);$('#st-eval').setAttribute('aria-pressed','false');$('#st-comp').setAttribute('aria-pressed',String(compassOn));
  press('#st-lv button',level);press('#st-bw button',bw);if(!dlg.open)dlg.showModal();
  requestAnimationFrame(()=>{fit();mkTargets();rebuild();drawBase();redrawInk();stats();hud(null)})},
  _debug:()=>({strokes:strokes,expected:expected})};
})();
