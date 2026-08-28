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

## User Stories

### Démarrer

- **US-1** — En tant qu'auteur, je veux ouvrir l'atelier et écrire un prompt sans rien avoir configuré, afin d'obtenir une image dès la première minute.
- **US-2** — En tant qu'auteur, je veux travailler d'emblée dans un projet « Bac à sable » qui existe déjà, afin de ne pas avoir à nommer un univers avant de savoir ce que je fabrique.
- **US-3** — En tant qu'auteur, je veux que le bouton générer soit inactif et dise pourquoi quand la clé du fournisseur manque, avec l'accès direct au réglage, afin de savoir quoi faire au lieu de subir un échec.
- **US-4** — En tant qu'auteur, je veux déposer la clé du fournisseur une seule fois, afin de ne plus jamais y penser.
- **US-5** — En tant qu'auteur, je veux créer un vrai projet quand j'en ressens le besoin et pas avant, afin que ranger reste un geste et jamais un préalable.

### Générer

- **US-6** — En tant qu'auteur, je veux écrire un prompt et un prompt négatif, afin de décrire ce que je veux et ce que je ne veux pas.
- **US-7** — En tant qu'auteur, je veux choisir le modèle parmi ceux que le catalogue déclare, afin de prendre le bon outil pour l'usage du moment.
- **US-8** — En tant qu'auteur, je veux voir grisé, avec sa raison écrite, tout modèle qui ne peut pas honorer la demande en cours, afin de ne jamais découvrir l'incompatibilité après avoir payé.
- **US-9** — En tant qu'auteur, je veux que le modèle que j'ai choisi reste choisi quand ma demande le rend invalide — le bouton générer devenant inactif avec sa raison —, afin de ne pas subir une substitution silencieuse.
- **US-10** — En tant qu'auteur, je veux lancer plusieurs variations d'un même prompt en une fois, afin de comparer au lieu d'itérer.
- **US-11** — En tant qu'auteur, je veux voir l'avancement de chaque génération, afin de savoir que ça travaille.
- **US-12** — En tant qu'auteur, je veux réinjecter un asset existant comme référence, comme source d'édition, comme guide de style ou comme jeu de réglages, afin de repartir de ce qui marche.
- **US-13** — En tant qu'auteur, je veux lancer une génération pendant qu'une autre tourne encore, afin de ne pas attendre.
- **US-14** — En tant qu'auteur, je veux voir le coût réel de chaque génération et le total de mon projet, afin de savoir ce que ça me coûte sans quitter l'atelier.

### La génération survit à l'écran

- **US-15** — En tant qu'auteur, je veux fermer l'onglet, changer de projet ou aller ailleurs sans perdre la génération en cours, afin de ne pas payer pour rien.
- **US-16** — En tant qu'auteur, je veux retrouver à la réouverture les générations encore en cours avec leur avancement, afin de reprendre où j'en étais.
- **US-17** — En tant qu'auteur, je veux qu'une génération interrompue par un redémarrage soit marquée comme telle, avec son coût, et relançable d'un geste, afin de décider moi-même si je repaie.
- **US-18** — En tant qu'auteur, je veux qu'aucune génération ne soit jamais relancée automatiquement, afin que rien ne soit facturé sans moi.

### Quand ça échoue

- **US-19** — En tant qu'auteur, je veux voir l'échec à la place de l'image attendue, avec sa raison en clair, afin de comprendre sans avoir à chercher.
- **US-20** — En tant qu'auteur, je veux relancer un échec d'un seul geste sans réécrire le prompt, afin de réessayer quand la cause est passagère.
- **US-21** — En tant qu'auteur, je veux recevoir les images qui ont réussi même quand d'autres variations du même lot échouent, afin de ne pas perdre le lot entier.
- **US-22** — En tant qu'auteur, je veux relancer chaque variation ratée séparément, afin de ne pas repayer celles qui ont marché.
- **US-23** — En tant qu'auteur, je veux qu'aucun échec n'apparaisse jamais dans ma bibliothèque, afin que la grille ne montre que ce que je peux réutiliser.
- **US-24** — En tant qu'auteur, je veux retrouver dans le journal de mon projet les appels ratés et leur coût réel, afin d'expliquer une facture.

### Juger, garder, jeter

