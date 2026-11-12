import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.browser


def test_keyboard_flight_pause_and_focus_loss(page, game_url, tmp_path):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(game_url)
    expect(page.get_by_role("heading", name="Ace of the Front")).to_be_visible()
    page.screenshot(path=str(tmp_path / "briefing.png"))
    page.keyboard.press("Enter")
    expect(page.locator("#overlay")).to_be_hidden()
    page.wait_for_function(
        "document.getElementById('flight-status').textContent.includes('ALT')"
    )
    initial = page.locator("#flight-status").inner_text()
    page.keyboard.down("ArrowUp")
    page.wait_for_timeout(250)
    page.keyboard.up("ArrowUp")
    assert page.locator("#flight-status").inner_text() != initial
    page.keyboard.down("Space")
    page.wait_for_function(
        "() => import('/game.mjs').then(({game}) => game.bullets.some(b => b.friendly))"
    )
    page.keyboard.up("Space")
    page.keyboard.press("p")
    expect(page.get_by_role("heading", name="Take a breath, pilot.")).to_be_visible()
    before = page.evaluate("() => import('/game.mjs').then(({game}) => game.time)")
    page.wait_for_timeout(200)
    after = page.evaluate("() => import('/game.mjs').then(({game}) => game.time)")
    assert before == after
    page.keyboard.press("p")
    expect(page.locator("#overlay")).to_be_hidden()
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    expect(page.locator("#overlay")).to_be_visible()
    page.get_by_role("button", name="Resume flight").click()
    expect(page.locator("#overlay")).to_be_hidden()
    page.get_by_role("button", name="SOUND ON").click()
    expect(page.get_by_role("button", name="SOUND OFF")).to_have_attribute(
        "aria-pressed", "false"
    )
    page.screenshot(path=str(tmp_path / "flight.png"))
    assert errors == []


def test_ace_arrival_victory_retry_and_best_score(page, game_url, tmp_path):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(game_url)
    page.get_by_role("button", name="Take to the skies").click()
    page.evaluate(
        """async () => {
            const {game} = await import('/game.mjs');
            game.time = game.config.duration - 0.02;
        }"""
    )
    expect(page.locator("#ace-banner")).to_be_visible()
    expect(page.locator("#ace-name")).to_have_text('Otto "Needle" Weiss')
    expect(page.locator("#boss-meter")).to_be_visible(timeout=5000)
    page.wait_for_function(
        "() => import('/game.mjs').then(({game}) => Boolean(game.boss?.warning))"
    )
    page.screenshot(path=str(tmp_path / "ace-duel.png"))
    page.evaluate(
        """async () => {
            const {game} = await import('/game.mjs');
            game.boss.hp = 1;
            game.bullets.push({
                x: game.boss.x - 20, y: game.boss.y,
                vx: 740, vy: 0, friendly: true,
            });
        }"""
    )
    expect(page.get_by_role("heading", name="Good flying. Stay sharp.")).to_be_visible()
    expect(page.locator("#best")).to_have_text("001250")
    page.keyboard.press("Enter")
    expect(page.locator("#level")).to_have_text("02")
    page.evaluate(
        """async () => {
            const {game} = await import('/game.mjs');
            game.health = 1;
            game.player.invulnerable = 0;
            game.damage('gunfire');
        }"""
    )
    expect(page.get_by_role("heading", name="The sky teaches quickly.")).to_be_visible()
    page.keyboard.press("Enter")
    expect(page.locator("#overlay")).to_be_hidden()
    expect(page.locator("#level")).to_have_text("02")
    expect(page.locator("#hull")).to_have_attribute("aria-label", "Hull: 5 of 5")
    expect(page.locator("#score")).to_have_text("001250")
    page.reload()
    expect(page.locator("#best")).to_have_text("001250")
    expect(page.locator("#level")).to_have_text("01")
    assert errors == []
