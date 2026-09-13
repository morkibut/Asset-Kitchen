# AU4 — accès aux outils conservés et raccords réels

Relevé du 12 septembre 2026. Ce document inventorie les accès et les preuves ;
l’état du chantier reste dans [PLAN.md](PLAN.md). L’apparence fait foi dans
[DESIGN.md](DESIGN.md) et dans la maquette validée.

| Capacité et contrôles | Accès réel | Portée et conservation | Preuve / limite |
|---|---|---|---|
| Détourage : passes, bord, pipette, sélection, modèles, palette, tolérance, seuil alpha, durcissement, masquage | Retouche → sélecteur Détourer ; animation → même panneau | Image ; réglage touché sur frame, sélection ou bande | Pipette et tracé raccordés sur le fichier source de la frame. Test de visée à coordonnées d’origine malgré une réduction de moitié à l’écran. Le seuil alpha n’a pas de curseur propre : c’est un défaut du produit (128), expliqué dans l’aide de la table (`interface/src/aide.ts`, `detourage.seuil_alpha`) plutôt qu’un réglage qu’on déplace — comme dans l’ancien accès |
| Recadrage : marge, rectangle manuel, remise à zéro | Retouche → Recadrer ; animation → même panneau | Recette non destructive ; cadre commun de l’animation conservé | Rectangle traçable dans une vue source zoomable, distincte de la case finale ; retour à l’animation après le geste |
| Pixelisation : taille, occupation, méthode, décalage | Retouche / animation → Pixéliser | Frame, sélection, bande selon le sélecteur de portée | Ancrage de bande dans « Animation · boucle, repère et fenêtre commune » |
| Couleurs : palette, nombre, remplacements, tramage ; nettoyage : taches, bord ; contours ; retournement | Sélecteur de table fixe | Même chaîne CPU et mêmes recettes ; aucune copie du moteur dans l’UI | Retournement maintenant accessible aussi dans l’atelier d’animation |
| Main : transparence, pinceau, gomme, diamètre, couleur, calques, ordre, visibilité, nom, suppression, dernier passage | Retouche → La main ; animation → La main | Une seule frame. Nouvelle Main finale après placement ; ancienne Main de recette inchangée | `AtelierUnifieRetouche.test.tsx` : trait pendant lecture, frame visible, coordonnées, voisins inchangés, défaire/refaire, sauvegarde puis réouverture. `test_au4_main.py` : pixels, compatibilité, cache reconstruit |
| Zoom, déplacement de la vue, empreinte du pinceau | Image : barre + molette existantes ; frame : facteur, ajuster, Ctrl + molette, Espace + glisser / bouton central | Vue seulement ; aucun changement de recette | Ajustement mesuré dans l’espace réellement disponible. Empreinte carrée mise à l’échelle. Validation 1280×800 / 1600×1000 confiée à la QA globale |
| Recettes nommées, appliquer, copier/coller, sauvegarder une recette | Image : menu Recettes ; bande : recettes enregistrées | Un réglage voyage, les traits de Main ne voyagent pas | Corrigé : une recette nommée sur toute la bande conserve aussi les Main individuelles historiques |
| Défaire, refaire, annuler, enregistrer | En-tête fixe de l’animation ; Ctrl Z, Ctrl Maj Z / Ctrl Y, Ctrl S | 80 états de session ; montage, recettes, Main, cadence et sens. Annuler revient au dernier enregistrement | Test UI de fermeture/réouverture. Brouillon non enregistré conservé séparément sur cet ordinateur, repris ou abandonné explicitement ; aucun enregistrement ni appel IA lors de la reprise |
| Sélection : simple, Ctrl, Maj, toutes, une seule | Timeline basse de l’animation | Une coordonnée de pinceau ne s’applique jamais en lot | Portée explicite Frame / Sélection / Animation entière ; différences de recettes restent indiquées |
| Réordre, duplication, retrait, insertion depuis chutier, vider le chutier, chercher dans le clip | Timeline et Chutier dépliable | Occurrences entières, recette et Main comprises. Copie : nouvel UUID | Identifiant conservé au déplacement ; boutons de déplacement existants maintenus |
| Poussée X/Y, remettre droit, changer de source, pelure d’oignon | Panneau droit → Position, source et pelure d’oignon | Frame choisie. Remplacer sa source remet recette et Main finale à zéro | Explication existante de la perte des réglages ; geste fait pendant lecture couvert par tests A7 |
| Cadence, boucle / aller-retour, ancrage, fenêtre commune, remesure | Lecteur + Animation dépliable | Bande entière ; remesure bloquée tant que des changements attendent | Durée calculée sur la cadence courante, sans relire l’ancienne durée enregistrée |
| Vidéo originale, aperçus synchronisés, pellicule, loupe, prélèvement, propositions de rythme, étendue, plusieurs bandes | Montage vidéo | Le clip payé reste la source ; aucune génération | 22 tests legacy de montage passent. Les deux aperçus continuent de suivre le même métronome |
| Réordre des frames retenues du montage | Vignettes de sortie : glisser-déposer ; Alt + flèches | Chaque occurrence reste distincte, même avec deux numéros de source identiques | Nouveau test UI souris + clavier et test de correspondance des prises |
| Nom et classement séparés | Montage → nom libre + Personnage / Mouvement / Direction | Destination validée dans le même jeu. Le clip, ses prises et ses retouches ne changent pas | 6 tests API : création, changement de sujet, réouverture, refus intacts et brouillon sans sujet. AU15 réévalue les calques liés à l’ancienne destination |
| Découpe : détection, grille, rectangles, noms, créer plusieurs images, reprendre la source | Retouche → Découpe · plusieurs images ; ancien accès dans Toutes les tables ; toile existante | Image originale conservée ; sorties vers bibliothèque / toile selon origine | Prélèvement CPU de la case courante, placement et Main compris ; original intact, filiation bande/occurrence/clip. Découpe zoomable puis retour aux changements non enregistrés |
| Extraction : choisir deux sources, calage automatique, déplacement direct, échelle, opacité, masque, sorties | Retouche → Extraire un élément ; ancien Superposer conservé | Une image d’entrée, une image de sortie neuve : aucune frame d’une bande n’est jamais réécrite par la fabrique elle-même, la portée ne peut donc pas s’étendre au-delà de l’asset ouvert | Bibliothèque générale : recherche, collection, favoris et pagination. Déplacement direct, rectangle, pinceau garder/retirer avec empreinte ; travail/calque/résultat zoomables. À l’ouverture, `EcranSuperposition` relit la pose via `api.ouvrirSuperposition` (`Superposition.tsx`) ; `tests/test_au4_surfaces.py::test_rouvrir_extraction_retrouve_sources_et_masque_exact` fabrique une extraction avec calage, échelle, rectangle et main non par défaut, la referme puis la rouvre par le service (`atelier.superposition.ouvrir`) et vérifie que la pose relue est identique et que l’aperçu rejoué produit le même calque, sans appel fournisseur supplémentaire |

