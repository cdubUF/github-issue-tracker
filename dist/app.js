const demoIssues=[
 {number:142,title:'Keyboard focus disappears inside the command palette',state:'open',user:{login:'sam-rivera'},labels:[{name:'bug',color:'ff674d'},{name:'accessibility',color:'d7ff42'}],assignees:[],comments:8,created_at:'2026-10-03T10:00:00Z',updated_at:'2026-10-22T16:40:00Z',html_url:'#'},
 {number:139,title:'Add saved views for recurring triage workflows',state:'open',user:{login:'mina-k'},labels:[{name:'enhancement',color:'5777ff'},{name:'good first issue',color:'7ee2a8'}],assignees:[{login:'mina-k'}],comments:14,created_at:'2026-09-24T10:00:00Z',updated_at:'2026-10-21T09:20:00Z',html_url:'#'},
 {number:133,title:'Long label names overflow issue cards on mobile',state:'open',user:{login:'alec-dev'},labels:[{name:'bug',color:'ff674d'},{name:'mobile',color:'b5a8ff'}],assignees:[],comments:3,created_at:'2026-09-12T10:00:00Z',updated_at:'2026-10-18T12:00:00Z',html_url:'#'},
 {number:127,title:'Document rate-limit behavior and retry strategy',state:'closed',user:{login:'jo-docs'},labels:[{name:'documentation',color:'f0d45b'}],assignees:[{login:'jo-docs'}],comments:5,created_at:'2026-08-28T10:00:00Z',updated_at:'2026-10-15T14:00:00Z',html_url:'#'},
 {number:119,title:'Export filtered issue list as CSV',state:'closed',user:{login:'sam-rivera'},labels:[{name:'enhancement',color:'5777ff'}],assignees:[{login:'sam-rivera'}],comments:11,created_at:'2026-08-02T10:00:00Z',updated_at:'2026-09-29T08:00:00Z',html_url:'#'}
];
let issues=[...demoIssues],repo=localStorage.getItem('issueDeskRepo')||'Poiixen/senior_design',activeState='all',repositoryLoad=0;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const saved=JSON.parse(localStorage.getItem('issueDeskTriage')||'{}');

