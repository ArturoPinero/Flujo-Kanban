// Flujo — datos del tablero: estructura, guardado y métricas.
// Este archivo no toca la pantalla; solo gestiona la información.

const CLAVE = 'flujo-kanban-v1';
const DIA = 86400000;

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Tablero por defecto ----------
function columnasPorDefecto() {
  return [
    { id: 'c1', nombre: 'Pendiente', wip: 0, desc: 'Ideas y tareas sin priorizar' },
    { id: 'c2', nombre: 'Por hacer', wip: 5, desc: 'Priorizado y listo para empezar' },
    { id: 'c3', nombre: 'En curso', wip: 3, desc: 'Se está trabajando ahora' },
    { id: 'c4', nombre: 'Revisión', wip: 2, desc: 'Esperando comprobación' },
    { id: 'c5', nombre: 'Hecho', wip: 0, desc: 'Terminado y entregado' },
  ];
}

// Tarjetas de ejemplo con fechas relativas a hoy, para que las métricas tengan valores
function tarjetasEjemplo() {
  const ahora = Date.now();
  const hace = (d) => ahora - d * DIA;
  const t = (col, titulo, desc, prio, etq, resp, creada, iniciada = null, terminada = null, fecha = '') =>
    ({ id: uid(), col, titulo, desc, prio, etq, resp, fecha, creada, iniciada, terminada, ejemplo: true });
  const enDias = (d) => new Date(ahora + d * DIA).toISOString().slice(0, 10);
  return [
    t('c1', 'Investigar proveedores de hosting', 'Comparar precio, soporte y ubicación de los servidores.', 'baja', 'Web', 'Luis', hace(6)),
    t('c1', 'Idea: boletín mensual', '', 'baja', 'Marketing', '', hace(2)),
    t('c2', 'Redactar textos de la página de inicio', 'Tres bloques: quiénes somos, servicios y contacto.', 'media', 'Web', 'Luis', hace(5), null, null, enDias(6)),
    t('c2', 'Preparar presupuesto trimestral', '', 'alta', 'Finanzas', 'Ana', hace(3), null, null, enDias(3)),
    t('c3', 'Diseñar logotipo', 'Dos propuestas en blanco y negro antes del color.', 'alta', 'Marca', 'Ana', hace(8), hace(4)),
    t('c3', 'Configurar correo corporativo', '', 'media', 'Web', 'Luis', hace(4), hace(1), null, enDias(-1)),
    t('c4', 'Revisar contrato con la imprenta', 'Comprobar plazos de entrega y penalizaciones.', 'media', 'Legal', 'Ana', hace(9), hace(5)),
    t('c5', 'Registrar dominio', '', 'alta', 'Web', 'Luis', hace(12), hace(11), hace(10)),
    t('c5', 'Abrir cuenta bancaria del proyecto', '', 'media', 'Finanzas', 'Ana', hace(10), hace(7), hace(3)),
    t('c5', 'Crear perfil en redes sociales', '', 'baja', 'Marketing', 'Luis', hace(7), hace(4), hace(2)),
  ];
}

// ---------- Guardado ----------
function cargarEstado() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.columnas) && Array.isArray(d.tarjetas)) return d;
    }
  } catch (e) { /* sin almacenamiento disponible: se usa el tablero de ejemplo */ }
  return { columnas: columnasPorDefecto(), tarjetas: tarjetasEjemplo() };
}

function guardarEstado(estado) {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {}
}

// ---------- Reglas del flujo ----------
// La primera columna es la entrada y la última es "terminado".
// El trabajo cuenta como "empezado" a partir de la tercera columna
// (o de la segunda, si el tablero tiene menos de 4 columnas).
function indiceInicio(estado) {
  return estado.columnas.length >= 4 ? 2 : 1;
}
function indiceColumna(estado, colId) {
  return estado.columnas.findIndex((c) => c.id === colId);
}
function esUltima(estado, colId) {
  return indiceColumna(estado, colId) === estado.columnas.length - 1;
}
function contar(estado, colId) {
  return estado.tarjetas.filter((t) => t.col === colId).length;
}

// Intenta mover una tarjeta. Devuelve { ok: true } o { ok: false, motivo }.
function moverTarjeta(estado, id, colId, posicion = null) {
  const t = estado.tarjetas.find((x) => x.id === id);
  if (!t) return { ok: false, motivo: 'No se encontró la tarjeta.' };
  const destino = estado.columnas.find((c) => c.id === colId);

  if (t.col !== colId && destino.wip > 0 && contar(estado, colId) >= destino.wip) {
    return {
      ok: false,
      motivo: `«${destino.nombre}» está en su límite (${destino.wip}). Termina algo de esa columna antes de añadir más.`,
    };
  }

  const idx = indiceColumna(estado, colId);
  if (idx >= indiceInicio(estado) && !t.iniciada) t.iniciada = Date.now();
  if (esUltima(estado, colId)) { if (!t.terminada) t.terminada = Date.now(); }
  else t.terminada = null;
  if (idx < indiceInicio(estado)) t.iniciada = null;

  // Reordenar: quitar la tarjeta y volver a insertarla en la posición pedida dentro de la columna
  estado.tarjetas = estado.tarjetas.filter((x) => x.id !== id);
  t.col = colId;
  const enCol = estado.tarjetas.filter((x) => x.col === colId);
  if (posicion === null || posicion >= enCol.length) {
    const ultima = enCol[enCol.length - 1];
    const at = ultima ? estado.tarjetas.indexOf(ultima) + 1 : estado.tarjetas.length;
    estado.tarjetas.splice(at, 0, t);
  } else {
    estado.tarjetas.splice(estado.tarjetas.indexOf(enCol[posicion]), 0, t);
  }
  return { ok: true };
}

// ---------- Métricas ----------
function media(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function metricas(estado) {
  const hechas = estado.tarjetas.filter((t) => t.terminada);
  const semana = Date.now() - 7 * DIA;
  return {
    enCurso: estado.tarjetas.filter((t) => t.iniciada && !t.terminada).length,
    semana: hechas.filter((t) => t.terminada >= semana).length,
    lead: media(hechas.map((t) => (t.terminada - t.creada) / DIA)),
    ciclo: media(hechas.filter((t) => t.iniciada).map((t) => (t.terminada - t.iniciada) / DIA)),
  };
}
