# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B15 — l'installation**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8479 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## ⚠️ Ce que ce script protège, et qui n'existait pas avant `B15`

`atelier/reglages.py` porte désormais **deux** fichiers à la racine du dépôt :
`.env` (les clés) et `installation.json` (le dossier de travail et l'adresse de
ComfyUI). Les deux sont **déplacés dans le dossier jetable avant que quoi que ce
soit ne soit construit**.

Sans ce déplacement, cliquer *Ranger ici* dans cet atelier-ci écrirait un
`installation.json` **dans le dépôt**, et le vrai atelier de l'auteur
démarrerait sur un dossier temporaire au lancement suivant. C'est le seul dégât
que cette tranche pouvait faire, et il est écarté en trois lignes, tout en haut.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b15.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

**Deux fournisseurs doubles**, et aucun n'existe sur le réseau :

| Le double | Ce qu'il joue | Ce qu'on vient voir |
|---|---|---|
| **Le Comptoir** | demande une clé, et sait dire son solde | le dépôt d'une clé, l'aperçu de six caractères, et *Vérifier* qui annonce le compte de modèles **et** la réserve |
| **La Fontaine** | ne demande rien, ne compte rien | *« ce fournisseur ne demande rien »*, et le grisé qui ne le touche pas |

**Trois dossiers sont préparés à côté du dossier de travail**, parce que les
trois verdicts du choix de dossier ne se voient que sur de vrais chemins :

- `vide/` — existe, vide, inscriptible : le cas qui se choisit ;
- `deja-plein/` — porte `projets/` et `atelier.sqlite3` : **ce n'est pas un
  refus**, c'est le chemin normal d'un déménagement fait à la main ;
- `pas-un-dossier.txt` — un fichier : le refus qui ne se répare pas d'un bouton.

Et `jamais-cree/` **n'est pas préparé** : c'est celui qu'on tape pour voir le
refus *« ce dossier n'existe pas encore »* et le bouton *Créer ce dossier*, qui
est un second geste.

**Un peu de disque est posé** — une image « reçue » de 4 Mo et un rendu de
2 Mo —, sans quoi la mesure du disque n'aurait rien à séparer.

**Le moteur de la maison est doublé lui aussi**, et il fait semblant d'écouter à
une seule adresse — `10.0.0.4:8188`. Tant que le réglage pointe ailleurs il est
éteint ; dès qu'on lui pose cette adresse-là il s'allume et annonce ce qui lui
manque. C'est ce qui permet de voir, en deux clics et sans installer ComfyUI,
que le réglage d'adresse prend effet **sans redémarrer l'atelier**.

**Rien n'a été payé** : aucune route de génération n'est appelée, aucun vrai
fournisseur n'est sollicité, et aucun octet ne part sur le réseau — ni pour
chercher ComfyUI, ni pour « descendre » un fichier de modèle.

## Ce qu'on vient voir à l'écran

1. **Le pied du carnet › L'installation** ouvre le lieu neuf, **carnet
   visible** — c'est ce qui le distingue du tour de première ouverture.
2. Le **sommaire** : quatre lignes, chacune avec son résumé compté — les clés
   posées sur le nombre de fournisseurs qui en demandent, l'adresse de ComfyUI,
   le dossier de travail.
3. **Étape 2, Les images** : déposer `essai-1234567890` dans Le Comptoir.
   Le champ **se vide**, la ligne passe à `…234567890`… non : à **six
   caractères**, `234567890` n'est pas ce qu'on doit lire. Puis *Vérifier* :
   *« 2 modèles trouvés · il reste $4,84 sur ce compte »*.
4. Retirer la clé : les modèles du Comptoir se grisent **dans le catalogue du
   sommaire**, ceux de La Fontaine non — et aucune image, aucune dépense ne
   bouge.
