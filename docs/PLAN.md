# Plan : Asset Kitchen — V1

> **PRD source** : `docs/PRD.md` — 97 user stories.
> **Découpage** : les sept tranches T1→T7 ont été décidées le 26 août 2026, à l'établissement
> de `docs/ARCHITECTURE.md` §6.3. Ce plan ne les redécoupe pas : il leur accroche les user
> stories, leur donne un ordre et des critères d'acceptation vérifiables. C'est lui, désormais,
> qui fait foi sur l'ordre de construction et sur les critères d'acceptation de la V1.
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
| **Carte** | T4 | type, contenu, groupe, note, provenance, taille d'affichage, artwork officiel, famille | — |

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
| Aucun modèle local, aucune carte graphique mobilisée — ni ComfyUI, ni LM Studio, ni GPU | T1, et chaque tranche le conserve |
| Le MCP n'a aucune logique propre : il appelle les services de l'écran | T7 — et c'est ce qui interdit d'y ajouter un geste que l'écran n'a pas |

### Couverture des 97 user stories

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
| | **Total** | **97** |

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

- [ ] Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que celui de la clé.
- [ ] La clé se dépose une fois et n'est plus jamais redemandée.
- [ ] Sans clé : générer est inactif, dit pourquoi, et mène au réglage en un geste.
- [ ] La liste des modèles vient du catalogue du fournisseur ; aucun identifiant de modèle, aucun plafond de références n'est écrit en dur.
- [ ] Un modèle qui ne peut pas honorer la demande en cours est grisé avec sa raison, jamais proposé puis refusé.
- [ ] Un modèle déjà choisi qui devient invalide reste choisi : c'est générer qui devient inactif, avec sa raison. Aucune substitution silencieuse.
- [ ] Quatre variations d'un même prompt partent en parallèle et affichent chacune son avancement.
- [ ] Une génération se lance pendant qu'une autre tourne, sans attendre la première.
- [ ] Sur quatre variations dont deux échouent : deux images arrivent, deux emplacements portent une raison lisible et un bouton relancer, et relancer l'un ne rejoue pas les autres.
- [ ] L'onglet est fermé pendant une génération : à la réouverture, l'image est là.
- [ ] Le serveur est arrêté pendant une génération : au redémarrage elle est marquée interrompue, son coût réel est lisible, et aucune relance n'a eu lieu.
- [ ] Deux soumissions de la même génération ne facturent qu'une seule fois.
- [ ] Le coût enregistré est celui que l'appel a facturé, pas le tarif du catalogue ; il est lisible génération par génération.
- [ ] Les dimensions enregistrées sont mesurées sur l'image reçue.
- [ ] Réseau coupé : le démarrage n'affiche aucune erreur, le catalogue affiche sa date en clair, un prompt se prépare, et l'échec ne survient qu'au moment de générer.
- [ ] Une image se télécharge seule, en PNG.

### Bloquée par

Aucune — démarrable immédiatement.

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

- [ ] Une image rendue sur une grille cinq fois trop grosse revient sur la grille cible demandée.
- [ ] Un petit objet et un personnage traités vers la même cible sortent avec le même bloc de pixel.
- [ ] Chaque réglage répond sans attente perceptible, sans appel réseau et sans solliciter la carte graphique.
- [ ] L'image brute est toujours conservée, et revenir à elle est un seul geste.
- [ ] Supprimer le fichier de rendu ne perd rien : il se recalcule depuis la recette.
- [ ] Une recette nommée, réappliquée ailleurs, donne exactement le même résultat.
- [ ] La quantification est grisée avec sa raison tant qu'aucune palette n'existe.
- [ ] Un détourage qui a mangé le sujet se voit immédiatement et se reprend avec d'autres réglages, sans repayer.
- [ ] Plusieurs passes de détourage s'enchaînent, seuil et durcissement réglables à chacune.
- [ ] La comparaison est faite et tranchée : sortie brute du modèle contre sortie post-traitée (risque « qualité pixel art directe », `ARCHITECTURE.md` §11).

### Bloquée par

- **T1** — il faut une image et son enregistrement pour avoir quelque chose à retoucher et où poser une recette.

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

