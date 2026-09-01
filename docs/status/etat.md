# Asset Kitchen — État du dépôt

Le journal de ce qui a été construit, tranche après tranche, et de ce que chaque tranche a
appris. **Il ne fait foi sur rien** : `docs/PLAN.md` dit ce qui reste, `docs/PRD.md` ce que
le produit doit faire, `docs/ARCHITECTURE.md` comment il est construit. Ce fichier-ci ne fait
que raconter, et il se lit dans un seul cas — **quand on veut savoir pourquoi c'est comme ça
plutôt qu'autrement**.

Il ne se lit pas au démarrage d'une session. Une tranche neuve n'a pas besoin de l'histoire
des dix précédentes ; elle a besoin de `docs/PLAN.md` et de `docs/PIEGES.md`.

Une entrée s'ajoute à chaque fin de tranche. Les plus récentes en tête.

## La V2.2 se ferme à cinq tranches sur six — 1<sup>er</sup> septembre 2026

**Ce qui l'a fermée n'est pas une décision de portée, c'est un compte que ce dépôt n'a pas.**
Il reste `F4` — Cloudflare Workers AI —, et elle ne demande ni décision ni construction
préalable : elle demande un identifiant de compte et un jeton, tous deux gratuits, chez un
fournisseur où personne n'a ouvert de compte. Le relevé `F0` avait déjà dû le décrire sur sa
documentation seule, pour la même raison, et il l'avait écrit.

**La marche à suivre pour ouvrir ce compte a été écrite le jour de la clôture**, dans
`docs/tranches/V2.2.md` § F4 : cinq gestes, et le seul piège qu'ils portent — un jeton créé à
la main veut le droit de lire **et** celui d'écrire, faute de quoi l'atelier afficherait tous
les modèles sans pouvoir fabriquer une image. Écrite d'avance parce qu'une manip qu'on
retrouve six mois plus tard se refait deux fois : une fois de travers, une fois bien.

**Ce que la version a livré**, dans l'ordre où ça se remarque : sur une machine où rien n'a
été déposé, **une image arrive** ; un appel qui ne coûte rien dit **gratuit** et non `0,00 $`,
avec ce qu'il a réellement pris écrit à côté ; chaque fournisseur a **sa place à secrets**, y
compris celui qui en demandera deux ; et **une séance de code entière ne fait plus bouger le
total en argent**.

**Ce qu'elle laisse en état de marche pour `F4`**, et qui ne sera pas à inventer ce jour-là :
la réserve du domaine accepte un plafond **facultatif** — parce qu'aucun fournisseur d'ici
n'en annonce —, et `F4` sera la première à en brancher un vrai ; le tiroir à secrets tient
deux places pour un seul fournisseur, ce que Cloudflare demande. Chacune des deux a **un
double d'essai qui la vérifie déjà**, écrit exprès : `FournisseurAvecPlafond` dans
`tests/test_f2.py`, `FournisseurADeuxPlaces` dans `tests/test_f3.py`.

**Et une leçon revenue quatre fois de suite, sous quatre formes.** Des commentaires du domaine
en `F1`, trois mots du produit en `F2`, une garde du lecteur de configuration en `F3`, deux
affichages de l'écran de confirmation en `F6` : *une chose juste sous une hypothèse devient
fausse quand l'hypothèse s'élargit.* Rien dans le code ne le signale — chaque morceau reste
juste tout seul —, et le seul remède qui a marché est de relire ce qui parlait au singulier :
« la clé », « l'argent », « au moins une place ». C'est la façon la moins chère de trouver, et
c'est aussi la seule.

**Le détail des six tranches est descendu ici**, dans `docs/tranches/V2.2.md`, le jour de la
clôture. Le plan portait ce que chaque tranche livre, l'annexe portait ses critères : deux
fichiers qui se renvoyaient l'un à l'autre pour un seul sujet. Ce qu'on lit avant d'avoir rien
lu — les cinq documents ouverts au début de chaque séance — passe de **320,6 Ko à 300,6 Ko**,
et l'on ouvre désormais un seul fichier pour reprendre une tranche.

## F6 — 1<sup>er</sup> septembre 2026

**Le travail de l'agent ne coûte plus d'argent.** Le modèle qu'il impose est celui du
fournisseur qui ne facture rien. C'était déjà l'idée en `T7` — *un agent qui code a besoin
d'un visuel correct tout de suite, pas d'un asset final* —, et elle valait alors un rapport de
six sur le coût du travail agentique ; elle vaut désormais la totalité.

**La tranche creuse un trou en le faisant, et c'est là qu'est passé le travail.** Un modèle
gratuit n'accepte aucune image d'entrée. Avant `F6`, cela voulait dire que le produit refusait
l'appel **tout entier** dès qu'un jeu avait un seul artwork officiel — c'est-à-dire sur
presque tout jeu réel. Le garde-fou aurait donc été éteint le jour même, ce qui est la façon
la plus sûre de perdre un garde-fou. La règle posée tient en une phrase : **ce que le produit
ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a joint ne cède jamais.**

**Ce qui a coûté n'est pas la règle, c'est tout ce qui l'entoure.** *Rien ne se perd en
silence* demandait quatre choses, et chacune touchait un endroit différent : le grisé d'un
modèle se compte désormais sur ce qui ne cède pas — sinon la liste dirait *indisponible* d'un
modèle chez qui la soumission passe, c'est-à-dire l'inverse exact de la règle de `T1` ;
l'écran de confirmation marque les lignes qui ne partiront pas et l'écrit en toutes lettres ;
le prix ne compte que ce qui part ; et la génération enregistre ce qu'elle a laissé au sol.
Cette dernière ligne est celle qui se lit le plus tard : sans elle, une image faite sans le
style du jeu et une image faite dans un jeu sans style se liraient pareil, des mois après.

**Le repli du garde-fou a changé, et c'est le même raisonnement poussé d'un cran.** Il rendait
le défaut du catalogue quand le modèle imposé n'y était plus — c'est-à-dire le meilleur modèle
du banc, c'est-à-dire un payant. Un garde-fou posé pour ne rien dépenser qui se replie sur un
payant le jour où le gratuit change de nom **coûte de l'argent en silence**, ce qui est pire
que pas de garde-fou du tout. Il cherche donc un autre gratuit d'abord.

**Deux défauts d'affichage attendaient depuis E14, et c'est un modèle sans places qui les a
montrés.** Le premier : l'écran de confirmation annonce *« N avertissements — non bloquants,
écrits sur la ligne concernée »*, et les avertissements du bloc d'images n'ont pas de ligne de
prompt à eux — ils n'étaient donc rendus par **aucun chemin**. On lisait « 1 avertissement » et
l'on cherchait où. Le second : son sommaire annonçait « 1 sur 0 », parce qu'il comptait *les
cochées sur les places du modèle*, c'est-à-dire un compte sur une **capacité**. Les deux
étaient justes tant qu'un modèle avait au moins une place, et faux dès qu'il n'en avait
aucune — c'est le même piège que les trois tranches précédentes ont payé sous trois autres
formes.

**Ce que la vérification a montré, et qu'aucun essai ne montrait.** Un appel réel chez le
gratuit, sur un jeu portant un artwork officiel : l'image revient en **1 jeton et $0,00**, et
sa fiche dit *partie sans le style du jeu — 1 image n'a pas suivi, ce modèle n'en accepte
pas*. C'est la phrase entière de la tranche, lue à l'endroit où elle servira.

## F3 — 1<sup>er</sup> septembre 2026

**Le tiroir à clés a cessé d'être « la clé ».** Une place par fournisseur, chacun déclarant ce
qu'il demande — une clé, deux secrets, ou rien du tout —, et déposer l'une ne touche à aucune
autre. Le produit n'avait jamais eu qu'un champ ; le relevé `F0` avait trouvé un fournisseur
qui en demande **deux** — un compte *et* un jeton —, et un formulaire à un champ l'aurait
découvert en `F4`, au pire moment.

**La séparation qui a rendu la tranche courte.** L'adaptateur déclare *quelles places existent
et comment on en parle à l'auteur* ; ce qu'il y a dedans se lit ailleurs, dans le module des
réglages, qui ne connaît plus qu'une chose : **une place nommée, et sa valeur**. Le module ne
sait donc plus qu'OpenRouter existe, et un fournisseur neuf n'y ajoute pas une ligne. La règle
de T1 — *la valeur se relit à chaque appel, jamais au démarrage* — n'a pas été réécrite, elle
a été **étendue au pluriel** : les fabriques reconstruisent chaque fournisseur au moment où
l'on s'en sert, et chacun relit ses valeurs en naissant.

**Une garde du lecteur de configuration attendait de devenir une panne.** Pour deviner
l'encodage du fichier — PowerShell écrit en UTF-16, piège payé en T1 —, il gardait le premier
décodage **qui contenait le nom de la clé d'OpenRouter**. Imparable tant qu'il n'existe qu'un
secret au monde ; le jour où un fichier ne porte que les deux valeurs de Cloudflare, il n'est
plus reconnu comme un fichier de configuration **du tout**, et le produit annonce *aucun jeton*
sur un fichier qui en porte un. La panne se serait présentée en `F4` comme un problème de
Cloudflare. C'est le troisième jour de suite que la même chose se produit sous une forme
différente — des commentaires en `F1`, trois mots du produit en `F2`, une garde technique
ici : *une chose juste sous une hypothèse devient fausse quand l'hypothèse s'élargit*, et rien
dans le code ne le signale, puisque chaque morceau reste juste tout seul.

