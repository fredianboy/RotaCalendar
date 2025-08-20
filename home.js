
const BASE_ICS_URL = "https://<username>.github.io/RotaCalendar/ics/"; // <-- change me

const SESSION_KEY = "rota.sessionUser";
function getSessionUser(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; } }
function setSessionUser(u){ localStorage.setItem(SESSION_KEY, JSON.stringify(u||null)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function myIcsUrl(){ const u=getSessionUser(); return (!u||!u.icsFile) ? "" : (BASE_ICS_URL+u.icsFile); }

function renderAuthBar(){
  const u = getSessionUser();
  const form = document.getElementById("login-form");
  const sess = document.getElementById("session-info");
  const whoName = document.getElementById("who-name");
  const whoRole = document.getElementById("who-role");
  const icsWrap = document.getElementById("ics-link-wrap");
  if(!form||!sess) return;
  if(!u){
    form.classList.remove("hidden");
    sess.classList.add("hidden");
  } else {
    form.classList.add("hidden");
    sess.classList.remove("hidden");
    whoName.textContent = u.username + (u.staffName?` (${u.staffName})`:"");
    whoRole.textContent = u.isAdmin ? "(Admin)" : "(User)";
    const url = myIcsUrl();
    icsWrap.innerHTML = u.isAdmin
      ? `<em>Admin has no personal ICS. Use staff links on the index page.</em>`
      : (url ? `Subscribe URL: <code>${url}</code>` : `<em>No ICS file set.</em>`);
  }
}
function attachAuthHandlers(){
  // Home page only needs to handle LOGOUT.
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      // Back to the login page
      window.location.href = "index.html";
    });
  }
}

function canEditRowByName(rowStaffName){
  const u=getSessionUser();
  if(!u) return false;
  if(u.isAdmin) return true;
  return !!(u.staffName && rowStaffName.trim() === u.staffName);
}

/* ================== Rota core ================== */
const DUTY_OPTIONS = ["", "A/L", "D75", "D77", "E1", "L2", "MN", "R"];
const SHIFT_MAP = {
  "D77": { start: "07:30", end: "19:00" },
  "D75": { start: "07:30", end: "17:00" },
  "E1":  { start: "06:30", end: "14:30" },
  "L2":  { start: "10:00", end: "18:00" },
  "MN":  { start: "20:00", end: "08:00", overnight: true },
  "A/L": { allDay: true, summary: "Annual Leave" },
  "R":   { allDay: true, summary: "Rest Day" }
};

function daysInMonth(year, month1){ return new Date(year, month1, 0).getDate(); }

/* Staff persistence */
const STAFF_STORAGE_KEY = "rota.staffList";
const DEFAULT_STAFF = ["Alice Smith","Bob Jones","Charlie Patel","Dana Lee"];
function loadStaff(){ try{ const raw=localStorage.getItem(STAFF_STORAGE_KEY); const arr=raw?JSON.parse(raw):null; return Array.isArray(arr)?arr:[...DEFAULT_STAFF]; } catch { return [...DEFAULT_STAFF]; } }
function saveStaff(list){ localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(list)); }

/* Duties per month */
const DUTY_STORAGE_KEY = "rota.duties"; // { "YYYY-M": { "rowIdx": { "1":"D77", ..., comment:"" } } }
const ymKey = (year, month1)=>`${year}-${month1}`;
function loadDuties(year, month1){ try{ const all=JSON.parse(localStorage.getItem(DUTY_STORAGE_KEY))||{}; return all[ymKey(year,month1)]||{}; } catch { return {}; } }
function saveDuties(year, month1, data){ const all=(()=>{try{return JSON.parse(localStorage.getItem(DUTY_STORAGE_KEY))||{}}catch{return{}}})(); all[ymKey(year,month1)] = data; localStorage.setItem(DUTY_STORAGE_KEY, JSON.stringify(all)); }
function getDuty(dm, staffIdx, day){ return dm?.[staffIdx]?.[day] ?? ""; }
function setDuty(dm, staffIdx, day, val){ if(!dm[staffIdx]) dm[staffIdx]={}; if(val) dm[staffIdx][day]=val; else delete dm[staffIdx][day]; }
function applyDutyStyle(td, value){ td.setAttribute("data-duty", value || ""); }

