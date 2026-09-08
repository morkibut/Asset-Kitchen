# Architecture — §5, le modèle d'objets

> Descendu de `docs/ARCHITECTURE.md` le 6 septembre 2026, **sans qu'un mot change**. La
> section pesait **28 %** du document.
>
> On l'ouvre **avant de toucher à un objet du domaine** — ce qu'il porte, ce qui le nomme, ce
> qui le lie aux autres. ⚠️ **La V4 en modifie quatre** : la pièce d'équipement déclare qui la
> porte, la collection devient un groupe libre de sujets, la bande se range comme une image,
> le clip entre en bibliothèque (`docs/PLAN-carnet.md`).
>
> **Et `B20` a ajouté un champ à la bande, le 10 septembre 2026** : son **habillage** — la
> pièce qu'elle porte, la façon dont le calque suit (*il tient*, recalé image par image, ou *il
> glisse*, un seul calage pour toute la bande), et le calage posé à la main quand il y en a un.
> Une bande sans habillage est le corps nu, et c'est le cas de toutes celles d'avant. ⚠️ **Ce
> n'est pas une entité de plus** : une bande habillée est une bande, exactement comme un calque
> rendu est un asset — et l'invariant de `C3` tient sans exception, *un calque reste solidaire
> de sa pose*. La direction est portée par la bande, jamais par le calque, si bien qu'habiller
> les quatre bandes d'une pose relit le même calque quatre fois.

## 5 · Modèle d'objets

