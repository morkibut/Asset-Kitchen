# Plan : le coup de main — une aide qui ne prend pas de place

> **Demandé par l'auteur** le 19 septembre 2026, à partir d'un manque de sc-clone qui lui
> servait : une option qui améliorait le texte de génération et le traduisait en anglais avec
> un petit modèle. L'idée s'élargit ici à une aide qui **connaît l'application** et sait aussi
> répondre à « comment on fait ça, ici ».
>
> **Chantier à part, ouvert après TU12 et TU13.** Il ne bloque rien et rien ne le bloque.
>
> Quel modèle sur quelle tranche : [PLAN-assistant-affectation.md](PLAN-assistant-affectation.md).
>
> Ce document fait foi sur l'ordre de construction et les critères. Le vocabulaire vit dans
> `docs/vocabulaire.html`, l'apparence dans `docs/DESIGN.md`.

---

## Ce que c'est, en une phrase

**Une marque discrète au bout d'un champ, et une touche.** Rien d'autre n'apparaît tant qu'on
ne la touche pas, et tout disparaît quand on a fini.

## Ce que c'est, en trois gestes

1. On écrit un texte de génération en français, approximatif. On touche la marque au bout du
   champ. Une proposition en anglais s'affiche **à côté** du texte d'origine. On garde, ou on
   ferme.
2. On ne sait plus à quoi sert un réglage. On presse une touche, on demande, la réponse
   s'affiche sous la ligne. Échap, et l'écran est comme avant.
3. Un bouton est grisé et la raison ne suffit pas. La même touche, la même ligne : le coup de
   main sait sur quel écran on est et ce qui bloque, et il le dit en clair.

## Ce que ce n'est pas

- **Pas une fenêtre de discussion.** Ni bulle flottante, ni onglet, ni panneau qu'on ouvre et
  qu'on referme. Une aide qui occupe un coin d'écran en permanence est une aide qu'on finit par
  masquer.
- **Pas un second agent.** Il ne fabrique rien, ne modifie aucune recette, n'appelle aucun
  outil, ne clique sur rien. Il écrit du texte, et l'auteur décide.
- **Pas une encyclopédie.** Il répond sur *cette* application. Une question hors sujet reçoit
  « je ne sais pas », ce qui vaut mieux qu'une réponse plausible sur un produit qui n'existe pas.

---

## Décisions d'architecture

1. **Trois métiers, jamais quatre.**
   - améliorer un texte de génération, et le rendre en anglais ;
   - répondre à une question sur l'usage du produit ;
   - expliquer ce qui bloque, là où ça bloque.

   Chaque métier a sa consigne, fixe, écrite dans le dépôt. Il n'y a pas de conversation
   libre : chaque appel part seul, avec son contexte, et ne garde rien.

2. **Il propose, il ne remplace jamais.** Le texte amélioré s'affiche à côté de celui de
   l'auteur ; « Garder » l'adopte, Échap l'oublie. C'est déjà la règle du produit sur les
   prompts : *le texte de l'auteur n'est jamais réécrit en silence*
   (`docs/PLAN-tuiles.md` § TU5, `test_motif_qui_ne_dit_pas_le_compte_nest_pas_reecrit`).

3. **Il sait où il est, par une fiche écrite à la main.** Ce qui part à chaque appel :
   - une **fiche courte du produit** (`fiche-produit.md`, à écrire en CM2, quelques milliers de signes) :
     les lieux, ce qu'on y fait, le vocabulaire, les règles qui surprennent ;
   - le **contexte de l'instant** : l'écran, le champ visé, ce qui y est écrit, ce qui bloque.

   **Pas d'index du dépôt, pas de recherche automatique dans les docs.** Une fiche qu'on relit
   et qu'on corrige vaut mieux qu'un index qui cite juste assez pour se tromper — et elle coûte
   le même prix à chaque appel, prévisible.

4. **Un seul modèle, en dur, et local d'esprit.** `deepseek-v4-flash` par la passerelle
   OpenRouter déjà présente (`atelier/fournisseur/openrouter.py`, clé `OPENROUTER_API_KEY`).
   Aucun choix de modèle à l'écran : un choix ici n'apporterait qu'un réglage de plus à un
   endroit dont tout l'intérêt est de ne rien demander.

5. **Ce serait le premier appel de texte du produit.** L'adaptateur existant ne parle qu'à
   `/images`. Le coup de main ouvre `/chat/completions` — un adaptateur neuf, petit, séparé, qui
   ne partage avec l'autre que la clé et la politesse des erreurs.

