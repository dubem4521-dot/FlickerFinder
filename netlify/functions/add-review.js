const { neon } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    
    const sql = neon(process.env.DATABASE_URL);
    const { movieTitle, rating, reviewText, userName } = JSON.parse(event.body);
    
    // Basic validation
    if (!movieTitle || !rating || !reviewText || !userName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'All fields are required' })
        };
    }
    
    try {
        const result = await sql`
            INSERT INTO reviews (movie_title, rating, review_text, user_name)
            VALUES (${movieTitle}, ${rating}, ${reviewText}, ${userName})
            RETURNING id
        `;
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, id: result[0].id })
        };
    } catch (error) {
        console.error('Insert error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to save review' })
        };
    }
};