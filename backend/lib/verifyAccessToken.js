const jwt = require("jsonwebtoken");
const { getSupabaseAdmin } = require("./supabaseAdmin");

const RETRY_DELAYS_MS = [0, 1500, 3000];

function isTransientNetworkError(error) {
  const code = String(error?.cause?.code || error?.code || "").toUpperCase();
  const message = String(error?.message || error || "").toLowerCase();

  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "SUPABASE_FETCH_TIMEOUT" ||
    message.includes("fetch failed") ||
    message.includes("timed out")
  );
}

function verifyUserIdFromJwt(accessToken) {
  const secret = String(process.env.SUPABASE_JWT_SECRET || "").trim();
  if (!secret) {
    return null;
  }

  try {
    const payload = jwt.verify(accessToken, secret, { algorithms: ["HS256"] });
    const userId = String(payload?.sub || "").trim();
    return userId || null;
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      const expired = new Error("Invalid or expired session. Please sign in again.");
      expired.statusCode = 401;
      expired.cause = error;
      throw expired;
    }
    return null;
  }
}

async function resolveUserIdFromSupabaseApi(accessToken) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in backend/.env");
  }

  let lastError = null;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(accessToken);

      if (!error && user?.id) {
        return user.id;
      }

      lastError = error || new Error("Invalid or expired session");
      if (error && !isTransientNetworkError(error)) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error)) {
        throw error;
      }
    }
  }

  if (isTransientNetworkError(lastError)) {
    const networkError = new Error(
      "Cannot reach Supabase to verify your session. Check your internet connection and try again."
    );
    networkError.statusCode = 503;
    networkError.cause = lastError;
    throw networkError;
  }

  const authError = new Error("Invalid or expired session. Please sign in again.");
  authError.statusCode = 401;
  authError.cause = lastError;
  throw authError;
}

async function resolveUserIdFromAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    const error = new Error("Missing authorization token. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  try {
    const localUserId = verifyUserIdFromJwt(token);
    if (localUserId) {
      return localUserId;
    }
  } catch (error) {
    if (error?.statusCode === 401) {
      throw error;
    }
  }

  return resolveUserIdFromSupabaseApi(token);
}

module.exports = {
  resolveUserIdFromAccessToken,
  verifyUserIdFromJwt,
  isTransientNetworkError,
};
