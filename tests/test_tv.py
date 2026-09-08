"""Remote-only controls, UHD rendering, clock effects, and lifecycle checks."""
import os
from pathlib import Path
import unittest

from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parents[1] / "index.html").as_uri()


class TVTests(unittest.TestCase):
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
        self.context = self.browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
        self.page = self.context.new_page()
        self.errors = []
        self.network = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("request", lambda request: self.network.append(request.url) if request.url.startswith(("http:", "https:")) else None)
        self.page.clock.install(time="2026-09-07T22:24:36Z")
        self.open()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.network, [], "The APK must not fetch runtime assets")

    def open(self, query="tv=1&cycle=0"):
        self.page.goto(f"{URL}?{query}")
        self.page.wait_for_function("CLOX.engine.face && CLOX.tv")

    def key(self, key):
        self.page.keyboard.press(key)

    def test_tv_starts_fullscreen_at_uhd_with_the_retired_faces_removed(self):
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "nocturne")
        self.assertEqual(self.page.locator("#clock").evaluate("c => [c.width,c.height]"), [3840, 2160])
        ids = self.page.evaluate("CLOX.faces.map(f => f.id)")
        self.assertEqual(len(ids), 24)
        self.assertNotIn("ocarina", ids)
        self.assertNotIn("berlin", ids)
        self.assertTrue({"dvd", "airwave", "nocturne"}.issubset(ids))
        self.assertFalse(self.page.locator("#gallery-button").is_visible())
        self.key("ArrowRight")
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "dvd")
        self.key("ArrowLeft")
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "nocturne")
        self.page.set_viewport_size({"width": 3840, "height": 2160})
        self.page.wait_for_function("innerWidth === 3840")
        self.assertEqual(self.page.locator("#clock").evaluate("c => [c.width,c.height]"), [3840, 2160])

    def test_remote_gallery_select_and_back_without_a_mouse(self):
        self.key("Enter")
        self.assertTrue(self.page.locator("#face-gallery").is_visible())
        self.key("ArrowRight")
        self.key("Enter")
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "dvd")
        self.assertFalse(self.page.locator("#face-gallery").is_visible())
        self.assertFalse(self.page.evaluate("CLOX.tv.handleKey('Escape')"))
        self.key("ArrowUp")
        self.assertTrue(self.page.evaluate("CLOX.tv.handleKey('Escape')"))
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "dvd")

    def test_settings_are_remote_accessible_and_survive_restart(self):
        self.key("ArrowDown")
        self.assertTrue(self.page.locator("#tv-menu").is_visible())
        for _ in range(3):
            self.key("ArrowDown")
        self.assertEqual(self.page.evaluate("document.activeElement.dataset.tvAction"), "h24")
        self.key("Enter")
        self.assertTrue(self.page.evaluate("CLOX.engine.settings.h24"))
        self.key("ArrowRight")
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "nocturne")
        self.key("Escape")
        self.key("Space")
        self.assertTrue(self.page.evaluate("CLOX.engine.settings.cycle"))
        self.open("tv=1")
        self.assertTrue(self.page.evaluate("CLOX.engine.settings.h24"))
        self.assertTrue(self.page.evaluate("CLOX.engine.settings.cycle"))

    def test_tv_preview_preserves_the_desktop_chime_preference(self):
        self.page.evaluate("localStorage.setItem('clox.settings.v1', JSON.stringify({chime:true}))")
        self.open()
        self.assertFalse(self.page.evaluate("CLOX.engine.settings.chime"))
        self.key("ArrowRight")
        self.assertTrue(self.page.evaluate("JSON.parse(localStorage.getItem('clox.settings.v1')).chime"))

    def test_menu_pauses_rotation_and_native_pause_stops_rendering(self):
        self.open("tv=1&cycle=1&face=dvd")
        self.key("ArrowDown")
        self.page.clock.fast_forward(125000)
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "dvd")
        self.key("Escape")
        self.page.evaluate("""() => {
          const face=CLOX.engine.face, original=face.draw;
          window.drawCount=0;
          face.draw=(...args) => { window.drawCount++; return original(...args); };
          CLOX.tv.setActive(false);
        }""")
        self.page.clock.fast_forward(10000)
        self.assertEqual(self.page.evaluate("drawCount"), 0)
        self.page.evaluate("CLOX.tv.setActive(true)")
        self.page.clock.run_for(100)
        self.assertGreater(self.page.evaluate("drawCount"), 0)
        self.page.clock.fast_forward(125000)
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "airwave")

    def test_world_cities_cancel_and_save_with_only_dpad(self):
        original = self.page.evaluate("CLOX.meridian.snapshot(new Date()).cities.map(c=>c.id)")
        self.key("ArrowDown")
        for _ in range(6):
            self.key("ArrowDown")
        self.assertEqual(self.page.evaluate("document.activeElement.dataset.tvAction"), "cities")
        self.key("Enter")
        self.key("ArrowRight")
        self.key("Escape")
        self.assertEqual(self.page.evaluate("CLOX.meridian.snapshot(new Date()).cities.map(c=>c.id)"), original)
        for _ in range(6):
            self.key("ArrowDown")
        self.key("Enter")
        for _ in range(40):
            self.key("ArrowRight")
        for _ in range(4):
            self.key("ArrowDown")
        self.key("Enter")
        saved = self.page.evaluate("CLOX.meridian.snapshot(new Date()).cities.map(c=>c.id)")
        self.assertEqual(len(set(saved)), 4)
        self.assertNotEqual(saved, original)
        self.assertEqual(self.page.evaluate("CLOX.engine.face.id"), "meridian")
        self.assertFalse(self.page.locator("#meridian-controls").is_visible())
        self.page.clock.run_for(1100)
        self.assertIn("Meridian world clock", self.page.locator("#clock").get_attribute("aria-label"))
        self.open()
        self.assertEqual(self.page.evaluate("CLOX.meridian.snapshot(new Date()).cities.map(c=>c.id)"), saved)

    def test_dvd_bounces_stay_on_screen_and_do_not_hit_corners(self):
        result = self.page.evaluate("""() => {
          const state={x:0,y:80,vx:59,vy:48,color:0}; let colors=new Set();
          for(let i=0;i<36000;i++) {
            CLOX.dvdClock.advance(state,0.1,1560,780);
            if(state.x<0||state.x>1560||state.y<0||state.y>780) return 'out of bounds';
            if(Math.min(state.x,1560-state.x)<1 && Math.min(state.y,780-state.y)<1) return 'corner hit';
            colors.add(state.color);
          }
          return colors.size;
        }""")
        self.assertEqual(result, 6)
        self.assertEqual(self.page.evaluate("CLOX.dvdClock.countdown(new Date(2026,8,7,23,59,59))"), 1)
        self.assertEqual(self.page.evaluate("CLOX.dvdClock.countdown(new Date(2026,8,8,0,0,0))"), 3600)

    def test_airwave_hourly_snow_is_independent_of_entry_time_and_recovers(self):
        values = self.page.evaluate("""() => [
          new Date(2026,8,7,23,59,59,900), new Date(2026,8,8,0,0,0),
          new Date(2026,8,8,0,0,2,300), new Date(2026,8,8,0,0,3)
        ].map(CLOX.airwave.signal)""")
        self.assertFalse(values[0]["snow"])
        self.assertTrue(values[1]["snow"])
        self.assertEqual(values[1]["reveal"], 0)
        self.assertTrue(0 < values[2]["reveal"] < 1)
        self.assertFalse(values[3]["snow"])
        self.open("tv=1&face=airwave&cycle=0")
        self.page.clock.set_fixed_time("2026-09-08T00:00:00.100Z")
        self.page.clock.run_for(100)
        snow = self.page.locator("#clock").evaluate("c => c.toDataURL()")
        self.page.clock.set_fixed_time("2026-09-08T00:00:04Z")
        self.page.clock.run_for(100)
        clean = self.page.locator("#clock").evaluate("c => c.toDataURL()")
        self.assertNotEqual(snow, clean)

    def test_lunar_phase_wraps_at_new_moon_and_lights_the_full_moon(self):
        phases = self.page.evaluate("""() => {
          const epoch=Date.UTC(2000,0,6,18,14), month=29.530588853*86400000;
          return [0,0.25,0.5,0.75,1,-0.5].map(f=>CLOX.nocturne.phase(new Date(epoch+f*month)));
        }""")
        self.assertEqual(phases[0]["name"], "New moon")
        self.assertAlmostEqual(phases[0]["illumination"], 0)
        self.assertAlmostEqual(phases[1]["illumination"], 0.5, places=5)
        self.assertAlmostEqual(phases[2]["illumination"], 1, places=5)
        self.assertEqual(phases[3]["name"], "Last quarter")
        self.assertAlmostEqual(phases[4]["illumination"], 0, places=5)
        self.assertAlmostEqual(phases[5]["illumination"], 1, places=5)


if __name__ == "__main__":
    unittest.main()
