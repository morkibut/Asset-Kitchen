# Revue complète UI / UX — 12 septembre 2026

> **Lecture rapide : cette première partie suffit pour décider de la suite.**
> Audit comparatif de la maquette interactive, de l'application réelle et des pistes du
> 4 septembre. État du code examiné : `f843d15`, branche `codex/atelier-unifie`.
> Ce document contient des constats et des **propositions à éprouver** ; il ne remplace
> ni le PRD, ni DESIGN.md, ni le plan actif. Aucune correction produit n'est livrée par cet audit.

## À retenir en une minute

**La direction est bonne, mais la maquette a grandi par ajouts successifs et ses parcours
ne sont pas encore assez cohérents entre eux.** Son atelier commun, ses équipements et
sa navigation sont une base solide. Les anciennes maquettes et le code réel restent plus
mûrs sur le rangement, le montage, les règles de génération et la préparation des fichiers.

Je recommande de conserver le style papier, la hiérarchie mouvement → direction, les
versions en rangées, la galerie, la toile libre et les outils à droite, puis de traiter
ces sept priorités :

1. **Ne jamais perdre une correction ni sa position de travail.** Le vrai éditeur perd une
   cadence modifiée si l'on ferme sans enregistrer ; il ne prévient pas.
2. **Donner la place aux images.** Entête compacte, panneaux ajustables et repliables,
   timeline visible, commandes de zoom identiques dans tous les ateliers.
3. **Faire une seule préparation d'envoi.** Même présentation pour une image, un clip,
   des équipements et un rendu 3D ; références, paramètres et coût réellement lisibles.
4. **Préparer le rangement d'un gros jeu.** Liste dense, filtres enregistrés, collections
   complètes et regroupement des résultats dérivés. Un seul sac essayé sur six images
   ajoute déjà treize entrées à la galerie de la maquette.
5. **Rendre les équipements compréhensibles à l'échelle d'une animation.** Couverture
   honnête, aperçu en mouvement, correction des seules frames problématiques, pièce
   commune et adaptations par héros clairement reliées.
6. **Relier la toile au travail de fabrication.** Une ambiance ou un groupe de références
   doit pouvoir alimenter un envoi par un geste explicite, en conservant les notes libres.
7. **Prouver la dernière étape dans Godot.** Le code de sortie fixe actuellement la cadence
   à 8 i/s et ne reprend pas l'aller-retour. L'animation livrée doit respecter ce qui a été préparé.

**Le prochain pas utile est une consolidation du prototype sur ces parcours**, avec des
jeux d'essai réalistes. Le plan AU commence déjà par la preuve Godot : cet ordre est pertinent.
Ajouter des écrans spécialisés restera nécessaire pour la 3D, les tuiles et le son, aux
étapes prévues. Une application agréable se vérifie sur les gestes complets, les reprises
et les erreurs ; le nombre d'écrans dessinés ne suffit pas.

## Ce qui a réellement été examiné

Trois lectures ont été croisées avec des parcours navigateur. **Observé** signifie vu ou
manipulé dans le navigateur ; **code** signifie établi par lecture, sans preuve d'exécution
du scénario ; **proposition** décrit le comportement souhaité.

| Support | Couverture de cette revue | Limites |
|---|---|---|
| Prototype, port 8496 | Accueil, assets et création, fiche et onglets, huit tables, calques, extraction, découpe, équipements/emplois, génération groupée, dépliage, validation, composition, galerie, fabrications et échec/reprise, libre vidéo, montage, toile, quatre rubriques de réglages, livraison/conflit, comparaison, source 3D, aide et remarques | Session séparée `?essai=audit-complet-20260912`. Générations simulées. Pas de test de toutes les permutations, de tous les pinceaux ni des fichiers exportés |
| Application réelle, port 8502 | Vrai build React et vraie API : galerie, personnage, images/animations, atelier de bande, retouche/Main, vestiaire, pièce, emploi, habillage, toile/grille. Cadence changée pendant lecture, fermeture et réouverture, puis enregistrement et réouverture ; zoom essayé | Script existant `essais/atelier_jetable_verif_d6.py`, données temporaires, fournisseurs doublés. Build du 11 septembre 21 h 32, postérieur aux sources contrôlées. Aucune donnée auteur modifiée |
| Anciennes maquettes | Rendu navigateur de Sommaire, Famille, Toile, Envoi, Atelier-animation, Sortie et trois-pistes/CarnetFaire ; lecture ciblée des autres planches de navigation, galerie, relecture, états et vocabulaire | Planches essentiellement statiques ; leurs textes historiques ne prouvent pas le comportement actuel |
| Code actuel | Navigation, galerie, relecture, montage, recettes, emplois/calques, export, catalogue et façade MCP ; rapprochement avec les scripts du prototype | Pas de nouvelle exécution des suites de tests, ni de génération réelle, ni de Godot/ComfyUI/asset3d exécuté |

