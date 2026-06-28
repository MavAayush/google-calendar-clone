import prisma from "@/lib/db/client";
import { auth } from "@/lib/auth/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

export class UnauthorizedError extends Error {
  status = 401;
  code = "UNAUTHORIZED";
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const jwksUrl = `${process.env.NEON_AUTH_BASE_URL}/jwt`;
const JWKS = createRemoteJWKSet(new URL(jwksUrl));

export interface AuthUser {
  id: string;
  email: string;
  timezone: string;
}

const userCache = new Map<string, AuthUser>();

const getCookies = (request: Request): Record<string, string> => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return {};

  const result: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0].trim();
    const value = parts.slice(1).join("=");
    if (name) {
      result[name] = decodeURIComponent(value);
    }
  });
  return result;
};

export const getCurrentUser = async (request: Request): Promise<AuthUser> => {
  const cookieMap = getCookies(request);

  const sessionDataCookie = 
    cookieMap["__Secure-neon-auth.local.session_data"] || 
    cookieMap["neon-auth.local.session_data"];

  if (sessionDataCookie && process.env.NEON_AUTH_COOKIE_SECRET) {
    try {
      const secretKey = new TextEncoder().encode(process.env.NEON_AUTH_COOKIE_SECRET);
      const { payload } = await jwtVerify(sessionDataCookie, secretKey, {
        algorithms: ["HS256"],
      });

      const userPayload = (payload as any).user;
      if (userPayload && userPayload.email) {
        const email = userPayload.email;
        
        let cachedUser = userCache.get(email);
        if (!cachedUser) {
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                displayName: userPayload.name || email.split("@")[0],
                timezone: "UTC",
              },
            });
          }
          cachedUser = {
            id: user.id,
            email: user.email,
            timezone: user.timezone,
          };
          userCache.set(email, cachedUser);
        }
        return cachedUser;
      }
    } catch (err: any) {
      console.warn("[getCurrentUser] Local session_data verification failed:", err.message);
    }
  }

  const sessionTokenCookie = 
    cookieMap["__Secure-neon-auth.session_token"] || 
    cookieMap["neon-auth.session_token"] || 
    cookieMap["better-auth.session_token"];

  if (sessionTokenCookie && sessionTokenCookie.startsWith("eyJ")) {
    try {
      const { payload } = await jwtVerify(sessionTokenCookie, JWKS);
      const email = (payload as any).email || (payload as any).sub;
      if (email) {
        let cachedUser = userCache.get(email);
        if (!cachedUser) {
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                displayName: email.split("@")[0],
                timezone: "UTC",
              },
            });
          }
          cachedUser = {
            id: user.id,
            email: user.email,
            timezone: user.timezone,
          };
          userCache.set(email, cachedUser);
        }
        return cachedUser;
      }
    } catch (err: any) {
      console.warn("[getCurrentUser] Local OIDC JWT verification failed:", err.message);
    }
  }

  console.log("[getCurrentUser] Local checks failed. Falling back to remote auth.getSession().");
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  const email = session.user.email;
  let cachedUser = userCache.get(email);
  if (!cachedUser) {
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName: session.user.name || email.split("@")[0],
          timezone: "UTC",
        },
      });
    }
    cachedUser = {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
    };
    userCache.set(email, cachedUser);
  }

  return cachedUser;
};

export const getCurrentUserId = async (request: Request): Promise<string> => {
  const user = await getCurrentUser(request);
  return user.id;
};
