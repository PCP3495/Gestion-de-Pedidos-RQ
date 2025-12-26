// --------------------------------------------------------------------------------------
// Datos iniciales + persistencia
// --------------------------------------------------------------------------------------
const initialPedidos = [
  { id: 3, fechaProduccion: "2025-11-10", fechaEntrega: "2025-11-10", dias: 5, cliente: "C",  art: "KIT-010", dificultad: 3, kits: 5000, mesas: 4, entregado: false, noAplicaMesa: false, orderNumber: 1003, grabado: "NO APLICA" },
  { id: 4, fechaProduccion: "2025-11-24", fechaEntrega: "2025-11-24", dias: 5, cliente: "E",  art: "KIT-015", dificultad: 2, kits: 14000, mesas: 6, entregado: false, noAplicaMesa: false, orderNumber: 1004, grabado: "NO APLICA" },
  { id: 5, fechaProduccion: "2025-12-15", fechaEntrega: "2025-12-15", dias: 5, cliente: "H",  art: "KIT-003", dificultad: 2, kits: 11500, mesas: 5, entregado: false, noAplicaMesa: false, orderNumber: 1005, grabado: "NO APLICA" },
  { id: 6, fechaProduccion: "2025-12-29", fechaEntrega: "2025-12-29", dias: 3, cliente: "J",  art: "KIT-006", dificultad: 2, kits: 3000, mesas: 4, entregado: false, noAplicaMesa: false, orderNumber: 1006, grabado: "NO APLICA" },
];

let pedidosData = JSON.parse(localStorage.getItem('pedidosData'));
if (!pedidosData || pedidosData.length === 0) pedidosData = initialPedidos;
const GRABADO_DEFAULT = "NO APLICA";

// Migración de datos antiguos: si no existe fechaProduccion, asumir fechaEntrega.
pedidosData = pedidosData.map(p => {
  const fechaProduccion = p.fechaProduccion || p.fechaEntrega;
  return {
    entregado:false,
    noAplicaMesa:false,
    orderNumber: p.orderNumber ?? p.id,
    grabado: p.grabado ?? GRABADO_DEFAULT,
    semana: p.semana,           // se recalcula abajo con fechaProduccion
    ...p,
    fechaProduccion
  };
});

let capacidadConfig  = JSON.parse(localStorage.getItem('capacidadConfig'))  || {};
let mesasInputValues = JSON.parse(localStorage.getItem('mesasInputValues')) || {};
let nextId = pedidosData.length ? Math.max(...pedidosData.map(p=>p.id||0))+1 : 1;

function guardarDatos(){
  localStorage.setItem('pedidosData', JSON.stringify(pedidosData));
  localStorage.setItem('capacidadConfig', JSON.stringify(capacidadConfig));
  localStorage.setItem('mesasInputValues', JSON.stringify(mesasInputValues));
}

