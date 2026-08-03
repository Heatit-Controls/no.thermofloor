'use strict';

const Homey = require('homey');
const http = require('node:http');
const util = require('../../lib/util');
const WebSocket = require('ws');

module.exports = class MyDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('WiFi Plug has been initialized');
      this.isDebug = false;
      this.deviceIsDeleted = false;
      this.Power = 0;
      this.LastPowerReport = Date.now();
      this.LastPong = Date.now();
      this.ReconnactionTry = 1;
      this.PowerReportChangeMoreThenPercent = 5;

      /**
       * MaxReconnactionTrys. If you unplug the device from the wall outlet, the WebSocket will trigger the close event 
       * after approximately 16 minutes (960 seconds). The heartbeat function will then attempt to reconnect every minute, 
       * repeating the attempt for the number of times specified in this variable.
       * */
      this.MaxReconnactionTrys = 100; 
      

      this.registerCapabilityListener('onoff', async (value) => {
          this.debug("Changed On/Off", value);
          if (value) {
              this.WsSendCommandOn();
          } else {
              this.WsSendCommandOff();
          }
      });

      this.setCapabilityValue('measure_power', this.Power).catch(this.error);
      this.PlugIsOnline();

      await this.loadSettings();
      await this.initWebSocket();
      this.startHeartbeatLoop(); // Keep WebSocket connection alive
    }

    async loadSettings() {
        if (this.getStore().address != null) {
            await this.setSettings({ IPaddress: this.getStore().address, });
            this.IPaddress = this.getStore().address;
        } else {
            this.IPaddress = this.getSettings().IPaddress.trim();
        }

        this.MACaddress = this.getSettings().MACaddress.trim().toUpperCase();
        this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
        this.IPaddressIsValid = this.ipIsValid();
    }

    async initWebSocket() {

        if (!this.IPaddressIsValid) {
            return; //Exit
        }

        this.ws = new WebSocket('ws://' + this.IPaddress + ":80/ws");

        this.ws.on('open', () => {
            this.debug('Connected to the WebSocket...');
            this.PlugIsOnline();
            this.GetPlugStatusAndSetMac(); //From local API
        });

        this.ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data);
                this.recivedDataFromWebSocket(parsed);
            } catch (err) {
                this.error('Error parsing JSON data:', err);
            }
        });

        this.ws.on('close', () => {
            if (!this.deviceIsDeleted) {
                this.debug('WebSocket connection closed. Reconnecting...');
                this.PlugIsOffline(); // Show as offline
                this.reconnectWebSocketByMac();
            }
        });

        this.ws.on('error', (err) => {
            this.error('WebSocket error:', err);
        });
    }

    closeWebSocket() {
        if (this.ws) {
            this.ws.close();
        }
    }

    startHeartbeatLoop() {

        if (this.deviceIsDeleted) {
            return; //exit 
        }

        if (this.ws === null || (this.ws && this.ws.readyState === this.ws.CLOSED)) {
            this.reconnectWebSocketByMac();
        }

        this.SendPing();

        let previousReportReceivedInSec = (Date.now() - this.LastPong) / 1000;
        this.debug("Heartbeat " + previousReportReceivedInSec.toString() + " Sec Available: " + this.PlugIsAvailable().toString())
        if (this.PlugIsAvailable() && previousReportReceivedInSec >= 65) {
            this.PlugIsOffline();
        }

        setTimeout(() => {
            this.startHeartbeatLoop()
        }, 60 * 1000);
       
    }

    recivedDataFromWebSocket(js) {
        this.debug('Received data: ' + JSON.stringify(js))
        if (js.type === "state" && js.data !== null) {
            if (js.data.state === "ON" || js.data.state === "OFF") {
                
                const isOn = js.data.state === 'ON';
                // Only call Homey API if state changes to prevent system event loops
                if (this.getCapabilityValue('onoff') !== isOn) {
                    this.setCapabilityValue('onoff', isOn).catch(err => this.error('Error updating onoff capability:', err));
                }

                if (!isOn) {
                    this.Power = 0;
                    this.setCapabilityValue('measure_power', this.Power).catch(this.error);
                }
            }
            else if (js.data.current_power !== undefined) {
                let Sec = (Date.now() - this.LastPowerReport) / 1000;
                let kWhAdded = (this.Power * Sec) / 3600000; //Last power reported
                let kWh = this.getCapabilityValue('meter_power');
                this.setCapabilityValue('meter_power', kWh + kWhAdded).catch(this.error);
                if (this.percentChange(this.Power, js.data.current_power) >= this.PowerReportChangeMoreThenPercent) {
                    this.setCapabilityValue('measure_power', js.data.current_power).catch(this.error);
                }
                this.Power = js.data.current_power;
                this.LastPowerReport = Date.now();
            }
        } else if (js.type === "pong") {
            this.PlugIsOnline();
            this.LastPong = Date.now();
        }
    }


    SendPing() {
        let data = JSON.stringify({
            'type' : 'ping',
            'id' : 3,
        });
        this.sendMessage(data);
    }

    SendCommand(cmd) {
        let data = JSON.stringify({
            "type" : "command",
            "id" : 2,
            "data" : {
                "parameter" : "state",
                "value" : cmd //ON or OFF
            }
        });

        this.sendMessage(data);
    }

    WsSendCommandOn() {
        this.SendCommand("ON"); 
    }

    WsSendCommandOff() {
        this.SendCommand("OFF");
    }

    sendMessage(JsonPayload) {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JsonPayload);
        } else {
            this.PlugIsOffline();
        }
    }

    ipIsValid() {
        if (this.getStore().address != null) {
            return true;
        } else if (util.isValidIpAddress(this.getSettings().IPaddress.trim())) {
            return true;
        } else {
            this.setUnavailable('Please check that you have entered a valid IP address in advanced settings and that the device is turned on.').catch(this.error);
            return false;
        }
    }

  

    GetPlugStatusAndSetMac() {

        http.get({
            hostname: this.IPaddress,
            port: 80,
            path: '/api/status',
            agent: false,
        }, (res) => {

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    this.setCapabilityValue('onoff', parsedData.parameters.onOff).catch(this.error);
                    this.Power = parsedData.currentPower;
                    this.setCapabilityValue('measure_power', this.Power).catch(this.error);
                    if (!this.MACaddressIsValid && this.MACaddress == "GET") {
                        this.MACaddress = parsedData.network.mac;
                        this.setSettings({ MACaddress: this.MACaddress }).catch(this.error);
                        this.MACaddressIsValid = true;
                        this.reconnectWebSocketByMac();
                    }
                    this.PlugIsOnline();
                } catch (e) {
                    this.log('Cannot connect to API.')
                    this.PlugIsOffline();
                }
            });

        }).on('error', (e) => {
            this.PlugIsOffline();
        });

    }

    PlugIsOffline() {
        this.Power = 0;
        this.setCapabilityValue('measure_power', this.Power).catch(this.error);
        if (this.PlugIsAvailable()) {
            this.setUnavailable('Cannot reach device on local WiFi').catch(this.error);
        }
    }

    PlugIsOnline() {
        if (!this.PlugIsAvailable() && !this.deviceIsDeleted) {
            this.setAvailable().catch(this.error);
        }
    }

    PlugIsAvailable() {
        return this.getAvailable();
    }

    reconnectWebSocketByMac() {
        if (this.deviceIsDeleted) {
            return; //exit 
        }
        this.debug("Reconnect WebSocket By Mac");

        if (this.MACaddressIsValid) {
            this.scanNetworkAndReconnectWebSocektByMac();
        } else if (this.IPaddressIsValid) {
            this.GetPlugStatusAndSetMac(); //From local API
        }
    }

    scanNetworkAndReconnectWebSocektByMac() {
        if (this.ReconnactionTry <= this.MaxReconnactionTrys) {
            this.debug("Try:" + this.ReconnactionTry + ". Searching for WiFi Wall Plug by MAC address: " + this.MACaddress);
            (async () => {
                try {
                    this.scanNetworkAndReconnectWebSocektByMacAsync();
                } catch (error) {

                }
            })();
        }
    }

    async scanNetworkAndReconnectWebSocektByMacAsync() {
        this.ReconnactionTry++;

        const baseIp = util.getBaseIpAddress(); //'192.168.1.'
        const scanPromises = [];
        for (let i = 1; i <= 254; i++) {
            const ip = baseIp + i;
            scanPromises.push(util.scanIp(ip));
        }

        const results = await Promise.all(scanPromises);

        //Filter out and view online devices
        const onlineDevices = results.filter(res => res.status === 'open');

        for (const device of onlineDevices) {
            if (this.deviceIsDeleted) {
                break; //Device deleted, exit loop
            }
            let data = await this.getWiFiPlugData(device.ip);
            if (data.IsWiFiPlug && data.Mac === this.MACaddress) {
                this.debug('WiFi Plug found by Mac: ' + data.Mac);
                this.IPaddress = device.ip;
                this.setSettings({ IPaddress: this.IPaddress, }); 
                this.ReconnactionTry = 1;
                await this.initWebSocket();
                break; // Found device, exit loop
            }
        }
    }

    async getWiFiPlugData(ip) {
        this.debug('Check if is WiFi Plug. IP ' + ip);
        return new Promise((resolve) => {

            http.get({
                hostname: ip,
                port: 80,
                path: '/api/status',
                agent: false,
            }, (res) => {

                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.model !== null && parsedData.model === "WALL PLUG") {
                            this.debug('IsWiFiPlug true. IP: ' + ip + " Mac: " + parsedData.network.mac);
                            resolve({ "IsWiFiPlug": true, "Mac": parsedData.network.mac });
                        } else {
                            resolve({ "IsWiFiPlug": false });
                        }
                    } catch (e) {
                        resolve({ "IsWiFiPlug": false });
                    }
                });

            }).on('error', (e) => {
                this.debug('IsWiFiPlug false');
                resolve({ "IsWiFiPlug": false });
            });
        });
    }

    debug(msg) {
        if (this.isDebug) {
            this.log(msg);
        }
    }

    percentChange(OriginalNumber, NewNumber){
        if (OriginalNumber === 0 || NewNumber === 0) {
            return 100;
        }
        else {
            return Math.abs(((OriginalNumber - NewNumber) / OriginalNumber) * 100);
        }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
      this.log('WiFi Wall Plug has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
      this.log("My heatit WiFi Plug device settings where changed");

      if (!util.isValidIpAddress(newSettings.IPaddress)) {
          throw new Error('Invalid IP address!')
      }

      this.IPaddress = newSettings.IPaddress;
      this.MACaddress = newSettings.MACaddress.trim().toUpperCase();
      this.MACaddressIsValid = util.isValidMACAddress(this.MACaddress);
      this.IPaddressIsValid = util.isValidIpAddress(this.IPaddress);

      if (this.ws && this.ws.readyState === this.ws.OPEN) {
        this.closeWebSocket(); //Close and reconnect by mac address
      } else {
        this.reconnectWebSocketByMac();
      }
      
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('WiFi Wall Plug was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.deviceIsDeleted = true;
    this.closeWebSocket();
    this.log('WiFi Wall Plug has been deleted');
  }

};
