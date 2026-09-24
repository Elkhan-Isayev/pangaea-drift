import { describe, expect, it } from 'vitest';
import * as atmosphere from '../../src/shaders/atmosphere.glsl.js';
import * as common from '../../src/shaders/common.glsl.js';
import * as reconstruct from '../../src/shaders/reconstruct.glsl.js';
import * as surface from '../../src/shaders/surface.glsl.js';

// GLSL ES 3.00 reserved words that are easy to use as variable names by accident
// (a variable called `coherent` once broke the surface shader on ANGLE/Metal).
const RESERVED = ['coherent', 'volatile', 'restrict', 'readonly', 'writeonly', 'resource', 'atomic_uint', 'noperspective',
  'patch', 'sample', 'subroutine', 'common', 'partition', 'active', 'filter', 'input', 'output', 'superp', 'namespace',
  'using', 'class', 'template', 'union', 'enum', 'typedef', 'goto', 'inline', 'noinline', 'public', 'static', 'extern',
  'external', 'interface', 'long', 'short', 'half', 'fixed', 'unsigned', 'sizeof', 'cast', 'asm'];

const SHADERS = Object.entries({ ...atmosphere, ...common, ...reconstruct, ...surface }).filter(([, v]) => typeof v === 'string');

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe.each(SHADERS)('%s', (name, src) => {
  const code = stripComments(src);

  it('declares no identifier that is a reserved word', () => {
    const decl = /\b(?:float|int|bool|u?vec[234]|mat[234]|sampler\w*)\s+([A-Za-z_]\w*)/g;
    for (const [, id] of code.matchAll(decl)) expect(RESERVED, `${name}: ${id}`).not.toContain(id);
  });

  it('has balanced braces and parentheses', () => {
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      expect(code.split(open).length, `${name} ${open}${close}`).toBe(code.split(close).length);
    }
  });

  it('has no unresolved template placeholders', () => {
    expect(src).not.toMatch(/\$\{/);
  });
});

describe('shader set', () => {
  it('every fragment shader writes a colour', () => {
    for (const [name, src] of SHADERS.filter(([n]) => /Frag$/.test(n))) expect(src, name).toMatch(/gl_FragColor\s*=/);
  });

  it('every vertex shader writes a position', () => {
    for (const [name, src] of SHADERS.filter(([n]) => /Vert$/.test(n))) expect(src, name).toMatch(/gl_Position\s*=/);
  });

  it('declares the uniforms the scene binds', () => {
    for (const u of ['tRecon', 'tElevT', 'tFeat', 'tClouds', 'uShowTectonics', 'uSeaLevel', 'uTime'])
      expect(surface.surfaceFrag).toMatch(new RegExp(`uniform\\s+\\w+\\s+${u};`));
    for (const u of ['tOro', 'tNet', 'tFeat', 'uOroSlices', 'uNetSlices'])
      expect(reconstruct.resolveFrag).toMatch(new RegExp(`uniform\\s+\\w+\\s+${u};`));
  });
});