**Deux mots de la barre du haut n'ont pas survécu.** Elle disait `clé …a41c` ou `aucune clé` ;
le critère demandait de garder les seconds pour le cas où rien ne peut produire. Ils nomment
la mauvaise chose dès qu'un fournisseur demande autre chose qu'une clé, et la barre dit donc
**avec quoi on peut produire** — `2 fournisseurs prêts`, `1 sur 2`, `rien pour produire`. Ce
n'est pas un changement de mots mais un renversement de ce qu'elle annonce : elle décrivait
*ce qui manque*, dans un monde où un seul manque éteignait tout ; il en manque désormais un
sur deux et une image part quand même.

**Et le français a coûté un champ de plus.** *« aucune clé OpenRouter »* et *« aucun jeton
Cloudflare »* ne se composent pas avec la même règle : une phrase du produit ne se fabrique
pas par concaténation. Chaque place déclare donc sa forme négative en toutes lettres, ce qui a
permis de reproduire la phrase d'avant **mot pour mot** quand il n'y a qu'une place — et de ne
réécrire aucun essai de T1.

**Ce qu'une vérification à la main a trouvé et qu'aucun essai ne cherchait.** Déposer une clé
depuis l'étape de l'assistant laissait la barre du haut annoncer `1 sur 2` sur un atelier où
les deux fournisseurs étaient prêts : l'étape tenait son tiroir à jour toute seule et ne
prévenait personne, là où la fenêtre des réglages prévenait déjà. Deux rendus du même
composant, un seul branché. C'est exactement la leçon d'E13 — *deux endroits qui montrent la
même chose divergent par ce qu'ils font, pas par ce qu'ils affichent*.

## F2 — 1<sup>er</sup> septembre 2026

**Le produit compte dans l'unité du fournisseur, et « gratuit » a cessé de s'écrire
`$0,0000`.** C'était le mensonge par omission que l'écran des dépenses avait été construit
pour arrêter, rouvert un cran plus bas par l'arrivée d'un fournisseur qui ne facture pas :
zéro dollar est vrai, et se lit *sans limite* là où il faut lire *sans prix*. Ce qu'un appel
prend chez Pollinations — un jeton, annoncé dans ses en-têtes — est désormais enregistré à
côté du mot.

**La forme trouvée est plus petite que la tranche ne le laissait croire, et c'est ce qui l'a
rendue tenable.** Le premier réflexe était d'ajouter une unité à côté du coût, partout. Le
second, celui qui a été suivi : **le coût en argent est *déduit* de la quantité et de son
unité**, et vaut zéro dès que l'unité n'en est pas une. L'invariant *un total en argent ne
compte que de l'argent* est alors tenu **par construction** — un jeton ne peut pas entrer dans
une somme de dollars, où qu'elle soit calculée —, et aucune des dizaines de sommes de
`cout_usd` du dépôt n'a eu à apprendre qu'il existe d'autres unités. Huit cents essais sont
restés verts à travers un changement de modèle d'objets.

**Le relevé avait écrit la contrainte, et le plan ne l'avait pas lue.** Deux des dix critères
demandaient d'afficher *ce qui reste*. Or « ce qui reste » demande un plafond, et **aucun des
deux fournisseurs n'en annonce** : celui qui ne demande rien limite une **cadence**, un appel
toutes les quinze secondes, pas un quota. C'était écrit noir sur blanc dans la cinquième
conclusion du relevé `F0`, un jour plus tôt. Le produit a donc été construit avec un plafond
**facultatif** — `reste` vaut alors `null`, qui n'est pas zéro : zéro veut dire *attends
demain*, `null` veut dire *rien ne te limite*. Un double annonce un plafond pour que la
machinerie soit vérifiée avant que `F4` ne l'utilise pour de bon.

**Et le banc gratuit a annoncé une régression qui n'existait pas.** Il redemandait la même
phrase à chaque lancement ; le fournisseur la servait de son cache en 0,2 s au lieu de 25, et
**sans aucun de ses deux en-têtes** — ni celui qui dit quel modèle a répondu, ni celui qui dit
ce que l'appel a consommé. Le garde du modèle instauré en `F1` ne pouvait donc pas se
déclencher, et le banc a écrit que l'adaptateur avait cessé de refuser. Deux choses valaient
d'être apprises. La première : **la durée était la preuve, et personne ne la lit** — 0,2 s
pour une image qui en demande vingt-cinq n'est pas une bonne surprise, c'est un aveu. La
seconde : **un banc qui mesure un fournisseur demande une phrase que personne n'a demandée**,
sinon il mesure un cache en croyant mesurer un adaptateur. Le garde, lui, garde son trou : sur
une réponse cachée, on ne peut pas savoir quel modèle a fait l'image. Sans conséquence tant
que ce palier ne déclare **qu'un** modèle — ce qui est mesuré —, et à rouvrir sinon.

**Trois mots du produit étaient justes parce qu'il n'y avait qu'une unité** : *payé*,
*facturé*, *à repayer*. Chacun devient faux chez un fournisseur qui ne facture pas, et aucun
n'aurait levé d'erreur. C'est le même piège qu'`F1` avait payé sur les commentaires, une
couche plus haut — *une phrase juste sous une hypothèse devient fausse quand l'hypothèse
s'élargit* —, et il vaut la peine de noter qu'il s'est reproduit **le lendemain**, sur le même
sujet, sans que la première leçon suffise à le voir venir.

## F1 — 1<sup>er</sup> septembre 2026

**Le produit connaît plusieurs fournisseurs d'images, et le second ne demande rien.** Sans
compte, sans clé, sans carte : on écrit un sujet, et une image arrive en une seconde et demie.
C'est Pollinations, celui que le relevé `F0` avait désigné — un seul modèle sur le palier
anonyme, aucune image de référence, et un jeton par appel.

**Ce qui a été le plus difficile n'était pas d'ajouter un fournisseur, c'était de nommer un
modèle.** Jusqu'ici un modèle s'appelait `openai/gpt-image-2`, et ce nom se promenait partout
— dans la liste où l'on choisit, dans le fichier d'une génération, sur la fiche d'une image,
dans le journal des dépenses. Deux fournisseurs peuvent proposer le même nom : Cloudflare
héberge les modèles de Leonardo, et le relevé l'a trouvé. Le nom est donc devenu
`OpenRouter:openai/gpt-image-2` — **les deux ensemble, jamais l'un seul** —, et il a fallu le
suivre jusqu'au bout de chaque chemin. Toutes les images déjà sur ce disque portent l'ancien
nom : le catalogue les rattrape, **mais seulement quand un seul fournisseur revendique ce
nom-là**. Sinon il dit qu'il ne sait pas, plutôt que de choisir entre un payant et un gratuit
à pile ou face.

**Une règle du dépôt a rencontré une autre, et il a fallu trancher.** Le critère de la tranche
demandait que couper la liaison d'un fournisseur **grise** ses modèles. Une règle plus
ancienne dit que *l'échec survient au moment où on génère, jamais au démarrage* — et la V2.2
l'hérite sans la rediscuter. Un catalogue qui n'a pas répondu ne prouve rien sur l'adresse qui
génère : éteindre le bouton sur cette base, c'est accueillir l'auteur par une erreur que rien
n'a mesurée. **La règle plus ancienne l'emporte**, et la distinction est désormais écrite dans
le produit : ce qui **manque** — une clé — grise et refuse ; ce qui est **injoignable** sert sa
photo datée et laisse générer. L'arbitrage entier, avec ce qu'il faudrait changer pour le
renverser, est dans `docs/tranches/V2.2.md` § F1.

**Et trois phrases du produit sont devenues fausses le même jour**, aux trois endroits où
elles vivaient : *« sans clé, le bouton qui paie reste éteint »*. Le plan l'avait annoncé —
c'est la seule des trois révisions de la V2.2 qui *se voit sans la chercher*. Le piège n'est
pas d'avoir écrit la phrase, c'est qu'elle était **justifiée par un commentaire honnête** :
« le fournisseur est le même pour tous, il ne distingue rien ». On lit ça, on trouve ça
prudent, on passe. C'est écrit dans `docs/PIEGES.md`.

**Ce qui reste ouvert, et qui appartient à F2** : un appel gratuit affiche encore `$0,0000`.
Rien n'est faux — zéro dollar est bien parti —, mais c'est le mensonge par omission que
l'écran des dépenses avait été construit pour arrêter, un cran plus bas. Ce que l'appel
consomme vraiment est connu et non enregistré : un jeton, annoncé dans les en-têtes.

## Le compactage des documents — 29 août 2026

**Le corpus de démarrage est passé de 315 à 139 Ko sans qu'une ligne soit supprimée.** Sept
passes, et ce qui est sorti est descendu en annexe avec un renvoi. Ce n'est pas une tranche :
rien du produit n'a changé, seuls les documents ont été redécoupés.

**Ce qui a été trouvé en mesurant, et qu'aucun de nous ne voyait.** `AGENTS.md` portait la
règle depuis le début — *« dès qu'une section pèse plus que le document qui la porte, elle
sort en annexe »* — et elle n'a jamais déclenché une seule fois. La raison est arithmétique :
**aucune section n'atteint jamais la moitié de son document**. La plus lourde du corpus
d'alors, « Où sont les choses » dans `AGENTS.md`, en faisait 71 % — un cas unique. Partout
ailleurs le document doublait par accumulation de sections moyennes, chacune parfaitement en
règle. Une règle qui ne peut pas se déclencher est une règle qu'on croit avoir.

