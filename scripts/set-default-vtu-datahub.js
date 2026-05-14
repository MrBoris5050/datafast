const { PrismaClient } = require('@prisma/client');

async function main() {
	const prisma = new PrismaClient();
	try {
		// Find all VTU sources with provider DATAHUBGH
		// First try exact match, then try case-insensitive name search
		let datahubSources = await prisma.vtuSource.findMany({
			where: {
				provider: 'DATAHUBGH'
			}
		});

		// If no exact match, try finding by name containing 'datahub' (case-insensitive)
		if (datahubSources.length === 0) {
			const allSources = await prisma.vtuSource.findMany();
			datahubSources = allSources.filter(s => 
				s.provider.toUpperCase() === 'DATAHUBGH' || 
				s.name.toLowerCase().includes('datahub')
			);
		}

		if (datahubSources.length === 0) {
			console.log('No DataHubGH VTU source found. Creating one...');
			
			// Check if we have environment variables for DataHubGH
			const apiKey = process.env.DATAHUBGH_API_KEY;
			const baseUrl = process.env.DATAHUBGH_BASE_URL || 'https://user.datahubgh.com/api';
			
			if (!apiKey) {
				console.log('\n⚠️  DATAHUBGH_API_KEY environment variable not set.');
				console.log('Creating DataHubGH source with placeholder API key.');
				console.log('Please update the API key in the admin interface after creation.\n');
			}
			
			// Unset all other default sources first
			await prisma.vtuSource.updateMany({ 
				data: { isDefault: false }, 
				where: { isDefault: true } 
			});
			
			// Create the DataHubGH source
			const created = await prisma.vtuSource.create({
				data: {
					name: 'DataHubGH',
					provider: 'DATAHUBGH',
					baseUrl: baseUrl,
					apiKey: apiKey || 'PLEASE_UPDATE_THIS_API_KEY',
					isDefault: true,
					active: true,
				},
			});
			
			console.log('✓ Created DataHubGH VTU source and set as default');
			console.log(`  ID: ${created.id}`);
			console.log(`  Name: ${created.name}`);
			if (!apiKey) {
				console.log('  ⚠️  Remember to update the API key in the admin interface!');
			}
			process.exit(0);
		}

		// Prefer active sources, otherwise use the first one
		const sourceToSet = datahubSources.find(s => s.active) || datahubSources[0];

		console.log(`Found ${datahubSources.length} DataHubGH source(s). Setting "${sourceToSet.name}" (ID: ${sourceToSet.id}) as default...`);

		// First, unset all other default sources
		await prisma.vtuSource.updateMany({ 
			data: { isDefault: false }, 
			where: { isDefault: true } 
		});

		// Set the DataHubGH source as default
		const updated = await prisma.vtuSource.update({
			where: { id: sourceToSet.id },
			data: { isDefault: true }
		});

		console.log('✓ Successfully set DataHubGH as default VTU provider');
		console.log(`  Name: ${updated.name}`);
		console.log(`  Provider: ${updated.provider}`);
		console.log(`  Active: ${updated.active}`);
		console.log(`  Default: ${updated.isDefault}`);
	} catch (error) {
		console.error('Error setting default VTU source:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

