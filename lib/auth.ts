import prisma from "@/lib/db/client";

export const getCurrentUserId = async (_request: Request): Promise<string> => {
  const devUserId = process.env.DEV_USER_ID;
  const devUserEmail = process.env.DEV_USER_EMAIL;
  const devUserDisplayName = process.env.DEV_USER_DISPLAY_NAME;

  if (!devUserId || !devUserEmail || !devUserDisplayName) {
    throw new Error("Missing development user environment configuration");
  }

  await prisma.user.upsert({
    where: { id: devUserId },
    update: {},
    create: {
      id: devUserId,
      email: devUserEmail,
      displayName: devUserDisplayName,
      timezone: "UTC",
    },
  });
  return devUserId;
};