Les fenêtres observées mesuraient environ **1265–1270 × 712 px de surface disponible**.
C'est un cas de fenêtre desktop, pas une demande de version mobile. Le comportement sur
de grands écrans et avec une mise à l'échelle Windows différente reste à vérifier.
Aucune erreur de console n'a été relevée dans les parcours navigateur inspectés.

## Les acquis à conserver

| Acquis | Pourquoi il compte |
|---|---|
| Personnage → mouvements dépliables → directions → versions | Correspond à la manière de produire et corriger les sprites ; conserve la préférence explicite de l'auteur |
| Retenue à gauche, autres versions à côté, galerie filtrable en complément | Permet de choisir vite puis de revoir les essais ; garder la galerie sous les rangées, éventuellement repliable |
| Retouche et montage réunis autour d'un aperçu, avec table sélectionnable | Réduit les changements d'écran pendant une correction ; les calques restent une structure de composition distincte |
| Originaux, recettes et sources conservés | Permet de corriger, comparer et reprendre sans repayer ni reconstruire de mémoire |
| Pièce commune → emploi par héros → calques adaptés → tenue | Résout le besoin de l'épée divine commune à plusieurs héros et évite de générer toutes les combinaisons |
| Familles, collections, galerie et fabrication libre | Une chose du jeu et un média produit sont distincts ; une exploration peut exister avant d'être rattachée |
| Toile libre, réserve, îlots, ambiances et palettes de l'existant | Garde la dimension créative du projet ; elle doit rester un véritable outil de conception |
| Catalogue, relecture exacte et reprise des travaux déjà soumis | Maintient une demande compréhensible, compatible avec le moteur et contrôlable avant la dépense |

## Les constats qui conditionnent la fiabilité

P0 désigne ici un point bloquant pour promettre le parcours complet. P1 désigne une friction
importante à régler avant de généraliser la nouvelle interface. P2 désigne un gain de confort.
Une priorité d'audit n'est pas une nouvelle tranche ni un changement automatique du plan.

### C01 · P0 — La fermeture peut perdre le travail

**Observé dans l'app réelle.** Marche de cinq frames à 8 i/s → saisir 11 i/s pendant la
lecture → « des corrections attendent » → fermer → rouvrir : retour à 8 i/s, sans
avertissement. En passant par Enregistrer, 11 i/s est bien retrouvé. La sauvegarde fonctionne ;
la sortie de l'éditeur ne protège pas le brouillon. Le titre garde aussi l'ancienne durée
jusqu'à l'enregistrement alors que la cadence a changé.

**Proposition.** Un contrat commun de brouillon : état « enregistré / modifications en cours »,
conservation récupérable, sortie proposant garder/abandonner/continuer si nécessaire.
Afficher la durée du travail en cours. Couvrir fermeture, changement d'asset et redémarrage.
La protection déjà présente dans la retouche du prototype est une base à généraliser.

**Preuve :** `interface/src/composants/AtelierDeBande.tsx:1117`, `:1126`, `:1180` ;
`docs/maquettes-atelier-unifie/prototype.js:61`, `:433`.

### C02 · P0 — « Retenue », « prête » et « livrée » doivent avoir le même sens partout

**Code et observation réelle.** La fiche tente d'imposer une animation favorite par deux
appels successifs. L'export prend toutes les bandes vivantes non vides. Une animation
seulement gardée affiche néanmoins « c'est elle qui sortirait dans le jeu ». La nouvelle
maquette sépare mieux favori et retenue : conserver cette distinction.

**Proposition.** Une version retenue par mouvement/direction et nature de résultat, un
favori personnel indépendant, un état de contrôle, puis une révision effectivement livrée.
Afficher « retenue, modifiée depuis la livraison » lorsque c'est le cas. Exporter les autres
versions doit être un choix visible. Les équipements et le MCP doivent lire le même choix.

**Preuve :** `AnimationsDuSujet.tsx:493`, `:697` dans `interface/src/composants/` ;
`atelier/services/montage.py:545` ; `atelier/services/sortie.py:706`.

### C03 · P0 — La livraison Godot peut changer l'animation

