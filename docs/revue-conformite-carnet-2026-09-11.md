# Carnet — revue de conformité et des parcours, 11 septembre 2026

> **Référence : le design déjà décidé**, dans `DESIGN.md` et les maquettes accessibles depuis
> [Sommaire.html](pistes-2026-09-04/carnet/Sommaire.html). Aucune nouvelle direction graphique.
> L'utilisateur a explicitement écarté `impeccable` pendant cette séance ; ses évaluations
> ont été interrompues et ne servent pas de base à ce rapport.
>
> Ce document conserve les constats et les propositions, **pas un second plan ni un tableau
> d'avancement**. Le découpage proposé — l'amendement RF, remplacé par l'atelier unifié le
> 11 septembre 2026 — est en archive : [plan-carnet-amendement-rf.md](archive/plan-carnet-amendement-rf.md).

## Conclusion

**La refonte a principalement sécurisé le déménagement des fonctions et le passage au papier.
Elle n'a pas encore tenu la composition de plusieurs écrans.** La galerie le montre sans
ambiguïté : le carnet neuf est posé à côté de l'ancien arbre ; son titre et sa hiérarchie
dessinée manquent ; recherche, filtres et actions restent comprimés dans les anciennes barres.

Le problème n'est donc pas de choisir un meilleur style. Il faut finir le style choisi,
rendre les gestes prévus accessibles, et changer la façon de déclarer un écran conforme.
Les moteurs déjà livrés, les données et les règles d'argent restent des acquis.

## Ce qui a été examiné, et les limites

- État Git de référence : `fd95508` ; aucune modification de l'application dans cette revue.
- Inventaire du sommaire et des **49 fichiers HTML** présents dans le dossier au relevé.
  Ce nombre inclut des documents de principes et de parcours : ce n'est pas 49 écrans à coder.
- Lecture ciblée des composants, du montage de l'application, des garde-fous, du plan et de
  son affectation ; comparaison approfondie de la galerie, de la fiche et du chemin de retouche.
- Observation navigateur de la version servie sur **8420**, puis des sources actuelles sous
  Vite sur **5174**, avec navigation galerie → fiche → retouche → galerie → famille.
  Maquettes servies localement sur **8933**. Aucun clic de génération, aucune écriture de recette,
  aucun déplacement, suppression ou export des données de l'auteur.
- Le serveur 8420 sert un **build ancien**, avec les trois onglets Univers / Codex / Galerie.
  Son HTML pointe les mêmes fichiers compilés que `interface/dist/index.html`, notamment
  `index-BSJtoVIo.js`. Les sources actuelles montrent le carnet sur 5174.
- L'atelier jetable existant n'a pas démarré : le Python 3.11 visé par `.venv` est inaccessible
  dans cet environnement. La vue des sources a donc utilisé l'API déjà ouverte, en lecture.
  Des réponses 404 et une famille vide malgré son compteur ont été observées dans ce montage
  mixte : **elles ne prouvent pas un défaut du backend actuel** et ne sont pas classées comme tel.
- La maquette Galerie est un dessin fixe de 1600 × 1000. L'application a notamment été
  observée à 1280 × 720. Aucun écart au pixel près n'est annoncé entre ces captures : les
  constats de structure sont recoupés dans le code. Les dessins fictifs des maquettes et les
  images réelles ne sont pas comparés comme s'il s'agissait des mêmes données.

**Cette revue est étayée, mais ce n'est pas une recette exhaustive des 49 HTML.** Les parties
non rejouées sur un serveur à jour sont explicitement des contrôles à faire, pas des bugs prouvés.

## Les écarts établis

### R01 · La version regardée peut précéder la version du code — priorité haute

**Preuve :** HTML de 8420, `interface/dist/index.html`, et écran à trois onglets ; les sources
de `interface/src/App.tsx` montent déjà `Carnet`. Le build servi et les sources ne représentent
donc pas la même interface. L'âge exact du serveur Python n'a pas été établi.

**Friction :** une correction peut être présente dans Git sans être visible dans l'application
que l'auteur utilise. Une revue peut alors comparer deux versions différentes sans le savoir.

**Proposition :** ouvrir la recette de conformité par un lancement reproductible du même état
de sources pour l'API et l'interface ; consigner commit, build, dimensions et jeu d'essai.
Le lanceur existant est à vérifier avant d'en inventer un autre. Ne pas conclure que ce seul
écart explique tous les griefs : les suivants existent aussi dans les sources actuelles.

### R02 · Deux navigations de bibliothèque occupent la galerie — priorité haute

**Attendu :** `Galerie.dc.html:53` pose carnet 300 px, surface, volet 380 px. Les autres jeux
se choisissent depuis l'ouverture / le carnet, pas dans une seconde colonne permanente.

**Présent :** le carnet est monté par `App.tsx`, puis `Galerie.tsx:938` ajoute sa propre colonne
d'arbre de **240 px**, et `Galerie.tsx:1168` monte `Arbre`. `Arbre.tsx:98` réclame **300 px**
dans cette piste de 240 ; le parent masque le débordement. Le navigateur montre bien les
colonnes Carnet / Projets-Collections / Images / Fiche.

**Friction :** espace de jugement réduit, changement de jeu proposé à deux endroits, et
contrôles de l'arbre susceptibles d'être rognés. C'est un écart de composition, même si
chaque couleur et chaque composant est individuellement valide.

**Proposition :** retrouver la composition de la maquette ; reloger les fonctions encore
portées par l'arbre avant de retirer cette seconde navigation. Conserver l'accès aux images
sans jeu et aux échecs, sans leur laisser occuper une colonne supplémentaire par défaut.

### R03 · La galerie a perdu son en-tête et ses niveaux de lecture — priorité haute

**Attendu :** dans `Galerie.dc.html`, fil local, grand titre compté, phrase de rôle, portes
« Apporter des images » et « Exporter vers le jeu », filtres comptés, puis bande de sélection.

**Présent :** `Galerie.tsx:1154` entre directement dans sa grille ; sa section centrale commence
par `BarreOutils` à la ligne 1185. Le bandeau global conserve dépenses, fournisseurs, arbre,
Réglages et Guide (`App.tsx:1910`). Aucun titre de galerie ne remplace la hiérarchie dessinée.

