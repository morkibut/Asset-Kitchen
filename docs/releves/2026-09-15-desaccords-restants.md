# Les désaccords de nom qui restent, écran par écran — 15 septembre 2026

Écrit en fermant `RP3`. C'est la **décision 3** du
[plan de remise à plat](../PLAN-remise-a-plat.md) : les noms de l'ossature se ferment d'un coup
parce qu'ils ne bougeront plus ; les autres se ferment **dans la tranche qui touche leur
écran**, sinon on renomme deux fois.

**Ce qui n'est pas ici.** Les portes du carnet, les onglets de la fiche d'un sujet, le titre de
chaque écran et le mot d'un retour en arrière : ils sont dans
[`docs/vocabulaire.html`](../vocabulaire.html) § *L'ossature — liste fermée*, et
`py essais/essai_vocabulaire.py` les tient. Ce document ne relève que ce qui vit **à l'intérieur**
d'un écran.

**Comment s'en servir.** Une tranche qui ouvre un écran corrige tous les mots de son tableau,
puis raye le tableau. Le mot de droite vient de `docs/vocabulaire.html`, jamais de la maquette :
c'est la décision 1 du plan. Quand les deux disent la même chose, c'est écrit.

**D'où ça vient.** Du [relevé d'écart du 13 septembre](2026-09-13-ecart-maquette-produit.md)
§ *Les désaccords de nom* et de ses tableaux écran par écran. **Les numéros de ligne sont ceux
du 13 septembre 2026** ; ils bougent dès qu'une tranche touche le fichier, et c'est le libellé
de la colonne de gauche qui fait foi, pas la ligne.

---

## Le jeu — *aucune tranche ouverte ne le touche*

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Créer un asset | `TableauDeBord.tsx:124`, `CreerUnAsset.tsx:28` | **Créer un sujet** — *asset* est sur la liste noire |
| Parcourir les assets | `TableauDeBord.tsx:130` | **Parcourir les sujets** |
| Choisissez une chose du jeu | `TableauDeBord.tsx:130` | **Choisissez un sujet** — *chose* est sur la liste noire |

## ~~Univers & toile~~ — **RP9, fait le 16 septembre 2026**

~~Les quatre mots sont corrigés, et les cinq assertions qui les nommaient
suivent.~~

| ~~Aujourd'hui~~ | ~~Où~~ | ~~Le mot~~ |
|---|---|---|
| ~~Inspiration (fil d'Ariane d'une carte)~~ | ~~`lieux-noms.ts:134`~~ | ~~**Univers & toile** — c'est le mot de la porte, et une carte est un étage sous lui~~ |
| ~~de ce paquet~~ | ~~`Toile.tsx:2353`, `:2367`~~ | ~~**de cet îlot** — le même menu dit déjà *Teinte de l'îlot* (`:2323`)~~ |
| ~~Groupe (le champ qui crée un îlot)~~ | ~~`Tableau.tsx:1439`~~ | ~~**Îlot**~~ |
| ~~Retirer (qui supprime la carte)~~ | ~~`Tableau.tsx:1664`~~ | ~~**Supprimer** — *Retirer* est le mot d'un rangement, pas d'une suppression~~ |

## ~~Les sujets~~ — **RP7, fait le 16 septembre 2026**

~~Les huit mots sont corrigés. Ils vivaient dans `BibliothequeDesAssets.tsx`, qui
a fondu dans `Famille.tsx` : la grille d'assets est unique depuis cette
tranche, et c'est elle qui les porte.~~

| ~~Aujourd'hui~~ | ~~Où~~ | ~~Le mot~~ |
|---|---|---|
| ~~Les assets du jeu~~ | ~~`BibliothequeDesAssets.tsx:90`~~ | ~~**Les sujets du jeu**~~ |
| ~~Les choses du jeu, rangées par famille et collection~~ | ~~`:92`~~ | ~~**Les sujets du jeu, rangés par famille et par collection**~~ |
| ~~Rechercher un asset~~ | ~~`:112`~~ | ~~**Rechercher un sujet**~~ |
| ~~Tous les assets~~ | ~~`:113`~~ | ~~**Tous les sujets**~~ |
| ~~Sélectionner les sujets affichés~~ | ~~`:119`~~ | ~~**Sélectionner cette page**~~ |
| ~~Afficher davantage d'assets~~ | ~~`:136`~~ | ~~**Afficher davantage de sujets**~~ |
| ~~Les assets concernés restent sélectionnés~~ | ~~`:80`~~ | ~~**Les sujets concernés restent sélectionnés**~~ |
| ~~Créer un asset~~ | ~~`:93`~~ | ~~**Créer un sujet**~~ |

