/* =====================================================================
   COMUN.JS  |  Funciones compartidas por todas las páginas
   ---------------------------------------------------------------------
   1. Utilidades (números, textos, formatos)
   2. Íconos SVG
   3. Lectura y procesamiento del Excel
   4. Cálculo de la decisión de compra
   5. Guardado en el navegador (localStorage)
   6. Carga del archivo (botón y arrastrar/soltar)
   7. Tooltip, avisos (toast) y paneles laterales
   8. Lista de compra (pre-OC) y exportación a Excel
   ===================================================================== */

window.BO = window.BO || {};

(function (BO) {
  'use strict';
  const CFG = window.BO_CONFIG;
  const DB_CARPETA = 'boCompras.autocarga.v1';
  const STORE_CARPETA = 'preferencias';
  const KEY_CARPETA = 'directorioExcel';
  const EXTENSIONES_EXCEL = /\.(xlsx|xlsm|xls)$/i;
  let directorioExcel = null;
  let firmaExcelAuto = '';
  let intervaloExcelAuto = null;
  let cargaExcelAutoEnCurso = false;
  let cargaArchivoEnCurso = false;
  let ultimoErrorExcelAuto = '';

  /* =================================================================
     1. UTILIDADES
     ================================================================= */

  /** Quita tildes, pasa a mayúsculas y elimina espacios dobles */
  BO.normalizar = function (txt) {
    return String(txt ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
  };

  /** Convierte cualquier valor en número (o null si no es número) */
  BO.num = function (v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    let s = String(v).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (!s || /^#/.test(s)) return null;               // Errores tipo #VALUE!
    if (/,\d+$/.test(s) && !/\.\d{3},/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };

  /** Convierte cualquier valor en texto limpio */
  BO.txt = function (v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return BO.fecha(v);
    return String(v).replace(/\s+/g, ' ').trim();
  };

  /** Letra de columna Excel → índice (A=0, B=1, AA=26) */
  BO.letraAIndice = function (letra) {
    let n = 0;
    String(letra).toUpperCase().split('').forEach(c => { n = n * 26 + (c.charCodeAt(0) - 64); });
    return n - 1;
  };

  BO.indiceALetra = function (i) {
    let s = ''; i++;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  };

  const fmtEntero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
  const fmtDecimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

  /** Número con separador de miles chileno */
  BO.n = function (v, decimales) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '–';
    return (decimales ? fmtDecimal : fmtEntero).format(v);
  };

  /** Peso chileno */
  BO.clp = function (v) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    return '$' + fmtEntero.format(Math.round(v));
  };

  /** Peso abreviado ($1,2 M) para tarjetas */
  BO.clpCorto = function (v) {
    if (!v) return '$0';
    if (Math.abs(v) >= 1e6) return '$' + fmtDecimal.format(v / 1e6) + ' M';
    if (Math.abs(v) >= 1e3) return '$' + fmtDecimal.format(v / 1e3) + ' mil';
    return BO.clp(v);
  };

  BO.fecha = function (d) {
    if (!d) return '';
    const f = d instanceof Date ? d : new Date(d);
    if (isNaN(f)) return String(d);
    return f.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  BO.fechaHora = function (d) {
    const f = new Date(d);
    if (isNaN(f)) return '';
    return f.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /** Evita que textos del Excel rompan el HTML */
  BO.esc = function (s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /* =================================================================
     2. ÍCONOS SVG (sin librerías externas)
     ================================================================= */
  const ICONOS = {
    inicio:  '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    capas:   '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 16 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    llave:   '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    polera:  '<path d="M20.4 6.6 16 4a4 4 0 0 1-8 0L3.6 6.6a1 1 0 0 0-.4 1.3l1.6 3a1 1 0 0 0 1.3.4L8 10.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-9.5l1.9.8a1 1 0 0 0 1.3-.4l1.6-3a1 1 0 0 0-.4-1.3z"/>',
    zapato:  '<path d="M3 16V7h5l2 4 7.5 1.8A3 3 0 0 1 21 15.7V16z"/><path d="M3 16v3h18v-3"/><path d="M11 11.5 12.5 9M13.5 12l1.5-2.4"/>',
    subir:   '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>',
    bajar:   '<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',
    carro:   '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.2a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>',
    alerta:  '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    camion:  '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    check:   '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    caja:    '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    dinero:  '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5"/><path d="M12 6v2M12 16v2"/>',
    buscar:  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    cerrar:  '<path d="M6 6l12 12M18 6 6 18"/>',
    mas:     '<path d="M12 5v14M5 12h14"/>',
    basura:  '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    copiar:  '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    filtro:  '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    reloj:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rayo:    '<path d="M13 2 3 14h7l-1 8 12-14h-7z"/>',
    estrella: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z"/>',
    sol:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    nieve:   '<path d="M12 2v20M4 6l16 12M4 18 20 6"/><path d="m9 4 3 2 3-2m-6 16 3-2 3 2M4 10l3-1 1-3m8 12 1-3 3-1M4 14l3 1 1 3m8-12 1 3 3 1"/>',
    mundo:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    ubicacion: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
    foco:    '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    archivo: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    arriba:  '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    menos:   '<path d="M5 12h14"/>',
    refrescar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    tabla:   '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>'
  };

  /** Devuelve el SVG del ícono pedido */
  BO.icono = function (nombre, clase) {
    return '<svg class="ico ' + (clase || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONOS[nombre] || ICONOS.caja) + '</svg>';
  };

  /** Pinta los íconos declarados en el HTML con data-ico="nombre" */
  BO.pintarIconos = function (raiz) {
    (raiz || document).querySelectorAll('[data-ico]').forEach(el => {
      if (el.dataset.icoListo) return;
      el.insertAdjacentHTML('afterbegin', BO.icono(el.dataset.ico));
      el.dataset.icoListo = '1';
    });
  };

  /* =================================================================
     3. DECISIONES DE COMPRA (colores, textos e íconos)
     ================================================================= */
  BO.DECISIONES = {
    stock0:   { txt: 'Stock 0',     color: '#E5383B', ico: 'alerta', ayuda: 'Sin stock y sin OC suficiente. Comprar urgente.' },
    comprar:  { txt: 'Comprar',     color: '#F59E0B', ico: 'carro',  ayuda: 'Stock + pendiente bajo el mínimo.' },
    transito: { txt: 'En tránsito', color: '#2D9CDB', ico: 'camion', ayuda: 'Bajo el mínimo, pero la OC pendiente lo cubre.' },
    ok:       { txt: 'OK',          color: '#22A06B', ico: 'check',  ayuda: 'Stock dentro del rango.' },
    sobre:    { txt: 'Sobrestock',  color: '#7C5CFC', ico: 'arriba', ayuda: 'Stock sobre el máximo.' },
    sinmin:   { txt: 'Sin mínimo',  color: '#94A3B8', ico: 'menos',  ayuda: 'No tiene mínimo definido en el Excel.' }
  };
  BO.ORDEN_DECISION = ['stock0', 'comprar', 'transito', 'ok', 'sobre', 'sinmin'];

  BO.badge = function (d) {
    const x = BO.DECISIONES[d] || BO.DECISIONES.sinmin;
    return '<span class="badge" style="--c:' + x.color + '" data-tip="' + BO.esc(x.ayuda) + '">' +
      BO.icono(x.ico) + x.txt + '</span>';
  };

  /**
   * Calcula la decisión y la cantidad sugerida de un artículo.
   *  - "piso": nivel bajo el cual hay que comprar (mínimo; en ropa es el máximo)
   *  - "objetivo": hasta dónde reponer (máximo; si no hay, 2 × mínimo)
   */
  BO.calcularDecision = function (it, cfgModulo) {
    const stockPropio = it.stock || 0;
    const stock = it.stockHomologado ?? stockPropio;
    const min = it.minimo || 0, max = it.maximo || 0, pend = it.pendiente || 0;
    const tipo = cfgModulo.tipo;
    const piso = tipo === 'ropa' ? max : min;
    const objetivo = tipo === 'minmax' ? (max > 0 ? max : min * 2) : piso;
    const limiteSobre = (tipo === 'minmax' ? max : piso) * (cfgModulo.factorSobrestock || 1);
    const estadoNormalizado = BO.normalizar(it.estado);
    const enTransitoPorEstado = (cfgModulo.estadosTransito || [])
      .some(estado => estadoNormalizado.includes(BO.normalizar(estado)));

    let d;
    if (enTransitoPorEstado) d = 'transito';
    else if (piso <= 0) d = 'sinmin';
    else if (stock + pend < piso) d = stock <= 0 ? 'stock0' : 'comprar';
    else if (stock < piso) d = 'transito';
    else if (limiteSobre > 0 && stock > limiteSobre) d = 'sobre';
    else d = 'ok';

    it.decision = d;
    it.sugerido = (d === 'stock0' || d === 'comprar') ? Math.ceil(Math.max(objetivo - stock - pend, 0)) : 0;
    it.valorSugerido = it.sugerido * (it.valor || 0);
    it.valorStock = stockPropio * (it.valor || 0);
    it.cobertura = piso > 0 ? stock / piso : null;   // 1 = justo en el mínimo
    return it;
  };

  /* =================================================================
     4. LECTURA DEL EXCEL
     ================================================================= */

  /** Busca una hoja por nombre sin importar tildes ni mayúsculas */
  function buscarHoja(wb, nombres) {
    const buscados = nombres.map(BO.normalizar);
    const nombre = wb.SheetNames.find(n => buscados.includes(BO.normalizar(n)));
    return nombre ? { nombre, ws: wb.Sheets[nombre] } : null;
  }

  /** Lee la hoja completa desde A1 (para que las letras de columna coincidan con Excel) */
  function leerFilas(ws) {
    if (!ws || !ws['!ref']) return { filas: [], ocultas: new Set() };
    const rango = XLSX.utils.decode_range(ws['!ref']);
    rango.s.r = 0; rango.s.c = 0;
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true, range: rango });
    const ocultas = new Set();
    (ws['!rows'] || []).forEach((r, i) => { if (r && r.hidden) ocultas.add(i); });
    return { filas, ocultas };
  }

  /** Extrae la talla de una descripción (TALLA M, N° 40, N. 35) */
  BO.extraerTalla = function (desc) {
    const d = BO.normalizar(desc);
    let m = d.match(/TALLA\s+([A-Z0-9]+)/);
    if (m) return m[1];
    m = d.match(/N\s*[°º.]?\s*(\d{2})\b/);
    return m ? m[1] : '';
  };

  /** Nombre de la prenda sin la talla ni la composición */
  function prendaRopa(desc) {
    return BO.normalizar(desc).split(' TALLA ')[0].replace(/\(.*?\)/g, '').trim();
  }

  /** Modelo de zapato sin la talla */
  function modeloZapato(desc) {
    return BO.normalizar(desc).replace(/N\s*[°º.]?\s*\d{2}\b/, '').replace(/\s+/g, ' ').trim();
  }

  const CAMPOS_TEXTO = ['codigo', 'descripcion', 'categoria', 'proveedor', 'oc', 'estado', 'temporada', 'subcategoria', 'decisionExcel', 'marca'];

  function filtrarItemsSinConsumo(items, cfg) {
    if (!cfg.excluirSinConsumo) return items;
    return items.filter(it => !(it.consumo1 === 0 && it.consumo2 === 0 && it.consumo3 === 0));
  }

  function asignarStockHomologado(items, ws, columna) {
    const indiceColumna = BO.letraAIndice(columna);
    (ws['!merges'] || []).forEach(rango => {
      if (rango.s.c !== indiceColumna || rango.e.c !== indiceColumna || rango.e.r <= rango.s.r) return;
      const homologos = items.filter(it => it.fila - 1 >= rango.s.r && it.fila - 1 <= rango.e.r);
      if (homologos.length < 2) return;
      const stockTotal = homologos.reduce((total, it) => total + (it.stock || 0), 0);
      homologos.forEach(it => { it.stockHomologado = stockTotal; });
    });
  }

  /** Procesa una pestaña según su configuración */
  function procesarModulo(id, cfg, wb) {
    const hoja = buscarHoja(wb, cfg.hojas);
    if (!hoja) return { ok: false, error: 'No se encontró la pestaña "' + cfg.hojas[0] + '" en el Excel.', items: [] };

    const { filas, ocultas } = leerFilas(hoja.ws);
    const filaEnc = cfg.filaEncabezado - 1;
    const enc = filas[filaEnc] || [];

    // Mapa campo → columna (con el título real del Excel, útil para revisar)
    const mapa = {};
    Object.entries(cfg.columnas).forEach(([campo, letra]) => {
      const idx = BO.letraAIndice(letra);
      mapa[campo] = { letra, idx, encabezado: BO.txt(enc[idx]) };
    });

    // Columnas originales (para el panel de detalle)
    const columnasOriginales = [];
    enc.forEach((t, i) => { if (BO.txt(t)) columnasOriginales.push({ idx: i, letra: BO.indiceALetra(i), titulo: BO.txt(t) }); });

    const leer = (fila, campo) => {
      const m = mapa[campo];
      if (!m) return null;
      const v = fila[m.idx];
      return CAMPOS_TEXTO.includes(campo) ? BO.txt(v) : BO.num(v);
    };

    const items = [];
    let grupo = null; // Solo para zapatos

    for (let r = filaEnc + 1; r < filas.length; r++) {
      const fila = filas[r] || [];
      const codigo = leer(fila, 'codigo');
      const descripcion = leer(fila, 'descripcion');
      if (!codigo || !descripcion) continue;
      if (BO.normalizar(codigo) === 'CODIGO') continue;

      // --- Zapatos: una talla puede tener 2 o 3 filas (colores) ---
      if (cfg.tipo === 'zapatos') {
        const esCabeza = BO.num(fila[mapa.minimo.idx]) !== null || BO.num(fila[mapa.stock.idx]) !== null;
        if (!esCabeza && grupo) {
          grupo.variantes.push({ codigo, descripcion, stock: leer(fila, 'stockUnidad') || 0 });
          grupo.codigos.push(codigo);
          grupo.pendiente = (grupo.pendiente || 0) + (leer(fila, 'pendiente') || 0);
          const ocV = leer(fila, 'oc');
          if (ocV && ocV !== '0' && !grupo.oc.split(' / ').includes(ocV)) grupo.oc = grupo.oc ? grupo.oc + ' / ' + ocV : ocV;
          continue;
        }
      }

      const it = { id: id + '-' + (r + 1), modulo: id, fila: r + 1, oculta: ocultas.has(r), codigos: [codigo] };
      Object.keys(cfg.columnas).forEach(campo => { it[campo] = leer(fila, campo); });
      it.codigo = codigo;
      it.descripcion = descripcion;
      if (!it.oc || it.oc === '0') it.oc = '';
      it.orig = columnasOriginales.map(c => {
        const v = fila[c.idx];
        return typeof v === 'number' ? Math.round(v * 100) / 100 : BO.txt(v);
      });

      if (cfg.tipo === 'ropa') {
        it.categoria = prendaRopa(descripcion);
        it.talla = BO.extraerTalla(descripcion);
      }
      if (cfg.tipo === 'zapatos') {
        it.categoria = modeloZapato(descripcion);
        it.talla = BO.extraerTalla(descripcion);
        if (it.stock === null) it.stock = it.stockUnidad || 0;
        it.variantes = [{ codigo, descripcion, stock: it.stockUnidad || 0 }];
        grupo = it;
      }
      if (!it.categoria) it.categoria = 'Sin categoría';
      items.push(it);
    }

    if (cfg.columnaHomologos) asignarStockHomologado(items, hoja.ws, cfg.columnaHomologos);
    const itemsValidos = filtrarItemsSinConsumo(items, cfg);
    itemsValidos.forEach(it => BO.calcularDecision(it, cfg));
    return { ok: true, hoja: hoja.nombre, mapa, columnasOriginales, items: itemsValidos };
  }

  /** Lee la hoja de OC pendientes y la agrupa por código de artículo */
  function procesarOC(wb, codigosValidos) {
    const c = CFG.hojaOC;
    const hoja = buscarHoja(wb, c.hojas);
    if (!hoja) return {};
    const { filas } = leerFilas(hoja.ws);
    const enc = (filas[c.filaEncabezado - 1] || []).map(BO.normalizar);
    const col = {};
    Object.entries(c.titulos).forEach(([campo, opciones]) => {
      const i = enc.findIndex(t => opciones.map(BO.normalizar).includes(t));
      if (i >= 0) col[campo] = i;
    });
    if (col.codigo === undefined) return {};

    const porCodigo = {};
    for (let r = c.filaEncabezado; r < filas.length; r++) {
      const f = filas[r] || [];
      const codigo = BO.txt(f[col.codigo]);
      if (!codigo || !codigosValidos.has(codigo)) continue;
      const pend = BO.num(f[col.pendiente]) || 0;
      if (pend <= 0) continue;
      const v = k => (col[k] === undefined ? '' : f[col[k]]);
      (porCodigo[codigo] = porCodigo[codigo] || []).push({
        oc: BO.txt(v('oc')), fecha: BO.txt(v('fecha')), proveedor: BO.txt(v('proveedor')),
        descripcion: BO.txt(v('descripcion')), precio: BO.num(v('precio')), moneda: BO.txt(v('moneda')),
        recepcion: BO.txt(v('recepcion')), solicitada: BO.num(v('solicitada')), pendiente: pend,
        eta: BO.txt(v('eta')), estatus: BO.txt(v('estatus'))
      });
    }
    return porCodigo;
  }

  function fechaISODeOC(valor) {
    const crear = (anio, mes, dia) => {
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return '';
      return fecha.toISOString().slice(0, 10);
    };
    if (valor instanceof Date && Number.isFinite(valor.getTime())) {
      return crear(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
    }
    if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= 2958465) {
      const fecha = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000));
      return Number.isFinite(fecha.getTime()) ? fecha.toISOString().slice(0, 10) : '';
    }
    const texto = BO.txt(valor).split(/\s+/)[0];
    let m = texto.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return crear(Number(m[1]), Number(m[2]), Number(m[3]));
    m = texto.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) return crear(Number(m[3]), Number(m[2]), Number(m[1]));
    return '';
  }

  /** Lee OC ABIERTAS y agrupa las líneas por número de OC */
  function procesarOCAbiertas(wb) {
    const cfg = CFG.hojaOCAbiertas;
    const hoja = buscarHoja(wb, cfg.hojas);
    if (!hoja) return { ok: false, error: 'No se encontró la pestaña "OC ABIERTAS" en el Excel.', items: [], columnas: [] };

    const { filas } = leerFilas(hoja.ws);
    const indices = Object.fromEntries(Object.entries(cfg.columnas).map(([campo, letra]) => [campo, BO.letraAIndice(letra)]));
    const encabezadoEn = filas.findIndex((filaOriginal, i) => {
      if (i > 19) return false;
      const fila = filaOriginal || [];
      const valor = campo => BO.normalizar(fila[indices[campo]] || '').replace(/[^A-Z0-9]/g, '');
      return /OC|ORDEN|NUM/.test(valor('oc')) &&
        /FECHA|FEC/.test(valor('fecha')) &&
        /RUT/.test(valor('rut')) &&
        /NOMBRE|PROVEEDOR/.test(valor('proveedor'));
    });
    const inicioDatos = encabezadoEn >= 0 ? encabezadoEn + 1 : 0;
    const maxColumnas = filas.reduce((max, fila) => Math.max(max, (fila || []).length), 0);
    const encabezados = encabezadoEn >= 0 ? filas[encabezadoEn] : [];
    const columnas = Array.from({ length: maxColumnas }, (_, i) =>
      BO.txt(encabezados[i]) || 'Columna ' + BO.indiceALetra(i));
    const grupos = new Map();

    for (let r = inicioDatos; r < filas.length; r++) {
      const fila = filas[r] || [];
      const oc = BO.txt(fila[indices.oc]);
      if (!oc) continue;
      const ocNormalizada = BO.normalizar(oc).replace(/\s+/g, '');
      if (/^(NUMERO|NUM|NRO|NOC|NUMEROOC|NUMOC|ORDENDECOMPRA)$/.test(ocNormalizada)) continue;

      const fecha = fechaISODeOC(fila[indices.fecha]);
      const rut = BO.txt(fila[indices.rut]);
      const proveedor = BO.txt(fila[indices.proveedor]);
      const clave = ocNormalizada || oc;
      let grupo = grupos.get(clave);
      if (!grupo) {
        grupo = { oc, fecha: '', proveedores: [], lineas: [] };
        grupos.set(clave, grupo);
      }
      if (fecha && (!grupo.fecha || fecha < grupo.fecha)) grupo.fecha = fecha;
      if (rut || proveedor) {
        const proveedorKey = BO.normalizar(rut + '|' + proveedor);
        if (!grupo.proveedores.some(p => p.clave === proveedorKey)) {
          grupo.proveedores.push({ clave: proveedorKey, rut, nombre: proveedor });
        }
      }
      const detalle = columnas.map((titulo, i) => ({ titulo, valor: fila[i] instanceof Date
        ? fechaISODeOC(fila[i])
        : BO.txt(fila[i]) })).filter(c => c.valor);
      if (detalle.length) grupo.lineas.push({ fila: r + 1, detalle });
    }

    return { ok: true, hoja: hoja.nombre, encabezado: encabezadoEn + 1, columnas, items: [...grupos.values()] };
  }

  /** Procesa el libro completo (módulos, OC pendientes y OC ABIERTAS) */
  BO.procesarLibro = function (wb, nombreArchivo) {
    const datos = { archivo: nombreArchivo, cargado: new Date().toISOString(), versionHomologos: 1, modulos: {}, ocs: {} };
    const codigos = new Set();

    Object.entries(CFG.modulos).forEach(([id, cfg]) => {
      datos.modulos[id] = procesarModulo(id, cfg, wb);
      datos.modulos[id].items.forEach(it => it.codigos.forEach(c => codigos.add(c)));
    });

    datos.ocs = procesarOC(wb, codigos);
    datos.ocAbiertas = procesarOCAbiertas(wb);

    // Si un artículo no tiene proveedor en su hoja, se toma el de su OC pendiente
    Object.values(datos.modulos).forEach(m => m.items.forEach(it => {
      if (!it.proveedor) {
        const oc = it.codigos.map(c => datos.ocs[c]).flat().filter(Boolean)[0];
        it.proveedor = oc ? oc.proveedor : '';
        it.proveedorDesdeOC = !!oc;
      }
      if (!it.proveedor) it.proveedor = 'Sin proveedor';
    }));
    return datos;
  };

  /* =================================================================
     5. GUARDADO EN EL NAVEGADOR
     ================================================================= */
  let cache = null;
  let avisoDatosHomologosAntiguosPendiente = false;

  BO.obtenerDatos = function () {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(CFG.claveDatos) || 'null');
      if (cache && cache.modulos) {
        Object.entries(CFG.modulos).forEach(([id, cfg]) => {
          const modulo = cache.modulos[id];
          if (modulo && Array.isArray(modulo.items)) modulo.items = filtrarItemsSinConsumo(modulo.items, cfg);
        });
        if (cache.versionHomologos !== 1 && cache.modulos.bmat &&
            Array.isArray(cache.modulos.bmat.items) && cache.modulos.bmat.items.length) {
          avisoDatosHomologosAntiguosPendiente = true;
        }
      }
    } catch (e) { cache = null; }
    return cache;
  };

  BO.guardarDatos = function (datos) {
    cache = datos;
    try { localStorage.setItem(CFG.claveDatos, JSON.stringify(datos)); }
    catch (e) {
      BO.aviso('Los datos se cargaron, pero son muy grandes para guardarse en el navegador. ' +
        'Tendrás que cargar el Excel en cada página.', 'alerta');
    }
  };

  BO.borrarDatos = function () {
    cache = null;
    localStorage.removeItem(CFG.claveDatos);
  };

  /** Busca las OC pendientes de un artículo (incluye variantes de color) */
  BO.ocsDe = function (it) {
    const d = BO.obtenerDatos();
    if (!d || !d.ocs) return [];
    return it.codigos.map(c => (d.ocs[c] || []).map(o => Object.assign({ codigo: c }, o))).flat();
  };

  /* =================================================================
     6. Carga del archivo (manual, carpeta autorizada y arrastrar y soltar)
     ================================================================= */
  BO.cargarArchivo = async function (archivo) {
    if (!archivo) return false;
    if (!EXTENSIONES_EXCEL.test(archivo.name)) { BO.aviso('El archivo debe ser Excel (.xlsx, .xlsm o .xls).', 'alerta'); return false; }
    if (typeof XLSX === 'undefined') { BO.aviso('No se pudo cargar la librería de Excel. Revisa tu conexión a internet (ver LEEME.md).', 'alerta'); return false; }
    if (cargaArchivoEnCurso) { BO.aviso('Ya hay una carga de Excel en curso. Espera a que termine.', 'alerta'); return false; }

    cargaArchivoEnCurso = true;
    document.body.classList.add('cargando');
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      const buffer = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(lector.error || new Error('No se pudo leer el archivo Excel.'));
        lector.readAsArrayBuffer(archivo);
      });
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const datos = BO.procesarLibro(wb, archivo.name);
      BO.guardarDatos(datos);
      const total = Object.values(datos.modulos).reduce((s, m) => s + m.items.length, 0);
      const faltan = Object.entries(datos.modulos).filter(([, m]) => !m.ok).map(([id]) => CFG.modulos[id].titulo);
      if (!datos.ocAbiertas.ok) faltan.push('OC ABIERTAS');
      const resumenOC = datos.ocAbiertas.ok ? ' ' + BO.n(datos.ocAbiertas.items.length) + ' OC abiertas.' : '';
      BO.aviso('Excel cargado: ' + BO.n(total) + ' artículos.' + resumenOC +
        (faltan.length ? ' Falta la pestaña: ' + faltan.join(', ') : ''), faltan.length ? 'alerta' : 'ok');
      document.dispatchEvent(new CustomEvent('bo:datos', { detail: datos }));
      BO.pintarInfoArchivo();
      return true;
    } catch (err) {
      console.error(err);
      BO.aviso('No se pudo leer el Excel: ' + err.message, 'alerta');
      return false;
    } finally {
      cargaArchivoEnCurso = false;
      document.body.classList.remove('cargando');
    }
  };

  function abrirBaseCarpeta() {
    return new Promise((resolve, reject) => {
      const solicitud = indexedDB.open(DB_CARPETA, 1);
      solicitud.onupgradeneeded = () => solicitud.result.createObjectStore(STORE_CARPETA);
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error || new Error('No se pudo abrir el almacenamiento de permisos.'));
    });
  }

  async function obtenerDirectorioGuardado() {
    const db = await abrirBaseCarpeta();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARPETA, 'readonly');
      const solicitud = tx.objectStore(STORE_CARPETA).get(KEY_CARPETA);
      solicitud.onsuccess = () => { db.close(); resolve(solicitud.result || null); };
      solicitud.onerror = () => { db.close(); reject(solicitud.error || new Error('No se pudo recuperar la carpeta autorizada.')); };
    });
  }

  async function guardarDirectorio(directorio) {
    const db = await abrirBaseCarpeta();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CARPETA, 'readwrite');
      tx.objectStore(STORE_CARPETA).put(directorio, KEY_CARPETA);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('No se pudo guardar el permiso de la carpeta.')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Se canceló el guardado del permiso de la carpeta.')); };
    });
  }

  async function buscarExcel(directorio) {
    const candidatos = [];
    for await (const [nombre, handle] of directorio.entries()) {
      if (handle.kind !== 'file' || nombre.startsWith('~$') || !EXTENSIONES_EXCEL.test(nombre)) continue;
      const archivo = await handle.getFile();
      const base = nombre.replace(EXTENSIONES_EXCEL, '');
      candidatos.push({ archivo, nombreExacto: BO.normalizar(base) === 'PLANILLA DE COMPRAS' });
    }
    if (!candidatos.length) throw new Error('No encontré archivos Excel en la carpeta autorizada.');
    candidatos.sort((a, b) => Number(b.nombreExacto) - Number(a.nombreExacto) ||
      b.archivo.lastModified - a.archivo.lastModified ||
      a.archivo.name.localeCompare(b.archivo.name, 'es'));
    return candidatos[0].archivo;
  }

  function actualizarBotonCarpeta(texto, ayuda) {
    const boton = document.getElementById('bo-btn-cambiar-carpeta');
    if (!boton) return;
    boton.textContent = texto;
    boton.title = ayuda;
    boton.dataset.tip = BO.esc(ayuda);
  }

  function iniciarMonitoreoExcel(directorio) {
    directorioExcel = directorio;
    if (intervaloExcelAuto) clearInterval(intervaloExcelAuto);
    intervaloExcelAuto = setInterval(() => {
      if (document.visibilityState === 'visible') cargarExcelDesdeCarpeta(false);
    }, 60000);
  }

  async function cargarExcelDesdeCarpeta(forzar) {
    if (!directorioExcel || cargaExcelAutoEnCurso) return false;
    cargaExcelAutoEnCurso = true;
    try {
      const permiso = await directorioExcel.queryPermission({ mode: 'read' });
      if (permiso !== 'granted') {
        if (intervaloExcelAuto) clearInterval(intervaloExcelAuto);
        intervaloExcelAuto = null;
        actualizarBotonCarpeta('Autorizar carpeta', 'Vuelve a elegir la carpeta para autorizar el acceso.');
        throw new Error('El navegador requiere autorización para volver a leer la carpeta.');
      }
      const archivo = await buscarExcel(directorioExcel);
      const firma = archivo.name + '|' + archivo.lastModified + '|' + archivo.size;
      if (!forzar && firma === firmaExcelAuto) return true;
      if (!await BO.cargarArchivo(archivo)) return false;
      firmaExcelAuto = firma;
      ultimoErrorExcelAuto = '';
      actualizarBotonCarpeta('Cambiar carpeta', 'Cambiar la carpeta autorizada para la carga automática.');
      return true;
    } catch (err) {
      console.error(err);
      if (ultimoErrorExcelAuto !== err.message) {
        BO.aviso('No se pudo actualizar desde la carpeta: ' + err.message, 'alerta');
        ultimoErrorExcelAuto = err.message;
      }
      return false;
    } finally {
      cargaExcelAutoEnCurso = false;
    }
  }

  async function seleccionarCarpetaExcel() {
    if (!window.isSecureContext || !window.showDirectoryPicker || !window.indexedDB) {
      BO.aviso('La carga automática requiere un navegador compatible y abrir el dashboard desde un contexto seguro (por ejemplo, localhost).', 'alerta');
      return;
    }
    try {
      const directorio = await window.showDirectoryPicker({ mode: 'read' });
      await guardarDirectorio(directorio);
      directorioExcel = directorio;
      firmaExcelAuto = '';
      actualizarBotonCarpeta('Cambiar carpeta', 'Cambiar la carpeta autorizada para la carga automática.');
      iniciarMonitoreoExcel(directorio);
      if (await cargarExcelDesdeCarpeta(true)) {
        BO.aviso('Carpeta autorizada: ' + directorio.name + '. Se actualizará automáticamente.', 'ok');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      BO.aviso('No se pudo configurar la carpeta: ' + err.message, 'alerta');
    }
  }

  async function iniciarCargaAutomatica() {
    if (!window.isSecureContext || !window.showDirectoryPicker || !window.indexedDB) return;
    try {
      const directorio = await obtenerDirectorioGuardado();
      if (!directorio) return;
      directorioExcel = directorio;
      const permiso = await directorio.queryPermission({ mode: 'read' });
      if (permiso !== 'granted') {
        actualizarBotonCarpeta('Autorizar carpeta', 'Vuelve a elegir la carpeta para autorizar el acceso.');
        BO.aviso('El navegador necesita autorización para leer la carpeta. Selecciónala con el botón de carpeta.', 'alerta');
        return;
      }
      actualizarBotonCarpeta('Cambiar carpeta', 'Cambiar la carpeta autorizada para la carga automática.');
      iniciarMonitoreoExcel(directorio);
      await cargarExcelDesdeCarpeta(true);
    } catch (err) {
      console.error(err);
      BO.aviso('No se pudo iniciar la carga automática: ' + err.message, 'alerta');
    }
  }

  /** Conecta la carga manual, el acceso a carpeta y la zona de arrastrar/soltar */
  function activarCarga() {
    let input = document.getElementById('bo-input-excel');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file'; input.id = 'bo-input-excel'; input.accept = '.xlsx,.xlsm,.xls'; input.hidden = true;
      document.body.appendChild(input);
    }
    input.addEventListener('change', () => { BO.cargarArchivo(input.files[0]); input.value = ''; });

    const botonCarpeta = document.getElementById('bo-btn-cambiar-carpeta');
    const botonMenu = document.getElementById('bo-btn-menu-datos');
    const panelMenu = document.getElementById('bo-menu-datos');
    const cerrarMenu = () => {
      if (!botonMenu || !panelMenu) return;
      panelMenu.hidden = true;
      botonMenu.setAttribute('aria-expanded', 'false');
    };

    if (botonCarpeta) botonCarpeta.addEventListener('click', () => {
      cerrarMenu();
      seleccionarCarpetaExcel();
    });
    if (botonMenu && panelMenu) {
      botonMenu.addEventListener('click', () => {
        panelMenu.hidden = !panelMenu.hidden;
        botonMenu.setAttribute('aria-expanded', String(!panelMenu.hidden));
      });
      document.addEventListener('click', e => {
        if (!e.target.closest('.menu-datos')) cerrarMenu();
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
      const botonActualizar = panelMenu.querySelector('[data-accion="cargar"]');
      if (botonActualizar) botonActualizar.addEventListener('click', cerrarMenu);
    }

    document.addEventListener('click', e => {
      if (e.target.closest('[data-accion="cargar"]')) input.click();
    });

    // Arrastrar y soltar en toda la página
    let contador = 0;
    document.addEventListener('dragenter', e => { e.preventDefault(); contador++; document.body.classList.add('arrastrando'); });
    document.addEventListener('dragleave', () => { contador--; if (contador <= 0) document.body.classList.remove('arrastrando'); });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault(); contador = 0; document.body.classList.remove('arrastrando');
      if (e.dataTransfer.files.length) BO.cargarArchivo(e.dataTransfer.files[0]);
    });
    iniciarCargaAutomatica();
  }

  /** Muestra en la barra superior el nombre del archivo y la hora de carga */
  BO.pintarInfoArchivo = function () {
    const el = document.getElementById('bo-info-archivo');
    if (!el) return;
    const d = BO.obtenerDatos();
    el.innerHTML = d
      ? BO.icono('archivo') + '<span><b>' + BO.esc(d.archivo) + '</b><small>Cargado ' + BO.fechaHora(d.cargado) + '</small></span>'
      : BO.icono('archivo') + '<span><b>Sin datos</b><small>Carga tu Excel para comenzar</small></span>';
  };

  /* =================================================================
     7. TOOLTIP, AVISOS Y PANELES LATERALES
     ================================================================= */
  function montarElementosComunes() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bo-tooltip" role="tooltip"></div>
      <div id="bo-avisos" aria-live="polite"></div>
      <div id="bo-capa-arrastre"><div>${BO.icono('subir')}<p>Suelta aquí tu Excel para actualizar</p></div></div>
      <div id="bo-capa-carga"><div class="spinner"></div><p>Procesando Excel…</p></div>
      <div class="velo" id="bo-velo"></div>
      <aside class="panel" id="bo-panel-detalle" aria-label="Detalle del artículo"></aside>
      <aside class="panel" id="bo-panel-lista" aria-label="Lista de compra"></aside>
    `);

    // Tooltip que sigue al mouse (para cualquier elemento con data-tip)
    const tip = document.getElementById('bo-tooltip');
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.classList.remove('visible'); return; }
      tip.innerHTML = t.dataset.tip;
      tip.classList.add('visible');
    });
    document.addEventListener('mousemove', e => {
      if (!tip.classList.contains('visible')) return;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
      const y = e.clientY + 18 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 12 : e.clientY + 18;
      tip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });

    document.getElementById('bo-velo').addEventListener('click', BO.cerrarPaneles);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') BO.cerrarPaneles(); });
    document.addEventListener('click', e => {
      if (e.target.closest('[data-accion="cerrar-panel"]')) BO.cerrarPaneles();
      if (e.target.closest('[data-accion="abrir-lista"]')) BO.abrirLista();
    });
  }

  BO.aviso = function (mensaje, tipo) {
    const cont = document.getElementById('bo-avisos');
    if (!cont) return alert(mensaje);
    const el = document.createElement('div');
    el.className = 'aviso ' + (tipo || 'ok');
    el.innerHTML = BO.icono(tipo === 'alerta' ? 'alerta' : 'check') + '<span>' + BO.esc(mensaje) + '</span>';
    cont.appendChild(el);
    setTimeout(() => el.classList.add('saliendo'), 4200);
    setTimeout(() => el.remove(), 4700);
  };

  BO.abrirPanel = function (id) {
    BO.cerrarPaneles();
    document.getElementById(id).classList.add('abierto');
    document.getElementById('bo-velo').classList.add('visible');
  };

  BO.cerrarPaneles = function () {
    document.querySelectorAll('.panel.abierto').forEach(p => p.classList.remove('abierto'));
    const v = document.getElementById('bo-velo');
    if (v) v.classList.remove('visible');
  };

  /** Panel con el detalle completo de un artículo */
  BO.abrirDetalle = function (it) {
    const d = BO.obtenerDatos();
    const mod = d.modulos[it.modulo];
    const cfg = CFG.modulos[it.modulo];
    const ocs = BO.ocsDe(it);
    const x = BO.DECISIONES[it.decision];

    const mini = (titulo, valor, ico) =>
      `<div class="mini">${BO.icono(ico)}<small>${titulo}</small><b>${valor}</b></div>`;

    const filasOC = ocs.length ? ocs.map(o => `
      <tr><td><b>${BO.esc(o.oc)}</b><small>${BO.esc(o.fecha)}</small></td>
      <td>${BO.esc(o.proveedor)}</td><td class="num">${BO.n(o.pendiente)}</td>
      <td>${BO.esc(o.eta || o.recepcion || '–')}</td></tr>`).join('')
      : '<tr><td colspan="4" class="vacio-celda">Sin OC pendientes para este código.</td></tr>';

    const variantes = it.variantes && it.variantes.length > 1 ? `
      <h4>${BO.icono('capas')} Variantes de la talla</h4>
      <table class="tabla-mini"><thead><tr><th>Código</th><th>Descripción</th><th class="num">Stock</th></tr></thead>
      <tbody>${it.variantes.map(v => `<tr><td>${BO.esc(v.codigo)}</td><td>${BO.esc(v.descripcion)}</td><td class="num">${BO.n(v.stock)}</td></tr>`).join('')}</tbody></table>` : '';

    const originales = mod.columnasOriginales.map((c, i) =>
      `<div><dt>${BO.esc(c.titulo)} <em>${c.letra}</em></dt><dd>${BO.esc(it.orig[i] === '' || it.orig[i] === null ? '–' : (typeof it.orig[i] === 'number' ? BO.n(it.orig[i], true) : it.orig[i]))}</dd></div>`).join('');

    const panel = document.getElementById('bo-panel-detalle');
    panel.innerHTML = `
      <header class="panel-cab" style="--c:${x.color}">
        <div><small>${BO.esc(cfg.titulo)} · Fila ${it.fila} del Excel${it.oculta ? ' · (fila oculta en Excel)' : ''}</small>
        <h3>${BO.esc(it.descripcion)}</h3>
        <p>Código <b>${BO.esc(it.codigo)}</b> · ${BO.esc(it.proveedor)} ${BO.badge(it.decision)}</p></div>
        <button class="btn-icono" data-accion="cerrar-panel" aria-label="Cerrar">${BO.icono('cerrar')}</button>
      </header>
      <div class="panel-cuerpo">
        <div class="minis">
          ${mini('Stock', BO.n(it.stock), 'caja')}
          ${it.stockHomologado !== undefined ? mini('Stock homologado', BO.n(it.stockHomologado), 'capas') : ''}
          ${mini(cfg.tipo === 'ropa' ? 'Máximo' : 'Mínimo', BO.n(cfg.tipo === 'ropa' ? it.maximo : it.minimo), 'menos')}
          ${cfg.tipo === 'minmax' ? mini('Máximo', BO.n(it.maximo), 'arriba') : mini('Valor unit.', BO.clp(it.valor), 'dinero')}
          ${mini('Pendiente OC', BO.n(it.pendiente), 'camion')}
          ${it.alcance !== undefined && it.alcance !== null ? mini('Alcance', BO.n(it.alcance) + ' días', 'reloj') : mini('Talla', BO.esc(it.talla || '–'), 'tabla')}
          ${mini('Sugerido', BO.n(it.sugerido), 'carro')}
        </div>
        <p class="explica" style="--c:${x.color}">${BO.icono('foco')}<span>${explicarDecision(it, cfg)}</span></p>
        <div class="agregar-lista">
          <label>Cantidad a pedir <input type="number" min="0" step="1" id="bo-cant-detalle" value="${it.sugerido || ''}"></label>
          <button class="btn primario" id="bo-btn-agregar-detalle">${BO.icono('carro')} Agregar a la lista de compra</button>
        </div>
        ${variantes}
        <h4>${BO.icono('camion')} OC pendientes (hoja OC PENDIENTE)</h4>
        <table class="tabla-mini"><thead><tr><th>OC</th><th>Proveedor</th><th class="num">Pend.</th><th>ETA / Recep.</th></tr></thead>
        <tbody>${filasOC}</tbody></table>
        <h4>${BO.icono('tabla')} Datos originales del Excel</h4>
        <dl class="originales">${originales}</dl>
      </div>`;
    document.getElementById('bo-btn-agregar-detalle').addEventListener('click', () => {
      const cant = BO.num(document.getElementById('bo-cant-detalle').value) || 0;
      if (cant <= 0) { BO.aviso('Ingresa una cantidad mayor a 0.', 'alerta'); return; }
      BO.lista.agregar(it, cant);
    });
    BO.abrirPanel('bo-panel-detalle');
  };

  /** Explica en lenguaje simple por qué se tomó la decisión */
  function explicarDecision(it, cfg) {
    const piso = cfg.tipo === 'ropa' ? it.maximo : it.minimo;
    const nombrePiso = cfg.tipo === 'ropa' ? 'máximo' : 'mínimo';
    const stock = it.stockHomologado ?? it.stock ?? 0;
    const etiquetaStock = it.stockHomologado !== undefined ? 'Stock homologado' : 'Stock';
    const disp = stock + (it.pendiente || 0);
    switch (it.decision) {
      case 'stock0': return `No hay ${etiquetaStock.toLowerCase()} y lo pendiente (${BO.n(it.pendiente)}) no alcanza el ${nombrePiso} (${BO.n(piso)}). Se sugiere pedir <b>${BO.n(it.sugerido)}</b>.`;
      case 'comprar': return `${etiquetaStock} + pendiente = ${BO.n(disp)}, bajo el ${nombrePiso} (${BO.n(piso)}). Se sugiere pedir <b>${BO.n(it.sugerido)}</b> para llegar al objetivo.`;
      case 'transito': return `El ${etiquetaStock.toLowerCase()} está bajo el ${nombrePiso}, pero la OC pendiente (${BO.n(it.pendiente)}) lo cubre. Conviene revisar la fecha de llegada.`;
      case 'sobre': return `El ${etiquetaStock.toLowerCase()} (${BO.n(stock)}) está sobre el nivel esperado. No comprar.`;
      case 'sinmin': return `Este artículo no tiene ${nombrePiso} definido en el Excel, por eso no se calcula compra.`;
      default: return `${etiquetaStock} dentro del rango. No es necesario comprar.`;
    }
  }

  /* =================================================================
     8. LISTA DE COMPRA (pre-OC) Y EXPORTACIÓN
     ================================================================= */
  BO.lista = {
    obtener() {
      try { return JSON.parse(localStorage.getItem(CFG.claveLista) || '[]'); } catch (e) { return []; }
    },
    guardar(lista) {
      localStorage.setItem(CFG.claveLista, JSON.stringify(lista));
      BO.lista.pintarContador();
      if (document.getElementById('bo-panel-lista').classList.contains('abierto')) BO.abrirLista();
    },
    agregar(it, cantidad, silencioso) {
      const lista = BO.lista.obtener();
      const clave = it.modulo + '|' + it.codigo;
      const existe = lista.find(x => x.clave === clave);
      if (existe) {
        existe.cantidad = cantidad;
        Object.assign(existe, {
          minimo: it.minimo, consumo1: it.consumo1, consumo2: it.consumo2,
          consumo3: it.consumo3, alcance: it.alcance
        });
      } else lista.push({
        clave, modulo: it.modulo, codigo: it.codigo, descripcion: it.descripcion,
        proveedor: it.proveedor, cantidad, valor: it.valor || 0,
        minimo: it.minimo, consumo1: it.consumo1, consumo2: it.consumo2,
        consumo3: it.consumo3, alcance: it.alcance
      });
      BO.lista.guardar(lista);
      if (!silencioso) BO.aviso('Agregado a la lista: ' + it.descripcion, 'ok');
    },
    agregarVarios(items) {
      const lista = BO.lista.obtener();
      let n = 0;
      let clustersPendientes = 0;
      items.forEach(it => {
        if (it.esCluster) {
          if (it.sugerido) clustersPendientes++;
          return;
        }
        if (!it.sugerido) return;
        const clave = it.modulo + '|' + it.codigo;
        const existe = lista.find(x => x.clave === clave);
        if (existe) {
          existe.cantidad = it.sugerido;
          Object.assign(existe, {
            minimo: it.minimo, consumo1: it.consumo1, consumo2: it.consumo2,
            consumo3: it.consumo3, alcance: it.alcance
          });
        } else lista.push({
          clave, modulo: it.modulo, codigo: it.codigo, descripcion: it.descripcion,
          proveedor: it.proveedor, cantidad: it.sugerido, valor: it.valor || 0,
          minimo: it.minimo, consumo1: it.consumo1, consumo2: it.consumo2,
          consumo3: it.consumo3, alcance: it.alcance
        });
        n++;
      });
      BO.lista.guardar(lista);
      const notaClusters = clustersPendientes
        ? ' Para agregar el sugerido de un cluster, abre su fila y elige el código de compra.'
        : '';
      BO.aviso(n
        ? n + ' artículos agregados a la lista de compra.' + notaClusters
        : clustersPendientes
          ? 'Los clusters requieren elegir el código al que se agregará el sugerido.'
          : 'No hay artículos con compra sugerida en la vista actual.',
      n ? 'ok' : 'alerta');
    },
    pintarContador() {
      const n = BO.lista.obtener().length;
      document.querySelectorAll('[data-contador-lista]').forEach(el => {
        el.textContent = n; el.classList.toggle('activo', n > 0);
      });
    }
  };

  /** Panel lateral con la lista de compra agrupada por proveedor */
  BO.abrirLista = function () {
    const lista = BO.lista.obtener();
    const grupos = {};
    lista.forEach(x => (grupos[x.proveedor] = grupos[x.proveedor] || []).push(x));
    const total = lista.reduce((s, x) => s + x.cantidad * (x.valor || 0), 0);

    const html = Object.keys(grupos).sort().map(p => {
      const sub = grupos[p].reduce((s, x) => s + x.cantidad * (x.valor || 0), 0);
      return `<section class="grupo-prov">
        <header><h4>${BO.icono('camion')} ${BO.esc(p)}</h4>
          <span>${grupos[p].length} ítem(s) · ${BO.clp(sub)}</span>
          <button class="btn chico" data-copiar="${BO.esc(p)}" data-tip="Copia el pedido de este proveedor para pegarlo en un correo">${BO.icono('copiar')} Copiar</button>
        </header>
        ${grupos[p].map(x => `
          <div class="item-lista">
            <div><b>${BO.esc(x.descripcion)}</b><small>${BO.esc(CFG.modulos[x.modulo].titulo)} · ${BO.esc(x.codigo)}${x.valor ? ' · ' + BO.clp(x.valor) + ' c/u' : ''}</small></div>
            <input type="number" min="0" step="1" value="${x.cantidad}" data-cant="${BO.esc(x.clave)}" aria-label="Cantidad">
            <button class="btn-icono" data-quitar="${BO.esc(x.clave)}" aria-label="Quitar">${BO.icono('basura')}</button>
          </div>`).join('')}
      </section>`;
    }).join('');

    const panel = document.getElementById('bo-panel-lista');
    panel.innerHTML = `
      <header class="panel-cab" style="--c:var(--bo-primario)">
        <div><small>Pre-orden de compra</small><h3>Lista de compra</h3>
        <p>${lista.length} artículo(s) · ${Object.keys(grupos).length} proveedor(es) · Total estimado <b>${BO.clp(total)}</b></p></div>
        <button class="btn-icono" data-accion="cerrar-panel" aria-label="Cerrar">${BO.icono('cerrar')}</button>
      </header>
      <div class="panel-cuerpo">
        ${lista.length ? html : '<div class="vacio">' + BO.icono('carro') + '<p>Tu lista está vacía.<br>Usa el botón <b>+</b> en la tabla o "Agregar sugeridos".</p></div>'}
      </div>
      <footer class="panel-pie">
        <button class="btn" id="bo-lista-vaciar" ${lista.length ? '' : 'disabled'}>${BO.icono('basura')} Vaciar</button>
        <button class="btn primario" id="bo-lista-exportar" ${lista.length ? '' : 'disabled'}>${BO.icono('bajar')} Exportar a Excel</button>
      </footer>`;

    panel.querySelectorAll('[data-cant]').forEach(inp => inp.addEventListener('change', () => {
      const l = BO.lista.obtener();
      const x = l.find(y => y.clave === inp.dataset.cant);
      if (x) { x.cantidad = Math.max(0, BO.num(inp.value) || 0); BO.lista.guardar(l); }
    }));
    panel.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
      BO.lista.guardar(BO.lista.obtener().filter(y => y.clave !== b.dataset.quitar));
    }));
    panel.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', () => {
      const items = BO.lista.obtener().filter(y => y.proveedor === b.dataset.copiar);
      const texto = 'Proveedor: ' + b.dataset.copiar + '\n\n' +
        'Código\tDescripción\tCantidad\n' +
        items.map(y => y.codigo + '\t' + y.descripcion + '\t' + y.cantidad).join('\n');
      BO.copiar(texto);
    }));
    document.getElementById('bo-lista-vaciar').addEventListener('click', () => {
      if (confirm('¿Vaciar toda la lista de compra?')) BO.lista.guardar([]);
    });
    document.getElementById('bo-lista-exportar').addEventListener('click', BO.exportarLista);
    BO.abrirPanel('bo-panel-lista');
  };

  BO.copiar = function (texto) {
    const ok = () => BO.aviso('Copiado. Pégalo en tu correo con Ctrl + V.', 'ok');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(ok).catch(() => copiarRespaldo(texto, ok));
    } else copiarRespaldo(texto, ok);
  };
  function copiarRespaldo(texto, ok) {
    const t = document.createElement('textarea');
    t.value = texto; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); ok(); } catch (e) { BO.aviso('No se pudo copiar.', 'alerta'); }
    t.remove();
  }

  /** Exporta la lista de compra: hoja resumen + una hoja por proveedor */
  BO.exportarLista = function () {
    const lista = BO.lista.obtener();
    if (!lista.length) return;
    const datos = BO.obtenerDatos();
    const fila = x => {
      const actual = datos && datos.modulos[x.modulo] &&
        datos.modulos[x.modulo].items.find(it => it.codigo === x.codigo);
      const dato = campo => x[campo] ?? (actual && actual[campo]) ?? '';
      return {
        'Módulo': CFG.modulos[x.modulo].titulo, 'Proveedor': x.proveedor, 'Código': x.codigo,
        'Descripción': x.descripcion, 'Cantidad': x.cantidad, 'Valor unitario': x.valor || 0,
        'Inventario mínimo': dato('minimo'), 'Último mes': dato('consumo1'),
        '3 meses': dato('consumo2'), '6 meses': dato('consumo3'),
        'Alcance (días)': dato('alcance'), 'Total': x.cantidad * (x.valor || 0)
      };
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lista.map(fila)), 'Resumen');
    const usados = new Set(['Resumen']);
    [...new Set(lista.map(x => x.proveedor))].forEach(p => {
      let nombre = p.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Proveedor';
      let n = 2; const base = nombre;
      while (usados.has(nombre)) nombre = base.slice(0, 25) + ' ' + n++;
      usados.add(nombre);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lista.filter(x => x.proveedor === p).map(fila)), nombre);
    });
    XLSX.writeFile(wb, 'Lista_compra_BO_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  };

  /** Exporta cualquier tabla (arreglo de objetos) a Excel */
  BO.exportarExcel = function (filas, nombreHoja, nombreArchivo) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombreHoja.slice(0, 31));
    XLSX.writeFile(wb, nombreArchivo);
  };

  /* =================================================================
     INICIO COMÚN DE TODAS LAS PÁGINAS
     ================================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    montarElementosComunes();
    activarCarga();
    BO.pintarIconos();
    BO.pintarInfoArchivo();
    if (avisoDatosHomologosAntiguosPendiente) {
      avisoDatosHomologosAntiguosPendiente = false;
      BO.aviso('Vuelve a cargar el Excel para aplicar el cálculo de stock de artículos homólogos.', 'alerta');
    }
    BO.lista.pintarContador();
  });

})(window.BO);
