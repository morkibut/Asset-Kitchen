# Remarques d'usage — le sommaire

> **Ce fichier est un index, et rien d'autre.** Une ligne par remarque : quand elle est née, de
> quoi elle parle en une phrase, où elle en est, et où lire la suite. On l'ouvre pour savoir où
> l'on en est, jamais pour lire du détail.
>
> Le détail vit à côté :
> - **`docs/remarques/journal.md`** — le texte brut, tel que l'auteur l'a écrit, séance par
>   séance, dans l'ordre. Rien n'y est reformulé. Une remarque en sort le jour où elle reçoit
>   son propre fichier, et le journal garde alors juste sa ligne.
> - **`docs/remarques/<nom>.md`** — une remarque étayée. Le nom est parlant et ne change jamais :
>   un numéro se renumérote et casse tous les liens.
>
> **Ce qui fait foi ailleurs.** Une remarque n'est pas une décision. Ce que le produit doit faire
> est tranché par `docs/PRD.md`, l'ordre de construction par `docs/PLAN.md`, l'apparence par
> `docs/DESIGN.md`. Une remarque qui a mûri part dans l'un des trois, et sa ligne ici le dit.

---

## Les cinq états, et ils ne sont que cinq

| L'état | Ce qu'il veut dire |
|---|---|
| **en vrac** | Écrite, jamais regardée. On ne sait pas encore si c'est un bug, un manque d'explication ou un chantier. |
| **étayée** | Elle a son fichier : ce que le produit fait aujourd'hui, pourquoi, ce qui borne la solution, et deux à quatre pistes. Rien n'est tranché. |
| **tranchée** | On sait quoi faire et pourquoi. Ça attend son tour, ou ça attend une maquette. |
| **partie au plan** | Devenue une tranche de `docs/PLAN.md`. Le fichier reste comme trace de ce qui a été pesé. |
| **close** | Faite, ou abandonnée. Dans les deux cas la raison est écrite. |

**Un fichier étayé répond toujours aux mêmes six questions, dans le même ordre** : ce que
l'auteur a écrit, mot pour mot et daté · ce que le produit fait aujourd'hui, fichier et ligne à
l'appui · pourquoi c'est comme ça · ce qui borne la solution · deux à quatre pistes, chacune avec
son coût et son risque · ce qui est tranché et ce qui reste ouvert.

**Deux remarques qui sont le même problème partagent un fichier**, et l'index y renvoie deux
fois. On range par cause, pas par symptôme.

---

## Où l'on en est — relevé le 4 septembre 2026

*Ce compte se refait à la main en relisant les tableaux ci-dessous. Il est daté pour cette
raison : le jour où il ne correspond plus, c'est lui qui a tort.*

| | Combien | Ce que ça veut dire |
|---|---|---|
| **close** | **6** | Faites ou abandonnées, la raison écrite |
| **partie au plan** | **17** | Tranchées, écrites dans une tranche, **pas encore construites** |
| **étayée** | **2** | Instruites, avec leurs pistes — mais rien n'est tranché |
| **en vrac** | **15** | Jamais regardées |
| | **40** | |

**Il reste donc 34 remarques à traiter**, dont **17 sur lesquelles aucune décision n'est prise** —
les 15 en vrac et les 2 étayées. Les 17 autres n'attendent que d'être construites.

---

## Séance du 4 septembre 2026 — en découpant un calque à la main

*Trois remarques nées de l'usage de `G16`, le lendemain de sa livraison. Les trois portent sur le
même écran : la superposition, ouverte depuis la carte d'un vêtement.*

