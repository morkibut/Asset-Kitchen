# Asset Kitchen — les décisions d'implémentation

> Sorti de `docs/PRD.md` le 31 août 2026, quand le corpus de démarrage a atteint
> 301 Ko et que cette section pesait 55 % de son document. **Rien n'a été
> réécrit** : le texte est celui du PRD, mot pour mot, et c'est toujours le PRD
> qui fait foi sur ce qu'il dit — cette annexe est l'endroit où il le dit.
>
> On l'ouvre quand on veut savoir **ce que le produit a tranché** sur une
> question d'usage : ce qui entre en bibliothèque, ce qui se juge, ce qui coûte,
> ce qui est refusé et pourquoi. `docs/PRD.md` garde la question, la solution,
> l'utilisateur et les critères de succès ; il renvoie ici pour les décisions.

## Décisions d'implémentation

**Ce qui entre en bibliothèque.** Tout ce qui est produit y entre de lui-même, rangé dans le projet courant. Juger, c'est marquer favori ou supprimer — jamais accepter. Ce qui est jugé l'est avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque.

**L'échec.** Il s'affiche à l'emplacement qui attendait l'image, avec sa raison en clair et un bouton relancer qui rejoue le même prompt. Sur un lot, chaque emplacement est indépendant : les réussites arrivent, les ratés se relancent un par un. Aucun échec n'entre dans la grille. L'appel raté et son coût réel restent lisibles **dans l'écran des dépenses**, avec tous les autres.

**Le premier lancement.** L'application ouvre l'assistant, étape 1, sur le jeu « Bac à sable » qui existe déjà — l'assistant ne le crée pas, il le renomme. Aucun projet, aucune bible, aucun artwork n'est exigé : un univers non renseigné ne contraint simplement rien, et les défauts du produit prennent le relais. Seule la clé du fournisseur est un préalable dur, matérialisé par un bouton générer inactif portant sa raison et le lien vers son réglage. *Révisé par la V2.2 : **il n'y a plus de préalable dur du tout**. Un fournisseur ne demande ni compte ni clé (F1), et sur une machine où rien n'a été déposé une image arrive. Ce qui reste vrai est la forme du refus — un bouton éteint qui porte sa raison et le chemin vers son réglage —, et elle ne concerne plus que les modèles du fournisseur à qui il manque quelque chose.*

**La suppression.** Jamais de cascade. Les enfants survivent au parent et affichent « parent supprimé ». Supprimer un projet demande confirmation avec le nombre d'assets concernés, et ces assets sont détachés, pas détruits. Annulation courte après chaque suppression, puis c'est définitif.

**Les artworks officiels sont groupés par famille.** Une carte porte une famille en plus de son groupe : personnages, objets, décors, interface, ou « tous » pour une planche de style non figurative. À la génération, seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». C'est l'application qui choisit, pas l'auteur : promouvoir reste un geste unique. Le nombre de références effectivement envoyées est visible au moment de générer.

**La taille de pixel est une propriété du projet, imposée à tout ce qui rentre.** Elle n'est jamais déduite de l'image reçue. La remise sur grille est systématique **tant qu'une cible est posée** : un asset dont la grille a dérivé est le cas normal, pas l'incident. La seule échappatoire est « aucune » (US-163), qui est une valeur déclarée par l'auteur — un jeu qui n'est pas en pixel art — et non un réglage éteint ; elle ne rouvre rien, puisque dès qu'une cible est posée la remise reste sans condition.

**La palette rétroactive.** Toucher une recette à la main épingle l'asset. Un changement de palette du projet saute les épinglés et rend son compte : « 12 assets remis à jour, 3 conservés tels quels ». Un épinglé se réaligne d'un geste depuis sa fiche.

**Ce qui est indisponible est grisé avec sa raison**, jamais proposé puis refusé. Cela vaut pour un modèle qui ne peut pas honorer la demande, pour la quantification tant qu'aucune palette n'existe, pour l'export d'une sélection vide, et pour le bouton générer sans clé. Un modèle déjà choisi qui devient invalide reste choisi : aucune substitution silencieuse.

**La génération vit côté serveur.** Elle survit à la fermeture de l'onglet et au changement d'écran ; son résultat entre en bibliothèque quoi qu'il arrive. À la réouverture, ce qui tourne encore est réaffiché avec son avancement. Une génération coupée par un redémarrage est marquée interrompue, garde son coût, et se relance d'un geste — jamais toute seule.

