# Asset Kitchen — PRD

> Écrit le 26 août 2026, **tenu à jour au 2 septembre 2026**. Ce document fait foi sur **ce
> que doit faire le produit, du point de vue de l'usage**. Il ne dit rien de la construction :
> voir `docs/ARCHITECTURE.md`. Ce qui reste à construire et dans quel ordre : `docs/PLAN.md`.
> Ce que les bancs de la V3 ont mesuré : `docs/bilan-v3.md`.

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

**Puis le produit a servi trois jours de suite, et deux frottements de plus sont apparus — le
premier sous les doigts, le second dans les chiffres.**

**Le traitement se refait à la main sur presque chaque image.** Le réglage de départ du
découpage est le même pour tout : une image seule, un morceau de planche, un décor, un
personnage. Compté sur les cent seize images de l'auteur, **il est corrigé plus d'une fois sur
deux**, et les deux familles ne veulent visiblement pas la même chose — deux tiers des images
seules portent une correction du bord contre un peu plus d'un tiers des morceaux de planche, et
la pipette ne sert jamais sur un morceau de planche. À côté, le plus vieux défaut du produit
n'a jamais été réglé : un modèle rend une image de mille pixels *à l'allure* pixel art dont les
blocs sont inégaux et les bords flous, et la ramener sur la grille du jeu fabrique de la
bouillie. **Chacune de ces corrections coûte une minute, et il y en a une par image.**

**Et l'animation, qui est ce que le jeu réclame ensuite, ne tient sur aucun des deux tableaux.**
Un personnage figé ne marche pas : il faut une suite d'images qui, mises bout à bout, donnent un
pas. Demandées au modèle sur une planche, elles reviennent bonnes **une fois sur dix** — mesuré
sur cent trente-cinq planches payées et regardées une par une. Et **réécrire la demande est
épuisé comme levier** : trente-et-un réglages sur trois bancs, puis six variantes de plus, aucune
ne bat le témoin. *Cette voie-là est close, et c'est mesuré.*

**Ce qui est payé est aussi détruit avant d'être vu** : l'atelier recadre chaque image sur ce
qu'elle occupe, si bien qu'un bras tendu réduit tout le personnage — le balancement, s'il
existait, se perd entre le modèle et l'écran. Et **il n'y a rien pour juger** : ce qui revient est
découpé d'office, les morceaux entrent en bibliothèque, et l'auteur ne voit jamais la marche
tourner.

**Le chemin qui marche a été trouvé le 2 septembre 2026, et il ne passe pas par la planche.** On
demande au modèle **une petite vidéo du personnage** au lieu d'une grille de dessins : une
centaine d'images d'un mouvement continu, dans lesquelles on prélève ce qu'on veut. Trois faits
le portent, tous mesurés : le personnage y reste stable, son fond reste détourable, et **un même
clip porte plusieurs animations** — le repos et la marche s'y découpent séparément. Le tri se
fait donc *dans* le tirage au lieu d'entre les tirages. Et le clip se fabrique aussi **sur la
carte graphique de la maison**, sans rien payer.

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

**Puis l'interface refaite a été usée deux fois le même soir, et les tables de retouche ont
réclamé cinq choses qu'aucun écran ne savait faire.** Les deux premières rendent la recette
maniable. **Une place s'éteint sans se vider** : on essaie l'image sans elle, on rallume, et
l'on retrouve ce qu'on avait posé — éteindre et vider cessent d'être le même geste. **Et les
réglages voyagent**, de deux façons qui n'ont pas la même durée de vie : on les copie d'une
image sur l'autre pour la séance en cours, on les enregistre sous un nom pour ce qui doit lui
survivre. Ce qui *ne* voyage pas est écrit avec : un endroit désigné sur **cette** image-là —
un cadre tracé, un point de pipette, une forme entourée, un passage de la main — ne veut rien
dire sur une autre, et six attitudes d'un même personnage n'ont pas la même silhouette.

Les trois autres comblent des absences, et c'est ce que la seconde séance a de particulier :
regarder un écran de près cesse de trouver des défauts et commence à trouver ce qui manque.
**Le texte qui a fabriqué une image se relit sur sa fiche**, entier et tel qu'il est parti —
il était enregistré depuis le premier jour et n'était affiché nulle part. **On entoure
grossièrement un sujet et l'atelier va chercher son bord** à l'intérieur de ce qu'on a
entouré : une quatrième façon de désigner ce qu'on retire, à côté du remplissage depuis le
bord, de la pipette et du modèle, pour ce que ni le détourage automatique — qui décide seul
et se trompe — ni la retouche au pixel — qui demande de suivre un contour entier — ne savent
faire. **Et le détourage par modèle, qui ne connaissait qu'un seul modèle, en connaît un
second, plus lourd et meilleur** : il n'est pas le défaut, il annonce sa lenteur avant de
partir, et il se grise avec sa raison quand la machine ne l'a pas.

**Et le texte qui part cesse d'être un bloc.** Il se range en trois parties nommées — ce que
le jeu est, les images jointes, et ce qu'on demande cette fois-ci —, et l'écran qui montre ce
qui va partir les montre séparément, de sorte qu'on corrige l'une sans toucher aux autres.
**Chaque image jointe est annoncée pour ce qu'elle est** — un style, une pose, un gabarit —, ce
qu'aucune ligne ne disait jusque-là : un artwork de style, un gabarit de découpe et un sprite
de référence partaient dans le même sac, et rien n'empêchait le modèle de prendre l'un pour
l'autre.

