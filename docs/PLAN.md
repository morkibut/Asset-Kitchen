# Plan : Asset Kitchen — V1

> **PRD source** : `docs/PRD.md` — 111 user stories.
> **Découpage** : les sept tranches T1→T7 ont été décidées le 26 août 2026, à l'établissement
> de `docs/ARCHITECTURE.md` §6.3. Ce plan ne les redécoupe pas : il leur accroche les user
> stories, leur donne un ordre et des critères d'acceptation vérifiables. C'est lui, désormais,
> qui fait foi sur l'ordre de construction et sur les critères d'acceptation de la V1.
>
> **T8 et T9 sont venues après, le 27 août 2026**, d'une séance d'essai sur le produit tenu :
> la grille du tableau d'inspiration montre tout d'un coup d'œil et ne permet d'organiser rien.
> Elles ne s'intercalent nulle part — elles se posent après T7, et aucune tranche de la V1 ne
> les attend.
>
> Ce document fait foi sur **l'ordre**. Il ne nomme ni fichier, ni fonction, ni route :
> comment c'est construit vit dans `docs/ARCHITECTURE.md`, à quoi ça ressemble dans
> `docs/DESIGN.md`, ce que ça doit faire dans `docs/PRD.md`.

---

## Décisions architecturales

Ce plan ne décide ni du squelette, ni du schéma, ni des routes — voir `ARCHITECTURE.md`
§4, §4 bis et §5. Ce qu'il décide, et que personne d'autre ne dit : **à quel moment
chaque objet et chaque invariant entrent en vigueur**. C'est ce calendrier qui rend une
tranche livrable seule.

### Quand chaque entité du modèle d'objets apparaît

| Entité | Apparaît en | Ce qu'elle porte à ce moment-là | Se complète en |
|---|---|---|---|
| **Génération** | T1 | identifiant unique, statut, avancement, paramètres résolus, coût réel, résultats | T4 (références envoyées), T7 (provenance agent) |
| **Asset** | T2 | image brute, recette, dimensions mesurées, label | T3 (projet, collection, favori, filiation), T5 (filiation de découpe) |
| **Projet** | T3 | nom, rangement, total des coûts, journal | T4 (bible, artworks, palette, réglages par défaut) |
| **Collection** | T3 | nom, projet optionnel | — |
| **Carte** | T4 | type, contenu, groupe, note, provenance, taille d'affichage, artwork officiel, famille | T8 (sa place sur la toile : position, largeur libre) |
| **Lien** | T9 | les deux objets qu'il joint, son mot, sa pointe | — |

Un objet n'est jamais rétro-adapté en catastrophe : chaque tranche sait déjà ce que la
suivante viendra y ajouter.

### Les invariants, et la tranche qui les instaure

Un invariant instauré ne se renégocie plus : les tranches suivantes le conservent, et
c'est un critère d'acceptation de chacune d'elles.

| Invariant | Instauré en |
|---|---|
| L'identifiant de génération est unique — deux soumissions ne facturent qu'une fois | T1 |
| Le coût enregistré est celui que l'appel facture, jamais le tarif affiché au catalogue | T1 |
| Les dimensions mesurées font foi, jamais celles demandées | T1 |
| Le catalogue décide, jamais une liste en dur | T1 |
| Ce qui est indisponible est grisé avec sa raison, jamais proposé puis refusé | T1, étendu à chaque nouvelle raison (T2, T6) |
| Rien n'est jamais relancé automatiquement | T1 |
| Le traitement est non destructif : image brute + recette, le rendu est un cache effaçable | T2 |
| Le post-traitement ne touche jamais le GPU, et n'appelle jamais le fournisseur | T2 |
| Les fichiers font foi, la base est un index reconstructible | T3 |
| Une seule grille d'assets dans tout le produit | T3 |
| Tout ce qui ne demande pas le fournisseur fonctionne réseau coupé | T3, reconduit en T4, T5, T6 |
| Aucune carte graphique mobilisée, aucun modèle **génératif** local — ni ComfyUI, ni LM Studio, ni GPU | T1, et chaque tranche le conserve. **Précisé en T2**, pas contourné : un modèle de *segmentation* sur processeur est admis comme **second** moteur de détourage, facultatif, et grisé avec sa raison quand il n'est pas installé. Le geste courant n'en demande aucun — le détourage par défaut ne charge rien et marche hors ligne |
| Le MCP n'a aucune logique propre : il appelle les services de l'écran | T7 — et c'est ce qui interdit d'y ajouter un geste que l'écran n'a pas |
| La toile montre ce qui est classé, la réserve contient ce qui reste à classer | T8 |
| L'îlot **est** le groupe — hors îlot, pas de groupe, et jamais deux rangements concurrents | T8 |

### Couverture des 111 user stories

Chaque user story appartient à une tranche et à une seule.

| Tranche | User stories | Nombre |
|---|---|---:|
| T1 | 1, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 75, 93, 94, 95 | 23 |
| T2 | 59, 62, 63, 64, 65, 66, 70, 71 | 8 |
| T3 | 2, 5, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 92, 97 | 22 |
| T4 | 41 à 58, 60, 61, 67, 68, 69 | 23 |
| T5 | 72, 73, 74 | 3 |
| T6 | 76, 77 | 2 |
| T7 | 39, 78 à 91, 96 | 16 |
| T8 | 98 à 107 | 10 |
| T9 | 108, 109, 110, 111 | 4 |
| | **Total** | **111** |