**Et 36 renvois mentaient en silence.** Le code et les documents renvoient aux documents près
de six cents fois — un « § » qui nomme une section, un numéro qui nomme un chapitre, une
lettre et un chiffre qui nomment une tranche — et rien ne vérifiait qu'une section citée
existait encore. L'extraction du 28 août avait
emporté treize sections de `DESIGN.md` vers `design-motifs.md` ; les trente-trois renvois qui
les visaient étaient restés sur l'ancienne adresse, sans qu'aucun test ne s'en aperçoive.
C'est exactement la fragilité n°1 relevée chez SpriteCook, où la doc publique et le schéma du
serveur ne se recouvraient plus.

**Le banc est donc venu avant le découpage, et non après.** `essais/essai_docs.py` pèse le
corpus section par section — sous-sections comprises, sans quoi le poids d'un chapeau
déciderait à la place de ce qu'il porte — et résout chaque renvoi contre les titres réels du
document visé. Les 36 renvois cassés ont été réparés **avant** la première passe de découpage,
et c'est ce qui a rendu les six suivantes vérifiables : tout renvoi cassé apparu ensuite était
le fait du découpage, et de rien d'autre. Il y en a eu 41, tous repointés.

**Le banc s'est trouvé un trou à lui-même, à la sixième passe.** Il ne lisait que les renvois
écrits avec leur chemin complet ; un sur six s'écrit sans — `` `PLAN.md` `` tout court. Huit
renvois cassés par la quatrième passe étaient donc passés sous son nez pendant qu'il annonçait
tout vert. Il les lit depuis.

**Ce qui est sorti, et où :**

| Passe | Ce qui sort | Vers | Gain |
|---|---|---|---:|
| 1 | le détail des vingt tranches | `docs/tranches/` — un fichier par tranche, de `T1` à `R5` | 50 Ko |
| 2 | la carte fichier par fichier | `docs/carte-du-depot.md` | 33 Ko |
| 3 | les 173 user stories, le carnet des séances | `docs/user-stories.md`, `docs/prd-carnet.md` | 38 Ko |
| 4 | les dossiers de version, §6 à §10 | `docs/archi-versions.md` | 44 Ko |
| 5 | le relevé du fournisseur, §4 bis | `docs/archi-fournisseur.md` | 14 Ko |

L'ancienne archive du plan — un seul fichier pour les dix tranches finies — a été dissoute
dans les vingt : chaque tranche a désormais une adresse, au lieu d'un rang dans un long
document.

**Une décision de méthode, qui a rendu le reste possible : les numéros de section ne bougent
pas.** Soixante-dix renvois disent « §7 » ou « §6.2 ». Renuméroter `ARCHITECTURE.md` après en
avoir sorti cinq sections les aurait tous cassés d'un coup, pour un gain nul. Une section
déplacée **garde son numéro dans son nouveau fichier**, et c'est le fichier du renvoi qui
change. `docs/archi-versions.md` s'ouvre donc sur un §6.

**La règle a changé, et pas dans le sens attendu.** Le plan visait un plafond de 140 Ko, et
le corpus l'a tenu à 139. Le plafond n'a pas été gardé : *un seuil rond refuserait le jour où
l'on écrit une phrase de plus, ce qui n'est pas une faute, et se relèverait le jour où il
gêne, ce qui n'est pas un garde-fou.* Le banc mesure désormais la **dérive** — chaque relevé
comparé au précédent, et le plus haut connu écrit en dur pour que l'échelle ne se perde pas.
Ce qui le fait échouer est ailleurs, et c'est objectif : un renvoi cassé désigne une section
qui n'existe plus.

**Trois manques comblés en passant**, tous trouvés par le découpage et non cherchés : `C4` et
`C5` n'avaient pas de ligne d'état dans le plan ; `mcp/` était encore décrit comme « vide
jusqu'à T7 » ; et deux renvois visaient `AGENTS.md` pour ce qu'il n'a jamais porté — un piège
vit dans `PIEGES.md`, une dette reportée dans le fichier de sa tranche.

## C4 — 29 août 2026

**C4 est écrite : la main rattrape ce que la différence ne voit pas.** Le masque d'un calque
s'affine à main levée puis au pixel, le calque lui-même se retouche au pixel avec le corps en
repère dessous, l'avant et l'après se comparent en maintenant un contrôle, et une colonne de
pièce se trie par la mesure la plus défavorable. **Les sept critères sont cochés, tenus par
16 essais de serveur et 8 d'écran.**

**La décision qui n'était pas dans le cadrage : la retouche ne fait pas que retirer, elle
ramène.** Une seconde couche qui n'aurait su qu'effacer aurait laissé entier le défaut de la
séance du 29 août — *la différence trouve ce qui s'ajoute et manque ce qui se substitue* —,
puisque aucun réglage de masque ne fabrique une différence que la comparaison de couleur n'a
pas vue. La couche tranche donc **après** la mesure et dans les deux sens : elle ôte ce qui est
en trop, et elle ramène les pixels revenus là où la mesure n'a rien trouvé. C'est la seule
moitié de C4 qui répare quelque chose ; l'autre ne fait qu'affiner ce qui marchait déjà.

**Et ça se mesure sur la vraie image.** Le casque du 29 août, celui qui était revenu en semis de
pixels épars : **451 pixels opaques avant, 1 044 après un seul passage de la main**, et le casque
est lisible. L'avant, lui, rend toujours 451 — il se calcule, il ne se garde nulle part.

**Un vecteur, jamais une image.** Une couche enregistre le chemin parcouru et son rayon, pas le
masque qu'il produit. Un masque en octets aurait pesé la taille de l'image à chaque geste, et
surtout il aurait perdu ce qui fait une recette : se rejouer. Le prix est que la rasterisation
doit être déterministe — ce qui est un critère depuis T2, et ce qui a immédiatement coûté un
piège : *une ellipse de taille nulle ne peint aucun pixel*, donc le geste au pixel ne marquait
rien tant qu'il tenait en un seul point.

**Rayon zéro est le pixel.** « À main levée, puis au pixel » n'est pas deux outils : même liste
de points, même rasterisation, un nombre de différence. Deux chemins de code séparés auraient
fini par ne plus se rejoindre au rayon 1, et l'écran aurait dû apprendre lequel appeler.

**Ce que C4 a trouvé en s'en servant, et qui n'était pas de C4.** Ouvrir le panneau sur le
projet réel a rendu **500** : un calque dont le corps a changé de taille — parce que la cible de
pixel du projet a été relevée depuis — ne se rendait plus du tout. Le défaut est de C3 ; C4 l'a
**révélé** en ajoutant deux places à la recette, donc en faisant recalculer tous les calques
d'un coup. Ce qui l'avait rendu invisible est le cache : tant qu'une recette ne bouge pas, son
rendu est servi depuis le disque et personne ne recalcule rien. *Un cache cache aussi les pannes
du calcul qu'il remplace* (`docs/PIEGES.md`). Un corps qui a changé de taille est désormais
traité comme un corps disparu.

**Deux refus, et ils tiennent le motif.** Le tri par le pire n'est pas le défaut — le plan du
jeu reste l'ordre des rangées, parce que c'est celui de l'auteur et le seul dans lequel une case
*vide* se lit. Et « ce qui reste à regarder » ne s'écrit nulle part : c'est un calque sur lequel
la main n'est pas passée, et ça se lit dans sa recette, comme *ceci est un calque* depuis C3.

**Ce qui reste ouvert.** Le produit ne dit toujours pas **d'avance** qu'une pièce va se
substituer : aucune des cinq mesures ne l'annonce — celle du 29 août affichait une échelle à
1,00 et une silhouette à 100 %. Le risque a changé de gravité, pas de nature.

## C5 — 29 août 2026

**C5 est écrite : le personnage part dans le jeu, et l'agent a la boucle entière.** Ses poses
et ses calques se posent dans le dossier du jeu, à plat, avec un descriptif qui dit ce qu'est
chaque fichier — sa pose, sa pièce, la place de cette pièce sur le corps et son rang. Cinq
outils MCP complètent le plan sans que l'écran soit ouvert : lire ce qui manque, ajouter une
attitude, remplir, habiller, livrer. **Les huit critères sont cochés, tenus par 22 essais de
serveur et 4 d'écran.** Elle a été écrite pendant que C4 s'éprouvait encore : le plan la
disait recommandée mais non bloquante, et elle l'était.

**La décision qui n'était pas dans le cadrage : ce qui sort est ce que la matrice retient.**
Un corps par pose, un calque par pièce — le favori d'abord, sinon la plus récente. Sortir les
quatre variations d'une pose aurait rendu le tri à qui ouvre le dossier, alors que l'auteur y
a déjà répondu en marquant son favori, et « utilisable sans manipulation » dit exactement le
contraire de « choisis toi-même ». La règle n'a pas été écrite pour l'occasion : c'est
`corps_retenu`, celle qui compose déjà la planche d'équipement de C3. Un second barème aurait
fait sortir une autre image que celle que l'écran montre comme le corps de la pose.

**À plat, et c'est un refus.** Pas de sous-dossier par personnage, pas de convention de
moteur : « aucune structure inventée » ne s'arrête pas au code de jeu. Un dossier
`sprites/héros/` créé d'office est une décision de rangement prise pour un jeu dont l'atelier
ne sait rien. Ce qui remplace la structure est le descriptif, et c'est pour ça qu'il porte le
**rang de l'emplacement** : sans lui, un agent qui empile un casque et une cape doit inventer
lequel passe devant.