- **US-25** — En tant qu'auteur, je veux que toute image produite entre en bibliothèque d'elle-même, afin de ne rien perdre par inattention.
- **US-26** — En tant qu'auteur, je veux marquer un favori, afin de retrouver le bon d'un coup d'œil.
- **US-27** — En tant qu'auteur, je veux supprimer ce qui ne sert pas, avec une annulation courte juste après, afin de nettoyer sans peur.
- **US-28** — En tant qu'auteur, je veux supprimer un asset sans perdre ceux qui en descendent, afin de ne jamais détruire par ricochet ce que j'ai payé.
- **US-29** — En tant qu'auteur, je veux voir « parent supprimé » sur un asset devenu orphelin, afin de comprendre sa filiation incomplète.
- **US-30** — En tant qu'auteur, je veux qu'on me dise combien d'assets contient un projet avant que je le supprime, et les retrouver ensuite détachés plutôt que détruits, afin de ne pas confondre ranger et détruire.
- **US-114** — En tant qu'auteur, je veux voir en grand l'image que je survole en appuyant sur la barre d'espace, et la zoomer à la molette, afin de juger un détail sans quitter la planche contact ni ouvrir quoi que ce soit.

### La bibliothèque

- **US-31** — En tant qu'auteur, je veux une seule et même grille d'assets dans tout le produit, afin de ne jamais quitter l'endroit où je crée pour organiser.
- **US-32** — En tant qu'auteur, je veux chercher, filtrer et sélectionner en multiple, afin de retrouver.
- **US-33** — En tant qu'auteur, je veux ranger en projets et en collections, afin qu'un seul niveau de rangement me suffise.
- **US-34** — En tant qu'auteur, je veux qu'un filtre sans résultat m'affiche l'état vide et le geste pour retirer le filtre, afin de sortir de l'impasse au lieu de faire face à une grille muette.
- **US-35** — En tant qu'auteur, je veux qu'une bibliothèque vide m'invite à écrire un prompt, afin de savoir par où commencer.
- **US-36** — En tant qu'auteur, je veux ouvrir la fiche d'un asset dans un panneau latéral, afin de ne perdre ni la grille ni mon prompt.
- **US-37** — En tant qu'auteur, je veux fermer ce panneau et me retrouver exactement où j'étais.
- **US-38** — En tant qu'auteur, je veux voir la filiation d'un asset, afin de savoir d'où il vient.
- **US-39** — En tant qu'auteur, je veux distinguer d'un coup d'œil ce que l'agent a produit de ce que j'ai produit moi-même, afin de savoir à qui parler quand quelque chose me surprend.
- **US-40** — En tant qu'auteur, je veux que ma bibliothèque se reconstruise à partir de mes fichiers si son index disparaît, afin de ne jamais perdre un asset pour une raison qui ne me concerne pas.

### L'univers

- **US-41** — En tant qu'auteur, je veux coller une image dans mon tableau d'inspiration, afin de rassembler sans friction.
- **US-42** — En tant qu'auteur, je veux coller une adresse et voir la carte apparaître aussitôt, en attente, afin de continuer à coller pendant que ça charge.
- **US-43** — En tant qu'auteur, je veux que la carte reste avec son adresse et sa raison quand la récupération échoue, afin de ne rien perdre et de pouvoir réessayer.
- **US-44** — En tant qu'auteur, je veux coller un texte et obtenir une carte texte, afin de noter une intention au milieu des images.
- **US-45** — En tant qu'auteur, je veux un refus qui nomme le fichier quand ce n'est pas une image, afin de savoir lequel des douze fichiers déposés pose problème.
- **US-46** — En tant qu'auteur, je veux être averti d'un doublon avec un lien vers l'existant, tout en gardant la possibilité d'importer quand même, afin de décider moi-même.
- **US-47** — En tant qu'auteur, je veux grouper mes cartes, les annoter, garder leur provenance et régler leur taille d'affichage, afin de trier vraiment.
- **US-48** — En tant qu'auteur, je veux promouvoir une carte en artwork officiel, afin de décider ce qui définit le style.
- **US-49** — En tant qu'auteur, je veux ranger chaque artwork officiel dans une famille — personnages, objets, décors, interface —, afin que le style d'un goblin ne déteigne pas sur une prêtresse elfe.
- **US-50** — En tant qu'auteur, je veux marquer « tous » une planche de style non figurative — matières, palette, échantillons de trait —, afin de transmettre la manière sans transmettre un personnage.
- **US-51** — En tant qu'auteur, je veux que l'application choisisse seule les artworks à envoyer selon le sujet demandé, afin que promouvoir reste un geste unique et que je n'aie rien à sélectionner à chaque génération.
- **US-52** — En tant qu'auteur, je veux voir combien de références partent avec ma génération, afin de comprendre ce qui la fait coûter plus ou moins cher.
- **US-53** — En tant qu'auteur, je veux que le style de mon univers parte avec chaque génération, afin de ne jamais le retaper.
- **US-54** — En tant qu'auteur, je veux voir la palette extraite de mes artworks officiels, afin de vérifier ce que la machine y a lu.
- **US-55** — En tant qu'auteur, je veux retirer un artwork officiel et voir la palette se recalculer, afin de corriger une lecture qui ne me convient pas.
- **US-56** — En tant qu'auteur, je veux remplir une bible en champs nommés, chacun activable indépendamment pour une génération, afin de doser ce qui contraint.
- **US-57** — En tant qu'auteur, je veux générer sans bible ni artwork, afin qu'un univers vide ne contraigne simplement rien plutôt que de me bloquer.
- **US-58** — En tant qu'auteur, je veux régler les défauts de mon projet — dont le modèle par type d'asset —, afin que mes générations partent déjà réglées.

