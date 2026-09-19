// L'assemblage pur du prompt d'une matière de tileset — la part de tile-ia.js qui ne
// touche ni au réseau ni au DOM, sortie ici pour la même raison que tile-materials.js,
// tile-emplacements.js ou tile-masks.js : un module qui n'importe pas app.js s'éprouve
// par `npm test`, sans navigateur. tile-ia.js importe ce module et y ajoute la couche
// réseau (api, state) ; rien de ce fichier ne change de sens selon qui l'appelle.
//
// T26 — une seule pierre pour trois emplacements (docs/PLAN-tilesets.md). Sol, dessus de
// mur et face de mur sont mesurés indépendants (pas de référence en latent, pas de graine
// commune : les deux nuisent) — ce qui les lie est le TEXTE. `composerPrompt` écrit donc
// le prompt en trois morceaux dans l'ORDRE mesuré : la pierre (le tronc, écrite une fois
// pour tout le tileset), la clause de motif (compte et taille de ce qui se répète à CET
// emplacement), puis le cadrage (vue, éclairage, interdits). C'est la SEULE fonction qui
// écrit un prompt de matière — `corpsGeneration` ci-dessous l'appelle pour la génération
// réelle ET pour l'aperçu (`apercuPromptMatiere`, tile-ia.js), jamais recopiée : l'invariant
// de T18 (« l'aperçu montre exactement ce qui part ») tient par construction, pas par essai.

// Les consignes d'angle et d'éclairage sont en anglais : c'est la langue des modèles du
// catalogue, et un déclencheur de LoRA mal accompagné se dilue. La pierre et la clause de
// motif de l'utilisateur passent telles quelles, en tête.
export const CADRAGES = {
  surface: {
    nom: 'Sol vu du dessus',
    aide: 'Le défaut d’une surface de terrain.',
    perspective: 'top-down view',
    consigne: 'seen from directly above, one continuous material filling the entire frame, flat even overhead lighting, no cast shadows, no single light direction, no objects, no border',
  },
  face: {
    nom: 'Face de mur, de face',
    aide: 'Interdit le sol, le ciel et l’horizon.',
    perspective: 'front view',
    // Le piège de la face : le modèle veut dessiner UNE SCÈNE de mur, avec un sol en bas
    // et un ciel en haut. Or cette image est empilée sur toute la hauteur du mur — un
    // dégradé haut-bas se lirait comme des bandes. D'où les quatre interdits explicites.
    consigne: 'a vertical surface seen straight on from the front, one continuous material filling the entire frame, flat even frontal lighting, no cast shadows, no floor, no ground, no sky, no horizon, no border',
  },
  // Ajoutés par T18. « À plat » vient du vocabulaire albedo : aucune lumière cuite dans
  // l'image. C'est ce qu'il faut dès que le relief de l'atelier est poussé, sinon deux
  // éclairages se superposent et se contredisent.
  plat: {
    nom: 'Matière à plat, délavée',
    aide: 'Albedo : aucune lumière cuite dedans.',
    perspective: 'top-down view',
    consigne: 'flat lay albedo material, evenly distributed detail across the whole frame, neutral diffuse lighting, no highlights, no cast shadows, no vignette, no border',
  },
  // Pour les matières dont le raccord est STRUCTUREL et non organique — briques,
  // planches, dalles, carrelage. Leur motif a une unité et un rang ; un modèle laissé
  // libre les dessine de tailles inégales, et le rang se brise à la couture.
  motif: {
    nom: 'Motif régulier',
    aide: 'Dalles, briques, planches, carrelage.',
    perspective: 'top-down view',
    consigne: 'a regular repeating pattern, aligned rows, even spacing, consistent unit size, seen from directly above, neutral diffuse lighting, no cast shadows, no border',
  },
};

export const LISTE_CADRAGES = Object.entries(CADRAGES).map(([id, c]) => ({ id, nom: c.nom, aide: c.aide }));

/** Le cadrage que la disposition propose d'elle-même pour un emplacement donné. */
export const cadrageParDefaut = (cible) => (cible === 'face' ? 'face' : 'surface');

// Quelles matières la disposition réclame, et dans quel emplacement chacune atterrit.
// `mur` porte deux matières distinctes parce qu'on ne regarde pas son dessus et sa face
// sous le même angle ; un terrain n'en a qu'une, plus celle du sol dessous s'il en a un.
// Les deux ou trois entrées rendues ici partagent TOUTES la même pierre (T26) : `champ`
// ne porte plus que la clause de motif de cet emplacement, jamais la matière entière.
export function matieresAttendues(mode, { secondTerrain = false } = {}) {
  const liste = [{ cible: 'surface', cadrage: 'surface', champ: 'tile-ia-description' }];
  if (mode.wall) liste.push({ cible: 'face', cadrage: 'face', champ: 'tile-ia-description-face' });
  if (secondTerrain) liste.push({ cible: 'lower-surface', cadrage: 'surface', champ: 'tile-ia-description-bas' });
  return liste;
}

/**
 * `pierre` : le tronc, écrit une fois pour tout le tileset (« warm grey-brown dungeon
 * granite… »). `motif` : la clause de CET emplacement seul — le compte et la taille du
 * motif qui s'y répète (« floor of exactly four huge square flagstones, two by two »).
 * Aucun des deux n'est facultatif : une pierre sans motif ne dit pas sous quel angle la
 * regarder, un motif sans pierre ne dit pas de quoi il est fait.
 */