**Ce que la première sortie d'un vrai personnage a trouvé, et qu'aucun essai ne voyait.**
Balthazar est sorti en sept fichiers ; l'un d'eux, annoncé « calque », montrait un nain
entier. La pièce était le casque de `coeur de pierre - 01`, déclarée « agrandit » : ce qui
était revenu n'était pas un calque mais un **corps habillé** (US-148), et le descriptif le
donnait à empiler sur le corps. Ce qui l'avait rendu invisible est le montage des essais —
une pièce « contenue » qui revient à l'échelle produit toujours un vrai calque, donc le seul
cas qui distingue les deux n'était jamais joué là où le rôle s'écrit. Le rôle vient
maintenant de `Recette.calque`, la question que l'écran pose déjà pour afficher « ceci n'est
pas un calque », et il y en a trois : `corps`, `calque`, `corps_habille`.

**Ce que C5 a trouvé et qui n'était pas de C5 : deux endroits écrivaient le sujet d'une
case.** L'écran le composait depuis C1 — signalement du personnage et nom de l'attitude pour
une case, signalement seul pour un lot, description de la pièce pour une planche. L'agent arme
les mêmes cases ; laisser le MCP le recomposer aurait fait une seconde vérité, et laisser
l'agent le retaper aurait rompu la promesse d'US-115 au premier appel payé. La composition est
donc descendue dans `ServiceProduction.sujet`, l'écran la demande en armant, le MCP l'appelle
en générant. Le prix est un aller-retour de plus sur un geste local et gratuit — et un refus
n'empêche pas d'armer : la case est visée, le champ reste à écrire.

**Le MCP a perdu sa dernière logique.** `export_assets` rouvrait l'archive de T6 pour en
ressortir les fichiers un par un : la seule fonction du serveur qui *faisait* quelque chose,
donc la seule entorse à l'invariant de T7. Le geste vit dans le service, les deux sorties le
partagent, et l'essai qui lit les imports interdit maintenant `zipfile` en plus des quatre
autres. Un invariant se répare mieux le jour où l'on rouvre le fichier pour une autre raison.

**Ce qui reste ouvert.** Personne n'a encore sorti un personnage dans un vrai jeu : la règle
du dépôt — *une tranche n'est finie que lorsqu'on s'en est servi* — n'est pas encore tenue
pour C5. Deux points attendent cette séance-là : les gestes de finesse de C4 ne sont pas
exposés à l'agent (borner, affiner, retoucher demandent un œil, et on verra si l'agent les
réclame), et le vestiaire reste un geste d'auteur — l'agent s'en sert, il ne le peuple pas.

## R5 — 29 août 2026

**R5 est écrite : un calque se recale sans repayer.** Le geste part d'une image sortie d'une
planche d'équipement, relit la planche payée, et repose l'alignement, les cinq mesures et le
verdict sur les assets déjà nés — même identifiant, même rang, même place en bibliothèque.
**Les neuf critères sont cochés, tenus par 9 essais de serveur et 2 d'écran.**

**Le problème que les essais devaient poser, et comment.** Rejouer le même calcul rend le même
résultat : un essai qui déplierait puis rejouerait sans rien changer entre les deux ne
prouverait même pas que le rejeu a lu la planche. Deux montages le rendent visible — **abîmer
le brut du calque** puis rejouer, et il revient ; **changer la portée de la pièce** entre les
deux, et le verdict bascule pour la planche entière sans qu'un identifiant bouge.

**Une seule lecture de planche pour les deux chemins.** Le dépliage et le rejeu doivent tomber
sur exactement le même résultat, sans quoi recaler changerait l'image pour une raison qui n'est
pas le défaut qu'on répare. C'est la raison qui avait déjà sorti `decouper_retour` de `deplier`
en C3, appliquée un cran plus haut.

**Et ce que le rejeu a mesuré sur les six planches du 29 août.** **Cinq sur six bougent**, pas
quatre : aux deux calques manifestement faux et aux deux corps habillés prononcés sur une
échelle inventée s'ajoute un calque dont l'échelle était juste et dont le *placement* se
déplace — le critère monotone départageait aussi les décalages. La sixième, seule produite
après la correction, revient **identique**. Le rejeu est donc fidèle là où il n'y a rien à
réparer, et ne change que ce que le défaut avait changé. Vérifié sur une **copie** du dossier
de données : rien n'a été écrit dans celui de l'auteur.

## La première séance de C3 — 29 août 2026

**C3 a servi, sur un personnage qui portait déjà la pièce, et six planches ont été payées** —
un seul modèle, deux pièces, un casque et une hache, chacune envoyée aux deux occupations,
0,92 et 0,62. Dixième fois de suite que se servir d'une tranche trouve ce qu'aucun test ne
voyait.

**Le défaut : le recalage cherchait sur une note qui ne peut que monter.** Chaque échelle
candidate était notée à la part du corps qu'elle recouvre — une mesure juste, et monotone :
agrandir le revenu finit toujours par tout recouvrir, donc le critère demandait « quelle est la
plus grande échelle ? » et la bonne réponse ne gagnait que par l'égalité. Un aller-retour de
rééchantillonnage coûte deux pour mille de contour ; l'égalité tombait, et une planche revenue
intacte était déclarée revenue à 0,58×, le calque valant toute la silhouette au lieu du seul
casque. On cherche désormais sur le recouvrement rapporté à l'**union**, et on rend la
couverture au placement retenu. Les essais ne l'avaient pas vu parce qu'ils dessinent des blocs
pleins, qui traversent un rééchantillonnage sans perdre un pixel. `docs/PIEGES.md` le porte,
avec le corollaire : *une note qui ne peut que monter avec le paramètre qu'on optimise n'est pas
un critère, c'est un classement du paramètre.* La correction porte la suite de serveur de 343
à **345 essais** ce jour-là.

**La toile avec marge a été tirée, et elle n'a pas eu à servir.** L'échelle au retour est
restée dans la tolérance sur les six planches, à 0,92 comme à 0,62. Ce n'est pas l'hypothèse
validée — elle n'a pas été mise à l'épreuve, faute que le dézoom qu'elle prévient se présente.
Le seul risque de méthode de la V2 tombe donc, et un autre le remplace, mesuré celui-là : **la
différence trouve ce qui s'ajoute et manque ce qui se substitue.** Le casque est revenu en
poussière — même empreinte que la chevelure qu'il remplace, valeurs voisines, et la tolérance
au voisin de 3×3 qui protège du bruit de recalage l'efface avec lui. Et la hache dit les deux
moitiés du défaut à elle seule : son fer, qui dépasse de la silhouette, revient entier au pixel
près ; son manche, là où il croise le bras, ne revient pas. Encore deux décisions justes
séparément dont la composition perd quelque chose. Ce n'est ni cadré ni planifié :
`docs/releve-usage.md`.

**Et la décision de la séance : une planche déjà dépliée ne réaccouche jamais ; ce qu'elle a
calculé se rejoue.** Quatre images fausses restent sur le disque — deux calques figés sur un
mauvais recalage, deux corps habillés prononcés sur une échelle inventée — alors que les
planches qui les ont payées sont là. Redéplier aurait créé des rangs neufs, obligé à supprimer
les anciens, et laissé orphelins les calques qui désignent leur corps par identifiant : c'est un
piège, pas un geste. Ce qui se rejoue est le calcul, sur les assets déjà nés — même
identifiant, même rang, même place. Ce qui l'autorise tient en une phrase qui dépasse le
calque : **le brut d'un calque n'a jamais été l'image payée** ; l'image payée est la planche, et
un brut dérivé est un cache. C'est R5 dans `docs/PLAN.md`.

## C3 — 29 août 2026

**C3 est écrite : la pièce et le calque.** Un projet porte des emplacements ordonnés et des
pièces décrites une fois ; on coche les poses à habiller, l'atelier compose lui-même la
planche des corps existants, l'envoie en un appel, redécoupe le retour sur la grille qu'il a
posée et compare case par case. Chaque différence est un calque, propre à sa pose. **Les
seize critères sont cochés, tenus par 18 essais de serveur et 9 d'écran.**

**Le pliage de C2 a été réemployé sans être rouvert, et c'est ce qui rend la tranche
courte.** La grille, le gabarit, le découpeur, le compte et son refus arithmétique n'ont pas
bougé d'une ligne : `decouper_retour` a simplement été extraite de `deplier`, et les deux
usages l'appellent. Un booléen — `geometrie_connue` — distingue toujours les deux, et une
seule ligne du service de génération aiguille entre « ranger N corps » et « fabriquer N
calques ». La prédiction écrite en C2 s'est vérifiée telle quelle.

**La décision de la tranche : un calque est un asset, et c'est sa recette qui le dit.** Le
cadrage promettait « une recette, pas un fichier figé » ; la conséquence exacte est une
sixième place dans la recette, `différence`, qui nomme l'asset du corps et le masque
rectangle. Trois critères deviennent alors vrais *par construction* au lieu d'être tenus à la
main — le corps n'est jamais modifié, le masque se déplace sans un centime, et vider la zone
rend la différence brute. Il n'existe nulle part un drapeau « ceci est un calque » : un corps
habillé porte la même pièce et la même pose, et seule l'absence de différence l'en sépare.

**Deux pièges payés le même jour, et ils se ressemblent.** Le premier : la plage d'échelles
du recalage ne contenait pas 1,00 — 0,99 puis 1,01 —, donc une case revenue rigoureusement
identique se rééchantillonnait d'un centième et sa silhouette entière ressortait en *ajout*.
Le second : `recadrer_sur` alignait, puis `mesurer_calque` cherchait un **second** alignement
sur le résultat déjà aligné, et le calque affiché n'était plus celui qu'on venait de mesurer.
Les deux fonctions étaient justes ; c'est leur composition qui perdait quelque chose — très
exactement la famille de défaut que T9 avait trouvée en mettant une conception à juger. Tous
deux sont dans `docs/PIEGES.md`.

