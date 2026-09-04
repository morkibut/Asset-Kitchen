# Ce qui décrit une image jointe n'est pas là où l'image est

> **De quoi on parle.** Quand l'atelier demande une image à un fournisseur, il joint des images de
> référence : le personnage tel qu'il est déjà dessiné, un artwork officiel pour le style, et —
> quand on habille quelqu'un — la planche du corps à modifier. Le texte envoyé contient une
> **légende** qui dit au modèle à quoi sert chacune : *« Image 1 — …, Image 2 — … »*. L'écran de
> confirmation montre les deux : la légende, et les images. **Mais pas au même endroit.**

---

## 1 · Ce que l'auteur a écrit — 3 septembre 2026

> dans la fenetre de confirmation d'une commande juste avant de payer la génération, la section
> "les images jointes" qui parle en fait des références des images jointes est incompréhensible, ne
> devrait pas se trouver la mais relier a chaque image jointe dans la section des iamges jointe
> plus bas. d'ailleurs il y a un bug sur ca en bas. ca me propose un gabarit de grille en image
> jointe, et un artwork alors que loguiquement la vue que je génère un "equipement" sur une pose,
> je devrait avoir en référence la pose concerné (voir screen). et je ne peu pas deselectinoné ni
> voir ce fameux gabarit (que je n'ai jamais validé d'ailleurs...).

---

## 2 · Ce que le produit fait aujourd'hui

**Tout ce qui suit est mesuré le 4 septembre 2026** sur le cas exact de la remarque — un sac de
voyage posé sur une pose du pèlerin, projet *Le Marais du Vieux Moulin* — sur une copie des vraies
données, sans qu'un centime parte.

### a) Trois images partent, et l'écran les traite de trois façons

| L'image | Où l'écran la met | Vignette | On peut l'ouvrir | On peut la décocher |
|---|---|---|---|---|
| **1** — le personnage déjà dessiné | une ligne de la section *les images jointes* | **oui** | **oui** | **oui** |
| **2** — l'artwork officiel, pour le style | une ligne de la même section | **oui** | **oui** | **oui** |
| **3** — la planche du corps à habiller | **un paragraphe de texte, sous la liste** | **non** | **non** | non — *et c'est voulu* |

Les deux premières passent par le composant qui dessine une image jointe, avec sa vignette et le
geste qui l'ouvre en grand ([Envoi.tsx:1052](interface/src/composants/Envoi.tsx:1052)). La
troisième est une phrase ([Envoi.tsx:416](interface/src/composants/Envoi.tsx:416)).

**Que la troisième ne se décoche pas est une décision écrite**, et elle est juste : *« décocher
reviendrait à demander une planche sans dire à quoi elle ressemble »*. **Qu'on ne puisse pas la
voir n'a jamais été décidé** — c'est un manque, pas un choix.

### b) ⚠️ L'écran la nomme autrement que le texte qui part, sur le même écran

C'est le point le plus dur, et il n'était pas dans la remarque. Les deux textes ci-dessous sont
affichés **en même temps, sur le même écran, à quelques centimètres l'un de l'autre** :

| | Ce qui est écrit |
|---|---|
| **le texte qui part au modèle**, plus haut | *« Image 3 — THE SPRITE SHEET TO CHANGE: 1 sprites of the same character, already drawn. Keep every cell where it is and change only what the request below asks »* |
| **l'écran**, plus bas | *« Image 3 · le gabarit de la grille, qui dit au modèle où poser les 1 sujets »* |

L'un dit *voici la planche existante, n'y change que ce qu'on demande* ; l'autre dit *voici une
grille vide, place les sujets dedans*. **Ce sont deux demandes opposées, et une seule image.**
L'auteur cherchait donc une image qu'il aurait validée, et ne la trouvait pas : c'est son propre
corps, redessiné à la volée.

### c) Le serveur sait très bien laquelle des deux c'est — il ne le dit pas à l'écran

Le produit distingue **deux rôles**, et une seule fonction en décide, exprès pour qu'aucun rang ne
puisse se tromper ([generation.py:1310](atelier/services/generation.py:1310)) :

- **le gabarit** — des cases dessinées d'un trait clair, pour dire où poser des sujets qui
  n'existent pas encore ;
- **la planche** — les corps déjà là, à modifier.

Le commentaire du serveur l'écrit noir sur blanc : *« Une planche d'équipement en envoie une aussi
— et c'est la planche elle-même, pas un gabarit »*
([generation.py:2190](atelier/services/generation.py:2190)). Mais ce qu'il renvoie à l'écran est un
seul nombre, `gabarit : 1`, **sans le rôle**. **L'écran n'a donc pas de quoi choisir ses mots**, et
il a été écrit pour le cas le plus ancien des deux.

