import bcrypt from "bcryptjs";
import {
  AITrigger,
  AuditAction,
  AuditEntityType,
  ClientType,
  DocumentSource,
  DocumentType,
  DossierStatus,
  DossierType,
  PrismaClient,
  Role,
  TaskPriority,
  TaskStatus
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const [admin, lawyer, staff] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@demo.law" },
      update: {},
      create: {
        email: "admin@demo.law",
        name: "Admin User",
        role: Role.ADMIN,
        passwordHash
      }
    }),
    prisma.user.upsert({
      where: { email: "lawyer@demo.law" },
      update: {},
      create: {
        email: "lawyer@demo.law",
        name: "Lead Lawyer",
        role: Role.LAWYER,
        passwordHash
      }
    }),
    prisma.user.upsert({
      where: { email: "staff@demo.law" },
      update: {},
      create: {
        email: "staff@demo.law",
        name: "Office Staff",
        role: Role.STAFF,
        passwordHash
      }
    })
  ]);

  const client = await prisma.client.create({
    data: {
      type: ClientType.COMPANY,
      name: "Northwind Ventures",
      email: "legal@northwind.test",
      phone: "+1 555-0101",
      address: "123 Main St, Springfield",
      vatNumber: "BE0123.456.789",
      companyNumber: "0123.456.789",
      contactFirstName: "Nora",
      contactLastName: "Windsor",
      contactEmail: "nora.windsor@northwind.test"
    }
  });

  const dossier = await prisma.dossier.create({
    data: {
      clientId: client.id,
      title: "SaaS Master Service Agreement",
      type: DossierType.CONTRACT,
      status: DossierStatus.OPEN,
      ownerUserId: lawyer.id,
      summary: "Drafting and negotiating MSA with enterprise client.",
      aiContext: "Focus on liability caps and IP indemnity language."
    }
  });

  await prisma.task.createMany({
    data: [
      {
        dossierId: dossier.id,
        title: "Review redlined liability clause",
        description: "Compare client redline with fallback positions.",
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
      },
      {
        dossierId: dossier.id,
        title: "Prepare negotiation call agenda",
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }
    ]
  });

  await prisma.document.create({
    data: {
      dossierId: dossier.id,
      type: DocumentType.CONTRACT,
      title: "MSA Draft v1",
      content: "This Master Services Agreement is entered into by...",
      source: DocumentSource.TEMPLATE,
      version: 1
    }
  });

  await prisma.template.create({
    data: {
      name: "Client Follow-up Letter",
      type: "LETTER",
      body: "Dear {{client.name}},\n\nRegarding dossier {{dossier.title}}, we confirm...\n\nRegards,\n{{user.name}}"
    }
  });

  await prisma.timeEntry.create({
    data: {
      dossierId: dossier.id,
      userId: lawyer.id,
      startAt: new Date(Date.now() - 1000 * 60 * 45),
      endAt: new Date(),
      description: "Reviewed counterparty comments on MSA.",
      autoCaptured: false
    }
  });

  await prisma.aIEvent.create({
    data: {
      dossierId: dossier.id,
      trigger: AITrigger.DASHBOARD_BRIEFING,
      inputSummary: "Initial dashboard briefing seed event",
      outputJson: JSON.stringify({
        summary: "Negotiation is active. Liability clause requires partner review.",
        confidence: 0.78
      }),
      confidence: 0.78
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: AuditEntityType.CLIENT,
      entityId: client.id,
      action: AuditAction.CREATE,
      afterJson: JSON.stringify(client)
    }
  });

  console.log("Seed complete");
  console.log("Demo login:");
  console.log("admin@demo.law / demo1234");
  console.log("lawyer@demo.law / demo1234");
  console.log("staff@demo.law / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