### La toile

- **US-98** — En tant qu'auteur, je veux basculer entre la grille et une toile libre, afin d'organiser ma pensée au lieu de seulement tout voir d'un coup d'œil.
- **US-99** — En tant qu'auteur, je veux poser mes cartes où je veux sur un plan que je déplace et que je zoome, afin que la place d'une image finisse par dire quelque chose.
- **US-100** — En tant qu'auteur, je veux que la toile s'ouvre sur mes groupes déjà saisis, matérialisés en îlots, afin de ne pas refaire à la main un rangement que j'ai déjà écrit.
- **US-101** — En tant qu'auteur, je veux que ce qui n'est pas encore classé m'attende dans une réserve à côté, afin d'y piocher au lieu de subir cinquante cartes en vrac.
- **US-102** — En tant qu'auteur, je veux qu'une carte tirée dans un îlot y soit rangée pour de bon, afin que composer soit classer.
- **US-103** — En tant qu'auteur, je veux qu'une carte sortie de son îlot redevienne à classer, afin que ce que je vois et ce qui est écrit ne divergent jamais.
- **US-104** — En tant qu'auteur, je veux poser une carte sur la toile sans la mettre dans aucun îlot, afin d'essayer un rapprochement avant de décider qu'il fait un groupe.
- **US-105** — En tant qu'auteur, je veux agrandir ou réduire une carte sur la toile, afin de donner du poids à ce qui compte.
- **US-106** — En tant qu'auteur, je veux annuler mon dernier geste de composition, afin qu'un glissement raté n'efface pas un rangement.
- **US-107** — En tant qu'auteur, je veux retrouver ma toile exactement comme je l'ai laissée, afin qu'une composition survive à la fermeture de l'écran.
- **US-108** — En tant qu'auteur, je veux tirer un lien d'un objet à un autre, afin de montrer un rapport que la proximité ne dit pas.
- **US-109** — En tant qu'auteur, je veux écrire un mot sur un lien et lui donner une pointe, afin de dire *quel* rapport, quand ça compte.
- **US-110** — En tant qu'auteur, je veux poser une note à même la toile, afin d'écrire une intention là où elle s'applique.
- **US-111** — En tant qu'auteur, je veux donner une couleur à un îlot et à une note, afin de lire ma toile d'un coup d'œil.
- **US-112** — En tant qu'auteur, je veux déplacer un îlot entier avec ce qu'il contient, afin de pousser un groupe composé sans reprendre ses cartes une par une.
- **US-113** — En tant qu'auteur, je veux voir, pendant que je tire une carte, que ce geste va faire disparaître son îlot, afin de ne pas découvrir la perte après l'avoir faite.

### Retoucher

