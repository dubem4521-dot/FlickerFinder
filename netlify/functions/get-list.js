const { neon } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    
    // Get user email from query param (passed from frontend after auth)
    const userEmail = event.queryStringParameters.email;
    
    if (!userEmail) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'User not authenticated' })
        };
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    try {
        const items = await sql`
            SELECT item_id, media_type, title, year, rating, poster_path, added_at
            FROM user_lists
            WHERE user_email = ${userEmail}
            ORDER BY added_at DESC
        `;
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(items)
        };
    } catch (error) {
        console.error('Database error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to load list' })
        };
    }
};