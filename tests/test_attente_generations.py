"""L'attente finit même si le retrait automatique n'a pas encore eu son tour."""
import subprocess
import sys


def test_attendre_une_tache_deja_finie_ne_boucle_pas_sur_son_callback():
    # Un timeout asyncio ne protège pas d'une boucle qui ne rend jamais la
    # main. Le sous-processus borne donc ce défaut même si on défait le fix.
    code = '''
import asyncio
from atelier.services.generation import ServiceGenerations

async def main():
    service = object.__new__(ServiceGenerations)
    tache = asyncio.create_task(asyncio.sleep(0))
    await tache
    service._en_vol = {tache}
    tache.add_done_callback(service._en_vol.discard)
    await service.attendre_tout()
    assert not service._en_vol

asyncio.run(main())
'''
    resultat = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=20)
    assert resultat.returncode == 0, resultat.stderr
