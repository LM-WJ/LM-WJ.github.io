(() => {
  'use strict';
  const {$,set,on,pressed}=Lab,total=24,replaced=Array(total).fill(false);let vote=null;
  function boat(isA,rebuild){let svg='<path d="M180 20V147" stroke="var(--ink)" stroke-width="4" opacity=".5"/><path d="M188 29L285 128H188Z" fill="var(--panel)" stroke="var(--line)" stroke-width="2"/><path d="M170 50L110 127H170Z" fill="var(--panel)" stroke="var(--line)" stroke-width="2"/><path d="M23 158 Q50 225 180 229 Q310 225 337 158" fill="none" stroke="var(--line)" stroke-width="3"/>';
    for(let row=0;row<4;row++){const width=310-row*36,x=25+row*18;for(let col=0;col<6;col++){const i=row*6+col,filled=isA||replaced[i],color=isA?(replaced[i]?'#149a91':'#ad8650'):'#ad8650',w=width/6-3,y=150+row*18;
      svg+=`<rect x="${x+col*width/6}" y="${y}" width="${w}" height="15" rx="3" fill="${filled?color:'none'}" stroke="${filled?color:'var(--muted)'}" stroke-dasharray="${filled?'0':'3 3'}" opacity="${filled?1:.3}" ${isA?`role="button" tabindex="0" data-board="${i}" aria-label="第 ${i+1} 块船板，${replaced[i]?'新木板，点击恢复原板':'原始木板，点击替换'}"`:''}><title>第 ${i+1} 块 · ${filled?(isA&&replaced[i]?'新板':'原板'):'尚未收集'}</title></rect>`;
    }}return !isA&&!rebuild?'<text x="180" y="110" text-anchor="middle" class="axis-text">旧木板暂存中</text>'+svg.slice(svg.indexOf('<rect')):svg;
  }
  function render(message){const n=replaced.filter(Boolean).length,rebuild=$('rebuild').checked;
    // Remember the focused plank across SVG updates so keyboard users can continue.
    const focused=document.activeElement&&document.activeElement.dataset.board;
    $('boat-a').innerHTML=boat(true,true);$('boat-b').innerHTML=boat(false,rebuild);
    if(focused!==undefined)$('boat-a').querySelector(`[data-board="${focused}"]`).focus();
    $('replacement').value=n;set('replacement-label',`${n} / ${total}`);set('a-material',`原始木板 ${total-n} / ${total} · ${((total-n)/total*100).toFixed(0)}%`);set('b-material',`${rebuild?'已收集':'暂存'}原始木板 ${n} / ${total}`);$('a-meter').style.width=(total-n)/total*100+'%';$('b-meter').style.width=n/total*100+'%';set('b-title',rebuild?'B · 旧板重建的船':'B · 拆下来的原始材料');set('b-note',!rebuild?'还没有开始重建':n===total?'原始材料齐全，但重建历史不同':'仍在重建，尚未形成完整船只');$('replace-next').disabled=n===total;set('boat-status',message||`已经替换 ${n} 块。${n===total?'A 的所有木板都变了，航行的历史却延续下来。':'点击 A 船中的木板，可以替换或撤回。'}`);
    const notes={history:'重视历史连续性：A 的航行和修理一直延续；B 的组装开启了另一段历史。',material:`重视原始材料：A 保留 ${total-n} 块，${rebuild?'B 收集':'仓库暂存'} ${n} 块。你会在哪里划定“还是原物”的界线？`,form:n===total&&rebuild?'重视形状与功能：A 与 B 都完整了。形状相同就代表同一个物体吗？':'重视形状与功能：A 仍是一艘完整船；旧板还在收集。等重建完成，再比较两艘船。'};set('criterion-note',notes[$('criterion').value]);
    set('vote-result',vote?`你的选择：${{A:'A · 一直航行的船',B:'B · 旧板重建的船',both:'两艘都是',neither:'两艘都不是'}[vote]}。继续换板，看看自己的判断会不会改变。`:'这是你的个人选择，没有排行榜或多数人的正确答案。');
  }
  function toggleBoard(target){const board=target.closest('[data-board]');if(!board)return;const i=Number(board.dataset.board);replaced[i]=!replaced[i];render(`第 ${i+1} 块木板${replaced[i]?'已替换，旧板转入收集区':'已恢复，撤回了这一步替换'}。`);}
  on('boat-a','click',e=>toggleBoard(e.target));on('boat-a','keydown',e=>{if(e.target.hasAttribute('data-board')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();toggleBoard(e.target);}});on('replacement','input',()=>{const n=Number($('replacement').value);replaced.forEach((_,i)=>replaced[i]=i<n);render();});on('replace-next','click',()=>{const i=replaced.indexOf(false);if(i>=0){replaced[i]=true;render();}});on('reset','click',()=>{replaced.fill(false);vote=null;$('votes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));render();});on('rebuild','change',()=>render());on('criterion','change',()=>render());$('votes').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{vote=b.dataset.vote;pressed('votes',b);render();}));render();
})();
