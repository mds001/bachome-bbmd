/* eslint-disable @typescript-eslint/ban-ts-comment */
import {PlatformAccessory, Service} from 'homebridge';

import {ExampleHomebridgePlatform} from '../platform';
import {objectStringParser} from '../bacnet/parser';
import {readBACNetValue, writeBACNetValue} from '../bacnet/bacnet';
import {CurrentHeatingCoolingState, TargetHeatingCoolingState} from 'hap-nodejs/dist/lib/definitions/CharacteristicDefinitions';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class BachomeThermostatAccessory {
  private service: Service;

  private internalStates = {
    currentHeatingCoolingState: 0,
    targetHeatingCoolingState: 0,
    currentTemperature: 0,
    targetTemperature: 0,
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
    this.mapStates.set(this.accessory.context.device.targetHeatOnlyStateValue, TargetHeatingCoolingState.HEAT);
    this.mapStates.set(this.accessory.context.device.targetCoolOnlyStateValue, TargetHeatingCoolingState.COOL);
    this.mapStates.set(this.accessory.context.device.targetAutoStateValue, TargetHeatingCoolingState.AUTO);
    this.mapStates.set(this.accessory.context.device.targetOffStateValue, TargetHeatingCoolingState.OFF);

    this.reverseMapStates = new Map();
    this.reverseMapStates.set(TargetHeatingCoolingState.HEAT, this.accessory.context.device.targetHeatOnlyStateValue);
    this.reverseMapStates.set(TargetHeatingCoolingState.COOL, this.accessory.context.device.targetCoolOnlyStateValue);
    this.reverseMapStates.set(TargetHeatingCoolingState.AUTO, this.accessory.context.device.targetAutoStateValue);
    this.reverseMapStates.set(TargetHeatingCoolingState.OFF, this.accessory.context.device.targetOffStateValue);
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
    this.platform.log.info('GET CurrentHeatingCoolingState');

    let valueHeat = 0;
    let valueCool = 0;

    // @ts-ignore
    if( -1 != this.stateObjects.currentHeatingState.type) {
      valueHeat = Number(await readBACNetValue(this.ipAddress, this.net, this.adr, this.stateObjects.currentHeatingState, 85));
    };

    // @ts-ignore
    if( -1 != this.stateObjects.currentCoolingState.type) {
      valueCool = Number(await readBACNetValue(this.ipAddress, this.net, this.adr, this.stateObjects.currentCoolingState, 85));
    };

    this.platform.log.info(`Read currentHeatingCoolingState: Heat: ${String(valueHeat)}, Cool: ${String(valueCool)}`);

    if (Number(valueHeat) > 0) {
      this.internalStates.currentHeatingCoolingState = CurrentHeatingCoolingState.HEAT;
    } else if (Number(valueCool) > 0) {
      this.internalStates.currentHeatingCoolingState = CurrentHeatingCoolingState.COOL;
    } else {
      this.internalStates.currentHeatingCoolingState = CurrentHeatingCoolingState.OFF;
    }

    this.platform.log.info(`currentHeatingCoolingState: ${String(this.internalStates.currentHeatingCoolingState)}`);
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState, this.internalStates.currentHeatingCoolingState,
    );
  }

  /**
   * Reads the target heating / cooling state from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetHeatingCoolingState() {
    this.platform.log.info('GET TargetHeatingCoolingState');
    const value = await readBACNetValue(this.ipAddress, this.net, this.adr, this.stateObjects.targetHeatingCoolingState, 85);
    this.internalStates.targetHeatingCoolingState = this.mapStates.get(Number(value));
    this.platform.log.info(`Read targetHeatingCoolingState: ${String(value)}`);
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHeatingCoolingState, this.internalStates.targetHeatingCoolingState,
    );
  }

  /**
   * Reads the current temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateCurrentTemperature() {
    this.platform.log.info('GET CurrentTemperature');
    const value = await readBACNetValue(this.ipAddress, this.net, this.adr, this.stateObjects.currentTemperature, 85);
    this.platform.log.info(`Read currentTemperature: ${String(value)}`);
    this.internalStates.currentTemperature = Number(value);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.internalStates.currentTemperature);
  }

  /**
   * Reads the target temperature from the
   * configured BACnet object and updates the internal state.
   * @param callback Callback from homebridge
   */
  async updateTargetTemperature() {
    this.platform.log.info('GET TargetTemperature');
    const value = await readBACNetValue(this.ipAddress, this.net, this.adr, this.stateObjects.targetTemperature, 85);
    this.platform.log.info(`Read targetTemperature: ${String(value)}`);
    this.internalStates.targetTemperature = Number(value);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, this.internalStates.targetTemperature);
  }
  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetHeatingCoolingState(valueHK, callback) {
    this.platform.log.info('SET TargetHeatingCoolingState');
    const valueBN = this.reverseMapStates.get(valueHK);
    callback(null);
    await writeBACNetValue(this.ipAddress, this.net, this.adr,this.stateObjects.targetHeatingCoolingState, 85, valueBN, 2);
    this.platform.log.info(`Written targetHeatingCoolingState: ${String(valueBN)}`);
    this.internalStates.targetHeatingCoolingState = valueHK;
  }

  /**
   * Writes the value passed from homebridge to the
   * configured BACnet object and updates the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  async setTargetTemperature(value, callback) {
    this.platform.log.info('SET TargetTemperature');
    callback(null);
    await writeBACNetValue(this.ipAddress, this.net, this.adr,this.stateObjects.targetTemperature, 85, value);
    this.platform.log.info(`Written targetTemperature: ${String(value)}`);
    this.internalStates.targetTemperature = value;
  }

  /**
   * Reads the display units from the
   * internal state.
   * @param callback Callback from homebridge
   */
  getTemperatureDisplayUnits(callback) {
    this.platform.log.debug('GET TemperatureDisplayUnits');
    callback(null, this.internalStates.temperatureDisplayUnits);
  }

  /**
   * Writes the value passed from homebridge to the
   * internal state.
   * @param value Value passed from homebridge
   * @param callback Callback from homebridge
   */
  setTemperatureDisplayUnits(value, callback) {
    this.platform.log.debug('SET TemperatureDisplayUnits');
    this.internalStates.temperatureDisplayUnits = value;
    callback(null);
  }
}
