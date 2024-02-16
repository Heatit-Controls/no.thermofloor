'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

let oneMinuteTimer = null;


class Z_Water2Device extends ZwaveDevice {
  async onNodeInit() {

    const initialSettings = this.getSettings();

    let temperatureInterval = initialSettings.temp_report_interval || 827;
   
    this.capabilityMultyChannelNodeIdObj = {
      "measure_temperature.input1": 10,
      "measure_temperature.input2": 11
    }

    // enable debugging
    // this.enableDebug();

    // print the node's info to the console
    // this.printNode();

    this.registerCapability('onoff', 'SWITCH_BINARY', {
      getOpts: {
        getOnStart: true,
      },
    });
    await this.registerTemperature();

    // await this.onSettings(); // -------------

    oneMinuteTimer = this.homey.setInterval(() => {
      this.registerTemperature();
    }, temperatureInterval * 1000);


    this.setAvailable().catch(this.error);
  }


  /* async onSettings(oldSettings, newSettings, changedKeys){
    const oldTemperatureInterval = oldSettings.temp_report_interval || 827;
    const updatedTemperatureInterval = newSettings.temp_report_interval || 827;


    if(changedKeys.includes('temp_report_interval')){
      if(updatedTemperatureInterval !== oldTemperatureInterval){
        console.log("*********** " + updatedTemperatureInterval + "***************");
      }
    }
  } */

  async registerTemperature() {
    Object.keys(this.capabilityMultyChannelNodeIdObj).forEach(capabilityId => {
      if(capabilityId.includes('measure_temperature')) {
        const subName = capabilityId.split('.')[1];

        if(this.hasCapability(capabilityId) && subName === undefined) {
          this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
            getOpts: {getOnStart: true},
            multiChannelNodeId: this.capabilityMultyChannelNodeIdObj[capabilityId]
          });
          this.log("+++ subName of " + capabilityId + " is undefined +++");
        }
        else if(this.hasCapability(capabilityId) && subName !== undefined) {
          this.log("+++ subName of " + capabilityId + " is defined and else if passed +++");
          this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
            getOpts: {getOnStart: true},
            report: 'SENSOR_MULTILEVEL_REPORT',
            reportParser: report => {
              if(report &&
                report.hasOwnProperty('Sensor Type') &&
                report['Sensor Type'] === 'Temperature (version 1)' &&
                report.hasOwnProperty('Sensor Value (Parsed)') &&
                report.hasOwnProperty('Level') &&
                report.Level.hasOwnProperty('Scale')){
                  if (report['Sensor Value (Parsed)'] === -999.9) return null;
                  this.log("----- Report from " + capabilityId + " -----");
                  this.log('+++++++ registerTemperature:', report);
                  if (report.Level.Scale === 0) {
                      if (capabilityId === 'measure_temperature.input1') {
                        this.setCapabilityValue('measure_temperature.input1', report['Sensor Value (Parsed)']).catch(this.error);
                      }
                      else if(capabilityId === 'measure_temperature.input2'){
                        this.setCapabilityValue('measure_temperature.input2', report['Sensor Value (Parsed)']).catch(this.error);
                      }
                      return report['Sensor Value (Parsed)'];
                  }
              }
              return null;
            },
            multiChannelNodeId: this.capabilityMultyChannelNodeIdObj[capabilityId]
          });
        }
      }
    });
  }
}

module.exports = Z_Water2Device;