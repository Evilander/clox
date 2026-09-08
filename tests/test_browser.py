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
        self.assertEqual(self.page.evaluate("CLOX.faces.length"), 24)
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
                for selector in ["#meridian-cities", "#meridian-plan", "#meridian-copy", "#meridian-live", "#meridian-time"]:
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
        self.assertEqual(choices.count(), 24)
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
            page.locator('#meridian-plan').click()
            page.clock.fast_forward(125000)
            self.assertTrue(page.locator('#meeting-dialog').is_visible())
            page.keyboard.press('Escape')
            page.locator('#meridian-plan').evaluate('el => el.blur()')
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

    def plan(self, pair=True):
        self.assertEqual(self.page.locator('#meridian-plan').count(), 1)
        self.page.locator('#meridian-plan').click()
        self.page.locator('#meeting-date').fill('2026-09-07')
        if pair:
            self.page.locator('#meeting-join-tokyo').uncheck()
            self.page.locator('#meeting-join-sydney').uncheck()
        self.page.get_by_role('button', name='Find times', exact=False).click()

    def test_planner_finds_overlap_and_downloads_the_selected_calendar_event(self):
        self.plan()
        self.assertEqual(self.page.locator('#meeting-result-title').text_content(), 'A shared window.')
        self.assertIn('7 possible starts', self.page.locator('#meeting-result-status').text_content())
        self.assertIn('09:00', self.page.locator('.meeting-slot[aria-pressed=true]').text_content())
        self.page.locator('#meeting-event-title').fill('Design review, round 2')
        with self.page.expect_download() as download:
            self.page.locator('#meeting-calendar').click()
        self.assertTrue(download.value.suggested_filename.endswith('.ics'))
        data = Path(download.value.path()).read_bytes()
        self.assertIn(b'DTSTART:20260907T140000Z\r\n', data)
        self.assertIn(b'DTEND:20260907T143000Z\r\n', data)
        self.assertIn(b'SUMMARY:Design review\\, round 2\r\n', data)
        self.assertNotIn(b'ATTENDEE:', data)

    def test_planner_makes_no_overlap_explicit_and_copies_every_local_date(self):
        self.plan(pair=False)
        self.assertEqual(self.page.locator('#meeting-result-title').text_content(), 'No shared window.')
        self.assertEqual(self.page.locator('#meeting-local-times tr').count(), 4)
        self.assertGreater(self.page.locator('#meeting-local-times .is-compromise').count(), 0)
        self.page.evaluate("Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new Error('denied'))}, configurable: true})")
        self.page.locator('#meeting-copy').click()
        field = self.page.locator('#meeting-copy-text')
        field.wait_for(state='visible')
        text = field.input_value()
        for city in ['Chicago', 'London', 'Tokyo', 'Sydney']:
            self.assertIn(f'{city}:', text)
        self.assertIn('UTC: 2026-09-07', text)
        self.assertIn('outside hours', text)
        self.assertTrue(field.evaluate('el => el.selectionEnd === el.value.length'))

    def test_planner_can_preview_a_chosen_start_on_the_atlas(self):
        self.plan()
        self.page.locator('.meeting-slot').nth(1).click()
        self.page.locator('#meeting-atlas').click()
        self.assertFalse(self.page.locator('#meeting-dialog').is_visible())
        self.assertFalse(self.state()['live'])
        self.assertEqual(self.state()['instant'], '2026-09-07T14:30:00.000Z')
        self.assertTrue(self.page.locator('#meridian-plan').evaluate('el => el === document.activeElement'))
        self.page.locator('#meridian-live').click()
        self.assertTrue(self.state()['live'])

    def test_planner_can_choose_a_precise_start_outside_the_suggestion_cards(self):
        self.plan()
        self.assertEqual(self.page.locator('#meeting-all-starts option').count(), 96)
        instant = self.page.evaluate("Date.parse('2026-09-07T14:15:00Z')")
        self.page.locator('#meeting-all-starts').select_option(str(instant))
        self.assertEqual(self.page.locator('.meeting-slot[aria-pressed=true]').count(), 0)
        self.assertIn('09:15', self.page.locator('#meeting-local-times').text_content())
        with self.page.expect_download() as download:
            self.page.locator('#meeting-calendar').click()
        self.assertIn(b'DTSTART:20260907T141500Z\r\n', Path(download.value.path()).read_bytes())

    def test_planner_invalidates_stale_results_and_saves_availability(self):
        self.plan()
        self.page.locator('#meeting-from-chicago').fill('10:00')
        self.assertTrue(self.page.locator('#meeting-calendar').is_disabled())
        self.assertFalse(self.page.locator('#meeting-selection').is_visible())
        self.page.get_by_role('button', name='Find times', exact=False).click()
        self.assertIn('10:00', self.page.locator('.meeting-slot[aria-pressed=true]').text_content())
        self.page.keyboard.press('Escape')
        self.open()
        self.page.locator('#meridian-plan').click()
        self.assertEqual(self.page.locator('#meeting-from-chicago').input_value(), '10:00')
        self.assertFalse(self.page.locator('#meeting-join-tokyo').is_checked())
        self.assertTrue(self.page.locator('#meeting-from-tokyo').is_disabled())

    def test_planner_rejects_empty_participants_and_equal_hours(self):
        self.plan()
        self.page.locator('#meeting-join-london').uncheck()
        self.page.get_by_role('button', name='Find times', exact=False).click()
        self.assertIn('at least two cities', self.page.locator('#meeting-result-status').text_content())
        self.assertTrue(self.page.locator('#meeting-calendar').is_disabled())
        self.page.locator('#meeting-join-london').check()
        self.page.locator('#meeting-to-chicago').fill('09:00')
        self.page.get_by_role('button', name='Find times', exact=False).click()
        self.assertIn('different start and end times', self.page.locator('#meeting-result-status').text_content())
        self.assertTrue(self.page.locator('#meeting-calendar').is_disabled())

    def test_planner_survives_malformed_and_blocked_storage(self):
        for value in ['null', '{bad', '{"hours":true,"duration":-1}', '{"hours":{"chicago":{"from":"bad","to":9}},"includeWeekends":"true"}']:
            self.page.evaluate("value => localStorage.setItem('clox.meeting.v1', value)", value)
            self.open()
            self.page.locator('#meridian-plan').click()
            self.assertEqual(self.page.locator('#meeting-from-chicago').input_value(), '09:00')
            self.assertEqual(self.page.locator('#meeting-duration').input_value(), '30')
            self.assertFalse(self.page.locator('#meeting-weekends').is_checked())
            self.page.keyboard.press('Escape')
        self.page.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('blocked', 'SecurityError')}})")
        self.open()
        self.plan()
        self.assertEqual(self.page.locator('#meeting-result-title').text_content(), 'A shared window.')

    def test_planner_phone_layout_has_no_horizontal_overflow_and_keeps_native_keys(self):
        for width, height in [(320, 568), (390, 844), (896, 414)]:
            self.page.set_viewport_size({'width': width, 'height': height})
            self.plan()
            self.assertTrue(self.page.locator('#meeting-dialog').evaluate('el => el.scrollWidth <= el.clientWidth + 1'))
            self.page.locator('#meeting-event-title').fill('Planning G, H, M & S')
            self.page.keyboard.press('ArrowLeft')
            self.assertTrue(self.page.locator('#meeting-dialog').is_visible())
            self.page.locator('#meeting-calendar').scroll_into_view_if_needed()
            box = self.page.locator('#meeting-calendar').bounding_box()
            self.assertGreaterEqual(box['x'], 0)
            self.assertLessEqual(box['x'] + box['width'], width)
            self.page.keyboard.press('Escape')
            self.assertTrue(self.page.locator('#meridian-plan').evaluate('el => el === document.activeElement'))
            self.assertTrue(self.page.locator('#meridian-controls').is_visible())

    def test_planner_does_not_export_a_start_that_passed_while_open(self):
        self.plan()
        self.page.clock.set_fixed_time('2026-09-07T14:01:00Z')
        downloads = []
        self.page.on('download', lambda download: downloads.append(download.suggested_filename))
        self.page.locator('#meeting-calendar').click()
        self.assertEqual(downloads, [])
        self.assertIn('start has passed', self.page.locator('#meeting-result-status').text_content())
        self.assertIn('09:15', self.page.locator('.meeting-slot[aria-pressed=true]').text_content())


if __name__ == "__main__":
    unittest.main()
