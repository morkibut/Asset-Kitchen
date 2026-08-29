# Asset Kitchen — PRD

> Écrit le 26 août 2026. Ce document fait foi sur **ce que doit faire le produit, du point de
> vue de l'usage**. Il ne dit rien de la construction : voir `docs/ARCHITECTURE.md`.

---

## Problème

L'auteur fabrique un jeu 2D seul. Il lui faut des assets qui appartiennent tous au même
univers — des personnages, des objets, des décors, des éléments d'interface qui ont l'air
d'avoir été dessinés par la même main.

Aucun des chemins disponibles ne lui donne ça. Les modèles installés sur sa machine ne
tiennent pas l'identité d'un sujet d'une image à la suivante, et mettent près de deux minutes
par image — assez pour que l'aller-retour cesse d'en être un. Les ateliers en ligne
généralistes lui vendent des crédits pour un univers qu'ils ne connaissent pas : à chaque
prompt il retape son style, et ce qui sort ressemble à ce qu'un autre aurait obtenu. Et sa
propre chaîne de production en lot fabrique de la quantité la nuit, quand ce dont il a besoin
c'est de fabriquer peu, bien, en regardant.

Trois frottements reviennent à chaque séance. Le style repart de zéro à chaque image, parce
que l'univers ne vit que dans sa tête et dans le prompt qu'il réécrit. La taille du pixel
dérive d'une génération à l'autre — deux images du même personnage n'ont plus la même grille,
et ne se montent donc pas ensemble. Enfin, l'agent qui l'aide à coder le jeu ne peut pas
fabriquer d'image : il faut sortir de l'éditeur, aller ailleurs, revenir avec un fichier.

Pourquoi maintenant : le doute qui bloquait tout est levé. Un banc de douze configurations a
montré qu'une famille de modèles tient réellement l'identité d'un sujet sur plusieurs
générations enchaînées, et qu'aucun des trois frottements n'est fatal — chacun se corrige
après coup, sans repayer, à condition que le produit s'en charge systématiquement.

**Puis l'atelier a servi, et un quatrième frottement est apparu, propre au personnage.** Un
personnage de jeu n'est pas une image, c'est un plan : une dizaine de poses, et pour chaque
pose autant de variantes qu'il porte de pièces d'équipement. Fabriqué image par image, ce
plan est intenable sur les deux tableaux à la fois. Il coûte un appel par case, et le
tableau se remplit vite : dix poses et quatre pièces font cinquante images à payer une par
une. Et il ne tient pas ensemble : entre deux appels, la taille du pixel dérive et le
personnage se déplace dans son cadre, si bien que deux images du même personnage ne se
montent pas — ce qui est exactement ce dont on a besoin d'un personnage.

Le contournement naturel est pire. Demander « le même personnage, mais avec un casque » fait
retirer le personnage entier au modèle : il redessine tout, et ce qui revient n'est plus le
même nain avec un casque, c'est un autre nain. L'auteur se retrouve à choisir entre payer
cinquante fois et accepter que son casting change de visage en cours de route.

## Solution

Un atelier personnel, qui tourne sur la machine de l'auteur et s'ouvre dans son navigateur.

On y définit **l'univers** d'un jeu une fois : des références rassemblées et triées, quelques
images promues au rang d'artwork officiel et rangées par famille, une bible en champs nommés,
une palette qui se déduit toute seule des artworks, une taille de pixel cible. Ensuite on
fabrique au cas par cas — un personnage, un tonneau, une icône — et chaque génération part
déjà habillée de cet univers, avec les seules références qui la concernent, sans qu'on ait
rien à retaper ni rien à sélectionner.

Ce qui sort est immédiatement retouchable sans repayer : recadrer, ramener sur la grille du
projet, ramener sur sa palette, détourer, découper une planche en sprites. L'image d'origine
est gardée intacte et les retouches sont une recette, qu'on rejoue, qu'on nomme, qu'on annule.
Changer la palette d'un projet la réapplique à tout ce qu'il contient sans un seul appel
payant.

Tout ce qui est produit reste dans une bibliothèque unique, rangée en projets et collections,
où l'on retrouve, réutilise et exporte. Et l'agent qui code le jeu dispose exactement des
mêmes gestes : il demande un asset, l'univers du projet s'applique, il reçoit un fichier — et
peut le déposer directement dans le dossier du jeu.

