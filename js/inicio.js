/* =====================================================================
   INICIO.JS  |  Página principal (index.html)
   ---------------------------------------------------------------------
   - Resumen de cada módulo (tarjetas con enlace)
   - Ranking de urgencias de las 4 pestañas juntas
   - Revisión de columnas (para comprobar que el Excel se leyó bien)
   ===================================================================== */

(function () {
  'use strict';
  const CFG = window.BO_CONFIG;
  const $ = sel => document.querySelector(sel);
  let todos = [];

  document.addEventListener('DOMContentLoaded', () => {
    const videoPortada = document.querySelector('.hero-inicio-video');
    if (videoPortada && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      videoPortada.play().catch(error => console.warn('No se pudo reproducir el video de portada:', error));
    }
    $('#btn-borrar').addEventListener('click', () => {
      if (!confirm('¿Borrar los datos guardados en este navegador? (El Excel no se modifica)')) return;
      BO.borrarDatos(); BO.pintarInfoArchivo(); dibujar();
    });
    $('#urgencias').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const it = todos.find(x => x.id === tr.dataset.id);
      if (!it) return;
      if (it.esCluster) { BO.clusters.abrirDetalle(it); return; }
      if (e.target.closest('[data-agregar]')) { BO.lista.agregar(it, it.sugerido || 1); return; }
      BO.abrirDetalle(it);
    });
    $('#btn-sugeridos-todos').addEventListener('click', () =>
      BO.lista.agregarVarios(todos.filter(i => i.decision === 'stock0' || i.decision === 'comprar')));
    const modalCarga = $('#modal-carga-excel');
    $('#btn-abrir-modal-carga').addEventListener('click', () => modalCarga.showModal());
    $('#btn-cerrar-modal-carga').addEventListener('click', () => modalCarga.close());
    modalCarga.addEventListener('click', e => {
      if (e.target === modalCarga) modalCarga.close();
    });
    $('#btn-toggle-prioridades').addEventListener('click', e => {
      const boton = e.currentTarget;
      const expandido = boton.getAttribute('aria-expanded') !== 'true';
      const panel = $('#panel-prioridades');
      boton.setAttribute('aria-expanded', String(expandido));
      boton.setAttribute('aria-label', `${expandido ? 'Contraer' : 'Expandir'} prioridades de compra`);
      panel.classList.toggle('cerrado', !expandido);
      panel.inert = !expandido;
    });
    dibujar();
  });
  document.addEventListener('bo:datos', () => {
    const modalCarga = $('#modal-carga-excel');
    if (modalCarga.open) modalCarga.close();
    dibujar();
  });
  window.addEventListener('storage', e => {
    if (e.key === CFG.claveClusters) dibujar();
  });
  window.addEventListener('pageshow', e => { if (e.persisted) dibujar(); });

  function dibujar() {
    const d = BO.obtenerDatos();
    const hay = !!d;
    $('#resumen').hidden = !hay;
    if (!hay) return;

    const vista = BO.clusters.aplicar(d);
    const vistos = new Set();
    todos = Object.values(vista.modulos).flatMap(m => m.items || []).filter(it => {
      if (!it.esCluster) return true;
      if (vistos.has(it.clusterId)) return false;
      vistos.add(it.clusterId);
      return true;
    });
    dibujarTarjetas(vista);
    dibujarUrgencias();
    dibujarColumnas(d);
  }

  /* ------------------ Tarjetas de cada módulo ------------------ */
  function dibujarTarjetas(d) {
    const tarjetas = Object.entries(CFG.modulos).map(([id, cfg]) => {
      const m = d.modulos[id];
      if (!m || !m.ok) {
        return `<a class="tarjeta-modulo error" href="${cfg.pagina}">
          <div class="tm-ico">${BO.icono(cfg.icono)}</div>
          <h3>${BO.esc(cfg.titulo)}</h3><p>${BO.esc(m ? m.error : 'Sin datos')}</p></a>`;
      }
      const c = k => m.items.filter(i => i.decision === k).length;
      const valor = m.items.reduce((s, i) => s + (i.valorSugerido || 0), 0);
      const unidades = m.items.reduce((s, i) => s + (i.sugerido || 0), 0);
      const total = m.items.length || 1;
      const barra = BO.ORDEN_DECISION.map(k => {
        const n = c(k);
        return n ? `<i style="width:${n / total * 100}%;background:${BO.DECISIONES[k].color}" data-tip="${BO.DECISIONES[k].txt}: ${n}"></i>` : '';
      }).join('');
      return `
        <a class="tarjeta-modulo" href="${cfg.pagina}">
          <div class="tm-cab">
            <div class="tm-ico">${BO.icono(cfg.icono)}</div>
            <div><h3>${BO.esc(cfg.titulo)}</h3><p>${BO.esc(cfg.subtitulo)}</p></div>
          </div>
          <div class="tm-numeros">
            <div><b>${BO.n(m.items.length)}</b><small>Artículos</small></div>
            <div style="--c:${BO.DECISIONES.stock0.color}"><b>${c('stock0')}</b><small>Stock 0</small></div>
            <div style="--c:${BO.DECISIONES.comprar.color}"><b>${c('comprar')}</b><small>Comprar</small></div>
            <div style="--c:${BO.DECISIONES.transito.color}"><b>${c('transito')}</b><small>En tránsito</small></div>
          </div>
          <div class="tm-barra">${barra}</div>
          <div class="tm-pie">
            <span>${valor ? 'Sugerido ' + BO.clpCorto(valor) : BO.n(unidades) + ' unidades sugeridas'}</span>
            <span class="tm-ir">Abrir ${BO.icono('arriba', 'girar')}</span>
          </div>
        </a>`;
    }).join('');
    const ocs = d.ocAbiertas;
    const itemsOC = ocs && ocs.ok ? ocs.items || [] : [];
    const proveedores = new Set(itemsOC.flatMap(it => (it.proveedores || []).map(p => p.clave))).size;
    const descripcion = !ocs
        ? 'Vuelve a cargar el Excel para leer la pestaña OC ABIERTAS.'
        : ocs.ok ? 'Revisa la antigüedad y el detalle por orden de compra.'
          : ocs.error;
    const tarjetaOC = `
        <a id="tarjeta-oc-abiertas" class="tarjeta-modulo${ocs && ocs.ok ? '' : ' error'}" href="oc-abiertas.html">
          <div class="tm-cab">
            <div class="tm-ico">${BO.icono('camion')}</div>
            <div><h3>OC ABIERTAS</h3><p>${BO.esc(descripcion)}</p></div>
          </div>
          <div class="tm-numeros">
            <div><b>${BO.n(itemsOC.length)}</b><small>OC abiertas</small></div>
            <div><b>${BO.n(proveedores)}</b><small>Proveedores</small></div>
          </div>
          <div class="tm-pie"><span>Seguimiento de órdenes</span><span class="tm-ir">Abrir ${BO.icono('arriba', 'girar')}</span></div>
        </a>`;
    $('#tarjetas-modulos').innerHTML = tarjetas + tarjetaOC;
  }

  /* ------------------ Urgencias de todas las hojas ------------------ */
  function dibujarUrgencias() {
    const urg = todos
      .filter(i => i.decision === 'stock0' || i.decision === 'comprar')
      .sort((a, b) => BO.ORDEN_DECISION.indexOf(a.decision) - BO.ORDEN_DECISION.indexOf(b.decision) ||
        (b.valorSugerido || 0) - (a.valorSugerido || 0) || (b.sugerido || 0) - (a.sugerido || 0))
      .slice(0, 25);

    $('#urgencias tbody').innerHTML = urg.length ? urg.map(it => `
      <tr data-id="${it.id}" class="${it.esCluster ? 'fila-cluster' : ''}" style="--c:${BO.DECISIONES[it.decision].color}">
        <td data-label="Módulo"><span class="etq-mod">${BO.esc(CFG.modulos[it.modulo].titulo)}</span></td>
        <td data-label="Código">${BO.esc(it.codigo)}</td>
        <td class="desc" data-label="Descripción"><b>${BO.esc(it.descripcion)}</b>${it.esCluster ? '<small>Cluster · ' + it.clusterMiembros.length + ' código(s)</small>' : ''}</td>
        <td data-label="Proveedor">${BO.esc(it.proveedor)}</td>
        <td class="num" data-label="Stock"${it.stockHomologado !== undefined ? ` data-tip="Stock propio: ${BO.n(it.stock)}. Stock homologado usado para la decisión: ${BO.n(it.stockHomologado)}."` : ''}>${BO.n(it.stock)}</td>
        <td class="num" data-label="Sugerido"><span class="sug si">${BO.n(it.sugerido)}</span></td>
        <td class="num" data-label="$ Sugerido">${it.valorSugerido ? BO.clp(it.valorSugerido) : '–'}</td>
        <td data-label="Decisión">${BO.badge(it.decision)}</td>
        <td class="accion" data-label="Acción"><button class="btn-mas" data-agregar data-tip="${it.esCluster ? 'Revisar el cluster y elegir el código para agregar el sugerido' : 'Agregar a la lista de compra'}">${BO.icono('mas')}</button></td>
      </tr>`).join('')
      : '<tr><td colspan="9" class="vacio-celda">Sin compras urgentes. ¡Todo en orden!</td></tr>';
  }

  /* ------------------ Revisión de columnas leídas ------------------ */
  function dibujarColumnas(d) {
    const NOMBRES = {
      categoria: 'Categoría', codigo: 'Código', descripcion: 'Descripción', valor: 'Valor unitario',
      stock: 'Stock', stockUnidad: 'Stock por color', minimo: 'Mínimo', maximo: 'Máximo',
      consumo1: 'Consumo 1', consumo2: 'Consumo 2', consumo3: 'Consumo 3', usoSemanal: 'Uso semanal',
      alcance: 'Alcance', decisionExcel: 'Decisión (Excel)', pendiente: 'Pendiente', oc: 'N° OC',
      proveedor: 'Proveedor', estado: 'Estado', faltante: 'Faltante', marca: 'Filtro SI/NO'
    };
    $('#revision-columnas').innerHTML = Object.entries(CFG.modulos).map(([id, cfg]) => {
      const m = d.modulos[id];
      if (!m || !m.ok) return `<div class="rev-mod"><h4>${BO.esc(cfg.titulo)}</h4><p class="error">${BO.esc(m ? m.error : '')}</p></div>`;
      return `<div class="rev-mod"><h4>${BO.esc(cfg.titulo)} <small>Hoja "${BO.esc(m.hoja)}" · encabezado en fila ${cfg.filaEncabezado}</small></h4>
        <table class="tabla-mini"><thead><tr><th>Dato del dashboard</th><th>Columna</th><th>Título en el Excel</th></tr></thead><tbody>
        ${Object.entries(m.mapa).map(([campo, x]) => `<tr><td>${NOMBRES[campo] || campo}</td><td><b>${x.letra}</b></td><td>${BO.esc(x.encabezado) || '<em>(sin título)</em>'}</td></tr>`).join('')}
        </tbody></table></div>`;
    }).join('');
  }
})();
