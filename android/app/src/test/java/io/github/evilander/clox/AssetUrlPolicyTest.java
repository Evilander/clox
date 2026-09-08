package io.github.evilander.clox;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AssetUrlPolicyTest {
    @Test
    public void allowsOnlyBundledClockAssets() {
        assertTrue(AssetUrlPolicy.isAllowed("file:///android_asset/index.html?tv=1"));
        assertTrue(AssetUrlPolicy.isAllowed("file:///android_asset/css/style.css"));
        assertTrue(AssetUrlPolicy.isAllowed("file:///android_asset/js/engine.js"));

        assertFalse(AssetUrlPolicy.isAllowed("https://example.com/"));
        assertFalse(AssetUrlPolicy.isAllowed("file:///android_asset/screenshots/redline.jpg"));
        assertFalse(AssetUrlPolicy.isAllowed("file:///android_asset/js/../README.md"));
        assertFalse(AssetUrlPolicy.isAllowed("file:///android_asset/js/%2e%2e/%2e%2e/foo"));
        assertFalse(AssetUrlPolicy.isAllowed("file://example.com/android_asset/js/engine.js"));
        assertFalse(AssetUrlPolicy.isAllowed("file:///android_asset/js/%5cfoo.js"));
    }
}
