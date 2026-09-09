import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const marker=html.indexOf('NOOR TRADERS V102 — INTEGRATED SALARY MODULE');
const start=html.lastIndexOf('<script>',marker)+8,end=html.indexOf('</script>',marker);
const salaryCode=html.slice(start,end);

test('shipped salary module joins attendance hours, overtime, points, owner addition and deduction',()=>{
  const phone='03000000001';
  const attendance=[{phone,date:'2026-09-08',checkIn:'09:00',checkOut:'20:00',finalScore:10}];
  const salary={monthlySalary:30000,dutyHours:10,workingDays:30,overtimeRate:200,pointRate:10};
  const salaryExtras=[{month:'2026-09',kind:'bonus',amount:500},{month:'2026-09',kind:'advance',amount:100}];
  const context={
    console,structuredClone,Date,Intl,Math,Number,String,Array,Object,Map,Set,
    document:{getElementById:()=>null,addEventListener:()=>{}},
    today:()=> '2026-09-09',db:{staff:[{id:phone,phone,name:'Test',active:true,salary,salaryExtras}],salaryConfig:{},salaryExtras:{}},
    normPhoneV84:value=>String(value||'').replace(/\D/g,''),
    attScoreV84:row=>Number(row.finalScore??row.autoScore),
    money:n=>'Rs '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2}),
    esc:value=>String(value??''),save:()=>{},goScreen:()=>{},staffForPhoneV84:()=>({name:'Test'}),
    currentProfilePhoneV84:'',reportPeriodV84:()=>({from:'2026-09-01'}),setTimeout
  };
  context.window=context;
  context.noorStaffSystem={getAttendanceBetween:()=>attendance};
  context.noorTasks={totals:()=>({points:7})};
  context.ntWorkMinutesV101=()=>660;
  vm.createContext(context);vm.runInContext(salaryCode,context);
  const result=context.salaryCalcV102(phone,'2026-09');
  assert.equal(result.normalMin,600);assert.equal(result.otMin,60);
  assert.equal(result.normalSalary,1000);assert.equal(result.overtimeAmount,200);
  assert.equal(result.attPoints,10);assert.equal(result.taskPoints,7);assert.equal(result.pointsAmount,170);
  assert.equal(result.bonus,500);assert.equal(result.advance,100);assert.equal(result.final,1770);
});
