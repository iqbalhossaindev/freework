'use strict';
/* ═══════════════════════════════════════════════════════
   FREEWORK — script.js
   ═══════════════════════════════════════════════════════ */

/* ── Toast ── */
function toast(msg,type='info',dur=3400){
  let w=document.querySelector('.toast-wrap');
  if(!w){w=document.createElement('div');w.className='toast-wrap';document.body.appendChild(w)}
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'💡'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span>${icons[type]||'💡'}</span><span>${msg}</span>`;
  w.appendChild(el);
  setTimeout(()=>{el.classList.add('hiding');setTimeout(()=>el.remove(),280)},dur);
}

/* ── Clipboard ── */
function initCopy(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-copy]');
    if(!b)return;
    const txt=b.dataset.copy;
    const orig=b.innerHTML;
    const done=()=>{b.innerHTML='✓ Copied';b.classList.add('copied');toast('Copied to clipboard!','success',2000);setTimeout(()=>{b.innerHTML=orig;b.classList.remove('copied')},2000)};
    if(navigator.clipboard){navigator.clipboard.writeText(txt).then(done).catch(done)}
    else{const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done()}
  });
}

/* ── File upload preview ── */
function initUploads(){
  document.querySelectorAll('[data-prev]').forEach(inp=>{
    inp.addEventListener('change',function(){
      const el=document.getElementById(this.dataset.prev);
      if(!el||!this.files[0])return;
      if(!this.files[0].type.startsWith('image/')){toast('Please select an image.','warning');return}
      const r=new FileReader();
      r.onload=e=>{el.src=e.target.result;el.style.display='block'};
      r.readAsDataURL(this.files[0]);
    });
  });
}

/* ── Scroll reveal ── */
function initReveal(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');obs.unobserve(e.target)}});
  },{threshold:0.12});
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
}

/* ── Nav scroll ── */
function initNav(){
  const nav=document.querySelector('.nav');
  if(!nav)return;
  const onS=()=>nav.classList.toggle('scrolled',window.scrollY>55);
  window.addEventListener('scroll',onS,{passive:true});onS();
}

/* ── Tilt cards ── */
function initTilt(){
  document.querySelectorAll('.card,.how-card,.sec-card').forEach(c=>{
    c.addEventListener('mousemove',e=>{
      const r=c.getBoundingClientRect();
      const rx=((e.clientY-r.top-r.height/2)/r.height)*10;
      const ry=((e.clientX-r.left-r.width/2)/r.width)*-10;
      c.style.transform=`perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });
    c.addEventListener('mouseleave',()=>c.style.transform='');
  });
}

/* ── Animated counters ── */
function animCount(el,target,sfx){
  const dur=1500,start=performance.now();
  const tick=now=>{
    const p=Math.min((now-start)/dur,1);
    const e=1-Math.pow(1-p,3);
    el.textContent=Math.floor(target*e)+sfx;
    if(p<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function initCounters(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        animCount(e.target,+e.target.dataset.c,e.target.dataset.sfx||'');
        obs.unobserve(e.target);
      }
    });
  },{threshold:0.4});
  document.querySelectorAll('[data-c]').forEach(el=>obs.observe(el));
}

/* ── Progress bars ── */
function initBars(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){e.target.style.width=e.target.dataset.w+'%';obs.unobserve(e.target)}
    });
  },{threshold:0.5});
  document.querySelectorAll('.pb-fill[data-w]').forEach(b=>{b.style.width='0';obs.observe(b)});
}

/* ── Smooth scroll ── */
function initSmoothScroll(){
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a)return;
    const t=document.getElementById(a.getAttribute('href').slice(1));
    if(!t)return;
    e.preventDefault();
    t.scrollIntoView({behavior:'smooth',block:'start'});
  });
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════ */