**Établi dans le code ; pas exécuté dans Godot.** Le générateur de ressource Godot parcourt
les frames dans l'ordre croissant et écrit `speed: 8.0`. Les métadonnées de cadence et
de sens existent pourtant : l'APNG reprend l'ordre aller-retour et le JSON Aseprite porte
l'indication correspondante, mais la ressource Godot ne les reprend pas. Le `loop: true`
écrit également correspond aux modes répétitifs actuels ; il n'est pas, à lui seul, un défaut.
La promesse « ce que je vois est ce que je livre » demande donc une preuve supplémentaire.

**Proposition.** Faire de l'aperçu de livraison une relecture de la sortie préparée : ordre,
cadence, boucle, dimensions communes et ancrage. Présenter fichiers nommés, destination,
créations/remplacements/inchangés et conflits. Après livraison, conserver la révision et
permettre de mettre à jour seulement ce qui a changé.

**Preuve :** `atelier/services/sortie.py:956–985` ; `atelier/services/export.py:598–599`.
Bonne référence d'UI : `pistes-2026-09-04/carnet/Sortie.dc.html:187`, `:216`, `:224` dans `docs/`.

### C04 · P0 — Les mêmes parcours doivent être réalisables à la main et par MCP

**Code.** Le registre MCP actuel expose des gestes d'image, de poses et d'équipement fixe,
mais ne propose pas encore le parcours vidéo → montage → animation → livraison attendu.
Ce manque est déjà couvert par AU1/AU3 ; le prototype ne constitue pas son implémentation.

**Proposition.** La fiche et Fabrications présentent une même demande, quel que soit son
auteur. Elle indique le résultat recherché, la source, les étapes effectuées, le coût annoncé,
ce qui bloque et la prochaine action. L'auteur peut reprendre une demande de l'agent et
inversement, dans le cadre de délégation défini. Le parcours manuel reste autonome.

**Preuve :** registre `atelier/mcp/serveur.py:163–1167` ; `docs/PLAN-atelier-unifie.md`, AU1/AU3.

### C05 · P0 — L'équipement complet dépasse les calques actuels par pose

**Code et parcours réel.** L'identité de pièce, les emplois et le vestiaire existent.
Le calque de pose est réutilisé et recalé sur les bandes ; il n'est pas une image différente
pour chaque direction et chaque frame. La maquette représente le contrat élargi demandé,
mais ne prouve pas la génération ni la compatibilité de ces images.

**Proposition.** Conserver la pièce commune et ses emplois. Chaque emploi porte une
couverture mouvement → direction → animation de base → frame, ses images et corrections,
et l'état « à revoir » après changement de base. Les réglages déjà corrigés restent conservés.
Une nouvelle version du corps ne doit pas rendre silencieusement les anciens calques valides.

**Preuve :** `atelier/domaine/equipement.py:151`, `atelier/domaine/calque_anime.py:10` ;
`interface/src/composants/CalquesAnimes.tsx:13–19` ; prototype `equipements.js:30–34`.

## Les améliorations concrètes de la maquette

### C06 · P1 — Un châssis desktop qui laisse travailler

**Observé.** Sur la fiche du pèlerin, la première rangée commence vers le bas de la fenêtre ;
le mouvement vide Repos est ouvert alors que Marche contient le résultat utile. Dans l'emploi
du sac, l'aperçu des frames est repoussé après une grande zone de réglages et d'explication.
Dans l'atelier, les barres de défilement du carnet, de l'aperçu et de l'inspecteur se concurrencent.
Le montage commence par deux grands aperçus et repousse la séquence hors de la première vue.

**Proposition de composition commune :**

| Zone | Contenu et comportement proposés |
|---|---|
| Entête courte | Chemin cliquable Jeu / Personnage / Mouvement / Direction / Version ; état de sauvegarde et action principale |
| Gauche | Navigateur familles/collections, repliable ; état et largeur mémorisés |
| Centre | Image ou animation, outils de vue permanents ; maximum de place utile |
| Droite | Inspecteur ajustable : table sélectionnée, calque actif et portée ; détails avancés repliés |
| Bas de l'atelier | Timeline, lecture, cadence, boucle et frame active visibles ensemble ; défilement horizontal des frames |

Conserver la grande fiche descriptive lorsqu'on la consulte ; employer une entête compacte
lorsqu'on travaille. Les textes d'apprentissage restent accessibles à la demande. Tester
fenêtre desktop étroite, plein écran et mise à l'échelle Windows ; aucune adaptation mobile.