| La remarque | État | Où lire |
|---|---|---|
| **On ne peut pas zoomer dans la superposition, et `G10` ne le réparera pas.** *« Je dois pouvoir zoomer autant que je veux […] c'est impossible de découper proprement un calque à la main. »* **Vérifié : cet écran n'a aucun zoom du tout** — les deux images y sont simplement ajustées au panneau. `G10` fait monter le plafond **des tables** ; la superposition est une fabrique, pas une table. Et **c'est pire qu'un écart d'affichage** : le serveur colle le dessus dans le coin haut-gauche du cadre du dessous et jette ce qui dépasse. **Mesuré sur les deux vrais cas du dépôt — une case de 1024 px posée sur un corps de 253 px — il ne reste zéro pixel du casque**, et le calque qui sort est un rectangle plein de fond. L'écran, lui, montre le casque entier. | **partie au plan** — `M1 · M2` | [`remarques/fabriquer-un-calque-a-la-main.md`](remarques/fabriquer-un-calque-a-la-main.md) — *le grossissement n'est pas construit à part : il entre dans le dessin de `M2`. `M1` répare la perte mesurée* |
| **Les images ne s'affichaient plus après une superposition** — et **deux défauts se cachaient sous ce seul symptôme**, tous deux reproduits et corrigés le 4 septembre 2026. Le `400` d'abord : l'écran demandait l'emplacement d'un rang qui n'en est pas un, or *« une image sans recette se lit par son emplacement »* n'est vrai que des images de `C1`. **Le pire ensuite, trouvé en vérifiant le premier** : une superposition se range dans le dossier de la même génération, et le rejeu du recalage comme la case arrivée comptaient son rang comme une case — un seul calque refait à la main cassait les deux gestes **sur toute la planche**, définitivement. **Les deux défauts datent de `E6` ; `G16` les a mis sur le chemin ordinaire.** Et une lenteur au passage : 2,5 s → 483 ms. | **close** — *corrigés le jour même, deux essais de non-retour* | journal — *un défaut voisin reste ouvert : un calque né d'une superposition s'annonce « corps habillé »* |
| **La main manque dans la superposition, et ce coin du parcours est à revoir en entier.** *« Ce n'est pas trop logique ni bien organisé cette partie du workflow. »* **Vérifié : le champ existe dans le domaine, avec sa raison écrite, et aucun écran ne le pose.** Trois endroits fabriquent ou réparent un calque et ne se ressemblent pas — l'un n'a pas de zoom, l'autre a la main sans le choix des images, le troisième le choix et le calage sans la main ni le zoom. | **partie au plan** — `M2` | [`remarques/fabriquer-un-calque-a-la-main.md`](remarques/fabriquer-un-calque-a-la-main.md) — *même fichier, même cause. L'auteur a tranché la refonte plutôt que le rapiéçage : la maquette d'abord, et la main s'y construit une seule fois* |

---

## Séance du 3 septembre 2026 — sur ce qu'un équipement laisse derrière lui

| La remarque | État | Où lire |
|---|---|---|
| **On ne voit jamais l'image qu'on a payée, et « le brut » n'est pas le brut.** Un équipement revenu donne directement des calques ; refaire la superposition à la main repart alors de son propre résultat. **Vérifié : la planche revenue est bien gardée sur le disque, mais elle n'entre jamais en bibliothèque**, donc rien ne l'ouvre — et le brut d'un calque est, de l'aveu du code, *« la case ramenée dans le cadre du corps »*, déjà remise à l'échelle et recalée, là où celui d'un corps habillé est la case telle qu'elle est arrivée. **Trois manques distincts sous une seule remarque.** | **close** — `G16` **livrée le 3 septembre 2026** | journal — *la feuille entre en galerie, la carte d'un vêtement gagne la bascule* calque / brut *et le bouton* superposition ›*, et refaire le calage fabrique un second vêtement à côté du premier. Le troisième manque — le mot « brut » qui désigne deux choses — est **dit** à l'écran, pas réparé* |

---

## Séance du 3 septembre 2026 — sur l'écran qui montre ce qui part, avant de payer

*Quatre remarques d'un même écran : la fenêtre de confirmation, en posant un équipement sur une
seule pose. Trois ont été vérifiées dans le code le jour même ; aucune n'est tranchée.*