5. **Étape 3, Les animations** : *Chercher* dit que le moteur **n'est pas
   allumé**. Poser l'adresse `10.0.0.4:8188` : la recherche part dans le même
   geste, le moteur s'allume et la liste des fichiers manquants paraît, avec
   leur taille et leur licence. Le réglage est écrit (à relire dans
   `installation.json` du dossier jetable) et il a pris effet **sans
   redémarrer**. *Remettre l'adresse d'origine* paraît alors, et rééteint le
   moteur. Cliquer *Descendre* deux fois montre qu'on **reprend où l'on s'est
   arrêté** : le second clic ne redescend pas le premier fichier.
6. **Étape 4, Où tout se range** : taper les quatre chemins imprimés ci-dessous
   et cliquer *Regarder ce dossier* à chaque fois — quatre verdicts différents.
   Puis *Ranger ici* sur `vide/` : la phrase dit que **rien n'a bougé**, et
   l'ancien dossier est intact.
7. **Le sommaire, en bas** : la mesure du disque sépare *les images reçues* (ne
   se refait pas) des *rendus* (se refait tout seul) — et **aucun bouton ne vide
   quoi que ce soit**.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sans le déplacement des deux fichiers en tête de `principal()`. Tout
le reste est jetable ; ces deux-là ne le sont pas.
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

import uvicorn

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from fastapi.testclient import TestClient  # noqa: E402

from atelier import reglages  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine import Compte, Demande, Modele, Option  # noqa: E402
from atelier.domaine.secret import Secret, ce_qui_manque  # noqa: E402
from atelier.fournisseur.maison import NOM as NOM_MAISON  # noqa: E402
from atelier.fournisseur.port import ImageProduite  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8479

# ⚠️ **Une valeur explicitement fictive.** Elle est imprimée pour qu'on la
# recopie dans le champ ; une valeur d'essai qui ressemblerait à une vraie clé
# finirait un jour recopiée quelque part comme si c'en était une.
CLE_FICTIVE = "essai-1234567890"

PLACE = Secret(
    nom="ESSAI_COMPTOIR_KEY",
    libelle="la clé",
    aucun="aucune clé",
    ou="exemple.invalide/mes-cles",
)


# ── Les deux fournisseurs doubles ────────────────────────────────────────────


def _image() -> bytes:
    """Un PNG minuscule, écrit à la main — pas de dépendance, pas de réseau."""
    from io import BytesIO

    from PIL import Image

    tampon = BytesIO()
    Image.new("RGB", (48, 32), (120, 130, 100)).save(tampon, format="PNG")
    return tampon.getvalue()


class LeComptoir:
    """Le fournisseur qui demande une clé **et sait dire ce qu'il lui reste**.

    C'est le seul des deux qui exerce la vérification de bout en bout : le
    compte de modèles vient de son catalogue, la réserve de son `solde()`.
    """

    nom = "Le Comptoir"

    def __init__(self) -> None:
        self._cle = reglages.lire_secret(PLACE.nom)

    def secrets(self) -> tuple[Secret, ...]:
        return (PLACE,)

    def indisponible(self) -> str | None:
        return ce_qui_manque(self.nom, self.secrets(), {PLACE.nom: self._cle})

    def compte(self) -> None:
        return None

    async def solde(self) -> str | None:
        return "il reste $4,84 sur ce compte" if self._cle else None

    async def catalogue(self) -> list[Modele]:
        return [
            Modele(
                identifiant="Le Comptoir:portraits",
                nom="Portraits",
                fournisseur=self.nom,
                chez_lui="portraits",
                proportions=("1:1",),
                variations_max=1,
                options={"quality": Option("quality", "choix", ("low", "high"))},
            ),
            Modele(
                identifiant="Le Comptoir:decors",
                nom="Décors",
                fournisseur=self.nom,
                chez_lui="decors",
                proportions=("1:1", "16:9"),
                variations_max=1,
            ),
        ]

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        return ImageProduite(_image(), consomme=0.0245, type_media="image/png")


