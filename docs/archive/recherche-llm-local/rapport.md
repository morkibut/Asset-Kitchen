# Un petit modèle de langage sur la machine, pour aider à écrire et à traduire

**La demande, mot pour mot.** *« tester l'utilisation d'un llm local léger et puissant qui
permettent d'aider a la rédaction et traduction dans l'App. L'idée c'est d'avoir un bouton
baguette magique "améliorer avec l'IA" qui soit un peut partout pour aider à améliorer la qualité
des prompt, la cohérence, la traduction en anglais etc… je veux d'abord que tu analyse l'idée et
qu'on teste la faisabilité. fait des recherche »*

Étude du 3 septembre 2026.

---

## Ce sur quoi ce rapport ne fait pas foi

Il ne décide de rien et n'écrit aucune ligne du produit. Il répond à une question de faisabilité,
et il la sépare en deux qui n'ont pas la même réponse : **est-ce que la machine peut** (oui, et
largement) et **est-ce que le résultat est bon** (non, pas pour la tâche la plus évidente).

Il ne fait pas foi sur le choix final du modèle : la génération des modèles change tous les trois
ou quatre mois, et deux des cinq meilleurs candidats d'aujourd'hui n'existaient pas il y a six
mois. Ce qui vieillira le moins vite ici, ce sont les **mesures faites sur cette machine** et les
**erreurs répétées par tous les modèles sans exception** — celles-là ne sont pas un accident de
version.

Il ne fait foi sur rien de ce qui est marqué *annoncé* plutôt que *relevé*. La distinction est
tenue partout dans le document.

---

## Comment il a été fait

**Trois sources, et elles ne pèsent pas pareil.**

1. **Ce qui est relevé sur cette machine.** Quatorze modèles téléchargés et éprouvés, deux bancs
   écrits pour l'occasion, environ deux mille trois cents appels. C'est la source la plus lourde,
   et c'est la seule dont je réponds entièrement.
2. **Ce qui est lu dans le dépôt.** Le chemin d'un texte jusqu'au prompt, l'inventaire des champs
   de saisie, le contrat d'un fournisseur, les règles d'architecture, et les 63 générations déjà
   payées avec leurs prompts et leurs images.
3. **Ce qui est lu ailleurs.** Cinq recherches sur l'état de l'art, chacune relue ensuite par un
   vérificateur chargé de faire tomber ses affirmations. Bilan de cette relecture : **huit
   affirmations réfutées et une quarantaine nuancées** sur environ cent quatre-vingts. Les
   réfutations sont reportées ici, pas cachées.

**Le corrigé est de vous.** Le banc principal ne juge pas sur une opinion : les
**70 étiquettes livrées** de `atelier/domaine/etiquettes_livrees.py` sont 70 paires
français → anglais que vous avez écrites à la main. *brume basse* vaut
`thick low-lying fog, volumetric haze`. On cache l'anglais, on demande au modèle de le retrouver,
et on compare. C'est exactement la tâche que la baguette devrait faire, et il en existe une bonne
réponse écrite d'avance par la personne que l'outil doit servir.

Fichiers : `banc.py` (texte), `banc_vue.py` (images), `resultats/`.

---

## La réponse en une page

| La question | La réponse | D'où elle vient |
|---|---|---|
| La machine peut-elle faire tourner ça ? | **Oui, très largement.** Un modèle de 4 milliards de paramètres prend 3 Go sur les 8 de la carte et répond en 2 dixièmes de seconde. | Relevé ici |
| Et si la carte est déjà prise par autre chose ? | **Ça marche quand même.** Sur le processeur seul : 1,1 seconde, et **le même texte au mot près**. | Relevé ici |
| Faut-il installer quelque chose ? | **Non.** Ollama est déjà installé sur cette machine et tournait au démarrage de l'étude. | Relevé ici |
| Est-ce que ça coûte de l'argent ? | **Non, rien.** Ni à l'usage, ni en licence : les meilleurs candidats sont en Apache 2.0. | Vérifié dans les fichiers |
| Le problème que ça résout existe-t-il vraiment ? | **Oui, et il est chiffré.** Sur 63 générations payées, **6 sont parties avec du français dedans**, dont une avec 4 cases de bible sur 7. | Relevé dans vos données |
| Le modèle sait-il traduire vos phrases ? | **Presque.** 6 phrases sur 8 impeccables. Mais *colombages* devient un mur de pierre, et *bouchon de liège* devient du métal. | Relevé ici |
| Le modèle sait-il écrire une étiquette comme vous ? | **Non.** Le meilleur obtient 38 sur 100 à l'aveugle, avec **13 à 19 étiquettes franchement fausses sur 70** — et rien ne signale lesquelles. | Jury à l'aveugle |
| Le modèle sait-il enrichir un prompt sans inventer ? | **Non, aucun.** Environ **220 inventions sur 54 essais**, et pas un seul modèle sur quatorze n'a tenu la consigne. | Relevé ici |
| Est-ce un problème de choix de modèle ? | **Non.** Les cinq modèles de la génération actuelle se trompent **de la même façon** sur les mêmes mots. | Relevé ici |
| Le modèle sait-il regarder une image ? | **Oui pour le style de dessin**, à peu près pour un personnage, **pas du tout pour un objet**. Et **tout chiffre qu'il rend est faux**. | Relevé ici |
| Le dépôt l'autorise-t-il ? | **Oui, avec une précision à écrire**, exactement comme il l'a déjà fait une fois pour le découpage. | Lu dans le dépôt |
| Alors, faisable ? | **Oui — mais pas sous la forme demandée.** Voir la recommandation. | — |

