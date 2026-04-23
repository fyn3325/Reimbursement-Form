/// <reference types="vite/client" />

declare module 'https://esm.sh/xlsx@0.18.5' {
  const XLSX: any;
  export default XLSX;
  export const utils: any;
  export const SSF: any;
  export function read(data: any, opts?: any): any;
}
