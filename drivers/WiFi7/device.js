'use strict';
const Homey = require('homey');
const http = require('node:http');
const net = require('node:net')
const os = require('node:os');
const util = require('../../lib/util');

module.exports = class MyDevice extends Homey.Device {

    /**
     * onInit is called when the device is initialized.
     */
    async onInit() {
        this.log('WiFi device has been initialized');
        this.isDebug = true;
        this.deviceIsDeleted = false;
        this.registerCapabilityListener('target_temperature', async (value) => {
            this.debug("Changed temp", value);
            this.setHeatingSetpoint(value);
        });

        this.registerCapabilityListener('onoff', async (value) => {
            this.debug("Changed On/Off", value);
            if (value) {
                this.setOperatingModeOn()
            } else {
                this.setOperatingModeOff()
            }
        });

        this.setCapabilityValue('measure_power', 0).catch(this.error);
        this.setAvailable();

        //Load settings
        await this.getIpAndMacAddressAndOtherSettings();

        this.refreshStateLoop();
    }

    async getIpAndMacAddressAndOtherSettings() {
        if (this.getStore().address != null) {
            //From arp
            if (!util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
                await this.setSettings({ IPaddress: this.getStore().address, });
            }

            this.IPaddress = this.getStore().address;
        } else {
            this.IPaddress = this.getSettings().IPaddress.trim();
        }

        this.MACaddress = this.getSettings().MACaddress.trim().toUpperCase();
        this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
        this.ReportInterval = this.getSettings().interval;
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

    async refreshStateLoop() {

        if (this.deviceIsDeleted) {
            return; //Abort
        }

        if (this.ipIsValid()) {
            await this.refreshState();
        }
        setTimeout(() => {
           this.refreshStateLoop()
        }, this.ReportInterval * 1000);
    }

    async refreshState() {
        this.debug("refreshState")
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
                    this.setMeasureTemperature(parsedData);
                    this.setOpenWindowDetectionFromThermostat(parsedData);
                    this.setDisableButtonsFromThermostat(parsedData);
                    this.setCapabilityValue('measure_temperature.external', parsedData.externalTemperature).catch(this.error);
                    this.setCapabilityValue('measure_temperature.floor', parsedData.floorTemperature).catch(this.error);
                    this.setCapabilityValue('target_temperature', parsedData.parameters.heatingSetpoint).catch(this.error);
                    let kWh = this.getCapabilityValue('meter_power');
                    kWh = kWh + (parsedData.currentPower * (this.getSettings().interval / 3600)) / 1000;
                    this.setCapabilityValue('meter_power', kWh).catch(this.error);
                    this.setCapabilityValue('measure_power', parsedData.currentPower).catch(this.error);
                    if (!this.MACaddressIsValid && this.MACaddress == "GET") {
                        this.setSettings({ MACaddress: parsedData.network.mac });
                    }
                    this.setAvailable();
                } catch (e) {
                    // Handle error
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
        if (this.MACaddressIsValid) {
            //this.debug("Searching for device via mac address.")
            (async () => {
                try {
                    this.scanNetwork();
                } catch (error) {
                    
                }
            })();
        }
    }

    async scanNetwork() {
        const baseIp = util.getBaseIpAddress(); //'192.168.1.'; Replace with your network's base IP
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;

            if (this.deviceIsDeleted) {
                break; //Device deleted, exit loop
            }

            const isOnline = await util.checkTcpConnection(ip, 80); // Check port 80
            if (isOnline) {
                //this.log(`Device found at: ${ip}`);
                let data = await this.getWiFiThermostatData(ip);
                if (data.IsWiFi7Thermostat && data.Mac === this.MACaddress) {
                    this.IPaddress = ip;
                    this.setSettings({ IPaddress: this.IPaddress, }); //await
                    this.log('WiFi7 Thermostat found by Mac: ' + data.Mac)
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

    setMeasureTemperature(thermostatData) {
        let settingSensorMode = parseInt(this.getSettings().sensorMode);
        this.debug("settingSensorMode: " + settingSensorMode.toString() + " Thermostat sensorValue: " + thermostatData.parameters.sensorMode.toString())
        if (settingSensorMode != thermostatData.parameters.sensorMode) {
            settingSensorMode = thermostatData.parameters.sensorMode;
            //Save changes from thermostat
            this.debug("Sensor mode changed on thermostat");
            this.setSettings({ sensorMode: settingSensorMode.toString() });
        }

        if (settingSensorMode == 0) {
            //0 = Floor sensor(F)
            this.setCapabilityValue('measure_temperature', thermostatData.floorTemperature).catch(this.error);
        } else if (settingSensorMode == 1) {
            //1 = Internal sensor(A) (Default)
            this.setCapabilityValue('measure_temperature', thermostatData.internalTemperature).catch(this.error);
        } else if (settingSensorMode == 2) {
            //2 = Internal sensor & floor sensor limitation(AF)
            this.setCapabilityValue('measure_temperature', (thermostatData.internalTemperature + thermostatData.floorTemperature) / 2).catch(this.error);
        } else if (settingSensorMode == 3) {
            //3 = External sensor(A2)
            this.setCapabilityValue('measure_temperature', thermostatData.externalTemperature).catch(this.error);
        } else if (settingSensorMode == 4) {
            //4 = External sensor & floor sensor limitation(A2F)
            this.setCapabilityValue('measure_temperature', (thermostatData.externalTemperature + thermostatData.floorTemperature) / 2).catch(this.error);
        } else {
            //1 = Internal sensor(A) (Default)
            this.setCapabilityValue('measure_temperature', thermostatData.internalTemperature).catch(this.error);
        }
        //5 = Power regulator mode(PWER)
    }

    setOpenWindowDetectionFromThermostat(thermostatData) {
        let openWindowDetectionSetting = this.getSettings().openWindowDetection;
        this.debug("openWindowDetectionSetting: " + openWindowDetectionSetting.toString() + " Thermostat openWindowDetection: " + thermostatData.parameters.OWD.openWindowDetection.toString())
        if (openWindowDetectionSetting != thermostatData.parameters.OWD.openWindowDetection) {
            //Save changes from thermostat
            this.debug("Open Window Detection changed on thermostat");
            this.setSettings({ openWindowDetection: thermostatData.parameters.OWD.openWindowDetection });
        }
    }

    setDisableButtonsFromThermostat(thermostatData) {
        let disableButtonsSetting = this.getSettings().disableButtons;
        this.debug("disableButtonsSetting: " + disableButtonsSetting.toString() + " Thermostat disableButtons: " + thermostatData.parameters.disableButtons.toString())
        if (disableButtonsSetting != thermostatData.parameters.disableButtons) {
            //Save changes from thermostat
            this.debug("Disable Buttons changed on thermostat");
            this.setSettings({ disableButtons: thermostatData.parameters.disableButtons });
        }
    }

    async setOperatingModeOn() {
        const postData = JSON.stringify({
            'operatingMode': 1,
        });
        await this.setParameters(postData);
    }

    async setSensorMode(mode) {
        const postData = JSON.stringify({
            'sensorMode': parseInt(mode),
        });
        await this.setParameters(postData);
    }

    async setOpenWindowDetection(value) {
        const postData = JSON.stringify({
            'openWindowDetection': value
        });
        this.debug(postData)
        await this.setParameters(postData);
    }

    async setDisableButtons(value) {
        const postData = JSON.stringify({
            'disableButtons': value
        });
        this.debug(postData)
        await this.setParameters(postData);
    }

    async setOperatingModeOff() {
        const postData = JSON.stringify({
            'operatingMode': 0,
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
            this.debug(`STATUS: ${res.statusCode}`);
            this.debug(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                this.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                // Handle end
            });
        });

        req.on('error', (e) => {
            this.log(`problem with request: ${e.message}`);
        });

        req.write(postData);
        req.end();
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.log('My heatit WiFi device has been added');
    }

    async getWiFiThermostatData(ip) {

        this.debug('Check if is WiFi 7 Thermostat. IP ' + ip);

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
                        if (parsedData.model === "Heatit WiFi7") {
                            this.log('IsWiFi7Thermostat true');
                            resolve({ "IsWiFi7Thermostat": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({ "IsWiFi7Thermostat": false });
                        }
                    } catch (e) {
                        resolve({ "IsWiFi7Thermostat": false });
                    }
                });

            }).on('error', (e) => {
                this.log('isWiFiThermostat false');
                resolve({ "IsWiFi7Thermostat": false });
            });
        });
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
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

        this.MACaddress = newSettings.MACaddress.trim().toUpperCase();
        this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);

        if (oldSettings.sensorMode != newSettings.sensorMode) {
            await this.setSensorMode(newSettings.sensorMode);
        }
        if (oldSettings.openWindowDetection != newSettings.openWindowDetection) {
            await this.setOpenWindowDetection(newSettings.openWindowDetection);
        }
        if (oldSettings.disableButtons != newSettings.disableButtons) {
            await this.setDisableButtons(newSettings.disableButtons);
        }
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * @param {string} name The new name
     */
    async onRenamed(name) {
        this.log('My heatit WiFi device was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        this.deviceIsDeleted = true;
        this.log('My heatit WiFi device has been deleted');
    }
};