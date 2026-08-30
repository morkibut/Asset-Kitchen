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

*L'écran séparé pour la bibliothèque* était écarté au nom d'« organiser n'oblige jamais à quitter l'endroit où l'on crée ». La galerie devient un onglet à elle, où l'on ne fabrique rien. La règle qu'il protégeait se coupe en deux : ce qui tombe, c'est *ranger là où l'on crée* — il n'y a plus rien à ranger à la main, puisqu'une image naît dans l'établi d'une chose et lui appartient d'emblée. Ce qui reste, et qui était le fond, c'est **une seule grille d'assets dans tout le produit** : la matrice d'une chose, la réserve du tableau et la liste des dépenses n'en sont pas, et c'est leur privation de recherche, de filtre et de sélection multiple qui le tient.

*Le détourage par couleur* était écarté quand le remplissage depuis le bord suffisait à tout. Il devient le troisième moteur de passe, à côté du remplissage et du modèle facultatif : on désigne une couleur dans l'image, et l'on choisit de retirer cette tache-là ou toutes celles de cette couleur. Ce qui l'a fait revenir est une poche de fond enfermée par le sujet, qu'aucune tolérance ne peut atteindre parce que le remplissage part des bordures et que le chemin n'existe pas.

*L'assistant de premier lancement* est revenu le 30 août, et son paragraphe est ci-dessus.

**Écarté par les décisions de la V2.1.** Une entité « essais » servant de panier : elle fabriquerait un endroit où les images échappent au codex. Une barre de saisie dans l'univers, ou dans la galerie : les lieux d'où l'argent part restent deux. Une sixième taille de vignette pour reconnaître une image de référence : la barre d'espace montre n'importe quelle vignette en grand, partout. Un second panneau de réglages à côté de l'assistant : deux endroits qui règlent la même chose finissent par se contredire. Un dictionnaire d'étiquettes de style apporté du dehors : vérifié, les thésaurus d'art donnent *baroque* et jamais *pixel art 16 bits*, et aucun ne donne le texte anglais qui marche sur une IA d'image. Une cascade d'héritage entre le jeu, l'ambiance et une chose : une ambiance est une boîte qu'on désigne et dans laquelle on pioche, pas un étage dont on hérite. Deux ambiances sur une même chose : il faudrait une règle de priorité pour chaque texte et chaque image, et elle serait invisible au moment où elle décide. Un écran du gaspillage qui ne montrerait que ce qu'on a payé pour rien : mesuré, aucune image du dépôt n'a jamais été supprimée, et cet écran-là aurait affiché zéro. Un bouton « refaire cet appel » dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet. Une case définitive « ne plus jamais me montrer ce qui part » : on la cocherait le premier jour, quand on ne sait pas encore qu'on en aura besoin. Un contrôle libre de la couleur de fond dans la vitrine : on trouverait toujours un fond sur lequel le sprite est joli, et jamais celui sur lequel il disparaît.

## Décisions d'implémentation

**Ce qui entre en bibliothèque.** Tout ce qui est produit y entre de lui-même, rangé dans le projet courant. Juger, c'est marquer favori ou supprimer — jamais accepter. Ce qui est jugé l'est avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque.

**L'échec.** Il s'affiche à l'emplacement qui attendait l'image, avec sa raison en clair et un bouton relancer qui rejoue le même prompt. Sur un lot, chaque emplacement est indépendant : les réussites arrivent, les ratés se relancent un par un. Aucun échec n'entre dans la grille. L'appel raté et son coût réel restent lisibles **dans l'écran des dépenses**, avec tous les autres.

**Le premier lancement.** L'application ouvre l'assistant, étape 1, sur le jeu « Bac à sable » qui existe déjà — l'assistant ne le crée pas, il le renomme. Aucun projet, aucune bible, aucun artwork n'est exigé : un univers non renseigné ne contraint simplement rien, et les défauts du produit prennent le relais. Seule la clé du fournisseur est un préalable dur, matérialisé par un bouton générer inactif portant sa raison et le lien vers son réglage.

