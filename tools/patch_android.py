#!/usr/bin/env python3
"""Run after `npx cap add android`. Makes the generated project landscape + immersive + cutout-aware, and installs the game icon.
Manifest/Java edits are required for a good experience but not for building, so problems here print a WARNING instead of failing the build."""
import json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
A = os.path.join(ROOT, 'android')
cfg = json.load(open(os.path.join(ROOT, 'capacitor.config.json')))
app_id = cfg['appId']
def warn(m): print('WARNING:', m)
if not os.path.isdir(A): sys.exit('android/ does not exist - run `npx cap add android` first')

# 1. manifest: landscape, keep state on rotation
mf = os.path.join(A, 'app/src/main/AndroidManifest.xml')
try:
    s = open(mf).read()
    if 'screenOrientation' not in s:
        s = s.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"', 1)
    open(mf, 'w').write(s); print('manifest: sensorLandscape set')
except Exception as e: warn('manifest patch failed: %r' % e)

# 2. MainActivity: immersive fullscreen, display cutout, keep screen on
try:
    d = os.path.join(A, 'app/src/main/java', *app_id.split('.'))
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'MainActivity.java'), 'w').write('''package %s;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }
}
''' % app_id)
    print('MainActivity.java written for', app_id)
except Exception as e: warn('MainActivity patch failed: %r' % e)

# 3. launcher icons from icons/icon-512.png (needs Pillow; skipped quietly if missing)
try:
    from PIL import Image
    src = Image.open(os.path.join(ROOT, 'icons/icon-512.png')).convert('RGBA')
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for dpi, px in sizes.items():
        dd = os.path.join(A, 'app/src/main/res/mipmap-' + dpi)
        if not os.path.isdir(dd): continue
        for name in ('ic_launcher.png', 'ic_launcher_round.png'): src.resize((px, px), Image.NEAREST).save(os.path.join(dd, name))
        fg = Image.new('RGBA', (px * 108 // 48, px * 108 // 48), (7, 5, 13, 255)); ic = src.resize((px * 72 // 48, px * 72 // 48), Image.NEAREST); o = (fg.width - ic.width) // 2; fg.paste(ic, (o, o)); fg.save(os.path.join(dd, 'ic_launcher_foreground.png'))
    print('launcher icons installed')
except ImportError: warn('Pillow not installed - default launcher icon kept')
except Exception as e: warn('icon install failed: %r' % e)
