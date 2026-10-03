import Dexie, { type Table } from 'dexie';
import type {
  Bookmark,
  JumpLink,
  PageAnnotations,
  PdfData,
  PdfFile,
  Score,
  SetList,
  Setting,
  Tag,
  Thumbnail,
} from './types';

export class AtrilDB extends Dexie {
  pdfs!: Table<PdfFile, string>;
  pdfData!: Table<PdfData, string>;
  thumbnails!: Table<Thumbnail, string>;
  tags!: Table<Tag, string>;
  scores!: Table<Score, string>;
  annotations!: Table<PageAnnotations, string>;
  setlists!: Table<SetList, string>;
  bookmarks!: Table<Bookmark, string>;
  links!: Table<JumpLink, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('atril');
    // Un cambio de esquema es una nueva version(n) con migración. Nunca se borra la base.
    this.version(1).stores({
      pdfs: 'id, &sha256',
      pdfData: 'id',
      thumbnails: 'scoreId',
      tags: 'id, name',
      scores: 'id, pdfId, title, composer, *tagIds, updatedAt, lastOpenedAt',
      annotations: 'id, scoreId, [scoreId+page]',
      setlists: 'id, name, updatedAt',
      bookmarks: 'id, scoreId',
      links: 'id, scoreId',
      settings: 'key',
    });
  }
}

export const db = new AtrilDB();
export const newId = () => crypto.randomUUID();
