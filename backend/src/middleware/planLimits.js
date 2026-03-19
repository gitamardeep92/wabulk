import supabase from '../lib/supabase.js';

export async function checkPlanLimits(req, res, next) {
  const userId = req.user.id;
  const month = new Date().toISOString().slice(0, 7); // "2025-10"

  const { data: usage } = await supabase
    .from('usage')
    .select('messages_sent')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', req.user.plan)
    .single();

  if (!limits) return res.status(500).json({ error: 'Plan not found' });

  const sent = usage?.messages_sent || 0;

  // -1 means unlimited (pro plan)
  if (limits.monthly_messages !== -1 && sent >= limits.monthly_messages) {
    return res.status(429).json({
      error: 'Monthly message limit reached',
      limit: limits.monthly_messages,
      used: sent,
      upgrade_url: `${process.env.FRONTEND_URL}/billing`,
    });
  }

  req.planLimits = limits;
  req.currentUsage = sent;
  next();
}

export async function incrementUsage(userId, messageCount) {
  const month = new Date().toISOString().slice(0, 7);
  await supabase.rpc('upsert_usage', {
    p_user_id: userId,
    p_month: month,
    p_messages: messageCount,
  });
}
