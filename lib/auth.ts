import prisma from "@/lib/db/client";
import { auth } from "@/lib/auth/server";

export class UnauthorizedError extends Error {
  status = 401;
  code = "UNAUTHORIZED";
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const getCurrentUserId = async (_request: Request): Promise<string> => {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  let user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: session.user.email,
        displayName: session.user.name || session.user.email.split("@")[0],
        timezone: "UTC",
      },
    });
  }

  return user.id;
};