6. **Il se tait quand il ne peut rien.** Pas de clé, pas de réseau, modèle indisponible, délai
   dépassé : **la marque n'apparaît pas**, et la touche ne fait rien. Jamais une fenêtre
   d'erreur, jamais un bouton qui déçoit. Un service d'agrément qui se plaint est pire que son
   absence.

7. **On voit ce qui part.** Le même geste que le tiroir des matières : « Voir ce qui part »
   montre la fiche, le contexte et la question, mot pour mot. Et ce qui ne part **jamais** :
   aucune image, aucune vignette, aucun contenu de la bibliothèque, aucun chemin de fichier de
   la machine. Du texte, et rien d'autre.

8. **L'argent : un plafond réglé une fois, pas une annonce par clic.** C'est la seule entorse
   à la règle du produit (*annoncer le prix avant de payer*), et elle est assumée : annoncer
   deux centièmes de centime avant chaque clic rendrait la fonction inutilisable, et
   habituerait à congédier une annonce de prix — exactement ce que la règle protège. À la
   place :
   - un **plafond mensuel**, réglé une fois dans les Réglages, **1 € par défaut** ;
   - un **compteur** dans l'écran des dépenses, à côté du reste ;
   - le plafond atteint, la marque disparaît et dit pourquoi, comme un manque de ComfyUI.

   ✔ **Tranché par l'auteur le 20 septembre 2026** : c'est le plafond réglé une fois. La
   règle d'annonce n'est pas abandonnée, elle est **déplacée** — elle porte sur le plafond,
   qu'on règle en connaissance de cause, et non sur chaque clic.

9. **L'agent ne s'en sert pas.** Il est déjà un modèle de langage ; lui donner un coup de main
   serait lui donner un miroir. Aucune route du coup de main n'entre dans le cadre de l'agent
   (RP2), et aucune ne se prête en MCP.

10. **Une seule pose pour tous les champs.** La marque se pose sur le composant de champ de
    prompt partagé (`interface/src/composants/ChampPrompt.tsx`), pas écran par écran. Ce qui
    n'est pas un champ de prompt ne la reçoit pas.

---

## Les tranches

### CM1 · Parler à un modèle de texte

Le petit adaptateur `/chat/completions` : un modèle, une consigne, un texte, une réponse en
flux. Court délai, abandon silencieux, erreurs traduites comme celles de l'autre adaptateur.

- [x] Le service répond en flux, et la première syllabe arrive avant la fin de la phrase.
- [x] Sans clé, il dit « indisponible » sans lever d'erreur, et rien ne casse ailleurs.
- [x] Le délai dépassé abandonne l'appel côté serveur — jamais un appel qu'on paie et qu'on
      n'affiche pas.
- [x] Ce que l'appel a coûté est compté, comme une génération d'image.
- [x] Aucun essai n'appelle le vrai modèle ; le fournisseur est doublé, comme partout.

*Fait le 25 septembre 2026.* **Ce que CM3 à CM6 appellent** :
`atelier.coup_de_main.repondre(consigne, texte, metier=…)`, un flux de `Morceau` — `texte`
au fil de l'eau, puis **un** `fin` (issue, raison, `consomme`, `unite`, `cout_usd`,
`cout_inconnu`), ou un seul `indisponible` ; jamais d'exception pour ce qui vient du
fournisseur. `etat()` dit si la marque paraît ; `depense(depuis)` dit ce qui est parti.
Côté écran, `GET /api/assist` et `POST /api/assist/{metier}` (une ligne JSON par morceau).
**Tranché** : un appel de texte **n'est pas une génération** — dix lecteurs de `generations`
supposent qu'une image peut en sortir — mais il se compte avec les mêmes mots (`consomme`,
`unite`, `cout_usd` déduit ; modèle `OpenRouter:deepseek/deepseek-v4-flash`). La dépense
s'écrit dans `donnees/appels-texte/<AAAA-MM>.jsonl` (une ligne par appel, jamais réécrite),
puis dans une table `appels_texte` de l'index, refaite de là quand on l'efface. Elle entre
dans le **total de l'atelier** et paraît « par modèle » dans les dépenses ; elle n'appartient
à **aucun jeu** (`texte_usd` dit l'écart entre le total et la somme des jeux). Les textes ne
sont pas gardés, seulement leurs longueurs. Délai total de 15 s, mesuré à chaque ligne ;
réponse bornée à 1 024 jetons. Un appel coupé avant le dernier message n'a pas de coût connu :
il est écrit `cout_inconnu`, jamais « gratuit », avec son numéro chez OpenRouter pour pouvoir
le relire un jour. **Ce qui reste** : la table des métiers (`CONSIGNES`) est **vide** — les
deux routes **attendent CM3** (8nonies), qui écrit la première consigne et pose la marque ; le
plafond (CM6) se branche dans `_empechement`, et devra **réserver sous verrou** pour tenir en
rafale ; aucune route ni outil MCP pour l'agent (décision 9, vérifié par un essai). **Pas vu** :
le vrai service — l'identifiant du modèle et la forme du coût en flux (`usage.cost` dans le
dernier message) sont pris de la documentation d'OpenRouter, sans aucun appel payé ; rien
n'est visible au navigateur, aucun écran ne s'en sert encore.