function persistFilters(){localStorage.setItem('issueDeskFilters',JSON.stringify({state:activeState,label:$('#labelFilter').value,assignee:$('#assigneeFilter').value,hidePrs:$('#hidePrs').checked,search:$('#searchInput').value,sort:$('#sortSelect').value}))}
function ageDays(date){return Math.max(0,Math.floor((Date.now()-new Date(date))/86400000))}
function populateFilters(){
 const labels=[...new Set(issues.flatMap(i=>i.labels.map(l=>l.name)))].sort();
 const people=[...new Set(issues.flatMap(i=>i.assignees.map(a=>a.login)))].sort();
 $('#labelFilter').innerHTML='<option value="">All labels</option>'+labels.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
 $('#assigneeFilter').innerHTML='<option value="">Anyone</option><option value="none">Unassigned</option>'+people.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
}
function escapeHtml(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
function filtered(){
 const q=$('#searchInput').value.trim().toLowerCase(),label=$('#labelFilter').value,who=$('#assigneeFilter').value;
 let out=issues.filter(i=>(activeState==='all'||i.state===activeState)&&(!label||i.labels.some(l=>l.name===label))&&(!who||(who==='none'?!i.assignees.length:i.assignees.some(a=>a.login===who)))&&(!$('#hidePrs').checked||!i.pull_request)&&(!q||`${i.title} ${i.number} ${i.user.login}`.toLowerCase().includes(q)));
 const sort=$('#sortSelect').value;
 return out.sort((a,b)=>sort==='comments'?b.comments-a.comments:sort==='created'?new Date(b.created_at)-new Date(a.created_at):sort==='age'?new Date(a.created_at)-new Date(b.created_at):new Date(b.updated_at)-new Date(a.updated_at));
}
function updateStats(){
 const open=issues.filter(i=>i.state==='open'),closed=issues.filter(i=>i.state==='closed');
 $('#openCount').textContent=open.length;$('#closedCount').textContent=closed.length;$('#unassignedCount').textContent=open.filter(i=>!i.assignees.length).length;
 $('#ageCount').textContent=open.length?Math.round(open.reduce((n,i)=>n+ageDays(i.created_at),0)/open.length)+'d':'—';
}
function render(){
 const out=filtered();$('#resultCount').textContent=`${out.length} ISSUE${out.length===1?'':'S'}`;$('#emptyState').hidden=!!out.length;
 $('#issueList').innerHTML=out.map(i=>`<article class="issue"><span class="state-dot ${i.state}"></span><div><a class="issue-title" href="${i.html_url}" ${i.html_url==='#'?'':'target="_blank" rel="noopener"'}>${escapeHtml(i.title)}</a><div class="issue-meta">#${i.number} · ${i.state==='open'?'OPENED':'CLOSED'} ${ageDays(i.created_at)}D AGO BY ${escapeHtml(i.user.login)} · ${i.comments} COMMENT${i.comments===1?'':'S'}</div><div class="labels">${i.labels.map(l=>`<span class="label" style="background:#${/^[0-9a-f]{6}$/i.test(l.color)?l.color:'dddddd'}55">${escapeHtml(l.name)}</span>`).join('')}</div></div><select class="triage" data-id="${i.number}" data-value="${saved[i.number]||'later'}" aria-label="Triage issue ${i.number}"><option value="later" ${saved[i.number]==='later'||!saved[i.number]?'selected':''}>Later</option><option value="next" ${saved[i.number]==='next'?'selected':''}>Next</option><option value="now" ${saved[i.number]==='now'?'selected':''}>Do now</option></select></article>`).join('');
 $$('.triage').forEach(el=>el.addEventListener('change',e=>{saved[e.target.dataset.id]=e.target.value;localStorage.setItem('issueDeskTriage',JSON.stringify(saved));e.target.dataset.value=e.target.value}));persistFilters();updateStats();
}
async function fetchPage(owner,name,page,state){
 return window.githubAccess.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?state=${state}&per_page=100&page=${page}&sort=updated&direction=desc`);
}
async function loadRepository(value,allStates){
 const parts=value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,'').split('/');if(parts.length!==2||!parts.every(Boolean))throw new Error('Use the format owner/repository.');
 const [owner,name]=parts,state=allStates?'all':'open',current=++repositoryLoad;let page=1,result=[];
 $('#issueList').innerHTML='<div class="loading">Loading issues from GitHub…</div>';$('#emptyState').hidden=true;
 try{
 while(page<=10){const batch=await fetchPage(owner,name,page,state);if(current!==repositoryLoad)return false;result.push(...batch);if(batch.length<100)break;page++}
 issues=result;repo=`${owner}/${name}`;localStorage.setItem('issueDeskRepo',repo);window.githubAccess.setRepository(repo);$('#repoCrumb').textContent=repo.toUpperCase();$('#syncState').innerHTML='<i></i> Live · '+escapeHtml(repo);$('#syncState').classList.add('live');populateFilters();render();return true;
 }catch(error){if(current!==repositoryLoad)return false;render();$('#syncState').innerHTML='<i></i> Could not sync';$('#syncState').classList.remove('live');throw error}
}
function download(text,type,extension){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${repo.replace('/','-')}-issues.${extension}`;a.click();URL.revokeObjectURL(a.href)}
function exportCsv(){const rows=filtered(),fields=['number','title','description','state','author','assignees','labels','comments','created_at','updated_at','url','triage'];const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const body=rows.map(i=>[i.number,i.title,i.body,i.state,i.user.login,i.assignees.map(a=>a.login).join('|'),i.labels.map(l=>l.name).join('|'),i.comments,i.created_at,i.updated_at,i.html_url,saved[i.number]||'later'].map(quote).join(','));download([fields.join(','),...body].join('\n'),'text/csv','csv')}
function exportMarkdown(){const rows=filtered();const lines=[`# Issues for ${repo}`,'',`Exported ${new Date().toLocaleString()}. ${rows.length} issue${rows.length===1?'':'s'} in the current view.`,'','| Issue | Status | Labels | Assignees | Updated | Triage |','|---|---|---|---|---|---|',...rows.map(i=>`| [#${i.number} ${i.title.replaceAll('|','\\|')}](${i.html_url}) | ${i.state} | ${i.labels.map(l=>l.name).join(', ')||'—'} | ${i.assignees.map(a=>'@'+a.login).join(', ')||'Unassigned'} | ${new Date(i.updated_at).toLocaleDateString()} | ${saved[i.number]||'later'} |`)];download(lines.join('\n'),'text/markdown','md')}

$$('.segmented button').forEach(b=>b.addEventListener('click',()=>{$$('.segmented button').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeState=b.dataset.state;render()}));
['labelFilter','assigneeFilter','hidePrs','sortSelect'].forEach(id=>$('#'+id).addEventListener('change',render));$('#searchInput').addEventListener('input',render);$('#exportCsvBtn').addEventListener('click',exportCsv);$('#exportMdBtn').addEventListener('click',exportMarkdown);
$('#clearFilters').addEventListener('click',()=>{activeState='all';$$('.segmented button').forEach(x=>x.classList.toggle('active',x.dataset.state==='all'));$('#labelFilter').value='';$('#assigneeFilter').value='';$('#searchInput').value='';$('#hidePrs').checked=true;$('#sortSelect').value='updated';render()});
function openDialog(){if(repo)$('#repoInput').value=repo;$('#dialogError').textContent='';$('#connectDialog').showModal()}$('#connectBtn').addEventListener('click',openDialog);
$('#closeConnectDialog').addEventListener('click',()=>$('#connectDialog').close());
$('#connectForm').addEventListener('submit',async e=>{e.preventDefault();$('#loadBtn').disabled=true;$('#loadBtn').firstChild.textContent='Loading… ';$('#dialogError').textContent='';try{if(await loadRepository($('#repoInput').value,$('#includeClosed').checked))$('#connectDialog').close()}catch(err){$('#dialogError').textContent=err.message}finally{$('#loadBtn').disabled=false;$('#loadBtn').firstChild.textContent='Load issues '}});
$('#settingsRepoForm').addEventListener('submit',async e=>{e.preventDefault();$('#settingsLoadBtn').disabled=true;$('#settingsLoadBtn').textContent='Loading…';$('#settingsRepoError').textContent='';try{if(await loadRepository($('#settingsRepoInput').value,$('#settingsIncludeClosed').checked))window.githubAccess.showIssues()}catch(err){$('#settingsRepoError').textContent=err.message}finally{$('#settingsLoadBtn').disabled=false;$('#settingsLoadBtn').textContent='Use repository'}});
$('#repoCrumb').textContent=repo.toUpperCase();window.githubAccess.setRepository(repo);populateFilters();render();loadRepository(repo,true).catch(err=>{$('#dialogError').textContent=err.message;$('#settingsRepoError').textContent=err.message});