**Le fournisseur absent.** Le dernier catalogue reçu sert de repli, daté en clair à l'écran. Tout ce qui ne demande pas le réseau fonctionne normalement. La génération échoue au moment où on l'essaie, pas au démarrage.

**Ce qui entre par la main.** Le collage devine et le dit : une image devient une carte image, une adresse crée immédiatement une carte en attente dont l'image arrive ensuite — et qui garde son adresse et sa raison si elle n'arrive pas —, un texte devient une carte texte. Un fichier qui n'est pas une image est refusé nommément. Un doublon est signalé avec un lien vers l'existant, et reste importable.

**L'agent ne bloque jamais l'auteur, et l'auteur ne bloque jamais l'agent.** Aucune invite d'autorisation : au plafond, l'agent reçoit un refus qui nomme le plafond et le moyen de le relever. Un projet inconnu est refusé avec la liste des projets existants ; sans projet nommé, c'est le projet ouvert dans l'atelier qui reçoit. Côté disque, un dossier manquant est créé, un fichier existant n'est jamais écrasé, un dossier non inscriptible est un refus qui donne le chemin. Côté atelier, un compteur discret montre la consommation de l'agent et ses assets apparaissent en direct dans la grille, marqués de leur provenance. Les garde-fous sont relus à chaque appel : les changer ne demande aucun redémarrage.

**Une seule grille d'assets dans tout le produit** — mêmes filtres, même recherche, même sélection multiple. Elle vit dans la galerie. La matrice d'une chose du jeu n'en est pas une, la réserve du tableau d'inspiration non plus, la liste des dépenses non plus. *Ce qui tient la règle diffère d'une surface à l'autre, et cette phrase le disait d'un seul bloc jusqu'au 31 août 2026, où la construire l'a corrigée.* **La matrice et la réserve** sont pleines d'images, et c'est leur privation de recherche, de filtre et de sélection multiple qui les tient. **La liste des dépenses**, elle, ne porte aucune image : une vignette par ligne en aurait fait une seconde planche contact, et c'est **cette** privation-là qui la tient, avec l'absence de sélection multiple. Ses filtres portent sur des appels — ce que ça a donné, quel jeu, quelle semaine, qui l'a demandé — et sa recherche cherche le nom d'une chose du jeu, jamais le texte envoyé. Voir `docs/v21-arbitrages.md` A-24.

**La fiche d'une image est un panneau latéral**, jamais une page : la fermer remet exactement où l'on était. Elle dit ce qu'une image *est* — ses mesures, son coût, son modèle, à qui elle appartient, ce que le projet lui a imposé, d'où elle vient — et elle ne règle rien. Elle porte deux portes : l'établi de la chose à qui elle appartient, et les tables où on la retouche. Une image qui n'appartient à personne n'a que la seconde, et la première devient le geste qui la rattache. **La fiche d'une chose du jeu est un écran plein cadre** — ce sont deux objets différents, et il ne faut pas les confondre.

**Écran large uniquement.** Les trois panneaux et la grille cohabitent d'emblée. Les panneaux se replient par choix, pour voir la grille en grand, jamais par contrainte de place.

**La retouche est non destructive.** L'image d'origine est conservée, les retouches sont une recette rejouable, annulable, nommable. Revenir à l'image brute est un geste unique.

**Le modèle est un défaut par type d'asset**, porté par l'univers du projet, pas un réglage global.

**Ce que chaque génération a réellement consommé est enregistré** — ce que la réponse du fournisseur déclare, jamais ce que son catalogue affiche — **dans l'unité de ce fournisseur-là**. Des dollars quand c'en est, un jeton quand c'en est un. *Révisé par la V2.2 : l'unité a changé, la règle n'a pas changé.* L'argent, lui, reste totalisé par projet, et **un total en argent ne compte que de l'argent** : ce qui se consomme sans argent se lit à côté, jamais dedans. Un appel sans prix dit **gratuit**, jamais « 0,00 $ » — qui se lirait *sans limite* là où il faut lire *sans prix*.

**Les dimensions mesurées font foi**, jamais celles demandées.

**Le corps naît dans l'atelier, et nulle part ailleurs.** Il n'y a pas d'écran de création de personnage avec son propre prompt : on écrit un sujet, on génère, on obtient une image, et c'est cette image qu'on désigne comme le corps d'un personnage. L'unité manipulée reste l'image de corps — un personnage n'est pas un objet mystérieux, c'est un nom, une description, et un plan de cases dont chacune attend ou contient une image de corps.