---

## 1 · Ce que la machine sait faire

*Tout ce paragraphe est relevé ici, sur cette machine, et rien n'y est lu en ligne.*

Carte NVIDIA GeForce RTX 3080 pour portable, **8 Go** de mémoire vidéo ; 32 Go de mémoire vive ;
processeur AMD Ryzen 7 5800H.

**L'encombrement.** Un modèle de 4 milliards de paramètres occupe **3 Go** de la carte. Deux
tiennent ensemble — mesuré à 7,5 Go sur 8 — mais un seul suffit, et il laisse alors 5 Go libres
pour autre chose.

**Le temps.** Deux chiffres différents, et les confondre ferait condamner un modèle pour une
dépense qu'il ne fait qu'une fois.

| | à froid, une fois | à chaud, chaque appel | premier caractère affiché |
|---|---|---|---|
| qwen3.5:4b | 8,3 s | 0,3 s | 129 ms |
| qwen3.5:9b | 9,9 s | 0,4 s | 208 ms |
| ministral-3:3b | 5,2 s | 0,2 s | 36 ms |
| granite4.2:3b | 4,0 s | 0,2 s | 50 ms |

Le chargement à froid se paie une fois, et il peut se payer **à l'ouverture de l'atelier** plutôt
qu'au premier clic. Ensuite, un appel coûte deux dixièmes de seconde — c'est-à-dire le temps d'un
bouton d'écran, pas celui d'une génération.

**Le cas qui inquiétait, et il est réglé.** Si la carte est déjà occupée — par exemple par la
génération vidéo locale que vous avez étudiée le mois dernier —, le modèle bascule sur le
processeur :

| | sur la carte | sur le processeur seul |
|---|---|---|
| un modèle de 4 milliards | 173 ms | **1 085 ms** |
| un modèle de 2 milliards | 76 ms | 276 ms |

Une seconde au lieu de deux dixièmes, **et le texte rendu est identique au mot près**. Les 32 Go
de mémoire vive suffisent largement. Il n'y a donc **aucun gestionnaire de mémoire vidéo à
écrire** — et c'était précisément le motif pour lequel `docs/ARCHITECTURE.md` écarte les modèles
locaux.

**Les licences, vérifiées dans les fichiers livrés avec chaque modèle et non sur le web** — parce
que deux recherches se contredisaient sur ce point :

| Modèle | Licence | Libre de toute condition |
|---|---|---|
| qwen3.5 (4 et 9 milliards) | Apache 2.0 | oui |
| ministral-3 (3 milliards) | Apache 2.0 | oui |
| granite4.2 (3 milliards) | Apache 2.0 | oui |
| translategemma | Conditions Gemma | non |
| gemma3, llama3.2 | licences maison | non |

*Sans grande portée ici puisque l'atelier reste votre outil sur votre machine — mais gratuit à
respecter, et ça ne ferme aucune porte.*

---

## 2 · Le problème existe, et il est plus précis que « aider à écrire »

**Les six prompts.** Sur les 63 générations conservées dans `donnees/generations/`, **six sont
parties avec du français dedans**. Le pire envoie quatre cases de bible sur sept en français, sous
un intitulé anglais :

