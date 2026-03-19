import supabase from '../lib/supabase.js';

export async function checkPlanLimits(req, res, next) {
  const userId = req.user.id;
  const month = new Date().toISOString().slice(0, 7);

  // Use maybeSingle() instead of single() to avoid errors when no row exists
  const { data: usage } = await supabase
    .from('usage')
    .select('messages_sent')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', req.user.plan)
    .maybeSingle();

  // Default to free plan limits if not found
  const planLimits = limits || { monthly_messages: 500, max_sessions: 1, api_calls_per_minute: 10 };

  const sent = usage?.messages_sent || 0;

  if (planLimits.monthly_messages !== -1 && sent >= planLimits.monthly_messages) {
    return res.status(429).json({
      error: 'Monthly message limit reached',
      limit: planLimits.monthly_messages,
      used: sent,
    });
  }

  req.planLimits = planLimits;
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
