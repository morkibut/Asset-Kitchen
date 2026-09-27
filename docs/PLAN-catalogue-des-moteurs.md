# Le catalogue des moteurs — MOM, MO1 à MO8

> Né le 27 septembre 2026 d'une question de l'auteur, en testant « Repeindre » : Qwen-Image 2.1 y
> a un seul réglage alors qu'il en a deux pour créer. « C'est pas centralisé tout ça ? » Non : le
> même moteur est décrit à plusieurs endroits, écrits à la main, qui ne se suivent pas. L'auteur a
> choisi **tout ranger, par étapes**, et **une page « Moteurs » dans les Réglages**.
>
> Modèles et niveaux de réflexion : `docs/PLAN-catalogue-des-moteurs-affectation.md`.

## Ce que c'est

**Chaque moteur d'IA est décrit une seule fois**, et tous les outils de l'atelier lisent cette
description. Un moteur, c'est :

1. **son nom**, le même dans tous les écrans ;
2. **ce qu'il sait faire** : créer une image, repeindre une zone, animer, finir une animation sur
   une image, faire un son, faire un objet 3D, détourer ;
3. **ses réglages** : rapide / qualité, formats, durées ;
4. **son état** : installé, à installer, ou il manque une clé.

Chaque outil demande « quels moteurs savent faire ça ? » et montre la réponse telle quelle — ceux
qui ne peuvent pas sont grisés avec leur raison.

**Ce que l'auteur voit changer** : les mêmes noms et les mêmes réglages partout ; un moteur
installé une fois sert partout où il peut servir ; un moteur neuf apparaît de lui-même dans tous
les outils qui peuvent s'en servir ; une page « Moteurs » montre tout au même endroit.

## Ce que ce n'est pas

- **Pas un moteur de plus.** Rien de ce qui marche ne disparaît.
- **Les moteurs en ligne ne changent pas de source** : leur liste arrive toujours de chez le
  fournisseur. Ils entrent dans le même catalogue, c'est tout.
- **Le programme 3D reste un programme à part** : il entre au catalogue avec son nom, ce qu'il
  sait faire et son état ; ses réglages détaillés restent les siens.

## Ce qui a été relevé avant d'écrire

Relevé du 27 septembre 2026, en lecture seule :

- Les moteurs de la machine vivent dans `atelier/fournisseur/catalogue_styles.py` en **deux listes**
  (`STYLES` pour créer, `OUTILS` pour repeindre), et leurs formats dans
  `atelier/fournisseur/styles_locaux.py`. Six couples de la seconde liste recopient la première
  (`qwen21-qualite` / `qwen21-retouche-zone`, `sdxl-pixelart` / `sdxl-retouche-zone`, …).
- Qwen-Image 2.1 est décrit à **sept endroits**, et Klein, Z-Image, FLUX.1, SDXL de la même façon.
- La vidéo a trois sources assemblées à part (OpenRouter, la fiche maison de Wan, les workflows
  importés) ; un workflow vidéo importé ne peut jamais finir sur une image choisie, même si son
  graphe le permet.
- Le son a ses moteurs dans `atelier/audio/graphes.py`, que deux écrans redisent à la main.
- Des écrans tiennent leurs propres listes : les noms des familles locales
  (`interface/src/api-workflows.ts`), les moteurs de son (`FabricationAudio.tsx`,
  `WorkflowsLocaux.tsx`), les réglages 3D (`Fabrication3D.tsx`).
- Plusieurs questions ont deux routes pour la même réponse (les styles, la zone, la vidéo
  importée).

## Les règles qui tiennent pendant tout le chantier

- **Le nom d'un modèle déjà enregistré ne change pas** (`AGENTS.md`, point 1). Une image, un clip
  ou un son fait avant le chantier se rouvre, se relit et se relance sans erreur (point 8septies) :
  un essai par étape le referme et le rouvre.
