export type ID = string;

export interface PdfFile {
  id: ID;
  sha256: string;
  blob: Blob;
  size: number;
  pageCount: number;
}
export interface Thumbnail {
  scoreId: ID;
  blob: Blob;
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
export interface PageAnnotations {
  id: string; // `${scoreId}:${page}`
  scoreId: ID;
  page: number; // página real del PDF, base 0
  strokes: Stroke[];
  texts: TextNote[];
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
