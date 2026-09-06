# Architecture — §11, les risques et quand les lever

> Descendu de `docs/ARCHITECTURE.md` le 6 septembre 2026, **sans qu'un mot change**.
>
> On l'ouvre **quand on ouvre une version**, pour savoir ce qu'elle doit lever — pas au
> démarrage d'une séance.

## 11 · Risques, et quand les lever

| Risque | Gravité | Quand le lever |
|---|---|---|
| ~~**La recette d'animation n'existe pas**~~ | — | **levé le 2 septembre 2026, et la réponse est négative.** Trois bancs payés — **141 planches, 6,03 $**, toutes notées une par une par l'auteur : une planche d'animation revient bonne **une fois sur dix**, et **aucune façon de la demander ne fait mieux** que celle qui part déjà (trente-et-un réglages, cinq réécritures de fond pour zéro bonne planche sur vingt). Ce n'est pas un motif d'abandon, c'est un **prix** — et c'est lui qui impose la forme du produit : *on commande plusieurs planches et l'on garde la bonne*, jamais *on commande et on corrige*. `docs/bilan-v3.md`, et `docs/archi-versions.md` §8 réécrite le même jour |
| ~~Un calque ne se repose pas sur une autre pose~~ | — | **retiré le 28 août 2026 : ce n'était pas un risque, c'était une promesse fausse.** Un casque vu de face n'est pas un casque vu de dos ; un calque est solidaire de sa pose et il en faut un par pose. Ce qui l'a remplacé — la planche d'équipement pliée, N calques pour un appel — rend le prix acceptable sans rien promettre qu'on n'ait mesuré. Voir §7 |
| ~~La toile avec marge n'a jamais été essayée~~ | — | **tiré le 29 août 2026, six planches payées.** L'échelle au retour est restée dans la tolérance à chaque fois, à 0,92 comme à 0,62 : la marge **n'a pas eu à servir**, et le repli sur le corps habillé n'a jamais été pris que sur une échelle inventée par un recalage défectueux. L'hypothèse n'est pas validée pour autant — le dézoom qu'elle prévient ne s'est pas présenté —, mais elle ne coûte rien et elle reste posée. Voir §7 |
| **La différence trouve ce qui s'ajoute et manque ce qui se substitue** | faible depuis C4 — la main ramène ce que la mesure n'a pas vu (451 pixels contre 1 044, mesuré) ; ce qui reste est que rien ne l'annonce d'avance | **mesuré le 29 août 2026**, sur les mêmes six planches : une hache est revenue en calque net, un casque en poussière. Une pièce qui occupe l'empreinte de ce qu'elle remplace relève de `touche`, et la tolérance au voisin de 3×3 — juste, elle protège du résidu de recalage — l'efface avec le bruit. La portée déclarée oppose *contenue* et *qui agrandit* ; ce qui décide ici est *ajoute* contre *substitue*, et les deux découpes ne se recouvrent pas. Non cadré : `docs/releve-usage.md` |
| ~~Le bon modèle pour une planche n'est pas le bon pour une édition~~ | — | **traité le 28 août 2026, pas seulement mesuré.** Un modèle recopie les traits du gabarit de découpe et rend la planche tramée, un autre l'ignore. Le projet porte donc **deux** défauts de modèle — planche, et édition d'un corps — sans que l'auteur ait à y penser. Passé en décision produit, ce n'est plus un risque ouvert |
| ~~Aucun fournisseur ne préserve l'identité~~ | — | **levé le 26 août 2026.** `gemini-3.1-flash-image` tient l'identité et la dérive entre deux poses enchaînées est quasi nulle. Seedream 4.5 échoue sur ce point mais excelle au transfert de style. |
| **L'échelle du sujet dérive d'une génération à l'autre** | **élevée — et c'est le mécanisme censé la corriger qui la fabrique** | ~~constaté le 26 août. Corrigé par le recadrage et la normalisation d'échelle, qui passent donc de « confort » à **obligatoires**~~ — **faux, et c'est l'inverse du vrai. Trouvé en lisant le code le 2 septembre 2026.** La remise sur grille calcule le facteur de réduction sur **la boîte de l'image courante** : un bras tendu agrandit la boîte, donc **réduit tout le personnage**. La normalisation ne corrige pas la dérive entre deux images d'un même mouvement, elle l'**introduit**. Mesuré sur la chaîne complète : les huit images livrées d'une même marche faisaient toutes exactement la même hauteur, ligne de sol au même pixel, **écart zéro** — le balancement disparaît avant d'être vu. Et le commentaire du code affirme le contraire de ce que le code fait. **Réparation : cinq lignes et un commentaire**, c'est le premier travail de la tranche `A2` (`docs/bilan-v3.md` § 3). *Le code connaît la dérive **horizontale** et offre un décalage à la main ; c'est la dérive d'**échelle** qui est fatale, et elle n'est nommée nulle part.* |
| **Une poussière sous les pieds déplace tout le sujet** | moyenne — même chaîne que la ligne ci-dessus | **trouvé le 2 septembre 2026, en lisant le code.** L'ancrage vertical pose le **bas de la boîte englobante** sur le bas de la case : toute poussière, toute ombre isolée sous les pieds soulève le personnage d'autant. **Le nettoyage des taches doit précéder le calcul de la boîte**, sinon un pixel perdu décide de la position de toute l'étape. Corollaire d'ordre de `A2`, à ne pas découvrir en route |
| ~~La couverture image d'OpenRouter~~ | — | **levé le 27 août 2026** par `essais/essai_couverture.py` : 48 modèles image, 11 fournisseurs, 31 acceptant trois références ou plus. Et le catalogue a bougé en un jour — 47 → 48 — ce qu'une liste en dur n'aurait pas vu |
| **Le coût par image dérive** | moyenne | enregistrer le coût réel de chaque génération dès la T1, et le totaliser par projet |
| ~~**Le gain d'une planche n'est mesuré qu'à quatre cases**~~ **— mesuré le 31 août 2026** | *levé, et il a rendu une autre réponse que celle qu'on cherchait* | Trois appels payés à trois, cinq et six cases sur le même sujet (`essais/essai_prix_planche.py`, $0,081, relevé versionné). **Trois cases et six cases ont coûté exactement le même prix**, `$0,0139`, pour la même taille d'image et la même durée ; cinq cases ont coûté `$0,0534` sur un appel dont rien ne distingue le résultat. Une planche coûte donc le prix d'**un appel**, quel que soit ce qu'elle porte : le prix par image tombe en `1/N`, et six cases reviennent à `$0,0023` l'image contre `$0,0128` pour une image seule. Mais **la variance entre deux appels identiques dépasse l'écart entre deux tailles de planche**, et c'est le risque qui reste : un écran qui afficherait un prix par nombre de cases montrerait du bruit comme s'il montrait une structure |
| ~~La qualité pixel art directe~~ | — | **levé le 27 août 2026** par `essais/essai_pixel.py`, sur 44 images de six modèles et sans un appel : aucune sortie brute n'a de transparence, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px — facteur 2 **à l'intérieur d'un même lot**. Après traitement : 27 couleurs, alpha franc, grille imposée, 0 sujet perdu sur 44, 0,17 s par image. La question s'est retournée : le post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi rien n'est utilisable |

