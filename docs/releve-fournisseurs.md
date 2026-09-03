# Relevé F0 — les trois fournisseurs gratuits, mesurés

> Relevé du 31 août 2026. **C'est le préalable de la V2.2** (`docs/tranches/V2.2.md` § F0) : savoir ce
> que chacun sait faire, et à quel prix dans sa monnaie, avant qu'une ligne de code soit
> écrite. Ce n'est pas un banc de qualité — les crédits sont trop rares pour ça, et ce n'est
> pas la question.
>
> Les mesures se relancent : `py essais/essai_fournisseurs.py`, sortie dans
> `essais/fournisseurs.json`, à côté de `couverture.json` qui tient le même rôle pour
> OpenRouter.
>
> **Ce document ne fait foi sur rien.** Il rapporte ce qui a été mesuré et ce qui ne l'a pas
> été. `docs/PLAN.md` fait foi sur l'ordre, `docs/PRD.md` sur ce que le produit doit faire.

---

## Le verdict, en trois lignes

**Leonardo n'entre pas comme fournisseur — et ses modèles entrent quand même.** Il n'existe
aucune allocation gratuite renouvelable sur son interface de programmation : les 150 jetons
par jour appartiennent à l'application web, et sa documentation dit que l'accès programmé est
« séparé des abonnements gratuits ou de l'application web ». Mais **ses deux modèles phares,
Phoenix et Lucid, sont hébergés chez Cloudflare**, sur l'allocation gratuite de celui-ci. On
obtient Leonardo sans compte Leonardo.

**Pollinations entre, et pour le brouillon seulement.** Un seul modèle sur le palier sans
compte, aucune image de référence possible, et un défaut qu'aucune documentation n'annonce :
**il substitue son modèle en silence** et rend une image pour n'importe quelle adresse.

**Cloudflare est celui qui compte.** Un vrai catalogue relu, une allocation quotidienne
généreuse pour un modèle rapide, les modèles de Leonardo en prime — et **le seul chemin
gratuit vers un univers** : un modèle qui accepte quatre images de référence en octets, depuis
le disque de l'auteur.

---

## La question qui décide : les images de référence

C'est la question que le plan désignait comme celle dont tout dépend, et elle a une réponse
nette. Le produit demande **au moins trois références** pour porter un univers — deux planches
de style, plus la source d'édition quand on enchaîne les poses. C'est le seuil que
`essais/essai_couverture.py` applique déjà à OpenRouter.

| Fournisseur | Modèle | Références acceptées | Par quel chemin |
|---|---|---:|---|
| Pollinations | `sana` *(le seul du palier sans compte)* | **0** | — |
| Pollinations | `kontext` | 1 | **adresse web publique** — et il est réservé au palier payant |
| Cloudflare | `flux-2-dev` | **4** | **octets, en multipart** — `input_image_0` à `input_image_3` |
| Cloudflare | `stable-diffusion-v1-5-img2img` | 1 | octets, en base64 ou en tableau |
| Cloudflare | `flux-1-schnell`, `lucid-origin`, `phoenix-1.0`, `flux-2-klein` | 0 | — |
| Leonardo | *non mesuré* | — | — |

**Un seul modèle gratuit franchit le seuil : `flux-2-dev`, à quatre.** Et il a une ombre au
tableau, que seul ce dépôt pouvait voir : son petit frère `flux.2-klein-4b` **a déjà été
disqualifié par le banc du 26 août** pour la faute rédhibitoire — *la référence de style
écrase le sujet du prompt*, ce qui interdit tout casting varié dans un style commun. Le
grand frère partage-t-il le défaut de la famille ? Personne ne le sait, et c'est **la première
chose à mesurer** dès qu'une clé Cloudflare existe. Si oui, il n'y a aucun chemin gratuit vers
un univers, et le gratuit est un brouillon — définitivement.

