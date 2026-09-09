// Real app scripts and UI with synthetic SDK/DOM; no production network or visual browser.
import {Window} from 'happy-dom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as authModule from '../auth-controller.js';
import * as model from '../task-model.js';
import {createTaskService} from '../task-service.js';
import {fakeSdk} from './fake-sdk.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../staff-tasks.js',import.meta.url),'utf8');
const blocks=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>({module:m[1].includes('module'),code:m[2]}));
const stripImports=s=>s.replace(/import[\s\S]*?from\s*["'][^"']+["'];/g,'');
const delay=()=>new Promise(resolve=>setTimeout(resolve,30));
const phone='03000000001',base='businesses/noor-traders',img='data:image/jpeg;base64,/9j/2Q==';
const owner={uid:'owner',email:'hp6235@gmail.com',isAnonymous:false};
const fixture={phone,name:'Synthetic employee',role:'Cashier',active:true,loginEnabled:true,address:'Test shop'};
async function boot(role,extraRecords=[]){
 const errors=[],w=new Window({url:'http://localhost:8765',settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 w.console.error=(...v)=>errors.push(v.map(String).join(' '));w.console.warn=()=>{};
 w.document.write(html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,''));
 for(const el of w.document.querySelectorAll('[id]'))if(!(el.id in w))w[el.id]=el;
 w.structuredClone=structuredClone;w.setInterval=()=>0;w.setTimeout=(cb,ms)=>ms<1000?setTimeout(cb,0):0;w.fetch=async()=>({ok:true,json:async()=>({version:'v100'})});
 const records=new Map([[base+'/staffAccounts/'+phone,fixture],[base+'/staff/'+phone,{...fixture,id:phone}],[base+'/staffSessions/staff',{phone}],[base+'/staffConfig/main',{radius:200,version:'v100'}],[base+'/staffAttendance/attendance',{phone,date:'2026-09-08',checkIn:'09:00',finalScore:10}]]);
 for(const [path,data] of extraRecords)records.set(path,data);
 const phoneNotices=[],workerMessages=new Map();let permissionRequests=0;
 const registration={active:{state:'activated'},showNotification:async(title,options)=>phoneNotices.push({title,...options}),getNotifications:async()=>[]};
 Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>registration,register:async()=>registration,addEventListener:(type,fn)=>workerMessages.set(type,fn)}});
 Object.defineProperty(w,'Notification',{configurable:true,value:{permission:'default',requestPermission:async()=>{permissionRequests++;w.Notification.permission='granted';return 'granted'}}});
 const f=fakeSdk({records,initialUser:role==='owner'?owner:role==='staff'?{uid:'staff',isAnonymous:true}:role==='outsider'?{uid:'outsider',isAnonymous:false,email:'outsider@example.test'}:null});
 Object.assign(w,authModule,model,f.sdk,{createTaskService,e:model.escapeHtml});
 w.eval(stripImports(ui).replace(/export /g,''));
 // Happy DOM has no image/canvas decoder; inject fixed JPEG data only at that boundary.
 const realInstall=w.installTaskUI;w.installTaskUI=args=>realInstall({...args,compress:async()=>img});
 for(const b of blocks)if(b.module)await w.eval('(async()=>{'+stripImports(b.code).replace('installTaskUI({service:taskService,','installTaskUI({compress:async()=>\'data:image/jpeg;base64,/9j/2Q==\',service:taskService,')+'})()');else w.eval(b.code);
 await delay();return{w,f,errors,phoneNotices,workerMessages,getPermissionRequests:()=>permissionRequests};
}
for(const role of ['none','owner','staff','outsider']){
 const {w,errors}=await boot(role);assert.deepEqual(errors,[],`script errors in ${role}`);
 assert.equal(w.ownerApp.hidden,role!=='owner');assert.equal(w.staffPortal.hidden,role!=='staff');assert.equal(w.loginGate.classList.contains('hidden'),['owner','staff'].includes(role));
 for(const el of w.document.querySelectorAll('.tab'))assert.ok(w.ownerApp.contains(el),`${el.id} must stay inside owner wrapper`);
 assert.ok(w.staffPortal.contains(w.staffTaskPanelV99));
 assert.equal(new Set([...w.document.querySelectorAll('[id]')].map(x=>x.id)).size,w.document.querySelectorAll('[id]').length,'IDs must be unique');
 if(role==='owner'){
  w.goScreen('staffAccounts');const bar=w.document.getElementById('staffTopNavV99');assert.equal(bar.hidden,false);assert.equal(bar.nextElementSibling.id,'staffAccounts');
  const buttons=[...bar.querySelectorAll('.staff-feature-card')];assert.equal(buttons.length,12);for(const b of buttons)new Function(b.getAttribute('onclick'));
  w.goScreen('staffTasks');assert.equal(bar.nextElementSibling.id,'staffTasks');w.goScreen('dashboard');assert.equal(bar.hidden,true);
 }
 console.log('PASS actual HTML + scripts:',role,'view, role containment and navigation');await w.happyDOM.abort();
}
const {w,f,errors}=await boot('owner');
const submit=form=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
w.editStaffV84(phone);w.document.querySelector('#staffEditFormV85 .nt-task-link').click();await delay();
const form=w.document.getElementById('ntAssignForm');assert.ok(form,'task form opens from edit profile');
form.querySelector('[name=title]').value='Clean shelf <one>';form.querySelector('[name=details]').value='Arrange stock and send two pictures.';
form.querySelector('[name=date]').value='2026-09-08';form.querySelector('[name=maxPoints]').value='10';submit(form);await delay();
let task=[...f.records.entries()].find(([k])=>k.startsWith(base+'/staffTasks/'))?.[1];assert.equal(task.title,'Clean shelf <one>');
w.closeStaffEditV85();w.logoutBtn.click();await delay();w.staffLoginTab.click();w.staffLoginPhone.value='admin';w.staffLoginPassword.value=phone;submit(w.staffLoginForm);await delay();
assert.equal(w.staffPortal.hidden,false);assert.equal(w.ownerApp.hidden,true);assert.ok(w.document.getElementById('ntStaffTaskList').textContent.includes('Clean shelf <one>'));
w.document.getElementById('ntQuickUpload').click();await delay();const input=w.document.getElementById('ntCameraPhoto');
Object.defineProperty(input,'files',{value:[new w.File(['one'],'one.jpg',{type:'image/jpeg'}),new w.File(['two'],'two.jpg',{type:'image/jpeg'})],configurable:true});
input.dispatchEvent(new w.Event('change',{bubbles:true}));await delay();assert.equal(w.document.querySelectorAll('#ntDraftPhotos img').length,2);assert.equal(w.document.getElementById('ntSubmitPhotos').disabled,false);
submit(w.document.getElementById('ntSubmitForm'));await delay();task=f.records.get(base+'/staffTasks/'+task.id);assert.equal(task.status,'submitted');assert.equal(task.photoIds.length,2);assert.equal(w.noorTasks.totals(phone).points,0);
w.staffLogoutBtn.click();await delay();w.ownerLoginTab.click();w.loginEmail.value='admin';w.loginPassword.value='synthetic-owner-password';submit(w.loginForm);await delay();
w.goScreen('staffTasks');w.document.querySelector('#ntOwnerTaskList [data-task-open]').click();await delay();assert.equal(w.document.querySelectorAll('#ntSavedPhotos img').length,2);
w.document.getElementById('ntReviewPoints').value='7';submit(w.document.getElementById('ntReviewForm'));await delay();task=f.records.get(base+'/staffTasks/'+task.id);assert.equal(task.status,'approved');assert.equal(task.points,7);assert.equal(w.noorTasks.totals(phone).points,7);
await w.noorTasks.report({phone,from:'2026-09-08',to:'2026-09-08',individual:true});const ownerReport=w.document.getElementById('ntReportFrame').srcdoc;
assert.equal((ownerReport.match(/<img src="data:image/g)||[]).length,2);assert.ok(ownerReport.includes('مجموعہ: 17'));
w.logoutBtn.click();await delay();assert.equal(w.document.getElementById('ntTaskReport').hidden,true);assert.equal(w.document.getElementById('ntTaskDialog').hidden,true);
w.staffLoginTab.click();w.staffLoginPassword.value=phone;submit(w.staffLoginForm);await delay();w.staffHistoryFrom.value='2026-09-08';w.staffHistoryTo.value='2026-09-08';w.staffPdfBtn.click();await delay();assert.ok(w.document.getElementById('ntReportFrame').srcdoc.includes('مجموعہ: 17'));
assert.deepEqual(errors,[]);console.log('PASS full UI: profile assignment → 2 photos → approval → both PDFs → logout cleanup');await w.happyDOM.abort();

// The production failure: two old tasks without dates must still expose the upload UI.
{
 const {w,errors}=await boot('staff',[[base+'/staffTasks/sparse-a',{phone,title:'First old task'}],[base+'/staffTasks/sparse-b',{phone,title:'Second old task',date:null}]]);
 assert.deepEqual(errors,[]);assert.equal(w.document.querySelectorAll('#ntStaffTaskList .nt-card').length,2);
 w.document.getElementById('ntQuickUpload').click();await delay();assert.equal(w.document.querySelectorAll('#ntTaskDialog [data-task-open]').length,2);
 w.document.querySelector('#ntTaskDialog [data-task-open]').click();await delay();assert.ok(w.document.getElementById('ntCameraPhoto'));assert.ok(!w.document.getElementById('ntGalleryPhotos'));
 assert.ok(w.staffTaskPanelV99.compareDocumentPosition(w.staffAttendancePanelV100)&w.Node.DOCUMENT_POSITION_FOLLOWING);
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition:fn=>fn({coords:{latitude:32.7979125,longitude:73.956984375,accuracy:5}})}});
 w.staffGpsBtn.click();await delay();assert.equal(w.staffGpsMeters.textContent,'0');assert.ok(w.staffGpsMessage.textContent.includes('allowed'));
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition:fn=>fn({coords:{latitude:33.2059125,longitude:73.273546875,accuracy:5}})}});
 w.staffGpsBtn.click();await delay();assert.ok(Number(w.staffGpsMeters.textContent)>70000);assert.ok(w.staffGpsMessage.textContent.includes('نہیں'));
 console.log('PASS sparse legacy tasks + quick upload chooser + corrected shop GPS');await w.happyDOM.abort();
}
// Owner stays signed in while another employee submits pictures; actual UI shows the alert.
{
 const {w,f,errors,phoneNotices,workerMessages,getPermissionRequests}=await boot('owner');
 assert.equal(getPermissionRequests(),0);w.document.querySelector('[data-notice-open]').click();await delay();
 w.document.querySelector('[data-notice-enable]').click();await delay();assert.equal(getPermissionRequests(),1);
 const t=model.createTask({phone,staffName:'Sonu',title:'Clean shelf',date:'2026-09-09',maxPoints:10},{role:'owner',uid:'owner'},'live-task');
 const patch=model.submissionPatch(t,{role:'staff',uid:'staff',phone},{photos:[img,img],submissionId:'live-submission',expectedRevision:0});
 const data={...t,...patch},batch=f.sdk.writeBatch();batch.set(f.sdk.doc({},base+'/staffTasks/live-task'),data);
 for(const id of patch.photoIds)batch.set(f.sdk.doc({},base+'/staffTasks/live-task/taskPhotos/'+id),{taskId:t.id,submissionId:patch.submissionId,dataUrl:img});
 await batch.commit();await delay();assert.equal(w.document.getElementById('ntNoticeToast').hidden,false);assert.ok(w.document.getElementById('ntNoticeToast').textContent.includes('Sonu'));
 assert.equal(phoneNotices.length,1);assert.equal(phoneNotices[0].data.ownerUid,'owner');assert.ok(phoneNotices[0].body.includes('2'));
 assert.equal(w.document.querySelector('[data-notice-count]').textContent,'1');
 f.emit();await delay();assert.equal(phoneNotices.length,1,'metadata/reconnect replay must not re-alert');
 workerMessages.get('message')({data:{type:'NT_TASK_NOTIFICATION',taskId:t.id,ownerUid:'different-owner'}});await delay();assert.equal(w.document.getElementById('ntTaskDialog').hidden,true);
 workerMessages.get('message')({data:phoneNotices[0].data});await delay();assert.equal(w.document.querySelectorAll('#ntSavedPhotos img').length,2);assert.equal(w.document.querySelector('[data-notice-count]').textContent,'0');
 assert.ok(f.records.get(base+'/staffTaskNotificationReads/owner').seen.includes('live-task::live-submission'));
 w.logoutBtn.click();await delay();assert.equal(w.document.getElementById('ntNoticeDialog').hidden,true);assert.equal(w.document.getElementById('ntNoticeToast').hidden,true);
 await f.sdk.setDoc(f.sdk.doc({},base+'/staffTasks/live-task'),{...data,submissionId:'another-submission',revision:2});await delay();assert.equal(phoneNotices.length,1,'no owner alerts after logout');
 assert.deepEqual(errors,[]);console.log('PASS live in-app + opt-in phone alert + click to photos + persisted read + logout privacy');await w.happyDOM.abort();
}