**La suppression.** Jamais de cascade. Les enfants survivent au parent et affichent « parent supprimé ». Supprimer un projet demande confirmation avec le nombre d'assets concernés, et ces assets sont détachés, pas détruits. Annulation courte après chaque suppression, puis c'est définitif.

**Les artworks officiels sont groupés par famille.** Une carte porte une famille en plus de son groupe : personnages, objets, décors, interface, ou « tous » pour une planche de style non figurative. À la génération, seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». C'est l'application qui choisit, pas l'auteur : promouvoir reste un geste unique. Le nombre de références effectivement envoyées est visible au moment de générer.

**La taille de pixel est une propriété du projet, imposée à tout ce qui rentre.** Elle n'est jamais déduite de l'image reçue. La remise sur grille est systématique **tant qu'une cible est posée** : un asset dont la grille a dérivé est le cas normal, pas l'incident. La seule échappatoire est « aucune » (US-163), qui est une valeur déclarée par l'auteur — un jeu qui n'est pas en pixel art — et non un réglage éteint ; elle ne rouvre rien, puisque dès qu'une cible est posée la remise reste sans condition.

**La palette rétroactive.** Toucher une recette à la main épingle l'asset. Un changement de palette du projet saute les épinglés et rend son compte : « 12 assets remis à jour, 3 conservés tels quels ». Un épinglé se réaligne d'un geste depuis sa fiche.

**Ce qui est indisponible est grisé avec sa raison**, jamais proposé puis refusé. Cela vaut pour un modèle qui ne peut pas honorer la demande, pour la quantification tant qu'aucune palette n'existe, pour l'export d'une sélection vide, et pour le bouton générer sans clé. Un modèle déjà choisi qui devient invalide reste choisi : aucune substitution silencieuse.

**La génération vit côté serveur.** Elle survit à la fermeture de l'onglet et au changement d'écran ; son résultat entre en bibliothèque quoi qu'il arrive. À la réouverture, ce qui tourne encore est réaffiché avec son avancement. Une génération coupée par un redémarrage est marquée interrompue, garde son coût, et se relance d'un geste — jamais toute seule.

**Le fournisseur absent.** Le dernier catalogue reçu sert de repli, daté en clair à l'écran. Tout ce qui ne demande pas le réseau fonctionne normalement. La génération échoue au moment où on l'essaie, pas au démarrage.

**Ce qui entre par la main.** Le collage devine et le dit : une image devient une carte image, une adresse crée immédiatement une carte en attente dont l'image arrive ensuite — et qui garde son adresse et sa raison si elle n'arrive pas —, un texte devient une carte texte. Un fichier qui n'est pas une image est refusé nommément. Un doublon est signalé avec un lien vers l'existant, et reste importable.

**L'agent ne bloque jamais l'auteur, et l'auteur ne bloque jamais l'agent.** Aucune invite d'autorisation : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever. Un projet inconnu est refusé avec la liste des projets existants ; sans projet nommé, c'est le projet ouvert dans l'atelier qui reçoit. Côté disque, un dossier manquant est créé, un fichier existant n'est jamais écrasé, un dossier non inscriptible est un refus qui donne le chemin. Côté atelier, un compteur discret montre la consommation de l'agent et ses assets apparaissent en direct dans la grille, marqués de leur provenance. Les garde-fous sont relus à chaque appel : les changer ne demande aucun redémarrage.

**Une seule grille d'assets dans tout le produit** — mêmes filtres, même recherche, même sélection multiple. Elle vit dans la galerie. La matrice d'une chose du jeu n'en est pas une, la réserve du tableau d'inspiration non plus, la liste des dépenses non plus : aucune des trois n'a de recherche, de filtre ni de sélection multiple, et c'est cette privation qui tient la règle.

**La fiche d'une image est un panneau latéral**, jamais une page : la fermer remet exactement où l'on était. Elle dit ce qu'une image *est* — ses mesures, son coût, son modèle, à qui elle appartient, ce que le projet lui a imposé, d'où elle vient — et elle ne règle rien. Elle porte deux portes : l'établi de la chose à qui elle appartient, et les tables où on la retouche. Une image qui n'appartient à personne n'a que la seconde, et la première devient le geste qui la rattache. **La fiche d'une chose du jeu est un écran plein cadre** — ce sont deux objets différents, et il ne faut pas les confondre.

