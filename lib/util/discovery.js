'use strict';

const http = require('node:http');
const util = require('./index');

/**
 * Discovers WiFi thermostats on the local network.
 * @param {Object} options
 * @param {string} options.driverName - Name of the driver (e.g., 'WiFi6', 'WiFi7')
 * @param {Function} options.isModelMatch - Callback to verify if the parsed data matches the model
 * @param {Function} options.log - Logging function
 * @returns {Promise<Array>} List of discovered devices
 */
async function discoverThermostats({ driverName, isModelMatch, log }) {
    const baseIp = util.getBaseIpAddress();
    const range = Array.from({ length: 254 }, (_, i) => i + 1);

    const scanPromises = range.map(async (i) => {
        const ip = baseIp + i;
        try {
            const isOnline = await util.checkTcpConnection(ip, 80, 2000);
            if (isOnline) {
                const data = await getThermostatData(ip, isModelMatch, log);
                if (data.matched) {
                    return {
                        Ip: ip,
                        Mac: data.mac,
                        Name: data.name,
                    };
                }
            }
        } catch (e) {
            // Ignore connection errors
        }
        return null;
    });

    const results = await Promise.all(scanPromises);
    return results.filter(device => device !== null);
}

/**
 * Fetches status data from a potential thermostat and verifies model.
 */
async function getThermostatData(ip, isModelMatch, log) {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: ip,
            port: 80,
            path: '/api/status',
            agent: false,
            timeout: 2000,
        }, (res) => {
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    if (isModelMatch(parsedData)) {
                        // Support both lower-case 'network' and upper-case 'Network'
                        const network = parsedData.network || parsedData.Network;
                        resolve({
                            matched: true,
                            mac: network ? network.mac : null,
                            name: parsedData.name,
                        });
                    } else {
                        resolve({ matched: false });
                    }
                } catch (e) {
                    resolve({ matched: false });
                }
            });
        });

        req.on('error', () => {
            resolve({ matched: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ matched: false });
        });
    });
}

module.exports = {
    discoverThermostats,
};
