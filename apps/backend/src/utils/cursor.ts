export const encodeCursor = <T>(value: T) => {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64");
};

export const decodeCursor = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf-8")) as T;
};
