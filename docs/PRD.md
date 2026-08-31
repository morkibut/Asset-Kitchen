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

**Puis l'atelier a été tenu pendant trois jours, et un cinquième frottement est apparu — celui
de l'écran lui-même.** Sept surfaces se recouvraient, cinq boutons de même poids se
partageaient la barre du haut, et les réglages de ce qu'on fabrique occupaient trois cents
pixels en permanence sur l'écran dont le seul métier est de juger des images. La bande de
réglages de l'univers faisait presque trois écrans de haut, et la première image
d'inspiration arrivait après six écrans et demi de défilement. Surtout, rien ne disait jamais
ce que le jeu réclamait encore : l'écran des personnages affichait « six poses » de la même
façon que zéro ou six soient faites.

La réponse est **trois lieux au lieu de sept surfaces**, et une distinction qui tient tout le
reste : *une image est un résultat, une chose du jeu est une chose du jeu*. **L'univers** tient
ce qui s'applique à tout sans appartenir à personne — les références rassemblées, les réglages
du jeu, les lots de style réutilisables. **Le codex** tient la liste de ce que le monde
contient, et pour chaque chose ce qu'elle a déjà et ce qui lui manque. **La galerie** tient
toutes les images produites, et l'on n'y paie jamais un centime. Sous le codex s'ouvre
**l'établi** — une chose ouverte, ses cases pleines et ses cases vides, et la barre qui paie en
pied. Balthazar existe dans le codex avant d'avoir la moindre image, et c'est ce qui permet au
produit de dire ce qui lui manque.

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
ni tunnel de configuration ni écran obligatoire avant d'écrire son prompt : ce qui s'ouvre au
premier lancement se quitte à n'importe quelle étape, et rien n'y est exigé.

## User Stories → `docs/user-stories.md`

**Les 308 user stories vivent dans `docs/user-stories.md`**, groupées par geste. Elles
se consultent par numéro, quand un critère en cite une — pas au démarrage d'une session.
Quelle tranche porte laquelle se lit dans `docs/PLAN.md`, § Couverture.
Les 135 dernières — `US-174` à `US-308` — sont celles de la V2.1, écrites le 31 août 2026.

## Critères de succès

- Depuis une installation neuve, la première image est obtenue sans traverser d'autre écran que l'assistant, qu'on peut quitter à toute étape : le nombre d'écrans obligatoires est zéro.
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

**Les trois lieux, et ce que le jeu réclame**

- La barre du haut porte trois onglets et rien d'autre du travail ; toute profondeur se lit dans le fil qui dit où l'on est, et chacun de ses segments ramène.
- L'argent ne part que de deux endroits — l'établi d'une chose et le codex —, et la même barre de saisie les sert tous les deux ; la galerie n'en a aucune et le dit dans son pied.
- Écrire un nom dans le codex fait entrer la chose sur-le-champ et ouvre son établi ; aucun formulaire ne s'intercale, et rien n'est payé en nommant.
- Un jeu déclare une fois comment il regarde le monde, et l'atelier en tire la liste des directions ; le texte qui part et le nombre d'images à fabriquer sont remplis par ce seul choix et ne peuvent plus se contredire.
- Une chose du jeu affiche ce qui lui manque en cases, jamais un total de ce qu'elle tient ; le compte de ce qu'elle a rangé est écrit à côté, de sorte qu'une jauge pleine obtenue en rangeant se lise comme telle.
- Les quatre directions manquantes d'une pose partent sur une seule planche et reviennent en quatre images séparées, chacune sachant déjà dans quelle case elle se range.
- Un écran de confirmation paraît entre le bouton et la dépense : chaque texte et chaque image qui partira y tient une ligne avec son interrupteur, et le prix de chaque image jointe est écrit sur la ligne où on la coche.
- Une correction faite avant de payer vaut pour cet appel seulement ; le prochain appel repart des réglages, et garder la correction est un second geste écrit.
- Une image se retouche en la voyant en grand : les sept places de la recette et les deux fabriques s'ouvrent depuis la même barre, et aucune ne coûte un centime — l'écran le dit avant qu'on ait lu.
- Toutes les poses d'une chose se regardent empilées à la même échelle, et celle qui sort plus petite que ses sœurs se corrige sans repayer.
- Une image finie se juge sur le fond que le jeu décrit, à une taille qui est un multiple entier de la sienne, jamais interpolée.
- Tous les appels payés se lisent dans une seule liste, du plus récent au plus ancien, avec ce que chacun a coûté et ce qu'il a donné ; une image supprimée fait changer l'état de son appel, jamais disparaître sa ligne.
- Sur une machine neuve, l'assistant s'ouvre à l'étape 1 ; on en sort où l'on veut et on tombe dans le codex vide, le champ qui nomme allumé.

