import caveatUrl from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';
import { getPdfBytes, getScore, listScoreAnnotations } from '../../core/db/queries';
import type { PageAnnotations } from '../../core/db/types';
import { shownWidth, toPdfSpace, type PageBox } from '../../core/pdf/pageSpace';
import { shareOrDownload } from '../../core/share';
import { strokeOutline, VB } from './strokes';
import { stampGeometry } from './symbols';

/**
 * PDF con las anotaciones dibujadas encima, para imprimir o compartir. Va el PDF original, con
 * sus páginas en su orden y enteras: lo que se agrega es lo dibujado, escrito y pegado (trazos,
 * resaltados, textos y símbolos). No van marcadores, saltos, recorte ni orden de páginas.
 */

export interface FontSources {
  bravura: () => Promise<ArrayBuffer>; // símbolos musicales
  caveat: () => Promise<ArrayBuffer>; // textos, con la misma letra que en pantalla
}

// Los mismos archivos que usa la app (y que el service worker ya guardó): anda sin conexión.
const fetchBytes = (url: string) => () => fetch(url).then((r) => r.arrayBuffer());
const appFonts: FontSources = { bravura: fetchBytes(bravuraUrl), caveat: fetchBytes(caveatUrl) };

const toRgb = async (hex: string) => {
  const { rgb } = await import('pdf-lib');
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Lo que se usa de fontkit (los tipos de @pdf-lib/fontkit no traen scale/translate de Path).
interface GlyphPath {
  scale(x: number, y: number): GlyphPath;
  translate(x: number, y: number): GlyphPath;
  toSVG(): string;
}
interface ParsedFont {
  unitsPerEm: number;
  layout(text: string): {
    glyphs: { path: GlyphPath }[];
    positions: { xAdvance: number; xOffset: number; yOffset: number }[];
  };
}

async function parseFont(bytes: ArrayBuffer): Promise<ParsedFont> {
  const mod = (await import('@pdf-lib/fontkit')) as unknown as {
    create?: (b: Uint8Array) => ParsedFont;
    default?: { create: (b: Uint8Array) => ParsedFont };
  };
  return (mod.create ?? mod.default!.create)(new Uint8Array(bytes));
}

/**
 * Texto -> path SVG con la forma de cada letra, en unidades de la fuente y con el eje y hacia
 * abajo (drawSvgPath lo vuelve a invertir). Se dibuja como trazo en vez de embeber la fuente:
 * pdf-lib mete los woff2 tal cual y los visores los leen mal, y así el PDF pesa poco.
 */
function textPath(font: ParsedFont, text: string) {
  const run = font.layout(text);
  let x = 0;
  return run.glyphs
    .map((glyph, i) => {
      const pos = run.positions[i];
      const d = glyph.path
        .translate(x + pos.xOffset, pos.yOffset)
        .scale(1, -1)
        .toSVG();
      x += pos.xAdvance;
      return d;
    })
    .join('');
}

export async function buildAnnotatedPdf(
  pdfBytes: ArrayBuffer,
  pages: PageAnnotations[],
  fonts: FontSources = appFonts,
): Promise<Uint8Array> {
  // pdf-lib y fontkit pesan ~500 KB: se cargan recién al exportar.
  const { PDFDocument, BlendMode, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const hasStamps = pages.some((a) => a.stamps?.length);
  const hasTexts = pages.some((a) => a.texts.length);
  const bravura = hasStamps ? await parseFont(await fonts.bravura()) : undefined;
  const caveat = hasTexts ? await parseFont(await fonts.caveat()) : undefined;

  for (const a of pages) {
    if (a.page >= doc.getPageCount()) continue;
    const page = doc.getPage(a.page);
    const box: PageBox = { ...page.getCropBox(), rotation: page.getRotation().angle };
    const width = shownWidth(box); // las medidas guardadas son fracciones de este ancho
    const aspect = (box.rotation % 180 === 0 ? box.height : box.width) / width;
    const at = (u: number, v: number) => toPdfSpace(box, u, v);
    // El texto y los símbolos se giran con la página para que se lean derechos.
    const rotate = degrees(box.rotation);

    for (const s of a.strokes) {
      const outline = strokeOutline(s, aspect);
      if (!outline.length) continue;
      // drawSvgPath invierte el eje y (como SVG): se le pasa -y para que quede en su lugar.
      const d = outline
        .map(([x, y], i) => {
          const [px, py] = at(x / VB, y / (VB * aspect));
          return `${i ? 'L' : 'M'}${px.toFixed(2)} ${(-py).toFixed(2)}`;
        })
        .join('');
      page.drawSvgPath(`${d}Z`, {
        x: 0,
        y: 0,
        color: await toRgb(s.color),
        borderWidth: 0,
        ...(s.tool === 'highlighter' ? { opacity: 0.4, blendMode: BlendMode.Multiply } : {}),
      });
    }
    const drawRun = async (
      font: ParsedFont,
      text: string,
      u: number,
      v: number,
      size: number,
      color: string,
    ) => {
      const [x, y] = at(u, v);
      page.drawSvgPath(textPath(font, text), {
        x,
        y,
        scale: (size * width) / font.unitsPerEm,
        rotate,
        color: await toRgb(color),
        borderWidth: 0,
      });
    };
    for (const n of a.texts) await drawRun(caveat!, n.text, n.x, n.y, n.size, n.color);
    for (const s of a.stamps ?? []) {
      const g = stampGeometry(s, aspect);
      await drawRun(bravura!, g.char, g.originX, g.originY / aspect, s.size, s.color);
    }
  }
  return doc.save();
}

// Lo que no puede ir en un nombre de archivo en algún sistema.
const fileSafe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'partitura';

/** Arma el PDF de una partitura y lo comparte (celular, tablet) o lo descarga (compu). */
export async function exportAnnotatedPdf(scoreId: string, suffix: string) {
  const score = await getScore(scoreId);
  const bytes = score && (await getPdfBytes(score.pdfId));
  if (!score || !bytes) throw new Error('missing-pdf');
  const pdf = await buildAnnotatedPdf(bytes, await listScoreAnnotations(scoreId));
  const file = new File([pdf as BlobPart], `${fileSafe(score.title)} ${suffix}.pdf`, {
    type: 'application/pdf',
  });
  return shareOrDownload(file);
}
