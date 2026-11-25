// Shared guard: if APP_PASSCODE is set, every API call must send it in x-app-key.
module.exports = function authorised(req) {
  const need = process.env.APP_PASSCODE;
  if (!need) return true;
  return req.headers['x-app-key'] === need;
};
