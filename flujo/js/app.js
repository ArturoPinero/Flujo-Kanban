// Flujo — pantalla e interacción. Usa las funciones de estado.js.

let estado = cargarEstado();
let filtro = { q: '', prio: '', resp: '' };
let editandoId = null;
let arrastrandoId = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function guardar() { guardarEstado(estado); pintar(); }

let toastTimer;
function aviso(txt, ms = 3200) {
  const t = $('#toast');
  t.textContent = txt;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

const fmtDias = (d) => (d === null ? '—' : d < 1 ? '<1 d' : `${d.toFixed(1).replace('.', ',')} d`);
const iniciales = (n) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const PRIO_TXT = { alta: 'Alta', media: 'Media', baja: 'Baja' };

// ---------- Pintado ----------
function pintar() {
  pintarMetricas();
  pintarFiltroResponsables();
  pintarTablero();
  $('#avisoEj').hidden = !estado.tarjetas.some((t) => t.ejemplo);
}

function pintarMetricas() {
  const m = metricas(estado);
  $('#mCurso').textContent = m.enCurso;
  $('#mSemana').textContent = m.semana;
  $('#mLead').textContent = fmtDias(m.lead);
  $('#mCiclo').textContent = fmtDias(m.ciclo);
}

function pintarFiltroResponsables() {
  const sel = $('#fResp');
  const nombres = [...new Set(estado.tarjetas.map((t) => t.resp).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  sel.innerHTML = '<option value="">Todas las personas</option>' +
    nombres.map((n) => `<option ${n === filtro.resp ? 'selected' : ''}>${esc(n)}</option>`).join('');
  if (!nombres.includes(filtro.resp)) filtro.resp = '';
}

function visible(t) {
  const q = filtro.q.trim().toLowerCase();
  return (!filtro.prio || t.prio === filtro.prio) &&
    (!filtro.resp || t.resp === filtro.resp) &&
    (!q || `${t.titulo} ${t.desc} ${t.etq} ${t.resp}`.toLowerCase().includes(q));
}

function pintarTablero() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimo = estado.columnas.length - 1;
  $('#tablero').innerHTML = estado.columnas.map((c, ci) => {
    const n = contar(estado, c.id);
    const wipCls = c.wip > 0 ? (n > c.wip ? 'excede' : n === c.wip ? 'lleno' : '') : '';
    const tarjetas = estado.tarjetas.filter((t) => t.col === c.id && visible(t));
    return `<section class="columna${c.wip > 0 && n > c.wip ? ' excedida' : ''}" data-col="${c.id}" aria-label="${esc(c.nombre)}">
      <header class="col-head">
        <h2>${esc(c.nombre)}</h2>
        <span class="wip ${wipCls}" title="Tarjetas / límite WIP">${n}${c.wip > 0 ? ' / ' + c.wip : ''}</span>
      </header>
      ${c.desc ? `<p class="col-desc">${esc(c.desc)}</p>` : ''}
      <div class="lista">
        ${tarjetas.length ? tarjetas.map((t) => tarjetaHTML(t, ci, ultimo, hoy)).join('')
          : `<div class="vacia">${n ? 'Ninguna tarjeta coincide con el filtro' : 'Arrastra una tarjeta aquí'}</div>`}
      </div>
      ${ci === 0 ? '<button class="add-col" data-accion="nueva">+ Añadir tarjeta</button>' : ''}
    </section>`;
  }).join('');
}

function tarjetaHTML(t, ci, ultimo, hoy) {
  const vencida = t.fecha && !t.terminada && t.fecha < hoy;
  const fechaTxt = t.fecha ? new Date(t.fecha + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  const edad = t.iniciada && !t.terminada ? Math.floor((Date.now() - t.iniciada) / DIA) : null;
  return `<article class="tarjeta" draggable="true" data-id="${t.id}" data-prio="${t.prio}" tabindex="0">
    <div class="t-titulo">${esc(t.titulo)}</div>
    ${t.desc ? `<div class="t-desc">${esc(t.desc)}</div>` : ''}
    <div class="t-meta">
      <span class="prio-txt">${PRIO_TXT[t.prio]}</span>
      ${t.etq ? `<span class="etq">${esc(t.etq)}</span>` : ''}
      ${t.fecha ? `<span class="fecha${vencida ? ' vencida' : ''}" title="Fecha límite">${vencida ? 'Vencida · ' : ''}${fechaTxt}</span>` : ''}
      ${t.resp ? `<span class="persona" title="${esc(t.resp)}">${esc(iniciales(t.resp))}</span>` : ''}
      ${t.ejemplo ? '<span class="ej">ejemplo</span>' : ''}
    </div>
    <div class="t-pie">
      <span class="edad">${edad !== null ? `${edad} d en marcha` : t.terminada ? 'Terminada' : ''}</span>
      <span class="mover">
        <button data-accion="izq" aria-label="Mover a la columna anterior" ${ci === 0 ? 'disabled' : ''}>←</button>
        <button class="editar" data-accion="editar" aria-label="Editar tarjeta">Editar</button>
        <button data-accion="der" aria-label="Mover a la columna siguiente" ${ci === ultimo ? 'disabled' : ''}>→</button>
      </span>
    </div>
  </article>`;
}

// ---------- Mover ----------
function mover(id, colId, pos = null) {
  const r = moverTarjeta(estado, id, colId, pos);
  if (!r.ok) return aviso(r.motivo);
  const t = estado.tarjetas.find((x) => x.id === id);
  if (t) t.ejemplo = false;
  guardar();
}

$('#tablero').addEventListener('click', (e) => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const accion = b.dataset.accion;
  if (accion === 'nueva') return abrirTarjeta(null);
  const card = b.closest('.tarjeta');
  const t = estado.tarjetas.find((x) => x.id === card.dataset.id);
  if (accion === 'editar') return abrirTarjeta(t);
  const ci = indiceColumna(estado, t.col);
  const destino = estado.columnas[ci + (accion === 'der' ? 1 : -1)];
  if (destino) mover(t.id, destino.id);
});

// Arrastrar y soltar (ratón). En móvil se usan las flechas ← →.
$('#tablero').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.tarjeta');
  if (!card) return;
  arrastrandoId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', arrastrandoId); } catch (err) {}
  requestAnimationFrame(() => card.classList.add('arrastrando'));
});
$('#tablero').addEventListener('dragend', () => {
  arrastrandoId = null;
  document.querySelectorAll('.arrastrando, .encima').forEach((el) => el.classList.remove('arrastrando', 'encima'));
});
$('#tablero').addEventListener('dragover', (e) => {
  const col = e.target.closest('.columna');
  if (!col || !arrastrandoId) return;
  e.preventDefault();
  document.querySelectorAll('.encima').forEach((el) => el !== col && el.classList.remove('encima'));
  col.classList.add('encima');
});
$('#tablero').addEventListener('drop', (e) => {
  const col = e.target.closest('.columna');
  if (!col || !arrastrandoId) return;
  e.preventDefault();
  // Posición: delante de la primera tarjeta cuyo centro está por debajo del cursor
  const otras = [...col.querySelectorAll('.tarjeta')].filter((c) => c.dataset.id !== arrastrandoId);
  let pos = otras.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  if (pos !== -1) {
    // Convertir la posición visible (con filtro) en posición real dentro de la columna
    const real = estado.tarjetas.filter((t) => t.col === col.dataset.col && t.id !== arrastrandoId);
    pos = real.findIndex((t) => t.id === otras[pos].dataset.id);
  } else pos = null;
  mover(arrastrandoId, col.dataset.col, pos);
});