**Deux contraintes de plus sur ce chemin**, et elles ne sont pas anodines : chaque image
d'entrée doit faire **512 pixels au plus**, ce qui oblige à réduire une planche de style avant
de l'envoyer ; et il en va quatre au maximum, là où le modèle payant par défaut en accepte
seize.

**Le chemin par adresse publique est exclu, et ce n'est pas discutable.** Il supposerait de
publier une planche d'artwork de l'auteur à une adresse qu'un tiers peut lire. Un atelier qui
tourne sur la machine de son auteur ne publie rien. C'est écrit au périmètre du produit, et le
relevé confirme que ça écarte `kontext` sans autre examen.

---

## Fiche 1 · Pollinations

**Mesuré en direct, sans clé.** Onze appels, tous gratuits.

### Ce qu'il déclare, et ce qu'il fait

Son catalogue rend **un seul nom** : `sana`. La documentation, elle, en annonce quatre —
`flux`, `turbo`, `stable-diffusion`, `kontext`. L'écart s'explique par un système de paliers :
sans compte, on voit un modèle et un seul.

**Et c'est là qu'est le défaut à connaître.** Demander `flux` ou `turbo` ne donne ni erreur, ni
avertissement : la réponse arrive en 200, avec une image — **et c'est `sana` qui l'a faite**,
à l'octet près la même image dans les deux cas. Seul un en-tête de la réponse, `x-model-used`,
dit la vérité. Un adaptateur qui ne le lirait pas enregistrerait un nom de modèle faux dans le
journal des dépenses, pour toujours.

Demander un modèle qui n'existe pas du tout — `nexistepas` — donne le même résultat : une
image de `sana`, en 200. En revanche, demander `kontext`, qui existe mais est réservé, donne
un refus honnête en 500, avec une phrase qui explique où il est disponible. **Trois
comportements pour trois cas voisins**, et rien ne les distingue avant de lire les en-têtes.

### Ce qu'il fait des dimensions

Demander une image carrée de 1024 pixels en rend une de **768**. Silencieusement. Demander
1024 sur 512 rend bien 1024 sur 512 — la proportion est respectée, c'est la surface qui est
plafonnée. Le format est **toujours du JPEG**, jamais du PNG.

C'est le piège `output_format` de Seedream, à l'identique : un paramètre accepté sans erreur
puis ignoré. La règle du produit depuis la première tranche — *les dimensions mesurées font
foi, jamais celles demandées* — suffit à l'absorber, et elle sert ici dès le premier appel.

### Ce qu'il n'a pas

**Il n'a pas de 404.** Toute adresse rend une image : `/openapi.json` en a rendu 141 Ko,
la racine du site 121 Ko. Un adaptateur ne peut donc rien conclure du statut d'une réponse,
et doit vérifier ce qu'il a reçu plutôt que ce qu'on lui a répondu.

### Ce qu'il consomme, et ce qu'il en dit

**Un jeton par image**, annoncé dans les en-têtes de chaque réponse
(`x-usage-total-tokens: 1`). C'est le seul des trois qui dise sa consommation appel par
appel — et il **ne dit jamais ce qu'il reste**. Il n'y a d'ailleurs pas de réserve à épuiser :
la limite du palier sans compte est une cadence, **un appel toutes les quinze secondes**, pas
un quota. En pratique, une image demande entre vingt et trente secondes, donc la cadence n'est
presque jamais le facteur limitant.

### Verdict

**Il entre, pour le brouillon, et à trois conditions.** Lire `x-model-used` à chaque appel et
refuser si ce n'est pas le modèle demandé ; mesurer l'image reçue au lieu de croire la demande ;
et ne jamais lui proposer une génération qui porte des références — la règle de grisé du
produit s'en charge toute seule, puisqu'il en déclare zéro.

C'est le fournisseur qui rend vraie la promesse *la première image ne demande plus rien* :
sans compte, sans clé, sans carte, une image arrive en une demi-minute.

---

## Fiche 2 · Cloudflare Workers AI

