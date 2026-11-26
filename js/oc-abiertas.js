(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const RANGOS = [
    { key: 'mas-12', etiqueta: 'Más de 12 meses', corto: '> 12 meses' },
    { key: '6-12', etiqueta: '6 a 12 meses', corto: '6–12 meses' },
    { key: '3-6', etiqueta: '3 a 6 meses', corto: '3–6 meses' },
    { key: '1-3', etiqueta: '1 a 3 meses', corto: '1–3 meses' },
    { key: 'menos-1', etiqueta: 'Menos de 1 mes', corto: '< 1 mes' }
  ];
  let items = [];
  let filtros = { buscar: '', mes: '', origen: '' };

  document.addEventListener('DOMContentLoaded', iniciar);
  document.addEventListener('bo:datos', cargar);
  window.addEventListener('pageshow', e => { if (e.persisted) cargar(); });

  function iniciar() {
    $('#oc-buscar').addEventListener('input', e => { filtros.buscar = e.target.value; dibujar(); });
    $('#oc-mes').addEventListener('change', e => { filtros.mes = e.target.value; dibujar(); });
    $('#oc-proveedor-extranjero').addEventListener('click', () => cambiarOrigen('extranjero'));
    $('#oc-proveedor-nacional').addEventListener('click', () => cambiarOrigen('nacional'));
    $('#oc-limpiar').addEventListener('click', () => {
      filtros = { buscar: '', mes: '', origen: '' };
      $('#oc-buscar').value = '';
      $('#oc-mes').value = '';
      dibujar();
    });
    cargar();
  }

  function cambiarOrigen(origen) {
    filtros.origen = filtros.origen === origen ? '' : origen;
    dibujar();
  }

  function origenDeRut(rut) {
    const normalizado = String(rut || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[\s.-]/g, '');
    return normalizado.startsWith('PE') || normalizado === '555555' ? 'extranjero' : 'nacional';
  }

  function cargar() {
    const datos = BO.obtenerDatos();
    const hoja = datos && datos.ocAbiertas;
    if (!hoja || !hoja.ok) {
      $('#oc-estado-vacio').hidden = false;
      $('#oc-contenido').hidden = true;
      $('#oc-mensaje-vacio').textContent = hoja && hoja.error
        ? hoja.error + ' Revisa la pestaña del Excel y vuelve a cargarlo.'
        : 'Carga nuevamente el Excel para leer la pestaña OC ABIERTAS.';
      return;
    }
    items = hoja.items || [];
    llenarFiltros();
    $('#oc-estado-vacio').hidden = true;
    $('#oc-contenido').hidden = false;
    dibujar();
  }

  function fechaUTC(iso) {
    if (!iso) return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function restarMesesUTC(milisegundos, meses) {
    const fecha = new Date(milisegundos);
    const anio = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() - meses;
    const dia = fecha.getUTCDate();
    const primerDia = new Date(Date.UTC(anio, mes, 1));
    const ultimoDia = new Date(Date.UTC(primerDia.getUTCFullYear(), primerDia.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(primerDia.getUTCFullYear(), primerDia.getUTCMonth(), Math.min(dia, ultimoDia));
  }

  function rangoDe(fecha, hoy = hoyUTC()) {
    const dia = fechaUTC(fecha);
    if (dia === null) return 'sin-fecha';
    if (dia < restarMesesUTC(hoy, 12)) return 'mas-12';
    if (dia <= restarMesesUTC(hoy, 6)) return '6-12';
    if (dia <= restarMesesUTC(hoy, 3)) return '3-6';
    if (dia <= restarMesesUTC(hoy, 1)) return '1-3';
    return 'menos-1';
  }

  function hoyUTC() {
    const hoy = new Date();
    return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  }

  function mesDe(fecha) {
    return fecha ? fecha.slice(0, 7) : 'sin-fecha';
  }

  function etiquetaMes(mes) {
    if (mes === 'sin-fecha') return 'Sin fecha';
    const fecha = fechaUTC(mes + '-01');
    return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(fecha));
  }

  function etiquetaFecha(fecha) {
    const valor = fechaUTC(fecha);
    return valor === null ? 'Sin fecha' : new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(valor));
  }

  function llenarFiltros() {
    const meses = new Set();
    items.forEach(item => meses.add(mesDe(item.fecha)));
    const mesPrevio = filtros.mes;
    $('#oc-mes').innerHTML = '<option value="">Todos los meses</option>' +
      [...meses].sort((a, b) => b.localeCompare(a)).map(m =>
        `<option value="${BO.esc(m)}">${BO.esc(etiquetaMes(m))}</option>`
      ).join('');
    filtros.mes = meses.has(mesPrevio) ? mesPrevio : '';
    $('#oc-buscar').value = filtros.buscar;
    $('#oc-mes').value = filtros.mes;
  }

  function normalizarBusqueda(valor) {
    return String(valor || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-CL');
  }

  function filtrar(itemsBase = items) {
    const consulta = normalizarBusqueda(filtros.buscar);
    return itemsBase.filter(item => {
      if (filtros.mes && mesDe(item.fecha) !== filtros.mes) return false;
      if (consulta) {
        const coincideOC = normalizarBusqueda(item.oc).includes(consulta);
        const coincideProveedor = (item.proveedores || []).some(p =>
          normalizarBusqueda([p.nombre, p.rut].filter(Boolean).join(' ')).includes(consulta));
        if (!coincideOC && !coincideProveedor) return false;
      }
      if (filtros.origen && !(item.proveedores || []).some(p => origenDeRut(p.rut) === filtros.origen)) return false;
      return true;
    });
  }

  function dibujar() {
    const visibles = filtrar(items);
    dibujarRangos(visibles);
    dibujarKPIs(visibles);
    dibujarConclusiones(visibles);
    dibujarTabla(visibles);
    $('#oc-proveedor-extranjero').setAttribute('aria-pressed', String(filtros.origen === 'extranjero'));
    $('#oc-proveedor-nacional').setAttribute('aria-pressed', String(filtros.origen === 'nacional'));
  }

  function dibujarRangos(visibles) {
    const contadores = new Map(RANGOS.map(r => [r.key, 0]));
    visibles.forEach(item => {
      const key = rangoDe(item.fecha);
      if (contadores.has(key)) contadores.set(key, contadores.get(key) + 1);
    });
    $('#oc-rangos').innerHTML = RANGOS.map(r => `
      <article class="oc-rango-tarjeta">
        <small>${BO.esc(r.etiqueta)}</small><b>${BO.n(contadores.get(r.key))}</b>
      </article>`).join('');
  }

  function dibujarKPIs(visibles) {
    const proveedores = new Set(visibles.flatMap(item => (item.proveedores || []).map(p => p.clave)));
    const lineas = visibles.reduce((total, item) => total + (item.lineas || []).length, 0);
    const sobreSeisMeses = visibles.filter(item => ['mas-12', '6-12'].includes(rangoDe(item.fecha))).length;
    const sinFecha = visibles.filter(item => !item.fecha).length;
    const kpis = [
      ['OC en vista', BO.n(visibles.length), 'tabla'],
      ['Proveedores', BO.n(proveedores.size), 'camion'],
      ['Líneas de detalle', BO.n(lineas), 'capas'],
      ['Más de 6 meses', BO.n(sobreSeisMeses), 'reloj'],
      ['Sin fecha', BO.n(sinFecha), 'alerta']
    ];
    $('#oc-kpis').innerHTML = kpis.map(([titulo, valor, icono]) => `
      <article class="kpi oc-kpi"><div class="kpi-ico" style="--c:var(--bo-primario)">${BO.icono(icono)}</div>
        <div class="kpi-info"><small>${BO.esc(titulo)}</small><b>${valor}</b></div></article>`).join('');
  }

  function dibujarConclusiones(visibles) {
    const salida = [];
    if (!visibles.length) {
      salida.push(['alerta', 'Sin resultados', 'No hay OC que coincidan con los filtros seleccionados.']);
    } else {
      const lineas = visibles.reduce((total, item) => total + (item.lineas || []).length, 0);
      salida.push(['tabla', 'Resumen de la vista', `Se muestran <b>${BO.n(visibles.length)} OC</b> agrupadas en <b>${BO.n(lineas)} líneas</b>.`]);
      const fechadas = visibles.filter(item => item.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
      if (fechadas.length) {
        const antigua = fechadas[0];
        salida.push(['reloj', 'OC más antigua', `<b>${BO.esc(antigua.oc)}</b> · ${BO.esc(etiquetaFecha(antigua.fecha))} · ${BO.esc(etiquetaRango(rangoDe(antigua.fecha)))}`]);
      }
      const porProveedor = new Map();
      visibles.forEach(item => (item.proveedores || []).forEach(p => {
        const nombre = p.nombre || 'Sin nombre';
        porProveedor.set(nombre, (porProveedor.get(nombre) || 0) + 1);
      }));
      const top = [...porProveedor.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) salida.push(['camion', 'Proveedor con más OC', `<b>${BO.esc(top[0])}</b> · ${BO.n(top[1])} OC en la vista.`]);
      const sinFecha = visibles.filter(item => !item.fecha).length;
      if (sinFecha) salida.push(['alerta', 'Fechas pendientes', `${BO.n(sinFecha)} OC no tienen fecha válida para calcular su antigüedad.`]);
    }
    $('#oc-conclusiones').innerHTML = salida.map(([icono, titulo, texto]) =>
      `<li style="--c:var(--bo-primario)">${BO.icono(icono)}<div><b>${BO.esc(titulo)}</b><span>${texto}</span></div></li>`
    ).join('');
  }

  function etiquetaRango(key) {
    return RANGOS.find(r => r.key === key)?.etiqueta || 'Sin fecha';
  }

  function detalleLinea(linea) {
    const campos = (linea.detalle || []).map(c =>
      `<div><dt>${BO.esc(c.titulo)}</dt><dd>${BO.esc(c.valor)}</dd></div>`
    ).join('');
    return `<article class="oc-linea"><b>Fila ${BO.n(linea.fila)} del Excel</b><dl>${campos}</dl></article>`;
  }

  function dibujarTabla(visibles) {
    const ordenados = visibles.slice().sort((a, b) =>
      (a.fecha || '9999-99-99').localeCompare(b.fecha || '9999-99-99') ||
      a.oc.localeCompare(b.oc, 'es', { numeric: true }));
    $('#oc-tabla tbody').innerHTML = ordenados.length ? ordenados.map(item => {
      const proveedores = [...new Set((item.proveedores || []).map(p => p.nombre).filter(Boolean))];
      const ruts = [...new Set((item.proveedores || []).map(p => p.rut).filter(Boolean))];
      const rango = rangoDe(item.fecha);
      return `<tr>
        <td data-label="N° OC"><b>${BO.esc(item.oc)}</b></td>
        <td data-label="Fecha OC">${BO.esc(etiquetaFecha(item.fecha))}</td>
        <td data-label="Antigüedad"><span class="oc-antiguedad oc-${rango}">${BO.esc(etiquetaRango(rango))}</span></td>
        <td data-label="Proveedor">${BO.esc(proveedores.join(' / ') || 'Sin proveedor')}</td>
        <td data-label="RUT">${BO.esc(ruts.join(' / ') || '–')}</td>
        <td class="num" data-label="Líneas">${BO.n((item.lineas || []).length)}</td>
        <td data-label="Detalle por línea">${item.lineas && item.lineas.length
          ? `<details class="oc-detalle"><summary>Ver ${BO.n(item.lineas.length)} línea(s)</summary><div class="oc-lineas">${item.lineas.map(detalleLinea).join('')}</div></details>`
          : 'Sin detalle de líneas'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="vacio-celda">No hay OC abiertas con estos filtros.</td></tr>';
    const lineas = visibles.reduce((total, item) => total + (item.lineas || []).length, 0);
    $('#oc-tabla-resumen').textContent = `Mostrando ${BO.n(visibles.length)} OC · ${BO.n(lineas)} líneas`;
  }
})();