**Ce que la tranche n'a pas fait, et qu'il faut dire.** Elle n'a pas servi au navigateur, et
elle n'a tiré **aucun appel payant**. La toile avec marge — le seul risque de méthode qui
reste en V2 — est écrite, mesurable et repliable : la toile part à 0,62, l'échelle au retour
est mesurée case par case, et une dérive au-delà de 0,08 rend des corps habillés au lieu de
calques sans qu'aucune image ne soit perdue. Il reste à savoir laquelle des deux branches le
produit prendra, et ça coûte un appel.

*(Écrit à la livraison. La séance est venue le jour même — voir l'entrée en tête : l'appel a été
tiré six fois, la marge n'a pas eu à servir, et un défaut de recalage qu'aucun des vingt-sept
essais ne voyait a été trouvé.)*

## R4 — 29 août 2026

**R4 est écrite, et les quatre reprises sont finies.** L'infobulle sort désormais du panneau
qui porte son ancre, au lieu de choisir son côté par rapport au milieu de la fenêtre. **Les
six critères sont cochés, tenus par 12 essais de placement et 6 d'écran** ; aucun essai de
serveur n'a bougé, parce que rien du serveur n'a bougé.

**La règle d'avant n'était pas approximative, elle était juste au mauvais endroit.** Elle
disait *jamais sur l'image qu'elle règle*, et la mesurait contre le milieu de l'écran. À
l'atelier c'est vrai — l'autre moitié est la grille. À l'univers, aux réglages et dans la
fiche, l'autre moitié est encore du réglage, et le cas le plus net est celui des réglages :
un panneau de 520 px posé au milieu, une ancre dans sa moitié gauche, donc à gauche du milieu
de la fenêtre, donc une bulle qui s'ouvrait **sur le panneau lui-même**.

**Les panneaux se déclarent, l'infobulle ne les connaît pas.** Six panneaux portent une
marque, et le placement remonte de l'ancre au premier ancêtre marqué. L'alternative — une
liste d'écrans tenue dans l'infobulle — aurait fait de ce composant l'endroit qu'il faut
modifier chaque fois qu'un panneau naît ailleurs. Sans marque, le calcul retombe sur l'ancre :
la barre d'outils traverse l'écran, « hors du panneau » n'y voudrait rien dire, et elle garde
la règle d'avant là où elle était juste.

**Le calcul est sorti du composant parce que jsdom ne met rien en page**, et cette fois-ci
c'était décisif et non confortable. Un essai qui monterait l'écran Univers et mesurerait le
recouvrement lirait des rectangles nuls : il passerait avant la correction comme après, et
attesterait d'une règle qu'il ne vérifie pas. `placer()` prend donc des rectangles et rend
une position — le précédent de `Toile.test.tsx`, invoqué pour la même raison. L'écran, lui,
prouve ce que jsdom sait voir : que chaque panneau se déclare. Aucune des deux moitiés ne
suffit, et un essai nomme l'erreur d'avant pour montrer qu'elle tombe.

**Elle a été vue à l'écran, sur les trois cas.** L'univers : la bulle « Bible » couvrait
Palette, Taille de pixel, Barème et Modèle par défaut ; elle s'ouvre maintenant à droite du
panneau, sur le tableau. La fiche : « Détourage » part à gauche, sur la grille. Les réglages :
le panneau mesuré à 373–893, la bulle posée à 903 — dehors, à l'écart près.

**Le prix payé, et il est écrit** : la bulle peut recouvrir *un autre* panneau. Ouverte depuis
les réglages, elle atterrit sur la fiche restée derrière, inerte tant que les réglages sont
ouverts. La règle protège le panneau qu'on est en train de régler ; protéger tout l'écran
demanderait de replier la bulle sous son libellé, et ce n'est pas ce motif-là.

## R3 — 29 août 2026

**R3 est écrite — faire entrer une image depuis l'écran.** Un bouton dans la barre d'outils,
et le glisser-déposer sur la grille. L'image devient un asset entier : retouche, découpe,
export, suppression avec annulation, et sa fiche dit d'où elle vient — importée, coût nul, le
nom du fichier. **Les dix critères sont cochés, tenus par 18 essais de serveur et 5 d'écran.**

**La seule pièce neuve du serveur est une route qui prend les octets**, parce que celle qui
existait prend un *chemin* — ce qu'un navigateur ne donne jamais. Les deux appellent le même
service que l'outil MCP, et il n'y a donc toujours qu'un endroit du produit qui fasse entrer
une image. Les octets voyagent bruts, en corps de requête : la décision de `POST /board/paste`
en T4, reconduite sans la rediscuter — `multipart` demanderait une dépendance d'exécution de
plus pour transporter ce qu'un `POST` transporte déjà.

**Le service a changé de réponse plutôt que de place.** Il rend maintenant *ce qui est entré*
**ou** *ce qui était déjà là* : un doublon n'est pas un refus, donc il ne lève pas. C'est la
forme du collage du tableau, et c'est la leçon de C1 appliquée — *un objet a la même forme sur
toutes les routes qui le portent*, l'outil MCP compris. Cinq essais de T7 et de C1 ont été
repris pour cette raison-là, et c'est le prix juste d'un contrat qui a changé.

**Le défaut est passé à « telle quelle », et il vaut aussi pour l'agent.** Le PRD ne parlait
que de l'écran ; l'étendre à l'agent change son comportement d'avant, et c'est assumé : le
défaut d'hier — hériter de la recette du projet en silence, donc ramener une référence de 2048
pixels à 64 — est très exactement le défaut que la reprise corrige. Un agent qui le garderait
ferait vivre l'auteur et lui dans deux produits différents.

**La décision voyage sur la génération, et un essai le prouve après reconstruction.** L'index
est jetable : ce qui n'est pas dans un `generation.json` n'existe plus à la première évolution
du schéma, et une image entrée telle quelle se retrouverait sinon ramenée sur la grille du
projet un matin, sans que personne l'ait demandé.

**Et elle n'a rien coûté au balayage de palette.** Une recette vide est déjà ce que « Tout
réaligner » laisse tranquille — « un asset ramené au brut reste au brut » (US-64). Une image
entrée telle quelle le reste donc sans qu'aucune règle nouvelle ait eu à le dire : le signe
que la décision est posée au bon endroit.

**Une fonction a déménagé, et c'est le précédent de `teinte.py` qui l'a décidé.** L'empreinte
qui nomme un doublon vivait dans la carte du tableau ; la bibliothèque en a désormais besoin
aussi. Deux familles d'images l'appellent et aucune ne la possède : elle est passée dans
`atelier/image/mesures.py`, où elle ne parle que d'octets.

**L'écran a quand même été ouvert, et il a rendu un défaut qu'aucun essai ne pouvait voir.**
Les commandes d'import prenaient 151 px dans la barre d'outils et poussaient le bloc de gauche
32 px au-delà de sa largeur à 1280 : le cran de zoom 4× sortait de l'écran. La bascule dit
maintenant **brute / traitée** — le vocabulaire que la fiche emploie déjà pour le brut et le
rendu — et le groupe tient en 109 px, débord nul. Une largeur ne se prouve pas dans jsdom, qui
ne met rien en page ; elle se mesure dans un navigateur, ou elle ne se mesure pas.

**La séance d'usage complète n'a pas encore eu lieu**, pour R2 comme pour R3.

## État au 29 août 2026

**R2 est écrite — ce qui décide de l'apparence se voit et se règle.** C'est la plus grosse des
quatre reprises, et la seule qui touche à la fois au prompt, à l'univers et à la fiche. Un
dépliant sous le champ de prompt montre le texte exact qui partira — bible active, sujet,
consignes de planche —, et un geste le bascule en édition libre pour cette génération-là. La
bible passe de cinq champs nommés à sept : la technique de rendu et la vue et cadrage, qui
étaient exactement les deux consignes retapées dans chaque prompt le 28 août. La taille de
pixel accepte « aucune ». Et la fiche dit enfin ce que le projet a imposé à l'image affichée.
**Les treize critères sont cochés, tenus par 20 essais de serveur et 9 d'écran.**

**Le défaut réparé est un défaut de composition, pas de code**, et c'est la troisième fois que
le dépôt en trouve un — après la toile de T9 et le réglage d'univers de R1. « La dérive de
grille est le cas normal, pas l'incident » est juste. « Le style vient de la bible, et d'un
seul endroit » est juste. Ensemble, elles produisaient un atelier qui **imposait une apparence
que l'auteur n'avait jamais posée** : la séance du 28 août l'a mesuré sur trois projets réels
— les cinq champs de bible vides dans les trois, donc rien du style ne partait, et pourtant
tout ressortait en pixel art de 64 pixels. Aucun test ne pouvait le voir : les deux moitiés
faisaient exactement ce qu'on leur demandait.

**Un seul endroit compose le prompt, et l'aperçu emprunte ce chemin-là.** C'était la décision
de conception de la tranche, et elle a coûté un aller-retour local par frappe — atténué de
140 ms, sans réseau, sans écriture. L'alternative aurait été de recomposer à l'écran : deux
compositions qui divergent au premier champ ajouté, et celle qu'on regarde n'est pas celle qui
part. L'essai qui le tient ne compare pas l'aperçu à lui-même mais **à ce que le fournisseur a
reçu** — un aperçu vérifié contre sa propre logique ne prouverait que sa propre logique.

**Elle a réparé un défaut que personne n'avait signalé.** « Reprendre les réglages » d'un asset
reposait dans le champ de l'atelier le prompt **déjà habillé** — bible comprise —, que l'atelier
rhabillait ensuite : la bible partait en double, à chaque reprise, depuis T4. Le geste rend
désormais la main à l'auteur en mode repris, donc ce qui repart est exactement ce qui était
parti. Personne ne l'aurait trouvé sans écrire le mode repris : il fallait que les deux
chemins existent pour que leur composition devienne visible.

