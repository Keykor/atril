import { useSyncExternalStore } from 'react';

// Router mínimo sobre el hash: sirve en GitHub Pages sin fallback de SPA y el botón atrás
// de Android funciona porque cada navigate() agrega una entrada al history.
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getPath = () => window.location.hash.slice(1) || '/';

export const useRoute = (): string[] =>
  useSyncExternalStore(subscribe, getPath).split('/').filter(Boolean);

export const navigate = (path: string, replace = false) => {
  if (replace) window.location.replace(`#${path}`);
  else window.location.hash = path;
};

export const back = () => (window.history.length > 1 ? window.history.back() : navigate('/'));