Les fabriques sont séparées des traitements dans le nouvel accès principal.
Les essais de navigation vérifient aussi le retour de retouche vers la galerie
filtrée, la vignette choisie et le défilement du sujet. Les brouillons du montage
conservent son nom, sa cadence et l’ordre des occurrences ; ceux de la fabrication
vidéo conservent le prompt, les références, le modèle et les paramètres avant
relecture. Un profil vidéo retiré reste nommé avec la raison de son indisponibilité.
L’extraction retrouve aussi ses deux sources, son calage et son masque ; la découpe
retrouve les rectangles corrigés sans les remplacer par une nouvelle détection.
« Toutes les tables et leur état » conserve les anciens chemins pendant la
vérification de chaque atelier spécialisé. Aucune capacité ancienne n’a été
retirée pour masquer un raccord restant — et celles qui manquent encore sont
nommées une à une plus bas, § « Capacités encore ouvertes ».

## Relecture croisée du 12 septembre 2026

Une passe précédente avait écrit ce relevé sans le confronter au code ; cette
passe-ci croise chaque ligne avec trois sources — le tableau des douze
capacités de `PLAN-atelier-unifie.md` § « Comment fermer une tranche »,
cette page, et l’écran réel — puis rouvre chaque preuve citée pour vérifier
qu’elle porte bien l’assertion annoncée.