**Puis les tables ont cessé d'être à refaire.** Le réglage de départ du traitement n'est plus
unique : il dépend de **ce qu'on fabrique** — une image seule et une planche n'ont pas le même
défaut, et une famille de l'univers peut porter le sien. L'auteur voit lequel s'appliquera, et
d'où il vient, avant de générer. L'atelier **retrouve la vraie taille de bloc** que le modèle a
dessinée au lieu de la supposer, et ramène à la cible sans fabriquer de couleurs entre deux : un
aplat reste un aplat, un bord net reste net, et la palette du jeu s'applique après la réduction
et non avant. **Le fond sur lequel le modèle pose le sujet devient un réglage du jeu** —
choisi par l'auteur, visible, et corrigible à la main juste avant de payer, parce que c'est un
morceau du texte qui part comme un autre ; l'atelier peut proposer une couleur que rien du jeu
ne porte, il ne l'impose jamais. Et **le détourage gagne un moteur fait pour
des dessins** : les trois qu'il connaît viennent tous de la photographie, alors que ses images
sont des dessins. Le catalogue en accueille un de plus, entraîné sur du dessin.

**Sur cet atelier vient enfin se poser le mouvement, et il s'obtient en vidéo.** Cinq choses le
rendent possible, et elles se suivent.

**Un mouvement se dit une fois pour toutes.** Repos, marche, course, saut, attaque : ce ne sont
plus des phrases retapées à chaque personnage, mais des objets de l'atelier qui portent leur
texte, leur cadence et les directions où ils ont un sens. **Ce n'est pas une seconde liste à côté
des poses** : c'est ce que la même pose sait dire quand on l'anime. Deux commandes du même
mouvement partent alors avec exactement la même demande, et ce qui varie d'un tirage à l'autre
redevient le tirage, non la frappe.

**Un clip se commande, et rien de ce qui est payé ne se perd.** On choisit un personnage, un
mouvement et un modèle ; **l'image de départ se propose et se change** — la case visée si elle
porte déjà une image, le portrait du personnage sinon. Le prix s'annonce avant l'envoi avec la
formule qui le produit, le montant réellement facturé s'enregistre au retour, et un clip payé
garde sa dépense même si son fichier revient illisible ou si l'atelier se ferme pendant l'attente.
On peut en lancer plusieurs à la suite et les regarder revenir un par un.

**Un clip devient plusieurs animations.** L'écran de montage l'ouvre en boucle et montre deux
aperçus côte à côte : les images brutes du modèle à gauche — *le mouvement est-il bon ?* —, les
mêmes passées par la chaîne du jeu à droite — *la bande est-elle bonne ?* **Juger un mouvement et
juger un découpage sont deux métiers.** L'auteur prend ou laisse **chaque image d'un clic**, parce
qu'un pas de marche demande deux images serrées au contact et une seule pendant la glisse ; il
nomme ce qu'il garde, l'affecte à une case du plan de poses, et **recommence dans le même clip**
pour l'animation suivante. Les images d'une bande se recadrent sur **une seule fenêtre commune,
prise sur le clip entier** — sans quoi le personnage grandit de dix pour cent en se mettant à
marcher.

**Et l'atelier sait animer sans payer.** Le même clip se fabrique sur la carte graphique de la
maison. Le moteur local apparaît dans la même liste que les modèles payants, avec le même geste
pour le choisir ; ce qui change est ce qui s'affiche à côté : **une attente au lieu d'un prix**.
Un coût de zéro n'est pas un coût inconnu, et le journal des dépenses les distingue. C'est ce qui
rend praticable de couvrir **toutes les poses d'un personnage** : la matrice se lit alors sur deux
calques — les images fixes, les animations —, chacun avec sa jauge, et l'on voit d'un coup d'œil
ce qui n'est pas encore animé.

**Enfin, une bande sort, et une image se rattrape au passage.** Ce qui part vers le jeu, ce sont
les images : planche de sprites et son descriptif dans le format que les moteurs lisent déjà,
image animée pour la montrer sans rien installer, cadence écrite dedans. Le contour cesse de
grésiller quand la bande tourne — un défaut fixe est un défaut, un défaut animé est un défaut
qu'on regarde. Et pendant qu'il découpe, l'auteur peut **mettre de côté n'importe quelle image du
clip** : elle entre en bibliothèque avec sa filiation, et sert de pose fixe, d'objet ou de ce
qu'il voudra.

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

**Les 494 user stories vivent dans `docs/user-stories.md`**, groupées par geste. Elles
se consultent par numéro, quand un critère en cite une — pas au démarrage d'une session.
Quelle tranche porte laquelle se lit dans `docs/PLAN.md`, § Couverture.
`US-174` à `US-308` sont celles de la V2.1, écrites le 31 août 2026 ; `US-309` à `US-333`
celles de la V2.2, écrites le même jour ; `US-334` à `US-366` les cinq capacités que les deux
séances d'usage de la V2.1 ont réclamées, écrites le 1<sup>er</sup> septembre 2026 ; `US-367`
à `US-430` le 2 septembre — la planche qui revient de travers, l'animation, les tables de
retouche.

**Les soixante-trois dernières sont des 2 et 3 septembre 2026, et elles portent le passage à la
vidéo.** `US-431` à `US-433` pour le texte qui part en trois parties ; `US-434` à `US-461` pour le
clip, son montage et le moteur de la maison ; `US-462` à `US-475` pour deux écrans repris après
une séance d'usage ; `US-476` à `US-481` pour les tailles du monde ; `US-482` à `US-494` pour le
recadrage du 3 septembre — animer toute la matrice d'un personnage, attraper une image d'un clip
au vol, et ouvrir le dépliage à plusieurs sujets. **Quatre stories sont retirées** ce jour-là,
barrées à leur place avec la raison : `US-375`, `US-377`, `US-378` et `US-389`.

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
- Ce que chaque génération a réellement consommé est enregistré **dans l'unité de son fournisseur**, l'argent est totalisé par projet, et le nombre de références envoyées est visible.
- Un appel qui ne coûte rien dit **gratuit**, jamais « 0,00 $ » — et ce qu'il a consommé se lit à côté du mot.
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

