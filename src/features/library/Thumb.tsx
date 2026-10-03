import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getThumbnail } from '../../core/db/queries';

/** Miniatura de una partitura (primera página), desde la tabla thumbnails. */
export function Thumb({ scoreId }: { scoreId: string }) {
  const data = useLiveQuery(() => getThumbnail(scoreId), [scoreId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!data) return setUrl(undefined);
    const u = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data]);
  return url ? <img src={url} alt="" loading="lazy" /> : null;
}