**Écran large uniquement.** Les trois panneaux et la grille cohabitent d'emblée. Les panneaux se replient par choix, pour voir la grille en grand, jamais par contrainte de place.

**La retouche est non destructive.** L'image d'origine est conservée, les retouches sont une recette rejouable, annulable, nommable. Revenir à l'image brute est un geste unique.

**Le modèle est un défaut par type d'asset**, porté par l'univers du projet, pas un réglage global.

**Le coût réel de chaque génération est enregistré** — celui que le fournisseur facture, jamais celui qu'il affiche au catalogue — et totalisé par projet.

**Les dimensions mesurées font foi**, jamais celles demandées.

**Le corps naît dans l'atelier, et nulle part ailleurs.** Il n'y a pas d'écran de création de personnage avec son propre prompt : on écrit un sujet, on génère, on obtient une image, et c'est cette image qu'on désigne comme le corps d'un personnage. L'unité manipulée reste l'image de corps — un personnage n'est pas un objet mystérieux, c'est un nom, une description, et un plan de cases dont chacune attend ou contient une image de corps.

**Le personnage appartient au projet.** Il porte un nom, une description, et le plan de poses qu'on lui a rattaché. Il vit dans la bibliothèque du projet comme tout le reste, et sa suppression suit la règle générale : jamais de cascade, les images survivent et affichent « personnage supprimé ».

**La liste des poses appartient au type d'objet, et une chose du jeu peut y ajouter les siennes.** *Révisé le 31 août 2026 — elle appartenait au projet entier, si bien qu'un coffre héritait d'une pose de course qu'il fallait ranger sur chaque coffre.* Chaque type d'objet porte donc sa liste, remplie à l'étape des poses de l'assistant : un personnage a repos, marche, course, attaque, dégâts, mort ; un coffre a fermé, ouvert, vidé ; une tuile n'en a aucune. Un boss garde les six poses de son type et en ajoute une à lui seul, sans que les autres personnages voient paraître une case vide qui ne les concerne pas — et sa fiche écrit l'origine de chaque pose, *du type* ou *ajoutée ici*, pour qu'on sache toujours ce qui bougerait en changeant le type.

**On range ce qu'on ne tient pas, on ne coche pas ce qu'on tient.** Ajouter une pose à un type doit faire paraître une case vide chez tous les objets de ce type **sans écrire un seul fichier** : avec des listes de ce qu'on tient, il faudrait réécrire chaque chose du jeu à chaque ajout — un balayage capable de réussir à moitié, pour un geste qui ne devrait rien écrire du tout. La même mécanique vaut pour les trois listes que le jeu impose : les poses, les directions et les pièces d'équipement. Ajouter et ranger ne sont pas symétriques, et c'est voulu : on range ce que le type impose et qu'on ne veut pas, on ajoute ce que le type ignore et qu'on est seul à vouloir.

**La taille d'un lot est le choix de l'auteur, jamais celui du produit.** Il coche les poses qu'il veut voir partir ensemble, de deux à autant qu'il ose. Le produit annonce ce que ça coûte, et ce qu'un compte faux coûterait — le lot entier refusé et relancé au prix plein. Il n'annonce pas de probabilité : il ne mesure rien sur le modèle choisi, et une statistique qu'il n'a pas faite ne vaut pas mieux qu'un pressentiment. Il ne plafonne pas. Une pose reste toujours régénérable seule, dans ou hors d'un lot.

**Un lot est tout ou rien sur le compte, indépendant sur le reste.** Si le compte d'images revenues ne correspond pas au compte demandé, rien n'entre et le lot se relance d'un geste. Si le compte est bon, les images entrent toutes, et chaque pose devient jugeable et régénérable individuellement. Aucune autre mesure ne peut refuser un lot.

