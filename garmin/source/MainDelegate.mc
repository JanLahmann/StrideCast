import Toybox.Lang;
import Toybox.WatchUi;

// START starts the workout; START again pauses it and offers Resume, Save and Discard.
// BACK leaves the app only when nothing is being recorded.
class MainDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onSelect() as Boolean {
        var r = app().recorder;
        if (r.isRecording()) {
            r.stop();
            var menu = new WatchUi.Menu2({ :title => "Workout" });
            menu.addItem(new WatchUi.MenuItem("Resume", null, :resume, null));
            menu.addItem(new WatchUi.MenuItem("Save", null, :save, null));
            menu.addItem(new WatchUi.MenuItem("Discard", null, :discard, null));
            WatchUi.pushView(menu, new StopMenuDelegate(), WatchUi.SLIDE_UP);
        } else {
            r.start();
        }
        WatchUi.requestUpdate();
        return true;
    }

    function onBack() as Boolean {
        return app().recorder.hasSession(); // true keeps the app open
    }
}

class StopMenuDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var r = app().recorder;
        var id = item.getId();
        if (id == :resume) {
            r.start();
        } else if (id == :save) {
            r.save();
        } else if (id == :discard) {
            r.discard();
        }
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }

    function onBack() as Void {
        app().recorder.start(); // back from the menu resumes
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}