## Hors périmètre

**Écarté par nature du produit.** Comptes, crédits, paiement, multi-utilisateur, distribution, galerie publique, partage, presets communautaires. Pack d'assets par genre — fabriquer de la quantité est le métier d'un autre outil. Compteur de crédits maison : le suivi des coûts se lit chez le fournisseur.

**Écarté parce que l'auteur fait mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur d'intention qui devinerait le type d'asset.

**Écarté par coût de construction disproportionné.** Extraction de composants d'interface et éditeur de découpe en neuf zones. Paquets prêts à importer dans un moteur — entre l'archive et le paquet il n'y a que du glisser-déposer. Modèles locaux à l'intérieur de l'application : ils restent dehors, on importe leur résultat.

**Écarté de la V1, prévu ensuite.** Génération autre que pixel art. Tuiles qui se raccordent. Personnage et ses poses préparées. Animation de sprites. Son.

**Écarté par choix d'ergonomie.** Mobile et tablette : écran large uniquement, aucun point de rupture, aucun menu escamoté, aucune mise en page de repli. Corbeille : suppression avec annulation courte. ~~Écran séparé pour la bibliothèque~~ et ~~détourage par couleur~~ — les deux sont revenus le 31 août 2026, voir plus bas.

**Revenu dans le périmètre — 27 août 2026.** « Toile libre dans le tableau d'inspiration : grille seulement » était écarté ici, au même titre que le reste, jusqu'à ce qu'une séance d'essai sur le produit tenu montre l'inverse : la grille montre tout d'un coup d'œil et ne permet d'organiser rien, et le champ `groupe` — une étiquette qui n'a aucune forme à l'écran — n'y suffit pas. La toile s'ajoute donc à la grille **sans la remplacer**, et devient les tranches T8 et T9 du plan. Ce qu'elle n'est pas, en revanche, reste écarté : dessin à main levée, formes et flèches libres, plusieurs toiles par projet, export de la toile en image, liens entre cartes de projets différents, alignement et distribution automatiques, et couleur choisie librement — six teintes fermées, et rien au-delà.

**Écarté par les décisions de ce document.** Sas d'acceptation avant l'entrée en bibliothèque. Suppression en cascade. Refus de supprimer tant qu'il existe une descendance. Création implicite d'un projet par l'agent. Invite d'autorisation qui bloquerait l'agent en attendant l'auteur. Liste de modèles écrite en dur. Relance automatique après interruption. Réapplication forcée de la palette sur les recettes réglées à la main. Enchaînement d'outils fins que l'agent devrait composer lui-même. Passe de retouche qui monopoliserait la carte graphique.

**Écarté sur les références.** Sélection manuelle des artworks à envoyer, génération par génération : c'est l'application qui choisit, sur la famille. Obligation que l'artwork officiel soit une planche non figurative : trop contraignant, l'auteur travaille justement à partir de visuels trouvés. Déduction de la taille de pixel depuis l'image reçue : elle est imposée par le projet, jamais devinée.

**Revenu dans le périmètre — 28 août 2026.** « Personnage et ses poses préparées » était écarté de la V1 et renvoyé à un « ensuite » sans rang, derrière les tuiles. Deux essais payés le 28 août 2026 ont levé les deux doutes qui le retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels dérive d'une pose à l'autre, et une pièce d'équipement s'extrait d'un corps habillé sans qu'un seul pixel du corps soit repeint. Le personnage et son équipement passent donc devant les tuiles et forment la V2. L'ordre des versions devient : **V2 le personnage et son équipement, V3 l'animation, V4 les tuiles qui se raccordent, V5 le son.** L'équipement, qui n'était nulle part, entre avec le personnage parce qu'il n'existe pas sans lui.

