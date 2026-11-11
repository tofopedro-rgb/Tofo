/* Cena a partir de um desenho-modelo: estrutura em azul tirada das linhas mais pesadas,
   poucas linhas de corrente longas para a direção, e uma metade já resolvida como amostra. */
(function(G){
"use strict";
const cl=(v,a,b)=>v<a?a:v>b?b:v,ss=(a,b,x)=>{const t=cl((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function boxb(src,w,h,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length),d=2*r+1;
  for(let y=0;y<h;y++){let s=0;const o=y*w;for(let x=-r;x<=r;x++)s+=src[o+cl(x,0,w-1)];for(let x=0;x<w;x++){tmp[o+x]=s/d;s+=src[o+cl(x+r+1,0,w-1)]-src[o+cl(x-r,0,w-1)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[cl(y,0,h-1)*w+x];for(let y=0;y<h;y++){out[y*w+x]=s/d;s+=tmp[cl(y+r+1,0,h-1)*w+x]-tmp[cl(y-r,0,h-1)*w+x]}}
  return out}
function alphaCanvas(a,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),id=x.createImageData(w,h),d=id.data;
  for(let i=0;i<a.length;i++){d[i*4+3]=a[i]*255}x.putImageData(id,0,0);return c}

function make(img,opt){opt=opt||{};const S=G.VGAnalyze.analyze(img,opt),W=S.W,H=S.H;
  const mw=Math.min(900,img.naturalWidth||900),mh=Math.round(mw*H/W),n=mw*mh;
  const c=document.createElement('canvas');c.width=mw;c.height=mh;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,mw,mh);
  const d=cx.getImageData(0,0,mw,mh).data,L=new Float32Array(n),hist=new Uint32Array(256);
  for(let i=0;i<n;i++){const v=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];L[i]=v;hist[v|0]++}
  const pc=p=>{let s=0;for(let i=0;i<256;i++){s+=hist[i];if(s>=n*p)return i}return 255},paper=pc(.8),black=pc(.02),rg=Math.max(30,paper-black);
  const dk=new Float32Array(n);for(let i=0;i<n;i++)dk[i]=cl((paper-6-L[i])/rg,0,1);
  const ink=new Float32Array(n),strong=new Float32Array(n),den=boxb(boxb(dk,mw,mh,5),mw,mh,5),thick=boxb(dk,mw,mh,2);
  for(let i=0;i<n;i++){ink[i]=ss(.16,.55,dk[i]);strong[i]=ink[i]*ss(.5,.74,thick[i])}
  const inkC=alphaCanvas(ink,mw,mh),strongC=alphaCanvas(strong,mw,mh),tmp=document.createElement('canvas');tmp.width=mw;tmp.height=mh;
  const hasInk=(X,Y)=>den[cl(Y/H*mh|0,0,mh-1)*mw+cl(X/W*mw|0,0,mw-1)]>.07;
  /* linhas de corrente espaçadas por igual */
  const dir=S.field.dir,ds=opt.sep||40,gw=Math.ceil(W/ds)+1,gh=Math.ceil(H/ds)+1,occ=new Int16Array(gw*gh).fill(-1),R=G.VG.rng(11),lines=[];
  const cell=(x,y)=>cl(y/ds|0,0,gh-1)*gw+cl(x/ds|0,0,gw-1),seeds=[];
  for(let y=ds*.5;y<H;y+=ds*.5)for(let x=ds*.5;x<W;x+=ds*.5)seeds.push([x+(R()-.5)*6,y+(R()-.5)*6,R()]);seeds.sort((a,b)=>a[2]-b[2]);
  for(const sd of seeds){if(!hasInk(sd[0],sd[1])||occ[cell(sd[0],sd[1])]>=0)continue;const id=lines.length,parts=[[],[]];
    for(const k of [0,1]){let x=sd[0],y=sd[1],pa=null;for(let i=0;i<70;i++){let a=dir(x,y)+(k?Math.PI:0);if(pa!=null&&Math.cos(a-pa)<0)a+=Math.PI;if(pa!=null){const df=Math.atan2(Math.sin(a-pa),Math.cos(a-pa));a=pa+cl(df,-.35,.35)}pa=a;
        x+=Math.cos(a)*4;y+=Math.sin(a)*4;if(x<4||y<4||x>W-4||y>H-4||!hasInk(x,y))break;const o=occ[cell(x,y)];if(o>=0&&o!==id)break;parts[k].push([x,y])}}
    const pts=parts[1].reverse().concat([[sd[0],sd[1]]],parts[0]);if(pts.length<12)continue;lines.push(pts);for(const p of pts)occ[cell(p[0],p[1])]=id}
  S.lines=lines;S.isModel=true;S.guides=[];
  function tint(mask,color,alpha,ctx,half){const t=tmp.getContext('2d');t.globalCompositeOperation='copy';t.globalAlpha=1;t.drawImage(mask,0,0);
    if(half){t.globalCompositeOperation='destination-in';const g=t.createLinearGradient(mw*.36,0,mw*.46,0);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');t.fillStyle=g;t.fillRect(0,0,mw,mh)}
    t.globalCompositeOperation='source-in';t.fillStyle=color;t.fillRect(0,0,mw,mh);t.globalCompositeOperation='source-over';ctx.globalAlpha=alpha;ctx.drawImage(tmp,0,0,W,H);ctx.globalAlpha=1}
  S.drawLevel=function(ctx,level,C){
    if(level===4){ctx.globalAlpha=1;ctx.drawImage(img,0,0,W,H);return}
    if(level<1)return;
    if(opt.ghost!==false){if(level===1)tint(strongC,C.guide,.9,ctx);else tint(inkC,C.guide,.32,ctx)}
    if(level>=2){ctx.strokeStyle=C.arrow;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=2.3;ctx.globalAlpha=1;
      for(const P of lines){ctx.beginPath();P.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke()}ctx.globalAlpha=1}
    if(level===3&&opt.ghost!==false)tint(inkC,C.ink,1,ctx,true)};
  S.sample=(X,Y)=>X<W*.4;
  return S}
G.VGModel={make:make};
})(window);
