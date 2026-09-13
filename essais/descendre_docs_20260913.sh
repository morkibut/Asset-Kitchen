#!/usr/bin/env bash
# Quatrième descente de la documentation — 13 septembre 2026.
#
# Ce que le relevé `docs/releves/2026-09-13-etat-des-docs.md` a nommé « à
# archiver » descend dans `docs/archive/`. **Aucun mot ne change** : le script
# ne fait que déplacer, et `py essais/essai_docs.py` nomme ensuite les renvois
# que la descente casse — c'est la méthode des trois descentes précédentes.
#
# Rien n'est supprimé. `docs/status-atelier-unifie/` était proposé à la
# suppression ; il descend comme les autres, parce qu'un instantané ne gêne
# personne dans `archive/` et qu'on ne détruit pas ce qu'on peut ranger.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p docs/archive

descendre() {
  local source="$1" cible="$2"
  if [ ! -e "$source" ]; then
    echo "  absent, ignoré : $source"
    return
  fi
  mkdir -p "$(dirname "$cible")"
  git mv "$source" "$cible"
  echo "  $source -> $cible"
}

echo "Les fichiers :"
descendre "docs/PLAN-carnet-affectation.md"        "docs/archive/PLAN-carnet-affectation.md"
descendre "docs/v3-animation.md"                   "docs/archive/v3-animation.md"
descendre "docs/design-preview-refonte.html"       "docs/archive/design-preview-refonte.html"
descendre "docs/design-preview-propositions.html"  "docs/archive/design-preview-propositions.html"
descendre "docs/audit-design-post-v21.html"        "docs/archive/audit-design-post-v21.html"
descendre "docs/maquette-atelier.html"             "docs/archive/maquette-atelier.html"
descendre "docs/vocabulaire-a-fermer.md"           "docs/archive/vocabulaire-a-fermer.md"
descendre "docs/v21-arbitrages.md"                 "docs/archive/v21-arbitrages.md"
descendre "docs/questions-du-lot-U.md"             "docs/archive/questions-du-lot-U.md"
descendre "docs/releve-fournisseurs.md"            "docs/archive/releve-fournisseurs.md"
descendre "docs/vignettes-vues.md"                 "docs/archive/vignettes-vues.md"

echo "Les dossiers :"
descendre "docs/maquettes-v2.1"          "docs/archive/maquettes-v2.1"
descendre "docs/maquettes-v2.4"          "docs/archive/maquettes-v2.4"
descendre "docs/maquettes-v3"            "docs/archive/maquettes-v3"
descendre "docs/pistes-2026-09-04"       "docs/archive/pistes-2026-09-04"
descendre "docs/diagrams"                "docs/archive/diagrams"
descendre "docs/analyse pre-v3"          "docs/archive/analyse-pre-v3"
descendre "docs/recherche-llm-local"     "docs/archive/recherche-llm-local"
descendre "docs/recherche-video-locale"  "docs/archive/recherche-video-locale"
descendre "docs/status-atelier-unifie"   "docs/archive/status-atelier-unifie"

echo
echo "Fait. Maintenant : py essais/essai_docs.py — il nomme les renvois cassés."