/* Build header (dates + weekdays + Comments) */
function buildHeader(year, month1){
  const table = document.getElementById("calendar-table");
  let thead = table.querySelector("thead"); if(!thead){ thead=document.createElement("thead"); table.appendChild(thead); }
  thead.innerHTML="";
  const datesRow=document.createElement("tr");
  const staffTh=document.createElement("th"); staffTh.textContent="Staff"; staffTh.className="staff-col"; datesRow.appendChild(staffTh);
  const n=daysInMonth(year, month1);
  for(let d=1; d<=n; d++){
    const th=document.createElement("th");
    const weekdayIdx=new Date(year, month1-1, d).getDay(); // 0=Sun..6=Sat
    th.textContent=d;
    if(weekdayIdx===0 || weekdayIdx===6) th.classList.add("weekend");
    datesRow.appendChild(th);
  }
  const thComment=document.createElement("th"); thComment.textContent="Comments"; datesRow.appendChild(thComment);
  thead.appendChild(datesRow);

  const daysRow=document.createElement("tr");
  const blank=document.createElement("th"); blank.className="staff-col"; daysRow.appendChild(blank);
  for(let d=1; d<=n; d++){
    const th=document.createElement("th");
    const date=new Date(year, month1-1, d);
    const weekdayIdx=date.getDay();
    const wd=date.toLocaleDateString("en-GB",{weekday:"short"});
    th.textContent=wd;
    if(weekdayIdx===0 || weekdayIdx===6) th.classList.add("weekend");
    daysRow.appendChild(th);
  }
  const thComment2=document.createElement("th"); thComment2.textContent=""; daysRow.appendChild(thComment2);
  thead.appendChild(daysRow);

  if(!table.querySelector("tbody")) table.appendChild(document.createElement("tbody"));
}