// Atajos de teclado sobre una tarjeta enfocada: ← → para mover, Enter para editar
$('#tablero').addEventListener('keydown', (e) => {
  const card = e.target.closest('.tarjeta');
  if (!card || e.target !== card) return;
  const t = estado.tarjetas.find((x) => x.id === card.dataset.id);
  const ci = indiceColumna(estado, t.col);
  if (e.key === 'Enter') { e.preventDefault(); abrirTarjeta(t); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const destino = estado.columnas[ci + (e.key === 'ArrowRight' ? 1 : -1)];
    if (destino) {
      mover(t.id, destino.id);
      document.querySelector(`.tarjeta[data-id="${t.id}"]`)?.focus();
    }
  }
});

// ---------- Diálogo de tarjeta ----------
function abrirTarjeta(t) {
  editandoId = t ? t.id : null;
  $('#dlgTarjetaTit').textContent = t ? 'Editar tarjeta' : 'Nueva tarjeta';
  $('#tTitulo').value = t?.titulo || '';
  $('#tDesc').value = t?.desc || '';
  $('#tPrio').value = t?.prio || 'media';
  $('#tEtq').value = t?.etq || '';
  $('#tResp').value = t?.resp || '';
  $('#tFecha').value = t?.fecha || '';
  $('#tCol').innerHTML = estado.columnas.map((c) =>
    `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  $('#tCol').value = t?.col || estado.columnas[0].id;
  $('#tError').hidden = true;
  $('#btnBorrar').hidden = !t;
  $('#confirmBorrar').hidden = true;
  const f = (ms) => ms ? new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  $('#historial').hidden = !t;
  if (t) $('#historial').textContent = `Creada: ${f(t.creada)} · Empezada: ${f(t.iniciada)} · Terminada: ${f(t.terminada)}`;
  $('#dlgTarjeta').showModal();
  $('#tTitulo').focus();
}

$('#formTarjeta').addEventListener('submit', (e) => {
  e.preventDefault();
  const titulo = $('#tTitulo').value.trim();
  if (!titulo) { $('#tError').textContent = 'Escribe un título para la tarjeta.'; $('#tError').hidden = false; return; }
  const datos = {
    titulo,
    desc: $('#tDesc').value.trim(),
    prio: $('#tPrio').value,
    etq: $('#tEtq').value.trim(),
    resp: $('#tResp').value.trim(),
    fecha: $('#tFecha').value,
  };
  const colDestino = $('#tCol').value;

  if (editandoId) {
    const t = estado.tarjetas.find((x) => x.id === editandoId);
    if (t.col !== colDestino) {
      const r = moverTarjeta(estado, t.id, colDestino);
      if (!r.ok) { $('#tError').textContent = r.motivo; $('#tError').hidden = false; return; }
    }
    Object.assign(t, datos, { ejemplo: false });
  } else {
    const nueva = { id: uid(), ...datos, col: estado.columnas[0].id, creada: Date.now(), iniciada: null, terminada: null, ejemplo: false };
    estado.tarjetas.push(nueva);
    if (colDestino !== nueva.col) {
      const r = moverTarjeta(estado, nueva.id, colDestino);
      if (!r.ok) {
        estado.tarjetas = estado.tarjetas.filter((x) => x !== nueva);
        $('#tError').textContent = r.motivo; $('#tError').hidden = false; return;
      }
    }
  }
  $('#dlgTarjeta').close();
  guardar();
});

$('#btnBorrar').addEventListener('click', () => { $('#confirmBorrar').hidden = false; });
$('#btnNoBorrar').addEventListener('click', () => { $('#confirmBorrar').hidden = true; });
$('#btnSiBorrar').addEventListener('click', () => {
  estado.tarjetas = estado.tarjetas.filter((t) => t.id !== editandoId);
  $('#dlgTarjeta').close();
  guardar();
  aviso('Tarjeta eliminada');
});

// ---------- Diálogo de columnas ----------
let borrador = [];
function abrirColumnas() {
  borrador = estado.columnas.map((c) => ({ ...c }));
  pintarBorrador();
  $('#cError').hidden = true;
  $('#dlgColumnas').showModal();
}
function pintarBorrador() {
  $('#colsEdit').innerHTML = borrador.map((c, i) => {
    const n = contar(estado, c.id);
    return `<div class="col-edit" data-i="${i}">
      <input id="cn-${c.id}" value="${esc(c.nombre)}" aria-label="Nombre de la columna ${i + 1}">
      <input id="cw-${c.id}" type="number" min="0" value="${c.wip}" aria-label="Límite WIP de ${esc(c.nombre)}">
      <button type="button" class="quitar" data-quitar="${i}" ${n || borrador.length <= 2 ? 'disabled title="Solo se pueden quitar columnas vacías"' : ''}>Quitar</button>
    </div>`;
  }).join('');
}
function leerBorrador() {
  borrador.forEach((c) => {
    c.nombre = $(`#cn-${c.id}`).value.trim();
    c.wip = Math.max(0, parseInt($(`#cw-${c.id}`).value) || 0);
  });
}
$('#colsEdit').addEventListener('click', (e) => {
  const b = e.target.closest('[data-quitar]');
  if (!b || b.disabled) return;
  leerBorrador();
  borrador.splice(+b.dataset.quitar, 1);
  pintarBorrador();
});
$('#btnAddCol').addEventListener('click', () => {
  leerBorrador();
  borrador.splice(borrador.length - 1, 0, { id: 'c' + uid(), nombre: 'Nueva columna', wip: 0, desc: '' });
  pintarBorrador();
});
$('#formColumnas').addEventListener('submit', (e) => {
  e.preventDefault();
  leerBorrador();
  if (borrador.some((c) => !c.nombre)) { $('#cError').textContent = 'Todas las columnas necesitan un nombre.'; $('#cError').hidden = false; return; }
  estado.columnas = borrador;
  $('#dlgColumnas').close();
  guardar();
  const excedidas = estado.columnas.filter((c) => c.wip > 0 && contar(estado, c.id) > c.wip);
  if (excedidas.length) aviso(`«${excedidas[0].nombre}» tiene más tarjetas que su nuevo límite. Termina o mueve alguna.`);
});

