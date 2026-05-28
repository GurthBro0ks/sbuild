# WordPress Migration Plan (Discovery + Staging First)

## 1) Current WordPress discovery checklist

- Current host/provider: confirm current runtime host, VM/container details, and who administers it
- DNS owner/registrar: verify IONOS account ownership and change-control access
- WordPress version: record exact `wp core version`
- PHP/MySQL versions: record `php -v` and DB server version
- Plugins/themes: export active/inactive plugin and theme inventory with versions/licenses
- Media size: capture `wp-content/uploads` total size and file count
- Database size: capture full DB size, largest tables, and growth trend
- Backups: verify backup tooling, retention window, restore test status, and storage location
- Admin access: confirm working WordPress admin and server shell/DB credentials holders

## 2) Target server options

- WordPress container stack: Dockerized WordPress + MariaDB + persistent volumes + backups
- Bare metal stack: Nginx/Apache + PHP-FPM + MariaDB on host with system backups
- Staging-first domain: `staging.blackfishfarms.com` as mandatory dry-run migration target before production cutover

## 3) Safe migration path

- Full backup: snapshot current files + DB before any cutover work
- Database export: consistent dump with table checks and import validation
- `wp-content` export: include uploads, themes, plugins, mu-plugins
- Staging restore: restore files + DB to staging environment only
- URL search/replace: safely rewrite URLs for staging domain
- SSL: issue and verify staging certificates before QA
- Forms/email verification: validate contact forms, SMTP, deliverability, and spam folder behavior
- Performance/cache: reconfigure cache plugin/CDN/object cache and validate page speed
- Rollback plan: keep DNS rollback and full restore procedure ready before production switch

## 4) sBuild real-edit testing plan (staging only)

- Publish target remains staging-only until explicit production approval
- No production overwrite path enabled during staging validation
- Static/export preview validation before any CMS-content overwrite experiments
- Approval gate: require explicit stakeholder sign-off before production publishing is enabled

## 5) Key risks

- Breaking current public site behavior during DNS/cutover
- DNS side effects affecting non-web services (mail/autodiscover/subdomains)
- Plugin licensing or activation limits on new host
- Contact form/email delivery regressions
- Image/media URL/path mismatches after restore
- SEO impact from missing redirects/canonicals/metadata

## 6) Recommended next phase

- Build a read-only WordPress discovery proof pack:
  - runtime/env inventory
  - plugin/theme/license inventory
  - DB/media size report
  - backup/restore evidence
  - risk register with owners