/* Build body (rows) */
function buildBody(year, month1, staffList){
  const table=document.getElementById("calendar-table");
  const tbody=table.querySelector("tbody"); tbody.innerHTML="";
  const days=daysInMonth(year, month1);
  const dutyMap=loadDuties(year, month1);

  staffList.forEach((name, idx)=>{
    const tr=document.createElement("tr");

    // Staff name cell
    const tdName=document.createElement("td"); tdName.className="staff-col name-cell";
    const nameSpan=document.createElement("span"); nameSpan.className="name"; nameSpan.textContent=name;
    const uCanEdit = canEditRowByName(name);
    nameSpan.contentEditable = uCanEdit ? "true" : "false";
    if(!uCanEdit) tdName.classList.add("readonly");
    nameSpan.addEventListener("keydown",(e)=>{ if(!uCanEdit) return; if(e.key==="Enter"){ e.preventDefault(); nameSpan.blur(); } });
    nameSpan.addEventListener("blur",(e)=>{ if(!uCanEdit) return; const newName=e.currentTarget.textContent.trim(); const list=loadStaff(); if(!newName){ e.currentTarget.textContent=list[idx]; return; } if(newName!==list[idx]){ list[idx]=newName; saveStaff(list); renderAuthBar(); refresh(); } });

    const delBtn=document.createElement("button"); delBtn.className="delete"; delBtn.type="button"; delBtn.textContent="✕"; delBtn.title="Remove staff";
    if(!uCanEdit) delBtn.style.display="none";
    delBtn.addEventListener("click",()=>{ if(!uCanEdit) return; if(confirm(`Remove "${nameSpan.textContent}"?`)){ const list=loadStaff(); list.splice(idx,1); saveStaff(list); if(dutyMap[idx]){ delete dutyMap[idx]; saveDuties(year,month1,dutyMap); } renderAuthBar(); refresh(); } });

    tdName.appendChild(nameSpan); tdName.appendChild(delBtn); tr.appendChild(tdName);

    // Duty cells
    for(let d=1; d<=days; d++){
      const td=document.createElement("td");
      const weekdayIdx=new Date(year, month1-1, d).getDay();
      if(weekdayIdx===0 || weekdayIdx===6) td.classList.add("weekend");

      const sel=document.createElement("select"); sel.className="duty-select";
      DUTY_OPTIONS.forEach(code=>{ const opt=document.createElement("option"); opt.value=code; opt.textContent=code||""; sel.appendChild(opt); });

      const value=getDuty(dutyMap, String(idx), String(d));
      sel.value=value; applyDutyStyle(td, value);
      if(!uCanEdit) sel.disabled = true;

      sel.addEventListener("change",()=>{ if(!uCanEdit) return; applyDutyStyle(td, sel.value); setDuty(dutyMap, String(idx), String(d), sel.value); saveDuties(year, month1, dutyMap); });

      td.appendChild(sel); tr.appendChild(td);
    }

    // Comment cell
    const tdComment=document.createElement("td");
    const commentBox=document.createElement("textarea"); commentBox.className="comment-box"; commentBox.rows=1;
    const existing = dutyMap?.[String(idx)]?.comment || "";
    commentBox.value = existing;
    if(!uCanEdit) { commentBox.readOnly = true; commentBox.style.opacity = 0.75; }
    commentBox.addEventListener("blur",()=>{ if(!uCanEdit) return; const val=(commentBox.value||"").trim(); if(!dutyMap[String(idx)]) dutyMap[String(idx)]={}; dutyMap[String(idx)].comment=val; saveDuties(year, month1, dutyMap); });
    tdComment.appendChild(commentBox); tr.appendChild(tdComment);

    tbody.appendChild(tr);
  });
}

/* Controls */
function refresh(){
  const monthSel=document.getElementById("month"); const yearSel=document.getElementById("year");
  const year=Number(yearSel.value); const month1=Number(monthSel.value);
  buildHeader(year, month1);
  buildBody(year, month1, loadStaff());
}

/* Populate month/year selects */
function initMonthYear(){
  const monthSel=document.getElementById("month"); const yearSel=document.getElementById("year");
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  months.forEach((m,i)=>{ const opt=document.createElement("option"); opt.value=String(i+1); opt.textContent=`${i+1} — ${m}`; monthSel.appendChild(opt); });
  const now=new Date(); const yNow=now.getFullYear();
  for(let y=yNow-1; y<=yNow+2; y++){ const opt=document.createElement("option"); opt.value=String(y); opt.textContent=String(y); yearSel.appendChild(opt); }
  monthSel.value=String(now.getMonth()+1); yearSel.value=String(yNow);
  monthSel.addEventListener("change",refresh);
  yearSel.addEventListener("change",refresh);
}

/* Add staff */
function initStaffControls(){
  const input=document.getElementById("staff-input"); const addBtn=document.getElementById("add-staff");
  if(addBtn && input){
    addBtn.addEventListener("click",()=>{ const name=(input.value||"").trim(); if(!name) return; const list=loadStaff(); list.push(name); saveStaff(list); input.value=""; refresh(); });
    input.addEventListener("keydown",(e)=>{ if(e.key==="Enter") addBtn.click(); });
  }
}

/* ================== ICS export for current user (current month) ================== */
function zero(n){return String(n).padStart(2,"0");}
function ymd(year, month1, day){ return `${year}${zero(month1)}${zero(day)}`; }
function ymdhmsLocal(year, month1, day, hhmm){ const [h,m]=hhmm.split(":").map(Number); return `${ymd(year,month1,day)}T${zero(h)}${zero(m)}00`; }
function nowUtcStamp(){ const d=new Date(); return `${d.getUTCFullYear()}${zero(d.getUTCMonth()+1)}${zero(d.getUTCDate())}T${zero(d.getUTCHours())}${zero(d.getUTCMinutes())}${zero(d.getUTCSeconds())}Z`; }
function escapeText(s=""){ return s.replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n"); }
function slugify(s){ return (s||"").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,""); }

