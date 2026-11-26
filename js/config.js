/* =====================================================================
   CONFIGURACIÓN DEL DASHBOARD DE COMPRAS | BO Packaging
   ---------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitas tocar si cambia tu Excel.

   - "hojas": nombres posibles de la pestaña en el Excel.
   - "filaEncabezado": fila donde están los títulos (como se ve en Excel).
   - "columnas": letra de la columna de Excel para cada dato.
       Si insertas o mueves una columna en el Excel, cambia aquí la letra.
   - "estadosTransito": textos de estado que activan "En tránsito" (opcional).
   - "tipo": forma de calcular la decisión de compra
       'minmax'  -> usa stock, mínimo, máximo y cantidad pendiente
       'ropa'    -> usa stock, máximo y despacho pendiente
       'zapatos' -> agrupa filas por talla (ej. GREEN MOSS + CAFÉ)
   ===================================================================== */

window.BO_CONFIG = {

  /* Nombre que se guarda en el navegador (no cambiar salvo que quieras "reiniciar") */
  claveDatos: 'boCompras.datos.v1',
  claveLista: 'boCompras.lista.v1',
  claveClusters: 'boCompras.clusters.v1',

  /* Filas por página en las tablas */
  filasPorPagina: 50,

  /* Rangos de cobertura (días) para el gráfico de alcance */
  tramosAlcance: [
    { hasta: 7,        etiqueta: '0 a 7 días' },
    { hasta: 15,       etiqueta: '8 a 15 días' },
    { hasta: 30,       etiqueta: '16 a 30 días' },
    { hasta: 60,       etiqueta: '31 a 60 días' },
    { hasta: Infinity, etiqueta: 'Más de 60 días' }
  ],

  /* Hoja de órdenes de compra pendientes (se usa para mostrar el detalle de OC) */
  hojaOC: {
    hojas: ['OC PENDIENTE', 'OC PENDIENTES'],
    filaEncabezado: 1,
    /* Se buscan por el nombre del título (no por letra) */
    titulos: {
      oc:          ['NUM_O.C.', 'NUM_OC', 'N° OC'],
      fecha:       ['FEC_O.C.', 'FECHA OC'],
      proveedor:   ['NOMBRE', 'PROVEEDOR'],
      codigo:      ['ARTICULO', 'ARTÍCULO'],
      descripcion: ['DESCRIPCION', 'DESCRIPCIÓN'],
      precio:      ['PRECIO'],
      moneda:      ['MONEDA'],
      recepcion:   ['FECHA RECEPCION BO'],
      solicitada:  ['CANTIDAD SOLICITADA'],
      pendiente:   ['CANTIDAD PENDIENTE'],
      eta:         ['ETA'],
      estatus:     ['ESTATUS']
    }
  },

  /* Órdenes abiertas agrupadas por número de OC */
  hojaOCAbiertas: {
    hojas: ['OC ABIERTAS'],
    columnas: {
      oc: 'B',
      fecha: 'C',
      rut: 'F',
      proveedor: 'G'
    }
  },

  /* ------------------------------------------------------------------ */
  /* MÓDULOS (uno por pestaña / página)                                  */
  /* ------------------------------------------------------------------ */
  modulos: {

    /* ============================ BMAT ============================== */
    bmat: {
      titulo: 'BMAT',
      subtitulo: 'Materias primas: sustratos, films y resinas',
      pagina: 'bmat.html',
      icono: 'capas',
      hojas: ['BMAT'],
      filaEncabezado: 3,
      tipo: 'minmax',
      columnaHomologos: 'H', /* Celdas combinadas de "Consolidado" delimitan los clusters */
      columnas: {
        categoria:   'B',
        codigo:      'C',
        descripcion: 'D',
        stock:       'G',
        minimo:      'I',
        maximo:      'J',
        consumo1:    'K',
        consumo2:    'L',
        consumo3:    'M',
        usoSemanal:  'N',
        alcance:     'O',
        pendiente:   'P',
        oc:          'Q',
        marca:       'S'   /* Columna OCULTAR: NO por defecto; checkbox para filtrar SI */
      },
      /* Columnas que se muestran en la tabla (en este orden) */
      tabla: ['codigo', 'descripcion', 'categoria', 'stock', 'minimo', 'maximo',
              'consumo1', 'consumo2', 'consumo3', 'alcance', 'pendiente', 'oc',
              'sugerido', 'decision'],
      excluirSinConsumo: true,
      factorSobrestock: 1   /* Sobrestock cuando stock > máximo × este factor */
    },

    /* ============================ PAÑOL ============================= */
    panol: {
      titulo: 'PAÑOL',
      subtitulo: 'Repuestos, insumos de mantención y bodega',
      pagina: 'panol.html',
      icono: 'llave',
      hojas: ['PAÑOL', 'PANOL'],
      filaEncabezado: 3,
      tipo: 'minmax',
      columnas: {
        categoria:   'A',
        codigo:      'B',
        descripcion: 'C',
        valor:       'D',
        stock:       'F',
        minimo:      'G',
        maximo:      'H',
        consumo1:    'I',
        consumo2:    'J',
        consumo3:    'K',
        alcance:     'L',
        usoSemanal:  'M',
        decisionExcel: 'N',
        pendiente:   'O',
        oc:          'P',
        proveedor:   'Q',
        estado:      'R'
      },
      estadosTransito: ['PENDIENTE DE RECEPCION', 'PENDIENTE DE REPCECION'],
      tabla: ['codigo', 'descripcion', 'categoria', 'proveedor', 'valor', 'stock',
              'minimo', 'maximo', 'consumo1', 'consumo2', 'consumo3', 'alcance',
              'pendiente', 'oc', 'sugerido', 'valorSugerido', 'decision'],
      excluirSinConsumo: true,
      factorSobrestock: 1
    },

    /* ======================== ROPA DE VERANO ======================== */
    ropa: {
      titulo: 'Ropa',
      subtitulo: 'Poleras, pantalones, polerones, cotonas y más',
      pagina: 'ropa.html',
      icono: 'polera',
      hojas: ['ROPA VERANO', 'ROPA DE VERANO'],
      filaEncabezado: 2,
      tipo: 'ropa',
      columnas: {
        codigo:      'B',
        descripcion: 'C',
        stock:       'D',
        maximo:      'E',
        valor:       'F',
        proveedor:   'G',
        faltante:    'H',
        pendiente:   'I',   /* DESPACHO */
        oc:          'J',
        temporada:   'K'    /* ESTADO: VERANO, INVIERNO o TRANSVERSAL */
      },
      tabla: ['codigo', 'descripcion', 'categoria', 'talla', 'proveedor', 'valor',
              'stock', 'maximo', 'pendiente', 'oc', 'sugerido', 'valorSugerido', 'decision'],
      factorSobrestock: 2   /* Sobrestock cuando stock > 2 × máximo */
    },

    /* =========================== ZAPATOS ============================ */
    zapatos: {
      titulo: 'Zapatos',
      subtitulo: 'Botines de seguridad, antiestáticos y administrativos',
      pagina: 'zapatos.html',
      icono: 'zapato',
      hojas: ['ZAPATOS'],
      filaEncabezado: 2,
      tipo: 'zapatos',
      columnas: {
        codigo:      'B',
        descripcion: 'C',
        minimo:      'D',
        stockUnidad: 'E',   /* Stock de cada color / variante */
        stock:       'F',   /* Stock total de la talla (celda combinada) */
        faltante:    'G',
        valor:       'H',
        proveedor:   'I',
        pendiente:   'J',
        oc:          'K',
        subcategoria: 'L'    /* STANDAR, ANTIESTATICO o ESPECIAL */
      },
      tabla: ['codigo', 'descripcion', 'categoria', 'talla', 'proveedor', 'valor',
              'stock', 'minimo', 'pendiente', 'oc', 'sugerido', 'valorSugerido', 'decision'],
      factorSobrestock: 2
    }
  }
};
