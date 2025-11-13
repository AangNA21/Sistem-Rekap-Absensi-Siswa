// app.js - Absensi MA/MTs IBADURROHMAN
// Key localStorage: students, classes, attendance

// Utility
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uid = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// Initialize DB with defaults if empty
function loadDB(){
  const students = JSON.parse(localStorage.getItem('students')||'[]');
  const classes = JSON.parse(localStorage.getItem('classes')||'[]');
  const attendance = JSON.parse(localStorage.getItem('attendance')||'{}'); // {date:{studentId: status}}
  return {students, classes, attendance};
}
function saveDB({students, classes, attendance}){
  localStorage.setItem('students', JSON.stringify(students));
  localStorage.setItem('classes', JSON.stringify(classes));
  localStorage.setItem('attendance', JSON.stringify(attendance));
}

// Bootstrap with sample classes if none
(function bootstrap(){
  const {classes, students, attendance} = loadDB();
  if(classes.length === 0){
    classes.push("7A","8A","9A");
  }
  if(students.length === 0){
    students.push({id: uid(), name: "Ahmad", class: "7A"});
    students.push({id: uid(), name: "Siti", class: "7A"});
    students.push({id: uid(), name: "Budi", class: "8A"});
  }
  saveDB({students, classes, attendance});
})();

// App state
let DB = loadDB();
let currentPage = 'dashboard';

// Navigation
$$('.sidebar li').forEach(li=>{
  li.addEventListener('click', ()=> {
    $('.sidebar li.active').classList.remove('active');
    li.classList.add('active');
    gotoPage(li.dataset.page);
  })
});
function gotoPage(page){
  currentPage = page;
  $$('.page').forEach(p=>p.classList.remove('active'));
  $(`#page-${page}`).classList.add('active');
  if(page === 'dashboard') renderDashboard();
  if(page === 'view-students') renderViewStudents();
  if(page === 'manage-students') renderManage();
  if(page === 'rekap') renderRekap();
}

// Render Dashboard charts
let chartOverall, chartPerClass, chartWeekly;
function computeStats(){
  const {students, attendance} = DB;
  // counts
  const totals = {hadir:0, izin:0, sakit:0, alpa:0};
  const perClass = {};
  const last7 = {}; // date->present count
  Object.keys(attendance).forEach(date=>{
    const day = attendance[date];
    let presentCount = 0;
    Object.keys(day).forEach(sid=>{
      const st = day[sid];
      if(st === 'H') { totals.hadir++; presentCount++;}
      if(st === 'I') totals.izin++;
      if(st === 'S') totals.sakit++;
      if(st === 'A') totals.alpa++;
      const stud = students.find(s=>s.id===sid);
      const cls = stud?stud.class:'-';
      perClass[cls] = perClass[cls] || {H:0, total:0};
      perClass[cls].total++;
      if(st==='H') perClass[cls].H++;
    });
    last7[date] = presentCount;
  });
  return {totals, perClass, last7};
}

function renderDashboard(){
  DB = loadDB();
  const stats = computeStats();
  // Chart overall: pie
  const ctx1 = $('#chartOverall').getContext('2d');
  const data1 = {
    labels: ['Hadir','Izin','Sakit','Alpa'],
    datasets:[{data:[stats.totals.hadir, stats.totals.izin, stats.totals.sakit, stats.totals.alpa]}]
  };
  if(chartOverall) chartOverall.destroy();
  chartOverall = new Chart(ctx1,{type:'doughnut', data:data1, options:{responsive:true, maintainAspectRatio:false}});

  // Chart per class (bar of % hadir)
  const clsLabels = Object.keys(stats.perClass);
  const clsData = clsLabels.map(k=>{
    const o = stats.perClass[k];
    const studentsCount = DB.students.filter(s=>s.class===k).length || 1;
    return Math.round((o.H || 0) / Math.max(1, o.total) * 100);
  });
  const ctx2 = $('#chartPerClass').getContext('2d');
  if(chartPerClass) chartPerClass.destroy();
  chartPerClass = new Chart(ctx2, {type:'bar', data:{labels:clsLabels, datasets:[{label:'% Hadir', data:clsData}]}, options:{responsive:true, maintainAspectRatio:false}});

  // Weekly line
  const dates = Object.keys(stats.last7).sort();
  const counts = dates.map(d=>stats.last7[d]);
  const ctx3 = $('#chartWeekly').getContext('2d');
  if(chartWeekly) chartWeekly.destroy();
  chartWeekly = new Chart(ctx3, {type:'line', data:{labels:dates, datasets:[{label:'Jumlah Hadir', data:counts, fill:false}]}, options:{responsive:true, maintainAspectRatio:false}});
}