**Preuve :** prototype `prototype.css:31–43`, `:71–78` ; réel
`AtelierDeBande.tsx:1098–1106`. Les planches anciennes à largeur fixe ne sont pas à recopier :
leur panneau droit déborde aussi dans la fenêtre observée.

### C07 · P1 — Un zoom et des gestes identiques dans tous les ateliers

**Observé dans le réel.** Une image 32 × 32 occupe seulement 80 × 80 pixels à 250 % ;
Approcher est désactivé et saisir 800 % revient à 250 %. La maquette améliore le zoom,
mais l'éditeur d'équipement a encore ses propres commandes et modes de déplacement.

**Proposition.** Pour retouche, extraction, équipement, découpe et montage : zoom numérique,
100 %, adapter, forts grossissements pour le pixel, molette centrée sous le pointeur,
Espace + glisser et déplacement au pixel au clavier. Distinguer déplacer l'image/calque et
déplacer la vue par le curseur. Taille du pinceau visible, chiffre et curseur cohérents.
Ces gestes ne doivent jamais déplacer accidentellement la frame ou peindre.

**Preuve :** `interface/src/recette.ts:738` ; `Retouche.tsx:3808`, `:4673` ;
prototype `ergonomie.js` et `equipements.js`, ateliers de vue distincts.

### C08 · P1 — Une relecture unique, avec les images et le coût en premier

**Observé.** La relecture d'équipement est désormais cadrée et possède lecture/édition.
Mais la fenêtre initiale montre surtout les réglages ; références, planche et coût sont plus
bas. La relecture standard est directement éditable ; la libre a encore une troisième forme.
La durée et le nombre de clips sont disponibles dans le libre, pas dans l'envoi d'animation
standard. Les trois chemins n'enseignent pas le même fonctionnement.

**Proposition.** Un écran de relecture commun, avec résumé toujours visible : résultat demandé,
modèle/fournisseur, nombre d'appels et montant ou temps connu/inconnu. Au centre, les images
envoyées avec leur rôle ; à côté, le texte. Un bouton Modifier, puis les paramètres utiles
au modèle choisi et un volet avancé. Montrer ce qui vient de l'univers, du personnage et de
cet envoi, les références automatiques écartées par plafond et pourquoi. Les références
jointes volontairement par l'auteur ne cèdent jamais : un modèle qui ne peut les accepter
est signalé incompatible. Le coût total reste près du bouton.
L'édition de l'envoi ne modifie pas silencieusement les règles d'origine.

Pour le pliage, afficher chaque planche, les frames qu'elle contient, le nombre exact
d'appels et le résultat attendu. Le coût est par appel, pas une économie fictive par case.
Le temps local ne se multiplie pas naïvement par le nombre de clips. Les paramètres du
catalogue réel doivent remplacer les listes de démonstration au raccord.

**Preuve :** prototype `ergonomie.js` (relecture standard), `parcours.js:49`, `:91`,
`equipements.js:90` ; contrats utiles dans `Envoi.tsx:8–27`, `Clip.tsx:271`, `:328`.

### C09 · P1 — Créer une animation depuis un personnage vide sans détour mental

**Observé.** Créer Gardienne audit avec l'objectif Animations, puis Fabriquer, propose une
animation sans référence. Relire avant l'envoi reste actif et mène à un message demandant
de choisir Image fixe. L'information existe, mais le chemin demandé s'interrompt.

**Proposition.** « Préparer sa référence, puis animer » avec les deux étapes visibles,
possibilité d'importer une référence ici, de la sélectionner et de l'approuver avant la suite.
Les dépendances et leurs coûts sont annoncés. L'utilisateur conserve son mouvement et sa
direction pendant cette préparation. Une référence technique n'ajoute pas un objectif de
poses fixes au personnage. Remplacer le champ ambigu « Mouvement / nom du résultat » par
un mouvement choisi ou créé explicitement, puis un nom libre séparé.

**Preuve :** parcours navigateur de la création manuelle ; `prototype.js`, préparation d'envoi.

### C10 · P1 — Une bibliothèque adaptée aux centaines d'assets

**Observé et code.** La maquette pagine les assets par 24 mais n'offre qu'une grille de
grandes cartes. Le réel possède davantage de vues ; son carnet masque les collections
après les douze premières. La galerie réelle ajoute un deuxième explorateur à celui du carnet.