Contrôles faits, avec leur porte dans le code : le pinceau de la main
(`ReglagesDeLaMain`, `Retouche.tsx`), le chutier avec son retrait un par un
(`viderDuChutier`, `auChutier`, `AtelierDeBande.tsx`), le classement d’une
bande séparé de son nom (`/api/strips/{id}/case`, `atelier/services/montage.py`),
le découpage d’une frame retouchée (`preleverFrameDeBande`,
`atelier/services/montage.py::prelevement_de_frame`), le réordre des frames
retenues au clavier et à la souris (`EcranMontage`, `Montage.tsx`), et les
huit tables de retouche — détourage, recadrage, pixélisation, couleurs,
nettoyage, contour, retournement, main — qui ont chacune leur fonction
`ReglagesDe…` dans `Retouche.tsx`. Une seule imprécision trouvée, corrigée
ci-dessus : le seuil alpha du détourage n’a pas de curseur propre, c’est un
défaut du produit documenté dans l’aide, pas un réglage déplacé.

Preuves rejouées pour cette passe : `npx vitest run
src/composants/AtelierUnifieRetouche.test.tsx src/composants/Retouche.test.tsx`
(105 essais, tous verts), `.venv/Scripts/python.exe -m pytest
tests/test_au4_surfaces.py -q` (2 essais, tous verts) et `npx tsc --noEmit`
(aucune erreur). L’essai `test_rouvrir_extraction_retrouve_sources_et_masque_exact`
pose une extraction avec un calage, une échelle, un rectangle et un trait de
main non par défaut, la referme, la rouvre par le service et vérifie que la
pose relue et l’aperçu rejoué sont identiques à l’originale, sans appel
fournisseur de plus.
## Capacités encore ouvertes, relevées le 12 septembre 2026 — cinq restantes au 13 septembre

La remise à niveau de `interface/src/App.test.tsx` a servi de peigne : chaque
essai qui ne passait plus a été rangé dans l'un de deux cas — l'écran a changé
de mots, ou la capacité a disparu. Sept étaient du second cas ; les cinq qui
suivent le sont encore, les deux autres sont passées plus bas, § « Rendues depuis ». Elles
ne sont donc **pas** des essais réécrits : ce sont des trous, et le plan
(`docs/PLAN-atelier-unifie.md`, § « Ce qui doit être repris au fil du parcours »)
demande qu'un trou soit nommé plutôt que refermé en silence. Les essais qui les
portaient restent écrits, en `test.skip`, chacun sous le commentaire qui dit ce
qui manque : ils repartiront tels quels le jour où la capacité revient.

| Capacité perdue | Où elle vivait | Ce qu'on ne peut plus faire | Essais en attente |
| --- | --- | --- | --- |
| Retirer une attitude d'un lot armé, ou désarmer la cible | Bande « Pour » de la barre qui paie (`Cible`, `Galerie.tsx`) | Corriger un lot demande de fermer le guichet et de recocher les cases. `onRetirerPose` et `onDesarmer` sont passés à `BarreQuiPaie` et ignorés par sa branche `preparation` | `une attitude se retire du lot sans le défaire` |
| La part du prix que pèse un groupe de lignes | En-tête de groupe de l'ancien écran de confirmation — « 1 cochée · $0,0080 · des $0,0143 » | *Relire avant envoi* montre le total et le pas de chaque image ; la part d'un groupe se soustrait à la main | `l'en-tête des images dit ce que les cases cochées pèsent dans le total` |
| Le compte des avertissements à côté du prix | Colonne de droite de l'ancien écran de confirmation | On ne sait plus qu'il y a un avertissement sans descendre jusqu'à la ligne qui le porte. `envoi.avertissements` n'est rendu nulle part ; seuls ceux des images le sont | `l'avertissement est écrit sur la ligne fautive, avec ses chiffres` (sa moitié encore vraie tourne à côté, sous un autre nom) |
| Le détail de la mesure du prix, et la mise en garde qui l'accompagne | Sous le bouton qui paie, ancien écran de confirmation | *Relire avant envoi* garde « Mesurée sur N appels précédents » ; le pas mesuré d'une image jointe et « une moyenne n'est le prix de personne » (T1, E13) ne se lisent plus | `le prix porte sa mesure à côté de lui, jamais fondue dedans` |
| Regarder une référence en grand avant de la choisir | Grille de choix posée dans l'ancien écran de confirmation, aperçu à la barre d'espace | Le choix passe par `BibliothequePourImage` : on choisit sur une vignette de 128 px, sans pouvoir l'ouvrir | `l'aperçu passe avant la grille, et la grille avant la confirmation` |

Aucune de ces lignes n'a été refermée en réécrivant son essai : réécrire un
essai est ce qu'on fait quand l'écran a changé de mots, pas quand le geste a
disparu.

## Rendues depuis

**Sauter l'écran de confirmation pour la série en cours — rendue le 13 septembre
2026.** Deux gestes, dans cet ordre. Le chemin d'abord : le bouton du guichet
appelait `generer(true)`, qui force la relecture et désarme le saut avant de le
lire ; il appelle maintenant `generer()`, et `paiement.ts` retrouve sa règle —
l'écran s'ouvre, sauf pour la série qu'on vient de sauter. La case ensuite, au
pied de *Relire avant envoi* (`Envoi.tsx`, présentation `atelier`), avec sa
phrase : « il revient dès qu'on change de chose ou de pose. Il n'y a pas de
case « pour toujours ». » Elle ne paraît que là où il y a une série — une chose
et une pose —, comme avant. Le guichet cesse aussi de promettre une relecture
qui n'aura pas lieu quand la série est sautée.

Preuve : les quatre essais sont ressortis d'attente et passent tels qu'ils
étaient écrits — `la case cochée saute l'écran pour la suite de la série`,
`changer de sujet remet l'écran — il n'y a pas de case « pour toujours »`,
`l'écran dit lui-même qu'aucune case ne l'éteint pour toujours` et `le raccourci
d'une série sautée porte le même verrou`. `npx vitest run` : 58 fichiers,
1 300 essais verts, 8 en attente ; `npx tsc --noEmit` propre ;
`pytest tests/test_b0.py -q` : 113 verts.