**Sur cet atelier vient se poser le personnage, et son équipement.** Le projet porte un plan
de poses ; un personnage déclare lesquelles il tient, et un écran à deux entrées montre en
permanence ce qui est fait et ce qui manque. Ce qui manque se lance par paquets : on
sélectionne les poses qu'on veut, elles partent **pliées dans une seule image** et reviennent
dépliées en autant de sprites. Un appel au lieu de N, et les poses d'un même paquet partagent
la même grille de pixel parce qu'elles ont été peintes ensemble.

**L'équipement se fabrique par le même pliage.** Un casque vu de face n'est pas un casque vu
de dos : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut donc
une par pose. Mais on ne les paie pas une par une. L'atelier recompose lui-même une planche
des corps déjà générés, l'envoie avec « la même planche, avec la pièce en plus, ne touche à
rien d'autre », redécoupe ce qui revient sur la grille qu'il a lui-même posée, et compare case
par case ce qu'il a envoyé — qu'il connaît exactement, puisqu'il l'a composé — et ce qui
revient. Chaque différence est un calque à fond transparent, rangé à côté de son corps et
jamais dedans. **N calques pour un appel.**

Le pliage cesse alors d'être une astuce du lot de poses pour devenir la manière dont l'atelier
travaille : **habiller ou transformer N images d'un seul appel**, sur une grille dont il
connaît la géométrie case par case.

La zone où la pièce a le droit d'être se dessine à la souris et se corrige après coup pour
rien ; ce que la machine sait mesurer — combien de silhouette a survécu, combien de corps a
été repeint — est affiché mais ne décide de rien. **Seul le compte d'images refuse**, parce
que neuf poses demandées et sept reçues est un contrat rompu, pas un avis esthétique. Et une
limite est écrite d'avance plutôt que découverte à l'usage : la méthode tient pour une pièce
**contenue dans la silhouette** — casque, jambières, ceinture, gants, plastron — et casse pour
une pièce qui **l'agrandit** — cape, ailes, arme longue, sac à dos, monture.

## Utilisateur cible

Une personne : l'auteur du jeu, qui est aussi l'auteur de cet outil. Il travaille seul, pour
lui, sur un écran large, en français. Il code son jeu avec l'aide d'un agent, dans une autre
fenêtre, et bascule vers l'atelier quand il lui manque une image.

Il sait ce qu'est un sprite, une grille de pixels, une palette indexée et un atlas. Il juge la
qualité à l'œil, mieux et plus vite qu'une machine ne le ferait, et il n'a aucune envie qu'on
la juge à sa place. Il paie ses images à l'appel et regarde ce que ça coûte, sans vouloir d'un
système de crédits.

Sa séance type dure une demi-heure : il ouvre l'atelier avec une image en tête, écrit, lance
trois ou quatre variations, en garde une, la retouche, la range, et retourne coder. Il ne veut
ni tunnel de configuration, ni assistant, ni écran à traverser avant d'écrire son prompt.

## User Stories → `docs/user-stories.md`

**Les 173 user stories vivent dans `docs/user-stories.md`**, groupées par geste. Elles
se consultent par numéro, quand un critère en cite une — pas au démarrage d'une session.
Quelle tranche porte laquelle se lit dans `docs/PLAN.md`, § Couverture.

## Critères de succès

- Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que celui de la clé.
- Un projet neuf se crée, reçoit une bible et trois planches, et sa palette est extraite.
- Un asset se génère, se détoure, se ramène sur la grille et la palette du projet, et se range tout seul.
- Un personnage et un petit objet générés dans le même projet sortent avec la même taille de pixel, quelle que soit la grille rendue par le modèle.
- Un artwork officiel de la famille personnages ne part pas en référence lors de la génération d'un décor ; une planche marquée « tous » part avec toutes les générations.
- Une planche de huit sprites se découpe en huit assets, et la filiation de chacun est visible.
- Une sélection s'exporte en une archive accompagnée de son descriptif.
- Sur quatre variations dont deux échouent : deux images entrent en bibliothèque, deux emplacements portent une raison lisible et un bouton relancer, et aucun échec n'apparaît dans la grille.
- L'application est arrêtée pendant une génération : au redémarrage, la génération est marquée interrompue, son coût est lisible, et aucune relance n'a eu lieu.
- L'onglet est fermé pendant une génération : l'image est en bibliothèque à la réouverture.
- La suppression d'un asset qui a huit enfants laisse les huit en place, chacun marqué « parent supprimé ».
- Un asset dont la recette a été modifiée à la main n'est pas touché par un changement de palette du projet, et le nombre d'assets remis à jour et conservés est affiché.
- Le réseau est coupé : la bibliothèque, la retouche, le détourage, la découpe et l'export fonctionnent, et le catalogue affiche sa date.
- L'agent, branché sur l'atelier, génère un asset dans le bon projet sans aucune intervention.
- L'agent atteint le plafond : il reçoit un message qui nomme le plafond et le moyen de le relever, et aucune invite n'apparaît à l'écran.
- L'agent nomme un projet inexistant : il reçoit la liste des projets existants, et aucun projet n'a été créé.
- Coller une adresse d'image fait apparaître une carte en moins d'une seconde, avant que l'image ne soit récupérée.
- Le coût réel de chaque génération est enregistré et totalisé par projet, et le nombre de références envoyées est visible.
- Le tout tourne sans aucun modèle local et sans mobiliser de carte graphique.

**Le personnage et son équipement**

- Un projet neuf porte un plan de poses utilisable sans qu'aucune ligne n'ait été écrite.
- Un personnage créé, décrit et rattaché à six poses affiche six cases vides ; une pose générée en remplit une, et les cinq autres restent visiblement vides.
- Neuf poses sélectionnées et lancées ensemble donnent neuf images de corps distinctes après un seul appel payant, et le journal du projet montre un appel et non neuf.
- Un lot qui revient avec huit images pour neuf demandées est refusé, aucune image n'entre dans le plan, et le lot se relance d'un geste.
- Une pose ratée à l'intérieur d'un lot accepté se régénère seule, sans toucher aux huit autres.
- Un lot interrompu par la fermeture de l'application se reprend au redémarrage sans repayer les images déjà reçues.
- Deux poses trop semblables dans un même lot sont signalées à l'auteur ; le lot n'est pas refusé et les images entrent.
- Un casque posé sur six poses d'un personnage donne six calques distincts, un par pose, après **un seul** appel payant, et le journal du projet montre un appel et non six.
- Chacun de ces six calques s'affiche superposé au corps de **sa** pose, et le corps d'origine de chaque pose est retrouvé octet pour octet.
- Une planche d'équipement où figurerait une pose sans corps est impossible à lancer : la pose est visiblement inéligible et porte sa raison.
- Une pièce déclarée « qui agrandit la silhouette », revenue à une échelle différente de celle envoyée, ne produit aucun calque : la dérive est nommée à l'écran et ce qui revient est proposé à garder comme corps habillés.
- La zone d'un calque déjà fabriqué se déplace et se retaille, le calque se recalcule, et le journal du projet ne bouge pas d'un centime.
- Les mesures d'un calque s'affichent toutes, et aucune ne rend un calque impossible à garder.
- Le modèle par défaut pour produire une planche et celui pour éditer un corps se règlent séparément, et l'auteur n'a pas à les choisir à chaque génération.
- Un personnage complet s'exporte dans le dossier du jeu avec un descriptif qui nomme chaque fichier, sa pose et sa pièce.
- L'agent, branché sur l'atelier, ajoute une pose au plan d'un personnage existant et la génère sans que l'écran soit ouvert.
- La fiche de n'importe quel asset nomme le modèle qui l'a produit.

## Hors périmètre

**Écarté par nature du produit.** Comptes, crédits, paiement, multi-utilisateur, distribution, galerie publique, partage, presets communautaires. Pack d'assets par genre — fabriquer de la quantité est le métier d'un autre outil. Compteur de crédits maison : le suivi des coûts se lit chez le fournisseur.

**Écarté parce que l'auteur fait mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur d'intention qui devinerait le type d'asset.

**Écarté par coût de construction disproportionné.** Extraction de composants d'interface et éditeur de découpe en neuf zones. Paquets prêts à importer dans un moteur — entre l'archive et le paquet il n'y a que du glisser-déposer. Modèles locaux à l'intérieur de l'application : ils restent dehors, on importe leur résultat.

