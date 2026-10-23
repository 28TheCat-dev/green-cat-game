/* alpha 轮廓 → 内接圆近似。基于原项目 build_parts.py 的距离变换与贪心铺圆。 */
(function () {
  'use strict';
  // 只排除悬浮的文字与符号，不抠除衣服表面的印字。
  const excludes = [[],[],[[0,120,125,130],[395,215,117,120]],[[0,0,512,152]],[[0,190,85,125]],[[0,0,512,100]],[],[],[],[],[]];
  function maskFor(image, level, strokes) {
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,512,512);ctx.globalCompositeOperation='destination-out';
    for(const rect of excludes[level])ctx.fillRect(...rect);
    for(const s of strokes){ctx.beginPath();ctx.arc(s[0],s[1],s[2],0,Math.PI*2);ctx.fill();}
    return {canvas:c, data:ctx.getImageData(0,0,512,512).data};
  }
  function generate(image, level, strokes) {
    const {data}=maskFor(image,level,strokes), N=512, mask=new Uint8Array(N*N), d=new Float32Array(N*N);
    let total=0;
    for(let i=0;i<mask.length;i++){
      mask[i]=data[i*4+3]>128?1:0;total+=mask[i];
      // 图像边界之外也视为透明，防止满边主体产生无穷半径。
      d[i]=mask[i]?Math.min(10000,i%N+1,N-i%N,Math.floor(i/N)+1,N-Math.floor(i/N)):0;
    }
    if(total<100)throw Error('主体范围太小，请重置蒙版后重试。');
    const diagonal=Math.SQRT2;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const i=y*N+x;if(!mask[i])continue;
      if(x)d[i]=Math.min(d[i],d[i-1]+1);
      if(y){d[i]=Math.min(d[i],d[i-N]+1);if(x)d[i]=Math.min(d[i],d[i-N-1]+diagonal);if(x<N-1)d[i]=Math.min(d[i],d[i-N+1]+diagonal);}
    }
    for(let y=N-1;y>=0;y--)for(let x=N-1;x>=0;x--){
      const i=y*N+x;if(!mask[i])continue;
      if(x<N-1)d[i]=Math.min(d[i],d[i+1]+1);
      if(y<N-1){d[i]=Math.min(d[i],d[i+N]+1);if(x)d[i]=Math.min(d[i],d[i+N-1]+diagonal);if(x<N-1)d[i]=Math.min(d[i],d[i+N+1]+diagonal);}
    }
    const covered=new Uint8Array(N*N), circles=[];let placed=0;
    for(let k=0;k<9 && placed<total*.97;k++){
      let best=-1, r=0;
      for(let i=0;i<d.length;i++)if(mask[i]&&!covered[i]&&d[i]>r){r=d[i];best=i;}
      if(best<0||r<8)break;
      const x=best%N,y=Math.floor(best/N);circles.push([x,y,r]);
      for(let py=Math.max(0,Math.floor(y-r));py<=Math.min(N-1,Math.ceil(y+r));py++)
        for(let px=Math.max(0,Math.floor(x-r));px<=Math.min(N-1,Math.ceil(x+r));px++)
          if((px-x)**2+(py-y)**2<=r*r){const i=py*N+px;if(!covered[i]&&mask[i])placed++;covered[i]=1;}
    }
    return {parts:circles.map(window.CatCollision.fromPixels),recall:placed/total};
  }
  window.CatOutline={excludes,maskFor,generate};
})();