**Le personnage appartient au projet.** Il porte un nom, une description, et le plan de poses qu'on lui a rattaché. Il vit dans la bibliothèque du projet comme tout le reste, et sa suppression suit la règle générale : jamais de cascade, les images survivent et affichent « personnage supprimé ».

**La liste des poses appartient au type d'objet, et une chose du jeu peut y ajouter les siennes.** *Révisé le 31 août 2026 — elle appartenait au projet entier, si bien qu'un coffre héritait d'une pose de course qu'il fallait ranger sur chaque coffre.* Chaque type d'objet porte donc sa liste, remplie à l'étape des poses de l'assistant : un personnage a repos, marche, course, attaque, dégâts, mort ; un coffre a fermé, ouvert, vidé ; une tuile n'en a aucune. Un boss garde les six poses de son type et en ajoute une à lui seul, sans que les autres personnages voient paraître une case vide qui ne les concerne pas — et sa fiche écrit l'origine de chaque pose, *du type* ou *ajoutée ici*, pour qu'on sache toujours ce qui bougerait en changeant le type.

**On range ce qu'on ne tient pas, on ne coche pas ce qu'on tient.** Ajouter une pose à un type doit faire paraître une case vide chez tous les objets de ce type **sans écrire un seul fichier** : avec des listes de ce qu'on tient, il faudrait réécrire chaque chose du jeu à chaque ajout — un balayage capable de réussir à moitié, pour un geste qui ne devrait rien écrire du tout. La même mécanique vaut pour les trois listes que le jeu impose : les poses, les directions et les pièces d'équipement. Ajouter et ranger ne sont pas symétriques, et c'est voulu : on range ce que le type impose et qu'on ne veut pas, on ajoute ce que le type ignore et qu'on est seul à vouloir.

**La taille d'un lot est le choix de l'auteur, jamais celui du produit.** Il coche les poses qu'il veut voir partir ensemble, de deux à autant qu'il ose. Le produit annonce ce que ça coûte, et ce qu'un compte faux coûterait — le lot entier refusé et relancé au prix plein. Il n'annonce pas de probabilité : il ne mesure rien sur le modèle choisi, et une statistique qu'il n'a pas faite ne vaut pas mieux qu'un pressentiment. Il ne plafonne pas. Une pose reste toujours régénérable seule, dans ou hors d'un lot.

**Un lot est tout ou rien sur le compte, indépendant sur le reste.** Si le compte d'images revenues ne correspond pas au compte demandé, rien n'entre et le lot se relance d'un geste. Si le compte est bon, les images entrent toutes, et chaque pose devient jugeable et régénérable individuellement. Aucune autre mesure ne peut refuser un lot.

**Les mesures d'un lot et d'un calque sont indicatives et toutes visibles.** Elles disent ce qui s'est passé — ressemblance entre poses, dérive de la grille de pixels, part de l'image touchée, netteté du découpage, remplissage de la boîte — et n'empêchent jamais de garder. Le seul refus automatique du produit est un compte d'images **insuffisant**. *Révisé le 3 septembre 2026 (R6) :* une planche qui rend **plus** de sujets que demandé ne se jette plus, et une planche dont les « sujets » remplissent presque toute leur boîte — le quadrillage que le modèle a redessiné — ne s'accepte plus en silence. Les deux s'arrêtent et demandent un regard ; ni l'une ni l'autre n'est refusée, et l'appel payé ne se rejoue pas. Une mesure peut donc désormais **arrêter** une planche pour poser une question — jamais la refuser, ce qui reste la ligne.

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

*Amendé le 31 août 2026, sur un report de la maquette de l'univers qui n'avait jamais été appliqué ici.* « La bible active » n'est plus la bible entière dans tous les cas, et deux choses la découpent. **Sur une reprise, seules les cinq cases de la matière partent** — le monde, l'époque, le rendu, le trait, l'éclairage. Les deux du cadre — la vue et la technique — restent au vestiaire : l'image qu'on reprend les porte déjà, et les redemander est une redite qui se paie au caractère. **Et trois de ces cinq peuvent venir d'une ambiance** plutôt que du jeu, quand la chose fabriquée en désigne une : le monde, l'éclairage, le trait. L'ordre d'assemblage ne bouge pas, et l'écran de confirmation montre le résultat ligne par ligne, avec l'origine de chacune.

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