- [ ] Au premier lancement, le projet « Bac à sable » existe déjà et reçoit ce qui sort.
- [ ] Une image produite apparaît dans la grille sans qu'on ait à l'accepter.
- [ ] Aucun échec n'apparaît dans la grille, et chaque appel raté reste lisible avec son coût dans le journal du projet.
- [ ] Le total des coûts par projet est juste, appels ratés compris (achève US-14).
- [ ] La grille sous le prompt et la grille qui sert à organiser sont la même : mêmes filtres, même recherche, même sélection multiple, mêmes pastilles.
- [ ] Un filtre sans résultat affiche l'état vide et le geste pour retirer le filtre.
- [ ] Une bibliothèque vide invite à écrire un prompt.
- [ ] La fiche asset s'ouvre en panneau latéral et se ferme sur la position, le filtre et le prompt d'avant.
- [ ] La filiation d'un asset est lisible depuis sa fiche.
- [ ] Supprimer un asset qui a huit enfants laisse les huit en place, chacun marqué « parent supprimé ».
- [ ] Supprimer un projet annonce le nombre d'assets concernés, et ces assets se retrouvent détachés, pas détruits.
- [ ] Chaque suppression offre une annulation courte, puis devient définitive.
- [ ] La base d'index effacée, la bibliothèque se reconstruit depuis les fichiers sans perdre un asset.
- [ ] Un asset se réinjecte dans le générateur comme référence, source d'édition, guide de style ou jeu de réglages.
- [ ] Les trois panneaux et la grille tiennent ensemble sur l'écran large ; replier un panneau est un choix, jamais une contrainte de place.
- [ ] Réseau coupé : bibliothèque, retouche et détourage fonctionnent normalement.

### Bloquée par

- **T2** — la bibliothèque range des assets faits d'une image brute et d'une recette ; sans la recette, elle indexerait des fichiers plats et devrait être reprise.

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

Changer la palette d'un projet la réapplique à tous ses assets sans un seul appel payant. Les
assets dont la recette a été touchée à la main sont épinglés : ils sont sautés, le compte de
ce qui a été remis à jour et de ce qui a été conservé est affiché, et un épinglé se réaligne
d'un geste depuis sa fiche.

Un univers vide ne contraint rien : générer sans bible ni artwork reste possible, les défauts
du produit prennent le relais.

### Critères d'acceptation

- [ ] Un projet neuf se crée, reçoit une bible et trois planches, et sa palette est extraite.
- [ ] La chaîne complète tient d'un bout à l'autre : un asset se génère, se détoure, se ramène sur la grille et la palette du projet, et se range tout seul.
- [ ] Coller une adresse fait apparaître une carte en moins d'une seconde, avant que l'image ne soit récupérée, et on continue à coller pendant ce temps.
- [ ] Une récupération échouée laisse la carte avec son adresse et sa raison, et se réessaie.
- [ ] Un fichier qui n'est pas une image est refusé en le nommant.
- [ ] Un doublon est signalé avec un lien vers l'existant, et s'importe quand même si on le décide.
- [ ] Générer un décor n'envoie aucun artwork de la famille personnages ; une planche marquée « tous » part avec toutes les générations.
- [ ] Le nombre de références envoyées est visible au moment de générer.
- [ ] Retirer un artwork officiel recalcule la palette, et le changement se voit.
- [ ] Chaque champ de la bible s'active et se désactive indépendamment pour une génération.
- [ ] Générer sans bible ni artwork fonctionne : un univers vide ne bloque rien.
- [ ] Un personnage et un petit objet générés dans le même projet sortent avec la même taille de pixel, quelle que soit la grille rendue par le modèle.
- [ ] La remise sur grille est systématique, jamais optionnelle, et la cible n'est jamais déduite de l'image reçue.
- [ ] La quantification n'est plus grisée dès qu'une palette existe.
- [ ] Changer la palette du projet remet ses assets à jour sans un seul appel payant, saute les épinglés, et affiche le compte des deux.
- [ ] Un asset épinglé se réaligne d'un geste depuis sa fiche.
- [ ] Le modèle est un défaut par type d'asset porté par l'univers, pas un réglage global.
- [ ] Réseau coupé : le tableau, la bible, la palette et la retouche fonctionnent ; seule la génération échoue, au moment où on l'essaie.

### Bloquée par

- **T3** — l'univers est porté par le projet, et le projet naît avec la bibliothèque.
- **T2** — la palette alimente la quantification, et la cible de pixel pilote une remise sur grille déjà écrite.

---

## Phase T5 : Le slicer

**User stories** : US-72, US-73, US-74

### Ce qu'on livre

Une planche multi-sprites se découpe par détection des zones opaques connexes : une planche
de huit devient huit assets. Quand la détection se trompe, on corrige à la main — grille fixe
ou sélection —, jamais bloqué par une mauvaise détection. Chaque découpe est un asset à part
entière, rangé comme les autres, dont la filiation pointe vers la planche d'origine.

