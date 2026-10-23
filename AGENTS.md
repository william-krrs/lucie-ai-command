<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep launch-offer wording and included-minute allowances in the shared offer-terms module so offer descriptions remain consistent without altering payment automation.

- Admin manual unlocks live in `journey_overrides` and are merged into `getJourneyState`/`useJourneyAccess`; every admin server fn checks `has_role` server-side and writes `admin_audit_log` — keeps unlocks real and traceable.
- Visitor nav shows 4 grouped steps (src/lib/journey-groups.ts) over the existing sub-pages; gates stay per sub-page — keeps locks intact while simplifying the UI.