**Écarté de la V1, prévu ensuite.** Génération autre que pixel art. Tuiles qui se raccordent. Personnage et ses poses préparées. Animation de sprites. Son.

**Écarté par choix d'ergonomie.** Mobile et tablette : écran large uniquement, aucun point de rupture, aucun menu escamoté, aucune mise en page de repli. Corbeille : suppression avec annulation courte. Écran séparé pour la bibliothèque : une seule grille dans tout le produit. Détourage par couleur.

**Revenu dans le périmètre — 27 août 2026.** « Toile libre dans le tableau d'inspiration : grille seulement » était écarté ici, au même titre que le reste, jusqu'à ce qu'une séance d'essai sur le produit tenu montre l'inverse : la grille montre tout d'un coup d'œil et ne permet d'organiser rien, et le champ `groupe` — une étiquette qui n'a aucune forme à l'écran — n'y suffit pas. La toile s'ajoute donc à la grille **sans la remplacer**, et devient les tranches T8 et T9 du plan. Ce qu'elle n'est pas, en revanche, reste écarté : dessin à main levée, formes et flèches libres, plusieurs toiles par projet, export de la toile en image, liens entre cartes de projets différents, alignement et distribution automatiques, et couleur choisie librement — six teintes fermées, et rien au-delà.

**Écarté par les décisions de ce document.** Sas d'acceptation avant l'entrée en bibliothèque. Suppression en cascade. Refus de supprimer tant qu'il existe une descendance. Création implicite d'un projet par l'agent. Assistant de premier lancement. Invite d'autorisation qui bloquerait l'agent en attendant l'auteur. Liste de modèles écrite en dur. Relance automatique après interruption. Réapplication forcée de la palette sur les recettes réglées à la main. Enchaînement d'outils fins que l'agent devrait composer lui-même. Passe de retouche qui monopoliserait la carte graphique.

**Écarté sur les références.** Sélection manuelle des artworks à envoyer, génération par génération : c'est l'application qui choisit, sur la famille. Obligation que l'artwork officiel soit une planche non figurative : trop contraignant, l'auteur travaille justement à partir de visuels trouvés. Déduction de la taille de pixel depuis l'image reçue : elle est imposée par le projet, jamais devinée.

**Revenu dans le périmètre — 28 août 2026.** « Personnage et ses poses préparées » était écarté de la V1 et renvoyé à un « ensuite » sans rang, derrière les tuiles. Deux essais payés le 28 août 2026 ont levé les deux doutes qui le retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels dérive d'une pose à l'autre, et une pièce d'équipement s'extrait d'un corps habillé sans qu'un seul pixel du corps soit repeint. Le personnage et son équipement passent donc devant les tuiles et forment la V2. L'ordre des versions devient : **V2 le personnage et son équipement, V3 l'animation, V4 les tuiles qui se raccordent, V5 le son.** L'équipement, qui n'était nulle part, entre avec le personnage parce qu'il n'existe pas sans lui.

**Écarté de la V2 — repoussé.** Animation, tuiles raccordées, son. Squelette, os, interpolation entre deux poses : c'est l'animation, pas le personnage. Salle d'essai qui montrerait le personnage équipé dans un décor. Bibliothèque de poses partagée entre projets : le plan appartient au projet qui le porte.

**Écarté de la V2 — par les décisions de cette version.** Deuxième grille d'assets : la matrice de production d'un personnage n'en est pas une — pas de recherche, pas de filtres, pas de sélection multiple, deux axes et des vignettes, rien de plus. Point de repère, ancre ou marque injectée dans l'image pour recaler un calque : le calque est une pure différence, et rien n'est ajouté à l'image envoyée. Génération d'une pièce seule sur fond vide : une pièce n'existe qu'apparue sur un corps. Calque unique porté sur toutes les poses : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut une par pose — c'est le pliage qui en divise le prix, pas une réutilisation. Combinaison de deux pièces qui agrandissent la silhouette sur le même corps : ce qui revient d'une pièce qui agrandit est un corps habillé et non un calque, et deux corps habillés ne s'empilent pas. Détection automatique de ce qui agrandit la silhouette : l'auteur déclare, au même titre qu'il nomme la pièce et l'emplacement. Plafond sur la taille d'un lot : le produit annonce ce que coûte un compte faux, il ne l'interdit pas. Refus automatique sur les mesures de qualité : elles informent, seul le compte d'images refuse. Reconnaissance automatique de la pièce ou de l'emplacement depuis l'image : l'auteur nomme, l'application enregistre. Mannequin ou silhouette de référence imposée à tous les personnages. Feuille de sprites assemblée à la sortie : le pliage est une ruse d'appel, pas un format de livraison — ce qui sort, ce sont des images séparées et leur descriptif.