Trois mots de plus ont suivi dans la même passe, pour la même raison : *Trier les
assets* → **Trier les sujets**, *Aucun asset pour ces filtres* → **Aucun sujet pour
ces filtres**, et *Catalogue des assets*, qui a simplement disparu — l'écran n'a
plus qu'une région centrale, et elle n'a pas besoin d'être nommée deux fois.

⚠️ **Un point de ce tableau reste ouvert, et il n'est pas un mot.** La note de
*Sélectionner cette page* demandait que les pièces d'équipement se cochent
aussi. Elles ne se cochent pas : une pièce n'entre dans aucune collection — elle
a des emplois, pas des poses —, et la cocher promettrait un rangement que le
serveur refuse. Le pied de grille le dit maintenant en toutes lettres plutôt que
de la laisser muette. À rouvrir le jour où une collection saura ranger une pièce.

## Galerie — **RP11**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| ~~sans chose du jeu~~ | `BarreOutils.tsx` | ✅ **sans sujet** — fermé par RP11, le 16 septembre 2026 |
| Rechercher dans les résultats | `GalerieMedias.tsx:161` | **Rechercher un résultat** |
| Modèles 3D · Vidéos | `GalerieMedias.tsx:21-22` | **3D · Vidéo** — les autres onglets du même sélecteur sont au singulier |
| Ouvrir la fiche | `Tuile.tsx:248` | **Ouvrir le résultat** |
| Filiation | `Fiche.tsx:1120` | **Ouvrir les dérivés** |
| favori · ◤ favori | `Fiche.tsx:898` | **Favori** — un seul mot, une seule casse |
| ● (`aria-label="La retenir"`) | `ImagesDuSujet.tsx:266`, `AnimationsDuSujet.tsx:230` | **Choisir pour le jeu** |
| Ouvrir la source 3D › | `GalerieMedias.tsx:236` | **Préparer des rendus 3D** |

## Fabrications — **RP4** (la préparation) et **RP16** (le compteur)

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Nouvelle fabrication | `Fabrications.tsx:55` | **Fabriquer librement** |
| Une image libre · Une vidéo libre · Un son | `Fabrications.tsx:59`, `:62`, `:63` | **Explorations libres** — une section, pas trois cartes |
| Relire les envois · Relire l'envoi vidéo · Relire avant envoi · Relire avant de générer le son · Relire cette étape avant de lancer | `FabricationSuivie.tsx:173`, `FabricationVideoLibre.tsx:137`, `RelectureEquipement.tsx:143`, `FabricationAudio.tsx:55`, `Fabrication3D.tsx:85` | **Relire avant l'envoi** — un seul mot pour une seule fenêtre (RP4) |
| Arrêter les appels restants | `RelectureEquipement.tsx:144` | **Interrompre** — *appel* est sur la liste noire |
| Annuler cette attente | `FileDesCalculsLocaux.tsx:76` | **Interrompre** |
| Ouvrir le clip et son montage | `FabricationSuivie.tsx:170` | **Voir le résultat** |
| Images équipées · {pièce} | `RelectureEquipement.tsx:90` | **Équipements · images fabriquées** |
| De l'image aux sprites en 3D | `Fabrication3D.tsx:76` | **Des images depuis un modèle 3D** — *sprite* est sur la liste noire |
| Modèle · fournisseur · Modèle · Modèle vidéo · Fournisseur et modèle vidéo · Fournisseur et modèle · Méthode locale · Workflow et version · Moteur du modèle | huit fichiers, voir le relevé du 13 septembre § D | **pas encore tranché** — c'est le désaccord que RP3 a inscrit dans `docs/vocabulaire.html`, dernière section |
| Travaux · Reprendre ce travail | `FabricationSuivie.tsx:173`, `:208` | **fabrication** — le mot est désormais défini, et c'est lui que le compteur du carnet compte (RP16) |