**Les mesures d'un lot et d'un calque sont indicatives et toutes visibles.** Elles disent ce qui s'est passé — ressemblance entre poses, dérive de la grille de pixels, part de l'image touchée, netteté du découpage — et n'empêchent jamais de garder. Le seul refus automatique du produit est le compte d'images.

**Une pièce d'équipement se fabrique par différence, sans repère ajouté.** L'auteur part de corps existants, demande une pièce, et le produit compare ce qui revient à ce qu'il a envoyé : ce qui a changé devient un calque à fond transparent. Rien n'est ajouté à l'image envoyée pour aider le recalage, et le corps d'origine n'est jamais modifié.

**Un calque est solidaire de sa pose, et c'est le pliage qui en divise le prix.** Un casque vu de face n'est pas un casque vu de dos : il faut un calque par pose. Le produit ne prétend pas le contraire et ne propose jamais de reposer un calque ailleurs que sur la pose où il est apparu. Ce qui est divisé par le pliage, c'est le nombre d'appels payants, pas le nombre de calques.

**La planche d'équipement est composée par l'atelier, pas par l'auteur.** L'auteur coche les poses qu'il veut habiller — celles qui ont déjà un corps, les autres étant grisées avec leur raison. L'atelier range lui-même ces corps sur une grille carrée dont il connaît la géométrie case par case, envoie la planche entière avec la consigne de n'ajouter que la pièce, redécoupe le retour sur cette même grille, et compare case par case l'envoyé et le revenu. Les cases en trop d'une grille non pleine restent vides à l'aller et sont ignorées au retour.

**Une pièce est contenue dans la silhouette, ou elle l'agrandit — et c'est l'auteur qui le dit.** Contenue par défaut. **Contenue** — casque, jambières, ceinture, gants, plastron : la méthode par différence s'applique telle quelle ; l'essai du 28 août 2026 a mesuré moins de 1,5 % du corps repeint sur six modèles et deux jets, sans exception. **Qui agrandit** — cape, ailes, arme longue, sac à dos, monture : la planche part sur une toile avec marge pour que la pièce ait la place. Le même essai a rendu 23,5 % du corps repeint et une échelle de 0,62 sur la cape, sur les six modèles et aux deux jets.

**L'échelle au retour informe, elle ne refuse pas.** *Révisé le 31 août 2026.* Ce paragraphe disait qu'une pièce « qui agrandit », revenue à une échelle différente de celle envoyée, ne produisait **aucun** calque — ce qui contredisait, deux paragraphes plus bas, « le compte d'images est le seul refus automatique du produit ». L'échelle devient donc l'une des cinq mesures d'un calque : elle s'affiche, elle explique, elle n'empêche jamais de garder. Ce qui ne bouge pas : le produit **nomme** la dérive et **propose** de garder ce qui revient comme des corps habillés — utilisables et exportables, mais pas empilables. Ce qui rend le changement sûr est mesuré : sur les six planches payées le 29 août 2026, l'échelle est restée dans la tolérance à chaque fois, à 0,92 comme à 0,62, et le repli n'a jamais été pris que sur une échelle inventée par un recalage défectueux — lequel se rejoue désormais sans repayer.

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

### Les décisions de la V2.1 — 31 août 2026

Elles viennent du dossier de maquettes `docs/maquettes-v2.1/`, où quarante et une décisions ont été prises le 30 août 2026 en répondant à vingt-trois questions posées une par une. Ce qui a dû être arbitré en les reportant ici, et ce qui reste ouvert, vit dans `docs/v21-arbitrages.md`.

**Trois onglets, et une profondeur.** L'univers, le codex, la galerie, dans l'ordre où ils servent : on pose ce qui s'applique à tout, on déclare ce que le monde contient, on regarde ce qu'on a produit. L'établi d'une chose du jeu n'est pas un onglet — on y entre en cliquant un nom dans le codex, et le fil qui dit où l'on est remplace le nom de l'onglet. Chacun de ses segments ramène.

**L'univers a trois côtés, un seul allumé à la fois, chacun plein écran.** *Inspiration*, le tableau de références ; *Réglages*, l'assistant ; *Ambiances et couleurs*, où se fabriquent les palettes et les lots de style. Regarder des images et remplir des cases ne demandent pas la même chose à un écran, et les mettre côte à côte faisait perdre les deux.