**Les cinq capacités que l'usage a réclamées**

- Une place de la recette s'éteint depuis la barre sans qu'on l'ouvre ; l'image se refait sans elle, et la rallumer rend les réglages d'avant à l'identique.
- Deux images traitées par la même recette, l'une avec une place en veille et l'autre sans cette place du tout, sortent identiques au pixel près.
- Les réglages d'une image se posent sur une autre en deux gestes, et le collage nomme ce qu'il a posé et ce qu'il n'a pas pu poser.
- Une recette enregistrée sous un nom se retrouve après la fermeture de l'atelier, s'applique à une image d'un autre jeu, et deux images qui l'ont reçue sortent identiques au pixel près.
- Un cadre tracé, un point de pipette, une forme entourée et un passage de la main ne se retrouvent jamais sur une autre image, ni par collage ni par recette nommée.
- La fiche d'une image montre le texte entier qui est parti la fabriquer ; une image importée dit qu'elle n'en a pas, et une découpe de planche nomme sa planche et y mène au lieu d'afficher un texte qui n'a pas été écrit pour elle.
- Une forme tracée grossièrement autour d'un sujet rend un contour posé sur le bord du sujet à l'intérieur de cette forme, rien n'est touché au-dehors, et le même tracé rend deux fois le même résultat.
- Le sujet ainsi détouré est cadré et calé dans sa case comme n'importe quel autre : le recadrage et la mise sur grille travaillent après lui, sur une image dont le fond est déjà parti.
- Le moteur d'une passe de détourage se choisit dans une liste ; un moteur absent est grisé avec sa raison, et une recette qui le nomme le dit sans casser le rendu des autres passes.
- Le moteur lourd annonce sa lenteur avant de partir, annonce une seule fois ce qu'il doit rapatrier et combien ça pèse, et le relevé qui le dit meilleur existe — les durées des deux moteurs, et ce qu'ils rendent côte à côte.

**Les tables cessent d'être à refaire**

- Le réglage de départ d'une image seule et celui d'une planche se règlent séparément ; une famille de l'univers peut porter le sien, et sans quoi elle hérite de celui de sa nature.
- L'auteur voit quel réglage de départ va s'appliquer, et d'où il vient, avant de générer.
- Un réglage de départ modifié ne touche à aucune image déjà faite, et une recette écrite avant ce changement rend exactement ce qu'elle rendait.
- Après cette livraison, le nombre de recettes du dépôt qui s'écartent encore de leur réglage de départ est compté et écrit — il était de plus d'une sur deux.
- La vraie taille de bloc d'une image est retrouvée sur un lot d'images du dépôt, le taux de réussite est mesuré et écrit, et l'auteur peut l'imposer à la main quand la détection renonce — laquelle dit qu'elle renonce.
- Deux images réduites, l'une par l'ancienne méthode et l'autre par la nouvelle, sont comparées côte à côte, et le résultat est écrit.
- Un aplat reste un aplat : la réduction n'invente aucune couleur qui ne soit dans l'image d'origine, et la palette du jeu s'applique après la réduction, jamais avant.
- Le fond sur lequel le modèle pose le sujet se voit, se choisit et s'enregistre dans les réglages du jeu ; il se corrige à la main avant de payer, pour cet appel seulement.
- L'atelier propose une couleur de fond sûre depuis la palette du jeu ; quand aucune ne l'est, il le dit et laisse le fond en place — il ne choisit jamais en silence.
- Deux mesures s'affichent sur une image revenue — les pixels de bord, et ceux encore collés à la couleur de fond —, de sorte qu'un fond mal choisi se voie sur les images qu'on voulait de toute façon, sans séance d'essais dédiée.
- La phrase qui interdit au modèle d'employer la couleur de fond dans le sujet, les reflets, les accessoires et les ombres part avec la demande, et se relit dans la génération enregistrée.
- Un jeu qui n'a pas encore de palette se comporte exactement comme avant.
- Un moteur de détourage entraîné sur du dessin est essayé et comparé aux trois actuels sur des images du jeu, et le résultat est écrit.
- Le contour tracé sur une image réduite tombe sur le bord du sujet et non entre deux couleurs, et le même réglage rend deux fois le même trait.

**L'animation, par la vidéo**

*Recadré le 3 septembre 2026 : l'animation s'obtient en animant puis en découpant, jamais en
demandant une planche. Ce que la planche et son dépliage deviennent est plus bas, sous leur
propre titre.*