**Cet écran avertit, il ne refuse pas.** Un texte qui contredit un réglage, aucune image jointe, tous les textes de style éteints : chacun s'écrit sur la ligne fautive, avec des chiffres et jamais un conseil. Ce que le modèle choisi ne sait pas faire est grisé avec sa raison et le compte — *quatorze places, seize cochées*. *Révisé par la V2.2 (F6) : un modèle qui n'accepte **aucune** image ne grise plus l'appel — ce que le jeu ajoute de lui-même cède, l'appel part sur le texte seul, et l'écran l'écrit avant de partir : « ce modèle n'accepte aucune image · l'appel partira sans elle, sur le texte seul ». Ce que l'auteur a joint, lui, refuse toujours.* Le seul refus automatique du produit reste un compte d'images insuffisant, et il ne se joue pas là : il se joue au retour.

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

**Le premier lancement ouvre l'assistant, et on en sort quand on veut.** Dix étapes en quatre groupes — le jeu, le style, la production, l'atelier —, la dixième étant la clé du fournisseur, seule dans son groupe parce qu'elle vaut pour tous les jeux. *Révisé par la V2.2 (F3) : la dixième étape est **les fournisseurs**, au pluriel — une place par fournisseur, chacun disant ce qu'il demande, et celui qui ne demande rien le disant aussi. Elle reste seule dans son groupe pour la même raison, et elle reste une fenêtre sur le tiroir des réglages, jamais un second tiroir.* On sort à n'importe quelle étape et l'on tombe dans le codex, vide, le champ qui nomme au milieu de l'écran. Une étape passée reste passée sans rien bloquer ni se redemander. **Rien n'est jamais grisé dans l'assistant** : un changement qui casse du travail déjà payé affiche les vrais chiffres — *48 images ont été découpées en 128 pixels, les refabriquer coûte environ 0,61 $* — puis laisse décider. Le seul élément grisé est un bouton pour une chose qui n'existe pas encore.

**L'assistant est l'écran des réglages, et il n'y en a pas d'autre.** Un seul écran, deux humeurs : la première fois on enchaîne dans l'ordre, ensuite on clique l'étape à changer et la colonne devient le récapitulatif du jeu. Les aides, les vignettes et les exemples ne disparaissent jamais. Une étape qui ne montre pas ce qu'elle décide n'est pas une étape : la vue et la taille se choisissent sur des vignettes, avec le même sujet dessiné dans chacune.

**Une description se compose en cliquant plutôt qu'en rédigeant.** Une étiquette est une paire — un libellé qu'on clique, et le texte anglais qui part vraiment. La base est **vide au départ**, appartient à l'atelier entier et non à un jeu, et grandit de chaque étiquette fabriquée dans n'importe quel projet. Au premier projet, l'étape de l'allure est donc sept champs de texte libre, et elle le dit franchement plutôt que de faire semblant.

**Rien n'oblige à partir de rien.** L'étape des références fabrique un texte tout prêt à copier dans un outil d'images grand public, assemblé à partir des étapes précédentes, qui demande un premier aperçu du jeu et trois variantes. Rien n'est payé par l'atelier, et c'est la première fois qu'on voit sa description assemblée — beaucoup de contradictions se remarquent là.

**La barre d'espace montre n'importe quelle vignette en grand, partout.** On survole une petite image, on appuie, elle s'affiche en grand ; la molette la zoome. Le geste vaut sans exception — la fiche d'une chose, le codex, l'écran de confirmation, une planche —, et c'est lui qui permet de garder les vignettes petites au lieu d'ajouter une taille à la liste fermée du produit.

**Le guide fait le tour des quatre lieux, et il doit une ligne à chaque écran.** Un manque d'explication est un fait sur le guide, et il se range dans le guide : sa liste des manques cesse d'être tenue à la main et devient **une dette que chaque écran paie au moment où il est construit**. Un réglage sans explication ne casse rien — il n'a simplement pas de trait sous son nom, et l'auteur voit qu'il n'y a rien à survoler.

### Les décisions des cinq capacités que l'usage a réclamées — 1<sup>er</sup> septembre 2026