**Friction :** on doit déduire où l'on est des petits contrôles ; les tâches de l'atelier
restent au premier plan alors que l'on cherche une image du jeu.

**Proposition :** reprendre l'en-tête et les groupes de la maquette. Garder les fonctions
globales à leurs portes déjà prévues dans le carnet et dans le guide. Vérifier aussi les
autres surfaces qui montent encore le bandeau hérité.

### R04 · Recherche, filtres et sélection se disputent une même rangée — priorité haute

**Preuve :** `BarreOutils.tsx:105` impose une hauteur de 34 px ; les groupes internes défilent
horizontalement, recherche et famille pouvant rétrécir. La famille est un menu déroulant,
sans les comptes par famille dessinés dans `Galerie.dc.html`. Une seconde bande porte encore
brut / import / export. Au navigateur à 1280 px, ouvrir la fiche comprime fortement les contrôles.

**Friction :** sélectionner une image rend plus difficile le geste suivant. Les actions
« Ranger dans une chose » et « Corriger les deux » de la maquette ne sont pas proposées dans
cette barre ; son contrat `onRanger` porte projet / collection, pas le sujet (`BarreOutils.tsx:63`).

**Proposition :** séparer la consultation de l'action sur la sélection comme dans la planche,
afficher les comptes réellement calculés, et compléter les gestes de lot par les services
existants. Une route de lot ne se crée que si le comportement existant ne suffit pas.

### R05 · La fiche explique la mécanique avant de proposer le travail — priorité haute

**Attendu :** une image, une courte table d'identité, les traitements appliqués, puis des portes
stables vers Corriger, Voir en grand et la page du sujet (`Galerie.dc.html`).

**Présent :** `Fiche.tsx:210` tient bien 380 px, mais la visite montre une grande image, les
commandes favori / supprimer, quatre rôles de réinjection, le rattachement, le texte, l'héritage
et la recette. Les portes « Reprendre dans l'établi » / « La retoucher » arrivent après.

**Friction :** le premier écran de détails demande de comprendre référence, source d'édition,
guide de style et jeu de réglages avant d'atteindre une correction courante.

**Proposition :** reprendre la table et les portes de la maquette ; conserver les fonctions
avancées dans une ouverture dédiée. Ne supprimer ni la filiation, ni le prompt réellement
envoyé, ni la distinction entre réinjecter et retoucher. Montrer le nom réel du sujet dans sa porte.

### R06 · Le système typographique est déclaré mais son chargement ne suit pas — priorité haute

**Preuve :** `DESIGN.md` exige Instrument Serif, Instrument Sans, IBM Plex Mono et un chargement
auto-hébergé. `interface/src/index.css:159` nomme IBM Plex Mono ; `interface/index.html:7`
charge Google Fonts et demande **JetBrains Mono**. Aucun `@font-face` local n'a été trouvé
dans les sources examinées.

**Friction :** la police des mesures peut tomber sur une police de secours ; l'apparence
dépend du réseau et de ce que la machine possède. Nommer une police dans un token ne la livre pas.

**Proposition :** livrer les trois polices décidées localement, contrôler leur chargement réel
avec un cache vierge hors réseau, puis comparer titres, labels, nombres et boutons au spécimen.

### R07 · Dix-neuf exemptions empêchent de conclure sur la géométrie — priorité haute

**Preuve :** `essais/essai_jetons.py:LA_GEOMETRIE_D_AVANT` et la fin du bloc D du plan nomment
19 fichiers, dont **deux modules non visuels**, `api.ts` et `recette.ts`. Ce n'est donc pas
« 19 écrans ». Parmi les surfaces : Envoi, Clip, Montage, AtelierDeBande, Calque, Calibrage,
EtabliDuSujet, Planche, Vitrine, les pièces de saisie et d'aperçu. L'éditeur de bande emploie
encore de nombreux textes à 10 px, sous le plancher de `DESIGN.md`.

**Friction :** le passage d'un écran neuf à un atelier conserve un changement de densité,
de taille et de hiérarchie, même avec le même fond papier.

**Proposition :** traiter ces exemptions pendant le parcours propriétaire de chaque surface.
Séparer les valeurs métier des contrôles visuels dans le garde-fou ; ne pas appliquer une
substitution aveugle à toutes les dimensions de pixels du traitement d'image.

### R08 · Le garde-fou vérifie des valeurs, pas la fidélité de l'écran — priorité haute

**Preuve :** D3 est close avec comparaison navigateur annoncée et sortie des listes ; pourtant
R02 à R05 restent. Les expressions `TAILLE`, `TEXTE`, `ARRONDI`, `DUREE` du banc ne décrivent
ni l'arbre DOM ni la composition rendue. `TAILLE` examine des classes entre crochets ; il ne
prouve pas les dimensions calculées de `gridTemplateColumns`, les écarts Tailwind ordinaires
ou la largeur réellement disponible. La piste 240 et son enfant 300 en sont un cas concret.

**Proposition :** garder ce banc et lui ajouter une preuve différente : captures comparables,
géométrie des zones, présence des groupes attendus, accès aux actions et parcours réellement
rejoué. Un test de couleur ne doit plus être interprété comme une recette de fidélité.

### R09 · La retouche conserve du texte d'implémentation dans ses choix — priorité moyenne

**Preuve :** en ouvrant Détourer, on lit la date du changement de défaut, des pourcentages
d'accord, une taille de calcul et la licence du modèle, avant la suite des réglages. Le
texte général répète que toute la chaîne est gratuite. La colonne « Ses sœurs » contient,
depuis la galerie, des images de sujets différents : ce sont les voisines du filtre, pas
nécessairement les attitudes du sujet courant. Ce fonctionnement est prévu par B25.

**Friction :** le lecteur doit séparer la décision pratique du journal technique ; le mot
« sœurs » devient ambigu selon la porte d'entrée.

**Proposition :** montrer d'abord effet, disponibilité et temps ; garder les preuves détaillées
dans le guide ou un détail à ouvrir. Nommer le contexte de la série (« images de cette sélection »
ou « images de ce sujet ») sans changer le périmètre en silence. Les positions de la retouche
restent celles des maquettes et des extensions déjà décidées.

### R10 · Les textes et portes portent encore deux générations de vocabulaire — priorité moyenne