**Revenu dans le périmètre — 28 août 2026 (les quatre reprises).** « Génération autre que pixel art » était écarté de la V1 et renvoyé à un « ensuite ». Une séance sur le produit tenu a montré que l'écart n'était pas là où ce document le plaçait : **rien du style n'est écrit dans le prompt** — seule la bible part, et une bible vide ne dit rien —, mais **le post-traitement, lui, impose l'apparence sans qu'on l'ait demandée** : la remise sur grille est systématique, donc toute image revient sur 64 ou 96 pixels, et la quantification la ramène sur la palette dès qu'un artwork existe. L'auteur ne voit ni ce qui part, ni ce qui est appliqué au retour. Trois choses entrent donc dans le périmètre : **le prompt exact se voit et se reprend**, **la bible gagne la vue et la technique de rendu**, et **la taille de pixel accepte « aucune »**. Trois autres suivent, de la même séance : l'import depuis l'écran, le réglage d'univers qui se voit sans recharger, et l'infobulle qui ne couvre plus le réglage voisin.

**Écarté par ces reprises.** Mode de rendu HD à part entière, où le projet basculerait d'un bloc : la case « aucune » de la taille de pixel suffit à rendre la grille facultative, et un second axe de configuration se paierait à chaque écran. Quantification débrayable indépendamment : elle reste attachée à l'existence d'une palette — un projet qui n'en veut pas ne promeut pas d'artwork. Bible en texte libre : les champs nommés restent des champs nommés, la liste s'allonge de deux et ne s'ouvre pas. Prompt réécrit par l'application, traduit ou enrichi automatiquement : ce qui est montré est ce qui part, mot pour mot. Import qui devinerait la famille, l'échelle ou le traitement à appliquer : l'auteur déclare, comme partout ailleurs.

## Décisions d'implémentation

**Ce qui entre en bibliothèque.** Tout ce qui est produit y entre de lui-même, rangé dans le projet courant. Juger, c'est marquer favori ou supprimer — jamais accepter. Ce qui est jugé l'est avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque.

**L'échec.** Il s'affiche à l'emplacement qui attendait l'image, avec sa raison en clair et un bouton relancer qui rejoue le même prompt. Sur un lot, chaque emplacement est indépendant : les réussites arrivent, les ratés se relancent un par un. Aucun échec n'entre dans la grille. L'appel raté et son coût réel restent lisibles dans le journal du projet.

**Le premier lancement.** L'application ouvre l'Atelier, prompt actif, sur un projet « Bac à sable » préexistant. Aucun projet, aucune bible, aucun artwork n'est exigé : un univers non renseigné ne contraint simplement rien, et les défauts du produit prennent le relais. Seule la clé du fournisseur est un préalable dur, matérialisé par un bouton générer inactif portant sa raison et le lien vers son réglage.

**La suppression.** Jamais de cascade. Les enfants survivent au parent et affichent « parent supprimé ». Supprimer un projet demande confirmation avec le nombre d'assets concernés, et ces assets sont détachés, pas détruits. Annulation courte après chaque suppression, puis c'est définitif.

**Les artworks officiels sont groupés par famille.** Une carte porte une famille en plus de son groupe : personnages, objets, décors, interface, ou « tous » pour une planche de style non figurative. À la génération, seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». C'est l'application qui choisit, pas l'auteur : promouvoir reste un geste unique. Le nombre de références effectivement envoyées est visible au moment de générer.