/* ── Demo user data ── */
const USERS={
  iqbal:{name:'Iqbal Hossain',email:'iqbal@example.com',phone:'+971 56 348 5950',ip:'95.188.143.22',device:'Chrome / Windows 11 – D8F2A',wallet:'Unique (8Kj2...P9mN)',risk:5,tasks:'3/10',level:'Normal User',status:'Approved',joined:'2025-03-12',notes:'Good standing. No suspicious activity detected.'},
  rafi:{name:'Rafi Ahmed',email:'rafi@example.com',phone:'+880 1712 345678',ip:'95.188.143.22',device:'Firefox / Android – E9C3B',wallet:'Unique (3Lm7...Q1xR)',risk:35,tasks:'0/10',level:'New User',status:'Pending Review',joined:'2025-04-28',notes:'Shares IP with Iqbal and Shuvo. Flagged for review.'},
  shuvo:{name:'Shuvo Islam',email:'shuvo@example.com',phone:'+880 1911 222333',ip:'95.188.143.22',device:'Chrome / Android – E9C3B',wallet:'DUPLICATE RISK (3Lm7...Q1xR)',risk:85,tasks:'9/10',level:'New User',status:'Pending Review',joined:'2025-04-29',notes:'HIGH RISK: Repeat IP + Repeat Device + Duplicate Wallet.'},
  maria:{name:'Maria Khan',email:'maria@example.com',phone:'+44 7700 900123',ip:'82.14.93.18',device:'Safari / iPhone 15 – A2F7D',wallet:'Unique (9Yz4...T5kJ)',risk:10,tasks:'10/10',level:'Trusted User',status:'Approved',joined:'2025-01-05',notes:'Trusted user. Excellent track record.'}
};
function riskClass(s){return s<20?'rl':s<50?'rr':s<80?'rh':'rs'}
function riskLabel(s){return s<20?'Low':s<50?'Review':s<80?'High Risk':'Spam'}

/* ── Dashboard nav ── */
function initDashNav(){
  const sb=document.querySelector('.sb');
  const ov=document.querySelector('.sb-overlay');
  const ham=document.querySelector('.tb-ham');
  const links=[...document.querySelectorAll('.sb-menu a[data-s]')];
  const secs=[...document.querySelectorAll('.dsec')];
  const tbTitle=document.querySelector('.tb-title');

  if(!sb)return;

  ham?.addEventListener('click',()=>{sb.classList.toggle('open');ov?.classList.toggle('show')});
  ov?.addEventListener('click',()=>{sb.classList.remove('open');ov.classList.remove('show')});

  function activate(name){
    links.forEach(l=>l.classList.remove('active'));
    secs.forEach(s=>s.classList.remove('active'));
    const link=links.find(l=>l.dataset.s===name);
    const sec=document.getElementById('s-'+name);
    link?.classList.add('active');
    sec?.classList.add('active');
    if(tbTitle&&link)tbTitle.textContent=link.querySelector('.sb-lbl')?.textContent||'Dashboard';
    sb.classList.remove('open');ov?.classList.remove('show');
    // animate counters in new section
    sec?.querySelectorAll('[data-c]').forEach(el=>animCount(el,+el.dataset.c,el.dataset.sfx||''));
    sec?.querySelectorAll('.pb-fill[data-w]').forEach(b=>{b.style.width='0';setTimeout(()=>b.style.width=b.dataset.w+'%',100)});
  }

  links.forEach(l=>l.addEventListener('click',e=>{e.preventDefault();activate(l.dataset.s)}));
  activate('overview');
}

/* ── User modal ── */
function initModal(){
  const ov=document.getElementById('uModal');
  const xBtn=document.getElementById('mClose');
  if(!ov)return;
  xBtn?.addEventListener('click',()=>ov.classList.remove('open'));
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open')});

  window.openUser=function(id){
    const u=USERS[id];if(!u)return;
    const rc=riskClass(u.risk),rl=riskLabel(u.risk);
    document.getElementById('m-name').textContent=u.name;
    document.getElementById('m-email').textContent=u.email;
    document.getElementById('m-phone').textContent=u.phone;
    document.getElementById('m-ip').textContent=u.ip;
    document.getElementById('m-device').textContent=u.device;
    document.getElementById('m-wallet').textContent=u.wallet;
    document.getElementById('m-tasks').textContent=u.tasks;
    document.getElementById('m-level').textContent=u.level;
    document.getElementById('m-joined').textContent=u.joined;
    document.getElementById('m-notes').textContent=u.notes;
    const re=document.getElementById('m-risk');
    re.textContent=`${u.risk} — ${rl}`;re.className=`rb ${rc}`;
    const se=document.getElementById('m-status');
    se.textContent=u.status;
    se.className='badge '+(u.status==='Approved'?'bg':u.status==='Rejected'?'br':'bgold');
    ov.classList.add('open');
  };
}

