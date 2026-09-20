"""AU10 : l'intégration s'éprouve avec asset3d sans modifier son environnement.

Sans GPU : ce qui se prouve ici, c'est que charger le pont — lire la
configuration du voisin, importer ses modules, les patcher en mémoire — ne
touche à aucun fichier sous son dossier source. Toutes les écritures
(personnages, essais, calculs, journaux) sont redirigées vers le dossier de
données du pont, jamais chez le voisin ; aucun paquet n'est installé et aucun
poids n'est téléchargé (HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE).
"""
import os
import sys
from pathlib import Path

import pytest

# **Garde-fou** : il relève l'empreinte du dossier du voisin **en entier** avant
# et après le chargement du pont, et refuse la moindre écriture. Ce qui le
# casserait est une ligne écrite n'importe où dans le pont, pas un fichier qu'il
# nomme — donc il tourne toujours (`essais/lancer_les_essais.py`).
pytestmark = pytest.mark.gardefou

SOURCE = Path(__file__).resolve().parents[2] / "asset3d"


EXCLUS = {".git", ".venv", "node_modules", "venv"}


def _empreinte_arbre(racine: Path) -> dict:
    """Chemin relatif -> (taille, date de modification) de chaque fichier.

    .git, les environnements virtuels et node_modules sont exclus : lourds,
    sans rapport avec ce que le pont pourrait écrire, et un `git status` ou un
    outil tiers peut y toucher pendant la session.
    """
    empreinte = {}
    for chemin in racine.rglob("*"):
        if EXCLUS & set(chemin.parts):
            continue
        if chemin.is_file():
            stat = chemin.stat()
            empreinte[str(chemin.relative_to(racine))] = (stat.st_size, stat.st_mtime_ns)
    return empreinte


@pytest.fixture
def env_restaure():
    """Les variables d'environnement du pont sont globales au processus :
    on rend exactement ce qui existait avant le test, réussite ou non."""
    cles = ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "PYTHONDONTWRITEBYTECODE", "ASSET3D_SERVICE_RIG")
    avant = {c: os.environ.get(c) for c in cles}
    avant_bytecode = sys.dont_write_bytecode
    try:
        yield
    finally:
        for c, v in avant.items():
            if v is None: os.environ.pop(c, None)
            else: os.environ[c] = v
        sys.dont_write_bytecode = avant_bytecode


def test_charger_le_pont_ne_touche_a_aucun_fichier_du_voisin(tmp_path, monkeypatch, env_restaure):
    if not (SOURCE / "serveur" / "main.py").is_file():
        pytest.skip("Le projet asset3d voisin n’est pas présent sur cette machine.")
    # Un import précédent (test_pont_asset3d.py) peut avoir laissé le module
    # en cache : on le retire pour rejouer charger_asset3d proprement.
    for nom in [n for n in sys.modules if n == "serveur" or n.startswith("serveur.")]:
        monkeypatch.delitem(sys.modules, nom, raising=False)

    def _caches() -> set:
        return {c for c in SOURCE.rglob("__pycache__") if not EXCLUS & set(c.parts)}

    avant = _empreinte_arbre(SOURCE)
    caches_avant = _caches()
    from atelier.pont_asset3d import charger_asset3d
    donnees = tmp_path / "donnees-pont"
    # Le voisin est là, mais son environnement Python peut ne pas l'être : ses
    # modules importent des paquets **à lui** — `cv2` par exemple —, que ce
    # dépôt n'installe pas et ne doit pas installer, puisque c'est précisément
    # la frontière que cet essai vérifie. Un essai sauté avec sa raison est un
    # verdict ; une exception d'import ressemble à une régression et n'en est
    # pas une.
    try:
        natif = charger_asset3d(SOURCE, donnees)
    except ModuleNotFoundError as manque:
        pytest.skip(
            "Le voisin asset3d est présent, mais son environnement n’est pas"
            f" installé ici — il lui manque « {manque.name} »."
        )
    apres = _empreinte_arbre(SOURCE)
    caches_apres = _caches()

    assert apres == avant, "charger_asset3d a modifié un fichier du dossier voisin"
    # Des __pycache__ peuvent déjà exister chez le voisin (son propre usage) ;
    # ce qui compte est qu'aucun nouveau n'apparaisse à cause du pont.
    assert caches_apres <= caches_avant, f"un cache Python est apparu chez le voisin : {caches_apres - caches_avant}"

    # Aucune écriture ne peut viser le voisin : tous les chemins d'écriture
    # de la configuration pointent sous le dossier de données du pont.
    for attribut in ("DOSSIER_ESSAIS", "DOSSIER_PERSONNAGES", "DOSSIER_R2"):
        chemin = Path(getattr(natif.config, attribut))
        assert chemin.resolve().is_relative_to(donnees.resolve()), f"{attribut} sort du dossier du pont : {chemin}"
    assert Path(natif.config.JOURNAL_SERVICE_RIG).resolve().is_relative_to(donnees.resolve())
    # Le service de rig persistant et longue durée du voisin n'est pas activé
    # par le pont : sa vie propre resterait un canal d'écriture non maîtrisé.
    assert natif.config.SERVICE_RIG_ACTIF is False

    # Aucun téléchargement de poids n'est permis dans les sous-processus lancés
    # par le pont (Trellis, Blender) : ces deux drapeaux le bloquent au niveau
    # du processus, avant qu'un modèle ne puisse être demandé au réseau.
    assert os.environ["HF_HUB_OFFLINE"] == "1"
    assert os.environ["TRANSFORMERS_OFFLINE"] == "1"


def test_dossier_voisin_factice_sans_module_reel_leve_avant_toute_ecriture(tmp_path, monkeypatch, env_restaure):
    """Un dossier voisin factice, qui n'a que le fichier vérifié à l'entrée :
    le chargement échoue en tentant d'importer les modules réels du voisin,
    et rien n'apparaît sous ce dossier factice entre-temps."""
    faux_voisin = tmp_path / "faux-asset3d"
    (faux_voisin / "serveur").mkdir(parents=True)
    (faux_voisin / "serveur" / "__init__.py").write_text("", encoding="utf-8")
    (faux_voisin / "serveur" / "main.py").write_text("", encoding="utf-8")
    avant = _empreinte_arbre(faux_voisin)

    for nom in [n for n in sys.modules if n == "serveur" or n.startswith("serveur.")]:
        monkeypatch.delitem(sys.modules, nom, raising=False)
    from atelier.pont_asset3d import charger_asset3d
    with pytest.raises(ModuleNotFoundError):
        charger_asset3d(faux_voisin, tmp_path / "donnees")

    assert _empreinte_arbre(faux_voisin) == avant, "un fichier est apparu chez le voisin factice"
