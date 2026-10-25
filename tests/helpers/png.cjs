// Minimal reader for the non-interlaced 8-bit RGB/RGBA PNG test samples.
const fs=require('node:fs');
const {inflateSync}=require('node:zlib');

function readPng(path){
 const png=fs.readFileSync(path);
 if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error(`Invalid PNG: ${path}`);
 let width,height,channels;const chunks=[];
 for(let offset=8;offset<png.length;){
  const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+length);
  if(type==='IHDR'){
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=data[9]===2?3:data[9]===6?4:0;
   if(data[8]!==8||!channels||data[10]||data[11]||data[12])throw Error(`Unsupported sample PNG format: ${path}`);
  }else if(type==='IDAT')chunks.push(data);
  offset+=length+12;if(type==='IEND')break;
 }
 const packed=inflateSync(Buffer.concat(chunks)),stride=width*channels,raw=Buffer.alloc(stride*height);
 if(packed.length!==(stride+1)*height)throw Error(`Invalid PNG scanlines: ${path}`);
 for(let y=0;y<height;y++){
  const filter=packed[y*(stride+1)];if(filter>4)throw Error(`Invalid PNG filter: ${path}`);
  for(let x=0;x<stride;x++){
   const i=y*stride+x,left=x>=channels?raw[i-channels]:0,up=y?raw[i-stride]:0,corner=y&&x>=channels?raw[i-stride-channels]:0;
   let predictor=0;
   if(filter===1)predictor=left;
   if(filter===2)predictor=up;
   if(filter===3)predictor=Math.floor((left+up)/2);
   if(filter===4){const p=left+up-corner,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-corner);predictor=a<=b&&a<=c?left:b<=c?up:corner;}
   raw[i]=(packed[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 const data=Buffer.alloc(width*height*4);
 for(let i=0,j=0;i<raw.length;i+=channels,j+=4){data[j]=raw[i];data[j+1]=raw[i+1];data[j+2]=raw[i+2];data[j+3]=channels===4?raw[i+3]:255;}
 return {w:width,h:height,data};
}

// Area averaging reduces width only; every original vertical coordinate survives.
function describe(image,width=192){
 const data=new Uint8ClampedArray(width*image.h*4),scale=image.w/width;
 for(let y=0;y<image.h;y++)for(let x=0;x<width;x++){
  const start=x*scale,end=(x+1)*scale,target=(y*width+x)*4;
  for(let k=0;k<3;k++){
   let sum=0;for(let sx=Math.floor(start);sx<Math.ceil(end);sx++){
    const weight=Math.min(end,sx+1)-Math.max(start,sx),p=(y*image.w+sx)*4,alpha=image.data[p+3]/255;
    sum+=(image.data[p+k]*alpha+255*(1-alpha))*weight;
   }
   data[target+k]=Math.round(sum/scale);
  }
  data[target+3]=255;
 }
 return {w:width,h:image.h,data};
}
module.exports={readPng,describe};