```
Line and shading: Contour brun d'1 pixel, aplats de couleurs, aucun dégradé
Lighting:         Lumière rasante, ambiance sombre, ombres portées courtes
Technical constraints: Sprite isolé sur fond plat, grille stricte 32×32 px, pas de perspective
```

**Et c'est là que ça devient intéressant : l'anglais existait déjà.** *Lumière rasante* est
l'étiquette dont le texte livré est `low raking light, long cast shadows`. *Contour brun* vaut
`dark brown outline, one pixel wide`. Ces deux textes étaient **à un clic**, dans le catalogue que
vous avez écrit, et ils ne sont pas partis.

Trois autres prompts sont partis avec `met ce personnge dans une vue Perspective Cavalière` —
français, et une faute de frappe, dans un appel payé.

**Ce que ça dit.** Le goulot n'est pas *« traduire est difficile »*. Le goulot est qu'**un champ
qui part en anglais accepte du français sans rien dire**. C'est une observation importante pour la
suite, parce qu'elle a une réponse qui ne demande aucun modèle.

**Une mesure qui recadre tout le reste.** Le texte que vous écrivez vous-même fait **37 caractères
en moyenne** (relevé sur 44 consignes dans `donnees/projets`), quand le prompt assemblé qui part
en fait 1 868. Toute la recherche publiée sur la traduction automatique porte sur de la prose
d'article de presse. Votre unité de travail réelle est un groupe de dix mots séparés par des
virgules — un registre sur lequel presque rien n'est mesuré ailleurs. D'où le choix de mesurer
ici plutôt que de citer.

---

## 3 · Les quatre usages ne se valent pas — et vous l'aviez déjà écrit

`docs/archive/brainstorm-assistance.md` contient votre propre description du geste actuel :

> *« Je suis obligé de passer par Gemini ou ChatGPT : je lui donne l'image de référence et un
> exemple de texte à produire avec des instructions strictes, pour qu'il me rende un nouveau
> prompt en anglais, retravaillé. »*

et le tableau des quatre usages. Voici ce que les mesures en disent, usage par usage.

| Usage | Verdict mesuré |
|---|---|
| **Traduire** — du français, rendre le même en anglais | **Ça marche à peu près.** 6 phrases sur 8 impeccables ; les fautes portent toutes sur le vocabulaire de métier. |
| **Améliorer** — étoffer un sujet trop maigre | **Ça ne marche pas.** Aucun modèle ne s'y tient : il invente. |
| **Décrire une image** — en tirer un signalement | **À moitié.** Juste sur un personnage, faux sur un objet d'inventaire. §6 |
| **Rédiger la bible** — depuis les artworks | **C'est le mieux noté du lot** — mais en jetant tout chiffre. §6 |

**La distinction n'est pas cosmétique.** Traduire, c'est rendre ce qui est là dans une autre
langue. Améliorer, c'est ajouter ce qui n'est pas là — et c'est précisément l'endroit où un modèle
décide à votre place.

---

## 4 · Ce que les modèles ratent, et pourquoi ce n'est pas un problème de modèle

### La forme est réglée d'un geste, et il est gratuit

Interrogé sèchement, un modèle rend une phrase avec une préface. **Montré trois exemples pris dans
votre propre catalogue**, il rend le format exact, sans un mot de trop :

| | réponse directement collable dans la case |
|---|---|
| sans exemple | **9 %** |
| avec trois exemples de la même case | **100 %** |

Et le gain n'est pas que de forme : la réponse tombe de 3 secondes à **229 millisecondes**, parce
que le modèle cesse de raisonner à voix haute pour se contenter d'imiter. Vous possédez déjà les
exemples : ce sont vos 70 étiquettes.

### Le sens, lui, n'est pas réglé

Ma première mesure disait « 100 % utilisable ». Elle avait tort, et c'est un jury à l'aveugle qui
l'a montré : quatre modèles anonymisés, jugés chacun sous trois angles différents sur les
70 étiquettes.

| Modèle | fidélité | utilité | style | **moyenne** | faux sur 70 |
|---|---|---|---|---|---|
| qwen3:4b-instruct | 38 | 33 | 30 | **33 / 100** | 13 |
| gemma3:4b | 30 | 42 | 42 | **38 / 100** | 19 |
| granite4:micro | 34 | 36 | 28 | **32 / 100** | 18 |
| qwen3:1.7b | 27 | 32 | 37 | **32 / 100** | 16 |

**Une étiquette sur cinq est fausse, et rien ne dit laquelle.** Les erreurs relevées :

