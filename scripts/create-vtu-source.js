const { PrismaClient } = require('@prisma/client');

async function main() {
	const prisma = new PrismaClient();
	try {
		await prisma.vtuSource.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
		const created = await prisma.vtuSource.create({
			data: {
				name: 'DataHubGH',
				provider: 'DATAHUBGH',
				baseUrl: 'https://user.datahubgh.com/api',
				apiKey: 'process.env.DATAHUBGH_API_KEY',
				isDefault: true,
				active: true,
			},
		});
		console.log('Created VTU source:', created.id);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


// node scripts/create-vtu-source.js