/* ── Table search ── */
function initSearch(){
  document.querySelectorAll('.si[data-tbl]').forEach(inp=>{
    inp.addEventListener('input',function(){
      const tbl=document.getElementById(this.dataset.tbl);
      if(!tbl)return;
      const q=this.value.toLowerCase();
      tbl.querySelectorAll('tbody tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?'':'none');
    });
  });
  document.querySelectorAll('.fs[data-tbl]').forEach(sel=>{
    sel.addEventListener('change',function(){
      const tbl=document.getElementById(this.dataset.tbl);
      if(!tbl)return;
      const v=this.value.toLowerCase();
      tbl.querySelectorAll('tbody tr').forEach(r=>r.style.display=(!v||r.textContent.toLowerCase().includes(v))?'':'none');
    });
  });
}

/* ── Task form ── */
function initTaskForm(){
  const vis=document.getElementById('tVis');
  const assignSec=document.getElementById('assignSec');
  if(!vis||!assignSec)return;
  const update=()=>{const v=vis.value;assignSec.style.display=(v==='specific'||v==='private')?'block':'none'};
  vis.addEventListener('change',update);update();

  const uSearch=document.querySelector('.usel-s');
  uSearch?.addEventListener('input',function(){
    const q=this.value.toLowerCase();
    document.querySelectorAll('.usel-item').forEach(it=>it.style.display=it.textContent.toLowerCase().includes(q)?'':'none');
  });

  function updateTags(){
    const tc=document.getElementById('uTags');if(!tc)return;
    tc.innerHTML='';
    document.querySelectorAll('.usel-item input:checked').forEach(cb=>{
      const n=cb.dataset.n||cb.value;
      const t=document.createElement('div');t.className='utag';
      t.innerHTML=`${n} <span class="utag-x" data-cid="${cb.id}">×</span>`;
      tc.appendChild(t);
    });
    tc.querySelectorAll('.utag-x').forEach(x=>x.addEventListener('click',()=>{
      const cb=document.getElementById(x.dataset.cid);
      if(cb){cb.checked=false;updateTags()}
    }));
  }
  document.querySelectorAll('.usel-item input').forEach(cb=>cb.addEventListener('change',updateTags));
  updateTags();
}

/* ── Settings ── */
function initSettings(){
  const rft=document.getElementById('rFeeToggle');
  const rfp=document.getElementById('rFeePanel');
  rft?.addEventListener('change',function(){
    if(rfp)rfp.style.display=this.checked?'block':'none';
    toast(this.checked?'Registration fee enabled.':'Registration fee disabled.',this.checked?'success':'warning');
  });

  const clt=document.getElementById('cLimitToggle');
  const clp=document.getElementById('cLimitPanel');
  clt?.addEventListener('change',function(){
    if(clp)clp.style.display=this.checked?'block':'none';
    toast(this.checked?'Custom limits enabled for trusted users.':'Custom limits disabled.','info');
  });

  document.querySelectorAll('.tog input').forEach(t=>{
    if(t.id==='rFeeToggle'||t.id==='cLimitToggle')return;
    t.addEventListener('change',function(){
      const n=this.closest('.set-row')?.querySelector('.set-n')?.textContent||'Setting';
      toast(`${n}: ${this.checked?'Enabled':'Disabled'}`,'info');
    });
  });
}

/* ── Action buttons ── */
function initActions(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');
    if(!b)return;
    const act=b.dataset.action,row=b.dataset.row;

    const setStatus=(sel,cls,txt)=>{
      const el=document.querySelector(sel);
      if(el){el.textContent=txt;el.className='badge '+cls}
    };
    const setRowStatus=(rowId,cls,txt)=>{
      const r=document.getElementById(rowId);
      const c=r?.querySelector('.st-cell');
      if(c){c.textContent=txt;c.className='badge '+cls}
    };

    switch(act){
      case 'approve-user':setRowStatus(row,'bg','Approved');toast('User approved.','success');break;
      case 'reject-user':setRowStatus(row,'br','Rejected');toast('User rejected.','error');break;
      case 'suspend-user':setRowStatus(row,'bor','Suspended');toast('User suspended.','warning');break;
      case 'spam-user':setRowStatus(row,'br','Banned');toast('User banned as spam.','error');break;
      case 'approve-payment':{const c=b.closest('.prc');if(c){const s=c.querySelector('.pay-st');if(s){s.textContent='Approved';s.className='badge bg pay-st'}}toast('Payment approved. Campaign will go live.','success');break}
      case 'reject-payment':{const c=b.closest('.prc');if(c){const s=c.querySelector('.pay-st');if(s){s.textContent='Rejected';s.className='badge br pay-st'}}toast('Payment rejected.','error');break}
      case 'wrong-network':{const c=b.closest('.prc');if(c){const s=c.querySelector('.pay-st');if(s){s.textContent='Wrong Network';s.className='badge br pay-st'}}toast('Marked as wrong network.','error');break}
      case 'wrong-amount':{const c=b.closest('.prc');if(c){const s=c.querySelector('.pay-st');if(s){s.textContent='Wrong Amount';s.className='badge br pay-st'}}toast('Marked as wrong amount.','error');break}
      case 'approve-sub':{const c=b.closest('.sub-card');if(c){const s=c.querySelector('.sub-st');if(s){s.textContent='Approved';s.className='badge bg sub-st'}}toast('Submission approved. Reward queued.','success');break}
      case 'reject-sub':{const c=b.closest('.sub-card');if(c){const s=c.querySelector('.sub-st');if(s){s.textContent='Rejected';s.className='badge br sub-st'}}toast('Submission rejected.','error');break}
      case 'resubmit':toast('Resubmission request sent.','info');break;
      case 'mark-fake':toast('Marked as fake screenshot.','error');break;
      case 'approve-wd':setRowStatus(row,'bg','Sent');toast('Withdrawal approved and sent.','success');break;
      case 'reject-wd':setRowStatus(row,'br','Rejected');toast('Withdrawal rejected.','error');break;
      case 'hold-wd':setRowStatus(row,'bor','On Hold');toast('Withdrawal on hold.','warning');break;
      case 'publish':toast('Task published successfully!','success');break;
      case 'save-draft':toast('Task saved as draft.','info');break;
      case 'reset-form':{
        b.closest('.card')?.querySelectorAll('input,select,textarea').forEach(el=>{if(el.type==='checkbox')el.checked=false;else el.value=''});
        b.closest('.card')?.querySelectorAll('img').forEach(i=>i.style.display='none');
        toast('Form reset.','info');break
      }
      case 'submit-proof':toast('Proof submitted for admin review!','success');break;
      case 'start-task':toast('Task started! Upload proof when done.','info');break;
      case 'request-wd':toast('Withdrawal request submitted.','success');break;
      case 'submit-campaign':toast('Campaign payment proof submitted!','success');break;
      case 'dismiss-alert':{const c=b.closest('.spa');if(c){c.style.opacity='0';c.style.transform='scale(0.9)';setTimeout(()=>c.remove(),300)}toast('Alert dismissed.','info');break}
      case 'flag-users':toast('Users flagged for spam review.','warning');break;
      case 'save-settings':toast('Settings saved successfully.','success');break;
      default:toast(`Action: ${act}`,'info');
    }
  });
}

/* ── Level selects ── */
function initLevelSelects(){
  document.querySelectorAll('.lvl-sel').forEach(sel=>{
    sel.addEventListener('change',function(){
      const r=document.getElementById(this.dataset.row);
      const c=r?.querySelector('.lvl-cell');
      if(c)c.textContent=this.value;
      toast(`User level changed to "${this.value}".`,'success');
    });
  });
}

/* ── Date min ── */
function initDates(){
  const today=new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type=date]').forEach(el=>el.min=today);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded',()=>{
  initCopy();initUploads();

  if(document.body.classList.contains('db')){
    initDashNav();initModal();initSearch();initTaskForm();
    initSettings();initActions();initLevelSelects();initDates();
    initBars();initCounters();
    toast('Welcome to FreeWork Admin Demo','info',3200);
  } else {
    initNav();initReveal();initTilt();initCounters();initBars();initSmoothScroll();
    // payment form
    const pf=document.getElementById('payForm');
    pf?.addEventListener('submit',e=>{
      e.preventDefault();
      toast('Payment proof submitted for review!','success');
      pf.reset();
      const p=document.getElementById('prevPay');if(p){p.src='';p.style.display='none'}
    });
  }
});
