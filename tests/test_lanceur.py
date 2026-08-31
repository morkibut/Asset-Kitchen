# -*- coding: utf-8 -*-
"""Le lanceur — la seule porte d'entrée du produit, et elle n'avait aucun essai.

**Ce fichier existe parce qu'une fenêtre se refermait sans rien dire.** Signalé
le 31 août 2026 : l'auteur double-cliquait le lanceur, une fenêtre s'ouvrait,
elle disparaissait une seconde plus tard, et il n'avait pas le temps de lire quoi
que ce soit. Ce qui se passait était banal — un atelier tournait déjà — mais rien
ne le disait de façon lisible :

- la bannière `Asset Kitchen — http://…` s'imprimait **avant** de savoir si le
  serveur allait démarrer : la dernière ligne visible annonçait donc un succès
  qui n'avait pas eu lieu ;
- le navigateur s'armait au bout d'une seconde, quoi qu'il arrive ;
- et personne n'avait jamais mesuré ce que `uvicorn` fait au juste quand la
  liaison échoue. C'est l'essai du milieu qui l'a établi : **il sort lui-même
  avec le code 3**, après avoir journalisé une ligne `ERROR`. Le code était donc
  bon depuis le début — ce qui manquait était la phrase qui le traduit, et le
  temps de la lire.

Les essais ci-dessous tiennent les trois moitiés de la réparation : on sait
reconnaître un port pris, on sait distinguer un atelier de n'importe quoi
d'autre, et l'on ne retient la fenêtre ni sans personne, ni sans fin.

**Aucun essai de ce fichier ne démarre de serveur** : ils ouvrent des prises et
des adresses, ce qui coûte des millisecondes et ne touche ni le disque ni le
fournisseur.
"""

from __future__ import annotations

import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from atelier.__main__ import atelier_repond, port_pris, retenir_la_fenetre


def _port_libre() -> int:
    """Un port dont on sait qu'il est libre — on le prend et on le rend."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as prise:
        prise.bind(("127.0.0.1", 0))
        return int(prise.getsockname()[1])


class _Muet(BaseHTTPRequestHandler):
    """Quelque chose qui écoute, et qui n'est pas un atelier."""

    def do_GET(self) -> None:  # noqa: N802 — imposé par la bibliothèque
        self.send_response(404)
        self.end_headers()

    def log_message(self, *_: object) -> None:
        """Le serveur d'essai n'écrit rien sur la sortie de la suite."""


class _Atelier(BaseHTTPRequestHandler):
    """Ce que `/api/health` répond vraiment, mot pour mot."""

    def do_GET(self) -> None:  # noqa: N802 — imposé par la bibliothèque
        corps = b'{"atelier":"ouvert"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def log_message(self, *_: object) -> None:
        """Le serveur d'essai n'écrit rien sur la sortie de la suite."""


class _Servi:
    """Un serveur minimal, le temps d'un essai."""

    def __init__(self, gestionnaire: type[BaseHTTPRequestHandler]) -> None:
        self._http = HTTPServer(("127.0.0.1", 0), gestionnaire)
        self.port = int(self._http.server_address[1])
        self.adresse = f"http://127.0.0.1:{self.port}"

    def __enter__(self) -> "_Servi":
        threading.Thread(target=self._http.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_: object) -> None:
        self._http.shutdown()
        self._http.server_close()


# ── « On regarde le port avant de s'y attacher » ─────────────────────────────


def test_un_port_libre_est_vu_libre():
    """Le cas normal, et il ne doit rien coûter : le lanceur le traverse à
    chaque démarrage."""
    assert port_pris("127.0.0.1", _port_libre()) is False


def test_un_port_tenu_est_vu_pris():
    """Le cas qui a coûté la soirée de l'auteur. Une prise ouverte suffit — on
    se connecte, on ne se lie pas : se lier pour tester libérerait la place
    juste avant que le vrai serveur la demande."""
    with _Servi(_Muet) as servi:
        assert port_pris("127.0.0.1", servi.port) is True


# ── « Un atelier déjà ouvert n'est pas une erreur » ──────────────────────────


def test_un_atelier_qui_repond_est_reconnu():
    """C'est cette distinction qui décide de tout ce qu'on dit ensuite : un
    atelier déjà ouvert est **ce qu'on voulait**, et l'on ouvre le sien au lieu
    d'en réclamer un second."""
    with _Servi(_Atelier) as servi:
        assert atelier_repond(servi.adresse) is True