**Non mesuré en direct — il demande deux secrets, et le dépôt n'en a aucun.** Tout ce qui suit
vient de la documentation publique et sera à confronter à l'interface, comme le relevé le
demande. Ce qui est écrit ici est donc **annoncé, pas mesuré**, et c'est la distinction que la
V2.2 doit faire paraître à l'écran.

### L'allocation

**Dix mille « neurones » par jour**, remis à zéro à minuit temps universel. Au-delà, la
facture est de onze millièmes de dollar pour mille neurones — ce qui donne un ordre de grandeur
utile : **l'allocation d'une journée vaut environ onze centimes.**

> **Précision ajoutée le 1<sup>er</sup> septembre 2026, en écrivant la marche à suivre de
> `F4`.** Ce tarif ne s'applique qu'à un compte **passé au palier payant**, ce qui demande une
> action explicite et une carte. **Sur le palier gratuit, dépasser l'allocation ne facture
> rien : l'appel est refusé, et c'est tout.** La phrase ci-dessus est donc juste sur le prix et
> trompeuse sur le risque — ouvrir ce compte ne peut pas produire de facture surprise.

Onze centimes, c'est quatre à cinq images du modèle payant par défaut du dépôt, qui coûte
deux centimes et demi l'image avec un guide de style. Mais un neurone n'achète pas la même
chose selon le modèle, et l'écart est considérable.

| Modèle | Prix annoncé | Ce que l'allocation du jour permet *(calculé, pas mesuré)* |
|---|---|---:|
| `flux-1-schnell` | 4,8 neurones par tuile de 512 px, 9,6 par étape | **environ 170 à 230 images** |
| `phoenix-1.0` *(Leonardo)* | 530 par tuile, 10 par étape | environ 4 en grand, 15 en petit |
| `lucid-origin` *(Leonardo)* | 636 par tuile, 12 par étape | environ 3 en grand, 13 en petit |
| `flux-2-klein-9b` | 1 364 pour le premier mégapixel | environ 7 |
| `flux-2-dev` | 18,75 par tuile d'entrée, 37,5 par tuile de sortie | à mesurer — la formule annoncée est ambiguë |

**Ces comptes sont calculés à partir des tarifs affichés, et le produit a déjà appris à s'en
méfier** : `riverflow-v2.5-fast` annonçait $0,019 l'image et en facturait $0,042. C'est
précisément ce qu'il faudra vérifier avec une clé.

**Ce que ce tableau dit vraiment** : le gratuit achète *beaucoup* d'images d'un modèle rapide,
ou *très peu* d'images d'un bon modèle. Deux cent brouillons par jour, ou trois images
soignées. C'est exactement le partage que la V2.2 avait supposé, et il est ici chiffré.

### Ce qu'il rend, et ce qu'il ne déclare pas

`flux-1-schnell` n'accepte que deux choses : un texte, et un nombre d'étapes — quatre par
défaut, huit au plus. **Il ne déclare ni largeur, ni hauteur, ni proportion.** C'est un
problème pour le produit, et il est nouveau : *imposer la proportion explicitement* est une
des deux règles de prompt valables partout, née d'un essai où Gemini partait en 16:9 et
Seedream en 1:1. Un modèle qui n'a **aucun** réglage de taille ne peut pas obéir à cette
règle, et le grisé du produit ne le verra pas — il ne grise que ce qui est *déclaré et
incompatible*, pas ce qui est *absent*. **C'est une lacune trouvée par le relevé, et elle
appartient à F1.**

La sortie est du **JPEG en base64**, dans un champ `image`. Là encore, pas de PNG.

### Ce qu'il dit de ce qui reste

**Rien de documenté.** Aucune adresse ne rend le solde de neurones. C'est donc le cas que la
tranche F4 avait prévu : l'atelier compte lui-même, et l'écran dit que c'est un compte tenu
ici. Le relevé confirme que ce cas n'est pas l'exception mais la règle.

