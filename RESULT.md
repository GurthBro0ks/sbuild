RESULT=FAIL
root_cause=Mobile topbar status pill could wrap to multiple lines, but the status row lacked explicit mobile-safe height/line-height/padding and the spacer had no min-height fallback, causing visual clipping under the fixed toolbar in iPhone layouts.
exact_fix=Added explicit non-clipping sizing/box-model rules for .topbar-status on mobile, kept topbar measured via ResizeObserver with --mobile-topbar-h, ensured .topbar-mobile-spacer uses both height and min-height from that variable, added stable status row marker data-status-row="topbar-status-pill", and exposed mobileToolbarStatusOffset=active in Debug diagnostics.
status_bar_visible_contract=yes
toolbar_spacer_includes_status=yes
sticky_toolbar_preserved=yes
row_join_regression=no
login_route_preserved=not_touched
publish_dry_run=yes
validation_typecheck=PASS
validation_build=PASS
validation_lint=PASS
validation_test=PASS
validation_smoke=FAIL
commit_hash=875c48f
pushed=no
proof_dir=/tmp/proof_sbuild_mobile_status_bar_clipping_20260528T192603Z
manual_qa_next=Run iPhone login/editor QA to visually confirm full status pill visibility after status text updates and scroll interactions.
