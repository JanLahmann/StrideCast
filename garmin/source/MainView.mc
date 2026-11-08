import Toybox.Activity;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// One screen: power big, cadence, speed, distance, time, heart rate, and the state.
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

        var state = a.recorder.isRecording() ? "REC" : (a.recorder.hasSession() ? "PAUSED" : "START to record");
        var stateColor = a.recorder.isRecording() ? Graphics.COLOR_RED : Graphics.COLOR_LT_GRAY;
        text(dc, w / 2, h * 0.10, Graphics.FONT_XTINY, state, stateColor);

        text(dc, w / 2, h * 0.27, Graphics.FONT_NUMBER_HOT, d != null ? (d[:power] as Number).toString() : "--", 0xF5A524);
        text(dc, w / 2, h * 0.40, Graphics.FONT_XTINY, "W", Graphics.COLOR_LT_GRAY);

        var km = d != null ? a.recorder.distanceKm(d) : null;
        text(dc, w * 0.30, h * 0.52, Graphics.FONT_MEDIUM, d != null ? (d[:rpm] as Number).toString() + " rpm" : "--", 0x38BDF8);
        text(dc, w * 0.70, h * 0.52, Graphics.FONT_MEDIUM, d != null ? (d[:speed] as Float).format("%.1f") + " km/h" : "--", Graphics.COLOR_WHITE);
        text(dc, w * 0.30, h * 0.66, Graphics.FONT_MEDIUM, formatTime(timer), Graphics.COLOR_WHITE);
        text(dc, w * 0.70, h * 0.66, Graphics.FONT_MEDIUM, hr != null ? hr.toString() + " bpm" : "-- bpm", 0xF2506E);
        text(dc, w / 2, h * 0.79, Graphics.FONT_SMALL, km != null ? km.format("%.2f") + " km" : "", Graphics.COLOR_WHITE);

        text(dc, w / 2, h * 0.90, Graphics.FONT_XTINY, a.bridge.status, d != null ? Graphics.COLOR_GREEN : Graphics.COLOR_YELLOW);
    }

    private function text(dc as Graphics.Dc, x as Numeric, y as Numeric, font as Graphics.FontType, s as String, color as Number) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, font, s, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function formatTime(s as Number) as String {
        var h = s / 3600;
        var m = (s % 3600) / 60;
        var sec = s % 60;
        return h > 0 ? h + ":" + m.format("%02d") + ":" + sec.format("%02d") : m + ":" + sec.format("%02d");
    }
}