- Un mouvement nommé porte son texte, sa cadence et les directions où il a un sens ; **une pose du plan dont l'identifiant correspond à un mouvement connu hérite de son texte animé**, et deux clips du même mouvement partent avec exactement le même texte.
- Un clip se commande depuis un personnage, avec son mouvement et son modèle ; **l'image de départ se propose et se change** — la case visée si elle porte une image, le portrait sinon, n'importe quelle image de la bibliothèque d'un clic.
- Le prix annoncé avant l'envoi porte sa formule ; le montant enregistré est celui de la réponse du fournisseur, et il dit s'il a été **relu ou estimé**.
- Un clip payé garde sa dépense même si son fichier est illisible, si l'extraction échoue, ou si l'atelier se ferme pendant l'attente ; le récupérer est un geste que l'auteur demande, jamais un rappel automatique.
- Plusieurs clips se lancent en un geste, le prix du lot est annoncé avant, ils reviennent **un par un** et se regardent bouger dès leur arrivée ; le journal garde ce qui a été payé, clips jetés compris.
- Un clip s'ouvre en tournant déjà en boucle, et montre côte à côte, sur un seul métronome, les images brutes du modèle et la bande passée par la chaîne du jeu.
- **Chaque image du clip se prend ou se laisse d'un clic**, et la bande n'est jamais forcée à des images régulièrement espacées ; les images retenues se voient dans l'ordre et se retirent de là.
- Plusieurs bandes se gardent depuis le même clip, chacune nommée et affectée à une case du plan de poses ; le prix par bande s'affiche et **baisse à chaque bande gardée**.
- Les images d'une bande partagent une seule fenêtre, **prise sur le clip entier** : un personnage ne change pas de taille en passant du repos à la marche, et le cadrage se reprend à la main quand l'automatique tombe mal.
- La recette du découpage se règle depuis l'écran de montage, elle **part de celle du jeu**, et tout écart avec le jeu est écrit en clair. Rien sur cet écran ne dépense, et une phrase le dit.
- Un clip se fabrique **sur la carte graphique de la maison**, dans la même liste et avec le même geste que les modèles payants ; son coût affiché est **une attente, pas un prix**, et l'écran dit si le modèle est encore à charger.
- **Un clip local enregistre une dépense de zéro, et zéro n'est pas « inconnu »** ; l'écran annonce le nombre d'images réel que le moteur rendra, recommande la durée courte, et distingue trois absences — moteur éteint, modèles à télécharger, greffon manquant.
- Le produit **ne modifie jamais l'installation de ComfyUI**, et un clip local suit exactement le même chemin qu'un clip payé une fois revenu.
- La matrice d'un personnage se lit **sur deux calques** — images fixes, animations —, chacun avec sa jauge ; une case animée dit de quel clip elle vient, et commander le clip d'une case vide se fait depuis cette case.
- **Une image du clip se met de côté sans quitter l'écran de montage** : elle entre en bibliothèque avec sa filiation, passe par la chaîne du jeu, et se range ensuite dans une case ou sur un objet en un second geste facultatif.
- Une bande sort en planche de sprites avec un descriptif écrit dans un format existant, et en image animée lisible sans moteur de jeu ; la cadence réglée à l'écran est celle qui part, et ce qui sort est exactement ce que l'aperçu montrait.
- La stabilité d'une bande est mesurée et le chiffre s'affiche à côté de l'aperçu ; la palette d'une bande est calculée une fois pour la bande, jamais par image.
- L'image précédente s'affiche en transparence sous celle qu'on corrige, une image se déplace au pixel, se remplace par une autre — du même clip ou d'un autre —, et la bande dit de quel clip vient chaque image.
- Rien n'est jamais relancé automatiquement, et tout ce qui ne commande pas fonctionne réseau coupé.

**Le dépliage, qui divise le prix de tout le reste**

*Sorti de l'animation le 3 septembre 2026 : il ne sert pas à animer, il sert à payer un appel au
lieu de huit, pour les poses fixes comme pour les objets et les décors.*

- Une planche générée apparaît dans la galerie avec sa génération, son coût et sa géométrie ; la déplier ne coûte aucun appel et fonctionne réseau coupé.
- Une planche qui revient bien est découpée toute seule et ne demande **aucun geste de plus qu'aujourd'hui** — ni avant, ni après.
- Refaire un découpage est un geste que l'auteur demande ; il repart des coupes proposées, et chaque coupe se déplace, s'ajoute et se retire avant de valider.
- Une planche se déplie plusieurs fois, les dépliages coexistent, chaque image dit de quel dépliage elle vient, et supprimer un dépliage n'emporte ni la planche ni les autres.
- **La géométrie s'écrit sur le pliage** au lieu d'être déduite du nombre de cases, sans quoi changer la formule redécouperait les planches anciennes de travers.
- Une planche qui rend neuf sujets pour huit demandés entre quand même, avec le choix de la case à écarter ; une planche qui n'en rend que sept reste refusée.
- Une planche dont le modèle a redessiné le quadrillage est signalée en toutes lettres, jamais acceptée en silence.
- Une planche peut porter **plusieurs choses différentes du jeu** dès lors que la demande dit d'avance ce que chaque case contient ; une case dont le sujet n'est pas celui annoncé se signale au lieu de se ranger de travers, et le prix par sujet s'affiche à côté du prix de la planche.

## Hors périmètre

**Écarté par nature du produit.** Comptes, crédits, paiement, multi-utilisateur, distribution, galerie publique, partage, presets communautaires. Pack d'assets par genre — fabriquer de la quantité est le métier d'un autre outil. Compteur de crédits maison : le suivi des coûts se lit chez le fournisseur.

**Écarté parce que l'auteur fait mieux.** Contrôle de conformité automatique. Description automatique du style. Routeur d'intention qui devinerait le type d'asset.

**Écarté par coût de construction disproportionné.** Extraction de composants d'interface et éditeur de découpe en neuf zones. Paquets prêts à importer dans un moteur — entre l'archive et le paquet il n'y a que du glisser-déposer. Modèles locaux à l'intérieur de l'application : ils restent dehors, on importe leur résultat.

**Écarté de la V1, prévu ensuite.** ~~Génération autre que pixel art.~~ Tuiles qui se raccordent. ~~Personnage et ses poses préparées.~~ ~~Animation de sprites.~~ Son. *(Trois des cinq sont revenues, chacune avec son paragraphe daté plus bas ; il reste les tuiles et le son.)*

