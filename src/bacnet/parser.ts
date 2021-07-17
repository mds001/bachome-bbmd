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
  const parsedObject: BacnetObject = {
    typeText: '',
    type: -1,
    instance: 0,
  };

  if(0 == objectString.length)
    return(parsedObject);

  // Parses a string looking like BV:16
  const stringSplit = objectString.split(':');

  parsedObject.typeText = stringSplit[0];
  
  switch (stringSplit[0]) {
    case 'AI':
      parsedObject.type = 0;
      break;
      
    case 'AO':
      parsedObject.type = 1;
      break;

    case 'AV':
      parsedObject.type = 2;
      break;

    case 'BI':
      parsedObject.type = 3;
      break;
      
    case 'BO':
      parsedObject.type = 4;
      break;

    case 'BV':
      parsedObject.type = 5;
      break;

    case 'MSV':
      parsedObject.type = 19;
      break;
  
    default:
      break;
  }

  parsedObject.instance = Number(stringSplit[1]);

  return parsedObject;
}