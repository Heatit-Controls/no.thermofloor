'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');


class ZHAN2Device extends ZwaveDevice {
  async onNodeInit() {
    // **Enables debugging**
    // this.enableDebug();
   
    // **Enables printing nodes
    // this.printNode();


    this.defaultCapabilityList = [
      'meter_power',
      "meter_power.imported",
      "meter_power.exported",
      'measure_power',
      'measure_voltage',
      'measure_current',
      'measure_temperature'
    ]


    this.registerCapabilityListener('button.reset_meter', async () => {
      let commandClassMeter = null;
      commandClassMeter = this.getCommandClass('METER');
      if(commandClassMeter && commandClassMeter.hasOwnProperty('METER_RESET')){
        const result = await commandClassMeter.METER_RESET({});
        if(result !== 'TRANSMIT_COMPLETE_OK') throw result;
      }
      else{
        throw new Error('Reset meter not supported');
      }
    });


    // **** 1 ****
    /* this.registerCapability('accumulated_production', 'METER', {
      getOpts: {
        getOnStart: true,
        getParser: rawData => {
          console.log('Raw Data: ', rawData);
          const parsedValue = convertRawToKVAh(rawData);
          return parsedValue;
        }
      },
      reportParser: report => {
        if(report &&
          report.hasOwnProperty('Meter Type') &&
          report['Meter Type'] === 'Electric kVAh' &&
          report.hasOwnProperty('Meter Value')) {
            const parsedValue = convertRawToKVAh(report['Meter Value']);
            this.setCapabilityValue('accumulated_production', parsedValue).catch(this.error);
            return parsedValue;
          }
        return null;
      }
    }); */

    // **** 2 ****
    /* this.registerReportListener('METER', 'METER_REPORT', (report) => {
      if (report && report.hasOwnProperty('Properties1') &&
      report.Properties1.hasOwnProperty('Scale') &&
      report.Properties1.Scale === 'kVAh') {
        let vaValue = report['Meter Value (Parsed)'];
        if (vaValue !== undefined) {
          this.setCapabilityValue('accumulated_production', vaValue).catch(this.error);
        }
      }
    }); */ 


    // **** 3 ****
    /* this.registerReportListener('METER', 'METER_REPORT', (report) => {
      console.log('Received METER_GET report:', report);
      if (report && report.hasOwnProperty('Properties1') && report.Properties1.hasOwnProperty('Scale') 
          && report.Properties1.Scale === VOLT_AMPERE_SCALE) { // Replace VOLT_AMPERE_SCALE with the correct scale
        let vaValue = report['Meter Value (Parsed)'];
        if (vaValue !== undefined) {
          this.setCapabilityValue('accumulated_production', vaValue).catch(this.error);
        }
      }
    }); */
    
    
    // **** 4 ****
    /*
    this.registerReportListener('accumulated_production', 'METER_REPORT', (report) => {
      // Log the entire report for debugging
      console.log('Received METER_GET report:', report);
    
      if (report && report.hasOwnProperty('Properties1') && report.Properties1.hasOwnProperty('Scale')) {
        console.log(`Report Scale: ${report.Properties1.Scale}`);
        // Check if the scale is the one we're interested in
        if (report.Properties1.Scale === 1) { // Confirm this is the correct scale for Volt-Ampere
          let vaValue = report['Meter Value (Parsed)'];
          console.log(`Parsed VA Value: ${vaValue}`);
          if (vaValue !== undefined) {
            this.setCapabilityValue('measure_power.va', vaValue).catch((error) => {
              console.error('Error setting measure_power.va capability:', error);
            });
          } else {
            console.log('VA Value is undefined');
          }
        } else {
          console.log('Report Scale is not for Volt-Ampere. Skipping...');
        }
      } else {
        console.log('Report does not have the expected properties');
      }
    }); */


    this.defaultCapabilityList.forEach(capabilityId => {
      if(capabilityId.includes('measure_temperature')){
        if(this.hasCapability(capabilityId)){
          this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
            getOpts: {getOnStart: true},
            report: 'SENSOR_MULTILEVEL_REPORT',
            reportParser: report => {
              if(report && report.hasOwnProperty('Sensor Value (Parsed)')){
                if(report['Sensor Value (Parsed)'] === -999.9) return null;

                if(report.Level.Scale === 0){
                  const temperatureValue = report['Sensor Value (Parsed)'];
                  this.log('Received Z-HAN2 temperature value:', temperatureValue);
                  this.setCapabilityValue(capabilityId, temperatureValue).catch(this.error);
                  return temperatureValue;
                }
              }
              return null;
            }
          });
        }
      }
      else{
        if(this.hasCapability(capabilityId)){
          this.registerCapability(capabilityId, 'METER');
        }
      }
    });


    this.log('Z-HAN2 has been initialized');

    this.setAvailable().catch(this.error);
  }
}

module.exports = ZHAN2Device;