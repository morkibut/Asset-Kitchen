# Le registre du contenu — plan

> Demandé par l'auteur le 26 novembre 2026 : montrer le contenu d'un jeu à son auteur, qu'il le
> juge sur place, et que les agents relèvent ses décisions. L'usage est dans
> [prd-registre.md](prd-registre.md), la construction dans [archi-registre.md](archi-registre.md).
>
> Quel modèle sur quelle tranche : [PLAN-registre-affectation.md](PLAN-registre-affectation.md).
>
> **Où en est le chantier (27 novembre 2026, branche `claude/project-thread-3optrx`).** `RC1`
> est écrite, serveur et écran, essais compris. Elle attend sa séance d'usage : **une tranche
> n'est finie que lorsqu'on s'en est servi.**

## Décisions d'architecture

- **Le registre vit dans le jeu**, sous `projets/<jeu>/registre/`.
- **Les fichiers font foi**, l'index n'en sait rien ; l'état d'une entrée se déduit de son
  journal ; une décision est un fichier neuf.
- **Le MCP n'a pas de logique propre** et n'a aucun geste de décision.
- **La boîte de dépôt par fichiers** est la porte des agents sans réseau ; un dépôt refusé se
  voit, avec sa raison.
- **Les types, les portes et les rayons sont déclarés par le jeu** ; ceux de départ ne sont
  qu'un défaut.
- **Aucune donnée d'un jeu réel dans le dépôt.**

## Les tranches

### RC1 · Une entrée à choix, déposée par un agent, jugée à l'écran, relevée par l'agent

**Bloquée par** : rien.

Le geste qui a déclenché la demande, de bout en bout : la porte *Le registre* et son nombre ;
l'accueil (à trancher, nouveau, par rayon, hors de la vue) ; une entrée avec ses médias sur
place (image et loupe, vidéo sous-titrée, son, texte) ; « Je prends celle-ci » ; valider,
reprise, écarter, pause, relancer ; les remarques et leurs réponses ; l'histoire des versions ;
le journal et l'annulation ; une décision à la fois ; la création d'une entrée à la main ; les
huit outils MCP ; la boîte de dépôt ; la rétrospective en Markdown.

- [x] Une entrée de trois images se juge sur place ; prendre se voit tout de suite ; un second
      clic ne crée rien ; on revient sur son choix (critère 1).
- [x] À trancher en tête, dans l'ordre ; une décision à la fois (critère 2).
- [x] Un agent dépose une entrée à choix en un geste ; redéposer ne double rien (critère 4).
- [x] Relever les décisions depuis un repère : chacune une fois (critère 5).
- [x] Une boîte de dépôt : prise, ou refusée avec sa raison ; la décision se lit en fichier (critère 6).
- [x] La v2 remplace la v1 à l'écran, l'histoire garde la v1 et ce qui en a été dit (critère 7).
- [x] La rétrospective se déduit du journal (critère 8).
- [x] On efface l'index : tout est là (critère 10).
- [ ] Vidéo sous-titrée et son joués dans l'entrée, vus au navigateur (critère 3).
- [ ] **La séance d'usage** : l'auteur s'en sert sur de vraies entrées de son jeu.

### RC2 · La reprise de l'existant

**Bloquée par** : RC1 jugée ; les médias de l'ancien outil rapatriés en fichiers sur la machine
(un fil du jeu le fait — ce n'est pas à l'atelier d'aller les chercher).

Un script hors produit, lancé à la main, qui lit l'export de l'ancien outil et dépose par la
boîte de dépôt : ce qui est validé reste validé avec sa date, les doublons de validation se
fondent, les entrées masquées deviennent de l'histoire, les versions empilées deviennent les
versions d'une seule entrée. **L'ancien outil reste en service jusqu'au jugement de l'auteur**,
puis il est gelé en lecture.

- [ ] Rien de ce qui est validé ne se rejoue.
- [ ] L'auteur ferme l'ancien outil.

### RC3 · Une remarque sur un morceau précis, et la comparaison avant/après

**Bloquée par** : RC1.

Une remarque sur une case de planche ou une réplique d'un texte ; les bulles et cartouches
posées sur une case de BD ; l'avant/après entre deux versions d'un même média.

### RC4 · Les liens typés

**Bloquée par** : RC1. Un objet à part du lien de la toile (archi §7).

### RC5 · Le graphe des décisions

**Bloquée par** : RC4. Choisi en premier parce qu'il se déduit des seules données de l'étape 1.

### RC6 · Le graphe des quêtes, l'arbre d'un évènement, les fils rouges, le calendrier

**Bloquée par** : RC4, et les textes du jeu repris.

### RC7 · Les contrôles et la couverture des assets

**Bloquée par** : RC4.

### RC8 · Le téléphone

**Bloquée par** : RC2. Les pistes à comparer : une page de relecture servie par l'atelier sur le
réseau privé ; une copie publiée qui remonte les décisions par une boîte de dépôt ; le PC seul.

### RC9 · Vers le jeu, et depuis le jeu

**Bloquée par** : RC6. Un adaptateur par jeu ; on relit ce qui change, on publie ensuite ; seul
ce qui est validé part ; « intégré » se constate.

## Questions laissées ouvertes

Gardées pour l'auteur, à trancher en une fois après la séance d'usage de RC1 :

1. Les types et rayons de départ conviennent-ils à son jeu, ou écrit-on son `reglages.json` ?
2. La rétrospective doit-elle s'écrire dans le dépôt du jeu (une livraison relue), ou rester
   dans l'atelier ?
3. Le chemin de la boîte de dépôt convient-il aux agents du nuage (il vit sous les données de
   l'atelier), ou faut-il pouvoir la déclarer ailleurs, dans un dossier déjà approuvé ?