**La fente d'état du bouton qui paie — rendue le 13 septembre 2026.** Le bloc
`EnRoute` de `ChampPrompt.tsx` — 34 px, le compte, le temps écoulé et la jauge
au bord bas — est exporté et monté par le pied du guichet
(`BarreQuiPaie.tsx`, présentation `preparation`). Pendant qu'un lot est en
route il **prend la place** du bouton *Relire avant envoi*, et le geste
redescend dans la fente, en lien *Générer encore ›*. La fente n'a jamais deux
locataires : *Ctrl + Entrée* au repos, *Générer encore* pendant qu'un lot court,
rien quand une raison de refus ou un échec est écrit à côté — un refus
l'emporte toujours, et le bloc au-dessus continue de dire ce qui est en route.
La ligne « N images en cours de fabrication · Les résultats arrivent dans la
galerie » disparaît : c'est ce que le bloc dit mieux, et la pastille de la
navigation porte déjà la moitié qui traverse les écrans. Rien n'est relancé
tout seul : *Générer encore* est un clic de l'auteur, et il repasse par l'écran
de relecture comme le bouton qu'il remplace.

**Le nom du bouton, tranché.** Il reste *Relire avant envoi* : il est écrit
ainsi dans le produit et de nombreux essais verts s'y appuient. L'essai `le
bouton qui paie devient l'état de ce qu'il a payé` visait encore *Générer*, le
nom que ce bouton portait le 31 août 2026 ; la remise à niveau avait changé son
clic sans changer l'assertion au-dessus. Corrigé : la garantie qu'il tient —
*un bouton plein existe avant, il est remplacé ensuite par l'état de ce qui
part* — est vérifiée mot pour mot.

**Trois essais avaient encodé l'absence de la capacité comme une garantie**, et
deux autres avec eux : ils cliquaient *Relire avant envoi* **pendant qu'un lot
est en route**, là où le bloc occupe désormais cette place. Leur chemin passe
maintenant par la fente, leur garantie n'a pas bougé — le verrou du double clic
vaut aussi sur le lien, un saut ne déborde pas sur un autre sujet, deux demandes
identiques font deux appels. Un seul point de passage l'écrit une fois pour
toutes, l'aide `ceQuiLance()` : le bouton s'il est là, le lien sinon. Le
commentaire « le guichet garde son bouton — il n'est plus remplacé par l'état de
ce qui part » décrivait l'état dégradé du produit, pas une règle voulue : il est
remplacé par la vraie règle.

Preuve : les trois essais sont ressortis d'attente et passent — `le bouton qui
paie devient l'état de ce qu'il a payé`, `le lien Générer encore relance
vraiment, et repasse par l'écran`, `un refus l'emporte sur le lien, même pendant
qu'un lot est en route`. `npx vitest run` : 58 fichiers, 1 303 essais verts,
5 en attente, trois passages sans un rouge ; `npx tsc --noEmit` propre ;
`pytest tests/test_b0.py -q` : 113 verts (le bloc fait 34 px, une hauteur de la
liste fermée de `DESIGN.md`).
