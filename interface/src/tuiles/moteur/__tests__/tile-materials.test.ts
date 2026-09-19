// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {MATIERES,LISTE_MATIERES,rendreMatiere,couleurMoyenne,periode}=await import('../tile-materials.js');

const TAILLES=[16,32,64];
const ids=LISTE_MATIERES.map(m=>m.id);

test('chaque matière rend deux images opaques à la taille demandée', () => {
  for(const id of ids)for(const taille of TAILLES){
    const {surface,contour}=rendreMatiere(id,taille,31415);
    for(const [nom,image] of [['surface',surface],['contour',contour]]){
      assert.equal(image.width,taille,`${id} · ${nom} · ${taille}px : largeur`);
      assert.equal(image.height,taille,`${id} · ${nom} · ${taille}px : hauteur`);
      assert.equal(image.data.length,taille*taille*4,`${id} · ${nom} · ${taille}px : longueur du tableau`);
      for(let i=3;i<image.data.length;i+=4)
        assert.equal(image.data[i],255,`${id} · ${nom} : un pixel translucide — une matière est un aplat plein, la silhouette vient du masque`);
    }
  }
});

test('L’ESSAI QUI COMPTE — toute période de motif divise la taille de la texture', () => {
  // L'invariant du pipeline : la période d'une texture DOIT valoir la taille de
  // tuile, donc toute période interne doit la diviser (voir « L'invariant de
  // l'estampage » dans public/vendor/tileset-engine.js). Une brique large de 6 px
  // sur une tuile de 32 se coupe au bord, et la tuile d'à côté repart de travers.
  //
  // Pourquoi on l'éprouve ICI, sur la fonction, et pas à l'œil sur la texture.
  // Un décalage d'une seule nuance est parfaitement invisible dans le grain d'une
  // matière : mesuré sur quarante graines et treize matières, un essai statistique
  // de couture ne le distingue pas du contraste normal — les rides du sable
  // (période 6 sur 32) passaient au travers sans faire sourciller aucun seuil.
  // C'est le raisonnement qui les a trouvées, pas la mesure. On éprouve donc le
  // passage obligé par lequel toutes les matières prennent leur période, et la
  // faute cesse d'être détectable parce qu'elle devient impossible à écrire.
  for(const size of [16,32,64,48,100]){
    for(const cible of [1,2,3,5.5,7,size/8,size/5,size/4,size/2,size,size*2]){
      for(const mini of [2,4,8]){
        const p=periode(size,cible,mini);
        assert.equal(size%p,0,`periode(${size}, ${cible}, ${mini}) = ${p} ne divise pas ${size}`);
        assert.ok(p>=Math.min(mini,size),`periode(${size}, ${cible}, ${mini}) = ${p} passe sous le plancher`);
      }
    }
  }
  // Et le plus grand qui convienne, pas n'importe lequel : une période trop petite
  // hacherait le motif.
  assert.equal(periode(32,16,2),16);
  assert.equal(periode(32,6.4,2),4);
  assert.equal(periode(64,12.8,4),8);
});

test('le raccord d’une matière ne saute pas aux yeux — garde-fou statistique', () => {
  // Le filet de sécurité de l'essai précédent, pas sa preuve. Ce qu'il attrape :
  // un rebouclage franchement absent. Ce qu'il ne peut pas attraper : un décalage
  // d'une nuance. Les deux limites sont mesurées, pas supposées.
  //
  // Le protocole : pour chaque paire de colonnes voisines on calcule l'écart moyen,
  // couture comprise (dernière colonne, première). Si la matière reboucle, la
  // couture n'a rien de particulier et ne devrait dépasser le plus grand écart
  // intérieur qu'au hasard.
  //
  // Mesuré sur trente graines, treize matières, en 16 et 32 px, contre une version
  // du module dont on avait retiré tous les rebouclages :
  //   · matières correctes  — la couture arrive première dans 0 à 15 % des tirages ;
  //   · matières sans wrap  — 12 à 90 %, le plus souvent au-delà de 40 %.
  // D'où le seuil à 30 %. Les deux familles se chevauchent sur un seul cas, la
  // lave en 16 px (15 % contre 13 %) : trois cellules de voronoï sur seize pixels
  // et une palette du noir au jaune y rendent la mesure aveugle. C'est assumé —
  // les briques et le carrelage sont dans le même cas, leur raccord étant purement
  // structurel, et c'est l'essai de période ci-dessus qui en répond.
  const ecart=(image,a,b,axe)=>{
    let somme=0;
    for(let k=0;k<image.width;k+=1){
      const i=(axe==='x'?(k*image.width+a):(a*image.width+k))*4;
      const j=(axe==='x'?(k*image.width+b):(b*image.width+k))*4;
      somme+=Math.abs(image.data[i]-image.data[j])+Math.abs(image.data[i+1]-image.data[j+1])+Math.abs(image.data[i+2]-image.data[j+2]);
    }
    return somme/image.width;
  };
  const GRAINES=[31415,7,2718,161803,99999,271,1729,5040,42,6763,88817,123457];
  for(const id of ids)for(const taille of [16,32]){
    let suspectes=0;
    for(const graine of GRAINES){
      const {surface}=rendreMatiere(id,taille,graine);
      for(const axe of ['x','y']){
        const interieurs=[];
        for(let k=0;k<taille-1;k+=1)interieurs.push(ecart(surface,k,k+1,axe));
        if(ecart(surface,taille-1,0,axe)>Math.max(...interieurs))suspectes++;
      }
    }
    const tirages=GRAINES.length*2;
    assert.ok(suspectes/tirages<=0.3,`${id} · ${taille}px : la couture sort du lot dans ${suspectes} tirages sur ${tirages} — la matière ne reboucle pas`);
  }
});

