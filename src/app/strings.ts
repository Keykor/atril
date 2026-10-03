// Todos los textos de la interfaz viven acá, listos para traducir.
export const t = {
  appName: 'Atril',
  close: 'Cerrar',
  cancel: 'Cancelar',
  save: 'Guardar',
  delete: 'Eliminar',
  add: 'Agregar',
  done: 'Listo',
  nav: { sections: 'Secciones', library: 'Biblioteca', lists: 'Listas', settings: 'Ajustes' },
  library: {
    title: 'Biblioteca',
    search: 'Buscar',
    searchPlaceholder: 'Buscar título o compositor',
    sortRecent: 'Recientes',
    sortAz: 'A-Z',
    sort: 'Orden',
    import: 'Importar PDF',
    importing: (done: number, total: number) => `Importando ${done} de ${total}…`,
    imported: (added: number, dup: number, relinked: number, errors: number) =>
      [
        added && `${added} ${added === 1 ? 'importada' : 'importadas'}`,
        relinked && `${relinked} ${relinked === 1 ? 'reenganchada' : 'reenganchadas'}`,
        dup && `${dup} ya ${dup === 1 ? 'estaba' : 'estaban'}`,
        errors && `${errors} con error`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Nada para importar',
    scores: 'Partituras',
    empty: 'Todavía no hay partituras. Importá tus PDFs para empezar.',
    noResults: 'Ninguna partitura coincide con la búsqueda.',
    missingPdf: 'Falta el PDF',
    edit: (title: string) => `Editar ${title}`,
  },
  tags: {
    title: 'Etiquetas',
    all: 'Todas',
    new: 'Nueva etiqueta',
    namePlaceholder: 'Nombre de la etiqueta',
    delete: (name: string) => `Eliminar etiqueta ${name}`,
    confirmDelete: (name: string) =>
      `¿Eliminar la etiqueta "${name}"? Las partituras no se borran.`,
  },
  meta: {
    title: 'Datos de la partitura',
    name: 'Título',
    composer: 'Compositor',
    key: 'Tonalidad',
    keyPlaceholder: 'Fa M',
    bpm: 'BPM',
    timeSignature: 'Compás',
    startNotes: 'Notas de inicio',
    startNotesHint: 'Por voz (S: Fa4, A: Do4, T: La3, B: Fa3) o como acorde (Fa3 La3 Do4)',
    tags: 'Etiquetas',
    delete: 'Eliminar partitura',
    confirmDelete: (title: string) =>
      `¿Eliminar "${title}"? Se borran también sus anotaciones. No se puede deshacer.`,
  },
  settings: {
    title: 'Ajustes',
    penOnly: 'Solo el lápiz dibuja',
    penOnlyHint: 'El dedo sigue pasando páginas mientras anotás',
    version: (v: string) => `Atril ${v}`,
  },
};