**Écarté de la V2 — repoussé.** Animation, tuiles raccordées, son. Squelette, os, interpolation entre deux poses : c'est l'animation, pas le personnage. Salle d'essai qui montrerait le personnage équipé dans un décor. Bibliothèque de poses partagée entre projets : le plan appartient au projet qui le porte.

**Écarté de la V2 — par les décisions de cette version.** Deuxième grille d'assets : la matrice de production d'un personnage n'en est pas une — pas de recherche, pas de filtres, pas de sélection multiple, deux axes et des vignettes, rien de plus. Point de repère, ancre ou marque injectée dans l'image pour recaler un calque : le calque est une pure différence, et rien n'est ajouté à l'image envoyée. Génération d'une pièce seule sur fond vide : une pièce n'existe qu'apparue sur un corps. Calque unique porté sur toutes les poses : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut une par pose — c'est le pliage qui en divise le prix, pas une réutilisation. Combinaison de deux pièces qui agrandissent la silhouette sur le même corps : ce qui revient d'une pièce qui agrandit est un corps habillé et non un calque, et deux corps habillés ne s'empilent pas. Détection automatique de ce qui agrandit la silhouette : l'auteur déclare, au même titre qu'il nomme la pièce et l'emplacement. Plafond sur la taille d'un lot : le produit annonce ce que coûte un compte faux, il ne l'interdit pas. Refus automatique sur les mesures de qualité : elles informent, seul le compte d'images refuse. Reconnaissance automatique de la pièce ou de l'emplacement depuis l'image : l'auteur nomme, l'application enregistre. Mannequin ou silhouette de référence imposée à tous les personnages. Feuille de sprites assemblée à la sortie : le pliage est une ruse d'appel, pas un format de livraison — ce qui sort, ce sont des images séparées et leur descriptif.

**Revenu dans le périmètre — 28 août 2026 (les quatre reprises).** « Génération autre que pixel art » était écarté de la V1 et renvoyé à un « ensuite ». Une séance sur le produit tenu a montré que l'écart n'était pas là où ce document le plaçait : **rien du style n'est écrit dans le prompt** — seule la bible part, et une bible vide ne dit rien —, mais **le post-traitement, lui, impose l'apparence sans qu'on l'ait demandée** : la remise sur grille est systématique, donc toute image revient sur 64 ou 96 pixels, et la quantification la ramène sur la palette dès qu'un artwork existe. L'auteur ne voit ni ce qui part, ni ce qui est appliqué au retour. Trois choses entrent donc dans le périmètre : **le prompt exact se voit et se reprend**, **la bible gagne la vue et la technique de rendu**, et **la taille de pixel accepte « aucune »**. Trois autres suivent, de la même séance : l'import depuis l'écran, le réglage d'univers qui se voit sans recharger, et l'infobulle qui ne couvre plus le réglage voisin.

**Revenu dans le périmètre — 30 août 2026.** « Assistant de premier lancement » était écarté ici, au nom de ce que le portrait de l'auteur protège : ne pas être retenu avant d'écrire. L'exclusion a cessé de protéger quoi que ce soit le jour où l'écran sur lequel elle reposait a disparu. Il n'y a plus d'Atelier : l'argent ne part plus que de deux endroits, l'établi d'une chose et le codex ; or un établi appartient à une chose, et sur une installation neuve le codex est vide. **Il n'y a plus nulle part où écrire un prompt**, et l'exclusion défendait un accès direct qui n'existait plus. L'assistant entre donc dans le périmètre, sous la condition qui remplace l'exclusion : **on en sort à n'importe quelle étape**, une étape passée reste passée sans rien bloquer ni se redemander, et sortir dès la première dépose dans le codex, champ qui nomme allumé. Ce qui reste écarté, c'est l'assistant *obligatoire* : aucune de ses étapes ne l'est.

**Écarté par ces reprises.** Mode de rendu HD à part entière, où le projet basculerait d'un bloc : la case « aucune » de la taille de pixel suffit à rendre la grille facultative, et un second axe de configuration se paierait à chaque écran. Quantification débrayable indépendamment : elle reste attachée à l'existence d'une palette — un projet qui n'en veut pas ne promeut pas d'artwork. Bible en texte libre : les champs nommés restent des champs nommés, la liste s'allonge de deux et ne s'ouvre pas. Prompt réécrit par l'application, traduit ou enrichi automatiquement : ce qui est montré est ce qui part, mot pour mot. Import qui devinerait la famille, l'échelle ou le traitement à appliquer : l'auteur déclare, comme partout ailleurs.

