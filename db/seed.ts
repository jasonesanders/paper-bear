import { db, Venue } from 'astro:db';

/**
 * Seed the database with initial venue data.
 * These are the MVP venues for the Vancouver Venue Scraper.
 */
export default async function seed() {
	const venues = [
		{
			id: 'rickshaw-theatre',
			name: 'Rickshaw Theatre',
			url: 'https://rickshawtheatre.com/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'rio-theatre',
			name: 'Rio Theatre',
			url: 'https://riotheatre.ca/calendar/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'park-theatre',
			name: 'Park Theatre',
			url: 'https://parktheatre.ca/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'heros-welcome',
			name: "Hero's Welcome",
			url: 'https://heroswelcome.ca/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'fox-cabaret',
			name: 'Fox Cabaret',
			url: 'https://foxcabaret.com/events/',
			enabled: true,
			createdAt: new Date(),
		},
	];

	await db.insert(Venue).values(venues);
	console.log(`✅ Seeded ${venues.length} venues`);
}