- **`aplats`** → `smooth gradient fills` — l'exact contraire. Un aplat est une couleur unie. Le
  fragment devient mot pour mot celui de *dégradés doux*, plus bas dans la même case : **deux
  boutons opposés produiraient la même image.**
- **`gouache`** → une aquarelle translucide, alors que toute la définition de la gouache est
  d'être opaque et mate.
- **`anti-crénelage manuel`** → `anti-notch`, un mot qui n'existe pas en anglais, suivi de
  `slight jagged imperfection` — soit le défaut que l'anti-crénelage sert à effacer.
- **`haut moyen âge`** → `high middle ages`. Faux ami parfait : cinq siècles d'écart.
- **`crayonné`** → `crayon`, la craie de cire, au lieu du graphite.
- **`tramé`** → `grid pattern`, une vraie grille dessinée par-dessus l'image, au lieu du damier de
  pixels qu'est le tramage.
- **`opéra spatial`** → `grand orchestral sets`. Le mot *opéra* pris au pied de la lettre : des
  décors avec orchestre, et pas un vaisseau dans tout le fragment.

Et un défaut plus sournois, qui traverse tout : **les fragments se recopient entre eux.**
`floating islands` revient dans quatre étiquettes différentes, `neon` s'invite dans la lumière
d'orage et dans l'entre-deux-guerres. Les cases perdent alors leur utilité, puisque deux choix
opposés finissent par dire la même chose.

*Vérifié : `floating islands` n'était dans aucun des exemples montrés. Ce n'est pas une fuite du
banc, c'est le cliché propre au modèle — et on ne le corrigera donc pas en changeant les exemples.*

### Ce n'est pas un problème de version

J'ai refait le banc avec la génération actuelle des modèles — qwen3.5, ministral-3, granite4.2 et
translategemma, tous parus depuis mars 2026. Les chiffres montent un peu :

| Modèle | ressemblance au corrigé | collable tel quel | à chaud |
|---|---|---|---|
| qwen3.5:9b | **39 %** | 100 % | 0,4 s |
| granite4.2:3b | 33 % | 80 % | 0,2 s |
| qwen3.5:4b | 31 % | 100 % | 0,3 s |
| translategemma:4b | 27 % | 100 % | 0,2 s |
| ministral-3:3b | 18 % | 89 % | 0,2 s |

**Mais l'erreur reste la même chez tous.** `dieselpunk` devient du steampunk chez les cinq, sans
exception : *steam-powered machinery*, *steampunk city*, *steampunk meets industrial decay*,
*clockwork and steam*. Ce n'est pas une version à attendre, c'est une limite de ce que ces
modèles savent d'un domaine étroit.

### L'enrichissement libre est le pire des quatre usages

Consigne donnée à tous : *« reste fidèle, n'invente ni sujet, ni couleur, ni pose, ni décor »*.
Résultat sur 54 essais : **environ 220 inventions, et pas un modèle sur quatorze n'a tenu.**

- *« un dragon »* (deux mots) ressort en `a dragon, scales, fire, wings, mountain, dark, majestic,
  roaring, ancient, stone, fire breath, glowing eyes`. Le feu, la montagne, le rugissement : rien
  de tout cela n'était demandé.
- Un modèle a **contredit la commande** : pour *« un coffre au trésor **fermé** »*, il a écrit
  « partiellement ouvert, laissant voir des joyaux scintillants ».

**Et une règle exploitable en sort** : plus la description de départ est courte, plus le modèle
invente. *« un dragon »* déclenche 5 à 11 ajouts chez tout le monde ; *« un garde de la ville,
l'air fatigué »* — sept mots — passe presque intact chez plusieurs. **Le modèle comble le vide.**

### La traduction, elle, tient debout

C'est le seul usage où les mesures sont encourageantes. Classement établi sur huit phrases
d'auteur : gemma3:4b en tête, devant qwen3:4b-instruct et mistral:7b.

Les fautes sont concentrées et **prévisibles**, ce qui est une bonne nouvelle :

| Le mot | Ce qu'il devient | Combien de modèles le réussissent |
|---|---|---|
| **colombages** | murs de pierre, treillis, ou un pays d'Amérique du Sud | 2 sur 9 |
| **bouchon de liège** | du métal, du plomb, du caoutchouc, du cuir, la ville de Liège | 1 sur 9 |
| **mousse dans les joints** | de la mousse à raser (`foam`) | 5 sur 9 |
| **arme baissée** | `arm lowered` — le bras au lieu de l'épée | 7 sur 9 |

