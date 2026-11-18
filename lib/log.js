export function log(level, message, context = {}) {
  console.log(JSON.stringify({ level, message, ...context, at: new Date().toISOString() }));
}
