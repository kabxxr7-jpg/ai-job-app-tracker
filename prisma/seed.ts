import { PrismaClient, ApplicationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_APPLICATIONS: Array<{
  company: string;
  role: string;
  status: ApplicationStatus;
  daysAgo: number;
}> = [
  { company: "Anchor AI", role: "Founding Full-Stack Engineer", status: "OFFER", daysAgo: 28 },
  { company: "Northwind Labs", role: "AI Integrations Engineer", status: "INTERVIEW", daysAgo: 21 },
  { company: "Bluefin Software", role: "Senior Backend Engineer", status: "SCREEN", daysAgo: 17 },
  { company: "Pinecone Robotics", role: "Platform Engineer", status: "APPLIED", daysAgo: 14 },
  { company: "Clearwater Data", role: "Full-Stack Engineer (AI Tools)", status: "APPLIED", daysAgo: 12 },
  { company: "Hollow Peak", role: "Automation Engineer", status: "REJECTED", daysAgo: 25 },
  { company: "Mossgate", role: "Backend Engineer", status: "REJECTED", daysAgo: 20 },
  { company: "Rivergate Systems", role: "Solutions Engineer", status: "WISHLIST", daysAgo: 2 },
  { company: "Thistle Analytics", role: "AI SaaS Engineer", status: "WISHLIST", daysAgo: 1 },
  { company: "Oakline Ventures", role: "Integrations Lead", status: "WITHDRAWN", daysAgo: 30 },
];

async function main() {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookConfig.deleteMany();
  await prisma.note.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.application.deleteMany();
  await prisma.company.deleteMany();
  await prisma.profile.deleteMany();

  await prisma.profile.create({
    data: {
      resumeText:
        "Full-stack engineer with 5 years building SaaS products. Strong in TypeScript, React, Next.js, Node, and Postgres. Shipped integrations with Stripe, Slack, and several LLM providers. Comfortable owning a feature end-to-end from schema to deploy.",
      skills: [
        "TypeScript",
        "React",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "Prisma",
        "REST APIs",
        "Webhooks",
        "LLM integration",
        "Stripe",
      ],
    },
  });

  for (const seed of SEED_APPLICATIONS) {
    const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000);

    const company = await prisma.company.create({
      data: { name: seed.company, createdAt },
    });

    const application = await prisma.application.create({
      data: {
        companyId: company.id,
        roleTitle: seed.role,
        status: seed.status,
        createdAt,
        updatedAt: createdAt,
        appliedAt: seed.status === "WISHLIST" ? null : createdAt,
      },
    });

    await prisma.statusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: seed.status === "WISHLIST" ? "WISHLIST" : "APPLIED",
        createdAt,
      },
    });

    if (seed.status !== "WISHLIST" && seed.status !== "APPLIED") {
      await prisma.statusEvent.create({
        data: {
          applicationId: application.id,
          fromStatus: "APPLIED",
          toStatus: seed.status,
          createdAt: new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log(`Seeded ${SEED_APPLICATIONS.length} applications.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
