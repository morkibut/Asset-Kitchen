# Étude — GameForge AI : ce qu'il fait des assets, et les deux seules choses à en prendre

> **Ce document ne fait foi sur rien.** C'est une étude de dépôt voisin, dans la même famille
> qu'`Anatomie de SpriteCook.html` : elle regarde comment un autre produit fabrique ses
> assets, et dit ce qui vaut d'être repris. Rien de ce qui suit n'est cadré ni planifié. Quand
> une piste est tranchée, elle part dans `docs/PRD.md` ou `docs/PLAN.md` et ne laisse ici qu'un
> renvoi.
>
> Il se lit **à la demande**, jamais au démarrage d'une session.
>
> Écrite le 2 septembre 2026 sur [`RhythrosaLabs/gameforge-ai`](https://github.com/RhythrosaLabs/gameforge-ai),
> au commit [`a81cdca`](https://github.com/RhythrosaLabs/gameforge-ai/tree/a81cdca9235c3f685c602a2379cdf5ce5beb7700)
> du 3 juillet 2026 — 42 fichiers, JavaScript sans cadre, tout dans le navigateur, DALL·E 3 et
> Stability AI appelés depuis la page.
>
> **Rien n'y a été mesuré.** Le dépôt a été lu, jamais exécuté ; aucune de leurs images n'a été
> payée. Tout ce qui suit est de la lecture de code, et c'est dit. Les deux chiffres de cette
> note qui ne viennent pas de là — le prix d'une planche, le taux de bonnes — viennent de nos
> propres bancs (`docs/v3-animation.md`) et sont marqués comme tels.

---

## En un paragraphe

**GameForge n'a aucune technique de sprite** : ni planche, ni case, ni détourage, ni pixel art.
Quatre illustrations plates par jeu, collées sur des plans Three.js — le héros ne bouge jamais
les jambes. Sur ce terrain-là il n'y a rien à prendre. Deux de leurs mécanismes valent quand
même d'être regardés, et ils tombent de deux côtés opposés : **la table par type de sujet est
déjà tenue ici, et mieux** — c'est le barème d'échelles arrivé en T4 —, tandis que **faire
relire par un modèle l'image qui vient d'être produite est une piste neuve**. Cette seconde
vise exactement le chiffre le plus dur de la V3 : *onze bonnes planches sur cent onze, notées
une par une à la main* (`docs/v3-animation.md`).

---

## 0 · Leur chaîne, en cinq lignes

| Étape | Ce qu'ils font | Où |
|---|---|---|
| Le texte | quatre appels GPT en cascade — concept, monde, personnages, intrigue | [`game-plan-generator.js`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/game-plan-generator.js#L24) |
| Les images | une illustration par type, prompt figé + contexte, trois tentatives | [`image-generator.js`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/image-generator.js#L46-L65) |
| Les rôles | un appel GPT qui range chaque image dans le gameplay, en JSON | [`asset-analyzer.js`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/asset-analyzer.js#L50) |
| Le rendu | `PlaneGeometry` + `alphaTest: 0.1`, caméra orthographique | [`game-player.js:648`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/game-player.js#L648) |
| L'export | JSZip, plus un OBJ **écrit en dur** qui se présente comme un modèle 3D | [`download-manager.js:188`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/download-manager.js#L188) |

Aucune image n'est jamais relue après avoir été produite. Aucune image n'est jamais jointe à la
génération suivante — chaque asset repart de zéro, ce qui interdit toute cohérence de style
entre les quatre. C'est la différence de nature avec ce qu'on fait ici, et elle explique la
suite.

---

## 1 · La table par type de sujet — déjà tenue ici, et mieux

**Ce qu'ils ont.** Un objet unique, [`config.js`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/config.js#L91-L180),
qui associe à chacun des quatre types — `Character`, `Enemy`, `Background`, `Object` — trois
choses : un prompt de base d'une soixantaine de mots, une taille d'image, un drapeau de
transparence. Tout le reste du code lit cette table plutôt que d'écrire ses propres prompts.
L'intention est bonne, et c'est la seule chose de ce dépôt qui ressemble à une décision
d'architecture.

**Ce qu'on a déjà**, et qui la contient tout entière : le **barème d'échelles**
(`atelier/domaine/projet.py`, § *Le barème d'échelles*), arrivé en T4 contre un défaut mesuré
le 27 août 2026 — *un coffre aussi haut qu'un personnage*.

| Ce que leur table porte | Ce que porte une `Echelle` ici |
|---|---|
| une taille d'image en pixels | **une occupation en % de la case** — la bonne grandeur : la taille finale, elle, vient de la grille du projet |
| un drapeau de transparence | `silhouette`, qui dit si le sujet se découpe — un décor n'en a pas, donc pas de bandes vides ajoutées |
| — | `famille`, qui décide **quels artworks partent en référence** |
| — | le **modèle par défaut** de ce type de sujet |
| — | `poses`, la liste des attitudes que ce type réclame (E9) |
| un prompt de base par type | rien : le texte vient de la bible, des étiquettes et de l'auteur |
| figée dans le code | **réglable projet par projet** — `BAREME_PAR_DEFAUT` est un point de départ, pas une table de vérité |

**Le verdict est net : il n'y a rien à reprendre.** Leur table décide de trois choses figées
pour quatre types codés en dur ; le barème en décide de cinq, il se règle par projet, et
surtout `Demande.echelle` tient la promesse que leur table ne tient pas — *un seul mot, et il
n'y a rien à sélectionner au moment de générer*.

**Une seule ligne du tableau mérite une question, et elle reste ouverte.** Une `Echelle` porte
tout sauf du **texte** : « objet tenu » ne fait partir aucun mot anglais dans la demande, là où
leur table le ferait. Faut-il qu'un type de sujet porte son fragment, comme une étiquette porte
le sien ? *La règle des étiquettes livrées argumente contre* — un des trois tests d'entrée est
de **ne pas rejouer une autre case** (`atelier/domaine/etiquettes_livrees.py`), et un fragment
attaché au type ferait exactement ça pour un auteur qui a déjà décrit son sujet. La question
n'est pas tranchée ici ; elle est posée, pour qu'on ne la redécouvre pas dans six mois en
lisant le code de quelqu'un d'autre.

---

## 2 · Faire relire l'image par un modèle — la piste, et le défaut qui la rend inutile chez eux

### Ce qu'ils font

[`asset-analyzer.js`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/asset-analyzer.js)
envoie à GPT tout le plan du jeu, puis lui demande un JSON qui range chaque asset produit : qui
est le joueur, quels sont les ennemis et leur comportement, à quoi servent les objets, et — le
point intéressant — **les dimensions et la collision de chacun**. Le schéma est déclaré dans le
prompt, la réponse est forcée en JSON, et le reste du produit s'en sert comme d'une fiche
technique.

**Le geste est juste : produire l'image et la fiche qui va avec, d'un seul mouvement.**

### Le défaut, et il annule tout

Le modèle **ne voit jamais l'image**. Le contexte qu'on lui envoie contient, littéralement,
[la liste des noms de clés](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/asset-analyzer.js#L19-L20) :

```js
AVAILABLE IMAGE ASSETS:
${Object.keys(gamePlan.images || {}).join(', ')}
```

C'est-à-dire `character_image_1, enemy_image_1, background_image_1, object_image_1`. Les
dimensions et les collisions qui en sortent sont donc **inventées à partir d'un nom de
fichier**, et annoncées dans les journaux du produit comme une *« comprehensive deep
analysis »*. Ce n'est pas une relecture, c'est une devinette habillée.

**Ce qui reste une fois le défaut retiré : la forme du geste.** Un appel, un schéma JSON
déclaré, une réponse forcée — mais avec **l'image dans la demande**.

### Ce que ça viserait ici, et pourquoi maintenant

Pas les rôles de gameplay : l'atelier fabrique des images, il ne fait pas tourner un jeu. Ce
que ça viserait est le seul chiffre dur de la V3 (`docs/v3-animation.md`) :

- **onze bonnes planches sur cent onze**, neuf seulement dont le produit sache faire quelque
  chose — une sur douze ;
- ces cent onze planches ont été **regardées une par une par l'auteur**, en une passe ;
- et la mesure automatique écrite pour éviter ce tri **ne prédisait rien** : 9 % de bonnes
  parmi celles qu'elle retenait, 10 % parmi celles qu'elle rejetait.

La conséquence déjà tirée dans le plan est que le geste principal de la V3 est *commander
plusieurs planches et garder la bonne*. **Ce geste met un tri sur le chemin de l'auteur, à
chaque bande.** C'est là, et seulement là, qu'une relecture par un modèle aurait quelque chose
à faire.

**Et l'échec de la mesure automatique n'est pas un argument contre**, pour une raison précise :
cette mesure interrogeait un **substitut** — de combien la forme du personnage varie d'une case
à l'autre — en espérant qu'il suive la qualité, et il suivait l'incohérence de taille, qui est
plus fréquente. Un modèle à qui l'on montre la planche peut être interrogé sur **la question
elle-même**. Ce n'est pas une preuve que ça marchera ; c'est la raison pour laquelle le premier
échec ne le condamne pas.

### Le jeu d'épreuve existe déjà, et il est payé

C'est ce qui rend la piste peu chère à trancher, et c'est le seul argument vraiment fort de
cette note :

- **`essais/notes-auteur.json` — 111 planches notées `bon` / `moyen` / `mauvais`** par
  l'auteur, vérifié le 2 septembre 2026 ;
- **136 PNG sur le disque**, dans `essais/resultats_animation/` et `essais/resultats_recette/` ;
- la colonne *découpable* est déjà décidée par une mesure sûre, et elle sert de deuxième vérité,
  indépendante de l'œil.

**Aucune image n'est à repayer.** Le seul coût d'un banc de relecture est celui des lectures
elles-mêmes, sur des planches déjà produites et déjà jugées par l'œil qui compte.

### Le protocole, dans l'ordre

1. **Poser des questions vérifiables, pas un avis.** Une note globale ramènerait le flou de la
   mesure de forme. Ce qu'on demande sont des faits qu'un œil confirme ou infirme : *le
   personnage garde-t-il la même taille d'une case à l'autre ? le quadrillage a-t-il été
   redessiné ? y a-t-il une barre de sol sous le sujet ? les cases décrivent-elles une
   progression, ou huit poses sans lien ?* — schéma JSON déclaré, réponse forcée, comme chez
   eux.
2. **Refaire exactement le tableau qui a tué la mesure de forme**, sur les mêmes 111 planches :
   part de bonnes parmi les retenues, part de bonnes parmi les rejetées. Si les deux colonnes se
   ressemblent, la piste est morte le jour même et pour trois fois rien.
3. **Juger sur le bon critère.** Ce qui compte n'est pas la justesse moyenne : c'est de **ne
   jamais jeter une bonne planche**. Une relecture qui écarte les trois quarts des mauvaises en
   gardant toutes les bonnes est utile ; une relecture juste à 80 % qui perd une bonne planche
   sur onze fait perdre le seul objet qu'on cherchait.
4. **Huit tirages minimum par branche**, comme partout ailleurs dans ce dossier — ce banc-ci a
   déjà publié des conclusions fausses sur trois.

### Le seuil de prix, et il est bas

Une relecture n'est utile que si elle coûte **franchement moins cher qu'une planche de plus**.
L'arithmétique se fait sur nos propres chiffres : $0,237 pour huit planches `gpt-image-2`, soit
**environ trois centimes la planche** (`docs/v3-animation.md`). Une lecture qui approcherait ce
prix serait absurde — à trois centimes, mieux vaut commander une planche de plus que lire
celles qu'on a. **Le prix réel se prend dans le catalogue au moment du banc**, jamais supposé
ici : `docs/releve-fournisseurs.md` est l'endroit où il se relève.

### Où ça n'a pas le droit de vivre

Deux invariants d'architecture bornent la piste avant qu'elle soit écrite :

- **`docs/ARCHITECTURE.md` §4, règle 4** — le post-traitement est CPU, pur, sans réseau. Une
  relecture qui appelle un modèle **ne peut pas être une place de la recette**, ni vivre dans
  `atelier/image/`. Elle est un service, au-dessus du port du fournisseur.
- **§4, règle 1** — le vocabulaire du fournisseur ne franchit pas son adaptateur. Le nom du
  modèle qui relit ne remonte pas plus haut que celui du modèle qui dessine.

**Et elle ne remplace pas le contrôle de remplissage.** Le plan en réclame un (`docs/PLAN.md`,
§ V3) : *une silhouette qui occupe plus de neuf dixièmes de sa boîte n'est pas un sujet, c'est
une case*. Celui-là est un **fait vérifiable**, il se compte en numpy, il ne coûte rien et il ne
se trompe jamais. Le confier à un modèle serait payer pour rendre incertain ce qui est certain.
Les deux sont complémentaires, dans cet ordre : la machine compte ce qui se compte, le modèle ne
parle que de ce qui ne se compte pas.

---

## 3 · Ce qu'il ne faut pas reprendre

- **Les prompts de variation en ternaire imbriqué**
  ([`image-generator.js:48`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/image-generator.js#L48)) —
  *« focus on different equipment and pose »* pour la deuxième image d'un personnage. C'est
  écrire dans le code ce qui appartient au texte de l'auteur.
- **Aucune image jointe entre deux assets d'un même jeu.** C'est leur défaut central, et c'est
  précisément ce que notre réinjection existe pour éviter.
- **Un drapeau de transparence que la couche d'appel ignore.** Ils passent
  `transparent: type !== 'Background'`, et leur adaptateur DALL·E 3 ne le lit jamais
  ([`api-client.js:96`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/api-client.js#L96)) :
  le fond reste dans l'image, et l'`alphaTest` du moteur n'a pas d'alpha à tester. **Un réglage
  qui ne fait rien est pire qu'un réglage absent.**
- **Des URL éphémères comme source de vérité.** Ils gardent l'URL renvoyée par DALL·E, qui
  expire ; l'export les `fetch` une par une, avec repli sur une image de remplacement quand
  c'est trop tard. Ici, *les fichiers font foi* (§4, règle 3).
- **La « conversion 3D »**
  ([`download-manager.js:188`](https://github.com/RhythrosaLabs/gameforge-ai/blob/a81cdca9235c3f685c602a2379cdf5ce5beb7700/download-manager.js#L188)) —
  un OBJ humanoïde écrit en dur dans le code, plus une image du sujet « en vue isométrique ».
  Aucun maillage n'est jamais reconstruit. À noter parce que la V3 garde une piste 3D bien
  réelle, elle (`docs/releve-fournisseurs.md` § *Hors relevé · Meshy*) : c'est le contre-exemple
  de ce qu'elle ne doit pas être.

*Une chose est bien faite chez eux et ne nous apprend rien parce qu'on la fait déjà : trois
tentatives par image, puis une valeur `'placeholder'` écrite dans le résultat au lieu d'une
exception qui casserait le lot.*

---

## Les limites de cette étude, à dire avant qu'on s'appuie dessus

**Le dépôt a été lu, pas exécuté.** Aucune de leurs images n'a été payée, aucun de leurs prompts
n'a été essayé. Il est possible que leur table de types donne de meilleurs résultats que sa
lecture ne le laisse croire — on n'en sait rien, et cette note ne le prétend pas.

**Ils ne font pas le même produit.** GameForge va d'une phrase à un jeu jouable ; l'atelier
fabrique des images qu'un auteur emporte. Les comparer sur les assets est légitime, sur le reste
non — la moitié de leur dépôt est un moteur de jeu qui n'a pas d'équivalent ici.

**La piste de la section 2 n'est pas mesurée.** Rien n'a été relu, aucune lecture n'a été payée,
et le seuil de prix est calculé sur nos chiffres, pas sur une offre relevée. Ce qui est acquis
tient en une phrase : **le jeu d'épreuve existe, il est déjà payé, et il rendrait un verdict pour
quelques centimes.**