**Il n'existe qu'une barre de saisie, et elle appartient au châssis.** Même champ, même bouton, même prix, rendue en pied de l'établi et en pied du codex, et nulle part ailleurs. Ce qui change d'un lieu à l'autre est ce que porte sa rangée du haut : une case dans l'établi, plusieurs dans le codex. Elle se retire dès qu'un écran ouvert ne peut rien dépenser — une barre qui paie, affichée pendant qu'on détoure, mentirait sur ce que le geste en cours coûte.

**Écrire un nom crée la chose.** Pour faire un essai qui n'appartient à aucune chose du jeu — « un tonneau cerclé de fer » —, on tape le nom dans le codex : le tonneau entre sur-le-champ dans la famille allumée, et on génère depuis son établi. C'est le geste que l'atelier connaît déjà pour les poses et les pièces d'équipement. On ne paie rien en nommant.

**Le codex range par famille, et le vestiaire en est une.** Personnages, décors, objets, interface — les quatre que le produit connaît déjà et qui décident déjà des artworks envoyés — plus l'équipement. Une pièce a un nom, une description, un emplacement et une portée : c'est une chose du monde, pas un réglage. Elle diffère des autres sur un point qui se dit : **une pièce n'a pas d'image à elle**, et son établi montre sur quels personnages elle a été posée.

**Les directions viennent de la vue du jeu, et le jeu la déclare une fois.** On choisit la vue — de face fixe, de dessus verticale, de côté, de côté à défilement, de dessus stricte, de dessus 3/4, oblique, isométrique — sur des vignettes, et l'atelier en tire la liste des directions, chacune avec son nom et sa consigne. Ce choix unique remplit **tous les endroits qui doivent s'accorder** : le nombre d'images par pose, et la phrase correspondante dans le texte qui part. C'est ce qui répare la contradiction mesurée du dépôt — le réglage dit 128 pixels, et le texte envoyé dit 64, trois fois. Une vue à une seule direction est un choix comme un autre : le mot « direction » ne paraît alors nulle part.

**Une case du plan est une pose, dans une direction.** Le nombre d'images d'une pose compte désormais les vignettes d'un cycle **dans une seule direction**, et non plus toutes vues confondues. La liste des directions se propose et ne s'impose pas : on renomme, on retire, on ajoute depuis le codex, et un clic annule. Une pose peut en tenir moins que le jeu — une mort n'a souvent qu'une direction —, et une chose du jeu peut en tenir moins que la pose.

**Une case est prise parce qu'une image la porte, pas parce que cette image est bonne.** Le produit ne juge jamais une image à la place de l'auteur, et une jauge qui refuserait de compter une image apportée à la main deviendrait un jugement de qualité déguisé. Ce que la jauge dit : *tu as posé quelque chose dans cette case*. Ce qu'elle ne dit pas : *c'est bon*. Et **une jauge ne compte que ce qu'on peut fabriquer maintenant** : l'équipement se compte sur les corps qui existent, jamais sur les cases réclamées, parce qu'une pièce ne se pose que sur un corps déjà fabriqué.

**Le manque n'a pas de couleur, et la jauge ne réclame rien.** Le vert dit *complet*, l'absence de vert dit *pas encore* — un jeu en cours de fabrication n'échoue pas. Aucune alerte, aucun rappel, aucun total à atteindre, et aucun classement des choses par ce qui leur manque. Le compte de ce qui a été rangé est écrit à côté de la jauge, jamais dedans, pour qu'une jauge pleine obtenue en rangeant se lise comme telle.

**Un écran de confirmation paraît entre le bouton et la dépense.** Il montre le texte exact, mot pour mot, et chaque image jointe, chacun sur sa ligne avec un interrupteur : le sujet, les sept textes du jeu, les trois que l'ambiance remplace, les images de référence, les options du modèle. Le prix de chaque image jointe est écrit sur la ligne où on la coche — mesuré : joindre une seule image double le prix d'un appel, deux le quadruplent, et 48 % de la facture du modèle principal vient de là. Un sixième bloc, en gris, dit ce qui se passera au retour et ne part pas.