Une vingtaine de mots de métier reviennent sans cesse dans votre travail. Les figer d'avance
coûte une demi-heure et supprime la quasi-totalité de ces fautes.

---

## 5 · Ce que dit la recherche extérieure, et ce qu'elle confirme

*Cinq recherches, chacune relue par un vérificateur adverse. Huit affirmations ont été réfutées :
elles ne sont pas reprises ici.*

**Le résultat le plus utile recoupe exactement mon banc.** Une étude portant sur près de
1 900 participants a mesuré que la réécriture automatique de prompt, **appliquée sans que l'auteur
la voie**, a dégradé la performance de **58 %**. Et un second travail explique pourquoi : un
réécriveur entraîné à faire *joli* fait chuter la fidélité à la demande, parce qu'il ajoute des
objets et de l'ornementation qui diluent le sujet principal. C'est mot pour mot le dragon qui
repart avec une montagne.

**Ce que font les grands services**, et la leçon à en tirer :

- **DALL·E 3** : réécriture imposée, impossible à désactiver. Le modèle à ne pas suivre.
- **Ideogram** : trois états — *inactif / auto / actif* — et un panneau qui montre côte à côte le
  texte d'origine et le texte enrichi. **Le modèle à suivre.**
- **Flux** prévient lui-même que sur un prompt court et direct, l'enrichissement n'apporte rien.
- **Scenario**, côté jeu vidéo, a bien un bouton *« réécrire »* — mais présente comme la vraie
  réponse à la cohérence entre assets **l'entraînement d'un modèle sur 5 à 15 images de
  référence**, pas la réécriture.

**Quatre contre-indications documentées**, toutes pertinentes ici :

1. **Les négations disparaissent.** *« ne pas inclure d'humains »* est purement supprimé par la
   réécriture. Toute exclusion doit passer ailleurs que par le modèle.
2. **Les suffixes de qualité empoisonnent un style simple.** Un service ajoute automatiquement
   `Ultra HD, 4K, cinematic composition` : c'est du vocabulaire photoréaliste, et c'est un poison
   pour du pixel art volontairement plat.
3. **On perd la reproductibilité.** La réécriture n'est pas déterministe : sans garder le texte
   réellement envoyé, une génération réussie ne se rejoue pas.
4. **Tout se ressemble à la fin.** Un enrichisseur entraîné sur un goût moyen ramène chaque
   demande vers ce même centre.

---

## 6 · Le banc des images — l'usage que la demande d'origine réclamait

**Pourquoi ce banc existe.** Votre brainstorm dit que vous donnez **l'image de référence** au
service en ligne. Deux des quatre usages ne sont donc pas des tâches de texte, et les mesurer sur
du texte aurait répondu à côté. Quatre des cinq modèles actuels savent regarder une image —
relevé par `ollama show`, pas supposé.

**Le corrigé est de nouveau écrit d'avance, et par la machine cette fois** : chaque image du
dépôt est rangée à côté du prompt qui l'a fabriquée. On montre l'image, on demande le texte, on
compare. Douze images réelles, deux questions chacune : *décris ce que tu vois* et *relève le
style de dessin*.

| Modèle | ressemblance au sujet demandé | temps par image |
|---|---|---|
| qwen3.5:4b | 9 % | 2,5 s |
| gemma3:4b | 9 % | 2,0 s |
| ministral-3:3b | 7 % | 1,2 s |
| qwen3.5:9b | 6 % | 2,4 s |

*Le pourcentage est bas et trompeur — le texte de référence contient de longues descriptions
d'auteur qu'aucun regard ne peut deviner. Ce qui compte est plus bas.*

### Décrire un personnage : ça marche

Sur un sprite de personnage, la description est juste. Le voyageur encapuchonné, décrit par vous
comme *« deep teal hooded cloak… ochre long coat »*, est vu par qwen3.5:4b comme :

> `pixel art character, teal hooded cloak, brown tunic and boots, holding lit lantern, side view,
> white background, black outline`

La couleur, le vêtement, l'objet tenu, la vue et le contour sont tous corrects. C'est un point de
départ honnête pour un signalement.

### Décrire un petit objet : ça échoue

Sur une hache de guerre en fer à runes, qwen3.5 voit `brown shield, orange center` et gemma3 voit
`sword, helmet, stars`. Ni l'un ni l'autre ne reconnaît une hache. Sur les objets d'inventaire —
petits, isolés, sans échelle de référence —, ces modèles se trompent de sujet.

