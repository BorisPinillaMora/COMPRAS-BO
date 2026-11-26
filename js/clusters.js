/* Motor compartido de clusters para todos los módulos. */
(function () {
  'use strict';
  const CFG = window.BO_CONFIG;
  const CLAVE = CFG.claveClusters;
  const codigoKey = (modulo, codigo) => modulo + '|' + BO.normalizar(codigo);
  const numerico = valor => typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
  const unicos = valores => [...new Set(valores.map(v => String(v || '').trim()).filter(Boolean))];

  function obtener() {
    try {
      const texto = localStorage.getItem(CLAVE);
      if (!texto) return [];
      const clusters = JSON.parse(texto);
      if (!Array.isArray(clusters)) throw new Error('El registro de clusters no es una lista.');
      clusters.forEach(cluster => {
        if (!cluster || !cluster.id || !String(cluster.nombre || '').trim() ||
            !Number.isFinite(Number(cluster.minimo)) || Number(cluster.minimo) <= 0 ||
            !Array.isArray(cluster.miembros) || cluster.miembros.length < 2 ||
            cluster.miembros.some(ref => !ref || !CFG.modulos[ref.modulo] || !String(ref.codigo || '').trim())) {
          throw new Error('Hay un cluster guardado con datos incompletos.');
        }
      });
      return clusters;
    } catch (error) {
      console.error('No se pudieron leer los clusters guardados:', error);
      BO.aviso('No se pudieron leer los clusters guardados. Revisa los datos del navegador.', 'alerta');
      return [];
    }
  }

  function guardar(clusters) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(clusters));
    } catch (error) {
      console.error('No se pudieron guardar los clusters:', error);
      BO.aviso('No se pudieron guardar los clusters en este navegador.', 'alerta');
      return false;
    }
    window.dispatchEvent(new CustomEvent('bo:clusters'));
    return true;
  }

  function itemsDe(datos, modulo, codigo) {
    const registros = datos.modulos[modulo] && datos.modulos[modulo].items || [];
    const clave = BO.normalizar(codigo);
    return registros.filter(it => BO.normalizar(it.codigo) === clave);
  }

  function crearFila(cluster, miembros, miembrosLocales, modulo) {
    const stock = miembros.reduce((s, it) => s + numerico(it.stock), 0);
    const pendiente = miembros.reduce((s, it) => s + numerico(it.pendiente), 0);
    const valorInventario = miembros.reduce((s, it) => s + numerico(it.stock) * numerico(it.valor), 0);
    const precios = miembros.map(it => numerico(it.valor)).filter(v => v > 0);
    const valor = stock > 0 && valorInventario > 0
      ? valorInventario / stock
      : precios.length ? precios.reduce((s, v) => s + v, 0) / precios.length : 0;
    const calculos = ['consumo1', 'consumo2', 'consumo3', 'usoSemanal'];
    const consumo = Object.fromEntries(calculos.map(c => [
      c, miembros.reduce((s, it) => s + numerico(it[c]), 0)
    ]));
    const conAlcance = miembros.filter(it => typeof it.alcance === 'number' && Number.isFinite(it.alcance));
    const alcancePeso = conAlcance.reduce((s, it) => s + Math.max(numerico(it.stock), 0), 0);
    const alcance = conAlcance.length
      ? alcancePeso
        ? conAlcance.reduce((s, it) => s + it.alcance * Math.max(numerico(it.stock), 0), 0) / alcancePeso
        : conAlcance.reduce((s, it) => s + it.alcance, 0) / conAlcance.length
      : null;
    const codigos = unicos(cluster.miembros.map(m => m.codigo));
    const modulos = unicos(miembrosLocales.map(it => CFG.modulos[it.modulo].titulo));
    const categorias = unicos(miembrosLocales.map(it => it.categoria));
    const proveedores = unicos(miembrosLocales.map(it => it.proveedor));
    const estados = unicos(miembrosLocales.map(it => it.estado));
    const marcas = unicos(miembrosLocales.map(it => it.marca));
    const tallas = unicos(miembrosLocales.map(it => it.talla));
    const oc = unicos(miembros.map(it => it.oc)).join(' / ');
    const minimo = numerico(cluster.minimo);
    const fila = {
      id: 'cluster-' + cluster.id,
      modulo,
      fila: 0,
      codigo: cluster.miembros.map(m => CFG.modulos[m.modulo].titulo + ': ' + m.codigo).join(' · '),
      codigos,
      descripcion: cluster.nombre,
      categoria: categorias.join(', ') || 'Cluster',
      talla: tallas.length === 1 ? tallas[0] : 'Total',
      proveedor: proveedores.length === 1 ? proveedores[0] : proveedores.length ? 'Varios proveedores' : '',
      estado: estados.join(', '),
      marca: marcas.length === 1 ? marcas[0] : '',
      stock,
      minimo,
      maximo: null,
      pendiente,
      oc,
      valor,
      valorStock: valorInventario,
      alcance,
      clusterId: cluster.id,
      clusterNombre: cluster.nombre,
      clusterMiembros: miembros,
      clusterMiembrosLocales: miembrosLocales,
      clusterProveedores: proveedores,
      clusterCategorias: categorias,
      clusterEstados: estados,
      clusterMarcas: marcas,
      clusterModulos: modulos,
      esCluster: true,
      oculta: miembrosLocales.length > 0 && miembrosLocales.every(it => it.oculta),
      orig: [],
      ...consumo
    };
    const disponible = stock + pendiente;
    fila.decision = disponible < minimo ? (stock <= 0 ? 'stock0' : 'comprar')
      : stock < minimo ? 'transito' : 'ok';
    fila.sugerido = disponible < minimo ? Math.ceil(minimo - disponible) : 0;
    fila.valorSugerido = fila.sugerido * valor;
    fila.cobertura = minimo > 0 ? stock / minimo : null;
    fila.valorStock = valorInventario;
    return fila;
  }

  function aplicarModulo(datos, modulo, clusters = obtener()) {
    const originales = datos.modulos[modulo] && datos.modulos[modulo].items || [];
    const asignados = new Map();
    const filasCluster = new Map();

    clusters.forEach(cluster => {
      if (!cluster || !cluster.id || !Array.isArray(cluster.miembros)) return;
      const miembros = [];
      const vistas = new Set();
      cluster.miembros.forEach(ref => {
        itemsDe(datos, ref.modulo, ref.codigo).forEach(it => {
          if (!vistas.has(it.id)) { vistas.add(it.id); miembros.push(it); }
        });
      });
      const locales = miembros.filter(it => it.modulo === modulo);
      if (!locales.length) return;
      filasCluster.set(cluster.id, crearFila(cluster, miembros, locales, modulo));
      locales.forEach(it => {
        const ids = asignados.get(it.id) || [];
        if (!ids.includes(cluster.id)) ids.push(cluster.id);
        asignados.set(it.id, ids);
      });
    });

    const salida = [];
    const agregadosAgregados = new Set();
    originales.forEach(it => {
      const clusterIds = asignados.get(it.id);
      if (!clusterIds) { salida.push(it); return; }
      clusterIds.forEach(clusterId => {
        if (agregadosAgregados.has(clusterId) || !filasCluster.has(clusterId)) return;
        salida.push(filasCluster.get(clusterId));
        agregadosAgregados.add(clusterId);
      });
    });
    return salida;
  }

  function aplicar(datos) {
    const clusters = obtener();
    const modulos = Object.fromEntries(Object.entries(datos.modulos).map(([id, modulo]) => [
      id, Object.assign({}, modulo, { items: aplicarModulo(datos, id, clusters) })
    ]));
    return Object.assign({}, datos, { modulos });
  }

  function abrirDetalle(fila) {
    const miembros = fila.clusterMiembros || [];
    if (!miembros.length) {
      BO.aviso('Este cluster no tiene códigos disponibles en el Excel cargado.', 'alerta');
      return;
    }
    const opciones = miembros.map((it, i) =>
      `<option value="${i}">${BO.esc(CFG.modulos[it.modulo].titulo)} · ${BO.esc(it.codigo)} · ${BO.esc(it.descripcion)}</option>`
    ).join('');
    const panel = document.getElementById('bo-panel-detalle');
    panel.innerHTML = `
      <header class="panel-cab" style="--c:${BO.DECISIONES[fila.decision].color}">
        <div><small>Cluster consolidado · ${miembros.length} artículo(s)</small>
        <h3>${BO.esc(fila.clusterNombre)}</h3>
        <p>Stock total <b>${BO.n(fila.stock)}</b> · Mínimo común <b>${BO.n(fila.minimo)}</b> · ${BO.badge(fila.decision)}</p></div>
        <button class="btn-icono" data-accion="cerrar-panel" aria-label="Cerrar">${BO.icono('cerrar')}</button>
      </header>
      <div class="panel-cuerpo">
        <div class="minis">
          <div class="mini">${BO.icono('caja')}<small>Stock consolidado</small><b>${BO.n(fila.stock)}</b></div>
          <div class="mini">${BO.icono('menos')}<small>Mínimo del cluster</small><b>${BO.n(fila.minimo)}</b></div>
          <div class="mini">${BO.icono('camion')}<small>Pendiente</small><b>${BO.n(fila.pendiente)}</b></div>
          <div class="mini">${BO.icono('carro')}<small>Sugerido</small><b>${BO.n(fila.sugerido)}</b></div>
        </div>
        <h4>${BO.icono('capas')} Códigos del cluster</h4>
        <ul class="cluster-miembros">${miembros.map(it =>
          `<li><b>${BO.esc(CFG.modulos[it.modulo].titulo)} · ${BO.esc(it.codigo)}</b><span>${BO.esc(it.descripcion)} · Stock ${BO.n(it.stock)}</span></li>`
        ).join('')}</ul>
        <div class="agregar-lista cluster-agregar">
          <label>Agregar sugerido al código
            <select id="bo-cluster-destino">${opciones}</select>
          </label>
          <label>Cantidad a pedir <input type="number" min="0" step="1" id="bo-cluster-cantidad" value="${fila.sugerido || ''}"></label>
          <button class="btn primario" id="bo-btn-agregar-cluster">${BO.icono('carro')} Agregar a la lista</button>
        </div>
      </div>`;
    document.getElementById('bo-btn-agregar-cluster').addEventListener('click', () => {
      const cantidad = BO.num(document.getElementById('bo-cluster-cantidad').value) || 0;
      if (cantidad <= 0) { BO.aviso('Ingresa una cantidad mayor a 0.', 'alerta'); return; }
      const item = miembros[Number(document.getElementById('bo-cluster-destino').value)];
      if (!item) { BO.aviso('Selecciona un código válido del cluster.', 'alerta'); return; }
      BO.lista.agregar(item, cantidad);
    });
    BO.abrirPanel('bo-panel-detalle');
  }

  BO.clusters = { obtener, guardar, aplicar, aplicarModulo, abrirDetalle, codigoKey };
})();
