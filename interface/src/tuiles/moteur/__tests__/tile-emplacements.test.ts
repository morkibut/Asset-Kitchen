// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const { EMPLACEMENTS, emplacementsActifs, creerEtat, poserMatiere, poserImage, vider, relier, rafraichirMatieres, texturesDe } = await import('../tile-emplacements.js');
const { rendreMatiere } = await import('../tile-materials.js');

const TAILLE = 32, GRAINE = 31415;
const empreinte = (image) => (image ? createHash('sha256').update(Buffer.from(image.data.buffer)).digest('hex') : null);
const faussImage = (n = 8) => ({ data: new Uint8ClampedArray(n * n * 4).fill(n), width: n, height: n });

test('L’ESSAI QUI COMPTE — une bordure liée reçoit le CONTOUR de la matière, jamais sa surface', () => {
  // L'invariant de la tranche. `rendreMatiere` rend deux images d'un seul tenant parce
  // que le moteur les reçoit ensemble comme les deux bouts d'une rampe : la surface, et
  // le contour que le bord de la tuile assombrit. Si la bordure recevait la surface, le
  // dégradé de bord disparaîtrait — et c'est exactement ce que l'ancien panneau laissait
  // faire, puisqu'il fallait choisir la matière deux fois, dans deux listes séparées.
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  const attendu = rendreMatiere('pierre', TAILLE, GRAINE);
  assert.equal(empreinte(etat.surface.image), empreinte(attendu.surface), 'la surface doit porter la surface');
  assert.equal(empreinte(etat.bordure.image), empreinte(attendu.contour), 'la bordure doit porter le contour');
  assert.notEqual(empreinte(attendu.surface), empreinte(attendu.contour), 'les deux images sont bien distinctes');
  // Et les deux disent la même matière : c'est ce qui rend le lien lisible à l'écran.
  assert.equal(etat.bordure.matiere, 'pierre');
  assert.equal(etat.bordure.nom, 'Dalles de pierre');
});

test('poser sur une bordure encore liée agit sur la paire — le lien vaut dans les deux sens', () => {
  // Sinon le clic mentirait : on poserait « herbe » sur la bordure en voyant la surface
  // rester en pierre, alors que l'icône de lien affirme qu'elles vont ensemble.
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  poserMatiere(etat, 'bordure', 'herbe', TAILLE, GRAINE);
  const herbe = rendreMatiere('herbe', TAILLE, GRAINE);
  assert.equal(etat.surface.matiere, 'herbe');
  assert.equal(empreinte(etat.surface.image), empreinte(herbe.surface));
  assert.equal(empreinte(etat.bordure.image), empreinte(herbe.contour));
});

test('lien rompu : la bordure garde sa matière quand la surface change, et la retrouve si on relie', () => {
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  relier(etat, 'bordure', false, TAILLE, GRAINE);
  poserMatiere(etat, 'bordure', 'lave', TAILLE, GRAINE);
  assert.equal(etat.surface.matiere, 'pierre', 'la surface ne doit plus bouger');
  assert.equal(etat.bordure.matiere, 'lave');
  poserMatiere(etat, 'surface', 'neige', TAILLE, GRAINE);
  assert.equal(etat.bordure.matiere, 'lave', 'une bordure déliée ne suit pas');
  // Rétablir le lien la recolle tout de suite : un lien qui n'agirait qu'au changement
  // suivant laisserait à l'écran une paire visiblement dépareillée.
  relier(etat, 'bordure', true, TAILLE, GRAINE);
  assert.equal(etat.bordure.matiere, 'neige');
  assert.equal(empreinte(etat.bordure.image), empreinte(rendreMatiere('neige', TAILLE, GRAINE).contour));
});

test('une image posée à la main ou par l’IA rompt le lien — elle ne peut plus suivre une matière absente', () => {
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  assert.equal(etat.bordure.lie, true);
  poserImage(etat, 'surface', faussImage(), 'granit.png');
  assert.equal(etat.surface.source, 'import');
  assert.equal(etat.surface.nom, 'granit.png');
  assert.equal(etat.bordure.lie, false, 'le lien doit tomber, pas rester affiché pour rien');
  // La bordure garde ce qu'elle avait : on ne détruit pas silencieusement un réglage.
  assert.equal(etat.bordure.matiere, 'pierre');
  // Une image posée directement sur une bordure la délie aussi.
  const autre = creerEtat();
  poserImage(autre, 'bordure', faussImage(), 'bord.png', 'ia');
  assert.equal(autre.bordure.lie, false);
  assert.equal(autre.bordure.source, 'ia');
});

test('T34 — poser une texture de la bibliothèque du projet (source « biblio ») rompt le lien et garde le nom', () => {
  // La bibliothèque de matières (public/tools.js) pose les textures du projet par ce même
  // chemin — poserImage — avec la source 'biblio', étiquetée « BIBLIOTHÈQUE » à l'écran.
  // Rien de spécifique à coder dans ce module : la source est un simple paramètre, déjà
  // générique depuis T14/T20 (voir le cas 'ia' ci-dessus) — cet essai fixe le contrat pour
  // 'biblio' précisément, plutôt que de le laisser reposer sur une généralisation implicite.
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  assert.equal(etat.bordure.lie, true);
  const texture = faussImage(16);
  poserImage(etat, 'surface', texture, 'pavage-donjon.png', 'biblio');
  assert.equal(etat.surface.source, 'biblio');
  assert.equal(etat.surface.nom, 'pavage-donjon.png');
  assert.equal(empreinte(etat.surface.image), empreinte(texture));
  assert.equal(etat.bordure.lie, false, 'le lien tombe, comme pour un import');
  assert.equal(etat.bordure.matiere, 'pierre', 'la bordure garde ce qu’elle avait');
  // Posée directement sur une bordure déliée, la source et le nom voyagent pareillement.
  const autre = creerEtat();
  poserImage(autre, 'bordure', faussImage(8), 'bord-mixe.png', 'biblio');
  assert.equal(autre.bordure.source, 'biblio');
  assert.equal(autre.bordure.nom, 'bord-mixe.png');
  assert.equal(autre.bordure.lie, false);
});

