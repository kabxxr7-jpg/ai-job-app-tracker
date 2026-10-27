import { prisma } from "@/lib/db";

/** Single-user app: there is exactly one Profile row, created lazily on first read. */
export async function getOrCreateProfile() {
  const existing = await prisma.profile.findFirst();
  if (existing) return existing;
  return prisma.profile.create({ data: {} });
}