~~Le deuxième risque est le plus sournois~~ — il a été levé le 26 août, avant même
d'écrire la bibliothèque, exactement comme prévu ici. ~~Le sournois, désormais, c'est le
report d'un calque sur une autre pose~~ — **et celui-là n'a jamais existé.** Il a été écrit ici
le 28 août au matin par extrapolation, et retiré le soir même : reposer un casque de face sur
une pose de dos n'est pas un pari technique qui pourrait tenir, c'est une chose qui ne marche
pas et qu'aucun essai n'aurait sauvée.

**La leçon vaut mieux que le risque.** Ce faux risque est né d'une confusion entre *ce que
l'essai a mesuré* et *ce qu'on aurait aimé qu'il mesure* — l'essai prouvait l'extraction, on
en a déduit le report. La même séance a produit la même faute une seconde fois, dans la
conclusion imprimée de `essais/essai_silhouette.py` : une médiane sur trois pièces annonçait
que les six modèles tenaient les seuils, alors que la cape échouait sur les six. **Une moyenne
efface le seul cas qui décide.** Les deux sont corrigés ; ce qui reste à surveiller, c'est le
geste, pas le chiffre.

**Et il s'est rouvert tout seul le 30 août 2026, dans une maquette de la V2.1 — refusé une
seconde fois.** La maquette de la superposition proposait de reposer un calque sur une autre
pose ; le sommaire du dossier la marque lui-même « à reprendre » et écrit qu'aucune mesure ne
soutient sa phrase. La décision de la V2.1 est donc de **ne rien changer ici**
(`docs/v21-arbitrages.md` A-12) — et c'est l'un des quatre seuls endroits où une maquette
n'a pas gagné. Le fait mérite d'être noté : une promesse retirée pour une raison écrite se
réécrit toute seule dès qu'on redessine l'écran qui la portait. **Ce paragraphe est la
défense ; il est là pour être lu la prochaine fois.**