- **US-59** — En tant qu'auteur, je veux recadrer, redimensionner, pixelliser sur grille, ramener sur la palette et nettoyer les bords, avec des réglages qui répondent instantanément.
- **US-60** — En tant qu'auteur, je veux fixer une taille de pixel cible pour mon projet et qu'elle soit imposée à tout ce qui rentre, afin que deux assets du même lot partagent la même grille.
- **US-61** — En tant qu'auteur, je veux que la grille soit ramenée à cette cible systématiquement, y compris quand le modèle a rendu une grille cinq fois plus grosse, afin que la dérive soit traitée comme le cas normal et non comme un incident.
- **US-62** — En tant qu'auteur, je veux que mes petits objets sortent aussi fins que mes personnages, afin de ne pas obtenir un tonneau plus grossier que celui qui le porte.
- **US-63** — En tant qu'auteur, je veux que l'image d'origine soit toujours conservée, afin de revenir en arrière sans jamais repayer.
- **US-64** — En tant qu'auteur, je veux revenir à l'image brute d'un seul geste, afin de repartir proprement quand une retouche part de travers.
- **US-65** — En tant qu'auteur, je veux voir la quantification grisée avec sa raison tant qu'aucune palette n'existe, afin de ne pas essayer une étape qui ne peut pas aboutir.
- **US-66** — En tant qu'auteur, je veux nommer une recette et la réappliquer ailleurs, afin de traiter deux assets exactement pareil.
- **US-67** — En tant qu'auteur, je veux changer la palette de mon projet et voir tous ses assets s'y remettre sans un seul appel payant.
- **US-68** — En tant qu'auteur, je veux que les réglages que j'ai faits à la main sur un asset ne soient jamais écrasés par ce changement, et voir le compte de ce qui a été remis à jour et de ce qui a été conservé tel quel.
- **US-69** — En tant qu'auteur, je veux réaligner d'un geste, depuis sa fiche, un asset que j'avais réglé à la main, afin de le faire rentrer dans le rang quand je le décide.

### Détourer et découper

- **US-70** — En tant qu'auteur, je veux détourer en une ou plusieurs passes, en réglant le seuil et le durcissement du bord, afin d'obtenir un fond propre sans halo.
- **US-71** — En tant qu'auteur, je veux voir immédiatement qu'un détourage a mangé le sujet et le reprendre autrement, afin de ne pas garder une image abîmée.
- **US-72** — En tant qu'auteur, je veux découper une planche multi-sprites par détection automatique, afin qu'une planche de huit devienne huit assets.
- **US-73** — En tant qu'auteur, je veux corriger la découpe à la main — grille fixe ou sélection — quand la détection se trompe, afin de ne jamais être bloqué par une mauvaise détection.
- **US-74** — En tant qu'auteur, je veux que chaque découpe soit un asset dont la filiation pointe vers la planche d'origine, afin de remonter à la source.

### Sortir

- **US-75** — En tant qu'auteur, je veux télécharger une image seule, afin de la poser où je veux.
- **US-76** — En tant qu'auteur, je veux exporter une sélection en une archive accompagnée de son descriptif, afin de transférer un lot d'un coup.
- **US-77** — En tant qu'auteur, je veux que l'export soit grisé avec sa raison quand la sélection est vide, afin de ne pas déclencher une action sans objet.

### L'agent qui code le jeu

- **US-78** — En tant qu'agent, je veux demander un asset et recevoir un chemin de fichier, afin de ne pas avoir à composer un enchaînement d'appels.
- **US-79** — En tant qu'agent, je veux que l'univers du projet s'applique tout seul à ma demande, afin de ne pas répéter le style à chaque fois.
- **US-80** — En tant qu'agent, je veux attendre jusqu'à un délai que je fixe et, passé ce délai, recevoir un identifiant, afin d'obtenir mon image directement la plupart du temps sans avoir à sonder.
- **US-81** — En tant qu'agent, je veux lister les projets, les assets et les modèles, afin de retrouver et réutiliser plutôt que de regénérer.
- **US-82** — En tant qu'agent, je veux importer un fichier local, retoucher un asset existant et exporter une sélection, afin de disposer des mêmes gestes que l'écran.
- **US-83** — En tant qu'agent, je veux écrire directement dans le dossier du jeu, afin que l'asset soit utilisable sans manipulation.
- **US-84** — En tant qu'agent, je veux qu'un dossier manquant soit créé, qu'un fichier de même nom ne soit jamais écrasé, et qu'un dossier non inscriptible me soit refusé avec le chemin fautif, afin de ne jamais détruire du travail par mégarde.
- **US-85** — En tant qu'agent, je veux un refus explicite et actionnable quand j'atteins le plafond de la session — le plafond, et le moyen de le relever —, afin de savoir quoi dire à l'auteur.
- **US-86** — En tant qu'agent, je veux un refus accompagné de la liste des projets existants quand je nomme un projet inconnu, afin de me corriger tout de suite.
- **US-87** — En tant qu'agent, je veux que mes assets aillent dans le projet ouvert dans l'atelier quand je ne nomme aucun projet, afin d'atterrir au bon endroit sans avoir à demander.
- **US-88** — En tant qu'auteur, je veux ne jamais être interrompu par une demande d'autorisation, afin que l'agent ne se fige pas quand je ne regarde pas l'écran.
- **US-89** — En tant qu'auteur, je veux voir apparaître en direct dans ma grille ce que l'agent produit, marqué de sa provenance, afin de garder l'œil dessus sans le surveiller.
- **US-90** — En tant qu'auteur, je veux un compteur discret de ce que l'agent consomme, afin de savoir quand relever le plafond.
- **US-91** — En tant qu'auteur, je veux relever ou désactiver le plafond, et changer ou lever le modèle imposé à l'agent, sans rien redémarrer, afin de changer d'avis en cours de séance.

