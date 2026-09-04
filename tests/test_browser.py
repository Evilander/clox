"""Browser checks against the real file:// app. Run: python -m unittest discover -s tests

Requires Playwright. CLOX_BROWSER=chrome uses an installed Chrome; the default
uses Playwright's Chromium. No web server, app dependencies, or API keys.
"""
import os
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
URL = (ROOT / "index.html").as_uri()
FIXED = "2026-09-04T14:24:36Z"


class MeridianBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        channel = os.environ.get("CLOX_BROWSER")
        cls.browser = cls.playwright.chromium.launch(headless=True, **({"channel": channel} if channel else {}))

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1440, "height": 960})
        self.page = self.context.new_page()
        self.errors = []
        self.network = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("request", lambda request: self.network.append(request.url) if request.url.startswith(("https:", "http:")) else None)
        self.page.clock.set_fixed_time(FIXED)
        self.open()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Browser errors")
        self.assertEqual(self.network, [], "The world clock must work offline")

    def open(self, query="face=meridian&h24=1"):
        self.page.goto(f"{URL}?{query}")
        self.page.wait_for_function("CLOX.faces.some(face => face.id === 'meridian')")
        self.page.wait_for_function("document.getElementById('clock').width > 0")

    def state(self):
        return self.page.evaluate("""() => {
          const s = CLOX.meridian.snapshot(new Date());
          return { live: s.live, instant: s.date.toISOString(), start: s.start, ids: s.cities.map(c => c.id) };
        }""")

    def explore(self):
        self.page.locator("#meridian-time").focus()
        self.page.keyboard.press("End")
        self.assertFalse(self.state()["live"])

    def test_launches_from_disk_with_all_faces_and_real_zone_times(self):
        self.assertEqual(self.page.evaluate("CLOX.faces.length"), 23)
        self.assertTrue(self.page.locator('#hint').evaluate('el => el.classList.contains("hidden")'))
        self.assertEqual(self.state()["ids"], ["chicago", "london", "tokyo", "sydney"])
        self.page.wait_for_function("document.getElementById('meridian-summary').textContent.includes('09:24')")
        summary = self.page.locator("#meridian-summary").text_content()
        for expected in ["Chicago: Fri 2026-09-04, 09:24", "London: Fri 2026-09-04, 15:24", "Tokyo: Fri 2026-09-04, 23:24", "Sydney: Sat 2026-09-05, 00:24"]:
            self.assertIn(expected, summary)

    def test_explore_freezes_one_instant_and_escape_returns_live(self):
        title = self.page.title()
        self.explore()
        explored = self.state()
        self.assertEqual(explored["instant"], "2026-09-05T08:00:00.000Z")
        self.page.clock.set_fixed_time("2026-09-04T15:24:36Z")
        self.assertEqual(self.state()["instant"], explored["instant"])
        self.page.keyboard.press("Escape")
        self.assertTrue(self.state()["live"])
        self.assertEqual(self.state()["instant"], "2026-09-04T15:24:36.000Z")
        self.assertNotIn("Exploring", title)

    def test_native_range_keys_do_not_change_faces_or_global_settings(self):
        slider = self.page.locator("#meridian-time")
        slider.focus()
        self.page.keyboard.press("ArrowRight")
        self.assertFalse(self.state()["live"])
        self.assertFalse(self.page.locator("#meridian-controls").get_attribute("hidden"))
        self.assertIsNone(self.page.evaluate("localStorage.getItem('clox.settings.v1')"))
        self.page.keyboard.press("h")
        self.assertIsNone(self.page.evaluate("localStorage.getItem('clox.settings.v1')"))
        self.page.locator("#meridian-live").click()
        self.assertTrue(self.state()["live"])

    def test_city_dialog_cancels_saves_deduplicates_and_restores_focus(self):
        self.page.locator("#meridian-cities").click()
        self.page.locator("#meridian-city-0").select_option("kathmandu")
        self.page.locator("#meridian-cancel").click()
        self.assertEqual(self.state()["ids"][0], "chicago")
        self.assertTrue(self.page.locator("#meridian-cities").evaluate("el => el === document.activeElement"))
        self.page.locator("#meridian-cities").click()
        self.assertEqual(self.page.locator("#meridian-city-0").input_value(), "chicago")
        self.assertTrue(self.page.locator("#meridian-city-0 option[value=tokyo]").is_disabled())
        self.page.locator("#meridian-city-0").select_option("kathmandu")
        self.page.get_by_role("button", name="Save cities").click()
        self.assertEqual(self.state()["ids"][0], "kathmandu")
        saved = self.page.evaluate("JSON.parse(localStorage.getItem('clox.meridian.v1'))")
        self.assertEqual(saved, {"cities": ["kathmandu", "london", "tokyo", "sydney"]})
        self.open()
        self.assertEqual(self.state()["ids"], saved["cities"])

    def test_url_override_does_not_replace_saved_cities(self):
        saved = ["chicago", "berlin", "delhi", "auckland"]
        self.page.evaluate("cities => localStorage.setItem('clox.meridian.v1', JSON.stringify({cities}))", saved)
        self.open("face=meridian&cities=honolulu,kathmandu,tokyo,chatham")
        self.assertEqual(self.state()["ids"], ["honolulu", "kathmandu", "tokyo", "chatham"])
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('clox.meridian.v1')).cities"), saved)
        self.open()
        self.assertEqual(self.state()["ids"], saved)

    def test_bad_and_blocked_storage_still_launch(self):
        for bad in ["not json", "null", '{"cities":["bad","tokyo","tokyo"]}', '{"cities":true}']:
            self.page.evaluate("value => localStorage.setItem('clox.meridian.v1', value)", bad)
            self.open()
            self.assertEqual(len(set(self.state()["ids"])), 4)
        self.page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('blocked', 'SecurityError')}})")
        self.open("face=meridian&cities=bad,__proto__,tokyo,tokyo")
        self.assertEqual(len(set(self.state()["ids"])), 4)
        self.page.locator("#meridian-cities").click()
        self.page.locator("#meridian-city-0").select_option("kathmandu")
        self.page.get_by_role("button", name="Save cities").click()
        self.assertEqual(self.state()["ids"][0], "kathmandu")

    def test_gallery_previews_do_not_mutate_exploration(self):
        self.explore()
        instant = self.state()["instant"]
        self.page.locator("#meridian-time").evaluate("el => el.blur()")
        self.page.keyboard.press("g")
        self.assertFalse(self.page.locator("#meridian-controls").is_visible())
        self.page.wait_for_timeout(700)
        self.assertEqual(self.state()["instant"], instant)
        self.page.keyboard.press("Escape")
        self.assertTrue(self.page.locator("#meridian-controls").is_visible())
        self.assertEqual(self.state()["instant"], instant)
        self.page.keyboard.press("ArrowRight")
        self.assertFalse(self.page.locator("#meridian-controls").is_visible())
        self.assertTrue(self.state()["live"])
        self.page.keyboard.press("m")
        self.assertTrue(self.page.locator("#meridian-controls").is_visible())

    def test_clipboard_denial_has_selectable_local_fallback(self):
        self.page.evaluate("Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new Error('denied'))}, configurable: true})")
        self.explore()
        self.page.locator("#meridian-copy").click()
        self.page.locator("#meridian-copy-dialog").wait_for(state="visible")
        text = self.page.locator("#meridian-copy-text").input_value()
        self.assertIn("Exploring", text)
        self.assertIn("2026-09-05 08:00 UTC", text)
        self.assertIn("UTC−05:00", text)
        self.assertTrue(self.page.locator("#meridian-copy-text").evaluate("el => el.selectionEnd === el.value.length"))
        self.page.keyboard.press("Escape")
        self.assertFalse(self.page.locator("#meridian-copy-dialog").is_visible())

    def test_modifier_shortcuts_and_modal_keys_are_not_clock_commands(self):
        self.page.keyboard.press("Control+ArrowRight")
        self.assertTrue(self.page.locator("#meridian-controls").is_visible())
        self.page.locator("#meridian-cities").click()
        self.page.locator("#meridian-city-0").focus()
        self.page.keyboard.press("s")
        self.page.keyboard.press("h")
        self.page.keyboard.press("Escape")
        self.assertIsNone(self.page.evaluate("localStorage.getItem('clox.settings.v1')"))

    def test_controls_fit_phone_desktop_and_wide_screens(self):
        for width, height in [(320, 568), (390, 844), (896, 414), (1440, 960), (2560, 1080), (3840, 2160)]:
            with self.subTest(size=(width, height)):
                self.page.set_viewport_size({"width": width, "height": height})
                self.page.mouse.move(width / 2, height / 2)
                self.page.wait_for_timeout(120)
                for selector in ["#meridian-cities", "#meridian-copy", "#meridian-live", "#meridian-time"]:
                    box = self.page.locator(selector).bounding_box()
                    self.assertGreaterEqual(box["x"], 0, selector)
                    self.assertGreaterEqual(box["y"], 0, selector)
                    self.assertLessEqual(box["x"] + box["width"], width + 1, selector)
                    self.assertLessEqual(box["y"] + box["height"], height + 1, selector)

    def test_every_face_still_draws_and_snapshot_downloads(self):
        ids = self.page.evaluate("CLOX.faces.map(face => face.id)")
        for face_id in ids:
            self.open(f"face={face_id}")
            self.page.wait_for_timeout(100)
            self.assertEqual(self.errors, [], face_id)
        self.page.keyboard.press("m")
        with self.page.expect_download() as download:
            self.page.keyboard.press("p")
        self.assertTrue(download.value.suggested_filename.startswith("clox-meridian-"))
        self.assertGreater(Path(download.value.path()).stat().st_size, 10000)

    def test_gallery_has_native_touch_and_keyboard_controls(self):
        self.assertEqual(self.page.locator('#meridian-faces').count(), 1)
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.locator('#meridian-faces').click()
        self.assertTrue(self.page.locator('#face-gallery').is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("aria-label")'), 'Meridian · World Time')
        choices = self.page.locator('#gallery-buttons button')
        self.assertEqual(choices.count(), 23)
        for box in choices.evaluate_all('els => els.map(el => {const r=el.getBoundingClientRect(); return {w:r.width,h:r.height}})'):
            self.assertGreaterEqual(box['w'], 44)
            self.assertGreaterEqual(box['h'], 44)
        self.page.get_by_role('button', name='Nixie · IN-18', exact=True).click()
        self.assertFalse(self.page.locator('#face-gallery').is_visible())
        self.assertFalse(self.page.locator('#meridian-controls').is_visible())
        self.page.locator('#gallery-button').click()
        self.page.keyboard.press('End')
        self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#meridian-controls').is_visible())
        self.page.locator('#meridian-faces').click()
        self.page.get_by_role('button', name='Back to clock', exact=True).click()
        self.assertTrue(self.page.locator('#meridian-controls').is_visible())

    def test_auto_cycle_waits_for_exploration_and_city_dialog(self):
        with self.browser.new_context() as context:
            page = context.new_page()
            page.on('pageerror', lambda error: self.errors.append(str(error)))
            page.clock.install(time=FIXED)
            page.goto(f'{URL}?face=meridian&cycle=1')
            page.locator('#meridian-time').focus()
            page.keyboard.press('End')
            instant = page.evaluate('CLOX.meridian.snapshot(new Date()).date.toISOString()')
            page.clock.fast_forward(125000)
            self.assertTrue(page.locator('#meridian-controls').is_visible())
            self.assertEqual(page.evaluate('CLOX.meridian.snapshot(new Date()).date.toISOString()'), instant)
            page.locator('#meridian-live').click()
            page.locator('#meridian-cities').click()
            page.clock.fast_forward(125000)
            self.assertTrue(page.locator('#meridian-city-dialog').is_visible())
            page.keyboard.press('Escape')
            page.locator('#meridian-cities').evaluate('el => el.blur()')
            page.clock.fast_forward(125000)
            page.wait_for_function('document.getElementById("meridian-controls").hidden')
            self.assertFalse(page.locator('#meridian-controls').is_visible())

    def test_touch_controls_remain_visible_after_idle_with_reduced_motion(self):
        with self.browser.new_context(has_touch=True, is_mobile=True, viewport={"width": 390, "height": 844}, reduced_motion='reduce') as context:
            page = context.new_page()
            page.on('pageerror', lambda error: self.errors.append(str(error)))
            page.clock.install(time=FIXED)
            page.goto(f'{URL}?face=meridian')
            page.clock.fast_forward(4000)
            self.assertEqual(page.locator('.meridian-actions').evaluate('el => getComputedStyle(el).opacity'), '1')
            self.assertEqual(page.locator('.meridian-scrub').evaluate('el => getComputedStyle(el).opacity'), '1')
            page.locator('#meridian-faces').tap()
            page.get_by_role('button', name='Nixie · IN-18', exact=True).tap()
            page.clock.fast_forward(4000)
            self.assertEqual(page.locator('#gallery-button').evaluate('el => getComputedStyle(el).opacity'), '1')

    def test_fullscreen_still_works_from_canvas(self):
        self.page.locator('#clock').click(position={"x": 5, "y": 5})
        self.page.wait_for_function('!!document.fullscreenElement')
        self.page.locator('#clock').click(position={"x": 5, "y": 5})
        self.page.wait_for_function('!document.fullscreenElement')

    def test_global_shortcuts_resume_after_buttons_and_dialogs(self):
        self.page.locator('#meridian-live').click()
        self.page.keyboard.press('h')
        self.assertIsNotNone(self.page.evaluate("localStorage.getItem('clox.settings.v1')"))
        self.assertFalse(self.page.evaluate("JSON.parse(localStorage.getItem('clox.settings.v1')).h24"))
        self.page.locator('#meridian-cities').click()
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#meridian-cities').evaluate('el => el === document.activeElement'))
        self.page.keyboard.press('g')
        self.assertTrue(self.page.locator('#face-gallery').is_visible())
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('ArrowRight')
        self.assertFalse(self.page.locator('#meridian-controls').is_visible())


if __name__ == "__main__":
    unittest.main()
