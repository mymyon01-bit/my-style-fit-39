---
name: Subscription & Premium Trial System
description: 3-month free trial auto-activates on signup, gates daily/weekly AI styling
type: feature
---
- `subscriptions` table: plan (free/premium_trial/premium), status, trial dates
- Auto-trial: DB trigger on profile creation inserts 90-day premium_trial
- `daily_recommendations` table caches daily/weekly AI outputs per user per day
- Edge function `daily-stylist`: generates 3 daily outfits or 5-day weekly plan via Perplexity
- `useSubscription` hook exposes isPremium, daysRemaining, plan
- DailyPicks + WeeklyPlan components on HomePage, gated by subscription
- ProfilePage shows Crown badge with trial countdown
