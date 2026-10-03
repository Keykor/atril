import { useEffect, useState } from 'react';
import { renderThumb } from '../../core/pdf/render';

interface Props {
  pdfId: string;
  order: number[];
  pos: number;
  label: string;
  onPick: (pos: number) => void;
}

/** Miniaturas de las páginas, en el orden virtual, para saltar. */
export function PageStrip({ pdfId, order, pos, label, onPick }: Props) {
  return (
    <div className="page-strip" aria-label={label}>
      {order.map((page, i) => (
        <button key={i} aria-current={i === pos ? 'page' : undefined} onClick={() => onPick(i)}>
          <span>
            <StripThumb pdfId={pdfId} page={page} />
          </span>
          {i + 1}
        </button>
      ))}
    </div>
  );
}

function StripThumb({ pdfId, page }: { pdfId: string; page: number }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    renderThumb(pdfId, page)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pdfId, page]);
  return url ? <img src={url} alt="" /> : null;
}
