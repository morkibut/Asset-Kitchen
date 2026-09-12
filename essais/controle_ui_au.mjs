// Navigateur de vérification isolé, sans profil utilisateur ni génération réelle.
import { chromium } from '../interface/node_modules/playwright-core/index.mjs'
import { createInterface } from 'node:readline'
import { mkdir } from 'node:fs/promises'
const sortie = new URL('./resultats/ui-au/', import.meta.url)
await mkdir(sortie, { recursive: true })
const navigateur = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } })
const erreurs = []
page.on('pageerror', e => erreurs.push(e.message))
await page.goto(process.argv[2] ?? 'http://127.0.0.1:8497/')
console.log('PRÊT')
for await (const ligne of createInterface({ input: process.stdin })) {
  try {
    const action = JSON.parse(ligne)
    const racine = action.dans ? page.getByRole(action.dans.role, { name: action.dans.nom, exact: true }) : page
    const trouve = action.role ? racine.getByRole(action.role, { name: action.nom, exact: action.exact ?? true }) : action.label ? racine.getByLabel(action.label, { exact: true }) : action.texte ? racine.getByText(action.texte, { exact: true }) : null
    const cible = action.indice === undefined ? trouve : trouve.nth(action.indice)
    if (action.geste === 'quitter') break
    else if (action.geste === 'cliquer') await cible.click()
    else if (action.geste === 'remplir') await cible.fill(action.valeur)
    else if (action.geste === 'choisir') await cible.selectOption(action.valeur)
    else if (action.geste === 'cocher') await cible.setChecked(action.valeur)
    else if (action.geste === 'survoler') await cible.hover()
    else if (action.geste === 'touche') await (cible ?? page.keyboard).press(action.valeur)
    else if (action.geste === 'attendre') await cible.waitFor()
    else if (action.geste === 'taille') await page.setViewportSize(action.valeur)
    else if (action.geste === 'recharger') await page.reload()
    else if (action.geste === 'aller') await page.goto(action.url)
    else if (action.geste === 'fichier') await cible.setInputFiles(action.chemin)
    else if (action.geste === 'capture') { await page.screenshot({ path: new URL(action.nom, sortie).pathname.replace(/^\/(\w:)/, '$1'), fullPage: false }); console.log(action.nom) }
    else if (action.geste === 'erreurs') console.log(JSON.stringify(erreurs))
    else if (action.geste === 'etat') console.log((await page.locator('body').ariaSnapshot()).slice(0, 18000))
    else throw Error('Geste inconnu')
    console.log('FAIT')
  } catch (e) { console.log('ERREUR ' + e.message) }
}
await navigateur.close()