### Critères d'acceptation

- [ ] Une planche de huit sprites devient huit assets, chacun visible dans la grille.
- [ ] La filiation de chaque découpe pointe vers la planche et se lit depuis sa fiche.
- [ ] Une détection ratée se corrige en grille fixe ou en sélection manuelle, sans jamais bloquer.
- [ ] Supprimer la planche laisse ses découpes en place, chacune marquée « parent supprimé ».
- [ ] La découpe fonctionne réseau coupé.

### Bloquée par

- **T3** — chaque découpe est un asset rangé et filié ; sans bibliothèque, une planche découpée ne produit que des fichiers.
- **T2** — le détourage fournit l'alpha sur lequel la détection des zones connexes s'appuie.

---

## Phase T6 : L'export

**User stories** : US-76, US-77

### Ce qu'on livre

Une sélection de la grille sort en une archive accompagnée de son descriptif — de quoi
transférer un lot d'un coup et le retrouver plus tard. Quand la sélection est vide, l'export
est grisé et dit pourquoi, comme toute action indisponible du produit.

### Critères d'acceptation

- [ ] Une sélection multiple s'exporte en une archive contenant les images et un descriptif.
- [ ] Le descriptif porte, pour chaque asset, de quoi le reconnaître et le rejouer : label, prompt, réglages résolus, dimensions mesurées, filiation.
- [ ] Sélection vide : l'export est grisé avec sa raison, jamais déclenché sans objet.
- [ ] Une image seule se télécharge toujours, sans passer par l'archive.
- [ ] L'export fonctionne réseau coupé.

### Bloquée par

- **T3** — l'export part d'une sélection dans la grille.

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

- [ ] Un agent branché sur l'atelier génère un asset dans le bon projet sans aucune intervention, et reçoit un chemin de fichier.
- [ ] Aucun outil ne réimplémente un geste : chacun appelle le service que l'écran appelle, et ce que l'agent peut faire est exactement ce que l'écran peut faire.
- [ ] L'univers du projet s'applique à une demande de l'agent sans qu'il ait à répéter le style.
- [ ] Une attente courte rend l'image directement ; passé le délai fixé par l'appelant, elle rend un identifiant interrogeable.
- [ ] L'agent liste projets, assets et modèles, importe un fichier local, retouche un asset existant et exporte une sélection.
- [ ] Au plafond : refus qui nomme le plafond et le moyen de le relever, et aucune invite n'apparaît à l'écran.
- [ ] Projet inconnu : refus accompagné de la liste des projets existants, et aucun projet n'a été créé.
- [ ] Sans projet nommé, l'asset atterrit dans le projet ouvert dans l'atelier.
- [ ] Dossier manquant créé ; fichier de même nom jamais écrasé ; dossier non inscriptible refusé avec le chemin fautif.
- [ ] Relever le plafond, le désactiver, changer ou lever le modèle imposé prend effet à l'appel suivant, sans redémarrage.
- [ ] Ce que l'agent produit apparaît en direct dans la grille, marqué de sa provenance.
- [ ] Le compteur de consommation de l'agent est lisible sans quitter l'atelier.
- [ ] Clé, garde-fous et dossiers se règlent depuis un seul écran.

### Bloquée par

- **T6** — dernière tranche de l'ordre. En substance, toutes les précédentes : chaque outil est
  la façade d'un geste déjà livré — générer en T1, retoucher et détourer en T2, ranger et
  lister en T3, appliquer l'univers en T4, découper en T5, exporter en T6. C'est ce qui fait
  du MCP une tranche courte, et non un second produit.

---

## Ce que ce plan ne couvre pas

La V1 s'arrête à T7. Les tuiles qui se raccordent, le personnage et ses poses préparées,
l'animation de sprites et le son sont décrits en V2→V5 dans `ARCHITECTURE.md` §7 à §10, et
ne commencent pas avant que la V1 serve pour de vrai.

Deux points restent ouverts, et aucune tranche ne les présuppose :

- **La recette d'animation** est le risque de la V4. Une piste sérieuse a été observée le
  26 août 2026 ; elle demande un prototypage dédié avant tout engagement.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille livré en T4 limite l'envoi, mais un univers riche
  renchérit quand même et peut inverser le classement des modèles par coût. À surveiller dès
  les premières séances réelles, une fois T4 en place.