**Preuve :** le pied de galerie visible dit « on paie depuis le codex et depuis l'établi » ;
ces noms ne figurent plus comme tels dans le carnet. La tête propose Réglages et Guide en
plus des portes du carnet. `App.tsx:1920` précise que Réglages ouvre les garde-fous, le dossier
et les mouvements, alors que les règles du jeu et l'installation ont leurs écrans distincts.

**Friction :** le texte recommande des destinations que l'auteur doit traduire. Le libellé
« Réglages » ne dit ni sa portée ni ce qui le distingue des règles du jeu.

**Proposition :** revoir les libellés et les chemins avec `docs/vocabulaire.html` et
`Navigation.dc.html`, puis reloger chaque réglage selon sa portée déjà décidée. La conservation
de toutes les chaînes des anciens tests n'est pas un objectif lorsqu'elles contredisent le design.

### R11 · La sortie a un écart assumé que « fidèle » doit distinguer d'un oubli — priorité moyenne

**Preuve :** le rapport B21 dans le plan nomme deux restes de `Sortie.dc.html` : gabarit de
nommage et bouton Choisir. `Sortie.tsx:367` fournit un champ de chemin et explique la limite
du navigateur. L'aperçu et l'écriture partagent déjà la même logique : c'est un acquis à garder.

**Proposition :** tester le chemin réel image retenue → aperçu → dépôt → seconde ouverture.
Classer séparément le gabarit non livré et le choix de dossier limité par l'environnement.
Ne pas dessiner un faux sélecteur fonctionnel, ni supprimer l'aperçu pour imiter une capture.
Un éventuel sélecteur natif ou navigateur serveur demande une décision explicite de portée.

### R12 · Le plan mélange programme, compte rendu et éléments périmés — priorité haute

**Preuve :** le début de `PLAN-carnet.md` dit encore « deux blocs » et attend C1–C9 ; plus bas,
D1–D6 sont déjà closes. Le fichier pèse **208 511 octets** avant cet amendement. `PLAN.md`
pèse **71 254 octets** ; sa ligne V4 contient de longs comptes rendus alors que l'état devrait
être lisible immédiatement. Le suivi et le journal existent déjà à côté.

**Friction :** une session peut prendre la sortie d'un ancien fichier pour la fin de la refonte,
rouvrir un travail fini ou omettre une limite explicitement écrite ailleurs. L'utilisateur
doit reconstituer lui-même ce que « terminé » signifie.

**Proposition :** corriger l'entrée périmée immédiatement ; conserver l'historique des étapes
validées ; faire ensuite descendre leurs récits dans le suivi ou le journal propriétaire,
avec contrôle des renvois. Ne pas ajouter un nouveau tableau d'avancement à ce rapport.

## Parcours à éprouver avant de conclure qu'ils sont fluides

Les lignes suivantes sont des **protocoles de recette**, pas des défauts tous reproduits.

| Parcours | Le geste qui doit être naturel | Épreuve qui évite une fausse validation |
|---|---|---|
| Ouvrir un jeu | retrouver son travail et comprendre le prochain geste | build courant, jeu vide puis jeu fourni, réseau fournisseur coupé |
| Chercher et agir en lot | filtrer, choisir deux images, les corriger ou les ranger | fiche ouverte, filtre sans résultat, sélection mixte image / clip explicitement traitée |
| Faire une image d'un sujet | case visée → demande → relire → annuler ou envoyer → résultat | l'annulation conserve le brouillon ; la réception reste rattachée à la case ; fournisseur doublé |
| Retoucher une série | régler, comparer, image suivante, revenir | conserver filtre / sélection / zoom / position utiles ; rouvrir un réglage différent du défaut |
| Monter une animation | clip payé → ruban → réserve → retouche de frame → bande | laisser jouer pendant le geste ; rouvrir la bande avec ses réglages particuliers |
| Habiller un sujet | pièce → emploi → calque → aperçu du porteur | conserver pose et direction ; ne pas confondre image fixe et bande animée |
| Régler le jeu | trouver la bonne portée puis retourner au travail | défaut de famille et défaut de jeu distincts, pas de mutation d'images anciennes implicite |
| Sortir vers le moteur | choisir ce qui sort, relire, déposer, recommencer | dossier jetable avec homonymes, collision et fichier étranger ; rien ne part avant le geste final |

## Carte de couverture des références

Inventaire pour guider la recette. **« À comparer » ne signifie pas « absent du produit ».**
Les états et variantes internes à chaque HTML doivent être inventoriés au démarrage de sa tranche.

| Références du sommaire | Correspondance actuelle à examiner | Niveau de cette revue |
|---|---|---|
| Main, Vocabulaire, Systeme, Navigation, Etats, Carte, Parcours | carnet, lieux, composants communs, guide et lancement | principes lus ; écarts transverses établis |
| Ouverture, Accueil | Ouverture, TableauDeBord | lecture du plan ; recette réelle à compléter |
| Barre, Guide | Barre, Guide, gestes et aide | portes observées ; détail à comparer |
| Nouveau-jeu, Installation | ReglesDuJeu, Installation, PanneauAtelier | responsabilités lues ; parcours à rejouer |
| Famille, Familles, Fiche, Images, Animations, Essai, Comparer, Grille | Famille, PageDuSujet et ses onglets, EssaiDuSujet, Comparer, GrilleDuJeu | sources et correspondances relevées ; pas de recette complète sur API à jour |
| Animation-chaine, Clip, Clips, Atelier-animation | Clip, Galerie/FicheDuClip, Montage, AtelierDeBande | dettes de géométrie et transitions lues ; manipulation à vérifier |
| Emplois, Emploi | Emplois, Emploi, CalquesAnimes, Calque, Calibrage | correspondance et exemptions relevées ; manipulation à vérifier |
| Retouche et ateliers détourer, recadrer, réduire, couleurs, nettoyer, retourner, contour, main | Retouche et les postes partagés | ouverture et retour observés ; chaque moteur n'a pas été manipulé |
| Ateliers découpe et différence | Decoupe, Superposition, Depliage | correspondance à recetter avec les fichiers produits |
| Relecture | relectures et sortie | protocole à raccorder au chemin de livraison |
| Toile | Univers, Toile, Tableau, Ambiances | plan et rôle lus ; composition à comparer |
| Envoi | Envoi, intégration dans App, barre de demande | dette de géométrie et montage lus ; envoi payant non exécuté |
| Galerie | Galerie, BarreOutils, Arbre, Tuile, Fiche | comparaison approfondie et visite navigateur |
| Sortie, Depenses | Sortie, Depenses | code et écarts assumés lus ; dépôt non exécuté |
| Finesse | choix de taille / rendu | capacité supplémentaire à distinguer de la simple conformité |
| Decors, Tuiles | hors périmètre de la V4 décidé précédemment | ne deviennent pas des tranches du seul fait d'être au sommaire |

