// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { CADRAGES, matieresAttendues, composerPrompt, corpsGeneration, tailleParDefaut, seedsPourTirages } from '../tile-ia-prompt.js';
// `lib/providers.mjs` (apercuPrompt, validateGeneration) est l'appelant HTTP du fournisseur
// d'images de sc-clone — hors moteur pur, non porté par TU1 (gag2 aura son propre appelant,
// en Python, TU5). Les essais qui en dépendaient sont marqués `.skip` ci-dessous, avec cette
// même raison.

// T26 — une seule pierre pour trois emplacements. Ce qui lie sol, dessus de mur et face
// est mesuré être le TEXTE (un tronc partagé), jamais une référence en latent ni une
// graine commune — voir docs/PLAN-tilesets.md, « ### T26 ». Ces essais câblent cette
// décision : le tronc voyage mot pour mot, l'aperçu montre exactement ce qui part, et les
// graines des matières d'une même génération restent indépendantes.

const PIERRE = 'warm grey-brown dungeon granite, cool grey stone with ochre torchlit tint, fine speckled grain, dark recessed mortar joints';
const MOTIF_SOL = 'floor of exactly four huge square flagstones, two by two, filling the whole frame';
const MOTIF_DESSUS = 'raw rough rock seen from above, exactly four huge rounded boulders, two by two';
const MOTIF_FACE = 'masonry wall of exactly four huge rectangular ashlar blocks, two by two';

const corps = (over = {}) => corpsGeneration({
  pierre: PIERRE, motif: MOTIF_SOL, cadrage: 'surface', preset: 'sdxl-tileable',
  project: 'Donjon', comfyUrl: 'http://127.0.0.1:8188', checkpoint: 'sd_xl.safetensors', ...over,
});

test('composerPrompt écrit le tronc, puis la clause de motif, puis le cadrage — dans cet ordre, mot pour mot', () => {
  const prompt = composerPrompt(PIERRE, MOTIF_SOL, 'surface');
  assert.equal(prompt, `${PIERRE}, ${MOTIF_SOL}, ${CADRAGES.surface.consigne}`);
  assert.ok(prompt.startsWith(PIERRE + ', '), 'la pierre ouvre le prompt');
  // Vérifié à l'envers : sans pierre, ou sans motif, composerPrompt refuse — sinon un
  // champ vide partirait en silence comme une chaîne vide au milieu du prompt.
  assert.throws(() => composerPrompt('', MOTIF_SOL, 'surface'), /Décris la pierre/);
  assert.throws(() => composerPrompt(PIERRE, '', 'surface'), /Décris le motif/);
  assert.throws(() => composerPrompt(PIERRE, MOTIF_SOL, 'pas-un-cadrage'), /Cadrage inconnu/);
});

test('L’ESSAI QUI COMPTE — le corps de génération de trois emplacements partage le tronc mot pour mot, et ne diffère que par la clause de motif et le cadrage', () => {
  const sol = corps({ motif: MOTIF_SOL, cadrage: 'surface' });
  const dessus = corps({ motif: MOTIF_DESSUS, cadrage: 'surface' });
  const face = corps({ motif: MOTIF_FACE, cadrage: 'face' });
  for (const body of [sol, dessus, face]) {
    assert.ok(body.prompt.startsWith(PIERRE + ', '), 'chaque prompt ouvre sur la même pierre');
  }
  // Le préfixe partagé est un préfixe EXACT — pas une ressemblance : les trois chaînes
  // coïncident caractère pour caractère sur la longueur de la pierre.
  const prefixe = PIERRE.length;
  assert.equal(sol.prompt.slice(0, prefixe), dessus.prompt.slice(0, prefixe));
  assert.equal(sol.prompt.slice(0, prefixe), face.prompt.slice(0, prefixe));
  // Après la pierre, chaque prompt continue par SA clause de motif, jamais celle d'un autre.
  assert.equal(sol.prompt, `${PIERRE}, ${MOTIF_SOL}, ${CADRAGES.surface.consigne}`);
  assert.equal(dessus.prompt, `${PIERRE}, ${MOTIF_DESSUS}, ${CADRAGES.surface.consigne}`);
  assert.equal(face.prompt, `${PIERRE}, ${MOTIF_FACE}, ${CADRAGES.face.consigne}`);
  // Le cadrage ne change pas QUE le texte du prompt : la face porte aussi sa propre
  // perspective, distincte du sol et du dessus.
  assert.equal(sol.perspective, 'top-down view');
  assert.equal(dessus.perspective, 'top-down view');
  assert.equal(face.perspective, 'front view');
  // Vérifié à l'envers : deux motifs différents ne doivent PAS produire le même prompt.
  assert.notEqual(sol.prompt, dessus.prompt);
  assert.notEqual(sol.prompt, face.prompt);
});

