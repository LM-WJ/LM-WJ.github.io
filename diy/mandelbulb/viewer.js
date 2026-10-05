(() => {
  'use strict';
  const {$, set, on}=Lab, canvas=$('c');
  let frame=null, lastDraw=null, angle=0, rotX=.4, rotY=0, drag=null;
  let paused=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let gl,program,buffer,uniforms,attribute,failed=false;
  const values=()=>({power:Number($('power').value),iters:Number($('iters').value),zoom:Number($('zoom').value),speed:Number($('speed').value)});
  function updateLabels(){const v=values();set('pv',v.power.toFixed(1));set('iv',v.iters);set('zv',v.zoom.toFixed(1));set('sv',v.speed.toFixed(2));set('stat-power',v.power.toFixed(1));set('stat-iters',v.iters);set('stat-zoom',v.zoom.toFixed(1));set('pbtn',paused?'继续自转':'暂停自转');$('pbtn').setAttribute('aria-pressed',String(paused));$('presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(v.power===Number(b.dataset.power)&&v.iters===Number(b.dataset.iters))));}
  function fail(){failed=true;if(frame!==null)cancelAnimationFrame(frame);frame=null;canvas.hidden=true;$('render-error').hidden=false;set('render-status','三维画面未能启用');$('bulb-controls').querySelectorAll('input,button').forEach(el=>el.disabled=true);$('pbtn').disabled=true;$('reset-view').disabled=true;}
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Shader compilation failed');}return s;}
  function requestDraw(){if(!failed&&frame===null&&!document.hidden)frame=requestAnimationFrame(draw);}
  function resize(){if(failed)return;const ratio=Math.min(window.devicePixelRatio||1,1.5),width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}requestDraw();}
  function draw(now){frame=null;if(document.hidden||failed)return;const v=values(),dt=lastDraw===null?0:Math.min((now-lastDraw)/1000,.1);lastDraw=now;if(!paused&&!drag)angle+=dt*v.speed;
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.enableVertexAttribArray(attribute);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    gl.uniform2f(uniforms.res,canvas.width,canvas.height);gl.uniform1f(uniforms.time,angle);gl.uniform1f(uniforms.speed,1);gl.uniform1f(uniforms.power,v.power);gl.uniform1f(uniforms.iters,v.iters);gl.uniform1f(uniforms.zoom,v.zoom);gl.uniform1f(uniforms.rotX,rotX);gl.uniform1f(uniforms.rotY,rotY);gl.uniform1f(uniforms.lightMode,SiteTheme.getMode()==='light'?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    set('render-status',paused||v.speed===0?'自转已停止 · 仍可拖动':'正在自转 · 拖动可调整视角');if(!paused&&v.speed>0&&!drag)requestDraw();
  }
  updateLabels();
  on('retry-render','click',()=>location.reload());
  try{
    gl=canvas.getContext('webgl',{antialias:false,alpha:false})||canvas.getContext('experimental-webgl',{alpha:false});if(!gl)throw new Error('WebGL unavailable');
    const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT),fragment=precision&&precision.precision?FS:FS.replace('precision highp float;','precision mediump float;');
    const vertexShader=shader(gl.VERTEX_SHADER,VS),fragmentShader=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vertexShader);gl.attachShader(program,fragmentShader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader linking failed');gl.deleteShader(vertexShader);gl.deleteShader(fragmentShader);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);attribute=gl.getAttribLocation(program,'p');uniforms=Object.fromEntries(['res','time','power','iters','zoom','rotX','rotY','speed','lightMode'].map(name=>[name,gl.getUniformLocation(program,name)]));
  }catch{fail();return;}
  ['power','iters','zoom','speed'].forEach(id=>on(id,'input',()=>{updateLabels();lastDraw=null;requestDraw();}));
  $('presets').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{$('power').value=b.dataset.power;$('iters').value=b.dataset.iters;updateLabels();requestDraw();}));
  on('pbtn','click',()=>{paused=!paused;lastDraw=null;updateLabels();requestDraw();});on('reset-view','click',()=>{rotX=.4;rotY=0;angle=0;$('zoom').value=2.5;updateLabels();requestDraw();});
  on('c','pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,rx:rotX,ry:rotY};canvas.setPointerCapture(e.pointerId);});
  on('c','pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;rotY=drag.ry+(e.clientX-drag.x)*.012;rotX=Math.max(-Math.PI/2,Math.min(Math.PI/2,drag.rx+(e.clientY-drag.y)*.012));requestDraw();});
  const release=()=>{drag=null;lastDraw=null;requestDraw();};on('c','pointerup',release);on('c','pointercancel',release);on('c','lostpointercapture',release);
  on('c','keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))return;e.preventDefault();if(e.key===' '){$('pbtn').click();return;}rotY+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;rotX=Math.max(-Math.PI/2,Math.min(Math.PI/2,rotX+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0)));requestDraw();});
  on('c','webglcontextlost',e=>{e.preventDefault();fail();});
  SiteTheme.subscribe(requestDraw);window.addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange',()=>{lastDraw=null;if(document.hidden){if(frame!==null)cancelAnimationFrame(frame);frame=null;}else requestDraw();});window.addEventListener('pagehide',()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;lastDraw=null;});window.addEventListener('pageshow',requestDraw);resize();
})();
