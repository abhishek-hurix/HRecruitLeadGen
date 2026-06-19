import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.visitor.findMany({
    orderBy: { firstVisitedAt: 'desc' },
    include: { candidate: { select: { fullName: true } } },
  });

  console.log('TOTAL_VISITORS:', all.length);
  console.log('RECORDS:', JSON.stringify(
    all.map((v) => ({
      visitorId: v.visitorId.slice(0, 12) + '...',
      device: v.deviceType,
      firstSource: v.firstTouchSource,
      lastSource: v.lastTouchSource,
      campaign: v.lastTouchCampaign,
      candidateId: v.candidateId,
      firstAt: v.firstVisitedAt.toISOString(),
      lastAt: v.lastVisitedAt.toISOString(),
    })),
    null,
    2
  ));

  const byDevice = await prisma.visitor.groupBy({ by: ['deviceType'], _count: true });
  console.log('BY_DEVICE:', byDevice);

  const byCampaign = await prisma.visitor.groupBy({
    by: ['lastTouchCampaign'],
    _count: true,
    where: { lastTouchCampaign: { not: null } },
  });
  console.log('BY_CAMPAIGN:', byCampaign);
}

main()
  .finally(() => prisma.$disconnect());
