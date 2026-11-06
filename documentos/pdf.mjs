// HTML -> PDF con el Chromium de Playwright del frontend del TFG.
//   node pdf.mjs catalogo-datasets
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire('/home/javier/proyectos/tfg-ciberconciencia/frontend/package.json');
const { chromium } = require('@playwright/test');
const nombre = process.argv[2] ?? 'catalogo-datasets';
const dir = path.dirname(fileURLToPath(import.meta.url));
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(path.join(dir, `${nombre}.html`)).href);
await pagina.pdf({ path: path.join(dir, `${nombre}.pdf`), preferCSSPageSize: true, printBackground: true });
await navegador.close();