Deux user stories s'achèvent dans une tranche postérieure à celle qui les porte, et le
critère correspondant y est écrit : **US-14** (le total par projet arrive en T3) et
**US-65** (la quantification, grisée en T2, s'allume en T4).

---

## Phase T1 : La première image

**User stories** : US-1, US-3, US-4, US-6, US-7, US-8, US-9, US-10, US-11, US-13, US-14,
US-15, US-16, US-17, US-18, US-19, US-20, US-21, US-22, US-75, US-93, US-94, US-95

### Ce qu'on livre

L'atelier s'ouvre sur un champ de prompt actif, sans écran à traverser. On écrit un prompt
et un prompt négatif, on choisit un modèle dans le catalogue que le fournisseur déclare, on
lance de une à plusieurs variations en parallèle, on regarde chacune avancer, on récupère
les images et on les télécharge.

La génération vit côté serveur dès cette tranche. Fermer l'onglet ne l'arrête pas ; rouvrir
la retrouve avec son avancement ; un redémarrage la marque interrompue, garde son coût et
propose un bouton relancer — jamais une relance d'elle-même. Chaque variation est un
emplacement indépendant : les réussites arrivent même quand les voisines échouent, un raté
affiche sa raison en clair à la place de l'image, et se relance seul sans réécrire le prompt
ni repayer les autres.

Sans clé, le bouton générer est inactif, porte sa raison et mène à son réglage : c'est le
seul préalable dur du produit. L'écran Réglages n'existe pour l'instant que pour ça — les
garde-fous et les dossiers l'y rejoindront en T7.

Sans réseau, le dernier catalogue reçu sert de repli, daté en clair ; on peut écrire un
prompt et ne le lancer qu'au retour ; l'échec survient au moment où on génère, jamais à
l'ouverture.

**Ordre interne** — c'est la plus épaisse des sept tranches, elle se construit dans cet
ordre : (1) clé, catalogue et un appel qui rend une image téléchargeable — c'est aussi
l'essai qui vérifie la couverture image du fournisseur, premier risque à lever d'après
`ARCHITECTURE.md` §11 ; (2) variations concurrentes et emplacements indépendants ;
(3) survie à l'écran et reprise ; (4) repli hors ligne.

### Critères d'acceptation

- [x] Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que celui de la clé.
- [x] La clé se dépose une fois et n'est plus jamais redemandée.
- [x] Sans clé : générer est inactif, dit pourquoi, et mène au réglage en un geste.
- [x] La liste des modèles vient du catalogue du fournisseur ; aucun identifiant de modèle, aucun plafond de références n'est écrit en dur.
- [x] Un modèle qui ne peut pas honorer la demande en cours est grisé avec sa raison, jamais proposé puis refusé.
- [x] Un modèle déjà choisi qui devient invalide reste choisi : c'est générer qui devient inactif, avec sa raison. Aucune substitution silencieuse.
- [x] Quatre variations d'un même prompt partent en parallèle et affichent chacune son avancement.
- [x] Une génération se lance pendant qu'une autre tourne, sans attendre la première.
- [x] Sur quatre variations dont deux échouent : deux images arrivent, deux emplacements portent une raison lisible et un bouton relancer, et relancer l'un ne rejoue pas les autres.
- [x] L'onglet est fermé pendant une génération : à la réouverture, l'image est là.
- [x] Le serveur est arrêté pendant une génération : au redémarrage elle est marquée interrompue, son coût réel est lisible, et aucune relance n'a eu lieu.
- [x] Deux soumissions de la même génération ne facturent qu'une seule fois.
- [x] Le coût enregistré est celui que l'appel a facturé, pas le tarif du catalogue ; il est lisible génération par génération.
- [x] Les dimensions enregistrées sont mesurées sur l'image reçue.
- [x] Réseau coupé : le démarrage n'affiche aucune erreur, le catalogue affiche sa date en clair, un prompt se prépare, et l'échec ne survient qu'au moment de générer.
- [x] Une image se télécharge seule, en PNG.

### Bloquée par

Aucune — démarrable immédiatement.

### Tenue le 27 août 2026

Les seize critères sont vérifiés, et **aucune vérification ne coûte un centime** :
le fournisseur est un double dans les tests, et le seul appel payant du dépôt
part à la main. Deux critères ne se vérifient pas là où on les regarde, et
c'est noté dans les tests eux-mêmes : « sans sondage » se prouve en montrant que
le serveur **annonce** chaque changement, et la jauge déterminée se prouve en
montrant que le serveur donne les deux faits qui la portent — l'instant du
départ et l'attente mesurée du modèle.

Trois constats sont sortis de cette tranche et valent pour les suivantes :

- **Aucun fournisseur d'image ne rend d'avancement en chemin.** Une jauge
  déterminée ne peut donc pas relayer : elle compare le temps écoulé à ce que ce
  modèle-là a mis à ses derniers appels réussis. Cette attente est une mesure qui
  se recale seule, jamais une table de modèles.
- **Une jauge qui atteint le bout avant l'arrivée dit une chose fausse.** Celle
  du produit approche sans jamais toucher, et le compteur porte l'écart en clair.
- **Hors ligne n'est pas une panne du produit** : c'est un état dans lequel il
  continue de servir. Le repli date ce qu'on voit, dit ce qui marche encore,
  dit ce qui échouera, et donne le geste pour réessayer.

---

## Phase T2 : Le post-traitement

**User stories** : US-59, US-62, US-63, US-64, US-65, US-66, US-70, US-71

### Ce qu'on livre

L'image qui vient d'être produite se retouche sans repayer : recadrage, redimensionnement,
pixellisation sur une grille cible, quantification, nettoyage des bords, et détourage en une
ou plusieurs passes avec seuil alpha et durcissement du bord. Les réglages répondent
instantanément, sur le processeur, sans jamais mobiliser la carte graphique ni rappeler le
fournisseur.

Rien n'est écrasé. L'image brute reste, les étapes forment une recette ordonnée qu'on rejoue,
qu'on nomme pour la réappliquer à l'identique, et qu'on annule d'un seul geste pour revenir
au brut. Le fichier traité n'est qu'un rendu : le supprimer ne perd rien.

C'est ici que se règle le constat qui décide de l'architecture — dix modèles sur douze font
dériver la taille du pixel. La remise sur grille est traitée comme le cas normal, y compris
quand la grille rendue est cinq fois trop grosse, et un petit objet ressort aussi fin qu'un
personnage. La cible se choisit à la main dans cette tranche ; elle deviendra une propriété
du projet, imposée à tout ce qui rentre, en T4.

La quantification est livrée branchée mais grisée avec sa raison, tant qu'aucune palette
n'existe. Elle s'allume en T4, quand la palette se déduit des artworks officiels.

### Critères d'acceptation

- [x] Une image rendue sur une grille cinq fois trop grosse revient sur la grille cible demandée.
- [x] Un petit objet et un personnage traités vers la même cible sortent avec le même bloc de pixel.
- [x] Chaque réglage répond sans attente perceptible, sans appel réseau et sans solliciter la carte graphique.
- [x] L'image brute est toujours conservée, et revenir à elle est un seul geste.
- [x] Supprimer le fichier de rendu ne perd rien : il se recalcule depuis la recette.
- [x] Une recette nommée, réappliquée ailleurs, donne exactement le même résultat.
- [x] La quantification est grisée avec sa raison tant qu'aucune palette n'existe.
- [x] Un détourage qui a mangé le sujet se voit immédiatement et se reprend avec d'autres réglages, sans repayer.
- [x] Plusieurs passes de détourage s'enchaînent, seuil et durcissement réglables à chacune.
- [x] La comparaison est faite et tranchée : sortie brute du modèle contre sortie post-traitée (risque « qualité pixel art directe », `ARCHITECTURE.md` §11).

### Bloquée par

- **T1** — il faut une image et son enregistrement pour avoir quelque chose à retoucher et où poser une recette.

### Tenue le 27 août 2026

Les dix critères sont vérifiés, **et le dixième a coûté zéro appel** : la
comparaison brut/traité s'est faite sur les 44 images des bancs de modèles, déjà
sur le disque depuis le 26 août. Vingt-deux tests tiennent les neuf autres, et
aucun n'appelle le fournisseur — plusieurs le **prouvent**, en comptant les
appels du double avant et après une retouche.

**Le verdict du dixième critère, et il est net.** Sur 44 images de six modèles :

| | sortie brute | sortie post-traitée |
|---|---|---|
| Transparence | **0 sur 44** — aucun fournisseur n'en rend | franche, alpha durci |
| Couleurs (médiane) | 33 986 | **27** |
| Grille rendue | 7 à 20 px selon le sujet, **facteur 2 dans un même lot** | 1 px, par construction |
| Sujet perdu | — | **0 sur 44** |
| Coût | un appel payant | 0,17 s de processeur |

**Le risque « qualité pixel art directe » est donc levé, et à l'envers de ce
qu'on craignait** : la question n'était pas de savoir si le post-traitement
apporte assez, mais s'il est indispensable. Il l'est. Aucune sortie brute n'est
utilisable comme asset de jeu — pas de transparence, trente mille couleurs, une
grille qui change de sujet en sujet. C'est la confirmation directe de
`ARCHITECTURE.md` §4 bis : *« la couche de post-traitement n'est pas un confort,
c'est ce qui rend le produit possible »*.

Quatre constats sont sortis de cette tranche et valent pour les suivantes :

- **Le détourage par défaut n'a besoin d'aucun modèle.** Un remplissage depuis
  le bord — un pixel n'est du fond que s'il est *relié au bord* — rend une
  silhouette propre sur les 44 images, squelette blanc sur fond gris clair et
  fioles translucides compris. Un seuil global les aurait percés. Le modèle de
  segmentation reste en second moteur, pour les images qui ne viennent pas d'ici.
- **Une région fermée reste opaque, et c'est voulu.** L'intérieur d'un cadre
  d'interface n'est relié à aucun bord : il survit au détourage. C'est la même
  règle qui sauve l'os d'un squelette. Le rendre transparent est un geste de
  l'auteur — une passe de plus, ou le second moteur —, jamais une décision de
  l'outil.
- **Ce qui coûte, c'est le détourage ; le reste est gratuit.** 130 ms contre
  28 ms sur une image de 1024 px. Garder le détourage entre deux réglages est ce
  qui rend « chaque réglage répond sans attente perceptible » vrai — et c'est un
  fait de mesure, pas une optimisation prudente.
- **Une mesure automatique de la grille rendue ne remplace pas l'œil.** Elle
  situe l'ordre de grandeur et prend une harmonique sur les sujets les plus
  grossiers. Le facteur cinq relevé à l'œil le 26 août reste le chiffre de
  référence ; celui du banc automatique est un plancher.

---

## Phase T3 : La bibliothèque

**User stories** : US-2, US-5, US-12, US-23, US-24, US-25, US-26, US-27, US-28, US-29,
US-30, US-31, US-32, US-33, US-34, US-35, US-36, US-37, US-38, US-40, US-92, US-97

### Ce qu'on livre

Tout ce qui sort entre en bibliothèque de lui-même, rangé dans le projet courant. Un projet
« Bac à sable » existe déjà au premier lancement : ranger reste un geste, jamais un préalable,
et créer un vrai projet attend qu'on en ressente le besoin.

Une seule grille d'assets dans tout le produit, sous le champ de prompt — mêmes filtres, même
recherche, même sélection multiple. Deux niveaux de rangement et pas un de plus : projets et
collections. Les trois panneaux et la grille cohabitent sur l'écran large, chacun repliable
par choix pour voir la grille en grand.

La fiche d'un asset s'ouvre en panneau latéral et se referme exactement là où on était,
grille et prompt intacts. On y lit sa filiation, on y marque un favori, on le supprime avec
une annulation courte. Jamais de cascade : les enfants survivent au parent et affichent
« parent supprimé ». Supprimer un projet annonce le nombre d'assets concernés et les détache
au lieu de les détruire.

Un asset se réinjecte dans le générateur dans ses quatre rôles : référence, source d'édition,
guide de style, jeu de réglages. Le coût se totalise par projet — ce qui achève US-14 — et le
journal du projet garde les appels ratés avec leur coût réel, pendant qu'aucun échec n'entre
jamais dans la grille.

L'index est jetable : effacé, il se reconstruit en relisant les fichiers du disque. Et tout
ce qui est ici — retrouver, ranger, retoucher, détourer — fonctionne réseau coupé.

### Critères d'acceptation

- [x] Au premier lancement, le projet « Bac à sable » existe déjà et reçoit ce qui sort.
- [x] Une image produite apparaît dans la grille sans qu'on ait à l'accepter.
- [x] Aucun échec n'apparaît dans la grille, et chaque appel raté reste lisible avec son coût dans le journal du projet.
- [x] Le total des coûts par projet est juste, appels ratés compris (achève US-14).
- [x] La grille sous le prompt et la grille qui sert à organiser sont la même : mêmes filtres, même recherche, même sélection multiple, mêmes pastilles.
- [x] Un filtre sans résultat affiche l'état vide et le geste pour retirer le filtre.
- [x] Une bibliothèque vide invite à écrire un prompt.
- [x] La fiche asset s'ouvre en panneau latéral et se ferme sur la position, le filtre et le prompt d'avant.
- [x] La filiation d'un asset est lisible depuis sa fiche.
- [x] Supprimer un asset qui a huit enfants laisse les huit en place, chacun marqué « parent supprimé ».
- [x] Supprimer un projet annonce le nombre d'assets concernés, et ces assets se retrouvent détachés, pas détruits.
- [x] Chaque suppression offre une annulation courte, puis devient définitive.
- [x] La base d'index effacée, la bibliothèque se reconstruit depuis les fichiers sans perdre un asset.
- [x] Un asset se réinjecte dans le générateur comme référence, source d'édition, guide de style ou jeu de réglages.
- [x] Les trois panneaux et la grille tiennent ensemble sur l'écran large ; replier un panneau est un choix, jamais une contrainte de place.
- [x] Réseau coupé : bibliothèque, retouche et détourage fonctionnent normalement.

### Bloquée par

- **T2** — la bibliothèque range des assets faits d'une image brute et d'une recette ; sans la recette, elle indexerait des fichiers plats et devrait être reprise.

### Tenue le 27 août 2026

Les seize critères sont vérifiés : **onze par `tests/test_t3.py`**, cinq par
`interface/src/App.test.tsx` — ceux-là portent sur ce que l'écran montre, et
n'existent que devant lui. Soixante-dix tests de serveur et neuf d'écran tiennent
désormais T1, T2 et T3, et aucun ne coûte un centime.

**Ce que la tranche a tranché, et qui n'était écrit nulle part :**

- **La grille est faite d'assets, et le chantier y tient sa place.** Un
  emplacement qui n'a pas encore donné son asset occupe la case **sous la même
  clé** — `<génération>-<rang>`, qui est l'identifiant que l'asset portera. L'image
  ne se glisse donc pas à côté de son attente : elle la remplace, et « la grille
  ne se recompose jamais entre le départ et l'arrivée » devient vrai sans
  machinerie. Corollaire : les assets d'un même lot portent **la date du lot**,
  jamais celle de leur arrivée, sinon deux variations glissent l'une par rapport
  à l'autre pendant qu'on les regarde.
- **Un échec occupe sa place, il ne s'installe pas.** Il reste dans l'onglet qui
  l'a vu — c'est là qu'on décide de relancer — mais la bibliothèque relue ne le
  contient pas (US-23), et le journal du projet garde l'appel avec son coût réel
  (US-24). Ce qu'un onglet retrouve en se rebranchant, c'est la bibliothèque plus
  **le chantier** : ce qui tourne, et ce qu'un redémarrage a coupé. Une
  interruption attend encore une réponse ; un échec a eu la sienne.
- **Le schéma de l'index n'a aucune migration.** Quand il change, l'index est jeté
  et le démarrage le refait en relisant `donnees/`. C'est ce qui transforme
  l'invariant « les fichiers font foi » en habitude : la reconstruction sert au
  moins une fois par évolution du schéma, donc elle ne pourrit pas.
- **Une suppression définitive n'a pas de pierre tombale.** Effacer le brut suffit
  à effacer l'asset : la reconstruction comme le rattrapage ne donnent un asset
  qu'à un emplacement dont le fichier est encore là. Le `generation.json`, lui,
  reste — on supprime une image, pas une dépense.
- **Trois des quatre rôles de réinjection partent par le même tuyau**, parce que le
  contrat du fournisseur n'a qu'un champ d'images d'entrée. Ce qui les distingue
  est enregistré quand même : `edition` engendre — c'est de là que vient toute la
  filiation de T3 —, `reference` et `style` inspirent. Le quatrième, *jeu de
  réglages*, n'envoie aucune image : il repeuple le générateur.

**Cinq défauts ont été trouvés en ouvrant l'atelier, aucun par les tests.** C'est
la deuxième fois de suite, et c'est désormais une règle du dépôt : une tranche
n'est finie que lorsqu'on s'en est servi.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| Les six images de T1 et T2 arrivaient « sans projet » et la grille s'ouvrait **vide** | Aucun test n'avait de données antérieures aux projets |
| Elles revenaient avec un coût à zéro — `cout_usd` n'existait pas sur l'asset quand elles ont été écrites | Le total du projet, lui, était juste : il se calcule sur les générations |
| La colonne `cree_le` n'était **jamais réécrite** : l'objet et sa projection divergeaient, et l'ordre de la grille suivait la colonne périmée | Les deux vérités disaient la même chose tant que personne ne changeait la date |
| Deux clics dans le même rendu lisaient la même sélection périmée : le second effaçait le premier au lieu de s'y ajouter | Une main humaine met plus d'un rendu entre deux clics |
| Les assets détachés d'un projet supprimé venaient s'installer dans la grille du projet **ouvert** | Chaque détachement est annoncé, et l'écran fondait sans regarder à qui l'asset appartenait |

Les deux derniers ont la même racine, et elle est nommée : **deux vérités sur la
même chose finissent par diverger.** La fiche ouverte et la sélection n'en font
plus qu'une — la fiche *est* la sélection quand elle vaut un —, et toute colonne
qui double l'objet est désormais réécrite depuis lui.

**Ce qui reste ouvert, et pour T4 :** le zoom 1× / 2× / 4× de la grille, déclaré
au § Layout de `docs/DESIGN.md` et qu'aucun critère de T3 ne demande ; et le
second moteur de détourage, toujours jamais exécuté (`AGENTS.md`).

---

## Phase T4 : Le tableau et l'univers

**User stories** : US-41, US-42, US-43, US-44, US-45, US-46, US-47, US-48, US-49, US-50,
US-51, US-52, US-53, US-54, US-55, US-56, US-57, US-58, US-60, US-61, US-67, US-68, US-69

### Ce qu'on livre

Le tableau d'inspiration, où le collage est le geste principal : une image devient une carte
image, une adresse fait apparaître immédiatement une carte en attente pendant que l'image se
récupère — et qui garde son adresse et sa raison si elle n'arrive pas —, un texte devient une
carte texte. Un fichier qui n'est pas une image est refusé en le nommant. Un doublon est
signalé avec un lien vers l'existant, et reste importable si on le décide. Les cartes se
groupent, s'annotent, gardent leur provenance et se règlent en taille d'affichage.

On promeut une carte en artwork officiel et on lui donne une famille — personnages, objets,
décors, interface, ou « tous » pour une planche de style non figurative. À la génération,
c'est l'application qui choisit ce qui part : les artworks de la famille du sujet, plus les
« tous ». Promouvoir reste un geste unique, il n'y a rien à sélectionner à chaque fois, et le
nombre de références effectivement envoyées est visible au moment de générer.

La bible s'écrit en champs nommés, chacun activable indépendamment pour une génération. La
palette se déduit par calcul des artworks officiels, se montre, et se recalcule quand on en
retire un. Le projet porte enfin ses défauts : modèle par type d'asset, et taille de pixel
cible imposée à tout ce qui rentre — jamais déduite de l'image reçue. La quantification,
grisée depuis T2, s'allume.

Le projet porte aussi son **barème d'échelles** — quelle part de la toile un sujet occupe
selon sa nature : un personnage la remplit, un meuble en prend les deux tiers, un objet tenu
en main moins de la moitié. Sans lui, tout ce qui sort du produit fait la même hauteur : la
séance du 27 août l'a montré sur cinq sujets réels, un coffre aussi haut qu'un personnage, et
la coïncidence n'est pas fortuite — c'est ce que donne l'occupation à 100 %. La taille de
pixel et l'échelle du sujet sont deux réglages distincts, et T2 ne pouvait tenir que le
premier : le second n'a de sens que rapporté aux autres assets du même projet.

Changer la palette d'un projet la réapplique à tous ses assets sans un seul appel payant. Les
assets dont la recette a été touchée à la main sont épinglés : ils sont sautés, le compte de
ce qui a été remis à jour et de ce qui a été conservé est affiché, et un épinglé se réaligne
d'un geste depuis sa fiche.

Un univers vide ne contraint rien : générer sans bible ni artwork reste possible, les défauts
du produit prennent le relais.

### Critères d'acceptation

- [x] Un projet neuf se crée, reçoit une bible et trois planches, et sa palette est extraite.
- [x] La chaîne complète tient d'un bout à l'autre : un asset se génère, se détoure, se ramène sur la grille et la palette du projet, et se range tout seul.
- [x] Coller une adresse fait apparaître une carte en moins d'une seconde, avant que l'image ne soit récupérée, et on continue à coller pendant ce temps.
- [x] Une récupération échouée laisse la carte avec son adresse et sa raison, et se réessaie.
- [x] Un fichier qui n'est pas une image est refusé en le nommant.
- [x] Un doublon est signalé avec un lien vers l'existant, et s'importe quand même si on le décide.
- [x] Générer un décor n'envoie aucun artwork de la famille personnages ; une planche marquée « tous » part avec toutes les générations.
- [x] Le nombre de références envoyées est visible au moment de générer.
- [x] Retirer un artwork officiel recalcule la palette, et le changement se voit.
- [x] Chaque champ de la bible s'active et se désactive indépendamment pour une génération.
- [x] Générer sans bible ni artwork fonctionne : un univers vide ne bloque rien.
- [x] Un personnage et un petit objet générés dans le même projet sortent avec la même taille de pixel, quelle que soit la grille rendue par le modèle.
- [x] Un personnage et un petit objet du même projet sortent **à leur échelle respective**, ancrés sur la même ligne de sol : le barème du projet le décide, jamais un réglage repris à la main sujet par sujet.
- [x] La remise sur grille est systématique, jamais optionnelle, et la cible n'est jamais déduite de l'image reçue.
- [x] La quantification n'est plus grisée dès qu'une palette existe.
- [x] Changer la palette du projet remet ses assets à jour sans un seul appel payant, saute les épinglés, et affiche le compte des deux.
- [x] Un asset épinglé se réaligne d'un geste depuis sa fiche.
- [x] Le modèle est un défaut par type d'asset porté par l'univers, pas un réglage global.
- [x] Réseau coupé : le tableau, la bible, la palette et la retouche fonctionnent ; seule la génération échoue, au moment où on l'essaie.

### Bloquée par

- **T3** — l'univers est porté par le projet, et le projet naît avec la bibliothèque.
- **T2** — la palette alimente la quantification, et la cible de pixel pilote une remise sur grille déjà écrite.

### Tenue le 27 août 2026

**Dix-neuf critères, 28 tests de serveur et 5 d'écran.** Le total du dépôt passe
à 98 tests de serveur et 14 d'écran. Deux critères ne se vérifient que devant
l'écran — la carte qui paraît avant son image, et la palette dont *le changement
se voit* —, et ils vivent donc dans les essais d'écran.

**Deux risques ont été levés avant d'écrire une ligne de T4, et l'un des deux a
retourné une décision.**

- *La palette extraite des artworks.* Premier essai sur les deux planches du
  guide : la coupe médiane appliquée aux images telles quelles rend **vingt gris
  sur vingt-quatre**. Le fond plat occupe 75 % des pixels et son anti-crénelage
  l'éclate en autant de seaux. On détoure donc d'abord — avec le moteur du geste
  courant, celui qui ne charge aucun modèle — et la palette passe à quinze
  couleurs franchement distinctes, toutes prises dans le sujet. *Ce qui est
  majoritaire n'est pas ce qui compte*, exactement comme pour un détourage au
  seuil global.
- *Le barème d'échelles.* Mesuré sur sept sujets réels avant d'écrire quoi que ce
  soit : `sur_grille` tenait déjà tout ce qu'il fallait. Personnage 64 px de
  haut, meuble 42, objet tenu 26, **et tous ancrés sur la même ligne de sol**.
  T4 n'a eu qu'à décider *qui* renseigne `occupation` — le projet, jamais un
  réglage repris à la main sujet par sujet.

**Un défaut dormant a été trouvé, et il attendait cette tranche pour se voir.**
`_palette_imposee` complétait la table Pillow de 256 entrées avec des zéros :
254 noirs purs, et Pillow ramène chaque pixel à la plus proche des 256, pas à la
plus proche de celles qu'on a écrites. Mesuré sur six gris et une palette de deux
couleurs claires, les deux plus sombres ressortaient en `#000000` — une couleur
que la palette du projet ne déclare pas. Invisible jusqu'ici parce que la
quantification imposée était grisée depuis T2 : **le seul chemin qui l'empruntait
n'existait pas encore**. C'est la même famille que le liseré clair du seuil
alpha — une valeur de remplissage qui n'est pas neutre finit par se voir.

**Deux défauts ont été trouvés en ouvrant l'atelier, aucun par les tests.**
C'est la troisième fois de suite, et la règle tient.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| Promouvoir un artwork ne changeait pas le compte de « ce qui part » : l'écran annonçait zéro référence quand le serveur en comptait une, et ne se corrigeait qu'au premier changement de sujet | La règle de T1 n'avait pas bougé — « le catalogue se redemande parce que le grisé dépend de la demande en cours » —, c'est **la demande** qui a gagné une composante que l'écran ne pilote pas |
| Une carte d'adresse qui n'avait pas abouti annonçait `0×0` | Aucun test d'écran ne montait une carte sans image, et zéro est une valeur qui passe partout |

Le premier a la même racine que le doublon de T1 : **une règle juste dont
l'hypothèse a changé sous elle**. Le second est le contraire d'une mesure — « les
dimensions mesurées font foi », et zéro n'est pas une dimension mesurée, c'est
l'absence de mesure.

**La chaîne a été vérifiée par un appel payant réel, et elle a tenu**
(`essais/essai_univers_chaine.py`, 27 août 2026, **$0,0228**). Deux planches
promues — l'une en `personnages`, l'autre en `tous` —, une bible de quatre champs
actifs sur cinq, et un prompt qui ne dit plus que la chose : *« A hooded forest
ranger standing idle, facing the viewer »*. Ce qui est revenu portait le style
des planches sans qu'un mot de style ait été écrit.

| Ce qu'on voulait savoir | Ce qui est arrivé |
|---|---|
| Les artworks partent-ils, et lesquels ? | Deux, tous deux en rôle `style`, et le `generation.json` les nomme — une génération se relit des mois après |
| L'asset naît-il habillé ? | Détourage, grille 64 px à 100 %, quantification sur les 24 couleurs du projet, **et non épinglé** : l'univers n'épingle pas |
| La palette imposée tient-elle sur une vraie image ? | 57 196 couleurs au brut, **22 au rendu, zéro hors de la palette du projet** — la correction de `_palette_imposee` se vérifie ici, pas au banc |
| Le barème sépare-t-il les échelles ? | Cinq hauteurs distinctes sur six paliers — 64, 58, 42, 32, 26 px — **et une seule ligne de sol** |

**Un seul appel a suffi**, et c'est une décision de l'essai : tout ce qui ne
demande pas le fournisseur se vérifie sans lui. Le barème s'est mesuré en
appliquant six échelles à **la même image reçue** — six sprites pour le prix
d'un aller-retour.

**Ce qui reste ouvert, et pour T5 :** le zoom 1× / 2× / 4× de la grille d'assets,
reconduit de T3 et qu'aucun critère de T4 ne demandait — les vignettes du tableau
en partagent les crans mais n'en sont pas ; et le second moteur de détourage,
toujours jamais exécuté, qu'`AGENTS.md` renvoyait à T4 « sur les images du
tableau d'inspiration » et qu'aucun des dix-neuf critères ne demandait.
L'extraction de palette, elle, n'en a pas eu besoin : elle emprunte le
remplissage depuis le bord, comme le geste courant.


---

## Phase T5 : Le slicer

**User stories** : US-72, US-73, US-74

### Ce qu'on livre

Une planche multi-sprites se découpe par détection des zones opaques connexes : une planche
de huit devient huit assets. Quand la détection se trompe, on corrige à la main — grille fixe
ou sélection —, jamais bloqué par une mauvaise détection. Chaque découpe est un asset à part
entière, rangé comme les autres, dont la filiation pointe vers la planche d'origine.

### Critères d'acceptation

- [x] Une planche de huit sprites devient huit assets, chacun visible dans la grille.
- [x] La filiation de chaque découpe pointe vers la planche et se lit depuis sa fiche.
- [x] Une détection ratée se corrige en grille fixe ou en sélection manuelle, sans jamais bloquer.
- [x] Supprimer la planche laisse ses découpes en place, chacune marquée « parent supprimé ».
- [x] La découpe fonctionne réseau coupé.

### Bloquée par

- **T3** — chaque découpe est un asset rangé et filié ; sans bibliothèque, une planche découpée ne produit que des fichiers.
- **T2** — le détourage fournit l'alpha sur lequel la détection des zones connexes s'appuie.

### Tenue le 27 août 2026

**Cinq critères, 10 tests de serveur et 3 d'écran.** Le total du dépôt passe à
108 tests de serveur et 17 d'écran. **Les deux dettes reportées de T3 et de T2
sont soldées dans la même tranche** — le zoom 1× / 2× / 4× de la grille, et la
première exécution réelle du second moteur de détourage.

**Deux gestes, et c'est la seule décision de conception qui compte.** Le serveur
*propose* des rectangles, il ne découpe que ceux qu'on lui donne. « Une détection
ratée se corrige sans jamais bloquer » n'existe qu'à ce prix : l'écran affiche la
proposition, l'auteur ajoute, retire, redessine, et ce qui part est **sa** liste.
Une route unique qui aurait découpé « en mode auto » aurait fait de la détection
une autorité qu'il faut convaincre.

**Une découpe possède ses octets, et ça se paie en disque pour tenir un
critère.** Une découpe qui n'aurait été qu'un rectangle sur l'image de sa planche
serait morte avec elle : la suppression définitive efface `<rang>-*`, brut
compris. Le brut d'une découpe est donc un **vrai** brut — le rectangle découpé
dans l'image telle qu'elle est arrivée, fond compris, avec quatre pixels de marge
autour. Sans cette marge, le détourage par défaut lirait la couleur du fond sur
une bordure qui n'est que du sujet, et mangerait le sprite.

**Trois défauts ont été trouvés en ouvrant l'atelier, aucun par les tests.**
C'est la quatrième fois de suite, et la règle tient.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| À 4×, une colonne unique s'étirait sur toute la largeur : une tuile de 1028 px pour un cran qui en annonce 512, soit huit fois la taille de repos | Le grisé regardait si **une** tuile tenait. `minmax(cran, 1fr)` accepte une colonne et l'étire — la règle était juste sur le cran, fausse sur ce que le cran promet |
| Le grisé du zoom n'apparaissait jamais | Le `ResizeObserver` livre ses rappels par la boucle de rendu ; un onglet qui ne compose pas ses images ne les livre pas. Une mesure qui dépend d'être *rendu* n'est pas une mesure sur laquelle compter |
| Sur une planche carrée, les rectangles se décalaient de l'image qu'ils désignent | `aspect-ratio` cède devant `max-height` : le navigateur rabote la hauteur **sans redéduire la largeur**. Le cadre faisait 1388 × 874 pour une image carrée, et l'image y restait centrée par `object-contain` |

Le premier et le troisième sont la même famille : **une règle de mise en page
déléguée au navigateur, dont le résultat n'a pas été mesuré**. Le second est le
contraire d'une mesure — et c'est la deuxième fois de suite qu'une valeur par
défaut, ici zéro, se fait passer pour un fait.

**La dette du second moteur de détourage est soldée, et son exécution a retourné
une décision.** `essais/essai_detourage_modele.py`, gratuit, six vraies images
plus un cas composé :

| Ce qu'on voulait savoir | Ce qui est arrivé |
|---|---|
| Le moteur par modèle marche-t-il ? | Oui — première exécution du chemin, jamais empruntée depuis T2 |
| Apporte-t-il quelque chose sur ce que le produit fabrique ? | Non : accord médian **96,3 %** avec le remplissage depuis le bord sur six images à fond plat. Il reste donc facultatif, et le geste courant ne change pas |
| A-t-il une raison d'exister ? | Oui, et elle se mesure : sur un fond chargé, le bord garde **100 %** de l'image — il échoue entièrement — quand le modèle en isole **19,8 %** |
| Combien coûte-t-il ? | **482 ms** contre 147 ms, facteur 3 — après avoir nommé le modèle |

**Ce dernier point est une décision, pas une mesure.** Le défaut de `rembg`
2.0.81 est `bria-rmbg`, un modèle d'un gigaoctet qui met **15,8 s** par image de
1024 px sur processeur. `u2net` met **0,47 s** — trente-quatre fois moins — pour
une silhouette équivalente à deux points près. Le dépôt annonçait « ~180 Mo »
depuis T2 : c'était la taille de `u2net`, et le défaut de la bibliothèque avait
changé sous cette note. Le modèle est désormais **nommé**.

**La chaîne a été vérifiée par un appel payant réel, et elle a tenu**
(`essais/essai_decoupe_planche.py`, 27 août 2026, **$0,0042**). Une planche
demandée exprès à `gpt-image-2` en 16:9 — « huit personnages distincts, deux
rangées de quatre, espacés » —, puis toute la découpe jouée dessus. Ce qui
manquait, c'était exactement ça : **une planche que personne n'avait disposée
pour la détection**. Tous les tests de T5 travaillent sur des sujets posés à des
écarts choisis, sur un fond que l'on sait plat.

| Ce qu'on voulait savoir | Ce qui est arrivé |
|---|---|
| Le modèle rend-il une planche quand on la demande ? | Oui — 1536 × 864, huit personnages, deux rangées de quatre, fond gris uniforme |
| La détection retrouve-t-elle les sprites ? | **Huit zones, ni sept ni neuf**, chacune sur un personnage, de 235 à 314 px de large |
| Dans l'ordre de lecture ? | Oui, et il se voit : chevalier, archère, mage, voleur / paladine, nain, sorcière, druide — exactement la planche, de gauche à droite et de haut en bas |
| Les découpes sont-elles utilisables ? | Huit assets à 64 × 64, détourés, aucun vide, aucun sujet mangé, tous filiés sur la planche, tous à $0,0000 |

**Un seul appel a suffi**, et c'est une décision de l'essai : la détection, la
grille fixe, la découpe, les huit rendus et la filiation ne demandent pas le
fournisseur. Ce qui se paie, c'est l'aller-retour, rien d'autre.

**Une observation à garder pour la suite, qui n'est pas un défaut** : une planche
naît **habillée comme un sprite** — l'univers lui impose sa grille, donc sa tuile
montre huit personnages écrasés dans 64 × 64. C'est le brut qui se découpe, et
la chaîne est juste ; mais rien dans la grille ne dit qu'une image est une
planche avant qu'on ouvre sa fiche.

---

## Phase T6 : L'export

**User stories** : US-76, US-77

### Ce qu'on livre

Une sélection de la grille sort en une archive accompagnée de son descriptif — de quoi
transférer un lot d'un coup et le retrouver plus tard. Quand la sélection est vide, l'export
est grisé et dit pourquoi, comme toute action indisponible du produit.

### Critères d'acceptation

- [x] Une sélection multiple s'exporte en une archive contenant les images et un descriptif.
- [x] Le descriptif porte, pour chaque asset, de quoi le reconnaître et le rejouer : label, prompt, réglages résolus, dimensions mesurées, filiation.
- [x] Sélection vide : l'export est grisé avec sa raison, jamais déclenché sans objet.
- [x] Une image seule se télécharge toujours, sans passer par l'archive.
- [x] L'export fonctionne réseau coupé.

### Bloquée par

- **T3** — l'export part d'une sélection dans la grille.

### Tenue le 27 août 2026

**Cinq critères, 12 tests de serveur et 3 d'écran.** Le total du dépôt passe à
120 tests de serveur et 20 d'écran. La tranche la plus courte des six, et la
seule dont **aucun test ne coûte ni ne demande le réseau** : exporter est du
disque et du processeur, rien d'autre.

**Ce qui part, c'est le rendu — pas le brut.** Celui qu'on voit, celui qui entre
dans le jeu. Le brut reste dans l'atelier : c'est lui qui permet de refaire le
rendu, il n'a rien à faire dans un dossier de jeu, et le descriptif dit lequel
il est — identifiant, recette, empreinte. Corollaire assumé, vu à la première
séance : **un asset qu'on n'a pas traité sort tel qu'il est arrivé**, donc en
1024 px à côté de sprites de 64. Ce n'est pas un défaut, c'est la même phrase
appliquée jusqu'au bout ; et le descriptif porte les deux dimensions, donc
personne ne le découvre dans son moteur.

**Le descriptif est unique, et il fait foi sur les noms.** Un `descriptif.json` à
la racine de l'archive, et rien d'autre : le doubler d'une version lisible à
l'œil créerait deux vérités sur le même lot. Les fichiers, eux, portent le
**label** — c'est le mot que l'auteur reconnaît en ouvrant l'archive —, réduit à
ce qu'un dossier accepte partout et numéroté quand il est déjà pris. Quatre
variations d'un même prompt portent quatre fois le même label : sans
numérotation, `zipfile` les aurait écrites l'une sur l'autre sans broncher, et
l'archive n'aurait rendu qu'une image sur quatre.

**Le refus d'une sélection vide est une phrase du produit, pas un rapport de
schéma.** Tous les autres corps de sélection exigent au moins un identifiant —
la validation les refuserait en anglais et en 422. Celui-ci accepte le vide pour
que le service tranche et dise pourquoi, parce que le MCP de T7 n'a pas d'écran
devant lui pour griser d'abord.

**Un défaut a été trouvé en ouvrant l'atelier, et il n'appartenait pas à T6.**
C'est la cinquième fois de suite que la séance trouve ce qu'aucun test n'a vu.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| À 1280 px, panneaux ouverts, **sélectionner une image faisait glisser l'atelier entier vers la droite** — en-tête et pied compris —, et le bouton d'export finissait 150 px hors de l'écran | Une piste `minmax(0,1fr)` ne borne pas ce qu'on pose dedans : l'**élément**, lui, vaut `min-width: auto`, donc la largeur de son contenu. La barre d'outils demandait 963 px pour 740, et élargissait sa colonne jusqu'à la page |
| Le choix « Ranger… » se dimensionnait sur son option la plus longue | Un `select` prend la largeur de son plus long libellé, et les libellés sont des **noms de projets** — donc sans plafond. Il faisait déjà 162 px pour deux projets |

Les deux sont la même famille que le premier et le troisième défaut de T5 :
**une règle de mise en page déléguée au navigateur, dont personne n'a mesuré le
résultat.** Le premier a traversé T3, T4 et T5 sans se voir parce que rien
n'était ancré à droite de cette barre : ce qui débordait sortait de l'écran, et
seul un contrôle **permanent** — l'export grisé — l'a rendu visible.

**Et il en reste une contrainte mesurée, qui appartient au design et pas à cette
tranche.** La barre d'outils demande 747 px avec une sélection ; la colonne
centrale vaut `largeur − 920` quand la fiche est ouverte, soit **520 px à
1440**. Aucune économie de largeur ne fait tenir 747 dans 390. La barre défile
donc plutôt qu'elle ne rogne — avec la barre de 9 px que le produit dessine
déjà, sans hauteur neuve, et rien n'est caché sans le dire. Ce qui reste à
trancher est une question de `docs/DESIGN.md` : quatre colonnes fixes plus une
barre d'outils de 750 px ne cohabitent pas en dessous d'environ 1560 px.

**Vérifié sur les vraies images du dépôt, sans un centime** : les sept assets de
la bibliothèque exportés d'un coup par l'atelier lancé, 813 Ko, sept PNG plus le
descriptif. Chaque fiche confrontée à son fichier — dimensions mesurées sur les
octets qui partent, prompt et réglages résolus présents, sept noms pour sept
images. Les PNG sont **rangés sans recompression** (ils sont déjà dégonflés) et
le descriptif comprimé : c'est du texte, et il se comprime.

---

## Phase T7 : Le MCP

**User stories** : US-39, US-78, US-79, US-80, US-81, US-82, US-83, US-84, US-85, US-86,
US-87, US-88, US-89, US-90, US-91, US-96

### Ce qu'on livre

Une dizaine d'outils épais, façade sur les services que l'écran appelle déjà — aucune logique
propre, aucun geste que l'atelier ne sache pas faire. L'agent demande un asset et reçoit un
chemin de fichier : l'univers du projet s'applique tout seul, le traitement aussi, le
rangement aussi. Il fixe un délai d'attente et obtient son image directement la plupart du
temps ; passé ce délai, il reçoit un identifiant qu'il peut interroger. Il liste projets,
assets et modèles pour réutiliser plutôt que regénérer, importe un fichier local, retouche,
découpe, exporte. Il écrit directement dans le dossier du jeu : un dossier manquant est créé,
un fichier de même nom n'est jamais écrasé, un dossier non inscriptible est refusé avec le
chemin fautif.

Sans projet nommé, c'est le projet ouvert dans l'atelier qui reçoit. Un projet inconnu est
refusé avec la liste des projets existants, et rien n'est créé au passage.

Aucune invite d'autorisation, jamais : l'agent ne se fige pas quand l'auteur ne regarde pas
l'écran, et l'auteur n'est pas interrompu quand il regarde ailleurs. Au plafond, l'agent
reçoit un refus qui nomme le plafond et le moyen de le relever. Les deux garde-fous — plafond
de générations par session, modèle d'exploration imposé — sont relus à chaque appel : les
changer ne demande aucun redémarrage. L'écran Réglages, ouvert en T1 pour la seule clé, tient
désormais les trois : clé, garde-fous, dossiers.

Côté atelier, ce que l'agent produit apparaît en direct dans la grille, marqué de sa
provenance et distinguable d'un coup d'œil de ce que l'auteur a produit, et un compteur
discret montre sa consommation.

### Critères d'acceptation

- [x] Un agent branché sur l'atelier génère un asset dans le bon projet sans aucune intervention, et reçoit un chemin de fichier.
- [x] Aucun outil ne réimplémente un geste : chacun appelle le service que l'écran appelle, et ce que l'agent peut faire est exactement ce que l'écran peut faire.
- [x] L'univers du projet s'applique à une demande de l'agent sans qu'il ait à répéter le style.
- [x] Une attente courte rend l'image directement ; passé le délai fixé par l'appelant, elle rend un identifiant interrogeable.
- [x] L'agent liste projets, assets et modèles, importe un fichier local, retouche un asset existant et exporte une sélection.
- [x] Au plafond : refus qui nomme le plafond et le moyen de le relever, et aucune invite n'apparaît à l'écran.
- [x] Projet inconnu : refus accompagné de la liste des projets existants, et aucun projet n'a été créé.
- [x] Sans projet nommé, l'asset atterrit dans le projet ouvert dans l'atelier.
- [x] Dossier manquant créé ; fichier de même nom jamais écrasé ; dossier non inscriptible refusé avec le chemin fautif.
- [x] Relever le plafond, le désactiver, changer ou lever le modèle imposé prend effet à l'appel suivant, sans redémarrage.
- [x] Ce que l'agent produit apparaît en direct dans la grille, marqué de sa provenance.
- [x] Le compteur de consommation de l'agent est lisible sans quitter l'atelier.
- [x] Clé, garde-fous et dossiers se règlent depuis un seul écran.

### Bloquée par

- **T6** — dernière tranche de la V1. En substance, toutes les précédentes : chaque outil est
  la façade d'un geste déjà livré — générer en T1, retoucher et détourer en T2, ranger et
  lister en T3, appliquer l'univers en T4, découper en T5, exporter en T6. C'est ce qui fait
  du MCP une tranche courte, et non un second produit.

### Tenue le 27 août 2026

**Treize critères, 25 tests de serveur et 4 d'écran.** Le total du dépôt passe à
145 tests de serveur et 35 d'écran. **Onze outils, aucun geste neuf** : le seul
que les services ne savaient pas encore faire était « faire entrer un fichier
local », et il a été écrit là où il devait l'être — dans `services/`, avec sa
route HTTP —, pas dans le MCP. C'est la règle 2 de l'architecture appliquée à la
lettre, et un essai la garde en lisant les **imports** du module : ni
fournisseur, ni base, ni disque, donc rien qu'il puisse faire seul.

**Un import passe par une génération, et ce n'est pas une formalité.** La
bibliothèque se reconstruit en parcourant les `generation.json` du disque : un
asset écrit sans le sien serait perdu au premier effacement de l'index,
c'est-à-dire à la première évolution du schéma. Cette génération-là n'a appelé
personne — modèle `import`, coût nul, un emplacement déjà réussi — et elle dit
d'où venait le fichier, ce qu'aucun autre endroit ne pourrait dire ensuite.

**La consommation de l'agent se lit, elle ne se tient pas.** Le premier jet
gardait un compteur d'un côté et un total de l'autre ; *un état dérivable ne se
garde pas en double*, et les deux qui auraient fini par diverger sont précisément
ceux qui doivent s'accorder — le chiffre du refus opposé à l'agent, et celui que
l'auteur lit pour décider de relever le plafond. Elle se calcule donc sur les
générations, seules à connaître ce qui a été demandé **et** ce que les appels
ratés ont coûté. Reste une réserve courte entre l'autorisation et l'écriture,
parce qu'il y a un `await` entre les deux : sans elle, deux appels lancés
ensemble franchiraient tous les deux un plafond qui n'en autorisait qu'un.

**Trois défauts, et les trois trouvés en se branchant pour de vrai.** C'est la
sixième fois de suite.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| **Aucun agent ne pouvait se brancher** : `POST /mcp` répondait 405. Le montage posait son préfixe et le SDK posait le sien — l'adresse réelle était `/mcp/mcp` | L'essai vérifiait « ni 404, ni page d'accueil ». 405 n'est ni l'un ni l'autre : un code assez proche du succès pour qu'une assertion négative le laisse passer. Il fallait **ouvrir la session** pour le voir |
| Corrigé, `/mcp` répondait encore 405 : un montage Starlette ne reconnaît que `/mcp/…`, et le chemin **exact** traversait toute la table pour finir chez les fichiers statiques, qui refusent le `POST` | Même cause seconde : `/mcp/` marchait, et c'est `/mcp` qu'on écrit dans la configuration d'un agent. L'essai ne testait qu'une des deux écritures |
| L'en-tête `Host` était refusé en `421` pour `localhost` | Protection contre le réattachement DNS, justifiée — mais le défaut du SDK n'autorise qu'`127.0.0.1`, et le lanceur ouvre les deux noms indifféremment |

Les trois appartiennent à la même famille que ceux de T5 et T6, déplacée d'un
cran : **une règle déléguée à une bibliothèque, dont personne n'a mesuré le
résultat.** Et la leçon d'essai est neuve : *une assertion négative ne prouve
rien d'un protocole* — l'essai qui les garde ouvre maintenant une vraie session
et vérifie les deux écritures de l'adresse.

**Vérifié sur l'atelier lancé, sans un centime** : onze outils listés par un
vrai client MCP, les 21 assets de la bibliothèque retrouvés avec leurs chemins
absolus, un projet inconnu refusé avec la liste des trois qui existent, un export
posé dans un dossier créé au passage — puis **le même export une seconde fois**,
qui a numéroté au lieu d'écraser —, un dossier fautif nommé dans son refus, et un
import qui est apparu dans la grille marqué `agent`, en `--signal-clair`, à la
taille de pixel de son projet. Rien de tout cela n'a demandé le réseau ni un
appel payant.

**Une contrainte de place, mesurée et assumée.** Le panneau Réglages fait 772 px
de haut avec ses trois blocs : il tient dans une fenêtre ordinaire et **défile**
en dessous d'environ 900 px de hauteur utile. La couche porte déjà
`overflow-y-auto` ; rien n'est inatteignable, et découper les trois questions en
trois écrans coûterait plus que ce défilement — US-96 demande explicitement un
seul endroit.

---

## Phase T8 : La toile

**User stories** : US-98, US-99, US-100, US-101, US-102, US-103, US-104, US-105, US-106, US-107

### Ce qu'on livre

Le tableau d'inspiration gagne une **seconde vue**. La grille ne bouge pas — elle reste ce qui
montre tout d'un coup d'œil, et c'est ce pour quoi elle est bonne — mais un interrupteur ouvre à
côté d'elle une toile : un plan qu'on déplace et qu'on zoome, où une carte se pose où l'on veut et
garde sa place.

Ce qui est déjà rangé y est déjà posé. Chaque `groupe` saisi depuis T4 devient un **îlot** nommé,
avec ses cartes dedans : l'étiquette, qui n'avait jusqu'ici aucune forme, en prend une. Tout le
reste attend dans la **réserve**, une colonne à droite qui n'est pas une grille de plus — c'est la
grille du tableau, filtrée sur ce qui n'a pas encore de place. La règle tient en une phrase, et
c'est tout ce qu'il y a à comprendre de cet écran : **la toile montre ce qui est classé, la réserve
contient ce qui reste à classer.**

Tirer une carte de la réserve dans un îlot **écrit son groupe** ; l'en sortir le vide. Composer et
classer sont le même geste, dans les deux sens, et il n'existe aucun état où ce qu'on voit et ce
qui est écrit divergent. Une carte peut se poser sur la toile nue — elle est alors posée mais non
classée, et son pied le dit : c'est le brouillon, trois images côte à côte pour voir si elles vont
ensemble avant de décider qu'elles font un îlot.

Une carte se redimensionne à la poignée, en **largeur libre aimantée** sur les trois crans du
produit, la hauteur suivant le rapport de l'image. Sur une toile la taille est une place occupée,
pas un niveau de zoom : elle est distincte du cran 1× / 2× / 4× que lit la grille, et aucune des
deux ne ment sur l'autre.

Tout geste de composition **s'annule** — déplacer, redimensionner, classer, déclasser. La pile vit
en mémoire et meurt en quittant l'écran : ce n'est pas de l'historique de projet, c'est le
rattrapage du geste en cours. Elle existe parce que « hors îlot, pas de groupe » ferait autrement
d'un glissement raté l'effacement d'un nom tapé à la main.

Coller pendant qu'on compose reste possible, et ce qui arrive arrive **en réserve** — jamais au
milieu d'un îlot qu'on vient de faire.

C'est la seule tranche du produit qui ajoute une **dépendance** à l'interface : le plan, la
transformation, la sélection et le confinement dans un îlot ne s'écrivent pas à la main. Les
cartes, elles, restent les composants du produit — la librairie fournit la surface, jamais la
forme. Le choix appartient à `ARCHITECTURE.md` ; il est noté ici parce qu'il est le seul de son
espèce dans tout le plan.

### Critères d'acceptation

- [x] La grille du tableau est inchangée : mêmes cartes, même menu au survol, mêmes crans de vignette.
- [x] Un projet dont les cartes portent trois groupes ouvre la toile sur trois îlots nommés et peuplés, sans qu'aucun geste ne soit demandé.
- [x] Une carte sans groupe n'est pas sur la toile : elle attend en réserve.
- [x] Tirer une carte de la réserve dans un îlot écrit son groupe, et la grille le montre aussitôt.
- [x] Sortir une carte de son îlot vide son groupe ; la ramener en réserve fait la même chose.
- [x] Une carte posée sur la toile hors de tout îlot reste posée et sans groupe : l'état existe, et son pied le dit.
- [x] Fermer l'écran et le rouvrir rend la toile telle qu'elle a été laissée — positions, largeurs, îlots.
- [x] Coller une image pendant qu'on compose fait apparaître une carte en réserve, et rien ne bouge sur la toile.
- [x] Ctrl+Z annule le dernier geste de composition, déclassement compris, et le champ retrouve sa valeur d'avant.
- [x] Quitter l'écran vide la pile d'annulation : au retour, ce qui est sur disque fait foi.
- [x] Redimensionner une carte sur la toile ne change pas son cran de vignette dans la grille, et réciproquement.
- [x] L'écran tient en trois colonnes sans qu'aucune n'écrase les autres, et les réglages de l'univers restent visibles pendant qu'on compose.
- [x] Réseau coupé : la toile, la réserve et le classement fonctionnent entièrement.

### Bloquée par

- **T4** — la toile ne fait que donner une forme à ce que T4 a créé : la carte, son groupe, sa
  note. Sans tableau d'inspiration, il n'y a rien à poser et rien à classer.

### Tenue le 28 août 2026

**Treize critères, 15 tests de serveur, 6 d'écran et 13 de géométrie.** Le total du dépôt passe à
160 tests de serveur et 55 d'écran. **Deux champs sur la carte, aucune entité neuve** : `position`
et `largeur_libre`, portées par la carte elle-même et écrites par la route qui portait déjà son
groupe. Aucune route n'a été ouverte, et c'est la décision qui tient toute la tranche — tirer une
carte dans un îlot écrit sa place *et* son groupe, et deux appels rendraient possible l'état où
l'un est écrit et l'autre non.

**L'îlot est calculé, il n'est écrit nulle part.** Un îlot *est* le groupe : il n'a ni identité, ni
fichier, ni position à lui, et l'écran le dessine comme l'étendue de ses membres. Il n'existe donc
aucun état où la toile montrerait un rangement que le disque ne dit pas — et un îlot vide n'existe
pas, faute de quoi l'écrire.

**`docs/ARCHITECTURE.md` §6.5 annonçait `parentId` + `extent: "parent"` pour le confinement dans un
îlot ; c'est la seule décision de la tranche qui a été renversée à l'exécution.** Ce mécanisme
*enferme* un enfant dans son parent : il interdit très exactement « sortir une carte de son îlot »,
qui est un critère de la tranche. Il exige de surcroît que l'îlot soit un nœud avec sa propre
position — donc une entité, donc un second rangement. Le document a été corrigé.

**Cinq défauts, et les cinq trouvés en s'en servant.** Septième fois de suite. Trois d'entre eux
appartiennent à la famille qui revient depuis T5 — *une règle déléguée à autre chose, dont personne
n'a mesuré le résultat* — et deux à une famille neuve : *un garde juste dont l'hypothèse est
fausse*.

| Ce qui n'allait pas | Ce qui l'a rendu invisible |
|---|---|
| **Toute la toile était invisible dans un onglet d'arrière-plan.** La librairie rend `visibility: hidden` un nœud dont elle ne connaît pas la taille, et elle l'apprend par un `ResizeObserver` — *qui ne livre rien à un onglet qui ne compose pas ses images* | Troisième fois que ce piège se referme (T5, T6, T8). jsdom ne met rien en page, donc aucun essai d'écran ne peut voir un nœud caché : le rendu y est identique. Il a fallu regarder l'atelier lancé. Corrigé en **donnant** ses dimensions à chaque nœud — elles sont calculées de toute façon, puisque l'étendue d'un îlot est celle de ses membres |
| **La toile s'ouvrait sur un coin de plan**, le premier îlot dépassant à gauche du cadre : `fitView` posé en propriété s'exécute au montage, quand les nœuds n'existent pas encore | Et corrigé une fois, il renonçait encore en silence : la librairie tient les dimensions de son plan par le même `ResizeObserver`, donc elle les croyait nulles là où `getBoundingClientRect` rendait 519 × 638. Le cadrage se calcule désormais sur une largeur **lue à la demande** |
| **Ctrl+Z n'annulait jamais rien.** Le garde « un champ de saisie a sa propre annulation » voyait un `<textarea>` actif à chaque frappe : celui du prompt de l'atelier, qui prend le focus au démarrage et ne le rend jamais — l'écran Univers *couvre* l'atelier au lieu de le remplacer | La règle est juste, son hypothèse était fausse : on ne tape pas dans un champ qu'un écran recouvre. Trouvé en écrivant l'essai, qui tombait sans qu'on comprenne pourquoi. Le garde est désormais borné à l'écran qui le pose |
| **Un îlot neuf se posait dans un îlot entamé.** Un groupe dont une seule carte était placée s'étend vers le bas en accueillant les autres ; le socle sous lequel les îlots neufs se calent était mesuré **avant** ce placement | Invisible au banc : il faut un tableau où un même groupe mélange des cartes posées et des cartes qui ne l'ont jamais été — c'est-à-dire un tableau qu'on a vraiment commencé à composer. Vu sur les 55 cartes de *Cœur de pierre* |
| **La poignée de largeur n'élargissait rien tant qu'on tirait.** La carte ne changeait de taille qu'après l'écriture et son retour par le flux : on tirait une poignée devant une carte immobile, et la place occupée ne se voyait qu'une fois lâchée | Le curseur de T2 avait déjà tranché cette question — *la valeur suit la main, l'écriture suit le relâchement* — et la moitié « suit la main » manquait ici. Corrigé, plus une seconde fragilité du même geste : la valeur à écrire vit désormais aussi dans une référence, parce qu'un `pointerup` qui suit son `pointermove` d'assez près lit un rappel fabriqué au rendu d'avant |

**Vérifié sur l'atelier lancé, sans un centime.** Sur les 55 cartes de *Cœur de pierre* : trois
îlots nommés et peuplés à l'ouverture sans qu'aucun geste ne soit demandé, 46 cartes en réserve, les
trois colonnes à `380 · 519 · 380` sans un pixel de débordement de page. Puis les gestes, un par
un — une carte tirée de la réserve dans l'îlot *ciel* y a écrit son groupe **et** une place calculée
au zoom courant ; la même ramenée en réserve a perdu les deux ; Ctrl+Z l'a remise exactement où elle
était, groupe et coordonnées compris ; la poignée a écrit une largeur libre de 673 px — le cran 4×
**mesuré** sur la grille de la réserve, atteint par l'aimant depuis 663 — sans toucher au cran de
vignette, resté à 1×. La composition d'essai a ensuite été défaite : le projet est rendu tel qu'il
était.

**Ce que la vérification n'a pas pu couvrir, et qui reste à faire à la main :** le glissement d'une
carte **sur** le plan, et le déplacement du plan lui-même. Les deux passent par la gestion de
pointeur de la librairie, qui ne démarre pas sur des événements synthétisés — le même `pointerdown`
ne déplace pas davantage le plan que la carte, ce qui montre que la limite est celle du banc et non
du produit. Ce qui suit ces deux gestes, en revanche, est vérifié : le classement au relâchement est
le **même code** que celui du dépôt depuis la réserve, éprouvé ci-dessus.

**Une décision d'apparence à trancher à l'œil.** La librairie affiche sa signature en bas du plan.
Elle est sous licence MIT et la retirer demande un abonnement à son éditeur : elle est **gardée**,
et c'est un choix, pas un oubli.

---

## Phase T9 : Les liens et les notes

**User stories** : US-108, US-109, US-110, US-111

### Ce qu'on livre

Ce que T8 permet de ranger, T9 permet de le **dire**. On tire d'un objet à un autre — carte, note
ou îlot — et un lien paraît : un trait nu, sans direction ni texte. Il reçoit après, si le rapport
mérite un mot, une étiquette courte et une pointe de flèche quand le sens compte. Le défaut est
muet, l'exception s'exprime. Un lien dont une extrémité disparaît disparaît avec elle : un trait
vers rien ne représente rien, et il n'y a pas de fantôme utile à montrer.

Le lien est le seul objet vraiment neuf du modèle depuis T4. Il vit dans le dossier du projet, un
fichier par lien, comme une carte.

Une **note** se pose à même la toile, sans passer par le collage : c'est la carte texte de T4,
créée là où elle s'applique plutôt qu'au bout d'une liste.

Enfin la couleur entre, et elle entre **bornée**. Six teintes sourdes, choisies pour ne ressembler
à aucune des quatre couleurs qui portent déjà un sens dans le produit, et aucun code hexadécimal à
saisir. Un îlot en prend une, une note aussi. Rien d'autre n'est colorable : colorier chaque carte
reconstruirait un second rangement, invisible dans la grille et concurrent du groupe — ce que la
tranche précédente a justement écarté.

### Critères d'acceptation

- [ ] Un lien se trace d'une carte à une autre en un seul geste, et suit les deux objets quand on les déplace.
- [ ] Un lien relie aussi bien une note à un îlot que deux cartes.
- [ ] Un lien naît sans mot ni pointe ; l'un et l'autre s'ajoutent après coup, et se retirent.
- [ ] Supprimer une carte fait disparaître les liens qui y aboutissaient, sans laisser de trait orphelin ni d'entrée morte sur le disque.
- [ ] Une note se crée directement sur la toile, et c'est une carte texte : on la retrouve dans la grille.
- [ ] Les six teintes sont les seules disponibles, et aucune ne se confond avec une couleur sémantique du produit — vérifié à côté d'une carte en échec.
- [ ] Une carte image ne porte aucune couleur d'organisation.
- [ ] Ctrl+Z annule la création comme la coupe d'un lien.
- [ ] Réseau coupé : tout de cette tranche fonctionne.

### Bloquée par

- **T8** — un lien joint des objets posés, et une couleur colore un îlot. Sans toile, il n'y a ni
  position, ni îlot, ni rien à relier.

---

## Ce que ce plan ne couvre pas

La chaîne de production s'arrête à T7 ; T8 et T9 s'y ajoutent sans en changer l'ordre — elles
sont nées de l'usage et non du cadrage, et rien avant elles ne les attend. Les tuiles qui se
raccordent, le personnage et ses poses préparées, l'animation de sprites et le son sont décrits
en V2→V5 dans `ARCHITECTURE.md` §7 à §10, et ne commencent pas avant que la V1 serve pour de
vrai.

Deux points restent ouverts, et aucune tranche ne les présuppose :

- **La recette d'animation** est le risque de la V4. Une piste sérieuse a été observée le
  26 août 2026 ; elle demande un prototypage dédié avant tout engagement.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille livré en T4 limite l'envoi, mais un univers riche
  renchérit quand même et peut inverser le classement des modèles par coût. À surveiller dès
  les premières séances réelles, une fois T4 en place.