Elles viennent de **deux séances de l'auteur sur l'interface refaite**, le même soir, et non
d'un chantier de maquettes. Les treize reprises qu'elles ont ouvertes vivent dans
`docs/PLAN.md` ; huit corrigent un écran déjà cadré, et **cinq demandent au produit quelque
chose qu'il n'avait jamais promis** — celles-ci. Quatre points ont été posés à l'auteur et
tranchés avant d'écrire ; ils sont signalés là où ils tombent.

**Éteindre n'est pas vider, et la veille s'arrête à la place.** Une place de la recette
s'éteint depuis la barre des tables, sans qu'on l'ouvre : elle garde tous ses réglages et
cesse d'agir. C'est l'exact contraire de *Sans cette table ›*, qui existe déjà au pied de
chaque colonne et qui, lui, vide la place — **éteinte** et **vide** sont deux états et se
distinguent à l'œil, sans quoi on croirait n'avoir rien réglé quand on n'a fait qu'éteindre.
Une table éteinte le dit quand on l'ouvre, et toucher l'un de ses réglages la rallume **en
l'annonçant** : rien ne se règle en silence sur une place qui n'agit pas. La veille descend
d'un cran jusqu'à la **passe** de détourage, parce qu'une recette en enchaîne plusieurs et
qu'on ne voit que leur somme ; elle ne descend pas plus bas — un curseur éteint fabriquerait
un second zéro à côté du sien, et personne ne saurait lequel des deux agit. Les deux
fabriques, elles, n'ont rien à éteindre : elles ne posent rien sur l'image ouverte.

**La veille est un réglage, pas un état d'écran — et le prix est nommé.** Elle entre dans la
recette, donc elle refait le rendu, elle voyage avec le reste, et l'agent la lit et la pose
comme n'importe quel autre réglage. Ce que ça coûte est écrit d'avance : un champ de plus dans
la recette, donc dans ce qui décide qu'un rendu est à refaire, et dans les outils de l'agent.
Ce qu'elle promet en échange : une image traitée avec une place en veille sort **identique au
pixel près** à la même sans cette place du tout. Endormie veut dire sans effet, pas presque
sans effet.

**Deux gestes de voyage, deux durées de vie, et les deux existent.** *Copier les réglages*
puis *coller* sur une autre image sert la séance en cours — rien à nommer, rien à ranger,
c'est le geste des cinq attitudes qui suivent la première, et il meurt avec l'atelier. La
**recette nommée** sert ce qui doit survivre à la séance : on l'enregistre depuis la barre des
tables, on la retrouve au même endroit, on l'applique, on l'oublie. Un nom déjà pris propose
de remplacer et ne remplace jamais en silence. Il n'y a pas de troisième geste : un traitement
qui suivrait tout seul les images d'une chose du jeu déciderait de l'apparence sans le dire,
et la palette du projet fait déjà cela pour ce qui la concerne.

**Un réglage voyage, une coordonnée ne voyage pas.** *Tranché par l'auteur le
1<sup>er</sup> septembre 2026.* Ce qui désigne un endroit de **cette** image-là ne veut rien
dire sur une autre : le cadre de recadrage tracé à la main, le point de la pipette, la forme
entourée de la sélection magique, les passages de la main et ses calques de dessin, le
décalage du calibrage, la différence d'un calque. Ils ne partent ni par un collage ni par une
recette nommée, et la place qui en dépendait **arrive sans effet et le dit** — un collage
annonce toujours ce qu'il a posé et ce qu'il n'a pas pu poser. La raison tient en une image :
six attitudes d'un même personnage n'ont pas la même silhouette, et un passage recopié
tomberait à côté. **Le prix est réel et il se paie une fois** : une recette nommée emporte la
main aujourd'hui, elle cessera de l'emporter — les recettes déjà écrites perdent donc leurs
passages en étant rappelées. Ce qui ne bouge pas : ce qui a voyagé se rejoue à l'identique.

**Une recette nommée appartient à l'atelier, pas à un jeu.** Comme la base d'étiquettes et
comme la clé du fournisseur, elle ne dépend d'aucun projet : un traitement n'est pas un
univers, et le nettoyage mis au point sur une chevelure ici sert sur le décor d'un autre jeu.
Conséquence à connaître : une recette qui nomme des couleurs les emporte **telles quelles** —
c'est une recette, pas un lien vers la palette d'un jeu —, si bien que la rappeler ailleurs
n'importe pas la palette d'à côté, elle repose les couleurs sous lesquelles on l'avait
enregistrée.