**Ce qui est corrigé avant de payer vaut pour cet appel seulement.** Éteindre une ligne, corriger un texte, décocher une image : rien ne remonte dans la fiche de la chose, ni dans l'ambiance, ni dans les réglages du jeu. Sans cette séparation, la dixième image d'un personnage serait fabriquée avec les réglages du neuvième essai sans que personne l'ait décidé. Garder une correction est possible, mais c'est un **second geste écrit** — jamais un effet de bord. La recette de l'image, elle, garde tout : ce qui est oublié est le réglage pour la suite, ce qui est gardé est l'histoire de ce qui a été fait.

**Cet écran avertit, il ne refuse pas.** Un texte qui contredit un réglage, aucune image jointe, tous les textes de style éteints : chacun s'écrit sur la ligne fautive, avec des chiffres et jamais un conseil. Ce que le modèle choisi ne sait pas faire est grisé avec sa raison et le compte — *quatorze places, seize cochées*. Le seul refus automatique du produit reste le compte d'images, et il ne se joue pas là : il se joue au retour.

**Une ambiance est un lot de style qu'on désigne, et dans lequel on pioche.** Elle porte trois choses et trois seulement : une palette, une ou plusieurs images de référence, et trois textes — le monde, l'éclairage, le trait. Les quatre autres textes du jeu lui sont fermés : *vue* et *technique* portent la mécanique du jeu, et une ambiance qui les remplacerait fabriquerait des images qui ne rentrent pas dans le jeu ; *époque* et *rendu* restent au jeu parce qu'un coin plus sombre reste du même siècle et du même pixel art. Le projet **est** l'ambiance générale du jeu — même objet en plus grand —, si bien qu'il n'y a qu'une notion à apprendre.

**On désigne une ambiance sur une chose du jeu, et on choisit ce qu'on lui prend au moment de payer** — ses couleurs, ses références, son texte, séparément. Un monstre de forme différente prend les couleurs seules ; la version noire d'un personnage prend tout sauf les images. Une collection reste un simple dossier de rangement qui ne décide de rien : grouper vingt monstres et régler leur style sont deux gestes différents. Une ambiance qui ne sert qu'à une seule chose n'apporte rien — ses réglages vont sur la chose.

**Une palette est un objet nommé, en plusieurs exemplaires, et elle reste une recette.** Des sources — les images d'un paquet du tableau, les artworks officiels, ou d'autres palettes —, deux dosages, des retouches rangées une par une, et un résultat recalculable dont l'empreinte dit de quoi il est la lecture. La règle « la palette est dérivable de ses sources » ne bouge pas ; ce qui change est ce qu'une source peut être. Chaque couleur du résultat dit d'où elle vient, et une couleur retirée reste montrée, barrée, jamais cachée.

**La palette agit toujours au retour, et peut en plus partir à l'aller.** L'image revient, l'atelier la ramène sur les couleurs, sur la machine, gratuitement et rétroactivement. En cochant *envoyer la palette en référence*, elle part en plus à l'aller — sous forme d'**image**, une bande de pastilles, qui occupe une place de référence. L'envoi en texte est écarté : les modèles d'image suivent mal une liste de codes couleur, et le texte pèse déjà la moitié de l'appel.

**Une chose du jeu désigne ses images de référence, et il y en a quatre sortes.** Les artworks officiels de sa famille, qui arrivent tout seuls ; les concept arts qu'on épingle depuis le tableau ; les images de son ambiance, qui arrivent avec elle et repartent quand on la détache ; et — c'est l'ajout — **les images déjà fabriquées qu'on promeut en référence permanente**. C'est celle qui manquait, et qui explique que dix-sept appels sur vingt-huit soient partis sans la moindre image quand les modèles en acceptent quatorze : il n'existait aucun endroit pour dire une fois pour toutes *voilà à quoi il ressemble*. L'atelier en propose deux tout seul, avec leur provenance écrite : le corps retenu de la première pose faite, et la planche des directions au repos dès qu'une pose est complète.