## Livrer au jeu — **RP10**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| ~~Associer ce projet → Projet associé~~ | `Livraisons.tsx` | **Associer ce jeu → Jeu associé** — *projet* est sur la liste noire. *Appliqué en `RP10`, avec la légende « 1 · Le jeu Godot ».* |
| ~~Les livraisons conservées~~ | `Livraisons.tsx` | **Historique** — le mot *livraison* reste ; c'est le nom de la section qui manque. *Appliqué en `RP10`.* |
| ~~Reprendre cette révision · Reprendre la livraison~~ | `Livraisons.tsx` | **Relire cette livraison** — un seul mot pour les deux états. *Appliqué en `RP10`.* |
| ~~Sortir {N} fichier(s) ›~~ | `Sortie.tsx` | **Livrer {N} fichier(s)** — la décision 1 de RP3 retire *sortie* comme nom de ce travail. *Appliqué en `RP10`.* |

*« Dossier contenant project.godot » (`Livraisons.tsx:93`) n'est pas un désaccord : c'est un
vrai dossier sur le disque, et `dossier` n'est sur la liste noire que lorsqu'il désigne une
collection.*

## La fiche d'un sujet — **RP8, fait le 16 septembre 2026**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| ~~La fiche de l'asset~~ | `FicheDuSujet.tsx` | **La fiche du sujet** — *Appliqué en `RP8`.* |
| ~~Résumé de l'asset~~ | `FicheDuSujet.tsx` | **Résumé du sujet** — le même écran dit déjà *Nom du sujet*. *Appliqué en `RP8`.* |
| ~~La page du sujet (nom du groupe d'onglets)~~ | `PageDuSujet.tsx` | **Les onglets de sa fiche** — l'écran s'appelle du nom du sujet, pas *La page du sujet*. *Appliqué en `RP8`.* |
| Cases, planches et calibrage | `PageDuSujet.tsx:345` | **sans objet** — la fiche longue fondue dedans ne s'était jamais lue dans ce nom ; ce que le bouton ouvre encore — cases, planches, calibrage — est ce qu'il dit toujours. *Tranché en `RP8`.* |

## Onglet Animations — **RP12**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| À juger · Retenue · Écartée | `AnimationsDuSujet.tsx:731` | **Non jugé · Retenu · Écarté** |
| animation / bande, sur deux boutons voisins | `Montage.tsx:930` et `:934` | **animation** — *bande* ne s'écrit pas |

## Onglet Sources & clips — **RP4**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Préparer un clip vidéo | `SourcesDuSujet.tsx:87` | **Créer un clip vidéo** |
| Importer une vidéo | `SourcesDuSujet.tsx:87` | **Importer une image de départ** — le bouton de la maquette ouvre une source, pas un clip fini |

## Onglet Objectif & règles — **RP13**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Ce qu'il faut pour le jeu | `ObjectifDuSujet.tsx:87` | **Ce qui doit exister dans le jeu** |

## Réglages — **RP2**, qui garde un critère ouvert

| Aujourd'hui | Où | Le mot |
|---|---|---|
| L'installation (fil d'Ariane) | `lieux-noms.ts:122` | **Réglages** — depuis RP2 c'est un onglet, et un onglet ne nomme pas un étage |
| L'installation (nom dans le guide) | `Guide.tsx:102` | **Réglages** |
| Les dépenses (fil d'Ariane) | `lieux-noms.ts:105` | **Réglages** — même raison ; l'onglet, lui, s'appelle *Consommations* |
| Agent MCP | onglet de la maquette | **L'agent** — *MCP* est le nom d'un protocole, pas un mot de l'écran |
| Moteurs & workflows | onglet de la maquette, `WorkflowsLocaux.tsx:36` | **Moteurs & méthodes locales** — le produit écrit déjà *Méthode locale* (`FabricationAudio.tsx:45`) et *Mes méthodes locales* ; *workflow* ne s'écrit que pour nommer le fichier que ComfyUI produit |
| Autoriser la vidéo locale | `DelegationDuJeu.tsx:95` | **Autoriser les méthodes locales** — le réglage ne porte pas que la vidéo |
| Enregistrer le cadre du jeu | `DelegationDuJeu.tsx:110` | **Garder le cadre de l'agent** — c'est l'agent qu'il borne, pas le jeu |

## Retouche et atelier d'une animation — **RP20**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Détourer · Recadrer · Pixéliser · Nettoyer | `Retouche.tsx:163-166` | **Détourage · Recadrage · Pixelisation · Nettoyage** — décision 2 de RP3 |
| La main · Le contour | `Retouche.tsx:167`, `:169` | **Main · Contour** — sans article : les huit sont côte à côte |
| Retourner | `Retouche.tsx:168` | **Retournement** |
| Outil de retouche | `Retouche.tsx:3058` | **Table de retouche** |
| Défaire · Refaire | `Retouche.tsx:4211` | **Annuler · Rétablir** |
| ajusté · Ajuster · ajuster | `Retouche.tsx:4771`, `SurfaceZoomable.tsx:52`, `AtelierDeBande.tsx:2445` | **Adapter** — un seul mot, une seule casse |
| Vitesse | `Montage.tsx:878`, `AtelierDeBande.tsx:2481` | **Cadence** — c'est déjà le mot de la 3D (`Fabrication3D.tsx:82`) |
| en boucle · sens de lecture | `Montage.tsx:889`, `AtelierDeBande.tsx:2739-2751` | **Boucler** |
| image 0 · les images retenues | `Montage.tsx:1270-1272` | **frame** — le même écran écrit déjà *Ordre des frames retenues* en `:1387` |
| Découpe · plusieurs images | `Retouche.tsx:4141` | **Découper une image** |
| superposition · Superposer · Extraire un élément | `Superposition.tsx:447`, `Retouche.tsx:172`, `:4142` | **Extraire un élément** pour le geste, **Superposer** pour la fabrique |
| Associer à un équipement | `Retouche.tsx:4143` | **Utiliser comme équipement…** |
| ‹ revenir | `Montage.tsx:560`, `Clip.tsx:420`, `:833`, `Envoi.tsx:268`, `AtelierDeBande.tsx:2244` | **‹ suivi du nom de l'endroit** — un retour sans destination ne dit rien |
| ‹ fermer | `AtelierDeBande.tsx:1194` | idem |
| Revenir à l'animation · Revenir à la frame | `AtelierDeBande.tsx:1183`, `SourceDeFrame.tsx:26` | **‹ {nom de l'animation}**, **‹ Frame {n}** |
| Revenir à la retouche | `Retouche.tsx:4143`, `AssocierImageEquipement.tsx:35` | **‹ La retouche** |

