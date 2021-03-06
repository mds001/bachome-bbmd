import bacnet from 'natezimmer_bacstack';
import {ExampleHomebridgePlatform} from "../platform";

const client = new bacnet({apduTimeout: 6000});

// eslint-disable-next-line @typescript-eslint/ban-types
export function readBACNetValue(platform: ExampleHomebridgePlatform, ipAddress: string, net: number, adr: number,
                                propertyObject:object, propertyId: number){
  return new Promise((resolve, reject) => {
    if (net !== -1 && adr !== -1) {
      const address = {ip: ipAddress, net: net, adr: [adr]};
      platform.log.debug('Reading address', address, propertyObject, propertyId);
      client.readProperty(
        address,
        propertyObject,
        propertyId,
        (error, value) => {
          if (error) {
            platform.log.error('unable to read from BACNet', error);
            return reject(error);
          }
          return resolve(value['values'][0]['value']);
        },
      );
    } else {
      platform.log.debug('Reading address', ipAddress, propertyObject, propertyId);
      client.readProperty(
        ipAddress,
        propertyObject,
        propertyId,
        (error, value) => {
          if (error) {
            platform.log.error('unable to read from BACNet', error);
            return reject(error);
          }
          return resolve(value['values'][0]['value']);
        },
      );
    }
  });
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function writeBACNetValue(platform: ExampleHomebridgePlatform, ipAddress: string, net: number, adr: number,
                                 propertyObject:object, propertyId: number, value:number, valueType:number){
  return new Promise((resolve, reject) => {
    const valueObject = generateValueObjectFromValue(value, valueType);
    if (net !== -1 && adr !== -1) {
      const address = {ip: ipAddress, net: net, adr: [adr]};
      platform.log.debug('Writing address', address, propertyObject, propertyId, ' with ', value, valueType);
      client.writeProperty(
        address,
        propertyObject,
        propertyId,
        valueObject,
        {priority: 8},
        (error, value) => {
          if (error) {
            platform.log.error('unable to write to BACNet', error);
            return reject(error);
          }
          return resolve(value);
        },
      );
    } else {
      platform.log.debug('Writing address', ipAddress, propertyObject, propertyId, ' with ', value, valueType);
      client.writeProperty(
        ipAddress,
        propertyObject,
        propertyId,
        valueObject,
        {priority: 8},
        (error, value) => {
          if (error) {
            platform.log.error('unable to write to BACNet', error);
            return reject(error);
          }
          return resolve(value);
        },
      );
    }
  } )
}

/**
 * Takes the value passed into the function and converts it into a
 * valueObject, which then can be used in other functions to read
 * and write to external BACnet objects
 * @param value Value which will be converted to a valueObject
 */
export function generateValueObjectFromValue(value, valueType:number) {
  const valueObject: unknown[] = [];

  if(-1 !== valueType) {
    valueObject[0] = {value: value, type: valueType};
  } else {
    switch (typeof value) {
      case 'number':
        valueObject[0] = {value: value, type:4}; // real number
        break;

      case 'boolean':
        // Bacnet uses 0 and 1 instead of false and true
        valueObject[0] = {value: value, type:9}; // enumerated
        break;

      case 'string':
        valueObject[0] = {value: value, type:7}; // character string
        break;

      default:
        break;
    }
  }

  return valueObject;
}