// ---------- Copia de seguridad ----------
function abrirCopia() {
  $('#copiaTxt').value = JSON.stringify(estado);
  $('#copiaMsg').textContent = '';
  $('#dlgCopia').showModal();
}
$('#btnCopiar').addEventListener('click', () => {
  const caja = $('#copiaTxt');
  caja.value = JSON.stringify(estado);
  const fallback = () => { caja.select(); $('#copiaMsg').textContent = 'Texto seleccionado: cópialo con Ctrl+C.'; };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(caja.value).then(() => ($('#copiaMsg').textContent = 'Copiado.')).catch(fallback);
  } else fallback();
});
$('#btnRestaurar').addEventListener('click', () => {
  try {
    const d = JSON.parse($('#copiaTxt').value);
    if (!Array.isArray(d.columnas) || !Array.isArray(d.tarjetas) || d.columnas.length < 2) throw 0;
    estado = d;
    guardar();
    $('#copiaMsg').textContent = `Restaurado: ${d.columnas.length} columnas y ${d.tarjetas.length} tarjetas.`;
  } catch (e) {
    $('#copiaMsg').textContent = 'Ese texto no es una copia válida. Pega el texto completo que copiaste antes.';
  }
});

// ---------- Resto de controles ----------
$('#btnNueva').addEventListener('click', () => abrirTarjeta(null));
$('#btnColumnas').addEventListener('click', abrirColumnas);
$('#btnCopia').addEventListener('click', abrirCopia);
$('#btnGuia').addEventListener('click', () => $('#dlgGuia').showModal());
$('#btnBorrarEj').addEventListener('click', () => {
  estado.tarjetas = estado.tarjetas.filter((t) => !t.ejemplo);
  guardar();
});
$('#fBuscar').addEventListener('input', (e) => { filtro.q = e.target.value; pintarTablero(); });
$('#fPrio').addEventListener('change', (e) => { filtro.prio = e.target.value; pintarTablero(); });
$('#fResp').addEventListener('change', (e) => { filtro.resp = e.target.value; pintarTablero(); });
document.querySelectorAll('[data-cerrar]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close()));

pintar();
