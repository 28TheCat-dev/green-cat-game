(function () {
  'use strict';
  const C = window.CatCollision, $ = id => document.getElementById(id);
  const canvas = $('editor'), ctx = canvas.getContext('2d');
  const PAD = 64, defaults = C.clone(window.SUIKA_PARTS), O = window.CatOutline;
  const MASK_KEY='green-cat.exclusions.v1';
  let strokes=Array.from({length:11},()=>[]);
  try { const saved=JSON.parse(localStorage.getItem(MASK_KEY)); if(Array.isArray(saved)&&saved.length===11&&saved.every(a=>Array.isArray(a)&&a.length<20000&&a.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&p[2]>0)))strokes=saved; } catch(_) {}
  let shapes = C.read(defaults), level = 0, selected = 0, dirty = false, drag = null;
  const images = Array.from({length:11}, (_, i) => {
    const im = new Image(); im.onload = draw;
    im.onerror = () => status('图片 '+(i+1)+'.png 加载失败，请保留原文件夹结构。', true);
    im.src = window.CAT_IMAGE_DATA[i]; return im;
  });
  const levelButtons = images.map((im, i) => {
    const b = document.createElement('button'); b.type = 'button';
    const thumb = document.createElement('img'); thumb.src = '../图/'+(i+1)+'.png'; thumb.alt = '';
    const label = document.createElement('span'); label.textContent = (i+1)+'.png';
    const small = document.createElement('small'); small.textContent = '等级 '+(i+1);label.append(small);
    b.append(thumb,label); b.onclick = () => { level=i;selected=0;sync(); }; $('levels').append(b);return b;
  });
  function status(text, error=false) { $('status').textContent=text; $('status').classList.toggle('error',error); }
  function sync() {
    levelButtons.forEach((b,i) => {b.classList.toggle('active',i===level);b.setAttribute('aria-pressed',String(i===level));});
    $('levelTag').textContent = 'LEVEL '+String(level+1).padStart(2,'0'); $('imageName').textContent=(level+1)+'.png';
    $('circleSelect').replaceChildren(...shapes[level].parts.map((_,i) => new Option('碰撞圆 '+(i+1),i)));
    $('circleSelect').value=selected;
    $('partCount').textContent=shapes[level].parts.length+' 个圆';
    const p=C.toPixels(shapes[level].parts[selected]);
    ['cx','cy','radius'].forEach((id,i) => $(id).value=+p[i].toFixed(2));
    $('radiusSlider').value=p[2]; $('remove').disabled=shapes[level].parts.length===1;
    $('add').disabled=shapes[level].parts.length>=16;
    $('code').textContent=JSON.stringify(shapes[level],null,2);
    draw();
  }
  function commit(parts) {
    try {
      const next=C.clone(shapes);next[level]={parts};shapes=C.validate(next);
      dirty=true;status('有未保存的修改。满意后点击“保存并试玩”。');sync();return true;
    } catch(e) {status(e.message,true);return false;}
  }
  function updateCircle(p) {
    const parts=C.clone(shapes[level].parts);parts[selected]=C.fromPixels(p);return commit(parts);
  }
  function draw() {
    ctx.clearRect(0,0,640,640);
    for(let y=0;y<640;y+=20) for(let x=0;x<640;x+=20) {
      ctx.fillStyle=((x+y)/20)%2?'#f4f7ed':'#eaf0e2';ctx.fillRect(x,y,20,20);
    }
    // 与游戏一致：整幅 512×512 图以中心对齐，不自动裁切透明边距。
    const im=images[level];if(im && im.complete && im.naturalWidth)ctx.drawImage(im,PAD,PAD,512,512);
    ctx.save();ctx.beginPath();ctx.rect(PAD,PAD,512,512);ctx.clip();
    ctx.fillStyle='rgba(222,72,58,.28)';
    for(const rect of O.excludes[level])ctx.fillRect(PAD+rect[0],PAD+rect[1],rect[2],rect[3]);
    for(const s of strokes[level]){ctx.beginPath();ctx.arc(PAD+s[0],PAD+s[1],s[2],0,Math.PI*2);ctx.fill();}
    ctx.restore();
    ctx.strokeStyle='#9da995';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.strokeRect(PAD,PAD,512,512);
    ctx.beginPath();ctx.moveTo(320,50);ctx.lineTo(320,590);ctx.moveTo(50,320);ctx.lineTo(590,320);ctx.stroke();ctx.setLineDash([]);
    if($('bounds').checked) {
      ctx.strokeStyle='#d19b43';ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(320,320,shapes[level].rb*C.UNIT,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    shapes[level].parts.forEach((part,i) => {
      const [px,py,r]=C.toPixels(part),x=PAD+px,y=PAD+py,active=i===selected;
      ctx.fillStyle=active?'rgba(57,151,106,.2)':'rgba(80,120,190,.12)';ctx.strokeStyle=active?'#1c8d61':'#5785b0';ctx.lineWidth=active?3:2;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=active?'#0d6e49':'#5785b0';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      ctx.font='bold 13px Segoe UI';ctx.fillText(String(i+1),x+9,y-9);
      if(active){ctx.beginPath();ctx.arc(x+r,y,8,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.stroke();}
    });
  }
  function point(e){const b=canvas.getBoundingClientRect();return [(e.clientX-b.left)*640/b.width-PAD,(e.clientY-b.top)*640/b.height-PAD];}
  canvas.addEventListener('pointerdown',e => {
    if($('eraseMask').checked){drag={mode:'erase'};eraseAt(e);canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
    const [x,y]=point(e), parts=shapes[level].parts;
    const current=C.toPixels(parts[selected]);
    if(Math.hypot(x-current[0]-current[2],y-current[1])<16){drag={mode:'resize',start:current};}
    else{
      let hit=-1;
      // 优先当前圆，重叠时可用下拉框选择被覆盖的圆。
      if(Math.hypot(x-current[0],y-current[1])<=current[2])hit=selected;
      else for(let i=parts.length-1;i>=0;i--){const p=C.toPixels(parts[i]);if(Math.hypot(x-p[0],y-p[1])<=p[2]){hit=i;break;}}
      if(hit<0)return; selected=hit;const p=C.toPixels(parts[hit]);drag={mode:'move',dx:x-p[0],dy:y-p[1],start:p};sync();
    }
    canvas.setPointerCapture(e.pointerId);e.preventDefault();
  });
  canvas.addEventListener('pointermove',e => {
    if(drag && drag.mode==='erase'){eraseAt(e);return;}
    if(!drag)return;const [x,y]=point(e),p=drag.start.slice();
    if(drag.mode==='move'){p[0]=Math.max(0,Math.min(512,x-drag.dx));p[1]=Math.max(0,Math.min(512,y-drag.dy));}
    else p[2]=Math.max(8,Math.min(256,Math.hypot(x-p[0],y-p[1])));
    updateCircle(p);
  });
  function stop(){drag=null;}
  canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
  canvas.addEventListener('wheel',e => {e.preventDefault();const p=C.toPixels(shapes[level].parts[selected]);p[2]=Math.max(8,Math.min(256,p[2]+(e.deltaY<0?2:-2)));updateCircle(p);},{passive:false});
  $('circleSelect').onchange=()=>{selected=Number($('circleSelect').value);sync();};
  ['cx','cy','radius'].forEach(id => $(id).addEventListener('change',()=>{
    const p=['cx','cy','radius'].map(id=>$(id).valueAsNumber);
    if(!p.every(Number.isFinite)||p[0]<0||p[0]>512||p[1]<0||p[1]>512||p[2]<8||p[2]>256){status('圆心需在 0～512 内，半径需在 8～256 内。',true);sync();return;}
    if(!updateCircle(p))sync();
  }));
  $('radiusSlider').oninput=()=>{const p=C.toPixels(shapes[level].parts[selected]);p[2]=Number($('radiusSlider').value);updateCircle(p);};
  $('bounds').onchange=draw;
  function eraseAt(e){
    const [x,y]=point(e);if(x<0||y<0||x>512||y>512)return;
    const list=strokes[level],r=Number($('brush').value),last=list[list.length-1];
    // 连续插值，快速拖动时也不漏掉文字笔画。
    if(last&&drag.last){const distance=Math.hypot(x-last[0],y-last[1]),n=Math.ceil(distance/Math.max(2,r/3));for(let i=1;i<n;i++)list.push([last[0]+(x-last[0])*i/n,last[1]+(y-last[1])*i/n,r]);}
    list.push([x,y,r]);drag.last=true;dirty=true;draw();status('红色区域已排除。请点击“按主体轮廓生成”，再保存试玩。');
  }
  $('autoOutline').onclick=()=>{
    if(!images[level].complete||!images[level].naturalWidth){status('请等待图片加载完成。',true);return;}
    try{const result=O.generate(images[level],level,strokes[level]);selected=0;if(commit(result.parts))status('已按主体生成 '+result.parts.length+' 个圆，覆盖约 '+Math.round(result.recall*100)+'%；已排除红色区域。可继续手动微调。');}
    catch(e){status('轮廓生成失败：'+e.message,true);}
  };
  $('resetMask').onclick=()=>{strokes[level]=[];dirty=true;draw();status('已清除本图手动擦除，保留预设的文字/符号排除区；请重新生成。');};
  $('add').onclick=()=>{const parts=C.clone(shapes[level].parts);parts.push([0,0,0.3]);selected=parts.length-1;commit(parts);};
  $('remove').onclick=()=>{if(shapes[level].parts.length<2)return;const parts=C.clone(shapes[level].parts);parts.splice(selected,1);selected=0;commit(parts);};
  $('resetShape').onclick=()=>{selected=0;commit([[0,0,1]]);};
  $('applyPixels').onclick=()=>{
    try{
      const pixels=JSON.parse($('pixelInput').value);
      if(!Array.isArray(pixels)||!pixels.length||pixels.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||p[0]<0||p[0]>512||p[1]<0||p[1]>512||p[2]<8||p[2]>256))throw Error('请输入 [[圆心X,圆心Y,半径], ...]；圆心 0～512，半径 8～256。');
      const previous=selected;selected=0;if(!commit(pixels.map(C.fromPixels)))selected=previous;
    }catch(e){status(e.message,true);}
  };
  function save(){
    try{shapes=C.validate(shapes);localStorage.setItem(C.KEY,JSON.stringify(shapes));localStorage.setItem(MASK_KEY,JSON.stringify(strokes));dirty=false;status('已保存全部 11 级。试玩会使用这套设置；分享游戏请下载 parts.js。');return true;}
    catch(e){status('浏览器保存失败。仍可试玩或下载 parts.js：'+e.message,true);return false;}
  }
  $('save').onclick=save;
  function sendPreview(){const win=$('gameFrame').contentWindow;if(win)win.postMessage({type:'green-cat-preview',shapes:C.clone(shapes),show:$('showCollision').checked},'*');}
  $('play').onclick=()=>{save();$('preview').showModal();$('gameFrame').src='index.html';};
  $('gameFrame').onload=sendPreview;
  $('showCollision').onchange=()=>{$('gameFrame').contentWindow.postMessage({type:'green-cat-display',show:$('showCollision').checked},'*');};
  function closePreview(){$('preview').close();}
  $('closePreview').onclick=closePreview;
  $('preview').addEventListener('close',()=>{$('gameFrame').src='about:blank';});
  $('export').onclick=()=>{
    const content='/* 合成大绿猫：顺序对应 图/1.png～11.png。单位为各级基础半径。 */\nwindow.SUIKA_PARTS = '+JSON.stringify(C.validate(shapes),null,2)+';\n';
    const url=URL.createObjectURL(new Blob([content],{type:'text/javascript;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='parts.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('已请求下载 parts.js。将下载文件替换到 v1/assets/fruits/parts.js 即可分享使用。');
  };
  $('import').onclick=()=>$('importFile').click();
  $('importFile').onchange=async()=>{
    const file=$('importFile').files[0];if(!file)return;
    try{
      if(file.size>1000000)throw Error('配置文件太大。');
      let text=(await file.text()).trim();
      if(!text.startsWith('[')){
        const match=text.match(/window\.SUIKA_PARTS\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
        if(!match)throw Error('需要 JSON 数组或 window.SUIKA_PARTS = [...] 格式。');text=match[1];
      }
      // 只解析 JSON，不执行导入文件中的 JavaScript。
      const next=C.validate(JSON.parse(text));shapes=next;level=0;selected=0;dirty=true;sync();status('已导入 11 级参数，点击保存或试玩。');
    }catch(e){status('导入失败：'+e.message,true);}finally{$('importFile').value='';}
  };
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  sync();
})();