| La remarque | État | Où lire |
|---|---|---|
| **Corriger un texte fige l'écran à chaque lettre tapée.** Chaque frappe redemande au serveur ce qui part — un mot de dix lettres, dix allers-retours. **Le mécanisme est bien celui-là — mais la lenteur vient d'ailleurs.** Mesuré : composer cet écran fait **relire le projet du jeu quarante-deux fois**, et le temps ne suit rien d'autre que ce compte. **Lu une seule fois, c'est 71 % de moins**, sans toucher au geste. | **partie au plan** — `M3` | [`remarques/l-ecran-fige-a-chaque-lettre.md`](remarques/l-ecran-fige-a-chaque-lettre.md) — *trois défauts sous un seul mot, dont **le curseur qui repart à la fin deux fois par lettre**, ajouté par l'auteur à l'arbitrage. Le bouton* valider *proposé au départ est écarté par lui : il n'a plus rien à supprimer* |
| **La légende des références est en haut, illisible, et détachée des images qu'elle décrit.** Elle devrait être accrochée à chaque image jointe, plus bas. **Et le « gabarit de la grille » proposé en bas est en fait la pose elle-même** : le serveur le sait et l'écrit dans son propre commentaire, l'écran n'a qu'un seul libellé pour les deux cas. D'où le sentiment de voir une image jamais validée, qu'on ne peut ni décocher ni ouvrir. | en vrac | journal — *le libellé fautif est localisé ; le déménagement de la légende ne l'est pas* |
| **Ajouter une image de référence sans quitter l'écran de confirmation.** Aujourd'hui il faut sortir, et l'on perd toutes les corrections en cours. | en vrac | journal |
| **Pourquoi une planche, et des « cases », pour une seule pose ?** **Réponse trouvée le jour même : c'est délibéré** — un calque ne se fabrique que par une planche, fût-elle d'une case, parce qu'habiller consiste à renvoyer la même planche avec la pièce en plus. **Ce qui ne l'est pas, c'est le texte qui en sort** : « a sprite sheet of 1 sprites, exactly 1 columns and 1 rows », et un écran qui parle de cases au pluriel pour une case. | en vrac | journal — *la mécanique est justifiée, les mots ne le sont pas* |

---

## Séance du 3 septembre 2026 — en mesurant l'attente du détourage

| La remarque | État | Où lire |
|---|---|---|
| **Le modèle de détourage annoncé comme « lourd » ne détoure rien.** Trouvé en chronométrant les trois modèles : la bibliothèque installée ne connaît pas ce nom-là et retombe sans rien dire sur le rapide — **100,00 % d'accord** entre les deux, à la milliseconde près. L'écran annonce pourtant « plusieurs secondes par image », et 973 Mo dorment sur le disque dans un dossier que rien n'ouvre. | **partie au plan** — `G13` | [`remarques/attente-du-detourage.md`](remarques/attente-du-detourage.md) — *dernière section ; à arbitrer avant d'être construite* |

---

## Séance du 3 septembre 2026 — en étayant les recettes nommées

| La remarque | État | Où lire |
|---|---|---|
| **Un historique des retouches, pour revenir en arrière.** **Pour bien plus tard.** C'est son absence qui rend la pose d'une recette en lot dangereuse : rien ne garde le réglage d'avant, et « revenir au brut » ramène à l'image nue. Écarté par écrit aujourd'hui. | en vrac | journal — *bien plus tard ; **écarté par écrit du périmètre de la V3.1*** |

---

## Séance du 3 septembre 2026 — pendant la tranche `D2`