**Une planche est ce qu'on achète, et elle mérite d'être vue avant.** Combien de cases, ce qui est écrit dans chacune, ce qui part en référence avec l'ensemble, et le prix. Elle porte **une seule chose du jeu** ; elle porte une seule pose quand cette pose réclame plusieurs directions, et peut en réunir plusieurs quand chacune n'en réclame qu'une. Elle n'entre jamais en bibliothèque : ce qui entre, ce sont ses morceaux, et chacun sait **avant de partir** dans quelle pose et quelle direction il se rangera — ce qui répare le fait que neuf appels de personnage sur treize ne disaient pas leur pose. La géométrie de la grille et la position de chaque case sont écrites par l'atelier, montrées, et non saisissables : les modifier casserait le rangement de ce qui revient.

**Refaire les quatre coûte moins cher que compléter les trois.** Mesuré : une case seule coûte $0,0128 l'image, deux cases n'économisent rien, quatre cases coûtent $0,0057 — deux fois moins. Dans le cas courant — une direction faite, trois manquantes —, refaire les quatre coûte $0,015 de moins que trois appels séparés, **et** rend quatre images qui se ressemblent parce qu'elles ont été peintes ensemble. L'écran le propose donc par défaut, avec les deux autres choix visibles et leur prix, et **le nombre d'appels sur lequel chaque prix repose écrit à côté** : celui de quatre cases n'en a qu'un.

**Une recette a sept places, et deux fabriques vivent à côté.** Détourage, recadrage, grille, quantification, bords, contours, la main — dans un ordre fixe qui ne se réordonne pas. Les *contours* retracent la ligne que la mise sur grille a mangée, après la quantification pour que leur couleur soit exactement celle qu'on a choisie. *La main* est le mode manuel, et elle porte sur l'image telle qu'elle partira dans le jeu. À droite d'un trait, deux gestes qui ne modifient pas l'image ouverte mais en fabriquent d'autres : le **découpage** et la **superposition**. Le critère qui range un outil s'écrit une fois : *une place de recette décrit une image, une fabrique en produit d'autres.*

**On retouche en voyant l'image en grand, et jamais en payant.** Une table s'ouvre en plein cadre depuis une barre visible sur chaque image, avec ses réglages à gauche, l'image au milieu et les images sœurs à droite — on passe de l'une à l'autre sans refermer. Une table indisponible s'ouvre normalement et porte sa raison en clair à la place de ses réglages, avec ce qu'il faut faire pour l'allumer. Aucune table ne coûte un centime, et la barre qui paie, absente, le dit avant qu'on ait lu.

**Toutes les poses d'une chose se calibrent ensemble.** Un écran les pose l'une sur l'autre dans la même case et décide de leur taille commune, parce que le défaut ne se voit pas sur une image seule : mesuré, six poses d'un même personnage, même recette, sortent à 64, 59, 64, 53, 64 et 43 pixels de haut — un bras tendu élargit la boîte du sujet, et la mise sur grille rétrécit tout le reste. L'outil **propose** et ne décide pas : les quatre repères automatiques essayés échouent tous, et la reprise à la main est la moitié du travail, pas un rattrapage. Ce qu'il écrit est une part de la case, donc changer la taille de case ne défait aucun calage.

**Une image finie se juge sur un fond, à une taille qui ne ment pas.** Les échelles sont des multiples entiers — un sprite agrandi d'une fois et demie fabrique des pixels qui n'existent pas, et le défaut qu'on croirait voir n'existerait que dans la fenêtre où on l'a regardé. Les fonds viennent du projet : le damier, ce que la bible décrit, une couleur de la palette. Un fond libre ferait du maquillage — on trouverait toujours celui sur lequel le sprite est joli, et jamais celui sur lequel il disparaît. La règle générale : **un fond de jugement vient du projet, un fond de repérage vient du produit.**