### Relever le style : c'est le meilleur des quatre usages

Et c'est la surprise du banc. Sur les douze images, le relevé de style est **juste et
constant** :

> `pixel art, flat shading, limited palette, blocky outlines`
> `pixel art, thick black outlines, flat shading, muted earth tones`
> `pixel art, dithering, bold outlines, limited palette`

C'est du vocabulaire exact, dans le registre de votre bible, et ça remplirait vraiment les cases
*rendu* et *trait*.

### Mais aucun chiffre n'est fiable, et c'est le piège de cette section

gemma3 annonce des tailles de grille précises — `16x32`, `8x8`, `32x32`. **Confrontées à la vraie
valeur écrite dans le prompt d'origine : zéro juste, une franchement fausse** (il annonce
`16x32 grid` pour une image faite en `64x64`), les autres invérifiables.

Le modèle ne compte pas les pixels : il produit un nombre qui *ressemble* à une réponse. Et un
faux chiffre de grille versé dans la bible changerait en silence toutes les générations
suivantes.

**ministral-3:3b est à écarter de cet usage** : il invente franchement — des `glowing eyes` sur un
personnage qui n'en a pas, des `rectangular window cutouts on chest`, et il répète trois fois
`backpack straps` dans la même réponse.

### Ce que ce banc conclut

| | verdict |
|---|---|
| Décrire un personnage | **utilisable**, comme brouillon relu |
| Décrire un objet d'inventaire | **inutilisable** — se trompe de sujet |
| Relever le style de dessin | **le meilleur usage des quatre**, si l'on n'en garde aucun chiffre |
| Tout nombre rendu (grille, palette, taille) | **à jeter systématiquement** |

---

## 7 · Ce que le dépôt autorise

**La règle qui semblait interdire ne l'interdit pas.** `docs/ARCHITECTURE.md:54` dit :
*« **Aucun modèle génératif local.** »* — et elle a **déjà été précisée une fois**, en T2, pour
admettre un modèle de découpe : *« la règle vise ce qui **fabrique** une image, pas ce qui en
découpe une »*. Un modèle qui écrit du texte ne fait ni l'un ni l'autre. La même précision
s'applique, et le précédent existe.

Le motif invoqué par la règle — *« évite le gestionnaire de mémoire vidéo, les rechargements »* —
est réel, et c'est lui que la mesure sur processeur seul annule : à 1,1 seconde sans carte, il n'y
a pas de mémoire vidéo à gérer du tout.

**Le refus de traduire, lui, mérite mieux qu'une levée.** Il est écrit trois fois dans le code, et
toujours avec la même raison :

> *« Le produit ne traduit pas à sa place — il n'invente pas un texte qui partira dans un appel
> payé. »* — `atelier/domaine/direction.py:51`

Un modèle local ne coûte rien : **la moitié « appel payé » de l'objection tombe.** Mais l'autre
moitié — *« ne pas décider à la place de l'auteur »* — ne tombe pas, et mes mesures viennent
justement de montrer qu'elle avait raison. Elle doit devenir la règle de conception du bouton, pas
son obstacle.

**Trois contraintes de forme, déjà écrites.**

1. **Pas d'icône de baguette.** `docs/design-motifs.md` ferme la liste des glyphes :
   *« un glyphe n'entre que là où aucun mot ne peut tenir et où la forme est déjà lue sans
   apprentissage »*. Une baguette échoue aux deux. **Le bouton sera un mot**, comme les `corriger`
   et `défaire ›` existants.
2. **Il n'y a aucune annulation pour le texte.** Le seul `Ctrl+Z` du produit vit sur la toile et
   s'efface dès qu'on écrit dans un champ. Le bouton doit donc **apporter sa propre marche
   arrière** — et le motif *« proposé … modifiable · défaire »* existe déjà dans la barre de prompt.
3. **Le texte d'avant n'a nulle part où aller.** `generation.json` ne garde que le prompt final
   assemblé. Si la baguette réécrit avant l'assemblage, l'original n'existe sur aucun disque : la
   réussite n'est pas rejouable. **C'est un champ à décider avant d'écrire du code.**

