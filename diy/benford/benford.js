(() => {
  'use strict';
  const { $, set, on, num } = Lab;
  const expected = Array.from({length:9},(_,i)=>Math.log10(1+1/(i+1)));
  const notes = {log:'对数均匀样本：10 的指数在 0 到 6 之间等概率抽取；有限样本仍有波动。',uniform:'等概率抽取 1 到 9999 的整数。各首位数字的候选数量相同，分布通常接近 1/9。',growth:'从 1 开始，每一步乘以 1.03。用对数计算首位数字，避免大数溢出。',fib:'从 1、1 开始的斐波那契数列；使用精确大整数提取首位数字。',custom:'统计你输入的有限非零数字。不符合班福德分布不代表数据有问题。'};
  const leadingDigit = n => Number(Math.abs(n).toExponential()[0]);
  function render(counts, ignored=0, tokens=0) {
    const total=counts.reduce((a,b)=>a+b,0),p=counts.map(n=>total?n/total:0),max=Math.max(.35,Math.ceil(Math.max(...p)*10)/10),bottom=281,height=225;
    let svg='<title>首位数字分布：实际比例与班福德理论值</title>';
    for(let i=0;i<=4;i++){const v=max*i/4,y=bottom-v/max*height;svg+=`<line class="grid-line" x1="44" x2="645" y1="${y}" y2="${y}"/><text class="axis-text" x="36" y="${y+4}" text-anchor="end">${(v*100).toFixed(0)}%</text>`;}
    counts.forEach((count,i)=>{const x=58+i*66,h=p[i]/max*height,ey=bottom-expected[i]/max*height;svg+=`<rect x="${x}" y="${bottom-h}" width="35" height="${h}" rx="5" fill="var(--accent)"><title>${i+1}：${count} 个，${(p[i]*100).toFixed(2)}%</title></rect><line x1="${x-3}" x2="${x+38}" y1="${ey}" y2="${ey}" stroke="#a17c42" stroke-width="3"/><text class="axis-text" x="${x+17}" y="309" text-anchor="middle">${i+1}</text><text class="axis-text" x="${x+17}" y="${Math.max(24,bottom-h-10)}" text-anchor="middle">${(p[i]*100).toFixed(1)}%</text>`;});
    $('chart').innerHTML=svg;$('digit-table').innerHTML=counts.map((n,i)=>`<tr><td>${i+1}</td><td>${num(n)}</td><td>${(p[i]*100).toFixed(2)}%</td><td>${(expected[i]*100).toFixed(2)}%</td></tr>`).join('');
    set('valid-count',num(total));set('first-one',total?(p[0]*100).toFixed(1)+'%':'—');set('deviation',total?(p.reduce((s,v,i)=>s+Math.abs(v-expected[i]),0)*100/9).toFixed(2):'—');set('dataset-note',notes[$('dataset').value]);set('input-status',$('dataset').value==='custom'?`读取 ${num(tokens)} 项；忽略 ${num(ignored)} 项零值、非法数字或超出数值范围的输入。`:'');
  }
  function generate(){
    const kind=$('dataset').value,n=Number($('sample-size').value),counts=Array(9).fill(0);set('dataset-label',$('dataset').selectedOptions[0].textContent);
    if(kind==='custom'){const raw=$('custom-data').value.trim(),tokens=raw?raw.split(/[\s,，;；、]+/).filter(Boolean):[];let ignored=0;tokens.forEach(token=>{const valid=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token),v=Number(token);if(!valid||!Number.isFinite(v)||v===0){ignored++;return;}counts[leadingDigit(v)-1]++;});render(counts,ignored,tokens.length);return;}
    if(kind==='fib'){let a=1n,b=1n;for(let i=0;i<n;i++){counts[Number(a.toString()[0])-1]++;[a,b]=[b,a+b];}}
    else for(let i=0;i<n;i++){let digit;if(kind==='log')digit=leadingDigit(10**(Math.random()*6));else if(kind==='uniform')digit=leadingDigit(1+Math.floor(Math.random()*9999));else{const log=i*Math.log10(1.03);digit=Math.min(9,Math.floor(10**(log-Math.floor(log))+1e-12));}counts[digit-1]++;}render(counts);
  }
  on('dataset','change',()=>{$('custom-control').hidden=$('dataset').value!=='custom';$('sample-control').hidden=$('dataset').value==='custom';set('generate',$('dataset').value==='custom'?'分析这些数字':'重新生成');generate();});on('sample-size','change',generate);on('generate','click',generate);generate();
})();