**« Aucune » est une valeur, pas un réglage éteint**, et le dire ainsi a décidé du code : zéro
est traité **à part** du contrôle de bornes plutôt qu'en élargissant le minimum, sans quoi 1, 2
et 4 pixels seraient passés. Sans cible, la grille **disparaît** de la recette au lieu de valoir
zéro — un asset ne doit pas porter une remise sur grille que le projet n'impose plus —, et
« Tout réaligner » la retire donc au lieu d'en poser une, en le disant avec son compte.

**Et ce que le projet impose se calcule, il ne se range pas.** La fiche demande « qu'est-ce que
le projet impose *maintenant* » : une valeur enregistrée à la naissance aurait vieilli au premier
réglage d'univers, et la fiche aurait comparé l'image à un souvenir. C'est une route à part de
l'asset, parce que la grille en affiche deux cents à la fois pour une phrase que seule la fiche
montre — le même raisonnement que la réserve de T8, un cran plus bas.

**La séance d'usage au navigateur n'a pas encore eu lieu**, et la règle du dépôt tient : *une
tranche n'est finie que lorsqu'on s'en est servi*.

## État au 28 août 2026

La chaîne de cadrage est finie — PRD, architecture, design, plan — et **le code a
commencé**. `docs/PLAN.md` fait foi sur ce qui reste.

**T1, T2, T3, T4, T5 et T6 sont finies.** T1 : le squelette, la clé, le catalogue relu au
démarrage, un appel qui rend une image téléchargeable ; l'écran Atelier ; le flux
d'événements qui remplace le sondage, la jauge déterminée, la reprise vue du navigateur et
le repli hors ligne. T2 : l'asset, la recette, le rendu-cache, le détourage en plusieurs
passes, la remise sur grille, la quantification grisée, les recettes nommées, et la fiche.
T3 : la bibliothèque — projets et collections, une seule grille filtrable et cherchable, la
sélection multiple, le favori, la suppression avec son annulation courte, la filiation, le
journal des appels ratés, la réinjection dans ses quatre rôles, et l'index reconstructible.
T4 : le tableau d'inspiration et l'univers — coller une image, une adresse ou un texte,
promouvoir en artwork officiel par famille, la palette extraite par calcul, la bible en
champs nommés, le barème d'échelles, la taille de pixel imposée, la quantification allumée,
et la palette rétroactive. T5 : le slicer — les zones opaques connexes, la grille fixe, les
rectangles dessinés à la main, la filiation de découpe ; **plus les deux dettes reportées**,
le zoom de la grille et la première exécution du second moteur de détourage. T6 : l'export —
une sélection qui sort en archive avec son descriptif, et le grisé permanent qui dit
pourquoi quand rien n'est sélectionné. **Les soixante et onze critères d'acceptation de T1 à
T6 sont cochés dans `docs/PLAN.md`, et 120 tests de serveur plus 31 d'écran les tenaient.**

**T7 est finie, et la V1 avec elle.** Le MCP : onze outils épais, façade sur les services que
l'écran appelle déjà, montés dans le **même processus** que l'API sur `/mcp` ; les deux
garde-fous relus à chaque appel — plafond de la séance, modèle d'exploration imposé — ; le
dossier du jeu et ses trois règles ; la provenance portée par la génération et héritée par
l'asset ; et l'écran Réglages qui tient enfin les trois questions promises depuis T1 — clé,
garde-fous, dossiers. **Les quatre-vingt-quatre critères d'acceptation de T1 à T7 sont cochés
dans `docs/PLAN.md`, et 145 tests de serveur plus 35 d'écran les tiennent.**

**Ce qui vient après n'est plus la V1, et T8, T9 et T10 sont finies.** T8 : le tableau
d'inspiration a sa seconde vue — un plan qu'on déplace et qu'on zoome, des îlots nommés, une
réserve à droite. T9 : ce que T8 permet de ranger, T9 permet de le **dire** — un trait d'un objet à
un autre, une note posée à même la toile, et six teintes sourdes. T10 : deux décisions de T8 que
l'usage a démenties — un îlot se **déplace** par la bande de son titre, avec ce qu'il contient, et
un îlot que le geste en cours ferait disparaître le dit en `--echec` pendant qu'on le fait. **Les
cent quinze critères d'acceptation de T1 à T10 sont cochés dans `docs/PLAN.md`, et 195 tests de
serveur plus 80 d'écran les tiennent.** Le plan n'a plus de tranche ouverte.

**C2 est écrite — le lot plié.** On coche des attitudes, elles partent en **un seul appel**, et
la planche se déplie toute seule en autant d'images de corps qu'il y avait de cases. Neuf poses
coûtent un appel au lieu de neuf, et le journal du projet le montre. Si le compte ne tombe pas
juste, **rien n'entre** et le lot se relance d'un geste, au prix plein — c'est le seul refus
automatique du produit, et il est arithmétique. Ressemblance entre cases et dérive de grille
s'affichent case par case et n'empêchent jamais de garder. **Les douze critères sont cochés,
tenus par 34 essais de serveur et 6 d'écran** ; la séance d'usage au navigateur, elle, n'a pas
encore eu lieu, et la règle du dépôt tient — *une tranche n'est finie que lorsqu'on s'en est
servi*.

**Le pliage n'a pas été écrit pour les personnages, et c'est la décision de la tranche.** Il vit
dans un module pur et un service qui ne connaissent ni personnage ni pose : ils parlent de
*cases*, et c'est le service de génération — le seul qui sache déjà relier un appel à une case
— qui les compose. C3 le réemploiera tel quel pour la planche d'équipement, sans le rouvrir.

**Il a été éprouvé sur les vingt-quatre planches réelles du 28 août avant qu'une ligne de
service soit écrite**, et il y trouve exactement le compte que le banc avait mesuré — zéro écart
sur vingt-quatre. C'est l'antidote direct au piège de C1 : *un double écrit d'après l'intention
prouve l'intention, pas le serveur*. Le même passage a donné ce que le produit affiche sans
inventer de seuil — les deux planches qui répétaient une pose ressortent à 0,999 et 1,000, les
vingt-deux autres plafonnent à 0,897.

**Trois choses ont été tranchées en écrivant, et elles se paient toutes de la même façon** : la
planche payée n'est **pas** un asset — elle reste le brut de sa génération, donc « aucune feuille
assemblée n'est livrable » est vrai par construction et non par un filtre —, le gabarit ne
s'enregistre nulle part mais compte comme une référence, et un compte faux est un emplacement
échoué, ce qui rend la relance de T1 applicable telle quelle sans inventer d'état. Le prix des
trois est écrit dans `docs/PLAN.md` : les N corps n'ont pas de parent, on ne voit pas ce qui
revient quand le compte tombe faux, et un lot refusé n'est relançable que dans l'onglet qui l'a
vu échouer.

**Et la privation de C1 a tenu.** La matrice gagne une case à cocher par rangée, et elle
n'offre toujours pas de sélection multiple : ce qui se coche est une **attitude**, pas une
image. Un essai d'écran confronte l'intitulé de chaque coche à sa forme et tombe le jour où
l'une passera sur une vignette.

**C1 est finie, et la V2 a commencé.** Le personnage, son plan, une pose, et ce qui part avec
elle. Un jeu porte **une** liste d'attitudes — repos, marche, mort —, écrite une fois et déjà
là au premier lancement ; chaque personnage coche celles qu'il tient, se décrit une fois, et
sa matrice dit d'un coup d'œil ce qui est fait et ce qui manque. On arme une pose depuis une
case vide, on paie depuis l'atelier. Une carte du tableau se désigne concept art et **reste où
elle est** ; avant de lancer, chaque référence se lit ligne par ligne avec sa provenance, et
se décoche pour cette génération, pour ce personnage, ou pour tout le projet. Et n'importe
quelle fiche nomme enfin le modèle qui a produit son image. **Les cent trente-trois critères
d'acceptation de T1 à C1 sont cochés dans `docs/PLAN.md`, et 233 tests de serveur plus 105
d'écran les tiennent.**

**Quatre décisions de construction, et trois défauts trouvés en s'en servant.** Les décisions
sont dans `docs/PLAN.md` § C1 et `docs/archi-versions.md` §7 : un seul plan par projet, le
personnage qui range **ce qu'il écarte**, la case déduite des images plutôt qu'enregistrée, et
le coût annoncé **mesuré** au lieu d'être lu dans un tarif que le produit ne porte pas.

Les défauts, eux, viennent tous de la même racine, et c'est une racine neuve : **un objet qui
voyage par deux routes doit avoir la même forme sur les deux.** Le personnage porte des cases
*déduites*, et seul le tableau de bord les mettait dans sa charge — la réponse du `PUT` et
l'annonce du flux rendaient le même objet sans elles. Or l'écran fond ce qu'il reçoit par les
deux chemins avec le même code, depuis T1 : écrire une description remplaçait donc un
personnage entier par un personnage à trous, la matrice se vidait, et le rendu suivant tombait
sur un écran blanc. **La fonte par identifiant ne protège que de l'empilement** ; elle suppose
que les deux chemins portent la même chose, et personne ne l'avait écrit. Le même défaut vu de
l'autre bout : élargir la portée d'un décochage écrivait bien sur le disque, mais rien ne
redemandait ce qui part. Et le troisième était une **copie périmée** — la case visée gardait
l'objet du moment où on l'avait armée ; elle ne garde plus qu'un identifiant.

