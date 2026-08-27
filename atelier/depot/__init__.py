# -*- coding: utf-8 -*-
"""SQLite et les fichiers.

**Les fichiers font foi, la base est un index reconstructible**
(`docs/ARCHITECTURE.md` §4, règle 3). L'invariant n'entre officiellement en
vigueur qu'en T3, mais il se paie ici, dès T1 : chaque génération écrit son
`generation.json` à côté de ses images. Rien à rétro-adapter le jour où la
bibliothèque se reconstruira depuis le disque.
"""

from atelier.depot.base import Base
from atelier.depot.fichiers import Fichiers

__all__ = ["Base", "Fichiers"]
