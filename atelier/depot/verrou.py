"""Verrou de fichier libéré par le système à la fermeture du processus."""

import contextlib
import os
import time
from pathlib import Path


class VerrouOccupe(OSError):
    pass


@contextlib.contextmanager
def verrou(chemin: Path, *, attendre: float = 0):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("a+b") as flux:
        if flux.tell() == 0:
            flux.write(b"0")
            flux.flush()
        flux.seek(0)
        limite = time.monotonic() + max(0, attendre)
        while True:
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(flux.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(flux.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError as erreur:
                if time.monotonic() >= limite:
                    raise VerrouOccupe(str(chemin)) from erreur
                time.sleep(min(0.01, max(0, limite - time.monotonic())))
        try:
            yield
        finally:
            if os.name == "nt":
                flux.seek(0)
                msvcrt.locking(flux.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(flux.fileno(), fcntl.LOCK_UN)