## Découper une image — **RP21**

| Aujourd'hui | Où | Le mot |
|---|---|---|
| *aucun titre dans l'écran* | `Decoupe.tsx` n'a ni `<h1>` ni `<h2>` | **Découper une image** |
| Découper en N asset(s) | `Decoupe.tsx:517` | **Découper en N sujets** — *asset* est sur la liste noire |
| Revenir aux zones | `Decoupe.tsx:1246` | **‹ Les zones** |

## Choisir dans la bibliothèque — **RP6** ✅ fermé le 15 septembre 2026

~~| Aujourd'hui | Où | Le mot |~~
~~|---|---|---|~~
~~| Revenir au travail | `BibliothequePourImage.tsx:49` | **‹ suivi du nom de l'écran d'où l'on vient** |~~
~~| Afficher les suivantes | `BibliothequePourImage.tsx:60` | **Suivant** — avec **Précédent** en regard |~~

## Importer pour un sujet — **RP5** ✅ fermé le 15 septembre 2026

~~| Aujourd'hui | Où | Le mot |~~
~~|---|---|---|~~
~~| Importer des images / Importer… | `ImporterPourUnSujet.tsx:76`, `ImporterIntelligemment.tsx:122` | **Importer…** — un seul écran après la fusion, donc un seul mot |~~

---

## Les écrans qu'aucune tranche ouverte ne touche