class LaFontaine:
    """Celui qui ne demande rien — le filet, et le second sujet du grisé.

    Retirer la clé du Comptoir doit griser **ses** modèles et pas ceux-ci : le
    catalogue du sommaire le montre en une colonne.
    """

    nom = "La Fontaine"

    def indisponible(self) -> str | None:
        return None

    def compte(self) -> Compte:
        from atelier.domaine.consommation import ICI, JETON

        return Compte(unite=JETON, plafond=None, source=ICI, renouvellement="minuit")

    async def catalogue(self) -> list[Modele]:
        return [
            Modele(
                identifiant="La Fontaine:brouillon",
                nom="Brouillon",
                fournisseur=self.nom,
                chez_lui="brouillon",
                proportions=("1:1",),
                variations_max=1,
            )
        ]

    async def generer(self, modele: Modele, demande: Demande) -> ImageProduite:
        return ImageProduite(_image(), consomme=1.0, unite="jeton", type_media="image/png")


# ── Le moteur de la maison, doublé ───────────────────────────────────────────
#
# ⚠️ **Le nom compte, et c'est cet atelier jetable qui l'a attrapé.** La route
# `GET /api/clips/engine` retrouve le moteur *par son nom* parmi les animateurs
# montés (`atelier/api/animation.py:327`). Un double appelé « Muet » n'est pas
# trouvé : la route répond 404, et l'écran affiche « l'atelier a répondu 404 »
# au lieu de l'état du moteur. Aucun essai d'écran ne pouvait le voir — ils
# doublent `fetch` et servent la réponse qu'ils veulent.

ADRESSE_QUI_REPOND = "http://10.0.0.4:8188"

# Ce que le double a « déjà sur le disque de ComfyUI ». Il vit au module et pas
# sur l'instance : la fabrique en construit un neuf à chaque appel, comme le
# vrai — sinon *Descendre* ne se souviendrait de rien d'un clic à l'autre.
_DESCENDUS: set[str] = set()


class MoteurDouble:
    """Le moteur de la maison, **sans ComfyUI et sans un octet de réseau**.

    Il fait semblant d'écouter à une seule adresse. Tant que le réglage pointe
    ailleurs il est éteint — c'est le cas de départ, celui qu'on vient voir ;
    dès qu'on lui pose `ADRESSE_QUI_REPOND`, il s'allume et annonce ce qui lui
    manque. C'est la façon la plus courte de montrer à l'écran que le réglage
    d'adresse **prend effet tout de suite**, sans redémarrer l'atelier.

    `telecharger` ne descend qu'un fichier par clic, et c'est délibéré : deux
    clics montrent qu'on **reprend où l'on s'était arrêté** plutôt que de tout
    reprendre. La vraie reprise, elle, se fait à l'octet près et un essai la
    mesure déjà (`tests/test_a11.py:695`).
    """

    nom = NOM_MAISON

    @property
    def adresse(self) -> str:
        from atelier.fournisseur.maison import BASE_PAR_DEFAUT

        return reglages.adresse_comfy(BASE_PAR_DEFAUT).rstrip("/")

    def _manquants(self) -> tuple:
        from atelier.fournisseur.maison import FICHIERS

        return tuple(f for f in FICHIERS if f.nom not in _DESCENDUS)

    async def visiter(self):
        from atelier.fournisseur.maison import EtatDuMoteur

        if self.adresse != ADRESSE_QUI_REPOND:
            return EtatDuMoteur(
                allume=False,
                grise="le moteur de la maison n'est pas allumé — ouvrez ComfyUI",
            )
        manquants = self._manquants()
        return EtatDuMoteur(
            allume=True,
            manquants=manquants,
            greffon_absent=any(not f.obligatoire for f in manquants),
            carte="Carte doublée (aucun matériel n'a été interrogé)",
            memoire_libre=int(6.92 * 1024**3),
        )

    async def telecharger(self) -> list[str]:
        manquants = self._manquants()
        if not manquants:
            return []
        _DESCENDUS.add(manquants[0].nom)
        return [manquants[0].nom]

    async def catalogue_video(self) -> list:
        return []

    async def soumettre(self, modele, demande):
        raise AssertionError("cet atelier ne commande pas de clip")

    async def etat(self, travail):
        raise AssertionError("cet atelier ne commande pas de clip")

    async def recuperer(self, travail):
        raise AssertionError("cet atelier ne commande pas de clip")


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def preparer_les_dossiers(base: Path) -> dict[str, Path]:
    """Les quatre chemins de l'étape 4 — **trois préparés, un jamais créé**.

    Le quatrième est celui qu'on tape pour voir le refus et le second geste ;
    le créer ici aurait supprimé le cas qu'on vient regarder.
    """
    vide = base / "vide"
    vide.mkdir(parents=True, exist_ok=True)

    plein = base / "deja-plein"
    (plein / "projets").mkdir(parents=True, exist_ok=True)
    (plein / "atelier.sqlite3").write_bytes(b"")

    fichier = base / "pas-un-dossier.txt"
    fichier.write_text("je ne suis pas un dossier", encoding="utf-8")

    return {
        "vide": vide,
        "plein": plein,
        "fichier": fichier,
        "absent": base / "jamais-cree",
    }