**Tous les appels payés se lisent dans une seule liste.** Du plus récent au plus ancien, une ligne par appel — c'est l'appel qui est facturé, pas l'image — avec son heure, son sujet, son modèle, ce qu'il a demandé et ce qu'il a coûté. Trois états : *gardé*, *payé pour rien*, *refusé*. **Une dépense ne s'efface jamais** : supprimer une image fait passer son appel du premier état au deuxième, la ligne reste, et un jeu supprimé voit ses appels passer « hors jeu ». Rien ne se paie ni ne se relance depuis cet écran.

**Deux totaux, chacun avec son étiquette.** Celui de la barre du haut compte le jeu ouvert et porte *ce jeu* ; celui de l'écran des dépenses compte l'atelier depuis le premier jour. Un troisième chiffre existait sans dire ce qu'il comptait : celui de la fenêtre des réglages ne compte que ce que l'agent a dépensé depuis le dernier plafond — un appel sur vingt-huit — et il s'appelle désormais *dépensé par l'agent*. Un montant affiché est une question posée : celui de la barre du haut se clique et ouvre les dépenses.

**Le premier lancement ouvre l'assistant, et on en sort quand on veut.** Dix étapes en quatre groupes — le jeu, le style, la production, l'atelier —, la dixième étant la clé du fournisseur, seule dans son groupe parce qu'elle vaut pour tous les jeux. On sort à n'importe quelle étape et l'on tombe dans le codex, vide, le champ qui nomme au milieu de l'écran. Une étape passée reste passée sans rien bloquer ni se redemander. **Rien n'est jamais grisé dans l'assistant** : un changement qui casse du travail déjà payé affiche les vrais chiffres — *48 images ont été découpées en 128 pixels, les refabriquer coûte environ 0,61 $* — puis laisse décider. Le seul élément grisé est un bouton pour une chose qui n'existe pas encore.

**L'assistant est l'écran des réglages, et il n'y en a pas d'autre.** Un seul écran, deux humeurs : la première fois on enchaîne dans l'ordre, ensuite on clique l'étape à changer et la colonne devient le récapitulatif du jeu. Les aides, les vignettes et les exemples ne disparaissent jamais. Une étape qui ne montre pas ce qu'elle décide n'est pas une étape : la vue et la taille se choisissent sur des vignettes, avec le même sujet dessiné dans chacune.

**Une description se compose en cliquant plutôt qu'en rédigeant.** Une étiquette est une paire — un libellé qu'on clique, et le texte anglais qui part vraiment. La base est **vide au départ**, appartient à l'atelier entier et non à un jeu, et grandit de chaque étiquette fabriquée dans n'importe quel projet. Au premier projet, l'étape de l'allure est donc sept champs de texte libre, et elle le dit franchement plutôt que de faire semblant.

**Rien n'oblige à partir de rien.** L'étape des références fabrique un texte tout prêt à copier dans un outil d'images grand public, assemblé à partir des étapes précédentes, qui demande un premier aperçu du jeu et trois variantes. Rien n'est payé par l'atelier, et c'est la première fois qu'on voit sa description assemblée — beaucoup de contradictions se remarquent là.

**La barre d'espace montre n'importe quelle vignette en grand, partout.** On survole une petite image, on appuie, elle s'affiche en grand ; la molette la zoome. Le geste vaut sans exception — la fiche d'une chose, le codex, l'écran de confirmation, une planche —, et c'est lui qui permet de garder les vignettes petites au lieu d'ajouter une taille à la liste fermée du produit.

**Le guide fait le tour des quatre lieux, et il doit une ligne à chaque écran.** Un manque d'explication est un fait sur le guide, et il se range dans le guide : sa liste des manques cesse d'être tenue à la main et devient **une dette que chaque écran paie au moment où il est construit**. Un réglage sans explication ne casse rien — il n'a simplement pas de trait sous son nom, et l'auteur voit qu'il n'y a rien à survoler.

## Notes complémentaires → `docs/prd-carnet.md`

Ce qu'une séance ou un banc a trouvé, et qui explique une décision de ce document sans la
remplacer, vit dans **`docs/prd-carnet.md`**. On l'ouvre quand une décision d'ici paraît
arbitraire et qu'on veut savoir ce qui l'a dictée.
