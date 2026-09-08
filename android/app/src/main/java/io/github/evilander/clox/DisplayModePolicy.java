package io.github.evilander.clox;

import java.util.Collection;

final class DisplayModePolicy {
    static final int UHD_WIDTH = 3840;
    static final int UHD_HEIGHT = 2160;
    static final int VIRTUAL_DENSITY_DPI = 320;

    private DisplayModePolicy() {
    }

    static ModeChoice chooseMode(Collection<Candidate> candidates, int currentModeId) {
        if (candidates == null || candidates.isEmpty()) {
            return ModeChoice.none();
        }

        Candidate usableUhd = null;
        Candidate fallbackUhd = null;
        for (Candidate candidate : candidates) {
            if (candidate.width >= UHD_WIDTH && candidate.height >= UHD_HEIGHT) {
                if (candidate.refreshRate >= 50.0f) {
                    if (isBetter(candidate, usableUhd)) {
                        usableUhd = candidate;
                    }
                } else if (candidate.refreshRate >= 30.0f) {
                    if (isBetter(candidate, fallbackUhd)) {
                        fallbackUhd = candidate;
                    }
                }
            }
        }

        Candidate best = usableUhd;
        if (best == null) {
            best = fallbackUhd;
        }
        if (best == null) {
            return ModeChoice.none();
        }
        if (best.modeId == currentModeId) {
            return new ModeChoice(0, best.width, best.height, best.refreshRate);
        }
        return new ModeChoice(best.modeId, best.width, best.height, best.refreshRate);
    }

    private static boolean isBetter(Candidate candidate, Candidate current) {
        if (current == null) {
            return true;
        }
        long candidatePixels = (long) candidate.width * candidate.height;
        long currentPixels = (long) current.width * current.height;
        if (candidatePixels != currentPixels) {
            return candidatePixels > currentPixels;
        }
        float candidateRefreshDistance = Math.abs(candidate.refreshRate - 60.0f);
        float currentRefreshDistance = Math.abs(current.refreshRate - 60.0f);
        if (candidateRefreshDistance != currentRefreshDistance) {
            return candidateRefreshDistance < currentRefreshDistance;
        }
        return candidate.modeId > current.modeId;
    }

    static final class Candidate {
        final int modeId;
        final int width;
        final int height;
        final float refreshRate;

        Candidate(int modeId, int width, int height, float refreshRate) {
            this.modeId = modeId;
            this.width = width;
            this.height = height;
            this.refreshRate = refreshRate;
        }
    }

    static final class ModeChoice {
        final int modeId;
        final int width;
        final int height;
        final float refreshRate;

        private ModeChoice(int modeId, int width, int height, float refreshRate) {
            this.modeId = modeId;
            this.width = width;
            this.height = height;
            this.refreshRate = refreshRate;
        }

        static ModeChoice none() {
            return new ModeChoice(0, 0, 0, 0.0f);
        }

        boolean usesUhdSurface() {
            return width >= UHD_WIDTH && height >= UHD_HEIGHT;
        }
    }
}
