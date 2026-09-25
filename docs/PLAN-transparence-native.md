# Plan : la transparence native — le modèle rend le fond vide, l'atelier ne détoure plus par défaut

> **Ouvert le 22 septembre 2026, à la demande de l'auteur**, juste après l'arrivée de Qwen-Image 2.1
> comme moteur local principal (`docs/modeles-et-workflows.md` § Qwen-Image 2.1). L'auteur a
> choisi « plan d'abord » : rien n'est codé tant que ce plan n'est pas validé.
> **Validé par l'auteur le 25 septembre 2026** : les six tranches se codent en autopilote.
>
> **Ce chantier ne dépense rien.** Qwen-Image 2.1 tourne sur la machine. Aucune tranche n'appelle
> un modèle payé.
>
> Quel modèle sur quelle tranche : [`PLAN-transparence-native-affectation.md`](PLAN-transparence-native-affectation.md).

---

## Ce que c'est, en une phrase

**Quand le modèle sait rendre un fond vide, on le lui demande, et le détourage devient un filet de
secours au lieu d'une étape.**

## Ce que c'est, en trois gestes

1. On fabrique un personnage avec Qwen-Image 2.1. Le texte envoyé ne parle plus de « fond
   magenta » : il demande une image transparente.
2. L'image arrive avec son fond déjà vide. Sa fiche dit « détourée par le modèle », et l'étape de
   détourage est en sommeil.
3. Si un tirage sort mal (un trou dans le sujet), on réveille le détourage d'un clic, ou on refait
   l'image sur fond coloré.

## Ce que ce n'est pas

- **Pas la suppression du détourage.** Il reste là pour les images importées, les autres modèles
  et les tirages ratés.
- **Pas pour les décors, les tuiles ni les matières.** Ils restent opaques, comme aujourd'hui.
- **Pas pour les planches, pour l'instant** (voir le banc : une robe blanche est sortie trouée).
- **Pas GPT Image.** Son option `background: transparent` existe, mais c'est un appel payé. On ne
  l'ouvre qu'après ce chantier, avec la même capacité.

---

## Pourquoi : le gain n'est pas le temps

Le détourage actuel coûte **0,13 seconde** par image (remplissage depuis les bords, sur le
processeur). Le supprimer ne fait rien gagner qui se voie. Ce qu'on gagne est ailleurs :

- **Plus de trou quand le sujet a la couleur du fond.** Une cape verte sur fond vert se fait
  trouer au détourage : c'est `RV3`, encore ouvert (`PLAN-revue-du-21-septembre.md`). Sans fond
  coloré, le problème n'existe plus.
- **Plus de liseré** de la couleur de fond autour du sujet, ni de reflet sur ses bords.
- **Un texte plus propre.** Un modèle de diffusion peint ce qu'on lui nomme. « Sur fond magenta »
  est une consigne de plus qui peut déborder sur le sujet.

## Le banc du 22 septembre 2026

Huit tirages en mode « Très rapide », 1024 px, sur la machine (18 à 23 s chacun). La consigne
officielle de Qwen encadre le texte : « This is an RGBA format image with transparency. […] The
image has an alpha channel and a transparent background. » Script et images :
`Comfy-Desktop\ComfyUI-Shared\output\banc-rgba\` (`mesures.json`, `controle_*.png`).

| Cas | Fond vide | Pixels à moitié transparents | Ce qu'on a vu |
|---|---|---|---|
| Chevalier vert, cape verte | 76 % | 1,0 % | **intact**, aucun trou — le cas de `RV3` |
| Salamandre, braises et fumée | 91 % | 2,2 % | propre |
| Fiole de verre | 73 % | 2,0 % | propre |
| Bouton d'interface | 64 % | 3,1 % | propre |
| Voleur en pixel art | 62 % | 4,6 % | propre, pixels un peu flous (la réduction les reprend) |
| Coffre en pixel art | 74 % | **12,2 %** | **des débris** sombres à moitié transparents autour du coffre |
| Planche 2 × 2, mage champignon | 76 % | 5,9 % | **la robe blanche est transparente** : 89 % de la zone du corps sous 128 d'alpha |
| Planche de marche, renard | 95 % | 1,3 % | propre |

Et deux constats de plus :

- **Le détourage actuel, passé par-dessus, ne mange rien** : 0 % du sujet perdu sur les huit.
  Sous le fond vide, Qwen laisse une couleur violette (autour de `#A037CD`) ; le remplissage
  depuis les bords la prend pour le fond et s'arrête au sujet.
