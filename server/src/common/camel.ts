/**
 * Transforms a string to camel case
 * camel_case -> camelCase
 * @param s
 * @returns
 */
export const camelize = (s: string) =>
  s.replace(/_./g, (x) => x[1].toUpperCase());

/**
 * Transforms a string to snake case
 * snakeCase -> snake_case
 * @param s
 * @returns
 */
export const snakelize = (s: string) =>
  s.replace(/[A-Z]./g, (x) => `_${x.toLowerCase()}`);

export const snakeToCamel = (
  input: any,
  {
    prefix,
    exclude,
    filter = () => true,
    replacer = (k: string) => k,
    original = {},
  }: {
    prefix?: string;
    exclude?: string[];
    filter?: (e: any) => boolean;
    replacer?: (e: string) => string;
    original?: any;
  } = {}
) => {
  const _replacer = prefix
    ? (k: string) => k.replace(new RegExp(`^${prefix}`), "")
    : replacer;
  const _filter = exclude
    ? (k: string) => !exclude.some((prefix) => k.startsWith(prefix))
    : filter;
  const obj = Object.entries(input || {}).reduce((acc: any, [key, value]) => {
    if (!_filter(key)) return acc;
    if (prefix && !key.startsWith(prefix)) return acc;

    acc[camelize(_replacer(key))] = value;

    return acc;
  }, original);

  if (Object.keys(obj).length && Object.values(obj).filter(Boolean).length)
    return obj;
  return null;
};

export const camelToSnake = (
  input: any,
  filter: (e: any) => boolean = () => true,
  replacer: (e: any) => string = (e) => e,
  original: any = {}
) => {
  const obj = Object.entries(input || {}).reduce((acc: any, [key, value]) => {
    if (!filter(key)) return acc;

    acc[snakelize(replacer(key))] = value;

    return acc;
  }, {});

  if (Object.values(obj).some((value) => Boolean(value) || value === false))
    return { ...original, ...obj };
  return null;
};
