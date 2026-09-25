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

- [x] La planche du mage est signalée (mesurée sur l'image du banc ramenée à 256 px, pas rejouée
  par un vrai ComfyUI — c'est TN6).
- [x] Les sept autres tirages ne le sont pas, ni une silhouette dessinée aux poings sur les
  hanches et aux pieds joints, ni une fiole à anse.

**Faite le 25 septembre 2026.** *La mesure, en une phrase et sans chiffre* : une robe sortie
transparente est un grand vide que seul le trait du contour sépare du fond ; l'espace entre un
bras et le corps est enfermé lui aussi, mais derrière toute l'épaisseur d'un bras — et une anse,
deux jambes jointes n'enferment qu'un petit vide. (`atelier.image.traitement.part_enfermee` et
`sujet_troue`, lues sur le brut.) **Le premier essai, une seule condition, ne tenait pas** : la
part enfermée seule séparait bien le banc — mais le banc n'a **aucun** bras écarté du corps, et
une silhouette dessinée pour l'essai (poings sur les hanches, pieds joints) montait à 14 %, une
fiole à anse à 11 %, au niveau du seuil. D'où la seconde condition, le *trait mince* : une zone
enfermée ne compte que si au moins 10 % de son pourtour est à moins de 1,5 % du côté de l'image
(15 px à 1 024) du fond du dehors. **Chiffres** (vide enfermé sous 128 d'alpha, derrière un trait
mince, rapporté aux pixels du sujet à 128 et plus) : mage **28,0 %** à 1 024 px, 25,0 % à 512,
**21,8 % à 256** (la fixture), 14,8 % à 192 (le trait s'y rompt) ; ses zones longent un trait de
3 à 5 px sur 31 à 92 % de leur pourtour. Chevalier, fiole, bouton, voleur, objet : 0 ; salamandre
0,5 %, coffre 0,5 % (192 px), renard 0,03 % (256 px). Silhouettes dessinées : poings sur les hanches **0** (14,1 %
sans la seconde condition), pieds joints 3,0 %, fiole à anse 10,7 % (sous le seuil par son poids ;
grossie au-dessus, son mur l'arrête), robes trouées 81 à 117 %. **Seuil : 12 %** — le mage à sa
plus petite taille d'essai en est à 1,8 fois, le plus haut des sept autres à vingt-quatre fois
moins. ⚠️ Ce qu'elle ne sait pas séparer : un anneau fin, un cadre d'interface vide au milieu —
un grand vide voulu derrière un trait mince ; la fiche le dit, elle ne relance rien.
**Rien n'est gardé** (8septies) : `GET /api/assets/{id}/imposed` rend `sujet_troue`, recalculé à
chaque lecture sur le brut, et seulement pour une image née transparente (demandé et reçu, TN3) —
un index effacé retrouve la même réponse. Le coût : 0,1 à 0,2 s à 1 024 px, et presque toutes
les images s'arrêtent avant toute dilatation (le vide enfermé entier est sous le seuil).
**Le geste « Refaire sur fond coloré »** reprend les réglages de la génération (texte parti,
modèle, options) et coche « Sur fond coloré » dans la préparation (montrée tant qu'elle est
cochée) — il ne paie rien. L'appel part par la barre qui paie, puis « Relire avant l'envoi »
(`POST /api/outgoing`, qui annonce le prix ou le temps), puis `POST /api/generations`. Tranché en
route : **un drapeau de la demande, `fond_colore`**, et non une couleur posée dans le tri — le tri
repart de rien à chaque appel (M5), il ne survit pas au trajet fiche → préparation → envoi ; le
drapeau compte comme un fond imposé dans `transparence_demandee`, laisse l'atelier calculer la
couleur, s'enregistre sur la génération (seulement vrai), se relit à la relance et à « reprendre
les réglages », et retombe dès que l'appel est parti. **La consigne tombe avec le fond vide** :
un texte repris d'un appel transparent la porte encore ; `transparence.desencadrer` la retire à
la jonction de tout appel qui ne demande pas de fond vide, et le fond de l'appel prend la place
de la queue (la phrase de calage, au mot près) — sans quoi le texte repris ne nommait aucun
fond. Essais : `tests/test_tn4_trou_dans_le_sujet.py` (24 : le banc, les silhouettes, la fiche
par l'atelier, index effacé, le geste par l'envoi et par la soumission), fixtures du mage et du
renard à 256 px dans `tests/fixtures/banc_tn4/` ; `interface/src/composants/Fiche.tn4.test.tsx`
(3) et `interface/src/tn4-fond-colore.test.tsx` (5). **Non vu au navigateur.** Reste : l'agent
(MCP) n'a pas le geste — il ne voit pas la fiche ; le signal n'est pas dans `list_assets`.

### TN5 — L'agent fait pareil

**Ce qu'on voit.** Rien de neuf à l'écran. Un personnage fabriqué par l'agent (`generate_asset`)
arrive détouré par le modèle, comme depuis l'écran.

- Même règle côté MCP : même capacité, même texte, même recette.
- `list_models` montre la capacité.

**Critères.** Un essai MCP de bout en bout, avec un ComfyUI doublé : l'image arrive transparente,
détourage en sommeil.

**Faite le 25 septembre 2026.** `tests/test_tn5_agent.py` (4 essais), bout en bout par le vrai
serveur MCP (`serveur.call_tool`, comme `tests/test_t7.py`). **Le double reprend celui de TN2 et
TN3** — un modèle distant de plus qui déclare `transparence=True`, le même `essai:rend-du-vide` —
plutôt qu'un double ComfyUI : la règle ne distingue jamais le transport, et les trois tranches
jouent ainsi le même modèle. Un personnage fabriqué par `generate_asset` sur ce modèle reçoit une
image reprise de `tests/fixtures/banc_tn3/` (« voleur-pixel ») et naît détourée par le modèle —
`recette.fond_du_modele` et `recette.dort(DETOURAGE)`, lus par le même chemin que l'écran
(`ServiceGenerations.transparence_de_l_appel`, `demandee_par`). `list_models` montre
`transparent_background` (posé en TN1). Le cas témoin : un décor par l'agent (`kind="décor"`)
ne demande pas la transparence. **Un écart trouvé, corrigé dans le montage de l'essai, pas dans
le service** : `generate_asset` respecte le modèle imposé par défaut (F6, `MODELE_EXPLORATION` =
`Pollinations:sana`, qui ne déclare pas la transparence) — sans lever ce garde-fou
(`atelier.agent.regler(modele_actif=False)`, dans le montage du `mcp`), le modèle demandé par
l'essai était ignoré et la règle de TN5 semblait ne jamais se déclencher. Ce n'est pas un écart
entre l'écran et l'agent — l'écran n'a pas ce garde-fou — donc rien n'a changé côté service.
8octies : vérifié en débranchant `ServiceGenerations.transparence_de_l_appel` (`return False`
ajouté puis retiré) — les deux essais qui portent la règle tombent, les deux autres (`list_models`,
décor) restent verts.

### TN6 — Le banc rejoué, puis les planches

**Ce qu'on voit.** Une section du banc dans `docs/modeles-et-workflows.md`.

- Rejouer le banc par l'atelier jetable (port 8421), huit tirages par cas, sur les six sujets
  isolés. Relever ce que TN3 et TN4 font de chacun.
- Puis huit planches. Si elles sont toutes propres, ouvrir la transparence aux planches, sinon
  noter pourquoi et laisser fermé.

**Critères.** Les chiffres sont dans la doc. La décision sur les planches est écrite, dans un sens
ou dans l'autre.

**Ce que la relecture croisée laisse à TN6, si les planches s'ouvrent.** Une vue dépliée, un
morceau de planche refaite et la découpe à l'arrivée ne posent pas `fond_du_modele` : leurs
morceaux naîtraient détourés par l'atelier, sur la couleur violette que Qwen laisse sous le vide
(le banc dit que ça marche, rien ne l'a vérifié par l'atelier). Et la planche d'équipement
demande désormais explicitement une planche (`preparer(planche=True)`) : l'ouvrir se fera là.

**Faite le 25 septembre 2026.** Le banc rejoué par l'atelier jetable (port 8421, dossier hors
Git, le vrai ComfyUI local) — `essais/banc_tn6_transparence.py`, chiffres dans
`docs/modeles-et-workflows.md` § Le banc de transparence rejoué par l'atelier. **Huit tirages
par sujet, sur les six sujets isolés** (48 générations, par l'API ordinaire — la transparence
part automatiquement, TN2) : fond vide reçu 48/48, détourage endormi à la naissance 48/48,
aucun trou signalé par TN4. Les débris restants sont presque tous la fumée de la salamandre
(attendue) ; le coffre, seul sujet à porter des débris le 22 septembre, n'en a plus un seul sur
ses huit tirages. **TN3 et TN4 n'ont montré aucun écart** sur ces 48 tirages réels — rien à
décrire, rien à corriger.

**Puis huit planches par sujet** (mage 2×2, renard en marche), par une voie qui ne passe pas par
`ServiceProduction`/`ServiceGenerations` — TN2 exclut une planche de la transparence
automatique, donc la mesurer sans rouvrir cette porte demande d'appeler directement le moteur
de workflow (`MoteurWorkflow.soumettre_graphe`/`etat`/`sortie_de`, les mêmes primitives
qu'`_executer` appelle) avec le texte encadré à la main (`atelier.domaine.transparence.
encadrer`) ; chaque case mesurée comme un sujet isolé, la case voisine ne comptant jamais comme
un débris de la première. **Les seize planches sont propres** : fond vide reçu 16/16, aucune
case signalée trouée, débris sous 3,4 % partout. Le tirage unique du 22 septembre avait rendu
la robe du mage transparente (89 % de son corps sous 128 d'alpha) ; aucun des huit tirages
rejoués le 25 ne reproduit ce défaut.

**Décision sur les planches.** Huit propres sur huit, deux fois : le critère d'ouverture posé au
22 septembre est atteint. **Ouvrir la transparence aux planches n'est pas codé dans cette
tranche** — TN6 demande la décision, pas le code — mais elle est écrite comme proposition,
§ TN8 ci-dessous : la tranche qui la coderait devra aussi régler ce que la relecture croisée
laisse en suspens juste au-dessus (vue dépliée, morceau refait, découpe à l'arrivée).

---

## Relecture croisée du 25 septembre 2026

TN2 à TN5 et CM8, relus aux coutures. **Trois défauts confirmés et corrigés**, chacun avec un
essai qui tombe sans son correctif (`tests/test_tn_relecture.py`) :

- **Un texte repris gardait le fond de son premier appel.** « Reprendre les réglages » d'une image
  faite sur fond coloré — toute image Qwen d'avant TN2 — puis l'envoyer en fond vide encadrait la
  consigne autour de « flat solid #00B140 studio green background ». Et un texte repris déjà
  encadré, sur un style local, recevait son déclencheur **devant** la consigne (qui ne tient
  qu'en tête et en queue) et en double. Le texte repris est maintenant remis au fond de l'appel
  **avant** d'être composé (`_repris_au_fond`, soumission et aperçu) ; l'écran montre la même
  chose dans le texte, ses parties et les morceaux d'un style local, jetons recomptés.
- **La planche d'équipement demandait le fond vide.** Elle plie ses cases elle-même : rien ne la
  voyait planche. `preparer` prend `planche=True`, posé par le travail d'équipement.
- **La superposition disait « sans alpha » une image détourée par le modèle** — le seul lecteur
  de `passes_vives` que TN3 laissait derrière lui hors des planches. Il lit `a_une_silhouette`.

**Écartés, avec leur raison.** La découpe d'une image isolée née transparente (Decoupe) détoure
d'abord avec le moteur par défaut, que le banc dit sans perte sur le violet ; les calques d'une
pièce passent par `voyage`, qui réveille le détourage ; l'image de départ d'une vidéo est le rendu
posé sur le gris du produit. Les références « sur blanc » ne touchent ni au plafond ni à
`hors_plafond` (point 4). `fond_colore` retombe après l'appel, part par « Relire avant l'envoi »
(prix ou temps), et rien ne se relance seul. Les anciennes générations et recettes se relisent à
l'identique (clés écrites seulement quand elles sont vraies). Les critères de TN3 et TN4 disent
qu'ils ont été mesurés sur les images du banc, pas rejoués par l'atelier.

### Décisions laissées à l'auteur

1. **« Coup de main au plafond du mois » quand le plafond est à zéro** (CM8). Mettre le plafond à
   zéro, c'est couper le coup de main exprès ; le serveur rend alors `motif: "plafond"`, et la
   ligne grise paraît comme au plafond atteint. Silence (comme sans clé) ou ligne grise ? **Tranché le 25 septembre 2026 : la ligne grise reste.** Laissé
   tel quel ; noté aussi dans `PLAN-assistant.md`.
2. **Hériter le détourage d'un dessous détouré par le modèle** (superposition). Ses passes
   dorment : le geste « reprendre les passes du dessous » ne s'offre pas. Faut-il proposer de
   copier sa passe endormie, éveillée, sur un dessus opaque ? **Tranché le 25 septembre 2026 : non, on laisse ainsi.**

---

## Ordre et dépendances

`TN1` → `TN2` → `TN3` → `TN4`, puis `TN5` et `TN6`. `TN4` n'est utile qu'une fois `TN3` en place :
sans détourage actif, un trou dans le sujet n'est plus rattrapé par rien.

## Trouvé en passant, hors de ce chantier

**Les décors reçoivent aussi « sprite isolé sur fond coloré ».** `_fond_de_l_appel` et
`production.py` ne regardent pas le type de sujet. Un décor ou une tuile part donc sur fond
magenta ou vert studio alors qu'on ne le détoure jamais. C'est un défaut à part, pour tous les
modèles, relevé le 22 septembre 2026.

**Un texte repris vers un appel sur fond coloré garde sa couleur, et en reçoit une seconde.**
Relevé à la relecture du 25 septembre 2026, antérieur à ce chantier (RT3, RV3). Le texte repris
nomme « #00B140 studio green » ; la lecture des couleurs de la description (RV3) y lit « green »
et choisit le magenta ; le texte part en disant vert, et le négatif interdit le vert **et** le
magenta. La transparence n'y est pour rien — le fond vide, lui, est maintenant remis d'aplomb
(`_repris_au_fond`) — mais le même geste réglerait ce cas : remplacer la phrase de fond d'un
texte repris par celle de l'appel, et ne pas lire la phrase de l'atelier comme une description. **L'auteur a demandé la correction le 25 septembre 2026** : tranche `TN7` ci-dessous.

### TN7 · Un texte repris retrouve le fond de son appel

- [x] Un texte repris d'un appel sur fond vert, renvoyé sur fond coloré, perd sa phrase de fond d'avant avant que la couleur de l'appel soit choisie ; la lecture des couleurs de la description (RV3) ne lit pas la phrase de l'atelier.
- [x] Le texte envoyé nomme une seule couleur de fond, et le négatif n'interdit que celle-là ; « Relire avant l'envoi » montre exactement ce qui part.
- [x] Un texte écrit par l'auteur qui nomme vraiment une couleur (la cape verte de RV3) garde son effet d'aujourd'hui.

Fait le 25 septembre 2026. Le correctif tient dans le même geste que la
relecture avait posé pour le fond vide : `ServiceGenerations._sans_le_fond_d_avant`
(nouveau, `sans_fond_colore(desencadrer(texte))`) retire les deux phrases que
l'atelier avait lui-même ajoutées — la consigne de transparence, la couleur
nommée — et sert deux fois. D'abord dans `_repris_au_fond`, qui composait déjà
le texte d'un fond vide et compose maintenant aussi celui d'un fond coloré :
une nouvelle couleur ne prend la place de l'ancienne (`transparence.phrase_en_queue`,
nouveau) que si le corps nu diffère du texte parti — sinon un texte repris qui
ne nommait aucun fond (les propres mots de l'auteur) n'en reçoit pas un, la
garde qui protège ML4. Ensuite dans `preparer` et `apercu`, juste avant l'appel
à `fond.choisir` : la description que RV3 lit est nettoyée quand le texte est
repris, jamais sinon — un texte que l'auteur écrit lui-même (la cape verte de
RV3) n'est jamais visé, ses mots ne correspondent pas aux phrases retirées.
Vérifié en défaisant chacun des deux points (8octies) : sans le premier,
`test_tn_relecture.py` retombe sur trois essais ; sans le second (raw `sujet`/
`demande.prompt` repassé à `choisir`), le premier essai de `test_tn7_fond_repris.py`
reproduit le défaut original au caractère près — `#FF00FF` choisi au lieu de
`#00B140`. Rien vu au navigateur : ni maquette ni écran neuf, un correctif de
texte composé côté serveur, déjà couvert par « Relire avant l'envoi ».

### TN8 · Ouvrir la transparence aux planches (proposition, non codée)

**Posée par le banc de TN6, pas codée** : le critère d'ouverture posé au 22 septembre — huit
planches propres sur huit — est atteint deux fois le 25 septembre (mage 2×2, renard en marche,
`docs/modeles-et-workflows.md` § Le banc de transparence rejoué par l'atelier). Rien de ce
qui suit n'est codé ; c'est une proposition à trancher avant de l'ouvrir.

- Retirer l'exclusion `planche` de `transparence_demandee` (`atelier/domaine/transparence.py`)
  pour les planches de *création* (celles que TN6 a mesurées) — pas nécessairement pour une
  planche *refaite* ou un lot plié, que le banc n'a pas mesurés.
- **Ce que la relecture croisée du 25 septembre laisse en suspens** (§ TN6 ci-dessus) : une vue
  dépliée, un morceau de planche refaite et la découpe à l'arrivée ne posent pas
  `fond_du_modele` à la naissance — leurs morceaux naîtraient détourés par l'atelier sur la
  couleur violette que Qwen laisse sous le vide. Le banc dit que ce détourage-là ne mange rien
  sur le violet ; personne ne l'a vérifié par l'atelier. Une tranche qui ouvre TN8 devrait le
  faire avant, ou le nommer comme risque accepté.
- La planche d'équipement (`preparer(planche=True)`) resterait fermée par défaut tant qu'elle
  n'est pas mesurée séparément : ses règles de pose (silhouette imposée, fond du jeu) ne sont
  pas celles d'une planche de création.
- Reprendre un banc à huit tirages sur au moins un troisième sujet avant d'ouvrir pour de bon :
  deux planches propres sur deux ne couvrent que ce que TN6 a essayé.
