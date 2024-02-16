# Heatit Z-wave App
This app adds support for the Z-wave devices by [Heatit controls](http://www.heatit.com).  
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://raw.githubusercontent.com/TedTolboom/no.ThermoFloor/master/assets/images/small.png">
</a>  

## Links:
[Heatit app at Athom apps](https://apps.athom.com/app/no.thermofloor)                      
[Heatit Github repository](https://github.com/TedTolboom/no.ThermoFloor)             

## Devices supported:
### Heatit Z-Wave thermostat (TF 021)
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/master/drivers/TF_Thermostat/assets/icon.svg" width="25%" height="25%">
</a>  

The Heatit Z-Wave thermostat is an electronic thermostat for flush mounting in a standard wall box for regulating electric floor heating. The thermostat has a built-in Z-Wave chip that can be connected to Home Automation systems like Homey.  

The following triggers are supported:

* Thermostat mode has changed   
* Thermostat mode has changed to   
* The temperature has changed   
* The target temperature has changed   
* Thermostat turned on / off  

The following conditions are supported:
* Thermostat is on / off   

The following action cards are supported:

* Set the temperature (of current thermostat mode)   
* Set the thermostat mode   
* Set the setpoint of a thermostat mode

### Heatit Z-TRM2(fx) (TF 033 & TF 056)
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/beta/drivers/Z-TRM2fx/assets/icon.svg" width="25%" height="25%">
</a>  

The Heatit Z-TRM2 Z-Wave thermostat is an electronic thermostat for flush mounting in a standard wall box for regulating electric floor heating. The thermostat has a built-in Z-Wave chip that can be connected to Home Automation systems like Homey.  

The following triggers are supported:

* Thermostat mode has changed   
* Thermostat mode has changed to   
* The temperature has changed   
* The target temperature has changed   
* Thermostat turned on / off  

The following conditions are supported:
* Thermostat is on / off   

The following action cards are supported:

* Set the temperature (of current thermostat mode)   
* Set the thermostat mode   
* Set the setpoint of a thermostat mode      

### Heatit Z-Push button-2  
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/master/drivers/Z-push-button-2/assets/icon.svg" width="25%" height="25%">
</a>
The Heatit Z-Push Button 2 can control 1 association group with up to 5 products or 4 scenarios through Homey.

The following triggers are supported:  
* Button Pressed 1x    
* Button held down     
* Button released    
* Any button pressed (including tokens)   

In addition, by adding the NodeID in the corresponding association groups, the Z-Push Button 2 can directly control Z-wave switches / dimmers.

### Heatit Z-Push button-4  
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/master/drivers/Z-push-button-4/assets/icon.svg" width="25%" height="25%">
</a>
The Heatit Z-Push Button 4 can control 1 association group with up to 5 products or 4 scenarios through Homey.

The following triggers are supported:  
* Button Pressed 1x    
* Button held down     
* Button released    
* Any button pressed (including tokens)   

In addition, by adding the NodeID in the corresponding association groups, the Z-Push Button 4 can directly control Z-wave switches / dimmers.

### Heatit Z-Push button-8
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/master/drivers/Z-push-button-8/assets/icon.svg" width="25%" height="25%">
</a>

The Heatit Z-Push Button 8 can control up to 4 separate association groups (onoff and dim) with up to 20 products or up to 16 scenes through Homey.

The following triggers are supported:  
* Button Pressed 1x     
* Button held down     
* Button released    
* Any button pressed (including tokens)   

In addition, by adding the NodeID in the corresponding association groups, the Z-Push Button 8 can directly control Z-wave switches / dimmers.

### Heatit Z-Water
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/beta/drivers/Z-Water/assets/icon.svg" width="25%" height="25%">
</a>

The Heatit Z-Water is a DIN-rail regulator for controlling hydronic heating.
* All 10 relays can be controlled independently

### Heatit Z-DIN-616
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/beta/drivers/Z-DIN-616/assets/icon.svg" width="25%" height="25%">
</a>

The Heatit Z-DIN 616 is a 6 x 16A potential free relays for DIN rail mounting.
* The 6 independent relay switches of the Heatit Z-DIN 616 can freely be controlled from the Z-Wave network and be used for many different purposes
* The 6 digital inputs can be connected to dry contacts, e.g. limit switches, door/window contacts, or push-buttons.

### Heatit Z-relay
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/beta/drivers/Z-Relay/assets/icon.svg" width="25%" height="25%">
</a>

The Heatit Z-Relay multipurpose relay module can be used for many different applications.
* The relay has three inputs: analog or digital. You can use both analog and digital inputs, or a combination.
* Heatit Z-Relay is a multipurpose product and can be used for the following applications: Boiler control / Leakage control / Temperature control / Outdoor applications

### Heatit Z-dim
<a href="https://github.com/TedTolboom/no.ThermoFloor">
  <img src="https://rawgit.com/TedTolboom/no.ThermoFloor/beta/drivers/Z-Dim/assets/icon.svg" width="25%" height="25%">
</a>
Z-Wave rotary dimmer for different light sources. The LED dimmer dims at low load without the light flickering. Dimmer LED from 1-200VA, 230V halogen and incandescent bulbs, dimmable LED drivers and electronic transformers. Not affected by additional starting currents. Need L + N conductor connected.

The dimmer has end-turn function. This allows you to turn on the light and dimming with one dimmer, and then turn off the light with another dimmer. Convenient for example in stairs and corridors.

The dimmer fits into standard Elko, Schneider Exxact and Gira System 55 frame systems.

### Heatit Z-dim2
Heatit Z-Dim2 is a Z-Wave rotary dimmer for many different types of light fixtures. The Heatit Z-Dim2 works on most low loads without causing flickering. The dimmer is equipped with an external switch option. This allows you to dim and turn on/off the load from an external switch. Heatit Z-Dim2 is very well suited for LED, and fits into System 55 frames.

When connecting low loads it is recommended to use a bypass.

The dimmer fits into standard Elko, Schneider Exxact and Gira System 55 frame systems.

## Supported Languages:
* English   
* Dutch

## Feedback:
Any requests please post them in the [Heatit app topic on the Homey community Forum](https://community.athom.com/t/166) or contact me on [Slack](https://athomcommunity.slack.com/team/tedtolboom)    
If possible, please report issues at the [issues section on Github](https://github.com/TedTolboom/no.ThermoFloor/issues) otherwise in the above mentioned topic.     

## Changelog:
3.2.0
* Added support for: Z-Dim2 module.

3.0.0
* Update the SDK to v3
* Add support for: ZM Single Relay 16A, Z-Repeater, Z-Push Wall Controller

2.6.0
* Add support for the Z-TEMP2 Thermostat device  
* Update Thermostat device driver library   

2.5.1
* Fix issue with Z-Dim driver crashing upon init   
* Update Z-TRM3 association group information   
* Update Homey meshdriver to v1.3.24     

2.5.0
* Add support for the Z-TRM3 Thermostat device  
* Add Meter Reset maintenance action for Z-TRM2fx, Z-Dim and Z-relay             
* Update Homey meshdriver to v1.3.23  

2.4.2
* Add support for the Z-Push button 4 device  
* Update app for new app store          
* Update Homey meshdriver to v1.3.21  

2.4.1 (BETA), Homey SW ≥2.4.0
* Finalize app and drivers for 'Energy' (Homey 3.0.0)   
* Update Homey meshdriver to v1.3.14  

v2.4.0 (BETA), Homey SW ≥2.4.0
* Add support for Heatit Z-Dim rotary dimmer      
* Update Homey meshdriver to v1.3.9      

v2.3.0 (BETA), Homey SW ≥2.4.0
* Fix S2 security handshake issues with Z-TRM2fx, Z-water and Z-Relay that result in Z-wave network stability issues by forcing non-secure inclusion.
   * All users experiencing stability issues with the Z-TRM2fx, Z-Water and Z-Relay devices are advised to upgrade to v2.3.0 and remove and re-include their devices based on the v2.3.0 version   
* Removed Homey 1.x.x mobile interface (obsolete)   
* Add insights logging for the Thermostat state capability   
* Prepared app and drivers for 'Energy' (Homey 3.0.0)
* Update Homey meshdriver to v1.3.6      

v2.2.1
* Fix issue not being able to include the Heatit Z-push button 2 and Z-push button 8 devices   
* Z-TRM2(fx) changed default temperature- and meter-reporting interval from 60 to 900 seconds to prevent Z-wave network lock-up    

v2.2.0
* Add support for the Heatit Z-relay device   
* Add support for the Heatit Z-DIN-616 device
* Update branding of the app    

v2.1.2 (BETA)
* Fix temperature reporting issues for Z-wave thermostat (FW 1.92), Z-TRM2(fx) and Z-Water *(Homey SW 2.0.5+)*   
  *Note*: Please follow the steps mentioned below to fix the temperature reporting (only working as of Homey Software 2.0.5):
  * For already paired devices:   
      1. Go to advanced settings, and replace (add if not existing) Homey's ID `1` with `1.1` in the following association groups used for the temperature reporting:   
        * Z-wave thermostat (FW 1.92): Group 3, 4 and 5   
        * Z-TRM2(fx): Group 2 and 3   
        * Z-Water: Group 11, 12, 13 and 14    
      2. For the thermostats, change in the Device specific settings (Sensor settings group), the 'Displayed temperature' to the sensor connected (default: floor sensor)   
      3. Save settings   
  * Alternative option is to remove and re-include the device based on the v2.1.2 version of the app   
* Add temperature changed flow cards for Z-wave thermostat (FW 1.92), Z-TRM2(fx) and Z-Water
* Update to meshdriver v1.2.32   

v2.1.1 (BETA)
* Add support for the Z-Water regulator   
* Update to meshdriver v1.2.30   
* *Note*: due to an S2 issue within the Homey Z-wave core, the measured temperatures are not reported for the Z-wave thermostat (FW 1.92) and Z-TRM2(fx) thermostats as well as the Z-Water regulator. When this will be resolved, it is likely that the thermostat will need to be re-included      

v2.1.0 (BETA)
* Add support for the Z-wave thermostat (FW 1.92)    
* Add support for the Z-TRM2(fx) thermostat
* Add all remaining settings for the thermostats
* Add Power Regulator Mode action card for the Z-wave thermostat (use at own risk)       
* *Note*: due to an issue within the Homey Z-wave core, the measured temperatures are not reported for the Z-wave thermostat (FW 1.92) and the Z-TRM2(fx) thermostats. When this will be resolved, it is likely that the thermostat will need to be re-included      

v2.0.3
* Fix battery icon not visible on mobile interface for 1.5.13 (re-inclusion required to fix)    
* Remove not supported "Key Pressed 2 times" option from "A scene has been activated trigger card"    
* Add explicit not to settings to wake-up the Z-push before saving changes to the settings / association groups    

v2.0.2   
* Add support for the Z-Push button 2 and Z-Push button 8 devices    
* Minor (cosmetical) modifications to make the app Homey SW v2.0.0 compatible      

v2.0.1   
* Add thermostat onoff state trigger- and condition cards   

v2.0.0   
* SDK2 rewrite of the ThermoFloor / Heatit app  
* SDK2 rewrite of the Multireg / Heatit Z-Wave thermostat device driver   
* Update to meshdriver v1.2.28

v1.0.0   
* App store ready update   
* Added 2 additional action cards ('change themostat mode' and 'change setpoint of specific thermostat mode')      

v0.2.0    
* Code clean-up (MasterData array) and further bug fixes  
* Update of response time for MODE change from mobile card; setpoint will be updated based on stored values   
* Added en / nl locales   
* Added structure for 2 additional action cards ('change mode' and 'change setpoint of specific mode') (WIP)   

v0.1.2    
* Update of setpoint parsing and updating the corresponding settings    
* Update of response time for MODE change; setpoint will be updated based on stored values   

v0.1.0    
* Major update based on test results, setpoint optimization    
* Added functionality cooling mode, state icon in mobile card   
* removed settings that are read-only or not used    
