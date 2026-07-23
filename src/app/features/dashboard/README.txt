DASHBOARD MODULE

Copy the dashboard folder into:
src/app/features/dashboard

Replace the existing dashboard files when Windows asks.

The route already points to DashboardComponent, so app.routes.ts
does not need any change.

Required generated Supabase functions:
- get_dashboard_summary
- get_dashboard_daily_trend
- get_dashboard_top_defects
- get_dashboard_recent_alerts