### Quand le fournisseur n'est pas là

- **US-92** — En tant qu'auteur, je veux continuer à travailler sur ce qui est déjà sur mon disque quand le fournisseur est en panne, afin qu'une panne qui ne me concerne pas ne m'arrête pas.
- **US-93** — En tant qu'auteur, je veux voir le catalogue daté en clair quand il n'a pas pu être rafraîchi, afin de savoir que je travaille sur une photo d'hier.
- **US-94** — En tant qu'auteur, je veux préparer un prompt hors ligne et le lancer au retour du réseau, afin de ne pas perdre le fil.
- **US-95** — En tant qu'auteur, je veux que l'échec survienne au moment où j'essaie de générer et non au démarrage, afin de ne jamais être accueilli par une erreur.

### Régler

- **US-96** — En tant qu'auteur, je veux régler la clé du fournisseur, les garde-fous de l'agent et mes dossiers, afin de tout tenir depuis un seul endroit.
- **US-97** — En tant qu'auteur, je veux voir les trois panneaux et la grille ensemble sur mon écran large, et replier un panneau quand je veux voir la grille en grand, afin de ne jamais subir un repli imposé par la place.

### Le personnage et son plan

- **US-115** — En tant qu'auteur, je veux créer un personnage dans mon projet et le décrire une fois, afin de fabriquer toutes ses images sans réécrire son signalement à chaque prompt.
- **US-116** — En tant qu'auteur, je veux que mon projet porte une liste de poses, chacune avec un nom et un nombre d'images, afin que tous mes personnages se comparent sur le même plan.
- **US-117** — En tant qu'auteur, je veux dire pour chaque personnage lesquelles de ces poses il tient, afin qu'un figurant ne réclame pas les mêmes images qu'un héros.
- **US-118** — En tant qu'auteur, je veux ajouter, renommer et retirer une pose du plan de mon projet à tout moment, afin que le plan suive le jeu au lieu de le précéder.
- **US-119** — En tant qu'auteur, je veux voir d'un coup d'œil, pour un personnage, ce qui est fait et ce qui ne l'est pas, afin de savoir quoi lancer sans tenir la liste dans ma tête.
- **US-120** — En tant qu'auteur, je veux générer une pose seule, afin de juger un personnage avant d'engager un lot entier sur lui.
- **US-121** — En tant qu'auteur, je veux voir avant de lancer ce qui va partir en référence et ce que ça va coûter, afin de décider en connaissance de cause.
- **US-122** — En tant qu'auteur, je veux que le corps d'un personnage naisse dans l'atelier et jamais d'une planche venue d'ailleurs, afin que tout ce qui s'empile ensuite repose sur une image dont je connais la grille et la palette.
- **US-123** — En tant qu'auteur, je veux voir sur chaque asset le modèle qui l'a produit, afin de savoir à qui redemander quand un résultat me plaît, et de qui me méfier quand il me déçoit.
- **US-124** — En tant qu'auteur, je veux qu'un personnage ou une pièce désigne des cartes de mon tableau comme concept art, afin de repartir de mes références au lieu de les redécrire en prose.
- **US-125** — En tant qu'auteur, je veux qu'une carte désignée se voie sur la toile, afin de savoir ce qui sert et ce qui dort.
- **US-126** — En tant qu'auteur, je veux décocher une référence pour cette génération, pour ce personnage ou pour tout le projet, afin de couper une contamination sans démonter mon univers.
- **US-127** — En tant qu'auteur, je veux voir d'où vient chaque référence envoyée, afin de comprendre pourquoi elle part avant de décider de la retirer.

### Le lot