function icsHeader(calName){
  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//rota//webapp//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Europe/London",
    `X-WR-CALNAME:${escapeText(calName)}`
  ].join("\r\n");
}
function icsFooter(){ return "END:VCALENDAR"; }

function makeTimedEvent({uid, dtstamp, year, month1, day, start, end, staff, code, description}){
  const DTSTART = `DTSTART;TZID=Europe/London:${ymdhmsLocal(year, month1, day, start)}`;
  let endY=year, endM=month1, endD=day;
  if (SHIFT_MAP[code]?.overnight) {
    const d = new Date(year, month1-1, day); d.setDate(d.getDate()+1);
    endY=d.getFullYear(); endM=d.getMonth()+1; endD=d.getDate();
  }
  const DTEND = `DTEND;TZID=Europe/London:${ymdhmsLocal(endY, endM, endD, end)}`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    DTSTART,
    DTEND,
    `SUMMARY:${escapeText(`${staff} — ${code}`)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}
function makeAllDayEvent({uid, dtstamp, year, month1, day, staff, code, title, description}){
  const date = ymd(year, month1, day);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:${escapeText(`${staff} — ${title || code}`)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function buildIcsForStaffMonth(staffName){
  const monthSel=document.getElementById("month"); const yearSel=document.getElementById("year");
  const year=Number(yearSel.value); const month1=Number(monthSel.value);
  const days=daysInMonth(year, month1); const dutyMap=loadDuties(year, month1);
  const staffList=loadStaff(); const rowIndex=staffList.indexOf(staffName);
  if(rowIndex===-1){ alert("Staff not found in current list."); return ""; }
  const dtstamp=nowUtcStamp(); const calName=`${staffName} — Rota ${year}-${zero(month1)}`;
  const events=[];
  const staffIdx=String(rowIndex);
  const monthComment = dutyMap?.[staffIdx]?.comment || "";
  for(let day=1; day<=days; day++){
    const code = dutyMap?.[staffIdx]?.[String(day)] || "";
    if(!code) continue;
    const map = SHIFT_MAP[code]; if(!map) continue;
    const uid = `${slugify(staffName)}-${year}${zero(month1)}${zero(day)}-${code}@rota`;
    const description = monthComment ? `Note: ${monthComment}` : "";

    if(map.allDay){
      events.push( makeAllDayEvent({ uid, dtstamp, year, month1, day, staff:staffName, code, title:map.summary, description }) );
    } else {
      events.push( makeTimedEvent({ uid, dtstamp, year, month1, day, start:map.start, end:map.end, staff:staffName, code, description }) );
    }
  }
  return [ icsHeader(calName), events.join("\r\n"), icsFooter() ].join("\r\n");
}
function downloadIcs(filename, content){
  const blob=new Blob([content],{type:"text/calendar;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ================== Boot ================== */
document.addEventListener("DOMContentLoaded", ()=>{
  attachAuthHandlers();
  renderAuthBar();
  initMonthYear();
  initStaffControls();

  // Build initial table
  refresh();

  // Export ICS for logged-in user
  const exportBtn=document.getElementById("export-ics");
  if(exportBtn){
    exportBtn.addEventListener("click",()=>{
      const u=getSessionUser();
      if(!u || !u.staffName){ alert("Log in as a staff user first."); return; }
      const ics = buildIcsForStaffMonth(u.staffName);
      if(!ics) return;
      const y=document.getElementById("year").value;
      const m=document.getElementById("month").value.padStart(2,"0");
      downloadIcs(`${slugify(u.staffName)}-${y}-${m}.ics`, ics);
    });
  }
});

if (!getSessionUser()) {
  window.location.href = "index.html";
}