def test_ce_qui_occupe_le_port_sans_etre_un_atelier_n_est_pas_pris_pour_un():
    """Sinon le lanceur ouvrirait un onglet sur le programme de quelqu'un
    d'autre en annonçant que l'atelier tourne."""
    with _Servi(_Muet) as servi:
        assert atelier_repond(servi.adresse) is False


def test_une_adresse_morte_ne_leve_pas():
    """Le lanceur pose la question à un port dont il vient de constater qu'il
    est pris — mais la chose qui le tenait a pu partir entre les deux. Une
    exception ici tuerait le démarrage au lieu de le renseigner."""
    assert atelier_repond(f"http://127.0.0.1:{_port_libre()}") is False


# ── « Un démarrage raté ne ressort jamais en succès » ────────────────────────


def test_un_demarrage_rate_rend_un_code_d_echec(monkeypatch, capsys):
    """**Le cœur de la réparation, et il ne se voit que d'ici.**

    Uvicorn ne lève pas l'erreur de liaison à l'appelant : il la journalise en
    `ERROR`, éteint l'application, et **sort lui-même avec le code 3** — mesuré
    ici le 31 août 2026, et c'est la seule façon de le savoir. Le lanceur du
    bureau se fie au code de sortie pour décider s'il retient sa fenêtre : ce
    qui manquait n'était donc pas le code, c'était **la phrase qui le traduit**,
    et le temps de la lire.

    On force le cas rare mais réel : le port est libre au coup d'œil, pris au
    moment de le demander. C'est aussi la vraie course entre deux lancements.
    """
    import atelier.__main__ as lanceur

    with _Servi(_Muet) as servi:
        # Le coup d'œil dit « libre » : on se place juste après lui.
        monkeypatch.setattr(lanceur, "port_pris", lambda *_: False)
        monkeypatch.setattr(lanceur, "retenir_la_fenetre", lambda: None)
        monkeypatch.setattr(
            "sys.argv",
            ["atelier", "--sans-navigateur", "--port", str(servi.port)],
        )
        code = lanceur.main()

    assert code != 0, "un port pris ne doit jamais ressortir en succès"
    dit = capsys.readouterr().out
    assert "n'a pas démarré" in dit, "l'échec se dit en clair, pas seulement en code"
    assert "--port" in dit, "et il dit quoi faire"


# ── « On ne retient la fenêtre que devant quelqu'un » ────────────────────────


def test_la_fenetre_ne_se_retient_pas_sans_terminal(monkeypatch):
    """**Le premier garde-fou.** Retenir la fenêtre sauve le double-clic ; le
    faire sans terminal pendrait une tâche planifiée, un service ou cette suite
    d'essais — sans que personne voie pourquoi."""
    appele = False

    def _jamais(*_: object) -> str:
        nonlocal appele
        appele = True
        return ""

    class _SansTerminal:
        @staticmethod
        def isatty() -> bool:
            return False

    monkeypatch.setattr("builtins.input", _jamais)
    monkeypatch.setattr("atelier.__main__.sys.stdin", _SansTerminal)
    retenir_la_fenetre()
    assert appele is False


def test_la_fenetre_ne_se_retient_jamais_sans_fin(monkeypatch):
    """**Le second garde-fou, et il existe parce que le premier ment.**

    Mesuré le 31 août 2026 : sur Windows, le périphérique `NUL` répond *oui* à
    `isatty`. Une sortie redirigée vers lui passerait donc le premier contrôle,
    et une attente sans borne y resterait pour toujours. L'attente est donc
    bornée — on accompagne la lecture, on ne s'y accroche pas.
    """
    import atelier.__main__ as lanceur

    class _MentTerminal:
        @staticmethod
        def isatty() -> bool:
            return True

    def _sans_fin(*_: object) -> str:
        threading.Event().wait()  # ne rend jamais la main
        return ""

    monkeypatch.setattr("builtins.input", _sans_fin)
    monkeypatch.setattr("atelier.__main__.sys.stdin", _MentTerminal)
    monkeypatch.setattr(lanceur, "ATTENTE_LECTURE_S", 0.2)

    depart = time.perf_counter()
    lanceur.retenir_la_fenetre()
    assert time.perf_counter() - depart < 5, "la fenêtre ne se retient jamais sans fin"
