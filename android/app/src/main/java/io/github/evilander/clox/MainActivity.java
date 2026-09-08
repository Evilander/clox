package io.github.evilander.clox;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.KeyEvent;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@SuppressWarnings("deprecation")
public final class MainActivity extends Activity {
    private static final String TAG = "Clox";
    private static final String CLOCK_URL = "file:///android_asset/index.html?tv=1";

    private CloxWebHost webHost;
    private DisplayModePolicy.ModeChoice displayModeChoice = DisplayModePolicy.ModeChoice.none();
    private String rendererName = "direct-webview";
    private boolean activityResumed;
    private final WebViewRecoveryPolicy recoveryPolicy = new WebViewRecoveryPolicy(2, 60_000);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        applyImmersiveMode();
        displayModeChoice = chooseDisplayMode();
        applyPreferredDisplayMode(displayModeChoice);

        if (displayModeChoice.usesUhdSurface()) {
            rendererName = "uhd-virtual-display";
            SurfaceView surfaceView = new SurfaceView(this);
            webHost = new VirtualDisplayWebHost(this, surfaceView, displayModeChoice);
            setContentView(surfaceView);
        } else {
            WebView webView = createWebView(this);
            webHost = new DirectWebHost(webView);
            setContentView(webView);
            webView.loadUrl(CLOCK_URL);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        activityResumed = true;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();
        if (webHost != null) {
            webHost.onResume();
            setCloxActive(true);
        }
    }

    @Override
    protected void onPause() {
        activityResumed = false;
        if (webHost != null) {
            setCloxActive(false);
            webHost.onPause();
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webHost != null) {
            webHost.destroy();
            webHost = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (handleRemoteKeyEvent(event)) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private boolean handleRemoteKeyEvent(KeyEvent event) {
        String key = RemoteKeyMapper.map(event.getKeyCode(), event.getAction());
        if (key != null) {
            forwardRemoteKey(key);
            return true;
        }
        if (event.getAction() == KeyEvent.ACTION_UP
            && RemoteKeyMapper.isMappedKeyCode(event.getKeyCode())) {
            return true;
        }
        return false;
    }

    @SuppressWarnings("deprecation")
    private Display getMainDisplay() {
        return getWindowManager().getDefaultDisplay();
    }

    private DisplayModePolicy.ModeChoice chooseDisplayMode() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return DisplayModePolicy.ModeChoice.none();
        }
        Display display = getMainDisplay();
        Display.Mode[] modes = display.getSupportedModes();
        List<DisplayModePolicy.Candidate> candidates = new ArrayList<>();
        for (Display.Mode mode : modes) {
            candidates.add(new DisplayModePolicy.Candidate(
                mode.getModeId(),
                mode.getPhysicalWidth(),
                mode.getPhysicalHeight(),
                mode.getRefreshRate()
            ));
        }
        return DisplayModePolicy.chooseMode(candidates, display.getMode().getModeId());
    }