- **US-128** — En tant qu'auteur, je veux sélectionner plusieurs poses et les obtenir d'une seule génération, afin de payer un appel au lieu de N.
- **US-129** — En tant qu'auteur, je veux choisir la taille de mon lot à chaque génération et voir ce qu'un compte faux me coûterait, afin d'arbitrer moi-même entre le coût et le risque de tout rater d'un coup.
- **US-130** — En tant qu'auteur, je veux que la planche reçue soit dépliée toute seule en autant d'images de corps qu'il y avait de cases, afin de n'avoir jamais à découper à la main ce que j'ai demandé plié.
- **US-131** — En tant qu'auteur, je veux qu'un lot dont le compte d'images ne tombe pas juste soit refusé et relançable, afin qu'une planche incomplète n'entre jamais silencieusement dans mon plan.
- **US-132** — En tant qu'auteur, je veux reprendre un lot interrompu sans repayer ce qui est déjà arrivé, afin qu'une coupure ne me coûte que ce qu'elle a coûté.
- **US-133** — En tant qu'auteur, je veux régénérer une pose seule à l'intérieur d'un lot déjà reçu, afin de rattraper une case ratée sans refaire la planche entière.
- **US-134** — En tant qu'auteur, je veux enregistrer sous un nom ce qui part en référence et les réglages d'une génération, afin de rejouer la même recette sur un autre personnage sans la reconstituer.
- **US-135** — En tant qu'auteur, je veux être prévenu quand deux poses d'un même lot se ressemblent trop, sans que le lot soit refusé pour autant, afin de relancer la case qui n'apporte rien plutôt que de la découvrir au montage.

### La pièce et le calque

- **US-136** — En tant qu'auteur, je veux définir sur mon projet des emplacements ordonnés — la tête, le dos, les jambes —, afin que mes pièces se posent au même endroit d'un personnage à l'autre.
- **US-137** — En tant qu'auteur, je veux décrire une pièce d'équipement une seule fois sur mon projet, afin de la poser sur n'importe lequel de mes personnages sans la redécrire.
- **US-138** — En tant qu'auteur, je veux qu'écrire le nom d'une pièce ou d'un emplacement qui n'existe pas le crée, afin que ranger ne soit jamais un préalable.
- **US-139** — En tant qu'auteur, je veux déclarer si une pièce tient dans la silhouette du personnage ou si elle l'agrandit, afin que l'atelier sache d'avance s'il peut m'en faire un calque ou non.
- **US-140** — En tant qu'auteur, je veux poser une pièce sur plusieurs poses d'un personnage d'un seul appel payant et obtenir un calque par pose, afin d'habiller tout un plan sans le payer case par case.
- **US-141** — En tant qu'auteur, je veux ne pouvoir faire partir dans une planche d'équipement que des poses qui ont déjà un corps, les autres étant visiblement inéligibles avec leur raison, afin de ne jamais payer pour habiller une case vide.
- **US-142** — En tant qu'auteur, je veux que la planche revenue soit redécoupée sur la grille exacte que l'atelier a posée et comparée case par case à ce qu'il avait envoyé, afin que chaque calque sorte d'une base connue et non devinée.
- **US-143** — En tant qu'auteur, je veux voir le calque superposé au corps de sa pose, afin de juger un résultat à l'œil au lieu de juger un chiffre.
- **US-144** — En tant qu'auteur, je veux borner un calque à une zone, afin qu'un visage repeint au passage ne parte pas avec la pièce.
- **US-145** — En tant qu'auteur, je veux déplacer et retailler cette zone après coup sans repayer, afin qu'une erreur de cadrage me coûte un glissement de souris et rien d'autre.
- **US-146** — En tant qu'auteur, je veux que le calque soit rangé à côté de l'image payée et jamais écrit dedans, afin de pouvoir revenir en arrière autant de fois qu'il le faut.
- **US-147** — En tant qu'auteur, je veux lire ce qui a bougé — la silhouette retrouvée, le corps repeint, ce qui a été ajouté, l'échelle au retour, et si c'est un objet ou une poussière — sans qu'aucune de ces mesures ne refuse à ma place, afin de garder le jugement.
- **US-148** — En tant qu'auteur, je veux qu'une pièce qui agrandit la silhouette et revient à une autre échelle que celle envoyée me le dise au lieu de me rendre un calque faux, et que ce qui revient soit gardé comme des corps habillés, afin de ne pas perdre l'appel que j'ai payé.

### La main