export function composerPrompt(pierre, motif, cadrage) {
  const tronc = String(pierre || '').trim();
  const clause = String(motif || '').trim();
  if (!tronc) throw new Error('Décris la pierre avant de lancer la génération.');
  if (!clause) throw new Error('Décris le motif de cet emplacement avant de lancer la génération.');
  if (!CADRAGES[cadrage]) throw new Error(`Cadrage inconnu : ${cadrage}`);
  return `${tronc}, ${clause}, ${CADRAGES[cadrage].consigne}`;
}

// `pixel:false` et `pixelSize:0` sont délibérés : la matière est livrée en pleine
// résolution et c'est le moteur de tuiles qui la réduit, par moyenne d'aire, à la taille
// exacte de la tuile. Réduire deux fois — une fois ici en plus proche voisin, une fois
// là-bas — détruisait la matière (voir resampleTexture dans le moteur).
/**
 * `reference` est une image facultative, en data URL : le modèle part d'elle au lieu de
 * partir du bruit, et `denoise` dit à quel point il a le droit de s'en éloigner — 0,30
 * conserve davantage, 0,65 transforme davantage. C'est une référence de STYLE fournie par
 * l'utilisateur (T17), indépendante du mécanisme de parenté mesuré en T26 : elle ne
 * chaîne pas une matière sur l'autre, elle s'applique pareillement à chacune.
 *
 * `seed` : mesurée LIBRE par matière (T26 — une graine commune nuit à la teinte plus
 * qu'elle n'aide la parenté). L'appelant ne doit donc jamais faire tourner la même graine
 * concrète sur les deux ou trois emplacements d'une génération ; `-1` (le défaut) laisse
 * chaque génération tirer la sienne, indépendamment des autres.
 *
 * `comfyUrl` et `checkpoint` sont explicites plutôt que lus sur un état global : c'est ce
 * qui rend cette fonction pure et vérifiable par `npm test` sans navigateur — tile-ia.js
 * les fournit depuis `state.settings` au moment de l'appel.
 */
// T29 — la taille que l'IA seule peut tenir (docs/PLAN-tilesets.md). Sans référence, le
// graphe part d'un `EmptyFlux2LatentImage` en 512 et déroule toutes les sigmas : 8 Go
// saturés, 25 min, coupé à 20 par server.mjs (témoin C d'E1). En 256, ça tient (E8). Avec
// référence, le latent part de l'image fournie et 512 est mesuré tenir. `taille` reste
// facultative — elle l'emporte quand elle est fournie, sinon la règle ci-dessus tranche.
export function tailleParDefaut(reference) { return reference ? 512 : 256; }

// T35 — « Nombre de tirages » : N générations mises en file d'un coup, graine
// incrémentée par tirage, comme les tirages multiples de l'espace de création
// (public/app.js, `submitGeneration`). La règle T26 (une graine commune ENTRE les
// emplacements d'un même tirage nuit à la teinte, sans aider la parenté) ne dit rien
// des graines ENTRE deux tirages différents : c'est elle qu'on continue d'honorer ici,
// par le pas — chaque tirage réserve `parTirage` graines consécutives (une par
// emplacement attendu), jamais partagées entre emplacements d'un même tirage ni entre
// deux tirages. `depart` est résolu par l'appelant (une graine tirée une fois pour toute
// la rafale), pour que cette fonction reste pure et vérifiable sans hasard.
export function seedsPourTirages(depart, tirages, parTirage = 1) {
  const n = Math.max(1, Math.min(20, Math.trunc(Number(tirages)) || 1));
  const pas = Math.max(1, Math.trunc(Number(parTirage)) || 1);
  const base = Number.isInteger(depart) && depart >= 0 ? depart : 0;
  return Array.from({ length: n }, (_, i) => Math.min(2147483647, base + i * pas));
}

export function corpsGeneration({ pierre, motif, cadrage, preset, seed, project, reference, denoise, comfyUrl, checkpoint, taille }) {
  if (reference && !/^data:image\/(png|jpeg|webp);base64,/.test(reference)) throw new Error('La référence doit être une image PNG, JPEG ou WebP.');
  const dimension = Number.isInteger(taille) ? taille : tailleParDefaut(reference);
  return {
    provider: 'comfyui',
    comfyUrl,
    workflowPreset: preset,
    checkpoint,
    kind: 'texture',
    prompt: composerPrompt(pierre, motif, cadrage),
    perspective: CADRAGES[cadrage].perspective,
    ...(reference ? { reference, denoise: Number.isFinite(denoise) ? denoise : 0.55 } : {}),
    style: '16-bit pixel art',
    theme: '',
    // Le raccord sans couture, demandé au modèle choisi quel qu'il soit (lib/seamless.mjs).
    tileable: true,
    width: dimension,
    height: dimension,
    seed: Number.isInteger(seed) ? seed : -1,
    count: 1,
    pixel: false,
    pixelSize: 0,
    colors: 24,
    negative: 'blurry, text, watermark, frame, border, vignette, grid, tile lines, seams, gutters, single object, centered composition, drop shadow, directional lighting, gradient, perspective',
    removeBackground: false,
    project,
  };
}
