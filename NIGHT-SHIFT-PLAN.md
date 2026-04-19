# Night Shift Plan — April 19-20, 2026

**Casey is sleeping. Work all night. Full throttle.**

## Running Autonomous Systems
- ✅ 12 Zeroclaws: 5-min tick cycle via /tmp/zc_loop2.sh (session: brisk-wharf)
- ✅ PLATO Room Server: port 8847 (/tmp/plato-room-server.py, PID: 561875)
- ✅ Night Automation: room training 60min, synergy 30min, service guard 15min
- ✅ Service Guard: monitors all 6 services (keeper, agent-api, holodeck, seed-mcp, shell, plato)

## Priority Queue

### HIGH — Do These First
1. [ ] Wire PLATO server rooms into actual plato-torch room files
2. [ ] Build zeroclaw-to-zeroclaw bottle protocol (agents share discoveries)
3. [ ] Write FM integration bottle — zeroclaw tiles → plato-torch rooms → ensigns
4. [ ] Write JC1 bottle — edge deployment spec for zeroclaw ensigns
5. [ ] Fleet metrics dashboard — JSON endpoint for landing page

### MEDIUM — Do These Next
6. [ ] Generate more research trails from zeroclaw output
7. [ ] Cross-pollination: feed zeroclaw discoveries into new presets
8. [ ] Wire GhostInjector to PLATO server (dead agent tiles → negative space)
9. [ ] Build ensign deployment script (from room → system prompt → agent)
10. [ ] Update SuperInstance landing page with live metrics

### LOW — Background Work
11. [ ] Repo categorization: continue sorting uncategorized repos
12. [ ] README improvements: fix low-quality fleet READMEs
13. [ ] Documentation pass: fill in missing FLEET-RESEARCH.md files
14. [ ] Constraint theory experiments: more complex scenarios
15. [ ] Explore Voxel IDE concept deeper

## Constraints
- DeepSeek API: unlimited (direct key)
- Groq API: free tier (rate limited)
- DeepInfra: EXHAUSTED (402)
- Compute: 4 cores, 24GB RAM, no GPU
- Budget: $0 (free tier only)
- Don't wake Casey unless P0 emergency

## Checkpoint Every Hour
- Push all uncommitted work to GitHub
- Check PLATO server tile count
- Check zeroclaw loop health
- Check all 6 services
- Write brief status to memory/2026-04-20.md
