export interface BacnetObject {
    typeText: string,
    type: number;
    instance: number;
}

/**
 * Parses shorthand notations of BACnet objects and instances and returns
 * a BacnetObject
 * @param objectString Shorthand BACnet object notation string e.g. 'BV:6'
 */
export function objectStringParser(objectString:string): BacnetObject {
  const parsedObject: BacnetObject = {typeText: '', type: -1, instance: 0 };

  if(0 == objectString.length)
    return(parsedObject);

  const stringSplit = objectString.split(':');

  if(2 != stringSplit.length)
    return(parsedObject);

  parsedObject.typeText = stringSplit[0];
  parsedObject.instance = Number(stringSplit[1]);
  
  switch (stringSplit[0]) {
    case 'AI':
      parsedObject.type = 0; //AnalogInput
      break;
      
    case 'AO':
      parsedObject.type = 1; //AnalogOutput
      break;

    case 'AV':
      parsedObject.type = 2; //AnalogValue
      break;

    case 'BI':
      parsedObject.type = 3; //BinaryInput
      break;
      
    case 'BO':
      parsedObject.type = 4; //BinaryOutput
      break;

    case 'BV':
      parsedObject.type = 5; //BinaryValue
      break;

    case 'MSV':
      parsedObject.type = 19; //MultiStateValue
      break;
  
    default:
      break;
  }

  return parsedObject;
}