**Écarté par choix d'ergonomie.** Mobile et tablette : écran large uniquement, aucun point de rupture, aucun menu escamoté, aucune mise en page de repli. Corbeille : suppression avec annulation courte. ~~Écran séparé pour la bibliothèque~~ et ~~détourage par couleur~~ — les deux sont revenus le 31 août 2026, voir plus bas.

**Revenu dans le périmètre — 27 août 2026.** « Toile libre dans le tableau d'inspiration : grille seulement » était écarté ici, au même titre que le reste, jusqu'à ce qu'une séance d'essai sur le produit tenu montre l'inverse : la grille montre tout d'un coup d'œil et ne permet d'organiser rien, et le champ `groupe` — une étiquette qui n'a aucune forme à l'écran — n'y suffit pas. La toile s'ajoute donc à la grille **sans la remplacer**, et devient les tranches T8 et T9 du plan. Ce qu'elle n'est pas, en revanche, reste écarté : dessin à main levée, formes et flèches libres, plusieurs toiles par projet, export de la toile en image, liens entre cartes de projets différents, alignement et distribution automatiques, et couleur choisie librement — six teintes fermées, et rien au-delà.

**Écarté par les décisions de ce document.** Sas d'acceptation avant l'entrée en bibliothèque. Suppression en cascade. Refus de supprimer tant qu'il existe une descendance. Création implicite d'un projet par l'agent. Invite d'autorisation qui bloquerait l'agent en attendant l'auteur. Liste de modèles écrite en dur. Relance automatique après interruption. Réapplication forcée de la palette sur les recettes réglées à la main. Enchaînement d'outils fins que l'agent devrait composer lui-même. Passe de retouche qui monopoliserait la carte graphique.

**Écarté sur les références.** Sélection manuelle des artworks à envoyer, génération par génération : c'est l'application qui choisit, sur la famille. Obligation que l'artwork officiel soit une planche non figurative : trop contraignant, l'auteur travaille justement à partir de visuels trouvés. Déduction de la taille de pixel depuis l'image reçue : elle est imposée par le projet, jamais devinée.

**Revenu dans le périmètre — 28 août 2026.** « Personnage et ses poses préparées » était écarté de la V1 et renvoyé à un « ensuite » sans rang, derrière les tuiles. Deux essais payés le 28 août 2026 ont levé les deux doutes qui le retenaient : un jeu de poses tient dans une seule image sans que la grille de pixels dérive d'une pose à l'autre, et une pièce d'équipement s'extrait d'un corps habillé sans qu'un seul pixel du corps soit repeint. Le personnage et son équipement passent donc devant les tuiles et forment la V2. L'ordre des versions devient : **V2 le personnage et son équipement, V3 l'animation, V4 les tuiles qui se raccordent, V5 le son.** L'équipement, qui n'était nulle part, entre avec le personnage parce qu'il n'existe pas sans lui.

