const { createServiceClient } = require("./supabaseClient");

let adminClient = null;

function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createServiceClient();
  }
  return adminClient;
}

module.exports = { getSupabaseAdmin };
