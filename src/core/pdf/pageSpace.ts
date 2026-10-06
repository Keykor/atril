/**
 * Pasa un punto de la página tal como se ve en pantalla (u, v de 0 a 1, origen arriba a la
 * izquierda, ya rotada) al espacio de usuario del PDF (puntos, origen abajo a la izquierda).
 * Es lo mismo que hace pdf.js al mostrar la página: usa la caja visible (CropBox) y la rotación.
 */
export interface PageBox {
  x: number; // esquina inferior izquierda de la CropBox
  y: number;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180 o 270 (sentido horario, como /Rotate)
}

export function toPdfSpace(box: PageBox, u: number, v: number): [x: number, y: number] {
  const { x, y, width: w, height: h } = box;
  switch (((box.rotation % 360) + 360) % 360) {
    case 90:
      return [x + v * w, y + u * h];
    case 180:
      return [x + w - u * w, y + v * h];
    case 270:
      return [x + w - v * w, y + h - u * h];
    default:
      return [x + u * w, y + h - v * h];
  }
}

/** Ancho de la página tal como se ve, en puntos del PDF: con 90° o 270° es la altura. */
export const shownWidth = (box: PageBox) => (box.rotation % 180 === 0 ? box.width : box.height);
