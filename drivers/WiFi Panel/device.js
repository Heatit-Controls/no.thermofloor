'use strict';
const Homey = require('homey');
const http = require('node:http');

module.exports = class MyDevice extends Homey.Device {

    async onInit() {

        this.log('Device has been initialized');
        this.registerCapabilityListener('target_temperature', async (value) => {
            this.debug("Changed temp", value);
            this.setHeatingSetpoint(value);
        });

        this.registerCapabilityListener('onoff', async (value) => {
            this.debug("Changed On/Off", value);
            if (value) {
                this.setPanelModeOn();
            } else {
                this.setPanelModeOff();
            }
        });

        this.setCapabilityValue('measure_power', 0).catch(this.error);
        this.setAvailable();

        //Load settings
        this.IPaddress = await this.getIpAddressAndSetSetting();
        this.ReportInterval = this.getSettings().interval;

        this.refreshStateLoop();
      
    }

    async getIpAddressAndSetSetting() {
        if (this.getStore().address != null) {

            if (!this.isValidIpAddress(this.getSettings().IPaddress.trim())) {
                await this.setSettings({
                    IPaddress: this.getStore().address,
                });
            }

            return this.getStore().address;
        } else {
            return this.getSettings().IPaddress.trim();
        }
    }

    ipIsValid() {
        if (this.getStore().address != null) {
            return true
        } else if (this.isValidIpAddress(this.getSettings().IPaddress.trim())) {
            return true
        } else {
            this.setUnavailable('Please check that you have entered a valid IP address in advanced settings and that the device is turned on.').catch(this.error);
            return false
        }
    }

    isValidIpAddress(ip) {
        const ipv4Pattern =
            /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Pattern =
            /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
    }

    refreshStateLoop() {
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
                    this.setCapabilityValue('measure_temperature', parsedData.roomTemperature).catch(this.error);
                    this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error);
                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);
                    this.setAvailable();
                } catch (e) {
                }
            });

        }).on('error', (e) => {
            this.setCapabilityValue('measure_power', 0).catch(this.error);
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
            this.debug('Cannot reach device on local WiFi');
        });

    }

    debug(msg) {
        //return //Off
        this.log(msg)
    }

    async setPanelModeOn() {
        const postData = JSON.stringify({
            'panelMode': 1,
        });
        await this.setParameters(postData);
    }

    async setPanelModeOff() {
        const postData = JSON.stringify({
            'panelMode': 0,
        });
        await this.setParameters(postData);
    }

    async setHeatingSetpoint(value) {
        const postData = JSON.stringify({
            'heatingSetpoint': value,
        });
        await this.setParameters(postData);
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
        };

        const req = http.request(options, (res) => {
            this.debug(`STATUS: ${res.statusCode}`);
            this.debug(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                this.debug(`BODY: ${chunk}`);
            });
            res.on('end', () => {
            });
        });

        req.on('error', (e) => {
            this.log(`problem with request: ${e.message}`);
        });

        req.write(postData);
        req.end();
    }

    async onAdded() {
        this.log('My heatit WiFi device has been added');
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }) {
        this.log("My heatit WiFi device settings where changed");
        this.IPaddress = newSettings.IPaddress;
        this.ReportInterval = newSettings.interval;
    }

    async onRenamed(name) {
        this.log('My heatit WiFi device was renamed');
    }

    async onDeleted() {
        this.log('My heatit WiFi device has been deleted');
    }

};