test.skip('le prompt exposé par la route d’aperçu contient le tronc exactement là où il part en génération — dépend de lib/providers.mjs (apercuPrompt), non porté par TU1', () => {
  // /api/prompt/preview appelle apercuPrompt sur EXACTEMENT le corps que /api/generate
  // recevrait (server.mjs) — cet essai rejoue donc le même appel, sans navigateur.
  for (const body of [corps({ motif: MOTIF_SOL, cadrage: 'surface' }), corps({ motif: MOTIF_FACE, cadrage: 'face' })]) {
    const vu = apercuPrompt(body);
    // Le segment « description » de l'aperçu EST le prompt envoyé — pas une reconstruction
    // approchante : promptParts (lib/providers.mjs) pose `input.prompt` tel quel à cet
    // endroit, et c'est ce même champ qui part dans le graphe ComfyUI (prompt.test.mjs le
    // prouve pour la forme générale ; on le revérifie ici pour le cas pierre + motif).
    const segment = vu.segments.find((s) => s.origine === 'description');
    assert.ok(segment, 'un segment "description" doit exister');
    assert.equal(segment.texte, body.prompt, 'le segment affiché est le prompt exact qui part');
    assert.ok(segment.texte.startsWith(PIERRE), 'la pierre ouvre le segment affiché, comme le prompt qui part');
    assert.ok(vu.prompt.includes(body.prompt), 'le prompt affiché contient le prompt exact qui part');
  }
});

test.skip('les graines de trois emplacements d’une même génération sont indépendantes, jamais une graine commune — dépend de lib/providers.mjs (validateGeneration), non porté par TU1', () => {
  // T26 : une graine commune a été mesurée nuisible (elle dégrade la teinte, Δchroma
  // 3,22 contre 1,78) sans améliorer la parenté. `corpsGeneration` sans seed explicite (ou
  // seed:-1) laisse donc chaque génération tirer la sienne — résolue par `validateGeneration`
  // (lib/providers.mjs), le même mécanisme que toute autre génération de l'atelier.
  const local = (body) => validateGeneration(body);
  const sol = corps({ motif: MOTIF_SOL, cadrage: 'surface' });
  const dessus = corps({ motif: MOTIF_DESSUS, cadrage: 'surface' });
  const face = corps({ motif: MOTIF_FACE, cadrage: 'face' });
  assert.equal(sol.seed, -1, 'corpsGeneration ne fige aucune graine par défaut');
  assert.equal(dessus.seed, -1);
  assert.equal(face.seed, -1);
  const graines = [local(sol).seed, local(dessus).seed, local(face).seed];
  // Trois tirages dans [0, 2^31) : une collision est à ~1 sur 2 milliards, jamais une
  // conséquence d'une graine partagée à dessein comme avant cette tranche.
  assert.equal(new Set(graines).size, 3, `graines attendues distinctes, obtenu ${graines}`);
  // Vérifié à l'envers : une VRAIE graine commune, elle, donne bien trois fois le même
  // nombre — la mécanique de résolution n'est pas en cause, seul l'appelant l'était.
  const partagees = [local({ ...sol, seed: 42 }).seed, local({ ...dessus, seed: 42 }).seed, local({ ...face, seed: 42 }).seed];
  assert.deepEqual(partagees, [42, 42, 42]);
});

