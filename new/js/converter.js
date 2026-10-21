(()=>{'use strict';
const $=id=>document.getElementById(id),file=$('file'),drop=$('dropzone'),msg=$('message');
let sheets={},rows=[],headers=[],mapping={},largeCSV=null,largeRowCount=0;
const fields=[['name','Full name'],['first','First name'],['last','Last name'],['phone','Phone'],['mobile','Mobile phone'],['workphone','Work phone'],['email','Email'],['workemail','Work email'],['company','Company'],['title','Job title'],['address','Address'],['website','Website'],['notes','Notes']];
const aliases={name:['name','fullname','contactname','displayname'],first:['firstname','givenname','first'],last:['lastname','surname','familyname','last'],phone:['phone','phonenumber','telephone','tel','number','contactnumber','primaryphone'],mobile:['mobile','cell','cellphone','mobilenumber','mobilephone'],workphone:['workphone','officephone','businessphone'],email:['email','emailaddress','personalemail'],workemail:['workemail','businessemail'],company:['company','organization','organisation','business'],title:['title','jobtitle','position','designation'],address:['address','streetaddress','fulladdress'],website:['website','url','web'],notes:['notes','note','description']};
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
function parseCSV(text){text=text.replace(/^\uFEFF/,'');let out=[],row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))out.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('The CSV contains an unclosed quoted field.');row.push(cell);if(row.some(x=>x.trim()))out.push(row);return out}
function setRows(data){data=data.filter(r=>r.some(v=>String(v??'').trim()));if(data.length<2)throw Error('Add a header row and at least one contact.');headers=data[0].map((v,i)=>String(v??'').trim()||'Column '+(i+1));rows=data.slice(1).map(r=>headers.map((_,i)=>String(r[i]??'').trim()));mapping={};const used=new Set();fields.forEach(([key])=>{let index=headers.findIndex((h,i)=>!used.has(i)&&aliases[key].includes(norm(h)));if(index<0)index=headers.findIndex((h,i)=>!used.has(i)&&aliases[key].some(a=>norm(h).startsWith(a)));mapping[key]=index>=0?String(index):'';if(index>=0)used.add(index)});render()}
function render(){let html='';for(const [key,label] of fields){html+='<div class="converter-field"><label for="map-'+key+'">'+label+'</label><select id="map-'+key+'" data-key="'+key+'"><option value="">Not included</option>'+headers.map((h,i)=>'<option value="'+i+'"'+(mapping[key]===String(i)?' selected':'')+'>'+escapeHTML(h)+'</option>').join('')+'</select></div>'}$('mapping').innerHTML=html;$('mapping').querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{mapping[s.dataset.key]=s.value;preview()}));$('mappingCard').hidden=false;$('previewCard').hidden=false;preview()}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function val(r,k){const i=mapping[k];return i===''?'':String(r[Number(i)]??'').trim()}
function contact(r){const first=val(r,'first'),last=val(r,'last');return {name:val(r,'name')||[first,last].filter(Boolean).join(' '),first,last,phone:val(r,'phone'),mobile:val(r,'mobile'),workphone:val(r,'workphone'),email:val(r,'email'),workemail:val(r,'workemail'),company:val(r,'company'),title:val(r,'title'),address:val(r,'address'),website:val(r,'website'),notes:val(r,'notes')}}
function contacts(){return rows.map(contact).filter(c=>!$('skipEmpty').checked||c.name||c.phone||c.mobile||c.workphone)}
function preview(){const list=contacts();$('count').textContent=(largeCSV?largeRowCount:list.length).toLocaleString()+' contact'+(list.length===1?'':'s')+' ready';$('preview').innerHTML=list.slice(0,5).map(c=>'<tr><td>'+escapeHTML(c.name||'—')+'</td><td>'+escapeHTML(c.phone||c.mobile||c.workphone||'—')+'</td><td>'+escapeHTML(c.email||c.workemail||'—')+'</td></tr>').join('')||'<tr><td colspan="3">No contacts match your settings.</td></tr>'}
$('skipEmpty').addEventListener('change',preview);
function vescape(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function fold(line){const enc=new TextEncoder();let result='',chunk='',size=0;for(const char of line){const n=enc.encode(char).length;if(size+n>75){result+=chunk+'\r\n ';chunk='';size=1}chunk+=char;size+=n}return result+chunk}
function card(c){const parts=['BEGIN:VCARD','VERSION:3.0'];const fn=c.name||[c.first,c.last].filter(Boolean).join(' ')||c.company||c.phone||c.mobile||c.email||'Unnamed contact';parts.push('N:'+vescape(c.last)+';'+vescape(c.first)+';;;','FN:'+vescape(fn));const add=(key,v)=>{if(v)parts.push(key+':'+vescape(v))};add('TEL;TYPE=CELL',c.mobile);add('TEL;TYPE=VOICE',c.phone);add('TEL;TYPE=WORK',c.workphone);add('EMAIL;TYPE=HOME',c.email);add('EMAIL;TYPE=WORK',c.workemail);add('ORG',c.company);add('TITLE',c.title);if(c.address)parts.push('ADR;TYPE=HOME:;;'+vescape(c.address)+';;;;');add('URL',c.website);add('NOTE',c.notes);parts.push('END:VCARD');return parts.map(fold).join('\r\n')}

async function* csvRows(f){
 const reader=f.stream().getReader(),decoder=new TextDecoder('utf-8');
 let cell='',row=[],quoted=false,pendingQuote=false,skipLF=false,first=true;
 function emit(){const r=[...row,cell];row=[];cell='';return r}
 try{
 while(true){
  const {value,done}=await reader.read();let text=decoder.decode(value||new Uint8Array(),{stream:!done});
  if(first){text=text.replace(/^\uFEFF/,'');first=false}
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(skipLF){skipLF=false;if(c==='\n')continue}
   if(pendingQuote){pendingQuote=false;if(c==='"'){cell+='"';continue}quoted=false}
   if(quoted){if(c==='"')pendingQuote=true;else cell+=c;continue}
   if(c==='"'){quoted=true;continue}
   if(c===','){row.push(cell);cell='';continue}
   if(c==='\n'||c==='\r'){if(c==='\r')skipLF=true;const r=emit();if(r.some(x=>x.trim()))yield r;continue}
   cell+=c;
  }
  if(done)break;
 }
 if(pendingQuote){quoted=false;pendingQuote=false}
 if(quoted)throw Error('CSV contains an unclosed quoted field.');
 const last=emit();if(last.some(x=>x.trim()))yield last;
 }finally{reader.releaseLock()}
}
async function loadLargeCSV(f){
 largeCSV=f;largeRowCount=0;const sample=[];
 for await(const r of csvRows(f)){largeRowCount++;if(sample.length<6)sample.push(r)}
 if(sample.length<2)throw Error('Add a header row and at least one contact.');
 setRows(sample);largeRowCount--;msg.textContent='Large CSV ready: '+largeRowCount.toLocaleString()+' rows. Only a preview is held in memory.';
}
async function convertLargeCSV(){
 const button=$('convert');button.disabled=true;button.textContent='Converting…';
 msg.textContent='Processing large CSV in small chunks…';
 let writer=null,chunks=[],count=0,buffer='',bytes=0,skipped=false;
 try{
 if('showSaveFilePicker' in window){
  try{const handle=await window.showSaveFilePicker({suggestedName:'veefivee-contacts.vcf',types:[{description:'VCF contacts',accept:{'text/vcard':['.vcf']}}]});writer=await handle.createWritable()}
  catch(e){if(e.name==='AbortError')return;/* Browser may disallow picker: use Blob fallback */}
 }
 const flush=async()=>{if(!buffer)return;if(writer)await writer.write(buffer);else chunks.push(buffer);buffer=''};
 for await(const r of csvRows(largeCSV)){
  if(!skipped){skipped=true;continue}
  const c=contact(headers.map((_,i)=>String(r[i]??'').trim()));
  if($('skipEmpty').checked&&!c.name&&!c.phone&&!c.mobile&&!c.workphone)continue;
  buffer+=card(c)+'\r\n';count++;bytes+=buffer.length;
  if(buffer.length>=256*1024){await flush();if(count%1000===0)msg.textContent='Converted '+count.toLocaleString()+' contacts…';}
 }
 await flush();
 if(writer){await writer.close();writer=null}
 else if(chunks.length){const blob=new Blob(chunks,{type:'text/vcard;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='veefivee-contacts.vcf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 msg.textContent='Converted '+count.toLocaleString()+' contacts successfully.';
 }catch(e){if(writer)await writer.abort().catch(()=>{});msg.textContent='Conversion stopped: '+(e.message||e)}
 finally{button.disabled=false;button.innerHTML='Download VCF <span>↗</span>'}
}
function download(content,name,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('convert').addEventListener('click',async()=>{if(largeCSV){await convertLargeCSV();return}const list=contacts();if(!list.length){msg.textContent='No contacts to convert. Check your mapping.';return}if(!list.some(c=>c.name||c.phone||c.mobile||c.workphone||c.email)){msg.textContent='Map at least one name, phone, or email column.';return}download('\uFEFF'+list.map(card).join('\r\n')+'\r\n','veefivee-contacts.vcf','text/vcard;charset=utf-8');msg.textContent='VCF file generated successfully.'});
function showSheet(name){const ws=sheets[name];const data=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});setRows(data)}
async function load(f){msg.textContent='';largeCSV=null;largeRowCount=0;if(!f)return;if(!/\.(csv|xlsx|xls)$/i.test(f.name)){msg.textContent='Please choose a CSV or Excel file.';return}const mobile=matchMedia('(pointer:coarse) and (max-width:767px)').matches;const max=(mobile?200:1024)*1024*1024;if(f.size>max){msg.textContent='This device supports files up to '+(mobile?'200 MB':'1 GB')+'.';return}try{const ext=f.name.split('.').pop().toLowerCase();if(ext==='csv'&&f.size>5*1024*1024){sheets={};$('sheetWrap').hidden=true;await loadLargeCSV(f)}else if(ext==='csv'){const buffer=await f.arrayBuffer();let text=new TextDecoder('utf-8',{fatal:false}).decode(buffer);if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer);sheets={};$('sheetWrap').hidden=true;setRows(parseCSV(text))}else{if(!window.XLSX)throw Error('Excel reader could not load. Check your connection or save your file as CSV.');const wb=window.XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:false});sheets=wb.Sheets;$('sheet').innerHTML=wb.SheetNames.map(s=>'<option>'+escapeHTML(s)+'</option>').join('');$('sheetWrap').hidden=wb.SheetNames.length<2;showSheet(wb.SheetNames[0])}$('fileInfo').textContent=f.name+' · '+(largeCSV?largeRowCount:rows.length).toLocaleString()+' rows';$('fileInfo').hidden=false}catch(e){$('mappingCard').hidden=true;$('previewCard').hidden=true;msg.textContent=e.message||'Unable to read this file.'}}
$('sheet').addEventListener('change',e=>{try{showSheet(e.target.value)}catch(err){msg.textContent=err.message}});
drop.addEventListener('click',()=>file.click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click()}});file.addEventListener('change',()=>load(file.files[0]));drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragging')});drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragging');load(e.dataTransfer.files[0])});
$('sample').addEventListener('click',e=>{e.preventDefault();download('Name,Phone,Email,Company,Job Title\nJane Doe,+15551234567,jane@example.com,Example Inc,Manager\n','veefivee-sample-contacts.csv','text/csv;charset=utf-8')});
})();