- **US-149** — En tant qu'auteur, je veux affiner une zone à main levée puis au pixel, afin de rattraper ce qu'un rectangle ne sait pas dire.
- **US-150** — En tant qu'auteur, je veux retoucher un calque au pixel avec le corps visible en repère dessous, afin de corriger sans perdre l'alignement.
- **US-151** — En tant qu'auteur, je veux comparer l'avant et l'après d'un seul geste, afin de voir ce que ma retouche a réellement changé.
- **US-152** — En tant qu'auteur, je veux trier ce qui me reste à regarder en commençant par le pire, afin d'attaquer par ce qui va me poser problème.
- **US-153** — En tant qu'auteur, je veux que la zone et la retouche au pixel soient deux couches séparées et rejouables, afin qu'aucune des deux ne détruise l'autre.

### Sortir un personnage

- **US-154** — En tant qu'auteur, je veux exporter un personnage complet — ses poses et ses calques — dans le dossier de mon jeu, afin qu'il soit utilisable sans manipulation.
- **US-155** — En tant qu'auteur, je veux qu'un descriptif accompagne l'export et dise ce qu'est chaque fichier, afin que l'agent sache quoi en faire sans que j'aie à le lui raconter.
- **US-156** — En tant qu'agent, je veux disposer sur les personnages et les calques exactement des mêmes gestes que l'écran, afin de compléter un plan sans que l'auteur ouvre l'atelier.
- **US-157** — En tant qu'agent, je veux écrire moi-même les lignes de catalogue de mon jeu à partir du descriptif, afin que l'atelier décrive ce qu'il produit sans avoir à connaître la structure de mon jeu.

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

## Décisions d'implémentation

**Ce qui entre en bibliothèque.** Tout ce qui est produit y entre de lui-même, rangé dans le projet courant. Juger, c'est marquer favori ou supprimer — jamais accepter. Ce qui est jugé l'est avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque.

**L'échec.** Il s'affiche à l'emplacement qui attendait l'image, avec sa raison en clair et un bouton relancer qui rejoue le même prompt. Sur un lot, chaque emplacement est indépendant : les réussites arrivent, les ratés se relancent un par un. Aucun échec n'entre dans la grille. L'appel raté et son coût réel restent lisibles dans le journal du projet.

**Le premier lancement.** L'application ouvre l'Atelier, prompt actif, sur un projet « Bac à sable » préexistant. Aucun projet, aucune bible, aucun artwork n'est exigé : un univers non renseigné ne contraint simplement rien, et les défauts du produit prennent le relais. Seule la clé du fournisseur est un préalable dur, matérialisé par un bouton générer inactif portant sa raison et le lien vers son réglage.

**La suppression.** Jamais de cascade. Les enfants survivent au parent et affichent « parent supprimé ». Supprimer un projet demande confirmation avec le nombre d'assets concernés, et ces assets sont détachés, pas détruits. Annulation courte après chaque suppression, puis c'est définitif.

**Les artworks officiels sont groupés par famille.** Une carte porte une famille en plus de son groupe : personnages, objets, décors, interface, ou « tous » pour une planche de style non figurative. À la génération, seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». C'est l'application qui choisit, pas l'auteur : promouvoir reste un geste unique. Le nombre de références effectivement envoyées est visible au moment de générer.

**La taille de pixel est une propriété du projet, imposée à tout ce qui rentre.** Elle n'est jamais déduite de l'image reçue. La remise sur grille est systématique et non optionnelle : un asset dont la grille a dérivé est le cas normal, pas l'incident.

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

## Notes complémentaires