### Verdict

**Il entre, et c'est lui qui porte la version.** Trois raisons, dans cet ordre : c'est le seul
qui offre un chemin gratuit vers un univers ; c'est le seul dont le catalogue se relit vraiment,
donc le seul qui honore *le catalogue décide* sans amendement ; et il donne les modèles de
Leonardo sans compte Leonardo.

---

## Fiche 3 · Leonardo

**Non mesuré en direct — pas de clé. Et le relevé documentaire suffit à trancher.**

Les 150 jetons par jour du tableau de départ sont ceux de **l'application web**, et ils ne
franchissent pas l'interface de programmation. La documentation est explicite : l'accès
programmé est « séparé des abonnements gratuits ou de l'application web », et les formules
d'accès programmé « sont distinctes des formules de l'application web ». Il existe un crédit
de départ offert aux nouveaux venus pour essayer, puis une facturation à l'usage, en dollars.

**Autrement dit : il n'y a pas d'allocation gratuite renouvelable, et c'est la seule chose
qui intéressait la V2.2.** Un fournisseur payant de plus ne justifie pas une tranche : le
produit en a déjà un, qui donne accès à quarante-huit modèles derrière une seule facture.

**Et pourtant ses modèles entrent.** `phoenix-1.0` et `lucid-origin` sont hébergés chez
Cloudflare et consomment l'allocation gratuite de celui-ci. C'est le résultat le plus utile de
cette fiche : on obtient les modèles qui motivaient l'entrée de Leonardo, **sans Leonardo**,
sans une clé de plus, et sans une forme d'appel de plus.

### Verdict

**Il n'entre pas.** Ce qui le fait sortir n'est pas sa qualité — elle est probablement la
meilleure des trois — mais le fait que sa gratuité n'existe pas là où le produit irait la
chercher. La tranche F5 perd son objet.

---

## Ce que le relevé change au plan

Cinq points. Chacun a sa place dans une tranche existante ; **aucun n'ajoute de tranche**, et
un s'en retire.

1. **F5 tombe.** Leonardo n'a pas d'allocation gratuite renouvelable. Ses modèles arrivent par
   F4. La V2.2 passe de six tranches à cinq, et perd du même coup le seul fournisseur qui
   répondait en deux temps — donc tout ce que F5 devait éprouver de l'attente et des
   soumissions multiples.
2. **F4 monte en importance et change de rang.** Cloudflare n'est plus le deuxième fournisseur
   à clé, c'est **celui qui porte la version** : le seul catalogue vrai, le seul chemin vers un
   univers, et les modèles de Leonardo en prime.
3. **F1 gagne une règle, et elle est neuve** : *un adaptateur vérifie que le modèle rendu est
   celui qui a été demandé.* Elle vient de la substitution silencieuse de Pollinations, et elle
   n'existait pas — le produit n'avait jamais eu affaire à un fournisseur qui répond « oui » à
   tout. C'est un candidat d'invariant, au même rang que *les dimensions mesurées font foi*.
4. **F1 gagne une lacune à combler** : le grisé ne voit pas un modèle qui ne déclare *aucun*
   réglage de taille. Il grise ce qui est déclaré et incompatible. `flux-1-schnell` est
   exactement ce cas, et la règle *imposer la proportion explicitement* n'a pas de prise sur
   lui.
5. **F2 est confirmée dans son cas le plus ingrat.** Aucun des deux fournisseurs retenus ne dit
   ce qu'il reste : Pollinations n'a pas de réserve, Cloudflare n'expose pas la sienne. Le
   compte tenu ici n'est donc pas une exception à prévoir, c'est **le cas normal** — et
   l'obligation de dire *« compté ici »* devient la règle plutôt que la nuance.

---

## Ce qui reste à mesurer, et ce qu'il faut pour le faire