| La remarque | État | Où lire |
|---|---|---|
| **Sans artwork officiel, l'atelier ne réduit aucune couleur — et ne le dit pas.** La quantification n'entre que s'il existe une palette, et la palette se déduit des artworks. Pas d'artwork déposé, donc pas de palette, donc un sprite qui sort avec dix mille couleurs sans que rien ne le signale. Il faut l'annoncer, proposer de choisir une image de l'univers, et renvoyer vers un guide qui explique comment fabriquer les artworks d'un personnage — ce chapitre n'existe pas. | **partie au plan** — `G15` | journal — *mesurée au banc `D2` ; à arbitrer avant d'être construite* |
| **On ne peut pas créer une entité depuis l'univers.** On règle l'univers avant d'avoir peuplé le codex ; à ce moment-là il n'y a aucun personnage à qui attribuer une image, donc aucun artwork possible. L'ordre du produit interdit ce que l'écran demande. Il manque le geste « créer une chose d'ici ». | en vrac | journal |
| **Fabriquer un artwork depuis la toile de l'univers.** Quand l'auteur n'a pas d'image, lui proposer d'en générer une — mais il faut alors que la description du personnage vive quelque part, par exemple sur une carte de l'univers. Cela demande de savoir composer un prompt sur mesure et de fournir plusieurs références, images ou texte, pour demander précisément quelque chose. | en vrac | journal |
| **Le calage horizontal est effacé en silence dès qu'on repose une recette.** Trouvé et *vérifié* le 3 septembre 2026 en travaillant sur D2, hors de son périmètre. Le décalage n'est écrit que par le calibrage, et la charge de l'écran ne le porte pas : reposer n'importe quel réglage de la grille le remet donc à zéro. Un calage patiemment ajusté disparaît au premier cran de curseur, sans un mot. | **partie au plan** — `G14` | journal — *mesuré par la route, un asset calé à 7 revient à 0 ; à arbitrer avant d'être construite* |

---

## Séance du 3 septembre 2026, au soir — douze remarques

