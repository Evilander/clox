package io.github.evilander.clox;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WebViewRecoveryPolicyTest {
    @Test
    public void allowsOnlyBoundedRestartsInWindow() {
        WebViewRecoveryPolicy policy = new WebViewRecoveryPolicy(2, 60_000);

        assertTrue(policy.recordAndAllow(10_000));
        assertTrue(policy.recordAndAllow(20_000));
        assertFalse(policy.recordAndAllow(30_000));
    }

    @Test
    public void resetsAfterWindowExpires() {
        WebViewRecoveryPolicy policy = new WebViewRecoveryPolicy(2, 60_000);

        assertTrue(policy.recordAndAllow(10_000));
        assertTrue(policy.recordAndAllow(20_000));
        assertTrue(policy.recordAndAllow(70_001));
    }
}