Une seule chose manque, et c'est **une clé Cloudflare** — un identifiant de compte et un jeton,
tous deux gratuits, sur le palier sans frais. Les noms attendus sont dans `.env.example`, et
**la marche à suivre pour les obtenir a été écrite d'avance** : `docs/tranches/V2.2.md` § F4,
cinq gestes, avec le piège du jeton créé à la main qui ne peut que lire. Avec eux,
`essais/essai_fournisseurs.py` mesure sans rien changer :

- **si `flux-2-dev` reprend le sujet de sa référence**, comme `flux.2-klein-4b` l'a fait. *C'est
  la mesure qui décide s'il existe un chemin gratuit vers un univers*, et elle coûte deux
  images ;
- la liste des modèles image que le compte voit **réellement**, face à celle de la
  documentation ;
- ce qu'une image consomme en neurones, **mesuré et non calculé** — le tarif affiché a déjà
  menti une fois dans ce produit ;
- la taille que rend `flux-1-schnell`, qui ne la déclare nulle part ;
- si les quatre images d'entrée passent bien, et ce que la réduction à 512 pixels coûte à une
  planche de style.

**Leonardo ne demande plus rien** : sa question est tranchée sans clé.

---

## Hors relevé · Meshy, une piste 3D pour l'animation de la V3

> Ajouté le 1<sup>er</sup> septembre 2026. **Ce n'est pas un fournisseur d'images et ce
> n'est pas gratuit** — donc rien de ce que F0 mesure ne s'y applique. C'est une note de
> côté, posée ici parce que c'est le seul endroit du dépôt où l'on tient la liste de ce qui
> existe ailleurs. `docs/v3-animation.md` fait foi sur l'animation.

**Le constat qui la motive.** Le banc du 1<sup>er</sup> septembre a jugé 111 planches
lisibles pour $5,32 : **environ une sur dix est bonne**, et le défaut dominant n'est pas le
mouvement mais **le personnage redessiné à des tailles différentes d'une case à l'autre**.
Un modèle d'image ne tient pas la cohérence d'une case à la suivante — c'est une propriété
du procédé, pas un réglage à trouver.

**Ce que la 3D change au problème.** Meshy (`https://api.meshy.ai`) enchaîne
`image-to-3d` → `rigging` → `animations` : un sprite devient un maillage, l'auto-rig lui
pose un squelette, et une bibliothèque d'actions produit le mouvement. **La taille du
personnage ne peut plus varier d'une case à l'autre, puisque c'est le même objet** — le
défaut dominant du banc disparaît par construction, il n'est pas corrigé. Il resterait à
rendre la planche et à la repasser par la normalisation de grille, qui est de toute façon
obligatoire (`docs/archi-fournisseur.md` § 4 bis, enseignement 2).

**Où en lire le mode d'emploi.** `github.com/OnePersonLabs/asset-mcp` — un prototype de
651 lignes, un seul commit du 24 décembre 2025, à lire comme **documentation d'API et rien
d'autre** : son architecture est en retrait de celle de ce dépôt sur tous les points communs
(port fournisseur à cinq méthodes sans catalogue ni unité, `provider: 'meshy'` figé dans le
type, multi-fournisseur annoncé mais absent, aucun test). Ce qu'il donne et qui vaut le
signet : les sept adresses exactes, la chaîne de dépendances `rig_task_id` → `action_id`,
et le fait que Meshy pousse la progression en SSE (`/stream`) plutôt qu'en la faisant
interroger.

**Ce qu'il faudrait mesurer avant d'y croire.** Deux choses, et aucune n'est dans ce
prototype : **ce que Meshy coûte réellement** par personnage animé, et **ce que le rendu
3D → pixel donne sur un sprite de 64 px** — c'est-à-dire si le détour survit à la
réduction. Un banc payé, comme les deux précédents, ou rien.

---

## Hors relevé · Ludo.ai, ce qu'un concurrent fait de l'animation 2D