def poser_du_disque(atelier: Atelier) -> None:
    """De quoi que la mesure du disque ait deux postes à séparer.

    Écrit **dans le dossier de travail**, à la main : une image « reçue » qui ne
    se refait pas, et un rendu qui se refait. Faire une vraie génération aurait
    marché aussi et n'aurait rien montré de plus — c'est la mesure qu'on regarde,
    pas la génération.
    """
    dossier = atelier.fichiers.generations / "essai-b15"
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "0-brut.png").write_bytes(b"x" * 4 * 1024 * 1024)
    (dossier / "0-rendu.png").write_bytes(b"y" * 2 * 1024 * 1024)


def peupler(atelier: Atelier, avec_des_jeux: bool = True) -> dict:
    """Deux jeux et une clé absente, montés **par les routes réelles**.

    ⚠️ **`with TestClient(...)`, et pas un client nu** : c'est le cycle de vie de
    l'application qui appelle `atelier.ouvrir()`, donc qui relève le catalogue.
    Sans lui, `GET /api/models` rend une liste vide, et l'écran qui montre le
    grisé n'aurait rien à montrer — le résumé imprimé l'aurait dit avant que
    l'on clique, et c'est très exactement ce qu'un atelier jetable sert à
    attraper.

    `avec_des_jeux=False` laisse l'atelier neuf, pour voir le **tour de première
    ouverture** : `premiere_ouverture` reste vrai tant qu'il n'y a qu'un Bac à
    sable vide et que le tour n'a jamais été passé.
    """
    monte: dict = {}
    with TestClient(creer_application(atelier)) as client:
        if avec_des_jeux:
            marais = _exiger(
                client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
                "la création du Marais",
            )
            monte["marais"] = marais["projet"]
            _exiger(
                client.post("/api/projects", json={"nom": "Les Salines"}),
                "la création des Salines",
            )
            _exiger(
                client.put(
                    "/api/projects/current",
                    json={"projet": monte["marais"]["identifiant"]},
                ),
                "l'ouverture du Marais",
            )

        monte["installation"] = _exiger(client.get("/api/install"), "l'installation")
        monte["tiroirs"] = _exiger(client.get("/api/settings/keys"), "les tiroirs")[
            "tiroirs"
        ]
        monte["verification"] = _exiger(
            client.post("/api/install/check/Le Comptoir"), "la vérification"
        )
        monte["modeles"] = _exiger(client.get("/api/models"), "le catalogue")["modeles"]
    return monte


