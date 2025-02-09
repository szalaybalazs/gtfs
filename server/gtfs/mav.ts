const username = "balazs@szalay.me";
const password = "MibTwsVQDec8RxHC";

const basicAuthHeader =
  "Basic " + Buffer.from(username + ":" + password).toString("base64");

console.log(basicAuthHeader);