**La taille de pixel est une propriété du projet, imposée à tout ce qui rentre.** Elle n'est jamais déduite de l'image reçue. La remise sur grille est systématique **tant qu'une cible est posée** : un asset dont la grille a dérivé est le cas normal, pas l'incident. La seule échappatoire est « aucune » (US-163), qui est une valeur déclarée par l'auteur — un jeu qui n'est pas en pixel art — et non un réglage éteint ; elle ne rouvre rien, puisque dès qu'une cible est posée la remise reste sans condition.

**La palette rétroactive.** Toucher une recette à la main épingle l'asset. Un changement de palette du projet saute les épinglés et rend son compte : « 12 assets remis à jour, 3 conservés tels quels ». Un épinglé se réaligne d'un geste depuis sa fiche.

**Ce qui est indisponible est grisé avec sa raison**, jamais proposé puis refusé. Cela vaut pour un modèle qui ne peut pas honorer la demande, pour la quantification tant qu'aucune palette n'existe, pour l'export d'une sélection vide, et pour le bouton générer sans clé. Un modèle déjà choisi qui devient invalide reste choisi : aucune substitution silencieuse.

**La génération vit côté serveur.** Elle survit à la fermeture de l'onglet et au changement d'écran ; son résultat entre en bibliothèque quoi qu'il arrive. À la réouverture, ce qui tourne encore est réaffiché avec son avancement. Une génération coupée par un redémarrage est marquée interrompue, garde son coût, et se relance d'un geste — jamais toute seule.

**Le fournisseur absent.** Le dernier catalogue reçu sert de repli, daté en clair à l'écran. Tout ce qui ne demande pas le réseau fonctionne normalement. La génération échoue au moment où on l'essaie, pas au démarrage.

**Ce qui entre par la main.** Le collage devine et le dit : une image devient une carte image, une adresse crée immédiatement une carte en attente dont l'image arrive ensuite — et qui garde son adresse et sa raison si elle n'arrive pas —, un texte devient une carte texte. Un fichier qui n'est pas une image est refusé nommément. Un doublon est signalé avec un lien vers l'existant, et reste importable.

**L'agent ne bloque jamais l'auteur, et l'auteur ne bloque jamais l'agent.** Aucune invite d'autorisation : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever. Un projet inconnu est refusé avec la liste des projets existants ; sans projet nommé, c'est le projet ouvert dans l'atelier qui reçoit. Côté disque, un dossier manquant est créé, un fichier existant n'est jamais écrasé, un dossier non inscriptible est un refus qui donne le chemin. Côté atelier, un compteur discret montre la consommation de l'agent et ses assets apparaissent en direct dans la grille, marqués de leur provenance. Les garde-fous sont relus à chaque appel : les changer ne demande aucun redémarrage.

**Une seule grille d'assets dans tout le produit** — mêmes filtres, même recherche, même sélection multiple. Organiser n'oblige jamais à quitter l'endroit où l'on crée.

**La fiche asset est un panneau latéral**, jamais une page : la fermer remet exactement où l'on était.

**Écran large uniquement.** Les trois panneaux et la grille cohabitent d'emblée. Les panneaux se replient par choix, pour voir la grille en grand, jamais par contrainte de place.

**La retouche est non destructive.** L'image d'origine est conservée, les retouches sont une recette rejouable, annulable, nommable. Revenir à l'image brute est un geste unique.

**Le modèle est un défaut par type d'asset**, porté par l'univers du projet, pas un réglage global.

**Le coût réel de chaque génération est enregistré** — celui que le fournisseur facture, jamais celui qu'il affiche au catalogue — et totalisé par projet.

**Les dimensions mesurées font foi**, jamais celles demandées.

**Le corps naît dans l'atelier, et nulle part ailleurs.** Il n'y a pas d'écran de création de personnage avec son propre prompt : on écrit un sujet, on génère, on obtient une image, et c'est cette image qu'on désigne comme le corps d'un personnage. L'unité manipulée reste l'image de corps — un personnage n'est pas un objet mystérieux, c'est un nom, une description, et un plan de cases dont chacune attend ou contient une image de corps.

**Le personnage appartient au projet.** Il porte un nom, une description, et le plan de poses qu'on lui a rattaché. Il vit dans la bibliothèque du projet comme tout le reste, et sa suppression suit la règle générale : jamais de cascade, les images survivent et affichent « personnage supprimé ».

