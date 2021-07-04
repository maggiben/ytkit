import sanitizeName = require('sanitize-filename');

/**
 * Converts seconds into human readable time hh:mm:ss
 *
 * @param {number} seconds
 * @return {string}
 */
export const toHumanTime = (seconds: number): string => {
  const h: number = Math.floor(seconds / 3600);
  let m: number | string = Math.floor(seconds / 60) % 60;

  let time;
  if (h > 0) {
    time = `${h}:`;
    if (m < 10) {
      m = `0${m}`;
    }
  } else {
    time = '';
  }

  let s: string | number = seconds % 60;
  if (s < 10) {
    s = `0${s}`;
  }

  return `${time}${m}:${s}`;
};

/**
 * Converst bytes to human readable unit.
 * Thank you Amir from StackOverflow.
 *
 * @param {number} bytes
 * @return {string}
 */
const units = ' KMGTPEZYXWVU';
export const toHumanSize = (bytes: number): string => {
  if (bytes <= 0) {
    return '0';
  }
  const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
  return `${Math.round((bytes * 100) / Math.pow(1024, t2)) / 100}${units.charAt(t2).replace(' ', '')}B`;
};

/**
 * Template a string with variables denoted by {prop}.
 *
 * @param {string} str
 * @param {Array.<Object>} objs
 * @return {string}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tmpl = (str: string, objs: any[]): string => {
  return str.replace(/\{([\w.-]+)\}/g, (match, prop: string) => {
    const propArray = prop.split('.');
    for (let result of objs) {
      let j = 0;
      let myprop = propArray[j];
      while (myprop != null && result[myprop] != null) {
        result = result[myprop];
        if (propArray.length === ++j) {
          return sanitizeName(result, { replacement: '-' });
        }
        myprop = propArray[j];
      }
    }
    return match;
  });
};