// VIEW STUDENTS
function renderViewStudents(){
  DB = loadDB();
  const sel = $('#filterClassView');
  sel.innerHTML = '<option value="all">Semua Kelas</option>';
  DB.classes.forEach(c=> sel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
  $('#exportClassPdf').onclick = exportCurrentClassPdf_View;
  sel.onchange = renderStudentsList;
  renderStudentsList();
}

function renderStudentsList(){
  const container = $('#studentsListContainer');
  const klass = $('#filterClassView').value;
  const students = DB.students.filter(s=> klass === 'all' ? true : s.class === klass);
  const attendance = DB.attendance || {};
  // compute per-student totals
  const rows = students.map(s=>{
    let hadir=0, izin=0, sakit=0, alpa=0;
    Object.values(attendance).forEach(day=>{
      const st = day[s.id];
      if(st==='H') hadir++;
      if(st==='I') izin++;
      if(st==='S') sakit++;
      if(st==='A') alpa++;
    });
    return {s, hadir, izin, sakit, alpa};
  });

  let html = `<table class="table"><thead><tr><th>Nama</th><th>Kelas</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpa</th><th>Aksi</th></tr></thead><tbody>`;
  rows.forEach(r=>{
    html += `<tr>
      <td>${r.s.name}</td>
      <td>${r.s.class}</td>
      <td>${r.hadir}</td>
      <td>${r.izin}</td>
      <td>${r.sakit}</td>
      <td>${r.alpa}</td>
      <td>
        <button data-id="${r.s.id}" class="btn small export-student">PDF</button>
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
  // attach event
  $$('.export-student').forEach(btn=>{
    btn.onclick = ()=> exportStudentPdf(btn.dataset.id);
  });
}

// MANAGE
function renderManage(){
  DB = loadDB();
  const classesContainer = $('#classesContainer');
  classesContainer.innerHTML = '';
  DB.classes.forEach(c=>{
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<div style="display:flex;gap:8px;align-items:center">
      <strong>${c}</strong>
      <button class="btn small rename">Edit</button>
      <button class="btn small danger del">Hapus</button>
    </div>`;
    classesContainer.appendChild(div);
    div.querySelector('.rename').onclick = ()=>{
      const newName = prompt('Nama kelas baru', c);
      if(newName) {
        DB.classes = DB.classes.map(x=> x===c ? newName : x);
        DB.students.forEach(s=>{ if(s.class===c) s.class = newName; });
        saveDB(DB); renderManage();
      }
    };
    div.querySelector('.del').onclick = ()=>{
      if(!confirm('Hapus kelas dan pindahkan siswanya ke "-"?')) return;
      DB.classes = DB.classes.filter(x=>x!==c);
      DB.students.forEach(s=>{ if(s.class===c) s.class = '-'; });
      saveDB(DB); renderManage();
    };
  });

  // populate student class select
  const sel = $('#studentClass');
  sel.innerHTML = `<option value="">Pilih Kelas</option>`;
  DB.classes.forEach(c=> sel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));

  // manageStudentsList
  const list = $('#manageStudentsList');
  list.innerHTML = '';
  DB.students.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'manage-row';
    div.innerHTML = `<div><strong>${s.name}</strong><div style="color:var(--muted)">${s.class}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn small edit">Edit</button>
        <button class="btn small warn del">Hapus</button>
      </div>`;
    list.appendChild(div);
    div.querySelector('.edit').onclick = ()=>{
      const newName = prompt('Nama siswa', s.name);
      const newClass = prompt('Kelas', s.class);
      if(newName) s.name = newName;
      if(newClass) s.class = newClass;
      saveDB(DB); renderManage();
    };
    div.querySelector('.del').onclick = ()=>{
      if(!confirm('Hapus siswa?')) return;
      DB.students = DB.students.filter(x=>x.id !== s.id);
      saveDB(DB); renderManage();
    };
  });

  $('#btnAddClass').onclick = ()=>{
    const name = $('#newClassName').value.trim();
    if(!name) return alert('Masukkan nama kelas');
    if(DB.classes.includes(name)) return alert('Kelas sudah ada');
    DB.classes.push(name);
    $('#newClassName').value = '';
    saveDB(DB); renderManage();
  };

  $('#formAddStudent').onsubmit = e=>{
    e.preventDefault();
    const name = $('#studentName').value.trim();
    const cls = $('#studentClass').value;
    if(!name || !cls) return alert('Isi nama dan kelas');
    DB.students.push({id:uid(), name, class:cls});
    $('#studentName').value='';
    saveDB(DB); renderManage();
  };

  $('#btnPromote').onclick = ()=>{
    // Naikkan setiap siswa ke kelas berikutnya berdasarkan urutan DB.classes
    const mapping = {};
    DB.classes.forEach((c, i)=> {
      mapping[c] = DB.classes[i+1] || DB.classes[i]; // jika terakhir tetap
    });
    DB.students.forEach(s=>{
      if(mapping[s.class]) s.class = mapping[s.class];
    });
    saveDB(DB); alert('Naik kelas selesai'); renderManage();
  };
}

