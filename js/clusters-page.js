(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  let datos, catalogo = [], clusters = [], seleccionados = new Set(), editando = '';
  const porClave = new Map();

  document.addEventListener('DOMContentLoaded', iniciar);

  function iniciar() {
    clusters = BO.clusters.obtener();
    actualizarDatos();
    document.addEventListener('bo:datos', actualizarDatos);

    $('#cluster-form').addEventListener('submit', guardarCluster);
    $('#cluster-cancelar').addEventListener('click', cancelarEdicion);
    $('#cluster-buscar').addEventListener('input', dibujarCatalogo);
    $('#cluster-catalogo').addEventListener('click', e => {
      const boton = e.target.closest('[data-cluster-member]');
      if (!boton || boton.disabled) return;
      const key = boton.dataset.clusterMember;
      if (seleccionados.has(key)) seleccionados.delete(key);
      else seleccionados.add(key);
      actualizarSeleccion();
    });
    $('#cluster-lista').addEventListener('click', e => {
      const editar = e.target.closest('[data-editar-cluster]');
      const borrar = e.target.closest('[data-borrar-cluster]');
      if (editar) editarCluster(editar.dataset.editarCluster);
      if (borrar) borrarCluster(borrar.dataset.borrarCluster);
    });
    window.addEventListener('storage', e => {
      if (e.key !== BO_CONFIG.claveClusters) return;
      clusters = BO.clusters.obtener();
      dibujarCatalogo();
      dibujarClusters();
    });

    dibujarCatalogo();
    dibujarClusters();
    actualizarSeleccion();
  }

  function actualizarDatos() {
    datos = BO.obtenerDatos();
    if (!datos) {
      catalogo = [];
      porClave.clear();
      $('#cluster-catalogo').innerHTML = '<tr><td colspan="5" class="vacio-celda">Carga primero el Excel desde el menú Datos.</td></tr>';
      $('#cluster-form').querySelectorAll('input, button[type="submit"]').forEach(el => { el.disabled = true; });
      mostrarMensaje('No hay datos cargados para seleccionar códigos.', true);
      dibujarClusters();
      return;
    }
    $('#cluster-form').querySelectorAll('input, button[type="submit"]').forEach(el => { el.disabled = false; });
    mostrarMensaje('');
    construirCatalogo();
    dibujarCatalogo();
    dibujarClusters();
  }

  function construirCatalogo() {
    const registros = new Map();
    porClave.clear();
    Object.entries(datos.modulos || {}).forEach(([modulo, dataModulo]) => {
      (dataModulo.items || []).forEach(it => {
        if (!it.codigo) return;
        const key = BO.clusters.codigoKey(modulo, it.codigo);
        const actual = registros.get(key) || {
          key, modulo, codigo: it.codigo, items: [], descripciones: [], stock: 0, minimo: 0
        };
        actual.items.push(it);
        if (it.descripcion && !actual.descripciones.includes(it.descripcion)) actual.descripciones.push(it.descripcion);
        actual.stock += Number(it.stock) || 0;
        actual.minimo += Number(it.minimo) || 0;
        registros.set(key, actual);
        porClave.set(key, { modulo, codigo: it.codigo });
      });
    });
    catalogo = [...registros.values()].sort((a, b) =>
      BO_CONFIG.modulos[a.modulo].titulo.localeCompare(BO_CONFIG.modulos[b.modulo].titulo, 'es') ||
      a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }

  function dibujarCatalogo() {
    const consulta = BO.normalizar($('#cluster-buscar').value);
    const filas = catalogo.filter(item => {
      const texto = BO.normalizar([
        BO_CONFIG.modulos[item.modulo].titulo, item.codigo, item.descripciones.join(' ')
      ].join(' '));
      return !consulta || consulta.split(' ').every(parte => texto.includes(parte));
    });
    if (!filas.length) {
      $('#cluster-catalogo').innerHTML = '<tr><td colspan="5" class="vacio-celda">No hay códigos que coincidan con la búsqueda.</td></tr>';
      return;
    }

    $('#cluster-catalogo').innerHTML = filas.map(item => {
      const compartidoCon = clusters.filter(cluster =>
        cluster.miembros.some(ref => BO.clusters.codigoKey(ref.modulo, ref.codigo) === item.key));
      const activo = seleccionados.has(item.key);
      return `<tr>
        <td>${BO.esc(BO_CONFIG.modulos[item.modulo].titulo)}</td>
        <td><button type="button" class="cluster-codigo ${activo ? 'activo' : ''}" data-cluster-member="${BO.esc(item.key)}"
          aria-pressed="${activo}"${compartidoCon.length ? ` title="También pertenece a: ${BO.esc(compartidoCon.map(cluster => cluster.nombre).join(', '))}"` : ''}>${BO.esc(item.codigo)}</button></td>
        <td class="desc">${BO.esc(item.descripciones.join(' / '))}</td>
        <td class="num">${BO.n(item.stock)}</td>
        <td class="num">${BO.n(item.minimo)}</td>
      </tr>`;
    }).join('');
  }

  function dibujarClusters() {
    $('#cluster-lista').innerHTML = clusters.length ? clusters.map(cluster => {
      const miembros = cluster.miembros.map(ref => {
        const key = BO.clusters.codigoKey(ref.modulo, ref.codigo);
        const item = porClave.get(key);
        return `<li>${BO.esc(BO_CONFIG.modulos[ref.modulo]?.titulo || ref.modulo)} · ${BO.esc(ref.codigo)}${item ? '' : ' <small>(no está en el Excel actual)</small>'}</li>`;
      }).join('');
      return `<article class="cluster-guardado">
        <div><h4>${BO.esc(cluster.nombre)}</h4><p>Mínimo consolidado: <b>${BO.n(cluster.minimo)}</b> · ${cluster.miembros.length} código(s)</p>
        <ul>${miembros}</ul></div>
        <div class="cluster-guardado-acciones">
          <button type="button" class="btn claro chico" data-editar-cluster="${BO.esc(cluster.id)}">Editar</button>
          <button type="button" class="btn claro chico" data-borrar-cluster="${BO.esc(cluster.id)}">Eliminar</button>
        </div>
      </article>`;
    }).join('') : '<p class="vacio-celda">Todavía no hay clusters creados.</p>';
  }

  function actualizarSeleccion() {
    const cantidad = seleccionados.size;
    $('#cluster-cantidad').textContent = cantidad + (cantidad === 1 ? ' código seleccionado' : ' códigos seleccionados');
    dibujarCatalogo();
  }

  function guardarCluster(e) {
    e.preventDefault();
    const nombre = $('#cluster-nombre').value.trim();
    const minimo = Number($('#cluster-minimo').value);
    if (!nombre) return mostrarMensaje('Escribe un nombre para el cluster.', true);
    if (!Number.isFinite(minimo) || minimo <= 0) return mostrarMensaje('El mínimo consolidado debe ser mayor que cero.', true);
    if (seleccionados.size < 2) return mostrarMensaje('Selecciona al menos dos códigos para crear un cluster.', true);

    const restantes = clusters.filter(cluster => cluster.id !== editando);
    const nombreExiste = restantes.some(cluster => BO.normalizar(cluster.nombre) === BO.normalizar(nombre));
    if (nombreExiste) return mostrarMensaje('Ya existe un cluster con ese nombre.', true);

    const miembros = [...seleccionados].map(key => porClave.get(key)).filter(Boolean);
    if (miembros.length !== seleccionados.size) return mostrarMensaje('No se pudieron resolver todos los códigos seleccionados. Actualiza los datos e inténtalo nuevamente.', true);
    const id = editando || (window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const cluster = { id, nombre, minimo, miembros };
    const nuevos = [...restantes, cluster];
    if (!BO.clusters.guardar(nuevos)) return;
    clusters = nuevos;
    cancelarEdicion();
    dibujarClusters();
    mostrarMensaje('Cluster guardado y disponible en todos los módulos.', false);
  }

  function editarCluster(id) {
    const cluster = clusters.find(item => item.id === id);
    if (!cluster) return;
    editando = id;
    seleccionados = new Set(cluster.miembros.map(ref => BO.clusters.codigoKey(ref.modulo, ref.codigo)));
    cluster.miembros.forEach(ref => {
      const key = BO.clusters.codigoKey(ref.modulo, ref.codigo);
      porClave.set(key, { modulo: ref.modulo, codigo: ref.codigo });
    });
    $('#cluster-nombre').value = cluster.nombre;
    $('#cluster-minimo').value = cluster.minimo;
    $('#cluster-form-titulo').textContent = 'Editar cluster';
    $('#cluster-guardar').textContent = 'Guardar cambios';
    $('#cluster-cancelar').hidden = false;
    mostrarMensaje('');
    actualizarSeleccion();
    $('#cluster-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function borrarCluster(id) {
    const cluster = clusters.find(item => item.id === id);
    if (!cluster || !confirm('¿Eliminar el cluster "' + cluster.nombre + '"? Los artículos volverán a mostrarse por separado.')) return;
    const nuevos = clusters.filter(item => item.id !== id);
    if (!BO.clusters.guardar(nuevos)) return;
    clusters = nuevos;
    if (editando === id) cancelarEdicion();
    dibujarClusters();
    dibujarCatalogo();
  }

  function cancelarEdicion() {
    editando = '';
    seleccionados.clear();
    $('#cluster-form').reset();
    $('#cluster-form-titulo').textContent = 'Nuevo cluster';
    $('#cluster-guardar').textContent = 'Crear cluster';
    $('#cluster-cancelar').hidden = true;
    mostrarMensaje('');
    actualizarSeleccion();
  }

  function mostrarMensaje(texto, error) {
    const mensaje = $('#cluster-mensaje');
    mensaje.textContent = texto;
    mensaje.classList.toggle('error', !!error);
    mensaje.classList.toggle('ok', !!texto && !error);
  }
})();
