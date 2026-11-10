import Toybox.Activity;
import Toybox.ActivityRecording;
import Toybox.FitContributor;
import Toybox.Lang;

// Records a cross-trainer workout. Heart rate, time and calories come from the watch itself;
// power and cadence are written with the native FIT field numbers (record 7 and 4), so
// Garmin Connect, Strava and intervals.icu can read them as power and cadence. Distance
// (record 5) and speed (record 6) also use the native fields. The watch applies the FIT
// scale itself, so they are written in m and m/s (writing cm made a 6.7 km workout 674.8 km).
class Recorder {
    private var _session as ActivityRecording.Session? = null;
    private var _power as FitContributor.Field? = null;
    private var _cadence as FitContributor.Field? = null;
    private var _speed as FitContributor.Field? = null;
    private var _distance as FitContributor.Field? = null;
    private var _energy as FitContributor.Field? = null;
    // The bridge counts distance and the console energy since they started; the workout
    // counts from its own start.
    private var _distanceStart as Number? = null;
    private var _energyStart as Number? = null;

    function initialize() {}

    function isRecording() as Boolean {
        return _session != null && _session.isRecording();
    }

    function hasSession() as Boolean {
        return _session != null;
    }

    function start() as Void {
        if (_session == null) {
            var s = ActivityRecording.createSession({
                :name => "Crosstrainer",
                :sport => Activity.SPORT_FITNESS_EQUIPMENT,
                :subSport => Activity.SUB_SPORT_ELLIPTICAL,
            });
            _power = s.createField("power", 0, FitContributor.DATA_TYPE_UINT16, { :mesgType => FitContributor.MESG_TYPE_RECORD, :units => "W", :nativeNum => 7 });
            _cadence = s.createField("cadence", 1, FitContributor.DATA_TYPE_UINT8, { :mesgType => FitContributor.MESG_TYPE_RECORD, :units => "rpm", :nativeNum => 4 });
            _speed = s.createField("speed", 2, FitContributor.DATA_TYPE_FLOAT, { :mesgType => FitContributor.MESG_TYPE_RECORD, :units => "m/s", :nativeNum => 6 });
            _distance = s.createField("distance", 3, FitContributor.DATA_TYPE_FLOAT, { :mesgType => FitContributor.MESG_TYPE_RECORD, :units => "m", :nativeNum => 5 });
            _energy = s.createField("elyx_energy", 4, FitContributor.DATA_TYPE_UINT16, { :mesgType => FitContributor.MESG_TYPE_SESSION, :units => "kJ" });
            _session = s;
        }
        _session.start();
    }

    function stop() as Void {
        if (_session != null) {
            _session.stop();
        }
    }

    function save() as Void {
        if (_session != null) {
            _session.save();
            clear();
        }
    }

    function discard() as Void {
        if (_session != null) {
            _session.discard();
            clear();
        }
    }

    // Called once per packet from the bridge while recording.
    function update(d as Dictionary) as Void {
        if (!isRecording()) {
            return;
        }
        if (_distanceStart == null) {
            _distanceStart = d[:distance] as Number;
            _energyStart = d[:energy] as Number;
        }
        (_power as FitContributor.Field).setData(clamp(d[:power] as Number, 0, 0xffff));
        (_cadence as FitContributor.Field).setData(clamp(d[:rpm] as Number, 0, 0xff));
        (_speed as FitContributor.Field).setData((d[:speed] as Float) / 3.6); // m/s
        (_distance as FitContributor.Field).setData(((d[:distance] as Number) - (_distanceStart as Number)).toFloat()); // m
        (_energy as FitContributor.Field).setData(clamp((d[:energy] as Number) - (_energyStart as Number), 0, 0xffff));
    }

    // Distance in km since the workout started, or null before the first packet.
    function distanceKm(d as Dictionary) as Float? {
        return _distanceStart == null ? null : ((d[:distance] as Number) - (_distanceStart as Number)) / 1000.0;
    }

    private function clear() as Void {
        _session = null;
        _distanceStart = null;
        _energyStart = null;
        _power = null;
        _cadence = null;
        _speed = null;
        _distance = null;
        _energy = null;
    }

    private function clamp(v as Number, lo as Number, hi as Number) as Number {
        return v < lo ? lo : (v > hi ? hi : v);
    }
}
