// 1. Share to Feed API
app.post('/api/posts/share/feed', async (req, res) => {
  const { original_post_id, user_id, text, privacy, location, feeling, tagged_users } = req.body;
  
  // Create shared post
  const sharedPost = await db.insert('posts', {
    user_id,
    content: text || `Shared a post`,
    original_post_id,
    privacy,
    location,
    feeling,
    tagged_users: tagged_users ? JSON.stringify(tagged_users) : null,
    created_at: new Date(),
    is_shared: true
  });
  
  // Increment original post share count
  await db.query('UPDATE posts SET shares = shares + 1 WHERE id = ?', [original_post_id]);
  
  res.json({ success: true, post_id: sharedPost.id });
});

// 2. Share to Groups/Brands API
app.post('/api/posts/share/targets', async (req, res) => {
  const { original_post_id, user_id, target_type, target_ids, shared_text, per_target_text } = req.body;
  
  const results = [];
  
  for (const target_id of target_ids) {
    // Check user permission for this target
    const hasAccess = await checkUserAccess(user_id, target_id, target_type);
    
    if (hasAccess) {
      // Create post in group/brand
      const post = await db.insert('posts', {
        user_id,
        target_type,
        target_id,
        content: per_target_text?.[target_id] || shared_text || `Shared a post`,
        original_post_id,
        created_at: new Date(),
        is_shared: true
      });
      
      results.push({ target_id, success: true, post_id: post.id });
    } else {
      results.push({ target_id, success: false, error: 'No access' });
    }
  }
  
  // Increment original post share count
  await db.query('UPDATE posts SET shares = shares + 1 WHERE id = ?', [original_post_id]);
  
  res.json({ success: true, results });
});

// 3. Share to Messages API
app.post('/api/messages/share', async (req, res) => {
  const { original_post_id, sender_id, recipient_id, message } = req.body;
  
  // Create message
  const chatMessage = await db.insert('messages', {
    sender_id,
    recipient_id,
    content: message || 'Shared a post',
    original_post_id,
    created_at: new Date(),
    is_shared: true
  });
  
  // Create or update chat
  await db.query(`
    INSERT INTO chats (user1_id, user2_id, last_message, last_message_time)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    last_message = VALUES(last_message),
    last_message_time = VALUES(last_message_time)
  `, [sender_id, recipient_id, message || 'Shared a post', new Date()]);
  
  res.json({ success: true, message_id: chatMessage.id });
});
