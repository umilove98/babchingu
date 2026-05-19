import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pwd = await bcrypt.hash("password", 10);

  await prisma.profile.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      displayName: "관리자",
      passwordHash: pwd,
      avatarSeed: "admin",
      canHost: true,
      isAdmin: true,
    },
  });

  await prisma.profile.upsert({
    where: { username: "alice" },
    update: {},
    create: {
      username: "alice",
      displayName: "앨리스",
      passwordHash: pwd,
      avatarSeed: "alice-fox",
      canHost: true,
    },
  });

  await prisma.profile.upsert({
    where: { username: "bob" },
    update: {},
    create: {
      username: "bob",
      displayName: "밥",
      passwordHash: pwd,
      avatarSeed: "bob-bear",
      canHost: false,
    },
  });

  await prisma.profile.upsert({
    where: { username: "carol" },
    update: {},
    create: {
      username: "carol",
      displayName: "캐롤",
      passwordHash: pwd,
      avatarSeed: "carol-cat",
      canHost: false,
    },
  });

  console.log("✓ seed 완료 — admin/alice/bob/carol (모두 비번: password)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
