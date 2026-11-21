// Vercel serverless entry point: re-export the Express app from server.js.
// server.js only calls app.listen() when run directly (require.main),
// so requiring it here does not start a second server.
module.exports = require("../server.js").app;