### d) La légende ne peut pas être déplacée — et c'est ce qui borne la remarque

L'auteur voudrait que la légende quitte le haut de l'écran pour rejoindre chaque image. **Elle ne
le peut pas** : elle est du **texte qui part au modèle**, et l'écran promet de montrer ce qui part,
mot pour mot, dans l'ordre où c'est assemblé. La retirer de là ferait un trou dans cette promesse.

Aujourd'hui elle est **une seule ligne**, dans le groupe nommé *« ce que les images disent »*
([Envoi.tsx:70](interface/src/composants/Envoi.tsx:70)), qui appartient à la partie *les
références*. Trois descriptions collées en un bloc, **en anglais**, à un endroit où l'on ne regarde
pas les images.

---

## 3 · Pourquoi c'est comme ça

**Les deux moitiés de l'écran ont été construites pour deux raisons différentes, et personne ne les
a mises face à face.** La liste des images sert à **décocher** ; c'est pour ça qu'elle porte des
cases et des vignettes. La légende sert à **montrer ce qui part, mot pour mot** ; c'est pour ça
qu'elle est dans le texte, en anglais, telle qu'elle partira. Chacune est juste dans son ordre à
elle. Ce qui manque est le lien.

**Le libellé fautif est plus vieux que le cas qu'il décrit.** Le gabarit — la grille vide — existe
depuis `C2`. La planche d'équipement est arrivée en `C3`, elle a réemployé la même place dans
l'appel et le même compteur, et **la phrase de l'écran n'a pas été rouverte**. Elle disait vrai le
jour où elle a été écrite ; c'est très exactement le motif que la `V3.1` a nommé et compté.

**Aucun essai ne pouvait l'attraper.** Le dépôt vérifie que la bonne image part — et elle part.
Aucun essai ne compare **ce que l'écran dit d'une image** à **ce que le texte en dit**.

---

## 4 · Ce qui borne la solution

- **La légende reste dans ce qui part.** Elle ne se déplace pas ; elle peut être **redite** à côté
  de chaque image.
- **La troisième image ne devient pas décochable.** La raison est écrite et elle tient.
- **La voir ne demande aucun fichier neuf.** Les deux sortes d'images sont des octets que le serveur
  fabrique déjà pour l'appel ; il sait aussi les rendre en aperçu sans rien ranger sur le disque.
- **Une seule condition décide du rôle**, et cette règle-là ne bouge pas : ce qui manque est de
  faire voyager sa réponse jusqu'à l'écran, pas de la recalculer ailleurs.
- **Rien ici ne coûte un centime.**

---

## 5 · Les pistes

### A · Le rôle voyage jusqu'à l'écran, et l'écran dit le vrai nom

Le serveur renvoie **lequel des deux rôles** il a choisi, et l'écran a deux phrases au lieu d'une :
*la planche du corps, que le modèle doit modifier* d'un côté, *le gabarit de la grille, qui dit où
poser les sujets* de l'autre.

**Ce que ça coûte** — très peu : la décision existe, il s'agit de la transmettre.
**Le risque** — aucun. **C'est la réparation d'un mensonge**, et elle ne dépend d'aucune des autres.

### B · L'image jointe devient une ligne comme les autres

La troisième image rejoint la liste, avec sa vignette et le geste qui l'ouvre en grand — mais **sans
case à cocher**, et avec sa raison écrite à la place. Le produit a déjà un mot pour ça : *le grisé
porte sa raison*.

**Ce que ça coûte** — la vignette demande une adresse pour une image qui n'en a pas ; l'aperçu de la
superposition montre déjà comment rendre une image qui n'existe nulle part.
**Le risque** — une case grisée dans une liste de cases est exactement ce que la décision d'origine
voulait éviter. **Il faut donc que ce ne soit pas une case**, mais une ligne sans case : le dessin
doit le dire sans ambiguïté.

### C · La légende se démonte et s'accroche à chaque image

La légende reste où elle est — elle part au modèle —, mais l'écran en **recopie le morceau qui
concerne l'image** sous chaque ligne de la liste. *Image 1* n'est plus un numéro à rapprocher à la
main : la phrase est sous la vignette.

**Ce que ça coûte** — le serveur doit rendre la légende **découpée par image** au lieu d'un bloc.
Il l'écrit déjà morceau par morceau pour l'assembler.
**Le risque** — la même phrase apparaîtrait à deux endroits. C'est voulu, et il faut que l'écran le
dise : en haut *ce qui part*, en bas *ce que ça décrit*.