- **La maquette de l'écran Atelier est à refaire.** Le brouillon existant a été jugé trop chargé et trop loin de la fluidité recherchée. Il reste sur disque mais ne sert pas de base : l'interface doit partir du geste quotidien — écrire, générer, juger, garder — et non de la liste des décisions ci-dessus. Un réglage n'est à l'écran que si on y touche à chaque génération.
- **La recette d'animation reste le risque ouvert.** Une piste sérieuse a été observée le 26 août 2026 mais demande un prototypage avant tout engagement. Rien dans ce document ne doit la présupposer.
- **Le coût d'une génération croît avec le nombre de références chez certains fournisseurs et pas chez d'autres.** Le regroupement par famille limite l'envoi, mais un univers riche renchérit quand même, et peut inverser le classement des modèles par coût. À surveiller dès les premières séances réelles.
- **Les familles d'artworks sont pressenties, pas figées** : personnages, objets, décors, interface, tous. Une famille manquante se découvrira à l'usage.
- **Deux documents sont à corriger dans la foulée de celui-ci.** `AGENTS.md` et `docs/ARCHITECTURE.md` §1 portent encore « jugée avant d'entrer dans la bibliothèque » ; ce PRD tranche l'inverse et fait foi sur l'usage.
- **Le nom « la toile » n'est pas figé.** Le produit nomme tout en français — l'Atelier, le tableau, la réserve, la fiche, le barème — et « la toile » a été retenu faute de mieux à la séance de cadrage du 27 août 2026. « Plan de travail » ou « établi » diraient autre chose. Le jour où l'un des deux s'impose, il se change partout d'un coup, ce document compris.
- **Dépendance externe unique** : un fournisseur d'images en ligne et sa clé. Tout le reste — retouche, détourage, découpe, rangement, export — tourne sur la machine, sans réseau.
- **Le risque de la V2 a changé de place le 28 août 2026.** Ce document a porté un temps « le report d'un calque sur une autre pose n'a jamais été essayé » comme risque principal. C'en était un faux : un casque vu de face n'est pas un casque vu de dos, un calque est solidaire de sa pose, et c'était une évidence de dessin qu'il ne fallait pas promettre. Ce qui reste réellement non mesuré, c'est **la toile avec marge** : l'idée que donner de la place au modèle l'empêche de dézoomer sur une pièce qui agrandit la silhouette est une hypothèse, pas un résultat. Elle se teste en un appel payant, et ce test appartient à C3. Si elle ne tient pas, la pièce qui agrandit se rabat sur le corps habillé — ce que le produit sait déjà faire — et rien d'autre ne bouge.
- **Le bon modèle pour une planche n'est pas forcément le bon pour une édition** : mesuré le 28 août 2026, un modèle recopie fidèlement les traits du gabarit qu'on lui donne en repère de découpe et rend la planche tramée, un autre l'ignore comme demandé. Passé en décision d'implémentation ci-dessus.
- **La conclusion imprimée par l'essai du 28 août était trompeuse, et a été corrigée.** Elle annonçait que « les six modèles tiennent les deux seuils » alors que la cape échouait sur les six, aux deux jets : le verdict prenait une médiane sur les trois pièces d'un modèle, et la cape n'en ratait que deux. **Une médiane sur trois pièces efface la seule qui rate** — et c'est la seule qui décide de ce que le produit promet. L'essai juge désormais pièce par pièce, et l'échelle au retour y est devenue une colonne qui décide.
- **Les planches existantes de Cœur de Pierre ne servent plus que de référence de pose.** Le nain est refait dans l'atelier, conformément à la règle que le corps y naît et nulle part ailleurs. Les planches actuelles ne sont ni importées, ni découpées, ni rattachées à un personnage : on les regarde pour savoir quelles poses le jeu réclame, rien de plus.
- **Le classement des modèles par coût est contre-intuitif et doit rester mesuré, jamais supposé.** L'essai a mesuré un écart de 1 à 4,6 entre le plus cher et le moins cher des six candidats, et le favori pressenti s'est révélé être le plus cher. C'est exactement ce que la décision « le coût réel facturé fait foi » protège. Le pliage des poses, lui, divise le prix par quatre sur la même planche.
- **Les mesures de ressemblance restent grossières.** Celle qui compare deux poses d'un même personnage travaille sur une empreinte de couleurs, pas sur une reconnaissance de forme : elle repère un personnage devenu franchement autre, elle ne repère pas un détail de costume qui a changé. C'est assumé — elle informe, elle ne refuse pas — mais il ne faut pas lui faire dire plus qu'elle ne dit.
- **Le modèle est déjà enregistré, il n'est simplement pas montré.** Chaque génération conserve le modèle qui l'a produite depuis la V1 ; ce qui manque, c'est le report sur l'asset et l'affichage sur sa fiche. La demande est donc de rendre visible, pas d'enregistrer.
- **La V2 est passée de six tranches à cinq.** Les références d'un personnage rejoignent C1, parce qu'une génération de pose annonce déjà ce qui part et ce que ça coûte ; la pièce et le calque remontent en C3, la main en C4, la sortie en C5. Le masque rectangle reste délibérément en C3 et non en C4 : sans lui la différence emporte le visage, et C3 ne serait pas utilisable à sa livraison. C4 apporte la finesse, pas la fonction. La renumérotation des user stories — US-115 à US-157 — suit cet ordre.
