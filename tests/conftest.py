import threading

import pytest

from ace_of_the_front import create_server


def pytest_addoption(parser):
    parser.addoption(
        "--browser-tests",
        action="store_true",
        help="Run Chromium gameplay smoke tests.",
    )


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--browser-tests"):
        skip = pytest.mark.skip(reason="Pass --browser-tests to run Chromium checks.")
        for item in items:
            if item.get_closest_marker("browser"):
                item.add_marker(skip)


@pytest.fixture(scope="session")
def game_url():
    with create_server(port=0) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        yield f"http://127.0.0.1:{server.server_port}"
        server.shutdown()
        thread.join(timeout=5)


@pytest.fixture
def page():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        yield page
        browser.close()
