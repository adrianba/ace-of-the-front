# Ace of the Front

**There are plenty of good pilots. Then you meet an ace.**

A playable WWI-inspired side-scroller: fly a British biplane, fight German
patrols, avoid barrage balloons and tree-lined hills, and duel four fictional
aces across increasingly difficult missions.

## Fly

Install [uv](https://docs.astral.sh/uv/), then run:

```sh
uv run ace-of-the-front
```

Open **http://127.0.0.1:8000** in a modern desktop browser. Stop the server
with Ctrl+C. To use another port: `uv run ace-of-the-front --port 8080`.
The development server binds to loopback by default; it is not intended for
public production hosting.

| Key | Action |
| --- | --- |
| Up / Down or W / S | Change altitude |
| Space (hold) | Fire |
| Enter | Launch / next mission / retry |
| P or Escape | Pause / resume |
| M | Toggle sound |

Five hull points, unlimited ammunition and retries. Ace aiming lines show
where shots **will** go: move off the line, then line up your return fire.
Clearing a mission repairs up to two hull points. Defeat retries the current
mission with full hull; only score from completed missions is kept.
Best score stays in this browser; campaign progress does not survive reload.

Python handles local serving; native JavaScript/Canvas handles real-time
gameplay. Placeholder vector graphics and synthesized sounds need no assets
or external services. See [the game outline](GAME_DESIGN.md) for mechanics,
ace personalities, progression, scope, and next playtest goals.

## Development

Use `uv` for all Python environment, dependency, execution, and validation
commands:

```sh
uv sync --dev
uv run ruff check .
uv run ruff format --check .
uv run pytest
node --test tests/engine.test.mjs
```

The default Python tests cover HTTP serving and packaged assets. For the
real-browser smoke tests (installs a local Chromium browser):

```sh
uv run playwright install chromium
uv run pytest --browser-tests
```