**Écarté de la V2 — repoussé.** ~~Animation~~, tuiles raccordées, son. ~~Squelette, os, interpolation entre deux poses : c'est l'animation, pas le personnage.~~ *(Les deux sont revenus le 2 septembre 2026 : c'est la V3, et son paragraphe est plus bas.)* Salle d'essai qui montrerait le personnage équipé dans un décor. Bibliothèque de poses partagée entre projets : le plan appartient au projet qui le porte.

**Écarté de la V2 — par les décisions de cette version.** Deuxième grille d'assets : la matrice de production d'un personnage n'en est pas une — pas de recherche, pas de filtres, pas de sélection multiple, deux axes et des vignettes, rien de plus. Point de repère, ancre ou marque injectée dans l'image pour recaler un calque : le calque est une pure différence, et rien n'est ajouté à l'image envoyée. Génération d'une pièce seule sur fond vide : une pièce n'existe qu'apparue sur un corps. Calque unique porté sur toutes les poses : une pièce est solidaire de la pose sur laquelle elle est apparue, et il en faut une par pose — c'est le pliage qui en divise le prix, pas une réutilisation. Combinaison de deux pièces qui agrandissent la silhouette sur le même corps : ce qui revient d'une pièce qui agrandit est un corps habillé et non un calque, et deux corps habillés ne s'empilent pas. Détection automatique de ce qui agrandit la silhouette : l'auteur déclare, au même titre qu'il nomme la pièce et l'emplacement. Plafond sur la taille d'un lot : le produit annonce ce que coûte un compte faux, il ne l'interdit pas. Refus automatique sur les mesures de qualité : elles informent, seul le compte d'images refuse. Reconnaissance automatique de la pièce ou de l'emplacement depuis l'image : l'auteur nomme, l'application enregistre. Mannequin ou silhouette de référence imposée à tous les personnages. ~~Feuille de sprites assemblée à la sortie : le pliage est une ruse d'appel, pas un format de livraison — ce qui sort, ce sont des images séparées et leur descriptif.~~ *(Renversé le 2 septembre 2026 : une planche devient un objet du produit, et une bande sort assemblée. Voir plus bas.)*

**Revenu dans le périmètre — 28 août 2026 (les quatre reprises).** « Génération autre que pixel art » était écarté de la V1 et renvoyé à un « ensuite ». Une séance sur le produit tenu a montré que l'écart n'était pas là où ce document le plaçait : **rien du style n'est écrit dans le prompt** — seule la bible part, et une bible vide ne dit rien —, mais **le post-traitement, lui, impose l'apparence sans qu'on l'ait demandée** : la remise sur grille est systématique, donc toute image revient sur 64 ou 96 pixels, et la quantification la ramène sur la palette dès qu'un artwork existe. L'auteur ne voit ni ce qui part, ni ce qui est appliqué au retour. Trois choses entrent donc dans le périmètre : **le prompt exact se voit et se reprend**, **la bible gagne la vue et la technique de rendu**, et **la taille de pixel accepte « aucune »**. Trois autres suivent, de la même séance : l'import depuis l'écran, le réglage d'univers qui se voit sans recharger, et l'infobulle qui ne couvre plus le réglage voisin.

**Revenu dans le périmètre — 30 août 2026.** « Assistant de premier lancement » était écarté ici, au nom de ce que le portrait de l'auteur protège : ne pas être retenu avant d'écrire. L'exclusion a cessé de protéger quoi que ce soit le jour où l'écran sur lequel elle reposait a disparu. Il n'y a plus d'Atelier : l'argent ne part plus que de deux endroits, l'établi d'une chose et le codex ; or un établi appartient à une chose, et sur une installation neuve le codex est vide. **Il n'y a plus nulle part où écrire un prompt**, et l'exclusion défendait un accès direct qui n'existait plus. L'assistant entre donc dans le périmètre, sous la condition qui remplace l'exclusion : **on en sort à n'importe quelle étape**, une étape passée reste passée sans rien bloquer ni se redemander, et sortir dès la première dépose dans le codex, champ qui nomme allumé. Ce qui reste écarté, c'est l'assistant *obligatoire* : aucune de ses étapes ne l'est.

**Écarté par ces reprises.** Mode de rendu HD à part entière, où le projet basculerait d'un bloc : la case « aucune » de la taille de pixel suffit à rendre la grille facultative, et un second axe de configuration se paierait à chaque écran. Quantification débrayable indépendamment : elle reste attachée à l'existence d'une palette — un projet qui n'en veut pas ne promeut pas d'artwork. Bible en texte libre : les champs nommés restent des champs nommés, la liste s'allonge de deux et ne s'ouvre pas. Prompt réécrit par l'application, traduit ou enrichi automatiquement : ce qui est montré est ce qui part, mot pour mot. Import qui devinerait la famille, l'échelle ou le traitement à appliquer : l'auteur déclare, comme partout ailleurs.

**Revenu dans le périmètre — 31 août 2026 (la V2.1).** Trois exclusions tombent, et chacune tombait pour la même raison : elle protégeait quelque chose que la réorganisation des écrans a rendu impossible ou inutile.

*L'écran séparé pour la bibliothèque* était écarté au nom d'« organiser n'oblige jamais à quitter l'endroit où l'on crée ». La galerie devient un onglet à elle, où l'on ne fabrique rien. La règle qu'il protégeait se coupe en deux : ce qui tombe, c'est *ranger là où l'on crée* — il n'y a plus rien à ranger à la main, puisqu'une image naît dans l'établi d'une chose et lui appartient d'emblée. Ce qui reste, et qui était le fond, c'est **une seule grille d'assets dans tout le produit** : la matrice d'une chose, la réserve du tableau et la liste des dépenses n'en sont pas. Ce qui le tient est écrit plus bas, surface par surface — les deux premières sont privées de recherche, de filtre et de sélection multiple ; la troisième ne porte aucune image.

*Le détourage par couleur* était écarté quand le remplissage depuis le bord suffisait à tout. Il devient le troisième moteur de passe, à côté du remplissage et du modèle facultatif : on désigne une couleur dans l'image, et l'on choisit de retirer cette tache-là ou toutes celles de cette couleur. Ce qui l'a fait revenir est une poche de fond enfermée par le sujet, qu'aucune tolérance ne peut atteindre parce que le remplissage part des bordures et que le chemin n'existe pas.

*L'assistant de premier lancement* est revenu le 30 août, et son paragraphe est ci-dessus.

**Écarté par les décisions de la V2.1.** Une entité « essais » servant de panier : elle fabriquerait un endroit où les images échappent au codex. Une barre de saisie dans l'univers, ou dans la galerie : les lieux d'où l'argent part restent deux. Une sixième taille de vignette pour reconnaître une image de référence : la barre d'espace montre n'importe quelle vignette en grand, partout. Un second panneau de réglages à côté de l'assistant : deux endroits qui règlent la même chose finissent par se contredire. Un dictionnaire d'étiquettes de style apporté du dehors : vérifié, les thésaurus d'art donnent *baroque* et jamais *pixel art 16 bits*, et aucun ne donne le texte anglais qui marche sur une IA d'image. Une cascade d'héritage entre le jeu, l'ambiance et une chose : une ambiance est une boîte qu'on désigne et dans laquelle on pioche, pas un étage dont on hérite. Deux ambiances sur une même chose : il faudrait une règle de priorité pour chaque texte et chaque image, et elle serait invisible au moment où elle décide. Un écran du gaspillage qui ne montrerait que ce qu'on a payé pour rien : mesuré, aucune image du dépôt n'a jamais été supprimée, et cet écran-là aurait affiché zéro. Un bouton « refaire cet appel » dans les dépenses : un écran qui regarde en arrière ne devient pas un troisième guichet. Une case définitive « ne plus jamais me montrer ce qui part » : on la cocherait le premier jour, quand on ne sait pas encore qu'on en aura besoin. Un contrôle libre de la couleur de fond dans la vitrine : on trouverait toujours un fond sur lequel le sprite est joli, et jamais celui sur lequel il disparaît.

**Revenu dans le périmètre — 31 août 2026 (la V2.2).** « Un seul adaptateur » n'a jamais été une exclusion du produit : c'était une décision de construction, prise le 26 août parce qu'écrire trois adaptateurs donnait *le même résultat* pour trois fois le travail. Elle cesse de valoir le jour où les trois autres ne donnent pas le même résultat — ils donnent des images **gratuites**, avec une réserve qui se renouvelle chaque jour ou chaque mois. Trois choses entrent donc dans le périmètre : **plusieurs fournisseurs à la fois**, **une consommation qui n'est pas toujours de l'argent**, et **une première image sans compte ni clé**. La troisième est la seule que l'auteur remarquera sans la chercher : sur une machine neuve, il n'y avait rien à faire tant qu'une clé n'était pas déposée.

**Écarté par la V2.2.** Le repli automatique d'un fournisseur sur un autre quand l'un tombe : ce serait une relance que l'auteur n'a pas demandée, et *rien n'est jamais relancé automatiquement* est la règle la plus ancienne du produit. Le mélange de deux fournisseurs dans un même appel. Le choix automatique du moins cher : le modèle est un défaut par type d'objet porté par l'univers, et un arbitrage caché entre gratuit et payé déciderait de l'apparence sans le dire. Publier une image de l'auteur à une adresse web pour qu'un fournisseur puisse la lire en référence : un atelier local ne publie rien, et un modèle qui n'accepte les références que par ce chemin-là est simplement grisé avec cette raison. Une note de qualité par modèle calculée par le produit : elle se juge à l'usage, sur des images qu'on voulait de toute façon — et deux bancs payés ont déjà appris qu'un classement obtenu hors du geste réel s'inverse dès qu'on y revient. Un compteur de crédits maison, qui reste écarté depuis la V1 : la réserve d'un fournisseur se lit chez lui quand il la dit, se compte ici quand il ne la dit pas, et l'écran dit toujours lequel des deux — mais le produit ne tient aucune comptabilité parallèle.

**Écarté par les cinq capacités de l'usage — 1<sup>er</sup> septembre 2026.** Une veille plus fine que la place et la passe : on éteint une place de la recette, ou une passe de détourage, jamais un réglage seul — un curseur éteint fabriquerait un second zéro à côté du sien, et personne ne saurait lequel des deux agit. Un troisième geste de voyage, où un traitement suivrait de lui-même toutes les images d'une chose du jeu : la palette du projet fait déjà cela pour ce qui la concerne, et un traitement qui se poserait tout seul déciderait de l'apparence sans le dire. Une bibliothèque de recettes livrée avec le produit : elle naît vide, comme la base d'étiquettes, et grandit de ce qu'on y met. L'historique des recettes appliquées, et le versionnement d'une recette nommée : remplacer sous le même nom se propose, il ne s'archive pas. Modifier le texte d'une image depuis sa fiche : la galerie ne fabrique rien, et un texte déjà payé ne se réécrit pas — le reprendre pour un nouvel appel est un geste qui existe déjà, ailleurs. Une sélection qui trouverait le sujet sans qu'on ait rien tracé : c'est très exactement ce que fait le remplissage depuis le bord, et c'est quand il se trompe qu'on trace. Un moteur de détourage qui mobiliserait la carte graphique, ou qui rapatrierait son modèle sans le dire. Une note de qualité par moteur calculée par le produit, écartée pour la raison qui l'écarte déjà pour les modèles : elle se juge à l'usage, sur des images qu'on voulait de toute façon.

**Revenu dans le périmètre — 2 septembre 2026 (la V3, et les deux règles qu'elle renverse).**
L'animation était écartée de la V1 puis de la V2, et le squelette avec elle — *« c'est
l'animation, pas le personnage »*. Trois bancs payés les 1<sup>er</sup> et 2 septembre 2026 —
141 planches, 6,03 $, toutes notées une par une par l'auteur — ont levé le doute qui la
retenait, et **la réponse n'est pas celle qu'on espérait** : une planche d'animation revient
bonne **une fois sur dix**, et **aucune façon de la demander ne fait mieux** que celle qui part
déjà. Ce n'est pas un motif d'abandon, c'est un prix — quelques centimes l'animation utilisable.
Mais **il impose la forme du produit** : on commande plusieurs planches et l'on garde la bonne,
jamais on n'en corrige une.

Une règle tombe avec elle, et elle tient toujours : **« Le pliage est une ruse d'appel, jamais un
format de livraison »**. Une planche devient un objet du produit — elle se voit dans la galerie,
se garde, et se déplie autant de fois qu'on veut, à la main. *Tranché par l'auteur le 2 septembre
2026.*

> **Amendé le 3 septembre 2026, et l'amendement est le fait de la journée.** Le soir même du
> 2 septembre, six essais neufs ont montré qu'un **clip vidéo** rend ce qu'une planche ne rend
> pas : une centaine d'images qui se suivent, un personnage stable, un fond détourable, et
> **plusieurs animations pour un seul paiement**. Le lendemain, un banc local a montré que le même
> clip se fabrique **sur la carte graphique de la maison, sans rien payer**.
>
> **L'animation ne passe donc plus du tout par la planche**, et deux conséquences sont tranchées
> par l'auteur : la planche et son dépliage **restent dans le périmètre mais changent de raison
> d'être** — ils servent le prix des poses fixes, des objets et des décors, plus jamais celui de
> l'animation —, et **le pantin sort du périmètre**. Il était le seul chemin qui supprimait la
> loterie ; le moteur de la maison le fait aussi, sans squelette, sans maillage et sans découpage
> en pièces. **Ce qui sort vers le jeu, ce sont donc les images seules** : planche de sprites,
> descriptif, image animée. *La sortie du squelette part avec le pantin, et ses arguments sont
> gardés en fin de `docs/PLAN.md`.*

**Revenu dans le périmètre — 2 septembre 2026 (les tables).** *« Le détourage par défaut n'est
pas du tout efficace, ça m'évitera de systématiquement le refaire à la main »* : la remarque a
été vérifiée avant d'être planifiée, et elle est exacte — le réglage de départ est corrigé plus
d'une fois sur deux, et les deux familles d'images ne veulent pas le même. Quatre choses entrent
donc dans le périmètre : **un réglage de départ par nature d'image**, **la vraie taille de bloc
retrouvée au lieu d'être supposée**, **le fond de génération comme réglage du jeu**, et **une
liste ouverte de moteurs de détourage**. Elles passent **entièrement avant l'animation**, et
pour une raison qui n'est pas de confort : le geste principal de la V3 est de juger une planche
en une seconde, et une image mal traitée n'est pas jugeable.

**Écarté par la V3 — 2 septembre 2026.** **Réécrire** la demande d'animation : **mesuré
mort** — trente-et-un réglages sur trois bancs, cinq réécritures de fond pour zéro bonne
planche sur vingt, les planches à quatre cases pour zéro sur seize. *Ce qui reste dans le
périmètre, et que la mesure n'a jamais touché, c'est de **ranger** ce qui part en parties
nommées — le contexte, les références, la demande —, et d'annoncer chaque image jointe pour ce
qu'elle est : un style, une pose, un gabarit.*
Dégrossir chez un fournisseur gratuit avant de payer le bon : le modèle gratuit n'accepte aucune
image en entrée, donc pas le personnage — ce serait un autre personnage, pas un brouillon.
Corriger le bord d'un détourage par calcul de transparence : **cherché sur quarante vraies
images, le défaut vaut un pixel sur mille**, et la correction en supprime 94 % d'un problème qui
n'existe pas ici. La 3D auto-riguée et le report d'un mouvement filmé : non mesurés, payants ou
suspendus à un compte que ce dépôt n'a pas. Un format de livraison inventé ici, pour la planche
comme pour le squelette : les formats les plus lus existent, ils s'écrivent tels quels. Faire du
pantin la sortie principale du produit : on ne sait pas encore s'il tient sur nos images, et
bâtir la livraison sur une chose non vérifiée est le contraire de la règle du dépôt. Faire
tourner le pantin sur les huit directions : il ne fait bouger que ce qui est déjà dessiné, et
les directions restent une affaire de génération. Une note de qualité par planche calculée par
le produit : la mesure automatique a été confrontée aux notes de l'auteur et **s'est révélée sans
rapport avec elles** — c'est l'œil qui juge, et l'écran doit montrer des images, pas des chiffres.
*(Les deux exclusions qui portent sur le pantin sont sans objet depuis le 3 septembre 2026 : il
est sorti du périmètre en entier.)*

**Écarté par le recadrage — 3 septembre 2026.** **Le pantin articulé**, en entier : il était le
seul moyen d'animer sans payer, le moteur de la maison l'est aussi, et il ne demande ni
squelette, ni maillage, ni découpage en pièces. Ce qui lui restait en propre — la même bande
redemandée revient identique à l'octet, et une animation de plus ne coûte pas même une attente —
est vrai et ne vaut pas six chantiers dans une version dont l'objectif est d'animer par la vidéo.
**Un second écran pour le moteur local** : il entre dans la même liste que les modèles payants,
avec le même geste, et c'est ce qui change qui s'affiche — une attente au lieu d'un prix.
**Modifier l'installation de ComfyUI** — paquet, réglage ou nœud : au banc du 3 septembre, mettre
à jour une bibliothèque pour la vidéo aurait pu casser le générateur de bruitages ; le produit
s'adapte à ce qu'il trouve. **Chercher un fournisseur vidéo de plus** : les vingt-huit modèles
vidéo passent par le compte déjà en place. *Tranché par l'auteur le 3 septembre 2026.*

**Reporté à une version dédiée — 2 septembre 2026.** **Le dessin à la main reste ce qu'il est
aujourd'hui : un pinceau d'un seul pixel.** Ni trait droit, ni rectangle, ni pot de peinture, ni
symétrie — et surtout pas de calques, de sélections ni d'historique de dessin. *Tranché par
l'auteur : « on ne les fait pas, il y aura plus tard une version avec éditeur. »* Ce n'est donc
pas un refus mais un **rang** : ces gestes appartiennent tous au même chantier, et les prendre
un par un fabriquerait un demi-éditeur que personne n'aurait décidé — chacun paraît petit isolé,
et c'est exactement ce qui les fait entrer sans qu'on les ait choisis. La version qui les portera
n'a pas de rang fixé, et rien du plan actuel ne la présuppose.

**Écarté par les tables — 2 septembre 2026.** Un réglage de départ **deviné** depuis l'image
reçue : l'auteur déclare, comme partout ailleurs. Une couleur de fond **imposée** par un calcul :
l'atelier propose, l'auteur tranche — c'est un morceau du texte qui part, et il lui appartient.
Demander au modèle de décrire ce qu'il vient de dessiner : personne ne le pratique, et pour une
bonne raison — on écrit d'avance ce qu'on attend et l'on mesure sur l'image revenue si c'est là.
Demander une image déjà détourée : le catalogue déclare l'option, mais **elle n'est pas ouverte
sur le modèle que le produit emploie** — la mesurer voudrait dire changer de modèle, donc changer
tout le reste avec. Et **un cran intermédiaire entre le moteur rapide et le moteur lourd** :
vérifié le 2 septembre 2026, il existe déjà et porte ce nom-là depuis le lot d'usage.

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
