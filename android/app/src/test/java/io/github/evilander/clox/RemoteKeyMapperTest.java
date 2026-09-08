package io.github.evilander.clox;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import android.view.KeyEvent;
import org.junit.Test;

public class RemoteKeyMapperTest {
    @Test
    public void mapsFireTvRemoteKeysToCloxContract() {
        assertEquals("ArrowLeft", RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.ACTION_DOWN));
        assertEquals("ArrowRight", RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.ACTION_DOWN));
        assertEquals("ArrowUp", RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.ACTION_DOWN));
        assertEquals("ArrowDown", RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.ACTION_DOWN));
        assertEquals("Enter", RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.ACTION_DOWN));
        assertEquals("Back", RemoteKeyMapper.map(KeyEvent.KEYCODE_BACK, KeyEvent.ACTION_DOWN));
        assertEquals("Escape", RemoteKeyMapper.map(KeyEvent.KEYCODE_ESCAPE, KeyEvent.ACTION_DOWN));
        assertEquals("ContextMenu", RemoteKeyMapper.map(KeyEvent.KEYCODE_MENU, KeyEvent.ACTION_DOWN));
        assertEquals("MediaPlayPause", RemoteKeyMapper.map(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.ACTION_DOWN));
    }

    @Test
    public void ignoresKeyUpEvents() {
        assertNull(RemoteKeyMapper.map(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.ACTION_UP));
    }

    @Test
    public void identifiesMappedKeyCodesForConsumingKeyUp() {
        assertEquals(true, RemoteKeyMapper.isMappedKeyCode(KeyEvent.KEYCODE_BACK));
        assertEquals(false, RemoteKeyMapper.isMappedKeyCode(KeyEvent.KEYCODE_VOLUME_UP));
    }
}