**Le plan de poses est une propriété du projet, réutilisable par tous ses personnages.** Un plan porte un nom et une liste de poses, chacune nommée. Un projet neuf en reçoit un par défaut, immédiatement utilisable ; l'auteur en ajoute, en retire, en renomme, et rattache le plan qu'il veut à chaque personnage. Ajouter une pose à un plan ajoute une case vide à chaque personnage qui le porte — jamais une génération.

**La taille d'un lot est le choix de l'auteur, jamais celui du produit.** Il coche les poses qu'il veut voir partir ensemble, de deux à autant qu'il ose. Le produit annonce ce que ça coûte, et ce qu'un compte faux coûterait — le lot entier refusé et relancé au prix plein. Il n'annonce pas de probabilité : il ne mesure rien sur le modèle choisi, et une statistique qu'il n'a pas faite ne vaut pas mieux qu'un pressentiment. Il ne plafonne pas. Une pose reste toujours régénérable seule, dans ou hors d'un lot.

**Un lot est tout ou rien sur le compte, indépendant sur le reste.** Si le compte d'images revenues ne correspond pas au compte demandé, rien n'entre et le lot se relance d'un geste. Si le compte est bon, les images entrent toutes, et chaque pose devient jugeable et régénérable individuellement. Aucune autre mesure ne peut refuser un lot.

**Les mesures d'un lot et d'un calque sont indicatives et toutes visibles.** Elles disent ce qui s'est passé — ressemblance entre poses, dérive de la grille de pixels, part de l'image touchée, netteté du découpage — et n'empêchent jamais de garder. Le seul refus automatique du produit est le compte d'images.

**Une pièce d'équipement se fabrique par différence, sans repère ajouté.** L'auteur part de corps existants, demande une pièce, et le produit compare ce qui revient à ce qu'il a envoyé : ce qui a changé devient un calque à fond transparent. Rien n'est ajouté à l'image envoyée pour aider le recalage, et le corps d'origine n'est jamais modifié.

**Un calque est solidaire de sa pose, et c'est le pliage qui en divise le prix.** Un casque vu de face n'est pas un casque vu de dos : il faut un calque par pose. Le produit ne prétend pas le contraire et ne propose jamais de reposer un calque ailleurs que sur la pose où il est apparu. Ce qui est divisé par le pliage, c'est le nombre d'appels payants, pas le nombre de calques.

**La planche d'équipement est composée par l'atelier, pas par l'auteur.** L'auteur coche les poses qu'il veut habiller — celles qui ont déjà un corps, les autres étant grisées avec leur raison. L'atelier range lui-même ces corps sur une grille carrée dont il connaît la géométrie case par case, envoie la planche entière avec la consigne de n'ajouter que la pièce, redécoupe le retour sur cette même grille, et compare case par case l'envoyé et le revenu. Les cases en trop d'une grille non pleine restent vides à l'aller et sont ignorées au retour.

**Une pièce est contenue dans la silhouette, ou elle l'agrandit — et c'est l'auteur qui le dit.** Contenue par défaut. **Contenue** — casque, jambières, ceinture, gants, plastron : la méthode par différence s'applique telle quelle ; l'essai du 28 août 2026 a mesuré moins de 1,5 % du corps repeint sur six modèles et deux jets, sans exception. **Qui agrandit** — cape, ailes, arme longue, sac à dos, monture : la planche part sur une toile avec marge pour que la pièce ait la place, et si l'échelle revient malgré tout différente de celle envoyée, aucun calque n'est fabriqué. Le produit nomme la dérive et propose de garder ce qui revient comme des corps habillés — utilisables et exportables, mais pas empilables. Le même essai a rendu 23,5 % du corps repeint et une échelle de 0,62 sur la cape, sur les six modèles et aux deux jets.

**Le pliage est une fonction générale de l'atelier.** Ce n'est pas un dispositif du lot de poses : c'est la manière dont l'atelier habille ou transforme N images d'un seul appel, sur une grille dont il connaît la géométrie case par case. Le lot de poses et la planche d'équipement en sont deux usages ; il en viendra d'autres.

**Deux défauts de modèle, pas un.** Produire une planche et éditer un corps ne demandent pas le même modèle : un modèle qui recopie fidèlement les traits du gabarit de découpe rend une planche juste mais tramée, quand un autre l'ignore comme demandé. L'univers du projet porte donc les deux défauts séparément, et l'auteur n'a pas à y penser au moment de générer.

