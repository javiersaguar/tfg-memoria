// Genera resumen-una-cara.pdf a partir del HTML con el Chromium de Playwright
// (el que ya tiene instalado el frontend del TFG).
//   node resumen-pdf.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire('/home/javier/proyectos/tfg-ciberconciencia/frontend/package.json');
const { chromium } = require('@playwright/test');

const dir = path.dirname(fileURLToPath(import.meta.url));
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(path.join(dir, 'resumen-una-cara.html')).href);
await pagina.pdf({
  path: path.join(dir, 'resumen-una-cara.pdf'),
  preferCSSPageSize: true,
  printBackground: true,
});
await navegador.close();