**Proposition.** Conserver les familles et collections dans le rail ; vue liste compacte et
grille à vignettes réglables ; recherche, tri et filtres conservés ; raccourcis « à produire »,
« à juger », « modifié depuis livraison ». Conserver le renommage et le rangement groupé
existants ; compléter par le retrait d'une collection et les autres actions groupées utiles.
Une collection peut regrouper sans dupliquer l'asset.
Les collections nombreuses restent accessibles par recherche, épingles et liste complète.

**Preuve :** `parcours.js:46–47` ; `Carnet.tsx:56`, `:567–581`, `Galerie.tsx:938` ;
anciennes `Famille.dc.html:114`, `:141`, `:224` et `Navigation.dc.html:529`.

### C11 · P1 — Tous les résultats en galerie, organisés par familles de dérivés

**Observé.** Le sac sur six images produit six sources équipées, six calques et une planche,
affichés à plat : la galerie passe de 3 à 16 résultats. Simultanément, la carte Sac de voyage
dans Les assets dit encore « 0 résultats / À fabriquer », même quand ses six calques sont prêts.

**Proposition.** Une pile par fabrication/animation, dépliable vers source, planche, frames,
calques et variantes. Tout reste trouvable individuellement ; le rangement n'exclut rien de
la bibliothèque. Filtres de rôle, jugement, famille/collection, origine et date, sélection
multiple et aperçu latéral. Sur la fiche d'une pièce, afficher séparément référence commune
et emplois : « référence à créer ; 1 emploi, 6 calques prêts » est honnête et utile.

**Preuve :** `parcours.js:30–48`, notamment `s.results.length` et l'aperçu `s.results[0]`.
Le badge et l'aperçu d'une carte doivent refléter son domaine, pas seulement sa liste d'images directes.

### C12 · P1 — L'emploi d'équipement doit commencer par son résultat et ses manques

**Observé.** La nouvelle liste d'emplacements est utile. En revanche l'ordre des calques
et son explication dominent l'écran. Le total 6/6 porte sur les bases existantes, tandis
que les mouvements/directions sans base sont dans un détail fermé : il peut être lu comme
« équipement terminé pour le personnage ».

**Proposition.** En premier : pièce, personnage, aperçu animé et couverture en deux niveaux.
Exemple : « Marche Sud : 5/5 frames prêtes ; 7 animations demandées attendent leur base ».
Compter seulement ce qui est demandé et séparer fixes/animations. Les emplacements sont
des noms d'usage ; l'ordre des pixels se règle visuellement dans le calque. Une petite vue
corps + sac rend dessus/dessous plus clair qu'un long texte, y compris en top-down 3/4.

Présenter les états par prochaine action : fabriquer, déplier, extraire, vérifier, revoir
après changement de base. Une commande de préparation peut enchaîner les traitements
locaux connus ; le détail et les reprises restent disponibles. Ne jamais convertir cette
automatisation en validation visuelle implicite.

**Preuve :** `equipements.js:30–34`, `:51–55` ; total et détail observés dans l'emploi du sac.

### C13 · P1 — Vérifier un équipement en mouvement avant de le dire prêt

**Observé.** Revoir la sélection montre six superpositions fixes et un bouton de validation
globale. La composition joue ensuite l'animation, mais c'est après cette validation.
L'extraction générale et l'atelier de calque d'équipement ont aussi des commandes distinctes.

**Proposition.** Une relecture avec lecture/ralenti/image précédente, équipement seul ou
composé, bouton « problème sur cette frame » et passage au problème suivant. Valider la
sélection après ce contrôle temporel. Relier l'extraction générale au même éditeur en
conservant pièce, emploi, direction et frame. Autoriser une image/calque libre sans équipement,
mais rendre son rattachement explicite si l'intention est d'équiper un héros.

L'import d'une variante équipée, la génération d'images regroupées et les rendus issus de
3D convergent vers les mêmes cibles. Une vidéo reprise avec un équipement ne doit pas être
présentée comme identique par la seule réutilisation d'une graine : sa correspondance avec
les frames existantes doit être vérifiée. La méthode de repli par images reste disponible.

**Preuve :** `equipements.js:154` et parcours validation → composition ;
`ateliers.js`, extraction générale ; `equipements-attribution.js`, rattachement existant.

### C14 · P1 — Restaurer le contexte après chaque détour

**Observé dans le réel.** Retour après enregistrement : Repos ouvert, Marche repliée,
« Rien de choisi ». Dans le prototype, le chemin affiche surtout le nom du type d'écran,
et les changements de page remettent le défilement en haut. Le rechargement initialise
la page et le sujet en dur dans le code.

