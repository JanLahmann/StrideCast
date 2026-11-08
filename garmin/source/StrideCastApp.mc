import Toybox.Application;
import Toybox.Lang;
import Toybox.Sensor;
import Toybox.Timer;
import Toybox.WatchUi;

class StrideCastApp extends Application.AppBase {
    var bridge as Bridge;
    var recorder as Recorder;
    private var _timer as Timer.Timer;

    function initialize() {
        AppBase.initialize();
        bridge = new Bridge();
        recorder = new Recorder();
        _timer = new Timer.Timer();
    }

    function onStart(state as Dictionary?) as Void {
        Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE]);
        bridge.start();
        _timer.start(method(:tick), 1000, true);
    }

    function onStop(state as Dictionary?) as Void {
        _timer.stop();
        bridge.stop();
    }

    function tick() as Void {
        var d = bridge.current();
        if (d != null) {
            recorder.update(d);
        }
        WatchUi.requestUpdate();
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        return [new MainView(), new MainDelegate()];
    }
}

function app() as StrideCastApp {
    return Application.getApp() as StrideCastApp;
}
