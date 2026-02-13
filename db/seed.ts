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
			city: 'Vancouver',
			url: 'https://rickshawtheatre.com/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'rio-theatre',
			name: 'Rio Theatre',
			city: 'Vancouver',
			url: 'https://riotheatre.ca/calendar/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'park-theatre',
			name: 'Park Theatre',
			city: 'Vancouver',
			url: 'https://parktheatre.ca/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'heros-welcome',
			name: "Hero's Welcome",
			city: 'Vancouver',
			url: 'https://heroswelcome.ca/events/',
			enabled: true,
			createdAt: new Date(),
		},
		{
			id: 'fox-cabaret',
			name: 'Fox Cabaret',
			city: 'Vancouver',
			url: 'https://foxcabaret.com/events/',
			enabled: true,
			createdAt: new Date(),
		},
	];

	await db.insert(Venue).values(venues).onConflictDoNothing();
	console.log(`✅ Seeded ${venues.length} venues`);
}