> Ajouté le 2 septembre 2026, à la demande de l'auteur. **Ce n'est ni un fournisseur
> gratuit ni un fournisseur candidat** : rien de ce que F0 mesure ne s'y applique. C'est une
> note de côté, posée ici pour la même raison que celle sur Meshy — c'est le seul endroit du
> dépôt où l'on tient la liste de ce qui existe ailleurs. **`docs/v3-animation.md` fait foi
> sur l'animation**, et rien de ce qui suit n'est mesuré.

**Ce qu'on a lu, exactement.** `github.com/api-evangelist/ludo-ai` **ne contient aucun
code** : c'est un profil d'interface tenu par un tiers (API Evangelist), pas la
documentation officielle de Ludo.ai. On y trouve des descriptions `openapi/` (animation,
images, modèles 3D, audio, vidéo, résultats), des collections Postman, un schéma d'objet
`json-schema/ludo-ai-game-asset-schema.json`, et les pages tarifs / limites de débit. **À
lire comme une déclaration d'intention d'un produit concurrent, et rien d'autre** — même
précaution que pour le prototype Meshy plus haut.

### Le premier fait, et il est rassurant : ils ne riguent pas non plus

Ludo.ai vend des modèles 3D *et* de l'animation de sprites, et **les deux ne se touchent
pas** : nulle part dans la description de l'animation il n'est question de squelette, d'os
ou de rig. Leur animation 2D part d'une image et d'une phrase, exactement comme la nôtre.

**Ça ne prouve pas qu'il n'existe pas de meilleure méthode** — le pantin découpé de
`docs/v3-animation.md` en est le contre-exemple, libre et gratuit. **Ça dit qu'un produit qui
vend ça n'en a pas trouvé de moins chère.** La loterie mesurée le 1<sup>er</sup> septembre — une
bonne planche sur dix — n'est probablement pas une maladresse de notre côté.

### Les trois endroits où leur interface est mieux pensée que la nôtre

**1 · Le mouvement est un objet, pas une phrase à retaper.** `GET /animation-presets` — et
c'est le seul appel gratuit des trois — rend un catalogue de mouvements nommés, chacun avec
sa catégorie, sa durée, son aperçu, **les perspectives et les directions qu'il supporte**.
Les directions sont les huit points cardinaux `N NE E SE S SO O NO`, c'est-à-dire très
exactement les huit vues que le dépôt tient déjà dans `atelier/domaine/vue.py`. Chez nous, la
même marche se redemande en mots à chaque personnage, et rien ne garantit que la phrase
d'hier donnera le geste d'aujourd'hui.

**2 · `POST /sprites/transfer-motion` : imposer le mouvement au lieu de le décrire.** On
envoie le sprite **plus une vidéo de quatre secondes** — ou un `preset_id` du catalogue avec
sa perspective et sa direction — et le mouvement de la source est reporté sur le sujet.

C'est la **cinquième famille** recensée par `docs/v3-animation.md`, à côté du mannequin
articulé, du détour 3D et du pantin découpé — et **la seule qui ne demande ni pièces
séparées, ni squelette, ni trois dimensions**. Elle vise pile le résultat le plus dur du
banc : *décrire un mouvement ne marche pas* — zéro bonne planche sur vingt réécritures de
fond. Elle est aussi **la plus faible des cinq** : c'est encore un modèle qui redessine, donc
rien n'y garantit la constance de taille. Elle se teste avant le pantin parce qu'elle ne
coûte presque rien, pas parce qu'elle promet plus.

> ⚠️ **Ne pas confondre avec `essais/guide_marche.py`, qui est mort.** Le guide était une
> **image fixe jointe à la demande**, et il n'a rien donné à huit cases (2 bonnes sur 8 avec,
> 3 sur 7 sans). Une **vidéo de référence** n'est pas la même entrée, et elle n'a jamais été
> essayée ici. C'est une piste ouverte, pas une piste réhabilitée.