// --------------------------------------------------------------------------------------
// Utilidades: semanas Domingo->Sábado (por FECHA DE PRODUCCIÓN)
// --------------------------------------------------------------------------------------
function getFirstSunday(year){
  const d = new Date(year, 0, 1);
  const offset = (7 - d.getDay()) % 7; // Domingo=0
  d.setDate(d.getDate() + offset);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function getWeekNumber(d){
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const firstSunday = getFirstSunday(date.getFullYear());
  if (date < firstSunday) return 1;
  const diffDays = Math.floor((date - firstSunday) / 86400000);
  return 1 + Math.floor(diffDays / 7);
}
function formatDate(iso){
  if(!iso) return 'N/A';
  const [y,m,da] = iso.split('-');
  return `${da}/${m}/${y}`;
}
function getCapacidadSemanal(semana){
  const base = parseInt(document.getElementById('kitsPorDia').value) || 1000;
  if(!capacidadConfig[semana]) return { diasProd:5, kitsPorDia:base };
  return {
    diasProd:  parseInt(capacidadConfig[semana].diasProd)  || 5,
    kitsPorDia:parseInt(capacidadConfig[semana].kitsPorDia)|| base
  };
}
function esNumeroPedidoDuplicado(numero, excludeId = null){
  if (!numero) return false;
  return pedidosData.some(p => String(p.orderNumber) === String(numero) && p.id !== excludeId);
}

// --------------------------------------------------------------------------------------
// Filtros con multi-dropdown (no se aplican hasta “Aplicar filtros”)
// --------------------------------------------------------------------------------------
const selectedFilters = {
  clientes: new Set(),
  arts: new Set(),
  grabados: new Set(),
};
function getCurrentReportFilters(){
  const desde   = document.getElementById('filtroDesde')?.value || '';
  const hasta   = document.getElementById('filtroHasta')?.value || '';
  const noAplica = document.getElementById('filtroNoAplica')?.value || 'all';
  return {
    clientes: Array.from(selectedFilters.clientes),
    arts:     Array.from(selectedFilters.arts),
    grabados: Array.from(selectedFilters.grabados),
    desde, hasta, noAplica
  };
}
function baseFilterList(list){
  const {clientes, arts, grabados, desde, hasta, noAplica} = getCurrentReportFilters();
  const d1 = desde ? new Date(desde) : null;
  const d2 = hasta ? new Date(hasta) : null;
  return list.filter(p=>{
    const okCli  = (clientes.length===0) || clientes.includes(String(p.cliente));
    const okArt  = (arts.length===0)     || arts.includes(String(p.art));
    const okGrab = (grabados.length===0) || grabados.includes(String(p.grabado));
    const f = new Date(p.fechaProduccion); // filtros por producción
    const okD1 = !d1 || f >= d1;
    const okD2 = !d2 || f <= d2;
    const okNA = (noAplica==='all') ||
                 (noAplica==='soloNoAplica' && p.noAplicaMesa) ||
                 (noAplica==='soloAplica' && !p.noAplicaMesa);
    return okCli && okArt && okGrab && okD1 && okD2 && okNA;
  });
}
function getFilteredPedidos(){ return baseFilterList(pedidosData); }
function getActivePedidosForUI(){
  const checked = document.getElementById('toggleAplicarFiltrosUI')?.checked;
  return checked ? baseFilterList(pedidosData) : pedidosData;
}

function uniq(arr){return [...new Set(arr)].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b)));}

function buildMultiMenu(containerId, values, key, btnId){
  const menu = document.getElementById(containerId);
  const btn  = document.getElementById(btnId);
  if(!menu || !btn) return;

  menu.innerHTML = '';
  uniq(values).forEach(v=>{
    const lab = document.createElement('label');
    lab.className = 'md-option';
    const ch = document.createElement('input');
    ch.type='checkbox'; ch.value=v; ch.checked = selectedFilters[key].has(v);
    ch.addEventListener('change', ()=>{
      if (ch.checked) selectedFilters[key].add(v);
      else selectedFilters[key].delete(v);
      btn.textContent = `Seleccionar (${selectedFilters[key].size})`;
    });
    lab.appendChild(ch); lab.append(` ${v}`);
    menu.appendChild(lab);
  });

  const act = document.createElement('div');
  act.className = 'md-actions';
  const clear = document.createElement('button');
  clear.type='button'; clear.className='md-clear'; clear.textContent='Limpiar';
  clear.addEventListener('click', ()=>{
    selectedFilters[key].clear();
    menu.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=false);
    btn.textContent='Seleccionar (0)';
  });
  const close = document.createElement('button');
  close.type='button'; close.className='md-close'; close.textContent='Cerrar';
  close.addEventListener('click', ()=> menu.parentElement.classList.remove('open'));
  act.appendChild(clear); act.appendChild(close);
  menu.appendChild(act);

  btn.onclick = ()=> menu.parentElement.classList.toggle('open');
}
document.addEventListener('click', e=>{
  document.querySelectorAll('.multi-dropdown.open').forEach(dd=>{
    if(!dd.contains(e.target)) dd.classList.remove('open');
  });
});
function updateMdButtonCounts(){
  const map = { clientes: 'md-btn-cliente', arts:'md-btn-art', grabados:'md-btn-grabado' };
  Object.entries(map).forEach(([k,btnId])=>{
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = `Seleccionar (${selectedFilters[k].size})`;
  });
}
function populateFiltros(){
  buildMultiMenu('md-menu-cliente', pedidosData.map(p=>p.cliente), 'clientes', 'md-btn-cliente');
  buildMultiMenu('md-menu-art',     pedidosData.map(p=>p.art),     'arts',     'md-btn-art');

  const menuGrab = document.getElementById('md-menu-grabado');
  if (menuGrab){
    menuGrab.querySelectorAll('input[type="checkbox"]').forEach(ch=>{
      ch.checked = selectedFilters.grabados.has(ch.value);
      ch.addEventListener('change', ()=>{
        if(ch.checked) selectedFilters.grabados.add(ch.value);
        else selectedFilters.grabados.delete(ch.value);
        updateMdButtonCounts();
      });
    });
  }
  updateMdButtonCounts();
}

