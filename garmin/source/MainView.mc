import Toybox.Activity;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// One screen: power big, cadence, heart rate, time and speed below, distance at the bottom.
class MainView extends WatchUi.View {
    function initialize() {
        View.initialize();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var a = app();
        var d = a.bridge.current();
        var info = Activity.getActivityInfo();
        var hr = info != null ? info.currentHeartRate : null;
        var timer = info != null && info.timerTime != null ? (info.timerTime as Number) / 1000 : 0;

        // Big digits, readable without glasses while training: number fonts for the values,
        // small labels under them.
        var state = a.recorder.isRecording() ? "REC" : (a.recorder.hasSession() ? "PAUSED" : "START to record");
        var stateColor = a.recorder.isRecording() ? Graphics.COLOR_RED : Graphics.COLOR_LT_GRAY;
        text(dc, w / 2, h * 0.09, Graphics.FONT_XTINY, state, stateColor);

        text(dc, w / 2, h * 0.28, Graphics.FONT_NUMBER_THAI_HOT, d != null ? (d[:power] as Number).toString() : "--", 0xF5A524);
        text(dc, w * 0.80, h * 0.36, Graphics.FONT_XTINY, "W", Graphics.COLOR_LT_GRAY);

        value(dc, w * 0.30, h * 0.50, Graphics.FONT_NUMBER_MEDIUM, d != null ? (d[:rpm] as Number).toString() : "--", "rpm", 0x38BDF8);
        value(dc, w * 0.70, h * 0.50, Graphics.FONT_NUMBER_MEDIUM, hr != null ? hr.toString() : "--", "bpm", 0xF2506E);
        value(dc, w * 0.30, h * 0.71, Graphics.FONT_NUMBER_MILD, formatTime(timer), "time", Graphics.COLOR_WHITE);
        value(dc, w * 0.70, h * 0.71, Graphics.FONT_NUMBER_MILD, d != null ? (d[:speed] as Float).format("%.1f") : "--", "km/h", Graphics.COLOR_WHITE);

        // Bottom line: the distance while values come in, else the connection state.
        var km = d != null ? a.recorder.distanceKm(d) : null;
        if (d != null) {
            text(dc, w / 2, h * 0.90, Graphics.FONT_SMALL, km != null ? km.format("%.2f") + " km" : "", Graphics.COLOR_GREEN);
        } else {
            text(dc, w / 2, h * 0.91, Graphics.FONT_XTINY, a.bridge.status, Graphics.COLOR_YELLOW);
        }
    }

    // A value in a number font with its label underneath.
    // Number fonts carry empty space above and below the digits, so the label sits at about a
    // third of the font height below the middle.
    private function value(dc as Graphics.Dc, x as Numeric, y as Numeric, font as Graphics.FontType, s as String, label as String, color as Number) as Void {
        text(dc, x, y, font, s, color);
        text(dc, x, y + dc.getFontHeight(font) * 0.36, Graphics.FONT_XTINY, label, Graphics.COLOR_LT_GRAY);
    }

    private function text(dc as Graphics.Dc, x as Numeric, y as Numeric, font as Graphics.FontType, s as String, color as Number) as Void {
        textAt(dc, x, y, font, s, color, Graphics.TEXT_JUSTIFY_CENTER);
    }

    private function textAt(dc as Graphics.Dc, x as Numeric, y as Numeric, font as Graphics.FontType, s as String, color as Number, justify as Number) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, font, s, justify | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function formatTime(s as Number) as String {
        var h = s / 3600;
        var m = (s % 3600) / 60;
        var sec = s % 60;
        return h > 0 ? h + ":" + m.format("%02d") + ":" + sec.format("%02d") : m + ":" + sec.format("%02d");
    }
}
