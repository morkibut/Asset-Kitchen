// TU5 — la preuve de fidélité au caractère près.
//
// Ce script ne fait rien d'autre que d'APPELER le vrai `composerPrompt` et le vrai
// `corpsGeneration` de sc-clone — recopiés tels quels dans
// `interface/src/tuiles/moteur/tile-ia-prompt.js` par TU1, empreinte comparée au commit
// source par son propre essai — et d'écrire leurs sorties dans un fichier JSON, figé.
// `tests/test_tu5_matieres.py` compare ensuite le portage Python (`atelier/domaine/
// texte_matiere.py`) à ce fichier, au caractère près.
//
// Ce que ça coûte : rien. Ni appel réseau, ni GPU — ce module est pur, comme sc-clone
// l'a écrit lui-même (voir son en-tête). `node essais/tu5_textes_scclone.mjs` s'exécute
// en une fraction de seconde et écrit `essais/fixtures/tu5_textes_scclone.json`.
//
// Les cas : d'abord ceux des essais de sc-clone (`tile-ia-prompt.test.ts`, la pierre du
// donjon et ses trois motifs), puis une dizaine de cas à nous — accents, une pierre ou un
// motif vides (pour vérifier le refus, pas une sortie), et chacun des quatre cadrages.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CADRAGES, composerPrompt, corpsGeneration, tailleParDefaut, seedsPourTirages,
} from '../interface/src/tuiles/moteur/tile-ia-prompt.js';

const ICI = dirname(fileURLToPath(import.meta.url));

// ── Les cas des essais de sc-clone (tile-ia-prompt.test.ts) ────────────────────────────
const PIERRE = 'warm grey-brown dungeon granite, cool grey stone with ochre torchlit tint, fine speckled grain, dark recessed mortar joints';
const MOTIF_SOL = 'floor of exactly four huge square flagstones, two by two, filling the whole frame';
const MOTIF_DESSUS = 'raw rough rock seen from above, exactly four huge rounded boulders, two by two';
const MOTIF_FACE = 'masonry wall of exactly four huge rectangular ashlar blocks, two by two';

const corps = (over = {}) => corpsGeneration({
  pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface', preset: 'klein9b-tiles-raccordable',
  project: 'Donjon', comfyUrl: 'http://127.0.0.1:8188', checkpoint: null, ...over,
});

const casReussis = [
  { nom: 'sol — pierre du donjon, essai de sc-clone', pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface' },
  { nom: 'dessus de mur — même pierre, motif du dessus', pierre: PIERRE, motif: MOTIF_DESSUS, cadrage: 'surface' },
  { nom: 'face de mur — même pierre, cadrage face', pierre: PIERRE, motif: MOTIF_FACE, cadrage: 'face' },

  // ── Une dizaine de cas à nous ──────────────────────────────────────────────────────
  { nom: 'accents — herbe et terre battue', pierre: 'terre battue brun-roux, herbe rase piquetée de mousse, grain fin', motif: 'prairie ordinaire, sans motif répété, texture continue', cadrage: 'surface' },
  { nom: 'accents et apostrophe', pierre: "pavé d’ardoise grise, joints étroits, reflets d’humidité", motif: 'quatre dalles rectangulaires, deux par deux, remplissant le cadre', cadrage: 'surface' },
  { nom: 'cadrage plat — matière à plat, délavée', pierre: 'planches de bois clair, grain vertical marqué', motif: 'lattes régulières, alignées, sans relief lumineux', cadrage: 'plat' },
  { nom: 'cadrage motif — dalles régulières', pierre: 'granit gris clair, surface polie', motif: 'exactly nine square tiles, three by three, evenly spaced', cadrage: 'motif' },
  { nom: 'texte long — motif détaillé', pierre: 'sable fin doré, ridules de vent, grain uniforme sur toute la surface visible', motif: 'exactly six large dunes crests, two by three, filling the whole frame, no gaps', cadrage: 'surface' },
  { nom: 'majuscules et ponctuation', pierre: 'Lave noire craquelée, veines orangées incandescentes.', motif: 'Exactly four cooling cracks, two by two, radiating outward.', cadrage: 'surface' },
  { nom: 'avec référence — taille 512', pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface', reference: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', denoise: 0.55 },
  { nom: 'taille explicite — 128', pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface', taille: 128 },
  { nom: 'graine fixée', pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface', seed: 42 },
  { nom: 'motif face avec compte explicite', pierre: 'pierre de taille grise, joints fins au fer', motif: 'masonry wall of exactly two huge rectangular blocks, side by side', cadrage: 'face' },
];

const sortie = { casReussis: {}, casRefuses: [], graines: {}, tailles: {}, cadrages: CADRAGES };

for (const cas of casReussis) {
  sortie.casReussis[cas.nom] = {
    entree: cas,
    prompt: composerPrompt(cas.pierre, cas.motif, cas.cadrage),
    corps: corps(cas),
  };
}

// ── Les cas refusés — pierre vide, motif vide, cadrage inconnu ─────────────────────────
const refuse = (nom, entree, fn) => {
  try {
    fn();
    sortie.casRefuses.push({ nom, entree, leve: false });
  } catch (erreur) {
    sortie.casRefuses.push({ nom, entree, leve: true, message: erreur.message });
  }
};
refuse('pierre vide', { pierre: '', motif: MOTIF_SOL, cadrage: 'surface' },
  () => composerPrompt('', MOTIF_SOL, 'surface'));
refuse('motif vide', { pierre: PIERRE, motif: '', cadrage: 'surface' },
  () => composerPrompt(PIERRE, '', 'surface'));
refuse('pierre faite uniquement d’espaces', { pierre: '   ', motif: MOTIF_SOL, cadrage: 'surface' },
  () => composerPrompt('   ', MOTIF_SOL, 'surface'));
refuse('cadrage inconnu', { pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'pas-un-cadrage' },
  () => composerPrompt(PIERRE, MOTIF_SOL, 'pas-un-cadrage'));

// ── La taille par défaut et les graines par tirage ──────────────────────────────────────
sortie.tailles = {
  sansReference: tailleParDefaut(null),
  avecReference: tailleParDefaut('data:image/png;base64,AAAA'),
};
sortie.graines = {
  cinqTirages: seedsPourTirages(100, 5, 3),
  sansPas: seedsPourTirages(100, 4),
  unTirageMinimum: seedsPourTirages(0, 0).length,
  vingtTiragesMaximum: seedsPourTirages(0, 50).length,
};

mkdirSync(join(ICI, 'fixtures'), { recursive: true });
const chemin = join(ICI, 'fixtures', 'tu5_textes_scclone.json');
writeFileSync(chemin, JSON.stringify(sortie, null, 2) + '\n', 'utf-8');
console.log(`Écrit : ${chemin}`);
console.log(`${casReussis.length} cas réussis, ${sortie.casRefuses.length} cas refusés.`);