test('une matière n’emploie que les couleurs de sa palette — c’est ce qui la fait lire en pixel art', () => {
  for(const id of ids){
    const {surface}=rendreMatiere(id,32,7);
    const permises=new Set(MATIERES[id].palette.map(h=>h.toLowerCase()));
    const vues=new Set();
    for(let i=0;i<surface.data.length;i+=4)
      vues.add('#'+[surface.data[i],surface.data[i+1],surface.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
    for(const couleur of vues)
      assert.ok(permises.has(couleur),`${id} : ${couleur} n’est pas dans la palette déclarée`);
    // Et elle en emploie plusieurs : une matière d'une seule couleur serait un aplat.
    assert.ok(vues.size>=3,`${id} : ${vues.size} couleur(s) seulement`);
  }
});

test('le contour est plus sombre que la surface, partout, sans jamais devenir un aplat', () => {
  // Les deux moitiés de la règle. Plus sombre : c'est ce que le moteur attend du
  // second bout de la rampe. Pas un aplat : c'est la raison d'être du contour —
  // un contour uni ferait disparaître les joints d'une pierre au moment précis
  // où le bord les assombrit, donc là où l'œil les cherche.
  const luminance=(d,i)=>d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11;
  for(const id of ids){
    const {surface,contour}=rendreMatiere(id,32,31415);
    const distinctes=new Set();
    for(let i=0;i<surface.data.length;i+=4){
      assert.ok(luminance(contour.data,i)<=luminance(surface.data,i)+0.5,`${id} : un pixel de contour plus clair que sa surface`);
      distinctes.add(contour.data[i]<<16|contour.data[i+1]<<8|contour.data[i+2]);
    }
    assert.ok(distinctes.size>=3,`${id} : le contour n’a que ${distinctes.size} couleur(s) — il a perdu la structure de la matière`);
  }
});

test('une matière est déterministe, et la graine la fait vraiment changer', () => {
  const empreinte=image=>createHash('sha256').update(Buffer.from(image.data.buffer)).digest('hex');
  for(const id of ids){
    assert.equal(empreinte(rendreMatiere(id,32,31415).surface),empreinte(rendreMatiere(id,32,31415).surface),`${id} : deux rendus identiques attendus`);
    assert.notEqual(empreinte(rendreMatiere(id,32,31415).surface),empreinte(rendreMatiere(id,32,271).surface),`${id} : la graine ne change rien`);
  }
});

test('couleurMoyenne tombe dans l’enveloppe de la palette', () => {
  for(const id of ids){
    const moyenne=couleurMoyenne(id);
    const canaux=MATIERES[id].palette.map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]);
    ['r','g','b'].forEach((canal,k)=>{
      const valeurs=canaux.map(c=>c[k]);
      assert.ok(moyenne[canal]>=Math.min(...valeurs)&&moyenne[canal]<=Math.max(...valeurs),`${id} : ${canal} hors de la palette`);
    });
  }
});

test('une matière inconnue se signale au lieu de rendre du noir', () => {
  assert.throws(()=>rendreMatiere('pas-une-matiere',32,1),/Matière inconnue/);
});
