/* =====================================================================
   MODULO.JS  |  Lógica de las páginas BMAT, PAÑOL, ROPA y ZAPATOS
   ---------------------------------------------------------------------
   Cada página HTML indica su módulo con <body data-modulo="panol">.
   Este archivo:
     1. Lee los datos guardados del Excel
     2. Aplica filtros (texto, categoría, proveedor, decisión, etc.)
     3. Dibuja indicadores, gráficos, conclusiones y la tabla
   ===================================================================== */

(function () {
  'use strict';
  const CFG = window.BO_CONFIG;
  const $ = sel => document.querySelector(sel);

  let ID, CONF, MOD, ITEMS = [];
  const graficos = {};

  /* Estado de los filtros */
  const F = {
    texto: '', categoria: '', proveedor: '', estado: '', marca: '', tramo: '',
    alcanceBajo30: false, decisiones: new Set(), soloVisibles: false,
    orden: { campo: 'decision', dir: 1 }, pagina: 1
  };

  /* =================================================================
     COLUMNAS DE LA TABLA
     ================================================================= */
  function definicionColumnas() {
    const enc = campo => (MOD.mapa[campo] && MOD.mapa[campo].encabezado) || '';
    const nombreCat = CONF.tipo === 'ropa' ? 'Prenda' : CONF.tipo === 'zapatos' ? 'Modelo' : (enc('categoria') || 'Categoría');
    return {
      codigo:        { t: 'Código', tipo: 'txt' },
      descripcion:   { t: 'Descripción', tipo: 'desc' },
      categoria:     { t: nombreCat, tipo: 'txt' },
      talla:         { t: 'Talla', tipo: 'txt' },
      proveedor:     { t: 'Proveedor', tipo: 'prov' },
      valor:         { t: 'Valor unit.', tipo: 'clp' },
      stock:         { t: 'Stock', tipo: 'stock' },
      minimo:        { t: 'Mínimo', tipo: 'num' },
      maximo:        { t: 'Máximo', tipo: 'num' },
      consumo1:      { t: enc('consumo1') || 'Consumo 1', tipo: 'num1' },
      consumo2:      { t: enc('consumo2') || 'Consumo 2', tipo: 'num1' },
      consumo3:      { t: enc('consumo3') || 'Consumo 3', tipo: 'num1' },
      alcance:       { t: 'Alcance (días)', tipo: 'alcance' },
      pendiente:     { t: CONF.tipo === 'ropa' ? 'Despacho pend.' : 'Pendiente', tipo: 'num' },
      oc:            { t: 'N° OC', tipo: 'txt' },
      sugerido:      { t: 'Sugerido', tipo: 'sug' },
      valorSugerido: { t: '$ Sugerido', tipo: 'clp' },
      decision:      { t: 'Decisión', tipo: 'dec' }
    };
  }

  /* =================================================================
     INICIO
     ================================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    ID = document.body.dataset.modulo;
    CONF = CFG.modulos[ID];
    if ($('#f-marca').type === 'checkbox') F.marca = 'NO';
    conectarEventos();
    cargar();
  });
  document.addEventListener('bo:datos', () => { F.pagina = 1; cargar(); });

  function cargar() {
    const datos = BO.obtenerDatos();
    MOD = datos && datos.modulos[ID];
    const hayDatos = !!(MOD && MOD.ok && MOD.items.length);

    $('#estado-vacio').hidden = hayDatos;
    $('#contenido').hidden = !hayDatos;
    if (!hayDatos) {
      $('#mensaje-vacio').textContent = MOD && MOD.error ? MOD.error :
        'Carga tu archivo COMPRAS FLEXIBLE para ver este módulo.';
      return;
    }
    ITEMS = MOD.items;
    llenarSelects();
    dibujar();
  }

  /* =================================================================
     EVENTOS DE LOS FILTROS
     ================================================================= */
  function conectarEventos() {
    let espera;
    $('#f-texto').addEventListener('input', e => {
      clearTimeout(espera);
      espera = setTimeout(() => { F.texto = BO.normalizar(e.target.value); F.pagina = 1; dibujar(); }, 180);
    });
    $('#f-categoria').addEventListener('change', e => { F.categoria = e.target.value; F.pagina = 1; dibujar(); });
    $('#f-proveedor').addEventListener('change', e => { F.proveedor = e.target.value; F.pagina = 1; dibujar(); });
    const filtroEstado = $('#f-estado');
    if (filtroEstado) filtroEstado.addEventListener('change', e => { F.estado = e.target.value; F.pagina = 1; dibujar(); });
    const filtroAlcanceBajo30 = $('#f-alcance-bajo-30');
    if (filtroAlcanceBajo30) filtroAlcanceBajo30.addEventListener('change', e => {
      F.alcanceBajo30 = e.target.checked; F.pagina = 1; dibujar();
    });
    const filtroMarca = $('#f-marca');
    filtroMarca.addEventListener('change', e => {
      if (filtroMarca.type === 'checkbox') {
        F.marca = e.target.checked ? 'SI' : 'NO';
        $('#valor-marca').textContent = F.marca === 'NO' ? 'NO' : '';
      } else {
        F.marca = e.target.value;
      }
      F.pagina = 1; dibujar();
    });
    $('#f-visibles').addEventListener('change', e => { F.soloVisibles = e.target.checked; F.pagina = 1; dibujar(); });

    $('#btn-limpiar').addEventListener('click', limpiarFiltros);
    $('#btn-sugeridos').addEventListener('click', () => BO.lista.agregarVarios(filtrar()));
    $('#btn-exportar-tabla').addEventListener('click', exportarTabla);

    // Chips y tarjetas de decisión
    document.addEventListener('click', e => {
      const chip = e.target.closest('[data-filtro-decision]');
      if (!chip) return;
      alternarDecision(chip.dataset.filtroDecision);
    });

    // Orden de la tabla
    $('#tabla thead').addEventListener('click', e => {
      const th = e.target.closest('th[data-campo]');
      if (!th) return;
      const c = th.dataset.campo;
      F.orden = { campo: c, dir: F.orden.campo === c ? -F.orden.dir : 1 };
      dibujarTabla(filtrar());
    });

    // Clic en fila (detalle) o en botón + (agregar a lista)
    $('#tabla tbody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const it = ITEMS.find(x => x.id === tr.dataset.id);
      if (!it) return;
      if (e.target.closest('[data-agregar]')) {
        e.stopPropagation();
        BO.lista.agregar(it, it.sugerido || 1);
        return;
      }
      BO.abrirDetalle(it);
    });

    $('#paginacion').addEventListener('click', e => {
      const b = e.target.closest('[data-pag]');
      if (!b || b.disabled) return;
      F.pagina = +b.dataset.pag;
      dibujarTabla(filtrar());
      $('#tabla-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Mapa de calor (ropa / zapatos)
    $('#mapa-calor').addEventListener('click', e => {
      const c = e.target.closest('[data-id]');
      if (!c) return;
      const it = ITEMS.find(x => x.id === c.dataset.id);
      if (it) BO.abrirDetalle(it);
    });
  }

  function alternarDecision(d) {
    if (F.decisiones.has(d)) F.decisiones.delete(d); else F.decisiones.add(d);
    F.pagina = 1; dibujar();
  }

  function limpiarFiltros() {
    const filtroMarca = $('#f-marca');
    Object.assign(F, {
      texto: '', categoria: '', proveedor: '', estado: '',
      marca: filtroMarca.type === 'checkbox' ? 'NO' : '',
      tramo: '', alcanceBajo30: false, soloVisibles: false, pagina: 1
    });
    F.decisiones.clear();
    $('#f-texto').value = ''; $('#f-categoria').value = ''; $('#f-proveedor').value = '';
    if ($('#f-estado')) $('#f-estado').value = '';
    if ($('#f-alcance-bajo-30')) $('#f-alcance-bajo-30').checked = false;
    if (filtroMarca.type === 'checkbox') {
      filtroMarca.checked = false;
      $('#valor-marca').textContent = 'NO';
    }
    else filtroMarca.value = '';
    $('#f-visibles').checked = false;
    dibujar();
  }

  function llenarSelects() {
    const opciones = (campo) => [...new Set(ITEMS.map(i => i[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const llenar = (sel, lista, todos) => {
      const actual = sel.value;
      sel.innerHTML = '<option value="">' + todos + '</option>' +
        lista.map(v => '<option value="' + BO.esc(v) + '">' + BO.esc(v) + '</option>').join('');
      sel.value = lista.includes(actual) ? actual : '';
    };
    llenar($('#f-categoria'), opciones('categoria'), CONF.tipo === 'ropa' ? 'Todas las prendas' : CONF.tipo === 'zapatos' ? 'Todos los modelos' : 'Todas las categorías');
    llenar($('#f-proveedor'), opciones('proveedor'), 'Todos los proveedores');

    const tieneEstado = !!CONF.columnas.estado;
    const cajaEstado = $('#caja-estado');
    if (cajaEstado) cajaEstado.hidden = !tieneEstado;
    if (tieneEstado) llenar($('#f-estado'), opciones('estado'), 'Todos los estados');

    const tieneMarca = !!CONF.columnas.marca;
    $('#caja-marca').hidden = !tieneMarca;
    if (tieneMarca) {
      $('#etq-marca').textContent = MOD.mapa.marca.encabezado || ('Columna ' + MOD.mapa.marca.letra);
      const filtroMarca = $('#f-marca');
      if (filtroMarca.type === 'checkbox') {
        filtroMarca.checked = F.marca === 'SI';
        $('#valor-marca').textContent = F.marca === 'NO' ? 'NO' : '';
      }
      else llenar(filtroMarca, opciones('marca'), 'Todos');
    }
    $('#caja-visibles').hidden = !ITEMS.some(i => i.oculta);
  }

  /* =================================================================
     FILTRADO
     ================================================================= */
  function tramoDe(alcance) {
    if (alcance === null || alcance === undefined) return '';
    return CFG.tramosAlcance.find(t => alcance <= t.hasta).etiqueta;
  }

  /** Aplica todos los filtros. "sinDecision" se usa para contar los chips. */
  function filtrar(sinDecision) {
    return ITEMS.filter(it => {
      if (F.soloVisibles && it.oculta) return false;
      if (F.categoria && it.categoria !== F.categoria) return false;
      if (F.proveedor && it.proveedor !== F.proveedor) return false;
      if (F.estado && it.estado !== F.estado) return false;
      if (F.marca && it.marca !== F.marca) return false;
      if (F.alcanceBajo30 && !(typeof it.alcance === 'number' && it.alcance < 30)) return false;
      if (F.tramo && tramoDe(it.alcance) !== F.tramo) return false;
      if (!sinDecision && F.decisiones.size && !F.decisiones.has(it.decision)) return false;
      if (F.texto) {
        const t = BO.normalizar(it.codigos.join(' ') + ' ' + it.descripcion + ' ' + it.proveedor + ' ' + it.oc + ' ' + it.categoria);
        if (!F.texto.split(' ').every(p => t.includes(p))) return false;
      }
      return true;
    });
  }

  /* =================================================================
     DIBUJO GENERAL
     ================================================================= */
  function dibujar() {
    const vis = filtrar();
    dibujarKPIs(vis);
    dibujarChips();
    dibujarGraficos(vis);
    dibujarConclusiones(vis);
    dibujarTabla(vis);
    dibujarFiltrosActivos();
  }

  /* ---------------------------- KPIs ------------------------------ */
  function dibujarKPIs(vis) {
    const cuenta = d => vis.filter(i => i.decision === d).length;
    const tieneValor = vis.some(i => i.valor);
    const sumSug = vis.reduce((s, i) => s + (i.valorSugerido || 0), 0);
    const unidSug = vis.reduce((s, i) => s + (i.sugerido || 0), 0);
    const valInv = vis.reduce((s, i) => s + (i.valorStock || 0), 0);

    const tarjeta = (ico, titulo, valor, detalle, color, filtro, ayuda) => `
      <article class="kpi ${filtro && F.decisiones.has(filtro) ? 'activo' : ''}" style="--c:${color}"
        ${filtro ? 'data-filtro-decision="' + filtro + '" role="button" tabindex="0"' : ''} data-tip="${BO.esc(ayuda)}">
        <div class="kpi-ico">${BO.icono(ico)}</div>
        <div><small>${titulo}</small><b>${valor}</b><span>${detalle}</span></div>
      </article>`;

    const D = BO.DECISIONES;
    $('#kpis').innerHTML =
      tarjeta('caja', 'Artículos en vista', BO.n(vis.length), 'de ' + BO.n(ITEMS.length) + ' en la hoja', 'var(--bo-primario)', null, 'Cantidad de artículos que cumplen los filtros actuales.') +
      tarjeta('alerta', 'Stock 0', BO.n(cuenta('stock0')), 'urgentes', D.stock0.color, 'stock0', D.stock0.ayuda + '<br><b>Clic para filtrar.</b>') +
      tarjeta('carro', 'Comprar', BO.n(cuenta('comprar')), CONF.tipo === 'ropa' ? 'bajo el máximo' : 'bajo el mínimo', D.comprar.color, 'comprar', D.comprar.ayuda + '<br><b>Clic para filtrar.</b>') +
      tarjeta('camion', 'En tránsito', BO.n(cuenta('transito')), 'cubiertos por OC', D.transito.color, 'transito', D.transito.ayuda + '<br><b>Clic para filtrar.</b>') +
      tarjeta('dinero', 'Compra sugerida', tieneValor ? BO.clpCorto(sumSug) : BO.n(unidSug), tieneValor ? BO.n(unidSug) + ' unidades' : 'unidades (sin precio en hoja)', 'var(--bo-acento)', null,
        'Cantidad para volver al máximo:<br>máximo − stock − pendiente.' + (tieneValor ? '<br>Valor = cantidad × valor unitario.' : '')) +
      (tieneValor
        ? tarjeta('grafico', 'Valor inventario', BO.clpCorto(valInv), 'stock × valor unitario', 'var(--bo-primario-2)', null, 'Valor del stock actual de los artículos en vista.')
        : tarjeta('arriba', 'Sobrestock', BO.n(cuenta('sobre')), 'sobre el máximo', D.sobre.color, 'sobre', D.sobre.ayuda + '<br><b>Clic para filtrar.</b>'));
  }

  /* --------------------------- Chips ------------------------------ */
  function dibujarChips() {
    const base = filtrar(true);
    $('#chips-decision').innerHTML = '<span class="chips-titulo">' + BO.icono('filtro') + ' Decisión:</span>' +
      BO.ORDEN_DECISION.map(d => {
        const x = BO.DECISIONES[d];
        const n = base.filter(i => i.decision === d).length;
        return `<button type="button" class="chip ${F.decisiones.has(d) ? 'activo' : ''}" style="--c:${x.color}"
          data-filtro-decision="${d}" data-tip="${BO.esc(x.ayuda)}">${BO.icono(x.ico)} ${x.txt} <b>${n}</b></button>`;
      }).join('');
  }

  function dibujarFiltrosActivos() {
    const activos = [];
    if (F.categoria) activos.push(F.categoria);
    if (F.proveedor) activos.push(F.proveedor);
    if (F.estado) activos.push('Estado: ' + F.estado);
    if (F.alcanceBajo30) activos.push('Alcance bajo 30 días');
    if (F.tramo) activos.push('Alcance ' + F.tramo);
    if (F.marca) activos.push((MOD.mapa.marca.encabezado || 'Marca') + ': ' + F.marca);
    $('#filtros-activos').innerHTML = activos.length
      ? 'Filtrando por: ' + activos.map(a => '<b>' + BO.esc(a) + '</b>').join(' · ') : '';
  }

  /* =================================================================
     GRÁFICOS (Chart.js)
     ================================================================= */
  function estiloBase() {
    if (typeof Chart === 'undefined') return false;
    const css = getComputedStyle(document.documentElement);
    Chart.defaults.font.family = css.getPropertyValue('--bo-fuente').trim() || 'Roboto, sans-serif';
    Chart.defaults.color = css.getPropertyValue('--bo-texto-suave').trim() || '#55607a';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(68, 67, 69, .95)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    return true;
  }

  function crearOActualizar(id, config) {
    if (graficos[id]) {
      graficos[id].data = config.data;
      graficos[id].options = config.options;
      graficos[id].update();
    } else {
      graficos[id] = new Chart(document.getElementById(id), config);
    }
  }

  function dibujarGraficos(vis) {
    if (!estiloBase()) { $('#graficos').innerHTML = '<p class="vacio-celda">No se pudo cargar la librería de gráficos (revisa tu conexión).</p>'; return; }
    const css = getComputedStyle(document.documentElement);
    const primario = css.getPropertyValue('--bo-primario').trim();
    const acento = css.getPropertyValue('--bo-primario').trim();

    /* 1. Dona por decisión */
    const decs = BO.ORDEN_DECISION.filter(d => vis.some(i => i.decision === d));
    crearOActualizar('g-decision', {
      type: 'doughnut',
      data: {
        labels: decs.map(d => BO.DECISIONES[d].txt),
        datasets: [{ data: decs.map(d => vis.filter(i => i.decision === d).length),
          backgroundColor: decs.map(d => BO.DECISIONES[d].color), borderWidth: 3, borderColor: '#fff', hoverOffset: 14 }]
      },
      options: {
        cutout: '64%', maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } },
        onClick: (e, el) => { if (el.length) alternarDecision(decs[el[0].index]); },
        onHover: (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; }
      }
    });

    /* 2. Proveedores con más artículos para comprar */
    const urg = vis.filter(i => i.decision === 'stock0' || i.decision === 'comprar');
    const porProv = {};
    urg.forEach(i => {
      const p = porProv[i.proveedor] = porProv[i.proveedor] || { n: 0, v: 0 };
      p.n++; p.v += i.valorSugerido || 0;
    });
    const usaValor = urg.some(i => i.valorSugerido);
    const provs = Object.entries(porProv).sort((a, b) => usaValor ? b[1].v - a[1].v : b[1].n - a[1].n).slice(0, 10);
    $('#t-proveedor').textContent = usaValor ? 'Top proveedores por $ sugerido' : 'Top proveedores por artículos a comprar';
    crearOActualizar('g-proveedor', {
      type: 'bar',
      data: {
        labels: provs.map(p => p[0].length > 26 ? p[0].slice(0, 25) + '…' : p[0]),
        datasets: [{ data: provs.map(p => usaValor ? p[1].v : p[1].n), backgroundColor: acento, borderRadius: 8, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => { const p = provs[c.dataIndex][1]; return ' ' + p.n + ' artículos · ' + BO.clp(p.v); } } } },
        scales: { x: { grid: { color: '#e8e7e1' }, ticks: { callback: v => usaValor ? BO.clpCorto(v) : v } }, y: { grid: { display: false } } },
        onClick: (e, el) => {
          if (!el.length) return;
          F.proveedor = F.proveedor === provs[el[0].index][0] ? '' : provs[el[0].index][0];
          $('#f-proveedor').value = F.proveedor; F.pagina = 1; dibujar();
        },
        onHover: (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; }
      }
    });

    /* 3. Categorías apiladas por decisión */
    const cats = {};
    vis.forEach(i => { (cats[i.categoria] = cats[i.categoria] || []).push(i); });
    const topCats = Object.entries(cats)
      .sort((a, b) => b[1].filter(i => ['stock0', 'comprar'].includes(i.decision)).length - a[1].filter(i => ['stock0', 'comprar'].includes(i.decision)).length || b[1].length - a[1].length)
      .slice(0, 12);
    crearOActualizar('g-categoria', {
      type: 'bar',
      data: {
        labels: topCats.map(c => c[0].length > 22 ? c[0].slice(0, 21) + '…' : c[0]),
        datasets: BO.ORDEN_DECISION.map(d => ({
          label: BO.DECISIONES[d].txt, backgroundColor: BO.DECISIONES[d].color, borderRadius: 4, maxBarThickness: 34,
          data: topCats.map(c => c[1].filter(i => i.decision === d).length)
        })).filter(ds => ds.data.some(v => v))
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 50, minRotation: 30 } }, y: { stacked: true, grid: { color: '#e8e7e1' } } },
        onClick: (e, el) => {
          if (!el.length) return;
          const c = topCats[el[0].index][0];
          F.categoria = F.categoria === c ? '' : c;
          $('#f-categoria').value = F.categoria; F.pagina = 1; dibujar();
        },
        onHover: (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; }
      }
    });

    /* 4. Alcance (minmax) o mapa de calor (ropa / zapatos) */
    const usaMapa = CONF.tipo !== 'minmax';
    $('#card-alcance').hidden = usaMapa;
    $('#card-mapa').hidden = !usaMapa;
    if (usaMapa) { dibujarMapaCalor(vis); return; }

    const tramos = CFG.tramosAlcance.map(t => t.etiqueta);
    const conAlcance = vis.filter(i => i.alcance !== null && i.alcance !== undefined && i.minimo > 0);
    const colores = ['#E5383B', '#F59E0B', '#F2C94C', '#22A06B', primario];
    crearOActualizar('g-alcance', {
      type: 'bar',
      data: {
        labels: tramos,
        datasets: [{ data: tramos.map(t => conAlcance.filter(i => tramoDe(i.alcance) === t).length),
          backgroundColor: tramos.map((t, k) => F.tramo && F.tramo !== t ? colores[k] + '55' : colores[k]), borderRadius: 10, maxBarThickness: 60 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.raw + ' artículos (con mínimo definido)' } } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: '#e8e7e1' } } },
        onClick: (e, el) => {
          if (!el.length) return;
          const t = tramos[el[0].index];
          F.tramo = F.tramo === t ? '' : t; F.pagina = 1; dibujar();
        },
        onHover: (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; }
      }
    });
  }

  /* ----------------- Mapa de calor prenda/modelo × talla ----------------- */
  const ORDEN_TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
  function ordenTalla(a, b) {
    const ia = ORDEN_TALLAS.indexOf(a), ib = ORDEN_TALLAS.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return (parseFloat(a) || 0) - (parseFloat(b) || 0);
  }

  function dibujarMapaCalor(vis) {
    const tallas = [...new Set(vis.map(i => i.talla || '–'))].sort(ordenTalla);
    const cats = [...new Set(vis.map(i => i.categoria))];
    if (!vis.length) { $('#mapa-calor').innerHTML = '<p class="vacio-celda">Sin datos con los filtros actuales.</p>'; return; }
    const piso = i => CONF.tipo === 'ropa' ? i.maximo : i.minimo;

    let html = '<table class="mapa"><thead><tr><th>' + (CONF.tipo === 'ropa' ? 'Prenda' : 'Modelo') + ' / Talla</th>' +
      tallas.map(t => '<th>' + BO.esc(t) + '</th>').join('') + '</tr></thead><tbody>';
    cats.forEach(c => {
      html += '<tr><th title="' + BO.esc(c) + '">' + BO.esc(c) + '</th>';
      tallas.forEach(t => {
        const it = vis.find(i => i.categoria === c && (i.talla || '–') === t);
        if (!it) { html += '<td class="nada"></td>'; return; }
        const x = BO.DECISIONES[it.decision];
        const tip = `<b>${BO.esc(it.descripcion)}</b><br>Stock: ${BO.n(it.stock)} · ${CONF.tipo === 'ropa' ? 'Máx' : 'Mín'}: ${BO.n(piso(it))}<br>Pendiente: ${BO.n(it.pendiente)} · Sugerido: ${BO.n(it.sugerido)}<br>${x.txt}`;
        html += `<td data-id="${it.id}" data-talla="${BO.esc(t)}" style="--c:${x.color}" data-tip="${BO.esc(tip)}"><b>${BO.n(it.stock)}</b><small>/${BO.n(piso(it))}</small></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    $('#mapa-calor').innerHTML = html;
  }

  /* =================================================================
     CONCLUSIONES AUTOMÁTICAS
     ================================================================= */
  function dibujarConclusiones(vis) {
    const por = d => vis.filter(i => i.decision === d);
    const s0 = por('stock0'), co = por('comprar'), tr = por('transito'), so = por('sobre'), sm = por('sinmin');
    const urg = s0.concat(co);
    const ideas = [];

    if (s0.length) {
      ideas.push(['alerta', 'stock0', `<b>${s0.length}</b> artículo(s) sin stock y sin OC que lo cubra.`]);
    }
    if (urg.length) {
      const total = urg.reduce((s, i) => s + (i.valorSugerido || 0), 0);
      ideas.push(['carro', 'comprar', `<b>${urg.length}</b> artículo(s) requieren compra${total ? ', por un total estimado de <b>' + BO.clp(total) + '</b>' : ''}. Usa <b>“Agregar sugeridos”</b> para armar la pre-OC.`]);
      const prov = {};
      urg.forEach(i => { prov[i.proveedor] = (prov[i.proveedor] || 0) + 1; });
      const [pTop, nTop] = Object.entries(prov).sort((a, b) => b[1] - a[1])[0];
      if (nTop > 1) ideas.push(['camion', 'comprar', `El proveedor con más pedidos pendientes de generar es <b>${BO.esc(pTop)}</b> (${nTop} artículos). Conviene consolidar en una sola OC.`]);
    }
    if (tr.length) ideas.push(['reloj', 'transito', `<b>${tr.length}</b> artículo(s) están bajo el ${CONF.tipo === 'ropa' ? 'máximo' : 'mínimo'} pero con OC en camino. Revisa las fechas de llegada en el detalle.`]);
    if (so.length) {
      const inmov = so.reduce((s, i) => s + Math.max((i.stock || 0) - (CONF.tipo === 'minmax' ? i.maximo : (CONF.tipo === 'ropa' ? i.maximo : i.minimo)) , 0) * (i.valor || 0), 0);
      ideas.push(['arriba', 'sobre', `<b>${so.length}</b> artículo(s) con sobrestock${inmov ? ' (≈ ' + BO.clp(inmov) + ' sobre el nivel esperado)' : ''}. Evita volver a comprarlos.`]);
    }
    const smConsumo = sm.filter(i => (i.consumo1 || 0) + (i.consumo2 || 0) + (i.consumo3 || 0) > 0);
    if (smConsumo.length) ideas.push(['foco', 'sinmin', `<b>${smConsumo.length}</b> artículo(s) tienen consumo pero no tienen ${CONF.tipo === 'ropa' ? 'máximo' : 'mínimo'} definido. Sería bueno asignarles uno en el Excel.`]);
    if (!ideas.length) ideas.push(['check', 'ok', 'Todo en orden con los filtros actuales. No hay compras urgentes.']);

    $('#conclusiones').innerHTML = ideas.map(([ico, d, t]) =>
      `<li style="--c:${BO.DECISIONES[d].color}">${BO.icono(ico)}<span>${t}</span></li>`).join('');
  }

  /* =================================================================
     TABLA
     ================================================================= */
  function valorOrden(it, campo) {
    if (campo === 'decision') return BO.ORDEN_DECISION.indexOf(it.decision) * 1e12 - (it.valorSugerido || it.sugerido || 0);
    const v = it[campo];
    return v === null || v === undefined ? -Infinity : v;
  }

  function ordenarItems(items) {
    const { campo, dir } = F.orden;
    return items.slice().sort((a, b) => {
      const va = valorOrden(a, campo), vb = valorOrden(b, campo);
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
      return (va - vb) * dir;
    });
  }

  function dibujarTabla(vis) {
    const cols = definicionColumnas();
    const campos = CONF.tabla.filter(c => cols[c]);
    const ordenados = ordenarItems(vis);
    const { campo, dir } = F.orden;

    // Encabezados
    $('#tabla thead').innerHTML = '<tr>' + campos.map(c =>
      `<th data-campo="${c}" class="${['txt', 'desc', 'prov', 'dec'].includes(cols[c].tipo) ? '' : 'num'} ${campo === c ? 'orden-' + (dir > 0 ? 'asc' : 'desc') : ''}">${BO.esc(cols[c].t)}</th>`
    ).join('') + '<th class="accion"></th></tr>';

    // Paginación
    const porPag = CFG.filasPorPagina;
    const paginas = Math.max(1, Math.ceil(ordenados.length / porPag));
    if (F.pagina > paginas) F.pagina = paginas;
    const desde = (F.pagina - 1) * porPag;
    const pagina = ordenados.slice(desde, desde + porPag);

    $('#tabla tbody').innerHTML = pagina.length ? pagina.map(it => {
      const celdas = campos.map(c => celda(it, c, cols[c].tipo, cols[c].t)).join('');
      return `<tr data-id="${it.id}" class="${it.oculta ? 'fila-oculta' : ''}" style="--c:${BO.DECISIONES[it.decision].color}">${celdas}
        <td class="accion" data-label="Acción"><button class="btn-mas" data-agregar data-tip="Agregar a la lista de compra (${BO.n(it.sugerido || 1)} un.)">${BO.icono('mas')}</button></td></tr>`;
    }).join('') : `<tr><td colspan="${campos.length + 1}" class="vacio-celda">No hay artículos con estos filtros.</td></tr>`;

    $('#tabla-resumen').textContent = ordenados.length
      ? 'Mostrando ' + BO.n(desde + 1) + '–' + BO.n(Math.min(desde + porPag, ordenados.length)) + ' de ' + BO.n(ordenados.length)
      : 'Sin resultados';

    // Botones de página (máximo 7 visibles)
    let botones = `<button data-pag="${F.pagina - 1}" ${F.pagina === 1 ? 'disabled' : ''}>‹</button>`;
    const ini = Math.max(1, Math.min(F.pagina - 3, paginas - 6));
    for (let p = ini; p <= Math.min(paginas, ini + 6); p++) botones += `<button data-pag="${p}" class="${p === F.pagina ? 'activo' : ''}">${p}</button>`;
    botones += `<button data-pag="${F.pagina + 1}" ${F.pagina === paginas ? 'disabled' : ''}>›</button>`;
    $('#paginacion').innerHTML = paginas > 1 ? botones : '';
  }

  async function exportarTabla() {
    const filas = ordenarItems(filtrar());
    if (!filas.length) {
      BO.aviso('No hay artículos con los filtros actuales para exportar.', 'alerta');
      return;
    }
    if (!window.ExcelJS) {
      BO.aviso('No se pudo cargar el componente de Excel. Revisa tu conexión e inténtalo nuevamente.', 'alerta');
      return;
    }

    const boton = $('#btn-exportar-tabla');
    boton.disabled = true;
    try {
      const cols = definicionColumnas();
      const campos = CONF.tabla.filter(c => cols[c]);
      const exportCols = campos.flatMap(c => [
        { key: c, header: cols[c].t, tipo: cols[c].tipo },
        ...(c === 'stock' && filas.some(it => it.stockHomologado !== undefined)
          ? [{ key: 'stockHomologado', header: 'Stock homologado', tipo: 'num' }]
          : [])
      ]);
      const numero = '#,##0;[Red]-#,##0;"–"';
      const numeroDecimal = '#,##0.0;[Red]-#,##0.0;"–"';
      const moneda = '"$" #,##0;[Red]("$" #,##0);"–"';
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BO Packaging';
      workbook.created = new Date();
      const hoja = workbook.addWorksheet(CONF.titulo.slice(0, 31));
      const valores = filas.map(it => Object.fromEntries(exportCols.map(c => [
        c.key,
        c.key === 'decision' ? (BO.DECISIONES[it.decision]?.txt || BO.DECISIONES.sinmin.txt) : (it[c.key] ?? null)
      ])));

      hoja.columns = exportCols.map(c => {
        const ancho = valores.reduce((max, f) => Math.max(max, String(f[c.key] ?? '').length), c.header.length);
        const numFmt = c.tipo === 'clp' ? moneda : ['num', 'num1', 'stock', 'sug', 'alcance'].includes(c.tipo) ? (c.tipo === 'num1' ? numeroDecimal : numero) : undefined;
        return {
          key: c.key,
          header: c.header,
          width: Math.min(42, Math.max(12, ancho + 2)),
          style: Object.assign(
            { font: { name: 'Aptos', size: 10 }, alignment: { vertical: 'middle' } },
            numFmt ? { numFmt, alignment: { horizontal: 'right', vertical: 'middle' } } : {}
          )
        };
      });
      hoja.addRows(valores);
      hoja.views = [{ state: 'frozen', ySplit: 1 }];
      hoja.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: hoja.rowCount, column: exportCols.length }
      };

      const encabezado = hoja.getRow(1);
      encabezado.height = 28;
      encabezado.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF418332' } };
      encabezado.alignment = { vertical: 'middle', wrapText: true };

      const indiceDecision = exportCols.findIndex(c => c.key === 'decision') + 1;
      filas.forEach((it, i) => {
        const fila = hoja.getRow(i + 2);
        const color = (BO.DECISIONES[it.decision] || BO.DECISIONES.sinmin).color.slice(1).toUpperCase();
        const rgb = color.match(/.{2}/g).map(c => parseInt(c, 16));
        const tinte = 'FF' + rgb.map(c => Math.round(255 + (c - 255) * 0.1).toString(16).padStart(2, '0')).join('').toUpperCase();
        fila.height = 22;
        fila.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tinte } };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFECEBE6' } } };
        });
        fila.getCell(1).border = {
          left: { style: 'medium', color: { argb: 'FF' + color } },
          bottom: { style: 'hair', color: { argb: 'FFECEBE6' } }
        };
        if (indiceDecision) {
          const celdaDecision = fila.getCell(indiceDecision);
          celdaDecision.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF' + color } };
          celdaDecision.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tinte } };
        }
      });

      const contenido = await workbook.xlsx.writeBuffer();
      const archivo = new Blob([contenido], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      const nombre = CONF.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      enlace.href = url;
      enlace.download = 'Detalle_articulos_' + nombre + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      BO.aviso('Excel exportado con ' + BO.n(filas.length) + (filas.length === 1 ? ' artículo.' : ' artículos.'), 'ok');
    } catch (error) {
      console.error('Error al exportar el detalle a Excel:', error);
      BO.aviso('No se pudo generar el archivo Excel. Inténtalo nuevamente.', 'alerta');
    } finally {
      boton.disabled = false;
    }
  }

  /** Formato de cada celda según su tipo */
  function celda(it, campo, tipo, etiqueta) {
    const v = it[campo];
    const label = ' data-label="' + BO.esc(etiqueta) + '"';
    switch (tipo) {
      case 'desc': return `<td class="desc"${label}><b>${BO.esc(v)}</b>${it.variantes && it.variantes.length > 1 ? '<small>' + it.variantes.length + ' colores</small>' : ''}</td>`;
      case 'prov': return `<td class="prov"${label}>${BO.esc(v)}${it.proveedorDesdeOC ? ' <em data-tip="Proveedor tomado de la OC pendiente">OC</em>' : ''}</td>`;
      case 'clp':  return `<td class="num"${label}>${v ? BO.clp(v) : '–'}</td>`;
      case 'num':  return `<td class="num"${label}>${BO.n(v)}</td>`;
      case 'num1': return `<td class="num"${label}>${BO.n(v, true)}</td>`;
      case 'sug':  return `<td class="num"${label}><span class="sug ${v ? 'si' : ''}">${v ? BO.n(v) : '–'}</span></td>`;
      case 'dec':  return `<td${label}>${BO.badge(it.decision)}</td>`;
      case 'stock': {
        const ancho = it.cobertura === null ? 0 : Math.min(it.cobertura, 2) / 2 * 100;
        const ayuda = it.stockHomologado !== undefined
          ? ` data-tip="Stock propio: ${BO.n(v)}. Stock homologado usado para la decisión: ${BO.n(it.stockHomologado)}."`
          : '';
        return `<td class="num stock"${label}${ayuda}><b>${BO.n(v)}</b><i class="barra"><i style="width:${ancho}%"></i></i></td>`;
      }
      case 'alcance': {
        if (v === null || v === undefined) return `<td class="num"${label}>–</td>`;
        const c = v <= 7 ? '#E5383B' : v <= 15 ? '#F59E0B' : v <= 30 ? '#C9A227' : '#22A06B';
        return `<td class="num"${label}><span class="pill" style="--c:${c}">${BO.n(v)}</span></td>`;
      }
      default: return `<td${label}>${BO.esc(v ?? '')}</td>`;
    }
  }

})();