- **Le catalogue décide, jamais une liste en dur** (règle durable) : ce chantier l'étend aux
  moteurs de la machine, qui y échappaient.
- **Rien ne s'installe ni ne se télécharge tout seul** (règle durable).
- **Chaque étape laisse l'atelier utilisable** : on peut s'arrêter après n'importe laquelle.
- **Chaque étape se joue au navigateur, de A à Z** : trouver le moteur, s'en servir, voir ce qui
  revient, le retrouver plus tard.

## MOM · La maquette de la page « Moteurs »

Avant tout code. La page dans les Réglages, et la façon dont un outil montre un moteur qu'il ne
peut pas utiliser.

- [x] Une maquette montre la page : les moteurs groupés (sur la machine, en ligne), pour chacun
      son nom, ce qu'il sait faire, ses réglages, son état et le bouton qui convient.
      → `docs/maquettes-atelier-unifie/05-moteurs.html` (+ `moteurs.css`, `moteurs.js`).
- [x] Elle montre le choix du modèle dans un outil (Créer, Repeindre, Animer) : mêmes noms, mêmes
      groupes, moteur non installé grisé avec « l'installer dans Moteurs › ».
      → même maquette, les trois outils (« Aller à » en bandeau).
- [x] Validée par l'auteur.

## MO1 · Les images de la machine : créer et repeindre, une seule description

Reprend et remplace `PX11` de `docs/PLAN-idees-pixellab.md`.

- [x] Une seule description par moteur et par réglage ; « sait repeindre une zone » en est une
      capacité, pas une seconde fiche. → `ZONES` se calcule depuis `STYLES`
      (`atelier/fournisseur/catalogue_styles.py`) ; `OUTILS` n'en est plus qu'une vue, pour les
      cinq anciens identifiants déjà écrits sur des générations.
- [x] Dans Repeindre, les mêmes choix que pour créer — **Qwen « Très rapide » et « Meilleure
      qualité » compris** —, avec les mêmes noms.
- [x] Un moteur installé pour créer sait repeindre sans rien installer de plus.
- [x] Les formats vivent avec le moteur, plus à côté.
- [x] Un repeint fait avec l'ancien outil se rouvre et se relance.
- [x] Les essais de `PX2`, `PX7`, `PX9` et des moteurs locaux passent.
      ⚠️ Reste, pour `MO7` : `atelier/mcp/serveur.py` (`repaints_zone`) ne marque encore que les
      jumeaux déjà créés, pas tout style qui sait repeindre (le texte du guide périmé, lui, est
      corrigé par `MO2`).

## MO2 · La page « Moteurs »

- [x] La page de la maquette, dans les Réglages : tous les moteurs d'image, ce que chacun sait
      faire, son état ; on installe d'ici. → `PageDesMoteurs`
      (`interface/src/composants/Moteurs.tsx`), dans l'onglet « Moteurs & workflows » (non
      renommé — ~11 fichiers/essais nomment déjà ce texte, et rien dans `docs/vocabulaire.html`
      n'imposait le mot plus court de la maquette).
- [x] Les boutons « Installer » éparpillés dans les outils laissent place au renvoi vers la page.
      → Repeindre défile jusqu'à la fiche précise et la met en évidence ; Créer (sélecteur natif
      dans la barre qui paie) renvoie à l'onglet sans cibler un moteur précis, faute de pouvoir
      porter un lien par option.
- [x] Une ligne au guide (`AGENTS.md`, point 7). → l'entrée périmée sur « Retouche d'une zone »
      (signalée par `MO1`) est corrigée au passage.

## MO3 · La vidéo

