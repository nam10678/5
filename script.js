// Optimized script for BCR AI UI
let history = [];
let model = null;
const oneHotMap = {'P':[1,0,0],'B':[0,1,0],'T':[0,0,1]};
const numToLabel = ['P','B','T'];
let chart = null;

async function loadModel(){
  try{
    model = await tf.loadLayersModel('tfjs_model/model.json');
    console.log('Model loaded');
    document.getElementById('warnings').innerText = '';
  }catch(e){
    console.error('Model load error', e);
    document.getElementById('warnings').innerText = 'Lỗi tải mô hình: '+ (e.message || e);
  }
}
loadModel();

function addResult(r){
  if(history.length >= 200) history.shift();
  history.push(r);
  saveAndUpdate();
  if(history.length >= 5) predictAuto();
}

function resetHistory(){
  if(confirm('Xóa toàn bộ lịch sử?')){
    history=[];
    saveAndUpdate();
    clearPrediction();
  }
}

function exportHistory(){
  if(history.length===0){ alert('Không có dữ liệu để xuất'); return; }
  const csv = history.map((v,i)=> (i+1)+','+v).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'baccarat_history.csv'; a.click();
  URL.revokeObjectURL(url);
}

function saveAndUpdate(){
  localStorage.setItem('bcr_history_v1', JSON.stringify(history));
  renderHistory();
  drawChart();
  checkAlerts();
}

function renderHistory(){
  const el = document.getElementById('history');
  if(history.length===0){ el.innerText = '—'; return; }
  el.innerHTML = '';
  history.slice(-50).forEach((h,i)=>{
    const span = document.createElement('span');
    span.className = 'hist-item';
    span.innerText = h;
    span.style.padding = '6px 8px';
    span.style.borderRadius = '6px';
    span.style.marginRight = '6px';
    span.style.background = h==='P' ? '#22c55e' : h==='B' ? '#ef4444' : '#9ca3af';
    span.style.color = h==='T' ? '#0f1724' : '#ffffff';
    el.appendChild(span);
  });
}

function checkAlerts(){
  const warn = document.getElementById('warnings');
  warn.innerText = '';
  if(history.length>=4){
    const last4 = history.slice(-4);
    if(last4.every(x=>x===last4[0])){ warn.innerText = 'Cảnh báo: 4 ván cùng kết quả liên tiếp!'; return; }
  }
  // detect long streak
  if(history.length>=6){
    const last = history[history.length-1];
    let streak=1; for(let i=history.length-2;i>=0;i--){ if(history[i]===last) streak++; else break; }
    if(streak>=6) warn.innerText = 'Cảnh báo: cầu bệt dài ('+streak+' ván)!';
  }
}

function oneHotInput(last5){
  // produce flat 15-length array
  return last5.flatMap(v=> oneHotMap[v] || [0,0,0]);
}

async function predictAuto(){
  if(!model){ document.getElementById('warnings').innerText = 'Mô hình chưa load.'; return; }
  const last5 = history.slice(-5);
  if(last5.length<5) return;
  const inputArr = oneHotInput(last5);
  try{
    const t = tf.tensor2d([inputArr], [1,15], 'float32');
    const out = model.predict(t);
    const probs = await out.data();
    const idx = probs.indexOf(Math.max(...probs));
    const label = numToLabel[idx];
    const conf = (probs[idx]*100).toFixed(2);
    showPrediction(label, conf);
  }catch(e){
    console.error('Predict error', e);
    document.getElementById('warnings').innerText = 'Lỗi dự đoán: '+ (e.message || e);
  }
}

function showPrediction(label, conf){
  const lbl = document.getElementById('predicted-label');
  const confEl = document.getElementById('confidence');
  lbl.innerText = label;
  confEl.innerText = conf + '%';
  if(label==='P'){ lbl.style.background = '#22c55e'; lbl.style.color='#022c0b'; }
  else if(label==='B'){ lbl.style.background = '#ef4444'; lbl.style.color='#2a0404'; }
  else { lbl.style.background = '#9ca3af'; lbl.style.color='#0f1724'; }
}

function drawChart(){
  const ctx = document.getElementById('historyChart').getContext('2d');
  const labels = history.map((_,i)=> i+1);
  const dataVals = history.map(h=> h==='P'?0: h==='B'?1:2);
  const bgColors = history.map(h=> h==='P'? '#22c55e' : h==='B'? '#ef4444' : '#9ca3af');
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Lịch sử (P=0,B=1,T=2)',
        data: dataVals,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.08)',
        tension: 0.25,
        pointBackgroundColor: bgColors,
        pointRadius: 6
      }]
    },
    options: {
      scales: {
        y: {
          min: -0.2, max: 2.2,
          ticks: { stepSize: 1, callback: v=> v===0?'P': v===1?'B':'T' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  try{ const stored = JSON.parse(localStorage.getItem('bcr_history_v1')||'[]'); if(Array.isArray(stored)) history = stored; }catch(e){ history=[]; }
  renderHistory();
  drawChart();
  if(history.length>=5) predictAuto();
});
