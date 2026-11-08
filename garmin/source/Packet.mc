import Toybox.Lang;

// Decodes the bridge's StrideCast data packet. Keep in step with encodeStrideCastData in
// bridge/cycling-power.js (18 bytes, little-endian).
module Packet {
    function decode(b as ByteArray) as Dictionary? {
        if (b.size() < 18 || b[0] != 1) {
            return null;
        }
        return {
            :power => num(b, Lang.NUMBER_FORMAT_SINT16, 1),
            :rpm => b[3],
            :speed => num(b, Lang.NUMBER_FORMAT_UINT16, 4) / 100.0, // km/h
            :distance => num(b, Lang.NUMBER_FORMAT_UINT32, 6), // m
            :energy => num(b, Lang.NUMBER_FORMAT_UINT16, 10), // kJ
            :elapsed => num(b, Lang.NUMBER_FORMAT_UINT16, 12), // console time, s
            :consoleHr => b[14],
            :consoleConnected => (b[15] & 1) == 1,
            :targetPower => num(b, Lang.NUMBER_FORMAT_UINT16, 16),
        };
    }

    function num(b as ByteArray, format as NumberFormat, offset as Number) as Number {
        return b.decodeNumber(format, { :offset => offset, :endianness => Lang.ENDIAN_LITTLE }) as Number;
    }
}
