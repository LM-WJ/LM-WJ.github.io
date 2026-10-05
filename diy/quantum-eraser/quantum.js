(() => {
  'use strict';
  const {$,set,on,num,pressed}=Lab;
  const bins=64,limit=20000,events=[];let filter='all',timer=null;
  const envelope=x=>Math.exp(-x*x/0.36),cos=x=>Math.cos(8*Math.PI*x);
  const included=e=>filter==='all'||filter===e.detector||(filter==='D12'&&(e.detector==='D1'||e.detector==='D2'));
  function stop(){if(timer!==null)clearInterval(timer);timer=null;set('play','连续发射');}
  function generate(n){for(let i=0;i<n&&events.length<limit;i++){let x;do{x=Math.random()*2-1;}while(Math.random()>envelope(x));const c=cos(x),r=Math.random();const detector=r<(1+c)/4?'D1':r<.5?'D2':r<.75?'D3':'D4';events.push({x,detector,id:events.length});}if(events.length>=limit)stop();render();}
  function render(){const selected=events.filter(included),counts=Array(bins).fill(0);selected.forEach(e=>counts[Math.min(bins-1,Math.floor((e.x+1)/2*bins))]++);
    const weights=Array.from({length:bins},(_,i)=>{const x=(i+.5)/bins*2-1;return envelope(x)*(filter==='D1'?1+cos(x):filter==='D2'?1-cos(x):1);}),sum=weights.reduce((s,v)=>s+v,0),expected=weights.map(w=>w/sum*selected.length),max=Math.max(10,...counts,...expected)*1.12;
    let svg='<title>屏幕落点：'+filter+' 分组的累计计数</title>';for(let i=0;i<=3;i++){const y=195-i*55;svg+=`<line class="grid-line" x1="40" x2="644" y1="${y}" y2="${y}"/><text class="axis-text" x="33" y="${y+4}" text-anchor="end">${Math.round(max*i/3)}</text>`;}
    counts.forEach((n,i)=>{const h=n/max*165;svg+=`<rect x="${42+i*9.375}" y="${195-h}" width="7.5" height="${h}" rx="1" fill="var(--accent)" opacity=".65"/>`;});
    if(selected.length)svg+=`<polyline points="${expected.map((n,i)=>`${45.75+i*9.375},${195-n/max*165}`).join(' ')}" fill="none" stroke="#af7c43" stroke-width="2.2"/>`;
    svg+='<text class="axis-text" x="42" y="222">−1</text><text class="axis-text" x="340" y="222" text-anchor="middle">屏幕位置 x</text><text class="axis-text" x="640" y="222" text-anchor="end">+1</text>';$('histogram').innerHTML=svg;
    $('event-screen').innerHTML='<title>最近的落点，筛选不会移动已有记录</title>'+selected.slice(-180).map(e=>`<circle cx="${42+(e.x+1)*300}" cy="${8+(e.id*37)%48}" r="2" fill="var(--accent)" opacity=".7"/>`).join('');
    set('total-count',num(events.length));set('selected-count',num(selected.length));set('selected-share',events.length?(selected.length/events.length*100).toFixed(1)+'%':'—');
    const titles={all:'全部信号事件',D1:'D1 关联子样本',D2:'D2 关联子样本',D3:'D3 关联子样本',D4:'D4 关联子样本',D12:'D1 + D2 的合并样本'};set('view-title',titles[filter]);set('view-note',filter==='all'?'未筛选':'按伙伴探测结果筛选');
    const messages={all:'所有探测分组叠加后，互补干涉项抵消，只剩平滑包络。',D1:'D1 的关联分布出现条纹。切换到 D2，会看到峰谷交换位置。',D2:'D2 的条纹与 D1 相位相反。两者合并后，干涉项抵消。',D3:'D3 分组可区分路径，理论分布中没有干涉项。',D4:'D4 分组可区分路径，理论分布中没有干涉项。',D12:'D1 与 D2 的干涉项互补：E(x)(1+c) + E(x)(1−c) = 2E(x)。'};set('interpretation',selected.length?messages[filter]:'目前没有该分组的事件。点击“+ 1,000 对”开始记录。');
    $('add').disabled=events.length>=limit;$('play').disabled=events.length>=limit;set('run-status',events.length>=limit?'已记录 20,000 对，清空后可重新开始。':timer!==null?'正在积累事件；可以随时切换分组或暂停。':'每次实验最多记录 20,000 对。');
  }
  $('filters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;pressed('filters',b);render();}));on('add','click',()=>generate(1000));on('reset','click',()=>{stop();events.length=0;render();});on('play','click',()=>{if(timer!==null){stop();render();return;}timer=setInterval(()=>generate(120),180);set('play','暂停发射');render();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();render();}});window.addEventListener('pagehide',stop);generate(2000);
})();