- [x] Wan (la maison), les modèles vidéo d'OpenRouter et les workflows vidéo importés sortent du
      même catalogue, avec les mêmes capacités (image de départ, image de fin, durées).
      → `ServiceAnimation.catalogue` (`atelier/services/animation.py`) assemble et trie les trois
      sources ; `GET /clips/models` ne fait plus que la servir. Chaque ligne porte, dans la même
      forme, `source` (maison / workflow / en_ligne, déclarée par l'animateur), `capacites`
      (`image_de_depart: "obligatoire"` — un mot, pas un booléen : 8bis —, `image_de_fin`,
      `durees`), `cout` (temps ou dollars, 8ter) et `etat` (prêt, à installer, clé manquante,
      indisponible), qui ne dépend d'aucune demande — le grisé reste à côté.
- [x] Un workflow vidéo importé qui sait finir sur une image le dit, et « Fin de l'animation » s'y
      offre. → une liaison `image_de_fin` vers le champ du nœud qui charge l'image de fin
      (`atelier/domaine/workflow.py`), reliable aussi depuis le formulaire d'import
      (« Champ recevant l'image de fin (facultatif) »). Sans image de fin demandée, ce qui ne
      servait qu'à elle quitte le graphe (`sans_image_de_fin`) et le clip finit libre ; une boucle
      ne redépose pas le départ. Un profil sans cette liaison garde sa forme, donc sa version.
      ⚠️ Reste, pour `MO6` : la capacité se lit sur la liaison déclarée, pas encore sur le graphe
      seul (un `end_image` non relié n'est pas deviné), et que ComfyUI tienne l'entrée retirée
      pour facultative ne se vérifie pas (`/object_info`) — si elle ne l'est pas, ComfyUI refuse le
      calcul à l'envoi, en local, sans rien payer.
- [x] « Faire une vidéo libre » et « 4. Le clip » proposent la même liste. → `ChoixModeleVideo`
      (`interface/src/composants/ChoixModeleVideo.tsx`) : mêmes noms (fournisseur · nom — la vidéo
      libre montrait l'identifiant brut), mêmes groupes que la page Moteurs, même ordre (le
      serveur). Un essai monte les deux écrans sur la même réponse et compare ligne à ligne.
- [x] Les moteurs vidéo entrent sur la page « Moteurs ». → section « Vidéo »
      (`interface/src/composants/MoteursVideo.tsx`), montée d'une ligne au bas de
      `PageDesMoteurs` ; Wan « à installer » ouvre « L'installation » (où les fichiers se
      descendent avec leur taille et leur licence), un payant sans clé renvoie aux fournisseurs.
      Une ligne au guide (`reglages.moteurs-video`). Pas encore de renvoi ciblé depuis un outil vers
      une carte vidéo (MO2 ne l'a posé que pour l'image).

## MO4 · Le son

- [ ] Les moteurs de son sortent du même catalogue ; aucun écran ne redit leurs noms.
- [ ] Ils entrent sur la page « Moteurs ».

## MO5 · La 3D, le détourage et le texte

- [ ] Le programme 3D, les modèles de détourage et le modèle de texte du coup de main apparaissent
      sur la page « Moteurs » : nom, ce qu'ils savent faire, état.
- [ ] Les réglages 3D ne sont plus écrits en double dans l'écran.

## MO6 · Les workflows importés par l'auteur

- [ ] Un workflow importé devient un moteur comme les autres : ses capacités se déduisent de ce
      qu'il sait recevoir (une zone, une image de fin, une durée), et il apparaît dans tous les
      outils qui peuvent s'en servir.
- [ ] Il apparaît sur la page « Moteurs », avec son diagnostic.

## MO7 · Les écrans ne tiennent plus de liste à eux

- [ ] Plus aucun nom de moteur, de famille ni de réglage écrit en dur dans l'interface : un essai
      le vérifie.
- [ ] Une question, une route : les doublons relevés plus haut n'en font plus qu'une.

## MO8 · La relecture croisée

- [ ] Les étapes confrontées entre elles et au plan ; les coutures corrigées.
- [ ] Le parcours de A à Z joué au navigateur pour chaque geste (créer, repeindre, animer, son,
      3D), sur un atelier jetable avec de vrais assets des projets de l'auteur.
- [ ] Rien de payé : les vérifications se font en local.
