#!/usr/bin/env node
/**
 * Transforme un document d'Artifact en fichier HTML autonome.
 *
 *   node export_standalone.cjs <document.html> [sortie.html]
 *
 * Trois choses qu'un fichier exporté doit avoir et qu'un Artifact publié n'a pas :
 *
 * 1. UN SQUELETTE HTML. La plateforme ajoute <!doctype>, <head> et <meta charset> à la
 *    publication. Le fichier source n'en a pas : ouvert depuis le disque, il affiche les
 *    accents en caractères de remplacement. C'est la panne la plus visible et la plus bête.
 *
 * 2. DES POLICES INTÉGRÉES. Un Artifact charge ses polices depuis Google Fonts, ce qui
 *    convient en ligne. Hors ligne — et dans les moteurs d'impression, qui n'ont pas
 *    toujours accès au réseau — les trois familles retombent sur des polices système et le
 *    document ne se reconnaît plus. On les intègre en base64.
 *
 * 3. UNE FEUILLE D'IMPRESSION. Une colonne de sommaire collante et un fond sombre n'ont
 *    aucun sens sur A4.
 *
 * Aucune dépendance : Node seul. Sans accès au réseau, le script continue en signalant que
 * les polices n'ont pas pu être intégrées — un fichier sans ses polices reste utilisable,
 * un échec dur ne l'est pas.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Sans un agent moderne, Google sert du TTF au lieu du WOFF2 : trois fois plus lourd.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Le cyrillique, le grec et le vietnamien tripleraient le poids pour un document qui ne les
// emploie pas. `latin-ext` couvre les langues d'Europe centrale, il reste bon marché.
const KEPT_SUBSETS = ['latin', 'latin-ext'];

const PRINT_CSS = `
@page { size: A4; margin: 14mm 13mm 16mm; }

@media print {
  body { font-size: 9.6pt; line-height: 1.5; }

  /* Ce qui ne doit jamais être coupé entre deux pages. */
  h1, h2, h3, h4 { break-after: avoid; }
  figure, tr, pre, blockquote, li { break-inside: avoid; }

  /* Les conteneurs à défilement n'ont plus de sens sur papier : tout doit tenir. */
  [class*="scroll"], [style*="overflow"] { overflow: visible !important; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 7.6pt; }
  table { font-size: 8.2pt; }

  /* Une largeur de lecture calculée pour l'écran gaspille la page. */
  main, article, section, p, ul, ol { max-width: none !important; }

  a { text-decoration: none; }
}
`;

/**
 * Neutralise au moment de l'impression ce que le CSS seul ne peut pas atteindre :
 * le thème sombre (porté par des variables dont on ignore le nom) et les éléments
 * positionnés en collant ou en fixe (que CSS ne sait pas sélectionner).
 */
const PRINT_SCRIPT = `
(() => {
  const root = document.documentElement;
  let restore = [];
  addEventListener('beforeprint', () => {
    // La convention des Artifacts veut que data-theme="light" l'emporte sur tout le reste.
    restore = [{ el: root, attr: root.getAttribute('data-theme') }];
    root.setAttribute('data-theme', 'light');
    for (const el of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') {
        restore.push({ el, style: el.getAttribute('style') });
        el.style.position = 'static';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
      }
    }
  });
  addEventListener('afterprint', () => {
    for (const r of restore) {
      if ('attr' in r) r.attr === null ? r.el.removeAttribute('data-theme') : r.el.setAttribute('data-theme', r.attr);
      else r.style === null ? r.el.removeAttribute('style') : r.el.setAttribute('style', r.style);
    }
    restore = [];
  });
})();
`;

function fetch(url, binary = false) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('délai dépassé')));
  });
}

/** Récupère la feuille Google Fonts et remplace chaque URL par le fichier lui-même. */
async function inlineFonts(cssUrl) {
  const css = await fetch(cssUrl.replace(/&amp;/g, '&'));

  // Chaque bloc @font-face est précédé d'un commentaire nommant son sous-ensemble.
  const blocks = css.split('/*').slice(1).map((raw) => ({
    subset: raw.slice(0, raw.indexOf('*/')).trim(),
    body: raw.slice(raw.indexOf('*/') + 2),
  }));

  let out = '';
  let files = 0;
  let bytes = 0;

  for (const { subset, body } of blocks) {
    if (!KEPT_SUBSETS.includes(subset)) continue;
    const match = /src:\s*url\(([^)]+)\)/.exec(body);
    if (!match) continue;

    const data = await fetch(match[1], true);
    bytes += data.length;
    files++;
    out += body.replace(
      /url\([^)]+\)\s*format\('woff2'\)/,
      `url(data:font/woff2;base64,${data.toString('base64')}) format('woff2')`
    ).trim() + '\n';
  }

  if (files === 0) throw new Error('aucun bloc de police exploitable dans la feuille');
  return { css: out, files, bytes };
}

async function main() {
  const [input, outputArg] = process.argv.slice(2);
  if (!input) {
    console.error('Usage : node export_standalone.cjs <document.html> [sortie.html]');
    process.exit(1);
  }

  const src = fs.readFileSync(input, 'utf8');
  const output = outputArg || input.replace(/\.html?$/i, '') + '-autonome.html';

  let doc = src;
  const notes = [];

  // --- Polices
  const linkMatch = /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/i.exec(doc);
  if (linkMatch) {
    try {
      const { css, files, bytes } = await inlineFonts(linkMatch[1]);
      doc = doc
        .replace(/<link[^>]+rel="preconnect"[^>]*>\s*/gi, '')
        .replace(linkMatch[0], `<style>\n${css}</style>`);
      notes.push(`${files} fichier(s) de police intégré(s) (${(bytes / 1024).toFixed(0)} Ko)`);
    } catch (err) {
      notes.push(`polices NON intégrées (${err.message}) — le fichier dépendra du réseau`);
    }
  } else {
    notes.push('aucune police distante détectée, rien à intégrer');
  }

  // --- Feuille d'impression, insérée après le CSS du document pour l'emporter à
  //     spécificité égale.
  const lastStyle = doc.lastIndexOf('</style>');
  if (lastStyle !== -1) {
    doc = doc.slice(0, lastStyle + 8) + `\n<style>${PRINT_CSS}</style>\n<script>${PRINT_SCRIPT}</script>\n` + doc.slice(lastStyle + 8);
  } else {
    doc = `<style>${PRINT_CSS}</style>\n<script>${PRINT_SCRIPT}</script>\n` + doc;
  }
  notes.push('feuille d\'impression ajoutée');

  // --- Squelette, si le document n'en a pas déjà un.
  if (!/^\s*<!doctype/i.test(doc)) {
    const title = (/<title>([^<]*)<\/title>/i.exec(doc) || [, 'Document'])[1];
    const lang = process.env.EXPORT_LANG || 'fr';
    doc =
      `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
      `<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}img,video{max-width:100%;height:auto}</style>\n` +
      doc +
      `\n</body>\n</html>\n`;
    notes.push(`squelette HTML ajouté (titre « ${title} »)`);
  }

  fs.writeFileSync(output, doc, 'utf8');

  console.log(`Écrit : ${path.resolve(output)}`);
  console.log(`Taille : ${(doc.length / 1024).toFixed(0)} Ko`);
  notes.forEach((n) => console.log(`  · ${n}`));
}

main().catch((err) => {
  console.error(`Échec : ${err.message}`);
  process.exit(1);
});
