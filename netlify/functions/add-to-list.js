const { neon } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    
    const { userEmail, itemId, mediaType, title, year, rating, posterPath } = JSON.parse(event.body);
    
    if (!userEmail || !itemId || !mediaType || !title) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields' })
        };
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    try {
        // Insert or ignore if exists
        await sql`
            INSERT INTO user_lists (user_email, item_id, media_type, title, year, rating, poster_path)
            VALUES (${userEmail}, ${itemId}, ${mediaType}, ${title}, ${year}, ${rating}, ${posterPath})
            ON CONFLICT (user_email, item_id, media_type) DO NOTHING
        `;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Insert error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to add to list' })
        };
    }
};