// REKAP ABSENSI
function renderRekap(){
  DB = loadDB();
  const sel = $('#filterClassRekap');
  sel.innerHTML = `<option value="all">Semua Kelas</option>`;
  DB.classes.forEach(c=> sel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
  $('#rekapDate').valueAsDate = new Date();
  $('#loadDay').onclick = loadAttendanceForDate;
  $('#exportDayPdf').onclick = exportClassPdf_Rekap;
  loadAttendanceForDate();
}

function loadAttendanceForDate(){
  DB = loadDB();
  const date = $('#rekapDate').value;
  if(!date) return alert('Pilih tanggal');
  const klass = $('#filterClassRekap').value;
  const students = DB.students.filter(s=> klass==='all' ? true : s.class===klass);
  // build UI
  const cont = $('#attendanceContainer');
  let html = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
    <strong>${students.length} siswa</strong>
    <button id="saveDay" class="btn small">Simpan Kehadiran</button>
    </div>`;
  html += `<div class="list">`;
  students.forEach(s=>{
    const status = (DB.attendance[date] && DB.attendance[date][s.id]) || 'H';
    html += `<div class="att-row" data-id="${s.id}">
      <div><strong>${s.name}</strong><div style="color:var(--muted)">${s.class}</div></div>
      <div style="display:flex;gap:6px">
        <select class="selStatus">
          <option value="H"${status==='H'?' selected':''}>Hadir</option>
          <option value="A"${status==='A'?' selected':''}>Alpa</option>
          <option value="S"${status==='S'?' selected':''}>Sakit</option>
          <option value="I"${status==='I'?' selected':''}>Izin</option>
        </select>
      </div>
    </div>`;
  });
  html += `</div>`;
  cont.innerHTML = html;

  document.getElementById('saveDay').onclick = ()=>{
    const rows = $$('#attendanceContainer .att-row');
    DB.attendance = DB.attendance || {};
    DB.attendance[date] = DB.attendance[date] || {};
    rows.forEach(r=>{
      const sid = r.dataset.id;
      const st = r.querySelector('.selStatus').value;
      DB.attendance[date][sid] = st;
    });
    saveDB(DB);
    alert('Kehadiran tersimpan');
  };
}

// EXPORT / PDF utilities
async function exportStudentPdf(studentId){
  DB = loadDB();
  const student = DB.students.find(s=>s.id===studentId);
  if(!student) return alert('Siswa tidak ditemukan');
  const attendance = DB.attendance || {};
  // compile record
  let rows = `<h3>${student.name} — ${student.class}</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Tanggal</th><th>Status</th></tr></thead><tbody>`;
  Object.keys(attendance).sort().forEach(date=>{
    const st = attendance[date][studentId];
    if(st){
      rows += `<tr><td style="padding:6px;border-bottom:1px solid #eee">${date}</td><td style="padding:6px;border-bottom:1px solid #eee">${statusLabel(st)}</td></tr>`;
    }
  });
  rows += '</tbody></table>';
  await htmlToPdf(rows, `${student.name}.pdf`);
}

async function exportCurrentClassPdf_View(){
  const klass = $('#filterClassView').value;
  if(klass === 'all') return alert('Pilih kelas pada dropdown');
  await exportClassPdf(klass);
}

async function exportClassPdf_Rekap(){
  const klass = $('#filterClassRekap').value;
  const date = $('#rekapDate').value;
  if(!date) return alert('Pilih tanggal');
  // create table for class for that date
  const students = DB.students.filter(s=> s.class === klass);
  let html = `<h3>Absensi ${klass} — ${date}</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Nama</th><th>Status</th></tr></thead><tbody>`;
  students.forEach(s=>{
    const st = (DB.attendance[date] && DB.attendance[date][s.id]) || '-';
    html += `<tr><td style="padding:6px;border-bottom:1px solid #eee">${s.name}</td><td style="padding:6px;border-bottom:1px solid #eee">${statusLabel(st)}</td></tr>`;
  });
  html += '</tbody></table>';
  await htmlToPdf(html, `Absensi_${klass}_${date}.pdf`);
}

async function exportClassPdf(klass){
  DB = loadDB();
  const students = DB.students.filter(s=> s.class === klass);
  let html = `<h3>Rekap ${klass}</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th>Nama</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpa</th></tr></thead><tbody>`;
  students.forEach(s=>{
    let hadir=0, izin=0, sakit=0, alpa=0;
    Object.values(DB.attendance||{}).forEach(day=>{
      const st = day[s.id];
      if(st==='H') hadir++;
      if(st==='I') izin++;
      if(st==='S') sakit++;
      if(st==='A') alpa++;
    });
    html += `<tr><td style="padding:6px;border-bottom:1px solid #eee">${s.name}</td><td style="padding:6px;border-bottom:1px solid #eee">${hadir}</td><td style="padding:6px;border-bottom:1px solid #eee">${izin}</td><td style="padding:6px;border-bottom:1px solid #eee">${sakit}</td><td style="padding:6px;border-bottom:1px solid #eee">${alpa}</td></tr>`;
  });
  html += '</tbody></table>';
  await htmlToPdf(html, `Rekap_${klass}.pdf`);
}

// helper for PDF: convert HTML fragment to PDF via html2canvas + jsPDF
async function htmlToPdf(innerHtml, filename='report.pdf'){
  const wrapper = document.createElement('div');
  wrapper.style.padding = '16px';
  wrapper.style.background = 'white';
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);
  // use html2canvas
  const canvas = await html2canvas(wrapper, {scale:2});
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({orientation:'portrait', unit:'pt', format:[canvas.width, canvas.height]});
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
  wrapper.remove();
}

function statusLabel(st){
  switch(st){
    case 'H': return 'Hadir';
    case 'A': return 'Alpa';
    case 'S': return 'Sakit';
    case 'I': return 'Izin';
    default: return '-';
  }
}

// BACKUP & RESTORE
$('#btnBackup').onclick = ()=>{
  DB = loadDB();
  const fileData = JSON.stringify(DB, null, 2);
  const blob = new Blob([fileData], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `absensi_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

$('#importFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!data.students || !data.classes) return alert('File tidak valid');
      localStorage.setItem('students', JSON.stringify(data.students));
      localStorage.setItem('classes', JSON.stringify(data.classes));
      localStorage.setItem('attendance', JSON.stringify(data.attendance || {}));
      DB = loadDB();
      alert('Restore selesai');
      // refresh current page
      gotoPage(currentPage);
    }catch(err){
      alert('Gagal membaca file: '+err.message);
    }
  };
  reader.readAsText(file);
});

// Reset local DB
$('#btnReset').onclick = ()=>{
  if(!confirm('Reset semua data lokal?')) return;
  localStorage.removeItem('students');
  localStorage.removeItem('classes');
  localStorage.removeItem('attendance');
  location.reload();
};

// Small UI interactivity: pages need IDs mapping
// ensure pages have id page-dashboard etc. Our nav uses data-page values that match suffix after "page-"
(function init(){
  // Map nav page names to actual page IDs
  // default to dashboard
  gotoPage('dashboard');
  // wire up initial functions
  // Also auto refresh charts occasionally when db changes (simple)
  window.addEventListener('storage', ()=> { DB = loadDB(); if(currentPage==='dashboard') renderDashboard(); });
})();