**Le texte qui a fabriqué une image se lit sur elle, entier.** La fiche d'une image montre le
texte **tel qu'il est parti** — avec ce que le jeu et l'ambiance y avaient ajouté —, replié à
quelques lignes, dépliable et copiable, sans passer par *reprendre les réglages*, qui change
d'onglet et remplit un champ, c'est-à-dire qui fait tout autre chose que lire. Il était
enregistré depuis le premier jour et n'était affiché nulle part : la fiche n'en montrait que
le titre, qui en est les cinquante-six premiers caractères. On ne le modifie pas depuis là —
la galerie ne fabrique rien, et un texte déjà payé ne se réécrit pas.

**Une image sans texte à elle nomme celle dont elle descend, et ne montre pas son texte.**
*Tranché par l'auteur le 1<sup>er</sup> septembre 2026.* Une image entrée par import dit
qu'elle n'a pas de texte, au lieu de laisser un vide. Une image née d'une autre — une découpe
de planche, un calque rendu — nomme sa parente et y mène : on va lire le texte là où il a été
écrit. Montrer ici le texte de la planche aurait affiché sur une image un texte qui décrit
huit, et rien n'est jamais recopié à un endroit où il n'a pas été écrit.

**La sélection magique est une quatrième façon de désigner ce qu'on retire.** *Tranché par
l'auteur le 1<sup>er</sup> septembre 2026, sur une question qu'il a posée en retour.* On
entoure grossièrement à main levée ce qu'on veut garder, on voit sa forme se tracer, et
l'atelier ramène le contour sur le bord du sujet **à l'intérieur** de ce qu'on a entouré,
sans toucher à rien au-dehors ; le résultat se retouche ensuite à la main sans recommencer, et
le tracé se défait d'un seul coup. Elle prend place à côté du remplissage depuis le bord, de
la pipette et du modèle, et **elle agit avec le détourage** — donc avant le recadrage et la
mise sur grille, qui ont tous les deux besoin de savoir où est le sujet : tant que le fond est
là, la boîte du sujet, c'est toute l'image. La question posée en retour était la bonne — *un
tracé propre à une image va-t-il entrer dans une recette ?* — et la réponse est **oui, dans
les deux emplacements envisagés** : la main est une place de la recette autant que le
détourage, et ses passages y sont enregistrés comme des tracés. Ce qui protège n'est donc pas
l'emplacement, c'est la règle du voyage ci-dessus, qui vaut déjà pour le point de la pipette.

**Le moteur d'une passe vient d'une liste, jamais d'un nom écrit une fois pour toutes.** Le
détourage par modèle n'en connaissait qu'un ; la règle du produit — *ce qui est proposé vient
d'un catalogue* — vaut ici pour la raison qui la fait valoir ailleurs. On en ajoute un
**plus lourd et meilleur, qui n'est pas le défaut** : le rapide reste ce qu'on obtient sans
rien demander, le lourd est là pour les cheveux, les franges et les objets ajourés, et il
**annonce sa lenteur avant de partir**, pas pendant. Un moteur absent de la machine est grisé
avec sa raison et le geste pour l'installer, et une recette qui nomme un moteur absent le dit
sans casser le rendu des autres passes.

**Un moteur installé dont le modèle n'est pas encore descendu reste choisissable, et il
annonce ce qu'il rapatrie.** *Tranché par l'auteur le 1<sup>er</sup> septembre 2026.* Deux
absences existent et elles ne se traitent pas pareil : le moteur qui n'est pas installé du
tout est grisé, comme n'importe quoi d'indisponible ; celui qui est là mais dont le modèle
doit encore descendre reste proposé, et dit **avant de partir et une seule fois** ce qu'il va
chercher et combien ça pèse. Griser les deux aurait obligé à sortir de l'atelier pour un
téléchargement que l'atelier sait faire ; les confondre aurait laissé tomber une attente de
plusieurs minutes sur un geste annoncé comme lent de quelques secondes.

**« Meilleur » est un relevé, pas une promesse.** Ce qui autorise à le dire : la durée des
deux moteurs sur les images déjà là, et ce qu'ils rendent côte à côte sur des silhouettes
difficiles. Le produit ne calcule aucune note de qualité par moteur — écartée pour la raison
qui l'écarte déjà pour les modèles : elle se juge à l'usage, sur des images qu'on voulait de
toute façon.
