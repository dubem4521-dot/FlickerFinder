const { neon } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    const sql = neon(process.env.DATABASE_URL);
    
    try {
        const reviews = await sql`
            SELECT id, movie_title, rating, review_text, user_name, created_at
            FROM reviews
            ORDER BY created_at DESC
            LIMIT 50
        `;
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviews)
        };
    } catch (error) {
        console.error('Database error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to load reviews' })
        };
    }
};