Les fichiers non exposés comme une entrée du sommaire se classent lors de l'inventaire des
variantes ; le sommaire a des clés historiques qui diffèrent parfois du nom du fichier.

## Comment empêcher une nouvelle clôture trompeuse

1. **Une référence par état d'écran**, identifiée par son fichier et sa variante, avec le
   rectangle utile de la maquette. Les annotations autour du dessin ne sont pas des contrôles.
2. **Une table d'écarts courte** : attendu, présent, décision, preuve. Statuts : conforme,
   adaptation documentée, écart à corriger, hors périmètre. Ni « papier » ni « tests verts »
   ne remplace « conforme ».
3. **Deux preuves séparées** : la comparaison de composition, et le scénario de bout en bout.
   Les tests de services protègent les données ; les essais DOM protègent les gestes ; une
   inspection rendue protège dimensions, lisibilité et visibilité des actions.
4. **Vérifier la composition à 1600 × 1000**, taille de la galerie dessinée, puis son usage
   à 1280 × 720 et 1440 × 900. Ces deux dernières tailles sont des conditions de recette
   proposées, pas un nouveau design mobile. Une maquette fixe n'établit pas sa propre adaptation.
5. **Préparer des données stables** : jeu vide, jeu rempli, noms longs, nombreuses images,
   échec de fournisseur, recette particulière, plusieurs bandes, fichier de destination existant.
   Les essais de comparaison visuelle ne lancent aucun fournisseur.
6. **À la fin de chaque tranche**, nommer les capacités serveur concernées et montrer leur
   porte d'écran ; toute capacité auparavant visible reste accessible ou est retirée par décision.

## Arbitrages à garder explicites

- `DESIGN.md` normalise déjà certaines irrégularités des planches : tailles, espacements,
  arrondis et polices locales. La fidélité ne signifie pas recopier leurs commentaires à 9 px.
- `Galerie.dc.html` colore en rouille la porte gratuite vers le sujet ; `DESIGN.md` réserve
  ce signal à l'action de lancement et au coût. **Recommandation : appliquer la règle de DESIGN**
  et noter cette adaptation, sans modifier silencieusement toute la palette.
- La colonne des sœurs à 128 px est une extension déjà déclarée dans DESIGN ; ce n'est pas
  un écart à supprimer parce qu'une planche plus ancienne l'omet.
- Les catalogues et moteurs déjà livrés ne se réduisent pas pour correspondre à une ancienne
  liste dessinée. La composition doit accueillir les fonctions réelles sans inventer un style.
- Le choix de dossier, le gabarit de sortie, Finesse, les décors et les tuiles ne se confondent
  pas avec un défaut de CSS. Leur statut produit doit être tranché avant de les promettre.

## Suggestions d'organisation

- Garder **un plan actif**, son affectation et ce relevé de preuves ; éviter un nouveau plan
  parallèle, un nouveau PRD ou un second document de design.
- Alléger ensuite les entrées du plan général et les récits de tranches finies ; les invariants
  restent en place et les renvois sont vérifiés après chaque déplacement.
- Découper l'exécution par parcours démontrable. « Supprimer un fichier ancien » ou
  « remplacer les couleurs » peut être un travail interne, pas le livrable final annoncé.
- Employer des critères de résultat, pas « tous les tests sans changer une assertion » : une
  assertion qui exige un libellé périmé doit évoluer, la preuve métier qu'elle portait doit rester.
- Ne pas transformer l'audit en refonte technique générale : simplifier un montage ou extraire
  un état seulement lorsque cela permet de tenir un des parcours et sa preuve de retour.

## Vérification des documents produits

- `git diff --check` : pas d'erreur d'espacement.
- Contrôle des liens Markdown des documents touchés : aucun fichier ni ancrage manquant.
- Banc `essai_docs.py`, lancé avec le Python 3.12 fourni par l'environnement : **1 050 renvois
  entre documents, aucun cassé ; 682 renvois du code, un cassé préexistant**. Il vise le titre
  « le menu d'un îlot » depuis `interface/src/index.css:134` ; la même référence existe dans HEAD.
  Elle est signalée, sans modification du code dans cette revue.
- **Corpus de démarrage : 194,4 Ko, +2,4 Ko par rapport au relevé précédent.** Cette variation
  compare deux relevés, pas uniquement les ajouts de cette séance. L'augmentation est à
  conserver dans le bilan ; elle renforce la proposition d'allègement des récits historiques.
- Le relevé de mesures a été écrit dans un fichier temporaire dédié, sans remplacer la base
  de comparaison du dépôt. Les suites de l'application n'ont pas été relancées : cette séance
  change les documents et les consignes d'affectation, pas le comportement de l'application.

## Complément — le produit à construire, après clarification de l'auteur

Ce complément remplace le périmètre « conformité seulement » de la première revue.
Le produit est desktop. Le design reste décidé, mais les maquettes peuvent évoluer.
Le premier parcours est le personnage animé ; l'IA qui développe un jeu Godot le demande
par le MCP de l'atelier. Les points ci-dessous viennent du code et des contrats lus,
pas d'une validation du fonctionnement réel des moteurs.

