/* Rendu local de la maquette : les équipements de démonstration sont dessinés ici.
 * Aucun modèle, fournisseur ou service de génération n'est appelé.
 */
(() => {
  'use strict';

  window.creerRenduEquipements = function creerRenduEquipements(api) {
    const TAILLE = 64;
    const images = new Map();
    const rendusEnCours = new WeakMap();
    const borner = (valeur, min, max) => Math.max(min, Math.min(max, valeur));
    const nombre = (valeur, defaut) => Number.isFinite(Number(valeur)) ? Number(valeur) : defaut;

    function toile(largeur = TAILLE, hauteur = TAILLE) {
      const element = document.createElement('canvas');
      element.width = largeur;
      element.height = hauteur;
      element.getContext('2d').imageSmoothingEnabled = false;
      return element;
    }

    function charger(url) {
      if (!url) return Promise.resolve(null);
      if (!images.has(url)) {
        images.set(url, new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => {
            images.delete(url);
            reject(new Error('Impossible de lire une image du calque.'));
          };
          image.src = url;
        }));
      }
      return images.get(url);
    }

    async function baseDe(resultat, index) {
      const base = toile();
      if (!resultat?.frames?.length) return base;
      const position = borner(Math.floor(nombre(index, 0)), 0, resultat.frames.length - 1);
      const frame = resultat.frames[position];
      // Le premier dessin ouvre le cache privé de drawFrame. Nos lectures attendent
      // ensuite les mêmes images, puis le second dessin dispose des pixels chargés.
      api.drawFrame(base, resultat, position);
      const source = frame.image || resultat.image ||
        (resultat.animated || resultat.sourceAnimation ? 'marche-demo.png' : '../../interface/public/vignettes/taille-64.png');
      const sources = [source, ...(resultat.layers || []).filter(calque => calque.image).map(calque => calque.image)];
      await Promise.all([...new Set(sources)].map(charger));
      api.drawFrame(base, resultat, position);
      return base;
    }

    function couleur(contexte, valeur, rectangles) {
      contexte.fillStyle = valeur;
      rectangles.forEach(([x, y, largeur, hauteur]) => contexte.fillRect(x, y, largeur, hauteur));
    }

    function dessinerCasque(contexte, dos) {
      couleur(contexte, '#292b31', [[22, 2, 19, 4], [18, 6, 27, 13], [20, 19, 23, 4], [18, 15, 4, 13], [40, 15, 4, 13]]);
      couleur(contexte, '#9da9af', [[23, 4, 16, 3], [20, 7, 22, 10], [23, 17, 16, 3], [19, 17, 3, 8], [40, 17, 3, 8]]);
      couleur(contexte, '#d8ded7', [[24, 5, 13, 2], [22, 8, 3, 7], [26, 8, 3, 4]]);
      couleur(contexte, '#60717e', [[35, 7, 6, 10], [25, 16, 15, 3], [20, 24, 2, 3], [40, 24, 2, 3]]);
      couleur(contexte, '#d0aa4d', [[29, 3, 4, 17], [20, 16, 22, 2]]);
      if (!dos) {
        couleur(contexte, '#292b31', [[24, 13, 5, 3], [34, 13, 5, 3], [30, 18, 3, 8]]);
        couleur(contexte, '#d8ded7', [[30, 18, 2, 6]]);
      }
    }

    function dessinerSac(contexte, dos) {
      const x = dos ? 22 : 13;
      couleur(contexte, '#392d24', [[x + 3, 22, 13, 3], [x, 25, 20, 23], [x + 3, 48, 14, 3], [x + 1, 19, 18, 6]]);
      couleur(contexte, '#b6783e', [[x + 2, 26, 16, 21], [x + 3, 20, 14, 4]]);
      couleur(contexte, '#d4a05a', [[x + 3, 26, 13, 6], [x + 3, 34, 5, 9], [x + 4, 20, 3, 4]]);
      couleur(contexte, '#6e4b31', [[x + 14, 32, 4, 15], [x + 2, 32, 16, 3], [x + 8, 22, 3, 25]]);
      couleur(contexte, '#e4c56c', [[x + 7, 34, 5, 5]]);
      couleur(contexte, '#392d24', [[x + 8, 35, 3, 2]]);
      couleur(contexte, '#59634e', [[x - 1, 24, 3, 20], [x + 18, 24, 3, 20]]);
    }

    function dessinerArme(contexte) {
      couleur(contexte, '#303740', [[49, 12, 2, 4], [47, 16, 6, 25], [45, 41, 10, 3], [48, 44, 4, 13], [47, 57, 6, 3]]);
      couleur(contexte, '#e1e4d7', [[49, 16, 2, 3], [48, 19, 3, 20]]);
      couleur(contexte, '#8babb8', [[51, 19, 1, 20], [49, 39, 2, 2]]);
      couleur(contexte, '#d5b45a', [[44, 41, 12, 2], [49, 44, 2, 2], [48, 57, 4, 2]]);
      couleur(contexte, '#875448', [[49, 46, 2, 10]]);
      couleur(contexte, '#68b7ba', [[48, 42, 4, 2]]);
    }

    function dessinerAutre(contexte) {
      couleur(contexte, '#433240', [[39, 26, 11, 3], [37, 29, 15, 14], [39, 43, 11, 3]]);
      couleur(contexte, '#a95965', [[39, 29, 11, 13]]);
      couleur(contexte, '#dc9c88', [[40, 30, 4, 9]]);
      couleur(contexte, '#d4b16b', [[42, 28, 4, 16], [38, 34, 13, 3]]);
    }

    /** PNG64 : corps, variante dessinée pour la démo, équipement transparent. */
    async function generate(baseResult, index, kind, direction) {
      const base = await baseDe(baseResult, index);
      const overlay = toile();
      const contexte = overlay.getContext('2d');
      const nom = String(kind || '').toLocaleLowerCase('fr');
      const vue = String(direction || '').toLocaleLowerCase('fr');
      const dos = vue.includes('nord') || vue.includes('dos');
      const gauche = vue.includes('ouest') || vue.includes('gauche');
      contexte.save();
      if (gauche) {
        contexte.translate(TAILLE, 0);
        contexte.scale(-1, 1);
      }
      const mouvement = baseResult?.animated ? [0, 1, 0, -1, 0][Math.abs(Math.floor(nombre(index, 0))) % 5] : 0;
      contexte.translate(0, mouvement);
      if (nom.includes('casque')) dessinerCasque(contexte, dos);
      else if (nom.includes('sac')) dessinerSac(contexte, dos);
      else if (nom.includes('arme') || nom.includes('épée') || nom.includes('epee')) dessinerArme(contexte);
      else dessinerAutre(contexte);
      contexte.restore();
      const source = toile();
      source.getContext('2d').drawImage(base, 0, 0);
      source.getContext('2d').drawImage(overlay, 0, 0);
      return {base: base.toDataURL('image/png'), source: source.toDataURL('image/png'), overlay: overlay.toDataURL('image/png')};
    }

    // Une restauration retire le dernier masque sur sa zone : les pixels originaux
    // sont toujours présents dans la source, jamais repeints à partir d'une couleur.
    function masqueDe(traits = []) {
      const masque = toile();
      const contexte = masque.getContext('2d');
      contexte.fillStyle = '#000';
      traits.forEach(trait => {
        const taille = borner(nombre(trait.size, 1), 1, TAILLE * 2);
        contexte.globalCompositeOperation = trait.restore ? 'destination-out' : 'source-over';
        contexte.fillRect(Math.round(nombre(trait.x, 0) - taille / 2), Math.round(nombre(trait.y, 0) - taille / 2), Math.ceil(taille), Math.ceil(taille));
      });
      return masque;
    }

    async function imageDe(calque) {
      const image = await charger(calque.image);
      const resultat = toile();
      if (!image) return resultat;
      const contexte = resultat.getContext('2d');
      contexte.drawImage(image, 0, 0, TAILLE, TAILLE);
      if (calque.erase?.length) {
        contexte.globalCompositeOperation = 'destination-out';
        contexte.drawImage(masqueDe(calque.erase), 0, 0);
        contexte.globalCompositeOperation = 'source-over';
      }
      return resultat;
    }

    function poser(contexte, image, calque) {
      const echelle = borner(nombre(calque.scale, 1), .01, 20);
      contexte.save();
      contexte.globalAlpha = borner(nombre(calque.opacity, 100) / 100, 0, 1);
      contexte.translate(32 + nombre(calque.x, 0), 32 + nombre(calque.y, 0));
      contexte.rotate(nombre(calque.rotation, 0) * Math.PI / 180);
      contexte.scale(echelle, echelle);
      contexte.drawImage(image, -32, -32);
      contexte.restore();
    }

    /**
     * Les coordonnées et l'échelle sont celles d'une case64. x/y déplacent le
     * calque ; rotation tourne autour du centre32 ; opacity est un pourcentage.
     * erase agit sur l'image locale AVANT transformation ; mask efface le corps
     * dans la case64, indépendamment du déplacement du calque. Un calque masqué
     * par hidden=true ne dessine ni son image ni son masque de corps.
     * Le zoom et le déplacement de la vue restent à la charge de l'écran.
     */
    async function paint(canvas, baseResult, index, layers = [], options = {}) {
      if (!canvas) return canvas;
      const passage = {};
      rendusEnCours.set(canvas, passage);
      const visibles = layers.filter(calque => calque && !calque.hidden)
        .map((calque, rang) => ({calque, rang}))
        .sort((a, b) => nombre(a.calque.order, 0) - nombre(b.calque.order, 0) || a.rang - b.rang);
      const [base, rendus] = await Promise.all([
        options.baseVisible === false || options.onlyLayers ? Promise.resolve(toile()) : baseDe(baseResult, index),
        Promise.all(visibles.map(async ({calque}) => ({calque, image: await imageDe(calque)})))
      ]);
      // Une image lente d'une ancienne frame ne doit pas remplacer la courante.
      if (rendusEnCours.get(canvas) !== passage) return canvas;
      const corps = base.getContext('2d');
      corps.globalCompositeOperation = 'destination-out';
      visibles.forEach(({calque}) => {
        if (!calque.mask?.length) return;
        corps.globalAlpha = borner(nombre(calque.opacity, 100) / 100, 0, 1);
        corps.drawImage(masqueDe(calque.mask), 0, 0);
      });
      corps.globalAlpha = 1;
      corps.globalCompositeOperation = 'source-over';
      const composition = toile();
      const contexte = composition.getContext('2d');
      rendus.filter(({calque}) => calque.front === false).forEach(({calque, image}) => poser(contexte, image, calque));
      contexte.drawImage(base, 0, 0);
      rendus.filter(({calque}) => calque.front !== false).forEach(({calque, image}) => poser(contexte, image, calque));
      const destination = canvas.getContext('2d');
      destination.save();
      destination.setTransform(1, 0, 0, 1, 0, 0);
      destination.clearRect(0, 0, canvas.width, canvas.height);
      destination.imageSmoothingEnabled = false;
      destination.drawImage(composition, 0, 0, canvas.width, canvas.height);
      destination.restore();
      return canvas;
    }

    /**
     * Différence locale simple pour la démo. Les pixels ajoutés ou substitués
     * proviennent de la variante ; un pixel devenu transparent ne peut masquer
     * le corps : le pinceau de masque traite explicitement cette substitution.
     */
    async function extract(baseURL, sourceURL) {
      const [base, source] = await Promise.all([charger(baseURL), charger(sourceURL)]);
      if (!base || !source) throw new Error('Choisissez une base et une variante avant d’extraire.');
      if (base.naturalWidth !== source.naturalWidth || base.naturalHeight !== source.naturalHeight) {
        throw new Error('La base et la variante doivent avoir la même taille avant extraction.');
      }
      const resultat = toile(source.naturalWidth, source.naturalHeight);
      const comparaison = toile(base.naturalWidth, base.naturalHeight);
      const contexte = resultat.getContext('2d');
      contexte.drawImage(source, 0, 0);
      comparaison.getContext('2d').drawImage(base, 0, 0);
      const pixels = contexte.getImageData(0, 0, resultat.width, resultat.height);
      const origine = comparaison.getContext('2d').getImageData(0, 0, resultat.width, resultat.height).data;
      for (let i = 0; i < pixels.data.length; i += 4) {
        const alphaDifferent = Math.abs(pixels.data[i + 3] - origine[i + 3]) > 12;
        const couleurDifferente = Math.max(...[0, 1, 2].map(canal => Math.abs(pixels.data[i + canal] - origine[i + canal]))) > 18;
        if (!pixels.data[i + 3] || (!alphaDifferent && !couleurDifferente)) {
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = pixels.data[i + 3] = 0;
        }
      }
      contexte.putImageData(pixels, 0, 0);
      return resultat.toDataURL('image/png');
    }

    async function exportPNG(baseResult, index, layers = [], options = {}) {
      const canvas = toile();
      await paint(canvas, baseResult, index, layers, options);
      return canvas.toDataURL('image/png');
    }

    return {generate, paint, extract, exportPNG};
  };
})();