### D · Traduire la légende

Elle est en anglais parce que le modèle la lit en anglais. La montrer en français à côté de l'image
la rendrait lisible — au prix d'un second texte à tenir d'accord avec le premier.

**Ce que ça coûte** — peu à écrire, cher à maintenir. **Le risque** — c'est la fabrique à deux
vérités que le dépôt refuse partout ailleurs. *À n'ouvrir que si `C` ne suffit pas.*

---

## 6 · Ce qui est tranché — 4 septembre 2026

**Tranché par l'auteur : `A`, `B` et `C` ensemble, en `V2.4`, tranche `M4`. `D` est écartée.**

### a) Les trois pistes retenues, et leur ordre est celui de la construction

- **`A` — le vrai nom.** Le rôle voyage du serveur jusqu'à l'écran, et l'écran a deux phrases au
  lieu d'une. **Elle passe en premier**, parce que tant que l'écran appelle *gabarit* une planche,
  rapprocher la légende ne ferait que **coller l'une contre l'autre les deux phrases qui se
  contredisent**.
- **`B` — la rendre visible.** Elle rejoint la liste avec sa vignette et le geste qui l'ouvre en
  grand, **sans case à cocher** et avec sa raison écrite à la place.
- **`C` — la légende recopiée sous chaque image.** C'est la demande d'origine, et elle arrive en
  dernier parce qu'elle n'a de sens qu'une fois les deux premières faites.

### b) La traduction est écartée, et il faut dire pourquoi

Montrer la légende en français à côté de l'image la rendrait lisible d'un coup — mais elle
existerait alors **deux fois**, en deux langues, à tenir d'accord. C'est la fabrique à deux vérités
que le dépôt refuse partout ailleurs. *Si `C` ne suffit pas à rendre la légende compréhensible,
la question se rouvre ; elle ne se rouvre pas avant.*

### Ce qui reste ouvert

**Le dessin de la ligne sans case.** Une ligne sans case dans une liste de cases doit se lire
autrement qu'une case grisée, et c'est exactement ce que la décision d'origine voulait éviter.
*À trancher en construisant, contre le motif écrit du dépôt — « le grisé porte sa raison ».*

---

## Ce que cette remarque recoupe

- **`M3`** — l'écran qui fige à chaque lettre. Même écran, autre couche : celle-ci porte sur ce
  qu'il **dit**, `M3` sur ce qu'il **fait**. Elles ne se gênent pas.
- **La remarque sur les mots de la planche** — *« a sprite sheet of 1 sprites, exactly 1 columns and
  1 rows »*, et un écran qui parle de *cases* au pluriel pour une seule case. **C'est le même
  paragraphe de texte que la légende**, et les deux remarques le corrigeront ; à traiter ensemble ou
  à la suite.
- **`G1`** — les phrases qui ont cessé d'être vraies. Le libellé du *gabarit* est une dixième du
  même genre, découverte après la clôture de la tranche : écrite juste, démentie par un changement
  venu d'ailleurs.

---

## Ce que la tranche a livré — 4 septembre 2026

**`M4` est close le jour même de l'arbitrage.**

**La question laissée ouverte ci-dessus est tranchée : la ligne sans case.** La colonne de la case
reste **vide** au lieu de porter un carré grisé — la vignette garde ainsi son alignement avec celles
du dessus — et la raison s'écrit à la suite du nom, dans le gris des origines. Le motif du dépôt
— *le grisé porte sa raison* — n'est pas enfreint : il vaut pour ce qu'on **pourrait** faire et qui
est refusé ici, et cette image-là n'est refusée nulle part. Une case grisée aurait demandé de
comprendre pourquoi elle l'est ; une ligne sans case dit qu'il n'y a rien à décider.

**La traduction de la légende reste écartée, et elle n'a pas eu à se rouvrir.** La légende est
recopiée sous chaque image, telle qu'elle part, découpée **par celui qui l'a écrite** — recouper le
bloc à l'affichage aurait été une seconde vérité sur la numérotation.

**Et la réparation est descendue d'un cran.** Le vrai défaut n'était pas le mot de l'écran : c'était
que la décision *gabarit ou planche* existait **deux fois** — dans le texte qui nomme les images, et
dans le compte des images — et que la seconde ne rendait qu'un nombre. Elle vit désormais dans une
seule fonction, que les deux appellent.

*Le détail de ce que la construction a appris est dans `docs/status/etat.md`, à l'entrée du
4 septembre 2026 ; les critères d'acceptation tenus sont dans `docs/PLAN.md`.*