**Proposition.** Revenir à l'asset, à la direction et à la version d'origine, à la même frame
et au même niveau de zoom. Mémoriser sélection, défilement, filtres et largeur des panneaux.
Historique précédent/suivant utile ; liens profonds ou documents récents si plusieurs
résultats sont en cours. Ne pas multiplier les onglets par défaut pour un usage simple.

**Preuve :** `AnimationsDuSujet.tsx:435` ; `prototype.js:30`, `:65–90`.

### C15 · P1 — Réunir le montage et toute la retouche existante

**Observé / code.** Le montage de démonstration permet le rattachement et l'ordre des frames.
Il n'expose pas encore le chutier multiclips, les plages temporelles et la richesse du montage
réel. La main de la maquette fonctionne, mais la main n'est pas intégrée dans l'atelier de
bande réel. Plusieurs tables de démonstration gardent des réglages sans calculer leurs effets.

**Proposition.** Trois zones lisibles : sources/chutier, animation retenue, aperçu. Donner
accès à début/fin, prélèvement, duplication, durée/cadence, ordre, lecture une fois/boucle,
cadre commun et pivot. Garder les prises retirées disponibles. La retouche doit montrer
la portée réelle de chaque geste et les valeurs mixtes d'une sélection ; un réglage global
ne doit pas sembler limité à la frame affichée.

Inventorier chaque contrôle existant avant de remplacer une table : détourage, recadrage,
pixelisation, palette, nettoyage, contour, miroir, main et recettes. Ajouter une vue avant/après
et une annulation cohérente. Conserver la sauvegarde et la réouverture des réglages non standard.

**Preuve :** `AtelierDeBande.tsx:788`, `:916`, `:1617`, `:1901`, `:2547` ;
`Retouche.tsx:2808–3010` ; prototype `parcours.js:66`, tables inspectées dans le navigateur.

### C16 · P1 — Faire de la toile une source de décisions créatives

**Observé / code.** Le prototype permet de poser, relier et déplacer des cartes. Ses îlots
et sa surface sont de taille fixe ; les règles vivent ailleurs. L'existant sait déjà faire
d'un îlot une ambiance et une palette réutilisables et dispose d'une réserve.

**Proposition.** Restaurer réserve, sélection multiple, cadrer tout, recherche, îlots ajustés
à leur contenu, navigation à la main et zoom continu. Depuis un îlot : « utiliser comme
références », « créer une ambiance », puis associer cette ambiance comme proposition pour
les prochaines fabrications d'une collection, après aperçu. Les résultats déjà produits
restent inchangés. Montrer avant l'envoi ce qui a effectivement été choisi.
Une note d'histoire reste une note tant que l'auteur ne
la transforme pas en règle. Sur une toile vide, boutons explicites importer/ajouter une
note/choisir dans la galerie, en complément du collage et du glisser-déposer.

**Preuve :** `Toile.tsx:1618–1654`, `:2329–2361` ; ancienne `Toile.dc.html:111`, `:385` ;
prototype `prototype.css:88–97`, `prototype.js:126`.

### C17 · P1 — Un suivi de fabrication commun, avec une reprise précise

**Observé / code.** La page regroupe visuellement demandes libres, équipements et demandes
standard, mais les états sont encore distincts. Une vidéo libre en attente n'incrémente
pas le badge de navigation ; Consommations ne montrait que la demande standard, sans le
clip libre ni l'équipement réalisés dans la même session. « Voir dans la galerie » ouvre
en réalité une fiche en fenêtre.

**Proposition.** Un journal filtrable par état, asset, origine et média. Un groupe présente
la demande et ses appels ; étapes image → vidéo → préparation → résultat ; résultats partiels
consultables. Même total dans badge, liste, fiche et dépenses, avec unités séparées. Les
actions nomment précisément ce qui se passe : récupérer un résultat déjà payé, reprendre
un traitement local, ou nouvelle fabrication avec nouvelle annonce de coût.

Le code sait déjà récupérer un clip payé depuis les dépenses : rendre ce chemin accessible
depuis le travail en échec. Garder erreur/vide/chargement distincts, et l'erreur près du travail.

**Preuve :** `prototype.js:73`, `:249`, `parcours.js:62` ;
`atelier/services/animation.py:427–460`, `Depenses.tsx:376`, `:435`.

### C18 · P2 — Un sélecteur de médias commun et une comparaison autonome

**Observé / code.** Les pickers de la maquette ont déjà vignettes et filtres : conserver cet
acquis. Le picker vidéo réel transforme cependant une erreur réseau en liste vide et ne
propose pas toute la navigation de la galerie. Comparer dans la maquette avec une seule
version demande de retourner à la fiche pour chercher la seconde.

