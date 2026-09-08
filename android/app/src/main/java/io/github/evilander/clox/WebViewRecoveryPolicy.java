package io.github.evilander.clox;

final class WebViewRecoveryPolicy {
    private final int maxRestarts;
    private final long windowMs;
    private long windowStartMs = Long.MIN_VALUE;
    private int restartsInWindow;

    WebViewRecoveryPolicy(int maxRestarts, long windowMs) {
        this.maxRestarts = maxRestarts;
        this.windowMs = windowMs;
    }

    boolean recordAndAllow(long nowMs) {
        if (windowStartMs == Long.MIN_VALUE || nowMs - windowStartMs > windowMs) {
            windowStartMs = nowMs;
            restartsInWindow = 0;
        }
        if (restartsInWindow >= maxRestarts) {
            return false;
        }
        restartsInWindow++;
        return true;
    }
}