    private void applyPreferredDisplayMode(DisplayModePolicy.ModeChoice choice) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || choice.modeId == 0) {
            return;
        }
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.preferredDisplayModeId = choice.modeId;
        getWindow().setAttributes(params);
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveMode() {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void forwardRemoteKey(String key) {
        WebView webView = webHost == null ? null : webHost.webView();
        if (webView == null) {
            if (RemoteKeyMapper.exitsWhenUnhandled(key)) {
                finish();
            }
            return;
        }
        String script = buildRemoteKeyScript(key);
        boolean exitsWhenUnhandled = RemoteKeyMapper.exitsWhenUnhandled(key);
        webView.evaluateJavascript(script, result -> {
            boolean handled = "true".equals(result);
            if (exitsWhenUnhandled && !handled && !isFinishing()) {
                finish();
            }
        });
    }

    private String buildRemoteKeyScript(String key) {
        String quotedKey = JSONObject.quote(key);
        String quotedFallback = JSONObject.quote(RemoteKeyMapper.keyboardFallbackKey(key));
        return "(function(){"
            + "var key=" + quotedKey + ";"
            + "var handled=false;"
            + "try{"
            + "if(window.CLOX&&CLOX.tv&&typeof CLOX.tv.handleKey==='function'){"
            + "handled=CLOX.tv.handleKey(key)!==false;"
            + "}else{"
            + "var e=new KeyboardEvent('keydown',{key:" + quotedFallback + ",bubbles:true,cancelable:true});"
            + "window.dispatchEvent(e);"
            + "handled=e.defaultPrevented;"
            + "}"
            + "}catch(_){handled=false;}"
            + "return !!handled;"
            + "})()";
    }

    private void setCloxActive(boolean active) {
        WebView webView = webHost == null ? null : webHost.webView();
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{if(window.CLOX&&CLOX.tv&&typeof CLOX.tv.setActive==='function'){CLOX.tv.setActive("
                + active
                + ");}}catch(_){}})()",
            null
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView(Context context) {
        WebView webView = new WebView(context);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new CloxWebViewClient(this));
        webView.addJavascriptInterface(new HostBridge(), "CloxHost");
        webView.requestFocus();
        return webView;
    }

    @TargetApi(Build.VERSION_CODES.O)
    private boolean recoverFromRendererGone(WebView view, RenderProcessGoneDetail detail) {
        Log.w(TAG, "WebView renderer exited; didCrash=" + detail.didCrash()
            + ", priority=" + detail.rendererPriorityAtExit());
        if (!recoveryPolicy.recordAndAllow(SystemClock.elapsedRealtime())) {
            if (webHost != null) {
                webHost.destroy();
                webHost = null;
            }
            finish();
            return true;
        }
        if (webHost == null || !webHost.recoverRenderer(view, activityResumed)) {
            finish();
        }
        return true;
    }

    private static void destroyWebView(WebView webView) {
        if (webView == null) {
            return;
        }
        if (webView.getParent() instanceof ViewGroup) {
            ((ViewGroup) webView.getParent()).removeView(webView);
        }
        webView.destroy();
    }

    private String displayInfoJson() {
        JSONObject root = new JSONObject();
        try {
            Display display = getMainDisplay();
            root.put("apiLevel", Build.VERSION.SDK_INT);
            root.put("renderer", rendererName);
            root.put("preferredDisplayModeId", displayModeChoice.modeId);
            root.put("preferredWidth", displayModeChoice.width);
            root.put("preferredHeight", displayModeChoice.height);
            root.put("preferredRefreshRate", displayModeChoice.refreshRate);
            root.put("virtualSurfaceWidth", displayModeChoice.usesUhdSurface() ? displayModeChoice.width : 0);
            root.put("virtualSurfaceHeight", displayModeChoice.usesUhdSurface() ? displayModeChoice.height : 0);
            root.put("virtualDensityDpi", displayModeChoice.usesUhdSurface() ? DisplayModePolicy.VIRTUAL_DENSITY_DPI : 0);

            DisplayMetrics metrics = new DisplayMetrics();
            display.getMetrics(metrics);
            root.put("reportedWidthPixels", metrics.widthPixels);
            root.put("reportedHeightPixels", metrics.heightPixels);
            root.put("reportedDensityDpi", metrics.densityDpi);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display.Mode current = display.getMode();
                root.put("currentMode", modeJson(current));
                JSONArray supported = new JSONArray();
                for (Display.Mode mode : display.getSupportedModes()) {
                    supported.put(modeJson(mode));
                }
                root.put("supportedModes", supported);
            }
        } catch (JSONException ex) {
            Log.w(TAG, "Unable to build display info JSON", ex);
        }
        return root.toString();
    }

    private static JSONObject modeJson(Display.Mode mode) throws JSONException {
        JSONObject json = new JSONObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            json.put("id", mode.getModeId());
            json.put("width", mode.getPhysicalWidth());
            json.put("height", mode.getPhysicalHeight());
            json.put("refreshRate", (double) mode.getRefreshRate());
        }
        return json;
    }

    private interface CloxWebHost {
        WebView webView();
        void onResume();
        void onPause();
        boolean recoverRenderer(WebView deadView, boolean active);
        void destroy();
    }

    private final class DirectWebHost implements CloxWebHost {
        private WebView webView;

        DirectWebHost(WebView webView) {
            this.webView = webView;
        }

        @Override
        public WebView webView() {
            return webView;
        }

        @Override
        public void onResume() {
            WebView.setWebContentsDebuggingEnabled(false);
            if (webView == null) {
                webView = createWebView(MainActivity.this);
                setContentView(webView);
                applyImmersiveMode();
                webView.loadUrl(CLOCK_URL);
            }
            webView.onResume();
            webView.resumeTimers();
        }

        @Override
        public void onPause() {
            if (webView != null) {
                webView.onPause();
                webView.pauseTimers();
            }
        }

        @Override
        public boolean recoverRenderer(WebView deadView, boolean active) {
            if (deadView != webView) {
                return false;
            }
            destroyWebView(webView);
            webView = null;
            if (!active) {
                return true;
            }
            webView = createWebView(MainActivity.this);
            setContentView(webView);
            applyImmersiveMode();
            webView.loadUrl(CLOCK_URL);
            webView.onResume();
            webView.resumeTimers();
            return true;
        }

        @Override
        public void destroy() {
            destroyWebView(webView);
            webView = null;
        }
    }

    private final class VirtualDisplayWebHost implements CloxWebHost, SurfaceHolder.Callback {
        private final Activity activity;
        private final SurfaceView surfaceView;
        private final DisplayModePolicy.ModeChoice choice;
        private VirtualDisplay virtualDisplay;
        private CloxPresentation presentation;
        private WebView webView;
        private boolean usingFallback;

        VirtualDisplayWebHost(
            Activity activity,
            SurfaceView surfaceView,
            DisplayModePolicy.ModeChoice choice
        ) {
            this.activity = activity;
            this.surfaceView = surfaceView;
            this.choice = choice;
            SurfaceHolder holder = surfaceView.getHolder();
            holder.setFormat(PixelFormat.OPAQUE);
            holder.setFixedSize(choice.width, choice.height);
            holder.addCallback(this);
        }

        @Override
        public WebView webView() {
            return webView;
        }

        @Override
        public void surfaceCreated(SurfaceHolder holder) {
            if (activityResumed) {
                startVirtualDisplay(holder.getSurface(), true);
            }
        }

        @Override
        public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
        }

        @Override
        public void surfaceDestroyed(SurfaceHolder holder) {
            releaseVirtualDisplay();
        }

        @Override
        public void onResume() {
            Surface surface = surfaceView.getHolder().getSurface();
            if (webView == null && virtualDisplay == null && surface != null && surface.isValid()) {
                startVirtualDisplay(surface, true);
                return;
            }
            if (webView != null) {
                webView.onResume();
                webView.resumeTimers();
            }
        }

        @Override
        public void onPause() {
            if (webView != null) {
                webView.onPause();
                webView.pauseTimers();
            }
        }

        @Override
        public boolean recoverRenderer(WebView deadView, boolean active) {
            if (deadView != webView) {
                return false;
            }
            Surface surface = surfaceView.getHolder().getSurface();
            releaseVirtualDisplay();
            if (!active || surface == null || !surface.isValid()) {
                return true;
            }
            startVirtualDisplay(surface, true);
            return true;
        }

        @Override
        public void destroy() {
            surfaceView.getHolder().removeCallback(this);
            releaseVirtualDisplay();
            if (webView != null) {
                webView.destroy();
                webView = null;
            }
        }

        private void startVirtualDisplay(Surface surface, boolean active) {
            if (usingFallback || virtualDisplay != null) {
                return;
            }
            try {
                DisplayManager displayManager =
                    (DisplayManager) activity.getSystemService(Context.DISPLAY_SERVICE);
                virtualDisplay = displayManager.createVirtualDisplay(
                    "Clox UHD",
                    choice.width,
                    choice.height,
                    DisplayModePolicy.VIRTUAL_DENSITY_DPI,
                    surface,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
                        | DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION
                );
                if (virtualDisplay == null || virtualDisplay.getDisplay() == null) {
                    throw new IllegalStateException("Virtual display was not created");
                }
                presentation = new CloxPresentation(activity, virtualDisplay.getDisplay());
                presentation.show();
                webView = presentation.webView();
                webView.loadUrl(CLOCK_URL);
                if (active) {
                    webView.onResume();
                    webView.resumeTimers();
                }
            } catch (RuntimeException ex) {
                Log.w(TAG, "Falling back to direct WebView after UHD surface setup failed", ex);
                fallbackToDirectWebView();
            }
        }

        private void fallbackToDirectWebView() {
            usingFallback = true;
            rendererName = "direct-webview-fallback";
            releaseVirtualDisplay();
            surfaceView.getHolder().removeCallback(this);
            WebView fallback = createWebView(activity);
            webView = fallback;
            MainActivity.this.webHost = new DirectWebHost(fallback);
            activity.setContentView(fallback);
            fallback.loadUrl(CLOCK_URL);
            if (activityResumed) {
                fallback.onResume();
                fallback.resumeTimers();
            }
        }

        private void releaseVirtualDisplay() {
            WebView oldWebView = webView;
            if (presentation != null) {
                presentation.dismiss();
                presentation = null;
            }
            if (virtualDisplay != null) {
                virtualDisplay.release();
                virtualDisplay = null;
            }
            if (oldWebView != null) {
                destroyWebView(oldWebView);
                if (webView == oldWebView) {
                    webView = null;
                }
            }
        }
    }

    private final class CloxPresentation extends Presentation {
        private WebView webView;

        CloxPresentation(Context outerContext, Display display) {
            super(outerContext, display);
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
            webView = createWebView(getContext());
            setContentView(webView);
        }

        WebView webView() {
            return webView;
        }

        @Override
        public boolean dispatchKeyEvent(KeyEvent event) {
            if (MainActivity.this.handleRemoteKeyEvent(event)) {
                return true;
            }
            return super.dispatchKeyEvent(event);
        }
    }

    private final class HostBridge {
        @JavascriptInterface
        public String getDisplayInfo() {
            return displayInfoJson();
        }
    }

    private final class CloxWebViewClient extends WebViewClient {
        private final MainActivity activity;

        CloxWebViewClient(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        @TargetApi(Build.VERSION_CODES.O)
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            return activity.recoverFromRendererGone(view, detail);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            return uri == null || !AssetUrlPolicy.isAllowed(uri.toString());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return !AssetUrlPolicy.isAllowed(url);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return responseFor(request.getUrl() == null ? null : request.getUrl().toString());
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return responseFor(url);
        }

        private WebResourceResponse responseFor(String url) {
            if (AssetUrlPolicy.isAllowed(url)) {
                return null;
            }
            if (AssetUrlPolicy.isNetworkScheme(url) || (url != null && url.startsWith("file:"))) {
                return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    new ByteArrayInputStream(new byte[0])
                );
            }
            return null;
        }
    }
}