| La remarque | État | Où lire |
|---|---|---|
| **Démarrer la première pose d'un personnage.** On ne devine pas par où commencer sur un projet neuf ; le bouton qui lance tout ressemble à trois liens gratuits. Et trois documents, dont le Guide du produit, promettent que nommer une chose ouvre son établi — le code ne le fait pas. | **partie au plan** — `G9` | [`remarques/demarrer-premiere-pose.md`](remarques/demarrer-premiere-pose.md) — *4 changements, interface seule* |
| **Le zoom des tables plafonne trop bas.** Il monte à 250 %, il faudrait 1500 %. Et le même plafond s'applique à « ajusté », qui promet de remplir le cadre et ment pour deux images sur trois. | **partie au plan** — `G10` | [`remarques/zoom-des-tables.md`](remarques/zoom-des-tables.md) — *5 changements, interface seule ; amende 2 règles écrites* |
| **Appliquer une recette qui marche à plusieurs images d'un coup.** Aujourd'hui elle se pose image par image, et la colonne « ses sœurs » porte déjà l'ensemble qu'il faudrait viser. | **partie au plan** — `G12 · G5` | [`remarques/recettes-nommees.md`](remarques/recettes-nommees.md) — *7 changements ; amende un invariant, et découvre un défaut à réparer avant* |
| **Mettre à jour une recette nommée.** **Le bouton existe déjà**, caché : retaper le nom change « Enregistrer » en « Remplacer › ». Ce n'est pas un manque, c'est un geste qu'on ne trouve pas. | **partie au plan** — `G12 · G5` | [`remarques/recettes-nommees.md`](remarques/recettes-nommees.md) — *même fichier, même panneau* |
| **« Concept art de » et « artwork officiel promu » se confondent.** Deux réglages voisins sur une carte, et rien ne dit ce qui les sépare — ils diffèrent sur cinq points, dont trois écrits nulle part. Mesuré : sur les six désignations du dépôt, **quatre ne font rien**. Et le recueil dit le contraire du code, dans la phrase même qu'on ouvre pour comprendre. | **partie au plan** — `G7` | [`remarques/concept-art-contre-artwork.md`](remarques/concept-art-contre-artwork.md) — *5 changements, interface et recueil seuls ; referme la question de la vue* |
| **Rien ne dit qu'un détourage est en cours.** Quand le moteur met du temps, l'écran ne bouge pas. Mesuré : l'attente va de 0,8 à 2,3 s, et elle est la pire au premier contact avec l'écran. **La barre d'attente existe déjà** et se calcule à chaque retouche — elle a été perdue le 31 août en déménageant la retouche, sans qu'aucun essai ne bronche. | **partie au plan** — `G2` | [`remarques/attente-du-detourage.md`](remarques/attente-du-detourage.md) — *3 changements ; une régression, pas un manque* |
| **Les curseurs de taille dérivent.** On lâche le curseur et la valeur continue de bouger plusieurs secondes. Ce n'est pas un défaut d'affichage : **la poignée montre l'écho du serveur au lieu de la main**, parce que chaque cran traversé écrit l'univers entier — 90 écrits pour un glissement, 1,4 s de serveur bloqué. La règle qui l'interdit est écrite sur le curseur depuis le 27 août ; le produit la tient 10 fois sur 17. | **partie au plan** — `G4` | [`remarques/curseurs-qui-derivent.md`](remarques/curseurs-qui-derivent.md) — *3 changements ; répare 4 curseurs et ferme le retour du défaut* |
| **Les réglages de départ ne se comprennent pas, et il faudrait un vrai accueil.** Trois réglages opaques dans « les types d'objets », et l'idée d'un assistant simplifié à l'ouverture d'un projet neuf. **Les trois explications existent dans le recueil et ne sont branchées nulle part** — comme 22 autres, sur 122. Et l'assistant existe, mais ne s'ouvre qu'une fois dans la vie de l'atelier : mesuré, 3 des 6 projets n'ont jamais été réglés. | **partie au plan** — `G3 · G8 · G11` | [`remarques/reglages-de-depart-et-accueil.md`](remarques/reglages-de-depart-et-accueil.md) — *4 chantiers ; révise une décision écrite, et laisse une idée d'IA pour plus tard* |
| **Les réglages de « l'allure » — sept reproches d'un coup.** Dont le plus lourd : l'univers occuperait plus de la moitié du texte envoyé, au détriment de la pose et de la vue. **Mesuré : l'univers pèse 41 à 45 %, et la consigne de pose 1,5 à 2,3 %.** La phrase de l'écran est fausse depuis le 1<sup>er</sup> septembre. Et sept phrases citent un numéro d'étape en dur : **les sept sont fausses d'un cran** depuis le travail en cours de `D2`. | **close** — `G1` **livrée le 3 septembre 2026** | [`remarques/l-allure.md`](remarques/l-allure.md) — *les 5 textes sont réécrits, et les numéros d'étape se calculent désormais au lieu d'être tapés — ils étaient huit, pas sept. **Un seul des sept reproches reste ouvert** : le déséquilibre du prompt, daté **post-V3** avec sa mesure ; il est porté par la remarque du 1<sup>er</sup> septembre sur la vue du jeu, qui est la même question* |
| **Le menu d'une carte de la toile déborde hors de l'écran**, et l'écran de l'univers mériterait deux colonnes latérales. **Le garde-fou existe depuis le 27 août et il est éteint sur la toile, par une décision écrite** — dont l'objection technique a été levée depuis, dans le même fichier, pour cinq autres usages. | **partie au plan** — `G6 · G7` | [`remarques/menu-de-carte-et-ecran-univers.md`](remarques/menu-de-carte-et-ecran-univers.md) — *3 chantiers ; révise 2 décisions écrites, et refait l'écran de l'univers* |
| **« Ce que la palette lit » est incompréhensible**, même pour l'auteur de l'outil. **Ce n'est pas un défaut d'explication : sur 4 des 9 artworks du dépôt, la phrase se contredit** — elle annonce un reste qui n'existe pas, puis renvoie voir en magenta une image où rien ne serait magenta. Cause trouvée : une condition posée sur un seul bout d'une échelle qui en a deux. **Tranché autrement que par la réparation** : le bloc quitte la toile, qui est un cadre pour poser des idées et non pour lire un calcul. | **partie au plan** — `G7` | [`remarques/ce-que-la-palette-lit.md`](remarques/ce-que-la-palette-lit.md) — *4 changements ; le bloc déménage du côté des palettes* |
| **Ne montrer que l'essentiel, masquer l'avancé, et une grosse passe de design.** Trois demandes en une, dont deux contredisent des décisions écrites. | en vrac | journal — ***écartée du périmètre de la V3.1 le 3 septembre 2026** : à reprendre après la V3, voire plus tard* |