test('vider emporte la bordure liée, et seulement elle', () => {
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  poserMatiere(etat, 'bas', 'sable', TAILLE, GRAINE);
  vider(etat, 'surface');
  assert.equal(etat.surface.source, 'vide');
  assert.equal(etat.bordure.source, 'vide', 'la bordure liée suit');
  assert.equal(etat.bas.source, 'matiere', 'l’autre paire n’a pas bougé');
  assert.equal(etat.bordureBas.source, 'matiere');
  // Une bordure déliée survit à la disparition de sa surface.
  relier(etat, 'bordureBas', false, TAILLE, GRAINE);
  vider(etat, 'bas');
  assert.equal(etat.bas.source, 'vide');
  assert.equal(etat.bordureBas.source, 'matiere', 'une bordure déliée ne se vide pas avec sa surface');
});

test('changer de taille ou de graine re-rend les matières, et ne touche pas aux images importées', () => {
  // Pas une optimisation : la période d'une texture doit valoir la taille de la tuile,
  // donc une matière rendue en 32 px ne peut pas servir à une tuile de 64. Les images
  // importées ne bougent pas — c'est le moteur qui les ramène à la bonne taille.
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  const importee = faussImage();
  poserImage(etat, 'face', importee, 'mur.png');
  const avant = empreinte(etat.surface.image);

  rafraichirMatieres(etat, TAILLE, GRAINE);
  assert.equal(empreinte(etat.surface.image), avant, 'rien n’a bougé : aucun nouveau rendu');

  rafraichirMatieres(etat, 64, GRAINE);
  assert.equal(etat.surface.image.width, 64);
  assert.equal(etat.bordure.image.width, 64, 'la bordure suit la taille, elle aussi');
  assert.equal(empreinte(etat.surface.image), empreinte(rendreMatiere('pierre', 64, GRAINE).surface));
  assert.equal(empreinte(etat.face.image), empreinte(importee), 'une image importée reste telle quelle');

  rafraichirMatieres(etat, 64, 7);
  assert.equal(empreinte(etat.surface.image), empreinte(rendreMatiere('pierre', 64, 7).surface), 'la graine aussi');
});

test('la disposition dit quels emplacements existent', () => {
  const ids = (mode, second) => emplacementsActifs(mode, second).map((e) => e.id);
  assert.deepEqual(ids({ wall: false }, false), ['surface', 'bordure']);
  assert.deepEqual(ids({ wall: false }, true), ['surface', 'bordure', 'bas', 'bordureBas']);
  assert.deepEqual(ids({ wall: true }, false), ['surface', 'bordure', 'face']);
  assert.deepEqual(ids({ wall: true }, true), ['surface', 'bordure', 'face', 'bas', 'bordureBas']);
  // La face n'existe que sur un mur : c'est la seule matière qui se regarde de face,
  // et la proposer ailleurs demanderait une image qu'aucun rendu n'irait chercher.
  assert.ok(!ids({ wall: false }, true).includes('face'));
});

test('texturesDe nomme les images comme le moteur les nomme', () => {
  const etat = creerEtat();
  poserMatiere(etat, 'surface', 'pierre', TAILLE, GRAINE);
  poserMatiere(etat, 'bas', 'sable', TAILLE, GRAINE);
  poserImage(etat, 'face', faussImage(), 'mur.png');
  const t = texturesDe(etat);
  assert.deepEqual(Object.keys(t).sort(), ['edgeTexture', 'faceTexture', 'lowerEdgeTexture', 'lowerSurfaceTexture', 'surfaceTexture']);
  assert.equal(empreinte(t.surfaceTexture), empreinte(rendreMatiere('pierre', TAILLE, GRAINE).surface));
  assert.equal(empreinte(t.edgeTexture), empreinte(rendreMatiere('pierre', TAILLE, GRAINE).contour));
  assert.equal(empreinte(t.lowerEdgeTexture), empreinte(rendreMatiere('sable', TAILLE, GRAINE).contour));
  assert.equal(t.faceTexture.width, 8);
  // Un état neuf ne porte que des nulls : le moteur retombe alors sur les deux couleurs.
  assert.deepEqual(Object.values(texturesDe(creerEtat())), [null, null, null, null, null]);
});

test('un emplacement ou une matière inconnus se signalent au lieu de passer inaperçus', () => {
  const etat = creerEtat();
  assert.throws(() => poserMatiere(etat, 'pas-un-emplacement', 'pierre', TAILLE, GRAINE), /Emplacement inconnu/);
  assert.throws(() => poserMatiere(etat, 'surface', 'pas-une-matiere', TAILLE, GRAINE), /Matière inconnue/);
  assert.throws(() => poserImage(etat, 'surface', null), /Image invalide/);
  assert.throws(() => relier(etat, 'surface', true, TAILLE, GRAINE), /ne porte pas de lien/);
  // Et la liste des emplacements reste cohérente avec elle-même.
  for (const e of EMPLACEMENTS) {
    if (e.bordure) assert.equal(EMPLACEMENTS.find((x) => x.id === e.bordure).suit, e.id, `${e.id} et ${e.bordure} doivent se désigner l’un l’autre`);
    if (e.suit) assert.equal(EMPLACEMENTS.find((x) => x.id === e.suit).bordure, e.id);
  }
});