| Critique | Preuve ou limite | Conséquence proposée |
|---|---|---|
| Les maquettes organisent les outils davantage que le résultat du jeu | Fiche, images, animations et essai sont des portes séparées ; le besoin final se recompose de tête | Une page de personnage montre objectifs, couverture, sources et livraison ; les outils s'ouvrent depuis le résultat visé |
| Le plan de poses fixes devient du travail inutile pour un personnage animé | L'auteur le signale ; `PageDuSujet.tsx` conserve fiche/images/animations/essai et la matrice en profondeur | Choisir fixe, animé ou mixte ; une référence technique n'est pas un livrable à compléter |
| L'interface et le MCP ne couvrent plus le même parcours de production | `atelier/mcp/serveur.py` ne propose ni demande de clip ni montage/export de bande ; `export_character` appelle la sortie des images fixes | Faire de la boucle MCP → animation → Godot un premier critère de livraison, pas une annexe de fin de projet |
| « Modèle gratuit d'exploration » ne couvre pas tous les besoins de l'agent | `docs/archi-fournisseur.md` réserve la production à l'interface ; le code impose un modèle via le service agent | Un cadre par capacité et par jeu autorise le travail autonome sans retirer les références ni basculer vers du payant en silence |
| La préférence d'une animation n'est pas encore un contrat commun | `AnimationsDuSujet.tsx` démote les favoris concurrents côté client ; son commentaire précise que l'export ne lit pas ce champ | Centraliser le départage et distinguer préféré, sélectionné pour la livraison et effectivement livré |
| La règle « pas de local » contredit déjà une fonction livrée | `maison.py` parle à ComfyUI, soumet un montage vidéo et garde son identifiant | Corriger les documents d'autorité avant d'étendre à l'image et à d'autres workflows |
| Intégrer asset3d ne consiste pas à recopier son écran | Le voisin conserve modèle, squelette, rigs et rendus, avec plusieurs routes ; son PRD initial a été dépassé par ses phases ultérieures | Réutiliser ces capacités derrière un adaptateur, rattacher leurs sources au personnage et conserver une seule bibliothèque utilisateur |
| Deux applications locales peuvent se croire seules sur le GPU | Les voies d'`asset3d/serveur/executeur.py` sont verrouillées dans son processus ; Maison ne partage pas ces verrous | File des travaux possédés, observation de la concurrence et aucune interruption globale d'un travail extérieur |
| Rejouer un rendu 3D ne garantit pas de reproduire son ancienne version | Le contrat de rendu du projet voisin asset3d (fichier `CONTRAT-RENDU.md`) reprend les corrections du squelette du moment | Conserver la révision réellement utilisée et distinguer reproduction et rendu avec nouvelles corrections |
| Un ZIP n'est pas la preuve d'une intégration au jeu | L'export de bandes existe, le parcours Godot confirmé reste à prouver | Ouvrir une scène réelle, vérifier cadence/boucle/pivot et une mise à jour sans références cassées |
| Le suivi mélange état actuel et récits de livraison | La seule cellule V4 du tableau général dépassait vingt mille caractères | Conserver une ligne d'état lisible et déplacer le relevé détaillé en archive, sans effacer les enseignements |

**Critique brève des maquettes :** la direction graphique est exploitable ; les difficultés
se situent surtout dans la hiérarchie des actions, le morcellement du travail et l'absence
d'un objectif de livraison visible. Les nouvelles maquettes doivent être jugées sur un
parcours complet, avec états vides, attente, erreur, reprise et remplacement dans le jeu.
Le nombre d'écrans dessinés ou de cases cochées ne suffit pas.