**3 · Ils rendent la planche avant *et* après le détourage.** Le drapeau
`spritesheet_with_background` renvoie la version non détourée en plus de l'autre — et
`individual_frames`, `gif`, le tout dans la même réponse. C'est exactement la manœuvre que le
banc du 1<sup>er</sup> septembre a dû improviser pour pouvoir juger : *les animations jugées
sont montées sans détourage*, parce qu'autrement on note le détourage au lieu de la marche.
**Juger le mouvement et juger le découpage sont deux métiers**, et leur interface le dit dans
sa signature. La nôtre devrait aussi.

### Les réglages qu'ils exposent, et ce qu'ils valent pour nous

`POST /sprites/animate` prend l'image de départ, une phrase de mouvement, et :

| Réglage déclaré | Ce que ça vaut pour la V3 |
|---|---|
| `frames` ∈ 4, 9, 16, 25, 36, 49, 64 — **défaut 36** | Que des carrés parfaits : la planche est une **grille**, pas une bande. Leur minimum est 4, comme notre piste vivante — mais **leur défaut est 36**, soit bien *plus* de cases que nos 8. Ça ne soutient pas la piste « moins de cases » ; ça dit juste que le sujet reste petit chez eux aussi. |
| `final_image` — la case d'arrivée, en plus de celle de départ | **Jamais essayé ici.** Le banc n'a testé que le départ. Encadrer le mouvement aux deux bouts est une entrée de plus, et elle est bon marché à mesurer. |
| `loop` (défaut vrai) | Le bouclage est demandé au modèle, pas rattrapé après coup. |
| `image_type` ∈ `sprite`, `sprite-vfx`, `ui_asset` | La **nature du sujet est déclarée**, pas décrite dans la phrase. Une torche qui brûle et un personnage qui marche ne se demandent pas pareil — c'est justement la limite « un seul sujet essayé » de `docs/v3-animation.md`. |
| `crop`, `margin_ratio`, `margin_ratio_mode` | Le recadrage est réglé **sur la planche entière**. C'est la leçon n° 3 du banc — *une bande se recadre sur une boîte commune, jamais case par case* — et ils l'ont mise dans la signature. |
| `frame_size` ∈ 64, 128, 256, 0 (max) · `duration` 1,2 à 4 s · `model` `standard` \| `new` | Rien à en tirer sans mesure. |

**Coût déclaré : 5 crédits par animation, 30 à 90 secondes.** En crédits, donc incomparable
à nos douze centimes la bonne planche tant qu'on n'a pas le prix du crédit.

### Ce qu'il faudrait mesurer avant d'y croire

**Leur taux de réussite est inconnu, et ce n'est pas un détail.** Une interface bien dessinée
n'est pas une preuve de qualité : rien dans ces fichiers ne dit qu'une planche Ludo sur deux
est bonne plutôt qu'une sur dix. **Il est parfaitement possible qu'ils vivent la même loterie
que nous, cachée derrière des crédits.** Ce profil est de toute façon tenu par un tiers, donc
même les réglages listés ci-dessus demandent d'être vérifiés sur la vraie interface avant
qu'on s'appuie dessus.

**Et il y a deux choses différentes à ne pas mélanger :**

- **prendre les idées ne coûte rien** — catalogue de mouvements, boîte commune, rendu avant
  détourage, nature du sujet déclarée. Ce sont des décisions de forme du produit, pas des
  achats ;
- **prendre le fournisseur, c'est une clé de plus**, hors OpenRouter, en crédits, hors du
  périmètre gratuit de F0. Ça ne se décide pas sur une lecture de fichiers.

**Ce que ça ne change pas.** L'ordre de `docs/v3-animation.md` tient : les trois branches à
soixante-quinze centimes — quatre cases, clause remplacée, et leur croisement — **passent
avant**, elles sont déjà tirées et attendent d'être notées. Rien ici n'a été mesuré, donc
rien ici ne passe devant quelque chose qui l'a été.
