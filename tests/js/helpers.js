import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Committed assets in public/data (tests run from the project root).
export const dataPath = (name) => resolve(process.cwd(), 'public/data', name);
export const readJson = (name) => JSON.parse(readFileSync(dataPath(name), 'utf8'));
export const readBuffer = (name) => {
  const b = readFileSync(dataPath(name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
