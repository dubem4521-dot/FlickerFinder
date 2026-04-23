const { neon } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    
    const { userEmail, itemId, mediaType } = JSON.parse(event.body);
    
    if (!userEmail || !itemId || !mediaType) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields' })
        };
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    try {
        await sql`
            DELETE FROM user_lists
            WHERE user_email = ${userEmail} 
            AND item_id = ${itemId} 
            AND media_type = ${mediaType}
        `;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Delete error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to remove from list' })
        };
    }
};