### CM2 · La fiche du produit

Un fichier neuf, `fiche-produit.md`, à côté des autres docs : ce qu'il faut savoir pour répondre à « comment on fait ça, ici ».
Les lieux, le vocabulaire (un *sujet*, une *famille*, une *collection*, un *jeu de tuiles*,
une *pièce*), les règles qui surprennent, et ce que le produit ne fait pas.

- [x] Elle tient en une page et se relit d'un trait.
- [x] Elle est écrite à la main, et un essai vérifie qu'elle ne contredit pas le vocabulaire
      publié (`docs/vocabulaire.html`).
- [x] Un mot nouveau du produit sans entrée dans la fiche est nommé par l'essai des docs.

*Fait le 24 septembre 2026.* Écrite à la troisième personne (l'interface tutoie, la fiche
décrit le produit pour le modèle) — décision notée en tête du fichier. « Contredire »
tranché en une phrase avant d'écrire l'essai (8sexies) : la fiche contredit le vocabulaire
publié si elle appelle une chose du jeu par un mot que la liste noire de
`docs/vocabulaire.html` remplace ; `tests/test_cm2_fiche_produit.py` le vérifie en relisant
cette seule liste, exactement comme `essais/essai_vocabulaire.py` le fait pour l'ossature —
préférée à une extension de cet essai, dont le contrat porte sur des libellés d'écran, pas
sur de la prose. Trois mots français ordinaires (dossier, chose, appel), déjà nommés
ordinaires par `essai_vocabulaire.py`, sont exclus de la mesure pour la même raison que
là-bas ; le nom du produit, « Asset Kitchen », est retiré du texte avant la recherche. Le
troisième critère vit dans `essais/essai_docs.py` (`mots_du_produit`,
`rapporter_fiche_produit`) : il relit le glossaire de `docs/vocabulaire.html` — hors
ossature et hors tableau d'outils absents — et nomme, sans jamais refuser, ce qu'aucune
ligne de la fiche ne reprend ; quinze mots mineurs (une vignette, une échelle, une source…)
le sont aujourd'hui, et c'est attendu d'une fiche d'une page. La fiche reste hors du
corpus de démarrage (`DEMARRAGE` d'`essai_docs.py` inchangé) et ne pèse donc pas sur sa
dérive. Vérifié : les deux essais tombent — le pytest échoue, le relevé de mots absents
s'allonge — quand la fiche est cassée exprès (8octies), puis la fiche est remise en
place. Ce qui n'est pas vu au navigateur : rien, CM2 ne touche aucun écran.

### CM3 · Améliorer un texte de génération

La marque au bout du champ, la proposition à côté, « Garder » ou Échap. Premier site : le
tiroir des matières des tuiles — celui d'où la demande est née.

- [ ] La proposition s'affiche à côté du texte d'origine, jamais à sa place.
- [ ] Elle sort **en anglais**, et garde ce que l'auteur a voulu dire — les noms propres et les
      mots de son univers ne sont ni traduits ni inventés.
- [ ] « Garder » remplit le champ ; Échap ne laisse aucune trace.
- [ ] Sur les matières, elle respecte le partage des deux champs de TU12 : la matière d'un
      côté, le motif de l'autre, jamais mélangés.
- [ ] « Voir ce qui part » montre la fiche, le contexte et le texte, mot pour mot.
- [ ] Ce qu'elle propose ne part jamais tout seul en génération : c'est toujours un second
      geste de l'auteur.

### CM4 · Demander, là où on est

La touche qui ouvre une ligne de question à l'endroit du curseur, la réponse dessous, Échap qui
referme. L'appel emporte l'écran, le champ visé et ce qui bloque.

- [ ] La touche ne vole aucun raccourci existant du produit ni du navigateur.
- [ ] La ligne s'ouvre là où on travaille, et ne déplace rien à l'écran.
- [ ] Une question hors sujet reçoit « je ne sais pas » plutôt qu'une réponse inventée.
- [ ] Échap referme sans trace, et le travail en cours est exactement où on l'avait laissé.
- [ ] Au clavier seul, le geste entier se fait : ouvrir, écrire, lire, fermer.

### CM5 · Expliquer ce qui bloque

Un bouton grisé porte déjà sa raison. Quand elle ne suffit pas, le coup de main la développe —
avec le contexte réel de l'écran, pas une généralité.

- [ ] La raison courte reste affichée telle quelle ; le coup de main ne la remplace pas.
- [ ] Ce qu'il explique nomme les gestes du produit, pas les fichiers ni les routes.
- [ ] Il n'invente jamais une cause : sans contexte suffisant, il le dit.

### CM6 · Le plafond et le compteur

Le plafond mensuel dans les Réglages, le compteur dans les dépenses, et la disparition propre
quand le plafond est atteint.

- [x] Le plafond se règle une fois et se voit ; 1 € par défaut.
- [x] Le compteur dit ce qui a été dépensé ce mois-ci, à côté du reste des dépenses.
- [x] Plafond atteint : la marque disparaît et dit pourquoi, sans fenêtre d'erreur.
- [x] Rien ne peut dépenser au-delà du plafond, même en rafale.

*Fait le 25 septembre 2026.* **La règle** : sous un verrou, un appel réserve la borne haute
de ce qu'il peut coûter et ne part que si *le mois déjà pesé + les réservations en vol + la
sienne* tient sous le plafond ; à la fin, sous le même verrou, il écrit son coût réel et rend
sa réservation — ou la garde comme poids (`pese_usd`) si son coût n'est jamais revenu, jamais
zéro. L'essai de rafale (dix appels retenus en vol, un reste pour un seul) a été écrit avant la
réservation et **tombe sans elle : dix appels partent au lieu d'un**. **Tranché** : l'unité
est le **dollar**, affiché tel — `$1,00` par défaut, un peu moins que 1 € donc plus strict que
le plan, et aucune conversion à tenir à jour ; le mois est le **mois civil local** (celui des
journaux `<AAAA-MM>`), un appel compte au mois où il est parti ; la réservation vaut un jeton
pour deux signes envoyés plus la réponse la plus longue permise, à **$2 le million de jetons**
— une borne haute **prise sans tarif vérifié**, comme l'identifiant du modèle. Le plafond vit
dans `donnees/coup-de-main.json` (ce n'est pas un secret, il ne passe pas par le `.env`), relu
à chaque appel ; zéro coupe le coup de main. **Le plafond se règle là où le compteur se lit** :
l'écran des dépenses, qui est aussi l'onglet Consommations des Réglages — un seul endroit,
pas deux. Le compteur voyage avec `GET /api/spending` (`coup_de_main`), le plafond se pose par
`PUT /api/settings/assist`. **Pas vu au navigateur** : le bloc n'a été vérifié qu'en essai
d'écran ; la marque qui se tait attend CM3, qui lit `GET /api/assist` (la raison y est).

### CM7 · Partout où il y a un champ de prompt

La marque se généralise par le composant partagé : les images, les sons, les animations, les
tuiles. Une seule pose.

- [ ] Tout champ de prompt du produit porte la marque, sans modification écran par écran.
- [ ] Ce qui n'est pas un champ de prompt ne la porte pas.
- [ ] Une relecture croisée vérifie qu'aucun écran n'a gagné un second chemin d'aide.

---

## Ce que ce plan ne couvre pas

- **Une conversation qui garde le fil.** Chaque appel part seul. Si l'usage réclame le
  contraire, ce sera une tranche, avec une raison mesurée.
- **Un modèle qui lit les images.** Décrire une image de référence pour en tirer un texte est
  une autre fonction, un autre prix, une autre tranche.
- **Un modèle local.** Le petit modèle payé coûte des fractions de centime et répond en une
  seconde ; un modèle de texte sur la carte de la maison prendrait la place de ce qui fabrique
  les images.
- **Que l'agent s'en serve** (décision 9).

## Questions laissées ouvertes

- ~~**L'argent : plafond une fois, ou annonce à chaque appel ?**~~ **Tranchée le 20 septembre
  2026** : le plafond, réglé une fois, avec le compteur dans les dépenses. Voir la décision 8.
- **La fiche du produit : écrite à la main, ou dérivée des docs existantes ?** La décision 3
  tranche pour la main, et l'expérience dira si elle dérive de la réalité plus vite qu'on ne la
  corrige.
- **La touche.** Reste à vérifier qu'elle est libre dans le produit et dans les navigateurs
  visés — la vérification appartient à CM4.