**Ce qu'il y a à écrire.** Aucun appel de texte n'existe aujourd'hui dans le dépôt — vérifié par
recherche : zéro occurrence. Il faut donc un **troisième port** (`texte → texte`), sur le patron
des deux existants, un adaptateur qui parle à Ollama, un service, une route, un bouton. Le
précédent de route est déjà là : `POST /api/prompt/preview` calcule le texte exact qui partira
sans rien facturer, sans rien écrire, et sans sortir de la machine.

**Enfin, le sujet était déjà au plan.** La tranche `A11` prévoit un moteur local *« dans la même
liste que les modèles payants, avec la même phrase de grisé quand il n'est pas là »*. Un modèle de
texte local entre exactement dans ce moule.

---

## 8 · Ce que je recommande

**La forme demandée — un bouton « améliorer avec l'IA » un peu partout — est celle qui marche le
moins bien.** Ce n'est pas un refus de l'idée : c'est le résultat de la mesure. « Un peu partout »
représente 45 à 60 boutons sur un projet rempli, et « améliorer » est très exactement l'usage sur
lequel aucun des quatorze modèles n'a tenu la consigne.

Je propose de la retourner, en trois marches indépendantes, de la plus rentable à la plus
incertaine. **Chacune se livre seule et se juge seule.**

### Marche 1 — dire que c'est du français, sans aucun modèle

Le bug mesuré est *« du français est parti dans un appel payé »*, six fois sur 63. Une détection
de français à l'écran de confirmation le prend **en totalité** : zéro modèle, zéro port, zéro
licence, et une demi-journée de travail. Elle dit *« cette case part en français »* et propose
l'étiquette du catalogue qui dit la même chose en anglais — **le texte existe déjà dans neuf cas
sur dix**.

C'est la marche à écrire en premier, et elle rendrait peut-être les autres inutiles.

### Marche 2 — traduire, et seulement traduire

Un bouton qui **ne fait qu'une chose** : rendre en anglais ce que vous venez d'écrire en français.
Il n'ajoute rien, ne réordonne rien, n'embellit rien.

- Sur les **quelques champs qui gardent leur texte** — la consigne d'une pose, celle d'une
  direction, la description d'une chose. Pas sur la barre de prompt : ce qu'on y écrit n'est
  jamais enregistré, donc chaque case d'une planche de 24 rappellerait le modèle et rendrait 24
  textes différents pour le même personnage. C'est fabriquer l'incohérence qu'on voulait réduire.
- **Avec un lexique figé** d'une vingtaine de mots de métier, écrit à la main. C'est ce qui
  supprime les *colombages* devenus murs de pierre.
- **Il propose, il ne remplace pas.** Le texte d'origine reste la source ; la proposition
  s'affiche à côté, avec le motif `proposé … modifiable · défaire` déjà en place.
- Modèle : **qwen3.5:4b** ou **qwen3.5:9b**, tous deux en Apache 2.0, chargés à l'ouverture de
  l'atelier, avec repli sur le processeur si la carte est prise.

### Marche 3 — relever le style d'une planche de référence

**C'est l'usage le mieux noté du banc, et ce n'était pas celui qu'on cherchait.** Montrer un
artwork officiel et en recevoir le style de dessin — `pixel art, thick black outlines, flat
shading, muted earth tones` — marche, et remplirait vraiment les cases *rendu* et *trait* de la
bible. C'est aussi le quatrième usage de votre propre tableau.

Trois bornes, toutes dictées par les mesures :

- **Aucun chiffre n'est conservé.** Ni taille de grille, ni nombre de couleurs, ni dimension. Le
  modèle en produit qui ont l'air justes et ne le sont pas — mesuré : zéro sur les vérifiables.
  Ces valeurs-là, le projet les connaît déjà.
- **Le style seulement, jamais le sujet.** Décrire un personnage marche à peu près ; décrire un
  objet d'inventaire se trompe de sujet — une hache de guerre vue comme un bouclier, puis comme
  une épée avec un casque.
- **Modèle : gemma3:4b ou qwen3.5:4b.** Pas ministral-3, qui invente des détails absents.

Coût : 2 secondes par image, une seule fois par planche. C'est un geste rare, pas un bouton
répété — donc le meilleur rapport entre ce que ça apporte et le risque que ça crée.

### Ce que je recommande d'écarter

- **L'enrichissement automatique d'un texte court.** Mesuré : 220 inventions, aucun modèle fidèle,
  et une étude sur 1 900 personnes qui trouve 58 % de dégradation. Si vous y tenez, alors
  seulement au-dessus d'un seuil — le banc montre qu'à sept mots la fidélité revient — et jamais
  sans afficher ce qui a été ajouté.