---

## Séance du 3 septembre 2026 — après la tranche `D1`

| La remarque | État | Où lire |
|---|---|---|
| **L'atelier ne demande jamais si le jeu est en pixel art**, et c'est la première question de toutes. Mesuré : deux jeux du dépôt demandent du pixel art et reçoivent deux choses différentes, une peinture et une vraie grille — et le produit ne sait pas dans lequel il est. | **close** — `D2` **close le 3 septembre 2026** | journal — *reprise en `D2`, et livrée entière : le style se choisit en image à la **deuxième** étape, il décide de ce que la taille veut dire, et le peigne dit à l'auteur quand le modèle a rendu autre chose que ce qu'il a demandé* |
| **Le détourage de départ est incomplet, et il arrive au mauvais moment de l'usage.** On le règle avant d'avoir fabriqué la moindre image, alors qu'on ne sait ce qui convient qu'après. | étayée | journal — *à reprendre, maquette d'abord* |
| **Deux astuces de détourage de la revue externe manquaient au plan.** Le rongement conditionnel et la décontamination sans matting. | close | journal — *écrites dans `D4`* |

---

## Séance du 2 septembre 2026

| La remarque | État | Où lire |
|---|---|---|
| **Une planche doit se voir, se garder, et se déplier autant de fois qu'on veut.** Aujourd'hui elle est découpée d'office et n'existe nulle part. | **partie au plan** — `P1` | journal — *sa moitié « se voir et se garder » est **livrée le 3 septembre 2026** par `G16` ; `P1` garde « se déplier autant de fois qu'on veut ». La tranche s'appelait `A1` : elle est sortie de la V3 le 3 septembre 2026 et vit en V3.5* |

---

## Séance du 1<sup>er</sup> septembre 2026

| La remarque | État | Où lire |
|---|---|---|
| **Découper, recadrer et détourer une image posée sans quitter la toile.** | close | journal — *fait le jour même, maquette « découper une carte »* |
| **Des catégories pour ranger les choses du codex.** Héros, méchants, bestiaire — une famille dit ce qu'une chose est, pas où l'auteur la range. | en vrac | journal |
| **Le panneau « réglages de l'appel » ne se referme pas**, et l'interface manque de fluidité en général. | en vrac | journal |
| **Le prompt d'une pose ne tient pas la vue du jeu.** Mesuré : la consigne de vue arrive sixième sur sept, entre deux lignes qui la contredisent. | étayée | journal — *recoupe la tranche `R7`* |

---

## Séance non datée — les plus anciennes

| La remarque | État | Où lire |
|---|---|---|
| **Les cartes de texte de l'univers.** Texte tronqué en vue grille, popup d'édition, markdown, recherche dans le texte. | en vrac | journal |
| **« Modèle d'exploration » et plafond par séance sont obscurs.** On ne sait ni quand ils s'appliquent, ni ce qu'ils empêchent ; et un plafond qui se remet à zéro en rouvrant l'atelier ne contrôle rien. | en vrac | journal |
| **Savoir ce qu'un projet a coûté**, et l'app entière. Pas un détail comptable, un ordre de grandeur. | en vrac | journal |
| **La découpe rend des images sans visuel.** Quatre morceaux vides depuis un fichier `.jfif` et depuis un `.jpeg` ; ça marche si l'on détoure d'abord. **C'est un bug, jamais élucidé.** | en vrac | journal |
| **L'outil de découpe est trop caché**, alors qu'il est important. | en vrac | journal |
| **L'outil « ce qu'on porte » n'est pas fini.** Calque ou corps habillé, la différence à la main, les quatre directions en un appel, les marges de sécurité. | en vrac | journal |
