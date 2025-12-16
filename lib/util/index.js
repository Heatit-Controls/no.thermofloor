'use strict';
const os = require('node:os');
const net = require('node:net');

function getBaseIpAddress() {
    const networkInterfaces = os.networkInterfaces();
    let localIp = '192.168.1.1';

    for (const devName in networkInterfaces) {
        const iface = networkInterfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                localIp = alias.address;
                break; // Found a suitable IPv4 address, exit inner loop
            }
        }
        if (localIp !== '192.168.1.1') {
            break; // Found a suitable IPv4 address, exit outer loop
        }
    }

    const octets = localIp.split('.');

    if (octets.length === 4) {
        return octets[0] + '.' + octets[1] + '.' + octets[2] + '.';
    } else {
        return '192.168.1.';
    }


}


//Function to scan for online devices on port 80
async function checkTcpConnection(hostname, port = 80, timeout = 50) {
    return new Promise((resolve) => {
        const socket = net.createConnection(port, hostname);
        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.end();
            resolve(true); // Device is likely online
        });

        function handleError() {
            socket.destroy();
            resolve(false); // Device is offline or port is closed
        }
        socket.on('timeout', handleError);
        socket.on('error', handleError);
    });
}

function isValidIpAddress(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

function isValidMACAddress(macAddress) {
    const mac = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/i;
    return mac.test(macAddress);
}

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
    getBaseIpAddress,
    checkTcpConnection,
    isValidIpAddress,
    isValidMACAddress
};