Ils portent des désaccords, et **aucune tranche du plan ne passera par eux**. Ils sont écrits ici
pour qu'on sache que ce n'est pas un oubli : soit une tranche les récupère, soit ils restent en
l'état et cette page le dit.

### L'onglet Équipement, la fiche d'une pièce, l'emploi et le calque

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Son vestiaire | `VestiaireDuSujet.tsx:155` | **Ce que le personnage porte** |
| Ses tenues · Composer une tenue | `TenuesDuSujet.tsx:41` | **Combiner les équipements** — ou bien *tenue* entre au vocabulaire ; les deux ne peuvent pas rester |
| Prête (couverture) / Vérifié (variante) | `api-travaux-equipement.ts:5`, `api-calques.ts:24` | **un seul des deux** — un calque prêt ne change pas de nom selon l'écran |
| Au-dessus du corps / Au-dessus du personnage | `EditeurCalqueCible.tsx:172`, `CalquesDeLEmploi.tsx:89` | **Au-dessus du personnage** |
| Absente · À revoir | `api-travaux-equipement.ts:5` | **Manquant · Base modifiée** |
| Ordre par défaut | `EditeurCalqueCible.tsx:172` | **Superposition** |
| Déplacement horizontal · vertical | `EditeurCalqueCible.tsx:162-163` | **Position X · Position Y** |
| Rayon du pinceau | `EditeurCalqueCible.tsx:160` | **Taille du pinceau (pixels)** |
| Vérifier et retenir cette variante | `EditeurCalqueCible.tsx:183` | **Valider cette frame** |
| Bande ou image à vérifier | `LectureDesCalques.tsx:109` | **Bande / direction à vérifier** |
| Lire / Pause | `TenuesDuSujet.tsx:128` | **Lire l'animation / Arrêter** |
| Revenir aux calques de {pièce} › | `CalquesAnimes.tsx:260` | **‹ {pièce} · {porteur}** |
| Revenir à {porteur} | `Emploi.tsx:302` | **‹ {porteur}** |

### Extraire un élément

| Aujourd'hui | Où | Le mot |
|---|---|---|
| DESSUS · SE DÉPLACE / DESSOUS · FIXE | `Superposition.tsx:456`, `:484` | **Variante équipée / Personnage de base** |
| Caler et retoucher · Calque seul · Résultat | `Superposition.tsx:720` | **Superposition · Élément seul · Sur le personnage** |

### Du modèle 3D aux sprites

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Moteur du modèle | `Fabrication3D.tsx:81` | voir le champ du modèle, tranché en **RP4** |
| Revenir à l'étape | `Fabrication3D.tsx:45` | **‹ {nom de l'étape}** |
| Ouvrir le personnage | `Source3DConservee.tsx:25` | **‹ {nom du sujet}** |

### Installation

| Aujourd'hui | Où | Le mot |
|---|---|---|
| Revenir à ce qui va être demandé · Revenir aux images · Revenir aux animations · Revenir à où tout se range | `Installation.tsx:103`, `:110`, `:117`, `:124` | **‹ {nom de l'étape}** — quatre retours écrits à la main, et les quatre commencent par le verbe |
| Revenir au sommaire · Revenir à la liste | `Installation.tsx:1305`, `ReglesDuJeu.tsx:1821` | **‹ Réglages** |

---

## Ce que ce relevé ne dit pas

- **Les mots de l'ossature.** Ils sont fermés, et un essai les tient :
  `py essais/essai_vocabulaire.py`. Le relancer après chaque tranche est le seul moyen de savoir
  qu'un renommage n'en a pas cassé un autre.
- **Les mots qui n'existent nulle part.** Un écran qui a besoin d'un mot absent du vocabulaire ne
  se débrouille pas tout seul : c'est `docs/vocabulaire.html` qu'on modifie d'abord, avec la
  raison. C'est sa propre règle.
- **Les libellés qui viennent du serveur.** Les noms d'os du squelette 3D, les styles, les axes :
  ils ne sont écrits nulle part dans `interface/src`, et le relevé du 13 septembre les a laissés
  en doute. Ils se ferment le jour où l'on ouvre le catalogue qui les porte.