test('matieresAttendues rend jusqu’à trois emplacements, tous destinés à partager la même pierre', () => {
  const mur = matieresAttendues({ wall: true }, { secondTerrain: true });
  assert.deepEqual(mur.map((m) => m.cible), ['surface', 'face', 'lower-surface']);
  assert.deepEqual(mur.map((m) => m.cadrage), ['surface', 'face', 'surface']);
  const terrain = matieresAttendues({ wall: false });
  assert.deepEqual(terrain.map((m) => m.cible), ['surface']);
});

// T29 — la taille que l'IA seule peut tenir. Sans référence, le graphe part d'un latent
// vide en 512 et sature les 8 Go de la carte (témoin C d'E1) ; en 256 ça tient (E8). Avec
// référence, le latent part de l'image fournie et 512 est mesuré tenir.
const REFERENCE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('sans référence, corpsGeneration retient 256 × 256 — la taille qu’E8 a fait tenir sans GPU saturé', () => {
  const body = corps({ motif: MOTIF_SOL, cadrage: 'surface' });
  assert.equal(body.reference, undefined);
  assert.equal(body.width, 256);
  assert.equal(body.height, 256);
});

test('avec une référence, corpsGeneration retient 512 × 512 — le latent part de l’image fournie, pas du bruit', () => {
  const body = corps({ motif: MOTIF_SOL, cadrage: 'surface', reference: REFERENCE, denoise: 0.55 });
  assert.equal(body.width, 512);
  assert.equal(body.height, 512);
});

test('une taille explicite l’emporte, avec ou sans référence', () => {
  const sansReference = corps({ motif: MOTIF_SOL, cadrage: 'surface', taille: 128 });
  assert.equal(sansReference.width, 128);
  assert.equal(sansReference.height, 128);
  const avecReference = corps({ motif: MOTIF_SOL, cadrage: 'surface', reference: REFERENCE, denoise: 0.55, taille: 384 });
  assert.equal(avecReference.width, 384);
  assert.equal(avecReference.height, 384);
});

// T35 — « Nombre de tirages » : chaque tirage réserve `parTirage` graines consécutives
// (une par emplacement attendu, comme matieresAttendues() en rend jusqu’à trois), jamais
// partagées avec un autre emplacement du MÊME tirage (T26) ni avec un autre tirage.
test('seedsPourTirages rend des graines distinctes, un bloc de parTirage par tirage, sans jamais déborder 2^31 - 1', () => {
  const graines = seedsPourTirages(100, 5, 3);
  assert.deepEqual(graines, [100, 103, 106, 109, 112]);
  assert.equal(new Set(graines).size, 5, 'les graines de départ de chaque tirage doivent être distinctes');
  // Vérifié à l'envers : sans pas (parTirage manquant ou 0), la fonction ne doit PAS
  // retomber sur la même graine pour tous les tirages — elle impose un pas d’au moins 1.
  const sansPas = seedsPourTirages(100, 4);
  assert.deepEqual(sansPas, [100, 101, 102, 103]);
  assert.equal(new Set(sansPas).size, 4);
  // Bornes : 1 à 20 tirages, jamais moins d’un tirage, jamais plus de vingt.
  assert.equal(seedsPourTirages(0, 0).length, 1);
  assert.equal(seedsPourTirages(0, 50).length, 20);
  // Le plafond de seed valide (2^31 - 1, la borne de validateGeneration) n’est jamais dépassé.
  assert.equal(seedsPourTirages(2147483647 - 1, 5, 10).every((s) => s <= 2147483647), true);
});

test('tailleParDefaut porte la règle seule — 512 avec référence, 256 sans', () => {
  assert.equal(tailleParDefaut(null), 256);
  assert.equal(tailleParDefaut(undefined), 256);
  assert.equal(tailleParDefaut(REFERENCE), 512);
});

test.skip('validateGeneration accepte les deux tailles que tailleParDefaut retient — dépend de lib/providers.mjs, non porté par TU1', () => {
  const sansReference = corps({ motif: MOTIF_SOL, cadrage: 'surface' });
  assert.equal(sansReference.width, 256);
  assert.equal(sansReference.height, 256);
  const avecReference = corps({ motif: MOTIF_SOL, cadrage: 'surface', reference: REFERENCE, denoise: 0.55 });
  assert.equal(avecReference.width, 512);
  assert.equal(avecReference.height, 512);
});
