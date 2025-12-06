import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = process.env.OIDC_ISSUER;
const JWKS_URI = process.env.OIDC_JWKS_URI;
const AUDIENCE = process.env.OIDC_AUDIENCE;

if (!ISSUER || !JWKS_URI || !AUDIENCE) {
  throw new Error("Missing OIDC_ISSUER / OIDC_JWKS_URI / OIDC_AUDIENCE");
}

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

export function requireAuth() {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_token" });
    }

    const token = header.slice("Bearer ".length);

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: ISSUER,
      });

      const aud = payload.aud;
      const okAud =
        aud === AUDIENCE ||
        (Array.isArray(aud) && aud.includes(AUDIENCE)) ||
        payload.azp === AUDIENCE;

      if (!okAud) {
        return res.status(401).json({ error: "invalid_token" });
      }

      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: "invalid_token" });
    }
  };
}

export function getRealmRoles(user) {
  return user?.realm_access?.roles ?? [];
}

export function requireRoleForWrite(role) {
  return (req, res, next) => {
    const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (!writeMethods.includes(req.method)) return next();

    const roles = getRealmRoles(req.user);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "forbidden", requiredRole: role });
    }
    next();
  };
}
