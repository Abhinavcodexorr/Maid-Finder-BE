// Fills {placeholders} in a message pulled from config/errorMessages.json.
// e.g. formatMessage(MESSAGES.server.fieldAlreadyExists, { field: 'email' })
const formatMessage = (template, vars = {}) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

module.exports = formatMessage;
