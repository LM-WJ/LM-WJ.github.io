(() => {
  'use strict';
  const { $,set,on }=Lab;
  const stars=Array.from({length:90},(_,i)=>{const x=(i*193+31)%680,y=(i*107+17)%330;return `<circle cx="${x}" cy="${y}" r="${i%7===0?1.5:.7}" fill="#b1d0dc" opacity="${.2+(i%5)*.13}"/>`;}).join('');
  const defs='<defs><radialGradient id="planet"><stop stop-color="#5bc2b8" offset="0"/><stop stop-color="#235870" offset=".55"/><stop stop-color="#102c42" offset="1"/></radialGradient><radialGradient id="sun"><stop stop-color="#ffefd1"/><stop offset=".7" stop-color="#efbc62"/><stop offset="1" stop-color="#cc7540"/></radialGradient><radialGradient id="glow"><stop stop-color="#e4b968" stop-opacity=".3"/><stop offset="1" stop-color="#e4b968" stop-opacity="0"/></radialGradient></defs>';
  function draw(k){
    let scene='',title,label;
    if(k<1.5){title=k<1?'尚未达到 I 型 · 行星尺度':'I 型以上 · 行星尺度';label='PLANETARY HORIZON';
      scene='<ellipse cx="340" cy="173" rx="206" ry="69" transform="rotate(-22 340 173)" fill="none" stroke="#7fc3c5" stroke-opacity=".3"/><circle cx="340" cy="173" r="88" fill="url(#planet)"/><path d="M295 111 Q352 119 330 156 T355 216 L383 224 Q374 180 402 153 L366 105Z" fill="#73b691" opacity=".45"/><path d="M272 171 Q311 174 300 215L321 248 Q276 236 261 193Z" fill="#79a995" opacity=".4"/>';
      for(let i=0;i<24;i++){const a=i*Math.PI/12,x=340+180*Math.cos(a),y=173+62*Math.sin(a);scene+=`<rect x="${x-4}" y="${y-3}" width="8" height="6" fill="${i/24<Math.min(1,k)?'#89ddd1':'#365464'}" transform="rotate(-22 340 173)"/>`;}
    } else if(k<2.5){title='II 型尺度 · 收集恒星能源';label='STELLAR COLLECTORS';scene='<circle cx="340" cy="173" r="155" fill="url(#glow)"/><circle cx="340" cy="173" r="59" fill="url(#sun)"/>';
      for(let ring=0;ring<3;ring++){const r=100+ring*30;scene+=`<ellipse cx="340" cy="173" rx="${r*1.5}" ry="${r*.55}" fill="none" stroke="#90794c" stroke-opacity=".6" transform="rotate(${ring*55-55} 340 173)"/>`;for(let i=0;i<12;i++){const a=i*Math.PI/6;scene+=`<rect x="${340+r*1.5*Math.cos(a)-5}" y="${173+r*.55*Math.sin(a)-3}" width="10" height="6" fill="#dcb565" transform="rotate(${ring*55-55} 340 173)"/>`;}}
    } else {title=k>=3?'III 型 · 星系尺度':'迈向 III 型 · 星系尺度';label='GALACTIC NETWORK';scene='<ellipse cx="340" cy="173" rx="245" ry="88" fill="#7f91a4" opacity=".07" transform="rotate(-15 340 173)"/><circle cx="340" cy="173" r="72" fill="url(#glow)"/>';
      for(let i=0;i<400;i++){const arm=i%3,r=8+Math.sqrt(i/400)*240,a=arm*Math.PI*2/3+r*.019;const x=340+Math.cos(a)*r,y=173+Math.sin(a)*r*.43;scene+=`<circle cx="${x}" cy="${y}" r="${i%11===0?2:1}" fill="${i%4===0?'#e6c78e':'#99bfdf'}" opacity="${.2+(i%7)*.1}"/>`;}
    }
    $('cosmos').innerHTML='<title>'+title+'</title>'+defs+stars+scene;set('scene-title',title);set('cosmos-label',label);
  }
  function update(exponent,sync=true){const k=(exponent-6)/10,p=10**exponent,next=k<1?1:k<2?2:3,ratio=10**(next*10+6-exponent);set('level',k.toFixed(2));$('power').innerHTML=`10<sup>${exponent.toFixed(2)}</sup>`;set('exponent-label','10^'+exponent.toFixed(2)+' W');$('scale-marker').style.left=(k/3*100)+'%';set('gap',ratio<10000?ratio.toLocaleString('zh-CN',{maximumFractionDigits:1}):'10^'+Math.log10(ratio).toFixed(1));set('gap-label',k>=3?'已达到 III 型参照':`到 ${['','I','II','III'][next]} 型的功率倍数`);set('level-statement',`K = (log₁₀ P − 6) / 10。当前功率约为 ${p.toExponential(2)} W；滑尺每移动 1 个指数单位，功率增大 10 倍。`);if(sync){$('exponent').value=exponent;$('custom-power').value=p.toExponential(3);}set('power-error','');draw(k);$('presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.p)-exponent)<.01)));}
  on('exponent','input',()=>update(Number($('exponent').value)));
  $('presets').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>update(Number(b.dataset.p))));
  on('power-form','submit',e=>{e.preventDefault();const raw=$('custom-power').value.trim(),v=Number(raw);if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)||!Number.isFinite(v)||v<1e6||v>1e36){set('power-error','请输入 10⁶ 到 10³⁶ 之间的正功率，例如 2e13。');return;}update(Math.log10(v),false);$('exponent').value=Math.log10(v);});
  update(Math.log10(2e13));
})();