Le [plan de l'atelier unifié](PLAN-atelier-unifie.md) reprend ces décisions. La
[première maquette interactive](maquettes-atelier-unifie/01-parcours.html) illustre le parcours ;
ses données sont fictives, son sprite est un témoin fixe, ses contrôles de montage ne sont
pas un nouvel éditeur et aucune livraison Godot n'y est réellement effectuée.

### Vérifications de ce complément

- Parcours simulé exercé au navigateur : demande, arrivée des bandes, retour au personnage,
  choix d'une version, préparation et simulation d'une livraison partielle.
- Fenêtres desktop : largeur de document égale à la fenêtre à 1280 et à 1600 pixels ;
  commandes d'édition accessibles, visuel local chargé, aucune erreur JavaScript relevée.
- Syntaxe du script de la maquette vérifiée. Les formulaires encore illustratifs et les
  limites de la simulation sont nommés dans la page ; elle ne prouve pas une génération.
- Banc documentaire : **1 749 renvois résolus, aucun cassé**. Le renvoi CSS préexistant
  vers un titre absent est corrigé en simple référence à sa planche, sans changer le style.
- **Corpus de démarrage : 159,4 Ko, −32,6 Ko par rapport au relevé précédent**. L'ancien
  cadrage et le détail de la cellule V4 sont archivés ; les invariants restent au démarrage.
- Aucun fournisseur, GPU ni projet Godot réel n'a été sollicité. Les suites de l'application
  ne sont pas relancées pour ces documents, cette maquette et un commentaire CSS.

### Complément — essayer une maquette plus large avant de modifier le produit

La [seconde maquette](maquettes-atelier-unifie/02-atelier.html) répond au besoin de tester
les écrans et de découvrir les exigences manquantes. Elle garde la toile créative, la
création manuelle complète sans MCP, la place des tables et une retouche manipulable.
Son [inventaire de couverture](maquettes-atelier-unifie/couverture.md) répartit les 49
planches de référence et distingue gestes réels, simulations et détails encore absents.
Ce n'est pas une livraison des fonctions AU ni une maquette exhaustive de chaque table.

**Ce que cet essai a déjà corrigé.** La première proposition faisait disparaître trop de
capacités derrière sa simplicité ; les tables et la toile retrouvent des portes explicites.
Dans la seconde, une cadence changée juste avant « Garder » revenait à sa valeur précédente :
la saisie est désormais retenue immédiatement. Peindre pendant la lecture fixe la frame
visée et rend sa sélection visible. Les remarques sont proposées en texte copiable, car
l'événement de téléchargement du navigateur intégré n'a pas pu être confirmé.

**Parcours exercés dans le navigateur :**

- Sujet neuf sans MCP → refus explicite d'animer sans référence → image simulée → animation
  simulée → échec → reprise explicite → résultat. L'origine affichée reste manuelle.
- Montage : duplication d'une frame, lecture, peinture, cadence de 12 i/s, boucle désactivée,
  sauvegarde, sortie et réouverture, puis rechargement complet. Six frames, le trait peint
  et les réglages différents du défaut sont relus.
- Toile : ajout et annotation d'une note, association à un îlot, position saisie, zoom à 60 %,
  déplacement à la souris de l'îlot et de ses cartes d'un même delta, rechargement et relecture.
- Livraison : choix d'un second résultat, aperçu et historique de deux révisions ; ouverture
  d'un conflit fictif et choix de copie séparée, sans écriture dans le jeu.
- Moteurs : indisponibilité locale, méthode API indisponible, envoi agent désactivé quand
  aucun moyen autorisé n'est disponible ; réactivation indépendante du moteur local.
- Source 3D : modèle et rig simulés, choix du rendu 3D puis résultat fictif en bibliothèque.
- Remarques : note contextualisée, rechargement et export en texte copiable relus. Le
  téléchargement reste dépendant du navigateur ; il n'est pas nécessaire pour transmettre
  les notes.
- Fenêtres desktop 1280 × 800 et 1600 × 1000 : aucun débordement horizontal du document
  sur les surfaces observées ; la toile et la timeline gardent leur défilement propre.
  Aucune erreur JavaScript relevée en console après les parcours.

**Limites de vérification :** import de fichier utilisateur, gomme multi-frame, toutes les
combinaisons de recettes, sélections avancées et toutes les transitions possibles n'ont pas
été exercés. Aucun test de l'application réelle, appel fournisseur, GPU ou import Godot
n'a été exécuté. La matière visuelle est reprise de fichiers déjà présents dans le dépôt.

Syntaxe JavaScript et liens documentaires vérifiés. **Corpus de démarrage : 161,3 Ko,
−30,6 Ko par rapport au relevé de référence** ; le détail de couverture reste dans l'annexe.

### Complément — tables, composition, découpe et extraction

Les retours de l'auteur lèvent une erreur d'organisation de la seconde maquette : elle
rangeait découpe, différence et calques parmi les tables de recette. Le code existant
confirme la distinction : la découpe fabrique plusieurs images ; le calque conserve une
différence recalée et une correction manuelle. Ces parcours méritent leur propre espace.
« Grille » devient **Pixelisation** pour la table de réduction, sans renommer les grilles
de découpe ou les repères. L'identité de DESIGN.md reste inchangée.

L'inventaire de couverture décrit les capacités et leurs limites. Les exigences sont
précisées dans US-536, puis dans AU4 ; l'affectation conserve MEDIUM pour cette composition
de mécanismes existants. Aucun écran du produit n'est remplacé par le prototype.

**Preuves navigateur de ce complément**, dans une séance de démonstration séparée :

- Sélecteur de table, panneau Calques et sauvegarde d'un calque nommé « Reflet lanterne ».
- Planche d'essai : quatre zones détectées. Nom et X modifiés, relecture, quatre images
  créées avec original conservé, reprise depuis un résultat : quatre zones et X=30 relus.
- Souris : zone déplacée de X=30/Y=14 à X=40/Y=20 ; taille passée de 47×94 à 56×102 ;
  rectangle libre 22×22 ajouté, puis annulé. Les quatre zones donnent une animation de
  quatre frames. L'extraction depuis la frame 2 reprend bien cette frame comme base.
- Exemple équipé : proposition X=0/Y=0/échelle=100 %, 1 147 pixels isolés. Un trait Garder
  passe à 1 172 ; Annuler revient à 1 147. Nouvelle correction gardée, rechargement complet,
  réouverture : 1 172 pixels et le trait manuel sont retrouvés. L'opacité de superposition
  à zéro ne change pas ce compte, car elle sert seulement au calage visuel.
- Composition : calque décalé de 7 pixels et masqué, puis enregistré. Reprendre l'extraction,
  la renommer et la garder conserve le déplacement et la visibilité ; la pile reste à
  deux calques, sans duplication de l'élément corrigé.
- Frame équipée : choix de la variante en bibliothèque, ajout sur la frame 3 d'une bande,
  duplication en frame 4 avec copie de son calque ; Annuler restitue cinq frames et trois
  calques. La copie de calque se règle indépendamment ; son masque d'extraction reste celui
  de l'élément source, sans lien de modification automatique sur les copies.
- Toile : l'atelier propose seulement des cartes en sortie. Quatre découpes et leur
  nouvelle planche originale s'ajoutent aux trois cartes existantes ; le nombre d'assets
  reste à deux. Aucun appel IA et aucune erreur JavaScript relevée sur ces parcours.

**Points à continuer d'éprouver :** changement rapide de calque/table, sélection et pipette,
gouttières de découpe, remplacement explicite d'un ancien découpage, placement de grands
lots sur la toile, éléments par pose et emplois d'équipement. Le recalage et la différence
du prototype restent des calculs de démonstration ; ce test sur une copie modifiée ne
mesure pas la robustesse sur des personnages générés séparément.

Le navigateur utilisé pour ce complément mesure **1280 × 720** : le sélecteur de table
et les accès aux ateliers restent visibles, avec un document de 720 px de haut. Les longues
listes et les réglages défilent dans leur panneau. Une peinture pendant la lecture fixe
la frame 3 ; le calque « Reflet lanterne » est retrouvé après rechargement. Les nouvelles
interfaces d'import de fichiers n'ont pas été exercées ; les essais utilisent les images
déjà présentes dans le dépôt, les exemples et le choix dans la bibliothèque.

Contrôles : syntaxe des deux scripts et `git diff --check` sans erreur ; **1 753 renvois
documentaires résolus**. **Corpus de démarrage : 161,7 Ko, −30,3 Ko par rapport au relevé
de référence**. La mesure a été écrite dans un emplacement temporaire pour préserver ce
relevé. Les tests et moteurs de l'application réelle ne sont pas concernés par ce complément.

## Retours de l'auteur à 21 h 49 et nouvelle itération

L'auteur a coché les six parcours d'essai et signalé neuf difficultés. Leur traduction
en critères de production est portée par AU2 à AU4 ; aucune tranche AU n'est cochée ici.
La couverture décrit les nouvelles interactions et leurs limites.

Essais navigateur dans une session de démonstration séparée, sans toucher aux remarques
de l'auteur :

- Création d'une animation après modification de la consigne et ajout d'une référence par
  recherche « lanterne » : deux références et le texte modifié sont retrouvés dans
  « Relire l'envoi » après rechargement, avec le modèle local de démonstration.
- Arborescence : une version retenue et une à juger, puis passage de cette dernière dans
  les écartées et retour à juger ; les filtres de galerie suivent ces changements. Le
  survol d'une vignette passe de la frame 1 à la frame 5, avec le sprite entier visible.
- Extraction à 400 % : un déplacement de 40 × 20 px à l'écran change X de 11 à 21 et Y
  de −3 à 2. Les valeurs et curseurs restent synchronisés. Déplacer ensuite la vue change
  seulement son défilement. Un pinceau de 5 px affiche une empreinte de 20 px à ce zoom.
- Retouche : zoom à 800 %, soit un aperçu de 512 px pour une source de 64 px ; changer
  de Main à Détourage conserve ce zoom. La découpe utilise le même composant de navigation,
  mais son zoom n'a pas fait l'objet d'un essai distinct dans cette itération.
- Équipement : filtre de famille, sélection de l'icône et association montrent son aperçu
  dans la fiche. La portée de l'élément explique une frame ou un placement fixe sur toutes.

Aucune erreur JavaScript relevée. Les imports depuis un fichier et le changement du prix
fictif payant restent à exercer ; aucun tarif réel ni moteur IA n'a été testé. Le choix
retenu désigne ici explicitement la version destinée au jeu : l'écarter ne promeut donc
pas silencieusement une autre version. Cette distinction devra être conservée lors du
raccord aux états de jugement existants.

### Ajustement aux captures de la version actuelle

Les volets de mouvement deviennent fins et les directions de simples rangées, avec
retenue isolée à gauche et génération à droite. Les aperçus redondants dans les en-têtes
sont retirés ; la galerie filtrable reste dessous. Essai navigateur : déplier Marche,
écarter sa version retenue, la remettre à juger puis la retenir de nouveau fonctionne.
La capture confirme l'alignement compact ; le minimum desktop existant de 1 100 px reste
applicable. Syntaxe JavaScript et vérification des espaces Git sans erreur.

## Complément du relevé de 22 h 28

Références de code consultées : Galerie, Arbre, navigation des familles et collections
dans App, puis Montage. Le montage existant conserve le clip payé et peut en tirer
plusieurs bandes ; ses deux aperçus sont synchronisés. Les collections organisent les
choses du jeu, tandis que la galerie permet de réutiliser les résultats. L'équipement
dans le produit a un domaine distinct : la fiche simplifiée de la maquette n'est pas une
proposition de migration de ce domaine vers une famille générique.

Essais dans une session séparée :

- Créer « Casque » depuis le pèlerin ouvre sa fiche et une demande d'image avec la
  référence « Le pèlerin » visible à la relecture. Simuler le résultat conserve la fiche.
- Fabriquer librement « Brume du marais » en vidéo, avec dépôt sur la toile, produit une
  entrée de galerie et une carte ; son clip d'exemple ouvre le montage.
- Sélectionner les frames 5 → 3 → 1, nommer « Marche courte · Sud », choisir 6 images/s
  et désactiver la boucle ; garder, recharger et reprendre retrouve ces choix. Le premier
  essai a révélé des champs texte/numériques ignorés avant perte de focus ; la prise en
  compte immédiate a été corrigée, puis le même parcours a été rejoué avec succès.
- Créer la collection « Habitants du marais », y ranger le pèlerin, recharger et ouvrir
  la collection depuis la navigation retrouve un asset.
- Fabriquer une source 3D fictive avec une référence choisie en bibliothèque, filtrer la
  galerie sur 3D, puis ouvrir la préparation des rendus mène au parcours 3D existant.

Aucune erreur JavaScript relevée sur ces essais. Les médias sont des exemples, aucune
génération réelle n'a été lancée. Les détails de couverture et les contrôles non éprouvés
restent dans la couverture du prototype ; les critères de production AU restent ouverts.

Complément de vérification : le brouillon « Brouillon conservé », avec trois frames,
survit à un rechargement sans création de bande. La carte « Brume du marais » propose
un accès au résultat depuis la toile. Syntaxe des scripts et vérification Git sans erreur ;
**1 753 renvois documentaires résolus, corpus de démarrage 162,2 Ko, −29,7 Ko depuis le
relevé de référence**, préservé grâce à une mesure temporaire.

## Retours de 22 h 56 : emplois et montage

Lecture du domaine équipement, des écrans Emploi/VestiaireDuSujet et des planches
Emplois/Emploi : une pièce est réutilisable et un emploi porté est unique par couple
pièce/personnage. Devant/derrière appartient à l'emploi. Attention : le commentaire ancien
d'Emploi dit que B20 reste à construire ; le domaine calque_anime contient désormais
ce suivi. Il recale un calque de pose sur chaque frame ou utilise un seul calage pour la
bande, sans créer une image indépendante par direction. Le report concerne l'extension
complète des variantes et placements, pas la suppression de cet existant.

Essai navigateur : bande nommée « Pas prudent », liée explicitement au pèlerin, Marche,
Ouest. Déplacement au clavier puis glisser-déposer natif : ordre final 1 → 3 → 2 → 4 → 5.
Après sauvegarde et rechargement, les trois choix et l'ordre se retrouvent. Depuis le
pèlerin, utiliser la pièce existante « La lanterne » ouvre sa fiche d'emploi sans copier
de pièce. L'inventaire marque les calages non renseignés, et aucune frame n'est annoncée
comme équipée par la seule présence d'une image de préparation.
La réouverture retrouve « Main gauche » et « Derrière le corps ». Préparer une image
depuis cet emploi propose bien la référence du pèlerin et sa mention dans la consigne.
Aucune erreur JavaScript relevée sur ces parcours.

## Précision suivante : équipements complets et tenues combinables

L'auteur précise le but et annule le report proposé : une pièce commune représente
l'équipement du jeu, ses emplois portent les adaptations propres à chaque personnage,
et les calques couvrent ses poses, directions et frames d'animation. Le gain recherché
est de préparer chaque équipement séparément puis de combiner les calques, sans générer
le personnage pour toutes les combinaisons possibles. Le plan ajoute AU15–AU17 ; aucune
de ces tranches de production n'est déclarée livrée par les essais ci-dessous.

Le parcours interactif remplace l'inventaire provisoire. Il propose sources équipées,
extraction, contrôle des superpositions, correction par frame, versions, puis tenue et
sorties d'essai. Le module de rendu dessine les équipements de démonstration ; ces images
ne viennent pas d'un modèle IA. La séparation entre pièce et emploi est effective dans
l'état du prototype, sans proposer sa sauvegarde locale comme schéma du futur produit.

**Preuves navigateur, dans la session séparée `?essai=equipements-complets` :**

- Depuis le pèlerin, créer « Casque », « Sac à dos » et « Épée divine ». Pour chacune,
  générer six images équipées simulées, extraire les différences de pixels, relire les
  superpositions en groupe puis valider les six calques.
- Activer les trois équipements pendant que l'animation joue, sans arrêter la lecture.
  Garder la tenue « Exploration armée », recharger et la rouvrir retrouve les trois cases
  activées. Cet essai ne prétend pas avoir parcouru séparément les huit combinaisons.
- Créer « Le nain », avec une bande Marche, Ouest, cinq frames ; lui attribuer la même
  « Épée divine ». Son nouvel emploi commence à zéro sur cinq calques, sans hériter de la
  couverture du pèlerin. Régler sa frame 2 à X = 9, Y = −4, garder puis recharger retrouve
  ces valeurs. Le pèlerin est encore à X = 0, Y = 0 avant ses propres ajustements.
- Déplacer directement le calque du pèlerin sur sa frame 2 donne X = 5, Y = 2. Le masque
  montre une empreinte de pinceau de 12 pixels à l'écran au zoom 400 %. Valider puis rouvrir
  retrouve les valeurs de placement ; ce geste ne change pas l'emploi du nain.
- Régénérer la frame 2 du nain, puis restaurer la version précédente retrouve X = 9,
  Y = −4 et l'état « Prêt ». La source nouvelle n'a pas effacé le travail précédent.
- La galerie contient alors 22 entrées d'épée des deux héros et ouvre la bonne frame.
  Le journal Fabrications montre le modèle fictif, la consigne et les images de base envoyées.
- Modifier la base du nain par miroir horizontal puis garder fait passer son calque
  d'épée de la frame 2 à « Base modifiée » ; sa validation est désactivée. Relancer
  l'extraction depuis l'ancienne source ne retire pas l'alerte et ne réactive pas la validation.
- Déclencher les deux exports ne lève pas d'erreur relevée. Les téléchargements n'ont pas
  été inspectés : ni leur contenu, ni leur format final, ni un import dans Godot ne sont validés.

**Limites de cette preuve.** Les calages, masques et compositions travaillent localement
sur des PNG de 64 × 64 ; les imports sont ramenés à ce cadre. Les sources sont des fixtures
sur lesquelles l'équipement est dessiné. Aucune génération IA, aucun moteur de suivi réel
et aucun importeur Godot n'ont été exécutés. La reprise complète sur une nouvelle base,
le réordonnancement d'une animation déjà équipée et la charge avec 300 frames n'ont pas
encore été testés.
Les calques de pose et emplois B20 existants sont conservés dans le plan ; leur relecture
réelle n'est pas une propriété démontrée par ce prototype indépendant.

Les six scripts passent la vérification de syntaxe JavaScript. La couverture distingue
ces parcours éprouvés des traitements simulés et des contrôles encore absents.
Le journal conserve désormais l'estimation annoncée sur les nouveaux envois ; une ancienne
fabrication sans estimation reste inconnue, au lieu de recevoir un prix recalculé après coup.

La fiche commune « Épée divine » a été ouverte depuis les équipements du pèlerin :
elle présente les deux emplois séparés et leurs couvertures, puis les références communes.
Le choix d'un nouveau porteur montre les deux personnages avec leurs aperçus.
Contrôle final : six scripts syntaxiquement valides, aucune erreur JavaScript dans les
parcours décrits, `git diff --check` sans défaut ; 1 753 renvois documentaires résolus,
corpus de démarrage 163,5 Ko, −28,5 Ko depuis le relevé de référence conservé.

## Relevé de 23 h 53 · corrections du 12 septembre

Lecture du domaine équipement, de `Emplois.tsx`, `Emploi.tsx` et du service équipement :
B19 possède déjà trois genres d'emploi, un porteur unique par couple pièce/personnage,
et une liste centrée sur les usages. Cette structure est conservée dans la proposition.
Le pliage C3 compose les corps retenus dans une planche à géométrie connue, y compris
pour une seule pose ; le dépliage produit les calques et ne refait pas l'appel. Son
extension aux frames reste une tranche de production, pas une capacité serveur ajoutée ici.

Le montage local ComfyUI conserve une graine de bruit mais part d'une image de départ.
Cela ne constitue pas un port de modification d'un clip complet. La
[documentation RandomNoise](https://docs.comfy.org/built-in-nodes/RandomNoise) décrit une
graine qui reproduit le bruit ; en déduire un mouvement identique après changement de
consigne serait injustifié. Aucun profil vidéo supplémentaire n'a été installé.

Essai séparé `equipements-appels` : cinq frames ciblées annoncent un appel en planche de
six cases, deux appels en capacité quatre, ou cinq appels individuels. Les estimations
fictives affichées étaient respectivement 0,04 $, 0,08 $ et 0,20 $ au même prix d'appel.
Le résultat regroupé a été déplié dans le navigateur, extrait et validé : 5/6 calques,
la sixième cible étant l'image fixe volontairement exclue. Aucun appel réel.

Une image retouchée est devenue référence d'une nouvelle pièce. La fiche montre ensuite
« Ses emplois · 2 » : porté par le pèlerin, et icône d'inventaire déclarée à part.
La même référence a été associée explicitement comme image équipée à Marche/Sud/frame 2
du sac ; état « À extraire », puis restauration du calque précédent. Le pinceau d'ordre
partiel a placé des pixels du sac sous le personnage, visible dans l'aperçu et rouvert.
Pas d'erreur JavaScript relevée. Après rechargement, les deux emplois et la référence
associée se retrouvent ; la planche équipée dépliée reste présente en galerie.
La vérification visuelle sur plusieurs angles réels reste à faire.

Contrôles de fin : les cinq scripts touchés passent leur vérification de syntaxe,
`git diff --check` ne signale aucun défaut ; les 1 753 renvois documentaires sont valides.
Corpus de démarrage : 163,6 Ko, −28,4 Ko par rapport au relevé de référence conservé.
