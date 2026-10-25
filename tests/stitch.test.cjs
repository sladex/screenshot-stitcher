// Run with: node --test tests/stitch.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
test('script keeps its declarations out of the global scope',()=>{
 const sandbox=vm.createContext({document:{getElementById:()=>({addEventListener(){}})}});
 vm.runInContext(source,sandbox);
 for(const name of ['$', 'state', 'collator', 'pause', 'select', 'surface', 'decode', 'describe', 'rowDiff', 'alignmentDiff', 'texture', 'prepare', 'activityRange', 'findMotion', 'boundaries', 'chooseSeam']){
  assert.equal(Object.hasOwn(sandbox,name),false,name);
  assert.equal(vm.runInContext(`typeof ${name}`,sandbox),'undefined',name);
 }
});

const context={pause:async()=>{},Math};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function rowDiff'),source.indexOf("$('size').addEventListener"))+';this.api={prepare,findMotion,boundaries,chooseSeam};',context);
const {prepare,findMotion,boundaries,chooseSeam}=context.api;
function frame(offset,{top=70,bottom=50,clock=0,period=0,blank=false}={}){
 const w=64,h=600,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const fixed=y<top||y>=h-bottom;let yy=fixed?y:y+offset;if(period&&!fixed)yy%=period;
  let v=fixed?30+x%9:((Math.imul(yy+13,2654435761)>>>17)+x*13+(yy%31)*x)%256;
  if(y<12&&x<8)v=(v+clock*47)%256;if(blank)v=240;
  const p=(y*w+x)*4;data[p]=v;data[p+1]=v*3%256;data[p+2]=v*7%256;data[p+3]=255;
 }
 return prepare({w,h,data});
}
test('variable scroll, changing clock, exact viewport and seams',async()=>{
 const frames=[frame(0),frame(153,{clock:1}),frame(370,{clock:2})];const matches=[];
 for(let i=1;i<frames.length;i++)matches.push(await findMotion(frames[i-1],frames[i]));
 assert.deepEqual(matches.map(m=>m.shift),[153,217]);const bounds=boundaries(frames,matches);assert.equal(bounds.top,70);assert.equal(bounds.bottom,50);
 let offset=0,lastCut=0;for(let i=0;i<matches.length;i++){const m=matches[i];offset+=m.shift;const seam=chooseSeam(frames[i],frames[i+1],m,70,550,Math.max(70,lastCut-offset));assert.ok(seam>=70&&seam<=550-m.shift);lastCut=offset+seam;
 // Every selected output row maps to the same content coordinate on both sides.
 for(let x=0;x<64*4;x++)assert.equal(frames[i].data[(seam+m.shift)*256+x],frames[i+1].data[seam*256+x]);}
});
test('large scroll with short overlap',async()=>{assert.equal((await findMotion(frame(0),frame(410))).shift,410);});
test('no fixed regions',async()=>{const a=frame(0,{top:0,bottom:0}),b=frame(211,{top:0,bottom:0});const m=await findMotion(a,b);const bounds=boundaries([a,b],[m]);assert.equal(m.shift,211);assert.equal(bounds.top,0);assert.equal(bounds.bottom,0);});
test('identical images add no content',async()=>{assert.equal((await findMotion(frame(0),frame(0))).shift,0);});
test('periodic content is rejected rather than guessed',async()=>{await assert.rejects(findMotion(frame(0,{period:40}),frame(113,{period:40})),/reliably determine/);});
test('no overlap is rejected',async()=>{await assert.rejects(findMotion(frame(0),frame(10000)),/reliably determine/);});
test('identical blank images add no content',async()=>{assert.equal((await findMotion(frame(0,{blank:true}),frame(10,{blank:true}))).shift,0);});

// Read source PNGs and compare the full-resolution output with stitched.png.
const path=require('node:path');
const {readPng,describe}=require('./helpers/png.cjs');
const samples=path.join(__dirname,'samples');
for(const folder of fs.readdirSync(samples).filter(name=>/^\d-/.test(name)).sort())test(`real screenshots: ${folder}`,async()=>{
 const directory=path.join(samples,folder);
 const originals=fs.readdirSync(directory).filter(name=>/^Screenshot_.*\.png$/.test(name)).sort().map(name=>readPng(path.join(directory,name)));
 const expected=readPng(path.join(directory,'stitched.png'));
 const frames=originals.map(image=>prepare(describe(image)));
 const matches=[];for(let i=1;i<frames.length;i++)matches.push(await findMotion(frames[i-1],frames[i]));
 const {top,bottom}=boundaries(frames,matches),w=originals[0].w,h=originals[0].h,row=w*4;
 const height=h+matches.reduce((sum,m)=>sum+m.shift,0);assert.equal(w,expected.w);assert.equal(height,expected.h);
 const output=Buffer.alloc(row*height);originals[0].data.copy(output,0,0,(h-bottom)*row);
 let offset=0,lastCut=0;for(let i=0;i<matches.length;i++){const m=matches[i];offset+=m.shift;if(!m.shift)continue;const seam=chooseSeam(frames[i],frames[i+1],m,top,h-bottom,Math.max(top,lastCut-offset));lastCut=offset+seam;originals[i+1].data.copy(output,lastCut*row,seam*row,(h-bottom)*row);}
 originals.at(-1).data.copy(output,(height-bottom)*row,(h-bottom)*row);
 assert.ok(output.equals(expected.data),'The full-resolution output must match every reference pixel');
});
