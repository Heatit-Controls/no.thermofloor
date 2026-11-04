'use strict';
const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');

module.exports = class MyDevice extends Homey.Device {

    async onInit() {
        this.log('WiFi ICE2 has been initialized');
        this.isDebug = true;
        this.deviceIsDeleted = false;

        this.registerCapabilityListener('onoff', async (value) => {
            this.debug("Changed On/Off", value);
            if (value) {
                await this.setIce2On();
            } else {
                await this.setIce2Off();
            }
        });

        this.setCapabilityValue('measure_power', 0).catch(this.error);
        this.setAvailable();

        //Load settings
        await this.loadSettings();
        await this.syncSnowCapabilities();

        this.refreshStateLoop();
    }

    async loadSettings() {
        if (this.getStore().address != null) {

            if (!util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
                await this.setSettings({
                    IPaddress: this.getStore().address,
                });
            }

            this.IPaddress = this.getStore().address;
        } else {
            this.IPaddress = this.getSettings().IPaddress.trim();
        }
        this.MaxReconnactionTrys = 5;
        this.ReconnactionTry = 1;
        this.MACaddress = this.getSettings().MACaddress.trim().toUpperCase();
        this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
        this.ReportInterval = this.getSettings().interval;
        this.OperatingMode = this.getSettings().operatingMode;
        this.SensorValue = this.getSettings().sensorValue;
        this.GroundSensorCalibration = this.getSettings().groundSensorCalibration;
        this.ExternalSensorCalibration = this.getSettings().externalSensorCalibration;
        this.ActiveDisplayBrightness = this.getSettings().activeDisplayBrightness;
        this.StandbyDisplayBrightness = this.getSettings().standbyDisplayBrightness;
        this.GroundSetpoint = this.getSettings().groundSetpoint;
        this.HeSetpoint = this.getSettings().heSetpoint;
        this.WarmLimitThreshold = this.getSettings().warmLimitThreshold;
        this.ColdLimitThreshold = this.getSettings().coldLimitThreshold;
        this.ActionAfterError = this.getSettings().actionAfterError;
        this.SizeOfLoad = this.getSettings().sizeOfLoad;
        this.AfterRun = this.getSettings().afterrun;
        this.ForceHeat = this.getSettings().forceHeat;
    }

    //Hjemmer capabilities basert på operating mode
    async syncSnowCapabilities() {
        const snowMode = String(this.OperatingMode) === '0';
        for (const capability of ['measure_temperature.ground', 'thermostat_state_humidity']) {
            if (snowMode && !this.hasCapability(capability)) {
                await this.addCapability(capability);
            } else if (!snowMode && this.hasCapability(capability)) {
                await this.removeCapability(capability);
            }
        }
    }

    ipIsValid() {
        if (this.getStore().address != null) {
            return true
        } else if (util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
            return true
        } else {
            this.setUnavailable('Please check that you have entered a valid IP address in advanced settings and that the device is turned on.').catch(this.error);
            return false
        }
    }

    refreshStateLoop() {

        if (this.deviceIsDeleted) {
            return; //Abort
        }

        if (this.ipIsValid()) {
            this.refreshState()
        }
        setTimeout(() => {
            this.refreshStateLoop()
        }, this.ReportInterval * 1000);
    }

    async refreshState() {

        const client = http.get({
            hostname: this.IPaddress,
            port: 80,
            path: '/api/status',
            agent: false,
        }, (res) => {

            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    this.ReconnactionTry = 1;
                    this.setCapabilityValue('measure_temperature', parsedData.roomTemperature).catch(this.error);
                    this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error);
                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;

                    // Leser api/status og viser til Homey UI
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);

                    // Leser eksterne temperaturer fra api/status
                    this.setCapabilityValue('measure_temperature.external', parsedData.externalTemperature).catch(this.error);

                    // Leser state fra api/status
                    this.setCapabilityValue('thermostat_state_IdleHeatAfterrunForceHeat', parsedData.state).catch(this.error);

                    // Leser ground og humidity sensor hvis operating mode er snow
                    if (String(this.OperatingMode) === '0') {
                        if (this.hasCapability('measure_temperature.ground') && typeof parsedData.groundTemperature === 'number') {
                            this.setCapabilityValue('measure_temperature.ground', parsedData.groundTemperature).catch(this.error);
                        }
                        if (this.hasCapability('thermostat_state_humidity') && typeof parsedData.moisture === 'boolean') {
                            this.setCapabilityValue('thermostat_state_humidity', parsedData.moisture).catch(this.error);
                        }
                    }

                    if (!this.MACaddressIsValid && this.MACaddress == "GET") {
                        this.setSettings({ MACaddress: parsedData.network.mac }).catch(this.error);
                    }
                    if (!this.deviceIsDeleted) this.setAvailable().catch(this.error);
                } catch (e) {
                    this.log('Cannot connect to API.')
                    this.setCapabilityValue('measure_power', 0).catch(this.error);
                    this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
                    this.debug('Cannot reach device on local WiFi');
                    this.getWiFiDeviceByMac();
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error);
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.debug('Cannot reach device on local WiFi');
            this.getWiFiDeviceByMac();
        });

    }

    getWiFiDeviceByMac() {
        if (this.deviceIsDeleted) {
            return; //exit 
        }

        if (this.MACaddressIsValid && this.ReconnactionTry <= this.MaxReconnactionTrys) {
            this.log("Try:" + this.ReconnactionTry + ". Searching for WIFi ICE2 by MAC address: " + this.MACaddress);
            (async () => {
                try {
                    this.scanNetwork();
                } catch (error) {

                }
            })();
        }
    }

    async scanNetwork() {
        this.ReconnactionTry++;
        const baseIp = util.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;

            if (this.deviceIsDeleted) {
                break; //Device deleted, exit loop
            }

            const isOnline = await util.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                //this.log(`Device found at: ${ip}`);
                let data = await this.getWiFiIce2Data(ip);
                if (data.IsWiFiIce2 && data.Mac === this.MACaddress) {
                    this.IPaddress = ip;
                    this.setSettings({ IPaddress: this.IPaddress, }); //await
                    this.log('WiFi ICE2 found by Mac: ' + data.Mac);
                    this.ReconnactionTry = 0;
                    break; // Found a device, exit loop
                }
            }
        }
    }

    debug(msg) {
        if (this.isDebug) {
            this.log(msg);
        }
    }

    async setIce2On() {
        const postData = JSON.stringify({
            'turnOnOff': true, //on = true,
        });
        await this.setParameters(postData);
    }

    async setIce2Off() {
        const postData = JSON.stringify({
            'turnOnOff': false, //off = false,
        });
        await this.setParameters(postData);
    }

    async setOperatingMode(value) {
        const postData = JSON.stringify({
            'operatingMode': Number(value), //0: Default Snow, 1: Out 1, 2: Out 2, 3: Roof
        });
        await this.setParameters(postData);
    }

    async setSensorValue(value) {
        const postData = JSON.stringify({
            'sensorValue': Number(value), //0: 6.8kOhm, 1: 10kOhm, 2: 12kOhm, 3: 15kOhm, 4: 22kOhm, 5: 33kOhm, 6: 47kOhm, 7: 100kOhm
        });
        await this.setParameters(postData);
    }

    async setNumericParameter(key, value) {
        const number = Number(value);
        if (value == null || value === '' || !Number.isFinite(number)) {
            throw new Error(`Invalid ${key} value`);
        }
        await this.setParameters(JSON.stringify({ [key]: number }));
    }

    async setParameters(postData) {
        this.debug('setParameters');

        const options = {
            hostname: this.IPaddress,
            port: 80,
            path: '/api/parameters',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 5000,
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                this.debug(`STATUS: ${res.statusCode}`);
                this.debug(`HEADERS: ${JSON.stringify(res.headers)}`);
                res.setEncoding('utf8');
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    this.debug(`BODY: ${body}`);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`Device answered with status ${res.statusCode}`));
                    }
                });
            });

            req.on('timeout', () => req.destroy(new Error('Device did not respond')));
            req.on('error', (e) => {
                this.log(`problem with request: ${e.message}`);
                reject(new Error(`Could not reach device: ${e.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    async onAdded() {
        this.log('My heatit WiFi device has been added');
    }

    async getWiFiIce2Data(ip) {
        this.debug('Check if is WiFi ICE 2. IP ' + ip);
        return new Promise((resolve) => {

            http.get({
                hostname: ip,
                port: 80,
                path: '/api/status',
                agent: false,
            }, (res) => {

                const { statusCode } = res;
                const contentType = res.headers['content-type'];

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.model === "Heatit ICE2") {
                            this.log('IsWiFiIce2 true. IP: ' + ip + " Mac: " + parsedData.network.mac);
                            resolve({ "IsWiFiIce2": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({ "IsWiFiIce2": false });
                        }
                    } catch (e) {
                        resolve({ "IsWiFiIce2": false });
                    }
                });

            }).on('error', (e) => {
                this.log('IsWiFiIce2 false');
                resolve({ "IsWiFiIce2": false });
            });
        });
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }) {
        this.log("My heatit WiFi device settings where changed");

        if (!util.isValidIpAddress(newSettings.IPaddress)) {
            throw new Error('Invalid IP address!')
        }

        this.IPaddress = newSettings.IPaddress;
        this.ReportInterval = newSettings.interval;
        this.SensorValue = newSettings.sensorValue;
        this.GroundSensorCalibration = newSettings.groundSensorCalibration;
        this.ExternalSensorCalibration = newSettings.externalSensorCalibration;
        this.ActiveDisplayBrightness = newSettings.activeDisplayBrightness;
        this.StandbyDisplayBrightness = newSettings.standbyDisplayBrightness;
        this.GroundSetpoint = newSettings.groundSetpoint;
        this.HeSetpoint = newSettings.heSetpoint;
        this.WarmLimitThreshold = newSettings.warmLimitThreshold;
        this.ColdLimitThreshold = newSettings.coldLimitThreshold;
        this.ActionAfterError = newSettings.actionAfterError;
        this.SizeOfLoad = newSettings.sizeOfLoad;
        this.AfterRun = newSettings.afterrun;
        this.ForceHeat = newSettings.forceHeat;
        if (oldSettings.operatingMode != newSettings.operatingMode) {
            await this.setOperatingMode(newSettings.operatingMode);
            this.OperatingMode = newSettings.operatingMode;
            await this.syncSnowCapabilities();
        }

        if (oldSettings.sensorValue != newSettings.sensorValue) {
            await this.setSensorValue(this.SensorValue);
        }

        for (const key of [
            'groundSensorCalibration',
            'externalSensorCalibration',
            'activeDisplayBrightness',
            'standbyDisplayBrightness',
            'heSetpoint',
            'warmLimitThreshold',
            'coldLimitThreshold',
            'actionAfterError',
            'sizeOfLoad',
            'afterrun',
            'forceHeat',
        ]) {
            if (changedKeys.includes(key)) {
                await this.setNumericParameter(key, newSettings[key]);
            }
        }
    }

    async onRenamed(name) {
        this.log('My heatit WiFi device was renamed');
    }

    async onDeleted() {
        this.deviceIsDeleted = true;
        this.log('My heatit WiFi device has been deleted');
    }

};