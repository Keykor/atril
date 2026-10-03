declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string; // ISO, momento del build
declare const __BUILD_SHA__: string; // commit corto, o "local"
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