def principal(sans_servir: bool = False, tour: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents — le
    # même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b15-"))

    # ⚠️ **Les trois lignes qui protègent le dépôt de l'auteur.** Elles viennent
    # avant toute construction : `Fichiers.__init__` lit `dossier_de_travail()`,
    # et une route de cet atelier-ci écrit dans `installation.json`. Sans ce
    # déplacement, cliquer *Ranger ici* ferait démarrer le vrai atelier sur un
    # dossier temporaire au lancement suivant.
    reglages.FICHIER_ENV = dossier / ".env"
    reglages.FICHIER_INSTALLATION = dossier / "installation.json"

    print(f"Dossier jetable : {dossier}")
    print(f"  .env                → {reglages.FICHIER_ENV}")
    print(f"  installation.json   → {reglages.FICHIER_INSTALLATION}")

    chemins = preparer_les_dossiers(dossier)
    atelier = Atelier(
        racine=dossier / "donnees",
        fabriques_fournisseurs=[LeComptoir, LaFontaine],
        fabrique_animateur=lambda: MoteurDouble(),
    )

    depart = time.perf_counter()
    if not tour:
        poser_du_disque(atelier)
    monte = peupler(atelier, avec_des_jeux=not tour)
    duree = time.perf_counter() - depart

    etat = monte["installation"]

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print()
    print("  Ce que l'installation rend, avant qu'on touche à quoi que ce soit :")
    print(f"    dossier de travail   {etat['dossier']}  ({etat['origine_du_dossier']})")
    print(f"    fichier des clés     {etat['fichier_env']}")
    print(f"    ComfyUI              {etat['comfy']}  ({etat['origine_de_l_adresse']})")
    print(f"    première ouverture   {etat['premiere_ouverture']}")
    print(f"    jeux                 {', '.join(etat['jeux'])}")

    print()
    print("  Ce que le disque porte, poste par poste :")
    for poste in etat["disque"]["postes"]:
        refait = "se refait tout seul" if poste["recalculable"] else "ne se refait pas"
        print(f"    · {poste['nom']:32s} {poste['mo']:7.1f} Mo   {refait}")
    print(
        f"    total {etat['disque']['total_mo']} Mo, "
        f"dont {etat['disque']['recalculable_mo']} Mo recalculables — "
        "**et aucun bouton ne les vide**"
    )

    print()
    print("  Les deux tiroirs, tels que le serveur les rend :")
    for tiroir in monte["tiroirs"]:
        places = ", ".join(
            f"{s['libelle']} ({s['origine']})" for s in tiroir["secrets"]
        )
        print(
            f"    · {tiroir['fournisseur']:14s} "
            f"{'prêt' if tiroir['pret'] else tiroir['manque']:28s} "
            f"{places or 'ne demande rien'}"
        )

    print()
    print("  La vérification, sans clé posée :")
    print(f"    « {monte['verification']['phrase']} »")

    print()
    print("  Le catalogue et son grisé, par modèle :")
    for modele in monte["modeles"]:
        print(f"    · {modele['identifiant']:28s} {modele['refus'] or 'disponible'}")

    print()
    print("  Les quatre chemins de l'étape 4 — à taper un par un :")
    print(f"    vide, choisissable      {chemins['vide']}")
    print(f"    déjà plein, choisissable aussi  {chemins['plein']}")
    print(f"    un fichier, refusé      {chemins['fichier']}")
    print(f"    jamais créé, second geste       {chemins['absent']}")

    print()
    print(f"  La clé à coller à l'étape 2 : {CLE_FICTIVE}")
    print(f"  Son aperçu attendu ensuite  : …{CLE_FICTIVE[-6:]}  (six caractères, jamais plus)")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → pied du carnet › L'installation (le lieu neuf, carnet visible)")
    print("  → étape 2 : coller la clé, puis Vérifier")
    print("  → étape 3 : Chercher (le moteur n'est pas allumé), puis 10.0.0.4:8188")
    print("              (le double n'écoute qu'à cette adresse-là — il s'allume)")
    print("  → étape 4 : les quatre chemins ci-dessus, puis Ranger ici sur « vide »")
    print("  → sommaire : le catalogue, les jeux, et la mesure du disque")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(
        principal(
            sans_servir="sans-servir" in sys.argv[1:],
            tour="tour" in sys.argv[1:],
        )
    )
