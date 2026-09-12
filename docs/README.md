# `docs/` — quelle annexe s'ouvre quand

> Descendu d'`AGENTS.md` § Les documents et leur autorité le 6 septembre 2026, **sans qu'un mot
> change**. C'est un index : on le lit quand on cherche où vit une réponse, jamais au démarrage.
>
> **Qui fait foi sur quoi** reste dans `AGENTS.md`, avec la règle qui va avec : *une question,
> un document*. En cas de contradiction, celui dont c'est la question l'emporte, et l'autre est
> corrigé dans la foulée.
>
> **Cinq documents se lisent au démarrage d'une session, et cinq seulement** — `AGENTS.md` dit
> lesquels. Tout ce qui est listé ici se lit **à la demande, quand la tâche le demande**, jamais
> « pour se mettre en contexte » : c'est là qu'un corpus de démarrage triple sans que personne
> ne le décide.

| Annexe | Ce qu'elle prolonge | On l'ouvre quand |
|---|---|---|
| `docs/PLAN-atelier-unifie.md` | le plan | on ouvre une tranche du chantier actif : demande MCP de l'agent, animation, Godot, puis moteurs locaux et 3D |
| `docs/PLAN-atelier-unifie-affectation.md` | le plan | on choisit le modèle et les points durs de la prochaine tranche AU |
| `docs/archi-atelier-unifie.md` | l'architecture | on construit un contrat de demande, de travail, de source, d'intégration locale ou de livraison Godot |
| `docs/maquettes-atelier-unifie/02-atelier.html`, `docs/maquettes-atelier-unifie/couverture.md` | le design, proposition | on essaie la toile, la création manuelle, la retouche et la livraison ; inventaire des gestes interactifs, simulations et détails manquants. `01-parcours.html` garde la première proposition |
| `docs/PLAN-carnet.md` | le plan historique | on vérifie une capacité déjà livrée ou un défaut à reprendre ; l'ordre actif est celui des tranches AU |
| `docs/revue-conformite-carnet-2026-09-11.md` | le plan et le design, sans les remplacer | on examine les écarts maquettes / code et les preuves qui motivent l'amendement RF ; les observations navigateur et leurs limites y sont séparées des parcours restant à éprouver |
| `docs/revue-ux-complete-2026-09-12.md` | la préparation UX, sans remplacer les documents d'autorité | on compare le prototype, l'interface réelle et les anciennes planches ; constats vérifiés, améliorations proposées et parcours à éprouver avant de stabiliser l'atelier |
| `docs/releves/2026-09-12-consolidation-prototype.md` | les preuves de la préparation UX | on relit les essais navigateur, les reprises après fermeture et les limites de la consolidation ; aucun critère de production n'est fermé par ces essais |
| `docs/tranches/V4.md` | le plan | on reprend une tranche V4 déjà tenue : son plan **et** son rapport de tenue y sont réunis, un seul fichier suffit. *Les plans des tranches tenues y sont descendus le 6 septembre 2026* |
| `docs/prd-criteres.md` | le PRD | on écrit un critère d'acceptation qui doit se raccrocher à une promesse du produit. *Descendu du PRD le 6 septembre 2026, où il pesait 28 % du document* |
| `docs/prd-hors-perimetre.md` | le PRD | **une idée arrive, et on veut savoir si elle a déjà été écartée et sur quel argument**. Toute sa valeur est là, et elle ne sert à rien tant que la question ne se pose pas. *Descendu du PRD le 6 septembre 2026, où il pesait 38 % du document — la plus lourde des huit sections* |
| `docs/archi-objets.md` | l'architecture | avant de toucher à un objet du domaine — ce qu'il porte, ce qui le nomme, ce qui le lie aux autres. ⚠️ **La V4 en modifie quatre.** *Descendu de l'architecture le 6 septembre 2026, où il pesait 28 % du document* |
| `docs/archi-risques.md` | l'architecture | on ouvre une version et on veut savoir ce qu'elle doit lever. *Descendu le 6 septembre 2026* |
| `docs/bancs.md` | — | on cherche un banc : ce qu'il mesure, ce qu'il coûte, ce qu'il a trouvé — vingt-neuf entrées. ⚠️ **Les payants ne partent qu'à la main.** *Descendu d'`AGENTS.md` § Lancer le 6 septembre 2026* |
| `docs/archive/plan-r6-a-v3.02.md` | le plan | on veut le détail d'une tranche de `R6` à la V3.02 — sept blocs finis. *Descendu du plan le 6 septembre 2026* |
| `docs/archive/plan-perime-par-la-v4.md` | le plan | on veut ce que la V2.5, la V3.01, la V3.03 ou la V3.1 promettaient. ⚠️ **Les quatorze tranches `G` de la V3.1 s'y relisent avant de clore la V4** : elles nomment des défauts que redessiner un écran ne corrige pas tout seul |
| `docs/prd-decisions.md` | le PRD | on veut savoir **ce que le produit a tranché** sur une question d'usage — ce qui entre en bibliothèque, ce qui se juge, ce que la génération refuse, ce que l'agent peut. *Descendu du PRD le 31 août 2026, où il pesait 55 % du document* |
| `docs/tranches/V2.1.md` | le plan | on construit une étape de la V2.1 et on veut ses critères d'acceptation, ou ce qui a été décidé en la faisant. *Descendu du plan le 31 août 2026, où les vingt-et-une étapes pesaient 43 % du document* |
| `docs/user-stories.md` | le PRD | on cherche ce qu'une user story demande, par son numéro |
| `docs/prd-carnet.md` | le PRD | une décision du PRD paraît arbitraire et on veut ce qui l'a dictée |
| `docs/archi-versions.md` | l'architecture | on travaille *dans* une version — les briques de la V1, le pliage et le calque de la V2, ce que les V3 à V5 supposent |
| `docs/archi-fournisseur.md` | l'architecture | on rouvre la question du modèle, du catalogue, du contrat de génération ou des outils MCP |
| `docs/carte-du-depot.md` | l'architecture | avant de toucher un fichier — ce qu'il tient, et pourquoi lui plutôt qu'un autre |
| `docs/tranches/<code>.md` | le plan | on veut les critères d'acceptation, ce qui bloquait une tranche ou son rapport de tenue — vingt-trois fichiers : les vingt tranches de `T1` à `R5`, le lot correctif `U`, et les deux versions d'écrans et de fournisseurs `V2.1` et `V2.2`. **`V2.2.md` porte en plus ce que chaque tranche livre**, descendu du plan le 1<sup>er</sup> septembre 2026 : on y ouvre **un seul** fichier pour reprendre une tranche de cette version-là |
| `docs/v21-arbitrages.md` | — | on ouvre une étape de la V2.1 et on veut savoir ce qui a été tranché en autonomie, ou ce qui reste ouvert. **Il ne fait foi sur rien** : ce qui est décidé vit dans le PRD, l'architecture, le design et le plan. Il garde la trace, et ses questions ouvertes se tranchent à l'usage |
| `docs/maquettes-v2.1/` | le design | on construit un écran de la V2.1 — vingt-six maquettes, une par écran, plus un sommaire qui dit dans quel ordre elles se lisent. **Quelle maquette va avec quelle étape se lit dans `docs/tranches/V2.1.md`**, sous le titre de l'étape. Elles décrivent l'interface future, jamais l'état du code |
| `docs/maquettes-v2.4/` | le design | on construit **le coin du calque** — l'écran unique où un calque se fabrique ou se reprend. Une seule maquette, `01-le-coin-du-calque.html`, ouvrable d'un double-clic. Elle ne bâtit rien : elle tranche quatre questions, écrit ce que chaque réponse écarte, et nomme ce que la construction devra au guide. **Elle attend l'arbitrage de l'auteur** — la tranche qui bâtira l'écran ne s'écrit pas avant |
| `docs/design-motifs.md` | le design | on dessine un écran |
| `docs/design-decisions.md` | le design | on rouvre une décision d'apparence |
| `docs/PIEGES.md` | — | avant de toucher un terrain déjà miné, ou sur renvoi du code |
| `docs/releve-usage.md` | — | on cherche ce qu'une séance d'usage a trouvé et qui n'est **pas encore** cadré ni planifié |
| **`docs/bilan-v3.md`** | le plan | **on ouvre une tranche de la V2.3 ou de la V3** — les conclusions chiffrées des trois bancs payés, ce que le relevé d'outillage a rapporté, les trois défauts que le code porte aujourd'hui, et **ce qui est mort et ne doit pas se reproposer**. Il remplace la lecture des sept documents préparatoires |
| `docs/v3-animation.md` | — | on veut les trois bancs planche par planche, avec les notes de l'auteur et les tableaux complets. **Le bilan suffit dans presque tous les cas** |
| `docs/releve-outillage.md` | — | on veut le relevé d'outillage entier — sources, licences, ce qui est écarté et pourquoi. **Le bilan en donne les conclusions** |
| `docs/archive/README.md` | — | on cherche un document qui a servi et qui est fini : les cinq versions livrées, les séances d'essai closes, les études qui ont tranché. **Rien n'y fait foi et rien n'y est à faire** |
| `docs/archive/plan-versions-tenues.md` | le plan | on veut le détail d'une tranche des cinq versions livrées — `T`, `C`, `R1`–`R5`, `E`, `U`, `F`. *Descendu du plan le 2 septembre 2026, où les versions tenues pesaient plus des trois quarts du document* |
| `docs/status/etat.md` | — | on cherche pourquoi c'est comme ça plutôt qu'autrement |
| `docs/design-preview.html`, `docs/diagrams/`, `docs/maquette-atelier.html` | — | jamais d'office |

