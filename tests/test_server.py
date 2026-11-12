from urllib.error import HTTPError
from urllib.request import urlopen

import pytest


@pytest.mark.parametrize(
    ("path", "mime", "content"),
    [
        ("/", "text/html", b"Ace of the Front"),
        ("/style.css", "text/css", b".flight-deck"),
        ("/engine.mjs", "text/javascript", b"export class Game"),
        ("/game.mjs", "text/javascript", b"requestAnimationFrame(frame)"),
    ],
)
def test_packaged_assets_are_served(game_url, path, mime, content):
    with urlopen(f"{game_url}{path}", timeout=5) as response:
        assert response.status == 200
        assert response.headers.get_content_type() == mime
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert content in response.read()


def test_missing_asset_is_not_silently_served_as_html(game_url):
    with pytest.raises(HTTPError) as error:
        urlopen(f"{game_url}/missing.mjs", timeout=5)
    assert error.value.code == 404