**Proposition.** Même bibliothèque visuelle pour référence, extraction, calque, toile et
montage, filtrée selon le rôle attendu. Aperçu agrandi/animé, compatibilité expliquée et choix
multiple si permis. Dans Comparer, choisir A et B sur place, synchroniser les animations et
montrer cadrage, ancrage, cadence et taille réelle. Choisir la retenue depuis cette vue.

**Preuve :** `Clip.tsx:1078–1098`, `Galerie.tsx:503–513` ; prototype `ergonomie.js` et écran Comparer.

### C19 · P2 — Lisibilité, jugement des pixels et vocabulaire cohérents

**Observé / code.** Le réel mélange encore codex/établi/carnet et des commandes minuscules.
La maquette utilise souvent le damier ou le papier pour juger les sprites, et des polices de
repli. Les titres et les espaces sont parfois plus présents que les données à comparer.

**Proposition.** Garder les jetons et les trois polices décidées, les charger localement.
Serif pour les titres, sans-serif lisible pour les actions, détails secondaires à la demande.
Agrandir les cibles sans grossir toutes les vignettes ; statut visible avec mots et signes.
Fond neutre conforme à DESIGN.md pour juger ; damier pour inspecter la transparence et fond
du jeu comme vue d'essai distincte. Ne pas pixeliser systématiquement les références photo.

Utiliser les mêmes termes : mouvement, direction, frame, version, pièce, emploi, emplacement,
calque et tenue. « Cette pièce portée par ce personnage » explique emploi. Préférer les
actions concrètes : créer un personnage, retoucher, réutiliser les réglages, utiliser comme
référence. Ajouter raccourcis Windows découvrables, focus visible et parcours clavier ;
la commande rapide Ctrl+K complète les boutons, elle ne les remplace pas.

**Preuve :** `AnimationsDuSujet.tsx:204–249`, `Galerie.tsx:1168`, `:1298` ;
`prototype.css:50–52`, `:97`, `:242` ; ancienne `Navigation.dc.html:758` prévoit déjà Ctrl sous Windows.

## Les écrans et états à compléter, au bon moment

| Parcours | Composition / fonctions proposées | Ce qu'il faut reprendre ou vérifier |
|---|---|---|
| Ouvrir ou créer un jeu | Jeux récents, emplacement des données, association Godot, création courte puis réglages facultatifs | Premier lancement et changement de jeu réels ; ne pas imposer MCP ou 3D pour commencer |
| Objectifs d'un asset | Mouvements/directions demandés, références nécessaires, manques réellement bloquants, états fixes et animés séparés | Éviter de compter les directions non demandées comme du travail manquant |
| Bibliothèque de mouvements | Choisir un mouvement existant, variante, nom de sortie stable, portée par famille | Reprendre la bibliothèque actuelle ; distinguer un nom de fichier et une intention d'animation |
| Import | Lot de fichiers, aperçu, reconnaissance du média, classement proposé, erreurs par fichier et reprise | PNG/JPEG/WebP, clips, planches et futures sources 3D ; conserver les originaux |
| Relecture avant livraison | Aperçu animé, taille réelle, boucle/une fois, ancrage, manques, équipements et lien vers la frame à corriger | Anciennes Relecture/Essai ; aucune note globale de qualité qui masquerait les défauts |
| Moteurs / workflows locaux | Connexion et état par moteur, profils nommés/versionnés, entrées requises, paramètres simples/avancés, essai et erreurs de compatibilité | Le catalogue décide ; les deux interrupteurs du prototype ne suffisent pas. Installer un modèle reste un geste explicite |
| File locale | Attente, moteur occupé, annuler/reprendre, résultat partiel, étape en cours et temps mesuré lorsqu'il existe | Donner une action utile quand ComfyUI ou le moteur 3D est occupé ; ne pas inventer un délai |
| Source 3D | Aperçu manipulable, version du modèle, rig, mouvements, caméra, lumière, vues, échelle/pivot, aperçu des sprites puis rendu | Les trois cartes actuelles ne sont qu'un chemin. Relier les rendus à la source et éprouver les contrats asset3d aux tranches prévues |
| Autres familles | Objets et monstres animés ; décors avec cadrage/échelle ; éléments d'interface avec états et vérification à leur taille d'usage | Réutiliser l'atelier commun ; préciser les besoins par famille avant de dessiner des outils spécialisés |
| Tuiles, plus tard | Raccords en voisinage, variations, aperçu de carte et export vers Godot | Un outil de découpe seul ne constitue pas un atelier de tuiles |
| Son, plus tard | Écoute, début/fin, boucle, variantes, niveau et export | Réutiliser bibliothèque/travaux/provenance, puis un atelier adapté au son |
| Guide et récupération | Aide par réglage, brouillons récents, stockage indisponible, erreur locale, documents non sauvegardés | Les six parcours de visite actuels ne constituent pas un inventaire complet des capacités |