// --------------------------------------------------------------------------------------
// Dashboard superior
// --------------------------------------------------------------------------------------
function updateDashboardMetrics(agrupe){
  const now = new Date();
  document.getElementById('metric-last-update').textContent =
    `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

  const totalAplican = pedidosData.reduce((s,p)=> s + (!p.noAplicaMesa ? p.kits : 0), 0);
  const totalGranel  = pedidosData.reduce((s,p)=> s + ( p.noAplicaMesa ? p.kits : 0), 0);
  document.getElementById('metric-total-kits').textContent   = totalAplican.toLocaleString('es');
  document.getElementById('metric-total-granel').textContent = totalGranel.toLocaleString('es');

  const cont = document.getElementById('weekly-metrics-container');
  cont.innerHTML = '';
  Object.keys(agrupe).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(sem=>{
    const { diasProd, kitsPorDia } = getCapacidadSemanal(sem);
    const mesas = agrupe[sem].mesas ?? 0;
    const capacidad = diasProd * kitsPorDia * mesas;
    const demanda   = agrupe[sem].kitsSolicitadosAjustados;

    const div = document.createElement('div');
    div.className = 'week-metric';
    div.innerHTML = `
      <h3>Semana ${sem}</h3>
      <div class="metric-duo">
        <div class="pill">Demanda: ${demanda.toLocaleString('es')}</div>
        <div class="pill capacity">Capacidad: ${capacidad.toLocaleString('es')}</div>
      </div>`;
    cont.appendChild(div);
  });
}

// --------------------------------------------------------------------------------------
// Select de Grabado en tabla
// --------------------------------------------------------------------------------------
const GRABADO_OPCIONES = ["NO APLICA","ESTAMPADO","TALLER POLIFAM","TALLER MARIANO","ESTAMPADO OK"];
function crearSelectGrabado(pedido){
  const sel = document.createElement('select');
  sel.className = 'select-grabado';
  GRABADO_OPCIONES.forEach(op=>{
    const o = document.createElement('option');
    o.value = op; o.textContent = op;
    if ((pedido.grabado||GRABADO_DEFAULT) === op) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', e=>{
    const idx = pedidosData.findIndex(x=>x.id===pedido.id);
    if (idx === -1) return;
    pedidosData[idx].grabado = e.target.value;
    guardarDatos();
  });
  return sel;
}

// --------------------------------------------------------------------------------------
// Simulación (tabla)
// --------------------------------------------------------------------------------------
let rowByPedidoId = {};
function simularProduccion(){
  const base = parseInt(document.getElementById('kitsPorDia').value)||1000;
  document.getElementById('capacidadMesaDiaria').textContent = base.toLocaleString('es');

  const tbody = document.querySelector('#simuladorTabla tbody'); tbody.innerHTML = '';
  const tcfg  = document.querySelector('#configCapacidadTabla tbody'); tcfg.innerHTML = '';
  const pedidosList = getActivePedidosForUI();
  rowByPedidoId = {};

  const g = pedidosList.reduce((acc,p)=>{
    // Semana basada en fechaProduccion
    const semana = getWeekNumber(new Date(p.fechaProduccion));
    p.semana = semana;

    const k = semana;
    if(!acc[k]) acc[k] = {
      semana: k,
      fechaProduccion: p.fechaProduccion,
      mesas: mesasInputValues[k] ?? p.mesas,
      kitsSolicitadosAjustados: 0, kitsSolicitadosReales: 0, pedidos: []
    };
    if (!p.noAplicaMesa) acc[k].kitsSolicitadosAjustados += p.kits;
    acc[k].kitsSolicitadosReales  += p.kits;
    acc[k].pedidos.push(p);
    return acc;
  },{});

  updateDashboardMetrics(g);
  const semanas = Object.keys(g).sort((a,b)=>parseInt(a)-parseInt(b));

  semanas.forEach((semana, idx)=>{
    const sem = g[semana];
    const {diasProd, kitsPorDia} = getCapacidadSemanal(semana);
    const capMesa = diasProd * kitsPorDia;

    // fila de configuración
    const rcfg = tcfg.insertRow();
    rcfg.insertCell().textContent = semana;

    const cDias = rcfg.insertCell();
    const inDias = document.createElement('input');
    inDias.type='number'; inDias.min=0; inDias.step=1; inDias.value=diasProd; inDias.dataset.semana=semana;
    inDias.addEventListener('input', manejarCambioCapacidad);
    cDias.appendChild(inDias);

    const cKits = rcfg.insertCell();
    const inKits = document.createElement('input');
    inKits.type='number'; inKits.min=0; inKits.step=10; inKits.value=kitsPorDia; inKits.dataset.semana=semana;
    inKits.addEventListener('input', manejarCambioCapacidad);
    cKits.appendChild(inKits);

    rcfg.insertCell().textContent = capMesa.toLocaleString('es');

    // cálculos semana
    const mesas = sem.mesas;
    const capTotal = capMesa * mesas;
    const diff = capTotal - sem.kitsSolicitadosAjustados;
    const estadoClase = diff >= 0 ? 'estado-ok' : 'estado-deficit';
    const estadoTxt   = diff >= 0 ? '✅ Suficiente' : '❌ DÉFICIT';

    sem.pedidos.forEach((p, irow)=>{
      const r = tbody.insertRow();
      r.dataset.pid = p.id; rowByPedidoId[p.id] = r;
      r.classList.add(`semana-${idx%2===0?'even':'odd'}`);
      if (p.entregado)   r.classList.add('row-entregado');
      if (p.noAplicaMesa)r.classList.add('row-noaplica');

      // Columnas (con nueva "Fecha Prod." y "Fecha Entrega")
      r.insertCell().textContent = p.semana;
      r.insertCell().textContent = formatDate(p.fechaProduccion);
      r.insertCell().textContent = formatDate(p.fechaEntrega);
      r.insertCell().textContent = p.orderNumber ?? p.id;
      r.insertCell().textContent = p.cliente;
      r.insertCell().textContent = p.art;
      r.insertCell().textContent = p.kits.toLocaleString('es');

      const cGrab = r.insertCell(); cGrab.appendChild(crearSelectGrabado(p));

      if (irow === 0){
        const cMesas = r.insertCell();
        const inMesas = document.createElement('input');
        inMesas.type='number'; inMesas.min=0; inMesas.step=1; inMesas.value=mesas; 
        inMesas.className='mesas-input';
        inMesas.addEventListener('input', e=>{
          mesasInputValues[semana] = parseInt(e.target.value)||0;
          guardarDatos(); simularProduccion();
        });
        cMesas.appendChild(inMesas);

        const cCap   = r.insertCell(); cCap.textContent   = capTotal.toLocaleString('es');
        const cDem   = r.insertCell(); cDem.textContent   = sem.kitsSolicitadosAjustados.toLocaleString('es');
        const cDisp  = r.insertCell(); cDisp.textContent  = diff.toLocaleString('es');
        const cEst   = r.insertCell(); cEst.textContent   = estadoTxt; cEst.classList.add(estadoClase);

        [cMesas, cCap, cDem, cDisp, cEst].forEach(td => td.rowSpan = sem.pedidos.length);
      }

      const cAcc = r.insertCell(); cAcc.className='action-buttons';
      const btnEnt = document.createElement('button');
      btnEnt.className = 'btn-entregado' + (p.entregado ? ' is-on' : '');
      btnEnt.textContent = p.entregado ? 'Entregado' : 'Entregar';
      btnEnt.title = p.entregado ? 'Desmarcar entregado' : 'Marcar como entregado';
      btnEnt.addEventListener('click', ()=> toggleEntregado(p.id));

      const btnNA = document.createElement('button');
      btnNA.className = 'btn-noaplica' + (p.noAplicaMesa ? ' is-on' : '');
      btnNA.textContent = 'No aplica';
      btnNA.title = 'Alternar: no suma a demanda';
      btnNA.addEventListener('click', ()=> toggleNoAplicaMesa(p.id));

      const btnEdit = document.createElement('button');
      btnEdit.className='edit-btn'; btnEdit.title='Editar';
      btnEdit.innerHTML='<i class="fas fa-edit"></i>';
      btnEdit.onclick = ()=>cargarPedidoParaEdicion(p.id);

      const btnDel = document.createElement('button');
      btnDel.className='delete-btn'; btnDel.title='Eliminar';
      btnDel.innerHTML='<i class="fas fa-trash"></i>';
      btnDel.onclick = ()=>eliminarPedido(p.id);

      cAcc.appendChild(btnEnt); cAcc.appendChild(btnNA); cAcc.appendChild(btnEdit); cAcc.appendChild(btnDel);
    });

    const sep = tbody.insertRow(); const td = sep.insertCell(); td.colSpan = 14; sep.classList.add('week-separator');
  });

  dibujarGrafico();
}
function toggleEntregado(id){
  const idx = pedidosData.findIndex(p=>p.id===id);
  if (idx === -1) return;
  pedidosData[idx].entregado = !pedidosData[idx].entregado;
  guardarDatos(); simularProduccion();
}
function toggleNoAplicaMesa(id){
  const idx = pedidosData.findIndex(p=>p.id===id);
  if (idx === -1) return;
  pedidosData[idx].noAplicaMesa = !pedidosData[idx].noAplicaMesa;
  guardarDatos(); simularProduccion();
}

// === Editar / Borrar ===
function cargarPedidoParaEdicion(id){
  const p = pedidosData.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('pedidoIndex').value = p.id;
  document.getElementById('numeroPedido').value = p.orderNumber ?? '';
  document.getElementById('cliente').value = p.cliente;
  document.getElementById('articulo').value = p.art;
  document.getElementById('kitsCantidad').value = p.kits;
  document.getElementById('fechaProduccion').value = p.fechaProduccion;
  document.getElementById('fechaEntrega').value = p.fechaEntrega;
  document.getElementById('semanaEntrega').value = getWeekNumber(new Date(p.fechaProduccion));
  const b=document.getElementById('submitButton');
  b.textContent='Guardar Cambios'; b.style.background='#007bff';
  document.querySelector('.pedidos-form').scrollIntoView({behavior:'smooth', block:'start'});
}
function eliminarPedido(id){
  const p = pedidosData.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`¿Eliminar el pedido ${p.orderNumber ?? p.id} (${p.cliente} · ${p.art})?`)) return;
  pedidosData = pedidosData.filter(x=>x.id!==id);
  guardarDatos(); simularProduccion(); populateFiltros();
}

// --------------------------------------------------------------------------------------
// Gráfico
// --------------------------------------------------------------------------------------
function dibujarGrafico(){
  if (typeof Chart === 'undefined') return;
  const pedidosList = getActivePedidosForUI();
  const ag = pedidosList.reduce((acc,p)=>{
    const semana = getWeekNumber(new Date(p.fechaProduccion));
    if(!acc[semana]) acc[semana]={mesas:mesasInputValues[semana]??p.mesas,kits:0};
    if (!p.noAplicaMesa) acc[semana].kits += p.kits;
    return acc;
  },{});
  const semanas = Object.keys(ag).sort((a,b)=>parseInt(a)-parseInt(b));
  const labels=[],cap=[],dem=[];
  semanas.forEach(s=>{
    const {diasProd,kitsPorDia}=getCapacidadSemanal(s);
    labels.push(`Semana ${s}`);
    cap.push(diasProd*kitsPorDia*(ag[s].mesas));
    dem.push(ag[s].kits);
  });

  const ctx = document.getElementById('produccionChart');
  if (window.produccionChartInstance) window.produccionChartInstance.destroy();
  window.produccionChartInstance = new Chart(ctx,{
    type:'bar',
    data:{labels, datasets:[
      {label:'Capacidad Total (AJUSTADA)', data:cap, backgroundColor:'rgba(54,162,235,.7)'},
      {label:'Demanda Solicitada (AJUSTADA)', data:dem, backgroundColor:'rgba(255,99,132,.7)'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}
  });
}

// --------------------------------------------------------------------------------------
// Informes (CSV / PDF)
// --------------------------------------------------------------------------------------
function exportCSV(){
  const pedidos = getFilteredPedidos();
  const head = ['Semana','Fecha Producción','Fecha Entrega','N° Pedido','Cliente','Art.','Cantidad','Grabado','No Aplica Mesa'];
  const csv = [head.join(',')];
  pedidos.forEach(p=>{
    csv.push([
      getWeekNumber(new Date(p.fechaProduccion)),
      p.fechaProduccion,
      p.fechaEntrega,
      (p.orderNumber ?? p.id),
      `"${p.cliente}"`,
      `"${p.art}"`,
      p.kits,
      `"${p.grabado ?? GRABADO_DEFAULT}"`,
      p.noAplicaMesa ? 'SI' : 'NO'
    ].join(','));
  });
  const blob = new Blob([csv.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  const d=new Date(); const stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  a.download = `pedidos_detalle_${stamp}.csv`; a.click(); URL.revokeObjectURL(url);
}
function getResumenSemanal(){
  const pedidos = getFilteredPedidos();
  const r = {};
  pedidos.forEach(p=>{
    const s=getWeekNumber(new Date(p.fechaProduccion));
    if(!r[s]){
      const {diasProd,kitsPorDia} = getCapacidadSemanal(s);
      const mesas = (mesasInputValues[s]!==undefined)?mesasInputValues[s]:p.mesas;
      r[s] = { semana:s, diasProd, kitsPorDia, capacidadMesaSemana:diasProd*kitsPorDia, mesas, demandaTotal:0 };
    }
    if (!p.noAplicaMesa) r[s].demandaTotal += p.kits;
  });
  return Object.keys(r).sort((a,b)=>parseInt(a)-parseInt(b)).map(s=>{
    const x=r[s], capTot=x.capacidadMesaSemana*x.mesas, dif=capTot-x.demandaTotal;
    return { ...x, capacidadTotal:capTot, demandaTotal:x.demandaTotal, diferencia:dif, estado:(dif>=0?'OK':'DÉFICIT') };
  });
}
function printReport(){
  const filas = getResumenSemanal();
  const pedidos = getFilteredPedidos();
  const {clientes,arts,grabados,desde,hasta,noAplica} = getCurrentReportFilters();
  let chartImgHTML = '';
  if (window.produccionChartInstance){
    try{ chartImgHTML = `<div style="margin:10px 0;"><img src="${window.produccionChartInstance.toBase64Image()}" style="max-width:100%;height:auto"/></div>`; }catch{}
  }
  let filtrosHTML = '<div class="sub" style="color:#666;margin-bottom:6px;">';
  const partes=[];
  if(clientes.length) partes.push(`Cliente(s): <b>${clientes.join(', ')}</b>`);
  if(arts.length)     partes.push(`Art.: <b>${arts.join(', ')}</b>`);
  if(grabados.length) partes.push(`Grabado(s): <b>${grabados.join(', ')}</b>`);
  if(desde)   partes.push(`Desde: <b>${formatDate(desde)}</b>`);
  if(hasta)   partes.push(`Hasta: <b>${formatDate(hasta)}</b>`);
  if(noAplica && noAplica!=='all'){
    partes.push(`No aplica: <b>${noAplica==='soloNoAplica'?'Solo No Aplica':'Solo Aplica'}</b>`);
  }
  filtrosHTML += (partes.length?`Filtros → ${partes.join(' · ')}`:'Sin filtros'); filtrosHTML+='</div>';

  const theadResumen = `
    <tr>
      <th style="text-align:left;">Semana</th><th>Días</th><th>Kits/Mesa/Día</th>
      <th>Cap./Mesa/Sem.</th><th>Mesas</th><th>Cap. Total (Aj.)</th>
      <th>Demanda (Aj.)</th><th>Diferencia</th><th>Estado</th>
    </tr>`;
  const rowsResumen = filas.map(f=>`
    <tr>
      <td style="text-align:left;">${f.semana}</td>
      <td>${f.diasProd}</td>
      <td>${f.kitsPorDia.toLocaleString('es')}</td>
      <td>${f.capacidadMesaSemana.toLocaleString('es')}</td>
      <td>${f.mesas}</td>
      <td>${f.capacidadTotal.toLocaleString('es')}</td>
      <td>${f.demandaTotal.toLocaleString('es')}</td>
      <td>${f.diferencia.toLocaleString('es')}</td>
      <td>${f.estado}</td>
    </tr>`).join('');

  const colgroupDetalle = `
    <colgroup><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:18%"><col style="width:20%"><col style="width:10%"><col style="width:20%"></colgroup>`;
  const theadDet = `
    <tr>
      <th style="text-align:left;">Semana</th><th>Fecha Prod.</th><th>Fecha Entrega</th><th>N° Pedido</th><th style="text-align:left;">Cliente</th><th style="text-align:left;">Art.</th><th>Cantidad</th><th style="text-align:left;">Grabado</th>
    </tr>`;
  const rowsDet = pedidos.map(p=>`
    <tr>
      <td style="text-align:left;">${getWeekNumber(new Date(p.fechaProduccion))}</td>
      <td>${formatDate(p.fechaProduccion)}</td>
      <td>${formatDate(p.fechaEntrega)}</td>
      <td>${p.orderNumber ?? p.id}</td>
      <td style="text-align:left;">${p.cliente}</td>
      <td style="text-align:left;">${p.art}</td>
      <td>${p.kits.toLocaleString('es')}</td>
      <td style="text-align:left;">${p.grabado ?? GRABADO_DEFAULT}</td>
    </tr>`).join('');

  const w = window.open('','_blank');
  w.document.write(`
    <html><head><meta charset="UTF-8"/><title>Informe de Pedidos</title>
    <style>
      body{font-family:Arial,sans-serif;padding:14px;color:#333}
      h1{margin:0 0 4px 0;color:#004d99}
      h2{margin:14px 0 6px 0;color:#004d99}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:center}
      th{background:#f0f3f6}
      .foot{margin-top:8px;font-size:11px;color:#666}
      .det th:nth-child(1), .det td:nth-child(1),
      .det th:nth-child(5), .det td:nth-child(5),
      .det th:nth-child(6), .det td:nth-child(6),
      .det th:nth-child(8), .det td:nth-child(8){ text-align:left; }
      @media print{@page{size:auto;margin:12mm}}
    </style></head><body>
      <h1>Informe de Pedidos</h1>
      ${filtrosHTML}
      ${chartImgHTML}

      <h2>Resumen semanal</h2>
      <table><thead>${theadResumen}</thead><tbody>${rowsResumen}</tbody></table>

      <h2>Detalle de pedidos</h2>
      <table class="det">${colgroupDetalle}<thead>${theadDet}</thead><tbody>${rowsDet}</tbody></table>

      <div class="foot">Fuente: Control Pedidos RQ</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  w.document.close();
}

// --------------------------------------------------------------------------------------
// Buscar N° de pedido
// --------------------------------------------------------------------------------------
function mostrarPedidoEnTabla(p){
  document.getElementById('filtroDesde').value = '';
  document.getElementById('filtroHasta').value = '';
  document.getElementById('filtroNoAplica').value = 'all';
  selectedFilters.clientes.clear(); selectedFilters.arts.clear(); selectedFilters.grabados.clear();
  updateMdButtonCounts();
  simularProduccion();
  const row = rowByPedidoId[p.id];
  if(row){
    row.classList.add('row-highlight');
    row.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>row.classList.remove('row-highlight'), 2000);
  }
}
function buscarPedidoPorNumero(){
  const input = document.getElementById('buscarNumero');
  if(!input){ alert('No se encontró el campo de búsqueda.'); return; }
  const val = (input.value || '').trim();
  if(val === ''){ alert('Ingresá un N° de pedido.'); input.focus(); return; }
  const p = pedidosData.find(x => String(x.orderNumber) === val);
  if(!p){ alert(`No se encontró el pedido ${val}.`); return; }
  const row = rowByPedidoId[p.id];
  if(row){
    row.classList.add('row-highlight');
    row.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>row.classList.remove('row-highlight'), 2000);
  }else{
    if(confirm(`Pedido ${val} encontrado.\nCliente: ${p.cliente}\nArtículo: ${p.art}\nCantidad: ${p.kits}\nSemana (por prod.): ${getWeekNumber(new Date(p.fechaProduccion))}\n\n¿Mostrar en la tabla?`)){
      mostrarPedidoEnTabla(p);
    }
  }
}

// --------------------------------------------------------------------------------------
// Eventos y boot
// --------------------------------------------------------------------------------------
function manejarCambioCapacidad(e){
  const semana = e.target.dataset.semana;
  if(!capacidadConfig[semana]) capacidadConfig[semana] = getCapacidadSemanal(semana);
  if(e.target.parentNode.cellIndex===1) capacidadConfig[semana].diasProd = parseInt(e.target.value) || 0;
  else if(e.target.parentNode.cellIndex===2) capacidadConfig[semana].kitsPorDia = parseInt(e.target.value) || 0;
  guardarDatos(); simularProduccion();
}
function manejarEnvioPedido(e){
  e.preventDefault();
  const id = parseInt(document.getElementById('pedidoIndex').value);

  const numeroIngresado = (document.getElementById('numeroPedido').value || '').trim();
  if (numeroIngresado !== '' && esNumeroPedidoDuplicado(numeroIngresado, id)) {
    alert(`⚠️ El número de pedido ${numeroIngresado} ya existe. Usa otro.`);
    const el = document.getElementById('numeroPedido');
    el.style.borderColor = 'red'; el.title = 'Este número ya existe'; el.focus();
    return;
  }
  const orderNumber = numeroIngresado !== '' ? numeroIngresado : String(nextId);

  const fechaProduccion = document.getElementById('fechaProduccion').value;
  const fechaEntrega    = document.getElementById('fechaEntrega').value;
  const s               = getWeekNumber(new Date(fechaProduccion));

  const nuevo = {
    fechaProduccion, fechaEntrega,
    semana:s, dias:5,
    cliente:document.getElementById('cliente').value,
    art:document.getElementById('articulo').value,
    kits:parseInt(document.getElementById('kitsCantidad').value),
    mesas:mesasInputValues[s]||4, entregado:false, noAplicaMesa:false,
    orderNumber, grabado:GRABADO_DEFAULT
  };

  if (id !== -1){
    const i = pedidosData.findIndex(p=>p.id===id);
    if(i!==-1) pedidosData[i] = { ...pedidosData[i], ...nuevo };
  }else{
    pedidosData.push({ id: nextId++, ...nuevo });
  }
  guardarDatos(); simularProduccion(); populateFiltros();

  e.target.reset(); document.getElementById('pedidoIndex').value=-1;
  const b=document.getElementById('submitButton'); b.textContent='Agregar Pedido'; b.style.background='#28a745';
}
function maybeRefreshUIForFilters(){
  if (document.getElementById('toggleAplicarFiltrosUI')?.checked) simularProduccion();
}

window.onload = ()=>{
  // Recalcular semana (domingo->sábado) por fechaProduccion en todos los registros
  let huboCambios = false;
  pedidosData = pedidosData.map(p => {
    const prod = p.fechaProduccion || p.fechaEntrega;
    const nuevaSemana = getWeekNumber(new Date(prod));
    if (p.semana !== nuevaSemana) huboCambios = true;
    return { ...p, fechaProduccion: prod, semana: nuevaSemana };
  });
  if (huboCambios) guardarDatos();

  document.getElementById('nuevoPedidoForm').addEventListener('submit', manejarEnvioPedido);
  simularProduccion();
  populateFiltros();

  // Aplicar / Limpiar filtros
  const btnFiltrar = document.getElementById('btnAplicarFiltros');
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnFiltrar) btnFiltrar.addEventListener('click', ()=>{
    maybeRefreshUIForFilters();
    alert('Filtros aplicados (por Fecha de Producción). Activa el switch si querés reflejar también en Tabla/Gráfico.');
  });
  if (btnLimpiar) btnLimpiar.addEventListener('click', ()=>{
    selectedFilters.clientes.clear();
    selectedFilters.arts.clear();
    selectedFilters.grabados.clear();
    document.getElementById('filtroDesde').value = '';
    document.getElementById('filtroHasta').value = '';
    document.getElementById('filtroNoAplica').value = 'all';
    document.querySelectorAll('.md-menu input[type="checkbox"]').forEach(ch=> ch.checked=false);
    updateMdButtonCounts();
    maybeRefreshUIForFilters();
  });

  // CSV / PDF
  const btnCSV = document.getElementById('btnExportCSV');
  const btnPDF = document.getElementById('btnPrintPDF');
  if (btnCSV) btnCSV.addEventListener('click', exportCSV);
  if (btnPDF) btnPDF.addEventListener('click', printReport);

  // Buscar pedido por número
  const btnBuscar = document.getElementById('btnBuscarPedido');
  if (btnBuscar) btnBuscar.addEventListener('click', buscarPedidoPorNumero);
  const inputBuscar = document.getElementById('buscarNumero');
  if (inputBuscar){
    inputBuscar.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); buscarPedidoPorNumero(); }
    });
  }
};
