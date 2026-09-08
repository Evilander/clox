package io.github.evilander.clox;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import org.junit.Test;

public class DisplayModePolicyTest {
    @Test
    public void prefersUhdSixtyHertzWhenAvailable() {
        DisplayModePolicy.ModeChoice choice = DisplayModePolicy.chooseMode(
            Arrays.asList(
                new DisplayModePolicy.Candidate(1, 1920, 1080, 60.0f),
                new DisplayModePolicy.Candidate(2, 3840, 2160, 60.0f),
                new DisplayModePolicy.Candidate(3, 3840, 2160, 24.0f)
            ),
            1
        );

        assertEquals(2, choice.modeId);
        assertEquals(3840, choice.width);
        assertEquals(2160, choice.height);
    }

    @Test
    public void leavesModeUnspecifiedWhenOnlyCurrentModeIsSuitable() {
        DisplayModePolicy.ModeChoice choice = DisplayModePolicy.chooseMode(
            Arrays.asList(new DisplayModePolicy.Candidate(7, 1920, 1080, 60.0f)),
            7
        );

        assertEquals(0, choice.modeId);
    }

    @Test
    public void usesCurrentUhdModeWithoutRequestingAModeSwitch() {
        DisplayModePolicy.ModeChoice choice = DisplayModePolicy.chooseMode(
            Arrays.asList(
                new DisplayModePolicy.Candidate(1, 1920, 1080, 60.0f),
                new DisplayModePolicy.Candidate(2, 3840, 2160, 60.0f)
            ),
            2
        );

        assertEquals(0, choice.modeId);
        assertEquals(3840, choice.width);
        assertEquals(2160, choice.height);
        assertTrue(choice.usesUhdSurface());
    }
}