**Revenu dans le périmètre — 31 août 2026 (la V2.1).** Trois exclusions tombent, et chacune tombait pour la même raison : elle protégeait quelque chose que la réorganisation des écrans a rendu impossible ou inutile.

*L'écran séparé pour la bibliothèque* était écarté au nom d'« organiser n'oblige jamais à quitter l'endroit où l'on crée ». La galerie devient un onglet à elle, où l'on ne fabrique rien. La règle qu'il protégeait se coupe en deux : ce qui tombe, c'est *ranger là où l'on crée* — il n'y a plus rien à ranger à la main, puisqu'une image naît dans l'établi d'une chose et lui appartient d'emblée. Ce qui reste, et qui était le fond, c'est **une seule grille d'assets dans tout le produit** : la matrice d'une chose, la réserve du tableau et la liste des dépenses n'en sont pas. Ce qui le tient est écrit plus bas, surface par surface — les deux premières sont privées de recherche, de filtre et de sélection multiple ; la troisième ne porte aucune image.

*Le détourage par couleur* était écarté quand le remplissage depuis le bord suffisait à tout. Il devient le troisième moteur de passe, à côté du remplissage et du modèle facultatif : on désigne une couleur dans l'image, et l'on choisit de retirer cette tache-là ou toutes celles de cette couleur. Ce qui l'a fait revenir est une poche de fond enfermée par le sujet, qu'aucune tolérance ne peut atteindre parce que le remplissage part des bordures et que le chemin n'existe pas.

*L'assistant de premier lancement* est revenu le 30 août, et son paragraphe est ci-dessus.

**Écarté par les décisions de la V2.1.** Une entité « essais » servant de panier : elle fabriquerait un endroit où les images échappent au codex. Une barre de saisie dans l'univers, ou dans la galerie : les lieux d'où l'argent part restent deux. Une sixième taille de vignette pour reconnaître une image de référence : la barre d'espace montre n'importe quelle vignette en grand, partout. Un second panneau de réglages à côté de l'assistant : deux endroits qui règlent la même chose finissent par se contredire. Un dictionnaire d'étiquettes de style apporté du dehors : vérifié, les thésaurus d'art donnent *baroque* et jamais *pixel art 16 bits*, et aucun ne donne le texte anglais qui marche sur une IA d'image. Une cascade d'héritage entre le jeu, l'ambiance et une chose : une ambiance est une boîte qu'on désigne et dans laquelle on pioche, pas un étage dont on hérite. Deux ambiances sur une même chose : il faudrait une règle de priorité pour chaque texte et chaque image, et elle serait invisible au moment où elle décide. Un écran du gaspillage qui ne montrerait que ce qu'on a payé pour rien : mesuré, aucune image du dépôt n'a jamais été supprimée, et cet écran-là aurait affiché zéro. Un bouton « refaire cet appel » dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet. Une case définitive « ne plus jamais me montrer ce qui part » : on la cocherait le premier jour, quand on ne sait pas encore qu'on en aura besoin. Un contrôle libre de la couleur de fond dans la vitrine : on trouverait toujours un fond sur lequel le sprite est joli, et jamais celui sur lequel il disparaît.

## Décisions d'implémentation → `docs/prd-decisions.md`

**Ce que le produit a tranché, question par question**, vit dans
`docs/prd-decisions.md` : ce qui entre en bibliothèque et ce qui se juge, ce que
la génération coûte et ce qu'elle refuse, ce que l'univers impose, ce que
l'agent peut. *Descendu en annexe le 31 août 2026* — la section pesait **55 %**
de ce document, et le corpus de démarrage 301 Ko. Le texte n'a pas bougé d'un
mot ; seul l'endroit où on le lit a changé.

Elle se lit **à la demande**, quand une décision d'usage paraît arbitraire ou
qu'on veut savoir si une question a déjà été tranchée — jamais au démarrage
d'une session.

## Notes complémentaires → `docs/prd-carnet.md`

Ce qu'une séance ou un banc a trouvé, et qui explique une décision de ce document sans la
remplacer, vit dans **`docs/prd-carnet.md`**. On l'ouvre quand une décision d'ici paraît
arbitraire et qu'on veut savoir ce qui l'a dictée.
