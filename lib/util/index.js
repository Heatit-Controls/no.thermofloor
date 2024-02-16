/**
 * Calculate a duration value for SWITCH_MULTILEVEL and SWITCH_BINARY from an input value in milliseconds. Below 127
 * the value is in seconds, above the value is in minutes. Hence, above 127 some rounding might occur. If a value larger
 * than 254 is entered it will be maxed at 254 (longest duration possible).
 * @param {number} duration - Dim duration in milliseconds
 * @returns {number} Range 0 - 254 (short to long)
 */
function calculateTemperature(buf) {
  if (buf.length === 6) {
    const [command_class, type, value] = [0, 2, 4].map(idx => buf.readUInt16BE(idx));
    // console.log(buf, buf.length, command_class, type, value);
    if (buf.length === 6 && command_class === 12549 && type === 290) {
      return value / 10;
    }
    if (buf.length === 6 && command_class === 12549 && type === 322) {
      return value / 100;
    }
  }
  return null;
}

/**
 * Utility class with several color and range conversion methods.
 * @class Util
 */
module.exports = {
	calculateTemperature,
};