Ces lignes sont des propositions de couverture, pas l'annonce de fonctionnalités disponibles.
Les modèles locaux, la 3D, les tuiles et le son gardent leur place dans le plan actif.

## Comment vérifier que l'expérience est devenue bonne

Les scénarios suivants sont **proposés pour la prochaine itération**, pas déclarés réussis
par le présent audit. Les volumes servent de cas d'essai, pas de seuils commerciaux.

| Essai | Ce qui doit être observable |
|---|---|
| Personnage neuf, sans MCP | Définir Marche/Sud seulement ; référence puis animation ; corriger et livrer sans perdre la demande initiale |
| Animation en cours de lecture | Cadence non standard, frame corrigée, navigation ailleurs puis reprise : valeurs, frame et contexte conservés |
| Trois héros, une épée | Même pièce nommée, trois emplois distincts ; les corrections du nain ne changent pas celles de l'humain |
| Casque + sac + épée | Combiner pendant lecture sans nouvelle génération ; repérer et corriger une frame manquante ; exporter les couches synchronisées |
| Nouvelle base retenue | Les calques concernés passent à revoir ; corrections anciennes accessibles ; aucune validation silencieuse |
| Plusieurs centaines d'assets et plus de douze collections | Retrouver un asset, ranger une sélection, revenir au filtre ; évaluer aussi l'ergonomie d'une galerie contenant beaucoup de dérivés |
| Plusieurs clips et 48 frames | Retrouver les prises, raccourcir/réordonner, voir le raccord de boucle et le pivot, garder la timeline visible |
| Un îlot créatif | Choisir ses références pour une fabrication et relire ce qui part ; notes non choisies inchangées et non envoyées |
| Travail interrompu après soumission | Retrouver le travail et distinguer récupérer / traiter localement / repayer ; pas de nouvelle commande implicite |
| Import partiellement invalide | Conserver les réussites et corriger les seuls échecs ; ne pas présenter une panne réseau comme une bibliothèque vide |
| Godot | Comparer cadence à 11 i/s, boucle/une fois, ordre/aller-retour, ancrage et couches ; même rendu que dans l'atelier |
| Remplacement après retouche | Nom stable, aperçu des seuls fichiers modifiés, conflit explicite pour un fichier changé dans le jeu |

## Conséquences proposées pour le chantier actuel

**Le plan n'a pas besoin d'être remplacé à nouveau.** Son ordre couvre déjà le trajet Godot,
la création manuelle/MCP, la retouche, les équipements puis les nouveaux moteurs. L'audit
donne surtout des cas concrets à utiliser pour préciser et vérifier ces tranches.

| Travail existant | Constats de cette revue à y rattacher si les propositions sont retenues |
|---|---|
| Préparation UX | C06–C19 : châssis, préparation d'envoi commune, rangement, contexte et parcours complets ; conserver les outils déjà présents |
| AU1 / AU5 | C02–C03 : version livrée, animation fidèle, fichiers prévus, révision et remplacement |
| AU2 | C02, C09–C12, C14, C16 : objectif, bibliothèque, toile, référence et couverture |
| AU3 / AU6–AU8 | C04, C08, C17 : demandes communes, reprise, catalogue et file locale |
| AU4 | C01, C06–C07, C13–C15, C18 : brouillons, gestes, montage et retouche complète |
| AU15–AU17 | C05, C11–C13 : emplois complets, traitement groupé et tenues |
| AU9–AU14 | Écrans futurs et états précisés dans le tableau précédent |

Pour l'itération de maquette, commencer par **un personnage, sa marche, son sac et une
livraison**, dans le châssis compact commun. Réutiliser ensuite les mêmes contrôles dans
les autres parcours. Éprouver le rangement avec un catalogue chargé et la reprise après
fermeture avant de considérer la composition des écrans comme stabilisée.

Une décision acceptée ira dans son document d'autorité ; ce rapport gardera les preuves
de son origine. Les remarques de l'auteur ne sont pas archivées comme traitées par une
simple proposition. Le présent audit ne valide aucune tranche de production.