**Une planche redondante n'est pas une planche refusée.** Si deux cases d'un même lot rendent presque la même image, le compte est bon et le contrat est tenu : tout entre. Mais l'auteur le voit, case par case et nommément, et relance la pose seule s'il le veut. Mesuré le 28 août 2026 : deux planches sur vingt-quatre ont répété une pose.

**Nommer, c'est créer.** Les emplacements (tête, torse, dos, jambes…) et les pièces vivent sur le projet ; les calques vivent sur le personnage. Écrire un nom d'emplacement ou de pièce qui n'existe pas encore le crée sur-le-champ, sans passer par un écran de gestion. Rien à déclarer avant de travailler.

**La zone est facultative, et se rejoue.** Par défaut aucune zone n'est donnée : la différence est cherchée sur toute la case de la planche. L'auteur peut restreindre la recherche à une zone, la déplacer, la retailler — c'est une étape de la recette du calque, rejouable et annulable, qui ne redemande jamais d'image au fournisseur.

**Un calque est une recette, pas un fichier figé.** À côté de l'image payée s'empilent la recherche de différence, le masque, et les retouches au pixel — chacune rejouable, annulable, nommable, exactement comme la retouche d'un asset ordinaire. Revenir à la différence brute est un geste unique.

**La production d'un personnage se lit dans une matrice.** Deux axes — les poses d'un côté, les emplacements de l'autre —, des vignettes dans les cases, les cases vides visiblement vides. Ce n'est pas la grille de la bibliothèque : ni recherche, ni filtres, ni sélection multiple. On y voit ce qui manque, et on lance depuis là.

**Les concept arts sont des cartes du tableau, désignées comme telles.** Une carte image du tableau d'inspiration se désigne concept art d'un personnage ; elle reste où elle est, visible sur la toile, et devient consultable depuis le personnage. Aucun deuxième endroit où ranger des images.

**Les références envoyées sont visibles et décochables, à trois portées.** Ce qui part avec une demande se lit avant de générer, ligne par ligne, avec sa provenance — artwork officiel de l'univers, concept art du personnage, ou image du lot en cours. Chacune se décoche pour une génération, pour un personnage, ou pour le projet. La préséance est écrite à l'écran, jamais devinée, et un jeu de cases coché se garde sous un nom pour être rappelé d'un geste.

**L'atelier décrit, l'agent écrit.** Le produit expose ce qu'il sait d'un personnage — ses poses, ses pièces, ses fichiers — sous une forme que l'agent qui code le jeu lit et transforme en lignes de catalogue. L'atelier n'écrit jamais de code de jeu, et l'agent n'invente jamais un chemin de fichier.

**La fiche d'un asset nomme le modèle qui l'a produit.** Pour une image générée, le modèle exact ; pour une image importée, « importé ». C'est une information de provenance au même titre que le prompt et le coût : elle se lit, elle ne se règle pas.

**Le prompt exact.** Ce que l'écran montre avant de lancer est **le texte tel qu'il partira**, assemblé dans l'ordre où il part : la bible active, puis le sujet, puis les consignes de pliage quand il y a une planche. Le reprendre à la main vaut pour cette génération seule et n'écrit rien dans l'univers ; ce qui est parti reste attaché à la génération, comme le modèle et le coût. L'application ne traduit ni n'enrichit ce texte : montrer autre chose que ce qui part serait pire que ne rien montrer.

**Ce que l'import subit.** Une image importée naît par le même chemin que les autres et hérite donc du traitement du projet. Comme ce traitement peut ramener une référence de 2048 pixels à 64, l'import demande au moment du geste — traitement du projet, ou telle quelle. Le défaut est **telle quelle** : ce qu'on importe, on l'a déjà choisi, et le produit ne réduit rien qu'on ne lui ait demandé de réduire.

## Notes complémentaires → `docs/prd-carnet.md`

Ce qu'une séance ou un banc a trouvé, et qui explique une décision de ce document sans la
remplacer, vit dans **`docs/prd-carnet.md`**. On l'ouvre quand une décision d'ici paraît
arbitraire et qu'on veut savoir ce qui l'a dictée.