**Ce qui les avait rendus invisibles mérite d'être écrit** : le double des essais d'écran, lui,
rendait la forme entière. Je l'avais composé en sachant ce que le serveur *devait* faire, et
les 105 essais passaient donc au vert sur un contrat que personne ne tenait. *Un double écrit
d'après l'intention prouve l'intention, pas le serveur.* Les trois sont dans `docs/PIEGES.md`.

**Et écrire le motif d'écran a corrigé le code une quatrième fois, puis deux.** Le nom d'un
personnage était en serif 24 px dans un champ, ce que la règle 1 du § Typography interdit en
deux mots ; l'état vide de la colonne de droite répétait en mono l'explication déjà posée à
gauche ; et un commentaire promettait un bouton grisé que le code, avec raison, ne posait pas.
Trois riens — mais chacun n'a été vu qu'en écrivant *pourquoi c'est comme ça*, ce qui est
exactement à quoi sert `docs/design-motifs.md`. La section « L'écran Personnages » les porte.

**T10 a été utilisée pour de vrai, et ça a trouvé quatre défauts.** Huitième fois de suite, et trois
des quatre de la même racine : *une surface que le produit tient à la main, et qui n'avait pas dit à
la librairie de plan qu'elle lui appartenait*. Tirer un îlot par sa bande déplaçait l'îlot **et** le
plan du même écart — l'îlot à deux fois la main, le fond à une fois, c'est-à-dire une **parallaxe**
sur la seule surface du produit dont tout le propos est de savoir où sont les cartes. La poignée de
largeur, le menu de teintes et le champ d'une note avaient le même trou, et `nodrag` était là, qui
paraissait suffire. S'y ajoutait le déplacement automatique de la librairie dès qu'un nœud tiré passe
à moins de 40 px d'un bord, la réserve étant collée au bord droit. Le quatrième est ailleurs : le
menu de teintes d'un îlot était **inatteignable à la souris**, le pointeur qui montait vers lui
quittant la bande, seule surface qui le tenait ouvert. `docs/PLAN.md` § T10 dit pour chacun ce qui
l'avait rendu invisible.

**Un îlot se déplace, et ça ne fait pas de lui un objet.** Il n'a toujours ni identité, ni fichier,
ni position à lui : le déplacer, c'est écrire la place de chacune de ses cartes, en **un seul
appel** (`PUT /api/board/groups/move`). Un appel par carte rendrait possible l'état où sept ont
bougé et cinq sont restées — c'est « deux appels pour un geste sont un état de trop » appliqué à un
geste qui en aurait demandé douze. La route exige donc **toutes** les places de l'îlot et rien
d'autre, les vérifie avant d'écrire la première, et ne reclasse rien : déplacer un rangement, ce
n'est pas ranger ce qu'il contient.

**Un lien est le seul objet neuf du modèle depuis T4, et il naît muet.** Ni mot, ni pointe : un
trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — *le défaut est muet,
l'exception s'exprime*. Une extrémité est une carte par identifiant **ou** un îlot par nom de
groupe, et le couple `(genre, valeur)` existe parce que les deux ne se nomment pas dans le même
espace. Il ne survit pas à ses extrémités, et c'est la **suppression** qui l'emporte, jamais un
balayage : un trait vers rien ne représente rien, et une entrée morte sur le disque serait une
deuxième vérité qui attend son heure.

**La teinte d'un îlot vit sur le projet, jamais dans son univers ni sur ses cartes.** Sur ses
cartes, six membres feraient six vérités possibles pour un seul cadre. Dans `Univers` — « ce que le
projet impose à ce qui rentre, et ce qu'il envoie avec » —, elle aurait été le premier champ à
démentir cette phrase : une teinte n'impose rien et ne part nulle part. Une **note**, elle, *est* un
objet et porte la sienne. Une carte image n'en porte aucune, et c'est un critère : colorier chaque
carte reconstruirait un second rangement, concurrent du groupe.

**Une revue adversariale a suivi la tranche, et elle a trouvé quatre défauts de plus.** Vingt-quatre
trouvailles sur cinq lentilles, chacune soumise à **trois sceptiques chargés de la réfuter** ; six
ont survécu, dont quatre disaient la même chose. La plus utile ne portait pas sur le produit mais
sur ce qui est censé le garder : *un essai passait pour une autre raison que celle qu'il annonçait*
— la borne du mot d'un lien était éprouvée sur une paire déjà jointe, donc le refus rendu était
« ces deux-là sont déjà joints », et l'essai aurait passé même si la borne n'existait pas. **Une
assertion négative ne prouve rien**, encore, et cette fois-ci sur nos propres essais.

**T9 a été conçue par un panneau avant d'être écrite, et ça a trouvé le défaut le plus grave.**
Trois conceptions indépendantes des quatre gestes ouverts, trois juges — les documents, l'usage, les
pannes —, et le verdict a nommé un état que ni le serveur ni l'écran n'auraient signalé : *sortir la
dernière carte d'un îlot efface ses liens et sa teinte, et Ctrl+Z ne rendait que le groupe*. Chacun
des deux gestes est correct isolément ; c'est leur composition qui perdait quelque chose, en
silence. Première fois que ce dépôt fait ça, et à refaire.

**La toile ajoute deux champs à la carte, et pas une entité.** `position` et `largeur_libre`
sont portées par la carte elle-même — un `toile.json` par projet aurait la panne qui a déjà
valu son refus à `cartes.json`, et sur une toile ce n'est plus une hypothèse mais le régime
normal. Elles s'écrivent par la route qui portait déjà le groupe : tirer une carte dans un
îlot écrit sa place **et** son groupe, et deux appels rendraient possible l'état où l'un est
écrit et l'autre non — la divergence que toute la tranche est là pour empêcher.

**Un îlot n'est écrit nulle part : il est l'étendue de ses membres.** Un îlot *est* le
groupe, donc il n'a ni identité, ni fichier, ni position à lui, et l'écran le calcule à
chaque rendu. Il n'existe aucun état où la toile montrerait un rangement que le disque ne dit
pas, et un îlot vide n'existe pas faute de quoi l'écrire. `docs/archi-versions.md` §6.5
annonçait `parentId` + `extent: "parent"` : ce mécanisme *enferme* un enfant dans son parent,
donc il interdit très exactement « sortir une carte de son îlot ». Le document a été corrigé.

**T8 a été utilisée pour de vrai, et ça a trouvé cinq défauts.** Septième fois de suite.
Trois de la famille qui revient depuis T5 — *une règle déléguée à autre chose, dont personne
n'a mesuré le résultat* — dont deux fois le même `ResizeObserver` : la librairie de plan
cache un nœud dont elle ignore la taille, et elle l'apprend par lui, si bien que **toute la
toile était invisible dans un onglet d'arrière-plan** ; et son cadrage d'ouverture renonçait
en silence pour la même raison. Deux d'une famille neuve — *un garde juste dont l'hypothèse
est fausse* : Ctrl+Z n'annulait rien parce qu'il voyait un champ de saisie actif, celui du
prompt de l'atelier, resté focalisé **derrière** l'écran Univers qui le couvre. Le tableau
de `docs/PLAN.md` § T8 dit pour chacun ce qui l'avait rendu invisible.

**Le produit a été utilisé pour de vrai à chaque fin de tranche, et c'est ce qui a trouvé
presque tous les défauts.** T9 : six, dont cinq en s'en servant — et **le sixième, le plus grave,
trouvé avant la première ligne de code** par un panneau de conceptions mises à juger l'une contre
l'autre. C'est le seul de toute l'histoire du dépôt qu'aucun essai n'aurait pu voir *ni* aucune
séance : les deux gestes qui le composent sont corrects isolément. T8 : cinq de plus, dont trois
qu'aucun essai d'écran ne pouvait voir —
jsdom ne met rien en page, donc un nœud caché par la librairie y est rendu comme un nœud
visible. T1 : l'écran doublait chaque génération lancée depuis l'onglet. T3 :
cinq de plus, dont deux venaient de la même racine — deux vérités sur la même chose
finissent par diverger. T4 : deux, dont un compte de références qui ne se remettait pas à
jour quand on promouvait un artwork. T5 : trois, tous de mise en page, dont deux de la même
famille — **une règle déléguée au navigateur dont personne n'a mesuré le résultat**. T6 :
deux, de cette même famille, et **tous les deux antérieurs à la tranche qui les a trouvés**.
**Aucun test de serveur ne pouvait les voir**, et les tableaux de `docs/PLAN.md` § T3, § T4,
§ T5 et § T6 disent pour chacun ce qui l'avait rendu invisible. C'est désormais une règle du
dépôt : **une tranche n'est finie que lorsqu'on s'en est servi.**

**Une planche se découpe, et chaque morceau est un asset entier.** Le serveur *propose* des
rectangles — zones opaques connexes, ou grille fixe —, l'auteur corrige, et ce qui part à la
découpe est **sa** liste. Chaque découpe possède ses propres octets bruts, hérite de la
recette de sa planche et pointe vers elle par sa filiation. Elle possède ses octets pour une
raison précise, et ça se paie en disque : **supprimer la planche doit laisser ses découpes
en place**, or la suppression définitive efface `<rang>-*`, brut compris.

**Et ça a été vérifié sur une vraie planche, payée** (`essais/essai_decoupe_planche.py`,
$0,0042) : huit personnages demandés à `gpt-image-2` en 16:9, huit zones trouvées — ni sept
ni neuf —, dans l'ordre de lecture, chacune devenue un asset de 64 px détouré et filié. Ce
qui manquait aux tests, c'était exactement ça : **une planche que personne n'avait disposée
pour la détection**. Corollaire observé, qui n'est pas un défaut : une planche naît
**habillée comme un sprite**, donc sa tuile montre huit personnages écrasés dans 64 × 64 —
c'est le brut qui se découpe, et rien dans la grille ne dit qu'une image est une planche
avant qu'on ouvre sa fiche.

