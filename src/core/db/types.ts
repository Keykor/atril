export type ID = string;

export interface PdfFile {
  id: ID;
  sha256: string;
  size: number;
  pageCount: number;
  missing?: boolean; // viene de un backup liviano: hay que reimportar el PDF
}
// Los bytes van en tablas aparte y como ArrayBuffer: WebKit falla al guardar Blobs en
// IndexedDB en algunos contextos, y así las consultas de metadatos no cargan los PDFs.
export interface PdfData {
  id: ID; // el mismo id que PdfFile
  data: ArrayBuffer;
}
export interface Thumbnail {
  scoreId: ID;
  data: ArrayBuffer; // JPEG
}
export interface Tag {
  id: ID;
  name: string;
  color: string;
}
export interface StartNotes {
  label?: string; // "S", "A", "T", "B" o vacío para un acorde único
  notes: string[]; // notación científica: "F4", "C#4"
}
export interface Crop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ReadingPrefs {
  mode: 'paged' | 'vertical' | 'two-up';
  fit: 'width' | 'page';
  pageTurn: 'slide' | 'instant';
  twoUpStep: 1 | 2;
  halfPage: boolean;
  theme: 'light' | 'sepia' | 'dark';
  tapZones: 'thirds' | 'halves';
}
export const defaultReading: ReadingPrefs = {
  mode: 'paged',
  fit: 'page',
  pageTurn: 'slide',
  twoUpStep: 2,
  halfPage: false,
  theme: 'light',
  tapZones: 'thirds',
};

export interface Score {
  id: ID;
  pdfId: ID;
  title: string;
  composer?: string;
  key?: string;
  tagIds: ID[];
  bpm?: number;
  timeSignature?: string;
  startNotes?: StartNotes[];
  reading?: Partial<ReadingPrefs>; // override del ajuste global
  crop?: Crop; // fracciones 0..1 de la página
  pageOrder?: number[]; // orden virtual: posiciones -> página real (base 0)
  autoscrollSpeed?: number; // px por segundo
  lastPage: number; // posición en el orden virtual
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface Stroke {
  id: ID;
  tool: 'pen' | 'highlighter';
  color: string;
  width: number; // fracción del ancho de página
  points: [x: number, y: number, pressure: number][]; // normalizados 0..1
}
export interface TextNote {
  id: ID;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number; // fracción del ancho de página
}
/** Símbolo musical pegado sobre la página (figura, silencio, dinámica...). */
export interface Stamp {
  id: ID;
  symbol: string; // nombre SMuFL del glifo: "noteQuarterUp", "dynamicMF"...
  x: number; // punto donde se pegó, 0..1 (la cabeza de la nota, o el centro del símbolo)
  y: number;
  size: number; // tamaño de la fuente como fracción del ancho de página (~ alto del pentagrama)
  color: string;
}
export interface PageAnnotations {
  id: string; // `${scoreId}:${page}`
  scoreId: ID;
  page: number; // página real del PDF, base 0
  strokes: Stroke[];
  texts: TextNote[];
  stamps?: Stamp[]; // opcional: las anotaciones de antes de 0.5.0 no lo tienen
  updatedAt: number;
}

export type SetListItem =
  { id: ID; type: 'score'; scoreId: ID; note?: string } | { id: ID; type: 'break'; label: string };
export interface SetList {
  id: ID;
  name: string;
  notes?: string;
  items: SetListItem[];
  createdAt: number;
  updatedAt: number;
}

export interface Bookmark {
  id: ID;
  scoreId: ID;
  page: number;
  x?: number; // 0..1 en la página real; ausente en marcadores viejos (solo de página)
  y: number;
  label: string;
}
export interface JumpLink {
  id: ID;
  scoreId: ID;
  from: { page: number; x: number; y: number };
  to: { page: number; y: number };
}

export interface Setting {
  key: string;
  value: unknown;
}