| Entité | Contenu | Note |
|---|---|---|
| **Projet** *(= l'univers)* | nom, bible (sept champs nommés), planches de référence, palette extraite, réglages par défaut — dont la taille de pixel, qui accepte « aucune » —, **la vue du jeu**, **la liste de ses directions** | Chez SpriteCook le projet est un dossier. Ici il **contraint** — c'est la différence centrale. La **vue** et les **directions** sont arrivées en V2.1 : on choisit la vue une fois, les directions s'en déduisent, et elles décident du nombre de cases d'une pose — voir plus bas. |
| **Collection** | nom, projet optionnel, **ses membres** | Rangement à plat. Une collection qui appartient à un projet **décide** du projet de ce qu'on y range ; une collection sans projet traverse les univers. **Un membre est un couple `(jeu, sujet)`**, jamais un identifiant seul : les identifiants de sujet sont uniques *par jeu*, et une collection sans jeu en traverse plusieurs — un identifiant nu y ferait entrer l'homonyme d'un autre univers. **Une collection qui appartient à un jeu accueille quand même le sujet d'un autre** — tranché le 6 septembre 2026 : ranger un sujet ne le déplace pas d'univers, donc rien à trancher et rien à refuser ; le prix est qu'un compte de sujets doit toujours dire de quel jeu il parle. **L'adhésion est écrite sur la collection, pas sur le sujet** : supprimer une collection réécrit un fichier et ne touche aucun sujet, là où l'autre sens aurait demandé un balayage capable de réussir à moitié. Un sujet appartient à **plusieurs** collections. *Arrivé en `B8.1`, le 6 septembre 2026 ; jusque-là c'était l'**image** qui portait sa collection, zéro ou une, et cette colonne s'en va en `B8.4`.* |
| **Carte** *(tableau d'inspiration)* | type (image \| texte), contenu, groupe, note, provenance (URL, date), taille d'affichage, **position sur la toile**, **largeur libre**, **teinte** (une note seulement), **artwork officiel** oui/non, **famille** (personnages \| objets \| décors \| interface \| tous) | Deuxième famille d'images du produit. Ne s'exporte jamais, ne compte pas dans la bibliothèque. La **famille** décide de ce qui part en référence — voir §6.1. La **position** et la **largeur libre** sont arrivées en T8 : elles portent la place de la carte sur la toile, et ne se confondent pas avec la taille d'affichage — voir plus bas. |
| **Asset** | fichier(s), label, prompt, réglages résolus, dimensions mesurées, type, projet, collection, parent (filiation), favori, **ce qu'il a consommé et dans quelle unité**, date de suppression, **direction** | Les dimensions **mesurées** font foi, jamais celles demandées. Ce qu'il a **consommé** est une copie prise à la naissance, pour la tuile ; la génération reste la vérité, elle seule connaît les appels ratés. L'**unité** est arrivée en F2 : sans elle, une image faite chez un fournisseur qui ne facture pas afficherait `$0,0000`, qui se lit *sans limite* là où il faut lire *sans prix*. Le coût en argent s'en **déduit**, il ne s'enregistre pas. La **date de suppression** dure le temps de l'annulation, puis les fichiers partent. La **direction** est arrivée en V2.1 et elle est vide pour tout ce qui n'en a pas — une icône, un décor, une tuile. |
| **Génération** | statut, avancement, paramètres résolus, **ce que l'appel a consommé et dans quelle unité**, résultats, réinjections, **prompt tel qu'il est parti** et s'il a été repris à la main, **direction**, **ce qui a été pris de l'ambiance**. Pour un import : le nom du fichier, l'empreinte de ses octets, et si le traitement du projet lui a été appliqué | Un enregistrement par appel, y compris ceux qui échouent. Une **réinjection** est un identifiant d'asset et son rôle — jamais des octets : ils se relisent depuis l'asset au moment de l'appel, et de la relance. Le rôle `edition` donne sa filiation à ce qui sort. *Ce qui a été pris de l'ambiance* est **le nom du lot de style et la liste de ce qu'il a réellement donné** — parmi les couleurs, les images et les textes : sans lui, « ce qui est montré est ce qui part » cesserait d'être vrai en relisant une vieille image. Écrit en faisant E14 : trois oui/non étaient prévus, un nom et une liste ont été posés, parce qu'un lot retouché après coup ne se reconnaît plus sans son nom. |
| **Lien** *(toile)* | ses deux extrémités, son mot, sa pointe | Ajouté en T9, et **le seul objet neuf du modèle depuis T4**. Le mot et la pointe naissent vides : un trait nu dit déjà « ceci a rapport avec cela », et c'est le cas courant — le défaut est muet, l'exception s'exprime. Une extrémité est soit une carte, par identifiant, soit un îlot, par nom de groupe : l'îlot n'a pas d'identité propre (voir plus bas). Un lien ne survit pas à ses extrémités. |

Ce tableau tient le modèle de la V1. **Les cinq entités de la V2** — plan de poses,
personnage, emplacement, pièce, calque — sont décrites en §7, et aucune ne modifie une
ligne ci-dessus : elles s'ajoutent, et le corps comme le calque rendu restent des assets
ordinaires. **Les quatre entités de la V2.1** — étiquette, palette, direction, ambiance —
sont décrites plus bas, avec les champs qui les accompagnent.

**La V2.2 en a posé deux de plus**, et elles sont décrites dans `docs/archi-fournisseur.md` :
le **fournisseur** — son nom, l'état de ses identifiants, la date de sa dernière photo de
catalogue, et d'où viennent les fiches de ses modèles — et sa **réserve** — ce qui reste, dans
quelle unité, quand ça revient, et **si le chiffre est lu chez lui ou compté ici**. Elles
n'ajoutent que deux champs à ce qui existe : le nom du fournisseur sur la génération et sur
l'asset, et ce que l'appel a consommé avec son unité.

> **Ce que les versions poseront, écrit d'avance pour qu'aucune ne le découvre en route.** La
> **V2.3** ne pose aucune entité neuve — elle répare : la recette par défaut cesse
> d'être unique et se range **par nature d'image** comme le modèle par défaut se range déjà par
> famille, et le **fond de génération** devient un champ de l'univers. ✅ *Close le 3 septembre
> 2026, et la prévision a tenu mot pour mot : `Univers.fond` est un champ, et le seul module
> neuf — `atelier/domaine/fond.py` — est du vocabulaire partagé, comme `domaine/teinte.py`, pas
> une chose rangée.* La **V3** en pose cinq, et
> c'est beaucoup : la **planche** cesse d'être le brut jetable de sa génération pour devenir un
> objet visible et gardé ; le **dépliage** est neuf et c'est lui qui porte la filiation, parce
> qu'une planche se déplie plusieurs fois et qu'une génération seule ne distingue pas deux
> dépliages ; la **bande** — un mouvement, une direction, des étapes, et **une fenêtre
> commune** ; le **mouvement** nommé, qui appartient à l'atelier et non à un projet, comme
> l'étiquette ; et le **pantin**, dont où il vit reste la question ouverte de la tranche `A8` —
> une planche est un asset, un squelette n'en est pas un. *Le découpage est dans
> `docs/PLAN.md`, ce qui l'a décidé dans `docs/bilan-v3.md`.*

**Pourquoi le personnage mérite une entité et pas un champ.** C'est la deuxième fois seulement
depuis T4 qu'on ajoute un objet au modèle — le lien de T9 était le premier —, et la barre doit
rester haute. Une étiquette sur l'asset aurait suffi à dire « ces images vont ensemble » ; elle
ne suffit pas à dire **ce qui manque**. Le personnage porte un plan de cases dont chacune est
vide ou pleine, et c'est cette liste de cases vides — que nul asset ne peut porter, puisqu'elle
décrit des images qui n'existent pas — qui fait l'entité. Le champ `groupe` de la carte avait
déjà échoué sur ce point en T8, pour la même raison : une étiquette n'a pas de forme, et ce qui
n'existe pas encore n'a rien à étiqueter.

### Ce que la toile ajoute au modèle → `docs/archi-versions.md` § 6.5

**Une entité — le lien —, deux champs sur la carte, et l'îlot qui n'est pas une entité mais
*est* le groupe.** Le détail est descendu le 2 septembre 2026 dans `docs/archi-versions.md`
§ 6.5, à côté de la dépendance de la toile qui y était déjà : deux moitiés d'un même sujet qui
se renvoyaient l'une à l'autre entre deux fichiers.

On l'ouvre quand on touche à la toile, aux îlots, aux liens ou aux teintes. **Ce qui reste ici,
parce que ça vaut pour tout le modèle et pas pour la toile** : *l'îlot est le groupe — hors
îlot, pas de groupe, et jamais deux rangements concurrents.*

### Ce que la V2.1 ajoute au modèle

*Écrit le 31 août 2026, en reportant `docs/maquettes-v2.1/`.* **Quatre entités neuves et
cinq champs**, et la barre reste celle du §5 : une étiquette sur un objet existant aurait
suffi partout où elle suffit, et chacune des quatre est là parce qu'elle ne suffisait pas.
La quatrième — la **direction** — a été posée *en construisant*, et le tableau ci-dessous dit
pourquoi. Le détail des arbitrages est dans `docs/v21-arbitrages.md`.

| Entité | Contenu | Note |
|---|---|---|
| **Étiquette** | un libellé en français, le texte anglais qui part vraiment au modèle, la case de bible à laquelle elle appartient, le nombre de fois qu'elle a servi | **Elle appartient à l'application, pas à un projet** — comme la clé du fournisseur, elle ne dépend d'aucun. C'est ce qui rend la description d'un univers **mécanique au lieu d'être rédigée** : cliquer *brume basse* écrit `thick low-lying fog, volumetric haze` dans la case. La base naît vide, personne ne l'écrit à la place de l'auteur, et elle grandit de chaque étiquette fabriquée dans n'importe quel projet. |
| **Palette** | un nom, la liste de ses sources, les deux valeurs de fusion, la liste de ses retouches, et les couleurs rendues avec leur empreinte | Une palette **reste une recette** : elle se recalcule de ses sources, et ses sources peuvent être d'autres palettes. La palette du projet devient **un cas particulier de palette**, pas une chose à part. |
| **Direction** | un identifiant, un nom en français, la consigne anglaise qui part au modèle | *Ajoutée en la faisant, le 31 août 2026 : elle était prévue comme une simple liste de noms sur le projet, et il lui fallait deux textes.* Le nom se **lit**, la consigne **part** ; les confondre faisait sortir « sud » au milieu d'une phrase anglaise. L'identifiant ne bouge pas quand le nom change, comme pour une pose : les images faites le portent. |
| **Ambiance** | un nom, le nom de sa palette, la liste de ses images de référence, ses trois cases de texte | Elle appartient à un projet. C'est un **lot de style tout prêt**, fabriqué une fois et réutilisé sur plusieurs choses du jeu. Les palettes sont les ingrédients, les ambiances les recettes — d'où les deux listes au même endroit dans l'univers. |

**Et cinq champs sur des objets qui existent** : la **vue du jeu** et la liste des
**directions** sur le projet, une **direction** sur l'asset et sur la génération, le nom de
l'**ambiance par défaut** sur une chose du jeu, et **ce qui a été pris de l'ambiance** sur
la génération. *Ce compte-là était une prévision, et les étapes l'ont dépassé* — chaque
paragraphe « écrit en la faisant » ci-dessous nomme ce que la sienne a ajouté.

*La vue a été ajoutée le 31 août 2026, sur un report de la maquette de l'assistant qui
n'avait pas été appliqué ici.* Elle n'existait que sous forme de phrase, dans la case
`vue` de la bible — un texte anglais qui part au modèle et que rien ne relit. Or le choix
de la vue remplit **deux endroits d'un coup** : cette phrase, et la liste des directions.
Sans le champ, l'atelier ne peut ni rouvrir l'étape sur ce qui a été choisi, ni réécrire
les deux quand on en change : il faudrait deviner la vue en relisant l'anglais.
S'y ajoute, dans la recette, un **décalage horizontal** sur la grille — le seul réglage
que la V2.1 ajoute au traitement d'image, et il n'est écrit que par le calibrage.

**Pourquoi la palette et l'ambiance sont des objets et pas des champs.** Aujourd'hui une
palette est un champ du projet, en un seul exemplaire et sans nom ; il en faut plusieurs,
nommées, et réutilisables par plusieurs ambiances — un champ ne se nomme pas et ne se
partage pas. Pour l'ambiance, deux candidats existaient et échouent tous les deux : un
paquet d'images du tableau d'inspiration n'a pas d'identité propre et disparaît avec sa
dernière carte (c'est la même panne que l'îlot, §*Ce que la toile ajoute au modèle*), et
une collection groupe des objets produits, pas des réglages.

**Pourquoi les directions vivent sur le projet et pas sur la pose.** Une direction n'est
pas une propriété d'un mouvement, c'est une propriété du **jeu** : un jeu vu de dessus en
quatre directions les demande pour tout ce qui bouge, un jeu de plateforme n'en demande
aucune. Posées sur le projet, elles se déduisent de la vue et se rangent une fois pour
tous les personnages ; posées sur la pose, il faudrait les redire à chaque entité. La
contrepartie est un compte qui se multiplie — une pose demande désormais *tant d'images
dans tant de directions* — et **le produit affiche toujours le produit des deux, jamais
les deux facteurs séparés dans une jauge**.

**Et la liste des poses quitte le projet pour le type d'objet.** Avant, le jeu déclarait
une seule liste et tous les objets la recevaient : un coffre héritait de *marche* et de
*course*, qu'il fallait ranger un par un, sur chaque coffre. Désormais un personnage a
*repos, marche, course, attaque, dégâts, mort*, un coffre a *fermé, ouvert, vidé*, et une
tuile n'a pas de poses du tout. Un objet peut ajouter les siennes, sur lui seul, et sa
fiche écrit **l'origine de chaque pose** — du type, ou ajoutée ici — pour qu'on sache
toujours qui la reproposera demain.

*Écrit en la faisant, le 31 août 2026.* La liste d'un type est **une liste ou rien**, et
les deux ne disent pas la même chose : *rien* veut dire « ce type n'a rien décidé », une
liste vide veut dire « ce type ne réclame aucune pose ». Les confondre aurait fait
ressusciter à chaque relecture ce qu'on venait de retirer. Un type qui n'a rien décidé
reçoit alors, dans l'ordre : le plan du jeu s'il est un **personnage** ou une **créature**
— sans quoi une attitude ajoutée au plan cesserait de paraître là où on l'attend le plus —
ou si le produit ne connaît pas son nom ; sinon ce que le produit propose pour un type de
ce nom, la liste vide du décor et de la tuile comprise. **Et une chose sans type reçoit le
plan du jeu** : c'est l'état d'avant la tranche, et c'est ce qui reprend les projets
existants sans qu'un seul fichier ait eu à être réécrit.

*Écrit en la faisant, le 31 août 2026.* **Le calibrage n'écrit que dans l'occupation**, qui
existe depuis T4 et qui est déjà exprimée en **hauteur relative au personnage** — « part de la
case » jusqu'à la tranche des tailles, qui a levé son plafond de 100 % sans changer sa nature. C'est ce qui le rend gratuit à
conserver : passer une case de 64 à 128 ne défait aucun calage, parce qu'une part n'est pas un
nombre de pixels. Le **décalage horizontal** reste donc le seul ajout de la V2.1 à la recette
d'une image, et il se comporte comme la différence d'un calque — une coordonnée qui nomme
*cette* image-là, donc qui ne part pas dans une recette nommée.

*Écrit en la faisant, le 31 août 2026.* **Les cinq familles n'ont ajouté aucun objet.** Une
chose du jeu porte son type depuis E9, et un type porte sa famille depuis T4 : un décor est
donc une chose du jeu au même titre qu'un personnage sans qu'une ligne de modèle soit écrite,
et la famille se **lit** dans le type plutôt que de se garder à côté. Deux vérités sur la même
question auraient fini par ranger un meuble dans les décors. C'est aussi ce qui rend vraie
sans effort la promesse « aucun personnage existant ne perd quoi que ce soit » : une chose
sans type est un personnage, et c'est l'état de toutes celles d'avant E9.

*Écrit en la faisant, le 31 août 2026.* **La liste des directions est une liste ou rien**,
exactement comme celle d'un type — et pour la même raison, qui est devenue une règle du
dossier : *rien* veut dire « personne n'y a touché », et la liste **suit alors la vue du
jeu** ; une liste écrite ne la suit plus. Les confondre aurait laissé un changement de vue
effacer en silence des noms choisis à la main. Le codex écrit laquelle des deux — *lues* ou
*à vous* —, parce que ce ne sont pas la même promesse.

*Écrit en la faisant, le 31 août 2026.* **Une pose porte désormais quatre choses de plus que
son nom.** Sa **consigne** anglaise, parce que le nom se lit et que la consigne part — et
qu'un texte qui sert aux deux partait en français au milieu d'une phrase anglaise. Les
**directions qu'elle ne tient pas**, qui est la portée large d'un rangement : une mort n'a
qu'un angle quel que soit le personnage. Et **ce qu'elle demandait avant la baisse**, un champ
qui ne porte que sa propre défaite : la proposition de ramener à une image doit se défaire
d'un clic, et une défaite qui disparaîtrait au rechargement laisserait ouvert le piège
qu'elle ferme. La portée étroite, elle, vit sur la chose du jeu — *ce dragon n'attaque que
vers le sud*.

*Écrit en la faisant, le 31 août 2026.* La palette rendue est **un cache nommé par sa
provenance**, exactement comme celle du projet depuis T4 — mais son empreinte porte les
**couleurs résolues** de chaque source, et non le nom des sources. Sans ça, ajouter une carte
à un paquet du tableau n'aurait rien recalculé, et c'est très exactement ce que la tranche
promet de préserver. Chaque couleur du résultat est en outre **l'une de celles d'une source** :
la coupe médiane rend des moyennes, et chaque seau revient donc à la couleur réelle la plus
proche — sans quoi une pastille dirait « venue du jeu » en montrant une teinte que le jeu ne
porte pas. Enfin, **ce qu'une chose prend à son ambiance vit sur la chose** — tout, les
couleurs seulement, tout sauf les images ; ce que *chaque génération* a réellement pris reste
un champ de la génération, en E14, parce que c'est une autre question et que la même liste
écrite à deux endroits aurait divergé. **E14 a montré que ce n'est pas non plus dérivable du
mode durable** : l'écran de confirmation éteint ligne par ligne, donc un appel peut avoir pris
le monde sans l'éclairage — ce qu'aucun des trois modes ne décrit. Ce qui s'enregistre est
**observé sur ce qui est parti**, jamais recopié du réglage.

*Écrit en faisant E12, le 31 août 2026.* La chose du jeu gagne **trois champs de plus** que
ce tableau n'annonçait : les textes qu'elle écrit pour elle seule, ceux qu'elle éteint, et les
images fabriquées qu'elle a promues en référence permanente. Les deux premiers sont les deux
moitiés d'une même distinction — vider rend la case au jeu, éteindre écrit un refus —, et le
troisième corrige le frottement le plus cher du dépôt : dix-sept appels payés sur vingt-huit
étaient partis sans une seule image de référence. Une image promue part en rôle `reference` et
avec **tous** les appels de sa chose, ce qui la distingue d'une réinjection posée pour un
appel ; le compte des références le dit en toutes lettres, sans quoi on décocherait en aveugle.

**Le personnage se généralise en entité**, ce qui était annoncé comme le seul de ces
changements à toucher du code existant en profondeur. *Corrigé en le faisant, le 31 août
2026* : il n'a touché aucun modèle. Les familles *Décors*, *Objets* et *Interface* avaient
leur ligne et leur compte à zéro faute d'entités ; elles en portent depuis E15, et la famille
d'une chose se **lit dans son type**, qui la porte depuis T4. Ce qui manquait n'était donc
pas le modèle — il était là — mais les écrans qui le lisent. L'entité gagne en revanche
**deux listes d'écart de plus** — les directions rangées (E10), les pièces rangées — à côté
de celle qui existe déjà pour les poses, et **les images de référence qu'elle désigne**, qui
n'existaient sous aucune forme.

**Ce que la V2.1 ne coûte pas, et c'est la moitié de son intérêt** : aucune route neuve
vers le fournisseur, aucun appel payant supplémentaire — la fusion des palettes et la
correction des couleurs se font sur la machine, en millisecondes — et aucune couleur
d'interface neuve.