- **Le remplissage automatique du catalogue d'étiquettes.** Une sur cinq serait fausse, et rien ne
  dirait laquelle. Vos 70 étiquettes valent mieux que ce qu'un modèle local sait produire ; elles
  sont d'ailleurs devenues le corrigé qui l'a prouvé.

### Sur le choix local ou distant

Vous avez répondu que le local est *« un choix de prix, pas une exigence »*. Alors trois faits :

1. **Le prix est nul des deux côtés** — un modèle de texte gratuit à distance ne coûte pas plus
   qu'un modèle local.
2. **Le travail est le même** : aucun appel de texte n'existe dans le dépôt, il faut un port neuf
   dans les deux cas. Le local est même légèrement plus simple : pas de clé à déclarer, pas de
   dépense à comptabiliser.
3. **Un modèle distant serait nettement meilleur** — les erreurs du §4 viennent de la petite
   taille, pas du fait d'être local. En échange, il dépend d'une gratuité qui peut cesser, et
   d'une connexion.

Ma recommandation : **commencer en local**, parce que c'est déjà installé, que ça ne dépend de
personne, et que la marche 2 est assez simple pour que la qualité d'un petit modèle suffise. Et
garder le port ouvert : les trois mises en œuvre — Ollama, un service gratuit, un service payant —
partagent la même interface, et le choix reste réversible.

---

## 9 · Rectifications

*Ce que cette étude a d'abord cru, et a dû corriger.*

**Le 3 septembre, en cours d'étude — j'ai d'abord mesuré la génération précédente.** Les neuf
premiers modèles éprouvés (qwen3, gemma3, llama3.2, granite4, mistral) étaient ceux que je
connaissais. Une vérification du registre a montré que qwen3.5, ministral-3, granite4.2 et
translategemma existaient. Le banc a été refait. Conclusion inchangée, chiffres relevés.

**Ma première mesure de qualité était fausse, et c'est le jury à l'aveugle qui l'a montré.**
J'annonçais « 100 % utilisable » : ce chiffre ne mesurait que la **forme** — pas de préface, pas
de guillemets, pas de français. Sur le **sens**, les mêmes réponses valent 33 sur 100. Une mesure
mécanique ne remplace pas une lecture, et le dépôt le savait déjà : il est écrit ailleurs que la
note automatique d'une planche s'est révélée *sans rapport* avec le jugement de l'auteur.

**Deux recherches se contredisaient sur la licence de Ministral.** Tranché en lisant le fichier
livré avec le modèle : **Apache 2.0**.

---

## 10 · Ce que je n'ai pas pu vérifier

1. **Est-ce que le français dégrade vraiment l'image ?** Les six prompts fautifs ont bien produit
   des images, et elles sont correctes à l'œil. Mais **il n'existe aucune image jumelle en
   anglais** pour comparer : ce n'est pas une expérience contrôlée. L'essai décisif serait de
   renvoyer un de ces six prompts avec ses cases traduites et de comparer les deux images. **Cela
   coûterait de l'argent, et je ne l'ai pas engagé.**

2. **Le plafond électrique de la carte.** Votre étude de la vidéo locale avait établi que le
   chiffre décisif n'était pas les 8 Go mais les 100 W de la carte portable. Mes mesures sont
   toutes faites sur des appels courts, où ce plafond n'a pas le temps de mordre. Un usage soutenu
   — vingt-quatre cases enchaînées — n'a pas été éprouvé.

3. **La qualité en français des candidats actuels.** Aucune évaluation ouverte et sérieuse ne
   compare qwen3.5, ministral-3 et granite4.2 sur le français. Les classements trouvés sont soit
   auto-déclarés, soit fabriqués pour le référencement. Mon banc est donc, à ma connaissance, la
   seule mesure existante sur ce registre précis — ce qui est autant une limite qu'un résultat.

4. **La tenue dans le temps.** Un modèle rend deux fois la même réponse à température basse, mais
   je ne l'ai pas éprouvé sur plusieurs jours ni après une mise à jour d'Ollama.

5. **Le banc des images est petit.** Douze images, quatre modèles. C'est assez pour voir qu'un
   objet d'inventaire n'est pas reconnu et qu'un chiffre de grille est inventé — ces deux-là sont
   nets. Ce n'est pas assez pour classer les modèles entre eux sur le relevé de style, et je ne
   l'ai donc pas fait.
