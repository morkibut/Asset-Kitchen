# La carte des écrans — 4 septembre 2026

> **Huit lectures du code, une carte proposée, deux relectures adverses.** Comme le reste de ce
> dossier, ce document **établit** : il ne fait pas foi. Ce qui fait foi vit dans `docs/DESIGN.md`
> et `docs/design-decisions.md`.
>
> ⚠️ **La carte proposée en partie III n’est pas validée**, et les deux relectures de la partie IV
> lui reprochent des choses lourdes — dont trois qui casseraient des règles écrites du produit.
> **Lire les quatre parties dans l’ordre, ou aucune.** Une carte lue sans ses critiques ferait
> construire trois erreurs déjà repérées.

---

## Sommaire

- **I — Les huit lectures du code** : ce que chaque écran fait vraiment
  1. [Le graphe complet des écrans d'Asset Kitchen — relevé au code, 4 septembre 2026](#lecture-1)
  2. [L'onglet Univers : trois écrans étrangers derrière trois mots — et la toile d'accueil que l'auteur décrit n'existe pas encore](#lecture-2)
  3. [La colonne de gauche du Codex : cinq familles, et trois formulaires de réglage déguisés en familles](#lecture-3)
  4. [Codex — la liste des personnages montre des images, celle de l'Équipement est un formulaire déguisé en liste](#lecture-4)
  5. [Le panneau qui paie au pied du Codex : ce qu'il fait vraiment](#lecture-5)
  6. [La colonne de droite du codex : un vert qui dit deux choses, et un qui n'est jamais calculé](#lecture-6)
  7. [La galerie : ce qu'elle fait vraiment, et où passe la seconde perdue](#lecture-7)
  8. [L'écran d'un personnage : un tableur de six lignes là où l'auteur attend une fiche](#lecture-8)
- **[II — Le diagnostic](#diagnostic)** : pourquoi les écrans n’ont « ni lien ni logique »
- **[III — La carte proposée](#carte)** : non validée
- **[IV — Les deux relectures adverses](#critiques)** : ce que la carte rate et ce qu’elle casserait

---

# I — Les huit lectures du code

<a id="lecture-1"></a>

## 1 · Le graphe complet des écrans d'Asset Kitchen — relevé au code, 4 septembre 2026

L'application n'a pas d'écran d'accueil : elle s'ouvre directement sur la Galerie, et le seul endroit du produit où l'on choisit sur quel jeu on travaille est une petite section « Projets » cachée dans la colonne de gauche de cette Galerie (App.tsx:249, Arbre.tsx:96-156). J'ai dénombré 42 surfaces distinctes réparties sur 5 niveaux de profondeur, dont une injoignable (l'écran Découpe autonome de la Galerie, App.tsx:2593-2606, jamais ouvert par personne) et une sans porte de sortie propre (l'écran des Tables, la surface de retouche la plus fréquente, qui n'a ni bouton fermer ni touche Échap — Tables.tsx:1042-1078). Sur les cinq reproches précis de l'auteur, cinq sont exacts et deux sont même en dessous de la réalité : la colonne de droite du Codex affiche « pièces d'équipement · N sur N » avec le vert écrit en dur dans le code (Codex.tsx:853-859), et la ligne des poses compare les poses non écartées aux poses réclamées — elle ne regarde aucune image produite (Codex.tsx:839-849). Le bandeau de fabrication qu'il trouve envahissant mesure environ 206 px replié et jusqu'à 40 % de la hauteur de fenêtre déplié (PanneauReglages.tsx:155), et il est rendu sur toutes les surfaces du Codex et de l'établi sauf trois. La structure réelle n'est pas « trois onglets » mais un onglet de rangement (Galerie), un onglet à trois côtés hétérogènes (Univers), et un onglet à sept rubriques dont deux sont des réglages de jeu (Codex) qui ouvre à lui seul quatorze surfaces plus profondes.

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact sur cinq points, en dessous de la réalité sur deux, et un point est plus nuancé qu'il ne croit. EXACT — l'écran d'accueil qui propose de choisir un jeu n'existe pas (App.tsx:249 ouvre sur la Galerie ; le choix de projet vit uniquement dans Arbre.tsx:96-156 ; l'assistant, lui, ne crée ni ne choisit un jeu, il renomme celui qui est ouvert — Assistant.tsx:786-789). EXACT — cliquer « Équipement » ne donne aucune liste d'images mais un paragraphe suivi de champs de texte et de zones de saisie (Personnages.tsx:655-780), et le commentaire du code l'assume : « il ne montre aucune image » (Personnages.tsx:876). EXACT — les indicateurs qu'il cite mot pour mot sont bien rendus sur chaque ligne de pose de la matrice (Personnages.tsx:2740-2746, appelé ligne 2097). EXACT — le bandeau de fabrication occupe environ un quart de la hauteur replié, et davantage déplié. EXACT — les directions et les poses occupent bien deux des sept rangées de la colonne de gauche du Codex, sous deux intitulés séparés (Codex.tsx:353-387), alors qu'elles se règlent une fois. EN DESSOUS DE LA RÉALITÉ — « la colonne de droite est fausse » : ce n'est pas un chiffre mal calculé, c'est un vert écrit en dur pour l'équipement (Codex.tsx:856-858) et un compte qui ne mesure pas la production pour les poses (Codex.tsx:845-848) ; le panneau ne peut structurellement pas dire autre chose que « complet ». EN DESSOUS DE LA RÉALITÉ AUSSI — la lenteur de la Galerie : elle demande jusqu'à 200 images d'un coup sans pagination (routes.py:1080), rend toutes les tuiles sans fenêtrage (App.tsx:3325-3343), et le serveur recalcule chaque vignette à la volée (routes.py:1268-1290). NUANCE — « la galerie mélange les projets » : par défaut elle filtre bien sur le jeu ouvert, mais dès qu'on clique une collection le filtre du projet saute (routes.py:1095-1096), et les collections sans jeu sont proposées quel que soit le jeu ouvert (Arbre.tsx:48-50). Il a donc raison, mais pour une raison plus précise que celle qu'il donne.

### Les surfaces examinées

#### Barre de tête

`interface/src/composants/BarreChassis.tsx:301-473`

**À quoi ça sert** — La bande de 44 px du haut, toujours présente : elle dit où l'on est et donne accès à tout le reste.

**Ce que ça porte** — Le titre « Asset Kitchen », les trois onglets Univers / Codex / Galerie (lignes 383-426), le fil d'Ariane quand on est descendu (428), une fente d'une ligne pour les refus et les comptes rendus (435), le nom du jeu et son total en dollars qui ouvre les dépenses (437), l'état des fournisseurs de clés (439), les boutons de repli des colonnes de l'écran actif (441-460), et deux mots séparés par un trait : Réglages et Guide (466-469).

**Comment on y arrive** — Elle est là dès l'ouverture et ne disparaît jamais, pas même sous la fenêtre de confirmation d'un paiement.

**Comment on en sort** — On n'en sort pas.

**Les défauts** :

- Le total en dollars est aussi le bouton qui ouvre l'écran des dépenses — rien à l'écran ne dit qu'un chiffre est cliquable.
- Les boutons de repli changent de libellé et de nombre selon l'onglet (App.tsx:2008-2027) : entre zéro et deux boutons apparaissent et disparaissent au même endroit de la bande.

#### Barre d'état

`interface/src/App.tsx:3373-3439`

**À quoi ça sert** — La bande de 26 px du bas : elle dit si l'atelier répond et combien d'images la bibliothèque contient.

**Ce que ça porte** — Un point de couleur et une phrase (en ligne / hors ligne / la panne), la date du catalogue s'il est périmé, un bouton « N modèles » qui redemande le catalogue, et le compte total d'images à droite.

**Comment on y arrive** — Toujours présente.

**Comment on en sort** — On n'en sort pas.

**Les défauts** :

- Le compte de modèles est un bouton d'action déguisé en information.

#### Galerie (l'onglet d'ouverture)

`interface/src/App.tsx:2639-2772`

**À quoi ça sert** — Regarder, ranger et juger les images déjà fabriquées ; c'est l'écran sur lequel l'application s'ouvre.

**Ce que ça porte** — Trois colonnes : la colonne « Projet » à gauche (240 px), la barre d'outils plus la grille d'images au milieu, la fiche de l'image choisie à droite (380 px, présente seulement quand une seule image est sélectionnée). En pied, une phrase fixe : « aucun appel ne part d'ici — on paie depuis le codex et depuis l'établi d'une chose du jeu » (2736-2740).

**Comment on y arrive** — C'est l'onglet allumé au démarrage (App.tsx:249). Sinon, un clic sur « Galerie » dans la barre du haut.

**Comment on en sort** — Un clic sur un autre onglet, qui referme au passage toute profondeur ouverte (App.tsx:2327-2335).

**Les défauts** :

- Elle demande toute la bibliothèque du jeu en un seul appel plafonné à 200 images (routes.py:1080) et rend toutes les tuiles d'un coup, sans fenêtrage (App.tsx:3325-3343).
- Au-delà de 200 images, la grille est silencieusement tronquée : rien ne le dit.
- Choisir une collection fait sauter le filtre du jeu ouvert (routes.py:1095-1096) : des images d'autres jeux entrent alors dans la grille.

#### Colonne « Projet » (l'arbre)

`interface/src/composants/Arbre.tsx:29-213`

**À quoi ça sert** — Le seul endroit du produit où l'on choisit, crée, renomme ou supprime le jeu sur lequel on travaille.

**Ce que ça porte** — Une section « Projets » avec un petit + de 12 px pour en créer un (271-296), une section « Collections », et un journal des appels ratés avec leur coût et un lien pour relancer (300-378).

**Comment on y arrive** — Elle est la première colonne de la Galerie — donc visible à l'ouverture, mais seulement sur cet onglet-là. Elle disparaît dès qu'on passe sur Univers ou Codex.

**Comment on en sort** — On la replie par le bouton « arbre » de la barre du haut, ou on change d'onglet.

**Les défauts** :

- Le choix du jeu — la décision la plus structurante du produit — vit dans une colonne d'un seul des trois onglets, sous un intitulé (« Projets ») qui ne dit pas qu'il s'agit du jeu courant.
- Une fois un jeu ouvert, on ne peut plus revenir à « aucun jeu » : la ligne « Sans projet » n'apparaît que s'il existe des images orphelines (Arbre.tsx:147).
- Le journal des ratés fait doublon avec l'écran des Dépenses, qui a été écrit pour le remplacer (Depenses.tsx:3-11) — les deux coexistent.

#### Barre d'outils de la grille

`interface/src/composants/BarreOutils.tsx`

**À quoi ça sert** — Chercher, filtrer, et agir sur les images sélectionnées.

**Ce que ça porte** — Un champ « Chercher », un filtre favoris, un filtre par famille, le compte d'images, le zoom à trois crans (1× / 2× / 4×), et — quand une sélection existe — ranger, favori, supprimer, exporter, plus un bandeau « annuler » après une suppression.

**Comment on y arrive** — Au-dessus de la grille, dans la Galerie.

**Comment on en sort** — Ne se ferme pas.

**Les défauts** :

- Le bandeau « annuler » qui rattrape une suppression ne vit que sur cet écran : supprimer depuis l'établi envoie son propre message de rattrapage dans la fente du haut, à un autre endroit de l'écran (App.tsx:2908-2930).

#### La grille d'images

`interface/src/App.tsx:3244-3346`

**À quoi ça sert** — Montrer les images du jeu ouvert, plus les emplacements payés qui ne sont pas encore revenus.

**Ce que ça porte** — Des tuiles carrées ; on y dépose un fichier pour l'importer ; trois états vides différents (vide, filtre sans résultat, survol d'un dépôt).

**Comment on y arrive** — Au centre de la Galerie.

**Comment on en sort** — Ne se ferme pas ; elle est remplacée quand on ouvre les tables, la découpe ou le dépliage.

**Les défauts** :

- Aucune vue en liste, aucun tri autre que la date.

#### Fiche d'une image

`interface/src/composants/Fiche.tsx`

**À quoi ça sert** — Dire ce qu'une image est, d'où elle vient et ce que le jeu lui a imposé.

**Ce que ça porte** — L'image, son étiquette, sa filiation, la recette appliquée, ce que le jeu lui a imposé, et deux portes en bas : « Reprendre dans l'établi » (grisée si l'image n'appartient à aucune chose du jeu) et « Ouvrir les tables » (289-297), plus un lien de téléchargement PNG.

**Comment on y arrive** — Un clic sur une tuile de la grille — la fiche est la sélection quand elle vaut exactement une image (App.tsx:692).

**Comment on en sort** — Le bouton × de son en-tête, ou en sélectionnant autre chose.

**Les défauts** :

- Le bouton « Découper » a été retiré de cette rangée (Fiche.tsx:782) sans que l'écran Découpe autonome qu'il ouvrait soit retiré du code : cet écran est devenu injoignable.

#### Écran de dépliage d'une planche

`interface/src/composants/Depliage.tsx`

**À quoi ça sert** — Choisir ce qu'on garde d'une feuille multi-images qui vient d'arriver, avant qu'elle entre en bibliothèque.

**Ce que ça porte** — L'image de la planche découpée à l'écran, case par case, avec ce qu'on garde et ce qu'on écarte. Rien n'y coûte d'argent.

**Comment on y arrive** — Un clic sur une tuile de la grille qui attend un choix (Tuile.tsx:147-154). Il prend la place de la grille (App.tsx:2706-2716).

**Comment on en sort** — Un bouton fermer (Depliage.tsx:78) ; il se referme aussi tout seul quand le choix est fait.

**Les défauts** :

- Pas de touche Échap, contrairement à tous les autres plein-cadre.
- Le même clic depuis la grille « choisir une image de référence » ne produit rien du tout : l'état est posé (App.tsx:2543) mais l'écran n'est rendu que dans la Galerie, qui est démontée pendant la confirmation d'un paiement (App.tsx:2639).

#### Écran Découpe atteint depuis la Galerie

`interface/src/App.tsx:2593-2606`

**À quoi ça sert** — Rien aujourd'hui : c'est du code mort.

**Ce que ça porte** — L'écran de découpe d'une planche, avec son fil d'Ariane dédié (App.tsx:2122-2137).

**Comment on y arrive** — Par aucun clic. La variable qui l'ouvre n'est jamais posée avec une valeur : les sept occurrences de `setDecoupeOuverte` dans App.tsx la remettent toutes à vide.

**Comment on en sort** — Sans objet.

**Les défauts** :

- Surface injoignable, ainsi que la branche du fil d'Ariane qui la nommait.

#### Les tables (sur une image de la Galerie)

`interface/src/composants/Tables.tsx:1042 — monté en App.tsx:2563-2591`

**À quoi ça sert** — Retoucher une image : détourage, recadrage, grille, couleurs, bords, contours, retouche à la main, plus deux fabriques.

**Ce que ça porte** — Trois colonnes de 380 px / image en grand / 380 px. Une barre de neuf tables dans l'ordre où elles s'appliquent (Tables.tsx:100-110), chacune marquée d'un carré plein ou creux selon qu'elle change l'image. Les deux dernières — découpage et superposition — fabriquent de nouveaux fichiers.

**Comment on y arrive** — Fiche d'une image › « Ouvrir les tables ».

**Comment on en sort** — Uniquement par le fil d'Ariane de la barre du haut, ou en changeant d'onglet. L'écran ne reçoit aucune fonction de fermeture (Tables.tsx:1042-1078) et n'écoute pas Échap.

**Les défauts** :

- Sans bouton fermer et sans Échap, c'est le seul plein-cadre du produit dont la sortie n'est pas sur l'écran lui-même.
- Neuf tables présentées à plat, sans regroupement visible entre celles qui règlent l'image et celles qui en fabriquent une autre — le seul indice est un trait dans la barre.

#### Univers (l'onglet)

`interface/src/composants/Univers.tsx:53-362`

**À quoi ça sert** — Le côté créatif : ce à quoi le jeu ressemble, et les images qui donnent des idées.

**Ce que ça porte** — Trois côtés dont un seul est allumé à la fois (Univers.tsx:375-384) : Inspiration, Réglages, Ambiances et couleurs. Le côté Inspiration porte ses trois mots dans la barre du tableau ; les deux autres ont une bande de 38 px à eux (Univers.tsx:242).

**Comment on y arrive** — Un clic sur « Univers » dans la barre du haut. Au tout premier lancement, l'application s'y ouvre d'elle-même, côté Réglages (App.tsx:938-942).

**Comment on en sort** — Un clic sur un autre onglet.

**Les défauts** :

- Rien ne s'affiche tant que le serveur n'a pas envoyé son premier message : la ligne du milieu reste vide (App.tsx:2784, condition `etat &&`).
- Les trois mots des côtés changent d'endroit selon le côté allumé : dans la barre du tableau côté Inspiration, dans une bande à part sur les deux autres.
- Aucun moyen de changer de jeu depuis cet onglet, alors que tout ce qu'il règle appartient à un jeu.

#### Univers › Inspiration, vue grille

`interface/src/composants/Tableau.tsx:420`

**À quoi ça sert** — Ranger les images d'inspiration en paquets.

**Ce que ça porte** — Une grille de cartes, un collage par Ctrl+V, et les trois mots des côtés dans sa barre.

**Comment on y arrive** — Onglet Univers ; c'est la vue de départ.

**Comment on en sort** — Changer d'onglet, ou basculer en vue toile.

#### Univers › Inspiration, vue toile

`interface/src/composants/Toile.tsx`

**À quoi ça sert** — Disposer les mêmes images à la main sur une surface libre, avec des traits entre elles.

**Ce que ça porte** — Une toile déplaçable, des îlots colorés, des liens nommés, une pile d'annulation, et le menu d'une carte d'où l'on découpe.

**Comment on y arrive** — Onglet Univers, puis la bascule de vue.

**Comment on en sort** — Bascule de vue, ou changement d'onglet.

**Les défauts** :

- La pile d'annulation meurt avec l'écran (Univers.tsx:164-170) : quitter l'onglet une seconde perd tout le rattrapage du geste en cours.

#### Univers › Inspiration, la réserve

`interface/src/composants/Tableau.tsx:509`

**À quoi ça sert** — La colonne de 380 px des images pas encore posées sur la toile.

**Ce que ça porte** — Une grille de cartes en attente ; on y ramène une carte en la déposant.

**Comment on y arrive** — Elle n'existe qu'en vue toile (Univers.tsx:321) ; ailleurs, ni la colonne ni son bouton de repli n'existent.

**Comment on en sort** — Repli par le bouton « réserve » de la barre du haut, ou retour en vue grille.

**Les défauts** :

- Un bouton de repli qui n'apparaît que dans une vue sur deux du même onglet.

#### Univers › Inspiration › découpe d'une carte

`interface/src/composants/Univers.tsx:249-267 avec Decoupe.tsx`

**À quoi ça sert** — Couper une image d'inspiration en plusieurs morceaux.

**Ce que ça porte** — L'image à gauche, les rectangles à droite (380 px), et un fil d'Ariane à quatre segments.

**Comment on y arrive** — Vue grille ou toile, menu d'une carte, entrée « découper » (Tableau.tsx:66, 1328).

**Comment on en sort** — Bouton fermer, ou Échap (Decoupe.tsx:217), ou par le fil d'Ariane.

**Les défauts** :

- Le geste passe par un menu contextuel de carte, sans autre signalisation.

#### Univers › Réglages (l'assistant)

`interface/src/composants/Assistant.tsx:225`

**À quoi ça sert** — Poser une fois pour toutes ce que le jeu est : son nom, son style, sa vue, sa taille, ses types d'objets, son allure, ses références, ses poses, ses emplacements, ses modèles d'IA, son détourage de départ, ses clés de fournisseur.

**Ce que ça porte** — Une colonne de 240 px avec douze étapes rangées en quatre groupes (Assistant.tsx:132-163), et l'étape ouverte à droite, une à la fois.

**Comment on y arrive** — Onglet Univers, puis le mot « Réglages ». Ou automatiquement au tout premier lancement.

**Comment on en sort** — En changeant de côté ou d'onglet. Au premier lancement seulement, un bouton « sortir » dépose dans le Codex avec le champ de nom allumé (App.tsx:2798-2802).

**Les défauts** :

- Il porte le mot « Réglages », exactement comme la fenêtre de réglages de l'atelier ouverte depuis la barre du haut, qui est un écran complètement différent — deux surfaces homonymes.
- La première étape s'appelle « Le nom » mais ne crée aucun jeu : elle renomme celui qui est déjà ouvert (Assistant.tsx:786-789, 824-839). Quelqu'un qui vient y commencer un nouveau jeu écrase le précédent.
- Il ne dit nulle part de quel jeu il parle.

#### Univers › Ambiances et couleurs

`interface/src/composants/Ambiances.tsx:48`

**À quoi ça sert** — Fabriquer des variantes de style — des ambiances — et les palettes de couleurs dont elles se servent.

**Ce que ça porte** — Une colonne de deux listes (ambiances d'abord, palettes ensuite), et à droite le panneau de l'objet choisi : ses sources, sa fusion, ses retouches, sa palette rendue, son aperçu, ses cases de texte.

**Comment on y arrive** — Onglet Univers, puis le mot « Ambiances et couleurs ». Ou depuis un îlot de la toile, qui bascule de côté et ouvre l'objet (App.tsx:2821-2824).

**Comment on en sort** — Changer de côté ou d'onglet.

#### Codex (l'onglet)

`interface/src/composants/Codex.tsx:122-302`

**À quoi ça sert** — Le côté fabrication : la liste de ce que le jeu contient, et de ce qui lui manque.

**Ce que ça porte** — Trois colonnes : « Ce que le monde contient » à gauche (240 px), la rubrique ouverte au milieu, « La chose choisie » à droite (380 px). Sous la colonne du milieu, le bandeau de fabrication (Codex.tsx:285).

**Comment on y arrive** — Un clic sur « Codex » dans la barre du haut.

**Comment on en sort** — Un clic sur un autre onglet.

**Les défauts** :

- Le bandeau de fabrication est rendu sur les sept rubriques, y compris celles où il n'y a rien à fabriquer (les directions, les poses, l'équipement).
- Aucun moyen de changer de jeu depuis cet onglet.

#### Codex › colonne « Ce que le monde contient »

`interface/src/composants/Codex.tsx:306-406`

**À quoi ça sert** — Choisir ce qu'on regarde.

**Ce que ça porte** — Sept rangées en trois blocs séparés par des traits : les cinq familles (Personnages, Décors, Objets, Interface, Équipement), puis sous « Ce que le jeu réclame de tous » la rangée « Les directions », puis sous « Ce que les personnages réclament » la rangée « Leurs poses ». En pied, deux lignes de comptes.

**Comment on y arrive** — Première colonne du Codex.

**Comment on en sort** — Repli par le bouton « familles » de la barre du haut.

**Les défauts** :

- Deux des sept rangées ne sont pas des familles d'objets mais des réglages de jeu qu'on pose une fois : « Les directions » et « Leurs poses » (Codex.tsx:353-387). Elles portent chacune leur propre intitulé de bloc, ce qui leur donne à elles deux plus de place verticale qu'aux cinq familles réunies.
- La cinquième famille, « Équipement », n'ouvre pas le même genre d'écran que les quatre autres.

#### Codex › liste d'une famille

`interface/src/composants/Codex.tsx:485-578`

**À quoi ça sert** — Voir les choses d'une famille et en créer de nouvelles.

**Ce que ça porte** — Un lien « voir tout le monde en grand › » de 10 px, puis une carte par chose : une vignette de 44 px, le nom (cliquable, il descend dans l'établi), le signalement, l'ambiance, et à droite « rien ne manque » ou « N cases manquantes ». En bas, un champ où écrire un nom crée la chose sur-le-champ.

**Comment on y arrive** — Codex, puis un clic sur la famille. Personnages est la rubrique ouverte par défaut.

**Comment on en sort** — Choisir une autre rubrique, ou changer d'onglet.

**Les défauts** :

- Le nom est un bouton qui descend d'un étage, mais le reste de la carte est un autre bouton qui ne fait que désigner : deux gestes très différents dans le même rectangle, sans rien qui les distingue à l'œil (Codex.tsx:686-721).

#### Codex › Équipement (le vestiaire)

`interface/src/composants/Personnages.tsx:655-780, monté en Codex.tsx:249-257`

**À quoi ça sert** — Décrire les pièces d'équipement du jeu — un casque, une cape — une fois pour tous les personnages.

**Ce que ça porte** — Un paragraphe d'explication, puis les pièces groupées par emplacement du corps, chacune avec un champ de nom, un menu de portée, un bouton de retrait et une zone de texte de deux lignes pour sa description. En bas de chaque pièce, une ligne de texte disant sur combien de personnages elle est posée. Puis deux champs pour en ajouter une.

**Comment on y arrive** — Codex, puis un clic sur « Équipement ».

**Comment on en sort** — Choisir une autre rubrique.

**Les défauts** :

- C'est la seule des cinq familles qui ne montre aucune image, aucune carte, aucune vignette — le code l'assume explicitement (Personnages.tsx:874-882). Là où les quatre autres donnent une liste illustrée, celle-ci donne un formulaire.
- Le bandeau de fabrication est rendu dessous alors qu'on ne peut rien fabriquer d'ici.

#### Codex › Les directions

`interface/src/composants/Codex.tsx:978`

**À quoi ça sert** — Régler les angles sous lesquels le jeu regarde ses personnages.

**Ce que ça porte** — La liste des directions, leur origine (déduites de la vue du jeu, ou écrites à la main), deux textes par direction — le nom qu'on lit, la consigne qui part au modèle — et un champ d'ajout.

**Comment on y arrive** — Codex, puis un clic sur « Les directions ».

**Comment on en sort** — Choisir une autre rubrique.

**Les défauts** :

- Réglage de jeu logé au même rang que les familles d'objets.

#### Codex › Leurs poses (le plan)

`interface/src/composants/Personnages.tsx:463-535, monté en Codex.tsx:245-248`

**À quoi ça sert** — Régler la liste des attitudes que chaque personnage se voit proposer.

**Ce que ça porte** — Une ligne par pose, un champ où écrire un nom l'ajoute sur-le-champ.

**Comment on y arrive** — Codex, puis un clic sur « Leurs poses ».

**Comment on en sort** — Choisir une autre rubrique.

**Les défauts** :

- Même remarque : réglage de jeu au rang d'une famille.

#### Codex › colonne « La chose choisie »

`interface/src/composants/Codex.tsx:766-942`

**À quoi ça sert** — Dire ce que la chose désignée réclame, ce qui lui manque, et armer la fabrication.

**Ce que ça porte** — Quatre blocs : « Ce qu'elle réclame », « Son ambiance », « Ce qui manque » (une ligne par pose, faites sur demandées), et en pied deux boutons : « Fabriquer ce qui manque » et « Ouvrir son établi ».

**Comment on y arrive** — Codex, puis un clic sur une carte de la liste.

**Comment on en sort** — Le × de son en-tête, ou le bouton de repli « fiche » de la barre du haut.

**Les défauts** :

- Le bloc « Ce qu'elle réclame » ment par construction. La ligne « pièces d'équipement » affiche « N sur N » avec le vert écrit en dur dans le code (Codex.tsx:853-859) : elle ne peut afficher que « complet ». La ligne des poses compare les poses non écartées aux poses réclamées (Codex.tsx:845-848 avec Personnages.tsx:99-100) : elle est verte dès qu'on n'a écarté aucune pose, qu'aucune image n'ait été fabriquée ou toutes.
- Le bloc juste en dessous, « Ce qui manque », dit lui la vérité — deux blocs voisins, l'un vert et l'autre non, sur la même question.
- Le titre du panneau quand rien n'est choisi est « La chose choisie », suivi d'un texte demandant de choisir une chose.

#### Vitrine du monde entier

`interface/src/composants/Vitrine.tsx, monté en Codex.tsx:210-221`

**À quoi ça sert** — Voir toutes les choses du jeu en grand, une image par chose, sur le fond que la bible décrit.

**Ce que ça porte** — Les images finies, à la même échelle, en plein cadre. Rien ne s'y règle, rien n'y coûte.

**Comment on y arrive** — Codex, puis un lien texte de 10 px « voir tout le monde en grand › » posé au-dessus de la liste (Codex.tsx:542-551).

**Comment on en sort** — Bouton « Fermer la vitrine — Échap » (Vitrine.tsx:158-161), ou Échap.

**Les défauts** :

- Entrée par un lien de 10 px placé au-dessus d'une liste — c'est la seule signalisation d'un des rares écrans qui montre le jeu.
- Le même écran existe aussi depuis l'établi d'une chose : deux portes vers un composant unique, avec deux contenus différents.

#### L'établi d'une chose

`interface/src/composants/Personnages.tsx:149-446 et 938-1057`

**À quoi ça sert** — L'atelier d'un personnage : voir ses cases, les remplir, les habiller.

**Ce que ça porte** — Deux colonnes. À gauche, 300 px : son nom, sa description, trois liens de 10 px vers ses trois écrans profonds (« sa fiche › », « la vitrine › », « le calibrage › », Personnages.tsx:1339-1369), un bouton de suppression, et le bloc « Sortir vers le jeu ». À droite : la barre « La colonne qu'on lit » (le corps, ou une pièce d'équipement), puis la matrice — une ligne par pose. En pied, le bandeau de fabrication.

**Comment on y arrive** — Codex, puis un clic sur le nom d'une chose dans sa carte, ou le bouton « Ouvrir son établi » de la colonne de droite.

**Comment on en sort** — Le fil d'Ariane de la barre du haut (segment du jeu ou de la famille, App.tsx:2068-2088), ou un clic sur un onglet. Aucun bouton retour, aucune touche Échap sur la matrice.

**Les défauts** :

- Les trois portes vers les écrans les plus utiles de la chose sont trois liens de 10 px en couleur d'accent, alignés sur une ligne dans la colonne de gauche.
- La barre « La colonne qu'on lit » — celle que l'auteur décrit comme « un menu à peine distinguable » — est une rangée de boutons de 26 px en petits caractères (Personnages.tsx:1188-1205), et elle n'apparaît que si le jeu a au moins une pièce d'équipement (1181).

#### L'établi › la matrice des poses

`interface/src/composants/Personnages.tsx:1526 (Cases) et 1946-2233 (LigneCase)`

**À quoi ça sert** — Voir case par case ce qui est fait et ce qui manque, et armer un appel.

**Ce que ça porte** — Par ligne : une case à cocher, le nom de la pose sur 110 px, les vignettes ou le nom des directions manquantes, les mesures techniques du lot, le compte « faites / demandées », parfois « la planche › », puis « Fabriquer › » et une croix de retrait. Sous la ligne, une sous-ligne par direction quand le jeu en a plusieurs.

**Comment on y arrive** — Elle est le centre de l'établi.

**Comment on en sort** — Comme l'établi.

**Les défauts** :

- Les mesures techniques que l'auteur cite mot pour mot — « ressemblance 0.37 · case 2 » et « grille 7 px · dérive 1.00× » — sont rendues sur la ligne, sans intitulé, entre les vignettes et le compte (Personnages.tsx:2732-2749, appelé ligne 2097). Leur explication n'existe que dans une infobulle au survol.
- Sept commandes par ligne de pose, dont deux boutons texte en couleur d'accent qui font des choses très différentes : « la planche › » ouvre un écran, « Fabriquer › » remplit le champ du bandeau du bas.
- « Fabriquer › » ne fabrique rien : il arme. Le mot dit le contraire de ce qui se passe ; seule l'infobulle corrige.

#### L'établi › panneau du calque

`interface/src/composants/Calque.tsx, monté en Personnages.tsx:405-430`

**À quoi ça sert** — Juger et corriger ce qu'une pièce d'équipement a ajouté au corps.

**Ce que ça porte** — 380 px : le calque sur son corps, trois outils sur une même surface, cinq mesures à côté, un bouton pour refaire le calage à la main, un pour jeter.

**Comment on y arrive** — Établi, choisir une pièce dans « La colonne qu'on lit », puis cliquer un calque.

**Comment on en sort** — Un bouton fermer.

**Les défauts** :

- Trois clics depuis le Codex, et il n'apparaît que si le jeu a des pièces d'équipement.

#### Fiche plein cadre d'une chose

`interface/src/composants/FicheChose.tsx:133`

**À quoi ça sert** — Tout ce qui n'est pas du travail sur une case : le signalement, les sept textes de style, les images de référence, ce qu'on lui réclame, ce qui est fait.

**Ce que ça porte** — Cinq sections avec un sommaire qui suit le défilement (FicheChose.tsx:67-73) : le sujet, ce qui l'habille, les exemples, les poses, ce qui est fait. Plus deux portes vers la vitrine et le calibrage.

**Comment on y arrive** — Établi, lien « sa fiche › ».

**Comment on en sort** — Bouton « Fermer la fiche — Échap » (337-340) ou Échap.

**Les défauts** :

- Elle porte le même nom de composant que la colonne de droite du Codex — deux `FicheDeLaChose` dans deux fichiers (Codex.tsx:766 et FicheChose.tsx:133) — et les deux répondent à la même question : ce que la chose réclame et ce qui lui manque.
- Le fil d'Ariane de la barre du haut ne la nomme pas : il continue d'afficher « › Balthazar » comme si on était sur la matrice.

#### Vitrine d'une chose

`interface/src/composants/Vitrine.tsx, monté en Personnages.tsx:352-359`

**À quoi ça sert** — Voir toutes les poses d'une chose en grand, à la même échelle.

**Ce que ça porte** — Le même écran que la vitrine du monde, restreint à une chose.

**Comment on y arrive** — Établi, lien « la vitrine › » ; ou depuis la fiche plein cadre ; ou depuis l'écran de la planche.

**Comment on en sort** — Bouton fermer, ou Échap.

**Les défauts** :

- Trois portes différentes vers le même écran, aucune dans le fil d'Ariane.

#### Le calibrage

`interface/src/composants/Calibrage.tsx`

**À quoi ça sert** — Mettre toutes les poses d'une chose à la même hauteur, en les empilant dans une seule case.

**Ce que ça porte** — Une case unique où les silhouettes se superposent, à la taille qu'elles auront dans le jeu, et de quoi corriger. Aucun appel payant.

**Comment on y arrive** — Établi, lien « le calibrage › » ; ou depuis la fiche plein cadre.

**Comment on en sort** — Bouton « ‹ l'établi » (Calibrage.tsx:174-178), ou Échap.

**Les défauts** :

- Absent du fil d'Ariane.

#### La planche d'une pose

`interface/src/composants/Planche.tsx`

**À quoi ça sert** — Voir ce qu'on achète avant de payer : combien de cases, ce qui est écrit dans chacune, le prix.

**Ce que ça porte** — Le tableau des cases de la pose, ce qui part en référence, le prix — et le bandeau de fabrication en pied, seul plein-cadre de l'établi à le garder (Personnages.tsx:443).

**Comment on y arrive** — Établi, lien « la planche › » sur une ligne de pose — et seulement si cette pose a au moins deux directions (Personnages.tsx:2124).

**Comment on en sort** — Bouton « ‹ l'établi » (Planche.tsx:135-139), ou Échap.

**Les défauts** :

- Le lien qui l'ouvre apparaît et disparaît d'une ligne à l'autre selon le nombre de directions.
- Absent du fil d'Ariane.

#### Les tables (sur une image de case)

`interface/src/composants/Tables.tsx:1042, monté en Personnages.tsx via App.tsx:2931-2967`

**À quoi ça sert** — Le même écran de retouche que depuis la Galerie, mais sur une image de la matrice, et avec les autres poses de la chose comme voisines.

**Ce que ça porte** — Les neuf tables, l'image en grand, ses sœurs.

**Comment on y arrive** — Établi, clic sur une vignette de case. Ou, depuis un calque, « refaire le calage » qui ouvre directement la table de superposition (App.tsx:2894-2897).

**Comment on en sort** — Uniquement par le fil d'Ariane du haut (segment du nom de la chose, App.tsx:2089-2091) ou un onglet.

**Les défauts** :

- Même défaut qu'en Galerie : ni bouton fermer ni Échap.
- C'est le seul endroit du produit qui apparaît dans le fil d'Ariane à cinq segments.

#### Le bandeau de fabrication (« la barre qui paie »)

`interface/src/App.tsx:2152-2305`

**À quoi ça sert** — Le seul endroit du produit d'où l'argent part.

**Ce que ça porte** — Du haut vers le bas : le panneau des réglages de l'appel s'il est déplié, la bande « Pour » quand une case est visée, la bande « Repart avec » des images jointes, une ligne repliable « réglages de l'appel · modèle · proportions · variations », le coût attendu, puis la zone de saisie du prompt, le prompt négatif repliable, et le bouton Générer avec sa fente de raison.

**Comment on y arrive** — Il est rendu au pied du Codex (App.tsx:2871) et au pied de l'établi (Personnages.tsx:443), sauf quand la fiche, la vitrine ou le calibrage sont ouverts.

**Comment on en sort** — On ne le ferme pas ; on replie son panneau de réglages.

**Les défauts** :

- Replié, il occupe environ 206 px de haut ; sur une fenêtre courante c'est un quart de la zone de travail. Déplié, le panneau des réglages ajoute jusqu'à 40 % de la hauteur de la fenêtre (PanneauReglages.tsx:155).
- Il est rendu sur des rubriques où l'on ne peut rien fabriquer : les directions, les poses, l'équipement.
- Il ne dit pas ce qu'il fabriquera tant qu'aucune case n'est visée : la bande « Pour » n'existe que si l'atelier est armé (App.tsx:3087).

#### Le panneau des réglages de l'appel

`interface/src/composants/PanneauReglages.tsx`

**À quoi ça sert** — Choisir le modèle, les proportions, le nombre de variations, l'échelle du sujet, et ce que l'appel écarte.

**Ce que ça porte** — La liste des modèles avec leur raison de grisé, une liste déroulante des sujets, le coût attendu, la réserve du fournisseur.

**Comment on y arrive** — La ligne « + réglages de l'appel » du bandeau (App.tsx:2222-2234). Il est replié au démarrage et son état n'est pas conservé d'une session à l'autre (chassis.tsx:387-392).

**Comment on en sort** — La même ligne le replie.

**Les défauts** :

- Il s'ouvre par-dessus le travail, en poussant tout vers le haut, jusqu'à 40 % de la fenêtre.

#### Écran de confirmation « Ce qui part »

`interface/src/composants/Envoi.tsx`

**À quoi ça sert** — Relire mot pour mot le texte qui va partir, et chaque image jointe, avant que l'argent parte.

**Ce que ça porte** — Chaque texte et chaque image sur sa ligne avec un interrupteur ; le prix ; un bouton pour garder une correction sur la chose du jeu ; une case « ne plus me le montrer » pour cette série ; le bouton qui paie.

**Comment on y arrive** — Le bouton Générer du bandeau (App.tsx:1416). Il prend la ligne du milieu, quel que soit l'onglet.

**Comment on en sort** — Bouton fermer, Échap (Envoi.tsx:155), un onglet, ou le paiement lui-même.

**Les défauts** :

- Il démonte l'onglet du dessous, ce qui rend inertes certains contrôles de la grille qu'il rouvre par-dessus lui.

#### Choisir une image de référence

`interface/src/App.tsx:2494-2556`

**À quoi ça sert** — Ajouter une image jointe sans quitter l'écran de confirmation.

**Ce que ça porte** — La grille du produit réemployée telle quelle, un champ « Chercher », et un lien « ‹ revenir ». Un clic sur une image la joint.

**Comment on y arrive** — Depuis l'écran de confirmation, section des images jointes.

**Comment on en sort** — « ‹ revenir », ou Échap (App.tsx:1880-1889).

**Les défauts** :

- Un clic sur une planche en attente y appelle l'écran de dépliage, qui n'est jamais rendu dans ce contexte (App.tsx:2543) : le clic ne fait rien.

#### Les dépenses

`interface/src/composants/Depenses.tsx`

**À quoi ça sert** — Expliquer où l'argent est passé, appel par appel.

**Ce que ça porte** — Trois colonnes de 240 px / liste / 380 px. Des filtres qui portent sur des appels et non sur des images, et volontairement aucune vignette dans la liste.

**Comment on y arrive** — Un clic sur le total en dollars de la barre du haut (App.tsx:2350-2354). Il n'appartient à aucun onglet et prend la ligne du milieu.

**Comment on en sort** — Bouton fermer, Échap (Depenses.tsx:161), ou un onglet.

**Les défauts** :

- Sa seule porte est un chiffre dans la barre du haut, que rien ne désigne comme cliquable.
- Il fait doublon avec le journal des ratés de la colonne « Projet » de la Galerie, qu'il a été écrit pour remplacer et qui n'a pas été retiré.

#### Réglages de l'atelier

`interface/src/composants/EcranReglages.tsx`

**À quoi ça sert** — Déposer les clés des fournisseurs, poser les garde-fous de l'agent, dire dans quel dossier le jeu range ses fichiers.

**Ce que ça porte** — Trois blocs, trois questions : les tiroirs de secrets, le cadre de l'agent avec sa consommation, les dossiers.

**Comment on y arrive** — Trois portes : le mot « Réglages » de la barre du haut, l'état des fournisseurs de cette même barre, ou le bouton Générer quand il est éteint faute de clé (App.tsx:2269-2273).

**Comment on en sort** — Bouton fermer, ou Échap (EcranReglages.tsx:65).

**Les défauts** :

- Homonyme du côté « Réglages » de l'onglet Univers, qui est l'assistant du jeu — deux écrans sans rapport portant le même mot dans la même interface.
- Ne s'affiche pas tant que le serveur n'a pas envoyé son premier message (App.tsx:2994).

#### Le Guide

`interface/src/composants/Guide.tsx`

**À quoi ça sert** — La seule prose du produit : ce que chaque chose veut dire.

**Ce que ça porte** — Trois parties, dont la troisième est le corpus complet des infobulles rendu à la file.

**Comment on y arrive** — Le mot « Guide » de la barre du haut, ou la touche « ? » hors d'un champ de saisie (App.tsx:646-660).

**Comment on en sort** — Échap (Guide.tsx:135).

#### L'aperçu

`interface/src/composants/Apercu.tsx`

**À quoi ça sert** — Tenir une image en grand une seconde au-dessus de ce qu'on faisait.

**Ce que ça porte** — L'image entière, par-dessus tout le reste, y compris les écrans qui couvrent l'atelier.

**Comment on y arrive** — La barre d'espace pendant qu'on survole une vignette.

**Comment on en sort** — Échap, ou relâcher.

**Les défauts** :

- C'est la seule surface du produit qui couvre absolument tout, et son geste n'est écrit nulle part à l'écran.

### Les constats

**BLOQUANT — Il n'existe aucun écran d'accueil, et aucun endroit pour choisir un jeu en dehors d'une colonne de la Galerie.**

- *Le chiffre* : 1 seul emplacement sur les 42 surfaces
- *La preuve* : L'onglet allumé au démarrage est « galerie » (App.tsx:249). Le choix, la création, le renommage et la suppression d'un jeu vivent uniquement dans la section « Projets » de Arbre.tsx:96-156, elle-même rendue seulement dans la Galerie (App.tsx:2650-2656). Les onglets Univers et Codex, qui travaillent pourtant tous les deux sur le jeu ouvert, n'offrent aucun moyen d'en changer ni même de dire lequel est ouvert autrement que par le nom en haut à droite.

**FORT — La colonne de droite du Codex ne peut pas dire autre chose que « complet » sur deux de ses trois lignes : le vert de l'équipement est écrit en dur, et celui des poses ne mesure aucune image.**

- *Le chiffre* : 2 lignes sur 3 vertes par construction
- *La preuve* : Codex.tsx:853-859 rend la ligne « pièces d'équipement » avec la valeur `${pieces.length} sur ${pieces.length}` et l'attribut `complet` posé sans condition. Codex.tsx:839-849 compare `tenues.length` à `reclame.length`, où `tenues` est calculé par `posesTenues` (Personnages.tsx:99-100) comme « les poses que le personnage n'a pas écartées » — une liste qui ne regarde jamais les images produites.

**FORT — L'écran des Tables — la surface de retouche la plus profonde et la plus fréquente du produit — n'a ni bouton de fermeture ni touche Échap.**

- *Le chiffre* : 0 sortie sur l'écran lui-même
- *La preuve* : `EcranTables` (Tables.tsx:1042-1078) ne déclare aucune fonction de fermeture parmi ses onze paramètres, et les deux endroits qui le montent (App.tsx:2564-2590 et App.tsx:2933-2967) ne lui en passent aucune. La seule occurrence d'Échap dans le fichier (Tables.tsx:319) appartient à un sous-panneau, `PanneauDesRecettes`. La seule sortie est le fil d'Ariane de la barre du haut ou un clic sur un onglet.

**MOYEN — Un écran complet est injoignable : la découpe d'une planche atteinte depuis la Galerie.**

- *Le chiffre* : 0 chemin d'accès
- *La preuve* : L'état qui l'ouvre, `decoupeOuverte` (App.tsx:565), n'est jamais posé avec une valeur : ses sept usages dans le fichier le remettent tous à vide. Le bouton qui l'ouvrait a quitté la fiche d'image (Fiche.tsx:782, « Découper a quitté cette rangée »). Restent morts : l'écran (App.tsx:2593-2606) et sa branche du fil d'Ariane (App.tsx:2122-2137).

**FORT — Cliquer « Équipement » dans le Codex ouvre un formulaire de texte, là où les quatre autres familles ouvrent une liste illustrée.**

- *Le chiffre* : 1 famille sur 5 sans aucune image
- *La preuve* : La rubrique monte `Vestiaire` (Personnages.tsx:655-780) : un paragraphe d'introduction, des groupes de champs de nom, un menu déroulant de portée, une zone de texte de deux lignes par pièce, et une ligne de texte « posée sur N personnages sur M ». Le commentaire du code l'assume : « il ne montre aucune image » (Personnages.tsx:876-880). Les quatre autres familles passent par `ListeDesChoses` (Codex.tsx:485), qui rend une vignette de 44 px par chose.

**FORT — Le bandeau de fabrication occupe environ un quart de la zone de travail replié, et jusqu'à 40 % de la hauteur de la fenêtre en plus quand on l'ouvre.**

- *Le chiffre* : ≈206 px replié ; +40 % de la fenêtre déplié
- *La preuve* : Replié, le bandeau (App.tsx:2152-2305) cumule la ligne de repli de 26 px, le bloc du coût, et la zone de saisie du prompt dont le champ seul fait 56 px dans un cadre à 16 px de marge (ChampPrompt.tsx:182, 208). Déplié, `PanneauReglages` ajoute un bloc plafonné à `max-h-[40vh]` (PanneauReglages.tsx:155). Il est rendu sur toutes les rubriques du Codex (App.tsx:2871) et sur l'établi sauf quand la fiche, la vitrine ou le calibrage sont ouverts (Personnages.tsx:443).

**MOYEN — Les mesures techniques que l'auteur cite sont bien rendues sur chaque ligne de pose, sans intitulé.**

- *Le chiffre* : 2 lignes de chiffres par pose, 4 nombres
- *La preuve* : `MesuresDuLot` (Personnages.tsx:2732-2749) rend « ressemblance 0.37 · case 2 » puis « grille 7 px · dérive 1.00× », et il est appelé au milieu de chaque ligne de pose (Personnages.tsx:2097). Leur seule explication est une infobulle au survol : « mesuré au dépliage du lot ». Elles n'apparaissent que si l'image de la case vient d'une planche.

**FORT — La Galerie charge toute la bibliothèque du jeu d'un coup, sans pagination ni fenêtrage, et le serveur recalcule chaque vignette à la demande.**

- *Le chiffre* : jusqu'à 200 images, 0 pagination
- *La preuve* : Le client appelle `/assets` sans limite (api.ts:3281-3289) ; le serveur applique un plafond de 200 (routes.py:1080) sans jamais dire qu'il a tronqué. La grille rend toutes les entrées reçues en une seule passe (App.tsx:3325-3343) — les images ont bien `loading="lazy"` (Tuile.tsx:167), mais pas les nœuds. Chaque vignette est redimensionnée par le serveur à chaque première demande (routes.py:1268-1290), sans cache disque ; seul le navigateur la garde ensuite un an.

**MOYEN — La Galerie mêle bien les jeux, mais seulement dans un cas précis : dès qu'on clique une collection.**

- *Le chiffre* : 1 filtre sur 4 fait sauter le jeu
- *La preuve* : routes.py:1095-1096 ne pose le filtre du jeu ouvert que si aucune collection n'est demandée ; avec une collection, la recherche part avec `projet=None`, c'est-à-dire tous les jeux (bibliotheque.py:386-404). Et l'arbre propose les collections sans jeu quel que soit le jeu ouvert (Arbre.tsx:48-50).

**MOYEN — Quatre écrans plein cadre de l'établi n'apparaissent pas dans le fil d'Ariane : il continue d'afficher le nom de la chose comme si on était resté sur la matrice.**

- *Le chiffre* : 4 surfaces invisibles au fil
- *La preuve* : L'état de la fiche, de la vitrine, du calibrage et de la planche vit dans `EcranEtabli` (Personnages.tsx:238-257) ; le fil, lui, est construit dans App.tsx:2068-2097 et ne connaît que la chose ouverte et l'image ouverte. Sur ces quatre écrans, le dernier segment reste « Balthazar », et un dernier segment n'est jamais cliquable (BarreChassis.tsx:86-94).

**MOYEN — Deux composants différents portent le même nom et répondent à la même question sur la même chose.**

- *Le chiffre* : 2 « FicheDeLaChose »
- *La preuve* : Codex.tsx:766 rend un panneau de 380 px intitulé « La chose choisie » avec un bloc « Ce qu'elle réclame ». FicheChose.tsx:133 rend un écran plein cadre avec une section « Ce qu'on lui réclame » (FicheChose.tsx:888). Personnages.tsx:62 importe le second, Codex.tsx définit le premier.

**MOYEN — La colonne de gauche du Codex mélange cinq familles d'objets et deux réglages de jeu, ces derniers ayant chacun leur propre intitulé de bloc.**

- *Le chiffre* : 2 rangées de réglage sur 7
- *La preuve* : Codex.tsx:343-387 : les cinq familles, puis un trait et l'intitulé « Ce que le jeu réclame de tous » pour la seule rangée « Les directions », puis un second trait et l'intitulé « Ce que les personnages réclament » pour la seule rangée « Leurs poses ». Deux rangées occupent donc deux sections complètes, contre une seule pour les cinq familles réunies.

**MOYEN — Deux surfaces sans rapport portent le mot « Réglages » dans la même interface.**

- *Le chiffre* : 2 homonymes
- *La preuve* : Le deuxième des trois côtés de l'onglet Univers s'appelle « Réglages » et ouvre l'assistant du jeu, en douze étapes (Univers.tsx:382, Assistant.tsx:132-163). Le mot « Réglages » de la barre du haut ouvre la fenêtre des clés, des garde-fous et des dossiers (App.tsx:2370, EcranReglages.tsx).

**FAIBLE — Il n'y a pas d'état « aucun jeu ouvert » au démarrage : un jeu « Bac à sable » est créé et ouvert à la première ouverture, et le premier lancement bascule sur l'assistant.**

- *Le chiffre* : 1 jeu toujours ouvert
- *La preuve* : Au démarrage, le serveur crée « Bac à sable » s'il n'y a aucun jeu (bibliotheque.py:112-117) et retombe sur le premier jeu de la liste si l'état ne dit rien (bibliotheque.py:335-339). Côté écran, `premier_lancement` fait basculer sur l'onglet Univers, côté Réglages, une seule fois par session (App.tsx:938-942). L'état « aucun jeu » n'est atteignable que par la ligne « Sans projet », qui n'existe que si des images orphelines existent (Arbre.tsx:147).

**FAIBLE — Tant que le serveur n'a pas envoyé son premier message, l'onglet Univers et l'écran Réglages ne rendent rien du tout.**

- *Le chiffre* : 2 surfaces vides à froid
- *La preuve* : App.tsx:2784 et App.tsx:2994 conditionnent leur rendu à `etat &&`. Cliquer « Univers » avant l'arrivée du premier message laisse la ligne du milieu entièrement vide, entre la barre du haut et la barre d'état, sans message.

**FAIBLE — Un clic n'a aucun effet dans la grille de choix d'une image de référence : celui sur une planche qui attend un choix.**

- *Le chiffre* : 1 commande inerte
- *La preuve* : App.tsx:2543 pose l'état du dépliage depuis cette grille, mais l'écran de dépliage n'est rendu qu'à l'intérieur de la Galerie (App.tsx:2706), elle-même démontée quand la fenêtre de confirmation est ouverte (App.tsx:2639, condition `!envoiOuvert`).

**MOYEN — Deux surfaces font le même métier — expliquer où l'argent est passé — à deux endroits différents.**

- *Le chiffre* : 2 journaux de ratés
- *La preuve* : L'écran des Dépenses (Depenses.tsx:1-11) déclare en tête qu'il remplace le journal des appels ratés de la colonne de gauche de la Galerie. Ce journal est toujours rendu (Arbre.tsx:209, 300-378), avec ses ratés, leur coût et son propre bouton « Relancer › ».

### Ce que cette lecture impose

- La carte cible doit inventer une surface qui n'existe pas : l'écran d'ouverture qui propose de choisir un jeu. Ce n'est pas un déplacement de commande, c'est une création — aujourd'hui le choix du jeu est un effet de bord d'une colonne de rangement d'images (Arbre.tsx:96-156).
- Le nom du jeu ouvert doit être visible et actionnable depuis les trois onglets, pas seulement affiché en haut à droite : deux des trois onglets travaillent entièrement sur ce jeu sans jamais permettre d'en changer.
- La séparation Univers / Codex que l'auteur décrit est juste dans l'intention mais fausse dans le code : l'onglet Univers contient trois choses de nature différente (chercher une idée, remplir douze étapes de réglages, fabriquer des lots de style) et le Codex contient deux réglages de jeu au rang de familles d'objets. La carte cible doit trancher où vont « Les directions » et « Leurs poses », et où va l'assistant.
- « Équipement » doit cesser d'être une famille du Codex tant qu'elle n'a pas d'écran de la même nature que les quatre autres : soit on lui donne un vestiaire illustré, soit on la sort de la liste des familles — la position actuelle promet une chose et en donne une autre.
- La colonne de droite du Codex est à refaire, pas à déplacer : deux de ses trois lignes ne peuvent pas être fausses parce qu'elles ne mesurent rien. Une carte qui la conserverait telle quelle reconduirait le seul défaut que l'auteur qualifie de faux.
- Le bandeau de fabrication doit devenir conditionnel à ce qu'on regarde : il n'a rien à faire sous « Les directions », « Leurs poses » ni « Équipement », et sa version dépliée ne peut pas occuper 40 % d'un écran dont le sujet est ailleurs.
- La règle « le fil d'Ariane dit où l'on est » n'est pas tenue : quatre écrans plein cadre y sont invisibles et l'écran de retouche n'a pas d'autre sortie que lui. Toute carte cible qui garde le fil comme unique système de retour doit d'abord réparer ces cinq cas.
- Le nombre de surfaces à ranger n'est pas de trois onglets et quelques écrans, mais de 42 : les regrouper demande de décider lesquelles sont des lieux, lesquelles sont des outils qu'on ouvre sur un objet, et lesquelles doivent disparaître (au moins deux doublons avérés et une surface morte).
- La lenteur de la Galerie n'est pas un défaut d'affichage à corriger plus tard : la grille est plafonnée à 200 images sans le dire, donc la carte cible doit prévoir dès maintenant une pagination et un compte honnête, sans quoi l'écran mentira davantage à mesure que le jeu grandira.
- Les indicateurs techniques de la matrice ne doivent pas simplement être masqués : ils répondent à une vraie question (« cette image ressemble-t-elle trop à sa voisine ? »). La carte cible doit décider où cette question se pose — probablement sur l'écran de dépliage ou dans une table — plutôt que sur chaque ligne de la liste des poses.

---

<a id="lecture-2"></a>

## 2 · L'onglet Univers : trois écrans étrangers derrière trois mots — et la toile d'accueil que l'auteur décrit n'existe pas encore

La thèse de l'auteur — « l'Univers, c'est la partie créative » — n'est vraie que pour un tiers de l'onglet. Le côté Inspiration est bien créatif ; le côté Ambiances l'est à moitié ; mais le côté Réglages est un formulaire de douze étapes dont sept ne décident rien de l'apparence du jeu — elles décident combien d'images fabriquer, quelle IA appeler, comment détourer au retour, et où sont les clés des fournisseurs. La frontière qu'il croit propre est donc déjà cassée à l'intérieur de l'onglet qu'il ne critique pas. Et l'arrivée qu'il décrit — « j'allume, je choisis mon jeu, j'arrive sur la toile de l'univers » — n'existe dans aucune de ses trois étapes : l'application ouvre la Galerie, le choix du jeu vit dans l'arbre de la Galerie, et la toile n'est ni l'écran d'ouverture, ni la vue par défaut du côté Inspiration. Enfin, la panne qu'il attribue à la Galerie (« ça rame plus on a d'images ») a été corrigée dans la Galerie le 31 août et n'a jamais été appliquée au tableau d'inspiration, qui télécharge aujourd'hui 95 Mo d'images pleine taille pour remplir des cases de 148 pixels.

### Ce que vaut la plainte de l’auteur, sur cette surface

> L'auteur ne se plaint pas de l'Univers : il le prend pour acquis et l'oppose au Codex. Sur cette surface-là, il est donc en dessous de la réalité, sur trois points mesurables. Un : le premier écran qu'il décrit — choisir son jeu, puis arriver sur la toile — n'est câblé nulle part ; l'application ouvre la Galerie (App.tsx:249) et le seul endroit où l'on change de jeu est l'arbre de la Galerie (Arbre.tsx:71). Deux : la toile qu'il veut voir en arrivant est vide sur son vrai projet — aucune des 55 cartes de « coeur-de-pierre » n'a de paquet ni de place, elles sont toutes dans la réserve ; ce qu'il verrait est une colonne de vignettes à classer, pas une carte mentale de son monde. Trois : le défaut de lenteur qu'il impute à la Galerie est plus grave sur le tableau d'inspiration, qui n'a pas reçu le correctif. En revanche il a raison, et il n'a mesuré que la moitié du problème, quand il dit que « les directions et les poses réclamées par les personnages » polluent le Codex : ce ne sont pas seulement des réglages mal rangés, ce sont des doublons — l'étape 8 de l'assistant et la rubrique « Leurs poses » du Codex écrivent la même liste par le même appel, et les directions du Codex sont lues dans la vue choisie à l'étape 3 de l'assistant.

### Les surfaces examinées

#### Univers — la coquille et ses trois mots

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Univers.tsx`

**À quoi ça sert** — Ce n'est pas un écran : c'est un aiguillage qui montre l'un de trois écrans sans rapport entre eux, un seul à la fois, en pleine page.

**Ce que ça porte** — Trois mots — Inspiration, Réglages, Ambiances et couleurs (lignes 380-384) —, un seul allumé, et le côté allumé prend tout l'écran. Zéro réglage en propre. Quand Inspiration est allumé, les trois mots se logent dans la barre du tableau pour ne pas empiler une troisième bande (lignes 297 et 313) ; sur les deux autres côtés, une bande de 38 px les porte seule (ligne 242). Le fichier ne contient qu'un seul bouton et aucun champ.

**Comment on y arrive** — En cliquant l'onglet « Univers » dans la barre du haut. Ce n'est pas l'onglet de départ : l'application ouvre sur la Galerie (App.tsx:249). Le seul cas où l'on y tombe tout seul est le tout premier lancement d'un atelier neuf, et il ouvre alors directement le côté Réglages (App.tsx:936-942).

**Comment on en sort** — En cliquant un autre onglet. Aucun état n'est retenu : le côté allumé et la vue choisie sont de simples états de composant (App.tsx:500 et 504), donc un rechargement de la page ramène toujours Inspiration en vue grille.

**Les défauts** :

- Les trois côtés n'ont rien en commun : le premier est une planche d'images, le deuxième un formulaire, le troisième un éditeur de couleurs. Rien à l'écran ne dit pourquoi ils sont sous le même mot.
- L'onglet reçoit encore l'état « colonne de l'univers repliée » et ne s'en sert nulle part : la colonne a été supprimée, l'accessoire est resté (déclaré ligne 113, seule la réserve est lue ligne 220).
- Rien ne retient où l'on en était : chaque rechargement rouvre la Galerie, puis Inspiration, puis la grille.

#### Inspiration — le tableau, vue grille

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tableau.tsx`

**À quoi ça sert** — Rassembler tout ce qui inspire le jeu — images collées, adresses, notes — dans une planche contact où l'on colle sans rien remplir avant.

**Ce que ça porte** — Une barre de 38 px : les trois mots des côtés, le mot « Tableau », le nombre de cartes, le nombre d'artworks officiels, la liste des noms de paquets, un bouton « + note » et un sélecteur de vue à deux positions — 6 choses cliquables, 4 chiffres ou étiquettes (lignes 655-733). Dessous, une case par carte, 148 px de large au minimum, l'image entière dedans (lignes 987-995). Au repos du pointeur de 0,2 s, un menu de 240 px s'ouvre sous la carte : sur une image, Groupe, Note, Taille à trois crans, une bascule par personnage du jeu, « promouvoir », les 5 familles, « regarder ce que la palette y prend », « Découper › », l'adresse d'origine et « Retirer » — soit 19 commandes sur le projet en cours, qui compte 4 personnages ; sur une note, Groupe, Note, Taille, le texte entier et 11 pastilles de couleur, soit 18 (lignes 1319-1597).

**Comment on y arrive** — C'est le côté allumé par défaut de l'onglet.

**Comment on en sort** — Un autre côté, un autre onglet, ou « Découper › » dans le menu d'une carte, qui remplace le tableau par l'écran de découpe.

**Les défauts** :

- Chaque case demande l'image complète au serveur, qui la réencode en PNG à chaque fois et interdit la mise en cache (atelier/api/univers.py:684-704). Aucun chargement différé, aucune vignette, aucune pagination : la route dit elle-même « il ne se pagine pas : on le regarde » (atelier/api/univers.py:327).
- Le menu qui s'ouvre au survol porte jusqu'à 19 commandes sur une vignette de 148 px — c'est plus dense que n'importe quel panneau du produit, et il apparaît sans qu'on l'ait demandé.
- Trois de ces commandes ne sont pas créatives : promouvoir en artwork officiel, choisir sa famille, et lire ce que la palette y prend. Elles décident quelles images de référence partiront avec quelles fabrications.

#### Inspiration — la toile (c'est bien « la toile de l'univers »)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Toile.tsx`

**À quoi ça sert** — Regarder la même matière autrement : un plan libre où l'on pose les cartes à la main, où l'on entoure celles qui vont ensemble, et où l'on tire des traits entre elles. C'est la carte mentale du monde.

**Ce que ça porte** — La même barre qu'en grille. À gauche le plan, à droite une réserve de 380 px qui affiche « N à classer » et ne contient que ce qui n'a ni paquet ni place (Tableau.tsx:509-586). Sur le plan : les cartes posées, les paquets — appelés îlots, et un îlot n'est rien d'autre qu'un nom écrit sur des cartes —, et les traits. Le menu d'un paquet porte 11 pastilles de couleur, « faire une palette de ce paquet » et « faire une ambiance de ce paquet », plus un renvoi « aller la voir › » (lignes 2320-2380). Le menu d'un trait porte un mot, une bascule de pointe et « Couper » (lignes 2680-2723). Rien ne se réaligne tout seul : aucun rangement automatique.

**Comment on y arrive** — Sélecteur « Vue » de la barre, position « toile ». Ce n'est pas la position par défaut (App.tsx:500).

**Comment on en sort** — Repasser en grille, changer de côté ou d'onglet. Le zoom et le cadrage ne sont pas enregistrés.

**Les défauts** :

- Sur le vrai projet de l'auteur, la toile est complètement vide : sur 55 cartes, aucune n'a de paquet et aucune n'a de place. Tout est dans la réserve. L'écran qu'il veut voir en arrivant lui montrerait une colonne de 380 px et un plan blanc.
- Deux boutons de fabrication d'objets rangés ailleurs sont posés dans le menu d'un paquet, sur la surface censée être purement créative. Ils sont gratuits, mais ils envoient vers le troisième côté de l'onglet.
- Les cartes du plan chargent les mêmes images pleine taille que la grille — le poids ne baisse pas parce qu'on change de vue.

#### Inspiration — découper une carte

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Decoupe.tsx`

**À quoi ça sert** — Prendre un artwork qui contient trois personnages sur un fond et en faire trois cartes. C'est un écran entier, 769 lignes, qui remplace le tableau.

**Ce que ça porte** — Deux colonnes : l'image en grand à gauche, les réglages de découpe à droite sur 380 px. On dessine des rectangles, la machine en propose, on ajoute et on retire. Les morceaux reviennent en réserve, jamais classés.

**Comment on y arrive** — « Découper › » dans le menu d'une carte image déjà arrivée (Tableau.tsx:1328 et 1554-1563). Le même écran s'ouvre aussi depuis la Galerie, sur une planche d'images produites — deux portes, deux familles d'objets.

**Comment on en sort** — Le fil d'Ariane du haut, ou la fin de la découpe : on retombe sur le tableau, où les morceaux sont en réserve.

**Les défauts** :

- C'est un outil de traitement d'image logé dans la partie créative — même outil, mêmes gestes que la découpe des planches produites, mais atteint depuis un autre onglet.
- Rien ne s'ouvre après la découpe : les morceaux arrivent en réserve et il faut aller les chercher.

#### Réglages — l'assistant en douze étapes

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Assistant.tsx`

**À quoi ça sert** — C'est le seul endroit où se règle l'univers d'un jeu, et le fichier le déclare : « il n'y a pas d'autre panneau de réglages à côté ». Il sert de tunnel de démarrage au premier lancement et d'écran de réglages ordinaire ensuite.

**Ce que ça porte** — 3 257 lignes. Une colonne de 240 px à gauche : quatre groupes — le jeu, le style, la production, l'atelier — et douze rangées numérotées, chacune avec ce qu'elle vaut en résumé (lignes 132-164 et 313-370) ; en pied, un bloc « Ce que cet univers envoie » avec trois comptes. À droite, une étape à la fois, titrée en 24 px, avec une phrase qui explique avant de demander. En bas, une bande de 44 px : « ‹ Retour », douze points d'avancement, « étape N sur 12 », « j'ai fini pour l'instant », « Continuer → » (lignes 484-548). Le contenu des douze : 1 le nom du jeu ; 2 pixel art ou dessin ; 3 la vue ; 4 la taille ou la finesse ; 5 les types d'objets, avec pour chacun sa famille d'images de référence, sa hauteur en pourcentage et sa silhouette ; 6 l'allure, sept cases de texte remplies à l'étiquette ; 7 les références et couleurs, avec la palette calculée, le nombre de couleurs et le fond ; 8 les poses et états, avec le calcul « poses × images par pose = images à fabriquer » ; 9 les emplacements du corps et leur ordre d'empilement ; 10 quelle IA pour quelle famille, 4 listes déroulantes ; 11 comment le fond est retiré au retour ; 12 les clés des fournisseurs.

**Comment on y arrive** — Le mot « Réglages » en haut de l'onglet, à tout moment. Ou tout seul, une fois, au premier lancement d'un atelier neuf.

**Comment on en sort** — « j'ai fini pour l'instant » à n'importe quelle étape : on tombe dans le Codex, rubrique Personnages, champ de nom allumé (App.tsx:2798-2802). Ou en cliquant un autre côté. Rien n'est exigé, aucune étape n'est bloquante.

**Les défauts** :

- Sept étapes sur douze ne décident rien de l'apparence du jeu : la taille, les types, les poses, les emplacements, les IA, le détourage et les fournisseurs décident du nombre d'images à faire, de qui les fait, et de ce que l'atelier en fait au retour.
- L'étape 12 le dit elle-même : ce qu'on y dépose « vaut pour tous les jeux de l'atelier ». Ce n'est pas un réglage de ce jeu-ci, et c'est le même composant que dans la fenêtre Réglages du produit.
- L'étape 8 écrit exactement la même liste de poses que la rubrique « Leurs poses » du Codex, par le même appel — c'est le doublon dont l'auteur se plaint côté Codex, vu de l'autre bout.
- Sur les quatre vrais projets du disque, l'étape 10 n'a jamais été remplie et l'étape 11 non plus.
- La colonne de gauche affiche une valeur vide quand une étape ne porte rien, ce qui se lit « pas encore ouverte » aussi bien que « vide ». Sur le projet coeur-de-pierre les sept cases de style existent et sont toutes vides : la colonne n'affiche rien.
- Le titre de l'étape 4 change de nom selon le style choisi à l'étape 2 — deux noms pour une même case.

#### Ambiances et couleurs

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Ambiances.tsx`

**À quoi ça sert** — Dire une fois ce qu'un coin du jeu a de différent — le marais plus gris, les monstres plus froids — et s'en servir autant de fois qu'on veut. C'est le seul vrai atelier de couleur du produit.

**Ce que ça porte** — 1 070 lignes. Une colonne de 240 px : la liste des ambiances avec, pour chacune, qui s'en sert ; la liste des palettes, celle du jeu en tête et non ouvrable ; deux champs où taper un nom crée l'objet. À droite, pour une palette, cinq blocs dans l'ordre où ils s'appliquent : les sources, la fusion avec deux curseurs, les retouches, la palette rendue — un bouton par couleur, 48 couleurs sur le projet en cours — et un aperçu qui pose la palette sur de vraies images côte à côte (lignes 420-456). Pour une ambiance, quatre onglets : sa palette, ses images de référence, ses trois cases de texte, qui s'en sert (lignes 892-960).

**Comment on y arrive** — Le troisième mot en haut de l'onglet. Ou depuis le menu d'un paquet de la toile, après avoir fabriqué une palette ou une ambiance : « aller la voir › ».

**Comment on en sort** — Un autre côté, un autre onglet.

**Les défauts** :

- Rien n'y mène depuis les objets qui s'en servent : une chose du jeu désigne son ambiance sur sa fiche, dans le Codex, mais la fiche ne renvoie pas ici.
- Sur les cinq projets du disque, un seul — un projet d'essai — porte des ambiances et des palettes : 3 et 3. Les quatre autres en ont zéro.
- L'écran vide dit « Nomme le premier coin », ce qui est une invitation, mais il n'explique nulle part que le résultat s'applique au retour et ne coûte rien — la phrase existe, deux clics plus loin, sous la liste déroulante d'une ambiance.

#### La fenêtre Réglages du produit (hors onglet, mais elle chevauche l'Univers)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/EcranReglages.tsx`

**À quoi ça sert** — Les clés des fournisseurs, les garde-fous de l'agent et les dossiers de travail — ce qui vaut pour l'atelier entier, pas pour un jeu.

**Ce que ça porte** — 419 lignes, une fenêtre de 520 px posée par-dessus l'écran, trois blocs : les fournisseurs, l'agent, les dossiers.

**Comment on y arrive** — Un bouton de la barre du châssis (App.tsx:2366 et 2370).

**Comment on en sort** — Le bouton « Fermer — Échap », la touche Échap, ou un clic à côté.

**Les défauts** :

- Son premier bloc est exactement l'étape 12 de l'assistant : même composant, mêmes données. Deux portes, une seule pièce — c'est assumé dans le code, mais l'auteur qui cherche ses clés a deux endroits à connaître.

### Les constats

**BLOQUANT — Le tableau d'inspiration télécharge toutes ses images en pleine taille, sans vignette, sans chargement différé, sans mise en cache, et le serveur les réencode en PNG à chaque demande — c'est exactement la panne que l'auteur décrit pour la Galerie, en pire, et la Galerie a été corrigée le 31 août 2026.**

- *Le chiffre* : 55 cartes, 95,3 Mo de PNG, 1,77 Mo par carte en moyenne et 3,2 Mo pour la plus lourde, affichées dans des cases de 148 px de large ; la Galerie, elle, téléchargeait 25,5 Mo et n'en affichait que 0,5 avant correction
- *La preuve* : interface/src/composants/Tableau.tsx:987-995 (aucun attribut de chargement différé) ; interface/src/api.ts:3597-3598 (l'adresse demandée est l'image entière) ; atelier/api/univers.py:684-704 (réencodage PNG à chaque appel, en-tête « no-cache ») ; atelier/api/univers.py:327 (« il ne se pagine pas : on le regarde ») ; à comparer avec interface/src/api.ts:4318-4331 et interface/src/composants/Tuile.tsx:110 et 167, où la Galerie emploie une vignette et le chargement différé ; poids mesuré sur donnees/projets/coeur-de-pierre/tableau

**FORT — L'arrivée que l'auteur décrit — allumer, choisir son jeu, arriver sur la toile de l'univers — n'est câblée nulle part. L'application ouvre la Galerie, et le seul endroit où l'on change de jeu est l'arbre de gauche de la Galerie.**

- *Le chiffre* : onglet de départ : Galerie ; 2 clics pour atteindre la toile, et il faut savoir que le deuxième est un sélecteur de vue
- *La preuve* : interface/src/App.tsx:249 (onglet de départ « galerie ») ; interface/src/composants/Arbre.tsx:71 (le changement de projet) ; interface/src/App.tsx:500 (vue de départ « grille »)

**FORT — Sur le vrai projet de l'auteur, la toile est entièrement vide : aucune carte n'a de paquet ni de place, tout est dans la réserve. L'écran d'accueil qu'il souhaite lui montrerait un plan blanc et une colonne de vignettes à classer.**

- *Le chiffre* : 0 paquet et 0 carte posée sur 55 cartes (coeur-de-pierre) ; 1 seule carte promue en artwork officiel ; le second projet, coeur-de-pierre-01, est le seul rangé : 5 paquets, 19 cartes posées sur 25, 3 traits
- *La preuve* : donnees/projets/coeur-de-pierre/tableau/*.json et donnees/projets/coeur-de-pierre-01/tableau/*.json (champs « groupe » et « position »)

**FORT — Sept des douze étapes du côté Réglages ne décident rien de l'apparence du jeu. Elles décident combien d'images il faudra fabriquer, quelle IA appeler, comment l'atelier traite l'image au retour, et où sont les clés des fournisseurs.**

- *Le chiffre* : 7 sur 12 : la taille, les types d'objets, les poses, les emplacements, les IA, le détourage, les fournisseurs. Restent 3 étapes vraiment créatives — le style, l'allure, les références et couleurs — plus le nom et la vue.
- *La preuve* : interface/src/composants/Assistant.tsx:132-164 (la liste des douze et leurs quatre groupes, dont un groupe « la production » de quatre étapes et un groupe « l'atelier » d'une)

**FORT — La rubrique « Leurs poses » du Codex, dont l'auteur dit qu'elle pollue une colonne entière, écrit exactement la même liste que l'étape 8 de l'assistant, par le même appel au serveur. Ce n'est pas un réglage mal rangé, c'est le même réglage à deux endroits.**

- *Le chiffre* : 1 liste, 2 écrans
- *La preuve* : interface/src/composants/Assistant.tsx:2301 et interface/src/composants/Personnages.tsx:478 (tous deux appellent api.ajouterPose) ; interface/src/composants/Codex.tsx:383-388 (la rangée du Codex)

**FORT — L'autre ligne de la même colonne du Codex, « Les directions », est lue dans la vue du jeu choisie à l'étape 3 de l'assistant, et l'écran le dit lui-même. Là encore, un réglage de l'Univers affiché dans le Codex.**

- *Le chiffre* : la liste suit la vue tant qu'on n'y touche pas ; dès qu'on renomme une direction, elle s'en détache
- *La preuve* : interface/src/composants/Codex.tsx:1022-1034 (« lues dans la vue du jeu, réglée dans l'Univers ») ; interface/src/composants/Assistant.tsx:856 (l'étape qui choisit la vue)

**FORT — Le côté Ambiances est le seul vrai atelier de couleur du produit, et rien n'y mène. Il faut connaître le troisième mot en haut de l'onglet Univers. La fiche d'une chose du jeu, qui est l'endroit où l'on désigne son ambiance, ne renvoie pas vers lui.**

- *Le chiffre* : sur 5 projets du disque, 4 n'ont ni ambiance ni palette ; le seul qui en a est un projet d'essai, avec 3 et 3
- *La preuve* : interface/src/composants/Univers.tsx:353-359 (le seul point de montage) ; interface/src/composants/FicheChose.tsx:388-390 (la fiche affiche l'ambiance mais n'y mène pas) ; donnees/projets/*/projet.json

**MOYEN — Des décisions de fabrication se prennent depuis la surface la plus créative de l'onglet : promouvoir une carte en artwork officiel et lui donner une famille décide quelles images de référence partiront avec quelles générations, et un bouton « regarder » lance une mesure de détourage sur l'image.**

- *Le chiffre* : 3 des 19 commandes du menu d'une carte
- *La preuve* : interface/src/composants/Tableau.tsx:1490-1537 (promotion, les 5 familles, la lecture de palette)

**MOYEN — Deux boutons qui fabriquent des objets rangés dans un autre côté de l'onglet vivent dans le menu d'un paquet de la toile — faire une palette, faire une ambiance. Le code le sait et pose une phrase pour le dire, ce qui est l'aveu que la frontière est franchie.**

- *Le chiffre* : 2 boutons, plus un renvoi « aller la voir › »
- *La preuve* : interface/src/composants/Toile.tsx:2342 et 2354, et la phrase de la ligne 2390 : « elles vivent dans l'onglet Univers, côté Ambiances et couleurs »

**MOYEN — L'étape 12 de l'assistant ne concerne aucun jeu et existe déjà, à l'identique, dans la fenêtre Réglages du produit — même composant, mêmes données, deux portes.**

- *Le chiffre* : 1 composant, 2 écrans
- *La preuve* : interface/src/composants/Assistant.tsx:3247 et interface/src/composants/EcranReglages.tsx:141 (tous deux montent TiroirDesSecrets) ; le texte de l'étape dit lui-même « ce qu'on dépose ici vaut pour tous les jeux »

**MOYEN — Deux des douze étapes n'ont jamais été remplies sur aucun projet réel : le choix des IA par famille et le détourage de départ.**

- *Le chiffre* : la liste des IA est vide sur 4 projets sur 4 ; le détourage est vide ou absent sur 4 sur 4
- *La preuve* : donnees/projets/coeur-de-pierre/projet.json, coeur-de-pierre-01/projet.json, test-v2/projet.json, bac-a-sable/projet.json (champs « modeles » et « detourages »)

**MOYEN — L'assistant ne s'ouvre tout seul que dans un cas très étroit — un seul projet, encore nommé bac-à-sable, et zéro image dans tout l'atelier — et jamais deux fois dans la même page. Ensuite il ne s'ouvre plus que si on le demande.**

- *Le chiffre* : 3 conditions à réunir, 1 seule ouverture automatique par page ouverte
- *La preuve* : atelier/services/bibliotheque.py:881-904 (la définition de « l'atelier n'a encore rien ») ; interface/src/App.tsx:936-942 (le garde qui empêche la seconde ouverture)

**FAIBLE — On peut le rouvrir à tout moment d'un clic, et le quitter à n'importe quelle étape sans que rien ne soit exigé. On retombe alors dans le Codex, rubrique Personnages, champ de nom allumé. Aucune étape n'est bloquante et aucune n'est marquée en retard.**

- *Le chiffre* : 12 étapes, 0 obligatoire ; le bouton de sortie porte l'infobulle « rien n'est exigé — une étape passée reste passée »
- *La preuve* : interface/src/composants/Univers.tsx:380-384 (les trois mots, toujours visibles) ; interface/src/composants/Assistant.tsx:530-545 (le bouton « j'ai fini pour l'instant ») ; interface/src/App.tsx:2798-2802 (où l'on retombe)

**MOYEN — Sauter des étapes n'a pas de conséquence visible tout de suite, mais chacune en produit une plus loin, dans un autre écran : sans vue choisie, le Codex n'a aucune direction et le mot n'y paraît nulle part ; sans taille de pixel, la hauteur des types ne s'applique pas ; sans artwork officiel promu, le jeu n'a pas de palette ; sans silhouette sur un type, l'étape des emplacements se referme d'elle-même.**

- *Le chiffre* : 4 conséquences repérées, toutes dans un écran différent de celui où le réglage se pose
- *La preuve* : interface/src/composants/Codex.tsx:1031-1034 ; interface/src/composants/Assistant.tsx:1322 ; interface/src/composants/Assistant.tsx:1908-1934 ; interface/src/composants/Assistant.tsx:2591-2599

**MOYEN — La colonne récapitulative de l'assistant n'affiche rien quand une étape ne porte rien, si bien qu'une étape jamais ouverte et une étape ouverte mais vide se ressemblent. Sur le projet coeur-de-pierre, les cases de style existent et sont toutes vides : la colonne reste muette.**

- *Le chiffre* : 5 cases de style présentes, 0 signe écrit dans les cinq
- *La preuve* : interface/src/composants/Assistant.tsx:551-590 (la fonction rend une chaîne vide) ; donnees/projets/coeur-de-pierre/projet.json

**FAIBLE — Un accessoire mort traverse encore l'onglet : l'état « colonne de l'univers repliée » est passé à l'écran, qui ne s'en sert nulle part depuis que cette colonne a été supprimée.**

- *Le chiffre* : 1 accessoire déclaré, 0 usage
- *La preuve* : interface/src/composants/Univers.tsx:113 (déclaré) et 220 (seule la réserve est lue) ; interface/src/App.tsx:2812 (toujours envoyé)

### Ce que cette lecture impose

- Si la toile devient l'écran d'accueil d'un jeu, il faut d'abord lui donner des vignettes, un chargement différé et une mise en cache — sinon l'accueil sera l'écran le plus lourd du produit, à 95 Mo sur le projet réel. Le correctif existe déjà pour la Galerie : c'est la même route à refaire, pas une invention.
- L'accueil doit aussi avoir quelque chose à montrer : sur le vrai projet, 55 cartes sur 55 sont non classées. Soit la toile propose un premier rangement, soit l'écran d'ouverture doit assumer de montrer la réserve, soit il faut autre chose — l'artwork officiel, la palette, les cases de style — comme portrait du jeu.
- Le choix du jeu doit sortir de l'arbre de la Galerie : c'est aujourd'hui le seul endroit où l'on change de projet, et l'auteur veut que ce soit la première chose qu'il voie.
- Il faut retenir où l'on était — le jeu, l'onglet, le côté, la vue, le cadrage de la toile. Aujourd'hui tout revient à zéro à chaque rechargement.
- Le côté Réglages doit se couper en deux, et la ligne de coupe est déjà écrite dans le code : les groupes « le jeu » et « le style » restent dans l'Univers ; le groupe « la production » (poses, emplacements, IA, détourage) appartient à la fabrication, donc au Codex ou à un écran de production ; le groupe « l'atelier » (les clés) n'appartient à aucun jeu et existe déjà dans la fenêtre Réglages — il peut disparaître de l'assistant sans rien perdre.
- Les poses et les directions ne doivent avoir qu'un seul endroit. Si elles restent dans l'Univers, la colonne du Codex se vide de ce qui l'encombre ; si elles descendent dans le Codex, l'assistant perd deux étapes sur douze. Dans les deux cas le doublon disparaît, et c'est ce doublon qui est la cause de la plainte.
- Le côté Ambiances doit être atteignable depuis les choses qui s'en servent — la fiche d'un personnage désigne son ambiance sans pouvoir l'ouvrir. Tant que ce chemin n'existe pas, l'écran restera inutilisé : quatre projets sur cinq n'ont aucune ambiance.
- La promotion d'une carte en artwork officiel est le seul vrai pont entre l'imaginaire et la fabrication : c'est le geste qui fait entrer une image d'inspiration dans ce qui part au modèle. Il mérite d'être nommé et montré comme tel, pas d'être la neuvième ligne d'un menu de survol.
- Si l'onglet garde ses trois côtés, il faut dire à l'écran pourquoi ils sont ensemble : rien aujourd'hui ne relie une planche d'images, un formulaire de douze étapes et un éditeur de couleurs, et le passage de l'un à l'autre se fait sans transition ni fil.

---

<a id="lecture-3"></a>

## 3 · La colonne de gauche du Codex : cinq familles, et trois formulaires de réglage déguisés en familles

L'auteur a raison sur les directions, et il est même en dessous de la réalité : ce ne sont pas deux choses qui polluent la colonne, mais trois. La rangée « Équipement » est rangée parmi les familles du monde, mais elle n'ouvre pas une liste de choses — elle ouvre le même genre de formulaire que « Les directions » et « Leurs poses ». Sur les sept rangées cliquables, quatre ouvrent une liste de choses et trois ouvrent un formulaire ; et les deux formulaires que l'auteur nomme, avec leurs traits de séparation et leurs intitulés, occupent environ 139 pixels de hauteur contre 130 pour les cinq familles réunies — un peu plus de la moitié de la colonne. Sur les six projets du dossier de données, la liste des directions n'a jamais été écrite à la main dans quatre d'entre eux, et dans les deux autres l'auteur ne l'a pas composée : il l'a réduite (une seule direction gardée sur deux, ou toutes retirées). En revanche, la liste des poses, elle, est bel et bien retouchée en travaillant — un projet porte neuf attitudes écrites à la main avec leur consigne anglaise —, donc « on la règle une fois et on n'y retouche pas » n'est vrai que pour les directions. Et les deux ont déjà un logement ailleurs : l'onglet Univers, côté Réglages, contient un écran en douze étapes dont la troisième s'appelle « La vue » (c'est elle qui fabrique les directions), la huitième « Poses et états » (elle ajoute et retire déjà les mêmes poses) et la neuvième « Emplacements » (elle règle déjà la moitié du vestiaire).

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact sur les directions, et en dessous de la réalité sur l'ampleur ; partiellement inexact sur les poses. Sur les directions, la preuve est nette et vient des données, pas des documents : la liste n'a jamais été écrite à la main dans quatre projets sur six, et dans les deux autres l'auteur ne l'a pas composée, il l'a réduite ; le produit lui-même la range dans l'univers du jeu et la déduit du choix de vue fait ailleurs. Sur l'ampleur, il est en dessous : ce ne sont pas deux rangées qui polluent la colonne mais trois, la troisième — Équipement — étant déguisée en famille du monde tout en ouvrant exactement le même genre de formulaire, ce qui explique aussi l'autre grief de sa liste, celui des paragraphes de texte au lieu d'un vestiaire d'images. Sur les poses, en revanche, « c'est un réglage du jeu, on le règle une fois et on le retouche pas » ne tient pas : un projet du dossier porte neuf attitudes écrites à la main avec leurs consignes anglaises détaillées, un autre a des nombres d'images réglés pose par pose, et la correction d'une phrase anglaise se fait après avoir vu ce que le modèle a rendu — donc en travaillant. La conclusion pratique ne change pas pour autant : cette liste est déjà réglable dans Univers › Réglages, où elle a une étape à elle, et le Codex n'en tient qu'une moitié.

### Les surfaces examinées

#### La colonne « Ce que le monde contient » (colonne de gauche du Codex)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (fonction ColonneDesFamilles, lignes 306 à 406)`

**À quoi ça sert** — Choisir ce qu'on regarde dans le Codex : une catégorie de choses du jeu, ou l'un des trois réglages qui s'imposent à tout le monde.

**Ce que ça porte** — Un titre fixe « Ce que le monde contient » (30 px, ligne 341), puis sept rangées cliquables de 26 px chacune, chacune avec un compte à droite. Les cinq premières sont les familles (lignes 67 à 73 et 343 à 351) : Personnages, Décors, Objets, Interface, Équipement — dans cet ordre, et le compte d'Équipement ne compte pas des choses mais des pièces d'équipement (ligne 328). Puis un trait, l'intitulé « Ce que le jeu réclame de tous » et la rangée « Les directions » (lignes 353 à 376). Puis un second trait, l'intitulé « Ce que les personnages réclament » et la rangée « Leurs poses » (lignes 378 à 387). En pied, deux lignes de comptes du monde (lignes 393 à 403). Mesuré depuis les classes du fichier : les cinq familles font 5 × 26 = 130 px ; les deux blocs intrus font 2 traits de 25 px, 2 intitulés d'environ 18 px et 2 rangées de 26 px, soit environ 139 px. Chaque intitulé ne coiffe qu'une seule rangée.

**Comment on y arrive** — Elle est toujours là dès qu'on est sur l'onglet Codex, à moins d'avoir replié la colonne. Le Codex s'ouvre par défaut sur la famille Personnages (App.tsx, ligne 296).

**Comment on en sort** — On n'en sort pas : c'est la colonne fixe de l'onglet. On change seulement de rangée allumée. Elle disparaît quand on descend dans l'établi d'une chose, ou quand on ouvre la vitrine.

**Les défauts** :

- Trois des sept rangées n'ouvrent pas une liste de choses mais un formulaire de réglage — et l'une des trois, Équipement, est rangée au milieu des familles sans rien qui la distingue (routage : Codex.tsx lignes 245 à 265).
- Les deux blocs de réglage nommés par l'auteur prennent environ 139 px de hauteur contre 130 px pour les cinq familles : ils occupent un peu plus de la moitié de la colonne pour deux rangées sur sept.
- Deux intitulés en petites capitales pour deux rangées : autant de décor que de contenu.
- Sur le projet le plus fourni du dossier (Cœur de pierre 01), quatre des sept rangées affichent un zéro ou un réglage : Personnages 4, Décors 0, Objets 0, Interface 0, Équipement 2, Les directions « 4 · lues », Leurs poses 6.
- Une liste de directions que l'auteur a entièrement vidée à la main affiche « aucune », exactement comme un jeu qui n'a pas encore choisi sa vue — le mot « à vous » n'apparaît que si la liste n'est pas vide (lignes 366 à 373). C'est le cas du projet Test V2 aujourd'hui.

#### « Les directions » (le panneau qui s'ouvre au centre)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (fonction LesDirections, lignes 978 à 1105 ; une ligne de direction, lignes 1111 à 1184 ; la proposition d'argent, lignes 1193 à 1249)`

**À quoi ça sert** — Renommer, retirer ou ajouter les angles sous lesquels le jeu regarde une chose — sud, nord, est, ouest — et corriger la phrase anglaise que chacun envoie au modèle d'image.

**Ce que ça porte** — Un titre, une phrase qui dit d'où vient la liste (lue dans la vue du jeu, ou écrite à la main), puis une ligne par direction avec deux champs de texte et une croix pour retirer ; un champ pour en ajouter une et un bouton ; un lien « revenir à ce que la vue propose » quand la liste a été retouchée ; et, tout en bas, une proposition qui touche à l'argent — « ramener à une image ». Sur Cœur de pierre 01 (quatre directions, repos et marche demandant chacun quatre images), cette proposition est active aujourd'hui et annoncerait un passage de 48 cases à 24. Sur un écran large, le champ de la consigne anglaise s'étire sur toute la largeur de la colonne centrale, qui est la plus large de l'application.

**Comment on y arrive** — Onglet Codex, puis un clic sur la rangée « Les directions ». Deux clics depuis l'ouverture de l'application.

**Comment on en sort** — Aucun bouton de sortie, aucune croix, aucun « retour ». On sort en cliquant une autre rangée de la colonne de gauche, ou en changeant d'onglet.

**Les défauts** :

- La barre qui paie reste affichée sous ce formulaire : elle est posée en dehors du branchement qui choisit le panneau (Codex.tsx, ligne 285). On règle des noms de directions, et l'atelier propose toujours de dépenser.
- La colonne de droite continue d'afficher la chose choisie, avec son bouton « Fabriquer ce qui manque » — un formulaire de réglage du jeu entier voisine avec un bouton qui engage une dépense sur un personnage.
- Le fil d'Ariane écrit « Cœur de pierre › Les directions », c'est-à-dire exactement la forme qu'il donne à « Cœur de pierre › Personnages » : le produit présente lui-même un réglage comme une catégorie du monde (Codex.tsx lignes 85 à 89, affiché par App.tsx ligne 2104).
- Une décision d'argent — ramener des poses à une seule image — est cachée au pied d'un panneau de réglage de vocabulaire.

#### « Leurs poses » (le panneau qui s'ouvre au centre)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (fonction PlanDuJeu, lignes 463 à 533 ; une ligne d'attitude, lignes 543 à 640), monté dans le Codex par Codex.tsx lignes 245 à 248`

**À quoi ça sert** — Tenir la liste des attitudes que le jeu demande à chacun de ses personnages — repos, marche, course, attaque, dégâts, mort —, avec pour chacune le texte anglais qui part au modèle et le nombre d'images à fabriquer.

**Ce que ça porte** — Un titre « Les attitudes du jeu », un paragraphe d'explication, puis une ligne par attitude avec quatre commandes : le nom, la consigne anglaise, un compteur d'images, une croix. Six attitudes font donc vingt-quatre commandes, plus le champ et le bouton d'ajout.

**Comment on y arrive** — Onglet Codex, puis un clic sur la rangée « Leurs poses ».

**Comment on en sort** — Comme pour les directions : rien pour sortir, on clique ailleurs dans la colonne.

**Les défauts** :

- La barre qui paie reste affichée dessous, même raison que ci-dessus (Codex.tsx ligne 285).
- Ce panneau ne règle que le plan du jeu, celui que suivent les personnages et les créatures. Depuis que chaque type d'objet a sa propre liste d'états — un meuble est fermé, ouvert, vidé ; un bouton est au repos, survolé, pressé, inactif (atelier/domaine/plan.py, lignes 229 et suivantes) —, ces listes-là ne sont accessibles nulle part dans le Codex. L'intitulé « Ce que les personnages réclament » est donc exact, mais il révèle que le Codex ne sait régler que le tiers de la question.
- Le même travail se fait déjà ailleurs, en moins complet : l'étape « Poses et états » de Univers › Réglages ajoute et retire les mêmes attitudes (Assistant.tsx lignes 2301 et 2307), montre en plus les listes de chaque type et le total d'images à fabriquer — mais elle ne sait ni renommer, ni corriger l'anglais, ni changer le nombre d'images, qui n'existent que dans le Codex (Personnages.tsx lignes 561, 570, 586). Deux écrans font la même chose, chacun à moitié.

#### « Équipement » (la cinquième famille, qui n'en est pas une)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (fonction Vestiaire, lignes 655 à 780 ; une ligne de pièce, lignes 790 à 872), monté dans le Codex par Codex.tsx lignes 249 à 257`

**À quoi ça sert** — Décrire les pièces d'équipement du jeu — un casque, une hache — et les endroits du corps où elles s'accrochent.

**Ce que ça porte** — Un titre « Ce qu'on porte », un paragraphe d'explication, puis les pièces groupées par emplacement. Chaque pièce porte un champ de nom, une liste déroulante de portée, une croix, et surtout une zone de texte de deux lignes pour sa description — plus une phrase qui dit sur combien de personnages elle est posée. Aucune image nulle part : c'est délibéré côté serveur, une pièce d'équipement n'a pas d'image à elle, elle n'existe qu'apparue sur un corps (atelier/services/production.py, lignes 994 à 1006).

**Comment on y arrive** — Onglet Codex, puis un clic sur la rangée « Équipement », qui a exactement l'apparence des quatre familles au-dessus d'elle.

**Comment on en sort** — Rien pour sortir, on clique ailleurs.

**Les défauts** :

- C'est la surface qui produit le grief exact de l'auteur — « pas de liste des équipements, mais des paragraphes de texte qui s'enchaînent » —, et elle est le troisième formulaire de réglage de la colonne, celui qu'il n'a pas identifié comme tel parce qu'il est rangé au milieu des familles.
- Le compte affiché à droite de la rangée n'est pas le même genre de nombre que celui des quatre autres familles : c'est un nombre de pièces d'équipement, pas un nombre de choses du monde (Codex.tsx ligne 328).
- Le retrait d'un emplacement de corps existe ici et existe aussi dans l'étape « Emplacements » de Univers › Réglages (Assistant.tsx ligne 2678) — mais le classement des emplacements, qui décide de ce qui se dessine par-dessus quoi, n'existe que là-bas, et les pièces elles-mêmes n'existent qu'ici.

#### « La chose choisie » (colonne de droite du Codex)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (fonction FicheDeLaChose, lignes 766 à 942)`

**À quoi ça sert** — Dire ce que la chose désignée réclame, ce qui lui manque, ce que ça coûtera, et armer la fabrication.

**Ce que ça porte** — Quatre sections : « Ce qu'elle réclame », « Son ambiance », « Ce qui manque », puis le pied qui annonce le prix avec deux boutons.

**Comment on y arrive** — Un clic sur la carte d'une chose dans la colonne du milieu.

**Comment on en sort** — Une croix en haut à droite (ligne 820), qui ne ferme pas la colonne mais la vide.

**Les défauts** :

- La plainte de l'auteur sur le vert est exacte et je la localise. La ligne des pièces d'équipement est écrite en dur comme complète : elle affiche « 2 sur 2 » et la marque verte quoi qu'il arrive (lignes 853 à 859). La ligne des poses compare le nombre de poses tenues au nombre de poses réclamées, or « tenues » veut dire « non écartées par cette chose » : aucune des douze choses des six projets du dossier de données n'écarte quoi que ce soit, donc les deux nombres sont toujours égaux et la ligne est toujours verte (lignes 839 à 849). Le compte honnête existe, mais il est plus bas, dans la section « Ce qui manque » (lignes 887 à 902).

#### Univers › Réglages — l'écran des douze étapes (le logement qui existe déjà)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Assistant.tsx (la liste des étapes, lignes 132 à 163), ouvert par Univers.tsx lignes 339 à 350`

**À quoi ça sert** — Régler le jeu une fois : son nom, son style, sa vue, sa taille, ses types d'objets, son allure, ses références, ses poses, ses emplacements d'équipement, ses modèles d'image, son détourage, ses fournisseurs.

**Ce que ça porte** — Une colonne de gauche de 240 pixels — la même largeur que celle du Codex — qui liste douze étapes rangées en quatre groupes nommés (le jeu, le style, la production, l'atelier), et à droite une étape à la fois, avec un titre, une explication et un pied qui porte « Retour » et « Continuer ». Trois de ces étapes sont exactement les voisines de ce qu'on cherche à loger : la troisième, « La vue », est celle qui produit les directions ; la huitième, « Poses et états », règle déjà le même plan de poses ; la neuvième, « Emplacements », règle déjà les emplacements du corps.

**Comment on y arrive** — Onglet Univers, puis le mot « Réglages » dans la barre des trois côtés (Inspiration, Réglages, Ambiances — Univers.tsx lignes 375 à 383).

**Comment on en sort** — Le pied de chaque étape porte un retour, et un bouton de sortie ramène dans le Codex avec le champ qui nomme allumé (App.tsx lignes 2798 à 2802).

**Les défauts** :

- L'étape « La vue » montre le nombre d'images par pose de chaque vue, mais ne montre aucune direction — alors que c'est ce choix-là qui les fabrique (Assistant.tsx lignes 856 à 926, comparé à atelier/domaine/vue.py lignes 244 et suivantes). C'est le trou qui a poussé les directions dans le Codex.
- L'étape « Poses et états » ne sait qu'ajouter et retirer (Assistant.tsx lignes 2454 à 2533). Renommer, corriger l'anglais et changer le nombre d'images lui manquent — et ce sont précisément les trois choses que le Codex sait faire.

### Les constats

**FORT — Les directions ne sont pas une liste que l'auteur compose : dans quatre projets sur six, elle n'a jamais été écrite à la main ; dans les deux autres, l'auteur ne l'a pas composée, il l'a réduite.**

- *Le chiffre* : 4 projets sur 6 jamais touchés ; 2 sur 6 touchés, et les deux fois pour retirer
- *La preuve* : Les six fichiers C:/STOCKAGE/PROJET/_DEV/gag2/donnees/projets/*/projet.json, clé univers.directions. Elle vaut « rien d'écrit » — donc lue dans la vue du jeu — pour bac-a-sable, coeur-de-pierre, coeur-de-pierre-01 et vignettes. Elle vaut une liste vide pour test-v2 (l'auteur les a toutes retirées). Elle vaut une seule entrée, « droite », pour essai-animation, dont la vue « De côté — plateforme » en propose deux.

**FORT — Le produit range déjà lui-même les directions dans l'univers du jeu, pas dans le codex : elles sont écrites à l'intérieur du bloc « univers » du fichier de projet, et par défaut elles se déduisent du choix de vue.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/atelier/domaine/projet.py, lignes 1024 à 1028 pour l'écriture et 1100 pour la relecture, toutes deux dans l'objet Univers ; la déduction depuis la vue est lignes 807 à 823, et les listes proposées par chaque vue sont dans atelier/domaine/vue.py, lignes 134 à 244.

**FORT — Les deux rangées que l'auteur dénonce, avec leurs traits et leurs intitulés, prennent plus de hauteur que les cinq familles réunies.**

- *Le chiffre* : environ 139 px contre 130 px, soit 52 % de la hauteur de la colonne pour 2 rangées sur 7
- *La preuve* : Codex.tsx : les cinq familles sont cinq rangées de 26 pixels (lignes 343 à 351 et 427). Les deux blocs intrus sont deux traits à marge de 12 pixels de part et d'autre, deux intitulés de 9,5 points et deux rangées de 26 pixels (lignes 353 à 387).

**FORT — Trois des sept rangées de la colonne ouvrent un formulaire de réglage et non une liste de choses — et la troisième, « Équipement », est rangée parmi les familles sans aucune marque qui la distingue.**

- *Le chiffre* : 4 rangées sur 7 ouvrent une liste de choses, 3 sur 7 ouvrent un formulaire
- *La preuve* : Codex.tsx lignes 245 à 265 : la rubrique « poses » ouvre le plan des attitudes, « equipement » ouvre le vestiaire, « directions » ouvre la liste des angles ; seul le cas restant ouvre la liste des choses. Et Codex.tsx lignes 67 à 73 place « equipement » dans la même table que Personnages, Décors, Objets et Interface.

**MOYEN — Le Codex est le seul endroit de toute l'interface où une direction peut s'écrire : on ne peut donc pas simplement supprimer le panneau.**

- *La preuve* : Les quatre écritures possibles sont toutes dans Codex.tsx — ajouter ligne 1008, revenir à la vue ligne 1086, renommer ou corriger la consigne ligne 1128, retirer ligne 1171. Aucune autre surface de interface/src ne les appelle.

**FORT — La liste des poses, elle, est déjà réglable à deux endroits, et le partage entre les deux est arbitraire : ni l'un ni l'autre n'est complet.**

- *La preuve* : Ajouter et retirer existent des deux côtés — Assistant.tsx lignes 2301 et 2307, Personnages.tsx lignes 478 et 630. Renommer, corriger l'anglais et changer le nombre d'images n'existent que dans le Codex (Personnages.tsx lignes 561, 570, 586). Les listes d'états propres à chaque type d'objet, et le total d'images à fabriquer, n'existent que dans l'assistant (Assistant.tsx lignes 2196 à 2330).

**FORT — Contrairement aux directions, la liste des poses est vraiment retouchée en travaillant : ce n'est pas un réglage qu'on pose une fois.**

- *Le chiffre* : 9 attitudes écrites à la main dans un projet ; 2 nombres d'images sur 6 modifiés dans un autre
- *La preuve* : donnees/projets/essai-animation/projet.json porte neuf attitudes écrites à la main, avec leur consigne anglaise détaillée (un cycle de marche découpé en huit images). donnees/projets/coeur-de-pierre-01/projet.json porte des nombres d'images réglés pose par pose : repos 4, marche 4, et 1 pour les quatre autres, alors que la liste de départ du produit en propose 6 identiques (atelier/domaine/plan.py, lignes 168 à 178).

**MOYEN — Une décision qui touche à l'argent est cachée au pied du panneau des directions.**

- *Le chiffre* : la proposition annoncerait un passage de 48 cases à 24
- *La preuve* : Codex.tsx lignes 1098 à 1102 et 1193 à 1249 ; le calcul est dans atelier/services/production.py lignes 475 à 522. La condition — une pose qui demande exactement autant d'images qu'il y a de directions — est remplie aujourd'hui sur Cœur de pierre 01, où repos et marche demandent chacun 4 images pour 4 directions.

**MOYEN — La barre qui paie reste affichée sous les trois formulaires de réglage : on règle des noms, et l'atelier propose toujours de dépenser.**

- *La preuve* : Codex.tsx ligne 285 : la barre est posée après le branchement des lignes 245 à 284, donc en dehors de lui. La colonne de droite reste elle aussi affichée, avec son bouton « Fabriquer ce qui manque » (lignes 288 à 298).

**MOYEN — Le fil d'Ariane annonce lui-même un réglage comme une catégorie du monde.**

- *La preuve* : Codex.tsx lignes 85 à 89 ajoutent « Les directions » et « Leurs poses » à la même table de noms que les cinq familles ; App.tsx ligne 2104 l'affiche tel quel, donnant « Cœur de pierre › Les directions », de la même forme que « Cœur de pierre › Personnages ».

**FORT — La plainte de l'auteur sur la colonne de droite toujours verte est exacte, et elle a deux causes distinctes.**

- *Le chiffre* : 12 choses sur 12 dans 6 projets : la ligne est verte dans tous les cas
- *La preuve* : Codex.tsx lignes 853 à 859 : la ligne des pièces d'équipement affiche « 2 sur 2 » avec la marque verte écrite en dur, sans jamais regarder ce qui est fait. Codex.tsx lignes 839 à 849 : la ligne des poses compare les poses non écartées au nombre de poses réclamées — or aucune des douze choses des six projets n'écarte de pose (champ ecartees vide partout), donc les deux nombres sont toujours égaux.

**MOYEN — La moitié de ce que règle la colonne de gauche du Codex a déjà une étape dédiée dans Univers › Réglages.**

- *La preuve* : Assistant.tsx lignes 132 à 163 : douze étapes en quatre groupes, dont « La vue » (3e), « Poses et états » (8e) et « Emplacements » (9e). Cet écran est ouvert par le mot « Réglages » de l'onglet Univers (Univers.tsx lignes 339 à 350 et 375 à 383), et sa colonne de gauche fait déjà 240 pixels, la même que celle du Codex.

**FAIBLE — Sur le projet le plus fourni du dossier de données, quatre des sept rangées de la colonne affichent un zéro ou un réglage.**

- *Le chiffre* : Personnages 4 · Décors 0 · Objets 0 · Interface 0 · Équipement 2 · Directions « 4 · lues » · Poses 6
- *La preuve* : donnees/projets/coeur-de-pierre-01 : quatre personnages, aucun décor, aucun objet, aucun élément d'interface, deux pièces d'équipement, la vue « De dessus, 3/4 » qui donne quatre directions lues, et six attitudes au plan.

### Ce que cette lecture impose

- La colonne de gauche du Codex ne doit porter que ce que le monde contient : des catégories de choses qui, cliquées, montrent des choses. Aujourd'hui trois rangées sur sept manquent à cette promesse — les deux que l'auteur nomme, plus Équipement qu'il n'a pas vu comme telle.
- Les directions doivent rejoindre l'étape « La vue » de Univers › Réglages : c'est ce choix-là qui les fabrique, l'étape existe déjà, et elle est aujourd'hui muette sur ce qu'elle produit. Aucun septième endroit n'est créé, et la carte perd une rangée.
- Le plan des poses doit rejoindre l'étape « Poses et états », qui existe déjà et qui règle déjà la même liste. Mais elle doit gagner les trois gestes qui n'existent que dans le Codex : renommer une attitude, corriger sa phrase anglaise, changer son nombre d'images. Sans quoi le déplacement supprimerait des gestes utilisés.
- Le déplacement ne fait pas disparaître un besoin réel : la consigne anglaise d'une attitude se corrige après avoir vu ce que le modèle a rendu, donc en travaillant. Il faut soit un chemin court depuis l'établi d'une chose vers l'étape « Poses et états », soit la correction de la consigne au plus près de l'image ratée.
- Équipement demande une réponse à part, et pas seulement un déplacement : une pièce d'équipement n'a par construction aucune image à elle — le serveur refuse de la fabriquer sur fond vide. La famille ne peut donc pas ressembler aux quatre autres tant que la question « à quoi ressemble ce casque » n'a pas de réponse ailleurs que sur un corps.
- La barre qui paie et la colonne de droite doivent se retirer quand un formulaire de réglage occupe le centre, comme elles se retirent déjà quand un outil s'ouvre.
- Le fil d'Ariane doit cesser d'écrire « projet › Les directions » sur le même modèle que « projet › Personnages » : tant qu'un réglage porte la forme d'une famille, il en aura l'air.
- La colonne de droite doit cesser d'afficher du vert pour des choses non faites : la ligne des pièces d'équipement est écrite en dur comme complète, et la ligne des poses compare deux nombres toujours égaux.

---

<a id="lecture-4"></a>

## 4 · Codex — la liste des personnages montre des images, celle de l'Équipement est un formulaire déguisé en liste

L'auteur a raison sur l'effet et se trompe sur la cause. Quatre familles du Codex sur cinq passent par la même liste à cartes, avec une vignette de 44 pixels par entrée ; la cinquième, Équipement, ne passe pas par elle du tout — un aiguillage à la ligne 249 de Codex.tsx la renvoie vers un composant écrit pour une autre colonne, dont le commentaire d'origine dit noir sur blanc « Ni vignette, ni recherche » parce qu'il était conçu pour une bande latérale de 240 pixels. Il est aujourd'hui affiché dans la colonne centrale, quatre fois plus large. Ce n'est donc ni des paragraphes de prose ni un défaut de données : c'est un panneau de réglages — 15 contrôles pour 2 pièces sur le projet test-v2, dont une zone de texte pleine largeur par pièce — posé à l'endroit où l'on attend un inventaire. Les images existent : 10 images de la base portent une pièce, et les 4 pièces déclarées dans les projets en ont chacune au moins une ; mieux, l'écran les a déjà en mémoire quand il dessine ce panneau, sans un seul appel réseau de plus. Enfin, la plainte est en dessous de la réalité sur un point : en cliquant Équipement, la colonne de droite garde la fiche du personnage précédemment choisi, et cette fiche affiche deux lignes vertes fausses.

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact sur ce qu'on voit, imprécis sur le mot, et en dessous de la réalité sur la colonne de droite. « Des paragraphes de texte qui s'enchaînent » : il n'y a pas de prose, mais l'impression est justifiée — zéro image, une vingtaine de blocs de texte, et une zone de saisie pleine largeur (environ 950 pixels sur un écran de 1600) par pièce. « Pas de liste des équipements » : littéralement vrai, l'écran de l'Équipement n'est pas la liste du Codex, c'est un autre composant. « Je m'attendais à un vestiaire d'images comme pour les personnages » : légitime, et réalisable aujourd'hui — les images de pièces existent, l'écran les tient déjà. Ce qu'il n'a pas dit et qui est pire : en cliquant Équipement, la colonne de droite continue de montrer la fiche du personnage d'avant, et cette fiche écrit « pièces d'équipement — 2 sur 2 » en vert pour une créature qui n'a aucune image, tout en disant « 6 cases à fabriquer » quarante pixels plus bas.

### Les surfaces examinées

#### Codex — Personnages (et, à l'identique, Décors, Objets, Interface)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx`

**À quoi ça sert** — Montrer les choses du jeu d'une famille, une par ligne, avec une image et ce qui leur manque encore.

**Ce que ça porte** — Un bouton « voir tout le monde en grand › » en haut (lignes 542-551), puis une carte par chose (composant CarteDeLaChose, lignes 662-756), puis un champ pour en créer une (lignes 589-654). Chaque carte tient une bande d'environ 60 pixels de haut : une vignette de 44x44 à gauche, le nom et la description au centre, l'étiquette d'ambiance à droite si elle en a une, et le compte de ce qui manque tout à droite. Sur le projet test-v2 la famille Personnages en affiche 3 : 3 vignettes, environ 10 blocs de texte, 8 endroits cliquables au total.

**Comment on y arrive** — Onglet Codex, puis clic sur « Personnages » dans la colonne de gauche (Codex.tsx:343-351). C'est la rubrique ouverte par défaut au démarrage (App.tsx:296).

**Comment on en sort** — Clic sur le nom d'une carte : on descend dans l'établi de cette chose (Codex.tsx:712-721). Clic ailleurs sur la carte : on la désigne seulement, la colonne de droite en parle. Clic sur une autre famille à gauche.

**Les défauts** :

- La vignette est la première image du premier bloc rempli (ligne 683), pas celle que l'atelier retiendrait à l'export : la case du serveur désigne pourtant un corps retenu (champ corps, api.ts:1040) que la carte ignore.
- Une chose sans aucune image affiche un carré gris vide de 44x44 (lignes 705-708) — c'est voulu, mais avec quatre choses vides sur cinq la liste ressemble à un tableau de cases grises.
- La description est tronquée sur une seule ligne (ligne 722, truncate) : les descriptions des personnages du dépôt font 76 et 123 caractères, on n'en voit qu'un début.

#### Codex — Équipement

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (composant Vestiaire, lignes 655-780 ; monté par Codex.tsx:249-257)`

**À quoi ça sert** — Déclarer une fois pour tout le jeu ce qu'on peut porter — un casque, une épée — et où ça se pose sur le corps.

**Ce que ça porte** — Aucune image, nulle part. Un titre « Ce qu'on porte » et un paragraphe d'explication de 159 caractères (lignes 700-706). Puis un intitulé par emplacement du corps, chacun avec sa croix de suppression (lignes 714-735). Puis, par pièce (composant LignePiece, lignes 788-872) : un champ de saisie pour le nom, un menu déroulant à deux choix pour la portée, une croix, et une zone de texte de deux lignes pleine largeur pour la description — soit 4 contrôles. Sous chaque pièce, une phrase « Posée sur 1 personnage sur 3. » puis une ligne par personnage équipable du jeu (lignes 900-932). En bas, deux champs et un bouton Ajouter (lignes 748-777). Bilan sur le projet test-v2, qui a 2 pièces, 4 emplacements et 3 personnages équipables : 0 image, 15 contrôles, une vingtaine de blocs de texte.

**Comment on y arrive** — Onglet Codex, cinquième entrée de la colonne de gauche, annoncée « Équipement · 2 » (Codex.tsx:67-73 et 328). Le chiffre laisse attendre une liste de deux choses.

**Comment on en sort** — Uniquement en cliquant une autre rubrique à gauche. Aucune pièce ne s'ouvre : il n'y a rien à ouvrir, une pièce n'a pas d'établi à elle.

**Les défauts** :

- Ce n'est pas la liste du Codex. Codex.tsx:249-257 détourne cette rubrique vers un composant écrit pour une autre colonne ; les quatre autres familles vont, elles, vers ListeDesChoses (Codex.tsx:270-283).
- Le composant dit lui-même pourquoi il n'a pas de vignette : son commentaire d'origine, Personnages.tsx:648-650, annonce « Ni vignette, ni recherche » — il était rangé dans la colonne étroite de 240 pixels de l'ancien écran Personnages. Il occupe aujourd'hui la colonne centrale, qui vaut environ 950 pixels sur un écran de 1600 (Codex.tsx:201-205).
- La zone de texte de la description est en pleine largeur (ligne 867, w-full) : c'est elle qui fabrique l'impression de paragraphes.
- Un projet qui a des emplacements mais aucune pièce affiche des intitulés vides et rien dessous : le filtre de la ligne 697 garde tous les emplacements nommés, et le message « Aucune pièce — et aucun emplacement » (lignes 708-711) ne s'affiche alors jamais. Le projet essai-animation du dépôt est exactement dans ce cas : 6 emplacements, 0 pièce, donc 6 intitulés vides sans un mot d'explication.
- Un appel réseau par pièce à l'ouverture (lignes 887-896), pour ne récupérer que des noms de personnages.
- Créer une pièce ne se fait pas comme créer une chose : deux champs et un bouton ici (lignes 748-777), un seul champ et « Entrée le crée » dans les quatre autres familles (Codex.tsx:640-651).
- Il n'y a ni bouton « voir tout en grand », ni recherche, ni tri — alors que les quatre autres familles ont le premier (Codex.tsx:542-551).

#### Codex — la colonne de droite, « La chose choisie »

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (composant FicheDeLaChose, lignes 766-942)`

**À quoi ça sert** — Résumer ce que la chose désignée réclame, ce qui lui manque, et armer sa fabrication.

**Ce que ça porte** — Quatre sections empilées sur 380 pixels de large : « Ce qu'elle réclame » (2 lignes), « Son ambiance » (1 phrase), « Ce qui manque » (une ligne par attitude), puis un pied avec le compte de cases et deux boutons.

**Comment on y arrive** — En cliquant une carte dans la liste du milieu. Elle est montée en permanence, quelle que soit la rubrique (Codex.tsx:288-298).

**Comment on en sort** — La croix en haut à droite (lignes 820-827), ou en repliant la colonne.

**Les défauts** :

- Elle ne suit pas la rubrique. Changer de rubrique ne réinitialise pas la chose désignée (App.tsx:2854-2855, setRubrique seul), et le panneau reste monté quoi qu'il arrive : on clique Équipement et la fiche du pèlerin reste affichée à droite, sans rapport avec ce qu'on regarde.
- La ligne « pièces d'équipement » est écrite en dur comme complète : lignes 853-859, la valeur affichée est « 2 sur 2 » et la marque « complet » est posée sans condition. Elle est verte même quand aucune image de pièce n'existe.
- La ligne des poses compte les attitudes cochées, pas les images faites : lignes 839-849, la marque verte tombe dès que la chose tient toutes les attitudes de son type. Sur test-v2, « La grenouille des tourbières » n'a aucune image et affiche pourtant « poses du type personnage — 6 sur 6 » en vert.
- Le panneau se contredit à quarante pixels d'écart : deux lignes vertes en haut, « 6 cases à fabriquer » en bas (lignes 917-921).
- Aucune pièce n'a de fiche : la colonne ne sait parler que d'une chose du jeu, jamais d'un équipement.

#### Codex — la colonne de gauche, « Ce que le monde contient »

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (composant ColonneDesFamilles, lignes 306-406)`

**À quoi ça sert** — Choisir ce qu'on regarde : une des cinq familles, ou une des deux listes de réglage du jeu.

**Ce que ça porte** — Cinq rangées de 26 pixels pour les familles avec leur compte, un trait, « Les directions », un trait, « Leurs poses », et en pied un décompte du monde sur deux lignes.

**Comment on y arrive** — Elle est toujours là dans l'onglet Codex, sauf repliée (largeur 240 ou 0, ligne 202).

**Comment on en sort** — Elle ne se quitte pas ; on la replie.

**Les défauts** :

- Les cinq rangées de familles se ressemblent, mais la cinquième ne mène pas au même genre d'écran que les quatre autres.
- Le compte affiché pour Équipement est un nombre de pièces (ligne 328), les quatre autres sont des nombres de choses du jeu : le même chiffre à la même place recouvre deux modèles différents.
- Le décompte du pied ne mentionne jamais les pièces : lignes 393-403, il énumère personnages, décors, objets et éléments d'interface, et s'arrête là.
- Deux réglages du jeu occupent un tiers de la colonne (lignes 353-387) — c'est le grief séparé de l'auteur sur les directions et les poses.

### Les constats

**BLOQUANT — L'Équipement n'emprunte pas le même écran que les autres familles : c'est un aiguillage explicite qui l'envoie ailleurs.**

- *Le chiffre* : 4 familles sur 5 passent par la liste à cartes ; 1 n'y passe pas
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:249-257 — quand la rubrique vaut « equipement », le milieu de l'écran rend le composant Vestiaire ; lignes 270-283, les quatre autres familles rendent ListeDesChoses, qui seule fabrique des cartes à vignette (lignes 553-564 puis 662-756).

**BLOQUANT — Le composant de l'Équipement dit lui-même, dans son commentaire d'origine, qu'il a été écrit sans vignette pour une colonne étroite. Il est aujourd'hui affiché dans la colonne large sans avoir été réécrit.**

- *Le chiffre* : 240 pixels prévus, environ 950 obtenus sur un écran de 1600
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:645-654 : « rangées dans la même colonne pour cette raison-là. Ni vignette, ni recherche ». La colonne où il vit maintenant est celle du milieu, définie à Codex.tsx:201-205 comme 240 pixels / le reste / 380 pixels.

**FORT — Ce n'est pas un défaut de données : les images de pièces existent bel et bien, et les quatre pièces déclarées dans le dépôt en ont toutes au moins une.**

- *Le chiffre* : 10 images pour 4 pièces, soit 4 pièces sur 4 illustrables
- *La preuve* : Base C:/STOCKAGE/PROJET/_DEV/gag2/donnees/atelier.sqlite3, table assets : 10 images portent une pièce — helmet 4, battle-axe 2, sac-de-voyage 3, epee 1. Les pièces sont déclarées dans donnees/projets/coeur-de-pierre-01/projet.json et donnees/projets/test-v2/projet.json.

**FORT — Le serveur tient l'identifiant d'image en main au moment de répondre à l'écran de l'Équipement, et ne renvoie que le nom de la pose.**

- *Le chiffre* : 1 identifiant d'image jeté par image parcourue
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/atelier/services/production.py:1016-1020 : la boucle parcourt les images qui portent la pièce et n'en garde que asset.pose. Le type de la réponse côté écran, C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/api.ts:1306-1311, ne contient aucune image.

**FORT — L'écran a déjà les images de pièces en mémoire quand il dessine le panneau Équipement : aucun appel réseau nouveau ne serait nécessaire pour un vestiaire en images.**

- *Le chiffre* : 1 propriété manquante pour relier les deux ; 0 appel réseau supplémentaire
- *La preuve* : Chaque case d'une chose du jeu porte ses images rangées par pièce — champ calques, C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/api.ts:1029, calculé par C:/STOCKAGE/PROJET/_DEV/gag2/atelier/services/production.py:1763-1779 et livré avec la production (App.tsx:865-874). EcranCodex tient la liste complète des personnages (Codex.tsx:235) et ne la passe pas au Vestiaire (Codex.tsx:251-256).

**FORT — La règle « une pièce n'a pas d'image à elle » est délibérée et écrite dans le modèle, mais elle porte sur la fabrication, pas sur l'affichage : elle interdit de générer un casque sur fond vide, elle n'interdit pas de montrer le casque tel qu'il est apparu sur un corps.**

- *Le chiffre* : 1 règle de fabrication appliquée par erreur à l'affichage
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/atelier/domaine/equipement.py:116-120. Or le même dépôt affiche ces images ailleurs, dans l'établi d'un personnage : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:2500-2511.

**MOYEN — Le seul champ du modèle qui pourrait porter une image de pièce existe, et aucun écran ne l'écrit ni ne le lit.**

- *Le chiffre* : 0 écran sur 35 lit concept_arts d'une pièce ; 4 pièces sur 4 l'ont vide
- *La preuve* : Champ concept_arts déclaré sur la pièce : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/api.ts:948 et C:/STOCKAGE/PROJET/_DEV/gag2/atelier/domaine/equipement.py:140. Recherche sur tout interface/src : la seule lecture de concept_arts concerne les personnages (Tableau.tsx:900 et 1449-1462), jamais les pièces. Dans les données, ce champ vaut la liste vide pour les 4 pièces des projets.

**FORT — Compté par entrée : la liste des personnages montre 1 vignette, 3 à 4 textes et 2 zones cliquables, sans aucun champ à remplir. La liste de l'Équipement montre 0 vignette, 6 blocs de texte et 4 contrôles à remplir.**

- *Le chiffre* : 1 image contre 0 ; 0 champ à remplir contre 4
- *La preuve* : Personnage — vignette Codex.tsx:694-709, nom Codex.tsx:720, description Codex.tsx:723, ambiance Codex.tsx:741 (seulement si elle en a une), compte de manque Codex.tsx:745-753, deux zones cliquables lignes 688 et 712. Pièce — champ du nom Personnages.tsx:819, menu de portée Personnages.tsx:832, croix Personnages.tsx:842, zone de texte Personnages.tsx:857, phrase de portée Personnages.tsx:905, une ligne par personnage équipable Personnages.tsx:911-931.

**FORT — Sur le projet test-v2 du dépôt, l'écran Équipement complet affiche 15 contrôles et aucune image, pour 2 pièces.**

- *Le chiffre* : 15 contrôles, 0 image, environ 20 blocs de texte
- *La preuve* : Données : donnees/projets/test-v2/projet.json déclare 2 pièces et 4 emplacements ; 3 des 6 choses du jeu sont équipables (types « personnage », « personnage » et vide, qui retombe sur la famille personnages — atelier/services/production.py:982-992 et atelier/domaine/projet.py:770-786). Décompte : 4 croix d'emplacement (Personnages.tsx:720-733), 2 pièces × 4 contrôles (Personnages.tsx:816-868), 3 contrôles du formulaire du bas (Personnages.tsx:748-777).

**BLOQUANT — La colonne de droite affiche deux lignes vertes fausses. L'une est écrite en dur comme complète ; l'autre compte des attitudes cochées, pas des images faites.**

- *Le chiffre* : 2 lignes vertes pour 0 image faite, contredites 40 pixels plus bas
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:853-859 : la valeur est le nombre total de pièces des deux côtés du mot « sur », et la marque complet est posée sans condition. Lignes 839-849 : la valeur compare le nombre d'attitudes tenues au nombre d'attitudes réclamées. Sur test-v2, « La grenouille des tourbières » a 0 image (vérifié en base) et 6 attitudes tenues sur 6 : elle affiche donc « poses du type personnage — 6 sur 6 » et « pièces d'équipement — 2 sur 2 », les deux en vert, tandis que le pied du même panneau annonce « 6 cases à fabriquer » (lignes 917-921).

**FORT — Cliquer sur Équipement ne débranche pas la colonne de droite : elle continue de décrire la chose du jeu choisie avant, qui n'a plus rien à voir avec ce qu'on regarde.**

- *Le chiffre* : 380 pixels de large, sans rapport avec le milieu de l'écran
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx:2854-2855 change la rubrique sans toucher à la chose choisie ; C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:288-298 monte la fiche quelle que soit la rubrique.

**MOYEN — Un projet qui a rangé des emplacements sans encore nommer de pièce voit des intitulés vides et aucune explication.**

- *Le chiffre* : 6 intitulés vides, 0 pièce, 0 phrase d'explication
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:697 garde tous les groupes dont l'identifiant n'est pas vide, même sans pièce ; du coup la condition de la ligne 708 n'est jamais vraie et le message « Aucune pièce — et aucun emplacement » ne s'affiche pas. Le projet donnees/projets/essai-animation/projet.json est dans ce cas.

**FAIBLE — Ouvrir l'Équipement déclenche un appel réseau par pièce, pour n'obtenir que des noms de personnages.**

- *Le chiffre* : 1 appel par pièce, 2 aujourd'hui, autant que de pièces demain
- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx:884-896 ; la route est C:/STOCKAGE/PROJET/_DEV/gag2/atelier/api/production.py:940-952.

**MOYEN — Le panneau de fabrication du bas reste affiché sous l'Équipement, alors que rien ne s'y fabrique.**

- *La preuve* : C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx:285 — la barre est rendue hors de l'aiguillage des rubriques, donc sous les cinq familles comme sous les directions et les poses.

### Ce que cette lecture impose

- Le vestiaire en images est faisable dès aujourd'hui, sans toucher au serveur ni aux données : les images de pièces sont déjà dans la mémoire de l'écran, rangées par pièce dans chaque case de chaque chose du jeu. Il manque de passer la liste des choses au panneau de l'Équipement et de prendre la première image de la pièce comme vignette — le même geste, à la ligne près, que la carte d'un personnage.
- La carte cible doit traiter l'Équipement comme une famille de plein droit ou l'en sortir franchement, mais pas les deux : la colonne de gauche l'annonce comme une cinquième famille avec un compte, et l'écran qui suit est un formulaire de réglage. C'est cet écart-là que l'auteur ressent comme un manque de logique.
- Une pièce n'a pas d'établi à elle. Si le vestiaire devient une liste d'images, il faut décider ce que l'on ouvre en cliquant une pièce — vraisemblablement la même chose que ce que la fiche montre aujourd'hui en texte : où elle est posée, sur qui, et ce qui manque, mais montré en images.
- Les réglages d'une pièce — le nom, l'emplacement sur le corps, la portée, la description qui part au modèle — doivent quitter la liste. Ce sont quatre décisions qu'on prend une fois par pièce ; les laisser dans la liste, c'est ce qui fait les quatre contrôles par entrée.
- Les deux lignes vertes fausses de la colonne de droite sont à reprendre avant tout redécoupage : elles se corrigent en comparant des images faites à des images demandées, comme le fait déjà la section « Ce qui manque » du même panneau, quarante pixels plus bas.
- La colonne de droite doit se vider ou changer de sujet quand on change de rubrique, sinon elle décrira toujours autre chose que ce qu'on regarde.
- Le vestiaire écrit pour une bande de 240 pixels ne doit pas être re-posé tel quel dans une colonne large : c'est la cause première de l'effet « du texte, du texte, encore du texte ».

---

<a id="lecture-5"></a>

## 5 · Le panneau qui paie au pied du Codex : ce qu'il fait vraiment

L'auteur a raison, et il est en dessous de la réalité. La barre de génération est montée sans condition sur les sept rubriques du Codex — y compris « Les directions » et « Leurs poses », qui sont des réglages du jeu où il n'y a rien à fabriquer — et sur l'établi d'une chose. Mesurée au navigateur sur un atelier jetable en 1920x1080 : 205 px repliée à vide, 268 px dès qu'une case est visée, soit 26,5 % de la surface utile — le quart qu'il décrit. Mais dès qu'on ouvre les réglages une seule fois, elle passe à 525 puis 657 px, soit 52 à 65 % de l'écran, et elle y reste toute la séance. Avec son vrai catalogue de 49 modèles, la liste dépliée pousse la barre à environ 637 px, c'est-à-dire 63 % de la hauteur utile : il reste 373 px pour la liste des choses du jeu, où une fiche de personnage en fait 62. Sur les 25 contrôles qu'elle porte, un seul est vraiment un choix par appel — le « Sujet » — et il est caché derrière un repli qui se referme à chaque rechargement de la page. Enfin l'invariant « l'argent ne part que d'un endroit par écran » n'est pas tenu : la Galerie affiche en toutes lettres « aucun appel ne part d'ici » alors qu'elle porte deux boutons Relancer qui rappellent le fournisseur et refacturent.

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact, et en dessous de la réalité sur deux points. Exact : la barre est bien montée sur tous les écrans du Codex sans exception, y compris ceux qui ne fabriquent rien ; elle occupe bien un quart de la hauteur dans son état de repos (268 px sur 1010, soit 26,5 %) ; elle porte bien des réglages dont on n'a pas besoin là. En dessous de la réalité : premièrement, le quart n'est que l'état replié — au premier clic sur « réglages de l'appel » elle passe à la moitié puis aux deux tiers de l'écran, et rien ne la referme ensuite. Deuxièmement, le seul réglage du panneau qui change vraiment ce qui part — le « Sujet », qui décide des images de référence envoyées et du modèle par défaut — est justement celui qui est caché, jamais prérempli, et remis à zéro à chaque rechargement : le produit annonce alors « aucun sujet — seules les planches tous partiront ». La plainte « on ne comprend pas ce panneau » est donc doublée d'un défaut qu'il n'a pas vu : le panneau est mal réglé par défaut, pas seulement encombrant.

### Les surfaces examinées

#### Codex — les cinq familles (Personnages, Décors, Objets, Interface, Équipement)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx`

**À quoi ça sert** — Voir ce que le monde contient, famille par famille, et ouvrir une chose pour la fabriquer.

**Ce que ça porte** — Trois colonnes : 240 px de familles à gauche, la liste au centre, 380 px de fiche à droite (Codex.tsx:200-204). La barre qui paie est collée au bas de la colonne du centre, sans aucune condition (Codex.tsx:285). Mesuré à 1920x1080 : la colonne utile fait 1010 px de haut ; la barre en prend 205 px repliée à vide (20,3 %), 525 px réglages ouverts avec une case visée (52 %). Une fiche de chose dans la liste fait 62 px de haut.

**Comment on y arrive** — Onglet Codex de la barre du haut, puis une rangée de la colonne de gauche.

**Comment on en sort** — Un autre onglet, ou l'ouverture d'une chose qui remplace l'écran par son établi.

**Les défauts** :

- La barre est montée sans condition (Codex.tsx:285) : elle ne sait pas sur quelle rubrique elle se trouve.
- Sur la rubrique Équipement, la barre propose de fabriquer alors que le centre de l'écran n'est pas un vestiaire mais un formulaire de pièces.
- Le refus du bouton Générer ne dépend jamais de la rubrique (App.tsx:1223-1247) : il ne connaît que la panne, la liaison, le catalogue, le modèle et le prompt vide.

#### Codex — « Les directions » et « Leurs poses »

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx`

**À quoi ça sert** — Régler une fois pour toutes les angles de vue du jeu, et la liste des attitudes que chaque personnage se verra proposer.

**Ce que ça porte** — Un texte d'explication et une liste à éditer. Et, en dessous, exactement la même barre qui paie que sur les écrans de fabrication — mesurée à 593 px sur 1010 quand les réglages sont ouverts, soit 58,7 % de la surface utile, sur un écran qui ne peut rien produire d'utile.

**Comment on y arrive** — Colonne de gauche du Codex, rubriques « Ce que le jeu réclame de tous » et « Ce que les personnages réclament » (Codex.tsx:368-388).

**Comment on en sort** — Une autre rangée de la même colonne, ou un autre onglet.

**Les défauts** :

- Deux écrans de réglage du jeu portent un champ de dépense actif : taper un mot et faire Ctrl+Entrée y lance un appel payant qui ne se rangera nulle part.
- C'est le point exact de la plainte : « c'est un réglage du jeu, qu'est-ce que ça vient polluer une colonne entière » — et la barre qui paie l'aggrave, puisqu'elle mange plus de la moitié de ces écrans-là.

#### L'établi d'une chose du jeu

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx`

**À quoi ça sert** — Voir toutes les cases d'un personnage — une pose par ligne — et lancer la fabrication de celles qui manquent.

**Ce que ça porte** — La matrice des poses, et la barre qui paie sur toute la largeur de la fenêtre : 1920 px de large, 268 px de haut avec une case visée et les réglages repliés — 26,5 % de la surface utile. Réglages ouverts, elle passe à 657 px, soit 65 %. Elle se retire quand la fiche, la vitrine ou le calibrage s'ouvrent (Personnages.tsx:443) et quand une table d'image s'ouvre (App.tsx:2888) ; elle reste sur la planche.

**Comment on y arrive** — Cliquer une chose dans la liste du Codex.

**Comment on en sort** — Un segment du fil d'Ariane, ou un autre onglet.

**Les défauts** :

- Le geste « Fabriquer » d'une case vise la case mais ne remplit pas le Sujet (App.tsx:1660-1663, choix délibéré) : la barre annonce alors « aucun sujet — seules les planches tous partiront » dans un panneau replié qu'on ne voit pas.
- C'est ici que le quart de page est le plus littéral : 268 px sur 1010.

#### La Galerie

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx`

**À quoi ça sert** — Regarder, trier et ranger les images déjà produites. Le produit y écrit que rien ne s'y paie.

**Ce que ça porte** — Pas de barre qui paie — à sa place, une ligne de 26 px qui dit « aucun appel ne part d'ici — on paie depuis le codex et depuis l'établi d'une chose du jeu » (App.tsx:2731-2739). Mais la grille des images porte un lien « Relancer » sur chaque emplacement raté (Tuile.tsx:206-214) et la colonne de gauche un « Relancer › » par appel raté, jusqu'à douze (Arbre.tsx:365-371).

**Comment on y arrive** — Onglet Galerie.

**Comment on en sort** — Un autre onglet.

**Les défauts** :

- Les deux « Relancer » appellent api.relancer (App.tsx:1732-1740), donc POST /generations/{id}/slots/{rang}/retry, qui rappelle le fournisseur pour de vrai (atelier/services/generation.py:808-847, ligne 970 : await fournisseur.generer).
- L'écran affirme donc noir sur blanc le contraire de ce qu'il fait, et il le fait à deux endroits différents.

#### L'écran de confirmation « Ce qui part »

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Envoi.tsx`

**À quoi ça sert** — Relire mot pour mot le texte qui va partir, voir chaque image jointe avec son interrupteur, lire le prix, puis payer.

**Ce que ça porte** — Le texte assemblé ligne par ligne, les images jointes avec vignette, une section « les options » avec un interrupteur par option (Envoi.tsx:485-499), le fond corrigeable, la réserve du fournisseur, le prix mesuré, le bouton « Payer et lancer » (Envoi.tsx:670-690) et « Revenir sans rien dépenser ». Il couvre tout le produit et ne porte pas la barre qui paie.

**Comment on y arrive** — Le bouton Générer de la barre qui paie (App.tsx:1393-1417).

**Comment on en sort** — Payer, revenir, Échap, ou changer d'onglet.

**Les défauts** :

- Il ne permet ni de changer de modèle, ni de proportions, ni de nombre de variations, ni de sujet — c'est-à-dire exactement les quatre réglages qui obligent le panneau à rester au pied de tous les écrans.
- Quand on y ouvre la grille pour choisir une image de référence, cette grille porte elle aussi le lien Relancer (App.tsx:2542) : l'écran de la dépense unique en compte alors deux.

### Les constats

**BLOQUANT — La barre qui paie est montée sur les sept rubriques du Codex sans aucune condition, y compris les deux écrans de réglage du jeu.**

- *Le chiffre* : 7 rubriques sur 7
- *La preuve* : interface/src/composants/Codex.tsx:285 rend {barreQuiPaie} au bas de la colonne du centre, hors de tout test sur la rubrique. Vérifié au navigateur sur Personnages, Équipement, Les directions et Leurs poses : la barre est présente et mesure 593 px sur chacune, réglages ouverts.

**BLOQUANT — Repliée, la barre prend un quart de la hauteur utile ; ouverte, elle en prend les deux tiers, et rien ne la referme ensuite.**

- *Le chiffre* : 205 px à vide, 268 px avec une case visée, 462 px réglages ouverts, 593 px liste des modèles dépliée, 657 px avec une case visée — sur 1010 px utiles à 1920x1080
- *La preuve* : Mesures au navigateur sur un atelier jetable (port 8433, dossier temporaire, fournisseur double — l'atelier de l'auteur sur 8420 n'a pas été touché). La fenêtre fait 1080 px, moins 44 px de barre du haut et 26 px de barre d'état = 1010 px utiles. Parts : 20,3 % · 26,5 % · 45,7 % · 58,7 % · 65,0 %. À 2560x1440 (1370 px utiles) : 15,0 % · 19,6 % · 33,7 % · 43,3 % · 48,0 %.

**FORT — Avec le vrai catalogue de l'auteur, le panneau des réglages atteint son plafond de 40 % de la hauteur de fenêtre et la barre entière dépasse les 60 %.**

- *Le chiffre* : 49 modèles ; plafond 40vh = 432 px à 1080p et 576 px à 1440p ; barre totale environ 637 px (63,1 %) à 1080p et 781 px (57,0 %) à 1440p
- *La preuve* : donnees/catalogue.json contient 48 modèles OpenRouter et 1 Pollinations. Le plafond est écrit en dur : interface/src/composants/PanneauReglages.tsx:155 (max-h-[40vh]) et la liste des modèles à PanneauReglages.tsx:191 (max-h-[280px]). Il reste alors 373 px pour la liste des choses, où une fiche de personnage mesure 62 px — soit cinq lignes environ.

**MOYEN — Le repli des réglages n'est enregistré nulle part : il repart fermé à chaque rechargement de la page, mais reste ouvert tout le reste de la séance.**

- *Le chiffre* : 0 écriture en mémoire de navigateur
- *La preuve* : interface/src/App.tsx:534 appelle usePli("barre.reglages") ; usePli lit un simple Set en mémoire du module (interface/src/composants/chassis.tsx:349), et aucun localStorage ni sessionStorage n'existe dans chassis.tsx ni dans App.tsx.

**FORT — La barre porte 25 contrôles quand elle est ouverte, 4 quand elle est repliée sur un écran sans case visée.**

- *Le chiffre* : 25 contrôles ouverts (banc d'essai à 2 modèles) ; 71 attendus avec les 49 modèles de l'auteur ; 4 repliés, 6 avec une case visée
- *La preuve* : Relevé au navigateur dans la barre : bouton Modèle, champ « filtrer », 2 lignes de modèle, 4 boutons de proportions, 3 boutons de variations, 8 boutons de sujet, le × de la cible, le bouton de repli, la zone de texte du prompt, « défaire › », « + prompt négatif », « Générer ». S'y ajoutent une rangée de segments par option déclarée par le modèle (PanneauReglages.tsx:302-315) et les interrupteurs des images de référence (PanneauReglages.tsx:392-398).

**BLOQUANT — Le seul contrôle du panneau qui décide vraiment de ce qui part — le Sujet — n'est jamais prérempli, y compris quand on vise la case d'un personnage.**

- *Le chiffre* : 1 contrôle sur 25
- *La preuve* : interface/src/App.tsx:1660-1663 : « Le sujet, lui, n'est pas touché : c'est le choix de l'auteur ». Le Sujet ne se pose que par les boutons de PanneauReglages.tsx:281-290, dans le panneau replié. Sans lui, PanneauReglages.tsx:298 affiche « aucun sujet — seules les planches tous partiront », c'est-à-dire que les artworks de la famille ne partent pas en référence.

**FORT — Le choix de modèle du panneau écrase définitivement le modèle par défaut que l'univers déclare, et que le serveur recalcule à chaque contexte.**

- *La preuve* : interface/src/App.tsx:1125-1128 : l'effet ne pose le défaut que si aucun modèle n'a encore été choisi (if (modeleChoisi || !defaut.modele) return). Or le serveur renvoie un défaut qui change avec le contexte — modèle de planche quand un lot est armé, modèle d'édition quand une pièce l'est (App.tsx:735-743) — et ce défaut n'est plus jamais appliqué après le premier chargement.

**FORT — L'argument qui a justifié de garder le panneau — « aucun autre écran ne choisit un modèle » — n'est plus vrai dans le code.**

- *Le chiffre* : 3 endroits de plus : un modèle par famille, un modèle de planche, un modèle d'édition
- *La preuve* : interface/src/composants/Assistant.tsx:2722-2820, étape « Les IA à utiliser » de l'assistant de l'Univers : une liste déroulante de modèle par famille (ligne 2754, univers.modeles[famille]) plus deux listes pour modele_planche et modele_edition (lignes 2793-2794). L'argument est écrit dans docs/archive/v21-arbitrages.md:472-476 (A-25) et repris en B-18, docs/archive/v21-arbitrages.md:807-808.

**MOYEN — Ce que dit docs/DESIGN.md n'est pas ce que la mission lui prête : la largeur de 300 px n'y est pas condamnée, elle y est reconduite.**

- *Le chiffre* : 3 largeurs fermées : 380, 300, 240
- *La preuve* : docs/DESIGN.md:534-536 : « Largeurs de colonne — la liste est fermée aussi. 380 · 300 · 240, reconduites. » La promesse de disparition vient d'ailleurs et elle est datée : docs/archive/v21-arbitrages.md:458-486 (A-25, 31 août 2026) et docs/archive/v21-arbitrages.md:799-816 (B-18), qui disent que la colonne devait partir le jour où l'héritage et l'écran de confirmation existeraient. Les deux existent depuis le 31 août ; la colonne est toujours là, repliée dans la barre.

**BLOQUANT — L'invariant « un seul endroit d'où l'argent part par écran » n'est pas tenu : la Galerie déclare n'en avoir aucun et en a deux.**

- *Le chiffre* : 2 boutons de dépense sur un écran qui en annonce 0
- *La preuve* : interface/src/App.tsx:2731-2739 imprime « aucun appel ne part d'ici ». Or App.tsx:2724 passe onRelancer à la grille des images (bouton « Relancer », Tuile.tsx:206-214) et App.tsx:2655 le passe à la colonne de gauche (bouton « Relancer › », Arbre.tsx:365-371). Les deux appellent App.tsx:1732-1740, donc api.relancer, donc POST /generations/{id}/slots/{rang}/retry (atelier/api/routes.py:759-763) qui relance un appel fournisseur réel (atelier/services/generation.py:808-847, l'appel payant étant à la ligne 970).

**MOYEN — L'écran de confirmation lui-même compte deux endroits de dépense dès qu'on y ouvre la grille des images de référence.**

- *Le chiffre* : 2 au lieu de 1
- *La preuve* : interface/src/App.tsx:2542 passe onRelancer à la grille du choix de référence, en plus du bouton « Payer et lancer » de l'écran (Envoi.tsx:670-690).

**FORT — Il n'existe que deux chemins vers une dépense dans tout le produit, et le second n'est jamais annoncé comme tel.**

- *Le chiffre* : 2 appels fournisseur : lancer et relancer
- *La preuve* : Côté serveur, un seul module appelle le fournisseur : atelier/services/generation.py:970 (await fournisseur.generer), atteint par _executer (ligne 949, depuis POST /generations) et par relancer (ligne 842). Le dépliage d'une planche et l'écartage ne paient rien (atelier/services/generation.py:849-870), la récupération d'une carte d'Univers non plus (atelier/services/univers.py:375-392, un simple téléchargement d'adresse).

**MOYEN — Le champ de saisie à lui seul, sans le panneau des réglages, ne descend jamais sous 151 px.**

- *Le chiffre* : 151 px à vide, 174 px avec la ligne de provenance
- *La preuve* : Mesuré au navigateur. La composition est écrite : 32 px de marge intérieure (p-4), une zone de saisie de 56 px minimum (ChampPrompt.tsx:208), 8 px d'écart, une rangée de bouton de 34 px (ChampPrompt.tsx:278) et la ligne de fente en dessous. S'y ajoutent 26 px pour la ligne de repli (App.tsx:2222-2238) et 28 px pour la ligne « coût attendu » (App.tsx:2246-2255) — soit 205 px de plancher incompressible.

**FAIBLE — Le contrôle « Variations » est éteint dès qu'un lot est visé, c'est-à-dire dans le cas d'usage principal du Codex.**

- *Le chiffre* : 2 valeurs sur 3 grisées
- *La preuve* : interface/src/composants/PanneauReglages.tsx:245 : indisponibles={cases ? [2, 4] : []}. Dès qu'une chose du jeu a armé des cases, la rangée ne propose plus qu'une valeur, et occupe la même place.

### Ce que cette lecture impose

- La barre ne doit plus être un bloc unique. Ce qu'elle mélange se sépare proprement en trois : ce qui déclenche (le champ et le bouton), ce qui décrit l'appel (modèle, proportions, variations, sujet), et ce qui rend compte (le prix, ce qui est en route). Seul le premier a une raison d'être sur un écran de parcours.
- Les deux rubriques de réglage du jeu — Les directions, Leurs poses — ne doivent porter aucun champ de dépense. Le code n'a même pas de test à ajouter côté rubrique : il suffit que le Codex décide, rubrique par rubrique, s'il passe la barre (Codex.tsx:285), comme l'établi le fait déjà pour ses quatre plein-cadres (Personnages.tsx:443).
- Les quatre réglages qui retiennent le panneau au pied des écrans — modèle, proportions, variations, sujet — ont déjà leur écran : celui de la confirmation, qui montre le texte exact, les images jointes, le prix et le bouton qui paie, et qui possède déjà une section d'options à interrupteurs (Envoi.tsx:485-499). Les y poser rendrait vraie la phrase du produit — on lit ce qui part, et on le corrige au même endroit — et libérerait 205 à 657 px sur chaque écran du Codex.
- Le sujet doit se déduire de la chose visée plutôt que de rester un choix caché. La chose du jeu porte déjà sa famille, et le barème de l'univers porte la famille de chaque entrée : viser la case d'un personnage suffirait à poser « personnage ». Le laisser vide, comme aujourd'hui, fait partir des appels sans leurs artworks sans que rien ne le dise à l'écran.
- Le modèle n'a plus besoin d'un sélecteur permanent : l'univers en déclare déjà un par famille, un pour les planches et un pour les éditions (Assistant.tsx:2722-2820), et le serveur renvoie le bon selon le contexte. Il reste à corriger App.tsx:1125-1128, qui gèle le premier défaut reçu et ignore tous les suivants.
- L'invariant de la dépense doit être réparé avant tout redécoupage, sinon le nouveau plan héritera du mensonge : soit les boutons Relancer quittent la Galerie, soit la phrase « aucun appel ne part d'ici » cesse d'y être écrite. Aujourd'hui les deux coexistent à quelques centaines de pixels l'un de l'autre.
- Le plancher de 205 px est la vraie contrainte de mise en page : même vidée de ses réglages, la barre garde une zone de saisie de 56 px, un bouton de 34 px, deux lignes de compte rendu et 32 px de marge. Une barre de parcours acceptable tiendrait en une seule ligne — champ, bouton, prix — et renverrait tout le reste à l'écran de confirmation.

---

<a id="lecture-6"></a>

## 6 · La colonne de droite du codex : un vert qui dit deux choses, et un qui n'est jamais calculé

L'auteur a raison, et le défaut est plus grossier qu'il ne le croit. Dans ce panneau de 380 pixels, le même vert (#5fa871, posé par le même petit composant `Ligne`) veut dire deux choses différentes à quatre lignes d'écart : en haut il veut dire « cette chose n'a rien mis de côté de ce que son type lui demande », en bas il veut dire « les images existent ». Pire : la ligne « pièces d'équipement — 2 sur 2 » est verte parce que c'est écrit en dur dans le code, sans aucun calcul (Codex.tsx ligne 857, le mot `complet` est passé sans valeur, ce qui vaut « vrai » pour toujours). Sur Le pèlerin — la chose même que l'auteur ouvre — la colonne affiche huit lignes vertes, puis, tout en bas de la même colonne, « 9 cases à fabriquer » et le bouton qui les fabriquerait, grisé. Et sur les trois choses du jeu ouvert qui n'ont pas une seule image (le Coffre, l'Écran titre, La grenouille des tourbières), la première ligne est verte quand même.

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact, et en dessous de la réalité. L'auteur dit « c'est faux » ; c'est en partie plus grave que faux, c'est non calculé. Trois nuances qu'il faut poser, parce qu'elles n'appellent pas la même réparation. (1) Les lignes de poses du bas de la colonne — « repos 1 / 1 », etc. — sont honnêtes : sur le pèlerin elles sont vertes parce que ses six images de corps existent réellement. (2) La ligne du haut « poses du type personnage — 6 sur 6 » ne compte aucune image : elle compte les poses que cette chose n'a pas rangées. Comme aucune des six choses du jeu ouvert n'a rangé quoi que ce soit (leur liste `ecartees` est vide dans les six fichiers de donnees/projets/test-v2/personnages/), elle est verte pour tout le monde, y compris pour trois choses à zéro image. C'est un défaut de libellé, pas de calcul : le chiffre est juste, c'est le titre de la section et la couleur qui mentent. (3) La ligne « pièces d'équipement », elle, est un vrai défaut de calcul, ou plutôt d'absence de calcul : rien au monde ne peut l'éteindre. Elle est le fantôme d'une fonction jamais construite — « ranger une pièce d'équipement sur une chose », que la maquette du codex annonce noir sur blanc comme n'existant pas encore.

### Les surfaces examinées

#### « Ce qu'elle réclame » — le haut de la colonne de droite du codex

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (lignes 831 à 860)`

**À quoi ça sert** — Dire l'étendue de ce qu'on attend de la chose choisie — combien de poses son type lui demande, et combien de pièces d'équipement du jeu lui sont proposées.

**Ce que ça porte** — Un titre en petites capitales et deux lignes, hautes de 26 pixels chacune : « poses du type <nom du type> — N sur N », et, seulement pour les choses qui peuvent porter quelque chose, « pièces d'équipement — N sur N ». Poids à l'écran : deux lignes sur les dix à quinze de la colonne, tout en haut, donc les premières lues.

**Comment on y arrive** — Onglet Codex, puis un clic sur une chose dans la liste du milieu. La colonne est toujours montée (Codex.tsx lignes 288 à 297) ; sans chose choisie elle affiche « choisis une chose du jeu » (lignes 783 à 792).

**Comment on en sort** — La croix en haut à droite du panneau (lignes 820 à 827), qui désélectionne la chose. La colonne ne se ferme pas, elle redevient sa phrase d'attente. On peut aussi la replier depuis ailleurs (largeur ramenée à 0, ligne 204).

**Les défauts** :

- La première ligne ne compte aucune image. `tenues` (ligne 798) est le résultat de `posesTenues`, qui filtre simplement les poses que la chose a rangées (Personnages.tsx lignes 99-100). Elle dit donc « 6 sur 6 » et se met au vert dès que la chose n'a rien rangé — ce qui est le cas des six choses du jeu ouvert.
- La seconde ligne est verte en dur. À la ligne 857 le code écrit `complet` tout seul, ce qui vaut « vrai » définitivement, et sa valeur est `${pieces.length} sur ${pieces.length}` (ligne 856) — le même nombre des deux côtés, littéralement. Aucun état du monde ne peut changer cette ligne.
- Le titre de la section, « Ce qu'elle réclame », ne prévient pas que ces deux chiffres parlent de la définition de la chose et non de son travail fait. Quatre lignes plus bas, sous « Ce qui manque », le même vert veut dire l'inverse.
- La maquette du codex prévoyait quatre lignes ici — poses du type, poses ajoutées sur elle, directions, pièces d'équipement (docs/archive/maquettes-v2.1/05-codex.html, lignes 467 à 471). Le code n'en dessine que deux : la ligne des poses ajoutées et celle des directions n'existent nulle part.

#### « Ce qui manque » — le bas de la même colonne

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (lignes 862 à 937)`

**À quoi ça sert** — Dire, pose par pose, combien d'images existent sur combien sont attendues, puis proposer de lancer la fabrication de ce qui manque.

**Ce que ça porte** — Une ligne par pose tenue — « repos 1 / 1 », « marche 1 / 1 »… —, puis un pied de colonne collé en bas avec le nombre d'images et de planches à venir, la phrase « N cases à fabriquer », le bouton « Fabriquer ce qui manque » et le bouton « Ouvrir son établi ». C'est les deux tiers de la hauteur du panneau.

**Comment on y arrive** — C'est la suite de la même colonne, sous « Son ambiance ». On y arrive en défilant, ou directement si la chose a peu de poses.

**Comment on en sort** — « Ouvrir son établi » (lignes 934 à 937) quitte le codex pour l'écran de fabrication de cette chose.

**Les défauts** :

- Ce bloc-ci est honnête — le calcul des lignes 892 à 899 compare ce qui est fait à ce qui est demandé, et le serveur fournit le chiffre demandé —, mais il est peint avec exactement la même encre que le bloc du haut, qui, lui, ne parle pas de la même chose.
- Le pied de colonne se contredit avec le bouton juste en dessous. Sur Le pèlerin, la phrase dit « 9 cases à fabriquer » (ligne 920) et le bouton « Fabriquer ce qui manque » est grisé (ligne 923), avec pour raison affichée « rien ne manque au corps de cette chose » (ligne 930). Les neuf cases manquantes sont des cases d'équipement, que ce bouton ne sait pas lancer — mais l'écran ne dit nulle part où aller les chercher.
- Deux formules du mot « fait » cohabitent dans le même composant : le bouton se décide sur `case_.images.length < pose.images` (ligne 806) tandis que les lignes affichées se décident sur le compte du serveur (lignes 892-893). Tant qu'un jeu ne déclare pas de directions les deux tombent d'accord ; dès qu'il en déclare quatre, elles divergent d'un facteur quatre.

#### Le petit composant qui peint le vert

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (lignes 944 à 961)`

**À quoi ça sert** — Dessiner une ligne « intitulé … valeur » et colorer la valeur en vert quand on lui passe « complet ».

**Ce que ça porte** — Trois lignes de code utiles. Le vert est la teinte `--color-ok`, définie à #5fa871 dans interface/src/index.css ligne 27. Le commentaire qui l'accompagne (lignes 956-957) affirme : « le vert dit complet, son absence dit pas encore ».

**Comment on y arrive** — Il n'est pas visible en tant que tel : il est employé quatre fois dans la colonne de droite et nulle part ailleurs.

**Comment on en sort** — Sans objet.

**Les défauts** :

- C'est le point de fuite du défaut. Un seul composant, une seule couleur, et quatre appels dont deux parlent de la définition de la chose et deux de sa fabrication. Le commentaire du code dit ce que le vert devrait dire ; deux des quatre appels ne le respectent pas.

#### La carte de la chose, dans la colonne du milieu

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Codex.tsx (lignes 658 à 750)`

**À quoi ça sert** — Montrer chaque chose de la famille ouverte avec sa vignette, son nom et le nombre de cases qui lui manquent.

**Ce que ça porte** — Une vignette de 44 pixels, le nom, la description, l'ambiance éventuelle, et à droite « N cases manquantes » ou « rien ne manque » en vert.

**Comment on y arrive** — C'est la colonne centrale du codex sur les quatre familles de choses.

**Comment on en sort** — Un clic sur la carte choisit la chose (et remplit la colonne de droite) ; un clic sur son nom ouvre son établi.

**Les défauts** :

- Elle est juste, et c'est ce qui rend la colonne de droite gênante : pour La grenouille des tourbières, la carte dit « 6 cases manquantes » pendant que la colonne de droite affiche, à 40 centimètres, deux lignes vertes « 6 sur 6 » et « 2 sur 2 ». Deux endroits du même écran, deux réponses opposées à la même question.

#### « Sa matrice » — l'autre colonne de droite, celle de la fiche d'une chose

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/FicheChose.tsx (lignes 1032 à 1069)`

**À quoi ça sert** — Tenir sous les yeux, pendant qu'on règle la chose à gauche, le tableau de ses poses avec ce qui les remplit.

**Ce que ça porte** — Une ligne par pose, « nom … N / M », le M en vert quand c'est plein, et un total en bas.

**Comment on y arrive** — Onglet Codex, ouvrir une chose, puis ouvrir sa fiche depuis l'établi. Elle occupe le bord droit de l'écran.

**Comment on en sort** — En refermant la fiche, qui rend l'établi.

**Les défauts** :

- Second vert faux, et celui-là est un vrai défaut de calcul. Les lignes 1045, 1055 et 1058 comparent le nombre d'images au nombre d'étapes de la pose (`pose.images`) au lieu du nombre réellement attendu, qui est ce nombre multiplié par les directions du jeu (calculé par le serveur, atelier/services/production.py ligne 1829). Sur le projet « coeur de pierre - 01 », qui déclare quatre directions et dont la pose repos demande 4 étapes, le personnage balthazar-2 a 4 images pour 16 attendues : cette colonne affiche « 4 / 4 » en vert.
- Et la colonne se contredit elle-même : son propre total du bas (ligne 1065) est calculé, lui, sur le bon chiffre (FicheChose.tsx lignes 101 à 104). On peut donc y lire six lignes vertes au-dessus d'un total qui dit « 1 / 6 ».

#### « Ce que le jeu réclame » — la quatrième section de la fiche d'une chose

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/FicheChose.tsx (lignes 885 à 937)`

**À quoi ça sert** — Lister les poses que cette chose doit avoir, avec, pour chacune, le nombre d'images demandées et d'où la pose lui vient — de son type, ou ajoutée sur elle seule.

**Ce que ça porte** — Une liste de lignes de 26 pixels, puis, sous un trait, les poses rangées, barrées.

**Comment on y arrive** — Fiche d'une chose, en défilant, ou par le sommaire à gauche.

**Comment on en sort** — En refermant la fiche.

**Les défauts** :

- Elle dit exactement la même chose que la ligne « poses du type … » de la colonne du codex, en plus complet et sans couleur trompeuse. C'est la troisième écriture du même fait.
- Son titre, lu dans le recueil d'aide (interface/src/aide.ts ligne 566), dit encore « Ce que le jeu réclame » alors que la liste affichée est celle du type de la chose, pas celle du jeu — le coffre y voit fermé, ouvert, vidé et non les six poses du jeu.

### Les constats

**BLOQUANT — La marque verte des pièces d'équipement n'est pas calculée : elle est écrite en dur.**

- *Le chiffre* : 1 ligne sur les 2 du bloc du haut ; verte pour les 3 personnages du jeu ouvert, dont un qui n'a que 3 calques posés sur les 12 attendus
- *La preuve* : interface/src/composants/Codex.tsx lignes 853 à 859 : `valeur={`${pieces.length} sur ${pieces.length}`}` puis `complet` seul — en React, un attribut sans valeur vaut « vrai ». Les deux nombres sont la même variable.

**FORT — Le même vert veut dire deux choses différentes à quatre lignes d'écart dans le même panneau : en haut « rien n'est mis de côté », en bas « les images existent ».**

- *Le chiffre* : 4 appels du même composant, 1 seule couleur (#5fa871)
- *La preuve* : Codex.tsx ligne 848 (en haut, `tenues.length === reclame.length`) contre ligne 899 (en bas, `faites >= demandees`), tous deux rendus par le composant `Ligne` de la ligne 944, dont le vert est `text-ok` (ligne 958), défini à #5fa871 dans interface/src/index.css ligne 27.

**FORT — La ligne « poses du type … — N sur N » ne regarde aucune image : elle compte les poses que la chose n'a pas rangées. Comme aucune chose du jeu ouvert n'a rien rangé, elle est verte pour toutes, y compris celles qui n'ont pas une seule image.**

- *Le chiffre* : 6 choses sur 6 dans le projet ouvert ont une liste de poses rangées vide ; 3 d'entre elles ont 0 image
- *La preuve* : Codex.tsx lignes 797-798 et 848 ; `posesTenues` est un simple filtre sur les poses rangées, interface/src/composants/Personnages.tsx lignes 99-100. Données : les six fichiers de C:/STOCKAGE/PROJET/_DEV/gag2/donnees/projets/test-v2/personnages/ portent tous `"ecartees": []`.

**BLOQUANT — Sur une chose sans la moindre image, la colonne affiche des lignes vertes. C'est exactement le cas que l'auteur décrit.**

- *Le chiffre* : La grenouille des tourbières : 0 image, et pourtant « poses du type personnage — 6 sur 6 » en vert et « pièces d'équipement — 2 sur 2 » en vert. Le Coffre : 0 image, « poses du type meuble — 3 sur 3 » en vert. L'Écran titre : 0 image, « 4 sur 4 » en vert.
- *La preuve* : Vérifié dans la base : `select personnage, count(*) from assets where projet='test-v2' and supprime_le is null group by personnage` ne rend que le-garde-du-moulin (14) et le-pelerin (18). Les trois autres choses n'ont aucune ligne. Le calcul de la colonne a été rejoué à l'identique sur ces données.

**BLOQUANT — Le panneau se contredit avec lui-même sur la chose que l'auteur ouvre. Sur Le pèlerin, huit lignes vertes, puis en pied de colonne « 9 cases à fabriquer », et le bouton qui les fabriquerait est grisé avec la raison « rien ne manque au corps de cette chose ».**

- *Le chiffre* : 8 lignes vertes (1 + 1 en haut, 6 poses en bas) contre 9 cases annoncées manquantes, sur un même panneau de 380 px
- *La preuve* : Codex.tsx : le compte du pied vient de la fonction `manque` (lignes 448 à 463), le bouton se décide sur `manquantes` (lignes 804 à 807), la phrase est ligne 920, l'inactivité ligne 923 et la raison ligne 930. Données : le pèlerin a 1 image de corps sur chacune de ses 6 poses, et seulement 3 calques d'équipement (sac sur repos et marche, épée sur repos) là où 6 poses × 2 pièces en attendent 12.

**MOYEN — Deux définitions du mot « fait » cohabitent dans ce seul composant : celle du bouton et celle des lignes affichées. Elles divergent dès qu'un jeu déclare des directions.**

- *Le chiffre* : facteur 4 sur un jeu à 4 directions
- *La preuve* : Codex.tsx ligne 806 (`case_.images.length < pose.images`) contre lignes 892-893 (compte du serveur, qui vaut déjà étapes × directions — atelier/services/production.py ligne 1829). Sur le projet coeur-de-pierre-01 (vue de dessus 3/4, donc 4 directions), la pose repos de balthazar-2 porte 4 images pour 16 attendues : la liste dirait « 4 / 16 » pendant que le bouton se croirait fini.

**FORT — L'autre colonne de droite du produit — « Sa matrice », dans la fiche d'une chose — porte un vert faux d'un autre genre : elle compare au nombre d'étapes de la pose au lieu du nombre réellement attendu.**

- *Le chiffre* : sur coeur-de-pierre-01, elle affiche « 4 / 4 » en vert là où 16 images sont attendues
- *La preuve* : interface/src/composants/FicheChose.tsx lignes 1045, 1055 et 1058 (`combien >= pose.images`, `{combien} / {pose.images}`) alors que le total juste au-dessous, lignes 101 à 104 puis 1065, utilise bien le compte du serveur. La même colonne peut donc montrer six lignes vertes au-dessus d'un total « 1 / 6 ».

**MOYEN — La colonne reste montée et remplie de la dernière chose choisie, même quand le milieu de l'écran ne parle plus de choses.**

- *Le chiffre* : 3 rubriques concernées sur 7 : Leurs poses, Les directions, Équipement
- *La preuve* : Codex.tsx lignes 288 à 297 : le panneau est monté quelle que soit la rubrique. Et la chose choisie n'est jamais remise à zéro quand on change de rubrique — interface/src/App.tsx lignes 2845 à 2856, où `onRubrique` ne fait que `setRubrique`. On lit donc « Le pèlerin — ce qu'elle réclame » à côté du vestiaire du jeu.

**MOYEN — Le même fait — ce qui manque à une chose — est écrit à cinq endroits sur deux écrans, avec trois formules de calcul différentes.**

- *Le chiffre* : 5 écritures, 3 formules
- *La preuve* : Codex.tsx lignes 330-334 (« 3 personnages · 3 incomplets » au pied de la colonne de gauche), lignes 735 à 745 (« N cases manquantes » sur la carte), lignes 887 à 902 (les lignes par pose), lignes 917 à 921 (le pied). Puis FicheChose.tsx lignes 888 à 937 (la liste des poses réclamées) et 1032 à 1069 (la matrice). Les trois formules : `manque` (Codex.tsx 448), `manquantes` (Codex.tsx 804) et `comptes` (FicheChose.tsx 96).

**MOYEN — La maquette de conception prévoyait quatre lignes dans ce bloc ; le code n'en dessine que deux, et l'une des deux manquantes est celle qui aurait donné un sens au vert.**

- *Le chiffre* : 2 lignes sur 4 réalisées
- *La preuve* : docs/archive/maquettes-v2.1/05-codex.html lignes 467 à 471 : « poses du type personnage · 6 sur 6 », « poses ajoutées sur lui · aucune », « directions · 4 sur 4 », « pièces d'équipement · 2 sur 2 ». Le même document, ligne 865, écrit noir sur blanc que le produit « ne peut rien dire des pièces d'équipement — toutes celles du vestiaire lui sont proposées ». La ligne verte en dur est donc la trace d'une fonction annoncée et jamais construite.

**FAIBLE — Le titre de la section jumelle dans la fiche est resté celui d'avant : il dit « le jeu » là où la liste affichée est celle du type de la chose.**

- *La preuve* : interface/src/aide.ts ligne 566 : `nom: "Ce que le jeu réclame"`, employé comme titre par FicheChose.tsx lignes 480 à 484 pour une liste construite sur la liste du type (le coffre y voit fermé, ouvert, vidé).

### Ce que cette lecture impose

- Un même signe ne peut pas dire deux choses sur un même écran. Aujourd'hui le vert dit tantôt « cette chose n'a rien mis de côté », tantôt « les images existent ». Sur la carte cible, une seule de ces deux questions a droit à une couleur, et c'est celle de la fabrication — c'est la seule qui change quand on travaille.
- Il faut trancher entre deux blocs qui ne se ressemblent que par accident. « Combien de poses son type lui demande » est un fait de définition : ça se règle une fois, ça ne bouge plus, ça a sa place là où l'on définit le type — pas dans le panneau qu'on regarde en fabriquant. « Combien d'images existent » est un fait de production, et c'est la seule chose que l'auteur vient lire ici.
- La ligne des pièces d'équipement doit disparaître ou être calculée, pas les deux à moitié. Tant que le produit ne sait pas dire « ce personnage-là ne porte pas de casque », cette ligne n'a rien à annoncer : elle affiche un total du vestiaire du jeu, pas une information sur la chose regardée. Si on veut un chiffre d'équipement, celui qui a du sens existe déjà — 3 calques posés sur 12 attendus pour Le pèlerin — et il est calculé quatre lignes plus haut dans le même fichier.
- Un panneau ne doit pas pouvoir annoncer « 9 cases à fabriquer » à côté d'un bouton grisé qui dit « rien ne manque ». Soit le bouton sait lancer l'équipement, soit le compte du pied ne parle que de ce que le bouton sait lancer et le reste est renvoyé, nommément, vers l'endroit qui sait le faire.
- Le même fait ne doit être calculé qu'une fois. Trois formules du mot « fait » vivent aujourd'hui dans deux fichiers, et deux d'entre elles se trompent dès qu'un jeu déclare des directions — ce qui est le cas de la moitié des projets du dépôt. La carte cible doit poser un seul endroit qui répond à « où en est cette chose », que tous les écrans lisent.
- La colonne doit se vider quand on quitte les choses. Lire « ce que Le pèlerin réclame » pendant qu'on édite le vestiaire du jeu est une des raisons pour lesquelles l'auteur trouve cette colonne « étrange » : elle décrit quelque chose qui n'est plus à l'écran.
- Rien de tout cela n'est un problème de serveur. Le serveur envoie les bons chiffres — il calcule correctement le nombre attendu, directions comprises. Les quatre défauts sont dans l'interface, dans trois fonctions courtes de deux fichiers.

---

<a id="lecture-7"></a>

## 7 · La galerie : ce qu'elle fait vraiment, et où passe la seconde perdue

La galerie ne mélange pas les projets dans sa grille — vérifié en direct sur l'atelier qui tourne : les 41 images affichées appartiennent toutes au projet ouvert, et le serveur refuse les autres. Mais trois compteurs du même écran, eux, comptent tout : la barre du bas annonce « 166 assets » pendant que la barre du haut annonce « 41 images », et l'en-tête « Projet » de la colonne de gauche affiche 1,5281 $ alors que le projet ouvert n'en a dépensé que 0,20 $ — 13 % du chiffre montré. C'est de là que vient la sensation de mélange, et elle est fondée. La lenteur, elle, est réelle et j'en tiens la cause exacte : chaque vignette est refabriquée par le serveur à chaque demande, jamais rangée sur le disque, et le serveur ne sait en fabriquer qu'une à la fois. Mesuré au navigateur, cache vide : 41 vignettes coûtent 1,03 seconde, alors que servir les 41 images entières — huit fois plus lourdes — n'en coûte que 0,20. Le remède de fin août a donc échangé 8,9 Mo de bande passante locale, qui ne coûtent rien, contre une seconde de calcul, qui coûte tout. Enfin, la galerie ne montrera jamais plus de 200 images : la limite est écrite dans le serveur, il n'y a ni pagination ni bouton « voir la suite », et rien à l'écran ne dit que le reste existe.

### Ce que vaut la plainte de l’auteur, sur cette surface

> L'auteur a raison sur le fond et se trompe sur un detail, et le detail compte. « Elle melange les projets » : la grille, non — elle est correctement filtree, et je l'ai verifie en direct. Mais l'ecran, oui : trois compteurs pour trois perimetres, et le plus visible des trois — la depense affichee sous le mot « Projet » — est celui de tous les jeux confondus. Sa perception est juste, sa cause est ailleurs qu'il ne croit. « Ca rame de fou plus on a d'images » : vrai, mesure, et la cause est nette — une seconde pour peindre 41 images, alors que servir les memes en taille reelle, huit fois plus lourdes, prend deux dixiemes de seconde. Le serveur refabrique chaque vignette a chaque regard et n'en fabrique qu'une a la fois. Sur ce point la plainte est meme EN DESSOUS de la realite : il ne sait pas encore que sa galerie ne montrera jamais plus de 200 images, quoi qu'il fabrique. Avec la cible qu'il annonce — plus de 3 300 images — c'est 6 % de sa bibliotheque qu'il pourra voir. « Utile mais mal foutu » : utile, oui, et il ne s'agit pas d'un doublon du Codex — 44 % de ses images n'ont aucun autre domicile, et cinq gestes n'existent que la. Mal foutu, oui : un filtre dont la moitie des valeurs ne peut rien rendre, et qui annonce alors une bibliotheque vide en invitant a ecrire.

### Les surfaces examinées

#### La grille des images

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx (fonction Grille, ligne 3244) et C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Tuile.tsx`

**À quoi ça sert** — Voir d'un coup d'oeil toutes les images fabriquées pour le jeu ouvert, pour juger, choisir, ranger ou jeter.

**Ce que ça porte** — Une planche contact de tuiles carrees, toutes montees d'un bloc (App.tsx:3325). Chaque tuile porte l'image, son nom tronque, ses dimensions, son prix et une fleche de telechargement. 41 tuiles aujourd'hui, 511 elements de page pour l'ecran entier — environ 12 par tuile. Trois tailles au choix : 128, 256 et 512 pixels (chassis.tsx:138), mais la tuile ne demande au serveur que deux tailles reelles, 256 ou 512 (App.tsx:3336).

**Comment on y arrive** — C'est l'ecran d'accueil : l'application s'ouvre dessus (App.tsx:249).

**Comment on en sort** — En cliquant une image (la fiche s'ouvre a droite), en passant a un autre onglet, ou en ouvrant une profondeur — les tables de retouche, la decoupe, le depliage d'une planche.

**Les défauts** :

- Aucune fenetre glissante : les 41 tuiles — et jusqu'a 200 — sont toutes construites dans la page en meme temps (App.tsx:3325). Il n'existe aucune virtualisation nulle part dans l'interface : la recherche de IntersectionObserver, react-window ou equivalent ne trouve rien.
- Le report de chargement des images existe bien (Tuile.tsx:167, loading=lazy) et il fonctionne : dans un onglet non peint, aucune des 41 images ne part. C'est la seule protection en place, et elle ne protege que ce qui est sous le bas de l'ecran.
- Aucun composant de l'interface n'est memorise (aucun React.memo dans tout interface/src). Le moindre changement d'etat de l'application — redimensionner la fenetre suffit, App.tsx:626 — refait le rendu des 41 a 200 tuiles.

#### La colonne de gauche — l'arbre des projets

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Arbre.tsx`

**À quoi ça sert** — Choisir sur quel jeu on travaille, ranger dans des dossiers, et voir ce qu'on a depense.

**Ce que ça porte** — Un en-tete « Projet » avec un montant, la liste des 6 projets avec leur nombre d'images et leur cout, la liste des dossiers, et le journal des appels rates. 240 pixels de large, toujours ouverte.

**Comment on y arrive** — Elle est la en permanence sur la galerie.

**Comment on en sort** — Elle se replie depuis la barre du haut.

**Les défauts** :

- L'en-tete dit « Projet » au singulier et affiche 1,5281 $, qui est la somme de TOUS les projets (Arbre.tsx:91, calcule dans atelier/services/bibliotheque.py:878 par une requete sans filtre). Le projet ouvert, test-v2, a coute 0,20 $. Le chiffre le plus gros de la colonne est donc celui qui parle le moins du jeu ouvert.
- Les dossiers sans projet sont montres dans tous les projets (Arbre.tsx:48), et en choisir un fait tomber le filtre de projet cote serveur (atelier/api/routes.py:1095) : la grille montre alors les images de tous les jeux melangees. C'est le seul chemin par lequel la grille melange vraiment, et il existe.

#### La barre d'outils, au-dessus de la grille

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/BarreOutils.tsx`

**À quoi ça sert** — Chercher, filtrer, compter, agrandir, et agir sur une selection d'images.

**Ce que ça porte** — Un champ de recherche, un filtre par famille a six valeurs, un bouton Favoris, le compte d'images, trois crans de zoom, et — quand des images sont selectionnees — ranger, favori, supprimer, deselectionner. A droite, importer et exporter.

**Comment on y arrive** — Elle est posee au-dessus de la grille, en permanence.

**Comment on en sort** — Elle ne se ferme pas.

**Les défauts** :

- Le filtre par famille offre six valeurs et trois ne peuvent RIEN rendre : choisir « decors », « objets » ou « interface » ecarte systematiquement toutes les images (App.tsx:1205). La grille se vide a chaque fois.
- Pire, elle se vide avec le mauvais message : la famille n'est pas comptee comme un filtre (api.ts:2406), donc l'ecran affiche « Rien n'est encore sorti d'ici. Ecris. » — il annonce une bibliotheque vide alors qu'elle est pleine, et il ne propose pas le bouton « Retirer le filtre » qui existe pour les autres filtres.
- Le compte affiche est celui de la liste recue du serveur (App.tsx:2687), pas celui des tuiles reellement dessinees : quand un lot est en cours, la grille montre plus de cases que la barre n'en annonce.

#### La fiche, colonne de droite

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Fiche.tsx`

**À quoi ça sert** — Tout savoir d'une image choisie, et decider quoi en faire.

**Ce que ça porte** — L'image en grand, ses mesures, son prix, sa filiation, et deux portes : l'etabli de la chose du jeu a qui elle appartient (dans le Codex), et les tables de retouche (sans quitter la galerie).

**Comment on y arrive** — En cliquant une tuile.

**Comment on en sort** — En vidant la selection.

**Les défauts** :

- C'est le seul endroit de la galerie qui renvoie vers le Codex, et il ne fonctionne que si l'image appartient a un personnage — ce qui est le cas de 32 images sur 41 dans le projet ouvert.

#### Le pied de page

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx (fonction BarreEtat, ligne 3406 et 3435)`

**À quoi ça sert** — Dire si l'atelier repond, combien de modeles il connait, et combien d'images il contient.

**Ce que ça porte** — Un point de couleur, l'etat de la liaison, le nombre de modeles, et a droite un compte d'images.

**Comment on y arrive** — Toujours visible.

**Comment on en sort** — Il ne se ferme pas.

**Les défauts** :

- Il annonce « 166 assets » — le total de tous les projets — a trente centimetres d'une barre qui annonce « 41 images ». Deux chiffres justes, deux perimetres differents, aucun mot pour dire lequel est lequel. Verifie en direct dans la page.

### Les constats

**FAIBLE — La grille ne melange PAS les projets. Le serveur ramene par defaut le seul projet ouvert, et le flux d'evenements rejette une image d'un autre jeu.**

- *Le chiffre* : 41 images servies, 1 seul projet represente
- *La preuve* : atelier/api/routes.py:1095-1096 (le projet ouvert est impose quand rien n'est demande) et interface/src/App.tsx:3047 (une image d'un autre projet est retiree de la liste). Verifie en direct : /api/assets a rendu 41 images, toutes de test-v2.

**FORT — Mais trois compteurs du meme ecran comptent trois perimetres differents, sans le dire. C'est ce qui donne le sentiment de melange.**

- *Le chiffre* : 41 / 166 / 1,5281 $ pour un projet qui a coute 0,20 $
- *La preuve* : Barre d'outils : « 41 images » (App.tsx:2687). Pied de page : « 166 assets » (App.tsx:3406). En-tete de la colonne gauche : « Projet — 1,5281 $ » (Arbre.tsx:91), qui est la somme de tous les jeux. Les trois lus a l'ecran en meme temps.

**MOYEN — Il existe deux vrais chemins par lesquels des images d'autres projets entrent dans la grille. Choisir un dossier sans projet fait tomber le filtre de projet cote serveur. Et un lot en cours ou interrompu d'un autre jeu reste dans la grille : ni le serveur ni l'ecran ne le filtrent par projet, et changer de jeu ne le chasse pas.**

- *Le chiffre* : 0 lot en attente aujourd'hui, donc invisible pour l'instant ; le mecanisme est bien la
- *La preuve* : atelier/api/routes.py:1095 (le filtre de projet n'est pose que si aucun dossier n'est demande) ; atelier/depot/base.py:264-270 (la liste des lots recents n'a aucun filtre de projet) ; interface/src/App.tsx:130-133 (la fusion des lots ne verifie pas le projet, contrairement a celle des images en 3047) ; l'etat des lots n'est jamais vide au changement de projet.

**FAIBLE — La galerie demande bien des vignettes reduites, pas les images entieres. L'audit du 31 aout est exact sur ce point, et la galerie est bien l'un des ecrans servis.**

- *Le chiffre* : 6 endroits appellent la vignette, dont la galerie
- *La preuve* : interface/src/composants/Tuile.tsx:110 appelle vignetteAsset, defini dans composants/Apercu.tsx:95. Les autres appelants sont Calibrage.tsx:580, Envoi.tsx:1136, FicheChose.tsx:360, 833 et 1007, et la bande de reinjection App.tsx:3214.

**BLOQUANT — VOICI LA LENTEUR. Chaque vignette est refabriquee de zero a chaque demande. Le serveur ouvre l'image entiere, la reduit, la reencode, l'envoie, et ne garde rien. Aucun fichier de vignette n'existe sur le disque.**

- *Le chiffre* : 16,8 ms de calcul pur par image, mesure sur 120 fichiers reels du depot
- *La preuve* : atelier/api/routes.py:1268-1290 : la route lit les octets de l'image puis appelle vignette() et renvoie le resultat sans jamais l'ecrire. atelier/image/mesures.py:95-127 : la fonction ouvre, redimensionne, reencode — et il n'y a aucune mise en cache, ni en memoire ni sur disque.

**BLOQUANT — Et le serveur n'en fabrique qu'une a la fois. La route est declaree en mode asynchrone mais fait un travail lourd et bloquant : elle occupe la boucle du serveur pendant tout le calcul. Aucun fil de travail secondaire n'existe dans tout le serveur, et il tourne en un seul processus.**

- *Le chiffre* : 1 image a la fois, quel que soit le nombre de demandes en parallele
- *La preuve* : atelier/api/routes.py:1269 est une route async qui appelle directement vignette(). Aucune occurrence de run_in_threadpool ni to_thread dans tout le dossier atelier/. atelier/__main__.py:159-165 lance un seul serveur, sans travailleurs multiples.

**BLOQUANT — Resultat mesure au navigateur sur l'atelier qui tourne, cache vide : la galerie met une seconde a se peindre pour 41 images. Le navigateur en demande six a la fois, mais elles reviennent en file indienne — la mediane par image est de 619 ms parce que chacune attend son tour.**

- *Le chiffre* : 1 029 ms au total, 619 ms de mediane, 1 024 ms pour la plus lente, 801 Ko recus (20 Ko par vignette)
- *La preuve* : Mesure faite dans la page ouverte sur http://127.0.0.1:8420 : 41 vignettes rechargees sans cache.

**BLOQUANT — Et le remede coute plus cher que le mal qu'il soigne. Servir les 41 images ENTIERES — huit fois plus lourdes — est cinq fois plus rapide, parce que le serveur se contente de les lire sur le disque. Le gain de fin aout a echange de la bande passante locale, qui est gratuite, contre du calcul, qui ne l'est pas.**

- *Le chiffre* : images entieres : 195 ms pour 8,91 Mo. Vignettes 256 px : 1 324 ms pour 0,82 Mo. Vignettes 512 px : 3 506 ms pour 2,44 Mo
- *La preuve* : Meme serie de 41 images, meme serveur, meme instant : par la route des images entieres contre la route des vignettes.

**FORT — Le cran d'agrandissement 4x est le pire cas : il demande des vignettes de 512 pixels, qui coutent 85 ms chacune. Agrandir la grille, c'est relancer tout le calcul sur une adresse neuve que le navigateur n'a jamais vue.**

- *Le chiffre* : 85,5 ms par vignette a 512 px, contre 32,3 ms a 256 px
- *La preuve* : interface/src/App.tsx:3336 demande le maximum entre 256 et le cran choisi ; les crans valent 128, 256 et 512 (composants/chassis.tsx:138). Deux adresses distinctes, donc deux caches distincts.

**MOYEN — La bonne nouvelle : la deuxieme visite est gratuite. Le serveur demande au navigateur de garder chaque vignette un an, et l'adresse change quand l'image change.**

- *Le chiffre* : 1 an de conservation ; la lenteur ne frappe qu'a cache vide, au premier zoom, et apres tout nettoyage du navigateur
- *La preuve* : atelier/api/routes.py:1261-1266 : la duree d'un an est posee des qu'une empreinte accompagne la demande. Verifie sur la reponse reelle : cache-control public, max-age=31536000, immutable.

**BLOQUANT — La galerie ne montrera JAMAIS plus de 200 images. La limite est ecrite dans le serveur, il n'y a ni pagination, ni bouton « voir la suite », ni message. Passe 200 images dans un jeu, la galerie devient un mensonge silencieux.**

- *Le chiffre* : 200 images maximum, aujourd'hui 41 affichees sur 166 en base
- *La preuve* : atelier/api/routes.py:1080 fixe la limite par defaut a 200 ; atelier/depot/base.py:566 la traduit en LIMIT dans la requete, sans decalage possible. L'interface ne demande jamais de limite (api.ts:3281-3288) et n'affiche aucun avertissement (BarreOutils.tsx).

**MOYEN — Chaque ouverture de la galerie fait partir deux fois les memes demandes. Au premier instant l'application croit qu'aucun projet n'est ouvert, lance tout pour « aucun projet », puis relance tout quand le serveur dit lequel est ouvert.**

- *Le chiffre* : /api/characters pese 71,5 Ko et coute 95 ms, tire deux fois sur un ecran qui ne s'en sert pas ; /api/models coute 313 ms
- *La preuve* : interface/src/App.tsx:109 fixe le projet courant a « aucun » au demarrage ; toutes les lectures en dependent (relireGrille App.tsx:794, et les mêmes pour le tableau, les personnages, le journal). Releve dans le journal reseau de la page : /api/assets, /api/board, /api/characters et /api/journal partent chacun deux fois.

**MOYEN — Le stock d'images sur le disque : 395 fichiers, 215 Mo. Les images d'origine sont lourdes, ce sont elles que le serveur relit et reduit a chaque vignette.**

- *Le chiffre* : 156 images d'origine : 69,4 Mo, 435 Ko de moyenne, jusqu'a 1,99 Mo. 137 images retravaillees : 18,2 Mo, 9 Ko de mediane
- *La preuve* : Comptage direct de C:/STOCKAGE/PROJET/_DEV/gag2/donnees : 88 Mo de lots generes, 126 Mo de projets.

**BLOQUANT — A 500, 2 000 ou 10 000 images, la galerie affichera exactement la meme chose : les 200 dernieres. Le reste sera inatteignable, y compris par la recherche, qui est bornee par la meme limite.**

- *Le chiffre* : a 2 000 images, 1 800 restent invisibles ; a 10 000, 9 800
- *La preuve* : atelier/depot/base.py:556-566 : la recherche partage la requete et la limite de la grille.

**FORT — Et dans ce plafond de 200, le premier affichage coutera plusieurs secondes. Le navigateur charge d'avance environ quatorze rangees ; a la taille de repos cela fait une centaine de vignettes lancees d'un coup, servies une par une.**

- *Le chiffre* : environ 110 vignettes au premier ecran, soit ~2,8 s ; les 200 completes, ~5,2 s a la taille de repos et ~17 s au cran 4x
- *La preuve* : Extrapolation directe des 32,3 ms par vignette mesures, avec le pas de 147 px mesure dans la page et huit tuiles par rangee a 1 600 px de large.

**BLOQUANT — L'auteur dit etre a moins de 5 % du contenu final. Ses 166 images d'aujourd'hui posent donc une cible d'au moins 3 300 images, environ 1,8 Go sur le disque. La galerie actuelle en montrera 6 %.**

- *Le chiffre* : 3 300 images visees, 200 montrables, 1,8 Go estimes
- *La preuve* : 166 images en base pour « meme pas 5 % » ; 544 Ko de moyenne par fichier mesures sur les 395 fichiers du dossier donnees.

**MOYEN — Detail, mais reel : une vignette est gardee un an sous une adresse qui ne bougera pas quand l'image d'une superposition est reecrite sous le meme nom. Le meme raisonnement avait fait retirer l'empreinte de l'adresse des images entieres ; il n'a pas ete applique aux vignettes.**

- *Le chiffre* : 23 images concernees aujourd'hui
- *La preuve* : interface/src/api.ts:4312-4316 explique pourquoi l'adresse du fichier entier ne porte pas d'empreinte — « garder un an une image qu'un rejeu de superposition reecrit sous le meme nom » — alors que l'adresse de la vignette, juste en dessous (api.ts:4329), en porte toujours une. 23 images du depot partagent deja une meme empreinte de recette vide.

**FORT — Le Codex, lui, n'a PAS profite du travail sur les vignettes : sa liste d'entites et sa matrice de poses demandent encore les images entieres.**

- *Le chiffre* : 435 Ko de moyenne par image la ou 20 Ko suffiraient
- *La preuve* : interface/src/composants/Codex.tsx:696 et composants/Personnages.tsx:2403 utilisent sujetAsset, qui rend l'adresse du fichier complet, pas vignetteAsset.

**FAIBLE — La galerie n'est pas un doublon du Codex. 73 des 166 images n'appartiennent a aucune chose du jeu : elles n'existent nulle part ailleurs. Et cinq gestes n'existent que dans la galerie.**

- *Le chiffre* : 73 images sur 166 (44 %) sans autre domicile ; 9 sur 41 dans le projet ouvert
- *La preuve* : Comptage en base des images sans personnage rattache. Cotes gestes : exporter une selection n'existe qu'ici (App.tsx:1828), deposer un fichier dans la bibliotheque aussi (App.tsx:3274), et le Codex n'a ni recherche, ni dossiers, ni selection multiple, ni suppression groupee.

### Ce que cette lecture impose

- Ranger les vignettes sur le disque, une fois, au lieu de les refabriquer a chaque regard. C'est le seul geste qui change l'ordre de grandeur : il fait passer chaque vignette de 32 ms a environ 5 ms, le temps de lire un fichier. Sans lui, tout le reste est de la decoration.
- Et tant que ce n'est pas fait, sortir le calcul lourd de la file d'attente unique du serveur, pour qu'une vignette qui met 85 ms ne fasse pas attendre tout le reste derriere elle.
- Donner a la galerie une vraie pagination, ou un chargement au fil du defilement. Le plafond de 200 est invisible aujourd'hui parce que l'auteur en a 41 ; il deviendra un mensonge des la centaine suivante, et la carte cible doit prevoir l'endroit ou l'on dit « il y en a 3 300, en voici 200 ».
- Ne construire dans la page que les tuiles qu'on regarde. A 3 300 images le report de chargement des images ne suffira plus : ce sont les 40 000 elements de page qui pesent.
- Choisir un perimetre et un seul par ecran. Si la galerie est celle du jeu ouvert, alors le pied ne doit pas compter les autres, et l'en-tete « Projet » ne doit pas afficher la depense des cinq autres. Si au contraire on veut un endroit qui regarde par-dessus les jeux, il faut le dire et le nommer — mais pas les deux dans la meme colonne.
- Fermer les deux fuites : un lot d'un autre jeu ne doit pas rester dans la grille quand on change de projet, et un dossier partage ne doit pas faire tomber le filtre de projet.
- Retirer du filtre par famille les trois valeurs qui ne peuvent rien rendre, ou bien les faire fonctionner. Et faire en sorte que ce filtre-la compte comme un filtre, pour que la grille vide propose « retirer le filtre » au lieu d'annoncer une bibliotheque vide.
- Ne rien demander au serveur avant de savoir quel jeu est ouvert : c'est la moitie des appels du demarrage qui disparait, dont 143 Ko de donnees de personnages que la galerie n'utilise pas.
- La galerie garde un metier propre — c'est le domicile des 44 % d'images qui n'appartiennent a aucune chose du jeu, et le seul endroit qui sache chercher, exporter, importer et agir sur plusieurs images a la fois. Ce que le Codex fait mieux, c'est montrer une image A SA PLACE dans la structure du jeu. Le partage naturel : le Codex range par ce que la chose est, la galerie range par ce que l'image est devenue.
- Faire beneficier le Codex du meme travail : sa liste d'entites et sa matrice de poses tirent encore les fichiers entiers, vingt fois plus lourds que necessaire.

---

<a id="lecture-8"></a>

## 8 · L'écran d'un personnage : un tableur de six lignes là où l'auteur attend une fiche

L'écran qui s'ouvre quand on clique le pèlerin n'est pas une fiche de personnage : c'est un tableau de production, six lignes, une par attitude, dont chacune répète le même bouton qui prépare une dépense. Ce que l'auteur réclame — le portrait, le nom en grand, un menu de réglages — existe déjà, entièrement écrit, mais dans un autre écran caché derrière un lien de 10 pixels appelé « sa fiche › ». Les trois chiffres qu'il cite viennent d'une planche découpée dont plus rien n'est visible à l'écran : « case 2 » désigne une case d'une feuille disparue, et « dérive 1.00× » dit « rien à signaler » sur 64 des 70 images du dépôt qui la portent. Le vide est mesurable : à 2560 × 1440, chaque rangée offre 1923 px de large pour poser des images, et un personnage neuf y écrit « rien encore », soit 97 % de la voie vide, pendant que 64 % de la hauteur de la colonne reste blanche sous la dernière rangée. Enfin le menu vers les objets ne peut pas filtrer sur ce que le personnage porte, parce que le produit n'enregistre nulle part qu'un personnage porte une pièce : il le déduit après coup des images déjà fabriquées.

### Ce que vaut la plainte de l’auteur, sur cette surface

> Exact sur les quatre points, et en dessous de la réalité sur deux d'entre eux. Le vide : il est plus grand qu'il ne le dit — 97 % de chaque voie d'images et près des deux tiers de la hauteur de la colonne, et sur un jeu qui déclare des directions la matrice passerait à trente rangées vides qui ne tiendraient plus dans l'écran. Les indicateurs : la chaîne qu'il cite de mémoire est mot pour mot celle de sa rangée « attaque », et il a raison de la trouver incompréhensible — « case 2 » désigne une planche que rien ne montre, « dérive 1.00× » dit « rien à signaler » sur 91 % des images concernées, et aucun des trois mots n'a d'explication au produit. Le menu vers les objets : « à peine distinguable » est littéral — 1,04 pour 1 entre la pastille et le fond — et sa seconde moitié, « je n'ai même pas décidé si ce personnage a cet objet », est plus juste qu'il ne le croit : il ne peut pas le décider, le produit n'a aucun endroit où l'enregistrer. Ce qu'il attend enfin — le portrait, le nom, un menu de réglages — n'est pas à concevoir : c'est FicheChose.tsx, écrit, soigné, avec son sommaire de cinq entrées et son portrait de 96 px, et il est caché derrière un lien de dix pixels sur l'écran même dont il se plaint.

### Les surfaces examinées

#### L'établi d'une chose du jeu — l'écran entier

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (EcranEtabli, l.149-461 ; Fiche, l.938-1055)`

**À quoi ça sert** — Voir ce qui manque à ce personnage et lancer la fabrication de ce qui manque.

**Ce que ça porte** — Deux colonnes seulement (l.1013 : `grid-cols-[300px_minmax(0,1fr)]`) : à gauche 300 px d'identité, à droite tout le reste. Au pied, la barre qui paie. La plus grosse chose de l'écran est le champ du nom, en 15 px (l.1333) ; tout le reste est en 11,5 px ou moins. Aucune image du personnage nulle part : les seules images sont les vignettes de 44 px posées dans les rangées (l.2406). Le seul accent de couleur est le cyan, et il ne sert que les liens qui préparent une dépense ou qui changent d'écran.

**Comment on y arrive** — Depuis le Codex, en cliquant la carte du personnage. L'établi remplace entièrement le codex — la colonne des rubriques disparaît (App.tsx l.2839 et l.2876 : les deux écrans s'excluent).

**Comment on en sort** — Par le fil du bandeau haut (44 px). Rien sur la surface elle-même ne dit comment remonter.

**Les défauts** :

- Aucun point d'ancrage visuel : pas de portrait, pas de nom en grand, pas de phrase qui dise qui est ce personnage. Le nom n'existe qu'en 15 px, dans un champ éditable qu'on peut effacer par mégarde.
- Les cinq autres écrans que ce personnage possède (sa fiche, la vitrine, le calibrage, la planche, les tables) sont tous atteignables d'ici, mais par des liens de 10 px alignés sur une seule ligne (l.1338-1388) où « Supprimer » voisine les trois autres.
- Le commentaire en tête du fichier annonce « deux colonnes, 380 px · 1fr » (l.9-12) ; le code en pose 300.

#### La colonne de gauche — l'identité (300 px)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (Identite, l.1241-1520 ; Sortie, l.1074-1168)`

**À quoi ça sert** — Écrire une fois pour toutes ce qui repart avec chaque image payée : le nom, le signalement, le type d'objet, l'ambiance.

**Ce que ça porte** — Le nom (champ de 15 px), une rangée de quatre liens de 10 px (« sa fiche › », « la vitrine › », « le calibrage › », « Supprimer »), trois listes déroulantes de 26 px (type d'objet, ambiance, ce qu'elle prend à son ambiance), une zone de texte de 3 à 16 lignes pour le signalement, puis un bloc « Sortir vers le jeu ».

**Comment on y arrive** — Elle est là dès l'ouverture, à gauche.

**Comment on en sort** — Elle ne se replie pas et ne défile pas indépendamment du reste.

**Les défauts** :

- « sa fiche › », qui mène à l'écran que l'auteur dit vouloir, est un lien de 10 px noyé au milieu de trois autres, dont le bouton de suppression.
- Le bloc « Sortir vers le jeu » occupe le bas de la colonne d'un personnage à qui il reste tout à faire ; sur le pèlerin il est actif, parce que ses six attitudes ont un corps.
- Aucune des trois listes déroulantes ne montre ce qu'elle produit : choisir l'ambiance « pelerin » ne montre ni sa palette ni son texte, qui vivent dans un autre onglet.

#### La bande d'onglets « La colonne qu'on lit » — le menu vers les objets

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (Colonnes, l.1170-1210 ; Onglet, l.1211-1240)`

**À quoi ça sert** — Choisir si la matrice montre le corps nu du personnage, ou le corps avec une pièce d'équipement posée dessus.

**Ce que ça porte** — Un intitulé de 11 px, « La colonne qu'on lit », puis une suite de boutons de 26 px de haut et 10 px de texte : « le corps », puis un par pièce du vestiaire du projet. Sur le pèlerin : trois boutons — le corps, Sac de voyage, Épée.

**Comment on y arrive** — Elle est le premier bloc de la colonne de droite, au-dessus de la matrice. Elle n'existe que si le type de la chose peut porter quelque chose (l.1035) et que le projet a au moins une pièce (l.1195).

**Comment on en sort** — En recliquant « le corps ».

**Les défauts** :

- Le bouton inactif se pose en `fond-1` sur une page en `fond-0` : l'écart de contraste entre la pastille et le fond de page est de 1,04 pour 1 — c'est-à-dire invisible. Le bouton actif, en `fond-3`, est à 1,25 pour 1. Le seul indice réel est la couleur du texte, et le texte inactif (`texte-3` sur `fond-1`) est à 3,3 pour 1 en 10 px, sous le seuil d'accessibilité de 4,5.
- Il montre TOUTES les pièces du vestiaire du projet, sans exception : le composant ne reçoit même pas le personnage en paramètre (l.1170-1182). Il ne peut donc pas savoir ce que ce personnage porte.
- L'intitulé « La colonne qu'on lit » ne dit ni ce qu'est une colonne, ni ce qui change quand on en choisit une autre.
- Il est en 11 px `texte-2`, exactement le même dessin que l'intitulé de la matrice 20 px plus bas (« Ce qu'il lui faut ») : deux intitulés identiques pour deux choses qui n'ont rien à voir.

#### La matrice, colonne « le corps » — le cœur de l'écran

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (Cases, l.1526-1893 ; LigneCase, l.1946-2240)`

**À quoi ça sert** — Montrer, attitude par attitude, ce qui est fait et ce qui manque, et armer l'atelier pour ce qui manque.

**Ce que ça porte** — Une rangée par attitude, 52 px de haut minimum (l.2023). De gauche à droite : une case à cocher, le nom de l'attitude sur 110 px (l.2032), une voie élastique pour les images (vignettes de 44 px, ou le texte « rien encore », l.2083), éventuellement deux lignes de chiffres de 9,5 px, un compte « 1 / 1 », parfois « la planche › », toujours « Fabriquer › », toujours « × ». Sous les six rangées, un champ pour ajouter une attitude à ce personnage seul.

**Comment on y arrive** — C'est ce qui occupe la colonne de droite dès l'ouverture.

**Comment on en sort** — On n'en sort pas : c'est l'écran.

**Les défauts** :

- La voie des images fait environ 1923 px de large à 2560 × 1440, et un personnage neuf y écrit neuf lettres — « rien encore », environ 60 px. 97 % de la voie est vide, six fois de suite.
- Le pèlerin réel, à mi-parcours, y pose six vignettes de 44 px : 11 616 px² d'image dans une colonne d'environ 2,7 millions de px², soit 0,4 %.
- Sous la dernière rangée, environ 773 px de colonne restent vides à 1440 de haut, soit 64 % de sa hauteur.
- Le geste réel de l'écran — cliquer « Fabriquer › » — est répété six fois à l'identique, en 10 px, tout à droite, à 1900 px du nom de l'attitude auquel il se rapporte.
- La case à cocher de chaque rangée sert un bouton (« Fabriquer ensemble ›», l.1835) qui n'apparaît qu'à partir de deux cases cochées : le contrôle est visible 100 % du temps pour un geste indisponible la plupart du temps.
- Le compte passe au vert dès la première image, parce qu'une attitude en réclame une par défaut (atelier/domaine/plan.py l.75). Le pèlerin affiche donc six comptes verts « 1 / 1 » alors qu'il a huit images rangées nulle part et deux pièces à peine commencées.
- Huit de ses dix-huit images ne portent aucune attitude : elles n'apparaissent dans aucune rangée, et rien à l'écran ne dit qu'elles existent.

#### La matrice, colonne d'une pièce (Sac de voyage, Épée)

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (LigneCalque, l.2448-2545)`

**À quoi ça sert** — Montrer, attitude par attitude, ce que la pièce a donné une fois posée sur le corps, et proposer de l'habiller.

**Ce que ça porte** — Les mêmes six rangées de 52 px, mais le bouton devient « Habiller › », et deux lignes de chiffres apparaissent à droite : « repeint 0,8 % · ajout 4,2 % », « échelle 0,96× · calque », et parfois « à regarder · 0,37 ». Un sélecteur « par attitude / par le pire » apparaît en haut à droite (l.1706-1716).

**Comment on y arrive** — En cliquant un nom de pièce dans la bande d'onglets décrite plus haut.

**Comment on en sort** — En recliquant « le corps ».

**Les défauts** :

- On y arrive sans qu'aucune décision n'ait été prise. Sur le pèlerin, cliquer « Épée » ouvre six rangées qui proposent toutes de fabriquer une épée, alors que rien n'a jamais dit que ce personnage en porte une.
- Cette information n'existe nulle part dans le produit : le fichier du pèlerin (donnees/projets/test-v2/personnages/le-pelerin.json) n'a aucun champ d'équipement, et le serveur l'écrit noir sur blanc — « Rien n'est enregistré ici non plus. C'est l'image qui dit sa case et sa pièce ; une pièce posée se déduit donc des assets » (atelier/services/production.py l.1003-1006). Un personnage ne porte une pièce qu'après qu'on a payé une image le montrant avec.
- Le sélecteur « par attitude / par le pire » n'explique nulle part ce qu'est « le pire ».

#### Les deux lignes de chiffres — « ressemblance 0.37 · case 2 / grille 7 px · dérive 1.00× »

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/Personnages.tsx (MesuresDuLot, l.2724-2749 ; MesuresDuCalque, l.2689-2723)`

**À quoi ça sert** — Dire, sur une image sortie d'une planche découpée en plusieurs cases, si le modèle a redessiné deux fois la même chose et sur quelle finesse de pixel il a peint.

**Ce que ça porte** — Deux lignes de 9,5 px en gris `texte-3`, alignées à droite de la rangée. Ligne 1 : la ressemblance et le numéro de la case jumelle. Ligne 2 : le pas de pixel et la dérive du lot. Une seule explication : une infobulle du navigateur, « mesuré au dépliage du lot — ces chiffres n'empêchent jamais de garder ».

**Comment on y arrive** — Elles apparaissent d'elles-mêmes sur les rangées dont l'image vient d'une planche. La chaîne exacte que cite l'auteur est celle de la rangée « attaque » du pèlerin (ressemblance 0,3695, jumeau 1, grille 7 px, dérive 1,0).

**Comment on en sort** — On ne peut ni les replier, ni les masquer, ni cliquer dessus.

**Les défauts** :

- « case 2 » désigne la deuxième case de la planche d'origine, pas quelque chose de visible ici : les six images du pèlerin viennent de trois planches différentes, éclatées en six rangées, et aucune des trois n'est montrée ni nommée sur cet écran.
- « ressemblance 0.37 » et « dérive 1.00× » s'écrivent avec un point décimal, quand les mesures voisines du même écran s'écrivent avec une virgule (« échelle 0,96× », l.2703).
- Le mot « lot » n'apparaît nulle part ailleurs sur cet écran ; celui qui lit ces chiffres ne sait pas de quoi ils parlent.
- Aucune des trois mesures n'a d'entrée dans le recueil d'explications du produit (interface/src/aide.ts) : le seul texte qui parle de ressemblance est enfoui dans l'infobulle du réglage « variations », dans un autre panneau.

#### La fiche plein cadre — l'écran que l'auteur décrit sans l'avoir vu

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/composants/FicheChose.tsx (FicheDeLaChose, l.133-528)`

**À quoi ça sert** — Tout ce qu'une chose du jeu est, en une page qui défile — et rien n'y coûte d'argent.

**Ce que ça porte** — Trois colonnes (l.275). À gauche, 240 px de sommaire cliquable : cinq entrées de 34 px, chacune avec son état chiffré à droite, plus « le calibrage » et « Fermer la fiche — Échap ». Au milieu, un bandeau d'identité avec le portrait du personnage en 96 px, son nom en 32 px à empattements, son compte de cases et son ambiance (l.348-400) — puis les cinq sections : ce qu'il est, ce qui l'habille (sept textes de style, la taille de pixel, la palette), ses images d'exemple, ce qu'on lui réclame, ce qui est fait. À droite, 380 px de matrice compacte qui bouge pendant qu'on règle.

**Comment on y arrive** — Uniquement par le lien « sa fiche › », 10 px, dans la colonne de gauche de l'établi (Personnages.tsx l.1338-1346).

**Comment on en sort** — Échap, ou le bouton en bas du sommaire.

**Les défauts** :

- C'est très exactement ce que l'auteur réclame — « voir les infos du pèlerin, avoir un menu où je peux choisir de régler des choses » — et c'est en second rideau derrière l'écran qui l'agace.
- Elle ne dit rien de l'équipement du personnage : sa section « ce qui l'habille » parle des sept textes de style, jamais du sac ni de l'épée.
- Elle ne mène pas à la fabrication : elle fait disparaître la barre qui paie (Personnages.tsx l.437). Fiche et travail sont deux écrans qui ne se voient pas.

#### La barre qui paie, au pied de l'établi

`C:/STOCKAGE/PROJET/_DEV/gag2/interface/src/App.tsx (l.2152-2250) ; ChampPrompt.tsx (l.181-331) ; PanneauReglages.tsx (l.155)`

**À quoi ça sert** — Relire le texte qui va partir et payer.

**Ce que ça porte** — Une zone de saisie de 56 px minimum, un bouton Générer, et — quand elle est dépliée — un panneau de réglages qui peut prendre jusqu'à 40 % de la hauteur de la fenêtre (`max-h-[40vh]`, PanneauReglages.tsx l.155), soit 576 px à 1440.

**Comment on y arrive** — Elle est toujours là sur l'établi, sauf quand une des cinq profondeurs s'ouvre.

**Comment on en sort** — Le panneau de réglages se replie par un bouton +/− (App.tsx l.2225).

**Les défauts** :

- Repliée elle prend déjà environ 155 px des 1370 px disponibles ; dépliée, elle et son panneau prennent plus de la moitié de l'écran, sur une surface dont le métier est de montrer ce qui manque.

### Les constats

**FORT — L'écran d'un personnage n'a aucun ancrage visuel : ni portrait, ni nom en grand. Sa plus grosse typographie est le champ éditable du nom.**

- *Le chiffre* : 15 px, contre 32 px à empattements et un portrait de 96 px sur la fiche
- *La preuve* : Personnages.tsx l.1333 (`text-[15px]`) ; FicheChose.tsx l.360 (portrait 96 px) et l.382 (`font-serif text-[32px]`)

**BLOQUANT — Ce que l'auteur réclame existe, complet, dans un écran qui n'est atteignable que par un lien de dix pixels, posé au milieu de trois autres dont le bouton de suppression.**

- *Le chiffre* : lien de 10 px, quatrième d'une rangée de quatre
- *La preuve* : Personnages.tsx l.1338-1346 (« sa fiche › ») et l.1380-1389 (« Supprimer ») ; FicheChose.tsx l.275-528

**FORT — La voie où vont les images fait presque deux mille pixels de large et un personnage neuf n'y écrit que deux mots.**

- *Le chiffre* : 1923 px de voie à 2560×1440, remplis par environ 60 px de texte — 97 % de vide, six fois
- *La preuve* : Calcul sur les largeurs fixes de la rangée : Personnages.tsx l.1013 (colonne gauche 300 px), l.2023 (`gap-3 px-1`), l.2032 (nom 110 px), l.2083 (« rien encore »)

**FORT — Sous la dernière attitude, la colonne reste vide sur près des deux tiers de sa hauteur.**

- *Le chiffre* : environ 442 px de contenu dans une colonne d'environ 1215 px — 773 px vides, 64 %
- *La preuve* : App.tsx l.2308 (bandeaux de 44 et 26 px) ; Personnages.tsx l.2023 (rangées de 52 px, six rangées) ; ChampPrompt.tsx l.182-331 (barre du pied, environ 155 px repliée)

**FORT — Sur un jeu qui déclare des directions — six vues sur huit en déclarent — la même matrice explose en trente rangées et ne tient plus dans l'écran, toutes vides et toutes munies d'un bouton qui prépare une dépense.**

- *Le chiffre* : 6 attitudes × 4 directions + 6 = 30 rangées × 53 px = 1590 px, soit 375 px de plus que la colonne ; 36 boutons de fabrication
- *La preuve* : atelier/domaine/vue.py l.244-... (quatre vues à 4 directions, deux à 2) ; Personnages.tsx l.2232-2247 (sous-rangées) et l.2340 (« Fabriquer › » par direction)

**FORT — « case 2 » renvoie à une case d'une planche que rien à l'écran ne montre : les images du pèlerin viennent de trois planches distinctes, éclatées en six rangées séparées.**

- *Le chiffre* : 3 planches d'origine pour 6 rangées ; 0 mention de la planche sur l'écran
- *La preuve* : Personnages.tsx l.2741 (`case ${lot.jumeau + 1}`) ; données : les six corps du pèlerin portent trois pas de grille différents (10, 7, 7, 7, 10 et aucun) — donnees/atelier.sqlite3, table assets

**FORT — « dérive » ne dit rien dans l'immense majorité des cas : c'est une mesure du lot entier, recopiée à l'identique sur chaque image qui en vient.**

- *Le chiffre* : 64 des 70 images qui la portent affichent « dérive 1.00× », soit 91 %
- *La preuve* : Personnages.tsx l.2745 ; comptage sur donnees/atelier.sqlite3 (166 images vivantes, 70 avec des mesures de lot, valeurs de dérive : 1,00 × 64, 1,14 × 4, 1,15 × 2)

**MOYEN — « ressemblance » ne signale un vrai problème — une pose peinte deux fois — que dans une poignée de cas, mais elle s'écrit sur toutes les rangées.**

- *Le chiffre* : 2 images sur 70 dépassent 0,99 ; les 68 autres affichent un nombre sans conséquence
- *La preuve* : Comptage sur donnees/atelier.sqlite3 ; le seuil de fait est écrit dans atelier/domaine/asset.py l.179 (« ressemblance et dérive s'affichent et laissent l'auteur décider ») et dans interface/src/api.ts l.815-819

**FORT — Ces trois mesures n'ont aucune explication au point où elles s'affichent : ni entrée dans le recueil du produit, ni infobulle maison, seulement une bulle du navigateur.**

- *Le chiffre* : 0 entrée dans aide.ts sur 74 entrées existantes
- *La preuve* : Personnages.tsx l.2736-2739 (attribut `title` seul, sans `useInfobulle`) ; interface/src/aide.ts, aucune clef pour ressemblance, grille ou dérive

**MOYEN — La moitié des rangées n'affiche aucun chiffre du tout, l'autre moitié en affiche quatre : la colonne de mesures apparaît et disparaît d'une ligne à l'autre.**

- *Le chiffre* : 96 des 166 images vivantes (58 %) ne portent aucune mesure de lot
- *La preuve* : Personnages.tsx l.2733-2734 (`if (!lot) return null`) ; comptage sur donnees/atelier.sqlite3

**FORT — Le menu vers les objets est presque invisible : sa pastille se distingue à peine du fond de page, et son texte passe sous le seuil de lisibilité.**

- *Le chiffre* : 1,04 pour 1 entre la pastille inactive et le fond ; 1,25 pour 1 pour la pastille active ; texte inactif à 3,3 pour 1 en 10 px (seuil 4,5)
- *La preuve* : Personnages.tsx l.1224-1232 (`bg-fond-1 text-texte-3` / `bg-fond-3 text-texte`) ; interface/src/index.css l.13-22 (fond-0 #0b0d10, fond-1 #111419, fond-3 #1e242b, texte-3 #5e6771)

**BLOQUANT — Le menu montre toutes les pièces du vestiaire du projet, sans exception, parce qu'il ne peut pas faire autrement : le composant ne reçoit pas le personnage.**

- *Le chiffre* : 3 onglets sur le pèlerin (le corps, Sac de voyage, Épée) pour 2 pièces au projet ; aucun filtre
- *La preuve* : Personnages.tsx l.1170-1206 : les paramètres sont `emplacements, pieces, colonne, onColonne` — le personnage n'y figure pas

**BLOQUANT — Le produit n'enregistre nulle part qu'un personnage porte une pièce. Il le déduit après coup des images déjà payées.**

- *Le chiffre* : 0 champ d'équipement dans le fichier d'un personnage
- *La preuve* : donnees/projets/test-v2/personnages/le-pelerin.json (16 champs, aucun sur l'équipement) ; interface/src/api.ts l.1057-1119 (type Personnage) ; atelier/services/production.py l.1003-1006 : « Rien n'est enregistré ici non plus. C'est l'image qui dit sa case et sa pièce »

**FORT — Ouvrir la colonne « Épée » propose d'habiller les six attitudes du pèlerin, parce que ses six attitudes ont un corps — rien ne demande d'abord si ce personnage porte une épée.**

- *Le chiffre* : 6 boutons « Habiller › » proposés, 1 image d'épée existante
- *La preuve* : Personnages.tsx l.2469 (`habillable = Boolean(case_?.corps)`) et l.2530-2542 (le bouton n'est conditionné que par la présence d'un corps) ; donnees/atelier.sqlite3 : le pèlerin a 6 corps et 1 image portant `piece = epee`

**FORT — La matrice affiche six comptes verts sur un personnage à peine entamé, parce qu'une attitude ne réclame qu'une image par défaut.**

- *Le chiffre* : 6 comptes « 1 / 1 » en vert, pour 18 images dont 8 rangées nulle part
- *La preuve* : atelier/domaine/plan.py l.75 (`images: int = 1`) ; Personnages.tsx l.77-82 (faitesDeLaCase) et l.2110-2113 (`faite ? "text-ok"`) ; donnees/atelier.sqlite3

**FORT — Huit des dix-huit images du pèlerin ne portent aucune attitude et n'apparaissent donc dans aucune rangée : elles sont invisibles sur son écran.**

- *Le chiffre* : 8 images sur 18, soit 44 %
- *La preuve* : donnees/atelier.sqlite3, table assets, colonne contenu (`pose` nul) ; Personnages.tsx l.1591 (les rangées se construisent sur `personnage.cases`, indexées par attitude)

**MOYEN — Le geste principal de l'écran — préparer une fabrication — est répété une fois par rangée, en dix pixels, tout à droite, très loin du nom de l'attitude auquel il se rapporte.**

- *Le chiffre* : environ 1900 px entre le nom de l'attitude et son bouton, à 2560 de large
- *La preuve* : Personnages.tsx l.2032 (nom, 110 px à gauche) et l.2138-2147 (« Fabriquer › », dernier avant la croix)

**MOYEN — La barre qui paie mange le bas de l'écran même quand on ne fabrique rien, et son panneau de réglages peut prendre 40 % de la fenêtre.**

- *Le chiffre* : environ 155 px repliée, jusqu'à 576 px de panneau à 1440 de haut
- *La preuve* : ChampPrompt.tsx l.182-331 ; PanneauReglages.tsx l.155 (`max-h-[40vh]`) ; App.tsx l.2152-2193

**FAIBLE — Les deux intitulés de la colonne de droite ont exactement le même dessin, à vingt pixels d'écart, pour deux choses sans rapport.**

- *Le chiffre* : 11 px `texte-2` dans les deux cas, séparés par 20 px
- *La preuve* : Personnages.tsx l.1190 (« La colonne qu'on lit ») et l.1702 (« Ce qu'il lui faut ») ; chassis.tsx l.268 (`text-[11px] text-texte-2`)

**FAIBLE — La case à cocher de chaque rangée sert un geste qui n'apparaît qu'à partir de deux cases cochées.**

- *Le chiffre* : 6 cases à cocher visibles en permanence, 0 bouton associé tant qu'on n'en a pas coché 2
- *La preuve* : Personnages.tsx l.2027-2031 (la case) et l.1817 (`lot.length >= 2` pour faire paraître « Fabriquer ensemble ›»)

**FAIBLE — Les nombres de la ligne « ressemblance » s'écrivent au point décimal quand ceux de la ligne voisine s'écrivent à la virgule.**

- *Le chiffre* : « 0.37 » contre « 0,96 » sur la même surface
- *La preuve* : Personnages.tsx l.2741 et l.2745 (`toFixed(2)` seul) contre l.2703 (`toFixed(2).replace(".", ",")`)

### Ce que cette lecture impose

- L'écran d'accueil d'un personnage est déjà écrit et déjà beau : c'est FicheChose.tsx. La carte cible n'a pas à inventer cet écran, elle a à intervertir les deux — que cliquer le pèlerin ouvre sa fiche, et que la matrice devienne la profondeur qu'on ouvre depuis elle, quand on vient travailler.
- La fiche, en l'état, ne sait pas fabriquer : elle retire la barre qui paie (Personnages.tsx l.437). Si elle devient l'accueil, il faut décider ce qu'on peut lancer depuis elle — sinon on aura simplement inversé les deux moitiés du problème.
- Le menu vers les objets ne peut pas être réparé à l'écran seul. Tant que le produit ne saura pas qu'un personnage porte une pièce, l'écran n'aura rien à filtrer. Cela demande un champ sur le personnage — ou l'aveu assumé que « porter » se déduit des images, et alors l'onglet d'une pièce jamais fabriquée doit se présenter comme une proposition (« lui poser une épée ? »), pas comme une colonne au même rang que le corps.
- Les trois mesures ne sont utiles qu'au moment où quelque chose ne va pas — deux images sur soixante-dix pour la ressemblance, six sur soixante-dix pour la dérive. Elles ne devraient paraître que quand elles ont quelque chose à dire, comme un signalement, et jamais comme une colonne permanente.
- « case 2 » ne peut rester que si l'écran montre aussi la planche dont il parle. Sinon il faut soit nommer le jumeau par son attitude (« ressemble à dégâts »), soit retirer la mention.
- Le compte vert ment : une attitude est déclarée complète dès la première image. La carte cible doit décider ce que « fait » veut dire pour un personnage — six corps, ou six corps plus les pièces qu'il porte plus les directions déclarées — parce que c'est ce chiffre-là qui doit tenir le haut de l'écran d'accueil.
- Il faut une place pour les images orphelines : huit des dix-huit images du pèlerin ne sont dans aucune case et n'existent nulle part sur son écran.
- La largeur est disponible, elle n'est pas utilisée : près de deux mille pixels par rangée et les deux tiers de la hauteur de la colonne. Une disposition qui montre le personnage en grand, ses attitudes en vignettes plutôt qu'en lignes de tableur, et son équipement à côté, tient dans cette place sans rien retirer.

---

<a id="diagnostic"></a>

# II — Le diagnostic

Les huit lectures donnent quatre causes, et aucune n'est un problème de goût. **Un.** Il n'y a pas de porte d'entrée. L'application s'ouvre sur le rangement — l'onglet Galerie (App.tsx:249) — et le seul endroit du produit où l'on choisit un jeu est une petite section « Projets » dans la colonne de gauche de cette Galerie (Arbre.tsx:96-156). Les deux autres onglets travaillent entièrement sur ce jeu sans pouvoir ni le nommer ni en changer. Un parcours sans début n'a pas d'ordre : chaque écran est un commencement, et rien ne dit ce qui vient après. **Deux.** Les rangées mentent sur ce qu'elles ouvrent. Les sept rangées de la colonne du Codex se ressemblent, mais quatre ouvrent une liste de choses et trois ouvrent un formulaire de réglage (Codex.tsx:245-265) ; le fil d'Ariane écrit « Cœur de pierre › Les directions » exactement comme « Cœur de pierre › Personnages ». Et sur les sept rangées, les deux qui ne sont pas des familles occupent 139 px de hauteur contre 130 px pour les cinq familles réunies. Un menu dont les entrées ne tiennent pas leur promesse détruit la logique plus sûrement qu'un écran laid. **Trois.** Chaque écran répond à une question qu'on ne lui a pas posée. On clique un personnage pour le voir, on obtient un tableau de production de six lignes : 97 % de la voie d'images vide sur un écran large, 64 % de la colonne blanche sous la dernière ligne, et six boutons qui préparent une dépense. L'écran qui répond à la question posée existe pourtant, entier et soigné — portrait de 96 px, nom en 32 px, sommaire de cinq entrées (FicheChose.tsx:275-528) — et il est caché derrière un lien de 10 px posé à côté du bouton Supprimer. Le produit a écrit la bonne réponse et l'a rangée au second rideau. **Quatre, et c'est celle qui fait dire « ni lien ni logique ».** Le même écran se contredit lui-même. La question « où en est cette chose » est calculée par trois formules différentes dans deux fichiers ; sur Le pèlerin, la colonne de droite affiche huit lignes vertes puis, quarante pixels plus bas, « 9 cases à fabriquer » avec le bouton grisé au motif que « rien ne manque ». Deux de ses trois lignes ne peuvent pas dire autre chose que « complet » : l'une est verte écrite en dur (Codex.tsx:853-859), l'autre compte des poses non écartées et non des images — sur les douze choses des six projets du dépôt, la liste des poses écartées est vide partout. Même mécanique dans la Galerie : trois compteurs pour trois périmètres différents à l'écran en même temps — 41 images, 166 assets, 1,5281 $ pour un jeu qui a coûté 0,20 $. Quand deux endroits d'un même écran se contredisent, on cesse de croire l'écran entier. **À quoi s'ajoutent deux faits de place.** Le bandeau qui paie est monté sur les sept rubriques du Codex sans condition (Codex.tsx:285) : 205 px replié à vide, 268 px dès qu'une case est visée, 637 px avec le vrai catalogue de 49 modèles — soit de 20 % à 63 % de la hauteur utile, y compris sur les deux écrans où rien ne peut se fabriquer. Et l'ensemble compte 42 surfaces sur cinq niveaux, dont une injoignable (la découpe depuis la Galerie, jamais ouverte par personne), une sans porte de sortie (les Tables, ni bouton fermer ni Échap), quatre absentes du fil d'Ariane, deux écrans homonymes appelés « Réglages », deux composants nommés « FicheDeLaChose » qui répondent à la même question, et deux journaux de dépenses ratées dont l'un a été écrit pour remplacer l'autre. La plainte de l'auteur est exacte sur cinq points et en dessous de la réalité sur quatre.

---

<a id="carte"></a>

# III — La carte proposée *(non validée)*

> ⚠️ **Elle n’a pas été retenue en l’état.** Les relectures de la partie IV lui reprochent de
> répondre au « manque de lien » sans répondre à la « complexité » — le produit en sortirait avec
> **plus** d’écrans qu’il n’en a — et de casser trois règles écrites. Elle est consignée parce que
> son inventaire écran par écran est juste, et qu’il servira quelle que soit la carte retenue.

| # | Écran | Statut | Rôle |
|---|---|---|---|
| 1 | **L'accueil — sur quel jeu travaille-t-on** | neuf | Le premier écran : la liste des jeux, chacun avec son image, son nombre de choses et sa dépense, et un champ pour en commencer un nouveau. |
| 2 | **La barre du haut** | existe et change | Dire où l'on est et donner accès au reste : le nom du jeu, trois onglets, le fil qui dit la profondeur, la dépense, l'atelier et le guide. |
| 3 | **L'Univers — la toile du jeu** | existe et change | L'écran d'arrivée d'un jeu : les images qui l'inspirent, posées à la main, groupées en paquets, reliées par des traits — la carte mentale du monde. |
| 4 | **L'Univers — la vue en grille** | existe et reste | La même matière vue en planche contact, pour coller vite et tout voir d'un coup. |
| 5 | **L'Univers — la colonne d'une carte** | neuf | Quand on choisit une image d'inspiration : son visuel en grand et tous ses réglages, à un seul endroit. |
| 6 | **L'Univers — découper une carte** | existe et reste | Couper une image trouvée en plusieurs morceaux, quand elle contient trois personnages et un fond. |
| 7 | **L'Univers — les règles du jeu** | fusionne | Tout ce que le jeu est et tout ce qu'il impose à tout le monde : son nom, son style, la façon dont il regarde le monde et les directions qui en découlent, la taille du pixel, l'allure, les références et les couleurs, la liste des attitudes, les emplacements du corps. |
| 8 | **L'Univers — ambiances et couleurs** | existe et change | Dire une fois ce qu'un coin du jeu a de différent — le marais plus gris, les monstres plus froids — et s'en servir autant de fois qu'on veut. |
| 9 | **Le Codex — la colonne « Ce que le monde contient »** | existe et change | Choisir ce qu'on regarde : une des cinq familles de choses du jeu, et rien d'autre. |
| 10 | **Le Codex — la liste d'une famille** | existe et change | Voir les choses d'une famille, une par ligne avec son image, et en créer de nouvelles en écrivant un nom. |
| 11 | **Le Codex — le vestiaire** | se scinde | Voir en images ce que le jeu permet de porter — un casque, une épée, une cape — une pièce par ligne, comme les personnages. |
| 12 | **La fiche d'une pièce d'équipement** | neuf | Une pièce en grand : à quoi elle ressemble sur les corps où elle est apparue, où elle s'accroche, ce qu'elle envoie au modèle, et qui la porte. |
| 13 | **L'accueil d'une chose (la fiche)** | existe et change | Ce qu'on voit quand on clique un personnage : son portrait, son nom en grand, ce qu'il est, ce qui l'habille, ses exemples, ce que le jeu lui réclame, où il en est — et par où continuer. |
| 14 | **L'établi d'une chose** | existe et change | La profondeur où l'on fabrique : case par case, ce qui est fait et ce qui manque, et de quoi lancer ce qui manque. |
| 15 | **L'établi — la colonne d'équipement** | existe et change | Voir la même chose habillée d'une pièce, pose par pose, et proposer de l'habiller. |
| 16 | **L'atelier du calque** | fusionne | Le seul endroit où l'on fabrique et répare une pièce posée sur un corps : choisir les deux images, les caler, grossir, retoucher à la main. |
| 17 | **La planche d'une pose** | existe et reste | Voir ce qu'on achète avant de payer : combien de cases, ce qui est écrit dans chacune, le prix. |
| 18 | **Le calibrage** | existe et reste | Mettre toutes les poses d'une chose à la même hauteur en les empilant dans une seule case. |
| 19 | **La vitrine** | existe et reste | Voir en grand, à la même échelle et sur le fond que le jeu décrit, soit toutes les poses d'une chose, soit toutes les choses du monde. |
| 20 | **Commander un clip** | neuf | Demander une petite vidéo d'un personnage en mouvement, chez un fournisseur ou sur la carte graphique de la maison. |
| 21 | **Le montage d'un clip** | neuf | Regarder le clip tourner et y prendre, image par image, les animations qu'on veut garder. |
| 22 | **Les tables de retouche** | existe et change | Retoucher une image sans rien repayer : détourer, recadrer, ramener sur la grille et sur la palette, retoucher à la main, découper, superposer. |
| 23 | **Le dépliage d'une planche** | existe et change | Choisir ce qu'on garde d'une feuille multi-images qui vient d'arriver, avant qu'elle entre en bibliothèque. |
| 24 | **La ligne de commande (ce qui reste de la barre qui paie)** | se scinde | Une seule ligne au pied des écrans qui fabriquent : ce qu'on demande, le prix attendu, et le bouton. |
| 25 | **L'écran « Ce qui part »** | existe et change | Relire mot pour mot ce qui va partir, image jointe par image jointe, régler l'appel, voir le prix, et payer. |
| 26 | **Choisir une image de référence** | existe et reste | Ajouter une image jointe sans quitter l'écran de confirmation. |
| 27 | **La galerie** | existe et change | Le domicile de toutes les images du jeu ouvert : chercher, ranger, comparer, exporter, importer — et n'y payer jamais rien. |
| 28 | **La fiche d'une image** | existe et reste | Dire ce qu'une image est, d'où elle vient, ce qui l'a fabriquée, et où la reprendre. |
| 29 | **Les dépenses** | fusionne | La seule liste de tout ce qui a été payé : chaque appel, ce qu'il a coûté, ce qu'il a donné, et de quoi relancer ce qui a raté. |
| 30 | **L'atelier (ex-Réglages)** | existe et change | Ce qui ne concerne aucun jeu : les clés des fournisseurs, les garde-fous de l'agent, les dossiers de travail. |
| 31 | **Le guide** | existe et reste | La prose du produit : ce que chaque chose veut dire. |
| 32 | **L'aperçu (barre d'espace)** | existe et reste | Tenir une image en grand une seconde par-dessus tout le reste. |
| 33 | **Sortir vers le jeu** | existe et change | La fin du parcours : poser les fichiers d'une chose finie dans le dossier du jeu, avec le descriptif qui nomme chaque image, sa pose et sa pièce. |
| 34 | **La découpe d'une planche atteinte depuis la Galerie** | disparait | Rien : personne ne peut l'ouvrir. |
| 35 | **Le menu au survol d'une carte d'inspiration** | disparait | Régler une carte de la toile. |
| 36 | **Le panneau « La chose choisie » du Codex** | se scinde | Dire, à droite de la liste, ce qui manque à la chose désignée. |

## Le détail, écran par écran

### 1. L'accueil — sur quel jeu travaille-t-on — *neuf*

**Son rôle** — Le premier écran : la liste des jeux, chacun avec son image, son nombre de choses et sa dépense, et un champ pour en commencer un nouveau.

**Ce qu’il reprend** — La section « Projets » de la colonne de gauche de la Galerie (Arbre.tsx:96-156), aujourd'hui le seul endroit du produit où l'on change de jeu, plus le total en dollars de la barre du haut.

**On y arrive par** — C'est ce qui s'ouvre au lancement. Ensuite, en cliquant le nom du jeu dans la barre du haut, depuis n'importe quel écran.

**On en sort par** — En ouvrant un jeu : on tombe sur la toile de son univers. Un jeu qui n'a encore rien ouvre ses règles à la place, à l'étape 1, et on en sort où l'on veut.

**Pourquoi** — C'est la première phrase du modèle cible de l'auteur, et elle n'est câblée nulle part. Aujourd'hui la décision la plus structurante du produit — sur quel jeu on travaille — est un effet de bord d'une colonne de rangement d'images, visible sur un onglet sur trois. Créer l'accueil donne au parcours son point zéro et rend l'ordre des écrans lisible.

### 2. La barre du haut — *existe et change*

**Son rôle** — Dire où l'on est et donner accès au reste : le nom du jeu, trois onglets, le fil qui dit la profondeur, la dépense, l'atelier et le guide.

**Ce qu’il reprend** — BarreChassis.tsx:301-473, sans changement de hauteur ni de composition.

**On y arrive par** — Elle est toujours là.

**On en sort par** — On n'en sort pas.

**Pourquoi** — Trois corrections, pas une refonte. Le nom du jeu devient le bouton qui ramène à l'accueil — c'est ce qui rend le changement de jeu possible depuis les trois onglets au lieu d'un seul. Le fil d'Ariane accueille les quatre écrans plein cadre qui n'y figurent pas aujourd'hui (fiche, vitrine, calibrage, planche), sans quoi la règle « le fil dit où l'on est » reste fausse une fois sur cinq. Et le total en dollars, qui est déjà un bouton, le dit.

### 3. L'Univers — la toile du jeu — *existe et change*

**Son rôle** — L'écran d'arrivée d'un jeu : les images qui l'inspirent, posées à la main, groupées en paquets, reliées par des traits — la carte mentale du monde.

**Ce qu’il reprend** — Toile.tsx et la vue toile du tableau d'inspiration, telles quelles.

**On y arrive par** — En ouvrant un jeu depuis l'accueil, ou par l'onglet Univers.

**On en sort par** — Un autre onglet, ou la bascule vers la vue en grille.

**Pourquoi** — C'est ce que l'auteur décrit comme deuxième étape de son parcours, et c'est le seul écran du produit qui montre le jeu comme un tout. Deux conditions avant d'en faire l'arrivée. D'abord le poids : la toile télécharge aujourd'hui 55 images en pleine taille — 95,3 Mo, 1,77 Mo par carte — pour remplir des cases de 148 px, sans vignette, sans chargement différé et sans mise en cache ; en faire l'accueil sans corriger cela ferait de l'écran d'arrivée le plus lourd du produit. Ensuite le contenu : sur son vrai projet, aucune des 55 cartes n'a de paquet ni de place, tout est dans la réserve — la toile s'ouvrirait blanche. Il faut donc qu'un jeu sans rangement montre autre chose : son artwork officiel, sa palette, ses mots de style.

### 4. L'Univers — la vue en grille — *existe et reste*

**Son rôle** — La même matière vue en planche contact, pour coller vite et tout voir d'un coup.

**Ce qu’il reprend** — Tableau.tsx:420, sans changement.

**On y arrive par** — La bascule de vue, dans la barre de l'onglet.

**On en sort par** — La même bascule.

**Pourquoi** — Elle fait ce que la toile ne fait pas — montrer tout d'un coup d'œil — et le PRD l'a explicitement gardée quand la toile est entrée : « la toile s'ajoute à la grille sans la remplacer ». Elle bénéficie du même allègement d'images.

### 5. L'Univers — la colonne d'une carte — *neuf*

**Son rôle** — Quand on choisit une image d'inspiration : son visuel en grand et tous ses réglages, à un seul endroit.

**Ce qu’il reprend** — Le menu qui s'ouvre aujourd'hui au survol d'une carte, et qui porte jusqu'à 19 commandes sur une vignette de 148 px.

**On y arrive par** — Un clic sur une carte, sur la toile.

**On en sort par** — Un clic ailleurs, ou la croix de la colonne.

**Pourquoi** — Un menu de 19 commandes qui s'ouvre sans qu'on l'ait demandé, sur la surface la plus créative du produit, est la définition d'un écran qui assomme. Cet écran est déjà écrit au plan sous le nom G7. Il porte aussi le geste qui manque le plus : promouvoir une carte en artwork officiel, c'est-à-dire faire entrer une image d'inspiration dans ce qui part au modèle — c'est le seul vrai pont entre l'imaginaire et la fabrication, et c'est aujourd'hui la neuvième ligne d'un menu de survol.

### 6. L'Univers — découper une carte — *existe et reste*

**Son rôle** — Couper une image trouvée en plusieurs morceaux, quand elle contient trois personnages et un fond.

**Ce qu’il reprend** — Decoupe.tsx, sans changement.

**On y arrive par** — Depuis la colonne d'une carte.

**On en sort par** — Bouton fermer, ou Échap — les deux existent déjà.

**Pourquoi** — Un des rares écrans du produit qui n'a aucun défaut relevé par les lectures. On ne le touche pas.

### 7. L'Univers — les règles du jeu — *fusionne*

**Son rôle** — Tout ce que le jeu est et tout ce qu'il impose à tout le monde : son nom, son style, la façon dont il regarde le monde et les directions qui en découlent, la taille du pixel, l'allure, les références et les couleurs, la liste des attitudes, les emplacements du corps.

**Ce qu’il reprend** — L'assistant en douze étapes de Univers › Réglages (Assistant.tsx), plus les deux rubriques « Les directions » et « Leurs poses » retirées de la colonne du Codex (Codex.tsx:978 et Personnages.tsx:463-535), plus le rangement des emplacements du corps.

**On y arrive par** — Le mot « Réglages » de l'onglet Univers, aujourd'hui. Automatiquement sur un jeu qui n'a rien. Et par un chemin court depuis une ligne de pose de l'établi, pour corriger la consigne d'une attitude après avoir vu ce que le modèle a rendu.

**On en sort par** — « J'ai fini pour l'instant », à n'importe quelle étape — rien n'est exigé, c'est un invariant du produit.

**Pourquoi** — C'est la réparation directe du grief. Les directions et les poses ne sont pas des familles du monde, ce sont des règles qui valent pour tout le monde ; et elles ont déjà un logement ici. Les directions se déduisent aujourd'hui de la vue choisie à l'étape 3, elles sont enregistrées dans le bloc « univers » du fichier de projet, et sur six projets du dépôt quatre ne les ont jamais touchées, les deux autres ne les ont pas composées mais réduites. Les poses sont déjà réglables ici, par le même appel serveur — c'est un doublon, pas un rangement. Mais l'étape doit gagner les trois gestes qui n'existent aujourd'hui que dans le Codex : renommer une attitude, corriger sa phrase anglaise, changer son nombre d'images. Sans eux, le déplacement supprimerait des gestes réellement utilisés — un projet du dépôt porte neuf attitudes écrites à la main. Deux étapes s'en vont dans l'autre sens : les clés des fournisseurs, qui ne concernent aucun jeu et existent déjà à l'identique dans l'écran de l'atelier, et le choix des modèles par famille, qui rejoint la fabrication.

### 8. L'Univers — ambiances et couleurs — *existe et change*

**Son rôle** — Dire une fois ce qu'un coin du jeu a de différent — le marais plus gris, les monstres plus froids — et s'en servir autant de fois qu'on veut.

**Ce qu’il reprend** — Ambiances.tsx, sans refonte.

**On y arrive par** — Le troisième mot de l'onglet Univers, comme aujourd'hui. Et, ce qui est neuf, depuis la fiche d'une chose qui désigne son ambiance.

**On en sort par** — Un autre côté, un autre onglet.

**Pourquoi** — C'est le seul vrai atelier de couleur du produit et rien n'y mène : sur les cinq projets du disque, quatre n'ont ni ambiance ni palette, et le seul qui en a est un projet d'essai. La fiche d'une chose affiche son ambiance sans pouvoir l'ouvrir. Une porte, et l'écran cesse d'être mort.

### 9. Le Codex — la colonne « Ce que le monde contient » — *existe et change*

**Son rôle** — Choisir ce qu'on regarde : une des cinq familles de choses du jeu, et rien d'autre.

**Ce qu’il reprend** — Codex.tsx:306-406, amputé de ses deux blocs de réglage.

**On y arrive par** — L'onglet Codex.

**On en sort par** — Elle ne se quitte pas ; elle se replie.

**Pourquoi** — Cinq rangées de 26 px au lieu de sept rangées, deux traits et deux intitulés. La colonne perd 139 px de réglages — plus de place que ses cinq familles réunies — et redevient ce que son titre promet : ce que le monde contient. C'est textuellement la demande de l'auteur, et deux des trois intrus vont dans la même direction que le déplacement décrit plus haut.

### 10. Le Codex — la liste d'une famille — *existe et change*

**Son rôle** — Voir les choses d'une famille, une par ligne avec son image, et en créer de nouvelles en écrivant un nom.

**Ce qu’il reprend** — Codex.tsx:485-578, la liste à cartes.

**On y arrive par** — Un clic sur une famille dans la colonne de gauche.

**On en sort par** — Un clic sur une chose, qui ouvre sa fiche.

**Pourquoi** — Deux corrections. Un seul geste par carte : aujourd'hui le nom descend d'un étage et le reste de la carte ne fait que désigner — deux gestes très différents dans le même rectangle, sans rien qui les distingue à l'œil. Et la vignette prend l'image que l'atelier retiendrait à l'export, pas la première image du premier bloc rempli.

### 11. Le Codex — le vestiaire — *se scinde*

**Son rôle** — Voir en images ce que le jeu permet de porter — un casque, une épée, une cape — une pièce par ligne, comme les personnages.

**Ce qu’il reprend** — L'écran actuel de la rubrique Équipement (Personnages.tsx:655-780), qui se coupe en deux : la liste illustrée ici, les réglages de chaque pièce dans sa fiche.

**On y arrive par** — La cinquième famille de la colonne de gauche du Codex.

**On en sort par** — Un clic sur une pièce, qui ouvre sa fiche.

**Pourquoi** — C'est le grief mot pour mot : « pas de liste des équipements, mais des paragraphes de texte ». Le compte est de 0 image, 15 contrôles et une vingtaine de blocs de texte pour deux pièces, dont une zone de saisie pleine largeur par pièce — l'écran a été écrit pour une colonne de 240 px, son commentaire d'origine dit « ni vignette, ni recherche », et il est aujourd'hui affiché dans la colonne du milieu, quatre fois plus large. Et ce n'est pas un manque de données : 10 images de la base portent une pièce, les 4 pièces déclarées en ont chacune au moins une, et l'écran les a déjà en mémoire quand il dessine ce formulaire — aucun appel réseau de plus n'est nécessaire.

### 12. La fiche d'une pièce d'équipement — *neuf*

**Son rôle** — Une pièce en grand : à quoi elle ressemble sur les corps où elle est apparue, où elle s'accroche, ce qu'elle envoie au modèle, et qui la porte.

**Ce qu’il reprend** — Les quatre contrôles par pièce du vestiaire actuel — nom, emplacement, portée, description — plus la ligne « posée sur N personnages ».

**On y arrive par** — Un clic sur une pièce dans le vestiaire.

**On en sort par** — Échap, ou le bouton fermer.

**Pourquoi** — Ce sont quatre décisions qu'on prend une fois par pièce ; les laisser dans la liste, c'est ce qui fabrique les quatre contrôles par ligne et l'effet « du texte, du texte, encore du texte ». Une pièce n'a par construction aucune image à elle — le serveur refuse de la fabriquer sur fond vide — mais cette règle porte sur la fabrication et non sur l'affichage : le produit montre déjà ces images ailleurs, dans l'établi d'un personnage.

### 13. L'accueil d'une chose (la fiche) — *existe et change*

**Son rôle** — Ce qu'on voit quand on clique un personnage : son portrait, son nom en grand, ce qu'il est, ce qui l'habille, ses exemples, ce que le jeu lui réclame, où il en est — et par où continuer.

**Ce qu’il reprend** — FicheChose.tsx:133-528, écran déjà écrit, déjà soigné, aujourd'hui caché derrière un lien de 10 px.

**On y arrive par** — Un clic sur une chose dans la liste du Codex. C'est le renversement central de cette carte.

**On en sort par** — Échap remonte à la famille. Un bouton, en clair et non en lien de 10 px, descend à l'établi pour fabriquer.

**Pourquoi** — C'est très exactement ce que l'auteur réclame — « voir les infos du pèlerin, avoir un menu où je peux choisir de régler des choses » — et il n'y a rien à concevoir : cet écran existe, avec son portrait de 96 px, son nom en 32 px et son sommaire de cinq entrées. Il suffit d'intervertir les deux rangs. Trois conditions. La fiche doit dire l'équipement du personnage, dont elle ne parle pas aujourd'hui. Elle doit mener aux ambiances. Et son chiffre de tête doit être vrai : sa matrice compare aujourd'hui le nombre d'images au nombre d'étapes d'une pose au lieu du nombre réellement attendu — sur un jeu à quatre directions elle affiche « 4 / 4 » en vert là où seize images sont attendues, au-dessus de son propre total qui dit « 1 / 6 ».

### 14. L'établi d'une chose — *existe et change*

**Son rôle** — La profondeur où l'on fabrique : case par case, ce qui est fait et ce qui manque, et de quoi lancer ce qui manque.

**Ce qu’il reprend** — La matrice de Personnages.tsx:1526-2240, qui cesse d'être l'écran d'accueil d'un personnage.

**On y arrive par** — Un bouton en clair depuis la fiche de la chose. Et directement depuis la liste d'une famille par le compte « N cases manquantes », qui devient une porte.

**On en sort par** — Échap remonte à la fiche, et le fil d'Ariane la nomme.

**Pourquoi** — Quatre corrections mesurées. La voie où vont les images fait 1923 px de large et un personnage neuf y écrit deux mots : les attitudes deviennent des vignettes, pas des lignes de tableur — d'autant qu'un jeu à quatre directions passerait la matrice actuelle à 30 rangées de 53 px, soit 375 px de plus que la colonne ne peut montrer, toutes vides et toutes munies d'un bouton qui prépare une dépense. Les mesures techniques que l'auteur cite — « ressemblance 0.37 · case 2 · grille 7 px · dérive 1.00× » — ne paraissent que lorsqu'elles ont quelque chose à dire : sur les 70 images du dépôt qui les portent, 64 affichent « dérive 1.00× » qui veut dire « rien à signaler », et 2 seulement dépassent le seuil de ressemblance ; les 96 autres images n'en portent aucune, si bien que la colonne apparaît et disparaît d'une ligne à l'autre. Le compte cesse de passer au vert dès la première image. Et les huit images sur dix-huit du pèlerin qui ne portent aucune attitude — 44 % — trouvent une place au lieu d'être invisibles.

### 15. L'établi — la colonne d'équipement — *existe et change*

**Son rôle** — Voir la même chose habillée d'une pièce, pose par pose, et proposer de l'habiller.

**Ce qu’il reprend** — La bande « La colonne qu'on lit » (Personnages.tsx:1170-1240) et les lignes de calque.

**On y arrive par** — Une bande d'onglets contre la matrice, lisible.

**On en sort par** — Retour à la colonne du corps.

**Pourquoi** — Deux défauts, dont un que l'auteur nomme. Le menu est « à peine distinguable » au sens littéral : 1,04 pour 1 de contraste entre la pastille éteinte et le fond de page, et un texte de 10 px à 3,3 pour 1, sous le seuil. Et sa seconde moitié — « je n'ai même pas décidé si ce personnage a cet objet » — est plus juste qu'il ne le croit : il ne peut pas le décider, parce que le produit n'enregistre nulle part qu'un personnage porte une pièce ; il le déduit après coup des images déjà payées. Tant que ce n'est pas tranché, une pièce jamais fabriquée doit se présenter comme une proposition — « lui poser une épée ? » — et non comme une colonne au même rang que le corps.

### 16. L'atelier du calque — *fusionne*

**Son rôle** — Le seul endroit où l'on fabrique et répare une pièce posée sur un corps : choisir les deux images, les caler, grossir, retoucher à la main.

**Ce qu’il reprend** — Les trois coins qui font ce travail aujourd'hui sans se ressembler : la planche d'équipement, la carte d'un vêtement et sa zone, et la table de superposition. La maquette est dessinée et attend l'arbitrage de l'auteur.

**On y arrive par** — Un calque de la matrice d'équipement.

**On en sort par** — Échap, retour à l'établi.

**Pourquoi** — C'est le mot de l'auteur du 4 septembre — « ce n'est pas trop logique ni bien organisé cette partie du workflow » — et le relevé lui donne raison : aucun des trois coins n'a de grossissement, l'un a la main sans le choix des images, l'autre le choix et le calage sans la main, et pour faire le travail en entier il faut passer de l'un à l'autre sans que rien ne dise qu'ils se complètent.

### 17. La planche d'une pose — *existe et reste*

**Son rôle** — Voir ce qu'on achète avant de payer : combien de cases, ce qui est écrit dans chacune, le prix.

**Ce qu’il reprend** — Planche.tsx, sans refonte.

**On y arrive par** — Une ligne de pose de l'établi qui a plusieurs directions.

**On en sort par** — Échap, ou « ‹ l'établi » — les deux existent.

**Pourquoi** — Écran juste. Deux corrections seulement : il entre au fil d'Ariane, et le lien qui l'ouvre cesse d'apparaître et de disparaître d'une ligne à l'autre selon le nombre de directions.

### 18. Le calibrage — *existe et reste*

**Son rôle** — Mettre toutes les poses d'une chose à la même hauteur en les empilant dans une seule case.

**Ce qu’il reprend** — Calibrage.tsx, sans changement.

**On y arrive par** — Depuis la fiche de la chose.

**On en sort par** — Échap, ou « ‹ l'établi ».

**Pourquoi** — Écran juste, refait le 3 septembre. Il entre simplement au fil d'Ariane.

### 19. La vitrine — *existe et reste*

**Son rôle** — Voir en grand, à la même échelle et sur le fond que le jeu décrit, soit toutes les poses d'une chose, soit toutes les choses du monde.

**Ce qu’il reprend** — Vitrine.tsx, un seul composant, deux portées.

**On y arrive par** — Depuis la fiche d'une chose pour une chose, et depuis le haut de la liste d'une famille pour le monde entier — mais par un bouton, non par un lien de 10 px.

**On en sort par** — Échap.

**Pourquoi** — C'est l'un des rares écrans qui montre le jeu, et sa seule signalisation est aujourd'hui un lien de 10 px posé au-dessus d'une liste.

### 20. Commander un clip — *neuf*

**Son rôle** — Demander une petite vidéo d'un personnage en mouvement, chez un fournisseur ou sur la carte graphique de la maison.

**Ce qu’il reprend** — Rien — c'est la V3, déjà cadrée au plan, dont le serveur est écrit et éprouvé.

**On y arrive par** — Une case de la matrice de l'établi, y compris une case vide.

**On en sort par** — Le clip revient et s'ouvre au montage.

**Pourquoi** — Cet écran est le chemin de l'animation depuis le 3 septembre. Il a une place naturelle dans la carte — sous l'établi, à côté de la fabrication d'une image fixe — et la carte doit la lui réserver maintenant, sinon il redeviendra une surface de plus posée à côté des autres.

### 21. Le montage d'un clip — *neuf*

**Son rôle** — Regarder le clip tourner et y prendre, image par image, les animations qu'on veut garder.

**Ce qu’il reprend** — Rien — V3, tranche A10.

**On y arrive par** — Un clip revenu, ou un clip de la galerie.

**On en sort par** — Échap ; les bandes gardées se rangent dans les cases du plan.

**Pourquoi** — Même raison. Rien n'y dépense, et l'écran doit le dire — c'est la règle des lieux qui paient.

### 22. Les tables de retouche — *existe et change*

**Son rôle** — Retoucher une image sans rien repayer : détourer, recadrer, ramener sur la grille et sur la palette, retoucher à la main, découper, superposer.

**Ce qu’il reprend** — Tables.tsx:1042, sans refonte des neuf tables.

**On y arrive par** — Une image, depuis la Galerie ou depuis une case de l'établi.

**On en sort par** — Un bouton fermer et la touche Échap — qui n'existent ni l'un ni l'autre aujourd'hui.

**Pourquoi** — C'est la surface de retouche la plus fréquente du produit et le seul plein cadre dont la sortie n'est pas sur l'écran : ni fonction de fermeture parmi ses onze paramètres, ni écoute d'Échap. Un écran dont on ne sait pas sortir est la définition d'un écran sans lien avec le reste. Deuxième correction : les neuf tables se regroupent visiblement entre celles qui règlent l'image et les deux qui en fabriquent une autre — aujourd'hui le seul indice est un trait dans la barre.

### 23. Le dépliage d'une planche — *existe et change*

**Son rôle** — Choisir ce qu'on garde d'une feuille multi-images qui vient d'arriver, avant qu'elle entre en bibliothèque.

**Ce qu’il reprend** — Depliage.tsx, sans refonte.

**On y arrive par** — Une planche en attente, où qu'elle soit affichée.

**On en sort par** — Bouton fermer, et Échap — qui manque.

**Pourquoi** — Deux réparations. Échap, comme les treize autres plein-cadre. Et il doit se rendre partout où on l'appelle : depuis la grille de choix d'une image de référence, le clic est aujourd'hui totalement inerte, parce que l'écran n'est rendu qu'à l'intérieur de la Galerie, elle-même démontée pendant la confirmation d'un paiement.

### 24. La ligne de commande (ce qui reste de la barre qui paie) — *se scinde*

**Son rôle** — Une seule ligne au pied des écrans qui fabriquent : ce qu'on demande, le prix attendu, et le bouton.

**Ce qu’il reprend** — Le bandeau de App.tsx:2152-2305, dont les réglages descendent dans l'écran de confirmation.

**On y arrive par** — Elle n'est présente que sur l'établi et sur les listes du Codex où quelque chose peut se fabriquer.

**On en sort par** — Le bouton, qui ouvre l'écran de confirmation.

**Pourquoi** — C'est le plus gros gain de place du produit : de 205 à 657 px rendus à chaque écran du Codex, sur une hauteur utile de 1010. Et la disparition d'une contradiction : la barre est aujourd'hui rendue sous « Les directions », « Leurs poses » et « Équipement », où l'on règle des noms et où l'atelier propose quand même de dépenser — taper un mot et faire Ctrl+Entrée y lance un appel payant qui ne se rangera nulle part. Le code n'a même pas de test à inventer : l'établi sait déjà retirer la barre quand la fiche, la vitrine ou le calibrage s'ouvrent.

### 25. L'écran « Ce qui part » — *existe et change*

**Son rôle** — Relire mot pour mot ce qui va partir, image jointe par image jointe, régler l'appel, voir le prix, et payer.

**Ce qu’il reprend** — Envoi.tsx, qui accueille les quatre réglages retirés au bandeau : le modèle, les proportions, le nombre de variations, le sujet.

**On y arrive par** — Le bouton de la ligne de commande.

**On en sort par** — Payer, revenir sans rien dépenser, ou Échap.

**Pourquoi** — Ces quatre réglages sont la seule raison pour laquelle le panneau reste au pied de tous les écrans, et cet écran est le seul endroit où ils ont un sens : on lit ce qui part et on le corrige au même endroit, ce que le produit promet déjà. Un chiffre le prouve : sur les 25 contrôles du bandeau déplié, un seul est vraiment un choix par appel — le « Sujet », qui décide des images de référence envoyées — et c'est justement celui qui est caché derrière un repli, jamais prérempli même quand on vise la case d'un personnage, et remis à zéro à chaque rechargement ; le produit annonce alors « aucun sujet — seules les planches tous partiront », dans un panneau qu'on ne voit pas.

### 26. Choisir une image de référence — *existe et reste*

**Son rôle** — Ajouter une image jointe sans quitter l'écran de confirmation.

**Ce qu’il reprend** — App.tsx:2494-2556.

**On y arrive par** — La section des images jointes de l'écran de confirmation.

**On en sort par** — « ‹ revenir », ou Échap.

**Pourquoi** — Il fait son travail, et il vient d'être réparé le 4 septembre pour que les corrections survivent à l'aller-retour. Deux détails : le clic sur une planche en attente doit faire quelque chose, et le lien « Relancer » n'a rien à faire sur un écran dont le métier est une dépense unique.

### 27. La galerie — *existe et change*

**Son rôle** — Le domicile de toutes les images du jeu ouvert : chercher, ranger, comparer, exporter, importer — et n'y payer jamais rien.

**Ce qu’il reprend** — App.tsx:2639-2772 et sa grille, sans changer son métier.

**On y arrive par** — L'onglet Galerie.

**On en sort par** — Un autre onglet.

**Pourquoi** — Elle n'est pas un doublon du Codex et il ne faut pas la réduire : 73 des 166 images du dépôt — 44 % — n'appartiennent à aucune chose du jeu et n'existent nulle part ailleurs, et cinq gestes n'existent que là. Le partage est net : le Codex range par ce que la chose est, la galerie par ce que l'image est devenue. Quatre réparations. Un seul périmètre affiché : aujourd'hui trois compteurs comptent trois choses à l'écran en même temps — 41 images, 166 assets, et 1,5281 $ sous le mot « Projet » pour un jeu qui en a dépensé 0,20. La lenteur : 41 vignettes coûtent 1029 ms cache vide, alors que servir les mêmes images entières, huit fois plus lourdes, en coûte 195 — parce que le serveur refabrique chaque vignette à chaque regard, n'en garde aucune sur le disque et n'en fabrique qu'une à la fois. Le plafond : la grille ne montrera jamais plus de 200 images, sans pagination ni message, alors que l'auteur annonce être à moins de 5 % de son contenu final, soit au moins 3 300 images — 6 % de visible. Et le filtre par famille, dont trois valeurs sur six ne peuvent rien rendre et vident la grille avec le message « Rien n'est encore sorti d'ici. Écris. »

### 28. La fiche d'une image — *existe et reste*

**Son rôle** — Dire ce qu'une image est, d'où elle vient, ce qui l'a fabriquée, et où la reprendre.

**Ce qu’il reprend** — Fiche.tsx.

**On y arrive par** — Un clic sur une tuile de la grille.

**On en sort par** — La croix, ou une autre sélection.

**Pourquoi** — Écran juste. C'est aussi la seule porte de la Galerie vers le Codex, et elle doit le rester.

### 29. Les dépenses — *fusionne*

**Son rôle** — La seule liste de tout ce qui a été payé : chaque appel, ce qu'il a coûté, ce qu'il a donné, et de quoi relancer ce qui a raté.

**Ce qu’il reprend** — Depenses.tsx, qui absorbe le journal des appels ratés de la colonne de gauche de la Galerie (Arbre.tsx:300-378).

**On y arrive par** — Le total en dollars de la barre du haut, désigné comme un bouton.

**On en sort par** — Échap, ou un onglet.

**Pourquoi** — Les deux existent en même temps alors que l'écran des Dépenses déclare en tête avoir été écrit pour remplacer l'autre. Et c'est là que doit vivre le geste « Relancer », qui rappelle le fournisseur et refacture pour de vrai : il est aujourd'hui posé deux fois dans la Galerie, à quelques centaines de pixels d'une phrase qui affirme « aucun appel ne part d'ici ».

### 30. L'atelier (ex-Réglages) — *existe et change*

**Son rôle** — Ce qui ne concerne aucun jeu : les clés des fournisseurs, les garde-fous de l'agent, les dossiers de travail.

**Ce qu’il reprend** — EcranReglages.tsx, renommé.

**On y arrive par** — Le mot « L'atelier » dans la barre du haut, ou l'état des fournisseurs.

**On en sort par** — Échap.

**Pourquoi** — Un seul changement, et c'est un mot : deux écrans sans aucun rapport s'appellent aujourd'hui « Réglages » — celui-ci, et le côté de l'onglet Univers qui règle le jeu. Renommer coûte une ligne et supprime une confusion permanente.

### 31. Le guide — *existe et reste*

**Son rôle** — La prose du produit : ce que chaque chose veut dire.

**Ce qu’il reprend** — Guide.tsx.

**On y arrive par** — Le mot Guide, ou la touche « ? ».

**On en sort par** — Échap.

**Pourquoi** — Aucun défaut relevé. Il gagne seulement les trois explications qui manquent — ressemblance, grille, dérive — qui n'ont aujourd'hui aucune entrée sur les 74 du recueil, et une infobulle de navigateur pour seule explication.

### 32. L'aperçu (barre d'espace) — *existe et reste*

**Son rôle** — Tenir une image en grand une seconde par-dessus tout le reste.

**Ce qu’il reprend** — Apercu.tsx.

**On y arrive par** — La barre d'espace en survolant n'importe quelle vignette.

**On en sort par** — Relâcher, ou Échap.

**Pourquoi** — C'est un invariant du produit et il marche partout. Son seul défaut est que le geste n'est écrit nulle part à l'écran — une ligne dans le guide et dans le pied de la galerie suffit.

### 33. Sortir vers le jeu — *existe et change*

**Son rôle** — La fin du parcours : poser les fichiers d'une chose finie dans le dossier du jeu, avec le descriptif qui nomme chaque image, sa pose et sa pièce.

**Ce qu’il reprend** — Le bloc « Sortir vers le jeu » du bas de la colonne d'identité de l'établi.

**On y arrive par** — Depuis la fiche d'une chose, et depuis l'export d'une sélection de la galerie.

**On en sort par** — Retour à la fiche, avec ce qui est sorti et où.

**Pourquoi** — C'est la dernière étape du modèle cible, et elle est aujourd'hui un bloc discret au bas de la colonne d'un écran de production — sur un personnage à qui il reste tout à faire. Elle mérite d'être une étape nommée à la fin de la fiche, où l'on voit ce qui est prêt à sortir.

### 34. La découpe d'une planche atteinte depuis la Galerie — *disparait*

**Son rôle** — Rien : personne ne peut l'ouvrir.

**Ce qu’il reprend** — App.tsx:2593-2606 et sa branche de fil d'Ariane, App.tsx:2122-2137.

**On y arrive par** — Par aucun clic — la variable qui l'ouvre n'est jamais posée avec une valeur, ses sept usages la remettent tous à vide.

**On en sort par** — Sans objet.

**Pourquoi** — Le bouton qui l'ouvrait a quitté la fiche d'une image et l'écran est resté. Du code mort dans un produit qu'on cartographie fausse la carte.

### 35. Le menu au survol d'une carte d'inspiration — *disparait*

**Son rôle** — Régler une carte de la toile.

**Ce qu’il reprend** — Tableau.tsx:1319-1597, jusqu'à 19 commandes.

**On y arrive par** — Le repos du pointeur pendant 0,2 s sur une vignette de 148 px.

**On en sort par** — En s'éloignant.

**Pourquoi** — Il est remplacé par la colonne d'une carte. Deux endroits qui règlent la même carte, dont l'un sort toujours de l'écran, c'est le défaut qu'on ferme — pas un défaut qu'on borne.

### 36. Le panneau « La chose choisie » du Codex — *se scinde*

**Son rôle** — Dire, à droite de la liste, ce qui manque à la chose désignée.

**Ce qu’il reprend** — Codex.tsx:766-942 : son bloc « Ce qui manque » est juste et rejoint la carte de la chose dans la liste ; son bloc « Ce qu'elle réclame » est faux et rejoint la fiche, en une seule écriture.

**On y arrive par** — Il n'existe plus comme colonne permanente.

**On en sort par** — Sans objet.

**Pourquoi** — Deux de ses trois lignes ne peuvent pas ne pas être vertes, et il reste affiché avec la chose d'avant quand on change de rubrique — on lit « Le pèlerin — ce qu'elle réclame » à côté du vestiaire du jeu. Le même fait est aujourd'hui écrit à cinq endroits sur deux écrans avec trois formules de calcul différentes ; la carte cible n'en garde qu'une, lue par tous.

## Ce qui manque

- Un écran d'accueil qui propose de choisir le jeu — la première phrase du modèle cible n'est câblée nulle part, et le choix du jeu vit dans une colonne d'un onglet sur trois.
- Un moyen de savoir et de changer quel jeu est ouvert depuis les onglets Univers et Codex, qui travaillent pourtant entièrement sur lui.
- Un vestiaire en images : la cinquième famille du Codex est la seule qui ne montre aucune image, alors que 10 images de la base portent une pièce et que l'écran les a déjà en mémoire.
- Une fiche pour une pièce d'équipement : aujourd'hui aucune pièce ne s'ouvre, il n'y a rien à ouvrir.
- Un endroit où le produit enregistre qu'un personnage porte une pièce : il le déduit après coup des images déjà payées, ce qui rend le menu d'équipement incapable de filtrer quoi que ce soit.
- Une place pour les images d'une chose qui n'ont aucune attitude : 8 des 18 images du pèlerin — 44 % — n'apparaissent nulle part sur son écran.
- Un seul endroit qui répond à « où en est cette chose » : trois formules cohabitent dans deux fichiers, dont deux se trompent dès qu'un jeu déclare des directions — la moitié des projets du dépôt.
- Une pagination de la galerie et un compte honnête : elle est plafonnée à 200 images sans le dire, pour une cible annoncée d'au moins 3 300.
- Des vignettes rangées sur le disque : le serveur en refabrique une à chaque regard, une à la fois, ce qui coûte 1029 ms pour 41 images quand servir les images entières en coûte 195.
- Les mêmes vignettes sur le tableau d'inspiration, qui télécharge 95,3 Mo pour 55 cartes affichées dans des cases de 148 px, et dans le Codex, dont la liste et la matrice tirent encore les fichiers entiers — 435 Ko de moyenne là où 20 Ko suffiraient.
- Trois explications au recueil : ressemblance, grille, dérive — les seuls chiffres que l'auteur cite de mémoire n'ont aucune entrée sur les 74 existantes.
- Une porte des choses du jeu vers leurs ambiances : quatre projets sur cinq n'en ont aucune, et la fiche qui désigne une ambiance ne peut pas l'ouvrir.
- Un bouton fermer et une touche Échap sur les Tables, seul plein cadre du produit dont la sortie n'est pas sur l'écran.
- Le fil d'Ariane sur quatre écrans plein cadre de l'établi — fiche, vitrine, calibrage, planche —, où il continue d'afficher le nom de la chose comme si on était resté sur la matrice.
- Un état « aucun jeu ouvert » atteignable : une fois un jeu ouvert on ne peut plus revenir en arrière, la ligne « Sans projet » n'existe que s'il traîne des images orphelines.
- Un écran qui ne rend rien tant que le serveur n'a pas parlé : l'onglet Univers et l'écran des réglages laissent la page entièrement vide, sans message.

## Ce qui est en trop

- L'écran de découpe atteint depuis la Galerie : zéro chemin d'accès, la variable qui l'ouvre n'est jamais posée avec une valeur, et sa branche de fil d'Ariane est morte avec lui.
- Le journal des appels ratés de la colonne de gauche de la Galerie : l'écran des Dépenses déclare en tête l'avoir remplacé, et les deux coexistent.
- Les deux boutons « Relancer » de la Galerie, sur un écran qui écrit en toutes lettres « aucun appel ne part d'ici » alors qu'ils rappellent le fournisseur et refacturent.
- Le troisième « Relancer », dans la grille de choix d'une image de référence, sur l'écran dont le métier est une dépense unique.
- La ligne « pièces d'équipement — N sur N » de la colonne de droite du Codex : verte écrite en dur, la même variable des deux côtés du mot « sur », aucun état du monde ne peut l'éteindre.
- Le bandeau qui paie sous « Les directions », « Leurs poses » et « Équipement » : 593 px sur 1010 sur des écrans où rien ne peut se fabriquer, et un champ de dépense actif au Ctrl+Entrée.
- Les 21 contrôles du panneau de réglages posés au pied de chaque écran, sur les 25 que porte la barre : un seul est un choix par appel.
- Le mot « Réglages » sur deux écrans sans rapport, et le nom « FicheDeLaChose » sur deux composants qui répondent à la même question.
- L'étape 12 de l'assistant — les clés des fournisseurs —, qui ne concerne aucun jeu et existe déjà à l'identique dans l'écran de l'atelier.
- Les trois valeurs du filtre par famille de la galerie qui ne peuvent rien rendre — décors, objets, interface — et qui vident la grille avec le message d'une bibliothèque vide.
- L'accessoire « colonne de l'univers repliée », déclaré et passé à l'écran, dont la colonne a été supprimée.
- Le sélecteur de variations éteint sur deux valeurs sur trois dès qu'un lot est visé, c'est-à-dire dans le cas d'usage principal du Codex, et qui occupe la même place.

## Ce qui fusionne

- Les douze étapes de l'assistant, la rubrique « Les directions » et la rubrique « Leurs poses » deviennent un seul écran, « Les règles du jeu », dans l'Univers — les poses y sont déjà réglées par le même appel serveur, et les directions y sont déjà déduites de la vue choisie à l'étape 3.
- Les deux journaux de dépenses — celui de l'arbre et l'écran des Dépenses — deviennent un seul, avec le geste « Relancer » qui n'a rien à faire ailleurs.
- Les deux « FicheDeLaChose » deviennent une seule fiche, celle qui a un portrait et un sommaire ; le panneau de 380 px du Codex disparaît en tant que colonne permanente.
- Les trois coins qui fabriquent ou réparent un calque — la planche d'équipement, la carte d'un vêtement, la table de superposition — deviennent l'atelier du calque : la maquette est dessinée et attend l'arbitrage.
- Les deux écrans de découpe — celle d'une carte d'inspiration et celle d'une planche produite — restent deux portes vers un seul outil, comme aujourd'hui, mais la porte morte disparaît.
- Les quatre réglages de l'appel — modèle, proportions, variations, sujet — quittent le pied de tous les écrans et rejoignent l'écran de confirmation, qui montre déjà le texte exact, les images jointes et le prix.

## Ce qui se scinde

- L'écran d'un personnage se coupe en deux : sa fiche devient ce qu'on voit en cliquant, l'établi devient la profondeur où l'on fabrique. Rien n'est à concevoir, les deux écrans existent — il s'agit d'intervertir leur rang.
- L'écran de l'Équipement se coupe en deux : la liste illustrée reste dans le Codex, les quatre réglages par pièce descendent dans la fiche de la pièce. C'est ce qui fait passer l'écran de 15 contrôles et 0 image à une liste d'images.
- Le bandeau qui paie se coupe en trois : ce qui déclenche (le champ, le prix, le bouton) reste au pied des écrans qui fabriquent ; ce qui décrit l'appel descend dans l'écran de confirmation ; ce qui rend compte de l'argent est déjà dans les Dépenses.
- La colonne de droite du Codex se coupe en deux : son bloc « Ce qui manque », qui est juste, rejoint la carte de la chose et la fiche ; son bloc « Ce qu'elle réclame », qui ne peut pas être faux parce qu'il ne mesure rien, disparaît.
- L'assistant se coupe en deux groupes, comme le plan l'a déjà écrit : ce qu'on sait en commençant — nom, style, vue, taille, poses, emplacements — visible, et ce que le produit décide bien tout seul — types, modèles, détourage, réduction, fournisseurs — replié derrière une ligne qui dit pourquoi ça peut attendre. Aucune étape ne disparaît.

## Les défauts à réparer, avec leur preuve

**1. La ligne « pièces d'équipement » de la colonne de droite du Codex est verte écrite en dur : aucun état du monde ne peut l'éteindre.**

> Codex.tsx:853-859 — la valeur affichée est « ${pieces.length} sur ${pieces.length} », la même variable des deux côtés du mot « sur », et l'attribut « complet » est passé sans valeur, ce qui vaut vrai pour toujours. Verte pour les 3 personnages du jeu ouvert, dont un qui n'a que 3 calques posés sur les 12 attendus.

**2. La ligne des poses de la même colonne ne regarde aucune image : elle compte les poses que la chose n'a pas écartées.**

> Codex.tsx:839-849 avec posesTenues, Personnages.tsx:99-100. Les douze choses des six projets du dépôt ont toutes une liste d'écartées vide, donc les deux nombres sont toujours égaux. La grenouille des tourbières a 0 image en base et affiche « poses du type personnage — 6 sur 6 » en vert.

**3. Le même panneau se contredit à quarante pixels d'écart.**

> Sur Le pèlerin : huit lignes vertes en haut, puis Codex.tsx:917-921 affiche « 9 cases à fabriquer » et Codex.tsx:923 grise le bouton avec la raison « rien ne manque au corps de cette chose » — les neuf cases manquantes sont des cases d'équipement que ce bouton ne sait pas lancer.

**4. La matrice de la fiche d'une chose porte un second vert faux, de nature différente : elle compare au nombre d'étapes d'une pose au lieu du nombre réellement attendu.**

> FicheChose.tsx:1045, 1055 et 1058 contre son propre total, FicheChose.tsx:101-104 et 1065, qui est calculé juste. Sur cœur-de-pierre-01, quatre directions déclarées : le personnage affiche « 4 / 4 » en vert là où seize images sont attendues, au-dessus d'un total qui dit « 1 / 6 ».

**5. Trois formules du mot « fait » cohabitent dans deux fichiers et divergent d'un facteur quatre dès qu'un jeu déclare des directions.**

> Codex.tsx:448 (manque), Codex.tsx:804-806 (manquantes, sur case_.images.length < pose.images) et FicheChose.tsx:96 (comptes), alors que le serveur fournit déjà le bon nombre — production.py:1829, qui vaut étapes × directions.

**6. Les Tables n'ont ni bouton fermer ni touche Échap : la seule sortie est le fil d'Ariane de la barre du haut.**

> Tables.tsx:1042-1078 — aucune fonction de fermeture parmi les onze paramètres, et les deux points de montage (App.tsx:2564-2590, App.tsx:2933-2967) ne lui en passent aucune. La seule occurrence d'Échap du fichier, Tables.tsx:319, appartient à un sous-panneau.

**7. Un écran complet est injoignable, avec sa branche de fil d'Ariane.**

> App.tsx:2593-2606 et App.tsx:2122-2137 ; l'état decoupeOuverte (App.tsx:565) n'est jamais posé avec une valeur, ses sept usages le remettent tous à vide. Le bouton qui l'ouvrait a quitté Fiche.tsx:782.

**8. Le bandeau qui paie est monté sur les sept rubriques du Codex sans aucune condition, y compris les deux écrans de réglage du jeu.**

> Codex.tsx:285 — la barre est rendue hors du branchement des lignes 245-284. Mesuré au navigateur sur un atelier jetable en 1920x1080 : 593 px sur 1010 px utiles sur « Les directions » comme sur « Leurs poses », réglages ouverts. Avec le vrai catalogue de 49 modèles, la barre atteint 637 px, soit 63 % — il reste 373 px pour une liste dont chaque fiche de personnage fait 62 px.

**9. La rubrique Équipement n'emprunte pas l'écran des autres familles : un aiguillage l'envoie vers un composant écrit pour une colonne de 240 px.**

> Codex.tsx:249-257 contre Codex.tsx:270-283, et le commentaire d'origine du composant, Personnages.tsx:645-654 : « Ni vignette, ni recherche ». Il est aujourd'hui rendu dans la colonne du milieu, environ 950 px sur un écran de 1600. Sur test-v2 : 15 contrôles, 0 image, une vingtaine de blocs de texte pour 2 pièces.

**10. Ce n'est pas un défaut de données : les images de pièces existent et l'écran les tient déjà en mémoire.**

> Base donnees/atelier.sqlite3 : 10 images portent une pièce — helmet 4, battle-axe 2, sac-de-voyage 3, epee 1 — soit 4 pièces sur 4 illustrables. Le champ calques de chaque case (api.ts:1029, production.py:1763-1779) arrive déjà avec la production, et Codex.tsx:235 tient la liste des personnages sans la passer au vestiaire (Codex.tsx:251-256).

**11. Le menu vers les pièces, sur l'établi, est invisible au sens littéral et ne peut pas filtrer.**

> Personnages.tsx:1224-1232 avec index.css:13-22 : 1,04 pour 1 de contraste entre la pastille éteinte (#111419) et le fond de page (#0b0d10), 1,25 pour 1 pour la pastille allumée, texte de 10 px à 3,3 pour 1 contre un seuil de 4,5. Et Personnages.tsx:1170-1206 ne reçoit pas le personnage en paramètre : il montre toutes les pièces du vestiaire, sans exception.

**12. Le produit n'enregistre nulle part qu'un personnage porte une pièce.**

> donnees/projets/test-v2/personnages/le-pelerin.json : 16 champs, aucun sur l'équipement ; api.ts:1057-1119 (type Personnage) ; et production.py:1003-1006 l'écrit : « Rien n'est enregistré ici non plus. C'est l'image qui dit sa case et sa pièce ; une pièce posée se déduit donc des assets. » Ouvrir la colonne « Épée » propose d'habiller les six attitudes du pèlerin, qui a une seule image d'épée.

**13. L'écran d'un personnage n'a aucun ancrage : sa plus grosse typographie est le champ éditable de son nom, et l'écran qui répond existe derrière un lien de 10 px.**

> Personnages.tsx:1333 (15 px) contre FicheChose.tsx:360 (portrait 96 px) et FicheChose.tsx:382 (32 px à empattements). Le lien « sa fiche › » est Personnages.tsx:1338-1346, quatrième d'une rangée de quatre dont « Supprimer », Personnages.tsx:1380-1389.

**14. La matrice laisse 97 % de sa voie d'images vide et 64 % de sa colonne blanche, et ne tiendrait pas dans l'écran sur un jeu à directions.**

> Personnages.tsx:1013 (colonne gauche 300 px), 2023 (rangées de 52 px), 2032 (nom sur 110 px), 2083 (« rien encore ») : 1923 px de voie à 2560x1440 pour environ 60 px de texte. Six rangées font 442 px de contenu dans une colonne d'environ 1215 px. Avec quatre directions (vue.py:244), 30 rangées de 53 px = 1590 px, soit 375 px de plus que la colonne, et 36 boutons qui préparent une dépense.

**15. Les trois chiffres que l'auteur cite ne disent presque jamais rien et n'ont aucune explication au produit.**

> Personnages.tsx:2732-2749, appelé ligne 2097, sans intitulé et sans useInfobulle — seulement un attribut title. Sur les 70 images du dépôt qui portent ces mesures, 64 affichent « dérive 1.00× » et 2 seulement dépassent 0,99 de ressemblance ; les 96 autres images n'en portent aucune. Aucune entrée dans aide.ts, qui en compte 74. Et « case 2 » désigne une case d'une planche que rien à l'écran ne montre : les six corps du pèlerin viennent de trois planches différentes.

**16. La galerie affiche trois périmètres à l'écran en même temps, sans dire lequel est lequel.**

> App.tsx:2687 (« 41 images », le jeu ouvert), App.tsx:3406 (« 166 assets », tous les jeux) et Arbre.tsx:91 avec bibliotheque.py:878 (« Projet — 1,5281 $ », une requête sans filtre) alors que le jeu ouvert a coûté 0,20 $ — 13 % du chiffre le plus visible de la colonne.

**17. La lenteur de la galerie n'est pas la bande passante : c'est un calcul refait à chaque regard, un à la fois.**

> routes.py:1268-1290 lit l'image entière, appelle vignette() et n'écrit rien ; mesures.py:95-127 n'a aucune mise en cache ; la route est déclarée async et fait le travail lourd dans la boucle du serveur, et il n'y a aucun run_in_threadpool ni to_thread dans tout le dossier atelier/. Mesuré cache vide sur les mêmes 41 images : 1029 ms et 801 Ko par les vignettes, contre 195 ms et 8,91 Mo par les images entières.

**18. La galerie ne montrera jamais plus de 200 images, en silence, y compris à la recherche.**

> routes.py:1080 fixe la limite, base.py:566 la traduit en LIMIT sans décalage possible, api.ts:3281-3288 ne demande aucune limite et BarreOutils.tsx n'affiche aucun avertissement. La recherche partage la même requête (base.py:556-566). Aujourd'hui 41 affichées sur 166 en base ; pour la cible annoncée d'environ 3 300, 6 % de visible.

**19. Le tableau d'inspiration n'a pas reçu le correctif de vignettes du 31 août et télécharge tout en pleine taille.**

> Tableau.tsx:987-995 (aucun chargement différé), api.ts:3597-3598 (l'adresse demandée est l'image entière), univers.py:684-704 (réencodage PNG à chaque appel, en-tête no-cache), univers.py:327 (« il ne se pagine pas : on le regarde »). Mesuré sur coeur-de-pierre : 55 cartes, 95,3 Mo, 1,77 Mo par carte, dans des cases de 148 px. Le Codex non plus : Codex.tsx:696 et Personnages.tsx:2403 appellent sujetAsset et non vignetteAsset.

**20. La galerie affirme le contraire de ce qu'elle fait, à deux endroits.**

> App.tsx:2731-2739 imprime « aucun appel ne part d'ici », tandis qu'App.tsx:2724 passe onRelancer à la grille (Tuile.tsx:206-214) et App.tsx:2655 à la colonne de gauche (Arbre.tsx:365-371) ; les deux appellent App.tsx:1732-1740, donc POST /generations/{id}/slots/{rang}/retry, donc generation.py:970 — l'appel payant.

**21. Le filtre par famille de la galerie propose six valeurs dont trois ne peuvent rien rendre, et vide la grille avec le message d'une bibliothèque vide.**

> App.tsx:1205 écarte toutes les images sur décors, objets et interface ; api.ts:2406 ne compte pas la famille comme un filtre, donc l'écran affiche « Rien n'est encore sorti d'ici. Écris. » et ne propose pas le bouton « Retirer le filtre ».

**22. Le seul réglage du panneau qui décide vraiment de ce qui part n'est jamais prérempli et se remet à zéro à chaque rechargement.**

> App.tsx:1660-1663 : « Le sujet, lui, n'est pas touché ». Sans lui, PanneauReglages.tsx:298 affiche « aucun sujet — seules les planches tous partiront », c'est-à-dire que les artworks de la famille ne partent pas en référence. Le repli n'est enregistré nulle part : usePli lit un Set en mémoire de module (chassis.tsx:349).

**23. Le modèle par défaut que le serveur recalcule selon le contexte n'est plus jamais appliqué après le premier chargement.**

> App.tsx:1125-1128 : l'effet ne pose le défaut que si aucun modèle n'a été choisi. Or le serveur renvoie un modèle de planche quand un lot est armé et un modèle d'édition quand une pièce l'est (App.tsx:735-743). Et l'argument qui justifiait de garder le sélecteur — « aucun autre écran ne choisit un modèle » — est faux depuis Assistant.tsx:2722-2820, qui en choisit un par famille plus deux.

**24. Quatre écrans plein cadre de l'établi sont invisibles au fil d'Ariane, qui continue d'afficher le nom de la chose.**

> L'état de la fiche, de la vitrine, du calibrage et de la planche vit dans Personnages.tsx:238-257, alors que le fil est construit dans App.tsx:2068-2097 et ne connaît que la chose ouverte et l'image ouverte ; un dernier segment n'est jamais cliquable (BarreChassis.tsx:86-94).

**25. Un clic est totalement inerte dans la grille de choix d'une image de référence.**

> App.tsx:2543 pose l'état du dépliage, mais l'écran de dépliage n'est rendu qu'à l'intérieur de la Galerie (App.tsx:2706), elle-même démontée quand la fenêtre de confirmation est ouverte (App.tsx:2639).

**26. Chaque ouverture de la galerie fait partir deux fois les mêmes demandes, dont 71,5 Ko de personnages qu'elle n'utilise pas.**

> App.tsx:109 fixe le projet courant à « aucun » au démarrage et toutes les lectures en dépendent (App.tsx:794 et les suivantes) ; relevé dans le journal réseau : /api/assets, /api/board, /api/characters et /api/journal partent chacun deux fois.

**27. Un projet qui a des emplacements de corps mais aucune pièce voit des intitulés vides et aucune explication.**

> Personnages.tsx:697 garde tous les groupes nommés même sans pièce, si bien que la condition de Personnages.tsx:708 n'est jamais vraie et que le message « Aucune pièce — et aucun emplacement » ne s'affiche pas. Le projet essai-animation est dans ce cas : 6 intitulés vides, 0 pièce.

**28. Choisir une collection fait tomber le filtre du jeu ouvert côté serveur, et un lot d'un autre jeu reste dans la grille quand on change de projet.**

> routes.py:1095-1096 ne pose le filtre du projet que si aucune collection n'est demandée ; Arbre.tsx:48-50 propose les collections sans jeu quel que soit le jeu ouvert ; base.py:264-270 (la liste des lots récents n'a aucun filtre de projet) et App.tsx:130-133 (la fusion des lots ne vérifie pas le projet, contrairement à celle des images en App.tsx:3047).

## L’ordre des travaux proposé

- 1. Réparer ce qui ment, avant de déplacer quoi que ce soit. Les deux lignes vertes de la colonne du Codex, la matrice de la fiche qui compare au mauvais nombre, les trois compteurs de la galerie, la phrase « aucun appel ne part d'ici » démentie par trois boutons Relancer, et le filtre par famille dont la moitié des valeurs ne peut rien rendre. Pourquoi en premier : une carte qui déplacerait ces écrans sans corriger leurs chiffres reconduirait exactement le défaut que l'auteur qualifie de faux, et il le retrouverait ailleurs. Ce sont des fonctions courtes dans quatre fichiers, aucun écran n'est redessiné, et le serveur envoie déjà les bons chiffres.
- 2. Rendre les sorties, et retirer le mort. Bouton fermer et Échap sur les Tables ; Échap sur le dépliage ; les quatre écrans plein cadre entrent au fil d'Ariane ; l'écran de découpe injoignable et sa branche de fil disparaissent ; le journal des ratés de l'arbre fusionne dans les Dépenses. Pourquoi en deuxième : tant qu'un écran n'a pas de porte de sortie, il n'a pas de place dans une carte — et c'est la moitié de l'impression « sans lien ». Petit, mesurable, sans arbitrage.
- 3. Couper la barre qui paie. La ligne de commande reste au pied des écrans qui fabriquent, les quatre réglages descendent dans l'écran de confirmation, et le pied disparaît des rubriques où rien ne se fabrique. Pourquoi en troisième : c'est le plus gros gain de place du produit — de 205 à 657 px rendus à chaque écran du Codex sur 1010 px utiles — et il faut l'avoir avant de redessiner quoi que ce soit, sinon on redessine autour d'un bloc qui va partir. L'écran de confirmation possède déjà une section d'options à interrupteurs prête à les recevoir.
- 4. Intervertir la fiche et l'établi. Cliquer une chose ouvre sa fiche ; l'établi devient la profondeur, atteinte par un bouton en clair. Pourquoi en quatrième : c'est la réponse directe au grief le plus fort, elle ne demande de concevoir aucun écran — les deux existent — et elle a besoin des chiffres réparés à l'étape 1 pour que le compte affiché en tête de la fiche soit vrai. Elle a aussi besoin de l'étape 3, parce que la fiche fait aujourd'hui disparaître la barre qui paie et qu'il faut décider ce qu'on lance depuis elle.
- 5. Vider la colonne du Codex de ses réglages, et illustrer le vestiaire. Les directions et les poses rejoignent les règles du jeu, dans l'Univers, qui gagne au passage les trois gestes qui n'existaient que dans le Codex — renommer une attitude, corriger sa phrase anglaise, changer son nombre d'images — et un chemin court depuis une ligne de pose de l'établi. Le vestiaire devient une liste d'images et ses réglages descendent dans la fiche d'une pièce. Pourquoi en cinquième : c'est le grief de la colonne, mot pour mot, et il faut que l'étape 3 ait retiré le bandeau de ces écrans pour que le déplacement se voie.
- 6. Faire tenir les deux surfaces qui rament. Vignettes rangées sur le disque et calcul sorti de la file d'attente unique du serveur, pagination de la galerie et compte honnête, fenêtrage de la grille, et les mêmes vignettes appliquées au tableau d'inspiration et au Codex. Pourquoi en sixième : c'est la condition pour que la toile devienne l'écran d'arrivée du jeu — sinon l'accueil sera l'écran le plus lourd du produit — et le remède existe déjà pour la galerie, c'est la même route à refaire.
- 7. Poser l'accueil, et le nom du jeu partout. L'écran qui propose de choisir son jeu, la barre du haut dont le nom du jeu devient la porte de retour, et l'assistant qui s'ouvre sur un jeu neuf comme sur le premier — tranche déjà écrite au plan. Pourquoi en septième et pas en premier : c'est un écran neuf, il n'a de sens qu'une fois qu'il mène quelque part de propre, et les six étapes précédentes sont exactement ce qui rend son arrivée présentable. Un accueil posé aujourd'hui déboucherait sur une toile de 95 Mo et un Codex qui se contredit.
- 8. Réserver la place de l'animation. L'écran qui commande un clip et l'écran de montage prennent leur place sous l'établi, à côté de la fabrication d'une image fixe, et la matrice se lit sur deux calques — les images fixes, les animations. Pourquoi en dernier de cette carte : la V3 est cadrée, son serveur est écrit, et il faut qu'elle arrive dans une carte plutôt qu'à côté d'elle. Si l'auteur veut l'animation avant, les étapes 1, 2 et 3 restent le préalable — l'écran de montage n'est jugeable que si l'écran qui l'entoure ne ment pas et qu'il reste de la place pour montrer des images.

## Ce qui reste à trancher

- Est-ce qu'un personnage déclare ce qu'il porte, ou est-ce que ça reste déduit des images déjà payées ? Aujourd'hui rien ne l'enregistre, et c'est pour cela que le menu d'équipement propose les six attitudes en épée à un personnage qui n'en a qu'une image. Un champ neuf sur le personnage suivrait la règle du dépôt — l'auteur déclare, l'application enregistre — mais c'est une décision de métier, pas d'écran.
- Que veut dire « fait » pour une chose du jeu ? Les corps seuls, ou les corps plus les calques d'équipement, plus les directions déclarées, plus les animations ? C'est ce chiffre-là qui tiendra le haut de sa fiche, et trois formules différentes s'en disputent aujourd'hui la réponse.
- Les poses restent-elles dans l'Univers avec le reste des règles, ou descendent-elles entièrement dans le Codex ? La mesure dit que les directions ne bougent jamais mais que les poses se retouchent en travaillant — neuf attitudes écrites à la main dans un projet, des nombres d'images réglés pose par pose dans un autre. Dans les deux cas le doublon disparaît ; le choix est celui de son geste.
- La toile devient-elle l'écran d'arrivée d'un jeu, ou la vue en grille reste-t-elle la vue par défaut ? Sur son vrai projet, aucune des 55 cartes n'a de paquet ni de place : la toile s'ouvrirait blanche, et il faut décider ce qu'un jeu non rangé montre à la place.
- Que montre une pièce d'équipement en vignette : la première image où elle apparaît, ou une image qu'il désigne comme la bonne ? Le champ existe dans le modèle et aucun écran ne l'écrit ni ne le lit.
- Le rang de l'animation contre le rang de cette carte. La V3 est cadrée et son serveur est prêt ; cette carte est huit tranches. Les trois premières se font dans les deux cas, la suite est un arbitrage de calendrier.
- Ce que devient l'atelier du calque : la maquette du 4 septembre attend son arbitrage, et elle décide d'un morceau du parcours que cette carte ne peut pas trancher à sa place.
- La densité. La V2.5 est ouverte pour trancher par écrit ce qu'on garde de la thèse « la densité est celle d'un instrument ». Cette carte rend de la place — de 205 à 657 px par écran du Codex, 97 % de la voie d'images de l'établi, 139 px de la colonne de gauche — mais ce qu'on met dedans, images en grand ou lignes plus serrées, est sa décision.

---

<a id="critiques"></a>

# IV — Les deux relectures adverses

*La carte ci-dessus a été attaquée sous deux angles : « répond-elle vraiment à ce dont l’auteur se
plaint ? » et « que casserait-elle de ce que le produit doit savoir faire ? ». **C’est la partie la
plus utile du document.***

## Relecture 1

**L’angle** — Avocat de l'auteur : je reprends son témoignage phrase par phrase et je juge la carte sur une seule question — est-ce qu'un écran nommé répond, avec une porte d'entrée et une porte de sortie, ou est-ce qu'on me promet un « parcours clarifié » ? Verdict par phrase, puis la liste des esquives et des trous.

**Le verdict** — JUGEMENT D'ENSEMBLE. La carte est honnête sur les faits et souvent plus dure que l'auteur lui-même : elle chiffre, elle cite, elle ne se cache pas derrière du vocabulaire. Sur dix-neuf phrases du témoignage, elle en répond neuf pleinement, sept à moitié, et elle en esquive trois — dont deux qu'elle rouvre en fin de document alors que l'auteur les avait déjà tranchées. Son défaut principal n'est pas dans le détail : c'est qu'elle répond au « manque de lien » et pas du tout à la « complexité ». À la fin du parcours qu'elle décrit, le produit a MOINS d'écrans qui mentent et PLUS d'écrans tout court. Elle n'annonce nulle part combien il en restera, ni ce qu'on voit dans la première minute, ni la règle de lecture qui ferait que trente écrans se comportent comme trois.

—— PHRASE PAR PHRASE ——

1) « J'allume l'app : un bel écran qui me propose de choisir sur quel jeu je veux travailler. »
Ce que la carte propose : un écran neuf, « L'accueil », premier écran au lancement, une carte par jeu avec son image, son nombre de choses et sa dépense, un champ pour en commencer un nouveau ; on y revient en cliquant le nom du jeu dans la barre du haut.
Suffit ? À moitié. La porte existe et son chemin de retour est nommé — c'est l'essentiel. Mais l'auteur a dit « un BEL écran », et la carte décrit un inventaire : trois lignes de texte et une vignette par jeu. Rien sur ce qu'on voit en grand, rien sur le fait que c'est le seul écran du produit qui doit donner envie d'ouvrir. Pire : la carte reconnaît ailleurs que quatre projets sur cinq n'ont aucune image officielle — donc l'image de la carte du jeu n'a aucune source dite. On promet un bel écran fait d'images qui n'existent pas. Et il arrive en septième position sur huit : la première phrase du modèle cible est livrée en dernier.

2) « J'arrive sur la toile de l'univers de ce jeu. »
Ce que la carte propose : oui, la toile devient l'écran d'arrivée d'un jeu ouvert, à deux conditions qu'elle chiffre — l'écran télécharge aujourd'hui près de cent méga-octets pour remplir des cases de la taille d'un timbre, et sur le vrai projet aucune carte n'est rangée, donc la toile s'ouvrirait blanche.
Suffit ? Non — parce qu'elle se dédit. La dernière section de la carte remet en question ce que l'auteur vient de décider : « la toile devient-elle l'écran d'arrivée, ou la vue en grille reste-t-elle la vue par défaut ? ». On ne renvoie pas à l'arbitrage une phrase que l'auteur a écrite à l'indicatif. La vraie question, celle qu'il faut poser, est la seule qui reste : que montre la toile d'un jeu qu'on n'a pas rangé ? La carte a même la réponse deux paragraphes plus haut (l'artwork, la palette, les mots de style) — elle avait de quoi trancher et ne l'a pas fait.

3) « De là je peux soit bosser sur l'univers, soit passer sur le codex. »
Ce que la carte propose : les trois onglets restent, la barre du haut gagne le nom du jeu et accueille au fil d'Ariane les quatre écrans profonds qui en étaient absents.
Suffit ? Oui pour le geste. Non pour le rang : la carte ne dit jamais que les onglets deviennent les outils D'UN JEU. Ils étaient trois surfaces posées côte à côte, ils le restent, avec un nom de jeu ajouté au-dessus.

4) « Il y a 2 outils vraiment distincts : l'Univers c'est le créatif / conceptuel, le Codex c'est la fabrication et le rangement. »
Ce que la carte propose : elle déplace vers l'Univers les réglages du jeu (les douze étapes de l'assistant, les directions, les attitudes, les emplacements du corps) et y laisse les ambiances.
Suffit ? Non, et c'est le contresens le plus sérieux du document. L'auteur a donné une définition — l'Univers est l'imaginaire — et la carte y verse tout ce qui n'est ni de l'imaginaire ni de la fabrication : un questionnaire de douze étapes, une liste d'attitudes avec leurs phrases en anglais, des emplacements de corps. Après cette carte, l'onglet créatif compte six surfaces dont la moitié sont des formulaires. La distinction que l'auteur nomme n'est écrite nulle part comme une règle, et rien ne dira demain où ranger un écran neuf. Il y a en vérité trois choses : ce que le jeu est (l'imaginaire), ce que le jeu impose (ses règles, réglées une fois), ce qu'on fabrique (le codex). La carte en fait deux et demi.

5) « La galerie, on sait pas trop ce qu'elle fait là car elle mélange les projets. »
Ce que la carte propose : un rôle en une phrase — le domicile de toutes les images du jeu ouvert : chercher, ranger, comparer, exporter, importer, et n'y payer jamais rien — et un seul périmètre affiché au lieu de trois compteurs contradictoires.
Suffit ? Presque. Deux réserves. La phrase de rôle est une liste de six verbes ; la vraie phrase, la carte l'écrit vingt lignes plus loin sans s'en rendre compte : « le Codex range par ce que la chose est, la galerie par ce que l'image est devenue. » C'est celle-là qu'il faut mettre en tête. Et surtout : le mélange des projets n'est pas seulement un compteur faux — la carte relève que choisir une collection fait tomber le filtre du jeu côté serveur, et qu'un lot d'un autre jeu reste affiché quand on change de projet. Ces deux défauts-là ne sont dans AUCUNE des huit tranches de travaux. La phrase exacte de l'auteur est donc reconnue et non planifiée.

6) et 7) « Ça rame de fou plus on a d'images… faudra stocker des vignettes et faire du lazyload. »
Ce que la carte propose : les vignettes rangées sur le disque au lieu d'être recalculées à chaque regard, le calcul sorti de la file d'attente unique du serveur, la grille paginée et fenêtrée, et les mêmes vignettes appliquées à la toile et au codex qui tirent encore les fichiers entiers.
Suffit ? Oui. C'est la partie la mieux servie : l'intuition de l'auteur est confirmée, mesurée, et le remède est exactement celui qu'il propose. Une seule réserve : aucun objectif chiffré n'est posé. Il dit viser au moins vingt fois son contenu actuel ; la tranche ne dit pas ce qu'elle promet de tenir. Sans cible, on ne saura pas si c'est fini.

8) « La galerie c'est utile, mais mal foutu. »
Ce que la carte propose : elle refuse de la réduire, preuve à l'appui — presque la moitié des images du dépôt n'appartiennent à aucune chose du jeu et n'existent nulle part ailleurs — et liste quatre réparations.
Suffit ? Oui.

9) « Le panneau de gauche me parle plutôt pas mal. »
Ce que la carte propose : on n'y touche pas, sinon pour en retirer ce qui n'y est pas à sa place.
Suffit ? Oui.

10) « Les directions et les poses, on comprend pas ce que ça fout là. C'est un réglage du jeu. »
Ce que la carte propose : les deux rubriques quittent la colonne et rejoignent les règles du jeu ; la colonne redevient cinq familles et rien d'autre ; les trois gestes qui n'existaient que là (renommer une attitude, corriger sa phrase, changer son nombre d'images) partent avec elles, plus un chemin court depuis une ligne de l'établi pour corriger après avoir vu le résultat.
Suffit ? Oui sur le fond, sauf qu'elle se dédit encore : la dernière section rouvre « les poses restent-elles dans l'Univers ou descendent-elles dans le Codex ? ». L'auteur a dit où elles ne doivent pas être. Le déplacement plus le chemin court répondent à tout ; il n'y a rien à arbitrer.

11) « Je clique sur personnage, je vois la liste : c'est pas top, beaucoup d'infos, mais ça passe encore. »
Ce que la carte propose : un seul geste par carte au lieu de deux gestes indistincts dans le même rectangle, et une vignette qui montre l'image que l'atelier retiendrait vraiment.
Suffit ? Non. L'auteur dit « beaucoup d'infos » et la carte ne retire rien : elle transforme même le compte de ce qui manque en porte supplémentaire. Sur une phrase de trop-plein, la réponse est un ajout. Il faut dire ce qu'une carte de la liste porte, et ce qu'elle ne porte plus.

12) « Équipement : pas de liste, des paragraphes de texte. Illisible, effrayant. Je m'attendais à un vestiaire en images. »
Ce que la carte propose : le vestiaire devient une liste illustrée, une pièce par ligne comme les personnages ; les quatre réglages par pièce descendent dans une fiche de la pièce, écran neuf, qui montre la pièce sur les corps où elle est apparue. Et la preuve que ce n'est pas un manque de données : dix images du dépôt portent une pièce, les quatre pièces déclarées en ont chacune au moins une, et l'écran les tient déjà en mémoire quand il dessine son formulaire.
Suffit ? Oui — c'est la meilleure réponse du document, avec la suivante. Une seule réserve, mais elle est au cœur : « quelle image représente une pièce » est renvoyé à l'arbitrage. Pour un écran dont tout l'objet est de montrer des images, ce n'est pas un détail, c'est l'écran.

13) « Sur tous ces écrans du codex, un quart de la page pris par un panneau de génération qu'on ne comprend pas, partout. »
Ce que la carte propose : le panneau se coupe en trois. Une seule ligne (ce qu'on demande, le prix, le bouton) reste au pied des écrans où quelque chose peut se fabriquer ; les quatre réglages qui décrivent l'appel descendent dans l'écran qui montre déjà le texte exact et le prix ; le pied disparaît des deux rubriques de réglage où rien ne peut sortir — où l'on pouvait pourtant lancer une dépense en tapant un mot.
Suffit ? À moitié, et c'est la phrase la plus mal servie parmi celles où la carte croit avoir répondu. L'auteur dit « partout » et la carte répond « sauf là où rien ne se fabrique » — c'est-à-dire qu'il reste sur les cinq listes de familles et sur l'établi, donc sur tout le parcours qu'il vient de décrire. Aucune hauteur n'est annoncée pour ce qui reste : on sait ce qui part, pas ce qui demeure. Et sur le nouvel écran d'arrivée d'un personnage, la carte écrit noir sur blanc qu'il « faut décider ce qu'on lance depuis elle ». Sur la phrase où l'auteur se plaint d'un panneau de dépense qui le suit partout, la carte laisse ouverte la question de savoir s'il le suivra jusque sur sa fiche.

14) « La colonne de droite qui dit ce que l'entité réclame : étrange, et en plus faux. »
Ce que la carte propose : elle disparaît comme colonne permanente ; sa moitié juste rejoint la carte de la chose et sa fiche, sa moitié fausse est supprimée. Et elle prouve la fausseté : une ligne est verte écrite en dur, une autre compte les attitudes non écartées et non des images, si bien qu'une chose sans aucune image s'affiche complète.
Suffit ? Oui, et c'est la partie la mieux démontrée. Mais l'ordre est faux : réparer les chiffres est la tranche numéro un, alors que la définition du mot « fait » est renvoyée à l'arbitrage de fin. On ne peut pas réparer en premier un nombre dont le sens est décidé en dernier.

15) « Au lieu de voir les infos du pèlerin et un menu où je peux régler des choses, j'ai des poses avec beaucoup de vide. »
Ce que la carte propose : on intervertit les deux rangs. Cliquer un personnage ouvre sa fiche — portrait, nom en grand, ce qu'il est, ses exemples, où il en est — et l'établi devient la profondeur, atteinte par un bouton en clair et non par un lien minuscule posé à côté de « Supprimer ». Les deux écrans existent déjà, il n'y a rien à concevoir.
Suffit ? Sur le rang, oui, et c'est la réponse la plus directe au grief le plus fort. Sur le contenu, non, pour deux raisons vérifiées dans le code. D'abord, ce que l'auteur appelle « un menu où je peux choisir de régler des choses » n'existe pas : le sommaire de la fiche ne mène qu'à des sections de la même page qui défilent — il indique, il n'ouvre rien, et son commentaire le revendique. Ensuite et surtout, la fiche garde à sa droite une colonne fixe qui est une matrice de production. En la promouvant écran d'arrivée sans y toucher, on remet la table de fabrication sur l'écran censé dire ce que le personnage EST. La carte ne le voit pas et ne le dit pas.

16) « Des indicateurs obscurs incompréhensibles et techniques. »
Ce que la carte propose : ces mesures ne paraissent plus que lorsqu'elles ont quelque chose à dire, et le recueil d'aide gagne trois explications — les seuls termes que l'auteur cite de mémoire n'y ont aujourd'hui aucune entrée sur soixante-quatorze.
Suffit ? Non. On répond « incompréhensible » par « on l'expliquera dans le glossaire » : c'est exactement l'esquive. Et l'affichage conditionnel fabrique le défaut que la carte dénonce ailleurs — une colonne qui apparaît et disparaît d'une ligne à l'autre. La réponse à sa phrase est de le dire en mots sur l'établi, ou de ne rien dire du tout et de laisser les nombres à la fiche de l'image, où un lecteur technique les cherche.

17) « Et un bouton fabriquer. Pour chaque pose. »
Ce que la carte propose : rien. Elle compte les boutons — trente-six sur un jeu à quatre directions, tous prêts à dépenser — et s'en sert comme preuve que la matrice ne tient pas dans l'écran, mais elle ne dit à aucun moment ce qui les remplace. Les lignes deviennent des vignettes ; une vignette porte-t-elle encore son bouton ?
Suffit ? Non. Phrase non traitée.

18) « Un menu à peine distinguable pour passer sur des objets, alors que je n'ai même pas décidé si ce personnage a cet objet. »
Ce que la carte propose : le contraste est corrigé — la carte montre que le menu est illisible au sens propre — et elle donne raison à l'auteur au-delà de ce qu'il croit : le produit n'enregistre nulle part qu'un personnage porte une pièce, il le déduit après coup des images déjà payées. Tant que ce n'est pas tranché, une pièce jamais fabriquée se présentera comme une proposition et non comme une colonne au même rang que le corps.
Suffit ? À moitié. La démonstration est excellente, mais tout — le vestiaire, la fiche de la pièce, la colonne d'équipement — est suspendu à un arbitrage renvoyé à la fin. Or il existe un remède immédiat qui ne demande aucune décision de fond : montrer d'abord les pièces déjà vues sur ce personnage, et les autres derrière un geste explicite. La carte ne le propose pas et laisse la tranche entière dépendre d'une décision.

19) « Tous les écrans me déçoivent par leur complexité et leur manque de lien et de logique. »
Ce que la carte propose : sur le lien, beaucoup et du bon — des sorties là où il n'y en avait pas, quatre écrans profonds enfin nommés dans le fil, un écran mort supprimé, deux journaux de dépense fondus en un. Sur la logique, mieux encore : une seule formule pour dire où en est une chose, là où trois se contredisaient.
Suffit ? Sur la complexité, non, et c'est le trou central. Comptons : la carte supprime trois surfaces, en fusionne quelques-unes, et en crée sept. Le produit sort de cette carte avec plus d'écrans qu'il n'en avait. Nulle part elle n'annonce un nombre visé, ne décrit la première minute d'usage, ni n'écrit la règle de lecture qui ferait qu'une trentaine d'écrans se comportent comme trois — une famille, une chose, sa profondeur — appliquée aux trois onglets sans exception. Un homme qui dit « c'est trop compliqué » ne reçoit pas de réponse quand on lui répond par une liste de trente entrées sans dessin.

### Ce qui manque

**1. Un budget d'écrans, et le compte avant / après.**

*Pourquoi ça compte* — Le grief général de l'auteur est la complexité. La carte supprime trois surfaces et en crée sept : à la sortie, le produit en a plus qu'à l'entrée, et le document ne le dit jamais. Une carte qui répond au reproche de complexité sans compter n'y répond pas.

*Ce qu’il faut ajouter* — Le nombre de surfaces aujourd'hui, le nombre visé, et la liste de celles qui partent. Plus une règle chiffrée par rang : un écran d'arrivée porte au plus trois gestes, une profondeur en porte autant qu'il faut.

**2. La règle de lecture, écrite une fois et valable partout : une famille, une chose, sa profondeur.**

*Pourquoi ça compte* — « Manque de lien et de logique » veut dire que rien ne se ressemble d'un écran à l'autre. La carte applique bien cette grammaire au Codex, mais ne la nomme pas et ne l'impose ni à l'Univers ni à la Galerie. Sans règle écrite, le prochain écran retombera à côté.

*Ce qu’il faut ajouter* — Trois lignes en tête de carte : ce qu'est un écran de liste, ce qu'est une fiche, ce qu'est une profondeur — et le contrôle que tout écran du produit se range dans l'un des trois.

**3. Un dessin du parcours entier, en une image.**

*Pourquoi ça compte* — L'auteur se plaint du lien entre les écrans. Une liste de trente entrées avec leur origine et leur sortie est précisément la forme qui ne montre pas de lien.

*Ce qu’il faut ajouter* — Un schéma unique : l'accueil, le jeu, les trois outils, et sous chacun ses deux ou trois niveaux — avec les flèches qui manquent aujourd'hui marquées d'une couleur.

**4. Ce qui fait qu'un écran d'accueil est beau, et d'où vient l'image d'un jeu.**

*Pourquoi ça compte* — L'auteur a demandé « un bel écran ». La carte décrit un inventaire, et reconnaît par ailleurs que quatre projets sur cinq n'ont aucune image officielle : les cartes de jeux seraient donc vides le jour de la livraison.

*Ce qu’il faut ajouter* — D'où vient l'image d'un jeu, dans l'ordre : son artwork officiel, sinon sa dernière image fabriquée, sinon sa palette en aplat. Et ce que l'écran montre en grand — un jeu à la fois, pas six vignettes en rang.

**5. Le troisième lieu : les règles du jeu, qui ne sont ni l'imaginaire ni la fabrication.**

*Pourquoi ça compte* — L'auteur a défini deux outils. La carte en garde deux et loge les réglages dans le créatif, ce qui refait sur l'Univers la faute qu'elle corrige sur le Codex : des formulaires posés dans un lieu qui n'est pas fait pour ça.

*Ce qu’il faut ajouter* — Nommer les règles du jeu comme un lieu à part, atteint depuis le nom du jeu et non depuis l'onglet créatif, et écrire la phrase de chacun des trois lieux — celle que l'auteur a déjà dite dans son témoignage.

**6. La hauteur exacte de ce qui reste au pied des écrans, et la règle « on ne dépense jamais depuis un écran d'arrivée ».**

*Pourquoi ça compte* — La carte dit tout ce qui part et rien de ce qui reste, et laisse ouverte la question de savoir si l'écran d'arrivée d'un personnage portera un bouton qui dépense. C'est la phrase où l'auteur se plaint d'un panneau qui le suit partout.

*Ce qu’il faut ajouter* — Une hauteur annoncée pour la ligne de commande, et la règle : la fiche dit ce qui manque et mène à la profondeur ; le bouton qui prépare une dépense n'existe que dans la profondeur.

**7. Ce que devient le bouton fabriquer répété sur chaque pose.**

*Pourquoi ça compte* — Phrase du témoignage non traitée. Passer de lignes à des vignettes ne dit pas si chaque vignette garde son bouton — auquel cas rien n'a changé, sinon la forme.

*Ce qu’il faut ajouter* — Un geste principal par écran : « fabriquer ce qui manque », qui ouvre l'écran de relecture avec la liste, et le lancement d'une case seule réservé à la case désignée.

**8. La traduction en mots des trois mesures que l'auteur cite.**

*Pourquoi ça compte* — Il n'a pas demandé une définition, il a dit que c'était incompréhensible. Un glossaire laisse le texte illisible là où il est écrit.

*Ce qu’il faut ajouter* — Sur l'établi, une phrase quand il y a quelque chose à signaler et rien sinon — « cette image s'écarte du modèle », « elle n'est pas calée sur la grille » ; les nombres vivent dans la fiche de l'image.

**9. Ce que la fiche d'une chose perd en devenant l'écran d'arrivée.**

*Pourquoi ça compte* — Elle garde aujourd'hui une matrice de production fixe sur toute sa droite. Promue sans coupe, elle rapporte la table de fabrication sur l'écran censé dire ce que la chose est — la faute même qu'on répare.

*Ce qu’il faut ajouter* — Décider : soit cette colonne devient une phrase et un bouton, soit elle reste et l'établi n'a plus de raison d'être. Et transformer le sommaire, qui fait défiler, en menu qui ouvre — c'est le mot de l'auteur.

**10. Une réponse au vestiaire qui ne dépende d'aucun arbitrage.**

*Pourquoi ça compte* — Deux points bloquants sont renvoyés à la fin : quelle image représente une pièce, et est-ce qu'un personnage déclare ce qu'il porte. Toute la tranche de l'équipement en dépend, et c'est le grief que l'auteur formule le plus durement.

*Ce qu’il faut ajouter* — Une règle provisoire posée maintenant : la vignette d'une pièce est sa dernière image en date, remplaçable plus tard par une image désignée ; le menu d'équipement d'un personnage montre d'abord les pièces déjà vues sur lui, les autres derrière un geste explicite.

**11. Le périmètre de chaque compteur, y compris celui des dépenses.**

*Pourquoi ça compte* — La carte répare les trois compteurs de la galerie mais laisse l'écran des Dépenses sans périmètre dit, alors qu'on l'atteint par le total qu'elle dénonce comme faux. Deux chiffres qui se contredisent, c'est l'origine de « en plus c'est faux ».

*Ce qu’il faut ajouter* — Une phrase par chiffre affiché : ce qu'il compte et sur quel périmètre. Et le total de la barre du haut aligné sur le jeu ouvert, avec le total de tous les jeux visible seulement dans les Dépenses.

**12. La correction du mélange des projets dans le plan de travaux.**

*Pourquoi ça compte* — C'est la phrase exacte de l'auteur sur la galerie. Elle est démontrée dans les défauts et absente des huit tranches : elle ne sera donc pas faite.

*Ce qu’il faut ajouter* — L'ajouter à la première tranche, avec les compteurs : le filtre du jeu qui doit tenir même quand on choisit une collection, et les lots qui ne survivent pas à un changement de jeu.

**13. Un objectif chiffré pour la lenteur.**

*Pourquoi ça compte* — L'auteur annonce viser au moins vingt fois son contenu actuel. La tranche décrit les remèdes sans dire ce qu'elle promet de tenir, donc sans moyen de savoir si c'est fini.

*Ce qu’il faut ajouter* — Une cible : combien d'images défilent sans à-coup, et en combien de temps s'ouvre la galerie d'un jeu à cette taille.

### Les erreurs relevées dans la carte

- Deux esquives sur des points que l'auteur a déjà tranchés. La dernière section rouvre « la toile devient-elle l'écran d'arrivée ? » et « les poses restent-elles dans l'Univers ? » alors que le témoignage répond aux deux à l'indicatif. Ce ne sont pas des arbitrages, ce sont des décisions prises qu'on renvoie à l'auteur.

- La carte reconnaît la distinction Univers / Codex mais ne l'écrit jamais comme une règle, et la contredit en pratique : elle verse dans l'onglet « créatif » un questionnaire de douze étapes, la liste des attitudes avec leurs phrases anglaises et les emplacements du corps. Après cette carte, l'Univers compte six surfaces dont la moitié sont des formulaires.

- Ordre impossible : la tranche 1 consiste à « réparer ce qui ment », c'est-à-dire à recalculer partout le nombre de cases faites, alors que la définition de « fait » est renvoyée à l'arbitrage de fin de document. On ne répare pas d'abord un chiffre dont on décide le sens en dernier.

- La phrase de l'auteur sur les projets mélangés dans la galerie est reconnue dans les défauts (le filtre du jeu qui tombe quand on choisit une collection, les lots d'un autre jeu qui restent affichés) mais n'apparaît dans aucune des huit tranches de travaux. Reconnu, non planifié.

- La carte annonce la barre du haut « sans changement de hauteur ni de composition » et lui ajoute dans la même phrase le nom du jeu, qui devient le bouton de retour à l'accueil. C'est un changement de composition.

- L'écran des Dépenses n'a pas de périmètre dit. On l'atteint par le total de la barre du haut, or ce total est justement l'un des trois compteurs faux que la carte dénonce ailleurs — il additionne tous les jeux. Si la galerie devient le domicile des images du jeu ouvert, la dépense doit dire le sien.

- La fiche d'une chose est promue écran d'arrivée sans qu'on touche à sa colonne de droite, qui est une matrice de production fixe. La carte affirme que « l'établi devient la profondeur » tout en laissant un établi miniature sur l'écran d'accueil de la chose.

- La carte décrit le sommaire de la fiche comme « un menu », alors que le code dit l'inverse : il fait défiler cinq sections de la même page, il n'ouvre rien. Ce que l'auteur demande — un menu d'où l'on choisit ce qu'on va régler — n'existe donc pas encore.

- La réponse aux « indicateurs obscurs » est un affichage conditionnel plus trois entrées de glossaire. L'affichage conditionnel reproduit un défaut que la carte reproche elle-même au produit (une colonne qui apparaît et disparaît d'une ligne à l'autre), et un glossaire ne rend pas une mesure lisible sur l'écran où elle est écrite.

- La phrase « un bouton fabriquer, pour chaque pose » n'est traitée nulle part. Les trente-six boutons servent d'argument de mesure, jamais de sujet.

---

## Relecture 2

**L’angle** — Gardien du PRD et des invariants : ce que la carte casserait, perdrait en silence, ou rouvrirait sans le dire — lu contre `docs/PRD.md` en entier, `docs/PLAN.md` § Les invariants du produit, et les tranches V2.4, V2.5, V3, V3.1 et V3.5 du plan, vérifié dans le code là où la carte avance un fait.

**Le verdict** — La carte est juste sur le fond et honnête sur la plupart de ses mesures — j'ai vérifié quatre de ses affirmations les plus lourdes et trois tiennent : les Tables n'ont ni fonction de fermeture ni Échap au niveau de l'écran (Tables.tsx:1042-1076, l'unique Escape ligne 319 appartient à un sous-panneau), l'écran de découpe atteint depuis la Galerie est bien injoignable (les sept usages de `setDecoupeOuverte` dans App.tsx le posent tous à `null`), et le journal des ratés de l'arbre coexiste bien avec un écran des Dépenses écrit pour le remplacer (Depenses.tsx:1-27). L'inversion fiche/établi, le vestiaire illustré, la barre qui paie retirée des écrans de réglage, les vignettes rangées sur le disque : tout cela doit se faire, et une partie est déjà écrite au plan.

Mais elle casse trois choses graves et en perd une quinzaine en silence.

**Ce qui casse.** ① Elle met « Relancer » dans les Dépenses. C'est écarté par écrit dans le PRD — *« un bouton refaire cet appel dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet »* — et l'écran lui-même se définit par le contraire : *« Rien ne se paie ni ne s'efface depuis cet écran. C'est le seul du produit dont c'est vrai des deux côtés à la fois »* (Depenses.tsx:26). En supprimant les trois « Relancer » de la galerie sans lieu de remplacement, elle laisse en outre un critère de succès du PRD sans domicile : *« deux emplacements portent une raison lisible et un bouton relancer »*. ② Elle intervertit la fiche et l'établi sans voir qu'un critère de succès du PRD et trois documents du produit promettent que **nommer une chose ouvre son établi** (`G9` rouvre US-189 exactement là-dessus). ③ Elle descend les quatre réglages de l'appel dans l'écran de confirmation, où l'invariant `E14` dit que *toute correction ne vaut que pour cet appel* — or le PRD exige que le modèle par famille **ne se choisisse pas à chaque génération**, et la carte retire en même temps l'étape de l'assistant qui le règle.

**Ce qui se perd en silence.** La bibliothèque des mouvements de `A6` — qui appartient à l'atelier et non au jeu — n'a aucune place dans la carte. Les collections n'y existent pas du tout, alors que l'arbre de la galerie est le seul endroit qui les crée. La promotion d'une image de la bibliothèque en artwork officiel (`G15`, 4 septembre) et le champ qui crée une chose du jeu depuis la colonne d'une carte (`G7`, 4 septembre, mesuré sur soixante cartes) disparaissent avec les écrans qu'ils habitaient. Et l'atelier du calque est présenté comme « en attente d'arbitrage » alors que les quatre réponses de `M2` sont écrites et font foi — dont deux disent l'inverse de la carte.

**Ce qui doit tomber, et je ne le défends pas** : le menu de survol de la toile (`G7` le prévoit déjà), le panneau de réglages au pied des écrans où rien ne se fabrique, la découpe injoignable, la ligne « pièces d'équipement » verte en dur, le second journal des ratés, la matrice comme écran d'accueil d'un personnage. La méthode du dépôt est la bonne et la carte ne s'y plie pas : **on ne contourne pas une décision écrite, on la rouvre par écrit avec sa nouvelle raison** — c'est ce que `P2` fait pour l'invariant `E13`, et c'est ce que douze points de cette carte doivent faire avant d'être construits.

### Ce qui manque

**1. « Relancer » descendu dans les Dépenses : un troisième guichet, écarté par écrit**

*Pourquoi ça compte* — Le PRD l'écarte nommément (§ Écarté par les décisions de la V2.1) : « Un bouton refaire cet appel dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet. » L'écran lui-même se définit par cette absence — Depenses.tsx:26, « Rien ne se paie ni ne s'efface depuis cet écran. C'est le seul du produit dont c'est vrai des deux côtés à la fois, et son pied le dit. » Et l'invariant E2 tient deux lieux d'où l'argent part, pas trois. Relancer rappelle le fournisseur et refacture pour de vrai (App.tsx:1732-1740).

*Ce qu’il faut ajouter* — Garder les Dépenses en lecture seule. La carte a raison de dire que la galerie ment ; la réponse n'est pas de déplacer le geste vers l'écran qui l'interdit, c'est de trancher par écrit où vit un emplacement raté. Écrire la question au lieu de la refermer.

**2. Le bouton relancer sur un emplacement raté perd tout domicile**

*Pourquoi ça compte* — Critère de succès du PRD : « Sur quatre variations dont deux échouent : deux images entrent en bibliothèque, deux emplacements portent une raison lisible et un bouton relancer, et aucun échec n'apparaît dans la grille. » La carte supprime les trois occurrences existantes (Arbre.tsx:366, Tuile.tsx:206-214, la grille de choix d'une référence) et n'en repose aucune. Au passage, elle ne voit pas que la seconde moitié du critère est déjà enfreinte : la tuile d'un emplacement raté est bien dans la grille.

*Ce qu’il faut ajouter* — Un lieu des emplacements en attente et ratés, qui ne soit ni la grille de la galerie ni les Dépenses — et qui porte la raison et le bouton, comme le critère l'exige.

**3. « Écrire un nom fait entrer la chose et ouvre son établi » — l'inversion fiche/établi le contredit**

*Pourquoi ça compte* — C'est un critère de succès du PRD mot pour mot, et un invariant d'E2 (« écrire un nom crée la chose, sur-le-champ, sans formulaire et sans rien payer »). `G9` existe précisément pour ça : elle rouvre US-189, comptée livrée alors que son geste n'existe pas, et son premier critère est « Nommer une chose ouvre son établi, et Échap remonte au codex ». La carte fait de la fiche l'écran d'arrivée sans dire ce que nommer ouvre.

*Ce qu’il faut ajouter* — Trancher : nommer ouvre l'établi (et la fiche devient la profondeur d'à côté), ou nommer ouvre la fiche — et alors réécrire le critère du PRD, `G9`, et les trois documents dont le guide qui promettent l'autre.

**4. Les quatre réglages descendus dans l'écran de confirmation : le modèle par famille cesse d'être un défaut**

*Pourquoi ça compte* — Critère du PRD : « Le modèle par défaut pour produire une planche et celui pour éditer un corps se règlent séparément, et l'auteur n'a pas à les choisir à chaque génération. » Or l'invariant E14 dit que dans cet écran « une correction faite avant de payer vaut pour cet appel seulement ; garder est un second geste écrit ». Et la carte retire en même temps de l'assistant l'étape « Les IA à utiliser » (Assistant.tsx:155), qui est justement l'endroit où ce défaut se règle. Les deux gestes ensemble suppriment le défaut par famille.

*Ce qu’il faut ajouter* — Dire, réglage par réglage, lequel des quatre est par appel et lequel est durable ; garder l'étape des modèles dans les règles du jeu ; et écrire le critère qui manque : changer un réglage dans l'écran de confirmation refait la demande d'aperçu par le chemin même que l'envoi emprunte (E14).

**5. Le catalogue des modèles déménage avec le sélecteur, et ses garde-fous avec lui**

*Pourquoi ça compte* — Trois invariants voyagent avec le choix du modèle : « Le catalogue décide, jamais une liste en dur — soit il relit le fournisseur, soit il sert une fiche datée, et l'écran dit laquelle » (T1/F1) ; « Un modèle se nomme par son fournisseur et par son nom » (F1) ; « Un fournisseur injoignable grise ses modèles et n'en efface aucun autre » (F1). Le critère du PRD « le réseau est coupé… et le catalogue affiche sa date » en dépend. La carte argumente sur la place que prennent 49 modèles sans dire que ces trois règles les accompagnent.

*Ce qu’il faut ajouter* — Écrire que l'écran de confirmation reprend le catalogue entier avec ses grisés, leurs raisons et la date de la fiche — sinon le gain de place se paie en règles perdues.

**6. La bibliothèque des mouvements d'`A6` n'a aucun endroit où vivre**

*Pourquoi ça compte* — Décision durable de la V3 : « Un mouvement appartient à l'atelier, pas à un projet », et critère d'`A6` : « Un mouvement survit au changement de projet », « se crée, se renomme et se masque ». La carte range les règles de production dans « Les règles du jeu » (qui appartient au projet) et réduit « L'atelier (ex-Réglages) » aux clés, aux garde-fous et aux dossiers. `A6` est la tranche qui passe avant tout le reste de la V3 : sans elle on ne commande pas un clip.

*Ce qu’il faut ajouter* — Une place pour les mouvements dans l'atelier, à côté des recettes nommées, avec la distinction livré/fabriqué que le produit emploie déjà — et la porte depuis une ligne de pose de l'établi, puisqu'une pose hérite du texte animé de son mouvement.

**7. L'atelier du calque : la carte rouvre un arbitrage déjà rendu, et à l'envers sur deux points**

*Pourquoi ça compte* — `M2` est dessinée le 4 septembre et ses quatre réponses « font foi pour la tranche qui bâtira l'écran ». Deux disent l'inverse de la carte : la carte d'un vêtement **reste**, réduite à une fiche qui montre et qui renvoie (« la faire disparaître obligerait à ouvrir un atelier pour regarder un calque, ce qu'on fait dix fois plus souvent qu'on ne le retouche ») ; et la planche d'équipement **n'y mène pas et ne doit pas y mener** — « c'est le chemin qui paie, et l'écran unique promet qu'aucun appel n'en part ». La carte fusionne les trois coins, planche d'équipement comprise.

*Ce qu’il faut ajouter* — Reprendre les quatre réponses de `M2` telles quelles : un seul écran, la carte d'un vêtement conservée, quatre portes dont la planche d'équipement est exclue, les quatre outils au-dessus du cadre, la main sur le même cadre que le calage.

**8. La colonne d'une carte ne reprend qu'une moitié de `G7`**

*Pourquoi ça compte* — `G7` porte sept choses, la carte en garde deux. Se perdent : la réserve qui passe à gauche avec sa bascule contre sa colonne (ce qui **révise un invariant d'`E1`** et doit être réécrit avec sa raison) ; le départ du bloc « Ce que la palette y lit » vers le détail d'une palette ; les deux réglages renommés « Référence de tout le jeu » et « Référence de cette chose » ; la ligne mesurée qui dit ce que cette carte-ci fera ; et surtout **le champ qui crée une chose du jeu depuis la colonne** — mesuré le 4 septembre : deux projets sur six ont des cartes et aucune chose à qui les attribuer, soixante cartes où le geste n'a jamais pu être proposé.

*Ce qu’il faut ajouter* — Recopier la liste des critères de `G7` dans la fiche de cet écran, ou dire lesquels sont abandonnés et pourquoi.

**9. Promouvoir une image de la bibliothèque en artwork officiel disparaît avec les écrans qu'elle habitait**

*Pourquoi ça compte* — Ajouté à `G15` le 4 septembre, sur un mur mesuré : une image que l'atelier a fabriquée et payée ne peut pas donner ses couleurs au jeu — la promotion se pose sur une carte de la toile, et aucun geste ne fait passer un asset dans une carte. Or la palette du jeu se déduit des artworks officiels, et le PRD la met partout : « une palette qui se déduit toute seule des artworks », « changer la palette d'un projet la réapplique à tout ce qu'il contient ». La carte déclare la fiche d'une image « juste » et n'y ajoute rien.

*Ce qu’il faut ajouter* — Le geste de promotion sur la fiche d'une image de la galerie, sans duplication de fichier, et la porte qui mène du manque de palette à ce geste.

**10. Les collections n'existent nulle part dans la carte cible**

*Pourquoi ça compte* — Le PRD : « Tout ce qui est produit reste dans une bibliothèque unique, rangée en projets et collections. » L'arbre de la galerie est le seul endroit du produit qui crée et filtre une collection (Arbre.tsx:43, 59, 161-182). La carte lui retire sa section Projets (vers l'accueil) et son journal (vers les Dépenses) sans jamais dire ce que devient la colonne — ni ce que deviennent les collections. Elle relève même un défaut de collection (le filtre du projet qui tombe côté serveur) sans leur donner de place.

*Ce qu’il faut ajouter* — Dire ce que devient la colonne de gauche de la galerie, et où l'on crée, choisit et filtre une collection.

**11. « Aucune étape ne disparaît » : la carte en retire deux et en oublie deux**

*Pourquoi ça compte* — Critère de `G8` : « Aucune étape ne disparaît : la page des réglages reste entière. » La carte retire les fournisseurs et les modèles. Et sa description des « règles du jeu » omet deux étapes livrées : **Les types d'objets** — le barème, qui décide de ce qu'on peut fabriquer, et sur lequel `G11` construit l'extinction d'un type — et **Le détourage de départ**, livré par `D1` et complété par `M7` le 4 septembre (Assistant.tsx:133-162).

*Ce qu’il faut ajouter* — Reprendre les douze étapes nommément, dire pour chacune si elle reste, part ou se replie, et réécrire le critère de `G8` si l'on en retire — la V2.1 écarte déjà « un second panneau de réglages à côté de l'assistant », ce qui justifie de retirer les clés, mais cela s'écrit.

**12. Le fond du jeu, le réglage de départ et leur affichage avant de payer**

*Pourquoi ça compte* — Trois critères livrés par la V2.3 et la V2.4 dépendent du pied des écrans que la carte découpe : « Le fond sur lequel le modèle pose le sujet se voit, se choisit et s'enregistre dans les réglages du jeu ; il se corrige à la main avant de payer, pour cet appel seulement » (D3, Assistant.tsx:1984-2012) ; « L'auteur voit quel réglage de départ va s'appliquer, et d'où il vient, avant de générer » (D1) ; et le geste de `M7` qui promeut un détourage réglé sur une image en défaut du projet (Tables reçoit `onUnivers` pour ça).

*Ce qu’il faut ajouter* — Placer explicitement ces trois-là dans la carte : le fond dans l'écran de confirmation, la provenance du réglage de départ avant l'envoi, la promotion depuis les tables.

**13. « Que veut dire fait » : deux invariants bornent déjà la réponse, la carte les ignore**

*Pourquoi ça compte* — La carte pose la question comme ouverte. Elle l'est en partie seulement : « Une jauge ne compte que ce qu'on peut fabriquer maintenant » (E12) — une case d'équipement dont le corps n'existe pas n'est pas fabricable maintenant, et une planche d'équipement où figure une pose sans corps est même impossible à lancer, critère du PRD. Et « une case est prise dès qu'une image la porte, pas parce que l'image est bonne » (E2). `A12` ajoute qu'il y aura **deux** jauges, une par calque, chacune disant de quoi elle est le total.

*Ce qu’il faut ajouter* — Écrire la formule unique en citant E2 et E12, et prévoir dès maintenant qu'elle vaut deux fois — images fixes, animations.

**14. Les deux axes de la matrice, et les directions qui vivent dessus**

*Pourquoi ça compte* — Décision écrite de la V2 : « la matrice de production d'un personnage n'est pas une grille d'assets — pas de recherche, pas de filtres, pas de sélection multiple, **deux axes et des vignettes**, rien de plus ». La carte propose que « les attitudes deviennent des vignettes, pas des lignes de tableur » en s'appuyant sur le cas d'un jeu à quatre directions — or les directions sont précisément le second axe. Le PRD tient au même endroit : « Les quatre directions manquantes d'une pose partent sur une seule planche et reviennent en quatre images séparées, chacune sachant déjà dans quelle case elle se range. »

*Ce qu’il faut ajouter* — Dire ce que devient le second axe quand la matrice se redessine, et comment on vise encore les directions manquantes d'une pose.

**15. La grille unique : trois surfaces d'images de plus, sans amendement écrit**

*Pourquoi ça compte* — Invariant du rangement : « Une seule grille d'assets dans tout le produit — la matrice d'une chose, la réserve, les dépenses et la colonne des sœurs n'en sont pas : ni recherche, ni filtres, ni sélection multiple. » Il a déjà été amendé une fois par écrit, en `G12`. La carte ouvre un vestiaire illustré, une fiche d'une pièce qui montre ses images, une colonne de carte et un accueil à vignettes, sans le mentionner.

*Ce qu’il faut ajouter* — Amender l'invariant explicitement, comme `P2` le fait pour `E13`, ou déclarer pour chaque surface neuve qu'elle n'a ni recherche, ni filtre, ni sélection multiple.

**16. L'accueil comme premier écran : trois règles à rouvrir, et un fait qui l'affaiblit**

*Pourquoi ça compte* — « Un onglet ne se recouvre pas : trois lieux, et l'établi est une profondeur, pas un quatrième onglet » (E1) ; « La barre du haut porte trois onglets et rien d'autre du travail » (PRD) ; « Aucun écran n'est obligatoire » (E19) et « le nombre d'écrans obligatoires est zéro » (PRD). Et le fait : l'assistant ne crée pas le jeu, il le renomme — sur une machine neuve, le « Bac à sable » existe déjà (Assistant.tsx:785-789). L'accueil s'ouvrirait donc, au premier lancement, sur un seul jeu, entre l'auteur et sa première image.

*Ce qu’il faut ajouter* — Rouvrir les trois règles par écrit avec leur nouvelle raison, et dire ce que fait l'accueil quand il n'y a qu'un jeu — le sauter, très probablement, pour tenir le zéro écran obligatoire.

**17. Refaire un dépliage : la porte de `P1` n'existe pas dans la carte**

*Pourquoi ça compte* — `P1` est le vrai sujet de la V3.5 : « Refaire un dépliage est un geste que l'auteur demande, il repart des coupes proposées », « une planche se déplie plusieurs fois, les dépliages coexistent », « chaque image dit sa planche et son dépliage d'origine », « supprimer la planche demande confirmation et dit combien d'images en dépendent ». La carte n'ouvre l'écran de dépliage que depuis « une planche en attente » — c'est le premier dépliage, pas le second.

*Ce qu’il faut ajouter* — La porte depuis une planche déjà dépliée, dans la galerie (`G16` l'y a fait entrer le 3 septembre), et la confirmation de suppression qui compte les images filles.

**18. Ce que `G16` et `M6` ont livré les 3 et 4 septembre n'a pas de place dans la carte**

*Pourquoi ça compte* — Livrés et employés par l'auteur : la bascule *calque* / *brut* sur la carte d'une pose d'équipement, dans la colonne de droite de la fiche du personnage ; le bouton *superposition* prérempli des deux bonnes images ; les deux calques qui coexistent pour une même pose ; et la fiche qui dit lequel des deux compte, avec le moyen d'en changer (`M6`). La carte redistribue la fiche, l'établi et la colonne d'équipement sans jamais les nommer.

*Ce qu’il faut ajouter* — Placer ces quatre gestes dans la carte cible — sinon la réorganisation défera un travail de la semaine.

**19. Le lieu où l'on voit un clip en cours**

*Pourquoi ça compte* — Critères d'`A9` : « Un clip en cours se voit, dit ce qu'il a coûté, et survit à la fermeture de l'atelier » ; « les clips reviennent un par un, chacun visible dès son arrivée » ; « la galerie montre un clip par une image prélevée dedans, jamais par une tuile en erreur » ; « le récupérer est un geste que l'auteur demande, jamais un rappel automatique » — c'est l'invariant le plus ancien du produit qui parle là. La carte pose l'écran de commande et l'écran de montage, et rien entre les deux.

*Ce qu’il faut ajouter* — Dire où vit l'attente : la galerie, comme aujourd'hui pour les générations, ou un lieu à elle — et où se demande la récupération d'un clip payé qui n'est pas revenu.

**20. Le bloc « ce qui part, ligne par ligne » et ses portées, compté parmi les contrôles à jeter**

*Pourquoi ça compte* — La carte affirme qu'un seul des vingt-cinq contrôles du bandeau est un choix par appel. Le bloc des références écartées (PanneauReglages.tsx:474-560) porte trois portées — cette génération, ce personnage, le projet, « la portée la plus étroite l'emporte » — et c'est le mécanisme même de l'invariant E14 : *une correction vaut pour cet appel seulement, garder est un second geste écrit*. Il ne se déplace pas comme un réglage de confort.

*Ce qu’il faut ajouter* — Le nommer, et écrire qu'il descend dans l'écran de confirmation avec ses portées intactes — c'est d'ailleurs là qu'il a toujours eu sa place.

**21. Six écrans neufs, et pas une ligne au guide**

*Pourquoi ça compte* — Règle du dépôt : « une maquette qui ajoute un écran ou un réglage doit une ligne au guide, et elle l'écrit chez elle », et l'invariant qui la complète : « une explication ne se recopie jamais — elle est lue dans le recueil ». `G3` est née d'avoir manqué l'autre bout de cette règle vingt-trois fois. La carte prévoit trois explications de plus (ressemblance, grille, dérive) pour six écrans neufs — accueil, colonne d'une carte, fiche d'une pièce, atelier du calque, commander un clip, montage.

*Ce qu’il faut ajouter* — Une ligne de guide par écran neuf et par réglage neuf, lue et non recopiée.

**22. La barre d'espace sur les surfaces neuves**

*Pourquoi ça compte* — Invariant d'`E0` : « La barre d'espace montre en grand n'importe quelle vignette, partout, sans exception. » La carte crée quatre surfaces qui portent des vignettes — l'accueil, le vestiaire, la fiche d'une pièce, la pellicule du montage — et note ailleurs que le geste n'est écrit nulle part.

*Ce qu’il faut ajouter* — L'écrire comme critère sur chaque surface neuve, et poser la ligne qui l'annonce.

**23. Les vignettes rangées sur le disque doivent rester un cache**

*Pourquoi ça compte* — « Les fichiers font foi, la base est un index reconstructible » (T3), et le traitement est non destructif, « le rendu est un cache effaçable » (T2). Le remède que la carte propose est le bon, mais il crée des fichiers dérivés à côté des images payées.

*Ce qu’il faut ajouter* — Dire que les vignettes sont un cache effaçable et reconstructible, jamais une donnée — et qu'aucune ne fait foi.

**24. La liste des sujets d'une planche multi-objets, après le découpage de la barre**

*Pourquoi ça compte* — `P2` exige que « la demande dise d'avance ce que chaque case contient » et que « le prix par sujet s'affiche avant l'envoi, à côté du prix de la planche » — c'est la condition à laquelle elle lève l'invariant `E13`. La carte réduit la ligne de commande à un champ, un prix et un bouton, et descend le reste dans l'écran de confirmation, sans dire où se compose cette liste.

*Ce qu’il faut ajouter* — Réserver la place de cette liste dans l'écran de confirmation, comme la carte réserve celle de l'animation sous l'établi.

### Les erreurs relevées dans la carte

- « Aucune entrée dans aide.ts, qui en compte 74 » : le recueil en compte environ 135 aujourd'hui, et `G3` en comptait 122 le 3 septembre. Pire pour l'argument : la ressemblance entre cases et la dérive de grille **sont** expliquées dans le recueil — dans l'entrée du lot d'attitudes (aide.ts:624), qui dit même qu'elles « ne bloquent jamais ». Ce qui manque n'est donc pas l'entrée, c'est l'accroche depuis la mesure — ce qui est très exactement le sujet de `G3`, et rend la réparation plus petite que la carte ne l'annonce.

- « La maquette est dessinée et attend l'arbitrage de l'auteur » (l'atelier du calque) : `M2` est close le 4 septembre et ses **quatre réponses sont écrites, et font foi pour la tranche qui bâtira l'écran**. Deux contredisent la carte : la carte d'un vêtement **reste** (réduite à une fiche qui montre et qui renvoie, avec une porte *reprendre ce calque ›*), et la planche d'équipement **ne mène pas** à l'atelier du calque — « c'est le chemin qui paie, et l'écran unique promet qu'aucun appel n'en part ». La carte la range pourtant parmi les trois coins fusionnés.

- « Un jeu qui n'a encore rien ouvre ses règles à la place » suppose que créer un jeu soit le point de départ : sur une machine neuve, **l'assistant ne crée pas le jeu, il le renomme** — un « Bac à sable » existe déjà (Assistant.tsx:785-789, commentaire d'origine). L'accueil proposé s'ouvrirait donc au premier lancement sur une liste d'un seul jeu, posée entre l'auteur et sa première image, contre le critère « le nombre d'écrans obligatoires est zéro ».

- « Un seul des 25 contrôles du bandeau est vraiment un choix par appel » : le bloc des références porte trois portées explicites — cette génération, ce personnage, le projet — et le choix « cette génération » est par définition un choix par appel (PanneauReglages.tsx:505-560). C'est le mécanisme d'`E14`, pas un réglage de confort.

- La carte présente sa colonne d'une carte comme « déjà écrite au plan sous le nom G7 » : `G7` porte sept livrables, la carte en reprend deux. En particulier le champ qui crée une chose du jeu depuis la colonne — ajouté le 4 septembre sur une mesure — et le déménagement du bloc de lecture de palette n'y figurent pas.

- Le diagnostic dit que l'écran des Dépenses « déclare en tête avoir été écrit pour remplacer » le journal des ratés : c'est exact (Depenses.tsx:1-10), mais la même en-tête dit aussi, sept lignes plus bas, « Rien ne se paie ni ne s'efface depuis cet écran. C'est le seul du produit dont c'est vrai des deux côtés à la fois, et son pied le dit. » La carte cite la première moitié pour justifier une fusion que la seconde interdit.

- « Trois valeurs du filtre par famille ne peuvent rien rendre — décors, objets, interface » : la cause n'est pas seulement le filtre, c'est le barème des types du projet — mesuré en `G11`, le projet principal de l'auteur porte sept types là où le produit en livre huit. Retirer les trois valeurs figerait ce qu'un type éteint ou ajouté doit pouvoir changer.

- « L'écran de découpe injoignable » et « les Tables n'ont ni bouton fermer ni Échap » : vérifiés exacts (les sept usages de `setDecoupeOuverte` posent `null` ; aucune fonction de fermeture parmi les onze paramètres de `EcranTables`, Tables.tsx:1042-1076, et l'unique `Escape` du fichier, ligne 319, appartient à un sous-panneau). Rien à corriger — c'est écrit ici pour que ces deux-là ne soient pas remis en doute avec le reste.

---