- **Le style dérive un peu** avec la consigne de transparence : sur deux tirages d'essai du même
  mage, l'un est sorti en rendu 3D. La direction artistique du projet doit rester dans le texte.

---

## Décisions d'architecture

Elles valent pour toutes les tranches.

- **La transparence est une capacité du modèle**, déclarée dans le catalogue comme les images de
  référence (`Modele.transparence`). Aucun `if qwen` ailleurs dans le code. Un profil local la
  déclare dans ses métadonnées de style ; plus tard, GPT Image la déclarera aussi.
- **Elle ne vaut que pour les sujets qu'on détoure déjà** : ceux dont le type porte
  `silhouette=True` au barème (personnage, créature, meuble, objet posé, objet tenu, élément
  d'interface). Décor, tuile et matière restent opaques.
- **Les planches n'en profitent pas encore.** Une planche part sur fond coloré, comme aujourd'hui,
  tant que le banc n'a pas montré huit planches propres sur huit.
- **Le graphe garde toujours l'alpha.** On retire `SplitImageWithAlpha` du graphe Qwen. C'est
  l'atelier qui aplatit l'alpha à l'arrivée quand la transparence n'était pas demandée (l'alpha
  est alors du bruit, de 223 à 255). Un seul graphe, pas de variante.
- **Le détourage n'est jamais supprimé, il s'endort.** Une image née transparente reçoit une
  recette dont la place du détourage dort (`recette.dort(DETOURAGE)`, qui existe déjà). La
  provenance le dit : « détourée par le modèle ». Un clic le réveille.
- **Rien n'est relancé tout seul** (T1). Un tirage raté est signalé ; le refaire sur fond coloré
  est un geste de l'auteur.

---

## Les tranches

### TN1 — Le catalogue sait qui rend la transparence

**Faite le 22 septembre 2026.** `Modele.transparence`, la métadonnée de style, le retrait de
`SplitImageWithAlpha` et `atelier.image.aplatir_alpha` sont en place et testés (20 essais dans
`tests/test_qwen21.py`, suite entière rejouée : 3895 passés). Reste en dehors de cette tranche,
pour TN2 ou plus tard : le badge « fond transparent » dans l'écran des modèles (pas demandé par
les critères ci-dessous, seulement par la phrase d'intention).

**Un garde-fou posé en cours de route, pas prévu au départ.** Une première version aplatissait
l'alpha de *toute* image locale, sans regarder si le modèle déclare la capacité — et cassait
`tests/test_b1.py` : son double distant rend un sujet à fond **vraiment** transparent pour
éprouver le contour, une transparence légitime que rien ne demandait de jeter. Le retrait est
donc gardé par `modele.transparence` : seul un modèle qui déclare la capacité voit son image
aplatie, tout le reste (y compris une vraie transparence d'un autre modèle) traverse l'appel
sans qu'un octet ne change.

**Ce qu'on voit.** Dans la liste des modèles, Qwen-Image 2.1 porte la mention « fond transparent ».

- `Modele.transparence: bool` (défaut faux), sérialisé, relu, montré par `list_models`.
- Métadonnée de style `transparence: true` sur les deux réglages Qwen, lue par
  `FournisseurWorkflowImage.catalogue()`.
- Le graphe Qwen garde l'alpha (retrait de `SplitImageWithAlpha`), et l'arrivée d'une image
  aplatit l'alpha quand la transparence n'a pas été demandée.

**Critères.** Un essai prouve que Qwen déclare la capacité et que les autres modèles ne la
déclarent pas. Un tirage Qwen *sans* demande de transparence arrive opaque (alpha 255 partout).

### TN2 — Le texte envoyé demande un fond vide

**Ce qu'on voit.** Dans « Relire avant l'envoi », la phrase « sur fond magenta » est remplacée par
la consigne de transparence. La couleur de fond et sa phrase interdite ne partent plus.

- Quand le modèle a la capacité, que le sujet est une silhouette et que l'appel n'est pas une
  planche : le texte est encadré par la consigne officielle, et `phrase_de_calage`
  (`atelier/domaine/vue.py`) ne pose plus « single isolated sprite on a flat solid … background ».
- `_fond_de_l_appel` ne choisit plus de couleur, et `fond.interdiction` ne part pas en négatif.
- **Les images de référence** restent posées sur blanc. C'est ce que fait déjà le nœud de Qwen
  pour sa partie « vision », et `LoadImage` jette l'alpha de toute façon.
- La direction artistique du projet reste dans le texte, pour tenir le style (banc : dérive 3D).

**Critères.** Le texte composé pour un personnage Qwen contient la consigne et aucun nom de
couleur de fond. Pour un décor, une planche ou un autre modèle, rien ne change (essais existants
verts).

**Faite le 25 septembre 2026.** Les deux critères sont tenus (`tests/test_tn2_texte.py`, 18 essais
sur un modèle doublé qui déclare la capacité, distant et local). **La règle se décide à un seul
endroit** : `atelier.domaine.transparence.transparence_demandee(capable, silhouette, planche,
fond_impose)`, nourrie par `ServiceGenerations.transparence_de_l_appel`, que la soumission et
l'aperçu (donc « Relire avant l'envoi ») appellent tous deux. **Elle s'enregistre sur la
génération** — `demande["transparence"]: true`, absent sinon, relu par `demandee_par` : c'est ce
que TN3 lira (« demandé »), et ce que la relance et l'arrivée lisent déjà (références sur blanc,
alpha gardé au lieu d'être aplati). Tranché en route : **un fond choisi à la main sur l'écran de
confirmation passe devant** — c'est dès aujourd'hui le geste « refaire sur fond coloré » de TN4 ;
**un texte repris est encadré aussi**, sans jamais redoubler la consigne (il part en général de
l'écran, donc déjà encadré) ; **un sujet sans type est un personnage** et demande le fond vide,
comme la recette de naissance lui donne un détourage ; `POST workflow-image-jobs/prepare` accepte
un `echelle` facultatif, et l'essai TN1 « alpha de bruit → opaque » passe désormais par un décor
(son entrée change, pas ses assertions). La consigne encadre le texte **joint** (distant ou
local), elle n'est pas une ligne de `resoudre` : l'écran la montre dans la section du fond et
dans le texte entier, pas dans les trois parties d'un modèle distant. **Non vu au navigateur.**
Le défaut « les décors reçoivent aussi sprite isolé sur fond coloré » (plus bas) n'est **pas**
réglé par cette règle : un décor ne demande pas la transparence, il part donc comme avant.

### TN3 — Le détourage s'endort pour une image née transparente

**Ce qu'on voit.** La fiche de l'image dit « détourée par le modèle ». L'étape de détourage est
grisée « en sommeil », avec un bouton pour la réveiller.

- À la naissance de l'asset (`recette_de_naissance`), si la génération a demandé la transparence
  et que l'image arrive avec un vrai fond vide, la place du détourage dort.
- La provenance (`assets.py`, « provenance ») gagne une ligne : « détourée par le modèle ».
- **Le nettoyage reste.** Les passes qui suivent le détourage (contour, îlots) tournent toujours.
  Elles doivent effacer les débris du coffre en pixel art. À vérifier au banc, et sinon ajouter
  un seuil tout-ou-rien de l'alpha pour le pixel art.

**Critères.** Sur le banc rejoué par l'atelier, les six sujets isolés arrivent sans détourage
actif et sans débris visibles sur damier. Réveiller le détourage d'une image redonne le résultat
d'aujourd'hui.

- [x] Les six sujets isolés arrivent sans détourage actif et sans débris (mesuré sur les images du
  banc, pas rejoué par un vrai ComfyUI — c'est TN6).
- [x] Réveiller le détourage redonne le résultat d'aujourd'hui, au pixel près.

**Faite le 25 septembre 2026.** *La mesure, en une phrase et sans chiffre* : un vrai fond vide,
c'est un cadre d'image transparent autour d'un sujet franchement opaque ; une image opaque, ou
dont l'alpha n'est qu'un voile presque plein, n'a pas de cadre transparent.
(`atelier.image.traitement.fond_vide`, lue sur le brut.) **Chiffres du banc** : 100 % du cadre
sous 16 d'alpha sur les huit tirages, 0 % sur une image opaque comme sur un alpha de bruit ; seuil
posé à trois quarts du cadre, plus 1 % d'image opaque (le plus petit sujet en a 4 %).
**Ce que le banc a appris en route** : le fond « vide » de Qwen n'est pas à zéro — un **voile
d'alpha de 1 à 15** couvre 30 à 50 % de l'image. Endormir le détourage sans rien d'autre gardait
l'image entière (le recadrage prenait le voile pour du sujet) et la grille la réduisait tout
entière au lieu de la mettre en case. D'où `Recette.fond_du_modele`, posé à la naissance à côté
de la veille : l'image a une silhouette (`a_une_silhouette` : case et lit de couleur), et son
alpha se finit à la place du détourage (`seuil_du_fond_du_modele`) — le voile tombe sous 16 en
dessin, la fumée de la salamandre garde son alpha. **Les débris du coffre** : le nettoyage
(contour, îlots) n'est pas posé par défaut, il ne pouvait pas les effacer — et le détourage
d'aujourd'hui les durcissait à 128, donc **noirs et opaques** autour du coffre. Tranché : avec
une grille éveillée, l'alpha du modèle se durcit **tout ou rien à 240** (aucun pixel coloré d'un
sujet en pixel art n'est entre 128 et 240 ; à 250 le coffre perd son trait) : plus aucun débris
visible, le voleur ne change pas à l'œil. Autres décisions : `fond_du_modele` est un fait de
l'image — relu sur l'asset par `_places_de` et `poser_recette`, ignoré dans une charge, retiré
par `voyage` (qui réveille alors le détourage) ; écrit seulement quand il est vrai (aucune
empreinte d'avant ne bouge) ; « demandé mais reçu opaque » garde le détourage éveillé et la fiche
ne dit rien. La fiche porte « Détourée par le modèle » avec l'`Interrupteur` des tables de la
retouche, et la ligne « Découpe du contour » dit « en sommeil — détourée par le modèle ». Essais :
`tests/test_tn3_detourage_endormi.py` (35, sur six images du banc ramenées à 192 px dans
`tests/fixtures/banc_tn3/`), `interface/src/composants/Fiche.tn3.test.tsx` (5). **Non vu au
navigateur.** Reste : les autres lecteurs de `passes_vives` (découpe d'une planche, calques,
superposition, bande) traitent encore une image née transparente comme non détourée — sans effet
tant que les planches n'ont pas la transparence (TN6).

### TN4 — Un trou dans le sujet se voit à l'arrivée

**Ce qu'on voit.** Si le modèle a rendu une partie du sujet transparente (la robe du mage), la
fiche le dit : « une partie du sujet est sortie transparente », avec « Refaire sur fond coloré ».

- Mesure sur la machine, sans modèle : la surface transparente **enfermée** dans le sujet (non
  reliée au bord), rapportée à la surface du sujet. Au-delà d'un seuil calé sur le banc, l'image
  est signalée.
- « Refaire sur fond coloré » relance la même demande sans la transparence. C'est un geste, jamais
  automatique.

**Critères.** La planche du mage est signalée. Les sept autres tirages du banc ne le sont pas
(l'espace entre un bras et le corps ne doit pas suffire).

### TN5 — L'agent fait pareil

**Ce qu'on voit.** Rien de neuf à l'écran. Un personnage fabriqué par l'agent (`generate_asset`)
arrive détouré par le modèle, comme depuis l'écran.

- Même règle côté MCP : même capacité, même texte, même recette.
- `list_models` montre la capacité.

**Critères.** Un essai MCP de bout en bout, avec un ComfyUI doublé : l'image arrive transparente,
détourage en sommeil.

### TN6 — Le banc rejoué, puis les planches

**Ce qu'on voit.** Une section du banc dans `docs/modeles-et-workflows.md`.

- Rejouer le banc par l'atelier jetable (port 8421), huit tirages par cas, sur les six sujets
  isolés. Relever ce que TN3 et TN4 font de chacun.
- Puis huit planches. Si elles sont toutes propres, ouvrir la transparence aux planches, sinon
  noter pourquoi et laisser fermé.

**Critères.** Les chiffres sont dans la doc. La décision sur les planches est écrite, dans un sens
ou dans l'autre.

---

## Ordre et dépendances

`TN1` → `TN2` → `TN3` → `TN4`, puis `TN5` et `TN6`. `TN4` n'est utile qu'une fois `TN3` en place :
sans détourage actif, un trou dans le sujet n'est plus rattrapé par rien.

## Trouvé en passant, hors de ce chantier

**Les décors reçoivent aussi « sprite isolé sur fond coloré ».** `_fond_de_l_appel` et
`production.py` ne regardent pas le type de sujet. Un décor ou une tuile part donc sur fond
magenta ou vert studio alors qu'on ne le détoure jamais. C'est un défaut à part, pour tous les
modèles, relevé le 22 septembre 2026.
