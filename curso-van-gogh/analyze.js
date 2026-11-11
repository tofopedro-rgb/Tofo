/* Analisador: lê uma imagem (obra ou foto) e devolve uma cena com a direção real dos traços,
   a densidade tirada do claro-escuro e um mapa de valores como estrutura. Tudo roda no navegador. */
(function(G){
"use strict";
const PI=Math.PI,cl=(v,a,b)=>v<a?a:v>b?b:v;
function box(src,w,h,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length),d=2*r+1;
  for(let y=0;y<h;y++){let s=0;const o=y*w;for(let x=-r;x<=r;x++)s+=src[o+cl(x,0,w-1)];
    for(let x=0;x<w;x++){tmp[o+x]=s/d;s+=src[o+cl(x+r+1,0,w-1)]-src[o+cl(x-r,0,w-1)]}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[cl(y,0,h-1)*w+x];
    for(let y=0;y<h;y++){out[y*w+x]=s/d;s+=tmp[cl(y+r+1,0,h-1)*w+x]-tmp[cl(y-r,0,h-1)*w+x]}}
  return out}
function pct(a,p){const h=new Uint32Array(1024);let mx=0;for(let i=0;i<a.length;i++)if(a[i]>mx)mx=a[i];mx=mx||1;
  for(let i=0;i<a.length;i++)h[Math.min(1023,a[i]/mx*1023|0)]++;let c=0;const t=a.length*p;for(let i=0;i<1024;i++){c+=h[i];if(c>=t)return i/1023*mx}return mx}

function analyze(img,opt){opt=opt||{};
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,ar=cl(ih/iw,.4,2.2),aw=opt.aw||340,ah=Math.round(aw*ar),n=aw*ah;
  const c=document.createElement('canvas');c.width=aw;c.height=ah;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,aw,ah);
  const d=cx.getImageData(0,0,aw,ah).data;let L=new Float32Array(n);
  for(let i=0;i<n;i++)L[i]=(.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2])/255;
  const lo=pct(L,.02),hi=pct(L,.98),rg=(hi-lo)||1;for(let i=0;i<n;i++)L[i]=cl((L[i]-lo)/rg,0,1);
  const Lb=box(L,aw,ah,1),gx=new Float32Array(n),gy=new Float32Array(n),jxx=new Float32Array(n),jyy=new Float32Array(n),jxy=new Float32Array(n),mg=new Float32Array(n);
  for(let y=1;y<ah-1;y++)for(let x=1;x<aw-1;x++){const i=y*aw+x,
    a=Lb[i-aw-1],b=Lb[i-aw],e=Lb[i-aw+1],f=Lb[i-1],g=Lb[i+1],h=Lb[i+aw-1],k=Lb[i+aw],m=Lb[i+aw+1],
    X=(e+2*g+m)-(a+2*f+h),Y=(h+2*k+m)-(a+2*b+e);gx[i]=X;gy[i]=Y;jxx[i]=X*X;jyy[i]=Y*Y;jxy[i]=X*Y;mg[i]=Math.sqrt(X*X+Y*Y)}
  const f1=[box(box(jxx,aw,ah,3),aw,ah,3),box(box(jyy,aw,ah,3),aw,ah,3),box(box(jxy,aw,ah,3),aw,ah,3)],
        f2=[box(box(jxx,aw,ah,10),aw,ah,10),box(box(jyy,aw,ah,10),aw,ah,10),box(box(jxy,aw,ah,10),aw,ah,10)];
  const th=new Float32Array(n),coh=new Float32Array(n);
  for(let i=0;i<n;i++){const a=f1[0][i]+3*f2[0][i],b=f1[1][i]+3*f2[1][i],x=f1[2][i]+3*f2[2][i];
    th[i]=.5*Math.atan2(2*x,a-b)+PI/2;const tr=a+b;coh[i]=tr>1e-9?Math.sqrt((a-b)*(a-b)+4*x*x)/tr:0}
  const L2=box(L,aw,ah,2),Lm=box(box(L,aw,ah,22),aw,ah,22),Ls=new Float32Array(n),Lg=box(box(L,aw,ah,5),aw,ah,4);
  for(let i=0;i<n;i++)Ls[i]=cl(.55*L2[i]+.45*(.55+(L2[i]-Lm[i])*2.4),0,1);
  const mgs=box(mg,aw,ah,1),mthr=pct(mgs,opt.edge||.93);
  const W=600,H=Math.round(600*ar),sx=aw/W,k=opt.k||1,dens=opt.dens||1,gam=opt.gamma||1.15;
  const ix=(X,Y)=>cl(Y*sx|0,0,ah-1)*aw+cl(X*sx|0,0,aw-1);
  const dir=(X,Y)=>th[ix(X,Y)],dark=(X,Y)=>1-Ls[ix(X,Y)];
  const S={W:W,H:H,zones:[],guides:[],ink:[],isImage:true,img:img,
    sample:(X,Y)=>Math.hypot(X-W*.5,Y-H*.45)<W*.27};
  S.zones.push({label:'contorno',in:(X,Y)=>mgs[ix(X,Y)]>mthr,dir:dir,noArrow:1,keep:()=>.75,mark:{t:'stream',sp:8.5*k,len:30*k,w:3.3*k,xk:1.3,a:.95}},
    {label:'tracinho',in:()=>true,dir:dir,arrow:34,arrowIf:(X,Y)=>dark(X,Y)>.13,keep:(X,Y)=>cl(Math.pow(dark(X,Y),gam)*1.3*dens-.07,0,1),
     mark:{t:'stream',sp:7.4*k,len:18*k,w:2.3*k,xk:1,a:.88}});
  /* estrutura: curvas de nível do claro-escuro (marching squares) */
  const st=4,lv=[.32,.58,.8],P=(x,y)=>Lg[cl(y,0,ah-1)*aw+cl(x,0,aw-1)],o=1/sx;
  for(const t of lv)for(let y=0;y<ah-st;y+=st)for(let x=0;x<aw-st;x+=st){const a=P(x,y),b=P(x+st,y),cc=P(x+st,y+st),e=P(x,y+st);
    const id=(a>t?8:0)|(b>t?4:0)|(cc>t?2:0)|(e>t?1:0);if(id===0||id===15)continue;
    const T=(p,q)=>(t-p)/((q-p)||1e-6),top=[x+T(a,b)*st,y],rt=[x+st,y+T(b,cc)*st],bt=[x+T(e,cc)*st,y+st],lf=[x,y+T(a,e)*st];
    const seg=(p,q)=>S.guides.push({pts:[[p[0]*o,p[1]*o],[q[0]*o,q[1]*o]]});
    switch(id){case 1:case 14:seg(lf,bt);break;case 2:case 13:seg(bt,rt);break;case 3:case 12:seg(lf,rt);break;case 4:case 11:seg(top,rt);break;
      case 6:case 9:seg(top,bt);break;case 7:case 8:seg(lf,top);break;case 5:seg(lf,top);seg(bt,rt);break;case 10:seg(lf,bt);seg(top,rt);break}}
  S.field={dir:dir,dark:dark,coh:(X,Y)=>coh[ix(X,Y)]};
  return S}

function load(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('Não foi possível abrir a imagem'));im.src=src})}
G.VGAnalyze={analyze:analyze,load:load};
})(window);