**Une sélection sort de l'atelier, et elle emporte de quoi se relire.** Une archive, un
`descriptif.json` à sa racine, et rien d'autre : pour chaque image, son label, le prompt et
les réglages résolus de l'appel qui l'a produite, les dimensions **mesurées sur le fichier
qui part**, sa filiation, et sa recette avec son empreinte. Ce qui part est le **rendu** —
celui qu'on voit, celui qui entre dans le jeu —, jamais le brut, qui reste ici : c'est lui
qui permet de refaire le rendu, et le descriptif dit lequel il est. Corollaire assumé : un
asset qu'on n'a pas traité sort tel qu'il est arrivé, donc en 1024 px à côté de sprites de
64 — c'est la même phrase appliquée jusqu'au bout, et le descriptif porte les deux
dimensions.

**L'écran tient ses quatre colonnes.** `docs/DESIGN.md` § Layout donne
`240px · 300px · 1fr · 380px` — arbre · réglages · prompt+grille · fiche. Les trois
premières sont permanentes et repliables **par choix** ; la quatrième s'ouvre avec la
sélection d'une image et se referme sur la position, le filtre et le prompt d'avant.

**La grille est faite d'assets, et le chantier y tient sa place.** Un emplacement qui n'a
pas encore donné son asset occupe la case sous **la même clé** — `<génération>-<rang>`,
l'identifiant que l'asset portera —, si bien que l'image ne se glisse pas à côté de son
attente : elle la remplace. Un échec occupe sa place tant qu'on le regarde, mais il ne
s'installe pas : la bibliothèque relue ne le contient pas, et le journal du projet garde
l'appel avec son coût réel.

**La palette se lit sur le sujet, jamais sur le fond.** La coupe médiane appliquée aux
artworks tels quels rend vingt gris sur vingt-quatre : le fond plat occupe 75 % des pixels
et son anti-crénelage l'éclate en autant de seaux. `atelier/image/palette.py` détoure donc
d'abord, avec le moteur du geste courant, et la palette passe à quinze couleurs franchement
distinctes. *Ce qui est majoritaire n'est pas ce qui compte* — la même phrase que pour le
détourage au seuil global.

**L'univers est porté par le projet, et il contraint.** Bible en cinq champs nommés,
chacun activable ; barème d'échelles, où une nature de sujet porte **sa famille et son
occupation à la fois** — c'est ce qui garde un seul contrôle au moment de générer ; taille
de pixel imposée à tout ce qui rentre ; modèle par défaut **par famille** ; et la palette,
qui est un cache nommé par l'empreinte des artworks qui l'ont produite. Un univers vide ne
contraint rien : c'est un état, pas une configuration manquante.

**Deux risques ont été levés, aucun n'a coûté un centime.** « La couverture image
d'OpenRouter » (`essais/essai_couverture.py`) : 48 modèles image, 11 fournisseurs, 31
acceptent assez de références pour un univers. « La qualité pixel art directe »
(`essais/essai_pixel.py`) : sur 44 images de six modèles, **aucune sortie brute n'a de
transparence**, la médiane est à 33 986 couleurs, et la grille rendue va de 7 à 20 px —
facteur 2 à l'intérieur d'un même lot. Après traitement : 27 couleurs, alpha franc, grille
imposée, 0 sujet perdu sur 44, 0,17 s par image. **La question s'est retournée** : le
post-traitement n'est pas un supplément qui doit prouver son apport, c'est ce sans quoi
rien n'est utilisable.

**Le détourage par défaut n'a besoin d'aucun modèle.** Un remplissage depuis le bord — un
pixel n'est du fond que s'il est *relié au bord* par une chaîne de pixels proches de la
couleur de bordure — rend une silhouette propre sur les 44 images, squelette blanc sur fond
gris clair et fioles translucides compris. `rembg` reste un **second** moteur, facultatif
(`uv pip install -e ".[detourage]"`), grisé avec sa raison quand il n'est pas là. Le geste
courant ne charge rien, ne télécharge rien, et marche hors ligne.

**Ce chemin-là a été exécuté le 27 août 2026, et il a retourné une décision.**
`essais/essai_detourage_modele.py` compare les deux moteurs sur six vraies images plus un
cas composé. Sur ce que le produit fabrique — fond plat —, les deux **s'accordent à 96,3 %**
en médiane : le second n'apporte rien, et c'est ce qui justifie qu'il reste facultatif. Sur
un fond chargé, le bord garde **100 %** de l'image — il échoue entièrement — quand le modèle
en isole 19,8 % : c'est sa raison d'être, et elle se mesure. Il coûte 482 ms contre 147.
**Le modèle est nommé, jamais laissé au défaut de la bibliothèque** : le défaut de `rembg`
2.0.81 est `bria-rmbg`, un gigaoctet qui met 15,8 s par image de 1024 px sur processeur,
là où `u2net` met 0,47 s pour deux points d'écart. Le « ~180 Mo » écrit ici depuis T2 était
la taille d'`u2net`, et le défaut avait changé sous cette note.

**Deux choses ont rendu l'exécution possible, et elles se disent.** `raison_moteur` cherche
désormais le paquet avec `find_spec` au lieu de l'importer : demander « faut-il griser ce
bouton ? » ne charge plus `onnxruntime`, et `tests/test_t2.py` — qui vérifie qu'aucune
bibliothèque d'inférence n'entre dans `sys.modules` pendant une retouche — tient sur une
machine où le second moteur est installé. Et le test qui le concerne a désormais un
symétrique : l'un vaut quand le moteur manque, l'autre quand il est là, et il y en a
toujours exactement un des deux qui travaille.

**L'interface ne redemande plus rien, et elle se branche une seule fois.** Un abonnement
par onglet, pour toute sa vie : ni le filtre, ni le projet ouvert, ni les proportions, ni
l'écran Univers ne le font se rebrancher. Les seuls appels qu'elle refait d'elle-même sont
le catalogue — parce que le grisé de chaque modèle dépend de la demande en cours —, la
grille quand un filtre change, et le tableau quand le projet ouvert change, parce que c'est
le serveur qui filtre et que le tableau appartient à son projet.

**Et « la demande en cours » a grandi en T4** : elle porte désormais les artworks que
l'application ajoute seule. Promouvoir une carte change donc ce qui partira sans que
l'écran ait touché un réglage — d'où le catalogue redemandé sur l'événement `univers`.
C'est le défaut trouvé en ouvrant l'atelier le 27 août : **une règle juste dont l'hypothèse
a changé sous elle**.

**Un agent fait exactement ce que l'écran fait, et rien de plus.** Onze outils, aucun geste
propre : ça se lit dans les **imports** d'`atelier/mcp/serveur.py` — ni fournisseur, ni base,
ni disque —, et un essai le garde. Le seul geste que les services ne savaient pas faire était
« faire entrer un fichier local » : il a été écrit dans `services/`, avec sa route HTTP, pas
dans le MCP. Un import passe par une **génération** — modèle `import`, coût nul — parce que la
bibliothèque se reconstruit en parcourant les `generation.json` : sans le sien, un asset
importé disparaîtrait à la première évolution du schéma.

**La consommation de l'agent se lit sur les générations, elle ne se tient pas en double.** Le
chiffre du refus opposé à l'agent et celui que l'auteur lit pour relever le plafond sont le
**même calcul** — deux compteurs auraient fini par se contredire au moment précis où l'on
cherche à comprendre. Le coût des appels **ratés** y est compris : c'est justement celui-là
qu'on cherche. « Par séance » veut dire depuis l'ouverture de l'atelier, et le remettre à zéro
est un geste déjà connu — fermer la fenêtre.

**T7 a été branché pour de vrai, et ça a trouvé trois défauts.** Sixième fois de suite.
**Aucun agent ne pouvait se brancher** : `POST /mcp` répondait 405, parce que le montage et le
SDK posaient chacun leur préfixe — l'adresse réelle était `/mcp/mcp`. Corrigé, `/mcp`
répondait *encore* 405 : un montage Starlette ne reconnaît que `/mcp/…`, et le chemin exact
tombait chez les fichiers statiques. Et `localhost` était refusé en 421 par la protection
contre le réattachement DNS, dont le défaut n'autorise qu'`127.0.0.1`. **L'essai qui aurait dû
les voir vérifiait « ni 404, ni page d'accueil »** — or 405 n'est ni l'un ni l'autre : *une
assertion négative ne prouve rien d'un protocole*. Il ouvre désormais une vraie session et
vérifie les deux écritures de l'adresse.

**Le produit s'explique lui-même, et le corpus a été regardé à l'œil.** 46 entrées à l'époque, quatre
écrans, deux rendus — le panneau de 280 px et l'écran Guide —, un seul manque déclaré, et
c'est le guide qui le tient. La revue de l'atelier lancé a mesuré **trente poignées sur les
quatre écrans** et trouvé un défaut de la famille habituelle : « Proportions » réagissait
208 px à droite de son mot quand « Modèle », dans le même panneau, ne réagissait que sur les
siens — un `<span>` blockifié par son parent flexible et étiré par une colonne. Corrigé sur
le gabarit, remesuré à zéro partout. Et le guide a rendu un second écart, dans l'autre sens :
sa colonne de prose fait **468 px et 72 signes**, pas les « 504 px / 74 signes » que
`docs/DESIGN.md` annonçait — l'écran avait raison, le document a été corrigé. Les deux sont
dans `docs/PIEGES.md`.
