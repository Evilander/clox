package io.github.evilander.clox;

import java.net.URI;
import java.net.URISyntaxException;

final class AssetUrlPolicy {
    private static final String ASSET_PREFIX = "/android_asset/";

    private AssetUrlPolicy() {
    }

    static boolean isAllowed(String url) {
        if (url == null) {
            return false;
        }
        try {
            URI uri = new URI(url);
            if (!"file".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            if (uri.getRawAuthority() != null && !uri.getRawAuthority().isEmpty()) {
                return false;
            }
            String path = uri.getPath();
            if (path == null
                || !path.startsWith(ASSET_PREFIX)
                || path.contains("\\")
                || hasDotSegment(path)) {
                return false;
            }
            String relative = path.substring(ASSET_PREFIX.length());
            return "index.html".equals(relative)
                || relative.startsWith("css/")
                || relative.startsWith("js/");
        } catch (IllegalArgumentException | URISyntaxException ex) {
            return false;
        }
    }

    private static boolean hasDotSegment(String path) {
        String[] segments = path.split("/");
        for (String segment : segments) {
            if (".".equals(segment) || "..".equals(segment)) {
                return true;
            }
        }
        return false;
    }

    static boolean isNetworkScheme(String url) {
        if (url == null) {
            return false;
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        } catch (IllegalArgumentException | URISyntaxException ex) {
            return false;
        }
    }
}
