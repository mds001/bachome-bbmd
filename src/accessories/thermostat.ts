/* eslint-disable @typescript-eslint/ban-ts-comment */
import {PlatformAccessory, Service} from 'homebridge';
import {ExampleHomebridgePlatform} from '../platform';
import {objectStringParser} from '../bacnet/parser';
import {readBACNetValue, writeBACNetValue} from '../bacnet/bacnet';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class BachomeThermostatAccessory {
  private service: Service;

  private internalStates = {
    currentHeatingState: -1,
    currentCoolingState: -1,
    currentHeatingCoolingState: -1,
    targetHeatingCoolingState: -1,
    currentTemperature: -1,
    targetTemperature: -1,
    temperatureDisplayUnits: 0,
  }

  private stateObjects = {
    currentHeatingState: {},
    currentCoolingState: {},
    targetHeatingCoolingState: {},
    currentTemperature: {},
    targetTemperature: {},
  }

  private readonly ipAddress = '';
  private readonly net = -1;
  private readonly adr = -1;

  private mapStates;
  private reverseMapStates;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.serial);

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // Read the service name form the accessory context (config file passed via platform)
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.stateObjects['currentHeatingState'] = objectStringParser(accessory.context.device.currentHeatingState);
    this.stateObjects['currentCoolingState'] = objectStringParser(accessory.context.device.currentCoolingState);
    this.stateObjects['targetHeatingCoolingState'] = objectStringParser(accessory.context.device.targetHeatingCoolingState);
    this.stateObjects['currentTemperature'] = objectStringParser(accessory.context.device.currentTemperature);
    this.stateObjects['targetTemperature'] = objectStringParser(accessory.context.device.targetTemperature);

    this.ipAddress = accessory.context.device.ipAddress;
    this.net = accessory.context.device.net;
    this.adr = accessory.context.device.adr;

    // register handlers for mandatory characteristics
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('set', this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .on('set', this.setTemperatureDisplayUnits.bind(this))
      .on('get', this.getTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.accessory.context.device.minTemp,
        maxValue: this.accessory.context.device.maxTemp,
        minStep: this.accessory.context.device.maxStep
      });

    this.Poll(this.updateCurrentHeatingCoolingState.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.Poll(this.updateTargetHeatingCoolingState.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.Poll(this.updateCurrentTemperature.bind(this), this.accessory.context.device.pollFrequency * 1000);
    this.Poll(this.updateTargetTemperature.bind(this), this.accessory.context.device.pollFrequency * 1000);

    this.mapStates = new Map();
    this.mapStates.set(this.accessory.context.device.targetHeatOnlyStateValue, this.platform.Characteristic.TargetHeatingCoolingState.HEAT);
    this.mapStates.set(this.accessory.context.device.targetCoolOnlyStateValue, this.platform.Characteristic.TargetHeatingCoolingState.COOL);
    this.mapStates.set(this.accessory.context.device.targetAutoStateValue, this.platform.Characteristic.TargetHeatingCoolingState.AUTO);
    this.mapStates.set(this.accessory.context.device.targetOffStateValue, this.platform.Characteristic.TargetHeatingCoolingState.OFF);

    this.reverseMapStates = new Map();
    this.reverseMapStates.set(this.platform.Characteristic.TargetHeatingCoolingState.HEAT, this.accessory.context.device.targetHeatOnlyStateValue);
    this.reverseMapStates.set(this.platform.Characteristic.TargetHeatingCoolingState.COOL, this.accessory.context.device.targetCoolOnlyStateValue);
    this.reverseMapStates.set(this.platform.Characteristic.TargetHeatingCoolingState.AUTO, this.accessory.context.device.targetAutoStateValue);
    this.reverseMapStates.set(this.platform.Characteristic.TargetHeatingCoolingState.OFF, this.accessory.context.device.targetOffStateValue);
  }

  /**
   * sets up polling using the input function
   */
  Poll(fn, frequency) {
    async function run() {
      await fn();
      setTimeout(run, frequency);
    }
    run();
  }

  /**
   * Reads the current heating / cooling state from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateCurrentHeatingCoolingState() {
    this.platform.log.debug('GET CurrentHeatingCoolingState', this.accessory.context.device.name);
    let valueHeat = 0;
    let valueCool = 0;

    try {
      // @ts-ignore
      if (-1 !== this.stateObjects.currentHeatingState.type) {
        valueHeat = Number(await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.currentHeatingState, 85));
      }
      // @ts-ignore
      if (-1 !== this.stateObjects.currentCoolingState.type) {
        valueCool = Number(await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.currentCoolingState, 85));
      }
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to read BN currentHeatingCoolingState', err.message);
    }

    if(this.internalStates.currentHeatingState != valueHeat || this.internalStates.currentCoolingState != valueCool) {
      this.platform.log.info(this.accessory.context.device.name,
          `currentHeatingCoolingState: Heat: ${String(valueHeat)}, Cool: ${String(valueCool)}`);
      this.internalStates.currentHeatingState = valueHeat;
      this.internalStates.currentCoolingState = valueCool;

      if (Number(valueHeat) > 0) {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      } else if (Number(valueCool) > 0) {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
      } else {
        this.internalStates.currentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      }

      this.platform.log.debug(this.accessory.context.device.name, `currentHeatingCoolingState: ${String(this.internalStates.currentHeatingCoolingState)}`);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.internalStates.currentHeatingCoolingState);
    }
  }

  /**
   * Reads the target heating / cooling state from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetHeatingCoolingState() {
    this.platform.log.debug('GET TargetHeatingCoolingState', this.accessory.context.device.name);
    let valueHK = this.platform.Characteristic.TargetHeatingCoolingState.OFF;

    try {
      const valueBN = await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.targetHeatingCoolingState, 85);
      valueHK = this.mapStates.get(Number(valueBN));
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to read BN targetHeatingCoolingState', err.message);
    }

    if(valueHK != this.internalStates.targetHeatingCoolingState) {
      this.platform.log.info(this.accessory.context.device.name, `targetHeatingCoolingState: ${String(valueHK)}`);
      this.internalStates.targetHeatingCoolingState = valueHK;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, this.internalStates.targetHeatingCoolingState);
    }
  }

  /**
   * Reads the current temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateCurrentTemperature() {
    this.platform.log.debug(this.accessory.context.device.name, 'GET CurrentTemperature');
    let value = this.accessory.context.device.minTemp;
    try {
      value = Number(await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.currentTemperature, 85));
      value = Math.min(this.accessory.context.device.maxTemp,Math.max(this.accessory.context.device.minTemp,value));
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to read BN currentTemperature', err.message);
    }

    if(this.internalStates.currentTemperature != value) {
      this.platform.log.info(this.accessory.context.device.name, `currentTemperature: ${String(value)}`);
      this.internalStates.currentTemperature = value;
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.internalStates.currentTemperature);
    }
  }

  /**
   * Reads the target temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetTemperature() {
    this.platform.log.debug(this.accessory.context.device.name, 'GET TargetTemperature');
    let value = this.accessory.context.device.minTemp;

    try {
      value = Number(await readBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.targetTemperature, 85));
      value = Math.min(this.accessory.context.device.maxTemp, Math.max(this.accessory.context.device.minTemp, value));
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to read BN targetTemperature', err.message);
    }

    if(value != this.internalStates.targetTemperature) {
      this.platform.log.info(this.accessory.context.device.name, `targetTemperature: ${String(value)}`);
      this.internalStates.targetTemperature = value;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, this.internalStates.targetTemperature);
    }
  }
  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetHeatingCoolingState(valueHK, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TargetHeatingCoolingState');
    try {
      const valueBN = this.reverseMapStates.get(valueHK);
      callback(null);
      await writeBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.targetHeatingCoolingState, 85, valueBN, 2);
      this.platform.log.info(this.accessory.context.device.name, `targetHeatingCoolingState: ${String(valueBN)}`);
      this.internalStates.targetHeatingCoolingState = valueHK;
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to write HK targetHeatingCoolingState', err.message);
    }
  }

  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetTemperature(value, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TargetTemperature');
    try {
      callback(null);
      await writeBACNetValue(this.platform, this.ipAddress, this.net, this.adr, this.stateObjects.targetTemperature, 85, value);
      this.platform.log.info(this.accessory.context.device.name, `targetTemperature: ${String(value)}`);
      this.internalStates.targetTemperature = value;
    }
    catch(err){
      this.platform.log.error(this.accessory.context.device.name, 'unable to write HK targetTemperature', err.message);
    }
  }

  /**
   * Reads the display units from the
   * internal state.
   * @param callback Callback from homebridge
   */
  getTemperatureDisplayUnits(callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'GET TemperatureDisplayUnits');
    callback(null, this.internalStates.temperatureDisplayUnits);
  }

  /**
   * Writes the value passed from homebridge to the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  setTemperatureDisplayUnits(value, callback) {
    this.platform.log.debug(this.accessory.context.device.name, 'SET TemperatureDisplayUnits');
    this.internalStates.temperatureDisplayUnits = value;
    callback(null);
  }
}
